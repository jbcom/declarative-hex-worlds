import { describe, expect, it } from 'vitest';
import {
  coordinatesForShape,
  createGameboardBuilder,
  createGameboardPlan,
  createGameboardPlanFromTiles,
  createHarborBoard,
  edgeBetween,
  gameboardPlanIndex,
  getPlacementAsset,
  hexKey,
  listPropClusterAssets,
  loadPlacementAsset,
  neighbor,
  oppositeEdge,
  requiresExtraAsset,
  summarizeGameboardPlan,
  type GameboardPlacementSpec,
  type GameboardTileSpec,
} from '../../gameboard/index';
import { freeManifest } from '../../manifest/free';

describe('gameboardPlanIndex memoization (PRD B4)', () => {
  it('returns the same index reference for the same plan instance', () => {
    const plan = createGameboardBuilder({
      seed: 'index-test',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    }).build();
    const first = gameboardPlanIndex(plan);
    const second = gameboardPlanIndex(plan);
    expect(second).toBe(first);
    expect(second.tilesByKey).toBe(first.tilesByKey);
    expect(second.placementsByTile).toBe(first.placementsByTile);
  });

  it('builds correctly: tilesByKey covers every tile, placementsByTile groups by tile', () => {
    const plan = createGameboardBuilder({
      seed: 'index-test-2',
      shape: { kind: 'rectangle', width: 2, height: 2 },
    }).build();
    const { tilesByKey, placementsByTile } = gameboardPlanIndex(plan);
    expect(tilesByKey.size).toBe(plan.tiles.length);
    for (const tile of plan.tiles) {
      expect(tilesByKey.get(tile.key)).toBe(tile);
    }
    for (const placement of plan.placements) {
      expect(placementsByTile.get(placement.tileKey)).toContain(placement);
    }
  });
});

describe('gameboard plan builder', () => {
  it('creates elevated mountain stacks as terrain supports plus a top feature', () => {
    const plan = createGameboardBuilder({
      seed: 'mountain-stack',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    })
      .addMountainStack({ at: { q: 1, r: 1 }, height: 3, variant: 'B', withTrees: true })
      .build();

    const tile = plan.tiles.find((candidate) => candidate.key === '1,1');
    const stack = plan.placements.filter((placement) => placement.tileKey === '1,1');

    expect(tile).toMatchObject({ terrain: 'mountain', elevation: 3 });
    expect(stack.map((placement) => placement.assetId)).toEqual([
      'hex_grass_bottom',
      'hex_grass_bottom',
      'hex_grass_bottom',
      'hex_grass',
      'mountain_B_grass_trees',
    ]);
    expect(stack.at(-1)?.position.y).toBe(3);
  });

  it('turns paths and coasts into concrete guide assets with rotations', () => {
    const plan = createGameboardBuilder({
      seed: 'connectivity',
      shape: { kind: 'rectangle', width: 4, height: 4 },
    })
      .addRoadPath([
        { q: 1, r: 1 },
        { q: 0, r: 1 },
        { q: 0, r: 2 },
      ])
      .addRiverPath(
        [
          { q: 3, r: 1 },
          { q: 2, r: 1 },
          { q: 2, r: 2 },
        ],
        { waterless: true }
      )
      .setCoastEdges({ q: 0, r: 3 }, [0, 1])
      .build();

    expect(plan.placements.some((placement) => placement.assetId === 'hex_road_B')).toBe(true);
    expect(plan.placements.some((placement) => placement.assetId === 'hex_river_B_waterless')).toBe(true);
    expect(plan.placements.some((placement) => placement.assetId === 'hex_coast_B')).toBe(true);
  });

  it('sorts same-order custom placements while applying plan defaults', () => {
    const plan = createGameboardPlanFromTiles({
      seed: 'terrain-plan-defaults',
      shape: { kind: 'rectangle', width: 1, height: 1 },
      tiles: [],
      placements: [placementFixture('custom:b', 7), placementFixture('custom:a', 7)],
    });

    expect(plan.textureSet).toBe('default');
    expect(plan.warnings).toEqual([]);
    expect(plan.placements.map((placement) => placement.id)).toEqual(['custom:a', 'custom:b']);
  });

  it('preserves authored tile tags when overriding tile assets', () => {
    const plan = createGameboardBuilder({
      seed: 'terrain-extra-tags',
      shape: { kind: 'rectangle', width: 1, height: 1 },
    })
      .setTileAsset({ at: { q: 0, r: 0 }, assetId: 'hex_grass', tags: ['custom-tag'] })
      .build();

    expect(plan.tiles[0]?.tags).toContain('custom-tag');
  });

  it('creates river crossing, single-edge river, and sloped road overlays from authored tiles', () => {
    const plan = createGameboardPlanFromTiles({
      seed: 'terrain-river-crossings',
      shape: { kind: 'rectangle', width: 3, height: 1 },
      textureSet: 'default',
      tiles: [
        tileFixture({ key: '0,0', riverCrossing: 'A', riverWaterless: true }),
        tileFixture({ key: '1,0', coordinates: { q: 1, r: 0 }, riverEdges: 1 }),
        tileFixture({
          key: '2,0',
          coordinates: { q: 2, r: 0 },
          roadEdges: 0b001001,
          roadSlope: 'high',
        }),
      ],
    });

    expect(plan.placements.find((placement) => placement.id === 'river:0,0')).toMatchObject({
      assetId: 'hex_river_crossing_A_waterless',
      kind: 'river',
      elevationOffset: 0.02,
      metadata: { edgeMask: 0 },
    });
    expect(plan.placements.find((placement) => placement.id === 'river:1,0')).toMatchObject({
      kind: 'river',
      metadata: { edgeMask: 1 },
    });
    expect(plan.placements.find((placement) => placement.id === 'road:2,0')).toMatchObject({
      assetId: 'hex_road_A_sloped_high',
      kind: 'road',
      metadata: { edgeMask: 0b001001, slope: 'high' },
    });
  });

  it('models harbors as coast, structure, water, and local EXTRA props', () => {
    const plan = createGameboardBuilder({
      seed: 'harbor',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    })
      .addHarbor({ at: { q: 1, r: 1 }, facing: 1, faction: 'red', kind: 'shipyard' })
      .build();

    const land = plan.tiles.find((tile) => tile.key === '1,1');
    const water = plan.tiles.find((tile) => tile.key === '1,2');
    const shipyard = plan.placements.find((placement) => placement.assetId === 'building_shipyard_red');

    expect(land?.terrain).toBe('coast');
    expect(water?.terrain).toBe('water');
    expect(shipyard).toMatchObject({
      kind: 'structure',
      requiresExtra: true,
      metadata: { feature: 'harbor', harborKind: 'shipyard', faction: 'red' },
    });
    expect(plan.placements.some((placement) => placement.assetId === 'boat')).toBe(true);
  });

  it('models bridges as named FREE structures for road and river crossings', () => {
    const plan = createGameboardBuilder({
      seed: 'bridge',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    })
      .addRiverPath([
        { q: 0, r: 1 },
        { q: 1, r: 1 },
        { q: 2, r: 1 },
      ])
      .addRoadPath([
        { q: 1, r: 0 },
        { q: 1, r: 1 },
        { q: 1, r: 2 },
      ])
      .addBridge({ at: { q: 1, r: 1 }, variant: 'B', facing: 1 })
      .build();

    const bridge = plan.placements.find((placement) => placement.assetId === 'building_bridge_B');

    expect(bridge).toMatchObject({
      kind: 'structure',
      requiresExtra: false,
      rotationSteps: 1,
      metadata: { feature: 'bridge', bridgeVariant: 'B', facing: 1 },
    });
  });

  it('models elevation ramps as named FREE transition structures', () => {
    const plan = createGameboardBuilder({
      seed: 'elevation-ramp',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    })
      .setElevation({ q: 1, r: 1 }, 1)
      .addElevationRamp({ at: { q: 1, r: 1 }, direction: 'up', facing: 0, textureSet: 'winter' })
      .build();

    const ramp = plan.placements.find((placement) => placement.assetId === 'hex_grass_sloped_high');

    expect(ramp).toMatchObject({
      kind: 'transition',
      layer: 'surface',
      textureSet: 'winter',
      requiresExtra: false,
      rotationSteps: 0,
      elevation: 1,
      elevationOffset: 0.035,
      metadata: {
        feature: 'elevation-ramp',
        direction: 'up',
        facing: 0,
        fromElevation: 1,
        toElevation: 2,
        textureSet: 'winter',
      },
    });
  });

  it('addFortification covers all wall corner + gate segment variants (E0b)', () => {
    const plan = createGameboardBuilder({
      seed: 'wall-segments',
      shape: { kind: 'rectangle', width: 6, height: 2 },
    })
      .addFortification({ at: { q: 0, r: 0 }, material: 'wall', segment: 'straight' })
      .addFortification({ at: { q: 1, r: 0 }, material: 'wall', segment: 'straight-gate' })
      .addFortification({ at: { q: 2, r: 0 }, material: 'wall', segment: 'corner-A-gate' })
      .addFortification({ at: { q: 3, r: 0 }, material: 'wall', segment: 'corner-A-outside' })
      .addFortification({ at: { q: 4, r: 0 }, material: 'wall', segment: 'corner-B-inside' })
      .addFortification({ at: { q: 5, r: 0 }, material: 'wall', segment: 'corner-B-outside' })
      .addFortification({ at: { q: 0, r: 1 }, material: 'wall', segment: 'gate' })
      .build();
    const assetIds = plan.placements.map((p) => p.assetId);
    expect(assetIds).toContain('wall_straight');
    expect(assetIds).toContain('wall_straight_gate');
    expect(assetIds).toContain('wall_corner_A_gate');
    expect(assetIds).toContain('wall_corner_A_outside');
    expect(assetIds).toContain('wall_corner_B_inside');
    expect(assetIds).toContain('wall_corner_B_outside');
    // Both `straight-gate` and `gate` map to wall_straight_gate (lines 2151 + 2163).
    expect(assetIds.filter((id) => id === 'wall_straight_gate').length).toBeGreaterThanOrEqual(2);
  });

  it('models fortifications, construction sites, and siege projectiles as named neutral structures', () => {
    const plan = createGameboardBuilder({
      seed: 'neutral-semantics',
      shape: { kind: 'rectangle', width: 4, height: 3 },
    })
      .addFortification({
        at: { q: 0, r: 0 },
        material: 'stone-fence',
        segment: 'gate',
        facing: 2,
        enclosureId: 'stable-yard',
      })
      .addFortification({
        at: { q: 1, r: 0 },
        material: 'wall',
        segment: 'corner-A-inside',
        rotationSteps: 3,
      })
      .addConstructionSite({ at: { q: 2, r: 0 }, kind: 'stage-B', constructionId: 'market-upgrade' })
      .addSiegeProjectile({ at: { q: 3, r: 0 }, facing: 4, sourceId: 'tower-cannon' })
      .build();

    expect(plan.placements.find((placement) => placement.assetId === 'fence_stone_straight_gate')).toMatchObject({
      kind: 'structure',
      requiresExtra: false,
      rotationSteps: 2,
      metadata: {
        feature: 'fortification',
        material: 'stone-fence',
        segment: 'gate',
        facing: 2,
        enclosureId: 'stable-yard',
      },
    });
    expect(plan.placements.find((placement) => placement.assetId === 'wall_corner_A_inside')).toMatchObject({
      metadata: { feature: 'fortification', material: 'wall', segment: 'corner-A-inside' },
      rotationSteps: 3,
    });
    expect(plan.placements.find((placement) => placement.assetId === 'building_stage_B')).toMatchObject({
      metadata: { feature: 'construction-site', constructionKind: 'stage-B', constructionId: 'market-upgrade' },
    });
    expect(plan.placements.find((placement) => placement.assetId === 'projectile_catapult')).toMatchObject({
      metadata: { feature: 'siege-projectile', projectileKind: 'catapult', facing: 4, sourceId: 'tower-cannon' },
    });
  });

  it('models prop clusters as semantic single-tile and spread dressing', () => {
    const freeTrainingAssets = listPropClusterAssets('training-yard');
    const extraTrainingAssets = listPropClusterAssets('training-yard', { includeExtra: true });
    const plan = createGameboardBuilder({
      seed: 'prop-clusters',
      shape: { kind: 'rectangle', width: 4, height: 4 },
    })
      .addPropCluster({
        at: { q: 1, r: 1 },
        kind: 'training-yard',
        includeExtra: true,
        density: 1,
        facing: 1,
        clusterId: 'yard-01',
      })
      .addPropCluster({
        at: { q: 2, r: 2 },
        kind: 'camp',
        placement: 'single',
        density: 0.5,
        rotationSteps: 3,
      })
      .build();

    expect(freeTrainingAssets).toEqual(['target', 'weaponrack', 'bucket_arrows']);
    expect(extraTrainingAssets).toEqual([
      'target',
      'weaponrack',
      'bucket_arrows',
      'icon_combat',
      'icon_range',
      'cannonball_pallet',
    ]);
    expect(plan.placements.filter((placement) => placement.metadata.clusterId === 'yard-01')).toHaveLength(6);
    expect(plan.placements.find((placement) => placement.assetId === 'cannonball_pallet')).toMatchObject({
      kind: 'prop',
      requiresExtra: true,
      metadata: {
        feature: 'prop-cluster',
        propClusterKind: 'training-yard',
        clusterId: 'yard-01',
        includeExtra: true,
        density: 1,
      },
    });
    expect(plan.placements.filter((placement) => placement.metadata.propClusterKind === 'camp')).toHaveLength(3);
    expect(
      new Set(
        plan.placements
          .filter((placement) => placement.metadata.propClusterKind === 'camp')
          .map((placement) => placement.tileKey)
      )
    ).toEqual(new Set(['2,2']));
  });

  it('uses seedrandom for deterministic scatter and recipes', () => {
    const build = (seed: string) =>
      createGameboardBuilder({ seed, shape: { kind: 'rectangle', width: 5, height: 4 } })
        .scatterDecorations({
          count: 5,
          assets: ['tree_single_A', 'tree_single_B', 'rock_single_A'],
        })
        .build()
        .placements.filter((placement) => placement.metadata.feature === 'scatter')
        .map((placement) => `${placement.tileKey}:${placement.assetId}:${placement.rotationSteps}`);

    expect(build('same-seed')).toEqual(build('same-seed'));
    expect(build('same-seed')).not.toEqual(build('different-seed'));
  });

  it('ships a useful harbor-town board recipe instead of only an asset catalog', () => {
    const plan = createHarborBoard({ seed: 'recipe', faction: 'green' });
    const ids = new Set(plan.placements.map((placement) => placement.assetId));

    expect(plan.tiles).toHaveLength(48);
    expect(ids.has('building_shipyard_green')).toBe(true);
    expect(ids.has('building_townhall_green')).toBe(true);
    expect(ids.has('mountain_A_grass_trees')).toBe(true);
    expect(plan.placements.some((placement) => placement.metadata.feature === 'prop-cluster')).toBe(true);
    expect(plan.placements.some((placement) => placement.kind === 'road')).toBe(true);
    expect(plan.placements.some((placement) => placement.kind === 'river')).toBe(true);
  });

  it('summarizes terrain, placement features, and local-only asset usage for consumers', () => {
    const plan = createHarborBoard({ seed: 'summary', faction: 'green' });
    const summary = summarizeGameboardPlan(plan, { topAssetLimit: 100 });
    const shipyard = summary.topAssets.find((asset) => asset.assetId === 'building_shipyard_green');

    expect(summary).toMatchObject({
      schemaVersion: '1.0.0',
      seed: 'summary',
      tileCount: plan.tiles.length,
      placementCount: plan.placements.length,
      warningCount: plan.warnings.length,
    });
    expect(summary.tileTerrainCounts.water).toBeGreaterThan(0);
    expect(summary.tileTerrainCounts.coast).toBeGreaterThan(0);
    expect(summary.tileTagCounts.road).toBeGreaterThan(0);
    expect(summary.tileElevationCounts['2']).toBeGreaterThan(0);
    expect(summary.placementKindCounts.structure).toBeGreaterThan(0);
    expect(summary.placementLayerCounts.surface).toBeGreaterThan(0);
    expect(summary.placementFeatureCounts.harbor).toBe(1);
    expect(summary.placementFeatureCounts['mountain-stack']).toBe(2);
    expect(summary.requiresExtraPlacementCount).toBeGreaterThan(0);
    expect(summary.assetCounts.building_shipyard_green).toBe(1);
    expect(summary.extraAssetIds).toContain('building_shipyard_green');
    expect(shipyard).toEqual({
      assetId: 'building_shipyard_green',
      count: 1,
      requiresExtra: true,
      kinds: ['structure'],
      layers: ['structure'],
      features: ['harbor'],
    });
    expect(summarizeGameboardPlan(plan, { topAssetLimit: 0 }).topAssets).toEqual([]);
  });

  it('ships the harbor-town board recipe on hexagon shapes', () => {
    const shape = { kind: 'hexagon', radius: 3 } as const;
    const plan = createHarborBoard({ seed: 'hex-recipe', faction: 'yellow', shape });
    const ids = new Set(plan.placements.map((placement) => placement.assetId));

    expect(plan.tiles).toHaveLength(coordinatesForShape(shape).length);
    expect(ids.has('building_shipyard_yellow')).toBe(true);
    expect(ids.has('building_townhall_yellow')).toBe(true);
    expect(ids.has('mountain_A_grass_trees')).toBe(true);
    expect(plan.placements.some((placement) => placement.metadata.feature === 'prop-cluster')).toBe(true);
    expect(plan.placements.some((placement) => placement.kind === 'road')).toBe(true);
    expect(plan.placements.some((placement) => placement.kind === 'river')).toBe(true);
  });

  it('exposes coordinate helpers for public board APIs', () => {
    expect(hexKey({ q: -1, r: 2 })).toBe('-1,2');
    expect(neighbor({ q: 0, r: 0 }, 0)).toEqual({ q: 1, r: 0 });
    expect(edgeBetween({ q: 0, r: 0 }, { q: 0, r: 1 })).toBe(1);
    expect(oppositeEdge(1)).toBe(4);
    expect(coordinatesForShape({ kind: 'hexagon', radius: 2 })).toHaveLength(19);
    expect(requiresExtraAsset('building_shipyard_blue')).toBe(true);
    expect(requiresExtraAsset('building_castle_blue')).toBe(false);
    expect(requiresExtraAsset('definitely-not-an-asset')).toBe(true);
  });

  it('createGameboardPlan builds a plan with an optional builder callback (E0h)', () => {
    const planNoCallback = createGameboardPlan({
      seed: 'plain-plan',
      shape: { kind: 'rectangle', width: 2, height: 2 },
    });
    expect(planNoCallback.tiles.length).toBe(4);

    let callbackInvoked = false;
    const planWithCallback = createGameboardPlan(
      {
        seed: 'configured-plan',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      },
      () => {
        callbackInvoked = true;
      }
    );
    expect(callbackInvoked).toBe(true);
    expect(planWithCallback.tiles.length).toBe(3);
  });

  it('getPlacementAsset resolves explicit manifest asset records (E0h)', () => {
    const asset = getPlacementAsset({ assetId: 'hex_grass' }, freeManifest);
    expect(asset?.id).toBe('hex_grass');
    expect(asset?.edition).toBe('free');

    // Unknown id returns undefined.
    expect(getPlacementAsset({ assetId: 'definitely-not-an-asset' }, freeManifest)).toBeUndefined();
  });

  it('loadPlacementAsset lazy-loads packaged FREE manifest records (CR-P2-4)', async () => {
    const asset = await loadPlacementAsset({ assetId: 'hex_grass' });
    expect(asset?.id).toBe('hex_grass');
    expect(asset?.edition).toBe('free');

    await expect(loadPlacementAsset({ assetId: 'definitely-not-an-asset' })).resolves.toBeUndefined();
  });

  it('occupancy helpers honor ignore and footprint options (E0h)', async () => {
    const { gameboardPlacementBlocksOccupancy, gameboardPlacementFootprintKeys } = await import(
      '../../gameboard/occupancy'
    );
    const placement = {
      id: 'wall-1',
      tileKey: '0,0',
      kind: 'structure' as const,
      layer: 'structure' as const,
      metadata: { layoutFootprintTiles: '1,0|0,1' },
    };
    // Default blocks.
    expect(gameboardPlacementBlocksOccupancy(placement)).toBe(true);
    // Skipped via ignorePlacementIds.
    expect(
      gameboardPlacementBlocksOccupancy(placement, { ignorePlacementIds: ['wall-1'] })
    ).toBe(false);
    // Explicitly ignoring layout footprints leaves only the origin tile.
    expect(gameboardPlacementFootprintKeys(placement, { includeLayoutFootprint: false })).toEqual([
      '0,0',
    ]);
  });

  it('addPropCluster zero density returns the builder unchanged (E0h)', () => {
    const builder = createGameboardBuilder({
      seed: 'prop-cluster-zero',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    });
    const beforeCount = builder.build().placements.length;
    const after = builder.addPropCluster({
      at: { q: 1, r: 1 },
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture for the helper
      kind: 'forest' as any,
      density: 0,
    });
    expect(after).toBe(builder);
    expect(after.build().placements.length).toBe(beforeCount);
  });

  it('covers builder defaults, boundary warnings, and variant-only branches (E0h)', () => {
    const defaultPlan = createGameboardBuilder({
      shape: { kind: 'rectangle', width: 2, height: 2 },
      defaultTerrain: 'water',
    })
      .setTerrain({ q: 0, r: 0 }, 'grass')
      .setTileAsset({
        at: { q: 1, r: 0 },
        assetId: 'hex_coast_A',
        terrain: 'coast',
        riverEdges: [3],
        coastEdges: [1],
      })
      .build();

    expect(defaultPlan.seed).toBe('declarative-hex-worlds');
    expect(defaultPlan.tiles.find((tile) => tile.key === '0,0')).toMatchObject({
      baseAssetId: 'hex_grass',
      elevation: 0,
      textureSet: 'default',
    });
    expect(defaultPlan.tiles.find((tile) => tile.key === '1,0')).toMatchObject({
      riverEdges: 0b001000,
      coastEdges: 0b000010,
    });

    const variants = createGameboardBuilder({
      seed: 'variant-branches',
      shape: { kind: 'rectangle', width: 4, height: 2 },
    })
      .addMountainStack({ at: { q: 0, r: 1 }, height: 1 })
      .addMountainStack({ at: { q: 0, r: 0 }, height: 1, variant: 'C', withGrass: false, withTrees: false })
      .addHill({ q: 1, r: 0 }, { variant: 'B', single: true })
      .addForest({ q: 2, r: 0 }, { species: 'B', cut: true })
      .addUnitPreset({ at: { q: 3, r: 0 }, faction: 'red', role: 'worker' })
      .addFortification({ at: { q: 1, r: 1 } })
      .addFortification({ at: { q: 2, r: 1 }, material: 'wood-fence', segment: 'straight' })
      .setElevation({ q: 3, r: 1 }, 1)
      .addElevationRamp({ at: { q: 3, r: 1 }, direction: 'down' })
      .addPropCluster({ at: { q: 3, r: 1 }, kind: 'stable-yard', placement: 'single' })
      .scatterDecorations({ count: 1, assets: [] })
      .build();

    expect(variants.placements.map((placement) => placement.assetId)).toEqual(
      expect.arrayContaining([
        'mountain_A_grass',
        'mountain_C',
        'hill_single_B',
        'trees_B_cut',
        'unit_red_full',
        'wall_straight',
        'fence_wood_straight',
        'hex_grass_sloped_low',
      ])
    );
    expect(
      variants.placements.find((placement) => placement.metadata.propClusterKind === 'stable-yard')
    ).toMatchObject({
      metadata: { density: 1 },
    });
    expect(
      variants.placements.find((placement) => placement.assetId === 'hex_grass_sloped_low')
    ).toMatchObject({
      metadata: { toElevation: 0 },
    });
    const emptyScatter = createGameboardBuilder({
      seed: 'empty-scatter-assets',
      shape: { kind: 'rectangle', width: 1, height: 1 },
    })
      .scatterDecorations({ count: 1, assets: [] })
      .build();
    expect(emptyScatter.placements.some((placement) => placement.metadata.feature === 'scatter')).toBe(false);

    const offBoardPlan = createGameboardBuilder({
      seed: 'offboard-branches',
      shape: { kind: 'rectangle', width: 1, height: 1 },
    })
      .addPropCluster({ at: { q: 0, r: 0 }, kind: 'camp', density: Number.POSITIVE_INFINITY })
      .addHarbor({ at: { q: 0, r: 0 }, facing: 3, faction: 'blue' })
      .build();

    expect(offBoardPlan.placements.find((placement) => placement.assetId === 'building_docks_blue')).toMatchObject({
      metadata: { feature: 'harbor', harborKind: 'docks' },
    });
    expect(offBoardPlan.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('prop cluster tile 1,0 is outside the board'),
        expect.stringContaining('adjacent water tile -1,0 is outside the board'),
      ])
    );
  });

});

describe('addRoadPath non-adjacent step throw (PRD E0b)', () => {
  it('throws when consecutive path coords are not adjacent', () => {
    const builder = createGameboardBuilder({
      seed: 'road-non-adjacent',
      shape: { kind: 'rectangle', width: 5, height: 1 },
    });
    expect(() =>
      builder.addRoadPath([
        { q: 0, r: 0 },
        // (4,0) is not adjacent to (0,0) — pathMasks throws.
        { q: 4, r: 0 },
      ])
    ).toThrow(/is not adjacent/);
  });

  it('throws when a malformed sparse path omits a coordinate', () => {
    const builder = createGameboardBuilder({
      seed: 'road-sparse',
      shape: { kind: 'rectangle', width: 1, height: 1 },
    });
    const sparsePath = new Array<{ q: number; r: number }>(2);
    sparsePath[1] = { q: 0, r: 0 };

    expect(() => builder.addRoadPath(sparsePath)).toThrow(/pathMasks index 0 out of range/);
  });
});

describe('defensive board feature errors (PRD E0h)', () => {
  it('throws for unsupported fence corner segments and degenerate hex harbor recipes', () => {
    expect(() =>
      createGameboardBuilder({
        seed: 'unsupported-fence',
        shape: { kind: 'rectangle', width: 1, height: 1 },
      }).addFortification({
        at: { q: 0, r: 0 },
        material: 'wood-fence',
        segment: 'corner-A-inside' as never,
      })
    ).toThrow(/does not support segment corner-A-inside/);

    expect(() => createHarborBoard({ shape: { kind: 'hexagon', radius: 0 } })).toThrow(
      /No available coordinate exists/
    );
  });
});

describe('addConstructionSite kind variants (PRD E0a)', () => {
  it('emits asset placements for each construction kind', () => {
    const builder = createGameboardBuilder({
      seed: 'construction-variants',
      shape: { kind: 'rectangle', width: 7, height: 1 },
    });
    const kinds = ['destroyed', 'dirt', 'grain', 'scaffolding', 'stage-A', 'stage-B', 'stage-C'] as const;
    kinds.forEach((kind, index) => {
      builder.addConstructionSite({ at: { q: index, r: 0 }, kind });
    });
    const plan = builder.build();
    expect(plan.placements.length).toBeGreaterThanOrEqual(kinds.length);
  });
});

describe('addUnitPreset role variants (PRD E0a)', () => {
  it('adds correct parts for each unit role', () => {
    const builder = createGameboardBuilder({
      seed: 'unit-preset-roles',
      shape: { kind: 'rectangle', width: 7, height: 1 },
    });
    // Each role triggers a different switch-branch in addUnitPreset (gameboard.ts 1314-1340).
    const roles = ['worker', 'soldier', 'archer', 'cavalry', 'merchant', 'siege', 'ship'] as const;
    roles.forEach((role, index) => {
      builder.addUnitPreset({
        at: { q: index, r: 0 },
        faction: 'blue',
        role,
        style: 'full',
      });
    });
    const plan = builder.build();
    // Each preset contributes ≥1 placement; the unit base is always added,
    // plus role-specific parts (1 for worker/merchant/siege/ship,
    // 3 for soldier, 2 for archer/cavalry).
    expect(plan.placements.length).toBeGreaterThan(roles.length);
  });
});

function tileFixture(overrides: Partial<GameboardTileSpec> = {}): GameboardTileSpec {
  return {
    key: '0,0',
    coordinates: { q: 0, r: 0 },
    terrain: 'grass',
    textureSet: 'default',
    elevation: 0,
    baseAssetId: 'hex_grass',
    supportAssetId: 'hex_grass_bottom',
    roadEdges: 0,
    riverEdges: 0,
    coastEdges: 0,
    riverWaterless: false,
    riverCurvy: false,
    coastWaterless: false,
    tags: ['grass'],
    ...overrides,
  };
}

function placementFixture(id: string, order: number): GameboardPlacementSpec {
  return {
    id,
    tileKey: '0,0',
    coordinates: { q: 0, r: 0 },
    position: { x: 0, y: 0, z: 0 },
    assetId: 'crate_A_small',
    kind: 'prop',
    layer: 'feature',
    textureSet: 'default',
    elevation: 0,
    elevationOffset: 0,
    rotationSteps: 0,
    rotationRadians: 0,
    scale: 1,
    order,
    requiresExtra: false,
    metadata: {},
  };
}
