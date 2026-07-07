import { describe, expect, it } from 'vitest';
import { KAYKIT_HEX_GEOMETRY } from '../../coordinates/grid';
import { createGameboardBuilder } from '../../gameboard';
import { createGameboardInteropSnapshot } from '../../interop';
import { freeManifest } from '../../manifest/free';
import {
  analyzeHexTileRegistry,
  analyzeTileGeometry,
  applyTileDeclaration,
  createHexTileRegistry,
  createHexTileRegistryFromManifest,
} from '../../scenario/registry';

describe('tile registry and ECS interop', () => {
  it('builds declarations from the FREE manifest with inferred adjacency channels', () => {
    const registry = createHexTileRegistryFromManifest(freeManifest);

    expect(registry.byAssetId.hex_grass?.role).toBe('base');
    expect(registry.byAssetId.hex_road_A?.edges).toMatchObject([{ channel: 'road', mask: 0b001001 }]);
    expect(registry.byAssetId.hex_river_A_waterless?.edges).toMatchObject([{ channel: 'river', mask: 0b001001 }]);
    expect(registry.byAssetId.hex_coast_A?.edges).toMatchObject([{ channel: 'coast', mask: 0b000001 }]);
  });

  it('analyzes tile bounds and warns on suspicious custom geometry', () => {
    const registry = createHexTileRegistry([
      {
        id: 'custom_hex_lava',
        assetId: 'custom_hex_lava',
        role: 'base',
        terrain: 'lava',
        bounds: {
          min: [-3, 0, -1],
          max: [1, 0.5, 1],
          size: [4, 0.5, 2],
        },
      },
    ]);
    const analysis = analyzeHexTileRegistry(registry);
    const customTile = registry.byId.custom_hex_lava;
    if (customTile === undefined) {
      throw new Error('custom_hex_lava tile missing from registry');
    }
    const tile = analyzeTileGeometry(customTile);
    const zOffsetTile = analyzeTileGeometry({
      id: 'custom_hex_offset_z',
      assetId: 'custom_hex_offset_z',
      role: 'base',
      geometry: KAYKIT_HEX_GEOMETRY,
      bounds: {
        min: [-1, 0, -1],
        max: [1, 0.5, 3],
        size: [2, 0.5, 4],
      },
    });

    expect(analysis.analyzedCount).toBe(1);
    expect(tile.recommendedScale).toBeGreaterThan(0);
    expect(tile.warnings.some((warning) => warning.includes('ratio'))).toBe(true);
    expect(tile.warnings.some((warning) => warning.includes('off-center'))).toBe(true);
    expect(zOffsetTile.warnings.some((warning) => warning.includes('Z origin is offset'))).toBe(true);
  });

  it('keeps inferred terrain undefined for neutral manifest tiles', () => {
    const source = freeManifest.assets.find((asset) => asset.id === 'hex_grass');
    if (source === undefined) {
      throw new Error('hex_grass fixture missing from FREE manifest');
    }
    const registry = createHexTileRegistryFromManifest({
      ...freeManifest,
      assets: [
        {
          ...source,
          id: 'hex_sand',
          family: 'hex_sand',
          modelPath: 'assets/free/tiles/base/hex_sand.gltf',
          sourcePath: 'tiles/base/hex_sand.gltf',
        },
      ],
    } as typeof freeManifest);

    expect(registry.byAssetId.hex_sand?.role).toBe('base');
    expect(registry.byAssetId.hex_sand?.terrain).toBeUndefined();
  });

  it('normalizes declaration defaults and analyzes custom/support footprint roles', () => {
    const registry = createHexTileRegistry([
      {
        id: 'custom_hex_default_asset',
        bounds: { min: [-1, 0, -1], max: [1, 0.5, 1], size: [2, 0.5, 2] },
      },
      {
        id: 'custom_support_stack',
        role: 'support',
        bounds: { min: [-1, 0, -1], max: [1, 0.5, 1], size: [2, 0.5, 2] },
      },
    ]);

    const defaultAsset = registry.byId.custom_hex_default_asset;
    if (defaultAsset === undefined) {
      throw new Error('custom_hex_default_asset declaration missing from registry');
    }

    expect(defaultAsset).toMatchObject({
      assetId: 'custom_hex_default_asset',
      source: 'custom',
      role: 'custom',
    });
    expect(analyzeTileGeometry(defaultAsset).warnings.some((warning) => warning.includes('ratio'))).toBe(true);
    expect(analyzeHexTileRegistry(registry).analyzedCount).toBe(2);
  });

  it('applies registered custom base tiles and exposes neutral ECS records', () => {
    const registry = createHexTileRegistry([
      {
        id: 'custom_hex_lava',
        assetId: 'custom_hex_lava',
        role: 'base',
        terrain: 'lava',
        tags: ['hot', 'blocks-water'],
      },
      {
        id: 'custom_lava_bridge',
        assetId: 'custom_lava_bridge',
        role: 'road',
        edges: { road: [0, 3] },
      },
    ]);
    const builder = createGameboardBuilder({ seed: 'custom', shape: { kind: 'rectangle', width: 3, height: 2 } });
    applyTileDeclaration(builder, registry, { at: { q: 1, r: 0 }, declaration: 'custom_hex_lava' });
    applyTileDeclaration(builder, registry, { at: { q: 1, r: 0 }, declaration: 'custom_lava_bridge' });
    const plan = builder.build();
    const tile = plan.tiles.find((candidate) => candidate.key === '1,0');
    const snapshot = createGameboardInteropSnapshot(plan, {
      spawnLocations: { count: 2, seed: 'interop', minDistance: 1 },
    });

    expect(tile).toMatchObject({ terrain: 'lava', baseAssetId: 'custom_hex_lava' });
    expect(tile?.tags).toContain('hot');
    expect(plan.placements.some((placement) => placement.assetId === 'custom_lava_bridge')).toBe(true);
    expect(snapshot.entities.some((entity) => entity.kind === 'tile' && entity.id === 'tile:1,0')).toBe(true);
    expect(snapshot.adjacency.length).toBeGreaterThan(0);
    expect(snapshot.spawnLocations).toHaveLength(2);
  });

  it('kindForDeclaration covers river/coast/structure/unit/decoration roles (E0b)', () => {
    // Covers registry.ts lines 552/554/556 (kindForDeclaration switch arms).
    const registry = createHexTileRegistry([
      { id: 'r1', assetId: 'r1', role: 'river' },
      { id: 'c1', assetId: 'c1', role: 'coast' },
      { id: 's1', assetId: 's1', role: 'structure' },
      { id: 'u1', assetId: 'u1', role: 'unit' },
      { id: 'd1', assetId: 'd1', role: 'decoration' },
      { id: 'x1', assetId: 'x1', role: 'custom' },
    ]);
    const builder = createGameboardBuilder({
      seed: 'role-kinds',
      shape: { kind: 'rectangle', width: 7, height: 1 },
    });
    const decoration = registry.byId.d1;
    if (decoration === undefined) {
      throw new Error('d1 declaration missing from registry');
    }
    applyTileDeclaration(builder, registry, { at: { q: 0, r: 0 }, declaration: 'r1' });
    applyTileDeclaration(builder, registry, { at: { q: 1, r: 0 }, declaration: 'c1' });
    applyTileDeclaration(builder, registry, { at: { q: 2, r: 0 }, declaration: 's1' });
    applyTileDeclaration(builder, registry, { at: { q: 3, r: 0 }, declaration: 'u1' });
    applyTileDeclaration(builder, registry, { at: { q: 4, r: 0 }, declaration: 'd1' });
    applyTileDeclaration(builder, registry, { at: { q: 5, r: 0 }, declaration: decoration });
    applyTileDeclaration(builder, registry, { at: { q: 6, r: 0 }, declaration: 'x1' });
    const plan = builder.build();
    const kinds = plan.placements.map((p) => p.kind);
    expect(kinds).toContain('river');
    expect(kinds).toContain('coast');
    expect(kinds).toContain('structure');
    expect(kinds).toContain('terrain');
    expect(kinds.filter((kind) => kind === 'decoration')).toHaveLength(2);
  });

  it('analyzeHexTileRegistry warns on no tile-sized declarations + width/depth variance (E0b)', () => {
    // Covers registry.ts lines 378-380 (empty scale set) + 385+388 (variance warnings).
    const emptyRegistry = createHexTileRegistry([]);
    expect(
      analyzeHexTileRegistry(emptyRegistry).warnings.some((w) => w.includes('No tile-sized'))
    ).toBe(true);

    const varianceRegistry = createHexTileRegistry([
      {
        id: 'tile-a',
        assetId: 'tile-a',
        role: 'base',
        terrain: 'grass',
        bounds: { min: [-1, 0, -1], max: [1, 0.5, 1], size: [2, 0.5, 2] },
      },
      {
        id: 'tile-b',
        assetId: 'tile-b',
        role: 'base',
        terrain: 'grass',
        bounds: { min: [-3, 0, -3], max: [3, 0.5, 3], size: [6, 0.5, 6] },
      },
    ]);
    const analysis = analyzeHexTileRegistry(varianceRegistry);
    expect(analysis.warnings.some((w) => w.includes('width variance'))).toBe(true);
    expect(analysis.warnings.some((w) => w.includes('depth variance'))).toBe(true);
  });

  it('applyTileDeclaration throws on unknown declaration id (E0b)', () => {
    const registry = createHexTileRegistry([]);
    const builder = createGameboardBuilder({
      seed: 'unknown-decl',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    expect(() =>
      applyTileDeclaration(builder, registry, {
        at: { q: 0, r: 0 },
        declaration: 'not-a-real-decl',
      })
    ).toThrow(/Unknown tile declaration/);
  });

  it('analyzeTileGeometry returns empty analysis when bounds metadata missing (E0b)', () => {
    const analysis = analyzeTileGeometry({
      id: 'no-bounds',
      assetId: 'asset-no-bounds',
      geometry: KAYKIT_HEX_GEOMETRY,
    });
    expect(analysis.warnings.some((warning) => warning.includes('Missing bounds metadata'))).toBe(true);
  });

  it('analyzeTileGeometry warns on non-positive width or depth (E0b)', () => {
    const analysis = analyzeTileGeometry({
      id: 'zero-bounds',
      assetId: 'asset-zero-bounds',
      geometry: KAYKIT_HEX_GEOMETRY,
      bounds: { min: [0, 0, 0], max: [0, 1, 0], size: [0, 1, 0] },
    });
    expect(analysis.warnings.some((warning) => warning.includes('non-positive width or depth'))).toBe(true);
  });

  it('warns on duplicate ids + duplicate assetIds (E0b)', () => {
    const registry = createHexTileRegistry([
      { id: 'tile-a', assetId: 'asset-a' },
      { id: 'tile-a', assetId: 'asset-b' },
      { id: 'tile-c', assetId: 'asset-a' },
    ]);
    expect(
      registry.warnings.some((warning) => warning.includes('Duplicate tile declaration id'))
    ).toBe(true);
    expect(
      registry.warnings.some((warning) => warning.includes('Duplicate tile declaration assetId'))
    ).toBe(true);
  });

  it('rotates built-in edge masks when applying registered base tile declarations', () => {
    const registry = createHexTileRegistry([
      {
        id: 'custom_hex_road',
        assetId: 'custom_hex_road',
        role: 'base',
        terrain: 'road',
        edges: { road: [0] },
      },
    ]);
    const builder = createGameboardBuilder({ seed: 'rotated-base-edge', shape: { kind: 'rectangle', width: 2, height: 1 } });
    applyTileDeclaration(builder, registry, {
      at: { q: 0, r: 0 },
      declaration: 'custom_hex_road',
      rotationSteps: 3,
    });
    const tile = builder.build().tiles.find((candidate) => candidate.key === '0,0');

    expect(tile?.roadEdges).toBe(1 << 3);
  });

});
