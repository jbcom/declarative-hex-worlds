<!-- profile: ts-library + standard-repo v1 -->
# @jbcom/medieval-hexagon-gameboard

Deterministic KayKit Medieval Hexagon gameboard runtime with Koota ECS state and FREE GLTF assets. Published-to-npm TypeScript library exposing Koota traits, scenario engine, simulation, CLI, and optional React + Three.js bindings.

**Product shape:** this is an **asset-bootstrapping** library, not an asset-bundled one. The published npm tarball does NOT ship the KayKit GLTF asset trees. Instead, the CLI offers a `bootstrap` (and equivalent programmatic API) that:
- Detects (or accepts `--out`) the consumer's assets directory (default: `public/assets/models`).
- Downloads from the KayKit GitHub source (FREE) — or accepts a `--zip` path (for FREE / EXTRA bought from itch.io).
- Auto-detects edition from zip structure.
- Mirrors the upstream tree under `<out>/addons/kaykit_medieval_hexagon_pack/Assets/gltf` (or equivalent path the upstream provides), **gltf only** — fbx/obj are ignored.
- The manifest (`@jbcom/medieval-hexagon-gameboard/manifest/free` etc.) ships as JSON metadata describing what should exist after a successful bootstrap. The runtime resolves asset URLs against the consumer's bootstrapped tree at game-init time.

The library is the API surface; the asset tree is consumer-owned. SimpleRPG (test-only, per earlier directive) exercises both the bootstrap path AND the post-bootstrap render in e2e/integration tests.

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
- **SimpleRPG is a fully-functional, precisely-scoped library coverage driver.** Lives at `tests/simple-rpg/`. Its only purpose: exercise every library capability — gameboard + blueprint + actors + pieces + movement + patrol + quests + rules + simulation + React + Three + CLI + bootstrap + manifest + cross-kit composition. Two embedded asset dirs:
  - `tests/simple-rpg/assets-embedded/` (gitignored, holds EXTRA-pack pieces for inject-tile/inject-prop tests).
  - `tests/simple-rpg/assets-bootstrap-target/` (gitignored, the CLI `bootstrap` target during tests; cleared between runs).
  E2E modes: `--source github` (CI scheduled) + `--source zip` (local-only, against `references/`).
- **Co-locate unit tests under `src/<domain>/__tests__/`.** Avoids the test-vs-source path-bridge brittleness that R1 surfaced. Integration tests live at `tests/integration/`, e2e at `tests/e2e/`, browser visuals at `tests/browser/`. (Per Epic R item R3b.)
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
5. **React + Three bindings are FIRST-CLASS, not optional.** Like koota itself, react + react-dom + three are **runtime dependencies** (`dependencies`, not `peerDependencies`), because the library's job is API-driven declaration of either a fixed gameboard or a procedurally generated seed map — and the bindings are how consumers actually wire it into their app. The umbrella re-exports `react/` and `three/` like every other sub-package. No "peer guard"; no consumer permitted to lack the dep.
6. **The FREE manifest is shipped as metadata; assets are bootstrapped, not bundled.** `freeManifest` (JSON describing the expected asset tree) MUST be reachable from the umbrella so consumers can plan/validate against it before running `bootstrap`. The CLI `bootstrap` command (and its programmatic equivalent) downloads from KayKit's GitHub source or extracts from a user-supplied zip, mirrors the upstream gltf-only tree under `<out>/addons/kaykit_medieval_hexagon_pack/`, and emits a checksum-verified install report. fbx/obj are ignored. **Never publish raw asset trees in the tarball.**
7. **`splitting: true`** in tsup is intentional (Koota trait identity). Don't disable without writing the cross-subpath identity test first.

## Dependency policy

- **Add any library that solves a problem.** Runtime dep if it ships with the package; dev dep if it only runs in the toolchain. Reluctance to add a dep is the wrong default — duplicating well-trodden ground (regex helpers, hex algebra, immutability, schema validation, retry, etc.) just to "stay lean" is rejected. The published surface stays focused; the *implementation* takes whatever leverage it needs.
- **Always-latest.** `pnpm update --latest` is run as part of every Epic R / Epic G boundary commit and any time a directive item touches dependency manifests. Major bumps go through their own commit with a behavior-drift expectation test attached. Use `pnpm outdated` to inspect before bumping.
- **No optional bindings.** react / react-dom / three / koota / honeycomb-grid / seedrandom are all **runtime `dependencies`**. The library is unusable without them — guard rails for "missing peer" don't apply.

## In-flight work

- 1.0 stabilization. See `docs/PRD/1.0.md` and `.agent-state/directive.md`.
- Comprehensive review outputs in `.full-review/` (Phase 1-5).

## Notes

- This is a monorepo. Most architecture lives under `packages/medieval-hexagon-gameboard/`. Workspace-root `scripts/` audits + smoke-tests it.
- `apps/docs/` is the vitepress consumer of `docs/` content.
- `references/KayKit_Medieval_Hexagon_Pack_1.0_FREE/` is the asset source-of-truth for `manifest/free`.
- Coverage gates live in `.claude/gates.json` (commit-gate.mjs). Visual checks: vitest-browser screenshots in `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/`.
