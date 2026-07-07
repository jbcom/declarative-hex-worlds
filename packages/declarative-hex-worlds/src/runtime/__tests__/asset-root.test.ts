import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('defaults to models (flat bootstrap layout default)', () => {
    expect(resolveGameboardAssetRoot()).toBe(DEFAULT_GAMEBOARD_ASSET_ROOT);
    expect(DEFAULT_GAMEBOARD_ASSET_ROOT).toBe('models');
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

  it('uses the default root when process is unavailable', () => {
    const originalProcess = globalThis.process;
    vi.stubGlobal('process', undefined);
    try {
      expect(resolveGameboardAssetRoot()).toBe(DEFAULT_GAMEBOARD_ASSET_ROOT);
    } finally {
      vi.stubGlobal('process', originalProcess);
    }
  });

  it('priority: explicit override beats global beats env beats default', () => {
    const ref = globalThis as GlobalWithAssetRoot;
    ref[GAMEBOARD_ASSET_ROOT_GLOBAL_KEY] = '/from-global';
    process.env[GAMEBOARD_ASSET_ROOT_ENV_VAR] = '/from-env';
    setGameboardAssetRoot('/from-override');
    expect(resolveGameboardAssetRoot()).toBe('/from-override');
  });
});

describe('bootstrap path rewriting (PRD RB3 — flat layout)', () => {
  it('rewriteToBootstrapPath is identity — returns sourcePath directly', () => {
    expect(rewriteToBootstrapPath(PROBE_ASSET)).toBe(PROBE_ASSET.sourcePath);
  });

  it('resolveManifestAssetUrl uses bootstrapAssetRoot + sourcePath (flat layout)', () => {
    const url = resolveManifestAssetUrl(PROBE_ASSET, {
      bootstrapAssetRoot: '/app/public/models',
    });
    expect(url).toBe(`/app/public/models/${PROBE_ASSET.sourcePath}`);
  });

  it('resolveManifestAssetUrl prefers baseUrl over bootstrapAssetRoot', () => {
    const url = resolveManifestAssetUrl(PROBE_ASSET, {
      baseUrl: 'https://cdn.example.com/',
      bootstrapAssetRoot: '/should/be/ignored',
    });
    expect(url).toBe(`https://cdn.example.com/${PROBE_ASSET.sourcePath}`);
  });

  it('gameboardAssetUrl combines the resolved asset root with sourcePath', () => {
    setGameboardAssetRoot('/runtime/root');
    expect(gameboardAssetUrl(PROBE_ASSET)).toBe(`/runtime/root/${PROBE_ASSET.sourcePath}`);
  });

  it('gameboardAssetUrl strips a trailing slash on the asset root', () => {
    setGameboardAssetRoot('/runtime/root/');
    expect(gameboardAssetUrl(PROBE_ASSET)).not.toContain('//');
    expect(gameboardAssetUrl(PROBE_ASSET)).toBe(`/runtime/root/${PROBE_ASSET.sourcePath}`);
  });
});
