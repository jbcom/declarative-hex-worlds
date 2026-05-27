---
status: implemented
last_verified: 2026-05-24
source_images:
  - docs/assets/kaykit-guide/pages/page-03.png
  - docs/assets/kaykit-guide/pages/page-04.png
  - docs/assets/kaykit-guide/pages/page-07.png
  - docs/assets/kaykit-guide/pages/page-08.png
  - docs/assets/kaykit-guide/pages/page-09.png
  - docs/assets/kaykit-guide/pages/page-10.png
  - docs/assets/kaykit-guide/pages/page-13.png
source_pack: references/KayKit_Medieval_Hexagon_Pack_1.0_FREE
implementation_links:
  - docs/guides/release-readiness.md
  - src/selectors/selectors.ts
  - src/interop/coverage.ts
  - src/coordinates/grid.ts
  - src/gameboard/gameboard.ts
  - src/scenario/blueprint.ts
  - src/scenario/recipe.ts
test_links:
  - src/selectors/__tests__/selectors.test.ts
  - src/interop/__tests__/coverage.test.ts
  - src/gameboard/__tests__/gameboard.test.ts
  - tests/browser/free-visual.test.ts
---

# Tiles And Connectivity

The guide defines the road and river tiles as indexed variation sets. The library
models those variations as six clockwise edge masks, then resolves an input mask
to the nearest canonical asset plus a 60 degree Y-axis rotation.

## Tile families

- Base: `hex_grass`, `hex_grass_bottom`, `hex_grass_sloped_high`,
  `hex_grass_sloped_low`, `hex_water`.
- Roads: `hex_road_A` through `hex_road_M`, including sloped variants for A.
- Rivers: `hex_river_A` through `hex_river_L`, `hex_river_A_curvy`,
  `hex_river_crossing_A`, `hex_river_crossing_B`, and waterless variants.
- Coasts: `hex_coast_A` through `hex_coast_E` and waterless variants.
- EXTRA: `hex_transition` for two-material biome transitions.

## Edge conventions

Edges are numbered `0..5` clockwise. Selectors return the model id, rotation steps,
rotation radians, input mask, and canonical mask. Consumers can also request a
guide label directly when exact authoring control matters.

Some road and river guide labels are rotationally equivalent when reduced to
edge masks. Mask selectors intentionally return the first canonical matching
asset for a mask. Use `listGuideTilePermutations` when the consumer needs the
full guide-authored matrix: it preserves guide labels, waterless/curvy flags,
and render rotation for every road, river, curvy river, crossing, and coast
permutation used by visual coverage.

The gameboard builder uses the same edge convention for paths:

- `edgeBetween(a, b)` maps adjacent axial coordinates to a guide edge.
- `addRoadPath` uses one-edge road caps where a path enters or exits the board.
- `addRiverPath` expands one-edge endpoints into through-flow river tiles because
  the guide does not include river cap meshes.
- `addBridge` places the FREE bridge structures at authored road, river, or
  water crossings with bridge-specific metadata instead of treating them as
  anonymous neutral structures.
- `addElevationRamp` places the FREE sloped grass tiles at authored vertical
  transitions with ramp direction, facing, and source/target elevation metadata
  instead of requiring raw `hex_grass_sloped_high` or `hex_grass_sloped_low`
  placement.
- Generated road, river, and coast placements receive small deterministic Y
  offsets to avoid z-fighting when a whole placement plan is rendered directly.

## Height and water rules

Tall terrain uses `hex_grass_bottom` as a lower support tile. The guide shows that
water can either be modeled with water hex tiles or with waterless river/coast
geometry over a consumer-provided water shader.
