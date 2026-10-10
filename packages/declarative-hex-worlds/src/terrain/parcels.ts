/**
 * `src/terrain/parcels.ts` — field parcels and their boundary network.
 *
 * Settled country is a patchwork of fields, not noise: parcels of varied
 * size and orientation, separated by fences, walls and hedges, with lanes
 * running along their edges. `generateParcels` splits a rectangle (or any
 * convex polygon) recursively, mostly across each piece's long axis, until
 * pieces reach a target area. `parcelBoundaries` turns the result into a
 * deduplicated edge network (T-junctions resolved) for fences and for
 * routing roads along field edges.
 *
 * Only arithmetic and Math.sqrt are used; randomness threads through
 * seedrandom, so output is byte-identical everywhere.
 *
 * @module
 */
import seedrandom from 'seedrandom';
import { GameboardValidationError } from '../errors';
import type { GroundBounds, GroundPoint, GroundPolygon } from './geometry2d';

/** Options for {@link generateParcels}. */
export interface GenerateParcelsOptions {
  /** The land to divide: a rectangle, or a convex polygon (counter-clockwise or clockwise). */
  readonly area: GroundBounds | GroundPolygon;
  readonly seed: string | number;
  /** Typical parcel area in square world units. */
  readonly meanArea: number;
  /** 0–1: spread of parcel sizes around the mean (default 0.5). */
  readonly sizeVariation?: number;
  /** 0–1: how far split lines tilt from square to the long axis (default 0.25). */
  readonly skew?: number;
  /** Pieces narrower than this are never split further (default a fifth of √meanArea). */
  readonly minWidth?: number;
  /**
   * Preferred length-to-width ratio of parcels (default 1.8, the elongated
   * fields of surveyed farmland). Each cut is made across or along a piece's
   * long axis, whichever brings its halves nearer this ratio.
   */
  readonly aspect?: number;
}

/** One field. */
export interface Parcel {
  /** Convex outline, consistent winding. */
  readonly polygon: GroundPolygon;
  readonly area: number;
  readonly centroid: GroundPoint;
  /** Uniform in [0, 1), stable per parcel: use it to pick a crop or land use. */
  readonly variant: number;
}

function isPolygon(area: GroundBounds | GroundPolygon): area is GroundPolygon {
  return Array.isArray(area);
}

function polygonArea(polygon: GroundPolygon): number {
  let sum = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[j] as GroundPoint;
    const b = polygon[i] as GroundPoint;
    sum += a.x * b.z - b.x * a.z;
  }
  return sum / 2;
}

function polygonCentroid(polygon: GroundPolygon, signedArea: number): GroundPoint {
  let cx = 0;
  let cz = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[j] as GroundPoint;
    const b = polygon[i] as GroundPoint;
    const cross = a.x * b.z - b.x * a.z;
    cx += (a.x + b.x) * cross;
    cz += (a.z + b.z) * cross;
  }
  return { x: cx / (6 * signedArea), z: cz / (6 * signedArea) };
}

/** Splits a convex polygon by the line through `p` with direction `d`. */
function splitConvex(
  polygon: GroundPolygon,
  p: GroundPoint,
  d: GroundPoint
): [GroundPoint[], GroundPoint[]] {
  const left: GroundPoint[] = [];
  const right: GroundPoint[] = [];
  const side = (q: GroundPoint) => d.x * (q.z - p.z) - d.z * (q.x - p.x);
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i] as GroundPoint;
    const b = polygon[(i + 1) % polygon.length] as GroundPoint;
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) left.push(a);
    if (sa <= 0) right.push(a);
    if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) {
      const t = sa / (sa - sb);
      const q = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      left.push(q);
      right.push(q);
    }
  }
  return [left, right];
}

/**
 * Long axis of a polygon's minimum-area oriented bounding box, which (by the
 * rotating-calipers theorem) is aligned with one of its edges. Cutting across
 * this axis keeps pieces quadrilateral, the way surveyed lots are; the
 * farthest-vertex-pair axis would cut rectangles along their diagonals into
 * triangles. Only called on pieces with positive area.
 */
function longAxis(polygon: GroundPolygon): { dir: GroundPoint; length: number } {
  let bestArea = Number.POSITIVE_INFINITY;
  let dir = { x: 1, z: 0 };
  let length = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i] as GroundPoint;
    const b = polygon[(i + 1) % polygon.length] as GroundPoint;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const edgeLength = Math.sqrt(dx * dx + dz * dz);
    if (edgeLength === 0) continue;
    const u = { x: dx / edgeLength, z: dz / edgeLength };
    const v = { x: -u.z, z: u.x };
    const alongU = extentAlong(polygon, u);
    const alongV = extentAlong(polygon, v);
    if (alongU * alongV < bestArea) {
      bestArea = alongU * alongV;
      if (alongU >= alongV) {
        dir = u;
        length = alongU;
      } else {
        dir = v;
        length = alongV;
      }
    }
  }
  return { dir, length };
}

/**
 * Distances from an interior point `c` to a convex polygon's boundary going
 * backward and forward along unit direction `d`.
 */
function chordThrough(
  polygon: GroundPolygon,
  c: GroundPoint,
  d: GroundPoint
): [back: number, forward: number] {
  let back = Number.POSITIVE_INFINITY;
  let forward = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i] as GroundPoint;
    const b = polygon[(i + 1) % polygon.length] as GroundPoint;
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const denom = d.x * ez - d.z * ex;
    if (denom === 0) continue;
    // Solve c + t·d = a + s·e for t, s.
    const t = ((a.x - c.x) * ez - (a.z - c.z) * ex) / denom;
    const s = ((a.x - c.x) * d.z - (a.z - c.z) * d.x) / denom;
    if (s < 0 || s > 1) continue;
    if (t >= 0 && t < forward) forward = t;
    if (t <= 0 && -t < back) back = -t;
  }
  return [back, forward];
}

/** Width of a polygon across a unit direction (its extent along that direction). */
function extentAlong(polygon: GroundPolygon, dir: GroundPoint): number {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const q of polygon) {
    const s = q.x * dir.x + q.z * dir.z;
    if (s < min) min = s;
    if (s > max) max = s;
  }
  return max - min;
}

/** Divides land into parcels. See the module documentation. */
export function generateParcels(options: GenerateParcelsOptions): Parcel[] {
  const { meanArea } = options;
  if (!(meanArea > 0) || !Number.isFinite(meanArea)) {
    throw new GameboardValidationError(`parcel meanArea must be positive; got ${meanArea}`);
  }
  const start: GroundPolygon = isPolygon(options.area)
    ? options.area
    : [
        { x: options.area.minX, z: options.area.minZ },
        { x: options.area.maxX, z: options.area.minZ },
        { x: options.area.maxX, z: options.area.maxZ },
        { x: options.area.minX, z: options.area.maxZ },
      ];
  const startArea = Math.abs(polygonArea(start));
  if (start.length < 3 || !(startArea > 0) || !Number.isFinite(startArea)) {
    throw new GameboardValidationError('parcel area must be a polygon with positive finite area');
  }
  if (startArea / meanArea > 1_000_000) {
    throw new GameboardValidationError(
      'parcel meanArea is too small for the area (over a million parcels)'
    );
  }
  const variation = Math.min(Math.max(options.sizeVariation ?? 0.5, 0), 1);
  const skew = Math.min(Math.max(options.skew ?? 0.25, 0), 1);
  const minWidth = options.minWidth ?? Math.sqrt(meanArea) / 5;
  if (!(minWidth >= 0) || !Number.isFinite(minWidth)) {
    throw new GameboardValidationError(
      `parcel minWidth must be a non-negative number; got ${minWidth}`
    );
  }
  const aspect = options.aspect ?? 1.8;
  if (!(aspect >= 1) || !Number.isFinite(aspect)) {
    throw new GameboardValidationError(`parcel aspect must be at least 1; got ${aspect}`);
  }
  const mismatch = (ratio: number): number => Math.max(ratio / aspect, aspect / ratio);
  const rng = seedrandom(`declarative-hex-worlds:parcels:${String(options.seed)}`);

  const parcels: Parcel[] = [];
  const finish = (piece: GroundPolygon, signed: number): void => {
    parcels.push({
      polygon: piece,
      area: Math.abs(signed),
      centroid: polygonCentroid(piece, signed),
      variant: rng(),
    });
  };
  const stack: GroundPolygon[] = [start];
  while (stack.length > 0) {
    const piece = stack.pop() as GroundPolygon;
    const signed = polygonArea(piece);
    // Each piece draws its own stopping size so parcels vary.
    const target = meanArea * (1 + variation * (rng() * 2 - 1));
    if (Math.abs(signed) <= target) {
      finish(piece, signed);
      continue;
    }
    const { dir, length } = longAxis(piece);
    const across = { x: -dir.z, z: dir.x };
    const width = extentAlong(piece, across);
    if (width < 2 * minWidth || length < 2 * minWidth) {
      finish(piece, signed);
      continue;
    }
    // Cut across the long axis (halves of ratio r/2) or along it (ratio 2r),
    // whichever lands nearer the preferred aspect.
    const ratio = length / width;
    const halvesAcross = Math.max(ratio / 2, 2 / ratio);
    const alongCut = mismatch(2 * ratio) < mismatch(halvesAcross) && width >= 4 * minWidth;
    const normal = alongCut ? across : dir;
    const lineDir = alongCut ? dir : across;
    // Tilt the cut by up to `skew`, and place it on the chord through the
    // centroid within 30 % of that chord's shorter half: interior by
    // construction, so both halves are proper convex polygons.
    const tilt = skew * (rng() * 2 - 1);
    const cutDir = { x: lineDir.x + normal.x * tilt, z: lineDir.z + normal.z * tilt };
    const cutLen = Math.sqrt(cutDir.x * cutDir.x + cutDir.z * cutDir.z);
    const unitCut = { x: cutDir.x / cutLen, z: cutDir.z / cutLen };
    const c = polygonCentroid(piece, signed);
    const [back, forward] = chordThrough(piece, c, normal);
    const offset = (rng() * 0.6 - 0.3) * Math.min(back, forward);
    const p = { x: c.x + normal.x * offset, z: c.z + normal.z * offset };
    const [a, b] = splitConvex(piece, p, unitCut);
    stack.push(b, a);
  }
  return parcels;
}

/** The boundary network between parcels. */
export interface ParcelBoundaries {
  /** Unique vertices (merged within the tolerance). */
  readonly vertices: readonly GroundPoint[];
  /** Unique undirected edges as vertex index pairs, split at every T-junction. */
  readonly edges: readonly (readonly [number, number])[];
  /** For each edge, the parcels on either side (one entry on the outer boundary). */
  readonly edgeParcels: readonly (readonly number[])[];
}

/**
 * Builds the shared-edge network of a parcel set: vertices merged within
 * `tolerance`, every edge split where another parcel's corner lies on it, and
 * each resulting edge listed once with the parcels it separates.
 */
export function parcelBoundaries(parcels: readonly Parcel[], tolerance = 1e-6): ParcelBoundaries {
  const vertices: GroundPoint[] = [];
  // Buckets of side `cell` ≥ tolerance: a match is always in the 3×3 block.
  const buckets = new Map<string, number[]>();
  const cell = tolerance > 0 ? tolerance : 1e-9;
  const vertexOf = (q: GroundPoint): number => {
    const cx = Math.floor(q.x / cell);
    const cz = Math.floor(q.z / cell);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        for (const hit of buckets.get(`${cx + dx},${cz + dz}`) ?? []) {
          const v = vertices[hit] as GroundPoint;
          if (Math.abs(v.x - q.x) <= tolerance && Math.abs(v.z - q.z) <= tolerance) return hit;
        }
      }
    }
    const index = vertices.length;
    vertices.push({ x: q.x, z: q.z });
    const key = `${cx},${cz}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(index);
    else buckets.set(key, [index]);
    return index;
  };

  const rings = parcels.map((parcel) => parcel.polygon.map(vertexOf));
  const edgeMap = new Map<string, { a: number; b: number; parcels: number[] }>();
  const onSegment = (v: number, a: number, b: number): number | null => {
    const P = vertices[v] as GroundPoint;
    const A = vertices[a] as GroundPoint;
    const B = vertices[b] as GroundPoint;
    const abx = B.x - A.x;
    const abz = B.z - A.z;
    // Distinct merged vertices are more than the tolerance apart, so lenSq > 0.
    const lenSq = abx * abx + abz * abz;
    const t = ((P.x - A.x) * abx + (P.z - A.z) * abz) / lenSq;
    if (t <= 0 || t >= 1) return null;
    const dx = A.x + abx * t - P.x;
    const dz = A.z + abz * t - P.z;
    return dx * dx + dz * dz <= tolerance * tolerance * 4 ? t : null;
  };

  rings.forEach((ring, parcelIndex) => {
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i] as number;
      const b = ring[(i + 1) % ring.length] as number;
      if (a === b) continue;
      // Split this edge at every vertex lying on it (T-junctions).
      const cuts: { t: number; v: number }[] = [];
      for (let v = 0; v < vertices.length; v += 1) {
        if (v === a || v === b) continue;
        const t = onSegment(v, a, b);
        if (t !== null) cuts.push({ t, v });
      }
      cuts.sort((p, q) => p.t - q.t);
      const chain = [a, ...cuts.map((c) => c.v), b];
      for (let k = 1; k < chain.length; k += 1) {
        const u = chain[k - 1] as number;
        const w = chain[k] as number;
        const key = u < w ? `${u},${w}` : `${w},${u}`;
        const edge = edgeMap.get(key);
        if (edge) {
          if (!edge.parcels.includes(parcelIndex)) edge.parcels.push(parcelIndex);
        } else {
          edgeMap.set(key, { a: Math.min(u, w), b: Math.max(u, w), parcels: [parcelIndex] });
        }
      }
    }
  });

  const edges: (readonly [number, number])[] = [];
  const edgeParcels: number[][] = [];
  for (const edge of edgeMap.values()) {
    edges.push([edge.a, edge.b]);
    edgeParcels.push(edge.parcels);
  }
  return { vertices, edges, edgeParcels };
}
