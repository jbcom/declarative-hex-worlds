---
title: Harbors
description: Compose a fixed harbor with water tiles, piers, and a small village settlement.
sidebar:
  order: 1
---

import { Aside } from '@astrojs/starlight/components';

<Aside type="note">
Screenshot embedding lands once the F-Gallery test harness flips on with the RB browser-CI gate. The snippet below compiles + runs today.
</Aside>

## Problem

You want a hex board where a stretch of coastline opens into a deep-water harbor with two wooden piers and a few boats at anchor. The terrain should validate (no land tiles inside the water cluster, piers spanning the shore, navigable tiles for actors).

## Snippet

```tsx
import { createGameboardBuilder } from 'medieval-hexagon-gameboard/gameboard';

const plan = createGameboardBuilder({
  seed: 'harbor-village-7',
  shape: { kind: 'rectangle', width: 8, height: 6 },
})
  .addHarbor({ center: { q: 4, r: 2 }, radius: 2 })
  .addBridge({ from: { q: 3, r: 1 }, to: { q: 4, r: 1 } })
  .addBuilding({ at: { q: 1, r: 4 }, kind: 'tavern' })
  .addBuilding({ at: { q: 2, r: 4 }, kind: 'home_A' })
  .build();

// plan.tiles + plan.placements are deterministic — same seed, same harbor.
```

## What the library handles

- **Tile selection.** `addHarbor` picks water + coast variants from the FREE manifest, rotates them to match neighbouring tile edges.
- **Connectivity validation.** The bridge between `{q:3,r:1}` and `{q:4,r:1}` is rejected if those tiles aren't adjacent.
- **Determinism.** Same seed → same harbor layout across every machine.
- **Placement metadata.** Every placement has a `metadata.layoutFootprintSize` + `metadata.pieceRole` for downstream rendering.

## API cross-links

- [`createGameboardBuilder`](/reference/gameboard/) — the entry point.
- [`GameboardBuilder.addHarbor`](/reference/gameboard/) — harbor placement.
- [`GameboardBuilder.addBridge`](/reference/gameboard/) — connector placement.
- [`projectWorldToGameboardPlan`](/reference/coordinates/) — once you've spawned the plan into a koota world, project back to a `GameboardPlan` for serialization.

## Related features

- [Bridges and connectors](/features/bridges-and-connectors/)
- [Multi-depth stacks](/features/multi-depth-stacks/)
- [Cross-kit composition](/features/cross-kit-composition/)
