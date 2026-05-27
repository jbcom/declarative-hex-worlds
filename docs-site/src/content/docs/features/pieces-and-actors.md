---
title: Pieces and actors
description: Spawn the player, NPCs, and neutral actors with team/hostility/interaction metadata.
sidebar:
  order: 6
---

import { Aside } from '@astrojs/starlight/components';

<Aside type="note">
Screenshot embedding lands once the F-Gallery test harness flips on with the RB browser-CI gate.
</Aside>

## Problem

You need a player character on the harbor tile, a tavern keeper inside the tavern, and three hostile bandits camped on the road. Each has a different role flag + collision profile + interaction behavior.

## Snippet

```ts
import { registerGameboardActor, spawnGameboardActor } from '@jbcom/medieval-hexagon-gameboard/actors';

const player = registerGameboardActor(world, {
  id: 'player:you',
  kind: 'player',
  tileKey: '4,2',
  team: 'players',
});

const tavernKeeper = registerGameboardActor(world, {
  id: 'npc:keeper',
  kind: 'npc',
  tileKey: '1,4',
  team: 'neutrals',
});

const bandit = registerGameboardActor(world, {
  id: 'enemy:bandit-1',
  kind: 'npc',
  tileKey: '5,3',
  team: 'bandits',
  hostility: { towards: ['players', 'neutrals'] },
});
```

## What the library handles

- **Trait composition.** Each actor gets `GameboardActor` + (`IsPlayerActor` | `IsNpcActor` | `IsPropActor`) + (`IsHostileActor` if applicable) traits.
- **Team-based queries.** `HostileActorQuery` returns just the bandits relative to the player.
- **Tile occupancy.** Spawn refuses to place an actor on a tile that has a blocking placement.

## API cross-links

- [`registerGameboardActor`](/reference/actors/)
- [`GameboardActor`](/reference/traits/)
- [`HostileActorQuery`](/reference/actors/)

## Related features

- [Movement and patrols](/features/movement-and-patrols/)
- [Quests](/features/quests/)
