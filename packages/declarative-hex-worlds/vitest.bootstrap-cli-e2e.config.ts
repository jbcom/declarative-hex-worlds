/**
 * Vitest config for the asset-bootstrap CLI e2e tests.
 *
 * These exercise `src/cli/commands/bootstrap` (GitHub-source FREE bootstrap +
 * local EXTRA-zip variant) — the library's asset-bootstrap CLI, NOT the SimpleRPG
 * game (that moved to packages/examples). Node-side (no browser); they live under
 * `tests/e2e/` to reflect their cadence (scheduled CI for GitHub-bootstrap,
 * local-only for the EXTRA-zip). The default `vitest.config.ts` only includes
 * `tests/integration/`, so these need their own config.
 *
 * Both use `describe.skipIf` so an unset env var produces a clean skip — running
 * this config in the default loop is safe.
 *
 * @module
 */
import { resolve } from 'node:path';
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['tests/e2e/bootstrap-cli-*.test.ts'],
      // GitHub-bootstrap test downloads + extracts a multi-MB tarball; allow
      // generous timeout. Local-zip test stays well under this.
      testTimeout: 180_000,
    },
    resolve: {
      alias: [
        {
          find: /^declarative-hex-worlds$/,
          replacement: resolve(__dirname, 'src/index.ts'),
        },
      ],
    },
  })
);
