import { describe, expect, it } from 'vitest';
import { factionBuildingAssetId, isKnownExtraAssetId, textureFileName } from '../../scenario/catalog';
import { containsHex, coordinatesForShape } from '../../coordinates';
import { createGameboardBuilder } from '../../gameboard';
import { AdjacentTo, HexTileState, createGameboardWorld, findTileEntity } from '../../koota';
import { createGameboardPieceRegistry } from '../../pieces';
import {
  canPlaceHarborAt,
  canStackAt,
  createSeededGameboardDensityFillRules,
  createSeededGameboardPieceFillRules,
  createSeededGameboardPlan,
  createSeededGameboardWorld,
  inspectSeededGameboardPieceFills,
  projectWorldToGameboardPlan,
  readDecomposedTileSpecs,
  setTileElevation,
  setTileTerrain,
  validateGameboardRules,
} from '../../rules';
import { validateGameboardPlan } from '../../rules/validation';

describe('Koota rules and seeded generation', () => {
  it('exposes catalog ids for guide families instead of string guessing', () => {
    expect(factionBuildingAssetId('shipyard', 'blue')).toBe('building_shipyard_blue');
    expect(textureFileName('winter')).toBe('hexagons_medieval_Winter.png');
    expect(isKnownExtraAssetId('building_shipyard_blue')).toBe(true);
    expect(isKnownExtraAssetId('unit_blue_accent')).toBe(true);
    expect(isKnownExtraAssetId('building_castle_blue')).toBe(false);
  });

  it('links adjacent tile entities with edge metadata', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({ seed: 'adjacency', shape: { kind: 'rectangle', width: 2, height: 2 } }).build()
    );
    const tile = findTileEntity(world, { q: 0, r: 0 });
    const neighbor = findTileEntity(world, { q: 1, r: 0 });

    expect(tile).toBeDefined();
    expect(neighbor).toBeDefined();
    expect(tile && neighbor ? tile.get(AdjacentTo(neighbor))?.edge : undefined).toBe(0);
  });

  it('keeps decomposed tile traits in sync for direct Koota rule edits', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({ seed: 'mutate', shape: { kind: 'rectangle', width: 2, height: 2 } }).build()
    );

    setTileTerrain(world, { q: 0, r: 0 }, 'water');
    setTileElevation(world, { q: 1, r: 0 }, 2);

    expect(findTileEntity(world, '0,0')?.get(HexTileState)?.terrain).toBe('water');
    expect(canStackAt(world, '0,0', 1)).toBe(false);
    expect(canStackAt(world, '1,0', 3)).toBe(true);
    expect(readDecomposedTileSpecs(world).find((tile) => tile.key === '1,0')?.elevation).toBe(2);
  });

  it('validates stacking, reciprocal adjacency, and harbor rules from Koota state', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({ seed: 'rules', shape: { kind: 'rectangle', width: 3, height: 3 } })
        .addHarbor({ at: { q: 1, r: 1 }, facing: 1, faction: 'blue', kind: 'shipyard' })
        .build()
    );

    expect(canPlaceHarborAt(world, { q: 1, r: 1 }, 1)).toBe(true);
    expect(validateGameboardRules(world).filter((violation) => violation.severity === 'error')).toEqual([]);

    setTileElevation(world, { q: 1, r: 2 }, 2);
    const errors = validateGameboardRules(world).filter((violation) => violation.severity === 'error');
    expect(errors.map((violation) => violation.code)).toContain('stack.water_elevation');
  });

  it('creates deterministic seeded gameboards and can project Koota state back to a plan', () => {
    const first = createSeededGameboardPlan({ seed: 'world-seed', shape: { kind: 'rectangle', width: 8, height: 6 } });
    const second = createSeededGameboardPlan({ seed: 'world-seed', shape: { kind: 'rectangle', width: 8, height: 6 } });
    const world = createSeededGameboardWorld({ seed: 'world-seed', shape: { kind: 'rectangle', width: 8, height: 6 } });
    const projected = projectWorldToGameboardPlan(world);

    expect(first.tiles).toEqual(second.tiles);
    expect(first.placements.map((placement) => placement.assetId)).toEqual(
      second.placements.map((placement) => placement.assetId)
    );
    expect(projected.tiles).toEqual(first.tiles);
    expect(validateGameboardRules(world).some((violation) => violation.severity === 'error')).toBe(false);
  });

  it('creates deterministic seeded hexagon gameboards', () => {
    const shape = { kind: 'hexagon', radius: 3 } as const;
    const first = createSeededGameboardPlan({ seed: 'hex-world', shape, faction: 'yellow' });
    const second = createSeededGameboardPlan({ seed: 'hex-world', shape, faction: 'yellow' });
    const water = first.tiles.filter((tile) => tile.terrain === 'water');
    const coasts = first.tiles.filter((tile) => tile.terrain === 'coast');
    const harbor = first.placements.find((placement) => placement.metadata.feature === 'harbor');

    expect(first.tiles).toHaveLength(coordinatesForShape(shape).length);
    expect(first.tiles.every((tile) => containsHex(shape, tile.coordinates))).toBe(true);
    expect(water.length).toBeGreaterThan(0);
    expect(coasts.length).toBeGreaterThan(0);
    expect(harbor).toMatchObject({
      kind: 'structure',
      metadata: {
        faction: 'yellow',
      },
    });
    expect(first.tiles).toEqual(second.tiles);
    expect(first.placements.map((placement) => [placement.assetId, placement.tileKey, placement.rotationSteps])).toEqual(
      second.placements.map((placement) => [placement.assetId, placement.tileKey, placement.rotationSteps])
    );
    expect(validateGameboardPlan(first).filter((violation) => violation.severity === 'error')).toEqual([]);
  });

  it('applies layout percentage fills during seeded generation', () => {
    const first = createSeededGameboardPlan({
      seed: 'filled-world',
      shape: { kind: 'rectangle', width: 8, height: 6 },
      layoutFillSeed: 'filled-world:layout-fill',
      layoutFills: [
        {
          id: 'seeded-groves',
          archetype: 'tree',
          assets: ['tree_single_A', 'tree_single_B'],
          fill: 0.2,
          minCount: 2,
          maxCount: 4,
        },
      ],
    });
    const second = createSeededGameboardPlan({
      seed: 'filled-world',
      shape: { kind: 'rectangle', width: 8, height: 6 },
      layoutFillSeed: 'filled-world:layout-fill',
      layoutFills: [
        {
          id: 'seeded-groves',
          archetype: 'tree',
          assets: ['tree_single_A', 'tree_single_B'],
          fill: 0.2,
          minCount: 2,
          maxCount: 4,
        },
      ],
    });
    const fillPlacements = first.placements.filter((placement) => placement.id.startsWith('layout:seeded-groves'));

    expect(fillPlacements.length).toBeGreaterThanOrEqual(2);
    expect(fillPlacements.length).toBeLessThanOrEqual(4);
    expect(fillPlacements.every((placement) => placement.metadata.layoutArchetype === 'tree')).toBe(true);
    expect(fillPlacements.every((placement) => placement.metadata.layoutSeed === 'filled-world:layout-fill:seeded-groves')).toBe(
      true
    );
    expect(fillPlacements.map((placement) => [placement.assetId, placement.tileKey, placement.metadata.layoutSlot])).toEqual(
      second.placements
        .filter((placement) => placement.id.startsWith('layout:seeded-groves'))
        .map((placement) => [placement.assetId, placement.tileKey, placement.metadata.layoutSlot])
    );
  });

  it('creates ergonomic density fill rules for common seeded board archetypes', () => {
    const rules = createSeededGameboardDensityFillRules(
      {
        trees: 0.15,
        harbors: { count: 1 },
        landmarks: { count: 2 },
        units: { fill: 0.04, minCount: 1, metadata: { team: 'red' } },
      },
      { faction: 'red' }
    );

    expect(rules.map((rule) => rule.id)).toEqual([
      'density:harbors',
      'density:landmarks',
      'density:units',
      'density:trees',
    ]);
    expect(rules[0]).toMatchObject({
      archetype: 'harbor',
      count: 1,
      assets: ['building_docks_red', 'building_shipyard_red'],
      requiresExtra: true,
      criteria: {
        terrain: 'coast',
        requiredAdjacentTerrain: 'water',
      },
    });
    expect(rules[1]).toMatchObject({
      archetype: 'landmark',
      count: 2,
      assets: ['building_tower_A_red', 'building_tower_B_red'],
    });
    expect(rules[2]).toMatchObject({
      archetype: 'unit',
      assetId: 'unit_red_full',
      fill: 0.04,
      minCount: 1,
      requiresExtra: true,
      metadata: { densityPreset: 'units', team: 'red' },
    });
    expect(rules[3]).toMatchObject({
      archetype: 'tree',
      fill: 0.15,
      assets: ['tree_single_A', 'tree_single_B'],
    });
  });

  it('applies density presets during seeded generation', () => {
    const plan = createSeededGameboardPlan({
      seed: 'density-world',
      shape: { kind: 'rectangle', width: 8, height: 6 },
      faction: 'green',
      layoutDensity: {
        harbors: { count: 1 },
        trees: { fill: 0.2, minCount: 2, maxCount: 3 },
        landmarks: { count: 1 },
      },
    });
    const harbors = plan.placements.filter((placement) => placement.metadata.densityPreset === 'harbors');
    const trees = plan.placements.filter((placement) => placement.metadata.densityPreset === 'trees');
    const landmarks = plan.placements.filter((placement) => placement.metadata.densityPreset === 'landmarks');

    expect(harbors).toHaveLength(1);
    expect(harbors[0]).toMatchObject({
      kind: 'structure',
      requiresExtra: true,
      metadata: { layoutArchetype: 'harbor', feature: 'harbor' },
    });
    expect(typeof harbors[0]?.metadata.facing).toBe('number');
    expect(['building_docks_green', 'building_shipyard_green']).toContain(harbors[0]?.assetId);
    expect(validateGameboardPlan(plan).filter((violation) => violation.severity === 'error')).toEqual([]);
    expect(trees.length).toBeGreaterThanOrEqual(2);
    expect(trees.length).toBeLessThanOrEqual(3);
    expect(trees.every((placement) => placement.metadata.layoutArchetype === 'tree')).toBe(true);
    expect(landmarks).toHaveLength(1);
    expect(['building_tower_A_green', 'building_tower_B_green']).toContain(landmarks[0]?.assetId);
  });

  it('creates seeded fill rules directly from piece registries', () => {
    const registry = createGameboardPieceRegistry([
      {
        id: 'kenney-large-tree',
        assetId: 'kenney:tree-large',
        source: 'Kenney Castle Kit',
        role: 'tree',
        rotationSteps: 'random',
        tags: ['forest'],
      },
      {
        id: 'kenney-small-tree',
        assetId: 'kenney:tree-small',
        source: 'Kenney Castle Kit',
        role: 'tree',
        rotationSteps: 'random',
        tags: ['forest'],
      },
      {
        id: 'kenney-round-tower',
        assetId: 'kenney:tower-hexagon-base',
        source: 'Kenney Castle Kit',
        role: 'landmark',
        footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
        criteria: { terrain: ['grass', 'road'], edgePadding: 0 },
      },
    ]);
    const rules = createSeededGameboardPieceFillRules(registry, [
      {
        mode: 'pool',
        id: 'kenney-forest-pool',
        selection: { roles: ['tree'], tags: ['forest'] },
        fill: 0.2,
        minCount: 2,
      },
      {
        mode: 'per-piece',
        ruleIdPrefix: 'kenney-landmark',
        selection: { roles: ['landmark'] },
        count: 1,
      },
    ]);

    expect(rules).toHaveLength(2);
    expect(rules[0]).toMatchObject({
      id: 'kenney-forest-pool',
      archetype: 'tree',
      assets: ['kenney:tree-large', 'kenney:tree-small'],
      fill: 0.2,
      minCount: 2,
      rotationSteps: 'random',
      requiresExtra: true,
      metadata: {
        pieceIds: 'kenney-large-tree|kenney-small-tree',
        pieceCollectionSize: 2,
      },
    });
    expect(rules[1]).toMatchObject({
      id: 'kenney-landmark:kenney-round-tower',
      assetId: 'kenney:tower-hexagon-base',
      archetype: 'landmark',
      count: 1,
      criteria: {
        terrain: ['grass', 'road'],
        edgePadding: 0,
        footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
      },
      metadata: {
        pieceId: 'kenney-round-tower',
        pieceRole: 'landmark',
      },
    });
  });

  it('inspects seeded piece fills with placement analysis before mutating a board', () => {
    const plan = createGameboardBuilder({
      seed: 'inspect-piece-fills',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    }).build();
    const registry = createGameboardPieceRegistry([
      {
        id: 'kenney-large-tree',
        assetId: 'kenney:tree-large',
        source: 'Kenney Castle Kit',
        role: 'tree',
        tags: ['forest'],
      },
      {
        id: 'kenney-small-tree',
        assetId: 'kenney:tree-small',
        source: 'Kenney Castle Kit',
        role: 'tree',
        tags: ['forest'],
      },
      {
        id: 'kenney-round-tower',
        assetId: 'kenney:tower-hexagon-base',
        source: 'Kenney Castle Kit',
        role: 'landmark',
      },
    ]);

    const inspection = inspectSeededGameboardPieceFills(
      plan,
      registry,
      [
        {
          mode: 'pool',
          id: 'kenney-forest-pool',
          selection: { roles: ['tree'], tags: ['forest'] },
          count: 2,
        },
        {
          mode: 'pool',
          id: 'mixed-pool',
          selection: { sources: ['Kenney Castle Kit'] },
          count: 1,
        },
      ],
      { seed: 'piece-fill-inspection' }
    );

    expect(inspection).toMatchObject({
      seed: 'piece-fill-inspection',
      selectionCount: 2,
      selectedPieceCount: 3,
      analysis: {
        placementCount: 2,
        errorCount: 0,
      },
      selections: [
        {
          id: 'kenney-forest-pool',
          mode: 'pool',
          selectedCount: 2,
          selectedPieceIds: ['kenney-large-tree', 'kenney-small-tree'],
          errors: [],
        },
        {
          id: 'mixed-pool',
          mode: 'pool',
          selectedCount: 3,
          errors: ['Piece fill mixed-pool cannot pool pieces with different archetype, kind, or layer'],
        },
      ],
      errors: ['Piece fill mixed-pool cannot pool pieces with different archetype, kind, or layer'],
    });
    expect(inspection.rules).toHaveLength(1);
    expect(inspection.rules[0]).toMatchObject({
      id: 'kenney-forest-pool',
      assets: ['kenney:tree-large', 'kenney:tree-small'],
    });
    expect(inspection.placements).toHaveLength(2);
    expect(inspection.placements.every((placement) => ['kenney:tree-large', 'kenney:tree-small'].includes(placement.assetId))).toBe(
      true
    );
  });

  it('applies custom piece registries during seeded generation', () => {
    const registry = createGameboardPieceRegistry([
      {
        id: 'kenney-round-tower',
        assetId: 'kenney:tower-hexagon-base',
        source: 'Kenney Castle Kit',
        role: 'landmark',
        footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
        criteria: {
          terrain: ['grass', 'road'],
          edgePadding: 0,
          prefer: [{ kind: 'center', weight: 1 }],
        },
      },
    ]);
    const plan = createSeededGameboardPlan({
      seed: 'piece-registry-world',
      shape: { kind: 'rectangle', width: 8, height: 6 },
      pieceRegistry: registry,
      pieceFills: [
        {
          selection: { ids: ['kenney-round-tower'] },
          count: 1,
        },
      ],
    });
    const tower = plan.placements.find((placement) => placement.metadata.pieceId === 'kenney-round-tower');

    expect(tower).toMatchObject({
      assetId: 'kenney:tower-hexagon-base',
      requiresExtra: true,
      metadata: {
        layoutArchetype: 'landmark',
        layoutFootprintSize: 3,
        pieceRole: 'landmark',
        pieceSource: 'Kenney Castle Kit',
      },
    });
    expect(String(tower?.metadata.layoutFootprintTiles).split('|')).toHaveLength(3);
  });

  it('keeps Koota validation aligned with neutral plan validation', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({ seed: 'parity', shape: { kind: 'rectangle', width: 2, height: 2 } })
        .addRoadPath([
          { q: 0, r: 0 },
          { q: 1, r: 0 },
        ])
        .build()
    );
    setTileTerrain(world, { q: 1, r: 1 }, 'water');
    setTileElevation(world, { q: 1, r: 1 }, 1);

    const plan = projectWorldToGameboardPlan(world);

    expect(validateGameboardRules(world)).toEqual(validateGameboardPlan(plan));
  });

  it('world-rules error + false branches: missing tile throws; non-water adjacency rejects harbor (PRD E0f)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({ seed: 'world-rules-branches', shape: { kind: 'rectangle', width: 2, height: 2 } }).build()
    );

    expect(() => setTileTerrain(world, { q: 99, r: 99 }, 'water')).toThrow(/No tile exists/);
    expect(() => setTileElevation(world, { q: 99, r: 99 }, 2)).toThrow(/No tile exists/);
    expect(canPlaceHarborAt(world, { q: 0, r: 0 }, 0)).toBe(false);
    expect(canPlaceHarborAt(world, { q: 99, r: 99 }, 0)).toBe(false);
  });

  it('validateGameboardPlan accepts a 1x1 plan with an unconnected road edge (E0h)', () => {
    // Just exercises the validateConnectivityEdges loop with a tile
    // whose only road edge is off-board — the default profile doesn't
    // requireReciprocal=true so no violation fires, but the loop runs.
    const plan = createGameboardBuilder({
      seed: 'tiny-road',
      shape: { kind: 'rectangle', width: 1, height: 1 },
    })
      .addRoadPath([{ q: 0, r: 0 }])
      .build();
    const violations = validateGameboardPlan(plan);
    // Default profile is permissive — no errors for off-board edges.
    expect(violations.filter((v) => v.severity === 'error')).toEqual([]);
  });
});
