---
title: Asset bootstrap
description: Materialize the KayKit Medieval Hexagon GLTF asset tree under your app's asset root.
---

`@jbcom/medieval-hexagon-gameboard` is an **asset-bootstrapping** library, not
an asset-bundled one. The published npm tarball ships:

- The typed runtime, CLI, React + Three.js bindings.
- The FREE-edition `manifest.json` (metadata only — asset ids, paths,
  bounds, taxonomy, file sizes).

The KayKit GLTF binaries themselves (≈30 MB for FREE, more for EXTRA) are
fetched at install time by the CLI `bootstrap` subcommand, or by calling the
programmatic [`bootstrapKayKitAssets`](/reference/bootstrap/) API directly.

## Why bootstrap, not bundle?

- **Keeps the npm tarball lean** (~1 MB shipped vs 30+ MB if bundled).
- **Lets consumers re-use a single asset tree** across multiple apps via a
  shared `public/assets/models/` directory.
- **Avoids redistributing CC0 binary blobs** through npm's CDN.
- **Supports the purchased EXTRA edition** without forcing every consumer to
  redistribute the larger archive.

## Quick start (FREE edition, from GitHub)

```bash
pnpm add @jbcom/medieval-hexagon-gameboard
pnpm exec medieval-hexagon-gameboard bootstrap
```

The default `--out` heuristic detects:

1. `public/assets/models/` (Vite / Next.js convention) — preferred.
2. `assets/models/` (fallback).
3. The current working directory.

You can always pass `--out <path>` explicitly. After bootstrap, the tree
lives at:

```text
<out>/addons/kaykit_medieval_hexagon_pack/
├── Assets/gltf/
│   ├── buildings/{blue,green,red,yellow,neutral}/...gltf
│   ├── decoration/{nature,props}/...gltf
│   └── tiles/{base,coast,rivers,roads}/...gltf
├── Textures/
│   └── hexagons_medieval.png
└── .bootstrap.json
```

## EXTRA edition (purchased)

The EXTRA edition is sold on [kaylousberg.itch.io](https://kaylousberg.itch.io)
and ships extra `units/` GLTFs plus seasonal `hexagons_medieval_{Fall,Summer,
Winter}.png` textures. Download the zip from itch.io, then:

```bash
pnpm exec medieval-hexagon-gameboard bootstrap \
  --source zip \
  --zip ~/Downloads/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA.zip \
  --edition extra \
  --out public/assets/models
```

The CLI auto-detects the edition from the zip's layout markers and refuses to
overwrite a FREE-shaped target with EXTRA content (and vice-versa).

## Reproducible bootstraps

The integrity sidecar (`.bootstrap.json`) records:

- `schemaVersion` (currently `1.0.0`).
- `edition` (`free` or `extra`).
- `libraryVersion` (the library version that performed the bootstrap).
- `sourceUrl` (the GitHub tarball URL, or `file://` for zip sources).
- `fetchedAt` (ISO-8601 timestamp).
- `files[]` — sorted list of `{path, sha256, bytes}` for every mirrored file.

For deterministic CI builds, pass `fetchedAt` and `libraryVersion` to the
programmatic API:

```ts
import { bootstrapKayKitAssets } from '@jbcom/medieval-hexagon-gameboard/bootstrap';

await bootstrapKayKitAssets({
  source: { kind: 'github', commit: 'main' }, // pin to a specific sha for reproducibility
  out: 'public/assets/models',
  fetchedAt: '2026-01-01T00:00:00.000Z',
  libraryVersion: '1.0.0',
});
```

## Verifying an existing bootstrap

```bash
pnpm exec medieval-hexagon-gameboard bootstrap --verify --out public/assets/models
```

Re-hashes every file recorded in `.bootstrap.json` and reports any drift
(missing files, size mismatches, hash mismatches). Exits non-zero on drift —
useful as a CI step before deploys.

## Wiring the runtime to your bootstrap target

Three ways to tell the loaders where your bootstrap target lives:

```ts
// 1. Per-call (most explicit)
import { resolveManifestAssetUrl, freeManifest } from '@jbcom/medieval-hexagon-gameboard';
const url = resolveManifestAssetUrl(freeManifest.assets[0], {
  bootstrapAssetRoot: '/app/public/assets/models',
});

// 2. Process-wide (app boot)
import { setGameboardAssetRoot } from '@jbcom/medieval-hexagon-gameboard';
setGameboardAssetRoot('/app/public/assets/models');

// 3. Environment variable (Node consumers)
//    MEDIEVAL_HEXAGON_ASSET_ROOT=/app/public/assets/models
```

Resolution priority: explicit `setGameboardAssetRoot` override →
`globalThis.MEDIEVAL_HEXAGON_ASSET_ROOT` → `process.env.MEDIEVAL_HEXAGON_ASSET_ROOT`
→ default `public/assets/models`.

## Troubleshooting

### `bootstrap destination ... is not empty`

The target already contains files. Pass `--force` to wipe and re-mirror, or
pick a different `--out`.

### `zip contains the EXTRA edition but bootstrap was asked for FREE`

The zip's layout markers identify it as EXTRA. Add `--edition extra` (and
make sure you have a license / purchased copy).

### `failed to download KayKit FREE tarball ... unexpected status 404`

GitHub returned a non-2xx response. Common causes:

- Pinned `--commit <sha>` no longer exists (force-pushed or deleted).
- Temporary GitHub outage. Retry, or pass `--source zip` with a locally
  downloaded copy.

### `bootstrap verify FAILED ... hash mismatch`

A file on disk no longer matches its recorded sha256. Either a deploy
modified the tree (unlikely — the tree should be read-only after bootstrap)
or disk corruption. Re-run `bootstrap --force` to restore.

### Runtime loads 404 — wrong asset root

The runtime falls back to `public/assets/models` if no override is configured.
If you bootstrapped to `assets/models` or elsewhere, set
`MEDIEVAL_HEXAGON_ASSET_ROOT` or call `setGameboardAssetRoot(...)` at boot.

## Programmatic API

See the [`bootstrap` reference](/reference/bootstrap/) for the full surface,
including the {@link BootstrapKayKitAssetsOptions}, {@link BootstrapResult},
and {@link BootstrapSidecar} types.
