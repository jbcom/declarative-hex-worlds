---
title: Bridges and connectors
description: Procedurally bridge rivers and ravines with seed-stable connector tiles.
sidebar:
  order: 2
---

import { Aside } from '@astrojs/starlight/components';

<Aside type="note">
Screenshot embedding lands once the F-Gallery test harness flips on with the RB browser-CI gate.
</Aside>

## Problem

A river splits your board into two halves and you want the procedural generator to lay down two or three bridges at sensible spans (not too close, not over impassable terrain) every time the same seed runs.

## Snippet

```ts
import { createSeededGameboardPlan } from 'declarative-hex-worlds/rules';

const plan = createSeededGameboardPlan({
  seed: 'forest-with-river-3',
  shape: { kind: 'rectangle', width: 12, height: 8 },
  generators: [
    { kind: 'river', source: { q: 0, r: 3 }, sink: { q: 11, r: 5 } },
    { kind: 'bridges', maxBridges: 3, minSpacing: 3 },
  ],
});

// Same seed → same river path → same bridges. Always.
```

## What the library handles

- **River pathing.** A* between source + sink with terrain-cost weighting.
- **Bridge placement.** Seed-aware sampler picks span sites that satisfy `minSpacing` and don't cross unrenderable terrain.
- **Determinism contract.** [See the determinism guide.](/guides/determinism/)

## API cross-links

- [`createSeededGameboardPlan`](/reference/rules/)
- [`GameboardLayoutArchetype`](/reference/layout/)

## Related features

- [Harbors](/features/harbors/)
- [Multi-depth stacks](/features/multi-depth-stacks/)
