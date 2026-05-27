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

The A8 coverage ratchet floors at 61.5 / 59.5 / 74 / 61 (unit harness) as of `14c5f77`. Each commit below advances it. E8's 100/100/100/100 flip lands after these complete.

- [ ] **E0a** — Simulation files to 100%. As of merge: `script.ts` 76.89 / 70.33 / 96.66 / 76.87; `engine.ts` 84.31 / 71.55 / 94.28 / 83.78; `assertions.ts` 86.54 / 91.01 / 87.5 / 85.62; `report.ts` 93%; `simulation.ts` shim 100%. Remaining: cover `normalizeUnknownList` + the mutation-record matchers + the report fixed_at flow. Each is <100 LOC of test code per commit; ratchet advances per closure.
- [ ] **E0h** — Sweep remaining src/ files to 100%. Largest gaps (per the merged unit-coverage baseline):
    - `pieces/pieces.ts` 89.69 — exercise the cross-pack composition error paths
    - `quests/quests.ts` 87.2 — quest objective rollover + reward dispatch
    - `actors/actors.ts` 87.58 — placement-state inference edge cases
    - `scenario/scenario.ts` 85.8 — interop snapshot drift paths
    - `manifest/schema.ts` 85.1 — unit-style narrowing + texture-set normalization
    - `gameboard/navigation.ts` 83.9 — patrol-route generation edge cases
    - `simulation/script.ts` validators (continuation of E0a)
    Each file's continuation work lands as one commit that adds ≤200 LOC of test code and ratchets the floor.
- [ ] **E8** — Flip coverage thresholds to **100 / 100 / 100 / 100** in `vitest.coverage.shared.ts`. Depends on E0a + E0h completion. Final ratchet commit.

### Phase E9 — visual integration gate (continuation)

- [ ] **E9** — Every renderer-binding (`react.ts`, `three.ts`, `examples/*`) gets a vitest-browser test rendering into Chromium with a committed PNG screenshot snapshot. RB-CI unblocked this 2026-05-27; the visual job now runs by default. Continuation work: audit `react.ts` + `three.ts` exported behaviors, add per-behavior browser tests with snapshot PNGs.

### Phase F-Site — docs-site continuation

- [ ] **F-Audit-7b-equiv** — Migrate the six `docs/guides/*.md` legacy files into `docs-site/src/content/docs/guides/` with redirect notes. Skipped at 1.0 stabilization time (F-Audit-7b cancelled — those paths are load-bearing in `src/scenario/catalog.ts`). Address via dual-write: keep the `docs/guides/*.md` paths as internal metadata, add canonical guide pages under `docs-site/` with cross-links. Each file = one commit.

## Self-assessment after each commit

1. What did I just ship? Did the visual / behavior match the spec doc?
2. Backward: any gap flagged by self-review / CI / coderabbit during this stage?
3. Forward: what should the next commit do differently given what this one revealed?
4. Encode forward learnings into directive items above before starting the next commit.
