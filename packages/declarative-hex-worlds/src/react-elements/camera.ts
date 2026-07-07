/**
 * `src/react-elements/camera.ts` — the `useCamera` hook (RFC 0001 RFC0-CAM).
 *
 * The three binding's camera SUBSCRIBER: it reads the live board (the projected plan's
 * tiles — a koota signal) + a requested `CameraState`, computes a renderer-neutral
 * `CameraFraming` via the core `camera` module, and applies it to the active R3F camera
 * through `applyCameraFraming`. Camera is a signal like everything else — recompute +
 * reapply whenever the board or the requested view changes.
 *
 * The framing math (`../camera`) + the application (`./camera-apply`) are unit-tested,
 * R3F-free. This hook body is the ONLY R3F-touching part — thin `useThree`/`useEffect`
 * plumbing, v8-ignored like the other reconciler components (covered behaviorally by the
 * browser harness, not line-instrumentable through R3F).
 *
 * @module
 */
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { type CameraState, DEFAULT_CAMERA_STATE, frameBoard } from '../camera';
import { useProjectedGameboardPlan } from '../react';
import { type DrivableCamera, applyCameraFraming } from './camera-apply';

/**
 * Drive the active R3F camera to frame the live board per `state`. Recomputes + reapplies
 * whenever the board (projected plan) or the requested view changes.
 */
/* v8 ignore start -- R3F hook wiring; the framing math (../camera) + applyCameraFraming (./camera-apply) are unit-covered, this is untraceable hook plumbing. */
export function useCamera(state: CameraState = DEFAULT_CAMERA_STATE): void {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const plan = useProjectedGameboardPlan();

  useEffect(() => {
    if (!plan) {
      return;
    }
    const framing = frameBoard(plan.tiles, state);
    const aspect = size.height === 0 ? 1 : size.width / size.height;
    applyCameraFraming(camera as DrivableCamera, framing, aspect);
  }, [camera, plan, size.width, size.height, state]);
}
/* v8 ignore stop */
