# Phase 4: Best Practices & CI/CD — Consolidated

See `04a-framework-best-practices.md` and `04b-cicd-devops.md` for full detail.

## Framework / TypeScript

### High

- **F-H1** — `HexKey` is unbranded `string` — any string flows into tile-key positions. Brand it: `type HexKey = string & { readonly __brand: 'HexKey' }` with a constructor.
- **F-H2** — 4 hand-rolled `parseArgs` impls (1 in cli.ts, 3 in scripts) — migrate all to `node:util.parseArgs`. Lands with B3.
- **F-H3** — 130 bare `throw new Error()` — no custom error hierarchy. Lands with D2.
- **F-H4** — 2 `as unknown as` casts in `cli.ts` (`readBlueprintOptionsFile`, simulation payload reader) lack runtime validation. Add validators that return the typed value; cast disappears.
- **F-H5** — `src/three.ts` exports no `dispose` utility — consumers lack a guided cleanup path. Add `disposeGameboardThreeResources(ctx)` + TSDoc.

### Medium

- **F-M1** — `verbatimModuleSyntax: true` missing from `tsconfig.base.json`. Add it (also supersedes legacy isolatedModules nuances).
- **F-M2** — `noUncheckedIndexedAccess: true` missing — array indexing returns `T` not `T | undefined`. Add it; expect breaks in `actors.ts`, `simulation.ts`.
- **F-M3** — React peer dep range `>=18.0.0 <20` formally excludes React 19; devDep uses 19. Align to `>=18.2.0`.
- **F-M4** — `package.json#exports` lacks `"source"` condition (needed for in-workspace Vite/Nx consumption without building first) and `"default"` fallback.
- **F-M5** — Vitest `pool` not set (defaults to `forks`); `threads` likely faster for pure Node simulation tests.
- **F-M6** — `test:browser:*` Nx targets not in `targetDefaults` — Nx does not cache them.
- **F-M7** — `with { type: 'json' }` already correctly used in `smoke-packed-consumer.ts` — pattern is known. Reuse for B1.

### Low

- TS 5.x `using`/`Symbol.dispose` for file handles in CLI — modernize as opportunity arises.
- pnpm `>=9 <10` engine pin — schedule pnpm 10 evaluation post-1.0.

## CI/CD

### Critical

- **CI-C1** — **No `needs:` chain** in `ci.yml` — `package`, `browser-free`, `docs` jobs run in parallel with `check` (lint/typecheck/build/test). A broken build can "pass" the package job. 15-min fix.
- **CI-C2** — **No SAST** in CI. Semgrep `p/nodejs` + `p/owasp-top-ten` or GitHub CodeQL. Lands with A7.
- **CI-C3** — **No SLSA L3 attestation** beyond OIDC provenance. Add `actions/attest-build-provenance@v2`. Lands with G1.
- **CI-C4** — **No SBOM**. `anchore/sbom-action` or `@cyclonedx/cyclonedx-npm`. Lands with G2.
- **CI-C5** — **PAT → GitHub App** for `secrets.CI_GITHUB_TOKEN` (release-please). Highest ongoing operational risk. Lands with A5.
- **CI-C6** — **No prod-only audit** — `pnpm audit --prod --audit-level=high` missing from package job. Lands with A4. Clear known moderates via `pnpm.overrides` (A1).

### Medium

- Remove `npm install -g npm@latest` from workflow setup (Node 22 ships provenance-capable npm).
- Add `needs: [release-please]` to CD docs job.
- Add Dependabot `security` group with daily cadence (G3).
- `concurrency:` keys verified per workflow.
- Local-vs-CI parity: every CI gate must run via `pnpm verify` (G4).

### Low

- Annotate workflow failures with GitHub `::error::` annotations for clearer PR feedback.
- Consider scheduled (nightly) browser-extra + e2e-local-assets runs to catch flake before PR queue.

## CI gates to add before 1.0 (prioritized)

1. `pnpm audit --prod --audit-level=high` (A4)
2. `pnpm.overrides` for known moderates (A1)
3. `needs:` chain in ci.yml (A6)
4. size-limit budgets (A3)
5. semgrep `p/owasp-top-ten` + `p/nodejs` (A7)
6. Coverage thresholds (A8)
7. GitHub App token replacing PAT (A5)
8. SLSA L3 attestation (G1)
9. SBOM (G2)
10. Dependabot security group (G3)
