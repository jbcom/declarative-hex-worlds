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

import type { Entity, World } from 'koota';
import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../gameboard/index';
import { GameboardState, PlacementState, createGameboardWorld, findPlacementEntity } from '../../koota/index';
import {
  IsMoving,
  MovementAgent,
  MovementPathState,
  type MovementPathStateValue,
  advanceGameboardMovement,
  reachableGameboardMovementTiles,
  requestGameboardMovement,
  resetGameboardMovementBudget,
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

    // Budget of 0 → no step affordable; allowOutOfRangePath ensures request succeeds
    setGameboardMovementAgent(world, unitId, { profile: 'ground', movementBudget: 0 });

    const req = requestGameboardMovement(world, unitId, '2,0', { allowOutOfRangePath: true });
    expect(req.state.status).toBe('ready');
    const advanced = advanceGameboardMovement(world, unitId);
    expect(advanced.state.status).toBe('out-of-range');
  });

  it('finishes stale ready paths that already consumed every path key', () => {
    const { world, unitId, unit } = movementUnitFixture('adv-stale-complete');
    setGameboardMovementAgent(world, unitId, { profile: 'ground' });
    setMovementPath(unit, {
      status: 'moving',
      nextIndex: 1,
      spentCost: 1,
      reason: 'stale',
    });
    unit.add(IsMoving);

    const advanced = advanceGameboardMovement(world, unit);
    expect(advanced.moved).toBe(false);
    expect(advanced.state).toMatchObject({ status: 'completed', reason: undefined });
    expect(unit.has(IsMoving)).toBe(false);
  });

  it('throws when a malformed path points at a sparse path slot', () => {
    const { world, unitId, unit } = movementUnitFixture('adv-sparse-path');
    const sparsePath = ['1,0'] as string[];
    sparsePath.length = 2;

    setGameboardMovementAgent(world, unitId, { profile: 'ground' });
    setMovementPath(unit, {
      pathKeys: sparsePath,
      nextIndex: 1,
    });

    expect(() => advanceGameboardMovement(world, unit)).toThrow(/Movement path index 1 out of range/);
  });

  it('marks a manually stale path blocked when a new blocker occupies the next tile', () => {
    const { world, unitId, unit } = movementUnitFixture('adv-blocked', { blocker: true });
    setGameboardMovementAgent(world, unitId, { profile: 'ground' });
    setMovementPath(unit);
    unit.add(IsMoving);

    const advanced = advanceGameboardMovement(world, unit);
    expect(advanced.moved).toBe(false);
    expect(advanced.state).toMatchObject({
      status: 'blocked',
      reason: 'Movement path is blocked at 1,0',
    });
    expect(unit.has(IsMoving)).toBe(false);
  });

  it('falls back to the ground profile when advancing a placement without an agent trait', () => {
    const { world, unit } = movementUnitFixture('adv-agent-fallback');
    addMovementPath(unit);

    const advanced = advanceGameboardMovement(world, unit);
    expect(advanced.moved).toBe(true);
    expect(advanced.profile.id).toBe('ground');
    expect(advanced.state.status).toBe('completed');
    expect(unit.get(MovementAgent)?.remainingMovement).toBe(5);
  });

  it('returns the idle fallback when an entity has no path trait', () => {
    const { world, unit } = movementUnitFixture('adv-no-path-state');

    const advanced = advanceGameboardMovement(world, unit);

    expect(advanced.moved).toBe(false);
    expect(advanced.state).toMatchObject({ status: 'idle', pathKeys: [] });
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

  it('uses default movement budget when a placement has no movement agent', () => {
    const { world, unitId } = movementUnitFixture('reachable-budget-fallback');

    expect(reachableGameboardMovementTiles(world, unitId).map((entry) => entry.tile.key)).toContain('1,0');
  });

  it('throws when movement navigation projects a world without board state', () => {
    const { world, unitId } = movementUnitFixture('reachable-missing-board');
    world.remove(GameboardState);

    expect(() => reachableGameboardMovementTiles(world, unitId)).toThrow(/World does not contain GameboardState/);
  });
});

describe('movement state guard coverage (PRD E0a)', () => {
  it('throws when advancing a ready path on an entity missing PlacementState', () => {
    const { world, unitId, unit } = movementUnitFixture('movement-missing-placement-ready');
    setGameboardMovementAgent(world, unitId, { profile: 'ground' });
    setMovementPath(unit);
    unit.remove(PlacementState);

    expect(() => advanceGameboardMovement(world, unit)).toThrow(/missing PlacementState/);
  });

  it('throws when snapshotting a non-ready path on an entity missing PlacementState', () => {
    const { world, unitId, unit } = movementUnitFixture('movement-missing-placement-idle');
    setGameboardMovementAgent(world, unitId, { profile: 'ground' });
    setMovementPath(unit, {
      status: 'completed',
      destinationKey: '0,0',
      pathKeys: [],
      cost: 0,
    });
    unit.remove(PlacementState);

    expect(() => advanceGameboardMovement(world, unit)).toThrow(/missing PlacementState/);
  });

  it('resets a placement without an agent using the profile budget fallback', () => {
    const { world, unitId } = movementUnitFixture('movement-reset-agent-fallback');
    const [unit] = resetGameboardMovementBudget(world, unitId);

    expect(unit?.get(MovementAgent)).toMatchObject({
      profileId: 'ground',
      movementBudget: 6,
      remainingMovement: 6,
    });
  });
});

interface MovementUnitFixture {
  world: World;
  unitId: string;
  unit: Entity;
}

function movementUnitFixture(
  seed: string,
  options: { blocker?: boolean; width?: number } = {}
): MovementUnitFixture {
  let builder = createGameboardBuilder({
    seed,
    shape: { kind: 'rectangle', width: options.width ?? 2, height: 1 },
  }).addPlacement({ at: { q: 0, r: 0 }, assetId: 'unit_blue_full', kind: 'unit', layer: 'unit' });
  if (options.blocker) {
    builder = builder.addPlacement({
      at: { q: 1, r: 0 },
      assetId: 'building_castle_blue',
      kind: 'structure',
      layer: 'structure',
    });
  }
  const plan = builder.build();
  const world = createGameboardWorld(plan);
  const unitId = plan.placements.find((p) => p.assetId === 'unit_blue_full')?.id ?? '';
  const unit = findPlacementEntity(world, unitId);
  if (!unit) {
    throw new Error('Expected test unit entity');
  }
  return { world, unitId, unit };
}

function movementPath(overrides: Partial<MovementPathStateValue> = {}): MovementPathStateValue {
  return {
    status: 'ready',
    destinationKey: '1,0',
    pathKeys: ['1,0'],
    nextIndex: 0,
    cost: 1,
    spentCost: 0,
    visited: 2,
    reason: undefined,
    ...overrides,
  };
}

function setMovementPath(unit: Entity, overrides: Partial<MovementPathStateValue> = {}): void {
  unit.set(MovementPathState, movementPath(overrides));
}

function addMovementPath(unit: Entity, overrides: Partial<MovementPathStateValue> = {}): void {
  unit.add(MovementPathState(movementPath(overrides)));
}
