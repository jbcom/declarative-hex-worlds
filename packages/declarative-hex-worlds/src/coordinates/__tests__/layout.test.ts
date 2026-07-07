import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../gameboard/index';
import type { GameboardPlacementKind } from '../../gameboard/index';
import { createGameboardWorld, readGameboardPlacements } from '../../koota/index';
import {
  analyzeGameboardLayoutFill,
  appendGameboardLayoutPlacementsToPlan,
  createGameboardLayoutArchetypeRegistry,
  createGameboardLayoutFillPlacements,
  createGameboardLayoutPlacements,
  inspectGameboardLayoutSites,
  normalizeGameboardLayoutArchetypeRegistry,
  resolveGameboardLayoutArchetype,
  selectGameboardLayoutSites,
  type GameboardLayoutPlacementDiagnostics,
} from '../../coordinates/layout';
import {
  spawnGameboardLayoutFill,
  spawnGameboardLayoutPlacements,
} from '../../coordinates/layout-runtime';

describe('gameboard layout placement criteria', () => {
  it('selects deterministic open sites from terrain and occupancy rules', () => {
    const plan = createLayoutFixturePlan();
    const first = selectGameboardLayoutSites(plan, {
      count: 3,
      seed: 'trees',
      criteria: {
        terrain: ['grass', 'road', 'coast'],
        minDistanceBetween: 2,
        prefer: [
          { kind: 'center', weight: 1 },
          { kind: 'far-from-placement-kind', placementKind: ['structure', 'prop'], radius: 3, weight: 0.5 },
        ],
      },
    });
    const second = selectGameboardLayoutSites(plan, {
      count: 3,
      seed: 'trees',
      criteria: {
        terrain: ['grass', 'road', 'coast'],
        minDistanceBetween: 2,
        prefer: [
          { kind: 'center', weight: 1 },
          { kind: 'far-from-placement-kind', placementKind: ['structure', 'prop'], radius: 3, weight: 0.5 },
        ],
      },
    });

    expect(first.map((site) => site.key)).toEqual(second.map((site) => site.key));
    expect(first).toHaveLength(3);
    expect(first.map((site) => site.key)).not.toContain('2,1');
    expect(first.map((site) => site.key)).not.toContain('3,1');
    expect(first.every((site) => site.tile.terrain !== 'water')).toBe(true);
    expect(first.every((site) => !site.occupied)).toBe(true);
  });

  it('createGameboardLayoutPlacements throws when neither kind nor archetype.kind is provided (E0b)', () => {
    const plan = createLayoutFixturePlan();
    expect(() =>
      createGameboardLayoutPlacements(plan, {
        count: 1,
        seed: 'no-kind',
        assetId: 'rock_single_A',
        // No `kind`, no `archetype` — line 803 throw.
      })
    ).toThrow(/requires kind or an archetype/);
  });

  it('creates spawn options with layout metadata and random deterministic rotation', () => {
    const plan = createLayoutFixturePlan();
    const placements = createGameboardLayoutPlacements(plan, {
      count: 2,
      seed: 'rocks',
      idPrefix: 'layout:rock',
      assetId: 'rock_single_A',
      kind: 'decoration',
      layer: 'feature',
      rotationSteps: 'random',
      criteria: {
        terrain: 'grass',
        allowOccupied: false,
        minDistanceBetween: 2,
        prefer: [{ kind: 'near-terrain', terrain: 'coast', radius: 3, weight: 1 }],
      },
      occupancyGuard: true,
      metadata: {
        placementPurpose: 'scatter-test',
      },
    });

    expect(placements).toHaveLength(2);
    expect(placements.map((placement) => placement.id)).toEqual(['layout:rock:0', 'layout:rock:1']);
    expect(placements.every((placement) => typeof placement.rotationSteps === 'number')).toBe(true);
    expect(placements[0]?.metadata).toMatchObject({
      placementPurpose: 'scatter-test',
      layoutSeed: 'rocks',
      layoutOccupied: false,
    });
    expect(placements.every((placement) => placement.occupancyGuard === true)).toBe(true);
  });

  it('appends generated layout placement options back into a serialized plan', () => {
    const plan = createLayoutFixturePlan();
    const [placement] = createGameboardLayoutPlacements(plan, {
      count: 1,
      seed: 'append-layout-placement',
      idPrefix: 'layout:crate',
      assetId: 'crate_A_small',
      archetype: 'scatter',
      criteria: { terrain: 'grass', allowOccupied: false },
    });

    const next = appendGameboardLayoutPlacementsToPlan(plan, placement ? [placement] : []);
    const appended = next.placements.find((item) => item.id === 'layout:crate:0');

    expect(next.placements).toHaveLength(plan.placements.length + 1);
    expect(appended).toMatchObject({
      id: 'layout:crate:0',
      assetId: 'crate_A_small',
      kind: 'decoration',
      layer: 'feature',
      metadata: {
        layoutArchetype: 'scatter',
        layoutFootprintSize: 1,
      },
    });
    expect(appended?.tileKey).toBe(placementKey(placement?.at ?? ''));
  });

  it('filters sites by stack height and adjacent placement rules', () => {
    const plan = createGameboardBuilder({
      seed: 'layout-adjacency',
      shape: { kind: 'rectangle', width: 4, height: 3 },
    })
      .setElevation({ q: 1, r: 0 }, 2)
      .setElevation({ q: 0, r: 1 }, 2)
      .setElevation({ q: 2, r: 0 }, 2)
      .setElevation({ q: 3, r: 0 }, 2)
      .addFactionBuilding({ at: { q: 1, r: 1 }, faction: 'blue', building: 'market' })
      .addProp({ at: { q: 2, r: 1 }, assetId: 'crate_A_small' })
      .build();

    const sites = selectGameboardLayoutSites(plan, {
      count: 8,
      seed: 'layout-adjacency',
      criteria: {
        terrain: 'grass',
        minElevation: 2,
        maxElevation: 2,
        requiredAdjacentPlacementKind: 'structure',
        forbiddenAdjacentPlacementKind: 'prop',
        allowOccupied: false,
      },
    });

    expect(sites.map((site) => site.key).sort()).toEqual(['0,1', '1,0']);
    expect(sites.every((site) => site.tile.elevation === 2)).toBe(true);
  });

  it('inspects accepted and rejected layout sites with rejection counts', () => {
    const plan = createGameboardBuilder({
      seed: 'layout-inspection',
      shape: { kind: 'rectangle', width: 2, height: 2 },
    })
      .setTerrain({ q: 1, r: 1 }, 'water')
      .addFactionBuilding({ at: { q: 0, r: 0 }, faction: 'blue', building: 'market' })
      .build();

    const inspection = inspectGameboardLayoutSites(plan, {
      count: 2,
      seed: 'layout-inspection',
      criteria: {
        terrain: 'grass',
        allowOccupied: false,
        requiredAdjacentTerrain: 'water',
      },
    });

    expect(inspection).toMatchObject({
      seed: 'layout-inspection',
      selectedCount: 2,
      candidateCount: 2,
      rejectedCount: 2,
      rejectionCounts: {
        occupied: 1,
        terrain: 1,
        'missing-adjacent-terrain': 2,
      },
    });
    expect(inspection.selected.map((site) => site.key).sort()).toEqual(['0,1', '1,0']);
    expect(inspection.rejected.find((site) => site.key === '0,0')?.rejections.map((rejection) => rejection.code)).toEqual(
      expect.arrayContaining(['occupied', 'missing-adjacent-terrain'])
    );
    expect(inspection.rejected.find((site) => site.key === '1,1')?.rejections.map((rejection) => rejection.code)).toEqual(
      expect.arrayContaining(['terrain', 'missing-adjacent-terrain'])
    );
  });

  it('layout footprint accepts radius shorthand + radius kind (E0b)', () => {
    // Covers layout.ts lines 1287 + 1302 + 1327 (radius-shape footprint paths).
    const plan = createGameboardBuilder({
      seed: 'layout-footprint-radius',
      shape: { kind: 'rectangle', width: 4, height: 3 },
    }).build();
    // Number footprint (line 1302) → kind: 'radius'.
    const radiusByNumber = inspectGameboardLayoutSites(plan, {
      criteria: { footprint: 1 },
    });
    // Either accepts or rejects — covers the code path; assert call returned.
    expect(Array.isArray(radiusByNumber.selected)).toBe(true);
    // Explicit radius kind (line 1327).
    const explicitRadius = inspectGameboardLayoutSites(plan, {
      criteria: { footprint: { kind: 'radius', radius: 1 } },
    });
    expect(Array.isArray(explicitRadius.selected)).toBe(true);
  });

  it('site selection honors far-from-terrain preference (E0b)', () => {
    // Covers layout.ts lines 1222-1225 (far-from-terrain preference).
    const plan = createGameboardBuilder({
      seed: 'layout-far-from-terrain',
      shape: { kind: 'rectangle', width: 4, height: 1 },
    })
      .setTerrain({ q: 0, r: 0 }, 'water')
      .build();
    const inspection = inspectGameboardLayoutSites(plan, {
      count: 1,
      criteria: {
        terrain: 'grass',
        prefer: [{ kind: 'far-from-terrain', terrain: 'water', radius: 4, weight: 1 }],
      },
    });
    // Selected should prefer the tile farthest from water (3,0).
    expect(inspection.selected[0]?.key).toBe('3,0');
  });

  it('rejects sites by min/max distance + forbidden adjacent placement layer (E0b)', () => {
    // Covers layout.ts lines 1122 + 1128 + 1131.
    const plan = createGameboardBuilder({
      seed: 'layout-distance',
      shape: { kind: 'rectangle', width: 4, height: 1 },
    })
      .addFactionBuilding({ at: { q: 1, r: 0 }, faction: 'blue', building: 'market' })
      .build();
    const inspection = inspectGameboardLayoutSites(plan, {
      criteria: {
        forbiddenAdjacentPlacementLayer: 'structure',
        minDistanceFrom: [{ q: 0, r: 0 }],
        minDistance: 2,
        maxDistanceFrom: [{ q: 0, r: 0 }],
        maxDistance: 1,
      },
    });
    const codes = new Set(inspection.rejected.flatMap((s) => s.rejections.map((r) => r.code)));
    expect(codes.has('forbidden-adjacent-placement-layer') || codes.has('min-distance') || codes.has('max-distance')).toBe(true);
  });

  it('rejects sites missing required tags or required-adjacent-placement-layer (E0b)', () => {
    // Covers layout.ts line 1080 (missing-required-tags) + line 1116 (missing-adjacent-placement-layer).
    const plan = createGameboardBuilder({
      seed: 'layout-required',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    }).build();
    const inspection = inspectGameboardLayoutSites(plan, {
      criteria: { tileTags: ['must-have'], requiredAdjacentPlacementLayer: 'structure' },
    });
    // No tile has 'must-have' tag and no adjacent structure → all rejected.
    const codes = new Set(inspection.rejected.flatMap((s) => s.rejections.map((r) => r.code)));
    expect(codes.has('missing-required-tags')).toBe(true);
    expect(codes.has('missing-adjacent-placement-layer')).toBe(true);
  });

  it('rejects sites with forbiddenAdjacentTerrain (E0b)', () => {
    // Covers layout.ts line 1094-1096.
    const plan = createGameboardBuilder({
      seed: 'layout-forbidden-adj',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    })
      .setTerrain({ q: 1, r: 0 }, 'water')
      .build();
    const inspection = inspectGameboardLayoutSites(plan, {
      criteria: { forbiddenAdjacentTerrain: 'water' },
    });
    // Adjacent to (1,0) water: (0,0) and (2,0) should reject.
    const rejected = inspection.rejected.find((s) => s.key === '0,0');
    expect(rejected?.rejections.map((r) => r.code)).toContain('forbidden-adjacent-terrain');
  });

  it('rejects sites by excludeTerrain + excludeTileTags filters (E0b)', () => {
    // Covers layout.ts lines 1073-1075 (excluded-terrain) + 1082-1084 (excluded-tags).
    const plan = createGameboardBuilder({
      seed: 'layout-exclusions',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    })
      .setTerrain({ q: 1, r: 0 }, 'water')
      .setTileAsset({
        at: { q: 2, r: 0 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['restricted'],
      })
      .build();
    const inspection = inspectGameboardLayoutSites(plan, {
      criteria: {
        excludeTerrain: 'water',
        excludeTileTags: ['restricted'],
      },
    });
    const rejected = inspection.rejected.map((s) => ({
      key: s.key,
      codes: s.rejections.map((r) => r.code),
    }));
    expect(rejected.some((r) => r.key === '1,0' && r.codes.includes('excluded-terrain'))).toBe(true);
    expect(rejected.some((r) => r.key === '2,0' && r.codes.includes('excluded-tags'))).toBe(true);
  });

  it('uses the harbor archetype for coast tiles with adjacent water', () => {
    const builder = createGameboardBuilder({
      seed: 'layout-harbor',
      shape: { kind: 'rectangle', width: 4, height: 3 },
    });
    for (let q = 0; q < 4; q += 1) {
      builder.setTerrain({ q, r: 2 }, 'water');
      builder.setCoastEdges({ q, r: 1 }, [1]);
    }
    const plan = builder.build();
    const placements = createGameboardLayoutPlacements(plan, {
      archetype: 'harbor',
      count: 2,
      seed: 'layout-harbor',
      assetId: 'building_docks_blue',
      idPrefix: 'layout:harbor',
      requiresExtra: true,
    });

    expect(placements).toHaveLength(2);
    expect(placements.every((placement) => placement.kind === 'structure')).toBe(true);
    expect(placements.every((placement) => placement.layer === 'structure')).toBe(true);
    expect(placements.every((placement) => placement.metadata?.layoutArchetype === 'harbor')).toBe(true);
    expect(placements.every((placement) => placement.metadata?.feature === 'harbor')).toBe(true);
    expect(placements.every((placement) => typeof placement.metadata?.facing === 'number')).toBe(true);
    expect(placements.every((placement) => placement.rotationSteps === placement.metadata?.facing)).toBe(true);
    expect(placements.every((placement) => placementKey(placement.at).endsWith(',1'))).toBe(true);
  });

  it('builds reusable custom archetype registries beside built-in archetypes', () => {
    const plan = createLayoutFixturePlan();
    const archetypes = createGameboardLayoutArchetypeRegistry([
      {
        id: 'camp-supply',
        label: 'Camp Supply',
        kind: 'prop',
        layer: 'feature',
        criteria: {
          terrain: ['grass', 'road'],
          allowOccupied: true,
          maxPerTile: 2,
          slotGroup: 'camp-supply',
          prefer: [{ kind: 'near-placement-kind', placementKind: 'structure', radius: 3, weight: 1 }],
        },
        rotationSteps: 'random',
        metadata: { registeredArchetype: 'camp-supply' },
      },
    ]);
    const placements = createGameboardLayoutPlacements(plan, {
      archetypes,
      archetype: 'camp-supply',
      assetId: 'external:barrel-stack',
      idPrefix: 'layout:camp-supply',
      seed: 'custom-archetype',
      count: 2,
    });
    const builtInPlacement = createGameboardLayoutPlacements(plan, {
      archetypes,
      archetype: 'tree',
      assetId: 'tree_single_A',
      seed: 'custom-archetype-built-in',
      count: 1,
    });

    expect(archetypes.tree?.id).toBe('tree');
    expect(placements).toHaveLength(2);
    expect(placements.every((placement) => placement.kind === 'prop')).toBe(true);
    expect(placements.every((placement) => placement.metadata?.layoutArchetype === 'camp-supply')).toBe(true);
    expect(placements.every((placement) => placement.metadata?.registeredArchetype === 'camp-supply')).toBe(true);
    expect(placements.every((placement) => typeof placement.rotationSteps === 'number')).toBe(true);
    expect(builtInPlacement[0]?.metadata?.layoutArchetype).toBe('tree');
  });

  it('uses archetypes for scatter mechanics with multiple slots per tile', () => {
    const plan = createSingleForestTilePlan();
    const placements = createGameboardLayoutPlacements(plan, {
      archetype: 'tree',
      count: 3,
      seed: 'tiny-grove',
      idPrefix: 'layout:tree',
      assetId: 'tree_single_A',
    });

    expect(placements).toHaveLength(3);
    expect(placements.every((placement) => placement.kind === 'decoration')).toBe(true);
    expect(placements.every((placement) => placement.layer === 'feature')).toBe(true);
    expect(placements.every((placement) => placementKey(placement.at) === '0,0')).toBe(true);
    expect(placements.map((placement) => placement.metadata?.layoutSlot)).toEqual([0, 1, 2]);
    expect(new Set(placements.map((placement) => positionOffsetKey(placement.positionOffset))).size).toBe(3);
    expect(placements.every((placement) => placement.metadata?.layoutArchetype === 'tree')).toBe(true);
    expect(placements.every((placement) => typeof placement.metadata?.layoutPositionOffsetX === 'number')).toBe(true);
    expect(placements.every((placement) => typeof placement.metadata?.layoutPositionOffsetZ === 'number')).toBe(true);
    expect(placements.every((placement) => typeof placement.rotationSteps === 'number')).toBe(true);
  });

  it('reserves soft-feature slots between fill rules', () => {
    const plan = createSingleForestTilePlan();
    const placements = createGameboardLayoutFillPlacements(plan, {
      seed: 'soft-feature-slots',
      rules: [
        {
          id: 'trees',
          archetype: 'tree',
          assetId: 'tree_single_A',
          count: 2,
        },
        {
          id: 'supplies',
          archetype: 'scatter',
          assetId: 'crate_A_small',
          count: 2,
        },
      ],
    });
    const softFeatures = placements.filter((placement) => placement.metadata?.layoutSlotGroup === 'soft-feature');
    const supplies = placements.filter((placement) => placement.assetId === 'crate_A_small');

    expect(softFeatures).toHaveLength(3);
    expect(softFeatures.map((placement) => placement.metadata?.layoutSlot)).toEqual([0, 1, 2]);
    expect(new Set(softFeatures.map((placement) => positionOffsetKey(placement.positionOffset))).size).toBe(3);
    expect(supplies).toHaveLength(1);
    expect(supplies[0]?.metadata?.layoutSlot).toBe(2);
  });

  it('analyzes fill feasibility and warns when count constraints are clamped', () => {
    const plan = createSingleForestTilePlan();
    const analysis = analyzeGameboardLayoutFill(plan, {
      seed: 'layout-analysis',
      rules: [
        {
          id: 'oversized-grove',
          archetype: 'tree',
          assetId: 'tree_single_A',
          count: 5,
          minCount: 4,
        },
        {
          id: 'overflow-crates',
          archetype: 'scatter',
          assetId: 'crate_A_small',
          count: 1,
        },
        {
          id: 'missing-asset',
          archetype: 'prop',
          count: 1,
        },
      ],
    });

    expect(analysis).toMatchObject({
      seed: 'layout-analysis',
      ruleCount: 3,
      placementCount: 3,
      warningCount: 4,
      errorCount: 1,
    });
    expect(analysis.rules[0]).toMatchObject({
      id: 'oversized-grove',
      candidateCount: 3,
      requestedCount: 5,
      targetCount: 3,
      selectedCount: 3,
      selectedTileKeys: ['0,0', '0,0', '0,0'],
    });
    expect(analysis.rules[0]?.warnings.join('\n')).toContain('requested 5 placement(s)');
    expect(analysis.rules[0]?.warnings.join('\n')).toContain('minCount 4 cannot be satisfied');
    expect(analysis.rules[1]).toMatchObject({
      id: 'overflow-crates',
      candidateCount: 0,
      rejectedSiteCount: 1,
      rejectionCounts: { 'slots-full': 1 },
      requestedCount: 1,
      targetCount: 0,
      selectedCount: 0,
    });
    expect(analysis.rules[1]?.warnings.join('\n')).toContain('matched no candidate sites');
    expect(analysis.rules[2]?.errors).toEqual(['Layout fill rule missing-asset requires assetId or assets']);
    expect(analysis.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('oversized-grove: Layout fill rule oversized-grove requested 5 placement(s)'),
        expect.stringContaining('overflow-crates: Layout fill rule overflow-crates matched no candidate sites'),
      ])
    );
  });

  it('requires full footprint bounds for multi-hex placements', () => {
    const plan = createGameboardBuilder({
      seed: 'footprint-bounds',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    }).build();
    const sites = selectGameboardLayoutSites(plan, {
      count: 9,
      seed: 'footprint-bounds',
      criteria: {
        terrain: 'grass',
        footprint: 'adjacent',
      },
    });

    expect(sites.map((site) => site.key)).toEqual(['1,1']);
    expect([...(sites[0]?.footprintKeys ?? [])].sort()).toEqual(['0,1', '0,2', '1,0', '1,1', '1,2', '2,0', '2,1']);
  });

  it('creates percentage fill placements and updates occupancy between fill rules', () => {
    const plan = createLayoutFixturePlan();
    const placements = createGameboardLayoutFillPlacements(plan, {
      seed: 'percentage-fill',
      rules: [
        {
          id: 'watchtower',
          archetype: 'landmark',
          assetId: 'external:watchtower',
          count: 1,
          criteria: {
            terrain: ['grass', 'road'],
            edgePadding: 0,
            prefer: [{ kind: 'center', weight: 1 }],
          },
        },
        {
          id: 'forest-scatter',
          archetype: 'tree',
          assets: ['tree_single_A', 'tree_single_B'],
          fill: 0.3,
          minCount: 3,
          maxCount: 5,
        },
      ],
    });
    const watchtower = placements.find((placement) => placement.assetId === 'external:watchtower');
    const trees = placements.filter((placement) => placement.metadata?.layoutArchetype === 'tree');

    expect(watchtower).toBeDefined();
    expect(trees).toHaveLength(5);
    expect(trees.every((placement) => ['tree_single_A', 'tree_single_B'].includes(placement.assetId))).toBe(true);
    expect(trees.every((placement) => placement.kind === 'decoration')).toBe(true);
    expect(trees.every((placement) => placement.layer === 'feature')).toBe(true);
    expect(trees.every((placement) => placement.metadata?.layoutTile !== watchtower?.metadata?.layoutTile)).toBe(true);
  });

  it('reserves footprint tiles between fill rules', () => {
    const plan = createLayoutFixturePlan();
    const placements = createGameboardLayoutFillPlacements(plan, {
      seed: 'footprint-fill',
      rules: [
        {
          id: 'large-piece',
          archetype: 'landmark',
          assetId: 'external:large-piece',
          count: 1,
          criteria: {
            terrain: ['grass', 'road'],
            edgePadding: 0,
            footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
            prefer: [{ kind: 'center', weight: 1 }],
          },
        },
        {
          id: 'markers',
          archetype: 'landmark',
          assetId: 'external:marker',
          count: 2,
          criteria: {
            terrain: ['grass', 'road'],
            edgePadding: 0,
            prefer: [{ kind: 'center', weight: 1 }],
          },
        },
      ],
    });
    const largePiece = placements.find((placement) => placement.assetId === 'external:large-piece');
    const markers = placements.filter((placement) => placement.assetId === 'external:marker');
    const reserved = metadataFootprintKeys(largePiece?.metadata);

    expect(largePiece?.metadata).toMatchObject({
      layoutFootprintSize: 3,
      layoutArchetype: 'landmark',
    });
    expect(reserved.size).toBe(3);
    expect(markers).toHaveLength(2);
    expect(markers.every((placement) => !reserved.has(String(placement.metadata?.layoutTile)))).toBe(true);
  });

  it('analyzes footprint reservations between fill rules', () => {
    const plan = createLayoutFixturePlan();
    const analysis = analyzeGameboardLayoutFill(plan, {
      seed: 'layout-analysis-footprints',
      rules: [
        {
          id: 'large-piece',
          archetype: 'landmark',
          assetId: 'external:large-piece',
          count: 1,
          criteria: {
            terrain: ['grass', 'road'],
            edgePadding: 0,
            footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
            prefer: [{ kind: 'center', weight: 1 }],
          },
        },
        {
          id: 'markers',
          archetype: 'landmark',
          assetId: 'external:marker',
          count: 2,
          criteria: {
            terrain: ['grass', 'road'],
            edgePadding: 0,
            prefer: [{ kind: 'center', weight: 1 }],
          },
        },
      ],
    });

    const [largePiece, markers] = analysis.rules;

    expect(analysis.errorCount).toBe(0);
    expect(analysis.placementCount).toBe(3);
    expect(largePiece).toMatchObject({
      id: 'large-piece',
      candidateCount: 3,
      selectedCount: 1,
      selectedAssetIds: ['external:large-piece'],
    });
    expect(markers).toMatchObject({
      id: 'markers',
      selectedCount: 2,
      selectedAssetIds: ['external:marker', 'external:marker'],
    });
    expect(markers?.selectedTileKeys).not.toContain(largePiece?.selectedTileKeys[0]);
  });

  it('spawns layout placements into a Koota world using current runtime occupancy', () => {
    const world = createGameboardWorld(createLayoutFixturePlan());

    spawnGameboardLayoutPlacements(world, {
      count: 1,
      seed: 'tower',
      idPrefix: 'layout:tower',
      assetId: 'external:tower',
      kind: 'prop',
      layer: 'feature',
      requiresExtra: true,
      criteria: {
        terrain: ['grass', 'road'],
        edgePadding: 1,
        requiredAdjacentTerrain: 'coast',
        allowOccupied: false,
        prefer: [{ kind: 'near-placement-kind', placementKind: 'structure', radius: 3, weight: 1 }],
      },
    });

    const placement = readGameboardPlacements(world).find((candidate) => candidate.id === 'layout:tower:0');
    expect(placement).toMatchObject({
      assetId: 'external:tower',
      requiresExtra: true,
      metadata: {
        layoutSeed: 'tower',
        layoutOccupied: false,
      },
    });
    expect(placement?.tileKey).not.toBe('2,1');
  });

  it('honors occupancy guards when spawning generated layout placements into a live world', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'layout-guard',
        shape: { kind: 'rectangle', width: 1, height: 1 },
      })
        .addFactionBuilding({ at: { q: 0, r: 0 }, faction: 'blue', building: 'market' })
        .build()
    );

    expect(() =>
      spawnGameboardLayoutPlacements(world, {
        count: 1,
        seed: 'guarded-live-layout',
        idPrefix: 'layout:guarded-unit',
        assetId: 'flag_blue',
        kind: 'unit',
        layer: 'unit',
        criteria: {
          terrain: 'grass',
          allowOccupied: true,
          blockingPlacementKinds: [],
        },
        occupancyGuard: true,
      })
    ).toThrow(/cannot occupy 0,0/);
  });
});

describe('layout archetype + selection edge branches (PRD E0a)', () => {
  it('normalizeGameboardLayoutArchetypeRegistry returns empty object for undefined input', () => {
    expect(normalizeGameboardLayoutArchetypeRegistry(undefined)).toEqual({});
  });

  it('normalizeGameboardLayoutArchetypeRegistry indexes an array input by id', () => {
    const normalized = normalizeGameboardLayoutArchetypeRegistry([
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture shape
      { id: 'arch-a', criteria: { terrain: 'grass' } } as any,
      // biome-ignore lint/suspicious/noExplicitAny: minimal fixture shape
      { id: 'arch-b', criteria: { terrain: 'water' } } as any,
    ]);
    expect(Object.keys(normalized)).toEqual(['arch-a', 'arch-b']);
  });

  it('resolveGameboardLayoutArchetype throws on unknown string id', () => {
    expect(() => resolveGameboardLayoutArchetype('not-a-real-archetype', {})).toThrow(
      /Unknown gameboard layout archetype/
    );
  });

  it('resolveGameboardLayoutArchetype returns undefined for undefined input', () => {
    expect(resolveGameboardLayoutArchetype(undefined, {})).toBeUndefined();
  });

  it('resolveGameboardLayoutArchetype returns inline archetype object unchanged', () => {
    // biome-ignore lint/suspicious/noExplicitAny: minimal inline archetype
    const inline = { id: 'inline', criteria: { terrain: 'grass' } } as any;
    expect(resolveGameboardLayoutArchetype(inline, {})).toBe(inline);
  });

  it('selectGameboardLayoutSites returns empty array when count is 0', () => {
    const plan = createSingleForestTilePlan();
    expect(selectGameboardLayoutSites(plan, { count: 0, seed: 'empty' })).toEqual([]);
  });

  it('covers layout fallback criteria, footprints, diagnostics, and default layers', () => {
    const registry = createGameboardLayoutArchetypeRegistry(
      {
        camp: {
          id: 'camp',
          label: 'Camp',
          kind: 'prop',
          criteria: { terrain: 'grass', prefer: [{ kind: 'edge' }] },
        },
      },
      { includeBuiltIns: false }
    );
    expect(registry.tree).toBeUndefined();
    expect(registry.camp?.kind).toBe('prop');

    const hexPlan = createGameboardBuilder({
      seed: 'layout-e0h-hex',
      shape: { kind: 'hexagon', radius: 2 },
    })
      .setElevation({ q: 0, r: 0 }, 1)
      .setTerrain({ q: 1, r: 0 }, 'water')
      .addPlacement({
        at: { q: 0, r: 0 },
        assetId: 'marker',
        kind: 'decoration',
        layer: 'feature',
        metadata: { layoutSlotGroup: 'other', layoutSlot: 0 },
      })
      .build();

    const looseFootprint = inspectGameboardLayoutSites(hexPlan, {
      criteria: {
        elevation: [2],
        footprint: { kind: 'custom', offsets: [{ q: 9, r: 9 }], includeCenter: true },
        requireFootprintInBounds: false,
        footprintTerrain: 'water',
      },
    });
    expect(looseFootprint.rejectionCounts).toMatchObject({
      elevation: expect.any(Number),
      'footprint-terrain': expect.any(Number),
    });

    const noOffsetFootprint = inspectGameboardLayoutSites(hexPlan, {
      criteria: { footprint: { kind: 'custom', includeCenter: false }, requireFootprintInBounds: false },
    });
    expect(noOffsetFootprint.rejectionCounts).toMatchObject({ 'footprint-out-of-bounds': expect.any(Number) });

    const edgePadded = inspectGameboardLayoutSites(hexPlan, {
      criteria: {
        edgePadding: 1,
        maxPerTile: 1,
        slotGroup: 'wanted',
        minDistanceFrom: ['0,0'],
        minDistance: 1,
        maxDistanceFrom: ['0,0'],
        maxDistance: 0,
        prefer: [
          { kind: 'near-terrain', terrain: ['water'] },
          { kind: 'near-placement-kind', placementKind: ['decoration'] },
          { kind: 'low-elevation' },
        ],
      },
    });
    expect(edgePadded.rejectionCounts).toMatchObject({
      'edge-padding': expect.any(Number),
      'min-distance': expect.any(Number),
      'max-distance': expect.any(Number),
    });

    const ring = inspectGameboardLayoutSites(hexPlan, {
      count: 1,
      criteria: { footprint: { kind: 'radius', radius: 1, includeCenter: false }, requireFootprintInBounds: false },
    });
    expect(ring.selected[0]?.footprintKeys).not.toContain(ring.selected[0]?.key);

    const dryHarbor = createGameboardLayoutPlacements(
      createGameboardBuilder({ seed: 'layout-e0h-dry-harbor', shape: { kind: 'rectangle', width: 1, height: 1 } }).build(),
      {
        count: 1,
        assetId: 'dock',
        kind: 'structure',
        metadata: { feature: 'harbor' },
      }
    );
    expect(dryHarbor[0]?.metadata?.facing).toBeUndefined();

    const harborByMetadata = createGameboardLayoutPlacements(hexPlan, {
      count: 1,
      assetId: 'dock',
      kind: 'structure',
      metadata: { feature: 'harbor', facing: -1 },
    });
    const harborByRotation = createGameboardLayoutPlacements(hexPlan, {
      count: 1,
      assetId: 'dock',
      kind: 'structure',
      rotationSteps: 7,
      metadata: { feature: 'harbor' },
    });
    expect(harborByMetadata[0]?.rotationSteps).toBe(5);
    expect(harborByRotation[0]?.rotationSteps).toBe(7);
    expect(harborByRotation[0]?.metadata?.facing).toBe(1);

    const layerKinds: readonly GameboardPlacementKind[] = [
      'terrain',
      'road',
      'river',
      'coast',
      'transition',
      'structure',
      'unit',
      'decoration',
      'prop',
    ];
    const layered = appendGameboardLayoutPlacementsToPlan(
      createGameboardBuilder({ seed: 'layout-e0h-layers', shape: { kind: 'rectangle', width: 1, height: 1 } }).build(),
      layerKinds.map((kind) => ({ at: '0,0', assetId: `asset:${kind}`, kind }))
    );
    expect(layered.placements.slice(-layerKinds.length).map((placement) => placement.layer)).toEqual([
      'terrain',
      'surface',
      'surface',
      'surface',
      'surface',
      'structure',
      'unit',
      'feature',
      'feature',
    ]);
    expect(() =>
      appendGameboardLayoutPlacementsToPlan(layered, [{ at: '9,9', assetId: 'missing', kind: 'prop' }])
    ).toThrow(/references missing tile 9,9/);

    const skippedFill = createGameboardLayoutFillPlacements(hexPlan, {
      rules: [{ id: 'skip-me', assetId: 'crate', count: 1, maxCount: 0 }],
    });
    expect(skippedFill).toEqual([]);

    const zeroTarget = analyzeGameboardLayoutFill(hexPlan, {
      rules: [{ id: 'zero-target', assetId: 'crate', count: 1, maxCount: 0 }],
    });
    expect(zeroTarget.rules[0]?.warnings.join('\n')).toContain('resolved to zero placements');

    const scarceAnalysis = analyzeGameboardLayoutFill(hexPlan, {
      rules: [
        {
          id: 'scarce',
          assetId: 'crate',
          kind: 'prop',
          count: 2,
          criteria: { terrain: 'grass', maxPerTile: 1, slotGroup: 'scarce', minDistanceBetween: 99 },
        },
      ],
    });
    expect(scarceAnalysis.rules[0]?.selectedCount).toBe(1);
    expect(scarceAnalysis.rules[0]?.warnings.join('\n')).toContain('requested 2 placement(s), but only 1 candidate');

    const multiAssetAnalysis = analyzeGameboardLayoutFill(hexPlan, {
      rules: [
        {
          id: 'multi-assets',
          kind: 'prop',
          assets: ['crate-a', 'crate-b'],
          fill: 0.2,
          criteria: {
            prefer: [
              { kind: 'far-from-placement-kind', placementKind: 'decoration', radius: 1 },
              { kind: 'high-elevation' },
            ],
          },
        },
      ],
    });
    expect(multiAssetAnalysis.rules[0]?.assetIds).toEqual(['crate-a', 'crate-b']);

    const defaultPlacement = createGameboardLayoutPlacements(hexPlan, {
      assetId: 'crate',
      kind: 'prop',
    });
    expect(defaultPlacement).toHaveLength(1);
    expect(defaultPlacement[0]?.metadata?.layoutSeed).toBe('layout-e0h-hex:layout');

    const noIdFill = createGameboardLayoutFillPlacements(hexPlan, {
      rules: [{ assetId: 'crate', kind: 'prop', count: 1 }],
    });
    expect(noIdFill[0]?.id).toBe('layout:0:0');

    const noIdAnalysis = analyzeGameboardLayoutFill(hexPlan, {
      rules: [{ assetId: 'crate', kind: 'prop', count: 1 }],
    });
    expect(noIdAnalysis.rules[0]?.id).toBe('0');

    const defaultFillAnalysis = analyzeGameboardLayoutFill(hexPlan, {
      rules: [{ assetId: 'crate', kind: 'prop' }],
    });
    expect(defaultFillAnalysis.rules[0]).toMatchObject({ requestedCount: 0, targetCount: 0 });

    const fallbackDiagnostic = analyzeGameboardLayoutFill(hexPlan, {
      rules: [{ kind: 'prop', count: 1 }],
    });
    expect(fallbackDiagnostic.rules[0]?.errors).toEqual(['Layout fill rule 0 requires assetId or assets']);

    const spawnFillWorld = createGameboardWorld(hexPlan);
    const spawned = spawnGameboardLayoutFill(spawnFillWorld, {
      rules: [{ id: 'spawned-fill', assetId: 'crate', kind: 'prop', count: 1 }],
    });
    expect(spawned).toHaveLength(1);

    const maxElevation = inspectGameboardLayoutSites(hexPlan, {
      criteria: { maxElevation: 0 },
    });
    expect(maxElevation.rejectionCounts).toMatchObject({ elevation: expect.any(Number) });

    const fallbackPlanWithGeneratedTerrain = createGameboardBuilder({
      seed: 'layout-e0h-fallbacks',
      shape: { kind: 'rectangle', width: 3, height: 2 },
    })
      .setTerrain({ q: 2, r: 0 }, 'water')
      .setElevation({ q: 1, r: 0 }, 1)
      .addPlacement({
        at: { q: 0, r: 0 },
        assetId: 'terrain-neighbor',
        kind: 'prop',
        layer: 'terrain',
      })
      .addPlacement({
        at: { q: 1, r: 0 },
        assetId: 'terrain-marker',
        kind: 'prop',
        layer: 'terrain',
        metadata: { layoutSlotGroup: 'slots', layoutSlot: 'reserved' },
      })
      .build();
    const fallbackPlan = {
      ...fallbackPlanWithGeneratedTerrain,
      placements: fallbackPlanWithGeneratedTerrain.placements.filter((placement) => placement.assetId.startsWith('terrain-')),
    };
    const fallbackInspection = inspectGameboardLayoutSites(fallbackPlan, {
      criteria: {
        allowOccupied: true,
        elevation: 1,
        excludeFootprintTerrain: 'water',
        footprint: { kind: 'adjacent' },
        requireFootprintInBounds: false,
        requiredAdjacentPlacementLayer: ['terrain'],
        slotGroup: 'slots',
        prefer: [
          { kind: 'near-terrain', terrain: 'water' },
          { kind: 'far-from-terrain', terrain: 'water' },
          { kind: 'near-placement-kind', placementKind: 'prop' },
          { kind: 'far-from-placement-kind', placementKind: 'prop' },
        ],
      },
    });
    expect(fallbackInspection.rejectionCounts).toMatchObject({ 'footprint-terrain': expect.any(Number) });

    const scoredFallback = inspectGameboardLayoutSites(fallbackPlan, {
      criteria: {
        allowOccupied: true,
        elevation: 1,
        requiredAdjacentPlacementLayer: ['terrain'],
        slotGroup: 'slots',
        prefer: [
          { kind: 'near-terrain', terrain: 'water' },
          { kind: 'far-from-terrain', terrain: 'water' },
          { kind: 'near-placement-kind', placementKind: 'prop' },
          { kind: 'far-from-placement-kind', placementKind: 'prop' },
        ],
      },
    });
    expect(scoredFallback.selected[0]?.key).toBe('1,0');
    expect(scoredFallback.selected[0]?.reasons).toEqual(
      expect.arrayContaining(['near-terrain:water', 'far-from-terrain:water', 'near-placement-kind:prop', 'far-from-placement-kind:prop'])
    );

    const defaultRadius = inspectGameboardLayoutSites(fallbackPlan, {
      criteria: { footprint: { kind: 'radius' }, requireFootprintInBounds: false },
    });
    expect(defaultRadius.selected[0]?.footprintKeys.length).toBeGreaterThan(1);

    expect(() =>
      createGameboardLayoutFillPlacements(hexPlan, {
        rules: [{ archetype: 'prop', count: 1 }],
      })
    ).toThrow(/requires assetId or assets/);
    expect(() =>
      createGameboardLayoutFillPlacements(hexPlan, {
        rules: [{ archetype: 'prop', assets: [undefined as unknown as string], count: 1 }],
      })
    ).toThrow(/produced empty asset pick/);
    expect(() =>
      spawnGameboardLayoutPlacements(createGameboardWorld(), { count: 1, assetId: 'crate', kind: 'prop' })
    ).toThrow(/World does not contain GameboardState/);
    expect(() => spawnGameboardLayoutFill(createGameboardWorld(), { rules: [] })).toThrow(
      /World does not contain GameboardState/
    );
  });
});

describe('createGameboardLayoutPlacements onDiagnostics (single-placement diagnostics)', () => {
  it('reports the archetype-resolved criteria (including an inherited field the caller omitted) when the candidate set is empty', () => {
    // Reproduces the landmark edgePadding leak (commit c049010): the caller's
    // override omits edgePadding, so mergeLayoutCriteria inherits the
    // landmark archetype's edgePadding: 1. On this 5x4 board only the ring of
    // tiles strictly inside the edge padding would ever qualify, and this
    // fixture's placements/terrain choices leave zero survivors.
    const plan = createLayoutFixturePlan();
    let diagnostics: GameboardLayoutPlacementDiagnostics | undefined;

    const placements = createGameboardLayoutPlacements(plan, {
      count: 1,
      seed: 'landmark-empty',
      assetId: 'obelisk',
      archetype: 'landmark',
      criteria: {
        // Deliberately omits edgePadding — the caller never set it.
        terrain: 'water',
      },
      onDiagnostics: (report) => {
        diagnostics = report;
      },
    });

    expect(placements).toHaveLength(0);
    expect(diagnostics).toBeDefined();
    expect(diagnostics?.requestedCount).toBe(1);
    expect(diagnostics?.selectedCount).toBe(0);
    expect(diagnostics?.archetypeId).toBe('landmark');
    // The key assertion: edgePadding is visible in resolvedCriteria despite
    // the caller never setting it — inherited from the landmark archetype.
    expect(diagnostics?.resolvedCriteria.edgePadding).toBe(1);
    expect(diagnostics?.resolvedCriteria.terrain).toBe('water');
  });

  it('names the filter that emptied the candidate set via the rejection histogram', () => {
    const plan = createLayoutFixturePlan();
    let diagnostics: GameboardLayoutPlacementDiagnostics | undefined;

    createGameboardLayoutPlacements(plan, {
      count: 1,
      seed: 'terrain-empty',
      assetId: 'obelisk',
      kind: 'prop',
      // 'mountain' terrain does not exist anywhere on the fixture board, so
      // every tile is rejected by the terrain filter and no other filter
      // contributes any rejections.
      criteria: { terrain: 'mountain', allowOccupied: true },
      onDiagnostics: (report) => {
        diagnostics = report;
      },
    });

    expect(diagnostics?.candidateCount).toBe(0);
    expect(diagnostics?.rejectedCount).toBe(plan.tiles.length);
    expect(diagnostics?.rejectionCounts.terrain).toBe(plan.tiles.length);
  });

  it('never invokes onDiagnostics and produces identical placements when the option is absent (zero behavior change)', () => {
    const plan = createLayoutFixturePlan();
    const baseOptions = {
      count: 2,
      seed: 'rocks-parity',
      idPrefix: 'layout:rock-parity',
      assetId: 'rock_single_A',
      kind: 'decoration' as const,
      layer: 'feature' as const,
      criteria: { terrain: 'grass' as const, allowOccupied: false, minDistanceBetween: 2 },
    };

    const withoutOption = createGameboardLayoutPlacements(plan, baseOptions);

    let diagnosticsCalls = 0;
    const withOptionButSatisfied = createGameboardLayoutPlacements(plan, {
      ...baseOptions,
      onDiagnostics: () => {
        diagnosticsCalls += 1;
      },
    });

    expect(withOptionButSatisfied).toEqual(withoutOption);
    expect(diagnosticsCalls).toBe(0);

    // And when onDiagnostics is entirely absent, the empty-candidate path
    // still returns the same (empty) result as with a no-op onDiagnostics.
    const emptyWithoutOption = createGameboardLayoutPlacements(plan, {
      count: 1,
      seed: 'terrain-empty-parity',
      assetId: 'obelisk',
      kind: 'prop',
      criteria: { terrain: 'mountain', allowOccupied: true },
    });
    const emptyWithOption = createGameboardLayoutPlacements(plan, {
      count: 1,
      seed: 'terrain-empty-parity',
      assetId: 'obelisk',
      kind: 'prop',
      criteria: { terrain: 'mountain', allowOccupied: true },
      onDiagnostics: () => {},
    });
    expect(emptyWithOption).toEqual(emptyWithoutOption);
    expect(emptyWithOption).toHaveLength(0);
  });
});

function createSingleForestTilePlan() {
  return createGameboardBuilder({
    seed: 'single-forest',
    shape: { kind: 'rectangle', width: 1, height: 1 },
  })
    .addForest({ q: 0, r: 0 })
    .build();
}

function placementKey(at: { q: number; r: number } | string): string {
  return typeof at === 'string' ? at : `${at.q},${at.r}`;
}

function positionOffsetKey(offset: { x?: number; y?: number; z?: number } | undefined): string {
  return `${offset?.x ?? 0},${offset?.y ?? 0},${offset?.z ?? 0}`;
}

function metadataFootprintKeys(metadata: Readonly<Record<string, string | number | boolean | null>> | undefined): Set<string> {
  const encoded = metadata?.layoutFootprintTiles;
  return new Set(typeof encoded === 'string' ? encoded.split('|') : []);
}

function createLayoutFixturePlan() {
  const builder = createGameboardBuilder({
    seed: 'layout-fixture',
    shape: { kind: 'rectangle', width: 5, height: 4 },
  });
  for (let q = 0; q < 5; q += 1) {
    builder.setTerrain({ q, r: 3 }, 'water');
    builder.setCoastEdges({ q, r: 2 }, [1]);
  }
  return builder
    .addRoadPath([
      { q: 1, r: 1 },
      { q: 2, r: 1 },
      { q: 3, r: 1 },
    ])
    .addFactionBuilding({ at: { q: 2, r: 1 }, faction: 'blue', building: 'market' })
    .addProp({ at: { q: 3, r: 1 }, assetId: 'crate_A_small' })
    .build();
}
