---
status: implemented
last_verified: 2026-05-24
source_images:
  - docs/assets/kaykit-guide/montage.png
  - docs/assets/kaykit-guide/pages/page-01.png
  - docs/assets/kaykit-guide/pages/page-19.png
source_pack: references/KayKit_Medieval_Hexagon_Pack_1.0_FREE
implementation_links:
  - docs/release-readiness.json
  - docs/guides/release-readiness.md
  - docs/examples/blueprint-board.json
  - src/index.ts
  - src/scenario/blueprint.ts
  - src/cli/cli.ts
  - src/interop/coverage.ts
  - src/types/index.ts
  - src/gameboard/gameboard.ts
  - src/koota/koota.ts
  - src/rules/rules.ts
  - src/react/react.ts
  - typedoc.json
  - scripts/audit-docs-contract.ts
  - scripts/audit-free-assets.ts
  - scripts/audit-reference-assets.ts
  - scripts/audit-package.ts
  - scripts/audit-workspace.ts
  - scripts/audit-workflows.ts
  - scripts/smoke-built-cli.ts
  - scripts/smoke-packed-consumer.ts
  - examples/blueprint-board-usage.ts
test_links:
  - src/interop/__tests__/coverage.test.ts
  - src/scenario/__tests__/blueprint.test.ts
  - src/cli/__tests__/cli.test.ts
  - src/manifest/__tests__/manifest.test.ts
  - src/gameboard/__tests__/gameboard.test.ts
  - src/koota/__tests__/koota.test.ts
  - src/rules/__tests__/rules.test.ts
  - scripts/audit-docs-contract.ts
  - scripts/audit-free-assets.ts
  - scripts/audit-reference-assets.ts
  - scripts/audit-package.ts
  - scripts/audit-workspace.ts
  - scripts/audit-workflows.ts
  - scripts/smoke-built-cli.ts
  - scripts/smoke-packed-consumer.ts
---

# Library Charter

This project packages KayKit's Medieval Hexagon Pack as a TypeScript gameboard
runtime. The public npm package includes the FREE edition's CC0 GLTF assets,
typed manifests, deterministic board builders, Koota ECS traits/actions/queries,
React bindings, selector utilities, and Three.js placement helpers.

The EXTRA edition is not redistributed. Consumers who own it can point the CLI at a
local source folder and generate an app-local bundle plus manifest. That keeps the
open source package useful while preserving the local-only purchased workflow.

## Public contract

- Package name: `declarative-hex-worlds`.
- Code license: MIT.
- Asset license: KayKit Medieval Hexagon Pack assets are CC0-1.0.
- Toolchain contract: Node 22+ and pnpm 9.
- Runtime dependencies: `honeycomb-grid`, `koota`, and `seedrandom`.
- Optional peer surfaces: React for `./react` bindings and Three.js for
  `./three` placement/render helpers.
- The main API must expose board intent: elevated terrain stacks, roads, rivers,
  coasts, settlements, harbors/ports, deterministic scatter, and Koota state.
- Board-scale authoring must have a first-class public path through
  `./blueprint`, where games or agents can specify biome fill percentages,
  maximum elevation, mountain ranges, towns, roads, rivers, harbors, transition
  policy, ramps, bridges, and density fills without dropping to per-tile
  placement code.

## Implementation rules

- `references/` is the local source input and remains ignored.
- `assets/free/` is generated from FREE and is
  committed for npm publishing.
- Generated manifests are the runtime catalog; source images and pillar docs are
  the human contract for future changes.
- `pnpm test:docs-contract` validates every pillar's required frontmatter, source
  images, implementation links, and test links before docs publish or release.
- `pnpm test:assets` validates the packaged FREE GLTF/BIN/PNG tree against the
  generated manifest, expected taxonomy counts, bounds, local-path exclusion, and
  NOTICE attribution.
- `pnpm test:reference-assets` validates the exact FREE/EXTRA source inventory
  when local `references/` folders are present, including EXTRA-only models,
  seasonal texture sets, and duplicate source basename disambiguation without
  committing purchased binaries.
- `pnpm test:workspace` validates Nx target wiring, pnpm workspace config,
  VitePress docs dependency alignment, and tsup entries against the package
  export map.
- `pnpm test:cli` validates the built CLI against the packaged FREE manifest,
  packaged examples, the SimpleRPG simulation, and synthetic external GLTF
  fixtures for compatibility plus custom-piece declarations.
- `pnpm expectations` validates behavior-drift assertions for simulation
  expectations, packaged SimpleRPG examples, quests, actors, commands,
  actor-target records, patrols, movement, mutations, and final placements.
- `pnpm test:consumer` validates the npm tarball from a fresh temporary app,
  compiling public TypeScript imports from `node_modules` and running the
  installed CLI.
- `pnpm test:package` validates the package export map, publish whitelist,
  packed example/data boundary, built CLI bin, KayKit attribution/NOTICE text,
  published README gallery links, packed showcase PNG quality, and absence of
  machine-local paths or embedded source-map source content in packed text
  files.
- `pnpm test:workspace` validates Markdown TypeScript snippets for duplicate
  object keys, keeping documented recipes and scenario examples from drifting
  into copy/paste-invalid shapes.
- TypeDoc entry points are derived from every public TypeScript export surface;
  every entry point must carry top-level `@module` JSDoc, and
  `pnpm test:api-docs` must verify the public export map, top-level module docs,
  and zero not-documented warnings before API docs are considered complete.
- `pnpm test:workflows` validates the requested CI/CD, Release Please,
  Dependabot grouping, and automerge workflow contracts.
- Visual tests must produce reviewable screenshots or contact sheets for guide
  permutations, not only boolean assertions.
