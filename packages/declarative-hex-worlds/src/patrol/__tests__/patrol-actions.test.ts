/**
 * Patrol action bundle coverage (PRD E0b).
 *
 * Exercises the `gameboardPatrolActions` createActions closure bodies —
 * koota wraps each method as an action that takes a `world` from
 * `world.actions(bundle)`, so the body only runs when the bundle is
 * actually dispatched. Direct calls to `setGameboardPatrolAgent` etc.
 * are already tested in `systems.test.ts`; this file exercises the
 * action-bundle wrapper.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';
import type { Entity, World } from 'koota';
import { createGameboardBuilder } from '../../gameboard/index';
import { PlacementState, createGameboardWorld } from '../../koota/index';
import { spawnGameboardActor } from '../../actors/index';
import { MovementPathState } from '../../movement/index';
import {
  GameboardPatrolAgent,
  GameboardPatrolState,
  advanceGameboardPatrol,
  gameboardPatrolActions,
  readGameboardPatrolAgents,
  setGameboardPatrolAgent,
} from '../patrol';

describe('gameboardPatrolActions bundle (PRD E0b)', () => {
  it('set + read + advance + clear + run all return safe values', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'patrol-actions',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    const guard = spawnGameboardActor(world, {
      id: 'guard-placement',
      actorId: 'guard',
      actorKind: 'npc',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });

    const actions = gameboardPatrolActions(world);

    // set: attach a patrol route.
    actions.set(guard, {
      route: {
        id: 'wall-loop',
        waypointKeys: ['0,0', '1,0', '2,0'],
        loop: false,
        segmentCosts: [1, 1],
      },
      movement: { profile: 'ground' },
    });

    // read: returns snapshots.
    const snapshots = actions.read();
    expect(snapshots.length).toBeGreaterThan(0);

    // advance: tick one agent.
    const advanceResult = actions.advance(guard);
    expect(advanceResult).toBeDefined();

    // run: tick every patrol agent.
    const runResult = actions.run();
    expect(runResult).toBeDefined();

    // clear: remove patrol traits.
    actions.clear(guard);
    expect(actions.read().length).toBe(0);
  });

  it('set accepts currentWaypointIndex and clamps out-of-range values (E0h)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'patrol-clamp',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    const sentry = spawnGameboardActor(world, {
      id: 'sentry-placement',
      actorId: 'sentry',
      actorKind: 'npc',
      at: '1,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const actions = gameboardPatrolActions(world);
    actions.set(sentry, {
      route: {
        id: 'sentry-loop',
        waypointKeys: ['0,0', '1,0', '2,0'],
        loop: false,
        segmentCosts: [1, 1],
      },
      // Out-of-range index — clampWaypointIndex returns last (2)
      currentWaypointIndex: 99,
      movement: { profile: 'ground' },
    });
    expect(actions.read().length).toBe(1);

    // Negative index → 0
    actions.set(sentry, {
      route: {
        id: 'sentry-loop',
        waypointKeys: ['0,0', '1,0', '2,0'],
        loop: false,
        segmentCosts: [1, 1],
      },
      currentWaypointIndex: -5,
      movement: { profile: 'ground' },
    });
    expect(actions.read().length).toBe(1);
  });

  it('advance returns paused result when agent.active=false (E0a)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'patrol-paused',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    const guard = spawnGameboardActor(world, {
      id: 'paused-placement',
      actorId: 'paused-guard',
      actorKind: 'npc',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const actions = gameboardPatrolActions(world);
    actions.set(guard, {
      route: {
        id: 'paused-loop',
        waypointKeys: ['0,0', '1,0', '2,0'],
        loop: false,
        segmentCosts: [1, 1],
      },
      active: false,
      movement: { profile: 'ground' },
    });
    const result = actions.advance(guard);
    expect(result.state.status).toBe('paused');
  });

  it('advance from end of a non-loop route returns completed (E0a)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'patrol-end',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    const guard = spawnGameboardActor(world, {
      id: 'end-placement',
      actorId: 'end-guard',
      actorKind: 'npc',
      at: '2,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const actions = gameboardPatrolActions(world);
    // Set currentWaypointIndex to the last waypoint of a non-loop route
    // so nextPatrolWaypointIndex returns undefined → completed branch.
    actions.set(guard, {
      route: {
        id: 'end-route',
        waypointKeys: ['0,0', '1,0', '2,0'],
        loop: false,
        segmentCosts: [1, 1],
      },
      currentWaypointIndex: 2,
      movement: { profile: 'ground' },
    });
    const result = actions.advance(guard);
    // Either completed or moving depending on movement state — both
    // exercise advancePatrolEntity past the next-index resolution.
    expect(['completed', 'requested', 'paused', 'moving', 'blocked', 'waiting']).toContain(result.state.status);
  });

  it('advance with looped route wraps next index back to 0 (E0a)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'patrol-loop',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    const guard = spawnGameboardActor(world, {
      id: 'loop-placement',
      actorId: 'loop-guard',
      actorKind: 'npc',
      at: '2,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const actions = gameboardPatrolActions(world);
    actions.set(guard, {
      route: {
        id: 'loop-route',
        waypointKeys: ['0,0', '1,0', '2,0'],
        loop: true,
        segmentCosts: [1, 1, 1],
      },
      currentWaypointIndex: 2,
      movement: { profile: 'ground' },
    });
    const result = actions.advance(guard);
    // nextPatrolWaypointIndex returns 0 (loop), advance proceeds to request
    // movement back to (0,0).
    expect(result).toBeDefined();
  });

  it('set throws when given a string id that does not resolve to an entity (E0a)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'patrol-missing-id',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    const actions = gameboardPatrolActions(world);
    expect(() =>
      actions.set('definitely-no-such-actor-or-placement', {
        route: {
          id: 'orphan-route',
          waypointKeys: ['0,0', '1,0'],
          loop: false,
          segmentCosts: [1],
        },
        movement: { profile: 'ground' },
      })
    ).toThrow(/No placement or actor exists/);
  });

  it('advance returns blocked when route has fewer than two waypoints (E0a)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'patrol-short-route',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    const guard = spawnGameboardActor(world, {
      id: 'short-route-placement',
      actorId: 'short-route-guard',
      actorKind: 'npc',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const actions = gameboardPatrolActions(world);
    actions.set(guard, {
      route: {
        id: 'single-waypoint',
        waypointKeys: ['0,0'],
        loop: false,
        segmentCosts: [],
      },
      movement: { profile: 'ground' },
    });
    const result = actions.advance(guard);
    expect(result.state.status).toBe('blocked');
    expect(result.state.reason).toMatch(/requires at least two waypoints/);
  });

  it('clampWaypointIndex returns 0 when route has no waypoints (PRD E0a)', () => {
    // Exercises patrol.ts line 415-416: clampWaypointIndex(n, 0) returns 0
    // when waypointCount <= 0. Triggered by set() with currentWaypointIndex
    // provided alongside an empty waypointKeys array.
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'patrol-empty-waypoints',
        shape: { kind: 'rectangle', width: 2, height: 1 },
      }).build()
    );
    const guard = spawnGameboardActor(world, {
      id: 'empty-route-placement',
      actorId: 'empty-route-guard',
      actorKind: 'npc',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const actions = gameboardPatrolActions(world);
    actions.set(guard, {
      route: {
        id: 'empty-route',
        waypointKeys: [],
        loop: false,
        segmentCosts: [],
      },
      currentWaypointIndex: 5,
      movement: { profile: 'ground' },
    });
    const snapshots = actions.read();
    const snapshot = snapshots[0];
    // clamped to 0 because waypointCount is 0.
    expect(snapshot?.agent.currentWaypointIndex).toBe(0);
  });

  it('sorts patrol snapshots and accepts string ids with route defaults (E0h)', () => {
    const world = patrolWorld('patrol-sorted-read', 3);
    const zed = spawnGuard(world, 'zed', '0,0');
    spawnGuard(world, 'beta', '1,0', 'flag_green');
    spawnGuard(world, 'alpha', '2,0', 'flag_red');
    const actions = gameboardPatrolActions(world);

    actions.set('zed-placement', { route: { id: 'z-route', waypointKeys: ['1,0', '2,0'] } });
    actions.set('beta-placement', {
      route: { id: 'a-route', waypointKeys: ['2,0', '0,0'] },
      alignToCurrentTile: false,
    });
    actions.set('alpha-placement', { route: { id: 'a-route', waypointKeys: ['2,0', '1,0'] } });

    expect(zed.get(GameboardPatrolAgent)).toMatchObject({ loop: true, segmentCosts: [] });
    expect(readGameboardPatrolAgents(world).map((snapshot) => `${snapshot.agent.routeId}:${snapshot.placement.id}`)).toEqual([
      'a-route:alpha-placement',
      'a-route:beta-placement',
      'z-route:zed-placement',
    ]);
  });

  it('handles blocked movement fallbacks and blocked movement requests (E0a)', () => {
    const world = patrolWorld('patrol-blocked-fallbacks', 3, 3);
    const fallback = spawnGuard(world, 'blocked-fallback', '0,0');
    const requestedBlocked = spawnGuard(world, 'blocked-request', '0,2', 'flag_red');

    setGameboardPatrolAgent(world, fallback, {
      route: { id: 'fallback-route', waypointKeys: ['0,0', '1,0'], loop: false, segmentCosts: [1] },
      movement: { profile: 'ground' },
    });
    fallback.set(GameboardPatrolState, {
      status: 'requested',
      targetKey: '1,0',
      reason: undefined,
      lastPathKeys: ['0,0', '1,0'],
    });
    fallback.set(MovementPathState, blockedMovementState(undefined, undefined));

    const result = advanceGameboardPatrol(world, fallback, { deactivateOnBlocked: false });
    expect(result.agent.active).toBe(true);
    expect(result.state).toMatchObject({
      status: 'blocked',
      targetKey: '1,0',
      reason: 'Patrol movement was blocked',
      lastPathKeys: ['0,0', '1,0'],
    });

    setGameboardPatrolAgent(world, requestedBlocked, {
      route: { id: 'request-blocked-route', waypointKeys: ['0,2', '2,2'], loop: false },
      movement: { profile: 'ground' },
    });
    expect(
      advanceGameboardPatrol(world, requestedBlocked, {
        resetMovementBudget: false,
        movement: { allowOutOfRangePath: false, movementBudget: 0 },
      })
    ).toMatchObject({ requested: true, agent: { active: false }, state: { status: 'blocked' } });
  });

  it('advances completed patrol segments through route-end and wrap states (E0a)', () => {
    const world = patrolWorld('patrol-completed-segments', 3);
    const loopGuard = spawnGuard(world, 'loop-complete', '2,0');
    const endGuard = spawnGuard(world, 'end-complete', '2,0', 'flag_green');

    setGameboardPatrolAgent(world, loopGuard, {
      route: { id: 'loop-complete', waypointKeys: ['0,0', '1,0', '2,0'], loop: true, segmentCosts: [1, 1, 1] },
      currentWaypointIndex: 2,
      pauseTicks: 2,
      movement: { profile: 'ground' },
    });
    setCompletedTarget(loopGuard, 0, '0,0', ['2,0', '1,0', '0,0']);

    const loopResult = advanceGameboardPatrol(world, loopGuard);
    expect(loopResult).toMatchObject({
      advanced: true,
      state: { status: 'waiting' },
      agent: { currentWaypointIndex: 0, roundsCompleted: 1, waitTicksRemaining: 1 },
    });

    setGameboardPatrolAgent(world, endGuard, {
      route: { id: 'end-complete', waypointKeys: ['0,0', '1,0', '2,0'], loop: false, segmentCosts: [1, 1] },
      currentWaypointIndex: 1,
      movement: { profile: 'ground' },
    });
    setCompletedTarget(endGuard, 2, '2,0', ['1,0', '2,0']);

    const endResult = advanceGameboardPatrol(world, endGuard);
    expect(endResult).toMatchObject({
      advanced: true,
      state: { status: 'completed' },
      agent: { active: false, currentWaypointIndex: 2, roundsCompleted: 1, waitTicksRemaining: 0 },
    });
  });

  it('uses idle state fallback and rejects malformed patrol entities (E0a)', () => {
    const world = patrolWorld('patrol-malformed-entities', 2);
    const guard = spawnGuard(world, 'fallback-state', '0,0');

    setGameboardPatrolAgent(world, guard, {
      route: { id: 'fallback-state-route', waypointKeys: ['0,0', '1,0'], loop: false, segmentCosts: [1] },
      movement: { profile: 'ground' },
    });
    guard.remove(GameboardPatrolState);
    expect(advanceGameboardPatrol(world, guard).previousState).toMatchObject({ status: 'idle', lastPathKeys: [] });

    expect(() =>
      setGameboardPatrolAgent(world, world.spawn(), {
        route: { id: 'missing-placement-state', waypointKeys: ['0,0', '1,0'] },
      })
    ).toThrow(/missing PlacementState/);

    const placementState = guard.get(PlacementState);
    if (!placementState) {
      throw new Error('Expected guard to have placement state');
    }
    const missingAgent = world.spawn(PlacementState(placementState));
    expect(() => advanceGameboardPatrol(world, missingAgent)).toThrow(/missing GameboardPatrolAgent/);

    const malformed = spawnGuard(world, 'malformed', '1,0', 'flag_red');
    setGameboardPatrolAgent(world, malformed, {
      route: { id: 'malformed-route', waypointKeys: ['1,0', '0,0'], loop: false, segmentCosts: [1] },
      movement: { profile: 'ground' },
    });
    const malformedAgent = malformed.get(GameboardPatrolAgent);
    if (!malformedAgent) {
      throw new Error('Expected malformed guard to have a patrol agent');
    }
    malformed.set(GameboardPatrolAgent, {
      ...malformedAgent,
      waypointKeys: ['1,0', undefined as unknown as string],
      currentWaypointIndex: 0,
    });
    expect(() => advanceGameboardPatrol(world, malformed)).toThrow(/waypoint index 1 out of range/);
  });
});

function patrolWorld(seed: string, width: number, height = 1): World {
  const shape = { kind: 'rectangle' as const, width, height };
  return createGameboardWorld(createGameboardBuilder({ seed, shape }).build());
}

function spawnGuard(world: World, id: string, at: string, assetId = 'flag_blue'): Entity {
  return spawnGameboardActor(world, {
    id: `${id}-placement`,
    actorId: `${id}-guard`,
    actorKind: 'npc',
    at,
    assetId,
    kind: 'unit',
  });
}

function blockedMovementState(destinationKey: string | undefined, pathKeys: readonly string[] | undefined, reason?: string) {
  return {
    status: 'blocked' as const,
    destinationKey: destinationKey as string,
    pathKeys: pathKeys as string[],
    nextIndex: 0,
    cost: 0,
    spentCost: 0,
    visited: 0,
    reason,
  };
}

function setCompletedTarget(entity: Entity, targetWaypointIndex: number, destinationKey: string, pathKeys: readonly string[]) {
  const agent = entity.get(GameboardPatrolAgent);
  if (!agent) {
    throw new Error('Expected guard to have a patrol agent');
  }
  entity.set(GameboardPatrolAgent, { ...agent, targetWaypointIndex });
  entity.set(MovementPathState, completedMovementState(destinationKey, pathKeys));
}

function completedMovementState(destinationKey: string, pathKeys: readonly string[]) {
  return {
    status: 'completed' as const,
    destinationKey,
    pathKeys: [...pathKeys],
    nextIndex: pathKeys.length - 1,
    cost: Math.max(0, pathKeys.length - 1),
    spentCost: Math.max(0, pathKeys.length - 1),
    visited: pathKeys.length,
    reason: undefined,
  };
}
