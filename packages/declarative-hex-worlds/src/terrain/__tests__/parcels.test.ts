import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import { polygonContains } from '../geometry2d';
import { generateParcels, type Parcel, parcelBoundaries } from '../parcels';

const bounds = { minX: 0, minZ: 0, maxX: 1000, maxZ: 600 };

function totalArea(parcels: readonly Parcel[]): number {
  return parcels.reduce((sum, p) => sum + p.area, 0);
}

describe('generateParcels', () => {
  it('tiles the area exactly with parcels near the mean size', () => {
    const parcels = generateParcels({ area: bounds, seed: 'farms', meanArea: 20_000 });
    expect(totalArea(parcels)).toBeCloseTo(600_000, 3);
    expect(parcels.length).toBeGreaterThan(18);
    expect(parcels.length).toBeLessThan(80);
    for (const parcel of parcels) {
      expect(parcel.polygon.length).toBeGreaterThanOrEqual(3);
      expect(polygonContains(parcel.polygon, parcel.centroid)).toBe(true);
      expect(parcel.variant).toBeGreaterThanOrEqual(0);
      expect(parcel.variant).toBeLessThan(1);
    }
  });

  it('is deterministic per seed', () => {
    const a = generateParcels({ area: bounds, seed: 7, meanArea: 30_000 });
    expect(generateParcels({ area: bounds, seed: 7, meanArea: 30_000 })).toEqual(a);
    expect(generateParcels({ area: bounds, seed: 8, meanArea: 30_000 })).not.toEqual(a);
  });

  it('divides a convex polygon, and respects variation, skew and minimum width', () => {
    const triangle = [
      { x: 0, z: 0 },
      { x: 800, z: 0 },
      { x: 0, z: 800 },
    ];
    const parcels = generateParcels({
      area: triangle,
      seed: 'tri',
      meanArea: 15_000,
      sizeVariation: 0,
      skew: 0,
    });
    expect(totalArea(parcels)).toBeCloseTo(320_000, 3);
    const coarse = generateParcels({ area: bounds, seed: 1, meanArea: 1000, minWidth: 200 });
    expect(coarse.length).toBeLessThan(20);
    const extreme = generateParcels({
      area: bounds,
      seed: 1,
      meanArea: 50_000,
      sizeVariation: 9,
      skew: -3,
    });
    expect(totalArea(extreme)).toBeCloseTo(600_000, 3);
  });

  it('cuts along the long axis when that brings parcels nearer the preferred aspect', () => {
    const parcels = generateParcels({
      area: { minX: 0, minZ: 0, maxX: 1200, maxZ: 1000 },
      seed: 'strips',
      meanArea: 150_000,
      sizeVariation: 0,
      skew: 0,
      aspect: 3,
    });
    const elongation = (p: Parcel): number => {
      const xs = p.polygon.map((q) => q.x);
      const zs = p.polygon.map((q) => q.z);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...zs) - Math.min(...zs);
      return Math.max(w / h, h / w);
    };
    expect(Math.max(...parcels.map(elongation))).toBeGreaterThan(2);
    expect(totalArea(parcels)).toBeCloseTo(1_200_000, 3);
  });

  it('tolerates a repeated vertex in the input outline', () => {
    const doubled = [
      { x: 0, z: 0 },
      { x: 500, z: 0 },
      { x: 500, z: 0 },
      { x: 500, z: 400 },
      { x: 0, z: 400 },
    ];
    const parcels = generateParcels({ area: doubled, seed: 2, meanArea: 20_000 });
    expect(totalArea(parcels)).toBeCloseTo(200_000, 3);
  });

  it('divides even thin slivers into proper polygons', () => {
    const sliver = [
      { x: 0, z: 0 },
      { x: 1000, z: 0 },
      { x: 1000, z: 1 },
    ];
    const parcels = generateParcels({ area: sliver, seed: 1, meanArea: 10, minWidth: 0 });
    expect(totalArea(parcels)).toBeCloseTo(500, 6);
    expect(parcels.length).toBeGreaterThan(10);
    expect(parcels.every((p) => p.polygon.length >= 3 && p.area > 0)).toBe(true);
  });

  it('rejects bad areas and sizes', () => {
    expect(() => generateParcels({ area: bounds, seed: 1, meanArea: 0 })).toThrow(
      GameboardValidationError
    );
    expect(() => generateParcels({ area: { ...bounds, maxX: 0 }, seed: 1, meanArea: 10 })).toThrow(
      GameboardValidationError
    );
    expect(() =>
      generateParcels({
        area: [
          { x: 0, z: 0 },
          { x: 1, z: 1 },
        ],
        seed: 1,
        meanArea: 10,
      })
    ).toThrow(GameboardValidationError);
    expect(() => generateParcels({ area: bounds, seed: 1, meanArea: 0.0001 })).toThrow(
      GameboardValidationError
    );
    expect(() => generateParcels({ area: bounds, seed: 1, meanArea: 100, aspect: 0.5 })).toThrow(
      GameboardValidationError
    );
    for (const minWidth of [-1, Number.NaN]) {
      expect(() => generateParcels({ area: bounds, seed: 1, meanArea: 100, minWidth })).toThrow(
        GameboardValidationError
      );
    }
  });
});

describe('parcelBoundaries', () => {
  it('lists every shared edge once, split at T-junctions', () => {
    const parcels = generateParcels({ area: bounds, seed: 'net', meanArea: 25_000 });
    const net = parcelBoundaries(parcels);
    const keys = net.edges.map(([a, b]) => `${a},${b}`);
    expect(new Set(keys).size).toBe(keys.length);
    // Interior edges separate two parcels; outer edges belong to one.
    const interior = net.edgeParcels.filter((p) => p.length === 2).length;
    const outer = net.edgeParcels.filter((p) => p.length === 1).length;
    expect(interior).toBeGreaterThan(0);
    expect(outer).toBeGreaterThan(3);
    expect(net.edgeParcels.every((p) => p.length === 1 || p.length === 2)).toBe(true);
    // The outer edges trace the bounds' perimeter exactly.
    let perimeter = 0;
    net.edges.forEach(([a, b], i) => {
      if ((net.edgeParcels[i] as number[]).length !== 1) return;
      const p = net.vertices[a] as { x: number; z: number };
      const q = net.vertices[b] as { x: number; z: number };
      perimeter += Math.hypot(q.x - p.x, q.z - p.z);
    });
    expect(perimeter).toBeCloseTo(3200, 3);
  });

  it('merges nearly coincident vertices within the tolerance and skips degenerate edges', () => {
    const squareA: Parcel = {
      polygon: [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 10 },
        { x: 10, z: 10 },
        { x: 0, z: 10 },
      ],
      area: 100,
      centroid: { x: 5, z: 5 },
      variant: 0,
    };
    const squareB: Parcel = {
      polygon: [
        { x: 10.0000001, z: 0 },
        { x: 20, z: 0 },
        { x: 20, z: 10 },
        { x: 10, z: 10 },
      ],
      area: 100,
      centroid: { x: 15, z: 5 },
      variant: 0.5,
    };
    const net = parcelBoundaries([squareA, squareB], 1e-3);
    expect(net.vertices).toHaveLength(6);
    expect(net.edgeParcels.filter((p) => p.length === 2)).toHaveLength(1);
    const zeroTolerance = parcelBoundaries([squareA], 0);
    expect(zeroTolerance.edges).toHaveLength(4);
    const hairline: Parcel = {
      ...squareA,
      polygon: [
        { x: 0, z: 0 },
        { x: 1e-10, z: 0 },
        { x: 10, z: 0 },
        { x: 0, z: 10 },
      ],
    };
    expect(parcelBoundaries([hairline], 0).vertices).toHaveLength(4);
  });

  it('keeps distinct vertices that share a bucket distinct, and finds each again', () => {
    // Two corners 0.6 tolerance-cells apart on one axis but 1.5 tolerances apart overall.
    const a: Parcel = {
      polygon: [
        { x: 0, z: 0 },
        { x: 1.5, z: 0.2 },
        { x: 1.5, z: 5 },
      ],
      area: 3.75,
      centroid: { x: 1, z: 1.7 },
      variant: 0,
    };
    const b: Parcel = {
      polygon: [
        { x: 0, z: 0 },
        { x: 1.5, z: 5 },
        { x: 0, z: 5 },
      ],
      area: 3.75,
      centroid: { x: 0.5, z: 3.3 },
      variant: 0,
    };
    const net = parcelBoundaries([a, b], 1);
    // (0,0) and (1.5,0.2) share a bucket yet stay distinct; the shared corners merge.
    expect(net.vertices).toEqual([
      { x: 0, z: 0 },
      { x: 1.5, z: 0.2 },
      { x: 1.5, z: 5 },
      { x: 0, z: 5 },
    ]);
  });

  it('lists a parcel once on an edge its degenerate ring visits twice', () => {
    const folded: Parcel = {
      polygon: [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 0, z: 0 },
        { x: 0, z: 10 },
      ],
      area: 0,
      centroid: { x: 0, z: 0 },
      variant: 0,
    };
    const net = parcelBoundaries([folded]);
    expect(net.edgeParcels.every((p) => p.length === 1)).toBe(true);
  });
});
