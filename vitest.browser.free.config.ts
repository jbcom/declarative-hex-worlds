import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(packageRoot, '../..');

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
    __WORKSPACE_ROOT__: JSON.stringify(workspaceRoot),
  },
  server: {
    fs: {
      allow: [workspaceRoot],
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
    ],
    testTimeout: 120_000,
  },
});
