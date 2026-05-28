/**
 * Runtime asset-root resolution for consumers of bootstrapped KayKit assets
 * (PRD RB3).
 *
 * After running `declarative-hex-worlds bootstrap`, consumers point the
 * runtime at their chosen asset root via one of:
 *
 * 1. Per-call options on the rendering helpers (e.g.
 *    `resolveManifestAssetUrl(asset, { bootstrapAssetRoot })`).
 * 2. The global override {@link setGameboardAssetRoot} (useful for app-wide
 *    config at boot).
 * 3. `globalThis.HEX_WORLDS_ASSET_ROOT` if the app sets it before any
 *    loader runs.
 * 4. `process.env.HEX_WORLDS_ASSET_ROOT` for Node consumers / CLI users.
 * 5. The default `public/assets/models` (matches the CLI's default `--out`).
 *
 * The resolution order is 1 → 5; the first value found wins.
 *
 * @module
 */

import {
  rewriteToBootstrapPath,
  type MedievalHexagonAsset,
} from '../manifest';

/**
 * Default consumer asset root when no override is configured. Consumers set
 * this via `HEX_WORLDS_ASSET_ROOT` env var or `setGameboardAssetRoot` to match
 * their framework's static-file root (e.g. `public/models` for Vite). The bare
 * `'models'` default works for CLI/Node consumers where the process CWD is the
 * project root and bootstrap outputs to `./models`.
 */
export const DEFAULT_GAMEBOARD_ASSET_ROOT = 'models';

/**
 * Environment variable name read by {@link resolveGameboardAssetRoot} when no
 * higher-priority override is configured.
 */
export const GAMEBOARD_ASSET_ROOT_ENV_VAR = 'HEX_WORLDS_ASSET_ROOT';

/**
 * Property on `globalThis` consulted by {@link resolveGameboardAssetRoot}
 * before falling back to the env var.
 */
export const GAMEBOARD_ASSET_ROOT_GLOBAL_KEY = 'HEX_WORLDS_ASSET_ROOT';

interface GlobalWithAssetRoot {
  [GAMEBOARD_ASSET_ROOT_GLOBAL_KEY]?: string;
}

let processOverride: string | undefined;

/**
 * Set an explicit process-wide asset root. Pass `undefined` to clear the
 * override and fall back to the global / env / default chain.
 */
export function setGameboardAssetRoot(assetRoot: string | undefined): void {
  processOverride = assetRoot;
}

/**
 * Returns the currently configured process-wide asset root override, if any.
 */
export function getGameboardAssetRootOverride(): string | undefined {
  return processOverride;
}

/**
 * Resolve the consumer's bootstrap asset root using the documented priority
 * chain. The return value is always a string (never undefined) — callers can
 * always feed it as `bootstrapAssetRoot` to the manifest URL resolver
 * exported from `declarative-hex-worlds/manifest`.
 */
export function resolveGameboardAssetRoot(): string {
  if (processOverride !== undefined) {
    return processOverride;
  }
  const globalRef = globalThis as GlobalWithAssetRoot;
  const fromGlobal = globalRef[GAMEBOARD_ASSET_ROOT_GLOBAL_KEY];
  if (typeof fromGlobal === 'string' && fromGlobal.length > 0) {
    return fromGlobal;
  }
  const fromEnv = typeof process !== 'undefined' ? process.env?.[GAMEBOARD_ASSET_ROOT_ENV_VAR] : undefined;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) {
    return fromEnv;
  }
  return DEFAULT_GAMEBOARD_ASSET_ROOT;
}

/**
 * Convenience wrapper: returns the URL of `asset` under the resolved
 * bootstrap asset root. Equivalent to
 * `joinUrl(resolveGameboardAssetRoot(), rewriteToBootstrapPath(asset))`.
 */
export function gameboardAssetUrl(asset: MedievalHexagonAsset): string {
  const root = resolveGameboardAssetRoot();
  const path = rewriteToBootstrapPath(asset);
  return `${stripTrailingSlash(root)}/${path}`;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
