# Guide Scenario Coverage

The KayKit user guide is decomposed into 19 source-page scenarios. This page is
the human-facing map for those scenarios; the machine-readable source remains
`listKayKitGuideScenarios()`, `describeKayKitGuideScenarioCoverage()`,
`listKayKitGuideAssetCoverages()`, `listKayKitGuideRoleCoverages()`,
`listKayKitGuidePublicApiCoverages()`, and the `guide-scenarios` /
`guide-assets` / `guide-roles` / `guide-apis` CLI commands.

Use this page when deciding whether a guide image has public API treatment, docs,
and visual review coverage. Use the catalog API or CLI when a tool needs exact
asset ids or public treatment records.

```sh
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-scenarios --markdown > docs/guides/guide-scenario-coverage.md
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-scenarios --page 15 --includeTreatments --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-assets --assetId hex_road_M --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-roles --role prop --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-apis --publicApi GameboardBuilder.addHarbor --json
```

## Coverage Contract

- Every extracted guide page has exactly one `page-NN-*` scenario.
- Every scenario lists its source PNG, edition scope, public API surfaces, docs,
  and visual artifacts.
- Every FREE and local EXTRA asset id appears in at least one scenario unless it
  is a reference-only license/supporter page with no assets.
- Every asset-bearing scenario can be expanded into public treatment records
  with `listKayKitGuideScenarioTreatments(id)`.
- Every FREE and local EXTRA asset id can be inverted back to pages/APIs/docs
  and screenshots with `listKayKitGuideAssetCoverages()`.
- Every public treatment role can be inverted back to pages/assets/APIs with
  `listKayKitGuideRoleCoverages()`.
- Every public API string in a scenario can be inverted back to pages/assets with
  `listKayKitGuidePublicApiCoverages()`.

## Page Matrix

### Page 01 - Overview And License Contract

- Scenario: `page-01-overview-and-license`
- Edition: `reference`
- Source image: `docs/assets/kaykit-guide/pages/page-01.png`
- Asset coverage: 0 unique, 0 FREE, 0 EXTRA, 0 occurrences
- Roles: reference-only
- Public API treatment: `freeManifest`,
  `listKayKitAssetPublicTreatments`,
  `listKayKitGuideScenarios`
- Visual artifacts: `docs/assets/kaykit-guide/montage.png`,
  `docs/assets/kaykit-guide/pages/page-01.png`
- Docs: `README.md`, `NOTICE.md`, `docs/pillars/00-library-charter.md`

### Page 02 - Buildings, Props, And Factions

- Scenario: `page-02-buildings-props-and-factions`
- Edition: `mixed`
- Source image: `docs/assets/kaykit-guide/pages/page-02.png`
- Asset coverage: 164 unique, 119 FREE, 45 EXTRA, 164 occurrences
- Roles: `faction-building`, `neutral-structure`, `prop`
- Public API treatment: `GameboardBuilder.addBridge`,
  `GameboardBuilder.addFactionBuilding`,
  `GameboardBuilder.addFlag`,
  `GameboardBuilder.addHarbor`,
  `GameboardBuilder.addNeutralStructure`,
  `GameboardBuilder.addProp`,
  `GameboardBuilder.addSettlement`,
  `createGameboardLayoutFillRuleFromPiece`,
  `createGameboardPlanFromRecipe`,
  `factionBuildingAssetId`,
  `flagAssetId`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`, `docs/guides/public-api.md`

### Page 03 - Road Variations

- Scenario: `page-03-road-variations`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-03.png`
- Asset coverage: 15 unique, 15 FREE, 0 EXTRA, 15 occurrences
- Roles: `road-tile`
- Public API treatment: `GameboardBuilder.addRoadPath`,
  `listRoadGuidePermutations`,
  `selectRoadVariant`,
  `selectRoadVariantByLabel`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-roads-all-labels-rotations.png`
- Docs: `docs/pillars/01-tiles-connectivity.md`, `docs/pillars/04-visual-verification.md`

### Page 04 - River Variations

- Scenario: `page-04-river-variations`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-04.png`
- Asset coverage: 30 unique, 30 FREE, 0 EXTRA, 30 occurrences
- Roles: `river-tile`
- Public API treatment: `GameboardBuilder.addRiverPath`,
  `listRiverCrossingGuidePermutations`,
  `listRiverCurvyGuidePermutations`,
  `listRiverGuidePermutations`,
  `selectRiverCrossingVariant`,
  `selectRiverVariant`,
  `selectRiverVariantByLabel`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-rivers-all-labels-rotations-water-waterless.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-river-curvy-crossings-all-modes.png`
- Docs: `docs/pillars/01-tiles-connectivity.md`, `docs/pillars/04-visual-verification.md`

### Page 05 - Nature And Decoration Contents

- Scenario: `page-05-nature-contents`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-05.png`
- Asset coverage: 77 unique, 68 FREE, 9 EXTRA, 77 occurrences
- Roles: `nature-decoration`, `prop`
- Public API treatment: `GameboardBuilder.addFlag`,
  `GameboardBuilder.addForest`,
  `GameboardBuilder.addHarbor`,
  `GameboardBuilder.addHill`,
  `GameboardBuilder.addMountainStack`,
  `GameboardBuilder.addNature`,
  `GameboardBuilder.addProp`,
  `GameboardBuilder.scatterDecorations`,
  `createGameboardLayoutFillRuleFromPiece`,
  `createMedievalGameboardBlueprintRecipe`,
  `flagAssetId`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-decoration-nature-props.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`, `docs/pillars/05-koota-runtime-rules.md`

### Page 06 - Nature Usage Guide

- Scenario: `page-06-nature-usage`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-06.png`
- Asset coverage: 42 unique, 42 FREE, 0 EXTRA, 42 occurrences
- Roles: `nature-decoration`
- Public API treatment: `GameboardBuilder.addForest`,
  `GameboardBuilder.addHill`,
  `GameboardBuilder.addMountainStack`,
  `GameboardBuilder.addNature`,
  `GameboardBuilder.scatterDecorations`,
  `createGameboardLayoutArchetypeRegistry`,
  `createGameboardLayoutFillRuleFromPiece`,
  `createMedievalGameboardBlueprintPlan`,
  `inspectMedievalGameboardBlueprint`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-generated-piece-recipe.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`, `docs/pillars/05-koota-runtime-rules.md`

### Page 07 - Water Usage Guide

- Scenario: `page-07-water-usage`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-07.png`
- Asset coverage: 44 unique, 44 FREE, 0 EXTRA, 44 occurrences
- Roles: `base-tile`, `coast-tile`, `neutral-structure`, `river-tile`
- Public API treatment: `GameboardBuilder.addBridge`,
  `GameboardBuilder.addHarbor`,
  `GameboardBuilder.addNeutralStructure`,
  `GameboardBuilder.addRiverPath`,
  `GameboardBuilder.setCoastEdges`,
  `GameboardBuilder.setTerrain`,
  `GameboardBuilder.setTileAsset`,
  `createGameboardPlanFromRecipe`,
  `createGameboardPlanFromTiles`,
  `listCoastGuidePermutations`,
  `listRiverCrossingGuidePermutations`,
  `listRiverCurvyGuidePermutations`,
  `listRiverGuidePermutations`,
  `selectCoastVariant`,
  `selectCoastVariantByLabel`,
  `selectRiverCrossingVariant`,
  `selectRiverVariant`,
  `selectRiverVariantByLabel`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-coasts-all-labels-rotations-water-waterless.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-rivers-all-labels-rotations-water-waterless.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-harbor-gameboard.png`
- Docs: `docs/pillars/01-tiles-connectivity.md`, `docs/pillars/04-visual-verification.md`

### Page 08 - Taller Hex Tiles

- Scenario: `page-08-taller-hex-tiles`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-08.png`
- Asset coverage: 3 unique, 3 FREE, 0 EXTRA, 3 occurrences
- Roles: `base-tile`, `support-tile`
- Public API treatment: `GameboardBuilder.addElevationRamp`,
  `GameboardBuilder.addMountainStack`,
  `GameboardBuilder.setElevation`,
  `GameboardBuilder.setTileAsset`,
  `createGameboardPlanFromRecipe`,
  `createMedievalGameboardBlueprintRecipe`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-gameboard-recipe.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-blueprint-builder-showcase.png`
- Docs: `docs/pillars/01-tiles-connectivity.md`, `docs/pillars/05-koota-runtime-rules.md`

### Page 09 - World Design Example

- Scenario: `page-09-world-design-example`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-09.png`
- Asset coverage: 61 unique, 61 FREE, 0 EXTRA, 61 occurrences
- Roles: `base-tile`, `nature-decoration`, `neutral-structure`, `road-tile`
- Public API treatment: `GameboardBuilder.addBridge`,
  `GameboardBuilder.addForest`,
  `GameboardBuilder.addHill`,
  `GameboardBuilder.addMountainStack`,
  `GameboardBuilder.addNature`,
  `GameboardBuilder.addNeutralStructure`,
  `GameboardBuilder.addRoadPath`,
  `GameboardBuilder.scatterDecorations`,
  `GameboardBuilder.setTerrain`,
  `GameboardBuilder.setTileAsset`,
  `createGameboardBuilder`,
  `createGameboardLayoutFillRuleFromPiece`,
  `createGameboardPlanFromRecipe`,
  `createGameboardPlanFromTiles`,
  `createGameboardRuntimeFromScenario`,
  `createMedievalShowcaseBlueprintRecipe`,
  `createSeededGameboardPlan`,
  `listRoadGuidePermutations`,
  `selectRoadVariant`,
  `selectRoadVariantByLabel`,
  `selectSpawnCoordinates`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-gameboard-recipe.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-blueprint-builder-showcase.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-seeded-gameboard.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-fixed-completed.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-blueprint-biome-transition-showcase.png`
- Docs: `docs/guides/recipes-scenarios-and-simulation.md`, `docs/pillars/05-koota-runtime-rules.md`

### Page 10 - Floating Islands

- Scenario: `page-10-floating-islands`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-10.png`
- Asset coverage: 45 unique, 45 FREE, 0 EXTRA, 45 occurrences
- Roles: `base-tile`, `nature-decoration`, `support-tile`
- Public API treatment: `GameboardBuilder.addElevationRamp`,
  `GameboardBuilder.addForest`,
  `GameboardBuilder.addHill`,
  `GameboardBuilder.addMountainStack`,
  `GameboardBuilder.addNature`,
  `GameboardBuilder.scatterDecorations`,
  `GameboardBuilder.setElevation`,
  `GameboardBuilder.setTileAsset`,
  `createGameboardLayoutFillRuleFromPiece`,
  `createGameboardPlanFromRecipe`,
  `createHexagonGameboardGrid`,
  `createMedievalGameboardBlueprintPlan`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-seeded-hex-gameboard.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`, `docs/pillars/05-koota-runtime-rules.md`

### Page 11 - Biomes

- Scenario: `page-11-biomes`
- Edition: `extra`
- Source image: `docs/assets/kaykit-guide/pages/page-11.png`
- Asset coverage: 1 unique, 0 FREE, 1 EXTRA, 1 occurrence
- Roles: `transition-tile`
- Public API treatment: `GameboardBuilder.addTransition`,
  `createGameboardPlanFromRecipe`,
  `createMedievalGameboardBlueprintRecipe`,
  `inspectMedievalGameboardBlueprint`,
  `textureFileName`,
  `validateGameboardRecipe`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-seasonal-textures.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-blueprint-biome-transition-showcase.png`
- Docs: `docs/pillars/03-editions-and-ingest.md`,
  `docs/guides/rendering-assets-and-external-packs.md`

### Page 12 - Alternate Textures

- Scenario: `page-12-alternate-textures`
- Edition: `extra`
- Source image: `docs/assets/kaykit-guide/pages/page-12.png`
- Asset coverage: 1 unique, 0 FREE, 1 EXTRA, 1 occurrence
- Roles: `transition-tile`
- Public API treatment: `GameboardBuilder.addTransition`,
  `createGameboardPlanFromRecipe`,
  `createManifestBundle`,
  `medieval-hexagon-gameboard manifest`,
  `selectManifestAssets`,
  `textureFileName`,
  `validateGameboardRecipe`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-seasonal-textures.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png`
- Docs: `docs/pillars/03-editions-and-ingest.md`,
  `docs/guides/rendering-assets-and-external-packs.md`

### Page 13 - Transition Tiles

- Scenario: `page-13-transition-tiles`
- Edition: `extra`
- Source image: `docs/assets/kaykit-guide/pages/page-13.png`
- Asset coverage: 1 unique, 0 FREE, 1 EXTRA, 1 occurrence
- Roles: `transition-tile`
- Public API treatment: `GameboardBuilder.addTransition`,
  `analyzeHexTileRegistry`,
  `createGameboardPlanFromRecipe`,
  `createMedievalGameboardBlueprintRecipe`,
  `createMedievalShowcaseBlueprintRecipe`,
  `declareHexTile`,
  `validateGameboardRecipe`,
  `validateGameboardRecipeGeneration`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-seasonal-textures.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-blueprint-biome-transition-showcase.png`
- Docs: `docs/pillars/01-tiles-connectivity.md`, `docs/pillars/03-editions-and-ingest.md`

### Page 14 - Units

- Scenario: `page-14-units`
- Edition: `extra`
- Source image: `docs/assets/kaykit-guide/pages/page-14.png`
- Asset coverage: 137 unique, 0 FREE, 137 EXTRA, 137 occurrences
- Roles: `colored-unit-part`, `neutral-unit-part`
- Public API treatment: `GameboardBuilder.addUnit`,
  `GameboardBuilder.addUnitPreset`,
  `coloredUnitAssetId`,
  `neutralUnitAssetId`,
  `spawnGameboardActor`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-local-third-party-assets.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`, `docs/guides/runtime-integration.md`

### Page 15 - Shipyard, Harbors, And Ports

- Scenario: `page-15-shipyard-harbors`
- Edition: `mixed`
- Source image: `docs/assets/kaykit-guide/pages/page-15.png`
- Asset coverage: 25 unique, 14 FREE, 11 EXTRA, 25 occurrences
- Roles: `coast-tile`, `faction-building`, `prop`
- Public API treatment: `GameboardBuilder.addFactionBuilding`,
  `GameboardBuilder.addHarbor`,
  `GameboardBuilder.addProp`,
  `GameboardBuilder.addUnitPreset`,
  `GameboardBuilder.setCoastEdges`,
  `createGameboardLayoutFillRuleFromPiece`,
  `externalAssetSpawnOptions`,
  `factionBuildingAssetId`,
  `listCoastGuidePermutations`,
  `selectCoastVariant`,
  `selectCoastVariantByLabel`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-harbor-gameboard.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`, `docs/pillars/03-editions-and-ingest.md`

### Page 16 - Stables And Horses

- Scenario: `page-16-stables-and-horses`
- Edition: `extra`
- Source image: `docs/assets/kaykit-guide/pages/page-16.png`
- Asset coverage: 155 unique, 11 FREE, 144 EXTRA, 155 occurrences
- Roles: `colored-unit-part`, `faction-building`, `neutral-structure`, `neutral-unit-part`, `prop`
- Public API treatment: `GameboardBuilder.addFactionBuilding`,
  `GameboardBuilder.addNeutralStructure`,
  `GameboardBuilder.addProp`,
  `GameboardBuilder.addSettlement`,
  `GameboardBuilder.addUnit`,
  `GameboardBuilder.addUnitPreset`,
  `coloredUnitAssetId`,
  `createGameboardLayoutFillRuleFromPiece`,
  `createGameboardPlanFromRecipe`,
  `factionBuildingAssetId`,
  `neutralUnitAssetId`,
  `recommendExternalAssetFacing`,
  `spawnGameboardActor`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-decoration-nature-props.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`, `docs/guides/rendering-assets-and-external-packs.md`

### Page 17 - Workshop And Siege Units

- Scenario: `page-17-workshop-and-siege`
- Edition: `extra`
- Source image: `docs/assets/kaykit-guide/pages/page-17.png`
- Asset coverage: 159 unique, 11 FREE, 148 EXTRA, 159 occurrences
- Roles: `colored-unit-part`, `faction-building`, `neutral-structure`, `neutral-unit-part`, `prop`
- Public API treatment: `GameboardBuilder.addFactionBuilding`,
  `GameboardBuilder.addNeutralStructure`,
  `GameboardBuilder.addProp`,
  `GameboardBuilder.addSettlement`,
  `GameboardBuilder.addUnit`,
  `GameboardBuilder.addUnitPreset`,
  `coloredUnitAssetId`,
  `createGameboardLayoutFillRuleFromPiece`,
  `createGameboardPlanFromRecipe`,
  `executeGameboardInteractionCommand`,
  `factionBuildingAssetId`,
  `neutralUnitAssetId`,
  `planGameboardInteractionCommand`,
  `spawnGameboardActor`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`, `docs/guides/runtime-integration.md`

### Page 18 - Unit Combinations

- Scenario: `page-18-unit-combinations`
- Edition: `extra`
- Source image: `docs/assets/kaykit-guide/pages/page-18.png`
- Asset coverage: 137 unique, 0 FREE, 137 EXTRA, 137 occurrences
- Roles: `colored-unit-part`, `neutral-unit-part`
- Public API treatment: `GameboardBuilder.addUnit`,
  `GameboardBuilder.addUnitPreset`,
  `coloredUnitAssetId`,
  `createGameboardRuntimeFromScenario`,
  `neutralUnitAssetId`,
  `spawnGameboardActor`
- Visual artifacts: `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-seeded-completed.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`, `docs/guides/recipes-scenarios-and-simulation.md`

### Page 19 - Supporters And Attribution

- Scenario: `page-19-supporters-and-attribution`
- Edition: `reference`
- Source image: `docs/assets/kaykit-guide/pages/page-19.png`
- Asset coverage: 0 unique, 0 FREE, 0 EXTRA, 0 occurrences
- Roles: reference-only
- Public API treatment: `NOTICE.md`, `listKayKitGuideScenarios`, `package.json files`
- Visual artifacts: `docs/assets/kaykit-guide/pages/page-19.png`, `NOTICE.md`
- Docs: `NOTICE.md`, `docs/pillars/00-library-charter.md`, `README.md`

## Asset Coverage Query

The asset index starts from a manifest id and reports the exact role, public
API surface, source images, docs, and screenshots that keep that GLTF from
being a passive file reference:

```ts
import {
  describeKayKitGuideAssetCoverage,
  listKayKitGuideAssetCoverages,
} from '@jbcom/medieval-hexagon-gameboard/catalog';

const roadM = describeKayKitGuideAssetCoverage('hex_road_M');
const allAssetCoverage = listKayKitGuideAssetCoverages();
```

## Role Coverage Index

The role index starts from a gameplay use case and reports every guide page,
asset id, public API, doc, and screenshot that exercises that role:

```ts
import {
  describeKayKitGuideRoleCoverage,
  listKayKitGuideRoleCoverages,
} from '@jbcom/medieval-hexagon-gameboard/catalog';

const props = describeKayKitGuideRoleCoverage('prop');
const allRoleCoverage = listKayKitGuideRoleCoverages();
```

### Role - `base-tile`

- Pages: 07, 08, 09, 10
- Asset coverage: 4 unique, 4 FREE, 0 EXTRA, 8 occurrences
- Public API treatment: `GameboardBuilder.addElevationRamp`,
  `GameboardBuilder.addMountainStack`,
  `GameboardBuilder.setTerrain`,
  `GameboardBuilder.setTileAsset`,
  `createGameboardPlanFromRecipe`,
  `createGameboardPlanFromTiles`
- Scenarios: `page-07-water-usage`,
  `page-08-taller-hex-tiles`,
  `page-09-world-design-example`,
  `page-10-floating-islands`

### Role - `coast-tile`

- Pages: 07, 15
- Asset coverage: 10 unique, 10 FREE, 0 EXTRA, 20 occurrences
- Public API treatment: `GameboardBuilder.addHarbor`,
  `GameboardBuilder.setCoastEdges`,
  `listCoastGuidePermutations`,
  `selectCoastVariant`,
  `selectCoastVariantByLabel`
- Scenarios: `page-07-water-usage`, `page-15-shipyard-harbors`

### Role - `colored-unit-part`

- Pages: 14, 16, 17, 18
- Asset coverage: 112 unique, 0 FREE, 112 EXTRA, 448 occurrences
- Public API treatment: `GameboardBuilder.addUnit`,
  `GameboardBuilder.addUnitPreset`,
  `coloredUnitAssetId`,
  `spawnGameboardActor`
- Scenarios: `page-14-units`,
  `page-16-stables-and-horses`,
  `page-17-workshop-and-siege`,
  `page-18-unit-combinations`

### Role - `faction-building`

- Pages: 02, 15, 16, 17
- Asset coverage: 108 unique, 72 FREE, 36 EXTRA, 132 occurrences
- Public API treatment: `GameboardBuilder.addFactionBuilding`,
  `GameboardBuilder.addHarbor`,
  `GameboardBuilder.addSettlement`,
  `factionBuildingAssetId`
- Scenarios: `page-02-buildings-props-and-factions`,
  `page-15-shipyard-harbors`,
  `page-16-stables-and-horses`,
  `page-17-workshop-and-siege`

### Role - `nature-decoration`

- Pages: 05, 06, 09, 10
- Asset coverage: 42 unique, 42 FREE, 0 EXTRA, 168 occurrences
- Public API treatment: `GameboardBuilder.addForest`,
  `GameboardBuilder.addHill`,
  `GameboardBuilder.addMountainStack`,
  `GameboardBuilder.addNature`,
  `GameboardBuilder.scatterDecorations`,
  `createGameboardLayoutFillRuleFromPiece`
- Scenarios: `page-05-nature-contents`,
  `page-06-nature-usage`,
  `page-09-world-design-example`,
  `page-10-floating-islands`

### Role - `neutral-structure`

- Pages: 02, 07, 09, 16, 17
- Asset coverage: 21 unique, 21 FREE, 0 EXTRA, 47 occurrences
- Public API treatment: `GameboardBuilder.addBridge`,
  `GameboardBuilder.addNeutralStructure`,
  `createGameboardPlanFromRecipe`
- Scenarios: `page-02-buildings-props-and-factions`,
  `page-07-water-usage`,
  `page-09-world-design-example`,
  `page-16-stables-and-horses`,
  `page-17-workshop-and-siege`

### Role - `neutral-unit-part`

- Pages: 14, 16, 17, 18
- Asset coverage: 25 unique, 0 FREE, 25 EXTRA, 100 occurrences
- Public API treatment: `GameboardBuilder.addUnit`,
  `GameboardBuilder.addUnitPreset`,
  `neutralUnitAssetId`,
  `spawnGameboardActor`
- Scenarios: `page-14-units`,
  `page-16-stables-and-horses`,
  `page-17-workshop-and-siege`,
  `page-18-unit-combinations`

### Role - `prop`

- Pages: 02, 05, 15, 16, 17
- Asset coverage: 35 unique, 26 FREE, 9 EXTRA, 79 occurrences
- Public API treatment: `GameboardBuilder.addFlag`,
  `GameboardBuilder.addHarbor`,
  `GameboardBuilder.addProp`,
  `createGameboardLayoutFillRuleFromPiece`,
  `flagAssetId`
- Scenarios: `page-02-buildings-props-and-factions`,
  `page-05-nature-contents`,
  `page-15-shipyard-harbors`,
  `page-16-stables-and-horses`,
  `page-17-workshop-and-siege`

### Role - `river-tile`

- Pages: 04, 07
- Asset coverage: 30 unique, 30 FREE, 0 EXTRA, 60 occurrences
- Public API treatment: `GameboardBuilder.addRiverPath`,
  `listRiverCrossingGuidePermutations`,
  `listRiverCurvyGuidePermutations`,
  `listRiverGuidePermutations`,
  `selectRiverCrossingVariant`,
  `selectRiverVariant`,
  `selectRiverVariantByLabel`
- Scenarios: `page-04-river-variations`, `page-07-water-usage`

### Role - `road-tile`

- Pages: 03, 09
- Asset coverage: 15 unique, 15 FREE, 0 EXTRA, 30 occurrences
- Public API treatment: `GameboardBuilder.addRoadPath`,
  `listRoadGuidePermutations`,
  `selectRoadVariant`,
  `selectRoadVariantByLabel`
- Scenarios: `page-03-road-variations`, `page-09-world-design-example`

### Role - `support-tile`

- Pages: 08, 10
- Asset coverage: 1 unique, 1 FREE, 0 EXTRA, 2 occurrences
- Public API treatment: `GameboardBuilder.addMountainStack`,
  `GameboardBuilder.setTileAsset`,
  `createGameboardPlanFromRecipe`
- Scenarios: `page-08-taller-hex-tiles`, `page-10-floating-islands`

### Role - `transition-tile`

- Pages: 11, 12, 13
- Asset coverage: 1 unique, 0 FREE, 1 EXTRA, 3 occurrences
- Public API treatment: `GameboardBuilder.addTransition`,
  `createGameboardPlanFromRecipe`,
  `validateGameboardRecipe`
- Scenarios: `page-11-biomes`, `page-12-alternate-textures`, `page-13-transition-tiles`

## Public API Inversion

The page matrix flows from guide page to public API. The inverse query starts
from an API surface and reports every guide page, asset id, role, doc, and
screenshot that exercises it:

```ts
import {
  describeKayKitGuidePublicApiCoverage,
  listKayKitGuidePublicApiCoverages,
} from '@jbcom/medieval-hexagon-gameboard/catalog';

const harbor = describeKayKitGuidePublicApiCoverage('GameboardBuilder.addHarbor');
const allApiCoverage = listKayKitGuidePublicApiCoverages();
```

For example, `GameboardBuilder.addHarbor` maps to pages 02, 05, 07, and 15,
covering coast tiles, faction buildings, and props across FREE and EXTRA source
material. `GameboardBuilder.addBridge` maps to pages 02, 07, and 09,
covering the FREE bridge structures used by road and water crossings.
`GameboardBuilder.addElevationRamp` maps to pages 08 and 10, covering
the FREE sloped grass tiles used by vertical terrain transitions.
`GameboardBuilder.addUnitPreset` maps to pages 14 through 18 and is
EXTRA-only because the unit assembly pieces are local-ingest assets.
