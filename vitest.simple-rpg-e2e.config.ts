/**
 * Vitest config for SimpleRPG e2e tests (PRD RS2).
 *
 * These tests are Node-side (no browser) but live under `tests/e2e/` to
 * reflect their cadence (scheduled CI for GitHub-bootstrap, local-only for
 * the EXTRA-zip variant). The default `vitest.config.ts` only includes
 * `tests/integration/` so e2e files need their own config.
 *
 * Both test files use `describe.skipIf` so an unset env var produces a
 * clean skip — running this config in the default loop is safe.
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
      include: ['tests/e2e/simple-rpg-*.test.ts'],
      // GitHub-bootstrap test downloads + extracts a multi-MB tarball; allow
      // generous timeout. Local-zip test stays well under this.
      testTimeout: 180_000,
    },
    resolve: {
      alias: [
        {
          find: /^medieval-hexagon-gameboard$/,
          replacement: resolve(__dirname, 'src/index.ts'),
        },
      ],
    },
  })
);
