import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import { composeHeightField } from '../compose';
import { traceDrainage } from '../drainage';
import { erodeHeightField } from '../erosion';
import { createHeightField, fillHeightField, type HeightField, sampleHeight } from '../field';

/** Rolling country of the kind noise and hills compose: full of closed hollows. */
const rolling = composeHeightField({
  bounds: { minX: 0, minZ: 0, maxX: 2000, maxZ: 2000 },
  spacing: 10,
  seed: 'erosion',
  base: 100,
  layers: [
    { kind: 'noise', amplitude: 9, wavelength: 600, octaves: 3 },
    { kind: 'hill', center: { x: 700, z: 900 }, height: 30, radius: 350 },
    { kind: 'hill', center: { x: 1300, z: 1100 }, height: 25, radius: 300 },
  ],
});

/** Share of samples standing in water deeper than `depth` once hollows are filled. */
function pondedShare(field: HeightField, depth: number): number {
  const { filled } = traceDrainage(field, { minContributingArea: 1e9 });
  let ponded = 0;
  for (let i = 0; i < field.heights.length; i += 1) {
    if ((filled[i] as number) - (field.heights[i] as number) > depth) ponded += 1;
  }
  return ponded / field.heights.length;
}

/**
 * A hollow on ground falling west: its floor (12) stands above the west
 * edge (10), so the water has somewhere to go once its west rim (14) is
 * cut. A hollow whose floor lies below every edge can never drain.
 */
function bowl(): HeightField {
  const field = createHeightField({
    bounds: { minX: 0, minZ: 0, maxX: 40, maxZ: 40 },
    width: 41,
    height: 41,
  });
  fillHeightField(field, (x, z) => {
    const r = Math.hypot(x - 20, z - 20);
    return 10 + 0.5 * x - 8 * Math.max(0, 1 - r / 12);
  });
  return field;
}

describe('erodeHeightField', () => {
  it('drains the hollows a composed relief leaves', () => {
    // Measured: 14.4% ponded before, 3.3% after. What stays lies below every
    // edge, where no cut can reach base level.
    const before = pondedShare(rolling, 0.5);
    const eroded = erodeHeightField(rolling, { erodibility: 0.05, iterations: 20 });
    const after = pondedShare(eroded, 0.5);
    expect(before).toBeGreaterThan(0.1);
    expect(after).toBeLessThan(before / 3);
  });

  it('cuts valleys where water gathers and leaves the summits standing', () => {
    const eroded = erodeHeightField(rolling, { erodibility: 0.05, iterations: 20 });
    const cutAt = (x: number, z: number) =>
      sampleHeight(rolling, x, z) - sampleHeight(eroded, x, z);
    let deepest = 0;
    for (let i = 0; i < rolling.heights.length; i += 1) {
      deepest = Math.max(deepest, (rolling.heights[i] as number) - (eroded.heights[i] as number));
    }
    expect(deepest).toBeGreaterThan(8);
    // The two hilltops, which water only leaves, wear far less than the valleys cut.
    expect(cutAt(700, 900)).toBeLessThan(deepest / 5);
    expect(cutAt(1300, 1100)).toBeLessThan(deepest / 5);
  });

  it('only lowers the ground, never below where its water goes, and holds the edges', () => {
    const eroded = erodeHeightField(rolling, { erodibility: 0.05, iterations: 10 });
    const { width, height } = rolling;
    for (let i = 0; i < rolling.heights.length; i += 1) {
      expect(eroded.heights[i]).toBeLessThanOrEqual(rolling.heights[i] as number);
      const column = i % width;
      const row = Math.floor(i / width);
      if (column === 0 || row === 0 || column === width - 1 || row === height - 1) {
        expect(eroded.heights[i]).toBe(rolling.heights[i]);
      }
    }
    expect(rolling.heights).not.toBe(eroded.heights);
  });

  it('empties a bowl through its lowest rim', () => {
    const field = bowl();
    expect(pondedShare(field, 0.5)).toBeGreaterThan(0.03);
    const eroded = erodeHeightField(field, { erodibility: 0.5, iterations: 40 });
    expect(pondedShare(eroded, 0.5)).toBe(0);
  });

  it('cuts ground running into a pond down to its surface, never to its floor', () => {
    // Ground falling west at 0.2 with a steep-walled pit 6 deep at x = 20.
    // The ground east of the pit drains into it; whatever erosion does to
    // the pit's west rim, that ground never cuts below the pond's surface,
    // which a single step cannot lower below the rim's starting height.
    const field = createHeightField({
      bounds: { minX: 0, minZ: 0, maxX: 40, maxZ: 40 },
      width: 41,
      height: 41,
    });
    fillHeightField(field, (x, z) => {
      const pit = Math.hypot(x - 20, z - 20) <= 4 ? 6 : 0;
      return 10 + 0.2 * x - pit;
    });
    const { filled } = traceDrainage(field, { minContributingArea: 1e9 });
    const surface = filled[20 * 41 + 20] as number;
    const eroded = erodeHeightField(field, { erodibility: 50, iterations: 1 });
    // Directly east of the pit (rows away from it drain west around it, and
    // a step this strong rightly wears them to the west edge).
    for (let row = 19; row <= 21; row += 1) {
      for (let column = 25; column <= 30; column += 1) {
        expect(eroded.heights[row * 41 + column]).toBeGreaterThanOrEqual(surface - 1e-4);
      }
    }
  });

  it('rounds cuts with soil creep', () => {
    const sharp = erodeHeightField(rolling, { erodibility: 0.05, iterations: 10 });
    const round = erodeHeightField(rolling, { erodibility: 0.05, iterations: 10, diffusion: 0.2 });
    const roughness = (field: HeightField) => {
      let sum = 0;
      const { width, height, heights } = field;
      for (let row = 1; row < height - 1; row += 1) {
        for (let column = 1; column < width - 1; column += 1) {
          const i = row * width + column;
          const l =
            (heights[i - 1] as number) +
            (heights[i + 1] as number) +
            (heights[i - width] as number) +
            (heights[i + width] as number) -
            4 * (heights[i] as number);
          sum += Math.abs(l);
        }
      }
      return sum;
    };
    expect(roughness(round)).toBeLessThan(roughness(sharp) * 0.8);
  });

  it('is identical for identical input and a no-op without steps or erodibility', () => {
    const a = erodeHeightField(rolling, { erodibility: 0.02, iterations: 5, diffusion: 0.1 });
    const b = erodeHeightField(rolling, { erodibility: 0.02, iterations: 5, diffusion: 0.1 });
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights));
    expect(
      Array.from(erodeHeightField(rolling, { erodibility: 0.02, iterations: 0 }).heights)
    ).toEqual(Array.from(rolling.heights));
    expect(Array.from(erodeHeightField(rolling, { erodibility: 0 }).heights)).toEqual(
      Array.from(rolling.heights)
    );
  });

  it('rejects bad options and grids', () => {
    const bad = [
      { erodibility: -1 },
      { erodibility: Number.NaN },
      { erodibility: 0.1, iterations: 1.5 },
      { erodibility: 0.1, iterations: -1 },
      { erodibility: 0.1, areaExponent: 3 },
      { erodibility: 0.1, diffusion: 0.3 },
    ];
    for (const options of bad) {
      expect(() => erodeHeightField(rolling, options)).toThrow(GameboardValidationError);
    }
    expect(() =>
      erodeHeightField({ ...rolling, heights: new Float32Array(3) }, { erodibility: 0.1 })
    ).toThrow(GameboardValidationError);
  });
});
