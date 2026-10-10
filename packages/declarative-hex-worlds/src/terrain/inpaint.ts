/**
 * `src/terrain/inpaint.ts` — harmonic in-painting of height fields.
 *
 * Measured elevation carries modern earthworks (quarries, cuttings, building
 * pads, spoil heaps) that a historical or fictional ground must not have.
 * In-painting erases them: every sample inside a polygon (plus an optional
 * feather band) is replaced by the smooth surface whose Laplacian is zero and
 * whose boundary values are the surrounding ground. Harmonic surfaces have no
 * bumps or pits of their own (no interior maximum or minimum), and they
 * contain every plane, so a pit cut into a slope is replaced by that slope.
 *
 * The solve is successive over-relaxation in fixed row-major order, using only
 * `+ - * /` and `Math.sqrt`, so results are byte-identical across engines.
 *
 * @module
 */
import { GameboardValidationError } from '../errors';
import { gridSpacing, type HeightField } from './field';
import {
  boundsOfPoints,
  type GroundPoint,
  type GroundPolygon,
  signedDistanceToPolygon,
} from './geometry2d';

/** Options for {@link inpaintHeightField}. */
export interface InpaintHeightFieldOptions {
  /**
   * Extra width, in world units, replaced beyond the polygon's edge (default
   * 0). Use it to swallow the rim or spoil heap that surrounds an excavation.
   */
  readonly feather?: number;
  /**
   * Largest remaining error, in world units, the solve may leave (default
   * 1e-3). It bounds the distance to the exact harmonic surface, not merely
   * the last update.
   */
  readonly tolerance?: number;
  /** Most relaxation sweeps to run (default 10000). */
  readonly maxIterations?: number;
}

const DEFAULT_TOLERANCE = 1e-3;
const DEFAULT_MAX_ITERATIONS = 10_000;
const PI = Math.PI;

/** `cos(x)` for `0 < x <= π / 2` by Taylor series: arithmetic only, accurate to 4e-4. */
function cosine(x: number): number {
  const x2 = x * x;
  return 1 - x2 / 2 + (x2 * x2) / 24 - (x2 * x2 * x2) / 720;
}

/**
 * Near-optimal over-relaxation factor for a `columns × rows` block of unknowns:
 * `2 / (1 + sqrt(1 − ρ²))`, where ρ is the Jacobi iteration's spectral radius.
 * Returns a value in `[1, 2)`; the error then shrinks by roughly `ω − 1` a sweep.
 */
function relaxationFactor(columns: number, rows: number, wx: number, wz: number): number {
  const rho = (wx * cosine(PI / (columns + 1)) + wz * cosine(PI / (rows + 1))) / (wx + wz);
  return 2 / (1 + Math.sqrt(1 - rho * rho));
}

function validateOptions(
  polygon: GroundPolygon,
  feather: number,
  tolerance: number,
  maxIterations: number
): void {
  if (polygon.length < 3) {
    throw new GameboardValidationError('inpaint polygon needs at least three points');
  }
  if (!polygon.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z))) {
    throw new GameboardValidationError('inpaint polygon points must be finite');
  }
  if (!(feather >= 0) || !Number.isFinite(feather)) {
    throw new GameboardValidationError(
      `inpaint feather must be a non-negative number; got ${feather}`
    );
  }
  if (!(tolerance > 0) || !Number.isFinite(tolerance)) {
    throw new GameboardValidationError(`inpaint tolerance must be positive; got ${tolerance}`);
  }
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new GameboardValidationError(
      `inpaint maxIterations must be a positive integer; got ${maxIterations}`
    );
  }
}

/**
 * Replaces the ground inside `polygon` (grown by `feather`) with the harmonic
 * surface that meets the samples outside it, and returns the result as a new
 * field. `field` is never modified; samples farther than `feather` outside the
 * polygon are copied bit for bit.
 *
 * Unknown samples on the field's edge relax toward their in-grid neighbours
 * only, so the surface leaves a clipped region with zero normal slope there.
 *
 * Draw the polygon around the whole disturbance, rim and spoil included: only
 * the boundary *values* are matched, so any earthwork left on the outside of
 * the outline becomes the boundary the fill is built from.
 *
 * @throws {@link GameboardValidationError} for a polygon of fewer than three
 * points, a negative or non-finite `feather`, a non-positive `tolerance`, a
 * `maxIterations` below one, or a region that leaves no known sample to
 * interpolate from (it covers the whole field).
 */
export function inpaintHeightField(
  field: HeightField,
  polygon: GroundPolygon,
  options: InpaintHeightFieldOptions = {}
): HeightField {
  const feather = options.feather ?? 0;
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  validateOptions(polygon, feather, tolerance, maxIterations);

  const { bounds, width, height } = field;
  const result: HeightField = { bounds, width, height, heights: field.heights.slice() };
  const spacing = gridSpacing(field);

  // Only samples within `feather` of the polygon's bounding box can be
  // unknown; the window pads that by two samples so every unknown's
  // neighbours lie inside it whatever the rounding.
  const box = boundsOfPoints(polygon as readonly GroundPoint[]);
  const c0 = Math.max(0, Math.floor((box.minX - feather - bounds.minX) / spacing.x) - 2);
  const c1 = Math.min(width - 1, Math.ceil((box.maxX + feather - bounds.minX) / spacing.x) + 2);
  const r0 = Math.max(0, Math.floor((box.minZ - feather - bounds.minZ) / spacing.z) - 2);
  const r1 = Math.min(height - 1, Math.ceil((box.maxZ + feather - bounds.minZ) / spacing.z) + 2);
  const columns = c1 - c0 + 1;
  const rows = r1 - r0 + 1;
  if (columns < 1 || rows < 1) return result;

  const unknown = new Uint8Array(columns * rows);
  const values = new Float64Array(columns * rows);
  let unknownCount = 0;
  let minColumn = columns;
  let maxColumn = -1;
  let minRow = rows;
  let maxRow = -1;
  for (let row = 0; row < rows; row += 1) {
    const z = bounds.minZ + (r0 + row) * spacing.z;
    for (let column = 0; column < columns; column += 1) {
      const i = row * columns + column;
      values[i] = field.heights[(r0 + row) * width + c0 + column] as number;
      const x = bounds.minX + (c0 + column) * spacing.x;
      if (signedDistanceToPolygon(polygon, { x, z }) <= feather) {
        unknown[i] = 1;
        unknownCount += 1;
        if (column < minColumn) minColumn = column;
        if (column > maxColumn) maxColumn = column;
        if (row < minRow) minRow = row;
        if (row > maxRow) maxRow = row;
      }
    }
  }
  if (unknownCount === 0) return result;

  // Start every unknown at the mean of the known samples that touch the region.
  let linkSum = 0;
  let links = 0;
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      const i = row * columns + column;
      if (unknown[i] === 0) continue;
      if (column > 0 && unknown[i - 1] === 0) {
        linkSum += values[i - 1] as number;
        links += 1;
      }
      if (column < columns - 1 && unknown[i + 1] === 0) {
        linkSum += values[i + 1] as number;
        links += 1;
      }
      if (row > 0 && unknown[i - columns] === 0) {
        linkSum += values[i - columns] as number;
        links += 1;
      }
      if (row < rows - 1 && unknown[i + columns] === 0) {
        linkSum += values[i + columns] as number;
        links += 1;
      }
    }
  }
  if (links === 0) {
    throw new GameboardValidationError(
      'inpaint region covers the whole height field; no known samples remain to interpolate from'
    );
  }
  const start = linkSum / links;
  for (let i = 0; i < unknown.length; i += 1) {
    if (unknown[i] === 1) values[i] = start;
  }

  // Anisotropic Laplacian weights, so non-square sample spacing stays exact for planes.
  const wx = 1 / (spacing.x * spacing.x);
  const wz = 1 / (spacing.z * spacing.z);
  const omega = relaxationFactor(maxColumn - minColumn + 1, maxRow - minRow + 1, wx, wz);
  // Error decays by about (ω − 1) a sweep, so the remaining error is roughly the
  // last update over (2 − ω): stop when that bound is within the tolerance.
  const threshold = tolerance * (2 - omega);

  for (let sweep = 0; sweep < maxIterations; sweep += 1) {
    let largest = 0;
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        const i = row * columns + column;
        if (unknown[i] === 0) continue;
        let sum = 0;
        let weight = 0;
        if (column > 0) {
          sum += wx * (values[i - 1] as number);
          weight += wx;
        }
        if (column < columns - 1) {
          sum += wx * (values[i + 1] as number);
          weight += wx;
        }
        if (row > 0) {
          sum += wz * (values[i - columns] as number);
          weight += wz;
        }
        if (row < rows - 1) {
          sum += wz * (values[i + columns] as number);
          weight += wz;
        }
        const current = values[i] as number;
        const update = omega * (sum / weight - current);
        values[i] = current + update;
        const magnitude = update < 0 ? -update : update;
        if (magnitude > largest) largest = magnitude;
      }
    }
    if (largest < threshold) break;
  }

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      const i = row * columns + column;
      if (unknown[i] === 1) result.heights[(r0 + row) * width + c0 + column] = values[i] as number;
    }
  }
  return result;
}
