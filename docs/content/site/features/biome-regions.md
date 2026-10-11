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
before layout fills run. Projection preserves `TileBiome` and `TileFields`.

## Visual evidence

![Two seeded countries with coherent fields, wet corridors and woodland](/assets/biome-regions-country.png)

`tests/browser/biome-regions-visual.test.ts` isolates the generator in a canvas
and captures two buried seeds. This checks region topology before a consumer
chooses a 3D art style. It emits the package-local
`tests/browser/__screenshots__/biome-regions-country.png` and a workspace
`test-results` copy for remote artifact retrieval.

Related: [Tile biomes and fields](/features/tile-biomes-and-fields/) and
[continuous terrain](/features/continuous-terrain/).
