# Continuous Work Directive — declarative-hex-worlds

**Status:** ACTIVE
**Owner:** jonbogaty@gmail.com
**Goal:** Ship `@jbcom/declarative-hex-worlds@1.0.0` to npm — release-please picks up the merged 1.0 stabilization branch and cuts the release PR.

## Operating loop — FULL AUTONOMY (non-negotiable)

while queue has `[ ]` items: implement → verify (typecheck + unit + coverage green) → commit → dispatch reviewers (background, parallel) → mark `[x]` → next. Do NOT stop between items. Do NOT report progress and wait. Each turn either advances the next `[ ]` item or names a true blocker — there is no third option.

**Mechanical work is NEVER a question.** Repointing imports, splitting test files, moving symbols, updating snapshots, fixing type errors, achieving coverage on a now-private function via a public path — these are execution, not decisions. Just do them until green. "This is substantial / long / mechanical" is not a reason to ask how to proceed; the answer is always "do it to green, then commit."

**Self-pacing is NOT a question either.** "Commit a smaller slice vs keep grinding" is the agent's call: keep the queue item whole if splitting would leave a non-compiling intermediate; slice only when a sub-step is independently green + valuable. Never ask the user to choose the cadence.

**The ONLY legitimate stops (true blockers):**
1. A design decision that flips SCOPE (changes the public API contract in a way not already decided, picks between architectures with different failure modes, or contradicts a captured decision). Ask, then continue.
2. CI/test failure whose root cause needs user-only knowledge (org secrets, external infra, intent that isn't in the repo).
3. A destructive op needing per-operation authorization (force-push to main, etc.).
4. Remote state we cannot progress without (CI completing, review landing) — use Monitor with a 20-30min fallback, never sit idle.

Everything else — context pressure, task size, "is this the right cadence", "should I keep going" — is NOT a stop and NOT a question. The harness auto-compacts; the 1M budget + `.agent-state/` survive it. Resume from the directive and keep going.

**Before asking ANY question, apply this test:** "Could a competent engineer with this directive + the repo answer it themselves without me?" If yes → it's mechanical or a self-paced call → DO IT, don't ask. Only genuine scope/contract forks (test #1 above) reach the user.

## Forbidden phrases

"deferred" | "v2+" | "out of scope" | "future work" | "tracked separately" | "follow-up" | "TODO" | "FIXME" | "stub" | "placeholder" | "mock for now" | "pause point" | "fresh session" | "stopping point" | "clean handoff" | "let me know when..."

## History

The 1.0 stabilization queue (35+ items across Phases R, A, B, D, E, F, G + the bootstrap-not-bundle restructure) landed via PR #4 (commit `14c5f77`) on 2026-05-27. Archived directive snapshot: [docs-site/src/content/docs/about/history/1.0-stabilization.md](../docs-site/src/content/docs/about/history/1.0-stabilization.md).

## Active queue — post-merge release + maintenance

### Phase LF — library-fit decomposition (Epic LF, in PR)

- [ ] [WAIT-REVIEW] **LF-PR53** — PR #53 (Epic LF, branch `feat/library-fit-decomposition`) open with 21 commits across LF1–LF8. Wait for CI green + address CodeRabbit/Gemini threads + resolve every thread before squash-merge. All 8 LF tasks marked done in this directive; the PR is the integration gate.

### Phase G — release (in-flight)

- [ ] [WAIT] **G8** — Post-merge release flow. With PR #4 on `main`, release-please reads `release-as: "1.0.0"` (PRD G6) and opens a release PR with the 1.0.0 changelog. Maintainer merges that release PR → release-please tags `v1.0.0` → `release.yml` builds the tarball, attests SLSA L3 (G1), generates CycloneDX SBOM (G2), publishes to npm with OIDC provenance. Verify post-publish via `npm audit signatures @jbcom/declarative-hex-worlds` + GitHub release page assets (SBOM + tarball).

### Phase RB — bootstrap CI integration (continuation)

- [x] **RB-CI** — ✅ commit (2026-05-27): `.github/workflows/ci.yml` `browser-free` job adds a `Bootstrap FREE KayKit pack (RB-CI)` step before the visual tests, invoking `tsx src/cli/cli.ts bootstrap --source github --out public/assets/models`. Conditional flipped from `RUN_BROWSER_VISUALS == '1'` to `RUN_BROWSER_VISUALS != '0'` — the job now runs by default, with the env var preserved as a skip escape hatch. Drift on `tests/browser/__screenshots__/` blocks merge.

### Phase E0 — coverage closure (continuation toward 100/100/100/100)

The A8 coverage ratchet floors at 64.5 / 62.3 / 76.4 / 64 (unit harness) as of `33d271b`. Each commit below advances it. E8's 100/100/100/100 flip lands after these complete.

- [ ] [WAIT] **E0a** — Simulation + patrol files toward 100%. PR#10-#51 merged. PR#52 (`feat/e0-coverage-batch-40`) open awaiting CI: manifest/schema.ts joinUrl strip-slash loops (774/782) + sameNumberRecord non-record return (648). Coverage local 68.54/67.29/78.32/68.18; CI reads ~1.3pt lower. Floor 67.25/66.05/76.9/66.85. Ratchet against CI-measured, never local ([[coverage-floor-ratchet]]). NOTE: scenario.ts:1189 (spawn-group warning map) + 1204 (patrol warning map) effectively unreachable — spawn groups never emit warnings; patrol warning at navigation.ts:793 needs >1 waypoint + 0 segments (contradictory). Skip these arms.
    - script.ts 88.76 / 83.88 / 98.88 / 88.83 — inspect-actor-targets sub-fields, expectation validators non-array + non-record, validateStringInteractionTarget missing-id.
    - engine.ts 94.11 / 80.44 / 97.14 / 93.91 — resolveSimulationSpawnActor throw, patrolSegmentSimulationStep inverted pairs.
    - assertions.ts 92.39 / 94.38 / 89.06 / 91.87 — matchesAnyActorTarget vacuous-match.
    - report.ts 100 / 96.42 / 100 / 100 — copyQuestObjective tile/targetTile branches done.
    - patrol.ts 83.21 → ratcheting; paused/short-route/missing-id/loop-wrap/end-of-route.
    - layout.ts 87.13 → ratcheting; normalizeArchetypes, resolveArchetype, selectLayout count=0.
    - quests.ts 92.8 → ratcheting; expect=hostile + interactive, missing-quest throw.
    - manifest/schema.ts 87.24 → duplicatePreference variants done.
    - actors.ts 88.93 → register + navigationProfile action wrappers.
    - pieces.ts 93.64 → inferPieceRoleFromCompatibility role branches.
    - scenario/scenario.ts 87.74 → actor spawnLocationIndex errors.
    - gameboard.ts 92.21 → addUnitPreset role variants.
    - bootstrap.ts 75 → verifyBootstrap unsafe-sidecar + missing-file.
    - selectors.ts 97.43 → selectRoadVariant unreachable-mask throw.
    - movement.ts 82.8 → runSystem/reachable wrappers + profile-not-found.
    - commands.ts 84.76 → createRemoveTargetPlacementHandler factory.
    - interop/compatibility.ts 93.33 → -x modelForward axis.
    - navigation.ts 86.06 → reachableGameboardTiles defensive returns.
    Remaining gaps: deep validator branches in script.ts (remaining expectation sub-validators), engine.ts edge mutation paths (lines 491-499, 674), patrol.ts wait-state + completed-by-targetIndex-undefined deeper paths, navigation.ts patrol-route generation edge cases, scenario.ts deeper allocator paths, bootstrap GitHub source, ingest.ts duplicate disambiguation. Each ≤200 LOC commit + threshold ratchet.
- [ ] [WAIT] **E0h** — Sweep remaining src/ files to 100% (paired with E0a per-PR). PR#10 closures advanced many of these in tandem with E0a. Status post-merge:
    - `pieces/pieces.ts` ~91% (was 89.69) — cross-pack composition + remaining infer paths
    - `quests/quests.ts` ~89% (was 87.2) — quest objective rollover + reward dispatch
    - `actors/actors.ts` ~88% (was 87.58) — placement-state inference edge cases
    - `scenario/scenario.ts` ~88% (was 85.8) — actor allocation + interop snapshot drift
    - `manifest/schema.ts` ~88% (was 85.1) — additional filter combinations
    - `gameboard/navigation.ts` ~85% (was 83.9) — patrol-route generation edge cases
    - `coordinates/layout.ts` 87.13 — layout fill site selection edge cases
    - `scenario/recipe.ts` ~82% (was 79.5) — recipe generation edge cases
    - `patrol/patrol.ts` ~81% (was 79.56) — patrol agent edge cases
    Each file's continuation work lands as one commit that adds ≤200 LOC of test code and ratchets the floor.
- [ ] [WAIT] **E8** — Flip coverage thresholds to **100 / 100 / 100 / 100** in `vitest.coverage.shared.ts`. Depends on E0a + E0h reaching the floor at 100. Currently 65.94/63.83/76.87/65.57; unblocks when the per-file gaps in the E0a/E0h lists close out. Final ratchet commit.

### Phase E-MergedGate — wire browser coverage into the enforced gate

**User decision (2026-05-28):** the enforced CI gate (`test:coverage:enforce`) is unit-only, but it measures `src/react/react.ts` + `src/three/three.ts` which Node can never cover (292 uncov lines / 134 uncov fns dragging the gate ~1.5–4pt). Chosen fix: **wire browser-free coverage into the gate** (merge unit + browser-free, enforce on merged) so react/three are measured where they CAN be covered — NOT exclude them.

Investigation (2026-05-28) surfaced a 3-link blocker chain; only link 2 is done:
1. **[BLOCKED — needs user]** browser-free CI job is *skipped on every run* (conclusion `skipped`, 0 steps). No repo var set; `if: vars.RUN_BROWSER_VISUALS != '0'` evaluates false → an **org-level `RUN_BROWSER_VISUALS=0`** is almost certainly forcing skip (can't read org vars). Job has NEVER run a step in CI (all 30 recent runs skipped/concurrency-cancelled-at-start). User must clear/flip the org var.
2. **[DONE]** Stale browser alias (`src/$1.ts` wildcard) broke subpath imports → react-bindings.test.ts couldn't import. Fixed by `vitest.alias.shared.ts` consumed by all 4 harness configs (this branch, commit on `feat/merged-coverage-gate`). Unit suite stays green (715).
3. **[BLOCKED — code work]** Browser build of react-bindings.test.ts fails: `Module "node:fs" has been externalized for browser compatibility` — a browser-reachable barrel transitively imports a Node-only module (bootstrap/ingest/cli/manifest/upstream-layout all import `node:fs`). The umbrella/manifest barrel chain must be made browser-safe (split Node-only exports behind a server-only entry, or lazy-import them) before the react test can load under Chromium. This is the real reason the visual gate was deferred.

**Layering decisions (2026-05-28, user-directed during link-3 investigation):**
- The 1100-line root `src/index.ts` hand-relisted 956 named symbols that the 18 domain barrels already `export *` — pure duplication, not curation (tiering is enforced at package.json#exports + @internal, not the root hand-list). **Root rewritten to barrel-forwarding** (`export * from './<domain>'`). Adding a public export to a domain now needs no root edit.
- There is **NO server/browser split and NO `server.ts`** (rejected as a wrapper shim). The umbrella is browser-safe by *correct layering*: it exports library/runtime API only. `bootstrap` is a **CLI-domain capability** (reachable ONLY from `src/cli/`; never from runtime/react/three) — it was wrong to re-export it from the umbrella at all. Bootstrap stays reachable via the `./bootstrap` subpath for programmatic CLI-equivalent callers.
- `manifest/upstream-layout.ts` was **mis-filed**: its data + fs-probers are consumed ONLY by bootstrap (CLI-domain), nothing in manifest/runtime uses it. **Move `src/manifest/upstream-layout.ts` → `src/bootstrap/upstream-layout.ts`**; published subpath renamed `./manifest/upstream-layout` → `./bootstrap/upstream-layout` (pre-1.0; update docs-site 3 refs + smoke/types.ts + architecture table + biome restricted-imports + tsup entry + package.json exports). bootstrap barrel re-exports it.

**Ordered sequence:** The restructure (Steps A+B from earlier notes) is now formalized as the **LF batch** below (PRD: `docs/plans/library-fit-decomposition.prq.md`). After LF8 lands, E-MergedGate continues:
- **Step C** — user clears org `RUN_BROWSER_VISUALS=0`; then get `test:browser:free` green locally + CI with coverage emitted.
- **Step D** — extend `scripts/merge-coverage.ts` with merged-tree threshold enforcement; add CI `coverage-merge` job (download unit + browser-free coverage artifacts, enforce on merged). THEN the full src/ surface incl. react/three is measured — exclude nothing.

## Batch — library-fit-decomposition (batch-20260528-103351)

Source: docs/plans/library-fit-decomposition.prq.md (sha256: 42bbb50d5a7041055a2a67438c99192629f0f2264f89871989985fdb892d6f96)
Started: 2026-05-28T10:33:51Z

### task-LF1 Barrel-forwarding umbrella + internal extraction (merged LF1+LF1b)
- [x] task-LF1 ✅ (commit, 2026-05-28) Rewrite src/index.ts to `export * from './<domain>'` only (18 library barrels); drop bootstrap re-exports. Extract the 28 internal helpers the barrels over-export so they're shareable-but-private:
  - DISCOVERY (2026-05-28): the old hand-list root was NOT pure duplication — it curated OUT 28 internal helpers the domain barrels over-export via `export *`. Barrel-forwarding surfaces them; they must leave the public boundary.
  - **Generic cross-cutting → new `src/internal/` (NOT in package.json#exports):** errorMessage, isNonEmptyString, isRecord (dedupe the cli/_shared.ts copy too), includesString, isHexCoordinatesInput, tryParseHexKey, plus the type-guards/const-arrays that are pure utilities.
  - **Domain-specific internals stay in their domain file but leave the public boundary** (the barrel/shim re-exports only public names; siblings import directly): report.ts internals (actorRecord/…/simulationResult), script.ts SIMULATION_* arrays + isSimulation* guards + tileKeyFromTargetInput, gameboardPlanIndex@gameboard, isTextureSet/isUnitStyle@catalog, readValidationGameboardPlanFromWorld@projection, GAMEBOARD_RELEASE_GATE_SUMMARIES + GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS@coverage, KAYKIT_ATTRIBUTION@schema.
  - Mechanism: where a shim/barrel does `export *` and must drop internals, either move internals to `src/internal/` (generic) or convert that shim to public-named re-exports (domain-specific). Update all importers + biome noRestrictedImports for `../internal`. typecheck + unit green.
  - **CONTRACT DECISION (2026-05-28, user: "pick the BEST for the library"):** umbrella = union of legitimately-public subpath symbols; genuinely-internal symbols leave ALL public surfaces. The old hand-list was a curated-subset (umbrella ⊊ subpaths) — that was WRONG for symbols with real external consumers. Classification of the post-barrel-forwarding leaks:
    - **Move to internal (no external consumer; only cross-file impl detail; auto-typedoc is noise):** `actorRecord`/`placementRecord`/`simulationResult`/`actorTargetsRecordFromReport`/`emptyActorTargetsRecord` (report↔engine) → `src/simulation/internal.ts`; `tryParseHexKey` (coordinates-internal) → `src/internal` or private; `gameboardPlanIndex` (cross-domain layout/interop/gameboard impl) → `src/internal`; `GAMEBOARD_RELEASE_GATE_SUMMARIES` (coverage-internal) + `GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS` (coverage→cli impl) → `src/internal` or interop-internal.
    - **Keep public — real external consumers, umbrella SHOULD expose (old list wrongly omitted):** `KAYKIT_ATTRIBUTION` (scripts/audit-package.ts) ; `readValidationGameboardPlanFromWorld` (scripts/smoke/*). These were already public on their subpath; accept into umbrella, add to snapshot.
    - Final snapshot diff = bootstrap (13) + all genuine internals removed; + KAYKIT_ATTRIBUTION + readValidationGameboardPlanFromWorld + any other real-consumer symbols added. Delete stale auto-typedoc pages for the now-internal symbols (docs-site reference regen).
  - **PROGRESS (2026-05-28):** umbrella → barrel-forwarding DONE. src/internal/predicates.ts (5 generic) DONE. src/simulation/internal.ts (SIMULATION_* arrays + isSimulation* guards + tileKeyFromTargetInput) DONE — cycle broken by owning STEP_ACTIONS in internal.ts. simulation.ts shim curated (report records omitted) DONE. tsc green, 714/715 unit pass, ONLY public-api snapshot red.
  - **REMAINING 6 leaks + decisions:** KEEP-PUBLIC (real consumers, accept into snapshot): `KAYKIT_ATTRIBUTION` (scripts/audit-package), `readValidationGameboardPlanFromWorld` (scripts/smoke). MOVE-INTERNAL via per-domain shim/barrel curation (same pattern as simulation.ts): `tryParseHexKey` (coordinates.ts-internal, used by parseHexKey), `gameboardPlanIndex` (gameboard.ts, cross-domain → coordinates/interop import it; curate gameboard barrel + give cross-domain callers a path — likely `src/internal` re-home accepting type-only domain imports, OR a gameboard/internal.ts with a biome exception), `GAMEBOARD_RELEASE_GATE_SUMMARIES` (coverage.ts-internal), `GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS` (coverage.ts → cli consumes; cross-domain). Then update snapshot, delete stale typedoc pages, biome rule for any new internal import paths. typecheck + unit + coverage green → commit LF1.
**REORDER (2026-05-28, forward self-assessment after LF1):** LF2 (config extraction) was originally first, but the work surfaced that its content — the KAYKIT_FREE_GITHUB_* constants + repo-clone patterns — is downstream of LF7's git-clone decision (github→git changes those constants' semantics entirely) AND lives in bootstrap files that LF4 relocates. Extracting config now would build a schema LF7 then reshapes. BEST order: **LF3 → LF4 → LF7 → LF2 → LF5 → LF6 → LF8** so config captures the SETTLED constants (incl. git-clone patterns) from their final home. (Per "pick the BEST, let work surface the next step".)

### task-LF2 src/config JSON config domain (reordered: after LF7)
- [x] task-LF2 ✅ (commit, 2026-05-28) Created src/config/ with 3 JSON files (kaykit-source, bootstrap-paths, upstream-layouts) + typed loader (`KAYKIT_SOURCE`, `BOOTSTRAP_PATHS`, `UPSTREAM_LAYOUTS`, `kaykitGithubArchiveUrl`). Migrated all KAYKIT_BOOTSTRAP_*, KAYKIT_FREE_GITHUB_*, KAYKIT_FREE_USER_AGENT, KAYKIT_*_EXTENSIONS, KAYKIT_SIDECAR_SCHEMA_VERSION, KAYKIT_MEDIEVAL_FREE/EXTRA_LAYOUT to derive from config. Public names unchanged, browser-safe (pure JSON, no node), internal (not in exports). All green.
### task-LF3 Relocate upstream-layout
- [x] task-LF3 ✅ (commit, 2026-05-28) Moved src/manifest/upstream-layout.ts → src/bootstrap/upstream-layout.ts (whole file; config extraction of its data deferred to reordered LF2). manifest barrel drops it; bootstrap barrel re-exports. Subpath renamed manifest/upstream-layout → bootstrap/upstream-layout (tsup+package.json+smoke+astro typedoc). 6 layout symbols left umbrella (→ ./bootstrap). Also: react/three added to umbrella (LF1 follow-up, invariant #5, commit `3461858`). All green: typecheck/715 unit/build/lint.
### task-LF4 Relocate bootstrap to CLI command area
- [x] task-LF4 ✅ (commit, 2026-05-28) Moved src/bootstrap/* → src/cli/commands/bootstrap/ (core/target/upstream-layout/index.ts; index now hosts the `run` command merging the old thin wrapper). _shared imports `./commands/bootstrap/core` (cycle-safe). tsup + astro typedoc inputs repointed; subpath KEYS + dist paths unchanged. e2e/integration tests repointed. No top-level src/bootstrap/. All green: typecheck/715 unit/build/lint.
### task-LF5 Repoint subpaths + build + lint + docs
- [x] task-LF5 ✅ (commit, 2026-05-28) Hand-written docs repointed (architecture, errors guide, kaykit-upstream-layout guide). Auto-typedoc regenerated. Empty stale `reference/bootstrap/` deleted. biome rule needed no change (bootstrap moved INTO src/cli/commands; the rule's `../bootstrap` matchers no longer apply since there's no top-level bootstrap domain). package.json exports + tsup + scripts/smoke + astro typedoc inputs already updated in LF3+LF4. All green.
### task-LF6 Proper CLI library
- [x] task-LF6 ✅ (commit, 2026-05-28) Adopted citty for command routing + lazy subcommand loading; hand-curated `./usage` preserved for `--help` (intercept BEFORE runMain since citty auto-help only lists subcommand names). All 35 subcommands unchanged (kept run(parsed, sourceRoot, edition) contract; citty wraps each with ctx.rawArgs → parseFlags). Lazy import per command preserves the cold-start budget. 31 cli tests pass; all green.
### task-LF7 Unify bootstrap source on the zip flow (no git, no peer dep)
- [x] task-LF7 ✅ (commit `644862c`, 2026-05-28) Unified: github source downloads the stable `/archive/refs/heads/main.zip` then reuses `stageFromZip` (same detector handles itch.io `<pack>/Assets/gltf` + github `<repo>-main/addons/kaykit_.../Assets/gltf`). Removed tar/gunzip/stream-pipeline + `tar` runtime dep + `.gz` ext. Verified structures via download. All green. ORIGINAL: **REVISED (user, 2026-05-28):** isomorphic-git rejected as overkill. The GitHub archive URL `https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0/archive/refs/heads/main.zip` is stable and never changes. Collapse the two source modes into ONE flow: the CLI accepts a local zip path and auto-detects free/extra by expected structural alignment (via the layout detector); if no zip is given, it fetches that stable archive .zip and feeds the SAME zip-extract flow (FREE only). Remove the tarball/gunzip/tar machinery (`node:zlib`, `node:stream/promises`, `tar` dep, `kayKitFreeGithubTarballUrl`'s codeload tar.gz URL → archive .zip URL). Keep the existing `openHttpsStream` redirect handling (github archive → codeload redirect) but pipe to a temp `.zip` file then reuse `stageFromZip`. Verify via `tree` that a fresh download of that zip extracts to the same structure as the FREE `references/` tree; support both structures if they differ. Drop `tar` runtime dep. Coverage for the unified path. typecheck+unit+build+lint green.
### task-LF8 Browser-import-safety verification
- [x] task-LF8 ✅ (commit, 2026-05-28) Static-graph guard `tests/unit/umbrella-browser-safe.test.ts` walks src/index.ts transitive imports + asserts ZERO `node:*` leaks (72 files visited, 0 leaks). Empirical verification: `react-bindings.test.ts` loads under Chromium + emits 61.4% react+three line coverage (253/412 from that one test alone), proving the merged unit+browser-free gate is viable. E-MergedGate link 3 UNBLOCKED on the code side; link 1 (org-level `RUN_BROWSER_VISUALS=0`) still needs user action.

### Phase E9 — visual integration gate (continuation)

- [ ] [WAIT] **E9** — Every renderer-binding (`react.ts`, `three.ts`, `examples/*`) gets a vitest-browser test rendering into Chromium with a committed PNG screenshot snapshot. Blocked on E-MergedGate links 1+3 (browser harness must actually run + load). Once unblocked: audit `react.ts` + `three.ts` exported behaviors, add per-behavior browser tests with snapshot PNGs.

### Phase F-Site — docs-site continuation

- [ ] [WAIT] **F-Audit-7b-equiv** — Migrate the six `docs/guides/*.md` legacy files into `docs-site/src/content/docs/guides/` with redirect notes. Skipped at 1.0 stabilization time (F-Audit-7b cancelled — those paths are load-bearing in `src/scenario/catalog.ts`). Blocked on PR#10 merge so the docs-site site map is rebuilt against a stable trunk. Address via dual-write once unblocked: keep the `docs/guides/*.md` paths as internal metadata, add canonical guide pages under `docs-site/` with cross-links. Each file = one commit.

## Self-assessment after each commit

1. What did I just ship? Did the visual / behavior match the spec doc?
2. Backward: any gap flagged by self-review / CI / coderabbit during this stage?
3. Forward: what should the next commit do differently given what this one revealed?
4. Encode forward learnings into directive items above before starting the next commit.
