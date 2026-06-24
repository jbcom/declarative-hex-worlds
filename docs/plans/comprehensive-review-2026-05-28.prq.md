# Comprehensive Review Action Plan — 2026-05-28

**Source:** `.full-review/05-final-report.md` (5-phase full codebase review)  
**Directive:** `.agent-state/directive.md` Phase CR queue

## Overview

Full review of `declarative-hex-worlds` identified 9 critical, 26 high, 33 medium, and 30 low findings across code quality, architecture, security, performance, testing, documentation, best practices, and CI/CD. Findings are carried into the directive as CR-P0 through CR-P3 items.

The dominant themes:
1. **CI enforcement gap** — no branch protection makes all CI gates advisory; `release-as` pin breaks the next release
2. **Security test coverage** — network/zip guards untested in PR CI; `readJson<T>` accepts arbitrary user JSON
3. **Package hygiene** — React/Three/koota as hard deps instead of peers (duplicate-instance footgun)
4. **Performance hotspots** — A* O(N²), ECS O(N) lookups, eager 380 KB manifest import
5. **`_shared.ts` god module** — architectural debt already on the architecture track

## P0 — Critical (before next release)

- [ ] **CR-P0-1** Enable `main` branch protection + required checks
- [ ] **CR-P0-2** Remove `release-as: "1.0.0"` pin from release-please-config
- [ ] **CR-P0-3** Move react/three/koota to peerDependencies; clean up react-dom ghost dep and @types/react mis-scope
- [ ] **CR-P0-4** Bootstrap security tests: redirect allowlist + zip-slip + zip-bomb (injectable HTTP seam required)
- [ ] **CR-P0-5** `readJson<T>` → `unknown` return; schema validation for 5 user-JSON CLI entry points; file-size ceiling

## P1 — High (before next release, can batch)

- [ ] **CR-P1-1** Pathfinding: add regression oracle then replace linear open-set scan with binary min-heap
- [ ] **CR-P1-2** Invert `_shared.ts:3-7` test→production import: move 3 symbols to `src/guides/simple-rpg/`
- [ ] **CR-P1-3** Sanitize `--commit` ref: SAFE_REF guard + encodeURIComponent
- [ ] **CR-P1-4** ECS entity lookup: WeakMap indexes for O(1) tile/placement lookups
- [ ] **CR-P1-5** `isKnownExtraAssetId`: pre-compute Set at module init
- [ ] **CR-P1-6** Add `coverage` CI job as required check
- [ ] **CR-P1-7** `bootstrap-nightly.yml`: SHA-pin actions + narrow OUT_ROOT + PR trigger on bootstrap changes
- [ ] **CR-P1-8** `engine.ts:663-665`: null-check `.at(-1)` + throw GameboardRuntimeError
- [ ] **CR-P1-9** Guard release.yml publish with `if: github.event_name == 'release'`
- [ ] **CR-P1-10** Fix `bootstrap/core.ts:588` `new URL(import.meta.url).pathname` → `import.meta.dirname`

## P2 — Medium (next sprint)

- [ ] **CR-P2-1** `_shared.ts` decomposition + `commandHandlerMutations` exhaustiveness
- [ ] **CR-P2-2** Navigation default-arg Map allocations → gameboardPlanIndex
- [ ] **CR-P2-3** System tick: remove spread allocations; flatten flatMap event array
- [ ] **CR-P2-4** `freeManifest` eager import → dynamic import()
- [ ] **CR-P2-5** `useGameboardDerivedRevision` domain-split + microtask coalescing
- [ ] **CR-P2-6** `stageFromZip`/`downloadGithubArchiveZip` cleanup → try/finally
- [ ] **CR-P2-7** `readSidecar` file-size ceiling + files.length bound
- [ ] **CR-P2-8** `walkFilesInternal` symlink warning + count assertion
- [ ] **CR-P2-9** `koota.ts` → `scenario` dependency inversion fix
- [ ] **CR-P2-10** ci.yml check matrix SHA unification (or drop artifact-share)
- [ ] **CR-P2-11** Post-publish provenance verify + ROLLBACK.md runbook
- [ ] **CR-P2-12** Reassess automerge after branch protection lands
- [ ] **CR-P2-13** Docs: CLI reference rename artifact, rename migration page, JSON-flag schemas, OUT_ROOT danger
- [ ] **CR-P2-14** Remove 3 it.skip stubs; tighten prototype-pollution test assertion
- [ ] **CR-P2-15** `requirePlacementState` deep spread → final-snapshot-only
- [ ] **CR-P2-16** Remove `tsconfig.json` `ignoreDeprecations: "6.0"`
- [ ] **CR-P2-17** tsup: treeshake + bundle-vs-external resolution + size-budget test
- [ ] **CR-P2-18** release.yml: pin npm CLI version + cyclonedx as devDep

## P3 — Backlog

- [ ] **CR-P3-1** Architecture decomposition: script.ts/gameboard.ts/systems.ts/catalog.ts; simulation script contracts split to `src/simulation/script-types.ts` + `src/simulation/script-validators.ts`; gameboard plan contracts split to `src/gameboard/plan.ts`
- [ ] **CR-P3-2** noRestrictedImports enforcement gaps + .js suffix variants
- [ ] **CR-P3-3** interop/coverage.ts cohesion documentation
- [ ] **CR-P3-4** Branded types migration tracking
- [ ] **CR-P3-5** useStableOptions JSON.stringify empty fast-path
- [ ] **CR-P3-6** Nightly bench workflow with artifact upload
- [ ] **CR-P3-7** Inline docs: A*, patrol state machine, script.ts section map, docs/ canonical pointer
- [ ] **CR-P3-8** CI_GITHUB_TOKEN → repo-scoped GitHub App
- [ ] **CR-P3-9** interop/internal barrel direct import fix
- [ ] **CR-P3-10** advancePatrolEntity state-machine refactor
- [ ] **CR-P3-11** hashFile missing 'close' event
- [ ] **CR-P3-12** simulation/simulation.ts double-shim collapse

## Acceptance Criteria

- All P0 items shipped before the next release PR is merged
- All P1 items shipped before any non-patch version bump
- P2/P3 items tracked in directive, addressed in sprint order
- Full review source files: `.full-review/0{1-5}-*.md`
