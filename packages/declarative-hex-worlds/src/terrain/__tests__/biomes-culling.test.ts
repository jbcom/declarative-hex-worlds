/**
 * Culled painting must be byte-identical to evaluating every paint at every
 * sample. The brute-force reference below is the pre-culling algorithm,
 * deliberately kept here and not in `src`: it is the specification the fast
 * path is held to.
 */
import { describe, expect, it } from 'vitest';
import {
  type BiomeCondition,
  type BiomeField,
  type ClassifyBiomesOptions,
  classifyBiomes,
} from '../biomes';
import { sampleHeight, sampleSlope } from '../field';
import { createPolylineIndex, signedDistanceToPolygon, smoothstep } from '../geometry2d';
import { createNoise2D, fractalNoise, type Noise2D } from '../noise';
import { cullingCases } from './biome-culling-cases';

function band(value: number, condition: { min?: number; max?: number; feather?: number }): number {
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

/** Every paint at every sample; the algorithm `classifyBiomes` replaced. */
function bruteForceClassify(options: ClassifyBiomesOptions): BiomeField {
  const { terrain, biomes } = options;
  const channelOf = new Map(biomes.map((id, index) => [id, index]));
  const baseChannel = channelOf.get(options.base) as number;
  const seed = String(options.seed);
  const paints = options.paints.map((paint, paintIndex) => {
    const strength = paint.strength ?? 1;
    const warp = paint.warp;
    return {
      channel: channelOf.get(paint.biome) as number,
      strength: strength < 0 ? 0 : strength > 1 ? 1 : strength,
      warp: warp && {
        amplitude: warp.amplitude,
        options: { wavelength: warp.wavelength, octaves: 3 },
        x: createNoise2D(`${seed}:paint:${paintIndex}:warp-x`),
        z: createNoise2D(`${seed}:paint:${paintIndex}:warp-z`),
      },
      conditions: paint.where.map((condition: BiomeCondition, conditionIndex) => ({
        condition,
        index:
          condition.kind === 'line'
            ? createPolylineIndex(
                condition.line,
                condition.halfWidth + (condition.feather ?? 0) / 2
              )
            : null,
        noise:
          condition.kind === 'noise'
            ? createNoise2D(
                `${seed}:paint:${paintIndex}:${String(condition.seed ?? conditionIndex)}`
              )
            : (null as Noise2D | null),
      })),
    };
  });

  const bounds = options.bounds ?? terrain.bounds;
  const width = options.width ?? terrain.width;
  const height = options.height ?? terrain.height;
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
      for (const paint of paints) {
        let coverage = paint.strength;
        const warped = paint.warp
          ? {
              x: x + paint.warp.amplitude * fractalNoise(paint.warp.x, x, z, paint.warp.options),
              z: z + paint.warp.amplitude * fractalNoise(paint.warp.z, x, z, paint.warp.options),
            }
          : { x, z };
        for (let i = 0; i < paint.conditions.length && coverage > 0; i += 1) {
          const { condition, index, noise } = paint.conditions[i] as (typeof paint.conditions)[0];
          const half = (condition.feather ?? 0) / 2;
          switch (condition.kind) {
            case 'height':
              coverage *= band(sampleHeight(terrain, x, z), condition);
              break;
            case 'slope':
              coverage *= band(sampleSlope(terrain, x, z), condition);
              break;
            case 'area':
              coverage *=
                1 - smoothstep(-half, half, signedDistanceToPolygon(condition.polygon, warped));
              break;
            case 'line': {
              const d = (index as NonNullable<typeof index>).distanceWithin(warped);
              coverage *= 1 - smoothstep(condition.halfWidth - half, condition.halfWidth + half, d);
              break;
            }
            case 'noise': {
              const value = fractalNoise(noise as Noise2D, warped.x, warped.z, {
                wavelength: condition.wavelength,
                octaves: condition.octaves ?? 3,
              });
              coverage *= smoothstep(condition.threshold - half, condition.threshold + half, value);
              break;
            }
          }
        }
        if (coverage <= 0) continue;
        for (let k = 0; k < channels; k += 1) scratch[k] = (scratch[k] as number) * (1 - coverage);
        scratch[paint.channel] = (scratch[paint.channel] as number) + coverage;
      }
      weights.set(scratch, (row * width + column) * channels);
    }
  }
  return { bounds, width, height, biomes, weights };
}

function bytes(field: BiomeField): Uint8Array {
  return new Uint8Array(field.weights.buffer, field.weights.byteOffset, field.weights.byteLength);
}

function firstDifference(a: BiomeField, b: BiomeField): string | null {
  const x = bytes(a);
  const y = bytes(b);
  if (x.length !== y.length) return `length ${x.length} vs ${y.length}`;
  for (let i = 0; i < x.length; i += 1) {
    if (x[i] !== y[i]) {
      const sample = Math.floor(i / 4 / a.biomes.length);
      return `byte ${i} (sample ${sample % a.width},${Math.floor(sample / a.width)}): ${x[i]} vs ${y[i]}`;
    }
  }
  return null;
}

describe('classifyBiomes culling', () => {
  for (const { name, options } of cullingCases()) {
    it(`is byte-identical to brute force: ${name}`, () => {
      expect(firstDifference(classifyBiomes(options), bruteForceClassify(options))).toBeNull();
    });
  }

  it('paints something in every scenario that is not meant to be empty', () => {
    // Guards the comparison itself: a scenario that painted nothing would pass trivially.
    const painted = cullingCases().filter(({ options }) => {
      const field = bruteForceClassify(options);
      const channels = field.biomes.length;
      const base = field.biomes.indexOf(options.base);
      for (let s = 0; s < field.width * field.height; s += 1) {
        if ((field.weights[s * channels + base] as number) !== 1) return true;
      }
      return false;
    });
    expect(painted.length).toBeGreaterThanOrEqual(40);
  });
});
