/**
 * `src/terrain/geometry2d.ts` — planar geometry on the board's ground plane
 * (world X/Z) used by terrain composition, biome painting and scatter.
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
  // Row → column → segment indices. Numeric keys keep queries allocation-free.
  const buckets = new Map<number, Map<number, number[]>>();
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
      let rowBuckets = buckets.get(r);
      if (!rowBuckets) {
        rowBuckets = new Map();
        buckets.set(r, rowBuckets);
      }
      for (let c = c0; c <= c1; c += 1) {
        const bucket = rowBuckets.get(c);
        if (bucket) bucket.push(index);
        else rowBuckets.set(c, [index]);
      }
    }
  });
  return {
    distanceWithin(point) {
      const bucket = buckets.get(Math.floor(point.z / cell))?.get(Math.floor(point.x / cell));
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

/** Hermite smoothstep: 0 at `edge0`, 1 at `edge1`, clamped. Reversed edges invert it. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  let t = (value - edge0) / (edge1 - edge0);
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return t * t * (3 - 2 * t);
}
