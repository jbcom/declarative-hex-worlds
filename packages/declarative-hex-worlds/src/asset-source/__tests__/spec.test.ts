/**
 * Contract for the source-agnostic, Zod-validated AssetSourceSpec (RFC 0001 G0).
 *
 * The spec is the canonical vocabulary any asset source (KayKit FREE/premium,
 * a tileset pack, a sprite pack, a model pack, or a mix) normalizes into. A
 * source is valid iff it `parse`s against this schema — bad data fails fast at
 * the boundary with a precise Zod error, not deep in rendering.
 */
import { describe, expect, it } from 'vitest';
import {
  ASSET_FORMATS,
  ASSET_ROLES,
  type AssetSourceSpec,
  assetSourceSpecSchema,
  parseAssetSourceSpec,
  safeParseAssetSourceSpec,
} from '../spec';

/** A minimal valid spec covering every asset role. */
function validSpec(): AssetSourceSpec {
  return {
    specVersion: 1,
    name: 'test-source',
    assetRoot: 'public/assets',
    assets: [
      // A 3D-model hex tile (tiles/ accepts png OR glb/gltf).
      { id: 'hex_grass', role: 'tile', format: 'glb', path: 'tiles/hex_grass.glb', biome: 'grass' },
      // A 2D-image hex tile.
      { id: 'hex_water', role: 'tile', format: 'png', path: 'tiles/hex_water.png', biome: 'water' },
      // A sprite-sheet tileset (png sheet + grid).
      {
        id: 'grassland',
        role: 'tileset',
        format: 'png',
        path: 'tilesets/grassland.png',
        grid: { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 },
      },
      // An individual sprite (png).
      { id: 'warrior', role: 'sprite', format: 'png', path: 'sprites/warrior.png' },
      // A 3D model (glb/gltf).
      { id: 'castle', role: 'model', format: 'gltf', path: 'models/castle.gltf' },
    ],
  };
}

describe('AssetSourceSpec schema (G0)', () => {
  it('exposes the closed sets of roles and formats', () => {
    expect([...ASSET_ROLES].sort()).toEqual(['model', 'sprite', 'tile', 'tileset']);
    expect([...ASSET_FORMATS].sort()).toEqual(['glb', 'gltf', 'png']);
  });

  it('parses a valid spec covering every role', () => {
    const spec = validSpec();
    const parsed = parseAssetSourceSpec(spec);
    expect(parsed.assets).toHaveLength(5);
    expect(parsed.name).toBe('test-source');
    expect(assetSourceSpecSchema.parse(spec)).toEqual(parsed);
  });

  it('safeParse reports success for a valid spec and failure for garbage', () => {
    expect(safeParseAssetSourceSpec(validSpec()).success).toBe(true);
    const bad = safeParseAssetSourceSpec({ nope: true });
    expect(bad.success).toBe(false);
  });

  it('rejects a tileset without grid metadata (grid is required for tilesets)', () => {
    const spec = validSpec();
    const tileset = spec.assets.find((a) => a.role === 'tileset');
    if (tileset && tileset.role === 'tileset') {
      // biome-ignore lint/suspicious/noExplicitAny: intentionally break the shape
      delete (tileset as any).grid;
    }
    const result = safeParseAssetSourceSpec(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      // The Zod error must point at the tileset's grid, not a vague top-level error.
      expect(JSON.stringify(result.error.issues)).toMatch(/grid/);
    }
  });

  it('rejects an invalid format (e.g. a sprite as glb — sprites are png)', () => {
    const spec = validSpec();
    const sprite = spec.assets.find((a) => a.role === 'sprite');
    if (sprite) {
      // biome-ignore lint/suspicious/noExplicitAny: intentionally break the shape
      (sprite as any).format = 'glb';
    }
    expect(safeParseAssetSourceSpec(spec).success).toBe(false);
  });

  it('rejects a model with a png format (models are glb/gltf)', () => {
    const spec = validSpec();
    const model = spec.assets.find((a) => a.role === 'model');
    if (model) {
      // biome-ignore lint/suspicious/noExplicitAny: intentionally break the shape
      (model as any).format = 'png';
    }
    expect(safeParseAssetSourceSpec(spec).success).toBe(false);
  });

  it('accepts a tile as either png or glb/gltf (tiles are format-flexible)', () => {
    for (const format of ['png', 'glb', 'gltf'] as const) {
      const spec: AssetSourceSpec = {
        specVersion: 1,
        name: 's',
        assetRoot: 'a',
        assets: [{ id: 't', role: 'tile', format, path: `tiles/t.${format}`, biome: 'grass' }],
      };
      expect(safeParseAssetSourceSpec(spec).success).toBe(true);
    }
  });

  it('rejects a duplicate asset id (ids must be unique within a source)', () => {
    const spec = validSpec();
    const firstId = spec.assets[0]?.id ?? 'hex_grass';
    // Duplicate the first asset's id on a fresh valid tile asset.
    spec.assets.push({
      id: firstId,
      role: 'tile',
      format: 'png',
      path: 'tiles/dup.png',
      biome: 'grass',
    });
    const result = safeParseAssetSourceSpec(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(/duplicate|unique/i);
    }
  });

  it('parseAssetSourceSpec throws a precise error for invalid input', () => {
    expect(() => parseAssetSourceSpec({ specVersion: 1 })).toThrow();
  });
});
