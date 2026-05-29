# Security Audit — declarative-hex-worlds

Audited: 2026-05-28  
Scope: `src/` (TypeScript ESM library), `src/cli/`, bootstrap command, config,
simulation engine, CI/CD workflows.

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 3     |
| Medium   | 4     |
| Low      | 3     |

No Critical findings. The codebase demonstrates deliberate security engineering
in several areas (redirect allowlist, zip-bomb ceiling, path-jail, prototype
pollution guard, SLSA L3 provenance, SHA-pinned actions in ci/release/cd).
The remaining findings are genuine gaps, not false positives.

---

## High Findings

### H-1 — Unvalidated `--commit` / `{ref}` Interpolated into GitHub URL Without Sanitization

**Severity:** High  
**CVSS v3.1:** 7.3 (AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:H/A:N) — estimated  
**CWE:** CWE-601 Open Redirect / CWE-918 SSRF  
**File:** `src/config/index.ts:64-70`, `src/cli/_shared.ts:313`,
`src/cli/commands/bootstrap/core.ts:345-346`

**Description:**  
`kaykitGithubArchiveUrl` does a raw `.replace('{ref}', ref ?? defaultRef)` with
the caller-supplied `commit` string. The value flows directly from
`parsed.flags.commit` at `_shared.ts:313` with no validation beyond a `typeof
=== 'string'` check.

GitHub archive URLs follow this form:
```
https://github.com/{owner}/{repo}/archive/refs/heads/{ref}.zip
```

A ref value of `../../../foo` does not affect the GitHub download (GitHub
rejects it), but the generated URL string is passed verbatim to
`openHttpsStream`, which uses Node's `https.request`. If the redirect allowlist
were ever bypassed or the template changed, an attacker-controlled ref could
redirect fetching to an arbitrary host. More concretely:

- The URL is logged in error messages (`failed to download KayKit FREE archive
  ${url}`) — a crafted ref can inject arbitrary characters into log output
  (log injection / CWE-117).
- The `{ref}` slot receives no percent-encoding before insertion. Values
  containing `@`, `#`, or `?` produce structurally invalid URLs, but
  structural ambiguity can silently produce a different resource path depending
  on the URL parser.

**Attack scenario:**  
```
hex-worlds bootstrap --commit "main%0d%0aX-Injected-Header: evil" ...
```
Or in a script that reads the commit from a user-supplied scenario JSON (not
current, but the pattern is adjacent to `readJson` flows).

**Remediation:**  
Add a ref allowlist regex before insertion:
```typescript
const SAFE_REF = /^[a-zA-Z0-9._\-\/]{1,200}$/;
if (ref !== undefined && !SAFE_REF.test(ref)) {
  throw new GameboardIoError(`unsafe --commit value: ${ref}`);
}
```
Also percent-encode the ref slot:
```typescript
.replace('{ref}', encodeURIComponent(ref ?? defaultRef))
```
GitHub accepts percent-encoded branch names in archive URLs.

---

### H-2 — Production Code Imports from `tests/integration/` (Layering Inversion)

**Severity:** High  
**CVSS v3.1:** N/A (supply-chain / build integrity)  
**CWE:** CWE-829 Inclusion of Functionality from Untrusted Control Sphere  
**File:** `src/cli/_shared.ts:3-7`

**Description:**  
`_shared.ts` imports three symbols from
`../../tests/integration/simple-rpg/simple-rpg`:

```typescript
import {
  listSimpleRpgGuidePublicApiExercises,
  runSimpleRpgExecutableGuideApiSmoke,
  summarizeSimpleRpgGuidePublicApiExercises,
} from '../../tests/integration/simple-rpg/simple-rpg';
```

This is a hard layering inversion: production CLI code depends on integration
test code. Security consequences:

1. **Published package surface:** `tsup` bundles whatever `_shared.ts` imports.
   If the integration test file imports test-only devDependencies (e.g. Vitest
   globals, test fixtures), those could leak into the published tarball or cause
   runtime failures in consumer environments.
2. **Privilege escalation surface:** Test files typically have fewer security
   controls (e.g. they may call internal APIs, disable validation). Any
   vulnerability in the test file is now also a vulnerability in the production
   CLI binary.
3. **Attack surface expansion:** A supply-chain compromise of a test-only
   transitive dependency now affects production consumers.

**Attack scenario:**  
A compromised test fixture imported transitively by the integration test leaks
into the published package. Consumers running `hex-worlds` CLI execute the
compromised code.

**Remediation:**  
Move `listSimpleRpgGuidePublicApiExercises`, `runSimpleRpgExecutableGuideApiSmoke`,
`summarizeSimpleRpgGuidePublicApiExercises` out of `tests/` and into a proper
source location (e.g. `src/guides/simple-rpg/` or `src/scenario/`). The
integration test then imports from the source, not the reverse.

---

### H-3 — `readJson<T>` Casts Without Schema Validation (25+ Callers)

**Severity:** High  
**CVSS v3.1:** 6.5 (AV:L/AC:L/PR:N/UI:R/S:U/C:L/I:H/A:L)  
**CWE:** CWE-20 Improper Input Validation  
**File:** `src/cli/_shared.ts:397-398`, and callers at lines 501, 514, 550,
`validate-plan.ts:21`, `validate-recipe.ts:22`, `validate-scenario.ts:26`, etc.

**Description:**  
```typescript
export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}
```

This is a pure TypeScript cast — no runtime validation. The callers pass user-
supplied `--scenario`, `--plan`, `--script`, `--routes`, `--recipe`,
`--groups`, `--assignments` paths. The parsed object is immediately used as the
typed interface (e.g. `GameboardScenario`, `GameboardPlan`) without any field
guards beyond what the consuming function happens to check.

Consequences:
- **Type confusion:** A crafted JSON file with unexpected types for expected
  string/number fields causes runtime exceptions with stack traces that may leak
  internal paths. Some paths (like `actor.at(-1) as SpawnGameboardActorOptions`
  in engine.ts:663-665) compound this by casting the result of a falsy-producing
  array operation.
- **Prototype pollution:** `JSON.parse('{"__proto__": {...}}')` produces an own
  property named `__proto__`. `readPieceSourceRoots` (lines 3744-3758) has a
  deliberate guard for this case, but the ~25 other `readJson` call sites do
  not — they pass the result directly into engine functions that use
  `Object.assign` and spread operators internally.
- **Denial of service:** An unterminated very large JSON file will allocate
  unbounded memory during `readFileSync`.

**Remediation:**  
Introduce a `readValidatedJson<T>(path, schema)` that applies a schema
validator (Zod, Valibot, or TypeBox) before returning. Provide schemas for the
five user-facing document types: `GameboardScenario`, `GameboardPlan`,
`GameboardRecipe`, `GameboardScenarioSimulationScript`,
`GameboardPatrolRouteSet`. The existing `inspectGameboardScenario` /
`inspectMedievalHexagonManifest` paths already do structural inspection; wire
them into `readJson` rather than doing so after the fact.

Minimum mitigation while full schemas are pending: add a file-size ceiling
before `readFileSync` (e.g. 10 MB) to prevent OOM on oversized inputs.

---

## Medium Findings

### M-1 — `resolveSimulationSpawnActor` `.at(-1) as SpawnGameboardActorOptions` Unsafe Cast

**Severity:** Medium  
**CVSS v3.1:** 5.3 (AV:L/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:H)  
**CWE:** CWE-476 NULL Pointer Dereference / CWE-704 Incorrect Type Conversion  
**File:** `src/simulation/engine.ts:663-665`

**Description:**  
```typescript
return resolveGameboardScenarioActors([...existingClaims, actor], runtime.spawnGroups).at(
  -1
) as SpawnGameboardActorOptions;
```

`Array.prototype.at(-1)` returns `undefined` when the array is empty. The cast
`as SpawnGameboardActorOptions` silently types `undefined` as a valid struct.
The return value is immediately consumed at line 623:
```typescript
const actor = resolveSimulationSpawnActor(runtime, step.actor);
const entity = spawnGameboardActor(runtime.world, actor); // actor may be undefined
```

If `resolveGameboardScenarioActors` returns `[]` (e.g. all spawn groups are
exhausted, or the actor's `spawnGroupId` references a non-existent group), the
cast succeeds silently and `spawnGameboardActor` receives `undefined`. Depending
on ECS internals this could produce a corrupt world state, panic, or a
misleading error attributed to the wrong system.

**Attack scenario:**  
A crafted `--scenario` JSON references a `spawnGroupId` that does not exist in
the scenario's `spawnGroups`. The simulation runs without error, but spawns the
actor at an undefined position, silently corrupting game state.

**Remediation:**  
```typescript
const resolved = resolveGameboardScenarioActors([...existingClaims, actor], runtime.spawnGroups).at(-1);
if (resolved === undefined) {
  throw new GameboardRuntimeError(
    `Simulation actor ${actor.actorId} could not be resolved to a spawn location (spawnGroupId: ${actor.spawnGroupId})`
  );
}
return resolved;
```

---

### M-2 — Nightly Bootstrap Workflow Uses Unpinned Action SHAs

**Severity:** Medium  
**CVSS v3.1:** 6.3 (AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N)  
**CWE:** CWE-829 Inclusion of Functionality from Untrusted Control Sphere  
**File:** `.github/workflows/bootstrap-nightly.yml:28-34,74`

**Description:**  
All four actions in the nightly bootstrap workflow reference mutable version
tags, not immutable commit SHAs:

```yaml
- uses: actions/checkout@v4          # line 28 — mutable tag
- uses: pnpm/action-setup@v4         # line 30 — mutable tag
- uses: actions/setup-node@v4        # line 34 — mutable tag
- uses: actions/upload-artifact@v4   # line 74 — mutable tag
```

By contrast, `ci.yml`, `release.yml`, and `cd.yml` all use pinned SHAs with
version comments (e.g. `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2`).

The nightly workflow runs with `HEX_WORLDS_OUT_ROOT: '/'` (line 54/60), which
intentionally widens the output jail to the filesystem root so bootstrap can
write to `/tmp`. A supply-chain compromise of any of these mutable-tag actions
runs in a context with filesystem-root write access — the combination of an
unpinned third-party action and an open `OUT_ROOT` is more dangerous than
either alone.

**Remediation:**  
Pin all four actions to SHA digests matching their current `v4`/`v6` equivalents,
consistent with the style already used in `ci.yml`:
```yaml
- uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
- uses: pnpm/action-setup@0e279bb959325dab635dd2c09392533439d90093 # v6.0.8
- uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7372e8dae4041e # v6.4.0
- uses: actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6.0.0
```

---

### M-3 — `stageFromZip` Cleanup Not Covered by `finally` in the Edition-Mismatch Branch

**Severity:** Medium  
**CVSS v3.1:** 3.3 (AV:L/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L)  
**CWE:** CWE-459 Incomplete Cleanup  
**File:** `src/cli/commands/bootstrap/core.ts:371-405`

**Description:**  
`stageFromZip` creates a `stagingRoot` via `mkStagingRoot('zip')` (line 380),
then has three separate `rmSync` calls in error branches plus one in
`bootstrapKayKitAssets`'s `finally` block (line 259). The logic is:

```
stagingRoot created (line 380)
├── extractZipTo throws → rmSync(stagingRoot) + throw  ✓ (line 384)
├── edition mismatch → rmSync(stagingRoot) + throw     ✓ (lines 393, 399)
└── returns stagingRoot to caller
    └── caller's finally: rmSync(stagingRoot)          ✓ (line 259)
```

This is correct for the current code paths, but is fragile: any future code
path added between `findPackRoot` (line 389) and the `return stagingRoot` that
throws without an explicit cleanup will leak the temp directory. The pattern
also calls `rmSync` three times in identical `{ recursive: true, force: true }`
form (duplication = maintenance risk).

Additionally, `downloadGithubArchiveZip` (lines 363-368) cleans up
`downloadRoot` on error but not in a `finally`, so a future refactor that
moves code after the `rmSync` but before `return zipPath` could leak
`downloadRoot` on success-then-crash.

**Remediation:**  
Restructure `stageFromZip` to use a single `try/finally`:
```typescript
const stagingRoot = mkStagingRoot('zip');
let ok = false;
try {
  await extractZipTo(absoluteZip, stagingRoot);
  // ... detection + validation ...
  ok = true;
  return stagingRoot;
} finally {
  if (!ok) rmSync(stagingRoot, { recursive: true, force: true });
}
```
The caller's `finally` in `bootstrapKayKitAssets` handles cleanup of successful
staging; the inner `finally` handles all error paths.

---

### M-4 — `HEX_WORLDS_OUT_ROOT='/'` in Nightly Workflow Widens Jail to Filesystem Root

**Severity:** Medium  
**CVSS v3.1:** 4.4 (AV:L/AC:H/PR:L/UI:N/S:U/C:N/I:H/A:N)  
**CWE:** CWE-22 Path Traversal  
**File:** `.github/workflows/bootstrap-nightly.yml:53-54,59-60`

**Description:**  
The nightly workflow sets `HEX_WORLDS_OUT_ROOT: '/'` to allow writing to
`/tmp/bootstrap-target`. `defaultOutRoot()` in `_shared.ts:250-255` consumes
this env var and widens the `safeResolveOutput` jail:

```typescript
const envRoot = process.env.HEX_WORLDS_OUT_ROOT;
if (typeof envRoot === 'string' && envRoot.length > 0) {
  return resolve(envRoot);
}
```

With `OUT_ROOT='/'`, any `--out /etc/passwd` or `--out /home/runner/.ssh/` value
would pass the jail check (since `/etc/passwd` is "inside" `/`). The nightly
workflow hardcodes `--out /tmp/bootstrap-target`, so there is no immediate
exploit path in the workflow itself. However:

1. Any future step that reads `--out` from an external source (e.g. a
   workflow_dispatch input) combined with `OUT_ROOT='/'` would be exploitable.
2. The design of having an env var that defeats the security jail is itself a
   footgun for future contributors who might set it broadly without understanding
   the security implication.

**Remediation:**  
Prefer a narrower `OUT_ROOT`:
```yaml
HEX_WORLDS_OUT_ROOT: '/tmp'
```
This allows writing to `/tmp/bootstrap-target` while preventing writes to
`/etc`, `/home`, `/root`, etc. Alternatively, add a warning to the
`defaultOutRoot` function when `OUT_ROOT` is set to `/` and document the
footgun explicitly in comments.

---

## Low Findings

### L-1 — `interop/internal` Barrel Pierced Directly from Production CLI Code

**Severity:** Low  
**CVSS v3.1:** N/A (architecture / encapsulation)  
**CWE:** CWE-653 Insufficient Compartmentalization  
**File:** `src/cli/_shared.ts:57`

**Description:**  
```typescript
import { GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS } from '../interop/internal';
```

This import bypasses the `interop` public barrel (index.ts) and accesses an
`@internal` subpath directly. If the `internal` module ever contains security-
sensitive implementation details (e.g. credential handling, signature keys,
internal API endpoints), piercing the barrel makes those details transitively
importable by any code that imports `_shared.ts`.

The same symbol `GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS` is imported from the
public `../interop` path at line 46, making the inconsistency visible. The
`internal` symbol should either be promoted to the public barrel or the CLI
should not reference it directly.

**Remediation:**  
Re-export `GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS` from the `interop`
public barrel (`src/interop/index.ts`) and update the import in `_shared.ts` to
use the public path.

---

### L-2 — `readSidecar` Parses JSON Without Size Limit

**Severity:** Low  
**CVSS v3.1:** 3.3 (AV:L/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L)  
**CWE:** CWE-770 Allocation of Resources Without Limits or Throttling  
**File:** `src/cli/commands/bootstrap/core.ts:560-572`

**Description:**  
`readSidecar` calls `readFileSync(path, 'utf8')` then `JSON.parse(raw)` with no
file-size ceiling. A crafted `.bootstrap.json` with a `files` array containing
millions of entries (each with `path`, `sha256`, `bytes`) could cause OOM in
both the parse phase and the subsequent `verifyBootstrap` hash loop (which opens
a `createReadStream` for each entry).

Although a sidecar is produced by bootstrap itself (and thus trusted in normal
use), `verifyBootstrap` is also callable with an arbitrary `outRoot` — a
directory an attacker might have written to (e.g. via a path confusion during
bootstrap).

**Remediation:**  
Add a `statSync(path).size` check before `readFileSync` — reject sidecars
larger than a reasonable ceiling (e.g. 10 MB, since the total manifest for 400+
files is well under 1 MB). Additionally add a `parsed.files.length` sanity
check (e.g. max 10,000) before entering the hash loop.

---

### L-3 — Symlink Traversal Guard in `walkFiles` Skips Symlinks Entirely

**Severity:** Low  
**CVSS v3.1:** 3.3 (AV:L/AC:H/PR:L/UI:N/S:U/C:L/I:N/A:N)  
**CWE:** CWE-61 UNIX Symbolic Link Following  
**File:** `src/cli/commands/bootstrap/core.ts:521-540`

**Description:**  
`walkFilesInternal` skips symbolic links (`entry.isSymbolicLink() → continue`)
and validates directory traversal via `realpathSync`. This is correct and safe
for the nominal case. However, it means a zip archive that uses symlinks in the
KayKit pack tree (e.g. a future upstream pack revision or a crafted EXTRA-edition
zip) will silently skip those files, producing an incomplete bootstrap with fewer
files than `expectedGltfCount`. The edition validation catches large-scale
mismatches, but a targeted symlink replacement of a single GLTF with a symlink
to `/dev/null` would produce a valid bootstrap sidecar recording a 0-byte file.

This is a data-integrity issue rather than a direct exploit (the sidecar SHA
would record a 0-byte hash; `verifyBootstrap` would pass since the symlink
target is empty). A consumer using the GLTF would get a broken asset, not a
security breach.

**Remediation:**  
When `entry.isSymbolicLink()` is encountered during `walkFilesInternal`, log a
warning rather than silently skipping. In `mirrorPackTree`, assert that the
expected GLTF count matches the walked count (layout already exposes
`expectedGltfCount`) and fail bootstrap if the delta is significant.

---

## Positive Security Controls (Non-Findings)

The following controls were explicitly verified and are well-implemented:

- **Redirect allowlist** (`core.ts:620-624`): GitHub, `codeload.github.com`,
  `objects.githubusercontent.com` only. Correct use of `new URL(location, url)`
  for relative redirect resolution. Depth-limited to 5 hops.

- **Zip-slip guard** (`core.ts:691-696`): `relative(targetRoot, targetPath)`
  checked for `..` prefix and absolute paths before each entry is written.
  Defense in depth with a real-time byte counter (line 727-736) in addition to
  the advisory `uncompressedSize` check (line 705-712). The 64 MB per-entry
  ceiling is appropriate.

- **Output path jail** (`_shared.ts:274-282`): `safeResolveOutput` is
  consistently applied to all `--out*` flags across the CLI surface. The guard
  using `relative(root, resolved)` with `sep` is correct.

- **Prototype pollution guard** (`_shared.ts:3726-3758`): `readPieceSourceRoots`
  uses `Object.create(null)`, validates keys against `RESERVED_OBJECT_KEYS` and
  a strict allowlist regex. This is the only `readJson` callsite with this
  protection.

- **SLSA L3 / OIDC trusted publishing** (`release.yml`): No `NODE_AUTH_TOKEN`
  secret; OIDC exchange via `id-token: write`. SHA-pinned `attest-build-
  provenance` action. SBOM generated via CycloneDX.

- **SHA-pinned actions** in `ci.yml`, `release.yml`, `cd.yml`: All third-party
  actions are pinned to immutable commit SHAs with version comments. Only
  `bootstrap-nightly.yml` deviates (H-3 above).

- **`persist-credentials: false`** set on all `checkout` steps in
  `ci.yml`, `release.yml`, `cd.yml` — prevents GITHUB_TOKEN from leaking into
  git config on disk.

- **No `exec`/`spawn` with user input**: grep across all `src/` finds no
  `child_process` usage; the simulation `spawn` references are ECS world spawns,
  not OS process spawns.

- **`pnpm install --frozen-lockfile`** enforced in all workflow install steps.
  `pnpm-lock.yaml` present with integrity hashes.

- **`pnpm audit --prod --audit-level=high`** as a blocking release gate in
  `release.yml`, with `dependency-review-action` in `ci.yml` for per-PR CVE
  intake.

---

## Dependency Snapshot (Notable)

```json
"dependencies": {
  "yauzl": "^3.3.1",      -- zip extraction; no known CVEs in 3.x
  "citty": "^0.2.2",      -- CLI framework; low attack surface
  "seedrandom": "^3.0.5", -- deterministic RNG; not security-critical
  "three": "^0.184.0",    -- rendering only; not in CLI path
  "koota": "^0.6.6"       -- ECS; not in CLI path
}
```

`yauzl ^3.3.1` uses a semver range; the next major could introduce breaking
API changes. Consider pinning to `~3.3.1` in the published dependency to
prevent unexpected upstream changes from reaching consumers before the team
has reviewed them.

---

## Recommended Fix Priority

| Priority | Finding | Effort |
|----------|---------|--------|
| 1 | H-2: Test import layering inversion | Medium — move 3 symbols to src/ |
| 2 | H-3: readJson schema validation | High — add Zod/Valibot schemas per doc type |
| 3 | H-1: --commit ref sanitization | Low — add regex guard + encodeURIComponent |
| 4 | M-1: .at(-1) undefined guard | Low — add null check + throw |
| 5 | M-2: Nightly unpinned action SHAs | Low — mechanical SHA substitution |
| 6 | M-3: stageFromZip cleanup pattern | Low — restructure to try/finally |
| 7 | M-4: OUT_ROOT='/' footgun | Low — narrow to /tmp in nightly workflow |
| 8 | L-1: interop/internal direct import | Trivial — re-export from public barrel |
| 9 | L-2: readSidecar size limit | Trivial — statSync check |
| 10 | L-3: symlink gap warning | Low — add warning + count assertion |
