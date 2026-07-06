---
title: Movement and patrols
description: Tile-to-tile movement with cost-aware pathing + scripted patrol routes for NPCs.
sidebar:
  order: 7
---

import { Aside } from '@astrojs/starlight/components';

<Aside type="note">
Screenshot embedding lands once the F-Gallery test harness flips on with the RB browser-CI gate.
</Aside>

## Problem

A guard NPC patrols a fixed route around the village walls. You want the patrol to step one tile per simulation tick, pause for 3 ticks at each waypoint, and reverse at the end of the loop.

## Snippet

```ts
import { GameboardPatrolAgent } from 'declarative-hex-worlds/patrol';

world.add(guardEntity, GameboardPatrolAgent({
  routeId: 'wall-loop',
  waypoints: ['2,2', '2,4', '4,4', '4,2'],
  pauseTicksPerWaypoint: 3,
  direction: 'forward',
  onLoopEnd: 'reverse',
}));
```

## What the library handles

- **Per-tick stepping.** `runGameboardSystems` advances every patrol agent one tile (or pauses) per tick.
- **Blocked-route fallbacks.** If the next waypoint becomes blocked, the agent waits + emits a `GameboardPatrolBlockedEvent`.
- **Event records.** Every step / wait / blocked event is captured in the simulation report for testing + replay.

## API cross-links

- [`GameboardPatrolAgent`](/reference/traits/)
- [`runGameboardSystems`](/reference/systems/)

## Related features

- [Pieces and actors](/features/pieces-and-actors/)
- [Quests](/features/quests/)
