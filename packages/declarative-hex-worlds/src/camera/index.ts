/**
 * `src/camera/` — neutral, renderer-free camera framing (RFC 0001 RFC0-CAM).
 *
 * Camera is a signal: the core computes a renderer-neutral framing from board bounds +
 * a view mode; a renderer binding applies it. Surfaced on `declarative-hex-worlds/camera`
 * (and re-exported from the umbrella). Imports no renderer.
 *
 * @module
 */
export {
  type BoardBounds,
  type CameraAngle,
  type CameraFit,
  type CameraFraming,
  type CameraProjection,
  type CameraState,
  DEFAULT_CAMERA_STATE,
  computeBoardBounds,
  computeCameraFraming,
  frameBoard,
} from './camera';
