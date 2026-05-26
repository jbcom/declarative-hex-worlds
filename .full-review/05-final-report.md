# Comprehensive Code Review — Final Report

**Target:** `@jbcom/medieval-hexagon-gameboard` library
**Branch:** `codex/initial-medieval-hexagon-gameboard` (146 commits, 646 files, ~190K insertions)
**Scope reviewed:** `packages/medieval-hexagon-gameboard/src/` (~58K LOC) + `scripts/` (~7.5K LOC)
**Flags:** security-focus, performance-critical
**Date:** 2026-05-26

---

## Executive summary

The library is **unusually clean and disciplined** for an initial scaffold of this size. Zero `Math.random`, zero `as any`, zero `@ts-ignore`, zero `TODO`/`FIXME`, zero stubs, zero non-null assertions, **zero circular dependencies** across 38 modules, modern ESM-only toolchain, OIDC-provenance publish, SHA-pinned actions, frozen-lockfile, tight `files` allowlist. **No Critical correctness issues.** Determinism contract (the product invariant) is correctly enforced at the code level.

The findings concentrate in **five themes**, all addressable in the 1.0 stabilization window:

1. **Maintainability** — three files dominate the maintenance surface (`cli.ts` 4.3 K LOC, `simulation.ts` 5.2 K LOC, `manifest/free.ts` 16.6 K LOC hand-authored). Refactor + autogeneration before 1.0.
2. **Performance** — `freeManifest` ships parsed JS through the umbrella; CLI cold-loads everything. Two Critical perf fixes save ~22 KB gzip + ~150 ms cold start.
3. **Security** — Path traversal in 40+ CLI write sites + symlink-following walker. Two High findings; no Criticals; remediation is one helper + walker hardening.
4. **API contract** — 37 subpath exports cement ~10 internal modules as semver pin-points. 130 raw throws give consumers no error taxonomy. Tier + taxonomy before 1.0.
5. **Process gates** — No size-limit, no SAST, no cross-process determinism test, no public-API snapshot, no SLSA L3 attestation, no SBOM. The library *deserves* the gates it currently doesn't have.

The full 1.0 stabilization plan is captured in `docs/PRD/1.0.md` and decomposed in `.agent-state/directive.md`. Execution begins immediately.

---

## Findings by priority

### Critical (P0 — must fix before 1.0)

- **P-C1** — `freeManifest` re-exported from umbrella forces 395 KB / 22 KB-gzip manifest chunk into every umbrella consumer. (perf) [PRD B1, B2]
- **P-C2** — `cli.ts` eagerly imports every subsystem + an example file at top level. ~150-250 ms cold start. (perf) [PRD B3]

### High (P1 — fix before 1.0)

**Security:**
- **S-H1** — Path traversal across 40+ CLI `--out*` write sites. (sec) [PRD C1]
- **S-H2** — `listFiles` walker follows symlinks blindly. (sec) [PRD C2]

**Performance:**
- **P-H1** — `readGameboardActorTargets` 6-pass filter/map. (perf) [PRD B5]
- **P-H2** — `parseHexKey` throws on expected-miss path. (perf) [PRD B6]
- **P-H3** — `tilesByKey` Map rebuilt per layout call. (perf) [PRD B4]
- **P-H4** — Selector hooks lose memoization on inline `options`. (perf) [PRD B7]
- **P-H5** — `JSON.parse(JSON.stringify(...))` deep clone — switch to `structuredClone`. (perf) [PRD B8]

**Code quality / architecture:**
- **H-1** — `manifest/free.ts` is hand-authored. (quality) [PRD B1]
- **H-2** — `cli.ts` 4.3 K LOC monolith. (quality) [PRD B3]
- **H-3 (re-scoped)** — `simulation.ts` 5.2 K LOC decomposition. (quality; "double-dispatch" subcomponent was a false positive) [PRD D3]
- **F1** — Public API over-exposure (37 subpaths, ~10 leaky). (architecture) [PRD D1]
- **F11** — 130 raw throws, no error taxonomy. (architecture) [PRD D2]
- **F-H1** — `HexKey` unbranded `string`. (TS) [PRD D2 stretch / Appendix A]
- **F-H5** — `three.ts` no `dispose` utility. (TS) [PRD D6 stretch]

**Testing:**
- **T-C1** — No cross-process determinism test. [PRD E1]
- **T-C2** — `manifest/free` untested. [PRD E covered post-B1]
- **T-C3** — No coverage thresholds. [PRD A8 / E8]
- **T-H1** — No public API snapshot test. [PRD E2]
- **T-H2** — No hostile-input tests. [PRD E3]
- **T-H3** — `smoke-packed-consumer.ts` single try/catch. [PRD D10]
- **T-H4** — No trait-identity test. [PRD E4]
- **T-H5** — Visual tests not in `test:ci`. [PRD E covered]

**Documentation:**
- **D-C1** — No install/quickstart in README. [PRD F1d]
- **D-C2** — No CLI reference doc. [PRD F2d]
- **D-C3** — No public/private tier table. [PRD F covered + D1]
- **D-H1-H5** — CHANGELOG, error catalog, determinism contract, peer-dep guide, bundler hazard guide all missing. [PRD F6d, F5d, F3d, F4d]

**CI/CD:**
- **CI-C1** — No `needs:` chain in ci.yml. [PRD A6]
- **CI-C2** — No SAST (semgrep / CodeQL). [PRD A7]
- **CI-C3** — No SLSA L3 attestation. [PRD G1]
- **CI-C4** — No SBOM. [PRD G2]
- **CI-C5** — PAT → GitHub App migration. [PRD A5]
- **CI-C6** — No prod-only audit gate. [PRD A4]

### Medium (P2 — fix before or during 1.0)

- **S-M1-M7** — JSON proto-pollution guard, `sh -c` quoting, dev-tree CVE moderates, relative-path errors, debug-gated stack traces, source-map publish, TOCTOU. [PRD C3-C7, A1]
- **M-1, M-2, M-3, M-4** — Scripts boilerplate extraction, `audit-workspace.ts` split, `smoke-packed-consumer.ts` split, `createKayKitGuideScenarios` inversion. [PRD D4, D8, D9, D10]
- **F4, F5, F9, F13** — Peer-dep runtime guards, traits/actions umbrellas, scripts location, `createActions` index. [PRD D5, D6, D7]
- **F-M1-M7** — `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, React peerDep range, exports `source`/`default` conditions, vitest pool, Nx caching for browser, JSON-attribute import. [PRD A2, A3 covered]
- **CI Medium** — Remove `npm install -g`, `needs: [release-please]` in CD, Dependabot grouping, concurrency keys. [PRD G3]
- **P-M1-M4** — size-limit budgets, source-map suppression, React `useTrait` patterns docs, `simulation.ts` long-function deopt. [PRD A3, C7, D3]

### Low (P3 — track in backlog or fix opportunistically)

- **L-1 through L-7** code-quality nits (as-unknown-as comments, bare catch flow control, terse error messages, ESLint/Biome gap-resolved, etc.).
- **S-L1-L6** security nits (structuredClone usage, escapeRegExp hygiene, bin naming).
- **P-L1-L3** performance nits (vitest pool, three.ts disposal docs, selectors memoization).
- **F6, F8, F12, F13** architecture nits (Date.now in coverage, index re-export count, examples shipped as entries, actions index).
- **CI Low** — workflow annotations, scheduled flake catches.

---

## Findings by category

| Category | Critical | High | Medium | Low |
|---|---:|---:|---:|---:|
| Code Quality | 0 | 3 | 6 | 7 |
| Architecture | 0 | 2 | 7 | 4 |
| Security | 0 | 2 | 7 | 6 |
| Performance | 2 | 5 | 4 | 3 |
| Testing | 3 | 5 | 4 | 0 |
| Documentation | 3 | 5 | 6 | 0 |
| Framework | 0 | 5 | 7 | 2 |
| CI/CD | 0 | 6 | 5 | 3 |
| **Totals** | **8** | **33** | **46** | **25** |

---

## Action plan

Captured in `docs/PRD/1.0.md` and decomposed for execution in `.agent-state/directive.md` (Epics A-G, 60+ atomic items).

**Execution order** (dependency-respecting):

1. **A** — Foundation gates (size-limit, coverage thresholds, audit, Biome, semgrep) so subsequent fixes are quantified.
2. **B** — Performance criticals (manifest JSON, CLI lazy imports, hot-path wins).
3. **C** — Security criticals (path-traversal helper, symlink walker hardening).
4. **D** — Architectural debt (subpath tier, error taxonomy, simulation decomposition, script reorg).
5. **E** — Test debt (determinism, public-API snapshot, hostile inputs, trait identity, perf benches).
6. **F** — Documentation (README quickstart, CLI ref, standard-repo docs).
7. **G** — Release readiness (SLSA L3, SBOM, security Dependabot group, verify parity, publish).

Reviewer trio runs per commit in background (`comprehensive-review:full-review`, `security-scanning:security-sast`, `code-simplifier`); findings fold into the next forward commit. Visual checks (vitest-browser screenshots) gate any commit touching `react.ts`/`three.ts`.

---

## Strengths worth preserving

- Zero circular dependencies; clean fan-in/fan-out layering.
- Determinism: 0 `Math.random`, all RNG via `seedrandom`, only one cosmetic `new Date()` (override-able).
- Modern stack: ESM-only, Node ≥22, sideEffects:false, peer-dep boundary respected.
- Trait identity hazard with `splitting: true` is acknowledged in tsup config comments — maintainer awareness is present.
- Tight published `files` allowlist enforced by `audit-package.ts`.
- OIDC-provenance publish, SHA-pinned actions, `pull_request` (not `_target`).
- 6 pillar docs + 6 guides + TypeDoc — solid documentation corpus to build on.

---

## Review metadata

- Review date: 2026-05-26
- Phases completed: 1 (Quality + Architecture), 2 (Security + Performance), 3 (Testing + Documentation), 4 (Best Practices + CI/CD), 5 (Consolidation)
- Reviewer agents: `code-reviewer`, `architect-review`, `security-auditor`, `performance-engineer`, `test-automator`, `documentation-architect`, `typescript-pro`, `deployment-engineer`
- Flags: security-focus, performance-critical
- Output files: `00-scope.md`, `01a-code-quality.md`, `01b-architecture.md`, `01-quality-architecture.md`, `02a-security.md`, `02b-performance.md`, `02-security-performance.md`, `03a-testing.md`, `03b-documentation.md`, `03-testing-documentation.md`, `04a-framework-best-practices.md`, `04b-cicd-devops.md`, `04-best-practices.md`, `05-final-report.md`
