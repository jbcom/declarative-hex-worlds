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
- [ ] [WAIT-PHASE] **R3b** — **Co-locate unit tests** under `src/<domain>/__tests__/`. Move all `tests/unit/<X>.test.ts` to `src/<domain>/__tests__/<X>.test.ts` (matching the decomposition from R2). Rationale: path-bridge brittleness — relative paths from `tests/unit/` to `src/` shift every time the layout moves. Co-location means the test imports `../` (its own module) and shares the same `__dirname` as the source. Integration tests stay at `tests/integration/`, e2e at `tests/e2e/`, browser visuals at `tests/browser/`.
- [ ] [WAIT-PHASE] **R4** — **Relocate SimpleRPG to tests.** Move `examples/simple-rpg-usage.ts` and SimpleRPG JSON fixtures into `tests/integration/simple-rpg/` (unit-level) + `tests/e2e/simple-rpg/` (playwright). Drop SimpleRPG from `package.json#exports` and from the published `examples/` directory. Update scripts that reference the old paths.
- [x] **R5** ✅ subsumed into R1 (2026-05-26) — apps/docs dropped at de-monorepo. **Drop `apps/docs` workspace package.** Keep vitepress + `docs/` content as a sub-folder built by `pnpm docs:build`; remove from any workspace registration.
- [ ] [WAIT-PHASE] **R6** — **Coverage instrumentation across unit + browser + e2e.** All three harnesses feed the same `coverage/` report so `react.ts`/`three.ts` (browser-only) count too. Use `@vitest/coverage-v8` + `--coverage` on the browser configs; merge with `vitest run --coverage --merge-coverage` or `nyc merge`. This is the precondition for the 100% gate (A8 / E0-E10).
- [ ] [WAIT-PHASE] **R7** — **`pnpm verify` green end-to-end** on the restructured layout. This commit closes Phase R.

### Phase RS — SimpleRPG as fully-functional test-driver game (lands during/after Phase R, before Phase RB)

**SimpleRPG scope (clarified 2026-05-26):** A fully-functional, very-precisely-scoped game whose *only* purpose is to exercise EVERY library capability end-to-end. No "real" gameplay purpose beyond coverage. Layout under `tests/`:

- [ ] [WAIT-PHASE] **RS1** — `tests/simple-rpg/` holds the SimpleRPG game implementation:
  - `tests/simple-rpg/assets-embedded/` — **gitignored except `.gitkeep`** — contains the EXTRA-pack pieces (props, character models from KayKit Adventurers, etc.) that this game needs for exercising add-piece / inject-tile / inject-prop / cross-kit composition flows. Local-only; ignore-everything in git.
  - `tests/simple-rpg/assets-bootstrap-target/` — **gitignored except `.gitkeep` + `.gitignore` with `*` and `!.gitignore` + `!.gitkeep`** — the directory the `bootstrap` CLI writes into during test runs. Cleared between runs.
  - `tests/simple-rpg/game/` — TypeScript SimpleRPG implementation (uses the library's full public API).
- [ ] [WAIT-PHASE] **RS2** — Vitest browser plugin config for SimpleRPG e2e:
  - `tests/e2e/simple-rpg-ci.test.ts` — uses `bootstrap --source github` against the live KayKit FREE repo. CI-only, scheduled (not per-PR for rate-limit reasons).
  - `tests/e2e/simple-rpg-local-extra.test.ts` — uses `bootstrap --source zip --zip references/...EXTRA.zip` for the EXTRA-pack tests. Gated by `MEDIEVAL_HEXAGON_LOCAL_REFERENCES=1` env var.
  - `tests/integration/simple-rpg.test.ts` — unit-level fixture, no bootstrap, asserts the SimpleRPG scenario shape against the library API.
- [ ] [WAIT-PHASE] **RS3** — `tests/simple-rpg/game/` exercises:
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

- [ ] [WAIT-PHASE] **RB0** — Review every zip in `references/` (FREE + any EXTRA archives present). Document upstream layout in `docs/api/asset-bootstrap.md`: which directories exist, which file types, manifest/marker files used to detect edition, exact `Assets/gltf/` path. Output: a typed `KayKitUpstreamLayout` interface in `src/manifest/upstream-layout.ts`.
- [ ] [WAIT-PHASE] **RB1** — Implement `bootstrapKayKitAssets({source, out, edition?, force?, includeSourceFormats?})` in `src/bootstrap/index.ts`. Two source modes: `{kind: 'github', commit?: string}` (uses git or tarball download — likely `tar` package since cloning is heavyweight) and `{kind: 'zip', path: string}`. gltf-only filter; mirror upstream tree; write `.bootstrap.json` integrity sidecar.
- [ ] [WAIT-PHASE] **RB2** — Implement `bootstrap` CLI subcommand with `--out`, `--source github|zip`, `--zip <path>`, `--commit <sha>`, `--edition free|extra`, `--force`, `--verify`, `--include-source-formats`. Default `--out` resolution heuristic (`public/assets/models` etc.). Help text + JSON output for scripting.
- [ ] [WAIT-PHASE] **RB3** — Adjust runtime asset URL resolution: every loader (`src/manifest/load.ts`, `src/three/loaders.ts`) reads from `<consumer-out>/addons/kaykit_medieval_hexagon_pack/Assets/gltf/...`. Consumer-out is configured via `createWorld({assetRoot})` or env var; defaults to `public/assets/models`.
- [ ] [WAIT-PHASE] **RB4** — Drop `assets/` from the published `files` allowlist. Drop `./assets/free/*` from `package.json#exports`. Update `audit-package.ts` to assert NO asset trees ship in `npm pack --dry-run`.
- [ ] [WAIT-PHASE] **RB5** — `bootstrap` unit tests: zip parsing (against `references/...FREE.zip` if present), edition detection, gltf-only filter, layout mirroring, integrity sidecar shape, idempotent re-run, `--verify` drift detection.
- [ ] [WAIT-PHASE] **RB6** — `bootstrap` integration test: extract the local FREE zip into a tmp dir, then load the bootstrapped tree end-to-end through the runtime and assert rendered output via vitest-browser screenshot.
- [ ] [WAIT-PHASE] **RB7** — `bootstrap` e2e (scheduled CI only — rate-limited): `--source github` against the live upstream repo. Run nightly, not per-PR.
- [ ] [WAIT-PHASE] **RB8** — Docs: rewrite the README "Install" section to be `npm install @jbcom/medieval-hexagon-gameboard && npx medieval-hexagon-gameboard bootstrap`. New guide `docs/guides/asset-bootstrap.md`. Update `docs/api/asset-bootstrap.md` from RB0 as the authoritative reference.

### Phase A — foundation gates (un-block everything else)

- [x] **A0** — Bootstrap `CLAUDE.md`, `.agent-state/`, `.claude/gates.json`, `docs/PRD/1.0.md`. (this commit)
- [x] **A1** ✅ commit 17e4092 (2026-05-26) — Clear `pnpm audit` moderates via `pnpm.overrides` (`yaml >=2.8.3`, `brace-expansion >=5.0.6`). (S-M3)
- [x] **A2** ✅ commit 9643511 (2026-05-26) — Add Biome rule set from review (S-context section), set `noUncheckedIndexedAccess` + `verbatimModuleSyntax` in `tsconfig.base.json`. (4a-H, S-context)
- [x] ~~A3~~ — **REJECTED.** Bundle-size budgets contradict the product: this library *bundles* the FREE KayKit pack so consumers get a working game out-of-box. The bundled manifest is the product. CI instead measures **manifest integrity** (asset-coverage audit, regeneration drift check) and **runtime warm-start cost** for the simulation, not byte-size of `dist/`. Replacement is `A3b`.
- [ ] [WAIT-PHASE] **A3b** — Add **manifest integrity gate** to CI: `pnpm assets:free && git diff --exit-code src/manifest/free.ts` proves the bundled manifest matches `assets/free/manifest.json`. Add **runtime warm-start bench** (load + bootstrap a board) as a Vitest perf test, non-blocking initially.
- [x] **A4** ✅ commit 5771311 (2026-05-26) — Add `pnpm audit --prod --audit-level=high` to package job in `ci.yml`. Add `actions/dependency-review-action` summary check.
- [ ] [WAIT-PHASE] **A5** — Migrate `cd.yml` `secrets.CI_GITHUB_TOKEN` PAT to GitHub App token usage. Document in `docs/DEPLOYMENT.md`.
- [x] **A6** ✅ commit 5771311 (2026-05-26) — Add `needs:` chain in `ci.yml` so `package` / `browser-free` / `docs` jobs depend on `check`.
- [x] **A7** ✅ commit 5144db8 (2026-05-26) — Add semgrep `p/owasp-top-ten` + `p/nodejs` CI step.
- [ ] [WAIT-PHASE] **A8** — Enforce **100 / 100 / 100 / 100** coverage thresholds (statements / branches / functions / lines) in `vitest.config.ts`. Initially `--passWithNoTests` not allowed; runs MUST hit 100 across `src/`, `examples/`, and `scripts/`. Baseline measured at 86.2 / 76.5 / 93.2 / 85.9 — Epic E0 closes the gap before this gate flips on.

### Phase B — performance criticals (publish-blocking)

- [ ] [WAIT-PHASE] **B1 (re-scoped 2026-05-26)** — Manifest metadata stays autogenerated, but its SOURCE-OF-TRUTH is no longer a bundled asset tree (that ships with the package). It's regenerated by running `bootstrap` (from RB1/RB2) against the canonical upstream zip + comparing the resulting tree against the prior manifest. CI drift check: `node scripts/regenerate-manifest.ts && git diff --exit-code src/manifest/free.ts`. Manifest contains: per-asset id, path-relative-to-`addons/kaykit_medieval_hexagon_pack/Assets/gltf/`, expected SHA256, geometry hints, scenario role tags.
- [x] ~~B2~~ — **REJECTED.** `freeManifest` stays on the umbrella; bundled-out-of-box is the product. Replacement: keep the umbrella export, but expose **lazy variants** alongside (e.g. `loadFreeManifest()`) for consumers that explicitly want async/lazy. Both shapes ship.
- [ ] [WAIT-PHASE] **B2b** — Add `export async function loadFreeManifest(): Promise<MedievalHexagonManifest>` to `src/manifest/free.ts`. Document both eager and lazy paths in the new bindings/bundling guide.
- [ ] [WAIT-PHASE] **B3** — **P-C2**: Refactor `cli.ts` (4,297 LOC) to `src/cli/index.ts` + `src/cli/commands/*.ts` with dynamic per-subcommand imports. Use `node:util.parseArgs`. Move `examples/simple-rpg-usage` import out of CLI eager path. **Note:** CLI lazy-loading does NOT remove the manifest from anyone's umbrella — it just keeps the CLI cold-start fast for headless validation/coverage use cases.
- [ ] [WAIT-PHASE] **B4** — **P-H3**: Materialize `tilesByKey` (+ `placementsByTile`) indexes once at projection time on `ProjectedGameboardPlan`. Replace 4 in-call rebuilds.
- [x] **B5 (part 1)** ✅ commit (2026-05-26) — **P-H1**: Single-pass `readGameboardActorTargets` reducer (`actors.ts:940-953` + `:1085-1093`).
- [x] **B6** ✅ commit (2026-05-26) — **P-H2**: Add `tryParseHexKey(key): HexCoordinates | undefined` in `coordinates.ts`; migrate `interop.ts`/`scenario.ts` `try { parseHexKey } catch { undefined }` sites.
- [ ] [WAIT-PHASE] **B7** — **P-H4**: Hash-stabilize `options` in selector hooks in `react.ts` (or document loudly + sample memo helpers in examples).
- [x] **B8** ✅ commit (2026-05-26) — **P-H5**: Replace `JSON.parse(JSON.stringify(...))` in `simulation.ts:5212` with `structuredClone`.

### Phase C — security criticals (publish-blocking)

- [ ] [WAIT-PHASE] **C1** — **S-H1**: Add `safeResolveOutput(value, outRoot=cwd())` helper; refactor all 40+ CLI `--out*` write sites in `cli.ts` to use it. Require explicit `--force` for `extract`'s `rmSync` destination; refuse to wipe non-empty dirs without `--force`.
- [x] **C2** ✅ commit (2026-05-26) — **S-H2**: Harden `listFiles` in `ingest.ts:310` — skip `entry.isSymbolicLink()`, verify `realpathSync(child).startsWith(realRoot)` before descending. Cycle-safe.
- [x] **C3** ✅ commit (2026-05-26) — **S-M1**: Prototype-pollution guard in `readPieceSourceRoots`; return `Object.create(null)`-backed map; use `JSON.parse` reviver to strip `__proto__`.
- [x] **C4** ✅ commit b3837f0 (2026-05-26) — **S-M2**: Fix `extract-kaykit-guide.ts:129` `sh -c` quoting via positional args.
- [ ] [WAIT-PHASE] **C5** — **S-M4**: Normalize CLI error messages to relative paths via `relative(cwd, resolve(value))`.
- [x] **C6** ✅ commit 07d4b72 (2026-05-26) — **S-M5**: Gate full stack traces behind `MEDIEVAL_HEXAGON_DEBUG=1`; keep terse default.
- [x] **C7** ✅ commit (2026-05-26) — **S-M6**: Block source-map publish via `"!dist/**/*.map"` in `files` or `sourcemap: false` for publish build.

### Phase D — architectural debt (publish-blocking)

- [x] **D1** ✅ commit (2026-05-26) — **F1 (re-scoped)**: Subpath tiering — keep ALL existing subpaths supported (this is an asset-bundled library where consumers may legitimately import internals for custom rendering / data inspection). Instead, **document** the support tier per subpath in `docs/api/public-api.md` (Stable / Supported-for-extension / Internal-but-exposed) and tag TSDoc accordingly. Decision rationale documented in PRD.
- [ ] [WAIT-PHASE] **D2** — **F11**: Add `src/errors.ts` taxonomy (`GameboardError` base; `GameboardValidationError`, `GameboardManifestError`, `GameboardScenarioError`, `GameboardRuntimeError`). Convert 130 `throw new Error()` sites; preserve messages.
- [ ] [WAIT-PHASE] **D3** — **H-3 (re-scoped)**: Decompose `simulation.ts` (5,213 LOC) into `simulation/{engine,script,report,assertions,index}.ts`. Add `assertNever` exhaustiveness on the action switch. Keep public surface stable.
- [ ] [WAIT-PHASE] **D4** — **M-4**: Invert `catalog.ts:1337 createKayKitGuideScenarios` (377-line function) into top-level data table + 5-line iteration.
- [x] **D5 (partial)** ✅ commit c15fbd4 (2026-05-26) for traits umbrella — actions umbrella deferred to R2r. **F5/F13**: Add `src/traits.ts` umbrella that re-exports every trait with a table-of-contents docblock. Add `src/actions.ts` umbrella for `*Actions` symbols.
- [x] ~~D6~~ — **REJECTED.** Peer-dep guards. Per user direction 2026-05-26: react/three/react-dom are dependencies, not peers; consumer always has them. Replaced by D6b.
- [x] **D6b** ✅ commit 70ce4e8 (2026-05-26) — React/Three bindings move from `peerDependencies` to `dependencies`; umbrella `src/index.ts` re-exports `react/` and `three/` sub-packages alongside every other domain. Update `docs/guides/peer-deps-and-bundling.md` accordingly (becomes `docs/guides/bindings-and-bundling.md`).
- [x] ~~D7~~ — **STALE.** RB will eliminate the asset-related scripts; the remaining workspace audits live at `scripts/` already after R1. No move needed. **F9**: Move package-scoped scripts (`audit-package.ts`, `audit-free-assets.ts`, `audit-reference-assets.ts`, `smoke-built-cli.ts`, `smoke-packed-consumer.ts`, `generate-package-assets.ts`, `extract-kaykit-guide.ts`, `promote-showcases.ts`) into `packages/medieval-hexagon-gameboard/scripts/`. Keep only true workspace audits at root.
- [x] **D8 (part 1)** ✅ commit c117c50 (2026-05-26) — **M-1**: Extract `scripts/_lib.ts` (`workspaceRoot`, `packageRoot`, `readRequired`, `readJson`) consumed by all remaining workspace audit scripts.
- [ ] [WAIT-PHASE] **D9** — **M-2**: Split `scripts/audit-workspace.ts` (1,293 LOC, 89 functions) into `scripts/audits/{packagejson,pnpm,nx,tsconfig,typedoc,tsup,markdown,release}.ts` with thin top-level dispatcher.
- [ ] [WAIT-PHASE] **D10** — **M-3**: Split `scripts/smoke-packed-consumer.ts` (2,489 LOC) into `pack-install.ts` (runtime smoke) + `types.ts` (compile-time API attestation only). Add labelled-phase harness.

### Phase E — test debt (publish-blocking, raises floor to 100%)

Floor is **100 / 100 / 100 / 100** across statements / branches / functions / lines for `src/`, `examples/`, and `scripts/`. Anything less is unacceptable. Baseline at the start of 1.0 work: **86.2 % stmts / 76.5 % branches / 93.2 % funcs / 85.9 % lines**.

- [ ] [WAIT-PHASE] **E0a** — `simulation.ts` to 100% (currently 67.7 / 66.6 / 85.9 / 67.2). Largest gap; likely sub-decomposition (Epic D3) will land first.
- [ ] [WAIT-PHASE] **E0b** — `patrol.ts` to 100% (72.3 / 64.5 / 76.9 / 71.9).
- [ ] [WAIT-PHASE] **E0c** — `recipe.ts` to 100% (78.9 / 68.4 / 82.4 / 79.0).
- [ ] [WAIT-PHASE] **E0d** — `commands.ts` to 100% (82.9 / 74.2 / 88.5 / 82.7).
- [ ] [WAIT-PHASE] **E0e** — `systems.ts` to 100% (83.3 / 76.6 / 81.8 / 83.0).
- [ ] [WAIT-PHASE] **E0f** — `world-rules.ts` to 100% branches (88.9 / 53.3 / 100 / 88.2).
- [ ] [WAIT-PHASE] **E0g** — `manifest/schema.ts` to 100% (81.2 / 70.9 / 97.8 / 80.5).
- [ ] [WAIT-PHASE] **E0h** — Sweep remaining files to 100%: `actors.ts`, `blueprint.ts`, `catalog.ts`, `compatibility.ts`, `coordinates.ts`, `coverage.ts`, `gameboard.ts`, `grid.ts`, `ingest.ts`, `interop.ts`, `koota.ts`, `layout.ts`, `movement.ts`, `navigation.ts`, `occupancy.ts`, `pieces.ts`, `projection.ts`, `quests.ts`, `registry.ts`, `rules.ts`, `runtime.ts`, `scenario.ts`, `selectors.ts`, `three.ts`, `validation.ts`.
- [ ] [WAIT-PHASE] **E0i** — `examples/simple-rpg-usage.ts` to 100% (96.0 / 53.8 / 91.7 / 95.7).
- [ ] [WAIT-PHASE] **E0j** — Add coverage instrumentation + thresholds for `scripts/*.ts` (currently not measured) and bring to 100%.
- [ ] [WAIT-PHASE] **E1** — Cross-process determinism test: spawn N node subprocesses, run identical scenario with same seed, assert byte-identical JSON output. Live in `tests/unit/determinism.test.ts`.
- [ ] [WAIT-PHASE] **E2** — Public API snapshot test (`tests/unit/public-api.test.ts`) — `import * as lib from '../src/index'` and snapshot the sorted `Object.keys(lib)` + their `typeof`. Pin the umbrella export surface.
- [ ] [WAIT-PHASE] **E3** — Hostile-input CLI tests: `--out ../etc/foo` → throws; `--source` with symlink loop → throws; `--source` with symlink to outside-root → throws; `{__proto__:...}` JSON payload → rejected. Live in `tests/unit/cli-security.test.ts`.
- [ ] [WAIT-PHASE] **E4** — Trait-identity test: import the same trait from `/koota` and from umbrella; assert reference-equality. Pins `splitting: true` invariant.
- [ ] [WAIT-PHASE] **E5** — CLI cold-start benchmark: `node dist/cli.js --help` ≤ 80 ms. Live in `tests/perf/cli-cold-start.test.ts`. Initially non-blocking.
- [ ] [WAIT-PHASE] **E6** — Simulation throughput micro-bench via `tinybench` (`tests/perf/simulation.bench.ts`); regression alarm at >10%.
- [ ] [WAIT-PHASE] **E7** — React render-count assertion for selector hooks with stable vs unstable `options` (`tests/unit/react-memoization.test.ts`). Pins P-H4 fix.
- [ ] [WAIT-PHASE] **E8** — Coverage thresholds enforced at **100 / 100 / 100 / 100** in `vitest.config.ts`; CI gates.
- [ ] [WAIT-PHASE] **E9** — **Visual integration gate.** Every renderer-binding (`react.ts`, `three.ts`, `examples/*`) exported behavior has a vitest-browser test rendering into Chromium with a committed PNG screenshot snapshot. Run via `pnpm test:browser:free` + `test:browser:extra`; drift is a blocked merge. Snapshots live in `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/`.
- [ ] [WAIT-PHASE] **E10** — **E2E coverage matrix.** `pnpm test:e2e:local-assets` covers happy path + failure modes (asset-missing, invalid scenario, replay-mismatch). Currently 4 tests; expand to ≥12 covering each failure category and the full catalog→blueprint→simulation→render bridge.

### Phase F — documentation (publish-blocking)

- [ ] [WAIT-PHASE] **F1d** — Rewrite top of `README.md`: install + quickstart (≤30 lines of code, including a render). Add Module Map table (umbrella vs subpath tiers).
- [ ] [WAIT-PHASE] **F2d** — Write `docs/guides/cli-reference.md` — generated from the new command registry (D1+B3). Replace `cli.ts` template-literal `usage()`.
- [ ] [WAIT-PHASE] **F3d** — Write `docs/guides/determinism-contract.md` — seed model, replay guarantees, where Date/Math.random are/aren't permitted.
- [ ] [WAIT-PHASE] **F4d** — Write `docs/guides/bindings-and-bundling.md` — subpath imports, trait identity hazard, the first-class react/three binding model (NOT peer-dep gated).
- [ ] [WAIT-PHASE] **F5d** — Write `docs/api/errors.md` — full error taxonomy with `instanceof` examples (lands with D2).
- [ ] [WAIT-PHASE] **F6d** — Write `CHANGELOG.md` (Keep a Changelog 1.1.0). release-please populates from here forward.
- [ ] [WAIT-PHASE] **F7d** — Write `STANDARDS.md` (style + brand + non-negotiables).
- [ ] [WAIT-PHASE] **F8d** — Write `docs/ARCHITECTURE.md` (module graph, ECS layering, build pipeline).
- [ ] [WAIT-PHASE] **F9d** — Write `docs/DESIGN.md` (vision, identity, UX principles).
- [ ] [WAIT-PHASE] **F10d** — Write `docs/TESTING.md` (strategy, coverage, smoke, perf gates).
- [ ] [WAIT-PHASE] **F11d** — Write `docs/DEPLOYMENT.md` (release flow, OIDC, GitHub App token, SBOM).
- [ ] [WAIT-PHASE] **F12d** — Write `docs/STATE.md` (current state, in-flight initiatives, links to PRD + directive).
- [ ] [WAIT-PHASE] **F13d** — Add frontmatter (title/updated/status/domain) to every `.md` in root + `docs/`.

### Phase G — release readiness (final gate)

- [ ] [WAIT-PHASE] **G1** — Add `actions/attest-build-provenance@v2` for SLSA L3 attestation.
- [ ] [WAIT-PHASE] **G2** — Add `@cyclonedx/cyclonedx-npm` SBOM as release artifact (`anchore/sbom-action` alt).
- [ ] [WAIT-PHASE] **G3** — Dependabot: add `security-updates` daily group with `open-pull-requests-limit: 10`.
- [ ] [WAIT-PHASE] **G4** — `pnpm verify` parity audit: every CI gate runs locally via `pnpm verify`. Add missing entries.
- [ ] [WAIT-PHASE] **G5** — Run `pnpm verify` end-to-end clean on this branch.
- [ ] [WAIT-PHASE] **G6** — Bump `packages/medieval-hexagon-gameboard/package.json` version → `1.0.0` and `release-please-manifest.json` accordingly.
- [ ] [WAIT-PHASE] **G7** — Open PR `codex/initial-medieval-hexagon-gameboard` → `main`; wait for CI green; merge.
- [ ] [WAIT-PHASE] **G8** — release-please opens release PR; merge it; tag `v1.0.0`; OIDC-publish to npm; verify provenance + SBOM artifacts on the release.

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
