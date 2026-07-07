# Continuous Work Directive — declarative-hex-worlds

**Status:** ACTIVE
**Owner:** jonbogaty@gmail.com
**Goal:** Ship `@jbcom/declarative-hex-worlds@1.0.0` to npm — release-please picks up the merged 1.0 stabilization branch and cuts the release PR.

## Operating loop — FULL AUTONOMY (non-negotiable)

while queue has `[ ]` items: implement → verify (typecheck + unit + coverage green) → commit → dispatch reviewers (background, parallel) → mark `[x]` → next. Do NOT stop between items. Do NOT report progress and wait. Each turn either advances the next `[ ]` item or names a true blocker — there is no third option.

**Mechanical work is NEVER a question.** Repointing imports, splitting test files, moving symbols, updating snapshots, fixing type errors, achieving coverage on a now-private function via a public path — these are execution, not decisions. Just do them until green. "This is substantial / long / mechanical" is not a reason to ask how to proceed; the answer is always "do it to green, then commit."

**Self-pacing is NOT a question either.** "Commit a smaller slice vs keep grinding" is the agent's call: keep the queue item whole if splitting would leave a non-compiling intermediate; slice only when a sub-step is independently green + valuable. Never ask the user to choose the cadence.

**ZERO BLOCKERS. The agent makes EVERY decision itself, against the quality standards below.** (User directive, 2026-07, standing.) This includes ARCHITECTURAL forks, public-API shape, packaging, naming, test layout, which option is "best" — all of it. There is no question worth interrupting the user for; pick the option that best fits the codebase + the standards, write down WHY in the directive/decisions log, and execute. The user has explicitly delegated all of it.

The ONLY things that are genuinely not-progressable (and even these are NOT "ask the user" — they are "Monitor and keep working elsewhere" or "note and route around"):
1. Remote state already triggered (CI completing, a dispatched review landing) → Monitor with a 20-30min fallback heartbeat, never sit idle, always have other queue work in flight.
2. A credential/purchase/hardware the agent physically cannot perform (interactive OAuth, a paid spend needing the user's card, a physical device). Note it in the directive and route to other work; do not block the whole loop on it.

Everything else — architecture choices, "which shape is best", scope calls, context pressure, task size, cadence, "should I keep going" — is the AGENT'S call. The harness auto-compacts; the 1M budget + `.agent-state/` survive it. Decide, record the WHY, execute, keep going.

**Before even considering a question, STOP: the answer is "decide it yourself."** An AskUserQuestion for an implementation/architecture/naming/layout detail is a DEFECT. If two options both satisfy the standards, pick the one with the better long-term fit (renderer-neutrality, no drift, no duplication, koota-faithful, most complete), note why, move on. Disagreement can be corrected later by the user; a blocked loop cannot be un-blocked without them.

**Quality standards that DRIVE every self-made decision** (these replace asking): most thorough/complete/optimal choice, never the easiest/smallest-diff; refactors not shims; no drift, placeholders, partials, or duplication; docs→tests→code, coverage never down; renderer-free core + signals+bindings (koota-faithful); everything under packages/* in the workspace; verify green (typecheck + unit + coverage + build) before commit; conventional commits; one giant PR #220 until the whole RFC-0001 re-arch is done.

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

## Milestone RFC-0001 — Generic asset sources + declarative render surface (2026-07-06)

Spec of record: `docs/rfcs/0001-generic-asset-sources.md`. dhw becomes a general
hex-world engine with **pluggable 2D/3D render backends** (three today, Pixi future),
GLTF packs AND tilesets, KayKit as a downloadable default (never shipped bytes), SimpleRPG
the first-class rendering consumer producing docs showcases + a live island, visual
verification anchored to OUR consumer. One branch (`feat/generic-asset-sources`), sequential
commits, coverage monotonically non-decreasing, **ONE GIANT PR (#220) at the end** →
squash-merge → npm publish confirmed (locked: no incremental merges). CLI scope: FULL binder
incl. the live web-form configurator (locked).

**DONE so far** (workspace move, G0 Zod spec, RFC0-7 AssetSource+gltf-pack, RFC0-8 tileset
manifest+source+textured-hex+bridge-dispatch+JSX element layer, docs-site as a workspace
member, repo description+ruleset hygiene) — all CI-green on PR #220. Per-commit WHY +
resume context: [RFC-0001 build log](../../packages/docs-site/src/content/docs/about/history/rfc-0001-render-surface.md).
Full suite 2723 pass. **Compression rule (standing):** when items complete, migrate their
record into that build-log doc and keep only `[ ]` here — the directive tracks REMAINING work.

### Standing decisions (2026-07-06, extracted to decisions.ndjson)

**Decision (REFRAMED after enumeration — DEP depends on CORE):** the current
`optional:true` peers are actually CORRECT *once `./core` exists* — a `./core`-only consumer
legitimately skips koota/react/three, so a REQUIRED peer would wrongly warn them. The real
gap is not the flag but the lack of a CLEAR signal when a MAIN-entry consumer forgets koota
(`import 'koota'` fails with an opaque ERR_MODULE_NOT_FOUND). **Why:** naive flip
optional→required breaks the core tier; tiered requirements are the honest model —
`./core` = honeycomb+zod only; main/runtime = +koota+react; `./three` = +three;
`./react-elements` = +R3F. **How:** keep optional peers; add per-tier "requires" docs on each
entrypoint; OPTIONAL friendly guard on the main entry ("install koota for the runtime"); a
contract test asserting the tier→dep matrix. This lands WITH RFC0-CORE (co-dependent), not
before it. **Resolves:** RFC0-DEP (folded under RFC0-CORE ordering).

**Decision:** add a **`./core` tier** — koota-free AND three-free: AssetSourceSpec/TilesetManifest,
Recipe/Scenario/Blueprint→GameboardPlan compilers (pure), coordinates/grid/navigation/occupancy
(hex math + A*), validateGameboardPlan, interop snapshots. A `./core`-only consumer installs
just honeycomb-grid + zod. **Why:** the neutral surface already exists but is scattered; some
files (recipe.ts, coordinates/projection.ts + layout.ts) statically import koota via
co-located `createWorldFrom*` helpers, so a guaranteed koota-free import isn't packaged.
**How (verified feasibility):** 8 modules already koota-free (asset-source, coordinates,
grid, navigation, occupancy, plan, validation, manifest/schema); the 3 mixed files must be
SPLIT — pure `createPlanFrom*`/projection/layout-analysis into koota-free modules, the koota
`createWorldFrom*` stay in the runtime tier. **Resolves:** RFC0-CORE.

**Decision:** rendering is a **pluggable RenderBackend seam with 2D/3D first-class**. **Why:**
the asset-source/resolution layer is ALREADY 100% backend-neutral (zero three imports); the
only 3D bias is `AssetTransform` (lives in src/three, is x/y/z + rotationY). Generalizing lets
a Pixi (2D) backend reuse the same world+hex+sources with the same declarative+hooks ergonomics
— "an engine with pluggable renderers," not an R3F-only lib. **How:** move AssetTransform to
neutral core + make it dimension-aware (2D: x/y+z-order+rotation; 3D: full); add
`dimension:'2d'|'3d'` to AssetRenderRequest/sources; define a `RenderBackend` interface
(`mount(request)→native node`); `./three` becomes the reference impl, `./pixi` a future one;
`<HexWorld>`/`<Sprite>`(2D)/`<Model>`(3D)/hooks stay backend-agnostic + select a backend the
way you pick `<Canvas>` vs a Pixi `<Stage>`. **Resolves:** RFC0-RENDER.

### Open queue

**Foundation refactors (do BEFORE more render features — they reshape the contract). Order: CORE → DEP → RENDER.**
- [x] RFC0-CORE `./core` koota-free + three-free tier — DONE (commits 237874f recipe-split, 0ac4f4f layout-split, a87f180 barrel+subpath, 205f7de isolated build). recipe.ts + layout.ts split into pure + `*-runtime.ts` (injection seam, wired koota default); projection.ts is runtime-only (no split needed); `./core` subpath + isolated tsup build (splitting:false) → dist/core.js pulls ONLY honeycomb-grid+seedrandom+zod (loads 112 exports koota-less). Source+built purity contract (4 tests). Full detail in the [RFC-0001 build log](../../packages/docs-site/src/content/docs/about/history/rfc-0001-render-surface.md).
- [x] RFC0-DEP Tier-aware dependency contract — DONE (commit e037068). koota/react/react-dom/three stay OPTIONAL peers (correct — `./core` consumers skip them); tests/contract/dependency-tiers-contract.test.ts asserts the tier→dep matrix (each engine present+optional, koota never hard/required); README "Dependency tiers" table + `./core` row; the pure recipe applier's clear "requires runtime tier" error IS the friendly guard. Stale KayKit descriptions refreshed (package.json + cli.ts).
- [x] RFC0-RENDER 2D/3D fundamental via SIGNALS + BINDINGS (koota-native) — DONE (commits cb456de renderer-free core, 8f9f930 canvas-2D binding). koota traits ARE the signals; the core imports NO renderer (contract-enforced); three (3D) + canvas-2d (2D, zero deps) bindings both subscribe to the SAME placement signals → the seam is proven substrate-agnostic (2D/3D fundamental, not cosmetic). RE-ARCHITECTED (user decision 2026-07, supersedes RenderBackend). koota traits ARE the signals; renderer bindings subscribe+reconcile. DONE (commit cb456de): (a) signals exist + already subscribed — `useProjectedGameboardPlan` (src/react) subscribes to useWorld+useGameboardState+useGameboardPlacementEntities(PlacementState query)+derived-revision and re-projects reactively; `<GameboardObjects>` (the three binding) consumes it + reconciles three nodes (the useFrame is only animation-mixer advance). So the binding model is ALREADY realized. (b) core is renderer-free — removed ./three+./react from the main barrel; extracted pure placement→URL/transform resolution to neutral src/asset-source/placement-resolution.ts (severed the gltf-pack→../three leak). (c) three/@react-three/fiber/react already OPTIONAL peers (peerDependenciesMeta). (d) tests/contract/renderer-optionality-contract.test.ts walks each core entrypoint's import graph, FAILS on any renderer import (caught the gltf-pack leak). SUPERSEDED+DELETED: render-backend.ts + three-backend.ts. REMAINING: (e) a 2D binding (canvas-2D, ZERO new deps: subscribe to the SAME PlacementState signals → draw tileset-cell sprites to a 2D context) PROVES the seam is genuinely substrate-agnostic — the thing that makes 2D/3D FUNDAMENTAL not cosmetic. Ship as `declarative-hex-worlds/canvas2d` subpath + a test rendering the SAME world via three AND canvas-2d. (f) docs: name the binding model in src/react-elements + src/three module docs. See [[dhw-signals-bindings-architecture]].

**Phase A — SimpleRPG as first consumer + gap-finder (re-planned around signals+bindings):**
- [x] RFC0-2 `packages/examples` — the reference consumer(s). DONE (commit 5d1613a rename+restructure, 141574e canvas2d example+coverage). SimpleRPG-as-it-was = the 3D binding's example; renamed simple-rpg→examples with a SHARED renderer-free game (src/game, public-API worldgen+quest line) rendered by each binding: src/three/board.tsx via `declarative-hex-worlds/three`, src/canvas2d/board.ts via `/canvas2d` (SAME game in 2D — the substrate-agnostic proof at the consumer level). The game's e2e + the visual/third-party tests moved into the package (public-API, through the binding subpaths); the library was fully decoupled (feature-gallery uses a neutral library fixture; the release-readiness + pillar contracts dropped the moved simple-rpg showcases; a library-owned game-flow-branch-coverage test replaced the coverage the moved visual test incidentally gave). CI job simple-rpg→examples (+DTS-OOM heap fix + biome devDep). REMAINING → RFC0-2b (task #9): wire the examples browser vitest config so the moved *-visual + third-party-assets tests actually RUN in CI (they typecheck + are node-excluded but nothing executes them yet); regenerate the 5 moved baselines in CI. Then RFC0-TESTS (colocate the library's monolithic tests/ into src/**/__tests__ — user directive).
- [x] RFC0-3 Docs-site React island — DONE (commit 99bce01). @astrojs/react wired; a canvas-2D board island (Canvas2dBoardIsland.tsx) renders the shared example game live via `declarative-hex-worlds/canvas2d` with a PROCEDURAL sprite sheet (zero downloaded art → builds anywhere). Lives in a STANDALONE astro page (src/pages/demo/canvas2d.astro) OUTSIDE the docs collection because starlight-llms-txt can't serialize an interactive island; a guide (guides/live-demos.md) links to it. examples got an exports map (., /three, /canvas2d). FOLLOW-ON (RFC0-3b): a live /three (3D) island — deferred until FREE-model hosting for the Pages site is wired (the three board needs GLTFs served at a public URL).
- [x] RFC0-CAM Camera/viewport command surface — DONE. Camera is a SIGNAL: neutral renderer-free `src/camera` (declarative-hex-worlds/camera + umbrella) — CameraState (angle: top-down/isometric/tilted; projection: ortho/perspective; fit: frame-board/fill-viewport; padding/fov), computeBoardBounds (world extent over tiles+elevation), computeCameraFraming/frameBoard → renderer-neutral CameraFraming (eye position, look-at target, orthoHalfHeight, fov, distance). 14 pure tests, 100% cov. THREE BINDING: src/react-elements/camera.ts `useCamera(state)` hook subscribes to the projected plan (koota signal) + reapplies on board/view/size change; the pure application split to camera-apply.ts `applyCameraFraming` (3 tests, 100% cov, follows the objects/objects-sync coverage-split — camera.ts R3F hook is v8-ignored + BROWSER_ONLY-excluded). A 2D binding can read the SAME framing for its viewport. renderer-optionality contract confirms src/camera is renderer-free.
- [x] RFC0-TESTS REASSESSED — the real drift (SimpleRPG game tests mislocated under tests/) was ALREADY fixed by the examples migration (RFC0-2). Audited the remaining tests/ tree: it is LEGITIMATELY package-level / harness-specific, NOT module tests that belong in src/**/__tests__. tests/unit/* are all cross-cutting (public-api = the ENTIRE export snapshot; bundle-size = whole package; determinism = cross-PROCESS subprocess spawns; trait-identity = ACROSS subpaths; umbrella-browser-safe; cli-security = spawns the CLI black-box). tests/contract/* WALK the whole source graph (purity/tier/tarball/pillar). tests/browser/* need the @vitest/browser harness. Forcing these into a single src/module/__tests__ would put package-level tests where they DON'T apply — the opposite of "tests belong where they apply". The 66 module-level tests are already correctly colocated in src/**/__tests__. Verdict: current split is correct; no mechanical move.

**Phase B — Visual-verification backbone swap (coverage UP, then vendor guide retired):**
- [ ] RFC0-4 Capture per-pillar showcases from SimpleRPG rendering FREE through the library; `guide` source stays → coverage strictly increases.
- [ ] RFC0-5 Repoint pillar `source_images:`, `release-readiness.json`, `docs/index.md`, `coverage.ts` from guide paths → SimpleRPG showcase paths; contract tests assert per-pillar showcase coverage.
- [ ] RFC0-6 Retire `guide` source: remove the 19 KayKit PDF pages from tracked `docs/` → gitignored `raw-assets/`; delete all now-dead guide references (~2293); `coverage.test.ts` asserts the showcase backbone. Premium never in public docs.

**Phase C — Generic asset sources + CLI + defaults:**
- [ ] RFC0-CLI Source-agnostic asset-binder CLI: point at ANY assets path → scan → heuristic source-kind detection → SUGGEST a default binding → emit a Zod-validated AssetSourceSpec JSON. Three authoring paths: hand-written JSON, CLI scan+prompts, or a local web-form configurator (spins up a server + browser). KayKit = one recognized signature. Builds on G0; feeds RFC0-10. See RFC §CLI.
- [x] RFC0-9 (coast-mask half) DONE — `setCoastEdges` now validates at AUTHOR time via `assertCoverableCoastMask` (src/selectors): a non-contiguous mask (e.g. [0,2,4]=010101, or 6 edges=enclosed) throws a clear error naming the tile + mask + "must be a contiguous run of 1-5 water edges", instead of an opaque "no coast variant covers…" deep in projection. `isCoverableCoastMask` helper + 15-case regression test (contiguous pass, non-contiguous throw, author-call throw). REMAINING (RFC0-9b): generalize `AssetSource.resolveEdge` (the transition/edge-mask resolution seam for arbitrary packs) — the coast fix is the concrete first instance.
- [ ] RFC0-10 KayKit-as-downloadable-defaults (G4): THREE first-class downloadable CC0 packs — Medieval Hexagon (tiles/), Adventures (models/, playable), Skeletons (models/, enemies) = a full game from defaults. Fetch-on-demand, never tracked; default source resolution (present→use; absent→clear error); docs. Generalizes the single-pack FREE bootstrap to the 3-pack set.

**Phase C2 — Capabilities surfaced by real CC0 packs (SimpleRPG gap-finding):**
- [ ] RFC0-TEX Texture-binding: bind specific textures to specific GLB/GLTF models (KayKit Adventures ships textures per mesh). Spec + render bridge support explicit texture→model binding.
- [x] RFC0-TAG Classifier tags — CORE DONE. First-class gameplay classifier vocabulary (CLASSIFIER_TAGS: playable/non-playable/enemy/random-encounter/unit/building/prop + custom) distinct from render kinds. src/classifiers (declarative-hex-worlds/classifiers + umbrella): pure `classifyPlacement` (composes PlacementClassifiers; DEFAULT kind→classifier: unit→unit, structure→building, prop/decoration→prop) + metadata storage (classifierMetadata → `classifier:<tag>`:true boolean flags in placement metadata, which survives projection; classifierTagsOf/placementHasClassifier read them back). koota-backed queries (classifiers-runtime, split so pure stays core-eligible): selectPlacementsByClassifier(world, tag), listClassifiersInWorld. React hook usePlacementsByClassifier(tag) (react.ts, browser-tested via react-bindings). renderer-free (contract-confirmed). FOLLOW-ON (RFC0-TAGb): default classifiers for recognized PACKS (Adventures→playable, Skeletons→enemy) — depends on RFC0-10 packs landing.
- [ ] RFC0-NORM Cross-pack size-normalization: hex tiles + props from different makers (KayKit vs Kenney) normalize to one board-cell size for mixed-pack boards.
- [ ] RFC0-OVERLAY Overlay + placement transforms: model/building from pack B onto a tile from pack A — scale-normalize + center-place + dev-controllable offset/anchor/rotation via `<Model>`/`<Sprite>`.
- [ ] RFC0-ACC Accessory-attachment: associate accessories (helmet/weapon/shield) to a character model at the right node/bone. Composition primitive for the Adventures pack.
- [ ] RFC0-PACKS Two tiers. DOWNLOADABLE DEFAULTS (first-class, fetched on demand, never tracked — G4): KayKit Medieval Hexagon→tiles/, Adventures→models/ (playable), Skeletons→models/ (enemies) = a FULL game from defaults; CLI offers all three. BAKED into packages/simple-rpg/assets (a few Kenney pieces, tracked): Kenney Hexagon Kit→tiles/ (size-norm test), Kenney Retro Fantasy→models/ (overlay test) — proving cross-maker EXTENSION. Kenney attribution in NOTICE+docs.

**Phase D — Ship + external proof:**
- [ ] RFC0-11 Comprehensive local review (code/security/simplify, parallel background), fold findings forward.
- [ ] RFC0-12 Open the PR fully (it's #220, draft today); address ALL CI + review feedback; resolve every thread; squash-merge once green (the "main protection" ruleset now gates this: PR + resolved threads + up-to-date + 8 checks).
- [ ] RFC0-13 Confirm the new version is published on npmjs (release-please cuts it post-merge; Monitor the release, verify the registry).
- [ ] RFC0-14 Pivot back to little-legends: RE-HOME its composition + interaction onto dhw's koota world — register its sprites + hex tilesets as asset sources, back worldgen/placement/selection/movement/fog/camera with dhw instead of hand-rolled R3F. Render the 10 tilesets through the tileset source, screenshot against `docs/design/refs/civrev2-*.jpg`. Each little-legends need dhw can't yet back = a NEW capability item folded back into this branch (gap-finding runs throughout, per RFC §Guiding method).
