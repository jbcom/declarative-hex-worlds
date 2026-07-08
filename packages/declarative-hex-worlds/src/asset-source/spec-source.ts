/**
 * `src/asset-source/spec-source.ts` — instantiate a live `AssetSource` from a
 * validated `AssetSourceSpec` (RFC 0001 G0 completion).
 *
 * The `bind` CLI scans an asset directory into a canonical `AssetSourceSpec` JSON;
 * a bundled pack ships the same shape. Until now that spec was WRITE-ONLY — nothing
 * turned it back into a runtime `AssetSource`, so a consumer who ran `bind` (or
 * downloaded a pack spec) had no way to actually render from it. `createSourceFromSpec`
 * closes that loop: it dispatches the spec's assets by role into the matching source
 * (tileset → `createTilesetSource`, model/tile-glb → `createGltfPackSource`) and
 * composes them first-match via `combineSources`. Pure of any renderer.
 *
 * @module
 */

import { createGltfPackSource } from './gltf-pack';
import type { AssetSource } from './source';
import { combineSources } from './source';
import type { AssetSourceSpec, AssetSpec } from './spec';
import { createTilesetSource } from './tileset';
import {
  type TilesetManifest,
  type TilesetSheet,
  tilesetManifestSchema,
} from './tileset-manifest';

/** Options for `createSourceFromSpec`. */
export interface CreateSourceFromSpecOptions {
  /**
   * How each tileset cell is drawn (see `AssetRenderRequest['shape']`). Defaults to
   * the tileset source's own default (`'quad'`).
   */
  tilesetShape?: 'quad' | 'hex';
}

/** True for the tileset-role assets a `TilesetManifest` is built from. */
function isTilesetAsset(asset: AssetSpec): asset is Extract<AssetSpec, { role: 'tileset' }> {
  return asset.role === 'tileset';
}

/** True for the assets the gltf-pack source resolves (models + glb/gltf tiles). */
function isGltfAsset(asset: AssetSpec): boolean {
  return asset.role === 'model' || (asset.role === 'tile' && asset.format !== 'png');
}

/**
 * Build a `TilesetManifest` from a spec's tileset-role assets. Each tileset asset
 * becomes a sheet (keyed by its id); a `fill` biome is registered for its `biome`
 * key, and `transition.edgeCells` carry through to a `transition`-role sheet so
 * `resolveEdge` works off the spec.
 */
function manifestFromTilesetAssets(
  assets: ReadonlyArray<Extract<AssetSpec, { role: 'tileset' }>>
): TilesetManifest | undefined {
  if (assets.length === 0) {
    return undefined;
  }
  const sheets: Record<string, TilesetSheet> = {};
  const biomes: TilesetManifest['biomes'] = {};
  for (const asset of assets) {
    const isTransition = asset.transition !== undefined;
    sheets[asset.id] = {
      url: asset.path,
      grid: asset.grid,
      role: isTransition ? 'transition' : 'fill',
      ...(asset.transition ? { edgeCells: asset.transition.edgeCells } : {}),
    };
    if (isTransition) {
      // resolveEdge(assetId, mask) looks up manifest.biomes[assetId] → sheet, so a
      // transition sheet needs a biome entry keyed by its OWN id (the assetId a
      // transition placement carries).
      biomes[asset.id] = { sheet: asset.id, select: 'first' };
    } else if (asset.biome !== undefined) {
      // A fill sheet with a biome registers that biome → this sheet (hash-select).
      biomes[asset.biome] = { sheet: asset.id, select: 'hash' };
    }
  }
  // Validate the assembled manifest so a malformed spec fails here, not in render.
  return tilesetManifestSchema.parse({ schemaVersion: '1', kind: 'tileset', sheets, biomes });
}

/**
 * Create a live `AssetSource` from a validated `AssetSourceSpec`. Composes a tileset
 * source (from tileset-role assets) and a gltf-pack source (from model + glb/gltf
 * tile assets) first-match. Sprite-role assets are carried for a future sprite
 * source; today they resolve through the gltf/tileset arms only if they match, else
 * fall through. Returns `undefined` only when the spec yields no resolvable source.
 */
export function createSourceFromSpec(
  spec: AssetSourceSpec,
  options: CreateSourceFromSpecOptions = {}
): AssetSource | undefined {
  const sources: AssetSource[] = [];

  const manifest = manifestFromTilesetAssets(spec.assets.filter(isTilesetAsset));
  if (manifest) {
    sources.push(
      createTilesetSource({
        manifest,
        ...(options.tilesetShape ? { shape: options.tilesetShape } : {}),
      })
    );
  }

  // gltf-pack resolves by explicit assetId→URL map built from the spec's model +
  // glb/gltf tile assets (paths are relative to the spec's assetRoot; a consumer's
  // ResolveContext.baseUrl composes the absolute URL at resolve time).
  const gltfAssets = spec.assets.filter(isGltfAsset);
  if (gltfAssets.length > 0) {
    const assetUrls: Record<string, string> = {};
    for (const asset of gltfAssets) {
      assetUrls[asset.id] = asset.path;
    }
    sources.push(createGltfPackSource({ assetUrls, baseUrl: spec.assetRoot }));
  }

  return combineSources(sources);
}
