# declarative-hex-worlds — HANDOFF (2026-07-07)

Written by the prior agent for a smarter successor. This is an honest state dump.
The prior agent **failed** on one thing repeatedly: it did not have the asset-
provisioning plan and kept stalling / mis-calling visual work "browser-gated"
when full browser tooling (chrome-devtools-mcp, playwright, @vitest/browser) was
available. Do not repeat that. **Read the "#1 UNBLOCK" section first.**

---

## Where things stand

- **Branch:** `feat/generic-asset-sources`. **PR:** #220 (open, not draft).
- **PR #220 is MERGE-READY:** all 8 ruleset-required checks GREEN
  (`lint`, `typecheck`, `build`, `test`, `Docs Site Build`, `Semgrep SAST`,
  `Dependency Review`, `Coverage`). CodeQL is red but is **NOT a required check**
  (false-flag). 0 unresolved review threads. 0 required approvals.
- **Merge is HELD by explicit user decision (2026-07-07):** do NOT squash-merge
  until **RFC0-4/5/6** (SimpleRPG showcase capture → repoint pillars → retire the
  `guide` docs) land. See `.agent-state/decisions.ndjson` (the OVERRIDE entry).
- The "main protection" repo ruleset (id 18595759) enforces the 8 checks above +
  squash-only + resolved threads. Self-merge is allowed once green (0 approvals).

## What shipped on this branch (all done, tested, reviewed, green)

The full RFC-0001 re-architecture (signals+bindings) plus this session's units:
- **RFC0-CLI** — `bind` CLI: scan an assets dir → Zod-validated AssetSourceSpec
  JSON (`src/asset-source/scan.ts`, `src/cli/commands/bind.ts`).
- **Coverage fix** — `src/react/react.ts` added to `UNIT_ONLY_COVERAGE_EXCLUDES`
  in `vitest.coverage.shared.ts` (it is browser-only; unit instrumentation made
  merge-phantoms). If you touch react.ts coverage, read the comments there.
- **RFC0-9b** — general transition-edge resolution: `TRANSITION_VARIANTS` +
  `selectTransitionVariant` (selectors) + gltf-pack `resolveEdge` +
  `resolveAssetUrlById` (asset-source).
- **RFC0-10** — downloadable-pack registry (`src/cli/commands/bootstrap/
  registry.ts`: medieval-hexagon/adventurers/skeletons) + descriptor-
  parameterized bootstrap (two layout shapes, medieval + character, in
  `upstream-layout.ts` + `core.ts`) + `bootstrapPack`/`resolveDefaultPackKit`/
  `assertPackPresent` (`pack-bootstrap.ts`) + CLI `bootstrap --pack <id>`.
  Packs fetch from GitHub into `<rawAssetsRoot>/<packId>/`.
- **RFC0-PACKS baked tier** — Kenney Hexagon Kit CC0 pieces tracked in
  `packages/examples/assets/kenney-hexagon/{tiles,pieces}/` + a pure-node
  cross-maker test (`packages/examples/src/game/__tests__/kenney-cross-maker.test.ts`).

## What is OPEN (RFC0-4/5/6 — the merge gate)

`.agent-state/directive.md` items RFC0-4, RFC0-5, RFC0-6. In short:
- **RFC0-4:** capture per-pillar showcase screenshots from SimpleRPG (now the
  `@declarative-hex-worlds/examples` package) rendering FREE through the library.
- **RFC0-5:** repoint pillar `source_images:` in `src/interop/coverage.ts` (see
  `SHOWCASE_ARTIFACTS` / the pillar→sourceImage map), plus `release-readiness.json`,
  `docs/index.md`, from `guide` paths → the new SimpleRPG showcase paths. Contract
  tests assert per-pillar showcase coverage.
- **RFC0-6:** retire the `guide` source — remove the 19 KayKit PDF pages from
  tracked `docs/` (they become gitignored raw assets), delete the ~2293 now-dead
  guide references, and `coverage.test.ts` asserts the showcase backbone.

These need **real browser rendering with real assets present** — which is
entirely doable (see below). The prior agent wrongly treated this as blocked.

---

## #1 UNBLOCK — asset provisioning (THIS IS THE MISSING PIECE)

The visual/browser/e2e tests read assets from specific on-disk locations. The
prior agent DID NOT have the correct provisioning plan captured here, kept trying
`references/` copies from the NAS, and the user said **that is the WRONG path /
wrong plan** — there is a NEWER plan the user already gave (in chat, not in these
files): **KayKit assets can be installed locally; Kenney assets are downloaded
from URLs the user provided.** THAT PLAN IS NOT YET WRITTEN DOWN HERE. Recover it
from the user or the session chat BEFORE touching visual tests. Do not invent
paths.

What the configs factually expect TODAY (so you know what the plan must satisfy):

| Config | Env/define var | Path it resolves (relative to package root unless noted) |
|---|---|---|
| `vitest.browser.free.config.ts` | `HEX_WORLDS_ASSET_ROOT` (default `models`) | the FREE KayKit GLTF tree — i.e. the output of `bootstrap` (CLI) |
| `vitest.browser.extra.config.ts` | `__EXTRA_SOURCE_ROOT__` | `references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA/Assets/gltf` |
| `vitest.browser.extra.config.ts` | `__EXTRA_TEXTURE_ROOT__` | `references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA/Textures` |
| `vitest.browser.local-assets.config.ts` | `__KENNEY_CASTLE_ROOT__` | `references/kenney_castle-kit/Models/GLB format` (workspace root) |
| `vitest.browser.local-assets.config.ts` | `__KAYKIT_ADVENTURERS_ROOT__` | `references/KayKit_Adventurers_2.0_FREE` (workspace root) |

If the NEW plan changes these locations, the configs (above) are the single place
to update — they're all `resolve(...)` + `define:` blocks, easy to repoint.

**CRITICAL — visual-baseline corruption rule:** NEVER run the browser/coverage
tests with MISSING assets. With no models the render is blank, and the tests
**overwrite** the PNG baselines in `tests/visual/__screenshots__/**` with blank
frames. The prior agent corrupted `free-guide-source-pages.png` this way once
(good size ~131473 bytes; corrupt ~396269). Provision assets FIRST, verify a
render is non-blank (screenshot it, LOOK at it), THEN run the visual suite.

## How to actually do RFC0-4/5/6 (once assets are provisioned)

1. Provision assets per the user's NEW plan (see #1 above).
2. Run the dev server (`pnpm --filter declarative-hex-worlds dev` or the examples
   package) and drive it with chrome-devtools-mcp: navigate, screenshot, and
   **read your own screenshot** — confirm the board renders real KayKit tiles,
   not a blank/404 frame.
3. Run `pnpm test:visual` (= `test:browser:free` + `test:browser:extra` +
   `test:e2e:local-assets`). The screenshot-producing specs are
   `tests/browser/{free-visual,extra-visual,feature-gallery}.spec.ts`.
4. Promote the per-pillar screenshots into `docs/showcases/` (RFC0-4), repoint
   `src/interop/coverage.ts` `SHOWCASE_ARTIFACTS` + the pillar map + docs/index.md
   + release-readiness.json (RFC0-5), retire the guide pages + dead refs (RFC0-6).
5. Re-cut any stale baselines with `--update-snapshots` ONLY after confirming the
   render is correct against the intent.
6. Push; wait for the 8 checks; then (per the user's hold) confirm the user is OK
   to merge, and squash-merge.

## Downstream (blocked on the above)

- **RFC0-11:** rolling local review — already done per-feature this session
  (security + code reviewers dispatched for RFC0-CLI/9b/10; findings folded).
- **RFC0-12:** squash-merge (HELD — see top).
- **RFC0-13:** confirm release-please publishes to npm post-merge; verify registry.
- **RFC0-14:** pivot to little-legends — re-home its composition + interaction
  onto this library's koota world (see the little-legends HANDOFF). Depends on
  this being merged + published.

## Commands (from `packages/declarative-hex-worlds/`)

- Build (DTS OOMs at default heap): `NODE_OPTIONS=--max-old-space-size=6144 pnpm build`
- Typecheck: `pnpm exec tsc --noEmit`
- Lint (MUST run from the package dir, not repo root — nested biome config):
  `pnpm exec biome check <paths>` (see memory `dhw-biome-nested-config`).
- Unit tests: `pnpm exec vitest run --config vitest.config.ts <path>`
- Visual/browser: see RFC0-4/5/6 section — provision assets FIRST.
