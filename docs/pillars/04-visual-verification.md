---
status: implemented
last_verified: 2026-05-23
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
  - package.json
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
visual artifacts that should be reviewed.

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
- EXTRA guide-scenario treatment sheets covering the 780 mixed/EXTRA asset
  occurrences from guide pages 02, 11, 12, 13, 14, 15, 16, 17, and 18, grouped
  by extracted page instead of only source folder.
- EXTRA composed harbor board covering local-only shipyard/townhall/props in the
  same placement-plan renderer.

Screenshots are deterministic artifacts. Automated PNG checks guard against blank
or flat captures; manual review is still required whenever selector mappings,
manifests, loader logic, or asset generation changes.

## Latest Manual Review

2026-05-23 verification ran `pnpm test:visual`, which serializes
`pnpm test:browser:free`, `pnpm test:browser:extra`, and
`pnpm test:e2e:local-assets`. Those commands include PNG artifact analysis after
the browser captures. The reviewed screenshots included:

- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-catalog.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-source-pages.png`
  covering all 19 extracted guide PNGs as source material.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-scenarios-by-extracted-page.png`
  covering the 459 FREE asset occurrences referenced by the page-level guide
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
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-guide-scenarios-pages-02-15.png`
  covering 329 mixed/EXTRA guide-page asset occurrences across buildings,
  props, transitions, biomes, units, shipyard, harbors, and ports.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-guide-scenarios-pages-16-18.png`
  covering 451 mixed/EXTRA guide-page asset occurrences across stables, horses,
  workshop, siege units, and unit combinations.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-seasonal-textures.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-harbor-gameboard.png`
