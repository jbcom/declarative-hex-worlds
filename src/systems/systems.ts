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
} from '../commands';
import {
  runGameboardMovementSystem,
  type AdvanceGameboardMovementOptions,
  type GameboardMovementAdvanceResult,
} from '../movement';
import {
  runGameboardPatrolSystem,
  type AdvanceGameboardPatrolOptions,
  type GameboardPatrolAdvanceResult,
} from '../patrol';
import {
  advanceAllGameboardQuests,
  readGameboardQuests,
  type AdvanceGameboardQuestOptions,
  type GameboardQuestSnapshot,
} from '../quests';
import {
  snapshotGameboardSystemEvents,
  type GameboardSystemEvent,
  type GameboardSystemEventRecord,
} from './events';

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
  const events: GameboardSystemEvent[] = [];
  for (const patrol of patrols) {
    for (const event of patrolEvents(patrol)) {
      events.push(event);
    }
  }
  for (const move of movement) {
    for (const event of movementEvents(move)) {
      events.push(event);
    }
  }
  for (const event of questEvents(beforeQuests, quests)) {
    events.push(event);
  }
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
