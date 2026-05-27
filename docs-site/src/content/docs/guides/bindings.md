---
title: Bindings and bundling
description: Subpath imports, trait identity hazard, the first-class React + Three.js binding model.
sidebar:
  order: 4
---

## Subpath imports

The library publishes ~40 subpaths under `package.json#exports`. Pick the one you need:

```ts
// Specific subpath — only that domain's symbols + its transitive deps land in your bundle
import { createGameboardBuilder } from '@jbcom/medieval-hexagon-gameboard/gameboard';
import { MedievalGameboardProvider, useGameboardRuntime } from '@jbcom/medieval-hexagon-gameboard/react';
import { loadGameboardPlacementObject } from '@jbcom/medieval-hexagon-gameboard/three';

// Umbrella — everything (use only for prototyping)
import * as lib from '@jbcom/medieval-hexagon-gameboard';
```

The umbrella re-exports everything from every sub-package; consumers prototyping in a sandbox can use it. For production code, prefer subpath imports — they let bundlers tree-shake aggressively because `sideEffects: false` is set on the package.

## React + Three.js are direct dependencies, not peer-deps

PRD invariant §5: `react`, `react-dom`, `three`, `koota`, `honeycomb-grid`, `seedrandom` are direct `dependencies`. The library is unusable without them; bundling them defensively is not a consumer choice.

Why this matters:

1. **No version skew between library code and consumer code.** A common peer-dep failure mode is the library being tested against React 18 while the consumer ships React 19; subtle hook behavior changes. With direct deps, the library pins what it tests against.
2. **No "did you remember to install React?" footgun.** `npm install @jbcom/medieval-hexagon-gameboard` is enough.
3. **The library can ship binding implementations confidently.** `useGameboardRuntime()` knows it's using the same React the library tested against.

If your app uses a different React version than the library, npm's de-duplication generally resolves to your version (your `package.json` wins). For Three.js the same de-dup applies. The library tests against the latest patches of each major; check `package.json` for the current pin.

## Trait identity hazard (and why `splitting: true` matters)

The library's koota traits (in `src/traits/`) are unique objects compared by reference, not name. If two chunks both define the same trait, koota treats them as different traits and your entities don't match queries.

The library protects you by:

1. **Single `traits/` barrel.** Every trait declaration lives at `src/traits/<domain>.ts` and is re-exported from `src/traits/index.ts`. There's only one declaration per trait.
2. **`splitting: true` in tsup.** Each subpath becomes its own chunk, but shared dependencies (including trait declarations) land in shared chunks. The trait identity test (Epic E4) imports the same trait from `/koota` and from the umbrella and asserts reference-equality.

For consumers: import traits through whichever subpath is convenient. They're the same object regardless of import path. The E4 test pins this; if it ever fails, your bundle has a chunk-splitting bug.

## When you need to extend with custom traits

```ts
import { trait } from 'koota';
import { type GameboardActor } from '@jbcom/medieval-hexagon-gameboard/actors';

// Define a custom trait
const Inventory = trait<{ items: string[] }>();

// Spawn an entity with both library traits and your custom trait
const myActor = world.spawn(GameboardActor({ id: 'player', team: 'players' }), Inventory({ items: [] }));
```

Your custom traits should live in your own module, exported once. If you split them across files via re-exports, ensure `splitting: true` in your bundler too (most modern bundlers do this by default).

## SSR / server-side rendering

The `react` subpath uses hooks that need the React provider. The `three` subpath has DOM dependencies (canvas, WebGL) and shouldn't import in SSR. The pattern:

```ts
// pages/board.tsx (Next.js)
import dynamic from 'next/dynamic';
const Board = dynamic(() => import('./Board'), { ssr: false });
```

The library doesn't ship an SSR-safe variant; render boards client-only.

## Bundle size

The umbrella is ~250 KB minified (most of that is the FREE manifest literal — 16k LOC of asset metadata). Subpath imports cut to whatever you actually use; `/coordinates` alone is ~8 KB.

The bundled FREE manifest is the product (PRD §B2 rejection): it's why "install + bootstrap + render" is a 30-line quickstart. If you don't want it in your bundle, import `/coordinates`, `/gameboard`, etc. directly and load the manifest yourself via `loadFreeManifest()` (B2b).

## Subpath table

See the [API reference](/reference/) for the full list. Every subpath has its own page documenting what it exports.
