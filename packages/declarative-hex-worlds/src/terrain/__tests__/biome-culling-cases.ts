/**
 * Painting scenarios that stress spatial culling in `classifyBiomes`: warped
 * and unwarped areas and lines, features hugging or leaving the grid, features
 * smaller than one sample, shapes whose edge lands exactly on a sample, paints
 * combining several conditions, and inputs that cannot be bounded at all.
 *
 * Shared by the equivalence test and by any script that wants to checksum the
 * output across implementations.
 */
import type { BiomePaint, ClassifyBiomesOptions } from '../biomes';
import { composeHeightField } from '../compose';
import type { GroundPoint } from '../geometry2d';

export const CULLING_BIOMES = ['pasture', 'woods', 'rock', 'road', 'wheat'] as const;

/** Samples across and down, and the world-unit spacing (deliberately not a round binary fraction). */
const COLUMNS = 61;
const ROWS = 47;
const SPACING = 7.3;

const bounds = {
  minX: -100,
  minZ: -50,
  maxX: -100 + (COLUMNS - 1) * SPACING,
  maxZ: -50 + (ROWS - 1) * SPACING,
};
const spanX = bounds.maxX - bounds.minX;
const spanZ = bounds.maxZ - bounds.minZ;

const terrain = composeHeightField({
  bounds,
  spacing: SPACING,
  seed: 'culling',
  base: 20,
  layers: [
    { kind: 'noise', amplitude: 18, wavelength: 140, octaves: 4 },
    {
      kind: 'ridge',
      line: [
        { x: bounds.minX, z: bounds.minZ + spanZ * 0.3 },
        { x: bounds.maxX, z: bounds.minZ + spanZ * 0.7 },
      ],
      halfWidth: 90,
      height: 30,
      profile: 'sharp',
    },
  ],
});

export interface CullingCase {
  readonly name: string;
  readonly options: ClassifyBiomesOptions;
}

function scenario(
  name: string,
  paints: readonly BiomePaint[],
  overrides: Partial<ClassifyBiomesOptions> = {}
): CullingCase {
  return {
    name,
    options: {
      terrain,
      seed: `case:${name}`,
      biomes: CULLING_BIOMES,
      base: 'pasture',
      paints,
      ...overrides,
    },
  };
}

function box(x: number, z: number, w: number, d: number): GroundPoint[] {
  return [
    { x, z },
    { x: x + w, z },
    { x: x + w, z: z + d },
    { x, z: z + d },
  ];
}

const warp = { amplitude: 25, wavelength: 60 };
const middle = { x: bounds.minX + spanX / 2, z: bounds.minZ + spanZ / 2 };

/** A small deterministic generator, so the random cases are reproducible. */
function sequence(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function randomPaints(seed: number): BiomePaint[] {
  const next = sequence(seed);
  const between = (lo: number, hi: number) => lo + (hi - lo) * next();
  const point = (): GroundPoint => ({
    x: between(bounds.minX - spanX * 0.4, bounds.maxX + spanX * 0.4),
    z: between(bounds.minZ - spanZ * 0.4, bounds.maxZ + spanZ * 0.4),
  });
  const shape = (): GroundPoint[] => Array.from({ length: 1 + Math.floor(next() * 6) }, point);
  const paints: BiomePaint[] = [];
  const count = 2 + Math.floor(next() * 4);
  for (let i = 0; i < count; i += 1) {
    const where: BiomePaint['where'][number][] = [];
    const kinds = 1 + Math.floor(next() * 3);
    for (let k = 0; k < kinds; k += 1) {
      const pick = next();
      if (pick < 0.3) {
        where.push({ kind: 'area', polygon: shape(), feather: next() < 0.5 ? 0 : between(0, 60) });
      } else if (pick < 0.6) {
        where.push({
          kind: 'line',
          line: shape(),
          halfWidth: between(0.5, 25),
          feather: next() < 0.5 ? 0 : between(0, 30),
        });
      } else if (pick < 0.75) {
        where.push({ kind: 'noise', wavelength: between(20, 120), threshold: between(-0.4, 0.4) });
      } else if (pick < 0.9) {
        where.push({ kind: 'height', min: between(0, 40), feather: between(0, 10) });
      } else {
        where.push({ kind: 'slope', min: between(0, 0.3), feather: between(0, 0.1) });
      }
    }
    paints.push({
      biome: CULLING_BIOMES[1 + Math.floor(next() * 4)] as string,
      where,
      strength: next() < 0.3 ? between(0.2, 1) : undefined,
      warp:
        next() < 0.6 ? { amplitude: between(-80, 80), wavelength: between(20, 150) } : undefined,
    });
  }
  return paints;
}

/** Every scenario, in a stable order. */
export function cullingCases(): CullingCase[] {
  const cases: CullingCase[] = [
    scenario('areas and lines, warped and not', [
      { biome: 'woods', where: [{ kind: 'area', polygon: box(-60, -20, 120, 90), feather: 18 }] },
      {
        biome: 'wheat',
        where: [{ kind: 'area', polygon: box(100, 40, 90, 120), feather: 30 }],
        warp,
      },
      {
        biome: 'road',
        where: [
          {
            kind: 'line',
            line: [
              { x: bounds.minX, z: 0 },
              { x: 0, z: 90 },
              { x: bounds.maxX, z: 20 },
            ],
            halfWidth: 6,
            feather: 4,
          },
        ],
        warp,
      },
      {
        biome: 'road',
        where: [
          {
            kind: 'line',
            line: [
              { x: 20, z: bounds.minZ },
              { x: 60, z: bounds.maxZ },
            ],
            halfWidth: 3,
          },
        ],
      },
    ]),
    scenario('hugging and leaving the grid edges', [
      {
        biome: 'road',
        where: [
          {
            kind: 'line',
            line: [
              { x: bounds.minX, z: bounds.minZ },
              { x: bounds.minX, z: bounds.maxZ },
            ],
            halfWidth: 4,
            feather: 2,
          },
        ],
        warp: { amplitude: 6, wavelength: 40 },
      },
      {
        biome: 'road',
        where: [
          {
            kind: 'line',
            line: [
              { x: bounds.minX - 30, z: bounds.maxZ + 1 },
              { x: bounds.maxX + 30, z: bounds.maxZ + 1 },
            ],
            halfWidth: 5,
          },
        ],
      },
      {
        biome: 'road',
        where: [
          {
            kind: 'line',
            line: [
              { x: bounds.maxX + 0.01, z: bounds.minZ - 40 },
              { x: bounds.maxX + 0.01, z: bounds.maxZ + 40 },
            ],
            halfWidth: 0.5,
            feather: 0.2,
          },
        ],
      },
      {
        biome: 'woods',
        where: [
          {
            kind: 'area',
            polygon: box(bounds.maxX - 40, bounds.minZ - 40, 90, 90),
            feather: 12,
          },
        ],
        warp,
      },
      {
        biome: 'wheat',
        where: [{ kind: 'area', polygon: box(bounds.minX - 500, bounds.minZ - 500, 40, 40) }],
        warp,
      },
      {
        biome: 'rock',
        where: [{ kind: 'area', polygon: box(bounds.minX - 90, bounds.minZ - 90, 1000, 1000) }],
      },
    ]),
    scenario('polygons partly outside, enclosing and concave', [
      {
        biome: 'woods',
        where: [
          {
            kind: 'area',
            polygon: [
              { x: bounds.minX - 80, z: middle.z },
              { x: middle.x, z: bounds.minZ - 80 },
              { x: bounds.maxX + 80, z: middle.z },
              { x: middle.x, z: bounds.maxZ + 80 },
            ],
            feather: 25,
          },
        ],
        warp: { amplitude: 40, wavelength: 90 },
      },
      {
        biome: 'rock',
        where: [
          {
            kind: 'area',
            polygon: [
              { x: -80, z: -40 },
              { x: 100, z: -40 },
              { x: 100, z: 30 },
              { x: 0, z: 30 },
              { x: 0, z: 80 },
              { x: 100, z: 80 },
              { x: 100, z: 200 },
              { x: -80, z: 200 },
            ],
            feather: 10,
          },
        ],
      },
    ]),
    scenario('features smaller than one sample', [
      { biome: 'woods', where: [{ kind: 'area', polygon: box(10.1, 10.1, 0.4, 0.4) }] },
      { biome: 'woods', where: [{ kind: 'area', polygon: box(30.1, 10.1, 0.4, 0.4), feather: 3 }] },
      { biome: 'wheat', where: [{ kind: 'area', polygon: box(50, 30, 1, 1), feather: 8 }], warp },
      {
        biome: 'road',
        where: [
          {
            kind: 'line',
            line: [
              { x: 5.5, z: 5.5 },
              { x: 5.7, z: 5.6 },
            ],
            halfWidth: 1,
            feather: 1,
          },
        ],
      },
      {
        biome: 'road',
        where: [{ kind: 'line', line: [{ x: 70.2, z: 40.3 }], halfWidth: 2, feather: 1 }],
      },
      {
        biome: 'road',
        where: [
          {
            kind: 'line',
            line: [
              { x: 80, z: 60 },
              { x: 80, z: 60 },
            ],
            halfWidth: 3,
          },
        ],
        warp: { amplitude: 2, wavelength: 20 },
      },
      { biome: 'rock', where: [{ kind: 'area', polygon: [{ x: 12, z: 12 }], feather: 6 }] },
      {
        biome: 'rock',
        where: [
          {
            kind: 'area',
            polygon: [
              { x: 14, z: 14 },
              { x: 30, z: 18 },
            ],
            feather: 5,
          },
        ],
      },
      { biome: 'wheat', where: [{ kind: 'area', polygon: [] }] },
      { biome: 'wheat', where: [{ kind: 'line', line: [], halfWidth: 4 }] },
    ]),
    scenario(
      'edges landing exactly on samples',
      [
        // Sample columns sit at -100 + 7.3n; these shapes sit on whole numbers and the
        // grid below is on whole numbers too, so edges and cutoffs meet samples exactly.
        {
          biome: 'road',
          where: [
            {
              kind: 'line',
              line: [
                { x: 0, z: -100 },
                { x: 0, z: 400 },
              ],
              halfWidth: 20,
              feather: 20,
            },
          ],
        },
        { biome: 'woods', where: [{ kind: 'area', polygon: box(-40, -20, 80, 60), feather: 20 }] },
        { biome: 'wheat', where: [{ kind: 'area', polygon: box(100, 0, 40, 40) }] },
      ],
      {
        bounds: { minX: -100, minZ: -100, maxX: 200, maxZ: 200 },
        width: 31,
        height: 31,
      }
    ),
    scenario('several conditions in one paint', [
      {
        biome: 'woods',
        where: [
          { kind: 'area', polygon: box(-70, -30, 140, 100), feather: 14 },
          { kind: 'noise', wavelength: 40, threshold: -0.1, feather: 0.3 },
          { kind: 'height', min: 10, feather: 6 },
        ],
        warp,
      },
      {
        biome: 'road',
        where: [
          { kind: 'slope', max: 0.4, feather: 0.1 },
          {
            kind: 'line',
            line: [
              { x: -90, z: -40 },
              { x: 110, z: 130 },
            ],
            halfWidth: 8,
            feather: 6,
          },
          { kind: 'area', polygon: box(-50, -40, 200, 120), feather: 10 },
        ],
        warp: { amplitude: 12, wavelength: 50 },
      },
      {
        biome: 'wheat',
        strength: 0.6,
        where: [
          { kind: 'area', polygon: box(0, 0, 70, 70), feather: 5 },
          { kind: 'area', polygon: box(40, 40, 70, 70), feather: 5 },
        ],
      },
      { biome: 'rock', where: [{ kind: 'slope', min: 0.15, feather: 0.05 }] },
      { biome: 'rock', where: [{ kind: 'slope', min: 0.3 }] },
      { biome: 'woods', strength: 0, where: [{ kind: 'area', polygon: box(0, 0, 50, 50) }] },
      { biome: 'wheat', where: [] },
    ]),
    scenario('warps wider than the grid, negative and zero', [
      {
        biome: 'woods',
        where: [{ kind: 'area', polygon: box(0, 0, 60, 60), feather: 10 }],
        warp: { amplitude: 400, wavelength: 80 },
      },
      {
        biome: 'road',
        where: [
          {
            kind: 'line',
            line: [
              { x: -50, z: 20 },
              { x: 90, z: 100 },
            ],
            halfWidth: 4,
          },
        ],
        warp: { amplitude: -35, wavelength: 55 },
      },
      {
        biome: 'wheat',
        where: [{ kind: 'area', polygon: box(100, 50, 50, 50), feather: 4 }],
        warp: { amplitude: 0, wavelength: 30 },
      },
    ]),
    scenario(
      'a paint whose terrain reads are not finite',
      [
        {
          biome: 'woods',
          where: [
            { kind: 'height', min: 5 },
            { kind: 'area', polygon: box(0, 0, 80, 80) },
          ],
        },
      ],
      {
        terrain: {
          ...terrain,
          heights: Float32Array.from(terrain.heights, (h, i) => (i === 700 ? Number.NaN : h)),
        },
      }
    ),
    scenario('coordinates too large to bound', [
      {
        biome: 'woods',
        where: [
          {
            kind: 'area',
            polygon: [
              { x: -1e308, z: -1e308 },
              { x: 1e308, z: -1e308 },
              { x: 1e308, z: 1e308 },
              { x: -1e308, z: 1e308 },
            ],
          },
          { kind: 'area', polygon: box(0, 0, 50, 50), feather: 4 },
        ],
      },
    ]),
    scenario('parameters that poison a paint with NaN', [
      {
        biome: 'woods',
        strength: Number.NaN,
        where: [{ kind: 'area', polygon: box(0, 0, 50, 50) }],
      },
      {
        biome: 'rock',
        where: [
          { kind: 'height', min: Number.NaN },
          { kind: 'area', polygon: box(0, 0, 50, 50) },
        ],
      },
      {
        biome: 'rock',
        where: [
          { kind: 'slope', max: Number.NaN },
          {
            kind: 'line',
            line: [
              { x: 0, z: 0 },
              { x: 50, z: 50 },
            ],
            halfWidth: 3,
          },
        ],
      },
      {
        biome: 'wheat',
        where: [
          { kind: 'noise', wavelength: 30, threshold: Number.NaN },
          { kind: 'area', polygon: box(20, 20, 50, 50) },
        ],
      },
      {
        biome: 'road',
        where: [
          {
            kind: 'area',
            polygon: [
              { x: 0, z: 0 },
              { x: Number.NaN, z: 10 },
              { x: 40, z: 40 },
            ],
          },
          {
            kind: 'line',
            line: [
              { x: 0, z: 0 },
              { x: 50, z: 50 },
            ],
            halfWidth: 3,
          },
        ],
      },
      {
        biome: 'road',
        where: [
          {
            kind: 'line',
            line: [
              { x: 0, z: 0 },
              { x: Number.NaN, z: 50 },
            ],
            halfWidth: 3,
          },
          { kind: 'area', polygon: box(0, 0, 50, 50) },
        ],
      },
      {
        biome: 'woods',
        where: [{ kind: 'area', polygon: box(0, 0, 50, 50), feather: Number.POSITIVE_INFINITY }],
      },
      {
        biome: 'woods',
        where: [
          {
            kind: 'height',
            min: Number.NEGATIVE_INFINITY,
            max: Number.POSITIVE_INFINITY,
            feather: 2,
          },
          { kind: 'area', polygon: box(-60, 0, 50, 50), feather: 6 },
        ],
      },
    ]),
  ];
  for (let seed = 1; seed <= 40; seed += 1) {
    cases.push(scenario(`random paints ${seed}`, randomPaints(seed * 7919)));
  }
  return cases;
}
