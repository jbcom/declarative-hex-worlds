---
title: Public API tier table
description: Three-tier export taxonomy (umbrella / domain subpath / internal).
---
`declarative-hex-worlds` publishes one umbrella entry plus a wide
set of subpath exports. **Every subpath stays supported through 1.0** — this
is an asset-bundled library where mod authors, custom-renderer builders, and
data-inspection tooling all have legitimate reasons to reach internals.

What changes between tiers is the **stability contract**, not the
availability. Pick the tier that matches your tolerance for breakage; the
tooling and TSDoc tags tell you which tier a symbol belongs to.

## Tier 1 — Stable

Semver-strict. Breaking changes only on major versions, always with a
migration guide.

| Subpath | Purpose |
|---|---|
| `.` (umbrella) | Default entry. Re-exports the consumer-facing surface from every tier-1 sub-package. |
| `./react` | React bindings. First-class (NOT peer-gated). Hooks, providers, components. |
| `./three` | Three.js bindings. First-class (NOT peer-gated). Loaders, disposers, scene helpers. |
| `./cli` | CLI entry (also installed as the `declarative-hex-worlds` bin). |
| `./manifest/schema` | `MedievalHexagonManifest` shape + validators. |
| `./manifest/free` | Pre-baked FREE-edition manifest metadata. |
| `./scenario` | `GameboardScenario`, blueprint/recipe/catalog/registry. |
| `./blueprint` | `GameboardBlueprintOptions` and procedural board generation. |
| `./gameboard` | Board lifecycle, occupancy, navigation. |
| `./recipe` | Recipe DSL. |
| `./coverage` | Release-readiness coverage ledger surface for build/review tooling, not runtime ECS adapter glue. |
| `./compatibility` | Manifest/version compatibility helpers. |
| `./errors` | `GameboardError` + typed subclasses (Epic D2). |
| `./traits` | Single trait umbrella (all `trait()` declarations). |
| `./types` | Shared primitive types + branded IDs (`HexKey`, `ActorId`, etc.). |
| `./examples/*.json` | Bundled example scenario JSON. |

TSDoc tag: `@public`.

## Branded ID migration status

The `./types` subpath exports branded ID aliases and `brand*` helpers, but
branded IDs are **NOT yet enforced** across the runtime. Public JSON, manifest,
CLI, and ECS-facing shapes still use plain strings unless a domain row below
states that enforcement has landed. Treat the aliases as opt-in compile-time
helpers until the relevant domain moves to `enforced`.

| Domain(s) | Brands tracked | Current status |
|---|---|---|
| `./types` | `HexKey`, `ActorId`, `TileId`, `PieceId`, `PlacementId`, `ScenarioId`, `QuestId`, `ObjectiveId`, `PatrolRouteId`, `AssetId` | Registry exported; `brand*` helpers are stable and available to consumers. |
| `./coordinates`, `./grid`, `./layout`, `./gameboard` | `HexKey`, `TileId` | Not yet enforced; public APIs still accept coordinate objects and plain string IDs. |
| `./scenario`, `./recipe`, `./blueprint`, `./simulation`, `./pieces` | `ScenarioId`, `PieceId`, `PlacementId`, `TileId`, `AssetId` | Not yet enforced; scenario JSON and generated plans keep wire-compatible string fields. |
| `./actors`, `./movement`, `./patrol`, `./quests` | `ActorId`, `PatrolRouteId`, `QuestId`, `ObjectiveId` | Not yet enforced; ECS traits, commands, and query helpers still expose string-compatible IDs. |
| `./manifest/schema`, `./manifest/free`, `./ingest`, `./runtime`, `./react`, `./three` | `AssetId` | Not yet enforced; asset IDs remain manifest and URL-facing strings. |
| `./cli`, `./interop`, `./compatibility`, `./coverage` | Pass-through IDs only | Not yet enforced; these surfaces preserve external wire formats and report existing domain values. |

## Tier 2 — Supported-for-extension

Semver-strict for what's documented, but the surface contract is smaller
than tier 1. Mod authors and custom-renderer consumers can depend on these;
breaking changes still require a major + migration guide but the "what's
breaking" frame may be narrower (a specific function signature changing
rather than the whole module shape).

| Subpath | Purpose |
|---|---|
| `./koota` | World bootstrap, trait sets, query patterns. |
| `./runtime` | High-level runtime composition. |
| `./actors` | Actor surface + queries. |
| `./movement` | Movement-agent surface. |
| `./patrol` | Patrol-route surface. |
| `./quests` | Quest surface. |
| `./pieces` | Piece declarations + placement helpers. |
| `./projection` | World-space placement projection. |
| `./layout` | Seeded board layout generation. |
| `./grid` | Honeycomb-grid wrappers + hex algebra. |
| `./coordinates` | Hex coordinate algebra (umbrella over grid/projection/layout). |
| `./validation` | Plan-level validators. |
| `./rules` | Rule definitions + evaluation. |

TSDoc tag: `@public` (no distinct tag — tier 2 is documented here in the
table, not on every symbol).

## Tier 3 — Internal-but-exposed

Semver-**permissive**: minor versions may change these surfaces in
non-trivial ways. Consumers who pin tier-3 imports accept this tradeoff.
Useful for very-deep modding, debugging, and tools that need to inspect
or hook the implementation.

| Subpath | Purpose |
|---|---|
| `./commands` | Internal command-factory plumbing. |
| `./selectors` | Per-render shape pickers used by React/Three bindings. |
| `./systems` | Tickable system functions. |
| `./world-rules` | Runtime rule-evaluation system. |
| `./rule-types` | Rule typed shapes (re-exported from `./rules` — prefer that). |
| `./interop` | Runtime ECS adapter glue and schema migrations; release-readiness coverage is the separate stable `./coverage` surface. |
| `./ingest` | Source-tree walker + manifest emission (precursor to bootstrap). |
| `./registry` | Tile/piece registries (re-exported from `./scenario`). |
| `./catalog` | KayKit asset catalog (re-exported from `./scenario`). |

TSDoc tag: `@internal` (still exported, still typed, still tested — just
flagged so consumers see the support tier inline).

## Why the three tiers?

Phase 1's architecture review (F1) noted that the 37+ subpath exports
permanently pin every internal module as a semver surface point. The
original recommendation was to demote ~10 subpaths and force everything
through the umbrella.

Per PRD §4 Epic D1 (re-scoped), that was rejected: this library bundles
the FREE KayKit pack so consumers get a working game out-of-box, and the
"out-of-box" promise extends to consumers who want to reach internals
for legitimate reasons (custom renderers, modding, data inspection). The
right tradeoff is **documented tiering**, not gated demotion.

If a tier-3 surface stabilizes (a custom-renderer mod has been depending
on `./selectors` for two minor versions without breakage), it can be
promoted to tier 2 via a CHANGELOG note. The reverse (demoting a tier-1
surface) is a major-version event.

## Trait identity invariant

Regardless of tier, every `trait()` declaration is exported from **exactly
one module**. `tsup`'s `splitting: true` keeps shared chunks stable so
that two consumers importing `GameboardActor` from different subpaths
(e.g. one via `./actors`, another via the umbrella) get the SAME trait
identity — which is what koota's `useQuery` reference-equality lookups
depend on.

Don't try to "optimize" by re-declaring a trait somewhere else. Don't
fork the trait file into a "local" copy. The trait-identity test (Epic
E4, pending) pins this.
