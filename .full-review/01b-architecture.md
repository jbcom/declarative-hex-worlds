# Architecture Review — @jbcom/medieval-hexagon-gameboard

Branch: `codex/initial-medieval-hexagon-gameboard`
Reviewer: Software Architect (Opus 4.7)
Target: `packages/medieval-hexagon-gameboard/src/` (38 TS modules, ~40,986 LOC)

---

## Architectural assessment

The library presents a **layered, side-effect-free ESM package** with a deliberately wide subpath-export surface (37 explicit `exports` entries plus the umbrella `.`). Static analysis shows a clean acyclic dependency graph — no SCCs of size >1 across all 38 modules. The dependency direction is well-shaped: low-level value types (`types`, `coordinates`, `grid`) fan in from many modules; high-level orchestrators (`runtime`, `simulation`, `cli`, `index`, `react`) fan out and own composition. ECS layering is cleanly separated: traits live in `koota.ts`/`actors.ts`/`movement.ts`/`patrol.ts`/`quests.ts`, systems-against-world are isolated to `systems.ts` + `world-rules.ts`, and rendering bindings (`react.ts`, `three.ts`) sit at the top of the stack and are only imported by `index.ts`. Determinism is well disciplined: every PRNG call routes through `seedrandom`, and the only `Date.now`/timestamp leak is a single `new Date().toISOString()` in `cli.ts:2296` (CLI output formatting — not in any deterministic data path).

The library is, however, **architecturally over-exposed**. Of the 37 subpath exports, ~10 represent leaky internals (`coordinates`, `grid`, `koota`, `selectors`, `systems`, `rule-types`, `world-rules`, `registry`, `commands`, `projection`) that have no plausible standalone consumer use case once `index` already re-exports them. The umbrella `index.ts` already aggregates ~29 of these modules; the subpath exports duplicate the surface area without offering an architectural benefit, and they obligate the package to maintain semver stability over every internal module's public symbols. The split between `koota.ts` and the per-subsystem trait modules (`actors`, `movement`, `patrol`, `quests`) is a real boundary, but exposing `selectors`, `systems`, and `rule-types` as siblings of `index` blurs which surface is the supported API and which is plumbing.

Two specific structural problems deserve attention: (1) **`cli.ts` is a 4,297-line monolithic `if (parsed.command === 'X')` chain** with no command-table abstraction — each subcommand handler is a top-level function reached by string-equality dispatch, which is difficult to test, document, and extend. (2) **`manifest/free.ts` is a 16,561-line / 395 KB TypeScript object literal** that ships as a `.js` chunk in the bundle, shipping verbatim source into every consumer's parser/load path; it should be a runtime-loaded JSON resource (or a lazy import) since `sideEffects: false` is no defense against a top-level `import { freeManifest }` chain. The CLI and the manifest together are roughly half the package's parse cost.

---

## Findings

### F1 — Subpath export surface is ~2.5× larger than the supported API

- **Severity:** High
- **Architectural Impact:** Public API contract is permanently inflated; every internal module becomes a semver pinning point.
- **Detail:** 37 subpath exports. Roughly 10 are internals (`coordinates`, `grid`, `koota`, `selectors`, `systems`, `rule-types`, `world-rules`, `registry`, `commands`, `projection`) and another 4 (`rules`, `recipe`, `ingest`, `interop`) are unclear whether they're consumer-facing or build-time. `index.ts` already re-exports the bulk of them (29 internal imports).
- **Recommendation:** Adopt a tiered policy:
  - **Public** (keep as subpath): `.` (umbrella), `./react`, `./three`, `./cli`, `./manifest/schema`, `./manifest/free`, `./scenario`, `./blueprint`, `./gameboard`, `./recipe`, `./coverage`, `./compatibility`, `./examples/*`.
  - **Demote to umbrella-only** (remove from `exports`, still re-exported from `index`): `coordinates`, `grid`, `koota`, `actors`, `movement`, `patrol`, `quests`, `pieces`, `layout`, `navigation`, `occupancy`, `selectors`, `systems`, `runtime`, `commands`, `projection`, `registry`, `rules`, `rule-types`, `world-rules`, `validation`, `interop`, `ingest`, `catalog`, `types`.
  - Mirror the trim in `tsup.config.ts` entries — fewer build artifacts, smaller `dist`, faster `tsc --noEmit` for consumers.

### F2 — `cli.ts` is a 4,297-line monolithic dispatcher

- **Severity:** High
- **Architectural Impact:** Untestable as units; documentation drift inevitable; adding a subcommand requires editing the giant `main()`.
- **Detail:** `main()` is at line 230, contains a long chain of `if (parsed.command === 'X')` blocks each calling a top-level handler function. There is no `commands` table, no registry pattern, and handlers, helpers, formatters, type guards, and DTOs all live in one file. `parseArgs` is hand-rolled rather than using `node:util.parseArgs`.
- **Recommendation:** Refactor to command-table pattern:
  ```
  src/cli/
    index.ts          // main(argv): dispatcher only (~50 lines)
    args.ts           // parseArgs (use node:util.parseArgs)
    commands/
      doctor.ts
      validate.ts
      manifest.ts
      analyze.ts
      coverage.ts
      ...
    formatters/
      analysis.ts
      plan-summary.ts
      ...
  ```
  Each command exports `{ name, description, flags, run(ctx, flags): Promise<number> }`. The dispatcher imports a registry. This makes each command unit-testable in isolation, generates `--help` from the registry, and replaces the 4,297-line file with ~150-line modules.

### F3 — `manifest/free.ts` ships as 395 KB / 16,561-line TS source

- **Severity:** High
- **Architectural Impact:** Doubles the package parse cost for every consumer, even those who only need the schema or the Three.js helpers. `sideEffects: false` does not help because anyone who touches `index` will tree-shake-include `freeManifest` via re-export chains.
- **Detail:** `freeManifest` is a static `MedievalHexagonManifest` literal. It has no behavior. JSON would be 30-50% smaller, parse 3-5× faster (browsers have a JSON fast path), and not pollute the JS heap with property-descriptor metadata.
- **Recommendation:**
  - Move the data to `assets/free/manifest.json` (already shipped via `files: ['assets/free', ...]`).
  - Replace `src/manifest/free.ts` with a thin loader: `export async function loadFreeManifest(): Promise<MedievalHexagonManifest>` that imports the JSON.
  - For tree-shakeable static use, ship two variants: `./manifest/free` (lazy async loader) and `./manifest/free/data.json` (raw, opt-in synchronous JSON import via `with { type: 'json' }`).
  - Remove `freeManifest` from `index.ts` re-exports — the umbrella should never force-pull 400 KB.

### F4 — Renderer bindings (`react.ts`, `three.ts`) are re-exported from `index.ts` despite peer deps

- **Severity:** Medium
- **Architectural Impact:** Consumers without `react` or `three` installed will trip type-resolution and SSR-bundling pitfalls if they touch `index`.
- **Detail:** `index.ts` does not currently re-export `react`/`three` (good — they were absent from the `index.ts` imports list), but they live as siblings in the public `exports` map. The convention is correct *for consumers who know about the subpaths*; it should be enforced at the doc level.
- **Recommendation:**
  - Keep `./react` and `./three` as **the only** way to access bindings (already true).
  - Add a runtime guard: `react.ts` and `three.ts` should throw a clear error at import time if the peer is missing, rather than failing deep inside Koota's hook stack.
  - Document the rule explicitly in the README: "Do not import from `@jbcom/medieval-hexagon-gameboard` if you have no DOM/React/Three peer; use the data-only subpaths."

### F5 — Trait taxonomy is partially distributed across modules

- **Severity:** Medium
- **Architectural Impact:** Discoverability hurts. Traits are the public ECS schema; partitioning them by subsystem is fine, but there's no single index of "all traits this library defines."
- **Detail:** Traits live in `koota.ts` (board/tile/placement/relations — 11+ traits), `actors.ts` (8 traits), `movement.ts`, `patrol.ts`, `quests.ts`. There is no `traits.ts` umbrella nor a docblock listing the full trait catalog.
- **Recommendation:** Either (a) introduce `src/traits.ts` that re-exports every trait + its `*Value` type with a top-of-file table-of-contents docblock, or (b) add a TypeDoc category tag `@category Trait` to every trait and surface a Traits index page in the generated docs. Option (a) is lower-friction and lets consumers do `import * as Traits from '@jbcom/medieval-hexagon-gameboard/traits'`.

### F6 — `cli.ts:2296` uses `new Date().toISOString()` in coverage output

- **Severity:** Low
- **Architectural Impact:** Cosmetic non-determinism in CLI output formatting. Not a runtime/data-path leak.
- **Detail:** Single hit:
  ```
  cli.ts:2296: : new Date().toISOString(),
  ```
  Surrounded by the `coverage` command which has a `--generatedAt` flag (verified in `package.json` scripts: `pnpm run coverage:ledger` passes `--generatedAt 2026-05-24T00:00:00.000Z`). The `Date.now` fallback only fires when no flag is supplied.
- **Recommendation:** Either make `--generatedAt` required (fail-fast), or default to a stable build-time constant injected at CLI build. Not blocking — the production path already overrides.

### F7 — `simulation.ts` is 5,213 lines — largest module after `cli.ts`

- **Severity:** Medium
- **Architectural Impact:** Single-file reader-can-hold-it-in-head test fails.
- **Detail:** `simulation.ts` imports 13 other modules and is the largest non-CLI module. Likely conflates scenario simulation engine + simulation script + simulation report generators + assertion helpers.
- **Recommendation:** Decompose along the use-case axis:
  - `simulation/engine.ts` — turn-based step runner
  - `simulation/script.ts` — script DSL parsing/execution
  - `simulation/report.ts` — report DTO + renderers
  - `simulation/assertions.ts` — expectation checks
  - `simulation/index.ts` — re-export public surface
  Same shape can be applied to `catalog.ts` (2,398 LOC), `interop.ts` (2,383 LOC), `actors.ts` (2,260 LOC), `gameboard.ts` (2,173 LOC), `layout.ts` (1,872 LOC).

### F8 — `index.ts` is 1,057 lines of pure re-exports

- **Severity:** Low
- **Architectural Impact:** Long but mechanical. Re-export hygiene is good (groups by module). The pain is that semver-relevant symbols are listed by hand, so deletions can silently break consumers if the list isn't kept tight.
- **Detail:** 57 `export` lines. No `export *` shorthand (good — explicit is safer). But there's no test asserting the umbrella surface matches the subpath surfaces.
- **Recommendation:** Add a build-time test (`tests/contract/public-api.test.ts`) that snapshots the union of all `index.ts` named exports + their type names. Fails on accidental drift. This is the cheapest defense against API breakage.

### F9 — `scripts/` lives at workspace root but operates only on this package

- **Severity:** Low
- **Architectural Impact:** Workspace-vs-package boundary muddy. `scripts/audit-package.ts` (24 KB), `scripts/audit-free-assets.ts` (10 KB), `scripts/generate-package-assets.ts`, `scripts/extract-kaykit-guide.ts`, `scripts/promote-showcases.ts`, `scripts/smoke-built-cli.ts` (41 KB), and `scripts/smoke-packed-consumer.ts` (105 KB) all target the single package.
- **Detail:** The only multi-package scripts are `audit-workspace.ts` (52 KB), `audit-workflows.ts`, `audit-api-docs.ts`, `audit-docs-contract.ts`. The smoke tests + asset generators are package-scoped.
- **Recommendation:** Move package-scoped scripts into `packages/medieval-hexagon-gameboard/scripts/`. Keep only true workspace-level audits at root. This makes the package self-contained and reduces the cognitive load of "which scripts touch which package."

### F10 — No barrel-vs-deep-import strategy documented

- **Severity:** Medium
- **Architectural Impact:** Tree-shaking depends on consumers choosing the right import path; there is no guidance on when to import from `'@jbcom/medieval-hexagon-gameboard'` vs `'@jbcom/medieval-hexagon-gameboard/coordinates'`.
- **Detail:** `splitting: true` in tsup means shared chunks are emitted; the comment `// Shared chunks keep Koota trait identities stable when consumers mix package subpaths.` shows the maintainer is aware of the trait-identity-across-chunks hazard, but this isn't surfaced to consumers.
- **Recommendation:** Add a "Module Map" section to the README that says: "Always import traits from the umbrella `@jbcom/medieval-hexagon-gameboard` OR consistently from `/koota` — mixing causes duplicate trait identity in Koota." Combined with F1 (trim subpaths), this hazard goes away because there'll be one supported entry point per concern.

### F11 — 130 throw-sites with no shared error taxonomy

- **Severity:** Medium
- **Architectural Impact:** Consumers cannot `instanceof`-discriminate library errors from generic ones; error messages are the only contract.
- **Detail:** `grep -c 'throw new \|new Error('` returns 130 hits, zero `class \w+Error` definitions. All errors are plain `Error`.
- **Recommendation:** Define `src/errors.ts` with a small hierarchy:
  ```
  class GameboardError extends Error          // base
  class GameboardValidationError extends GameboardError
  class GameboardManifestError extends GameboardError
  class GameboardScenarioError extends GameboardError
  class GameboardRuntimeError extends GameboardError
  ```
  Tag each throw with the right class. Export the base + subclasses from `index`. Consumers can then `catch (e) { if (e instanceof GameboardValidationError) ... }`.

### F12 — `tsup.config.ts` builds examples as package entry points

- **Severity:** Low
- **Architectural Impact:** `examples/blueprint-board-usage` and `examples/simple-rpg-usage` are first-class entries with `.d.ts` and `.js` artifacts. They're also in the published `exports` map (`./examples/*.json` and `./examples/blueprint-board-usage`).
- **Detail:** This is unusual — examples typically ship as source-only for docs but aren't part of the runtime API surface.
- **Recommendation:** Decide intent. If they're meant as **runnable reference scenarios** consumers can import and execute (likely, given the JSON-export shape), document them as such. If they're docs-only, remove from `tsup.entry` and `package.json#exports`, and ship them as `examples/*.ts` source under `files`.

### F13 — Multiple `createActions` calls scattered across modules

- **Severity:** Low
- **Architectural Impact:** `createActions` is called in `koota.ts`, `actors.ts`, `commands.ts`, `movement.ts`, `patrol.ts`, `quests.ts`, `systems.ts`. Each call defines a slice of world actions. There's no central registry; consumers must know which `gameboardXxxActions` lives where.
- **Detail:** Koota's `createActions` returns a hook-factory bound to a world. Spreading them is fine for tree-shaking, but the discoverability cost is real.
- **Recommendation:** Add `src/actions.ts` that re-exports every `*Actions` symbol with a header docblock listing what each one mutates. Or surface via a TypeDoc category. Low-friction.

---

## Top architectural risks (ranked)

1. **(F1+F10) Public API surface inflation.** 37 subpath exports cement every internal module as a semver-pinned surface. First major break-prone area in v1.x.
2. **(F2) `cli.ts` monolithic dispatcher.** 4,297-line file blocking testability, documentation, and incremental extension. Refactor before public CLI usage grows.
3. **(F3) `manifest/free.ts` as 16,561-line TS literal.** ~400 KB of static data shipped as parsed JS — biggest single hit to consumer startup. Move to JSON.
4. **(F7) Module size — `simulation.ts` 5,213 LOC, `catalog.ts` 2,398 LOC, etc.** Reader-can-hold-it-in-head failures; predicts future bugs in the subsystems most likely to evolve.
5. **(F11) No error taxonomy.** 130 raw `throw new Error()` calls. Library cannot offer programmatic error discrimination — every consumer catches `unknown`.
6. **(F4) Peer-dep boundary discipline.** `react`/`three` subpaths are correctly isolated but lack runtime fences and explicit consumer guidance.
7. **(F5+F13) Trait/action discoverability.** ECS schema distributed across 6 modules with no umbrella index.

---

## Strengths worth preserving

- Zero circular dependencies across 38 modules. The fan-in/fan-out shape (`types`/`gameboard`/`coordinates`/`koota` as foundation; `runtime`/`react`/`cli` as composition) is textbook layered architecture.
- Determinism is well-disciplined: every PRNG threads through `seedrandom`, no `Math.random()` leaks, no `crypto.randomUUID()`, only one cosmetic `new Date()` (cli output, easy fix).
- `sideEffects: false`, ESM-only, explicit `external` peer-dep list in tsup, `node: >=22` engine pin — all modern, all correct.
- Trait identity hazard with `splitting: true` is acknowledged in tsup config comments — maintainer awareness is present.
- ECS layering is clean: traits in dedicated modules, systems isolated to `systems.ts` + `world-rules.ts`, no `react`/`three` imports anywhere outside the named binding modules.
