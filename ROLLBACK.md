# Rollback Runbook

Emergency procedures for reverting a bad npm publish of `declarative-hex-worlds`.

## When to roll back

Roll back a published version when:
- The package is broken for consumers (import errors, runtime exceptions on import).
- A security vulnerability is found in the published package.
- The SLSA provenance attestation was not attached (post-publish `npm audit signatures` failed).
- The SBOM is missing or incorrect.

**Do NOT roll back for** documentation typos, minor API ergonomics issues, or non-critical
bugs — deprecate instead (see below).

## Step 1 — Deprecate immediately (blocks `npm install` for unpinned consumers)

```bash
npm deprecate declarative-hex-worlds@<VERSION> "Critical issue — do not install; upgrade to <NEXT>"
```

This does not unpublish but marks the version in the registry UI and causes `npm install`
to warn. Do this **first** — it takes effect in seconds.

## Step 2 — Unpublish (72-hour window only)

npm allows unpublish within 72 hours of publish if the package has no dependents, or
unconditionally if the version has never been depended on.

```bash
# Dry-run first to check for dependents
npm unpublish declarative-hex-worlds@<VERSION> --dry-run

# Unpublish if safe
npm unpublish declarative-hex-worlds@<VERSION>
```

If the 72-hour window has passed or dependents exist, skip to Step 3.

## Step 3 — Patch release

If unpublish is not possible:

1. Fix the root cause on a new branch.
2. Open a PR with `fix:` conventional-commit prefix — release-please will cut a patch version.
3. After the patch releases, deprecate the bad version (Step 1).

## Step 4 — Notify

- Open a GitHub security advisory if the issue is a vulnerability.
- Add a `## Security` entry to `CHANGELOG.md` for the patch release.
- File an incident retrospective in `.agent-state/decisions.ndjson` with `Decision:` prefix.

## npm audit signatures failure

If the post-publish CI step `Verify published package signatures` fails:

1. The package is published and visible but provenance is not attached.
2. Contact npm support to check if the Sigstore/OIDC pipeline had an outage.
3. The next patch release will re-attach provenance if the root cause was transient.
4. Do NOT republish the same version — that is not allowed by the registry.

## Contacts

- npm support: support@npmjs.com
- Package owner: see `package.json#author`
