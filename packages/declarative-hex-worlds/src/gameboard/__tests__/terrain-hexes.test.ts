import { describe, expect, it } from 'vitest';
import { classifyBiomes } from '../../terrain/biomes';
import { composeHeightField } from '../../terrain/compose';
import { projectTerrainToHexes, type TerrainHex } from '../../terrain/hexes';
import { GameboardValidationError } from '../../errors';
import { createGameboardBuilder, type GameboardPlan } from '../index';
import { applyTerrainHexesToPlan } from '../terrain-hexes';

function plan(): GameboardPlan {
  return createGameboardBuilder({ seed: 'terrain-hexes', shape: { kind: 'rectangle', width: 4, height: 4 } })
    .setBiome({ q: 0, r: 0 }, 'kept')
    .setFields({ q: 0, r: 0 }, { existing: 1, meanSlope: -1 })
    .build();
}

function hex(q: number, r: number, overrides: Partial<TerrainHex> = {}): TerrainHex {
  return {
    key: `${q},${r}`,
    coordinates: { q, r },
    center: { x: 0, z: 0 },
    meanHeight: 10 + q,
    minHeight: 8 + q,
    maxHeight: 14 + q,
    meanSlope: 0.1 * (q + 1),
    ...overrides,
  };
}

describe('applyTerrainHexesToPlan', () => {
  it('writes mapped scalars onto the tiles with matching axial coordinates', () => {
    const source = plan();
    const next = applyTerrainHexesToPlan(source, [hex(1, 0), hex(2, 3)], {
      fields: { slope: 'meanSlope', elevation: 'meanHeight', low: 'minHeight', high: 'maxHeight' },
    });
    expect(next.tiles.find((tile) => tile.key === '1,0')?.fields).toEqual({
      elevation: 11,
      high: 15,
      low: 9,
      slope: 0.2,
    });
    expect(next.tiles.find((tile) => tile.key === '2,3')?.fields).toEqual({
      elevation: 12,
      high: 16,
      low: 10,
      slope: 0.30000000000000004,
    });
    expect(next.tiles.find((tile) => tile.key === '3,3')).not.toHaveProperty('fields');
  });

  it('is pure: returns a new plan, reuses untouched tiles, leaves the input alone', () => {
    const source = plan();
    const before = JSON.stringify(source);
    const next = applyTerrainHexesToPlan(source, [hex(1, 0)], { fields: { slope: 'meanSlope' } });
    expect(JSON.stringify(source)).toBe(before);
    expect(next).not.toBe(source);
    expect(next.placements).toBe(source.placements);
    expect(next.tiles.find((tile) => tile.key === '2,2')).toBe(source.tiles.find((tile) => tile.key === '2,2'));
  });

  it('merges over existing fields and keeps existing biome unless a biome mapping says otherwise', () => {
    const next = applyTerrainHexesToPlan(plan(), [hex(0, 0)], { fields: { meanSlope: 'meanSlope', added: 'meanHeight' } });
    expect(next.tiles.find((tile) => tile.key === '0,0')).toMatchObject({
      biome: 'kept',
      fields: { added: 10, existing: 1, meanSlope: 0.1 },
    });
  });

  it('supports biome shares and custom derivations, and skips undefined results', () => {
    const shares = { wheat: 0.25, corn: 0.75 };
    const next = applyTerrainHexesToPlan(
      plan(),
      [hex(1, 0, { biomeShares: shares }), hex(2, 0)],
      {
        fields: {
          wheat: { biomeShare: 'wheat' },
          marsh: { biomeShare: 'marsh' },
          relief: (h) => h.maxHeight - h.minHeight,
          shareOnlyWithBiomes: (h) => (h.biomeShares ? 1 : undefined),
        },
      }
    );
    expect(next.tiles.find((tile) => tile.key === '1,0')?.fields).toEqual({
      marsh: 0,
      relief: 6,
      shareOnlyWithBiomes: 1,
      wheat: 0.25,
    });
    // No biome field under (2,0): a share is unknown there, so it is not invented.
    expect(next.tiles.find((tile) => tile.key === '2,0')?.fields).toEqual({ relief: 6 });
  });

  it('writes the dominant biome only when asked', () => {
    const hexes = [hex(1, 0, { dominantBiome: 'wheat' }), hex(2, 0), hex(0, 0, { dominantBiome: 'corn' })];
    const without = applyTerrainHexesToPlan(plan(), hexes, { fields: { slope: 'meanSlope' } });
    expect(without.tiles.find((tile) => tile.key === '1,0')?.biome).toBeUndefined();

    const dominant = applyTerrainHexesToPlan(plan(), hexes, { biome: 'dominant' });
    expect(dominant.tiles.find((tile) => tile.key === '1,0')?.biome).toBe('wheat');
    expect(dominant.tiles.find((tile) => tile.key === '2,0')?.biome).toBeUndefined();
    expect(dominant.tiles.find((tile) => tile.key === '0,0')?.biome).toBe('corn');
    expect(dominant.tiles.find((tile) => tile.key === '1,0')).not.toHaveProperty('fields');

    const custom = applyTerrainHexesToPlan(plan(), hexes, {
      biome: (h) => (h.meanHeight > 10.5 ? `high-${h.dominantBiome ?? 'bare'}` : undefined),
    });
    expect(custom.tiles.find((tile) => tile.key === '1,0')?.biome).toBe('high-wheat');
    expect(custom.tiles.find((tile) => tile.key === '2,0')?.biome).toBe('high-bare');
    expect(custom.tiles.find((tile) => tile.key === '0,0')?.biome).toBe('kept');
  });

  it('ignores hexes outside the board and last write wins for duplicate hexes', () => {
    const next = applyTerrainHexesToPlan(plan(), [hex(40, 40), hex(1, 0), hex(1, 0, { meanSlope: 0.9 })], {
      fields: { slope: 'meanSlope' },
    });
    expect(next.tiles.find((tile) => tile.key === '1,0')?.fields).toEqual({ slope: 0.9 });
    expect(next.tiles.filter((tile) => tile.fields !== undefined)).toHaveLength(2);
  });

  it('rejects non-finite derived values and invalid names or biomes with the library error', () => {
    expect(() =>
      applyTerrainHexesToPlan(plan(), [hex(1, 0)], { fields: { bad: () => Number.NaN } })
    ).toThrow(GameboardValidationError);
    expect(() => applyTerrainHexesToPlan(plan(), [hex(1, 0)], { fields: { '': 'meanSlope' } })).toThrow(
      GameboardValidationError
    );
    expect(() => applyTerrainHexesToPlan(plan(), [hex(1, 0)], { biome: () => '  ' })).toThrow(
      GameboardValidationError
    );
  });

  it('is a no-op for an empty mapping', () => {
    const source = plan();
    expect(applyTerrainHexesToPlan(source, [hex(1, 0)], {}).tiles).toEqual(source.tiles);
  });

  it('bridges the real terrain tier: compose -> classify -> project -> write', () => {
    const source = createGameboardBuilder({ seed: 'bridge', shape: { kind: 'rectangle', width: 3, height: 3 } }).build();
    const bounds = { minX: -4, minZ: -4, maxX: 8, maxZ: 8 };
    const terrain = composeHeightField({
      bounds,
      spacing: 1,
      seed: 'bridge',
      base: 5,
      layers: [{ kind: 'hill', center: { x: 2, z: 2 }, radius: 4, height: 6 }],
    });
    const biomes = classifyBiomes({
      terrain,
      seed: 'bridge',
      biomes: ['meadow', 'upland'],
      base: 'meadow',
      paints: [{ biome: 'upland', where: [{ kind: 'height', min: 8 }] }],
    });
    const hexes = projectTerrainToHexes({
      terrain,
      biomes,
      coordinates: source.tiles.map((tile) => tile.coordinates),
    });
    const next = applyTerrainHexesToPlan(source, hexes, {
      fields: { slope: 'meanSlope', elevation: 'meanHeight', upland: { biomeShare: 'upland' } },
      biome: 'dominant',
    });
    for (const tile of next.tiles) {
      const summary = hexes.find((candidate) => candidate.key === tile.key);
      expect(tile.fields?.elevation).toBe(summary?.meanHeight);
      expect(tile.fields?.slope).toBe(summary?.meanSlope);
      expect(tile.biome).toBe(summary?.dominantBiome);
    }
    expect(next.tiles.some((tile) => tile.biome === 'upland')).toBe(true);
    expect(next.tiles.some((tile) => tile.biome === 'meadow')).toBe(true);
  });
});
