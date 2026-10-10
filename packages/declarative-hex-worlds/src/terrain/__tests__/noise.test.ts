import { describe, expect, it } from 'vitest';
import { createNoise2D, fractalNoise, ridgedNoise } from '../noise';

function grid(fn: (x: number, z: number) => number): number[] {
  const values: number[] = [];
  for (let z = -8; z <= 8; z += 0.37) {
    for (let x = -8; x <= 8; x += 0.41) values.push(fn(x, z));
  }
  return values;
}

describe('createNoise2D', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = grid(createNoise2D('gettysburg'));
    expect(grid(createNoise2D('gettysburg'))).toEqual(a);
    expect(grid(createNoise2D(1863))).not.toEqual(a);
  });

  it('stays within [-1, 1], is zero on lattice corners and varies between them', () => {
    const noise = createNoise2D(7);
    const values = grid(noise);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(-1);
    expect(noise(0, 0)).toBe(0);
    expect(new Set(values.map((v) => v.toFixed(3))).size).toBeGreaterThan(100);
  });

  it('pins a known value so cross-platform drift is caught', () => {
    expect(createNoise2D('pin')(1.25, -3.5)).toMatchInlineSnapshot(`-0.6137710230799567`);
  });
});

describe('fractal noise', () => {
  const noise = createNoise2D('fractal');

  it('normalises fBm by total amplitude', () => {
    const values = grid((x, z) => fractalNoise(noise, x * 10, z * 10, { wavelength: 25 }));
    expect(Math.max(...values.map(Math.abs))).toBeLessThanOrEqual(1);
  });

  it('honours explicit octave settings and zero octaves', () => {
    const one = fractalNoise(noise, 3.3, 4.4, { wavelength: 1, octaves: 1 });
    expect(one).toBe(noise(3.3, 4.4));
    expect(fractalNoise(noise, 1, 1, { wavelength: 1, octaves: 0 })).toBe(0);
    const tuned = fractalNoise(noise, 3.3, 4.4, {
      wavelength: 1,
      octaves: 3,
      lacunarity: 3,
      gain: 0.25,
    });
    expect(tuned).not.toBe(fractalNoise(noise, 3.3, 4.4, { wavelength: 1, octaves: 3 }));
  });

  it('keeps ridged noise in [0, 1] with crests at zero crossings', () => {
    const values = grid((x, z) => ridgedNoise(noise, x * 10, z * 10, { wavelength: 30 }));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(ridgedNoise(noise, 0, 0, { wavelength: 1, octaves: 1 })).toBe(1);
    expect(values.some((v) => v < 0.5)).toBe(true);
  });
});
