---
status: implemented
last_verified: 2026-05-23
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
  - packages/medieval-hexagon-gameboard/src/manifest/free.ts
  - packages/medieval-hexagon-gameboard/src/types.ts
  - packages/medieval-hexagon-gameboard/src/gameboard.ts
  - packages/medieval-hexagon-gameboard/src/ingest.ts
  - packages/medieval-hexagon-gameboard/src/koota.ts
  - scripts/audit-free-assets.ts
  - scripts/audit-reference-assets.ts
test_links:
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
  stack index, EXTRA requirement, and metadata such as `feature: "harbor"`.
- Koota traits mirror those tile and placement records so consumers can query
  roads, rivers, coasts, structures, harbors, stacked terrain, and local-only
  EXTRA placements without reparsing filenames.
