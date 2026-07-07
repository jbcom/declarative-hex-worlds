/**
 * `src/three/texture-binding.ts` — the three binding for texture→model binding (RFC0-TEX).
 *
 * Applies a loaded base-color (and optional normal) texture to a model's mesh materials,
 * scoped to the binding's target mesh names. The spec + validation are neutral
 * (`../texture-binding`); this is the three-side material assignment.
 *
 * @module
 */
import type { Material, Object3D, Texture } from 'three';
import { type TextureBinding, bindingTargetsMesh } from '../texture-binding';

/** A material that can carry a base-color + normal map (MeshStandardMaterial-shaped). */
type MappableMaterial = Material & {
  map?: Texture | null;
  normalMap?: Texture | null;
  needsUpdate?: boolean;
};

/** A mesh-like object carrying material(s). */
type MeshLike = Object3D & { material?: MappableMaterial | MappableMaterial[] };

/** Result of applying a texture binding — the count of materials updated. */
export interface TextureBindingResult {
  readonly assetId: string;
  readonly materialsUpdated: number;
}

function assignTexture(material: MappableMaterial, map: Texture, normal?: Texture): void {
  material.map = map;
  if (normal) {
    material.normalMap = normal;
  }
  material.needsUpdate = true;
}

/**
 * Apply a texture binding to a loaded model. Traverses `modelRoot`, and for every mesh
 * whose name is targeted by the binding (a binding with no `targets` matches all meshes),
 * sets the base-color `map` (and `normalMap` when a normal texture is given) on its
 * material(s). Returns how many materials were updated.
 */
export function applyTextureBinding(
  modelRoot: Object3D,
  binding: TextureBinding,
  texture: Texture,
  normalTexture?: Texture
): TextureBindingResult {
  let materialsUpdated = 0;
  modelRoot.traverse((child) => {
    const mesh = child as MeshLike;
    if (!mesh.material) {
      return;
    }
    if (!bindingTargetsMesh(binding, mesh.name)) {
      return;
    }
    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        assignTexture(material, texture, normalTexture);
        materialsUpdated += 1;
      }
    } else {
      assignTexture(mesh.material, texture, normalTexture);
      materialsUpdated += 1;
    }
  });
  return { assetId: binding.assetId, materialsUpdated };
}
