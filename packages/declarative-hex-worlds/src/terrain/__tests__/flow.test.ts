import { describe, expect, it } from 'vitest';
import { composeHeightField } from '../compose';
import { createHeightField, fillHeightField, type HeightField } from '../field';
import { routeSurfaceFlow, type SurfaceFlow } from '../flow';

function fieldOf(
  width: number,
  height: number,
  fn: (column: number, row: number) => number,
  spacing: { x: number; z: number } = { x: 1, z: 1 }
): HeightField {
  const field = createHeightField({
    bounds: { minX: 0, minZ: 0, maxX: (width - 1) * spacing.x, maxZ: (height - 1) * spacing.z },
    width,
    height,
  });
  fillHeightField(field, (x, z) => fn(Math.round(x / spacing.x), Math.round(z / spacing.z)));
  return field;
}

/** The structural guarantees every routing must meet. */
function expectSoundFlow(field: HeightField, flow: SurfaceFlow, cellArea: number): void {
  const { width, height } = field;
  const count = width * height;
  const position = new Int32Array(count);
  flow.order.forEach((cell, p) => {
    position[cell] = p;
  });
  expect(new Set(flow.order).size).toBe(count);
  let outletArea = 0;
  for (let cell = 0; cell < count; cell += 1) {
    const column = cell % width;
    const row = (cell - column) / width;
    const edge = column === 0 || row === 0 || column === width - 1 || row === height - 1;
    const receiver = flow.receivers[cell] as number;
    expect(flow.filled[cell] as number).toBeGreaterThanOrEqual(field.heights[cell] as number);
    if (edge) {
      expect(receiver).toBe(-1);
      outletArea += flow.area[cell] as number;
      continue;
    }
    // A neighbour, downhill or level on the filled surface, earlier in the order.
    const dc = (receiver % width) - column;
    const dr = (receiver - (receiver % width)) / width - row;
    expect(Math.max(Math.abs(dc), Math.abs(dr))).toBe(1);
    expect(flow.filled[receiver] as number).toBeLessThanOrEqual(flow.filled[cell] as number);
    expect(position[receiver] as number).toBeLessThan(position[cell] as number);
  }
  expect(outletArea).toBeCloseTo(count * cellArea, 6);
}

/** Follows receivers from a sample to the field's edge. */
function flowPath(flow: SurfaceFlow, start: number): number[] {
  const path = [start];
  let cell = start;
  while ((flow.receivers[cell] as number) >= 0) {
    cell = flow.receivers[cell] as number;
    path.push(cell);
  }
  return path;
}

describe('routeSurfaceFlow', () => {
  it('routes composed relief soundly: depression-free, acyclic and area-conserving', () => {
    const field = composeHeightField({
      bounds: { minX: 0, minZ: 0, maxX: 600, maxZ: 400 },
      spacing: 10,
      seed: 'flow',
      base: 50,
      layers: [
        { kind: 'noise', amplitude: 8, wavelength: 220, octaves: 4 },
        { kind: 'hill', center: { x: 300, z: 200 }, radius: 150, height: 20 },
      ],
    });
    const flow = routeSurfaceFlow(field);
    expectSoundFlow(field, flow, 100);
    // Filling raised some pits, and no interior sample is left without a way down.
    let raised = 0;
    for (let i = 0; i < flow.filled.length; i += 1) {
      if ((flow.filled[i] as number) > (field.heights[i] as number)) raised += 1;
    }
    expect(raised).toBeGreaterThan(0);
  });

  it('follows the true downhill direction on a slope facing between grid directions', () => {
    // Downhill along (2, 1): 26.6° off the x axis, where plain D8 runs at 45°.
    const field = fieldOf(81, 81, (c, r) => 1000 - 2 * c - r);
    const flow = routeSurfaceFlow(field);
    expectSoundFlow(field, flow, 1);
    const path = flowPath(flow, 5 * 81 + 5);
    const first = path[0] as number;
    const last = path[path.length - 1] as number;
    const dx = (last % 81) - (first % 81);
    const dz = (last - (last % 81)) / 81 - (first - (first % 81)) / 81;
    // Sideways drift per unit travelled along the gradient stays tiny.
    const sideways = Math.abs(dx * 1 - dz * 2) / Math.sqrt(5);
    expect(sideways / Math.sqrt(dx * dx + dz * dz)).toBeLessThan(0.05);
    // It alternates between the two facet neighbours to get there.
    const steps = path.slice(1).map((cell, i) => cell - (path[i] as number));
    expect(new Set(steps)).toEqual(new Set([1, 82]));
  });

  it('sends flow straight along a grid axis or diagonal when the slope faces one', () => {
    const along = routeSurfaceFlow(fieldOf(9, 9, (c) => 100 - c));
    const diagonal = routeSurfaceFlow(fieldOf(9, 9, (c, r) => 100 - c - r));
    for (let row = 1; row < 8; row += 1) {
      for (let column = 1; column < 8; column += 1) {
        const cell = row * 9 + column;
        expect(along.receivers[cell]).toBe(cell + 1);
        expect(diagonal.receivers[cell]).toBe(cell + 10);
      }
    }
  });

  it('measures direction in world units when spacing differs along X and Z', () => {
    // World downhill direction (1, 1); samples twice as far apart along Z.
    const field = fieldOf(81, 41, (c, r) => 1000 - c - 2 * r, { x: 1, z: 2 });
    const flow = routeSurfaceFlow(field);
    expectSoundFlow(field, flow, 2);
    const path = flowPath(flow, 2 * 81 + 2);
    const last = path[path.length - 1] as number;
    const dx = (last % 81) - 2;
    const dz = ((last - (last % 81)) / 81 - 2) * 2;
    expect(Math.abs(dx - dz) / Math.sqrt(dx * dx + dz * dz)).toBeLessThan(0.1);
  });

  it('drains a filled basin along its middle to the spill point', () => {
    // A level-bottomed trough (rows 2–8) walled at height 10, spilling north
    // through a notch at column 10.
    const field = fieldOf(41, 11, (c, r) => {
      if (c === 10 && r === 0) return 4;
      if (c === 10 && r === 1) return 5;
      return r >= 2 && r <= 8 && c >= 2 && c <= 38 ? 0 : 10;
    });
    const flow = routeSurfaceFlow(field);
    expectSoundFlow(field, flow, 1);
    for (let r = 2; r <= 8; r += 1) {
      for (let c = 2; c <= 38; c += 1) expect(flow.filled[r * 41 + c]).toBe(5);
    }
    // Far from the notch, the flow gathers on the trough's middle row
    // instead of running parallel to the walls.
    for (const column of [20, 25, 30]) {
      let busiest = 2;
      for (let r = 3; r <= 8; r += 1) {
        if ((flow.area[r * 41 + column] as number) > (flow.area[busiest * 41 + column] as number)) {
          busiest = r;
        }
      }
      expect(busiest).toBe(5);
    }
    // Everything in the trough leaves through the notch.
    expect(flow.area[10]).toBeGreaterThan(7 * 37);
    expect(flowPath(flow, 5 * 41 + 36).at(-1)).toBe(10);
  });

  it('drains a level field to its nearest edges', () => {
    const field = fieldOf(12, 9, () => 3);
    const flow = routeSurfaceFlow(field);
    expectSoundFlow(field, flow, 1);
    expect(flowPath(flow, 1 * 12 + 1)).toHaveLength(2);
    expect(flowPath(flow, 4 * 12 + 6)).toHaveLength(5);
  });
});
