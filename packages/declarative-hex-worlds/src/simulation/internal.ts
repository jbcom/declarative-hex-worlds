/**
 * Simulation-domain internal runtime tables + guards.
 *
 * These are NOT public API — the verbose `GAMEBOARD_SCENARIO_SIMULATION_*`
 * constants are the published surface; these short-aliased event/type tables and
 * their guards are implementation detail shared between `./script` and
 * `./report`. They live here (not in `./script`) so the `./simulation` barrel
 * shim can re-export the public surface without flattening these internals into
 * the umbrella. Imported by siblings via `'./internal'`.
 *
 * @module
 * @internal
 */

import type { GameboardInteractionCommandKind } from '../actors';
import { hexKey, parseHexKey } from '../coordinates';
import { includesString, isHexCoordinatesInput } from '../internal';
import type { GameboardSystemEventRecord } from '../systems';

/**
 * Supported simulation step action discriminators. Canonical home (script.ts
 * re-exports this as the public `GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS`);
 * kept here so the guards below avoid a script.ts → internal → script.ts import
 * cycle (which caused a TDZ "before initialization" crash).
 */
export const SIMULATION_STEP_ACTIONS = [
  'actor-target-command',
  'command',
  'inspect-actor-targets',
  'run-systems',
  'remove-actor',
  'remove-placement',
  'spawn-actor',
  'spawn-placement',
  'update-actor',
  'update-placement',
] as const;

/** Every interaction-command kind a simulation can dispatch. */
export const SIMULATION_COMMAND_KIND_VALUES = [
  'move',
  'interact-actor',
  'interact-placement',
  'attack-actor',
  'inspect-actor',
  'inspect-placement',
  'inspect-tile',
  'none',
] as const satisfies readonly GameboardInteractionCommandKind[];

/** Every world-mutation discriminator the simulation engine can apply. */
export const SIMULATION_MUTATION_TYPES = [
  'actor-removed',
  'placement-removed',
  'actor-spawned',
  'placement-spawned',
  'actor-updated',
  'placement-updated',
] as const;

/** Every system-event type the simulation can emit. */
export const SIMULATION_EVENT_TYPES = [
  'command-handled',
  'movement-requested',
  'command-blocked',
  'command-ignored',
  'command-handler-required',
  'patrol-move-requested',
  'patrol-waiting',
  'patrol-completed',
  'patrol-blocked',
  'movement-stepped',
  'movement-completed',
  'movement-blocked',
  'quest-advanced',
  'quest-completed',
  'quest-blocked',
] as const satisfies readonly GameboardSystemEventRecord['type'][];

/** Movement-only subset of {@link SIMULATION_EVENT_TYPES}. */
export const SIMULATION_MOVEMENT_EVENT_TYPES = [
  'movement-requested',
  'movement-stepped',
  'movement-completed',
  'movement-blocked',
] as const satisfies readonly GameboardSystemEventRecord['type'][];

/** Patrol-only subset of {@link SIMULATION_EVENT_TYPES}. */
export const SIMULATION_PATROL_EVENT_TYPES = [
  'patrol-move-requested',
  'patrol-waiting',
  'patrol-completed',
  'patrol-blocked',
] as const satisfies readonly GameboardSystemEventRecord['type'][];

/** Every actor-target approach mode accepted by simulation targeting. */
export const SIMULATION_ACTOR_TARGET_APPROACH_VALUES = [
  'target-tile',
  'adjacent',
  'nearest',
  'self',
  'none',
] as const;

/** Every actor-target sort key accepted by simulation targeting. */
export const SIMULATION_ACTOR_TARGET_SORT_VALUES = [
  'pathCost',
  'distance',
  'actorId',
  'tileKey',
] as const;

/** Resolve a tile key from a string or {q,r} input (module-shared helper). */
export function tileKeyFromTargetInput(value: unknown): string | undefined {
  if (typeof value === 'string') {
    try {
      return hexKey(parseHexKey(value));
    } catch {
      return undefined;
    }
  }
  return isHexCoordinatesInput(value) ? hexKey(value) : undefined;
}

/** True when `value` is a known simulation step action. */
export function isSimulationStepAction(
  value: unknown
): value is (typeof SIMULATION_STEP_ACTIONS)[number] {
  return includesString([...SIMULATION_STEP_ACTIONS], value);
}

/** True when `value` is a movement system-event type. */
export function isSimulationMovementEventType(
  value: unknown
): value is (typeof SIMULATION_MOVEMENT_EVENT_TYPES)[number] {
  return includesString([...SIMULATION_MOVEMENT_EVENT_TYPES], value);
}

/** True when `value` is a patrol system-event type. */
export function isSimulationPatrolEventType(
  value: unknown
): value is (typeof SIMULATION_PATROL_EVENT_TYPES)[number] {
  return includesString([...SIMULATION_PATROL_EVENT_TYPES], value);
}
