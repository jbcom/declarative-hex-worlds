/**
 * End-to-end SimpleRPG usage example that exercises the public API for fixed
 * and seeded boards, actors, movement, commands, quests, and interop snapshots.
 *
 * @module
 */
import { createGameboardInteractionHandlerPreset } from '@jbcom/medieval-hexagon-gameboard/commands';
import {
  analyzeExternalAssetCompatibility,
  analyzeHexTileRegistry,
  coloredUnitAssetId,
  createGameboardLayoutArchetypeRegistry,
  createGameboardLayoutFillRuleFromPiece,
  createGameboardPlanFromRecipe,
  createGameboardPlanFromTiles,
  createGameboardRecipe,
  createHexagonGameboardGrid,
  createHexTileRegistry,
  createManifestBundle,
  createMedievalGameboardBlueprintPlan,
  createMedievalGameboardBlueprintRecipe,
  createMedievalShowcaseBlueprintRecipe,
  createSeededGameboardPlan,
  declareGameboardPiece,
  declareHexTile,
  externalAssetSpawnOptions,
  factionBuildingAssetId,
  flagAssetId,
  freeManifest,
  inspectMedievalGameboardBlueprint,
  listCoastGuidePermutations,
  listPropClusterAssets,
  listRiverCrossingGuidePermutations,
  listRiverCurvyGuidePermutations,
  listRiverGuidePermutations,
  listRoadGuidePermutations,
  neutralUnitAssetId,
  recommendExternalAssetFacing,
  selectCoastVariant,
  selectCoastVariantByLabel,
  selectManifestAssets,
  selectRiverCrossingVariant,
  selectRiverVariant,
  selectRiverVariantByLabel,
  selectRoadVariant,
  selectRoadVariantByLabel,
  selectSpawnCoordinates,
  textureFileName,
  validateGameboardRecipe,
  validateGameboardRecipeGeneration,
  type GameboardPlan,
} from '@jbcom/medieval-hexagon-gameboard';
import {
  listKayKitAssetPublicTreatments,
  listKayKitGuideScenarios,
  listKayKitGuidePublicApiCoverages,
  type KayKitGuidePublicApiCoverage,
} from '@jbcom/medieval-hexagon-gameboard/catalog';
import { createGameboardScenarioInteropSnapshot } from '@jbcom/medieval-hexagon-gameboard/interop';
import { selectGameboardSpawnLocations } from '@jbcom/medieval-hexagon-gameboard/navigation';
import { createGameboardRuntimeFromScenario } from '@jbcom/medieval-hexagon-gameboard/runtime';
import {
  createGameboardWorldFromScenario,
  validateGameboardScenario,
  type GameboardScenario,
} from '@jbcom/medieval-hexagon-gameboard/scenario';
import {
  createGameboardScenarioSimulationReport,
  runGameboardScenarioSimulationScript,
  type GameboardScenarioSimulationScript,
} from '@jbcom/medieval-hexagon-gameboard/simulation';
import scenarioJson from './simple-rpg-scenario.json';
import simulationScriptJson from './simple-rpg-simulation.script.json';

/** How the SimpleRPG fixture proves a guide-facing public API. */
export type SimpleRpgGuidePublicApiExerciseMode =
  | 'fixed-gameplay'
  | 'seeded-generation'
  | 'packaged-scenario'
  | 'catalog-contract'
  | 'executable-smoke'
  | 'blueprint-recipe'
  | 'manifest-package'
  | 'compatibility-adapter'
  | 'package-boundary'
  | 'visual-coverage';

/** One guide-facing API surface and the SimpleRPG evidence that exercises it. */
export interface SimpleRpgGuidePublicApiExercise {
  /** Public API surface from `listKayKitGuidePublicApiCoverages()`. */
  readonly publicApi: string;
  /** Integration mode that covers the API. */
  readonly mode: SimpleRpgGuidePublicApiExerciseMode;
  /** Human-readable fixture, docs, or package evidence. */
  readonly evidence: string;
  /** One-based guide pages represented by the API coverage row. */
  readonly pages: readonly number[];
  /** Guide scenario ids represented by the API coverage row. */
  readonly scenarioIds: readonly string[];
  /** Unique asset count covered by the API row. */
  readonly assetCount: number;
  /** Visual artifacts linked by the guide scenarios that use the API. */
  readonly visualArtifacts: readonly string[];
}

/** Summary that fails closed when SimpleRPG stops accounting for guide APIs. */
export interface SimpleRpgGuidePublicApiExerciseCoverage {
  /** Number of guide-facing public APIs currently reported by the catalog. */
  readonly guidePublicApiCount: number;
  /** Number of current guide-facing APIs represented by SimpleRPG evidence. */
  readonly exercisedPublicApiCount: number;
  /** Current guide APIs that are not represented in SimpleRPG evidence. */
  readonly missingPublicApis: readonly string[];
  /** Evidence rows that no longer correspond to a current guide API. */
  readonly staleExercisePublicApis: readonly string[];
  /** Exercise counts by evidence mode. */
  readonly exerciseModeCounts: Readonly<Record<SimpleRpgGuidePublicApiExerciseMode, number>>;
  /** Joined exercise rows with guide page and artifact metadata. */
  readonly exercises: readonly SimpleRpgGuidePublicApiExercise[];
}

interface SimpleRpgGuidePublicApiExerciseEvidence {
  readonly mode: SimpleRpgGuidePublicApiExerciseMode;
  readonly evidence: string;
}

const SIMPLE_RPG_EXECUTABLE_GUIDE_PUBLIC_APIS = [
  'analyzeHexTileRegistry',
  'coloredUnitAssetId',
  'createGameboardLayoutArchetypeRegistry',
  'createGameboardLayoutFillRuleFromPiece',
  'createGameboardPlanFromRecipe',
  'createGameboardPlanFromTiles',
  'createHexagonGameboardGrid',
  'createManifestBundle',
  'createMedievalGameboardBlueprintPlan',
  'createMedievalGameboardBlueprintRecipe',
  'createMedievalShowcaseBlueprintRecipe',
  'createSeededGameboardPlan',
  'declareHexTile',
  'externalAssetSpawnOptions',
  'factionBuildingAssetId',
  'flagAssetId',
  'freeManifest',
  'inspectMedievalGameboardBlueprint',
  'listCoastGuidePermutations',
  'listKayKitAssetPublicTreatments',
  'listKayKitGuideScenarios',
  'listPropClusterAssets',
  'listRiverCrossingGuidePermutations',
  'listRiverCurvyGuidePermutations',
  'listRiverGuidePermutations',
  'listRoadGuidePermutations',
  'neutralUnitAssetId',
  'recommendExternalAssetFacing',
  'selectCoastVariant',
  'selectCoastVariantByLabel',
  'selectManifestAssets',
  'selectRiverCrossingVariant',
  'selectRiverVariant',
  'selectRiverVariantByLabel',
  'selectRoadVariant',
  'selectRoadVariantByLabel',
  'selectSpawnCoordinates',
  'textureFileName',
  'validateGameboardRecipe',
  'validateGameboardRecipeGeneration',
] as const;

const SIMPLE_RPG_GUIDE_PUBLIC_API_EXERCISE_EVIDENCE = {
  'GameboardBuilder.addBridge': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board places a bridge beside the harbor approach.',
  },
  'GameboardBuilder.addConstructionSite': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board places a staged worksite off the golden path.',
  },
  'GameboardBuilder.addElevationRamp': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board places a ramp against an elevated tile.',
  },
  'GameboardBuilder.addFactionBuilding': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed and packaged SimpleRPG boards place faction buildings.',
  },
  'GameboardBuilder.addFlag': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board places a faction flag and runtime actors use flag assets.',
  },
  'GameboardBuilder.addForest': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed and seeded SimpleRPG boards include forests and tree scatter.',
  },
  'GameboardBuilder.addFortification': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board places a town wall segment with enclosure metadata.',
  },
  'GameboardBuilder.addHarbor': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed and seeded SimpleRPG boards include a playable harbor/coast relationship.',
  },
  'GameboardBuilder.addHill': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed and seeded SimpleRPG boards include hill terrain and decorations.',
  },
  'GameboardBuilder.addMountainStack': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed, seeded, and packaged SimpleRPG boards place stacked mountains.',
  },
  'GameboardBuilder.addNature': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board places standalone nature assets.',
  },
  'GameboardBuilder.addNeutralStructure': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board places a neutral grain building.',
  },
  'GameboardBuilder.addProp': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG quest uses a registered crate prop as a passable actor target.',
  },
  'GameboardBuilder.addPropCluster': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board places a resource-cache cluster.',
  },
  'GameboardBuilder.addRiverPath': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board routes a curvy waterless river through the quest road.',
  },
  'GameboardBuilder.addRoadPath': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed, seeded, and packaged SimpleRPG boards use roads for movement routes.',
  },
  'GameboardBuilder.addSettlement': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board places a settlement home through the settlement alias.',
  },
  'GameboardBuilder.addSiegeProjectile': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board places a catapult projectile beside the town wall.',
  },
  'GameboardBuilder.addTransition': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board places a local-only texture transition and marks it EXTRA.',
  },
  'GameboardBuilder.addUnit': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board places colored and neutral EXTRA unit parts.',
  },
  'GameboardBuilder.addUnitPreset': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board places a composed soldier preset.',
  },
  'GameboardBuilder.scatterDecorations': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed and seeded SimpleRPG boards scatter decorations deterministically.',
  },
  'GameboardBuilder.setCoastEdges': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board marks the water edge as coast before adding a harbor.',
  },
  'GameboardBuilder.setElevation': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board raises a tile and then adds an elevation ramp.',
  },
  'GameboardBuilder.setTerrain': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board authors a full water row and seeded generation fills terrain.',
  },
  'GameboardBuilder.setTileAsset': {
    mode: 'fixed-gameplay',
    evidence: 'Fixed and packaged SimpleRPG boards override authored tile assets and tags.',
  },
  'NOTICE.md': {
    mode: 'package-boundary',
    evidence: 'Release/package audits keep KayKit attribution with the SimpleRPG packaged smoke.',
  },
  analyzeHexTileRegistry: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage analyzes a runtime tile registry in its executable guide API smoke.',
  },
  coloredUnitAssetId: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage resolves a colored unit asset id in executable smoke.',
  },
  createGameboardBuilder: {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board starts from the public fluent builder.',
  },
  createGameboardLayoutArchetypeRegistry: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage creates a layout archetype registry in executable smoke.',
  },
  createGameboardLayoutFillRuleFromPiece: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage creates a piece-backed layout fill rule in executable smoke.',
  },
  createGameboardPlanFromRecipe: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage compiles a recipe into a concrete plan in executable smoke.',
  },
  createGameboardPlanFromTiles: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage rebuilds a plan from explicit tiles in executable smoke.',
  },
  createGameboardRuntimeFromScenario: {
    mode: 'packaged-scenario',
    evidence: 'Packaged SimpleRPG usage creates a runtime facade directly from the scenario JSON.',
  },
  createHexagonGameboardGrid: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage creates a Honeycomb hexagon grid in executable smoke.',
  },
  createManifestBundle: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage bundles the FREE manifest in executable smoke.',
  },
  createMedievalGameboardBlueprintPlan: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage compiles a blueprint plan in executable smoke.',
  },
  createMedievalGameboardBlueprintRecipe: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage compiles a blueprint recipe in executable smoke.',
  },
  createMedievalShowcaseBlueprintRecipe: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage compiles the showcase blueprint recipe in executable smoke.',
  },
  createSeededGameboardPlan: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage builds a seeded board in executable smoke.',
  },
  declareHexTile: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage declares a tile for registry analysis in executable smoke.',
  },
  executeGameboardInteractionCommand: {
    mode: 'fixed-gameplay',
    evidence: 'SimpleRPG quest execution moves, interacts, attacks, and removes enemies through commands.',
  },
  externalAssetSpawnOptions: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage converts compatibility analysis into spawn options in executable smoke.',
  },
  factionBuildingAssetId: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage resolves a faction building asset id in executable smoke.',
  },
  flagAssetId: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage resolves a faction flag asset id in executable smoke.',
  },
  freeManifest: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage reads the FREE manifest in executable smoke.',
  },
  inspectMedievalGameboardBlueprint: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage inspects a blueprint in executable smoke.',
  },
  listCoastGuidePermutations: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage lists coast guide permutations in executable smoke.',
  },
  listKayKitAssetPublicTreatments: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage lists every KayKit asset public treatment in executable smoke.',
  },
  listKayKitGuideScenarios: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage lists every decomposed KayKit guide scenario in executable smoke.',
  },
  listPropClusterAssets: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage resolves prop-cluster assets in executable smoke.',
  },
  listRiverCrossingGuidePermutations: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage lists river crossing permutations in executable smoke.',
  },
  listRiverCurvyGuidePermutations: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage lists curvy river permutations in executable smoke.',
  },
  listRiverGuidePermutations: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage lists river permutations in executable smoke.',
  },
  listRoadGuidePermutations: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage lists road permutations in executable smoke.',
  },
  'medieval-hexagon-gameboard manifest': {
    mode: 'package-boundary',
    evidence: 'Package smoke validates the CLI manifest and packaged SimpleRPG imports together.',
  },
  neutralUnitAssetId: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage resolves a neutral unit asset id in executable smoke.',
  },
  'package.json files': {
    mode: 'package-boundary',
    evidence: 'Package audit verifies exports, files, examples, and SimpleRPG package imports.',
  },
  planGameboardInteractionCommand: {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG tests plan prop interaction and enemy attack commands.',
  },
  recommendExternalAssetFacing: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage recommends external asset facing in executable smoke.',
  },
  selectCoastVariant: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects a coast variant in executable smoke.',
  },
  selectCoastVariantByLabel: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects a labeled coast variant in executable smoke.',
  },
  selectManifestAssets: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects manifest assets in executable smoke.',
  },
  selectRiverCrossingVariant: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects a river crossing variant in executable smoke.',
  },
  selectRiverVariant: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects a river variant in executable smoke.',
  },
  selectRiverVariantByLabel: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects a labeled river variant in executable smoke.',
  },
  selectRoadVariant: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects a road variant in executable smoke.',
  },
  selectRoadVariantByLabel: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects a labeled road variant in executable smoke.',
  },
  selectSpawnCoordinates: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects raw deterministic spawn coordinates in executable smoke.',
  },
  spawnGameboardActor: {
    mode: 'fixed-gameplay',
    evidence: 'Fixed and seeded SimpleRPG fixtures spawn player, NPC, prop, and enemy actors.',
  },
  textureFileName: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage resolves a texture filename in executable smoke.',
  },
  validateGameboardRecipe: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage validates a compiled recipe in executable smoke.',
  },
  validateGameboardRecipeGeneration: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage validates recipe generation config in executable smoke.',
  },
} satisfies Readonly<Record<string, SimpleRpgGuidePublicApiExerciseEvidence>>;

/** Executable public helper smoke returned by the packaged SimpleRPG example. */
export interface SimpleRpgExecutableGuideApiSmokeSummary {
  /** Guide-facing public APIs directly invoked by this smoke helper. */
  readonly directPublicApis: readonly string[];
  /** Number of guide-facing public APIs directly invoked by this smoke helper. */
  readonly directPublicApiCount: number;
  /** Number of KayKit asset public treatment records listed from the catalog. */
  readonly publicTreatmentCount: number;
  /** Number of decomposed KayKit guide scenarios listed from the catalog. */
  readonly guideScenarioCount: number;
  /** One-based guide pages represented by the decomposed guide scenario catalog. */
  readonly guideScenarioPages: readonly number[];
  /** Number of assets in the FREE manifest bundle. */
  readonly manifestBundleAssetCount: number;
  /** Manifest asset ids selected by taxonomy/faction filters. */
  readonly selectedManifestAssetIds: readonly string[];
  /** Asset helper outputs used by SimpleRPG and downstream games. */
  readonly assetHelperIds: Readonly<{
    /** Faction-colored unit part id resolved from a unit part/faction/style tuple. */
    coloredUnit: string;
    /** Neutral unit or equipment asset id resolved from a neutral part. */
    neutralUnit: string;
    /** Faction-colored building id resolved from a building/faction tuple. */
    factionBuilding: string;
    /** Faction flag prop id resolved from a faction. */
    flag: string;
    /** Texture atlas filename resolved from a texture-set id. */
    textureFile: string;
  }>;
  /** Counts for guide permutation families exercised through selector helpers. */
  readonly guidePermutationCounts: Readonly<{
    /** Full road selector permutation count, including rotated masks. */
    roads: number;
    /** Full straight river selector permutation count, including waterless variants. */
    rivers: number;
    /** Full curvy river selector permutation count, including waterless variants. */
    curvyRivers: number;
    /** River crossing permutation count. */
    riverCrossings: number;
    /** Full coast selector permutation count, including waterless variants. */
    coasts: number;
  }>;
  /** Concrete selector asset ids returned by direct and label-based selectors. */
  readonly selectorAssetIds: readonly string[];
  /** Prop-cluster assets returned for a semantic resource cache. */
  readonly propClusterAssetIds: readonly string[];
  /** Number of raw deterministic spawn coordinates selected. */
  readonly rawSpawnCoordinateCount: number;
  /** Honeycomb hexagon-grid cell count. */
  readonly hexagonGridCellCount: number;
  /** Placement count for a plan rebuilt from explicit tiles. */
  readonly planFromTilesPlacementCount: number;
  /** Placement count for a plan compiled from a recipe. */
  readonly recipePlanPlacementCount: number;
  /** Recipe validation error count. */
  readonly recipeValidationErrorCount: number;
  /** Recipe generation validation error count. */
  readonly recipeGenerationErrorCount: number;
  /** Tile declaration count in the smoke registry. */
  readonly registryTileCount: number;
  /** Asset id normalized by the explicit tile declaration helper. */
  readonly declaredTileAssetId: string;
  /** Registry analysis warning count. */
  readonly registryWarningCount: number;
  /** Layout archetype ids created for custom placement recipes. */
  readonly layoutArchetypeIds: readonly string[];
  /** Fill rule id derived from a declared custom piece. */
  readonly layoutFillRuleId: string;
  /** Tile count in a generated seeded board. */
  readonly seededPlanTileCount: number;
  /** Tile count in a generated blueprint plan. */
  readonly blueprintPlanTileCount: number;
  /** Step count in a generated blueprint recipe. */
  readonly blueprintRecipeStepCount: number;
  /** Step count in the curated showcase blueprint recipe. */
  readonly showcaseRecipeStepCount: number;
  /** Feature count keys from blueprint inspection. */
  readonly blueprintInspectionFeatures: readonly string[];
  /** Suggested role for a non-hex external asset. */
  readonly externalSuggestedRole: string;
  /** Spawn kind for the external compatibility placement. */
  readonly externalSpawnKind: string;
  /** Rotation steps recommended for external actor facing. */
  readonly externalFacingRotationSteps: number;
}

/**
 * Compact verification summary returned by the packaged SimpleRPG example.
 *
 * The example intentionally uses the published public subpaths and packaged JSON
 * files so downstream apps can copy the flow as an integration smoke test.
 */
export interface SimpleRpgUsageSummary {
  /** Scenario id loaded from the packaged SimpleRPG JSON fixture. */
  readonly scenarioId: string;
  /** Count of scenario validation errors before runtime creation. */
  readonly validationErrorCount: number;
  /** Spawn group ids resolved from the scenario. */
  readonly scenarioSpawnGroupIds: readonly string[];
  /** Spawn location ids assigned to scenario spawn groups. */
  readonly scenarioSpawnLocationIds: readonly string[];
  /** Number of route checks proving scenario spawn groups can reach each other. */
  readonly scenarioSpawnRouteCount: number;
  /** Patrol route ids resolved from the scenario. */
  readonly scenarioPatrolRouteIds: readonly string[];
  /** Total patrol waypoint count across scenario patrol routes. */
  readonly scenarioPatrolWaypointCount: number;
  /** Deterministic ad hoc spawn ids selected from the runtime plan. */
  readonly spawnLocationIds: readonly string[];
  /** Entity count in the neutral scenario interop snapshot. */
  readonly interopEntityCount: number;
  /** Relation count in the neutral scenario interop snapshot. */
  readonly interopRelationCount: number;
  /** Whether the packaged simulation script satisfied all expectations. */
  readonly simulationSucceeded: boolean;
  /** Distinct system event types emitted by the simulation report. */
  readonly eventTypes: readonly string[];
  /** Number of actor-target scan records captured by the simulation report. */
  readonly actorTargetRecordCount: number;
  /** Number of actor-target scan steps executed by the simulation report. */
  readonly actorTargetScanCount: number;
  /** Distinct target actor ids discovered by actor-target scans. */
  readonly actorTargetTargetIds: readonly string[];
  /** Distinct target actor ids that were reachable by actor-aware pathing. */
  readonly reachableActorTargetIds: readonly string[];
  /** Nearest actor target selected by the first actor-target scan. */
  readonly nearestActorTargetId?: string;
  /** Distinct command kinds produced by actor-target command planning. */
  readonly actorTargetCommandKinds: readonly string[];
  /** Event types emitted by the runtime facade actor-target interaction. */
  readonly runtimeActorTargetEventTypes: readonly string[];
  /** Command kind selected by the runtime facade actor-target interaction. */
  readonly runtimeActorTargetCommandKind?: string;
  /** Whether the runtime facade interaction was handled by a preset handler. */
  readonly runtimeActorTargetHandled: boolean;
  /** Executable smoke coverage for guide-facing helper APIs used by games. */
  readonly executableGuideApiSmoke: SimpleRpgExecutableGuideApiSmokeSummary;
  /** Number of guide-facing public APIs currently reported by the catalog. */
  readonly guidePublicApiCount: number;
  /** Number of guide-facing APIs represented by SimpleRPG evidence. */
  readonly exercisedGuidePublicApiCount: number;
  /** Current guide APIs that are not represented in SimpleRPG evidence. */
  readonly missingGuidePublicApis: readonly string[];
  /** Evidence rows that no longer correspond to a current guide API. */
  readonly staleGuidePublicApis: readonly string[];
  /** Exercise counts by SimpleRPG evidence mode. */
  readonly guidePublicApiExerciseModes: Readonly<Record<SimpleRpgGuidePublicApiExerciseMode, number>>;
  /** Final tile key for each actor id after simulation. */
  readonly finalActorTiles: Readonly<Record<string, string>>;
  /** Quest ids completed by the packaged simulation script. */
  readonly completedQuestIds: readonly string[];
}

/**
 * Lists the SimpleRPG evidence rows for every guide-facing public API.
 */
export function listSimpleRpgGuidePublicApiExercises(): readonly SimpleRpgGuidePublicApiExercise[] {
  const coverageByPublicApi = new Map(
    listKayKitGuidePublicApiCoverages().map((coverage) => [coverage.publicApi, coverage] as const)
  );

  return Object.entries(SIMPLE_RPG_GUIDE_PUBLIC_API_EXERCISE_EVIDENCE)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([publicApi, evidence]) => {
      const coverage = coverageByPublicApi.get(publicApi);
      return exerciseFromCoverage(publicApi, evidence, coverage);
    });
}

/**
 * Summarizes whether the packaged SimpleRPG fixture accounts for the full guide
 * public API surface.
 */
export function summarizeSimpleRpgGuidePublicApiExercises(): SimpleRpgGuidePublicApiExerciseCoverage {
  const guidePublicApis = listKayKitGuidePublicApiCoverages().map((coverage) => coverage.publicApi);
  const guidePublicApiSet = new Set(guidePublicApis);
  const exercises = listSimpleRpgGuidePublicApiExercises();
  const exercisePublicApiSet = new Set(exercises.map((exercise) => exercise.publicApi));
  const missingPublicApis = guidePublicApis.filter((publicApi) => !exercisePublicApiSet.has(publicApi));
  const staleExercisePublicApis = exercises
    .map((exercise) => exercise.publicApi)
    .filter((publicApi) => !guidePublicApiSet.has(publicApi));

  return {
    guidePublicApiCount: guidePublicApis.length,
    exercisedPublicApiCount: guidePublicApis.length - missingPublicApis.length,
    missingPublicApis,
    staleExercisePublicApis,
    exerciseModeCounts: countExerciseModes(exercises),
    exercises,
  };
}

/**
 * Runs direct public helper calls that are useful to games but too low-level to
 * prove only through the playable scenario path.
 */
export function runSimpleRpgExecutableGuideApiSmoke(): SimpleRpgExecutableGuideApiSmokeSummary {
  const scenario = scenarioJson as GameboardScenario;
  const runtime = createGameboardWorldFromScenario(scenario);
  const manifestBundle = createManifestBundle([freeManifest]);
  const selectedManifestAssets = selectManifestAssets(manifestBundle, {
    categories: ['buildings'],
    factions: ['blue'],
  }).slice(0, 3);
  const roads = listRoadGuidePermutations();
  const rivers = listRiverGuidePermutations();
  const curvyRivers = listRiverCurvyGuidePermutations();
  const riverCrossings = listRiverCrossingGuidePermutations();
  const coasts = listCoastGuidePermutations();
  const publicTreatments = listKayKitAssetPublicTreatments();
  const guideScenarios = listKayKitGuideScenarios();
  const propClusterAssetIds = listPropClusterAssets('resource-cache', { includeExtra: true });
  const selectorAssetIds = [
    selectRoadVariant([0, 3]).assetId,
    selectRoadVariantByLabel('B').assetId,
    selectRiverVariant([0, 3], { waterless: true }).assetId,
    selectRiverVariantByLabel('A', { curvy: true }).assetId,
    selectRiverCrossingVariant('A', { waterless: true }).assetId,
    selectCoastVariant([0, 1], { waterless: true }).assetId,
    selectCoastVariantByLabel('E').assetId,
  ];
  const rawSpawns = selectSpawnCoordinates({
    shape: { kind: 'rectangle', width: 4, height: 3 },
    count: 2,
    seed: 'simple-rpg-executable-spawns',
    minDistance: 2,
  });
  const hexagonGridCellCount = [...createHexagonGameboardGrid({ radius: 2 })].length;
  const firstTile = runtime.plan.tiles.find((tile) => tile.key === '0,0') ?? runtime.plan.tiles[0];
  if (!firstTile) {
    throw new Error('SimpleRPG executable smoke requires at least one plan tile');
  }
  const planFromTiles: GameboardPlan = createGameboardPlanFromTiles({
    seed: 'simple-rpg-plan-from-tiles-smoke',
    shape: { kind: 'rectangle', width: 1, height: 1 },
    textureSet: runtime.plan.textureSet,
    tiles: [firstTile],
  });
  const recipe = createGameboardRecipe(
    { seed: 'simple-rpg-recipe-smoke', shape: { kind: 'rectangle', width: 2, height: 1 } },
    [{ action: 'addRoadPath', path: [{ q: 0, r: 0 }, { q: 1, r: 0 }] }]
  );
  const recipePlan = createGameboardPlanFromRecipe(recipe);
  const grassTileDeclaration = {
    id: 'simple-rpg-executable-grass',
    assetId: 'hex_grass',
    role: 'base',
    terrain: 'grass',
    bounds: freeManifest.assetsById['hex_grass']?.bounds,
  } as const;
  const declaredGrassTile = declareHexTile(grassTileDeclaration);
  const registry = createHexTileRegistry([grassTileDeclaration]);
  const registryAnalysis = analyzeHexTileRegistry(registry);
  const archetypes = createGameboardLayoutArchetypeRegistry([
    {
      id: 'simple-rpg-executable-cache',
      label: 'SimpleRPG Executable Cache',
      kind: 'prop',
      layer: 'feature',
      criteria: { terrain: 'grass', allowOccupied: true },
    },
  ]);
  const piece = declareGameboardPiece({
    id: 'simple-rpg-executable-crate',
    assetId: 'crate_A_small',
    source: 'SimpleRPG executable smoke',
    role: 'prop',
    kind: 'prop',
    layer: 'feature',
    archetype: 'simple-rpg-executable-cache',
  });
  const layoutFillRule = createGameboardLayoutFillRuleFromPiece(piece, {
    count: 1,
    archetypes,
  });
  const seededPlan = createSeededGameboardPlan({
    seed: 'simple-rpg-executable-seeded',
    shape: { kind: 'rectangle', width: 4, height: 3 },
    mountainStacks: 1,
    forestTiles: 1,
    hillTiles: 1,
    settlements: 1,
    scatterProps: 1,
    layoutDensity: { harbors: { count: 0 } },
  });
  const blueprintOptions = {
    seed: 'simple-rpg-executable-blueprint',
    shape: { kind: 'rectangle', width: 5, height: 4 },
    towns: 1,
    harbors: 0,
    waterFill: 0.15,
  } as const;
  const blueprintPlan = createMedievalGameboardBlueprintPlan(blueprintOptions);
  const blueprintRecipe = createMedievalGameboardBlueprintRecipe(blueprintOptions);
  const showcaseRecipe = createMedievalShowcaseBlueprintRecipe();
  const blueprintInspection = inspectMedievalGameboardBlueprint(blueprintOptions);
  const compatibilityReport = analyzeExternalAssetCompatibility({
    id: 'simple-rpg-external-tower',
    sourcePack: 'SimpleRPG executable smoke',
    bounds: { min: [-0.4, 0, -0.4], max: [0.4, 1, 0.4], size: [0.8, 1, 0.8] },
    intendedRole: 'tile',
    modelForward: '+z',
    boardForwardEdge: 1,
  });
  const externalSpawn = externalAssetSpawnOptions({
    id: 'simple-rpg-external-tower',
    at: '0,0',
    assetId: 'simple-rpg-external-tower',
    report: compatibilityReport,
  });
  const externalFacing = recommendExternalAssetFacing({ modelForward: '+z', boardForwardEdge: 1 });

  return {
    directPublicApis: [...SIMPLE_RPG_EXECUTABLE_GUIDE_PUBLIC_APIS],
    directPublicApiCount: SIMPLE_RPG_EXECUTABLE_GUIDE_PUBLIC_APIS.length,
    publicTreatmentCount: publicTreatments.length,
    guideScenarioCount: guideScenarios.length,
    guideScenarioPages: guideScenarios.map((scenario) => scenario.page),
    manifestBundleAssetCount: manifestBundle.assets.length,
    selectedManifestAssetIds: selectedManifestAssets.map((asset) => asset.id),
    assetHelperIds: {
      coloredUnit: coloredUnitAssetId('sword', 'blue', 'full'),
      neutralUnit: neutralUnitAssetId('hammer'),
      factionBuilding: factionBuildingAssetId('market', 'blue'),
      flag: flagAssetId('blue'),
      textureFile: textureFileName('winter'),
    },
    guidePermutationCounts: {
      roads: roads.length,
      rivers: rivers.length,
      curvyRivers: curvyRivers.length,
      riverCrossings: riverCrossings.length,
      coasts: coasts.length,
    },
    selectorAssetIds,
    propClusterAssetIds,
    rawSpawnCoordinateCount: rawSpawns.length,
    hexagonGridCellCount,
    planFromTilesPlacementCount: planFromTiles.placements.length,
    recipePlanPlacementCount: recipePlan.placements.length,
    recipeValidationErrorCount: validateGameboardRecipe(recipe).filter(
      (violation) => violation.severity === 'error'
    ).length,
    recipeGenerationErrorCount: validateGameboardRecipeGeneration(recipe).filter(
      (violation) => violation.severity === 'error'
    ).length,
    registryTileCount: registryAnalysis.tileCount,
    declaredTileAssetId: declaredGrassTile.assetId,
    registryWarningCount: registryAnalysis.warnings.length,
    layoutArchetypeIds: Object.keys(archetypes).sort(),
    layoutFillRuleId: layoutFillRule.id ?? piece.id,
    seededPlanTileCount: seededPlan.tiles.length,
    blueprintPlanTileCount: blueprintPlan.tiles.length,
    blueprintRecipeStepCount: blueprintRecipe.steps.length,
    showcaseRecipeStepCount: showcaseRecipe.steps.length,
    blueprintInspectionFeatures: Object.keys(blueprintInspection.counts).sort(),
    externalSuggestedRole: compatibilityReport.suggestedRole,
    externalSpawnKind: externalSpawn.kind,
    externalFacingRotationSteps: externalFacing.rotationSteps,
  };
}

/**
 * Runs the packaged SimpleRPG scenario and simulation through public APIs.
 */
export function runSimpleRpgUsageExample(): SimpleRpgUsageSummary {
  const scenario = scenarioJson as GameboardScenario;
  const script = simulationScriptJson as GameboardScenarioSimulationScript;
  const guideApiCoverage = summarizeSimpleRpgGuidePublicApiExercises();
  const executableGuideApiSmoke = runSimpleRpgExecutableGuideApiSmoke();
  const scenarioValidation = validateGameboardScenario(scenario);
  const runtime = createGameboardWorldFromScenario(scenario);
  const spawnLocations = selectGameboardSpawnLocations(runtime.plan, {
    count: 2,
    seed: `${scenario.id}:spawns`,
    terrain: ['grass', 'road'],
    profile: {
      blockedTerrain: ['water'],
      blockingPlacementKinds: ['structure', 'unit'],
    },
  });
  const interop = createGameboardScenarioInteropSnapshot(scenario, {
    spawnLocations: {
      count: 2,
      seed: `${scenario.id}:interop-spawns`,
      candidates: spawnLocations.map((spawn) => spawn.coordinates),
    },
  });
  const report = createGameboardScenarioSimulationReport(
    runGameboardScenarioSimulationScript(scenario, script),
    script.expectations
  );
  const facade = createGameboardRuntimeFromScenario(scenario);
  const actorTargetInteraction = facade.interactActorTarget(
    {
      sourceActor: 'player',
      hostileToSource: true,
      targetActorId: 'bandit',
      maxPathCost: 4,
    },
    {
      handlers: createGameboardInteractionHandlerPreset('default-rpg'),
      systems: false,
    }
  );

  return {
    scenarioId: scenario.id,
    validationErrorCount: scenarioValidation.filter((violation) => violation.severity === 'error')
      .length,
    scenarioSpawnGroupIds: runtime.spawnGroups?.groups.map((group) => group.id) ?? [],
    scenarioSpawnLocationIds:
      runtime.spawnGroups?.groups.flatMap((group) => group.locations.map((spawn) => spawn.id)) ?? [],
    scenarioSpawnRouteCount: runtime.spawnGroups?.routeChecks.length ?? 0,
    scenarioPatrolRouteIds: runtime.patrolRoutes?.routes.map((route) => route.id) ?? [],
    scenarioPatrolWaypointCount:
      runtime.patrolRoutes?.routes.reduce((total, route) => total + route.waypoints.length, 0) ?? 0,
    spawnLocationIds: spawnLocations.map((spawn) => spawn.id),
    interopEntityCount: interop.entities.length,
    interopRelationCount: interop.relations.length,
    simulationSucceeded: report.success,
    eventTypes: [...new Set(report.eventRecords.map((event) => event.type))],
    actorTargetRecordCount: report.actorTargets.length,
    actorTargetScanCount: report.actorTargets.length,
    actorTargetTargetIds: [...new Set(report.actorTargets.flatMap((scan) => scan.targetActorIds))],
    reachableActorTargetIds: [
      ...new Set(report.actorTargets.flatMap((scan) => scan.reachableActorIds)),
    ],
    nearestActorTargetId: report.actorTargets[0]?.nearestTarget?.actorId,
    actorTargetCommandKinds: [
      ...new Set(report.actorTargets.flatMap((scan) => scan.targets.map((target) => target.commandKind))),
    ],
    runtimeActorTargetEventTypes: actorTargetInteraction.eventRecords.map((event) => event.type),
    runtimeActorTargetCommandKind: actorTargetInteraction.targetCommand.command?.kind,
    runtimeActorTargetHandled: actorTargetInteraction.dispatch?.execution.status === 'handled',
    executableGuideApiSmoke,
    guidePublicApiCount: guideApiCoverage.guidePublicApiCount,
    exercisedGuidePublicApiCount: guideApiCoverage.exercisedPublicApiCount,
    missingGuidePublicApis: guideApiCoverage.missingPublicApis,
    staleGuidePublicApis: guideApiCoverage.staleExercisePublicApis,
    guidePublicApiExerciseModes: guideApiCoverage.exerciseModeCounts,
    finalActorTiles: Object.fromEntries(
      report.actors.map((actor) => [actor.actorId, actor.placement.tileKey] as const)
    ),
    completedQuestIds: report.quests.filter((quest) => quest.status === 'completed').map((quest) => quest.questId),
  };
}

function exerciseFromCoverage(
  publicApi: string,
  evidence: SimpleRpgGuidePublicApiExerciseEvidence,
  coverage: KayKitGuidePublicApiCoverage | undefined
): SimpleRpgGuidePublicApiExercise {
  return {
    publicApi,
    mode: evidence.mode,
    evidence: evidence.evidence,
    pages: coverage?.pages ?? [],
    scenarioIds: coverage?.scenarioIds ?? [],
    assetCount: coverage?.assetCounts.unique ?? 0,
    visualArtifacts: coverage?.visualArtifacts ?? [],
  };
}

function countExerciseModes(
  exercises: readonly SimpleRpgGuidePublicApiExercise[]
): Readonly<Record<SimpleRpgGuidePublicApiExerciseMode, number>> {
  const counts: Record<SimpleRpgGuidePublicApiExerciseMode, number> = {
    'fixed-gameplay': 0,
    'seeded-generation': 0,
    'packaged-scenario': 0,
    'catalog-contract': 0,
    'executable-smoke': 0,
    'blueprint-recipe': 0,
    'manifest-package': 0,
    'compatibility-adapter': 0,
    'package-boundary': 0,
    'visual-coverage': 0,
  };
  for (const exercise of exercises) {
    counts[exercise.mode] += 1;
  }
  return counts;
}
