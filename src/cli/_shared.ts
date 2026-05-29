import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { GameboardCliError } from '../errors';
import {
  type GameboardPatrolRouteRule,
  type GameboardPatrolRouteSet,
  type GameboardPatrolRouteSetOptions,
  type GameboardPlan,
  type GameboardSpawnGroupOptions,
  type GameboardSpawnGroupPlan,
  planGameboardPatrolRoutes,
  planGameboardSpawnGroups,
  type SummarizeGameboardPlanOptions,
} from '../gameboard';
import { generateManifestFromSource } from '../ingest';
import {
  analyzeExternalAssetCompatibility,
  type ExternalAssetForwardAxis,
  type ExternalAssetIntendedRole,
} from '../interop';
import {
  inspectMedievalHexagonManifest,
  type MedievalHexagonManifestInspection,
} from '../manifest';
import {
  createGameboardPieceRegistry,
  type GameboardPieceDeclarationInput,
  type GameboardPieceRegistry,
  type GameboardPieceRegistryAnalysis,
  type GameboardPieceRegistrySelection,
  type GameboardPieceRole,
  type GameboardPieceSourceUrlOptions,
} from '../pieces';
import {
  type GameboardPlanValidationConfig,
  inspectSeededGameboardPieceFills,
  type SeededGameboardPieceFillInspection,
  type SeededGameboardPieceFillMode,
  type SeededGameboardPieceFillOptions,
  validateGameboardPlan,
} from '../rules';
import {
  type analyzeHexTileRegistry,
  createHexTileRegistry,
  createHexTileRegistryFromManifest,
  type GameboardRecipe,
  type GameboardScenario,
  type HexTileDeclarationInput,
  type HexTileRegistry,
  inspectGameboardRecipe,
  inspectGameboardScenario,
  type KayKitAssetPublicRole,
  type KayKitGuideScenario,
  listKayKitGuideRoleCoverages,
} from '../scenario';
import {
  type GameboardScenarioSimulationScript,
  type GameboardScenarioSimulationStep,
} from '../simulation';
import type {
  AssetBounds,
  AssetCategory,
  HexEdgeIndex,
  MedievalHexagonManifest,
  PackEdition,
} from '../types';

export interface GltfAccessorMetadata {
  min?: number[];
  max?: number[];
}

export interface GltfDocumentMetadata {
  accessors?: GltfAccessorMetadata[];
  animations?: Array<{ name?: string }>;
  materials?: Array<{ name?: string }>;
  meshes?: Array<{ primitives?: Array<{ attributes?: { POSITION?: number } }> }>;
  nodes?: Array<{ skin?: number; mesh?: number }>;
  skins?: unknown[];
}

export interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
}

/**
 * Render an absolute or unknown-shape path as a cwd-relative one for user-facing
 * error messages (PRD C5). Absolute paths in errors leak the developer's
 * directory layout and are noisy for CI/CD log readers; relative paths are
 * stable across machines.
 *
 * Falls through to the original string if relativization fails or if the
 * input doesn't look like a path (e.g. asset ids, descriptions).
 */
export function relativizePath(value: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    return String(value);
  }
  try {
    const resolved = resolve(value);
    const rel = relative(process.cwd(), resolved);
    // Fall back to absolute if the relative path leaves the cwd subtree
    // entirely (it's clearer to show the absolute path than `../../../...`).
    return rel.startsWith('..') ? value : rel || '.';
  } catch {
    return value;
  }
}

/**
 * Compute the effective output root used to jail user-supplied `--out*` paths.
 *
 * Production CLI use cases always write inside the current working directory,
 * so `process.cwd()` is the default jail root. The test harness — which spawns
 * the CLI from `packageRoot` and writes outputs into `os.tmpdir()` — opts into
 * a wider jail by setting `HEX_WORLDS_OUT_ROOT`. The env var is the only
 * legitimate way to widen the jail; CLI users never set it.
 */
export function defaultOutRoot(): string {
  const envRoot = process.env.HEX_WORLDS_OUT_ROOT;
  if (typeof envRoot === 'string' && envRoot.length > 0) {
    return resolve(envRoot);
  }
  return process.cwd();
}

/**
 * Resolve a user-supplied `--out*` value against an output root (defaults to
 * `defaultOutRoot()`), then assert the resolved path is inside that root.
 *
 * Defense in depth (PRD C1 / S-H1): even when a caller is careless, hostile
 * inputs like `--outJson=../../../etc/passwd` resolve outside `outRoot` and
 * throw instead of clobbering host files. `extract`'s destructive `rmSync`
 * destination flows through here too, so escape attempts can never wipe a
 * directory outside the jail.
 *
 * @param value User-supplied path from CLI flags.
 * @param outRoot Directory the resolved path must stay inside. Defaults to
 *   `defaultOutRoot()` (cwd, or `HEX_WORLDS_OUT_ROOT` when set).
 * @returns Absolute resolved path, guaranteed to be inside `outRoot`.
 * @throws When the resolved path escapes the jail via `..` segments or via an
 *   absolute path that points outside `outRoot`.
 */
export function safeResolveOutput(value: string, outRoot: string = defaultOutRoot()): string {
  const root = resolve(outRoot);
  const resolved = resolve(root, value);
  const rel = relative(root, resolved);
  if (rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))) {
    return resolved;
  }
  throw new GameboardCliError(`--out path escapes the output root: ${value}`);
}
export function formatManifestIssue(
  issue: MedievalHexagonManifestInspection['issues'][number]
): string {
  const location = issue.assetId ? ` ${issue.assetId}` : issue.path ? ` ${issue.path}` : '';
  return `${issue.code}${location} - ${issue.message}`;
}

export function readManifest(path: string): MedievalHexagonManifest {
  const inspection = inspectManifestPath(path);
  if (!inspection.manifest || inspection.errorCount > 0) {
    throw new GameboardCliError(
      [
        `Invalid manifest ${relativizePath(path)}`,
        ...inspection.issues
          .filter((issue) => issue.severity === 'error')
          .map((issue) => `- ${formatManifestIssue(issue)}`),
      ].join('\n')
    );
  }
  return inspection.manifest;
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function inspectManifestPath(path: string): MedievalHexagonManifestInspection {
  return inspectMedievalHexagonManifest(readJson(path));
}


export function validationCatalogFromArgs(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): MedievalHexagonManifest | undefined {
  if (typeof parsed.flags.manifest === 'string') {
    return readManifest(resolve(parsed.flags.manifest));
  }
  if (!existsSync(sourceRoot)) {
    return undefined;
  }
  return generateManifestFromSource({
    sourceRoot,
    edition,
  });
}

export function validationConfigFromArgs(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): GameboardPlanValidationConfig {
  const assetCatalog = validationCatalogFromArgs(parsed, sourceRoot, edition);
  const registry =
    typeof parsed.flags.registry === 'string'
      ? registryFromArgs(parsed, sourceRoot, edition)
      : assetCatalog
        ? createHexTileRegistryFromManifest(assetCatalog)
        : undefined;
  return {
    registry,
    assetCatalog,
    allowUnknownAssets: parsed.flags.allowUnknownAssets === true,
    allowUnknownAssetIds: readCsv(parsed.flags.allowUnknownAssetIds),
  };
}

export function registryFromArgs(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): HexTileRegistry {
  if (typeof parsed.flags.registry === 'string') {
    return readRegistry(resolve(parsed.flags.registry));
  }
  const manifest =
    typeof parsed.flags.manifest === 'string'
      ? readManifest(resolve(parsed.flags.manifest))
      : generateManifestFromSource({
          sourceRoot,
          edition,
        });
  return createHexTileRegistryFromManifest(manifest);
}

export function readRegistry(path: string): HexTileRegistry {
  const raw = readJson(path);
  if (!Array.isArray(raw) && (typeof raw !== 'object' || raw === null)) {
    throw new GameboardCliError(
      `Registry file ${relativizePath(path)} must be a declaration array or { "declarations": [...] }`
    );
  }
  const payload = raw as HexTileDeclarationInput[] | { declarations: HexTileDeclarationInput[] };
  const declarations = Array.isArray(payload) ? payload : payload.declarations;
  if (!Array.isArray(declarations)) {
    throw new GameboardCliError(
      `Registry file ${relativizePath(path)} must be a declaration array or { "declarations": [...] }`
    );
  }
  return createHexTileRegistry(declarations);
}

export function readPieceRegistry(path: string): GameboardPieceRegistry {
  const raw = readJson(path);
  if (!Array.isArray(raw) && (typeof raw !== 'object' || raw === null)) {
    throw new GameboardCliError(
      `Piece registry file ${relativizePath(path)} must be a declaration, an array, { "declaration": ... }, { "pieces": [...] }, or { "declarations": [...] }`
    );
  }
  const payload = raw as
    | GameboardPieceDeclarationInput[]
    | GameboardPieceDeclarationInput
    | {
        pieces?: GameboardPieceDeclarationInput[];
        declarations?: GameboardPieceDeclarationInput[];
        declaration?: GameboardPieceDeclarationInput;
      };
  const declarations = Array.isArray(payload)
    ? payload
    : 'id' in payload
      ? [payload]
      : payload.declaration
        ? [payload.declaration]
        : (payload.pieces ?? payload.declarations);
  if (!Array.isArray(declarations)) {
    throw new GameboardCliError(
      `Piece registry file ${relativizePath(path)} must be a declaration, an array, { "declaration": ... }, { "pieces": [...] }, or { "declarations": [...] }`
    );
  }
  return createGameboardPieceRegistry(declarations);
}

export function inspectPiecesPlacementFromArgs(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition,
  registry: GameboardPieceRegistry,
  fill: SeededGameboardPieceFillOptions
): {
  plan: GameboardPlan;
  inspection: SeededGameboardPieceFillInspection;
} {
  const { plan, violations } = layoutAnalysisPlanFromArgs(
    parsed,
    validationConfigFromArgs(parsed, sourceRoot, edition),
    parsed.flags.allowInvalid === true
  );
  if (
    violations.some((violation) => violation.severity === 'error') &&
    parsed.flags.allowInvalid !== true
  ) {
    printViolations(violations);
    process.exit(1);
  }
  return {
    plan,
    inspection: inspectSeededGameboardPieceFills(plan, registry, [fill], {
      seed: typeof parsed.flags.seed === 'string' ? parsed.flags.seed : undefined,
    }),
  };
}

export function layoutAnalysisPlanFromArgs(
  parsed: ParsedArgs,
  validationConfig: GameboardPlanValidationConfig,
  allowInvalid: boolean
): {
  plan: GameboardPlan;
  violations: ReadonlyArray<ReturnType<typeof validateGameboardPlan>[number]>;
} {
  if (typeof parsed.flags.plan === 'string') {
    const plan = readJson(resolve(parsed.flags.plan)) as GameboardPlan;
    return {
      plan,
      violations: validateGameboardPlan(plan, validationConfig),
    };
  }
  if (typeof parsed.flags.recipe === 'string') {
    const recipe = readJson(resolve(parsed.flags.recipe)) as GameboardRecipe;
    const inspection = inspectGameboardRecipe(recipe, { plan: validationConfig });
    if (!inspection.plan) {
      if (!allowInvalid) {
        printViolations(inspection.violations);
        process.exit(1);
      }
      throw new GameboardCliError(
        `Recipe ${relativizePath(String(parsed.flags.recipe))} did not compile to a GameboardPlan`
      );
    }
    return {
      plan: inspection.plan,
      violations: inspection.violations,
    };
  }
  const scenarioPath = String(parsed.flags.scenario);
  const scenario = readJson(resolve(scenarioPath)) as GameboardScenario;
  const inspection = inspectGameboardScenario(scenario, { plan: validationConfig });
  if (!inspection.plan) {
    if (!allowInvalid) {
      printViolations(inspection.violations);
      process.exit(1);
    }
    throw new GameboardCliError(
      `Scenario ${relativizePath(scenarioPath)} did not compile to a GameboardPlan`
    );
  }
  return {
    plan: inspection.plan,
    violations: inspection.violations,
  };
}

export function summaryOptionsFromFlags(
  flags: Record<string, string | boolean>
): SummarizeGameboardPlanOptions {
  const topAssetLimit = readNumberFlag(flags.topAssetLimit ?? flags.topAssets);
  return topAssetLimit === undefined ? {} : { topAssetLimit };
}

export function routePlanningPlanFromArgs(
  parsed: ParsedArgs,
  validationConfig: GameboardPlanValidationConfig,
  allowInvalid: boolean,
  scenario: GameboardScenario | undefined
): {
  plan: GameboardPlan;
  violations: ReadonlyArray<ReturnType<typeof validateGameboardPlan>[number]>;
} {
  if (typeof parsed.flags.plan === 'string') {
    const plan = readJson(resolve(parsed.flags.plan)) as GameboardPlan;
    return {
      plan,
      violations: validateGameboardPlan(plan, validationConfig),
    };
  }
  const recipe =
    scenario?.board ??
    (typeof parsed.flags.recipe === 'string'
      ? readJson(resolve(parsed.flags.recipe)) as GameboardRecipe
      : undefined);
  if (!recipe) {
    throw new GameboardCliError(
      `Scenario ${relativizePath(String(parsed.flags.scenario))} did not include a board recipe`
    );
  }
  const inspection = inspectGameboardRecipe(recipe, { plan: validationConfig });
  if (!inspection.plan) {
    if (!allowInvalid) {
      printViolations(inspection.violations);
      process.exit(1);
    }
    throw new GameboardCliError('Route planning input did not compile to a GameboardPlan');
  }
  return {
    plan: inspection.plan,
    violations: inspection.violations,
  };
}

export function patrolSpawnGroupsFromArgs(
  parsed: ParsedArgs,
  plan: GameboardPlan,
  scenario: GameboardScenario | undefined
): GameboardSpawnGroupPlan | undefined {
  const options =
    typeof parsed.flags.groups === 'string'
      ? readSpawnGroupOptions(resolve(parsed.flags.groups), parsed.flags.seed)
      : scenario?.spawnGroups;
  return options ? planGameboardSpawnGroups(plan, options) : undefined;
}

export function patrolRouteSetFromArgs(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition,
  scenario: GameboardScenario | undefined
): GameboardPatrolRouteSet {
  if (typeof parsed.flags.routes === 'string') {
    const payload = readJson(resolve(parsed.flags.routes));
    if (isPatrolRouteSet(payload)) {
      return payload;
    }
  }

  if (!scenario?.patrolRoutes?.length && typeof parsed.flags.routes !== 'string') {
    throw new GameboardCliError(
      'patrol-script requires --routes <path> or --scenario <path> with patrolRoutes'
    );
  }

  const inputFlags = ['plan', 'recipe', 'scenario'].filter(
    (key) => typeof parsed.flags[key] === 'string'
  );
  if (inputFlags.length !== 1) {
    throw new GameboardCliError(
      'patrol-script requires exactly one of --plan <path>, --recipe <path>, or --scenario <path> when routes are not a planned route set'
    );
  }

  const { plan, violations } = routePlanningPlanFromArgs(
    parsed,
    validationConfigFromArgs(parsed, sourceRoot, edition),
    parsed.flags.allowInvalid === true,
    scenario
  );
  if (
    violations.some((violation) => violation.severity === 'error') &&
    parsed.flags.allowInvalid !== true
  ) {
    printViolations(violations);
    process.exit(1);
  }
  const spawnGroups = patrolSpawnGroupsFromArgs(parsed, plan, scenario);
  if (spawnGroups?.errors.length && parsed.flags.allowInvalid !== true) {
    printSpawnGroupPlan(spawnGroups);
    process.exit(1);
  }
  const routeOptions =
    typeof parsed.flags.routes === 'string'
      ? readPatrolRouteOptions(resolve(parsed.flags.routes), parsed.flags.seed)
      : {
          seed:
            typeof parsed.flags.seed === 'string'
              ? parsed.flags.seed
              : `${scenario?.id ?? plan.seed}:patrol-routes`,
          routes: scenario?.patrolRoutes ?? [],
        };
  return planGameboardPatrolRoutes(plan, {
    ...routeOptions,
    spawnGroups,
  });
}

export function readGuideScenarioPageFilter(value: string | boolean | undefined): number[] {
  return readCsv(value).map((page) => {
    const parsedPage = Number(page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      throw new GameboardCliError(
        `Expected --page to contain one-based guide page numbers, received ${page}`
      );
    }
    return parsedPage;
  });
}

export function readGuideScenarioEditionFilter(
  value: string | boolean | undefined
): Array<KayKitGuideScenario['edition']> {
  return readCsv(value).map((edition) => {
    if (
      edition === 'free' ||
      edition === 'extra' ||
      edition === 'mixed' ||
      edition === 'reference'
    ) {
      return edition;
    }
    throw new GameboardCliError(
      `Expected --editionScope to contain free, extra, mixed, or reference, received ${edition}`
    );
  });
}

export function readGuideAssetIdFilter(parsed: ParsedArgs): string[] {
  return uniqueStrings([...readCsv(parsed.flags.assetId), ...readCsv(parsed.flags.assetIds)]);
}

export function readGuideUsageMinimumEdition(
  value: string | boolean | undefined
): PackEdition | 'all' {
  if (value === undefined || value === false) {
    return 'all';
  }
  if (value === 'free' || value === 'extra' || value === 'all') {
    return value;
  }
  throw new GameboardCliError(
    `Expected --minimumEdition to contain free, extra, or all, received ${String(value)}`
  );
}

export function readGuideUsageCategoryFilter(value: string | boolean | undefined): AssetCategory[] {
  return readCsv(value).map((category) => {
    if (
      category === 'tiles' ||
      category === 'buildings' ||
      category === 'decoration' ||
      category === 'units'
    ) {
      return category;
    }
    throw new GameboardCliError(
      `Expected --category to contain tiles, buildings, decoration, or units, received ${category}`
    );
  });
}

export function readGuideUsageRoleFilter(
  value: string | boolean | undefined
): KayKitAssetPublicRole[] {
  const validRoles = new Set(listKayKitGuideRoleCoverages().map((coverage) => coverage.role));
  return readCsv(value).map((role) => {
    if (validRoles.has(role as KayKitAssetPublicRole)) {
      return role as KayKitAssetPublicRole;
    }
    throw new GameboardCliError(
      `Expected --role to contain a known guide asset role, received ${role}`
    );
  });
}

export function formatGuideScenarioPages(pages: readonly number[]): string {
  if (pages.length === 0) {
    return 'none';
  }
  const sortedPages = [...pages].sort((a, b) => a - b);
  const isContiguous = sortedPages.every((page, index) => {
    if (index === 0) return true;
    const previous = sortedPages[index - 1];
    return previous !== undefined && page === previous + 1;
  });
  if (isContiguous && sortedPages.length > 1) {
    return `${sortedPages[0]}-${sortedPages[sortedPages.length - 1]}`;
  }
  return sortedPages.join(',');
}

export function readSimulationScript(path: string): GameboardScenarioSimulationScript {
  const payload = readJson(path);
  if (Array.isArray(payload)) {
    return {
      schemaVersion: '1.0.0',
      steps: payload as GameboardScenarioSimulationStep[],
    };
  }
  if (!isRecord(payload) || !Array.isArray(payload.steps)) {
    throw new GameboardCliError(
      `Simulation script ${relativizePath(path)} must be a step array or { "steps": [...] }`
    );
  }
  return payload as unknown as GameboardScenarioSimulationScript;
}

export function readSpawnGroupOptions(
  path: string,
  seedOverride: string | boolean | undefined
): GameboardSpawnGroupOptions {
  const payload = readJson(path);
  const groups = Array.isArray(payload)
    ? (payload as GameboardSpawnGroupOptions['groups'])
    : isRecord(payload) && Array.isArray(payload.groups)
      ? (payload.groups as GameboardSpawnGroupOptions['groups'])
      : undefined;
  if (!Array.isArray(groups)) {
    throw new GameboardCliError(
      `Spawn group file ${relativizePath(path)} must be a group array or { "groups": [...] }`
    );
  }
  const fileSeed = isRecord(payload) && typeof payload.seed === 'string' ? payload.seed : undefined;
  const profile =
    isRecord(payload) && isRecord(payload.profile)
      ? (payload.profile as GameboardSpawnGroupOptions['profile'])
      : undefined;
  return {
    seed: typeof seedOverride === 'string' ? seedOverride : fileSeed,
    ...(profile ? { profile } : {}),
    groups,
  };
}

export function readPatrolRouteOptions(
  path: string,
  seedOverride: string | boolean | undefined
): Omit<GameboardPatrolRouteSetOptions, 'spawnGroups'> {
  const payload = readJson(path);
  const routes = Array.isArray(payload)
    ? (payload as readonly GameboardPatrolRouteRule[])
    : isRecord(payload) && Array.isArray(payload.routes)
      ? (payload.routes as readonly GameboardPatrolRouteRule[])
      : undefined;
  if (!Array.isArray(routes)) {
    throw new GameboardCliError(
      `Patrol route file ${relativizePath(path)} must be a route array or { "routes": [...] }`
    );
  }
  const fileSeed = isRecord(payload) && typeof payload.seed === 'string' ? payload.seed : undefined;
  const profile =
    isRecord(payload) && isRecord(payload.profile)
      ? (payload.profile as GameboardPatrolRouteSetOptions['profile'])
      : undefined;
  const routeProfile =
    isRecord(payload) && isRecord(payload.routeProfile)
      ? (payload.routeProfile as GameboardPatrolRouteSetOptions['routeProfile'])
      : undefined;
  return {
    seed: typeof seedOverride === 'string' ? seedOverride : fileSeed,
    ...(profile ? { profile } : {}),
    ...(routeProfile ? { routeProfile } : {}),
    routes,
  };
}

export function printAnalysis(analysis: ReturnType<typeof analyzeHexTileRegistry>): void {
  console.log(`tile declarations: ${analysis.tileCount}`);
  console.log(`analyzed tile bounds: ${analysis.analyzedCount}`);
  console.log(`recommended scale: ${round(analysis.recommendedScale)}`);
  console.log(`median footprint: ${round(analysis.medianWidth)} x ${round(analysis.medianDepth)}`);
  console.log(`median height: ${round(analysis.medianHeight)}`);
  console.log(`row spacing: ${round(analysis.rowSpacing)}`);
  if (analysis.warnings.length > 0) {
    console.log('warnings:');
    for (const warning of analysis.warnings) {
      console.log(`  - ${warning}`);
    }
  } else {
    console.log('warnings: none');
  }
}

export function formatShape(shape: GameboardPlan['shape']): string {
  if (shape.kind === 'rectangle') {
    return `rectangle ${shape.width}x${shape.height}`;
  }
  return `hexagon radius ${shape.radius}`;
}

export function printPieceRegistryAnalysis(analysis: GameboardPieceRegistryAnalysis): void {
  console.log(`pieces: ${analysis.pieceCount}`);
  console.log(`local-only pieces: ${analysis.localOnlyCount}`);
  console.log(`roles: ${formatCounts(analysis.roleCounts)}`);
  console.log(`sources: ${formatCounts(analysis.sourceCounts)}`);
  console.log(`tags: ${formatCounts(analysis.tagCounts)}`);
  if (analysis.checks.length > 0) {
    console.log('checks:');
    for (const check of analysis.checks) {
      console.log(`  - ${check.id}: ${check.selectedCount} selected (${check.mode})`);
      if (check.selectedIds.length > 0) {
        console.log(`    pieces: ${check.selectedIds.join(', ')}`);
      }
    }
  }
  if (analysis.warnings.length > 0) {
    console.log('warnings:');
    for (const warning of analysis.warnings) {
      console.log(`  - ${warning}`);
    }
  } else {
    console.log('warnings: none');
  }
  if (analysis.errors.length > 0) {
    console.log('errors:');
    for (const error of analysis.errors) {
      console.log(`  - ${error}`);
    }
  } else {
    console.log('errors: none');
  }
}

export function printSpawnGroupPlan(spawnPlan: GameboardSpawnGroupPlan): void {
  console.log(`spawn seed: ${spawnPlan.seed}`);
  console.log(`groups: ${spawnPlan.groupCount}`);
  console.log(`locations: ${spawnPlan.selectedLocationCount}`);
  console.log(
    `routes: ${spawnPlan.routeChecks.filter((route) => route.found).length}/${spawnPlan.routeChecks.length}`
  );
  for (const group of spawnPlan.groups) {
    console.log(`  - ${group.id}: ${group.selectedCount}/${group.requestedCount} location(s)`);
    if (group.rejectedByGroupDistanceCount > 0) {
      console.log(`    rejected by group distance: ${group.rejectedByGroupDistanceCount}`);
    }
    if (group.locations.length > 0) {
      console.log(`    tiles: ${group.locations.map((location) => location.key).join(', ')}`);
    }
    for (const route of group.routeChecks) {
      console.log(
        `    route to ${route.toGroupId}: ${route.found ? 'found' : 'missing'}${
          route.found ? ` (${route.fromKey} -> ${route.toKey}, cost ${round(route.cost)})` : ''
        }`
      );
    }
    for (const warning of group.warnings) {
      console.log(`    warning: ${warning}`);
    }
    for (const error of group.errors) {
      console.log(`    error: ${error}`);
    }
  }
}

export function formatCounts(counts: Readonly<Record<string, number | undefined>>): string {
  const entries = Object.entries(counts).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number'
  );
  return entries.length ? entries.map(([key, value]) => `${key}=${value}`).join(', ') : 'none';
}

export function emitOutput(
  flags: Record<string, string | boolean>,
  payload: unknown,
  label: string
): void {
  if (typeof flags.out === 'string') {
    const path = safeResolveOutput(String(flags.out));
    writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${label} to ${path}`);
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }
}

export function printViolations(
  violations: ReadonlyArray<ReturnType<typeof validateGameboardPlan>[number]>
): void {
  const errors = violations.filter((violation) => violation.severity === 'error');
  const warnings = violations.filter((violation) => violation.severity === 'warning');
  console.log(`validation: ${errors.length} error(s), ${warnings.length} warning(s)`);
  for (const violation of violations) {
    const location = violation.tileKey ?? violation.placementId ?? 'board';
    console.log(`${violation.severity}: ${violation.code} ${location} - ${violation.message}`);
  }
}


export function printCompatibility(
  report: ReturnType<typeof analyzeExternalAssetCompatibility>
): void {
  console.log(`asset: ${report.id}`);
  console.log(`source pack: ${report.sourcePack}`);
  console.log(`compatible as KayKit hex tile: ${report.compatibleAsTile ? 'yes' : 'no'}`);
  console.log(`suggested role: ${report.suggestedRole}`);
  console.log(`suggested footprint: ${report.placement.footprint}`);
  console.log(`suggested scale: ${round(report.placement.scale)}`);
  console.log(`model forward: ${report.placement.modelForward}`);
  console.log(`board forward edge: ${report.placement.boardForwardEdge}`);
  console.log(`suggested rotation steps: ${report.placement.rotationSteps}`);
  console.log(`facing error radians: ${round(report.placement.facingErrorRadians)}`);
  console.log(
    `tile scale: ${round(report.tile.widthScale)} width / ${round(report.tile.depthScale)} depth`
  );
  if (report.warnings.length > 0) {
    console.log('warnings:');
    for (const warning of report.warnings) {
      console.log(`  - ${warning}`);
    }
  } else {
    console.log('warnings: none');
  }
  if (report.errors.length > 0) {
    console.log('errors:');
    for (const error of report.errors) {
      console.log(`  - ${error}`);
    }
  }
}

export function readGltfMetadata(path: string): {
  bounds: AssetBounds;
  hasRig: boolean;
  animationNames: readonly string[];
  materialSlots: readonly string[];
} {
  const document = path.endsWith('.glb')
    ? readGlbJson(path)
    : (JSON.parse(readFileSync(path, 'utf8')) as GltfDocumentMetadata);
  return {
    bounds: extractMetadataBounds(document),
    hasRig:
      (document.skins?.length ?? 0) > 0 ||
      (document.nodes ?? []).some((node) => node.skin !== undefined),
    animationNames: (document.animations ?? []).map(
      (animation, index) => animation.name ?? `animation_${index}`
    ),
    materialSlots: (document.materials ?? []).map(
      (material, index) => material.name ?? `material_${index}`
    ),
  };
}

export function readGlbJson(path: string): GltfDocumentMetadata {
  const buffer = readFileSync(path);
  if (buffer.toString('utf8', 0, 4) !== 'glTF') {
    throw new GameboardCliError(`Invalid GLB header: ${relativizePath(path)}`);
  }
  const length = buffer.readUInt32LE(8);
  let offset = 12;
  while (offset < length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.toString('utf8', offset + 4, offset + 8);
    offset += 8;
    if (chunkType === 'JSON') {
      return JSON.parse(
        buffer.toString('utf8', offset, offset + chunkLength)
      ) as GltfDocumentMetadata;
    }
    offset += chunkLength;
  }
  throw new GameboardCliError(`GLB file has no JSON chunk: ${relativizePath(path)}`);
}

export function extractMetadataBounds(document: GltfDocumentMetadata): AssetBounds {
  const min: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const max: [number, number, number] = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  for (const mesh of document.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const accessorIndex = primitive.attributes?.POSITION;
      const accessor =
        accessorIndex === undefined ? undefined : document.accessors?.[accessorIndex];
      if (!accessor?.min || !accessor.max) {
        continue;
      }
      for (const index of [0, 1, 2] as const) {
        min[index] = Math.min(min[index], accessor.min[index] ?? min[index]);
        max[index] = Math.max(max[index], accessor.max[index] ?? max[index]);
      }
    }
  }
  if (!Number.isFinite(min[0]) || !Number.isFinite(max[0])) {
    return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] };
  }
  return {
    min: tuple(min),
    max: tuple(max),
    size: tuple([max[0] - min[0], max[1] - min[1], max[2] - min[2]]),
  };
}

export function tuple(values: readonly [number, number, number]): [number, number, number] {
  return [round(values[0]), round(values[1]), round(values[2])];
}

export function readIntendedRole(
  value: string | boolean | undefined
): ExternalAssetIntendedRole | undefined {
  if (value === 'tile' || value === 'prop' || value === 'structure' || value === 'unit') {
    return value;
  }
  return undefined;
}

export function readPieceRole(value: string | boolean | undefined): GameboardPieceRole | undefined {
  if (
    value === 'surface' ||
    value === 'building' ||
    value === 'unit' ||
    value === 'prop' ||
    value === 'tree' ||
    value === 'scatter' ||
    value === 'landmark' ||
    value === 'custom'
  ) {
    return value;
  }
  return undefined;
}

export function readPieceFillMode(
  value: string | boolean | undefined
): SeededGameboardPieceFillMode | undefined {
  if (value === 'per-piece' || value === 'pool') {
    return value;
  }
  return undefined;
}

export function pieceFillFromFlags(
  flags: Record<string, string | boolean>
): SeededGameboardPieceFillOptions {
  const fill: SeededGameboardPieceFillOptions = {
    selection: pieceSelectionFromFlags(flags),
  };
  const mode = readPieceFillMode(flags.mode);
  if (mode) {
    fill.mode = mode;
  }
  if (typeof flags.id === 'string') {
    fill.id = flags.id;
  }
  if (typeof flags.ruleIdPrefix === 'string') {
    fill.ruleIdPrefix = flags.ruleIdPrefix;
  }
  const count = readNumberFlag(flags.count);
  const fillAmount = readNumberFlag(flags.fill);
  const minCount = readNumberFlag(flags.minCount);
  const maxCount = readNumberFlag(flags.maxCount);
  if (count !== undefined) {
    fill.count = count;
  }
  if (fillAmount !== undefined) {
    fill.fill = fillAmount;
  }
  if (minCount !== undefined) {
    fill.minCount = minCount;
  }
  if (maxCount !== undefined) {
    fill.maxCount = maxCount;
  }
  return fill;
}

export function pieceSelectionFromFlags(
  flags: Record<string, string | boolean>
): GameboardPieceRegistrySelection {
  const selection: GameboardPieceRegistrySelection = {};
  const ids = readCsv(flags.ids);
  const assetIds = readCsv(flags.assetIds);
  const tags = readCsv(flags.tags);
  const excludeTags = readCsv(flags.excludeTags);
  const sources = readCsv(flags.sources);
  const roles = uniqueRoles([
    readPieceRole(flags.role),
    ...readCsv(flags.roles).map((role) => readPieceRole(role)),
  ]);
  if (ids.length > 0) {
    selection.ids = ids;
  }
  if (assetIds.length > 0) {
    selection.assetIds = assetIds;
  }
  if (roles.length > 0) {
    selection.roles = roles;
  }
  if (typeof flags.sourcePack === 'string') {
    selection.sources = [flags.sourcePack];
  } else if (sources.length > 0) {
    selection.sources = sources;
  }
  if (tags.length > 0) {
    selection.tags = tags;
  }
  if (excludeTags.length > 0) {
    selection.excludeTags = excludeTags;
  }
  if (flags.requiresExtra === true) {
    selection.requiresExtra = true;
  }
  if (flags.freeOnly === true) {
    selection.requiresExtra = false;
  }
  return selection;
}

export function pieceSourceUrlOptionsFromFlags(
  flags: Record<string, string | boolean>
): GameboardPieceSourceUrlOptions {
  const options: GameboardPieceSourceUrlOptions = {};
  if (typeof flags.pieceSourceRoot === 'string') {
    options.sourceRoot = flags.pieceSourceRoot;
  }
  if (typeof flags.pieceSourceRoots === 'string') {
    options.sourceRoots = readPieceSourceRoots(flags.pieceSourceRoots);
  }
  if (flags.unencodedSourceUrls === true) {
    options.encode = false;
  }
  return options;
}

// Keys that can poison a prototype chain if accepted as plain object members.
// `Object.entries` already skips the inherited `__proto__` accessor, but
// `JSON.parse('{"__proto__":{"x":1}}')` produces an *own* property with that
// name; merging that into a plain `{}` via `roots[key] = root` would create a
// __proto__-own that downstream merge-utilities could surface. Reject up
// front. Phase 2 security review S-M1.
export const RESERVED_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export const SAFE_PIECE_SOURCE_ROOT_KEY = /^[a-zA-Z0-9_:-]+$/u;

export function readPieceSourceRoots(value: string): Readonly<Record<string, string>> {
  const source = existsSync(resolve(value)) ? readJson(resolve(value)) : JSON.parse(value);
  const payload = isRecord(source) && isRecord(source.sourceRoots) ? source.sourceRoots : source;
  if (!isRecord(payload)) {
    throw new GameboardCliError(
      '--pieceSourceRoots must be a JSON object or { "sourceRoots": { ... } }'
    );
  }
  // Null-prototype output so downstream Object.assign/spread can't reach
  // through Object.prototype even if an attacker bypassed the key filter.
  const roots: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [key, root] of Object.entries(payload)) {
    if (RESERVED_OBJECT_KEYS.has(key)) {
      throw new GameboardCliError(
        `--pieceSourceRoots key not allowed (prototype pollution risk): ${key}`
      );
    }
    if (!SAFE_PIECE_SOURCE_ROOT_KEY.test(key)) {
      throw new GameboardCliError(`--pieceSourceRoots key must match [A-Za-z0-9_:-]+: ${key}`);
    }
    if (typeof root !== 'string') {
      throw new GameboardCliError(`--pieceSourceRoots entry ${key} must be a string`);
    }
    roots[key] = root;
  }
  return roots;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPatrolRouteSet(value: unknown): value is GameboardPatrolRouteSet {
  return (
    isRecord(value) &&
    Array.isArray(value.routes) &&
    value.routes.every(
      (route) =>
        isRecord(route) &&
        typeof route.id === 'string' &&
        Array.isArray(route.waypoints) &&
        Array.isArray(route.segments)
    )
  );
}

export function uniqueRoles(
  values: readonly (GameboardPieceRole | undefined)[]
): GameboardPieceRole[] {
  return [...new Set(values.filter((value): value is GameboardPieceRole => value !== undefined))];
}

export function readNumberFlag(value: string | boolean | undefined): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new GameboardCliError(`Expected numeric flag value, received ${value}`);
  }
  return number;
}

export function readModelForward(
  value: string | boolean | undefined
): ExternalAssetForwardAxis | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === '+z' || value === '-z' || value === '+x' || value === '-x') {
    return value;
  }
  throw new GameboardCliError(
    `Expected --modelForward to be one of +z, -z, +x, -x; received ${String(value)}`
  );
}

export function readBoardForwardEdge(
  value: string | boolean | undefined
): HexEdgeIndex | undefined {
  const edge = readNumberFlag(value);
  if (edge === undefined) {
    return undefined;
  }
  if (!Number.isInteger(edge) || edge < 0 || edge > 5) {
    throw new GameboardCliError(
      `Expected --boardForwardEdge to be an integer from 0 to 5; received ${edge}`
    );
  }
  return edge as HexEdgeIndex;
}

export function hasPieceFillFlags(flags: Record<string, string | boolean>): boolean {
  return [
    'ids',
    'assetIds',
    'role',
    'roles',
    'sourcePack',
    'sources',
    'tags',
    'excludeTags',
    'requiresExtra',
    'freeOnly',
    'mode',
    'emitRules',
  ].some((key) => flags[key] !== undefined);
}

export function readCsv(value: string | boolean | undefined): string[] {
  return typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

export function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

export function normalizePieceId(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9:_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function assetIdFromPath(path: string | boolean): string {
  return (
    String(path)
      .split('/')
      .pop()
      ?.replace(/\.(glb|gltf)$/i, '') ?? 'external-asset'
  );
}

export function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

