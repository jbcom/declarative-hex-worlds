// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeBoardBounds, DEFAULT_CAMERA_STATE, type CameraState } from '../../camera';
import { createGameboardPlan, type GameboardPlan } from '../../gameboard';
import { useCamera } from '../camera';

const fixture = vi.hoisted(() => ({
  camera: undefined as PerspectiveCamera | OrthographicCamera | undefined,
  size: { width: 0, height: 0 },
  plan: undefined as GameboardPlan | undefined,
}));
vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: typeof fixture) => unknown) => selector(fixture),
}));
vi.mock('../../react', () => ({ useProjectedGameboardPlan: () => fixture.plan }));

let root: ReturnType<typeof createRoot> | undefined;
const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
});
function Probe({ state }: { state: CameraState }) {
  useCamera(state);
  return null;
}
function start(projection: 'perspective' | 'orthographic') {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  fixture.camera =
    projection === 'perspective'
      ? new PerspectiveCamera(50, 1, 0.001, 100)
      : new OrthographicCamera(-1, 1, 1, -1, 0.001, 100);
  fixture.plan = createGameboardPlan({ shape: { kind: 'rectangle', width: 4, height: 3 } });
  const element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
  return fixture.camera;
}
function assertVisible(camera: PerspectiveCamera | OrthographicCamera) {
  const bounds = computeBoardBounds(fixture.plan?.tiles ?? []);
  camera.updateMatrixWorld();
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const p = new Vector3(x, y, z).project(camera);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(1 / 1.15 + 1e-8);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(1 / 1.15 + 1e-8);
      }
    }
}
describe('useCamera viewport binding', () => {
  it.each(['perspective', 'orthographic'] as const)(
    'frames portrait and resize with one measured aspect, %s',
    async (projection) => {
      const camera = start(projection);
      const state = { ...DEFAULT_CAMERA_STATE, projection, aspect: 3 };
      fixture.size = { width: 393, height: 852 };
      await act(async () => root?.render(createElement(Probe, { state })));
      assertVisible(camera);
      fixture.size = { width: 1200, height: 400 };
      await act(async () => root?.render(createElement(Probe, { state })));
      assertVisible(camera);
    }
  );
  it('waits for a positive viewport before changing the camera', async () => {
    const camera = start('perspective');
    fixture.size = { width: 0, height: 100 };
    await act(async () => root?.render(createElement(Probe, { state: DEFAULT_CAMERA_STATE })));
    expect(camera.position.toArray()).toEqual([0, 0, 0]);
    fixture.size = { width: 393, height: 852 };
    await act(async () => root?.render(createElement(Probe, { state: DEFAULT_CAMERA_STATE })));
    assertVisible(camera);
  });
});
