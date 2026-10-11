import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createBiomeCountry } from '../../../tests/fixtures/biome-country';
import { hexKey, neighbors } from '../../coordinates/coordinates';
import { GameboardValidationError } from '../../errors';
import { createGameboardBuilder, type GameboardPlan } from '../../gameboard';
import {
  applyGameboardBiomeRegionStages,
  type GameboardBiomeRegionRule,
  type GameboardBiomeRegionsSpec,
  generateGameboardBiomeRegions,
} from '../biome-regions';

interface Pin {
  at: { q: number; r: number };
  biome?: string;
  fields?: Record<string, number>;
}

function board(
  options: {
    width?: number;
    height?: number;
    pins?: readonly Pin[];
    fields?: (q: number, r: number) => Record<string, number>;
  } = {}
): GameboardPlan {
  const builder = createGameboardBuilder({
    seed: 'patchwork',
    shape: { kind: 'rectangle', width: options.width ?? 20, height: options.height ?? 14 },
  });
  for (const tile of builder.build().tiles) {
    builder.setFields(tile.coordinates, {
      slope: 0.05,
      ...options.fields?.(tile.coordinates.q, tile.coordinates.r),
    });
  }
  for (const pin of options.pins ?? []) {
    if (pin.biome !== undefined) builder.setBiome(pin.at, pin.biome);
    if (pin.fields) builder.setFields(pin.at, pin.fields);
    builder.pinTile(pin.at);
  }
  return builder.build();
}

const wheat: GameboardBiomeRegionRule = {
  biome: 'wheat',
  target: 0.4,
  sources: { count: 3, spacing: 5 },
  maxRegion: 6,
};
const spec: GameboardBiomeRegionsSpec = {
  seed: 'patchwork:biomes',
  fill: 'pasture',
  regionField: 'field',
  biomes: [wheat],
};

/** Tile keys grouped by their recorded region id. */
function groupsByField(plan: GameboardPlan, name = 'field'): Map<number, string[]> {
  const groups = new Map<number, string[]>();
  for (const tile of plan.tiles) {
    const id = tile.fields?.[name];
    if (id === undefined) continue;
    groups.set(id, [...(groups.get(id) ?? []), tile.key]);
  }
  return groups;
}

function connected(plan: GameboardPlan, keys: readonly string[]): boolean {
  if (keys.length === 0) return true;
  const members = new Set(keys);
  const byKey = new Map(plan.tiles.map((tile) => [tile.key, tile]));
  const seen = new Set<string>([keys[0] as string]);
  const queue = [keys[0] as string];
  for (let i = 0; i < queue.length; i += 1) {
    const tile = byKey.get(queue[i] as string);
    if (!tile) continue;
    for (const next of neighbors(tile.coordinates).map(hexKey)) {
      if (members.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === members.size;
}

function touches(plan: GameboardPlan, a: readonly string[], b: readonly string[]): boolean {
  const byKey = new Map(plan.tiles.map((tile) => [tile.key, tile]));
  const other = new Set(b);
  return a.some((key) =>
    neighbors((byKey.get(key) as (typeof plan.tiles)[number]).coordinates)
      .map(hexKey)
      .some((next) => other.has(next))
  );
}

const snapshot = (plan: GameboardPlan) =>
  plan.tiles.map((tile) => [tile.key, tile.biome, tile.fields]);

describe('capped field regions', () => {
  it('never grows a region past maxRegion and meets a target with several regions', () => {
    const plan = board();
    const { plan: result, report } = generateGameboardBiomeRegions(plan, spec);
    const target = Math.floor(plan.tiles.length * 0.4);
    const groups = groupsByField(result);
    expect(report.biomes.wheat?.actual).toBe(target);
    expect(Math.max(...[...groups.values()].map((keys) => keys.length))).toBeLessThanOrEqual(6);
    expect(groups.size).toBeGreaterThanOrEqual(Math.ceil(target / 6));
    expect(report.biomes.wheat?.fields).toBe(groups.size);
  });

  it('records contiguous, unique, dense ids and splits adjacent same-biome fields', () => {
    const { plan: result } = generateGameboardBiomeRegions(board(), spec);
    const groups = groupsByField(result);
    expect([...groups.keys()].sort((a, b) => a - b)).toEqual(
      Array.from({ length: groups.size }, (_, index) => index + 1)
    );
    for (const keys of groups.values()) expect(connected(result, keys)).toBe(true);
    const ids = [...groups.keys()];
    const adjacentPair = ids.some((a) =>
      ids.some(
        (b) => a < b && touches(result, groups.get(a) as string[], groups.get(b) as string[])
      )
    );
    expect(adjacentPair).toBe(true);
    for (const tile of result.tiles) {
      expect(tile.fields?.field !== undefined).toBe(tile.biome === 'wheat');
    }
  });

  it('plants every later region beside land the stage already claimed', () => {
    const { plan: result, report } = generateGameboardBiomeRegions(board(), {
      ...spec,
      biomes: [{ biome: 'wheat', target: 0.3, sources: { tiles: [{ q: 9, r: 6 }] }, maxRegion: 4 }],
    });
    const claimed = result.tiles.filter((tile) => tile.biome === 'wheat').map((tile) => tile.key);
    expect(report.biomes.wheat?.fields).toBeGreaterThan(1);
    expect(connected(result, claimed)).toBe(true);
  });

  it('prefers land beside claimed tiles of any biome', () => {
    const { plan: result } = generateGameboardBiomeRegions(board(), {
      ...spec,
      biomes: [
        { biome: 'corn', target: 0.1, sources: { tiles: [{ q: 9, r: 6 }] }, maxRegion: 28 },
        { biome: 'wheat', target: 0.2, sources: { tiles: [{ q: 9, r: 6 }] }, maxRegion: 5 },
      ],
    });
    const claimed = result.tiles.filter((tile) => tile.biome !== 'pasture').map((tile) => tile.key);
    expect(connected(result, claimed)).toBe(true);
  });

  it('falls back to the best eligible tile anywhere when no free land touches the claimed', () => {
    const plan = board({ fields: (q) => ({ wet: q < 4 || q >= 14 ? 1 : 0 }) });
    const { plan: result, report } = generateGameboardBiomeRegions(plan, {
      ...spec,
      biomes: [
        {
          biome: 'rice',
          target: 0.5,
          sources: { tiles: [{ q: 1, r: 3 }] },
          requires: [{ field: 'wet', min: 1 }],
          maxRegion: 4,
        },
      ],
    });
    const rice = result.tiles.filter((tile) => tile.biome === 'rice');
    expect(rice.some((tile) => tile.coordinates.q < 4)).toBe(true);
    expect(rice.some((tile) => tile.coordinates.q >= 14)).toBe(true);
    expect(report.biomes.rice?.actual).toBe(Math.floor(plan.tiles.length * 0.5));
  });

  it('stops when no eligible free tile remains and reports the shortfall', () => {
    const plan = board({ fields: (q) => ({ wet: q < 3 ? 1 : 0 }) });
    const { report, plan: result } = generateGameboardBiomeRegions(plan, {
      ...spec,
      biomes: [
        {
          biome: 'rice',
          target: 0.3,
          sources: { count: 1 },
          requires: [{ field: 'wet', min: 1 }],
          maxRegion: 3,
        },
        // Keeps the stage running after rice has nowhere left to plant.
        {
          biome: 'wheat',
          target: 0.6,
          sources: { count: 1 },
          requires: [{ field: 'wet', max: 0 }],
          maxRegion: 3,
        },
      ],
    });
    const eligible = plan.tiles.filter((tile) => (tile.fields?.wet ?? 0) === 1).length;
    expect(report.biomes.wheat?.actual).toBe(168);
    expect(report.biomes.rice?.actual).toBe(eligible);
    expect(report.biomes.rice?.actual).toBeLessThan(report.biomes.rice?.target ?? 0);
    expect(groupsByField(result).size).toBeGreaterThanOrEqual(Math.ceil(eligible / 3));
  });

  it('is deterministic and independent of tile input order', () => {
    const plan = board();
    const a = generateGameboardBiomeRegions(plan, spec);
    const b = generateGameboardBiomeRegions({ ...plan, tiles: [...plan.tiles].reverse() }, spec);
    const c = generateGameboardBiomeRegions(plan, spec);
    expect(snapshot(a.plan)).toEqual(snapshot(c.plan));
    expect(snapshot(a.plan)).toEqual(snapshot({ ...b.plan, tiles: [...b.plan.tiles].reverse() }));
    expect(a.report).toEqual(b.report);
    const other = generateGameboardBiomeRegions(plan, { ...spec, seed: 'patchwork:other' });
    expect(snapshot(other.plan)).not.toEqual(snapshot(a.plan));
  });

  it('keeps pinned tiles, their fields and their identity untouched', () => {
    const pins: readonly Pin[] = [
      { at: { q: 5, r: 5 }, biome: 'orchard', fields: { field: 99, historical: 1 } },
      { at: { q: 6, r: 5 }, fields: { historical: 2 } },
    ];
    const plan = board({ pins });
    const { plan: result, report } = generateGameboardBiomeRegions(plan, spec);
    for (const pin of pins) {
      const key = hexKey(pin.at);
      expect(result.tiles.find((tile) => tile.key === key)).toBe(
        plan.tiles.find((tile) => tile.key === key)
      );
    }
    expect(report.pinned).toBe(2);
    expect(report.biomes.wheat?.actual).toBe(Math.floor(plan.tiles.length * 0.4 - 2 * 0.4));
  });

  it('merges the region id into existing fields and keeps them name-sorted', () => {
    const { plan: result } = generateGameboardBiomeRegions(
      board({ fields: () => ({ zeta: 1, alpha: 2 }) }),
      spec
    );
    const claimed = result.tiles.find((tile) => tile.biome === 'wheat');
    expect(Object.keys(claimed?.fields ?? {})).toEqual(['alpha', 'field', 'slope', 'zeta']);
    expect(claimed?.fields).toMatchObject({ alpha: 2, slope: 0.05, zeta: 1 });
    const fill = result.tiles.find((tile) => tile.biome === 'pasture');
    expect(fill?.fields).not.toHaveProperty('field');
  });

  it('shares the board fairly between capped biomes', () => {
    const plan = board();
    const { report, plan: result } = generateGameboardBiomeRegions(plan, {
      ...spec,
      biomes: [
        { biome: 'wheat', target: 0.45, sources: { count: 2 }, maxRegion: 5 },
        { biome: 'corn', target: 0.45, sources: { count: 2 }, maxRegion: 5 },
      ],
    });
    const total = Math.floor(plan.tiles.length * 0.45);
    expect(report.biomes.wheat?.actual).toBe(total);
    expect(report.biomes.corn?.actual).toBe(total);
    expect(groupsByField(result).size).toBe(
      (report.biomes.wheat?.fields ?? 0) + (report.biomes.corn?.fields ?? 0)
    );
    for (const keys of groupsByField(result).values()) expect(keys.length).toBeLessThanOrEqual(5);
  });

  it('lets two capped crops start from one shared source tile', () => {
    const { report } = generateGameboardBiomeRegions(board(), {
      ...spec,
      biomes: [
        { biome: 'wheat', target: 0.1, sources: { tiles: [{ q: 9, r: 6 }] }, maxRegion: 4 },
        { biome: 'corn', target: 0.1, sources: { tiles: [{ q: 9, r: 6 }] }, maxRegion: 4 },
      ],
    });
    expect(report.biomes.wheat?.actual).toBe(28);
    expect(report.biomes.corn?.actual).toBe(28);
  });

  it('grows a region from a pinned source tile and ignores unusable or surplus sources', () => {
    const plan = board({ pins: [{ at: { q: 9, r: 6 }, biome: 'orchard' }] });
    const { plan: result, report } = generateGameboardBiomeRegions(plan, {
      ...spec,
      biomes: [
        {
          biome: 'wheat',
          target: 0.05,
          sources: {
            tiles: [
              { q: 9, r: 6 },
              { q: 2, r: 2 },
              { q: 15, r: 10 },
            ],
          },
          requires: [{ field: 'slope', max: 0.1 }],
          maxRegion: 5,
        },
      ],
    });
    expect(report.biomes.wheat?.actual).toBe(13);
    expect(report.biomes.wheat?.sources).toHaveLength(3);
    const first = groupsByField(result).get(1) ?? [];
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(5);
    expect(first.some((key) => neighbors({ q: 9, r: 6 }).map(hexKey).includes(key))).toBe(true);
  });

  it('skips explicit sources that are ineligible', () => {
    const plan = board({ fields: (q) => ({ wet: q < 3 ? 1 : 0 }) });
    const { report } = generateGameboardBiomeRegions(plan, {
      ...spec,
      biomes: [
        {
          biome: 'rice',
          target: 0.05,
          sources: {
            tiles: [
              { q: 10, r: 6 },
              { q: 1, r: 3 },
            ],
          },
          requires: [{ field: 'wet', min: 1 }],
          maxRegion: 5,
        },
      ],
    });
    expect(report.biomes.rice?.actual).toBe(14);
    expect(report.biomes.rice?.fields).toBeGreaterThanOrEqual(3);
  });

  it('hands a region to another biome when that biome claimed its sole source tile', () => {
    const { report } = generateGameboardBiomeRegions(board(), {
      ...spec,
      biomes: [
        { biome: 'corn', target: 0.05, sources: { tiles: [{ q: 9, r: 6 }] }, maxRegion: 3 },
        {
          biome: 'wheat',
          target: 0.05,
          sources: { tiles: [{ q: 9, r: 6 }] },
          maxRegion: 3,
        },
      ],
    });
    expect(report.biomes.corn?.actual).toBe(14);
    expect(report.biomes.wheat?.actual).toBe(14);
  });

  it('honours affinity and edge noise while capping', () => {
    const plan = board();
    const plain = generateGameboardBiomeRegions(plan, spec);
    const shaped = generateGameboardBiomeRegions(plan, {
      ...spec,
      edgeNoise: 0.5,
      affinity: [{ a: 'wheat', b: 'wheat', weight: 2 }],
    });
    expect(snapshot(shaped.plan)).not.toEqual(snapshot(plain.plan));
    for (const keys of groupsByField(shaped.plan).values()) {
      expect(keys.length).toBeLessThanOrEqual(6);
    }
  });

  it('draws the first regions from seeded sources with spacing', () => {
    const { report } = generateGameboardBiomeRegions(board(), spec);
    expect(report.biomes.wheat?.sources).toHaveLength(3);
  });

  it('weights new field seeds by suitability', () => {
    const plan = board({ fields: (q) => ({ soil: q / 19 }) });
    const rising = generateGameboardBiomeRegions(plan, {
      ...spec,
      biomes: [
        {
          biome: 'wheat',
          target: 0.2,
          sources: { count: 1 },
          suits: [{ field: 'soil', from: 0, to: 1, weight: 1000 }],
          maxRegion: 3,
        },
      ],
    });
    const falling = generateGameboardBiomeRegions(plan, {
      ...spec,
      biomes: [
        {
          biome: 'wheat',
          target: 0.2,
          sources: { count: 1 },
          suits: [{ field: 'soil', from: 1, to: 0, weight: 1000 }],
          maxRegion: 3,
        },
      ],
    });
    const mean = (result: typeof rising) => {
      const wheatTiles = result.plan.tiles.filter((tile) => tile.biome === 'wheat');
      return wheatTiles.reduce((sum, tile) => sum + tile.coordinates.q, 0) / wheatTiles.length;
    };
    expect(mean(rising)).toBeGreaterThan(mean(falling));
  });
});

describe('minRegion with maxRegion', () => {
  const small: GameboardBiomeRegionsSpec = {
    ...spec,
    biomes: [
      {
        biome: 'wheat',
        target: 8 / 280,
        sources: { tiles: [{ q: 9, r: 6 }] },
        maxRegion: 6,
        minRegion: 3,
      },
    ],
  };

  it('dissolves each undersized field even when it touches a larger one', () => {
    const { plan: result, report } = generateGameboardBiomeRegions(board(), small);
    expect(report.biomes.wheat?.actual).toBe(6);
    expect(report.biomes.wheat?.fields).toBe(1);
    expect(groupsByField(result).size).toBe(1);
  });

  it('keeps every surviving field at or above the minimum', () => {
    const { plan: result } = generateGameboardBiomeRegions(board(), {
      ...spec,
      biomes: [{ ...wheat, minRegion: 4 }],
    });
    for (const keys of groupsByField(result).values()) {
      expect(keys.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps an undersized field that continues a pinned region of the same biome', () => {
    const plan = board({ pins: [{ at: { q: 9, r: 6 }, biome: 'wheat' }] });
    const { plan: result } = generateGameboardBiomeRegions(plan, {
      ...small,
      biomes: [
        {
          biome: 'wheat',
          target: 2 / 279,
          sources: { tiles: [{ q: 9, r: 6 }] },
          maxRegion: 6,
          minRegion: 3,
        },
      ],
    });
    expect(result.tiles.filter((tile) => tile.biome === 'wheat')).toHaveLength(3);
    expect(groupsByField(result).size).toBe(1);
  });
});

describe('regionField without maxRegion', () => {
  it('gives each grown component its own id and leaves the biome shape unchanged', () => {
    const plan = board();
    const base: GameboardBiomeRegionsSpec = {
      seed: 'patchwork:uncapped',
      fill: 'pasture',
      biomes: [
        {
          biome: 'wheat',
          target: 0.2,
          sources: {
            tiles: [
              { q: 2, r: 2 },
              { q: 16, r: 10 },
            ],
          },
          minRegion: 3,
        },
      ],
    };
    const plain = generateGameboardBiomeRegions(plan, base);
    const tagged = generateGameboardBiomeRegions(plan, { ...base, regionField: 'field' });
    expect(tagged.plan.tiles.map((tile) => tile.biome)).toEqual(
      plain.plan.tiles.map((tile) => tile.biome)
    );
    expect(plain.report.biomes.wheat).not.toHaveProperty('fields');
    const groups = groupsByField(tagged.plan);
    expect(groups.size).toBe(2);
    expect(tagged.report.biomes.wheat?.fields).toBe(2);
    for (const keys of groups.values()) expect(connected(tagged.plan, keys)).toBe(true);
  });

  it('numbers capped and uncapped biomes of one stage without collisions', () => {
    const { plan: result, report } = generateGameboardBiomeRegions(board(), {
      ...spec,
      biomes: [
        { biome: 'wheat', target: 0.2, sources: { count: 2, spacing: 4 }, maxRegion: 5 },
        { biome: 'woods', target: 0.1, sources: { tiles: [{ q: 1, r: 1 }] } },
      ],
    });
    const groups = groupsByField(result);
    expect(groups.size).toBe(
      (report.biomes.wheat?.fields ?? 0) + (report.biomes.woods?.fields ?? 0)
    );
    for (const keys of groups.values()) {
      const biomes = new Set(keys.map((key) => result.tiles.find((t) => t.key === key)?.biome));
      expect(biomes.size).toBe(1);
    }
  });

  it('reports the number of fields for a capped biome even without a regionField', () => {
    const { report, plan: result } = generateGameboardBiomeRegions(board(), {
      ...spec,
      regionField: undefined,
      biomes: [wheat],
    });
    expect(report.biomes.wheat?.fields).toBeGreaterThan(1);
    expect(result.tiles.some((tile) => tile.fields && 'field' in tile.fields)).toBe(false);
  });
});

describe('region ids across stages', () => {
  const stages: GameboardBiomeRegionsSpec[] = [
    {
      seed: 'patchwork:one',
      fill: 'pasture',
      regionField: 'field',
      biomes: [{ biome: 'wheat', target: 0.2, sources: { count: 2 }, maxRegion: 5 }],
    },
    {
      seed: 'patchwork:two',
      fill: 'pasture',
      regionField: 'field',
      biomes: [{ biome: 'corn', target: 0.2, sources: { count: 2 }, maxRegion: 5 }],
    },
  ];

  it('never reuses an id that an earlier stage wrote to the same field', () => {
    const result = applyGameboardBiomeRegionStages(board(), stages);
    const first = generateGameboardBiomeRegions(board(), stages[0] as GameboardBiomeRegionsSpec);
    const firstIds = new Set(groupsByField(first.plan).keys());
    const groups = groupsByField(result);
    const cornIds = new Set<number>();
    for (const [id, keys] of groups) {
      const biomes = new Set(keys.map((key) => result.tiles.find((t) => t.key === key)?.biome));
      expect(biomes.size).toBe(1);
      if (biomes.has('corn')) cornIds.add(id);
    }
    expect(cornIds.size).toBeGreaterThan(0);
    for (const id of cornIds) expect(firstIds.has(id)).toBe(false);
    expect(Math.min(...cornIds)).toBe(Math.max(...firstIds) + 1);
    expect(groups.size).toBe(firstIds.size + cornIds.size);
  });

  it('offsets past ids already authored on the plan, including pinned tiles', () => {
    const plan = board({ pins: [{ at: { q: 0, r: 0 }, fields: { field: 7.5 } }] });
    const { plan: result } = generateGameboardBiomeRegions(
      plan,
      stages[0] as GameboardBiomeRegionsSpec
    );
    const ids = [...groupsByField(result).keys()].filter((id) => id !== 7.5);
    expect(Math.min(...ids)).toBe(9);
  });

  it('writes separate fields independently', () => {
    const result = applyGameboardBiomeRegionStages(board(), [
      stages[0] as GameboardBiomeRegionsSpec,
      { ...(stages[1] as GameboardBiomeRegionsSpec), regionField: 'plot' },
    ]);
    expect(Math.min(...groupsByField(result, 'plot').keys())).toBe(1);
    expect(Math.min(...groupsByField(result, 'field').keys())).toBe(1);
  });
});

describe('region options validation', () => {
  const plan = board({ width: 6, height: 5 });
  const base: GameboardBiomeRegionRule = { biome: 'woods', target: 0.4, sources: { count: 1 } };

  it.each([
    { maxRegion: 0 },
    { maxRegion: -1 },
    { maxRegion: 1.5 },
    { maxRegion: Number.NaN },
    { maxRegion: Number.POSITIVE_INFINITY },
    { minRegion: 4, maxRegion: 3 },
  ] satisfies Partial<GameboardBiomeRegionRule>[])('rejects rule intent %j', (override) => {
    expect(() =>
      generateGameboardBiomeRegions(plan, {
        seed: 'v',
        fill: 'pasture',
        biomes: [{ ...base, ...override }],
      })
    ).toThrow(GameboardValidationError);
  });

  it('accepts an equal minimum and maximum', () => {
    expect(() =>
      generateGameboardBiomeRegions(plan, {
        seed: 'v',
        fill: 'pasture',
        biomes: [{ ...base, minRegion: 3, maxRegion: 3 }],
      })
    ).not.toThrow();
  });

  it.each(['', '__proto__', 'constructor', 'prototype', 7 as unknown as string])(
    'rejects the region field name %j',
    (regionField) => {
      expect(() =>
        generateGameboardBiomeRegions(plan, {
          seed: 'v',
          fill: 'pasture',
          regionField,
          biomes: [base],
        })
      ).toThrow(GameboardValidationError);
    }
  );
});

describe('capped regions under review cases', () => {
  it('plants no field for a capped rule that asks for no sources', () => {
    for (const sources of [{ count: 0 }, { tiles: [] }] as const) {
      const { report } = generateGameboardBiomeRegions(board(), {
        ...spec,
        biomes: [{ biome: 'wheat', target: 0.3, sources, maxRegion: 4 }],
      });
      expect(report.biomes.wheat?.actual).toBe(0);
      expect(report.biomes.wheat?.fields).toBe(0);
    }
  });

  it('keeps every field contiguous when its source tile is already taken', () => {
    // The source is pinned to another biome in open land; a field seeded from
    // it must grow from one neighbour, not take neighbours on opposite sides.
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const plan = board({ pins: [{ at: { q: 9, r: 6 }, biome: 'orchard' }] });
      const { plan: result } = generateGameboardBiomeRegions(plan, {
        ...spec,
        seed: `occupied:${seed}`,
        edgeNoise: 1,
        biomes: [
          { biome: 'wheat', target: 0.02, sources: { tiles: [{ q: 9, r: 6 }] }, maxRegion: 4 },
        ],
      });
      for (const keys of groupsByField(result).values()) {
        expect(connected(result, keys)).toBe(true);
      }
    }
  });

  it('starts nothing on a taken source with no free eligible neighbour, and plants elsewhere', () => {
    // The source at (9, 6) is pinned; of its neighbours, three are pinned and
    // three are too steep for wheat, so its field cannot start there.
    const ring = neighbors({ q: 9, r: 6 });
    const plan = board({
      pins: [
        { at: { q: 9, r: 6 }, biome: 'orchard' },
        ...ring.slice(0, 3).map((at) => ({ at, biome: 'orchard' })),
      ],
      fields: (q, r): Record<string, number> =>
        ring.slice(3).some((at) => at.q === q && at.r === r) ? { slope: 0.5 } : {},
    });
    const { plan: result, report } = generateGameboardBiomeRegions(plan, {
      ...spec,
      biomes: [
        {
          biome: 'wheat',
          target: 0.05,
          sources: { tiles: [{ q: 9, r: 6 }] },
          requires: [{ field: 'slope', max: 0.1 }],
          maxRegion: 4,
        },
      ],
    });
    const byKey = new Map(result.tiles.map((tile) => [tile.key, tile]));
    for (const at of ring.slice(3)) expect(byKey.get(hexKey(at))?.biome).not.toBe('wheat');
    // The biome had a field to start from, so it still planted its target elsewhere.
    expect(report.biomes.wheat?.actual).toBeGreaterThan(0);
  });

  it('refuses region ids it could not keep unique', () => {
    const plan = board({ pins: [{ at: { q: 0, r: 0 }, fields: { field: 2 ** 53 } }] });
    expect(() => generateGameboardBiomeRegions(plan, spec)).toThrow(GameboardValidationError);
  });

  it('plants the same patchwork however many fields it plants', () => {
    // One-tile fields plant a field per claim: the planting path at its busiest.
    const single = { ...spec, biomes: [{ ...wheat, target: 0.3, maxRegion: 1 }] };
    const first = generateGameboardBiomeRegions(board({ width: 30, height: 24 }), single);
    const again = generateGameboardBiomeRegions(board({ width: 30, height: 24 }), single);
    expect(again).toEqual(first);
    expect(first.report.biomes.wheat?.fields).toBe(first.report.biomes.wheat?.actual);
  });
});

describe('backward compatibility', () => {
  it('reproduces the exact pre-capping output of the shared biome country', () => {
    const digests = ['gettysburg', 'antietam', 'seed-3'].map((seed) =>
      createHash('sha256')
        .update(JSON.stringify(createBiomeCountry(seed)))
        .digest('hex')
    );
    expect(digests).toEqual([
      '15035a6a8d3fa3c6879db526be7d4bd4f61ee895f2909c6891711e91d09e9c5f',
      'ddae101e0d7cddad3dfe18642ffcf8b9f2957e1ab530178ed183e28d5557a328',
      'c330979912f3725a8de011d76d873226e7917ed6fca45869bdbe931c34cc9558',
    ]);
  });
});
