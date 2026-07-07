---
status: implemented
last_verified: 2026-06-25
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
  - src/gameboard/assets.ts
  - src/gameboard/gameboard.ts
  - src/gameboard/terrain.ts
  - src/koota/koota.ts
  - src/rules/rules.ts
  - src/react/react.ts
  - typedoc.json
  - tests/contract/docs-pillars-contract.test.ts
  - tests/contract/free-manifest-contract.test.ts
  - tests/contract/reference-tree-contract.test.ts
  - tests/contract/tarball-contract.test.ts
  - tests/contract/workflows-contract.test.ts
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
  - tests/contract/docs-pillars-contract.test.ts
  - tests/contract/free-manifest-contract.test.ts
  - tests/contract/reference-tree-contract.test.ts
  - tests/contract/tarball-contract.test.ts
  - tests/contract/workflows-contract.test.ts
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
- `pnpm test` owns the source-level unit, integration, and contract suites,
  including pillar frontmatter/link checks, workflow contracts, package boundary
  contracts, manifest drift contracts, and CLI command behavior.
- `pnpm coverage:all:enforce` owns the required merged coverage ratchet: unit
  coverage, browser-free coverage, and the merged threshold enforcement used by
  CI's `Coverage` job.
- `pnpm test:browser:free` is the full local visual gate for committed FREE
  screenshots. CI's coverage job runs the browser-free coverage harness after
  bootstrapping FREE models, while the full screenshot command remains a local
  rendering/API-change proof step.
- `pnpm docs-site:build` validates the generated CLI reference and Astro
  Starlight site.
- Release-time tarball, audit, SBOM, provenance, and publish checks live in
  `release.yml`, not the per-PR CI workflow.
- `pnpm expectations` validates behavior-drift assertions for simulation
  expectations, packaged SimpleRPG examples, quests, actors, commands,
  actor-target records, patrols, movement, mutations, and final placements.
- Contract tests validate Markdown TypeScript snippets for duplicate object
  keys, keeping documented recipes and scenario examples from drifting into
  copy/paste-invalid shapes.
- TypeDoc entry points are derived from every public TypeScript export surface;
  every entry point must carry top-level `@module` JSDoc, and the docs/API
  contract tests plus `pnpm docs-site:build` must verify the public export map,
  top-level module docs, and zero not-documented warnings before API docs are
  considered complete.
- `tests/contract/workflows-contract.test.ts` validates the requested CI/CD,
  Release Please, Dependabot grouping, and automerge workflow contracts.
- Visual tests must produce reviewable screenshots or contact sheets for guide
  permutations, not only boolean assertions.
