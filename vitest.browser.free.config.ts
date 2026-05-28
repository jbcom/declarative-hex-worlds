import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageAliases } from './vitest.alias.shared';
import { harnessCoverage } from './vitest.coverage.shared';

const packageRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  optimizeDeps: {
    include: ['koota'],
  },
  resolve: {
    // Shared with the unit harness so subpath imports (e.g. `/commands` →
    // `src/commands/index.ts`) resolve identically. The old `src/$1.ts`
    // wildcard here broke react-bindings.test.ts at import time.
    alias: packageAliases(),
  },
  define: {
    __WORKSPACE_ROOT__: JSON.stringify(packageRoot),
    // Tell the runtime asset-root resolver where bootstrapped GLTFs live.
    // CI bootstraps into <packageRoot>/models/ and publicDir=packageRoot serves
    // it as a relative URL: models/<sourcePath>.
    'process.env.HEX_WORLDS_ASSET_ROOT': JSON.stringify(process.env['HEX_WORLDS_ASSET_ROOT'] ?? 'models'),
  },
  // Serve repo root as static files so browser tests can fetch bootstrapped
  // GLTFs from models/ (or wherever HEX_WORLDS_ASSET_ROOT points).
  publicDir: packageRoot,
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
      'tests/browser/free-visual.test.ts',
      'tests/browser/simple-rpg-visual.test.ts',
      'tests/browser/react-bindings.test.ts',
      'tests/browser/feature-gallery.spec.ts',
    ],
    testTimeout: 120_000,
    coverage: harnessCoverage('browser-free'),
  },
});
