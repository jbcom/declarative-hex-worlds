import { defineConfig } from 'tsup';

// Run after the runtime build: tsup array configs run concurrently and each DTS
// worker cleans declarations, which can delete the other build's completed core.
export default defineConfig({
  entry: { core: 'src/core/index.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: false,
  target: 'es2022',
  splitting: false,
  treeshake: true,
  external: [
    'declarative-hex-worlds',
    /^declarative-hex-worlds\//,
    'koota',
    'koota/react',
    'react',
    'three',
  ],
  esbuildOptions(options) {
    options.sourcesContent = false;
  },
});
