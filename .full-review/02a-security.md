# Security Audit — @jbcom/medieval-hexagon-gameboard

Scope: `packages/medieval-hexagon-gameboard/src/` (38 TS modules) and `scripts/` (12 audit/smoke scripts) on branch `codex/initial-medieval-hexagon-gameboard`.

Date: 2026-05-26.

Overall posture: **strong**. This is a defensively built library. No `eval`, no `Function`, no shell-true child-process invocations, no `pull_request_target` triggers, all third-party GitHub Actions pinned to commit SHAs, OIDC provenance publish flow, frozen-lockfile, dependency-review action. The published surface (`files: [assets/free, docs/showcases, dist, examples/*.json, LICENSE, README.md, NOTICE.md]`) is tight and asserted by `scripts/audit-package.ts`. No `Math.random` in deterministic paths (Phase 1 verified).

Findings below are mostly trust-boundary refinements for a tool that runs locally on developer machines and in CI. **There are no Critical findings.** Two Highs concern path/symlink handling in CLI write paths and the recursive directory walker. Mediums are mostly hardening recommendations.

---

## Critical

None.

---

## High

### H1. CLI `--out*` flags accept arbitrary paths — write-anywhere if invoked from untrusted argv

**CWE-22 (Path Traversal) / CWE-73 (External Control of File Name or Path).** CVSS-ish: 5.5 (AV:L/AC:L/PR:L/UI:N — local, requires invocation, no integrity boundary inside the user's own filesystem).

**Locations** (`packages/medieval-hexagon-gameboard/src/cli.ts`):
- Lines 286, 398, 430, 563, 625, 642, 725, 930, 965, 973, 984, 997, 1010, 1028, 1081, 1116, 1121, 1151, 1189, 1195, 1238, 1309, 1338, 1390, 1394, 1732, 1788, 1901, 1913, 2014, 2128, 2183, 2235, 2268, 2311, 2315, 2328, 2669, 2683, 2691 — all `writeFileSync(resolve(parsed.flags.outX), ...)`.
- Line 679: `resolve(String(parsed.flags.out ?? 'kaykit-medieval-hexagon-...'))` then `copyGltfTree` (rmSync + mkdir + copy) into that path.

Every `--out*` is fed straight through `path.resolve()` and written. `resolve()` happily accepts `/etc/passwd`, `../../etc/cron.d/payload`, or a path under the user's home. `extract` (line 679) **rmSync's the output root with `force: true`** before re-creating it.

**Attack scenario.** A wrapping tool, IDE config, npm script, or shell history that invokes this CLI with attacker-controlled `--out` (e.g. a malicious project that ships an npm `postinstall`-style task list, or a generated CI matrix that templates the flag) can:
1. Overwrite arbitrary files the invoking user can write (JSON payloads only — limited blast radius).
2. **Recursively delete and recreate** an attacker-chosen directory via `extract --out /important/path`.

**Why it's "High" not "Critical":** the CLI is a developer/CI tool, not a network-exposed service. The trust boundary is "whoever invokes argv." But for a published `bin`, that boundary is broader than one might think (scripts, AI agents, etc.).

**Remediation.**

1. Add an `--outRoot` (or default to `cwd()`) and enforce all output paths sit beneath it:

   ```ts
   function safeResolveOutput(value: string, outRoot = process.cwd()): string {
     const resolved = resolve(outRoot, value);
     const rootResolved = resolve(outRoot);
     const rel = relative(rootResolved, resolved);
     if (rel.startsWith('..') || isAbsolute(rel)) {
       throw new Error(`Refusing to write outside ${rootResolved}: ${value}`);
     }
     return resolved;
   }
   ```
2. For the `extract` `rmSync` (line ~684), require the destination directory either not exist or be empty, OR require explicit `--force` flag. Never `rm -rf` a path the user passed if that path predates the run and contains anything.
3. Document the trust model in CLI help: "all output paths are resolved relative to `--outRoot` (default: cwd)."

### H2. `listFiles` recursive walker follows symlinks blindly (CLI manifest generation + extract)

**CWE-59 (Link Following) / CWE-61.** CVSS-ish: 5.0.

**Location.** `packages/medieval-hexagon-gameboard/src/ingest.ts:310-324`:

```ts
function listFiles(root: string, extension?: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  ...
  if (entry.isDirectory()) {
    files.push(...listFiles(childPath, extension));   // follows directory symlinks
```

`readdirSync(...).isDirectory()` returns true for symlinks to directories (Dirent semantics: `isDirectory()` only excludes symlinks if `lstat` semantics are used). No `isSymbolicLink()` check, no realpath check, no cycle detection.

Called from `validateSourceRoot`, `copyGltfTree`, and `generateManifestFromSource`. The `references/KayKit_Medieval_Hexagon_Pack_1.0_FREE/` source tree is local-developer input, but `--source` (CLI flag) accepts any path. If a malicious source tree contains a symlink like `Assets/gltf/inner -> /etc`, the walker recurses into it.

**Impact when used by `extract` (the `copyGltfTree` path):** combined with H1, an attacker-controlled `--source` containing a symlink loop or pointing at `/home/$USER/.ssh` results in either an infinite walk (DoS) or copying out-of-tree files into the `--out` directory. (Read primitive via reflection into output JSON; no exfil channel without combining.)

**Remediation.**

```ts
function listFiles(root: string, extension?: string): string[] {
  const realRoot = realpathSync(root);
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;          // OR: realpath + ensure inside realRoot
    const childPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(childPath, extension));
      continue;
    }
    if (!extension || childPath.endsWith(extension)) files.push(childPath);
  }
  return files;
}
```

Optionally use `lstatSync(childPath).isSymbolicLink()` for the same effect with classic-stat semantics, and assert `realpathSync(childPath).startsWith(realRoot + sep)` before descending.

---

## Medium

### M1. `--pieceSourceRoots` parses unverified JSON from CLI value or file (no prototype-pollution guard)

**CWE-1321.** `packages/medieval-hexagon-gameboard/src/cli.ts:3777-3792`:

```ts
const source = existsSync(resolve(value)) ? readJson<unknown>(resolve(value)) : JSON.parse(value);
const payload = isRecord(source) && isRecord(source.sourceRoots) ? source.sourceRoots : source;
...
for (const [key, root] of Object.entries(payload)) {
  ...
  roots[key] = root;
}
```

`Object.entries` skips `__proto__` (it's non-enumerable on prototypes set via JSON.parse), so the **direct** attack `{"__proto__":{"polluted":1}}` is harmless here — JSON.parse on `__proto__` keys produces an own property on the result, not prototype merge. **However**, `{"constructor": {"prototype": {"polluted": 1}}}` becomes part of `roots` and is then handed to downstream consumers. None of the current consumers I checked invoke `Object.assign` on the result, but the contract is fragile.

Also, the validation only ensures each value is a string — it does NOT ensure the keys are safe (e.g. `'../etc/passwd'` as a key, while just a lookup key, could later be used as a source root path if any consumer joins it).

**Remediation.**

```ts
const SAFE_KEY = /^[a-zA-Z0-9_:-]+$/;
for (const [key, root] of Object.entries(payload)) {
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    throw new Error(`Reserved key not allowed: ${key}`);
  }
  if (!SAFE_KEY.test(key)) throw new Error(`Invalid source-root key: ${key}`);
  ...
}
return Object.assign(Object.create(null), roots);  // null-prototype output
```

Same pattern applies generically to other JSON-payload flags. Also consider `JSON.parse(value, (k, v) => k === '__proto__' ? undefined : v)`.

### M2. `extract-kaykit-guide.ts` runs `sh -c "command -v ${command}"` with non-untrusted but unquoted variable

**CWE-78 (Command Injection) — defense-in-depth only.** `scripts/extract-kaykit-guide.ts:129`:

```ts
const result = spawnSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' });
```

`command` is a hardcoded literal from the call sites (`'swift'`, `'pdftoppm'`, `'magick'`) so there is **no** current injection. But the pattern is fragile: if a future change passes a user-controlled value, you get full shell injection. The fix is trivial:

```ts
const result = spawnSync('sh', ['-c', 'command -v "$1"', '--', command], { stdio: 'ignore' });
// or use execFileSync('which', [command], ...) on POSIX.
```

### M3. `pnpm audit` reports 2 moderate transitive vulnerabilities (dev-only)

Both are dev-tree only (not in `packages/medieval-hexagon-gameboard/dependencies`):

1. **`yaml` < 2.8.3** — GHSA-48c2-rrv3-qjmp / CVE-2026-33532. Stack overflow via deeply nested YAML. Severity moderate. Path likely via vitepress/biome devDeps. Upgrade to `>=2.8.3`.
2. **`brace-expansion` >=5.0.0 <5.0.6** — GHSA-jxxr-4gwj-5jf2 / CVE-2026-45149. DoS via numeric range. Path `.>@nx/js>@nx/devkit>minimatch>brace-expansion`. Upgrade to `>=5.0.6` (or add pnpm overrides).

**Remediation** — add `pnpm.overrides` to the workspace root `package.json`:

```json
"pnpm": {
  "overrides": {
    "yaml": ">=2.8.3",
    "brace-expansion": ">=5.0.6"
  }
}
```

These don't reach the published tarball but they can DoS local CI runs and reviewers' tooling.

### M4. CLI error messages echo user paths verbatim

`cli.ts` has ~70 `throw new Error('...${parsed.flags.X}...')` sites. Several interpolate the raw user path:

- Line 1460: `` `Recipe ${parsed.flags.recipe} did not compile to a GameboardPlan` ``
- Line 1475: `` `Scenario ${scenarioPath} did not compile to a GameboardPlan` ``
- Line 1692: `` `Patrol assignment file ${parsed.flags.assignments} must be an array or ...` ``
- Line 4120: `` `Unsupported edition: ${String(value)}` ``

When the CLI is invoked in a tool that logs stderr publicly (CI runner with a PR-author-controlled branch, a bug-tracker bot, etc.), absolute filesystem paths and usernames can leak into logs. **Low severity** — but worth normalizing to relative paths in messages.

```ts
throw new Error(`Recipe ${relative(cwd, resolve(parsed.flags.recipe))} did not compile to a GameboardPlan`);
```

### M5. `process.exit` after `console.error` may swallow stack traces in dev workflows

`cli.ts:4081, 4295` print only `error.message`. Information-disclosure-positive (good) but **debuggability** suffers. Recommend gating on `DEBUG` env to print full stack in dev:

```ts
const debug = process.env.MEDIEVAL_HEXAGON_DEBUG === '1';
console.error(debug && error instanceof Error ? (error.stack ?? error.message) : String(error));
```

### M6. `dist/**` source maps are published

`tsup.config.ts` sets `sourcemap: true` and `sourcesContent: false`. Good — content isn't embedded. But the maps still include the **absolute build-machine paths** in `sources[]` arrays (e.g. `/home/runner/work/...`). Since the build happens in GitHub-hosted runners (`ubuntu-latest`), this only leaks `/home/runner/work/medieval-hexagon-gameboard/...` which is documented public. **Not a finding for the GitHub Actions release flow** — but **if anyone runs `npm publish` locally**, their home directory leaks.

**Remediation.** Either set `sourcemap: false` for publish, or always publish from CI (which the workflow does — good — but consider adding a guard).

### M7. CLI uses `existsSync` then reads/writes — TOCTOU window

Multiple paths follow the pattern `if (!existsSync(p)) throw; readFileSync(p)`. The window between check and use is small but real on multi-process systems. **Low practical impact** for a local CLI, but the pattern is brittle:

```ts
// Prefer:
try { return readFileSync(p, 'utf8'); }
catch (err) { if (err.code === 'ENOENT') throw new Error(`Missing: ${relativize(p)}`); throw err; }
```

---

## Low

### L1. JSON deep-copy via stringify/parse in `simulation.ts:5212`

```ts
return JSON.parse(JSON.stringify(value)) as T;
```

If `value` contains `__proto__` keys (it shouldn't, by upstream typing — but defense in depth), they survive the round-trip as own properties. Replace with `structuredClone(value)` for both safety and ~3x perf. Node ≥17.

### L2. Unbounded regex in `ingest.ts:433-434`

```ts
family = family.replace(new RegExp(`_${faction}_(accent|full)$`), '');
family = family.replace(new RegExp(`_${faction}$`), '');
```

`faction` comes from the constant `FACTIONS` array (controlled, not user input), so **no ReDoS today**. But if `faction` ever becomes user-supplied, regex-special characters in the value would break the pattern. Use `escapeRegExp` like `scripts/audit-workspace.ts:1274` already does.

### L3. `audit-workspace.ts:1138` regex `/entry:\s*{([\s\S]*?)\n\s*},\n\s*format:/m` has nested unbounded matches

`[\s\S]*?` is lazy and bounded by literal `\n  },\n  format:`, so realistic input cannot trigger catastrophic backtracking. Keep an eye on it if file shape changes; ReDoS-safety relies on the lazy quantifier + literal anchor.

### L4. `Object.assign(merged, generation.layoutArchetypes ?? {})` — `src/recipe.ts:915`

`merged` is a fresh object (no prototype leak target) and `layoutArchetypes` is internally typed. No exposure. Noted only because grep flagged it.

### L5. `audit-workflows.ts` permissions check should fail closed

The workflow audit script lives outside the published surface, but as a CI gate it should explicitly assert each workflow has a top-level `permissions:` block with `contents: read` minimum, and that any job that escalates has a justification comment. Currently the workflows do this correctly — the gate doesn't enforce it.

### L6. `medieval-hexagon-gameboard` bin filename does not include scope

The `bin` entry is `medieval-hexagon-gameboard`, which collides with any other package using the same unscoped name in `$PATH`. Low impact but consider scoping: `@jbcom/medieval-hexagon-gameboard` or `mhg`.

---

## Recommended Biome / ESLint security rules

`biome.json` enables `recommended` + `noExplicitAny: error` (good). Add these security-relevant rules to harden further:

```json
{
  "linter": {
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error",
        "noGlobalEval": "error",
        "noDangerouslySetInnerHtml": "error",
        "noPrototypeBuiltins": "error",
        "noShadowRestrictedNames": "error",
        "noUnsafeNegation": "error",
        "noControlCharactersInRegex": "error",
        "noMisleadingCharacterClass": "error"
      },
      "complexity": {
        "noForEach": "off"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUndeclaredVariables": "error",
        "noUnsafeFinally": "error",
        "noConstructorReturn": "error",
        "noInnerDeclarations": "error",
        "useExhaustiveDependencies": "warn"
      },
      "style": {
        "useConst": "error",
        "useAsConstAssertion": "error",
        "noNonNullAssertion": "error",
        "noParameterAssign": "error",
        "useTemplate": "warn"
      },
      "nursery": {
        "noEvolvingTypes": "error",
        "noProcessEnv": "off"
      }
    }
  }
}
```

Also consider running [`semgrep --config=p/owasp-top-ten`](https://semgrep.dev/p/owasp-top-ten) and [`semgrep --config=p/nodejs`](https://semgrep.dev/p/nodejs) in CI for cross-cutting checks Biome doesn't cover (e.g. path-traversal patterns, shell-true detection across files).

Add a targeted rule (custom Biome plugin or semgrep) for **path-traversal** on CLI flag values: any `writeFileSync(resolve(parsed.flags.X), ...)` should require a sibling `safeResolveOutput()` call.

---

## Supply chain notes

**Positives.**
- All third-party GitHub Actions pinned to commit SHAs (`actions/checkout@de0fac2e...`, `pnpm/action-setup@41ff7265...`, `actions/setup-node@53b83947...`, `release-please@16a9c908...`).
- `actions/dependency-review-action` runs on every PR with `fail-on-severity: high`.
- `pnpm install --frozen-lockfile` everywhere.
- `npm publish --access public --provenance` uses OIDC sigstore provenance.
- `persist-credentials: false` on checkouts.
- `permissions: contents: read` defaulted; escalated per job with documented scope.
- `pull_request` (NOT `pull_request_target`) is used. Forked-PR auto-merge is gated by `head.repo.full_name == github.repository`.
- `--ignore-scripts --no-audit --fund=false` on the smoke-consumer install — good hardening against `postinstall` malware in the packed tarball's transitive deps during smoke tests.
- `bin` shebang is `#!/usr/bin/env node` (portable, not `/bin/bash`).
- `files` allowlist is strict and asserted by `audit-package.ts` against `npm pack --dry-run --json`.

**Risks / improvements.**
- **`secrets.CI_GITHUB_TOKEN`** is used by `release-please` (cd.yml:42). This is a user-managed PAT, not `GITHUB_TOKEN`. PATs are higher-risk because they have broader scope and don't auto-rotate. Consider migrating to a GitHub App token (`tibdex/github-app-token` or the official GitHub App auth) for finer-grained scoping and per-org revocation.
- **No `package-lock.json` / no npm `--audit` in CI for the consumer smoke test.** The packed tarball is installed with `--no-audit`, which is correct for speed but means a vulnerable transitive dep in the published tarball wouldn't be caught at smoke time. Add a `pnpm audit --prod --audit-level=high` step in the `package` job after `pnpm install` to catch prod-tree CVEs before publish.
- **No SLSA-level-3 attestation.** OIDC provenance is good; if you want to go further, generate a SLSA provenance attachment (`actions/attest-build-provenance@v2`) for the tarball.
- **No SBOM.** Consider `@cyclonedx/cyclonedx-npm` to emit a CycloneDX SBOM as a release asset.
- **Dependabot covers npm + github-actions, both weekly.** Consider grouping security updates into a separate `security` group with daily cadence: `open-pull-requests-limit: 10` + `applies-to: security-updates`.
- **Three transitive moderates** (yaml, brace-expansion) — see M3 — should be cleared via pnpm overrides.

---

## Top 5 security priorities

1. **H1 — Path traversal in CLI `--out*` flags.** Add `safeResolveOutput()` helper, require all writes to stay under `--outRoot` (default cwd), require explicit `--force` for `extract`'s `rmSync` destination.
2. **H2 — Symlink-following walker.** Skip `entry.isSymbolicLink()` in `listFiles` (`ingest.ts:310`) or verify with `realpathSync` that descended paths stay inside the source root.
3. **M3 — Clear the 2 moderate `pnpm audit` findings** via `pnpm.overrides` (`yaml >=2.8.3`, `brace-expansion >=5.0.6`).
4. **M1 — Prototype-pollution defense in JSON payload flags.** Block `__proto__` / `constructor` / `prototype` keys in `readPieceSourceRoots` and any future JSON-payload CLI flag; return `Object.create(null)`-backed maps.
5. **Tighten Biome rules + add semgrep CI gate** with `p/owasp-top-ten` + `p/nodejs` rulesets. Wire a custom rule for "writeFileSync(resolve(parsed.flags.X), ...) without safeResolveOutput" as a long-term path-traversal guard.

---

## Out-of-scope items verified clean

- No `eval`, `Function()`, `new Function`, dynamic `require` anywhere.
- No `child_process.exec` (shell-true). All spawns use `execFileSync` / `spawnSync` with array args. One `sh -c` site (M2) is constant-only.
- No `JSON.parse` with reviver that could be hijacked.
- No `setTimeout(string, ...)`-style string-eval primitives.
- No `pull_request_target` workflows.
- No `secrets.*` echoed into `run:` shells (only `GH_TOKEN` env, which is correct).
- No `fs.write*` with un-resolved path concatenation in `src/` (only via the `resolve(parsed.flags.X)` pattern noted in H1).
- No `child_process` in the **published** `src/**` — only in `scripts/**` (build/test tooling).
- `Math.random()` zero hits; all RNG via `seedrandom` (Phase 1 confirmed).
