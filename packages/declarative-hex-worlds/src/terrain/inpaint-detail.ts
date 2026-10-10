/**
 * `src/terrain/inpaint-detail.ts` — fine-relief restoration for in-painting.
 *
 * A harmonic fill is smooth: it has none of the grain that measured ground
 * has everywhere else, and from the air a smooth patch is a tell. These
 * helpers measure the grain of the known ground around a region and synthesise
 * seeded fractal noise of matching strength to lay back over the fill.
 *
 * Grain is measured with a four-point stencil, `h − mean(h at ±k along X and
 * Z)`. Unlike subtracting a box mean it is exactly zero on any plane, so a
 * steep hillside, or a window truncated by the excavation, does not read as
 * relief. At `k` about a quarter wavelength it responds fully to features of
 * that wavelength and fades for broader ones.
 *
 * Arithmetic and `Math.sqrt` only; the noise is the tier's seeded simplex.
 *
 * @module
 */
import { GameboardValidationError } from '../errors';
import { createNoise2D, fractalNoise, type Noise2D } from './noise';

/** Restores fine relief over an in-painted region. */
export interface InpaintDetail {
  /** Seed for the synthesised relief; the same seed always gives the same grain. */
  readonly seed: string | number;
  /**
   * Strength of the relief: `'match'` (default) measures the RMS of the known
   * ground just outside the region and matches it; a number is the noise's
   * nominal amplitude in world units, as for a `noise` layer.
   */
  readonly amplitude?: number | 'match';
  /**
   * World-unit length of the relief's dominant features (default: eight sample
   * spacings). Set it to the scale of the grain you want to restore. The relief
   * fades in over this distance inside the region's edge, so the fill meets the
   * surrounding ground unchanged.
   */
  readonly wavelength?: number;
}

/** An {@link InpaintDetail} with every default applied and measures derived. */
export interface ResolvedDetail {
  readonly seed: string | number;
  readonly amplitude: number | 'match';
  readonly wavelength: number;
  /** Stencil half-width, in samples, along X and Z. */
  readonly stencilX: number;
  readonly stencilZ: number;
  /** World-unit width of the band of known ground the grain is measured over. */
  readonly ringWidth: number;
}

/** Width of the measuring band, in wavelengths (and at least four sample spacings). */
const RING_WAVELENGTHS = 2;

export function validateDetail(detail: InpaintDetail): void {
  const { seed, amplitude, wavelength } = detail;
  if (typeof seed !== 'string' && !(typeof seed === 'number' && Number.isFinite(seed))) {
    throw new GameboardValidationError('inpaint detail seed must be a string or a finite number');
  }
  if (amplitude !== undefined && amplitude !== 'match') {
    if (!(amplitude >= 0) || !Number.isFinite(amplitude)) {
      throw new GameboardValidationError(
        `inpaint detail amplitude must be "match" or a non-negative number; got ${amplitude}`
      );
    }
  }
  if (wavelength !== undefined && (!(wavelength > 0) || !Number.isFinite(wavelength))) {
    throw new GameboardValidationError(
      `inpaint detail wavelength must be positive; got ${wavelength}`
    );
  }
}

export function resolveDetail(
  detail: InpaintDetail,
  spacing: { readonly x: number; readonly z: number }
): ResolvedDetail {
  const widest = spacing.x > spacing.z ? spacing.x : spacing.z;
  const wavelength = detail.wavelength ?? 8 * widest;
  const stencil = (step: number): number => Math.max(1, Math.round(wavelength / (4 * step)));
  return {
    seed: detail.seed,
    amplitude: detail.amplitude ?? 'match',
    wavelength,
    stencilX: stencil(spacing.x),
    stencilZ: stencil(spacing.z),
    ringWidth: RING_WAVELENGTHS * Math.max(wavelength, 4 * widest),
  };
}

/** The relief noise: fractal simplex in roughly [-1, 1], dominated by `wavelength`. */
export function createDetailNoise(detail: ResolvedDetail): Noise2D {
  const noise = createNoise2D(`inpaint-detail:${String(detail.seed)}`);
  const options = { wavelength: detail.wavelength, octaves: 3 };
  return (x, z) => fractalNoise(noise, x, z, options);
}

/**
 * Sum of squared stencil residuals over the `ring` samples whose four stencil
 * points all lie inside the grid and are known (`mask !== 1`), and how many
 * there were.
 */
export function ringStencilEnergy(
  values: Float64Array,
  mask: Uint8Array,
  columns: number,
  rows: number,
  detail: ResolvedDetail
): { readonly energy: number; readonly count: number } {
  const { stencilX, stencilZ } = detail;
  const up = stencilZ * columns;
  let energy = 0;
  let count = 0;
  for (let row = stencilZ; row < rows - stencilZ; row += 1) {
    for (let column = stencilX; column < columns - stencilX; column += 1) {
      const i = row * columns + column;
      if (mask[i] !== 2) continue;
      if (
        mask[i - stencilX] === 1 ||
        mask[i + stencilX] === 1 ||
        mask[i - up] === 1 ||
        mask[i + up] === 1
      ) {
        continue;
      }
      const residual =
        (values[i] as number) -
        ((values[i - stencilX] as number) +
          (values[i + stencilX] as number) +
          (values[i - up] as number) +
          (values[i + up] as number)) /
          4;
      energy += residual * residual;
      count += 1;
    }
  }
  return { energy, count };
}

/**
 * RMS stencil residual of the unit relief noise on a grid of this spacing:
 * what a noise amplitude of 1 contributes, so a measured RMS can be matched
 * by scaling. Evaluated over a patch spanning several wavelengths.
 */
export function unitNoiseResidualRms(
  noise: Noise2D,
  spacing: { readonly x: number; readonly z: number },
  detail: ResolvedDetail
): number {
  const { stencilX, stencilZ } = detail;
  const size = 8 * Math.max(stencilX, stencilZ) + 16;
  const sample = new Float64Array(size * size);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      sample[row * size + column] = noise(column * spacing.x, row * spacing.z);
    }
  }
  let energy = 0;
  let count = 0;
  for (let row = stencilZ; row < size - stencilZ; row += 1) {
    for (let column = stencilX; column < size - stencilX; column += 1) {
      const i = row * size + column;
      const residual =
        (sample[i] as number) -
        ((sample[i - stencilX] as number) +
          (sample[i + stencilX] as number) +
          (sample[i - stencilZ * size] as number) +
          (sample[i + stencilZ * size] as number)) /
          4;
      energy += residual * residual;
      count += 1;
    }
  }
  return Math.sqrt(energy / count);
}
