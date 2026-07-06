import { defineConfig } from 'vitest/config';

// SimpleRPG is a real CONSUMER of declarative-hex-worlds — it resolves the
// library through the workspace symlink (its published exports), exactly as an
// external consumer would, rather than reaching into the library's src. This is
// the "test the library under real-world conditions" contract (RFC §D-test-topology).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    testTimeout: 15_000,
  },
});
