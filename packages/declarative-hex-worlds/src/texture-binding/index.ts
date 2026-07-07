/**
 * `src/texture-binding/` — texture→model binding specs (RFC 0001 RFC0-TEX).
 *
 * Neutral data model for binding textures to specific models/meshes (packs like KayKit
 * Adventures ship textures per mesh). The three-side material assignment lives in
 * `declarative-hex-worlds/three` (applyTextureBinding). Surfaced on the umbrella +
 * `declarative-hex-worlds/texture-binding`.
 *
 * @module
 */
export {
  type TextureBinding,
  type TextureBindingIndex,
  bindingTargetsMesh,
  indexTextureBindings,
  validateTextureBindings,
} from './texture-binding';
