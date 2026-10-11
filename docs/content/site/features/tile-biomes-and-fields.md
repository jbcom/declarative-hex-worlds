---
title: Tile biomes and fields
description: An open biome string and named numeric channels on every tile, durable across spawn, read-back and projection.
sidebar:
  order: 5
---

## Problem

A game owns its ground vocabulary: `wheat`, `orchard`, `fallow`, `woodland`,
`marsh`. The library must carry that vocabulary on each hex without knowing
what it means, keep it when roads, rivers or hills change the tile's
`terrain`, and let later rules read both the biome and the numbers the game
computed per hex (slope, wetness, soil depth).

`terrain` cannot do this: it is overwritten by every road, river, hill and
forest. `tags` are rebuilt from `terrain` on each change. `textureSet` is a
closed union. A game's own Koota trait is lost the next time the world is
projected back to a plan.

## Snippet

```ts
import { createGameboardBuilder } from 'declarative-hex-worlds/gameboard';
import { createGameboardWorld } from 'declarative-hex-worlds/koota';
import { projectWorldToGameboardPlan } from 'declarative-hex-worlds/projection';

const plan = createGameboardBuilder({ seed: 'farm-1', shape: { kind: 'rectangle', width: 6, height: 6 } })
  .setBiome({ q: 2, r: 2 }, 'wheat')
  .setFields({ q: 2, r: 2 }, { slope: 0.04, wetness: 0.7 })
  .addRoadPath([{ q: 2, r: 2 }, { q: 3, r: 2 }]) // terrain becomes `road`; biome stays `wheat`
  .build();

const world = createGameboardWorld(plan);
const tile = projectWorldToGameboardPlan(world).tiles.find((t) => t.key === '2,2');
// tile.biome === 'wheat', tile.fields === { slope: 0.04, wetness: 0.7 }
```

## The model

- **`biome?: string`** is an open, non-empty string. The library never
  enumerates or restricts it; it only checks that it is a non-empty string.
  It is independent of `terrain`: no builder method, recipe step or rule that
  changes `terrain`, `tags`, elevation or connectivity touches it.
- **`fields?: Readonly<Record<string, number>>`** is a store of named numeric
  channels. Names are open; every value must be a finite number.
- Both are optional on `GameboardTileSpec` and `HexTileState`. A tile without
  them behaves exactly as before, and serialized plans without them remain
  valid.

Invalid values throw `GameboardValidationError` at the point they are written
(`setBiome`, `setFields`, `setTileAsset`, `setTileBiome`, `setTileFields`,
`applyTerrainHexesToPlan`), and `validateGameboardPlan` reports
`tile.invalid_biome` and `tile.invalid_field` for plans loaded from untrusted
JSON.

## Authoring

| Surface | Biome | Fields |
|---|---|---|
| Builder | `setBiome(at, biome)` | `setFields(at, fields, { replace? })` |
| Recipe step | `{ action: 'setBiome', at, biome }` | `{ action: 'setFields', at, fields, replace? }` |
| `setTileAsset` | `biome` option | `fields` option (replaces) |

`setFields` merges into the tile's existing channels by default; pass
`replace: true` to replace the whole store.

## Protecting authored tiles

Call `builder.pinTile(at)` after authoring a historic feature, or add
`{ action: 'pinTile', at }` to a recipe. The resulting tile carries
`pinned: true`; Koota carries the `TilePinned` marker. Both survive projection
and engine-neutral interop snapshots. `pinTile(at, false)` (or a recipe step
with `pinned: false`) removes the pin.
Use `setTilePinned(world, at, pinned?)` for live editor changes so the
`TilePinned` marker and aggregate `HexTileState` stay synchronized before
runtime placement fills. Direct marker mutation does not update the aggregate.

Automatic terrain projection preserves the entire pinned tile. Decoration
scatter skips it, and layout fills reject both pinned anchors and footprints
that overlap pins. A layout caller deliberately placing an authored piece can
set `criteria.allowPinned: true`. Explicit builder edits remain available so
an editor can revise authored content. Pins protect generated output, rather
than freezing all runtime state.

`validateGameboardPlan` reports `tile.invalid_pin` for non-boolean values.
Unpinned tiles do not acquire a new serialized property.

## Koota traits

Spawning attaches decomposed traits only when a tile has the value:

- `TileBiome` (`{ biome: string }`): query `world.query(TileBiome)` for the
  tiles that have a biome.
- `TileFields` (a `Record<string, number>`).

`HexTileState` carries the same two values for the aggregate view.
`readDecomposedTileSpecs` and `projectWorldToGameboardPlan` read them back, so
a biome and its fields survive `spawn -> world -> read-back -> projection`
unchanged. `setTileBiome(world, tile, biome | undefined)` and
`setTileFields(world, tile, fields, { replace? })` mutate a live tile and keep
the aggregate and decomposed traits in step. React bindings: `useTileBiome`
and `useTileFields`.

## Writing terrain facts onto tiles

`projectTerrainToHexes` from [continuous terrain](/features/continuous-terrain/)
summarises the ground under each hex. `applyTerrainHexesToPlan` writes those
facts onto the matching plan tiles by axial coordinate:

```ts
import { projectTerrainToHexes } from 'declarative-hex-worlds/terrain';
import { applyTerrainHexesToPlan } from 'declarative-hex-worlds/gameboard';

const hexes = projectTerrainToHexes({ terrain, biomes, coordinates, geometry });
const withFacts = applyTerrainHexesToPlan(plan, hexes, {
  fields: {
    slope: 'meanSlope',
    elevation: 'meanHeight',
    wheatShare: { biomeShare: 'wheat' },
    ruggedness: (hex) => hex.maxHeight - hex.minHeight,
  },
  biome: 'dominant', // optional: write `dominantBiome` as the tile biome
});
```

It returns a new plan; the input is not modified. Hexes with no matching tile
are ignored (a terrain grid is often larger than the board), tiles with no
hex are left alone, and a source that returns `undefined` leaves the existing
value in place.

## Rules that read them

Layout criteria (`GameboardLayoutCriteria`, used by archetypes, fill rules and
piece fills) accept:

- `biome` / `excludeBiome`: the origin tile's biome must (or must not) be one
  of the listed values. A tile with no biome never matches `biome`.
- `requiredAdjacentBiome` / `forbiddenAdjacentBiome`: the same, over the six
  neighbours.
- `fields`: a list of `{ field, min?, max? }` bands, mirroring the terrain
  tier's `FieldBiomeCondition`. A missing bound is open, bounds are inclusive,
  and a tile that lacks the named field fails the band.

Rejections surface as `biome`, `excluded-biome`, `missing-adjacent-biome`,
`forbidden-adjacent-biome` and `field-band` in layout inspection reports.

```ts
const wetMeadowSites = {
  biome: 'meadow',
  fields: [{ field: 'wetness', min: 0.6 }, { field: 'slope', max: 0.1 }],
  forbiddenAdjacentBiome: 'orchard',
};
```

## API cross-links

- [`GameboardTileSpec`](/reference/gameboard/)
- [`TileBiome`, `TileFields`](/reference/traits/)
- [`applyTerrainHexesToPlan`](/reference/gameboard/)

## Related features

- [Continuous terrain](/features/continuous-terrain/)
- [Tile injection](/features/tile-injection/)
