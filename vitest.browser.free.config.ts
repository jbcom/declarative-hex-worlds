import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMedievalHexagonBrowserAliases } from './vitest.browser.aliases';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = packageRoot;

export default defineConfig({
  optimizeDeps: {
    include: ['koota', 'koota/react', 'react', 'react-dom/client'],
  },
  resolve: {
    alias: createMedievalHexagonBrowserAliases(packageRoot),
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
