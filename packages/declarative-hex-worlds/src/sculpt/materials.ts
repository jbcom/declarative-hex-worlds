/**
 * `src/sculpt/materials.ts` — one material per built-in finish.
 *
 * @module
 */
import { DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three';

/** One material per {@link DefaultFinish}, each reading the vertex colours {@link buildPiece} bakes. */
export interface SculptMaterials {
  /** Rough, non-metallic: stone, wood, clay, cloth. */
  readonly matte: MeshStandardMaterial;
  /** Glossy, metallic: gold, bronze. */
  readonly metal: MeshStandardMaterial;
  /** Unlit and outside tone mapping, so the baked gain over 1 blooms: lamp glass, embers. */
  readonly glow: MeshBasicMaterial;
  /** A faint two-sided film that writes no depth: cobweb, dust. */
  readonly veil: MeshStandardMaterial;
}

/**
 * Creates the materials the built-in finishes are meant to be drawn with. Pair each merged
 * geometry from {@link buildPiece} with the material of the same name:
 *
 * ```ts
 * const materials = createSculptMaterials();
 * for (const [finish, geometry] of buildPiece(parts, palette)) {
 *   group.add(new Mesh(geometry, materials[finish as keyof SculptMaterials]));
 * }
 * ```
 *
 * Every call makes fresh materials, so each owner disposes its own. A consumer with custom
 * finishes builds the materials for those itself; the vertex colours are the same either way, so
 * any material with `vertexColors: true` draws them.
 */
export function createSculptMaterials(): SculptMaterials {
  return {
    matte: new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }),
    metal: new MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.7 }),
    glow: new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    veil: new MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      transparent: true,
      opacity: 0.22,
      side: DoubleSide,
      // One pass, both faces. A transparent double-sided material otherwise draws twice, back
      // faces then front, and three flips its side (and so its version) for each, re-resolving
      // its program every frame. A faint veil that writes no depth shows no difference in the
      // order its faces blend.
      forceSinglePass: true,
      depthWrite: false,
    }),
  };
}
