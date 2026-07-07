import { describe, expect, it } from 'vitest';
import { KAYKIT_HEX_DEPTH, KAYKIT_HEX_WIDTH } from '../../coordinates';
import type { AssetBounds } from '../../types';
import { normalizeAssetToCell, normalizedFootprint } from '../normalize';

/** AssetBounds from a min + max corner. */
function bounds(
  min: readonly [number, number, number],
  max: readonly [number, number, number]
): AssetBounds {
  return {
    min,
    max,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  };
}

describe('cross-pack size normalization (RFC0-NORM)', () => {
  it("'width' fit scales the footprint width to the cell width (the default)", () => {
    // A 4-wide asset → scale 0.5 to reach the 2-wide KayKit cell.
    const asset = bounds([-2, 0, -2], [2, 3, 2]);
    const norm = normalizeAssetToCell(asset);
    expect(norm.scale).toBeCloseTo(KAYKIT_HEX_WIDTH / 4);
    expect(normalizedFootprint(asset, norm).width).toBeCloseTo(KAYKIT_HEX_WIDTH);
  });

  it("'cover' fully covers the cell (no axis leaves a gap; at least one touches)", () => {
    const asset = bounds([-1, 0, -3], [1, 2, 3]); // sizeX=2, sizeZ=6
    const norm = normalizeAssetToCell(asset, { fit: 'cover' });
    const fp = normalizedFootprint(asset, norm);
    const widthRatio = fp.width / KAYKIT_HEX_WIDTH;
    const depthRatio = fp.depth / KAYKIT_HEX_DEPTH;
    // Every axis fully covers its cell dimension (ratio ≥ 1) …
    expect(widthRatio).toBeGreaterThanOrEqual(1 - 1e-6);
    expect(depthRatio).toBeGreaterThanOrEqual(1 - 1e-6);
    // … and the tightest axis exactly touches (min ratio == 1).
    expect(Math.min(widthRatio, depthRatio)).toBeCloseTo(1, 4);
  });

  it("'contain' fits the SMALLER plane axis (asset fits inside the cell)", () => {
    const asset = bounds([-1, 0, -3], [1, 2, 3]);
    const norm = normalizeAssetToCell(asset, { fit: 'contain' });
    const fp = normalizedFootprint(asset, norm);
    // The smaller-required-scale axis touches; the other stays within the cell.
    expect(fp.width).toBeLessThanOrEqual(KAYKIT_HEX_WIDTH + 1e-6);
    expect(fp.depth).toBeLessThanOrEqual(KAYKIT_HEX_DEPTH + 1e-6);
  });

  it('recenters the footprint on the cell (x/z offset cancels an off-origin asset)', () => {
    // Asset centered at (10, *, 20) → offset pulls it back to the cell origin.
    const asset = bounds([8, 0, 18], [12, 2, 22]);
    const norm = normalizeAssetToCell(asset);
    const scaledCenterX = ((8 + 12) / 2) * norm.scale;
    const scaledCenterZ = ((18 + 22) / 2) * norm.scale;
    expect(norm.offset.x).toBeCloseTo(-scaledCenterX);
    expect(norm.offset.z).toBeCloseTo(-scaledCenterZ);
  });

  it('rests the asset on the surface by default (scaled min-Y lands at y=0)', () => {
    const asset = bounds([-2, 1, -2], [2, 4, 2]); // min-Y = 1
    const norm = normalizeAssetToCell(asset);
    expect(norm.offset.y).toBeCloseTo(-1 * norm.scale);
  });

  it('centers vertically when rest is false', () => {
    const asset = bounds([-2, 0, -2], [2, 6, 2]); // y-center = 3
    const norm = normalizeAssetToCell(asset, { rest: false });
    expect(norm.offset.y).toBeCloseTo(-3 * norm.scale);
  });

  it('honors a custom target cell size', () => {
    const asset = bounds([0, 0, 0], [4, 2, 4]);
    const norm = normalizeAssetToCell(asset, { target: { width: 8 } });
    expect(norm.scale).toBeCloseTo(8 / 4); // scale UP to the 8-wide target
  });

  it('does not divide by zero on a degenerate (flat) footprint axis', () => {
    const flat = bounds([0, 0, 0], [0, 2, 4]); // sizeX = 0
    expect(() => normalizeAssetToCell(flat, { fit: 'cover' })).not.toThrow();
    expect(Number.isFinite(normalizeAssetToCell(flat, { fit: 'cover' }).scale)).toBe(true);
  });
});
