<div align="center">

<img src="https://raw.githubusercontent.com/jbcom/declarative-hex-worlds/main/docs-site/public/hero.png" alt="Declarative Hex Worlds" width="540">

# declarative-hex-worlds

**Declarative, deterministic hex worlds for TypeScript games.**
Bootstrap KayKit assets in one command. First-class React + Three.js bindings.

[![CI](https://github.com/jbcom/declarative-hex-worlds/actions/workflows/ci.yml/badge.svg)](https://github.com/jbcom/declarative-hex-worlds/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/declarative-hex-worlds.svg)](https://www.npmjs.com/package/declarative-hex-worlds)
[![license](https://img.shields.io/npm/l/declarative-hex-worlds.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/declarative-hex-worlds.svg)](https://jonbogaty.com/declarative-hex-worlds/reference/readme/)

</div>

A deterministic gameboard runtime for TypeScript games. Declare a harbor, a procedural forest, or a multi-depth cliff once; the library compiles it through recipe → blueprint → scenario into a [koota](https://koota.dev) ECS world your React + Three.js stack renders.

[**Read the docs →**](https://jonbogaty.com/declarative-hex-worlds/) ·  [**Browse features →**](https://jonbogaty.com/declarative-hex-worlds/features/) ·  [**API reference →**](https://jonbogaty.com/declarative-hex-worlds/reference/readme/)

---

## Quickstart

```bash
pnpm add declarative-hex-worlds
pnpm exec declarative-hex-worlds bootstrap --out public/assets/models
```

```tsx
import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
// Core (renderer-free): worldgen + runtime signals. No renderer installed for this import.
import { createGameboardBuilder, createGameboardRuntime } from 'declarative-hex-worlds';
// React bindings subscribe to the runtime's koota signals — the `/react` subpath
// (react is an OPTIONAL peer; you only install it if you import a binding subpath).
import { GameboardRuntimeProvider, useGameboardRuntime } from 'declarative-hex-worlds/react';

const plan = createGameboardBuilder({
  seed: 'harbor-village-1',
  shape: { kind: 'rectangle', width: 6, height: 6 },
}).build();

const runtime = createGameboardRuntime(plan);

export function HarborBoard() {
  return (
    <GameboardRuntimeProvider runtime={runtime}>
      <Canvas><Scene /></Canvas>
    </GameboardRuntimeProvider>
  );
}

function Scene() {
  const rt = useGameboardRuntime();
  useEffect(() => { rt.tick(); }, [rt]);
  return null; // subscribe to rt signals via a binding (declarative-hex-worlds/three) to draw
}
```

That's it. The `bootstrap` command mirrors the 221 KayKit FREE models (456 files including buffers and textures) into `<out>/addons/kaykit_medieval_hexagon_pack/Assets/gltf/` and writes a SHA-256 sidecar for integrity verification. Without `--out` it defaults to `./models` (or an existing `public/models/`). The plan + runtime are deterministic — same seed, same render, byte-for-byte.

Bought the premium [EXTRA pack](https://kaykit.itch.io/medieval-hexagon-pack) on itch.io? Point the same command at your zip — the edition is auto-detected:

```bash
pnpm exec declarative-hex-worlds bootstrap --source zip --zip ~/Downloads/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA.zip
```

See the [asset bootstrap guide](https://jonbogaty.com/declarative-hex-worlds/guides/asset-bootstrap/) for the full FREE + EXTRA story.

> [`@react-three/fiber`](https://github.com/pmndrs/react-three-fiber) is an optional companion (`pnpm add @react-three/fiber`). It's not a hard dep because some consumers prefer a different react-three layer; the library's own `/three` subpath gives you the raw helpers if you'd rather skip it.

---

## Why this exists

- **Declarative API for hex worlds.** Describe what you want (a harbor, a forest, a cliff with three depth tiers). The library handles tile selection, connectivity, prop scatter, and validation.
- **Deterministic seed-driven generation.** Same seed produces byte-identical output across processes and platforms. Server-authoritative simulation, save games, cross-process replay — all work out of the box.
- **First-class React + Three.js bindings.** Not optional peer-deps. The library tests against the versions it ships; install one package and start rendering.

---

## Module map

The umbrella (`declarative-hex-worlds`) re-exports everything. For tighter tree-shaking and clearer intent, import from subpaths:

| Subpath | What it gives you |
|---|---|
| `declarative-hex-worlds` (umbrella) | Everything. Prototyping. |
| `/core` | The **runtime-free, renderer-free** tier: asset-source + tileset schemas, the recipe/scenario/blueprint → plan compilers, hex algebra + A\* pathfinding, board-aware navigation + occupancy, plan validation, and interop snapshots. No koota, no three. |
| `/gameboard` | Plan builder, tile + placement spec types |
| `/coordinates` | Hex algebra, axial / world transforms |
| `/scenario`, `/blueprint`, `/recipe` | Scenario → blueprint → recipe compiler |
| `/koota` | ECS world + actor / placement spawn helpers |
| `/runtime` | Runtime facade + snapshot |
| `/react` | React provider + hooks |
| `/three` | three.js loaders + scene helpers |
| `/react-elements` | Declarative JSX elements (`<HexWorld>`/`<Tile>`/`<Model>`) + hooks |
| `/bootstrap` | Programmatic asset bootstrap (CLI alternative) |
| `/errors` | `GameboardError` + subclasses for `instanceof` catching |
| `/manifest/free`, `/manifest/schema` | The FREE manifest metadata + schema |

[Full subpath list with API reference →](https://jonbogaty.com/declarative-hex-worlds/reference/readme/)

### Dependency tiers

Every engine is an **optional peer** — you install only what the entrypoint you use needs:

| You import… | You need to install |
|---|---|
| `declarative-hex-worlds/core` | just this package (it bundles `honeycomb-grid` + `zod`) — **no `koota`, no `three`, no `react`** |
| `declarative-hex-worlds` (main) / runtime subpaths | `+ koota` (`+ react` for the React bindings) |
| `declarative-hex-worlds/three` | `+ three` |
| `declarative-hex-worlds/react` | `+ react react-dom` |
| `declarative-hex-worlds/react-elements` | `+ react react-dom three @react-three/fiber` |

The `/core` tier is the "declare + JSON + validate + hex math, bring-your-own runtime/renderer" path: author and validate boards, run pathfinding, and mount into your own ECS via interop snapshots — without pulling in the koota ECS or a renderer.

---

## Docs

| Get started | Features | Reference |
|---|---|---|
| [Quickstart](https://jonbogaty.com/declarative-hex-worlds/guides/getting-started/) | [Feature gallery](https://jonbogaty.com/declarative-hex-worlds/features/) | [API reference](https://jonbogaty.com/declarative-hex-worlds/reference/readme/) |
| [Asset bootstrap](https://jonbogaty.com/declarative-hex-worlds/guides/asset-bootstrap/) | [CLI](https://jonbogaty.com/declarative-hex-worlds/guides/cli-reference/) | [Errors](https://jonbogaty.com/declarative-hex-worlds/guides/errors/) |
| [Bindings + bundling](https://jonbogaty.com/declarative-hex-worlds/guides/bindings/) | [Determinism contract](https://jonbogaty.com/declarative-hex-worlds/guides/determinism/) | [Architecture](https://jonbogaty.com/declarative-hex-worlds/about/architecture/) |
| [Testing](https://jonbogaty.com/declarative-hex-worlds/guides/testing/) | [Design rationale](https://jonbogaty.com/declarative-hex-worlds/about/design/) | [Deployment](https://jonbogaty.com/declarative-hex-worlds/about/deployment/) |

**For AI agents** ([llms.txt standard](https://llmstxt.org)): [llms.txt](https://jonbogaty.com/declarative-hex-worlds/llms.txt) · [llms-small.txt](https://jonbogaty.com/declarative-hex-worlds/llms-small.txt) (guides, fits one context window) · [llms-full.txt](https://jonbogaty.com/declarative-hex-worlds/llms-full.txt) (guides + complete API reference). [AGENTS.md](https://github.com/jbcom/declarative-hex-worlds/blob/main/AGENTS.md) covers working *on* the repo.

---

## CLI

The library ships a Node binary. Common commands:

```bash
declarative-hex-worlds bootstrap       # download FREE pack assets (run once)
declarative-hex-worlds doctor          # check local setup
declarative-hex-worlds validate-scenario --scenario ./my-scenario.json
declarative-hex-worlds coverage --json # release-readiness ledger
```

[Full CLI reference →](https://jonbogaty.com/declarative-hex-worlds/guides/cli-reference/)

---

## What ships

- The npm tarball is small (~2.3 MB; ~175 files). It contains the manifest, the compiled JS + DTS, the README, and a handful of curated showcase PNGs.
- The KayKit FREE GLTF tree (~30 MB; 221 models) is bootstrap-fetched at install time. CC0 license; the bootstrap command also writes a SHA-256 integrity sidecar.
- The EXTRA edition is a paid [itch.io](https://kaykit.itch.io/medieval-hexagon-pack) purchase. The library supports it via `bootstrap --source zip --zip <your-extra.zip>` but never bundles it.

---

## Contributing

`pnpm verify` runs every CI gate locally. See [CONTRIBUTING.md](https://github.com/jbcom/declarative-hex-worlds/blob/main/CONTRIBUTING.md). The PRD in [`docs/PRD/1.0.md`](https://github.com/jbcom/declarative-hex-worlds/blob/main/docs/PRD/1.0.md) explains the why.

Conventional Commits required. PRs are squash-merged. Coverage gate enforces 100 / 100 / 100 / 100; regressions block merge.

---

## License

[MIT](./LICENSE) for the library code.

KayKit Medieval Hexagon Pack © [Kay Lousberg](https://kaylousberg.com/), [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/). Adventurers / EXTRA pack and other KayKit content have their own licenses; see [`NOTICE.md`](./NOTICE.md).
