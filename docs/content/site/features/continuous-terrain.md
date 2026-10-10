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

A `HeightField` is a regular grid of heights over ground bounds (world X/Z),
with the first and last samples on the bounds' edges. Sampling is bilinear and
clamped.

`sampleHeight`, `sampleGradient`, `sampleSlope` and `sampleNormal` query it
(the last two accept an `out` object to avoid allocation in hot loops; edges
use one-sided differences); `resampleHeightField` moves it onto another grid;
`fillHeightField` rewrites it.

**Matching a renderer.** Upload the heights as a texture and sample it through
`heightFieldTextureTransform(field)`, which maps sample positions onto texel
centres; bilinear filtering then reproduces `sampleHeight` to texture
precision. A displaced triangle mesh does not reproduce it exactly — each
cell's two triangles differ from the bilinear patch by up to a quarter of the
cell's corner difference — so seat objects on bases or skirts, or draw the
mesh at least as densely as the field.

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
| `inpaint` | Erases an excavation or embankment, restoring smooth ground (see [Erasing modern earthworks](#erasing-modern-earthworks)) |
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

## Erasing modern earthworks

Measured elevation records the present, and the present has dug into the
past: quarries, cuttings, building pads, spoil heaps. `inpaintHeightField`
erases them. Give it a polygon around the disturbance and every sample inside
(plus an optional `feather` band beyond the edge) is replaced by the smooth
surface that meets the surrounding ground — the solution of Laplace's
equation with the ground outside as its boundary. Planes are reproduced
exactly, so a pit cut into a hillside is filled back to the slope, and the
fill never invents a hollow or a bump of its own.

```ts
import { inpaintHeightField } from 'declarative-hex-worlds/terrain';

// A quarry that did not exist in 1863: outline it, rim and spoil included.
const historical = inpaintHeightField(measured, quarryOutline, { feather: 20 });
```

It returns a new field and never touches the one you pass; samples farther
than `feather` outside the polygon come back byte for byte. In a composition
the same operation is a layer, applied in order with the rest:

```ts
composeHeightField({
  bounds,
  spacing: 1,
  seed: 'gettysburg',
  base: lidar,
  layers: [
    { kind: 'inpaint', polygon: quarryOutline, feather: 20 },
    { kind: 'noise', amplitude: 0.4, wavelength: 8 }, // fine grain back over the fill
  ],
});
```

Things to know:

- **Outline the whole disturbance.** Only the boundary *values* are matched, so
  any rim, bench or spoil heap left outside the polygon becomes the ground the
  fill is built from. A generous outline costs nothing: the fill reproduces the
  true ground wherever that ground was smooth. Use `feather` to swallow a rim
  that a hand-drawn outline only approximates.
- **It restores slope, not curvature.** A harmonic surface spans the outline
  like a stretched membrane. Under a wide excavation on strongly curved
  ground (a crest, a hollow) the fill is the chord, not the lost bulge.
  Outline narrowly there, or compose the missing landform back with a `hill`
  or `ridge` layer after the fill.
- **It is smoother than the ground around it.** Fine relief inside the region
  is gone. Add a small `noise` layer afterwards, as above, if the patch must
  not read as smooth from the air.
- **Field edges.** An erased region that reaches the edge of the field relaxes
  toward its in-grid neighbours only, leaving zero slope across the edge. A
  region that covers the whole field throws; one that holds no sample returns
  an unchanged copy.
- **Cost and accuracy.** The solve is successive over-relaxation in fixed
  row-major order over the region's bounding window, so a region of N samples
  across takes on the order of N sweeps. `tolerance` (default 1e-3 world
  units) bounds the remaining error against the exact harmonic surface, not
  merely the last update; `maxIterations` (default 10 000) caps the work.

## Painting biomes

`classifyBiomes` gives every sample a weight per biome, summing to one. Paints
apply in order; each blends its biome in wherever all of its conditions hold:

- `height` and `slope` bands, with feathered bounds
- `area` polygons and `line` corridors, with feathered edges
- `noise` patches above a threshold

A paint's optional `warp` bends its spatial conditions with noise so drafted
polygons read as natural woodlot and field edges. Renderers blend ground
materials by the weights — `packBiomeWeightsRgba` packs four biomes per RGBA8
texture layer (channels are rounded independently, so renormalise by their
sum in the shader) — so no grid ever shows.

Long roads and streams are cheap: corridor conditions and ridge and channel
layers query a bucketed `createPolylineIndex`, so a field of a million
samples tests only the segments near each sample.

## Scatter

`scatterPoints` is seeded Poisson-disc sampling: every point at least
`minSpacing` from every other, thinned by a density function (for example the
woods weight squared). Each point carries a stable `variant` in [0, 1) for
picking species, size or rotation; thinning never reshuffles the variants of
the points that survive. `maxPoints` keeps an even subsample (the lowest
variants) rather than the first points generated.

## Fields and boundaries

Settled country is a patchwork of fields, not noise. `generateParcels`
divides a rectangle or convex polygon into parcels near a mean area, cutting
across or along each piece's minimum-area oriented box — whichever brings the
halves nearer a preferred `aspect` — so fields come out as surveyed-looking
blocks and strips at varied orientations. Each parcel has a stable `variant`
for picking its crop or land use; paint parcels as biome `area` conditions.

`parcelBoundaries` turns the parcels into a deduplicated edge network
(vertices merged within a tolerance, T-junctions split), each edge listing
the one or two parcels it separates. Lay fences, walls and hedges along its
edges, and route lanes through it so roads follow field boundaries.

## Hexes

`hexesCoveringBounds` lists the hexes whose centres fall inside bounds (grown
or shrunk by an optional margin), and `projectTerrainToHexes` summarises the
ground under each — mean height, the lowest and highest sampled height, mean
slope, biome shares and the dominant biome — from a fixed 19-point pattern
that reaches 95 % of the way to the hexagon's corners and edges, scaled by the
geometry's width and depth. Feed those into movement costs, cover and line of
sight.

## Determinism

Only arithmetic, comparisons and `Math.sqrt` touch the data (the in-painting
solver's relaxation factor comes from a short Taylor series, not `Math.sin`),
and every random choice threads through `seedrandom`, so the same definition
and seed produce byte-identical fields on every engine and platform.
