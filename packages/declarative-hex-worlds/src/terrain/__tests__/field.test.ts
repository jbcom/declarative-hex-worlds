import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import {
  createHeightField,
  createHeightFieldWithSpacing,
  fillHeightField,
  heightFieldRange,
  heightFieldSamplePosition,
  heightFieldSpacing,
  resampleHeightField,
  sampleGradient,
  sampleHeight,
  sampleNormal,
  sampleSlope,
} from '../field';

const bounds = { minX: 0, minZ: 0, maxX: 10, maxZ: 20 };

/** A plane rising 0.5 per unit east and 0.25 per unit south. */
function plane() {
  const field = createHeightFieldWithSpacing(bounds, 5);
  fillHeightField(field, (x, z) => 0.5 * x + 0.25 * z);
  return field;
}

describe('createHeightField', () => {
  it('validates dimensions, bounds and supplied heights', () => {
    expect(() => createHeightField({ bounds, width: 1, height: 3 })).toThrow(
      GameboardValidationError
    );
    expect(() => createHeightField({ bounds, width: 2.5, height: 3 })).toThrow(
      GameboardValidationError
    );
    expect(() =>
      createHeightField({ bounds: { minX: 0, minZ: 0, maxX: 0, maxZ: 5 }, width: 2, height: 2 })
    ).toThrow(GameboardValidationError);
    expect(() =>
      createHeightField({ bounds: { minX: 0, minZ: 5, maxX: 5, maxZ: 5 }, width: 2, height: 2 })
    ).toThrow(GameboardValidationError);
    expect(() => createHeightField({ bounds, width: 2, height: 2, heights: [1, 2] })).toThrow(
      GameboardValidationError
    );
  });

  it('copies supplied heights instead of aliasing them', () => {
    const source = [1, 2, 3, 4];
    const field = createHeightField({ bounds, width: 2, height: 2, heights: source });
    source[0] = 99;
    expect(Array.from(field.heights)).toEqual([1, 2, 3, 4]);
    expect(Array.from(createHeightField({ bounds, width: 2, height: 2 }).heights)).toEqual([
      0, 0, 0, 0,
    ]);
  });
});

describe('createHeightFieldWithSpacing', () => {
  it('derives the grid from the spacing', () => {
    const field = createHeightFieldWithSpacing(bounds, 5);
    expect([field.width, field.height]).toEqual([3, 5]);
    expect(heightFieldSpacing(field)).toEqual({ x: 5, z: 5 });
    expect(heightFieldSamplePosition(field, 2, 4)).toEqual({ x: 10, z: 20 });
  });

  it('rejects bad spacing', () => {
    expect(() => createHeightFieldWithSpacing(bounds, 0)).toThrow(GameboardValidationError);
    expect(() => createHeightFieldWithSpacing(bounds, 3)).toThrow(GameboardValidationError);
    expect(() => createHeightFieldWithSpacing({ ...bounds, maxZ: 21 }, 5)).toThrow(
      GameboardValidationError
    );
  });
});

describe('sampling', () => {
  it('interpolates bilinearly and reproduces a plane exactly', () => {
    const field = plane();
    expect(sampleHeight(field, 2.5, 7.5)).toBe(1.25 + 1.875);
    expect(sampleHeight(field, 10, 20)).toBe(10);
    expect(sampleHeight(field, 0, 0)).toBe(0);
  });

  it('clamps outside the bounds and on non-finite input', () => {
    const field = plane();
    expect(sampleHeight(field, -50, 10)).toBe(sampleHeight(field, 0, 10));
    expect(sampleHeight(field, 99, 10)).toBe(sampleHeight(field, 10, 10));
    expect(sampleHeight(field, 5, -9)).toBe(sampleHeight(field, 5, 0));
    expect(sampleHeight(field, 5, 99)).toBe(sampleHeight(field, 5, 20));
    expect(sampleHeight(field, Number.NaN, Number.NaN)).toBe(0);
  });

  it('derives gradient, slope and a unit normal', () => {
    const field = plane();
    const gradient = sampleGradient(field, 5, 10);
    expect(gradient.dx).toBeCloseTo(0.5);
    expect(gradient.dz).toBeCloseTo(0.25);
    expect(sampleSlope(field, 5, 10)).toBeCloseTo(Math.sqrt(0.3125));
    const n = sampleNormal(field, 5, 10);
    expect(n.x * n.x + n.y * n.y + n.z * n.z).toBeCloseTo(1);
    expect(n.x).toBeLessThan(0);
    expect(n.y).toBeGreaterThan(0);
  });

  it('reports the height range', () => {
    expect(heightFieldRange(plane())).toEqual({ min: 0, max: 10 });
  });

  it('resamples onto another grid', () => {
    const fine = resampleHeightField(plane(), bounds, 11, 21);
    expect(sampleHeight(fine, 3, 7)).toBeCloseTo(0.5 * 3 + 0.25 * 7, 5);
    expect([fine.width, fine.height]).toEqual([11, 21]);
  });
});
