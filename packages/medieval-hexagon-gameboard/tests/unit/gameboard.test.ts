import { describe, expect, it } from 'vitest';
import {
  coordinatesForShape,
  createGameboardBuilder,
  createMedievalHarborBoard,
  edgeBetween,
  hexKey,
  neighbor,
  oppositeEdge,
  requiresExtraAsset,
} from '../../src/gameboard';

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
    const plan = createMedievalHarborBoard({ seed: 'recipe', faction: 'green' });
    const ids = new Set(plan.placements.map((placement) => placement.assetId));

    expect(plan.tiles).toHaveLength(48);
    expect(ids.has('building_shipyard_green')).toBe(true);
    expect(ids.has('building_townhall_green')).toBe(true);
    expect(ids.has('mountain_A_grass_trees')).toBe(true);
    expect(plan.placements.some((placement) => placement.kind === 'road')).toBe(true);
    expect(plan.placements.some((placement) => placement.kind === 'river')).toBe(true);
  });

  it('ships the harbor-town board recipe on hexagon shapes', () => {
    const shape = { kind: 'hexagon', radius: 3 } as const;
    const plan = createMedievalHarborBoard({ seed: 'hex-recipe', faction: 'yellow', shape });
    const ids = new Set(plan.placements.map((placement) => placement.assetId));

    expect(plan.tiles).toHaveLength(coordinatesForShape(shape).length);
    expect(ids.has('building_shipyard_yellow')).toBe(true);
    expect(ids.has('building_townhall_yellow')).toBe(true);
    expect(ids.has('mountain_A_grass_trees')).toBe(true);
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
  });
});
