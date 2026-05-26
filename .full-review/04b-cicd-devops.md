# CI/CD & DevOps Review — medieval-hexagon-gameboard

_Reviewed: 2026-05-26_

---

## Strengths (carry forward)

- All third-party actions pinned to SHAs — supply-chain baseline solid.
- `pull_request` (not `pull_request_target`) — no privileged-context injection risk.
- `persist-credentials: false` on every checkout — token not exposed to subprocesses.
- `frozen-lockfile` everywhere — no silent dep drift.
- OIDC provenance publish (`npm publish --provenance`) — npm attestation present.
- `dependency-review-action` with `fail-on-severity: high` on PRs.
- Concurrency keys on all four workflows (`cancel-in-progress: true` on CI, `false` on release/CD — correct semantics).
- Browser screenshots uploaded as artifacts with 7-day retention.
- Nx `cache: true` on build/test/lint/typecheck targets with proper `inputs`/`outputs`.
- `pnpm/action-setup` + `actions/setup-node cache: 'pnpm'` — pnpm store cached via built-in node cache integration.
- Automerge uses `secrets.GITHUB_TOKEN` (not PAT) for Dependabot and release-please PRs — correct minimal privilege.

---

## Findings

### CI Structure (ci.yml)

#### [High] No `needs:` gates — matrix jobs and package job run fully independent

**Risk:** `package` job (npm pack smoke, CLI smoke, consumer smoke) runs without waiting for `check` matrix (lint/typecheck/build/test) to pass. A broken build can produce and "validate" a broken package artifact in the same run. Similarly `browser-free` runs Chromium tests without confirming the build step in `check` succeeded first.

**Fix:** Add explicit `needs:` between jobs that have logical dependencies.

```yaml
# ci.yml — package job
  package:
    name: npm Pack
    needs: [check]          # <-- add
    runs-on: ubuntu-latest

# ci.yml — browser-free job
  browser-free:
    name: FREE Browser Visuals
    needs: [check]          # <-- add (specifically needs build)
    runs-on: ubuntu-latest

# ci.yml — docs job
  docs:
    name: Docs Build
    needs: [check]          # <-- add
    runs-on: ubuntu-latest
```

#### [Medium] `check` matrix uses `fail-fast: false` — desirable but watch

`fail-fast: false` means lint failure doesn't cancel typecheck/build/test. Appropriate for developer feedback. No action needed, but confirm required status checks in branch protection cover ALL four matrix legs (`lint`, `typecheck`, `build`, `test`) individually, not just the matrix job name.

#### [Medium] No `pnpm audit --prod --audit-level=high` in package or check jobs

**Risk:** Dev-dep vulns appear in audit but prod vulns get no dedicated CI gate. The Phase 2 known moderate findings (yaml, brace-expansion) may escalate; no CI gate catches new high/critical prod vulns before publish.

**Fix:** Add to `package` job after install:

```yaml
      - name: Audit prod dependencies
        run: pnpm audit --prod --audit-level=high
```

Add overrides to `package.json` to clear the known moderates:

```json
"pnpm": {
  "overrides": {
    "yaml": ">=2.3.4",
    "brace-expansion": ">=1.1.12"
  }
}
```

#### [Low] Nx `nx affected` not used — full `run-many` on every PR

**Risk:** As workspace grows, all lint/typecheck/build/test run on every PR regardless of what changed. Not a correctness issue but cost/speed will degrade.

**Fix (when workspace >3 packages):** Switch matrix tasks to `nx affected`:

```yaml
      - name: Run ${{ matrix.task }}
        run: pnpm exec nx affected -t ${{ matrix.task }} --base=origin/main
```

Requires `fetch-depth: 0` (already present on `check` job).

---

### Release Flow (release.yml)

#### [High] Release job re-runs full `pnpm test:ci` — not pinned to release commit artifact

**Risk:** `release.yml` checks out the release tag commit and re-runs `pnpm test:ci`, which re-installs deps and rebuilds. If the npm registry or a CDN serves a different dep version between CI merge and release publish (unlikely with frozen-lockfile but not zero risk), the published artifact is not byte-identical to what CI verified.

**Pattern fix:** Build artifact in CI, pass to release via upload/download artifact with commit SHA verification. For this package size, acceptable to document the risk rather than restructure, but add a checksum step:

```yaml
      - name: Verify release commit matches tag
        run: |
          TAG_SHA=$(git rev-parse HEAD)
          echo "Publishing from SHA: $TAG_SHA"
          git log -1 --format="%H %s"
```

**Better fix (Medium effort):** Upload `npm pack` tarball as a release asset in CI, download and publish that exact tarball in release.yml (eliminates rebuild entirely).

#### [Medium] `npm install -g npm@latest` in release job — unpinned, runs as root equivalent

**Risk:** `npm@latest` is unpinned. If npm ships a breaking change, the release job fails silently or publishes incorrectly. The step exists to enable OIDC `--provenance` support in older npm versions. Node 22 ships npm 10+ which already supports `--provenance`.

**Fix:** Remove the upgrade step. Node 22 (`actions/setup-node@v6`) already includes a provenance-capable npm.

```yaml
      # DELETE this step:
      - name: Upgrade npm for trusted publishing
        run: npm install -g npm@latest
```

#### [Low] No `packages` permission on `release.yml` job

Publishing to npm via OIDC does not require `packages: write` (that's for GitHub Packages/GHCR, not npmjs.org). Current setup is correct. Document this to avoid future "helpfully" adding it.

---

### CD Flow (cd.yml)

#### [Medium] `docs` job has no `needs: release-please` dependency

**Risk:** Docs deploy and release-please run as siblings. If release-please creates a new release PR that bumps version, the docs deploy runs against the current main (pre-bump) — not a security issue but produces stale docs version in some edge cases.

**Fix:**

```yaml
  docs:
    name: Deploy Docs
    needs: [release-please]   # <-- add; docs deploy after release-please completes
    if: "!contains(github.event.head_commit.message || '', '[skip actions]') && !cancelled()"
```

#### [Low] `cd.yml` docs job doesn't fail-fast guard against release-please failure

Current `!cancelled()` condition means docs deploy even if release-please job fails. With `needs:` added above, `!cancelled()` still lets docs run on release-please failure. Use `success() || failure()` deliberately or require `needs: [release-please]` with default success condition.

---

### Automerge (automerge.yml)

#### [High] Automerge approves and merges without CI passing first

**Risk:** The automerge job fires on `pull_request: [opened, synchronize, reopened]`. It calls `gh pr merge --auto --squash` which will merge when branch protection requirements are met — but ONLY if branch protection requires status checks. If branch protection is not configured to require CI checks, Dependabot PRs merge immediately without tests passing.

**Mitigation:** This is safe IFF branch protection requires status checks. Without branch protection enforcement, it's a silent bypass. See branch protection recommendations below.

#### [Medium] Automerge approves release-please PRs unconditionally

**Risk:** Any PR whose branch starts with `release-please--` and whose author `type == 'Bot'` is approved and auto-merged. This check is done at workflow level, not at GitHub's verified bot identity level. A fork-originated PR cannot spoof `head.repo.full_name == github.repository`, so the `same-repo` guard is the primary protection. Adequate for now, but worth noting.

---

### Secrets & Auth

#### [High — Phase 2] `secrets.CI_GITHUB_TOKEN` is a PAT

**Risk:** PAT is scoped to a user account, not the repository. If the user account is compromised, all repos using the PAT are affected. PAT does not auto-rotate. PAT permissions are opaque.

**Fix (GitHub App migration):**

1. Create GitHub App with permissions: `contents: write`, `pull-requests: write`.
2. Install app on repo.
3. In `cd.yml`, replace PAT with app token generation:

```yaml
      - uses: actions/create-github-app-token@v1
        id: app-token
        with:
          app-id: ${{ secrets.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - uses: googleapis/release-please-action@...
        with:
          token: ${{ steps.app-token.outputs.token }}
```

4. Revoke PAT after confirming app works.

#### [Low] No `NPM_TOKEN` in release.yml

Correct — OIDC provenance publish uses `NODE_AUTH_TOKEN` implicitly set by `actions/setup-node` with `registry-url`. No explicit `NPM_TOKEN` needed. Confirm npm package is configured for OIDC trusted publishing (npmjs.org → package settings → Publishing → Trusted Publishers).

---

### Caching

#### [Medium] No Nx remote cache (Nx Cloud or self-hosted)

**Risk:** Nx local cache does not persist between GitHub Actions runners. `cache: true` in `nx.json` enables Nx's local cache, but each runner starts cold. The `actions/setup-node cache: 'pnpm'` caches the pnpm store (npm package downloads) but NOT Nx task output cache.

**Fix:** Either:
- Enable Nx Cloud (free tier sufficient for OSS): `nx connect` → sets `nxCloudAccessToken` in `nx.json`.
- Or add explicit cache step for `.nx/cache`:

```yaml
      - name: Restore Nx cache
        uses: actions/cache@v4
        with:
          path: .nx/cache
          key: nx-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ github.sha }}
          restore-keys: |
            nx-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-
            nx-${{ runner.os }}-
```

---

### SLSA / SBOM / Attestation

#### [High] No SLSA L3 build attestation (`actions/attest-build-provenance`)

**Risk:** npm `--provenance` generates OIDC-linked npm provenance (SLSA L2 equivalent). `actions/attest-build-provenance` generates a GitHub-signed Sigstore attestation anchored to the workflow run (SLSA L3). Without it, consumers cannot verify the artifact was built by this specific workflow.

**Fix — add to `release.yml` after build, before publish:**

```yaml
      - name: Build package
        working-directory: packages/medieval-hexagon-gameboard
        run: pnpm build

      - name: Attest build provenance
        uses: actions/attest-build-provenance@v2
        with:
          subject-path: packages/medieval-hexagon-gameboard/dist/**

      - name: Publish with OIDC provenance
        working-directory: packages/medieval-hexagon-gameboard
        run: npm publish --access public --provenance
```

Requires adding `attestations: write` permission to release.yml top-level permissions block.

#### [Medium] No SBOM generation

**Risk:** No machine-readable software bill of materials. Required for many enterprise consumers and increasingly for regulatory compliance (EO 14028).

**Fix — add to `release.yml`:**

```yaml
      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          path: packages/medieval-hexagon-gameboard
          format: spdx-json
          output-file: sbom.spdx.json

      - name: Attest SBOM
        uses: actions/attest-sbom@v2
        with:
          subject-path: packages/medieval-hexagon-gameboard/dist/**
          sbom-path: sbom.spdx.json
```

---

### Security Gates (SAST)

#### [High] No SAST (Semgrep / CodeQL) in CI

**Risk:** No static analysis gate. Dependency scanning via `dependency-review-action` covers known CVEs in deps but not custom code vulnerabilities (injection, path traversal, prototype pollution in game logic).

**Fix — add `security.yml` workflow or add job to `ci.yml`:**

```yaml
  sast:
    name: SAST (Semgrep)
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
        with:
          persist-credentials: false

      - uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/owasp-top-ten
            p/nodejs
          generateSarif: true

      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: semgrep.sarif
```

Alternatively use CodeQL:

```yaml
  codeql:
    name: CodeQL
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
      actions: read
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript
      - uses: github/codeql-action/analyze@v3
```

---

### Performance / Size Gates

#### [Medium] No bundle size gate

**Risk:** No CI enforcement prevents bundle size regressions. A large dep addition could silently double the published package size.

**Fix — `size-limit` integration:**

```bash
pnpm add -D @size-limit/preset-small-lib size-limit
```

```json
// package.json
"size-limit": [
  { "path": "packages/medieval-hexagon-gameboard/dist/index.js", "limit": "50 KB" }
]
```

```yaml
      - name: Check bundle size
        run: pnpm exec size-limit
```

---

### Observability / Notifications

#### [Low] No failure notifications

**Risk:** Workflow failures are only visible in GitHub UI. No Slack/email notification on CI or CD failure.

**Fix (optional, add to any job's `if: failure()` step):**

```yaml
      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v2
        with:
          webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
          webhook-type: incoming-webhook
          payload: |
            {"text": "CI failed on ${{ github.ref }}: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"}
```

GitHub's built-in annotation system (SARIF upload for security findings) is already available once SAST is added.

---

### Local Dev Parity

#### [Medium] `pnpm verify` (test:ci) runs serially — CI runs parallel

**Risk:** `test:ci` in `package.json` runs: lint → typecheck → test:docs-contract → test:api-docs → docs:build → test:assets → test:workspace → test:workflows → build → test:cli → expectations → test → test:package → test:consumer → pack:dry-run — all serial. CI runs lint/typecheck/build/test as parallel matrix jobs. Parity gap: local `verify` can pass steps CI would catch in a different order.

**No immediate action required** — the coverage is symmetric, just slower locally. Document this is intentional (local is single-machine serial, CI is parallel-by-design).

#### [Low] `pnpm test:browser:free` not in `pnpm verify` (`test:ci`)

Browser visual tests run as a separate CI job but are NOT in the local `test:ci` script. Developers cannot reproduce browser visual failures locally via `pnpm verify`.

**Fix — add to `test:ci`:**

```json
"test:ci": "... && pnpm test:browser:free"
```

(Requires Playwright installed locally: `pnpm exec playwright install chromium`.)

---

### Branch Protection (Recommendations — cannot verify directly)

Recommended settings for `main`:

| Rule | Setting |
|---|---|
| Require status checks | All CI matrix legs: `lint`, `typecheck`, `build`, `test`, `FREE Browser Visuals`, `npm Pack`, `Docs Build` |
| Require branches to be up to date | Yes |
| Require linear history | Yes (enforces squash-merge) |
| Do not allow bypassing required status checks | Yes (even admins) |
| Restrict who can push to matching branches | Only release-please bot and repo maintainers |
| Require signed commits | Optional but recommended for supply-chain |
| Allow force pushes | No |

Critical: Without "Do not allow bypassing" + status checks including `lint` and `build`, the automerge workflow can merge broken code.

---

### Dependabot

#### [Low] No `security` group in dependabot config

**Risk:** Security-only updates follow the same weekly schedule as all dep updates. A critical vuln fixed upstream won't get a PR until the next Monday 6am UTC run.

**Fix — add security group to `.github/dependabot.yml`:**

```yaml
groups:
  security:
    applies-to: security-updates
    patterns: ["*"]
```

This triggers security updates immediately when detected, separate from the scheduled weekly batch.

---

## CI Gates to Add Before 1.0 (Priority Order)

| Priority | Gate | Where | Effort |
|---|---|---|---|
| 1 | `needs:` chain — `package`/`browser-free`/`docs` depend on `check` | `ci.yml` | 15 min |
| 2 | `pnpm audit --prod --audit-level=high` + pnpm overrides for known moderates | `ci.yml` package job | 30 min |
| 3 | `actions/attest-build-provenance@v2` in release | `release.yml` | 30 min |
| 4 | SAST (Semgrep `p/nodejs` + `p/owasp-top-ten`) | new `security.yml` or `ci.yml` job | 1 hr |
| 5 | SBOM generation + attestation | `release.yml` | 30 min |
| 6 | GitHub App migration for `CI_GITHUB_TOKEN` PAT | App creation + cd.yml update | 2 hr |
| 7 | `size-limit` bundle size gate | `ci.yml` check job or separate | 1 hr |
| 8 | Nx task output cache (`.nx/cache`) persistence | `ci.yml` (all jobs) | 30 min |
| 9 | Remove `npm install -g npm@latest` from release | `release.yml` | 5 min |
| 10 | `needs: [release-please]` on docs job in cd.yml | `cd.yml` | 5 min |
| 11 | Dependabot `security` group for immediate CVE PRs | `dependabot.yml` | 10 min |
| 12 | `pnpm test:browser:free` in local `test:ci` script | `package.json` | 5 min |
| 13 | Failure notifications (Slack webhook) | all workflows | 1 hr |

---

## Summary Table

| Area | Status | Gap |
|---|---|---|
| Action pinning | PASS | — |
| OIDC/provenance | PARTIAL | Missing `attest-build-provenance` (SLSA L3) |
| Frozen lockfile | PASS | — |
| Dependency review | PASS | Missing prod-only audit gate |
| Concurrency | PASS | — |
| Job gating (`needs:`) | FAIL | No dependency chain in ci.yml |
| Secret management | PARTIAL | PAT → GitHub App migration pending |
| SAST | FAIL | None configured |
| SBOM | FAIL | None configured |
| Nx caching | PARTIAL | Local cache only, no cross-run persistence |
| Size gate | FAIL | Not configured |
| Branch protection | UNKNOWN | Cannot read settings; requirements documented above |
| Notifications | FAIL | None configured |
| Local parity | PARTIAL | Browser tests excluded from verify script |
