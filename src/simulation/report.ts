/**
 * Simulation report types, record-building helpers, and the
 * {@link createGameboardScenarioSimulationReport} renderer.
 *
 * Split out of the original monolithic `./simulation` during PRD D3 (H-3).
 *
 * @module
 */
import {
  type GameboardActorKind,
  type GameboardActorMetadataValue,
  type GameboardActorSnapshot,
  type GameboardActorTarget,
  type inspectGameboardActorTargets,
  readGameboardActors,
} from '../actors';
import { projectWorldToGameboardPlan } from '../coordinates';
import type {
  GameboardPlacementKind,
  GameboardPlacementLayer,
  GameboardPlacementSpec,
  GameboardPlan,
} from '../gameboard';
import type { PlacementStateValue } from '../koota';
import {
  type GameboardQuestMetadataValue,
  type GameboardQuestObjective,
  type GameboardQuestObjectiveProgress,
  type GameboardQuestSnapshot,
  type GameboardQuestStatus,
  readGameboardQuests,
} from '../quests';
import type { GameboardScenarioRuntime } from '../scenario';
import type {
  GameboardInteractionCommandRecord,
  GameboardMovementEventRecord,
  GameboardPatrolEventRecord,
  GameboardSystemEvent,
  GameboardSystemEventRecord,
} from '../systems';
import { evaluateGameboardScenarioSimulationExpectations } from './assertions';
import {
  type SIMULATION_MOVEMENT_EVENT_TYPES,
  type SIMULATION_PATROL_EVENT_TYPES,
  isSimulationMovementEventType,
  isSimulationPatrolEventType,
} from './internal';
import {
  GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
  type GameboardScenarioSimulationActorTargetRecord,
  type GameboardScenarioSimulationActorTargetsRecord,
  type GameboardScenarioSimulationExpectationFailure,
  type GameboardScenarioSimulationExpectations,
  type GameboardScenarioSimulationMutationRecord,
  type GameboardScenarioSimulationStep,
  type GameboardScenarioSimulationStepBase,
  type GameboardScenarioSimulationStepResult,
} from './script';

/**
 * In-memory result of running a scenario simulation.
 */
export interface GameboardScenarioSimulationResult {
  /** Runtime created from the scenario. */
  runtime: GameboardScenarioRuntime;
  /** Per-step execution results. */
  steps: readonly GameboardScenarioSimulationStepResult[];
  /** All in-memory events emitted during the run. */
  events: readonly GameboardSystemEvent[];
  /** All serializable event records emitted during the run. */
  eventRecords: readonly GameboardSystemEventRecord[];
  /** All direct mutation records emitted during the run. */
  mutations: readonly GameboardScenarioSimulationMutationRecord[];
  /** Final projected plan. */
  finalPlan: GameboardPlan;
  /** Final actor snapshots. */
  actors: readonly GameboardActorSnapshot[];
  /** Final quest snapshots. */
  quests: readonly GameboardQuestSnapshot[];
}

/**
 * Serializable report derived from a simulation result.
 */
export interface GameboardScenarioSimulationReport {
  /** Simulation schema version. */
  schemaVersion: typeof GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION;
  /** Scenario id. */
  scenarioId: string;
  /** Scenario title. */
  scenarioTitle?: string;
  /** Whether all expectations passed. */
  success: boolean;
  /** Per-step report records. */
  steps: readonly GameboardScenarioSimulationStepReport[];
  /** Flattened command records. */
  commands: readonly GameboardScenarioSimulationCommandRecord[];
  /** Flattened actor-target records. */
  actorTargets: readonly GameboardScenarioSimulationActorTargetsRecord[];
  /** Flattened patrol records. */
  patrols: readonly GameboardScenarioSimulationPatrolRecord[];
  /** Flattened movement records. */
  movements: readonly GameboardScenarioSimulationMovementRecord[];
  /** Flattened system event records. */
  eventRecords: readonly GameboardSystemEventRecord[];
  /** Direct mutation records. */
  mutations: readonly GameboardScenarioSimulationMutationRecord[];
  /** Final projected plan. */
  finalPlan: GameboardPlan;
  /** Final placement records. */
  placements: readonly GameboardScenarioSimulationPlacementRecord[];
  /** Final actor records. */
  actors: readonly GameboardScenarioSimulationActorRecord[];
  /** Final quest records. */
  quests: readonly GameboardScenarioSimulationQuestRecord[];
  /** Expectations evaluated for the report. */
  expectations?: GameboardScenarioSimulationExpectations;
  /** Expectation failures. */
  expectationFailures: readonly GameboardScenarioSimulationExpectationFailure[];
}

/**
 * Serializable report for one simulation step.
 */
export interface GameboardScenarioSimulationStepReport {
  /** Step index. */
  index: number;
  /** Authored step id. */
  id?: string;
  /** Authored step label. */
  label?: string;
  /** Step action discriminator. */
  action: GameboardScenarioSimulationStep['action'];
  /** Command record emitted by the step. */
  command?: GameboardInteractionCommandRecord;
  /** Actor-target record emitted by the step. */
  actorTargets?: GameboardScenarioSimulationActorTargetsRecord;
  /** System event records emitted by the step. */
  eventRecords: readonly GameboardSystemEventRecord[];
  /** Direct mutation records emitted by the step. */
  mutations: readonly GameboardScenarioSimulationMutationRecord[];
}

/**
 * Flattened command record with step provenance.
 */
export interface GameboardScenarioSimulationCommandRecord {
  /** Step index that emitted the command. */
  stepIndex: number;
  /** Authored step id. */
  stepId?: string;
  /** Authored step label. */
  stepLabel?: string;
  /** Event type that carried the command. */
  eventType: GameboardSystemEventRecord['type'];
  /** Serializable command execution record. */
  command: GameboardInteractionCommandRecord;
}

/**
 * Flattened patrol event record with step provenance.
 */
export interface GameboardScenarioSimulationPatrolRecord {
  /** Step index that emitted the patrol event. */
  stepIndex: number;
  /** Authored step id. */
  stepId?: string;
  /** Authored step label. */
  stepLabel?: string;
  /** Patrol event type. */
  eventType: (typeof SIMULATION_PATROL_EVENT_TYPES)[number];
  /** Serializable patrol event record. */
  patrol: GameboardPatrolEventRecord;
}

/**
 * Flattened movement event record with step provenance.
 */
export interface GameboardScenarioSimulationMovementRecord {
  /** Step index that emitted the movement event. */
  stepIndex: number;
  /** Authored step id. */
  stepId?: string;
  /** Authored step label. */
  stepLabel?: string;
  /** Movement event type. */
  eventType: (typeof SIMULATION_MOVEMENT_EVENT_TYPES)[number];
  /** Serializable movement event record. */
  movement: GameboardMovementEventRecord;
}

/**
 * Final actor record in a simulation report.
 */
export interface GameboardScenarioSimulationActorRecord {
  /** Actor id. */
  actorId: string;
  /** Actor kind. */
  kind: GameboardActorKind;
  /** Actor faction. */
  faction?: string;
  /** Actor team. */
  team?: string;
  /** Whether the actor is generally hostile. */
  hostile: boolean;
  /** Whether the actor blocks movement. */
  blocksMovement: boolean;
  /** Whether the actor can be interacted with. */
  interactive: boolean;
  /** Actor tags. */
  tags: readonly string[];
  /** Serializable actor metadata. */
  metadata: Readonly<Record<string, GameboardActorMetadataValue>>;
  /** Final placement record for the actor. */
  placement: GameboardScenarioSimulationPlacementRecord;
}

/**
 * Final placement record in a simulation report.
 */
export interface GameboardScenarioSimulationPlacementRecord {
  /** Placement id. */
  placementId: string;
  /** Origin tile key. */
  tileKey: string;
  /** Asset id. */
  assetId: string;
  /** Placement kind. */
  kind: GameboardPlacementKind;
  /** Placement layer. */
  layer: GameboardPlacementLayer;
  /** Whether the placement depends on local EXTRA or external assets. */
  requiresExtra: boolean;
  /** Serializable placement metadata. */
  metadata: Readonly<Record<string, GameboardActorMetadataValue>>;
}

/**
 * Final quest record in a simulation report.
 */
export interface GameboardScenarioSimulationQuestRecord {
  /** Quest id. */
  questId: string;
  /** Quest title. */
  title: string;
  /** Quest status. */
  status: GameboardQuestStatus;
  /** Active objective index. */
  activeObjectiveIndex: number;
  /** Active objective id. */
  activeObjectiveId?: string;
  /** Quest objectives. */
  objectives: readonly GameboardQuestObjective[];
  /** Objective progress snapshots. */
  progress: readonly GameboardQuestObjectiveProgress[];
  /** Serializable quest metadata. */
  metadata: Readonly<Record<string, GameboardQuestMetadataValue>>;
}

/**
 * Creates a serializable report from an in-memory simulation result.
 */
export function createGameboardScenarioSimulationReport(
  result: GameboardScenarioSimulationResult,
  expectations?: GameboardScenarioSimulationExpectations
): GameboardScenarioSimulationReport {
  const steps = result.steps.map((step) => ({
    index: step.index,
    id: step.id,
    label: step.label,
    action: step.action,
    command: commandRecordFromStepResult(step),
    actorTargets: step.actorTargets ? copyJson(step.actorTargets) : undefined,
    eventRecords: step.eventRecords.map(copySystemEventRecord),
    mutations: step.mutations.map((mutation) => ({ ...mutation })),
  }));
  const report: GameboardScenarioSimulationReport = {
    schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
    scenarioId: result.runtime.scenario.id,
    scenarioTitle: result.runtime.scenario.title,
    success: true,
    steps,
    commands: commandRecordsFromStepReports(steps),
    actorTargets: actorTargetRecordsFromStepReports(steps),
    patrols: patrolRecordsFromStepReports(steps),
    movements: movementRecordsFromStepReports(steps),
    eventRecords: result.eventRecords.map(copySystemEventRecord),
    mutations: result.mutations.map((mutation) => ({ ...mutation })),
    finalPlan: copyJson(result.finalPlan),
    placements: result.finalPlan.placements.map(placementRecord),
    actors: result.actors.map(actorRecord),
    quests: result.quests.map(questRecord),
    expectations: expectations ? copyJson(expectations) : undefined,
    expectationFailures: [],
  };
  const expectationFailures = evaluateGameboardScenarioSimulationExpectations(report, expectations);
  return {
    ...report,
    success: expectationFailures.length === 0,
    expectationFailures,
  };
}

/**
 * @internal
 */
export function simulationResult(
  runtime: GameboardScenarioRuntime,
  steps: readonly GameboardScenarioSimulationStepResult[]
): GameboardScenarioSimulationResult {
  return {
    runtime,
    steps,
    events: steps.flatMap((step) => step.events),
    eventRecords: steps.flatMap((step) => step.eventRecords),
    mutations: steps.flatMap((step) => step.mutations),
    finalPlan: projectWorldToGameboardPlan(runtime.world),
    actors: readGameboardActors(runtime.world),
    quests: readGameboardQuests(runtime.world),
  };
}

/**
 * @internal
 */
export function actorRecord(
  snapshot: GameboardActorSnapshot
): GameboardScenarioSimulationActorRecord {
  return {
    actorId: snapshot.actor.actorId,
    kind: snapshot.actor.kind,
    faction: snapshot.actor.faction,
    team: snapshot.actor.team,
    hostile: snapshot.actor.hostile,
    blocksMovement: snapshot.actor.blocksMovement,
    interactive: snapshot.actor.interactive,
    tags: [...snapshot.actor.tags],
    metadata: { ...snapshot.actor.metadata },
    placement: placementRecord(snapshot.placement),
  };
}

/**
 * @internal
 */
export function placementRecord(
  placement: PlacementStateValue | GameboardPlacementSpec
): GameboardScenarioSimulationPlacementRecord {
  return {
    placementId: placement.id,
    tileKey: placement.tileKey,
    assetId: placement.assetId,
    kind: placement.kind,
    layer: placement.layer,
    requiresExtra: placement.requiresExtra,
    metadata: { ...placement.metadata },
  };
}

/**
 * @internal
 */
export function actorTargetsRecordFromReport(
  report: ReturnType<typeof inspectGameboardActorTargets>,
  stepIndex: number,
  step: GameboardScenarioSimulationStepBase
): GameboardScenarioSimulationActorTargetsRecord {
  return {
    stepIndex,
    stepId: step.id,
    stepLabel: step.label,
    sourceActorId: report.source?.actor.actorId,
    sourcePlacementId: report.source?.placement.id,
    sourceTileKey: report.source?.placement.tileKey,
    targetActorIds: [...report.targetActorIds],
    reachableActorIds: [...report.reachableActorIds],
    nearestTarget: report.nearestTarget ? actorTargetRecord(report.nearestTarget) : undefined,
    targets: report.targets.map(actorTargetRecord),
    reason: report.reason,
  };
}

/**
 * @internal
 */
export function emptyActorTargetsRecord(
  stepIndex: number,
  step: GameboardScenarioSimulationStepBase,
  reason: string
): GameboardScenarioSimulationActorTargetsRecord {
  return {
    stepIndex,
    stepId: step.id,
    stepLabel: step.label,
    targetActorIds: [],
    reachableActorIds: [],
    targets: [],
    reason,
  };
}

function actorTargetRecord(
  target: GameboardActorTarget
): GameboardScenarioSimulationActorTargetRecord {
  return {
    actorId: target.record.actorId,
    placementId: target.record.placementId,
    tileKey: target.record.tileKey,
    kind: target.record.kind,
    faction: target.record.faction,
    team: target.record.team,
    hostile: target.record.hostile,
    hostileToSource: target.record.hostileToSource,
    interactive: target.record.interactive,
    approach: target.approach,
    approachTileKey: target.approachTileKey,
    reachable: target.reachable,
    reason: target.reason,
    pathFound: target.path.found,
    pathCost: target.path.cost,
    pathKeys: target.path.path.map((tile) => tile.key),
    commandKind: target.command.kind,
    commandIntent: target.command.intent,
    commandCanExecute: target.command.canExecute,
    commandReason: target.command.reason,
    commandTileKey: target.command.tileKey,
    commandPlacementId: target.command.placementId,
    commandActorId: target.command.actorId,
  };
}

function questRecord(snapshot: GameboardQuestSnapshot): GameboardScenarioSimulationQuestRecord {
  return {
    questId: snapshot.quest.questId,
    title: snapshot.quest.title,
    status: snapshot.quest.status,
    activeObjectiveIndex: snapshot.quest.activeObjectiveIndex,
    activeObjectiveId: snapshot.quest.objectives[snapshot.quest.activeObjectiveIndex]?.id,
    objectives: snapshot.quest.objectives.map(copyQuestObjective),
    progress: snapshot.quest.progress.map((progress) => ({ ...progress })),
    metadata: { ...snapshot.quest.metadata },
  };
}

function commandRecordFromStepResult(
  step: GameboardScenarioSimulationStepResult
): GameboardInteractionCommandRecord | undefined {
  const command = step.dispatch?.eventRecords.find((event) => event.command)?.command;
  return command ? copyJson(command) : undefined;
}

function commandRecordsFromStepReports(
  steps: readonly GameboardScenarioSimulationStepReport[]
): GameboardScenarioSimulationCommandRecord[] {
  return steps.flatMap((step) =>
    step.eventRecords.flatMap((eventRecord) =>
      eventRecord.command
        ? [
            {
              stepIndex: step.index,
              stepId: step.id,
              stepLabel: step.label,
              eventType: eventRecord.type,
              command: copyJson(eventRecord.command),
            },
          ]
        : []
    )
  );
}

function actorTargetRecordsFromStepReports(
  steps: readonly GameboardScenarioSimulationStepReport[]
): GameboardScenarioSimulationActorTargetsRecord[] {
  return steps.flatMap((step) => (step.actorTargets ? [copyJson(step.actorTargets)] : []));
}

function movementRecordsFromStepReports(
  steps: readonly GameboardScenarioSimulationStepReport[]
): GameboardScenarioSimulationMovementRecord[] {
  return steps.flatMap((step) =>
    step.eventRecords.flatMap((eventRecord) =>
      eventRecord.movement && isSimulationMovementEventType(eventRecord.type)
        ? [
            {
              stepIndex: step.index,
              stepId: step.id,
              stepLabel: step.label,
              eventType: eventRecord.type,
              movement: copyJson(eventRecord.movement),
            },
          ]
        : []
    )
  );
}

function patrolRecordsFromStepReports(
  steps: readonly GameboardScenarioSimulationStepReport[]
): GameboardScenarioSimulationPatrolRecord[] {
  return steps.flatMap((step) =>
    step.eventRecords.flatMap((eventRecord) =>
      eventRecord.patrol && isSimulationPatrolEventType(eventRecord.type)
        ? [
            {
              stepIndex: step.index,
              stepId: step.id,
              stepLabel: step.label,
              eventType: eventRecord.type,
              patrol: copyJson(eventRecord.patrol),
            },
          ]
        : []
    )
  );
}

function copyQuestObjective(objective: GameboardQuestObjective): GameboardQuestObjective {
  if ('tile' in objective && typeof objective.tile === 'object') {
    return { ...objective, tile: { ...objective.tile } };
  }
  if ('targetTile' in objective && typeof objective.targetTile === 'object') {
    return { ...objective, targetTile: { ...objective.targetTile } };
  }
  return { ...objective };
}

function copySystemEventRecord(record: GameboardSystemEventRecord): GameboardSystemEventRecord {
  return copyJson(record);
}

function copyJson<T>(value: T): T {
  return structuredClone(value);
}
