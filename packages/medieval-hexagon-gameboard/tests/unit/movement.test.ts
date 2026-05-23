import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../src/gameboard';
import { PlacementState, createGameboardWorld, findPlacementEntity } from '../../src/koota';
import {
  IsMoving,
  MovementAgent,
  MovementPathState,
  createGameboardMovementNavigation,
  gameboardMovementActions,
  reachableGameboardMovementTiles,
  requestGameboardMovement,
  resetGameboardMovementBudget,
  runGameboardMovementSystem,
  setGameboardMovementAgent,
} from '../../src/movement';

describe('Koota movement profiles and systems', () => {
  it('plans and steps a unit around blockers while spending movement budget', () => {
    const plan = createGameboardBuilder({
      seed: 'movement-step',
      shape: { kind: 'rectangle', width: 4, height: 2 },
    })
      .addPlacement({
        at: { q: 0, r: 0 },
        assetId: 'unit_blue_full',
        kind: 'unit',
        layer: 'unit',
      })
      .addPlacement({
        at: { q: 1, r: 0 },
        assetId: 'building_castle_blue',
        kind: 'structure',
        layer: 'structure',
      })
      .build();
    const world = createGameboardWorld(plan);
    const unitId = plan.placements.find((placement) => placement.assetId === 'unit_blue_full')?.id ?? '';
    const unit = findPlacementEntity(world, unitId);

    expect(unit).toBeDefined();
    const request = requestGameboardMovement(world, unitId, '3,0', { profile: 'ground' });

    expect(request.state.status).toBe('ready');
    expect(request.state.pathKeys).not.toContain('1,0');
    expect(unit?.has(IsMoving)).toBe(true);

    const results = runGameboardMovementSystem(world, { steps: 10 });
    const moved = findPlacementEntity(world, unitId)?.get(PlacementState);
    const agent = findPlacementEntity(world, unitId)?.get(MovementAgent);
    const pathState = findPlacementEntity(world, unitId)?.get(MovementPathState);

    expect(results.some((result) => result.moved)).toBe(true);
    expect(moved?.tileKey).toBe('3,0');
    expect(pathState).toMatchObject({ status: 'completed', destinationKey: '3,0' });
    expect(agent?.remainingMovement).toBeLessThan(agent?.movementBudget ?? 0);
  });

  it('reports out-of-range paths without moving the placement', () => {
    const plan = createGameboardBuilder({
      seed: 'movement-range',
      shape: { kind: 'rectangle', width: 4, height: 1 },
    })
      .addPlacement({
        at: { q: 0, r: 0 },
        assetId: 'unit_green_full',
        kind: 'unit',
        layer: 'unit',
      })
      .build();
    const world = createGameboardWorld(plan);
    const unitId = plan.placements.find((placement) => placement.assetId === 'unit_green_full')?.id ?? '';

    setGameboardMovementAgent(world, unitId, { profile: 'worker', movementBudget: 2 });
    const request = requestGameboardMovement(world, unitId, '3,0');

    expect(request.state).toMatchObject({
      status: 'out-of-range',
      destinationKey: '3,0',
    });
    expect(findPlacementEntity(world, unitId)?.has(IsMoving)).toBe(false);
    expect(findPlacementEntity(world, unitId)?.get(PlacementState)?.tileKey).toBe('0,0');
  });

  it('uses alternate profiles for water movement and reachable ranges', () => {
    const plan = createGameboardBuilder({
      seed: 'ship-movement',
      shape: { kind: 'rectangle', width: 4, height: 1 },
      defaultTerrain: 'water',
    })
      .addPlacement({
        at: { q: 0, r: 0 },
        assetId: 'ship',
        kind: 'unit',
        layer: 'unit',
      })
      .build();
    const world = createGameboardWorld(plan);
    const shipId = plan.placements.find((placement) => placement.assetId === 'ship')?.id ?? '';

    setGameboardMovementAgent(world, shipId, { profile: 'ship' });

    expect(createGameboardMovementNavigation(world, shipId).findPath('0,0', '3,0').found).toBe(true);
    expect(requestGameboardMovement(world, shipId, '3,0').state.status).toBe('ready');
    expect(reachableGameboardMovementTiles(world, shipId).map((entry) => entry.tile.key)).toEqual([
      '0,0',
      '1,0',
      '2,0',
      '3,0',
    ]);
  });

  it('exposes movement through a Koota action bundle', () => {
    const plan = createGameboardBuilder({
      seed: 'movement-actions',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    })
      .addPlacement({
        at: { q: 0, r: 0 },
        assetId: 'unit_red_full',
        kind: 'unit',
        layer: 'unit',
      })
      .build();
    const world = createGameboardWorld(plan);
    const unitId = plan.placements.find((placement) => placement.assetId === 'unit_red_full')?.id ?? '';
    const actions = gameboardMovementActions(world);

    actions.setAgent(unitId, { profile: 'cavalry' });
    actions.requestMove(unitId, { q: 1, r: 0 });
    expect(actions.advance(unitId).state.status).toBe('completed');
    expect(findPlacementEntity(world, unitId)?.get(PlacementState)?.tileKey).toBe('1,0');

    actions.resetBudget(unitId);
    expect(findPlacementEntity(world, unitId)?.get(MovementAgent)?.remainingMovement).toBe(8);

    actions.clear(unitId);
    expect(findPlacementEntity(world, unitId)?.get(MovementPathState)?.status).toBe('idle');
  });

  it('can reset every registered movement agent at turn boundaries', () => {
    const plan = createGameboardBuilder({
      seed: 'movement-turn',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    })
      .addPlacement({
        at: { q: 0, r: 0 },
        assetId: 'unit_blue_full',
        kind: 'unit',
        layer: 'unit',
      })
      .addPlacement({
        at: { q: 1, r: 0 },
        assetId: 'unit_green_full',
        kind: 'unit',
        layer: 'unit',
      })
      .build();
    const world = createGameboardWorld(plan);

    for (const placement of plan.placements.filter((candidate) => candidate.kind === 'unit')) {
      setGameboardMovementAgent(world, placement.id, { profile: 'ground', remainingMovement: 0 });
    }

    expect(resetGameboardMovementBudget(world)).toHaveLength(2);
    expect(
      plan.placements
        .filter((candidate) => candidate.kind === 'unit')
        .map((placement) => findPlacementEntity(world, placement.id)?.get(MovementAgent)?.remainingMovement)
    ).toEqual([6, 6]);
  });
});
