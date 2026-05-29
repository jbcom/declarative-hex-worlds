/**
 * Targeted coverage for movement.ts edge branches (PRD E0a batch 42).
 *
 * Covers:
 *   - advanceOneGameboardMovement: completed / out-of-range paths
 *   - reachableGameboardMovementTiles with string id
 *   - requirePlacementEntity missing-id throw
 *
 * @module
 */

import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../gameboard/index';
import { createGameboardWorld } from '../../koota/index';
import {
  advanceGameboardMovement,
  reachableGameboardMovementTiles,
  requestGameboardMovement,
  setGameboardMovementAgent,
} from '../../movement/index';

describe('advanceOneGameboardMovement branch coverage (PRD E0a)', () => {
  it('completed branch: advancing through all path keys yields completed status', () => {
    const plan = createGameboardBuilder({
      seed: 'adv-completed',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    })
      .addPlacement({ at: { q: 0, r: 0 }, assetId: 'unit_blue_full', kind: 'unit', layer: 'unit' })
      .build();
    const world = createGameboardWorld(plan);
    const unitId = plan.placements.find((p) => p.assetId === 'unit_blue_full')?.id ?? '';
    setGameboardMovementAgent(world, unitId, { profile: 'ground' });

    // Request a 2-step path: 0,0 → 1,0 → 2,0
    const req = requestGameboardMovement(world, unitId, '2,0');
    expect(req.state.status).toBe('ready');
    expect(req.state.pathKeys.length).toBeGreaterThanOrEqual(2);

    // Advance step by step until done
    let result = advanceGameboardMovement(world, unitId);
    while (result.state.status === 'moving') {
      result = advanceGameboardMovement(world, unitId);
    }
    // After exhausting path keys nextIndex >= length → completed
    expect(result.state.status).toBe('completed');
  });

  it('out-of-range branch: zero movement budget prevents any step', () => {
    const plan = createGameboardBuilder({
      seed: 'adv-oor',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    })
      .addPlacement({ at: { q: 0, r: 0 }, assetId: 'unit_blue_full', kind: 'unit', layer: 'unit' })
      .build();
    const world = createGameboardWorld(plan);
    const unitId = plan.placements.find((p) => p.assetId === 'unit_blue_full')?.id ?? '';

    // Budget of 0 → no step affordable
    setGameboardMovementAgent(world, unitId, { profile: 'ground', movementBudget: 0 });

    const req = requestGameboardMovement(world, unitId, '2,0');
    if (req.state.status === 'ready') {
      // Path found but budget too low → out-of-range on advance
      const advanced = advanceGameboardMovement(world, unitId);
      expect(advanced.state.status).toBe('out-of-range');
    } else {
      // budget=0 causes out-of-range at request time
      expect(req.state.status).toBe('out-of-range');
    }
  });
});

describe('reachableGameboardMovementTiles with string id (PRD E0a)', () => {
  it('accepts a string placement id and returns reachable tiles array', () => {
    const plan = createGameboardBuilder({
      seed: 'reachable-str',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    })
      .addPlacement({ at: { q: 0, r: 0 }, assetId: 'unit_blue_full', kind: 'unit', layer: 'unit' })
      .build();
    const world = createGameboardWorld(plan);
    const unitId = plan.placements.find((p) => p.assetId === 'unit_blue_full')?.id ?? '';
    setGameboardMovementAgent(world, unitId, { profile: 'ground' });
    const tiles = reachableGameboardMovementTiles(world, unitId);
    expect(Array.isArray(tiles)).toBe(true);
  });

  it('throws GameboardRuntimeError when string id has no matching placement', () => {
    const plan = createGameboardBuilder({
      seed: 'reachable-missing',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    }).build();
    const world = createGameboardWorld(plan);
    expect(() => reachableGameboardMovementTiles(world, 'definitely-no-such-id')).toThrow(
      /No placement exists/
    );
  });
});
