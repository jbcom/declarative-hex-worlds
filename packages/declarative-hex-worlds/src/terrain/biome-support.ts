/**
 * `src/terrain/biome-support.ts` — which grid samples a spatial paint can reach.
 *
 * Painting a biome over a large grid evaluates every condition at every
 * sample, yet an authored area or road only matters near itself. This module
 * answers, per grid row, "which columns can possibly be within `radius` of this
 * shape", so the painter never visits a sample whose coverage is provably 0.
 *
 * The answer is a conservative superset: it may include samples that turn out
 * uncovered, never omit one that is covered. That keeps culled output
 * byte-identical to evaluating every sample.
 *
 * @module
 */
import type { GroundPoint } from './geometry2d';

/** A regular sample grid: sample `(column, row)` sits at `(minX + column * stepX, minZ + row * stepZ)`. */
export interface SpanGrid {
  readonly minX: number;
  readonly minZ: number;
  readonly stepX: number;
  readonly stepZ: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Per-row inclusive column ranges. A row with `first[row] > last[row]` has no
 * reachable sample.
 */
export interface ColumnSpans {
  readonly first: Int32Array;
  readonly last: Int32Array;
}

/**
 * Bound on the magnitude of the warp noise (`fractalNoise` of seeded simplex
 * noise). The unnormalised simplex sum peaks at 0.9979 (scanned over a full
 * simplex cell with the worst-case gradient at every corner), and a fractal
 * sum divides by its octave weights, so no octave count exceeds 1.
 */
export const WARP_NOISE_BOUND = 1;

/**
 * Relative slack added to every radius. Distances are computed in floating
 * point (a subtraction, two products and a square root), so a sample a hair
 * beyond the radius can still measure a hair inside it. A part in a billion of
 * the coordinates' magnitude dwarfs that error and costs a negligible sliver of
 * extra samples.
 */
const RELATIVE_SLACK = 1e-9;

function emptySpans(grid: SpanGrid): ColumnSpans {
  return {
    first: new Int32Array(grid.height).fill(grid.width),
    last: new Int32Array(grid.height).fill(-1),
  };
}

/**
 * Columns, per row, that can lie within `radius` of a polyline (or within
 * `radius` of a closed polygon's boundary, or inside it, when `closed`).
 * Returns `null` when the shape or radius is not finite, meaning the reach
 * cannot be bounded and the caller must not cull.
 *
 * Because the nearest point of a shape to any sample within `radius` lies in
 * the horizontal slab `z ± radius`, each segment is clipped to that slab per
 * row and its x-range widened by `radius`. A polygon's interior needs nothing
 * more: a row crosses the boundary on both sides of any interior sample, and
 * those crossings sit inside the clipped ranges.
 */
export function capsuleSpans(
  points: readonly GroundPoint[],
  closed: boolean,
  radius: number,
  grid: SpanGrid
): ColumnSpans | null {
  const { minX, minZ, stepX, stepZ, width, height } = grid;
  let scale = Math.abs(minX) + Math.abs(minZ) + width * stepX + height * stepZ + radius;
  for (const point of points) scale += Math.abs(point.x) + Math.abs(point.z);
  if (!Number.isFinite(scale)) return null;
  const spans = emptySpans(grid);
  const count = points.length;
  if (count === 0) return spans;

  const reach = radius + RELATIVE_SLACK * (1 + scale);
  const low = new Float64Array(height).fill(Number.POSITIVE_INFINITY);
  const high = new Float64Array(height).fill(Number.NEGATIVE_INFINITY);
  // A lone point is a degenerate segment; a closed shape adds the closing edge.
  const segments = closed || count === 1 ? count : count - 1;
  for (let k = 0; k < segments; k += 1) {
    const a = points[k] as GroundPoint;
    const b = points[k + 1 === count ? 0 : k + 1] as GroundPoint;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const firstRow = Math.max(0, Math.floor((Math.min(a.z, b.z) - reach - minZ) / stepZ) - 1);
    const lastRow = Math.min(
      height - 1,
      Math.ceil((Math.max(a.z, b.z) + reach - minZ) / stepZ) + 1
    );
    for (let row = firstRow; row <= lastRow; row += 1) {
      const z = minZ + row * stepZ;
      let t0 = 0;
      let t1 = 1;
      if (dz !== 0) {
        const tA = (z - reach - a.z) / dz;
        const tB = (z + reach - a.z) / dz;
        t0 = Math.max(0, Math.min(tA, tB));
        t1 = Math.min(1, Math.max(tA, tB));
        if (t0 > t1) continue;
      } else if (Math.abs(a.z - z) > reach) {
        continue;
      }
      const xa = a.x + dx * t0;
      const xb = a.x + dx * t1;
      low[row] = Math.min(low[row] as number, xa, xb);
      high[row] = Math.max(high[row] as number, xa, xb);
    }
  }

  for (let row = 0; row < height; row += 1) {
    const lo = low[row] as number;
    if (lo > (high[row] as number)) continue;
    const first = Math.max(0, Math.min(width, Math.floor((lo - reach - minX) / stepX) - 1));
    const last = Math.max(
      -1,
      Math.min(width - 1, Math.ceil(((high[row] as number) + reach - minX) / stepX) + 1)
    );
    if (first > last) continue;
    spans.first[row] = first;
    spans.last[row] = last;
  }
  return spans;
}

/** Narrows `target` to the columns `other` also reaches, row by row. */
export function intersectSpans(target: ColumnSpans, other: ColumnSpans): void {
  for (let row = 0; row < target.first.length; row += 1) {
    target.first[row] = Math.max(target.first[row] as number, other.first[row] as number);
    target.last[row] = Math.min(target.last[row] as number, other.last[row] as number);
  }
}
