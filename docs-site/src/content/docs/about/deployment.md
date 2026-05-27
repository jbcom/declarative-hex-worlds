---
title: Deployment
description: Release flow, OIDC publish, GitHub App token, SBOM, SLSA L3 attestation.
sidebar:
  order: 3
---

## Release flow

Releases are driven by [release-please](https://github.com/googleapis/release-please-action) and Conventional Commits.

1. Contributor lands a PR on `main` with a Conventional Commits message (`feat:`, `fix:`, `chore:`, etc.).
2. `.github/workflows/cd.yml`'s `release-please` job opens (or updates) a release PR that bumps the version + writes the changelog entry.
3. Maintainer merges the release PR.
4. release-please tags the commit + creates a GitHub Release.
5. `.github/workflows/release.yml` fires on the release-published event and:
   - Builds the package.
   - Packs the tarball via `npm pack`.
   - Attests SLSA L3 build provenance.
   - Generates a CycloneDX SBOM.
   - Attaches both as GitHub release assets.
   - Publishes to npm with OIDC provenance.

## GitHub App token (PRD A5)

The `release-please` job prefers a GitHub App token over the legacy `secrets.CI_GITHUB_TOKEN` PAT. Short-lived (1h max), scope-limited, and PRs the App opens *trigger downstream CI* (Bot-user PATs don't, by GitHub design).

To enable the App pathway:

1. Install a GitHub App on the repo with permissions `contents:write`, `pull_requests:write`, `metadata:read`.
2. Set `vars.RELEASE_PLEASE_APP_ID` (repo variable, not secret — the App ID is public).
3. Set `secrets.RELEASE_PLEASE_APP_PRIVATE_KEY` (the App's private key PEM).

Once those are set, `cd.yml`'s `if: vars.RELEASE_PLEASE_APP_ID != ''` guard flips the App pathway on. The PAT fallback can be removed in a follow-up commit.

Until the App is provisioned, the fallback path keeps CD working.

## npm OIDC publish

`release.yml` publishes with `--provenance`. npm builds an OIDC trust relationship to GitHub's identity issuer; consumers can verify the published tarball was built by THIS exact workflow run:

```bash
npm audit signatures @jbcom/medieval-hexagon-gameboard
```

No `NPM_TOKEN` secret needed — the publish auth is OIDC-derived at runtime.

## SLSA L3 attestation (PRD G1)

The release workflow uses [actions/attest-build-provenance@v3](https://github.com/actions/attest-build-provenance) to cryptographically attest:

- The tarball's SHA256 (the exact bytes published).
- The workflow ref + commit that built it.
- The GitHub-hosted runner identity.

Consumers verify with:

```bash
gh attestation verify <tarball-path> --owner jbcom
```

This puts the package at SLSA Build Level 3.

## CycloneDX SBOM (PRD G2)

The release workflow runs `npx @cyclonedx/cyclonedx-npm --output-format json --omit dev` to produce a CycloneDX 1.6 SBOM of the prod-dep tree. The SBOM attaches to the GitHub release as `sbom.cdx.json` for SCA tooling.

## Tarball boundaries

The published tarball ships:

- `dist/` — built JS + DTS (sourcemaps + declaration maps excluded).
- `assets/free/manifest.json` — metadata pointer (the GLTF tree is bootstrap-fetched, not bundled).
- `docs/showcases/` — marketing PNGs referenced from the README.
- `examples/*.json` — blueprint + recipe fixtures referenced by docs.
- `LICENSE`, `README.md`, `NOTICE.md`.

NOT shipped:

- `assets/free/*.gltf` / `*.bin` / `*.png` — bootstrapped at install time.
- `examples/simple-rpg-*` — SimpleRPG is a test driver, not a consumer example (PRD R4).
- `tests/`, `docs-site/`, `scripts/`, `.agent-state/` — internal.
- `references/` — local upstream packs (gitignored).

`pnpm test:package` audits the tarball boundary on every PR.

## Dependabot

`.github/dependabot.yml` (post-PRD G3) runs four update channels:

- Root npm — weekly bulk updates (minor + major separated).
- Root npm — daily security-updates group (`open-pull-requests-limit: 10`).
- docs-site npm — weekly bulk.
- docs-site npm — daily security-updates.

Security PRs carry the `security` label so filters / auto-merge rules can pick them up.

## Disaster recovery

If the App token + PAT both fail:

1. Maintainer can manually tag + publish from a clean checkout: `npm pack && npm publish --provenance jbcom-medieval-hexagon-gameboard-X.Y.Z.tgz`.
2. Attestation step needs `gh attestation` CLI locally.
3. SBOM step needs `npx @cyclonedx/cyclonedx-npm`.

The CD workflow's `concurrency: cd-deploy` + `cancel-in-progress: false` ensures only one release runs at a time.
