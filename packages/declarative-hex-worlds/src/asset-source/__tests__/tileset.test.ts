import { describe, expect, it } from 'vitest';
import type { GameboardPlacementSpec } from '../../gameboard';
import { cellRect, createTilesetSource, readTintOpacity, tilesetHexGeometry } from '../tileset';
import type { TilesetManifest } from '../tileset-manifest';

const manifest: TilesetManifest = {
  schemaVersion: '1',
  kind: 'tileset',
  sheets: {
    grassland: {
      url: 'tiles/grassland.png',
      grid: { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 },
      role: 'fill',
      variants: [0, 1, 2, 3, 4],
    },
    plains: {
      url: 'tiles/plains.png',
      grid: { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 },
      role: 'fill',
    },
    coast: {
      url: 'tiles/coast.png',
      grid: { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 },
      role: 'transition',
      edgeCells: { '1': 0, '3': 6, '7': 12 },
    },
  },
  biomes: {
    grass: { sheet: 'grassland', select: 'hash' },
    field: { sheet: 'plains', select: 'first' },
    water: { sheet: 'coast', select: 'first' },
  },
};

function placement(input: {
  tileKey?: string;
  assetId: string;
  metadata?: GameboardPlacementSpec['metadata'];
}): GameboardPlacementSpec {
  return {
    id: `placement:${input.assetId}`,
    tileKey: input.tileKey ?? '0,0',
    coordinates: { q: 0, r: 0 },
    position: { x: 0, y: 0, z: 0 },
    assetId: input.assetId,
    kind: 'prop',
    layer: 'feature',
    textureSet: 'default',
    elevation: 0,
    elevationOffset: 0,
    rotationSteps: 0,
    rotationRadians: 0,
    scale: 1,
    order: 0,
    requiresExtra: false,
    metadata: input.metadata ?? {},
  };
}

describe('cellRect', () => {
  it('computes the row-major pixel rect of a cell index', () => {
    const grid = { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 };
    expect(cellRect(grid, 0)).toEqual({ x: 0, y: 0, width: 96, height: 83 });
    expect(cellRect(grid, 4)).toEqual({ x: 384, y: 0, width: 96, height: 83 });
    expect(cellRect(grid, 5)).toEqual({ x: 0, y: 83, width: 96, height: 83 });
    expect(cellRect(grid, 12)).toEqual({ x: 192, y: 166, width: 96, height: 83 });
  });
});

describe('readTintOpacity', () => {
  it('reads a full tint when all three channels are finite numbers', () => {
    expect(readTintOpacity({ tintR: 0.5, tintG: 0.6, tintB: 0.7 })).toEqual({
      tint: { r: 0.5, g: 0.6, b: 0.7 },
    });
  });

  it('omits the tint when any channel is missing', () => {
    expect(readTintOpacity({ tintR: 0.5, tintG: 0.6 })).toEqual({});
    expect(readTintOpacity({ tintG: 0.6, tintB: 0.7 })).toEqual({});
    expect(readTintOpacity({ tintR: 0.5, tintB: 0.7 })).toEqual({});
  });

  it('omits the tint when a channel is a non-number or non-finite', () => {
    expect(readTintOpacity({ tintR: 0.5, tintG: 'x', tintB: 0.7 })).toEqual({});
    expect(readTintOpacity({ tintR: 0.5, tintG: 0.6, tintB: Number.NaN })).toEqual({});
    expect(readTintOpacity({ tintR: Number.POSITIVE_INFINITY, tintG: 0.6, tintB: 0.7 })).toEqual(
      {}
    );
  });

  it('reads opacity when it is a finite number in [0, 1]', () => {
    expect(readTintOpacity({ opacity: 0.4 })).toEqual({ opacity: 0.4 });
    expect(readTintOpacity({ opacity: 0 })).toEqual({ opacity: 0 });
    expect(readTintOpacity({ opacity: 1 })).toEqual({ opacity: 1 });
  });

  it('omits opacity when out of range, non-finite, or not a number', () => {
    expect(readTintOpacity({ opacity: -0.1 })).toEqual({});
    expect(readTintOpacity({ opacity: 1.5 })).toEqual({});
    expect(readTintOpacity({ opacity: Number.NaN })).toEqual({});
    expect(readTintOpacity({ opacity: '0.5' })).toEqual({});
  });

  it('reads tint and opacity together', () => {
    expect(readTintOpacity({ tintR: 1, tintG: 1, tintB: 1, opacity: 0.25 })).toEqual({
      tint: { r: 1, g: 1, b: 1 },
      opacity: 0.25,
    });
  });

  it('returns an empty object for empty metadata', () => {
    expect(readTintOpacity({})).toEqual({});
  });
});

describe('tileset AssetSource', () => {
  it('identifies its kind and satisfies the contract', () => {
    const source = createTilesetSource({ manifest });
    expect(source.kind).toBe('tileset');
    expect(typeof source.resolve).toBe('function');
    expect(typeof source.resolveEdge).toBe('function');
  });

  it('resolves a biome via assetId to a fill tileset-cell request', () => {
    const source = createTilesetSource({ manifest });
    const request = source.resolve(placement({ assetId: 'grass', tileKey: '2,3' }));
    expect(request?.type).toBe('tileset-cell');
    if (request?.type === 'tileset-cell') {
      expect(request.dimension).toBe('2d'); // tileset cells are 2D-first (RFC0-RENDER)
      expect(request.sheetUrl).toBe('tiles/grassland.png');
      expect(request.cell.width).toBe(96);
      // Quad footprint = board hex width (2) × overlap (1.3) so cutout hexes
      // overlap into seamless terrain, with height keeping the CELL ASPECT
      // (width · 83/96) so the foreshortened painterly hex isn't distorted — NOT
      // the old unit hex (gaps), NOT the regular-hex depth 2.3094 (squishes the art).
      const expectedWidth = 2 * 1.3;
      expect(request.hex.width).toBeCloseTo(expectedWidth);
      expect(request.hex.height).toBeCloseTo((expectedWidth * 83) / 96);
      // Defaults to the 'quad' shape (full cell drawn) for seamless painterly terrain.
      expect(request.shape).toBe('quad');
    }
  });

  it('emits shape:"hex" when the source is created with shape:"hex"', () => {
    const source = createTilesetSource({ manifest, shape: 'hex' });
    const request = source.resolve(placement({ assetId: 'grass', tileKey: '2,3' }));
    expect(request?.type === 'tileset-cell' && request.shape).toBe('hex');
  });

  it('picks the same fill cell for the same tileKey (deterministic hash)', () => {
    const source = createTilesetSource({ manifest });
    const a = source.resolve(placement({ assetId: 'grass', tileKey: '4,7' }));
    const b = source.resolve(placement({ assetId: 'grass', tileKey: '4,7' }));
    expect(a).toEqual(b);
  });

  it('select:first always uses the first usable cell', () => {
    const source = createTilesetSource({ manifest });
    const request = source.resolve(placement({ assetId: 'field', tileKey: '9,9' }));
    if (request?.type === 'tileset-cell') {
      expect(request.cell).toEqual({ x: 0, y: 0, width: 96, height: 83 });
    }
  });

  it('prefers a metadata biome hint over the assetId', () => {
    const source = createTilesetSource({ manifest });
    const request = source.resolve(placement({ assetId: 'ignored', metadata: { biome: 'field' } }));
    expect(request?.type).toBe('tileset-cell');
    if (request?.type === 'tileset-cell') {
      expect(request.sheetUrl).toBe('tiles/plains.png');
    }
  });

  it('returns undefined for an unknown biome', () => {
    const source = createTilesetSource({ manifest });
    expect(source.resolve(placement({ assetId: 'lava' }))).toBeUndefined();
  });

  it('returns undefined when a biome points at a missing sheet (defensive)', () => {
    // A hand-constructed manifest that skips schema validation: the biome
    // references a sheet that isn't declared. resolve() must degrade, not throw.
    const brokenManifest = {
      schemaVersion: '1',
      kind: 'tileset',
      sheets: {},
      biomes: { grass: { sheet: 'ghost', select: 'hash' } },
    } as unknown as TilesetManifest;
    const source = createTilesetSource({ manifest: brokenManifest });
    expect(source.resolve(placement({ assetId: 'grass' }))).toBeUndefined();
  });

  it('falls back to all grid cells when a fill sheet has an empty variants list', () => {
    // An empty variants array is treated as "no explicit subset" → every cell is
    // usable, so resolution still yields a valid cell (never undefined).
    const emptyVariants = {
      schemaVersion: '1',
      kind: 'tileset',
      sheets: {
        barren: {
          url: 'tiles/barren.png',
          grid: { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 },
          role: 'fill',
          variants: [],
        },
      },
      biomes: { waste: { sheet: 'barren', select: 'hash' } },
    } as unknown as TilesetManifest;
    const source = createTilesetSource({ manifest: emptyVariants });
    const request = source.resolve(placement({ assetId: 'waste' }));
    expect(request?.type).toBe('tileset-cell');
  });

  it('resolves an edge mask to a transition cell', () => {
    const source = createTilesetSource({ manifest });
    const request = source.resolveEdge?.('water', 3);
    expect(request?.type).toBe('tileset-cell');
    if (request?.type === 'tileset-cell') {
      // edgeCells['3'] === 6 → col 1, row 1 → x=96, y=83
      expect(request.cell).toEqual({ x: 96, y: 83, width: 96, height: 83 });
    }
  });

  it('resolveEdge returns undefined for a non-transition biome', () => {
    const source = createTilesetSource({ manifest });
    expect(source.resolveEdge?.('grass', 1)).toBeUndefined();
  });

  it('resolveEdge returns undefined for an unmapped edge mask', () => {
    const source = createTilesetSource({ manifest });
    expect(source.resolveEdge?.('water', 99)).toBeUndefined();
  });

  it('resolveEdge returns undefined for an unknown biome', () => {
    const source = createTilesetSource({ manifest });
    expect(source.resolveEdge?.('nope', 1)).toBeUndefined();
  });

  it('resolves sheet urls against a ResolveContext baseUrl', () => {
    const source = createTilesetSource({ manifest });
    const request = source.resolve(placement({ assetId: 'grass' }), {
      baseUrl: 'https://cdn.example.com/assets/',
    });
    if (request?.type === 'tileset-cell') {
      expect(request.sheetUrl).toBe('https://cdn.example.com/assets/tiles/grassland.png');
    }
  });

  it('honors an explicit hex dims override', () => {
    const source = createTilesetSource({ manifest, hex: { width: 2, height: 2 } });
    const request = source.resolve(placement({ assetId: 'grass' }));
    if (request?.type === 'tileset-cell') {
      expect(request.hex).toEqual({ width: 2, height: 2 });
    }
  });

  it('threads placement tint + opacity metadata onto the resolved request', () => {
    const source = createTilesetSource({ manifest });
    const request = source.resolve(
      placement({
        assetId: 'grass',
        metadata: { tintR: 0.5, tintG: 0.5, tintB: 0.5, opacity: 0.3 },
      })
    );
    if (request?.type === 'tileset-cell') {
      expect(request.tint).toEqual({ r: 0.5, g: 0.5, b: 0.5 });
      expect(request.opacity).toBe(0.3);
    }
  });

  it('omits tint + opacity when the placement has no shading metadata', () => {
    const source = createTilesetSource({ manifest });
    const request = source.resolve(placement({ assetId: 'grass' }));
    if (request?.type === 'tileset-cell') {
      expect(request.tint).toBeUndefined();
      expect(request.opacity).toBeUndefined();
    }
  });

  it('does not apply tint/opacity on the resolveEdge (no-placement) path', () => {
    const source = createTilesetSource({ manifest });
    const request = source.resolveEdge?.('water', 3);
    if (request?.type === 'tileset-cell') {
      expect(request.tint).toBeUndefined();
      expect(request.opacity).toBeUndefined();
    }
  });
});

describe('tilesetHexGeometry', () => {
  it('derives foreshortened row spacing from the first sheet cell aspect', () => {
    const geom = tilesetHexGeometry(manifest);
    // width stays the board default; depth = (2/3) · (width · cellH/cellW) so that
    // rowSpacing = 1.5·(depth/2) = height/2, the interlock spacing.
    expect(geom.width).toBeCloseTo(2);
    expect(geom.depth).toBeCloseTo((2 / 3) * ((2 * 83) / 96));
    expect(geom.elevationStep).toBe(1);
  });

  it('honours an explicit grid override', () => {
    const geom = tilesetHexGeometry(manifest, { cols: 1, rows: 1, cellWidth: 64, cellHeight: 64 });
    // square cell → depth = (2/3)·(width·1) = (2/3)·2
    expect(geom.depth).toBeCloseTo((2 / 3) * 2);
  });

  it('falls back to the regular-hex depth when the manifest has no sheets', () => {
    const empty: TilesetManifest = { schemaVersion: '1', kind: 'tileset', sheets: {}, biomes: {} };
    const geom = tilesetHexGeometry(empty);
    expect(geom.depth).toBeCloseTo(2.3094);
  });
});
