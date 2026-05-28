---
title: KayKit Pack Upstream Layout
description: Authoritative reference for the on-disk shape of the KayKit Medieval Hexagon Pack as bootstrapped by `@jbcom/medieval-hexagon-gameboard`.
---

`@jbcom/medieval-hexagon-gameboard` does not bundle KayKit asset binaries.
The CLI `bootstrap` subcommand (and the equivalent `bootstrapKayKitAssets`
programmatic API) mirrors the upstream KayKit pack tree into the consumer's
asset root at install time. This page is the authoritative description of
the upstream layout the bootstrap step understands.

## Editions

Two editions are supported:

| Edition | License        | Source                                                                              |
| ------- | -------------- | ----------------------------------------------------------------------------------- |
| `free`  | CC0-1.0        | [KayKit-Medieval-Hexagon-Pack-1.0](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0) on GitHub |
| `extra` | CC0-1.0 (purchase) | [`kaylousberg.itch.io`](https://kaylousberg.itch.io) — supplied via `--source zip`   |

## FREE edition layout

Pack folder: `KayKit_Medieval_Hexagon_Pack_1.0_FREE/`

```text
KayKit_Medieval_Hexagon_Pack_1.0_FREE/
├── Assets/
│   ├── gltf/         # mirrored by bootstrap
│   │   ├── buildings/{blue,green,red,yellow,neutral}/
│   │   ├── decoration/{nature,props}/
│   │   └── tiles/{base,coast,rivers,roads}/
│   ├── fbx/          # ignored unless --include-source-formats
│   ├── fbx(unity)/   # ignored unless --include-source-formats
│   └── obj/          # ignored unless --include-source-formats
├── Textures/
│   └── hexagons_medieval.png
├── Samples/
│   ├── sample1.jpg
│   └── sample2.jpg
├── License.txt
├── Medieval_Hexagon_UserGuide_v1.pdf
├── contents_buildings.jpg
├── contents_nature.jpg
└── contents_tiles.jpg
```

- **GLTF count:** 221 (one `.bin` companion each).
- **Categories:** `buildings`, `decoration`, `tiles`.
- **Texture sets:** `default` only.

## EXTRA edition layout

Pack folder: `KayKit_Medieval_Hexagon_Pack_1.0_EXTRA/`

```text
KayKit_Medieval_Hexagon_Pack_1.0_EXTRA/
├── Assets/
│   ├── gltf/
│   │   ├── buildings/{blue,green,red,yellow,neutral}/
│   │   ├── decoration/{nature,props}/
│   │   ├── tiles/{base,coast,rivers,roads}/
│   │   └── units/{blue,green,red,yellow}/    # EXTRA-only category
│   ├── fbx/, fbx(unity)/, obj/               # ignored unless --include-source-formats
├── Textures/
│   ├── hexagons_medieval.png
│   ├── hexagons_medieval_Fall.png            # EXTRA-only seasonal texture
│   ├── hexagons_medieval_Summer.png          # EXTRA-only
│   └── hexagons_medieval_Winter.png          # EXTRA-only
├── License.txt
├── Medieval_Hexagon_UserGuide_v1.pdf
├── contents_buildings.jpg
├── contents_nature.jpg
├── contents_tiles.jpg
├── contents_textures.jpg                     # EXTRA-only marker
└── contents_units.jpg                        # EXTRA-only marker
```

- **GLTF count:** 404 (one `.bin` companion each).
- **Categories:** `buildings`, `decoration`, `tiles`, `units`.
- **Texture sets:** `default`, `fall`, `summer`, `winter`.

## Bootstrap target layout

Both editions are mirrored under the same path on the consumer:

```text
<consumer-out>/addons/kaykit_medieval_hexagon_pack/
├── Assets/gltf/...        # mirror of the upstream gltf tree
└── .bootstrap.json        # integrity sidecar
```

`<consumer-out>` defaults to `public/assets/models/` (Vite / Next.js style),
falling back to `assets/models/` and then the current working directory. It
can be overridden with `--out` on the CLI or `BootstrapKayKitAssetsOptions.out`
in the programmatic API.

## Edition detection

The bootstrap step (and the programmatic
[`detectKayKitLayout`](https://jsr.io/@jbcom/medieval-hexagon-gameboard) helper)
identifies an edition by checking marker files plus the presence of the
`units/` directory:

| Marker / signal                                | FREE | EXTRA |
| ---------------------------------------------- | ---- | ----- |
| `License.txt`                                  | yes  | yes   |
| `Medieval_Hexagon_UserGuide_v1.pdf`            | yes  | yes   |
| `contents_buildings.jpg`                       | yes  | yes   |
| `contents_nature.jpg`                          | yes  | yes   |
| `contents_tiles.jpg`                           | yes  | yes   |
| `contents_units.jpg`                           | no   | yes   |
| `contents_textures.jpg`                        | no   | yes   |
| `Assets/gltf/units/`                           | no   | yes   |

EXTRA is tested first because its marker set is a superset of FREE's.

## Programmatic surface

```ts
import {
  KAYKIT_MEDIEVAL_FREE_LAYOUT,
  KAYKIT_MEDIEVAL_EXTRA_LAYOUT,
  detectKayKitLayout,
  kayKitLayoutForEdition,
  expectedTexturePaths,
  type KayKitUpstreamLayout,
} from '@jbcom/medieval-hexagon-gameboard/bootstrap/upstream-layout';
```

Use these to:

- Pre-flight check an extracted pack folder (`detectKayKitLayout(rootPath)`).
- Drive consumer-side validation pipelines that need the published asset
  counts (`KAYKIT_MEDIEVAL_FREE_LAYOUT.expectedGltfCount`).
- List the texture filenames an edition should have shipped
  (`expectedTexturePaths(rootPath, layout)`).
