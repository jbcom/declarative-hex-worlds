---
title: Continuous terrain
description: Seamless procedural or measured terrain under a hex board — height fields, biome painting, scatter and per-hex summaries.
sidebar:
  order: 12
---

Tile boards stack discrete pieces. Some games want the opposite: one
continuous landscape with **no visible tile edges**, where the hex grid exists
only for rules — movement, cover, line of sight. `declarative-hex-worlds/terrain`
builds that landscape and projects it onto your hexes, deterministically, with
no koota, three.js or DOM dependency.

```ts
import {
  classifyBiomes,
  composeHeightField,
  hexesCoveringBounds,
  projectTerrainToHexes,
  sampleHeight,
  scatterPoints,
} from 'declarative-hex-worlds/terrain';
```

## Height fields

A `HeightField` is a regular grid of heights over ground bounds (world X/Z).
Sampling is bilinear and clamped, so a renderer that draws the same grid with
bilinear interpolation — a displaced mesh, a height texture — agrees with
gameplay queries exactly.

`sampleHeight`, `sampleGradient`, `sampleSlope` and `sampleNormal` query it;
`resampleHeightField` moves it onto another grid; `fillHeightField` rewrites it.

## Composing terrain

`composeHeightField` starts from a constant or another field (for example a
measured elevation model) and applies layers in order:

| Layer | Effect |
| --- | --- |
| `noise` | Fractal relief (`ridged: true` for crests), by amplitude and wavelength |
| `ridge` | A raised crest along a polyline, with a `smooth`, `sharp` or `plateau` profile |
| `hill` | A mound around a point |
| `channel` | A carved bed along a polyline — streams, sunken roads, cuts |
| `flatten` | Levels a polygon toward a height, with a feathered edge |
| `scale` | Vertical exaggeration about a pivot |
| `field` | Adds another height field, weighted |

```ts
const terrain = composeHeightField({
  bounds: { minX: -1600, minZ: -1600, maxX: 1600, maxZ: 1600 },
  spacing: 20,
  seed: 'farmland',
  base: 150,
  layers: [
    { kind: 'noise', amplitude: 10, wavelength: 1400, octaves: 5 },
    { kind: 'ridge', line: ridgeline, halfWidth: 450, height: 22 },
    { kind: 'channel', line: creek, halfWidth: 90, depth: 6 },
    { kind: 'scale', factor: 2 },
  ],
});
```

## Painting biomes

`classifyBiomes` gives every sample a weight per biome, summing to one. Paints
apply in order; each blends its biome in wherever all of its conditions hold:

- `height` and `slope` bands, with feathered bounds
- `area` polygons and `line` corridors, with feathered edges
- `noise` patches above a threshold

A paint's optional `warp` bends its spatial conditions with noise so drafted
polygons read as natural woodlot and field edges. Renderers blend ground
materials by the weights — `packBiomeWeightsRgba` packs four biomes per RGBA8
texture layer — so no grid ever shows.

## Scatter

`scatterPoints` is seeded Poisson-disc sampling: every point at least
`minSpacing` from every other, thinned by a density function (for example the
woods weight squared). Each point carries a stable `variant` in [0, 1) for
picking species, size or rotation; thinning never reshuffles the variants of
the points that survive.

## Hexes

`hexesCoveringBounds` lists the hexes whose centres fall inside bounds, and
`projectTerrainToHexes` summarises the ground under each — mean, minimum and
maximum height, mean slope, biome shares and the dominant biome — from a fixed
13-point pattern across the hexagon. Feed those into movement costs, cover and
line of sight.

## Determinism

Only arithmetic, comparisons and `Math.sqrt` touch the data, and every
random choice threads through `seedrandom`, so the same definition and seed
produce byte-identical fields on every engine and platform.
