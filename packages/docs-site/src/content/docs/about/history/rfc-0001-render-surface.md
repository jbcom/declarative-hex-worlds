---
title: RFC-0001 render surface — build log (in progress)
description: Progress record for RFC-0001 (generic asset sources + the declarative render surface). Migrated out of the live directive so the queue tracks only remaining work. Completed through the JSX element layer + docs-site workspace member; RFC-0001 is still open (one giant PR #220 accumulates the whole milestone). Per-commit WHY for the DONE portion lives here.
sidebar:
  order: 97
---

> **Live milestone — build log, not an archive.** RFC-0001 is still in flight on
> `feat/generic-asset-sources` (PR #220, the one-giant-PR accumulator). This page holds
> the per-commit record for the COMPLETED portion (workspace, G0, RFC0-7, RFC0-8 + element
> layer, docs-site member) so `.agent-state/directive.md` carries only the remaining `[ ]`
> queue. Spec of record: `packages/declarative-hex-worlds/docs/rfcs/0001-generic-asset-sources.md`.

## Completed items (verified: local green + CI green)

- [x] RFC0-7 `AssetSource` interface; extract KayKit `gltf-pack` as the first impl behind it (pure refactor, existing GLTF tests are the net). ✅ commit b06c7bb: `src/asset-source/source.ts` (AssetSource iface + AssetRenderRequest union 'gltf'|'tileset-cell' + ResolveContext + CellRect/HexDims, type-only → coverage-excluded), `gltf-pack.ts` (createGltfPackSource wraps resolveGameboardPlacementAssetUrl+transformForPlacement → {type:'gltf'}, 100% covered, 7 tests). Design: docs/plans/declarative-render-surface.design.md. Umbrella + ./asset-source + public-api snapshot updated. Suite 2674 pass.
- [x] RFC0-8 `./tileset` + declarative render surface — DONE. Tileset manifest + UV-cell math + textured-hex mesh + bridge dispatch + the full JSX element surface, all CI-green. (SimpleRPG tileset render mode + <HexCanvas> zero-config wrapper are follow-ons under RFC0-2/showcase work.)
  - ✅ G2 manifest + cell selection DONE: commit 147cf8a (TilesetManifest Zod schema, 8 tests) + 08abd2d (createTilesetSource: biome/edge→tileset-cell, FNV-1a hash fill selection, cellRect helper, 15 tests). Both 100% covered, in `src/asset-source/`.
  - ✅ buildTexturedHexMesh DONE: commit 61487f3. `src/three/textured-hex.ts` — buildHexGeometry (center+6-corner fan BufferGeometry, pointy-top default, per-cell UVs, V-flipped) + buildTexturedHexMesh (MeshBasicMaterial, transparent, DoubleSide). Pure three, unit-covered, 10 tests, 100%. NOTE geometry math: pointy-top X-extent = halfW·cos30°, Z-extent = halfH (corner at 90°).
  - ✅ BRIDGE DISPATCH DONE: commit 61f6076. src/three/three.ts loadGameboardPlacementObject
    now dispatches on an optional `source?: AssetSource`: tileset-cell → loadTilesetCellObject
    (GameboardSheetTextureLoader injectable+LRU-cached via loadSheetTextureCached →
    buildTexturedHexMesh → transform → tag → LoadedGameboardPlacementObject{mesh, clips:[]});
    gltf/no-source → unchanged GLTF path. 5 unit tests + tests/browser/tileset-render.test.ts
    (3×3 board in real Chromium/WebGL, canvas-backed sheet, asserts 9 meshes + non-empty
    pixels — covers three.ts dispatch for the merged strict-100 gate; registered in
    vitest.browser.free.config.ts). No import cycle (type-only asset-source↔three).
  - ✅ JSX SURFACE (RFC0-8b) DONE: `src/react-elements/` + `./react-elements` subpath
    (subpath-only, NOT umbrella — keeps @react-three/fiber an optional peer for consumers who
    don't want the elements). `<HexWorld>` (Canvas-free: koota providers + source registry),
    `<GameboardObjects>` (R3F bridge — useFrame → the extracted pure syncHexWorldPlacements),
    `<Tile>`/`<Model>`/`<Sprite>` (spawn/remove koota placements on mount/unmount),
    `<Tileset>` (registers a tileset source), + hooks useHexWorld/useTile/usePlacement/
    useHexPath. combineSources (first-match composite) + syncHexWorldPlacements extracted as
    pure fns → unit-tested (src/react-elements/__tests__/objects.test.ts, 8 tests); the R3F
    component wrapper is /* v8 ignore */ (untraceable through R3F's reconciler, logic covered).
    Element logic browser-tested via plain createRoot (tests/browser/react-elements.test.ts,
    13 tests — NOT inside <Canvas>, since only <GameboardObjects> needs R3F; that's a Canvas
    smoke). Needed vitest.browser config: React dedup + @react-three/fiber in optimizeDeps
    (R3F's own reconciler was loading a 2nd React → useMemo null). All files 100% covered,
    full suite 2723 pass, build+DTS green.
    FOLLOW-ONS (not blocking RFC0-8): useSelection + useCamera hooks land with their backing
    features (a selection-state model + RFC0-CAM); <HexCanvas> zero-config wrapper; SimpleRPG
    tileset render mode (RFC0-2).

**Decision:** <HexWorld> is Canvas-free — the consumer owns the R3F <Canvas>, dhw owns the
board composition + render-sync bridge inside it.
**Why:** Canvas/camera/renderer/lights/post are app+art decisions (burden side of the
boon/burden line); owning them would presume and constrain. A Canvas-free primitive composes
with consumer R3F content and stays testable. Optional <HexCanvas> covers zero-config.
**Resolves:** RFC0-8b element-layer architecture (Canvas ownership).
--- resume state + gap finding ---
### RFC-0001 resume state (2026-07-06, after G0)

**Branch:** feat/generic-asset-sources, PR #220 (draft). CI green on RFC0-1 + G0
(build/lint/typecheck/coverage/bootstrap/benchmarks pass; CodeQL is GitHub
default-setup = neutral/flaky, NOT a real gate).

**DONE + verified (local green + CI green):**
- RFC0-1 workspace move (library → packages/declarative-hex-worlds, private root,
  only lib publishes, native pnpm caching CI, release-please retargeted).
- RFC0-G0 Zod AssetSourceSpec (src/asset-source/, ./asset-source subpath) +
  free.ts retirement (16.5k→41 lines) + pnpm catalog + zod dep. 2662 tests pass.
- docs-site adopted as `packages/docs-site` workspace member (commit c619ec0) —
  the STRUCTURAL PREREQUISITE for RFC0-4's live SimpleRPG React island: only a
  member can `workspace:*`-depend on the library + `@declarative-hex-worlds/simple-rpg`.
  pnpm typedoc-plugin-markdown strict-isolation failure solved via root `.npmrc`
  (`hoist-pattern[]=*` to keep defaults + `*typedoc-plugin*` + `starlight-typedoc`).
  astro/tsconfig.typedoc entryPoints repointed to sibling lib; cli-reference +
  docs-frontmatter/branded-types contract tests repointed under packages/docs-site;
  ci/cd docs-site jobs collapsed to one workspace install. 2683 tests pass; docs
  build 1194 pages; frozen install clean. (RFC0-4 showcase-CAPTURE still open —
  waits on RFC0-8 declarative surface + RFC0-2 SimpleRPG render.)

**NEXT — RFC0-2 (SimpleRPG package), a large mechanical move:**
- packages/simple-rpg/ is SCAFFOLDED (package.json private workspace:* dep,
  tsconfig with jsx). Empty src/ — needs the actual move.
- MOVE src/guides/simple-rpg/{smoke,exercises,types,index}.ts → packages/simple-rpg/src/
  (these import the library by PACKAGE NAME already — clean).
- MOVE the scattered SimpleRPG tests into packages/simple-rpg/tests/: tests/integration/simple-rpg/*,
  tests/e2e/simple-rpg*, tests/browser/simple-rpg-visual.test.ts, tests/unit/simple-rpg.test.ts,
  tests/simple-rpg/*. REPOINT their relative imports (../../src, ../../../src/guides/simple-rpg)
  to the package name 'declarative-hex-worlds' + local paths.
- The library's src/guides/simple-rpg/__tests__/{smoke,exercises}.test.ts move too.
- Add packages/simple-rpg/vitest.config.ts; ensure `pnpm --filter @declarative-hex-worlds/simple-rpg test` green.
- Update the library's tsconfig include/exclude + any contract test that counted simple-rpg files.
- CI: add a layered simple-rpg e2e job that runs AFTER the library suite (needs:), per D-test-topology.
- Give SimpleRPG an R3F render surface + run states (compose/cross-pack/pathfind/viewport) — this is where
  the real gap-finding + showcase capture begins (RFC0-4).

**THEN (Phase 2):** RFC0-7 AssetSource interface (build on G0) → RFC0-8 ./tileset +
declarative <Tile>/<Tileset>/<Sprite>/<Model> elements + hooks → RFC0-CAM camera →
RFC0-CLI binder + web configurator → RFC0-TEX/TAG/NORM/OVERLAY/ACC (CC0-pack gaps) →
RFC0-10 three downloadable KayKit defaults → Phase 1 showcase backbone swap →
RFC0-14 little-legends re-homing. See RFC 0001 for the full design.

### Gap-finding result (2026-07-06): NO declarative render surface exists yet
SimpleRPG's first render attempt confirms the RFC thesis gap: the library ships
React PROVIDERS + HOOKS (GameboardRuntimeProvider, useGameboardState,
useGameboardPlacementSnapshots, action hooks) but NO ready-to-use board React
component — no <HexWorld>/<Tile>/<Canvas>/<mesh>. A consumer must hand-wire R3F
+ syncGameboardPlacementObjects (the imperative three bridge) themselves — exactly
what little-legends' HexBoard did. So SimpleRPG can't render declaratively until
RFC0-8 (the <Tile>/<Tileset>/<Sprite>/<Model> + <HexWorld> elements + hooks that
proxy koota+honeycomb+three) exists. EFFECTIVE ORDER: build RFC0-8 declarative
elements NEXT (the core deliverable per the React thesis), with SimpleRPG as their
first consumer + gap-finder. The imperative bridge becomes the internal engine
under the declarative surface.
