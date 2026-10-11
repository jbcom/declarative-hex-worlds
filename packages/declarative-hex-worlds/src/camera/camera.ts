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
  /** Viewport width / height; finite and positive (default 1). */
  readonly aspect?: number;
  /** Direction from target towards eye, normalized internally; overrides angle. */
  readonly eyeDirection?: WorldPosition;
  /** Near clipping distance (default 0.1); nonnegative, positive for perspective. */
  readonly near?: number;
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
  /** Screen-up basis in world space. Computed framings supply this, including at poles. */
  readonly up?: WorldPosition;
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
    return {
      min: zero,
      max: { x: 1, y: 1, z: 1 },
      center: { x: 0.5, y: 0.5, z: 0.5 },
      size: { x: 1, y: 1, z: 1 },
    };
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

/** Unit direction from target towards eye for a view angle, in world space. */
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
  const scale = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
  if (!Number.isFinite(scale) || scale === 0) {
    throw new RangeError('Camera eyeDirection must be finite and nonzero');
  }
  const length = Math.hypot(v.x / scale, v.y / scale, v.z / scale);
  return { x: v.x / scale / length, y: v.y / scale / length, z: v.z / scale / length };
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
  if (!bounds || !state) {
    throw new RangeError('Camera bounds and state must be supplied');
  }
  if (
    !['top-down', 'isometric', 'tilted'].includes(state.angle) ||
    !['orthographic', 'perspective'].includes(state.projection) ||
    !['frame-board', 'fill-viewport'].includes(state.fit)
  ) {
    throw new RangeError('Camera angle, projection and fit must be supported values');
  }
  for (const position of [bounds.min, bounds.max, bounds.center, bounds.size]) {
    if (!position || ![position.x, position.y, position.z].every(Number.isFinite)) {
      throw new RangeError('Camera bounds must contain finite coordinates');
    }
  }
  const padding = state.padding ?? DEFAULT_PADDING;
  const fov = state.fov ?? DEFAULT_FOV;
  const aspect = state.aspect ?? 1;
  const near = state.near ?? 0.1;
  if (!Number.isFinite(near) || near < 0 || (state.projection === 'perspective' && near === 0)) {
    throw new RangeError('Camera near must be finite and nonnegative, positive for perspective');
  }
  if (!Number.isFinite(aspect) || aspect <= 0) {
    throw new RangeError('Camera aspect must be finite and positive');
  }
  if (!Number.isFinite(fov) || fov <= 0 || fov >= Math.PI) {
    throw new RangeError('Camera fov must be between zero and pi');
  }
  if (!Number.isFinite(padding) || padding < 0) {
    throw new RangeError('Camera padding must be finite and nonnegative');
  }
  const dir = state.eyeDirection
    ? normalize(state.eyeDirection)
    : eyeDirectionForAngle(state.angle);
  const horizontal = Math.hypot(dir.x, dir.z);
  const right =
    horizontal > 0 ? { x: dir.z / horizontal, y: 0, z: -dir.x / horizontal } : { x: 1, y: 0, z: 0 };
  // With world Y up, up = eyeDirection × right; poles use a north-facing basis.
  const up = {
    x: dir.y * right.z,
    y: dir.z * right.x - dir.x * right.z,
    z: -dir.y * right.x,
  };
  const factor = state.fit === 'frame-board' ? 1 + padding : 1;
  const tanVertical = Math.tan(fov / 2);
  if (!Number.isFinite(tanVertical) || tanVertical <= 0) {
    throw new RangeError('Camera fov cannot produce a finite projection');
  }
  let projectedWidth = 0;
  let projectedHeight = 0;
  let distance = 0;
  let nearestDepth = Number.NEGATIVE_INFINITY;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const dx = x - bounds.center.x;
        const dy = y - bounds.center.y;
        const dz = z - bounds.center.z;
        const width = Math.abs(dx * right.x + dy * right.y + dz * right.z);
        const height = Math.abs(dx * up.x + dy * up.y + dz * up.z);
        const depth = dx * dir.x + dy * dir.y + dz * dir.z;
        projectedWidth = Math.max(projectedWidth, width);
        projectedHeight = Math.max(projectedHeight, height);
        nearestDepth = Math.max(nearestDepth, depth);
        // A near corner subtends more of the view than the box's center does.
        distance = Math.max(
          distance,
          depth + factor * Math.max(width / (tanVertical * aspect), height / tanVertical)
        );
      }
    }
  }
  const orthoHalfHeight = factor * (Math.max(projectedHeight, projectedWidth / aspect) || 0.5);
  const clearance = Math.max(1e-6, near * 1.001);
  distance =
    state.projection === 'orthographic'
      ? Math.max(1, nearestDepth + Math.max(1, clearance))
      : Math.max(distance || orthoHalfHeight / tanVertical, nearestDepth + clearance);
  const position: WorldPosition = {
    x: bounds.center.x + dir.x * distance,
    y: bounds.center.y + dir.y * distance,
    z: bounds.center.z + dir.z * distance,
  };
  if (![distance, orthoHalfHeight, position.x, position.y, position.z].every(Number.isFinite)) {
    throw new RangeError('Camera framing exceeds the finite numeric range');
  }
  return {
    position,
    target: bounds.center,
    up,
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
