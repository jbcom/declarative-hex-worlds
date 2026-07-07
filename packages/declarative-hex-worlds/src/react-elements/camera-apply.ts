/**
 * `src/react-elements/camera-apply.ts` — the pure framing→camera application
 * (RFC 0001 RFC0-CAM).
 *
 * Split out of `camera.ts` (which imports `@react-three/fiber`) so this carries NO R3F
 * dependency: it applies a renderer-neutral `CameraFraming` to a three camera and is
 * unit-tested directly with a plain camera (the same objects.ts / objects-sync.ts split).
 * `useCamera` (the R3F hook) delegates here each time it recomputes.
 *
 * @module
 */
import type { OrthographicCamera, PerspectiveCamera } from 'three';
import type { CameraFraming } from '../camera';

/** A three camera we can drive — the fields `applyCameraFraming` sets. */
export type DrivableCamera = (OrthographicCamera | PerspectiveCamera) & {
  updateProjectionMatrix(): void;
};

/**
 * Apply a computed framing to a three camera: position the eye, look at the target, and
 * size the projection (ortho box from `orthoHalfHeight` + the viewport aspect, or the
 * perspective fov + aspect). Pure of React/R3F — takes the camera + aspect directly, so
 * it is unit-testable with a plain three camera.
 */
export function applyCameraFraming(
  camera: DrivableCamera,
  framing: CameraFraming,
  aspect: number
): void {
  camera.position.set(framing.position.x, framing.position.y, framing.position.z);
  camera.up.set(0, 1, 0);
  camera.lookAt(framing.target.x, framing.target.y, framing.target.z);
  if ('isOrthographicCamera' in camera && camera.isOrthographicCamera) {
    const ortho = camera as OrthographicCamera;
    const halfW = framing.orthoHalfHeight * aspect;
    ortho.left = -halfW;
    ortho.right = halfW;
    ortho.top = framing.orthoHalfHeight;
    ortho.bottom = -framing.orthoHalfHeight;
  } else {
    const persp = camera as PerspectiveCamera;
    persp.fov = (framing.fov * 180) / Math.PI;
    persp.aspect = aspect;
  }
  camera.updateProjectionMatrix();
}
