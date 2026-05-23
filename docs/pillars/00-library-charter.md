---
status: implemented
last_verified: 2026-05-23
source_images:
  - docs/assets/kaykit-guide/montage.png
  - docs/assets/kaykit-guide/pages/page-01.png
  - docs/assets/kaykit-guide/pages/page-19.png
source_pack: references/KayKit_Medieval_Hexagon_Pack_1.0_FREE
implementation_links:
  - packages/medieval-hexagon-gameboard/src/index.ts
  - packages/medieval-hexagon-gameboard/src/types.ts
  - packages/medieval-hexagon-gameboard/src/gameboard.ts
  - packages/medieval-hexagon-gameboard/src/koota.ts
  - packages/medieval-hexagon-gameboard/src/rules.ts
  - packages/medieval-hexagon-gameboard/src/react.ts
  - typedoc.json
  - scripts/audit-docs-contract.ts
  - scripts/audit-free-assets.ts
  - scripts/audit-package.ts
  - scripts/audit-workspace.ts
  - scripts/audit-workflows.ts
  - scripts/smoke-built-cli.ts
  - scripts/smoke-packed-consumer.ts
test_links:
  - packages/medieval-hexagon-gameboard/tests/unit/manifest.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/gameboard.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/koota.test.ts
  - packages/medieval-hexagon-gameboard/tests/unit/rules.test.ts
  - scripts/audit-docs-contract.ts
  - scripts/audit-free-assets.ts
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

- Package name: `@jbcom/medieval-hexagon-gameboard`.
- Code license: MIT.
- Asset license: KayKit Medieval Hexagon Pack assets are CC0-1.0.
- Toolchain contract: Node 22+ and pnpm 9.
- Runtime dependencies: `honeycomb-grid`, `koota`, and `seedrandom`.
- Optional peer surfaces: React for `./react` bindings and Three.js for
  `./three` placement/render helpers.
- The main API must expose board intent: elevated terrain stacks, roads, rivers,
  coasts, settlements, harbors/ports, deterministic scatter, and Koota state.

## Implementation rules

- `references/` is the local source input and remains ignored.
- `packages/medieval-hexagon-gameboard/assets/free/` is generated from FREE and is
  committed for npm publishing.
- Generated manifests are the runtime catalog; source images and pillar docs are
  the human contract for future changes.
- `pnpm test:docs-contract` validates every pillar's required frontmatter, source
  images, implementation links, and test links before docs publish or release.
- `pnpm test:assets` validates the packaged FREE GLTF/BIN/PNG tree against the
  generated manifest, expected taxonomy counts, bounds, local-path exclusion, and
  NOTICE attribution.
- `pnpm test:workspace` validates Nx target wiring, pnpm workspace config,
  VitePress docs dependency alignment, and tsup entries against the package
  export map.
- `pnpm test:cli` validates the built CLI against the packaged FREE manifest,
  packaged examples, the SimpleRPG simulation, and synthetic external GLTF
  fixtures for compatibility plus custom-piece declarations.
- `pnpm test:consumer` validates the npm tarball from a fresh temporary app,
  compiling public TypeScript imports from `node_modules` and running the
  installed CLI.
- `pnpm test:package` validates the package export map, publish whitelist,
  packed example/data boundary, built CLI bin, and absence of machine-local paths
  or embedded source-map source content in packed text files.
- TypeDoc entry points are derived from every public TypeScript export surface;
  `pnpm test:api-docs` must pass with zero not-documented warnings before API
  docs are considered complete.
- `pnpm test:workflows` validates the requested CI/CD, Release Please,
  Dependabot grouping, and automerge workflow contracts.
- Visual tests must produce reviewable screenshots or contact sheets for guide
  permutations, not only boolean assertions.
