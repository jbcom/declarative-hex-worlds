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
  - packages/medieval-hexagon-gameboard/src/koota.ts
  - scripts/audit-free-assets.ts
test_links:
  - packages/medieval-hexagon-gameboard/tests/unit/manifest.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/gameboard.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/koota.test.ts
  - packages/medieval-hexagon-gameboard/tests/browser/free-visual.test.ts
  - scripts/audit-free-assets.ts
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

## Board taxonomy

The gameboard API adds a second, intent-level taxonomy on top of asset ids:

- Tiles track terrain, elevation, base/support asset ids, road/river/coast edge
  masks, texture set, and tags.
- Placements track asset id, tile key, world position, layer, kind, rotation,
  stack index, EXTRA requirement, and metadata such as `feature: "harbor"`.
- Koota traits mirror those tile and placement records so consumers can query
  roads, rivers, coasts, structures, harbors, stacked terrain, and local-only
  EXTRA placements without reparsing filenames.
