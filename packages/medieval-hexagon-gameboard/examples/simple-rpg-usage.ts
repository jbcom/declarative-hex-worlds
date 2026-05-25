/**
 * End-to-end SimpleRPG usage example that exercises the public API for fixed
 * and seeded boards, actors, movement, commands, quests, and interop snapshots.
 *
 * @module
 */
import { createGameboardInteractionHandlerPreset } from '@jbcom/medieval-hexagon-gameboard/commands';
import {
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
    mode: 'seeded-generation',
    evidence: 'SimpleRPG registers custom tile declarations and validates them during game setup.',
  },
  coloredUnitAssetId: {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG EXTRA colored unit placement resolves colored unit asset ids.',
  },
  createGameboardBuilder: {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board starts from the public fluent builder.',
  },
  createGameboardLayoutArchetypeRegistry: {
    mode: 'seeded-generation',
    evidence: 'Seeded SimpleRPG custom-piece generation is tested with the layout registry pipeline.',
  },
  createGameboardLayoutFillRuleFromPiece: {
    mode: 'seeded-generation',
    evidence: 'Seeded SimpleRPG piece fills exercise piece-to-layout fill generation.',
  },
  createGameboardPlanFromRecipe: {
    mode: 'packaged-scenario',
    evidence: 'Packaged SimpleRPG JSON scenario compiles its board recipe into a plan.',
  },
  createGameboardPlanFromTiles: {
    mode: 'catalog-contract',
    evidence: 'Guide catalog and package consumer smoke keep tile-list plan creation covered.',
  },
  createGameboardRuntimeFromScenario: {
    mode: 'packaged-scenario',
    evidence: 'Packaged SimpleRPG usage creates a runtime facade directly from the scenario JSON.',
  },
  createHexagonGameboardGrid: {
    mode: 'visual-coverage',
    evidence: 'SimpleRPG browser scenes render the fixed and seeded plans through the grid renderer.',
  },
  createManifestBundle: {
    mode: 'manifest-package',
    evidence: 'Package and coverage audits compare the FREE manifest bundle used by SimpleRPG scenes.',
  },
  createMedievalGameboardBlueprintPlan: {
    mode: 'blueprint-recipe',
    evidence: 'Blueprint-board companion example covers board-scale generation next to SimpleRPG.',
  },
  createMedievalGameboardBlueprintRecipe: {
    mode: 'blueprint-recipe',
    evidence: 'Blueprint-board companion example covers serialized recipe generation.',
  },
  createMedievalShowcaseBlueprintRecipe: {
    mode: 'blueprint-recipe',
    evidence: 'Showcase visual coverage exercises the curated blueprint recipe path.',
  },
  createSeededGameboardPlan: {
    mode: 'seeded-generation',
    evidence: 'Seeded SimpleRPG fixture builds the locked random board with seeded generation.',
  },
  declareHexTile: {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG declares quest road and safe grass tiles for registry application.',
  },
  executeGameboardInteractionCommand: {
    mode: 'fixed-gameplay',
    evidence: 'SimpleRPG quest execution moves, interacts, attacks, and removes enemies through commands.',
  },
  externalAssetSpawnOptions: {
    mode: 'compatibility-adapter',
    evidence: 'Local SimpleRPG third-party visual scene applies compatibility spawn options.',
  },
  factionBuildingAssetId: {
    mode: 'fixed-gameplay',
    evidence: 'SimpleRPG settlement and harbor structures resolve faction building assets.',
  },
  flagAssetId: {
    mode: 'fixed-gameplay',
    evidence: 'SimpleRPG fixed board, actors, and spawn markers use faction flag helpers.',
  },
  freeManifest: {
    mode: 'manifest-package',
    evidence: 'SimpleRPG package and browser smoke load the published FREE manifest.',
  },
  inspectMedievalGameboardBlueprint: {
    mode: 'blueprint-recipe',
    evidence: 'Blueprint-board companion example inspects generated board coverage beside SimpleRPG.',
  },
  listCoastGuidePermutations: {
    mode: 'catalog-contract',
    evidence: 'Guide coverage and visual catalog prove coast permutations used by SimpleRPG harbors.',
  },
  listKayKitAssetPublicTreatments: {
    mode: 'catalog-contract',
    evidence: 'Coverage ledger joins every guide asset to its public treatment before package smoke.',
  },
  listKayKitGuideScenarios: {
    mode: 'catalog-contract',
    evidence: 'Coverage ledger enumerates all guide scenarios and links SimpleRPG artifacts.',
  },
  listPropClusterAssets: {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG resource-cache cluster resolves its authored asset list.',
  },
  listRiverCrossingGuidePermutations: {
    mode: 'catalog-contract',
    evidence: 'Guide coverage proves river crossing selectors and visual artifacts.',
  },
  listRiverCurvyGuidePermutations: {
    mode: 'catalog-contract',
    evidence: 'Fixed SimpleRPG uses a curvy river and catalog coverage proves all curvy variants.',
  },
  listRiverGuidePermutations: {
    mode: 'catalog-contract',
    evidence: 'Fixed SimpleRPG uses a river path and catalog coverage proves all river variants.',
  },
  listRoadGuidePermutations: {
    mode: 'catalog-contract',
    evidence: 'Fixed and packaged SimpleRPG roads sit on top of full road permutation coverage.',
  },
  'medieval-hexagon-gameboard manifest': {
    mode: 'package-boundary',
    evidence: 'Package smoke validates the CLI manifest and packaged SimpleRPG imports together.',
  },
  neutralUnitAssetId: {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG EXTRA neutral unit placement resolves neutral unit asset ids.',
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
    mode: 'compatibility-adapter',
    evidence: 'Local SimpleRPG third-party scene verifies external actor facing recommendations.',
  },
  selectCoastVariant: {
    mode: 'catalog-contract',
    evidence: 'Coast selector coverage backs the harbor/coast SimpleRPG scenes.',
  },
  selectCoastVariantByLabel: {
    mode: 'catalog-contract',
    evidence: 'Guide coverage keeps labeled coast variants available to docs and tests.',
  },
  selectManifestAssets: {
    mode: 'manifest-package',
    evidence: 'Coverage and package audits select manifest assets for SimpleRPG visual scenes.',
  },
  selectRiverCrossingVariant: {
    mode: 'catalog-contract',
    evidence: 'Guide selector coverage proves crossing variants for river-heavy boards.',
  },
  selectRiverVariant: {
    mode: 'catalog-contract',
    evidence: 'Fixed SimpleRPG river usage is backed by selector coverage for all variants.',
  },
  selectRiverVariantByLabel: {
    mode: 'catalog-contract',
    evidence: 'Guide coverage keeps labeled river variants available to docs and tests.',
  },
  selectRoadVariant: {
    mode: 'catalog-contract',
    evidence: 'SimpleRPG road authoring is backed by road selector coverage.',
  },
  selectRoadVariantByLabel: {
    mode: 'catalog-contract',
    evidence: 'Guide coverage keeps labeled road variants available to docs and tests.',
  },
  selectSpawnCoordinates: {
    mode: 'packaged-scenario',
    evidence: 'SimpleRPG packaged usage resolves board-aware scenario and ad hoc spawn locations.',
  },
  spawnGameboardActor: {
    mode: 'fixed-gameplay',
    evidence: 'Fixed and seeded SimpleRPG fixtures spawn player, NPC, prop, and enemy actors.',
  },
  textureFileName: {
    mode: 'manifest-package',
    evidence: 'Manifest/package audits validate texture files used by SimpleRPG render scenes.',
  },
  validateGameboardRecipe: {
    mode: 'packaged-scenario',
    evidence: 'Packaged SimpleRPG scenario validation exercises recipe validation through public imports.',
  },
  validateGameboardRecipeGeneration: {
    mode: 'seeded-generation',
    evidence: 'Seeded SimpleRPG custom-piece generation is checked by recipe generation validation.',
  },
} satisfies Readonly<Record<string, SimpleRpgGuidePublicApiExerciseEvidence>>;

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
 * Runs the packaged SimpleRPG scenario and simulation through public APIs.
 */
export function runSimpleRpgUsageExample(): SimpleRpgUsageSummary {
  const scenario = scenarioJson as GameboardScenario;
  const script = simulationScriptJson as GameboardScenarioSimulationScript;
  const guideApiCoverage = summarizeSimpleRpgGuidePublicApiExercises();
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
