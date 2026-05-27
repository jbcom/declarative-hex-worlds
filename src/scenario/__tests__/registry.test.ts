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

    expect(analysis.analyzedCount).toBe(1);
    expect(tile.recommendedScale).toBeGreaterThan(0);
    expect(tile.warnings.some((warning) => warning.includes('ratio'))).toBe(true);
    expect(tile.warnings.some((warning) => warning.includes('off-center'))).toBe(true);
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
