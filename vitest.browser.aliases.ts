import { resolve } from 'node:path';

const PACKAGE_NAME = '@jbcom/medieval-hexagon-gameboard';

const PUBLIC_ENTRYPOINT_SOURCES = {
  actors: 'src/actors/index.ts',
  blueprint: 'src/scenario/blueprint.ts',
  catalog: 'src/scenario/catalog.ts',
  commands: 'src/commands/index.ts',
  compatibility: 'src/interop/compatibility.ts',
  coordinates: 'src/coordinates/index.ts',
  coverage: 'src/interop/coverage.ts',
  errors: 'src/errors/index.ts',
  gameboard: 'src/gameboard/index.ts',
  grid: 'src/coordinates/grid.ts',
  ingest: 'src/ingest/index.ts',
  interop: 'src/interop/index.ts',
  koota: 'src/koota/index.ts',
  layout: 'src/coordinates/layout.ts',
  'manifest/free': 'src/manifest/free.ts',
  'manifest/schema': 'src/manifest/schema.ts',
  movement: 'src/movement/index.ts',
  navigation: 'src/gameboard/navigation.ts',
  occupancy: 'src/gameboard/occupancy.ts',
  patrol: 'src/patrol/index.ts',
  pieces: 'src/pieces/index.ts',
  projection: 'src/coordinates/projection.ts',
  quests: 'src/quests/index.ts',
  react: 'src/react/index.ts',
  recipe: 'src/scenario/recipe.ts',
  registry: 'src/scenario/registry.ts',
  rules: 'src/rules/index.ts',
  'rule-types': 'src/rules/rule-types.ts',
  runtime: 'src/runtime/index.ts',
  scenario: 'src/scenario/index.ts',
  selectors: 'src/selectors/index.ts',
  simulation: 'src/simulation/index.ts',
  systems: 'src/systems/index.ts',
  three: 'src/three/index.ts',
  traits: 'src/traits/index.ts',
  types: 'src/types/index.ts',
  validation: 'src/rules/validation.ts',
  'world-rules': 'src/systems/world-rules-system.ts',
  'examples/blueprint-board-usage': 'examples/blueprint-board-usage.ts',
  'examples/simple-rpg-usage': 'examples/simple-rpg-usage.ts',
} as const;

export function createMedievalHexagonBrowserAliases(packageRoot: string) {
  return [
    {
      find: new RegExp(`^${escapeRegExp(PACKAGE_NAME)}$`),
      replacement: resolve(packageRoot, 'src/index.ts'),
    },
    ...Object.entries(PUBLIC_ENTRYPOINT_SOURCES).map(([subpath, sourcePath]) => ({
      find: new RegExp(`^${escapeRegExp(PACKAGE_NAME)}/${escapeRegExp(subpath)}$`),
      replacement: resolve(packageRoot, sourcePath),
    })),
  ];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
