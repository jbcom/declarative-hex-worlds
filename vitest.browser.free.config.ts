import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageAliases } from './vitest.alias.shared';
import { harnessCoverage } from './vitest.coverage.shared';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const configuredAssetRoot = process.env.HEX_WORLDS_ASSET_ROOT ?? 'models';
const browserAssetRoot = /^[a-z][a-z\d+.-]*:|^\//i.test(configuredAssetRoot)
  ? configuredAssetRoot
  : `/@fs/${packageRoot}/${configuredAssetRoot}`;

export default defineConfig({
  optimizeDeps: {
    include: ['honeycomb-grid', 'koota', 'koota/react', 'react', 'react-dom/client', 'seedrandom', 'three'],
  },
  resolve: {
    // Shared with the unit harness so subpath imports (e.g. `/commands` →
    // `src/commands/index.ts`) resolve identically. The old `src/$1.ts`
    // wildcard here broke react-bindings.test.ts at import time.
    alias: packageAliases(),
  },
  define: {
    __WORKSPACE_ROOT__: JSON.stringify(packageRoot),
    // Tell browser tests where bootstrapped GLTFs live without making the
    // repository root Vite's publicDir, which shadows Vitest Browser's client.
    'process.env.HEX_WORLDS_ASSET_ROOT': JSON.stringify(browserAssetRoot),
  },
  publicDir: false,
  server: {
    fs: {
      allow: [packageRoot],
    },
  },
  test: {
    fileParallelism: false,
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium',
        },
      ],
      screenshotFailures: false,
    },
    include: [
      'tests/browser/browser-harness-smoke.test.ts',
      'tests/browser/free-visual.test.ts',
      'tests/browser/simple-rpg-visual.test.ts',
      'tests/browser/react-bindings.test.ts',
      'tests/browser/feature-gallery.spec.ts',
      'tests/browser/branch-coverage.test.ts',
    ],
    testTimeout: 120_000,
    coverage: harnessCoverage('browser-free'),
  },
});
