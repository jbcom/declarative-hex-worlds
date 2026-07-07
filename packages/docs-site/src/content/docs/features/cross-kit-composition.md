---
title: Cross-kit composition
description: Mix KayKit Medieval Hexagon tiles with KayKit Adventurers characters and other GLTF packs.
sidebar:
  order: 9
---

import { Aside } from '@astrojs/starlight/components';

<Aside type="note">
Screenshot embedding lands once the F-Gallery test harness flips on with the RB browser-CI gate.
</Aside>

## Problem

You want KayKit Medieval Hexagon Pack tiles for the gameboard, but characters from KayKit Adventurers 2.0 (FREE) for the player + NPCs, plus a tower asset from Kenney's Castle Kit as a special landmark.

## Snippet

```ts
import {
  analyzeExternalAssetCompatibility,
  declareGameboardPiecesFromCompatibilityReports,
  createGameboardPieceRegistry,
  createGameboardPieceSourceUrlMap,
} from 'declarative-hex-worlds';

const knightReport = await analyzeExternalAssetCompatibility({
  assetUrl: '/assets/adventurers/knight.gltf',
  intendedRole: 'unit',
});

const pieces = declareGameboardPiecesFromCompatibilityReports([
  { name: 'adventurer:knight', report: knightReport, role: 'unit' },
]);
const registry = createGameboardPieceRegistry(pieces);
const urlByAssetId = createGameboardPieceSourceUrlMap(registry, {
  sourceRoots: { 'adventurers': '/assets/adventurers' },
});
```

## What the library handles

- **GLTF inspection.** Reads bounds, rig presence, animation clips, material slots from any GLTF; reports placement compatibility.
- **Piece declaration.** Wraps the report into a `GameboardPieceDeclaration` that fits the manifest schema.
- **URL resolution.** Per-source-pack URL maps so the renderer knows where to load each cross-kit asset from.
- **Size normalization.** [`normalizeAssetToCell`](/reference/normalize/) fits a
  different maker's asset — even a different hex orientation — into the target
  cell, and [`overlayTransform`](/reference/overlay/) places it. The examples
  package bakes a few CC0 **Kenney Hexagon Kit** pieces (flat-top hexes, a
  different aspect than KayKit's pointy-top cell) and a node test proves they
  normalize + overlay through these same seams — cross-maker extension, not just
  cross-kit within KayKit.

## API cross-links

- [`analyzeExternalAssetCompatibility`](/reference/interop/)
- [`declareGameboardPiecesFromCompatibilityReports`](/reference/pieces/)
- [`createGameboardPieceSourceUrlMap`](/reference/pieces/)

## Related features

- [Pieces and actors](/features/pieces-and-actors/)
- [Asset bootstrap](/guides/asset-bootstrap/)
