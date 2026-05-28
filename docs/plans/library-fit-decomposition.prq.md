# Feature: Library-fit decomposition (Epic LF)

**Created**: 2026-05-28
**Version**: 2.88
**Timeframe**: Multi-session (sequenced commits, one topic each)

## Priority: High (unblocks Epic E-MergedGate — browser coverage gate)

## Overview

The library umbrella `src/index.ts` is not browser-safe and the codebase has
CLI-only concerns living in the runtime surface. A browser file that imports
`@jbcom/medieval-hexagon-gameboard` crashes with
`Module "node:fs" has been externalized for browser compatibility`, because the
umbrella eagerly re-exports `bootstrap` (node:fs + network) and
`manifest/upstream-layout` (node:fs/node:path). This blocks the merged
unit+browser-free coverage gate (Epic E-MergedGate) from loading react/three.

Root causes, all to be fixed here:

1. **Umbrella duplication.** `src/index.ts` hand-relists **956 named symbols**
   that the 18 domain barrels already `export *`. Zero `export *` at the root.
   Adding a public export to a domain requires a second hand-edit here. This is
   duplication, not curation — tiering is enforced at `package.json#exports` +
   `@internal`, not the root hand-list.
2. **bootstrap is mis-filed as a top-level domain.** `src/bootstrap/` is
   reachable ONLY from `src/cli/` (cli/_shared.ts + the lazy command import);
   never from runtime/react/three. It is a **CLI command capability**, not a
   library domain peer to gameboard/scenario. It belongs under
   `src/cli/commands/bootstrap/`.
3. **upstream-layout is mis-filed under manifest/.** Its layout data + fs-probers
   are consumed ONLY by bootstrap. Nothing in manifest/runtime uses it. It
   belongs with the bootstrap CLI command.
4. **Hardcoded constants/tunables are scattered** through source: GitHub
   owner/repo/ref, FREE/EXTRA zip + repo-clone expected patterns, layout markers,
   bootstrap relative paths. These are configuration data and belong in
   `src/config/` as logically-decomposed JSON.
5. **CLI is hand-rolled.** `src/cli/cli.ts` does manual argv parsing + a
   `Record<string, () => import()>` dispatch table. A proper CLI library should
   own parsing, help, subcommand routing.
6. **bootstrap fetches the upstream repo via raw `node:https` tarball pull.** The
   correct approach is a **git clone** through a proper git library added as an
   **OPTIONAL peer dependency**, so consumers opt into repo-bootstrap. The
   hand-rolled https/redirect/tarball code is brittle (no ref resolution beyond a
   tarball URL, no auth, manual redirects). The `{ kind: 'zip' }` source stays.

The end-state: `src/index.ts` imports zero node builtins (transitively), is the
single barrel-forwarding umbrella, and the browser harness can load it. CLI lives
in `src/cli/` on a real CLI framework, with bootstrap as a command, config in
`src/config/` JSON, and repo-bootstrap via an optional git peer dep.

## Constraints (architecture invariants — DO NOT VIOLATE)

- 100% test coverage maintained across the moved/renamed surface; every behavior
  keeps its co-located test; the public-api snapshot is updated *intentionally*.
- Determinism preserved (no Math.random; seedrandom flows unchanged).
- No `any`, no `@ts-ignore`, no non-null assertions.
- Barrel-only cross-domain imports (Biome `noRestrictedImports`); update the rule
  for moved modules.
- Published API tiering via `package.json#exports`; subpath renames are
  intentional and documented (pre-1.0, breaking renames acceptable).
- Each task is one focused commit; RED→GREEN where new behavior is added.

## Tasks

- [ ] LF1: Rewrite `src/index.ts` to barrel-forwarding (browser-safe step 1)
- [ ] LF2: Create `src/config/` JSON config domain + loader; migrate bootstrap/layout constants
- [ ] LF3: Relocate `upstream-layout` into the bootstrap command area
- [ ] LF4: Relocate `src/bootstrap/` → `src/cli/commands/bootstrap/`
- [ ] LF5: Repoint published subpaths + tsup entries + package.json exports + biome rule + docs
- [ ] LF6: Adopt a proper CLI library for `src/cli/cli.ts`
- [ ] LF7: Replace raw https GitHub fetch with git-clone via optional peer dependency
- [ ] LF8: Verify umbrella is browser-import-safe (no node builtins reachable from src/index.ts)

## Dependencies

- LF3 depends on LF2 (layout constants move to config first).
- LF4 depends on LF3 (upstream-layout co-locates with bootstrap before the whole move).
- LF5 depends on LF4 (subpaths repoint after files settle).
- LF6 independent of LF1–LF5 but easier after LF4 (commands consolidated).
- LF7 depends on LF2 (clone patterns live in config) + LF4 (bootstrap home settled).
- LF8 depends on LF1 + LF3 + LF4 (the three node-leak removals) — final verification.
- LF1 can land first and independently (pure umbrella rewrite; bootstrap still
  reachable via `./bootstrap` subpath, just not re-exported by the umbrella).

## Acceptance Criteria

### LF1 — Barrel-forwarding umbrella
- `src/index.ts` contains only `export * from './<domain>'` lines (the 18 library
  domains: actors, commands, coordinates, errors, gameboard, interop, koota,
  manifest, movement, patrol, pieces, quests, rules, runtime, scenario, selectors,
  simulation, systems) + module doc. No hand-listed named exports.
- The umbrella no longer re-exports `bootstrap` or `upstream-layout` (server/CLI
  surfaces) — they remain on their own subpaths.
- `pnpm typecheck` clean; `pnpm test` green (715+).
- `tests/unit/public-api.test.ts` snapshot updated; diff reviewed to confirm the
  ONLY removals are the bootstrap + upstream-layout symbols (intentional), with no
  unexpected library-symbol loss.
- Verification: `command` — `pnpm typecheck && pnpm test`.

### LF2 — `src/config/` JSON config domain
- New `src/config/` with logically-decomposed JSON: e.g.
  `kaykit-source.json` (github owner/repo/ref, repo-clone patterns, zip expected
  patterns per edition), `bootstrap-paths.json` (relative gltf/texture/sidecar/root),
  `upstream-layouts.json` (the FREE/EXTRA layout descriptors + marker files).
- A typed loader (`src/config/index.ts`) imports the JSON and exposes typed
  constants replacing the hardcoded ones; old constant identities preserved or
  cleanly re-pointed.
- All previous hardcoded `KAYKIT_*` bootstrap/layout constants now derive from
  config JSON (single source of truth). No behavior change.
- Verification: `command` — `pnpm typecheck && pnpm test`; `code_contains` — config
  JSON files exist and are imported by the loader.

### LF3 — Relocate upstream-layout
- `upstream-layout.ts` (the fs-probers `detectKayKitLayout`, `expectedTexturePaths`)
  moves next to the bootstrap command; the pure layout *data* lives in config (LF2).
- `src/manifest/` no longer exports upstream-layout (manifest barrel browser-safe).
- Its test moves with it; coverage unchanged.
- Verification: `command` — `pnpm typecheck && pnpm test`; `file_exists` — new path.

### LF4 — Relocate bootstrap to CLI command area
- `src/bootstrap/*` moves to `src/cli/commands/bootstrap/` (bootstrap.ts,
  bootstrap-target.ts, barrel, tests).
- `src/cli/_shared.ts` + `cli.ts` import from the new location.
- No top-level `src/bootstrap/` remains.
- Verification: `command` — `pnpm typecheck && pnpm test`; absence of `src/bootstrap/`.

### LF5 — Repoint subpaths + build + lint + docs
- `package.json#exports`: `./manifest/upstream-layout` → `./cli/bootstrap` (or the
  agreed name); `./bootstrap` → repointed to the new path. tsup `entry` updated to
  match. `bin` unchanged.
- Biome `noRestrictedImports` updated for moved modules.
- docs-site (architecture table, kaykit-upstream-layout guide, reference index) +
  `scripts/smoke/types.ts` import paths updated.
- Verification: `command` — `pnpm build && pnpm lint && pnpm typecheck && pnpm test`.

### LF6 — Proper CLI library
- `src/cli/cli.ts` uses a real CLI framework (e.g. commander/cac/clipanion — pick
  the lightest that supports lazy subcommand loading to preserve the
  headless-fast-path). Hand-rolled `parseArgs` + dispatch table removed.
- All existing subcommands preserved with identical behavior + `--help`.
- CLI smoke tests (`scripts/smoke-built-cli.ts`, cli tests) pass.
- Verification: `command` — `pnpm test && pnpm test:cli`.

### LF7 — Git-clone via optional peer dependency
- A git library (isomorphic-git or simple-git) added as an **optional**
  peer dependency. Repo-source bootstrap (`{ kind: 'git' }` or repointed
  `github`) clones via that library; clear actionable error if the optional peer
  is absent.
- Raw `node:https` tarball fetch removed. `{ kind: 'zip' }` source unchanged.
- Clone/source patterns read from `src/config/` (LF2).
- Coverage for the new source path; the nightly/e2e github path updated.
- Verification: `command` — `pnpm typecheck && pnpm test`; `code_contains` — no
  `node:https` in the bootstrap source module.

### LF8 — Browser-import-safety verification
- A test/assertion proves `src/index.ts`'s transitive import graph contains no
  `node:fs`/`node:path`/`node:https`/`node:os` (e.g. a build-graph scan or a
  vitest browser smoke that imports the umbrella).
- `tests/browser/react-bindings.test.ts` loads under Chromium (no externalized-
  module error) and emits coverage for `src/react/react.ts`.
- Verification: `command` — browser harness loads umbrella + react test; graph scan
  finds zero node-builtin imports reachable from `src/index.ts`.

## Technical Notes

- LF1 is the safe first landing — it changes only the umbrella file + the public-api
  snapshot, and bootstrap stays reachable via `./bootstrap`. Land it, confirm green,
  then proceed.
- Keep `splitting: true` in tsup (Koota trait identity). New entries inherit it.
- The `browser` package.json condition is NOT needed if layering is correct (umbrella
  has no node builtins). Only add a `browser` condition if a residual leak can't be
  relocated — prefer relocation.
- Coordinate with `.agent-state/directive.md` Phase E-MergedGate: LF8 unblocks
  E-MergedGate link 3; the org-var (link 1) is still a user action.

## Risks

- public-api snapshot churn could mask an accidental surface change — review the
  snapshot diff symbol-by-symbol on LF1.
- A CLI-framework swap (LF6) risks subtle `--help`/exit-code/arg-coercion drift —
  pin behavior with the existing cli tests before swapping; add cases if thin.
- Optional-peer-dep git clone (LF7) must degrade gracefully when the peer is absent
  AND must not break the zip path or the bundled-no-assets tarball guarantee.
- Subpath renames (LF5) are breaking for any external consumer of
  `manifest/upstream-layout` — acceptable pre-1.0; note in CHANGELOG.
