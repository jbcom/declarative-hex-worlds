import { describe, expect, it } from 'vitest';
import { type ColumnSpans, capsuleSpans, intersectSpans, type SpanGrid } from '../biome-support';
import {
  distanceToPolyline,
  type GroundPoint,
  polygonContains,
  signedDistanceToPolygon,
} from '../geometry2d';

const grid: SpanGrid = { minX: -20, minZ: 5, stepX: 3.7, stepZ: 2.9, width: 40, height: 50 };

function reaches(spans: ColumnSpans, column: number, row: number): boolean {
  return column >= (spans.first[row] as number) && column <= (spans.last[row] as number);
}

function samples(): { column: number; row: number; point: GroundPoint }[] {
  const all = [];
  for (let row = 0; row < grid.height; row += 1) {
    for (let column = 0; column < grid.width; column += 1) {
      all.push({
        column,
        row,
        point: { x: grid.minX + column * grid.stepX, z: grid.minZ + row * grid.stepZ },
      });
    }
  }
  return all;
}

describe('capsuleSpans', () => {
  const polyline: GroundPoint[] = [
    { x: -30, z: 20 },
    { x: 10, z: 60 },
    { x: 60, z: 40 },
    { x: 60, z: 40 },
    { x: 100, z: 100 },
  ];

  it('reaches every sample within the radius of an open polyline', () => {
    for (const radius of [0, 1, 5.5, 20]) {
      const spans = capsuleSpans(polyline, false, radius, grid) as ColumnSpans;
      for (const { column, row, point } of samples()) {
        if (distanceToPolyline(point, polyline) < radius) {
          expect(reaches(spans, column, row)).toBe(true);
        }
      }
    }
  });

  it('is much tighter than the polyline bounding box', () => {
    const spans = capsuleSpans(polyline, false, 4, grid) as ColumnSpans;
    let visited = 0;
    for (let row = 0; row < grid.height; row += 1) {
      visited += Math.max(0, (spans.last[row] as number) - (spans.first[row] as number) + 1);
    }
    expect(visited).toBeGreaterThan(0);
    expect(visited).toBeLessThan(grid.width * grid.height * 0.4);
  });

  it('reaches the whole interior of a closed polygon, and its feathered rim', () => {
    const polygon: GroundPoint[] = [
      { x: -10, z: 20 },
      { x: 50, z: 10 },
      { x: 40, z: 70 },
      { x: 10, z: 40 },
      { x: -15, z: 80 },
    ];
    const spans = capsuleSpans(polygon, true, 6, grid) as ColumnSpans;
    for (const { column, row, point } of samples()) {
      if (polygonContains(polygon, point) || signedDistanceToPolygon(polygon, point) < 6) {
        expect(reaches(spans, column, row)).toBe(true);
      }
    }
  });

  it('treats a lone point and a two-point polygon as shapes', () => {
    const lone = capsuleSpans([{ x: 0, z: 30 }], false, 5, grid) as ColumnSpans;
    const closedLone = capsuleSpans([{ x: 0, z: 30 }], true, 5, grid) as ColumnSpans;
    const pair = capsuleSpans(
      [
        { x: 0, z: 30 },
        { x: 20, z: 30 },
      ],
      true,
      3,
      grid
    ) as ColumnSpans;
    for (const { column, row, point } of samples()) {
      if (Math.hypot(point.x, point.z - 30) < 5) {
        expect(reaches(lone, column, row)).toBe(true);
        expect(reaches(closedLone, column, row)).toBe(true);
      }
      if (point.x >= 0 && point.x <= 20 && Math.abs(point.z - 30) < 3) {
        expect(reaches(pair, column, row)).toBe(true);
      }
    }
  });

  it('is empty for no points, and for shapes beyond the grid', () => {
    const none = capsuleSpans([], true, 10, grid) as ColumnSpans;
    const right = capsuleSpans(
      [
        { x: 1000, z: 0 },
        { x: 1000, z: 200 },
      ],
      false,
      10,
      grid
    ) as ColumnSpans;
    const above = capsuleSpans(
      [
        { x: 0, z: 1000 },
        { x: 50, z: 1000 },
      ],
      false,
      10,
      grid
    ) as ColumnSpans;
    for (const spans of [none, right, above]) {
      for (let row = 0; row < grid.height; row += 1) {
        expect(spans.first[row]).toBeGreaterThan(spans.last[row] as number);
      }
    }
  });

  it('cannot bound shapes that are not finite', () => {
    const at = (x: number, z: number): GroundPoint[] => [{ x, z }];
    expect(capsuleSpans(at(Number.NaN, 0), false, 1, grid)).toBeNull();
    expect(capsuleSpans(at(0, Number.POSITIVE_INFINITY), false, 1, grid)).toBeNull();
    expect(capsuleSpans(at(0, 0), false, Number.NaN, grid)).toBeNull();
    expect(capsuleSpans(at(0, 0), false, Number.POSITIVE_INFINITY, grid)).toBeNull();
    expect(capsuleSpans([...at(1e308, 0), ...at(1e308, 1)], false, 1, grid)).toBeNull();
  });
});

describe('intersectSpans', () => {
  it('keeps the columns both reach, row by row', () => {
    const a: ColumnSpans = { first: Int32Array.of(0, 5, 10), last: Int32Array.of(8, 9, 12) };
    const b: ColumnSpans = { first: Int32Array.of(4, 0, 11), last: Int32Array.of(20, 3, 20) };
    intersectSpans(a, b);
    expect(Array.from(a.first)).toEqual([4, 5, 11]);
    expect(Array.from(a.last)).toEqual([8, 3, 12]);
  });
});
