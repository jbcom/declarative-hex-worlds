/**
 * Bootstrap target path conventions shared by {@link bootstrapKayKitAssets},
 * {@link verifyBootstrap}, and the runtime asset URL resolvers.
 *
 * @module
 */
import { join } from 'node:path';
import { BOOTSTRAP_PATHS } from '../../../config';

/**
 * Sub-folder under the consumer's asset root holding the mirrored GLTF tree.
 * Empty string means GLTFs land directly in the asset root (flat layout).
 */
export const KAYKIT_BOOTSTRAP_GLTF_RELATIVE = BOOTSTRAP_PATHS.gltfRelative;

/**
 * Sub-folder under the consumer's asset root holding mirrored shared textures.
 */
export const KAYKIT_BOOTSTRAP_TEXTURE_RELATIVE = BOOTSTRAP_PATHS.textureRelative;

/**
 * Filename of the integrity sidecar written into each bootstrap target.
 */
export const KAYKIT_BOOTSTRAP_SIDECAR = BOOTSTRAP_PATHS.sidecarFileName;

/**
 * Resolve the absolute path to a bootstrap target's GLTF tree root.
 * With the flat layout (gltfRelative = ""), this is the asset root itself.
 */
export function resolveBootstrapGltfRoot(assetRoot: string): string {
  if (!KAYKIT_BOOTSTRAP_GLTF_RELATIVE) {
    return assetRoot;
  }
  return join(assetRoot, KAYKIT_BOOTSTRAP_GLTF_RELATIVE);
}

/**
 * Resolve the absolute path to a bootstrap target's integrity sidecar.
 */
export function resolveBootstrapSidecarPath(assetRoot: string): string {
  return join(assetRoot, KAYKIT_BOOTSTRAP_SIDECAR);
}
