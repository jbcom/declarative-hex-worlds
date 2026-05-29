/**
 * Smoke coverage for the bootstrap programmatic API.
 *
 * Pin-down test that the surface exists, exports the right shape, and the
 * pure helpers (URL formatting, target path resolution) behave as documented.
 * Full extraction / mirroring coverage lives in `bootstrap.test.ts` (RB5).
 */
import { describe, expect, it } from 'vitest';
import {
  KAYKIT_BOOTSTRAP_GLTF_RELATIVE,
  KAYKIT_BOOTSTRAP_SIDECAR,
  KAYKIT_FREE_GITHUB_DEFAULT_REF,
  KAYKIT_FREE_GITHUB_OWNER,
  KAYKIT_FREE_GITHUB_REPO,
  bootstrapKayKitAssets,
  kayKitFreeGithubTarballUrl,
  resolveBootstrapGltfRoot,
  resolveBootstrapSidecarPath,
  verifyBootstrap,
} from '../index';

describe('bootstrap programmatic surface', () => {
  it('exposes the canonical GitHub identifiers', () => {
    expect(KAYKIT_FREE_GITHUB_OWNER).toBe('KayKit-Game-Assets');
    expect(KAYKIT_FREE_GITHUB_REPO).toBe('KayKit-Medieval-Hexagon-Pack-1.0');
    expect(KAYKIT_FREE_GITHUB_DEFAULT_REF).toBe('main');
  });

  it('resolves the stable archive zip URL for the default ref', () => {
    expect(kayKitFreeGithubTarballUrl()).toBe(
      'https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0/archive/refs/heads/main.zip'
    );
  });

  it('resolves the stable archive zip URL for a pinned ref', () => {
    expect(kayKitFreeGithubTarballUrl('deadbeef')).toBe(
      'https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0/archive/refs/heads/deadbeef.zip'
    );
  });

  it('exposes the flat bootstrap target conventions (gltfRelative is empty string)', () => {
    expect(KAYKIT_BOOTSTRAP_GLTF_RELATIVE).toBe('');
    expect(KAYKIT_BOOTSTRAP_SIDECAR).toBe('.bootstrap.json');
  });

  it('resolves bootstrap target paths from a consumer asset root (flat layout)', () => {
    const assetRoot = '/example/app/public/models';
    // With flat layout, gltfRoot === assetRoot
    expect(resolveBootstrapGltfRoot(assetRoot)).toBe('/example/app/public/models');
    expect(resolveBootstrapSidecarPath(assetRoot)).toBe('/example/app/public/models/.bootstrap.json');
  });

  it('exposes bootstrapKayKitAssets + verifyBootstrap as async functions', () => {
    expect(typeof bootstrapKayKitAssets).toBe('function');
    expect(typeof verifyBootstrap).toBe('function');
  });

  it('rejects a ref with unsafe characters (CWE-74 guard)', () => {
    expect(() => kayKitFreeGithubTarballUrl('../../etc/passwd')).toThrow(/unsafe git ref rejected/);
    expect(() => kayKitFreeGithubTarballUrl('main; rm -rf /')).toThrow(/unsafe git ref rejected/);
    expect(() => kayKitFreeGithubTarballUrl('a'.repeat(201))).toThrow(/unsafe git ref rejected/);
    expect(() => kayKitFreeGithubTarballUrl('.hidden')).toThrow(/unsafe git ref rejected/);
    expect(() => kayKitFreeGithubTarballUrl('main/')).toThrow(/unsafe git ref rejected/);
  });
});
