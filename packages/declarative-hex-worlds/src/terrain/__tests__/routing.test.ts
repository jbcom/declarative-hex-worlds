import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import { composeHeightField } from '../compose';
import { createHeightField, fillHeightField, type HeightField, sampleHeight } from '../field';
import {
  distanceToPolyline,
  type GroundPoint,
  type GroundPolyline,
  polylineLength,
} from '../geometry2d';
import { MAX_NETWORK_SITES, MAX_ROUTE_SAMPLES, routeAcrossTerrain, routeNetwork } from '../routing';

const bounds = { minX: 0, minZ: 0, maxX: 200, maxZ: 200 };

function fieldOf(fn: (x: number, z: number) => number, spacing = 5): HeightField {
  const cells = 200 / spacing;
  const field = createHeightField({ bounds, width: cells + 1, height: cells + 1 });
  fillHeightField(field, fn);
  return field;
}

const level = fieldOf(() => 10);
/** A ridge across the middle with a low saddle at x = 150. */
const ridged = fieldOf((x, z) => {
  const crest = Math.max(0, 1 - Math.abs(z - 100) / 30);
  const saddle = Math.max(0, 1 - Math.abs(x - 150) / 20);
  return 40 * crest * (1 - 0.9 * saddle);
});
const hills = composeHeightField({
  bounds,
  spacing: 5,
  seed: 'routing',
  base: 20,
  layers: [
    { kind: 'noise', amplitude: 12, wavelength: 90, octaves: 3 },
    { kind: 'hill', center: { x: 100, z: 100 }, radius: 60, height: 30 },
  ],
});

/** Points every unit along a polyline, so checks see between its vertices. */
function densify(line: GroundPolyline): GroundPoint[] {
  const out: GroundPoint[] = [];
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1] as GroundPoint;
    const b = line[i] as GroundPoint;
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z)));
    for (let k = 0; k < steps; k += 1) {
      out.push({ x: a.x + ((b.x - a.x) * k) / steps, z: a.z + ((b.z - a.z) * k) / steps });
    }
  }
  out.push(line[line.length - 1] as GroundPoint);
  return out;
}

function crossings(route: GroundPolyline, line: GroundPolyline): number {
  let count = 0;
  for (let i = 1; i < route.length; i += 1) {
    const a = route[i - 1] as GroundPoint;
    const b = route[i] as GroundPoint;
    for (let j = 1; j < line.length; j += 1) {
      const c = line[j - 1] as GroundPoint;
      const d = line[j] as GroundPoint;
      const side = (p: GroundPoint, q: GroundPoint, r: GroundPoint) =>
        (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
      if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) count += 1;
    }
  }
  return count;
}

describe('routeAcrossTerrain', () => {
  it('runs straight across level ground, ending exactly on the requested points', () => {
    const from = { x: 12.3, z: 20.9 };
    const to = { x: 181, z: 170.2 };
    const route = routeAcrossTerrain(level, from, to);
    expect(route).not.toBeNull();
    const { points, cost, length } = route as NonNullable<typeof route>;
    expect(points[0]).toEqual(from);
    expect(points.at(-1)).toEqual(to);
    const direct = Math.hypot(to.x - from.x, to.z - from.z);
    expect(length).toBeGreaterThanOrEqual(direct - 1e-9);
    expect(length).toBeLessThan(direct * 1.03);
    expect(cost).toBeGreaterThan(direct * 0.95);
    expect(cost).toBeLessThan(direct * 1.05);
  });

  it('matches its endpoints for every pair of points', () => {
    const points = [
      { x: 0, z: 0 },
      { x: 200, z: 200 },
      { x: 3.2, z: 197.5 },
      { x: 101, z: 49 },
      { x: 160, z: 12 },
    ];
    for (const from of points) {
      for (const to of points) {
        const route = routeAcrossTerrain(hills, from, to);
        expect(route?.points[0]).toEqual(from);
        expect(route?.points.at(-1)).toEqual(to);
      }
    }
    expect(routeAcrossTerrain(hills, { x: 50, z: 50 }, { x: 51, z: 50 })).toEqual({
      points: [
        { x: 50, z: 50 },
        { x: 51, z: 50 },
      ],
      cost: 0,
      length: 1,
    });
  });

  it('costs more, never less, as the slope penalty grows, and detours to stay low', () => {
    const from = { x: 100, z: 5 };
    const to = { x: 100, z: 195 };
    let previous = 0;
    const climbs: number[] = [];
    for (const slopePenalty of [0, 10, 100, 1000, 10_000]) {
      const route = routeAcrossTerrain(ridged, from, to, { slopePenalty });
      const cost = (route as NonNullable<typeof route>).cost;
      expect(cost).toBeGreaterThanOrEqual(previous);
      previous = cost;
      const peak = Math.max(
        ...densify(route?.points ?? []).map((p) => sampleHeight(ridged, p.x, p.z))
      );
      climbs.push(peak);
    }
    // Without a penalty the road crosses the crest; with one it uses the saddle.
    expect(climbs[0]).toBeGreaterThan(30);
    expect(climbs[4]).toBeLessThan(10);
  });

  it('agrees with an exhaustive search on cost (the heuristic is consistent)', () => {
    const from = { x: 10, z: 30 };
    const to = { x: 190, z: 160 };
    const options = { slopePenalty: 300 };
    const route = routeAcrossTerrain(hills, from, to, options);
    const network = routeNetwork(hills, [from, to], options);
    expect(route?.cost).toBeCloseTo(network.links[0]?.cost as number, 6);
  });

  it('refuses steps steeper than maxGrade, and reports unreachable ground as null', () => {
    const from = { x: 20, z: 5 };
    const to = { x: 20, z: 195 };
    const gentle = routeAcrossTerrain(ridged, from, to, { slopePenalty: 0, maxGrade: 0.3 });
    expect(gentle).not.toBeNull();
    for (const point of gentle?.points ?? []) {
      if (Math.abs(point.z - 100) < 25) expect(point.x).toBeGreaterThan(120);
    }
    expect(routeAcrossTerrain(ridged, from, to, { maxGrade: 0.05 })).toBeNull();
  });

  it('avoids costly areas, passes impassable ones through gaps, and blocks enclosed points', () => {
    const from = { x: 20, z: 100 };
    const to = { x: 180, z: 100 };
    const marsh = [
      { x: 60, z: 40 },
      { x: 140, z: 40 },
      { x: 140, z: 160 },
      { x: 60, z: 160 },
    ];
    const wet = routeAcrossTerrain(level, from, to, { avoid: [{ polygon: marsh, extraCost: 5 }] });
    // Around the marsh, not through it: smoothing rounds the corners by
    // less than a sample spacing (5).
    for (const p of densify(wet?.points ?? [])) {
      expect(p.x > 65 && p.x < 135 && p.z > 45 && p.z < 155).toBe(false);
    }
    const free = routeAcrossTerrain(level, from, to, { avoid: [{ polygon: marsh }] });
    expect(free?.cost).toBeCloseTo(160, 6);
    // A wall across the field with one gap near the top.
    const wall = [
      { x: 98, z: -10 },
      { x: 102, z: -10 },
      { x: 102, z: 170 },
      { x: 98, z: 170 },
    ];
    const gapped = routeAcrossTerrain(level, from, to, {
      avoid: [{ polygon: wall, impassable: true }],
    });
    const atWall = densify(gapped?.points ?? []).filter((p) => Math.abs(p.x - 100) < 2);
    expect(atWall.length).toBeGreaterThan(0);
    expect(atWall.every((p) => p.z > 168)).toBe(true);
    const ring = [
      { x: 10, z: 90 },
      { x: 30, z: 90 },
      { x: 30, z: 110 },
      { x: 10, z: 110 },
    ];
    expect(
      routeAcrossTerrain(level, from, to, { avoid: [{ polygon: ring, impassable: true }] })
    ).toBeNull();
  });

  it('prices ground with a cost callback, where Infinity blocks', () => {
    const from = { x: 20, z: 100 };
    const to = { x: 180, z: 100 };
    const pond = (x: number, z: number) => (Math.hypot(x - 100, z - 100) < 40 ? 6 : 0);
    const skirting = routeAcrossTerrain(level, from, to, { groundCost: pond });
    expect(
      Math.min(...(skirting?.points ?? []).map((p) => Math.hypot(p.x - 100, p.z - 100)))
    ).toBeGreaterThan(35);
    const lake = (x: number, z: number) =>
      Math.hypot(x - 100, z - 100) < 40 ? Number.POSITIVE_INFINITY : 0;
    const around = routeAcrossTerrain(level, from, to, { groundCost: lake });
    expect(
      Math.min(...(around?.points ?? []).map((p) => Math.hypot(p.x - 100, p.z - 100)))
    ).toBeGreaterThan(38);
    expect(() => routeAcrossTerrain(level, from, to, { groundCost: () => Number.NaN })).toThrow(
      /groundCost must be a non-negative number/
    );
  });

  it('keeps to preferred lines within their corridor', () => {
    const from = { x: 10, z: 10 };
    const to = { x: 190, z: 190 };
    const lane = [
      { x: 10, z: 10 },
      { x: 10, z: 190 },
      { x: 190, z: 190 },
    ];
    const route = routeAcrossTerrain(level, from, to, {
      prefer: [{ line: lane, corridor: 10, discount: 0.8 }],
    });
    for (const point of route?.points ?? [])
      expect(distanceToPolyline(point, lane)).toBeLessThan(10);
    const ignored = routeAcrossTerrain(level, from, to, {
      prefer: [{ line: lane, corridor: 10, discount: 0 }],
    });
    expect(ignored?.length).toBeLessThan(260);
  });

  it('charges each stream crossing once and crosses no more than it must', () => {
    const from = { x: 20, z: 20 };
    const to = { x: 180, z: 180 };
    // A meandering stream between the points, its vertices on sample positions.
    const stream = [
      { x: 0, z: 200 },
      { x: 60, z: 130 },
      { x: 100, z: 100 },
      { x: 140, z: 70 },
      { x: 200, z: 0 },
    ];
    const dry = routeAcrossTerrain(level, from, to);
    const wet = routeAcrossTerrain(level, from, to, { water: [stream], crossingCost: 50 });
    // The straight road crosses exactly at the stream's vertex on a sample,
    // between two grid steps: charged once, not once per step.
    expect(wet?.cost).toBeCloseTo((dry?.cost as number) + 50, 6);
    // The stream is monotone in x, so count the road's changes of side.
    const streamZ = (x: number): number => {
      for (let i = 1; i < stream.length; i += 1) {
        const a = stream[i - 1] as GroundPoint;
        const b = stream[i] as GroundPoint;
        if (x <= b.x) return a.z + ((b.z - a.z) * (x - a.x)) / (b.x - a.x);
      }
      return 0;
    };
    const sides = densify(wet?.points ?? [])
      .map((p) => Math.sign(p.z - streamZ(p.x)))
      .filter((s) => s !== 0);
    expect(sides.filter((s, i) => i > 0 && s !== sides[i - 1])).toHaveLength(1);
    // Crossing a stream off the samples is charged once too.
    const offset = stream.map((p) => ({ x: p.x + 2.5, z: p.z }));
    const shifted = routeAcrossTerrain(level, from, to, { water: [offset], crossingCost: 50 });
    expect(crossings(shifted?.points ?? [], offset)).toBe(1);
    expect(shifted?.cost).toBeCloseTo((dry?.cost as number) + 50, 6);
    // A stream leaving the field cannot be dodged by walking the edge through its mouth.
    const outflow = [
      { x: 100, z: 100 },
      { x: 100, z: 0 },
    ];
    const edge = routeAcrossTerrain(
      level,
      { x: 20, z: 0 },
      { x: 180, z: 0 },
      {
        water: [outflow],
        crossingCost: 50,
      }
    );
    expect(edge?.cost).toBeCloseTo(210, 6);
    // A dear crossing is worth a detour round the stream's end.
    const pocket = [
      { x: 0, z: 100 },
      { x: 120, z: 100 },
      { x: 120, z: 130 },
      { x: 0, z: 130 },
    ];
    const around = routeAcrossTerrain(
      level,
      { x: 50, z: 10 },
      { x: 50, z: 190 },
      {
        water: [pocket],
        crossingCost: 500,
      }
    );
    expect(crossings(around?.points ?? [], pocket)).toBe(0);
    expect(around?.points.some((p) => p.x > 120)).toBe(true);
  });

  it('offers 8, 16 and 32 neighbours, finer reach giving straighter diagonals', () => {
    const from = { x: 0, z: 0 };
    const to = { x: 200, z: 100 };
    const costs = ([8, 16, 32] as const).map(
      (neighbours) => routeAcrossTerrain(level, from, to, { neighbours })?.cost as number
    );
    expect(costs[0]).toBeGreaterThan(costs[1] as number);
    expect(costs[1]).toBeGreaterThanOrEqual(costs[2] as number);
    expect(costs[2]).toBeCloseTo(Math.hypot(200, 100), 6);
  });

  it('works on fields spaced differently along X and Z', () => {
    const field = createHeightField({ bounds, width: 41, height: 21 });
    const route = routeAcrossTerrain(field, { x: 0, z: 0 }, { x: 200, z: 200 });
    expect(route?.cost).toBeCloseTo(Math.hypot(200, 200), 6);
  });

  it('is deterministic', () => {
    const options = {
      slopePenalty: 200,
      water: [
        [
          { x: 0, z: 120 },
          { x: 200, z: 80 },
        ],
      ],
      crossingCost: 30,
    };
    const a = routeAcrossTerrain(hills, { x: 5, z: 5 }, { x: 195, z: 190 }, options);
    const b = routeAcrossTerrain(hills, { x: 5, z: 5 }, { x: 195, z: 190 }, options);
    expect(a).toEqual(b);
  });

  it('validates its inputs', () => {
    const from = { x: 10, z: 10 };
    const to = { x: 100, z: 100 };
    const bad: [Parameters<typeof routeAcrossTerrain>[3], RegExp][] = [
      [{ slopePenalty: -1 }, /slopePenalty/],
      [{ maxGrade: 0 }, /maxGrade must be positive/],
      [{ crossingCost: Number.NaN }, /crossingCost/],
      [{ neighbours: 12 as 8 }, /neighbours must be 8, 16 or 32; got 12/],
      [{ simplifyTolerance: -1 }, /simplifyTolerance/],
      [{ smoothing: 2.5 }, /smoothing/],
      [{ maxExpansions: 0 }, /maxExpansions must be positive/],
      [{ prefer: [{ line: [from, to], corridor: 0, discount: 0.5 }] }, /prefer corridor/],
      [{ prefer: [{ line: [from, to], corridor: 5, discount: 1 }] }, /prefer discount/],
      [{ avoid: [{ polygon: [from, to] }] }, /avoid polygon needs at least three points/],
      [{ avoid: [{ polygon: [from, to, { x: 0, z: 90 }], extraCost: -2 }] }, /avoid extraCost/],
    ];
    for (const [options, message] of bad) {
      expect(() => routeAcrossTerrain(level, from, to, options)).toThrow(message);
    }
    expect(() => routeAcrossTerrain(level, { x: -1, z: 10 }, to)).toThrow(/route start/);
    expect(() => routeAcrossTerrain(level, from, { x: 10, z: 201 })).toThrow(/route end/);
    expect(() => routeAcrossTerrain(level, { x: Number.NaN, z: 0 }, to)).toThrow(
      GameboardValidationError
    );
    const huge = { ...level, width: 2049, height: 2049 };
    expect(() => routeAcrossTerrain(huge, from, to)).toThrow(
      new RegExp(`exceeds ${MAX_ROUTE_SAMPLES} samples`)
    );
    expect(() => routeAcrossTerrain(level, from, to, { maxExpansions: 10 })).toThrow(
      /exceeded 10 expanded samples/
    );
  });
});

describe('routeNetwork', () => {
  const village = { x: 100, z: 20 };
  const farms = [
    { x: 30, z: 170 },
    { x: 60, z: 180 },
    { x: 150, z: 175 },
    { x: 180, z: 120 },
  ];

  it('joins sites in a spanning tree whose roads meet every site', () => {
    const sites = [village, ...farms];
    const network = routeNetwork(hills, sites, { slopePenalty: 200 });
    expect(network.links).toHaveLength(sites.length - 1);
    for (let i = 1; i < network.links.length; i += 1) {
      expect(network.links[i]?.cost).toBeGreaterThanOrEqual(network.links[i - 1]?.cost as number);
    }
    for (const link of network.links) expect(link.from).toBeLessThan(link.to);
    // Every site is the end of some road.
    for (const site of sites) {
      const ends = network.roads.flatMap((road) => [road[0], road.at(-1)]);
      expect(ends).toContainEqual(site);
    }
    // Every road joins at junctions or sites: each end is a site or another road's end.
    const ends = network.roads.flatMap((road) => [road[0], road.at(-1)]);
    for (const end of ends) {
      const shared = ends.filter((e) => e?.x === end?.x && e?.z === end?.z).length;
      const isSite = sites.some((s) => s.x === end?.x && s.z === end?.z);
      expect(isSite || shared >= 3).toBe(true);
    }
  });

  it('merges later roads onto earlier ones instead of running beside them', () => {
    // A village below the hill and three farms beyond it.
    const sites = [
      { x: 100, z: 5 },
      { x: 40, z: 195 },
      { x: 160, z: 195 },
      { x: 100, z: 195 },
    ];
    const options = { slopePenalty: 200 };
    const merged = routeNetwork(hills, sites, { ...options, reuseDiscount: 0.9 });
    const separate = routeNetwork(hills, sites, { ...options, reuseDiscount: 0 });
    const total = (roads: readonly (readonly GroundPoint[])[]) =>
      roads.reduce((sum, road) => sum + polylineLength(road), 0);
    expect(total(merged.roads)).toBeLessThan(total(separate.roads) * 0.95);
    expect(merged.links).toEqual(separate.links);
    // Shared ground splits into segments that meet at a junction.
    expect(merged.roads.length).toBeGreaterThan(merged.links.length);
  });

  it('breaks cost ties by site index and is deterministic', () => {
    const square = [
      { x: 50, z: 50 },
      { x: 150, z: 50 },
      { x: 50, z: 150 },
      { x: 150, z: 150 },
    ];
    const a = routeNetwork(level, square);
    expect(a.links.map((l) => [l.from, l.to])).toEqual([
      [0, 1],
      [0, 2],
      [1, 3],
    ]);
    expect(routeNetwork(level, square)).toEqual(a);
  });

  it('handles empty, single, coincident and unreachable sites', () => {
    expect(routeNetwork(level, [])).toEqual({ roads: [], links: [] });
    expect(routeNetwork(level, [village])).toEqual({ roads: [], links: [] });
    const twin = routeNetwork(level, [village, { x: 100.4, z: 20.2 }, farms[0] as GroundPoint]);
    expect(twin.links[0]).toEqual({ from: 0, to: 1, cost: 0 });
    expect(twin.links).toHaveLength(2);
    // The road ends at the first of the coincident sites.
    expect(twin.roads.flatMap((road) => [road[0], road.at(-1)])).toContainEqual(village);
    const later = routeNetwork(level, [farms[0] as GroundPoint, village, { x: 100.4, z: 20.2 }]);
    expect(later.links.map((l) => l.cost)).toEqual([0, twin.links[1]?.cost]);
    const fenced = [
      { x: 20, z: 160 },
      { x: 40, z: 160 },
      { x: 40, z: 180 },
      { x: 20, z: 180 },
    ];
    const cut = routeNetwork(level, [village, farms[0] as GroundPoint, farms[2] as GroundPoint], {
      avoid: [{ polygon: fenced, impassable: true }],
    });
    expect(cut.links).toEqual([expect.objectContaining({ from: 0, to: 2 })]);
  });

  it('validates its inputs', () => {
    expect(() => routeNetwork(level, [village], { reuseDiscount: 1 })).toThrow(/reuseDiscount/);
    expect(() => routeNetwork(level, [village, { x: 300, z: 0 }])).toThrow(/road network site 1/);
    const many = Array.from({ length: MAX_NETWORK_SITES + 1 }, () => village);
    expect(() => routeNetwork(level, many)).toThrow(/at most 256 sites/);
    expect(() => routeNetwork(level, [village], { slopePenalty: -1 })).toThrow(/slopePenalty/);
  });
});
