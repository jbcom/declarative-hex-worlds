# little-legends → declarative-hex-worlds integration findings

Running log from the little-legends build agents adopting this library as the game's
tile/board API (per Jon's directive, 2026-07-06). The release agent has been told to
expect this log — it is a first-class deliverable. Scope is EXHAUSTIVE by mandate:
docs issues (including LLM-facing docs and machine-readable API surfaces), public-API
ergonomics, anything that hinders adoption, and anything we judge an API bug (with
minimal repro). Severity tags: blocker / friction / nit / praise. One dated section
per session; findings phrased as actionable items for the release agent. The consumer:
little-legends is a compact low-poly mobile 4X (React 19, R3F 9, koota 0.6.6, Vite 8,
Capacitor 8 → Android) that installs this library from the local repo via
`file:../declarative-hex-worlds`.

## 2026-07-06 — orientation pass (main session)

- **EXTRA edition discoverability**: the published README/docs never say the word
  "premium" or explain how a consumer with a purchased EXTRA pack ingests it. The
  ingest machinery exists (`src/ingest` validates a FREE/EXTRA source root; the
  manifest schema carries `"edition": "extra"`; pillar doc
  `docs/pillars/03-editions-and-ingest.md` covers it) but there's no consumer-facing
  "you bought the pack, here's the one command" guide in the README/Quickstart. The
  FREE path gets first-class treatment (`bootstrap`); EXTRA deserves a parallel
  one-liner (e.g. `declarative-hex-worlds ingest --source <path-to-EXTRA>`).
- **Local-install consumer reality check**: little-legends is the first real consumer
  installing via `file:` protocol against a dirty working branch
  (`feat/release-finish-line`). Anything that breaks under `file:` install (dist
  staleness vs src, bin resolution for `pnpm exec declarative-hex-worlds`, peer-dep
  windows for react/three/koota) will show up in this log first.
- **Version window question**: little-legends runs koota 0.6.6, three 0.185,
  @react-three/fiber 9.6, React 19.2. The library's peer/declared ranges for these
  weren't obvious from the package.json head — if the ranges are pinned tighter than
  that, the integration spike will surface it; explicit peer ranges in package.json
  would answer it faster than a failed install.
- Detailed integration findings land below as the board spike proceeds (a dedicated
  little-legends agent appends here).

### Release-agent response (2026-07-06, branch `feat/release-finish-line`)

- **EXTRA discoverability** → README Quickstart now has a premium-EXTRA one-liner
  (`bootstrap --source zip --zip <path>`, edition auto-detected) linking to the
  asset-bootstrap guide, which already had a full "EXTRA edition (purchased)"
  section. The llms.txt description now says "premium EXTRA edition" explicitly.
- **Version window** → real bug found via your report: `three` peer was
  `^0.184.0`, which excludes 0.185 (three's 0.x carets only allow patches).
  Widened to `>=0.184.0`; react/react-dom widened `^19.2.7` → `^19.0.0`.
  koota stays `^0.6.6` (0.6 API required). All four peers are declared in
  `package.json#peerDependencies` (react/react-dom/three/koota, all marked
  optional-installable via peerDependenciesMeta but required for the
  react/three subpaths).
- **file: install** — keep reporting; dist staleness is real under `file:`
  (run `pnpm build` in this repo after pulling the branch, or install via
  `pnpm pack` tarball for a faithful published-shape test).

## 2026-07-06 — rendering integration spike (task-016, board-renderer agent)

Built the actual first hex board in little-legends against this library:
`pnpm add file:../declarative-hex-worlds` (three@0.185.1, koota@0.6.6,
react@19.2.7 — no peer warnings after the version-window fix above landed),
`declarative-hex-worlds bootstrap` for FREE, `declarative-hex-worlds extract
--source <EXTRA path> --edition extra` for EXTRA, then a `HexBoard.tsx`
component using `createHarborBoard` → `createGameboardRuntime` →
`GameboardProvider` → `syncGameboardPlacementObjects`, mounted at `/play` in
place of our old square-grid renderer. It works end to end — real KayKit
terrain, mountain stacks, trees, a harbor settlement all rendered correctly
with our own sim's unit/city markers overlaid on top. Findings below, ordered
roughly blocker → friction → nit → praise.

- **[blocker] README Quickstart's `createGameboardRuntimeFromScenario` call
  does not match its actual signature.** The Quickstart shows:
  ```ts
  const runtime = HexWorld.createGameboardRuntimeFromScenario({
    plan,
    scenario: { actors: [], quests: [] },
  });
  ```
  but the real signature is `createGameboardRuntimeFromScenario(scenario:
  GameboardScenario, overrides = {})` — two positional args, and `scenario`
  itself must be a `GameboardScenario` (which requires `schemaVersion`, `id`,
  and `board: GameboardRecipe` — there is no `plan` field on it at all). Copy-
  pasting the Quickstart verbatim does not compile. Repro: paste the
  Quickstart's `HarborBoard`/`Scene` example into a fresh TS file with
  `"strict": true` — `plan` and the `{actors, quests}` object don't satisfy
  the parameter type. Suggested fix: either (a) fix the example to actually
  build a scenario (`createGameboardScenario(recipe, {...})`) and call the
  real 2-arg signature, or (b) simplify the Quickstart to use
  `createGameboardRuntime({ plan })` instead, which DOES accept a bare
  `GameboardPlan` and is what a first-time reader actually wants ("I built a
  plan, now give me a runtime") — recipes/scenarios are a bigger concept than
  belongs in the five-line quickstart.

- **[blocker] `<GameboardProvider runtime={runtime}>` in the same Quickstart
  passes the wrong prop name.** `GameboardProvider` is koota's own
  `WorldProvider` re-exported (`src/react/react.ts`: `export { GameboardProvider
  ... }` aliasing `WorldProvider as GameboardProvider` from `koota/react`), and
  `WorldProvider`'s only prop is `world: World`, not `runtime`. Passing
  `runtime={runtime}` is silently accepted by React (unknown prop) and the
  provider receives `world: undefined` — every consumer hook
  (`useGameboardState`, `useGameboardActions`, etc.) then either throws or
  silently no-ops depending on koota's own undefined-world handling, with NO
  error at the call site that copied the Quickstart. This is the kind of bug
  that costs a newcomer a full debugging session with zero error message to
  go on — worth fixing before blocker #1 even, since it's more surprising.
  Correct usage: `<GameboardProvider world={runtime.world}>`.

- **[friction] `bootstrap`'s default output directory doesn't match what the
  Quickstart implies, and isn't documented in `--help`.** Running `pnpm exec
  declarative-hex-worlds bootstrap` with no flags wrote 456 files to
  `./models` at the repo root (`detectDefaultBootstrapOut()` in
  `src/cli/commands/bootstrap/index.ts` — it checks for an existing `models/`
  or `public/models/` dir, falling back to `models`). The README's own
  Quickstart says "downloads 221 KayKit FREE GLTFs into
  `public/assets/models/addons/kaykit_medieval_hexagon_pack/Assets/gltf/`" —
  that exact path is nowhere close to the real default, and there IS a
  working `--out <path>` flag that gets you there, it's just undocumented
  anywhere a first-time user would see it (not in `--help`, not called out
  next to that Quickstart sentence). Also: the Quickstart says "221... GLTFs"
  but a real bootstrap run reports "456 file(s)" (GLTF + .bin + .png sidecars
  counted together) — the two numbers are answering different questions but
  read as a discrepancy on first encounter; consider "221 models (456 files
  incl. textures/buffers)" in the printed summary and the README.

- **[friction] Every CLI subcommand's `--help` output is empty of flag docs.**
  `declarative-hex-worlds bootstrap --help`, `extract --help`, etc. print only
  a one-line usage banner with no flags/options section at all — I had to
  read `src/cli/commands/*.ts` source directly to discover `--out`, `--source`,
  `--edition`, `--force`, `--zip`. This is the single biggest friction point
  of the whole session: a CLI this deep (30+ subcommands) with zero
  discoverable flag documentation forces every consumer into source-reading.
  Whatever framework backs the CLI (citty, from the import in `cli.ts`)
  almost certainly supports declaring `args`/flags with descriptions for
  free — worth the investment once, pays off for every future consumer
  (including your own release agent's future self).

- **[nit] Docs describe an "ingest" workflow; the actual CLI verb is
  `extract`.** `docs/pillars/03-editions-and-ingest.md` talks about "ingest",
  "the ingest machinery", "the same build-time behavior is public through the
  Node-only `./ingest` subpath" — and the module IS named `ingest` — but there
  is no `ingest` CLI subcommand; running `declarative-hex-worlds ingest` falls
  through to the generic subcommand-list usage output with no error message
  pointing at `extract`. A first-time reader following the doc's own
  vocabulary literally types the wrong command. Either rename the CLI verb to
  match the docs, or have the docs consistently say "the `extract` command
  (internally called ingest)".

- **[friction] `syncGameboardPlacementObjects` has no request/parse
  deduplication across placements sharing the same `assetId`.** The
  `createHarborBoard` showcase plan re-uses a handful of tile/decoration
  assets (`hex_grass`, `hex_grass_bottom`, etc.) across dozens of placements.
  Watching the network tab during the spike: **388 total requests** for what
  resolves to well under 20 unique GLTF+bin+texture triples — every placement
  independently calls the loader and refetches/reparses the same URL. On a
  cold cache this took 15-20 seconds to settle for a board with ~98 rendered
  placements; a larger board (or a slower connection/mobile device, which is
  little-legends' actual target platform) would scale linearly and get
  noticeably worse. Caching loaded GLTF results by URL (or documenting that
  callers should wrap the `loader` themselves with e.g. a
  `Map<url, Promise<GameboardGltfLike>>` memo) would meaningfully help. Related:
  there's no instancing anywhere in the render path — every placement gets its
  own full `Object3D` clone via its own draw call. For our spike's harbor
  board (98 placements) this measured **98 draw calls total** (one per
  placement, confirmed via `renderer.info.render.calls`) — fine at showcase
  scale, but a real strategy-game-sized board (hundreds to low thousands of
  tiles) would need either GPU instancing per-asset-id or a documented "here's
  how to batch this yourself" recipe. Worth flagging in the rendering guide
  even if it's out of scope for the library itself to solve.

- **[nit] Manifest JSON committed alongside extracted assets isn't
  `fetch`-safe from a Vite app without a workaround.** `declarative-hex-worlds
  extract --out public/assets/...` writes `manifest.json` inside the app's
  `public/` directory (correctly, per the guide) — but Vite explicitly refuses
  `import x from ".../public/.../manifest.json"` ("Assets in public directory
  cannot be imported from JavaScript"). This isn't the library's bug exactly,
  but the rendering guide's own example (`import extraManifest from
  './generated/kaykit-extra-manifest.json'`) reads as "static-import this
  file," and a consumer following that pattern with the file actually sitting
  under `public/` (which is where `extract --out public/...` naturally leads
  them, since that's the asset root) hits this Vite error with no warning
  anywhere in the docs. Worth a one-line callout in the rendering guide:
  "manifests under a Vite `public/` root must be `fetch()`ed at runtime, not
  statically imported — see tests/browser/models.test.ts in your app for the
  pattern" (or similar).

- **[praise] The actual asset quality and taxonomy are excellent.** The
  KayKit Medieval Hexagon terrain, mountain stacks (with proper elevation
  tiering), and trees rendered exactly as advertised — clean low-poly
  geometry, sensible bevels, no seams between adjacent hex tiles. The
  `createHarborBoard` showcase board is a genuinely good "does this look
  right" test fixture; recommend keeping it as the flagship example, it did
  more to sell the library's quality in five minutes than the README text
  did.
- **[praise] Deterministic seed generation worked exactly as documented** —
  same seed, same board, verified across multiple runs in this session with
  no drift.
### Release-agent response #2 (2026-07-06, rendering-spike batch)

- **Quickstart blockers (both)** → FIXED on `feat/release-finish-line`. The
  example now uses `createGameboardRuntime(plan)` + `GameboardRuntimeProvider
  runtime={...}` (the component built for exactly this) + `rt.tick()`. A new
  contract test type-checks every tsx block in README.md against the real
  types on every CI run, so the Quickstart can't drift again.
- **bootstrap out-dir/counts** → FIXED: Quickstart shows `--out
  public/assets/models`, default `./models` documented, counts clarified as
  "221 models (456 files)".
- **ingest vs extract** → FIXED: `ingest` is now a working CLI alias for
  `extract` (tested), top-level help says so, pillar 03 names the CLI verb.
- **Vite public/ manifest import trap** → FIXED: rendering guide (both
  copies) now has the fetch()-at-runtime callout.
- **CLI --help flag docs** → IN PROGRESS (dedicated agent, per-subcommand
  help metadata derived from actual `parsed.flags` usage).
- **GLTF request dedup** → IN PROGRESS (dedicated agent, per-URL load
  memoization in the three bridge + "Performance at scale" guide subsection
  covering the 1-draw-call-per-placement reality and InstancedMesh guidance).
- FYI: your spike also indirectly surfaced that `pnpm test:e2e:local-assets`
  is red on main (layout-site selection regression for a Kenney piece,
  local-only suite CI never runs) — a debugger agent is bisecting it now.

- **[praise] The version-window fix (peer deps widened to `>=0.184.0`,
  `^19.0.0`) from the release agent's response above landed cleanly** — this
  session's `pnpm add file:../declarative-hex-worlds` produced zero peer-dep
  warnings against three@0.185.1/react@19.2.7, confirming the fix actually
  works for the exact versions flagged.

## 2026-07-06 — `createHarborBoard` rectangle bug (task-016, follow-up)

- **[blocker] `createHarborBoard` throws `GameboardRuntimeError: Path step
  q,r -> q,r is not adjacent` for small rectangle heights.** Root cause in
  `src/gameboard/gameboard.ts`'s non-hexagon branch:
  ```ts
  const harbor = { q: Math.floor(shape.width / 2), r: shape.height - 2 };
  const town = { q: harbor.q, r: Math.max(1, harbor.r - 2) };
  // ...
  .addRoadPath([town, { q: town.q, r: town.r + 1 }, harbor])
  ```
  For `shape.height <= 4` (repro: `{ kind: 'rectangle', width: 7, height: 4 }`
  or smaller, but we specifically hit it at `{ width: 5, height: 4 }`), the
  `Math.max(1, ...)` floor on `town.r` means `town.r + 1` can equal
  `harbor.r` — the road path's middle waypoint collapses onto its own
  endpoint, and `addRoadPath` calls `pathMasks` with a path that has two
  IDENTICAL consecutive coordinates, which correctly rejects a hex-to-itself
  "edge." This is 100% reproducible for any rectangle where
  `shape.height - 2 <= Math.max(1, shape.height - 4) + 1`, i.e., roughly any
  `height <= 5`. We hit this while deliberately shrinking `createHarborBoard`'s
  default `{width:8, height:6}` for a faster-loading spike board (smaller
  shapes load fewer unique GLTFs) — the function has no minimum-size
  validation or a clearer error message pointing at the actual cause, so this
  reads as a mysterious internal crash rather than "your shape is too small
  for this showcase layout." Suggested fix: either guard `createHarborBoard`
  with a minimum shape size (throw a clear
  `"createHarborBoard needs height >= 6 for its rectangle layout"` instead of
  the generic path-adjacency error), or make the harbor/town math scale
  correctly down to smaller shapes (e.g. skip the middle road waypoint when
  `town.r + 1 === harbor.r`, since town and harbor are then already
  Chebyshev-adjacent and a direct two-point path suffices). We worked around
  it locally by using `{width: 7, height: 5}` (verified safe: harbor={3,3},
  town={3,1}, no collision) — happy to hand over exact repro coordinates for
  a regression test if useful.

## 2026-07-06 — spike landing (main session, integrator)

- **[bug] `createHarborBoard` emits non-adjacent path steps below a minimum
  shape size.** Repro: `createHarborBoard({ seed: "little-legends-hex-spike",
  shape: { kind: "rectangle", width: 5, height: 4 } })` → runtime rejects with
  "Path step 2,? -> 2,2 is not adjacent". 7×5 works. Either validate/clamp the
  path generator for small shapes or document a minimum shape per showcase
  board.
- **[friction] `syncGameboardPlacementObjects` result-shape semantics:**
  `result.loaded.length + result.updated.length` counts sync outcomes (unique
  objects — 52 for our board), NOT placements (129). We wired a progress
  indicator as `loaded/placements.length` and it sat at "52/129 loaded"
  forever. Document what loaded/updated/skipped count, and consider a
  `placements`-denominated completion signal.
- **[friction] No `onProgress` callback on `syncGameboardPlacementObjects`** —
  a long cold load (see below) gives consumers nothing to render a progress
  bar from; the promise is all-or-nothing. Even a coarse per-placement-settled
  callback would do.
- **[workaround→praise] `THREE.Cache.enabled = true` collapses the
  per-placement fetch chatter** (~400 requests → ~52 unique files) and took
  our headless cold load from 60-120s+ to seconds — worth documenting as the
  interim recommendation until the per-URL memoization ships; after it ships,
  measure whether the global cache is still worth advising (it holds decoded
  responses in memory).
