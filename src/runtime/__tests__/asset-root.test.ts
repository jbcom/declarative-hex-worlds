import { afterEach, describe, expect, it } from 'vitest';
import { freeManifest } from '../../manifest/free';
import {
  rewriteToBootstrapPath,
  resolveManifestAssetUrl,
} from '../../manifest/schema';
import type { MedievalHexagonAsset } from '../../types';
import {
  DEFAULT_GAMEBOARD_ASSET_ROOT,
  GAMEBOARD_ASSET_ROOT_ENV_VAR,
  GAMEBOARD_ASSET_ROOT_GLOBAL_KEY,
  gameboardAssetUrl,
  getGameboardAssetRootOverride,
  resolveGameboardAssetRoot,
  setGameboardAssetRoot,
} from '../asset-root';

interface GlobalWithAssetRoot {
  [GAMEBOARD_ASSET_ROOT_GLOBAL_KEY]?: string;
}

const PROBE_ASSET = firstAsset();

function firstAsset(): MedievalHexagonAsset {
  const asset = freeManifest.assets[0];
  if (!asset) {
    throw new Error('FREE manifest must have at least one asset');
  }
  return asset;
}

describe('runtime asset root resolution (PRD RB3)', () => {
  afterEach(() => {
    setGameboardAssetRoot(undefined);
    const ref = globalThis as GlobalWithAssetRoot;
    delete ref[GAMEBOARD_ASSET_ROOT_GLOBAL_KEY];
    delete process.env[GAMEBOARD_ASSET_ROOT_ENV_VAR];
  });

  it('defaults to public/assets/models (matches CLI --out heuristic)', () => {
    expect(resolveGameboardAssetRoot()).toBe(DEFAULT_GAMEBOARD_ASSET_ROOT);
    expect(DEFAULT_GAMEBOARD_ASSET_ROOT).toBe('public/assets/models');
  });

  it('honors a process-wide override set via setGameboardAssetRoot', () => {
    setGameboardAssetRoot('/abs/asset/root');
    expect(resolveGameboardAssetRoot()).toBe('/abs/asset/root');
    expect(getGameboardAssetRootOverride()).toBe('/abs/asset/root');
    setGameboardAssetRoot(undefined);
    expect(getGameboardAssetRootOverride()).toBeUndefined();
  });

  it('falls back to globalThis.HEX_WORLDS_ASSET_ROOT when no override is set', () => {
    const ref = globalThis as GlobalWithAssetRoot;
    ref[GAMEBOARD_ASSET_ROOT_GLOBAL_KEY] = '/cdn/assets';
    expect(resolveGameboardAssetRoot()).toBe('/cdn/assets');
  });

  it('falls back to process.env.HEX_WORLDS_ASSET_ROOT when no global is set', () => {
    process.env[GAMEBOARD_ASSET_ROOT_ENV_VAR] = '/env/assets';
    expect(resolveGameboardAssetRoot()).toBe('/env/assets');
  });

  it('priority: explicit override beats global beats env beats default', () => {
    const ref = globalThis as GlobalWithAssetRoot;
    ref[GAMEBOARD_ASSET_ROOT_GLOBAL_KEY] = '/from-global';
    process.env[GAMEBOARD_ASSET_ROOT_ENV_VAR] = '/from-env';
    setGameboardAssetRoot('/from-override');
    expect(resolveGameboardAssetRoot()).toBe('/from-override');
  });
});

describe('bootstrap path rewriting (PRD RB3)', () => {
  it('rewrites a legacy assets/free/... path under the bootstrap target', () => {
    expect(rewriteToBootstrapPath(PROBE_ASSET)).toBe(
      `addons/kaykit_medieval_hexagon_pack/Assets/gltf/${PROBE_ASSET.modelPath.slice('assets/free/'.length)}`
    );
  });

  it('resolveManifestAssetUrl uses bootstrapAssetRoot when no baseUrl is set', () => {
    const url = resolveManifestAssetUrl(PROBE_ASSET, {
      bootstrapAssetRoot: '/app/public/assets/models',
    });
    expect(url).toBe(
      `/app/public/assets/models/addons/kaykit_medieval_hexagon_pack/Assets/gltf/${PROBE_ASSET.modelPath.slice('assets/free/'.length)}`
    );
  });

  it('resolveManifestAssetUrl prefers baseUrl over bootstrapAssetRoot', () => {
    const url = resolveManifestAssetUrl(PROBE_ASSET, {
      baseUrl: 'https://cdn.example.com/',
      bootstrapAssetRoot: '/should/be/ignored',
    });
    expect(url).toBe(`https://cdn.example.com/${PROBE_ASSET.modelPath}`);
  });

  it('gameboardAssetUrl combines the resolved asset root with the rewritten path', () => {
    setGameboardAssetRoot('/runtime/root');
    expect(gameboardAssetUrl(PROBE_ASSET)).toBe(
      `/runtime/root/addons/kaykit_medieval_hexagon_pack/Assets/gltf/${PROBE_ASSET.modelPath.slice('assets/free/'.length)}`
    );
  });

  it('gameboardAssetUrl strips a trailing slash on the asset root', () => {
    setGameboardAssetRoot('/runtime/root/');
    expect(gameboardAssetUrl(PROBE_ASSET).startsWith('/runtime/root/addons/')).toBe(true);
    expect(gameboardAssetUrl(PROBE_ASSET)).not.toContain('//addons');
  });
});
