import { describe, expect, it, vi } from 'vitest';
import type { AssetSource } from '../../asset-source';
import type { GameboardPlacementSpec } from '../../gameboard';
import { syncCanvas2dPlacements } from '../canvas2d';

/** Minimal placement spec factory for the 2D binding tests. */
function placement(
  id: string,
  assetId: string,
  position: { x: number; y: number; z: number }
): GameboardPlacementSpec {
  return {
    id,
    tileKey: `${position.x},${position.z}`,
    coordinates: { q: position.x, r: position.z },
    position,
    assetId,
    kind: 'prop',
    layer: 'feature',
    textureSet: 'default',
    elevation: position.y,
    elevationOffset: 0,
    rotationSteps: 0,
    rotationRadians: 0,
    scale: 1,
    order: 0,
    requiresExtra: false,
    metadata: {},
  };
}

/** A tileset source that resolves every placement to a 2D tileset-cell request. */
const tilesetSource: AssetSource = {
  kind: 'tileset',
  resolve(p) {
    return {
      type: 'tileset-cell',
      dimension: '2d',
      sheetUrl: '/sheet.png',
      cell: { x: 0, y: 0, width: 64, height: 64 },
      hex: { width: 1, height: 1 },
      transform: { position: p.position, rotationY: 0, scale: p.scale },
    };
  },
};

/** A 3D-only source: resolves to a gltf request the 2D binding cannot draw. */
const gltfSource: AssetSource = {
  kind: 'gltf-pack',
  resolve(p) {
    return { type: 'gltf', dimension: '3d', url: `/${p.assetId}.glb` };
  },
};

/**
 * A source distinguishing the FILL cell (via resolve) from a positional TRANSITION
 * cell (via resolveEdge). Lets a test assert the binding takes the edge path when a
 * placement carries a non-zero edgeMask.
 */
const FILL_CELL = { x: 0, y: 0, width: 64, height: 64 };
const EDGE_CELL = { x: 128, y: 64, width: 64, height: 64 };
const transitionSource: AssetSource = {
  kind: 'tileset',
  resolve(p) {
    return {
      type: 'tileset-cell',
      dimension: '2d',
      sheetUrl: '/sheet.png',
      cell: FILL_CELL,
      hex: { width: 1, height: 1 },
      transform: { position: p.position, rotationY: 0, scale: p.scale },
    };
  },
  resolveEdge(_assetId, _edgeMask) {
    return {
      type: 'tileset-cell',
      dimension: '2d',
      sheetUrl: '/sheet.png',
      cell: EDGE_CELL,
      hex: { width: 1, height: 1 },
    };
  },
};

/** A fake 2D context recording drawImage calls. */
function fakeContext(
  width = 400,
  height = 300
): {
  ctx: CanvasRenderingContext2D;
  calls: unknown[][];
} {
  const calls: unknown[][] = [];
  const ctx = {
    canvas: { width, height },
    drawImage: (...args: unknown[]) => {
      calls.push(args);
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const sheets = new Map<string, CanvasImageSource>([['/sheet.png', {} as CanvasImageSource]]);

describe('canvas-2D renderer binding (substrate-agnostic proof)', () => {
  it('draws each 2D placement as a sprite blit from the tileset sheet', () => {
    const { ctx, calls } = fakeContext();
    const placements = [
      placement('p:a', 'grass', { x: 0, y: 0, z: 0 }),
      placement('p:b', 'tree', { x: 1, y: 0, z: 1 }),
    ];
    const result = syncCanvas2dPlacements(ctx, placements, { source: tilesetSource, sheets });

    expect(result.drawn).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(calls).toHaveLength(2);
    // drawImage(sheet, sx, sy, sw, sh, dx, dy, dw, dh) — source cell is the tileset rect.
    expect(calls[0]?.slice(1, 5)).toEqual([0, 0, 64, 64]);
  });

  it('maps world x/z to canvas pixels around the viewport origin', () => {
    const { ctx } = fakeContext(400, 300);
    const [drawn] = syncCanvas2dPlacements(ctx, [placement('p:c', 'grass', { x: 2, y: 0, z: 0 })], {
      source: tilesetSource,
      sheets,
      viewport: { pixelsPerUnit: 32 },
    }).drawn;
    // origin defaults to canvas center (200,150); x=2 → 200 + 2*32 - destW/2.
    const destW = 1 * 32; // hex.width * ppu * scale
    expect(drawn?.dest.x).toBeCloseTo(200 + 2 * 32 - destW / 2);
    expect(drawn?.dest.y).toBeCloseTo(150 + 0 - destW / 2);
  });

  it('draws back-to-front by board depth (z then elevation) so overlap sorts', () => {
    const { ctx } = fakeContext();
    const result = syncCanvas2dPlacements(
      ctx,
      [
        placement('p:front', 'a', { x: 0, y: 0, z: 5 }),
        placement('p:back', 'b', { x: 0, y: 0, z: 1 }),
      ],
      { source: tilesetSource, sheets }
    );
    // Back (z=1) drawn first, front (z=5) last.
    expect(result.drawn.map((d) => d.placementId)).toEqual(['p:back', 'p:front']);
  });

  it('breaks depth ties by elevation (same z → lower y drawn first)', () => {
    const { ctx } = fakeContext();
    const result = syncCanvas2dPlacements(
      ctx,
      [
        placement('p:high', 'a', { x: 0, y: 2, z: 3 }),
        placement('p:low', 'b', { x: 0, y: 0, z: 3 }),
      ],
      { source: tilesetSource, sheets }
    );
    // Same z=3; lower elevation (y=0) draws first, higher (y=2) on top.
    expect(result.drawn.map((d) => d.placementId)).toEqual(['p:low', 'p:high']);
  });

  it('skips non-2D placements — a 2D surface renders the 2D slice of the world', () => {
    const { ctx, calls } = fakeContext();
    const result = syncCanvas2dPlacements(
      ctx,
      [placement('p:model', 'castle', { x: 0, y: 0, z: 0 })],
      { source: gltfSource, sheets }
    );
    expect(result.drawn).toHaveLength(0);
    expect(result.skipped).toEqual(['p:model']);
    expect(calls).toHaveLength(0);
  });

  it('falls back to placement position/scale when the request carries no transform', () => {
    const { ctx } = fakeContext(400, 300);
    // Source omits transform → the binding uses the placement's own position/scale.
    const noTransformSource: AssetSource = {
      kind: 'tileset',
      resolve() {
        return {
          type: 'tileset-cell',
          dimension: '2d',
          sheetUrl: '/sheet.png',
          cell: { x: 0, y: 0, width: 64, height: 64 },
          hex: { width: 1, height: 1 },
        };
      },
    };
    const [drawn] = syncCanvas2dPlacements(ctx, [placement('p:d', 'grass', { x: 3, y: 0, z: 1 })], {
      source: noTransformSource,
      sheets,
      viewport: { pixelsPerUnit: 32 },
    }).drawn;
    const destW = 1 * 32; // scale falls back to placement.scale (1)
    expect(drawn?.dest.x).toBeCloseTo(200 + 3 * 32 - destW / 2);
    expect(drawn?.dest.y).toBeCloseTo(150 + 1 * 32 - destW / 2);
  });

  it('skips a 2D placement whose sheet image is not loaded', () => {
    const { ctx } = fakeContext();
    const result = syncCanvas2dPlacements(ctx, [placement('p:a', 'grass', { x: 0, y: 0, z: 0 })], {
      source: tilesetSource,
      sheets: new Map(),
    });
    expect(result.skipped).toEqual(['p:a']);
  });

  it('threads the resolve context to the source', () => {
    const { ctx } = fakeContext();
    const spy = vi.fn(tilesetSource.resolve);
    const context = { biome: 'coast' } as never;
    syncCanvas2dPlacements(ctx, [placement('p:a', 'grass', { x: 0, y: 0, z: 0 })], {
      source: { kind: 'tileset', resolve: spy },
      sheets,
      context,
    });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 'p:a' }), context);
  });

  it('renders a transition tile via resolveEdge, not the plain fill cell', () => {
    const { ctx, calls } = fakeContext();
    // A placement carrying a non-zero edgeMask must draw the EDGE cell.
    const coast = placement('p:coast', 'coast', { x: 0, y: 0, z: 0 });
    coast.metadata = { edgeMask: 5 };
    const result = syncCanvas2dPlacements(ctx, [coast], { source: transitionSource, sheets });
    expect(result.drawn).toHaveLength(1);
    // drawImage source rect (args 1..4) must be the EDGE cell, not FILL.
    expect(calls[0]?.slice(1, 5)).toEqual([
      EDGE_CELL.x,
      EDGE_CELL.y,
      EDGE_CELL.width,
      EDGE_CELL.height,
    ]);
  });

  it('renders a non-transition tile (edgeMask 0 / absent) via the plain fill cell', () => {
    const { ctx, calls } = fakeContext();
    const grass = placement('p:grass', 'grass', { x: 0, y: 0, z: 0 }); // metadata: {} → no edgeMask
    syncCanvas2dPlacements(ctx, [grass], { source: transitionSource, sheets });
    expect(calls[0]?.slice(1, 5)).toEqual([
      FILL_CELL.x,
      FILL_CELL.y,
      FILL_CELL.width,
      FILL_CELL.height,
    ]);
  });
});
