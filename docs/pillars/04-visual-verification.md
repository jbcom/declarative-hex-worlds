---
status: implemented
last_verified: 2026-05-23
source_images:
  - docs/assets/kaykit-guide/montage.png
  - docs/assets/kaykit-guide/pages/page-03.png
  - docs/assets/kaykit-guide/pages/page-04.png
  - docs/assets/kaykit-guide/pages/page-07.png
  - docs/assets/kaykit-guide/pages/page-11.png
  - docs/assets/kaykit-guide/pages/page-14.png
source_pack: references/KayKit_Medieval_Hexagon_Pack_1.0_FREE
implementation_links:
  - package.json
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

## Required review surfaces

- FREE catalog contact sheet with every published FREE model.
- Road A-M variation sheet with all six rotation inputs for each guide label.
- River A-L, curvy, crossing, and waterless sheet with all six rotation inputs
  for each rotatable guide label.
- Coast A-E and waterless sheet with all six rotation inputs for each guide
  label.
- Terrain composition sheet covering tall tiles, sloped tiles, decoration, and
  water-shader mode.
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
- EXTRA local sheets for transitions, seasonal textures, units, shipyard,
  stables/horses, workshop/siege, and unit combinations.
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
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-permutations.png`
  covering 310 guide permutation renders.
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-gameboard-recipe.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-generated-piece-recipe.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-seeded-gameboard.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-seeded-hex-gameboard.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-fixed-completed.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-seeded-completed.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-packaged-scenario.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-simulation-report.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-local-third-party-assets.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-guide-assets.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-seasonal-textures.png`
- `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-harbor-gameboard.png`
