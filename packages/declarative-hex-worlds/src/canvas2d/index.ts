/**
 * `src/canvas2d/` — the canvas-2D renderer binding (RFC 0001 signals+bindings).
 *
 * The 2D substrate proof: a second renderer binding that subscribes to the same
 * koota placement signals as `src/three` and reconciles a `CanvasRenderingContext2D`
 * instead of a three scene. Imports NO renderer library. Surfaced on the
 * `declarative-hex-worlds/canvas2d` subpath.
 *
 * @module
 */
export {
  type Canvas2dDrawnPlacement,
  type Canvas2dSheetImages,
  type Canvas2dSyncOptions,
  type Canvas2dSyncResult,
  type Canvas2dViewport,
  syncCanvas2dPlacements,
} from './canvas2d';
