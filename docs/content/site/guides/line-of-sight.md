---
title: Terrain line of sight
description: Authored discrete terrain visibility, obstruction heights, range and trace limits.
---

# Terrain line of sight

`traceGameboardSight` from `declarative-hex-worlds/navigation` tests a discrete
centre trace over the current board plan. The caller supplies sight range in
hex steps, observer and target heights above ground, and a ground-height
sampler. All vertical values use the same units. An optional obstruction-height
sampler adds authored woods, buildings or other opaque cover to intermediate
tiles. Ground height can read continuous terrain fields instead of stacked
tile elevation.

```ts
import { traceGameboardSight } from 'declarative-hex-worlds/navigation';

const sight = traceGameboardSight(plan, { q: 0, r: 0 }, { q: 4, r: 0 }, {
  maxRangeHexes: 6,
  eyeHeight: 1.7,
  targetHeight: 1.7,
  groundHeight: (tile) => tile.fields?.height ?? tile.elevation,
  obstructionHeight: (tile) => tile.fields?.sightHeight ?? 0,
});
```

The result reports visibility, a reason (`clear`, `range`, `missing-tile` or
`occluded`), the traced coordinates and, when applicable, the first blocker.
Out-of-range queries stop before terrain lookup. Missing endpoints fail
closed. Intermediate ground plus obstruction at or above the interpolated
eye-to-target line blocks sight, including equal-height grazing. Start and
target cells do not obstruct themselves. Same-cell and adjacent endpoints
are clear when present and in range. Invalid coordinates, range or heights
throw rather than silently declaring visibility.

This uses the existing rounded `hexLine`. It samples one centre per hex step;
it is not a supercover ray and does not test every tile touched along an edge.
It also does not integrate partial opacity or intersect continuous meshes.
These limits are part of the API's discrete board model. Callers retain unit
sight rules, observation timing and knowledge/report state. Supply a freshly
projected plan after tile membership changes; callbacks read current values
on every query, and returned coordinates are detached from the plan.
