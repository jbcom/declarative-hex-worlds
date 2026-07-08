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
import type { WorldPosition } from '../types';

/**
 * The dimensionality of a rendered asset — a first-class concept so a backend
 * (three for 3D/2.5D, a future Pixi backend for 2D) knows how to place, sort, and
 * orient it. A `'3d'` asset is a volumetric mesh; a `'2d'` asset is a planar sprite
 * whose depth is a z-order, not a world Y. `<Model>` is 3D-first, `<Sprite>` 2D-first,
 * and both can coexist on one board (2.5D).
 */
export type AssetDimension = '2d' | '3d';

/**
 * Render transform for a placement, in world space. Neutral of any renderer
 * (moved here from `src/three` for RFC0-RENDER so the render-request contract is
 * backend-agnostic). A 3D backend uses the full x/y/z + rotationY; a 2D backend
 * projects to screen space and treats the depth axis as z-order.
 */
export interface AssetTransform {
  /** World-space position for the object origin. */
  position: WorldPosition;
  /** Y-axis rotation in radians (the board-plane rotation both 2D and 3D share). */
  rotationY: number;
  /** Uniform scale. */
  scale: number;
}

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
 * A multiplicative RGB tint applied to a rendered placement. Each channel is in
 * `[0, 1]`; white (`{ r: 1, g: 1, b: 1 }`) is the identity (no change). Because
 * it multiplies the sampled texel colour, it lets a consuming GAME shade a shared
 * tileset atlas per placement WITHOUT re-authoring art:
 *   - fog-of-war: dim explored-but-unseen tiles toward grey (`{r:.5,g:.5,b:.5}`);
 *   - season: warm autumn (`{r:1,g:.85,b:.6}`) or cool winter wash over the board;
 *   - team/ownership: tint a captured tile toward the owner's colour.
 * The tint is a render concern — the sim stores the intent, the binding applies
 * it to the material's `color`, and the same atlas serves every shading state.
 */
export interface AssetTint {
  /** Red channel multiplier, `[0, 1]`. */
  r: number;
  /** Green channel multiplier, `[0, 1]`. */
  g: number;
  /** Blue channel multiplier, `[0, 1]`. */
  b: number;
}

/**
 * A resolved, renderer-agnostic render request. A renderer BINDING (the
 * `declarative-hex-worlds/three` subpath today, `/pixi` tomorrow) subscribes to
 * the koota placement signals and dispatches on `type` + `dimension` to reconcile
 * its own scene nodes. New source kinds add new members here (a discriminated
 * union), and each binding grows a matching arm. Every request carries its
 * `dimension` so a binding can place/sort/orient a 2D sprite and a 3D model
 * correctly on the same board.
 */
export type AssetRenderRequest =
  | {
      type: 'gltf';
      dimension: '3d';
      url: string;
      transform?: AssetTransform;
      /**
       * Optional per-placement multiplicative tint (fog/season/team shading). White
       * ⇒ identity. Applied by the binding to the resolved object's material colour.
       */
      tint?: AssetTint;
      /**
       * Optional per-placement opacity in `[0, 1]`. `< 1` makes the placement
       * translucent (e.g. a fog shroud over an explored tile); omitted or `>= 1`
       * leaves it fully opaque.
       */
      opacity?: number;
    }
  | {
      type: 'tileset-cell';
      dimension: '2d';
      sheetUrl: string;
      cell: CellRect;
      hex: HexDims;
      /**
       * Optional per-placement multiplicative tint (fog/season/team shading). White
       * ⇒ identity. Multiplies the sampled cell colour, so one atlas serves every
       * shading state without re-authoring art.
       */
      tint?: AssetTint;
      /**
       * Optional per-placement opacity in `[0, 1]`. `< 1` makes the cell translucent
       * (e.g. a fog shroud over an explored tile); omitted or `>= 1` leaves the
       * opaque-queue path (seamless cutout tessellation) unchanged.
       */
      opacity?: number;
      /**
       * How the sheet cell is drawn onto the board plane:
       *   - `'quad'` (default): the FULL cell rect is drawn as a rectangle spanning
       *     `hex.width × hex.height`. Painterly hex atlases (e.g. JackleEarth) paint
       *     each cell as a flattened hex with TRANSPARENT corners — a full quad lets
       *     neighbouring cells' opaque bodies fill each other's transparent corners,
       *     so the board tessellates SEAMLESSLY into continuous terrain. This is what
       *     the canvas-2D binding already does (`drawImage` blits the whole cell), so
       *     `'quad'` makes the 3D binding match.
       *   - `'hex'`: the cell is clipped to a hexagon silhouette (UV-mapped to the
       *     cell). Use only for sheets whose cells are opaque edge-to-edge and must
       *     NOT bleed past the hex outline. Leaves gaps for transparent-corner art.
       * Omitted ⇒ `'quad'`.
       */
      shape?: 'quad' | 'hex';
      transform?: AssetTransform;
    };

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
 * Compose sources into one first-match `AssetSource`: the first source to resolve
 * a placement (or edge) wins. Returns the single source directly, or `undefined`
 * for an empty list. Renderer-neutral, so it lives in the core alongside the
 * `AssetSource` contract (a binding then registers the composite). Re-exported from
 * `declarative-hex-worlds/react-elements` for back-compat.
 */
export function combineSources(sources: readonly AssetSource[]): AssetSource | undefined {
  if (sources.length === 0) {
    return undefined;
  }
  if (sources.length === 1) {
    return sources[0];
  }
  return {
    kind: 'composite',
    resolve(placement, ctx) {
      for (const source of sources) {
        const request = source.resolve(placement, ctx);
        if (request) {
          return request;
        }
      }
      return undefined;
    },
    resolveEdge(assetId, edgeMask, ctx) {
      for (const source of sources) {
        const request = source.resolveEdge?.(assetId, edgeMask, ctx);
        if (request) {
          return request;
        }
      }
      return undefined;
    },
  };
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
