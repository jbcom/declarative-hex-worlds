# Phase 3: Testing & Documentation Review

## Test Coverage Findings

### Critical

**S-1 — Coverage ratchet (`test:coverage:enforce`) does not run in PR CI**
The 73/69/80/73 V8 floor is advisory — `ci.yml` marks it local-only. Coverage can silently regress on any merged PR. Fix: add `HEX_WORLDS_COVERAGE_ENFORCE=1 pnpm test` (or a dedicated `test:coverage` matrix step) to the PR CI job.

**S-2 — Bootstrap network/zip security guards have zero unit tests; only exercised by env-gated e2e that never runs on PRs**
- Redirect allowlist (`core.ts:626-668`, CWE-601/918) — no test; `https.request` is never mocked anywhere in the suite.
- Live `extractZipTo` zip-slip guard (`core.ts:691-697`) — no test. `core.test.ts` only tests `verifyBootstrap` sidecar-path rejection (a different guard).
- 64 MB zip-bomb ceiling declared-size check (`core.ts:705-712`, CWE-409) — no test.
- 64 MB zip-bomb streaming abort (`core.ts:722-735`) — no test.

Fix: introduce `vi.mock('node:https')` injectable seam; add hostile-entry zip tests using the existing `yazl` harness.

### High

**S-3 — Existing `smoke.test.ts:36` encodes the H-1 vulnerability as the correct contract**
`kayKitFreeGithubTarballUrl('deadbeef')` asserts raw interpolation — no hostile-ref test. This test will actively resist the H-1 `encodeURIComponent`/regex-guard fix. Fix: update `smoke.test.ts:36` + add hostile-ref test cases (`../`, CRLF, scheme switch, `%2f`).

**S-4 — `readJson<T>` error contract untested at all five user-JSON CLI entry points**
`_shared.ts:397` is `JSON.parse(...) as T` trusted by 25 callers. Only happy-path tested (`_shared.test.ts:118`). No malformed-JSON, wrong-shape, or missing-file assertion for `--scenario`, `--plan`, `--script`, `--recipe`, `--groups`/`--assignments`. Drive each through CLI subprocess.

**S-5 — No pathfinding golden-path or `visited`-ceiling regression guard (P-1)**
`findHexPath` uses O(|open|) `lowestCostKey` linear scan. A binary-heap refactor would have no correctness oracle and no node-expansion bound. Add: (1) large-board golden snapshot (fixed-seed 50×50, assert `path` + `cost`); (2) `expect(r.visited).toBeLessThanOrEqual(CEILING)` guard.

**S-6 — Three `it.skip` stubs in `cli.test.ts:219,1426,1922` (repo rule: stubs are bugs)**
Fix or delete.

### Medium

**S-7 — Prototype-pollution `__proto__` test asserts only non-zero exit, not guard message**
`cli-security.test.ts` can't distinguish guard-fired from earlier error. Tighten to assert the specific guard message.

**S-8 — Benches assert nothing and run in no CI workflow**
`tests/perf/*.bench.ts` — no threshold, no workflow. Add a nightly bench workflow with artifact upload.

**S-9 — `loadFreeManifest` async path not verified in browser test** 
Browser tests don't confirm the async path is what bundles take. One test asserting `await loadFreeManifest()` resolves correctly closes the functional gap.

### Low

- Concurrent bootstrap into same `--out` untested (sequential idempotency is tested, concurrent is not)
- Redirect depth-cap (`redirects > 5`, `core.ts:627`) untested
- `readJson` empty file / BOM / trailing comma untested
- Zip-ceiling exact-boundary (at `KAYKIT_MAX_ZIP_ENTRY_BYTES` vs `+1`) untested

---

## Documentation Findings

### High

**H-DOC-1 — `cli-reference.md:15` self-referential rename artifact**
"The library ships a Node CLI at `declarative-hex-worlds` (and the same binary as `declarative-hex-worlds` once installed)." Botched find-replace from the `medieval-hexagon-gameboard` rename. Fix in `generate-cli-reference.ts` template (not the generated `.md`).

**H-DOC-2 — No rename narrative / migration note for `medieval-hexagon-gameboard` → `declarative-hex-worlds`**
`CHANGELOG.md` jumps `0.1.0` → `1.0.0` silently; no mention of npm name change, `HEX_WORLDS_*` env prefix, or bin name. Violates the project's own Tier-1 contract ("breaking changes always with a migration guide"). Fix: add rename block to `CHANGELOG.md` 1.0.0 entry + a `docs-site/guides/migration.md` with old→new mapping.

**H-DOC-3 — Five file-accepting CLI flags have no documented JSON schema or error contract (ties Security H-3)**
`--scenario`, `--plan`, `--script`, `--recipe`, `--groups`/`--assignments` read user JSON via bare `readJson<T>`. TypeDoc reference pages exist but aren't cross-linked from the CLI flag docs. No documented exit-code behavior for malformed/missing files. Fix: add "JSON input contract" subsection per flag in CLI reference — link to TypeDoc interface, state error contract, link example files in `examples/`.

Note: `--routes` (from Phase 1 brief) does not exist as a flag — actual patrol flags are `--groups`/`--assignments`/`--routeId` (L-DOC-4).

### Medium

**M-DOC-1 — `HEX_WORLDS_OUT_ROOT='/'` footgun documented only in source, not docs-site (ties Security M-4)**
Inline JSDoc on `defaultOutRoot()` is excellent but lives only in source. Add `<Aside type="danger">` to "Safe output paths" in CLI reference: setting `OUT_ROOT` to `/` defeats the path jail; CLI users never set it.

**M-DOC-2 — `koota.ts:16` dependency-inversion import has no inline rationale**
`import { isKnownExtraAssetId } from '../scenario'` — no comment explaining why the ECS spawn layer reaches into the scenario catalog. Add a one-liner explaining edition-gating at the import site.

**M-DOC-3 — `interop/coverage.ts` cohesion mismatch not signposted in architecture doc**
Release-readiness tooling (`GameboardCoverageReport`, `SimpleRpgEvidence`) sits inside the schema-migration domain. `about/architecture.md` should split the `interop/` row's purpose or add a sentence noting `/coverage` is release tooling, not a runtime feature.

**M-DOC-4 — Branded types "NOT yet enforced" caveat honest in source but missing from consumer docs**
`src/types/brands.ts` says "Branded types are NOT yet enforced across the codebase — Epic R2 introduces them progressively." `public-api.md` lists `./types` as Tier-1 stable with branded IDs as load-bearing, which overstates enforcement. Add the caveat to `public-api.md` or TypeDoc module doc.

**M-DOC-5 — `simulation/script.ts` (3,163 lines, five responsibilities) lacks navigational map**
One-line `@module` blurb for a 3,000+ line file with five distinct sections (types, schema constants, validators, scenario index helpers, step payload interfaces). Add section comments or expand `@module` with a "Sections in this file" outline.

### Low

**L-DOC-1** — `findHexPath` body has no inline A* algorithm commentary (heuristic, relaxation, abort). Doc mis-frames it as plain "weighted shortest path."

**L-DOC-2** — Patrol state machine transitions (idle→moving→waiting/paused→completion) are un-narrated above `advancePatrolEntity`.

**L-DOC-3** — `docs/` (legacy) and `docs-site/` (canonical) coexist with no contributor pointer stating which is authoritative. Add to `CONTRIBUTING.md`.

**L-DOC-4** — `--routes` flag name from Phase-1 brief doesn't exist. Actual flags: `--groups`/`--assignments`/`--routeId`. Don't propagate the wrong name into H-DOC-3 remediation.

---

## Critical Issues for Phase 4 Context

- **Coverage gate not in CI** (S-1): CI/CD review should evaluate whether to restore `test:coverage:enforce` to the PR matrix or accept the local-only design with explicit documentation of the risk.
- **Security test infrastructure gap** (S-2): Requires an injectable HTTP seam — a design/architecture decision (inject vs `vi.mock('node:https')`) that Phase 4 framework-best-practices review should opine on.
- **`it.skip` stubs** (S-6): Per repo CLAUDE.md policy, these are bugs. Any framework best-practices pass should flag stub-as-placeholder patterns.
- **Docs/code drift mechanism** (H-DOC-3): The CI-enforced docs contract is excellent, but doesn't cover the CLI flag → JSON schema cross-link gap. Phase 4 should note this as a tooling gap.
