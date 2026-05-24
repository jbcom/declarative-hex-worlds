---
status: implemented
last_verified: 2026-05-24
source_images:
  - docs/assets/kaykit-guide/montage.png
  - docs/assets/kaykit-guide/pages/page-01.png
  - docs/assets/kaykit-guide/pages/page-02.png
  - docs/assets/kaykit-guide/pages/page-03.png
  - docs/assets/kaykit-guide/pages/page-04.png
  - docs/assets/kaykit-guide/pages/page-05.png
  - docs/assets/kaykit-guide/pages/page-06.png
  - docs/assets/kaykit-guide/pages/page-07.png
  - docs/assets/kaykit-guide/pages/page-08.png
  - docs/assets/kaykit-guide/pages/page-09.png
  - docs/assets/kaykit-guide/pages/page-10.png
  - docs/assets/kaykit-guide/pages/page-11.png
  - docs/assets/kaykit-guide/pages/page-12.png
  - docs/assets/kaykit-guide/pages/page-13.png
  - docs/assets/kaykit-guide/pages/page-14.png
  - docs/assets/kaykit-guide/pages/page-15.png
  - docs/assets/kaykit-guide/pages/page-16.png
  - docs/assets/kaykit-guide/pages/page-17.png
  - docs/assets/kaykit-guide/pages/page-18.png
  - docs/assets/kaykit-guide/pages/page-19.png
source_pack: references/KayKit_Medieval_Hexagon_Pack_1.0_FREE
implementation_links:
  - docs/assets/showcases/free-blueprint-builder-showcase.png
  - docs/assets/showcases/extra-blueprint-biome-transition-showcase.png
  - docs/examples/blueprint-board.json
  - docs/guides/guide-scenario-coverage.md
  - package.json
  - packages/medieval-hexagon-gameboard/docs/showcases/free-blueprint-builder-showcase.png
  - packages/medieval-hexagon-gameboard/docs/showcases/extra-blueprint-biome-transition-showcase.png
  - packages/medieval-hexagon-gameboard/src/blueprint.ts
  - packages/medieval-hexagon-gameboard/src/cli.ts
  - packages/medieval-hexagon-gameboard/src/catalog.ts
  - packages/medieval-hexagon-gameboard/src/compatibility.ts
  - packages/medieval-hexagon-gameboard/src/three.ts
  - packages/medieval-hexagon-gameboard/src/gameboard.ts
  - packages/medieval-hexagon-gameboard/src/koota.ts
  - packages/medieval-hexagon-gameboard/src/layout.ts
  - packages/medieval-hexagon-gameboard/src/movement.ts
  - packages/medieval-hexagon-gameboard/src/pieces.ts
  - packages/medieval-hexagon-gameboard/src/quests.ts
test_links:
  - packages/medieval-hexagon-gameboard/tests/unit/blueprint.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/cli.test.ts
  - packages/medieval-hexagon-gameboard/tests/browser/free-visual.test.ts
  - packages/medieval-hexagon-gameboard/tests/browser/simple-rpg-visual.test.ts
  - packages/medieval-hexagon-gameboard/tests/scripts/assert-screenshots.ts
  - packages/medieval-hexagon-gameboard/tests/e2e/local-assets/third-party-assets.test.ts
  - packages/medieval-hexagon-gameboard/tests/browser/extra-visual.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/compatibility.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/gameboard.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/koota.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/layout.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/movement.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/pieces.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/quests.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/simple-rpg.test.ts
---

# Visual Verification

Visual coverage is part of the package contract. The tests render the guide-defined
tile permutations and catalog contact sheets in a real browser through Vitest
Browser Mode and Playwright Chromium.

Every Three.js browser render asserts renderer draw calls and triangles before a
screenshot is accepted. The package browser scripts also run
`tests/scripts/assert-screenshots.ts` after capture, parsing the PNG artifacts
directly and failing on undersized, low-variance, or visually flat screenshots.
Contact sheets are labeled at the cell level, so guide labels, rotation steps,
water/waterless modes, and public treatment roles remain visible in the artifact
instead of being implicit in test code.
The catalog also exposes `listKayKitGuideScenarios()` so each extracted guide
page has an auditable link to its source PNG, assets, public APIs, docs, and the
visual artifacts that should be reviewed. Browser contact sheets use
`listKayKitGuideScenarioAssetUsages()` for the exact page-level asset occurrence
rows, preserving repeated FREE/EXTRA uses, source paths, labels, captions, roles,
categories, and edition flags instead of manually reconstructing the guide matrix
inside tests.

## Required review surfaces

- FREE catalog contact sheet with every published FREE model.
- FREE extracted guide-page matrix with all 19 source PNGs, page titles,
  edition scopes, asset counts, and public API counts.
- FREE guide-scenario treatment sheet with every FREE asset occurrence grouped
  by extracted guide page, so review follows the decomposed README rather than
  only category sheets.
- Road A-M variation sheet with all six rotation inputs for each guide label,
  labeled by guide label, rotation, and edge mask.
- River A-L sheets with all six rotation inputs for each guide label in both
  water and waterless modes, labeled by guide label, rotation, mode, and edge
  mask.
- Curvy river and river crossing sheet covering curvy A rotations, crossing A/B,
  and water/waterless modes.
- Coast A-E sheet with all six rotation inputs for each guide label in both
  water and waterless modes.
- Terrain/public-treatment sheet covering base, bottom, sloped, water, mountain,
  hill, forest, water-plant, building, wall, bridge, prop, resource, and flag
  helpers from the extracted guide pages.
- FREE composed gameboard recipe covering elevated mountain stacks, roads,
  rivers, coasts, water, structures, and scatter using only packaged assets.
- FREE seeded random gameboard projection covering the Koota rule/generation path.
- FREE seeded hexagon gameboard projection covering the non-rectangular
  Honeycomb coordinate/generation path.
- FREE packaged generated-piece recipe example covering serializable
  `pieceDeclarations`, `pieceFills`, `layoutFills`, scatter placement, and
  rendered browser output from the exported example JSON.
- SimpleRPG fixed quest scene after completion, covering public API movement,
  actor registration, quest progression, prop/enemy collision semantics, and
  final world projection.
- SimpleRPG locked seedrandom quest scene after completion, covering deterministic
  seeded integration against the same public gameplay API, quest runtime, and
  direct `pieceRegistry`/`pieceFills` custom-piece generation path.
- SimpleRPG packaged JSON scenario scene after public API instantiation, covering
  `./scenario` composition of board recipes, actors, movement agents, and quests.
- Local-only third-party asset E2E scene covering Kenney Castle Kit shape
  compatibility warnings, prop placement suggestions, a placed Kenney round
  tower, square piece, tree, and a KayKit Adventurers rigged unit with facing and
  animation metadata loaded through Vite `@fs`, all positioned through seeded
  layout archetypes and footprint reservations instead of hard-coded tile picks.
- EXTRA local sheets for every source asset by category: all 61 tiles, all 129
  buildings, all 77 decorations, all 137 units, seasonal textures, and the
  composed harbor board.
- EXTRA guide-scenario treatment sheets covering the 791 mixed/EXTRA asset
  occurrences from guide pages 02, 11, 12, 13, 14, 15, 16, 17, and 18, grouped
  by extracted page instead of only source folder.
- EXTRA composed harbor board covering local-only shipyard/townhall/props in the
  same placement-plan renderer.

Screenshots are deterministic artifacts. Automated PNG checks guard against blank
or flat captures; manual review is still required whenever selector mappings,
manifests, loader logic, or asset generation changes.

## Latest Manual Review

2026-05-24 blueprint prop-cluster dressing verification reran the focused FREE
blueprint browser slice and the EXTRA blueprint biome showcase after adding
`propClusterDressing` to `./blueprint`. The reviewed
`free-blueprint-builder-showcase.png` and
`extra-blueprint-biome-transition-showcase.png` artifacts are nonblank,
correctly framed, and show board-scale camps, training/stable/harbor support
clusters, and denser town/port dressing compiled through public
`addPropCluster` recipe steps.

2026-05-24 prop-cluster verification reran the FREE extracted guide page and
composed gameboard browser slices plus the EXTRA pages 16-18 and harbor-board
slices after adding `GameboardBuilder.addPropCluster` and
`listPropClusterAssets`. The reviewed artifacts show resource-cache clusters in
the harbor-town board, local EXTRA harbor board dressing, and the workshop
training props on page 17, raising current guide treatment counts to 474 FREE
guide-page asset occurrences and 462 mixed/EXTRA occurrences for pages 16-18.

2026-05-24 semantic neutral-structure verification reran
`pnpm --dir packages/medieval-hexagon-gameboard run test:screenshots:free`
and `pnpm test:browser:extra` after adding
`GameboardBuilder.addFortification`, `GameboardBuilder.addConstructionSite`,
and `GameboardBuilder.addSiegeProjectile`. The reviewed
`free-guide-scenarios-by-extracted-page.png`,
`extra-guide-assets-by-public-role.png`, and
`extra-guide-scenarios-pages-16-18.png` artifacts show the wall/fence/gate,
construction/ruin/scaffold/grain/dirt, and catapult projectile assets as visual
public API coverage instead of raw neutral-structure-only entries. The current
counts are 474 FREE guide-page asset occurrences, 462 mixed/EXTRA occurrences
for pages 16-18, and 791 mixed/EXTRA guide-page occurrences overall.

2026-05-24 focused bridge/ramp verification ran
`pnpm --dir packages/medieval-hexagon-gameboard exec vitest run tests/browser/free-visual.test.ts --config vitest.browser.free.config.ts -t "extracted guide pages"`
after adding `GameboardBuilder.addBridge` and `GameboardBuilder.addElevationRamp`; the regenerated
`free-guide-scenarios-by-extracted-page.png` contact sheet was reviewed for the
474 FREE guide-page asset occurrences and bridge coverage on pages 02, 07, and
09 plus elevation-ramp coverage on pages 08 and 10.

2026-05-24 local EXTRA and third-party E2E verification also reran
`pnpm test:browser:extra` and `pnpm test:e2e:local-assets` after the ramp API
coverage update. The reviewed artifacts included the EXTRA guide role/scenario
contact sheets, seasonal texture sheet, EXTRA harbor/blueprint boards, and the
Kenney Castle Kit plus KayKit Adventurers SimpleRPG scene.

2026-05-23 verification ran `pnpm test:visual`, which serializes
`pnpm test:browser:free`, `pnpm test:browser:extra`, and
`pnpm test:e2e:local-assets`. Those commands include PNG artifact analysis after
the browser captures. The reviewed screenshots included:

- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-catalog.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-assets-by-public-role.png`
  covering every FREE asset through `listKayKitGuideAssetCoverages()` grouped by
  public treatment role.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-source-pages.png`
  covering all 19 extracted guide PNGs as source material.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-scenarios-by-extracted-page.png`
  covering the 474 FREE asset occurrences referenced by the page-level guide
  scenario matrix.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-roads-all-labels-rotations.png`
  covering all 78 road label/rotation permutations.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-rivers-all-labels-rotations-water-waterless.png`
  covering all 144 river label/rotation/water-mode permutations.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-river-curvy-crossings-all-modes.png`
  covering curvy river and crossing variants in water and waterless modes.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-coasts-all-labels-rotations-water-waterless.png`
  covering all 60 coast label/rotation/water-mode permutations.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png`
  covering the non-connectivity guide use cases through public builder helpers.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-gameboard-recipe.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-blueprint-builder-showcase.png`
  covering the public blueprint API for stacked mountain ranges, a town,
  multi-segment roads, coast/water, elevation ramps, and a harbor composition.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-generated-piece-recipe.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-seeded-gameboard.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-seeded-hex-gameboard.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-fixed-completed.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-seeded-completed.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-packaged-scenario.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-simulation-report.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-local-third-party-assets.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-decoration-nature-props.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-guide-assets-by-public-role.png`
  covering every FREE and local EXTRA asset through
  `listKayKitGuideAssetCoverages()` grouped by public treatment role.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-guide-scenarios-pages-02-15.png`
  covering 329 mixed/EXTRA guide-page asset occurrences across buildings,
  props, transitions, biomes, units, shipyard, harbors, and ports.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-guide-scenarios-pages-16-18.png`
  covering 462 mixed/EXTRA guide-page asset occurrences across stables, horses,
  workshop, siege units, and unit combinations.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-seasonal-textures.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-harbor-gameboard.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-blueprint-biome-transition-showcase.png`
  covering the public blueprint API for local EXTRA biome transition tiles,
  texture-set fills, shipyards, towns, density units, board-scale prop-cluster
  dressing, and board-scale composition.

The two blueprint showcase captures are also promoted to committed docs assets
at `docs/assets/showcases/` for VitePress and
`packages/medieval-hexagon-gameboard/docs/showcases/` for the published README.
