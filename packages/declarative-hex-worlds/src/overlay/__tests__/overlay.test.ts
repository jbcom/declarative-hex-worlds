import { describe, expect, it } from 'vitest';
import { KAYKIT_HEX_WIDTH } from '../../coordinates';
import type { Normalization } from '../../normalize';
import { overlayTransform } from '../overlay';

const identity: Normalization = { scale: 1, offset: { x: 0, y: 0, z: 0 } };
const tile = { x: 10, y: 2, z: 20 };

describe('overlay placement transforms (RFC0-OVERLAY)', () => {
  it('centers on the tile by default (anchor 0.5,0.5, no offset)', () => {
    const t = overlayTransform(tile, identity);
    expect(t.position).toEqual({ x: 10, y: 2, z: 20 });
    expect(t.scale).toBe(1);
    expect(t.rotationY).toBe(0);
  });

  it('folds the normalization scale + offset into the transform', () => {
    const norm: Normalization = { scale: 0.5, offset: { x: 1, y: 0.3, z: -1 } };
    const t = overlayTransform(tile, norm);
    expect(t.scale).toBe(0.5);
    expect(t.position).toEqual({ x: 11, y: 2.3, z: 19 });
  });

  it('anchors within the cell (0,0 = corner, offset by half the cell from center)', () => {
    const t = overlayTransform(tile, identity, { anchor: { x: 0, z: 0 } });
    // anchor 0 → -0.5 * cellWidth from center.
    expect(t.position.x).toBeCloseTo(10 - KAYKIT_HEX_WIDTH / 2);
  });

  it('applies a dev offset after anchoring', () => {
    const t = overlayTransform(tile, identity, { offset: { x: 3, y: 1, z: -2 } });
    expect(t.position).toEqual({ x: 13, y: 3, z: 18 });
  });

  it('composes base rotation + control rotation', () => {
    const t = overlayTransform(tile, identity, { rotationY: Math.PI / 4 }, { rotationY: Math.PI / 2 });
    expect(t.rotationY).toBeCloseTo(Math.PI / 2 + Math.PI / 4);
  });

  it('multiplies the normalized scale by the control scale', () => {
    const norm: Normalization = { scale: 0.4, offset: { x: 0, y: 0, z: 0 } };
    const t = overlayTransform(tile, norm, { scale: 2 });
    expect(t.scale).toBeCloseTo(0.8);
  });

  it('measures the anchor against a custom cell', () => {
    const t = overlayTransform(tile, identity, { anchor: { x: 1, z: 0.5 }, cell: { width: 4 } });
    // anchor x=1 on a 4-wide cell → +0.5 * 4 = +2 from center.
    expect(t.position.x).toBeCloseTo(12);
  });
});
