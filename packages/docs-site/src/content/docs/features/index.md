---
title: Features
description: Screenshot-driven feature gallery of declarative-hex-worlds.
sidebar:
  order: 0
---

import { Aside } from '@astrojs/starlight/components';

The gallery shows every facet of the library a prospective consumer needs to understand. Each page is structured the same way: a problem statement, a minimal TypeScript snippet, the library API cross-links, related features.

<Aside type="note">
Screenshot embedding lands once the F-Gallery test harness flips on with the RB browser-CI gate (PRD F-Gallery-1). The prose + snippets compile + run today.
</Aside>

## Gallery

| Feature | What it shows |
|---|---|
| [Harbors](/features/harbors/) | Fixed gameboard composition with water + piers + village settlement |
| [Bridges and connectors](/features/bridges-and-connectors/) | Procedural seed-stable bridges across rivers |
| [Multi-depth stacks](/features/multi-depth-stacks/) | Cliffs, plateaus, layered biomes via per-tile depth |
| [Tile injection](/features/tile-injection/) | Mutate tile state at runtime via commands |
| [Prop injection](/features/prop-injection/) | Add decorative or interactive props after build |
| [Pieces and actors](/features/pieces-and-actors/) | Player + NPCs + props with team / hostility / interaction metadata |
| [Movement and patrols](/features/movement-and-patrols/) | Cost-aware pathing + scripted patrol routes |
| [Quests](/features/quests/) | Multi-objective quests with progress + completion events |
| [Cross-kit composition](/features/cross-kit-composition/) | Mix KayKit Hexagon + Adventurers + Kenney assets |
| [Determinism replay](/features/determinism-replay/) | Save seed + script → reproduce exact world + simulation anywhere |
