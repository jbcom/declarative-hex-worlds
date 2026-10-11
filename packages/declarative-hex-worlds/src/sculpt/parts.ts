/**
 * `src/sculpt/parts.ts` — the parts a prop is modelled from.
 *
 * A **part** is one primitive (or any geometry) placed in the piece's own frame, painted one tone
 * and one finish. Parts are palette-free: they carry a tone *key*, and the colour is looked up
 * when {@link buildPiece} merges them. That keeps a recipe independent of any one game's colours.
 *
 * Units and frame: metres. A piece stands on `y = 0`, its front toward `+z`, its length along `x`.
 * Rotations are Euler XYZ in radians. A transform applies scale first, then rotation, then
 * position.
 *
 * Every part geometry leaves this module non-indexed with exactly two attributes, `position` and
 * `normal`, which is what lets {@link buildPiece} merge any mix of primitives, rocks, sheets and
 * custom shapes without attribute mismatches.
 *
 * @module
 */
import {
  BoxGeometry,
  type BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  LatheGeometry,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { GameboardValidationError } from '../errors';
import {
  type SculptVec3,
  requireFinite,
  requireNonNegative,
  requireSegments,
  requireVec3,
} from './validate';

export type { SculptVec3 } from './validate';

/** The finish a part gets when its options name none. */
export const DEFAULT_FINISH = 'matte';

/**
 * One modelled part: a geometry in the piece's frame, the tone it is painted, the finish it is
 * drawn with, and a shade multiplier.
 *
 * Make parts with {@link part} or the primitives; {@link buildPiece} expects the geometry
 * invariants they establish (non-indexed, `position` + `normal`).
 */
export interface Part<Tone extends string = string> {
  /** The part's geometry, already placed in the piece's frame. */
  readonly geometry: BufferGeometry;
  /** A key into the palette handed to {@link buildPiece}. */
  readonly tone: Tone;
  /** A key into the finish table (`matte`, `metal`, `glow`, `veil`, or a consumer's own). */
  readonly finish: string;
  /** Multiplies the tone: below 1 is darker (a crack, a shadowed underside). */
  readonly shade: number;
}

/** How a part is placed, turned, scaled and painted. */
export interface PartOptions<Tone extends string = string> {
  /** Position in the piece's frame, metres. Default `[0, 0, 0]`. */
  readonly at?: SculptVec3;
  /** Euler XYZ rotation, radians. Default `[0, 0, 0]`. */
  readonly rot?: SculptVec3;
  /** Per-axis scale, applied before the rotation. Default `[1, 1, 1]`. */
  readonly scale?: SculptVec3;
  /** The palette key this part is painted. */
  readonly tone: Tone;
  /** The finish key. Default {@link DEFAULT_FINISH} (`'matte'`). */
  readonly finish?: string;
  /** Multiplies the tone. Finite, at least 0. Default `1`. */
  readonly shade?: number;
}

const ORIGIN: SculptVec3 = [0, 0, 0];
const UNIT: SculptVec3 = [1, 1, 1];
const KEPT_ATTRIBUTES = new Set(['position', 'normal']);

const matrix = new Matrix4();
const quaternion = new Quaternion();
const euler = new Euler();
const position = new Vector3();
const scale = new Vector3();

/**
 * Any geometry as a part: placed, turned and scaled by `o`, painted its tone and finish. Use it
 * for custom shapes (a {@link sheet} of cloth, a heap).
 *
 * The geometry is taken over: made non-indexed, stripped to `position` and `normal` (flat
 * normals are computed if it has none), and transformed in place. An indexed source is disposed
 * and replaced. Throws {@link GameboardValidationError} for a geometry without positions, a
 * non-finite transform, a negative or non-finite shade, or an empty finish name; the geometry is
 * left untouched in that case.
 */
export function part<const Tone extends string>(
  geometry: BufferGeometry,
  o: PartOptions<Tone>
): Part<Tone> {
  const at = requireVec3('at', o.at === undefined ? ORIGIN : o.at);
  const rot = requireVec3('rot', o.rot === undefined ? ORIGIN : o.rot);
  const size = requireVec3('scale', o.scale === undefined ? UNIT : o.scale);
  const shade = requireNonNegative('shade', o.shade ?? 1);
  const finish = o.finish ?? DEFAULT_FINISH;
  if (finish === '') {
    throw new GameboardValidationError('sculpt: finish must not be an empty string');
  }
  if (!geometry.getAttribute('position')) {
    throw new GameboardValidationError('sculpt: a part geometry needs a position attribute');
  }

  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) {
    geometry.dispose();
  }
  for (const name of Object.keys(g.attributes)) {
    if (!KEPT_ATTRIBUTES.has(name)) {
      g.deleteAttribute(name);
    }
  }
  if (!g.getAttribute('normal')) {
    g.computeVertexNormals();
  }
  euler.set(rot[0], rot[1], rot[2]);
  quaternion.setFromEuler(euler);
  position.set(at[0], at[1], at[2]);
  scale.set(size[0], size[1], size[2]);
  g.applyMatrix4(matrix.compose(position, quaternion, scale));
  return { geometry: g, tone: o.tone, finish, shade };
}

/** A box `w` wide (x), `h` tall (y) and `d` deep (z), centred on its own origin. */
export function box<const Tone extends string>(
  w: number,
  h: number,
  d: number,
  o: PartOptions<Tone>
): Part<Tone> {
  requireNonNegative('width', w);
  requireNonNegative('height', h);
  requireNonNegative('depth', d);
  return part(new BoxGeometry(w, h, d), o);
}

/**
 * A cylinder `h` tall along y, centred, `rTop` across at the top and `rBottom` at the bottom
 * (a radius of 0 makes a cone), with `seg` sides (default 10).
 */
export function cyl<const Tone extends string>(
  rTop: number,
  rBottom: number,
  h: number,
  o: PartOptions<Tone>,
  seg = 10
): Part<Tone> {
  requireNonNegative('top radius', rTop);
  requireNonNegative('bottom radius', rBottom);
  requireNonNegative('height', h);
  requireSegments('segments', seg);
  return part(new CylinderGeometry(rTop, rBottom, h, seg), o);
}

/** A cone of base radius `r` and height `h` along y, centred, with `seg` sides (default 8). */
export function cone<const Tone extends string>(
  r: number,
  h: number,
  o: PartOptions<Tone>,
  seg = 8
): Part<Tone> {
  requireNonNegative('radius', r);
  requireNonNegative('height', h);
  requireSegments('segments', seg);
  return part(new ConeGeometry(r, h, seg), o);
}

/**
 * A sphere of radius `r` with `seg` segments round (default 10) and a proportional number of
 * latitude rings, never fewer than four.
 */
export function ball<const Tone extends string>(
  r: number,
  o: PartOptions<Tone>,
  seg = 10
): Part<Tone> {
  requireNonNegative('radius', r);
  requireSegments('segments', seg);
  return part(new SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.6))), o);
}

/**
 * A torus lying in the xy plane: ring radius `r` to the middle of the tube, tube radius `tube`,
 * `seg` segments round (default 16).
 */
export function ring<const Tone extends string>(
  r: number,
  tube: number,
  o: PartOptions<Tone>,
  seg = 16
): Part<Tone> {
  requireNonNegative('radius', r);
  requireNonNegative('tube radius', tube);
  requireSegments('segments', seg);
  return part(new TorusGeometry(r, tube, 5, seg), o);
}

/** A flat rectangle `w` wide and `h` tall in the xy plane, facing +z. */
export function plane<const Tone extends string>(
  w: number,
  h: number,
  o: PartOptions<Tone>
): Part<Tone> {
  requireNonNegative('width', w);
  requireNonNegative('height', h);
  return part(new PlaneGeometry(w, h), o);
}

/** A flat disc of radius `r` in the xy plane, facing +z, with `seg` sides (default 16). */
export function disc<const Tone extends string>(
  r: number,
  o: PartOptions<Tone>,
  seg = 16
): Part<Tone> {
  requireNonNegative('radius', r);
  requireSegments('segments', seg);
  return part(new CircleGeometry(r, seg), o);
}

/**
 * A turned vessel: `profile` is a list of `[radius, height]` points, bottom to top, revolved
 * about the y axis in `seg` steps (default 12). A profile that starts and ends at radius 0 is
 * closed. Needs at least two points, each with a finite radius of at least 0 and a finite height.
 */
export function lathe<const Tone extends string>(
  profile: readonly (readonly [number, number])[],
  o: PartOptions<Tone>,
  seg = 12
): Part<Tone> {
  if (profile.length < 2) {
    throw new GameboardValidationError(
      `sculpt: a lathe profile needs at least 2 points, got ${profile.length}`
    );
  }
  requireSegments('segments', seg);
  const points = profile.map(([radius, height], i) => {
    requireNonNegative(`profile[${i}] radius`, radius);
    requireFinite(`profile[${i}] height`, height);
    return new Vector2(radius, height);
  });
  return part(new LatheGeometry(points, seg), o);
}
