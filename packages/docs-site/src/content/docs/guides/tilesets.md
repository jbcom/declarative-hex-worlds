---
title: Tilesets
description: Declare a sprite-sheet tileset, resolve biomes to cells, and render seamless painterly hex terrain in three.js or canvas-2D.
sidebar:
  order: 5
---

A **tileset** renders each hex as a cell of a sprite sheet — a painterly 2D/2.5D
alternative to the 3D GLTF model path. It's how you get continuous, illustrated
terrain (grass, coast, mountains) instead of discrete meshes. The same declared
tileset drives both the three.js and canvas-2D bindings.

## The manifest

A tileset is described by a `TilesetManifest`: named **sheets** (each a PNG with a
cell grid) and a **biome → sheet** map.

```ts
import { parseTilesetManifest } from 'declarative-hex-worlds/asset-source';

const manifest = parseTilesetManifest({
  schemaVersion: '1',
  kind: 'tileset',
  sheets: {
    grassland: {
      url: '/assets/tilesets/grassland.png',
      // The sheet is a cols×rows grid of cellWidth×cellHeight px cells.
      grid: { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 },
      role: 'fill',
    },
    coast: {
      url: '/assets/tilesets/coast.png',
      grid: { cols: 4, rows: 4, cellWidth: 64, cellHeight: 64 },
      role: 'transition',
      // A transition sheet maps an edge mask → a specific cell index.
      edgeCells: { '5': 3, '10': 7 },
    },
  },
  biomes: {
    meadow: { sheet: 'grassland', select: 'hash' }, // pick a fill cell by tile-key hash
  },
});
```

- **`role: 'fill'`** — cells are interchangeable variations of one biome; `select`
  is `'hash'` (stable per-tile pick) or `'first'`.
- **`role: 'transition'`** — cells are positional; an edge mask selects a specific
  cell via `edgeCells` (see [Transitions](#transitions)).

`parseTilesetManifest` throws a precise Zod error on a malformed manifest, so bad
data fails at the boundary, not deep in rendering.

## The source

`createTilesetSource` turns the manifest into an `AssetSource` — the neutral
resolution seam a binding dispatches on:

```ts
import { createTilesetSource } from 'declarative-hex-worlds/asset-source';

const source = createTilesetSource({ manifest });
// resolve a placement (its metadata.biome or assetId names the biome) → a
// { type: 'tileset-cell', shape: 'quad', cell, hex, sheetUrl } render request.
```

Options:

- **`shape`** — `'quad'` (default) draws the full cell as a rectangle; painterly
  hex atlases paint each cell as a hex with transparent corners, so a full quad lets
  neighbours' opaque bodies fill each other's corners into **seamless** terrain.
  `'hex'` clips to a hexagon (only for cells that are opaque edge-to-edge).
- **`hex`** — override the world footprint of a cell (see
  [Seamless tessellation](#seamless-tessellation)).

## Rendering with `<HexWorld>` (three.js)

The declarative element layer registers the source and renders the cells:

```tsx
import { Canvas } from '@react-three/fiber';
import { parseTilesetManifest, tilesetHexGeometry } from 'declarative-hex-worlds/asset-source';
import { HexWorld, Tileset, Tile, GameboardObjects } from 'declarative-hex-worlds/react-elements';

function Board({ plan, textureLoader }) {
  const geometry = tilesetHexGeometry(manifest); // see below
  return (
    <Canvas>
      <HexWorld plan={plan} textureLoader={textureLoader} geometry={geometry}>
        <Tileset manifest={manifest} />
        <Tile at="0,0" assetId="meadow" biome="meadow" />
        {/* …one <Tile> per hex, or let a projected plan carry the biomes… */}
        <GameboardObjects />
      </HexWorld>
    </Canvas>
  );
}
```

- **`<Tileset manifest>`** registers the source. Pass `hex` to override the cell
  footprint.
- **`<Tile at biome>`** declares a hex's biome. The biome is carried on the
  placement's `metadata.biome`, which survives the tile→runtime→projection
  round-trip (a biome baked only into a *plan* placement's `assetId` is re-derived
  away — declare it via `<Tile>` or the tile's terrain).
- **`<GameboardObjects>`** is the render bridge: it reconciles each resolved cell
  into a textured-hex mesh every frame. It is required — `<Tileset>` alone
  registers the source but draws nothing.
- **No GLTF `loader`** is needed for a tileset-only board — only a `textureLoader`
  (a three `TextureLoader` wrapped to report the sheet's pixel size; see
  `GameboardSheetTextureLoader`).

## Rendering with canvas-2D

The `/canvas2d` binding draws the same declared source with zero renderer deps —
`drawImage` blits each cell onto a 2D context:

```ts
import { syncCanvas2dPlacements } from 'declarative-hex-worlds/canvas2d';

syncCanvas2dPlacements(ctx, plan.placements, { source, sheets });
```

Its existence is the proof the resolution seam is substrate-agnostic: one declared
tileset, two renderers.

## Seamless tessellation

Painterly hex atlases bake a **vertically-foreshortened** (isometric) hex into each
cell — e.g. a 96×83 cell is a pointy hex squashed from its regular 96×110. Two
knobs make such cells tessellate into continuous terrain:

- **`tilesetHexGeometry(manifest)`** derives the board *placement* geometry (row
  spacing) from the cell aspect, so rows pack tight enough to interlock. Pass it to
  `<HexWorld geometry>` (or `projectWorldToGameboardPlan(world, { geometry })`), and
  use the **same** geometry for any unit/overlay coordinate conversion so they share
  the board's space.
- The default cell footprint oversizes the quad past the grid pitch so the
  alpha-cutout hexes overlap into seamless terrain. The material uses `alphaTest`
  (a hard cutout) so a cell's transparent corners never occlude the neighbour behind
  them.

## Transitions

A coast/river/road tile carries a non-zero `metadata.edgeMask`. The source's
`resolveEdge(assetId, edgeMask)` selects the positional transition cell for that
mask via the sheet's `edgeCells`; both the three and canvas-2D bindings dispatch
through `resolveEdge` before the plain fill resolve, so transition art renders in
place of a flat fill tile.

## From a scanned or downloaded pack

`createTilesetSource` takes a hand-authored manifest, but you can also build a
source from a scanned/downloaded [`AssetSourceSpec`](/declarative-hex-worlds/guides/cli-reference/)
(the `bind` CLI output, or a bundled pack) via `createSourceFromSpec(spec)` — it
maps the spec's `tileset`-role assets into the tileset source and composites them
with any model sources.
