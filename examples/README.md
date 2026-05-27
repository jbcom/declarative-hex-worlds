# Examples

Runnable consumer snippets used by the published tarball + docs site.

## What's here

| File | Type | Used by |
|---|---|---|
| `blueprint-board-usage.ts` | TypeScript runnable | Exercises the full blueprint → scenario → runtime → snapshot path. Imported by docs guides + `pnpm bench:warm-start`. |
| `blueprint-board.json` | Scenario fixture | Loaded by `blueprint-board-usage.ts` and by docs / tests. |
| `generated-piece-scenario.recipe.json` | Recipe fixture | Exercises piece declaration + generated-piece scatter. |

## What's NOT here (anymore)

SimpleRPG used to live at `examples/simple-rpg-usage.ts`. PRD R4 relocated it to `tests/integration/simple-rpg/simple-rpg.ts` because it's a test driver, not a consumer example.

## What ships in npm

Per `package.json#files`, the published tarball includes `examples/*.json` (the two JSON fixtures above) but NOT the TypeScript file (consumers use the compiled `dist/` entry via the `./examples/blueprint-board-usage` subpath). The JSON ships because docs guides link to them as live samples.

## Where the marketing examples live

The Astro Starlight docs site at [`/features/`](https://jbcom.github.io/medieval-hexagon-gameboard/features/) hosts screenshot-driven consumer examples (PRD F-Gallery): harbors, multi-depth cliffs, prop injection, cross-kit composition, determinism replay. Each page has a 30-line snippet + a screenshot + API cross-links.

For something simpler than F-Gallery, see the [Get started guide](https://jbcom.github.io/medieval-hexagon-gameboard/guides/getting-started/) — that's the canonical entry point for new consumers.

## Running

```bash
pnpm install
pnpm exec medieval-hexagon-gameboard bootstrap  # if you haven't already
pnpm exec tsx examples/blueprint-board-usage.ts
```

The script returns a `BlueprintBoardUsageSummary` you can console.log to inspect every metric the runtime computed.
