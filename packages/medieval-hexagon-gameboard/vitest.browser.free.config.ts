import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { resolve } from 'node:path';

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
