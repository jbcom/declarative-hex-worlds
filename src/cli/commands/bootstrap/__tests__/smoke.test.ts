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
  KAYKIT_BOOTSTRAP_ROOT,
  KAYKIT_BOOTSTRAP_SIDECAR,
  KAYKIT_FREE_GITHUB_DEFAULT_REF,
  KAYKIT_FREE_GITHUB_OWNER,
  KAYKIT_FREE_GITHUB_REPO,
  bootstrapKayKitAssets,
  kayKitFreeGithubTarballUrl,
  resolveBootstrapGltfRoot,
  resolveBootstrapSidecarPath,
  resolveBootstrapTargetRoot,
  verifyBootstrap,
} from '../index';

describe('bootstrap programmatic surface', () => {
  it('exposes the canonical GitHub identifiers', () => {
    expect(KAYKIT_FREE_GITHUB_OWNER).toBe('KayKit-Game-Assets');
    expect(KAYKIT_FREE_GITHUB_REPO).toBe('KayKit-Medieval-Hexagon-Pack-1.0');
    expect(KAYKIT_FREE_GITHUB_DEFAULT_REF).toBe('main');
  });

  it('resolves the tarball URL for the default ref', () => {
    expect(kayKitFreeGithubTarballUrl()).toBe(
      'https://codeload.github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0/tar.gz/main'
    );
  });

  it('resolves the tarball URL for a pinned commit', () => {
    expect(kayKitFreeGithubTarballUrl('deadbeef')).toBe(
      'https://codeload.github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0/tar.gz/deadbeef'
    );
  });

  it('exposes the canonical bootstrap target conventions', () => {
    expect(KAYKIT_BOOTSTRAP_ROOT).toBe('addons/kaykit_medieval_hexagon_pack');
    expect(KAYKIT_BOOTSTRAP_GLTF_RELATIVE).toBe('Assets/gltf');
    expect(KAYKIT_BOOTSTRAP_SIDECAR).toBe('.bootstrap.json');
  });

  it('resolves bootstrap target paths from a consumer asset root', () => {
    const assetRoot = '/example/app/public/assets/models';
    expect(resolveBootstrapTargetRoot(assetRoot)).toBe(
      '/example/app/public/assets/models/addons/kaykit_medieval_hexagon_pack'
    );
    expect(resolveBootstrapGltfRoot(assetRoot)).toBe(
      '/example/app/public/assets/models/addons/kaykit_medieval_hexagon_pack/Assets/gltf'
    );
    expect(resolveBootstrapSidecarPath(assetRoot)).toBe(
      '/example/app/public/assets/models/addons/kaykit_medieval_hexagon_pack/.bootstrap.json'
    );
  });

  it('exposes bootstrapKayKitAssets + verifyBootstrap as async functions', () => {
    expect(typeof bootstrapKayKitAssets).toBe('function');
    expect(typeof verifyBootstrap).toBe('function');
  });
});
