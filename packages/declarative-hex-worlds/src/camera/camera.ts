/**
 * `src/camera/camera.ts` — neutral, renderer-free camera framing (RFC 0001 RFC0-CAM).
 *
 * Camera is a SIGNAL, like everything else in the signals+bindings architecture: the
 * core computes a renderer-neutral framing (where the eye sits, what it looks at, the
 * projection) from the board's bounds + a requested view mode. A renderer BINDING then
 * applies that framing to its own camera — the three binding's `useCamera` drives an
 * R3F camera; a 2D binding could use the same framing for its viewport transform. This
 * module imports NO renderer.
 *
 * @module
 */
import { axialToWorld } from '../coordinates';
import type { GameboardTileSpec } from '../gameboard';
import type { WorldPosition } from '../types';

/** Axis-aligned world-space bounds of a board (over the board plane + elevation). */
export interface BoardBounds {
  readonly min: WorldPosition;
  readonly max: WorldPosition;
  /** Center of the bounds — the natural look-at target. */
  readonly center: WorldPosition;
  /** Full extent along each axis (max - min). */
  readonly size: WorldPosition;
}

/** How the camera looks at the board. */
export type CameraAngle =
  /** Straight down the Y axis — a flat map view. */
  | 'top-down'
  /** Classic isometric — equal tilt + yaw, the default game view. */
  | 'isometric'
  /** A shallow tilt toward top-down, keeping some depth. */
  | 'tilted';

/** Projection kind — orthographic (no perspective foreshortening) or perspective. */
export type CameraProjection = 'orthographic' | 'perspective';

/** How the framing fits the board into the view. */
export type CameraFit =
  /** Frame the whole board so it all fits with a margin. */
  | 'frame-board'
  /** Fill the viewport with the board (board's larger axis touches the edges). */
  | 'fill-viewport';

/** A requested camera view — the SIGNAL a renderer binding subscribes to. */
export interface CameraState {
  readonly angle: CameraAngle;
  readonly projection: CameraProjection;
  readonly fit: CameraFit;
  /** Fraction of extra room around the board for `frame-board` (default 0.15). */
  readonly padding?: number;
  /** Field of view in radians for perspective projection (default ~50°). */
  readonly fov?: number;
}

/** The default game camera: isometric, orthographic, framing the whole board. */
export const DEFAULT_CAMERA_STATE: CameraState = {
  angle: 'isometric',
  projection: 'orthographic',
  fit: 'frame-board',
};

/** A computed camera framing — renderer-neutral. A binding applies it to its camera. */
export interface CameraFraming {
  /** Eye position in world space. */
  readonly position: WorldPosition;
  /** Look-at target (board center). */
  readonly target: WorldPosition;
  readonly projection: CameraProjection;
  /**
   * Half-height of the orthographic view volume (world units). The binding derives
   * the ortho box from this + the viewport aspect. Present for both projections so a
   * binding can frame consistently; ignored by a pure-perspective camera.
   */
  readonly orthoHalfHeight: number;
  /** Field of view in radians (perspective). */
  readonly fov: number;
  /** Distance from eye to target. */
  readonly distance: number;
}

const DEFAULT_PADDING = 0.15;
const DEFAULT_FOV = (50 * Math.PI) / 180;

/**
 * Compute the world-space bounds of a board from its tiles (their world positions at
 * their elevation). An empty board yields a unit box centered at the origin so a
 * binding never divides by zero.
 */
export function computeBoardBounds(tiles: readonly GameboardTileSpec[]): BoardBounds {
  if (tiles.length === 0) {
    const zero: WorldPosition = { x: 0, y: 0, z: 0 };
    return { min: zero, max: { x: 1, y: 1, z: 1 }, center: { x: 0.5, y: 0.5, z: 0.5 }, size: { x: 1, y: 1, z: 1 } };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const tile of tiles) {
    const p = axialToWorld(tile.coordinates, tile.elevation);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    maxZ = Math.max(maxZ, p.z);
  }
  const min = { x: minX, y: minY, z: minZ };
  const max = { x: maxX, y: maxY, z: maxZ };
  return {
    min,
    max,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
  };
}

/** Unit look-direction (from eye toward target) for a view angle, in world space. */
function eyeDirectionForAngle(angle: CameraAngle): WorldPosition {
  switch (angle) {
    case 'top-down':
      return { x: 0, y: 1, z: 0 };
    case 'tilted':
      // Shallow tilt: mostly overhead, slight push along +z.
      return normalize({ x: 0, y: 0.9, z: 0.44 });
    case 'isometric':
      // Equal contributions — the classic 3/4 game view.
      return normalize({ x: 0.7, y: 0.7, z: 0.7 });
  }
}

function normalize(v: WorldPosition): WorldPosition {
  const raw = Math.hypot(v.x, v.y, v.z);
  // Guard a zero-length vector. No CameraAngle direction is all-zero, so the
  // fallback is defensive only — exclude it from the branch gate.
  /* v8 ignore next */
  const length = raw === 0 ? 1 : raw;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/**
 * Compute a renderer-neutral camera framing for a board's bounds + a requested view.
 * The eye sits along the angle's direction at a distance chosen so the board fits
 * (`frame-board`, with padding) or fills (`fill-viewport`) the view; the target is the
 * board center. `orthoHalfHeight` sizes an orthographic box; `fov`/`distance` size a
 * perspective one.
 */
export function computeCameraFraming(
  bounds: BoardBounds,
  state: CameraState = DEFAULT_CAMERA_STATE
): CameraFraming {
  const padding = state.padding ?? DEFAULT_PADDING;
  const fov = state.fov ?? DEFAULT_FOV;
  // The board's on-plane radius drives framing. Use the larger of x/z half-extents.
  const planeHalf = Math.max(bounds.size.x, bounds.size.z) / 2 || 0.5;
  const paddedHalf = state.fit === 'frame-board' ? planeHalf * (1 + padding) : planeHalf;
  // Ortho half-height frames the plane extent (plus elevation headroom).
  const orthoHalfHeight = paddedHalf + bounds.size.y / 2;
  // Perspective distance so the padded extent subtends the vertical FOV.
  const distance = orthoHalfHeight / Math.tan(fov / 2);
  const dir = eyeDirectionForAngle(state.angle);
  const position: WorldPosition = {
    x: bounds.center.x + dir.x * distance,
    y: bounds.center.y + dir.y * distance,
    z: bounds.center.z + dir.z * distance,
  };
  return {
    position,
    target: bounds.center,
    projection: state.projection,
    orthoHalfHeight,
    fov,
    distance,
  };
}

/**
 * One-shot framing straight from a board's tiles + a view state — the common path for
 * a binding's `useCamera`. Equivalent to `computeCameraFraming(computeBoardBounds(tiles), state)`.
 */
export function frameBoard(
  tiles: readonly GameboardTileSpec[],
  state: CameraState = DEFAULT_CAMERA_STATE
): CameraFraming {
  return computeCameraFraming(computeBoardBounds(tiles), state);
}
