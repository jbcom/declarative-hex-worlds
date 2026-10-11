---
title: Seeded biome regions
description: Coherent hex biomes grown from field-driven sources, with protected campaign pins.
---

Randomly colouring tiles produces noise. `generateGameboardBiomeRegions` grows
connected regions from seeded or explicit sources over the hex neighbour graph.
The consumer supplies its biome vocabulary, environmental fields and affinities.
The generator contains no crop, climate or historical assumptions.

```ts
import { generateGameboardBiomeRegions } from 'declarative-hex-worlds/core';

const { plan: country, report } = generateGameboardBiomeRegions(plan, {
  seed: `${plan.seed}:biomes`,
  fill: 'pasture',
  edgeNoise: 0.12,
  biomes: [
    {
      biome: 'woodland', target: 0.2,
      sources: { count: 4, spacing: 6 },
      suits: [{ field: 'slope', from: 0.05, to: 0.3, weight: 2 }],
      minRegion: 4,
    },
    {
      biome: 'wheat', target: 0.3,
      sources: { tiles: farmsteadCoordinates },
      requires: [{ field: 'slope', max: 0.12 }],
    },
  ],
  affinity: [{ a: 'wheat', b: 'wheat', weight: 0.4 }],
});
```

Numeric fields can come from `applyTerrainHexesToPlan` or the game's own
calculations. Hard `requires` bands are inclusive, and an absent field fails.
Suitability bands interpolate from zero at `from` to `weight` at `to`, clamped
at either end; reversing the endpoints expresses a falling preference.
Positive neighbour affinity attracts a frontier, and negative affinity repels
it. Same-biome affinity encourages compact regions.

Automatic sources are suitability-weighted seeded draws, subject to their
minimum hex spacing. Signed suitability totals are shifted into positive draw
weights, so penalties influence source placement as well as frontier growth.
Every selected eligible source is planted before growth.
Explicit sources allow fields to grow from settlements; multiple biomes can
start beside the same pinned farmyard. The generator never searches across an
unsuitable barrier to satisfy a percentage. Inspect `report.biomes` for each
biome's requested and reached **unpinned tile counts**, source coordinates and
final component sizes. Region sizes include pinned tiles. Undersized unpinned
components dissolve into the fallback biome; components containing pins stay.

## Patchwork fields: `maxRegion` and `regionField`

One combined frontier per biome grows blobs: a crop with a `0.32` target
becomes a few huge fields. Real farm country is a patchwork of small plots
side by side. Set `maxRegion` on a rule to grow that instead, and `regionField`
on the stage to learn which tile belongs to which plot.

```ts
const { plan: country, report } = generateGameboardBiomeRegions(plan, {
  seed: `${plan.seed}:farms`,
  fill: 'pasture',
  regionField: 'plot',
  biomes: [
    {
      biome: 'wheat', target: 0.32,
      sources: { count: 4, spacing: 5 },
      requires: [{ field: 'slope', max: 0.12 }],
      minRegion: 3, maxRegion: 7,
    },
    { biome: 'corn', target: 0.2, sources: { count: 3 }, minRegion: 3, maxRegion: 7 },
  ],
});
// country.tiles[n].fields.plot is the plot id (1, 2, 3, ...) of a claimed tile.
// report.biomes.wheat.fields is the number of surviving wheat plots.
```

Both options are additive. With neither set the output is byte-identical to
earlier releases.

**`maxRegion`** (positive integer, at least `minRegion`):

- Every source grows its own region with its own frontier, and a region stops
  claiming at `maxRegion` tiles. Explicit `sources.tiles` are the first regions,
  in order, then seeded `sources.count` sites.
- Biomes still take turns, one claim each, so no crop starves another. Within a
  biome the regions take turns in creation order, skipping capped or boxed-in
  ones.
- When every region of a biome is capped or boxed in and its target is unmet,
  the biome plants a **new region**: the best free eligible tile that touches a
  tile this stage already claimed (any biome), so the patchwork stays
  contiguous. Candidates are ranked by suitability with the same keyed seeded
  draw as automatic sources, with ties broken by tile key, so tile input order
  is irrelevant. When no free eligible tile touches claimed land, the best free
  eligible tile anywhere is used. The biome stops when none remains, and
  `report` shows the shortfall.
- Affinity and `edgeNoise` shape each region's frontier exactly as before.
- `report.biomes[x].sources` lists the initial sources, not the sites of regions
  planted later.

**`minRegion` with `maxRegion`** is judged **per region**. Without a cap it
judges each connected component, which is the right test for blobs. Patchwork
fields routinely touch, so two undersized two-hex fields would add up to a
component that survives. Per-region judgement matches the docs' promise that
undersized fields dissolve. A region that continues a same-biome pinned or
earlier-stage tile is still kept, as components containing pins are without a
cap.

**`regionField`** names a tile field (non-empty, not `__proto__`,
`constructor` or `prototype`). Every tile a region of this stage claims gets
`fields[regionField] = id`: a positive integer, unique per region, numbered from
one in creation order across the stage (biomes in rule order). The id is merged
into the tile's existing fields, which stay name-sorted. Fill tiles, pinned
tiles and tiles reserved by earlier stages keep their fields untouched. Two
neighbouring fields of the same crop have different ids, so a renderer can
draw a fence wherever neighbours disagree. A biome without `maxRegion` numbers
its connected components; regions that were dissolved by `minRegion` receive no
id and ids stay dense.

Stages that write the same `regionField` never collide: each stage numbers its
regions past the highest value already in that field on the plan's tiles, which
`applyGameboardBiomeRegionStages` and recipe generation both rely on. Use a
different field name when stages should be numbered independently.

`report.biomes[x].fields` counts the surviving regions of a biome. It is
present when the rule sets `maxRegion` or the stage sets `regionField`, and it
equals the number of ids written for that biome.

## Recipes, campaigns and Koota

Put stages in `recipe.generation.biomeRegions`. They run in array order before
placement fills, so layout rules can select their generated biome and fields.
Each later stage preserves earlier non-fallback biome assignments and grows
only over the remaining free tiles. Target shares are computed over that
remaining area. The temporary reservations do not create authored pin flags.
Authored `GameboardTileSpec.pinned` flags are protected throughout the generation
block, including stages combined by `mergeGameboardRecipes`. Use the builder's
`setBiome(at, biome).pinTile(at)` or the recipe's `setBiome` and `pinTile` steps
to author a fixed orchard, road or other historical tile. A pinned tile without
a biome retains that absence, along with all its fields and other state.
Explicit edits and `setTilePinned` remain available through the canonical pin
API; region stages do not introduce a second pin representation.

Use a different namespaced seed for each stage. Random draws are keyed by
stage seed, biome and tile; reversing the input tile array does not change the
result. Skipping one stage does not consume random draws belonging to another.
The pure compiler supports region stages without Koota; layout placement fills
still require the runtime tier. Runtime recipe generation reads the current
Koota tile fields and writes each generated biome through `setTileBiome`
before layout fills run, along with any `regionField` ids. Projection preserves
`TileBiome` and `TileFields`.

## Visual evidence

![Two seeded countries with coherent fields, wet corridors and woodland](/assets/biome-regions-country.png)

`tests/browser/biome-regions-visual.test.ts` isolates the generator in a canvas
and captures two buried seeds. This checks region topology before a consumer
chooses a 3D art style. It emits the package-local
`tests/browser/__screenshots__/biome-regions-country.png` and a workspace
`test-results` copy for remote artifact retrieval.

Related: [Tile biomes and fields](/features/tile-biomes-and-fields/) and
[continuous terrain](/features/continuous-terrain/).
