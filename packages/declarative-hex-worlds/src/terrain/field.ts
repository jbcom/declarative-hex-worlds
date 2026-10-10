/**
 * `src/terrain/field.ts` — continuous height fields.
 *
 * A height field is a regular grid of heights over ground bounds, with the
 * first and last samples sitting exactly on the bounds' edges. Sampling is
 * bilinear and clamped at the edges.
 *
 * Renderers: a height texture filtered bilinearly reproduces
 * {@link sampleHeight} (to texture precision) when sampled through
 * {@link heightFieldTextureTransform}, which maps sample positions onto texel
 * centres. A displaced triangle mesh does not — each cell's two triangles
 * deviate from the bilinear patch by up to a quarter of the cell's
 * diagonal-difference — so objects placed with `sampleHeight` should sit on
 * bases or skirts that absorb that difference, or the mesh should be at
 * least as dense as the field.
 *
 * @module
 */
import { GameboardValidationError } from '../errors';
import type { GroundBounds, GroundPoint } from './geometry2d';

/** The shape shared by every regular grid in this tier (height and biome fields). */
export interface GroundGrid {
  readonly bounds: GroundBounds;
  /** Samples per row (along X). At least 2. */
  readonly width: number;
  /** Rows (along Z). At least 2. */
  readonly height: number;
}

/** A regular grid of heights in world units, row-major from (minX, minZ). */
export interface HeightField extends GroundGrid {
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
  x: number;
  y: number;
  z: number;
}

/** Rise per world unit along X and Z. */
export interface HeightGradient {
  dx: number;
  dz: number;
}

/** Largest grid this tier allocates (2^26 samples, 256 MB of Float32). */
export const MAX_GRID_SAMPLES = 67_108_864;

/** Validates a grid's bounds and dimensions, naming `what` in errors. */
export function validateGroundGrid(grid: GroundGrid, what: string): void {
  const { bounds, width, height } = grid;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
    throw new GameboardValidationError(
      `${what} needs integer width and height of at least 2; got ${width}×${height}`
    );
  }
  if (width * height > MAX_GRID_SAMPLES) {
    throw new GameboardValidationError(
      `${what} of ${width}×${height} exceeds ${MAX_GRID_SAMPLES} samples`
    );
  }
  const finite = [bounds.minX, bounds.minZ, bounds.maxX, bounds.maxZ].every(Number.isFinite);
  if (!finite || !(bounds.maxX > bounds.minX) || !(bounds.maxZ > bounds.minZ)) {
    throw new GameboardValidationError(`${what} bounds must be finite with positive extent`);
  }
}

/** Validates options and creates a height field. */
export function createHeightField(options: CreateHeightFieldOptions): HeightField {
  const { bounds, width, height } = options;
  validateGroundGrid({ bounds, width, height }, 'height field');
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

/** Whole cells along an extent, tolerating floating-point division error. */
function wholeCells(extent: number, spacing: number): number | null {
  const cells = extent / spacing;
  const rounded = Math.round(cells);
  return Math.abs(cells - rounded) <= 1e-9 * Math.max(1, rounded) ? rounded : null;
}

/**
 * Creates a zero height field whose samples are `spacing` apart. The bounds'
 * extents must be whole multiples of the spacing (within floating-point error).
 */
export function createHeightFieldWithSpacing(bounds: GroundBounds, spacing: number): HeightField {
  if (!(spacing > 0) || !Number.isFinite(spacing)) {
    throw new GameboardValidationError(`height field spacing must be positive; got ${spacing}`);
  }
  const cellsX = wholeCells(bounds.maxX - bounds.minX, spacing);
  const cellsZ = wholeCells(bounds.maxZ - bounds.minZ, spacing);
  if (cellsX === null || cellsZ === null) {
    throw new GameboardValidationError(
      `height field bounds must be whole multiples of the spacing ${spacing}`
    );
  }
  return createHeightField({ bounds, width: cellsX + 1, height: cellsZ + 1 });
}

/** World-unit distance between neighbouring samples along X and Z. */
export function gridSpacing(grid: GroundGrid): { readonly x: number; readonly z: number } {
  return {
    x: (grid.bounds.maxX - grid.bounds.minX) / (grid.width - 1),
    z: (grid.bounds.maxZ - grid.bounds.minZ) / (grid.height - 1),
  };
}

/** World-unit distance between neighbouring height samples. */
export function heightFieldSpacing(field: HeightField): { readonly x: number; readonly z: number } {
  return gridSpacing(field);
}

/**
 * Maps world X/Z to texture UV so that sample `i` lands on texel centre
 * `(i + 0.5) / N`: `u = x * scaleX + offsetX`, `v = z * scaleZ + offsetZ`.
 * Use it to sample a height (or biome) texture built from this grid.
 */
export function heightFieldTextureTransform(grid: GroundGrid): {
  readonly scaleX: number;
  readonly offsetX: number;
  readonly scaleZ: number;
  readonly offsetZ: number;
} {
  const { bounds, width, height } = grid;
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  return {
    scaleX: (width - 1) / (width * spanX),
    offsetX: (0.5 - (bounds.minX * (width - 1)) / spanX) / width,
    scaleZ: (height - 1) / (height * spanZ),
    offsetZ: (0.5 - (bounds.minZ * (height - 1)) / spanZ) / height,
  };
}

/** World position of the sample at `column`, `row`. */
export function heightFieldSamplePosition(
  field: HeightField,
  column: number,
  row: number
): GroundPoint {
  const spacing = gridSpacing(field);
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

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Height gradient by finite differences one sample spacing either side,
 * clamped to the field so edges use one-sided differences over the true
 * distance. Writes into `out` when given (no allocation).
 */
export function sampleGradient(
  field: HeightField,
  x: number,
  z: number,
  out: HeightGradient = { dx: 0, dz: 0 }
): HeightGradient {
  const { bounds } = field;
  const spacing = gridSpacing(field);
  const x0 = clamp(x - spacing.x, bounds.minX, bounds.maxX);
  const x1 = clamp(x + spacing.x, bounds.minX, bounds.maxX);
  const z0 = clamp(z - spacing.z, bounds.minZ, bounds.maxZ);
  const z1 = clamp(z + spacing.z, bounds.minZ, bounds.maxZ);
  out.dx = (sampleHeight(field, x1, z) - sampleHeight(field, x0, z)) / (x1 - x0);
  out.dz = (sampleHeight(field, x, z1) - sampleHeight(field, x, z0)) / (z1 - z0);
  return out;
}

const scratchGradient: HeightGradient = { dx: 0, dz: 0 };

/** Slope as rise over run (0 is flat, 1 is 45°). */
export function sampleSlope(field: HeightField, x: number, z: number): number {
  const { dx, dz } = sampleGradient(field, x, z, scratchGradient);
  return Math.sqrt(dx * dx + dz * dz);
}

/** Unit surface normal (Y up). Writes into `out` when given (no allocation). */
export function sampleNormal(
  field: HeightField,
  x: number,
  z: number,
  out: SurfaceNormal = { x: 0, y: 1, z: 0 }
): SurfaceNormal {
  const { dx, dz } = sampleGradient(field, x, z, scratchGradient);
  const length = Math.sqrt(dx * dx + 1 + dz * dz);
  out.x = -dx / length;
  out.y = 1 / length;
  out.z = -dz / length;
  return out;
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
  const spacing = gridSpacing(field);
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
