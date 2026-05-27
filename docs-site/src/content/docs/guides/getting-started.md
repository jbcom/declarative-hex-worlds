---
title: Get started
description: Install, bootstrap the FREE asset pack, and render your first hexagon gameboard.
---

`@jbcom/medieval-hexagon-gameboard` is a deterministic, ECS-driven, React +
Three.js library for building hex-grid games on top of the KayKit Medieval
Hexagon GLTF pack. This page gets you from `pnpm add` to rendered hexes in
under five minutes.

## 1. Install + bootstrap

```bash
pnpm add @jbcom/medieval-hexagon-gameboard
pnpm exec medieval-hexagon-gameboard bootstrap
```

The library ships the typed runtime + the FREE manifest metadata; the GLTF
binaries themselves are downloaded at install time from the
[KayKit upstream GitHub repo](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0)
by the `bootstrap` subcommand. The default `--out` heuristic targets
`public/assets/models/` (Vite / Next.js convention); see
[Asset bootstrap](/guides/asset-bootstrap/) for the full workflow including
the EXTRA edition and reproducible-build options.

After bootstrap, your asset tree looks like:

```text
public/assets/models/addons/kaykit_medieval_hexagon_pack/
├── Assets/gltf/...     # 221 .gltf + .bin files
├── Textures/...
└── .bootstrap.json     # integrity sidecar
```

## 2. Point the runtime at your bootstrap target

```ts
import { setGameboardAssetRoot } from '@jbcom/medieval-hexagon-gameboard';

// Call once at app boot:
setGameboardAssetRoot('/public/assets/models');
```

Or set `MEDIEVAL_HEXAGON_ASSET_ROOT` in your environment — the runtime falls
through `override → globalThis → process.env → 'public/assets/models'` default.

## 3. Build a deterministic gameboard

```ts
import {
  buildMedievalGameboardBlueprint,
  createGameboardWorldFromScenario,
} from '@jbcom/medieval-hexagon-gameboard';

// One-call: shape + seed → fully populated scenario.
const { scenario } = buildMedievalGameboardBlueprint({
  shape: { kind: 'rectangle', width: 12, height: 8 },
  seed: 'tutorial-island',
});

// Spawn into a Koota world with traits, occupancy, navigation graphs, etc.
const runtime = createGameboardWorldFromScenario(scenario);
```

`buildMedievalGameboardBlueprint` compiles biome fills, mountain ranges,
towns, roads, rivers, harbors, and prop clusters into a `GameboardScenario`
that the Koota runtime can spawn deterministically from a seed.

## 4. Render with the React + Three.js bindings

```tsx
import { Canvas } from '@react-three/fiber';
import { GameboardScene } from '@jbcom/medieval-hexagon-gameboard/react';

export function App({ runtime }: { runtime: GameboardRuntime }) {
  return (
    <Canvas camera={{ position: [0, 12, 18], fov: 50 }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} />
      <GameboardScene runtime={runtime} />
    </Canvas>
  );
}
```

React + Three.js are first-class runtime dependencies (not optional peers),
so the bindings work without any extra installs.

## 5. Next steps

- [Asset bootstrap](/guides/asset-bootstrap/) — full bootstrap workflow,
  including EXTRA edition, reproducible builds, and `--verify`.
- [KayKit upstream layout](/guides/kaykit-upstream-layout/) — the on-disk
  shape the bootstrap step mirrors.
- [CLI reference](/guides/cli-reference/) — every CLI subcommand and flag.
- [`@jbcom/medieval-hexagon-gameboard`](/reference/) — typed API reference.
