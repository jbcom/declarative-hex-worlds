/**
 * `src/terrain/field.ts` — continuous height fields.
 *
 * A height field is a regular grid of heights over ground bounds, with the
 * first and last samples sitting exactly on the bounds' edges. Sampling is
 * bilinear and clamped at the edges, so any renderer that draws the same grid
 * with bilinear interpolation (a displaced mesh, a height texture) agrees with
 * gameplay queries to the last bit.
 *
 * @module
 */
import { GameboardValidationError } from '../errors';
import type { GroundBounds, GroundPoint } from './geometry2d';

/** A regular grid of heights in world units, row-major from (minX, minZ). */
export interface HeightField {
  readonly bounds: GroundBounds;
  /** Samples per row (along X). At least 2. */
  readonly width: number;
  /** Rows (along Z). At least 2. */
  readonly height: number;
  /** Heights, `width * height` long, index `row * width + column`. */
  readonly heights: Float32Array;
}

/** Options for {@link createHeightField}. */
export interface CreateHeightFieldOptions {
  readonly bounds: GroundBounds;
  readonly width: number;
  readonly height: number;
  /** Initial heights; zero-filled when omitted. Copied, never aliased. */
  readonly heights?: ArrayLike<number>;
}

/** A unit-length surface normal (Y up). */
export interface SurfaceNormal {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Validates options and creates a height field. */
export function createHeightField(options: CreateHeightFieldOptions): HeightField {
  const { bounds, width, height } = options;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
    throw new GameboardValidationError(
      `height field needs integer width and height of at least 2; got ${width}×${height}`
    );
  }
  if (!(bounds.maxX > bounds.minX) || !(bounds.maxZ > bounds.minZ)) {
    throw new GameboardValidationError('height field bounds must have positive extent');
  }
  const heights = new Float32Array(width * height);
  if (options.heights !== undefined) {
    if (options.heights.length !== heights.length) {
      throw new GameboardValidationError(
        `height field expects ${heights.length} heights; got ${options.heights.length}`
      );
    }
    heights.set(options.heights);
  }
  return { bounds, width, height, heights };
}

/**
 * Creates a zero height field whose samples are `spacing` apart. The bounds'
 * extents must be whole multiples of the spacing.
 */
export function createHeightFieldWithSpacing(bounds: GroundBounds, spacing: number): HeightField {
  if (!(spacing > 0)) {
    throw new GameboardValidationError(`height field spacing must be positive; got ${spacing}`);
  }
  const cellsX = (bounds.maxX - bounds.minX) / spacing;
  const cellsZ = (bounds.maxZ - bounds.minZ) / spacing;
  if (!Number.isInteger(cellsX) || !Number.isInteger(cellsZ)) {
    throw new GameboardValidationError(
      `height field bounds must be whole multiples of the spacing ${spacing}`
    );
  }
  return createHeightField({ bounds, width: cellsX + 1, height: cellsZ + 1 });
}

/** World-unit distance between neighbouring samples along X and Z. */
export function heightFieldSpacing(field: HeightField): { readonly x: number; readonly z: number } {
  return {
    x: (field.bounds.maxX - field.bounds.minX) / (field.width - 1),
    z: (field.bounds.maxZ - field.bounds.minZ) / (field.height - 1),
  };
}

/** World position of the sample at `column`, `row`. */
export function heightFieldSamplePosition(
  field: HeightField,
  column: number,
  row: number
): GroundPoint {
  const spacing = heightFieldSpacing(field);
  return { x: field.bounds.minX + column * spacing.x, z: field.bounds.minZ + row * spacing.z };
}

/** Bilinear height at a world position, clamped to the field's edges. */
export function sampleHeight(field: HeightField, x: number, z: number): number {
  const { bounds, width, height, heights } = field;
  let fx = ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (width - 1);
  let fz = ((z - bounds.minZ) / (bounds.maxZ - bounds.minZ)) * (height - 1);
  if (!(fx > 0)) fx = 0;
  else if (fx > width - 1) fx = width - 1;
  if (!(fz > 0)) fz = 0;
  else if (fz > height - 1) fz = height - 1;
  let x0 = Math.floor(fx);
  let z0 = Math.floor(fz);
  if (x0 === width - 1) x0 -= 1;
  if (z0 === height - 1) z0 -= 1;
  const tx = fx - x0;
  const tz = fz - z0;
  const i = z0 * width + x0;
  const h00 = heights[i] as number;
  const h10 = heights[i + 1] as number;
  const h01 = heights[i + width] as number;
  const h11 = heights[i + width + 1] as number;
  return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
}

/** Height gradient (rise per world unit along X and Z) by central differences. */
export function sampleGradient(
  field: HeightField,
  x: number,
  z: number
): { readonly dx: number; readonly dz: number } {
  const spacing = heightFieldSpacing(field);
  return {
    dx:
      (sampleHeight(field, x + spacing.x, z) - sampleHeight(field, x - spacing.x, z)) /
      (2 * spacing.x),
    dz:
      (sampleHeight(field, x, z + spacing.z) - sampleHeight(field, x, z - spacing.z)) /
      (2 * spacing.z),
  };
}

/** Slope as rise over run (0 is flat, 1 is 45°). */
export function sampleSlope(field: HeightField, x: number, z: number): number {
  const { dx, dz } = sampleGradient(field, x, z);
  return Math.sqrt(dx * dx + dz * dz);
}

/** Unit surface normal (Y up). */
export function sampleNormal(field: HeightField, x: number, z: number): SurfaceNormal {
  const { dx, dz } = sampleGradient(field, x, z);
  const length = Math.sqrt(dx * dx + 1 + dz * dz);
  return { x: -dx / length, y: 1 / length, z: -dz / length };
}

/** Lowest and highest sample. */
export function heightFieldRange(field: HeightField): {
  readonly min: number;
  readonly max: number;
} {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of field.heights) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

/**
 * Resamples `source` onto a new grid (for example a DEM onto a finer or
 * coarser board grid). Positions outside the source clamp to its edges.
 */
export function resampleHeightField(
  source: HeightField,
  bounds: GroundBounds,
  width: number,
  height: number
): HeightField {
  const target = createHeightField({ bounds, width, height });
  fillHeightField(target, (x, z) => sampleHeight(source, x, z));
  return target;
}

/** Writes `fn(x, z, current)` into every sample, in row-major order. */
export function fillHeightField(
  field: HeightField,
  fn: (x: number, z: number, current: number) => number
): void {
  const spacing = heightFieldSpacing(field);
  for (let row = 0; row < field.height; row += 1) {
    const z = field.bounds.minZ + row * spacing.z;
    for (let column = 0; column < field.width; column += 1) {
      const index = row * field.width + column;
      field.heights[index] = fn(
        field.bounds.minX + column * spacing.x,
        z,
        field.heights[index] as number
      );
    }
  }
}
