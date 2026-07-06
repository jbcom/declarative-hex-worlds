/**
 * Gameboard asset lookup and semantic prop-cluster helpers.
 *
 * @module
 */
import { describeKayKitAssetTreatment, type PropAssetId } from '../scenario';
import type { MedievalHexagonAsset, MedievalHexagonManifest } from '../types';
import type { GameboardPlacementSpec, PropClusterKind } from './plan';

const PROP_CLUSTER_ASSETS = {
  camp: ['tent', 'barrel', 'sack', 'bucket_empty', 'crate_A_small', 'crate_B_small'],
  'harbor-support': ['anchor', 'boat', 'boatrack', 'barrel', 'crate_long_A', 'crate_long_B', 'crate_open'],
  'resource-cache': [
    'resource_lumber',
    'resource_stone',
    'crate_A_big',
    'crate_B_big',
    'crate_long_A',
    'crate_long_B',
    'crate_long_C',
    'crate_open',
    'sack',
    'barrel',
    'pallet',
    'wheelbarrow',
  ],
  'stable-yard': ['haybale', 'trough', 'trough_long', 'bucket_water', 'barrel'],
  'training-yard': ['target', 'weaponrack', 'bucket_arrows', 'icon_combat', 'icon_range', 'cannonball_pallet'],
  worksite: [
    'ladder',
    'pallet',
    'wheelbarrow',
    'bucket_empty',
    'bucket_water',
    'crate_long_empty',
    'resource_lumber',
    'resource_stone',
    'barrel',
  ],
} as const satisfies Record<PropClusterKind, readonly PropAssetId[]>;

/**
 * Resolve a placement's asset from a manifest.
 */
export function getPlacementAsset(
  placement: Pick<GameboardPlacementSpec, 'assetId'>,
  manifest: MedievalHexagonManifest
): MedievalHexagonAsset | undefined {
  return manifest.assetsById[placement.assetId];
}

/**
 * Resolve a placement's asset from the packaged FREE manifest.
 */
export async function loadPlacementAsset(
  placement: Pick<GameboardPlacementSpec, 'assetId'>
): Promise<MedievalHexagonAsset | undefined> {
  // biome-ignore lint/style/noRestrictedImports: the manifest barrel statically pulls the FREE manifest into dist/gameboard.js.
  const { loadFreeManifest } = await import('../manifest/free');
  return getPlacementAsset(placement, await loadFreeManifest());
}

/**
 * Return whether an asset id requires a local EXTRA edition asset.
 */
export function requiresExtraAsset(assetId: string): boolean {
  return describeKayKitAssetTreatment(assetId)?.requiresExtra ?? true;
}

/**
 * List the default prop assets used by a semantic cluster kind.
 */
export function listPropClusterAssets(
  kind: PropClusterKind,
  options: { includeExtra?: boolean } = {}
): readonly PropAssetId[] {
  const assets = PROP_CLUSTER_ASSETS[kind];
  if (options.includeExtra) {
    return assets;
  }
  return assets.filter((assetId) => !requiresExtraAsset(assetId));
}
