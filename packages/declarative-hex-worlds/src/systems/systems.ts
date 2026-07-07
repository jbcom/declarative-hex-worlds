/**
 * High-level game-loop helpers combining command dispatch with optional system
 * ticks against a live Koota gameboard world.
 *
 * @module
 */
import { createActions, type World } from 'koota';
import {
  planGameboardActorTargetCommand,
  type GameboardActorTargetCommandOptions,
  type GameboardActorTargetCommandPlan,
  type GameboardInteractionCommandInput,
} from '../commands';
import {
  dispatchGameboardActorTargetCommand,
  dispatchGameboardInteractionCommand,
  type DispatchGameboardInteractionCommandOptions,
  type DispatchGameboardInteractionCommandResult,
} from './command-dispatch';
import {
  snapshotGameboardSystemEvents,
  type GameboardSystemEvent,
  type GameboardSystemEventRecord,
} from './events';
import {
  runGameboardSystems,
  type RunGameboardSystemsOptions,
  type RunGameboardSystemsResult,
} from './tick';

export {
  dispatchGameboardActorTargetCommand,
  dispatchGameboardInteractionCommand,
} from './command-dispatch';
export type {
  DispatchGameboardActorTargetCommandResult,
  DispatchGameboardInteractionCommandOptions,
  DispatchGameboardInteractionCommandResult,
} from './command-dispatch';
export { runGameboardSystems } from './tick';
export type { RunGameboardSystemsOptions, RunGameboardSystemsResult } from './tick';

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
      reason: targetCommand.reason,
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
