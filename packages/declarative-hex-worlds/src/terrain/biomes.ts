/**
 * `src/terrain/biomes.ts` — declarative biome painting over a height field.
 *
 * A biome field holds, for every sample, a weight per biome that sums to 1.
 * It starts entirely in a base biome; each paint then blends its biome in
 * wherever all of its conditions hold (height bands, slope bands, authored
 * areas and corridors, noise patches), with feathered edges. An optional
 * domain warp bends the spatial conditions so authored boundaries read as
 * natural, not drafted. Renderers blend ground materials by these weights, so
 * no tile or hex boundary is ever visible.
 *
 * @module
 */
import { GameboardValidationError } from '../errors';
import {
  type GroundGrid,
  gridSpacing,
  type HeightField,
  sampleHeight,
  sampleSlope,
  validateGroundGrid,
} from './field';
import {
  createPolylineIndex,
  type GroundBounds,
  type GroundPolygon,
  type GroundPolyline,
  type PolylineIndex,
  signedDistanceToPolygon,
  smoothstep,
} from './geometry2d';
import { createNoise2D, fractalNoise, type Noise2D } from './noise';

/** A band condition on height or slope; a missing bound is open. */
export interface BandBiomeCondition {
  readonly kind: 'height' | 'slope';
  readonly min?: number;
  readonly max?: number;
  /** Blend width beyond each bound (default 0, a hard edge). */
  readonly feather?: number;
}

/** Inside an authored polygon. */
export interface AreaBiomeCondition {
  readonly kind: 'area';
  readonly polygon: GroundPolygon;
  /** Blend band straddling the edge (default 0). */
  readonly feather?: number;
}

/** Within `halfWidth` of an authored polyline (roads, banks, lanes). */
export interface LineBiomeCondition {
  readonly kind: 'line';
  readonly line: GroundPolyline;
  readonly halfWidth: number;
  readonly feather?: number;
}

/** Where fractal noise exceeds a threshold: natural patches and clearings. */
export interface NoiseBiomeCondition {
  readonly kind: 'noise';
  readonly wavelength: number;
  /** In [-1, 1]; higher thresholds give sparser patches. */
  readonly threshold: number;
  readonly feather?: number;
  readonly octaves?: number;
  readonly seed?: string | number;
}

/** Any biome condition. A paint applies where all of its conditions hold. */
export type BiomeCondition =
  | BandBiomeCondition
  | AreaBiomeCondition
  | LineBiomeCondition
  | NoiseBiomeCondition;

/** Bends spatial conditions by noise so authored edges look natural. */
export interface BiomeWarp {
  /** Maximum displacement in world units. */
  readonly amplitude: number;
  readonly wavelength: number;
}

/** One biome painted where its conditions hold. */
export interface BiomePaint {
  readonly biome: string;
  readonly where: readonly BiomeCondition[];
  /** Multiplier on the paint's coverage, clamped to 0–1 (default 1). */
  readonly strength?: number;
  readonly warp?: BiomeWarp;
}

/** Options for {@link classifyBiomes}. */
export interface ClassifyBiomesOptions {
  /** Heights and slopes are read from this field. */
  readonly terrain: HeightField;
  /** Grid of the result; defaults to the terrain's own grid. */
  readonly bounds?: GroundBounds;
  readonly width?: number;
  readonly height?: number;
  readonly seed: string | number;
  /** Every biome id the field can hold, in channel order. */
  readonly biomes: readonly string[];
  /** The biome every sample starts in. */
  readonly base: string;
  /** Applied in order; later paints cover earlier ones. */
  readonly paints: readonly BiomePaint[];
}

/** Per-sample biome weights on a regular grid (same layout as a height field). */
export interface BiomeField extends GroundGrid {
  readonly biomes: readonly string[];
  /** `width * height * biomes.length` weights, sample-major, each sample summing to 1. */
  readonly weights: Float32Array;
}

function band(value: number, condition: BandBiomeCondition): number {
  const feather = condition.feather ?? 0;
  let coverage = 1;
  if (condition.min !== undefined) {
    coverage *= smoothstep(condition.min - feather, condition.min, value);
  }
  if (condition.max !== undefined) {
    coverage *= 1 - smoothstep(condition.max, condition.max + feather, value);
  }
  return coverage;
}

/** A condition with its noise and spatial index resolved once per paint. */
type PreparedCondition =
  | { readonly kind: 'height' | 'slope'; readonly condition: BandBiomeCondition }
  | { readonly kind: 'area'; readonly condition: AreaBiomeCondition }
  | {
      readonly kind: 'line';
      readonly condition: LineBiomeCondition;
      readonly index: PolylineIndex;
    }
  | {
      readonly kind: 'noise';
      readonly condition: NoiseBiomeCondition;
      readonly noise: Noise2D;
    };

interface PreparedWarp {
  readonly amplitude: number;
  readonly options: { readonly wavelength: number; readonly octaves: 3 };
  readonly x: Noise2D;
  readonly z: Noise2D;
}

interface PreparedPaint {
  readonly channel: number;
  readonly strength: number;
  readonly warp: PreparedWarp | null;
  readonly conditions: readonly PreparedCondition[];
}

function requireNonNegative(value: number | undefined, what: string): void {
  if (value !== undefined && !(value >= 0)) {
    throw new GameboardValidationError(`${what} must not be negative; got ${value}`);
  }
}

function requirePositive(value: number, what: string): void {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new GameboardValidationError(`${what} must be positive; got ${value}`);
  }
}

function prepareCondition(
  condition: BiomeCondition,
  seed: string,
  paintIndex: number,
  conditionIndex: number
): PreparedCondition {
  const where = `paint ${paintIndex} condition ${conditionIndex}`;
  requireNonNegative(condition.feather, `${where} feather`);
  switch (condition.kind) {
    case 'height':
    case 'slope':
      return { kind: condition.kind, condition };
    case 'area':
      return { kind: 'area', condition };
    case 'line': {
      requirePositive(condition.halfWidth, `${where} halfWidth`);
      const cutoff = condition.halfWidth + (condition.feather ?? 0) / 2;
      return { kind: 'line', condition, index: createPolylineIndex(condition.line, cutoff) };
    }
    case 'noise':
      requirePositive(condition.wavelength, `${where} wavelength`);
      return {
        kind: 'noise',
        condition,
        noise: createNoise2D(
          `${seed}:paint:${paintIndex}:${String(condition.seed ?? conditionIndex)}`
        ),
      };
  }
}

/** Warped position, computed only once a spatial condition needs it. */
interface WarpedPoint {
  ready: boolean;
  x: number;
  z: number;
}

function warpedPoint(paint: PreparedPaint, x: number, z: number, point: WarpedPoint): WarpedPoint {
  if (point.ready) return point;
  point.ready = true;
  const { warp } = paint;
  if (warp) {
    point.x = x + warp.amplitude * fractalNoise(warp.x, x, z, warp.options);
    point.z = z + warp.amplitude * fractalNoise(warp.z, x, z, warp.options);
  } else {
    point.x = x;
    point.z = z;
  }
  return point;
}

function coverageOf(paint: PreparedPaint, terrain: HeightField, x: number, z: number): number {
  let coverage = paint.strength;
  const point: WarpedPoint = { ready: false, x, z };
  for (let i = 0; i < paint.conditions.length && coverage > 0; i += 1) {
    const prepared = paint.conditions[i] as PreparedCondition;
    switch (prepared.kind) {
      case 'height':
        coverage *= band(sampleHeight(terrain, x, z), prepared.condition);
        break;
      case 'slope':
        coverage *= band(sampleSlope(terrain, x, z), prepared.condition);
        break;
      case 'area': {
        const half = (prepared.condition.feather ?? 0) / 2;
        const p = warpedPoint(paint, x, z, point);
        const d = signedDistanceToPolygon(prepared.condition.polygon, p);
        coverage *= 1 - smoothstep(-half, half, d);
        break;
      }
      case 'line': {
        const half = (prepared.condition.feather ?? 0) / 2;
        const d = prepared.index.distanceWithin(warpedPoint(paint, x, z, point));
        const edge = prepared.condition.halfWidth;
        coverage *= 1 - smoothstep(edge - half, edge + half, d);
        break;
      }
      case 'noise': {
        const p = warpedPoint(paint, x, z, point);
        const value = fractalNoise(prepared.noise, p.x, p.z, {
          wavelength: prepared.condition.wavelength,
          octaves: prepared.condition.octaves ?? 3,
        });
        const half = (prepared.condition.feather ?? 0) / 2;
        coverage *= smoothstep(
          prepared.condition.threshold - half,
          prepared.condition.threshold + half,
          value
        );
        break;
      }
    }
  }
  return coverage;
}

/** Paints biomes over a terrain. See the module documentation. */
export function classifyBiomes(options: ClassifyBiomesOptions): BiomeField {
  const { terrain, biomes } = options;
  const channelOf = new Map(biomes.map((id, index) => [id, index]));
  if (channelOf.size !== biomes.length) {
    throw new GameboardValidationError('biome ids must be unique');
  }
  const baseChannel = channelOf.get(options.base);
  if (baseChannel === undefined) {
    throw new GameboardValidationError(`base biome "${options.base}" is not in the biome list`);
  }
  const seed = String(options.seed);
  const prepared: PreparedPaint[] = options.paints.map((paint, index) => {
    const channel = channelOf.get(paint.biome);
    if (channel === undefined) {
      throw new GameboardValidationError(`paint biome "${paint.biome}" is not in the biome list`);
    }
    if (paint.warp) requirePositive(paint.warp.wavelength, `paint ${index} warp wavelength`);
    const strength = paint.strength ?? 1;
    return {
      channel,
      strength: strength < 0 ? 0 : strength > 1 ? 1 : strength,
      warp: paint.warp
        ? {
            amplitude: paint.warp.amplitude,
            options: { wavelength: paint.warp.wavelength, octaves: 3 },
            x: createNoise2D(`${seed}:paint:${index}:warp-x`),
            z: createNoise2D(`${seed}:paint:${index}:warp-z`),
          }
        : null,
      conditions: paint.where.map((condition, conditionIndex) =>
        prepareCondition(condition, seed, index, conditionIndex)
      ),
    };
  });

  const bounds = options.bounds ?? terrain.bounds;
  const width = options.width ?? terrain.width;
  const height = options.height ?? terrain.height;
  validateGroundGrid({ bounds, width, height }, 'biome field');
  const channels = biomes.length;
  const weights = new Float32Array(width * height * channels);
  const scratch = new Float64Array(channels);
  const stepX = (bounds.maxX - bounds.minX) / (width - 1);
  const stepZ = (bounds.maxZ - bounds.minZ) / (height - 1);

  for (let row = 0; row < height; row += 1) {
    const z = bounds.minZ + row * stepZ;
    for (let column = 0; column < width; column += 1) {
      const x = bounds.minX + column * stepX;
      scratch.fill(0);
      scratch[baseChannel] = 1;
      for (const paint of prepared) {
        const c = coverageOf(paint, terrain, x, z);
        if (c <= 0) continue;
        for (let k = 0; k < channels; k += 1) scratch[k] = (scratch[k] as number) * (1 - c);
        scratch[paint.channel] = (scratch[paint.channel] as number) + c;
      }
      weights.set(scratch, (row * width + column) * channels);
    }
  }
  return { bounds, width, height, biomes, weights };
}

/**
 * Bilinear biome weights at a world position, clamped to the field's edges.
 * Writes into `out` (length ≥ biome count) when given, avoiding allocation.
 */
export function sampleBiomeWeights(
  field: BiomeField,
  x: number,
  z: number,
  out: Float32Array = new Float32Array(field.biomes.length)
): Float32Array {
  const { bounds, width, height, biomes, weights } = field;
  const channels = biomes.length;
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
  const i00 = (z0 * width + x0) * channels;
  const i10 = i00 + channels;
  const i01 = i00 + width * channels;
  const i11 = i01 + channels;
  for (let k = 0; k < channels; k += 1) {
    out[k] =
      ((weights[i00 + k] as number) * (1 - tx) + (weights[i10 + k] as number) * tx) * (1 - tz) +
      ((weights[i01 + k] as number) * (1 - tx) + (weights[i11 + k] as number) * tx) * tz;
  }
  return out;
}

/** The biome with the greatest weight at a position (ties go to the earlier biome). */
export function dominantBiome(field: BiomeField, x: number, z: number): string {
  const sample = sampleBiomeWeights(field, x, z);
  let best = 0;
  for (let k = 1; k < sample.length; k += 1) {
    if ((sample[k] as number) > (sample[best] as number)) best = k;
  }
  return field.biomes[best] as string;
}

/**
 * Packs biome weights into RGBA8 layers for a texture array: layer `n` holds
 * biomes `4n … 4n+3`. Weights are rounded to 0–255 independently, so a
 * texel's channels sum to 255 ± 2: shaders should renormalise by the sum.
 * Missing channels in the last layer are 0.
 */
export function packBiomeWeightsRgba(field: BiomeField): Uint8Array[] {
  const channels = field.biomes.length;
  const samples = field.width * field.height;
  const layers: Uint8Array[] = [];
  for (let first = 0; first < channels; first += 4) {
    const layer = new Uint8Array(samples * 4);
    for (let s = 0; s < samples; s += 1) {
      for (let c = 0; c < 4; c += 1) {
        const k = first + c;
        const w = k < channels ? (field.weights[s * channels + k] as number) : 0;
        layer[s * 4 + c] = Math.round(w * 255);
      }
    }
    layers.push(layer);
  }
  return layers;
}

/** World-unit spacing of a biome field's samples. */
export function biomeFieldSpacing(field: BiomeField): { readonly x: number; readonly z: number } {
  return gridSpacing(field);
}
