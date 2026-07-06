import { describe, expect, it } from 'vitest';
import { createGameboardBuilder, createHarborBoard } from '../../gameboard/index';
import { axialToWorld } from '../../coordinates/grid';
import {
  ExtraPlacementQuery,
  GameboardState,
  HarborPlacementQuery,
  HexTileState,
  IsGameboardPlacement,
  PlacementOccupiesTile,
  PlacementOnTile,
  PlacementState,
  RequiresExtraAsset,
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
} from '../../koota/index';

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
    const plan = createHarborBoard({ seed: 'relations' });
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
    const plan = createHarborBoard({ seed: 'spawn-direct' });
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
      requiresExtra: true,
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

  it('requires runtime placement callers to set requiresExtra explicitly', () => {
    const plan = createGameboardBuilder({
      seed: 'runtime-extra-explicit',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    }).build();
    const world = createGameboardWorld(plan);
    const inferredExtra = spawnGameboardPlacement(world, {
      id: 'runtime-extra-default',
      at: '0,0',
      assetId: 'building_shipyard_blue',
      kind: 'structure',
    });

    expect(inferredExtra.get(PlacementState)).toMatchObject({
      assetId: 'building_shipyard_blue',
      requiresExtra: false,
    });
    expect(inferredExtra.has(RequiresExtraAsset)).toBe(false);

    const explicitExtra = updateGameboardPlacement(world, inferredExtra, {
      requiresExtra: true,
    });
    expect(explicitExtra.get(PlacementState)?.requiresExtra).toBe(true);
    expect(explicitExtra.has(RequiresExtraAsset)).toBe(true);

    updateGameboardPlacement(world, explicitExtra, {
      assetId: 'flag_blue',
    });
    expect(explicitExtra.get(PlacementState)?.requiresExtra).toBe(true);

    updateGameboardPlacement(world, explicitExtra, {
      requiresExtra: false,
    });
    expect(explicitExtra.get(PlacementState)?.requiresExtra).toBe(false);
    expect(explicitExtra.has(RequiresExtraAsset)).toBe(false);
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
    // Inspect occupancy via gameboardActions wrapper (line 352-353).
    const inspection = actions.inspectPlacementOccupancy({ at: '0,0', kind: 'unit' });
    expect(inspection).toBeDefined();
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

  it('defaultLayerForPlacementKind covers terrain + surface + structure kinds (E0b)', () => {
    const plan = createGameboardBuilder({
      seed: 'kind-layer-defaults',
      shape: { kind: 'rectangle', width: 7, height: 1 },
    }).build();
    const world = createGameboardWorld(plan);
    const cases = [
      ['terrain', 'terrain'],
      ['road', 'surface'],
      ['river', 'surface'],
      ['coast', 'surface'],
      ['transition', 'surface'],
      ['structure', 'structure'],
      ['unit', 'unit'],
      ['decoration', 'feature'],
      ['prop', 'feature'],
    ] as const;

    for (const [index, [kind, layer]] of cases.entries()) {
      const placement = spawnGameboardPlacement(world, {
        at: { q: index % 7, r: 0 },
        assetId: `${kind}-asset`,
        kind,
      });
      expect(placement.get(PlacementState)?.layer).toBe(layer);
    }
  });

  it('rejects broken plans and missing tile or placement traits', () => {
    const plan = createGameboardBuilder({
      seed: 'koota-defensive-branches',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    })
      .addPlacement({ at: { q: 0, r: 0 }, assetId: 'flag_blue', kind: 'prop', layer: 'feature' })
      .build();
    const originalPlacement = plan.placements[0];
    if (!originalPlacement) {
      throw new Error('Expected defensive fixture placement');
    }
    const brokenPlan = {
      ...plan,
      placements: [{ ...originalPlacement, tileKey: '9,9' }],
    };

    expect(() => spawnGameboardPlan(createGameboardWorld(), brokenPlan)).toThrow(
      /references missing tile 9,9/
    );

    const world = createGameboardWorld(plan);
    const tile = findTileEntity(world, '0,0');
    tile?.remove(HexTileState);
    expect(() =>
      spawnGameboardPlacement(world, { at: '0,0', assetId: 'flag_red', kind: 'prop' })
    ).toThrow(/missing HexTileState/);

    const placement = findPlacementEntity(world, originalPlacement.id);
    placement?.remove(PlacementState);
    expect(() => updateGameboardPlacement(world, placement ?? 'missing', {})).toThrow(
      /missing PlacementState/
    );

    const updateWorld = createGameboardWorld(plan);
    findTileEntity(updateWorld, '0,0')?.remove(HexTileState);
    expect(() => updateGameboardPlacement(updateWorld, originalPlacement.id, {})).toThrow(
      /missing HexTileState/
    );
  });

  it('covers placement lookup, id collision, and unloaded-board mutation guards', () => {
    const plan = createGameboardBuilder({
      seed: 'koota-index-guards',
      shape: { kind: 'rectangle', width: 1, height: 1 },
    }).build();
    const world = createGameboardWorld(plan);

    expect(() =>
      spawnGameboardPlacement(world, { at: { q: 9, r: 9 }, assetId: 'flag_blue', kind: 'prop' })
    ).toThrow(/No tile exists at 9,9/);
    expect(() => updateGameboardPlacement(world, 'missing-placement', {})).toThrow(
      /No placement exists with id missing-placement/
    );

    const first = spawnGameboardPlacement(world, {
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'prop',
    });
    first.remove(PlacementState);
    const second = spawnGameboardPlacement(world, {
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'prop',
    });
    expect(second.get(PlacementState)?.id).toBe('runtime:prop:0,0:flag_blue:1');

    world.remove(GameboardState);
    expect(removeGameboardPlacement(world, second)).toBe(true);
    expect(readGameboardSnapshot(world).board).toBeUndefined();
  });

  it('sorts equal-order placement and occupancy fallback keys', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'koota-sort-fallbacks',
        shape: { kind: 'rectangle', width: 1, height: 1 },
      }).build()
    );
    const sortB = spawnGameboardPlacement(world, {
      id: 'sort-b',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'prop',
      order: 10,
    });
    spawnGameboardPlacement(world, {
      id: 'sort-a',
      at: { q: 0, r: 0 },
      assetId: 'flag_red',
      kind: 'prop',
      order: 10,
    });

    expect(
      readGameboardPlacements(world)
        .filter((placement) => placement.id.startsWith('sort-'))
        .map((placement) => placement.id)
    ).toEqual(['sort-a', 'sort-b']);
    expect(
      readPlacementsForTile(world, { q: 0, r: 0 })
        .filter((placement) => placement.id.startsWith('sort-'))
        .map((placement) => placement.id)
    ).toEqual(['sort-a', 'sort-b']);
    expect(
      readPlacementOccupancyForTile(world, '0,0')
        .filter((record) => record.placement.id.startsWith('sort-'))
        .map((record) => record.placement.id)
    ).toEqual(['sort-a', 'sort-b']);

    const tile = findTileEntity(world, '0,0');
    if (!tile) {
      throw new Error('Expected sort fallback tile');
    }
    sortB.remove(PlacementOccupiesTile(tile));
    sortB.add(
      PlacementOccupiesTile(tile, {
        originTileKey: '0,0',
        footprintIndex: 1,
        blocksMovement: false,
        occupancyGroup: 'sort-b',
      })
    );
    expect(
      readPlacementOccupancyForTile(world, '0,0')
        .filter((record) => record.placement.id.startsWith('sort-'))
        .map((record) => `${record.placement.id}:${record.footprintIndex}`)
    ).toEqual(['sort-a:0', 'sort-b:1']);
    const offset = spawnGameboardPlacement(world, {
      id: 'offset-marker',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'prop',
      positionOffset: { x: 0.25, y: 0.5, z: -0.25 },
    });
    const before = offset.get(PlacementState)?.position;
    const updated = updateGameboardPlacement(world, offset, { assetId: 'flag_red' });

    expect(updated.get(PlacementState)?.position).toEqual(before);
  });

  it('handles sparse occupancy relations and invalid inspection tile keys', () => {
    const plan = createGameboardBuilder({
      seed: 'koota-occupancy-fallbacks',
      shape: { kind: 'rectangle', width: 1, height: 1 },
    }).build();
    const world = createGameboardWorld(plan);

    const sparse = spawnGameboardPlacement(world, {
      id: 'sparse-footprint',
      at: '0,0',
      assetId: 'external_gatehouse',
      kind: 'prop',
      metadata: { layoutFootprintTiles: '0,0|1,0', layoutBlocksMovement: true },
    });
    expect(new Set(readGameboardPlacementOccupancy(world).map((record) => record.tileKey))).toEqual(
      new Set(['0,0'])
    );
    expect(readPlacementsForTile(world, '1,0').map((placement) => placement.id)).toEqual([
      'sparse-footprint',
    ]);

    findTileEntity(world, '0,0')?.remove(HexTileState);
    expect(readGameboardPlacementOccupancy(world)).toEqual([]);
    sparse.remove(PlacementState);
    expect(readGameboardPlacementOccupancy(world)).toEqual([]);

    expect(inspectGameboardPlacementOccupancy(world, { at: '0,0' }).canOccupy).toBe(true);
    expect(
      inspectGameboardPlacementOccupancy(world, { at: { q: 4, r: 4 }, kind: 'unit' })
    ).toMatchObject({
      tileKey: '4,4',
      coordinates: { q: 4, r: 4 },
      missingTileKeys: ['4,4'],
    });
    expect(() => inspectGameboardPlacementOccupancy(world, { at: 'not-a-tile' })).toThrow(
      /Invalid tile key/
    );
  });
});
