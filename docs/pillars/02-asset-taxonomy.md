---
status: implemented
last_verified: 2026-05-24
source_images:
  - docs/assets/kaykit-guide/pages/page-02.png
  - docs/assets/kaykit-guide/pages/page-05.png
  - docs/assets/kaykit-guide/pages/page-06.png
  - docs/assets/kaykit-guide/pages/page-10.png
  - docs/assets/kaykit-guide/pages/page-14.png
  - docs/assets/kaykit-guide/pages/page-15.png
  - docs/assets/kaykit-guide/pages/page-16.png
  - docs/assets/kaykit-guide/pages/page-17.png
  - docs/assets/kaykit-guide/pages/page-18.png
source_pack: references/KayKit_Medieval_Hexagon_Pack_1.0_FREE
implementation_links:
  - docs/guides/guide-scenario-coverage.md
  - packages/medieval-hexagon-gameboard/src/catalog.ts
  - packages/medieval-hexagon-gameboard/src/manifest/free.ts
  - packages/medieval-hexagon-gameboard/src/types.ts
  - packages/medieval-hexagon-gameboard/src/gameboard.ts
  - packages/medieval-hexagon-gameboard/src/recipe.ts
  - packages/medieval-hexagon-gameboard/src/ingest.ts
  - packages/medieval-hexagon-gameboard/src/koota.ts
  - scripts/audit-free-assets.ts
  - scripts/audit-reference-assets.ts
test_links:
  - packages/medieval-hexagon-gameboard/tests/unit/catalog.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/manifest.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/gameboard.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/koota.test.ts
  - packages/medieval-hexagon-gameboard/tests/browser/free-visual.test.ts
  - scripts/audit-free-assets.ts
  - scripts/audit-reference-assets.ts
---

# Asset Taxonomy

The source pack is organized by format, category, and subcategory. The library uses
the GLTF tree as canonical because it is small enough to publish and directly
usable in browser tooling.

## Categories

- `tiles`: base, roads, rivers, coasts, water, and EXTRA transitions.
- `buildings`: faction-colored buildings plus neutral walls, fences, bridges,
  construction, and siege projectiles.
- `decoration`: nature and props used to break up uniform terrain.
- `units`: EXTRA-only unit bodies, mounts, vehicles, ships, weapons, and accessory
  parts in neutral, full-color, and accent-color styles.

## Manifest fields

Every asset entry records edition, category, subcategory, id, family, faction,
unit style, model path, binary buffers, texture images, bounds, material slots,
file size, and source path. These fields are enough for filtering, building UI
catalogs, rendering visual contact sheets, and validating local EXTRA ingestion.
`pnpm test:assets` keeps the committed FREE asset tree honest by checking that
every GLTF is in the manifest, every BIN/PNG sidecar is referenced, manifest
counts match the taxonomy, bounds match min/max values, and NOTICE attribution
still credits KayKit under CC0-1.0.

## Reference source coverage

`pnpm test:reference-assets` verifies the exact asset inventory expected from the
local `references/` source folders without committing purchased EXTRA binaries.
The audit always checks the packaged FREE manifest and, when the gitignored
source folders are available, regenerates FREE and EXTRA manifests from source.
It also verifies `listKayKitAssetPublicTreatments()` so every source asset has an
intent-level role, guide image link, placement kind/layer, and public API helper
route. An asset that is only present in a manifest but lacks a builder, selector,
layout, or unit API path is incomplete.
`listKayKitGuideScenarios()` is the companion page-level contract: all 19
extracted guide pages map to source PNGs, covered asset ids, treatment roles,
public API surfaces, docs, and visual artifacts. The reference audit fails when
any FREE/EXTRA asset is missing from that matrix. Tooling should use:

- `listKayKitGuideScenarioTreatments(id)` for unique treatment records on a
  page.
- `listKayKitGuideScenarioAssetUsages()` for repeated page-level asset
  occurrences rendered by visual contact sheets.
- `listKayKitGuideScenarioAssetRenderRequests()` and
  `listKayKitGuideScenarioAssetRenderGroups()` for URL-resolved render queues
  and guide-page groups.
- `describeKayKitGuideScenarioCoverage(id)` for a single page report with counts
  and treatments.
- `listKayKitGuideAssetCoverages()` for the inverse map from an exact asset id
  to pages, APIs, docs, and screenshots.
- `listKayKitGuideRoleCoverages()` for the inverse map from a gameplay role to
  pages, assets, APIs, docs, and screenshots.
- `listKayKitGuidePublicApiCoverages()` for the inverse map from a builder,
  selector, or runtime API to guide pages and assets.

`summarizeKayKitGuideCoverage()` is for stable unique/occurrence counts used by
docs, CLI output, or visual-review dashboards.
`renderKayKitGuideScenarioCoverageMarkdown()` renders the committed
`docs/guides/guide-scenario-coverage.md` matrix from that same catalog data, and
`pnpm test:reference-assets` fails if the checked-in page drifts.

| Edition | Source GLTFs | Unique manifest ids | Texture sets | Categories |
| --- | ---: | ---: | --- | --- |
| FREE | 221 | 221 | default | buildings 93, decoration 68, tiles 60 |
| EXTRA | 404 | 404 | default, fall, summer, winter | buildings 129, decoration 77, tiles 61, units 137 |

The expected subcategory totals are:

- FREE buildings: 18 blue, 18 green, 21 neutral, 18 red, 18 yellow.
- EXTRA buildings: 27 blue, 27 green, 21 neutral, 27 red, 27 yellow.
- FREE decoration: 42 nature, 26 props.
- EXTRA decoration: 42 nature, 35 props.
- FREE tiles: 5 base, 10 coast, 30 rivers, 15 roads.
- EXTRA tiles: 6 base, 10 coast, 30 rivers, 15 roads.
- EXTRA units: 28 blue, 28 green, 25 neutral, 28 red, 28 yellow.

The EXTRA source includes every FREE asset plus 183 additional manifest ids. One
source basename is duplicated in the owned pack: `projectile_catapult.gltf`
exists under both `buildings/neutral` and `units/neutral`. In generated manifests,
the building keeps the FREE-compatible `projectile_catapult` id and the unit
asset is exposed as `units_neutral_projectile_catapult`, preserving all 404 source
GLTFs without an `assetsById` overwrite.
The public `neutralUnitAssetId("projectile_catapult")` helper resolves to that
unit-safe id so unit composition APIs do not accidentally spawn the building
projectile asset.

Use-case coverage in that audit is intentionally explicit:

- base, bottom, sloped, transition, and water tiles.
- roads A-M plus sloped road A high/low.
- rivers A-L, curvy A, crossings A/B, and all waterless variants.
- coasts A-E and all waterless coast variants.
- faction buildings across blue, green, red, and yellow.
- neutral bridges, construction, fences, walls, and siege projectile assets.
- nature, mountains, hills, rocks, trees, water plants, and clouds.
- props, resources, flags, crates, barrels, tools, boats, combat/range icons, and
  animal/harbor support props.
- EXTRA full/accent faction unit styles for banners, bows, cannon, carts,
  catapults, helmets, horses, projectiles, shields, ships, spears, swords, and
  base units.
- EXTRA neutral unit parts, mounts, projectiles, tools, and weapons.

## Board taxonomy

The gameboard API adds a second, intent-level taxonomy on top of asset ids:

- Tiles track terrain, elevation, base/support asset ids, road/river/coast edge
  masks, texture set, and tags.
- Placements track asset id, tile key, world position, layer, kind, rotation,
  stack index, EXTRA requirement, and metadata such as `feature: "harbor"` or
  `feature: "bridge"`, `feature: "elevation-ramp"`,
  `feature: "fortification"`, `feature: "construction-site"`, or
  `feature: "siege-projectile"`. Prop clusters add
  `feature: "prop-cluster"` with `propClusterKind`, `clusterId`, density, and
  placement-mode metadata so camps, caches, worksites, yards, and harbor
  dressing are queryable without inspecting filenames.
- Koota traits mirror those tile and placement records so consumers can query
  roads, rivers, coasts, structures, bridges, harbors, elevation ramps,
  fortifications, construction sites, siege projectiles, prop clusters, stacked
  terrain, and local-only EXTRA placements without reparsing filenames.
- Public treatment records in `catalog.ts` bridge the file taxonomy to gameboard
  intent. They classify base/support/road/river/coast/transition tiles, faction
  buildings, neutral structures, nature, props, colored units, and neutral unit
  parts, and name the API route that exercises each class. Bridge assets are
  still neutral structures in the file taxonomy, but their treatment also names
  `GameboardBuilder.addBridge` so games and docs can reach them semantically.
  Sloped grass tiles remain base tiles in the file taxonomy, but their treatment
  also names `GameboardBuilder.addElevationRamp` so vertical transitions are
  explicit. Loose props remain props in the file taxonomy, but non-flag props
  also name `GameboardBuilder.addPropCluster` and `listPropClusterAssets` so
  resource caches, worksites, training yards, stable yards, camps, and harbor
  support props have a semantic public route.
  authored and tested as ramp intent rather than anonymous tile overrides.
  Wall/fence, construction/ruin, and catapult projectile neutral structures also
  name `GameboardBuilder.addFortification`,
  `GameboardBuilder.addConstructionSite`, or
  `GameboardBuilder.addSiegeProjectile`, respectively, so towns, stables,
  workshops, and siege scenes can be authored from gameboard intent instead of
  raw neutral asset ids.
