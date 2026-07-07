/**
 * `src/three/` — the three.js RENDERER BINDING (RFC 0001 signals+bindings).
 *
 * In the koota-native signals+bindings model, the core is renderer-free and koota
 * traits ARE the signals; this module is the 3D binding that subscribes to the
 * placement signals and reconciles a three scene. It is reachable ONLY via the
 * `declarative-hex-worlds/three` subpath, and `three` / `@react-three/fiber` are
 * OPTIONAL peer dependencies — a consumer installs them only if they import this
 * binding (the renderer-optionality contract enforces the core never pulls them in).
 * `src/canvas2d` is the sibling 2D binding subscribing to the same signals.
 *
 * `disposeGameboardThreeResources(ctx)` gives consumers a guided cleanup path for
 * geometry/material allocations.
 *
 * @module
 */

export * from './three';
export {
  type SheetTexture,
  type TexturedHexMeshOptions,
  buildHexGeometry,
  buildTexturedHexMesh,
} from './textured-hex';
export { type AccessoryAttachmentResult, attachAccessoryToModel, detachAccessory } from './accessories';
export { type TextureBindingResult, applyTextureBinding } from './texture-binding';
