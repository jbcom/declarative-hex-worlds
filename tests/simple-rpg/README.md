# SimpleRPG — library coverage driver

A fully-functional, precisely-scoped game whose ONLY purpose is to exercise every `medieval-hexagon-gameboard` public API end-to-end. No real gameplay purpose beyond coverage.

## Layout

```
tests/simple-rpg/
  game/                       # the SimpleRPG implementation
    index.ts                  # entry — re-exports driver + (future) scenario factories
  assets-embedded/            # gitignored — contributors drop EXTRA-pack pieces here for local-only tests
  assets-bootstrap-target/    # gitignored — bootstrap CLI writes here during e2e runs (cleared between runs)
```

The bulk of the implementation today lives at `tests/integration/simple-rpg/simple-rpg.ts` (migrated from `examples/simple-rpg-usage.ts` by PRD R4). RS3 grows it into per-domain sibling modules under `game/`.

## Where the tests live

| Surface | Path | Cadence |
|---|---|---|
| Node integration | `tests/integration/simple-rpg.test.ts` (in default `pnpm test`) | every PR |
| Browser e2e — GitHub-bootstrapped | `tests/e2e/simple-rpg-ci.test.ts` (added in RS2) | scheduled CI only |
| Browser e2e — local EXTRA zip | `tests/e2e/simple-rpg-local-extra.test.ts` (added in RS2) | local with `MEDIEVAL_HEXAGON_LOCAL_REFERENCES=1` |

## API coverage matrix

Populated by RS3. The matrix maps every public symbol from `src/index.ts` to the SimpleRPG file that exercises it. APIs without a home open a directive item; they're either misplaced on the public surface or the game needs to grow a scenario.

Today's baseline (as of R4): the migrated `simple-rpg.ts` driver exercises 80+ APIs synchronously. `pnpm exec medieval-hexagon-gameboard coverage --json` ledger reports the exact list.

## Non-goals

- This is not a consumer example. Consumers learn from `docs-site/src/content/docs/features/` (PRD F-Gallery).
- This is not a benchmark. Benchmarks live at `tests/perf/`.
- This is not a visual gallery. Visual snapshots live at `tests/browser/__screenshots__/`.

SimpleRPG's only job is: *exercise every library capability so coverage stays at 100*.
