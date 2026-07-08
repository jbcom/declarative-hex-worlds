<div align="center">

<img src="https://raw.githubusercontent.com/jbcom/declarative-hex-worlds/main/packages/docs-site/public/hero.png" alt="Declarative Hex Worlds" width="540">

# declarative-hex-worlds

**Declarative, deterministic hex worlds for TypeScript games.**
Bootstrap KayKit assets in one command. First-class React + Three.js + canvas-2D bindings.

[![CI](https://github.com/jbcom/declarative-hex-worlds/actions/workflows/ci.yml/badge.svg)](https://github.com/jbcom/declarative-hex-worlds/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/declarative-hex-worlds.svg)](https://www.npmjs.com/package/declarative-hex-worlds)
[![license](https://img.shields.io/npm/l/declarative-hex-worlds.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/declarative-hex-worlds.svg)](https://jonbogaty.com/declarative-hex-worlds/reference/readme/)

[**Read the docs →**](https://jonbogaty.com/declarative-hex-worlds/) ·  [**Browse features →**](https://jonbogaty.com/declarative-hex-worlds/features/) ·  [**API reference →**](https://jonbogaty.com/declarative-hex-worlds/reference/readme/)

</div>

---

A deterministic gameboard runtime for TypeScript games. Declare a harbor, a
procedural forest, a multi-depth cliff, or a full painterly hex map once; the
library compiles it through recipe → blueprint → scenario into a
[koota](https://koota.dev) ECS world your React + Three.js (or canvas-2D) stack
renders — the **renderer-free core** emits koota-trait signals, and each binding
(`/three`, `/canvas2d`, `/react-elements`) queries + reconciles them, so the same
declarative world drives any substrate.

## Quickstart

```bash
pnpm add declarative-hex-worlds
pnpm exec declarative-hex-worlds bootstrap --out public/assets/models
```

```tsx
import { Canvas } from '@react-three/fiber';
import { createGameboardBuilder } from 'declarative-hex-worlds';
import { HexWorld, GameboardObjects } from 'declarative-hex-worlds/react-elements';

const plan = createGameboardBuilder({
  seed: 'harbor-village-1',
  shape: { kind: 'rectangle', width: 6, height: 6 },
}).build();

export function HarborBoard({ loader }) {
  return (
    <Canvas>
      <HexWorld plan={plan} loader={loader}>
        <GameboardObjects />
      </HexWorld>
    </Canvas>
  );
}
```

Same seed → byte-identical world, across processes and platforms.

## This is a monorepo

| Package | What it is |
|---|---|
| [`packages/declarative-hex-worlds`](./packages/declarative-hex-worlds) | **The published library.** Full README, API, CLI, bindings, tileset system. |
| [`packages/examples`](./packages/examples) | Runnable consumer examples (3D board, 2D board) exercising the bindings + asset bootstrap end-to-end. |
| [`packages/docs-site`](./packages/docs-site) | The [documentation site](https://jonbogaty.com/declarative-hex-worlds/) (Astro Starlight) + `llms.txt`. |

**→ Start with the [library README](./packages/declarative-hex-worlds/README.md)** for
the module map, dependency tiers, tileset declaration, CLI reference, and the full
determinism contract.

## Bindings at a glance

Every engine is an **optional peer** — install only what your entrypoint needs:

| You import… | You also install |
|---|---|
| `declarative-hex-worlds/core` | nothing (bundles `honeycomb-grid` + `zod`) — no koota/three/react |
| `declarative-hex-worlds` (main) | `+ koota` |
| `declarative-hex-worlds/three` | `+ three` — the 3D renderer binding (GLTF models **and** textured tileset hexes) |
| `declarative-hex-worlds/canvas2d` | nothing extra — the 2D renderer binding (tileset sprite blitting) |
| `declarative-hex-worlds/react` / `/react-elements` | `+ react react-dom` (`+ three @react-three/fiber` for elements) |

## Docs & AI agents

Human docs live at **[jonbogaty.com/declarative-hex-worlds](https://jonbogaty.com/declarative-hex-worlds/)**.
For AI agents ([llms.txt standard](https://llmstxt.org)):
[llms.txt](https://jonbogaty.com/declarative-hex-worlds/llms.txt) ·
[llms-small.txt](https://jonbogaty.com/declarative-hex-worlds/llms-small.txt) ·
[llms-full.txt](https://jonbogaty.com/declarative-hex-worlds/llms-full.txt).
[AGENTS.md](./AGENTS.md) covers working *on* this repo.

## Contributing

`pnpm verify` runs every CI gate locally. Conventional Commits required; PRs are
squash-merged; the coverage gate enforces 100/100/100/100. See
[CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) for the library code. KayKit Medieval Hexagon Pack ©
[Kay Lousberg](https://kaylousberg.com/), CC0-1.0. Bundled/bootstrapped asset packs
have their own licenses; see [`NOTICE.md`](./packages/declarative-hex-worlds/NOTICE.md).
