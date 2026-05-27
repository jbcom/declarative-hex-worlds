---
title: Testing
description: The unit + browser + e2e test trinity, coverage gates, SimpleRPG-as-driver, perf benches.
sidebar:
  order: 5
---

## The test trinity

Three vitest harnesses + one perf harness. Coverage from all of them feeds into a merged report (PRD R6).

| Harness | Config | Includes | Cadence |
|---|---|---|---|
| **Unit** | `vitest.config.ts` | `src/**/__tests__/*.test.ts`, `tests/unit/**/*.test.ts`, `tests/integration/**/*.test.ts` | every PR (`pnpm test`) |
| **Browser FREE** | `vitest.browser.free.config.ts` | `tests/browser/{free-visual,simple-rpg-visual,react-bindings}.test.ts` | every PR once Phase RB bootstrap step lands in CI |
| **Browser EXTRA** | `vitest.browser.extra.config.ts` | `tests/browser/extra-visual.test.ts` | local-only with `MEDIEVAL_HEXAGON_ENABLE_EXTRA=1` |
| **E2E local-assets** | `vitest.browser.local-assets.config.ts` | `tests/e2e/local-assets/**/*.test.ts` | local-only with `MEDIEVAL_HEXAGON_ENABLE_LOCAL_ASSETS=1` |
| **SimpleRPG e2e (GitHub)** | `vitest.simple-rpg-e2e.config.ts` | `tests/e2e/simple-rpg-ci.test.ts` | scheduled CI with `MEDIEVAL_HEXAGON_E2E_GITHUB=1` |
| **SimpleRPG e2e (local)** | `vitest.simple-rpg-e2e.config.ts` | `tests/e2e/simple-rpg-local-extra.test.ts` | local with `MEDIEVAL_HEXAGON_LOCAL_REFERENCES=1` |
| **Perf bench** | n/a — direct vitest bench | `tests/perf/*.bench.ts` | local-only, non-blocking |

## Coverage gates

`vitest.coverage.shared.ts` exports `COVERAGE_THRESHOLDS` at the current floor (statements 65 / branches 60 / functions 75 / lines 64 — measured baseline minus ~1% slack). PRD A8 ratchets these toward 100/100/100/100 via Epic E0-E10; each commit that closes a coverage gap raises the floor in the same commit.

CI runs `pnpm test:coverage:enforce` in the check matrix; regressions block merge.

To merge harness reports locally:

```bash
MEDIEVAL_HEXAGON_COVERAGE=1 pnpm coverage:all
open coverage/merged/lcov-report/index.html
```

## SimpleRPG: the coverage driver

`tests/integration/simple-rpg/simple-rpg.ts` is a 1,005-line driver that exercises 80+ public APIs synchronously. Its purpose isn't gameplay — it's coverage. Read the [SimpleRPG README](https://github.com/jbcom/medieval-hexagon-gameboard/tree/main/tests/simple-rpg/README.md) for the API matrix.

Three entry-point functions matter:

- `runSimpleRpgUsageExample()` — full scenario → simulation → snapshot path; returns a `SimpleRpgUsageSummary` with every metric the coverage ledger needs.
- `summarizeSimpleRpgGuidePublicApiExercises()` — pure-data coverage map; safe to call repeatedly (no koota worlds).
- `runSimpleRpgExecutableGuideApiSmoke()` — executable smoke of every guide-page helper API.

The CLI's `coverage` subcommand consumes these to emit `docs/release-readiness.json` + Markdown ledgers.

## Perf benches

`tests/perf/warm-start.bench.ts` (PRD A3b) tracks the cost of blueprint → board → koota runtime → facade snapshot. Run:

```bash
pnpm bench:warm-start
```

Baseline as of 2026-05-26: ~27 Hz / 37 ms mean.

Add more benches to `tests/perf/` as PRD B/D-series perf work lands. The bench harness is opt-in (not in default `pnpm test`).

## Visual regression

`tests/browser/__screenshots__/` holds committed PNG snapshots that vitest-browser compares against every render. Drift fails the build until either the diff is accepted (new snapshot committed) or fixed.

The screenshot assertion script is `tests/scripts/assert-screenshots.ts`; CI calls it via `pnpm test:screenshots:free` + `:extra` + `:local-assets`.

## What CI actually runs

See `.github/workflows/ci.yml`. The chain (post-PRD A9 install-once):

1. `install` job — `pnpm install --frozen-lockfile` once, uploads `node_modules.tar.zst` artifact.
2. `check` matrix — `lint`, `typecheck`, `build`, `test`, `test:coverage:enforce` (each downloads + restores the artifact).
3. `browser-free` — runs the FREE browser visuals (gated until RB bootstrap lands in CI).
4. `docs` + `docs-site` — vitepress + Astro Starlight builds.
5. `package` — `audit`, `test:assets`, `test:workspace`, `test:workflows`, `build`, `test:cli`, `expectations`, `test:package`, `test:consumer`, `pack:dry-run`.
6. `dependency-review` — fail-on-severity: high.
7. `semgrep` — OWASP Top 10 + Node.js SAST.

All of this runs locally via `pnpm verify` (PRD G4 keeps them at parity).
