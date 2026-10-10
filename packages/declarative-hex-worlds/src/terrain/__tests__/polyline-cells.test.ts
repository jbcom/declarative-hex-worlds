import { describe, expect, it } from 'vitest';
import { distanceToSegment, type GroundPoint, type GroundPolyline } from '../geometry2d';
import { createNoise2D } from '../noise';
import { createPolylineCells, nearestPolylineInCells } from '../polyline-cells';

const bounds = { minX: -500, minZ: -400, maxX: 700, maxZ: 600 };

/** Deterministic pseudo-random lines that wander in and out of the bounds. */
function lines(seed: string, count: number): GroundPolyline[] {
  const noise = createNoise2D(seed);
  return Array.from({ length: count }, (_, l) => {
    const points: GroundPoint[] = [];
    let x = -700 + noise(l, 0.5) * 300;
    let z = -600 + l * 140;
    for (let i = 0; i < 9; i += 1) {
      points.push({ x, z });
      x += 180 + noise(l + 0.3, i * 0.7) * 120;
      z += noise(l + 0.7, i * 0.9) * 160;
    }
    return points;
  });
}

function bruteForce(all: readonly GroundPolyline[], point: GroundPoint) {
  let distance = Number.POSITIVE_INFINITY;
  let line = -1;
  all.forEach((points, l) => {
    for (let i = 1; i < points.length; i += 1) {
      const d = distanceToSegment(point, points[i - 1] as GroundPoint, points[i] as GroundPoint);
      if (d < distance) {
        distance = d;
        line = l;
      }
    }
  });
  return { distance, line };
}

describe('createPolylineCells', () => {
  const all = lines('roads', 7);
  const reach = 24;
  const cells = createPolylineCells(all, { bounds, cellSize: 64, reach });

  it('finds the exact nearest segment for every point within reach', () => {
    const noise = createNoise2D('probe');
    let within = 0;
    for (let i = 0; i < 4000; i += 1) {
      const point = {
        x: bounds.minX + ((noise(i, 0.1) + 1) / 2) * (bounds.maxX - bounds.minX),
        z: bounds.minZ + ((noise(0.1, i) + 1) / 2) * (bounds.maxZ - bounds.minZ),
      };
      const expected = bruteForce(all, point);
      const found = nearestPolylineInCells(cells, point);
      if (expected.distance < reach) {
        within += 1;
        // Segments are stored as float32 (what a GPU reads): exact to ~1e-4 here.
        expect(found.distance).toBeCloseTo(expected.distance, 3);
        // The found line is a nearest one (two can tie after rounding).
        const foundLine = all[found.line] as GroundPolyline;
        expect(bruteForce([foundLine], point).distance).toBeCloseTo(expected.distance, 3);
      } else {
        expect(found.distance).toBeGreaterThanOrEqual(reach);
      }
    }
    // The probe must actually exercise the near case.
    expect(within).toBeGreaterThan(100);
  });

  it('also finds lines passing near points just inside the bounds', () => {
    // A line wholly outside, 10 units beyond the west edge.
    const outside: GroundPolyline = [
      { x: bounds.minX - 10, z: 0 },
      { x: bounds.minX - 10, z: 200 },
    ];
    const edge = createPolylineCells([outside], { bounds, cellSize: 64, reach });
    const found = nearestPolylineInCells(edge, { x: bounds.minX + 5, z: 100 });
    expect(found.distance).toBeCloseTo(15, 9);
    expect(found.line).toBe(0);
  });

  it('lays segments, owning lines and cell ranges out flat', () => {
    const segmentCount = all.reduce((n, l) => n + l.length - 1, 0);
    expect(cells.segments.length).toBe(segmentCount * 4);
    expect(cells.segmentLine.length).toBe(segmentCount);
    expect(cells.columns).toBe(Math.ceil((bounds.maxX - bounds.minX) / 64));
    expect(cells.rows).toBe(Math.ceil((bounds.maxZ - bounds.minZ) / 64));
    expect(cells.cellRanges.length).toBe(cells.columns * cells.rows * 2);
    let max = 0;
    for (let c = 0; c < cells.columns * cells.rows; c += 1) {
      const start = cells.cellRanges[c * 2] as number;
      const count = cells.cellRanges[c * 2 + 1] as number;
      expect(start + count).toBeLessThanOrEqual(cells.cellSegments.length);
      max = Math.max(max, count);
    }
    expect(cells.maxPerCell).toBe(max);
    expect(max).toBeGreaterThan(0);
  });

  it('treats a one-point line as a point', () => {
    const dot = createPolylineCells([[{ x: 10, z: 10 }]], { bounds, cellSize: 64, reach });
    expect(nearestPolylineInCells(dot, { x: 13, z: 14 }).distance).toBeCloseTo(5, 9);
  });

  it('rejects a non-positive cell size or reach', () => {
    expect(() => createPolylineCells(all, { bounds, cellSize: 0, reach })).toThrow(RangeError);
    expect(() => createPolylineCells(all, { bounds, cellSize: 64, reach: -1 })).toThrow(RangeError);
  });
});
