import { describe, expect, it } from 'vitest';
import type { BiomeField } from '../biomes';
import { projectHexBiomesToField } from '../hex-biome-field';

const geometry = { width: 100, depth: 200 / Math.sqrt(3), elevationStep: 1 };
const biomes = ['pasture', 'wheat', 'corn', 'wet'];
const tiles = [
  { coordinates: { q: 0, r: 0 }, biome: 'wheat' },
  { coordinates: { q: 1, r: 0 }, biome: 'corn' },
];
const grid = { bounds: { minX: 0, maxX: 100, minZ: -10, maxZ: 10 }, width: 5, height: 3 };

function weightsAt(field: BiomeField, column: number, row = 1): number[] {
  const start = (row * field.width + column) * field.biomes.length;
  return Array.from(field.weights.slice(start, start + field.biomes.length));
}

describe('hex biomes projected into continuous render weights', () => {
  it('keeps a uniform material exactly constant throughout feathered boundaries', () => {
    const field = projectHexBiomesToField({
      tiles: [],
      grid: {
        bounds: { minX: -120, maxX: 120, minZ: -110, maxZ: 110 },
        width: 17,
        height: 19,
      },
      biomes,
      base: 'wheat',
      geometry,
      feather: 20,
    });
    expect(
      Array.from(field.weights).every((weight, index) => weight === (index % 4 === 1 ? 1 : 0))
    ).toBe(true);
  });

  it('keeps each hex centre entirely in its assigned biome', () => {
    const field = projectHexBiomesToField({
      tiles,
      grid,
      biomes,
      base: 'pasture',
      geometry,
      feather: 10,
    });
    expect(weightsAt(field, 0)).toEqual([0, 1, 0, 0]);
    expect(weightsAt(field, 4)).toEqual([0, 0, 1, 0]);
    expect(weightsAt(field, 2)).toEqual([0, 0.5, 0.5, 0]);
  });

  it('supports hard boundaries for an etched-grid comparison', () => {
    const field = projectHexBiomesToField({ tiles, grid, biomes, base: 'pasture', geometry });
    expect(weightsAt(field, 1)).toEqual([0, 1, 0, 0]);
    expect(weightsAt(field, 3)).toEqual([0, 0, 1, 0]);
    for (let i = 0; i < field.width * field.height; i += 1) {
      expect(
        Array.from(field.weights.slice(i * 4, i * 4 + 4)).filter((weight) => weight === 1)
      ).toHaveLength(1);
    }
  });

  it('is continuous when the containing hex changes across a boundary', () => {
    const field = projectHexBiomesToField({
      tiles,
      grid: {
        ...grid,
        bounds: { minX: 49.999, maxX: 50.001, minZ: -0.001, maxZ: 0.001 },
        width: 3,
      },
      biomes,
      base: 'pasture',
      geometry,
      feather: 10,
    });
    const left = weightsAt(field, 0);
    const right = weightsAt(field, 2);
    expect(left[1]).toBeCloseTo(right[1] as number, 6);
    expect(left[2]).toBeCloseTo(right[2] as number, 6);
  });

  it('gives three touching biomes equal weights at their shared vertex', () => {
    const vertex = geometry.depth / 2;
    const field = projectHexBiomesToField({
      tiles: [
        tiles[0] as (typeof tiles)[number],
        { coordinates: { q: 0, r: 1 }, biome: 'corn' },
        { coordinates: { q: -1, r: 1 }, biome: 'wet' },
      ],
      grid: {
        bounds: { minX: -0.001, maxX: 0.001, minZ: vertex - 0.001, maxZ: vertex + 0.001 },
        width: 3,
        height: 3,
      },
      biomes,
      base: 'pasture',
      geometry,
      feather: 10,
    });
    const centre = weightsAt(field, 1);
    expect(centre[0]).toBe(0);
    for (const weight of centre.slice(1)) expect(weight).toBeCloseTo(1 / 3, 6);
  });

  it('uses the declared base for missing tiles and tiles without a biome', () => {
    for (const input of [[], [{ coordinates: { q: 0, r: 0 } }]]) {
      const field = projectHexBiomesToField({
        tiles: input,
        grid,
        biomes,
        base: 'pasture',
        geometry,
        feather: 10,
      });
      expect(
        Array.from(field.weights).every((weight, index) => weight === (index % 4 === 0 ? 1 : 0))
      ).toBe(true);
    }
  });

  it('accepts translated grids and a non-regular hex footprint', () => {
    const field = projectHexBiomesToField({
      tiles,
      grid: {
        ...grid,
        bounds: { minX: 1000, maxX: 1100, minZ: 1990, maxZ: 2010 },
      },
      biomes,
      base: 'pasture',
      geometry: { ...geometry, depth: 80 },
      origin: { x: 1000, z: 2000 },
      feather: 8,
    });
    expect(weightsAt(field, 0)).toEqual([0, 1, 0, 0]);
    expect(weightsAt(field, 2)).toEqual([0, 0.5, 0.5, 0]);
  });

  it('is normalized, deterministic and independent of input tile order', () => {
    const options = { tiles, grid, biomes, base: 'pasture', geometry, feather: 20 };
    const field = projectHexBiomesToField(options);
    expect(projectHexBiomesToField({ ...options, tiles: [...tiles].reverse() }).weights).toEqual(
      field.weights
    );
    for (let i = 0; i < field.width * field.height; i += 1) {
      const weights = Array.from(field.weights.slice(i * 4, i * 4 + 4));
      expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 6);
      expect(weights.every((weight) => Number.isFinite(weight) && weight >= 0 && weight <= 1)).toBe(
        true
      );
    }
  });

  it('supports prototype-shaped biome names without confusing channel lookup', () => {
    const field = projectHexBiomesToField({
      tiles: [{ coordinates: { q: 0, r: 0 }, biome: 'toString' }],
      grid,
      biomes: ['pasture', 'toString'],
      base: 'pasture',
      geometry,
    });
    expect(weightsAt(field, 0)).toEqual([0, 1]);
  });

  it('rejects ambiguous coordinates and unknown biome channels', () => {
    expect(() =>
      projectHexBiomesToField({
        tiles: [tiles[0] as (typeof tiles)[number], tiles[0] as (typeof tiles)[number]],
        grid,
        biomes,
        base: 'pasture',
        geometry,
      })
    ).toThrow();
    expect(() =>
      projectHexBiomesToField({ tiles, grid, biomes: ['pasture'], base: 'pasture', geometry })
    ).toThrow();
    expect(() =>
      projectHexBiomesToField({ tiles, grid, biomes: ['wheat', 'wheat'], base: 'wheat', geometry })
    ).toThrow();
  });

  it('validates grid frames, footprints, channel lists and feather limits', () => {
    const options = { tiles, grid, biomes, base: 'pasture', geometry };
    for (const change of [
      { biomes: [] },
      { biomes: [''] },
      { base: 'absent' },
      { geometry: { ...geometry, width: 0 } },
      { geometry: { ...geometry, depth: NaN } },
      { origin: { x: Infinity, z: 0 } },
      { origin: { x: 0, z: NaN } },
      { feather: -1 },
      { feather: NaN },
      { feather: 100 },
      { tiles: [{ coordinates: { q: 0.5, r: 0 } }] },
      { tiles: [{ coordinates: { q: 0, r: NaN } }] },
      { grid: { ...grid, width: 1 } },
    ])
      expect(() => projectHexBiomesToField({ ...options, ...change })).toThrow();
    const defaultField = projectHexBiomesToField({ tiles: [], grid, biomes, base: 'pasture' });
    expect(defaultField.weights[0]).toBe(1);
  });
});
