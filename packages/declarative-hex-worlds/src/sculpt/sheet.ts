/**
 * `src/sculpt/sheet.ts` — cloth and line: a surface from a grid of points, and a rope between
 * two points.
 *
 * @module
 */
import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Quaternion,
  Vector3,
} from 'three';
import { GameboardValidationError } from '../errors';
import { type Part, part } from './parts';
import { type SculptVec3, requirePositive, requireSegments, requireVec3 } from './validate';

/** A point in a sheet: a `[x, y, z]` tuple, or anything with `x`, `y` and `z` (a `Vector3`). */
export type SculptPoint =
  | SculptVec3
  | { readonly x: number; readonly y: number; readonly z: number };

function readPoint(name: string, point: SculptPoint): SculptVec3 {
  if (typeof point !== 'object' || point === null) {
    throw new GameboardValidationError(
      `sculpt: ${name} must be a point with three finite coordinates`
    );
  }
  return requireVec3(name, 'x' in point ? [point.x, point.y, point.z] : point);
}

/**
 * A surface from a grid of points: `rows` is a list of rows, each a list of the same number of
 * points. Every cell of four neighbouring points becomes two triangles.
 *
 * **Winding.** The front face (the side a backface-culled material shows) looks along
 * `(row step) x (column step)`: with `a` a point, `d` the point one row on and `b` the point one
 * column on, the front normal is `(d - a) x (b - a)`. A ground sheet whose rows step `+z` and
 * columns step `+x` therefore faces up (`z x x = +y`); a wall whose rows step `+x` and columns
 * step `+y` faces `+z`. Pass `flip` to reverse it.
 *
 * Returns an indexed geometry holding only `position`. Hand it to {@link part} to place and paint
 * it. Throws {@link GameboardValidationError} for fewer than two rows or two columns, rows of
 * unequal length, or a point with a non-finite coordinate.
 */
export function sheet(rows: readonly (readonly SculptPoint[])[], flip = false): BufferGeometry {
  const cols = rows[0]?.length ?? 0;
  if (rows.length < 2 || cols < 2) {
    throw new GameboardValidationError(
      `sculpt: a sheet needs at least 2 rows of 2 points, got ${rows.length} rows of ${cols}`
    );
  }
  const positions: number[] = [];
  rows.forEach((row, r) => {
    if (row.length !== cols) {
      throw new GameboardValidationError(
        `sculpt: every sheet row needs ${cols} points, row ${r} has ${row.length}`
      );
    }
    row.forEach((point, c) => {
      positions.push(...readPoint(`sheet point [${r}][${c}]`, point));
    });
  });
  const index: number[] = [];
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      if (flip) {
        index.push(a, b, d, b, e, d);
      } else {
        index.push(a, d, b, b, d, e);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  return g;
}

/** How a {@link rope} is painted and built. */
export interface RopeOptions<Tone extends string = string> {
  /** The palette key the rope is painted. */
  readonly tone: Tone;
  /** The finish key. Default `'matte'`. */
  readonly finish?: string;
  /** Multiplies the tone. Default `1`. */
  readonly shade?: number;
  /** The rope's radius, metres: above 0. Default `0.014`. */
  readonly radius?: number;
  /** Sides round the rope: an integer of at least 3. Default `4`. */
  readonly segments?: number;
}

const UP = new Vector3(0, 1, 0);

/**
 * A thin cylinder running from `a` to `b`: its base cap centre sits exactly at `a` and its top cap
 * centre exactly at `b`, however the two are oriented (straight down included). Throws
 * {@link GameboardValidationError} for a non-finite endpoint, coincident endpoints, a radius that
 * is not above 0, or fewer than three segments.
 */
export function rope<const Tone extends string>(
  a: SculptVec3,
  b: SculptVec3,
  o: RopeOptions<Tone>
): Part<Tone> {
  requireVec3('rope start', a);
  requireVec3('rope end', b);
  const radius = requirePositive('rope radius', o.radius ?? 0.014);
  const segments = requireSegments('rope segments', o.segments ?? 4);
  const from = new Vector3(a[0], a[1], a[2]);
  const to = new Vector3(b[0], b[1], b[2]);
  const length = from.distanceTo(to);
  if (length === 0) {
    throw new GameboardValidationError('sculpt: a rope needs two different endpoints');
  }
  const g = new CylinderGeometry(radius, radius, length, segments);
  g.translate(0, length / 2, 0);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, to.sub(from).normalize()));
  return part(g, { at: a, tone: o.tone, finish: o.finish, shade: o.shade });
}
