/**
 * three-example render harness — renders a gameboard plan to a canvas through the
 * PUBLISHED `declarative-hex-worlds/three` binding (RFC 0001 RFC0-2).
 *
 * The three example's own visual harness. It imports ONLY published subpaths
 * (`/three`, `/runtime`, `/manifest/free`, `/gameboard`, `/types`) — so the visual
 * baselines it produces prove the game renders through the PUBLIC three binding,
 * the whole point of the examples package. Nothing here reaches into library
 * internals. (The 2D example has its own harness over `/canvas2d`.)
 *
 * @module
 */
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  OrthographicCamera,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GameboardPlacementSpec, GameboardPlan } from 'declarative-hex-worlds/gameboard';
import { freeManifest } from 'declarative-hex-worlds/manifest/free';
import { resolveGameboardAssetRoot } from 'declarative-hex-worlds/runtime';
import {
  resolveGameboardPlacementAssetUrl,
  syncGameboardPlacementObjects,
} from 'declarative-hex-worlds/three';

const loader = new GLTFLoader();

export interface GameboardRenderOptions {
  title: string;
  width?: number;
  height?: number;
  background?: string;
  includeExtra?: boolean;
  resolvePlacementUrl?: (placement: GameboardPlacementSpec) => string | undefined;
  resolvePlacementAnimationUrl?: (placement: GameboardPlacementSpec) => string | undefined;
}

export interface CanvasContentStats {
  width: number;
  height: number;
  drawCalls: number;
  triangles: number;
  lines: number;
  points: number;
}

export interface CanvasContentAssertionOptions {
  minDrawCalls?: number;
  minTriangles?: number;
}

/**
 * Render a gameboard plan to a canvas through the published three binding
 * (`syncGameboardPlacementObjects`), framed by an orthographic camera. Returns the
 * canvas with captured WebGL content stats attached for assertion.
 */
export async function renderGameboardPlan(
  plan: GameboardPlan,
  options: GameboardRenderOptions
): Promise<HTMLCanvasElement> {
  const width = options.width ?? 1600;
  const height = options.height ?? 1000;
  const background = options.background ?? '#20251f';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.dataset.testid = slug(options.title);
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.background = background;
  document.body.append(canvas);

  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false);
  renderer.setClearColor(new Color(background), 1);

  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.7));
  const keyLight = new DirectionalLight(0xffffff, 2.4);
  keyLight.position.set(5, 9, 6);
  scene.add(keyLight);

  const loadable = plan.placements.filter((placement) => {
    if (!options.includeExtra && placement.requiresExtra) {
      return false;
    }
    return Boolean(
      resolveGameboardPlacementAssetUrl(placement, {
        bootstrapAssetRoot: resolveGameboardAssetRoot(),
        catalog: freeManifest,
        fallback: options.resolvePlacementUrl,
      })
    );
  });
  await syncGameboardPlacementObjects(loadable, {
    loader,
    parent: scene,
    bootstrapAssetRoot: resolveGameboardAssetRoot(),
    catalog: freeManifest,
    fallback: options.resolvePlacementUrl,
    animationUrlResolver: options.resolvePlacementAnimationUrl,
    deltaSeconds: 0.45,
    throwOnError: true,
  });

  const box = new Box3().setFromObject(scene);
  const size = new Vector3();
  const center = new Vector3();
  box.getSize(size);
  box.getCenter(center);
  const viewWidth = Math.max(size.x, size.z) * 1.75;
  const viewHeight = Math.max(size.x, size.z) * 1.2;
  const camera = new OrthographicCamera(
    -viewWidth / 2,
    viewWidth / 2,
    viewHeight / 2,
    -viewHeight / 2,
    0.1,
    300
  );
  camera.position.set(center.x + size.x * 0.65, center.y + 10, center.z + size.z * 0.8);
  camera.lookAt(center);
  renderer.render(scene, camera);
  attachCanvasContentStats(canvas, captureRendererContentStats(renderer));
  disposeObject(scene);
  renderer.dispose();
  return canvas;
}

export function readCanvasContentStats(canvas: HTMLCanvasElement): CanvasContentStats {
  const raw = canvas.dataset.contentStats;
  if (!raw) {
    throw new Error(
      `Canvas ${canvas.dataset.testid ?? '<unnamed>'} does not have captured WebGL content stats`
    );
  }
  return JSON.parse(raw) as CanvasContentStats;
}

export function assertCanvasHasRenderableContent(
  canvas: HTMLCanvasElement,
  options: CanvasContentAssertionOptions = {}
): CanvasContentStats {
  const stats = readCanvasContentStats(canvas);
  const minDrawCalls = options.minDrawCalls ?? 1;
  const minTriangles = options.minTriangles ?? 1;
  if (stats.drawCalls < minDrawCalls) {
    throw new Error(
      `Canvas ${canvas.dataset.testid ?? '<unnamed>'} only recorded ${stats.drawCalls} renderer draw call(s)`
    );
  }
  if (stats.triangles < minTriangles) {
    throw new Error(
      `Canvas ${canvas.dataset.testid ?? '<unnamed>'} only recorded ${stats.triangles} rendered triangle(s)`
    );
  }
  return stats;
}

function attachCanvasContentStats(canvas: HTMLCanvasElement, stats: CanvasContentStats): void {
  canvas.dataset.contentStats = JSON.stringify(stats);
}

function captureRendererContentStats(renderer: WebGLRenderer): CanvasContentStats {
  return {
    width: renderer.domElement.width,
    height: renderer.domElement.height,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    lines: renderer.info.render.lines,
    points: renderer.info.render.points,
  };
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    const disposable = child as Object3D & {
      geometry?: { dispose: () => void };
      material?: Material | Material[];
    };
    disposable.geometry?.dispose();
    if (Array.isArray(disposable.material)) {
      for (const material of disposable.material) {
        disposeMaterial(material);
      }
      return;
    }
    if (disposable.material) {
      disposeMaterial(disposable.material);
    }
  });
}

function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) {
      value.dispose();
    }
  }
  material.dispose();
}
