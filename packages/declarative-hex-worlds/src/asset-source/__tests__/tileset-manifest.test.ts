import { describe, expect, it } from 'vitest';
import {
  type TilesetManifest,
  parseTilesetManifest,
  safeParseTilesetManifest,
} from '../tileset-manifest';

const validManifest: TilesetManifest = {
  schemaVersion: '1',
  kind: 'tileset',
  sheets: {
    grassland: {
      url: 'tiles/grassland.png',
      grid: { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 },
      role: 'fill',
      variants: [0, 1, 2, 3, 4],
    },
    coast: {
      url: 'tiles/coast.png',
      grid: { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 },
      role: 'transition',
      edgeCells: { '1': 0, '3': 5, '7': 10, '15': 15, '31': 20 },
    },
  },
  biomes: {
    grass: { sheet: 'grassland', select: 'hash' },
    water: { sheet: 'coast', select: 'first' },
  },
};

describe('TilesetManifest schema', () => {
  it('parses a valid tileset manifest (fill + transition sheets)', () => {
    const parsed = parseTilesetManifest(validManifest);
    expect(parsed.kind).toBe('tileset');
    expect(Object.keys(parsed.sheets)).toEqual(['grassland', 'coast']);
    expect(parsed.sheets.coast?.role).toBe('transition');
    expect(parsed.biomes.grass?.select).toBe('hash');
  });

  it('rejects a transition sheet with no edgeCells map', () => {
    const result = safeParseTilesetManifest({
      ...validManifest,
      sheets: {
        coast: {
          url: 'tiles/coast.png',
          grid: { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 },
          role: 'transition',
        },
      },
      biomes: { water: { sheet: 'coast', select: 'first' } },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /edgeCells/.test(i.message))).toBe(true);
    }
  });

  it('rejects a cell index outside the grid', () => {
    const result = safeParseTilesetManifest({
      ...validManifest,
      sheets: {
        grassland: {
          url: 'tiles/grassland.png',
          grid: { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 }, // 50 cells → max index 49
          role: 'fill',
          variants: [0, 50], // 50 is out of range
        },
      },
      biomes: { grass: { sheet: 'grassland', select: 'hash' } },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /out of range/.test(i.message))).toBe(true);
    }
  });

  it('rejects a transition edgeCell index outside the grid', () => {
    const result = safeParseTilesetManifest({
      ...validManifest,
      sheets: {
        coast: {
          url: 'tiles/coast.png',
          grid: { cols: 2, rows: 2, cellWidth: 96, cellHeight: 83 }, // 4 cells → max index 3
          role: 'transition',
          edgeCells: { '1': 99 }, // out of range
        },
      },
      biomes: { water: { sheet: 'coast', select: 'first' } },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /out of range/.test(i.message))).toBe(true);
    }
  });

  it('rejects a biome referencing an unknown sheet', () => {
    const result = safeParseTilesetManifest({
      ...validManifest,
      biomes: { grass: { sheet: 'nonexistent', select: 'hash' } },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /unknown sheet/.test(i.message))).toBe(true);
    }
  });

  it('rejects an empty sheets map', () => {
    const result = safeParseTilesetManifest({
      schemaVersion: '1',
      kind: 'tileset',
      sheets: {},
      biomes: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /at least one sheet/.test(i.message))).toBe(true);
    }
  });

  it('rejects a wrong kind discriminant', () => {
    const result = safeParseTilesetManifest({ ...validManifest, kind: 'gltf-pack' });
    expect(result.success).toBe(false);
  });

  it('accepts a fill sheet without explicit variants (all cells usable)', () => {
    const parsed = parseTilesetManifest({
      schemaVersion: '1',
      kind: 'tileset',
      sheets: {
        desert: {
          url: 'tiles/desert.png',
          grid: { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 },
          role: 'fill',
        },
      },
      biomes: { sand: { sheet: 'desert', select: 'hash' } },
    });
    expect(parsed.sheets.desert?.variants).toBeUndefined();
  });
});
