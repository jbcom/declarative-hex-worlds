/**
 * End-to-end SimpleRPG usage example that exercises the public API for fixed
 * and seeded boards, actors, movement, commands, quests, and interop snapshots.
 *
 * @module
 */
import { createGameboardInteractionHandlerPreset } from '@jbcom/medieval-hexagon-gameboard/commands';
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
  /** Final tile key for each actor id after simulation. */
  readonly finalActorTiles: Readonly<Record<string, string>>;
  /** Quest ids completed by the packaged simulation script. */
  readonly completedQuestIds: readonly string[];
}

/**
 * Runs the packaged SimpleRPG scenario and simulation through public APIs.
 */
export function runSimpleRpgUsageExample(): SimpleRpgUsageSummary {
  const scenario = scenarioJson as GameboardScenario;
  const script = simulationScriptJson as GameboardScenarioSimulationScript;
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
    finalActorTiles: Object.fromEntries(
      report.actors.map((actor) => [actor.actorId, actor.placement.tileKey] as const)
    ),
    completedQuestIds: report.quests.filter((quest) => quest.status === 'completed').map((quest) => quest.questId),
  };
}
