# 04a — Modern TypeScript / Node.js / ESM Best-Practices Review

**Target:** `declarative-hex-worlds`
**Stack:** TypeScript 6.x (ESM), tsup, biome, vitest, koota (ECS), three.js, react-three-fiber, Node ≥22, pnpm ≥9
**Reviewer focus:** TS idioms, ESM patterns, Node 22 features, koota patterns, tsup/build, biome linting, deprecated APIs, dependency scoping.

---

## Summary

The codebase is mostly modern and disciplined: `verbatimModuleSyntax`, `isolatedModules`, `noUncheckedIndexedAccess`, `strict`, `moduleResolution: bundler`, koota queries are module-scoped, no CJS leakage (`require`/`module.exports`/`__dirname`), no `enum`/`namespace`, no `@ts-ignore`/`@ts-expect-error`, and `as any` is confined to test files. `import.meta.dirname` (Node 22 native) is used consistently instead of the `fileURLToPath` dance.

The dominant remaining issues are **dependency scoping** (React/Three/koota mis-declared as hard `dependencies` for a bindings library — a duplicate-instance footgun) and **unsound type assertions in the CLI** (`readJson<T>` bare cast plus `as unknown as`). Both were partially flagged in prior phases; this review quantifies and locates them.

| # | Severity | Area | Finding |
|---|----------|------|---------|
| 1 | **Critical** | Package mgmt | `react`/`react-dom`/`three`/`koota` are hard `dependencies`, not `peerDependencies` — duplicate-instance bug for a bindings library |
| 2 | **High** | Package mgmt | `react-dom` declared but never imported; `@types/react` in `dependencies` not `devDependencies` |
| 3 | **High** | TS idioms | `readJson<T>` is a bare `JSON.parse(...) as T` with ~20 typed-`T` call sites that skip validation |
| 4 | **High** | ESM / Node 22 | `bootstrap/core.ts:588` uses `new URL(import.meta.url).pathname` — broken on Windows; should use `import.meta.dirname` |
| 5 | Medium | TS idioms | `as unknown as` double-cast in `manifest/schema.ts` and `_shared.ts` (×2) launders untyped input |
| 6 | Medium | Build config | `tsconfig.json` sets `ignoreDeprecations: "6.0"` against TS `^6.0.3` — suppresses real TS6 deprecation signal |
| 7 | Medium | tsup config | `splitting: true` + 44 entry points with no `treeshake`/`minify`; bundle-size posture unverified |
| 8 | Low | Biome | `noRestrictedImports` enforces `../x/x` internal paths but allows deep `../x/index` and `../traits/*` (acceptable, but the `.js`-suffix coverage is inconsistent) |
| 9 | Low | ESM | Relative imports omit `.js` extensions (intentional under `moduleResolution: bundler` + tsup, but couples the source to the bundler) |

---

## Findings

### 1. [Critical] React / Three / koota declared as hard `dependencies`, not peers

**File:** `package.json` — `dependencies` block.

```jsonc
"dependencies": {
  "@types/react": "^19.0.0",
  "citty": "^0.2.2",
  "honeycomb-grid": "^4.1.5",
  "koota": "^0.6.6",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "seedrandom": "^3.0.5",
  "three": "^0.184.0",
  "yauzl": "^3.3.1"
}
```

`react`, `three`, and `koota` are imported throughout `src/react/`, `src/three/`, and all ECS modules (`import { trait } from 'koota'`, `import { Group } from 'three'`, `import { useRef } from 'react'`). For a **library that provides React + Three bindings**, these are textbook **peer dependencies**, not hard dependencies.

The danger is concrete and the codebase already half-knows it: `tsup.config.ts` lists `koota`, `koota/react`, `react`, `three` in `external` precisely so the bundle doesn't inline them. But `external` only controls *bundling* — `dependencies` controls *installation*. With them as hard deps, a consumer that already has `react@19` / `three@0.184` will get a **second copy** installed under `node_modules/declarative-hex-worlds/node_modules/`, and:

- **koota** breaks: trait identities are module-singletons (the `splitting: true` comment in `tsup.config.ts` says exactly this — "keep Koota trait identities stable"). Two koota instances ⇒ traits from the consumer's world don't match traits from the library ⇒ silent query misses.
- **react** breaks: "Invalid hook call / multiple copies of React" — the classic dual-React crash for `src/react/` bindings.
- **three** breaks: `instanceof` checks across two `three` copies fail.

**Recommendation:** Move `react`, `react-dom` (see #2), `three`, and `koota` to `peerDependencies`, with `peerDependenciesMeta` marking the React/Three pair optional if the core runtime is usable headless:

```jsonc
"peerDependencies": {
  "koota": "^0.6.6",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "three": "^0.184.0"
},
"peerDependenciesMeta": {
  "react": { "optional": true },
  "react-dom": { "optional": true },
  "three": { "optional": true }
}
```

Keep them in `devDependencies` too (pnpm does not auto-install peers for the package's own build/test). `honeycomb-grid`, `seedrandom`, `citty`, `yauzl` are genuinely bundled internals and correctly stay as `dependencies` — but see #7 on whether they should be `noExternal`-bundled or remain runtime deps.

---

### 2. [High] `react-dom` declared but never imported; `@types/react` mis-scoped

**File:** `package.json`.

- `react-dom` appears only in a **doc comment** (`src/react/index.ts:4` — "react/react-dom"), never as an `import`. Verified: no `from 'react-dom'` anywhere in `src/`. If the React bindings genuinely don't touch `react-dom`, drop it; if a future renderer needs it, it belongs in peers (#1), not hard deps.
- `@types/react` is in **`dependencies`**. Type-only packages belong in `devDependencies` (the library publishes `.d.ts`; consumers bring their own `@types/react`). Shipping it as a runtime dep forces it into the consumer's install graph and can collide with their React 18/19 types.

**Recommendation:** Remove `react-dom` from `dependencies` (move to peers only if actually used). Move `@types/react` to `devDependencies`. If the public `.d.ts` references React types, add `react` to peers (which #1 already does) so type resolution flows through the peer.

---

### 3. [High] `readJson<T>` bare cast — ~20 typed call sites bypass validation

**File:** `src/cli/_shared.ts:397`.

```ts
export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}
```

The function lies about its return type: arbitrary file contents are asserted to be `T` with zero runtime checking. There are two caller populations:

- **Safe:** `readJson<unknown>(path)` then routed through `inspectMedievalHexagonManifest` / `inspectGameboardScenario` (validates). Good.
- **Unsafe (~20 sites):** typed `T` straight into business logic with no inspection, e.g.

  ```
  src/cli/_shared.ts:866   readJson<GameboardScenario>(scenarioPath)
  src/cli/_shared.ts:1222  readJson<GameboardPlan>(...)
  src/cli/_shared.ts:1227  readJson<GameboardRecipe>(...)
  src/cli/commands/validate-scenario.ts:26  readJson<GameboardScenario>(...)
  src/cli/commands/validate-plan.ts:21      readJson<GameboardPlan>(...)
  src/cli/commands/validate-recipe.ts:22    readJson<GameboardRecipe>(...)
  ```

  (full list: `_shared.ts:501,514,550,866,1017,1087,1222,1227,1244,1284,1294,1315,1361,1368,1511,2556,3013,3025,3042`.)

A malformed scenario file produces a `GameboardScenario`-typed object that is structurally wrong, and the bug surfaces deep in ECS spawning rather than at the I/O boundary.

**Recommendation:** Make `readJson` return `unknown` and force validation at the call site. The idiomatic TS-6 move is a parse-don't-validate boundary:

```ts
export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}
```

Then every caller pipes through the existing `inspect*` validators (which already exist for scenario/recipe/plan/manifest), or a small typed guard. The `validate-*.ts` commands are the worst offenders — a command whose entire job is validation should not assert the type *before* validating. This converts ~20 unsound casts into one explicit boundary.

---

### 4. [High] `new URL(import.meta.url).pathname` is Windows-broken

**File:** `src/cli/commands/bootstrap/core.ts:588`.

```ts
let dir = dirname(new URL(import.meta.url).pathname);
```

`.pathname` on a `file://` URL yields `/C:/Users/...` on Windows (leading slash) and does not percent-decode (`%20` stays literal in paths with spaces). Every `scripts/*.ts` in this repo already uses the Node-22-native `import.meta.dirname` correctly (`scripts/_lib.ts:17`, `merge-coverage.ts:19`, etc.) — this one bootstrap site is the lone holdout, and it sits in the published CLI install path where Windows users hit it.

**Recommendation:**

```ts
let dir = import.meta.dirname; // Node 22 native, cross-platform, already used repo-wide
```

(If a lower floor were ever needed: `dirname(fileURLToPath(import.meta.url))`. But `engines.node: ">=22"` means `import.meta.dirname` is guaranteed.)

---

### 5. [Medium] `as unknown as` double-casts launder untyped input

**Files:**
- `src/manifest/schema.ts:231` — `normalizeMedievalHexagonManifest(input as unknown as MedievalHexagonManifest)`
- `src/cli/_shared.ts:2716` — `return options as unknown as GameboardBlueprintScenarioOptions;`
- `src/cli/_shared.ts:2843` — `return payload as unknown as GameboardScenarioSimulationScript;`

`as unknown as X` is the strongest "trust me" the type system allows — it disables every structural check. The manifest one is arguably defensible (it feeds a normalizer that re-validates), but `_shared.ts:2716`/`2843` return the laundered value directly to callers. `_shared.ts:2843` overlaps the prior-phase `resolveSimulationSpawnActor .at(-1) as ...` and `commandHandlerMutations never` findings — all in the same god module.

**Recommendation:** For the two `_shared.ts` returns, narrow with a discriminated-union guard or a `satisfies`-validated builder rather than a blind double-cast. For `manifest/schema.ts:231`, change the parameter type to `unknown` and let the normalizer narrow (drops the cast entirely). Tie this into the `_shared.ts` decomposition already planned in the architecture phase.

---

### 6. [Medium] `ignoreDeprecations: "6.0"` against TypeScript `^6.0.3`

**File:** `tsconfig.json:7` — `"ignoreDeprecations": "6.0"`, with `typescript: "^6.0.3"` in devDeps.

`ignoreDeprecations` silences compiler warnings about options deprecated in that TS version. Setting it to `"6.0"` while running TS 6.0 suppresses **current** TS-6 deprecation diagnostics — which per the repo doctrine ("every warning is real signal") is exactly the signal you want to see and fix, not mute. It was likely added during a 5.x→6.x bump to get the build green; the deprecated options it's masking should be migrated and the flag removed.

**Recommendation:** Remove `ignoreDeprecations`, run `tsc --noEmit`, and fix whatever deprecated options surface (commonly the old `module`/`moduleResolution` combos, `importsNotUsedAsValues`, `preserveValueImports` — none of which appear in `tsconfig.base.json`, so the masked option may be minor or stale). If a genuinely un-migratable option remains, document the specific option in a comment rather than blanket-suppressing all of 6.0.

---

### 7. [Medium] tsup bundle-size posture unverified for 44 entry points

**File:** `tsup.config.ts`.

```ts
format: ['esm'], dts: true, sourcemap: true, clean: true,
target: 'es2022', splitting: true,
external: ['declarative-hex-worlds', /^declarative-hex-worlds\//, 'koota', 'koota/react', 'react', 'three'],
```

Observations:
- **`splitting: true` is correct** and necessary here — the comment is accurate (shared chunks keep koota trait identities stable across the 44 subpath entries). Good.
- **`treeshake` is not set.** tsup/esbuild tree-shakes by default in bundle mode, but with `sideEffects: false` in `package.json` (present — good) you may want `treeshake: true` explicit to guarantee cross-chunk DCE.
- **`honeycomb-grid` / `seedrandom` / `citty` / `yauzl` are NOT in `external`**, so they get bundled into the output chunks. That's a deliberate choice (they're hard deps that bundle cleanly), but it means the bundle carries them. Since they're *also* declared as `dependencies`, a consumer installs them twice (once bundled, once in node_modules). Pick one model: either `external` + `dependencies` (consumer resolves at runtime, smaller bundle) **or** `noExternal` + move them to `devDependencies` (fully bundled, nothing leaks to consumer install). The current "both" is wasteful.
- No size budget / `metafile` check in CI to catch regressions.

**Recommendation:** Decide bundle-vs-external per dep (recommend `external` for `citty`/`yauzl`/`honeycomb-grid`/`seedrandom` and keep them as `dependencies`, since the CLI and grid math are runtime concerns), set `treeshake: true` explicitly, and add an esbuild `metafile`-based size assertion as a vitest test (matches the repo's "checks are vitest tests" memory). For the CLI entry, consider a separate config without `dts` to shrink it.

---

### 8. [Low] Biome `noRestrictedImports` coverage gaps

**File:** `biome.json` — `linter.rules.style.noRestrictedImports`.

The rule comprehensively blocks `../<pkg>/<pkg>` internal-module reaches (36 paths) and even one `.js`-suffixed variant (`../actors/actors.js`). Gaps:

- Only `../actors/actors.js` has the `.js` suffix variant; the other 35 paths don't. Under `moduleResolution: bundler` someone *could* write `../koota/koota.js` and slip past the rule. Either add `.js` variants for all, or (better) rely on the no-`.js`-extension house style (#9) so the suffixed form never appears.
- `../traits/*` deep imports (`../traits/board`, `../traits/quests`, etc.) are **intentionally allowed** — `traits/` has no public barrel and modules import the specific trait file. This is fine and consistent; just noting it's a deliberate exception, not a gap.
- The rule is path-string based, so it can't catch a `../../koota/koota` (two-level) reach. Low risk given the flat `src/<pkg>/` layout, but a `noRestrictedImports` with a glob or the `@nx`/`eslint-plugin-boundaries`-style layer check would be more robust. Biome doesn't yet have layer-graph enforcement, so this is a known tool limitation.

**Recommendation:** Add `.js` variants for the remaining 35 restricted paths (cheap, closes the suffix loophole), or codify "no `.js` on relative imports" and lint it. Track biome's `noRestrictedImports` glob support for a future tightening; for now the string list is the best available.

---

### 9. [Low] Relative imports omit `.js` extensions

**Files:** pervasive — e.g. `src/quests/quests.ts:20` `from '../coordinates'`, `src/coordinates/projection.ts:9` `from './grid'`.

Under `moduleResolution: bundler` + tsup bundling this is valid and the chosen house style. It is **not** valid for raw `node --experimental-strip-types` or a non-bundler ESM consumer, because true ESM requires explicit `.js` extensions. Since everything ships through tsup (which rewrites/bundles), the published output is correct — but the source is coupled to "must be bundled," and the `tsx`-run scripts work only because `tsx` resolves extensionless specifiers.

**Recommendation:** No action required given the build pipeline — flagging for awareness. If the project ever wants to support `tsc`-only emit or native-Node execution of `src/`, switch to `moduleResolution: nodenext` and add `.js` extensions everywhere. Not worth churning now; the bundler contract holds.

---

## What's already correct (no action)

- **koota queries are module-scoped** — every `createQuery(...)` is a top-level `export const` (`koota.ts:98-126`, `actors.ts:633-682`, `movement.ts:213-223`, `quests.ts:142-148`, `patrol.ts:117`). No query is recreated inside a loop or function. This is the koota best practice and is followed cleanly. `world.query(SomeQuery)` call sites all reference these stable constants.
- **No CJS leakage** — zero `require(`, `module.exports`, `__dirname`, `__filename` in `src/` or `scripts/`.
- **`node:` prefix** — built-in imports use the `node:` prefix (the unprefixed-builtin grep returned nothing).
- **Node 22 native APIs** — `import.meta.dirname` and `structuredClone` used directly, no polyfills (except the one `bootstrap/core.ts` URL site, #4).
- **Modern TS hygiene** — no `enum`, no `namespace`, no `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`, `as any` confined to test files. `satisfies` and `verbatimModuleSyntax`/`isolatedModules`/`noUncheckedIndexedAccess` all in play.
- **tsup `splitting: true`** is the correct (and necessary) choice for shared koota trait identity across subpath entries.

---

## Suggested fix order

1. **#1 + #2** (one `package.json` edit) — move React/Three/koota to peers, drop `react-dom`, fix `@types/react` scope. Highest blast-radius, smallest diff. Add a packed-consumer vitest that asserts single-instance resolution.
2. **#4** — one-line Windows fix in the published CLI path.
3. **#3 + #5** — `readJson` boundary hardening; folds into the `_shared.ts` decomposition already on the architecture track.
4. **#6** — drop `ignoreDeprecations`, fix surfaced warnings.
5. **#7** — bundle-vs-external decision + `treeshake: true` + size-budget vitest test.
6. **#8** — `.js` variants for restricted paths (or codify no-`.js` style).
