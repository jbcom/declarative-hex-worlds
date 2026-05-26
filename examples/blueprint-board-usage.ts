/**
 * End-to-end blueprint-board usage example that exercises the public API for a
 * board-scale 2.5D spec, generated scenario content, Koota runtime creation,
 * runtime facade snapshots, and neutral ECS interop output.
 *
 * @module
 */
import {
  createMedievalGameboardBlueprintScenario,
  type MedievalGameboardBlueprintScenarioOptions,
} from '@jbcom/medieval-hexagon-gameboard/blueprint';
import {
  createGameboardRuntimeFromScenario,
  type GameboardScenarioGameRuntime,
} from '@jbcom/medieval-hexagon-gameboard/runtime';
import { validateGameboardScenario } from '@jbcom/medieval-hexagon-gameboard/scenario';
import { validateGameboardPlan } from '@jbcom/medieval-hexagon-gameboard/validation';
import blueprintJson from './blueprint-board.json';

/**
 * Compact verification summary returned by the packaged blueprint-board example.
 *
 * The example uses only published package subpaths plus packaged JSON so apps
 * can reuse it as a smoke test for the complete blueprint authoring path.
 */
export interface BlueprintBoardUsageSummary {
  /** Scenario id loaded from the packaged blueprint JSON fixture. */
  readonly scenarioId: string;
  /** Count of generated board tiles. */
  readonly tileCount: number;
  /** Count of generated board placements. */
  readonly placementCount: number;
  /** Count of generated recipe steps. */
  readonly recipeStepCount: number;
  /** Count of blueprint validation errors. */
  readonly validationErrorCount: number;
  /** Count of scenario validation errors. */
  readonly scenarioValidationErrorCount: number;
  /** Number of generated stacked mountain placements. */
  readonly mountainStackCount: number;
  /** Number of generated settlement building/fortification placements. */
  readonly townBuildingCount: number;
  /** Number of generated harbor clusters. */
  readonly harborCount: number;
  /** Number of generated semantic prop clusters. */
  readonly propClusterCount: number;
  /** Spawn group ids resolved from the blueprint scenario. */
  readonly spawnGroupIds: readonly string[];
  /** Spawn location ids selected for scenario spawn groups. */
  readonly spawnLocationIds: readonly string[];
  /** Number of spawn-group route checks. */
  readonly spawnRouteCount: number;
  /** Number of successful spawn-group route checks. */
  readonly successfulSpawnRouteCount: number;
  /** Patrol route ids resolved from the blueprint scenario. */
  readonly patrolRouteIds: readonly string[];
  /** Total patrol waypoint count across generated patrol routes. */
  readonly patrolWaypointCount: number;
  /** Number of complete patrol routes. */
  readonly completePatrolRouteCount: number;
  /** Actor ids compiled into the scenario. */
  readonly actorIds: readonly string[];
  /** Quest ids compiled into the scenario. */
  readonly questIds: readonly string[];
  /** Actor count created in the scenario runtime world. */
  readonly worldActorCount: number;
  /** Quest count created in the scenario runtime world. */
  readonly worldQuestCount: number;
  /** Actor count visible from the runtime facade snapshot. */
  readonly runtimeActorCount: number;
  /** Quest count visible from the runtime facade snapshot. */
  readonly runtimeQuestCount: number;
  /** Entity count in the neutral scenario interop snapshot. */
  readonly interopEntityCount: number;
  /** Relation count in the neutral scenario interop snapshot. */
  readonly interopRelationCount: number;
  /** Spawn location count in the neutral scenario interop snapshot. */
  readonly interopSpawnLocationCount: number;
  /** Actor entity count in the neutral scenario interop snapshot. */
  readonly interopActorCount: number;
  /** Quest entity count in the neutral scenario interop snapshot. */
  readonly interopQuestCount: number;
  /** Spawn-group entity count in the neutral scenario interop snapshot. */
  readonly interopSpawnGroupCount: number;
  /** Patrol-route entity count in the neutral scenario interop snapshot. */
  readonly interopPatrolRouteCount: number;
}

/**
 * Runs the packaged blueprint-board JSON through the public blueprint, runtime,
 * and interop APIs.
 */
export function runBlueprintBoardUsageExample(): BlueprintBoardUsageSummary {
  const blueprint = blueprintJson as MedievalGameboardBlueprintScenarioOptions;
  const scenario = createMedievalGameboardBlueprintScenario(blueprint);
  let runtime: GameboardScenarioGameRuntime | undefined;

  try {
    runtime = createGameboardRuntimeFromScenario(scenario);
    const runtimeSnapshot = runtime.snapshot({ includeInterop: true });
    const scenarioInterop = runtime.createScenarioInteropSnapshot();
    const blueprintViolations = validateGameboardPlan(runtimeSnapshot.plan);
    const scenarioViolations = validateGameboardScenario(scenario);
    const spawnGroups = runtime.spawnGroups;
    const patrolRoutes = runtime.patrolRoutes;
    const propClusterIds = new Set(
      runtimeSnapshot.plan.placements
        .filter((placement) => placement.metadata.feature === 'prop-cluster')
        .map((placement) => placement.metadata.clusterId)
        .filter((clusterId): clusterId is string => typeof clusterId === 'string')
    );

    return {
      scenarioId: scenario.id,
      tileCount: runtimeSnapshot.plan.tiles.length,
      placementCount: runtimeSnapshot.plan.placements.length,
      recipeStepCount: scenario.board.steps.length,
      validationErrorCount: blueprintViolations.filter(
        (violation) => violation.severity === 'error'
      ).length,
      scenarioValidationErrorCount: scenarioViolations.filter(
        (violation) => violation.severity === 'error'
      ).length,
      mountainStackCount: runtimeSnapshot.plan.placements.filter(
        (placement) => placement.metadata.feature === 'mountain-stack'
      ).length,
      townBuildingCount: runtimeSnapshot.plan.placements.filter(
        (placement) =>
          placement.metadata.feature === 'settlement' ||
          placement.metadata.feature === 'fortification'
      ).length,
      harborCount: runtimeSnapshot.plan.placements.filter(
        (placement) => placement.metadata.feature === 'harbor'
      ).length,
      propClusterCount: propClusterIds.size,
      spawnGroupIds: spawnGroups?.groups.map((group) => group.id) ?? [],
      spawnLocationIds:
        spawnGroups?.groups.flatMap((group) => group.locations.map((spawn) => spawn.id)) ?? [],
      spawnRouteCount: spawnGroups?.routeChecks.length ?? 0,
      successfulSpawnRouteCount:
        spawnGroups?.routeChecks.filter((route) => route.found).length ?? 0,
      patrolRouteIds: patrolRoutes?.routes.map((route) => route.id) ?? [],
      patrolWaypointCount:
        patrolRoutes?.routes.reduce((total, route) => total + route.waypoints.length, 0) ?? 0,
      completePatrolRouteCount: patrolRoutes?.routes.filter((route) => route.found).length ?? 0,
      actorIds: scenario.actors?.map((actor) => actor.actorId) ?? [],
      questIds: scenario.quests?.map((quest) => quest.id) ?? [],
      worldActorCount: runtime.scenarioRuntime.actors.length,
      worldQuestCount: runtime.scenarioRuntime.quests.length,
      runtimeActorCount: runtimeSnapshot.actors.length,
      runtimeQuestCount: runtimeSnapshot.quests.length,
      interopEntityCount: scenarioInterop.entities.length,
      interopRelationCount: scenarioInterop.relations.length,
      interopSpawnLocationCount: scenarioInterop.spawnLocations.length,
      interopActorCount: scenarioInterop.entities.filter((entity) => entity.kind === 'actor')
        .length,
      interopQuestCount: scenarioInterop.entities.filter((entity) => entity.kind === 'quest')
        .length,
      interopSpawnGroupCount: scenarioInterop.entities.filter(
        (entity) => entity.kind === 'spawn-group'
      ).length,
      interopPatrolRouteCount: scenarioInterop.entities.filter(
        (entity) => entity.kind === 'patrol-route'
      ).length,
    };
  } finally {
    runtime?.world.destroy();
  }
}
