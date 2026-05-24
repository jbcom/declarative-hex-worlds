# Medieval Hexagon Gameboard

This documentation is the source of truth for the package implementation.
Every pillar carries frontmatter with source images, source pack, implementation
links, and test links. `pnpm test:docs-contract` validates those links before
docs deployment and release.

![KayKit Medieval Hexagon guide montage](/assets/kaykit-guide/montage.png)

## Guides

- [Public API guide](./guides/public-api.md)
- [Guide scenario coverage](./guides/guide-scenario-coverage.md)
- [Runtime integration](./guides/runtime-integration.md)
- [Recipes, scenarios, and simulation](./guides/recipes-scenarios-and-simulation.md)
- [Rendering, assets, and external packs](./guides/rendering-assets-and-external-packs.md)

## Pillars

- [Library charter](./pillars/00-library-charter.md)
- [Tiles and connectivity](./pillars/01-tiles-connectivity.md)
- [Asset taxonomy](./pillars/02-asset-taxonomy.md)
- [Editions and ingest](./pillars/03-editions-and-ingest.md)
- [Visual verification](./pillars/04-visual-verification.md)
- [Koota runtime rules](./pillars/05-koota-runtime-rules.md)

## Generated API

TypeDoc generates the API reference during `pnpm docs` and `pnpm docs:build`.
The generated `docs/api/` output is ignored locally and rebuilt by CI for docs
deployment.
