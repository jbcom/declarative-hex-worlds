import { describe, expect, it } from 'vitest';
import type { GameboardTileSpec } from '../../gameboard';
import {
  DEFAULT_CAMERA_STATE,
  type CameraAngle,
  type CameraState,
  computeBoardBounds,
  computeCameraFraming,
  frameBoard,
} from '../camera';

/** Minimal tile spec at axial coordinates + elevation (the camera reads only these). */
function tile(q: number, r: number, elevation = 0): GameboardTileSpec {
  return {
    key: `${q},${r}`,
    coordinates: { q, r },
    terrain: 'grass',
    elevation,
  } as unknown as GameboardTileSpec;
}

describe('camera framing (RFC0-CAM, renderer-free signal)', () => {
  describe('computeBoardBounds', () => {
    it('returns a safe unit box for an empty board (no divide-by-zero downstream)', () => {
      const bounds = computeBoardBounds([]);
      expect(bounds.size.x).toBeGreaterThan(0);
      expect(bounds.size.y).toBeGreaterThan(0);
      expect(bounds.center).toEqual({ x: 0.5, y: 0.5, z: 0.5 });
    });

    it('spans the min/max world position over all tiles', () => {
      const bounds = computeBoardBounds([tile(0, 0), tile(4, 4), tile(2, 2)]);
      // Larger boards have larger extents; center sits between min and max.
      expect(bounds.size.x).toBeGreaterThan(0);
      expect(bounds.size.z).toBeGreaterThan(0);
      expect(bounds.center.x).toBeGreaterThanOrEqual(bounds.min.x);
      expect(bounds.center.x).toBeLessThanOrEqual(bounds.max.x);
    });

    it('includes elevation in the Y extent', () => {
      const flat = computeBoardBounds([tile(0, 0, 0), tile(1, 0, 0)]);
      const stacked = computeBoardBounds([tile(0, 0, 0), tile(1, 0, 3)]);
      expect(stacked.size.y).toBeGreaterThan(flat.size.y);
    });
  });

  describe('computeCameraFraming', () => {
    const bounds = computeBoardBounds([tile(0, 0), tile(6, 6)]);

    it('defaults to isometric + orthographic + frame-board', () => {
      const framing = computeCameraFraming(bounds);
      expect(framing.projection).toBe('orthographic');
      expect(framing.target).toEqual(bounds.center);
      expect(framing.distance).toBeGreaterThan(0);
      expect(framing.orthoHalfHeight).toBeGreaterThan(0);
    });

    it('looks straight down for top-down (eye directly above the center)', () => {
      const framing = computeCameraFraming(bounds, {
        ...DEFAULT_CAMERA_STATE,
        angle: 'top-down',
      });
      expect(framing.position.x).toBeCloseTo(bounds.center.x);
      expect(framing.position.z).toBeCloseTo(bounds.center.z);
      expect(framing.position.y).toBeGreaterThan(bounds.center.y);
    });

    it.each<CameraAngle>(['top-down', 'isometric', 'tilted'])(
      'places the eye at the framing distance from center for %s',
      (angle) => {
        const framing = computeCameraFraming(bounds, { ...DEFAULT_CAMERA_STATE, angle });
        const dx = framing.position.x - bounds.center.x;
        const dy = framing.position.y - bounds.center.y;
        const dz = framing.position.z - bounds.center.z;
        expect(Math.hypot(dx, dy, dz)).toBeCloseTo(framing.distance, 4);
      }
    );

    it('frame-board pads the view; fill-viewport does not', () => {
      const framed = computeCameraFraming(bounds, { ...DEFAULT_CAMERA_STATE, fit: 'frame-board' });
      const filled = computeCameraFraming(bounds, { ...DEFAULT_CAMERA_STATE, fit: 'fill-viewport' });
      expect(framed.orthoHalfHeight).toBeGreaterThan(filled.orthoHalfHeight);
    });

    it('frames a single-tile board (degenerate zero-extent plane) without collapsing', () => {
      // size.x == size.z == 0 → the plane-half fallback keeps a positive view volume.
      const single = computeCameraFraming(computeBoardBounds([tile(0, 0)]));
      expect(single.orthoHalfHeight).toBeGreaterThan(0);
      expect(single.distance).toBeGreaterThan(0);
    });

    it('honors a custom padding', () => {
      const tight = computeCameraFraming(bounds, { ...DEFAULT_CAMERA_STATE, padding: 0 });
      const loose = computeCameraFraming(bounds, { ...DEFAULT_CAMERA_STATE, padding: 0.5 });
      expect(loose.orthoHalfHeight).toBeGreaterThan(tight.orthoHalfHeight);
    });

    it('a wider FOV pulls a perspective camera closer for the same framing', () => {
      const narrow = computeCameraFraming(bounds, {
        ...DEFAULT_CAMERA_STATE,
        projection: 'perspective',
        fov: (30 * Math.PI) / 180,
      });
      const wide = computeCameraFraming(bounds, {
        ...DEFAULT_CAMERA_STATE,
        projection: 'perspective',
        fov: (80 * Math.PI) / 180,
      });
      expect(wide.distance).toBeLessThan(narrow.distance);
      expect(wide.projection).toBe('perspective');
    });
  });

  describe('frameBoard', () => {
    it('is computeCameraFraming(computeBoardBounds(tiles), state)', () => {
      const tiles = [tile(0, 0), tile(3, 2, 1)];
      const state: CameraState = { angle: 'tilted', projection: 'perspective', fit: 'fill-viewport' };
      expect(frameBoard(tiles, state)).toEqual(
        computeCameraFraming(computeBoardBounds(tiles), state)
      );
    });

    it('frames an empty board without throwing', () => {
      expect(() => frameBoard([])).not.toThrow();
    });
  });
});
