---
title: Tile injection
description: Mutate tile state after the board is built — terrain swaps, depth lifts, connectivity rewires.
sidebar:
  order: 4
---

import { Aside } from '@astrojs/starlight/components';

<Aside type="note">
Screenshot embedding lands once the F-Gallery test harness flips on with the RB browser-CI gate.
</Aside>

## Problem

A river runs through your board. At runtime a quest objective dams the river upstream; downstream tiles need to switch from `water` to `mud` for the next 50 simulation ticks, then revert.

## Snippet

```ts
import { gameboardCommandActions } from 'medieval-hexagon-gameboard/commands';
import { HexTileState } from 'medieval-hexagon-gameboard/traits';

const swap = world.actions(gameboardCommandActions).plan({
  kind: 'inject-tile',
  tileKey: '4,2',
  patch: { terrain: 'mud' },
});
world.actions(gameboardCommandActions).execute(swap);

// Later, revert.
world.actions(gameboardCommandActions).execute({
  ...swap,
  patch: { terrain: 'water' },
});
```

## What the library handles

- **Trait mutation under koota's transaction model.** Tile state changes are observable by queries.
- **Re-validation.** Connectivity rules re-run; downstream placements that depended on `water` neighbors may flag warnings.
- **Snapshot stability.** Post-mutation `runtime.snapshot()` reflects the new state; deterministic replay from the same script reproduces the same sequence.

## API cross-links

- [`gameboardCommandActions`](/reference/commands/)
- [`HexTileState`](/reference/traits/)

## Related features

- [Prop injection](/features/prop-injection/)
- [Pieces and actors](/features/pieces-and-actors/)
