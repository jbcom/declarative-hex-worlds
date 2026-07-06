/**
 * `src/asset-source/source.ts` — the runtime `AssetSource` interface (RFC 0001
 * G1 / RFC0-7).
 *
 * An `AssetSource` describes how a placement's `assetId` (+ optional edge mask /
 * variant seed) resolves to something renderable, INDEPENDENT of what that
 * renderable is: a GLTF model today, a tileset cell (G2), or a future kind. It
 * is the resolution seam that lets one board render KayKit GLTF packs, PNG
 * tilesets, or a consumer's own assets through a single contract.
 *
 * The `src/three` bridge dispatches on `AssetRenderRequest.type`:
 *   - `'gltf'`         → the existing `loadGameboardPlacementObject` path.
 *   - `'tileset-cell'` → the new textured-hex-mesh path (RFC0-8).
 *
 * See `docs/plans/declarative-render-surface.design.md` for the full design.
 *
 * @module
 */

import type { GameboardPlacementSpec } from '../gameboard';
import type { AssetTransform } from '../three';

/**
 * A rectangular sub-region of a sprite/tile sheet, in pixels. The origin is the
 * sheet's top-left; `x`/`y` locate the cell's top-left corner.
 */
export interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The rendered hex's world-space footprint, used to build a textured-hex mesh
 * whose proportions match the source sheet's cell. Both are in world units.
 */
export interface HexDims {
  width: number;
  height: number;
}

/**
 * A resolved, engine-facing render request. The `src/three` bridge dispatches on
 * `type`. New source kinds add new members here (a discriminated union), and the
 * bridge grows a matching arm.
 */
export type AssetRenderRequest =
  | { type: 'gltf'; url: string; transform?: AssetTransform }
  | { type: 'tileset-cell'; sheetUrl: string; cell: CellRect; hex: HexDims; transform?: AssetTransform };

/**
 * Context passed to an `AssetSource` when resolving a placement. Carries the
 * optional asset-root base URL (for resolving relative sheet/model paths) and is
 * open for future resolution inputs without changing the interface signature.
 */
export interface ResolveContext {
  /** Base URL for resolving a source's relative asset paths (models, sheets). */
  baseUrl?: string | URL;
}

/**
 * The resolution contract. An implementation turns a placement (and, for
 * transition tiles, an edge mask) into an `AssetRenderRequest` the render bridge
 * understands — or `undefined` when this source can't resolve it (letting a
 * caller fall through to another source or a default).
 */
export interface AssetSource {
  /** Source kind. Built-ins: `'gltf-pack'`, `'tileset'`. Open for extension. */
  readonly kind: 'gltf-pack' | 'tileset' | (string & {});
  /** Resolve a placement to a render request. */
  resolve(placement: GameboardPlacementSpec, ctx?: ResolveContext): AssetRenderRequest | undefined;
  /**
   * Optional: resolve a transition tile's edge mask to a concrete cell/variant
   * (G3). A GLTF pack returns a coast-model URL; a tileset returns a positional
   * cell. Sources without positional transitions omit this.
   */
  resolveEdge?(
    assetId: string,
    edgeMask: number,
    ctx?: ResolveContext
  ): AssetRenderRequest | undefined;
}
