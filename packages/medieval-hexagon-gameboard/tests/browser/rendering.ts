import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  OrthographicCamera,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GameboardPlacementSpec, GameboardPlan } from '../../src/gameboard';
import { freeManifest } from '../../src/manifest/free';
import {
  resolveGameboardPlacementAssetUrl,
  syncGameboardPlacementObjects,
} from '../../src/three';
import type { MedievalHexagonAsset } from '../../src/types';

declare const __EXTRA_SOURCE_ROOT__: string | undefined;

export interface ContactSheetOptions {
  title: string;
  width?: number;
  height?: number;
  columns?: number;
  cellSize?: number;
  background?: string;
}

export interface AssetRenderRequest {
  asset: MedievalHexagonAsset;
  url: string;
  rotationY?: number;
  label?: string;
  caption?: string;
}

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

const loader = new GLTFLoader();
type LoadedGltf = Awaited<ReturnType<typeof loader.loadAsync>>;

export async function renderContactSheet(
  requests: readonly AssetRenderRequest[],
  options: ContactSheetOptions
): Promise<HTMLCanvasElement> {
  const width = options.width ?? 1800;
  const height = options.height ?? 1200;
  const columns = options.columns ?? Math.ceil(Math.sqrt(requests.length));
  const cellSize = options.cellSize ?? 3.4;
  const rows = Math.ceil(requests.length / columns);
  const background = options.background ?? '#1f2320';

  const webglCanvas = document.createElement('canvas');
  webglCanvas.width = width;
  webglCanvas.height = height;
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  outputCanvas.dataset.testid = slug(options.title);
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.background = options.background ?? '#1f2320';
  document.body.append(outputCanvas);

  const renderer = new WebGLRenderer({ canvas: webglCanvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false);
  renderer.setClearColor(new Color(background), 1);
  renderer.setScissorTest(true);
  renderer.info.autoReset = false;

  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.8));
  const keyLight = new DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(5, 8, 4);
  scene.add(keyLight);

  const requestCache = new Map<string, Promise<LoadedGltf>>();
  const objects = await Promise.all(requests.map((request) => loadRequest(request, requestCache)));
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  objects.forEach((object, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const viewportX = Math.floor(column * cellWidth);
    const viewportY = Math.floor(height - (row + 1) * cellHeight);
    const viewportWidth = Math.ceil(cellWidth);
    const viewportHeight = Math.ceil(cellHeight);
    object.position.set(0, 0, 0);
    scene.add(object);
    renderer.setViewport(viewportX, viewportY, viewportWidth, viewportHeight);
    renderer.setScissor(viewportX, viewportY, viewportWidth, viewportHeight);
    renderer.setClearColor(new Color(background), 1);
    const aspect = viewportWidth / viewportHeight;
    const viewSize = cellSize;
    const camera = new OrthographicCamera(
      (-viewSize * aspect) / 2,
      (viewSize * aspect) / 2,
      viewSize / 2,
      -viewSize / 2,
      0.1,
      300
    );
    camera.position.set(2.2, 2.35, 2.2);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    scene.remove(object);
  });

  const stats = captureRendererContentStats(renderer);
  const context = outputCanvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create 2D contact-sheet output context');
  }
  context.drawImage(webglCanvas, 0, 0);
  drawContactSheetLabels(context, requests, {
    width,
    height,
    columns,
    rows,
    title: options.title,
  });
  attachCanvasContentStats(outputCanvas, stats);
  for (const object of objects) {
    disposeObject(object);
  }
  disposeRenderer(renderer);
  return outputCanvas;
}

export function assetUrl(asset: MedievalHexagonAsset): string {
  return `/${asset.modelPath}`;
}

export function referenceExtraUrl(sourcePath: string): string {
  return `/@fs/${__EXTRA_SOURCE_ROOT__}/${sourcePath}`;
}

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
    return Boolean(resolveGameboardPlacementAssetUrl(placement, {
      catalog: freeManifest,
      fallback: options.resolvePlacementUrl,
    }));
  });
  await syncGameboardPlacementObjects(loadable, {
    loader,
    parent: scene,
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
  const camera = new OrthographicCamera(-viewWidth / 2, viewWidth / 2, viewHeight / 2, -viewHeight / 2, 0.1, 300);
  camera.position.set(center.x + size.x * 0.65, center.y + 10, center.z + size.z * 0.8);
  camera.lookAt(center);
  renderer.render(scene, camera);
  attachCanvasContentStats(canvas, captureRendererContentStats(renderer));
  disposeObject(scene);
  disposeRenderer(renderer);
  return canvas;
}

export function readCanvasContentStats(canvas: HTMLCanvasElement): CanvasContentStats {
  const raw = canvas.dataset.contentStats;
  if (!raw) {
    throw new Error(`Canvas ${canvas.dataset.testid ?? '<unnamed>'} does not have captured WebGL content stats`);
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

async function loadRequest(request: AssetRenderRequest, requestCache: Map<string, Promise<LoadedGltf>>): Promise<Group> {
  let gltf: Awaited<ReturnType<typeof loader.loadAsync>>;
  try {
    let requestPromise = requestCache.get(request.url);
    if (!requestPromise) {
      requestPromise = loader.loadAsync(request.url);
      requestCache.set(request.url, requestPromise);
    }
    gltf = await requestPromise;
  } catch (error) {
    throw new Error(
      `Failed to load ${request.asset.id} from ${request.url}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  const object = gltf.scene.clone(true);
  object.rotation.y = request.rotationY ?? 0;

  const box = new Box3().setFromObject(object);
  const size = new Vector3();
  const center = new Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDimension = Math.max(size.x, size.y, size.z, 0.1);
  const group = new Group();
  object.position.sub(center);
  object.scale.setScalar(1.45 / maxDimension);
  group.add(object);
  return group;
}

function attachCanvasContentStats(canvas: HTMLCanvasElement, stats: CanvasContentStats): void {
  canvas.dataset.contentStats = JSON.stringify(stats);
}

function disposeRenderer(renderer: WebGLRenderer): void {
  renderer.dispose();
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
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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

function drawContactSheetLabels(
  context: CanvasRenderingContext2D,
  requests: readonly AssetRenderRequest[],
  options: { width: number; height: number; columns: number; rows: number; title: string }
): void {
  const cellWidth = options.width / options.columns;
  const cellHeight = options.height / options.rows;
  context.save();
  context.textBaseline = 'top';
  context.font = '700 16px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillStyle = 'rgba(0, 0, 0, 0.72)';
  context.fillRect(0, 0, Math.min(options.width, options.title.length * 10 + 32), 30);
  context.fillStyle = '#f8f7e9';
  context.fillText(options.title, 12, 7);

  context.font = `${Math.max(8, Math.min(11, Math.floor(cellHeight * 0.12)))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  for (const [index, request] of requests.entries()) {
    const column = index % options.columns;
    const row = Math.floor(index / options.columns);
    const x = column * cellWidth;
    const y = row * cellHeight;
    context.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    context.strokeRect(x + 0.5, y + 0.5, cellWidth - 1, cellHeight - 1);
    const label = request.label ?? request.asset.id;
    const caption = request.caption;
    const labelHeight = caption ? 28 : 17;
    context.fillStyle = 'rgba(0, 0, 0, 0.66)';
    context.fillRect(x + 2, y + cellHeight - labelHeight - 2, cellWidth - 4, labelHeight);
    context.fillStyle = '#ffffff';
    context.fillText(fitLabel(context, label, cellWidth - 8), x + 5, y + cellHeight - labelHeight + 1);
    if (caption) {
      context.fillStyle = '#c9f3b1';
      context.fillText(fitLabel(context, caption, cellWidth - 8), x + 5, y + cellHeight - 13);
    }
  }
  context.restore();
}

function fitLabel(context: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (context.measureText(value).width <= maxWidth) {
    return value;
  }
  let next = value;
  while (next.length > 4 && context.measureText(`${next}...`).width > maxWidth) {
    next = next.slice(0, -1);
  }
  return `${next}...`;
}
