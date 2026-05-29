import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import {
  listSimpleRpgGuidePublicApiExercises,
  runSimpleRpgExecutableGuideApiSmoke,
  summarizeSimpleRpgGuidePublicApiExercises,
} from '../guides/simple-rpg';
import scenarioJson from '../../tests/integration/simple-rpg/fixtures/simple-rpg-scenario.json';
import {
  type BootstrapKayKitAssetsSource,
  type BootstrapResult,
  type BootstrapVerificationReport,
  bootstrapKayKitAssets,
  verifyBootstrap,
} from './commands/bootstrap/core';
import {
  analyzeGameboardLayoutFill,
  appendGameboardLayoutPlacementsToPlan,
  type GameboardLayoutFillAnalysis,
  type GameboardLayoutFillOptions,
  type GameboardLayoutFillRule,
} from '../coordinates';
import { GameboardCliError } from '../errors';
import {
  type GameboardPatrolRouteRule,
  type GameboardPatrolRouteSet,
  type GameboardPatrolRouteSetOptions,
  type GameboardPlan,
  type GameboardPlanSummary,
  type GameboardSpawnGroupOptions,
  type GameboardSpawnGroupPlan,
  planGameboardPatrolRoutes,
  planGameboardSpawnGroups,
  type SummarizeGameboardPlanOptions,
  summarizeGameboardPlan,
} from '../gameboard';
import { generateManifestFromSource } from '../ingest';
import {
  analyzeExternalAssetCompatibility,
  createDefaultGameboardCoveragePackageChecks,
  createDefaultGameboardCoverageReferences,
  createGameboardInteropSnapshot,
  createGameboardScenarioInteropSnapshot,
  createGameboardSimulationInteropSnapshot,
  type ExternalAssetForwardAxis,
  type ExternalAssetIntendedRole,
  GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS,
  type GameboardCoveragePathStatusInput,
  type GameboardCoverageReport,
  type GameboardCoverageSimpleRpgEvidence,
  type GameboardCoverageSimpleRpgEvidenceMode,
  type GameboardCoverageStatus,
  type GameboardInteropSnapshot,
  type GameboardScenarioInteropOptions,
  renderGameboardCoverageMarkdown,
  summarizeGameboardCoverage,
} from '../interop';
import { GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS } from '../interop/internal';
import {
  inspectMedievalHexagonManifest,
  type MedievalHexagonManifestInspection,
} from '../manifest';
import {
  analyzeGameboardPieceRegistry,
  createGameboardPieceRegistry,
  declareGameboardPiecesFromCompatibilityReports,
  type GameboardPieceCompatibilityDeclarationOptions,
  type GameboardPieceDeclaration,
  type GameboardPieceDeclarationInput,
  type GameboardPiecePlacementInspection,
  type GameboardPieceRegistry,
  type GameboardPieceRegistryAnalysis,
  type GameboardPieceRegistrySelection,
  type GameboardPieceRole,
  type GameboardPieceSourceUrlOptions,
  inspectGameboardPiecePlacement,
  selectGameboardPieces,
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
  describeKayKitGuideScenarioCoverage,
  type GameboardRecipe,
  type GameboardScenario,
  type GameboardScenarioSummary,
  type HexTileDeclarationInput,
  type HexTileRegistry,
  inspectGameboardRecipe,
  inspectGameboardScenario,
  inspectGameboardBlueprint,
  inspectGameboardBlueprintScenario,
  type KayKitAssetPublicRole,
  type KayKitAssetPublicTreatment,
  type KayKitGuideScenario,
  type KayKitGuideScenarioCoverage,
  listKayKitAssetPublicTreatments,
  listKayKitGuideRoleCoverages,
  listKayKitGuideScenarios,
  type GameboardBlueprintInspection,
  type GameboardBlueprintOptions,
  type GameboardBlueprintScenarioInspection,
  type GameboardBlueprintScenarioOptions,
  renderKayKitGuideScenarioCoverageMarkdown,
  summarizeGameboardScenario,
  summarizeKayKitGuideCoverage,
} from '../scenario';
import {
  createGameboardPatrolSimulationScript,
  createGameboardScenarioSimulationReport,
  type GameboardPatrolSimulationActorAssignment,
  type GameboardPatrolSimulationScriptPlan,
  type GameboardScenarioSimulationScript,
  type GameboardScenarioSimulationStep,
  inspectGameboardScenarioSimulationScript,
  runGameboardScenarioSimulationScript,
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

export type GuideScenarioAssetScope = PackEdition | 'all';

export interface AssetInputRoot {
  input: string;
  base: string;
}

export interface BatchSourceAssetRecord {
  id: string;
  relativePath: string;
  fileName: string;
  extension: string;
  path?: string;
}

export interface PiecesFromAssetsSummary {
  assetCount: number;
  compatibleTileCount: number;
  warningCount: number;
  errorCount: number;
  suggestedRoles: Readonly<Record<string, number>>;
  pieceRoles: Readonly<Record<string, number>>;
  overrideWarnings: readonly string[];
  registryWarnings: readonly string[];
  registryErrors: readonly string[];
}

export type GameboardPlanInputKind = 'plan' | 'recipe' | 'scenario' | 'blueprint';
export type GameboardPlanValidationViolation = ReturnType<typeof validateGameboardPlan>[number];

export interface GameboardPlanSummaryInput {
  source: {
    kind: GameboardPlanInputKind;
    path: string;
  };
  plan: GameboardPlan;
  violations: readonly GameboardPlanValidationViolation[];
}

export interface GameboardPlanSummaryPayload {
  source: GameboardPlanSummaryInput['source'];
  validation: {
    errorCount: number;
    warningCount: number;
    violations: readonly GameboardPlanValidationViolation[];
  };
  summary: GameboardPlanSummary;
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
export async function runBootstrap(parsed: ParsedArgs, edition: PackEdition): Promise<void> {
  const verifyOnly = parsed.flags.verify === true;
  const outFlag =
    typeof parsed.flags.out === 'string' ? parsed.flags.out : detectDefaultBootstrapOut();
  const outAbsolute = safeResolveOutput(outFlag);
  const jsonMode = parsed.flags.json === true;

  if (verifyOnly) {
    const report = await verifyBootstrap(outAbsolute);
    if (jsonMode) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printBootstrapVerifyReport(report);
    }
    if (!report.ok) {
      process.exit(1);
    }
    return;
  }

  const sourceFlag = typeof parsed.flags.source === 'string' ? parsed.flags.source : 'github';
  if (sourceFlag !== 'github' && sourceFlag !== 'zip') {
    throw new GameboardCliError(
      `bootstrap --source must be 'github' or 'zip' (got: ${sourceFlag})`
    );
  }
  const source: BootstrapKayKitAssetsSource =
    sourceFlag === 'github'
      ? {
          kind: 'github',
          ...(typeof parsed.flags.commit === 'string' ? { commit: parsed.flags.commit } : {}),
        }
      : (() => {
          if (typeof parsed.flags.zip !== 'string') {
            throw new GameboardCliError('bootstrap --source zip requires --zip <path>');
          }
          return { kind: 'zip', path: parsed.flags.zip } as const;
        })();

  const result = await bootstrapKayKitAssets({
    source,
    out: outAbsolute,
    edition,
    force: parsed.flags.force === true,
    includeSourceFormats: parsed.flags['include-source-formats'] === true,
  });

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printBootstrapResult(result);
  }
}

/**
 * Default `--out` heuristic. Prefers existing `models` (flat bootstrap
 * default), then `public/models` (Vite / Next.js public dir convention), then
 * falls back to `models`. Cosmetic only: every call still routes through
 * {@link safeResolveOutput}.
 */
export function detectDefaultBootstrapOut(): string {
  const cwd = process.cwd();
  const candidates = ['models', 'public/models'];
  for (const candidate of candidates) {
    if (existsSync(join(cwd, candidate))) {
      return candidate;
    }
  }
  return 'models';
}

export function printBootstrapResult(result: BootstrapResult): void {
  console.log(`bootstrapped ${result.edition.toUpperCase()} edition`);
  console.log(`  ${result.fileCount} file(s), ${formatBytes(result.totalBytes)}`);
  console.log(`  root: ${relativizePath(result.outRoot)}`);
  console.log(`  sidecar: ${relativizePath(result.integritySidecar)}`);
}

export function printBootstrapVerifyReport(report: BootstrapVerificationReport): void {
  if (report.ok) {
    console.log(`bootstrap verify OK (${relativizePath(report.sidecarPath)})`);
    return;
  }
  console.error(`bootstrap verify FAILED for ${relativizePath(report.sidecarPath)}`);
  for (const drift of report.drift) {
    console.error(`  ${drift}`);
  }
}

export function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KiB`;
  }
  return `${(value / 1024 / 1024).toFixed(2)} MiB`;
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

export function pieceOverridesFromArgs(
  flags: Record<string, string | boolean>
): Readonly<Record<string, GameboardPieceCompatibilityDeclarationOptions>> | undefined {
  const path =
    typeof flags.pieceOverrides === 'string'
      ? flags.pieceOverrides
      : typeof flags.overrides === 'string'
        ? flags.overrides
        : undefined;
  if (!path) {
    return undefined;
  }
  const raw = readJson(resolve(path));
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new GameboardCliError(
      `Piece overrides file ${relativizePath(path)} must be a JSON object`
    );
  }
  const payload = raw as Record<string, GameboardPieceCompatibilityDeclarationOptions> & {
    overrides?: Record<string, GameboardPieceCompatibilityDeclarationOptions>;
  };
  return payload.overrides ?? payload;
}

export function runPiecesFromAssets(parsed: ParsedArgs): void {
  const assetInputs = readAssetInputs(parsed.flags);
  const assetPaths = collectGltfAssetPaths(assetInputs);
  if (assetPaths.length === 0) {
    throw new GameboardCliError('pieces-from-assets found no .glb or .gltf files');
  }
  const roots = assetInputRoots(assetInputs);
  const includeAbsolutePaths = parsed.flags.includeAbsolutePaths === true;
  const sourceAssets = assetPaths.map((assetPath) =>
    sourceAssetRecord(assetPath, roots, includeAbsolutePaths)
  );
  const sourcePack = String(parsed.flags.sourcePack ?? 'external');
  const intendedRole = readIntendedRole(parsed.flags.intendedRole);
  const reports = assetPaths.map((assetPath, index) => {
    const metadata = readGltfMetadata(assetPath);
    return analyzeExternalAssetCompatibility({
      id: sourceAssets[index]?.id ?? assetIdFromBatchPath(assetPath, roots),
      sourcePack,
      creator: typeof parsed.flags.creator === 'string' ? parsed.flags.creator : undefined,
      license: typeof parsed.flags.license === 'string' ? parsed.flags.license : undefined,
      bounds: metadata.bounds,
      intendedRole,
      hasRig: metadata.hasRig,
      animationNames: metadata.animationNames,
      materialSlots: metadata.materialSlots,
      modelForward: readModelForward(parsed.flags.modelForward),
      boardForwardEdge: readBoardForwardEdge(parsed.flags.boardForwardEdge),
    });
  });
  const role = readPieceRole(parsed.flags.role);
  const overrides = pieceOverridesFromArgs(parsed.flags);
  const overridesWithSourceMetadata = mergeSourceAssetOverrides(overrides, sourceAssets);
  const pieces = declareGameboardPiecesFromCompatibilityReports(reports, {
    source: sourcePack,
    pieceIdPrefix:
      typeof parsed.flags.pieceIdPrefix === 'string' ? parsed.flags.pieceIdPrefix : undefined,
    assetIdPrefix:
      typeof parsed.flags.assetIdPrefix === 'string' ? parsed.flags.assetIdPrefix : undefined,
    tags: readCsv(parsed.flags.tags),
    overrides: overridesWithSourceMetadata,
    ...(role ? { role } : {}),
  });
  const registry = createGameboardPieceRegistry(pieces);
  const analysis = analyzeGameboardPieceRegistry(registry);
  const overrideWarnings = unmatchedOverrideWarnings(overrides, reports);
  const summary = summarizeCompatibilityReports(reports, analysis, overrideWarnings);
  const includeReports =
    parsed.flags.includeReports === true || parsed.flags.includeReport === true;
  const payload = {
    schemaVersion: '1.0.0',
    sourcePack,
    assets: sourceAssets.map((asset) => asset.relativePath),
    sourceAssets,
    pieces,
    summary,
    ...(includeReports ? { reports } : {}),
  };

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote ${pieces.length} piece declarations to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  } else if (parsed.flags.json === true || includeReports) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printPiecesFromAssets(summary);
  }

  const hasErrors =
    reports.some((report) => report.errors.length > 0) || analysis.errors.length > 0;
  const hasWarnings =
    reports.some((report) => report.warnings.length > 0) ||
    analysis.warnings.length > 0 ||
    overrideWarnings.length > 0;
  if (hasErrors) {
    process.exit(1);
  }
  if (parsed.flags.failOnWarning === true && hasWarnings) {
    process.exit(1);
  }
}

export function runBlueprint(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  const options = readBlueprintOptions(parsed.flags);
  const validationConfig = validationConfigFromArgs(parsed, sourceRoot, edition);
  const inspection = inspectGameboardBlueprint(options);
  const violations = validateGameboardPlan(inspection.plan, validationConfig);
  const scenarioInspection = shouldInspectBlueprintScenario(options, parsed.flags)
    ? inspectGameboardBlueprintScenario(options, { plan: validationConfig })
    : undefined;
  const interop = shouldEmitBlueprintInterop(parsed.flags)
    ? createBlueprintScenarioInteropSnapshot(parsed, scenarioInspection)
    : undefined;

  if (typeof parsed.flags.outRecipe === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outRecipe)),
      `${JSON.stringify(inspection.recipe, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote blueprint GameboardRecipe to ${safeResolveOutput(String(parsed.flags.outRecipe))}`
    );
  }
  if (typeof parsed.flags.outPlan === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(inspection.plan, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote blueprint GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`
    );
  }
  if (typeof parsed.flags.outScenario === 'string') {
    if (!scenarioInspection) {
      throw new GameboardCliError(
        'blueprint --outScenario requires scenario options or --includeScenario'
      );
    }
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outScenario)),
      `${JSON.stringify(scenarioInspection.scenario, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote blueprint GameboardScenario to ${safeResolveOutput(String(parsed.flags.outScenario))}`
    );
  }
  if (typeof parsed.flags.outScenarioInspection === 'string') {
    if (!scenarioInspection) {
      throw new GameboardCliError(
        'blueprint --outScenarioInspection requires scenario options or --includeScenarioInspection'
      );
    }
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outScenarioInspection)),
      `${JSON.stringify(scenarioInspection.scenarioInspection, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote blueprint scenario inspection to ${safeResolveOutput(String(parsed.flags.outScenarioInspection))}`
    );
  }
  if (typeof parsed.flags.outInterop === 'string') {
    if (!interop) {
      throw new GameboardCliError('blueprint --outInterop requires a generated blueprint scenario');
    }
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outInterop)),
      `${JSON.stringify(interop, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote blueprint interop snapshot with ${interop.entities.length} entities and ${interop.relations.length} relations to ${safeResolveOutput(String(parsed.flags.outInterop))}`
    );
  }

  const payload = blueprintPayloadFromInspection(
    inspection,
    violations,
    parsed.flags,
    scenarioInspection,
    interop
  );
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote blueprint inspection to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printBlueprintInspection(inspection, violations);
    if (scenarioInspection) {
      printBlueprintScenarioInspection(scenarioInspection);
    }
  }

  const scenarioViolations = scenarioInspection?.scenarioInspection.violations ?? [];
  const hasErrors =
    violations.some((violation) => violation.severity === 'error') ||
    scenarioViolations.some((violation) => violation.severity === 'error');
  const hasWarnings =
    inspection.warnings.length > 0 ||
    violations.some((violation) => violation.severity === 'warning') ||
    scenarioViolations.some((violation) => violation.severity === 'warning');
  if (hasErrors) {
    process.exit(1);
  }
  if (parsed.flags.failOnWarning === true && hasWarnings) {
    process.exit(1);
  }
}

export function runSnapshot(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  const inputFlags = ['plan', 'recipe', 'scenario'].filter(
    (key) => typeof parsed.flags[key] === 'string'
  );
  if (inputFlags.length !== 1) {
    throw new GameboardCliError(
      'snapshot requires exactly one of --plan <path>, --recipe <path>, or --scenario <path>'
    );
  }

  const validationConfig = validationConfigFromArgs(parsed, sourceRoot, edition);
  const options = snapshotOptionsFromFlags(parsed.flags);
  const allowInvalid = parsed.flags.allowInvalid === true;
  const snapshot =
    typeof parsed.flags.plan === 'string'
      ? snapshotFromPlan(parsed.flags.plan, validationConfig, options, allowInvalid)
      : typeof parsed.flags.recipe === 'string'
        ? snapshotFromRecipe(parsed.flags.recipe, validationConfig, options, allowInvalid)
        : snapshotFromScenario(
            String(parsed.flags.scenario),
            validationConfig,
            options,
            allowInvalid
          );

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(snapshot, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote interop snapshot with ${snapshot.entities.length} entities and ${snapshot.relations.length} relations to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  } else {
    console.log(JSON.stringify(snapshot, null, 2));
  }
}

export function runSummarizePlan(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  const input = summaryPlanFromArgs(
    parsed,
    validationConfigFromArgs(parsed, sourceRoot, edition),
    parsed.flags.allowInvalid === true
  );
  const errorCount = input.violations.filter((violation) => violation.severity === 'error').length;
  const warningCount = input.violations.filter(
    (violation) => violation.severity === 'warning'
  ).length;
  if (errorCount > 0 && parsed.flags.allowInvalid !== true) {
    printViolations(input.violations);
    process.exit(1);
  }

  const payload: GameboardPlanSummaryPayload = {
    source: input.source,
    validation: {
      errorCount,
      warningCount,
      violations: input.violations,
    },
    summary: summarizeGameboardPlan(input.plan, summaryOptionsFromFlags(parsed.flags)),
  };

  if (typeof parsed.flags.outPlan === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(input.plan, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote compiled GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`
    );
  }

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote plan summary to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printGameboardPlanSummary(payload);
  }

  if (parsed.flags.failOnWarning === true && warningCount > 0) {
    process.exit(1);
  }
}

export function runSummarizeScenario(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  if (typeof parsed.flags.scenario !== 'string') {
    throw new GameboardCliError('summarize-scenario requires --scenario <path>');
  }
  const scenarioPath = resolve(parsed.flags.scenario);
  const scenario = readJson(scenarioPath) as GameboardScenario;
  const summary = summarizeGameboardScenario(scenario, {
    plan: validationConfigFromArgs(parsed, sourceRoot, edition),
    topAssetLimit: summaryOptionsFromFlags(parsed.flags).topAssetLimit,
  });

  if (summary.validation.errorCount > 0 && parsed.flags.allowInvalid !== true) {
    printViolations(summary.validation.violations);
    process.exit(1);
  }

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(summary, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote scenario summary to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printGameboardScenarioSummary(summary, scenarioPath);
  }

  if (parsed.flags.failOnWarning === true && summary.validation.warningCount > 0) {
    process.exit(1);
  }
}

export function runAnalyzeLayout(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  const inputFlags = ['plan', 'recipe', 'scenario'].filter(
    (key) => typeof parsed.flags[key] === 'string'
  );
  if (inputFlags.length !== 1) {
    throw new GameboardCliError(
      'analyze-layout requires exactly one of --plan <path>, --recipe <path>, or --scenario <path>'
    );
  }
  if (typeof parsed.flags.rules !== 'string') {
    throw new GameboardCliError('analyze-layout requires --rules <path>');
  }
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
  if (typeof parsed.flags.outPlan === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(plan, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote compiled GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`
    );
  }
  const options = readLayoutFillOptions(resolve(parsed.flags.rules), parsed.flags.seed);
  const analysis = analyzeGameboardLayoutFill(plan, options);
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(analysis, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote layout analysis to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(analysis, null, 2));
  } else {
    printLayoutFillAnalysis(analysis);
  }
  if (analysis.errorCount > 0) {
    process.exit(1);
  }
  if (parsed.flags.failOnWarning === true && analysis.warningCount > 0) {
    process.exit(1);
  }
}

export function runSpawnGroups(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  const inputFlags = ['plan', 'recipe', 'scenario'].filter(
    (key) => typeof parsed.flags[key] === 'string'
  );
  if (inputFlags.length !== 1) {
    throw new GameboardCliError(
      'spawn-groups requires exactly one of --plan <path>, --recipe <path>, or --scenario <path>'
    );
  }
  if (typeof parsed.flags.groups !== 'string') {
    throw new GameboardCliError('spawn-groups requires --groups <path>');
  }
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

  const options = readSpawnGroupOptions(resolve(parsed.flags.groups), parsed.flags.seed);
  const spawnPlan = planGameboardSpawnGroups(plan, options);
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(spawnPlan, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote spawn group plan to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(spawnPlan, null, 2));
  } else {
    printSpawnGroupPlan(spawnPlan);
  }
  if (spawnPlan.errors.length > 0) {
    process.exit(1);
  }
  if (parsed.flags.failOnWarning === true && spawnPlan.warnings.length > 0) {
    process.exit(1);
  }
}

export function runPatrolRoutes(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  const inputFlags = ['plan', 'recipe', 'scenario'].filter(
    (key) => typeof parsed.flags[key] === 'string'
  );
  if (inputFlags.length !== 1) {
    throw new GameboardCliError(
      'patrol-routes requires exactly one of --plan <path>, --recipe <path>, or --scenario <path>'
    );
  }
  const scenario =
    typeof parsed.flags.scenario === 'string'
      ? readJson(resolve(parsed.flags.scenario)) as GameboardScenario
      : undefined;
  if (typeof parsed.flags.routes !== 'string' && !scenario?.patrolRoutes?.length) {
    throw new GameboardCliError(
      'patrol-routes requires --routes <path> unless --scenario includes patrolRoutes'
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
  const routeSet = planGameboardPatrolRoutes(plan, {
    ...routeOptions,
    spawnGroups,
  });

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(routeSet, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote patrol route plan to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(routeSet, null, 2));
  } else {
    printPatrolRouteSet(routeSet);
  }
  if (routeSet.errors.length > 0) {
    process.exit(1);
  }
  if (parsed.flags.failOnWarning === true && routeSet.warnings.length > 0) {
    process.exit(1);
  }
}

export function runPatrolScript(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  const scenario =
    typeof parsed.flags.scenario === 'string'
      ? readJson(resolve(parsed.flags.scenario)) as GameboardScenario
      : undefined;
  const routeSet = patrolRouteSetFromArgs(parsed, sourceRoot, edition, scenario);
  const scriptPlan = createGameboardPatrolSimulationScript({
    routes: routeSet,
    assignments: readPatrolSimulationAssignments(parsed),
    requireFoundRoutes: parsed.flags.allowInvalid !== true,
  });

  const payload = parsed.flags.includeReport === true ? scriptPlan : scriptPlan.script;
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote patrol simulation script to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printPatrolSimulationScriptPlan(scriptPlan);
  }

  if (scriptPlan.errors.length > 0 && parsed.flags.allowInvalid !== true) {
    process.exit(1);
  }
  if (scriptPlan.warnings.length > 0 && parsed.flags.failOnWarning === true) {
    process.exit(1);
  }
}

export function runPlacePiece(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  const inputFlags = ['plan', 'recipe', 'scenario'].filter(
    (key) => typeof parsed.flags[key] === 'string'
  );
  if (inputFlags.length !== 1) {
    throw new GameboardCliError(
      'place-piece requires exactly one of --plan <path>, --recipe <path>, or --scenario <path>'
    );
  }
  if (typeof parsed.flags.pieces !== 'string') {
    throw new GameboardCliError('place-piece requires --pieces <path>');
  }
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

  const registry = readPieceRegistry(resolve(parsed.flags.pieces));
  const piece = pieceForPlacementFromFlags(registry, parsed.flags);
  const placementOptions = {
    count: readNumberFlag(parsed.flags.count),
    seed: typeof parsed.flags.seed === 'string' ? parsed.flags.seed : undefined,
    idPrefix: typeof parsed.flags.idPrefix === 'string' ? parsed.flags.idPrefix : undefined,
  };
  const inspection = inspectGameboardPiecePlacement(plan, piece, placementOptions);

  if (typeof parsed.flags.outPlan === 'string') {
    const nextPlan = appendGameboardLayoutPlacementsToPlan(plan, inspection.placements);
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(nextPlan, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote placed GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`);
  }
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(inspection, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote piece placement inspection to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(inspection, null, 2));
  } else {
    printPiecePlacementInspection(inspection);
  }

  const requiredCount = readNumberFlag(parsed.flags.minCount) ?? placementOptions.count ?? 1;
  if (inspection.placements.length < requiredCount) {
    process.exit(1);
  }
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

export function summaryPlanFromArgs(
  parsed: ParsedArgs,
  validationConfig: GameboardPlanValidationConfig,
  allowInvalid: boolean
): GameboardPlanSummaryInput {
  const blueprintPath =
    typeof parsed.flags.blueprint === 'string'
      ? parsed.flags.blueprint
      : typeof parsed.flags.config === 'string'
        ? parsed.flags.config
        : undefined;
  const inputFlags = [
    ...['plan', 'recipe', 'scenario'].filter((key) => typeof parsed.flags[key] === 'string'),
    ...(blueprintPath ? ['blueprint'] : []),
  ];
  if (inputFlags.length !== 1) {
    throw new GameboardCliError(
      'summarize-plan requires exactly one of --plan <path>, --recipe <path>, --scenario <path>, or --blueprint <path>'
    );
  }

  if (typeof parsed.flags.plan === 'string') {
    const path = resolve(parsed.flags.plan);
    const plan = readJson(path) as GameboardPlan;
    return {
      source: { kind: 'plan', path },
      plan,
      violations: validateGameboardPlan(plan, validationConfig),
    };
  }

  if (typeof parsed.flags.recipe === 'string') {
    const path = resolve(parsed.flags.recipe);
    const inspection = inspectGameboardRecipe(readJson(path) as GameboardRecipe, {
      plan: validationConfig,
    });
    if (!inspection.plan) {
      if (!allowInvalid) {
        printViolations(inspection.violations);
        process.exit(1);
      }
      throw new GameboardCliError(
        `Recipe ${relativizePath(path)} did not compile to a GameboardPlan`
      );
    }
    return {
      source: { kind: 'recipe', path },
      plan: inspection.plan,
      violations: inspection.violations,
    };
  }

  if (typeof parsed.flags.scenario === 'string') {
    const path = resolve(parsed.flags.scenario);
    const inspection = inspectGameboardScenario(readJson(path) as GameboardScenario, {
      plan: validationConfig,
    });
    if (!inspection.plan) {
      if (!allowInvalid) {
        printViolations(inspection.violations);
        process.exit(1);
      }
      throw new GameboardCliError(
        `Scenario ${relativizePath(path)} did not compile to a GameboardPlan`
      );
    }
    return {
      source: { kind: 'scenario', path },
      plan: inspection.plan,
      violations: inspection.violations,
    };
  }

  const path = resolve(String(blueprintPath));
  const inspection = inspectGameboardBlueprint(readBlueprintOptions(parsed.flags));
  return {
    source: { kind: 'blueprint', path },
    plan: inspection.plan,
    violations: validateGameboardPlan(inspection.plan, validationConfig),
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

export function readPatrolSimulationAssignments(
  parsed: ParsedArgs
): readonly GameboardPatrolSimulationActorAssignment[] {
  const rounds = readNumberFlag(parsed.flags.rounds);
  if (typeof parsed.flags.assignments === 'string') {
    const payload = readJson(resolve(parsed.flags.assignments));
    const assignments = Array.isArray(payload)
      ? (payload as readonly GameboardPatrolSimulationActorAssignment[])
      : isRecord(payload) && Array.isArray(payload.assignments)
        ? (payload.assignments as readonly GameboardPatrolSimulationActorAssignment[])
        : undefined;
    if (!Array.isArray(assignments)) {
      throw new GameboardCliError(
        `Patrol assignment file ${relativizePath(String(parsed.flags.assignments))} must be an array or { "assignments": [...] }`
      );
    }
    return assignments.map((assignment) => ({
      ...assignment,
      rounds: assignment.rounds ?? rounds,
    }));
  }
  if (typeof parsed.flags.routeId === 'string' && typeof parsed.flags.actorId === 'string') {
    return [
      {
        routeId: parsed.flags.routeId,
        actorId: parsed.flags.actorId,
        rounds,
        stepIdPrefix: typeof parsed.flags.idPrefix === 'string' ? parsed.flags.idPrefix : undefined,
      },
    ];
  }
  throw new GameboardCliError(
    'patrol-script requires --assignments <path> or both --routeId <id> and --actorId <id>'
  );
}

export function runValidateSimulation(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  if (typeof parsed.flags.scenario !== 'string') {
    throw new GameboardCliError('validate-simulation requires --scenario <path>');
  }
  if (typeof parsed.flags.script !== 'string') {
    throw new GameboardCliError('validate-simulation requires --script <path>');
  }

  const scenario = readJson(resolve(parsed.flags.scenario)) as GameboardScenario;
  const scenarioInspection = inspectGameboardScenario(scenario, {
    plan: validationConfigFromArgs(parsed, sourceRoot, edition),
  });
  const script = readSimulationScript(resolve(parsed.flags.script));
  const scriptInspection = inspectGameboardScenarioSimulationScript(script, {
    scenario,
    plan: scenarioInspection.plan,
  });
  const violations = [...scenarioInspection.violations, ...scriptInspection.violations];

  if (typeof parsed.flags.outPlan === 'string' && scenarioInspection.plan) {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(scenarioInspection.plan, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote compiled GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`
    );
  }

  if (parsed.flags.json === true) {
    console.log(
      JSON.stringify(
        {
          scenario: scenario.id,
          steps: Array.isArray(script.steps) ? script.steps.length : 0,
          actors: scenario.actors?.map((actor) => actor.actorId) ?? [],
          quests: scenario.quests?.map((quest) => quest.id) ?? [],
          violations,
        },
        null,
        2
      )
    );
  } else {
    console.log(`scenario: ${scenario.id}`);
    console.log(`steps: ${Array.isArray(script.steps) ? script.steps.length : 0}`);
    console.log(`actors: ${scenario.actors?.length ?? 0}`);
    console.log(`quests: ${scenario.quests?.length ?? 0}`);
    printViolations(violations);
  }

  if (violations.some((violation) => violation.severity === 'error')) {
    process.exit(1);
  }
}


export function runGuideScenarios(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  const scenarioFilter = readCsv(parsed.flags.scenarioId ?? parsed.flags.scenario);
  const pageFilter = readGuideScenarioPageFilter(parsed.flags.page);
  const editionFilter = readGuideScenarioEditionFilter(parsed.flags.editionScope);
  const publicApiFilter = readCsv(parsed.flags.publicApi);
  const roleFilter = readCsv(parsed.flags.role ?? parsed.flags.guideRole);
  const assetIdFilter = readGuideAssetIdFilter(parsed);
  const scenarios = filterGuideScenarios(listKayKitGuideScenarios(), {
    scenarioIds: scenarioFilter,
    pages: pageFilter,
    editions: editionFilter,
    publicApis: publicApiFilter,
    roles: roleFilter,
    assetIds: assetIdFilter,
  });
  if (scenarios.length === 0) {
    throw new GameboardCliError(
      'guide-scenarios selection did not match any extracted guide scenarios'
    );
  }
  const coverage = summarizeKayKitGuideCoverage();
  const treatmentByAssetId = new Map(
    listKayKitAssetPublicTreatments().map((treatment) => [treatment.assetId, treatment])
  );
  const catalog = validationCatalogFromArgs(parsed, sourceRoot, edition);
  const assetScope = readGuideScenarioAssetScope(parsed.flags.assetScope, catalog?.edition);
  const scenarioAssetIds = scenarios.flatMap((scenario) => scenario.assetIds);
  const allAssetIds = uniqueStrings(scenarioAssetIds);
  const occurrenceTreatments = scenarioAssetIds
    .map((assetId) => treatmentByAssetId.get(assetId))
    .filter((treatment): treatment is KayKitAssetPublicTreatment => treatment !== undefined);
  const checkedAssetIds = allAssetIds.filter((assetId) => {
    const treatment = treatmentByAssetId.get(assetId);
    if (!treatment) {
      return false;
    }
    return assetScope === 'all' || treatment.minimumEdition === assetScope;
  });
  const missingAssetIds = catalog
    ? checkedAssetIds.filter((assetId) => !catalog.assetsById[assetId])
    : [];
  const docs = uniqueStrings(scenarios.flatMap((scenario) => scenario.docs));
  const sourceImages = uniqueStrings(scenarios.map((scenario) => scenario.sourceImage));
  const visualArtifacts = uniqueStrings(scenarios.flatMap((scenario) => scenario.visualArtifacts));
  const payload = {
    schemaVersion: '1.0.0',
    count: scenarios.length,
    pages: scenarios.map((scenario) => scenario.page),
    assetScope,
    assetCounts: {
      total: coverage.assetCounts.unique,
      selected: allAssetIds.length,
      free: countGuideScenarioAssetsByEdition(allAssetIds, treatmentByAssetId, 'free'),
      extra: countGuideScenarioAssetsByEdition(allAssetIds, treatmentByAssetId, 'extra'),
      occurrences: occurrenceTreatments.length,
      freeOccurrences: occurrenceTreatments.filter(
        (treatment) => treatment.minimumEdition === 'free'
      ).length,
      extraOccurrences: occurrenceTreatments.filter(
        (treatment) => treatment.minimumEdition === 'extra'
      ).length,
      checked: checkedAssetIds.length,
      missing: missingAssetIds.length,
    },
    coverage,
    selection: {
      scenarioIds: scenarioFilter,
      pages: pageFilter,
      editions: editionFilter,
      publicApis: publicApiFilter,
      roles: roleFilter,
      assetIds: assetIdFilter,
    },
    sourceImages,
    docs,
    visualArtifacts,
    missingAssetIds,
    scenarios,
    ...(parsed.flags.includeTreatments === true
      ? {
          scenarioCoverage: scenarios
            .map((scenario) => describeKayKitGuideScenarioCoverage(scenario.id))
            .filter(
              (scenarioCoverage): scenarioCoverage is KayKitGuideScenarioCoverage =>
                scenarioCoverage !== undefined
            ),
        }
      : {}),
  };

  if (parsed.flags.markdown === true || parsed.flags.format === 'markdown') {
    const markdown = renderKayKitGuideScenarioCoverageMarkdown({
      scenarios,
      includeRoleCoverage: scenarios.length === listKayKitGuideScenarios().length,
      includePublicApiInversion: scenarios.length === listKayKitGuideScenarios().length,
    });
    if (typeof parsed.flags.out === 'string') {
      writeFileSync(safeResolveOutput(String(parsed.flags.out)), markdown, 'utf8');
      console.log(
        `Wrote ${scenarios.length} guide scenario markdown rows to ${safeResolveOutput(String(parsed.flags.out))}`
      );
    } else {
      process.stdout.write(markdown);
    }
    if (missingAssetIds.length > 0) {
      process.exit(1);
    }
    return;
  }

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote ${scenarios.length} guide scenarios to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  } else if (parsed.flags.json === true || parsed.flags.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`guide scenarios: ${scenarios.length}`);
    console.log(`pages: ${formatGuideScenarioPages(payload.pages)}`);
    console.log(
      `assets: ${payload.assetCounts.selected} selected, ${payload.assetCounts.free} free, ${payload.assetCounts.extra} extra`
    );
    console.log(
      `asset occurrences: ${payload.assetCounts.occurrences} total, ${payload.assetCounts.freeOccurrences} free, ${payload.assetCounts.extraOccurrences} extra`
    );
    if (catalog) {
      console.log(`asset scope: ${assetScope}`);
      console.log(`checked assets: ${checkedAssetIds.length}`);
      console.log(`missing assets: ${missingAssetIds.length}`);
      for (const assetId of missingAssetIds) {
        console.log(`  - ${assetId}`);
      }
    }
    console.log(`source images: ${sourceImages.length}`);
    console.log(`docs: ${docs.length}`);
    console.log(`visual artifacts: ${visualArtifacts.length}`);
  }

  if (missingAssetIds.length > 0) {
    process.exit(1);
  }
}

export function runCoverage(parsed: ParsedArgs): void {
  const manifest =
    typeof parsed.flags.manifest === 'string'
      ? readManifest(resolve(parsed.flags.manifest))
      : undefined;
  const checksPassed = parsed.flags.checksPassed === true;
  const report = summarizeGameboardCoverage({
    manifest,
    generatedAt:
      typeof parsed.flags.generatedAt === 'string'
        ? parsed.flags.generatedAt
        : new Date().toISOString(),
    pathStatus: coveragePathStatuses(),
    references: createDefaultGameboardCoverageReferences().map((reference) => ({
      ...reference,
      status: existsSync(resolve(reference.path)) ? 'available' : 'missing',
    })),
    packageChecks: createDefaultGameboardCoveragePackageChecks(checksPassed ? 'passed' : 'not-run'),
    simpleRpgEvidence: createCliSimpleRpgEvidence(),
  });
  const markdown =
    parsed.flags.markdown === true ? renderGameboardCoverageMarkdown(report) : undefined;

  if (typeof parsed.flags.outJson === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outJson)),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote coverage JSON to ${safeResolveOutput(String(parsed.flags.outJson))}`);
  }
  if (typeof parsed.flags.outMarkdown === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outMarkdown)),
      `${renderGameboardCoverageMarkdown(report)}\n`,
      'utf8'
    );
    console.log(
      `Wrote coverage Markdown to ${safeResolveOutput(String(parsed.flags.outMarkdown))}`
    );
  }
  if (typeof parsed.flags.out === 'string') {
    const outputPath = safeResolveOutput(String(parsed.flags.out));
    const output =
      parsed.flags.markdown === true
        ? (markdown ?? renderGameboardCoverageMarkdown(report))
        : JSON.stringify(report, null, 2);
    writeFileSync(outputPath, `${output}\n`, 'utf8');
    console.log(
      `Wrote coverage ${parsed.flags.markdown === true ? 'Markdown' : 'JSON'} to ${outputPath}`
    );
  }
  if (parsed.flags.json === true) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (parsed.flags.markdown === true) {
    console.log(markdown ?? renderGameboardCoverageMarkdown(report));
    return;
  }

  printCoverageSummary(report);
}

export function createCliSimpleRpgEvidence(): GameboardCoverageSimpleRpgEvidence {
  const exerciseCoverage = summarizeSimpleRpgGuidePublicApiExercises();
  const executableSmoke = runSimpleRpgExecutableGuideApiSmoke(scenarioJson as GameboardScenario);
  const evidenceModeCounts = exerciseCoverage.exerciseModeCounts;
  const evidenceModeEntries = Object.entries(evidenceModeCounts) as Array<
    [GameboardCoverageSimpleRpgEvidenceMode, number]
  >;
  return {
    guidePublicApiCount: exerciseCoverage.guidePublicApiCount,
    exercisedPublicApiCount: exerciseCoverage.exercisedPublicApiCount,
    missingPublicApis: exerciseCoverage.missingPublicApis,
    stalePublicApis: exerciseCoverage.staleExercisePublicApis,
    executablePublicApiCount: executableSmoke.directPublicApiCount,
    publicTreatmentCount: executableSmoke.publicTreatmentCount,
    guideScenarioCount: executableSmoke.guideScenarioCount,
    evidenceModeCounts,
    activeEvidenceModes: evidenceModeEntries.filter(([, count]) => count > 0).map(([mode]) => mode),
    inactiveEvidenceModes: evidenceModeEntries
      .filter(([, count]) => count <= 0)
      .map(([mode]) => mode),
    publicApiExercises: listSimpleRpgGuidePublicApiExercises(),
  };
}

export function coveragePathStatuses(): GameboardCoveragePathStatusInput {
  const scenarios = listKayKitGuideScenarios();
  const sourceImages = uniqueStrings(scenarios.map((scenario) => scenario.sourceImage));
  const docs = uniqueStrings(scenarios.flatMap((scenario) => scenario.docs));
  const visualArtifacts = uniqueStrings([
    ...sourceImages,
    ...scenarios.flatMap((scenario) => scenario.visualArtifacts),
    ...GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS,
    ...GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS,
  ]);
  return {
    sourceImages: statusMapForPaths(sourceImages),
    docs: statusMapForPaths(docs),
    visualArtifacts: statusMapForPaths(visualArtifacts),
  };
}

export function statusMapForPaths(
  paths: readonly string[]
): Record<string, GameboardCoverageStatus> {
  return Object.fromEntries(
    paths.map((path) => [path, existsSync(resolve(path)) ? 'available' : 'missing'])
  );
}

export function printCoverageSummary(report: GameboardCoverageReport): void {
  console.log(`coverage status: ${report.status}`);
  console.log(`guide pages: ${report.guide.pageCount}/19`);
  console.log(`guide scenarios: ${report.guide.scenarioCount}`);
  console.log(
    `guide assets: ${report.guide.assetCounts.unique} unique (${report.guide.assetCounts.free} FREE, ${report.guide.assetCounts.extra} EXTRA), ${report.guide.assetCounts.occurrences} occurrence(s)`
  );
  console.log(`public APIs: ${report.publicApi.length}`);
  console.log(
    `manifest: ${report.manifest.manifestAssetCount} asset(s), ${report.manifest.freeGuideAssetsInManifest}/${report.manifest.guideFreeAssetCount} FREE guide asset(s)`
  );
  console.log(
    `visual artifacts: ${countCoverageStatus(report.visualArtifacts, 'available')} available, ${countCoverageStatus(report.visualArtifacts, 'missing')} missing, ${countCoverageStatus(report.visualArtifacts, 'skipped')} skipped`
  );
  console.log(
    `local references: ${countCoverageStatus(report.references, 'available')} available, ${countCoverageStatus(report.references, 'missing')} missing, ${countCoverageStatus(report.references, 'skipped')} skipped`
  );
  if (report.simpleRpgEvidence) {
    console.log(
      `SimpleRPG API evidence: ${report.simpleRpgEvidence.exercisedPublicApiCount}/${report.simpleRpgEvidence.guidePublicApiCount} represented, ${report.simpleRpgEvidence.executablePublicApiCount} directly executed, ${report.simpleRpgEvidence.activeEvidenceModes.length} active mode(s)`
    );
  }
  console.log(`gaps: ${report.gaps.length}`);
  for (const gap of report.gaps.slice(0, 20)) {
    console.log(
      `- ${gap.severity} ${gap.code}: ${gap.subject ? `${gap.subject}: ` : ''}${gap.message}`
    );
  }
  if (report.gaps.length > 20) {
    console.log(`...${report.gaps.length - 20} more gap(s)`);
  }
}

export function countCoverageStatus<T extends { status: GameboardCoverageStatus }>(
  values: readonly T[],
  status: GameboardCoverageStatus
): number {
  return values.filter((value) => value.status === status).length;
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

export function filterGuideScenarios(
  scenarios: readonly KayKitGuideScenario[],
  filters: {
    scenarioIds: readonly string[];
    pages: readonly number[];
    editions: ReadonlyArray<KayKitGuideScenario['edition']>;
    publicApis: readonly string[];
    roles: readonly string[];
    assetIds: readonly string[];
  }
): KayKitGuideScenario[] {
  const scenarioIds = new Set(filters.scenarioIds);
  const pages = new Set(filters.pages);
  const editions = new Set(filters.editions);
  const publicApis = new Set(filters.publicApis);
  const roles = new Set(filters.roles);
  const assetIds = new Set(filters.assetIds);
  return scenarios.filter((scenario) => {
    if (scenarioIds.size > 0 && !scenarioIds.has(scenario.id)) {
      return false;
    }
    if (pages.size > 0 && !pages.has(scenario.page)) {
      return false;
    }
    if (editions.size > 0 && !editions.has(scenario.edition)) {
      return false;
    }
    if (publicApis.size > 0 && !scenario.publicApi.some((publicApi) => publicApis.has(publicApi))) {
      return false;
    }
    if (roles.size > 0 && !scenario.treatmentRoles.some((role) => roles.has(role))) {
      return false;
    }
    if (assetIds.size > 0 && !scenario.assetIds.some((assetId) => assetIds.has(assetId))) {
      return false;
    }
    return true;
  });
}




export function countGuideScenarioAssetsByEdition(
  assetIds: readonly string[],
  treatmentByAssetId: ReadonlyMap<string, KayKitAssetPublicTreatment>,
  edition: PackEdition
): number {
  return assetIds.filter((assetId) => treatmentByAssetId.get(assetId)?.minimumEdition === edition)
    .length;
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

export function runSimulateScenario(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  if (typeof parsed.flags.scenario !== 'string') {
    throw new GameboardCliError('simulate-scenario requires --scenario <path>');
  }
  if (typeof parsed.flags.script !== 'string') {
    throw new GameboardCliError('simulate-scenario requires --script <path>');
  }

  const scenario = readJson(resolve(parsed.flags.scenario)) as GameboardScenario;
  const inspection = inspectGameboardScenario(scenario, {
    plan: validationConfigFromArgs(parsed, sourceRoot, edition),
  });
  const script = readSimulationScript(resolve(parsed.flags.script));
  const scriptInspection = inspectGameboardScenarioSimulationScript(script, {
    scenario,
    plan: inspection.plan,
  });
  const violations = [...inspection.violations, ...scriptInspection.violations];
  if (
    violations.some((violation) => violation.severity === 'error') &&
    parsed.flags.allowInvalid !== true
  ) {
    printViolations(violations);
    process.exit(1);
  }

  const result = runGameboardScenarioSimulationScript(scenario, script);
  const report = createGameboardScenarioSimulationReport(result, script.expectations);

  if (typeof parsed.flags.outPlan === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(report.finalPlan, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote final simulated GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`
    );
  }
  if (typeof parsed.flags.outInterop === 'string') {
    const interop = createGameboardSimulationInteropSnapshot(report, {
      includePlacements: parsed.flags.excludePlacements !== true,
      includeActors: parsed.flags.excludeActors !== true,
      includeQuests: parsed.flags.excludeQuests !== true,
      includeTimeline: parsed.flags.excludeTimeline !== true,
    });
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outInterop)),
      `${JSON.stringify(interop, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote simulation interop snapshot to ${safeResolveOutput(String(parsed.flags.outInterop))}`
    );
  }
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote scenario simulation report to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  }
  if (parsed.flags.json === true) {
    if (typeof parsed.flags.out !== 'string') {
      console.log(JSON.stringify(report, null, 2));
    }
  } else {
    printSimulationReport(report);
  }

  if (!report.success && parsed.flags.allowExpectationFailures !== true) {
    if (typeof parsed.flags.out === 'string' || parsed.flags.json === true) {
      printSimulationExpectationFailures(report);
    }
    process.exit(1);
  }
  if (
    parsed.flags.failOnBlockedQuest === true &&
    report.quests.some((quest) => quest.status === 'blocked')
  ) {
    process.exit(1);
  }
}

export function readBlueprintOptions(
  flags: Record<string, string | boolean>
): GameboardBlueprintScenarioOptions {
  const configPath =
    typeof flags.blueprint === 'string'
      ? flags.blueprint
      : typeof flags.config === 'string'
        ? flags.config
        : undefined;
  const fileOptions = configPath ? readBlueprintOptionsFile(resolve(configPath)) : {};
  const cliOptions: GameboardBlueprintScenarioOptions = {};
  const width = readNumberFlag(flags.width);
  const height = readNumberFlag(flags.height);
  const radius = readNumberFlag(flags.radius);

  if (typeof flags.seed === 'string') {
    cliOptions.seed = flags.seed;
  }
  if (typeof flags.faction === 'string') {
    cliOptions.faction = flags.faction as GameboardBlueprintOptions['faction'];
  }
  if (typeof flags.textureSet === 'string') {
    cliOptions.textureSet = flags.textureSet as GameboardBlueprintOptions['textureSet'];
  }
  if (typeof flags.defaultTerrain === 'string') {
    cliOptions.defaultTerrain =
      flags.defaultTerrain as GameboardBlueprintOptions['defaultTerrain'];
  }
  if (typeof flags.waterFill === 'string') {
    const waterFill = readNumberFlag(flags.waterFill);
    if (waterFill !== undefined) {
      cliOptions.waterFill = waterFill;
    }
  }
  if (typeof flags.maxElevation === 'string') {
    const maxElevation = readNumberFlag(flags.maxElevation);
    if (maxElevation !== undefined) {
      cliOptions.maxElevation = maxElevation;
    }
  }
  if (typeof flags.towns === 'string') {
    const towns = readNumberFlag(flags.towns);
    if (towns !== undefined) {
      cliOptions.towns = towns;
    }
  }
  if (typeof flags.harbors === 'string') {
    const harbors = readNumberFlag(flags.harbors);
    if (harbors !== undefined) {
      cliOptions.harbors = harbors;
    }
  }
  if (radius !== undefined || flags.shape === 'hexagon') {
    cliOptions.shape = { kind: 'hexagon', radius: Math.max(1, Math.floor(radius ?? 4)) };
  } else if (width !== undefined || height !== undefined || flags.shape === 'rectangle') {
    cliOptions.shape = {
      kind: 'rectangle',
      width: Math.max(1, Math.floor(width ?? 12)),
      height: Math.max(1, Math.floor(height ?? 9)),
    };
  }

  return {
    ...fileOptions,
    ...cliOptions,
  };
}

export function readBlueprintOptionsFile(path: string): GameboardBlueprintScenarioOptions {
  const payload = readJson(path);
  const options =
    isRecord(payload) && isRecord(payload.blueprint)
      ? payload.blueprint
      : isRecord(payload) && isRecord(payload.options)
        ? payload.options
        : payload;
  if (!isRecord(options)) {
    throw new GameboardCliError(
      `Blueprint file ${relativizePath(path)} must be an options object, { "blueprint": ... }, or { "options": ... }`
    );
  }
  return options as unknown as GameboardBlueprintScenarioOptions;
}

export function blueprintPayloadFromInspection(
  inspection: GameboardBlueprintInspection,
  violations: ReadonlyArray<ReturnType<typeof validateGameboardPlan>[number]>,
  flags: Record<string, string | boolean>,
  scenarioInspection?: GameboardBlueprintScenarioInspection,
  interop?: GameboardInteropSnapshot
): Record<string, unknown> {
  const errorCount = violations.filter((violation) => violation.severity === 'error').length;
  const warningCount = violations.filter((violation) => violation.severity === 'warning').length;
  const scenarioViolations = scenarioInspection?.scenarioInspection.violations ?? [];
  const scenarioErrorCount = scenarioViolations.filter(
    (violation) => violation.severity === 'error'
  ).length;
  const scenarioWarningCount = scenarioViolations.filter(
    (violation) => violation.severity === 'warning'
  ).length;
  return {
    seed: inspection.plan.seed,
    shape: inspection.plan.shape,
    recipeStepCount: inspection.recipe.steps.length,
    tileCount: inspection.plan.tiles.length,
    placementCount: inspection.plan.placements.length,
    counts: inspection.counts,
    warnings: inspection.warnings,
    validation: {
      errorCount,
      warningCount,
      violations,
    },
    ...(flags.includeRecipe === true ? { recipe: inspection.recipe } : {}),
    ...(flags.includePlan === true ? { plan: inspection.plan } : {}),
    ...(scenarioInspection
      ? {
          scenarioValidation: {
            errorCount: scenarioErrorCount,
            warningCount: scenarioWarningCount,
            violations: scenarioViolations,
          },
        }
      : {}),
    ...(flags.includeScenario === true && scenarioInspection
      ? { scenario: scenarioInspection.scenario }
      : {}),
    ...(flags.includeScenarioInspection === true && scenarioInspection
      ? { scenarioInspection: scenarioInspection.scenarioInspection }
      : {}),
    ...(interop
      ? {
          interopSummary: {
            entityCount: interop.entities.length,
            relationCount: interop.relations.length,
            spawnLocationCount: interop.spawnLocations.length,
            actorCount: interop.entities.filter((entity) => entity.kind === 'actor').length,
            questCount: interop.entities.filter((entity) => entity.kind === 'quest').length,
            spawnGroupCount: interop.entities.filter((entity) => entity.kind === 'spawn-group')
              .length,
            patrolRouteCount: interop.entities.filter((entity) => entity.kind === 'patrol-route')
              .length,
          },
        }
      : {}),
    ...(flags.includeInterop === true && interop ? { interop } : {}),
  };
}

export function shouldInspectBlueprintScenario(
  options: GameboardBlueprintScenarioOptions,
  flags: Record<string, string | boolean>
): boolean {
  return (
    hasBlueprintScenarioContent(options) ||
    typeof flags.outScenario === 'string' ||
    typeof flags.outScenarioInspection === 'string' ||
    typeof flags.outInterop === 'string' ||
    flags.includeScenario === true ||
    flags.includeScenarioInspection === true ||
    flags.includeInterop === true
  );
}

export function shouldEmitBlueprintInterop(flags: Record<string, string | boolean>): boolean {
  return typeof flags.outInterop === 'string' || flags.includeInterop === true;
}

export function createBlueprintScenarioInteropSnapshot(
  parsed: ParsedArgs,
  scenarioInspection: GameboardBlueprintScenarioInspection | undefined
): GameboardInteropSnapshot {
  if (!scenarioInspection) {
    throw new GameboardCliError('blueprint interop output requires a generated blueprint scenario');
  }
  return createGameboardScenarioInteropSnapshot(
    scenarioInspection.scenario,
    snapshotOptionsFromFlags(parsed.flags)
  );
}

export function hasBlueprintScenarioContent(
  options: GameboardBlueprintScenarioOptions
): boolean {
  return Boolean(
    options.scenarioId ||
      options.title ||
      options.spawnGroups ||
      options.patrolRoutes?.length ||
      options.actors?.length ||
      options.quests?.length ||
      options.scenarioMetadata
  );
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

export function readLayoutFillOptions(
  path: string,
  seedOverride: string | boolean | undefined
): GameboardLayoutFillOptions {
  const payload = readJson(path);
  const rules = Array.isArray(payload)
    ? (payload as readonly GameboardLayoutFillRule[])
    : isRecord(payload) && Array.isArray(payload.rules)
      ? (payload.rules as readonly GameboardLayoutFillRule[])
      : undefined;
  if (!Array.isArray(rules)) {
    throw new GameboardCliError(
      `Layout rules file ${relativizePath(path)} must be a rule array or { "rules": [...] }`
    );
  }
  const fileSeed = isRecord(payload) && typeof payload.seed === 'string' ? payload.seed : undefined;
  return {
    seed: typeof seedOverride === 'string' ? seedOverride : fileSeed,
    rules,
  };
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

export function printSimulationReport(
  report: ReturnType<typeof createGameboardScenarioSimulationReport>
): void {
  const completed = report.quests.filter((quest) => quest.status === 'completed').length;
  const blocked = report.quests.filter((quest) => quest.status === 'blocked').length;
  console.log(`scenario: ${report.scenarioId}`);
  console.log(`success: ${report.success ? 'yes' : 'no'}`);
  console.log(`steps: ${report.steps.length}`);
  console.log(`events: ${report.eventRecords.length}`);
  console.log(`commands: ${report.commands.length}`);
  console.log(`actor target records: ${report.actorTargets.length}`);
  console.log(`patrols: ${report.patrols.length}`);
  console.log(`movements: ${report.movements.length}`);
  console.log(`mutations: ${report.mutations.length}`);
  console.log(`actors: ${report.actors.length}`);
  console.log(`quests: ${report.quests.length} (${completed} completed, ${blocked} blocked)`);
  if (report.actorTargets.length > 0) {
    console.log('actor target records:');
    for (const actorTargets of report.actorTargets) {
      console.log(`  - ${actorTargetRecordSummary(actorTargets)}`);
    }
  }
  if (report.mutations.length > 0) {
    console.log('mutation records:');
    for (const mutation of report.mutations) {
      console.log(
        `  - ${mutation.type}: ${mutation.actorId ?? mutation.placementId ?? 'unknown'} ${mutationStatus(mutation)}`
      );
    }
  }
  printSimulationExpectationFailures(report);
}

export function actorTargetRecordSummary(
  actorTargets: ReturnType<typeof createGameboardScenarioSimulationReport>['actorTargets'][number]
): string {
  const step = actorTargets.stepId ?? `step ${actorTargets.stepIndex}`;
  const source = actorTargets.sourceActorId ?? 'unknown source';
  const targetCount = actorTargets.targets.length;
  const reachableCount = actorTargets.reachableActorIds.length;
  const nearest = actorTargets.nearestTarget
    ? `${actorTargets.nearestTarget.actorId} via ${actorTargets.nearestTarget.approach}${
        actorTargets.nearestTarget.approachTileKey
          ? ` ${actorTargets.nearestTarget.approachTileKey}`
          : ''
      }`
    : 'none';
  const command = actorTargets.nearestTarget
    ? `${actorTargets.nearestTarget.commandKind}${actorTargets.nearestTarget.commandCanExecute ? '' : ' blocked'}`
    : 'no command';
  return `${step}: ${source} found ${reachableCount}/${targetCount} reachable; nearest ${nearest}; ${command}`;
}

export function mutationStatus(
  mutation: ReturnType<typeof createGameboardScenarioSimulationReport>['mutations'][number]
): string {
  if (mutation.removed === true) {
    return 'removed';
  }
  if (mutation.spawned === true) {
    return 'spawned';
  }
  if (mutation.updated === true) {
    return 'updated';
  }
  return `not applied (${mutation.reason ?? 'unknown reason'})`;
}

export function printSimulationExpectationFailures(
  report: ReturnType<typeof createGameboardScenarioSimulationReport>
): void {
  if (report.expectationFailures.length === 0) {
    return;
  }
  console.log('expectation failures:');
  for (const failure of report.expectationFailures) {
    console.log(`  - ${failure.path}: ${failure.message}`);
  }
}

export function snapshotFromPlan(
  path: string,
  validationConfig: GameboardPlanValidationConfig,
  options: GameboardScenarioInteropOptions,
  allowInvalid: boolean
) {
  const plan = readJson(resolve(path)) as GameboardPlan;
  const violations = validateGameboardPlan(plan, validationConfig);
  failOnSnapshotViolations(violations, allowInvalid);
  return createGameboardInteropSnapshot(plan, options);
}

export function snapshotFromRecipe(
  path: string,
  validationConfig: GameboardPlanValidationConfig,
  options: GameboardScenarioInteropOptions,
  allowInvalid: boolean
) {
  const recipe = readJson(resolve(path)) as GameboardRecipe;
  const inspection = inspectGameboardRecipe(recipe, { plan: validationConfig });
  failOnSnapshotViolations(inspection.violations, allowInvalid);
  if (!inspection.plan) {
    throw new GameboardCliError(
      `Recipe ${relativizePath(path)} did not compile to a GameboardPlan`
    );
  }
  return createGameboardInteropSnapshot(inspection.plan, options);
}

export function snapshotFromScenario(
  path: string,
  validationConfig: GameboardPlanValidationConfig,
  options: GameboardScenarioInteropOptions,
  allowInvalid: boolean
) {
  const scenario = readJson(resolve(path)) as GameboardScenario;
  const inspection = inspectGameboardScenario(scenario, { plan: validationConfig });
  failOnSnapshotViolations(inspection.violations, allowInvalid);
  return createGameboardScenarioInteropSnapshot(scenario, options);
}

export function failOnSnapshotViolations(
  violations: ReadonlyArray<ReturnType<typeof validateGameboardPlan>[number]>,
  allowInvalid: boolean
): void {
  if (allowInvalid || !violations.some((violation) => violation.severity === 'error')) {
    return;
  }
  printViolations(violations);
  process.exit(1);
}

export function snapshotOptionsFromFlags(
  flags: Record<string, string | boolean>
): GameboardScenarioInteropOptions {
  const options: GameboardScenarioInteropOptions = {};
  if (flags.excludePlacements === true) {
    options.includePlacements = false;
  }
  if (flags.excludeActors === true) {
    options.includeActors = false;
  }
  if (flags.excludeQuests === true) {
    options.includeQuests = false;
  }
  if (flags.excludeSpawnGroups === true) {
    options.includeSpawnGroups = false;
  }
  const spawnCount = readNumberFlag(flags.spawnCount);
  if (spawnCount !== undefined) {
    options.spawnLocations = {
      count: spawnCount,
      seed: typeof flags.spawnSeed === 'string' ? flags.spawnSeed : undefined,
      minDistance: readNumberFlag(flags.spawnMinDistance),
      edgePadding: readNumberFlag(flags.spawnEdgePadding),
    };
  }
  return options;
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

export function printGameboardPlanSummary(payload: GameboardPlanSummaryPayload): void {
  const { summary, validation, source } = payload;
  const topAssets = summary.topAssets.slice(0, 10).map((asset) => {
    const suffix = asset.requiresExtra ? '*' : '';
    return `${asset.assetId}${suffix}=${asset.count}`;
  });
  console.log(`source: ${source.kind} ${source.path}`);
  console.log(`seed: ${summary.seed}`);
  console.log(`shape: ${formatShape(summary.shape)}`);
  console.log(`texture set: ${summary.textureSet}`);
  console.log(`tiles: ${summary.tileCount}`);
  console.log(`placements: ${summary.placementCount}`);
  console.log(`plan warnings: ${summary.warningCount}`);
  console.log(
    `validation: ${validation.errorCount} error(s), ${validation.warningCount} warning(s)`
  );
  console.log(`terrain: ${formatCounts(summary.tileTerrainCounts)}`);
  console.log(`textures: ${formatCounts(summary.tileTextureSetCounts)}`);
  console.log(`elevations: ${formatCounts(summary.tileElevationCounts)}`);
  console.log(`tile tags: ${formatCounts(summary.tileTagCounts)}`);
  console.log(`placement kinds: ${formatCounts(summary.placementKindCounts)}`);
  console.log(`placement layers: ${formatCounts(summary.placementLayerCounts)}`);
  console.log(`features: ${formatCounts(summary.placementFeatureCounts)}`);
  console.log(`requires extra placements: ${summary.requiresExtraPlacementCount}`);
  console.log(
    `extra assets: ${summary.extraAssetIds.length ? summary.extraAssetIds.join(', ') : 'none'}`
  );
  console.log(`top assets: ${topAssets.length ? topAssets.join(', ') : 'none'}`);
}

export function printGameboardScenarioSummary(
  summary: GameboardScenarioSummary,
  sourcePath: string
): void {
  const topActorAssets = summary.topActorAssets.slice(0, 10).map((asset) => {
    const suffix = asset.requiresExtra ? '*' : '';
    return `${asset.assetId}${suffix}=${asset.count}`;
  });
  console.log(`source: scenario ${sourcePath}`);
  console.log(`scenario: ${summary.scenarioId}`);
  if (summary.title) {
    console.log(`title: ${summary.title}`);
  }
  if (summary.board) {
    console.log(`seed: ${summary.board.seed}`);
    console.log(`shape: ${formatShape(summary.board.shape)}`);
    console.log(`tiles: ${summary.board.tileCount}`);
    console.log(`placements: ${summary.board.placementCount}`);
  }
  console.log(
    `validation: ${summary.validation.errorCount} error(s), ${summary.validation.warningCount} warning(s)`
  );
  console.log(`actors: ${summary.actorCount} authored, ${summary.resolvedActorCount} resolved`);
  console.log(
    `actor flags: ${summary.hostileActorCount} hostile, ${summary.interactiveActorCount} interactive, ${summary.blockingActorCount} blocking`
  );
  console.log(
    `actor agents: ${summary.movementAgentCount} movement, ${summary.patrolAgentCount} patrol`
  );
  console.log(`actor kinds: ${formatCounts(summary.actorKindCounts)}`);
  console.log(`actor teams: ${formatCounts(summary.actorTeamCounts)}`);
  console.log(`actor spawn groups: ${formatCounts(summary.actorSpawnGroupCounts)}`);
  console.log(`actor tiles: ${formatCounts(summary.actorTileCounts)}`);
  console.log(`actor tags: ${formatCounts(summary.actorTagCounts)}`);
  console.log(`actor assets: ${formatCounts(summary.actorAssetCounts)}`);
  console.log(
    `actor extra assets: ${
      summary.actorExtraAssetIds.length ? summary.actorExtraAssetIds.join(', ') : 'none'
    }`
  );
  console.log(`top actor assets: ${topActorAssets.length ? topActorAssets.join(', ') : 'none'}`);
  console.log(`quests: ${summary.questCount} quest(s), ${summary.objectiveCount} objective(s)`);
  console.log(`objective kinds: ${formatCounts(summary.objectiveKindCounts)}`);
  console.log(`objective actors: ${formatCounts(summary.objectiveActorCounts)}`);
  console.log(`objective targets: ${formatCounts(summary.objectiveTargetActorCounts)}`);
  console.log(
    `spawn groups: ${summary.spawnGroupCount} group(s), ${summary.spawnLocationCount} location(s), ${summary.spawnRouteFoundCount}/${summary.spawnRouteCheckCount} route check(s) found`
  );
  console.log(`spawn group locations: ${formatCounts(summary.spawnGroupLocationCounts)}`);
  console.log(
    `patrol routes: ${summary.patrolRouteFoundCount}/${summary.patrolRouteCount} found, ${summary.patrolWaypointCount} waypoint(s)`
  );
  console.log(`patrol route waypoints: ${formatCounts(summary.patrolRouteWaypointCounts)}`);
}

export function formatShape(shape: GameboardPlan['shape']): string {
  if (shape.kind === 'rectangle') {
    return `rectangle ${shape.width}x${shape.height}`;
  }
  return `hexagon radius ${shape.radius}`;
}

export function printBlueprintInspection(
  inspection: GameboardBlueprintInspection,
  violations: ReadonlyArray<ReturnType<typeof validateGameboardPlan>[number]>
): void {
  console.log(`blueprint seed: ${inspection.plan.seed}`);
  console.log(`shape: ${JSON.stringify(inspection.plan.shape)}`);
  console.log(`recipe steps: ${inspection.recipe.steps.length}`);
  console.log(`tiles: ${inspection.plan.tiles.length}`);
  console.log(`placements: ${inspection.plan.placements.length}`);
  console.log(`counts: ${formatCounts(inspection.counts)}`);
  if (inspection.warnings.length > 0) {
    console.log('blueprint warnings:');
    for (const warning of inspection.warnings) {
      console.log(`  - ${warning}`);
    }
  } else {
    console.log('blueprint warnings: none');
  }
  printViolations(violations);
}

export function printBlueprintScenarioInspection(
  inspection: GameboardBlueprintScenarioInspection
): void {
  const scenarioInspection = inspection.scenarioInspection;
  console.log(`scenario: ${inspection.scenario.id}`);
  console.log(`scenario actors: ${inspection.scenario.actors?.length ?? 0}`);
  console.log(`scenario quests: ${inspection.scenario.quests?.length ?? 0}`);
  console.log(`scenario spawn groups: ${scenarioInspection.spawnGroups?.groupCount ?? 0}`);
  console.log(`scenario patrol routes: ${scenarioInspection.patrolRoutes?.routeCount ?? 0}`);
  printViolations(scenarioInspection.violations);
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

export function printPiecePlacementInspection(inspection: GameboardPiecePlacementInspection): void {
  console.log(`piece: ${inspection.pieceId}`);
  console.log(`asset: ${inspection.assetId}`);
  console.log(`role: ${inspection.role}`);
  console.log(`source: ${inspection.source}`);
  console.log(`candidate sites: ${inspection.siteInspection.candidateCount}`);
  console.log(`selected sites: ${inspection.siteInspection.selectedCount}`);
  console.log(`rejected sites: ${inspection.siteInspection.rejectedCount}`);
  console.log(`rejections: ${formatCounts(inspection.siteInspection.rejectionCounts)}`);
  console.log(`placements: ${inspection.placements.length}`);
  if (inspection.placements.length > 0) {
    console.log(
      `placement tiles: ${inspection.placements.map((placement) => placementAtKey(placement.at)).join(', ')}`
    );
  }
}

export function placementAtKey(at: string | { q: number; r: number }): string {
  return typeof at === 'string' ? at : `${at.q},${at.r}`;
}

export function printPiecesFromAssets(summary: PiecesFromAssetsSummary): void {
  console.log(`assets scanned: ${summary.assetCount}`);
  console.log(`compatible KayKit hex tiles: ${summary.compatibleTileCount}`);
  console.log(`suggested roles: ${formatCounts(summary.suggestedRoles)}`);
  console.log(`piece roles: ${formatCounts(summary.pieceRoles)}`);
  console.log(`warnings: ${summary.warningCount}`);
  console.log(`errors: ${summary.errorCount}`);
  if (summary.overrideWarnings.length > 0) {
    console.log('override warnings:');
    for (const warning of summary.overrideWarnings) {
      console.log(`  - ${warning}`);
    }
  }
  if (summary.registryWarnings.length > 0) {
    console.log('registry warnings:');
    for (const warning of summary.registryWarnings) {
      console.log(`  - ${warning}`);
    }
  }
  if (summary.registryErrors.length > 0) {
    console.log('registry errors:');
    for (const error of summary.registryErrors) {
      console.log(`  - ${error}`);
    }
  }
}

export function printLayoutFillAnalysis(analysis: GameboardLayoutFillAnalysis): void {
  console.log(`layout seed: ${analysis.seed}`);
  console.log(`rules: ${analysis.ruleCount}`);
  console.log(`placements: ${analysis.placementCount}`);
  console.log(`candidate sites: ${analysis.candidateCount}`);
  console.log(`diagnostics: ${analysis.errorCount} error(s), ${analysis.warningCount} warning(s)`);
  for (const rule of analysis.rules) {
    console.log(
      `  - ${rule.id}: ${rule.selectedCount}/${rule.targetCount} selected from ${rule.candidateCount} candidate site(s)`
    );
    if (rule.rejectedSiteCount > 0) {
      console.log(`    rejected tiles: ${rule.rejectedSiteCount}`);
      console.log(`    rejection counts: ${formatCounts(rule.rejectionCounts)}`);
    }
    if (rule.assetIds.length > 0) {
      console.log(`    assets: ${rule.assetIds.join(', ')}`);
    }
    if (rule.selectedTileKeys.length > 0) {
      console.log(`    selected tiles: ${rule.selectedTileKeys.join(', ')}`);
    }
    for (const warning of rule.warnings) {
      console.log(`    warning: ${warning}`);
    }
    for (const error of rule.errors) {
      console.log(`    error: ${error}`);
    }
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

export function printPatrolRouteSet(routeSet: GameboardPatrolRouteSet): void {
  console.log(`patrol seed: ${routeSet.seed}`);
  console.log(`routes: ${routeSet.routeCount}`);
  console.log(
    `complete: ${routeSet.routes.filter((route) => route.found).length}/${routeSet.routes.length}`
  );
  for (const route of routeSet.routes) {
    console.log(
      `  - ${route.id}: ${route.selectedWaypointCount}/${route.requestedWaypointCount} waypoint(s), ${route.segments.filter((segment) => segment.found).length}/${route.segments.length} segment(s)`
    );
    if (route.waypoints.length > 0) {
      console.log(`    tiles: ${route.waypoints.map((waypoint) => waypoint.key).join(', ')}`);
    }
    if (route.pathKeys.length > 0) {
      console.log(`    path: ${route.pathKeys.join(' -> ')}`);
    }
    for (const warning of route.warnings) {
      console.log(`    warning: ${warning}`);
    }
    for (const error of route.errors) {
      console.log(`    error: ${error}`);
    }
  }
}

export function printPatrolSimulationScriptPlan(plan: GameboardPatrolSimulationScriptPlan): void {
  console.log(`patrol simulation steps: ${plan.stepCount}`);
  console.log(`assignments: ${plan.assignments.length}`);
  for (const assignment of plan.assignments) {
    console.log(
      `  - ${assignment.actorId} -> ${assignment.routeId}: ${assignment.stepCount} step(s), ${assignment.roundCount} round(s)`
    );
    for (const warning of assignment.warnings) {
      console.log(`    warning: ${warning}`);
    }
    for (const error of assignment.errors) {
      console.log(`    error: ${error}`);
    }
  }
  console.log(`warnings: ${plan.warnings.length}`);
  console.log(`errors: ${plan.errors.length}`);
}

export function formatCounts(counts: Readonly<Record<string, number | undefined>>): string {
  const entries = Object.entries(counts).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number'
  );
  return entries.length ? entries.map(([key, value]) => `${key}=${value}`).join(', ') : 'none';
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

export function pieceForPlacementFromFlags(
  registry: GameboardPieceRegistry,
  flags: Record<string, string | boolean>
): GameboardPieceDeclaration {
  const selection = pieceSelectionFromFlags(flags);
  if (typeof flags.pieceId === 'string') {
    selection.ids = [flags.pieceId];
  } else if (typeof flags.id === 'string') {
    selection.ids = [flags.id];
  }
  if (typeof flags.assetId === 'string') {
    selection.assetIds = [flags.assetId];
  }
  const selected = selectGameboardPieces(registry, selection);
  if (selected.length === 1) {
    return selected[0] as GameboardPieceDeclaration;
  }
  const description = JSON.stringify(selection);
  if (selected.length === 0) {
    throw new GameboardCliError(`place-piece matched no pieces for selection ${description}`);
  }
  throw new GameboardCliError(
    `place-piece matched ${selected.length} pieces for selection ${description}; narrow with --pieceId`
  );
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

export function readAssetInputs(flags: Record<string, string | boolean>): string[] {
  const inputs = [...readCsv(flags.assets)];
  if (typeof flags.asset === 'string') {
    inputs.push(flags.asset);
  }
  if (inputs.length === 0) {
    throw new GameboardCliError(
      'pieces-from-assets requires --assets <path[,path]> or --asset <path>'
    );
  }
  return inputs.map((input) => resolve(input));
}

export function assetInputRoots(inputs: readonly string[]): AssetInputRoot[] {
  return inputs.map((input) => {
    const stats = statSync(input);
    return {
      input,
      base: stats.isDirectory() ? input : dirname(input),
    };
  });
}

export function collectGltfAssetPaths(inputs: readonly string[]): string[] {
  const files = new Set<string>();
  for (const input of inputs) {
    const stats = statSync(input);
    if (stats.isDirectory()) {
      for (const assetPath of collectGltfAssetPathsFromDirectory(input)) {
        files.add(assetPath);
      }
      continue;
    }
    if (isGltfPath(input)) {
      files.add(input);
    }
  }
  return [...files].sort((left, right) => left.localeCompare(right));
}

export function collectGltfAssetPathsFromDirectory(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectGltfAssetPathsFromDirectory(fullPath));
      continue;
    }
    if (entry.isFile() && isGltfPath(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

export function isGltfPath(path: string): boolean {
  const extension = extname(path).toLowerCase();
  return extension === '.glb' || extension === '.gltf';
}

export function assetIdFromBatchPath(path: string, roots: readonly AssetInputRoot[]): string {
  const relativePath = relativeAssetPath(path, roots);
  const withoutExtension = relativePath.slice(0, -extname(relativePath).length);
  return normalizeAssetId(withoutExtension);
}

export function sourceAssetRecord(
  path: string,
  roots: readonly AssetInputRoot[],
  includeAbsolutePath: boolean
): BatchSourceAssetRecord {
  const relativePath = relativeAssetPath(path, roots);
  const extension = extname(path).toLowerCase();
  return {
    id: assetIdFromBatchPath(path, roots),
    relativePath,
    fileName: basename(path),
    extension,
    ...(includeAbsolutePath ? { path } : {}),
  };
}

export function relativeAssetPath(path: string, roots: readonly AssetInputRoot[]): string {
  const root = [...roots]
    .sort((left, right) => right.base.length - left.base.length)
    .find((candidate) => path === candidate.input || path.startsWith(`${candidate.base}/`));
  return normalizePath(root ? relative(root.base, path) : basename(path));
}

export function normalizeAssetId(value: string): string {
  return normalizePath(value)
    .split('/')
    .map((part) =>
      part
        .trim()
        .replace(/[^a-zA-Z0-9:_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
    )
    .filter(Boolean)
    .join('/');
}

export function normalizePath(value: string): string {
  return value.replaceAll('\\', '/');
}

export function mergeSourceAssetOverrides(
  overrides: Readonly<Record<string, GameboardPieceCompatibilityDeclarationOptions>> | undefined,
  sourceAssets: readonly BatchSourceAssetRecord[]
): Readonly<Record<string, GameboardPieceCompatibilityDeclarationOptions>> {
  const merged: Record<string, GameboardPieceCompatibilityDeclarationOptions> = {
    ...(overrides ?? {}),
  };
  for (const asset of sourceAssets) {
    merged[asset.id] = {
      ...(merged[asset.id] ?? {}),
      metadata: {
        sourceRelativePath: asset.relativePath,
        sourceFileName: asset.fileName,
        sourceExtension: asset.extension,
        localAsset: true,
        ...(merged[asset.id]?.metadata ?? {}),
      },
    };
  }
  return merged;
}

export function unmatchedOverrideWarnings(
  overrides: Readonly<Record<string, GameboardPieceCompatibilityDeclarationOptions>> | undefined,
  reports: ReadonlyArray<ReturnType<typeof analyzeExternalAssetCompatibility>>
): string[] {
  if (!overrides) {
    return [];
  }
  const reportIds = new Set(reports.map((report) => report.id));
  return Object.keys(overrides)
    .filter((id) => !reportIds.has(id))
    .map((id) => `Piece override ${id} did not match any scanned asset id`);
}

export function summarizeCompatibilityReports(
  reports: ReadonlyArray<ReturnType<typeof analyzeExternalAssetCompatibility>>,
  analysis: GameboardPieceRegistryAnalysis,
  extraWarnings: readonly string[] = []
): PiecesFromAssetsSummary {
  const suggestedRoles: Record<string, number> = {};
  for (const report of reports) {
    incrementCount(suggestedRoles, report.suggestedRole);
  }
  return {
    assetCount: reports.length,
    compatibleTileCount: reports.filter((report) => report.compatibleAsTile).length,
    warningCount:
      reports.reduce((count, report) => count + report.warnings.length, 0) +
      analysis.warnings.length +
      extraWarnings.length,
    errorCount:
      reports.reduce((count, report) => count + report.errors.length, 0) + analysis.errors.length,
    suggestedRoles,
    pieceRoles: analysis.roleCounts,
    overrideWarnings: extraWarnings,
    registryWarnings: analysis.warnings,
    registryErrors: analysis.errors,
  };
}

export function incrementCount(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
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

export function readGuideScenarioAssetScope(
  value: string | boolean | undefined,
  manifestEdition: PackEdition | undefined
): GuideScenarioAssetScope {
  const defaultScope = manifestEdition === 'free' ? 'free' : 'all';
  if (value === undefined || value === false) {
    return defaultScope;
  }
  if (value === 'free' || value === 'extra' || value === 'all') {
    return value;
  }
  throw new GameboardCliError(`Unsupported guide scenario asset scope: ${String(value)}`);
}
