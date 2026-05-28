/**
 * Compile-time API attestation for the packed
 * `medieval-hexagon-gameboard` tarball.
 *
 * Writes a type-only `smoke-types.ts` source file into the consumer fixture
 * app and invokes the workspace's bundled `tsc --noEmit` against it. The
 * source imports every documented public symbol (values + types) from every
 * exported subpath of the installed tarball; if any signature drifts from the
 * published `.d.ts`, `tsc` exits non-zero and the orchestrator surfaces the
 * failure as a labelled-phase failure.
 *
 * This phase has zero runtime side effects on the library — it only validates
 * the shape of the published `.d.ts` surface. The runtime smoke lives in
 * {@link ./pack-install#runPackInstallSmoke}.
 *
 * Requires the `pack-install` phase to have already run (the consumer fixture
 * app must exist with the tarball installed); the orchestrator enforces this
 * ordering.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SmokeContext } from './_shared.js';

/**
 * Write a type-only smoke source into the consumer fixture app and run
 * `tsc --noEmit --strict` against it. Throws if `tsc` exits non-zero.
 */
export function runTypesAttestation(ctx: SmokeContext): void {
  const { workspaceRoot, appRoot } = ctx;
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
} from 'medieval-hexagon-gameboard';
// PRD R2e/R2o smoke coverage: every consumer-visible subpath must be
// importable. The new traits and errors subpaths landed during R2 and need
// to exist on the packed tarball's surface; consumers reach them as runtime
// values (not just types) so a value-import is the right smoke shape.
import { IsGameboardPlacement as IsGameboardPlacementFromTraits } from 'medieval-hexagon-gameboard/traits';
import { GameboardError as GameboardErrorFromErrors } from 'medieval-hexagon-gameboard/errors';
void IsGameboardPlacementFromTraits;
void GameboardErrorFromErrors;
import assetManifest from 'medieval-hexagon-gameboard/assets/free/manifest.json' with { type: 'json' };
import blueprintBoardJson from 'medieval-hexagon-gameboard/examples/blueprint-board.json' with { type: 'json' };
// PRD R4: SimpleRPG no longer ships through the published \`examples/\`
// subpath. The packed-consumer types attestation now uses
// \`blueprint-board.json\` as the canonical scenario fixture; SimpleRPG
// evidence stays bundled inside \`dist/cli.js\` via the runtime CLI smoke.
import {
  runBlueprintBoardUsageExample,
  type BlueprintBoardUsageSummary,
} from 'medieval-hexagon-gameboard/examples/blueprint-board-usage';
import {
  GAMEBOARD_INTERACTION_HANDLER_PRESETS,
  createGameboardInteractionHandlerPreset,
  isGameboardInteractionHandlerPreset,
  type GameboardInteractionHandlerPreset,
} from 'medieval-hexagon-gameboard/commands';
import {
  inspectMedievalHexagonManifest,
  type MedievalHexagonManifestInspection,
} from 'medieval-hexagon-gameboard/manifest/schema';
import { freeManifest as typedFreeManifest } from 'medieval-hexagon-gameboard/manifest/free';
import {
  KAYKIT_MEDIEVAL_FREE_LAYOUT,
  KAYKIT_MEDIEVAL_EXTRA_LAYOUT,
  detectKayKitLayout,
  type KayKitUpstreamLayout,
} from 'medieval-hexagon-gameboard/bootstrap/upstream-layout';
import {
  KAYKIT_BOOTSTRAP_ROOT,
  KAYKIT_FREE_GITHUB_OWNER,
  bootstrapKayKitAssets,
  kayKitFreeGithubTarballUrl,
  resolveBootstrapTargetRoot,
  verifyBootstrap,
  type BootstrapKayKitAssetsOptions,
  type BootstrapResult,
  type BootstrapVerificationReport,
} from 'medieval-hexagon-gameboard/bootstrap';
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
} from 'medieval-hexagon-gameboard/layout';
import {
  createGameboardNavigation,
  planGameboardSpawnGroups,
  type GameboardSpawnGroupPlan,
} from 'medieval-hexagon-gameboard/navigation';
import { gameboardPlacementFootprintKeys } from 'medieval-hexagon-gameboard/occupancy';
import {
  createGameboardLayoutPlacementsFromPiece,
  createGameboardLayoutPlacementOptionsFromPiece,
  createGameboardLayoutFillRuleFromPiece,
  createGameboardPieceRegistry,
  declareGameboardPiece,
  inspectGameboardPiecePlacement,
  type GameboardPieceRegistryAnalysis,
} from 'medieval-hexagon-gameboard/pieces';
import {
  inspectSeededGameboardPieceFills,
  type SeededGameboardPieceFillInspection,
} from 'medieval-hexagon-gameboard/rules';
import {
  createGameboardRuntime,
  createGameboardRuntimeFromRecipe,
  createGameboardRuntimeFromScenario,
  type GameboardRecipeGameRuntime,
  type GameboardRuntimeSnapshot,
} from 'medieval-hexagon-gameboard/runtime';
import {
  MedievalGameboardProvider,
  useGameboardActorsForTile,
  useGameboardActorSnapshots,
  useGameboardPlacementOccupancy,
  useGameboardRuntime,
  useGameboardRuntimeSnapshot,
  type GameboardRuntimeProviderProps,
} from 'medieval-hexagon-gameboard/react';
import {
  summarizeGameboardScenario as summarizeGameboardScenarioFromScenario,
  type GameboardScenario,
  type GameboardScenarioSummary as GameboardScenarioSummaryFromScenario,
} from 'medieval-hexagon-gameboard/scenario';
import {
  GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS as GAMEBOARD_SCENARIO_SIMULATION_SUBPATH_STEP_ACTIONS,
  type GameboardScenarioSimulationActorTargetCommandStep,
  type GameboardScenarioSimulationActorTargetsRecord,
} from 'medieval-hexagon-gameboard/simulation';
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
} from 'medieval-hexagon-gameboard/ingest';
import {
  readGameboardActors as readGameboardActorsFromActors,
  type GameboardActorKind as GameboardActorKindFromActors,
  type GameboardActorSnapshot as GameboardActorSnapshotFromActors,
} from 'medieval-hexagon-gameboard/actors';
import {
  GAMEBOARD_SCHEMA_VERSION,
  createGameboardBuilder as createGameboardBuilderFromGameboard,
  summarizeGameboardPlan as summarizeGameboardPlanFromGameboard,
  type GameboardPlanSummary as GameboardPlanSummaryFromGameboard,
  type GameboardPlacementSpec as GameboardPlacementSpecFromGameboard,
} from 'medieval-hexagon-gameboard/gameboard';
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
} from 'medieval-hexagon-gameboard/catalog';
import {
  findHexPath,
  hexKey as hexKeyFromCoordinates,
  parseHexKey,
  type HexPathResult as HexPathResultFromCoordinates,
} from 'medieval-hexagon-gameboard/coordinates';
import {
  analyzeExternalAssetCompatibility,
  externalAssetSpawnOptions,
  recommendExternalAssetFacing,
  type ExternalAssetCompatibilityReport,
  type ExternalAssetSpawnOptionsInput,
} from 'medieval-hexagon-gameboard/compatibility';
import {
  renderGameboardCoverageMarkdown as renderGameboardCoverageMarkdownFromCoverage,
  summarizeGameboardCoverage as summarizeGameboardCoverageFromCoverage,
  type GameboardCoverageReport as GameboardCoverageReportFromCoverage,
} from 'medieval-hexagon-gameboard/coverage';
import {
  readGameboardPlacements as readGameboardPlacementsFromKoota,
  type GameboardSnapshot as GameboardSnapshotFromKoota,
  type PlacementStateValue as PlacementStateValueFromKoota,
} from 'medieval-hexagon-gameboard/koota';
import {
  gameboardMovementActions as gameboardMovementActionsFromMovement,
  GAMEBOARD_MOVEMENT_PROFILES,
  type GameboardMovementStatus as GameboardMovementStatusFromMovement,
} from 'medieval-hexagon-gameboard/movement';
import {
  createMedievalGameboardBlueprintPlan,
  inspectMedievalGameboardBlueprint,
  type MedievalGameboardBlueprintInspection,
} from 'medieval-hexagon-gameboard/blueprint';
import {
  gameboardPatrolActions as gameboardPatrolActionsFromPatrol,
  type GameboardPatrolStatus as GameboardPatrolStatusFromPatrol,
} from 'medieval-hexagon-gameboard/patrol';
import {
  GAMEBOARD_QUEST_SCHEMA_VERSION,
  readGameboardQuests as readGameboardQuestsFromQuests,
  type GameboardQuestStatus as GameboardQuestStatusFromQuests,
} from 'medieval-hexagon-gameboard/quests';
import {
  projectWorldToGameboardPlan,
  readValidationGameboardPlanFromWorld,
} from 'medieval-hexagon-gameboard/projection';
import {
  GAMEBOARD_RECIPE_SCHEMA_VERSION,
  createGameboardRecipe as createGameboardRecipeFromRecipe,
  type AddPlacementRecipeStep as AddPlacementRecipeStepFromRecipe,
  type GameboardRecipe as GameboardRecipeFromRecipe,
} from 'medieval-hexagon-gameboard/recipe';
import {
  KAYKIT_HEX_WIDTH,
  createGameboardCoordinateSystem,
  type SpawnLocation as SpawnLocationFromGrid,
} from 'medieval-hexagon-gameboard/grid';
import {
  createGameboardInteropSnapshot as createGameboardInteropSnapshotFromInterop,
  type GameboardInteropSnapshot as GameboardInteropSnapshotFromInterop,
} from 'medieval-hexagon-gameboard/interop';
import {
  analyzeHexTileRegistry,
  createHexTileRegistry,
  createHexTileRegistryFromManifest,
  declareHexTile,
  type TileRegistryAnalysis,
} from 'medieval-hexagon-gameboard/registry';
import type {
  GameboardRuleConfig as GameboardRuleConfigFromRuleTypes,
  RuleSeverity as RuleSeverityFromRuleTypes,
} from 'medieval-hexagon-gameboard/rule-types';
import {
  HEX_EDGE_COUNT,
  edgeMask,
  selectRoadVariant,
  type GuideTilePermutation as GuideTilePermutationFromSelectors,
} from 'medieval-hexagon-gameboard/selectors';
import {
  runGameboardSystems as runGameboardSystemsFromSystems,
  type GameboardSystemEventRecord as GameboardSystemEventRecordFromSystems,
} from 'medieval-hexagon-gameboard/systems';
import {
  canStackAt,
  validateGameboardRules,
} from 'medieval-hexagon-gameboard/world-rules';
import {
  MEDIEVAL_HEXAGON_SCHEMA_VERSION,
  PACK_EDITIONS,
  TEXTURE_SETS,
  type HexCoordinates as HexCoordinatesFromTypes,
  type MedievalHexagonManifest as MedievalHexagonManifestFromTypes,
} from 'medieval-hexagon-gameboard/types';
import {
  createGameboardPlacementAssetUrlResolver,
  transformForHex,
  type GameboardPlacementAssetUrlResolver,
} from 'medieval-hexagon-gameboard/three';

const plan: GameboardPlan = createSeededGameboardPlan({
  seed: 'packed-consumer-types',
  shape: { kind: 'rectangle', width: 2, height: 2 },
  layoutDensity: { harbors: { count: 0 } },
});
const planSummary: GameboardPlanSummary = summarizeGameboardPlan(plan);
const blueprintUsage: BlueprintBoardUsageSummary = runBlueprintBoardUsageExample();
const blueprintScenarioId: string = blueprintBoardJson.scenarioId;
// Minimal in-tree scenario fixture for type attestation. Post-R4 the
// SimpleRPG scenario JSON is a test-only fixture and not part of the
// published \`examples/\`; the type smoke synthesises just enough shape to
// exercise the GameboardScenario surface.
const typesAttestationScenario: GameboardScenario = {
  schemaVersion: '1.0.0',
  id: 'packed-consumer-types-scenario',
  board: createGameboardRecipe(
    { seed: 'packed-consumer-types-board', shape: { kind: 'rectangle', width: 2, height: 2 } },
    []
  ),
};
const scenarioSummary: GameboardScenarioSummary = summarizeGameboardScenario(typesAttestationScenario);
const scenarioSummaryFromScenario: GameboardScenarioSummaryFromScenario =
  summarizeGameboardScenarioFromScenario(typesAttestationScenario);
const coverageReport: GameboardCoverageReport = summarizeGameboardCoverage();
const coverageReportFromCoverage: GameboardCoverageReportFromCoverage =
  summarizeGameboardCoverageFromCoverage();
const coverageMarkdown: string = renderGameboardCoverageMarkdownFromCoverage(coverageReportFromCoverage);
const manifestInspection: MedievalHexagonManifestInspection = inspectMedievalHexagonManifest(assetManifest);
const ingestSourceRoot: string = defaultSourceRoot('free', 'packed-consumer');
const ingestExpectedCount: number = expectedModelCount('free');
const ingestValidation: ValidateSourceResult = validateSourceRoot('/packed-consumer/missing-source', 'extra');
const ingestManifestOptions: GenerateManifestOptions = {
  sourceRoot: ingestSourceRoot,
  edition: 'free',
  assetBasePath: 'assets/free',
};
const ingestModuleOptions: WriteManifestModuleOptions = {
  exportName: 'packedManifest',
  typeImportPath: 'medieval-hexagon-gameboard',
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
const scenarioRuntime = createGameboardRuntimeFromScenario(typesAttestationScenario);
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
const scenarioId: string = typesAttestationScenario.id;
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

  console.log('packed consumer types attestation passed');
}
