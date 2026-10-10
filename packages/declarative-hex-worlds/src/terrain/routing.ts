/**
 * `src/terrain/routing.ts` — least-cost roads across a height field.
 *
 * Country roads were laid out by people walking and driving teams: they
 * follow contours rather than climbing straight up, bend around wet or
 * private ground, keep to field edges, and cross streams where they must.
 * `routeAcrossTerrain` finds such a route as a least-cost path over the
 * field's sample grid:
 *
 * - A step of length `d` and grade `g` (rise over run) costs
 *   `d × ((1 + slopePenalty × g²) × prefer + extra)`, integrated along the
 *   step; steps steeper than `maxGrade` are impassable.
 * - `prefer` is 1, lowered within a corridor around preferred lines (field
 *   boundaries, existing lanes) by up to their `discount`.
 * - `extra` adds the `extraCost` of every `avoid` polygon covering the
 *   ground (`impassable` polygons block it) and `groundCost(x, z)` — any
 *   per-position cost such as marsh, ponds or woods (`Infinity` blocks).
 * - Every crossing of a `water` polyline adds `crossingCost`.
 *
 * The search is A* with the straight-line distance times the cheapest
 * per-unit cost as its heuristic, which is consistent, so the path is
 * optimal; equal priorities break by sample index, so it is deterministic.
 * By default each sample connects to 16 neighbours (the 8 adjacent and the
 * 8 knight moves), so headings change in steps of about 27° instead of 45°
 * and gentle curves do not degrade into staircase zig-zags; 8 and 32 are
 * also available. The grid path is then simplified (Douglas–Peucker) and
 * smoothed (Chaikin, after splitting segments to at most two sample
 * spacings, so curves round off locally and stay within about
 * `simplifyTolerance` plus half a spacing of the searched path rather than
 * cutting corners across avoided ground), and its ends are moved onto the
 * requested points.
 *
 * `routeNetwork` joins sites (farms, a village, a mill) into a tree of
 * roads: the minimum spanning tree (Kruskal) of their pairwise route costs,
 * each link then routed in turn with ground under earlier roads discounted
 * by `reuseDiscount`, so later roads merge onto earlier ones. Shared ground
 * is emitted once: the result is a list of road segments between junctions
 * and sites.
 *
 * Only arithmetic, comparisons and Math.sqrt touch the data, so output is
 * byte-identical everywhere. No randomness is involved.
 *
 * @module
 */
import { GameboardValidationError } from '../errors';
import { gridSpacing, type HeightField } from './field';
import {
  createPolylineIndex,
  type GroundPoint,
  type GroundPolygon,
  type GroundPolyline,
  polygonContains,
  polylineLength,
  simplifyPolyline,
  smoothPolyline,
  smoothstep,
  subdividePolyline,
} from './geometry2d';
import {
  SamplePriorityQueue,
  validateSearchField,
  validateSmoothing,
  validateTolerance,
} from './grid-search';

/** Largest field the route searches accept (2048 × 2048 samples). */
export const MAX_ROUTE_SAMPLES = 4_194_304;

/** Most sites {@link routeNetwork} joins in one call. */
export const MAX_NETWORK_SITES = 256;

/** Ground a route should avoid. */
export interface RouteAvoidArea {
  readonly polygon: GroundPolygon;
  /** Added to the per-unit cost inside the polygon (default 0). */
  readonly extraCost?: number;
  /** Routes never enter the polygon. */
  readonly impassable?: boolean;
}

/** A line a route should follow: field boundaries, an existing lane. */
export interface RoutePreferLine {
  readonly line: GroundPolyline;
  /** Distance from the line within which the discount applies, fading to 0 at the edge. */
  readonly corridor: number;
  /** 0 to below 1: the fraction of the per-unit cost saved on the line itself. */
  readonly discount: number;
}

/** Cost model and output shaping shared by {@link routeAcrossTerrain} and {@link routeNetwork}. */
export interface RouteAcrossTerrainOptions {
  /** Weight of grade² in the per-unit cost (default 100: a 10 % grade doubles it). */
  readonly slopePenalty?: number;
  /** Steps steeper than this grade (rise over run) are impassable. */
  readonly maxGrade?: number;
  readonly avoid?: readonly RouteAvoidArea[];
  /**
   * Added per-unit cost at a position (marsh, ponds, woods), evaluated at
   * every sample; non-negative, or `Infinity` for impassable ground.
   */
  readonly groundCost?: (x: number, z: number) => number;
  readonly prefer?: readonly RoutePreferLine[];
  /** Streams and ditches; each crossing adds `crossingCost`. */
  readonly water?: readonly GroundPolyline[];
  /** Cost of one water crossing, in per-unit-cost × world units (default 0). */
  readonly crossingCost?: number;
  /** Grid connectivity: 8, 16 (default) or 32 neighbours per sample. */
  readonly neighbours?: 8 | 16 | 32;
  /** Douglas–Peucker tolerance in world units (default half the larger sample spacing). */
  readonly simplifyTolerance?: number;
  /** Chaikin smoothing passes, 0–8 (default 3). */
  readonly smoothing?: number;
  /** Most samples one search may expand before giving up with an error (default: all). */
  readonly maxExpansions?: number;
}

/** A routed road. */
export interface TerrainRoute {
  /** From the start point to the end point, simplified and smoothed. */
  readonly points: readonly GroundPoint[];
  /** Total cost of the underlying grid path. */
  readonly cost: number;
  /** Length of `points` in world units. */
  readonly length: number;
}

/** Options for {@link routeNetwork}. */
export interface RouteNetworkOptions extends RouteAcrossTerrainOptions {
  /** 0 to below 1: per-unit cost saved on ground under an earlier road (default 0.6). */
  readonly reuseDiscount?: number;
}

/** One link of the spanning tree: two sites joined by road. */
export interface RouteNetworkLink {
  /** Site indices, `from < to`. */
  readonly from: number;
  readonly to: number;
  /** Route cost between the two sites before any reuse discount. */
  readonly cost: number;
}

/** The result of {@link routeNetwork}. */
export interface TerrainRoadNetwork {
  /** Road segments between junctions and sites; shared ground appears once. */
  readonly roads: readonly (readonly GroundPoint[])[];
  /** Spanning-tree links in the order they were built (cheapest first). */
  readonly links: readonly RouteNetworkLink[];
}

/** A grid step: offsets, length, and how to sample along it. */
interface Move {
  readonly column: number;
  readonly row: number;
  readonly length: number;
  /** Sub-steps (the larger offset); every sub-point has one integral coordinate. */
  readonly steps: number;
  /** Per sub-point: sample offset, the next sample along the minor axis, and the blend. */
  readonly base: Int32Array;
  readonly next: Int32Array;
  readonly blend: Float64Array;
  /** Offsets of every sample in the step's bounding box (blocked if any is). */
  readonly box: Int32Array;
}

/** Counts crossings of a step with indexed water polylines. */
interface WaterIndex {
  crossings(a: GroundPoint, b: GroundPoint): number;
}

/** A field prepared for searching. */
interface CostSurface {
  readonly field: HeightField;
  readonly spacingX: number;
  readonly spacingZ: number;
  readonly slopePenalty: number;
  readonly maxGrade: number;
  /** Per-sample cost multiplier from preferred lines (1 elsewhere). */
  readonly prefer: Float32Array;
  /** Per-sample added cost from avoid areas. */
  readonly extra: Float32Array;
  readonly blocked: Uint8Array;
  readonly water: WaterIndex | null;
  readonly crossingCost: number;
  readonly moves: readonly Move[];
  /** Lowest per-unit cost anywhere: the heuristic's scale. */
  readonly minFactor: number;
  readonly maxExpansions: number;
  readonly simplifyTolerance: number;
  readonly smoothing: number;
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = a < 0 ? -a : a;
  let y = b < 0 ? -b : b;
  while (y !== 0) {
    const r = x % y;
    x = y;
    y = r;
  }
  return x;
}

/** The primitive steps reaching up to `reach` samples away, in a fixed order. */
function buildMoves(reach: number, width: number, spacingX: number, spacingZ: number): Move[] {
  const moves: Move[] = [];
  for (let row = -reach; row <= reach; row += 1) {
    for (let column = -reach; column <= reach; column += 1) {
      if (greatestCommonDivisor(column, row) !== 1) continue;
      const steps = Math.max(Math.abs(column), Math.abs(row));
      const base = new Int32Array(steps + 1);
      const next = new Int32Array(steps + 1);
      const blend = new Float64Array(steps + 1);
      const columnMajor = Math.abs(column) >= Math.abs(row);
      for (let j = 0; j <= steps; j += 1) {
        // The major coordinate is integral; the minor one may fall between samples.
        const minor = ((columnMajor ? row : column) * j) / steps;
        const floor = Math.floor(minor);
        const major = ((columnMajor ? column : row) * j) / steps;
        const c = columnMajor ? major : floor;
        const r = columnMajor ? floor : major;
        base[j] = r * width + c;
        next[j] = (base[j] as number) + (columnMajor ? width : 1);
        blend[j] = minor - floor;
      }
      const box: number[] = [];
      for (let r = Math.min(0, row); r <= Math.max(0, row); r += 1) {
        for (let c = Math.min(0, column); c <= Math.max(0, column); c += 1) box.push(r * width + c);
      }
      const dx = column * spacingX;
      const dz = row * spacingZ;
      moves.push({
        column,
        row,
        length: Math.sqrt(dx * dx + dz * dz),
        steps,
        base,
        next,
        blend,
        box: Int32Array.from(box),
      });
    }
  }
  return moves;
}

/** Splits water polylines into short pieces bucketed on a coarse grid. */
function createWaterIndex(lines: readonly GroundPolyline[], cell: number): WaterIndex {
  const pieces: number[] = [];
  const closing: number[] = [];
  const buckets = new Map<string, number[]>();
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) {
      const a = line[i - 1] as GroundPoint;
      const b = line[i] as GroundPoint;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const count = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dz * dz) / cell));
      for (let k = 0; k < count; k += 1) {
        const x0 = a.x + (dx * k) / count;
        const z0 = a.z + (dz * k) / count;
        const x1 = a.x + (dx * (k + 1)) / count;
        const z1 = a.z + (dz * (k + 1)) / count;
        const index = pieces.length / 4;
        pieces.push(x0, z0, x1, z1);
        // A polyline's final piece includes its end point: a road passing
        // through a stream's mouth on the field's edge still crosses it.
        closing.push(i === line.length - 1 && k === count - 1 ? 1 : 0);
        for (
          let r = Math.floor(Math.min(z0, z1) / cell);
          r <= Math.floor(Math.max(z0, z1) / cell);
          r += 1
        ) {
          for (
            let c = Math.floor(Math.min(x0, x1) / cell);
            c <= Math.floor(Math.max(x0, x1) / cell);
            c += 1
          ) {
            const key = `${c},${r}`;
            const bucket = buckets.get(key);
            if (bucket) bucket.push(index);
            else buckets.set(key, [index]);
          }
        }
      }
    }
  }
  const stamps = new Int32Array(pieces.length / 4);
  let query = 0;
  return {
    crossings(a, b) {
      query += 1;
      let count = 0;
      const rx = b.x - a.x;
      const rz = b.z - a.z;
      for (
        let r = Math.floor(Math.min(a.z, b.z) / cell);
        r <= Math.floor(Math.max(a.z, b.z) / cell);
        r += 1
      ) {
        for (
          let c = Math.floor(Math.min(a.x, b.x) / cell);
          c <= Math.floor(Math.max(a.x, b.x) / cell);
          c += 1
        ) {
          for (const index of buckets.get(`${c},${r}`) ?? []) {
            if (stamps[index] === query) continue;
            stamps[index] = query;
            const qx = pieces[4 * index] as number;
            const qz = pieces[4 * index + 1] as number;
            const sx = (pieces[4 * index + 2] as number) - qx;
            const sz = (pieces[4 * index + 3] as number) - qz;
            const denominator = rx * sz - rz * sx;
            if (denominator === 0) continue;
            const px = qx - a.x;
            const pz = qz - a.z;
            const t = (px * sz - pz * sx) / denominator;
            const u = (px * rz - pz * rx) / denominator;
            // Half-open along both, so a crossing exactly at a piece joint or
            // at a sample between two steps counts once.
            if (t >= 0 && t < 1 && u >= 0 && (u < 1 || (u === 1 && closing[index] === 1))) {
              count += 1;
            }
          }
        }
      }
      return count;
    },
  };
}

function requireNonNegative(value: number, what: string): void {
  if (!(value >= 0) || !Number.isFinite(value)) {
    throw new GameboardValidationError(`${what} must be a non-negative number; got ${value}`);
  }
}

function requireDiscount(value: number, what: string): void {
  if (!(value >= 0 && value < 1)) {
    throw new GameboardValidationError(`${what} must be at least 0 and below 1; got ${value}`);
  }
}

/** Validates options and rasterises the cost model onto the field's grid. */
function buildCostSurface(
  field: HeightField,
  options: RouteAcrossTerrainOptions,
  what: string
): CostSurface {
  validateSearchField(field, MAX_ROUTE_SAMPLES, what);
  const spacing = gridSpacing(field);
  const slopePenalty = options.slopePenalty ?? 100;
  requireNonNegative(slopePenalty, `${what} slopePenalty`);
  const maxGrade = options.maxGrade ?? Number.POSITIVE_INFINITY;
  if (!(maxGrade > 0)) {
    throw new GameboardValidationError(`${what} maxGrade must be positive; got ${maxGrade}`);
  }
  const crossingCost = options.crossingCost ?? 0;
  requireNonNegative(crossingCost, `${what} crossingCost`);
  const neighbours = options.neighbours ?? 16;
  const reach = neighbours === 8 ? 1 : neighbours === 16 ? 2 : neighbours === 32 ? 3 : 0;
  if (reach === 0) {
    throw new GameboardValidationError(
      `${what} neighbours must be 8, 16 or 32; got ${String(neighbours)}`
    );
  }
  const simplifyTolerance = options.simplifyTolerance ?? Math.max(spacing.x, spacing.z) / 2;
  validateTolerance(simplifyTolerance, what);
  const smoothing = options.smoothing ?? 3;
  validateSmoothing(smoothing, what);
  const count = field.width * field.height;
  const maxExpansions = options.maxExpansions ?? count;
  if (!(maxExpansions > 0)) {
    throw new GameboardValidationError(
      `${what} maxExpansions must be positive; got ${maxExpansions}`
    );
  }

  const { width, bounds } = field;
  const at = (i: number): GroundPoint => {
    const column = i % width;
    return {
      x: bounds.minX + column * spacing.x,
      z: bounds.minZ + ((i - column) / width) * spacing.z,
    };
  };
  const prefer = new Float32Array(count).fill(1);
  for (const line of options.prefer ?? []) {
    if (!(line.corridor > 0) || !Number.isFinite(line.corridor)) {
      throw new GameboardValidationError(
        `${what} prefer corridor must be positive; got ${line.corridor}`
      );
    }
    requireDiscount(line.discount, `${what} prefer discount`);
    const index = createPolylineIndex(line.line, line.corridor);
    for (let i = 0; i < count; i += 1) {
      const distance = index.distanceWithin(at(i));
      const factor = 1 - line.discount * (1 - smoothstep(0, line.corridor, distance));
      if (factor < (prefer[i] as number)) prefer[i] = factor;
    }
  }
  const extra = new Float32Array(count);
  const blocked = new Uint8Array(count);
  for (const area of options.avoid ?? []) {
    if (area.polygon.length < 3) {
      throw new GameboardValidationError(`${what} avoid polygon needs at least three points`);
    }
    const extraCost = area.extraCost ?? 0;
    requireNonNegative(extraCost, `${what} avoid extraCost`);
    for (let i = 0; i < count; i += 1) {
      if (!polygonContains(area.polygon, at(i))) continue;
      extra[i] = (extra[i] as number) + extraCost;
      if (area.impassable) blocked[i] = 1;
    }
  }
  const { groundCost } = options;
  if (groundCost !== undefined) {
    for (let i = 0; i < count; i += 1) {
      const point = at(i);
      const value = groundCost(point.x, point.z);
      if (value === Number.POSITIVE_INFINITY) blocked[i] = 1;
      else {
        requireNonNegative(value, `${what} groundCost`);
        extra[i] = (extra[i] as number) + value;
      }
    }
  }
  let minFactor = 1;
  for (const factor of prefer) if (factor < minFactor) minFactor = factor;
  const water = options.water ?? [];
  return {
    field,
    spacingX: spacing.x,
    spacingZ: spacing.z,
    slopePenalty,
    maxGrade,
    prefer,
    extra,
    blocked,
    water:
      water.length > 0 ? createWaterIndex(water, 4 * reach * Math.max(spacing.x, spacing.z)) : null,
    crossingCost,
    moves: buildMoves(reach, width, spacing.x, spacing.z),
    minFactor,
    maxExpansions,
    simplifyTolerance,
    smoothing,
  };
}

/** The value of `values` at sub-point `j` of `move` from sample `from`. */
function along(values: ArrayLike<number>, from: number, move: Move, j: number): number {
  const base = values[from + (move.base[j] as number)] as number;
  const t = move.blend[j] as number;
  return t === 0 ? base : base * (1 - t) + (values[from + (move.next[j] as number)] as number) * t;
}

/** World position of sample `i`. */
function samplePoint(surface: CostSurface, i: number): GroundPoint {
  const { width, bounds } = surface.field;
  const column = i % width;
  return {
    x: bounds.minX + column * surface.spacingX,
    z: bounds.minZ + ((i - column) / width) * surface.spacingZ,
  };
}

/** Cost of taking `move` from sample `from`; Infinity when blocked or too steep. */
function moveCost(surface: CostSurface, prefer: Float32Array, from: number, move: Move): number {
  for (const offset of move.box)
    if (surface.blocked[from + offset] === 1) return Number.POSITIVE_INFINITY;
  const heights = surface.field.heights;
  const run = move.length / move.steps;
  let cost = 0;
  let h0 = heights[from] as number;
  let p0 = prefer[from] as number;
  let e0 = surface.extra[from] as number;
  for (let j = 1; j <= move.steps; j += 1) {
    const h1 = along(heights, from, move, j);
    const p1 = along(prefer, from, move, j);
    const e1 = along(surface.extra, from, move, j);
    const grade = (h1 > h0 ? h1 - h0 : h0 - h1) / run;
    if (grade > surface.maxGrade) return Number.POSITIVE_INFINITY;
    cost += run * ((1 + surface.slopePenalty * grade * grade) * ((p0 + p1) / 2) + (e0 + e1) / 2);
    h0 = h1;
    p0 = p1;
    e0 = e1;
  }
  if (surface.water !== null) {
    const a = samplePoint(surface, from);
    const b = samplePoint(surface, from + move.row * surface.field.width + move.column);
    cost += surface.crossingCost * surface.water.crossings(a, b);
  }
  return cost;
}

/**
 * Least-cost search from `start`. With `goal` ≥ 0 it is A* toward that
 * sample; otherwise Dijkstra until every sample in `targets` is settled.
 */
function search(
  surface: CostSurface,
  prefer: Float32Array,
  minFactor: number,
  start: number,
  goal: number,
  targets: readonly number[]
): { cost: Float64Array; parent: Int32Array } {
  const { width, height } = surface.field;
  const count = width * height;
  const cost = new Float64Array(count).fill(Number.POSITIVE_INFINITY);
  const parent = new Int32Array(count).fill(-1);
  const closed = new Uint8Array(count);
  const pending = new Uint8Array(count);
  let remaining = 0;
  for (const target of targets) {
    if (pending[target] === 0) remaining += 1;
    pending[target] = 1;
  }
  const goalPoint = goal >= 0 ? samplePoint(surface, goal) : null;
  const heuristic = (i: number): number => {
    if (goalPoint === null) return 0;
    const p = samplePoint(surface, i);
    const dx = p.x - goalPoint.x;
    const dz = p.z - goalPoint.z;
    return Math.sqrt(dx * dx + dz * dz) * minFactor;
  };
  const queue = new SamplePriorityQueue();
  cost[start] = 0;
  queue.push(heuristic(start), start, start);
  let expansions = 0;
  while (queue.size > 0 && remaining > 0) {
    const cell = queue.pop();
    if (closed[cell] === 1) continue;
    closed[cell] = 1;
    if (pending[cell] === 1) remaining -= 1;
    expansions += 1;
    if (expansions > surface.maxExpansions) {
      throw new GameboardValidationError(
        `route search exceeded ${surface.maxExpansions} expanded samples`
      );
    }
    const column = cell % width;
    const row = (cell - column) / width;
    const base = cost[cell] as number;
    for (const move of surface.moves) {
      const c = column + move.column;
      const r = row + move.row;
      if (c < 0 || r < 0 || c >= width || r >= height) continue;
      const next = r * width + c;
      if (closed[next] === 1) continue;
      const candidate = base + moveCost(surface, prefer, cell, move);
      if (candidate < (cost[next] as number)) {
        cost[next] = candidate;
        parent[next] = cell;
        queue.push(candidate + heuristic(next), next, next);
      }
    }
  }
  return { cost, parent };
}

/** Samples from `start` to `goal` along `parent` links. */
function tracePath(parent: Int32Array, start: number, goal: number): number[] {
  const cells = [goal];
  let cell = goal;
  while (cell !== start) {
    cell = parent[cell] as number;
    cells.push(cell);
  }
  return cells.reverse();
}

/** The sample nearest a point inside the field; throws outside it. */
function nearestSample(surface: CostSurface, point: GroundPoint, what: string): number {
  const { bounds, width, height } = surface.field;
  if (
    !(point.x >= bounds.minX && point.x <= bounds.maxX) ||
    !(point.z >= bounds.minZ && point.z <= bounds.maxZ)
  ) {
    throw new GameboardValidationError(`${what} (${point.x}, ${point.z}) lies outside the field`);
  }
  const column = Math.min(width - 1, Math.round((point.x - bounds.minX) / surface.spacingX));
  const row = Math.min(height - 1, Math.round((point.z - bounds.minZ) / surface.spacingZ));
  return row * width + column;
}

/** Simplified, smoothed polyline through the samples with its ends replaced. */
function shapeRoad(
  surface: CostSurface,
  cells: readonly number[],
  first: GroundPoint,
  last: GroundPoint
): GroundPoint[] {
  const raw = cells.map((cell) => samplePoint(surface, cell));
  raw[0] = first;
  raw[raw.length - 1] = last;
  const simplified = simplifyPolyline(raw, surface.simplifyTolerance);
  const maxSegment = 2 * Math.max(surface.spacingX, surface.spacingZ);
  return smoothPolyline(subdividePolyline(simplified, maxSegment).points, surface.smoothing);
}

/**
 * Least-cost road from `from` to `to` (both inside the field), or `null`
 * when impassable ground separates them. See the module documentation.
 */
export function routeAcrossTerrain(
  field: HeightField,
  from: GroundPoint,
  to: GroundPoint,
  options: RouteAcrossTerrainOptions = {}
): TerrainRoute | null {
  const surface = buildCostSurface(field, options, 'route');
  const start = nearestSample(surface, from, 'route start');
  const goal = nearestSample(surface, to, 'route end');
  const result = search(surface, surface.prefer, surface.minFactor, start, goal, [goal]);
  const cost = result.cost[goal] as number;
  if (cost === Number.POSITIVE_INFINITY) return null;
  const cells = tracePath(result.parent, start, goal);
  const points =
    cells.length === 1
      ? [
          { x: from.x, z: from.z },
          { x: to.x, z: to.z },
        ]
      : shapeRoad(surface, cells, from, to);
  return { points, cost, length: polylineLength(points) };
}

/** Joins sites into a tree of roads. See the module documentation. */
export function routeNetwork(
  field: HeightField,
  sites: readonly GroundPoint[],
  options: RouteNetworkOptions = {}
): TerrainRoadNetwork {
  const surface = buildCostSurface(field, options, 'road network');
  if (sites.length > MAX_NETWORK_SITES) {
    throw new GameboardValidationError(
      `road network joins at most ${MAX_NETWORK_SITES} sites; got ${sites.length}`
    );
  }
  const reuseDiscount = options.reuseDiscount ?? 0.6;
  requireDiscount(reuseDiscount, 'road network reuseDiscount');
  const cells = sites.map((site, i) => nearestSample(surface, site, `road network site ${i}`));

  // Pairwise costs: one Dijkstra per site settles every later site.
  const pairs: RouteNetworkLink[] = [];
  cells.forEach((start, from) => {
    const later = cells.slice(from + 1);
    if (later.length === 0) return;
    const { cost } = search(surface, surface.prefer, surface.minFactor, start, -1, later);
    later.forEach((cell, k) => {
      const value = cost[cell] as number;
      if (value !== Number.POSITIVE_INFINITY) pairs.push({ from, to: from + 1 + k, cost: value });
    });
  });
  pairs.sort((a, b) => a.cost - b.cost || a.from - b.from || a.to - b.to);

  // Kruskal: the cheapest links that join separate components.
  const component = sites.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (component[root] !== root) root = component[root] as number;
    return root;
  };
  const links: RouteNetworkLink[] = [];
  for (const pair of pairs) {
    const a = find(pair.from);
    const b = find(pair.to);
    if (a === b) continue;
    component[Math.max(a, b)] = Math.min(a, b);
    links.push(pair);
  }

  // Route each link with ground under earlier roads discounted, recording
  // the grid steps every road takes.
  const { width } = field;
  const prefer = Float32Array.from(surface.prefer);
  const onRoad = new Uint8Array(prefer.length);
  const minFactor = surface.minFactor * (1 - reuseDiscount);
  const adjacency = new Map<number, number[]>();
  const connect = (a: number, b: number): void => {
    const list = adjacency.get(a);
    if (list === undefined) adjacency.set(a, [b]);
    else if (!list.includes(b)) list.push(b);
  };
  for (const link of links) {
    const start = cells[link.from] as number;
    const goal = cells[link.to] as number;
    const { parent } = search(surface, prefer, minFactor, start, goal, [goal]);
    const path = tracePath(parent, start, goal);
    for (let k = 1; k < path.length; k += 1) {
      const a = path[k - 1] as number;
      const b = path[k] as number;
      connect(a, b);
      connect(b, a);
      const ac = a % width;
      const bc = b % width;
      const ar = (a - ac) / width;
      const br = (b - bc) / width;
      for (let r = Math.min(ar, br); r <= Math.max(ar, br); r += 1) {
        for (let c = Math.min(ac, bc); c <= Math.max(ac, bc); c += 1) {
          const i = r * width + c;
          if (onRoad[i] === 1) continue;
          onRoad[i] = 1;
          prefer[i] = (prefer[i] as number) * (1 - reuseDiscount);
        }
      }
    }
  }

  // Split the road graph at junctions, dead ends and sites.
  const siteAt = new Map<number, GroundPoint>();
  cells.forEach((cell, i) => {
    if (!siteAt.has(cell)) siteAt.set(cell, sites[i] as GroundPoint);
  });
  const isBreak = (cell: number): boolean =>
    siteAt.has(cell) || (adjacency.get(cell) as number[]).length !== 2;
  const visited = new Set<string>();
  const edgeKey = (a: number, b: number): string => (a < b ? `${a},${b}` : `${b},${a}`);
  const roads: GroundPoint[][] = [];
  const nodes = [...adjacency.keys()].sort((a, b) => a - b);
  for (const node of nodes) {
    if (!isBreak(node)) continue;
    const neighbours = [...(adjacency.get(node) as number[])].sort((a, b) => a - b);
    for (const first of neighbours) {
      if (visited.has(edgeKey(node, first))) continue;
      visited.add(edgeKey(node, first));
      const chain = [node, first];
      let previous = node;
      let current = first;
      while (!isBreak(current)) {
        const [p, q] = adjacency.get(current) as number[];
        const next = p === previous ? (q as number) : (p as number);
        visited.add(edgeKey(current, next));
        chain.push(next);
        previous = current;
        current = next;
      }
      const head = siteAt.get(node) ?? samplePoint(surface, node);
      const tail = siteAt.get(current) ?? samplePoint(surface, current);
      roads.push(shapeRoad(surface, chain, head, tail));
    }
  }
  return { roads, links };
}
