/**
 * `src/asset-source/gltf-pack.ts` — the `gltf-pack` AssetSource (RFC 0001
 * RFC0-7).
 *
 * Wraps today's placement→model-URL resolution (`resolveGameboardPlacementAssetUrl`)
 * behind the generic `AssetSource` interface, emitting a `{ type: 'gltf' }`
 * render request. This is the first source impl and a pure refactor: the
 * existing `src/three` URL-resolution + load path is unchanged; this source only
 * adapts it to the `AssetSource.resolve` shape so the declarative render surface
 * (RFC0-8) and future sources can dispatch uniformly.
 *
 * @module
 */

import type { GameboardPlacementSpec } from '../gameboard';
import {
  type GameboardPlacementAssetUrlOptions,
  resolveGameboardPlacementAssetUrl,
  transformForPlacement,
} from './placement-resolution';
import type { AssetRenderRequest, AssetSource, ResolveContext } from './source';

/**
 * Options for a gltf-pack source: the same URL-resolution options the three
 * bridge already accepts (explicit maps, manifest catalog, fallback resolver).
 */
export type GltfPackSourceOptions = GameboardPlacementAssetUrlOptions;

/**
 * Create a `gltf-pack` AssetSource. Resolves a placement to a `{ type: 'gltf' }`
 * request via the existing URL resolver + placement transform, or `undefined`
 * when no URL resolves (letting the caller fall through).
 */
export function createGltfPackSource(options: GltfPackSourceOptions = {}): AssetSource {
  return {
    kind: 'gltf-pack',
    resolve(
      placement: GameboardPlacementSpec,
      ctx?: ResolveContext
    ): AssetRenderRequest | undefined {
      const resolveOptions: GameboardPlacementAssetUrlOptions =
        ctx?.baseUrl === undefined
          ? options
          : { ...options, baseUrl: options.baseUrl ?? ctx.baseUrl };
      const url = resolveGameboardPlacementAssetUrl(placement, resolveOptions);
      if (!url) {
        return undefined;
      }
      return { type: 'gltf', dimension: '3d', url, transform: transformForPlacement(placement) };
    },
  };
}
