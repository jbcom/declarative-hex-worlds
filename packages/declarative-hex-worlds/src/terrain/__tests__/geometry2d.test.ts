import { describe, expect, it } from 'vitest';
import {
  boundsOfPoints,
  closestPointOnPolyline,
  createPolylineIndex,
  distanceToPolyline,
  distanceToSegment,
  polygonContains,
  polylineLength,
  signedDistanceToPolygon,
  simplifyPolyline,
  simplifyPolylineIndices,
  smoothPolyline,
  smoothPolylineValues,
  smoothstep,
  subdividePolyline,
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

describe('createPolylineIndex', () => {
  const line = [
    { x: 0, z: 0 },
    { x: 100, z: 0 },
    { x: 100, z: 100 },
  ];

  it('matches the brute-force distance within the cutoff and is infinite beyond it', () => {
    const index = createPolylineIndex(line, 20);
    for (const point of [
      { x: 50, z: 5 },
      { x: 104, z: 50 },
      { x: -3, z: -4 },
      { x: 99, z: 1 },
    ]) {
      expect(index.distanceWithin(point)).toBe(distanceToPolyline(point, line));
    }
    expect(index.distanceWithin({ x: 50, z: 30 })).toBe(Number.POSITIVE_INFINITY);
    expect(index.distanceWithin({ x: 5000, z: 5000 })).toBe(Number.POSITIVE_INFINITY);
  });

  it('indexes a long thin diagonal cheaply and exactly', () => {
    const diagonal = [
      { x: 0, z: 0 },
      { x: 2000, z: 2000 },
    ];
    const started = performance.now();
    const index = createPolylineIndex(diagonal, 1);
    expect(performance.now() - started).toBeLessThan(2000);
    for (const point of [
      { x: 1000.5, z: 1000 },
      { x: 3, z: 3.5 },
      { x: 1999, z: 1999.9 },
      { x: 500, z: 503 },
    ]) {
      const brute = distanceToPolyline(point, diagonal);
      expect(index.distanceWithin(point)).toBe(brute < 1 ? brute : Number.POSITIVE_INFINITY);
    }
  });

  it('includes the closing edge only when asked', () => {
    const closingPoint = { x: 50, z: 52 };
    expect(createPolylineIndex(line, 10).distanceWithin(closingPoint)).toBe(
      Number.POSITIVE_INFINITY
    );
    expect(
      createPolylineIndex(line, 10, { closed: true }).distanceWithin(closingPoint)
    ).toBeLessThan(10);
  });

  it('handles single points, empty lines and a zero cutoff', () => {
    expect(createPolylineIndex([{ x: 0, z: 0 }], 10).distanceWithin({ x: 3, z: 4 })).toBe(5);
    expect(createPolylineIndex([], 10).distanceWithin({ x: 0, z: 0 })).toBe(
      Number.POSITIVE_INFINITY
    );
    expect(createPolylineIndex(line, 0).distanceWithin({ x: 0, z: 0 })).toBe(
      Number.POSITIVE_INFINITY
    );
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

describe('polyline length and closest point', () => {
  it('measures polylines', () => {
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([{ x: 1, z: 1 }])).toBe(0);
    expect(
      polylineLength([
        { x: 0, z: 0 },
        { x: 3, z: 4 },
        { x: 3, z: 10 },
      ])
    ).toBe(11);
  });

  it('finds the nearest point, clamping to segment ends and skipping degenerate segments', () => {
    const line = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 10 },
    ];
    expect(closestPointOnPolyline({ x: 4, z: 3 }, line)).toEqual({ x: 4, z: 0 });
    expect(closestPointOnPolyline({ x: -5, z: -1 }, line)).toEqual({ x: 0, z: 0 });
    expect(closestPointOnPolyline({ x: 13, z: 12 }, line)).toEqual({ x: 10, z: 10 });
    expect(closestPointOnPolyline({ x: 12, z: 4 }, line)).toEqual({ x: 10, z: 4 });
    expect(closestPointOnPolyline({ x: 2, z: 2 }, [{ x: 1, z: 1 }])).toEqual({ x: 1, z: 1 });
    expect(() => closestPointOnPolyline({ x: 0, z: 0 }, [])).toThrow(RangeError);
  });

  it('returns a segment end exactly when the projection clamps to it', () => {
    const b = { x: 0.1 + 0.2, z: 0.7 };
    const nearest = closestPointOnPolyline({ x: 5, z: 5 }, [{ x: -3.3, z: -1.1 }, b]);
    expect(nearest).toEqual(b);
    expect(nearest).not.toBe(b);
  });
});

describe('polyline simplification and smoothing', () => {
  const zigzag = Array.from({ length: 11 }, (_, i) => ({ x: i * 10, z: i % 2 === 0 ? 0 : 1 }));

  it('keeps endpoints and drops vertices within the tolerance', () => {
    expect(simplifyPolylineIndices([], 1)).toEqual([]);
    expect(simplifyPolylineIndices([{ x: 0, z: 0 }], 1)).toEqual([0]);
    expect(simplifyPolylineIndices(zigzag, 2)).toEqual([0, 10]);
    expect(simplifyPolylineIndices(zigzag, 0.5)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const collinear = [
      { x: 0, z: 0 },
      { x: 1, z: 1 },
      { x: 2, z: 2 },
      { x: 2, z: 5 },
    ];
    expect(simplifyPolylineIndices(collinear, 0)).toEqual([0, 2, 3]);
    expect(simplifyPolyline(collinear, 0)).toEqual([collinear[0], collinear[2], collinear[3]]);
  });

  it('keeps every dropped vertex within the tolerance of the result', () => {
    const wiggle = Array.from({ length: 60 }, (_, i) => ({
      x: i * 5,
      z: 30 * Math.sin(i / 6) + ((i * 7) % 5),
    }));
    for (const tolerance of [0.5, 2, 8]) {
      const simplified = simplifyPolyline(wiggle, tolerance);
      expect(simplified[0]).toBe(wiggle[0]);
      expect(simplified[simplified.length - 1]).toBe(wiggle[59]);
      for (const point of wiggle) {
        expect(distanceToPolyline(point, simplified)).toBeLessThanOrEqual(tolerance + 1e-9);
      }
    }
  });

  it('cuts corners with fixed endpoints, matching values to points', () => {
    const corner = [
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 4 },
    ];
    expect(smoothPolyline(corner, 0)).toEqual(corner);
    expect(smoothPolyline(corner, 1)).toEqual([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 3, z: 0 },
      { x: 4, z: 1 },
      { x: 4, z: 3 },
      { x: 4, z: 4 },
    ]);
    const twice = smoothPolyline(corner, 2);
    expect(twice).toHaveLength(12);
    expect(twice[0]).toEqual(corner[0]);
    expect(twice[11]).toEqual(corner[2]);
    expect(smoothPolylineValues([0, 4, 8], 2)).toEqual(twice.map((p) => p.x + p.z));
    expect(
      smoothPolyline(
        [
          { x: 0, z: 0 },
          { x: 1, z: 1 },
        ],
        3
      )
    ).toHaveLength(2);
    expect(smoothPolylineValues([], 2)).toEqual([]);
  });
});

describe('subdividePolyline', () => {
  it('splits long segments into equal pieces, carrying values along', () => {
    const line = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 3 },
    ];
    expect(subdividePolyline(line, 4)).toEqual({
      points: [
        { x: 0, z: 0 },
        { x: 10 * (1 / 3), z: 0 },
        { x: 10 * (2 / 3), z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 3 },
      ],
      values: [],
    });
    expect(subdividePolyline(line, 5, [0, 10, 40]).values).toEqual([0, 5, 10, 40]);
    expect(subdividePolyline([], 1)).toEqual({ points: [], values: [] });
    expect(subdividePolyline([{ x: 1, z: 2 }], 1, [7])).toEqual({
      points: [{ x: 1, z: 2 }],
      values: [7],
    });
  });

  it('keeps smoothing local: the curve stays near a subdivided corner', () => {
    const corner = [
      { x: 0, z: 0 },
      { x: 100, z: 0 },
      { x: 100, z: 100 },
    ];
    const loose = smoothPolyline(corner, 3);
    const tight = smoothPolyline(subdividePolyline(corner, 10).points, 3);
    const gap = (line: readonly { x: number; z: number }[]) =>
      Math.min(...line.map((p) => Math.hypot(p.x - 100, p.z)));
    expect(gap(loose)).toBeGreaterThan(15);
    expect(gap(tight)).toBeLessThan(2.5);
  });
});
