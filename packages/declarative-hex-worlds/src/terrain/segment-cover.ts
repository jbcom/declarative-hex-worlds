/**
 * `src/terrain/segment-cover.ts` — the uniform-grid cells a segment's
 * neighbourhood touches. Internal: shared by the polyline distance indexes.
 *
 * @module
 */
import type { GroundPoint } from './geometry2d';

/**
 * Calls `visit(row, column)` for every cell of a uniform grid (cells `cell`
 * wide, cell (0, 0) starting at `originX`, `originZ`) that holds a point
 * within `reach` of the segment `a`–`b`. Conservative: it may visit a few
 * cells that only nearly qualify, never miss one that does.
 *
 * A point in row r within `reach` of the segment has its nearest segment
 * point within that row's z-slab grown by `reach`; only the columns that
 * slice of the segment (grown by `reach`) spans are visited, so the work
 * grows with the segment's length rather than its bounding box's area.
 */
export function forEachSegmentCell(
  a: GroundPoint,
  b: GroundPoint,
  reach: number,
  cell: number,
  originX: number,
  originZ: number,
  visit: (row: number, column: number) => void
): void {
  if (!(cell > 0)) throw new RangeError(`cell size must be positive, got ${cell}`);
  const ax = a.x - originX;
  const az = a.z - originZ;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const r0 = Math.floor((Math.min(az, az + dz) - reach) / cell);
  const r1 = Math.floor((Math.max(az, az + dz) + reach) / cell);
  for (let r = r0; r <= r1; r += 1) {
    let xMin = Math.min(ax, ax + dx);
    let xMax = Math.max(ax, ax + dx);
    if (dz !== 0) {
      const tA = (r * cell - reach - az) / dz;
      const tB = ((r + 1) * cell + reach - az) / dz;
      const t0 = Math.max(0, Math.min(tA, tB));
      const t1 = Math.min(1, Math.max(tA, tB));
      const xa = ax + dx * t0;
      const xb = ax + dx * t1;
      xMin = Math.min(xa, xb);
      xMax = Math.max(xa, xb);
    }
    const c0 = Math.floor((xMin - reach) / cell);
    const c1 = Math.floor((xMax + reach) / cell);
    for (let c = c0; c <= c1; c += 1) visit(r, c);
  }
}
