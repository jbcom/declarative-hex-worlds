#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { GameboardCliError } from '../errors';
import {
  bootstrapKayKitAssets,
  verifyBootstrap,
  type BootstrapKayKitAssetsSource,
  type BootstrapResult,
  type BootstrapVerificationReport,
} from '../bootstrap';
import {
  copyGltfTree,
  defaultSourceRoot,
  expectedModelCount,
  generateManifestFromSource,
  validateSourceRoot,
  writeManifestJson,
} from '../ingest';
import {
  analyzeExternalAssetCompatibility,
  type ExternalAssetForwardAxis,
  type ExternalAssetIntendedRole,
} from '../interop';
import {
  GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS,
  GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS,
  createDefaultGameboardCoveragePackageChecks,
  createDefaultGameboardCoverageReferences,
  renderGameboardCoverageMarkdown,
  summarizeGameboardCoverage,
  type GameboardCoveragePathStatusInput,
  type GameboardCoverageReport,
  type GameboardCoverageSimpleRpgEvidence,
  type GameboardCoverageSimpleRpgEvidenceMode,
  type GameboardCoverageStatus,
} from '../interop';
import {
  listSimpleRpgGuidePublicApiExercises,
  runSimpleRpgExecutableGuideApiSmoke,
  summarizeSimpleRpgGuidePublicApiExercises,
} from '../../examples/simple-rpg-usage';
import {
  inspectMedievalGameboardBlueprint,
  inspectMedievalGameboardBlueprintScenario,
  type MedievalGameboardBlueprintInspection,
  type MedievalGameboardBlueprintOptions,
  type MedievalGameboardBlueprintScenarioInspection,
  type MedievalGameboardBlueprintScenarioOptions,
} from '../scenario';
import {
  describeKayKitGuideAssetCoverage,
  describeKayKitGuidePublicApiCoverage,
  describeKayKitGuideRoleCoverage,
  describeKayKitGuideScenarioCoverage,
  listKayKitAssetPublicTreatments,
  listKayKitGuideAssetCoverages,
  listKayKitGuidePublicApiCoverages,
  listKayKitGuideRoleCoverages,
  listKayKitGuideScenarioAssetRenderGroups,
  listKayKitGuideScenarioAssetRenderRequests,
  listKayKitGuideScenarioAssetUsages,
  listKayKitGuideScenarios,
  renderKayKitGuideScenarioCoverageMarkdown,
  summarizeKayKitGuideCoverage,
  type KayKitAssetPublicTreatment,
  type KayKitAssetPublicRole,
  type KayKitGuideAssetCoverage,
  type KayKitGuidePublicApiCoverage,
  type KayKitGuideRoleCoverage,
  type KayKitGuideScenario,
  type KayKitGuideScenarioAssetRenderGroup,
  type KayKitGuideScenarioAssetRenderRequest,
  type KayKitGuideScenarioAssetUsage,
  type KayKitGuideScenarioCoverage,
} from '../scenario';
import {
  analyzeHexTileRegistry,
  createHexTileRegistry,
  createHexTileRegistryFromManifest,
  type HexTileDeclarationInput,
  type HexTileRegistry,
} from '../scenario';
import { validateGameboardPlan, type GameboardPlanValidationConfig } from '../rules';
import {
  summarizeGameboardPlan,
  type GameboardPlan,
  type GameboardPlanSummary,
  type SummarizeGameboardPlanOptions,
} from '../gameboard';
import { inspectGameboardRecipe, type GameboardRecipe } from '../scenario';
import {
  createGameboardWorldFromScenario,
  inspectGameboardScenario,
  summarizeGameboardScenario,
  type GameboardScenario,
  type GameboardScenarioSummary,
} from '../scenario';
import {
  createGameboardPatrolSimulationScript,
  createGameboardScenarioSimulationReport,
  inspectGameboardScenarioSimulationScript,
  runGameboardScenarioSimulationScript,
  type GameboardPatrolSimulationActorAssignment,
  type GameboardPatrolSimulationScriptPlan,
  type GameboardScenarioSimulationScript,
  type GameboardScenarioSimulationStep,
} from '../simulation';
import {
  createGameboardInteropSnapshot,
  createGameboardScenarioInteropSnapshot,
  createGameboardSimulationInteropSnapshot,
  type GameboardInteropSnapshot,
  type GameboardScenarioInteropOptions,
} from '../interop';
import {
  analyzeGameboardPieceRegistry,
  createGameboardPieceRegistry,
  createGameboardPieceSourceUrlMap,
  declareGameboardPiecesFromCompatibilityReports,
  declareGameboardPieceFromCompatibility,
  inspectGameboardPiecePlacement,
  selectGameboardPieces,
  type GameboardPieceCompatibilityDeclarationOptions,
  type GameboardPieceDeclaration,
  type GameboardPieceDeclarationInput,
  type GameboardPiecePlacementInspection,
  type GameboardPieceRegistry,
  type GameboardPieceRegistryAnalysis,
  type GameboardPieceRegistrySelection,
  type GameboardPieceRole,
  type GameboardPieceSourceUrlOptions,
} from '../pieces';
import {
  createSeededGameboardPieceFillRules,
  inspectSeededGameboardPieceFills,
  type SeededGameboardPieceFillInspection,
  type SeededGameboardPieceFillMode,
  type SeededGameboardPieceFillOptions,
} from '../rules';
import {
  analyzeGameboardLayoutFill,
  appendGameboardLayoutPlacementsToPlan,
  type GameboardLayoutFillAnalysis,
  type GameboardLayoutFillOptions,
  type GameboardLayoutFillRule,
} from '../coordinates';
import {
  planGameboardPatrolRoutes,
  planGameboardSpawnGroups,
  type GameboardPatrolRouteRule,
  type GameboardPatrolRouteSet,
  type GameboardPatrolRouteSetOptions,
  type GameboardSpawnGroupOptions,
  type GameboardSpawnGroupPlan,
} from '../gameboard';
import { listGuideTilePermutations, type GuideTilePermutationKind } from '../selectors';
import type {
  AssetBounds,
  AssetCategory,
  HexEdgeIndex,
  MedievalHexagonManifest,
  PackEdition,
} from '../types';
import {
  inspectMedievalHexagonManifest,
  type MedievalHexagonManifestInspection,
} from '../manifest';

interface GltfAccessorMetadata {
  min?: number[];
  max?: number[];
}

interface GltfDocumentMetadata {
  accessors?: GltfAccessorMetadata[];
  animations?: Array<{ name?: string }>;
  materials?: Array<{ name?: string }>;
  meshes?: Array<{ primitives?: Array<{ attributes?: { POSITION?: number } }> }>;
  nodes?: Array<{ skin?: number; mesh?: number }>;
  skins?: unknown[];
}

interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
}

type GuideScenarioAssetScope = PackEdition | 'all';

interface AssetInputRoot {
  input: string;
  base: string;
}

interface BatchSourceAssetRecord {
  id: string;
  relativePath: string;
  fileName: string;
  extension: string;
  path?: string;
}

interface PiecesFromAssetsSummary {
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

type GameboardPlanInputKind = 'plan' | 'recipe' | 'scenario' | 'blueprint';
type GameboardPlanValidationViolation = ReturnType<typeof validateGameboardPlan>[number];

interface GameboardPlanSummaryInput {
  source: {
    kind: GameboardPlanInputKind;
    path: string;
  };
  plan: GameboardPlan;
  violations: readonly GameboardPlanValidationViolation[];
}

interface GameboardPlanSummaryPayload {
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
function relativizePath(value: string): string {
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
 * a wider jail by setting `MEDIEVAL_HEXAGON_OUT_ROOT`. The env var is the only
 * legitimate way to widen the jail; CLI users never set it.
 */
function defaultOutRoot(): string {
  const envRoot = process.env.MEDIEVAL_HEXAGON_OUT_ROOT;
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
 *   `defaultOutRoot()` (cwd, or `MEDIEVAL_HEXAGON_OUT_ROOT` when set).
 * @returns Absolute resolved path, guaranteed to be inside `outRoot`.
 * @throws When the resolved path escapes the jail via `..` segments or via an
 *   absolute path that points outside `outRoot`.
 */
function safeResolveOutput(value: string, outRoot: string = defaultOutRoot()): string {
  const root = resolve(outRoot);
  const resolved = resolve(root, value);
  const rel = relative(root, resolved);
  if (rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))) {
    return resolved;
  }
  throw new GameboardCliError(`--out path escapes the output root: ${value}`);
}

function main(argv: string[]): void {
  const parsed = parseArgs(argv);
  const edition = readEdition(parsed.flags.edition);
  const sourceRoot = resolve(String(parsed.flags.source ?? defaultSourceRoot(edition)));

  if (parsed.command === 'doctor') {
    if (parsed.flags.coverage === true) {
      runCoverage(parsed);
      return;
    }
    runDoctor(sourceRoot, edition);
    return;
  }

  if (parsed.command === 'validate') {
    runValidate(sourceRoot, edition);
    return;
  }

  if (parsed.command === 'manifest') {
    const manifest = generateManifestFromSource({
      sourceRoot,
      edition,
      assetBasePath: String(parsed.flags.assetBasePath ?? `assets/${edition}`),
    });
    const output = parsed.flags.out;
    if (typeof output === 'string') {
      const outputPath = safeResolveOutput(output);
      writeManifestJson(manifest, outputPath);
      console.log(`Wrote manifest to ${outputPath}`);
    } else {
      console.log(JSON.stringify(manifest, null, 2));
    }
    return;
  }

  if (parsed.command === 'validate-manifest') {
    runValidateManifest(parsed);
    return;
  }

  if (parsed.command === 'analyze') {
    const registry = registryFromArgs(parsed, sourceRoot, edition);
    const analysis = analyzeHexTileRegistry(registry);
    if (parsed.flags.json === true) {
      console.log(JSON.stringify(analysis, null, 2));
    } else {
      printAnalysis(analysis);
    }
    return;
  }

  if (parsed.command === 'declarations') {
    const registry = registryFromArgs(parsed, sourceRoot, edition);
    const output = parsed.flags.out;
    const declarations = registry.declarations;
    if (typeof output === 'string') {
      const outputPath = safeResolveOutput(output);
      writeFileSync(outputPath, `${JSON.stringify(declarations, null, 2)}\n`, 'utf8');
      console.log(`Wrote ${declarations.length} tile declarations to ${outputPath}`);
    } else {
      console.log(JSON.stringify(declarations, null, 2));
    }
    return;
  }

  if (parsed.command === 'guide-permutations') {
    runGuidePermutations(parsed, sourceRoot, edition);
    return;
  }

  if (parsed.command === 'guide-scenarios') {
    runGuideScenarios(parsed, sourceRoot, edition);
    return;
  }

  if (parsed.command === 'guide-usages') {
    runGuideUsages(parsed, sourceRoot, edition);
    return;
  }

  if (parsed.command === 'guide-render-requests') {
    runGuideRenderRequests(parsed, sourceRoot, edition);
    return;
  }

  if (parsed.command === 'guide-apis') {
    runGuidePublicApis(parsed);
    return;
  }

  if (parsed.command === 'guide-assets') {
    runGuideAssets(parsed);
    return;
  }

  if (parsed.command === 'guide-roles') {
    runGuideRoles(parsed);
    return;
  }

  if (parsed.command === 'coverage') {
    runCoverage(parsed);
    return;
  }

  if (parsed.command === 'blueprint') {
    runBlueprint(parsed, sourceRoot, edition);
    return;
  }

  if (parsed.command === 'summarize-plan') {
    runSummarizePlan(parsed, sourceRoot, edition);
    return;
  }

  if (parsed.command === 'summarize-scenario') {
    runSummarizeScenario(parsed, sourceRoot, edition);
    return;
  }

  if (parsed.command === 'validate-plan') {
    if (typeof parsed.flags.plan !== 'string') {
      throw new GameboardCliError('validate-plan requires --plan <path>');
    }
    const plan = readJson<GameboardPlan>(resolve(parsed.flags.plan));
    const violations = validateGameboardPlan(
      plan,
      validationConfigFromArgs(parsed, sourceRoot, edition)
    );
    if (parsed.flags.json === true) {
      console.log(JSON.stringify(violations, null, 2));
    } else {
      printViolations(violations);
    }
    if (violations.some((violation) => violation.severity === 'error')) {
      process.exit(1);
    }
    return;
  }

  if (parsed.command === 'analyze-layout') {
    runAnalyzeLayout(parsed, sourceRoot, edition);
    return;
  }

  if (parsed.command === 'spawn-groups') {
    runSpawnGroups(parsed, sourceRoot, edition);
    return;
  }

  if (parsed.command === 'patrol-routes') {
    runPatrolRoutes(parsed, sourceRoot, edition);
    return;
  }

  if (parsed.command === 'patrol-script') {
    runPatrolScript(parsed, sourceRoot, edition);
    return;
  }

  if (parsed.command === 'validate-recipe') {
    if (typeof parsed.flags.recipe !== 'string') {
      throw new GameboardCliError('validate-recipe requires --recipe <path>');
    }
    const recipe = readJson<GameboardRecipe>(resolve(parsed.flags.recipe));
    const inspection = inspectGameboardRecipe(recipe, {
      plan: validationConfigFromArgs(parsed, sourceRoot, edition),
    });
    if (typeof parsed.flags.outPlan === 'string' && inspection.plan) {
      writeFileSync(
        safeResolveOutput(String(parsed.flags.outPlan)),
        `${JSON.stringify(inspection.plan, null, 2)}\n`,
        'utf8'
      );
      console.log(`Wrote compiled GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`);
    }
    const violations = inspection.violations;
    if (parsed.flags.json === true) {
      console.log(JSON.stringify(violations, null, 2));
    } else {
      printViolations(violations);
    }
    if (violations.some((violation) => violation.severity === 'error')) {
      process.exit(1);
    }
    return;
  }

  if (parsed.command === 'validate-scenario') {
    if (typeof parsed.flags.scenario !== 'string') {
      throw new GameboardCliError('validate-scenario requires --scenario <path>');
    }
    const scenario = readJson<GameboardScenario>(resolve(parsed.flags.scenario));
    const inspection = inspectGameboardScenario(scenario, {
      plan: validationConfigFromArgs(parsed, sourceRoot, edition),
    });
    const hasScenarioErrors = inspection.violations.some(
      (violation) => violation.severity === 'error'
    );
    const runtime = hasScenarioErrors ? undefined : createGameboardWorldFromScenario(scenario);
    if (typeof parsed.flags.outPlan === 'string' && (inspection.plan ?? runtime?.plan)) {
      writeFileSync(
        safeResolveOutput(String(parsed.flags.outPlan)),
        `${JSON.stringify(inspection.plan ?? runtime?.plan, null, 2)}\n`,
        'utf8'
      );
      console.log(`Wrote compiled GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`);
    }
    const violations = [...inspection.violations];
    if (parsed.flags.json === true) {
      console.log(
        JSON.stringify(
          {
            scenario: scenario.id,
            actors:
              runtime?.actors.map((actor) => actor.actor.actorId) ??
              scenario.actors?.map((actor) => actor.actorId) ??
              [],
            quests:
              runtime?.quests.map((quest) => quest.quest.questId) ??
              scenario.quests?.map((quest) => quest.id) ??
              [],
            spawnGroups: inspection.spawnGroups,
            patrolRoutes: inspection.patrolRoutes,
            violations,
          },
          null,
          2
        )
      );
    } else {
      console.log(`scenario: ${scenario.id}`);
      console.log(`actors: ${runtime?.actors.length ?? scenario.actors?.length ?? 0}`);
      console.log(`quests: ${runtime?.quests.length ?? scenario.quests?.length ?? 0}`);
      if (inspection.spawnGroups) {
        const foundRoutes = inspection.spawnGroups.routeChecks.filter(
          (route) => route.found
        ).length;
        console.log(
          `spawn groups: ${inspection.spawnGroups.groupCount} group(s), ${inspection.spawnGroups.selectedLocationCount} location(s), ${foundRoutes}/${inspection.spawnGroups.routeChecks.length} route(s)`
        );
      }
      if (inspection.patrolRoutes) {
        const foundPatrolRoutes = inspection.patrolRoutes.routes.filter(
          (route) => route.found
        ).length;
        console.log(
          `patrol routes: ${foundPatrolRoutes}/${inspection.patrolRoutes.routeCount} complete`
        );
      }
      printViolations(violations);
    }
    if (violations.some((violation) => violation.severity === 'error')) {
      process.exit(1);
    }
    return;
  }

  if (parsed.command === 'validate-simulation') {
    runValidateSimulation(parsed, sourceRoot, edition);
    return;
  }

  if (parsed.command === 'snapshot') {
    runSnapshot(parsed, sourceRoot, edition);
    return;
  }

  if (parsed.command === 'simulate-scenario') {
    runSimulateScenario(parsed, sourceRoot, edition);
    return;
  }

  if (parsed.command === 'compatibility') {
    if (typeof parsed.flags.asset !== 'string') {
      throw new GameboardCliError('compatibility requires --asset <path>');
    }
    const metadata = readGltfMetadata(resolve(parsed.flags.asset));
    const report = analyzeExternalAssetCompatibility({
      id: String(parsed.flags.id ?? assetIdFromPath(parsed.flags.asset)),
      sourcePack: String(parsed.flags.sourcePack ?? 'external'),
      creator: typeof parsed.flags.creator === 'string' ? parsed.flags.creator : undefined,
      license: typeof parsed.flags.license === 'string' ? parsed.flags.license : undefined,
      bounds: metadata.bounds,
      intendedRole: readIntendedRole(parsed.flags.intendedRole),
      hasRig: metadata.hasRig,
      animationNames: metadata.animationNames,
      materialSlots: metadata.materialSlots,
      modelForward: readModelForward(parsed.flags.modelForward),
      boardForwardEdge: readBoardForwardEdge(parsed.flags.boardForwardEdge),
    });
    if (parsed.flags.json === true) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printCompatibility(report);
    }
    if (parsed.flags.failOnWarning === true && report.warnings.length > 0) {
      process.exit(1);
    }
    if (report.errors.length > 0) {
      process.exit(1);
    }
    return;
  }

  if (parsed.command === 'piece') {
    if (typeof parsed.flags.asset !== 'string') {
      throw new GameboardCliError('piece requires --asset <path>');
    }
    const assetId = String(parsed.flags.id ?? assetIdFromPath(parsed.flags.asset));
    const intendedRole = readIntendedRole(parsed.flags.intendedRole);
    const metadata = readGltfMetadata(resolve(parsed.flags.asset));
    const report = analyzeExternalAssetCompatibility({
      id: assetId,
      sourcePack: String(parsed.flags.sourcePack ?? 'external'),
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
    const role = readPieceRole(parsed.flags.role);
    const declaration = declareGameboardPieceFromCompatibility(report, {
      id: String(parsed.flags.pieceId ?? normalizePieceId(assetId)),
      assetId,
      tags: readCsv(parsed.flags.tags),
      ...(role ? { role } : {}),
    });
    const payload = parsed.flags.includeReport === true ? { declaration, report } : declaration;
    if (typeof parsed.flags.out === 'string') {
      writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      console.log(`Wrote piece declaration to ${safeResolveOutput(String(parsed.flags.out))}`);
    } else {
      console.log(JSON.stringify(payload, null, 2));
    }
    if (parsed.flags.failOnWarning === true && report.warnings.length > 0) {
      process.exit(1);
    }
    if (report.errors.length > 0) {
      process.exit(1);
    }
    return;
  }

  if (parsed.command === 'pieces-from-assets') {
    runPiecesFromAssets(parsed);
    return;
  }

  if (parsed.command === 'pieces') {
    if (typeof parsed.flags.pieces !== 'string') {
      throw new GameboardCliError('pieces requires --pieces <path>');
    }
    const registry = readPieceRegistry(resolve(parsed.flags.pieces));
    const fill = pieceFillFromFlags(parsed.flags);
    const shouldCheckFill = hasPieceFillFlags(parsed.flags);
    const placementInputFlags = ['plan', 'recipe', 'scenario'].filter(
      (key) => typeof parsed.flags[key] === 'string'
    );
    if (placementInputFlags.length > 1) {
      throw new GameboardCliError(
        'pieces placement inspection requires exactly one of --plan <path>, --recipe <path>, or --scenario <path>'
      );
    }
    const analysis = analyzeGameboardPieceRegistry(registry, {
      checks: shouldCheckFill
        ? [
            {
              id: fill.id ?? fill.ruleIdPrefix ?? 'cli-selection',
              mode: fill.mode,
              selection: fill.selection,
            },
          ]
        : [],
    });
    const rules =
      parsed.flags.emitRules === true && analysis.errors.length === 0
        ? createSeededGameboardPieceFillRules(registry, [fill])
        : undefined;
    const sourceUrls =
      parsed.flags.emitSourceUrls === true
        ? createGameboardPieceSourceUrlMap(registry, pieceSourceUrlOptionsFromFlags(parsed.flags))
        : undefined;
    const placementInspection =
      placementInputFlags.length === 1 && analysis.errors.length === 0
        ? inspectPiecesPlacementFromArgs(parsed, sourceRoot, edition, registry, fill)
        : undefined;
    if (placementInspection && typeof parsed.flags.outPlan === 'string') {
      const nextPlan = appendGameboardLayoutPlacementsToPlan(
        placementInspection.plan,
        placementInspection.inspection.placements
      );
      writeFileSync(
        safeResolveOutput(String(parsed.flags.outPlan)),
        `${JSON.stringify(nextPlan, null, 2)}\n`,
        'utf8'
      );
      console.log(`Wrote piece-filled GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`);
    }
    const payload =
      rules || sourceUrls || placementInspection
        ? {
            analysis,
            ...(rules ? { rules } : {}),
            ...(sourceUrls ? { sourceUrls } : {}),
            ...(placementInspection ? { placementInspection: placementInspection.inspection } : {}),
          }
        : analysis;
    if (typeof parsed.flags.out === 'string') {
      writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      console.log(`Wrote piece registry output to ${safeResolveOutput(String(parsed.flags.out))}`);
    } else if (parsed.flags.json === true || rules) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      printPieceRegistryAnalysis(analysis);
    }
    if (analysis.errors.length > 0) {
      process.exit(1);
    }
    if (
      placementInspection &&
      (placementInspection.inspection.errors.length > 0 ||
        placementInspection.inspection.analysis.errorCount > 0)
    ) {
      process.exit(1);
    }
    if (parsed.flags.failOnWarning === true && analysis.warnings.length > 0) {
      process.exit(1);
    }
    if (
      parsed.flags.failOnWarning === true &&
      placementInspection &&
      (placementInspection.inspection.warnings.length > 0 ||
        placementInspection.inspection.analysis.warningCount > 0)
    ) {
      process.exit(1);
    }
    return;
  }

  if (parsed.command === 'place-piece') {
    runPlacePiece(parsed, sourceRoot, edition);
    return;
  }

  if (parsed.command === 'extract') {
    const outputRoot = safeResolveOutput(
      String(parsed.flags.out ?? `kaykit-medieval-hexagon-${edition}`)
    );
    const assetRoot = join(outputRoot, 'assets');
    // `copyGltfTree` rmSyncs `assetRoot` before re-mirroring the upstream tree.
    // Refuse to wipe a non-empty existing destination without explicit --force
    // (PRD C1 / S-H1). The check runs on the destination FOLDER (assetRoot),
    // not the wrapping outputRoot, because that's the directory copyGltfTree
    // actually destroys.
    if (
      parsed.flags.force !== true &&
      existsSync(assetRoot) &&
      statSync(assetRoot).isDirectory() &&
      readdirSync(assetRoot).length > 0
    ) {
      throw new GameboardCliError(
        `extract destination ${relativizePath(assetRoot)} is not empty; pass --force to wipe.`
      );
    }
    copyGltfTree(sourceRoot, assetRoot);
    const manifest = generateManifestFromSource({
      sourceRoot,
      edition,
      assetBasePath: 'assets',
    });
    writeManifestJson(manifest, join(outputRoot, 'manifest.json'));
    console.log(`Extracted ${manifest.counts.total} ${edition} assets to ${outputRoot}`);
    return;
  }

  if (parsed.command === 'bootstrap') {
    void runBootstrap(parsed, edition).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exit(1);
    });
    return;
  }

  usage(1);
}

async function runBootstrap(parsed: ParsedArgs, edition: PackEdition): Promise<void> {
  const verifyOnly = parsed.flags.verify === true;
  const outFlag = typeof parsed.flags.out === 'string' ? parsed.flags.out : detectDefaultBootstrapOut();
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
    throw new GameboardCliError(`bootstrap --source must be 'github' or 'zip' (got: ${sourceFlag})`);
  }
  const source: BootstrapKayKitAssetsSource =
    sourceFlag === 'github'
      ? {
          kind: 'github',
          ...(typeof parsed.flags.commit === 'string' ? { commit: parsed.flags.commit } : {}),
        }
      : (() => {
          if (typeof parsed.flags.zip !== 'string') {
            throw new GameboardCliError("bootstrap --source zip requires --zip <path>");
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
 * Default `--out` heuristic. Prefers existing `public/assets/models` (Vite /
 * Next.js convention), then `assets/models`, then cwd. Cosmetic only: every
 * call still routes through {@link safeResolveOutput}.
 */
function detectDefaultBootstrapOut(): string {
  const cwd = process.cwd();
  const candidates = ['public/assets/models', 'assets/models'];
  for (const candidate of candidates) {
    if (existsSync(join(cwd, candidate))) {
      return candidate;
    }
  }
  if (existsSync(join(cwd, 'public'))) {
    return 'public/assets/models';
  }
  return 'assets/models';
}

function printBootstrapResult(result: BootstrapResult): void {
  console.log(`bootstrapped ${result.edition.toUpperCase()} edition`);
  console.log(`  ${result.fileCount} file(s), ${formatBytes(result.totalBytes)}`);
  console.log(`  root: ${relativizePath(result.outRoot)}`);
  console.log(`  sidecar: ${relativizePath(result.integritySidecar)}`);
}

function printBootstrapVerifyReport(report: BootstrapVerificationReport): void {
  if (report.ok) {
    console.log(`bootstrap verify OK (${relativizePath(report.sidecarPath)})`);
    return;
  }
  console.error(`bootstrap verify FAILED for ${relativizePath(report.sidecarPath)}`);
  for (const drift of report.drift) {
    console.error(`  ${drift}`);
  }
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KiB`;
  }
  return `${(value / 1024 / 1024).toFixed(2)} MiB`;
}

function readManifest(path: string): MedievalHexagonManifest {
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

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function inspectManifestPath(path: string): MedievalHexagonManifestInspection {
  return inspectMedievalHexagonManifest(readJson<unknown>(path));
}

function runValidateManifest(parsed: ParsedArgs): void {
  if (typeof parsed.flags.manifest !== 'string') {
    throw new GameboardCliError('validate-manifest requires --manifest <path>');
  }
  const manifestPath = resolve(parsed.flags.manifest);
  const inspection = inspectManifestPath(manifestPath);
  if (typeof parsed.flags.outManifest === 'string' && inspection.manifest) {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outManifest)),
      `${JSON.stringify(inspection.manifest, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote normalized manifest to ${safeResolveOutput(String(parsed.flags.outManifest))}`);
  }
  if (parsed.flags.json === true) {
    console.log(
      JSON.stringify(
        {
          manifest: manifestPath,
          errorCount: inspection.errorCount,
          warningCount: inspection.warningCount,
          counts: inspection.manifest?.counts,
          edition: inspection.manifest?.edition,
          textureSets: inspection.manifest?.textureSets,
          issues: inspection.issues,
        },
        null,
        2
      )
    );
  } else {
    printManifestInspection(manifestPath, inspection);
  }
  if (inspection.errorCount > 0) {
    process.exit(1);
  }
}

function validationCatalogFromArgs(
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
    assetBasePath: String(parsed.flags.assetBasePath ?? `assets/${edition}`),
  });
}

function validationConfigFromArgs(
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

function registryFromArgs(
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
          assetBasePath: String(parsed.flags.assetBasePath ?? `assets/${edition}`),
        });
  return createHexTileRegistryFromManifest(manifest);
}

function readRegistry(path: string): HexTileRegistry {
  const payload = readJson<HexTileDeclarationInput[] | { declarations: HexTileDeclarationInput[] }>(
    path
  );
  const declarations = Array.isArray(payload) ? payload : payload.declarations;
  if (!Array.isArray(declarations)) {
    throw new GameboardCliError(
      `Registry file ${relativizePath(path)} must be a declaration array or { "declarations": [...] }`
    );
  }
  return createHexTileRegistry(declarations);
}

function readPieceRegistry(path: string): GameboardPieceRegistry {
  const payload = readJson<
    | GameboardPieceDeclarationInput[]
    | GameboardPieceDeclarationInput
    | {
        pieces?: GameboardPieceDeclarationInput[];
        declarations?: GameboardPieceDeclarationInput[];
        declaration?: GameboardPieceDeclarationInput;
      }
  >(path);
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

function pieceOverridesFromArgs(
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
  const payload = readJson<
    Record<string, GameboardPieceCompatibilityDeclarationOptions> & {
      overrides?: Record<string, GameboardPieceCompatibilityDeclarationOptions>;
    }
  >(resolve(path));
  return payload.overrides ?? payload;
}

function runPiecesFromAssets(parsed: ParsedArgs): void {
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
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${pieces.length} piece declarations to ${safeResolveOutput(String(parsed.flags.out))}`);
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

function runBlueprint(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  const options = readBlueprintOptions(parsed.flags);
  const validationConfig = validationConfigFromArgs(parsed, sourceRoot, edition);
  const inspection = inspectMedievalGameboardBlueprint(options);
  const violations = validateGameboardPlan(inspection.plan, validationConfig);
  const scenarioInspection = shouldInspectBlueprintScenario(options, parsed.flags)
    ? inspectMedievalGameboardBlueprintScenario(options, { plan: validationConfig })
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
    console.log(`Wrote blueprint GameboardRecipe to ${safeResolveOutput(String(parsed.flags.outRecipe))}`);
  }
  if (typeof parsed.flags.outPlan === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(inspection.plan, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote blueprint GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`);
  }
  if (typeof parsed.flags.outScenario === 'string') {
    if (!scenarioInspection) {
      throw new GameboardCliError('blueprint --outScenario requires scenario options or --includeScenario');
    }
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outScenario)),
      `${JSON.stringify(scenarioInspection.scenario, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote blueprint GameboardScenario to ${safeResolveOutput(String(parsed.flags.outScenario))}`);
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
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
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

function runSnapshot(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
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
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    console.log(
      `Wrote interop snapshot with ${snapshot.entities.length} entities and ${snapshot.relations.length} relations to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  } else {
    console.log(JSON.stringify(snapshot, null, 2));
  }
}

function runSummarizePlan(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
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
    writeFileSync(safeResolveOutput(String(parsed.flags.outPlan)), `${JSON.stringify(input.plan, null, 2)}\n`, 'utf8');
    console.log(`Wrote compiled GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`);
  }

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
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

function runSummarizeScenario(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  if (typeof parsed.flags.scenario !== 'string') {
    throw new GameboardCliError('summarize-scenario requires --scenario <path>');
  }
  const scenarioPath = resolve(parsed.flags.scenario);
  const scenario = readJson<GameboardScenario>(scenarioPath);
  const summary = summarizeGameboardScenario(scenario, {
    plan: validationConfigFromArgs(parsed, sourceRoot, edition),
    topAssetLimit: summaryOptionsFromFlags(parsed.flags).topAssetLimit,
  });

  if (summary.validation.errorCount > 0 && parsed.flags.allowInvalid !== true) {
    printViolations(summary.validation.violations);
    process.exit(1);
  }

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
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

function runAnalyzeLayout(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
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
    writeFileSync(safeResolveOutput(String(parsed.flags.outPlan)), `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    console.log(`Wrote compiled GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`);
  }
  const options = readLayoutFillOptions(resolve(parsed.flags.rules), parsed.flags.seed);
  const analysis = analyzeGameboardLayoutFill(plan, options);
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(analysis, null, 2)}\n`, 'utf8');
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

function runSpawnGroups(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
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
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(spawnPlan, null, 2)}\n`, 'utf8');
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

function runPatrolRoutes(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
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
      ? readJson<GameboardScenario>(resolve(parsed.flags.scenario))
      : undefined;
  if (typeof parsed.flags.routes !== 'string' && !scenario?.patrolRoutes?.length) {
    throw new GameboardCliError('patrol-routes requires --routes <path> unless --scenario includes patrolRoutes');
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
  if (
    spawnGroups?.errors.length &&
    parsed.flags.allowInvalid !== true
  ) {
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
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(routeSet, null, 2)}\n`, 'utf8');
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

function runPatrolScript(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  const scenario =
    typeof parsed.flags.scenario === 'string'
      ? readJson<GameboardScenario>(resolve(parsed.flags.scenario))
      : undefined;
  const routeSet = patrolRouteSetFromArgs(parsed, sourceRoot, edition, scenario);
  const scriptPlan = createGameboardPatrolSimulationScript({
    routes: routeSet,
    assignments: readPatrolSimulationAssignments(parsed),
    requireFoundRoutes: parsed.flags.allowInvalid !== true,
  });

  const payload = parsed.flags.includeReport === true ? scriptPlan : scriptPlan.script;
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
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

function runPlacePiece(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
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
    writeFileSync(safeResolveOutput(String(parsed.flags.outPlan)), `${JSON.stringify(nextPlan, null, 2)}\n`, 'utf8');
    console.log(`Wrote placed GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`);
  }
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(inspection, null, 2)}\n`, 'utf8');
    console.log(`Wrote piece placement inspection to ${safeResolveOutput(String(parsed.flags.out))}`);
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

function inspectPiecesPlacementFromArgs(
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

function layoutAnalysisPlanFromArgs(
  parsed: ParsedArgs,
  validationConfig: GameboardPlanValidationConfig,
  allowInvalid: boolean
): {
  plan: GameboardPlan;
  violations: ReadonlyArray<ReturnType<typeof validateGameboardPlan>[number]>;
} {
  if (typeof parsed.flags.plan === 'string') {
    return {
      plan: readJson<GameboardPlan>(resolve(parsed.flags.plan)),
      violations: [],
    };
  }
  if (typeof parsed.flags.recipe === 'string') {
    const recipe = readJson<GameboardRecipe>(resolve(parsed.flags.recipe));
    const inspection = inspectGameboardRecipe(recipe, { plan: validationConfig });
    if (!inspection.plan) {
      if (!allowInvalid) {
        printViolations(inspection.violations);
        process.exit(1);
      }
      throw new GameboardCliError(`Recipe ${relativizePath(String(parsed.flags.recipe))} did not compile to a GameboardPlan`);
    }
    return {
      plan: inspection.plan,
      violations: inspection.violations,
    };
  }
  const scenarioPath = String(parsed.flags.scenario);
  const scenario = readJson<GameboardScenario>(resolve(scenarioPath));
  const inspection = inspectGameboardScenario(scenario, { plan: validationConfig });
  if (!inspection.plan) {
    if (!allowInvalid) {
      printViolations(inspection.violations);
      process.exit(1);
    }
    throw new GameboardCliError(`Scenario ${relativizePath(scenarioPath)} did not compile to a GameboardPlan`);
  }
  return {
    plan: inspection.plan,
    violations: inspection.violations,
  };
}

function summaryPlanFromArgs(
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
    const plan = readJson<GameboardPlan>(path);
    return {
      source: { kind: 'plan', path },
      plan,
      violations: validateGameboardPlan(plan, validationConfig),
    };
  }

  if (typeof parsed.flags.recipe === 'string') {
    const path = resolve(parsed.flags.recipe);
    const inspection = inspectGameboardRecipe(readJson<GameboardRecipe>(path), {
      plan: validationConfig,
    });
    if (!inspection.plan) {
      if (!allowInvalid) {
        printViolations(inspection.violations);
        process.exit(1);
      }
      throw new GameboardCliError(`Recipe ${relativizePath(path)} did not compile to a GameboardPlan`);
    }
    return {
      source: { kind: 'recipe', path },
      plan: inspection.plan,
      violations: inspection.violations,
    };
  }

  if (typeof parsed.flags.scenario === 'string') {
    const path = resolve(parsed.flags.scenario);
    const inspection = inspectGameboardScenario(readJson<GameboardScenario>(path), {
      plan: validationConfig,
    });
    if (!inspection.plan) {
      if (!allowInvalid) {
        printViolations(inspection.violations);
        process.exit(1);
      }
      throw new GameboardCliError(`Scenario ${relativizePath(path)} did not compile to a GameboardPlan`);
    }
    return {
      source: { kind: 'scenario', path },
      plan: inspection.plan,
      violations: inspection.violations,
    };
  }

  const path = resolve(String(blueprintPath));
  const inspection = inspectMedievalGameboardBlueprint(readBlueprintOptions(parsed.flags));
  return {
    source: { kind: 'blueprint', path },
    plan: inspection.plan,
    violations: validateGameboardPlan(inspection.plan, validationConfig),
  };
}

function summaryOptionsFromFlags(
  flags: Record<string, string | boolean>
): SummarizeGameboardPlanOptions {
  const topAssetLimit = readNumberFlag(flags.topAssetLimit ?? flags.topAssets);
  return topAssetLimit === undefined ? {} : { topAssetLimit };
}

function routePlanningPlanFromArgs(
  parsed: ParsedArgs,
  validationConfig: GameboardPlanValidationConfig,
  allowInvalid: boolean,
  scenario: GameboardScenario | undefined
): {
  plan: GameboardPlan;
  violations: ReadonlyArray<ReturnType<typeof validateGameboardPlan>[number]>;
} {
  if (typeof parsed.flags.plan === 'string') {
    return {
      plan: readJson<GameboardPlan>(resolve(parsed.flags.plan)),
      violations: [],
    };
  }
  const recipe =
    scenario?.board ??
    (typeof parsed.flags.recipe === 'string'
      ? readJson<GameboardRecipe>(resolve(parsed.flags.recipe))
      : undefined);
  if (!recipe) {
    throw new GameboardCliError(`Scenario ${relativizePath(String(parsed.flags.scenario))} did not include a board recipe`);
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

function patrolSpawnGroupsFromArgs(
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

function patrolRouteSetFromArgs(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition,
  scenario: GameboardScenario | undefined
): GameboardPatrolRouteSet {
  if (typeof parsed.flags.routes === 'string') {
    const payload = readJson<unknown>(resolve(parsed.flags.routes));
    if (isPatrolRouteSet(payload)) {
      return payload;
    }
  }

  if (!scenario?.patrolRoutes?.length && typeof parsed.flags.routes !== 'string') {
    throw new GameboardCliError('patrol-script requires --routes <path> or --scenario <path> with patrolRoutes');
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
  if (
    spawnGroups?.errors.length &&
    parsed.flags.allowInvalid !== true
  ) {
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

function readPatrolSimulationAssignments(
  parsed: ParsedArgs
): readonly GameboardPatrolSimulationActorAssignment[] {
  const rounds = readNumberFlag(parsed.flags.rounds);
  if (typeof parsed.flags.assignments === 'string') {
    const payload = readJson<unknown>(resolve(parsed.flags.assignments));
    const assignments = Array.isArray(payload)
      ? (payload as readonly GameboardPatrolSimulationActorAssignment[])
      : isRecord(payload) && Array.isArray(payload.assignments)
        ? (payload.assignments as readonly GameboardPatrolSimulationActorAssignment[])
        : undefined;
    if (!Array.isArray(assignments)) {
      throw new GameboardCliError(`Patrol assignment file ${relativizePath(String(parsed.flags.assignments))} must be an array or { "assignments": [...] }`);
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
  throw new GameboardCliError('patrol-script requires --assignments <path> or both --routeId <id> and --actorId <id>');
}

function runValidateSimulation(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  if (typeof parsed.flags.scenario !== 'string') {
    throw new GameboardCliError('validate-simulation requires --scenario <path>');
  }
  if (typeof parsed.flags.script !== 'string') {
    throw new GameboardCliError('validate-simulation requires --script <path>');
  }

  const scenario = readJson<GameboardScenario>(resolve(parsed.flags.scenario));
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
    console.log(`Wrote compiled GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`);
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

function runGuidePermutations(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  const permutations = listGuideTilePermutations();
  const catalog = validationCatalogFromArgs(parsed, sourceRoot, edition);
  const missingAssetIds = catalog
    ? [
        ...new Set(
          permutations
            .map((permutation) => permutation.assetId)
            .filter((assetId) => !catalog.assetsById[assetId])
        ),
      ]
    : [];
  const payload = {
    schemaVersion: '1.0.0',
    count: permutations.length,
    counts: countGuidePermutationsByKind(permutations),
    missingAssetIds,
    permutations,
  };

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${permutations.length} guide permutations to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true || parsed.flags.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`guide permutations: ${permutations.length}`);
    for (const [kind, count] of Object.entries(payload.counts)) {
      console.log(`${kind}: ${count}`);
    }
    if (catalog) {
      console.log(`missing assets: ${missingAssetIds.length}`);
      for (const assetId of missingAssetIds) {
        console.log(`  - ${assetId}`);
      }
    }
  }

  if (missingAssetIds.length > 0) {
    process.exit(1);
  }
}

function runGuideScenarios(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
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
    throw new GameboardCliError('guide-scenarios selection did not match any extracted guide scenarios');
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
      freeOccurrences: occurrenceTreatments.filter((treatment) => treatment.minimumEdition === 'free').length,
      extraOccurrences: occurrenceTreatments.filter((treatment) => treatment.minimumEdition === 'extra').length,
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
      console.log(`Wrote ${scenarios.length} guide scenario markdown rows to ${safeResolveOutput(String(parsed.flags.out))}`);
    } else {
      process.stdout.write(markdown);
    }
    if (missingAssetIds.length > 0) {
      process.exit(1);
    }
    return;
  }

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${scenarios.length} guide scenarios to ${safeResolveOutput(String(parsed.flags.out))}`);
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

function runGuideUsages(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  const scenarioFilter = readCsv(parsed.flags.scenarioId ?? parsed.flags.scenario);
  const pageFilter = readGuideScenarioPageFilter(parsed.flags.page);
  const editionFilter = readGuideScenarioEditionFilter(parsed.flags.editionScope);
  const publicApiFilter = readCsv(parsed.flags.publicApi);
  const roleFilter = readGuideUsageRoleFilter(parsed.flags.role ?? parsed.flags.guideRole);
  const assetIdFilter = readGuideAssetIdFilter(parsed);
  const categoryFilter = readGuideUsageCategoryFilter(parsed.flags.category ?? parsed.flags.categories);
  const minimumEdition = readGuideUsageMinimumEdition(
    parsed.flags.minimumEdition ?? parsed.flags.assetEdition
  );
  const usages = listKayKitGuideScenarioAssetUsages({
    scenarioIds: scenarioFilter,
    pages: pageFilter,
    editionScope: editionFilter.length > 0 ? editionFilter : undefined,
    minimumEdition,
    assetIds: assetIdFilter,
    roles: roleFilter,
    categories: categoryFilter,
    publicApis: publicApiFilter,
  });
  if (usages.length === 0) {
    throw new GameboardCliError('guide-usages selection did not match any guide scenario asset usages');
  }

  const catalog = validationCatalogFromArgs(parsed, sourceRoot, edition);
  const assetIds = uniqueStrings(usages.map((usage) => usage.assetId));
  const missingAssetIds = catalog
    ? assetIds.filter((assetId) => !catalog.assetsById[assetId])
    : [];
  const pages = [...new Set(usages.map((usage) => usage.page))].sort((a, b) => a - b);
  const scenarioIds = uniqueStrings(usages.map((usage) => usage.scenarioId));
  const sourceImages = uniqueStrings(usages.map((usage) => usage.sourceImage));
  const docs = uniqueStrings(usages.flatMap((usage) => usage.docs));
  const visualArtifacts = uniqueStrings(usages.flatMap((usage) => usage.visualArtifacts));
  const freeCount = usages.filter((usage) => usage.minimumEdition === 'free').length;
  const extraCount = usages.filter((usage) => usage.minimumEdition === 'extra').length;
  const payload = {
    schemaVersion: '1.0.0',
    count: usages.length,
    occurrenceCounts: {
      total: usages.length,
      free: freeCount,
      extra: extraCount,
      uniqueAssets: assetIds.length,
      scenarios: scenarioIds.length,
      pages: pages.length,
      missing: missingAssetIds.length,
    },
    selection: {
      scenarioIds: scenarioFilter,
      pages: pageFilter,
      editions: editionFilter,
      publicApis: publicApiFilter,
      roles: roleFilter,
      assetIds: assetIdFilter,
      categories: categoryFilter,
      minimumEdition,
    },
    pages,
    scenarioIds,
    assetIds,
    sourceImages,
    docs,
    visualArtifacts,
    missingAssetIds,
    usages,
  };

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${usages.length} guide usage rows to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true || parsed.flags.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`guide usage rows: ${usages.length}`);
    console.log(`pages: ${formatGuideScenarioPages(pages)}`);
    console.log(`scenarios: ${scenarioIds.length}`);
    console.log(`unique assets: ${assetIds.length}`);
    console.log(`asset occurrences: ${freeCount} free, ${extraCount} extra`);
    if (catalog) {
      console.log(`missing assets: ${missingAssetIds.length}`);
      for (const assetId of missingAssetIds) {
        console.log(`  - ${assetId}`);
      }
    }
    for (const usage of usages.slice(0, 20)) {
      console.log(formatGuideUsageLine(usage));
    }
    if (usages.length > 20) {
      console.log(`...${usages.length - 20} more`);
    }
  }

  if (missingAssetIds.length > 0) {
    process.exit(1);
  }
}

function runGuideRenderRequests(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  const scenarioFilter = readCsv(parsed.flags.scenarioId ?? parsed.flags.scenario);
  const pageFilter = readGuideScenarioPageFilter(parsed.flags.page);
  const editionFilter = readGuideScenarioEditionFilter(parsed.flags.editionScope);
  const publicApiFilter = readCsv(parsed.flags.publicApi);
  const roleFilter = readGuideUsageRoleFilter(parsed.flags.role ?? parsed.flags.guideRole);
  const assetIdFilter = readGuideAssetIdFilter(parsed);
  const categoryFilter = readGuideUsageCategoryFilter(parsed.flags.category ?? parsed.flags.categories);
  const minimumEdition = readGuideUsageMinimumEdition(
    parsed.flags.minimumEdition ?? parsed.flags.assetEdition
  );
  const assetBaseUrl =
    typeof parsed.flags.assetBaseUrl === 'string' ? parsed.flags.assetBaseUrl : undefined;
  const requestOptions = {
    scenarioIds: scenarioFilter,
    pages: pageFilter,
    minimumEdition,
    assetIds: assetIdFilter,
    roles: roleFilter,
    categories: categoryFilter,
    publicApis: publicApiFilter,
    ...(editionFilter.length > 0 ? { editionScope: editionFilter } : {}),
    ...(assetBaseUrl !== undefined ? { assetBaseUrl } : {}),
  };
  const requests = listKayKitGuideScenarioAssetRenderRequests(requestOptions);
  if (requests.length === 0) {
    throw new GameboardCliError('guide-render-requests selection did not match any guide scenario asset render requests');
  }

  const groups = listKayKitGuideScenarioAssetRenderGroups(requestOptions);
  const catalog = validationCatalogFromArgs(parsed, sourceRoot, edition);
  const assetIds = uniqueStrings(requests.map((request) => request.assetId));
  const missingAssetIds = catalog
    ? assetIds.filter((assetId) => !catalog.assetsById[assetId])
    : [];
  const pages = [...new Set(requests.map((request) => request.page))].sort((a, b) => a - b);
  const scenarioIds = uniqueStrings(requests.map((request) => request.scenarioId));
  const sourceImages = uniqueStrings(requests.map((request) => request.sourceImage));
  const freeCount = requests.filter((request) => request.minimumEdition === 'free').length;
  const extraCount = requests.filter((request) => request.minimumEdition === 'extra').length;
  const includeGroups =
    parsed.flags.groups === true ||
    parsed.flags.grouped === true ||
    parsed.flags.includeGroups === true;
  const payload = {
    schemaVersion: '1.0.0',
    count: requests.length,
    groupCount: groups.length,
    render: {
      assetBaseUrl: assetBaseUrl ?? null,
      urlResolvedCount: requests.filter((request) => request.url !== undefined).length,
    },
    occurrenceCounts: {
      total: requests.length,
      free: freeCount,
      extra: extraCount,
      uniqueAssets: assetIds.length,
      scenarios: scenarioIds.length,
      pages: pages.length,
      missing: missingAssetIds.length,
    },
    selection: {
      scenarioIds: scenarioFilter,
      pages: pageFilter,
      editions: editionFilter,
      publicApis: publicApiFilter,
      roles: roleFilter,
      assetIds: assetIdFilter,
      categories: categoryFilter,
      minimumEdition,
    },
    pages,
    scenarioIds,
    assetIds,
    sourceImages,
    missingAssetIds,
    requests,
    ...(includeGroups ? { groups } : {}),
  };

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${requests.length} guide render requests to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true || parsed.flags.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`guide render requests: ${requests.length}`);
    console.log(`groups: ${groups.length}`);
    console.log(`pages: ${formatGuideScenarioPages(pages)}`);
    console.log(`scenarios: ${scenarioIds.length}`);
    console.log(`unique assets: ${assetIds.length}`);
    console.log(`asset occurrences: ${freeCount} free, ${extraCount} extra`);
    console.log(`asset base URL: ${assetBaseUrl ?? '<none>'}`);
    if (catalog) {
      console.log(`missing assets: ${missingAssetIds.length}`);
      for (const assetId of missingAssetIds) {
        console.log(`  - ${assetId}`);
      }
    }
    for (const group of groups.slice(0, 10)) {
      console.log(formatGuideRenderGroupLine(group));
    }
    if (groups.length > 10) {
      console.log(`...${groups.length - 10} more groups`);
    }
    for (const request of requests.slice(0, 10)) {
      console.log(formatGuideRenderRequestLine(request));
    }
    if (requests.length > 10) {
      console.log(`...${requests.length - 10} more requests`);
    }
  }

  if (missingAssetIds.length > 0) {
    process.exit(1);
  }
}

function runGuidePublicApis(parsed: ParsedArgs): void {
  const publicApiFilter = readCsv(parsed.flags.publicApi);
  const coverages = filterGuidePublicApiCoverages(listKayKitGuidePublicApiCoverages(), publicApiFilter);
  if (coverages.length === 0) {
    throw new GameboardCliError('guide-apis selection did not match any public API coverage records');
  }
  const payload = {
    schemaVersion: '1.0.0',
    count: coverages.length,
    selection: { publicApis: publicApiFilter },
    publicApis: coverages.map((coverage) => coverage.publicApi),
    coverage: coverages,
    ...(publicApiFilter.length === 1
      ? { selected: describeKayKitGuidePublicApiCoverage(publicApiFilter[0] ?? '') }
      : {}),
  };

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${coverages.length} guide public API coverages to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true || parsed.flags.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`guide public APIs: ${coverages.length}`);
    for (const coverage of coverages.slice(0, 20)) {
      console.log(
        `${coverage.publicApi}: pages ${formatGuideScenarioPages(coverage.pages)}, assets ${coverage.assetCounts.unique}`
      );
    }
    if (coverages.length > 20) {
      console.log(`...${coverages.length - 20} more`);
    }
  }
}

function runGuideAssets(parsed: ParsedArgs): void {
  const assetIdFilter = readGuideAssetIdFilter(parsed);
  const scenarioFilter = readCsv(parsed.flags.scenarioId ?? parsed.flags.scenario);
  const pageFilter = readGuideScenarioPageFilter(parsed.flags.page);
  const editionFilter = readGuideScenarioEditionFilter(parsed.flags.editionScope);
  const publicApiFilter = readCsv(parsed.flags.publicApi);
  const roleFilter = readCsv(parsed.flags.role ?? parsed.flags.guideRole);
  const coverages = filterGuideAssetCoverages(listKayKitGuideAssetCoverages(), {
    assetIds: assetIdFilter,
    scenarioIds: scenarioFilter,
    pages: pageFilter,
    editions: editionFilter,
    publicApis: publicApiFilter,
    roles: roleFilter,
  });
  if (coverages.length === 0) {
    throw new GameboardCliError('guide-assets selection did not match any public asset coverage records');
  }
  const payload = {
    schemaVersion: '1.0.0',
    count: coverages.length,
    selection: {
      assetIds: assetIdFilter,
      scenarioIds: scenarioFilter,
      pages: pageFilter,
      editions: editionFilter,
      publicApis: publicApiFilter,
      roles: roleFilter,
    },
    assetIds: coverages.map((coverage) => coverage.assetId),
    coverage: coverages,
    ...(assetIdFilter.length === 1 ? { selected: describeKayKitGuideAssetCoverage(assetIdFilter[0] ?? '') } : {}),
  };

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${coverages.length} guide asset coverages to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true || parsed.flags.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`guide assets: ${coverages.length}`);
    for (const coverage of coverages.slice(0, 20)) {
      console.log(
        `${coverage.assetId}: ${coverage.role}, pages ${formatGuideScenarioPages(coverage.pages)}, APIs ${coverage.publicApi.length}`
      );
    }
    if (coverages.length > 20) {
      console.log(`...${coverages.length - 20} more`);
    }
  }
}

function runGuideRoles(parsed: ParsedArgs): void {
  const roleFilter = readCsv(parsed.flags.role ?? parsed.flags.guideRole);
  const coverages = filterGuideRoleCoverages(listKayKitGuideRoleCoverages(), roleFilter);
  if (coverages.length === 0) {
    throw new GameboardCliError('guide-roles selection did not match any public role coverage records');
  }
  const payload = {
    schemaVersion: '1.0.0',
    count: coverages.length,
    selection: { roles: roleFilter },
    roles: coverages.map((coverage) => coverage.role),
    coverage: coverages,
    ...(roleFilter.length === 1 ? { selected: describeKayKitGuideRoleCoverage(roleFilter[0] ?? '') } : {}),
  };

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${coverages.length} guide role coverages to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true || parsed.flags.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`guide public roles: ${coverages.length}`);
    for (const coverage of coverages.slice(0, 20)) {
      console.log(
        `${coverage.role}: pages ${formatGuideScenarioPages(coverage.pages)}, assets ${coverage.assetCounts.unique}, APIs ${coverage.publicApi.length}`
      );
    }
    if (coverages.length > 20) {
      console.log(`...${coverages.length - 20} more`);
    }
  }
}

function runCoverage(parsed: ParsedArgs): void {
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
    packageChecks: createDefaultGameboardCoveragePackageChecks(
      checksPassed ? 'passed' : 'not-run'
    ),
    simpleRpgEvidence: createCliSimpleRpgEvidence(),
  });
  const markdown =
    parsed.flags.markdown === true ? renderGameboardCoverageMarkdown(report) : undefined;

  if (typeof parsed.flags.outJson === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.outJson)), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Wrote coverage JSON to ${safeResolveOutput(String(parsed.flags.outJson))}`);
  }
  if (typeof parsed.flags.outMarkdown === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outMarkdown)),
      `${renderGameboardCoverageMarkdown(report)}\n`,
      'utf8'
    );
    console.log(`Wrote coverage Markdown to ${safeResolveOutput(String(parsed.flags.outMarkdown))}`);
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

function createCliSimpleRpgEvidence(): GameboardCoverageSimpleRpgEvidence {
  const exerciseCoverage = summarizeSimpleRpgGuidePublicApiExercises();
  const executableSmoke = runSimpleRpgExecutableGuideApiSmoke();
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
    activeEvidenceModes: evidenceModeEntries
      .filter(([, count]) => count > 0)
      .map(([mode]) => mode),
    inactiveEvidenceModes: evidenceModeEntries
      .filter(([, count]) => count <= 0)
      .map(([mode]) => mode),
    publicApiExercises: listSimpleRpgGuidePublicApiExercises(),
  };
}

function coveragePathStatuses(): GameboardCoveragePathStatusInput {
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

function statusMapForPaths(paths: readonly string[]): Record<string, GameboardCoverageStatus> {
  return Object.fromEntries(
    paths.map((path) => [path, existsSync(resolve(path)) ? 'available' : 'missing'])
  );
}

function printCoverageSummary(report: GameboardCoverageReport): void {
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
    console.log(`- ${gap.severity} ${gap.code}: ${gap.subject ? `${gap.subject}: ` : ''}${gap.message}`);
  }
  if (report.gaps.length > 20) {
    console.log(`...${report.gaps.length - 20} more gap(s)`);
  }
}

function countCoverageStatus<T extends { status: GameboardCoverageStatus }>(
  values: readonly T[],
  status: GameboardCoverageStatus
): number {
  return values.filter((value) => value.status === status).length;
}

function readGuideScenarioPageFilter(value: string | boolean | undefined): number[] {
  return readCsv(value).map((page) => {
    const parsedPage = Number(page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      throw new GameboardCliError(`Expected --page to contain one-based guide page numbers, received ${page}`);
    }
    return parsedPage;
  });
}

function readGuideScenarioEditionFilter(
  value: string | boolean | undefined
): Array<KayKitGuideScenario['edition']> {
  return readCsv(value).map((edition) => {
    if (edition === 'free' || edition === 'extra' || edition === 'mixed' || edition === 'reference') {
      return edition;
    }
    throw new GameboardCliError(
      `Expected --editionScope to contain free, extra, mixed, or reference, received ${edition}`
    );
  });
}

function readGuideAssetIdFilter(parsed: ParsedArgs): string[] {
  return uniqueStrings([
    ...readCsv(parsed.flags.assetId),
    ...readCsv(parsed.flags.assetIds),
  ]);
}

function readGuideUsageMinimumEdition(value: string | boolean | undefined): PackEdition | 'all' {
  if (value === undefined || value === false) {
    return 'all';
  }
  if (value === 'free' || value === 'extra' || value === 'all') {
    return value;
  }
  throw new GameboardCliError(`Expected --minimumEdition to contain free, extra, or all, received ${String(value)}`);
}

function readGuideUsageCategoryFilter(value: string | boolean | undefined): AssetCategory[] {
  return readCsv(value).map((category) => {
    if (category === 'tiles' || category === 'buildings' || category === 'decoration' || category === 'units') {
      return category;
    }
    throw new GameboardCliError(`Expected --category to contain tiles, buildings, decoration, or units, received ${category}`);
  });
}

function readGuideUsageRoleFilter(value: string | boolean | undefined): KayKitAssetPublicRole[] {
  const validRoles = new Set(listKayKitGuideRoleCoverages().map((coverage) => coverage.role));
  return readCsv(value).map((role) => {
    if (validRoles.has(role as KayKitAssetPublicRole)) {
      return role as KayKitAssetPublicRole;
    }
    throw new GameboardCliError(`Expected --role to contain a known guide asset role, received ${role}`);
  });
}

function formatGuideUsageLine(usage: KayKitGuideScenarioAssetUsage): string {
  return `${usage.label}: ${usage.role}, ${usage.minimumEdition}, ${usage.sourcePath}`;
}

function formatGuideRenderGroupLine(group: KayKitGuideScenarioAssetRenderGroup): string {
  return `page ${group.page}: ${group.count} render request(s), ${group.scenarioId}`;
}

function formatGuideRenderRequestLine(request: KayKitGuideScenarioAssetRenderRequest): string {
  return `${request.label}: ${request.role}, ${request.url ?? request.sourcePath}`;
}

function filterGuideScenarios(
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

function filterGuideAssetCoverages(
  coverages: readonly KayKitGuideAssetCoverage[],
  filters: {
    assetIds: readonly string[];
    scenarioIds: readonly string[];
    pages: readonly number[];
    editions: ReadonlyArray<KayKitGuideScenario['edition']>;
    publicApis: readonly string[];
    roles: readonly string[];
  }
): KayKitGuideAssetCoverage[] {
  const assetIds = new Set(filters.assetIds);
  const scenarioIds = new Set(filters.scenarioIds);
  const pages = new Set(filters.pages);
  const editions = new Set(filters.editions);
  const publicApis = new Set(filters.publicApis);
  const roles = new Set(filters.roles);
  return coverages.filter((coverage) => {
    if (assetIds.size > 0 && !assetIds.has(coverage.assetId)) {
      return false;
    }
    if (scenarioIds.size > 0 && !coverage.scenarioIds.some((scenarioId) => scenarioIds.has(scenarioId))) {
      return false;
    }
    if (pages.size > 0 && !coverage.pages.some((page) => pages.has(page))) {
      return false;
    }
    if (
      editions.size > 0 &&
      !editions.has(coverage.minimumEdition) &&
      !coverage.editions.some((edition) => editions.has(edition))
    ) {
      return false;
    }
    if (publicApis.size > 0 && !coverage.publicApi.some((publicApi) => publicApis.has(publicApi))) {
      return false;
    }
    if (roles.size > 0 && !roles.has(coverage.role)) {
      return false;
    }
    return true;
  });
}

function filterGuidePublicApiCoverages(
  coverages: readonly KayKitGuidePublicApiCoverage[],
  publicApis: readonly string[]
): KayKitGuidePublicApiCoverage[] {
  const publicApiSet = new Set(publicApis);
  return coverages.filter((coverage) => publicApiSet.size === 0 || publicApiSet.has(coverage.publicApi));
}

function filterGuideRoleCoverages(
  coverages: readonly KayKitGuideRoleCoverage[],
  roles: readonly string[]
): KayKitGuideRoleCoverage[] {
  const roleSet = new Set(roles);
  return coverages.filter((coverage) => roleSet.size === 0 || roleSet.has(coverage.role));
}

function countGuideScenarioAssetsByEdition(
  assetIds: readonly string[],
  treatmentByAssetId: ReadonlyMap<string, KayKitAssetPublicTreatment>,
  edition: PackEdition
): number {
  return assetIds.filter((assetId) => treatmentByAssetId.get(assetId)?.minimumEdition === edition).length;
}

function formatGuideScenarioPages(pages: readonly number[]): string {
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

function countGuidePermutationsByKind(
  permutations: readonly { kind: GuideTilePermutationKind }[]
): Record<GuideTilePermutationKind, number> {
  const counts: Record<GuideTilePermutationKind, number> = {
    road: 0,
    river: 0,
    'river-curvy': 0,
    'river-crossing': 0,
    coast: 0,
  };
  for (const permutation of permutations) {
    counts[permutation.kind] += 1;
  }
  return counts;
}

function runSimulateScenario(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  if (typeof parsed.flags.scenario !== 'string') {
    throw new GameboardCliError('simulate-scenario requires --scenario <path>');
  }
  if (typeof parsed.flags.script !== 'string') {
    throw new GameboardCliError('simulate-scenario requires --script <path>');
  }

  const scenario = readJson<GameboardScenario>(resolve(parsed.flags.scenario));
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
    console.log(`Wrote final simulated GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`);
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
    console.log(`Wrote simulation interop snapshot to ${safeResolveOutput(String(parsed.flags.outInterop))}`);
  }
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Wrote scenario simulation report to ${safeResolveOutput(String(parsed.flags.out))}`);
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

function readBlueprintOptions(
  flags: Record<string, string | boolean>
): MedievalGameboardBlueprintScenarioOptions {
  const configPath =
    typeof flags.blueprint === 'string'
      ? flags.blueprint
      : typeof flags.config === 'string'
        ? flags.config
        : undefined;
  const fileOptions = configPath ? readBlueprintOptionsFile(resolve(configPath)) : {};
  const cliOptions: MedievalGameboardBlueprintScenarioOptions = {};
  const width = readNumberFlag(flags.width);
  const height = readNumberFlag(flags.height);
  const radius = readNumberFlag(flags.radius);

  if (typeof flags.seed === 'string') {
    cliOptions.seed = flags.seed;
  }
  if (typeof flags.faction === 'string') {
    cliOptions.faction = flags.faction as MedievalGameboardBlueprintOptions['faction'];
  }
  if (typeof flags.textureSet === 'string') {
    cliOptions.textureSet = flags.textureSet as MedievalGameboardBlueprintOptions['textureSet'];
  }
  if (typeof flags.defaultTerrain === 'string') {
    cliOptions.defaultTerrain =
      flags.defaultTerrain as MedievalGameboardBlueprintOptions['defaultTerrain'];
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

function readBlueprintOptionsFile(path: string): MedievalGameboardBlueprintScenarioOptions {
  const payload = readJson<unknown>(path);
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
  return options as unknown as MedievalGameboardBlueprintScenarioOptions;
}

function blueprintPayloadFromInspection(
  inspection: MedievalGameboardBlueprintInspection,
  violations: ReadonlyArray<ReturnType<typeof validateGameboardPlan>[number]>,
  flags: Record<string, string | boolean>,
  scenarioInspection?: MedievalGameboardBlueprintScenarioInspection,
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

function shouldInspectBlueprintScenario(
  options: MedievalGameboardBlueprintScenarioOptions,
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

function shouldEmitBlueprintInterop(flags: Record<string, string | boolean>): boolean {
  return typeof flags.outInterop === 'string' || flags.includeInterop === true;
}

function createBlueprintScenarioInteropSnapshot(
  parsed: ParsedArgs,
  scenarioInspection: MedievalGameboardBlueprintScenarioInspection | undefined
): GameboardInteropSnapshot {
  if (!scenarioInspection) {
    throw new GameboardCliError('blueprint interop output requires a generated blueprint scenario');
  }
  return createGameboardScenarioInteropSnapshot(
    scenarioInspection.scenario,
    snapshotOptionsFromFlags(parsed.flags)
  );
}

function hasBlueprintScenarioContent(options: MedievalGameboardBlueprintScenarioOptions): boolean {
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

function readSimulationScript(path: string): GameboardScenarioSimulationScript {
  const payload = readJson<unknown>(path);
  if (Array.isArray(payload)) {
    return {
      schemaVersion: '1.0.0',
      steps: payload as GameboardScenarioSimulationStep[],
    };
  }
  if (!isRecord(payload) || !Array.isArray(payload.steps)) {
    throw new GameboardCliError(`Simulation script ${relativizePath(path)} must be a step array or { "steps": [...] }`);
  }
  return payload as unknown as GameboardScenarioSimulationScript;
}

function readLayoutFillOptions(
  path: string,
  seedOverride: string | boolean | undefined
): GameboardLayoutFillOptions {
  const payload = readJson<unknown>(path);
  const rules = Array.isArray(payload)
    ? (payload as readonly GameboardLayoutFillRule[])
    : isRecord(payload) && Array.isArray(payload.rules)
      ? (payload.rules as readonly GameboardLayoutFillRule[])
      : undefined;
  if (!Array.isArray(rules)) {
    throw new GameboardCliError(`Layout rules file ${relativizePath(path)} must be a rule array or { "rules": [...] }`);
  }
  const fileSeed = isRecord(payload) && typeof payload.seed === 'string' ? payload.seed : undefined;
  return {
    seed: typeof seedOverride === 'string' ? seedOverride : fileSeed,
    rules,
  };
}

function readSpawnGroupOptions(
  path: string,
  seedOverride: string | boolean | undefined
): GameboardSpawnGroupOptions {
  const payload = readJson<unknown>(path);
  const groups = Array.isArray(payload)
    ? (payload as GameboardSpawnGroupOptions['groups'])
    : isRecord(payload) && Array.isArray(payload.groups)
      ? (payload.groups as GameboardSpawnGroupOptions['groups'])
      : undefined;
  if (!Array.isArray(groups)) {
    throw new GameboardCliError(`Spawn group file ${relativizePath(path)} must be a group array or { "groups": [...] }`);
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

function readPatrolRouteOptions(
  path: string,
  seedOverride: string | boolean | undefined
): Omit<GameboardPatrolRouteSetOptions, 'spawnGroups'> {
  const payload = readJson<unknown>(path);
  const routes = Array.isArray(payload)
    ? (payload as readonly GameboardPatrolRouteRule[])
    : isRecord(payload) && Array.isArray(payload.routes)
      ? (payload.routes as readonly GameboardPatrolRouteRule[])
      : undefined;
  if (!Array.isArray(routes)) {
    throw new GameboardCliError(`Patrol route file ${relativizePath(path)} must be a route array or { "routes": [...] }`);
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

function printSimulationReport(
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

function actorTargetRecordSummary(
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

function mutationStatus(
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

function printSimulationExpectationFailures(
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

function snapshotFromPlan(
  path: string,
  validationConfig: GameboardPlanValidationConfig,
  options: GameboardScenarioInteropOptions,
  allowInvalid: boolean
) {
  const plan = readJson<GameboardPlan>(resolve(path));
  const violations = validateGameboardPlan(plan, validationConfig);
  failOnSnapshotViolations(violations, allowInvalid);
  return createGameboardInteropSnapshot(plan, options);
}

function snapshotFromRecipe(
  path: string,
  validationConfig: GameboardPlanValidationConfig,
  options: GameboardScenarioInteropOptions,
  allowInvalid: boolean
) {
  const recipe = readJson<GameboardRecipe>(resolve(path));
  const inspection = inspectGameboardRecipe(recipe, { plan: validationConfig });
  failOnSnapshotViolations(inspection.violations, allowInvalid);
  if (!inspection.plan) {
    throw new GameboardCliError(`Recipe ${relativizePath(path)} did not compile to a GameboardPlan`);
  }
  return createGameboardInteropSnapshot(inspection.plan, options);
}

function snapshotFromScenario(
  path: string,
  validationConfig: GameboardPlanValidationConfig,
  options: GameboardScenarioInteropOptions,
  allowInvalid: boolean
) {
  const scenario = readJson<GameboardScenario>(resolve(path));
  const inspection = inspectGameboardScenario(scenario, { plan: validationConfig });
  failOnSnapshotViolations(inspection.violations, allowInvalid);
  return createGameboardScenarioInteropSnapshot(scenario, options);
}

function failOnSnapshotViolations(
  violations: ReadonlyArray<ReturnType<typeof validateGameboardPlan>[number]>,
  allowInvalid: boolean
): void {
  if (allowInvalid || !violations.some((violation) => violation.severity === 'error')) {
    return;
  }
  printViolations(violations);
  process.exit(1);
}

function snapshotOptionsFromFlags(
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

function printAnalysis(analysis: ReturnType<typeof analyzeHexTileRegistry>): void {
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

function printGameboardPlanSummary(payload: GameboardPlanSummaryPayload): void {
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
  console.log(`validation: ${validation.errorCount} error(s), ${validation.warningCount} warning(s)`);
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

function printGameboardScenarioSummary(summary: GameboardScenarioSummary, sourcePath: string): void {
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

function formatShape(shape: GameboardPlan['shape']): string {
  if (shape.kind === 'rectangle') {
    return `rectangle ${shape.width}x${shape.height}`;
  }
  return `hexagon radius ${shape.radius}`;
}

function printBlueprintInspection(
  inspection: MedievalGameboardBlueprintInspection,
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

function printBlueprintScenarioInspection(
  inspection: MedievalGameboardBlueprintScenarioInspection
): void {
  const scenarioInspection = inspection.scenarioInspection;
  console.log(`scenario: ${inspection.scenario.id}`);
  console.log(`scenario actors: ${inspection.scenario.actors?.length ?? 0}`);
  console.log(`scenario quests: ${inspection.scenario.quests?.length ?? 0}`);
  console.log(`scenario spawn groups: ${scenarioInspection.spawnGroups?.groupCount ?? 0}`);
  console.log(`scenario patrol routes: ${scenarioInspection.patrolRoutes?.routeCount ?? 0}`);
  printViolations(scenarioInspection.violations);
}

function printPieceRegistryAnalysis(analysis: GameboardPieceRegistryAnalysis): void {
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

function printPiecePlacementInspection(inspection: GameboardPiecePlacementInspection): void {
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

function placementAtKey(at: string | { q: number; r: number }): string {
  return typeof at === 'string' ? at : `${at.q},${at.r}`;
}

function printPiecesFromAssets(summary: PiecesFromAssetsSummary): void {
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

function printLayoutFillAnalysis(analysis: GameboardLayoutFillAnalysis): void {
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

function printSpawnGroupPlan(spawnPlan: GameboardSpawnGroupPlan): void {
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

function printPatrolRouteSet(routeSet: GameboardPatrolRouteSet): void {
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

function printPatrolSimulationScriptPlan(plan: GameboardPatrolSimulationScriptPlan): void {
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

function formatCounts(counts: Readonly<Record<string, number | undefined>>): string {
  const entries = Object.entries(counts).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number'
  );
  return entries.length ? entries.map(([key, value]) => `${key}=${value}`).join(', ') : 'none';
}

function printViolations(
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

function printManifestInspection(
  path: string,
  inspection: MedievalHexagonManifestInspection
): void {
  console.log(`manifest: ${relativizePath(path)}`);
  if (inspection.manifest) {
    console.log(`edition: ${inspection.manifest.edition}`);
    console.log(`assets: ${inspection.manifest.counts.total}`);
    console.log(`texture sets: ${inspection.manifest.textureSets.join(', ') || 'none'}`);
  }
  console.log(
    `validation: ${inspection.errorCount} error(s), ${inspection.warningCount} warning(s)`
  );
  for (const issue of inspection.issues) {
    console.log(`${issue.severity}: ${formatManifestIssue(issue)}`);
  }
}

function formatManifestIssue(issue: MedievalHexagonManifestInspection['issues'][number]): string {
  const location = issue.assetId ? ` ${issue.assetId}` : issue.path ? ` ${issue.path}` : '';
  return `${issue.code}${location} - ${issue.message}`;
}

function printCompatibility(report: ReturnType<typeof analyzeExternalAssetCompatibility>): void {
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

function readGltfMetadata(path: string): {
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

function readGlbJson(path: string): GltfDocumentMetadata {
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

function extractMetadataBounds(document: GltfDocumentMetadata): AssetBounds {
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

function tuple(values: readonly [number, number, number]): [number, number, number] {
  return [round(values[0]), round(values[1]), round(values[2])];
}

function readIntendedRole(
  value: string | boolean | undefined
): ExternalAssetIntendedRole | undefined {
  if (value === 'tile' || value === 'prop' || value === 'structure' || value === 'unit') {
    return value;
  }
  return undefined;
}

function readPieceRole(value: string | boolean | undefined): GameboardPieceRole | undefined {
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

function readPieceFillMode(
  value: string | boolean | undefined
): SeededGameboardPieceFillMode | undefined {
  if (value === 'per-piece' || value === 'pool') {
    return value;
  }
  return undefined;
}

function pieceFillFromFlags(
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

function pieceSelectionFromFlags(
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

function pieceForPlacementFromFlags(
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

function pieceSourceUrlOptionsFromFlags(
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
const RESERVED_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SAFE_PIECE_SOURCE_ROOT_KEY = /^[a-zA-Z0-9_:-]+$/u;

function readPieceSourceRoots(value: string): Readonly<Record<string, string>> {
  const source = existsSync(resolve(value)) ? readJson<unknown>(resolve(value)) : JSON.parse(value);
  const payload = isRecord(source) && isRecord(source.sourceRoots) ? source.sourceRoots : source;
  if (!isRecord(payload)) {
    throw new GameboardCliError('--pieceSourceRoots must be a JSON object or { "sourceRoots": { ... } }');
  }
  // Null-prototype output so downstream Object.assign/spread can't reach
  // through Object.prototype even if an attacker bypassed the key filter.
  const roots: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [key, root] of Object.entries(payload)) {
    if (RESERVED_OBJECT_KEYS.has(key)) {
      throw new GameboardCliError(`--pieceSourceRoots key not allowed (prototype pollution risk): ${key}`);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPatrolRouteSet(value: unknown): value is GameboardPatrolRouteSet {
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

function uniqueRoles(values: readonly (GameboardPieceRole | undefined)[]): GameboardPieceRole[] {
  return [...new Set(values.filter((value): value is GameboardPieceRole => value !== undefined))];
}

function readAssetInputs(flags: Record<string, string | boolean>): string[] {
  const inputs = [...readCsv(flags.assets)];
  if (typeof flags.asset === 'string') {
    inputs.push(flags.asset);
  }
  if (inputs.length === 0) {
    throw new GameboardCliError('pieces-from-assets requires --assets <path[,path]> or --asset <path>');
  }
  return inputs.map((input) => resolve(input));
}

function assetInputRoots(inputs: readonly string[]): AssetInputRoot[] {
  return inputs.map((input) => {
    const stats = statSync(input);
    return {
      input,
      base: stats.isDirectory() ? input : dirname(input),
    };
  });
}

function collectGltfAssetPaths(inputs: readonly string[]): string[] {
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

function collectGltfAssetPathsFromDirectory(root: string): string[] {
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

function isGltfPath(path: string): boolean {
  const extension = extname(path).toLowerCase();
  return extension === '.glb' || extension === '.gltf';
}

function assetIdFromBatchPath(path: string, roots: readonly AssetInputRoot[]): string {
  const relativePath = relativeAssetPath(path, roots);
  const withoutExtension = relativePath.slice(0, -extname(relativePath).length);
  return normalizeAssetId(withoutExtension);
}

function sourceAssetRecord(
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

function relativeAssetPath(path: string, roots: readonly AssetInputRoot[]): string {
  const root = [...roots]
    .sort((left, right) => right.base.length - left.base.length)
    .find((candidate) => path === candidate.input || path.startsWith(`${candidate.base}/`));
  return normalizePath(root ? relative(root.base, path) : basename(path));
}

function normalizeAssetId(value: string): string {
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

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/');
}

function mergeSourceAssetOverrides(
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

function unmatchedOverrideWarnings(
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

function summarizeCompatibilityReports(
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

function incrementCount(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function readNumberFlag(value: string | boolean | undefined): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new GameboardCliError(`Expected numeric flag value, received ${value}`);
  }
  return number;
}

function readModelForward(
  value: string | boolean | undefined
): ExternalAssetForwardAxis | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === '+z' || value === '-z' || value === '+x' || value === '-x') {
    return value;
  }
  throw new GameboardCliError(`Expected --modelForward to be one of +z, -z, +x, -x; received ${String(value)}`);
}

function readBoardForwardEdge(value: string | boolean | undefined): HexEdgeIndex | undefined {
  const edge = readNumberFlag(value);
  if (edge === undefined) {
    return undefined;
  }
  if (!Number.isInteger(edge) || edge < 0 || edge > 5) {
    throw new GameboardCliError(`Expected --boardForwardEdge to be an integer from 0 to 5; received ${edge}`);
  }
  return edge as HexEdgeIndex;
}

function hasPieceFillFlags(flags: Record<string, string | boolean>): boolean {
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

function readCsv(value: string | boolean | undefined): string[] {
  return typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function normalizePieceId(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9:_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function assetIdFromPath(path: string | boolean): string {
  return (
    String(path)
      .split('/')
      .pop()
      ?.replace(/\.(glb|gltf)$/i, '') ?? 'external-asset'
  );
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function runDoctor(sourceRoot: string, edition: PackEdition): void {
  const validation = validateSourceRoot(sourceRoot, edition);
  const docsMontage = resolve('docs/assets/kaykit-guide/montage.png');
  console.log(`edition: ${edition}`);
  console.log(`source: ${sourceRoot}`);
  console.log(`source exists: ${existsSync(sourceRoot) ? 'yes' : 'no'}`);
  console.log(`gltf count: ${validation.gltfCount}/${expectedModelCount(edition)}`);
  console.log(`docs montage: ${existsSync(docsMontage) ? docsMontage : 'missing'}`);
}

function runValidate(sourceRoot: string, edition: PackEdition): void {
  const validation = validateSourceRoot(sourceRoot, edition);
  if (!validation.ok) {
    console.error(
      `Expected ${validation.expectedCount} ${edition} GLTF files, found ${validation.gltfCount}.`
    );
    process.exit(1);
  }
  console.log(`Validated ${validation.gltfCount} ${edition} GLTF files.`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = 'help', ...rest] = argv;
  if (command === 'help' || command === '--help' || command === '-h') {
    usage(0);
  }

  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item?.startsWith('--')) {
      continue;
    }
    const key = item.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }
  return { command, flags };
}

function readEdition(value: string | boolean | undefined): PackEdition {
  if (value === undefined || value === false) {
    return 'free';
  }
  if (value === 'free' || value === 'extra') {
    return value;
  }
  throw new GameboardCliError(`Unsupported edition: ${String(value)}`);
}

function readGuideScenarioAssetScope(
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

function usage(exitCode: number): never {
  console.log(`medieval-hexagon-gameboard <command> [options]

Commands:
  doctor     Report local source and docs status
  validate   Validate local FREE or EXTRA source counts
  manifest   Generate a manifest JSON from a source folder
  validate-manifest Validate a generated manifest JSON and optionally write a normalized copy
  analyze    Analyze tile bounds, grid scale, row spacing, and warnings
  declarations  Emit tile declarations from a source folder, manifest, or registry
  guide-permutations Emit guide-labeled road, river, crossing, and coast permutation metadata
  guide-scenarios Emit extracted guide-page scenario metadata and validate page assets
  guide-usages Emit renderer-ready page-level guide asset occurrence metadata
  guide-render-requests Emit URL-resolved guide render request queues and optional page groups
  guide-assets Emit asset id to guide-page, API, docs, and visual coverage metadata
  guide-roles Emit public role to guide-page, asset, and API coverage metadata
  guide-apis Emit public API to guide-page and asset coverage metadata
  coverage  Emit release-readiness coverage JSON or Markdown
  blueprint Compile high-level 2.5D board intent to a recipe, plan, scenario, and diagnostics
  summarize-plan Summarize terrain, placement, feature, asset, and local-only usage in a plan, recipe, scenario, or blueprint
  summarize-scenario Summarize board, actor, spawn, patrol, quest, and local-only usage in a scenario
  pieces    Validate piece declarations and optionally emit seeded piece fill rules
  place-piece Inspect and append one declared piece against a saved GameboardPlan, recipe, or scenario
  validate-plan Validate a GameboardPlan JSON with optional registry rules
  analyze-layout Analyze seeded layout fill rules against a saved GameboardPlan, recipe, or scenario
  spawn-groups Plan separated spawn groups and route diagnostics against a plan, recipe, or scenario
  patrol-routes Plan NPC/enemy patrol waypoints and segment diagnostics against a plan, recipe, or scenario
  patrol-script Create executable simulation command steps from planned patrol routes and actor assignments
  validate-recipe Validate a GameboardRecipe JSON and optionally compile it to a plan
  validate-scenario Validate a GameboardScenario JSON and optionally compile its plan
  validate-simulation Validate a GameboardScenario simulation script without executing it
  snapshot   Emit a neutral ECS interop snapshot from a plan, recipe, or scenario
  simulate-scenario Run a GameboardScenario simulation script and emit event records, final plan, or ECS interop
  compatibility Analyze one external GLB/GLTF for hex-tile compatibility and placement suggestions
  piece      Emit a custom piece declaration from an external GLB/GLTF compatibility scan
  pieces-from-assets Scan GLB/GLTF files and emit custom piece declarations plus compatibility summaries
  extract    Copy GLTF assets and write a manifest to an output folder
  bootstrap  Materialize KayKit GLTF assets under a consumer asset root (PRD RB)

Options:
  --edition free|extra
  --source <path>
  --manifest <path>
  --registry <path>
  --pieces <path>
  --plan <path>
  --rules <path>
  --groups <path>
  --recipe <path>
  --scenario <path>
  --script <path>
  --blueprint <path>
  --config <path>
  --outScenario <path>
  --outScenarioInspection <path>
  --includeScenario
  --includeScenarioInspection
  --assignments <path>
  --routeId <id>
  --actorId <id>
  --rounds <number>
  --shape rectangle|hexagon
  --width <number>
  --height <number>
  --radius <number>
  --scenarioId <comma,separated,guide-scenario-ids>
  --page <comma,separated,guide-pages>
  --editionScope free|extra|mixed|reference
  --publicApi <comma,separated,api-names>
  --guideRole <comma,separated,asset-treatment-roles>
  --includeTreatments
  --asset <path>
  --assets <comma,separated,paths>
  --intendedRole tile|prop|structure|unit
  --modelForward +z|-z|+x|-x
  --boardForwardEdge 0..5
  --role surface|building|unit|prop|tree|scatter|landmark|custom
  --pieceIdPrefix <prefix>
  --assetIdPrefix <prefix>
  --pieceOverrides <path>
  --overrides <path>
  --pieceSourceRoot <url-or-path>
  --pieceSourceRoots <json-path-or-inline-json>
  --roles <comma,separated,roles>
  --sourcePack <name>
  --sources <comma,separated,sources>
  --tags <comma,separated,tags>
  --ids <comma,separated,pieceIds>
  --pieceId <pieceId>
  --assetIds <comma,separated,assetIds>
  --assetId <assetId>
  --minimumEdition free|extra|all
  --assetBaseUrl <url-or-path>
  --groups
  --includeGroups
  --coverage
  --checksPassed
  --outJson <path>
  --outMarkdown <path>
  --generatedAt <iso-timestamp>
  --category <comma,separated,tiles|buildings|decoration|units>
  --excludeTags <comma,separated,tags>
  --requiresExtra
  --freeOnly
  --allowUnknownAssets
  --allowUnknownAssetIds <comma,separated,assetIds>
  --assetScope free|extra|all
  --allowInvalid
  --allowExpectationFailures
  --excludePlacements
  --excludeActors
  --excludeQuests
  --excludeSpawnGroups
  --excludeTimeline
  --spawnCount <number>
  --spawnSeed <seed>
  --spawnMinDistance <number>
  --spawnEdgePadding <number>
  --mode per-piece|pool
  --emitRules
  --emitSourceUrls
  --unencodedSourceUrls
  --ruleIdPrefix <prefix>
  --idPrefix <prefix>
  --seed <seed>
  --waterFill <number>
  --maxElevation <number>
  --towns <number>
  --harbors <number>
  --textureSet <texture-set>
  --defaultTerrain <terrain>
  --count <number>
  --fill <number>
  --minCount <number>
  --maxCount <number>
  --topAssetLimit <number>
  --failOnWarning
  --failOnBlockedQuest
  --includeReport
  --includeReports
  --includeRecipe
  --includePlan
  --includeInterop
  --includeAbsolutePaths
  --outManifest <path>
  --outRecipe <path>
  --outPlan <path>
  --outInterop <path>
  --out <path>
  --format json|markdown
  --markdown
  --assetBasePath <path>
  --force
  --json

Bootstrap subcommand:
  --source github|zip          Source mode (default: github; zip requires --zip)
  --zip <path>                 Path to a user-supplied KayKit zip (FREE or EXTRA)
  --commit <sha>               Pin the GitHub source to a specific commit/ref (default: main)
  --out <path>                 Consumer asset root (default: ./public/assets/models)
  --edition free|extra         Pack edition (default: free; extra requires --source zip)
  --force                      Wipe existing target before mirroring
  --verify                     Re-hash an existing bootstrap target and report drift
  --include-source-formats     Mirror .fbx/.obj/.mtl alongside the gltf tree
  --json                       Emit machine-readable BootstrapResult / verify report`);
  process.exit(exitCode);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  // Terse default: only the message. Full stack is gated behind
  // MEDIEVAL_HEXAGON_DEBUG=1 so failure output in CI / user terminals
  // stays quiet, but interactive debugging is one env-var away.
  // Phase 2 security review S-M5.
  const debugEnabled = process.env.MEDIEVAL_HEXAGON_DEBUG === '1';
  if (debugEnabled && error instanceof Error) {
    console.error(error.stack ?? error.message);
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
}
