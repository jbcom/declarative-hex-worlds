---
title: Continuous terrain
description: Seamless procedural or measured terrain under a hex board — height fields, biome painting, scatter, drainage, roads and per-hex summaries.
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
  routeNetwork,
  sampleHeight,
  scatterPoints,
  traceDrainage,
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
const historical = inpaintHeightField(measured, quarryOutline, {
  feather: 20,
  detail: { seed: 'quarry', wavelength: 12 },
});
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
    {
      kind: 'inpaint',
      polygon: quarryOutline,
      feather: 20,
      detail: { seed: 'quarry', wavelength: 12 },
    },
  ],
});
```

### Restoring the grain

A harmonic fill is smooth, and measured ground never is: left alone, the
erased patch shows from the air as a featureless blotch. Pass `detail` and
seeded fractal noise is laid over the fill so it reads like the ground around
it:

- `amplitude: 'match'` (the default) measures the grain of the known ground in
  a band just outside the region (two wavelengths wide) and scales the noise to
  that RMS. A number is instead the noise's nominal amplitude in world units,
  as for a `noise` layer, and needs no surrounding ground to measure.
- `wavelength` is the size of the features to restore, in world units
  (default: eight sample spacings). Set it to the scale of the grain you can
  see in the data, such as the hummocks of a pasture or the chatter of a
  ploughed field.
- `seed` makes the grain reproducible: the same seed always gives the same
  field, byte for byte.

The relief fades in from nothing at the region's edge to full strength one
wavelength inside, so the fill still meets the ground around it exactly and
nothing outside the region changes. Grain is measured with a four-point
stencil (`h` minus the mean of the samples a quarter wavelength away along X
and Z), which is zero on any plane, so a steep hillside or the truncated view
next to the excavation never counts as relief. If no known sample is left to
measure (a region covering nearly the whole field), `'match'` throws; give an
explicit `amplitude` instead.

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
  or `ridge` layer after the fill. `detail` restores grain, not landforms.
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

Many bounded paints are cheap too. An `area` or `line` paint can only cover
samples near its shape (the polygon or polyline grown by its feather, and by
its warp amplitude), so `classifyBiomes` works out per row which columns a
paint can reach and never evaluates it elsewhere. A 640 × 790 board with two
slope bands and twenty warped roads paints in well under a second instead of
tens of seconds, and the result is byte-identical to evaluating every paint at
every sample. Bands and noise are unbounded, so a paint made only of those
still covers the whole grid.

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

## Drainage

`traceDrainage` finds the streams a height field implies — where water would
gather and run — as a branching network of polylines.

```ts
const drainage = traceDrainage(terrain, { minContributingArea: 80_000 });
for (const channel of drainage.channels) {
  drawStream(channel.points, { width: 0.6 + 0.9 * channel.order });
}
```

Depressions are filled first (priority-flood), so every sample drains to the
field's edge. Flow then runs from each sample to one neighbour: on slopes by
**D8-LTD**, which alternates between the two neighbours bracketing the true
downhill direction, so streams follow the slope instead of snapping to the
45° lines of plain D8; across flats — filled ponds, levelled ground — along
the flat's middle to its outlet. Each sample contributes one cell of area to
everything downstream, and samples whose `accumulation` (in world units²)
reaches `minContributingArea` are stream.

Each `DrainageChannel` runs from its source down to where it joins a larger
stream (or leaves the field), carrying its **Strahler `order`** and the
contributing area at every point (`areas`, non-decreasing downstream). A
stream keeps flowing through confluences with smaller tributaries, so main
stems come out whole; a tributary's mouth lies exactly on the stem it joins.
Polylines are simplified (`simplifyTolerance`, default one sample spacing)
to remove grid stair-steps, split into pieces of at most two spacings and
smoothed (`smoothing` Chaikin passes, default 2), so bends round off locally
rather than cutting across valley sides.

`drainage.filled` is the depression-filled surface. Where it stands above the
terrain the ground holds water: paint `filled − heights` above a small depth
as ponds, so a stream crossing a filled hollow reads as one.

**Carved beds.** `carveDrainage(field, channels, { depthFor, halfWidthFor })`
returns a copy of the field with a bed cut along every channel, its depth and
half-width chosen per point from contributing area and order; overlapping
beds take the deepest cut. Or feed channels to composition as layers:
`channels.map((c) => ({ kind: 'channel', line: c.points, depth, halfWidth }))`.

## Roads

`routeAcrossTerrain(field, from, to, options)` finds a least-cost road over
the field's sample grid and returns it as a smoothed polyline that starts and
ends exactly on the requested points, with its total `cost` and `length` —
or `null` when impassable ground separates them.

A step of length `d` and grade `g` (rise over run) costs
`d × ((1 + slopePenalty × g²) × prefer + extra)`, integrated along the step:

| Option | Effect |
| --- | --- |
| `slopePenalty` | Weight of grade² (default 100: a 10 % grade doubles the cost). Higher values make roads follow contours. |
| `maxGrade` | Steps steeper than this are impassable. |
| `avoid` | Polygons adding `extraCost` per unit, or `impassable`. |
| `groundCost(x, z)` | Any per-position added cost (marsh, ponds, woods); `Infinity` blocks. |
| `prefer` | Lines (field boundaries, old lanes) that lower the cost by up to `discount` within a `corridor`. |
| `water`, `crossingCost` | Streams to cross; each crossing costs `crossingCost`. Pass drainage channels here. |
| `neighbours` | 8, 16 (default) or 32 grid neighbours; 16 adds knight moves, so headings change in ~27° steps rather than 45°. |
| `simplifyTolerance`, `smoothing` | Shaping of the returned polyline (defaults: half a spacing, 3 Chaikin passes). |
| `maxExpansions` | Caps the search; exceeding it throws. |

The search is A* with a consistent heuristic (straight-line distance times
the cheapest per-unit cost), so the path is optimal for the cost model, and
ties break by sample index, so it is deterministic.

`routeNetwork(field, sites, options)` joins sites — farms, a village, a mill —
into a tree: the minimum spanning tree (Kruskal) of their pairwise route
costs. Links are built cheapest first, and ground under each built road costs
`reuseDiscount` (default 0.6) less for the next, so later roads merge onto
earlier ones. The result lists the tree's `links` and the `roads` as
segments between junctions and sites, with shared ground drawn once.

```ts
const network = routeNetwork(terrain, [village, ...farms], {
  slopePenalty: 400,
  water: drainage.channels.filter((c) => c.order >= 2).map((c) => c.points),
  crossingCost: 400,
});
```

The field's edge is a hard boundary for the search, so a road may run along
it when that is the cheapest way round a ridge or stream. Route over a field
a margin larger than the area you show.

Fields up to 2048 × 2048 samples can be routed (`MAX_ROUTE_SAMPLES`), and up
to 256 sites joined; drainage accepts up to 4096 × 4096 (`MAX_DRAINAGE_SAMPLES`).

### Drawing roads crisply

Do not draw roads, lanes or creek beds as biome weights. A weight grid
resolves a corridor only when the corridor is wider than about two sample
spacings, so a 12 m road painted on a 12 m grid breaks into beads wherever it
runs between samples. Store distance instead, and measure it exactly per
fragment:

```ts
const cells = createPolylineCells(roads, { bounds, cellSize: 64, reach: 9 });
// Upload cells.segments (4 floats each), cells.cellRanges (start, count per
// cell) and cells.cellSegments as textures; per fragment, read the cell's
// segments and take the minimum distanceToSegment, then
// road = smoothstep(halfWidth + feather, halfWidth - feather, distance).
```

`createPolylineCells` buckets the lines into a uniform grid over fixed
bounds. Each cell lists every segment within `reach` of some point of it (a
road's half-width plus its feather), so a fragment needs only its own cell's
list, never its neighbours'. `segmentLine` maps each segment to its input line
for per-road width or surface, and `maxPerCell` bounds the shader's loop.
`nearestPolylineInCells` is the same query on the CPU, for picking and tests.
The result is exact at any zoom and costs a few kilobytes, where a distance
texture fine enough for a narrow lane costs megabytes.

The polyline helpers underneath — `simplifyPolyline` (Douglas–Peucker, with
`simplifyPolylineIndices` to carry attributes), `subdividePolyline`,
`smoothPolyline` / `smoothPolylineValues` (Chaikin), `closestPointOnPolyline`
and `polylineLength` — are exported for shaping your own lines.

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
solver's relaxation factor uses a short Taylor series for the cosine, not
`Math.cos` or `Math.sin`),
and every random choice threads through `seedrandom`, so the same definition
and seed produce byte-identical fields on every engine and platform. Drainage
and routing use no randomness at all: their searches break every tie by
sample index or push order.
