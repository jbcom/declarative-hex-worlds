/**
 * Bootstrap target path conventions shared by {@link bootstrapKayKitAssets},
 * {@link verifyBootstrap}, and the runtime asset URL resolvers.
 *
 * @module
 */
import { join } from 'node:path';
import { BOOTSTRAP_PATHS } from '../../../config';

/**
 * Sub-folder under the consumer's asset root that owns a bootstrapped pack.
 *
 * Mirrors the canonical "addons" convention used by Godot/Blender consumer
 * apps so multiple bootstrapped packs can coexist under a single asset root.
 */
export const KAYKIT_BOOTSTRAP_ROOT = BOOTSTRAP_PATHS.root;

/**
 * Sub-folder under {@link KAYKIT_BOOTSTRAP_ROOT} holding the mirrored GLTF
 * tree. Matches the upstream `Assets/gltf/` layout exactly.
 */
export const KAYKIT_BOOTSTRAP_GLTF_RELATIVE = BOOTSTRAP_PATHS.gltfRelative;

/**
 * Sub-folder under {@link KAYKIT_BOOTSTRAP_ROOT} holding mirrored shared
 * textures.
 */
export const KAYKIT_BOOTSTRAP_TEXTURE_RELATIVE = BOOTSTRAP_PATHS.textureRelative;

/**
 * Filename of the integrity sidecar written into each bootstrap target.
 */
export const KAYKIT_BOOTSTRAP_SIDECAR = BOOTSTRAP_PATHS.sidecarFileName;

/**
 * Resolve the absolute path to a bootstrap target's root directory from a
 * consumer's asset root.
 */
export function resolveBootstrapTargetRoot(assetRoot: string): string {
  return join(assetRoot, KAYKIT_BOOTSTRAP_ROOT);
}

/**
 * Resolve the absolute path to a bootstrap target's GLTF tree root from a
 * consumer's asset root.
 */
export function resolveBootstrapGltfRoot(assetRoot: string): string {
  return join(resolveBootstrapTargetRoot(assetRoot), KAYKIT_BOOTSTRAP_GLTF_RELATIVE);
}

/**
 * Resolve the absolute path to a bootstrap target's integrity sidecar.
 */
export function resolveBootstrapSidecarPath(assetRoot: string): string {
  return join(resolveBootstrapTargetRoot(assetRoot), KAYKIT_BOOTSTRAP_SIDECAR);
}
