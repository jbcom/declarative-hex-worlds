---
title: Prop injection
description: Attach decorative or interactive props to existing tiles after the board has rendered.
sidebar:
  order: 5
---

import { Aside } from '@astrojs/starlight/components';

<Aside type="note">
Screenshot embedding lands once the F-Gallery test harness flips on with the RB browser-CI gate.
</Aside>

## Problem

A merchant arrives at the tavern tile with three crates of trade goods. You want the crates rendered on the tile, queryable by AI, and removable when the merchant leaves.

## Snippet

```ts
import { spawnGameboardPlacement } from '@jbcom/medieval-hexagon-gameboard/koota';

const crateA = spawnGameboardPlacement(world, {
  tileKey: '2,4',
  assetId: 'crate_A_big',
  kind: 'prop',
  layer: 'prop',
  metadata: { ownerActorId: 'merchant:trader-7' },
});
```

## What the library handles

- **Placement spawn.** Adds the koota entity with `IsGameboardPlacement` + `PlacementOnTile` + `PlacementState` traits.
- **Footprint check.** Asserts the prop fits within the tile's available footprint slots.
- **Query surface.** Consumer can later `findGameboardActor(world, ...)` to locate the merchant + iterate their placements.

## API cross-links

- [`spawnGameboardPlacement`](/reference/koota/)
- [`PlacementState`](/reference/traits/)

## Related features

- [Tile injection](/features/tile-injection/)
- [Pieces and actors](/features/pieces-and-actors/)
