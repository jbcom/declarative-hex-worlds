# CI/CD & Operational Review — `declarative-hex-worlds`

Reviewer: DevOps / GitHub Actions + TS-publishing specialist.
Date: 2026-05-28.
Scope: `.github/workflows/*`, `.github/dependabot.yml`, `package.json`,
`tsup.config.ts`, `vitest.coverage.shared.ts`, `release-please-config.json`,
`.release-please-manifest.json`, live branch-protection state.

## Files reviewed (current on disk)

| File | Role |
|------|------|
| `.github/workflows/ci.yml` | per-PR gates: install→check matrix, docs-site, dependency-review, semgrep |
| `.github/workflows/cd.yml` | main-push: release-please PR + GitHub Pages deploy |
| `.github/workflows/release.yml` | on `release: published`: audit→verify→build→pack→attest(SLSA L3)→SBOM→publish (OIDC) |
| `.github/workflows/automerge.yml` | dependabot + release-please auto-approve/merge |
| `.github/workflows/bootstrap-nightly.yml` | scheduled live-upstream KayKit bootstrap smoke |
| `.github/dependabot.yml` | github-actions + npm (root + docs-site) weekly + daily-security |
| `release-please-config.json` / `.release-please-manifest.json` | node release-type, `release-as: 1.0.0` pin |

## IMPORTANT — prior-phase findings are stale against current `release.yml`

The prior-phase brief carried **M-2** (release.yml mutable `@v4` tags) and a
note about a bad `attest-build-provenance` SHA. **Both are obsolete.** The
current `release.yml` on disk is a full rebuild:

- All actions SHA-pinned: `checkout@de0fac2…#v6.0.2`, `pnpm/action-setup@0e279bb…#v6.0.8`, `setup-node@48b55a0…#v6.4.0`, `attest-build-provenance@a2bbfa2…#v4.1.0`, `action-gh-release@72f2c25…#v2.4.1`.
- Package renamed to `declarative-hex-worlds`; the old `working-directory: packages/medieval-hexagon-gameboard` is gone (single-package repo root).
- Real OIDC trusted publishing (`id-token: write` + `attestations: write`, no `NODE_AUTH_TOKEN`), SLSA L3 attestation of the exact packed tarball, CycloneDX SBOM, both attached to the GH release.

`release.yml` is now the strongest workflow in the repo. New findings below are
against the **current** tree, not the stale snapshot. **M-2 and the SHA-pin
finding for `release.yml` should be closed.**

---

## CRITICAL

### C-1 — `main` has NO branch protection: nothing gates a merge

`gh api repos/jbcom/declarative-hex-worlds/branches/main/protection` →
`404 "Branch not protected"`.

Every gate in this review — the `check` matrix (lint/typecheck/build/test),
semgrep, dependency-review, docs-site build — is **advisory**. A PR can be
merged red. A direct push to `main` bypasses CI entirely and immediately
triggers `cd.yml` (release-please) and the Pages deploy. The entire CI design
("fast correctness gates per-PR") rests on an enforcement layer that does not
exist.

This also undercuts `automerge.yml`: `gh pr merge --auto --squash` only waits
for required checks. With **zero** required checks, `--auto` merges a
dependabot/release-please PR the instant it is mergeable — potentially before
CI even reports — so dependency bumps and release PRs can land without ever
being gated by the test matrix.

- **Severity:** Critical
- **Operational risk:** Broken/insecure code reaches `main`, then npm via the
  release flow. Auto-merge converts "advisory CI" into "no CI." The repo's own
  CLAUDE.md mandates "never force-merge past red CI" — unenforceable today.
- **Recommendation:** Enable branch protection on `main` with required status
  checks: `lint`, `typecheck`, `build`, `test` (the four matrix legs — they
  report as `lint`/`typecheck`/`build`/`test` via `name: ${{ matrix.task }}`),
  `Semgrep SAST`, `Dependency Review`, and `Docs Site Build`. Require
  branches up to date, require linear history (matches squash-merge policy),
  and dismiss stale approvals. Manage it as code (`gh api ... -X PUT` script or
  a `repository-settings` action) so it can't silently drift back to 404.

### C-2 — `release-as: "1.0.0"` pin freezes every future release at 1.0.0

`release-please-config.json` → `packages["."].release-as: "1.0.0"`.

`release-as` is a **forced override**: release-please will cut `1.0.0` on every
release PR regardless of accumulated `feat:`/`fix:` commits. It was correct as a
one-shot to land the initial 1.0.0 (per the directive note), but leaving it in
means `1.0.1`/`1.1.0` will never be computed — the next release PR will try to
re-cut `1.0.0`, colliding with the existing tag/publish, and the conventional-
commit version machinery is dead.

- **Severity:** Critical (for the next release; latent now)
- **Operational risk:** First post-1.0.0 release silently fails or no-ops; npm
  never receives bug fixes. Directly contradicts CLAUDE.md "versioning is
  release-please's job."
- **Recommendation:** Remove the `release-as` key. Leave `.release-please-manifest.json`
  at `1.0.0` as the baseline; release-please then derives the next version from
  commits. (One-line config change; highest-leverage fix in the repo after C-1.)

---

## HIGH

### H-1 — `check` matrix job uses older action SHAs than the rest of the same workflow

Within `ci.yml`: the `install`, `docs-site` jobs pin
`pnpm/action-setup@0e279bb…#v6.0.8` and `setup-node@48b55a0…#v6.4.0`, but the
`check` matrix job (the one that actually runs lint/typecheck/build/test) pins
the **older** `pnpm/action-setup@41ff726…#v4.2.0` and `setup-node@53b8394…#v6.3.0`.

This is the live analogue of the (now-closed) M-2: not mutable tags, but a
**version split inside one workflow.** `check` produces the artifact consumers
trust (`node_modules.tar.zst` is built by `install` at v6.0.8, then unpacked and
run by `check` at v4.2.0 pnpm). pnpm major-version skew between the installer and
the runner can produce store-layout mismatches.

- **Severity:** High
- **Operational risk:** The gating job runs on a different pnpm major than the
  job that produced its `node_modules`; subtle resolution/hoisting drift, and a
  dependabot `github-actions` bump will update some jobs but not the laggards,
  widening the split.
- **Recommendation:** Hoist the action versions to workflow-level consistency —
  pin `pnpm/action-setup` and `setup-node` to a single SHA across all jobs in
  `ci.yml`. Better: lift `NODE_VERSION` and the action SHAs into a reusable
  composite action / `actions` anchor so dependabot bumps them atomically.

### H-2 — `bootstrap-nightly.yml` uses mutable `@v4` tags AND `HEX_WORLDS_OUT_ROOT='/'`

Confirmed live (prior-phase M-2/M-4 — these are accurate, unlike the release.yml
items):

- `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`,
  `actions/upload-artifact@v4` — all mutable tags, inconsistent with the
  SHA-pinned `ci.yml`/`cd.yml`/`release.yml`. Supply-chain regression surface:
  a compromised tag re-point executes in a workflow that has `contents: read`
  but runs an arbitrary network fetch + zip extraction.
- `HEX_WORLDS_OUT_ROOT: '/'` on two steps widens the bootstrap output jail to
  filesystem root. The CLI's path-confinement guard (the thing that stops a
  malicious zip entry from writing outside the target) is effectively disabled
  for the one job that hits the **live, untrusted upstream tarball**. This is
  precisely the job where the guard matters most.

- **Severity:** High
- **Operational risk:** Daily job that pulls untrusted bytes from GitHub runs
  with both mutable actions and a disabled output jail. A malicious/ corrupted
  upstream tarball with `../` entries could write anywhere the runner can reach.
- **Recommendation:** (1) SHA-pin all four actions to match the other workflows.
  (2) Set `HEX_WORLDS_OUT_ROOT: /tmp/bootstrap-target` (or `/tmp`) so the jail
  stays meaningful — the bootstrap already writes under `/tmp/bootstrap-target`,
  so the root never needs to be `/`. (3) Add `on: pull_request: paths: ['src/cli/commands/bootstrap/**']`
  so changes to the bootstrap code re-run this smoke before they ship (ties to S-2).

### H-3 — Coverage enforcement runs nowhere in CI; the floor can only regress unobserved

`vitest.coverage.shared.ts`: thresholds apply only when
`HEX_WORLDS_COVERAGE_ENFORCE=1`. The `check` matrix runs plain `pnpm test`
(no coverage env). `test:coverage:enforce` is, by the `ci.yml` header comment,
**deliberately local-only**. So:

- No PR run ever measures coverage. The ratchet floor
  (S=73.4/B=69.4/F=80.7/L=73.1) is checked only by a human running it locally
  before "major changes."
- `release.yml` **does** run `pnpm test:coverage:enforce` in its Verify step —
  good — but that is the *last* gate before publish. A coverage regression that
  landed weeks earlier surfaces only when someone cuts a release, far from the
  PR that caused it. (Prior-phase S-1.)

This is a defensible *cost* tradeoff (coverage instrumentation is slow), but the
current shape means the floor is enforced once per release, not once per change.

- **Severity:** High
- **Operational risk:** Silent coverage erosion across many PRs; the release
  blocks unexpectedly and the regressing change is hard to attribute. Combined
  with C-1 (no required checks), there is genuinely nothing stopping a coverage
  drop from reaching `main`.
- **Recommendation:** Add a dedicated CI job `coverage` that runs
  `pnpm test:coverage:enforce` (unit harness only — matches the floor's basis)
  and make it a required check. If runtime is the concern, run it on a separate
  job in parallel with the matrix rather than dropping it. Keep the
  browser/e2e merged-coverage runs local; gate only the unit floor in CI.

---

## MEDIUM

### M-1 — `automerge.yml` approves + auto-merges before any gate exists (compounds C-1)

Both jobs (`dependabot`, `release-please`) auto-approve then
`gh pr merge --auto --squash`. With C-1 unfixed, `--auto` has nothing to wait
for and merges immediately. Even after C-1 is fixed, auto-approving every
release-please PR removes the human "is this changelog right / is this the
version I expect" checkpoint — acceptable for a solo-maintainer repo, but worth
a conscious decision.

- **Severity:** Medium
- **Operational risk:** Dependency bumps land without test gating (today);
  release PRs publish to npm with no human glance at the version/changelog.
- **Recommendation:** Fix C-1 first (makes `--auto` actually wait). Consider
  keeping release-please auto-merge but requiring the same status checks; or
  drop the release-please auto-approve so a human merges the version bump.

### M-2 — Release publish has no post-publish verification or rollback affordance

`release.yml` ends at `npm publish`. There is no step that runs
`npm audit signatures` / `gh attestation verify` against the just-published
version to confirm the provenance chain the workflow worked so hard to build.
There is no documented rollback: npm forbids re-publishing a deleted version, so
a bad `1.0.1` requires an immediate `1.0.2`. `concurrency: cancel-in-progress: false`
correctly prevents a second release from interrupting a publish, but a publish
that dies *after* `npm publish` but *before* the SBOM/tarball release-asset
attach (the attach step is ordered **before** publish, so this specific order is
fine) leaves no partial-state cleanup guidance.

- **Severity:** Medium
- **Operational risk:** A publish that succeeds but produces a broken provenance
  attestation is not detected automatically; no runbook for the "bad version is
  live on npm" case.
- **Recommendation:** (1) Add a final job step (or a follow-up `workflow_dispatch`
  job) that runs `npm audit signatures declarative-hex-worlds@<version>` and
  fails loudly if provenance is missing. (2) Document a `ROLLBACK.md` runbook:
  forward-fix via `x.y.z+1`, `npm deprecate` the bad version with a pointer.
  (3) Consider `npm publish --tag next` then promote with `npm dist-tag` so a
  bad build never auto-becomes `latest`.

### M-3 — `release.yml` triggers on `workflow_dispatch` with the full publish path live

`on: [release: published, workflow_dispatch]`. A manual `workflow_dispatch` run
executes the entire pipeline **including `npm publish --provenance`** (the publish
step is not guarded by `if: github.event_name == 'release'` — only the
SBOM/tarball *attach* step is). A maintainer firing the dispatch to "test the
build" would publish whatever version is in `package.json` to npm.

- **Severity:** Medium
- **Operational risk:** Accidental publish from a manual dispatch; publishes the
  current `package.json` version, which after a release may already exist → hard
  npm error, or worse, a duplicate of an in-flight version.
- **Recommendation:** Guard the publish step with `if: github.event_name == 'release'`
  (mirroring the attach step), or split a `build-only` dry-run path for dispatch.
  At minimum add a dispatch input `confirm_publish` defaulting false.

### M-4 — `cd.yml` release-please depends on a long-lived org PAT (`CI_GITHUB_TOKEN`)

The inline comment documents the choice (org PAT over a per-repo GitHub App,
"App is operational toil"). The PAT is long-lived, org-scoped (broad blast
radius across all `@jbcom` repos), and its rotation is manual. The rejected
GitHub App alternative is exactly the least-privilege answer: 1h tokens, repo-
scoped, and — critically — App-authored PRs *do* trigger downstream CI whereas
`GITHUB_TOKEN`-authored ones don't (which is the only reason a PAT is needed at
all once C-1 adds required checks).

- **Severity:** Medium
- **Operational risk:** A leaked `CI_GITHUB_TOKEN` compromises every `@jbcom`
  repo, not just this one. No automatic expiry.
- **Recommendation:** Migrate to `actions/create-github-app-token` with a
  repo-scoped App (contents+PRs only). The "toil" is a one-time setup; the
  payoff is least-privilege + automatic CI triggering. If staying on the PAT,
  document a rotation schedule and scope it to the single repo, not the org.

---

## LOW

### L-1 — `npm install -g npm@latest` floats the publisher toolchain

`release.yml` runs `npm install -g npm@latest` before publish ("for trusted
publishing"). Floating to `@latest` means the publish toolchain version is
non-reproducible across releases — a future npm CLI change to provenance
handling could silently alter behavior.

- **Severity:** Low
- **Recommendation:** Pin to a known-good major (`npm@^11` or a specific
  version) and bump deliberately. The Node 22 bundled npm may already suffice
  for OIDC; verify and drop the step if so.

### L-2 — `npx --yes @cyclonedx/cyclonedx-npm@latest` is unpinned, network-fetched at release time

SBOM generation pulls `@latest` over the network during the publish run. A
release can fail or produce a different SBOM format if the tool changes, and it
adds a registry dependency to the critical publish path.

- **Severity:** Low
- **Recommendation:** Add `@cyclonedx/cyclonedx-npm` as a pinned devDependency
  and call it via `pnpm exec`, so it is in the frozen lockfile and SHA-stable.

### L-3 — `semgrep==1.96.0` pinned but `pip install --user` is uncached

The semgrep job `pip install`s on every PR run with no pip cache; ~10-20s waste
per run. Minor, but the job is on the per-PR hot path.

- **Severity:** Low
- **Recommendation:** Cache `~/.local` keyed on the pinned semgrep version, or
  use the official `semgrep/semgrep` SHA-pinned action / container.

### L-4 — `retention-days: 1` on the shared `node_modules` artifact is fine; `actions/download-artifact` adds latency

Design note, not a defect: the install-once / share-artifact pattern (tar+zstd,
upload, download in each matrix leg) trades a fast `setup-node` pnpm-cache
restore for an artifact round-trip. For a 4-leg matrix the artifact (often
hundreds of MB) upload+download can exceed the install it replaces. Worth
measuring; a plain per-job `pnpm install` with `cache: pnpm` may be faster and
simpler, and removes the v6.0.8-vs-v4.2.0 install/runner skew behind H-1.

- **Severity:** Low
- **Recommendation:** Benchmark artifact-share vs. per-job pnpm-cache install on
  this runner size. If the cache restore is within ~15s of the artifact path,
  drop the artifact dance — it also dissolves H-1.

---

## Strengths (keep)

- `release.yml` is exemplary: SHA-pinned, `persist-credentials: false`, OIDC
  trusted publishing, SLSA L3 attestation of the exact packed tarball,
  CycloneDX SBOM, `--provenance`, audit gate before publish, `concurrency`
  with `cancel-in-progress: false`.
- All workflows declare top-level `permissions: contents: read` and elevate
  per-job only where needed (least-privilege done right at the workflow level —
  the gap is purely the missing branch protection that would *enforce* it).
- `persist-credentials: false` on every checkout.
- `dependabot.yml` is thorough: separate daily security channel, grouped
  major/minor, covers both root and `docs-site/`, `github-actions` ecosystem
  included.
- `prepublishOnly: pnpm verify` provides a local belt-and-suspenders gate
  independent of CI (and is asserted by a contract test).
- `bootstrap-nightly` correctly isolates the network-dependent live-upstream
  smoke off the per-PR path (synthetic-zip e2e covers PRs).

---

## Priority-ordered fix list

| # | Sev | Fix | Effort |
|---|-----|-----|--------|
| C-1 | Critical | Enable `main` branch protection + required checks | small (one `gh api` script) |
| C-2 | Critical | Remove `release-as: "1.0.0"` from release-please config | trivial |
| H-2 | High | SHA-pin bootstrap-nightly actions; `HEX_WORLDS_OUT_ROOT=/tmp/...` | small |
| H-1 | High | Unify pnpm/setup-node SHAs across all `ci.yml` jobs | small |
| H-3 | High | Add required `coverage` CI job running `test:coverage:enforce` | small |
| M-3 | Medium | Guard release publish with `if: github.event_name == 'release'` | trivial |
| M-2 | Medium | Post-publish `npm audit signatures` verify + ROLLBACK runbook | medium |
| M-4 | Medium | Migrate `CI_GITHUB_TOKEN` PAT → repo-scoped GitHub App token | medium |
| M-1 | Medium | Reassess auto-merge after C-1 (release PR human checkpoint) | trivial |
| L-1..L-4 | Low | Pin npm CLI + cyclonedx; cache semgrep; benchmark artifact-share | small |

## Answers to the brief's questions

1. **What gates a merge?** Today: **nothing** (C-1). The matrix + semgrep +
   dependency-review run but are non-required. **What gates a release?** A real,
   strong gate chain in `release.yml` (audit→lint→typecheck→coverage:enforce→
   build→pack→attest→SBOM→publish). The release gate is far stronger than the
   merge gate — inverted from the usual risk profile.
2. **Release flow correct?** Mechanically excellent (OIDC/SLSA/SBOM all real),
   but C-2 (release-as pin) breaks the *next* release and M-3 lets a manual
   dispatch publish accidentally.
3. **Dependency mgmt in CI:** SHA-pinning strong in main workflows, broken in
   bootstrap-nightly (H-2) and inconsistent inside ci.yml (H-1). Lockfile
   enforcement (`--frozen-lockfile`) correct everywhere. pnpm setup correct.
4. **Permissions:** Least-privilege *declared* correctly; *unenforced* due to
   C-1. PAT scope (M-4) is the one over-broad credential.
5. **Test gates / CI-vs-local gap:** Coverage enforcement (H-3), FREE browser
   visuals, and live-bootstrap (S-2) all run only locally/nightly, never on a
   PR. The merged suite covers far more than CI does.
6. **Operational risk / rollback:** No rollback runbook, no post-publish verify
   (M-2). Bootstrap-nightly failure only uploads a result artifact — no alert.
7. **Env separation:** `HEX_WORLDS_OUT_ROOT='/'` (H-2) is the one dangerous
   prod-path env. `NODE_VERSION` consistent. ASTRO_BASE/SITE correctly scoped.
8. **Performance:** Matrix parallelized + fail-fast:false (good for signal).
   Install-once artifact-share is clever but possibly slower than pnpm cache
   (L-4) and is the root of the H-1 skew.
