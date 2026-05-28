---
title: Quests
description: Multi-objective quests with progress tracking, completion events, and replay-safe state.
sidebar:
  order: 8
---

import { Aside } from '@astrojs/starlight/components';

<Aside type="note">
Screenshot embedding lands once the F-Gallery test harness flips on with the RB browser-CI gate.
</Aside>

## Problem

A "Clear the harbor" quest has three objectives: defeat 5 bandits, deliver 3 crates to the tavern, talk to the harbormaster. The quest tracks each objective independently + fires a completion event when all three resolve.

## Snippet

```ts
import { GameboardQuest } from 'medieval-hexagon-gameboard/quests';

world.spawn(GameboardQuest({
  id: 'quest:clear-harbor',
  title: 'Clear the harbor',
  objectives: [
    { id: 'defeat-bandits', kind: 'defeat-count', target: 5, current: 0 },
    { id: 'deliver-crates', kind: 'deliver-count', target: 3, current: 0 },
    { id: 'talk-harbormaster', kind: 'interact-actor', target: 'npc:harbormaster' },
  ],
  rewards: { gold: 100, xp: 250 },
}));
```

## What the library handles

- **Objective tracking.** Each kind has its own update hook that runs during the simulation tick.
- **Completion semantics.** A quest completes when every objective's `status === 'satisfied'`.
- **Event records.** `GameboardQuestAdvancedEvent` / `GameboardQuestCompletedEvent` / `GameboardQuestBlockedEvent` for downstream UIs.

## API cross-links

- [`GameboardQuest`](/reference/traits/)
- [`GameboardQuestObjectiveProgress`](/reference/quests/)

## Related features

- [Pieces and actors](/features/pieces-and-actors/)
- [Movement and patrols](/features/movement-and-patrols/)
