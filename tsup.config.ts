import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    actors: 'src/actors/index.ts',
    blueprint: 'src/scenario/blueprint.ts',
    catalog: 'src/scenario/catalog.ts',
    compatibility: 'src/interop/compatibility.ts',
    commands: 'src/commands/index.ts',
    coverage: 'src/interop/coverage.ts',
    coordinates: 'src/coordinates/index.ts',
    gameboard: 'src/gameboard/index.ts',
    grid: 'src/coordinates/grid.ts',
    interop: 'src/interop/index.ts',
    koota: 'src/koota/index.ts',
    layout: 'src/coordinates/layout.ts',
    movement: 'src/movement/index.ts',
    navigation: 'src/gameboard/navigation.ts',
    occupancy: 'src/gameboard/occupancy.ts',
    patrol: 'src/patrol/index.ts',
    pieces: 'src/pieces/index.ts',
    projection: 'src/coordinates/projection.ts',
    quests: 'src/quests/index.ts',
    recipe: 'src/scenario/recipe.ts',
    registry: 'src/scenario/registry.ts',
    react: 'src/react/index.ts',
    'rule-types': 'src/rules/rule-types.ts',
    rules: 'src/rules/index.ts',
    runtime: 'src/runtime/index.ts',
    scenario: 'src/scenario/index.ts',
    selectors: 'src/selectors/index.ts',
    simulation: 'src/simulation/index.ts',
    systems: 'src/systems/index.ts',
    three: 'src/three/index.ts',
    traits: 'src/traits/index.ts',
    errors: 'src/errors/index.ts',
    types: 'src/types/index.ts',
    validation: 'src/rules/validation.ts',
    'world-rules': 'src/systems/world-rules-system.ts',
    cli: 'src/cli/cli.ts',
    bootstrap: 'src/cli/commands/bootstrap/index.ts',
    ingest: 'src/ingest/index.ts',
    'manifest/free': 'src/manifest/free.ts',
    'manifest/schema': 'src/manifest/schema.ts',
    'bootstrap/upstream-layout': 'src/cli/commands/bootstrap/upstream-layout.ts',
    'examples/blueprint-board-usage': 'examples/blueprint-board-usage.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  // Shared chunks keep Koota trait identities stable when consumers mix package subpaths.
  splitting: true,
  // Explicit: esbuild tree-shakes ESM by default but treeshake:true enables Rollup-level
  // tree-shaking for the bundled dependencies (honeycomb-grid, seedrandom, citty, yauzl).
  treeshake: true,
  esbuildOptions(options) {
    options.sourcesContent = false;
  },
  // Bundling model: dependencies are BUNDLED, peerDependencies are EXTERNAL.
  // - honeycomb-grid, seedrandom, citty, yauzl: runtime dependencies → bundled (no `external` entry)
  // - koota, koota/react, react, three: peerDependencies → external (consumers supply these)
  // - declarative-hex-worlds/* self-references: external to avoid duplication across subpath chunks
  external: [
    'declarative-hex-worlds',
    /^declarative-hex-worlds\//,
    'koota',
    'koota/react',
    'react',
    'three',
  ],
});
