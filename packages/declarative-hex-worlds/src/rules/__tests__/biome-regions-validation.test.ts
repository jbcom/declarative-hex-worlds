import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import { createGameboardBuilder, type GameboardPlan } from '../../gameboard';
import {
  type GameboardBiomeRegionRule,
  type GameboardBiomeRegionsSpec,
  generateGameboardBiomeRegions,
} from '../biome-regions';

const plan = createGameboardBuilder({
  seed: 'validation',
  shape: { kind: 'rectangle', width: 5, height: 4 },
}).build();
const rule: GameboardBiomeRegionRule = { biome: 'woods', target: 0.4, sources: { count: 1 } };
const base: GameboardBiomeRegionsSpec = {
  seed: 'validation:biomes',
  fill: 'pasture',
  biomes: [rule],
};

describe('biome region authoring validation', () => {
  it.each([
    { target: -0.1 },
    { target: Number.NaN },
    { target: Number.POSITIVE_INFINITY },
    { minRegion: 0 },
    { minRegion: 1.5 },
    { sources: { count: 0.5 } },
    { sources: { count: -1 } },
    { sources: { count: 1, spacing: -1 } },
    { requires: [{ field: '' }] },
    { requires: [{ field: 'slope', min: 1, max: 0 }] },
    { requires: [{ field: 'slope', min: Number.NaN }] },
    { requires: [{ field: 'slope', max: Infinity }] },
    { suits: [{ field: '', from: 0, to: 1, weight: 1 }] },
    { suits: [{ field: 'slope', from: 1, to: 1, weight: 1 }] },
    { suits: [{ field: 'slope', from: Number.NaN, to: 1, weight: 1 }] },
    { suits: [{ field: 'slope', from: 0, to: Number.NaN, weight: 1 }] },
    { suits: [{ field: 'slope', from: 0, to: 1, weight: Number.NaN }] },
    { sources: { tiles: [{ q: 99, r: 99 }] } },
  ] satisfies Partial<GameboardBiomeRegionRule>[])(
    'rejects invalid rule intent %j before generation',
    (override) => {
      expect(() =>
        generateGameboardBiomeRegions(plan, { ...base, biomes: [{ ...rule, ...override }] })
      ).toThrow(GameboardValidationError);
    }
  );

  it.each([
    { seed: '' },
    { seed: 1 as unknown as string },
    { fill: '' },
    { edgeNoise: -1 },
    { biomes: [rule, rule] },
    { biomes: [{ ...rule, biome: 'pasture' }] },
    {
      biomes: [
        { ...rule, target: 0.7 },
        { ...rule, biome: 'wheat', target: 0.7 },
      ],
    },
    { affinity: [{ a: 'woods', b: 'pasture', weight: Number.NaN }] },
  ] satisfies Partial<GameboardBiomeRegionsSpec>[])(
    'rejects invalid stage intent %j',
    (override) => {
      expect(() => generateGameboardBiomeRegions(plan, { ...base, ...override })).toThrow(
        GameboardValidationError
      );
    }
  );

  it('keeps zero-target and unreachable explicit sources empty', () => {
    for (const changed of [
      { ...rule, target: 0, sources: { tiles: [{ q: 0, r: 0 }] } },
      { ...rule, sources: { tiles: [{ q: 0, r: 0 }] }, requires: [{ field: 'missing', min: 0 }] },
    ]) {
      const result = generateGameboardBiomeRegions(plan, { ...base, biomes: [changed] });
      expect(result.report.biomes.woods?.actual).toBe(0);
    }
  });

  it('supports inclusive bounded, maximum-only and presence-only fields', () => {
    const fields = {
      ...plan,
      tiles: plan.tiles.map((tile) => ({ ...tile, fields: { slope: 0.5 } })),
    };
    for (const band of [
      { field: 'slope' },
      { field: 'slope', max: 0.5 },
      { field: 'slope', min: 0.5, max: 0.5 },
    ]) {
      const result = generateGameboardBiomeRegions(fields, {
        ...base,
        biomes: [{ ...rule, requires: [band] }],
      });
      expect(result.report.biomes.woods?.actual).toBe(8);
    }
  });

  it('rejects malformed and non-finite field values during suitability checks', () => {
    const invalid = {
      ...plan,
      tiles: plan.tiles.map((tile) => ({ ...tile, fields: { slope: Number.NaN } })),
    };
    const result = generateGameboardBiomeRegions(invalid, {
      ...base,
      biomes: [{ ...rule, requires: [{ field: 'slope' }] }],
    });
    expect(result.report.biomes.woods?.actual).toBe(0);
  });

  it('weights seeded source choice by environmental suitability and allows falling preferences', () => {
    const varied: GameboardPlan = {
      ...plan,
      tiles: plan.tiles.map((tile) => ({ ...tile, fields: { slope: tile.coordinates.q / 4 } })),
    };
    const band = { field: 'slope', from: 0, to: 1, weight: 1000 };
    const rising = generateGameboardBiomeRegions(varied, {
      ...base,
      biomes: [{ ...rule, target: 0.05, suits: [band] }],
    });
    const falling = generateGameboardBiomeRegions(varied, {
      ...base,
      biomes: [{ ...rule, target: 0.05, suits: [{ ...band, from: 1, to: 0 }] }],
    });
    const high = rising.report.biomes.woods?.sources[0];
    const low = falling.report.biomes.woods?.sources[0];
    if (!high || !low) throw new Error('Missing seeded source');
    expect(high.q).toBeGreaterThan(low.q);
    const absent = generateGameboardBiomeRegions(plan, {
      ...base,
      biomes: [{ ...rule, suits: [band] }],
    });
    expect(absent.report.biomes.woods?.actual).toBe(8);
  });

  it('deduplicates identical campaign pins', () => {
    const pin = { at: { q: 0, r: 0 }, biome: 'orchard' };
    expect(generateGameboardBiomeRegions(plan, { ...base, pins: [pin, pin] }).report.pinned).toBe(
      1
    );
  });

  it('treats a negative suitability penalty like the equivalent falling preference', () => {
    const varied: GameboardPlan = {
      ...plan,
      tiles: plan.tiles.map((tile) => ({ ...tile, fields: { wetness: tile.coordinates.q / 4 } })),
    };
    for (const seed of ['avoidance-0', 'avoidance-1', 'avoidance-2', 'avoidance-3']) {
      const penalty = generateGameboardBiomeRegions(varied, {
        ...base,
        seed,
        biomes: [
          {
            ...rule,
            suits: [{ field: 'wetness', from: 0, to: 1, weight: -1000 }],
          },
        ],
      });
      const preference = generateGameboardBiomeRegions(varied, {
        ...base,
        seed,
        biomes: [
          {
            ...rule,
            suits: [{ field: 'wetness', from: 1, to: 0, weight: 1000 }],
          },
        ],
      });
      expect(penalty.plan.tiles.map((tile) => tile.biome)).toEqual(
        preference.plan.tiles.map((tile) => tile.biome)
      );
    }
  });

  it('allows two crops to grow from a shared unpinned source', () => {
    const result = generateGameboardBiomeRegions(plan, {
      ...base,
      biomes: [
        { ...rule, sources: { tiles: [{ q: 2, r: 1 }] } },
        { ...rule, biome: 'wheat', sources: { tiles: [{ q: 2, r: 1 }] } },
      ],
      affinity: [{ a: 'wheat', b: 'woods', weight: -1 }],
    });
    expect(result.report.biomes.woods?.actual).toBe(8);
    expect(result.report.biomes.wheat?.actual).toBe(8);
  });
});
