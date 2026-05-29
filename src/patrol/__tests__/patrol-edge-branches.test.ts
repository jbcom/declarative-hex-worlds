/**
 * Targeted coverage for patrol.ts edge branches (PRD E0a batch 42).
 *
 * Covers:
 *   - advancePatrolEntity: waitTicksRemaining > 0 → waiting branch
 *   - advancePatrolEntity: !nextAgent.active → completed branch (after non-end waypoint)
 *   - advancePatrolEntity: deactivateOnBlocked:false keeps active=true on blocked movement
 *
 * @module
 */

import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../gameboard/index';
import { createGameboardWorld } from '../../koota/index';
import { spawnGameboardActor } from '../../actors/index';
import {
  advanceGameboardPatrol,
  setGameboardPatrolAgent,
} from '../../patrol/index';
import { advanceGameboardMovement } from '../../movement/index';

function makePatrolWorld(seed: string) {
  const world = createGameboardWorld(
    createGameboardBuilder({
      seed,
      shape: { kind: 'rectangle', width: 3, height: 1 },
    }).build()
  );
  const guard = spawnGameboardActor(world, {
    id: `${seed}-placement`,
    actorId: `${seed}-guard`,
    actorKind: 'npc',
    at: '0,0',
    assetId: 'flag_blue',
    kind: 'unit',
  });
  return { world, guard };
}

describe('patrol edge branches (PRD E0a)', () => {
  it('waitTicksRemaining > 0 yields waiting status after waypoint arrival', () => {
    const { world, guard } = makePatrolWorld('patrol-wait-tick');

    // Set patrol with pauseTicks=1 so after arriving at waypoint 1 it waits one tick.
    setGameboardPatrolAgent(world, guard, {
      route: {
        id: 'wait-route',
        waypointKeys: ['0,0', '1,0', '2,0'],
        loop: false,
        segmentCosts: [1, 1],
      },
      pauseTicks: 1,
      movement: { profile: 'ground' },
    });

    // First patrol advance: targetWaypointIndex=1 is selected, movement to 1,0 is requested.
    const step1 = advanceGameboardPatrol(world, guard);
    expect(step1.state.status).toBe('requested');

    // Advance movement until the unit arrives at 1,0 (completes the move).
    let movResult = advanceGameboardMovement(world, guard);
    while (movResult.state.status === 'moving') {
      movResult = advanceGameboardMovement(world, guard);
    }
    expect(movResult.state.status).toBe('completed');

    // Now advance patrol: completePatrolWaypointIfNeeded fires → waitTicksRemaining=1.
    // waitTicksRemaining > 0 branch executes → state becomes 'waiting'.
    const step2 = advanceGameboardPatrol(world, guard);
    expect(step2.state.status).toBe('waiting');
  });

  it('deactivateOnBlocked:false keeps agent active after blocked movement', () => {
    // 2-tile board; place a blocker on the second tile so movement is immediately blocked.
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'patrol-deactivate-false',
        shape: { kind: 'rectangle', width: 2, height: 1 },
      }).build()
    );
    // Spawn unit at 0,0 and a blocker unit at 1,0
    const guard = spawnGameboardActor(world, {
      id: 'deactivate-false-placement',
      actorId: 'deactivate-false-guard',
      actorKind: 'npc',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      id: 'blocker-placement',
      actorId: 'blocker',
      actorKind: 'npc',
      at: '1,0',
      assetId: 'flag_red',
      kind: 'unit',
    });

    setGameboardPatrolAgent(world, guard, {
      route: {
        id: 'blocked-route',
        waypointKeys: ['0,0', '1,0'],
        loop: false,
        segmentCosts: [1],
      },
      movement: { profile: 'ground' },
    });

    // Advance with deactivateOnBlocked:false — blocker at 1,0 is statically placed,
    // so patrol is always blocked and the agent stays active.
    const result = advanceGameboardPatrol(world, guard, { deactivateOnBlocked: false });
    expect(result.state.status).toBe('blocked');
    expect(result.agent.active).toBe(true);
  });

  it('!nextAgent.active after route end yields completed status', () => {
    const { world, guard } = makePatrolWorld('patrol-completed-branch');

    // 2-waypoint non-loop route; after advancing from first to last waypoint, route is done.
    setGameboardPatrolAgent(world, guard, {
      route: {
        id: 'end-route',
        waypointKeys: ['0,0', '1,0'],
        loop: false,
        segmentCosts: [1],
      },
      movement: { profile: 'ground' },
    });

    // Advance patrol to request movement.
    const step1 = advanceGameboardPatrol(world, guard);
    expect(step1.state.status).toBe('requested');

    // Advance movement until arrived.
    let mov = advanceGameboardMovement(world, guard);
    while (mov.state.status === 'moving') {
      mov = advanceGameboardMovement(world, guard);
    }
    expect(mov.state.status).toBe('completed');

    // Patrol advance: completePatrolWaypointIfNeeded fires; since it's route end,
    // active is set to false → !nextAgent.active → completed branch executes.
    const step2 = advanceGameboardPatrol(world, guard);
    expect(step2.state.status).toBe('completed');
  });
});
