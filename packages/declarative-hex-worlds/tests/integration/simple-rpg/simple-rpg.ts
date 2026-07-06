/**
 * SimpleRPG integration test driver. Exercises the public API for fixed and
 * seeded boards, actors, movement, commands, quests, and interop snapshots.
 *
 * This module is consumed by the CLI's release-readiness coverage gate
 * (`doctor --coverage`) and by `src/interop/__tests__/coverage.test.ts`.
 * It is intentionally NOT part of the published surface — the npm tarball
 * does not ship a `declarative-hex-worlds/examples/simple-rpg-usage`
 * subpath (PRD R4 relocation).
 *
 * @module
 */
import { createGameboardInteractionHandlerPreset } from 'declarative-hex-worlds/commands';
import {
  listSimpleRpgGuidePublicApiExercises,
  runSimpleRpgExecutableGuideApiSmoke as runSimpleRpgExecutableGuideApiSmokeImpl,
  type SimpleRpgExecutableGuideApiSmokeSummary,
  type SimpleRpgGuidePublicApiExerciseMode,
  summarizeSimpleRpgGuidePublicApiExercises,
} from '../../../src/coverage-evidence';

export type {
  SimpleRpgExecutableGuideApiSmokeSummary,
  SimpleRpgGuidePublicApiExercise,
  SimpleRpgGuidePublicApiExerciseCoverage,
  SimpleRpgGuidePublicApiExerciseMode,
} from '../../../src/coverage-evidence';
export { listSimpleRpgGuidePublicApiExercises, summarizeSimpleRpgGuidePublicApiExercises };

import { createGameboardScenarioInteropSnapshot } from 'declarative-hex-worlds/interop';
import { selectGameboardSpawnLocations } from 'declarative-hex-worlds/navigation';
import { createGameboardRuntimeFromScenario } from 'declarative-hex-worlds/runtime';
import {
  createGameboardWorldFromScenario,
  type GameboardScenario,
  validateGameboardScenario,
} from 'declarative-hex-worlds/scenario';
import {
  createGameboardScenarioSimulationReport,
  type GameboardScenarioSimulationReport,
  type GameboardScenarioSimulationScript,
  runGameboardScenarioSimulationScript,
} from 'declarative-hex-worlds/simulation';
import scenarioJson from './fixtures/simple-rpg-scenario.json';
import simulationScriptJson from './fixtures/simple-rpg-simulation.script.json';

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
  /** Exercise counts by SimpleRPG evidence mode; one API may contribute to multiple modes. */
  readonly guidePublicApiExerciseModes: Readonly<
    Record<SimpleRpgGuidePublicApiExerciseMode, number>
  >;
  /** Final tile key for each actor id after simulation. */
  readonly finalActorTiles: Readonly<Record<string, string>>;
  /** Quest ids completed by the packaged simulation script. */
  readonly completedQuestIds: readonly string[];
}

/**
 * Runs direct public helper calls that are useful to games but too low-level to
 * prove only through the playable scenario path.
 */
export function runSimpleRpgExecutableGuideApiSmoke(): SimpleRpgExecutableGuideApiSmokeSummary {
  return runSimpleRpgExecutableGuideApiSmokeImpl(scenarioJson as GameboardScenario);
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
  const report: GameboardScenarioSimulationReport = createGameboardScenarioSimulationReport(
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
      runtime.spawnGroups?.groups.flatMap((group) => group.locations.map((spawn) => spawn.id)) ??
      [],
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
      ...new Set(
        report.actorTargets.flatMap((scan) => scan.targets.map((target) => target.commandKind))
      ),
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
    completedQuestIds: report.quests
      .filter((quest) => quest.status === 'completed')
      .map((quest) => quest.questId),
  };
}
