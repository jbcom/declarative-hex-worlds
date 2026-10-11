/**
 * `src/terrain/polyline-cells.ts` — polylines bucketed into a uniform grid
 * over fixed bounds, laid out in flat typed arrays a renderer can upload as
 * textures. A fragment (or any query) reads its cell's short segment list
 * and measures exact distance to the lines: roads, lanes, railway beds and
 * creek beds drawn crisply at any zoom, with no distance texture whose
 * resolution limits how narrow a feature can be.
 *
 * @module
 */
import {
  distanceToSegment,
  type GroundBounds,
  type GroundPoint,
  type GroundPolyline,
} from './geometry2d';
import { forEachSegmentCell } from './segment-cover';

export interface PolylineCellsOptions {
  /** The area the grid covers; queries outside it find nothing. */
  readonly bounds: GroundBounds;
  /** Edge length of a square cell, world units. */
  readonly cellSize: number;
  /**
   * The farthest distance that matters (a road's half-width plus its
   * feather): every cell holding a point within `reach` of a segment lists it.
   */
  readonly reach: number;
}

/** See {@link createPolylineCells}. Every array is row-major and flat. */
export interface PolylineCells {
  readonly bounds: GroundBounds;
  readonly cellSize: number;
  readonly reach: number;
  /** Cells along X and along Z; the last ones may overhang the bounds. */
  readonly columns: number;
  readonly rows: number;
  /** Four values per segment: ax, az, bx, bz (world units). */
  readonly segments: Float32Array;
  /** The index (into the input lines) of each segment's line. */
  readonly segmentLine: Uint32Array;
  /** Two values per cell: the first entry in `cellSegments`, then the count. */
  readonly cellRanges: Uint32Array;
  /** Segment indices, grouped by cell as `cellRanges` describes. */
  readonly cellSegments: Uint32Array;
  /** The most segments any one cell lists (a shader's loop bound). */
  readonly maxPerCell: number;
}

/**
 * Buckets `lines` into a grid of `cellSize` cells over `bounds`, listing in
 * each cell every segment within `reach` of some point of it. A one-point
 * line is a point (a zero-length segment). Lines may extend past the bounds;
 * only the cells inside are kept.
 */
export function createPolylineCells(
  lines: readonly GroundPolyline[],
  options: PolylineCellsOptions
): PolylineCells {
  const { bounds, cellSize, reach } = options;
  if (!(cellSize > 0)) throw new RangeError(`cellSize must be positive, got ${cellSize}`);
  if (!(reach >= 0)) throw new RangeError(`reach must not be negative, got ${reach}`);
  const columns = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cellSize));
  const rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cellSize));

  const ends: (readonly [GroundPoint, GroundPoint])[] = [];
  const owners: number[] = [];
  lines.forEach((line, l) => {
    const first = line[0];
    if (first === undefined) return;
    if (line.length === 1) {
      ends.push([first, first]);
      owners.push(l);
      return;
    }
    for (let i = 1; i < line.length; i += 1) {
      ends.push([line[i - 1] as GroundPoint, line[i] as GroundPoint]);
      owners.push(l);
    }
  });

  const perCell: number[][] = Array.from({ length: columns * rows }, () => []);
  ends.forEach(([a, b], index) => {
    forEachSegmentCell(a, b, reach, cellSize, bounds.minX, bounds.minZ, (r, c) => {
      if (r < 0 || r >= rows || c < 0 || c >= columns) return;
      (perCell[r * columns + c] as number[]).push(index);
    });
  });

  const segments = new Float32Array(ends.length * 4);
  ends.forEach(([a, b], i) => {
    segments.set([a.x, a.z, b.x, b.z], i * 4);
  });
  const cellRanges = new Uint32Array(columns * rows * 2);
  const total = perCell.reduce((n, list) => n + list.length, 0);
  const cellSegments = new Uint32Array(total);
  let next = 0;
  let maxPerCell = 0;
  perCell.forEach((list, cell) => {
    cellRanges[cell * 2] = next;
    cellRanges[cell * 2 + 1] = list.length;
    cellSegments.set(list, next);
    next += list.length;
    if (list.length > maxPerCell) maxPerCell = list.length;
  });

  return {
    bounds,
    cellSize,
    reach,
    columns,
    rows,
    segments,
    segmentLine: Uint32Array.from(owners),
    cellRanges,
    cellSegments,
    maxPerCell,
  };
}

/**
 * The nearest listed segment to `point`, searching only its cell: exact when
 * that distance is within the cells' `reach`. Returns `line: -1` and an
 * infinite distance when the cell lists nothing or the point is outside the
 * bounds. This is the query a shader runs per fragment.
 */
export function nearestPolylineInCells(
  cells: PolylineCells,
  point: GroundPoint
): { readonly distance: number; readonly line: number } {
  const { bounds, cellSize, columns, rows } = cells;
  const c = Math.floor((point.x - bounds.minX) / cellSize);
  const r = Math.floor((point.z - bounds.minZ) / cellSize);
  if (c < 0 || c >= columns || r < 0 || r >= rows) {
    return { distance: Number.POSITIVE_INFINITY, line: -1 };
  }
  const cell = r * columns + c;
  const start = cells.cellRanges[cell * 2] as number;
  const count = cells.cellRanges[cell * 2 + 1] as number;
  let distance = Number.POSITIVE_INFINITY;
  let line = -1;
  for (let k = start; k < start + count; k += 1) {
    const s = (cells.cellSegments[k] as number) * 4;
    const a = { x: cells.segments[s] as number, z: cells.segments[s + 1] as number };
    const b = { x: cells.segments[s + 2] as number, z: cells.segments[s + 3] as number };
    const d = distanceToSegment(point, a, b);
    if (d < distance) {
      distance = d;
      line = cells.segmentLine[cells.cellSegments[k] as number] as number;
    }
  }
  return { distance, line };
}
