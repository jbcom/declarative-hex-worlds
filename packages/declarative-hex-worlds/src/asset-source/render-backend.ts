/**
 * `src/asset-source/render-backend.ts` — the pluggable `RenderBackend` interface
 * (RFC 0001 RFC0-RENDER).
 *
 * A RenderBackend turns a resolved `AssetRenderRequest` (produced by the
 * backend-agnostic asset-source layer) into a backend-native scene node, and
 * manages that node's lifecycle + transform. It is the seam that lets the same
 * koota world + hex math + asset sources drive DIFFERENT renderers:
 *   - `src/three` is the reference 3D / 2.5D backend (three.js `Object3D`).
 *   - a future `src/pixi` backend would render the SAME requests as 2D sprites.
 *
 * The declarative surface (`<HexWorld backend={…}>`, `<Sprite>`/`<Model>`, the
 * hooks) is backend-agnostic — the consumer picks a backend the way they pick an
 * R3F `<Canvas>` vs a Pixi `<Stage>`. Dimensionality is carried on each request
 * (`dimension: '2d' | '3d'`) so a backend places/sorts/orients sprites and models
 * correctly, and a 2.5D backend can host both at once.
 *
 * This module is TYPE-ONLY (no three/pixi import) so it stays in the neutral core
 * and any backend can implement it.
 *
 * @module
 */
import type { GameboardPlacementSpec } from '../gameboard';
import type { AssetRenderRequest, AssetTransform } from './source';

/**
 * A backend-native node produced from a render request, tagged with the placement
 * it represents. `TNode` is the backend's scene-node type (three `Object3D`, a
 * Pixi `Container`, …). Carries enough to reconcile + pick without the backend
 * re-deriving it.
 */
export interface RenderedPlacement<TNode = unknown> {
  /** Placement id this node represents. */
  placementId: string;
  /** Asset id the node was produced from. */
  assetId: string;
  /** The backend-native scene node (added to the backend's scene/stage). */
  node: TNode;
  /** The render request this node was built from. */
  request: AssetRenderRequest;
  /** Last transform applied. */
  transform?: AssetTransform;
}

/**
 * The pluggable render contract. A backend implements this to render the
 * asset-source layer's requests. Implementations own their own loaders/caches;
 * the interface is intentionally small — mount, apply transform, and dispose.
 */
export interface RenderBackend<TNode = unknown, TParent = unknown> {
  /** Backend id, e.g. `'three'` or `'pixi'`. */
  readonly id: string;
  /** Which dimensions this backend can render. A 2.5D backend supports both. */
  readonly dimensions: readonly ('2d' | '3d')[];
  /**
   * Produce a backend-native node for a placement's render request and add it to
   * `parent`. Returns the tagged node, or `undefined` if the request can't be
   * rendered by this backend (e.g. a 3D request to a 2D-only backend).
   */
  mount(
    placement: GameboardPlacementSpec,
    request: AssetRenderRequest,
    parent: TParent
  ): Promise<RenderedPlacement<TNode> | undefined>;
  /** Apply a transform to a mounted node (position/rotation/scale). */
  applyTransform(rendered: RenderedPlacement<TNode>, transform: AssetTransform): void;
  /** Remove a mounted node from `parent` and dispose its backend resources. */
  unmount(rendered: RenderedPlacement<TNode>, parent: TParent): void;
}
