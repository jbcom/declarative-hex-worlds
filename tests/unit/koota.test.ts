import { describe, expect, it } from 'vitest';
import { createGameboardBuilder, createMedievalHarborBoard } from '../../src/gameboard';
import { axialToWorld } from '../../src/grid';
import {
  ExtraPlacementQuery,
  HarborPlacementQuery,
  HexTileState,
  IsGameboardPlacement,
  PlacementOccupiesTile,
  PlacementOnTile,
  PlacementState,
  StackedTerrainQuery,
  canOccupyGameboardPlacement,
  clearGameboardWorld,
  createGameboardWorld,
  findPlacementEntity,
  findTileEntity,
  gameboardActions,
  inspectGameboardPlacementOccupancy,
  moveGameboardPlacement,
  readGameboardPlacementOccupancy,
  readGameboardPlacements,
  readGameboardSnapshot,
  readGameboardTiles,
  readPlacementOccupancyForTile,
  readPlacementsForTile,
  removeGameboardPlacement,
  spawnGameboardPlacement,
  spawnGameboardPlan,
  updateGameboardPlacement,
} from '../../src/koota';

describe('Koota gameboard runtime', () => {
  it('loads a plan into tile and placement traits', () => {
    const plan = createGameboardBuilder({
      seed: 'koota-load',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    })
      .addMountainStack({ at: { q: 1, r: 1 }, height: 2, variant: 'C' })
      .addHarbor({ at: { q: 2, r: 1 }, facing: 1, faction: 'yellow', kind: 'docks' })
      .build();
    const world = createGameboardWorld(plan);
    const snapshot = readGameboardSnapshot(world);

    expect(snapshot.board).toMatchObject({
      seed: 'koota-load',
      tileCount: 9,
      placementCount: plan.placements.length,
    });
    expect(snapshot.tiles).toHaveLength(9);
    expect(snapshot.placements).toHaveLength(plan.placements.length);
    expect(world.query(HarborPlacementQuery)).toHaveLength(1);
    expect(world.query(StackedTerrainQuery).length).toBeGreaterThan(0);
    expect(world.query(ExtraPlacementQuery).length).toBeGreaterThan(0);
  });

  it('maintains placement-to-tile relations for queries and React hooks', () => {
    const plan = createMedievalHarborBoard({ seed: 'relations' });
    const world = createGameboardWorld(plan);
    const tile = findTileEntity(world, { q: 4, r: 4 });
    const placements = readPlacementsForTile(world, '4,4');

    expect(tile).toBeDefined();
    expect(tile?.get(HexTileState)?.terrain).toBe('coast');
    expect(placements.some((placement) => placement.metadata.feature === 'harbor')).toBe(true);
    if (tile) {
      expect(
        world
          .query(IsGameboardPlacement, PlacementOnTile(tile))
          .some((entity) => entity.get(PlacementState)?.metadata.feature === 'harbor')
      ).toBe(true);
    }
  });

  it('maintains footprint occupancy relations separate from origin-tile relations', () => {
    const plan = createGameboardBuilder({
      seed: 'footprint-relations',
      shape: { kind: 'rectangle', width: 3, height: 2 },
    })
      .addPlacement({
        at: { q: 0, r: 0 },
        assetId: 'external_gatehouse',
        kind: 'prop',
        layer: 'feature',
        metadata: {
          layoutFootprintTiles: '0,0|1,0',
          layoutBlocksMovement: true,
          layoutOccupancyGroup: 'gatehouse:0',
        },
      })
      .build();
    const world = createGameboardWorld(plan);
    const originTile = findTileEntity(world, '0,0');
    const coveredTile = findTileEntity(world, '1,0');
    const placement = plan.placements.find(
      (candidate) => candidate.assetId === 'external_gatehouse'
    );

    expect(originTile).toBeDefined();
    expect(coveredTile).toBeDefined();
    expect(placement).toBeDefined();
    if (!originTile || !coveredTile || !placement) {
      throw new Error('Expected footprint relation fixture to load');
    }

    const entity = findPlacementEntity(world, placement.id);
    expect(entity?.has(PlacementOnTile(originTile))).toBe(true);
    expect(entity?.has(PlacementOnTile(coveredTile))).toBe(false);
    expect(entity?.has(PlacementOccupiesTile(originTile))).toBe(true);
    expect(entity?.get(PlacementOccupiesTile(coveredTile))).toMatchObject({
      originTileKey: '0,0',
      footprintIndex: 1,
      blocksMovement: true,
      occupancyGroup: 'gatehouse:0',
    });
    expect(
      world
        .query(IsGameboardPlacement, PlacementOccupiesTile(coveredTile))
        .map((candidate) => candidate.get(PlacementState)?.id)
    ).toContain(placement.id);
    expect(readPlacementsForTile(world, '1,0').map((candidate) => candidate.id)).toContain(
      placement.id
    );
    expect(readPlacementOccupancyForTile(world, '1,0')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tileKey: '1,0',
          originTileKey: '0,0',
          footprintIndex: 1,
          blocksMovement: true,
          occupancyGroup: 'gatehouse:0',
          placement: expect.objectContaining({ id: placement.id }),
        }),
      ])
    );
    expect(readGameboardPlacementOccupancy(world)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tileKey: '0,0',
          placement: expect.objectContaining({ id: placement.id }),
        }),
        expect.objectContaining({
          tileKey: '1,0',
          placement: expect.objectContaining({ id: placement.id }),
        }),
      ])
    );

    updateGameboardPlacement(world, placement.id, {
      at: '1,1',
      metadata: {
        layoutFootprintTiles: '1,1|2,1',
        layoutBlocksMovement: true,
        layoutOccupancyGroup: 'gatehouse:1',
      },
    });
    const oldCoveredPlacements = readPlacementsForTile(world, '1,0').map(
      (candidate) => candidate.id
    );
    const newCoveredPlacements = readPlacementsForTile(world, '2,1').map(
      (candidate) => candidate.id
    );

    expect(oldCoveredPlacements).not.toContain(placement.id);
    expect(newCoveredPlacements).toContain(placement.id);
    expect(readPlacementOccupancyForTile(world, '2,1')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          originTileKey: '1,1',
          footprintIndex: 1,
          occupancyGroup: 'gatehouse:1',
          placement: expect.objectContaining({ id: placement.id }),
        }),
      ])
    );
    expect(entity?.get(PlacementOccupiesTile(coveredTile))).toBeUndefined();
  });

  it('supports Koota actions for loading and clearing boards', () => {
    const initial = createGameboardBuilder({
      seed: 'initial',
      shape: { kind: 'rectangle', width: 2, height: 2 },
    }).build();
    const next = createGameboardBuilder({
      seed: 'next',
      shape: { kind: 'rectangle', width: 3, height: 2 },
    }).build();
    const world = createGameboardWorld(initial);
    const actions = gameboardActions(world);

    expect(readGameboardTiles(world)).toHaveLength(4);
    actions.loadPlan(next);
    expect(readGameboardSnapshot(world).board?.seed).toBe('next');
    expect(readGameboardTiles(world)).toHaveLength(6);

    actions.clear();
    expect(readGameboardTiles(world)).toHaveLength(0);
    expect(readGameboardPlacements(world)).toHaveLength(0);
  });

  it('can spawn into an existing world without a separate adapter state', () => {
    const world = createGameboardWorld();
    const plan = createMedievalHarborBoard({ seed: 'spawn-direct' });
    const index = spawnGameboardPlan(world, plan);

    expect(index.tiles.size).toBe(plan.tiles.length);
    expect(index.placements.size).toBe(plan.placements.length);
    expect(readGameboardSnapshot(world).board?.seed).toBe('spawn-direct');

    clearGameboardWorld(world);
    expect(readGameboardSnapshot(world).board).toBeUndefined();
  });

  it('supports runtime placement spawn, move, retag, projection, and removal', () => {
    const plan = createGameboardBuilder({
      seed: 'runtime-mutation',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    })
      .setElevation({ q: 2, r: 2 }, 1)
      .build();
    const world = createGameboardWorld(plan);
    const spawned = spawnGameboardPlacement(world, {
      at: { q: 0, r: 0 },
      assetId: 'flag_blue',
      kind: 'prop',
      positionOffset: { x: 0.2, z: -0.1 },
      metadata: {
        feature: 'spawn-marker',
        layoutPositionOffsetX: 0.2,
        layoutPositionOffsetZ: -0.1,
      },
    });
    const spawnCenter = axialToWorld({ q: 0, r: 0 }, 0);

    expect(readGameboardSnapshot(world).board?.placementCount).toBe(plan.placements.length + 1);
    expect(spawned.get(PlacementState)).toMatchObject({
      tileKey: '0,0',
      layer: 'feature',
      requiresExtra: false,
      position: { x: spawnCenter.x + 0.2, y: spawnCenter.y, z: spawnCenter.z - 0.1 },
    });
    expect(findPlacementEntity(world, spawned.get(PlacementState)?.id ?? '')).toBe(spawned);

    const moved = moveGameboardPlacement(world, spawned, '2,2', { rotationSteps: 7 });
    const movedCenter = axialToWorld({ q: 2, r: 2 }, 1);
    expect(moved.get(PlacementState)).toMatchObject({
      tileKey: '2,2',
      elevation: 1,
      rotationSteps: 1,
      position: { x: movedCenter.x + 0.2, y: movedCenter.y, z: movedCenter.z - 0.1 },
    });
    expect(
      readPlacementsForTile(world, '2,2').some(
        (placement) => placement.id === moved.get(PlacementState)?.id
      )
    ).toBe(true);

    updateGameboardPlacement(world, moved, {
      assetId: 'building_shipyard_blue',
      kind: 'structure',
      layer: 'structure',
      metadata: { feature: 'harbor', facing: 1 },
    });

    expect(world.query(HarborPlacementQuery)).toHaveLength(1);
    expect(world.query(ExtraPlacementQuery)).toHaveLength(1);
    expect(
      readGameboardPlacements(world).find(
        (placement) => placement.assetId === 'building_shipyard_blue'
      )
    ).toBeDefined();

    expect(removeGameboardPlacement(world, moved)).toBe(true);
    expect(removeGameboardPlacement(world, 'missing')).toBe(false);
    expect(readGameboardSnapshot(world).board?.placementCount).toBe(plan.placements.length);
  });

  it('preflights runtime placement occupancy before spawn or move mutations', () => {
    const plan = createGameboardBuilder({
      seed: 'runtime-occupancy-preflight',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    })
      .addPlacement({
        at: { q: 0, r: 0 },
        assetId: 'external_gatehouse',
        kind: 'prop',
        layer: 'feature',
        metadata: {
          layoutFootprintTiles: '0,0|1,0',
          layoutBlocksMovement: true,
          layoutOccupancyGroup: 'gatehouse:0',
        },
      })
      .build();
    const world = createGameboardWorld(plan);
    const gatehouse = plan.placements.find(
      (placement) => placement.assetId === 'external_gatehouse'
    );
    if (!gatehouse) {
      throw new Error('Expected gatehouse fixture placement');
    }

    const blockedUnit = inspectGameboardPlacementOccupancy(world, {
      at: '1,0',
      kind: 'unit',
    });
    expect(blockedUnit).toMatchObject({
      tileKey: '1,0',
      footprintTileKeys: ['1,0'],
      blocksMovement: true,
      canOccupy: false,
    });
    expect(blockedUnit.blockers.map((blocker) => blocker.placement.id)).toContain(gatehouse?.id);
    expect(blockedUnit.reason ?? '').toContain('Blocked by placement');

    expect(
      inspectGameboardPlacementOccupancy(world, {
        at: '1,0',
        kind: 'decoration',
      }).canOccupy
    ).toBe(true);
    expect(
      inspectGameboardPlacementOccupancy(world, {
        at: '1,0',
        kind: 'decoration',
        requireUnblocked: true,
      }).canOccupy
    ).toBe(false);

    expect(
      inspectGameboardPlacementOccupancy(world, {
        at: '0,0',
        kind: 'prop',
        metadata: {
          layoutFootprintTiles: '0,0|1,0',
          layoutBlocksMovement: true,
          layoutOccupancyGroup: 'gatehouse:0',
        },
      }).canOccupy
    ).toBe(true);
    expect(
      inspectGameboardPlacementOccupancy(world, {
        at: '1,0',
        kind: 'unit',
        ignorePlacementIds: [gatehouse.id],
      }).canOccupy
    ).toBe(true);

    const missingFootprint = inspectGameboardPlacementOccupancy(world, {
      at: '2,0',
      kind: 'structure',
      metadata: { layoutFootprintTiles: '2,0|3,0' },
    });
    expect(missingFootprint).toMatchObject({
      canOccupy: false,
      missingTileKeys: ['3,0'],
    });
    expect(canOccupyGameboardPlacement(world, { at: '2,0', kind: 'unit' })).toBe(true);

    expect(() =>
      spawnGameboardPlacement(world, {
        id: 'blocked-unit',
        at: '1,0',
        assetId: 'flag_red',
        kind: 'unit',
        occupancyGuard: true,
      })
    ).toThrow(/cannot occupy 1,0/);
    expect(findPlacementEntity(world, 'blocked-unit')).toBeUndefined();

    const ignoredUnit = spawnGameboardPlacement(world, {
      id: 'ignored-unit',
      at: '1,0',
      assetId: 'flag_red',
      kind: 'unit',
      occupancyGuard: { ignorePlacementIds: [gatehouse.id] },
    });
    expect(ignoredUnit.get(PlacementState)?.tileKey).toBe('1,0');
    expect(() =>
      moveGameboardPlacement(world, ignoredUnit, '0,0', { occupancyGuard: true })
    ).toThrow(/cannot occupy 0,0/);
    expect(ignoredUnit.get(PlacementState)?.tileKey).toBe('1,0');
    expect(
      moveGameboardPlacement(world, ignoredUnit, '2,0', { occupancyGuard: true }).get(
        PlacementState
      )
    ).toMatchObject({ tileKey: '2,0' });
  });

  it('exposes runtime placement mutation through gameboard actions', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'runtime-actions',
        shape: { kind: 'rectangle', width: 2, height: 2 },
      }).build()
    );
    const actions = gameboardActions(world);

    const entity = actions.spawnPlacement({
      at: '0,0',
      assetId: 'tree_single_A',
      kind: 'decoration',
    });
    const id = entity.get(PlacementState)?.id ?? '';

    expect(actions.canOccupyPlacement({ at: '0,0', kind: 'unit' })).toBe(true);
    actions.movePlacement(id, { q: 1, r: 1 });
    expect(findPlacementEntity(world, id)?.get(PlacementState)?.tileKey).toBe('1,1');

    actions.updatePlacement(id, { scale: 1.5, rotationSteps: -1 });
    expect(findPlacementEntity(world, id)?.get(PlacementState)).toMatchObject({
      scale: 1.5,
      rotationSteps: 5,
    });

    expect(actions.removePlacement(id)).toBe(true);
    expect(findPlacementEntity(world, id)).toBeUndefined();
  });
});
