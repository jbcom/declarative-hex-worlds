# Continuous Work Directive — declarative-hex-worlds

**Status:** ACTIVE
**Owner:** jonbogaty@gmail.com
**Goal:** Ship `@jbcom/declarative-hex-worlds@1.0.0` to npm — release-please picks up the merged 1.0 stabilization branch and cuts the release PR.

## Operating loop — FULL AUTONOMY (non-negotiable)

while queue has `[ ]` items: implement → verify (typecheck + unit + coverage green) → commit → dispatch reviewers (background, parallel) → mark `[x]` → next. Do NOT stop between items. Do NOT report progress and wait. Each turn either advances the next `[ ]` item or names a true blocker — there is no third option.

**Mechanical work is NEVER a question.** Repointing imports, splitting test files, moving symbols, updating snapshots, fixing type errors, achieving coverage on a now-private function via a public path — these are execution, not decisions. Just do them until green. "This is substantial / long / mechanical" is not a reason to ask how to proceed; the answer is always "do it to green, then commit."

**Self-pacing is NOT a question either.** "Commit a smaller slice vs keep grinding" is the agent's call: keep the queue item whole if splitting would leave a non-compiling intermediate; slice only when a sub-step is independently green + valuable. Never ask the user to choose the cadence.

**The ONLY legitimate stops (true blockers):**
1. A design decision that flips SCOPE (changes the public API contract in a way not already decided, picks between architectures with different failure modes, or contradicts a captured decision). Ask, then continue.
2. CI/test failure whose root cause needs user-only knowledge (org secrets, external infra, intent that isn't in the repo).
3. A destructive op needing per-operation authorization (force-push to main, etc.).
4. Remote state we cannot progress without (CI completing, review landing) — use Monitor with a 20-30min fallback, never sit idle.

Everything else — context pressure, task size, "is this the right cadence", "should I keep going" — is NOT a stop and NOT a question. The harness auto-compacts; the 1M budget + `.agent-state/` survive it. Resume from the directive and keep going.

**Before asking ANY question, apply this test:** "Could a competent engineer with this directive + the repo answer it themselves without me?" If yes → it's mechanical or a self-paced call → DO IT, don't ask. Only genuine scope/contract forks (test #1 above) reach the user.

## Forbidden phrases

"deferred" | "v2+" | "out of scope" | "future work" | "tracked separately" | "follow-up" | "TODO" | "FIXME" | "stub" | "placeholder" | "mock for now" | "pause point" | "fresh session" | "stopping point" | "clean handoff" | "let me know when..."

## Completed milestones (archived)

Pre-RFC-0001 work is **fully done** (all `[x]`); its per-commit WHY record is migrated
to the docs-site history pillar so this queue tracks only in-flight work:

- [1.0 stabilization](../../packages/docs-site/src/content/docs/about/history/1.0-stabilization.md)
  — 35+ items across Phases R/A/B/D/E/F/G + the bootstrap-not-bundle restructure; landed
  via PR #4 (commit `14c5f77`) on 2026-05-27.
- [Post-1.0 maintenance](../../packages/docs-site/src/content/docs/about/history/post-1.0-maintenance.md)
  — E0 coverage → 100/100/100/100, merged-gate wiring, Epic LF decomposition, E9 visual
  gate, F-Site docs, CR review queue.

**Compression protocol:** when a milestone below reaches all-`[x]`, migrate its body into
a new history pillar doc and replace it here with a one-line pointer. The directive holds
only in-flight work — it never grows a completed-item backlog.

## Self-assessment after each commit

1. What did I just ship? Did the visual / behavior match the spec doc?
2. Backward: any gap flagged by self-review / CI / coderabbit during this stage?
3. Forward: what should the next commit do differently given what this one revealed?
4. Encode forward learnings into directive items above before starting the next commit.

---

## Milestone RFC-0001 — Generic asset sources + first-class consumer package (2026-07-06)

Spec of record: `docs/rfcs/0001-generic-asset-sources.md`. Goal: dhw becomes a general
hex-board engine (GLTF packs AND tilesets), KayKit FREE/premium is a downloadable default
(never shipped bytes), SimpleRPG is a first-class rendering consumer that produces the
docs showcases + a live docs-site island, and visual verification is anchored to OUR
consumer rendering FREE (not the embedded KayKit guide PDF). One feature branch
(`feat/generic-asset-sources`), sequential commits, coverage monotonically non-decreasing,
ONE GIANT PR at the very end → squash-merge → npm publish confirmed (locked 2026-07-06: no
incremental merges; the whole re-architecture lands together). CLI scope: FULL binder incl.
the live web-form configurator (locked).

### Phase 0 — Workspace foundation
- [x] RFC0-1 pnpm workspace: add `pnpm-workspace.yaml`; move library to `packages/declarative-hex-worlds` with published shape/exports unchanged; all tests green through the move.
- [ ] RFC0-2 Promote SimpleRPG to `packages/simple-rpg` — a real consumer that renders through dhw (keep headless smoke/exercise tests green, add an R3F render surface). MIGRATE the library's `tests/e2e/simple-rpg*` + `tests/integration/simple-rpg*` into this package as ITS OWN e2e (SimpleRPG IS the e2e — a real game consuming the package). CI becomes layered: library isolated suite passes FIRST (needs:), THEN SimpleRPG e2e runs (real-world proof). See RFC §D-test-topology.
- [ ] RFC0-3 Docs-site React island: add `@astrojs/react`; embed SimpleRPG live (`client:load`) on a docs page — the docs RUN the library.

### Phase 1 — Visual-verification backbone swap (coverage UP, then vendor guide retired)
- [ ] RFC0-4 Capture per-pillar showcases from SimpleRPG rendering FREE through the library; `guide` source stays → coverage strictly increases.
- [ ] RFC0-5 Repoint pillar `source_images:`, `release-readiness.json`, `docs/index.md`, `coverage.ts` from guide paths → SimpleRPG showcase paths; contract tests assert per-pillar showcase coverage.
- [ ] RFC0-6 Retire `guide` source: remove the 19 KayKit PDF pages from tracked `docs/` → gitignored `raw-assets/`; delete all now-dead guide references (~2293); `coverage.test.ts` asserts the showcase backbone. Premium never in public docs.

### Phase 2 — Generic asset sources + tileset
- [x] RFC0-G0 Zod-validated canonical `AssetSourceSpec` (the FOUNDATION — precedes G1/G2). Add zod as a library dependency. Define ONE source-agnostic schema for tiles/tilesets/sprites/spritesets/models + how they map to the hex world; a source is valid iff it parses. Replace the hand-rolled `validateManifestHeader`/`validateManifestAssets` issue-accumulators. KayKit FREE/premium become INPUTS normalized INTO the spec (ingest detail), not the public contract. This RETIRES `src/manifest/free.ts` (16.5k-LOC KayKit blob), its drift test, and the 6GB DTS heap hack — because KayKit-manifest-as-canonical is GONE, not via a JSON-import trick. Custom sources (tilesets/sprites/models) author directly in this Zod spec. See RFC §Foundation + §Thesis (dhw = React binding proxying koota+honeycomb+three).
- [ ] RFC0-CLI Source-agnostic asset-binder CLI: point at ANY assets path → scan → heuristic source-kind detection (KayKit free/premium signatures; or sprites/tilesets/models dir layouts) → SUGGEST a default binding → emit a Zod-validated AssetSourceSpec JSON. Three converging authoring paths: developer hand-writes JSON, CLI generates from scan+interactive prompts, or CLI serves a local web form (spins up a server, opens a browser configurator, writes JSON from visual choices). KayKit becomes one recognized signature, not the tool's purpose. Builds on RFC0-G0; feeds RFC0-10 (FREE default = scanner recognizing a bootstrapped KayKit tree). See RFC §CLI.
- [ ] RFC0-CAM Camera/viewport command surface (library capability — GAP surfaced by SimpleRPG's `viewport` run-state). Today `./three` only has `frameObjectPosition(asset)`; the react layer has NO camera control. Add a real command surface: frame-the-whole-board, fill-viewport, set perspective/angle (top-down/iso/tilted, orthographic vs perspective), orient. Exposed through `./three` + a react hook. Browser test asserts each mode; SimpleRPG's viewport run-state drives it. (Pathfinding `findHexPath` already exists — no gap there.)
- [x] RFC0-7 `AssetSource` interface; extract KayKit `gltf-pack` as the first impl behind it (pure refactor, existing GLTF tests are the net). ✅ commit b06c7bb: `src/asset-source/source.ts` (AssetSource iface + AssetRenderRequest union 'gltf'|'tileset-cell' + ResolveContext + CellRect/HexDims, type-only → coverage-excluded), `gltf-pack.ts` (createGltfPackSource wraps resolveGameboardPlacementAssetUrl+transformForPlacement → {type:'gltf'}, 100% covered, 7 tests). Design: docs/plans/declarative-render-surface.design.md. Umbrella + ./asset-source + public-api snapshot updated. Suite 2674 pass.
- [ ] RFC0-8 `./tileset` subpath: tileset manifest, UV-cell math, textured-hex mesh from the coordinate module's honeycomb corners; browser test rendering a small tileset board; SimpleRPG gains a tileset render mode. (Q1 manifest shape + Q2 material: decide with RFC-leaned defaults — separate TilesetManifest, MeshBasicMaterial default.)
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
  - REMAINING = ONLY the JSX SURFACE (RFC0-8b, next unit): <HexWorld>/<Tile>/<Tileset>/
    <Sprite>/<Model> elements + useHexWorld/useTile/useSelection/useCamera/useHexPath/
    usePlacement hooks, each a thin wrapper over the existing providers +
    spawnGameboardPlacement + the now-source-aware bridge. Needs @react-three/fiber (already
    an optional peer, commit addf491). Design of record:
    docs/plans/declarative-render-surface.design.md. STATUS: the whole ENGINE half of RFC0-8
    (resolution + geometry + integration) is DONE + CI-green; only the ergonomic React
    composition surface remains.
- [ ] RFC0-9 Generalize transition/edge-mask resolution (`AssetSource.resolveEdge`); fix `setCoastEdges` to validate/degrade non-contiguous masks at author time (the `010101` finding) + regression test.
- [ ] RFC0-10 KayKit-as-downloadable-defaults (G4): THREE first-class downloadable CC0 packs — Medieval Hexagon (tiles/), Adventures (models/, playable), Skeletons (models/, enemies) = a full game from defaults. Fetch-on-demand for each (never tracked); default source resolution (present → use; absent → clear error to run the download); docs. Generalizes the current single-pack FREE bootstrap to the 3-pack set.

### Phase 2b — Capabilities surfaced by real CC0 packs (SimpleRPG gap-finding)
- [ ] RFC0-TEX Texture-binding: bind specific textures to specific GLB/GLTF models (KayKit Adventures ships textures for particular meshes). Spec + render bridge support explicit texture→model binding.
- [ ] RFC0-TAG Classifier tags: first-class queryable tags (playable/non-playable/enemy/random-encounter/unit/building/prop) on assets+placements, koota-backed, queryable via hooks. Default classifiers for recognized packs (Adventures→playable, Skeletons→enemy).
- [ ] RFC0-NORM Cross-pack size-normalization: hex tiles + props from different makers (KayKit vs Kenney) normalize to one board-cell size for seamless mixed-pack boards.
- [ ] RFC0-OVERLAY Overlay + placement transforms: model/building from pack B onto a tile from pack A — scale-normalize + center-place + dev-controllable offset/anchor/rotation via <Model>/<Sprite>.
- [ ] RFC0-ACC Accessory-attachment: associate accessories (helmet/weapon/shield) to a specific character model at the right node/bone. Composition primitive for the Adventures pack.
- [ ] RFC0-PACKS Two tiers. DOWNLOADABLE DEFAULTS (first-class, fetched on demand, never tracked — G4 mechanism): KayKit Medieval Hexagon→tiles/, KayKit Adventures→models/ (playable), KayKit Skeletons→models/ (enemies) = a FULL game from defaults. CLI offers all three. BAKED into packages/simple-rpg/assets (a few Kenney pieces, tracked): Kenney Hexagon Kit→tiles/ (size-norm test), Kenney Retro Fantasy→models/ (overlay test) — proving cross-maker EXTENSION. Kenney attribution in NOTICE+docs.

### Phase 3 — Ship + external proof
- [ ] RFC0-11 Comprehensive local review (code/security/simplify, parallel background), fold findings forward into the branch.
- [ ] RFC0-12 Open PR; address ALL CI + review feedback; resolve every thread; squash-merge once green.
- [ ] RFC0-13 Confirm the new version is published on npmjs (release-please cuts it post-merge; Monitor the release, verify the registry).
- [ ] RFC0-14 Pivot back to little-legends: RE-HOME its composition + interaction onto dhw's koota world (stop duplicating an engine) — register its sprites + hex tilesets as asset sources, back worldgen/placement/selection/movement/fog/camera with dhw instead of hand-rolled R3F. Render the 10 tilesets through `./tileset`, screenshot against `docs/design/refs/civrev2-*.jpg`. Each little-legends need dhw can't yet back = a NEW capability item folded back into this branch (gap-finding runs throughout, per RFC §Guiding method), not just a final port.

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
