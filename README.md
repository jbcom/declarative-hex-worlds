# @jbcom/medieval-hexagon-gameboard

Declarative hex worlds. Bootstrap the FREE KayKit pack in one command. First-class React + Three.js bindings.

[![CI](https://github.com/jbcom/medieval-hexagon-gameboard/actions/workflows/ci.yml/badge.svg)](https://github.com/jbcom/medieval-hexagon-gameboard/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@jbcom/medieval-hexagon-gameboard.svg)](https://www.npmjs.com/package/@jbcom/medieval-hexagon-gameboard)
[![license](https://img.shields.io/npm/l/@jbcom/medieval-hexagon-gameboard.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/@jbcom/medieval-hexagon-gameboard.svg)](https://jbcom.github.io/medieval-hexagon-gameboard/reference/)

> A deterministic gameboard runtime for TypeScript games. Declare a harbor, a procedural forest, or a multi-depth cliff once; the library compiles it through recipe → blueprint → scenario into a [koota](https://koota.dev) ECS world your React + Three.js stack renders.

---

## Quickstart

```bash
pnpm add @jbcom/medieval-hexagon-gameboard
pnpm exec medieval-hexagon-gameboard bootstrap
```

```tsx
import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  MedievalGameboardProvider,
  useGameboardRuntime,
} from '@jbcom/medieval-hexagon-gameboard/react';
import {
  createGameboardBuilder,
  createGameboardRuntimeFromScenario,
} from '@jbcom/medieval-hexagon-gameboard/runtime';

const plan = createGameboardBuilder({
  seed: 'harbor-village-1',
  shape: { kind: 'rectangle', width: 6, height: 6 },
}).build();

const runtime = createGameboardRuntimeFromScenario({ plan, scenario: { actors: [], quests: [] } });

export function HarborBoard() {
  return (
    <MedievalGameboardProvider runtime={runtime}>
      <Canvas><Scene /></Canvas>
    </MedievalGameboardProvider>
  );
}

function Scene() {
  const rt = useGameboardRuntime();
  useEffect(() => { rt.tick(1 / 60); }, [rt]);
  return null; // your three.js render of rt.snapshot() goes here
}
```

That's it. The bootstrap command downloaded 221 KayKit FREE GLTFs into `public/assets/models/addons/kaykit_medieval_hexagon_pack/Assets/gltf/`. The plan + runtime are deterministic — same seed, same render, byte-for-byte.

> The snippet uses [`@react-three/fiber`](https://github.com/pmndrs/react-three-fiber) for the Canvas. That's an optional companion (`pnpm add @react-three/fiber`) — it's not a library dependency because consumers might prefer a different react-three layer. The library's own `/three` subpath gives you the raw helpers if you want to skip react-three-fiber.

---

## Why this exists

- **Declarative API for hex worlds.** Describe what you want (a harbor, a forest, a cliff with three depth tiers). The library handles tile selection, connectivity, prop scatter, validation.
- **Deterministic seed-driven generation.** Same seed produces byte-identical output across processes + platforms. Server-authoritative simulation, save games, cross-process replay — all work out of the box.
- **First-class React + Three.js bindings.** Not optional peer-deps. The library tests against the versions it ships; install one package and start rendering.

---

## Module map

| Subpath | What it gives you |
|---|---|
| umbrella (`@jbcom/medieval-hexagon-gameboard`) | Everything. Prototyping. |
| `/gameboard` | Plan builder, tile + placement spec types |
| `/coordinates` | Hex algebra, axial / world transforms |
| `/scenario`, `/blueprint`, `/recipe` | Scenario → blueprint → recipe compiler |
| `/koota` | ECS world + actor / placement spawn helpers |
| `/runtime` | Runtime facade + snapshot |
| `/react` | React provider + hooks |
| `/three` | three.js loaders + scene helpers |
| `/bootstrap` | Programmatic asset bootstrap (CLI alternative) |
| `/errors` | `GameboardError` + 6 subclasses for `instanceof` catching |
| `/manifest/free`, `/manifest/schema` | The bundled FREE manifest metadata |

[Full subpath list with API reference →](https://jbcom.github.io/medieval-hexagon-gameboard/reference/)

---

## Docs

| Get started | Features | Reference |
|---|---|---|
| [Quickstart](https://jbcom.github.io/medieval-hexagon-gameboard/guides/getting-started/) | (coming in PRD F-Gallery) | [API (1107 pages)](https://jbcom.github.io/medieval-hexagon-gameboard/reference/) |
| [Asset bootstrap](https://jbcom.github.io/medieval-hexagon-gameboard/guides/asset-bootstrap/) | [CLI](https://jbcom.github.io/medieval-hexagon-gameboard/guides/cli-reference/) | [Errors](https://jbcom.github.io/medieval-hexagon-gameboard/guides/errors/) |
| [Bindings + bundling](https://jbcom.github.io/medieval-hexagon-gameboard/guides/bindings/) | [Determinism contract](https://jbcom.github.io/medieval-hexagon-gameboard/guides/determinism/) | [Architecture](https://jbcom.github.io/medieval-hexagon-gameboard/about/architecture/) |
| [Testing](https://jbcom.github.io/medieval-hexagon-gameboard/guides/testing/) | [Design](https://jbcom.github.io/medieval-hexagon-gameboard/about/design/) | [Deployment](https://jbcom.github.io/medieval-hexagon-gameboard/about/deployment/) |

---

## CLI

The library ships a Node binary. Common commands:

```bash
medieval-hexagon-gameboard bootstrap       # download FREE pack assets (run once)
medieval-hexagon-gameboard doctor          # check local setup
medieval-hexagon-gameboard validate-scenario --scenario ./my-scenario.json
medieval-hexagon-gameboard coverage --json # release-readiness ledger
```

[Full CLI reference →](https://jbcom.github.io/medieval-hexagon-gameboard/guides/cli-reference/)

---

## What ships

- The npm tarball is small (~2.3 MB; 134 files). It contains the manifest, the compiled JS + DTS, the README, and a handful of curated showcase PNGs.
- The KayKit FREE GLTF tree (~30 MB; 221 models) is bootstrap-fetched at install time. CC0 license; the bootstrap command also writes a SHA256 integrity sidecar.
- The EXTRA edition is a paid itch.io purchase. The library supports it via `bootstrap --source zip --zip <your-extra.zip>` but never bundles it.

---

## Contributing

`pnpm verify` runs every CI gate locally. See [CONTRIBUTING.md](./CONTRIBUTING.md). The work queue lives in [`.agent-state/directive.md`](./.agent-state/directive.md); the PRD in [`docs/PRD/1.0.md`](./docs/PRD/1.0.md) explains the why.

Conventional Commits required. PRs are squash-merged. Coverage gate ratchets toward 100 / 100 / 100 / 100 (currently at the measured floor + slack; regressions block merge).

---

## License

[MIT](./LICENSE) for the library code.

KayKit Medieval Hexagon Pack © Kay Lousberg, [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/). Adventurers / EXTRA pack and other KayKit content have their own licenses; see `NOTICE.md`.
