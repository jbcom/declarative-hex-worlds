/**
 * `src/terrain/erosion.ts` — fluvial erosion: running water wearing a
 * composed relief into a landscape that drains.
 *
 * Relief built from noise, ridges and hills is full of closed hollows that
 * real country does not have: rain wore it into valleys that join and leave
 * by the lowest ground. `erodeHeightField` reproduces that with the stream
 * power law, `∂h/∂t = −K · A^m · S`, where A is the area draining through a
 * sample and S its slope toward its receiver. Each step:
 *
 * 1. **Routing** (`./flow`): hollows are filled, flats drained along their
 *    middle and every sample sent to one receiver, exactly as `traceDrainage`
 *    routes them; contributing areas accumulate.
 * 2. **Incision**, solved implicitly (Braun & Willett 2013): samples are
 *    visited downstream first, so a receiver's new height is known before
 *    its donors', and `h ← (h + F·h_r) / (1 + F)` with `F = K·Δt·A^m / L`.
 *    The scheme is unconditionally stable and never cuts below the receiver.
 *    A sample already below its receiver (the floor of a hollow) is left as
 *    it is: water ponds there instead of eroding. The rim a hollow spills
 *    over carries everything the hollow gathers, so it is cut fastest and
 *    the hollow drains within a few steps, by a valley rather than a notch.
 * 3. **Hillslope diffusion** (optional): soil creep, `∂h/∂t = κ∇²h`, which
 *    rounds the V of a fresh cut into a valley profile.
 *
 * Edge samples are the base level: water leaves the field there and their
 * heights never change, so an eroded field still meets the ground around
 * it. Only arithmetic, comparisons, Math.sqrt and Math.pow touch the data,
 * so output is identical on every run. No randomness is involved.
 *
 * @module
 */
import { GameboardValidationError } from '../errors';
import { MAX_DRAINAGE_SAMPLES } from './drainage';
import { gridSpacing, type HeightField } from './field';
import { routeSurfaceFlow } from './flow';
import { validateSearchField } from './grid-search';

/** Options for {@link erodeHeightField}. */
export interface ErodeHeightFieldOptions {
  /** Erosion steps (default 20). Each re-routes the flow over the eroded ground. */
  readonly iterations?: number;
  /**
   * Erodibility times the time step, K·Δt, per iteration, in world
   * units^(1 − 2m). Larger cuts faster: with m = 0.5, a sample draining
   * 1 km² (A^m = 1000 m) 10 m above its receiver loses about
   * `10 · F / (1 + F)` with F = 1000·K·Δt / 10.
   */
  readonly erodibility: number;
  /** Area exponent m (default 0.5, the usual value for bedrock channels). */
  readonly areaExponent?: number;
  /**
   * Soil creep per iteration, κ·Δt / spacing², in [0, 0.25] (default 0): the
   * share of the difference from its neighbours' mean a sample moves by.
   * Above 0.25 the explicit step is unstable.
   */
  readonly diffusion?: number;
}

function requireInRange(value: number, min: number, max: number, what: string): void {
  if (!(value >= min && value <= max)) {
    throw new GameboardValidationError(`${what} must be in [${min}, ${max}]; got ${value}`);
  }
}

/** One explicit step of linear diffusion over the interior; edges hold. */
function diffuse(heights: Float32Array, width: number, height: number, rate: number): void {
  const before = Float32Array.from(heights);
  for (let row = 1; row < height - 1; row += 1) {
    for (let column = 1; column < width - 1; column += 1) {
      const i = row * width + column;
      const centre = before[i] as number;
      const laplacian =
        (before[i - 1] as number) +
        (before[i + 1] as number) +
        (before[i - width] as number) +
        (before[i + width] as number) -
        4 * centre;
      heights[i] = centre + rate * laplacian;
    }
  }
}

/** Erodes a copy of `field`. See the module documentation. */
export function erodeHeightField(
  field: HeightField,
  options: ErodeHeightFieldOptions
): HeightField {
  // Erosion routes flow exactly as traceDrainage does, so it takes the same fields.
  validateSearchField(field, MAX_DRAINAGE_SAMPLES, 'eroded field');
  const { width, height } = field;
  const iterations = options.iterations ?? 20;
  if (!Number.isInteger(iterations) || iterations < 0) {
    throw new GameboardValidationError(
      `erosion iterations must be a non-negative integer; got ${iterations}`
    );
  }
  const k = options.erodibility;
  if (!(k >= 0) || !Number.isFinite(k)) {
    throw new GameboardValidationError(`erodibility must be a non-negative number; got ${k}`);
  }
  const m = options.areaExponent ?? 0.5;
  requireInRange(m, 0, 2, 'erosion areaExponent');
  const diffusion = options.diffusion ?? 0;
  requireInRange(diffusion, 0, 0.25, 'erosion diffusion');

  const spacing = gridSpacing(field);
  const diagonal = Math.sqrt(spacing.x * spacing.x + spacing.z * spacing.z);
  const heights = Float32Array.from(field.heights);
  const current: HeightField = { ...field, heights };
  for (let step = 0; step < iterations; step += 1) {
    const flow = routeSurfaceFlow(current);
    const { order, receivers, area, filled } = flow;
    // Samples under standing water once the hollows fill.
    const ponded = new Uint8Array(heights.length);
    for (let i = 0; i < heights.length; i += 1) {
      if ((filled[i] as number) > (heights[i] as number)) ponded[i] = 1;
    }
    for (let p = 0; p < order.length; p += 1) {
      const cell = order[p] as number;
      const receiver = receivers[cell] as number;
      if (receiver < 0) continue;
      const h = heights[cell] as number;
      // Water running into a pond cuts only down to its surface. A pond's
      // own floor lies below that surface and so stays put, until the rim
      // it spills over is cut below it and the pond drains.
      const hr =
        ponded[receiver] === 1 ? (filled[receiver] as number) : (heights[receiver] as number);
      if (!(h > hr)) continue;
      const delta = receiver - cell;
      const length =
        delta === 1 || delta === -1
          ? spacing.x
          : delta === width || delta === -width
            ? spacing.z
            : diagonal;
      const f = (k * (area[cell] as number) ** m) / length;
      heights[cell] = (h + f * hr) / (1 + f);
    }
    if (diffusion > 0) diffuse(heights, width, height, diffusion);
  }
  return { bounds: field.bounds, width, height, heights };
}
