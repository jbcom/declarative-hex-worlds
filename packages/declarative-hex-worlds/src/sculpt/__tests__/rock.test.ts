import { IcosahedronGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import { rock } from '../rock';

function positions(r: number, seed: number, rough?: number): Float32Array {
  const { geometry } = rock(r, seed, { tone: 'stone' }, rough);
  return Float32Array.from(geometry.getAttribute('position').array);
}

function uniqueVertexCount(array: ArrayLike<number>): number {
  const seen = new Set<string>();
  for (let i = 0; i < array.length; i += 3) {
    seen.add(
      `${Math.round((array[i] ?? 0) * 1e4)},${Math.round((array[i + 1] ?? 0) * 1e4)},${Math.round((array[i + 2] ?? 0) * 1e4)}`
    );
  }
  return seen.size;
}

describe('rock', () => {
  it('is deterministic: the same seed gives the same vertices', () => {
    expect(positions(0.5, 7)).toEqual(positions(0.5, 7));
  });

  it('is deterministic across a sweep of seeds', () => {
    for (const seed of [0, 1, 42, 123456, -9, 2 ** 31 - 1]) {
      expect(positions(1, seed)).toEqual(positions(1, seed));
    }
  });

  it('differs between seeds', () => {
    expect(positions(0.5, 7)).not.toEqual(positions(0.5, 8));
  });

  it('keeps every vertex within the roughness band around its radius', () => {
    const r = 0.8;
    const rough = 0.28;
    const array = positions(r, 11, rough);
    for (let i = 0; i < array.length; i += 3) {
      const distance = Math.hypot(array[i] ?? 0, array[i + 1] ?? 0, array[i + 2] ?? 0);
      // Each vertex scales by k in [r (1 - rough), r (1 + rough)], with y squashed to 80 %.
      expect(distance).toBeLessThanOrEqual(r * (1 + rough) + 1e-5);
      expect(distance).toBeGreaterThanOrEqual(0.8 * r * (1 - rough) - 1e-5);
    }
  });

  it('is a smooth, flattened ellipsoid at zero roughness whatever the seed', () => {
    expect(positions(1, 3, 0)).toEqual(positions(1, 99, 0));
    const array = positions(1, 3, 0);
    let maxY = 0;
    let maxX = 0;
    for (let i = 0; i < array.length; i += 3) {
      maxX = Math.max(maxX, Math.abs(array[i] ?? 0));
      maxY = Math.max(maxY, Math.abs(array[i + 1] ?? 0));
    }
    expect(maxX).toBeCloseTo(1, 5);
    expect(maxY).toBeCloseTo(0.8, 5);
  });

  it('moves the vertices that faces share together, so the stone has no cracks', () => {
    const plain = new IcosahedronGeometry(1, 1).toNonIndexed();
    const expected = uniqueVertexCount(plain.getAttribute('position').array);
    expect(uniqueVertexCount(positions(1, 5))).toBe(expected);
  });

  it('carries unit normals for every vertex, recomputed after the roughening', () => {
    const { geometry } = rock(0.5, 2, { tone: 'stone' });
    const normal = geometry.getAttribute('normal');
    expect(normal.count).toBe(geometry.getAttribute('position').count);
    for (let i = 0; i < normal.count; i++) {
      expect(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i))).toBeCloseTo(1, 4);
    }
  });

  it('places the stone with its options and keeps its tone, finish and shade', () => {
    const built = rock(0.5, 2, { at: [0, 3, 0], tone: 'stone', finish: 'metal', shade: 0.7 });
    built.geometry.computeBoundingBox();
    expect(built.geometry.boundingBox?.min.y).toBeGreaterThan(3 - 0.5 * 1.28);
    expect(built.tone).toBe('stone');
    expect(built.finish).toBe('metal');
    expect(built.shade).toBe(0.7);
  });

  it('rejects a radius that is not positive and finite', () => {
    for (const r of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => rock(r, 1, { tone: 'stone' })).toThrow(GameboardValidationError);
    }
  });

  it('rejects a seed that is not an integer', () => {
    expect(() => rock(1, 1.5, { tone: 'stone' })).toThrow(GameboardValidationError);
    expect(() => rock(1, Number.NaN, { tone: 'stone' })).toThrow(GameboardValidationError);
    expect(() => rock(1, Number.POSITIVE_INFINITY, { tone: 'stone' })).toThrow(
      GameboardValidationError
    );
  });

  it('rejects a roughness outside 0 to 1', () => {
    for (const rough of [-0.1, 1.1, Number.NaN]) {
      expect(() => rock(1, 1, { tone: 'stone' }, rough)).toThrow(GameboardValidationError);
    }
  });
});
