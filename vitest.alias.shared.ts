/**
 * Shared subpath alias map for every vitest harness.
 *
 * Mirrors tsconfig.json `paths` so vitest resolves
 * `medieval-hexagon-gameboard/<sub-package>` the same way TypeScript
 * does post-R2. The naive `src/$1.ts` wildcard cannot resolve subpaths whose
 * target lives at `src/<dir>/index.ts` (e.g. `/commands` →
 * `src/commands/index.ts`), so the unit AND browser harnesses both need this
 * explicit map. The browser-free config previously used the broken wildcard,
 * which made `tests/browser/react-bindings.test.ts` fail to import — keeping a
 * single source of truth here prevents that drift recurring.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Use `fileURLToPath(import.meta.url)` instead of `import.meta.dirname` for
// portability — `import.meta.dirname` only landed in Node 20.11/21.2, and the
// other vitest configs already use this idiom.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));

const SUBPATH_TARGETS: ReadonlyArray<readonly [string, string]> = [
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
];

export interface VitestAlias {
  find: RegExp;
  replacement: string;
}

/** Alias entries resolving the package root + every published subpath. */
export function packageAliases(): VitestAlias[] {
  return [
    {
      find: /^medieval-hexagon-gameboard$/,
      replacement: resolve(repoRoot, 'src/index.ts'),
    },
    ...SUBPATH_TARGETS.map(([sub, target]) => ({
      // Escape every regex metacharacter in `sub`, not just `/`. The known
      // subpath names only contain `[a-z-/]` today, but a future entry with
      // a backslash or another special char would otherwise be silently
      // mis-escaped (CodeQL js/incomplete-sanitization).
      find: new RegExp(`^medieval-hexagon-gameboard/${sub.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`),
      replacement: resolve(repoRoot, target),
    })),
  ];
}
