/**
 * `src/three/` — Three.js bindings (first-class, NOT peer-dep gated).
 *
 * Per the PRD bundled-bindings correction (2026-05-26): three is a hard
 * `dependency`, not an optional peer. PRD Epic D6b also surfaces
 * `disposeGameboardThreeResources(ctx)` here so consumers have a guided
 * cleanup path for geometry/material allocations.
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
export { type ThreeRenderBackendOptions, createThreeRenderBackend } from './three-backend';
