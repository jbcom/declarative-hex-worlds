import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['node_modules', 'dist', 'tests', '**/*.config.ts', '**/index.ts'],
    },
  },
  resolve: {
    // Mirror tsconfig.json `paths` so vitest resolves
    // `@jbcom/medieval-hexagon-gameboard/<sub-package>` the same way
    // TypeScript does post-R2. The old `src/$1.ts` wildcard cannot find
    // `src/commands.ts` (lives at `src/commands/index.ts` now).
    alias: [
      {
        find: /^@jbcom\/medieval-hexagon-gameboard$/,
        replacement: resolve(__dirname, 'src/index.ts'),
      },
      ...[
        ['actors', 'src/actors/index.ts'],
        ['blueprint', 'src/scenario/blueprint.ts'],
        ['catalog', 'src/scenario/catalog.ts'],
        ['cli', 'src/cli/cli.ts'],
        ['commands', 'src/commands/index.ts'],
        ['compatibility', 'src/interop/compatibility.ts'],
        ['coordinates', 'src/coordinates/index.ts'],
        ['coverage', 'src/interop/coverage.ts'],
        ['errors', 'src/errors/index.ts'],
        ['gameboard', 'src/gameboard/index.ts'],
        ['grid', 'src/coordinates/grid.ts'],
        ['ingest', 'src/ingest/index.ts'],
        ['interop', 'src/interop/index.ts'],
        ['koota', 'src/koota/index.ts'],
        ['layout', 'src/coordinates/layout.ts'],
        ['manifest/free', 'src/manifest/free.ts'],
        ['manifest/schema', 'src/manifest/schema.ts'],
        ['movement', 'src/movement/index.ts'],
        ['navigation', 'src/gameboard/navigation.ts'],
        ['occupancy', 'src/gameboard/occupancy.ts'],
        ['patrol', 'src/patrol/index.ts'],
        ['pieces', 'src/pieces/index.ts'],
        ['projection', 'src/coordinates/projection.ts'],
        ['quests', 'src/quests/index.ts'],
        ['react', 'src/react/index.ts'],
        ['recipe', 'src/scenario/recipe.ts'],
        ['registry', 'src/scenario/registry.ts'],
        ['rule-types', 'src/rules/rule-types.ts'],
        ['rules', 'src/rules/index.ts'],
        ['runtime', 'src/runtime/index.ts'],
        ['scenario', 'src/scenario/index.ts'],
        ['selectors', 'src/selectors/index.ts'],
        ['simulation', 'src/simulation/index.ts'],
        ['systems', 'src/systems/index.ts'],
        ['three', 'src/three/index.ts'],
        ['traits', 'src/traits/index.ts'],
        ['types', 'src/types/index.ts'],
        ['validation', 'src/rules/validation.ts'],
        ['world-rules', 'src/systems/world-rules-system.ts'],
      ].map(([sub, target]) => ({
        find: new RegExp(`^@jbcom/medieval-hexagon-gameboard/${(sub as string).replace(/\//g, '\\/')}$`),
        replacement: resolve(__dirname, target as string),
      })),
    ],
  },
});
