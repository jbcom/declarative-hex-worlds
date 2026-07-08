/**
 * Browser (real-Chromium) config for the examples' LOCAL third-party-asset E2E
 * (`src/three/__tests__/third-party-assets.test.ts`).
 *
 * @remarks
 * This test exercises the "foreign-maker asset" story that the FREE default pack
 * cannot: a non-hex-footprint Kenney piece flagged as a prop, and a rigged KayKit
 * Adventurers unit whose animation lives in a SEPARATE retargeting file. Those
 * packs are large licensed local assets — NEVER downloaded by the default
 * bootstrap and NEVER tracked in git. They resolve from the NAS asset library
 * (or an explicit env override), and the test `skipIf`s itself when a root is
 * absent (e.g. CI without the NAS mounted) rather than corrupting baselines.
 *
 * Sources (all CC0, on the NAS `3DLowPoly` library — see the repo's
 * `.agent-state/decisions.ndjson` RFC0-ASSETS-* entries):
 * - **Kenney Castle Kit** — `Environment/Medieval/Castle Kit/` (flat `.glb`;
 *   `tower-hexagon-base.glb`, `tower-square-base.glb`, `tree-large.glb`): the
 *   non-hex-footprint pieces flagged as props.
 * - **KayKit Adventurers 2.0 FREE** — `Characters/Animated/KayKit_Adventurers_2.0_FREE/`
 *   (flat `.glb`; `Knight.glb` body + `Rig_Medium_MovementBasic.glb` animation
 *   retargeting rig, which carries `Walking_A`): the rigged unit whose animation
 *   comes from a separate file.
 *
 * Override either root via `HEX_WORLDS_KENNEY_CASTLE_ROOT` /
 * `HEX_WORLDS_ADVENTURERS_ROOT` (absolute path). `HEX_WORLDS_ENABLE_LOCAL_ASSETS`
 * gates the whole suite in package.json.
 *
 * @module
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const libraryRoot = resolve(packageRoot, '..', 'declarative-hex-worlds');

// NAS asset-library defaults; overridable via env (absolute paths). NOT tracked,
// NOT downloaded by the default bootstrap — the test skips when a root is absent.
const NAS_ROOT = '/Volumes/home/assets/3DLowPoly';
const kenneyCastleRoot =
  process.env.HEX_WORLDS_KENNEY_CASTLE_ROOT ?? `${NAS_ROOT}/Environment/Medieval/Castle Kit`;
const adventurersRoot =
  process.env.HEX_WORLDS_ADVENTURERS_ROOT ??
  `${NAS_ROOT}/Characters/Animated/KayKit_Adventurers_2.0_FREE`;

// FREE models (the board the third-party pieces are placed onto) come from the
// library's bootstrapped models/ dir, same as the per-binding visual config.
const configuredAssetRoot = process.env.HEX_WORLDS_ASSET_ROOT ?? resolve(libraryRoot, 'models');
const browserAssetRoot = /^[a-z][a-z\d+.-]*:\/\//i.test(configuredAssetRoot)
  ? configuredAssetRoot
  : `/@fs/${resolve(packageRoot, configuredAssetRoot)}`;

export default defineConfig({
  optimizeDeps: {
    include: ['@react-three/fiber', 'react', 'react-dom/client', 'react/jsx-runtime', 'three'],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  define: {
    'process.env.HEX_WORLDS_ASSET_ROOT': JSON.stringify(browserAssetRoot),
    __KENNEY_CASTLE_ROOT__: JSON.stringify(kenneyCastleRoot),
    __KAYKIT_ADVENTURERS_ROOT__: JSON.stringify(adventurersRoot),
  },
  publicDir: false,
  server: {
    fs: {
      // Allow the examples pkg, the library (dist + models), and the two NAS roots.
      allow: [packageRoot, libraryRoot, kenneyCastleRoot, adventurersRoot],
    },
  },
  test: {
    fileParallelism: false,
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      screenshotFailures: false,
    },
    include: ['src/**/__tests__/**/third-party-assets.test.ts'],
    testTimeout: 120_000,
  },
});
