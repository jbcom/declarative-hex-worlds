/**
 * `src/three/three-backend.ts` — the reference three.js `RenderBackend`
 * (RFC 0001 RFC0-RENDER).
 *
 * Adapts the existing three bridge (`loadGameboardPlacementObject`,
 * `applyTransform`) to the backend-agnostic `RenderBackend` contract, so the
 * declarative surface can render through a pluggable backend. This is the 2.5D
 * reference impl: it renders BOTH `dimension:'3d'` (GLTF meshes) and
 * `dimension:'2d'` (tileset-cell textured hexes), placed in one three scene.
 *
 * @module
 */
import type { Object3D } from 'three';
import type {
  AssetRenderRequest,
  AssetSource,
  AssetTransform,
  RenderBackend,
  RenderedPlacement,
} from '../asset-source';
import type { GameboardPlacementSpec } from '../gameboard';
import {
  type GameboardGltfLoader,
  type GameboardSheetTextureLoader,
  applyTransform,
  loadGameboardPlacementObject,
} from './three';

/** Options for the three backend: the loaders the bridge needs + an optional source. */
export interface ThreeRenderBackendOptions {
  loader: GameboardGltfLoader;
  textureLoader?: GameboardSheetTextureLoader;
  /**
   * The asset source used to turn a placement into a render request. When the
   * backend's `mount` is handed a request directly, this drives the fallback
   * load path (the bridge resolves the request itself from the source).
   */
  source?: AssetSource;
  baseUrl?: string | URL;
}

/**
 * Create the three.js `RenderBackend`. `mount` loads a placement's object through
 * the existing bridge (which already dispatches gltf vs tileset-cell), returning
 * a tagged three `Object3D`; `applyTransform` positions it; `unmount` detaches it.
 */
export function createThreeRenderBackend(
  options: ThreeRenderBackendOptions
): RenderBackend<Object3D, Object3D> {
  return {
    id: 'three',
    dimensions: ['2d', '3d'],
    async mount(
      placement: GameboardPlacementSpec,
      _request: AssetRenderRequest,
      parent: Object3D
    ): Promise<RenderedPlacement<Object3D> | undefined> {
      const loaded = await loadGameboardPlacementObject(placement, {
        loader: options.loader,
        ...(options.source === undefined ? {} : { source: options.source }),
        ...(options.textureLoader === undefined ? {} : { textureLoader: options.textureLoader }),
        ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
      });
      parent.add(loaded.object);
      return {
        placementId: loaded.placementId,
        assetId: loaded.assetId,
        node: loaded.object,
        request: _request,
        transform: loaded.transform,
      };
    },
    applyTransform(rendered: RenderedPlacement<Object3D>, transform: AssetTransform): void {
      applyTransform(rendered.node, transform);
      rendered.transform = transform;
    },
    unmount(rendered: RenderedPlacement<Object3D>, parent: Object3D): void {
      parent.remove(rendered.node);
    },
  };
}
