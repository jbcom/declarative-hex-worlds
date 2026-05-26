/**
 * Movement koota traits + supporting types.
 *
 * @module
 */

import { trait } from 'koota';

export type BuiltInGameboardMovementProfileId = 'ground' | 'worker' | 'cavalry' | 'ship' | 'flying';

export type GameboardMovementProfileId = BuiltInGameboardMovementProfileId | (string & {});

export type GameboardMovementStatus =
  | 'idle'
  | 'ready'
  | 'moving'
  | 'completed'
  | 'blocked'
  | 'out-of-range';

/** Movement agent trait attached to placement entities that can move. */
export const MovementAgent = trait({
  /** Movement profile id used by this agent. */
  profileId: 'ground' as GameboardMovementProfileId,
  /** Maximum movement budget. */
  movementBudget: 6,
  /** Remaining movement budget in the current cycle. */
  remainingMovement: 6,
});

/** Runtime path state for a movement agent. */
export const MovementPathState = trait({
  /** Current movement status. */
  status: 'idle' as GameboardMovementStatus,
  /** Destination tile key for the current request. */
  destinationKey: '',
  /** Planned path tile keys. */
  pathKeys: () => [] as string[],
  /** Next path index to advance to. */
  nextIndex: 0,
  /** Total planned path cost. */
  cost: 0,
  /** Cost spent so far. */
  spentCost: 0,
  /** Number of pathfinder nodes visited for the request. */
  visited: 0,
  /** Blocked or out-of-range reason. */
  reason: undefined as string | undefined,
});

/** Marker trait for placements with active movement. */
export const IsMoving = trait();
