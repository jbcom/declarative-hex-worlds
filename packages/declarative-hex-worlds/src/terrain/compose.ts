/**
 * `src/terrain/compose.ts` — declarative height-field composition.
 *
 * A terrain is a base (flat, or a measured elevation model) plus an ordered
 * list of layers: fractal relief, ridgelines, hills, stream channels, flattened
 * areas and vertical scaling. The same definition and seed always produce the
 * same field.
 *
 * @module
 */
import { GameboardValidationError } from '../errors';
import {
  createHeightFieldWithSpacing,
  fillHeightField,
  type HeightField,
  heightFieldRange,
  sampleHeight,
} from './field';
import {
  distanceToPolyline,
  type GroundBounds,
  type GroundPoint,
  type GroundPolygon,
  type GroundPolyline,
  signedDistanceToPolygon,
  smoothstep,
} from './geometry2d';
import { createNoise2D, fractalNoise, ridgedNoise } from './noise';

/** Cross-section of a ridge or hill: how height falls off with distance. */
export type TerrainProfile =
  /** Rounded shoulders, like a smoothstep (the default). */
  | 'smooth'
  /** A pointed crest with concave flanks. */
  | 'sharp'
  /** A flat top over the inner 40 % before the shoulders. */
  | 'plateau';

/** Fractal relief added everywhere. */
export interface NoiseTerrainLayer {
  readonly kind: 'noise';
  /** Peak deviation in world units. */
  readonly amplitude: number;
  readonly wavelength: number;
  readonly octaves?: number;
  readonly lacunarity?: number;
  readonly gain?: number;
  /** Ridged noise (crests) instead of rolling fBm. */
  readonly ridged?: boolean;
  /** Sub-seed so two noise layers differ; defaults to the layer index. */
  readonly seed?: string | number;
}

/** A raised crest along a polyline. */
export interface RidgeTerrainLayer {
  readonly kind: 'ridge';
  readonly line: GroundPolyline;
  readonly height: number;
  /** Distance from the crest at which the ridge meets the ground. */
  readonly halfWidth: number;
  readonly profile?: TerrainProfile;
}

/** A raised mound around a point. */
export interface HillTerrainLayer {
  readonly kind: 'hill';
  readonly center: GroundPoint;
  readonly height: number;
  readonly radius: number;
  readonly profile?: TerrainProfile;
}

/** A carved channel (stream bed, sunken road, railroad cut) along a polyline. */
export interface ChannelTerrainLayer {
  readonly kind: 'channel';
  readonly line: GroundPolyline;
  readonly depth: number;
  readonly halfWidth: number;
}

/** Blends an area toward a level surface (a town, a field, a quarry floor). */
export interface FlattenTerrainLayer {
  readonly kind: 'flatten';
  readonly polygon: GroundPolygon;
  /** Target height; defaults to the current height at the polygon's first vertex. */
  readonly height?: number;
  /** Width of the blend band straddling the polygon's edge. */
  readonly feather: number;
  /** 0–1: how completely the area is levelled (default 1). */
  readonly strength?: number;
}

/** Scales heights about a pivot: vertical exaggeration for readability. */
export interface ScaleTerrainLayer {
  readonly kind: 'scale';
  readonly factor: number;
  /** Height that stays fixed; defaults to the field's current minimum. */
  readonly pivot?: number;
}

/** Adds another height field (for example measured elevation), sampled bilinearly. */
export interface FieldTerrainLayer {
  readonly kind: 'field';
  readonly field: HeightField;
  readonly weight?: number;
}

/** Any composable terrain layer. */
export type TerrainLayer =
  | NoiseTerrainLayer
  | RidgeTerrainLayer
  | HillTerrainLayer
  | ChannelTerrainLayer
  | FlattenTerrainLayer
  | ScaleTerrainLayer
  | FieldTerrainLayer;

/** Options for {@link composeHeightField}. */
export interface ComposeHeightFieldOptions {
  readonly bounds: GroundBounds;
  /** World-unit distance between samples; bounds must be whole multiples of it. */
  readonly spacing: number;
  readonly seed: string | number;
  /** A constant base height (default 0) or a field to start from. */
  readonly base?: number | HeightField;
  readonly layers: readonly TerrainLayer[];
}

/** Falloff weight at normalised distance `t` (0 at the crest, 1 at the foot). */
export function terrainProfileWeight(profile: TerrainProfile, t: number): number {
  if (t >= 1) return 0;
  const u = t <= 0 ? 0 : t;
  if (profile === 'sharp') {
    const v = 1 - u;
    return v * v;
  }
  if (profile === 'plateau') return u <= 0.4 ? 1 : 1 - smoothstep(0.4, 1, u);
  return 1 - smoothstep(0, 1, u);
}

function requirePositive(value: number, what: string): void {
  if (!(value > 0)) throw new GameboardValidationError(`${what} must be positive; got ${value}`);
}

function applyLayer(field: HeightField, layer: TerrainLayer, index: number, seed: string): void {
  switch (layer.kind) {
    case 'noise': {
      requirePositive(layer.wavelength, 'noise layer wavelength');
      const noise = createNoise2D(`${seed}:${String(layer.seed ?? index)}`);
      const options = {
        wavelength: layer.wavelength,
        ...(layer.octaves === undefined ? {} : { octaves: layer.octaves }),
        ...(layer.lacunarity === undefined ? {} : { lacunarity: layer.lacunarity }),
        ...(layer.gain === undefined ? {} : { gain: layer.gain }),
      };
      const sample = layer.ridged ? ridgedNoise : fractalNoise;
      fillHeightField(field, (x, z, h) => h + layer.amplitude * sample(noise, x, z, options));
      return;
    }
    case 'ridge': {
      requirePositive(layer.halfWidth, 'ridge layer halfWidth');
      const profile = layer.profile ?? 'smooth';
      fillHeightField(field, (x, z, h) => {
        const t = distanceToPolyline({ x, z }, layer.line) / layer.halfWidth;
        return h + layer.height * terrainProfileWeight(profile, t);
      });
      return;
    }
    case 'hill': {
      requirePositive(layer.radius, 'hill layer radius');
      const profile = layer.profile ?? 'smooth';
      fillHeightField(field, (x, z, h) => {
        const dx = x - layer.center.x;
        const dz = z - layer.center.z;
        const t = Math.sqrt(dx * dx + dz * dz) / layer.radius;
        return h + layer.height * terrainProfileWeight(profile, t);
      });
      return;
    }
    case 'channel': {
      requirePositive(layer.halfWidth, 'channel layer halfWidth');
      fillHeightField(field, (x, z, h) => {
        const t = distanceToPolyline({ x, z }, layer.line) / layer.halfWidth;
        return h - layer.depth * terrainProfileWeight('smooth', t);
      });
      return;
    }
    case 'flatten': {
      if (layer.polygon.length < 3) {
        throw new GameboardValidationError('flatten layer polygon needs at least three points');
      }
      const anchor = layer.polygon[0] as GroundPoint;
      const target = layer.height ?? sampleHeight(field, anchor.x, anchor.z);
      const strength = layer.strength ?? 1;
      const half = layer.feather / 2;
      fillHeightField(field, (x, z, h) => {
        const d = signedDistanceToPolygon(layer.polygon, { x, z });
        const w = strength * (1 - smoothstep(-half, half, d));
        return h + (target - h) * w;
      });
      return;
    }
    case 'scale': {
      const pivot = layer.pivot ?? heightFieldRange(field).min;
      fillHeightField(field, (_x, _z, h) => pivot + (h - pivot) * layer.factor);
      return;
    }
    case 'field': {
      const weight = layer.weight ?? 1;
      fillHeightField(field, (x, z, h) => h + weight * sampleHeight(layer.field, x, z));
      return;
    }
  }
}

/** Builds a height field from a base and an ordered list of layers. */
export function composeHeightField(options: ComposeHeightFieldOptions): HeightField {
  const field = createHeightFieldWithSpacing(options.bounds, options.spacing);
  const base = options.base ?? 0;
  if (typeof base === 'number') field.heights.fill(base);
  else fillHeightField(field, (x, z) => sampleHeight(base, x, z));
  const seed = String(options.seed);
  options.layers.forEach((layer, index) => {
    applyLayer(field, layer, index, seed);
  });
  return field;
}
