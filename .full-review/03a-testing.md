# Testing Strategy & Coverage Review — `declarative-hex-worlds`

Phase 3a. Test automation assessment of the vitest suite, CI gates, and the
security/performance test surface. Cross-references Phase 1/2 code-quality and
security findings (H-1, H-2, H-3, P-1, P-8).

Repo: `/Users/jbogaty/src/jbcom/declarative-hex-worlds`
Framework: TypeScript ESM · vitest (5 configs) · v8 coverage · Semgrep SAST in CI.

---

## Executive summary

The suite is **large and behavior-oriented** (897 `it`/`test` blocks across 73
spec files, ~28.4k LOC of tests) with genuinely good correctness coverage of the
ECS/simulation/navigation core. The pyramid is healthy in shape. But there are
**four structural holes that a test engineer must treat as release blockers**:

1. **The coverage ratchet does not run in CI.** `test:coverage:enforce` is
   documented as "local-only" in `ci.yml`. PR CI runs `pnpm test` with no
   threshold check, so the 73/69/80/73 floor is advisory. Coverage can silently
   regress on any merged PR. (Critical)
2. **Every network/security guard on the bootstrap fetch path is untested in
   per-PR CI.** The redirect allowlist (CWE-601/918), the live `extractZipTo`
   zip-slip guard, and the 64 MB zip-bomb ceiling (CWE-409) have **zero unit
   tests**. They are only exercised by network-gated e2e (`skipIf` on env vars)
   that never runs on PRs. (Critical / High)
3. **H-1 is not just untested — the existing test encodes the vulnerable
   behavior as correct.** `smoke.test.ts` asserts
   `kayKitFreeGithubTarballUrl('deadbeef')` interpolates the ref raw, and there
   is no test for a malicious `--commit` (`../`, `%2f`, CRLF, scheme switch).
   (High)
4. **`readJson<T>` error contract is untested at all five user-JSON entry
   points** (`--scenario/--plan/--script/--routes/--recipe`). The one
   `readJson` test (`_shared.test.ts:118`) checks the happy path only — no
   malformed-JSON, no wrong-shape, no missing-file assertion. (High)

Plus three banned `it.skip` stubs in `cli.test.ts` (per repo rules, stubs are
bugs), no pathfinding perf regression guard (P-1), and benches that assert
nothing and run in no workflow.

---

## 1. Test coverage

### Pyramid (repo specs only; node_modules/docs-site excluded)

| Layer | Files | Location |
|---|---|---|
| Unit (colocated) | 48 | `src/**/__tests__/*.test.ts(x)` |
| Unit (top-level) | 7 | `tests/unit/` |
| Contract | 9 | `tests/contract/` |
| Integration | 2 | `tests/integration/` |
| E2E | 3 | `tests/e2e/` (all `skipIf`-gated) |
| Browser/visual | 4 | `tests/browser/` (separate configs, local-only) |
| Bench | 3 | `tests/perf/` (no assertions, no CI) |

~897 `it`/`test` blocks total. Shape is correct: heavy unit base, thin
integration/e2e tip. The concern is **what the tip gates**, not the ratio.

### Well-covered paths (no action)
- ECS/simulation core: `simulation.test.ts` (1091 LOC), `script-validation.test.ts`
  (1444 LOC), `scenario.test.ts` (1264), `actors`, `runtime`, `systems`, `pieces`.
- Navigation correctness: `src/gameboard/__tests__/navigation.test.ts` (604 LOC)
  covers blocked tiles, footprint occupancy, ship/custom profiles, terrain-cost
  reachable ranges, deterministic seeded spawn groups, and route-failure
  diagnostics. This is the strongest file in the suite.
- Bootstrap happy/idempotent/tamper paths: `core.test.ts` (480 LOC) builds a
  synthetic zip via `yazl`, asserts mirror tree, sidecar sha256, `verifyBootstrap`
  OK/tamper/missing-sidecar/unsafe-sidecar-path branches, edition-mismatch and
  force-clear behavior. Good.

### Critical untested paths

| Code path | File:line | Test status |
|---|---|---|
| Redirect allowlist (`openHttpsStream`, disallowed host → reject) | `core.ts:626-668` | **None.** No unit test reaches this; `https.request` is never stubbed. |
| Live `extractZipTo` zip-slip (`relativeTarget.startsWith('..')`) | `core.ts:691-697` | **None.** Only `verifyBootstrap` sidecar-path rejection is tested — a different guard. |
| Zip-bomb ceiling (declared `uncompressedSize` reject) | `core.ts:705-712` | **None.** |
| Zip-bomb ceiling (streamed-bytes abort, defense-in-depth) | `core.ts:722-735` | **None.** |
| `kaykitGithubArchiveUrl` ref interpolation w/ hostile input | `config/index.ts:65-71` | **None** (smoke test asserts only benign refs). |
| `readJson` malformed/wrong-shape/missing-file | `_shared.ts:397` | **Happy-path only** (`_shared.test.ts:118`). |
| Pathfinding large-board perf | `navigation.ts:1157 lowestCostKey` | **None** (P-1). |

CI gate reality (`.github/workflows/ci.yml`): matrix runs `lint typecheck build
test`. **`test:coverage:enforce`, browser visuals, and all `skipIf` e2e are
explicitly local-only.** So on a PR, the network/zip security guards above are
**never executed** — the synthetic-zip `core.test.ts` runs, but it never feeds a
zip-slip entry, an oversize entry, or a redirect through the live extractor/fetcher.

---

## 2. Test quality

**Behavior vs implementation: good.** Tests assert observable outcomes (path
keys, sidecar contents, error messages, exit codes) rather than internal calls.
`cli-security.test.ts` drives the real CLI as a subprocess — true black-box
behavior testing. `core.test.ts` re-reads files and recomputes sha256 to verify
integrity rather than trusting return values.

**Assertion quality: mostly strong, with soft spots:**
- `cli-security.test.ts:111` (symlink hardening) asserts only
  `result.status not 0` for the `__proto__` case and explicitly comments "we
  don't want this combination to succeed silently" — a **weak assertion** that
  passes whether the prototype-pollution guard fired or the command merely
  errored earlier. It cannot distinguish guard-worked from guard-never-reached.
  Recommend asserting the specific guard message.
- `cli-security.test.ts` symlink test regex `found 1|gltfCount: ?1` is
  format-coupled; if diagnostic wording changes the test silently weakens.
- Smoke-test `kayKitFreeGithubTarballUrl('deadbeef')` is a **pin-down of a
  vulnerable contract** — it documents raw interpolation as expected, which will
  actively resist the H-1 fix unless updated alongside.

**`it.skip` stubs (repo rule: stubs are bugs):**
- `cli.test.ts:219`, `:1426`, `:1922` — three skipped tests parked on
  "Phase RB/RS/C3" excuses. Per global directive these are bugs: fix the
  fixture/guard mismatch and re-enable, or delete.

---

## 3. Test pyramid analysis

Shape is appropriate for a deterministic library + CLI: the heavy unit base is
correct since most logic is pure (coordinates, navigation, simulation, manifest).

**The problem is gating, not ratio.** Three of the most security-relevant test
files only run outside PR CI:
- `tests/e2e/simple-rpg-ci.test.ts` — `skipIf(!HEX_WORLDS_E2E_GITHUB)` →
  scheduled nightly only.
- `tests/e2e/simple-rpg-local-extra.test.ts` — `skipIf(!HEX_WORLDS_LOCAL_REFERENCES)`
  → local only.
- `tests/browser/*` — separate configs, local-only.

Net effect: the **only** tests that touch real HTTPS fetch + real zip extraction
are env-gated and absent from the PR signal. The unit/integration tier must
absorb these guards with synthetic inputs (it already has the `yazl` harness to
do so — see §6).

---

## 4. Edge cases

**Covered well:** out-of-range paths, blocked start/goal, edition mismatch,
non-empty-target-without-force, garbage zip, missing zip path, tamper detection,
duplicate spawn-group ids, unreachable spawn routes.

**Gaps:**
- **Concurrency:** essentially none. `grep` for `Promise.all`/`concurrent` finds
  only image-load fan-out in browser tests. `bootstrapKayKitAssets` is async and
  writes to a target dir — no test for two concurrent bootstraps into the same
  `out` (idempotency is tested only sequentially). Low severity for a CLI but
  worth one test.
- **Boundary on zip ceiling:** an entry at exactly `KAYKIT_MAX_ZIP_ENTRY_BYTES`
  vs one byte over is untested (the off-by-one on `>` vs `>=`).
- **Redirect depth:** the `redirects > 5` cap (`core.ts:627`) is untested.
- **`readJson` on empty file / BOM / trailing comma** — untested.

---

## 5. Test maintainability

**Isolation: good.** `tests/setup/koota-cleanup.ts` is a global setup file;
temp dirs use `mkdtempSync` + `afterAll` rmSync cleanup consistently.

**Mock usage: notably thin — this is the root cause of the network gap.**
`vi.mock`/`vi.spyOn` appears in **exactly one file** (`commands.test.ts`, 12
occurrences). The bootstrap fetch path (`openHttpsStream`, `httpsRequest`) is
never mocked, which is precisely why the redirect allowlist can't be unit-tested
today. The fix is to introduce an injectable HTTP layer or `vi.mock('node:https')`.

**Flaky indicators:**
- `cli-security.test.ts` / `core.test.ts` spawn `pnpm exec tsx` subprocesses
  with 30s timeouts — slow and CI-load-sensitive, but bounded.
- Many `skipIf(existsSync(references/...))` tests **silently skip** when the
  reference tree is absent. On CI the references aren't present, so these
  produce zero failures AND zero coverage — a "green but didn't run" trap. The
  coverage thresholds comment even admits CI numbers are ~1-2pp below local
  *because* these skip. This is acceptable design but must be paired with the
  synthetic-fixture unit tests so the guards are never fully unverified.

---

## 6. Security test gaps (priority section)

### S-1 — Redirect allowlist untested (Critical)
`openHttpsStream` (`core.ts:646`) rejects redirects to hosts outside
`{github.com, codeload.github.com, objects.githubusercontent.com}`. **No test.**
A regression that drops the allowlist check would ship green.

```ts
// src/cli/commands/bootstrap/__tests__/fetch-redirect.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

afterEach(() => vi.restoreAllMocks());

function fakeResponse(status: number, location?: string) {
  const res: any = new EventEmitter();
  res.statusCode = status;
  res.headers = location ? { location } : {};
  res.resume = () => {};
  return res;
}

it('rejects a redirect to a disallowed host (CWE-601/918)', async () => {
  const https = await import('node:https');
  vi.spyOn(https, 'request').mockImplementation(((_url: any, _opts: any, cb: any) => {
    cb(fakeResponse(302, 'https://evil.example.com/leak'));
    return { on() {}, end() {} } as any;
  }) as any);
  // openHttpsStream is module-private; expose it via a test-only export or
  // drive it through downloadGithubArchiveZip with source.kind === 'github'.
  await expect(/* invoke fetch */).rejects.toThrow(/disallowed host evil\.example\.com/);
});

it('follows an allowlisted github.com -> codeload redirect chain', async () => { /* ... */ });
it('aborts after 5 redirects', async () => { /* loop 6 allowlisted 302s */ });
```
Requires making `openHttpsStream` test-visible (add to a `__test__` export
barrel) or injecting the `https` module. The latter also resolves the H-2
layering inversion incentive.

### S-2 — Live zip-slip guard untested (Critical)
`core.test.ts` only tests `verifyBootstrap`'s sidecar-path rejection — a
**different** guard than `extractZipTo`'s `relativeTarget.startsWith('..')`.
The `yazl` harness already in the file can author a hostile entry directly:

```ts
it('extractZipTo rejects a zip entry that escapes the target root', async () => {
  const zip = new yazl.ZipFile();
  zip.addBuffer(Buffer.from('x'), '../../../escape.gltf'); // zip-slip
  zip.end();
  const p = join(tmp(), 'slip.zip');
  await new Promise<void>((r, j) => { const s = createWriteStream(p);
    s.on('close', r); s.on('error', j); zip.outputStream.pipe(s); });
  await expect(bootstrapKayKitAssets({
    source: { kind: 'zip', path: p }, out: tmp(), outRoot: '/', edition: 'free',
  })).rejects.toThrow(/escapes target root/);
});
```

### S-3 — Zip-bomb ceiling untested (High, CWE-409)
Both the declared-size reject (`core.ts:705`) and the streamed-bytes abort
(`core.ts:722`) need tests. The declared-size path is testable by crafting a zip
whose central-directory `uncompressedSize` exceeds 64 MB; the streamed path needs
a highly-compressible buffer that decompresses past the cap. Also test the
exact-boundary (`=== KAYKIT_MAX_ZIP_ENTRY_BYTES` should pass, `+1` should fail).

### S-4 — `--commit` / ref interpolation injection untested (High → H-1)
`kaykitGithubArchiveUrl` does `template.replace('{ref}', ref)` with no
validation. Add (1) a unit test that hostile refs are rejected/encoded once a
sanitizer is added, and (2) **update `smoke.test.ts:36`** which currently asserts
the vulnerable raw-interpolation contract:

```ts
it.each([
  '../../../../etc/passwd',
  'main%2f..%2f..%2fsecret',
  'main\r\nHost: evil.com',
  'https://evil.com/x',
])('rejects hostile --commit ref %s', (ref) => {
  expect(() => kaykitGithubArchiveUrl(ref)).toThrow(/invalid ref/i);
});
it('accepts a valid 40-char sha and branch/tag names', () => {
  expect(() => kaykitGithubArchiveUrl('a'.repeat(40))).not.toThrow();
  expect(() => kaykitGithubArchiveUrl('v1.0.0')).not.toThrow();
});
```

### S-5 — `readJson<T>` unvalidated at 5 CLI entry points (High → H-3)
`readJson` (`_shared.ts:397`) is a bare `JSON.parse(...) as T` — a false
type-safety cast trusted by 25 callers including `--scenario/--plan/--recipe/
--routes/--script`. Every entry point needs a tested error contract for: (a)
malformed JSON, (b) valid JSON of the wrong shape, (c) missing file. Drive each
through the CLI subprocess so the published binary is what's covered:

```ts
it.each(['--scenario','--plan','--recipe','--routes'])(
  'CLI %s reports a clear error on malformed JSON', (flag) => {
    const p = join(tmp(), 'bad.json'); writeFileSync(p, '{not json');
    const r = runCli([subcmdFor(flag), flag, p]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/invalid JSON|failed to parse/i); // not a raw SyntaxError stack
  });
```
The deeper fix (zod/valibot schema in `readJson`) is a code change; the test
contract above should be written first (Docs→Tests→Code) and will fail until the
validation lands.

### Existing security tests (keep, strengthen)
- `cli-security.test.ts` C1 jail (`--outJson`/`--outMarkdown` traversal) — solid.
- `_shared.test.ts` `safeResolveOutput` `../` + absolute escape — solid.
- Strengthen the `__proto__` prototype-pollution test (§2) to assert the guard
  message, not just non-zero exit.

---

## 7. Performance test gaps

**Pathfinding correctness: covered.** `navigation.test.ts` exercises the real
`findGameboardPath` → `findHexPath` path under blockers, profiles, footprints,
and terrain costs with deterministic key assertions.

**Pathfinding perf regression: none (P-1, High).** The A* open set is a `Set` +
`lowestCostKey` **linear scan** (`navigation.ts:573-577,1157-1160`) — O(|open|)
per pop, O(V²) worst case. There is **no test guarding correctness across a heap
refactor and no complexity regression guard.** Before swapping in a binary heap,
add:
1. A **large-board correctness oracle**: generate a 50×50 board with random
   weighted obstacles under a fixed seed; assert `findGameboardPath` returns the
   same cost/path as the current implementation (golden snapshot). This catches
   a heap refactor that breaks tie-breaking (the current sort tie-breaks on
   `r` then `q` — a heap must preserve that for deterministic output).
2. A **bounded perf guard** (not a flaky wall-clock): assert `result.visited` (a
   deterministic counter already returned, `navigation.ts:803-804`) stays at or
   below a known ceiling for a fixed board. This is deterministic and CI-safe,
   unlike timing.

```ts
it('large weighted board path is deterministic and bounded (P-1 guard)', () => {
  const plan = makeSeededWeightedBoard(50, 50, /*seed*/ 1234);
  const r = findGameboardPath(plan, '0,0', '49,49');
  expect(r.found).toBe(true);
  expect(r.cost).toBe(EXPECTED_COST);          // golden — survives heap refactor
  expect(r.path.map(t => t.key)).toEqual(GOLDEN_PATH);
  expect(r.visited).toBeLessThanOrEqual(VISITED_CEILING); // node-expansion guard
});
```

**Benches assert nothing and run nowhere (Medium).** `tests/perf/*.bench.ts`
(cli-cold-start, warm-start, simulation) are `vitest bench` trend tools with no
threshold and no CI workflow (confirmed: no bench in `ci.yml`/`cd.yml`). They
are documented as "non-blocking until B3 lands." That's a deferred gate, but
**there is currently no automated perf signal on any merge.** Recommend at
minimum a nightly bench workflow that uploads results as an artifact (mirror the
`bootstrap-nightly.yml` pattern) so a regression is at least visible.

**P-8 — `loadFreeManifest` async path:** the eager `freeManifest` 380 KB literal
is exercised everywhere; `loadFreeManifest` is tested for identity-stability
(`manifest.test.ts:24-28`) in Node. It is **not** verified in any browser visual
test that the async path is what browser bundles actually take — but since
`loadFreeManifest` just returns the eager export, the runtime risk is the bundle
*including* the 380 KB literal regardless. That's a bundling/code-split concern
for the build review, not a test gap per se; one browser test asserting
`await loadFreeManifest()` resolves would close the functional question.

---

## Prioritized remediation list

| # | Sev | Action |
|---|---|---|
| 1 | Critical | Run the coverage ratchet in CI (`test:coverage:enforce` or `HEX_WORLDS_COVERAGE_ENFORCE=1`) so the floor actually gates PRs. |
| 2 | Critical | Add unit tests for the redirect allowlist (S-1) via `vi.mock('node:https')`; requires exposing `openHttpsStream` to tests. |
| 3 | Critical | Add live `extractZipTo` zip-slip test (S-2) using the existing `yazl` harness. |
| 4 | High | Add zip-bomb ceiling tests — declared-size, streamed-bytes, exact-boundary (S-3). |
| 5 | High | Add hostile `--commit`/ref tests AND fix `smoke.test.ts:36` which pins the vulnerable contract (S-4 / H-1). |
| 6 | High | Add `readJson` malformed/wrong-shape/missing-file contract tests at all 5 CLI JSON entry points (S-5 / H-3). |
| 7 | High | Add pathfinding golden-path + `visited`-ceiling guard before any heap refactor (P-1). |
| 8 | Medium | Delete or fix-and-re-enable the 3 `it.skip` stubs in `cli.test.ts`. |
| 9 | Medium | Strengthen the `__proto__` prototype-pollution assertion to match the guard message, not just exit code. |
| 10 | Medium | Add a nightly bench workflow with artifact upload so perf has automated signal. |
| 11 | Low | One concurrent-bootstrap test; one redirect-depth-cap test; `readJson` empty/BOM edge tests. |

## Note for the architecture reviewer
The mock-injection fix for S-1 is the natural lever to also resolve **H-2**
(production `_shared.ts:4-7` importing from `tests/integration/`): introduce an
injectable HTTP/source seam so production code depends on an interface, tests
supply the fake, and the test→prod import inversion disappears. Test design and
the layering fix are the same change.
