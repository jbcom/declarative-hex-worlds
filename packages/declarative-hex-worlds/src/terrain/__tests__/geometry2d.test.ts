import { describe, expect, it } from 'vitest';
import {
  boundsOfPoints,
  distanceToPolyline,
  distanceToSegment,
  polygonContains,
  signedDistanceToPolygon,
  smoothstep,
} from '../geometry2d';

const square = [
  { x: 0, z: 0 },
  { x: 10, z: 0 },
  { x: 10, z: 10 },
  { x: 0, z: 10 },
];

describe('distanceToSegment', () => {
  it('measures to the interior, both ends and a degenerate segment', () => {
    const a = { x: 0, z: 0 };
    const b = { x: 10, z: 0 };
    expect(distanceToSegment({ x: 5, z: 3 }, a, b)).toBe(3);
    expect(distanceToSegment({ x: -3, z: 4 }, a, b)).toBe(5);
    expect(distanceToSegment({ x: 13, z: 4 }, a, b)).toBe(5);
    expect(distanceToSegment({ x: 3, z: 4 }, a, a)).toBe(5);
  });
});

describe('distanceToPolyline', () => {
  it('treats empty lines as infinitely far and one-point lines as points', () => {
    expect(distanceToPolyline({ x: 0, z: 0 }, [])).toBe(Number.POSITIVE_INFINITY);
    expect(distanceToPolyline({ x: 3, z: 4 }, [{ x: 0, z: 0 }])).toBe(5);
  });

  it('returns the nearest segment distance', () => {
    const line = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 10 },
    ];
    expect(distanceToPolyline({ x: 12, z: 5 }, line)).toBe(2);
    expect(distanceToPolyline({ x: 4, z: -1 }, line)).toBe(1);
  });
});

describe('polygonContains and signedDistanceToPolygon', () => {
  it('distinguishes inside from outside', () => {
    expect(polygonContains(square, { x: 5, z: 5 })).toBe(true);
    expect(polygonContains(square, { x: 15, z: 5 })).toBe(false);
    expect(polygonContains(square, { x: -5, z: 5 })).toBe(false);
  });

  it('is negative inside and positive outside', () => {
    expect(signedDistanceToPolygon(square, { x: 5, z: 2 })).toBe(-2);
    expect(signedDistanceToPolygon(square, { x: 13, z: 5 })).toBe(3);
  });

  it('gives empty and degenerate polygons no inside', () => {
    expect(signedDistanceToPolygon([], { x: 0, z: 0 })).toBe(Number.POSITIVE_INFINITY);
    const segment = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
    ];
    expect(signedDistanceToPolygon(segment, { x: 5, z: 0 })).toBe(0);
    expect(signedDistanceToPolygon(segment, { x: 5, z: 2 })).toBe(2);
  });
});

describe('boundsOfPoints', () => {
  it('spans every point', () => {
    expect(
      boundsOfPoints([
        { x: 3, z: -1 },
        { x: -2, z: 4 },
        { x: 5, z: 2 },
        { x: 0, z: -3 },
      ])
    ).toEqual({ minX: -2, minZ: -3, maxX: 5, maxZ: 4 });
  });

  it('rejects an empty list', () => {
    expect(() => boundsOfPoints([])).toThrow(RangeError);
  });
});

describe('smoothstep', () => {
  it('clamps, interpolates and handles equal or reversed edges', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(2, 2, 1)).toBe(0);
    expect(smoothstep(2, 2, 3)).toBe(1);
    expect(smoothstep(1, 0, 0.25)).toBeCloseTo(1 - smoothstep(0, 1, 0.25));
  });
});
