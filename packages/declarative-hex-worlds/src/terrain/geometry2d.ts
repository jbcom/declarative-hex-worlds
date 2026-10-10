/**
 * `src/terrain/geometry2d.ts` — planar geometry on the board's ground plane
 * (world X/Z) used by terrain composition, biome painting, scatter and
 * drainage, including polyline simplification and smoothing.
 *
 * Only `+ - * /` and `Math.sqrt` are used, all of which IEEE 754 defines
 * exactly, so results are byte-identical across engines and platforms.
 *
 * @module
 */

/** A point on the ground plane, in world units. */
export interface GroundPoint {
  readonly x: number;
  readonly z: number;
}

/** An open polyline on the ground plane (roads, ridgelines, streams). */
export type GroundPolyline = readonly GroundPoint[];

/** A closed polygon on the ground plane; the closing edge is implicit. */
export type GroundPolygon = readonly GroundPoint[];

/** Axis-aligned bounds on the ground plane. */
export interface GroundBounds {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
}

/** Distance from `point` to the segment `a`–`b`. */
export function distanceToSegment(point: GroundPoint, a: GroundPoint, b: GroundPoint): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const lengthSq = abx * abx + abz * abz;
  let t = 0;
  if (lengthSq > 0) {
    t = ((point.x - a.x) * abx + (point.z - a.z) * abz) / lengthSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  const dx = point.x - (a.x + abx * t);
  const dz = point.z - (a.z + abz * t);
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Distance from `point` to the nearest point of `line`. A one-point line is a
 * point; an empty line is infinitely far away.
 */
export function distanceToPolyline(point: GroundPoint, line: GroundPolyline): number {
  const first = line[0];
  if (first === undefined) return Number.POSITIVE_INFINITY;
  if (line.length === 1) return distanceToSegment(point, first, first);
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1] as GroundPoint;
    const b = line[i] as GroundPoint;
    const d = distanceToSegment(point, a, b);
    if (d < best) best = d;
  }
  return best;
}

/** Even-odd point-in-polygon test. Points exactly on an edge may fall either way. */
export function polygonContains(polygon: GroundPolygon, point: GroundPoint): boolean {
  let inside = false;
  const count = polygon.length;
  for (let i = 0, j = count - 1; i < count; j = i, i += 1) {
    const a = polygon[i] as GroundPoint;
    const b = polygon[j] as GroundPoint;
    if (a.z > point.z !== b.z > point.z) {
      const crossX = ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x;
      if (point.x < crossX) inside = !inside;
    }
  }
  return inside;
}

/**
 * Signed distance to a polygon's boundary: negative inside, positive outside.
 * A polygon with fewer than three points has no inside.
 */
export function signedDistanceToPolygon(polygon: GroundPolygon, point: GroundPoint): number {
  const first = polygon[0];
  if (first === undefined) return Number.POSITIVE_INFINITY;
  const last = polygon[polygon.length - 1] as GroundPoint;
  const distance = Math.min(
    distanceToPolyline(point, polygon),
    distanceToSegment(point, last, first)
  );
  return polygon.length >= 3 && polygonContains(polygon, point) ? -distance : distance;
}

/**
 * Distance queries against a polyline that only matter within `cutoff`
 * (a ridge's half-width, a road's corridor). Segments are bucketed in a
 * uniform grid so each query tests only nearby segments — essential when a
 * long polyline is queried at every sample of a large field.
 */
export interface PolylineIndex {
  /** Exact distance when it is below the cutoff, otherwise `Infinity`. */
  distanceWithin(point: GroundPoint): number;
}

/** Builds a {@link PolylineIndex}. Pass `closed: true` to include the closing edge. */
export function createPolylineIndex(
  line: GroundPolyline,
  cutoff: number,
  options: { readonly closed?: boolean } = {}
): PolylineIndex {
  const segments: (readonly [GroundPoint, GroundPoint])[] = [];
  for (let i = 1; i < line.length; i += 1) {
    segments.push([line[i - 1] as GroundPoint, line[i] as GroundPoint]);
  }
  const first = line[0];
  if (line.length === 1 && first !== undefined) segments.push([first, first]);
  if (options.closed && line.length > 2 && first !== undefined) {
    segments.push([line[line.length - 1] as GroundPoint, first]);
  }
  if (segments.length === 0 || !(cutoff > 0)) {
    return { distanceWithin: () => Number.POSITIVE_INFINITY };
  }
  const cell = cutoff;
  const buckets = new Map<string, number[]>();
  segments.forEach(([a, b], index) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const r0 = Math.floor((Math.min(a.z, b.z) - cutoff) / cell);
    const r1 = Math.floor((Math.max(a.z, b.z) + cutoff) / cell);
    for (let r = r0; r <= r1; r += 1) {
      // A point in row r within `cutoff` of the segment has its nearest
      // segment point within this z-slab; bucket only the columns that slice
      // of the segment (grown by `cutoff`) can reach, so cell count grows
      // with segment length rather than with its bounding box's area.
      let xMin = Math.min(a.x, b.x);
      let xMax = Math.max(a.x, b.x);
      if (dz !== 0) {
        const tA = (r * cell - cutoff - a.z) / dz;
        const tB = ((r + 1) * cell + cutoff - a.z) / dz;
        const t0 = Math.max(0, Math.min(tA, tB));
        const t1 = Math.min(1, Math.max(tA, tB));
        const xa = a.x + dx * t0;
        const xb = a.x + dx * t1;
        xMin = Math.min(xa, xb);
        xMax = Math.max(xa, xb);
      }
      const c0 = Math.floor((xMin - cutoff) / cell);
      const c1 = Math.floor((xMax + cutoff) / cell);
      for (let c = c0; c <= c1; c += 1) {
        const key = `${c},${r}`;
        const bucket = buckets.get(key);
        if (bucket) bucket.push(index);
        else buckets.set(key, [index]);
      }
    }
  });
  return {
    distanceWithin(point) {
      const bucket = buckets.get(`${Math.floor(point.x / cell)},${Math.floor(point.z / cell)}`);
      if (!bucket) return Number.POSITIVE_INFINITY;
      let best = Number.POSITIVE_INFINITY;
      for (const index of bucket) {
        const [a, b] = segments[index] as readonly [GroundPoint, GroundPoint];
        const d = distanceToSegment(point, a, b);
        if (d < best) best = d;
      }
      return best < cutoff ? best : Number.POSITIVE_INFINITY;
    },
  };
}

/** The smallest bounds containing every point. Throws on an empty list. */
export function boundsOfPoints(points: readonly GroundPoint[]): GroundBounds {
  const first = points[0];
  if (first === undefined) throw new RangeError('boundsOfPoints needs at least one point');
  let minX = first.x;
  let minZ = first.z;
  let maxX = first.x;
  let maxZ = first.z;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.z < minZ) minZ = point.z;
    if (point.x > maxX) maxX = point.x;
    if (point.z > maxZ) maxZ = point.z;
  }
  return { minX, minZ, maxX, maxZ };
}

/** Total length of a polyline (0 for fewer than two points). */
export function polylineLength(line: GroundPolyline): number {
  let length = 0;
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1] as GroundPoint;
    const b = line[i] as GroundPoint;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    length += Math.sqrt(dx * dx + dz * dz);
  }
  return length;
}

/**
 * The point of `line` nearest to `point` (the first such point when several
 * are equally near). Throws on an empty line.
 */
export function closestPointOnPolyline(point: GroundPoint, line: GroundPolyline): GroundPoint {
  const first = line[0];
  if (first === undefined) throw new RangeError('closestPointOnPolyline needs at least one point');
  const squaredDistance = (q: GroundPoint): number =>
    (point.x - q.x) * (point.x - q.x) + (point.z - q.z) * (point.z - q.z);
  let best: GroundPoint = first;
  let bestSq = squaredDistance(first);
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1] as GroundPoint;
    const b = line[i] as GroundPoint;
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const lengthSq = abx * abx + abz * abz;
    let t = lengthSq > 0 ? ((point.x - a.x) * abx + (point.z - a.z) * abz) / lengthSq : 0;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const candidate = t === 1 ? b : { x: a.x + abx * t, z: a.z + abz * t };
    const dSq = squaredDistance(candidate);
    if (dSq < bestSq) {
      bestSq = dSq;
      best = candidate;
    }
  }
  return { x: best.x, z: best.z };
}

/**
 * Douglas–Peucker simplification: the ascending indices of the vertices
 * kept so that no dropped vertex lies farther than `tolerance` from the
 * simplified line. Both endpoints are always kept. Returning indices lets
 * callers carry per-vertex attributes (flow, width) through the simplification.
 */
export function simplifyPolylineIndices(line: GroundPolyline, tolerance: number): number[] {
  const count = line.length;
  if (count <= 2) return Array.from({ length: count }, (_, i) => i);
  const keep = new Uint8Array(count);
  keep[0] = 1;
  keep[count - 1] = 1;
  const stack: number[] = [0, count - 1];
  while (stack.length > 0) {
    const last = stack.pop() as number;
    const first = stack.pop() as number;
    const a = line[first] as GroundPoint;
    const b = line[last] as GroundPoint;
    let farthest = -1;
    let farthestDistance = tolerance;
    for (let i = first + 1; i < last; i += 1) {
      const d = distanceToSegment(line[i] as GroundPoint, a, b);
      if (d > farthestDistance) {
        farthest = i;
        farthestDistance = d;
      }
    }
    if (farthest >= 0) {
      keep[farthest] = 1;
      stack.push(first, farthest, farthest, last);
    }
  }
  const kept: number[] = [];
  keep.forEach((flag, i) => {
    if (flag === 1) kept.push(i);
  });
  return kept;
}

/** Douglas–Peucker simplification of a polyline; see {@link simplifyPolylineIndices}. */
export function simplifyPolyline(line: GroundPolyline, tolerance: number): GroundPoint[] {
  return simplifyPolylineIndices(line, tolerance).map((i) => line[i] as GroundPoint);
}

/**
 * Splits every segment longer than `maxSegment` into equal pieces no longer
 * than it, interpolating optional per-vertex `values` alongside. Smoothing a
 * subdivided line keeps the curve within about a fifth of `maxSegment` of
 * the original, where smoothing long segments would cut deep across corners.
 */
export function subdividePolyline(
  line: GroundPolyline,
  maxSegment: number,
  values: readonly number[] = []
): { points: GroundPoint[]; values: number[] } {
  const first = line[0];
  if (first === undefined) return { points: [], values: [] };
  const points: GroundPoint[] = [first];
  const out: number[] = values.length > 0 ? [values[0] as number] : [];
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1] as GroundPoint;
    const b = line[i] as GroundPoint;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    const pieces = length > maxSegment ? Math.ceil(length / maxSegment) : 1;
    const va = values[i - 1] as number;
    const vb = values[i] as number;
    for (let k = 1; k < pieces; k += 1) {
      const t = k / pieces;
      points.push({ x: a.x + dx * t, z: a.z + dz * t });
      if (out.length > 0) out.push(va + (vb - va) * t);
    }
    points.push(b);
    if (out.length > 0) out.push(vb);
  }
  return { points, values: out };
}

/**
 * Chaikin corner cutting applied to a sequence of numbers: each pass
 * replaces every interior corner with points a quarter and three quarters
 * along its segments, keeping both ends fixed. Applied to per-vertex values
 * it matches {@link smoothPolyline} on the same vertices.
 */
export function smoothPolylineValues(values: readonly number[], iterations: number): number[] {
  let current = values.slice();
  for (let pass = 0; pass < iterations && current.length > 2; pass += 1) {
    const next: number[] = [current[0] as number];
    for (let i = 1; i < current.length; i += 1) {
      const a = current[i - 1] as number;
      const b = current[i] as number;
      next.push(a * 0.75 + b * 0.25, a * 0.25 + b * 0.75);
    }
    next.push(current[current.length - 1] as number);
    current = next;
  }
  return current;
}

/**
 * Chaikin smoothing: `iterations` passes of corner cutting with both
 * endpoints fixed. The curve stays inside the original polyline's convex
 * hull and each pass doubles the vertex count, so two or three passes suffice.
 */
export function smoothPolyline(line: GroundPolyline, iterations: number): GroundPoint[] {
  const xs = smoothPolylineValues(
    line.map((p) => p.x),
    iterations
  );
  const zs = smoothPolylineValues(
    line.map((p) => p.z),
    iterations
  );
  return xs.map((x, i) => ({ x, z: zs[i] as number }));
}

/** Hermite smoothstep: 0 at `edge0`, 1 at `edge1`, clamped. Reversed edges invert it. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  let t = (value - edge0) / (edge1 - edge0);
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return t * t * (3 - 2 * t);
}
