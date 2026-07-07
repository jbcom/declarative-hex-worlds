# Declarative Render Surface — design

**Status:** designing (RFC0-7 + RFC0-8) · **RFC:** [0001-generic-asset-sources](../rfcs/0001-generic-asset-sources.md)

> Design doc, not an implemented pillar. When the render surface ships and has
> visual verification, an implemented pillar (`docs/pillars/`) supersedes this.

The library's public composition surface should feel like what a React/Three.js or
Pixi developer already expects: **first-class declarative JSX elements plus hooks**, not
an imperative "hand me a plan, I'll render it" black box. The existing
`createGameboardRuntime` → `syncGameboardPlacementObjects` flow is the *engine underneath*
this surface, not the surface itself.

This is the focused design of record for RFC 0001's RFC0-7 (the `AssetSource` interface)
and RFC0-8 (the declarative element layer + hooks), expanding the RFC's API section. It is
authored **before** the code (docs → tests → code) so implementation is verified against a
written contract.

## The boon/burden line

The discernment that keeps the engine general and unpresumptuous — dhw owns the world and
the verbs; the consumer owns the game.

- **Boon — dhw OWNS** (every hex-game dev would dread rebuilding these): hex coordinate
  math, tile/asset registration + placement, the no-gaps/no-overlaps tiling guarantee, A\*
  pathfinding, selection/interaction wiring, camera/viewport control, the koota world, the
  2.5D render bridge, and the declarative elements + hooks below.
- **Burden — dhw must NOT do** (consumer territory; owning these would presume): game
  rules, the simulation/economy/AI, art direction, what a unit or building *means*.

Every capability little-legends surfaces as a gap is weighed against this line before it
becomes a dhw feature. If it's a "burden," it stays in the consumer.

## Asset sources (RFC0-7 / G1)

An `AssetSource` describes how a placement's `assetId` (+ optional `edgeMask`,
`variantSeed`) resolves to something renderable, **independent of what that something is**
(a GLTF model, a tileset cell, or a future kind). It is the seam that lets the same board
render KayKit GLTF packs, PNG tilesets, or a consumer's own assets through one contract.

```ts
interface AssetSource {
  kind: 'gltf-pack' | 'tileset' | string;   // open for future sources
  /** Resolve a placement to a render request the three-bridge understands. */
  resolve(placement: GameboardPlacementSpec, ctx: ResolveContext): AssetRenderRequest | undefined;
  /** Optional: edge-mask → concrete cell/variant (transition resolution, G3). */
  resolveEdge?(assetId: string, edgeMask: number, ctx: ResolveContext): AssetRenderRequest | undefined;
}

type AssetRenderRequest =
  | { type: 'gltf'; url: string; transform?: AssetTransform }                    // today's path
  | { type: 'tileset-cell'; sheetUrl: string; cell: CellRect; hex: HexDims };    // new (G2)
```

**Dispatch.** The `src/three` bridge dispatches on `AssetRenderRequest.type`:
- `'gltf'` → the existing `loadGameboardPlacementObject` path (GLTF loader + transform +
  animation mixer + user-data tagging). Unchanged.
- `'tileset-cell'` → a new `buildTexturedHexMesh`: a hex geometry from the coordinate
  module's honeycomb corners + a material (`MeshBasicMaterial` default) carrying the sheet
  texture and a per-cell UV offset.

The GLTF loader stays the injectable seam it is today; a sheet-texture loader/cache is
added alongside it, resolved the same way.

**First implementation (RFC0-7).** The current URL-resolution + GLTF-load flow
(`resolveGameboardPlacementAssetUrl` → `loadGltfCached`) is extracted as the first
`AssetSource` impl — a `gltf-pack` source — behind this interface. This is a pure refactor:
the existing `src/three` tests are the regression net. No behavior changes; the imperative
functions remain exported (they become the `gltf-pack` source's internals).

## Tileset manifest (RFC0-8 / G2)

A tileset source is described by a sheet-shaped manifest (analogous to the FREE GLTF
manifest, but for PNG sheets):

```ts
interface TilesetManifest {
  schemaVersion: string;
  kind: 'tileset';
  sheets: Record<string, {                  // e.g. "grassland", "desert", "coast"
    url: string;                            // relative to asset root
    grid: { cols: number; rows: number; cellWidth: number; cellHeight: number };
    role: 'fill' | 'transition';            // fill = interchangeable; transition = positional
    variants?: number[];                    // fill: usable cell indices (default: all)
    edgeCells?: Record<number, number>;     // transition: canonical edge mask → cell index
  }>;
  biomes: Record<string, { sheet: string; select: 'hash' | 'first' }>;
}
```

The first real tileset is little-legends' 10 sheets (480×830, a 5×10 grid of 96×83
pointy-top hexes with transparent corners). Biome→sheet mapping is the consumer's concern
(grassland, forest, desert, badlands, mountains, snow, wetland, plains, shrubland, coast).

The `TilesetManifest` is validated by a Zod schema in `src/asset-source/`, following the
`AssetSourceSpec` (G0) pattern already established there.

## Transition resolution (G3)

Generalize the existing coast machinery. Today `setCoastEdges(at, edges)` records an edge
mask and `COAST_VARIANTS` maps canonical masks (1/3/7/15/31 + rotations) to KayKit coast
GLTFs. The generalization: the mask→variant table becomes a **source responsibility**
(`AssetSource.resolveEdge`). A GLTF pack returns a coast-model URL; a tileset returns a
positional cell.

**Carried-over fix.** `setCoastEdges` must validate (or degrade to the longest contiguous
run) at author time, not fail at resolve time — the `010101` non-contiguous-mask bug
little-legends reported and worked around with `longestContiguousEdgeRun`.

## Declarative elements (RFC0-8)

The composition vocabulary. You declare a hex world the way you'd compose an R3F scene or
a Pixi stage — 3D models and 2D sprites coexist by design:

```tsx
<HexWorld source={grasslandTileset}>
  <Tileset id="grassland" sheet="/tiles/grassland.png" grid={{ cols: 5, rows: 10, cell: { w: 96, h: 83 } }} />
  <Tile at={{ q, r }} biome="forest" />                {/* or auto-filled from worldgen */}
  <Sprite at={{ q, r }} sheet={unitsCC0} cell="warrior" />
  <Spriteset id="units" sheet={unitsCC0} />
  <Model at={{ q, r }} src="/models/castle.glb" />     {/* 3D and 2D coexist */}
</HexWorld>
```

- **`<HexWorld>`** — the root. Mounts the koota world (wrapping the existing
  `GameboardRuntimeProvider`/plan/recipe/scenario providers), holds the `AssetSource`
  registry, and renders the `<GameboardObjects>` bridge that drives
  `syncGameboardPlacementObjects` each R3F frame. It exposes the world + source registry
  through context to descendants.

  **Canvas ownership (decision):** `<HexWorld>` does **NOT** create its own R3F `<Canvas>`.
  The consumer owns the `<Canvas>`, camera, renderer settings, lights, and post-processing —
  those are app/art decisions on the *burden* side of the line. `<HexWorld>` is used
  *inside* a consumer's `<Canvas>` (it is R3F children, emitting scene objects), which keeps
  dhw unpresumptuous, lets the consumer compose dhw's board alongside their own R3F content,
  and keeps the elements testable via `@react-three/test-renderer` (no real WebGL context
  needed for the graph assertions). A convenience `<HexCanvas>` wrapper (Canvas +
  sensible 2.5D camera + `<HexWorld>`) MAY be offered for the zero-config path, but the
  primitive is Canvas-free.

- **`<GameboardObjects>`** — the R3F bridge component (internal, rendered by `<HexWorld>`):
  each frame it reconciles the scene with the projected koota placements via
  `syncGameboardPlacementObjects` against the registered source(s) + injected loaders. This
  is where the imperative bridge becomes a declarative R3F element.
- **`<Tileset>` / `<Spriteset>`** — register a sheet-backed asset source (declaration, no
  direct render). A `<Tileset>` contributes a `tileset` `AssetSource`; `<Spriteset>` the
  sprite equivalent.
- **`<Tile>`** — declare/override a tile at axial `{q,r}` (biome, terrain, elevation).
  Without children, tiles are auto-filled from the source/worldgen; `<Tile>` is the
  explicit-override path.
- **`<Sprite>` / `<Model>`** — place a 2D sprite cell or a 3D GLTF at `{q,r}`. Both resolve
  through the generic asset-source layer and register a placement in the koota world; the
  render bridge draws them via the dispatched `AssetRenderRequest`.

Each element is a thin declarative wrapper over an existing imperative capability
(providers, `spawnGameboardPlacement`, the source-aware bridge). The elements do **not**
introduce a parallel state store — they drive the same koota world the hooks read.

## Hooks (the drive/query surface)

Developers drive and observe the world through hooks, not by reaching into the runtime.
The existing ~90 `useGameboard*` hooks remain; RFC0-8 adds the ergonomic top-level surface
the elements pair with:

- **`useHexWorld`** — the world handle from the nearest `<HexWorld>` (runtime facade +
  source registry).
- **`useTile(at)`** — the tile state at axial coordinates (wraps `useTileEntity` +
  `useTileState`).
- **`useSelection`** — current selection + setters (wraps the interaction-target hooks).
- **`useCamera`** — camera/viewport control (the RFC0-CAM surface: frame-board,
  fill-viewport, set perspective/angle, orient).
- **`useHexPath(from, to)`** — A\* path between hexes (wraps `useGameboardNavigation`).
- **`usePlacement(at)`** — placements at a tile (wraps `usePlacementEntitiesForTile`).

These are ergonomic facades over the documented lower-level hooks in
[Koota Runtime Rules](./05-koota-runtime-rules/); they add no new state authority.

## What this pillar does NOT change

- The koota world, traits, relations, and rules (pillar 05) are untouched — the elements
  and hooks are a *surface* over that runtime.
- The imperative `./three` and `./react` exports remain public and unchanged; they are the
  engine the declarative surface sits on.
- Asset editions/ingest (pillar 03) and tile connectivity (pillar 01) are unchanged; the
  `AssetSource` interface is a new *resolution* seam, not a new asset taxonomy.

## Sequencing (docs → tests → code, coverage only up)

1. **RFC0-7** — `AssetSource` interface + `AssetRenderRequest` + extract today's GLTF path
   as the `gltf-pack` source behind it. Existing `./three` tests are the net; add tests for
   the new dispatch seam. Pure refactor.
2. **RFC0-8** — `TilesetManifest` Zod schema + `buildTexturedHexMesh` + the `tileset`
   source; then the `<HexWorld>/<Tile>/<Tileset>/<Sprite>/<Spriteset>/<Model>` elements +
   `useHexWorld/useTile/useSelection/useCamera/useHexPath/usePlacement` hooks. Browser test
   renders a small tileset board; SimpleRPG gains a tileset render mode.

Coverage is monotonically non-decreasing across both steps.
