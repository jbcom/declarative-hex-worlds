# Framework & Language Best Practices Review

## 1. TypeScript Modernization

### 1.1 `verbatimModuleSyntax` missing — High

**Current:** `tsconfig.base.json` has `isolatedModules: true` but NOT `verbatimModuleSyntax: true`.

`isolatedModules` is the weaker guard. `verbatimModuleSyntax` (TS 5.0) is the correct modern replacement: it enforces `import type` at the source level without needing the transpiler to detect type-only imports, and it is required for correct ESM output with Node 22 + `moduleResolution: bundler`.

**Fix:**
```json
// tsconfig.base.json
"verbatimModuleSyntax": true
// remove isolatedModules (redundant once verbatimModuleSyntax is set)
```

Impact: will surface any bare `import` that should be `import type`. The codebase already uses `import type` extensively so churn should be low.

---

### 1.2 `using` / `Symbol.dispose` — zero usage — Medium

**Current:** Zero occurrences of `using`, `Symbol.dispose`, or `Symbol.asyncDispose` in the codebase.

Opportunities:
- `cli.ts`: `readFileSync` / `writeFileSync` paths acquire handles implicitly; any explicit fd usage or temporary file patterns would benefit.
- `src/ingest.ts`: likely uses `node:fs` handles for GLTF copy operations.
- Test helpers in `rendering.ts` already do manual `renderer.dispose()` / geometry `.dispose()` cleanup in `finally` blocks — exactly the pattern `using` is designed to replace.

**Example fix for rendering.ts test teardown:**
```typescript
class DisposableRenderer {
  constructor(readonly renderer: WebGLRenderer) {}
  [Symbol.dispose]() { this.renderer.dispose(); }
}

// Before:
try {
  const renderer = new WebGLRenderer();
  // ...
} finally {
  renderer.dispose();
}

// After:
using r = new DisposableRenderer(new WebGLRenderer());
// auto-disposed on scope exit
```

Requires `tsconfig.base.json` `lib` to include `"ES2022"` (already present) and `target` to be `ES2022` (already present). TS 5.2 fully supports `using`.

---

### 1.3 `satisfies` — partially adopted, not systematic — Low

**Current:** `satisfies` is used in tests and in 6 source files (validation.ts, actors.ts, navigation.ts, interop.ts, gameboard.ts). Good.

**Gap:** Several `as const` casts in non-test source files that construct literal records/arrays would be cleaner as `value satisfies SomeType` when the inferred literal type is important. This is a polish issue, not a correctness bug. No required action.

---

### 1.4 `const` type parameters — not used — Medium

**Current:** No uses of `<const T>` generic constraint. The `readJson<T>` helper used extensively in scripts infers `unknown` and then narrows. Callers like `readJson<GuidePermutationSmoke>(path)` would not benefit from `const T`, but functions that accept literal tuple/object literals as generic args and want to preserve literal types (e.g. factory functions that key on string literals) could benefit.

**Current gap:** The `hexKey()` function returns `string` when it could return a branded type. See §1.5.

---

### 1.5 `HexKey` not a branded type — High

**Current:** `hexKey(coordinates)` returns `string`. `parseHexKey(key: string)` accepts any `string`. This means any `string` flows into functions expecting a tile key without compile-time safety.

`tileKey: string` appears on `GameboardPlacementSpec` and is passed around everywhere. A misformatted key would only fail at runtime.

**Recommended:**
```typescript
// coordinates.ts
declare const _hexKeyBrand: unique symbol;
export type HexKey = string & { readonly [_hexKeyBrand]: true };

export function hexKey(coordinates: HexCoordinates): HexKey {
  return `${coordinates.q},${coordinates.r}` as HexKey;
}

export function parseHexKey(key: string): HexCoordinates {
  // existing impl — no change needed, returns HexCoordinates not HexKey
}
```

Then `tileKey: string` fields on public interfaces become `tileKey: HexKey`. The brand is erased at runtime; zero overhead.

This would eliminate the need for `parseHexKey` call sites to defensively re-parse keys they already hold as validated coordinates.

---

### 1.6 `import ... with { type: 'json' }` — partially adopted — Low

**Current:** `smoke-packed-consumer.ts` uses modern `with { type: 'json' }` syntax correctly. But several internal test files (`free-visual.test.ts`, `simple-rpg-visual.test.ts`) and `examples/*.ts` import JSON files WITHOUT the `with { type: 'json' }` attribute:
```typescript
import generatedPieceScenario from '../../examples/generated-piece-scenario.recipe.json'; // no attribute
import scenarioJson from './simple-rpg-scenario.json'; // no attribute
```
`moduleResolution: bundler` with `resolveJsonModule: true` makes this work at build time, but the attribute is semantically correct for Node 22 native ESM and for bundler interop clarity.

**Fix:** Add `with { type: 'json' }` to all bare JSON imports in test and example files.

---

### 1.7 `noUncheckedIndexedAccess` not enabled — Medium

**Current:** `tsconfig.base.json` lacks `noUncheckedIndexedAccess`. Array indexing throughout the codebase returns `T` instead of `T | undefined`. With 100+ `throw new Error()` sites that may be guarding against undefined array accesses, enabling this flag would surface latent bugs.

**Fix:** Add to `tsconfig.base.json`:
```json
"noUncheckedIndexedAccess": true,
"exactOptionalPropertyTypes": true
```
Expect ~50-200 new errors; fix them.

---

### 1.8 `noPropertyAccessFromIndexSignature` not enabled — Low

`Record<string, ...>` usage is pervasive. This flag enforces `obj['key']` syntax (not `obj.key`) for index-signature types, preventing accidental property access that silently returns `undefined`.

---

## 2. Node 22 Features

### 2.1 Hand-rolled `parseArgs` — replace with `node:util.parseArgs` — High

**Current:** Four hand-rolled `parseArgs` implementations across the codebase:
- `packages/medieval-hexagon-gameboard/src/cli.ts:4089` — 50+ line custom parser
- `scripts/generate-package-assets.ts:42`
- `scripts/extract-kaykit-guide.ts:36`
- `packages/medieval-hexagon-gameboard/tests/scripts/assert-screenshots.ts:29`

`node:util.parseArgs` (stable since Node 18.11, enhanced in Node 22) handles boolean flags, string values, aliases, positionals, and strict unknown-arg rejection out of the box.

**Example migration for cli.ts:**
```typescript
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  args: argv,
  options: {
    edition:   { type: 'string' },
    source:    { type: 'string' },
    manifest:  { type: 'string' },
    outJson:   { type: 'string' },
    outMarkdown: { type: 'string' },
    checksPassed: { type: 'boolean' },
    // ...
  },
  allowPositionals: true,
  strict: false, // or true to reject unknown flags
});
const [command = 'help'] = positionals;
```

Benefits: type-safe `values` object, proper `--no-<flag>` negation support, alias support (`-h` → `help`), no maintenance burden.

---

### 2.2 `node:fs/promises` not used — Low

**Current:** `cli.ts` uses synchronous `readFileSync`, `writeFileSync`, `existsSync`, `readdirSync`, `statSync` from `node:fs`. For a CLI that runs as a single-shot process these are acceptable, but for any file-heavy paths (manifest generation, GLTF copy), `node:fs/promises` + async/await would allow better error messaging and potential future streaming.

No blocking issue; note for next refactor round.

---

### 2.3 `node:path/posix` — not assessed as a gap — None

The codebase uses `node:path` (not `posix`). The CLI targets Node on darwin/linux where `path` and `path/posix` are identical. No change needed.

---

## 3. Biome v2 Config Gaps

**Current biome.json:** Biome 2.4.15, `recommended: true`, minimal rule overrides.

### 3.1 Missing `performance` rules — Medium

Biome v2 added `performance.noDelete` and `performance.noBarrelFile`. Neither is configured. `noBarrelFile` is controversial for a library (barrel `index.ts` is intentional here), so disable it explicitly. `noDelete` (flags `delete obj.key` patterns for performance) should be `error`.

### 3.2 Missing `nursery` opt-ins worth enabling — Low

Biome v2 nursery rules stable enough to enable:
- `nursery.useConsistentMemberAccessibility` — enforce `public`/`private`/`protected` consistently on class members
- `nursery.noSecrets` — catch accidentally committed secrets (useful for CI scripts that construct paths)
- `nursery.noCommonJs` — already ESM-only; this enforces it at lint level

### 3.3 `organizeImports` in `assist` — not in `linter` — Low

The current config has `assist.actions.source.organizeImports: "on"`. Biome v2 moved import sorting to `assist` which is correct. However, `linter` does not have `correctness.noUndeclaredVariables: "error"` enabled — this is recommended in v2 but requires `vcs` integration to work cleanly with `.gitignore` exclusions (already configured). Enable it.

### 3.4 `files.includes` gap — `scripts/**` patterns inconsistent — Low

`files.includes` covers `scripts/**/*.ts` but not `scripts/**/*.json`. Script-generated JSON files in `scripts/` are linted inconsistently. Add `"scripts/**"` broadly or be explicit.

### 3.5 `formatter.lineEnding` not set — Low

Biome v2 defaults to OS line ending. Explicitly set `"lineEnding": "lf"` to prevent CRLF drift on Windows contributors.

---

## 4. Package.json Hygiene

### 4.1 `exports` map — missing `"default"` fallback and `"source"` condition — Medium

**Current:** All subpath exports use only `{ "types": ..., "import": ... }`. Missing:
- No `"default"` condition (some older bundlers/tools fall through to `"default"` when `"import"` is not matched)
- No `"source"` condition (used by Vite, esbuild, and nx for in-workspace source resolution instead of dist)

For a published library, adding `"source"` makes monorepo consumers faster (no need to build before consuming) and is standard in nx-powered libraries.

**Recommended shape for each entry:**
```json
"./coordinates": {
  "types":   "./dist/coordinates.d.ts",
  "source":  "./src/coordinates.ts",
  "import":  "./dist/coordinates.js",
  "default": "./dist/coordinates.js"
}
```

### 4.2 `main` and `module` legacy fields — Low

`package.json` still has `"main": "./dist/index.js"` and `"module": "./dist/index.js"`. With a complete `exports` map and all consumers on modern bundlers/Node 22, `main` is technically only needed for CJS consumers (none here). `module` is a bundler-convention field not in the Node spec. Can be removed once `exports["."]` is confirmed to cover all use cases. No urgency.

### 4.3 `publishConfig` missing `registry` — Low

`publishConfig` only sets `"access": "public"`. For scoped packages on npm, this is sufficient. If this were ever published to a private registry, `"registry"` would need to be added. No action required now, note for ops runbook.

### 4.4 `funding` field absent — Low

Not present on the package. For an MIT open-source library, adding:
```json
"funding": { "type": "github", "url": "https://github.com/sponsors/jbcom" }
```
is a one-line addition that some tooling (npm fund) surfaces to consumers.

### 4.5 `peerDependencies` version range for React — Medium

```json
"react": ">=18.0.0 <20"
```
React 19 is stable (released Dec 2024). The `react.ts` module uses React 19 APIs (no forwardRef, no class components). The peer range should be updated to `">=18.0.0 <21"` or `">=19.0.0 <21"` to signal React 19 support. The devDependency already pins `"react": "^19.0.0"`.

---

## 5. Tsup Config

### 5.1 `metafile` not enabled — Low

`tsup.config.ts` has no `metafile: true`. Without a metafile, bundle composition (which chunks contain what, and how large) is opaque. Add:
```typescript
metafile: true,
```
Then use `esbuild-analyzer` or `bundle-buddy` against `dist/metafile.json` for bundle analysis. No impact on consumers.

### 5.2 `treeshake` not explicitly configured — Low

tsup/esbuild treeshakes ESM by default. However, the current config uses `splitting: true` (correct for Koota trait identity stability) without specifying `treeshake` explicitly. Add:
```typescript
treeshake: true,
```
This is a belt-and-suspenders signal; esbuild already does it. Harmless to add.

### 5.3 `target` mismatch — Low

`tsup.config.ts` sets `target: 'es2022'`. `tsconfig.base.json` sets `"target": "ES2022"`. These match. But Node 22 supports ES2024 features natively. Consider upgrading both to `ES2024` / `es2024` to allow native `Promise.withResolvers`, `Array.prototype.toSorted`, etc. without polyfills.

### 5.4 `examples/` entries in tsup — Medium

`tsup.config.ts` includes `examples/blueprint-board-usage` and `examples/simple-rpg-usage` as build entries. These are compiled into `dist/` and exported. This is fine IF consumers use them as reference implementations, but they pull in `console.log` usage patterns and are not `sideEffects: false` compliant (they run code at module load). Consider:
- Moving examples to a separate `examples/` export condition with `"development"` condition guard, OR
- Confirming examples are tree-shaken away in production bundles (likely yes, since they are exported, not executed on import)

---

## 6. Vitest Config

### 6.1 `pool` not configured for unit tests — Medium

**Current:** `vitest.config.ts` has no `pool` option. Vitest 4.x defaults to `pool: 'forks'` (forked worker processes). For a pure Node environment with CPU-bound simulation tests, `pool: 'threads'` (worker_threads) is faster and shares memory.

**Fix:**
```typescript
test: {
  pool: 'threads',
  // ...
}
```
If any test uses `process.exit` or monkey-patches globals, revert to `'forks'`. For this codebase (pure ECS simulation), `threads` should be safe.

### 6.2 `coverage.thresholds` not set — Medium

Coverage provider is `v8` and reporters include `lcov` (good for CI). But there are no `coverage.thresholds` defined. Without thresholds, coverage regressions go undetected.

**Fix:**
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov'],
  reportsDirectory: './coverage',
  exclude: ['node_modules', 'dist', 'tests', '**/*.config.ts', '**/index.ts'],
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 75,
    statements: 80,
  },
},
```

### 6.3 `setupFiles` not configured — Low

No `setupFiles` or `globalSetup` in `vitest.config.ts`. For a deterministic simulation library, a global setup that seeds or validates the environment (e.g. asserting `process.version >= 22`) would catch environment drift. Optional but worth adding.

### 6.4 Browser configs: `fileParallelism: false` is hardcoded in only one config — Low

`vitest.browser.free.config.ts` has `fileParallelism: false` (correct for screenshot tests that share a browser context). The other browser configs (`extra`, `local-assets`) may or may not have this. Consistency check recommended.

---

## 7. React Patterns (react.ts, 1215 LOC)

### 7.1 React 19 — no `use()`, no `useTransition` — Medium

**Current:** `react.ts` uses `useReducer`, `useEffect`, `useMemo`, `useContext`, `createElement`. No `useTransition`, `useDeferredValue`, or `use()`.

**Opportunities:**
- `useDeferredValue` for selector hooks that compute derived ECS state (e.g. `useGameboardActors`, `useTileActors`) — these can be expensive and could benefit from deferred re-renders on non-urgent state updates.
- `useTransition` around gameboard mutations (place piece, move actor) to keep UI responsive during expensive rule validation.
- `use()` for promise-based data (e.g. if manifest loading becomes async in the future).

**Priority:** Low-Medium. The current `useReducer`-based subscription pattern is correct. These are optimizations, not bugs.

### 7.2 No `forwardRef` usage — Informational

`react.ts` exports component factories via `createElement`. React 19 deprecated `forwardRef` in favor of passing `ref` as a regular prop. Since there is no `forwardRef` usage, this is already aligned with React 19.

### 7.3 `useCallback` absent — Low

None of the hook returns memoize callbacks with `useCallback`. Tile-scoped callbacks (e.g. click handlers on `useTileActors`) returned from hooks will create new function references on every render, causing children to re-render unnecessarily. Adding `useCallback` around event-handler-shaped returns would improve performance.

---

## 8. Three.js Patterns (three.ts)

### 8.1 `dispose()` discipline in source — Missing — High

**Current:** `tests/browser/rendering.ts` has correct `disposeMaterial` / `renderer.dispose()` teardown logic (good for tests). But `src/three.ts` itself has NO `.dispose()` helpers — it defines `GameboardGltfLoader`, transform helpers, and animation helpers but exposes no disposal utilities for consumers.

Consumers using `loadGameboardPlacementGltf` (or similar) must know to call `gltf.scene.traverse(node => { node.geometry?.dispose(); ... })` themselves. This is a leak footgun.

**Recommended:** Export a `disposeGameboardGltf(gltf: GameboardGltfLike): void` utility that traverses and disposes geometry + materials.

### 8.2 No `useLoader` integration in three.ts — Informational

`three.ts` defines `GameboardGltfLoader` interface (loader-agnostic). It does NOT integrate with R3F's `useLoader`. This is intentional — `three.ts` is framework-agnostic. The abstraction is correct. No action needed.

### 8.3 Three r0.184 — `Object3D.traverse` type — Low

`Object3D.traverse(callback)` in Three r0.183+ has improved type: `callback: (object: Object3D) => void`. The `rendering.ts` test uses `disposable.geometry?.dispose()` which accesses `.geometry` off `Object3D` — this requires a cast or narrowing. Confirm this is typed cleanly (it should be, given zero `as any` violations).

---

## 9. Koota Patterns

### 9.1 Trait usage — looks correct — Informational

`trait()`, `createActions()`, `useQuery()`, `useTargets()`, `useTrait()` from `koota` and `koota/react` are all used. The `splitting: true` in tsup preserves Koota trait identity across subpaths (correctly documented in config comment). No issues found.

### 9.2 Koota 0.6.6 — check for `createWorld` deprecations — Low

Koota 0.6.x may have updated `createWorld` / `WorldProvider` API. The code re-exports `WorldProvider as MedievalGameboardProvider` from `koota/react`. Verify against koota changelog that the aliased export shape is stable. No evidence of breakage; verify on next koota upgrade.

---

## 10. Honeycomb-Grid v4

### 10.1 v4.1.5 — using latest patterns — Good

`src/grid.ts` imports `{ Grid, Orientation, defineHex, rectangle, spiral }` from `honeycomb-grid` — all v4 API. `defineHex`, `rectangle`, `spiral` are the v4 factory pattern. No deprecated v3 `Hex.fromPoint` or `HexFactory` usage found.

### 10.2 BFS/DFS — hand-rolled A* — Informational

`coordinates.ts` implements `findHexPath` as a custom A* with priority queue. Honeycomb-grid v4 does not include pathfinding helpers — this is correct, the library is geometry-only. The custom implementation is appropriate.

---

## 11. Error Hierarchy

### 11.1 130+ `throw new Error()` — no custom classes — High

**Current:** All errors are bare `throw new Error(message)`. This means:
- Callers cannot `instanceof`-guard specific failure modes
- Error types cannot carry structured data (e.g. which tile failed, which rule was violated)
- Stack traces are opaque in logs

**Minimum viable hierarchy:**
```typescript
// errors.ts
export class GameboardError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'GameboardError';
  }
}
export class ValidationError extends GameboardError {
  constructor(message: string, readonly violations: readonly string[]) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
export class ParseError extends GameboardError {
  constructor(message: string, readonly input: unknown) {
    super(message, 'PARSE_ERROR');
    this.name = 'ParseError';
  }
}
export class AssetError extends GameboardError { /* ... */ }
export class NavigationError extends GameboardError { /* ... */ }
```

Priority: High for public-facing errors (validation, parse, navigation); lower for internal invariant checks (fine as bare `Error`).

---

## 12. `as unknown as` Casts

### 12.1 Two CLI casts need runtime validators — High

**Current:**
```typescript
// cli.ts:2797
return options as unknown as MedievalGameboardBlueprintScenarioOptions;
// cli.ts:2920
return payload as unknown as GameboardScenarioSimulationScript;
```

Both sites do structural checks (`isRecord`) before casting, but do not validate inner field shapes. Any malformed input file would fail later with a cryptic error instead of a clear validation message at the parse site.

**Fix:** Replace with Zod/valibot schema or a hand-written property validator that returns `Result<T, ParseError>`.

**Pattern:**
```typescript
function readBlueprintOptionsFile(path: string): MedievalGameboardBlueprintScenarioOptions {
  const payload = readJson<unknown>(path);
  const result = validateBlueprintOptions(payload); // returns { ok: true, value } | { ok: false, error }
  if (!result.ok) throw new ParseError(`Blueprint file ${path}: ${result.error}`, payload);
  return result.value;
}
```

The test-file casts (`simulation.test.ts:750`, `recipe.test.ts:384`) are intentional negative-path test cases; those are acceptable.

---

## 13. Nx Configuration

### 13.1 `parallel: 3` — underutilized on modern hardware — Low

`nx.json` sets `parallel: 3`. Modern dev machines have 8-16 cores. The current limit serializes build/test tasks unnecessarily. Set to at least 8 (or `auto` if supported by your Nx version):
```json
"parallel": 8
```

### 13.2 `test:browser:*` targets not in `nx.json` cache defaults — Medium

`nx.json` `targetDefaults` covers `build`, `test`, `lint`, `typecheck`. But `test:browser:free`, `test:browser:extra`, `test:e2e:local-assets` (which appear in `project.json`) are NOT in `targetDefaults`. This means those targets do not get Nx caching.

**Fix:** Add to `nx.json`:
```json
"targetDefaults": {
  "test:browser:free": {
    "inputs": ["default", "^production"],
    "cache": true
  },
  "test:browser:extra": {
    "inputs": ["default", "^production"],
    "cache": true
  }
}
```
Browser tests are deterministic (screenshot comparison), so caching is safe.

### 13.3 No `nxCloudId` / remote cache configured — Informational

No remote Nx Cloud cache configured. Local cache only. For CI speed, Nx Cloud or a self-hosted remote cache (Nx Powerpack / custom) would allow PR runs to reuse cache from main-branch builds. Optional.

---

## 14. Package Manager

### 14.1 pnpm 9.15.9 — engines pin `>=9 <10` — Medium

pnpm 10 released January 2025 with breaking changes (stricter workspace hoisting, `publishConfig` handling changes). The `>=9 <10` pin is deliberate and correct for now.

**Upgrade path:** pnpm 10 requires explicit `hoist-pattern[]` in `.npmrc` for some hoisted packages. Plan migration in a dedicated branch:
1. Update engines to `>=10 <11`
2. Update `packageManager` field
3. Run `pnpm install` and fix hoisting issues
4. Verify `pnpm pack` output is unchanged

No urgency; pnpm 9 is actively maintained.

---

## 15. Dependabot

### 15.1 Security updates not split from routine — Medium

**Current:** Dependabot groups minor/patch into `npm-non-major` and major into `npm-major`. There is no separate group for security updates.

**Fix:** Add a security group that generates PRs immediately (not weekly):
```yaml
- package-ecosystem: "npm"
  directory: "/"
  schedule:
    interval: "weekly"
  groups:
    npm-security:
      update-types: ["patch"]
      applies-to: security-updates
    npm-non-major:
      update-types: ["minor", "patch"]
    npm-major:
      update-types: ["major"]
```
Security PRs generated ad-hoc will bypass the weekly schedule.

---

## Concrete Config Patches

### A. tsconfig.base.json additions
```json
{
  "compilerOptions": {
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```
Remove `"isolatedModules": true` (superseded by `verbatimModuleSyntax`).

### B. biome.json additions
```json
{
  "linter": {
    "rules": {
      "performance": {
        "noDelete": "error"
      },
      "correctness": {
        "noUndeclaredVariables": "error",
        "noUnusedVariables": "error",
        "noUnusedImports": "error",
        "noUnusedFunctionParameters": "warn"
      },
      "nursery": {
        "noCommonJs": "error"
      }
    }
  },
  "formatter": {
    "lineEnding": "lf"
  }
}
```

### C. tsup.config.ts additions
```typescript
export default defineConfig({
  // ... existing ...
  metafile: true,
  treeshake: true,
  target: 'es2024',   // upgrade from es2022
});
```

### D. vitest.config.ts additions
```typescript
export default defineConfig({
  test: {
    pool: 'threads',
    coverage: {
      // ... existing reporters/exclude ...
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

### E. nx.json additions
```json
{
  "parallel": 8,
  "targetDefaults": {
    "test:browser:free": {
      "inputs": ["default", "^production"],
      "cache": true
    },
    "test:browser:extra": {
      "inputs": ["default", "^production"],
      "cache": true
    }
  }
}
```

### F. package.json (published package) — add `"source"` and `"default"` conditions
For each subpath export entry, add:
```json
"source":  "./src/<name>.ts",
"default": "./dist/<name>.js"
```
Update peer dep: `"react": ">=19.0.0 <21"`.

---

## Priority Summary

| Severity | Finding |
|---|---|
| High | `HexKey` not branded (§1.5) |
| High | Hand-rolled `parseArgs` — replace with `node:util.parseArgs` (§2.1) |
| High | 130+ bare `throw new Error()` — no custom error hierarchy (§11.1) |
| High | 2 CLI `as unknown as` casts need runtime validators (§12.1) |
| High | `three.ts` missing `disposeGameboardGltf()` utility (§8.1) |
| Medium | `verbatimModuleSyntax` missing from tsconfig (§1.1) |
| Medium | `noUncheckedIndexedAccess` not enabled (§1.7) |
| Medium | `using`/`Symbol.dispose` zero usage — Three.js teardown opportunity (§1.2) |
| Medium | `const` type params not used where literals matter (§1.4) |
| Medium | Peer dep range excludes React 19 formally (§4.5) |
| Medium | `exports` map missing `"source"` and `"default"` conditions (§4.1) |
| Medium | Vitest `pool: 'threads'` not set (§6.1) |
| Medium | Coverage thresholds not configured (§6.2) |
| Medium | `test:browser:*` Nx targets not cached (§13.2) |
| Medium | Dependabot security updates not split (§15.1) |
| Low | JSON imports missing `with { type: 'json' }` in tests/examples (§1.6) |
| Low | Biome `performance.noDelete`, `formatter.lineEnding` missing (§3.1, §3.5) |
| Low | `metafile`/`treeshake` not explicit in tsup (§5.1, §5.2) |
| Low | `useCallback` absent from React hook returns (§7.3) |
| Low | `parallel: 3` in nx.json — increase to 8 (§13.1) |
| Low | pnpm 10 upgrade path should be planned (§14.1) |
