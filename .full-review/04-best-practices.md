# Phase 4: Best Practices & Standards

## Framework & Language Findings

### Critical

**BP-1 — `react`/`react-dom`/`three`/`koota` are hard `dependencies`, not `peerDependencies`** (`package.json`)
A library that provides React/Three/koota bindings must declare these as peers. The `tsup.config.ts` `external` array correctly prevents bundling them, but `dependencies` still installs a second copy under `node_modules/declarative-hex-worlds/node_modules/` in consumer projects, causing:
- koota: trait identities are module-singletons; two koota instances → traits from consumer world don't match library traits → silent query misses
- React: "Invalid hook call / multiple copies of React" crash
- Three: `instanceof` checks across two `three` copies fail

Fix: move `react`, `react-dom`, `three`, `koota` to `peerDependencies` with `peerDependenciesMeta` marking React/Three as optional. Keep them in `devDependencies` for the build (pnpm doesn't auto-install peers). `honeycomb-grid`, `seedrandom`, `citty`, `yauzl` correctly stay as `dependencies`.

### High

**BP-2 — `react-dom` declared but never imported; `@types/react` mis-scoped as `dependencies`** (`package.json`)
`react-dom` appears only in a doc comment — no `import 'react-dom'` anywhere in `src/`. `@types/react` in `dependencies` forces it into consumer install graph and can collide with their React 18/19 types. Fix: remove `react-dom` from dependencies (move to peers only if used); move `@types/react` to `devDependencies`.

**BP-3 — `readJson<T>` bare cast at ~20 typed call sites** (`src/cli/_shared.ts:397`)
Confirmed: `readJson` lies about its return type. Unsafe sites include `_shared.ts:866,1222,1227` and all `validate-*.ts` commands, which validate *after* asserting the type. Fix: make `readJson` return `unknown`; force callers to pipe through existing `inspect*` validators.

**BP-4 — `bootstrap/core.ts:588` uses `new URL(import.meta.url).pathname` — Windows-broken**
`.pathname` on a `file://` URL yields `/C:/...` on Windows (leading slash, no percent-decode). Every `scripts/*.ts` already uses `import.meta.dirname` (Node 22 native, repo-wide standard). Fix: `let dir = import.meta.dirname;`.

### Medium

**BP-5 — `as unknown as` double-casts in `manifest/schema.ts:231` and `_shared.ts:2716,2843`**
`as unknown as X` launders untyped input past all structural checks. The `_shared.ts` two sites return the cast value directly to callers. Fix: narrow with discriminated-union guard or `satisfies`-validated builder; tie into `_shared.ts` decomposition.

**BP-6 — `tsconfig.json:7` `ignoreDeprecations: "6.0"` against TypeScript `^6.0.3`**
Suppresses current TS-6 deprecation signal (the repo's doctrine: every warning is real signal). Likely added during 5.x→6.x bump. Fix: remove `ignoreDeprecations`, run `tsc --noEmit`, fix surfaced warnings.

**BP-7 — tsup: `honeycomb-grid`/`seedrandom`/`citty`/`yauzl` both bundled AND in `dependencies`**
They're not in `external`, so they're bundled; but also in `dependencies`, so consumers install them twice. Fix: add them to `external` + keep in `dependencies` (runtime resolved), OR bundle (`noExternal`) + move to `devDependencies` (fully bundled, zero consumer leakage). Add `treeshake: true` explicitly. Add a size-budget vitest test (esbuild `metafile`).

### Low

**BP-8 — Biome `noRestrictedImports` has `.js` suffix variant for only 1 of 36 paths**
`../actors/actors.js` has the suffix; the other 35 don't. Under `moduleResolution: bundler`, `../koota/koota.js` would slip past the rule. Fix: add `.js` variants for all 35, or codify no-`.js` style via lint.

**BP-9 — Relative imports omit `.js` extensions (intentional, but bundler-coupled)**
Valid under `moduleResolution: bundler` + tsup. Not valid for native Node ESM. No action required given current pipeline; note for awareness if ever targeting `tsc`-only emit.

---

## CI/CD & DevOps Findings

### Critical

**CI-1 — `main` has NO branch protection: nothing gates a merge** (`gh api → 404 "Branch not protected"`)
Every gate (lint/typecheck/build/test matrix, semgrep, dependency-review, docs-site) is advisory — a red PR can be merged. A direct push to `main` bypasses CI entirely and triggers `cd.yml` (release-please + Pages deploy). `automerge.yml` with C-1 unfixed merges dependabot/release-please PRs before CI even reports, since `--auto` only waits for *required* checks (zero required = no wait).

Fix: enable branch protection on `main` with required status checks: `lint`, `typecheck`, `build`, `test` (four matrix legs), `Semgrep SAST`, `Dependency Review`, `Docs Site Build`. Require linear history (matches squash policy). Manage as code (`gh api` script or `repository-settings` action) to prevent silent drift.

**CI-2 — `release-as: "1.0.0"` pin in `release-please-config.json` freezes every future release at 1.0.0**
After the initial 1.0.0 is cut, this override means release-please will try to re-cut `1.0.0` on every subsequent release PR — colliding with the existing tag and killing the conventional-commit version machinery.

Fix: remove the `release-as` key. Leave `.release-please-manifest.json` at `"1.0.0"` as baseline; release-please derives the next version from commits. One-line config change.

*Note: Prior-phase M-2 (release.yml mutable `@v4` tags) is **closed** — `release.yml` on disk is fully SHA-pinned and exemplary. That finding is stale.*

### High

**CI-3 — `ci.yml` check matrix job uses older pnpm/setup-node SHAs than install/docs jobs**
`install` and `docs-site` jobs pin `pnpm/action-setup@0e279bb…#v6.0.8` and `setup-node@48b55a0…#v6.4.0`, but the `check` matrix job (the actual test runner) pins older `pnpm/action-setup@41ff726…#v4.2.0` and `setup-node@53b8394…#v6.3.0`. pnpm major-version skew between the installer and the runner risks store-layout mismatches. Fix: hoist action versions to a single SHA across all `ci.yml` jobs. Alternatively: drop the install-once artifact dance and use per-job `pnpm install` with pnpm cache (also dissolves the skew and may be faster — L-4).

**CI-4 — `bootstrap-nightly.yml` uses mutable `@v4` tags AND `HEX_WORLDS_OUT_ROOT='/'`** (confirmed live)
This is the daily job that fetches the live untrusted upstream tarball. Running with both mutable-tag actions and a disabled output jail is the highest-risk combination in the repo. A malicious/corrupted upstream tarball with `../` entries could write anywhere the runner can reach.

Fix: (1) SHA-pin all four actions matching `ci.yml` style; (2) Set `HEX_WORLDS_OUT_ROOT: /tmp` — the bootstrap already writes to `/tmp/bootstrap-target`, so jail never needs to be `/`; (3) Add `on: pull_request: paths: ['src/cli/commands/bootstrap/**']` so changes to bootstrap code trigger this smoke before they ship.

**CI-5 — Coverage enforcement runs nowhere in PR CI; ratchet floor can silently erode**
`test:coverage:enforce` is local-only in `ci.yml`. `release.yml` does run it — but that surfaces a coverage regression weeks after the PR that caused it, far from the regressing commit. With CI-1 (no required checks) also unresolved, there's genuinely nothing stopping a coverage drop from reaching `main`.

Fix: add a dedicated `coverage` CI job running `pnpm test:coverage:enforce` and make it a required check. Unit harness only (matches the floor's basis); run in parallel with the matrix.

### Medium

**CI-6 — `automerge.yml` auto-approves + auto-merges before CI-1 is fixed**
With CI-1 unresolved, `gh pr merge --auto --squash` has nothing to wait for and merges immediately on dependabot/release-please PRs. Fix CI-1 first; reassess whether release-please PRs should retain a human checkpoint.

**CI-7 — Release publish has no post-publish verification or rollback runbook**
`release.yml` ends at `npm publish`. No step verifies the provenance chain actually attached (`npm audit signatures`). No documented forward-fix runbook for a bad live version (npm forbids re-publishing deleted versions; the path is `npm deprecate` + forward `x.y.z+1`).

Fix: (1) Add post-publish `npm audit signatures declarative-hex-worlds@<version>` step; (2) Write `ROLLBACK.md` runbook; (3) Consider `npm publish --tag next` + promote with `npm dist-tag` to prevent a bad build from auto-becoming `latest`.

**CI-8 — `release.yml` `workflow_dispatch` can accidentally publish to npm**
The publish step lacks `if: github.event_name == 'release'` guard. A manual dispatch runs the entire pipeline including `npm publish --provenance`. Fix: add the guard on the publish step, or add a `confirm_publish` dispatch input defaulting to false.

**CI-9 — `CI_GITHUB_TOKEN` is a long-lived org-scoped PAT**
Scoped to the whole org (broad blast radius if leaked). The documented rejection of a GitHub App ("operational toil") trades a one-time setup for permanent exposure. Fix: migrate to `actions/create-github-app-token` repo-scoped; or at minimum rotate schedule and limit to single-repo scope.

### Low

**CI-10** — `npm install -g npm@latest` floats publisher toolchain version. Pin to a specific major.

**CI-11** — `npx --yes @cyclonedx/cyclonedx-npm@latest` unpinned + network-fetched at release time. Add as pinned devDependency, call via `pnpm exec`.

**CI-12** — Semgrep job `pip install` uncached on every PR run (~10-20s). Cache `~/.local` keyed on pinned version.

**CI-13** — Install-once artifact-share (`node_modules.tar.zst`) may be slower than per-job pnpm cache + is the root of CI-3 SHA skew. Benchmark and consider dropping.
