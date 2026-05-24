# Release Readiness Coverage

This generated ledger combines the decomposed KayKit guide coverage, manifest
coverage, public API treatment, visual artifacts, local reference packs, and
package verification gates. Regenerate it with:

```bash
pnpm coverage:ledger
```

## Summary

- Status: passed
- Guide pages: 19/19
- Guide scenarios: 19
- Guide assets: 404 unique (221 FREE, 183 EXTRA), 1108 page-level occurrences
- Public API surfaces: 74
- Public roles: 12
- Visual artifacts: 70 available, 0 missing, 0 skipped
- Local references: 4 available, 0 missing, 0 skipped
- Release checks: 11 passed, 0 failed, 0 not run, 0 skipped

## Manifest Coverage

- Manifest edition: free
- Manifest assets: 221
- FREE guide assets in manifest: 221/221
- FREE guide assets missing from manifest: 0
- EXTRA guide assets kept local-only: 183/183
- Manifest validation: 0 error(s), 0 warning(s)

## Gaps

- None

## Local References

| Status | Reference | Path | Purpose |
| --- | --- | --- | --- |
| available | KayKit Medieval Hexagon FREE | `references/KayKit_Medieval_Hexagon_Pack_1.0_FREE` | FREE source pack for guide extraction, generated assets, and manifest audits. |
| available | KayKit Medieval Hexagon EXTRA | `references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA` | Purchased local-only EXTRA pack for category and guide visual coverage. |
| available | Kenney Castle Kit | `references/kenney_castle-kit` | Third-party compatibility fixture for non-hex props, structures, and warnings. |
| available | KayKit Adventurers FREE | `references/KayKit_Adventurers_2.0_FREE` | Animated actor fixture for facing, spawn, and SimpleRPG local-asset coverage. |

## Release Checks

| Status | Command | Summary |
| --- | --- | --- |
| passed | `pnpm lint` | Biome lint over workspace packages, docs scripts, and generated public TypeScript surfaces. |
| passed | `pnpm typecheck` | Strict TypeScript validation for runtime, package tests, docs scripts, and generated examples. |
| passed | `pnpm build` | Nx package build including tsup ESM chunks, declarations, CLI shebang preservation, and asset copies. |
| passed | `pnpm test:ci` | Serialized non-browser release gate: docs contracts, API docs, assets, workspace/workflow audits, CLI smoke, expectations, unit tests, package audit, consumer smoke, and dry-run pack. |
| passed | `pnpm expectations` | Behavior-drift fixtures for seeded generation, SimpleRPG quests, movement, actor targets, patrols, mutations, and final placements. |
| passed | `pnpm docs:build` | TypeDoc and VitePress documentation build with public JSDoc and guide-link validation. |
| passed | `pnpm test:consumer` | Packed tarball installed into a temporary app, then compiled and executed through public subpaths, examples, and the CLI bin. |
| passed | `pnpm test:visual` | FREE, EXTRA, SimpleRPG, Kenney Castle Kit, and KayKit Adventurers browser visual suites with screenshot quality checks. |
| passed | `pnpm showcases:promote -- --check` | Curated browser screenshots match committed docs/package showcase copies and pass the shared PNG quality analyzer. |
| passed | `pnpm test:workflows` | CI, Release Please, npm OIDC publish, automerge, and Dependabot workflow contract audit. |
| passed | `pnpm pack:dry-run` | npm tarball dry run proving publish whitelist, FREE asset inclusion, local reference exclusion, README gallery links, KayKit attribution/NOTICE, and packaged showcase PNG quality. |

## Visual Artifacts

| Status | Source | Artifact | Pages |
| --- | --- | --- | --- |
| available | guide | `docs/assets/kaykit-guide/montage.png` | 1 |
| available | guide | `docs/assets/kaykit-guide/pages/page-01.png` | 1 |
| available | guide | `docs/assets/kaykit-guide/pages/page-02.png` | 2 |
| available | guide | `docs/assets/kaykit-guide/pages/page-03.png` | 3 |
| available | guide | `docs/assets/kaykit-guide/pages/page-04.png` | 4 |
| available | guide | `docs/assets/kaykit-guide/pages/page-05.png` | 5 |
| available | guide | `docs/assets/kaykit-guide/pages/page-06.png` | 6 |
| available | guide | `docs/assets/kaykit-guide/pages/page-07.png` | 7 |
| available | guide | `docs/assets/kaykit-guide/pages/page-08.png` | 8 |
| available | guide | `docs/assets/kaykit-guide/pages/page-09.png` | 9 |
| available | guide | `docs/assets/kaykit-guide/pages/page-10.png` | 10 |
| available | guide | `docs/assets/kaykit-guide/pages/page-11.png` | 11 |
| available | guide | `docs/assets/kaykit-guide/pages/page-12.png` | 12 |
| available | guide | `docs/assets/kaykit-guide/pages/page-13.png` | 13 |
| available | guide | `docs/assets/kaykit-guide/pages/page-14.png` | 14 |
| available | guide | `docs/assets/kaykit-guide/pages/page-15.png` | 15 |
| available | guide | `docs/assets/kaykit-guide/pages/page-16.png` | 16 |
| available | guide | `docs/assets/kaykit-guide/pages/page-17.png` | 17 |
| available | guide | `docs/assets/kaykit-guide/pages/page-18.png` | 18 |
| available | guide | `docs/assets/kaykit-guide/pages/page-19.png` | 19 |
| available | showcase | `docs/assets/showcases/extra-blueprint-biome-transition-showcase.png` | - |
| available | showcase | `docs/assets/showcases/extra-harbor-gameboard.png` | - |
| available | showcase | `docs/assets/showcases/free-blueprint-builder-showcase.png` | - |
| available | showcase | `docs/assets/showcases/free-guide-coasts-all-labels-rotations-water-waterless.png` | - |
| available | showcase | `docs/assets/showcases/free-guide-rivers-all-labels-rotations-water-waterless.png` | - |
| available | showcase | `docs/assets/showcases/free-guide-roads-all-labels-rotations.png` | - |
| available | showcase | `docs/assets/showcases/free-guide-scenarios-by-extracted-page.png` | - |
| available | showcase | `docs/assets/showcases/simple-rpg-fixed-completed.png` | - |
| available | showcase | `docs/assets/showcases/simple-rpg-local-third-party-assets.png` | - |
| available | showcase | `docs/assets/showcases/simple-rpg-seeded-completed.png` | - |
| available | guide | `NOTICE.md` | 19 |
| available | showcase | `packages/medieval-hexagon-gameboard/docs/showcases/extra-blueprint-biome-transition-showcase.png` | - |
| available | showcase | `packages/medieval-hexagon-gameboard/docs/showcases/extra-harbor-gameboard.png` | - |
| available | showcase | `packages/medieval-hexagon-gameboard/docs/showcases/free-blueprint-builder-showcase.png` | - |
| available | showcase | `packages/medieval-hexagon-gameboard/docs/showcases/free-guide-coasts-all-labels-rotations-water-waterless.png` | - |
| available | showcase | `packages/medieval-hexagon-gameboard/docs/showcases/free-guide-rivers-all-labels-rotations-water-waterless.png` | - |
| available | showcase | `packages/medieval-hexagon-gameboard/docs/showcases/free-guide-roads-all-labels-rotations.png` | - |
| available | showcase | `packages/medieval-hexagon-gameboard/docs/showcases/free-guide-scenarios-by-extracted-page.png` | - |
| available | showcase | `packages/medieval-hexagon-gameboard/docs/showcases/simple-rpg-fixed-completed.png` | - |
| available | showcase | `packages/medieval-hexagon-gameboard/docs/showcases/simple-rpg-local-third-party-assets.png` | - |
| available | showcase | `packages/medieval-hexagon-gameboard/docs/showcases/simple-rpg-seeded-completed.png` | - |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-blueprint-biome-transition-showcase.png` | 9, 11, 13 |
| available | screenshot | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-guide-assets-by-public-role.png` | - |
| available | screenshot | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-guide-scenarios-pages-02-15.png` | - |
| available | screenshot | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-guide-scenarios-pages-16-18.png` | - |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-harbor-gameboard.png` | 7, 15 |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png` | 2, 15, 17 |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-decoration-nature-props.png` | 5, 16 |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png` | 11, 12, 13 |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png` | 14, 16, 17, 18 |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-seasonal-textures.png` | 11, 12, 13 |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-blueprint-builder-showcase.png` | 8, 9 |
| available | screenshot | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-catalog.png` | - |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-gameboard-recipe.png` | 8, 9 |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-generated-piece-recipe.png` | 6 |
| available | screenshot | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-assets-by-public-role.png` | - |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-coasts-all-labels-rotations-water-waterless.png` | 7 |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png` | 2, 5, 6, 8, 10 |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-river-curvy-crossings-all-modes.png` | 4 |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-rivers-all-labels-rotations-water-waterless.png` | 4, 7 |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-roads-all-labels-rotations.png` | 3 |
| available | screenshot | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-scenarios-by-extracted-page.png` | - |
| available | screenshot | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-source-pages.png` | - |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-seeded-gameboard.png` | 9 |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-seeded-hex-gameboard.png` | 10 |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-fixed-completed.png` | 9 |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-local-third-party-assets.png` | 14 |
| available | screenshot | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-packaged-scenario.png` | - |
| available | guide | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-seeded-completed.png` | 18 |
| available | screenshot | `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-simulation-report.png` | - |

## Guide Pages

| Page | Scenario | Edition | Assets | APIs | Docs | Visuals | Source Image |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | `page-01-overview-and-license` | reference | 0 | 3 | 3 | 2 | available `docs/assets/kaykit-guide/pages/page-01.png` |
| 2 | `page-02-buildings-props-and-factions` | mixed | 164 | 16 | 2 | 2 | available `docs/assets/kaykit-guide/pages/page-02.png` |
| 3 | `page-03-road-variations` | free | 15 | 4 | 2 | 1 | available `docs/assets/kaykit-guide/pages/page-03.png` |
| 4 | `page-04-river-variations` | free | 30 | 7 | 2 | 2 | available `docs/assets/kaykit-guide/pages/page-04.png` |
| 5 | `page-05-nature-contents` | free | 77 | 13 | 2 | 2 | available `docs/assets/kaykit-guide/pages/page-05.png` |
| 6 | `page-06-nature-usage` | free | 42 | 9 | 2 | 2 | available `docs/assets/kaykit-guide/pages/page-06.png` |
| 7 | `page-07-water-usage` | free | 44 | 18 | 2 | 3 | available `docs/assets/kaykit-guide/pages/page-07.png` |
| 8 | `page-08-taller-hex-tiles` | free | 3 | 6 | 2 | 3 | available `docs/assets/kaykit-guide/pages/page-08.png` |
| 9 | `page-09-world-design-example` | free | 61 | 21 | 2 | 5 | available `docs/assets/kaykit-guide/pages/page-09.png` |
| 10 | `page-10-floating-islands` | free | 45 | 12 | 2 | 2 | available `docs/assets/kaykit-guide/pages/page-10.png` |
| 11 | `page-11-biomes` | extra | 1 | 6 | 2 | 3 | available `docs/assets/kaykit-guide/pages/page-11.png` |
| 12 | `page-12-alternate-textures` | extra | 1 | 7 | 2 | 2 | available `docs/assets/kaykit-guide/pages/page-12.png` |
| 13 | `page-13-transition-tiles` | extra | 1 | 8 | 2 | 3 | available `docs/assets/kaykit-guide/pages/page-13.png` |
| 14 | `page-14-units` | extra | 137 | 5 | 2 | 2 | available `docs/assets/kaykit-guide/pages/page-14.png` |
| 15 | `page-15-shipyard-harbors` | mixed | 25 | 13 | 2 | 2 | available `docs/assets/kaykit-guide/pages/page-15.png` |
| 16 | `page-16-stables-and-horses` | extra | 155 | 16 | 2 | 2 | available `docs/assets/kaykit-guide/pages/page-16.png` |
| 17 | `page-17-workshop-and-siege` | extra | 170 | 19 | 2 | 2 | available `docs/assets/kaykit-guide/pages/page-17.png` |
| 18 | `page-18-unit-combinations` | extra | 137 | 6 | 2 | 2 | available `docs/assets/kaykit-guide/pages/page-18.png` |
| 19 | `page-19-supporters-and-attribution` | reference | 0 | 3 | 3 | 2 | available `docs/assets/kaykit-guide/pages/page-19.png` |

## Final Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test:ci`
- `pnpm expectations`
- `pnpm docs:build`
- `pnpm test:consumer`
- `pnpm test:visual`
- `pnpm showcases:promote -- --check`
- `pnpm test:workflows`
- `pnpm pack:dry-run`
