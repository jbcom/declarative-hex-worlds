import { defineConfig } from 'vitest/config';
import { packageAliases } from './vitest.alias.shared';
import { harnessCoverage } from './vitest.coverage.shared';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/contract/**/*.test.ts',
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
      'scripts/**/__tests__/**/*.test.ts',
    ],
    testTimeout: 15_000,
    setupFiles: ['./tests/setup/koota-cleanup.ts'],
    coverage: harnessCoverage('unit'),
  },
  resolve: {
    alias: packageAliases(),
  },
});
