# Testing Strategy & Coverage Evaluation
## `@jbcom/medieval-hexagon-gameboard`

_Evaluated: 2026-05-26_

---

## 1. Coverage Matrix — src module vs test file

37 src modules, 35 test files, 10 modules with no direct test.

| LOC   | Module              | Direct test?  | Notes |
|------:|---------------------|:--------------|-------|
| 16562 | `manifest/free`     | NO — CRITICAL | 78 indirect refs in tests; no dedicated unit coverage |
|  5214 | `simulation`        | YES           | `simulation.test.ts` 1092 LOC, 6 top-level `it` blocks |
|  4298 | `cli`               | YES           | `cli.test.ts` 3011 LOC, 31 `it` blocks — integration-only |
|  2399 | `catalog`           | YES           | |
|  2384 | `interop`           | YES           | |
|  2261 | `actors`            | YES           | |
|  2174 | `gameboard`         | YES           | |
|  1873 | `layout`            | YES           | |
|  1419 | `scenario`          | YES           | |
|  1350 | `koota`             | YES           | |
|  1301 | `blueprint`         | YES           | |
|  1216 | `react`             | NO — HIGH     | Covered only by browser `react-bindings.test.ts` (789 LOC, 2 `it` blocks) |
|  1186 | `navigation`        | YES           | |
|  1045 | `coverage`          | YES           | |
|  1025 | `recipe`            | YES           | |
|   945 | `runtime`           | YES           | |
|   924 | `pieces`            | YES           | |
|   901 | `systems`           | YES           | |
|   752 | `commands`          | YES           | |
|   734 | `manifest/schema`   | NO — HIGH     | `manifest.test.ts` 221 LOC covers schema peripherally, not directly |
|   715 | `movement`          | YES           | |
|   712 | `rules`             | YES           | |
|   692 | `validation`        | YES           | |
|   634 | `quests`            | YES           | |
|   627 | `three`             | YES           | |
|   622 | `registry`          | YES           | |
|   589 | `patrol`            | NO — HIGH     | 269 indirect refs; no patrol-specific isolation |
|   473 | `compatibility`     | YES           | |
|   466 | `ingest`            | YES           | |
|   397 | `selectors`         | YES           | |
|   359 | `coordinates`       | NO — MEDIUM   | 25 indirect refs; coordinate math untested in isolation |
|   308 | `projection`        | NO — MEDIUM   | Only 4 indirect refs — very thin |
|   252 | `types`             | NO — LOW      | Types-only; runtime behavior N/A |
|    94 | `occupancy`         | NO — MEDIUM   | 64 indirect refs, footprint tested in smoke but not unit |
|    73 | `world-rules`       | NO — LOW      | Small; likely covered transitively |
|    39 | `rule-types`        | NO — LOW      | Types-only |

**Modules ≥500 LOC with no direct test:**
- `manifest/free` — 16562 LOC (CRITICAL)
- `react` — 1216 LOC (HIGH)
- `manifest/schema` — 734 LOC (HIGH)
- `patrol` — 589 LOC (HIGH)

---

## 2. Findings by Severity

### CRITICAL

#### C-1: `manifest/free` (16562 LOC) — zero direct unit coverage
The largest module in the codebase has no dedicated test file. It is used transitively in ~78 places across the test suite, but no test directly exercises its internal logic (asset lookups, category filters, texture resolution, bundle composition). A regression in `manifest/free` internals would pass all unit tests and only surface in integration.

**Recommended test:** `tests/unit/manifest-free.test.ts`
```ts
import { freeManifest } from '../../src/manifest/free';
describe('freeManifest structure', () => {
  it('exports non-empty asset array with required fields', () => {
    expect(freeManifest.assets.length).toBeGreaterThan(0);
    for (const a of freeManifest.assets) {
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('category');
    }
  });
  it('all asset ids are unique', () => {
    const ids = freeManifest.assets.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  // ... filter/lookup/bundle behavior
});
```

---

#### C-2: No coverage thresholds configured
`vitest.config.ts` declares `coverage.provider: 'v8'` with reporters, but has **no `thresholds` block**. Coverage runs but never fails the build. Any new uncovered code is silently accepted.

```ts
// Missing in vitest.config.ts:
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 75,
    statements: 80,
  },
}
```

---

#### C-3: Determinism contract tested structurally, not byte-identically
`rules.test.ts:73` calls `createSeededGameboardPlan` twice with the same seed and asserts `first.tiles` toEqual `second.tiles`. This is a _structural_ equality check within the same process run. It does NOT:
- Verify output is identical across separate process invocations (guards against process-global state contamination)
- Verify no `Math.random()` call leaks into the call stack

**Gap:** If any module initializes state at import time using `Math.random()` and that state influences generation, the same-process toEqual check would pass while cross-process runs differ.

**Recommended addition:** A process-boundary determinism test in the CLI smoke or a dedicated vitest fixture that forks a child process:
```ts
it('same seed produces byte-identical JSON across independent process invocations', () => {
  const run = (seed: string) => execSync(
    `node -e "const {createSeededGameboardPlan}=require('./dist/index.js');
     process.stdout.write(JSON.stringify(createSeededGameboardPlan({seed:'${seed}',shape:{kind:'rectangle',width:4,height:4}})))"`
  ).toString();
  expect(run('test-seed')).toBe(run('test-seed'));
});
```

---

### HIGH

#### H-1: No public API snapshot/export surface test
41 subpath exports exist. No test asserts the export shape. A removed export breaks consumers silently until `smoke-packed-consumer.ts` catches it — but that script only covers what it happens to import.

**Recommended:** `tests/unit/public-api.test.ts`
```ts
import * as root from '../../src/index';
const EXPECTED_EXPORTS = ['freeManifest', 'createGameboardBuilder', /* ... */];
it('umbrella export surface is stable', () => {
  for (const sym of EXPECTED_EXPORTS) {
    expect(root).toHaveProperty(sym);
  }
});
```
Also add a `check-exports` script using `attw` (Are the Types Wrong?) or `publint` to the CI pipeline.

---

#### H-2: No hostile-input tests for CLI path flags (security findings S-H1, S-H2)
`grep` for `traversal`, `symlink`, `__proto__`, `prototype` in tests returns zero results. CLI flags `--out`, `--outJson`, `--outMarkdown`, `--source` are untested against:
- Path traversal: `--out ../../etc/crontab`
- Symlink escape: `--source` pointing to a symlink outside allowed tree
- JSON prototype pollution: `__proto__` key in manifest JSON input

**Recommended:** Add to `tests/unit/cli.test.ts` (or a new `tests/unit/cli-security.test.ts`):
```ts
it('rejects --out paths that escape working directory via traversal', () => {
  const result = runCli(['plan', '--out', '../../../../tmp/evil']);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toMatch(/invalid.*path|forbidden/i);
});
it('rejects __proto__ keys in manifest JSON without throwing uncaught exception', () => {
  const malformed = '{"__proto__":{"polluted":true},"assets":[]}';
  // write to temp, run validate-manifest
  expect(runCli(['validate-manifest', '--source', tempManifest]).exitCode).not.toBe(0);
});
```

---

#### H-3: `patrol` module (589 LOC) — no direct unit test
269 indirect references across tests; no `patrol.test.ts`. The CLI tests exercise patrol route planning through command output assertions, but internal patrol logic (route construction, conflict detection, waypoint ordering) is untested in isolation.

**Recommended:** `tests/unit/patrol.test.ts` — unit test route construction, conflict detection, and degenerate cases (empty route, cyclic route, single-waypoint route).

---

#### H-4: `manifest/schema` (734 LOC) — peripheral coverage only
`manifest.test.ts` (221 LOC) references schema functions but `manifest/schema.ts` is the largest schema module. Validation logic, normalization edge cases, and error paths are not directly targeted.

---

#### H-5: `smoke-packed-consumer.ts` — single outer try/catch hides phase failures
One `try` block at line 18 wraps the entire 2,490-line script. The inner try/catch blocks at L2139-L2204 are specific error-guard assertions, not phase isolation. Any assertion failure in phase 1 (type checks) aborts phases 2-N silently with only a stack trace, making failure diagnosis slow.

No phase markers exist in the file. The script grew to 2,490 LOC without any structural sectioning.

**Concrete plan:**
1. Extract logical phases into named async functions: `smokeTypeSurface()`, `smokeRuntimeBehavior()`, `smokeSimulation()`, `smokeCLIIntegration()`, `smokeOccupancy()`.
2. Call each with `await phase('type-surface', smokeTypeSurface)` where `phase()` wraps in try/catch, reports timing, and continues to next phase rather than aborting.
3. Aggregate failures and exit non-zero if any phase failed — same semantics, much better diagnostics.

```ts
async function phase(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (e) {
    console.error(`[FAIL] ${name}:`, e);
    failures.push(name);
  }
}
```

---

### MEDIUM

#### M-1: No CLI cold-start performance test
Prior phase noted ~150-250ms cold start. No assertion enforces this. A dependency addition that increases startup to 2s would pass all tests.

**Recommended:** Add to `scripts/smoke-built-cli.ts` or a separate perf fixture:
```ts
const start = performance.now();
execSync('node dist/cli.js --help');
const elapsed = performance.now() - start;
assert(elapsed < 500, `CLI cold start ${elapsed}ms exceeded 500ms threshold`);
```

---

#### M-2: No bundle size gate
No `.size-limit` config, no `bundlesize`, no size check in `pnpm verify`. The dist grows silently. For a library with 41 subpath exports, per-entrypoint size regression is a real risk.

**Recommended:** `size-limit` package with thresholds per export path, wired to `pnpm verify`.

---

#### M-3: `coordinates` (359 LOC) and `projection` (308 LOC) lack direct tests
`coordinates` provides the hex math foundation used everywhere; only 25 test references, all indirect. If coordinate arithmetic regresses, failures appear in downstream tests with no clear root cause. `projection` has only 4 indirect references — nearly untested.

**Recommended:** `tests/unit/coordinates.test.ts` (basic arithmetic, edge/corner coordinates, shape membership) and `tests/unit/projection.test.ts`.

---

#### M-4: `occupancy` (94 LOC) tested only via smoke
The occupancy footprint check in `smoke-packed-consumer.ts` (L2132-L2150) is the only exercise of occupancy logic. It runs at integration level against the packed dist. No unit test catches a regression before the pack step.

---

#### M-5: No test randomization enabled
`vitest.config.ts` has no `sequence: { shuffle: true }` or `sequence: { seed: <n> }`. Tests run in file-system order. Shared module-level state (if any) would produce order-dependent failures that never surface in CI.

**Recommended:** Add `sequence: { shuffle: true }` to `vitest.config.ts` for unit runs, observe for flakes one CI cycle, then lock in.

---

#### M-6: `react-bindings.test.ts` — only 2 `it` blocks for 1216 LOC module
Two integration-level browser tests (`mounts Koota provider`, `mounts saved recipe and scenario runtime providers`). No tests for:
- Hook return value shapes
- Error boundaries when world is absent
- Re-render behavior on Koota mutation
- TypeScript generic constraints (tested via type-level tests)

---

### LOW

#### L-1: `cli.test.ts` at 3011 LOC is a single flat `describe` block
31 `it` blocks, no nested `describe` grouping by command. Hard to grep for coverage of a specific sub-command. Not a correctness issue, but maintainability degrades as tests are added.

**Recommended:** Group by command: `describe('ingest commands', ...)`, `describe('plan commands', ...)`, etc.

---

#### L-2: No snapshot tests for stable output formats
`grep` for `toMatchSnapshot`/`toMatchInlineSnapshot` returns 0 results. CLI output formats (JSON schemas, Markdown reports) are asserted by substring/structure checks. Snapshot tests would catch silent format drift with less assertion code.

Use sparingly — one snapshot per output format type, not per combination.

---

#### L-3: `mock-usage-in-tests` count = 0
No `vi.mock`, `jest.mock`, or sinon usage found. Tests are integration-level throughout — they use real implementations rather than doubled dependencies. This is appropriate for a library (no external I/O outside CLI FS operations), but the CLI tests writing real temp directories make them slower and environment-sensitive.

The `afterEach` cleanup in `cli.test.ts` mitigates state leakage; confirm it runs on test failure too (use `try/finally` pattern in fixtures rather than bare `afterEach`).

---

## 3. Test Pyramid Assessment

| Layer | Count | LOC | % of test LOC |
|-------|------:|----:|:--------------|
| Unit (`tests/unit/`) | 29 | 11,783 | 68% |
| Browser (`tests/browser/`) | 5 | 1,823 | 11% |
| E2E (`tests/e2e/`) | 1 | 398 | 2% |
| Smoke/Audit scripts | 9 | ~75,000 est. | — |
| **Total vitest** | **35** | **17,206** | 100% |

For a library, unit-heavy is correct. The pyramid is appropriate. The gap is not ratio but **completeness**: 4 modules ≥500 LOC lack direct coverage, coverage thresholds are not enforced, and the smoke scripts substitute for a real integration test layer without the isolation benefits of a test framework (no describe/it, no per-test cleanup, single try/catch).

---

## 4. CI Gating Analysis (`pnpm test:ci`)

```
lint → typecheck → test:docs-contract → test:api-docs → docs:build
→ test:assets → test:workspace → test:workflows → build
→ test:cli → expectations → test → test:package → test:consumer → pack:dry-run
```

**Observations:**
- `pnpm test` runs unit tests only (`vitest.config.ts` includes only `tests/unit/**`).
- `pnpm test:visual` is NOT in `test:ci`. Browser/visual tests are excluded from the CI gate.
- `pnpm test:consumer` runs `smoke-packed-consumer.ts` — the 2,490 LOC single try/catch script.
- No coverage threshold check in the gate (`pnpm test --coverage` not called).
- `expectations` runs only 3 test files (simulation, examples, simple-rpg) — duplicated subset of `test`.
- Browser regression failures would not block a merge.

---

## 5. Tests to Add for 1.0 — Prioritized List

| Priority | Test | File | Addresses |
|:--------:|------|------|-----------|
| 1 | Coverage thresholds in vitest.config.ts | `vitest.config.ts` | C-2 |
| 2 | `manifest/free` direct unit tests (structure, uniqueness, lookup) | `tests/unit/manifest-free.test.ts` | C-1 |
| 3 | Cross-process determinism assertion | `scripts/smoke-built-cli.ts` | C-3 |
| 4 | Public API export surface snapshot | `tests/unit/public-api.test.ts` | H-1 |
| 5 | CLI path traversal + `__proto__` hostile inputs | `tests/unit/cli-security.test.ts` | H-2, S-H1, S-H2 |
| 6 | `patrol` unit tests (route construction, conflicts, edge cases) | `tests/unit/patrol.test.ts` | H-3 |
| 7 | `manifest/schema` validation edge cases and error paths | `tests/unit/manifest-free.test.ts` or new file | H-4 |
| 8 | Smoke script phase isolation refactor | `scripts/smoke-packed-consumer.ts` | H-5 |
| 9 | CLI cold-start perf assertion (<500ms) | `scripts/smoke-built-cli.ts` | M-1 |
| 10 | Bundle size gate | `.size-limit.json` + CI step | M-2 |
| 11 | `coordinates` unit tests (hex math, edge, shape) | `tests/unit/coordinates.test.ts` | M-3 |
| 12 | `projection` unit tests | `tests/unit/projection.test.ts` | M-3 |
| 13 | `occupancy` unit tests (footprint conflict, multi-unit) | `tests/unit/occupancy.test.ts` | M-4 |
| 14 | Add `test:visual` to `test:ci` gate | `package.json` | implicit |
| 15 | Enable `sequence: { shuffle: true }` in vitest config | `vitest.config.ts` | M-5 |
| 16 | React hook unit tests (error boundary, re-render, type constraints) | `tests/browser/react-bindings.test.ts` | M-6 |

---

## 6. Top 5 Testing Priorities

1. **Add coverage thresholds** (C-2) — zero cost, immediate gate. Without it, every other gap is invisible to CI.
2. **`manifest/free` direct unit tests** (C-1) — largest module, zero direct coverage. Any internal regression passes all 35 test files.
3. **Cross-process determinism test** (C-3) — the determinism guarantee is the seed contract; structural toEqual within one process does not prove it.
4. **Public API export snapshot** (H-1) — catches removed symbols before they reach consumers; 10-line test, permanent protection.
5. **CLI security hostile-input tests** (H-2) — path traversal and prototype pollution are identified security findings (S-H1, S-H2) with zero test coverage; must be remediated before 1.0 release.
