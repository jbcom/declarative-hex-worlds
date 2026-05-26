import { describe, expect, it } from 'vitest';
import { analyzeExternalAssetCompatibility } from '../../src/interop/compatibility';
import { createGameboardBuilder } from '../../src/gameboard/index';
import { createGameboardLayoutArchetypeRegistry, createGameboardLayoutFillPlacements } from '../../src/coordinates/layout';
import {
  analyzeGameboardPieceRegistry,
  createGameboardLayoutFillRuleFromPieces,
  createGameboardLayoutFillRuleFromPiece,
  createGameboardLayoutFillRulesFromRegistry,
  createGameboardLayoutPlacementsFromPiece,
  createGameboardLayoutPlacementOptionsFromPiece,
  createGameboardPieceRegistry,
  createGameboardPieceRegistryFromCompatibilityReports,
  createGameboardPieceSourceUrlMap,
  declareGameboardPieceFromCompatibility,
  declareGameboardPiecesFromCompatibilityReports,
  declareGameboardPiece,
  inspectGameboardPiecePlacement,
  resolveGameboardPieceSourceUrl,
  selectGameboardPieces,
} from '../../src/pieces/index';

describe('gameboard piece declarations', () => {
  it('normalizes custom pieces and reports duplicate registry entries', () => {
    const registry = createGameboardPieceRegistry([
      {
        id: 'kenney-round-tower',
        assetId: 'kenney:castle-kit/round-tower',
        source: 'Kenney Castle Kit',
        role: 'landmark',
        scale: 0.72,
        footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
        criteria: { terrain: ['grass', 'road'] },
        metadata: { creator: 'Kenney' },
      },
      {
        id: 'kenney-round-tower',
        assetId: 'kenney:castle-kit/round-tower',
      },
    ]);

    expect(registry.warnings).toEqual([
      'Duplicate gameboard piece id: kenney-round-tower',
      'Duplicate gameboard piece assetId: kenney:castle-kit/round-tower',
    ]);
    expect(registry.byId['kenney-round-tower']).toMatchObject({
      id: 'kenney-round-tower',
      assetId: 'kenney:castle-kit/round-tower',
      label: 'Kenney Round Tower',
      role: 'landmark',
      archetype: 'landmark',
      requiresExtra: false,
    });
    expect(registry.pieces[0]?.criteria.footprint).toEqual({ kind: 'adjacent', edges: [0, 1], includeCenter: true });
    expect(registry.pieces[0]?.metadata).toEqual({ creator: 'Kenney' });
  });

  it('creates fill rules from declared pieces with metadata and footprint reservations', () => {
    const plan = createPieceFixturePlan();
    const tower = declareGameboardPiece({
      id: 'kenney-round-tower',
      assetId: 'kenney:castle-kit/round-tower',
      source: 'Kenney Castle Kit',
      role: 'landmark',
      footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
      criteria: {
        terrain: ['grass', 'road'],
        edgePadding: 0,
        prefer: [{ kind: 'center', weight: 1 }],
      },
      scale: 0.8,
      metadata: { creator: 'Kenney' },
    });
    const rule = createGameboardLayoutFillRuleFromPiece(tower, {
      count: 1,
      occupancyGuard: true,
      metadata: { scene: 'unit-test' },
    });
    const [placement] = createGameboardLayoutFillPlacements(plan, {
      seed: 'piece-fill',
      rules: [rule],
    });

    expect(rule).toMatchObject({
      id: 'kenney-round-tower',
      assetId: 'kenney:castle-kit/round-tower',
      archetype: 'landmark',
      count: 1,
      scale: 0.8,
      requiresExtra: true,
      occupancyGuard: true,
      metadata: {
        creator: 'Kenney',
        scene: 'unit-test',
        pieceId: 'kenney-round-tower',
        pieceRole: 'landmark',
        pieceSource: 'Kenney Castle Kit',
      },
    });
    expect(placement).toMatchObject({
      assetId: 'kenney:castle-kit/round-tower',
      scale: 0.8,
      requiresExtra: true,
      occupancyGuard: true,
      metadata: {
        layoutArchetype: 'landmark',
        layoutFootprintSize: 3,
        pieceId: 'kenney-round-tower',
        pieceRole: 'landmark',
        pieceSource: 'Kenney Castle Kit',
      },
    });
    expect(String(placement?.metadata?.layoutFootprintTiles).split('|')).toHaveLength(3);
  });

  it('lets declared pieces reference custom layout archetypes by id', () => {
    const plan = createPieceFixturePlan();
    const archetypes = createGameboardLayoutArchetypeRegistry({
      'camp-supply': {
        id: 'camp-supply',
        label: 'Camp Supply',
        kind: 'prop',
        layer: 'feature',
        criteria: {
          terrain: ['grass', 'road'],
          allowOccupied: true,
          maxPerTile: 2,
          slotGroup: 'camp-supply',
        },
        metadata: { registeredArchetype: 'camp-supply' },
      },
    });
    const supply = declareGameboardPiece({
      id: 'kenney-camp-crate',
      assetId: 'kenney:camp-crate',
      source: 'Kenney Castle Kit',
      role: 'custom',
      archetype: 'camp-supply',
      criteria: { prefer: [{ kind: 'center', weight: 1 }] },
    });
    const [placement] = createGameboardLayoutFillPlacements(plan, {
      seed: 'piece-custom-archetype',
      rules: [
        createGameboardLayoutFillRuleFromPiece(supply, {
          count: 1,
          archetypes,
          idPrefix: 'layout:camp-crate',
        }),
      ],
    });

    expect(placement).toMatchObject({
      assetId: 'kenney:camp-crate',
      kind: 'prop',
      layer: 'feature',
      metadata: {
        layoutArchetype: 'camp-supply',
        registeredArchetype: 'camp-supply',
        pieceId: 'kenney-camp-crate',
      },
    });
  });

  it('creates single placement options from declared actor pieces', () => {
    const knight = declareGameboardPiece({
      id: 'kaykit-adventurer-knight',
      assetId: 'kaykit-adventurers:knight',
      source: 'KayKit Adventurers',
      role: 'unit',
      criteria: { terrain: ['grass', 'road'], prefer: [{ kind: 'near-placement-kind', placementKind: 'structure' }] },
      rotationSteps: 'random',
      tags: ['npc', 'quest-giver'],
    });
    const options = createGameboardLayoutPlacementOptionsFromPiece(knight, {
      count: 1,
      seed: 'knight-placement',
      idPrefix: 'npc:knight',
      occupancyGuard: { requireUnblocked: true },
      metadata: { faction: 'blue' },
    });

    expect(options).toMatchObject({
      assetId: 'kaykit-adventurers:knight',
      archetype: 'unit',
      count: 1,
      seed: 'knight-placement',
      idPrefix: 'npc:knight',
      rotationSteps: 'random',
      requiresExtra: true,
      occupancyGuard: { requireUnblocked: true },
      metadata: {
        faction: 'blue',
        pieceId: 'kaykit-adventurer-knight',
        pieceRole: 'unit',
        pieceSource: 'KayKit Adventurers',
      },
    });
    expect(knight.tags).toEqual(['npc', 'quest-giver']);
  });

  it('inspects and creates placements directly from a declared piece', () => {
    const builder = createGameboardBuilder({
      seed: 'piece-placement-inspection',
      shape: { kind: 'rectangle', width: 4, height: 3 },
    });
    for (let q = 0; q < 4; q += 1) {
      builder.setTerrain({ q, r: 2 }, 'water');
      builder.setCoastEdges({ q, r: 1 }, [1]);
    }
    const plan = builder
      .addFactionBuilding({ at: { q: 1, r: 1 }, faction: 'blue', building: 'market' })
      .build();
    const dock = declareGameboardPiece({
      id: 'local-shipyard',
      assetId: 'local:shipyard',
      source: 'Local Harbor Pack',
      role: 'harbor',
      metadata: { creator: 'local-fixture' },
    });

    const inspection = inspectGameboardPiecePlacement(plan, dock, {
      count: 2,
      seed: 'piece-shipyards',
      idPrefix: 'local:shipyard',
    });
    const placements = createGameboardLayoutPlacementsFromPiece(plan, dock, {
      count: 2,
      seed: 'piece-shipyards',
      idPrefix: 'local:shipyard',
    });

    expect(inspection).toMatchObject({
      pieceId: 'local-shipyard',
      assetId: 'local:shipyard',
      role: 'harbor',
      source: 'Local Harbor Pack',
      siteInspection: {
        selectedCount: 2,
        candidateCount: 3,
        rejectionCounts: {
          terrain: 8,
          occupied: 1,
        },
      },
    });
    expect(inspection.placements).toEqual(placements);
    expect(placements).toHaveLength(2);
    expect(placements.every((placement) => placement.kind === 'structure')).toBe(true);
    expect(placements.every((placement) => placement.metadata?.pieceId === 'local-shipyard')).toBe(true);
    expect(placements.every((placement) => placement.metadata?.creator === 'local-fixture')).toBe(true);
    expect(placements.every((placement) => placement.requiresExtra === true)).toBe(true);
  });

  it('infers docks and shipyards as harbor pieces', () => {
    const direct = declareGameboardPiece({
      id: 'local-shipyard',
      assetId: 'local:shipyard',
      source: 'Local Harbor Pack',
    });
    const report = analyzeExternalAssetCompatibility({
      id: 'building_docks_blue',
      sourcePack: 'KayKit Medieval Hexagon EXTRA',
      intendedRole: 'structure',
      bounds: {
        min: [-0.35, 0, -0.35],
        max: [0.35, 0.8, 0.35],
        size: [0.7, 0.8, 0.7],
      },
    });
    const fromCompatibility = declareGameboardPieceFromCompatibility(report);

    expect(direct).toMatchObject({
      role: 'harbor',
      archetype: 'harbor',
      requiresExtra: true,
    });
    expect(fromCompatibility).toMatchObject({
      role: 'harbor',
      archetype: 'harbor',
      kind: 'structure',
      layer: 'structure',
      requiresExtra: true,
    });
  });

  it('declares custom pieces directly from compatibility reports', () => {
    const report = analyzeExternalAssetCompatibility({
      id: 'kenney:tower-hexagon-base',
      sourcePack: 'Kenney Castle Kit',
      bounds: {
        min: [-0.45, 0, -0.3897],
        max: [0.45, 1.31, 0.3897],
        size: [0.9, 1.31, 0.7794],
      },
      intendedRole: 'tile',
    });
    const piece = declareGameboardPieceFromCompatibility(report, {
      tags: ['castle', 'landmark'],
      criteria: { terrain: ['grass', 'road'] },
    });

    expect(piece).toMatchObject({
      id: 'kenney:tower-hexagon-base',
      assetId: 'kenney:tower-hexagon-base',
      source: 'Kenney Castle Kit',
      role: 'landmark',
      archetype: 'landmark',
      kind: 'prop',
      layer: 'feature',
      scale: 1,
      elevationOffset: 0.04,
      requiresExtra: true,
      tags: ['castle', 'landmark'],
      metadata: {
        externalAsset: true,
        suggestedRole: 'prop',
        footprint: 'rectangle',
        boardForwardEdge: 1,
      },
    });
    expect(piece.criteria.terrain).toEqual(['grass', 'road']);
  });

  it('declares batch piece registries from compatibility reports', () => {
    const reports = [
      analyzeExternalAssetCompatibility({
        id: 'tower-hexagon-base',
        sourcePack: 'Kenney Castle Kit',
        bounds: {
          min: [-0.45, 0, -0.3897],
          max: [0.45, 1.31, 0.3897],
          size: [0.9, 1.31, 0.7794],
        },
        intendedRole: 'tile',
      }),
      analyzeExternalAssetCompatibility({
        id: 'tree-large',
        sourcePack: 'Kenney Castle Kit',
        bounds: {
          min: [-0.2, 0, -0.2],
          max: [0.2, 1.5, 0.2],
          size: [0.4, 1.5, 0.4],
        },
        intendedRole: 'prop',
      }),
    ];

    const pieces = declareGameboardPiecesFromCompatibilityReports(reports, {
      pieceIdPrefix: 'kenney-castle',
      assetIdPrefix: 'kenney',
      tags: ['local-pack'],
      overrides: {
        'tower-hexagon-base': {
          footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
          criteria: { terrain: ['grass', 'road'], edgePadding: 1 },
          metadata: { placementPreset: 'castle-tower' },
        },
        'tree-large': {
          criteria: { maxPerTile: 3, slotGroup: 'soft-feature' },
          tags: ['forest'],
        },
      },
    });
    const registry = createGameboardPieceRegistryFromCompatibilityReports(reports, {
      pieceIdPrefix: 'kenney-castle',
      assetIdPrefix: 'kenney',
      tags: ['local-pack'],
      overrides: {
        'tower-hexagon-base': {
          footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
          criteria: { terrain: ['grass', 'road'], edgePadding: 1 },
          metadata: { placementPreset: 'castle-tower' },
        },
      },
    });

    expect(pieces.map((piece) => [piece.id, piece.assetId, piece.role])).toEqual([
      ['kenney-castle:tower-hexagon-base', 'kenney:tower-hexagon-base', 'landmark'],
      ['kenney-castle:tree-large', 'kenney:tree-large', 'tree'],
    ]);
    expect(pieces.every((piece) => piece.requiresExtra)).toBe(true);
    expect(pieces.every((piece) => piece.tags.includes('local-pack'))).toBe(true);
    expect(pieces[0]?.criteria).toMatchObject({
      footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
      terrain: ['grass', 'road'],
      edgePadding: 1,
    });
    expect(pieces[0]?.metadata).toMatchObject({ placementPreset: 'castle-tower' });
    expect(pieces[1]?.criteria).toMatchObject({ maxPerTile: 3, slotGroup: 'soft-feature' });
    expect(pieces[1]?.tags).toEqual(['local-pack', 'forest']);
    expect(registry.byAssetId['kenney:tower-hexagon-base']?.metadata).toMatchObject({
      externalAsset: true,
      suggestedRole: 'prop',
      placementPreset: 'castle-tower',
    });
  });

  it('selects registered pieces by role, source, tags, and local asset state', () => {
    const registry = createGameboardPieceRegistry([
      {
        id: 'kenney-large-tree',
        assetId: 'kenney:tree-large',
        source: 'Kenney Castle Kit',
        role: 'tree',
        tags: ['forest', 'scatter'],
      },
      {
        id: 'kenney-small-tree',
        assetId: 'kenney:tree-small',
        source: 'Kenney Castle Kit',
        role: 'tree',
        tags: ['forest', 'scatter'],
      },
      {
        id: 'kaykit-free-tree',
        assetId: 'tree_single_A',
        source: 'KayKit Medieval Hexagon FREE',
        role: 'tree',
        requiresExtra: false,
        tags: ['forest', 'free'],
      },
      {
        id: 'kaykit-knight',
        assetId: 'adventurer:knight',
        source: 'KayKit Adventurers',
        role: 'unit',
        tags: ['npc'],
      },
    ]);

    const selected = selectGameboardPieces(registry, {
      roles: ['tree'],
      sources: ['Kenney Castle Kit'],
      tags: ['forest'],
      requiresExtra: true,
    });
    const rules = createGameboardLayoutFillRulesFromRegistry(registry, {
      selection: { roles: ['tree'], sources: ['Kenney Castle Kit'] },
      ruleIdPrefix: 'forest-pack',
      fill: 0.12,
      maxCount: 2,
      metadata: { biome: 'forest' },
    });

    expect(selected.map((piece) => piece.id)).toEqual(['kenney-large-tree', 'kenney-small-tree']);
    expect(rules.map((rule) => rule.id)).toEqual(['forest-pack:kenney-large-tree', 'forest-pack:kenney-small-tree']);
    expect(rules.every((rule) => rule.archetype === 'tree')).toBe(true);
    expect(rules.every((rule) => rule.requiresExtra === true)).toBe(true);
    expect(rules[0]).toMatchObject({
      fill: 0.12,
      maxCount: 2,
      idPrefix: 'layout:kenney-large-tree',
      metadata: {
        biome: 'forest',
        pieceId: 'kenney-large-tree',
        pieceSource: 'Kenney Castle Kit',
      },
    });
  });

  it('analyzes registries and flags invalid piece pools', () => {
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
        assetId: 'kenney:tower',
        source: 'Kenney Castle Kit',
        role: 'landmark',
        tags: ['castle'],
      },
    ]);
    const analysis = analyzeGameboardPieceRegistry(registry, {
      checks: [
        { id: 'forest-pool', mode: 'pool', selection: { roles: ['tree'], tags: ['forest'] } },
        { id: 'mixed-pool', mode: 'pool', selection: { sources: ['Kenney Castle Kit'] } },
        { id: 'missing-selection', selection: { roles: ['unit'] } },
      ],
    });

    expect(analysis).toMatchObject({
      pieceCount: 3,
      localOnlyCount: 3,
      roleCounts: { tree: 2, landmark: 1 },
      sourceCounts: { 'Kenney Castle Kit': 3 },
      tagCounts: { forest: 2, castle: 1 },
    });
    expect(analysis.checks.map((check) => [check.id, check.selectedCount])).toEqual([
      ['forest-pool', 2],
      ['mixed-pool', 3],
      ['missing-selection', 0],
    ]);
    expect(analysis.errors).toContain(
      'Piece registry check mixed-pool cannot pool pieces with different archetype, kind, or layer'
    );
    expect(analysis.warnings).toContain('Piece registry check missing-selection matched no pieces');
  });

  it('creates collection fill rules for same-role variant pools', () => {
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
    ]);
    const trees = selectGameboardPieces(registry, { roles: ['tree'], tags: ['forest'] });
    const rule = createGameboardLayoutFillRuleFromPieces(trees, {
      id: 'kenney-forest-pool',
      fill: 0.3,
      minCount: 2,
      occupancyGuard: true,
      metadata: { pool: 'forest' },
    });

    expect(rule).toMatchObject({
      id: 'kenney-forest-pool',
      assets: ['kenney:tree-large', 'kenney:tree-small'],
      archetype: 'tree',
      fill: 0.3,
      minCount: 2,
      rotationSteps: 'random',
      requiresExtra: true,
      occupancyGuard: true,
      metadata: {
        pool: 'forest',
        pieceIds: 'kenney-large-tree|kenney-small-tree',
        pieceRoles: 'tree',
        pieceSources: 'Kenney Castle Kit',
        pieceCollectionSize: 2,
      },
    });
  });

  it('resolves local source URLs from piece metadata and source roots', () => {
    const registry = createGameboardPieceRegistry([
      {
        id: 'kenney-round-tower',
        assetId: 'kenney:tower round',
        source: 'Kenney Castle Kit',
        role: 'landmark',
        metadata: { sourceRelativePath: 'towers/tower round.glb' },
      },
      {
        id: 'adventurer-knight',
        assetId: 'adventurer:knight',
        source: 'KayKit Adventurers',
        role: 'unit',
        metadata: { sourceUrl: '/assets/adventurer/Knight.glb' },
      },
      {
        id: 'missing-source',
        assetId: 'missing-source',
        role: 'prop',
      },
    ]);

    expect(resolveGameboardPieceSourceUrl(registry.byId['kenney-round-tower'], {
      sourceRoots: { 'Kenney Castle Kit': '/@fs/references/Kenney Castle Kit' },
    })).toBe('/@fs/references/Kenney Castle Kit/towers/tower%20round.glb');
    expect(resolveGameboardPieceSourceUrl(registry.byId['kenney-round-tower'], {
      sourceRoot: '/assets/local',
      encode: false,
    })).toBe('/assets/local/towers/tower round.glb');

    const urls = createGameboardPieceSourceUrlMap(registry, {
      sourceRoots: { 'Kenney Castle Kit': '/@fs/references/Kenney Castle Kit' },
    });

    expect(urls).toEqual({
      'kenney:tower round': '/@fs/references/Kenney Castle Kit/towers/tower%20round.glb',
      'adventurer:knight': '/assets/adventurer/Knight.glb',
    });
  });
});

function createPieceFixturePlan() {
  return createGameboardBuilder({
    seed: 'piece-layout',
    shape: { kind: 'rectangle', width: 5, height: 4 },
  })
    .addFactionBuilding({ at: { q: 2, r: 1 }, faction: 'blue', building: 'market' })
    .build();
}
