import { defineConfig } from 'vitest/config';

// The examples are real CONSUMERS of declarative-hex-worlds — they resolve the
// library through the workspace symlink (its published exports), exactly as an
// external consumer would, rather than reaching into the library's src. This is
// the "test the library under real-world conditions" contract (RFC §D-test-topology).
//
// This is the NODE (headless) config: the shared game's e2e + the scenario/
// consumes-library smokes. The per-binding VISUAL tests (`*-visual.test.ts`) render
// through a renderer binding in a real browser — see vitest.browser.config.ts.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
    ],
    // Browser (renderer-binding) tests run under vitest.browser.config.ts, not here.
    exclude: [
      '**/node_modules/**',
      '**/*-visual.test.ts',
      '**/third-party-assets.test.ts',
    ],
    testTimeout: 15_000,
  },
});
