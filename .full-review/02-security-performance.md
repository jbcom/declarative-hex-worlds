# Phase 2: Security & Performance Review — Consolidated

See `02a-security.md` and `02b-performance.md` for full detail.

## Security — Posture: STRONG, zero Criticals

Defense-in-depth largely correct: no `eval`/`Function`/shell-true, GH Actions SHA-pinned, OIDC provenance publish, frozen lockfile, dependency-review action, tight `files` allowlist, `--ignore-scripts` on consumer smoke install, `pull_request_target` not used.

### High (2)

- **S-H1** — **Path traversal in 40+ `writeFileSync(resolve(parsed.flags.outX), …))` sites in `cli.ts`** (CWE-22). `extract` (line 679) additionally `rmSync(force: true)` before write. Fix: `safeResolveOutput(value, outRoot=cwd())` helper; require explicit `--force` for destructive paths.
- **S-H2** — **`listFiles` walker (`ingest.ts:310`) follows directory symlinks blindly** (CWE-59). No `isSymbolicLink()` / `realpath` guard, no cycle detection. Combined with S-H1, hostile `--source` tree can DoS or pull files from outside intended root. Fix: skip symlinks + `realpathSync` boundary check.

### Medium (7)

- **S-M1** — `readPieceSourceRoots` (`cli.ts:3777`) parses untrusted JSON without `__proto__`/`constructor`/`prototype` filter. Add reviver + null-prototype output.
- **S-M2** — `extract-kaykit-guide.ts:129` `sh -c "command -v ${command}"` constant-input today, future foot-gun. Switch to `sh -c 'command -v "$1"' -- "$command"`.
- **S-M3** — `pnpm audit` reports 2 moderate dev-tree CVEs: `yaml <2.8.3` (CVE-2026-33532), `brace-expansion <5.0.6` (CVE-2026-45149). Clear via `pnpm.overrides`.
- **S-M4** — CLI errors echo absolute user paths; normalize to `relative(cwd, …)` in messages.
- **S-M5** — `process.exit` swallows stack traces; gate full stack on `MEDIEVAL_HEXAGON_DEBUG=1`.
- **S-M6** — `dist/**` source maps published with absolute build paths. Restrict via `files` `"!dist/**/*.map"` or build-time guard.
- **S-M7** — TOCTOU `existsSync` + read pattern across CLI. Prefer try/catch on ENOENT.

### Low (6)

- **S-L1** — `JSON.parse(JSON.stringify(…))` (`simulation.ts:5212`) — switch to `structuredClone` (also faster, see P-H5).
- **S-L2** — Dynamic `RegExp` in `ingest.ts:433-434` — escape `faction` if it ever becomes user-supplied.
- **S-L3** — `audit-workspace.ts:1138` regex lazy-anchored, safe today.
- **S-L4** — `Object.assign(merged, generation.layoutArchetypes ?? {})` safe, noted only.
- **S-L5** — `audit-workflows.ts` should fail closed on missing top-level `permissions:` per workflow.
- **S-L6** — Unscoped `bin: medieval-hexagon-gameboard` — collision risk; consider scoped alias.

### Supply chain extras

- Migrate `secrets.CI_GITHUB_TOKEN` (PAT) to GitHub App token for finer scope / rotation.
- Add `pnpm audit --prod --audit-level=high` to package job (catches prod-tree CVEs before publish).
- Add `actions/attest-build-provenance@v2` for SLSA L3 attestation.
- Add `@cyclonedx/cyclonedx-npm` SBOM as release artifact.
- Group Dependabot security updates into daily `security` channel.

### Biome rule additions (recommended set)

`noGlobalEval`, `noPrototypeBuiltins`, `noShadowRestrictedNames`, `noUnsafeNegation`, `noControlCharactersInRegex`, `noMisleadingCharacterClass`, `noUnsafeFinally`, `noConstructorReturn`, `noNonNullAssertion`, `noParameterAssign`, `noEvolvingTypes`. Plus semgrep `p/owasp-top-ten` + `p/nodejs` in CI.

---

## Performance — Headline budget snapshot

Measured from existing `dist/`:

| Dimension | Measured | Implication |
|---|---:|---|
| `dist/` total | **3,160 KB** | Big for a library; manifest dominates |
| `chunk-JZVTUPMT.js` (= freeManifest) | **394,754 B raw / 22,468 B gzip** | Forced into every umbrella consumer |
| `dist/index.js` | umbrella; transitively imports manifest chunk | +22 KB gzip baseline cost |
| `dist/cli.js` | 137 KB raw / **24.7 KB gzip** | Eager top-level imports |
| CLI cold start (estimated) | ~150-250 ms | Manifest parse + closure |
| Per-step simulation | single dispatch (NOT double-dispatch) | Phase 1 H-3 corrected |

### Important Phase 1 correction

**`simulation.ts` is NOT double-dispatching at runtime.** Line 1643 is one-shot **validation**, line 3795 is the per-step runtime dispatch. Phase 1's H-3 should be re-scoped to **decomposition only** (5,213 LOC in one file), not runtime cost.

### Critical (2)

- **P-C1** — **`freeManifest` re-exported from umbrella** (`src/index.ts:7`) forces 395 KB / 22 KB-gzip manifest chunk into every consumer. Fix: (1) remove from `src/index.ts`; (2) convert `src/manifest/free.ts` → JSON + thin loader via `import data from './free.json' with { type: 'json' }`. ~5-10× parse speedup, -22 KB gzip umbrella.
- **P-C2** — **`cli.ts` eagerly loads every subsystem + `examples/simple-rpg-usage` at top level.** Estimated CLI cold start ~150-250 ms; ~30-50 ms achievable with dynamic per-subcommand imports. Refactor to `src/cli/<command>.ts` lazy modules behind `await import(...)`. Move guide-public-api smoke helpers out of `examples/` (e.g. `src/simple-rpg-api-smoke.ts`).

### High (5)

- **P-H1** — `readGameboardActorTargets` (`actors.ts:940-953`) makes 6 sequential filter/map passes on same array. Convert to single-pass reduce. ~6× speedup on a React-driven hot hook.
- **P-H2** — `parseHexKey` (`coordinates.ts:68`) throws on missing/invalid keys; used in expected-miss paths. Add `tryParseHexKey(key): HexCoordinates | undefined`; migrate callers. ~100× speedup in expected-miss path.
- **P-H3** — `layout.ts:1276,1434,1609,1728` rebuild `new Map(plan.tiles.map(…))` per call. Materialize `tilesByKey` (+ `placementsByTile`) once at projection time and attach to `ProjectedGameboardPlan`.
- **P-H4** — `react.ts` selector hooks lose memoization with inline-object `options`. Either document loudly or hash-stabilize at hook boundary.
- **P-H5** — `JSON.parse(JSON.stringify(…))` clone in `simulation.ts:5212`. Switch to `structuredClone` (also closes S-L1).

### Medium (4)

- **P-M1** — `tsup splitting: true` + 26 chunks: dev waterfall risk. Mitigate with size-limit budgets.
- **P-M2** — Source maps shipped; ~1.5 MB per install. Add `"!dist/**/*.map"` to `files` or disable for publish.
- **P-M3** — `react.ts` has 23+ `useTrait`/`useQuery` per render in some hooks; document parent-level query pattern + add efficient example.
- **P-M4** — `simulation.ts` 5,213 LOC risks V8 long-function deopt. Resolved by decomposition (Phase 1 H-3).

### Low (3)

- **P-L1** — Vitest pool tuning; measure first.
- **P-L2** — `three.ts` missing disposal-pattern docs.
- **P-L3** — `selectors.ts` no memoization cache; acceptable for now.

### Recommended CI gates

1. `size-limit` budgets per entry: index ≤12 KB gzip, cli ≤8 KB gzip, manifest/free ≤25 KB gzip, react ≤4 KB gzip, three ≤3 KB gzip.
2. CLI cold-start benchmark (Vitest perf test): `node dist/cli.js --help` ≤ 80 ms.
3. Simulation throughput micro-bench via `tinybench`; warn on >10% regression.
4. Bundle composition diff per PR (esbuild metafile visualizer).
5. React render-count assertion for selector hooks.

---

## Critical Issues for Phase 3 Context

To seed Phase 3 (Testing) and Phase 4 (Best Practices) reviews:

- **Determinism contract** is well-defended at runtime but unverified in tests. Phase 3 should check whether there's a determinism contract test (run scenario N times with same seed, assert byte-identical output).
- **Public API surface contract** — Phase 1 F8 recommended snapshot test for `index.ts` exports. Phase 3 should verify presence/absence.
- **No size-limit / perf gates in CI today.** Phase 4 should call this out.
- **No semgrep / advanced static analysis in CI.** Phase 4 should call this out.
- **Path traversal + symlink walker findings** mean any tests using `--source` / `--out` flags should add hostile-input cases.
- **`smoke-packed-consumer.ts` single try/catch** (Phase 1 M-3) means Phase 3 should verify test isolation in smoke harness.
- **No CHANGELOG.md, STANDARDS.md, docs/{ARCHITECTURE,DESIGN,TESTING,DEPLOYMENT,STATE}.md** at repo root — standard-repo profile gaps Phase 4 must include.
