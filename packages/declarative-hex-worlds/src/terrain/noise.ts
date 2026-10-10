/**
 * `src/terrain/noise.ts` — seeded 2D simplex noise and fractal sums.
 *
 * The permutation table is shuffled by `seedrandom`, and evaluation uses only
 * arithmetic and comparisons (no `Math.sin`/`Math.pow`), so a seed produces
 * byte-identical noise in every engine.
 *
 * @module
 */
import seedrandom from 'seedrandom';

/** A seeded 2D noise function returning values in roughly [-1, 1]. */
export type Noise2D = (x: number, z: number) => number;

/** Fractal (fBm) parameters. Wavelength is in world units. */
export interface FractalNoiseOptions {
  /** World-unit length of the first octave's features. */
  readonly wavelength: number;
  /** Octave count (default 4). */
  readonly octaves?: number;
  /** Frequency multiplier per octave (default 2). */
  readonly lacunarity?: number;
  /** Amplitude multiplier per octave (default 0.5). */
  readonly gain?: number;
}

const F2 = 0.36602540378443865; // (sqrt(3) - 1) / 2
const G2 = 0.21132486540518713; // (3 - sqrt(3)) / 6
const GRADIENTS: readonly (readonly [number, number])[] = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Creates seeded 2D simplex noise (Gustavson's formulation). */
export function createNoise2D(seed: string | number): Noise2D {
  const rng = seedrandom(`declarative-hex-worlds:noise:${String(seed)}`);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) base[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = base[i] as number;
    base[i] = base[j] as number;
    base[j] = swap;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i += 1) perm[i] = base[i & 255] as number;

  const corner = (gi: number, dx: number, dz: number): number => {
    const t = 0.5 - dx * dx - dz * dz;
    if (t <= 0) return 0;
    const g = GRADIENTS[gi & 7] as readonly [number, number];
    const t2 = t * t;
    return t2 * t2 * (g[0] * dx + g[1] * dz);
  };

  return (x, z) => {
    const s = (x + z) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(z + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const z0 = z - (j - t);
    const i1 = x0 > z0 ? 1 : 0;
    const j1 = x0 > z0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const z1 = z0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const z2 = z0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const g0 = perm[ii + (perm[jj] as number)] as number;
    const g1 = perm[ii + i1 + (perm[jj + j1] as number)] as number;
    const g2 = perm[ii + 1 + (perm[jj + 1] as number)] as number;
    return 70 * (corner(g0, x0, z0) + corner(g1, x1, z1) + corner(g2, x2, z2));
  };
}

function fractal(
  noise: Noise2D,
  x: number,
  z: number,
  options: FractalNoiseOptions,
  shape: (value: number) => number
): number {
  const octaves = options.octaves ?? 4;
  const lacunarity = options.lacunarity ?? 2;
  const gain = options.gain ?? 0.5;
  let frequency = 1 / options.wavelength;
  let amplitude = 1;
  let sum = 0;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    // Offset each octave so their lattices never align.
    sum += amplitude * shape(noise(x * frequency + octave * 31.7, z * frequency - octave * 17.3));
    norm += amplitude;
    frequency *= lacunarity;
    amplitude *= gain;
  }
  return norm === 0 ? 0 : sum / norm;
}

/** Fractal Brownian motion in roughly [-1, 1]. */
export function fractalNoise(
  noise: Noise2D,
  x: number,
  z: number,
  options: FractalNoiseOptions
): number {
  return fractal(noise, x, z, options, (value) => value);
}

/** Ridged fractal noise in [0, 1]: sharp crests where the base noise crosses zero. */
export function ridgedNoise(
  noise: Noise2D,
  x: number,
  z: number,
  options: FractalNoiseOptions
): number {
  return fractal(noise, x, z, options, (value) => {
    const ridge = 1 - (value < 0 ? -value : value);
    return ridge * ridge;
  });
}
