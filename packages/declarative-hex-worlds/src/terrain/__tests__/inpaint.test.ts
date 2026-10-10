import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import {
  createHeightField,
  createHeightFieldWithSpacing,
  fillHeightField,
  type HeightField,
  heightFieldRange,
} from '../field';
import { type GroundPolygon, signedDistanceToPolygon } from '../geometry2d';
import { inpaintHeightField } from '../inpaint';

const bounds = { minX: -100, minZ: -100, maxX: 100, maxZ: 100 };

/** A tilted plane: harmonic, so in-painting must reproduce it. */
const plane = (x: number, z: number): number => 50 + 0.2 * x + 0.1 * z;

function planeField(): HeightField {
  const field = createHeightFieldWithSpacing(bounds, 5);
  fillHeightField(field, (x, z) => plane(x, z));
  return field;
}

function rectangle(minX: number, minZ: number, maxX: number, maxZ: number): GroundPolygon {
  return [
    { x: minX, z: minZ },
    { x: maxX, z: minZ },
    { x: maxX, z: maxZ },
    { x: minX, z: maxZ },
  ];
}

/** A roughly circular outline: octagon of the given radius around a centre. */
function octagon(cx: number, cz: number, radius: number): GroundPolygon {
  const k = radius * Math.SQRT1_2;
  return [
    { x: cx + radius, z: cz },
    { x: cx + k, z: cz + k },
    { x: cx, z: cz + radius },
    { x: cx - k, z: cz + k },
    { x: cx - radius, z: cz },
    { x: cx - k, z: cz - k },
    { x: cx, z: cz - radius },
    { x: cx + k, z: cz - k },
  ];
}

function maxDifference(a: HeightField, b: HeightField): number {
  let worst = 0;
  for (let i = 0; i < a.heights.length; i += 1) {
    worst = Math.max(worst, Math.abs((a.heights[i] as number) - (b.heights[i] as number)));
  }
  return worst;
}

describe('inpaintHeightField', () => {
  it('reproduces a planar ramp punched through by a polygon', () => {
    const truth = planeField();
    const damaged = planeField();
    const polygon = rectangle(-30, -20, 40, 30);
    fillHeightField(damaged, (x, z, h) =>
      signedDistanceToPolygon(polygon, { x, z }) <= 0 ? -999 : h
    );
    const healed = inpaintHeightField(damaged, polygon);
    expect(maxDifference(healed, truth)).toBeLessThan(1e-3);
    expect(healed.heights).not.toBe(damaged.heights);
  });

  it('keeps the tolerance honest on tighter requests', () => {
    const truth = planeField();
    const damaged = planeField();
    const polygon = octagon(0, 0, 45);
    fillHeightField(damaged, (x, z, h) =>
      signedDistanceToPolygon(polygon, { x, z }) <= 0 ? 0 : h
    );
    for (const tolerance of [1e-2, 1e-4]) {
      const healed = inpaintHeightField(damaged, polygon, { tolerance });
      // Float32 storage limits the floor at a few 1e-6.
      expect(maxDifference(healed, truth)).toBeLessThan(Math.max(tolerance, 2e-5));
    }
  });

  it('fills a pit back to the surrounding plane', () => {
    const truth = planeField();
    const pitted = planeField();
    const radius = 40;
    const polygon = octagon(10, -5, radius);
    fillHeightField(pitted, (x, z, h) => {
      const dx = x - 10;
      const dz = z + 5;
      const r2 = (dx * dx + dz * dz) / (radius * radius);
      return r2 < 1 ? h - 14 * (1 - r2) : h;
    });
    expect(maxDifference(pitted, truth)).toBeGreaterThan(10);
    const healed = inpaintHeightField(pitted, polygon, { feather: 6 });
    expect(maxDifference(healed, truth)).toBeLessThan(1e-3);
  });

  it('fills curved ground without inventing a pit or a bump', () => {
    const bowl = createHeightFieldWithSpacing(bounds, 5);
    fillHeightField(bowl, (x, z) => 20 + (x * x + z * z) / 400);
    const polygon = octagon(0, 0, 35);
    const healed = inpaintHeightField(bowl, polygon);
    // Maximum principle: the fill lies between its boundary ring's extremes.
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    const inside: number[] = [];
    healed.heights.forEach((value, i) => {
      const x = bounds.minX + (i % bowl.width) * 5;
      const z = bounds.minZ + Math.floor(i / bowl.width) * 5;
      const d = signedDistanceToPolygon(polygon, { x, z });
      if (d > 0 && d <= 5) {
        low = Math.min(low, value);
        high = Math.max(high, value);
      } else if (d <= 0) {
        inside.push(value);
      }
    });
    expect(inside.length).toBeGreaterThan(100);
    expect(Math.min(...inside)).toBeGreaterThanOrEqual(low - 1e-3);
    expect(Math.max(...inside)).toBeLessThanOrEqual(high + 1e-3);
  });

  it('copies samples beyond polygon and feather byte for byte', () => {
    const source = createHeightFieldWithSpacing(bounds, 5);
    fillHeightField(source, (x, z) => 30 + Math.sqrt(x * x + 2 * z * z) / 3);
    const polygon = rectangle(-25, -25, 25, 25);
    const feather = 12;
    const healed = inpaintHeightField(source, polygon, { feather });
    let replaced = 0;
    for (let row = 0; row < source.height; row += 1) {
      for (let column = 0; column < source.width; column += 1) {
        const i = row * source.width + column;
        const d = signedDistanceToPolygon(polygon, {
          x: bounds.minX + column * 5,
          z: bounds.minZ + row * 5,
        });
        if (d > feather) {
          expect(Object.is(healed.heights[i], source.heights[i])).toBe(true);
        } else if (healed.heights[i] !== source.heights[i]) {
          replaced += 1;
        }
      }
    }
    expect(replaced).toBeGreaterThan(50);
  });

  it('never mutates its input and shares no buffer with the result', () => {
    const source = planeField();
    source.heights[400] = 1234;
    const snapshot = Array.from(source.heights);
    const healed = inpaintHeightField(source, rectangle(-20, -20, 20, 20), { feather: 3 });
    expect(Array.from(source.heights)).toEqual(snapshot);
    expect(healed).not.toBe(source);
    expect(healed.heights).not.toBe(source.heights);
    expect(healed.bounds).toEqual(source.bounds);
    expect(healed.width).toBe(source.width);
    expect(healed.height).toBe(source.height);
  });

  it('is deterministic: two runs produce identical bytes', () => {
    const source = createHeightFieldWithSpacing(bounds, 5);
    fillHeightField(source, (x, z) => 40 + Math.sqrt(x * x + z * z) / 7 - (x > 0 ? 3 : 0));
    const polygon = octagon(-10, 15, 38);
    const a = inpaintHeightField(source, polygon, { feather: 4 });
    const b = inpaintHeightField(source, polygon, { feather: 4 });
    expect(Buffer.from(a.heights.buffer).equals(Buffer.from(b.heights.buffer))).toBe(true);
  });

  it('treats the field edge as a zero-slope boundary on every side', () => {
    const edges: readonly GroundPolygon[] = [
      rectangle(-150, -40, -80, 40), // left
      rectangle(80, -40, 150, 40), // right
      rectangle(-40, -150, 40, -80), // top (low Z)
      rectangle(-40, 80, 40, 150), // bottom (high Z)
    ];
    for (const polygon of edges) {
      const flat = createHeightFieldWithSpacing(bounds, 5);
      flat.heights.fill(7);
      const damaged = createHeightFieldWithSpacing(bounds, 5);
      damaged.heights.fill(7);
      fillHeightField(damaged, (x, z, h) =>
        signedDistanceToPolygon(polygon, { x, z }) <= 0 ? 500 : h
      );
      const healed = inpaintHeightField(damaged, polygon);
      expect(maxDifference(healed, flat)).toBeLessThan(1e-3);
    }
  });

  it('fills a corner region using the in-grid neighbours only', () => {
    const source = planeField();
    const healed = inpaintHeightField(source, rectangle(-150, -150, -60, -60));
    const range = heightFieldRange(source);
    const corner = healed.heights[0] as number;
    expect(corner).toBeGreaterThanOrEqual(range.min);
    expect(corner).toBeLessThanOrEqual(range.max);
  });

  it('keeps planes exact on grids with unequal spacing', () => {
    const field = createHeightField({
      bounds: { minX: 0, minZ: 0, maxX: 200, maxZ: 60 },
      width: 21,
      height: 13,
    });
    const tilt = (x: number, z: number) => 10 + 0.05 * x - 0.3 * z;
    fillHeightField(field, (x, z) => tilt(x, z));
    const truth = field.heights.slice();
    const polygon = rectangle(60, 15, 130, 45);
    fillHeightField(field, (x, z, h) => (signedDistanceToPolygon(polygon, { x, z }) <= 0 ? 0 : h));
    const healed = inpaintHeightField(field, polygon);
    for (let i = 0; i < truth.length; i += 1) {
      expect(Math.abs((healed.heights[i] as number) - (truth[i] as number))).toBeLessThan(1e-3);
    }
  });

  it('returns an unchanged copy when no sample falls inside the region', () => {
    const source = planeField();
    // Entirely off the field.
    const away = inpaintHeightField(source, rectangle(500, 500, 600, 600));
    expect(Array.from(away.heights)).toEqual(Array.from(source.heights));
    expect(away.heights).not.toBe(source.heights);
    // Between samples: lies within the field but catches none.
    const between = inpaintHeightField(source, rectangle(1, 1, 2, 2));
    expect(Array.from(between.heights)).toEqual(Array.from(source.heights));
    expect(between.heights).not.toBe(source.heights);
  });

  it('stops after maxIterations without converging', () => {
    const damaged = planeField();
    const polygon = rectangle(-60, -60, 60, 60);
    fillHeightField(damaged, (x, z, h) =>
      signedDistanceToPolygon(polygon, { x, z }) <= 0 ? 0 : h
    );
    const truth = planeField();
    const partial = inpaintHeightField(damaged, polygon, { maxIterations: 1 });
    const full = inpaintHeightField(damaged, polygon);
    expect(maxDifference(partial, truth)).toBeGreaterThan(1);
    expect(maxDifference(full, truth)).toBeLessThan(1e-3);
  });

  it('refuses a region that leaves no known sample', () => {
    const source = planeField();
    expect(() => inpaintHeightField(source, rectangle(-500, -500, 500, 500))).toThrow(
      /no known samples/
    );
  });

  it('rejects bad polygons and options', () => {
    const source = planeField();
    const square = rectangle(-10, -10, 10, 10);
    expect(() => inpaintHeightField(source, [])).toThrow(/at least three points/);
    expect(() =>
      inpaintHeightField(source, [
        { x: 0, z: 0 },
        { x: 1, z: 1 },
      ])
    ).toThrow(GameboardValidationError);
    expect(() =>
      inpaintHeightField(source, [
        { x: 0, z: 0 },
        { x: Number.NaN, z: 1 },
        { x: 4, z: 4 },
      ])
    ).toThrow(/finite/);
    for (const feather of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => inpaintHeightField(source, square, { feather })).toThrow(/feather/);
    }
    for (const tolerance of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => inpaintHeightField(source, square, { tolerance })).toThrow(/tolerance/);
    }
    for (const maxIterations of [0, -3, 1.5, Number.NaN]) {
      expect(() => inpaintHeightField(source, square, { maxIterations })).toThrow(/maxIterations/);
    }
  });
});
