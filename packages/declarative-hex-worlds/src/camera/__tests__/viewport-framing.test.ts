import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { type BoardBounds, computeCameraFraming, DEFAULT_CAMERA_STATE } from '../camera';

const bounds: BoardBounds = {
  min: { x: -0.48, y: 0.76, z: -0.52 },
  max: { x: 0.48, y: 0.93, z: 0.44 },
  center: { x: 0, y: 0.845, z: -0.04 },
  size: { x: 0.96, y: 0.17, z: 0.96 },
};
const corners = (box: BoardBounds) =>
  [box.min.x, box.max.x].flatMap((x) =>
    [box.min.y, box.max.y].flatMap((y) => [box.min.z, box.max.z].map((z) => new Vector3(x, y, z)))
  );

describe('viewport camera framing', () => {
  for (const [name, aspect, direction] of [
    ['desktop', 1280 / 720, { x: 0, y: 0.488, z: 0.85 }],
    ['portrait', 393 / 852, { x: 0, y: 0.738, z: 0.52 }],
    ['foldable', 884 / 1104, { x: 0, y: 0.738, z: 0.52 }],
    ['wide', 3, { x: 0.7, y: 0.7, z: 0.7 }],
    ['top-down', 0.4, { x: 0, y: 1, z: 0 }],
  ] as const) {
    it.each(['perspective', 'orthographic'] as const)(
      `fits elevated bounds for ${name}, %s`,
      (projection) => {
        const state = {
          ...DEFAULT_CAMERA_STATE,
          projection,
          aspect,
          eyeDirection: direction,
          padding: 0.1,
          fov: (50 * Math.PI) / 180,
        };
        const frame = computeCameraFraming(bounds, state);
        const h = frame.orthoHalfHeight;
        const camera =
          projection === 'perspective'
            ? new PerspectiveCamera((frame.fov * 180) / Math.PI, aspect, 0.001, 100)
            : new OrthographicCamera(-h * aspect, h * aspect, h, -h, 0.001, 100);
        camera.position.set(frame.position.x, frame.position.y, frame.position.z);
        camera.lookAt(frame.target.x, frame.target.y, frame.target.z);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        for (const corner of corners(bounds)) {
          const projected = corner.project(camera);
          expect(Math.abs(projected.x)).toBeLessThanOrEqual(1 / 1.1 + 0.001);
          expect(Math.abs(projected.y)).toBeLessThanOrEqual(1 / 1.1 + 0.001);
          expect(projected.z).toBeGreaterThan(-1);
          expect(projected.z).toBeLessThan(1);
        }
        const actualDirection = camera.position
          .clone()
          .sub(new Vector3(frame.target.x, frame.target.y, frame.target.z))
          .normalize();
        expect(
          actualDirection.distanceTo(new Vector3(direction.x, direction.y, direction.z).normalize())
        ).toBeLessThan(1e-10);
      }
    );
  }

  it('moves a portrait view farther away on resize, without changing its direction', () => {
    const state = { ...DEFAULT_CAMERA_STATE, projection: 'perspective' as const };
    const wide = computeCameraFraming(bounds, { ...state, aspect: 2 });
    const tall = computeCameraFraming(bounds, { ...state, aspect: 0.4 });
    expect(tall.distance).toBeGreaterThan(wide.distance);
  });

  it('translates the pose with the bounds without changing its framing distance', () => {
    const shift = (p: BoardBounds['center']) => ({ x: p.x + 23, y: p.y - 7, z: p.z + 11 });
    const shifted = {
      ...bounds,
      min: shift(bounds.min),
      max: shift(bounds.max),
      center: shift(bounds.center),
    };
    const state = { ...DEFAULT_CAMERA_STATE, aspect: 0.4 };
    const original = computeCameraFraming(bounds, state);
    const moved = computeCameraFraming(shifted, state);
    expect(moved.distance).toBeCloseTo(original.distance, 10);
    expect(moved.target).toEqual(shift(original.target));
    expect(moved.position.x).toBeCloseTo(original.position.x + 23, 10);
    expect(moved.position.y).toBeCloseTo(original.position.y - 7, 10);
    expect(moved.position.z).toBeCloseTo(original.position.z + 11, 10);
  });

  it('frames a point with a finite positive view volume', () => {
    const point = { x: 2, y: 3, z: 4 };
    const frame = computeCameraFraming(
      { min: point, max: point, center: point, size: { x: 0, y: 0, z: 0 } },
      {
        ...DEFAULT_CAMERA_STATE,
        aspect: 0.4,
      }
    );
    expect(frame.distance).toBeGreaterThan(0);
    expect(Number.isFinite(frame.distance)).toBe(true);
    expect(frame.orthoHalfHeight).toBeGreaterThan(0);
  });

  it('normalizes very large finite directions without overflow', () => {
    const frame = computeCameraFraming(bounds, {
      ...DEFAULT_CAMERA_STATE,
      eyeDirection: { x: 1e308, y: 1e308, z: 1e308 },
    });
    const ordinary = computeCameraFraming(bounds, {
      ...DEFAULT_CAMERA_STATE,
      eyeDirection: { x: 1, y: 1, z: 1 },
    });
    expect(frame).toEqual(ordinary);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid aspect %s', (aspect) => {
    expect(() => computeCameraFraming(bounds, { ...DEFAULT_CAMERA_STATE, aspect })).toThrow(
      RangeError
    );
  });
  it.each([0, Math.PI, Number.NaN])('rejects invalid FOV %s', (fov) => {
    expect(() => computeCameraFraming(bounds, { ...DEFAULT_CAMERA_STATE, fov })).toThrow(
      RangeError
    );
  });
  it.each([-0.1, Number.NaN])('rejects invalid padding %s', (padding) => {
    expect(() => computeCameraFraming(bounds, { ...DEFAULT_CAMERA_STATE, padding })).toThrow(
      RangeError
    );
  });
  it.each([
    { x: 0, y: 0, z: 0 },
    { x: Number.NaN, y: 1, z: 0 },
  ])('rejects invalid direction %j', (eyeDirection) => {
    expect(() => computeCameraFraming(bounds, { ...DEFAULT_CAMERA_STATE, eyeDirection })).toThrow(
      RangeError
    );
  });
});
