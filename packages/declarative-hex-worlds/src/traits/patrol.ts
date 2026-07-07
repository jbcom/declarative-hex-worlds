/**
 * Patrol koota traits + supporting types.
 *
 * @module
 */

import { trait } from 'koota';

/** Runtime patrol status for a patrol agent. */
export type GameboardPatrolStatus =
  | 'idle'
  | 'waiting'
  | 'requested'
  | 'moving'
  | 'completed'
  | 'blocked'
  | 'paused';

/** Patrol agent trait storing route progress and wait state. */
export const GameboardPatrolAgent = trait({
  /** Route id followed by this patrol. */
  routeId: '',
  /** Ordered route waypoint tile keys. */
  waypointKeys: () => [] as string[],
  /** Optional movement budget per route segment. */
  segmentCosts: () => [] as number[],
  /** Whether the route loops back to the first waypoint. */
  loop: true,
  /** Whether the patrol agent is active. */
  active: true,
  /** Current waypoint index. */
  currentWaypointIndex: 0,
  /** Target waypoint index for an in-flight segment. */
  targetWaypointIndex: -1,
  /** Number of completed route rounds. */
  roundsCompleted: 0,
  /** Ticks to wait after reaching each waypoint. */
  pauseTicks: 0,
  /** Remaining wait ticks before the next segment. */
  waitTicksRemaining: 0,
});

/** Patrol state trait exposed for systems and UIs. */
export const GameboardPatrolState = trait({
  /** Current patrol status. */
  status: 'idle' as GameboardPatrolStatus,
  /** Current target waypoint tile key. */
  targetKey: '',
  /** Blocked or paused reason. */
  reason: undefined as string | undefined,
  /** Last requested movement path tile keys. */
  lastPathKeys: () => [] as string[],
});

/** Marker trait for patrol agents. */
export const IsGameboardPatrolAgent = trait();
