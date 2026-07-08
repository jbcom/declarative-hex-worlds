import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageAliases } from './vitest.alias.shared';
import { harnessCoverage } from './vitest.coverage.shared';

const packageRoot = dirname(fileURLToPath(import.meta.url));
// The EXTRA edition is a LICENSED itch.io purchase — never on GitHub, never
// downloaded by the default bootstrap, never tracked. It resolves from the NAS
// asset library (or an explicit env override); the extra-visual suite `skipIf`s
// itself when the tree is absent (e.g. CI without the NAS) rather than
// corrupting baselines with blank frames. Retired the old `references/` path.
const extraRoot =
  process.env.HEX_WORLDS_EXTRA_ROOT ??
  '/Volumes/home/assets/3DLowPoly/Environment/Terrain/HexagonKit/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA';
const extraSourceRoot = resolve(extraRoot, 'Assets/gltf');
const extraTextureRoot = resolve(extraRoot, 'Textures');

export default defineConfig({
  optimizeDeps: {
    include: ['koota', 'koota/react', 'react', 'react-dom/client'],
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
      allow: [packageRoot, extraSourceRoot, extraTextureRoot],
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
