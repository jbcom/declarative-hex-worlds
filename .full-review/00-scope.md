# Review Scope

## Target

Comprehensive review of the `@jbcom/medieval-hexagon-gameboard` library:
- **Runtime package source**: `packages/medieval-hexagon-gameboard/src/` (~58,280 LOC across 38 TS modules)
- **Audit/build scripts**: `scripts/` (~7,491 LOC, 12 audit/smoke scripts)

Branch: `codex/initial-medieval-hexagon-gameboard` (146 commits ahead of `main`, ~190K insertions).
This is the initial implementation of a deterministic KayKit Medieval Hexagon gameboard runtime that ships:
- Koota ECS state primitives
- Honeycomb-grid coordinates / layout / projection
- Scenario / simulation / quest / patrol / movement / rule engines
- Three.js + React bindings
- A CLI (`medieval-hexagon-gameboard`) with coverage/ingest commands
- A FREE-edition asset manifest (GLTF/GLB) baked at build time

## Files

### Runtime sources (packages/medieval-hexagon-gameboard/src)

Large modules (notable footprints):
- `manifest/free.ts` (16,561 LOC — generated asset manifest)
- `simulation.ts` (5,213)
- `cli.ts` (4,297)
- `catalog.ts` (2,398)
- `interop.ts` (2,383)
- `actors.ts` (2,260)
- `gameboard.ts` (2,173)
- `layout.ts` (1,872)
- `scenario.ts` (1,418)
- `koota.ts` (1,349)

Other modules: `actors`, `blueprint`, `catalog`, `commands`, `compatibility`, `coordinates`, `coverage`, `gameboard`, `grid`, `index`, `ingest`, `interop`, `koota`, `layout`, `manifest/{schema,free}`, `movement`, `navigation`, `occupancy`, `patrol`, `pieces`, `projection`, `quests`, `react`, `recipe`, `registry`, `rule-types`, `rules`, `runtime`, `scenario`, `selectors`, `simulation`, `systems`, `three`, `types`, `validation`, `world-rules`, `cli`.

### Scripts (scripts/)

- `audit-api-docs.ts`
- `audit-docs-contract.ts`
- `audit-free-assets.ts`
- `audit-package.ts`
- `audit-reference-assets.ts`
- `audit-workflows.ts`
- `audit-workspace.ts`
- `extract-kaykit-guide.ts` / `.swift`
- `generate-package-assets.ts`
- `promote-showcases.ts`
- `smoke-built-cli.ts`
- `smoke-packed-consumer.ts`

## Flags

- **Security Focus**: yes — CLI accepts user input/file paths, asset ingest reads filesystem, manifests are generated from references/
- **Performance Critical**: yes — game runtime (simulation loops, ECS systems, render bindings)
- **Strict Mode**: no
- **Framework**: TypeScript / Vitest / Three.js / React / Koota ECS / honeycomb-grid

## Review Phases

1. Code Quality & Architecture
2. Security & Performance
3. Testing & Documentation
4. Best Practices & Standards
5. Consolidated Report
