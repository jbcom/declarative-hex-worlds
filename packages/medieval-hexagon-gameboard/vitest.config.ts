import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['node_modules', 'dist', 'tests', '**/*.config.ts', '**/index.ts'],
    },
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
});
