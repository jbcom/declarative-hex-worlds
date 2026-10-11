---
title: Hex biomes as seamless ground
description: Project assigned tile biomes into normalized material weights without reclassifying terrain.
---

`projectHexBiomesToField` connects the declarative hex board to a continuous
ground renderer. It reads assigned tile biomes and emits a `BiomeField` in the
same channel order used by `packBiomeWeightsRgba`. Terrain, noise, soil and
placement rules do not run again during rendering.

```ts
import { readGameboardTiles } from 'declarative-hex-worlds/koota';
import { projectHexBiomesToField } from 'declarative-hex-worlds/terrain';

const materials = projectHexBiomesToField({
  tiles: readGameboardTiles(world),
  grid: terrain.core,
  geometry: { width: 100, depth: 200 / Math.sqrt(3), elevationStep: 1 },
  biomes: ['pasture', 'wheat', 'corn', 'woodland'],
  base: 'pasture',
  feather: 9,
});
```

The input is structural: plan tiles and snapshots of live Koota tiles both
fit. Each tile centre remains entirely in its assigned biome. Shared edges
blend equally; vertices shared by three different biomes blend into thirds.
Repeated names accumulate in one channel. Missing tiles and tiles without a
biome use the declared base, ensuring every sample has normalized weights.

`feather` is a distance **inside each hex**, in world units; the complete
transition spans both sides of a boundary. It defaults to zero for hard
boundaries and may not exceed the footprint's inradius. Non-regular hex
footprints use their actual edge planes. `origin` supplies a world-space X/Z
translation when the tile grid is offset from the renderer's grid.

The channel list must contain every assigned biome and the base. Duplicate
coordinates, duplicate channels, non-integer coordinates and invalid geometry
fail explicitly. Input objects are not mutated. Cell neighbourhoods are cached,
and a reusable Float64 blend buffer is normalized before writing Float32 render
weights, keeping a uniform material exactly constant across internal borders.

## Visual evidence

![The same country with hard and softened material boundaries](/assets/hex-biome-field.png)

`tests/browser/hex-biome-field-visual.test.ts` compares hard and softened ground
from the same seeded country. It checks normalization over every pixel and
captures `hex-biome-field.png` for inspection.

Related: [seeded biome regions](/features/biome-regions/) and
[continuous terrain](/features/continuous-terrain/).
