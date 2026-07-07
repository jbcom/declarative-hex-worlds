/**
 * `src/texture-binding/texture-binding.ts` — texture→model binding specs (RFC 0001
 * RFC0-TEX).
 *
 * Some packs (KayKit Adventures) ship a model's geometry and its texture(s) separately —
 * the GLB has meshes, and a texture PNG is bound to them at load. This is the neutral
 * data model: which texture binds to which model, optionally scoped to named meshes/
 * materials. The three binding (`../three`) loads the texture + assigns it to the model's
 * materials. Renderer-free.
 *
 * @module
 */

/** A texture bound to a model, optionally scoped to specific meshes/materials by name. */
export interface TextureBinding {
  /** Asset id of the model these textures apply to. */
  readonly assetId: string;
  /** URL of the texture to apply as the base-color map. */
  readonly textureUrl: string;
  /**
   * Names of the meshes/materials the texture applies to. When omitted, the texture is
   * applied to EVERY mesh material in the model.
   */
  readonly targets?: readonly string[];
  /** Optional normal-map URL applied alongside the base-color map. */
  readonly normalUrl?: string;
}

/** A map of asset id → its texture bindings, for quick lookup during load. */
export type TextureBindingIndex = ReadonlyMap<string, readonly TextureBinding[]>;

/** Build a lookup index from a flat list of texture bindings (grouped by assetId). */
export function indexTextureBindings(
  bindings: readonly TextureBinding[]
): TextureBindingIndex {
  const index = new Map<string, TextureBinding[]>();
  for (const binding of bindings) {
    const existing = index.get(binding.assetId);
    if (existing) {
      existing.push(binding);
    } else {
      index.set(binding.assetId, [binding]);
    }
  }
  return index;
}

/**
 * Validate texture bindings at author time: assetId + textureUrl non-empty. Returns the
 * problems (empty = valid) so a mis-specified binding fails before it silently no-ops at
 * render.
 */
export function validateTextureBindings(
  bindings: readonly TextureBinding[]
): readonly string[] {
  const problems: string[] = [];
  for (const [i, binding] of bindings.entries()) {
    if (!binding.assetId) {
      problems.push(`texture binding [${i}] is missing an assetId`);
    }
    if (!binding.textureUrl) {
      problems.push(`texture binding [${i}]${binding.assetId ? ` (${binding.assetId})` : ''} is missing a textureUrl`);
    }
  }
  return problems;
}

/** True if a mesh/material name is a target of the binding (a binding with no targets matches all). */
export function bindingTargetsMesh(binding: TextureBinding, meshName: string): boolean {
  return binding.targets === undefined || binding.targets.includes(meshName);
}
