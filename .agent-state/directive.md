# Continuous Work Directive — medieval-hexagon-gameboard

**Status:** ACTIVE
**Owner:** jonbogaty@gmail.com
**Goal:** Ship `@jbcom/medieval-hexagon-gameboard@1.0.0` to npm — release-please picks up the merged 1.0 stabilization branch and cuts the release PR.

## Operating loop

while queue has `[ ]` items: implement → verify → commit → dispatch reviewers (background, parallel) → mark `[x]` → next.

Stop only on: explicit user halt, red CI blocking, or genuine STOP_FAIL.

## Forbidden phrases

"deferred" | "v2+" | "out of scope" | "future work" | "tracked separately" | "follow-up" | "TODO" | "FIXME" | "stub" | "placeholder" | "mock for now" | "pause point" | "fresh session" | "stopping point" | "clean handoff" | "let me know when..."

## History

The 1.0 stabilization queue (35+ items across Phases R, A, B, D, E, F, G + the bootstrap-not-bundle restructure) landed via PR #4 (commit `14c5f77`) on 2026-05-27. Archived directive snapshot: [docs-site/src/content/docs/about/history/1.0-stabilization.md](../docs-site/src/content/docs/about/history/1.0-stabilization.md).

## Active queue — post-merge release + maintenance

### Phase G — release (in-flight)

- [ ] [WAIT] **G8** — Post-merge release flow. With PR #4 on `main`, release-please reads `release-as: "1.0.0"` (PRD G6) and opens a release PR with the 1.0.0 changelog. Maintainer merges that release PR → release-please tags `v1.0.0` → `release.yml` builds the tarball, attests SLSA L3 (G1), generates CycloneDX SBOM (G2), publishes to npm with OIDC provenance. Verify post-publish via `npm audit signatures @jbcom/medieval-hexagon-gameboard` + GitHub release page assets (SBOM + tarball).

### Phase RB — bootstrap CI integration (continuation)

- [x] **RB-CI** — ✅ commit (2026-05-27): `.github/workflows/ci.yml` `browser-free` job adds a `Bootstrap FREE KayKit pack (RB-CI)` step before the visual tests, invoking `tsx src/cli/cli.ts bootstrap --source github --out public/assets/models`. Conditional flipped from `RUN_BROWSER_VISUALS == '1'` to `RUN_BROWSER_VISUALS != '0'` — the job now runs by default, with the env var preserved as a skip escape hatch. Drift on `tests/browser/__screenshots__/` blocks merge.

### Phase E0 — coverage closure (continuation toward 100/100/100/100)

The A8 coverage ratchet floors at 64.5 / 62.3 / 76.4 / 64 (unit harness) as of `33d271b`. Each commit below advances it. E8's 100/100/100/100 flip lands after these complete.

- [ ] **E0a** — Simulation + patrol files toward 100%. PR#10-#41 merged. Coverage 68.09/66.71/77.88/67.77. Most remaining gaps live in: CLI surface (`_shared.ts`, `cli.ts`, command modules — subprocess-tested, coverage doesn't fire), `react.ts` (browser-only, excluded from unit harness), `bootstrap.ts` GitHub-source path (needs network mock), and deeper actors/koota defensive throws. Per-domain status: layout 89%, actors 91%, navigation 91%, scenario ~94%, manifest ~95%. PR#42 (`feat/e0-coverage-batch-30`) open for next available closures.
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

### Phase E9 — visual integration gate (continuation)

- [ ] [WAIT] **E9** — Every renderer-binding (`react.ts`, `three.ts`, `examples/*`) gets a vitest-browser test rendering into Chromium with a committed PNG screenshot snapshot. RB-CI unblocked this 2026-05-27; the visual job now runs by default. Continuation work blocked on PR#10 merge so the visual harness baselines from a stable trunk. Once PR#10 lands: audit `react.ts` + `three.ts` exported behaviors, add per-behavior browser tests with snapshot PNGs.

### Phase F-Site — docs-site continuation

- [ ] [WAIT] **F-Audit-7b-equiv** — Migrate the six `docs/guides/*.md` legacy files into `docs-site/src/content/docs/guides/` with redirect notes. Skipped at 1.0 stabilization time (F-Audit-7b cancelled — those paths are load-bearing in `src/scenario/catalog.ts`). Blocked on PR#10 merge so the docs-site site map is rebuilt against a stable trunk. Address via dual-write once unblocked: keep the `docs/guides/*.md` paths as internal metadata, add canonical guide pages under `docs-site/` with cross-links. Each file = one commit.

## Self-assessment after each commit

1. What did I just ship? Did the visual / behavior match the spec doc?
2. Backward: any gap flagged by self-review / CI / coderabbit during this stage?
3. Forward: what should the next commit do differently given what this one revealed?
4. Encode forward learnings into directive items above before starting the next commit.
