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
| `./coverage` | Release-readiness coverage ledger surface. |
| `./compatibility` | Manifest/version compatibility helpers. |
| `./errors` | `GameboardError` + typed subclasses (Epic D2). |
| `./traits` | Single trait umbrella (all `trait()` declarations). |
| `./types` | Shared primitive types + branded IDs (`HexKey`, `ActorId`, etc.). |
| `./examples/*.json` | Bundled example scenario JSON. |

TSDoc tag: `@public`.

## Branded ID migration status

`./types` exports branded string primitives (`HexKey`, `ActorId`, `TileId`,
`PieceId`, `PlacementId`, `ScenarioId`, `QuestId`, `ObjectiveId`,
`PatrolRouteId`, `AssetId`) plus `brand*` helpers. These exports are stable,
but branded IDs are **not yet enforced across the codebase**. Current domain
APIs still accept and return plain strings for compatibility with existing JSON
documents, manifests, reports, and consumer code. Treat the helpers as opt-in
compile-time guards until the per-domain migration below moves to "enforced".

| Domain / subpath | Branded IDs involved | Current migration state |
|---|---|---|
| `./types` | All branded primitives + `brand*` helpers | Central registry is exported and stable. Helpers cast caller-validated strings; no runtime boxing or validation is added. |
| `./coordinates`, `./grid`, `./gameboard` | `HexKey`, `TileId`, `PlacementId`, `AssetId` | Not yet enforced. Hex utilities, board specs, and placement records still use plain strings. |
| `./scenario`, `./blueprint`, `./recipe` | `ScenarioId`, `ActorId`, `PatrolRouteId`, `AssetId`, `PieceId`, `TileId` | Not yet enforced. Authored JSON and recipe/schema surfaces remain string-compatible. |
| `./actors`, `./movement`, `./patrol`, `./quests` | `ActorId`, `PlacementId`, `QuestId`, `ObjectiveId`, `PatrolRouteId`, `HexKey` | Not yet enforced. Runtime traits and action options still preserve existing string contracts. |
| `./pieces`, `./manifest/*`, `./catalog`, `./registry` | `PieceId`, `AssetId`, `TileId` | Not yet enforced. Catalog helpers also expose literal asset-id unions that are separate from branded `AssetId`. |
| `./commands`, `./systems`, `./simulation`, `./interop`, `./selectors`, `./runtime`, `./react`, `./three` | Cross-domain IDs from the rows above | Not yet enforced. These packages forward IDs from lower-level DTOs and will migrate after the owning domains do. |

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
| `./interop` | Schema migrations + ECS adapter glue. |
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
