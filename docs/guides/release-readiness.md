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
- Release checks: 12 passed, 0 failed, 0 not run, 0 skipped
- SimpleRPG API evidence: 74/74 represented, 40 directly executed, 9 active mode(s)

## Manifest Coverage

- Manifest edition: free
- Manifest assets: 221
- FREE guide assets in manifest: 221/221
- FREE guide assets missing from manifest: 0
- EXTRA guide assets kept local-only: 183/183
- Manifest validation: 0 error(s), 0 warning(s)

## SimpleRPG Public API Evidence

- Guide-facing public APIs represented: 74/74
- Direct executable helper APIs: 40
- KayKit public treatment records asserted: 404
- Decomposed guide pages asserted: 19
- Missing public APIs: 0
- Stale evidence rows: 0

| Mode | API Count |
| --- | ---: |
| fixed-gameplay | 30 |
| seeded-generation | 10 |
| packaged-scenario | 1 |
| executable-smoke | 40 |
| blueprint-recipe | 4 |
| manifest-package | 6 |
| compatibility-adapter | 2 |
| package-boundary | 3 |
| visual-coverage | 26 |

### SimpleRPG Exercise Matrix

| Public API | Modes | Pages | Assets | Evidence |
| --- | --- | --- | ---: | --- |
| `analyzeHexTileRegistry` | executable-smoke | 13 | 0 | Packaged SimpleRPG usage analyzes a runtime tile registry in its executable guide API smoke. |
| `coloredUnitAssetId` | executable-smoke | 14, 16, 17, 18 | 112 | Packaged SimpleRPG usage resolves a colored unit asset id in executable smoke. |
| `createGameboardBuilder` | fixed-gameplay | 9 | 0 | Fixed SimpleRPG board starts from the public fluent builder. |
| `createGameboardLayoutArchetypeRegistry` | executable-smoke, seeded-generation | 6 | 0 | Packaged SimpleRPG usage creates a layout archetype registry in executable smoke. |
| `createGameboardLayoutFillRuleFromPiece` | executable-smoke, seeded-generation | 2, 5, 6, 9, 10, 15, 16, 17 | 77 | Packaged SimpleRPG usage creates a piece-backed layout fill rule in executable smoke. |
| `createGameboardPlanFromRecipe` | executable-smoke | 2, 7, 8, 9, 10, 11, 12, 13, 16, 17 | 25 | Packaged SimpleRPG usage compiles a recipe into a concrete plan in executable smoke. |
| `createGameboardPlanFromTiles` | executable-smoke | 7, 9 | 2 | Packaged SimpleRPG usage rebuilds a plan from explicit tiles in executable smoke. |
| `createGameboardRuntimeFromScenario` | packaged-scenario | 9, 18 | 0 | Packaged SimpleRPG usage creates a runtime facade directly from the scenario JSON. |
| `createHexagonGameboardGrid` | executable-smoke | 10 | 0 | Packaged SimpleRPG usage creates a Honeycomb hexagon grid in executable smoke. |
| `createManifestBundle` | executable-smoke, manifest-package | 12 | 0 | Packaged SimpleRPG usage bundles the FREE manifest in executable smoke. |
| `createGameboardBlueprintPlan` | executable-smoke, blueprint-recipe | 6, 10 | 0 | Packaged SimpleRPG usage compiles a blueprint plan in executable smoke. |
| `createGameboardBlueprintRecipe` | executable-smoke, blueprint-recipe | 5, 8, 11, 13 | 0 | Packaged SimpleRPG usage compiles a blueprint recipe in executable smoke. |
| `createMedievalShowcaseBlueprintRecipe` | executable-smoke, blueprint-recipe | 9, 13 | 0 | Packaged SimpleRPG usage compiles the showcase blueprint recipe in executable smoke. |
| `createSeededGameboardPlan` | executable-smoke, seeded-generation | 9 | 0 | Packaged SimpleRPG usage builds a seeded board in executable smoke. |
| `declareHexTile` | executable-smoke | 13 | 0 | Packaged SimpleRPG usage declares a tile for registry analysis in executable smoke. |
| `executeGameboardInteractionCommand` | fixed-gameplay | 17 | 0 | SimpleRPG quest execution moves, interacts, attacks, and removes enemies through commands. |
| `externalAssetSpawnOptions` | executable-smoke, compatibility-adapter | 15 | 0 | Packaged SimpleRPG usage converts compatibility analysis into spawn options in executable smoke. |
| `factionBuildingAssetId` | executable-smoke | 2, 15, 16, 17 | 108 | Packaged SimpleRPG usage resolves a faction building asset id in executable smoke. |
| `flagAssetId` | executable-smoke | 2, 5 | 4 | Packaged SimpleRPG usage resolves a faction flag asset id in executable smoke. |
| `freeManifest` | executable-smoke, manifest-package | 1 | 0 | Packaged SimpleRPG usage reads the FREE manifest in executable smoke. |
| `GameboardBuilder.addBridge` | fixed-gameplay, visual-coverage | 2, 7, 9 | 2 | Fixed SimpleRPG board places a bridge beside the harbor approach. |
| `GameboardBuilder.addConstructionSite` | fixed-gameplay, visual-coverage | 2, 17 | 7 | Fixed SimpleRPG board places a staged worksite off the golden path. |
| `GameboardBuilder.addElevationRamp` | fixed-gameplay, visual-coverage | 8, 10 | 2 | Fixed SimpleRPG board places a ramp against an elevated tile. |
| `GameboardBuilder.addFactionBuilding` | fixed-gameplay, visual-coverage | 2, 15, 16, 17 | 108 | Fixed and packaged SimpleRPG boards place faction buildings. |
| `GameboardBuilder.addFlag` | fixed-gameplay, visual-coverage | 2, 5 | 4 | Fixed SimpleRPG board places a faction flag and runtime actors use flag assets. |
| `GameboardBuilder.addForest` | fixed-gameplay, seeded-generation, visual-coverage | 5, 6, 9, 10 | 12 | Fixed and seeded SimpleRPG boards include forests and tree scatter. |
| `GameboardBuilder.addFortification` | fixed-gameplay, visual-coverage | 2, 16, 17 | 11 | Fixed SimpleRPG board places a town wall segment with enclosure metadata. |
| `GameboardBuilder.addHarbor` | fixed-gameplay, seeded-generation, visual-coverage | 2, 5, 7, 15 | 25 | Fixed and seeded SimpleRPG boards include a playable harbor/coast relationship. |
| `GameboardBuilder.addHill` | fixed-gameplay, seeded-generation, visual-coverage | 5, 6, 9, 10 | 9 | Fixed and seeded SimpleRPG boards include hill terrain and decorations. |
| `GameboardBuilder.addMountainStack` | fixed-gameplay, seeded-generation, visual-coverage | 5, 6, 8, 9, 10 | 12 | Fixed, seeded, and packaged SimpleRPG boards place stacked mountains. |
| `GameboardBuilder.addNature` | fixed-gameplay, visual-coverage | 5, 6, 9, 10 | 42 | Fixed SimpleRPG board places standalone nature assets. |
| `GameboardBuilder.addNeutralStructure` | fixed-gameplay, visual-coverage | 2, 7, 9, 16, 17 | 21 | Fixed SimpleRPG board places a neutral grain building. |
| `GameboardBuilder.addProp` | fixed-gameplay, visual-coverage | 2, 5, 15, 16, 17 | 35 | Fixed SimpleRPG quest uses a registered crate prop as a passable actor target. |
| `GameboardBuilder.addPropCluster` | fixed-gameplay, visual-coverage | 2, 5, 15, 16, 17 | 31 | Fixed SimpleRPG board places a resource-cache cluster. |
| `GameboardBuilder.addRiverPath` | fixed-gameplay, visual-coverage | 4, 7 | 30 | Fixed SimpleRPG board routes a curvy waterless river through the quest road. |
| `GameboardBuilder.addRoadPath` | fixed-gameplay, seeded-generation, visual-coverage | 3, 9 | 15 | Fixed, seeded, and packaged SimpleRPG boards use roads for movement routes. |
| `GameboardBuilder.addSettlement` | fixed-gameplay, visual-coverage | 2, 16, 17 | 96 | Fixed SimpleRPG board places a settlement home through the settlement alias. |
| `GameboardBuilder.addSiegeProjectile` | fixed-gameplay, visual-coverage | 2, 17 | 1 | Fixed SimpleRPG board places a catapult projectile beside the town wall. |
| `GameboardBuilder.addTransition` | fixed-gameplay, visual-coverage | 11, 12, 13 | 1 | Fixed SimpleRPG board places a local-only texture transition and marks it EXTRA. |
| `GameboardBuilder.addUnit` | fixed-gameplay, visual-coverage | 14, 16, 17, 18 | 137 | Fixed SimpleRPG board places colored and neutral EXTRA unit parts. |
| `GameboardBuilder.addUnitPreset` | fixed-gameplay, visual-coverage | 14, 15, 16, 17, 18 | 137 | Fixed SimpleRPG board places a composed soldier preset. |
| `GameboardBuilder.scatterDecorations` | fixed-gameplay, seeded-generation, visual-coverage | 5, 6, 9, 10 | 42 | Fixed and seeded SimpleRPG boards scatter decorations deterministically. |
| `GameboardBuilder.setCoastEdges` | fixed-gameplay, visual-coverage | 7, 15 | 10 | Fixed SimpleRPG board marks the water edge as coast before adding a harbor. |
| `GameboardBuilder.setElevation` | fixed-gameplay, visual-coverage | 8, 10 | 0 | Fixed SimpleRPG board raises a tile and then adds an elevation ramp. |
| `GameboardBuilder.setTerrain` | fixed-gameplay, seeded-generation, visual-coverage | 7, 9 | 2 | Fixed SimpleRPG board authors a full water row and seeded generation fills terrain. |
| `GameboardBuilder.setTileAsset` | fixed-gameplay, visual-coverage | 7, 8, 9, 10 | 5 | Fixed and packaged SimpleRPG boards override authored tile assets and tags. |
| `inspectGameboardBlueprint` | executable-smoke, blueprint-recipe | 6, 11 | 0 | Packaged SimpleRPG usage inspects a blueprint in executable smoke. |
| `listCoastGuidePermutations` | executable-smoke | 7, 15 | 10 | Packaged SimpleRPG usage lists coast guide permutations in executable smoke. |
| `listKayKitAssetPublicTreatments` | executable-smoke | 1 | 0 | Packaged SimpleRPG usage lists every KayKit asset public treatment in executable smoke. |
| `listKayKitGuideScenarios` | executable-smoke | 1, 19 | 0 | Packaged SimpleRPG usage lists every decomposed KayKit guide scenario in executable smoke. |
| `listPropClusterAssets` | executable-smoke | 2, 5, 15, 16, 17 | 31 | Packaged SimpleRPG usage resolves prop-cluster assets in executable smoke. |
| `listRiverCrossingGuidePermutations` | executable-smoke | 4, 7 | 4 | Packaged SimpleRPG usage lists river crossing permutations in executable smoke. |
| `listRiverCurvyGuidePermutations` | executable-smoke | 4, 7 | 2 | Packaged SimpleRPG usage lists curvy river permutations in executable smoke. |
| `listRiverGuidePermutations` | executable-smoke | 4, 7 | 24 | Packaged SimpleRPG usage lists river permutations in executable smoke. |
| `listRoadGuidePermutations` | executable-smoke | 3, 9 | 15 | Packaged SimpleRPG usage lists road permutations in executable smoke. |
| `declarative-hex-worlds manifest` | package-boundary, manifest-package | 12 | 0 | Package smoke validates the CLI manifest and packaged SimpleRPG imports together. |
| `neutralUnitAssetId` | executable-smoke | 14, 16, 17, 18 | 25 | Packaged SimpleRPG usage resolves a neutral unit asset id in executable smoke. |
| `NOTICE.md` | package-boundary, manifest-package | 19 | 0 | Release/package audits keep KayKit attribution with the SimpleRPG packaged smoke. |
| `package.json files` | package-boundary, manifest-package | 19 | 0 | Package audit verifies exports, files, examples, and SimpleRPG package imports. |
| `planGameboardInteractionCommand` | fixed-gameplay | 17 | 0 | Fixed SimpleRPG tests plan prop interaction and enemy attack commands. |
| `recommendExternalAssetFacing` | executable-smoke, compatibility-adapter | 16 | 0 | Packaged SimpleRPG usage recommends external asset facing in executable smoke. |
| `selectCoastVariant` | executable-smoke | 7, 15 | 10 | Packaged SimpleRPG usage selects a coast variant in executable smoke. |
| `selectCoastVariantByLabel` | executable-smoke | 7, 15 | 10 | Packaged SimpleRPG usage selects a labeled coast variant in executable smoke. |
| `selectManifestAssets` | executable-smoke, manifest-package | 12 | 0 | Packaged SimpleRPG usage selects manifest assets in executable smoke. |
| `selectRiverCrossingVariant` | executable-smoke | 4, 7 | 4 | Packaged SimpleRPG usage selects a river crossing variant in executable smoke. |
| `selectRiverVariant` | executable-smoke | 4, 7 | 26 | Packaged SimpleRPG usage selects a river variant in executable smoke. |
| `selectRiverVariantByLabel` | executable-smoke | 4, 7 | 24 | Packaged SimpleRPG usage selects a labeled river variant in executable smoke. |
| `selectRoadVariant` | executable-smoke | 3, 9 | 15 | Packaged SimpleRPG usage selects a road variant in executable smoke. |
| `selectRoadVariantByLabel` | executable-smoke | 3, 9 | 15 | Packaged SimpleRPG usage selects a labeled road variant in executable smoke. |
| `selectSpawnCoordinates` | executable-smoke | 9 | 0 | Packaged SimpleRPG usage selects raw deterministic spawn coordinates in executable smoke. |
| `spawnGameboardActor` | fixed-gameplay | 14, 16, 17, 18 | 137 | Fixed and seeded SimpleRPG fixtures spawn player, NPC, prop, and enemy actors. |
| `textureFileName` | executable-smoke | 11, 12 | 0 | Packaged SimpleRPG usage resolves a texture filename in executable smoke. |
| `validateGameboardRecipe` | executable-smoke | 11, 12, 13 | 1 | Packaged SimpleRPG usage validates a compiled recipe in executable smoke. |
| `validateGameboardRecipeGeneration` | executable-smoke | 13 | 0 | Packaged SimpleRPG usage validates recipe generation config in executable smoke. |

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
| passed | `pnpm test:docs-contract` | Pillar frontmatter/link audit plus README, pillar, and guide SimpleRPG executable coverage contract for 40 guide-facing helper APIs, 404 KayKit public treatment records, and 19 guide pages. |
| passed | `pnpm expectations` | Behavior-drift fixtures for seeded generation, SimpleRPG quests, executable guide API smoke, movement, actor targets, patrols, mutations, and final placements. |
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
| available | showcase | `docs/showcases/extra-blueprint-biome-transition-showcase.png` | - |
| available | showcase | `docs/showcases/extra-harbor-gameboard.png` | - |
| available | showcase | `docs/showcases/free-blueprint-builder-showcase.png` | - |
| available | showcase | `docs/showcases/free-guide-coasts-all-labels-rotations-water-waterless.png` | - |
| available | showcase | `docs/showcases/free-guide-rivers-all-labels-rotations-water-waterless.png` | - |
| available | showcase | `docs/showcases/free-guide-roads-all-labels-rotations.png` | - |
| available | showcase | `docs/showcases/free-guide-scenarios-by-extracted-page.png` | - |
| available | showcase | `docs/showcases/simple-rpg-fixed-completed.png` | - |
| available | showcase | `docs/showcases/simple-rpg-local-third-party-assets.png` | - |
| available | showcase | `docs/showcases/simple-rpg-seeded-completed.png` | - |
| available | guide | `tests/browser/__screenshots__/extra-blueprint-biome-transition-showcase.png` | 9, 11, 13 |
| available | screenshot | `tests/browser/__screenshots__/extra-guide-assets-by-public-role.png` | - |
| available | screenshot | `tests/browser/__screenshots__/extra-guide-scenarios-pages-02-15.png` | - |
| available | screenshot | `tests/browser/__screenshots__/extra-guide-scenarios-pages-16-18.png` | - |
| available | guide | `tests/browser/__screenshots__/extra-harbor-gameboard.png` | 7, 15 |
| available | guide | `tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png` | 2, 15, 17 |
| available | guide | `tests/browser/__screenshots__/extra-local-all-decoration-nature-props.png` | 5, 16 |
| available | guide | `tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png` | 11, 12, 13 |
| available | guide | `tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png` | 14, 16, 17, 18 |
| available | guide | `tests/browser/__screenshots__/extra-seasonal-textures.png` | 11, 12, 13 |
| available | guide | `tests/browser/__screenshots__/free-blueprint-builder-showcase.png` | 8, 9 |
| available | screenshot | `tests/browser/__screenshots__/free-catalog.png` | - |
| available | guide | `tests/browser/__screenshots__/free-gameboard-recipe.png` | 8, 9 |
| available | guide | `tests/browser/__screenshots__/free-generated-piece-recipe.png` | 6 |
| available | screenshot | `tests/browser/__screenshots__/free-guide-assets-by-public-role.png` | - |
| available | guide | `tests/browser/__screenshots__/free-guide-coasts-all-labels-rotations-water-waterless.png` | 7 |
| available | guide | `tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png` | 2, 5, 6, 8, 10 |
| available | guide | `tests/browser/__screenshots__/free-guide-river-curvy-crossings-all-modes.png` | 4 |
| available | guide | `tests/browser/__screenshots__/free-guide-rivers-all-labels-rotations-water-waterless.png` | 4, 7 |
| available | guide | `tests/browser/__screenshots__/free-guide-roads-all-labels-rotations.png` | 3 |
| available | screenshot | `tests/browser/__screenshots__/free-guide-scenarios-by-extracted-page.png` | - |
| available | screenshot | `tests/browser/__screenshots__/free-guide-source-pages.png` | - |
| available | guide | `tests/browser/__screenshots__/free-seeded-gameboard.png` | 9 |
| available | guide | `tests/browser/__screenshots__/free-seeded-hex-gameboard.png` | 10 |
| available | guide | `tests/browser/__screenshots__/simple-rpg-fixed-completed.png` | 9 |
| available | guide | `tests/browser/__screenshots__/simple-rpg-local-third-party-assets.png` | 14 |
| available | screenshot | `tests/browser/__screenshots__/simple-rpg-packaged-scenario.png` | - |
| available | guide | `tests/browser/__screenshots__/simple-rpg-seeded-completed.png` | 18 |
| available | screenshot | `tests/browser/__screenshots__/simple-rpg-simulation-report.png` | - |

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
- `pnpm test:docs-contract`
- `pnpm expectations`
- `pnpm docs:build`
- `pnpm test:consumer`
- `pnpm test:visual`
- `pnpm showcases:promote -- --check`
- `pnpm test:workflows`
- `pnpm pack:dry-run`
