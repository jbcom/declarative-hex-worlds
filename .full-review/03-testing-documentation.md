# Phase 3: Testing & Documentation Review — Consolidated

See `03a-testing.md` and `03b-documentation.md` for full detail.

## Testing — gaps that block 1.0

37 src modules, 35 test files. Coverage runs with v8 provider but **no thresholds**.

### Critical (3)

- **T-C1** — Determinism test exists but only covers within-process structural equality, **not cross-process byte-identical output**. Need spawn-N-subprocesses assertion to pin the determinism contract.
- **T-C2** — `manifest/free.ts` (16,561 LOC) is **untested**. After Phase 2 P-C1 converts it to JSON, add round-trip + schema-validation tests.
- **T-C3** — **No coverage thresholds** in vitest config — CI never fails on coverage drop. Add lines 80 / branches 75 / functions 80.

### High (5)

- **T-H1** — **No public API snapshot test** — accidental drift in `index.ts` exports can land silently.
- **T-H2** — **No hostile-input tests** for path traversal, symlink loops, prototype-pollution JSON payloads.
- **T-H3** — `smoke-packed-consumer.ts` (2,489 LOC) single try/catch hides phase failures. Split (D10) + add labelled-phase harness.
- **T-H4** — **No trait-identity test** — `splitting: true` invariant unguarded; if D1 (subpath demotion) regresses, queries silently return nothing.
- **T-H5** — `test:visual` browser tests are **excluded from `pnpm test:ci`** — visual regressions don't block merges. Wire them in (or stage in a follow-up gate that does block).

### Medium

- 0 mock usages, 0 snapshot tests — too far either direction; some structural snapshots would catch shape drift cheaply.
- 10 modules lack direct same-named tests (acceptable for some, audit which ones).
- No perf regression bench (cold-start, simulation throughput).
- No React render-count assertion for memoized hooks.

### Tests to add for 1.0 (priority)

1. Cross-process determinism test (E1)
2. Public API snapshot test (E2)
3. CLI hostile-input tests (E3)
4. Trait-identity test (E4)
5. CLI cold-start bench (E5)
6. Simulation throughput bench (E6)
7. React render-count assertion (E7)
8. Coverage thresholds enforced (E8)
9. Manifest round-trip + schema-validation tests (T-C2)

## Documentation — gaps that block 1.0

What exists: 6 pillar docs, 6 guides, 1,127 TypeDoc HTML pages, 6 JSON examples, machine-generated release-readiness ledger, README (31 KB), AGENTS (49 KB).

### Critical (3)

- **D-C1** — **No install/quickstart in README** — consumers have no entry point. Top of README must be: install + ≤30-line code snippet that renders something.
- **D-C2** — **No CLI reference doc** — 30+ subcommands, 4,297-line CLI, zero `docs/guides/cli.md`. Derive from new command registry post-B3.
- **D-C3** — **No public/private subpath tier table** — 8+ internal-facing exports among 41 exposed. Land with D1 in `docs/api/public-api.md`.

### High (5)

- **D-H1** — No CHANGELOG.md / migration guide. release-please will populate forward from 1.0.0.
- **D-H2** — 130 raw errors with no taxonomy or catalog. Land with D2 → `docs/api/errors.md`.
- **D-H3** — Determinism / seed contract undocumented — critical for save/load. Write `docs/guides/determinism-contract.md`.
- **D-H4** — Peer-dep guidance absent (react/three optional, not explained). Write `docs/guides/peer-deps-and-bundling.md`.
- **D-H5** — Trait-identity / bundler-splitting hazard undocumented. Same guide.

### Medium

- Trait taxonomy has no umbrella index → fixed by D5 (`src/traits.ts`).
- STANDARDS.md, ARCHITECTURE.md, TESTING.md, DEPLOYMENT.md, STATE.md absent (standard-repo profile gaps).
- Examples are JSON-only with no runnable TS code.

### Docs to write before 1.0 (priority)

1. README quickstart rewrite (F1d)
2. CLI reference (F2d)
3. Subpath tier table (`docs/api/public-api.md`)
4. Determinism contract guide (F3d)
5. Peer-deps + bundler hazard guide (F4d)
6. Errors API (F5d)
7. CHANGELOG.md (F6d)
8. STANDARDS.md (F7d)
9. ARCHITECTURE / DESIGN / TESTING / DEPLOYMENT / STATE (F8d-F12d)
10. Frontmatter on every md (F13d)
