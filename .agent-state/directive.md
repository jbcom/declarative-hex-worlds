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
- [x] RFC0-RENDER seam + 2D/3D first-class — FOUNDATION DONE (commits 3dd25a1 transform+dimension, ab6e19f RenderBackend+three impl). (a) AssetTransform moved src/three → src/asset-source (neutral, ./three re-exports); (b) AssetDimension='2d'|'3d' on every AssetRenderRequest (gltf→3d, tileset-cell→2d), sources emit it; (c) RenderBackend<TNode,TParent> interface (src/asset-source/render-backend.ts, type-only, neutral); (d) createThreeRenderBackend (src/three/three-backend.ts, reference 2.5D impl, dimensions:['2d','3d'], 100% covered). REMAINING (own follow-on unit, not blocking): (e) wire `<HexWorld backend={…}>` to drive `<GameboardObjects>`'s frame loop through a RenderBackend (default three) + `<Sprite>`=2D-first/`<Model>`=3D-first + a browser test — a `<GameboardObjects>` frame-loop refactor. Then a Pixi backend is a pure add (implement RenderBackend). The SEAM (interface+three impl) is in place; consumers can already build a backend against it.

**Phase A — SimpleRPG as first consumer + gap-finder (unblocked by the element layer):**
- [ ] RFC0-2 Promote SimpleRPG to `packages/simple-rpg` — a real consumer that renders through dhw's element surface (`declarative-hex-worlds/react-elements`). MIGRATE the library's `tests/e2e/simple-rpg*` + `tests/integration/simple-rpg*` + `src/guides/simple-rpg/*` into the package as ITS OWN e2e (SimpleRPG IS the e2e). Layered CI: library suite passes FIRST (needs:), THEN SimpleRPG e2e. Build the actual game + R3F render surface + run states (compose/cross-pack/pathfind/viewport). See RFC §D-test-topology. packages/simple-rpg/ is scaffolded (workspace:* dep, jsx tsconfig, 2 consumes-library tests). Add @react-three/fiber devDep.
- [ ] RFC0-3 Docs-site React island: add `@astrojs/react`; embed SimpleRPG live (`client:load`) on a docs page — the docs RUN the library. (docs-site is already a workspace member — the prerequisite is done.)
- [ ] RFC0-CAM Camera/viewport command surface (GAP from SimpleRPG's `viewport` run-state): frame-board, fill-viewport, set perspective/angle (top-down/iso/tilted, ortho vs perspective), orient. Through the RenderBackend + a `useCamera` hook. Browser test per mode. (Backs the `useCamera` hook the element layer stubbed as a follow-on.)

**Phase B — Visual-verification backbone swap (coverage UP, then vendor guide retired):**
- [ ] RFC0-4 Capture per-pillar showcases from SimpleRPG rendering FREE through the library; `guide` source stays → coverage strictly increases.
- [ ] RFC0-5 Repoint pillar `source_images:`, `release-readiness.json`, `docs/index.md`, `coverage.ts` from guide paths → SimpleRPG showcase paths; contract tests assert per-pillar showcase coverage.
- [ ] RFC0-6 Retire `guide` source: remove the 19 KayKit PDF pages from tracked `docs/` → gitignored `raw-assets/`; delete all now-dead guide references (~2293); `coverage.test.ts` asserts the showcase backbone. Premium never in public docs.

**Phase C — Generic asset sources + CLI + defaults:**
- [ ] RFC0-CLI Source-agnostic asset-binder CLI: point at ANY assets path → scan → heuristic source-kind detection → SUGGEST a default binding → emit a Zod-validated AssetSourceSpec JSON. Three authoring paths: hand-written JSON, CLI scan+prompts, or a local web-form configurator (spins up a server + browser). KayKit = one recognized signature. Builds on G0; feeds RFC0-10. See RFC §CLI.
- [ ] RFC0-9 Generalize transition/edge-mask resolution (`AssetSource.resolveEdge`); fix `setCoastEdges` to validate/degrade non-contiguous masks at author time (the `010101` finding) + regression test.
- [ ] RFC0-10 KayKit-as-downloadable-defaults (G4): THREE first-class downloadable CC0 packs — Medieval Hexagon (tiles/), Adventures (models/, playable), Skeletons (models/, enemies) = a full game from defaults. Fetch-on-demand, never tracked; default source resolution (present→use; absent→clear error); docs. Generalizes the single-pack FREE bootstrap to the 3-pack set.

**Phase C2 — Capabilities surfaced by real CC0 packs (SimpleRPG gap-finding):**
- [ ] RFC0-TEX Texture-binding: bind specific textures to specific GLB/GLTF models (KayKit Adventures ships textures per mesh). Spec + render bridge support explicit texture→model binding.
- [ ] RFC0-TAG Classifier tags: first-class queryable tags (playable/non-playable/enemy/random-encounter/unit/building/prop) on assets+placements, koota-backed, queryable via hooks. Default classifiers for recognized packs (Adventures→playable, Skeletons→enemy).
- [ ] RFC0-NORM Cross-pack size-normalization: hex tiles + props from different makers (KayKit vs Kenney) normalize to one board-cell size for mixed-pack boards.
- [ ] RFC0-OVERLAY Overlay + placement transforms: model/building from pack B onto a tile from pack A — scale-normalize + center-place + dev-controllable offset/anchor/rotation via `<Model>`/`<Sprite>`.
- [ ] RFC0-ACC Accessory-attachment: associate accessories (helmet/weapon/shield) to a character model at the right node/bone. Composition primitive for the Adventures pack.
- [ ] RFC0-PACKS Two tiers. DOWNLOADABLE DEFAULTS (first-class, fetched on demand, never tracked — G4): KayKit Medieval Hexagon→tiles/, Adventures→models/ (playable), Skeletons→models/ (enemies) = a FULL game from defaults; CLI offers all three. BAKED into packages/simple-rpg/assets (a few Kenney pieces, tracked): Kenney Hexagon Kit→tiles/ (size-norm test), Kenney Retro Fantasy→models/ (overlay test) — proving cross-maker EXTENSION. Kenney attribution in NOTICE+docs.

**Phase D — Ship + external proof:**
- [ ] RFC0-11 Comprehensive local review (code/security/simplify, parallel background), fold findings forward.
- [ ] RFC0-12 Open the PR fully (it's #220, draft today); address ALL CI + review feedback; resolve every thread; squash-merge once green (the "main protection" ruleset now gates this: PR + resolved threads + up-to-date + 8 checks).
- [ ] RFC0-13 Confirm the new version is published on npmjs (release-please cuts it post-merge; Monitor the release, verify the registry).
- [ ] RFC0-14 Pivot back to little-legends: RE-HOME its composition + interaction onto dhw's koota world — register its sprites + hex tilesets as asset sources, back worldgen/placement/selection/movement/fog/camera with dhw instead of hand-rolled R3F. Render the 10 tilesets through the tileset source, screenshot against `docs/design/refs/civrev2-*.jpg`. Each little-legends need dhw can't yet back = a NEW capability item folded back into this branch (gap-finding runs throughout, per RFC §Guiding method).
