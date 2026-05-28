---
title: Multi-depth stacks
description: Stack hex tiles at varying Y depths to build cliffs, plateaus, and layered biomes.
sidebar:
  order: 3
---

import { Aside } from '@astrojs/starlight/components';

<Aside type="note">
Screenshot embedding lands once the F-Gallery test harness flips on with the RB browser-CI gate.
</Aside>

## Problem

You want a cliff face: lower coastal hexes at depth 0, a sheer cliff at depth 1, and a plateau of grass + trees at depth 2. Visitors should be able to spawn on each tier; AI pathing should respect the elevation deltas.

## Snippet

```ts
import { createGameboardBuilder } from 'declarative-hex-worlds/gameboard';

const plan = createGameboardBuilder({
  seed: 'cliff-3',
  shape: { kind: 'rectangle', width: 6, height: 6 },
})
  .addTier({ at: { q: 1, r: 1 }, depth: 0, terrain: 'coast' })
  .addTier({ at: { q: 2, r: 1 }, depth: 1, terrain: 'cliff' })
  .addTier({ at: { q: 3, r: 1 }, depth: 2, terrain: 'grass' })
  .addNaturePlacement({ at: { q: 3, r: 1 }, kind: 'tree_single_A' })
  .build();
```

## What the library handles

- **HexTileState.depth.** Per-tile Y offset; the projection pipeline reads it for world-space height.
- **Stack rules.** Adjacent tile depth deltas above the configured threshold fail validation.
- **Navigation.** `createGameboardActorNavigationProfile` respects elevation cost when planning paths.

## API cross-links

- [`HexTileState`](/reference/traits/)
- [`projectWorldToGameboardPlan`](/reference/coordinates/)
- [`createGameboardActorNavigationProfile`](/reference/actors/)

## Related features

- [Harbors](/features/harbors/)
- [Bridges and connectors](/features/bridges-and-connectors/)
