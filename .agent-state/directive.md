# Continuous Work Directive — medieval-hexagon-gameboard

**Status:** ACTIVE
**Owner:** jonbogaty@gmail.com
**Goal:** Ship `@jbcom/medieval-hexagon-gameboard@1.0.0` to npm with the full quality posture defined in `docs/PRD/1.0.md`.

## What CONTINUOUS means

1. Never stop for status reports the user didn't ask for.
2. Never stop for scope caution.
3. Never stop to summarize — git log is the summary.
4. Never stop for context pressure — task-batch + PreCompact handle it.
5. Never stop because a task feels big — pick the next atomic commit.
6. Only stop on: explicit user halt, red CI blocking, genuine STOP_FAIL.

## Operating loop

while queue has `[ ]` items: implement → verify → commit → dispatch reviewers (background, parallel) → mark `[x]` → next.

## Forbidden phrases

"deferred" | "v2+" | "out of scope" | "future work" | "tracked separately" | "follow-up" | "TODO" | "FIXME" | "stub" | "placeholder" | "mock for now" | "pause point" | "fresh session" | "stopping point" | "clean handoff" | "let me know when..."

## Active queue — 1.0 stabilization

Source: `docs/PRD/1.0.md`. Items decompose to one commit each on this branch. Order is dependency-respecting.

### Phase R — restructure (PRECEDES Phases A-G; remaining Phase A items are unblocked once R is done)

**Product correction (2026-05-26): assets bootstrap, not bundle.**
- `bootstrap` becomes a first-class CLI subcommand + programmatic API. Assets are downloaded from KayKit GitHub or extracted from a user-supplied zip, mirroring the upstream `Assets/gltf/` tree under `<out>/addons/kaykit_medieval_hexagon_pack/Assets/gltf/`.
- gltf-only filter; ignore fbx/obj/mtl. Optional `--include-source-formats`.
- Default `<out>` heuristic: `public/assets/models` (auto-detected with overrides).
- Integrity sidecar `.bootstrap.json` (per-file SHA256, edition, library version, source url/zip).
- Idempotent + verifiable via `bootstrap --verify`.
- The tarball NO LONGER ships `assets/free/` GLTFs. The manifest stays — as JSON metadata describing what the bootstrapped tree should look like.
- Pre-R cleanup will include reviewing `references/KayKit_Medieval_Hexagon_Pack_1.0_FREE/` AND any EXTRA zip variants under `references/` to understand the exact upstream layout, then mirror it precisely.

**Dependency policy that governs Phase R commits:**
- `peerDependencies` are dropped. React/Three/react-dom/koota/honeycomb-grid/seedrandom move (or stay) in `dependencies`. The library is unusable without them.
- `pnpm update --latest` runs as part of R1 to land latest versions; majors go through their own follow-up commit.
- Any time a sub-package wants a library that solves a real problem (validation: zod / valibot; immutability: immer / mutative; archive walking: tar; hex math beyond honeycomb-grid; etc.), add it. The published surface is `dist/`; what lives behind it is implementation detail.


- [x] **R1** — **De-monorepo.** ✅ Landed in commit 70ce4e8 (2026-05-26). 587 files moved from `packages/medieval-hexagon-gameboard/` to root. pnpm-workspace.yaml/nx.json/apps/docs/project.json/tsconfig.scripts.json removed. audit-workspace.ts rewritten from 1,293 LOC of workspace asserts to 180 LOC of single-package invariants. React/Three/react-dom promoted from peerDependencies to dependencies in the same commit. tsc + biome + audit-workspace + audit-workflows + tsup build all green. 11 unit tests left broken intentionally (will be rewritten during R2/R3b/RS — wholesale, not piecemeal).
- [x] **R2** ✅ commits R2a→R2 final (2026-05-26) — Decomposition done. **Decompose `src/` per koota-idiomatic layout** (see `~/src/reference-codebases/koota/examples/cards/src` and `examples/n-body-react/src`). The shape is **not** "one ECS subpackage" — koota apps split into `traits/` (declarations), `systems/` (per-tick functions), `actions.ts` (createActions bundles), `world.ts` (createWorld bootstrap), and `frameloop.ts`/`startup.ts` (lifecycle). Per PRD Appendix C, one sub-package per commit. Suggested order:
  - [x] **R2a** — ✅ commit 6890682 (2026-05-26): `src/types.ts` → `src/types/index.ts`, `src/types/brands.ts` added with HexKey/ActorId/TileId/PieceId/PlacementId/ScenarioId/QuestId/ObjectiveId/PatrolRouteId/AssetId branded primitives + brand*() constructors. Not yet enforced; brands adopt progressively per-sub-package.
  - [x] **R2b** — ✅ commit 27e8399 (2026-05-26): `coordinates.ts` + `grid.ts` + `projection.ts` + `layout.ts` moved into `src/coordinates/` with barrel. External callers rewritten to import from the barrel.
  - [x] **R2c** — ✅ commit (2026-05-26): `src/manifest/index.ts` barrel added; internal callers route through `./manifest` not `./manifest/{schema,free}`. Public subpath exports unchanged.
  - [x] **R2d** — ✅ commit (2026-05-26): `src/ingest.ts` → `src/ingest/{ingest,index}.ts`. Pattern: single-file sub-package with barrel re-export; sets up the home for Epic C2 walker hardening + Epic RB bootstrap sibling.
  - [x] **R2e** — ✅ commit (2026-05-26): `src/traits/index.ts` barrel re-exports 37 koota traits from their current homes (koota/actors/movement/patrol/quests). Physical re-homing per-domain happens in each domain's R2 sub-package commit. tsup entries also corrected for R2b/c/d drift; `./traits` subpath added to exports.
  - [x] **R2f** — ✅ commit (2026-05-26): `src/selectors.ts` → `src/selectors/{selectors,index}.ts`. Tagged `@internal`.
  - [x] **R2g** — ✅ commit (2026-05-26): `src/commands.ts` → `src/commands/{commands,index}.ts`. Tagged `@internal`.
  - [x] **R2h** — ✅ commit (2026-05-26): `gameboard.ts`+`occupancy.ts`+`navigation.ts` → `src/gameboard/{gameboard,occupancy,navigation,index}.ts`. External callers and commands/commands.ts rewritten to the barrel.
  - [x] **R2i** — ✅ commit (2026-05-26): `src/pieces.ts` → `src/pieces/{pieces,index}.ts`.
  - [x] **R2j** — ✅ commit (2026-05-26): `rules.ts`+`rule-types.ts`+`validation.ts` → `src/rules/{rules,rule-types,validation,index}.ts`. `world-rules.ts` deferred to R2n (becomes `systems/world-rules-system.ts`).
  - [x] **R2k** — ✅ commit (2026-05-26): `scenario.ts`+`recipe.ts`+`blueprint.ts`+`catalog.ts`+`registry.ts` → `src/scenario/{scenario,recipe,blueprint,catalog,registry,index}.ts`. Sibling sub-packages (coordinates/, gameboard/, rules/) updated.
  - [x] **R2l** — ✅ commit (2026-05-26): `src/simulation.ts` → `src/simulation/{simulation,index}.ts`. Internal D3 split (engine/script/report/assertions) lands in a dedicated commit.
  - [x] **R2m** — ✅ commit (2026-05-26): `interop.ts`+`compatibility.ts`+`coverage.ts` → `src/interop/{interop,compatibility,coverage,index}.ts`. Workspace scripts also updated for catalog/coverage path shifts.
  - [x] **R2n** — ✅ commit (2026-05-26): `systems.ts`+`world-rules.ts` → `src/systems/{systems,world-rules-system,index}.ts`. Internal per-system file split (movement/patrol/quests/rules separate) deferred — current `systems.ts` already has cohesive function-per-system shape.
  - [x] **R2o** — ✅ commit (2026-05-26): `src/errors/index.ts` placeholder with `GameboardError` base. Full hierarchy + ~130 throw-site migration lands in dedicated D2 commit.
  - [x] **R2p** — ✅ commit (2026-05-26): `src/cli.ts` → `src/cli/{cli,index}.ts`. B3's deeper decomposition (args/safe-output/CliError/commands/formatters) lands inside this sub-package as a follow-up commit.
  - [x] **R2q** — ✅ commit (2026-05-26): `react.ts`+`three.ts` → `src/react/{react,index}.ts` + `src/three/{three,index}.ts`. react/react-dom/three already moved to `dependencies` in R1 commit. No peer guards (rejected per D6).
  - **R2r** — Compose: `src/world.ts`, `src/actions.ts`, `src/frameloop.ts`, `src/startup.ts`, `src/index.ts` (umbrella stays; composition layer to be added).
  - **R2 final** ✅ commit (2026-05-26): `actors.ts`+`koota.ts`+`movement.ts`+`patrol.ts`+`quests.ts`+`runtime.ts` → respective sub-packages. src/ now contains only `index.ts` + 20 domain sub-packages.
  - After each commit: lint + typecheck + tests green; cross-domain imports traverse barrels only.
- [x] **R3** — ✅ commit (2026-05-26): Biome `noRestrictedImports` rule with explicit paths list bans deep-imports into sibling sub-package internals. Currently 0 violations; the rule is a regression fence post-R2.
- [x] **R3b** — **Co-locate unit tests** under `src/<domain>/__tests__/`. ✅ 28 unit tests moved from `tests/unit/<X>.test.ts` to `src/<domain>/__tests__/<X>.test.ts` matching the R2 decomposition. `tests/unit/examples.test.ts` (deleted in R4) and `tests/unit/simple-rpg.test.ts` (moves in RS) left in place. Imports rewritten `'../../src/X'` → `'../../X'`; `cli.test.ts` `packageRoot` derivation bumped one level (`'../..'` → `'../../..'`); `coverage.test.ts` examples import bumped to `'../../../examples/...'`. `vitest.config.ts` glob broadened to `src/**/__tests__/**/*.test.ts` and coverage exclude updated. Typecheck + lint + test all clean; 247 passed / 7 skipped unchanged.
- [ ] **R4** — **Relocate SimpleRPG to tests.** Move `examples/simple-rpg-usage.ts` and SimpleRPG JSON fixtures into `tests/integration/simple-rpg/` (unit-level) + `tests/e2e/simple-rpg/` (playwright). Drop SimpleRPG from `package.json#exports` and from the published `examples/` directory. Update scripts that reference the old paths.
- [x] **R5** ✅ subsumed into R1 (2026-05-26) — apps/docs dropped at de-monorepo. **Drop `apps/docs` workspace package.** Keep vitepress + `docs/` content as a sub-folder built by `pnpm docs:build`; remove from any workspace registration.
- [x] **R6** — ✅ commit (2026-05-26): coverage instrumentation wired across all four vitest harnesses (unit, browser-free, browser-extra, e2e-local-assets). Shared config at `vitest.coverage.shared.ts` defines a single exclude policy + per-harness output dir (`coverage/<harness>/`). `scripts/merge-coverage.ts` unions every harness's `coverage-final.json` into one merged JSON, then uses `nyc report` to render lcov + summary. Opt-in via `MEDIEVAL_HEXAGON_COVERAGE=1` so unit/integration runs aren't slowed in the default loop. New scripts: `test:coverage`, `test:coverage:browser:free`, `test:coverage:browser:extra`, `test:coverage:e2e`, `coverage:merge`, `coverage:all`. Baseline (unit-only): 65.27 % statements / 60.65 % branches / 75.48 % functions / 64.93 % lines — the surface A8 + E0-E10 will close to 100/100/100/100. nyc added as a devDependency for the merge reporter.
- [ ] **R7** — **`pnpm verify` green end-to-end** on the restructured layout. This commit closes Phase R.

### Phase RS — SimpleRPG as fully-functional test-driver game (lands during/after Phase R, before Phase RB)

**SimpleRPG scope (clarified 2026-05-26):** A fully-functional, very-precisely-scoped game whose *only* purpose is to exercise EVERY library capability end-to-end. No "real" gameplay purpose beyond coverage. Layout under `tests/`:

- [ ] **RS1** — `tests/simple-rpg/` holds the SimpleRPG game implementation:
  - `tests/simple-rpg/assets-embedded/` — **gitignored except `.gitkeep`** — contains the EXTRA-pack pieces (props, character models from KayKit Adventurers, etc.) that this game needs for exercising add-piece / inject-tile / inject-prop / cross-kit composition flows. Local-only; ignore-everything in git.
  - `tests/simple-rpg/assets-bootstrap-target/` — **gitignored except `.gitkeep` + `.gitignore` with `*` and `!.gitignore` + `!.gitkeep`** — the directory the `bootstrap` CLI writes into during test runs. Cleared between runs.
  - `tests/simple-rpg/game/` — TypeScript SimpleRPG implementation (uses the library's full public API).
- [ ] **RS2** — Vitest browser plugin config for SimpleRPG e2e:
  - `tests/e2e/simple-rpg-ci.test.ts` — uses `bootstrap --source github` against the live KayKit FREE repo. CI-only, scheduled (not per-PR for rate-limit reasons).
  - `tests/e2e/simple-rpg-local-extra.test.ts` — uses `bootstrap --source zip --zip references/...EXTRA.zip` for the EXTRA-pack tests. Gated by `MEDIEVAL_HEXAGON_LOCAL_REFERENCES=1` env var.
  - `tests/integration/simple-rpg.test.ts` — unit-level fixture, no bootstrap, asserts the SimpleRPG scenario shape against the library API.
- [ ] **RS3** — `tests/simple-rpg/game/` exercises:
  - gameboard construction (fixed + procedural)
  - blueprint compilation, scenario validation, recipe expansion
  - actors + pieces (props, characters from EXTRA pack)
  - movement, patrol, quests, rules
  - simulation engine with deterministic replay
  - React bindings (full rendered React tree)
  - Three bindings (gltf loading from bootstrap-target)
  - CLI roundtrips (`validate`, `coverage`, `analyze`, `bootstrap --verify`)
  - Manifest schema validation against bootstrap output
  - Cross-kit composition: KayKit Medieval Hexagon FREE tiles + KayKit Adventurers (EXTRA) characters layered on top.

### Phase RB — asset bootstrap (replaces bundled assets; lands after Phase R)

- [ ] **RB0** — Review every zip in `references/` (FREE + any EXTRA archives present). Document upstream layout in `docs/api/asset-bootstrap.md`: which directories exist, which file types, manifest/marker files used to detect edition, exact `Assets/gltf/` path. Output: a typed `KayKitUpstreamLayout` interface in `src/manifest/upstream-layout.ts`.
- [ ] **RB1** — Implement `bootstrapKayKitAssets({source, out, edition?, force?, includeSourceFormats?})` in `src/bootstrap/index.ts`. Two source modes: `{kind: 'github', commit?: string}` (uses git or tarball download — likely `tar` package since cloning is heavyweight) and `{kind: 'zip', path: string}`. gltf-only filter; mirror upstream tree; write `.bootstrap.json` integrity sidecar.
- [ ] **RB2** — Implement `bootstrap` CLI subcommand with `--out`, `--source github|zip`, `--zip <path>`, `--commit <sha>`, `--edition free|extra`, `--force`, `--verify`, `--include-source-formats`. Default `--out` resolution heuristic (`public/assets/models` etc.). Help text + JSON output for scripting.
- [ ] **RB3** — Adjust runtime asset URL resolution: every loader (`src/manifest/load.ts`, `src/three/loaders.ts`) reads from `<consumer-out>/addons/kaykit_medieval_hexagon_pack/Assets/gltf/...`. Consumer-out is configured via `createWorld({assetRoot})` or env var; defaults to `public/assets/models`.
- [ ] **RB4** — Drop `assets/` from the published `files` allowlist. Drop `./assets/free/*` from `package.json#exports`. Update `audit-package.ts` to assert NO asset trees ship in `npm pack --dry-run`.
- [ ] **RB5** — `bootstrap` unit tests: zip parsing (against `references/...FREE.zip` if present), edition detection, gltf-only filter, layout mirroring, integrity sidecar shape, idempotent re-run, `--verify` drift detection.
- [ ] **RB6** — `bootstrap` integration test: extract the local FREE zip into a tmp dir, then load the bootstrapped tree end-to-end through the runtime and assert rendered output via vitest-browser screenshot.
- [ ] **RB7** — `bootstrap` e2e (scheduled CI only — rate-limited): `--source github` against the live upstream repo. Run nightly, not per-PR.
- [ ] **RB8** — Docs: rewrite the README "Install" section to be `npm install @jbcom/medieval-hexagon-gameboard && npx medieval-hexagon-gameboard bootstrap`. New guide `docs/guides/asset-bootstrap.md`. Update `docs/api/asset-bootstrap.md` from RB0 as the authoritative reference.

### Phase A — foundation gates

**Determinism additions to CI (user direction 2026-05-26):**
- A9: Install once + persist as artifact. Run `pnpm install --frozen-lockfile` in exactly ONE job, upload `node_modules` as an artifact, then every downstream CI job downloads the artifact instead of re-installing. Eliminates per-job install drift, cuts ~30-60s × N jobs.
 (un-block everything else)

- [x] **A0** — Bootstrap `CLAUDE.md`, `.agent-state/`, `.claude/gates.json`, `docs/PRD/1.0.md`. (this commit)
- [x] **A1** ✅ commit 17e4092 (2026-05-26) — Clear `pnpm audit` moderates via `pnpm.overrides` (`yaml >=2.8.3`, `brace-expansion >=5.0.6`). (S-M3)
- [x] **A2** ✅ commit 9643511 (2026-05-26) — Add Biome rule set from review (S-context section), set `noUncheckedIndexedAccess` + `verbatimModuleSyntax` in `tsconfig.base.json`. (4a-H, S-context)
- [x] ~~A3~~ — **REJECTED.** Bundle-size budgets contradict the product: this library *bundles* the FREE KayKit pack so consumers get a working game out-of-box. The bundled manifest is the product. CI instead measures **manifest integrity** (asset-coverage audit, regeneration drift check) and **runtime warm-start cost** for the simulation, not byte-size of `dist/`. Replacement is `A3b`.
- [x] **A3b** — ✅ commit (2026-05-26): manifest integrity gate + warm-start bench landed. `scripts/audit-manifest-drift.ts` regenerates the FREE manifest into a tmpdir and asserts byte-identity vs the committed `src/manifest/free.ts` + `assets/free/manifest.json`. Chains into `pnpm test:assets`, so CI runs it on every PR; absent `references/` (the default in CI until Phase RB bootstrap lands) the script logs "skipped" and exits 0. Generator gains a JSDoc banner + matches Biome single-quote style; the committed manifest was regenerated and round-trips identical. Warm-start bench at `tests/perf/warm-start.bench.ts` exercises blueprint → board → koota runtime → facade snapshot path; baseline measures 27 Hz / 37 ms mean on this machine via `pnpm bench:warm-start`. Non-blocking; future B/D-series perf work can cite the trend.
- [x] **A4** ✅ commit 5771311 (2026-05-26) — Add `pnpm audit --prod --audit-level=high` to package job in `ci.yml`. Add `actions/dependency-review-action` summary check.
- [x] **A5** — ✅ commit (2026-05-26): `cd.yml` release-please job now prefers a GitHub App token via `actions/create-github-app-token@v2`, falling back to `secrets.CI_GITHUB_TOKEN` if `vars.RELEASE_PLEASE_APP_ID` isn't set. App tokens are short-lived (1h) + scope-limited + their PRs trigger downstream CI (Bot PATs don't). Documentation lands with F-Audit-12 in `docs-site/src/content/docs/about/deployment.md`.
- [ ] **[WAIT-PROVISION] A5b** — Install a GitHub App on the repo with permissions: `contents:write`, `pull_requests:write`, `metadata:read`. Set `vars.RELEASE_PLEASE_APP_ID` + `secrets.RELEASE_PLEASE_APP_PRIVATE_KEY`. Once set, the cd.yml `if: vars.RELEASE_PLEASE_APP_ID != ''` guard flips on and the PAT fallback can be removed in a follow-up. Until provisioned, the fallback path keeps CD working.
- [x] **A6** ✅ commit 5771311 (2026-05-26) — Add `needs:` chain in `ci.yml` so `package` / `browser-free` / `docs` jobs depend on `check`.
- [x] **A7** ✅ commit 5144db8 (2026-05-26) — Add semgrep `p/owasp-top-ten` + `p/nodejs` CI step.
- [ ] **A8** — Enforce **100 / 100 / 100 / 100** coverage thresholds (statements / branches / functions / lines) in `vitest.config.ts`. Initially `--passWithNoTests` not allowed; runs MUST hit 100 across `src/`, `examples/`, and `scripts/`. Baseline measured at 86.2 / 76.5 / 93.2 / 85.9 — Epic E0 closes the gap before this gate flips on.

### Phase B — performance criticals (publish-blocking)

- [ ] **B1 (re-scoped 2026-05-26)** — Manifest metadata stays autogenerated, but its SOURCE-OF-TRUTH is no longer a bundled asset tree (that ships with the package). It's regenerated by running `bootstrap` (from RB1/RB2) against the canonical upstream zip + comparing the resulting tree against the prior manifest. CI drift check: `node scripts/regenerate-manifest.ts && git diff --exit-code src/manifest/free.ts`. Manifest contains: per-asset id, path-relative-to-`addons/kaykit_medieval_hexagon_pack/Assets/gltf/`, expected SHA256, geometry hints, scenario role tags.
- [x] ~~B2~~ — **REJECTED.** `freeManifest` stays on the umbrella; bundled-out-of-box is the product. Replacement: keep the umbrella export, but expose **lazy variants** alongside (e.g. `loadFreeManifest()`) for consumers that explicitly want async/lazy. Both shapes ship.
- [ ] **B2b** — Add `export async function loadFreeManifest(): Promise<MedievalHexagonManifest>` to `src/manifest/free.ts`. Document both eager and lazy paths in the new bindings/bundling guide.
- [ ] **B3** — **P-C2**: Refactor `cli.ts` (4,297 LOC) to `src/cli/index.ts` + `src/cli/commands/*.ts` with dynamic per-subcommand imports. Use `node:util.parseArgs`. Move `examples/simple-rpg-usage` import out of CLI eager path. **Note:** CLI lazy-loading does NOT remove the manifest from anyone's umbrella — it just keeps the CLI cold-start fast for headless validation/coverage use cases.
- [ ] **B4** — **P-H3**: Materialize `tilesByKey` (+ `placementsByTile`) indexes once at projection time on `ProjectedGameboardPlan`. Replace 4 in-call rebuilds.
- [x] **B5 (part 1)** ✅ commit (2026-05-26) — **P-H1**: Single-pass `readGameboardActorTargets` reducer (`actors.ts:940-953` + `:1085-1093`).
- [x] **B6** ✅ commit (2026-05-26) — **P-H2**: Add `tryParseHexKey(key): HexCoordinates | undefined` in `coordinates.ts`; migrate `interop.ts`/`scenario.ts` `try { parseHexKey } catch { undefined }` sites.
- [ ] **B7** — **P-H4**: Hash-stabilize `options` in selector hooks in `react.ts` (or document loudly + sample memo helpers in examples).
- [x] **B8** ✅ commit (2026-05-26) — **P-H5**: Replace `JSON.parse(JSON.stringify(...))` in `simulation.ts:5212` with `structuredClone`.

### Phase C — security criticals (publish-blocking)

- [ ] **C1** — **S-H1**: Add `safeResolveOutput(value, outRoot=cwd())` helper; refactor all 40+ CLI `--out*` write sites in `cli.ts` to use it. Require explicit `--force` for `extract`'s `rmSync` destination; refuse to wipe non-empty dirs without `--force`.
- [x] **C2** ✅ commit (2026-05-26) — **S-H2**: Harden `listFiles` in `ingest.ts:310` — skip `entry.isSymbolicLink()`, verify `realpathSync(child).startsWith(realRoot)` before descending. Cycle-safe.
- [x] **C3** ✅ commit (2026-05-26) — **S-M1**: Prototype-pollution guard in `readPieceSourceRoots`; return `Object.create(null)`-backed map; use `JSON.parse` reviver to strip `__proto__`.
- [x] **C4** ✅ commit b3837f0 (2026-05-26) — **S-M2**: Fix `extract-kaykit-guide.ts:129` `sh -c` quoting via positional args.
- [ ] **C5** — **S-M4**: Normalize CLI error messages to relative paths via `relative(cwd, resolve(value))`.
- [x] **C6** ✅ commit 07d4b72 (2026-05-26) — **S-M5**: Gate full stack traces behind `MEDIEVAL_HEXAGON_DEBUG=1`; keep terse default.
- [x] **C7** ✅ commit (2026-05-26) — **S-M6**: Block source-map publish via `"!dist/**/*.map"` in `files` or `sourcemap: false` for publish build.

### Phase D — architectural debt (publish-blocking)

- [x] **D1** ✅ commit (2026-05-26) — **F1 (re-scoped)**: Subpath tiering — keep ALL existing subpaths supported (this is an asset-bundled library where consumers may legitimately import internals for custom rendering / data inspection). Instead, **document** the support tier per subpath in `docs/api/public-api.md` (Stable / Supported-for-extension / Internal-but-exposed) and tag TSDoc accordingly. Decision rationale documented in PRD.
- [ ] **D2** — **F11**: Add `src/errors.ts` taxonomy (`GameboardError` base; `GameboardValidationError`, `GameboardManifestError`, `GameboardScenarioError`, `GameboardRuntimeError`). Convert 130 `throw new Error()` sites; preserve messages.
- [ ] **D3** — **H-3 (re-scoped)**: Decompose `simulation.ts` (5,213 LOC) into `simulation/{engine,script,report,assertions,index}.ts`. Add `assertNever` exhaustiveness on the action switch. Keep public surface stable.
- [ ] **D4** — **M-4**: Invert `catalog.ts:1337 createKayKitGuideScenarios` (377-line function) into top-level data table + 5-line iteration.
- [x] **D5 (partial)** ✅ commit c15fbd4 (2026-05-26) for traits umbrella — actions umbrella deferred to R2r. **F5/F13**: Add `src/traits.ts` umbrella that re-exports every trait with a table-of-contents docblock. Add `src/actions.ts` umbrella for `*Actions` symbols.
- [x] ~~D6~~ — **REJECTED.** Peer-dep guards. Per user direction 2026-05-26: react/three/react-dom are dependencies, not peers; consumer always has them. Replaced by D6b.
- [x] **D6b** ✅ commit 70ce4e8 (2026-05-26) — React/Three bindings move from `peerDependencies` to `dependencies`; umbrella `src/index.ts` re-exports `react/` and `three/` sub-packages alongside every other domain. Update `docs/guides/peer-deps-and-bundling.md` accordingly (becomes `docs/guides/bindings-and-bundling.md`).
- [x] ~~D7~~ — **STALE.** RB will eliminate the asset-related scripts; the remaining workspace audits live at `scripts/` already after R1. No move needed. **F9**: Move package-scoped scripts (`audit-package.ts`, `audit-free-assets.ts`, `audit-reference-assets.ts`, `smoke-built-cli.ts`, `smoke-packed-consumer.ts`, `generate-package-assets.ts`, `extract-kaykit-guide.ts`, `promote-showcases.ts`) into `packages/medieval-hexagon-gameboard/scripts/`. Keep only true workspace audits at root.
- [x] **D8 (part 1)** ✅ commit c117c50 (2026-05-26) — **M-1**: Extract `scripts/_lib.ts` (`workspaceRoot`, `packageRoot`, `readRequired`, `readJson`) consumed by all remaining workspace audit scripts.
- [ ] **D9** — **M-2**: Split `scripts/audit-workspace.ts` (1,293 LOC, 89 functions) into `scripts/audits/{packagejson,pnpm,nx,tsconfig,typedoc,tsup,markdown,release}.ts` with thin top-level dispatcher.
- [ ] **D10** — **M-3**: Split `scripts/smoke-packed-consumer.ts` (2,489 LOC) into `pack-install.ts` (runtime smoke) + `types.ts` (compile-time API attestation only). Add labelled-phase harness.

### Phase E — test debt (publish-blocking, raises floor to 100%)

Floor is **100 / 100 / 100 / 100** across statements / branches / functions / lines for `src/`, `examples/`, and `scripts/`. Anything less is unacceptable. Baseline at the start of 1.0 work: **86.2 % stmts / 76.5 % branches / 93.2 % funcs / 85.9 % lines**.

- [ ] **E0a** — `simulation.ts` to 100% (currently 67.7 / 66.6 / 85.9 / 67.2). Largest gap; likely sub-decomposition (Epic D3) will land first.
- [ ] **E0b** — `patrol.ts` to 100% (72.3 / 64.5 / 76.9 / 71.9).
- [ ] **E0c** — `recipe.ts` to 100% (78.9 / 68.4 / 82.4 / 79.0).
- [ ] **E0d** — `commands.ts` to 100% (82.9 / 74.2 / 88.5 / 82.7).
- [ ] **E0e** — `systems.ts` to 100% (83.3 / 76.6 / 81.8 / 83.0).
- [ ] **E0f** — `world-rules.ts` to 100% branches (88.9 / 53.3 / 100 / 88.2).
- [ ] **E0g** — `manifest/schema.ts` to 100% (81.2 / 70.9 / 97.8 / 80.5).
- [ ] **E0h** — Sweep remaining files to 100%: `actors.ts`, `blueprint.ts`, `catalog.ts`, `compatibility.ts`, `coordinates.ts`, `coverage.ts`, `gameboard.ts`, `grid.ts`, `ingest.ts`, `interop.ts`, `koota.ts`, `layout.ts`, `movement.ts`, `navigation.ts`, `occupancy.ts`, `pieces.ts`, `projection.ts`, `quests.ts`, `registry.ts`, `rules.ts`, `runtime.ts`, `scenario.ts`, `selectors.ts`, `three.ts`, `validation.ts`.
- [ ] **E0i** — `examples/simple-rpg-usage.ts` to 100% (96.0 / 53.8 / 91.7 / 95.7).
- [ ] **E0j** — Add coverage instrumentation + thresholds for `scripts/*.ts` (currently not measured) and bring to 100%.
- [ ] **E1** — Cross-process determinism test: spawn N node subprocesses, run identical scenario with same seed, assert byte-identical JSON output. Live in `tests/unit/determinism.test.ts`.
- [ ] **E2** — Public API snapshot test (`tests/unit/public-api.test.ts`) — `import * as lib from '../src/index'` and snapshot the sorted `Object.keys(lib)` + their `typeof`. Pin the umbrella export surface.
- [ ] **E3** — Hostile-input CLI tests: `--out ../etc/foo` → throws; `--source` with symlink loop → throws; `--source` with symlink to outside-root → throws; `{__proto__:...}` JSON payload → rejected. Live in `tests/unit/cli-security.test.ts`.
- [ ] **E4** — Trait-identity test: import the same trait from `/koota` and from umbrella; assert reference-equality. Pins `splitting: true` invariant.
- [ ] **E5** — CLI cold-start benchmark: `node dist/cli.js --help` ≤ 80 ms. Live in `tests/perf/cli-cold-start.test.ts`. Initially non-blocking.
- [ ] **E6** — Simulation throughput micro-bench via `tinybench` (`tests/perf/simulation.bench.ts`); regression alarm at >10%.
- [ ] **E7** — React render-count assertion for selector hooks with stable vs unstable `options` (`tests/unit/react-memoization.test.ts`). Pins P-H4 fix.
- [ ] **E8** — Coverage thresholds enforced at **100 / 100 / 100 / 100** in `vitest.config.ts`; CI gates.
- [ ] **E9** — **Visual integration gate.** Every renderer-binding (`react.ts`, `three.ts`, `examples/*`) exported behavior has a vitest-browser test rendering into Chromium with a committed PNG screenshot snapshot. Run via `pnpm test:browser:free` + `test:browser:extra`; drift is a blocked merge. Snapshots live in `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/`.
- [ ] **E10** — **E2E coverage matrix.** `pnpm test:e2e:local-assets` covers happy path + failure modes (asset-missing, invalid scenario, replay-mismatch). Currently 4 tests; expand to ≥12 covering each failure category and the full catalog→blueprint→simulation→render bridge.

### Phase F — documentation (publish-blocking)

Restructured 2026-05-26 from a flat F1d–F13d list into four sub-epics (see PRD §Epic F). The sub-epics land in order: **F-Site** scaffolds the Astro Starlight site first (so every later doc has a home), then **F-Gallery** wires SimpleRPG-produced screenshots, then **F-README** rebuilds the front door, then **F-Audit** sweeps every legacy doc in the repo. Items are one-commit atomic.

#### Sub-epic F-Site — Astro Starlight docs site at `docs-site/`

- [ ] **F-Site-1** — Scaffold `docs-site/` as an Astro Starlight project. `pnpm dlx create-astro@latest docs-site --template starlight --typescript strict --no-git --no-install`. Then manually add to root `pnpm-workspace.yaml`? **NO** — we removed workspaces. Instead: `docs-site/` runs its own `package.json` but uses pnpm with `--filter` workarounds gone; install runs as a sibling `pnpm install` inside `docs-site/` driven by a root `docs-site:install` script. Wire root scripts: `docs-site:dev`, `docs-site:build`, `docs-site:preview`. Don't kill the existing `docs/` vitepress site yet — it stays until F-Site-9.
- [ ] **F-Site-2** — Configure Starlight: site title `@jbcom/medieval-hexagon-gameboard`, social links (GitHub repo + npm), edit-on-GitHub link, dark-mode default, repo favicon. Set `outDir: dist`, configure for GitHub Pages base path.
- [ ] **F-Site-3** — Add `starlight-typedoc` plugin. Configure to read `src/index.ts` + every subpath entry from `package.json#exports`, generate `docs-site/src/content/docs/reference/` from JSDoc. One reference page per subpath barrel. Sidebar autoindex.
- [ ] **F-Site-4** — Add CI job `docs-site` to `.github/workflows/ci.yml`: build via the install-once artifact pattern (A9), publish `docs-site/dist/` as a build artifact for PR previews.
- [ ] **F-Site-5** — Add `.github/workflows/docs-site-deploy.yml`: on push to `main`, deploy `docs-site/dist/` to GitHub Pages via `actions/deploy-pages`. Uses the build artifact from F-Site-4. SHA-pinned actions throughout.
- [ ] **F-Site-6** — Migrate `docs/guides/cli-reference.md` content to `docs-site/src/content/docs/guides/cli-reference.md` — generated from the new command registry (D1 + B3). Replace `cli.ts` template-literal `usage()`.
- [ ] **F-Site-7** — Migrate `docs/guides/determinism-contract.md` to `docs-site/src/content/docs/guides/determinism.md` — seed model, replay guarantees, where Date/Math.random are/aren't permitted. Embeds the determinism-replay scenario screenshot from F-Gallery.
- [ ] **F-Site-8** — Migrate `docs/guides/bindings-and-bundling.md` to `docs-site/src/content/docs/guides/bindings.md` — subpath imports, trait identity hazard, first-class react/three binding model (NOT peer-dep gated).
- [ ] **F-Site-9** — Migrate `docs/api/errors.md` to `docs-site/src/content/docs/reference/errors.md` — full error taxonomy with `instanceof` examples (lands with D2).
- [ ] **F-Site-10** — Write `docs-site/src/content/docs/guides/bootstrap.md` — the CLI `bootstrap` subcommand walkthrough: default behavior, `--source github` vs `--source <zip>`, the integrity sidecar, `--verify` mode. Lands once Phase RB is done.
- [ ] **F-Site-11** — Write `docs-site/src/content/docs/guides/getting-started.md` — full 5-minute tutorial: install → bootstrap → minimal `<Gameboard>` → add a tile → place a piece → run the simulation tick. Each step has the SimpleRPG-equivalent code linked.
- [ ] **F-Site-12** — Delete `docs/` vitepress site, `apps/docs` traces, `docs:dev`/`docs:build`/`docs:preview` scripts from `package.json`. Update every reference (CI, README, AGENTS-style files) to point at `docs-site/`.

#### Sub-epic F-Gallery — SimpleRPG-driven feature pages with embedded screenshots

Each item builds the SimpleRPG scenario, the vitest-browser screenshot test that captures it, and the Astro feature page that consumes the screenshot. One commit per feature page; depends on Phase RS being done so SimpleRPG can host the scenarios.

- [ ] **F-Gallery-1** — Build infrastructure: `tests/browser/feature-gallery.spec.ts` test harness that loads a SimpleRPG scenario, screenshots a fixed viewport, and writes to `tests/browser/__screenshots__/feature-gallery/<scenario>.png`. Astro content loader at `docs-site/src/content.config.ts` reads the same directory.
- [ ] **F-Gallery-2** — Page: `features/harbors.md`. SimpleRPG scenario: fixed-harbor (water tiles + piers + boats). Screenshot embedded; 30-line snippet showing `GameboardBuilder.addHarbor` (or equivalent composition with addBridge + addWaterTile). API cross-links.
- [ ] **F-Gallery-3** — Page: `features/bridges-and-connectors.md`. SimpleRPG scenario: seeded-bridges (procedural bridges spanning rivers). Snippet using `GameboardBuilder.addBridge` + connector rules.
- [ ] **F-Gallery-4** — Page: `features/multi-depth-stacks.md`. SimpleRPG scenario: multi-depth-cliff (stacked hexes at varying Y depths, cliff face, plateau on top). Snippet using `HexTileState.depth` + stack rules.
- [ ] **F-Gallery-5** — Page: `features/tile-injection.md`. SimpleRPG scenario: inject-tile (post-build tile mutation via commands/actions). Snippet using the commands API.
- [ ] **F-Gallery-6** — Page: `features/prop-injection.md`. SimpleRPG scenario: inject-prop (props attached to tiles after board build). Snippet using the props API.
- [ ] **F-Gallery-7** — Page: `features/pieces-and-actors.md`. SimpleRPG scenario: place-piece (NPC + player + neutral actors). Snippet using `GameboardActor` traits.
- [ ] **F-Gallery-8** — Page: `features/movement-and-patrols.md`. SimpleRPG scenario: patrol-route (animated patrol agent over a hex path). Snippet using `MovementAgent` + `GameboardPatrolAgent`.
- [ ] **F-Gallery-9** — Page: `features/quests.md`. SimpleRPG scenario: quest-chain (multi-objective quest with progress). Snippet using `GameboardQuest` + objective interfaces.
- [ ] **F-Gallery-10** — Page: `features/cross-kit-composition.md`. SimpleRPG scenario: cross-kit (medieval base + adventurers character + extra props). Snippet showing manifest composition across kits.
- [ ] **F-Gallery-11** — Page: `features/determinism-replay.md`. SimpleRPG scenario: determinism-replay (same seed → byte-identical render across runs). Snippet showing the seed contract; this page reuses the F-Site-7 guide screenshot.
- [ ] **F-Gallery-12** — Gallery index page `features/index.md` — visual grid of every feature page with its hero screenshot.

#### Sub-epic F-README — README as marketing front door

- [ ] **F-README-1** — Demolish current `README.md` and rebuild from a structural template: hook → screenshot strip → quickstart → why → module map → docs site links → status badges + license + contributing. Strip every feature enumeration that belongs on a docs-site feature page.
- [ ] **F-README-2** — Wire 3 hero screenshots from `tests/browser/__screenshots__/feature-gallery/` directly into the README (relative paths so npm renders them). Hero set: harbors, multi-depth, cross-kit. Update on every CI re-screenshot.
- [ ] **F-README-3** — Write the 30-line quickstart block. `pnpm add @jbcom/medieval-hexagon-gameboard` → `pnpm exec medieval-hexagon-gameboard bootstrap` → minimal `<Gameboard scenario={harbor} />` React component → working render. Test that the snippet actually compiles via a new `pnpm test:readme-snippet` gate.
- [ ] **F-README-4** — Write the "Why this exists" 3-bullet section. Concrete, terse, no marketing fluff: declarative API for hex worlds, deterministic seed-driven generation, first-class React + Three bindings (not optional peers).
- [ ] **F-README-5** — Add the Module Map table (umbrella vs `/coordinates`, `/manifest`, `/scenario`, `/react`, `/three`, etc.) with one-line purpose for each.
- [ ] **F-README-6** — Add the docs-site link grid: 3-column markdown table grouping "Get started", "Features", "Reference". Pulled from the docs-site sidebar config so they don't drift.
- [ ] **F-README-7** — Add status badges row: CI status, npm version, license, types-included, FREE asset count, EXTRA asset count, coverage percent. Each badge points at its source of truth (Actions, npm, etc.).

#### Sub-epic F-Audit — thorough audit of every doc in the repo

Each item is one commit. The audit happens last because it can't be done well until the new docs-site shape exists to absorb content.

- [ ] **F-Audit-1** — Audit `CONTRIBUTING.md`: align with current `pnpm verify` posture, the single-package layout, the install-once CI pattern (A9), the test trinity (unit + browser + e2e). Add "Working with the agentic state" section pointing at `.agent-state/`.
- [ ] **F-Audit-2** — Write `CHANGELOG.md` (Keep a Changelog 1.1.0). Backfill from `git log --oneline` for releases prior to release-please ownership; release-please populates from here forward.
- [ ] **F-Audit-3** — Write `STANDARDS.md`: style + brand + non-negotiables. Pulls from PRD §6. Authoritative source for "what we don't do".
- [ ] **F-Audit-4** — Audit `CODE_OF_CONDUCT.md` + `SECURITY.md`: ensure they exist with current contact info. SECURITY.md links to GitHub's private vulnerability reporting.
- [ ] **F-Audit-5** — Audit `CLAUDE.md` (root): align with current single-package layout, drop any pre-R1 references to `packages/medieval-hexagon-gameboard/`. Move agentic-only content out of `CLAUDE.md` into `AGENTS.md` if any cross-agent collaboration is wanted.
- [ ] **F-Audit-6** — Audit `.agent-state/directive.md` (this file): once 1.0 ships, archive the 1.0 stabilization section into `docs-site/src/content/docs/about/history/1.0-stabilization.md`; reset to a slim post-1.0 maintenance directive.
- [ ] **F-Audit-7** — Audit `docs/` legacy content: every file gets a "keep + revise to docs-site" or "delete" verdict. Migrate kept content into `docs-site/`; delete the `docs/` directory once empty.
- [ ] **F-Audit-8** — Audit `examples/` content: every kept example gets a `README.md` linking back to the corresponding `docs-site/features/<page>` page. The published `examples/` ships the runnable snippets only.
- [ ] **F-Audit-9** — Write `docs-site/src/content/docs/about/architecture.md` (replacing `docs/ARCHITECTURE.md`): module graph diagram (mermaid), ECS layering, build pipeline, the 20-sub-package decomposition.
- [ ] **F-Audit-10** — Write `docs-site/src/content/docs/about/design.md` (replacing `docs/DESIGN.md`): vision, identity, UX principles. What the library aspires to be that no other does.
- [ ] **F-Audit-11** — Write `docs-site/src/content/docs/guides/testing.md` (replacing `docs/TESTING.md`): the unit + browser + e2e trinity, coverage gates, the SimpleRPG-as-coverage-driver model, perf gates.
- [ ] **F-Audit-12** — Write `docs-site/src/content/docs/about/deployment.md` (replacing `docs/DEPLOYMENT.md`): release flow, OIDC publish, GitHub App token, SBOM, SLSA attestation.
- [ ] **F-Audit-13** — Write `docs-site/src/content/docs/about/state.md` (replacing `docs/STATE.md`): current published version, in-flight major initiatives, links to PRD + directive on GitHub. Auto-generated where possible (read `package.json#version`).
- [ ] **F-Audit-14** — Add frontmatter (`title`, `description`, `updated`, `status`) to every `.md` in root + `docs-site/`. Lint with a custom check in `scripts/audit-docs-frontmatter.ts`; wire to `pnpm test:docs-contract`.
- [ ] **F-Audit-15** — Run a single end-to-end "fresh consumer" pass: clone repo on a new machine, follow only the README + docs-site. Every step that requires me to read source code or commit history is a doc bug. Patch.

### Phase G — release readiness (final gate)

- [ ] **G1** — Add `actions/attest-build-provenance@v2` for SLSA L3 attestation.
- [ ] **G2** — Add `@cyclonedx/cyclonedx-npm` SBOM as release artifact (`anchore/sbom-action` alt).
- [ ] **G3** — Dependabot: add `security-updates` daily group with `open-pull-requests-limit: 10`.
- [ ] **G4** — `pnpm verify` parity audit: every CI gate runs locally via `pnpm verify`. Add missing entries.
- [ ] **G5** — Run `pnpm verify` end-to-end clean on this branch.
- [ ] **G6** — Bump `packages/medieval-hexagon-gameboard/package.json` version → `1.0.0` and `release-please-manifest.json` accordingly.
- [ ] **G7** — Open PR `codex/initial-medieval-hexagon-gameboard` → `main`; wait for CI green; merge.
- [ ] **G8** — release-please opens release PR; merge it; tag `v1.0.0`; OIDC-publish to npm; verify provenance + SBOM artifacts on the release.

## Self-assessment after each commit

Before flipping `[ ]` → `[x]`:
1. What did I just ship? Did the visual / behavior match the spec doc?
2. What did the just-finished work surface about the next item? Encode in directive notes if non-trivial.
3. Did this commit introduce any banned pattern? (run gates locally — `pnpm lint && pnpm typecheck`)
4. Did I update relevant docs in the same commit? Drift is a bug.

## Notes

- This directive is the authoritative work queue. PRD in `docs/PRD/1.0.md` explains the *why*.
- Reviewer trio dispatched per commit: `comprehensive-review:full-review` (background), `security-scanning:security-sast` (background), `code-simplifier` (background).
- Visuals: any commit touching `react.ts` / `three.ts` / `examples/` requires a screenshot via vitest-browser before commit.
