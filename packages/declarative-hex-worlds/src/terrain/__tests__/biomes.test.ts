import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import {
  type BiomePaint,
  biomeFieldSpacing,
  classifyBiomes,
  dominantBiome,
  packBiomeWeightsRgba,
  sampleBiomeWeights,
} from '../biomes';
import { composeHeightField } from '../compose';

const bounds = { minX: 0, minZ: 0, maxX: 200, maxZ: 200 };
/** A slope rising eastward (0.25 per unit) with a steep cliff band near x = 150. */
const terrain = composeHeightField({
  bounds,
  spacing: 10,
  seed: 'biomes',
  layers: [
    {
      kind: 'ridge',
      line: [
        { x: 200, z: 0 },
        { x: 200, z: 200 },
      ],
      halfWidth: 200,
      height: 50,
      profile: 'sharp',
    },
  ],
});
const ids = ['pasture', 'woods', 'rock', 'road', 'wheat'];

function classify(
  paints: readonly BiomePaint[],
  extra: Partial<Parameters<typeof classifyBiomes>[0]> = {}
) {
  return classifyBiomes({ terrain, seed: 'paint', biomes: ids, base: 'pasture', paints, ...extra });
}

function weightOf(field: ReturnType<typeof classify>, id: string, x: number, z: number): number {
  return sampleBiomeWeights(field, x, z)[ids.indexOf(id)] as number;
}

describe('classifyBiomes', () => {
  it('starts in the base biome with weights summing to one', () => {
    const field = classify([]);
    expect(weightOf(field, 'pasture', 50, 50)).toBe(1);
    expect(dominantBiome(field, 120, 30)).toBe('pasture');
    expect(biomeFieldSpacing(field)).toEqual({ x: 10, z: 10 });
  });

  it('paints height and slope bands with feathered and hard edges', () => {
    const field = classify([
      { biome: 'woods', where: [{ kind: 'height', min: 20, feather: 5 }] },
      { biome: 'rock', where: [{ kind: 'slope', max: 0.1 }] },
      { biome: 'wheat', where: [{ kind: 'height', max: 2, min: 1 }] },
    ]);
    expect(dominantBiome(field, 190, 100)).toBe('woods');
    // The flat west edge has slope 0, so the hard-edged rock band takes it.
    expect(dominantBiome(field, 5, 100)).toBe('rock');
    for (const x of [0, 70, 140, 200]) {
      const total = sampleBiomeWeights(field, x, 100).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 5);
    }
  });

  it('paints areas and corridors, warped or not', () => {
    const square = [
      { x: 40, z: 40 },
      { x: 120, z: 40 },
      { x: 120, z: 120 },
      { x: 40, z: 120 },
    ];
    const road = [
      { x: 0, z: 180 },
      { x: 200, z: 180 },
    ];
    const plain = classify([
      { biome: 'woods', where: [{ kind: 'area', polygon: square }] },
      { biome: 'road', where: [{ kind: 'line', line: road, halfWidth: 6, feather: 4 }] },
    ]);
    expect(dominantBiome(plain, 80, 80)).toBe('woods');
    expect(dominantBiome(plain, 150, 80)).toBe('pasture');
    expect(dominantBiome(plain, 100, 180)).toBe('road');
    const warped = classify([
      {
        biome: 'woods',
        where: [{ kind: 'area', polygon: square, feather: 20 }],
        warp: { amplitude: 15, wavelength: 60 },
      },
      { biome: 'road', where: [{ kind: 'line', line: road, halfWidth: 6 }] },
    ]);
    expect(dominantBiome(warped, 80, 80)).toBe('woods');
    expect(Array.from(warped.weights)).not.toEqual(Array.from(plain.weights));
  });

  it('paints noise patches deterministically, with strength', () => {
    const paint: BiomePaint = {
      biome: 'wheat',
      where: [{ kind: 'noise', wavelength: 60, threshold: 0, feather: 0.2 }],
    };
    const a = classify([paint]);
    expect(Array.from(classify([paint]).weights)).toEqual(Array.from(a.weights));
    const shares = ids.map((id) =>
      Array.from({ length: 21 * 21 }, (_, i) =>
        weightOf(a, id, (i % 21) * 10, Math.floor(i / 21) * 10)
      )
    );
    expect(Math.max(...(shares[4] as number[]))).toBeGreaterThan(0.9);
    expect(Math.min(...(shares[4] as number[]))).toBeLessThan(0.1);
    const reseeded = classify([
      { ...paint, where: [{ kind: 'noise', wavelength: 60, threshold: 0, seed: 'x', octaves: 1 }] },
    ]);
    expect(Array.from(reseeded.weights)).not.toEqual(Array.from(a.weights));
    const half = classify([{ biome: 'woods', where: [], strength: 0.5 }]);
    expect(weightOf(half, 'woods', 10, 10)).toBe(0.5);
    const none = classify([
      { biome: 'woods', where: [{ kind: 'height', min: 1e9 }, { kind: 'slope' }] },
    ]);
    expect(weightOf(none, 'woods', 10, 10)).toBe(0);
  });

  it('can classify onto its own grid', () => {
    const field = classify([], {
      bounds: { minX: 0, minZ: 0, maxX: 100, maxZ: 100 },
      width: 3,
      height: 4,
    });
    expect([field.width, field.height, field.weights.length]).toEqual([3, 4, 3 * 4 * ids.length]);
  });

  it('rejects bad biome lists and grids', () => {
    expect(() =>
      classifyBiomes({ terrain, seed: 1, biomes: ['a', 'a'], base: 'a', paints: [] })
    ).toThrow(GameboardValidationError);
    expect(() =>
      classifyBiomes({ terrain, seed: 1, biomes: ['a'], base: 'b', paints: [] })
    ).toThrow(GameboardValidationError);
    expect(() => classify([{ biome: 'lava', where: [] }])).toThrow(GameboardValidationError);
    expect(() => classify([], { width: 1 })).toThrow(GameboardValidationError);
    expect(() => classify([], { height: 2.5 })).toThrow(GameboardValidationError);
  });
});

describe('sampling and packing', () => {
  const field = classify([{ biome: 'rock', where: [{ kind: 'height', min: 25 }] }]);

  it('clamps sampling at the edges', () => {
    expect(Array.from(sampleBiomeWeights(field, -50, -50))).toEqual(
      Array.from(sampleBiomeWeights(field, 0, 0))
    );
    expect(Array.from(sampleBiomeWeights(field, 999, 999))).toEqual(
      Array.from(sampleBiomeWeights(field, 200, 200))
    );
    expect(Array.from(sampleBiomeWeights(field, Number.NaN, 10))).toEqual(
      Array.from(sampleBiomeWeights(field, 0, 10))
    );
  });

  it('prefers the earlier biome on a tie', () => {
    const tie = classify([{ biome: 'woods', where: [], strength: 0.5 }]);
    expect(dominantBiome(tie, 10, 10)).toBe('pasture');
  });

  it('packs four biomes per RGBA layer, zero-padding the last', () => {
    const layers = packBiomeWeightsRgba(field);
    expect(layers).toHaveLength(2);
    const last = field.width * field.height - 1;
    expect(layers[0]?.[0]).toBe(255);
    expect(layers[0]?.[last * 4 + 2]).toBe(255);
    expect(layers[1]?.[1]).toBe(0);
    expect(layers[1]?.[3]).toBe(0);
  });
});
