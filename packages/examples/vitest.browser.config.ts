/**
 * Browser (real-Chromium) config for the examples' per-binding VISUAL tests.
 *
 * The examples render the shared game through a renderer BINDING in a real browser:
 * `src/three/__tests__/*-visual.test.ts` + `third-party-assets.test.ts` render via
 * `declarative-hex-worlds/three`. Unlike the library's own browser config, this one
 * resolves `declarative-hex-worlds` through the BUILT workspace package (its real
 * published exports) — the examples are true external consumers, so there is no
 * `src/*` alias here.
 *
 * Models: the three binding loads FREE GLTFs from `HEX_WORLDS_ASSET_ROOT`. The
 * examples CI job bootstraps them into the LIBRARY package's `models/` dir (the
 * canonical FREE pack location) and points this config there.
 *
 * @module
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const libraryRoot = resolve(packageRoot, '..', 'declarative-hex-worlds');
// FREE models live in the library package (bootstrapped by CI into <lib>/models).
// The browser fetches filesystem paths through Vite's `/@fs/` prefix, so an absolute
// path must be wrapped — NOT passed bare (a bare /home/... path 404s). A `scheme://`
// override (e.g. an http CDN) is used as-is; any other path (relative or absolute) is
// `/@fs/`-wrapped against its absolute form.
const configuredAssetRoot = process.env.HEX_WORLDS_ASSET_ROOT ?? resolve(libraryRoot, 'models');
const browserAssetRoot = /^[a-z][a-z\d+.-]*:\/\//i.test(configuredAssetRoot)
  ? configuredAssetRoot
  : `/@fs/${resolve(packageRoot, configuredAssetRoot)}`;

export default defineConfig({
  optimizeDeps: {
    include: [
      '@react-three/fiber',
      'react',
      'react-dom/client',
      'react/jsx-runtime',
      'three',
    ],
  },
  resolve: {
    // R3F's <Canvas> uses its own reconciler; without deduping React it loads a
    // second copy and hooks throw. Force a single React/React-DOM instance.
    dedupe: ['react', 'react-dom'],
  },
  define: {
    'process.env.HEX_WORLDS_ASSET_ROOT': JSON.stringify(browserAssetRoot),
  },
  publicDir: false,
  server: {
    fs: {
      // Allow the examples package + the library (its built dist + models).
      allow: [packageRoot, resolve(packageRoot, '..', 'declarative-hex-worlds')],
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
    // The standard CI browser run covers the per-binding VISUAL tests against the
    // FREE pack. third-party-assets.test.ts needs licensed local packs (Kenney /
    // KayKit Adventurers) not present in CI — it runs via the local-assets config.
    include: ['src/**/__tests__/**/*-visual.test.ts'],
    testTimeout: 120_000,
  },
});
