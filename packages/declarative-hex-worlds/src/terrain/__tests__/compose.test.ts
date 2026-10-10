import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import { composeHeightField, type TerrainLayer, terrainProfileWeight } from '../compose';
import {
  createHeightFieldWithSpacing,
  fillHeightField,
  heightFieldRange,
  sampleHeight,
} from '../field';

const bounds = { minX: -100, minZ: -100, maxX: 100, maxZ: 100 };

function compose(layers: readonly TerrainLayer[], base?: number) {
  return composeHeightField({
    bounds,
    spacing: 10,
    seed: 'compose',
    layers,
    ...(base === undefined ? {} : { base }),
  });
}

describe('terrainProfileWeight', () => {
  it('falls from 1 at the crest to 0 at the foot for every profile', () => {
    for (const profile of ['smooth', 'sharp', 'plateau'] as const) {
      expect(terrainProfileWeight(profile, -0.5)).toBe(1);
      expect(terrainProfileWeight(profile, 0)).toBe(1);
      expect(terrainProfileWeight(profile, 1)).toBe(0);
      expect(terrainProfileWeight(profile, 2)).toBe(0);
    }
    expect(terrainProfileWeight('smooth', 0.5)).toBe(0.5);
    expect(terrainProfileWeight('sharp', 0.5)).toBe(0.25);
    expect(terrainProfileWeight('plateau', 0.3)).toBe(1);
    expect(terrainProfileWeight('plateau', 0.7)).toBeCloseTo(0.5, 12);
  });
});

describe('composeHeightField', () => {
  it('starts from a constant, zero by default, or another field', () => {
    expect(heightFieldRange(compose([]))).toEqual({ min: 0, max: 0 });
    expect(heightFieldRange(compose([], 150))).toEqual({ min: 150, max: 150 });
    const dem = createHeightFieldWithSpacing(bounds, 50);
    fillHeightField(dem, (x) => x);
    const field = composeHeightField({ bounds, spacing: 10, seed: 1, base: dem, layers: [] });
    expect(sampleHeight(field, 30, 0)).toBe(30);
  });

  it('adds hills and ridges with their profiles', () => {
    const hill = compose([{ kind: 'hill', center: { x: 0, z: 0 }, radius: 50, height: 20 }]);
    expect(sampleHeight(hill, 0, 0)).toBe(20);
    expect(sampleHeight(hill, 60, 0)).toBe(0);
    const sharp = compose([
      { kind: 'hill', center: { x: 0, z: 0 }, radius: 50, height: 20, profile: 'sharp' },
    ]);
    expect(sampleHeight(sharp, 20, 0)).toBeCloseTo(20 * 0.36, 4);
    const ridge = compose([
      {
        kind: 'ridge',
        line: [
          { x: -100, z: 0 },
          { x: 100, z: 0 },
        ],
        halfWidth: 40,
        height: 10,
      },
    ]);
    expect(sampleHeight(ridge, 50, 0)).toBe(10);
    expect(sampleHeight(ridge, 50, 50)).toBe(0);
    const plateau = compose([
      {
        kind: 'ridge',
        line: [{ x: 0, z: 0 }],
        halfWidth: 50,
        height: 10,
        profile: 'plateau',
      },
    ]);
    expect(sampleHeight(plateau, 10, 0)).toBe(10);
  });

  it('carves channels and flattens areas', () => {
    const channel = compose(
      [
        {
          kind: 'channel',
          line: [
            { x: 0, z: -100 },
            { x: 0, z: 100 },
          ],
          halfWidth: 20,
          depth: 4,
        },
      ],
      10
    );
    expect(sampleHeight(channel, 0, 0)).toBe(6);
    expect(sampleHeight(channel, 50, 0)).toBe(10);

    const town = [
      { x: -30, z: -30 },
      { x: 30, z: -30 },
      { x: 30, z: 30 },
      { x: -30, z: 30 },
    ];
    const hill = { kind: 'hill', center: { x: 0, z: 0 }, radius: 100, height: 40 } as const;
    const levelled = compose([hill, { kind: 'flatten', polygon: town, height: 5, feather: 10 }]);
    expect(sampleHeight(levelled, 0, 0)).toBe(5);
    expect(sampleHeight(levelled, 80, 0)).toBeGreaterThan(0);
    const anchored = compose([hill, { kind: 'flatten', polygon: town, feather: 0, strength: 0.5 }]);
    const anchor = sampleHeight(compose([hill]), -30, -30);
    expect(sampleHeight(anchored, 0, 0)).toBeCloseTo((40 + anchor) / 2, 4);
  });

  it('scales about a pivot, the minimum by default', () => {
    const hill = { kind: 'hill', center: { x: 0, z: 0 }, radius: 50, height: 10 } as const;
    expect(sampleHeight(compose([hill, { kind: 'scale', factor: 2 }], 100), 0, 0)).toBe(120);
    expect(sampleHeight(compose([hill, { kind: 'scale', factor: 2, pivot: 0 }], 100), 0, 0)).toBe(
      220
    );
  });

  it('adds weighted fields', () => {
    const extra = createHeightFieldWithSpacing(bounds, 100);
    extra.heights.fill(4);
    expect(sampleHeight(compose([{ kind: 'field', field: extra }]), 0, 0)).toBe(4);
    expect(sampleHeight(compose([{ kind: 'field', field: extra, weight: 0.5 }]), 0, 0)).toBe(2);
  });

  it('adds deterministic fractal and ridged relief', () => {
    const rolling = { kind: 'noise', amplitude: 5, wavelength: 80 } as const;
    const a = compose([rolling]);
    expect(Array.from(compose([rolling]).heights)).toEqual(Array.from(a.heights));
    const range = heightFieldRange(a);
    expect(range.max).toBeLessThanOrEqual(5);
    expect(range.max - range.min).toBeGreaterThan(0);
    const reseeded = compose([{ ...rolling, seed: 'other', octaves: 2, lacunarity: 3, gain: 0.4 }]);
    expect(Array.from(reseeded.heights)).not.toEqual(Array.from(a.heights));
    const ridged = heightFieldRange(compose([{ ...rolling, ridged: true }]));
    expect(ridged.min).toBeGreaterThanOrEqual(0);
  });

  it('rejects non-positive extents and degenerate polygons', () => {
    const line = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    ];
    const bad: TerrainLayer[] = [
      { kind: 'noise', amplitude: 1, wavelength: 0 },
      { kind: 'ridge', line, halfWidth: 0, height: 1 },
      { kind: 'hill', center: { x: 0, z: 0 }, radius: -1, height: 1 },
      { kind: 'channel', line, halfWidth: 0, depth: 1 },
      { kind: 'flatten', polygon: line, feather: 1 },
    ];
    for (const layer of bad) {
      expect(() => compose([layer])).toThrow(GameboardValidationError);
    }
  });

  it('rejects bad flatten feathers and unknown layer kinds from untyped input', () => {
    const square = [
      { x: -10, z: -10 },
      { x: 10, z: -10 },
      { x: 10, z: 10 },
    ];
    for (const feather of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => compose([{ kind: 'flatten', polygon: square, feather }])).toThrow(
        GameboardValidationError
      );
    }
    const misspelt = JSON.parse('{"kind":"hills","center":{"x":0,"z":0},"radius":5,"height":1}');
    expect(() => compose([misspelt as TerrainLayer])).toThrow(/unknown terrain layer kind "hills"/);
  });
});
