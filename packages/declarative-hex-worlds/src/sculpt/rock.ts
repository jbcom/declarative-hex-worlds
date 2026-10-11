/**
 * `src/sculpt/rock.ts` — deterministic rough stones.
 *
 * @module
 */
import { IcosahedronGeometry } from 'three';
import { type Part, type PartOptions, part } from './parts';
import { requireInteger, requirePositive, requireUnit } from './validate';

/**
 * A 32-bit hash of a quantised position, in `[0, 1)`. Vertices shared by several faces hash
 * alike, so they move together and the stone has no cracks.
 */
function vertexHash(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(Math.round(x * 1000) ^ 0x27d4eb2d, 0x165667b1);
  h = Math.imul(h ^ Math.round(y * 1000), 0x85ebca6b);
  h = Math.imul(h ^ Math.round(z * 1000) ^ seed, 0xc2b2ae35);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * A rough, faceted stone: an icosahedron with each vertex pushed in or out by a stable hash of
 * its position and `seed`, then squashed to 80 % height so it sits low.
 *
 * Deterministic: the same `r`, `seed` and `rough` give the same vertices in every process, and a
 * different `seed` gives a different stone. Each vertex lands between `r * (1 - rough)` and
 * `r * (1 + rough)` from the origin (before the y squash and before `o` places it). `rough` is
 * from 0 (a smooth flattened ellipsoid) to 1; default 0.28. Normals are flat, recomputed after the
 * roughening.
 *
 * Throws {@link GameboardValidationError} for a radius that is not positive and finite, a
 * non-integer seed, or a roughness outside 0 to 1.
 */
export function rock<const Tone extends string>(
  r: number,
  seed: number,
  o: PartOptions<Tone>,
  rough = 0.28
): Part<Tone> {
  requirePositive('radius', r);
  requireInteger('seed', seed);
  requireUnit('roughness', rough);
  const g = new IcosahedronGeometry(1, 1);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = r * (1 - rough + 2 * rough * vertexHash(x, y, z, seed));
    p.setXYZ(i, x * k, y * k * 0.8, z * k);
  }
  // The icosahedron's smooth normals describe the sphere, not the roughened stone.
  g.deleteAttribute('normal');
  return part(g, o);
}
