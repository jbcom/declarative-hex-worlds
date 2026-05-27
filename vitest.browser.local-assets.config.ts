import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { harnessCoverage } from './vitest.coverage.shared';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(packageRoot, '../..');
const kenneyCastleRoot = resolve(workspaceRoot, 'references/kenney_castle-kit/Models/GLB format');
const adventurersRoot = resolve(workspaceRoot, 'references/KayKit_Adventurers_2.0_FREE');

export default defineConfig({
  optimizeDeps: {
    include: ['koota'],
  },
  resolve: {
    alias: [
      {
        find: /^@jbcom\/medieval-hexagon-gameboard$/,
        replacement: resolve(__dirname, 'src/index.ts'),
      },
      {
        find: /^@jbcom\/medieval-hexagon-gameboard\/(.+)$/,
        replacement: resolve(__dirname, 'src/$1.ts'),
      },
    ],
  },
  define: {
    __KENNEY_CASTLE_ROOT__: JSON.stringify(kenneyCastleRoot),
    __KAYKIT_ADVENTURERS_ROOT__: JSON.stringify(adventurersRoot),
  },
  server: {
    fs: {
      allow: [workspaceRoot],
    },
  },
  test: {
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
    include: ['tests/e2e/local-assets/**/*.test.ts'],
    testTimeout: 120_000,
    coverage: harnessCoverage('browser-e2e-local-assets'),
  },
});
