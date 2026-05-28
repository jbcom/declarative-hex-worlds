import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageAliases } from './vitest.alias.shared';
import { harnessCoverage } from './vitest.coverage.shared';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const extraSourceRoot = resolve(
  packageRoot,
  '../../references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA/Assets/gltf'
);
const extraTextureRoot = resolve(packageRoot, '../../references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA/Textures');

export default defineConfig({
  optimizeDeps: {
    include: ['koota'],
  },
  resolve: {
    alias: packageAliases(),
  },
  define: {
    __EXTRA_SOURCE_ROOT__: JSON.stringify(extraSourceRoot),
    __EXTRA_TEXTURE_ROOT__: JSON.stringify(extraTextureRoot),
  },
  server: {
    fs: {
      allow: ['../..'],
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
    include: ['tests/browser/extra-visual.test.ts'],
    testTimeout: 120_000,
    coverage: harnessCoverage('browser-extra'),
  },
});
