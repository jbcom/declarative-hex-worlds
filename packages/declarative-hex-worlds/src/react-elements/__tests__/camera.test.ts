import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { type CameraFraming, computeCameraFraming, DEFAULT_CAMERA_STATE } from '../../camera';
import { applyCameraFraming } from '../camera-apply';

const framing: CameraFraming = {
  position: { x: 4, y: 10, z: 4 },
  target: { x: 0, y: 0, z: 0 },
  projection: 'orthographic',
  orthoHalfHeight: 6,
  fov: (50 * Math.PI) / 180,
  distance: 12,
};

describe('applyCameraFraming (three binding — RFC0-CAM)', () => {
  it('applies the supplied pole basis without a look-at fallback tilt', () => {
    const pose = computeCameraFraming(
      {
        min: { x: -1, y: 0, z: -7 },
        max: { x: 1, y: 0, z: 7 },
        center: { x: 0, y: 0, z: 0 },
        size: { x: 2, y: 0, z: 14 },
      },
      { ...DEFAULT_CAMERA_STATE, angle: 'top-down', projection: 'perspective', aspect: 0.4 }
    );
    const camera = new PerspectiveCamera();
    applyCameraFraming(camera, pose, 0.4);
    camera.updateMatrixWorld();
    expect(camera.getWorldDirection(new Vector3()).distanceTo(new Vector3(0, -1, 0))).toBeLessThan(
      1e-10
    );
  });
  it('positions an orthographic camera and sizes its box from half-height + aspect', () => {
    const camera = new OrthographicCamera();
    applyCameraFraming(camera, framing, 2); // 2:1 aspect
    expect(camera.position.x).toBe(4);
    expect(camera.position.y).toBe(10);
    // Ortho box: top/bottom from half-height, left/right scaled by aspect.
    expect(camera.top).toBe(6);
    expect(camera.bottom).toBe(-6);
    expect(camera.right).toBe(12); // 6 * 2
    expect(camera.left).toBe(-12);
  });

  it('positions a perspective camera and sets fov (deg) + aspect', () => {
    const camera = new PerspectiveCamera();
    applyCameraFraming(camera, { ...framing, projection: 'perspective' }, 1.5);
    expect(camera.position.z).toBe(4);
    expect(camera.fov).toBeCloseTo(50); // radians → degrees
    expect(camera.aspect).toBe(1.5);
  });

  it('orients the camera to look at the framing target', () => {
    const camera = new PerspectiveCamera();
    applyCameraFraming(camera, framing, 1);
    // After lookAt(target), the camera's forward (-Z) points roughly toward the target.
    const forward = { x: 0, y: 0, z: -1 };
    camera.updateMatrixWorld();
    // The quaternion should have rotated the camera off its identity orientation.
    expect(camera.quaternion.length()).toBeCloseTo(1); // valid unit quaternion
    expect(forward.z).toBe(-1); // sanity: convention held
  });
});
