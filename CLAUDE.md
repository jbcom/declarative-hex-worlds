<!-- profile: ts-library + standard-repo v1 -->
# @jbcom/medieval-hexagon-gameboard

Deterministic KayKit Medieval Hexagon gameboard runtime with Koota ECS state and FREE GLTF assets. Published-to-npm TypeScript library exposing Koota traits, scenario engine, simulation, CLI, and optional React + Three.js bindings.

**Product shape:** this is an *asset-bundled* library — the entire FREE KayKit Medieval Hexagon pack ships *with* the package and must be usable end-to-end the moment a consumer adds it to a project. Cross-kit composition (small parts of other free kits used in CI) is exercised by the SimpleRPG e2e scenario. Optimization decisions that punish "ready out-of-box" — e.g. removing the manifest from the umbrella, lazy-loading assets across the public API — are off the table. Optimization that doesn't punish that — e.g. building the bundled manifest from a single source-of-truth, lazy CLI subcommand loads, hot-path micro-optimizations inside the runtime — stays on.

## Profiles loaded

@/Users/jbogaty/.claude/profiles/ts-library.md
@/Users/jbogaty/.claude/profiles/standard-repo.md

## Repo-specific

- **Package:** `@jbcom/medieval-hexagon-gameboard` published from **repo root** (not a workspace). pnpm workspaces dropped during 1.0 restructure (see PRD Epic R). Use pnpm only for install + script-running; no `workspace:` protocol, no `pnpm-workspace.yaml`, no `apps/` consumer package.
- **`src/` layout:** koota-idiomatic decomposition (mirrors `reference-codebases/koota/examples/cards/src` and `n-body-react/src`). Composition layer at `src/` root (`world.ts`, `actions.ts`, `frameloop.ts`, `startup.ts`, `index.ts`). Domain sub-packages each with a barrel `index.ts`:
  - `src/types/` — branded primitives (`HexKey`, `ActorId`, etc.)
  - `src/coordinates/` — pure hex algebra (grid, projection, layout, hex-key)
  - `src/traits/` — koota `trait()` declarations, grouped: `{board,actors,movement,combat,quests,render}.ts`
  - `src/systems/` — one file per tickable system (`movement-system.ts`, `patrol-system.ts`, …)
  - `src/selectors/` — `@internal` query selectors used by React hooks
  - `src/commands/` — `@internal` factories consumed by `src/actions.ts`
  - `src/gameboard/` — gameboard, occupancy, navigation
  - `src/pieces/` — piece declarations + placement helpers
  - `src/scenario/` — scenarios, recipes, blueprints, registry, catalog
  - `src/rules/` — rules, rule-types, validation
  - `src/simulation/` — engine, script, report, assertions (Epic D3 decomposition)
  - `src/manifest/` — schema + bundled FREE manifest + lazy loader
  - `src/ingest/` — KayKit source ingestion + secure walker
  - `src/interop/` — interop, compatibility, coverage
  - `src/errors/` — `GameboardError` hierarchy (Epic D2)
  - `src/cli/` — CLI + per-subcommand modules (Epic B3)
  - `src/react/` — optional React bindings (peer-dep gated)
  - `src/three/` — optional Three.js bindings (peer-dep gated + disposal helpers)
  - **Cross-domain imports MUST traverse barrels** — `import {…} from '../scenario'`, never `import {…} from '../scenario/recipe'`. Biome `noRestrictedImports` enforces. See PRD Appendix C for full layout.
- **SimpleRPG lives in tests, not src/.** `tests/integration/simple-rpg/` for fixture + behavior tests; `tests/e2e/simple-rpg/` for end-to-end playwright runs. NOT a public consumer-facing example, NOT published.
- **Node ≥22, pnpm ≥9 (script-runner only)**, ESM-only, sideEffects:false.
- **Build:** `pnpm build` (tsup, multi-entry from the sub-package barrels).
- **Lint:** `pnpm lint` (biome on src/ + tests/ + scripts/).
- **Typecheck:** `pnpm typecheck` (`tsc --noEmit`).
- **Test:** `pnpm test` (unit, with coverage gate) / `pnpm test:browser` (vitest-browser visual + integration) / `pnpm test:e2e` (playwright with bundled + local assets).
- **Coverage:** **100 / 100 / 100 / 100** required, instrumented across unit + browser + e2e harnesses (Epic E0 ratchets up from baseline 86/76/93/86).
- **Full local gate:** `pnpm verify` runs every CI step in order.
- **Docs:** `pnpm docs` (typedoc) + `pnpm docs:build` (vitepress). `apps/docs/` is the only legitimate "second package" — and even that lives as a sub-folder consumed by vitepress directly; no workspace registration.
- **Release:** release-please → `release.yml` builds + `npm publish --provenance` → `cd.yml` deploys docs.

## Architecture invariants (DO NOT VIOLATE)

0. **100 % test coverage.** Statements, branches, functions, and lines must all read 100 % across `src/`, `examples/`, and `scripts/`. Every behavior is covered by **unit tests**, integration paths are confirmed **visually in the browser** via vitest-browser screenshot snapshots, and full flows are exercised by **e2e** under playwright/local-assets. Anything less is unacceptable. CI gates on the 100 % threshold and on screenshot drift. New code without a co-landing test is a bug — fix the gap before the commit lands.
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
