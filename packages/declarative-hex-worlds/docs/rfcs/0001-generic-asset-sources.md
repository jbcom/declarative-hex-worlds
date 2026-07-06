---
title: "RFC 0001 — Generic asset sources (GLTF packs + tilesets), KayKit-as-downloadable-default, SimpleRPG as a first-class consumer package, showcase-based visual verification"
status: draft
author: little-legends integration + dhw
created: 2026-07-06
supersedes_partially:
  - docs/pillars/02-asset-taxonomy.md (KayKit-only taxonomy)
  - docs/pillars/03-editions-and-ingest.md (KayKit-only ingest)
  - docs/pillars/04-visual-verification.md (vendor-guide backbone)
---

# RFC 0001 — Generic asset sources + first-class consumer package

## Structural reframe: pnpm workspace with SimpleRPG as a real consumer

**This SUPERSEDES Epic R (docs/PRD/1.0.md §Epic R).** Epic R deliberately de-monorepo'd
the repo (deleted `pnpm-workspace.yaml`, single package at root, SimpleRPG demoted to a
test fixture) because "the monorepo shape is wrong" — optimizing the *published tarball's*
devDependency hygiene. That optimization is preserved differently here: we return to a
workspace, but **only `declarative-hex-worlds` is published** (`private: true` on every
other member), so the published tarball stays exactly as lean as Epic R wanted while the
repo regains the structure needed for a live-consumer docs story.

**What of Epic R is KEPT vs reversed:**
- **KEPT** — Epic R #2 (domain sub-package decomposition of `src/` with barrel-only
  cross-domain imports, `noRestrictedImports` enforced). That internal structure is good
  and stays; it just now lives under `packages/declarative-hex-worlds/src/`.
- **REVERSED** — Epic R #1 (de-monorepo) and #3 (SimpleRPG-as-fixture-only). SimpleRPG
  becomes a real rendering consumer; the workspace returns.

Today SimpleRPG lives as headless files under `src/guides/simple-rpg/` — conceived only
as e2e-test logic. It becomes a **first-class package that consumes dhw**:

```
packages/
  declarative-hex-worlds/   # THE library — the ONLY published package (npm)
  simple-rpg/               # private: a REAL rendering consumer of declarative-hex-worlds
  docs-site/                # private: Astro docs-site, now a workspace member so it can
                            #   import SimpleRPG and run it LIVE in a React island
```

Only `declarative-hex-worlds` publishes to npm. `simple-rpg` and `docs-site` are
`private: true` — they consume the library, never ship. (docs-site currently has its own
detached `package.json` + lockfile; it joins the workspace, dropping its separate lockfile.)

Why this matters for this RFC specifically:

- **SimpleRPG becomes the canonical proof consumer** — the in-repo equivalent of what
  little-legends is externally. It dogfoods the generic asset-source interface: it can
  render KayKit FREE (`gltf-pack`) AND a tileset, proving both paths from inside the repo.
- **Showcase captures come from SimpleRPG** rendering FREE through the library (G5). The
  docs demonstrate *our library working*, not a vendor PDF — because the docs-site
  literally **runs** SimpleRPG in a React island (`@astrojs/react`, `client:load`),
  and the release-readiness showcases are screenshots of that same consumer.
- **The visual-verification backbone swap (G5) and the workspace promotion are the same
  move**: promoting SimpleRPG to a rendering package is what *produces* the showcase
  captures that replace the guide PDF.

Current gaps this entails: (a) no `pnpm-workspace.yaml` yet (single package); (b)
SimpleRPG is headless (no React render surface) — it needs a real R3F render path to be
capturable/embeddable; (c) the Astro docs-site has no React-island integration yet
(`@astrojs/react` not installed). All three are foundational and land before the
asset-source feature proper.

## Original scope — Generic asset sources

## Problem

`declarative-hex-worlds` is a general "declarative hex board → koota runtime → Three.js
render" engine, but its **asset layer is KayKit-shaped end to end**:

- The manifest/type vocabulary is `MedievalHexagonAsset` / `MedievalHexagonManifest`,
  with KayKit-specific `FACTIONS`, `TEXTURE_SETS`, `UNIT_STYLES`, `KayKitAttribution`.
- The render bridge (`src/three`) only knows how to load a placement as a **GLTF
  `Object3D`** (`GameboardGltfLike`, `loadGameboardPlacementObject`). There is no notion
  of "this asset is a **tileset cell** → a UV-mapped hex mesh."
- Visual verification (`docs/pillars/04`, `release-readiness.json`, `interop/coverage.ts`)
  is anchored to **KayKit's own Usage Guide PDF** (19 pages under
  `docs/assets/kaykit-guide/`), rasterized and treated as required release artifacts.

Two consequences, both surfaced by the first real external consumer (little-legends, a
Civ-Rev-2-styled 4X that wants painterly **tileset** hexes, not KayKit prisms):

1. **A consumer with their own art cannot use the library's declarative/koota/render
   core without fighting the KayKit assumption.** Pointing at custom GLTF packs is
   awkward; pointing at a **sprite-sheet / tileset** is impossible today.
2. **The docs demonstrate KayKit's product, not ours.** Embedding the vendor's guide PDF
   as our visual-verification backbone proves *KayKit* renders — it does not prove *our
   library assembles KayKit FREE (or anything) correctly*. Premium/EXTRA must never
   appear in public docs; FREE-only, captured from **our** example rendering.

## Goals

- **G1 — Generic asset-source abstraction.** One interface with (at least) two
  implementations: `gltf-pack` (today's behavior) and `tileset` (new). A consumer
  supplies an asset source; the declarative/coordinate/koota/render core is unchanged.
- **G2 — Tileset / sprite-sheet mapping as a first-class concept.** A tileset asset is a
  sheet (image) + grid (cols×rows, cell w×h) + a biome→cells mapping. The render path
  builds a **UV-mapped hex mesh** (hex geometry from the coordinate module's honeycomb
  corners) textured to a chosen cell — 2.5D, not 2D. Variation is picked deterministically
  by `hash(q,r)` for anti-repetition.
- **G3 — Transitional / edge-mask resolution generalized.** dhw already has
  `setCoastEdges` + `COAST_VARIANTS` for KayKit coast GLTFs. Generalize it: an
  edge-mask → cell resolver that any asset source implements (a tileset's coast sheet
  maps directional edge masks to specific positional cells; a GLTF pack maps them to
  coast variant models). This is what makes shorelines/biome-borders read correctly.
- **G4 — KayKit FREE/premium is a *downloadable default*, not a hardwired assumption.**
  The library ships **no** KayKit asset bytes. KayKit FREE is the batteries-included
  default source **only if** the consumer has run the FREE download/bootstrap; premium
  (EXTRA) is available **only if** the consumer has licensed + installed it. Premium is
  never referenced in public docs.
- **G5 — Showcase-based visual verification.** Release-readiness / visual coverage is
  anchored to **screenshots captured from our own example rendering FREE assets through
  the library** (the existing `'showcase'` source), replacing the KayKit-guide PDF
  backbone (the `'guide'` source). Coverage must **increase**: the showcase set must
  cover at least what the 19 guide pages covered before the guide source is retired.
- **G6 — One hex authority.** Coordinate + geometry math (corners, neighbors, layout,
  pixel↔hex) routes through dhw's coordinate module (which already wraps
  `honeycomb-grid`). Expose `hex.corners` / non-regular pointy dimensions as needed for
  the tileset mesh path. No second coordinate system.

## Non-goals

- Not a 2D-engine pivot. The board stays R3F/Three.js/2.5D — tileset cells become
  textured meshes seen from the locked iso camera, with units/cities billboarding above.
- Not removing GLTF-pack support. `gltf-pack` remains a first-class source (KayKit uses it).
- Not shipping any KayKit (or other vendor) asset bytes in the repo. (Already true for
  GLTFs; this RFC extends the principle to the guide PDF pages — see §Visual verification.)

## Design

### Asset-source interface (G1)

An `AssetSource` describes how a placement's `assetId` (+ optional `edgeMask`,
`variantSeed`) resolves to something renderable, independent of *what* that something is:

```
interface AssetSource {
  kind: 'gltf-pack' | 'tileset' | string;    // open for future sources
  /** Resolve a placement to a render request the three-bridge understands. */
  resolve(placement: GameboardPlacementSpec, ctx: ResolveContext): AssetRenderRequest;
  /** Optional: edge-mask → concrete cell/variant (G3). */
  resolveEdge?(assetId: string, edgeMask: number, ctx): AssetRenderRequest | undefined;
}

type AssetRenderRequest =
  | { type: 'gltf'; url: string; transform?: AssetTransform }       // today's path
  | { type: 'tileset-cell'; sheetUrl: string; cell: CellRect; hex: HexDims };  // new
```

The `src/three` bridge dispatches on `AssetRenderRequest.type`: `'gltf'` → existing
`loadGameboardPlacementObject`; `'tileset-cell'` → new `buildTexturedHexMesh` (a hex
geometry from the coordinate module + a `MeshBasicMaterial`/`MeshStandardMaterial` with
the sheet texture and per-cell UV offset). The GLTF loader stays the injectable seam it
is today; a new sheet-texture loader/cache is added alongside.

### Tileset manifest (G2)

A tileset source is described by a manifest analogous to the FREE manifest but
sheet-shaped (draft):

```
interface TilesetManifest {
  schemaVersion: string;
  kind: 'tileset';
  sheets: Record<string, {                 // e.g. "grassland", "desert", "coast"
    url: string;                           // relative to asset root
    grid: { cols: number; rows: number; cellWidth: number; cellHeight: number };
    role: 'fill' | 'transition';           // G3: fill = interchangeable, transition = positional
    /** fill: cells usable as any variation. transition: edgeMask → cell index. */
    variants?: number[];                   // fill: usable cell indices (default: all)
    edgeCells?: Record<number, number>;    // transition: canonical edge mask → cell index
  }>;
  biomes: Record<string, { sheet: string; select: 'hash' | 'first' }>;
}
```

little-legends' 10 sheets (480×830, 5×10 grid of 96×83 pointy-top hexes) are the
first real tileset. Biome→sheet mapping is the consumer's (grassland, forest, desert,
badlands, mountains, snow, wetland, plains, shrubland, coast).

### Transition resolution (G3)

Generalize the existing coast machinery. Today `setCoastEdges(at, edges)` records an edge
mask and `COAST_VARIANTS` maps canonical masks (1/3/7/15/31 + rotations) to KayKit coast
GLTFs. The generalization: the mask→variant table becomes a **source responsibility**
(`AssetSource.resolveEdge`). A GLTF pack returns a coast model URL; a tileset returns a
positional cell. **Fix carried over from a prior finding:** `setCoastEdges` should
validate (or degrade to longest-contiguous-run) at author time, not fail at resolve time
(the `010101` non-contiguous mask bug little-legends reported and worked around with
`longestContiguousEdgeRun`).

### KayKit-as-downloadable-default (G4)

- The library ships zero KayKit bytes. `assets/free/manifest.json` (metadata, CC0 source)
  stays — it is what *enables* the on-demand download. `models/`, `assets/free/**`
  (except the manifest) remain gitignored.
- Default source resolution: if a consumer names no source, and a FREE bootstrap output
  is present at the resolved asset root, use the KayKit `gltf-pack` source. If not
  present, a clear error tells them to run the FREE bootstrap (or supply their own
  source). Premium/EXTRA is opt-in via explicit ingest of a licensed pack and is never
  auto-selected in a way that could reference unlicensed bytes.

### Visual verification — showcases replace the vendor guide (G5)

This is the docs/coverage change and the one that must **raise** coverage, never lower it.

- Today: `interop/coverage.ts` has three `VisualArtifactCoverageSource`s —
  `'guide' | 'showcase' | 'screenshot'`. The 19 KayKit PDF pages are the `'guide'`
  backbone; `docs/showcases/free-*.png` are `'showcase'` captures of *our* rendering.
- Target: **expand the `'showcase'` set** so our own captures of FREE-through-the-library
  cover every scenario the 19 guide pages covered (taxonomy, tiles/connectivity, coasts,
  rivers, roads, editions-FREE, koota runtime, visual verification). Rewire
  `release-readiness.json`, the pillar `source_images:` frontmatter, `docs/index.md`, and
  `coverage.ts` from the `guide` paths to the new showcase captures. Retire the `'guide'`
  source and the `docs/assets/kaykit-guide/` PDF pages **only after** the showcase set
  demonstrably covers ≥ the guide set (the `sourceImageCount: 19` assertion in
  `coverage.test.ts` is replaced by a showcase-count assertion that is ≥ the scenario
  count, not lowered).
- The KayKit guide PDF (vendor material, extracted by `extract-kaykit-guide.*`) then
  moves out of tracked `docs/` into gitignored `raw-assets/` as local reference only —
  with **no** remaining tracked reference to it (the reason the naive move failed earlier:
  it left 2293 dangling references + broke `coverage.test.ts`; those must all be
  repointed to showcases first).

### One hex authority (G6)

The tileset mesh path needs a hex's 6 corner points. dhw already depends on
`honeycomb-grid`; the coordinate module wraps it. Expose corners (and non-regular
pointy `xRadius`/`yRadius`, so 96×83 cells map exactly) through the coordinate module so
the render path never re-derives corner trig (little-legends' current `terrainMesh.ts`
hand-rolls it — that hand-rolling goes away). The sim stays axial-native; consumers bridge
to offset via the existing conversion.

## Decisions locked (2026-07-06)

- **D-tileset-home**: the tileset source lives behind a dedicated **`./tileset` subpath**
  export (mirrors the existing `./three` split). dhw core stays render-agnostic;
  consumers opt into tileset support explicitly. (Resolves Q4.)
- **D-showcase-scope**: showcase replacement is a **principled per-pillar set**, not a
  1:1 recreation of all 19 guide pages. `coverage.test.ts` asserts every pillar +
  scenario is showcase-covered (coverage ≥), rather than pinning a page count. (Resolves
  Q3.)
- **D-consumer**: **SimpleRPG is promoted to a first-class rendering package** and is the
  source of the showcase captures + the docs-site live island (see §Structural reframe).
- **D-sequencing (Q5)**: **one feature branch, all phases** as sequential commits →
  a single PR at the end. Phase 0 (workspace move) lands as the first commits, feature
  phases build on top in the same branch. Every commit keeps green + coverage
  non-decreasing (the discipline that makes a big branch safe).

## Sequencing (docs → tests → code; coverage only goes up)

**Phase 0 — Workspace foundation (structural, no feature yet; supersedes Epic R #1/#3):**
1. **This RFC** (docs) — the spec of record. ← *you are here*
2. **pnpm workspace**: add `pnpm-workspace.yaml` (`packages/*`); move the library to
   `packages/declarative-hex-worlds` (public API / exports / published shape / bin
   unchanged; keep Epic R's internal domain decomposition). It is the ONLY package
   without `private: true`. Every test green through the move (relocation + path updates).
3. **Promote SimpleRPG to `packages/simple-rpg`** (`private: true`) — a real consumer that
   renders through dhw (headless smoke/exercise logic kept + a new R3F render surface).
   Existing integration/e2e tests come along and stay green.
4. **Adopt docs-site as `packages/docs-site`** (`private: true`) — drop its detached
   lockfile, make it a workspace member so it can depend on `simple-rpg` and
   `declarative-hex-worlds` by workspace protocol. Add `@astrojs/react`; embed SimpleRPG
   live (`client:load`) on a docs page — the docs now *run* the library.

**Phase 1 — Visual-verification backbone swap (coverage UP, then vendor guide retired):**
5. **Showcase coverage from SimpleRPG** (per-pillar set, D-showcase-scope): capture
   showcases from SimpleRPG rendering FREE through the library, covering every pillar the
   guide pages proved. `guide` source stays in place → coverage strictly increases.
6. **Repoint docs/manifest** (pillar `source_images:`, `release-readiness.json`,
   `docs/index.md`, `coverage.ts`) from guide paths → SimpleRPG showcase paths; contract
   tests assert per-pillar showcase coverage.
7. **Retire `guide` source**: remove the 19 KayKit PDF pages from tracked `docs/`, move to
   gitignored `raw-assets/`, delete all now-dead guide references (the 2293 that blocked
   the naive move). `coverage.test.ts` asserts the *showcase* backbone. Vendor material
   untracked; premium never in public docs.

**Phase 2 — Generic asset sources + tileset:**
8. **Asset-source interface** (`gltf-pack` extracted as the first impl behind it; pure
   refactor, existing GLTF tests are the safety net).
9. **`./tileset` source + textured-hex mesh render path** (D-tileset-home): tileset
   manifest fixture, UV-cell math, hex-mesh build from the coordinate module's honeycomb
   corners; a browser test rendering a small tileset board; SimpleRPG gains a tileset
   render mode to dogfood it.
10. **Transition resolution generalized** (+ the `setCoastEdges` validation fix, with the
    `010101` regression test little-legends offered).
11. **KayKit-as-downloadable-default** wiring + docs.

**Phase 3 — External consumer proof:**
12. **little-legends** renders its 10 tilesets through the new `./tileset` source,
    screenshotted against the Civ Rev 2 references; findings appended.

Each step is a reviewable increment. Phases may be separate PRs (Phase 0 workspace move is
naturally its own PR — it touches everything mechanically and should land isolated). Every
step keeps `pnpm typecheck`/`lint`/`test`/`verify` green and the coverage report
monotonically non-decreasing.

## Open questions (remaining, for sign-off before code)

- **Q1** Manifest shape: one unified manifest with a `kind` discriminator, or separate
  `TilesetManifest` alongside the existing FREE manifest? (RFC leans: separate manifest,
  unified *source* interface.)
- **Q2** Tileset mesh material: `MeshBasicMaterial` (flat, matches Civ Rev's unlit
  painterly look, cheapest on mobile) vs `MeshStandardMaterial` (takes scene lighting).
  Consumer-selectable? (RFC leans: basic default, standard opt-in.)
- **Q5** ✅ RESOLVED (D-sequencing): one feature branch, all phases, single PR at the end.
