/**
 * Game-loop systems for commands, patrols, movement, actor targeting, and quest
 * advancement against a live Koota gameboard world.
 *
 * @module
 */
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

/**
 * Event emitted by one high-level gameboard system pass.
 */
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

/**
 * Command execution requested a movement path.
 */
export interface GameboardMovementRequestedEvent {
  /** Event discriminator. */
  type: 'movement-requested';
  /** Command execution that produced the movement request. */
  execution: GameboardInteractionCommandExecution;
}

/**
 * Command execution completed through a handler.
 */
export interface GameboardCommandHandledEvent {
  /** Event discriminator. */
  type: 'command-handled';
  /** Command execution that was handled. */
  execution: GameboardInteractionCommandExecution;
}

/**
 * Command execution was blocked before mutation.
 */
export interface GameboardCommandBlockedEvent {
  /** Event discriminator. */
  type: 'command-blocked';
  /** Command execution that failed. */
  execution: GameboardInteractionCommandExecution;
  /** Blocked reason. */
  reason?: string;
}

/**
 * Command execution had no effect.
 */
export interface GameboardCommandIgnoredEvent {
  /** Event discriminator. */
  type: 'command-ignored';
  /** Command execution that was ignored. */
  execution: GameboardInteractionCommandExecution;
  /** Ignored reason. */
  reason?: string;
}

/**
 * Command requires a host-game handler before it can mutate state.
 */
export interface GameboardCommandHandlerRequiredEvent {
  /** Event discriminator. */
  type: 'command-handler-required';
  /** Command execution awaiting a handler. */
  execution: GameboardInteractionCommandExecution;
}

/**
 * Patrol system requested movement for a patrol agent.
 */
export interface GameboardPatrolMoveRequestedEvent {
  /** Event discriminator. */
  type: 'patrol-move-requested';
  /** Patrol advancement result. */
  patrol: GameboardPatrolAdvanceResult;
}

/**
 * Patrol agent entered or remained in a waiting state.
 */
export interface GameboardPatrolWaitingEvent {
  /** Event discriminator. */
  type: 'patrol-waiting';
  /** Patrol advancement result. */
  patrol: GameboardPatrolAdvanceResult;
}

/**
 * Patrol agent completed its route or configured rounds.
 */
export interface GameboardPatrolCompletedEvent {
  /** Event discriminator. */
  type: 'patrol-completed';
  /** Patrol advancement result. */
  patrol: GameboardPatrolAdvanceResult;
}

/**
 * Patrol agent could not advance.
 */
export interface GameboardPatrolBlockedEvent {
  /** Event discriminator. */
  type: 'patrol-blocked';
  /** Patrol advancement result. */
  patrol: GameboardPatrolAdvanceResult;
  /** Blocked reason. */
  reason?: string;
}

/**
 * Movement system advanced a placement along a path.
 */
export interface GameboardMovementSteppedEvent {
  /** Event discriminator. */
  type: 'movement-stepped';
  /** Movement advancement result. */
  movement: GameboardMovementAdvanceResult;
}

/**
 * Movement system completed a path.
 */
export interface GameboardMovementCompletedEvent {
  /** Event discriminator. */
  type: 'movement-completed';
  /** Movement advancement result. */
  movement: GameboardMovementAdvanceResult;
}

/**
 * Movement system could not advance a path.
 */
export interface GameboardMovementBlockedEvent {
  /** Event discriminator. */
  type: 'movement-blocked';
  /** Movement advancement result. */
  movement: GameboardMovementAdvanceResult;
  /** Blocked reason. */
  reason?: string;
}

/**
 * Quest state advanced but may not yet be completed.
 */
export interface GameboardQuestAdvancedEvent {
  /** Event discriminator. */
  type: 'quest-advanced';
  /** Quest snapshot before the advance. */
  before?: GameboardQuestSnapshot;
  /** Quest snapshot after the advance. */
  quest: GameboardQuestSnapshot;
}

/**
 * Quest completed during a system pass.
 */
export interface GameboardQuestCompletedEvent {
  /** Event discriminator. */
  type: 'quest-completed';
  /** Quest snapshot before completion. */
  before?: GameboardQuestSnapshot;
  /** Quest snapshot after completion. */
  quest: GameboardQuestSnapshot;
}

/**
 * Quest became blocked during a system pass.
 */
export interface GameboardQuestBlockedEvent {
  /** Event discriminator. */
  type: 'quest-blocked';
  /** Quest snapshot before the blocked state. */
  before?: GameboardQuestSnapshot;
  /** Quest snapshot after the blocked state. */
  quest: GameboardQuestSnapshot;
  /** Blocked reason from objective progress. */
  reason?: string;
}

/**
 * Command dispatch options used by system helpers.
 */
export interface DispatchGameboardInteractionCommandOptions extends GameboardInteractionCommandExecutionOptions {}

/**
 * Result of dispatching one interaction command.
 */
export interface DispatchGameboardInteractionCommandResult {
  /** Command execution result. */
  execution: GameboardInteractionCommandExecution;
  /** In-memory events emitted by the dispatch. */
  events: readonly GameboardSystemEvent[];
  /** Serializable event records derived from `events`. */
  eventRecords: readonly GameboardSystemEventRecord[];
}

/**
 * Result of selecting an actor target and dispatching the planned command.
 */
export interface DispatchGameboardActorTargetCommandResult {
  /** Actor-target command plan. */
  targetCommand: GameboardActorTargetCommandPlan;
  /** Dispatch result when the target command was executable. */
  dispatch?: DispatchGameboardInteractionCommandResult;
  /** In-memory events emitted by the dispatch. */
  events: readonly GameboardSystemEvent[];
  /** Serializable event records derived from `events`. */
  eventRecords: readonly GameboardSystemEventRecord[];
  /** Reason no command was dispatched or dispatch was blocked. */
  reason?: string;
}

/**
 * System tick options. Set a subsystem to false to skip it for this tick.
 */
export interface RunGameboardSystemsOptions {
  /** Patrol advancement options or false to skip patrols. */
  patrols?: AdvanceGameboardPatrolOptions | false;
  /** Movement advancement options or false to skip movement. */
  movement?: AdvanceGameboardMovementOptions | false;
  /** Quest advancement options or false to skip quests. */
  quests?: AdvanceGameboardQuestOptions | false;
}

/**
 * Result of running patrol, movement, and quest systems.
 */
export interface RunGameboardSystemsResult {
  /** Patrol results produced by this tick. */
  patrols: readonly GameboardPatrolAdvanceResult[];
  /** Movement results produced by this tick. */
  movement: readonly GameboardMovementAdvanceResult[];
  /** Quest snapshots after advancement. */
  quests: readonly GameboardQuestSnapshot[];
  /** In-memory events emitted by all enabled systems. */
  events: readonly GameboardSystemEvent[];
  /** Serializable event records derived from `events`. */
  eventRecords: readonly GameboardSystemEventRecord[];
}

/**
 * Options for dispatching a command and then optionally running systems.
 */
export interface RunGameboardInteractionOptions extends DispatchGameboardInteractionCommandOptions {
  /** Systems to run after dispatch, or false to only dispatch the command. */
  systems?: RunGameboardSystemsOptions | false;
}

/**
 * Result of command dispatch plus optional system advancement.
 */
export interface RunGameboardInteractionResult {
  /** Command dispatch result. */
  dispatch: DispatchGameboardInteractionCommandResult;
  /** System result when systems were enabled. */
  systems?: RunGameboardSystemsResult;
  /** Combined dispatch and system events. */
  events: readonly GameboardSystemEvent[];
  /** Serializable event records derived from `events`. */
  eventRecords: readonly GameboardSystemEventRecord[];
}

/**
 * Result of target selection, command dispatch, and optional system advancement.
 */
export interface RunGameboardActorTargetInteractionResult {
  /** Actor-target command plan. */
  targetCommand: GameboardActorTargetCommandPlan;
  /** Interaction result when the target command was executable. */
  interaction?: RunGameboardInteractionResult;
  /** Dispatch result when command dispatch occurred. */
  dispatch?: DispatchGameboardInteractionCommandResult;
  /** System result when systems were enabled. */
  systems?: RunGameboardSystemsResult;
  /** Combined dispatch and system events. */
  events: readonly GameboardSystemEvent[];
  /** Serializable event records derived from `events`. */
  eventRecords: readonly GameboardSystemEventRecord[];
  /** Reason no interaction occurred or dispatch was blocked. */
  reason?: string;
}

/**
 * Serializable event record for tests, logs, interop snapshots, and simulations.
 */
export interface GameboardSystemEventRecord {
  /** Event discriminator. */
  type: GameboardSystemEvent['type'];
  /** Optional failure or blocked reason. */
  reason?: string;
  /** Command record for command-related events. */
  command?: GameboardInteractionCommandRecord;
  /** Patrol record for patrol-related events. */
  patrol?: GameboardPatrolEventRecord;
  /** Movement record for movement-related events. */
  movement?: GameboardMovementEventRecord;
  /** Quest record after quest-related events. */
  quest?: GameboardQuestEventRecord;
  /** Quest record before quest-related events. */
  beforeQuest?: GameboardQuestEventRecord;
}

/**
 * Serializable command execution record.
 */
export interface GameboardInteractionCommandRecord {
  /** Command kind. */
  kind: GameboardInteractionCommand['kind'];
  /** Command intent. */
  intent: GameboardInteractionCommand['intent'];
  /** Execution status. */
  status: GameboardInteractionCommandExecution['status'];
  /** Whether the command could execute at dispatch time. */
  canExecute: boolean;
  /** Optional blocked or handler reason. */
  reason?: string;
  /** Handler id when a handler processed the command. */
  handlerId?: string;
  /** Handler status when a handler processed the command. */
  handlerStatus?: GameboardInteractionHandlerResult['status'];
  /** Handler metadata when supplied. */
  handlerMetadata?: GameboardInteractionHandlerResult['metadata'];
  /** Side-effect type list for compact reporting. */
  effectTypes?: readonly GameboardInteractionHandlerEffect['type'][];
  /** Full handler side effects. */
  effects?: readonly GameboardInteractionHandlerEffect[];
  /** Target tile key, when applicable. */
  tileKey?: string;
  /** Target placement id, when applicable. */
  placementId?: string;
  /** Target actor id, when applicable. */
  actorId?: string;
  /** Source actor id, when applicable. */
  sourceActorId?: string;
  /** Source placement id, when applicable. */
  sourcePlacementId?: string;
  /** Resolved target summary. */
  target: {
    /** Target kind. */
    kind: GameboardInteractionCommand['target']['kind'];
    /** Target intent. */
    intent: GameboardInteractionCommand['target']['intent'];
    /** Target tile key. */
    tileKey?: string;
    /** Target placement id. */
    placementId?: string;
    /** Target actor id. */
    actorId?: string;
    /** Whether the source can enter the target tile. */
    canEnter: boolean;
  };
}

/**
 * Serializable movement event record.
 */
export interface GameboardMovementEventRecord {
  /** Placement id being moved. */
  placementId: string;
  /** Actor id when the moved placement is actor-backed. */
  actorId?: string;
  /** Current tile key for the moved placement. */
  tileKey: string;
  /** Placement asset id. */
  assetId: string;
  /** Movement profile id used for the move. */
  profileId: GameboardMovementProfile['id'];
  /** Whether the placement moved during this event. */
  moved: boolean;
  /** Snapshot of the path state. */
  state: MovementPathStateValue;
}

/**
 * Serializable patrol event record.
 */
export interface GameboardPatrolEventRecord {
  /** Placement id controlled by the patrol agent. */
  placementId: string;
  /** Actor id when the patrol placement is actor-backed. */
  actorId?: string;
  /** Patrol route id. */
  routeId: string;
  /** Patrol status after advancement. */
  status: GameboardPatrolStatus;
  /** Current target waypoint tile key. */
  targetKey?: string;
  /** Current waypoint index. */
  currentWaypointIndex: number;
  /** Target waypoint index. */
  targetWaypointIndex: number;
  /** Completed route rounds. */
  roundsCompleted: number;
  /** Whether movement was requested. */
  requested: boolean;
  /** Whether the patrol pointer advanced. */
  advanced: boolean;
  /** Optional patrol blocked/waiting reason. */
  reason?: string;
}

/**
 * Serializable quest event record.
 */
export interface GameboardQuestEventRecord {
  /** Quest id. */
  questId: string;
  /** Quest title. */
  title: string;
  /** Quest status. */
  status: GameboardQuestSnapshot['quest']['status'];
  /** Active objective index. */
  activeObjectiveIndex: number;
  /** Active objective id. */
  activeObjectiveId?: string;
  /** Quest objectives. */
  objectives: readonly GameboardQuestObjective[];
  /** Objective progress snapshots. */
  progress: readonly GameboardQuestObjectiveProgress[];
}

/**
 * Koota action bundle for high-level game-loop dispatch and system ticks.
 */
export const gameboardSystemActions = createActions((world) => ({
  /** Execute one command and emit dispatch event records. */
  dispatchCommand: (
    commandOrTarget: GameboardInteractionCommandInput,
    options: DispatchGameboardInteractionCommandOptions = {}
  ) => dispatchGameboardInteractionCommand(world, commandOrTarget, options),
  /** Select an actor target, then execute its planned command. */
  dispatchActorTargetCommand: (
    options: GameboardActorTargetCommandOptions,
    commandOptions: DispatchGameboardInteractionCommandOptions = {}
  ) => dispatchGameboardActorTargetCommand(world, options, commandOptions),
  /** Run enabled patrol, movement, and quest systems for one tick. */
  run: (options: RunGameboardSystemsOptions = {}) => runGameboardSystems(world, options),
  /** Dispatch a command and optionally tick systems. */
  interact: (commandOrTarget: GameboardInteractionCommandInput, options: RunGameboardInteractionOptions = {}) =>
    runGameboardInteraction(world, commandOrTarget, options),
  /** Target an actor, dispatch the command, and optionally tick systems. */
  interactActorTarget: (
    options: GameboardActorTargetCommandOptions,
    interactionOptions: RunGameboardInteractionOptions = {}
  ) => runGameboardActorTargetInteraction(world, options, interactionOptions),
}));

/**
 * Executes one interaction command and converts the execution into system
 * events and serializable records.
 */
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

/**
 * Plans a command against an actor target, then dispatches it when executable.
 */
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

/**
 * Runs the enabled patrol, movement, and quest systems for one game-loop tick.
 */
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

/**
 * Dispatches an interaction command and then runs systems unless disabled.
 */
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

/**
 * Selects an actor target, dispatches the planned command, and then runs
 * systems unless disabled.
 */
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

/**
 * Converts one in-memory system event into a serializable event record.
 */
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

/**
 * Converts in-memory system events into serializable records.
 */
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
