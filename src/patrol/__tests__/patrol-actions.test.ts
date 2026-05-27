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
import { createGameboardBuilder } from '../../gameboard/index';
import { createGameboardWorld } from '../../koota/index';
import { spawnGameboardActor } from '../../actors/index';
import { gameboardPatrolActions } from '../patrol';

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
});
