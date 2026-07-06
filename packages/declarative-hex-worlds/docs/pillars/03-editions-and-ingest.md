---
status: implemented
last_verified: 2026-05-24
source_images:
  - docs/assets/kaykit-guide/pages/page-11.png
  - docs/assets/kaykit-guide/pages/page-12.png
  - docs/assets/kaykit-guide/pages/page-13.png
  - docs/assets/kaykit-guide/pages/page-14.png
  - docs/assets/kaykit-guide/pages/page-15.png
  - docs/assets/kaykit-guide/pages/page-16.png
  - docs/assets/kaykit-guide/pages/page-17.png
  - docs/assets/kaykit-guide/pages/page-18.png
source_pack: references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA
implementation_links:
  - docs/release-readiness.json
  - docs/guides/release-readiness.md
  - src/cli/cli.ts
  - src/interop/coverage.ts
  - src/ingest/ingest.ts
  - src/manifest/schema.ts
  - package.json
  - tests/contract/reference-tree-contract.test.ts
  - tests/contract/manifest-drift-contract.test.ts
test_links:
  - src/cli/__tests__/cli.test.ts
  - src/interop/__tests__/coverage.test.ts
  - src/ingest/__tests__/ingest.test.ts
  - src/manifest/__tests__/manifest.test.ts
  - tests/unit/examples.test.ts
  - tests/contract/reference-tree-contract.test.ts
  - tests/contract/manifest-drift-contract.test.ts
---

# Editions And Ingest

The FREE edition is published in the npm package. The EXTRA edition is supported
through local ingestion only. This mirrors build-time extraction workflows: a
project points the CLI at an owned pack folder and receives copied GLTF assets plus
a JSON manifest in its own output directory.

## Expected counts

- FREE GLTF model count: 221.
- EXTRA GLTF model count: 404.
- EXTRA unique generated manifest id count: 404.
- EXTRA-only generated manifest id count relative to FREE: 183.

The EXTRA source contains every FREE model plus additional buildings, props,
textures, transitions, and units. One source basename appears twice in the owned
pack: `projectile_catapult.gltf` exists in both `buildings/neutral` and
`units/neutral`. Local manifest generation preserves the FREE-compatible
`projectile_catapult` building id and exposes the unit duplicate as
`units_neutral_projectile_catapult`, so `assetsById` covers all 404 source GLTFs
without silently overwriting either asset.

## CLI responsibilities

- `doctor`: report local source availability, generated docs, and pack counts.
- `validate`: verify a source folder has the expected structure and model count.
- `manifest`: generate a manifest JSON from a source folder without copying files.
- `validate-manifest`: validate generated manifest JSON, report schema/index
  issues, and optionally write a normalized manifest copy.
- `extract` (alias `ingest`): copy GLTF assets to a destination and write a
  manifest next to them. This is the CLI face of the ingest workflow described
  in this pillar.

The same build-time behavior is public through the Node-only `./ingest` subpath.
Use it from scripts when a project wants to validate source counts, copy a GLTF
tree, or generate a manifest without spawning the CLI. Keep it out of browser
runtime imports because it uses Node filesystem APIs. `writeManifestModule`
emits edition-specific `freeManifest` or `extraManifest` names by default, with
explicit overrides for app-specific build scripts.
Run `pnpm test` on a machine with `references/` populated when changing
ingest, taxonomy, selector coverage, or EXTRA support; the reference-gated
specs (`tests/contract/reference-tree-contract.test.ts` and the ingest suites)
regenerate local FREE/EXTRA manifests and check exact IDs, category counts,
texture sets, duplicate basename handling, and EXTRA-only coverage. They
self-skip when `references/` is absent.

The EXTRA workflow never writes purchased files into the library package unless the
caller explicitly chooses an output path in their own project.

## Runtime consumption

Games that ingest EXTRA locally can import the generated JSON manifest, combine it
with `freeManifest`, and resolve URLs through `./manifest/schema`. The manifest
bundle helpers preserve FREE/EXTRA edition separation, report duplicate asset ids
when a local manifest overlaps the published catalog, and expose filtering for
categories, factions, unit styles, texture sets, and local-only assets.
`inspectMedievalHexagonManifest` and `validateMedievalHexagonManifest` are the
runtime preflight for loaded JSON manifests: they normalize valid manifests and
report schema, edition, duplicate asset id, enum, bounds, stale count, and stale
`assetsById` issues before a game builds a combined catalog.
Every CLI command that accepts `--manifest` reads through the same inspection
path. Valid manifests with stale generated indexes are normalized before use;
manifests with structural errors fail before plan, recipe, scenario, registry,
or simulation work starts.

`validateGameboardPlan`, `validateGameboardScenario`, and the `validate-plan`,
`validate-recipe`, and `validate-scenario` CLI commands can receive a manifest
catalog. With a catalog present they verify tile, placement, and scenario actor
asset ids and require placements/actors that resolve to EXTRA assets to carry
`requiresExtra`. This keeps local EXTRA usage explicit and catches missing
FREE/EXTRA manifest entries before rendering. For third-party assets that are
registered outside the KayKit manifest, the CLI accepts `--allowUnknownAssetIds`
for explicit exceptions and `--allowUnknownAssets` for open local prototyping.
