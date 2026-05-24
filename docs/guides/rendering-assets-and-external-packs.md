# Rendering, Assets, And External Packs

The published package ships the FREE KayKit assets and manifest. Purchased EXTRA
assets and third-party fixtures stay local-only unless an application chooses to
copy its own generated manifest and source URL map into its codebase.

## FREE Assets

Use `freeManifest` for packaged assets. It includes asset ids, categories,
subcategories, factions, texture sets, bounds, material slots, local package
paths, and KayKit license metadata.

```ts
import { freeManifest } from '@jbcom/medieval-hexagon-gameboard/manifest/free';
import {
  createManifestBundle,
  getManifestAsset,
  resolveManifestAssetUrl,
} from '@jbcom/medieval-hexagon-gameboard/manifest/schema';

const bundle = createManifestBundle([freeManifest]);
const asset = getManifestAsset(bundle, 'hex_river_A');

const url = asset
  ? resolveManifestAssetUrl(asset, {
      baseUrl: '/node_modules/@jbcom/medieval-hexagon-gameboard/assets/free',
    })
  : undefined;
```

Browser bundles often rewrite package asset URLs. Keep that mapping at the app
boundary instead of baking local absolute paths into manifests.

Use `describeKayKitAssetTreatment(assetId)` from `./catalog` when an editor or
tool needs to explain what an asset is for. Treatment records connect each
FREE/EXTRA asset id to a role, placement kind/layer, extracted guide image, and
the public builder or selector API that exercises it. This prevents an asset
from being merely present in a manifest without a gameboard-facing path.
Use `listKayKitGuideScenarios()` when the tool needs the page-level source
contract: each extracted guide page lists its source PNG, covered assets, public
APIs, docs, and visual artifacts. Use `listKayKitGuideScenarioTreatments(id)` or
`describeKayKitGuideScenarioCoverage(id)` to join a page back to the asset
treatment records, `listKayKitGuideAssetCoverages()` when a tool needs to start
from an exact asset id, `listKayKitGuideRoleCoverages()` when it needs to start
from a gameplay role, `listKayKitGuidePublicApiCoverages()` when it needs to
start from a public API surface, and `summarizeKayKitGuideCoverage()` when a
build tool or editor needs stable counts for pages, editions, roles, unique
assets, repeated page-level asset occurrences, docs, and visual artifacts.

## EXTRA Assets

EXTRA assets are supported through local ingest. They must not be published by
this package. Apps that own the assets can generate an app-local manifest and
combine it with the packaged FREE manifest:

```ts
import { freeManifest } from '@jbcom/medieval-hexagon-gameboard/manifest/free';
import { createManifestBundle } from '@jbcom/medieval-hexagon-gameboard/manifest/schema';
import extraManifest from './generated/kaykit-extra-manifest.json';

const bundle = createManifestBundle([freeManifest, extraManifest]);
```

Every placement that points at an EXTRA asset should keep `requiresExtra: true`.
That lets validation and renderers distinguish missing local content from
package bugs.

## Three.js Bridge

The `./three` subpath is a thin bridge around public board state. It does not
own the game loop. Use it to:

- resolve a placement to a loadable URL.
- load GLTFs with an app-provided loader.
- apply position, rotation, scale, and placement metadata.
- keep a scene in sync with added, changed, and removed placements.
- tag objects so raycasts can resolve placement ids, tile keys, actor ids, and
  source asset ids.
- attach optional animation clips for rigged units.

```ts
import {
  createGameboardPlacementAssetUrlResolver,
  gameboardInteractionTargetForObject,
  syncGameboardPlacementObjects,
} from '@jbcom/medieval-hexagon-gameboard/three';

const sourceAssetUrls = runtime.createScenarioPieceSourceUrlMap({
  sourceRoots: { 'Kenney Castle Kit': '/assets/kenney/castle-kit' },
});
const resolveAssetUrl = createGameboardPlacementAssetUrlResolver({
  catalog: manifestBundle,
  assetUrls: sourceAssetUrls,
  baseUrl: '/assets/kaykit/free',
});
const previewUrl = resolveAssetUrl(runtime.plan().placements[0]);

const sync = await syncGameboardPlacementObjects(runtime.plan().placements, {
  parent: scene,
  loader,
  catalog: manifestBundle,
  assetUrls: sourceAssetUrls,
  baseUrl: '/assets/kaykit/free',
});

const target = gameboardInteractionTargetForObject(raycasterHit.object);
```

Animation loading is explicit because different games manage mixers and clips
differently. The bridge exposes clip metadata so an app can connect the loaded
clips to its own animation system.

## External Compatibility

Run compatibility checks on local GLB/GLTF files before registering them as
pieces. A mesh that is not a KayKit-compatible hex tile can still be useful as a
prop, landmark, building, tree, scatter item, or unit.

```bash
medieval-hexagon-gameboard compatibility \
  --asset "references/kenney_castle-kit/Models/GLB format/tower-hexagon-base.glb" \
  --intendedRole tile \
  --sourcePack "Kenney Castle Kit" \
  --modelForward +z \
  --boardForwardEdge 1

medieval-hexagon-gameboard pieces-from-assets \
  --assets "references/kenney_castle-kit/Models/GLB format" \
  --sourcePack "Kenney Castle Kit" \
  --intendedRole tile \
  --assetIdPrefix kenney \
  --pieceIdPrefix kenney-castle \
  --tags castle \
  --pieceOverrides docs/examples/local-piece-overrides.kenney-castle.json \
  --includeReports \
  --out /tmp/kenney-pieces.json
```

The batch output omits absolute paths by default. Renderer URL maps should be
generated from local source roots at app build time:

```bash
medieval-hexagon-gameboard pieces \
  --pieces /tmp/kenney-pieces.json \
  --emitSourceUrls \
  --pieceSourceRoots docs/examples/local-piece-source-roots.example.json \
  --json
```

## Placement Criteria

Use explicit criteria for non-KayKit assets:

- towers and large structures usually need multi-tile footprints and occupancy
  reservations.
- trees and loose props should use scatter slots, `maxPerTile`, and a soft slot
  group.
- units should declare facing and animation expectations.
- circular towers, square walls, and other non-hex meshes should be props or
  landmarks unless the compatibility report proves a matching tile footprint.
- ships, docks, ports, and harbor props should target coast tiles adjacent to
  water.

This placement metadata is what lets seeded boards stay plausible while still
accepting assets from another designer.

## Browser Verification

Rendering tests should exercise public fixtures:

```bash
pnpm test:browser:free
pnpm test:browser:extra
pnpm test:e2e:local-assets
pnpm test:visual
```

Screenshots are deterministic artifacts. The test suite checks image size,
variance, and flat-output failures after Chromium captures the PNGs. When adding
new visible behavior, prefer a scenario or recipe fixture that can also be used
by CLI validation and headless simulation tests. The FREE browser suite also
captures `free-guide-source-pages.png` and
`free-guide-scenarios-by-extracted-page.png` so visual review can start from the
decomposed KayKit guide pages and then inspect every FREE treatment associated
with those pages. The EXTRA browser suite follows the same page contract through
`extra-guide-scenarios-pages-02-15.png` and
`extra-guide-scenarios-pages-16-18.png`, covering mixed and EXTRA page-level
asset occurrences for buildings, transitions, units, harbors, stables,
workshops, siege pieces, and unit combinations.
