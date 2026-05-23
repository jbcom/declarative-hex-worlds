import { createActions, type World } from 'koota';
import {
  executeGameboardInteractionCommand,
  planGameboardActorTargetCommand,
  type GameboardActorTargetCommandOptions,
  type GameboardActorTargetCommandPlan,
  type GameboardInteractionCommandExecution,
  type GameboardInteractionCommandExecutionOptions,
  type GameboardInteractionCommandInput,
  type GameboardInteractionHandlerEffect,
  type GameboardInteractionHandlerResult,
} from './commands';
import type { GameboardInteractionCommand } from './actors';
import {
  runGameboardMovementSystem,
  type AdvanceGameboardMovementOptions,
  type GameboardMovementAdvanceResult,
  type GameboardMovementProfile,
  type MovementPathStateValue,
} from './movement';
import {
  runGameboardPatrolSystem,
  type AdvanceGameboardPatrolOptions,
  type GameboardPatrolAdvanceResult,
  type GameboardPatrolStatus,
} from './patrol';
import {
  advanceAllGameboardQuests,
  readGameboardQuests,
  type AdvanceGameboardQuestOptions,
  type GameboardQuestObjective,
  type GameboardQuestObjectiveProgress,
  type GameboardQuestSnapshot,
} from './quests';

export type GameboardSystemEvent =
  | GameboardMovementRequestedEvent
  | GameboardCommandHandledEvent
  | GameboardCommandBlockedEvent
  | GameboardCommandIgnoredEvent
  | GameboardCommandHandlerRequiredEvent
  | GameboardPatrolMoveRequestedEvent
  | GameboardPatrolWaitingEvent
  | GameboardPatrolCompletedEvent
  | GameboardPatrolBlockedEvent
  | GameboardMovementSteppedEvent
  | GameboardMovementCompletedEvent
  | GameboardMovementBlockedEvent
  | GameboardQuestAdvancedEvent
  | GameboardQuestCompletedEvent
  | GameboardQuestBlockedEvent;

export interface GameboardMovementRequestedEvent {
  type: 'movement-requested';
  execution: GameboardInteractionCommandExecution;
}

export interface GameboardCommandHandledEvent {
  type: 'command-handled';
  execution: GameboardInteractionCommandExecution;
}

export interface GameboardCommandBlockedEvent {
  type: 'command-blocked';
  execution: GameboardInteractionCommandExecution;
  reason?: string;
}

export interface GameboardCommandIgnoredEvent {
  type: 'command-ignored';
  execution: GameboardInteractionCommandExecution;
  reason?: string;
}

export interface GameboardCommandHandlerRequiredEvent {
  type: 'command-handler-required';
  execution: GameboardInteractionCommandExecution;
}

export interface GameboardPatrolMoveRequestedEvent {
  type: 'patrol-move-requested';
  patrol: GameboardPatrolAdvanceResult;
}

export interface GameboardPatrolWaitingEvent {
  type: 'patrol-waiting';
  patrol: GameboardPatrolAdvanceResult;
}

export interface GameboardPatrolCompletedEvent {
  type: 'patrol-completed';
  patrol: GameboardPatrolAdvanceResult;
}

export interface GameboardPatrolBlockedEvent {
  type: 'patrol-blocked';
  patrol: GameboardPatrolAdvanceResult;
  reason?: string;
}

export interface GameboardMovementSteppedEvent {
  type: 'movement-stepped';
  movement: GameboardMovementAdvanceResult;
}

export interface GameboardMovementCompletedEvent {
  type: 'movement-completed';
  movement: GameboardMovementAdvanceResult;
}

export interface GameboardMovementBlockedEvent {
  type: 'movement-blocked';
  movement: GameboardMovementAdvanceResult;
  reason?: string;
}

export interface GameboardQuestAdvancedEvent {
  type: 'quest-advanced';
  before?: GameboardQuestSnapshot;
  quest: GameboardQuestSnapshot;
}

export interface GameboardQuestCompletedEvent {
  type: 'quest-completed';
  before?: GameboardQuestSnapshot;
  quest: GameboardQuestSnapshot;
}

export interface GameboardQuestBlockedEvent {
  type: 'quest-blocked';
  before?: GameboardQuestSnapshot;
  quest: GameboardQuestSnapshot;
  reason?: string;
}

export interface DispatchGameboardInteractionCommandOptions extends GameboardInteractionCommandExecutionOptions {}

export interface DispatchGameboardInteractionCommandResult {
  execution: GameboardInteractionCommandExecution;
  events: readonly GameboardSystemEvent[];
  eventRecords: readonly GameboardSystemEventRecord[];
}

export interface DispatchGameboardActorTargetCommandResult {
  targetCommand: GameboardActorTargetCommandPlan;
  dispatch?: DispatchGameboardInteractionCommandResult;
  events: readonly GameboardSystemEvent[];
  eventRecords: readonly GameboardSystemEventRecord[];
  reason?: string;
}

export interface RunGameboardSystemsOptions {
  patrols?: AdvanceGameboardPatrolOptions | false;
  movement?: AdvanceGameboardMovementOptions | false;
  quests?: AdvanceGameboardQuestOptions | false;
}

export interface RunGameboardSystemsResult {
  patrols: readonly GameboardPatrolAdvanceResult[];
  movement: readonly GameboardMovementAdvanceResult[];
  quests: readonly GameboardQuestSnapshot[];
  events: readonly GameboardSystemEvent[];
  eventRecords: readonly GameboardSystemEventRecord[];
}

export interface RunGameboardInteractionOptions extends DispatchGameboardInteractionCommandOptions {
  systems?: RunGameboardSystemsOptions | false;
}

export interface RunGameboardInteractionResult {
  dispatch: DispatchGameboardInteractionCommandResult;
  systems?: RunGameboardSystemsResult;
  events: readonly GameboardSystemEvent[];
  eventRecords: readonly GameboardSystemEventRecord[];
}

export interface RunGameboardActorTargetInteractionResult {
  targetCommand: GameboardActorTargetCommandPlan;
  interaction?: RunGameboardInteractionResult;
  dispatch?: DispatchGameboardInteractionCommandResult;
  systems?: RunGameboardSystemsResult;
  events: readonly GameboardSystemEvent[];
  eventRecords: readonly GameboardSystemEventRecord[];
  reason?: string;
}

export interface GameboardSystemEventRecord {
  type: GameboardSystemEvent['type'];
  reason?: string;
  command?: GameboardInteractionCommandRecord;
  patrol?: GameboardPatrolEventRecord;
  movement?: GameboardMovementEventRecord;
  quest?: GameboardQuestEventRecord;
  beforeQuest?: GameboardQuestEventRecord;
}

export interface GameboardInteractionCommandRecord {
  kind: GameboardInteractionCommand['kind'];
  intent: GameboardInteractionCommand['intent'];
  status: GameboardInteractionCommandExecution['status'];
  canExecute: boolean;
  reason?: string;
  handlerId?: string;
  handlerStatus?: GameboardInteractionHandlerResult['status'];
  handlerMetadata?: GameboardInteractionHandlerResult['metadata'];
  effectTypes?: readonly GameboardInteractionHandlerEffect['type'][];
  effects?: readonly GameboardInteractionHandlerEffect[];
  tileKey?: string;
  placementId?: string;
  actorId?: string;
  sourceActorId?: string;
  sourcePlacementId?: string;
  target: {
    kind: GameboardInteractionCommand['target']['kind'];
    intent: GameboardInteractionCommand['target']['intent'];
    tileKey?: string;
    placementId?: string;
    actorId?: string;
    canEnter: boolean;
  };
}

export interface GameboardMovementEventRecord {
  placementId: string;
  actorId?: string;
  tileKey: string;
  assetId: string;
  profileId: GameboardMovementProfile['id'];
  moved: boolean;
  state: MovementPathStateValue;
}

export interface GameboardPatrolEventRecord {
  placementId: string;
  actorId?: string;
  routeId: string;
  status: GameboardPatrolStatus;
  targetKey?: string;
  currentWaypointIndex: number;
  targetWaypointIndex: number;
  roundsCompleted: number;
  requested: boolean;
  advanced: boolean;
  reason?: string;
}

export interface GameboardQuestEventRecord {
  questId: string;
  title: string;
  status: GameboardQuestSnapshot['quest']['status'];
  activeObjectiveIndex: number;
  activeObjectiveId?: string;
  objectives: readonly GameboardQuestObjective[];
  progress: readonly GameboardQuestObjectiveProgress[];
}

export const gameboardSystemActions = createActions((world) => ({
  dispatchCommand: (
    commandOrTarget: GameboardInteractionCommandInput,
    options: DispatchGameboardInteractionCommandOptions = {}
  ) => dispatchGameboardInteractionCommand(world, commandOrTarget, options),
  dispatchActorTargetCommand: (
    options: GameboardActorTargetCommandOptions,
    commandOptions: DispatchGameboardInteractionCommandOptions = {}
  ) => dispatchGameboardActorTargetCommand(world, options, commandOptions),
  run: (options: RunGameboardSystemsOptions = {}) => runGameboardSystems(world, options),
  interact: (commandOrTarget: GameboardInteractionCommandInput, options: RunGameboardInteractionOptions = {}) =>
    runGameboardInteraction(world, commandOrTarget, options),
  interactActorTarget: (
    options: GameboardActorTargetCommandOptions,
    interactionOptions: RunGameboardInteractionOptions = {}
  ) => runGameboardActorTargetInteraction(world, options, interactionOptions),
}));

export function dispatchGameboardInteractionCommand(
  world: World,
  commandOrTarget: GameboardInteractionCommandInput,
  options: DispatchGameboardInteractionCommandOptions = {}
): DispatchGameboardInteractionCommandResult {
  const execution = executeGameboardInteractionCommand(world, commandOrTarget, options);
  const events = commandExecutionEvents(execution);
  return {
    execution,
    events,
    eventRecords: snapshotGameboardSystemEvents(events),
  };
}

export function dispatchGameboardActorTargetCommand(
  world: World,
  options: GameboardActorTargetCommandOptions,
  commandOptions: DispatchGameboardInteractionCommandOptions = {}
): DispatchGameboardActorTargetCommandResult {
  const targetCommand = planGameboardActorTargetCommand(world, options);
  if (!targetCommand.command || !targetCommand.canExecute) {
    return {
      targetCommand,
      events: [],
      eventRecords: [],
      reason: targetCommand.reason ?? 'No executable actor target command',
    };
  }

  const dispatch = dispatchGameboardInteractionCommand(world, targetCommand.command, commandOptions);
  return {
    targetCommand,
    dispatch,
    events: dispatch.events,
    eventRecords: dispatch.eventRecords,
    reason: dispatch.execution.reason,
  };
}

export function runGameboardSystems(
  world: World,
  options: RunGameboardSystemsOptions = {}
): RunGameboardSystemsResult {
  const patrols = options.patrols === false ? [] : runGameboardPatrolSystem(world, options.patrols ?? {});
  const movement = options.movement === false ? [] : runGameboardMovementSystem(world, options.movement ?? {});
  const beforeQuests = options.quests === false ? [] : readGameboardQuests(world);
  const quests = options.quests === false ? [] : advanceAllGameboardQuests(world, options.quests ?? {});
  const events = [
    ...patrols.flatMap(patrolEvents),
    ...movement.flatMap(movementEvents),
    ...questEvents(beforeQuests, quests),
  ];
  return {
    patrols,
    movement,
    quests,
    events,
    eventRecords: snapshotGameboardSystemEvents(events),
  };
}

export function runGameboardInteraction(
  world: World,
  commandOrTarget: GameboardInteractionCommandInput,
  options: RunGameboardInteractionOptions = {}
): RunGameboardInteractionResult {
  const { systems, ...commandOptions } = options;
  const dispatch = dispatchGameboardInteractionCommand(world, commandOrTarget, commandOptions);
  const systemResult = systems === false ? undefined : runGameboardSystems(world, systems ?? {});
  const events = [
    ...dispatch.events,
    ...(systemResult?.events ?? []),
  ];
  return {
    dispatch,
    systems: systemResult,
    events,
    eventRecords: snapshotGameboardSystemEvents(events),
  };
}

export function runGameboardActorTargetInteraction(
  world: World,
  options: GameboardActorTargetCommandOptions,
  interactionOptions: RunGameboardInteractionOptions = {}
): RunGameboardActorTargetInteractionResult {
  const targetCommand = planGameboardActorTargetCommand(world, options);
  if (!targetCommand.command || !targetCommand.canExecute) {
    return {
      targetCommand,
      events: [],
      eventRecords: [],
      reason: targetCommand.reason ?? 'No executable actor target command',
    };
  }

  const interaction = runGameboardInteraction(world, targetCommand.command, interactionOptions);
  return {
    targetCommand,
    interaction,
    dispatch: interaction.dispatch,
    systems: interaction.systems,
    events: interaction.events,
    eventRecords: interaction.eventRecords,
    reason: interaction.dispatch.execution.reason,
  };
}

export function snapshotGameboardSystemEvent(event: GameboardSystemEvent): GameboardSystemEventRecord {
  switch (event.type) {
    case 'movement-requested':
      return {
        type: event.type,
        command: commandRecord(event.execution),
        movement: movementRequestRecord(event.execution.movement),
      };
    case 'command-handled':
    case 'command-handler-required':
      return {
        type: event.type,
        command: commandRecord(event.execution),
      };
    case 'command-blocked':
    case 'command-ignored':
      return {
        type: event.type,
        reason: event.reason,
        command: commandRecord(event.execution),
      };
    case 'patrol-move-requested':
    case 'patrol-waiting':
    case 'patrol-completed':
      return {
        type: event.type,
        patrol: patrolRecord(event.patrol),
      };
    case 'patrol-blocked':
      return {
        type: event.type,
        reason: event.reason,
        patrol: patrolRecord(event.patrol),
      };
    case 'movement-stepped':
    case 'movement-completed':
      return {
        type: event.type,
        movement: movementRecord(event.movement),
      };
    case 'movement-blocked':
      return {
        type: event.type,
        reason: event.reason,
        movement: movementRecord(event.movement),
      };
    case 'quest-advanced':
    case 'quest-completed':
      return {
        type: event.type,
        beforeQuest: questRecord(event.before),
        quest: questRecord(event.quest),
      };
    case 'quest-blocked':
      return {
        type: event.type,
        reason: event.reason,
        beforeQuest: questRecord(event.before),
        quest: questRecord(event.quest),
      };
  }
}

export function snapshotGameboardSystemEvents(events: readonly GameboardSystemEvent[]): GameboardSystemEventRecord[] {
  return events.map(snapshotGameboardSystemEvent);
}

function commandExecutionEvents(execution: GameboardInteractionCommandExecution): GameboardSystemEvent[] {
  switch (execution.status) {
    case 'handled':
      return [{ type: 'command-handled', execution }];
    case 'requested-move':
      return [{ type: 'movement-requested', execution }];
    case 'requires-game-handler':
      return [{ type: 'command-handler-required', execution }];
    case 'blocked':
      return [{ type: 'command-blocked', execution, reason: execution.reason }];
    case 'ignored':
      return [{ type: 'command-ignored', execution, reason: execution.reason }];
  }
}

function patrolEvents(patrol: GameboardPatrolAdvanceResult): GameboardSystemEvent[] {
  const events: GameboardSystemEvent[] = [];
  if (patrol.requested) {
    if (patrol.state.status === 'blocked') {
      events.push({ type: 'patrol-blocked', patrol, reason: patrol.state.reason });
    } else {
      events.push({ type: 'patrol-move-requested', patrol });
    }
  }
  if (patrol.state.status === 'waiting' && patrol.previousState.status !== 'waiting') {
    events.push({ type: 'patrol-waiting', patrol });
  }
  if (patrol.state.status === 'completed' && patrol.previousState.status !== 'completed') {
    events.push({ type: 'patrol-completed', patrol });
  }
  if (patrol.state.status === 'blocked' && !patrol.requested && patrol.previousState.status !== 'blocked') {
    events.push({ type: 'patrol-blocked', patrol, reason: patrol.state.reason });
  }
  return events;
}

function movementEvents(movement: GameboardMovementAdvanceResult): GameboardSystemEvent[] {
  const events: GameboardSystemEvent[] = [];
  if (movement.moved) {
    events.push({ type: 'movement-stepped', movement });
  }
  if (movement.state.status === 'completed') {
    events.push({ type: 'movement-completed', movement });
  }
  if (movement.state.status === 'blocked' || movement.state.status === 'out-of-range') {
    events.push({ type: 'movement-blocked', movement, reason: movement.state.reason });
  }
  return events;
}

function questEvents(
  beforeQuests: readonly GameboardQuestSnapshot[],
  afterQuests: readonly GameboardQuestSnapshot[]
): GameboardSystemEvent[] {
  const beforeById = new Map(beforeQuests.map((quest) => [quest.quest.questId, quest]));
  const events: GameboardSystemEvent[] = [];
  for (const quest of afterQuests) {
    const before = beforeById.get(quest.quest.questId);
    if (!questChanged(before, quest)) {
      continue;
    }
    events.push({ type: 'quest-advanced', before, quest });
    if (quest.quest.status === 'completed' && before?.quest.status !== 'completed') {
      events.push({ type: 'quest-completed', before, quest });
    }
    if (quest.quest.status === 'blocked' && before?.quest.status !== 'blocked') {
      events.push({
        type: 'quest-blocked',
        before,
        quest,
        reason: quest.quest.progress.find((progress) => progress.status === 'blocked')?.detail,
      });
    }
  }
  return events;
}

function questChanged(
  before: GameboardQuestSnapshot | undefined,
  after: GameboardQuestSnapshot
): boolean {
  if (!before) {
    return true;
  }
  return (
    before.quest.status !== after.quest.status ||
    before.quest.activeObjectiveIndex !== after.quest.activeObjectiveIndex ||
    progressSignature(before) !== progressSignature(after)
  );
}

function progressSignature(snapshot: GameboardQuestSnapshot): string {
  return snapshot.quest.progress
    .map((progress) => `${progress.objectiveId}:${progress.status}:${progress.detail}:${progress.completedAtStep ?? ''}`)
    .join('|');
}

function commandRecord(execution: GameboardInteractionCommandExecution): GameboardInteractionCommandRecord {
  const { command } = execution;
  return {
    kind: command.kind,
    intent: command.intent,
    status: execution.status,
    canExecute: command.canExecute,
    reason: execution.reason ?? command.reason,
    handlerId: execution.handler?.handlerId,
    handlerStatus: execution.handler?.status,
    handlerMetadata: execution.handler?.metadata,
    effectTypes: execution.effects?.map((effect) => effect.type),
    effects: execution.effects?.map((effect) => ({ ...effect })),
    tileKey: command.tileKey,
    placementId: command.placementId,
    actorId: command.actorId,
    sourceActorId: command.source?.actor.actorId,
    sourcePlacementId: command.source?.placement.id,
    target: {
      kind: command.target.kind,
      intent: command.target.intent,
      tileKey: command.target.tileKey,
      placementId: command.target.placement?.id,
      actorId: command.target.actor?.actor.actorId,
      canEnter: command.target.canEnter,
    },
  };
}

function movementRecord(movement: GameboardMovementAdvanceResult): GameboardMovementEventRecord {
  return {
    placementId: movement.placement.id,
    actorId: actorIdFromPlacement(movement.placement),
    tileKey: movement.placement.tileKey,
    assetId: movement.placement.assetId,
    profileId: movement.profile.id,
    moved: movement.moved,
    state: copyMovementPathState(movement.state),
  };
}

function patrolRecord(patrol: GameboardPatrolAdvanceResult): GameboardPatrolEventRecord {
  return {
    placementId: patrol.placement.id,
    actorId: actorIdFromPlacement(patrol.placement),
    routeId: patrol.agent.routeId,
    status: patrol.state.status,
    targetKey: patrol.state.targetKey || undefined,
    currentWaypointIndex: patrol.agent.currentWaypointIndex,
    targetWaypointIndex: patrol.agent.targetWaypointIndex,
    roundsCompleted: patrol.agent.roundsCompleted,
    requested: patrol.requested,
    advanced: patrol.advanced,
    reason: patrol.state.reason,
  };
}

function movementRequestRecord(
  movement: GameboardInteractionCommandExecution['movement']
): GameboardMovementEventRecord | undefined {
  if (!movement) {
    return undefined;
  }
  return {
    placementId: movement.placement.id,
    actorId: actorIdFromPlacement(movement.placement),
    tileKey: movement.placement.tileKey,
    assetId: movement.placement.assetId,
    profileId: movement.profile.id,
    moved: false,
    state: copyMovementPathState(movement.state),
  };
}

function actorIdFromPlacement(placement: GameboardMovementAdvanceResult['placement']): string | undefined {
  const actorId = placement.metadata.actorId;
  return typeof actorId === 'string' && actorId.length > 0 ? actorId : undefined;
}

function questRecord(snapshot: GameboardQuestSnapshot | undefined): GameboardQuestEventRecord | undefined {
  if (!snapshot) {
    return undefined;
  }
  return {
    questId: snapshot.quest.questId,
    title: snapshot.quest.title,
    status: snapshot.quest.status,
    activeObjectiveIndex: snapshot.quest.activeObjectiveIndex,
    activeObjectiveId: snapshot.quest.objectives[snapshot.quest.activeObjectiveIndex]?.id,
    objectives: snapshot.quest.objectives.map(copyQuestObjective),
    progress: snapshot.quest.progress.map((progress) => ({ ...progress })),
  };
}

function copyMovementPathState(state: MovementPathStateValue): MovementPathStateValue {
  return {
    ...state,
    pathKeys: [...state.pathKeys],
  };
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
