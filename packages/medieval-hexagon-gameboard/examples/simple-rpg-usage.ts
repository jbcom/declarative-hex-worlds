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

export interface SimpleRpgUsageSummary {
  readonly scenarioId: string;
  readonly validationErrorCount: number;
  readonly scenarioSpawnGroupIds: readonly string[];
  readonly scenarioSpawnLocationIds: readonly string[];
  readonly scenarioSpawnRouteCount: number;
  readonly scenarioPatrolRouteIds: readonly string[];
  readonly scenarioPatrolWaypointCount: number;
  readonly spawnLocationIds: readonly string[];
  readonly interopEntityCount: number;
  readonly interopRelationCount: number;
  readonly simulationSucceeded: boolean;
  readonly eventTypes: readonly string[];
  readonly actorTargetRecordCount: number;
  readonly actorTargetScanCount: number;
  readonly actorTargetTargetIds: readonly string[];
  readonly reachableActorTargetIds: readonly string[];
  readonly nearestActorTargetId?: string;
  readonly actorTargetCommandKinds: readonly string[];
  readonly runtimeActorTargetEventTypes: readonly string[];
  readonly runtimeActorTargetCommandKind?: string;
  readonly runtimeActorTargetHandled: boolean;
  readonly finalActorTiles: Readonly<Record<string, string>>;
  readonly completedQuestIds: readonly string[];
}

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
