# Security Policy

## Supported versions

`medieval-hexagon-gameboard` is pre-1.0; only the latest published version receives security updates. Once 1.0 ships, the last two minor versions will receive patches.

## Reporting a vulnerability

**Do not open public GitHub issues for security reports.**

Use GitHub's private vulnerability reporting: https://github.com/jbcom/medieval-hexagon-gameboard/security/advisories/new

If you can't use the GitHub flow, email `security@jbcom.dev` with:

- A description of the vulnerability and its impact.
- Steps to reproduce.
- Affected version(s).
- Suggested fix, if any.

You'll get an acknowledgment within 72 hours. We aim to publish a fix within 30 days for high-severity issues and 90 days for medium-severity ones.

## Scope

In scope:

- The published `medieval-hexagon-gameboard` npm package.
- The CLI binary (`medieval-hexagon-gameboard`).
- The asset bootstrap subcommand's downloads + integrity verification.
- Anything that could let attacker-controlled scenario / manifest / blueprint JSON escalate to filesystem writes, network calls, or code execution outside the intended sandbox.

Out of scope:

- Theoretical attacks against `koota`, `three`, or `react` themselves (report upstream).
- Dependency vulnerabilities that don't affect this library's actual surface (we still appreciate the heads-up).
- Issues in `references/` upstream packs (those are unmodified KayKit / Kenney assets).

## What we publish on release

- npm provenance (SLSA L3 via `actions/attest-build-provenance`, PRD G1).
- CycloneDX SBOM as a release artifact (PRD G2).
- The CLI's `--out*` write sites jail outputs through `safeResolveOutput` (PRD C1) so a hostile flag value can't escape `cwd`.
