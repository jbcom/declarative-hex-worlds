import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

interface PackResult {
  filename: string;
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const packageRoot = join(workspaceRoot, 'packages/medieval-hexagon-gameboard');
const tempRoot = mkdtempSync(join(tmpdir(), 'medieval-hexagon-consumer-'));
const packRoot = join(tempRoot, 'pack');
const appRoot = join(tempRoot, 'app');
const keepTemp = process.env.MEDIEVAL_HEXAGON_KEEP_CONSUMER_SMOKE === '1';
const COVERAGE_CLI_MAX_BUFFER_BYTES = 64 * 1024 * 1024;

try {
  for (const requiredFile of [
    'dist/index.js',
    'dist/examples/blueprint-board-usage.js',
    'dist/examples/simple-rpg-usage.js',
    'dist/cli.js',
  ]) {
    assert(
      existsSync(join(packageRoot, requiredFile)),
      `missing ${requiredFile}; run pnpm build before pnpm test:consumer`
    );
  }

  mkdirSync(packRoot);
  mkdirSync(appRoot);

  const [pack] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', packRoot], {
      cwd: packageRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  ) as PackResult[];
  const tarballPath = join(packRoot, pack.filename);
  assert(existsSync(tarballPath), `npm pack did not create ${tarballPath}`);

  writeFileSync(
    join(appRoot, 'package.json'),
    `${JSON.stringify(
      {
        private: true,
        type: 'module',
        dependencies: {
          '@jbcom/medieval-hexagon-gameboard': `file:${tarballPath}`,
          '@types/react': '^19.0.0',
          react: '^19.0.0',
          three: '^0.180.0',
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--fund=false'], {
    cwd: appRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const installedPackageRoot = join(appRoot, 'node_modules/@jbcom/medieval-hexagon-gameboard');
  const installedCliPath = join(installedPackageRoot, 'dist/cli.js');
  assert(
    existsSync(join(installedPackageRoot, 'dist/examples/blueprint-board-usage.js')),
    'compiled blueprint usage example is missing'
  );
  assert(
    existsSync(join(installedPackageRoot, 'dist/examples/simple-rpg-usage.js')),
    'compiled usage example is missing'
  );
  assert(
    existsSync(join(installedPackageRoot, 'examples/blueprint-board.json')),
    'blueprint JSON example is missing'
  );
  assert(
    existsSync(join(installedPackageRoot, 'examples/simple-rpg-scenario.json')),
    'scenario JSON example is missing'
  );
  assert(
    !existsSync(join(installedPackageRoot, 'examples/blueprint-board-usage.ts')),
    'raw TypeScript blueprint usage example must not be published'
  );
  assert(
    !existsSync(join(installedPackageRoot, 'examples/simple-rpg-usage.ts')),
    'raw TypeScript usage example must not be published'
  );
  const installedGuideUsageOutput = execFileSync(
    process.execPath,
    [
      installedCliPath,
      'guide-usages',
      '--source',
      join(tempRoot, 'missing-guide-source'),
      '--page',
      '14',
      '--json',
    ],
    {
      cwd: appRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const installedGuideUsage = JSON.parse(installedGuideUsageOutput) as {
    count: number;
    occurrenceCounts: { extra: number; scenarios: number; pages: number };
    assetIds: string[];
  };
  assert(
    installedGuideUsage.count === 137 &&
      installedGuideUsage.occurrenceCounts.extra === 137 &&
      installedGuideUsage.occurrenceCounts.scenarios === 1 &&
      installedGuideUsage.occurrenceCounts.pages === 1 &&
      installedGuideUsage.assetIds.includes('unit_blue_full'),
    'packed CLI guide-usages command did not emit page 14 renderer rows'
  );
  const installedSummaryOutput = execFileSync(
    process.execPath,
    [
      installedCliPath,
      'summarize-plan',
      '--scenario',
      join(installedPackageRoot, 'examples/simple-rpg-scenario.json'),
      '--manifest',
      join(installedPackageRoot, 'assets/free/manifest.json'),
      '--json',
    ],
    {
      cwd: appRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const installedSummary = JSON.parse(installedSummaryOutput) as {
    source: { kind: string };
    validation: { errorCount: number };
    summary: {
      tileCount: number;
      placementCount: number;
      placementKindCounts: Record<string, number>;
    };
  };
  assert(
    installedSummary.source.kind === 'scenario' &&
      installedSummary.validation.errorCount === 0 &&
      installedSummary.summary.tileCount > 0 &&
      installedSummary.summary.placementCount > 0 &&
      installedSummary.summary.placementKindCounts.terrain > 0,
    'packed CLI summarize-plan command did not emit scenario board counts'
  );
  const installedScenarioSummaryOutput = execFileSync(
    process.execPath,
    [
      installedCliPath,
      'summarize-scenario',
      '--scenario',
      join(installedPackageRoot, 'examples/simple-rpg-scenario.json'),
      '--manifest',
      join(installedPackageRoot, 'assets/free/manifest.json'),
      '--json',
    ],
    {
      cwd: appRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const installedScenarioSummary = JSON.parse(installedScenarioSummaryOutput) as {
    scenarioId: string;
    validation: { errorCount: number };
    actorCount: number;
    questCount: number;
    objectiveCount: number;
    actorKindCounts: Record<string, number>;
  };
  assert(
    installedScenarioSummary.scenarioId === 'docs-simple-rpg-scenario' &&
      installedScenarioSummary.validation.errorCount === 0 &&
      installedScenarioSummary.actorCount > 0 &&
      installedScenarioSummary.questCount > 0 &&
      installedScenarioSummary.objectiveCount > 0 &&
      installedScenarioSummary.actorKindCounts.player > 0,
    'packed CLI summarize-scenario command did not emit playable scenario counts'
  );
  const installedCoverageOutput = execFileSync(
    process.execPath,
    [installedCliPath, 'coverage', '--checksPassed', '--json'],
    {
      cwd: appRoot,
      encoding: 'utf8',
      maxBuffer: COVERAGE_CLI_MAX_BUFFER_BYTES,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const installedCoverage = JSON.parse(installedCoverageOutput) as {
    simpleRpgEvidence?: {
      publicApiExercises?: Array<{
        assetCount: number;
        modes: string[];
        pages: number[];
        publicApi: string;
      }>;
    };
  };
  const installedCoverageBridgeExercise =
    installedCoverage.simpleRpgEvidence?.publicApiExercises?.find(
      (exercise) => exercise.publicApi === 'GameboardBuilder.addBridge'
    );
  const installedCoverageMarkdown = execFileSync(
    process.execPath,
    [installedCliPath, 'coverage', '--checksPassed', '--markdown'],
    {
      cwd: appRoot,
      encoding: 'utf8',
      maxBuffer: COVERAGE_CLI_MAX_BUFFER_BYTES,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  assert(
    installedCoverage.simpleRpgEvidence?.publicApiExercises?.length === 74 &&
      installedCoverageBridgeExercise?.assetCount === 2 &&
      installedCoverageBridgeExercise.pages.join(',') === '2,7,9' &&
      installedCoverageBridgeExercise.modes.includes('visual-coverage') &&
      installedCoverageMarkdown.includes('### SimpleRPG Exercise Matrix') &&
      installedCoverageMarkdown.includes(
        '| `GameboardBuilder.addBridge` | fixed-gameplay, visual-coverage | 2, 7, 9 | 2 |'
      ),
    'packed CLI coverage command did not emit the SimpleRPG public API exercise matrix'
  );

  writeFileSync(
    join(appRoot, 'smoke-types.ts'),
    `
import {
  createGameboardInteropSnapshot,
  createGameboardInteropSnapshotIndex,
  createGameboardRuntimeInteropSnapshot,
  createGameboardBuilder,
  createInMemoryGameboardEcs,
  createGameboardLayoutArchetypeRegistryFromRecipe,
  createGameboardPieceRegistryFromRecipe,
  createGameboardRecipe,
  createGameboardRecipeGenerationFillRules,
  createGameboardWorld,
  createSeededGameboardPlan,
  dispatchGameboardActorTargetCommand,
  findPlacementEntity,
  findTileEntity,
  GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS,
  inspectGameboardActorTargets,
  inspectGameboardPlacementOccupancy,
  inspectGameboardNeighborhood,
  inspectGameboardTile,
  listKayKitGuideScenarioAssetRenderGroups,
  listKayKitGuideScenarioAssetRenderRequests,
  listKayKitGuideScenarioAssetUsages,
  listKayKitGuideScenarioAssetUsagesForScenario,
  moveGameboardActor,
  PlacementOccupiesTile,
  planGameboardActorTargetCommand,
  readPlacementOccupancyForTile,
  runGameboardActorTargetInteraction,
  selectGameboardActors,
  selectGameboardInteropRelations,
  spawnGameboardActor,
  summarizeGameboardCoverage,
  summarizeGameboardPlan,
  summarizeGameboardScenario,
  validateGameboardRecipeGeneration,
  type GameboardCoverageReport,
  type DispatchGameboardActorTargetCommandResult,
  type GameboardActorSelection,
  type GameboardActorSnapshot,
  type GameboardActorTargetCommandPlan,
  type GameboardActorSelectionOptions,
  type GameboardActorTargetingOptions,
  type GameboardActorTargetingReport,
  type GameboardPlacementOccupancyInspection,
  type GameboardPlacementOccupancyGuard,
  type GameboardInteropSnapshotIndex,
  type GameboardRuntimeInteropOptions,
  type GameboardRuntimeInteropState,
  type RunGameboardActorTargetInteractionResult,
  type GameboardNeighborhoodInspection,
  type GameboardNeighborhoodInspectionOptions,
  type GameboardTileInspection,
  type GameboardTileInspectionOptions,
  type GameboardLayoutArchetypeRegistry,
  type GameboardPiecePlacementInspection,
  type KayKitGuideScenarioAssetRenderGroup,
  type KayKitGuideScenarioAssetRenderRequest,
  type KayKitGuideScenarioAssetUsage,
  type MoveGameboardActorOptions,
  type SpawnGameboardActorOptions,
  type SpawnGameboardPlacementOptions,
  type InspectGameboardPlacementOccupancyOptions,
  type GameboardPlan,
  type GameboardPlanSummary,
  type GameboardScenarioSummary,
  type GameboardPlacementOccupancyRecord,
  type GameboardQuestSnapshot,
  type PlacementOccupancySnapshot,
  type PlacementOccupancyValue,
  type PlacementStateValue,
  type AddPlacementRecipeStep,
} from '@jbcom/medieval-hexagon-gameboard';
import assetManifest from '@jbcom/medieval-hexagon-gameboard/assets/free/manifest.json' with { type: 'json' };
import blueprintBoardJson from '@jbcom/medieval-hexagon-gameboard/examples/blueprint-board.json' with { type: 'json' };
import simpleRpgScenario from '@jbcom/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json' with { type: 'json' };
import {
  runBlueprintBoardUsageExample,
  type BlueprintBoardUsageSummary,
} from '@jbcom/medieval-hexagon-gameboard/examples/blueprint-board-usage';
import {
  listSimpleRpgGuidePublicApiExercises,
  runSimpleRpgExecutableGuideApiSmoke,
  runSimpleRpgUsageExample,
  summarizeSimpleRpgGuidePublicApiExercises,
  type SimpleRpgExecutableGuideApiSmokeSummary,
  type SimpleRpgGuidePublicApiExercise,
  type SimpleRpgGuidePublicApiExerciseCoverage,
  type SimpleRpgUsageSummary,
} from '@jbcom/medieval-hexagon-gameboard/examples/simple-rpg-usage';
import {
  GAMEBOARD_INTERACTION_HANDLER_PRESETS,
  createGameboardInteractionHandlerPreset,
  isGameboardInteractionHandlerPreset,
  type GameboardInteractionHandlerPreset,
} from '@jbcom/medieval-hexagon-gameboard/commands';
import {
  inspectMedievalHexagonManifest,
  type MedievalHexagonManifestInspection,
} from '@jbcom/medieval-hexagon-gameboard/manifest/schema';
import { freeManifest as typedFreeManifest } from '@jbcom/medieval-hexagon-gameboard/manifest/free';
import {
  GAMEBOARD_LAYOUT_ARCHETYPES,
  analyzeGameboardLayoutFill,
  appendGameboardLayoutPlacementsToPlan,
  createGameboardLayoutArchetypeRegistry,
  createGameboardLayoutPlacements,
  inspectGameboardLayoutSites,
  type GameboardLayoutArchetype,
  type GameboardLayoutCriteria,
  type GameboardLayoutFillAnalysis,
  type GameboardLayoutFillRule,
  type GameboardLayoutSiteInspection,
} from '@jbcom/medieval-hexagon-gameboard/layout';
import {
  createGameboardNavigation,
  planGameboardSpawnGroups,
  type GameboardSpawnGroupPlan,
} from '@jbcom/medieval-hexagon-gameboard/navigation';
import { gameboardPlacementFootprintKeys } from '@jbcom/medieval-hexagon-gameboard/occupancy';
import {
  createGameboardLayoutPlacementsFromPiece,
  createGameboardLayoutPlacementOptionsFromPiece,
  createGameboardLayoutFillRuleFromPiece,
  createGameboardPieceRegistry,
  declareGameboardPiece,
  inspectGameboardPiecePlacement,
  type GameboardPieceRegistryAnalysis,
} from '@jbcom/medieval-hexagon-gameboard/pieces';
import {
  inspectSeededGameboardPieceFills,
  type SeededGameboardPieceFillInspection,
} from '@jbcom/medieval-hexagon-gameboard/rules';
import {
  createGameboardRuntime,
  createGameboardRuntimeFromRecipe,
  createGameboardRuntimeFromScenario,
  type GameboardRecipeGameRuntime,
  type GameboardRuntimeSnapshot,
} from '@jbcom/medieval-hexagon-gameboard/runtime';
import {
  MedievalGameboardProvider,
  useGameboardActorsForTile,
  useGameboardActorSnapshots,
  useGameboardPlacementOccupancy,
  useGameboardRuntime,
  useGameboardRuntimeSnapshot,
  type GameboardRuntimeProviderProps,
} from '@jbcom/medieval-hexagon-gameboard/react';
import {
  summarizeGameboardScenario as summarizeGameboardScenarioFromScenario,
  type GameboardScenario,
  type GameboardScenarioSummary as GameboardScenarioSummaryFromScenario,
} from '@jbcom/medieval-hexagon-gameboard/scenario';
import {
  GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS as GAMEBOARD_SCENARIO_SIMULATION_SUBPATH_STEP_ACTIONS,
  type GameboardScenarioSimulationActorTargetCommandStep,
  type GameboardScenarioSimulationActorTargetsRecord,
} from '@jbcom/medieval-hexagon-gameboard/simulation';
import {
  copyGltfTree,
  defaultSourceRoot,
  expectedModelCount,
  generateManifestFromSource,
  validateSourceRoot,
  writeManifestJson,
  writeManifestModule,
  type GenerateManifestOptions,
  type ValidateSourceResult,
  type WriteManifestModuleOptions,
} from '@jbcom/medieval-hexagon-gameboard/ingest';
import {
  readGameboardActors as readGameboardActorsFromActors,
  type GameboardActorKind as GameboardActorKindFromActors,
  type GameboardActorSnapshot as GameboardActorSnapshotFromActors,
} from '@jbcom/medieval-hexagon-gameboard/actors';
import {
  GAMEBOARD_SCHEMA_VERSION,
  createGameboardBuilder as createGameboardBuilderFromGameboard,
  summarizeGameboardPlan as summarizeGameboardPlanFromGameboard,
  type GameboardPlanSummary as GameboardPlanSummaryFromGameboard,
  type GameboardPlacementSpec as GameboardPlacementSpecFromGameboard,
} from '@jbcom/medieval-hexagon-gameboard/gameboard';
import {
  FACTION_BUILDING_KINDS,
  NATURE_ASSET_IDS,
  factionBuildingAssetId,
  flagAssetId,
  listKayKitGuideScenarioAssetRenderGroups as listKayKitGuideScenarioAssetRenderGroupsFromCatalog,
  listKayKitGuideScenarioAssetRenderRequests as listKayKitGuideScenarioAssetRenderRequestsFromCatalog,
  listKayKitGuideScenarioAssetUsages as listKayKitGuideScenarioAssetUsagesFromCatalog,
  listKayKitGuideScenarioAssetUsagesForScenario as listKayKitGuideScenarioAssetUsagesForScenarioFromCatalog,
  type FactionBuildingKind as FactionBuildingKindFromCatalog,
} from '@jbcom/medieval-hexagon-gameboard/catalog';
import {
  findHexPath,
  hexKey as hexKeyFromCoordinates,
  parseHexKey,
  type HexPathResult as HexPathResultFromCoordinates,
} from '@jbcom/medieval-hexagon-gameboard/coordinates';
import {
  analyzeExternalAssetCompatibility,
  externalAssetSpawnOptions,
  recommendExternalAssetFacing,
  type ExternalAssetCompatibilityReport,
  type ExternalAssetSpawnOptionsInput,
} from '@jbcom/medieval-hexagon-gameboard/compatibility';
import {
  renderGameboardCoverageMarkdown as renderGameboardCoverageMarkdownFromCoverage,
  summarizeGameboardCoverage as summarizeGameboardCoverageFromCoverage,
  type GameboardCoverageReport as GameboardCoverageReportFromCoverage,
  type GameboardCoverageSimpleRpgEvidenceRow,
} from '@jbcom/medieval-hexagon-gameboard/coverage';
import {
  readGameboardPlacements as readGameboardPlacementsFromKoota,
  type GameboardSnapshot as GameboardSnapshotFromKoota,
  type PlacementStateValue as PlacementStateValueFromKoota,
} from '@jbcom/medieval-hexagon-gameboard/koota';
import {
  gameboardMovementActions as gameboardMovementActionsFromMovement,
  GAMEBOARD_MOVEMENT_PROFILES,
  type GameboardMovementStatus as GameboardMovementStatusFromMovement,
} from '@jbcom/medieval-hexagon-gameboard/movement';
import {
  createMedievalGameboardBlueprintPlan,
  inspectMedievalGameboardBlueprint,
  type MedievalGameboardBlueprintInspection,
} from '@jbcom/medieval-hexagon-gameboard/blueprint';
import {
  gameboardPatrolActions as gameboardPatrolActionsFromPatrol,
  type GameboardPatrolStatus as GameboardPatrolStatusFromPatrol,
} from '@jbcom/medieval-hexagon-gameboard/patrol';
import {
  GAMEBOARD_QUEST_SCHEMA_VERSION,
  readGameboardQuests as readGameboardQuestsFromQuests,
  type GameboardQuestStatus as GameboardQuestStatusFromQuests,
} from '@jbcom/medieval-hexagon-gameboard/quests';
import {
  projectWorldToGameboardPlan,
  readValidationGameboardPlanFromWorld,
} from '@jbcom/medieval-hexagon-gameboard/projection';
import {
  GAMEBOARD_RECIPE_SCHEMA_VERSION,
  createGameboardRecipe as createGameboardRecipeFromRecipe,
  type AddPlacementRecipeStep as AddPlacementRecipeStepFromRecipe,
  type GameboardRecipe as GameboardRecipeFromRecipe,
} from '@jbcom/medieval-hexagon-gameboard/recipe';
import {
  KAYKIT_HEX_WIDTH,
  createGameboardCoordinateSystem,
  type SpawnLocation as SpawnLocationFromGrid,
} from '@jbcom/medieval-hexagon-gameboard/grid';
import {
  createGameboardInteropSnapshot as createGameboardInteropSnapshotFromInterop,
  type GameboardInteropSnapshot as GameboardInteropSnapshotFromInterop,
} from '@jbcom/medieval-hexagon-gameboard/interop';
import {
  analyzeHexTileRegistry,
  createHexTileRegistry,
  createHexTileRegistryFromManifest,
  declareHexTile,
  type TileRegistryAnalysis,
} from '@jbcom/medieval-hexagon-gameboard/registry';
import type {
  GameboardRuleConfig as GameboardRuleConfigFromRuleTypes,
  RuleSeverity as RuleSeverityFromRuleTypes,
} from '@jbcom/medieval-hexagon-gameboard/rule-types';
import {
  HEX_EDGE_COUNT,
  edgeMask,
  selectRoadVariant,
  type GuideTilePermutation as GuideTilePermutationFromSelectors,
} from '@jbcom/medieval-hexagon-gameboard/selectors';
import {
  runGameboardSystems as runGameboardSystemsFromSystems,
  type GameboardSystemEventRecord as GameboardSystemEventRecordFromSystems,
} from '@jbcom/medieval-hexagon-gameboard/systems';
import {
  canStackAt,
  validateGameboardRules,
} from '@jbcom/medieval-hexagon-gameboard/world-rules';
import {
  MEDIEVAL_HEXAGON_SCHEMA_VERSION,
  PACK_EDITIONS,
  TEXTURE_SETS,
  type HexCoordinates as HexCoordinatesFromTypes,
  type MedievalHexagonManifest as MedievalHexagonManifestFromTypes,
} from '@jbcom/medieval-hexagon-gameboard/types';
import {
  createGameboardPlacementAssetUrlResolver,
  transformForHex,
  type GameboardPlacementAssetUrlResolver,
} from '@jbcom/medieval-hexagon-gameboard/three';

const plan: GameboardPlan = createSeededGameboardPlan({
  seed: 'packed-consumer-types',
  shape: { kind: 'rectangle', width: 2, height: 2 },
  layoutDensity: { harbors: { count: 0 } },
});
const planSummary: GameboardPlanSummary = summarizeGameboardPlan(plan);
const blueprintUsage: BlueprintBoardUsageSummary = runBlueprintBoardUsageExample();
const blueprintScenarioId: string = blueprintBoardJson.scenarioId;
const usage: SimpleRpgUsageSummary = runSimpleRpgUsageExample();
const simpleRpgExecutableGuideApiSmoke: SimpleRpgExecutableGuideApiSmokeSummary =
  runSimpleRpgExecutableGuideApiSmoke();
const simpleRpgGuideExerciseCoverage: SimpleRpgGuidePublicApiExerciseCoverage =
  summarizeSimpleRpgGuidePublicApiExercises();
const simpleRpgGuideExercises: readonly SimpleRpgGuidePublicApiExercise[] =
  listSimpleRpgGuidePublicApiExercises();
const simpleRpgEvidenceRows: readonly GameboardCoverageSimpleRpgEvidenceRow[] =
  simpleRpgGuideExercises;
const simpleRpgBridgeExercise: SimpleRpgGuidePublicApiExercise | undefined =
  simpleRpgGuideExercises.find((exercise) => exercise.publicApi === 'GameboardBuilder.addBridge');
const scenarioSummary: GameboardScenarioSummary = summarizeGameboardScenario(
  simpleRpgScenario as GameboardScenario
);
const scenarioSummaryFromScenario: GameboardScenarioSummaryFromScenario =
  summarizeGameboardScenarioFromScenario(simpleRpgScenario as GameboardScenario);
const coverageReport: GameboardCoverageReport = summarizeGameboardCoverage();
const coverageReportFromCoverage: GameboardCoverageReportFromCoverage =
  summarizeGameboardCoverageFromCoverage();
const coverageMarkdown: string = renderGameboardCoverageMarkdownFromCoverage(coverageReportFromCoverage);
const manifestInspection: MedievalHexagonManifestInspection = inspectMedievalHexagonManifest(assetManifest);
const ingestSourceRoot: string = defaultSourceRoot('free', '/packed-consumer');
const ingestExpectedCount: number = expectedModelCount('free');
const ingestValidation: ValidateSourceResult = validateSourceRoot('/packed-consumer/missing-source', 'extra');
const ingestManifestOptions: GenerateManifestOptions = {
  sourceRoot: ingestSourceRoot,
  edition: 'free',
  assetBasePath: 'assets/free',
};
const ingestModuleOptions: WriteManifestModuleOptions = {
  exportName: 'packedManifest',
  typeImportPath: '@jbcom/medieval-hexagon-gameboard',
};
const ingestCopyGltfTree: typeof copyGltfTree = copyGltfTree;
const ingestGenerateManifestFromSource: typeof generateManifestFromSource = generateManifestFromSource;
const ingestWriteManifestJson: typeof writeManifestJson = writeManifestJson;
const ingestWriteManifestModule: typeof writeManifestModule = writeManifestModule;
const fillAnalysis: GameboardLayoutFillAnalysis = analyzeGameboardLayoutFill(plan, {
  seed: 'packed-consumer-layout-analysis',
  rules: [{ id: 'trees', archetype: 'tree', assetId: 'tree_single_A', count: 1 }],
});
const siteInspection: GameboardLayoutSiteInspection = inspectGameboardLayoutSites(plan, {
  count: 1,
  seed: 'packed-consumer-site-inspection',
  criteria: { allowOccupied: false },
});
const harborCriteria: GameboardLayoutCriteria = {
  minElevation: 0,
  requiredAdjacentPlacementKind: 'road',
};
const occupancyGuard: GameboardPlacementOccupancyGuard = true;
const navigation = createGameboardNavigation(plan);
const spawnGroupPlan: GameboardSpawnGroupPlan = planGameboardSpawnGroups(plan, {
  seed: 'packed-consumer-spawn-groups',
  groups: [
    { id: 'alpha', count: 1, terrain: 'grass' },
    { id: 'beta', count: 1, terrain: 'grass', minDistanceFromGroups: 1, pathToGroups: ['alpha'] },
  ],
});
const piece = declareGameboardPiece({ id: 'packed-fixture-tree', source: 'Packed Fixtures', role: 'tree' });
const pieceInspection: GameboardPiecePlacementInspection = inspectGameboardPiecePlacement(plan, piece, {
  count: 1,
  seed: 'packed-consumer-piece-inspection',
});
const pieceRuleWithGuard = createGameboardLayoutFillRuleFromPiece(piece, {
  count: 1,
  occupancyGuard,
});
const pieceOptionsWithGuard = createGameboardLayoutPlacementOptionsFromPiece(piece, {
  count: 1,
  occupancyGuard: { requireUnblocked: true },
});
const piecePlacements = createGameboardLayoutPlacementsFromPiece(plan, piece, {
  count: 1,
  seed: 'packed-consumer-piece-inspection',
  occupancyGuard,
});
const appendedPlan = appendGameboardLayoutPlacementsToPlan(plan, piecePlacements);
const pieceFillInspection: SeededGameboardPieceFillInspection = inspectSeededGameboardPieceFills(
  plan,
  createGameboardPieceRegistry([piece]),
  [{ selection: { ids: ['packed-fixture-tree'] }, count: 1 }],
  { seed: 'packed-consumer-piece-fill-inspection' }
);
const blueprintInspection: MedievalGameboardBlueprintInspection = inspectMedievalGameboardBlueprint({
  seed: 'packed-consumer-blueprint-types',
  shape: { kind: 'rectangle', width: 5, height: 4 },
  waterFill: 0.15,
  maxElevation: 2,
  towns: 1,
  harbors: 1,
  biomeFills: [{ textureSet: 'summer', fill: 0.15 }],
  transitionPolicy: { biomeTransitions: true, elevationRamps: true, roadSlopes: true, bridges: true },
});
const blueprintPlan: GameboardPlan = createMedievalGameboardBlueprintPlan({
  seed: 'packed-consumer-blueprint-plan-types',
  shape: { kind: 'hexagon', radius: 2 },
  towns: 1,
});
const genericPlacementStep: AddPlacementRecipeStep = {
  action: 'addPlacement',
  at: { q: 0, r: 0 },
  assetId: 'hex_grass_sloped_high',
  kind: 'transition',
  layer: 'surface',
  rotationSteps: 1,
  metadata: { source: 'packed-consumer-root-type' },
};
const genericPlacementStepFromRecipe: AddPlacementRecipeStepFromRecipe = genericPlacementStep;
const packedRecipe = createGameboardRecipe(
  { seed: 'packed-consumer-recipe-runtime', shape: { kind: 'rectangle', width: 3, height: 2 } },
  [],
  {
    pieceDeclarations: [
      {
        id: 'packed-recipe-tree',
        assetId: 'tree_single_A',
        source: 'Packed Recipe Fixtures',
        role: 'tree',
        metadata: { sourceRelativePath: 'trees/packed-recipe-tree.gltf' },
      },
    ],
    pieceFills: [{ selection: { ids: ['packed-recipe-tree'] }, count: 1 }],
  }
);
const packedRecipeRegistry = createGameboardPieceRegistryFromRecipe(packedRecipe);
const packedRecipeRules: readonly GameboardLayoutFillRule[] = createGameboardRecipeGenerationFillRules(
  packedRecipe.generation
);
const typedArchetype: GameboardLayoutArchetype = {
  id: 'typed-camp-supply',
  label: 'Typed Camp Supply',
  kind: 'prop',
  layer: 'feature',
  criteria: { terrain: 'grass', allowOccupied: true },
};
const typedArchetypes: GameboardLayoutArchetypeRegistry = createGameboardLayoutArchetypeRegistry([
  typedArchetype,
]);
void createGameboardLayoutArchetypeRegistryFromRecipe(
  createGameboardRecipe(
    { seed: 'typed-recipe', shape: { kind: 'rectangle', width: 1, height: 1 } },
    [],
    { layoutArchetypes: typedArchetypes }
  )
)?.['typed-camp-supply'];
const typedRecipeGenerationViolations = validateGameboardRecipeGeneration(
  createGameboardRecipe(
    { seed: 'typed-bad-recipe', shape: { kind: 'rectangle', width: 1, height: 1 } },
    [],
    { layoutFills: [{ id: 'missing', archetype: 'missing-archetype', assetId: 'crate_A_small', count: 1 }] }
  )
);
const snapshot = createGameboardInteropSnapshot(plan);
const snapshotIndex: GameboardInteropSnapshotIndex = createGameboardInteropSnapshotIndex(snapshot);
const occupancyRecord: GameboardPlacementOccupancyRecord | undefined = selectGameboardInteropRelations(snapshotIndex, { name: 'PlacementOccupiesTile' })[0]?.data as GameboardPlacementOccupancyRecord | undefined;
const footprintKeys: string[] = gameboardPlacementFootprintKeys(plan.placements[0]!);
const world = createGameboardWorld(plan);
const actorKindFromActors: GameboardActorKindFromActors = 'npc';
const actorSnapshotsFromActors: readonly GameboardActorSnapshotFromActors[] = readGameboardActorsFromActors(world);
const gameboardSchemaVersionFromGameboard: string = GAMEBOARD_SCHEMA_VERSION;
const gameboardBuilderFromGameboard = createGameboardBuilderFromGameboard({
  seed: 'packed-consumer-gameboard-subpath',
  shape: { kind: 'rectangle', width: 1, height: 1 },
});
const placementFromGameboard: GameboardPlacementSpecFromGameboard | undefined = plan.placements[0];
const planSummaryFromGameboard: GameboardPlanSummaryFromGameboard =
  summarizeGameboardPlanFromGameboard(plan);
const factionBuildingKindFromCatalog: FactionBuildingKindFromCatalog = FACTION_BUILDING_KINDS[0]!;
const factionBuildingAssetFromCatalog: string = factionBuildingAssetId(factionBuildingKindFromCatalog, 'blue');
const flagAssetFromCatalog: string = flagAssetId('green');
const natureAssetFromCatalog: string = NATURE_ASSET_IDS[0]!;
const guideAssetUsages: readonly KayKitGuideScenarioAssetUsage[] = listKayKitGuideScenarioAssetUsages({
  pages: [16, 17, 18],
});
const guideAssetRenderRequests: readonly KayKitGuideScenarioAssetRenderRequest[] =
  listKayKitGuideScenarioAssetRenderRequests({
    pages: [16, 17, 18],
    assetBaseUrl: '/assets/extra',
  });
const guideAssetRenderGroups: readonly KayKitGuideScenarioAssetRenderGroup[] =
  listKayKitGuideScenarioAssetRenderGroups({ pages: [16, 17, 18] });
const guideAssetUsagesForScenario: readonly KayKitGuideScenarioAssetUsage[] =
  listKayKitGuideScenarioAssetUsagesForScenario('page-14-units');
const guideAssetUsagesFromCatalog: readonly KayKitGuideScenarioAssetUsage[] =
  listKayKitGuideScenarioAssetUsagesFromCatalog({ minimumEdition: 'free' });
const guideAssetRenderRequestsFromCatalog: readonly KayKitGuideScenarioAssetRenderRequest[] =
  listKayKitGuideScenarioAssetRenderRequestsFromCatalog({ minimumEdition: 'free' });
const guideAssetRenderGroupsFromCatalog: readonly KayKitGuideScenarioAssetRenderGroup[] =
  listKayKitGuideScenarioAssetRenderGroupsFromCatalog({ pages: [16, 17, 18] });
const guideAssetUsagesForScenarioFromCatalog: readonly KayKitGuideScenarioAssetUsage[] =
  listKayKitGuideScenarioAssetUsagesForScenarioFromCatalog('page-03-road-variations');
const hexKeyFromCoordinatesResult: string = hexKeyFromCoordinates({ q: 0, r: 0 });
const parsedHexFromCoordinates: HexCoordinatesFromTypes = parseHexKey(hexKeyFromCoordinatesResult);
const hexPathFromCoordinates: HexPathResultFromCoordinates = findHexPath({ q: 0, r: 0 }, { q: 1, r: 0 });
const compatibilityReportFromCompatibility: ExternalAssetCompatibilityReport = analyzeExternalAssetCompatibility({
  id: 'packed-consumer-castle-wall',
  sourcePack: 'Packed Consumer Fixtures',
  bounds: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5], size: [1, 1, 1] },
  intendedRole: 'tile',
});
const compatibilitySpawnInputFromCompatibility: ExternalAssetSpawnOptionsInput = {
  at: '0,0',
  assetId: 'packed-consumer-castle-wall',
  report: compatibilityReportFromCompatibility,
};
const compatibilitySpawnOptionsFromCompatibility = externalAssetSpawnOptions(compatibilitySpawnInputFromCompatibility);
const compatibilityFacingFromCompatibility = recommendExternalAssetFacing({ modelForward: '+z', boardForwardEdge: 1 });
const kootaPlacementsFromKoota: readonly PlacementStateValueFromKoota[] = readGameboardPlacementsFromKoota(world);
const kootaSnapshotFromKoota: GameboardSnapshotFromKoota = {
  board: undefined,
  tiles: [],
  placements: [],
};
const movementStatusFromMovement: GameboardMovementStatusFromMovement = 'idle';
const movementActionsFromMovement = gameboardMovementActionsFromMovement(world);
const movementProfileFromMovement = GAMEBOARD_MOVEMENT_PROFILES.ground;
const patrolStatusFromPatrol: GameboardPatrolStatusFromPatrol = 'idle';
const patrolActionsFromPatrol = gameboardPatrolActionsFromPatrol(world);
const questSchemaVersionFromQuests: string = GAMEBOARD_QUEST_SCHEMA_VERSION;
const questStatusFromQuests: GameboardQuestStatusFromQuests = 'active';
const questSnapshotsFromQuests = readGameboardQuestsFromQuests(world);
const projectedPlanFromProjection: GameboardPlan = projectWorldToGameboardPlan(world);
const validationPlanFromProjection: GameboardPlan = readValidationGameboardPlanFromWorld(world);
const recipeSchemaVersionFromRecipe: string = GAMEBOARD_RECIPE_SCHEMA_VERSION;
const recipeFromRecipe: GameboardRecipeFromRecipe = createGameboardRecipeFromRecipe(
  { seed: 'packed-consumer-recipe-subpath', shape: { kind: 'rectangle', width: 1, height: 1 } },
  []
);
const coordinateSystemFromGrid = createGameboardCoordinateSystem();
const kaykitWidthFromGrid: number = KAYKIT_HEX_WIDTH;
const spawnLocationsFromGrid: readonly SpawnLocationFromGrid[] = coordinateSystemFromGrid.spawnLocations({
  shape: { kind: 'rectangle', width: 1, height: 1 },
  count: 1,
});
const interopSnapshotFromInterop: GameboardInteropSnapshotFromInterop =
  createGameboardInteropSnapshotFromInterop(plan);
const declaredHexTileFromRegistry = declareHexTile({
  id: 'packed-consumer-registered-grass',
  assetId: 'hex_grass',
  role: 'base',
  terrain: 'grass',
});
const hexTileRegistryFromRegistry = createHexTileRegistry([
  { id: 'packed-consumer-registered-grass', assetId: 'hex_grass', role: 'base', terrain: 'grass' },
]);
const manifestTileRegistryFromRegistry = createHexTileRegistryFromManifest(typedFreeManifest);
const tileRegistryAnalysisFromRegistry: TileRegistryAnalysis = analyzeHexTileRegistry(hexTileRegistryFromRegistry);
const ruleConfigFromRuleTypes: GameboardRuleConfigFromRuleTypes = { requireReciprocalRoads: false };
const ruleSeverityFromRuleTypes: RuleSeverityFromRuleTypes = 'warning';
const edgeMaskFromSelectors: number = edgeMask([0, 3]);
const selectedRoadFromSelectors = selectRoadVariant([0, 3]);
const guidePermutationFromSelectors: GuideTilePermutationFromSelectors = {
  id: 'packed-consumer-road-A',
  kind: 'road',
  family: selectedRoadFromSelectors.family,
  label: selectedRoadFromSelectors.label,
  assetId: selectedRoadFromSelectors.assetId,
  inputMask: edgeMaskFromSelectors,
  canonicalMask: selectedRoadFromSelectors.canonicalMask,
  rotationSteps: selectedRoadFromSelectors.rotationSteps,
  rotationRadians: selectedRoadFromSelectors.rotationRadians,
  waterless: false,
  curvy: false,
};
const systemResultFromSystems = runGameboardSystemsFromSystems(world, {
  movement: false,
  patrols: false,
  quests: false,
});
const systemEventsFromSystems: readonly GameboardSystemEventRecordFromSystems[] = systemResultFromSystems.eventRecords;
const ruleViolationsFromWorldRules = validateGameboardRules(world, ruleConfigFromRuleTypes);
const canStackFromWorldRules: boolean = canStackAt(world, '0,0', 0);
const medievalSchemaFromTypes: string = MEDIEVAL_HEXAGON_SCHEMA_VERSION;
const packedEditionsFromTypes: readonly string[] = PACK_EDITIONS;
const textureSetsFromTypes: readonly string[] = TEXTURE_SETS;
const manifestFromTypes: MedievalHexagonManifestFromTypes = typedFreeManifest;
const placementAssetUrlResolverFromThree: GameboardPlacementAssetUrlResolver =
  createGameboardPlacementAssetUrlResolver({ catalog: typedFreeManifest, baseUrl: 'https://example.test/pkg/' });
const placementAssetUrlFromThree = placementFromGameboard
  ? placementAssetUrlResolverFromThree(placementFromGameboard)
  : undefined;
const transformFromThree = transformForHex(parsedHexFromCoordinates);
const runtime = createGameboardRuntime(
  createGameboardBuilder({
    seed: 'packed-consumer-runtime-types',
    shape: { kind: 'rectangle', width: 2, height: 1 },
  }).build()
);
const runtimeActor = runtime.spawnActor({
  actorId: 'packed-runtime-player',
  at: '0,0',
  assetId: 'flag_blue',
  kind: 'unit',
});
runtime.movement.setAgent(runtimeActor, { profile: 'ground', movementBudget: 2 });
runtime.dispatchCommand('1,0', { sourceActor: 'packed-runtime-player' });
runtime.tick({ patrols: false, movement: { steps: 2 }, quests: false });
const runtimeSnapshot: GameboardRuntimeSnapshot = runtime.snapshot({ includeInterop: false });
const runtimePlanSummary: GameboardPlanSummary = runtime.summarizePlan();
const runtimeMarker = runtime.spawnPlacement({
  id: 'packed-runtime-marker',
  at: '0,0',
  assetId: 'flag_green',
  kind: 'prop',
});
runtime.updatePlacement(runtimeMarker, { scale: 1.25, metadata: { marker: 'packed' } });
runtime.registerActor(runtimeMarker, {
  actorId: 'packed-runtime-guide',
  actorKind: 'npc',
  interactive: true,
});
runtime.updateActor('packed-runtime-guide', { tags: ['guide'], actorMetadata: { greeting: 'hello' } });
const runtimePlacementRecords: readonly PlacementStateValue[] = runtime.readPlacements();
const runtimeActorRecords: readonly GameboardActorSnapshot[] = runtime.readActors();
const runtimeTileActorRecords: readonly GameboardActorSnapshot[] = runtime.readActorsForTile('0,0');
const runtimeQuestEntity = runtime.spawnQuest({
  id: 'packed-runtime-quest',
  objectives: [{ id: 'meet-guide', kind: 'reach-tile', actor: 'packed-runtime-guide', tile: '0,0' }],
});
const runtimeQuestBefore: GameboardQuestSnapshot | undefined = runtime.findQuest(runtimeQuestEntity);
const runtimeQuestAfter: GameboardQuestSnapshot = runtime.advanceQuest('packed-runtime-quest');
const runtimeQuestRecords: readonly GameboardQuestSnapshot[] = runtime.readQuests();
const runtimeCanEnterActorTile: boolean = runtime.canOccupyPlacement({ at: '1,0', kind: 'unit' });
const runtimePlacementOccupancy = runtime.inspectPlacementOccupancy({ at: '1,0', kind: 'unit' });
const runtimePlacementOccupancyRecords: readonly PlacementOccupancySnapshot[] = runtime.readPlacementOccupancy();
const runtimeTilePlacements: readonly PlacementStateValue[] = runtime.readPlacementsForTile('1,0');
const runtimeTileOccupancyRecords: readonly PlacementOccupancySnapshot[] = runtime.readPlacementOccupancyForTile('1,0');
const runtimeRemovedMarker: boolean = runtime.removePlacement('packed-runtime-marker');
const runtimeTileInspectionOptions: GameboardTileInspectionOptions = { sourceActor: 'packed-runtime-player' };
const runtimeNeighborhoodInspectionOptions: GameboardNeighborhoodInspectionOptions = {
  radius: 1,
  sourceActor: 'packed-runtime-player',
};
const runtimeActorSelectionOptions: GameboardActorSelectionOptions = {
  sourceActor: 'packed-runtime-player',
  radius: 1,
};
const rootRuntimeTileInspection: GameboardTileInspection = inspectGameboardTile(
  runtime.world,
  '1,0',
  runtimeTileInspectionOptions
);
const rootRuntimeNeighborhoodInspection: GameboardNeighborhoodInspection = inspectGameboardNeighborhood(
  runtime.world,
  'packed-runtime-player',
  runtimeNeighborhoodInspectionOptions
);
const runtimeTileInspection: GameboardTileInspection = runtime.inspectTile(
  '1,0',
  runtimeTileInspectionOptions
);
const runtimeNeighborhoodInspection: GameboardNeighborhoodInspection = runtime.inspectNeighborhood(
  'packed-runtime-player',
  runtimeNeighborhoodInspectionOptions
);
const rootRuntimeActorSelection: GameboardActorSelection = selectGameboardActors(
  runtime.world,
  runtimeActorSelectionOptions
);
const runtimeActorSelection: GameboardActorSelection = runtime.selectActors(
  runtimeActorSelectionOptions
);
const runtimeActorTargetingOptions: GameboardActorTargetingOptions = {
  sourceActor: 'packed-runtime-player',
  includeSource: true,
};
const rootRuntimeActorTargets: GameboardActorTargetingReport = inspectGameboardActorTargets(
  runtime.world,
  runtimeActorTargetingOptions
);
const runtimeActorTargets: GameboardActorTargetingReport = runtime.inspectActorTargets(
  runtimeActorTargetingOptions
);
const runtimeActorTargetCommandPlan: GameboardActorTargetCommandPlan =
  runtime.planActorTargetCommand(runtimeActorTargetingOptions);
const rootRuntimeActorTargetDispatch: DispatchGameboardActorTargetCommandResult =
  dispatchGameboardActorTargetCommand(runtime.world, runtimeActorTargetingOptions);
const runtimeActorTargetInteraction: RunGameboardActorTargetInteractionResult =
  runtime.interactActorTarget(runtimeActorTargetingOptions, { systems: false });
const simulationActorTargetCommandStep: GameboardScenarioSimulationActorTargetCommandStep = {
  action: 'actor-target-command',
  sourceActor: 'packed-runtime-player',
  targetActorId: 'packed-runtime-player',
  requireReachable: true,
};
const simulationActions: readonly string[] = GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS;
const simulationSubpathActions: readonly string[] = GAMEBOARD_SCENARIO_SIMULATION_SUBPATH_STEP_ACTIONS;
const simulationActorTargets: readonly GameboardScenarioSimulationActorTargetsRecord[] = [];
const runtimeInteropOptions: GameboardRuntimeInteropOptions = { includeActors: true, includeQuests: true };
const runtimeInteropState: GameboardRuntimeInteropState = {
  plan: runtimeSnapshot.plan,
  actors: runtimeSnapshot.actors,
  quests: runtimeSnapshot.quests,
};
const runtimeInteropSnapshot = runtime.createInteropSnapshot(runtimeInteropOptions);
const runtimeInteropSnapshotFromState = createGameboardRuntimeInteropSnapshot(
  runtimeInteropState,
  runtimeInteropOptions
);
const runtimeInteropMount = runtime.mountInterop(createInMemoryGameboardEcs().adapter);
const scenarioRuntime = createGameboardRuntimeFromScenario(simpleRpgScenario as GameboardScenario);
const scenarioRuntimeInteropSnapshot = scenarioRuntime.createScenarioInteropSnapshot();
const scenarioRuntimeInteropMount = scenarioRuntime.mountScenarioInterop(createInMemoryGameboardEcs().adapter);
const scenarioRuntimeSummary: GameboardScenarioSummary = scenarioRuntime.summarizeScenario();
const recipeRuntime: GameboardRecipeGameRuntime = createGameboardRuntimeFromRecipe(packedRecipe);
const recipeRuntimeSourceUrls: Readonly<Record<string, string>> = recipeRuntime.createRecipePieceSourceUrlMap({
  sourceRoots: { 'Packed Recipe Fixtures': '/packed-recipe-fixtures' },
});
const runtimePieceInspection: GameboardPiecePlacementInspection = runtime.inspectPiecePlacement(piece, {
  count: 1,
  seed: 'packed-consumer-runtime-piece-inspection',
});
const runtimePieceOptions = runtime.createPiecePlacementOptions(piece, { count: 1, occupancyGuard });
const runtimePiecePlacements: readonly SpawnGameboardPlacementOptions[] = runtime.createPiecePlacements(piece, {
  count: 1,
  seed: 'packed-consumer-runtime-piece-create',
});
const runtimePieceEntities = runtime.spawnPiece(piece, {
  count: 1,
  seed: 'packed-consumer-runtime-piece-spawn',
  occupancyGuard,
});
const runtimeLayoutEntities = runtime.spawnLayoutFill({
  seed: 'packed-consumer-runtime-layout-fill',
  rules: [{ id: 'runtime-crates', archetype: 'scatter', assetId: 'crate_A_small', count: 1 }],
});
const runtimePieceRegistryRuntime = createGameboardRuntime(
  createGameboardBuilder({
    seed: 'packed-consumer-runtime-piece-registry-types',
    shape: { kind: 'rectangle', width: 4, height: 2 },
  }).build()
);
const runtimePieceRegistry = createGameboardPieceRegistry([
  piece,
  { id: 'packed-fixture-tree-b', assetId: 'tree_single_B', source: 'Packed Fixtures', role: 'tree', tags: ['nature'] },
  { id: 'packed-fixture-crate', assetId: 'crate_A_small', source: 'Packed Fixtures', role: 'scatter', tags: ['camp'], metadata: { sourceRelativePath: 'props/crate.gltf' } },
]);
const runtimePieceRegistryAnalysis: GameboardPieceRegistryAnalysis = runtimePieceRegistryRuntime.analyzePieceRegistry(runtimePieceRegistry, {
  checks: [{ id: 'packed-nature-pool', mode: 'pool', selection: { roles: ['tree'] } }],
});
const runtimeSelectedPieces = runtimePieceRegistryRuntime.selectPieces(runtimePieceRegistry, { tags: ['nature'] });
const runtimePieceFillRules: readonly GameboardLayoutFillRule[] = runtimePieceRegistryRuntime.createPieceFillRules(runtimePieceRegistry, {
  selection: { tags: ['camp'] },
  count: 1,
});
const runtimePiecePoolFillRule: GameboardLayoutFillRule = runtimePieceRegistryRuntime.createPiecePoolFillRule(
  runtimePieceRegistryRuntime.selectPieces(runtimePieceRegistry, { roles: ['tree'] }),
  { id: 'packed-nature-pool', count: 1 }
);
const runtimePieceFillAnalysis: GameboardLayoutFillAnalysis = runtimePieceRegistryRuntime.analyzePieceFills(
  runtimePieceRegistry,
  [{ selection: { tags: ['camp'] }, count: 1 }],
  { seed: 'packed-consumer-runtime-piece-fill-analysis' }
);
const runtimePieceFillInspection: SeededGameboardPieceFillInspection = runtimePieceRegistryRuntime.inspectPieceFills(
  runtimePieceRegistry,
  [{ selection: { tags: ['camp'] }, count: 1 }],
  { seed: 'packed-consumer-runtime-piece-fill-inspection' }
);
const runtimePieceFillEntities = runtimePieceRegistryRuntime.spawnPieceFills(
  runtimePieceRegistry,
  [{ selection: { tags: ['camp'] }, count: 1 }],
  { seed: 'packed-consumer-runtime-piece-fill-spawn' }
);
const runtimePieceSourceUrls: Readonly<Record<string, string>> = runtimePieceRegistryRuntime.createPieceSourceUrlMap(
  runtimePieceRegistry,
  { sourceRoots: { 'Packed Fixtures': '/packed-fixtures' } }
);
const reactProvider: typeof MedievalGameboardProvider = MedievalGameboardProvider;
const reactRuntimeProviderProps: GameboardRuntimeProviderProps = {
  runtime,
  children: undefined,
};
const reactActorSnapshots: readonly GameboardActorSnapshot[] = [] as ReturnType<typeof useGameboardActorSnapshots>;
const reactTileActorSnapshots: readonly GameboardActorSnapshot[] = [] as ReturnType<typeof useGameboardActorsForTile>;
const reactPlacementOccupancy: readonly PlacementOccupancySnapshot[] = [] as ReturnType<typeof useGameboardPlacementOccupancy>;
const reactRuntimeFromHook: GameboardRecipeGameRuntime =
  undefined as unknown as ReturnType<typeof useGameboardRuntime<GameboardRecipeGameRuntime>>;
const reactRuntimeSnapshot: GameboardRuntimeSnapshot = undefined as unknown as ReturnType<typeof useGameboardRuntimeSnapshot>;
const occupancyInspectionOptions: InspectGameboardPlacementOccupancyOptions = { at: '0,0', kind: 'unit' };
const actorSpawnOptions: SpawnGameboardActorOptions = {
  actorId: 'packed-types-actor',
  at: '1,1',
  assetId: 'flag_blue',
  kind: 'unit',
  occupancyGuard,
};
const actorMoveOptions: MoveGameboardActorOptions = { occupancyGuard };
const placementOccupancyInspection: GameboardPlacementOccupancyInspection = inspectGameboardPlacementOccupancy(
  world,
  occupancyInspectionOptions
);
const tileEntity = findTileEntity(world, '0,0');
const placementEntity = plan.placements[0] ? findPlacementEntity(world, plan.placements[0].id) : undefined;
const occupancyValue: PlacementOccupancyValue | undefined = tileEntity && placementEntity ? placementEntity.get(PlacementOccupiesTile(tileEntity)) : undefined;
const occupancySnapshots: readonly PlacementOccupancySnapshot[] = readPlacementOccupancyForTile(world, '0,0');
const totalAssets: number = assetManifest.counts.total;
const scenarioId: string = simpleRpgScenario.id;
const handlerPreset: GameboardInteractionHandlerPreset = 'default-rpg';
const handlerPresetCount: number = GAMEBOARD_INTERACTION_HANDLER_PRESETS.length;
const handlerCount: number = createGameboardInteractionHandlerPreset(handlerPreset).length;
const handlerPresetIsValid: boolean = isGameboardInteractionHandlerPreset(handlerPreset);

void actorKindFromActors;
void actorSnapshotsFromActors;
void canStackFromWorldRules;
void compatibilityFacingFromCompatibility;
void compatibilityReportFromCompatibility;
void compatibilitySpawnOptionsFromCompatibility;
void coordinateSystemFromGrid;
void declaredHexTileFromRegistry;
void edgeMaskFromSelectors;
void factionBuildingAssetFromCatalog;
void factionBuildingKindFromCatalog;
void flagAssetFromCatalog;
void gameboardBuilderFromGameboard;
void gameboardSchemaVersionFromGameboard;
void guidePermutationFromSelectors;
void hexKeyFromCoordinatesResult;
void hexPathFromCoordinates;
void interopSnapshotFromInterop;
void kaykitWidthFromGrid;
void kootaPlacementsFromKoota;
void kootaSnapshotFromKoota;
void manifestFromTypes;
void manifestTileRegistryFromRegistry;
void medievalSchemaFromTypes;
void movementActionsFromMovement;
void movementProfileFromMovement;
void movementStatusFromMovement;
void natureAssetFromCatalog;
void guideAssetRenderGroups;
void guideAssetRenderGroupsFromCatalog;
void guideAssetRenderRequests;
void guideAssetRenderRequestsFromCatalog;
void guideAssetUsages;
void guideAssetUsagesForScenario;
void guideAssetUsagesFromCatalog;
void guideAssetUsagesForScenarioFromCatalog;
void packedEditionsFromTypes;
void patrolActionsFromPatrol;
void patrolStatusFromPatrol;
void placementAssetUrlFromThree;
void planSummary;
void planSummaryFromGameboard;
void scenarioSummary;
void scenarioSummaryFromScenario;
void projectedPlanFromProjection;
void questSchemaVersionFromQuests;
void questSnapshotsFromQuests;
void questStatusFromQuests;
void recipeFromRecipe;
void recipeSchemaVersionFromRecipe;
void ruleSeverityFromRuleTypes;
void ruleViolationsFromWorldRules;
void selectedRoadFromSelectors;
void spawnLocationsFromGrid;
void systemEventsFromSystems;
void systemResultFromSystems;
void textureSetsFromTypes;
void tileRegistryAnalysisFromRegistry;
void transformFromThree;
void validationPlanFromProjection;
void HEX_EDGE_COUNT;
void GAMEBOARD_LAYOUT_ARCHETYPES.harbor;
void typedArchetype;
void typedArchetypes;
void typedRecipeGenerationViolations;
void fillAnalysis;
void handlerCount;
void handlerPresetCount;
void handlerPresetIsValid;
void ingestCopyGltfTree;
void ingestExpectedCount;
void ingestGenerateManifestFromSource;
void ingestManifestOptions;
void ingestModuleOptions;
void ingestSourceRoot;
void ingestValidation;
void ingestWriteManifestJson;
void ingestWriteManifestModule;
void harborCriteria;
void footprintKeys;
void manifestInspection;
void navigation;
void actorSpawnOptions;
void actorMoveOptions;
void occupancyRecord;
void occupancyGuard;
void placementOccupancyInspection;
void occupancySnapshots;
void occupancyValue;
void runtimeSnapshot;
void runtimePlanSummary;
void runtimePlacementRecords;
void runtimeActorRecords;
void runtimeTileActorRecords;
void runtimeQuestBefore;
void runtimeQuestAfter;
void runtimeQuestRecords;
void runtimeCanEnterActorTile;
void runtimePlacementOccupancy;
void runtimePlacementOccupancyRecords;
void runtimeTilePlacements;
void runtimeTileOccupancyRecords;
void runtimeRemovedMarker;
void rootRuntimeTileInspection;
void runtimeTileInspection;
void rootRuntimeNeighborhoodInspection;
void runtimeNeighborhoodInspection;
void rootRuntimeActorSelection;
void runtimeActorSelection;
void rootRuntimeActorTargets;
void runtimeActorTargets;
void runtimeActorTargetCommandPlan;
void rootRuntimeActorTargetDispatch;
void runtimeActorTargetInteraction;
void runtimeInteropSnapshot;
void runtimeInteropSnapshotFromState;
void runtimeInteropMount;
void scenarioRuntime;
void scenarioRuntimeInteropSnapshot;
void scenarioRuntimeInteropMount;
void scenarioRuntimeSummary;
void genericPlacementStep;
void genericPlacementStepFromRecipe;
void recipeRuntime;
void recipeRuntimeSourceUrls;
void packedRecipeRegistry;
void packedRecipeRules;
void runtimePieceInspection;
void runtimePieceOptions;
void runtimePiecePlacements;
void runtimePieceEntities;
void runtimeLayoutEntities;
void runtimePieceRegistryRuntime;
void runtimePieceRegistry;
void runtimePieceRegistryAnalysis;
void runtimeSelectedPieces;
void runtimePieceFillRules;
void runtimePiecePoolFillRule;
void runtimePieceFillAnalysis;
void runtimePieceFillInspection;
void runtimePieceFillEntities;
void runtimePieceSourceUrls;
void reactProvider;
void reactRuntimeProviderProps;
void reactActorSnapshots;
void reactTileActorSnapshots;
void reactPlacementOccupancy;
void reactRuntimeFromHook;
void reactRuntimeSnapshot;
void pieceInspection;
void pieceRuleWithGuard;
void pieceOptionsWithGuard;
void piecePlacements;
void pieceFillInspection;
void spawnGroupPlan;
void appendedPlan;
void scenarioId;
void siteInspection;
void totalAssets;
void blueprintScenarioId;
void blueprintUsage;
void usage;
void simpleRpgExecutableGuideApiSmoke;
void simpleRpgGuideExerciseCoverage;
void simpleRpgGuideExercises;
void simpleRpgEvidenceRows;
void simpleRpgBridgeExercise;
`,
    'utf8'
  );

  execFileSync(
    process.execPath,
    [
      join(workspaceRoot, 'node_modules/typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--resolveJsonModule',
      '--skipLibCheck',
      'smoke-types.ts',
    ],
    {
      cwd: appRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  writeFileSync(
    join(appRoot, 'smoke.mjs'),
    `
import {
  createGameboardBuilder,
  createGameboardInteropSnapshot,
  createGameboardInteropSnapshotIndex,
  createGameboardLayoutArchetypeRegistryFromRecipe,
  createGameboardRecipe,
  createGameboardWorld,
  createInMemoryGameboardEcs,
  createSeededGameboardPlan,
  dispatchGameboardActorTargetCommand,
  axialToWorld,
  findPlacementEntity,
  findTileEntity,
  GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS,
  inspectGameboardActorTargets,
  inspectGameboardPlacementOccupancy,
  inspectGameboardNeighborhood,
  inspectGameboardTile,
  listKayKitGuideScenarioAssetRenderGroups,
  listKayKitGuideScenarioAssetRenderRequests,
  listKayKitGuideScenarioAssetUsages,
  moveGameboardActor,
  PlacementOccupiesTile,
  PlacementState,
  planGameboardActorTargetCommand,
  readPlacementOccupancyForTile,
  runGameboardActorTargetInteraction,
  selectGameboardActors,
  selectGameboardInteropRelations,
  spawnGameboardActor,
  spawnGameboardPlacement,
  summarizeGameboardCoverage,
  summarizeGameboardPlan,
  summarizeGameboardScenario,
} from '@jbcom/medieval-hexagon-gameboard';
import { runBlueprintBoardUsageExample } from '@jbcom/medieval-hexagon-gameboard/examples/blueprint-board-usage';
import {
  listSimpleRpgGuidePublicApiExercises,
  runSimpleRpgUsageExample,
  summarizeSimpleRpgGuidePublicApiExercises,
} from '@jbcom/medieval-hexagon-gameboard/examples/simple-rpg-usage';
import {
  GAMEBOARD_INTERACTION_HANDLER_PRESETS,
  createGameboardInteractionHandlerPreset,
  isGameboardInteractionHandlerPreset,
} from '@jbcom/medieval-hexagon-gameboard/commands';
import {
  GAMEBOARD_LAYOUT_ARCHETYPES,
  analyzeGameboardLayoutFill,
  appendGameboardLayoutPlacementsToPlan,
  createGameboardLayoutArchetypeRegistry,
  createGameboardLayoutPlacements,
  inspectGameboardLayoutSites,
  spawnGameboardLayoutPlacements,
} from '@jbcom/medieval-hexagon-gameboard/layout';
import { freeManifest } from '@jbcom/medieval-hexagon-gameboard/manifest/free';
import { inspectMedievalHexagonManifest } from '@jbcom/medieval-hexagon-gameboard/manifest/schema';
import {
  createGameboardNavigation,
  planGameboardSpawnGroups,
} from '@jbcom/medieval-hexagon-gameboard/navigation';
import { gameboardPlacementFootprintKeys } from '@jbcom/medieval-hexagon-gameboard/occupancy';
import {
  createGameboardLayoutPlacementsFromPiece,
  createGameboardLayoutPlacementOptionsFromPiece,
  createGameboardPieceRegistry,
  declareGameboardPiece,
  inspectGameboardPiecePlacement,
} from '@jbcom/medieval-hexagon-gameboard/pieces';
import { inspectSeededGameboardPieceFills } from '@jbcom/medieval-hexagon-gameboard/rules';
import {
  createGameboardRuntime,
  createGameboardRuntimeFromRecipe,
  createGameboardRuntimeFromScenario,
} from '@jbcom/medieval-hexagon-gameboard/runtime';
import {
  GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS as GAMEBOARD_SCENARIO_SIMULATION_SUBPATH_STEP_ACTIONS,
} from '@jbcom/medieval-hexagon-gameboard/simulation';
import {
  defaultSourceRoot,
  expectedModelCount,
  validateSourceRoot,
} from '@jbcom/medieval-hexagon-gameboard/ingest';
import { validateGameboardPlan } from '@jbcom/medieval-hexagon-gameboard/validation';
import { readGameboardActors as readGameboardActorsFromActors } from '@jbcom/medieval-hexagon-gameboard/actors';
import {
  GAMEBOARD_SCHEMA_VERSION,
  createGameboardBuilder as createGameboardBuilderFromGameboard,
  summarizeGameboardPlan as summarizeGameboardPlanFromGameboard,
} from '@jbcom/medieval-hexagon-gameboard/gameboard';
import {
  FACTION_BUILDING_KINDS,
  NATURE_ASSET_IDS,
  factionBuildingAssetId,
  flagAssetId,
  listKayKitGuideScenarioAssetRenderGroups as listKayKitGuideScenarioAssetRenderGroupsFromCatalog,
  listKayKitGuideScenarioAssetRenderRequests as listKayKitGuideScenarioAssetRenderRequestsFromCatalog,
  listKayKitGuideScenarioAssetUsagesForScenario as listKayKitGuideScenarioAssetUsagesForScenarioFromCatalog,
} from '@jbcom/medieval-hexagon-gameboard/catalog';
import {
  findHexPath,
  hexKey as hexKeyFromCoordinates,
  parseHexKey,
} from '@jbcom/medieval-hexagon-gameboard/coordinates';
import {
  analyzeExternalAssetCompatibility,
  externalAssetSpawnOptions,
  recommendExternalAssetFacing,
} from '@jbcom/medieval-hexagon-gameboard/compatibility';
import {
  renderGameboardCoverageMarkdown as renderGameboardCoverageMarkdownFromCoverage,
  summarizeGameboardCoverage as summarizeGameboardCoverageFromCoverage,
} from '@jbcom/medieval-hexagon-gameboard/coverage';
import { readGameboardPlacements as readGameboardPlacementsFromKoota } from '@jbcom/medieval-hexagon-gameboard/koota';
import {
  GAMEBOARD_MOVEMENT_PROFILES,
  gameboardMovementActions as gameboardMovementActionsFromMovement,
} from '@jbcom/medieval-hexagon-gameboard/movement';
import {
  createMedievalGameboardBlueprintPlan,
  inspectMedievalGameboardBlueprint,
} from '@jbcom/medieval-hexagon-gameboard/blueprint';
import { gameboardPatrolActions as gameboardPatrolActionsFromPatrol } from '@jbcom/medieval-hexagon-gameboard/patrol';
import {
  GAMEBOARD_QUEST_SCHEMA_VERSION,
  readGameboardQuests as readGameboardQuestsFromQuests,
} from '@jbcom/medieval-hexagon-gameboard/quests';
import {
  projectWorldToGameboardPlan,
  readValidationGameboardPlanFromWorld,
} from '@jbcom/medieval-hexagon-gameboard/projection';
import {
  GAMEBOARD_RECIPE_SCHEMA_VERSION,
  createGameboardRecipe as createGameboardRecipeFromRecipe,
} from '@jbcom/medieval-hexagon-gameboard/recipe';
import { summarizeGameboardScenario as summarizeGameboardScenarioFromScenario } from '@jbcom/medieval-hexagon-gameboard/scenario';
import {
  KAYKIT_HEX_WIDTH,
  createGameboardCoordinateSystem,
} from '@jbcom/medieval-hexagon-gameboard/grid';
import { createGameboardInteropSnapshot as createGameboardInteropSnapshotFromInterop } from '@jbcom/medieval-hexagon-gameboard/interop';
import {
  analyzeHexTileRegistry,
  createHexTileRegistry,
  createHexTileRegistryFromManifest,
  declareHexTile,
} from '@jbcom/medieval-hexagon-gameboard/registry';
import {
  HEX_EDGE_COUNT,
  edgeMask,
  selectRoadVariant,
} from '@jbcom/medieval-hexagon-gameboard/selectors';
import { runGameboardSystems as runGameboardSystemsFromSystems } from '@jbcom/medieval-hexagon-gameboard/systems';
import {
  canStackAt,
  validateGameboardRules,
} from '@jbcom/medieval-hexagon-gameboard/world-rules';
import {
  MEDIEVAL_HEXAGON_SCHEMA_VERSION,
  PACK_EDITIONS,
  TEXTURE_SETS,
} from '@jbcom/medieval-hexagon-gameboard/types';
import {
  createGameboardPlacementAssetUrlResolver,
  transformForHex,
} from '@jbcom/medieval-hexagon-gameboard/three';

const assetManifestModule = await import('@jbcom/medieval-hexagon-gameboard/assets/free/manifest.json', {
  with: { type: 'json' },
});
const scenarioModule = await import('@jbcom/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json', {
  with: { type: 'json' },
});
const blueprintBoardModule = await import('@jbcom/medieval-hexagon-gameboard/examples/blueprint-board.json', {
  with: { type: 'json' },
});
const ruleTypesModule = await import('@jbcom/medieval-hexagon-gameboard/rule-types');
const manifestInspection = inspectMedievalHexagonManifest(assetManifestModule.default);
if (manifestInspection.errorCount !== 0 || manifestInspection.warningCount !== 0) {
  throw new Error(\`packed FREE manifest inspection failed: \${JSON.stringify(manifestInspection.issues)}\`);
}
const ingestRoot = defaultSourceRoot('free', process.cwd());
const ingestValidation = validateSourceRoot('/tmp/packed-consumer-missing-kaykit-source', 'free');
if (
  expectedModelCount('free') !== 221 ||
  !ingestRoot.endsWith('/references/KayKit_Medieval_Hexagon_Pack_1.0_FREE') ||
  ingestValidation.gltfCount !== 0 ||
  ingestValidation.expectedCount !== 221 ||
  ingestValidation.ok !== false
) {
  throw new Error(\`packed ingest subpath helpers failed: \${JSON.stringify({ ingestRoot, ingestValidation })}\`);
}
const plan = createSeededGameboardPlan({
  seed: 'packed-consumer-smoke',
  shape: { kind: 'rectangle', width: 4, height: 3 },
  layoutDensity: { harbors: { count: 1 }, trees: 0.1, props: 0.05 },
});
const planSummary = summarizeGameboardPlan(plan);
const blueprintInspection = inspectMedievalGameboardBlueprint({
  seed: 'packed-consumer-blueprint-runtime',
  shape: { kind: 'rectangle', width: 6, height: 4 },
  waterFill: 0.16,
  maxElevation: 2,
  towns: 1,
  harbors: 1,
  biomeFills: [{ textureSet: 'fall', fill: 0.18, center: { q: 2, r: 2 }, radius: 2 }],
});
const blueprintPlan = createMedievalGameboardBlueprintPlan({
  seed: 'packed-consumer-blueprint-plan-runtime',
  shape: { kind: 'hexagon', radius: 2 },
  towns: 1,
});
const densityHarbors = plan.placements.filter((placement) => placement.metadata.densityPreset === 'harbors');
if (densityHarbors.length !== 1 || densityHarbors[0]?.metadata.layoutArchetype !== 'harbor') {
  throw new Error('packed seeded density harbors did not generate one harbor placement');
}
const errors = validateGameboardPlan(plan).filter((violation) => violation.severity === 'error');
if (errors.length > 0) {
  throw new Error(\`packed consumer plan had validation errors: \${JSON.stringify(errors)}\`);
}
const navigation = createGameboardNavigation(plan, {
  blockedTerrain: ['water'],
  blockingPlacementKinds: ['structure', 'unit'],
});
if (!navigation.canEnter('0,0')) {
  throw new Error('packed consumer navigation could not enter origin tile');
}
const subpathWorld = createGameboardWorld(plan);
const subpathProjectedPlan = projectWorldToGameboardPlan(subpathWorld);
const subpathPlanSummary = summarizeGameboardPlanFromGameboard(subpathProjectedPlan);
const packagedScenarioSummary = summarizeGameboardScenario(scenarioModule.default);
const packagedScenarioSummaryFromScenario =
  summarizeGameboardScenarioFromScenario(scenarioModule.default);
const packagedCoverageSummary = summarizeGameboardCoverage();
const packagedCoverageSummaryFromCoverage = summarizeGameboardCoverageFromCoverage();
const packagedCoverageMarkdown = renderGameboardCoverageMarkdownFromCoverage(packagedCoverageSummaryFromCoverage);
if (
  packagedCoverageSummary.guide.pageCount !== 19 ||
  packagedCoverageSummary.manifest.freeGuideAssetsInManifest !== 221 ||
  packagedCoverageSummaryFromCoverage.publicApi.length !== 74 ||
  !packagedCoverageMarkdown.includes('Release Readiness Coverage')
) {
  throw new Error('packed coverage report did not expose guide, manifest, public API, and markdown data');
}
const packagedSimpleRpgGuideExercises = listSimpleRpgGuidePublicApiExercises();
const packagedSimpleRpgBridgeExercise = packagedSimpleRpgGuideExercises.find(
  (exercise) => exercise.publicApi === 'GameboardBuilder.addBridge'
);
if (
  packagedSimpleRpgGuideExercises.length !== 74 ||
  new Set(packagedSimpleRpgGuideExercises.map((exercise) => exercise.publicApi)).size !== 74 ||
  !packagedSimpleRpgBridgeExercise ||
  packagedSimpleRpgBridgeExercise.assetCount !== 2 ||
  packagedSimpleRpgBridgeExercise.pages.join(',') !== '2,7,9' ||
  !packagedSimpleRpgBridgeExercise.modes.includes('visual-coverage')
) {
  throw new Error(
    \`packed SimpleRPG guide API exercise matrix was incomplete: \${JSON.stringify(packagedSimpleRpgBridgeExercise)}\`
  );
}
const subpathValidationPlan = readValidationGameboardPlanFromWorld(subpathWorld);
const subpathInteropSnapshot = createGameboardInteropSnapshotFromInterop(plan);
const subpathCoordinateSystem = createGameboardCoordinateSystem();
const subpathSpawnLocations = subpathCoordinateSystem.spawnLocations({
  shape: { kind: 'rectangle', width: 2, height: 1 },
  count: 1,
  seed: 'packed-consumer-subpath-spawns',
});
const subpathDeclaredHexTile = declareHexTile({
  id: 'packed-consumer-subpath-grass',
  assetId: 'hex_grass',
  role: 'base',
  terrain: 'grass',
});
const subpathTileRegistry = createHexTileRegistry([
  { id: 'packed-consumer-subpath-grass', assetId: 'hex_grass', role: 'base', terrain: 'grass' },
]);
const subpathManifestTileRegistry = createHexTileRegistryFromManifest(assetManifestModule.default);
const subpathRegistryAnalysis = analyzeHexTileRegistry(subpathTileRegistry);
const subpathCompatibilityReport = analyzeExternalAssetCompatibility({
  id: 'packed-consumer-kenney-square-tower',
  sourcePack: 'Packed Consumer Fixtures',
  bounds: { min: [-0.5, 0, -0.5], max: [0.5, 2, 0.5], size: [1, 2, 1] },
  intendedRole: 'tile',
  hasRig: false,
});
const subpathCompatibilitySpawn = externalAssetSpawnOptions({
  at: '0,0',
  assetId: 'packed-consumer-kenney-square-tower',
  report: subpathCompatibilityReport,
  sourceUrl: '/fixtures/kenney-square-tower.glb',
});
const subpathFacing = recommendExternalAssetFacing({ modelForward: '+z', boardForwardEdge: 1 });
const subpathPlacementUrlResolver = createGameboardPlacementAssetUrlResolver({
  catalog: assetManifestModule.default,
  baseUrl: 'https://example.test/pkg/',
});
const subpathPlacementUrl = subpathPlacementUrlResolver(plan.placements[0]);
const subpathHexKey = hexKeyFromCoordinates({ q: 1, r: 0 });
const subpathParsedHex = parseHexKey(subpathHexKey);
const subpathPath = findHexPath({ q: 0, r: 0 }, { q: 1, r: 0 });
const subpathTransform = transformForHex(subpathParsedHex);
const guideUsagePages16To18 = listKayKitGuideScenarioAssetUsages({ pages: [16, 17, 18] });
const guideUsageFreeAssets = listKayKitGuideScenarioAssetUsages({ minimumEdition: 'free' });
const guideRenderRequestsPages16To18 = listKayKitGuideScenarioAssetRenderRequests({
  pages: [16, 17, 18],
  assetBaseUrl: '/assets/extra',
});
const guideRenderGroupsPages16To18 = listKayKitGuideScenarioAssetRenderGroups({ pages: [16, 17, 18] });
const guideRenderRequestsFreeFromCatalog =
  listKayKitGuideScenarioAssetRenderRequestsFromCatalog({ minimumEdition: 'free' });
const guideRenderGroupsFromCatalog = listKayKitGuideScenarioAssetRenderGroupsFromCatalog({
  pages: [16, 17, 18],
});
const guideUsageRoadsFromCatalog =
  listKayKitGuideScenarioAssetUsagesForScenarioFromCatalog('page-03-road-variations');
const subpathSystemsResult = runGameboardSystemsFromSystems(subpathWorld, {
  movement: false,
  patrols: false,
  quests: false,
});
const subpathRuleErrors = validateGameboardRules(subpathWorld).filter((violation) => violation.severity === 'error');
if (
  typeof ruleTypesModule !== 'object' ||
  GAMEBOARD_SCHEMA_VERSION !== '1.0.0' ||
  GAMEBOARD_QUEST_SCHEMA_VERSION !== '1.0.0' ||
  GAMEBOARD_RECIPE_SCHEMA_VERSION !== '1.0.0' ||
  MEDIEVAL_HEXAGON_SCHEMA_VERSION !== '1.0.0' ||
  !PACK_EDITIONS.includes('free') ||
  !TEXTURE_SETS.includes('winter') ||
  createGameboardBuilderFromGameboard({ seed: 'packed-consumer-gameboard-subpath', shape: { kind: 'rectangle', width: 1, height: 1 } }).build().schemaVersion !== GAMEBOARD_SCHEMA_VERSION ||
  createGameboardRecipeFromRecipe(
    { seed: 'packed-consumer-recipe-subpath', shape: { kind: 'rectangle', width: 1, height: 1 } },
    []
  ).schemaVersion !== GAMEBOARD_RECIPE_SCHEMA_VERSION ||
  blueprintInspection.plan.tiles.length === 0 ||
  blueprintInspection.counts.townBuildings < 1 ||
  blueprintInspection.counts.harbors < 1 ||
  blueprintPlan.placements.length < 1 ||
  FACTION_BUILDING_KINDS.length < 1 ||
  factionBuildingAssetId(FACTION_BUILDING_KINDS[0], 'blue') !== 'building_archeryrange_blue' ||
  flagAssetId('green') !== 'flag_green' ||
  NATURE_ASSET_IDS.length < 1 ||
  subpathHexKey !== '1,0' ||
  subpathParsedHex.q !== 1 ||
  !subpathPath.found ||
  readGameboardActorsFromActors(subpathWorld).length !== 0 ||
  readGameboardPlacementsFromKoota(subpathWorld).length !== plan.placements.length ||
  planSummary.tileCount !== plan.tiles.length ||
  subpathPlanSummary.placementCount !== subpathProjectedPlan.placements.length ||
  packagedScenarioSummary.actorCount < 1 ||
  packagedScenarioSummaryFromScenario.questCount < 1 ||
  GAMEBOARD_MOVEMENT_PROFILES.ground.id !== 'ground' ||
  typeof gameboardMovementActionsFromMovement(subpathWorld).runSystem !== 'function' ||
  gameboardPatrolActionsFromPatrol(subpathWorld).read().length !== 0 ||
  readGameboardQuestsFromQuests(subpathWorld).length !== 0 ||
  subpathProjectedPlan.tiles.length !== plan.tiles.length ||
  subpathValidationPlan.placements.length !== plan.placements.length ||
  subpathCoordinateSystem.toWorld({ q: 1, r: 0 }).x !== KAYKIT_HEX_WIDTH ||
  subpathSpawnLocations[0]?.key !== '0,0' ||
  subpathDeclaredHexTile.assetId !== 'hex_grass' ||
  subpathInteropSnapshot.entities.length < plan.tiles.length ||
  subpathRegistryAnalysis.tileCount !== 1 ||
  subpathManifestTileRegistry.declarations.length < 1 ||
  subpathCompatibilityReport.suggestedRole !== 'prop' ||
  subpathCompatibilityReport.warnings.length < 1 ||
  subpathCompatibilitySpawn.requiresExtra !== true ||
  subpathCompatibilitySpawn.kind !== 'prop' ||
  subpathFacing.rotationSteps !== 1 ||
  HEX_EDGE_COUNT !== 6 ||
  edgeMask([0, 3]) <= 0 ||
  selectRoadVariant([0, 3]).assetId !== 'hex_road_A' ||
  guideUsagePages16To18.length !== 462 ||
  guideUsageFreeAssets.length !== 474 ||
  guideUsageFreeAssets[0]?.label.startsWith('p') !== true ||
  guideRenderRequestsPages16To18.length !== 462 ||
  !guideRenderRequestsPages16To18[0]?.url?.startsWith('/assets/extra/') ||
  guideRenderGroupsPages16To18.length !== 3 ||
  guideRenderGroupsPages16To18[0]?.count !== 155 ||
  guideRenderRequestsFreeFromCatalog.length !== 474 ||
  guideRenderGroupsFromCatalog.length !== 3 ||
  guideUsageRoadsFromCatalog.length !== 15 ||
  guideUsageRoadsFromCatalog[0]?.caption !== 'page-03-road-variations free' ||
  subpathSystemsResult.eventRecords.length !== 0 ||
  subpathRuleErrors.length !== 0 ||
  typeof canStackAt(subpathWorld, '0,0', 0) !== 'boolean' ||
  !subpathPlacementUrl?.includes('https://example.test/pkg/assets/free/') ||
  subpathTransform.position.x !== KAYKIT_HEX_WIDTH
) {
  throw new Error('packed public subpath imports failed');
}
const runtimePlan = createGameboardBuilder({
  seed: 'packed-consumer-runtime',
  shape: { kind: 'rectangle', width: 2, height: 1 },
}).build();
const runtime = createGameboardRuntime(runtimePlan);
const runtimeActor = runtime.spawnActor({
  id: 'packed-runtime-player-placement',
  actorId: 'packed-runtime-player',
  actorKind: 'player',
  at: '0,0',
  assetId: 'flag_blue',
  kind: 'unit',
});
runtime.movement.setAgent(runtimeActor, { profile: 'ground', movementBudget: 2 });
const runtimeDispatch = runtime.dispatchCommand('1,0', { sourceActor: 'packed-runtime-player' });
if (runtimeDispatch.execution.status !== 'requested-move') {
  throw new Error(\`packed runtime command did not request movement: \${JSON.stringify(runtimeDispatch.eventRecords)}\`);
}
runtime.tick({ patrols: false, movement: { steps: 10 }, quests: false });
const runtimeSnapshot = runtime.snapshot({ includeValidationPlan: true, includeInterop: false });
if (
  runtimeSnapshot.actors.find((actor) => actor.actor.actorId === 'packed-runtime-player')?.placement.tileKey !== '1,0' ||
  !runtimeSnapshot.validationPlan?.placements.some((placement) => placement.id === 'packed-runtime-player-placement')
) {
  throw new Error('packed runtime facade did not move and snapshot the runtime actor');
}
const runtimeMarker = runtime.spawnPlacement({
  id: 'packed-runtime-marker',
  at: '0,0',
  assetId: 'flag_green',
  kind: 'prop',
});
runtime.updatePlacement(runtimeMarker, { scale: 1.25, metadata: { marker: 'packed' } });
runtime.registerActor(runtimeMarker, {
  actorId: 'packed-runtime-guide',
  actorKind: 'npc',
  interactive: true,
});
runtime.updateActor('packed-runtime-guide', {
  tags: ['guide'],
  actorMetadata: { greeting: 'hello' },
});
const runtimeQuestEntity = runtime.spawnQuest({
  id: 'packed-runtime-quest',
  objectives: [{ id: 'meet-guide', kind: 'reach-tile', actor: 'packed-runtime-guide', tile: '0,0' }],
});
const runtimeQuestBefore = runtime.findQuest(runtimeQuestEntity);
const runtimeQuestAfter = runtime.advanceQuest('packed-runtime-quest');
const runtimePlacementOccupancy = runtime.inspectPlacementOccupancy({ at: '1,0', kind: 'unit' });
if (
  runtime.readPlacements().find((placement) => placement.id === 'packed-runtime-marker')?.scale !== 1.25 ||
  runtime.findActor('packed-runtime-guide')?.actor.metadata.greeting !== 'hello' ||
  !runtime.readActors().some((actor) => actor.actor.actorId === 'packed-runtime-guide') ||
  !runtime.readActorsForTile('0,0').some((actor) => actor.actor.actorId === 'packed-runtime-guide') ||
  runtimeQuestBefore?.quest.status !== 'active' ||
  runtimeQuestAfter.quest.status !== 'completed' ||
  runtime.readQuests().find((quest) => quest.quest.questId === 'packed-runtime-quest')?.quest.status !== 'completed' ||
  runtime.canOccupyPlacement({ at: '1,0', kind: 'unit' }) !== false ||
  runtimePlacementOccupancy.canOccupy !== false ||
  !runtime.readPlacementOccupancy().some((record) => record.placement.id === 'packed-runtime-player-placement') ||
  !runtime.readPlacementsForTile('1,0').some((placement) => placement.id === 'packed-runtime-player-placement') ||
  !runtime
    .readPlacementOccupancyForTile('1,0')
    .some((record) => record.placement.id === 'packed-runtime-player-placement')
) {
  throw new Error('packed runtime direct mutation/read helpers failed');
}
if (!runtime.removePlacement('packed-runtime-marker') || runtime.removePlacement('packed-runtime-marker')) {
  throw new Error('packed runtime removePlacement helper failed');
}
const runtimeTileInspection = runtime.inspectTile('1,0', { sourceActor: 'packed-runtime-player' });
const rootRuntimeTileInspection = inspectGameboardTile(runtime.world, '1,0', { sourceActor: 'packed-runtime-player' });
const runtimeNeighborhoodInspection = runtime.inspectNeighborhood('packed-runtime-player', {
  radius: 1,
  sourceActor: 'packed-runtime-player',
});
const rootRuntimeNeighborhoodInspection = inspectGameboardNeighborhood(runtime.world, 'packed-runtime-player', {
  radius: 1,
  sourceActor: 'packed-runtime-player',
});
const runtimeActorSelection = runtime.selectActors({
  sourceActor: 'packed-runtime-player',
  radius: 1,
});
const rootRuntimeActorSelection = selectGameboardActors(runtime.world, {
  sourceActor: 'packed-runtime-player',
  radius: 1,
});
const runtimeActorTargets = runtime.inspectActorTargets({
  sourceActor: 'packed-runtime-player',
  includeSource: true,
});
const rootRuntimeActorTargets = inspectGameboardActorTargets(runtime.world, {
  sourceActor: 'packed-runtime-player',
  includeSource: true,
});
if (
  !runtimeTileInspection.exists ||
  runtimeTileInspection.actors[0]?.actor.actorId !== 'packed-runtime-player' ||
  rootRuntimeTileInspection.tileKey !== runtimeTileInspection.tileKey ||
  runtimeNeighborhoodInspection.centerKey !== '1,0' ||
  rootRuntimeNeighborhoodInspection.actors[0]?.actor.actorId !== 'packed-runtime-player' ||
  runtimeActorSelection.actorIds[0] !== 'packed-runtime-player' ||
  rootRuntimeActorSelection.actorIds[0] !== 'packed-runtime-player' ||
  runtimeActorSelection.records[0]?.tileKey !== '1,0' ||
  rootRuntimeActorSelection.recordsByTileKey['1,0']?.[0]?.actorId !== 'packed-runtime-player' ||
  runtimeActorTargets.nearestTarget?.approach !== 'self' ||
  rootRuntimeActorTargets.nearestTarget?.record.actorId !== 'packed-runtime-player'
) {
  throw new Error('packed runtime tile/neighborhood/actor selection/targeting facade did not expose live actor contents');
}
runtime.spawnActor({
  id: 'packed-runtime-raider-placement',
  actorId: 'packed-runtime-raider',
  actorKind: 'enemy',
  team: 'red',
  hostile: true,
  at: '0,0',
  assetId: 'flag_red',
  kind: 'unit',
});
const rootRuntimeActorTargetCommand = planGameboardActorTargetCommand(runtime.world, {
  sourceActor: 'packed-runtime-player',
  hostileToSource: true,
  targetActorId: 'packed-runtime-raider',
  maxPathCost: 1,
});
const runtimeActorTargetCommand = runtime.planActorTargetCommand({
  sourceActor: 'packed-runtime-player',
  hostileToSource: true,
  targetActorId: 'packed-runtime-raider',
  maxPathCost: 1,
});
const rootRuntimeActorTargetDispatch = dispatchGameboardActorTargetCommand(runtime.world, {
  sourceActor: 'packed-runtime-player',
  hostileToSource: true,
  targetActorId: 'packed-runtime-raider',
  maxPathCost: 1,
});
const runtimeActorTargetInteraction = runGameboardActorTargetInteraction(
  runtime.world,
  {
    sourceActor: 'packed-runtime-player',
    hostileToSource: true,
    targetActorId: 'packed-runtime-raider',
    maxPathCost: 1,
  },
  { systems: false }
);
const runtimeActorTargetDispatch = runtime.dispatchActorTargetCommand({
  sourceActor: 'packed-runtime-player',
  hostileToSource: true,
  targetActorId: 'packed-runtime-raider',
  maxPathCost: 1,
});
const runtimeActorTargetRuntimeInteraction = runtime.interactActorTarget(
  {
    sourceActor: 'packed-runtime-player',
    hostileToSource: true,
    targetActorId: 'packed-runtime-raider',
    maxPathCost: 1,
  },
  { systems: false }
);
if (
  !rootRuntimeActorTargetCommand.canExecute ||
  !runtimeActorTargetCommand.canExecute ||
  !rootRuntimeActorTargetDispatch.targetCommand.canExecute ||
  !runtimeActorTargetInteraction.targetCommand.canExecute ||
  !runtimeActorTargetDispatch.targetCommand.canExecute ||
  !runtimeActorTargetRuntimeInteraction.targetCommand.canExecute ||
  rootRuntimeActorTargetDispatch.dispatch?.events[0]?.type !== 'command-handler-required' ||
  runtimeActorTargetInteraction.events[0]?.type !== 'command-handler-required' ||
  runtimeActorTargetCommand.command?.kind !== 'attack-actor' ||
  runtimeActorTargetCommand.target?.actor.actor.actorId !== 'packed-runtime-raider'
) {
  throw new Error('packed runtime actor-target command planner/dispatcher did not expose a reachable attack command');
}
const runtimeInteropSnapshot = runtime.createInteropSnapshot();
const runtimeActorPlacementRelations = selectGameboardInteropRelations(runtimeInteropSnapshot, {
  name: 'ActorPlacement',
  fromId: 'actor:packed-runtime-player',
});
const runtimeMountedEcs = createInMemoryGameboardEcs();
const runtimeMounted = runtime.mountInterop(runtimeMountedEcs.adapter);
if (
  !runtimeInteropSnapshot.entities.some((entity) => entity.id === 'actor:packed-runtime-player') ||
  runtimeActorPlacementRelations[0]?.toId !== 'placement:packed-runtime-player-placement' ||
  runtimeMounted.missingRelations.length !== 0 ||
  runtimeMountedEcs.entities.get('actor:packed-runtime-player')?.components.get('GameboardActorState')?.placement.tileKey !== '1,0'
) {
  throw new Error('packed runtime interop facade did not expose live actors for external ECS mounting');
}
const packagedScenarioRuntime = createGameboardRuntimeFromScenario(scenarioModule.default);
const packagedScenarioRuntimeSummary = packagedScenarioRuntime.summarizeScenario();
if (
  !packagedScenarioRuntime.actorEntities.player ||
  packagedScenarioRuntime.snapshot({ includeInterop: false }).actors.length < 1 ||
  packagedScenarioRuntimeSummary.actorCount < 1 ||
  packagedScenarioRuntimeSummary.questCount < 1
) {
  throw new Error('packed scenario runtime facade did not expose actor indexes');
}
const packagedScenarioInterop = packagedScenarioRuntime.createScenarioInteropSnapshot();
const packagedScenarioEcs = createInMemoryGameboardEcs();
const packagedScenarioMounted = packagedScenarioRuntime.mountScenarioInterop(packagedScenarioEcs.adapter);
if (
  !packagedScenarioInterop.entities.some((entity) => entity.id === 'actor:player') ||
  packagedScenarioMounted.missingRelations.length !== 0 ||
  !packagedScenarioEcs.entities.has('actor:player')
) {
  throw new Error('packed scenario runtime facade did not expose scenario interop for external ECS mounting');
}
const packedRecipeRuntimeRecipe = createGameboardRecipe(
  { seed: 'packed-consumer-recipe-runtime-smoke', shape: { kind: 'rectangle', width: 3, height: 2 } },
  [],
  {
    pieceDeclarations: [
      {
        id: 'packed-runtime-recipe-tree',
        assetId: 'tree_single_A',
        source: 'Packed Runtime Recipe Fixtures',
        role: 'tree',
        metadata: { sourceRelativePath: 'trees/runtime-recipe-tree.gltf' },
      },
    ],
    pieceFills: [{ selection: { ids: ['packed-runtime-recipe-tree'] }, count: 1 }],
  }
);
const packedRecipeRuntime = createGameboardRuntimeFromRecipe(packedRecipeRuntimeRecipe);
if (
  packedRecipeRuntime.recipePieceRegistry?.pieces.length !== 1 ||
  packedRecipeRuntime.snapshot({ includeInterop: false }).plan.placements.filter(
    (placement) => placement.metadata.pieceId === 'packed-runtime-recipe-tree'
  ).length !== 1 ||
  packedRecipeRuntime.createRecipePieceSourceUrlMap({
    sourceRoots: { 'Packed Runtime Recipe Fixtures': '/packed-runtime-recipe-fixtures' },
  }).tree_single_A !== '/packed-runtime-recipe-fixtures/trees/runtime-recipe-tree.gltf'
) {
  throw new Error('packed recipe runtime facade did not expose generated pieces and source URLs');
}
const runtimeTreePiece = declareGameboardPiece({
  id: 'packed-runtime-tree',
  assetId: 'tree_single_A',
  source: 'Packed Consumer Fixtures',
  role: 'tree',
});
const runtimePieceInspection = runtime.inspectPiecePlacement(runtimeTreePiece, {
  count: 1,
  seed: 'packed-consumer-runtime-piece-inspection',
});
const runtimePiecePlacements = runtime.createPiecePlacements(runtimeTreePiece, {
  count: 1,
  seed: 'packed-consumer-runtime-piece-create',
});
const runtimePieceEntities = runtime.spawnPiece(runtimeTreePiece, {
  count: 1,
  seed: 'packed-consumer-runtime-piece-spawn',
});
const runtimeLayoutEntities = runtime.spawnLayoutFill({
  seed: 'packed-consumer-runtime-layout-fill',
  rules: [{ id: 'runtime-crates', archetype: 'scatter', assetId: 'crate_A_small', count: 1 }],
});
if (
  runtimePieceInspection.siteInspection.selectedCount !== 1 ||
  runtimePiecePlacements.length !== 1 ||
  runtimePieceEntities.length !== 1 ||
  runtimeLayoutEntities.length !== 1
) {
  throw new Error('packed runtime piece/layout facade failed');
}
const runtimeRegistryRuntime = createGameboardRuntime(
  createGameboardBuilder({
    seed: 'packed-consumer-runtime-registry',
    shape: { kind: 'rectangle', width: 4, height: 2 },
  }).build()
);
const runtimePieceRegistry = createGameboardPieceRegistry([
  runtimeTreePiece,
  {
    id: 'packed-runtime-tree-b',
    assetId: 'tree_single_B',
    source: 'Packed Consumer Fixtures',
    role: 'tree',
    tags: ['nature'],
  },
  {
    id: 'packed-runtime-crate',
    assetId: 'crate_A_small',
    source: 'Packed Consumer Fixtures',
    role: 'scatter',
    tags: ['camp'],
    metadata: { sourceRelativePath: 'props/crate.gltf' },
  },
]);
const runtimeRegistryAnalysis = runtimeRegistryRuntime.analyzePieceRegistry(runtimePieceRegistry, {
  checks: [{ id: 'packed-runtime-nature-pool', mode: 'pool', selection: { roles: ['tree'] } }],
});
const runtimeSelectedTrees = runtimeRegistryRuntime.selectPieces(runtimePieceRegistry, { roles: ['tree'] });
const runtimeCampRules = runtimeRegistryRuntime.createPieceFillRules(runtimePieceRegistry, {
  selection: { tags: ['camp'] },
  count: 1,
});
const runtimeNaturePoolRule = runtimeRegistryRuntime.createPiecePoolFillRule(runtimeSelectedTrees, {
  id: 'packed-runtime-nature-pool',
  count: 2,
});
const runtimeRegistryFills = [
  { id: 'packed-runtime-nature-pool', mode: 'pool', selection: { roles: ['tree'] }, count: 2 },
  { ruleIdPrefix: 'packed-runtime-camp', selection: { tags: ['camp'] }, count: 1 },
];
const runtimeRegistryFillAnalysis = runtimeRegistryRuntime.analyzePieceFills(runtimePieceRegistry, runtimeRegistryFills, {
  seed: 'packed-consumer-runtime-registry-fills',
});
const runtimeRegistryFillInspection = runtimeRegistryRuntime.inspectPieceFills(runtimePieceRegistry, runtimeRegistryFills, {
  seed: 'packed-consumer-runtime-registry-fills',
});
const runtimeRegistryFillEntities = runtimeRegistryRuntime.spawnPieceFills(runtimePieceRegistry, runtimeRegistryFills, {
  seed: 'packed-consumer-runtime-registry-fills',
});
const runtimeRegistrySourceUrls = runtimeRegistryRuntime.createPieceSourceUrlMap(runtimePieceRegistry, {
  sourceRoots: { 'Packed Consumer Fixtures': '/packed-consumer-fixtures' },
});
if (
  runtimeRegistryAnalysis.errors.length !== 0 ||
  runtimeSelectedTrees.length !== 2 ||
  runtimeCampRules.length !== 1 ||
  runtimeNaturePoolRule.assets?.length !== 2 ||
  runtimeRegistryFillAnalysis.placementCount !== 3 ||
  runtimeRegistryFillInspection.placements.length !== 3 ||
  runtimeRegistryFillEntities.length !== 3 ||
  runtimeRegistrySourceUrls.crate_A_small !== '/packed-consumer-fixtures/props/crate.gltf'
) {
  throw new Error('packed runtime registry facade failed');
}
const fillAnalysis = analyzeGameboardLayoutFill(plan, {
  seed: 'packed-consumer-layout-analysis',
  rules: [{ id: 'trees', archetype: 'tree', assetId: 'tree_single_A', count: 1 }],
});
if (fillAnalysis.errorCount !== 0 || fillAnalysis.placementCount !== 1) {
  throw new Error(\`packed layout analysis failed: \${JSON.stringify(fillAnalysis)}\`);
}
const siteInspection = inspectGameboardLayoutSites(plan, {
  count: 1,
  seed: 'packed-consumer-site-inspection',
  criteria: { allowOccupied: false },
});
if (siteInspection.selectedCount !== 1 || siteInspection.candidateCount < 1) {
  throw new Error(\`packed layout site inspection failed: \${JSON.stringify(siteInspection)}\`);
}
const harborBuilder = createGameboardBuilder({
  seed: 'packed-consumer-harbor',
  shape: { kind: 'rectangle', width: 3, height: 3 },
});
for (let q = 0; q < 3; q += 1) {
  harborBuilder.setTerrain({ q, r: 2 }, 'water');
  harborBuilder.setCoastEdges({ q, r: 1 }, [1]);
}
const harborPlan = harborBuilder.build();
const footprintBase = harborPlan.placements[0];
if (!footprintBase) {
  throw new Error('packed consumer fixture did not produce base placements');
}
const spawnGroupPlan = planGameboardSpawnGroups(harborPlan, {
  seed: 'packed-consumer-spawn-groups',
  groups: [
    { id: 'player', count: 1, terrain: 'grass' },
    { id: 'enemy', count: 1, terrain: 'grass', minDistanceFromGroups: 1, pathToGroups: ['player'] },
  ],
});
if (spawnGroupPlan.errors.length > 0 || spawnGroupPlan.routeChecks[0]?.found !== true) {
  throw new Error('packed spawn group planner failed: ' + JSON.stringify(spawnGroupPlan));
}
harborPlan.placements.push({
  ...footprintBase,
  id: 'packed-consumer-footprint',
  tileKey: '0,0',
  coordinates: { q: 0, r: 0 },
  assetId: 'external:gatehouse',
  kind: 'prop',
  layer: 'feature',
  requiresExtra: true,
  metadata: {
    layoutBlocksMovement: true,
    layoutFootprintTiles: '0,0|1,0',
    layoutOccupancyGroup: 'packed-gatehouse',
  },
});
const harborPlacements = createGameboardLayoutPlacements(harborPlan, {
  archetype: 'harbor',
  assetId: 'building_docks_blue',
  count: 1,
  seed: 'packed-consumer-harbor',
  requiresExtra: true,
});
const packedCustomArchetypes = createGameboardLayoutArchetypeRegistry({
  'packed-camp-supply': {
    id: 'packed-camp-supply',
    label: 'Packed Camp Supply',
    kind: 'prop',
    layer: 'feature',
    criteria: { terrain: ['grass', 'road'], allowOccupied: true, maxPerTile: 2 },
  },
});
const packedCustomRecipe = createGameboardRecipe(
  { seed: 'packed-custom-archetype', shape: { kind: 'rectangle', width: 1, height: 1 } },
  [],
  { layoutArchetypes: packedCustomArchetypes }
);
const packedCustomRecipeArchetypes = createGameboardLayoutArchetypeRegistryFromRecipe(packedCustomRecipe);
if (GAMEBOARD_LAYOUT_ARCHETYPES.harbor.criteria.requiredAdjacentTerrain !== 'water' || harborPlacements.length !== 1) {
  throw new Error('packed harbor archetype did not select a coast tile with adjacent water');
}
if (packedCustomRecipeArchetypes?.['packed-camp-supply']?.kind !== 'prop') {
  throw new Error('packed custom recipe archetype registry failed');
}
const shipyardPiece = declareGameboardPiece({
  id: 'packed-local-shipyard',
  assetId: 'packed-local:shipyard',
  source: 'Packed Consumer Fixtures',
  role: 'harbor',
  metadata: { fixture: true },
});
const shipyardInspection = inspectGameboardPiecePlacement(harborPlan, shipyardPiece, {
  count: 1,
  seed: 'packed-consumer-shipyard-piece',
  idPrefix: 'packed-shipyard',
});
const shipyardOptions = createGameboardLayoutPlacementOptionsFromPiece(shipyardPiece, {
  count: 1,
  seed: 'packed-consumer-shipyard-piece',
  idPrefix: 'packed-shipyard',
  occupancyGuard: true,
});
const shipyardPlacements = createGameboardLayoutPlacementsFromPiece(harborPlan, shipyardPiece, {
  count: 1,
  seed: 'packed-consumer-shipyard-piece',
  idPrefix: 'packed-shipyard',
  occupancyGuard: true,
});
const shipyardFillInspection = inspectSeededGameboardPieceFills(
  harborPlan,
  createGameboardPieceRegistry([shipyardPiece]),
  [{ selection: { ids: ['packed-local-shipyard'] }, count: 1 }],
  { seed: 'packed-consumer-shipyard-fill' }
);
if (
  shipyardInspection.siteInspection.selectedCount !== 1 ||
  shipyardPlacements.length !== 1 ||
  shipyardOptions.occupancyGuard !== true ||
  shipyardPlacements[0]?.occupancyGuard !== true ||
  shipyardPlacements[0]?.metadata?.pieceId !== 'packed-local-shipyard' ||
  shipyardPlacements[0]?.metadata?.pieceRole !== 'harbor' ||
  shipyardPlacements[0]?.requiresExtra !== true
) {
  throw new Error(\`packed piece placement helper failed: \${JSON.stringify(shipyardInspection)}\`);
}
if (
  shipyardFillInspection.errors.length !== 0 ||
  shipyardFillInspection.analysis.placementCount !== 1 ||
  shipyardFillInspection.placements[0]?.metadata?.pieceId !== 'packed-local-shipyard'
) {
  throw new Error(\`packed piece fill inspection failed: \${JSON.stringify(shipyardFillInspection)}\`);
}
const shipyardPlan = appendGameboardLayoutPlacementsToPlan(harborPlan, shipyardPlacements);
if (!shipyardPlan.placements.some((placement) => placement.id === 'packed-shipyard:0')) {
  throw new Error('packed layout append helper did not persist generated piece placement');
}
const footprintPlacement = harborPlan.placements.find((placement) => placement.id === 'packed-consumer-footprint');
if (!footprintPlacement) {
  throw new Error('packed consumer fixture did not produce footprint placement');
}
const footprint = gameboardPlacementFootprintKeys(footprintPlacement);
const interopSnapshot = createGameboardInteropSnapshot(harborPlan);
const interopIndex = createGameboardInteropSnapshotIndex(interopSnapshot);
const occupancyRelations = selectGameboardInteropRelations(interopIndex, {
  name: 'PlacementOccupiesTile',
  fromId: 'placement:packed-consumer-footprint',
});
const coveredTileRelations = selectGameboardInteropRelations(interopIndex, {
  name: 'PlacementOccupiesTile',
  toId: 'tile:1,0',
});
if (
  footprint.join('|') !== '0,0|1,0' ||
  occupancyRelations.length !== 2 ||
  !coveredTileRelations.some((relation) => relation.fromId === 'placement:packed-consumer-footprint') ||
  !interopIndex.entitiesById.has('tile:1,0')
) {
  throw new Error('packed occupancy helpers or interop occupancy relations did not include the full footprint');
}
const footprintWorld = createGameboardWorld(harborPlan);
const blockedFootprintInspection = inspectGameboardPlacementOccupancy(footprintWorld, {
  at: '1,0',
  kind: 'unit',
});
if (
  blockedFootprintInspection.canOccupy ||
  !blockedFootprintInspection.blockers.some((blocker) => blocker.placement.id === 'packed-consumer-footprint')
) {
  throw new Error('packed Koota placement occupancy preflight did not catch a blocking footprint');
}
let occupancyGuardBlocked = false;
try {
  spawnGameboardPlacement(footprintWorld, {
    id: 'blocked-packed-unit',
    at: '1,0',
    assetId: 'flag_red',
    kind: 'unit',
    occupancyGuard: true,
  });
} catch {
  occupancyGuardBlocked = true;
}
if (!occupancyGuardBlocked || findPlacementEntity(footprintWorld, 'blocked-packed-unit')) {
  throw new Error('packed Koota placement occupancy guard did not reject a blocking footprint');
}
const layoutGuardWorld = createGameboardWorld(
  createGameboardBuilder({
    seed: 'packed-consumer-layout-guard',
    shape: { kind: 'rectangle', width: 1, height: 1 },
  })
    .addFactionBuilding({ at: { q: 0, r: 0 }, faction: 'blue', building: 'market' })
    .build()
);
let layoutGuardBlocked = false;
try {
  spawnGameboardLayoutPlacements(layoutGuardWorld, {
    count: 1,
    seed: 'packed-consumer-layout-guard',
    idPrefix: 'packed-layout-guard',
    assetId: 'flag_blue',
    kind: 'unit',
    layer: 'unit',
    criteria: {
      terrain: 'grass',
      allowOccupied: true,
      blockingPlacementKinds: [],
    },
    occupancyGuard: true,
  });
} catch {
  layoutGuardBlocked = true;
}
if (!layoutGuardBlocked || findPlacementEntity(layoutGuardWorld, 'packed-layout-guard:0')) {
  throw new Error('packed layout occupancy guard did not reject a live-world blocker');
}
const guardedUnit = spawnGameboardPlacement(footprintWorld, {
  id: 'guarded-packed-unit',
  at: '1,0',
  assetId: 'flag_red',
  kind: 'unit',
  occupancyGuard: { ignorePlacementIds: ['packed-consumer-footprint'] },
});
if (guardedUnit.get(PlacementState)?.tileKey !== '1,0') {
  throw new Error('packed Koota placement occupancy guard did not honor ignored placement ids');
}
let actorGuardBlocked = false;
try {
  spawnGameboardActor(footprintWorld, {
    id: 'blocked-packed-actor',
    actorId: 'blocked-packed-actor',
    actorKind: 'enemy',
    at: '1,0',
    assetId: 'flag_red',
    kind: 'unit',
    occupancyGuard: true,
  });
} catch {
  actorGuardBlocked = true;
}
if (!actorGuardBlocked || findPlacementEntity(footprintWorld, 'blocked-packed-actor')) {
  throw new Error('packed actor spawn occupancy guard did not reject a blocking footprint');
}
const actorCenter = axialToWorld({ q: 2, r: 0 }, 0);
const offsetActor = spawnGameboardActor(footprintWorld, {
  id: 'offset-packed-actor',
  actorId: 'offset-packed-actor',
  actorKind: 'npc',
  at: '2,0',
  assetId: 'flag_green',
  kind: 'prop',
  positionOffset: { x: 0.2, z: -0.1 },
  occupancyGuard: true,
});
const offsetActorState = offsetActor.get(PlacementState);
if (
  !offsetActorState ||
  Math.abs(offsetActorState.position.x - (actorCenter.x + 0.2)) > 1e-9 ||
  Math.abs(offsetActorState.position.z - (actorCenter.z - 0.1)) > 1e-9
) {
  throw new Error('packed actor spawn did not preserve runtime placement offsets');
}
const movedActorCenter = axialToWorld({ q: 2, r: 1 }, 0);
const movedActor = moveGameboardActor(footprintWorld, 'offset-packed-actor', '2,1', {
  occupancyGuard: true,
});
const movedActorState = movedActor.get(PlacementState);
if (
  !movedActorState ||
  movedActorState.tileKey !== '2,1' ||
  Math.abs(movedActorState.position.x - (movedActorCenter.x + 0.2)) > 1e-9 ||
  Math.abs(movedActorState.position.z - (movedActorCenter.z - 0.1)) > 1e-9
) {
  throw new Error('packed actor move did not resolve actor ids or preserve offsets');
}
const coveredTile = findTileEntity(footprintWorld, '1,0');
const footprintEntity = findPlacementEntity(footprintWorld, 'packed-consumer-footprint');
const occupancyValue = coveredTile && footprintEntity ? footprintEntity.get(PlacementOccupiesTile(coveredTile)) : undefined;
if (!occupancyValue || occupancyValue.originTileKey !== '0,0' || occupancyValue.footprintIndex !== 1 || occupancyValue.blocksMovement !== true) {
  throw new Error('packed Koota PlacementOccupiesTile relation did not expose footprint occupancy metadata');
}
const occupancySnapshots = readPlacementOccupancyForTile(footprintWorld, '1,0');
const footprintSnapshot = occupancySnapshots.find((snapshot) => snapshot.placement.id === 'packed-consumer-footprint');
if (!footprintSnapshot || footprintSnapshot.footprintIndex !== 1) {
  throw new Error('packed Koota placement occupancy snapshot did not include the covered footprint tile');
}
const usage = runSimpleRpgUsageExample();
if (!usage.simulationSucceeded || usage.validationErrorCount !== 0) {
  throw new Error(\`packed SimpleRPG usage failed: \${JSON.stringify(usage)}\`);
}
const executableGuideApiSmoke = usage.executableGuideApiSmoke;
if (
  executableGuideApiSmoke.directPublicApiCount !== 40 ||
  executableGuideApiSmoke.publicTreatmentCount !== 404 ||
  executableGuideApiSmoke.guideScenarioCount !== 19 ||
  executableGuideApiSmoke.recipeValidationErrorCount !== 0 ||
  executableGuideApiSmoke.recipeGenerationErrorCount !== 0 ||
  executableGuideApiSmoke.externalSuggestedRole !== 'prop' ||
  executableGuideApiSmoke.externalSpawnKind !== 'prop' ||
  usage.executableGuideApiSmoke.directPublicApiCount !== executableGuideApiSmoke.directPublicApiCount
) {
  throw new Error(\`packed SimpleRPG executable guide API smoke failed: \${JSON.stringify(executableGuideApiSmoke)}\`);
}
if (
  usage.guidePublicApiCount !== 74 ||
  usage.exercisedGuidePublicApiCount !== 74 ||
  usage.missingGuidePublicApis.length !== 0 ||
  usage.staleGuidePublicApis.length !== 0
) {
  throw new Error(\`packed SimpleRPG guide API coverage was incomplete: \${JSON.stringify(usage)}\`);
}
const simpleRpgGuideCoverage = summarizeSimpleRpgGuidePublicApiExercises();
if (
  simpleRpgGuideCoverage.guidePublicApiCount !== 74 ||
  simpleRpgGuideCoverage.exercisedPublicApiCount !== 74 ||
  simpleRpgGuideCoverage.missingPublicApis.length !== 0 ||
  simpleRpgGuideCoverage.staleExercisePublicApis.length !== 0
) {
  throw new Error(\`packed SimpleRPG guide API exercise summary was incomplete: \${JSON.stringify(simpleRpgGuideCoverage)}\`);
}
const simpleRpgCoverageEvidenceModeEntries = Object.entries(simpleRpgGuideCoverage.exerciseModeCounts);
const simpleRpgCoverageWithExercises = summarizeGameboardCoverage({
  simpleRpgEvidence: {
    guidePublicApiCount: simpleRpgGuideCoverage.guidePublicApiCount,
    exercisedPublicApiCount: simpleRpgGuideCoverage.exercisedPublicApiCount,
    missingPublicApis: simpleRpgGuideCoverage.missingPublicApis,
    stalePublicApis: simpleRpgGuideCoverage.staleExercisePublicApis,
    executablePublicApiCount: executableGuideApiSmoke.directPublicApiCount,
    publicTreatmentCount: executableGuideApiSmoke.publicTreatmentCount,
    guideScenarioCount: executableGuideApiSmoke.guideScenarioCount,
    evidenceModeCounts: simpleRpgGuideCoverage.exerciseModeCounts,
    activeEvidenceModes: simpleRpgCoverageEvidenceModeEntries
      .filter(([, count]) => count > 0)
      .map(([mode]) => mode),
    inactiveEvidenceModes: simpleRpgCoverageEvidenceModeEntries
      .filter(([, count]) => count <= 0)
      .map(([mode]) => mode),
    publicApiExercises: simpleRpgGuideCoverage.exercises,
  },
});
const simpleRpgCoverageWithExercisesMarkdown =
  renderGameboardCoverageMarkdownFromCoverage(simpleRpgCoverageWithExercises);
if (
  simpleRpgCoverageWithExercises.simpleRpgEvidence?.publicApiExercises?.length !== 74 ||
  !simpleRpgCoverageWithExercisesMarkdown.includes('### SimpleRPG Exercise Matrix') ||
  !simpleRpgCoverageWithExercisesMarkdown.includes('| \`GameboardBuilder.addBridge\` | fixed-gameplay, visual-coverage | 2, 7, 9 | 2 |')
) {
  throw new Error('packed coverage report did not expose the SimpleRPG public API exercise matrix');
}
if (
  usage.scenarioSpawnGroupIds.join('|') !== 'player-start|elder|enemy' ||
  usage.scenarioSpawnLocationIds.length !== 3 ||
  usage.scenarioSpawnRouteCount !== 2
) {
  throw new Error(\`packed SimpleRPG scenario spawn groups were not resolved: \${JSON.stringify(usage)}\`);
}
if (
  usage.actorTargetRecordCount !== 2 ||
  usage.actorTargetScanCount !== 2 ||
  usage.nearestActorTargetId !== 'bandit' ||
  usage.actorTargetCommandKinds.join('|') !== 'attack-actor'
) {
  throw new Error(\`packed SimpleRPG actor-target usage was not resolved: \${JSON.stringify(usage)}\`);
}
const blueprintUsage = runBlueprintBoardUsageExample();
if (
  blueprintUsage.scenarioId !== 'docs-blueprint-board:intro' ||
  blueprintUsage.validationErrorCount !== 0 ||
  blueprintUsage.scenarioValidationErrorCount !== 0 ||
  blueprintUsage.spawnGroupIds.join('|') !== 'party|raiders' ||
  blueprintUsage.spawnLocationIds.length !== 3 ||
  blueprintUsage.successfulSpawnRouteCount !== 1 ||
  blueprintUsage.patrolRouteIds.join('|') !== 'raider-watch' ||
  blueprintUsage.completePatrolRouteCount !== 1 ||
  blueprintUsage.actorIds.length !== 3 ||
  blueprintUsage.questIds.length !== 1 ||
  blueprintUsage.worldActorCount !== 3 ||
  blueprintUsage.runtimeActorCount !== 3 ||
  blueprintUsage.interopActorCount !== 3 ||
  blueprintUsage.interopQuestCount !== 1 ||
  blueprintUsage.interopSpawnGroupCount !== 2 ||
  blueprintUsage.interopPatrolRouteCount !== 1
) {
  throw new Error(\`packed blueprint-board usage failed: \${JSON.stringify(blueprintUsage)}\`);
}
if (freeManifest.counts.total !== assetManifestModule.default.counts.total) {
  throw new Error('manifest/free export and assets/free JSON disagree');
}
if (scenarioModule.default.id !== 'docs-simple-rpg-scenario') {
  throw new Error('packaged JSON example export returned the wrong scenario');
}
if (blueprintBoardModule.default.scenarioId !== 'docs-blueprint-board:intro') {
  throw new Error('packaged blueprint JSON example export returned the wrong scenario');
}
const defaultRpgHandlers = createGameboardInteractionHandlerPreset('default-rpg');
const simulationActions = GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS;
const simulationSubpathActions = GAMEBOARD_SCENARIO_SIMULATION_SUBPATH_STEP_ACTIONS;
const simulationActorTargetCommandStep = {
  action: 'actor-target-command',
  sourceActor: 'packed-runtime-player',
  targetActorId: 'packed-runtime-player',
  requireReachable: true,
};
if (
  GAMEBOARD_INTERACTION_HANDLER_PRESETS.length !== 4 ||
  !isGameboardInteractionHandlerPreset('default-rpg') ||
  isGameboardInteractionHandlerPreset('missing-handler') ||
  defaultRpgHandlers.length !== 3
) {
  throw new Error('packed commands handler preset registry failed');
}
console.log(JSON.stringify({
  freeAssets: freeManifest.counts.total,
  commandHandlerPresets: GAMEBOARD_INTERACTION_HANDLER_PRESETS.length,
  defaultRpgHandlers: defaultRpgHandlers.length,
  harborArchetype: GAMEBOARD_LAYOUT_ARCHETYPES.harbor.id,
  customArchetype: packedCustomRecipeArchetypes?.['packed-camp-supply']?.id,
  blueprintTiles: blueprintInspection.plan.tiles.length,
  blueprintHarbors: blueprintInspection.counts.harbors,
  densityHarbors: densityHarbors.length,
  harborPlacements: harborPlacements.length,
  shipyardPieceCandidates: shipyardInspection.siteInspection.candidateCount,
  shipyardPiecePlacements: shipyardPlacements.length,
  shipyardFillPlacements: shipyardFillInspection.placements.length,
  shipyardPlanPlacements: shipyardPlan.placements.length,
  spawnGroupRoutes: spawnGroupPlan.routeChecks.length,
  footprintRelations: occupancyRelations.length,
  footprintRelationsForCoveredTile: coveredTileRelations.length,
  footprintPreflightBlockers: blockedFootprintInspection.blockers.length,
  footprintRelationIndex: occupancyValue.footprintIndex,
  footprintSnapshotCount: occupancySnapshots.length,
  footprintSnapshotIndex: footprintSnapshot.footprintIndex,
  layoutAnalysisPlacements: fillAnalysis.placementCount,
  layoutInspectionCandidates: siteInspection.candidateCount,
  layoutInspectionRejected: siteInspection.rejectedCount,
  manifestWarnings: manifestInspection.warningCount,
  planTiles: plan.tiles.length,
  scenarioExampleId: scenarioModule.default.id,
  usageScenarioId: usage.scenarioId,
  executableGuideApiCount: executableGuideApiSmoke.directPublicApiCount,
  blueprintUsageScenarioId: blueprintUsage.scenarioId,
  blueprintUsageActors: blueprintUsage.actorIds.length,
  blueprintUsageInteropActors: blueprintUsage.interopActorCount,
  actorTargetScanCount: usage.actorTargetScanCount,
  actorTargetRecordCount: usage.actorTargetRecordCount,
  nearestActorTargetId: usage.nearestActorTargetId,
  simulationActionCount: simulationActions.length,
  simulationSubpathActionCount: simulationSubpathActions.length,
  simulationActorTargetCommandStepAction: simulationActorTargetCommandStep.action,
  completedQuestIds: usage.completedQuestIds,
}, null, 2));
`,
    'utf8'
  );

  const smokeOutput = execFileSync(process.execPath, ['smoke.mjs'], {
    cwd: appRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const binOutput = execFileSync(
    join(appRoot, 'node_modules/.bin/medieval-hexagon-gameboard'),
    ['doctor', '--source', join(appRoot, 'missing-free')],
    {
      cwd: appRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  assert(
    smokeOutput.includes('"usageScenarioId": "docs-simple-rpg-scenario"'),
    'consumer smoke did not run usage example'
  );
  assert(
    smokeOutput.includes('"executableGuideApiCount": 40'),
    'consumer smoke did not run executable SimpleRPG guide API smoke'
  );
  assert(
    smokeOutput.includes('"blueprintUsageScenarioId": "docs-blueprint-board:intro"'),
    'consumer smoke did not run blueprint usage example'
  );
  assert(
    smokeOutput.includes('"defaultRpgHandlers": 3'),
    'consumer smoke did not run command preset registry'
  );
  assert(
    binOutput.includes('source exists: no'),
    'installed CLI doctor did not report the missing source'
  );

  console.log(
    keepTemp ? `packed consumer smoke passed in ${appRoot}` : 'packed consumer smoke passed'
  );
} finally {
  if (!keepTemp) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
