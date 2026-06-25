/**
 * Command dispatch system boundary: plan or execute gameplay commands and
 * convert command results into system events.
 *
 * @module
 */
import type { World } from 'koota';
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
