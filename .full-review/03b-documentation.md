# Documentation Review — declarative-hex-worlds

**Reviewer:** Technical documentation architect
**Date:** 2026-05-28
**Scope:** `src/`, `scripts/`, `tests/`, `.github/workflows/`, `docs-site/`, top-level docs
**Stack:** TypeScript ESM · vitest · tsup · biome · koota (ECS) · three.js · react-three-fiber · citty · yauzl · Astro Starlight

---

## Executive Summary

Documentation maturity here is **high and unusual for a 1.0** — far above typical. The project has:

- A complete Starlight docs site (`docs-site/`) with ~25 hand-written pages plus TypeDoc-generated reference for every public subpath.
- Module-level JSDoc on essentially every `src/<domain>/index.ts` barrel and most domain files, explaining *why* the module exists, not just what it does.
- Dense `@param`/`@returns`/`@throws` coverage on public functions (verified in `coordinates.ts`, `movement.ts`, `patrol.ts`, `_shared.ts`).
- A CI-enforced docs contract (`scripts/audit-docs-contract.ts`, `audit-docs-frontmatter.ts`, `audit-api-docs.ts`) that fails the build on TypeDoc warnings and frontmatter drift — meaning docs *cannot* silently rot.
- An auto-generated CLI reference (`scripts/generate-cli-reference.ts`) that pins the docs page to `src/cli/cli.ts`.

The findings below are therefore **gap-filling, not foundational**. There are no Critical findings. The most actionable items are: a self-referential rename bug in the CLI reference, the absence of any rename/migration narrative for consumers, no formal JSON-input schema/error contract for the five file-accepting CLI flags, and no `HEX_WORLDS_OUT_ROOT` consumer warning.

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 3 |
| Medium | 5 |
| Low | 4 |

---

## High Severity

### H-DOC-1 — CLI reference contains a self-referential rename artifact

**File:** `docs-site/src/content/docs/guides/cli-reference.md:15`

The line reads:

> The library ships a Node CLI at `declarative-hex-worlds` (and the same binary as `declarative-hex-worlds` once installed).

This is a botched find-replace from the `medieval-hexagon-gameboard` → `declarative-hex-worlds` rename. The parenthetical was meant to disambiguate two binary names; now it says a name equals itself, which is meaningless and signals a rushed rename to any reader. `package.json#bin` confirms a single binary: `{"declarative-hex-worlds": "./dist/cli.js"}`.

**Recommendation:** Since this page is auto-generated (`scripts/generate-cli-reference.ts` per the page's own `<Aside>`), fix the **source template** in that script — not the `.md` (which will be overwritten). Replace the parenthetical with a single accurate sentence: "The library ships a Node CLI binary named `declarative-hex-worlds`." Then regenerate.

---

### H-DOC-2 — No rename narrative / migration note for the `medieval-hexagon-gameboard` → `declarative-hex-worlds` change

**Files:** `CHANGELOG.md`, `docs-site/src/content/docs/` (no migration page exists)

The package was renamed mid-1.0 (memory note `project_rename-to-declarative-hex-worlds.md`, 2026-05-28; PR #55 / commit `b0964bc`; a stale `medieval-hexagon-gameboard@1.0.0` GH release + tag were deleted). Evidence of the churn is everywhere in internal state, **but nothing consumer-facing documents it**:

- `CHANGELOG.md` jumps from `[0.1.0] - 2026-05-22` to `[1.0.0] (2026-05-28)` with zero mention of the rename. A reader who installed `medieval-hexagon-gameboard@0.1.0` has no breadcrumb telling them the package moved.
- No `docs-site` page (guide, about, or history) explains the old name → new name mapping.
- The npm rename also changed the env var prefix (`HEX_WORLDS_*`) and the bin name — all silent.

This is a real consumer-facing breaking change (the npm name itself changed), and per the project's own Tier-1 stability contract ("breaking changes only on major versions, **always with a migration guide**" — `public-api.md`), it is undocumented.

**Recommendation:**
1. Add a `## Renamed from medieval-hexagon-gameboard` block to the top of the 1.0.0 `CHANGELOG.md` entry: old name, new name, that `0.1.0` under the old name is abandoned, and the `HEX_WORLDS_*` env-var prefix.
2. Add a short `docs-site/src/content/docs/guides/migration.md` (or an `about/history` note) with the rename mapping and a one-liner npm `deprecate` pointer if the old package name is still claimable.

---

### H-DOC-3 — Five file-accepting CLI flags have no documented JSON schema or error contract (ties Security H-3)

**Flags:** `--scenario`, `--plan`, `--script`, `--recipe`, plus `--routes` (note: the CLI actually exposes the patrol-route input as `--groups`/`--assignments`/`--routeId`, not `--routes` — see L-DOC-4) read user-supplied JSON via `readJson<T>()` in `src/cli/cli.ts`.

The docs describe the *programmatic* path well (`recipes-scenarios-and-simulation.md` shows `inspectGameboardRecipe`, `validateGameboardScenario`, `validateGameboardScenarioSimulationScript` with TS examples), and TypeDoc generates a reference page for `GameboardRecipe`, `GameboardScenario`, etc. **But there is no single place that tells a CLI user:**

- the required top-level shape of each JSON file (e.g. `schemaVersion`, board shape, tile/placement arrays);
- what error the CLI throws and with what exit code when the file is malformed vs. missing vs. semantically invalid;
- that the typed reference pages *are* the schema (no cross-link from the CLI flag to the `GameboardRecipe`/`GameboardScenario` reference page).

A consumer pointing `--scenario ./my.json` at the CLI today must read source to learn the shape and the failure mode.

**Recommendation:** In the auto-generated CLI reference, add a "JSON input contract" subsection per file-flag that:
1. Links the flag to its TypeDoc reference interface (`GameboardScenario` → `/reference/.../GameboardScenario`).
2. States the error contract: malformed JSON → `GameboardCliError`/`GameboardIoError`, exit code `1`; validation failure → printed violations + exit `1` (already true in `validate-recipe`/`validate-scenario` handlers). The `errors.md` taxonomy table already maps `src/cli/cli.ts` → `GameboardCliError`; cross-link it.
3. Point each flag at the matching file in `examples/` / `docs/examples/` (e.g. `simple-rpg-scenario.json`, `generated-piece-scenario.recipe.json`, `simple-rpg-simulation.script.json`) as a copyable starting template.

---

## Medium Severity

### M-DOC-1 — `HEX_WORLDS_OUT_ROOT='/'` footgun is undocumented for consumers (ties Security M-4)

**Files:** `src/cli/_shared.ts:246-269` (good inline doc); **no** docs-site coverage.

The inline JSDoc on `defaultOutRoot()` / `safeResolveOutput()` is excellent — it explains the jail, the defense-in-depth rationale (`../../../etc/passwd` rejection), and that `HEX_WORLDS_OUT_ROOT` is the *only* legitimate widener "for the test harness." It explicitly says "CLI users never set it."

The gap: that warning lives **only in source**. The "Safe output paths" section of `cli-reference.md` exists but (per heading scan) does not warn that setting `HEX_WORLDS_OUT_ROOT=/` widens the jail to the entire filesystem, defeating the path-escape protection. A consumer copying a CI snippet that sets this var has no doc telling them it's dangerous.

**Recommendation:** Add an `<Aside type="danger">` to the "Safe output paths" section of the CLI reference: `HEX_WORLDS_OUT_ROOT` is an internal/test escape hatch; setting it to `/` (or any broad root) disables the write-path jail and should never be set in production. Mirror the source JSDoc's "CLI users never set it" language.

### M-DOC-2 — `koota.ts` → `scenario` dependency-inversion import is undocumented

**File:** `src/koota/koota.ts:16` — `import { isKnownExtraAssetId } from '../scenario';`

`koota/` is a lower-level ECS layer; importing a *catalog* predicate from the higher-level `scenario/` domain is a dependency inversion (flagged in Phase 1 architecture). The call sites (`koota.ts:510`, `:825`) decide `requiresExtra` for a placement. Neither the import nor the call sites carry a comment explaining *why* the runtime layer reaches up into scenario for edition-gating, so a maintainer reading `koota.ts` will see a surprising cross-domain edge with no rationale.

**Recommendation:** Add a one-line inline comment at the import and/or call site explaining the edge (edition-gating for asset IDs is authored in the catalog, consumed at spawn). If the architecture review recommends moving `isKnownExtraAssetId` to a neutral lower layer, document the decision in `about/architecture.md` once resolved.

### M-DOC-3 — `interop/coverage.ts` cohesion mismatch is undocumented

**File:** `src/interop/coverage.ts` (module doc), `about/architecture.md` (sub-package table)

The module doc honestly states its job ("Release-readiness coverage reporting for guide pages, manifests, screenshots…"), and the architecture table groups `interop/` as "Neutral ECS snapshot, external asset compatibility, **release-readiness coverage**." But it bundles release-tooling concerns (guide-page coverage, package verification gates, screenshot artifacts) into a domain otherwise about *schema interop / ECS snapshots*. A docs consumer looking for "how do I snapshot an ECS world for another engine" lands in the same subpath as CI release gates with no signpost separating the two concerns.

**Recommendation:** In `about/architecture.md`, split the `interop/` row's purpose into its two distinct responsibilities, or add a sentence noting that `/coverage` is release-readiness tooling (not a runtime-interop concern) and is `@public` only because release scripts import it. This prevents consumers from mistaking the coverage ledger for a runtime feature.

### M-DOC-4 — Branded-types migration status is documented in source but not surfaced to consumers

**Files:** `src/types/brands.ts` + `src/types/index.ts` (good inline doc); `public-api.md` / `reference/types/*` (status not surfaced).

The inline doc is honest and clear: branded types (`HexKey`, `ActorId`, `TileId`, …) exist, construction goes through `brand*` helpers, and crucially — *"Branded types are NOT yet enforced across the codebase — Epic R2 introduces them progressively."* This matches the Phase 1 finding (large API surface still accepts raw `string`).

The consumer-facing docs **do not carry this caveat**. `public-api.md` lists `./types` with "branded IDs (`HexKey`, `ActorId`, etc.)" as a Tier-1 stable surface, implying the brands are load-bearing. A consumer who adopts `brandHexKey()` expecting type-safety will find most APIs still take raw `string`, so the nominal typing buys little today.

**Recommendation:** Add a note to the `./types` entry in `public-api.md` (or the TypeDoc module doc for `types`) stating that branded IDs are introduced progressively (Epic R2); today many APIs still accept raw `string`, so brands are advisory, not enforced end-to-end. Set the expectation explicitly.

### M-DOC-5 — `simulation/script.ts` (3,163 lines, five responsibilities) lacks a navigational map

**File:** `src/simulation/script.ts`

The module doc is accurate but minimal — it only notes the file was split out of the monolith in PRD D3 and is "byte-identical." For a 3,000+-line file owning script *types*, *schema constants*, *validators*, and authored-script parsing, a single `@module` blurb gives a reader no way to navigate the five responsibilities. The public API surface (`runGameboardScenarioSimulationScript`, `validateGameboardScenarioSimulationScript`, the `SIMULATION_*` constant families) is documented per-symbol via TypeDoc, but the *file* offers no internal section map.

**Recommendation:** Expand the `@module` doc with a short "Sections in this file" outline (types → schema constants → validators → step parsing), or — better, aligning with the architecture review — decompose the file by responsibility. At minimum, a navigational comment header per section reduces the cost of holding the file in head.

---

## Low Severity

### L-DOC-1 — A* pathfinding body has no inline algorithm commentary

**File:** `src/coordinates/coordinates.ts` (`findHexPath`, ~line 214)

The *interface* is well-documented (`HexPathOptions`/`HexPathResult` fields all carry JSDoc). The implementation, however, is a textbook A*-style search (`open` set, `cameFrom`, `costByKey`, `lowestScoreKey`, `reconstructPath`) with **no inline comments** naming the algorithm or explaining the relaxation step (`nextCost >= existing → skip`) or the `maxVisited` abort. A reader unfamiliar with A* on a hex grid must reverse-engineer it. (Note: `lowestScoreKey` selects by cost-to-goal; worth a comment on whether the heuristic is admissible — it reads as Dijkstra-leaning/greedy rather than classic f = g + h.)

**Recommendation:** Add 3-4 inline comments to `findHexPath`: name the algorithm, annotate the frontier-selection + relaxation + abort, and clarify the cost/heuristic model (especially whether it's true A* with an admissible heuristic or weighted Dijkstra — the doc comment `/** Finds a weighted shortest path */` undersells/mis-frames this).

### L-DOC-2 — Patrol state machine transitions are implemented but not narrated

**File:** `src/patrol/patrol.ts` (`advancePatrolEntity`, ~line 230+)

The patrol agent is a state machine (`idle` → `moving` → `waiting`/`paused` → completion), transitioning through `setPatrolState` with statuses `paused`/`moving` and `waitTicksRemaining` gating. The data shapes are documented; the *transition logic* is a 60-line branch cascade with no overview comment explaining the state diagram. `GameboardPatrolStatus` is re-exported with a doc, but the lifecycle a consumer drives via `advance()` is undocumented as a whole.

**Recommendation:** Add a state-diagram comment block above `advancePatrolEntity` (the states, the events that transition between them, and where `waitTicksRemaining`/blocked-route deactivation fit). Optionally surface a short "patrol lifecycle" section in a docs-site guide.

### L-DOC-3 — `docs/` legacy tree coexists with `docs-site/`; consumer entry point is ambiguous

**Files:** `docs/` (api, guides, pillars, PRD, showcases, examples, `index.md`) vs `docs-site/`

The internal history (`about/history/1.0-stabilization.md` F-Site-12, F-Audit-7b) explains that `docs/` is being migrated into `docs-site/` and the remaining `docs/guides/*.md`, `docs/index.md` are kept because tests/scripts reference them. That rationale is well-recorded *internally*. Externally, a contributor cloning the repo sees two parallel docs trees with no top-level README/CONTRIBUTING pointer saying "`docs-site/` is canonical; `docs/` is legacy/test-fixture content." Risk of editing the wrong tree.

**Recommendation:** Add one line to `CONTRIBUTING.md` (and/or `docs/index.md`) stating `docs-site/` is the canonical published site and `docs/` retains only test-referenced fixtures pending final migration.

### L-DOC-4 — Phase-1 "`--routes`" flag name does not exist; minor flag-naming drift in docs vs. source

**Files:** `src/cli/usage.ts`, `src/cli/cli.ts`

The Phase-1 brief lists `--routes` as one of the five JSON file flags, but `usage.ts` exposes no `--routes`; patrol-route inputs come via `--groups`, `--assignments`, `--routeId`, `--actorId`. The usage doc *does* enumerate all 32 subcommands and all real flags correctly (verified — zero known commands missing). This is a brief-vs-reality naming drift worth confirming so the H-DOC-3 schema work documents the *actual* flags.

**Recommendation:** When implementing H-DOC-3, document the real flag set (`--scenario`, `--plan`, `--script`, `--recipe`, `--groups`/`--assignments`) rather than the nonexistent `--routes`. No code change needed — just don't propagate the wrong name into new docs.

---

## What's Working Well (do not regress)

- **Module-level JSDoc explaining *why*** on every barrel — `src/index.ts`, `koota.ts`, `coverage.ts`, `patrol.ts`, `script.ts`, `brands.ts`, `types/index.ts` all open with intent-level docs, not boilerplate.
- **CI-enforced docs contract** — `audit-docs-contract.ts`, `audit-docs-frontmatter.ts`, `audit-api-docs.ts` (0-TypeDoc-warnings gate) make doc rot a build failure. This is the right architecture.
- **Auto-generated CLI reference + TypeDoc reference** — `generate-cli-reference.ts` pins the CLI page to `cli.ts`; TypeDoc generates a reference page per public subpath. Single-source-of-truth done right.
- **Error taxonomy doc** (`errors.md`) — the 7-class hierarchy + domain→subclass mapping table + `instanceof` usage patterns is genuinely good consumer documentation.
- **Architecture page** (`about/architecture.md`) — 20-sub-package map, koota ECS discipline (traits/systems/actions/selectors), build pipeline, bootstrap-not-bundle asset model. The ECS architecture *is* explained well.
- **Getting-started + public-api tier table** — clear three-tier (stable/extension/internal) export taxonomy with per-subpath stability contracts.
- **Bundled examples** — `examples/` + `docs/examples/` ship real scenario/recipe/script JSON, which directly mitigates H-DOC-3 once cross-linked.

---

## Accuracy Spot-Check Results

| Documented claim | Actual | Verdict |
|---|---|---|
| `package.json#bin` = `declarative-hex-worlds` | `{"declarative-hex-worlds":"./dist/cli.js"}` | ✅ accurate |
| CLI usage lists all subcommands | All 32 command modules present in `usage.ts` | ✅ accurate |
| `findHexPath` signature in `HexPathOptions` doc | Matches `coordinates.ts` impl | ✅ accurate |
| `safeResolveOutput` jail behavior (`errors.md` + JSDoc) | Matches `_shared.ts` impl | ✅ accurate |
| Error subclass→domain mapping table | Matches `errors/index.ts` (152 throw sites) | ✅ accurate |
| "same binary as `declarative-hex-worlds`" (cli-reference.md:15) | Self-referential rename artifact | ❌ H-DOC-1 |
| CHANGELOG documents rename | No rename entry; 0.1.0→1.0.0 silent | ❌ H-DOC-2 |
| Branded types are Tier-1 stable | Exist but NOT enforced (raw `string` widespread) | ⚠️ M-DOC-4 (source honest, consumer docs not) |

---

## Recommended Priority Order

1. **H-DOC-1** — fix the rename artifact in `generate-cli-reference.ts` template (trivial, embarrassing if shipped).
2. **H-DOC-2** — add rename note to `CHANGELOG.md` + a migration page (real consumer breaking change).
3. **H-DOC-3** + **M-DOC-1** — document the five JSON-flag schemas/error contract and the `HEX_WORLDS_OUT_ROOT` danger together in the CLI reference (these are the security-tied gaps).
4. **M-DOC-2 / M-DOC-3 / M-DOC-4** — fold into the architecture-review remediations (document the decisions once made).
5. **L-DOC-1 / L-DOC-2 / L-DOC-5** — inline algorithm/state-machine comments during the `simulation/script.ts` + coordinates touch-ups.
