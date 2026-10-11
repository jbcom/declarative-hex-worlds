import { describe, expect, it } from 'vitest';
import { hexDistance, hexKey } from '../../coordinates/coordinates';
import { createGameboardBuilder } from '../../gameboard';
import { type GameboardBiomeRegionsSpec, generateGameboardBiomeRegions } from '../biome-regions';

function board() {
  const builder = createGameboardBuilder({
    seed: 'buried-seed',
    shape: { kind: 'rectangle', width: 12, height: 8 },
  });
  for (const tile of builder.build().tiles) {
    builder.setFields(tile.coordinates, { wetness: tile.coordinates.q < 3 ? 1 : 0, slope: 0.05 });
  }
  return builder.build();
}

const spec: GameboardBiomeRegionsSpec = {
  seed: 'buried-seed:biomes',
  fill: 'pasture',
  edgeNoise: 0.1,
  biomes: [{ biome: 'wheat', target: 0.3, sources: { count: 2, spacing: 4 } }],
};

describe('seeded hex biome regions', () => {
  it('uses pairwise affinity when choosing between reachable frontier tiles', () => {
    const plan = createGameboardBuilder({
      shape: { kind: 'rectangle', width: 3, height: 2 },
    }).build();
    const base: GameboardBiomeRegionsSpec = {
      seed: 'affinity',
      fill: 'pasture',
      pins: [
        { at: { q: 0, r: 0 }, biome: 'woods' },
        { at: { q: 1, r: 0 }, biome: 'farmyard' },
        { at: { q: 2, r: 0 }, biome: 'marsh' },
      ],
      biomes: [{ biome: 'wheat', target: 0.34, sources: { tiles: [{ q: 1, r: 0 }] } }],
    };
    const left = generateGameboardBiomeRegions(plan, {
      ...base,
      affinity: [{ a: 'wheat', b: 'woods', weight: 100 }],
    });
    const right = generateGameboardBiomeRegions(plan, {
      ...base,
      affinity: [{ a: 'wheat', b: 'marsh', weight: 100 }],
    });
    expect(
      left.plan.tiles.filter((tile) => tile.biome === 'wheat').map((tile) => tile.key)
    ).toEqual(['0,1']);
    expect(
      right.plan.tiles.filter((tile) => tile.biome === 'wheat').map((tile) => tile.key)
    ).toEqual(['1,1']);
  });

  it('is deterministic without mutating its plan, regardless of tile array order', () => {
    const plan = board();
    const before = JSON.stringify(plan);
    const a = generateGameboardBiomeRegions(plan, spec);
    const b = generateGameboardBiomeRegions({ ...plan, tiles: [...plan.tiles].reverse() }, spec);
    const assignments = (p: typeof plan) =>
      Object.fromEntries(p.tiles.map((tile) => [tile.key, tile.biome]));
    expect(assignments(a.plan)).toEqual(assignments(b.plan));
    expect(JSON.stringify(plan)).toBe(before);
    expect(a.report.biomes.wheat?.actual).toBe(Math.floor(plan.tiles.length * 0.3));
    expect(a.plan.tiles.every((tile) => tile.biome)).toBe(true);
  });

  it('grows one connected field from an explicit source', () => {
    const result = generateGameboardBiomeRegions(board(), {
      ...spec,
      biomes: [{ biome: 'wheat', target: 0.4, sources: { tiles: [{ q: 5, r: 3 }] } }],
    });
    expect(result.report.biomes.wheat?.regions).toHaveLength(1);
    expect(result.plan.tiles.find((tile) => tile.key === '5,3')?.biome).toBe('wheat');
  });

  it('honours hard field bands and reports unreachable targets', () => {
    const result = generateGameboardBiomeRegions(board(), {
      ...spec,
      biomes: [
        {
          biome: 'wet',
          target: 0.7,
          sources: { count: 2 },
          requires: [{ field: 'wetness', min: 0.9 }],
        },
      ],
    });
    const wet = result.plan.tiles.filter((tile) => tile.biome === 'wet');
    expect(wet.length).toBeGreaterThan(0);
    expect(wet.every((tile) => (tile.fields?.wetness ?? 0) >= 0.9)).toBe(true);
    expect(result.report.biomes.wet?.actual).toBeLessThan(result.report.biomes.wet?.target ?? 0);
  });

  it('protects pinned campaign tiles across seed changes and counts shares over free tiles', () => {
    const pins = [{ at: { q: 5, r: 3 }, biome: 'orchard' }];
    for (const seed of ['campaign-one', 'campaign-two']) {
      const result = generateGameboardBiomeRegions(board(), { ...spec, seed, pins });
      expect(result.plan.tiles.find((tile) => tile.key === '5,3')?.biome).toBe('orchard');
      expect(result.report.pinned).toBe(1);
      expect(result.report.biomes.wheat?.target).toBe(Math.floor(95 * 0.3));
    }
  });

  it('does not invent fields from inherited object keys', () => {
    const result = generateGameboardBiomeRegions(board(), {
      ...spec,
      biomes: [
        { biome: 'wheat', target: 0.5, sources: { count: 1 }, requires: [{ field: 'toString' }] },
      ],
    });
    expect(result.report.biomes.wheat?.actual).toBe(0);
  });

  it('dissolves undersized free regions while leaving pinned regions untouched', () => {
    const result = generateGameboardBiomeRegions(board(), {
      ...spec,
      pins: [{ at: { q: 0, r: 0 }, biome: 'wheat' }],
      biomes: [
        { biome: 'wheat', target: 0.02, sources: { tiles: [{ q: 10, r: 6 }] }, minRegion: 3 },
      ],
    });
    expect(
      result.plan.tiles.filter((tile) => tile.biome === 'wheat').map((tile) => tile.key)
    ).toEqual(['0,0']);
  });

  it('changes the generated country with the buried seed', () => {
    const a = generateGameboardBiomeRegions(board(), spec);
    const b = generateGameboardBiomeRegions(board(), { ...spec, seed: 'different:biomes' });
    expect(a.plan.tiles.map((tile) => tile.biome)).not.toEqual(
      b.plan.tiles.map((tile) => tile.biome)
    );
  });

  it('rejects invalid targets, absent source tiles and conflicting pins', () => {
    expect(() =>
      generateGameboardBiomeRegions(board(), {
        ...spec,
        biomes: [{ biome: 'wheat', sources: { count: 1 }, target: 2 }],
      })
    ).toThrow();
    expect(() =>
      generateGameboardBiomeRegions(board(), {
        ...spec,
        pins: [{ at: { q: 99, r: 99 }, biome: 'orchard' }],
      })
    ).toThrow();
    expect(() =>
      generateGameboardBiomeRegions(board(), {
        ...spec,
        pins: [
          { at: { q: 0, r: 0 }, biome: 'orchard' },
          { at: { q: 0, r: 0 }, biome: 'rock' },
        ],
      })
    ).toThrow();
  });

  it('honours source spacing when choosing separate regions', () => {
    const result = generateGameboardBiomeRegions(board(), {
      ...spec,
      biomes: [{ biome: 'wheat', target: 0.03, sources: { count: 2, spacing: 6 } }],
    });
    const sources = result.report.biomes.wheat?.sources ?? [];
    expect(sources).toHaveLength(2);
    const [first, second] = sources;
    if (!first || !second) throw new Error('Expected two source coordinates');
    expect(hexDistance(first, second)).toBeGreaterThanOrEqual(6);
    expect(
      sources.every((source) => result.plan.tiles.some((tile) => tile.key === hexKey(source)))
    ).toBe(true);
    expect(
      sources.every(
        (source) => result.plan.tiles.find((tile) => tile.key === hexKey(source))?.biome === 'wheat'
      )
    ).toBe(true);
  });
});
