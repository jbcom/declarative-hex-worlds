<!-- profile: ts-library + standard-repo v1 -->
# @jbcom/medieval-hexagon-gameboard

Deterministic KayKit Medieval Hexagon gameboard runtime with Koota ECS state and FREE GLTF assets. Published-to-npm TypeScript library exposing Koota traits, scenario engine, simulation, CLI, and optional React + Three.js bindings.

**Product shape:** this is an *asset-bundled* library — the entire FREE KayKit Medieval Hexagon pack ships *with* the package and must be usable end-to-end the moment a consumer adds it to a project. Cross-kit composition (small parts of other free kits used in CI) is exercised by the SimpleRPG e2e scenario. Optimization decisions that punish "ready out-of-box" — e.g. removing the manifest from the umbrella, lazy-loading assets across the public API — are off the table. Optimization that doesn't punish that — e.g. building the bundled manifest from a single source-of-truth, lazy CLI subcommand loads, hot-path micro-optimizations inside the runtime — stays on.

## Profiles loaded

@/Users/jbogaty/.claude/profiles/ts-library.md
@/Users/jbogaty/.claude/profiles/standard-repo.md

## Repo-specific

- **Package:** `@jbcom/medieval-hexagon-gameboard` (published from `packages/medieval-hexagon-gameboard/`)
- **Workspace manager:** `pnpm@9.15.9`, Node ≥22
- **Build:** `pnpm build` (Nx → tsup per package)
- **Lint:** `pnpm lint` (workspace Biome + per-package Biome)
- **Typecheck:** `pnpm typecheck`
- **Test:** `pnpm test` (unit) / `pnpm test:browser:free` / `pnpm test:browser:extra` / `pnpm test:e2e:local-assets`
- **Full local gate:** `pnpm verify` (typecheck + docs-contract + api-docs + docs:build + assets + workspace + workflows + build + cli + expectations + test + package + consumer + pack:dry-run)
- **Docs:** `pnpm docs` (typedoc) + `pnpm docs:build` (vitepress)
- **Release:** release-please → `release.yml` builds + `npm publish --provenance` → `cd.yml` deploys docs

## Architecture invariants (DO NOT VIOLATE)

1. **Determinism is the product.** All RNG flows through `seedrandom` from `src/blueprint.ts`/`coordinates.ts`/`gameboard.ts`/`layout.ts`/`rules.ts`. **No `Math.random`** in `packages/medieval-hexagon-gameboard/src/`. Cosmetic `new Date()` is only acceptable in CLI output formatters with an override flag.
2. **No `any`, no `@ts-ignore`, no non-null assertions.** Biome enforces. Phase 1 verified zero hits; keep it so.
3. **No `TODO`/`FIXME`/`it.todo`/`describe.skip`/stubs.** Either fix or delete.
4. **Public API surface is tiered** (see PRD §F1) — internal modules MUST NOT be added to `package.json#exports` without explicit promotion.
5. **`react.ts` / `three.ts` are peer-dep gated** — never re-export from `src/index.ts`.
6. **The bundled FREE manifest is the product.** `freeManifest` MUST be reachable from the umbrella `index.ts` for ergonomic out-of-box use. The literal lives at `src/manifest/free.ts` (regenerated from `assets/free/manifest.json` via `pnpm assets:free`). Storage format (TS literal vs JSON import-attribute) is an implementation detail; the **export** stays umbrella-visible. Removing it from the umbrella is OFF the table.
7. **`splitting: true`** in tsup is intentional (Koota trait identity). Don't disable without writing the cross-subpath identity test first.

## In-flight work

- 1.0 stabilization. See `docs/PRD/1.0.md` and `.agent-state/directive.md`.
- Comprehensive review outputs in `.full-review/` (Phase 1-5).

## Notes

- This is a monorepo. Most architecture lives under `packages/medieval-hexagon-gameboard/`. Workspace-root `scripts/` audits + smoke-tests it.
- `apps/docs/` is the vitepress consumer of `docs/` content.
- `references/KayKit_Medieval_Hexagon_Pack_1.0_FREE/` is the asset source-of-truth for `manifest/free`.
- Coverage gates live in `.claude/gates.json` (commit-gate.mjs). Visual checks: vitest-browser screenshots in `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/`.
