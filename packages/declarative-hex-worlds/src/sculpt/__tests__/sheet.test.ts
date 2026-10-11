import { Triangle, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import { rope, sheet } from '../sheet';

type Point = readonly [number, number, number];

/** The outward normal of every triangle of an indexed geometry, from its winding. */
function faceNormals(geometry: BufferGeometry): Vector3[] {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  if (!index) {
    throw new Error('sheet geometry is indexed');
  }
  const normals: Vector3[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const triangle = new Triangle(
      new Vector3().fromBufferAttribute(position, index.getX(i)),
      new Vector3().fromBufferAttribute(position, index.getX(i + 1)),
      new Vector3().fromBufferAttribute(position, index.getX(i + 2))
    );
    normals.push(triangle.getNormal(new Vector3()));
  }
  return normals;
}

/** A ground sheet: columns step +x, rows step +z. */
function ground(rows: number, cols: number): Point[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c): Point => [c, 0, r])
  );
}

describe('sheet', () => {
  it('keeps every grid point as a vertex, rows in order', () => {
    const rows = ground(3, 4);
    const geometry = sheet(rows);
    const position = geometry.getAttribute('position');
    expect(position.count).toBe(12);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const i = r * 4 + c;
        expect([position.getX(i), position.getY(i), position.getZ(i)]).toEqual([c, 0, r]);
      }
    }
  });

  it('makes two triangles for each cell of the grid', () => {
    expect(sheet(ground(2, 2)).getIndex()?.count).toBe(2 * 3);
    expect(sheet(ground(3, 4)).getIndex()?.count).toBe(2 * 3 * 2 * 3);
  });

  it('faces along (row step) x (column step): a ground sheet with rows +z and columns +x faces up', () => {
    // Rows step +z and columns step +x; z cross x is +y.
    for (const normal of faceNormals(sheet(ground(3, 4)))) {
      expect(normal.x).toBeCloseTo(0, 5);
      expect(normal.y).toBeCloseTo(1, 5);
      expect(normal.z).toBeCloseTo(0, 5);
    }
  });

  it('flip reverses the winding so the sheet faces the other way', () => {
    for (const normal of faceNormals(sheet(ground(3, 4), true))) {
      expect(normal.y).toBeCloseTo(-1, 5);
    }
  });

  it('faces (row step) x (column step) on a tilted, curved sheet too', () => {
    // A wall in the plane z = 0: rows step +x, columns step +y, so it faces +z.
    const wall: Point[][] = Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c): Point => [r, c, 0])
    );
    for (const normal of faceNormals(sheet(wall))) {
      expect(normal.z).toBeCloseTo(1, 5);
    }
    // The same wall flipped faces -z.
    for (const normal of faceNormals(sheet(wall, true))) {
      expect(normal.z).toBeCloseTo(-1, 5);
    }
  });

  it('faces outward on a sheet bulging along its columns', () => {
    // A quarter-cylinder shell about the y axis: columns sweep the angle (x = cos, z = sin), rows step up y.
    // Rows (+y) x columns (the sweep, +z where the shell starts at +x) is +y x +z = +x: outward at the start.
    const shell: Point[][] = Array.from({ length: 2 }, (_, r) =>
      Array.from({ length: 5 }, (_, c): Point => {
        const angle = (c / 4) * (Math.PI / 2);
        return [Math.cos(angle), r, Math.sin(angle)];
      })
    );
    for (const normal of faceNormals(sheet(shell))) {
      // Every face points away from the axis: its normal has a positive dot with its own radial direction.
      expect(Math.hypot(normal.x, normal.z)).toBeGreaterThan(0.9);
      expect(normal.x + normal.z).toBeGreaterThan(0);
    }
  });

  it('accepts vectors as well as tuples', () => {
    const rows = [
      [new Vector3(0, 0, 0), [1, 0, 0] as Point],
      [{ x: 0, y: 0, z: 1 }, new Vector3(1, 0, 1)],
    ];
    const position = sheet(rows).getAttribute('position');
    expect([position.getX(3), position.getZ(3)]).toEqual([1, 1]);
    expect([position.getX(2), position.getZ(2)]).toEqual([0, 1]);
  });

  it('has positions and an index but no other attributes (part() fills the rest)', () => {
    const geometry = sheet(ground(2, 2));
    expect(Object.keys(geometry.attributes)).toEqual(['position']);
  });

  it('rejects fewer than two rows or two columns', () => {
    expect(() => sheet([])).toThrow(GameboardValidationError);
    expect(() => sheet(ground(1, 3))).toThrow(GameboardValidationError);
    expect(() => sheet(ground(3, 1))).toThrow(GameboardValidationError);
  });

  it('rejects rows of different lengths', () => {
    expect(() =>
      sheet([
        [
          [0, 0, 0],
          [1, 0, 0],
        ],
        [[0, 0, 1]],
      ])
    ).toThrow(GameboardValidationError);
  });

  it('rejects a point with a non-finite coordinate', () => {
    const rows = ground(2, 2);
    rows[1] = [
      [0, 0, 1],
      [1, Number.NaN, 1],
    ];
    expect(() => sheet(rows)).toThrow(GameboardValidationError);
    const vectors = [
      [new Vector3(0, 0, 0), new Vector3(1, 0, 0)],
      [new Vector3(0, 0, 1), new Vector3(Number.POSITIVE_INFINITY, 0, 1)],
    ];
    expect(() => sheet(vectors)).toThrow(GameboardValidationError);
  });
});

describe('rope', () => {
  function endpoints(a: Point, b: Point, radius?: number) {
    const built = rope(a, b, { tone: 'rope', ...(radius === undefined ? {} : { radius }) });
    const position = built.geometry.getAttribute('position');
    const points = Array.from({ length: position.count }, (_, i) =>
      new Vector3().fromBufferAttribute(position, i)
    );
    return { built, points };
  }

  it('has a vertex exactly at each end: the cap centres sit at a and b', () => {
    for (const [a, b] of [
      [
        [0, 0, 0],
        [0, 3, 0],
      ],
      [
        [1, 2, 3],
        [4, -2, 0.5],
      ],
      [
        [0, 0, 0],
        [2, 0, 0],
      ],
    ] as Array<[Point, Point]>) {
      const { points } = endpoints(a, b);
      const start = new Vector3(...a);
      const end = new Vector3(...b);
      expect(Math.min(...points.map((p) => p.distanceTo(start)))).toBeLessThan(1e-5);
      expect(Math.min(...points.map((p) => p.distanceTo(end)))).toBeLessThan(1e-5);
    }
  });

  it('spans the length from a to b along its axis and stays within its radius of that axis', () => {
    const a: Point = [1, 2, 3];
    const b: Point = [4, -2, 0.5];
    const radius = 0.05;
    const { points } = endpoints(a, b, radius);
    const start = new Vector3(...a);
    const axis = new Vector3(...b).sub(start);
    const length = axis.length();
    axis.normalize();
    for (const p of points) {
      const along = p.clone().sub(start).dot(axis);
      expect(along).toBeGreaterThanOrEqual(-1e-5);
      expect(along).toBeLessThanOrEqual(length + 1e-5);
      const radial = p.clone().sub(start).addScaledVector(axis, -along).length();
      expect(radial).toBeLessThanOrEqual(radius + 1e-5);
    }
    const alongs = points.map((p) => p.clone().sub(start).dot(axis));
    expect(Math.min(...alongs)).toBeCloseTo(0, 5);
    expect(Math.max(...alongs)).toBeCloseTo(length, 5);
  });

  it('reaches b when b is straight below a', () => {
    const { points } = endpoints([0, 2, 0], [0, 0, 0]);
    expect(Math.min(...points.map((p) => p.distanceTo(new Vector3(0, 0, 0))))).toBeLessThan(1e-5);
    expect(Math.max(...points.map((p) => p.y))).toBeCloseTo(2, 5);
    expect(Math.min(...points.map((p) => p.y))).toBeCloseTo(0, 5);
  });

  it('defaults to a 14 mm radius of four sides', () => {
    const { points } = endpoints([0, 0, 0], [0, 1, 0]);
    expect(Math.max(...points.map((p) => Math.hypot(p.x, p.z)))).toBeCloseTo(0.014, 5);
    const four = rope([0, 0, 0], [0, 1, 0], { tone: 'rope' }).geometry.getAttribute(
      'position'
    ).count;
    const eight = rope([0, 0, 0], [0, 1, 0], { tone: 'rope', segments: 8 }).geometry.getAttribute(
      'position'
    ).count;
    expect(eight).toBeGreaterThan(four);
  });

  it('carries its tone, finish and shade', () => {
    const built = rope([0, 0, 0], [1, 0, 0], { tone: 'hemp', finish: 'veil', shade: 0.5 });
    expect(built.tone).toBe('hemp');
    expect(built.finish).toBe('veil');
    expect(built.shade).toBe(0.5);
  });

  it('rejects endpoints that coincide', () => {
    expect(() => rope([1, 1, 1], [1, 1, 1], { tone: 'rope' })).toThrow(GameboardValidationError);
  });

  it('rejects a non-finite endpoint', () => {
    expect(() => rope([0, 0, Number.NaN], [1, 0, 0], { tone: 'rope' })).toThrow(
      GameboardValidationError
    );
    expect(() => rope([0, 0, 0], [Number.POSITIVE_INFINITY, 0, 0], { tone: 'rope' })).toThrow(
      GameboardValidationError
    );
  });

  it('rejects a radius that is not positive and finite, and too few sides', () => {
    expect(() => rope([0, 0, 0], [1, 0, 0], { tone: 'rope', radius: 0 })).toThrow(
      GameboardValidationError
    );
    expect(() => rope([0, 0, 0], [1, 0, 0], { tone: 'rope', radius: Number.NaN })).toThrow(
      GameboardValidationError
    );
    expect(() => rope([0, 0, 0], [1, 0, 0], { tone: 'rope', segments: 2 })).toThrow(
      GameboardValidationError
    );
  });
});
