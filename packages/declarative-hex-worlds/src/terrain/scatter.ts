/**
 * `src/terrain/scatter.ts` — seeded blue-noise scatter on the ground plane.
 *
 * Bridson's Poisson-disc sampling: every point is at least `minSpacing` from
 * every other, without the clumps of uniform random placement or the rows of
 * a jittered grid — trees, stones and tufts that look naturally spaced. A
 * density function thins the result per position (woods dense, pasture
 * sparse). Candidates are drawn by rejection in a square annulus box, so only
 * arithmetic is used and output is byte-identical everywhere.
 *
 * @module
 */
import seedrandom from 'seedrandom';
import { GameboardValidationError } from '../errors';
import { MAX_GRID_SAMPLES } from './field';
import type { GroundBounds, GroundPoint } from './geometry2d';

/** Options for {@link scatterPoints}. */
export interface ScatterPointsOptions {
  readonly bounds: GroundBounds;
  /** Minimum distance between any two points. */
  readonly minSpacing: number;
  readonly seed: string | number;
  /** 0–1 keep-probability per position (default 1 everywhere). */
  readonly density?: (x: number, z: number) => number;
  /** Candidates tried around each active point before it retires (default 24). */
  readonly attempts?: number;
  /**
   * Keep at most this many points (default unlimited). The survivors are an
   * even subsample of the whole scatter (the lowest variants), never a clump
   * around the first seed point.
   */
  readonly maxPoints?: number;
}

/** A scattered point with a stable per-point random value for variation. */
export interface ScatterPoint extends GroundPoint {
  /** Uniform in [0, 1), stable for this point; use it to pick size, rotation or species. */
  readonly variant: number;
}

/** Blue-noise points inside `bounds`. See the module documentation. */
export function scatterPoints(options: ScatterPointsOptions): ScatterPoint[] {
  const { bounds, minSpacing } = options;
  if (!(minSpacing > 0)) {
    throw new GameboardValidationError(`scatter minSpacing must be positive; got ${minSpacing}`);
  }
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  if (!(spanX > 0) || !(spanZ > 0) || !Number.isFinite(spanX) || !Number.isFinite(spanZ)) {
    throw new GameboardValidationError('scatter bounds must be finite with positive extent');
  }
  const rng = seedrandom(`declarative-hex-worlds:scatter:${String(options.seed)}`);
  const attempts = options.attempts ?? 24;
  const maxPoints = options.maxPoints ?? Number.POSITIVE_INFINITY;
  const cell = minSpacing / Math.SQRT2;
  const columns = Math.ceil(spanX / cell);
  const rows = Math.ceil(spanZ / cell);
  if (columns * rows > MAX_GRID_SAMPLES) {
    throw new GameboardValidationError(
      `scatter of ${spanX}×${spanZ} at spacing ${minSpacing} needs too many cells`
    );
  }
  const grid = new Int32Array(columns * rows).fill(-1);
  const candidates: GroundPoint[] = [];
  const active: number[] = [];
  const minSq = minSpacing * minSpacing;

  const cellOf = (x: number, z: number): number => {
    const c = Math.min(columns - 1, Math.floor((x - bounds.minX) / cell));
    const r = Math.min(rows - 1, Math.floor((z - bounds.minZ) / cell));
    return r * columns + c;
  };
  const fits = (x: number, z: number): boolean => {
    const c = Math.floor((x - bounds.minX) / cell);
    const r = Math.floor((z - bounds.minZ) / cell);
    for (let dr = -2; dr <= 2; dr += 1) {
      const rr = r + dr;
      if (rr < 0 || rr >= rows) continue;
      for (let dc = -2; dc <= 2; dc += 1) {
        const cc = c + dc;
        if (cc < 0 || cc >= columns) continue;
        const other = grid[rr * columns + cc] as number;
        if (other < 0) continue;
        const p = candidates[other] as GroundPoint;
        const dx = p.x - x;
        const dz = p.z - z;
        if (dx * dx + dz * dz < minSq) return false;
      }
    }
    return true;
  };
  const insert = (x: number, z: number): void => {
    grid[cellOf(x, z)] = candidates.length;
    active.push(candidates.length);
    candidates.push({ x, z });
  };

  insert(bounds.minX + rng() * spanX, bounds.minZ + rng() * spanZ);
  while (active.length > 0) {
    const pick = Math.floor(rng() * active.length);
    const origin = candidates[active[pick] as number] as GroundPoint;
    let placed = false;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const dx = (rng() * 4 - 2) * minSpacing;
      const dz = (rng() * 4 - 2) * minSpacing;
      const distSq = dx * dx + dz * dz;
      if (distSq < minSq || distSq > 4 * minSq) continue;
      const x = origin.x + dx;
      const z = origin.z + dz;
      if (x < bounds.minX || x >= bounds.maxX || z < bounds.minZ || z >= bounds.maxZ) continue;
      if (!fits(x, z)) continue;
      insert(x, z);
      placed = true;
      break;
    }
    if (!placed) {
      active[pick] = active[active.length - 1] as number;
      active.pop();
    }
  }

  // Thin by density and attach variants in generation order, so a density
  // change never reshuffles the variants of the points that remain.
  const density = options.density;
  const thinning = seedrandom(`declarative-hex-worlds:scatter-thin:${String(options.seed)}`);
  const result: ScatterPoint[] = [];
  for (const point of candidates) {
    const keep = thinning();
    const variant = thinning();
    // `!(keep < d)` also rejects a NaN density instead of keeping every point.
    if (density !== undefined && !(keep < density(point.x, point.z))) continue;
    result.push({ x: point.x, z: point.z, variant });
  }
  if (result.length <= maxPoints) return result;
  // Variants are uniform and independent of position, so the lowest ones are
  // an even subsample; generation order is restored for stability.
  const order = result.map((_, index) => index);
  order.sort((a, b) => (result[a] as ScatterPoint).variant - (result[b] as ScatterPoint).variant);
  const kept = order.slice(0, maxPoints).sort((a, b) => a - b);
  return kept.map((index) => result[index] as ScatterPoint);
}
