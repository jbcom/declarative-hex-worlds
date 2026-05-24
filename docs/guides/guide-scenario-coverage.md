# Guide Scenario Coverage

The KayKit user guide is decomposed into 19 source-page scenarios. This page is
the human-facing map for those scenarios; the machine-readable source remains
`listKayKitGuideScenarios()`, `describeKayKitGuideScenarioCoverage()`,
`listKayKitGuidePublicApiCoverages()`, and the `guide-scenarios` / `guide-apis`
CLI commands.

Use this page when deciding whether a guide image has public API treatment, docs,
and visual review coverage. Use the catalog API or CLI when a tool needs exact
asset ids or public treatment records.

```sh
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-scenarios --page 15 --includeTreatments --json
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
- Every public API string in a scenario can be inverted back to pages/assets with
  `listKayKitGuidePublicApiCoverages()`.

## Page Matrix

### Page 01 - Overview And License Contract

- Scenario: `page-01-overview-and-license`
- Edition: `reference`
- Source image: `docs/assets/kaykit-guide/pages/page-01.png`
- Roles: reference-only
- Asset coverage: 0 unique, 0 FREE, 0 EXTRA, 0 occurrences
- Public API treatment: `freeManifest`, `listKayKitAssetPublicTreatments`,
  `listKayKitGuideScenarios`
- Visual artifacts: `docs/assets/kaykit-guide/montage.png`,
  `docs/assets/kaykit-guide/pages/page-01.png`
- Docs: `README.md`, `NOTICE.md`, `docs/pillars/00-library-charter.md`

### Page 02 - Buildings, Props, And Factions

- Scenario: `page-02-buildings-props-and-factions`
- Edition: `mixed`
- Source image: `docs/assets/kaykit-guide/pages/page-02.png`
- Roles: `faction-building`, `neutral-structure`, `prop`
- Asset coverage: 164 unique, 119 FREE, 45 EXTRA, 164 occurrences
- Public API treatment: `GameboardBuilder.addFactionBuilding`,
  `GameboardBuilder.addFlag`, `GameboardBuilder.addHarbor`,
  `GameboardBuilder.addNeutralStructure`, `GameboardBuilder.addProp`,
  `GameboardBuilder.addSettlement`, `createGameboardLayoutFillRuleFromPiece`,
  `createGameboardPlanFromRecipe`, `factionBuildingAssetId`, `flagAssetId`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`, `docs/guides/public-api.md`

### Page 03 - Road Variations

- Scenario: `page-03-road-variations`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-03.png`
- Roles: `road-tile`
- Asset coverage: 15 unique, 15 FREE, 0 EXTRA, 15 occurrences
- Public API treatment: `GameboardBuilder.addRoadPath`,
  `listRoadGuidePermutations`, `selectRoadVariant`,
  `selectRoadVariantByLabel`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-roads-all-labels-rotations.png`
- Docs: `docs/pillars/01-tiles-connectivity.md`,
  `docs/pillars/04-visual-verification.md`

### Page 04 - River Variations

- Scenario: `page-04-river-variations`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-04.png`
- Roles: `river-tile`
- Asset coverage: 30 unique, 30 FREE, 0 EXTRA, 30 occurrences
- Public API treatment: `GameboardBuilder.addRiverPath`,
  `listRiverCrossingGuidePermutations`, `listRiverCurvyGuidePermutations`,
  `listRiverGuidePermutations`, `selectRiverCrossingVariant`,
  `selectRiverVariant`, `selectRiverVariantByLabel`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-rivers-all-labels-rotations-water-waterless.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-river-curvy-crossings-all-modes.png`
- Docs: `docs/pillars/01-tiles-connectivity.md`,
  `docs/pillars/04-visual-verification.md`

### Page 05 - Nature And Decoration Contents

- Scenario: `page-05-nature-contents`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-05.png`
- Roles: `nature-decoration`, `prop`
- Asset coverage: 77 unique, 68 FREE, 9 EXTRA, 77 occurrences
- Public API treatment: `GameboardBuilder.addFlag`,
  `GameboardBuilder.addForest`, `GameboardBuilder.addHarbor`,
  `GameboardBuilder.addHill`, `GameboardBuilder.addMountainStack`,
  `GameboardBuilder.addNature`, `GameboardBuilder.addProp`,
  `GameboardBuilder.scatterDecorations`,
  `createGameboardLayoutFillRuleFromPiece`, `flagAssetId`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-decoration-nature-props.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`,
  `docs/pillars/05-koota-runtime-rules.md`

### Page 06 - Nature Usage Guide

- Scenario: `page-06-nature-usage`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-06.png`
- Roles: `nature-decoration`
- Asset coverage: 42 unique, 42 FREE, 0 EXTRA, 42 occurrences
- Public API treatment: `GameboardBuilder.addForest`,
  `GameboardBuilder.addHill`, `GameboardBuilder.addMountainStack`,
  `GameboardBuilder.addNature`, `GameboardBuilder.scatterDecorations`,
  `createGameboardLayoutArchetypeRegistry`,
  `createGameboardLayoutFillRuleFromPiece`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-generated-piece-recipe.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`,
  `docs/pillars/05-koota-runtime-rules.md`

### Page 07 - Water Usage Guide

- Scenario: `page-07-water-usage`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-07.png`
- Roles: `base-tile`, `coast-tile`, `river-tile`
- Asset coverage: 42 unique, 42 FREE, 0 EXTRA, 42 occurrences
- Public API treatment: `GameboardBuilder.addHarbor`,
  `GameboardBuilder.addRiverPath`, `GameboardBuilder.setCoastEdges`,
  `GameboardBuilder.setTerrain`, `GameboardBuilder.setTileAsset`,
  `createGameboardPlanFromTiles`, `listCoastGuidePermutations`,
  `listRiverCrossingGuidePermutations`, `listRiverCurvyGuidePermutations`,
  `listRiverGuidePermutations`, `selectCoastVariant`,
  `selectCoastVariantByLabel`, `selectRiverCrossingVariant`,
  `selectRiverVariant`, `selectRiverVariantByLabel`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-coasts-all-labels-rotations-water-waterless.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-rivers-all-labels-rotations-water-waterless.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-harbor-gameboard.png`
- Docs: `docs/pillars/01-tiles-connectivity.md`,
  `docs/pillars/04-visual-verification.md`

### Page 08 - Taller Hex Tiles

- Scenario: `page-08-taller-hex-tiles`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-08.png`
- Roles: `base-tile`, `support-tile`
- Asset coverage: 3 unique, 3 FREE, 0 EXTRA, 3 occurrences
- Public API treatment: `GameboardBuilder.addMountainStack`,
  `GameboardBuilder.setElevation`, `GameboardBuilder.setTileAsset`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-gameboard-recipe.png`
- Docs: `docs/pillars/01-tiles-connectivity.md`,
  `docs/pillars/05-koota-runtime-rules.md`

### Page 09 - World Design Example

- Scenario: `page-09-world-design-example`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-09.png`
- Roles: `base-tile`, `nature-decoration`, `road-tile`
- Asset coverage: 59 unique, 59 FREE, 0 EXTRA, 59 occurrences
- Public API treatment: `GameboardBuilder.addForest`,
  `GameboardBuilder.addHill`, `GameboardBuilder.addMountainStack`,
  `GameboardBuilder.addNature`, `GameboardBuilder.addRoadPath`,
  `GameboardBuilder.scatterDecorations`, `GameboardBuilder.setTerrain`,
  `GameboardBuilder.setTileAsset`, `createGameboardBuilder`,
  `createGameboardLayoutFillRuleFromPiece`, `createGameboardPlanFromRecipe`,
  `createGameboardPlanFromTiles`, `createGameboardRuntimeFromScenario`,
  `createSeededGameboardPlan`, `listRoadGuidePermutations`,
  `selectRoadVariant`, `selectRoadVariantByLabel`, `selectSpawnCoordinates`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-gameboard-recipe.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-seeded-gameboard.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-fixed-completed.png`
- Docs: `docs/guides/recipes-scenarios-and-simulation.md`,
  `docs/pillars/05-koota-runtime-rules.md`

### Page 10 - Floating Islands

- Scenario: `page-10-floating-islands`
- Edition: `free`
- Source image: `docs/assets/kaykit-guide/pages/page-10.png`
- Roles: `base-tile`, `nature-decoration`, `support-tile`
- Asset coverage: 45 unique, 45 FREE, 0 EXTRA, 45 occurrences
- Public API treatment: `GameboardBuilder.addForest`,
  `GameboardBuilder.addHill`, `GameboardBuilder.addMountainStack`,
  `GameboardBuilder.addNature`, `GameboardBuilder.scatterDecorations`,
  `GameboardBuilder.setElevation`, `GameboardBuilder.setTileAsset`,
  `createGameboardLayoutFillRuleFromPiece`, `createHexagonGameboardGrid`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-seeded-hex-gameboard.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`,
  `docs/pillars/05-koota-runtime-rules.md`

### Page 11 - Biomes

- Scenario: `page-11-biomes`
- Edition: `extra`
- Source image: `docs/assets/kaykit-guide/pages/page-11.png`
- Roles: `transition-tile`
- Asset coverage: 1 unique, 0 FREE, 1 EXTRA, 1 occurrence
- Public API treatment: `GameboardBuilder.addTransition`,
  `createGameboardPlanFromRecipe`, `textureFileName`, `validateGameboardRecipe`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-seasonal-textures.png`
- Docs: `docs/pillars/03-editions-and-ingest.md`,
  `docs/guides/rendering-assets-and-external-packs.md`

### Page 12 - Alternate Textures

- Scenario: `page-12-alternate-textures`
- Edition: `extra`
- Source image: `docs/assets/kaykit-guide/pages/page-12.png`
- Roles: `transition-tile`
- Asset coverage: 1 unique, 0 FREE, 1 EXTRA, 1 occurrence
- Public API treatment: `GameboardBuilder.addTransition`,
  `createGameboardPlanFromRecipe`, `createManifestBundle`,
  `medieval-hexagon-gameboard manifest`, `selectManifestAssets`,
  `textureFileName`, `validateGameboardRecipe`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-seasonal-textures.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png`
- Docs: `docs/pillars/03-editions-and-ingest.md`,
  `docs/guides/rendering-assets-and-external-packs.md`

### Page 13 - Transition Tiles

- Scenario: `page-13-transition-tiles`
- Edition: `extra`
- Source image: `docs/assets/kaykit-guide/pages/page-13.png`
- Roles: `transition-tile`
- Asset coverage: 1 unique, 0 FREE, 1 EXTRA, 1 occurrence
- Public API treatment: `GameboardBuilder.addTransition`,
  `analyzeHexTileRegistry`, `createGameboardPlanFromRecipe`, `declareHexTile`,
  `validateGameboardRecipe`, `validateGameboardRecipeGeneration`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-seasonal-textures.png`
- Docs: `docs/pillars/01-tiles-connectivity.md`,
  `docs/pillars/03-editions-and-ingest.md`

### Page 14 - Units

- Scenario: `page-14-units`
- Edition: `extra`
- Source image: `docs/assets/kaykit-guide/pages/page-14.png`
- Roles: `colored-unit-part`, `neutral-unit-part`
- Asset coverage: 137 unique, 0 FREE, 137 EXTRA, 137 occurrences
- Public API treatment: `GameboardBuilder.addUnit`,
  `GameboardBuilder.addUnitPreset`, `coloredUnitAssetId`, `neutralUnitAssetId`,
  `spawnGameboardActor`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-local-third-party-assets.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`,
  `docs/guides/runtime-integration.md`

### Page 15 - Shipyard, Harbors, And Ports

- Scenario: `page-15-shipyard-harbors`
- Edition: `mixed`
- Source image: `docs/assets/kaykit-guide/pages/page-15.png`
- Roles: `coast-tile`, `faction-building`, `prop`
- Asset coverage: 25 unique, 14 FREE, 11 EXTRA, 25 occurrences
- Public API treatment: `GameboardBuilder.addFactionBuilding`,
  `GameboardBuilder.addHarbor`, `GameboardBuilder.addProp`,
  `GameboardBuilder.addUnitPreset`, `GameboardBuilder.setCoastEdges`,
  `createGameboardLayoutFillRuleFromPiece`, `externalAssetSpawnOptions`,
  `factionBuildingAssetId`, `listCoastGuidePermutations`, `selectCoastVariant`,
  `selectCoastVariantByLabel`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-harbor-gameboard.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`,
  `docs/pillars/03-editions-and-ingest.md`

### Page 16 - Stables And Horses

- Scenario: `page-16-stables-and-horses`
- Edition: `extra`
- Source image: `docs/assets/kaykit-guide/pages/page-16.png`
- Roles: `colored-unit-part`, `faction-building`, `neutral-structure`,
  `neutral-unit-part`, `prop`
- Asset coverage: 155 unique, 11 FREE, 144 EXTRA, 155 occurrences
- Public API treatment: `GameboardBuilder.addFactionBuilding`,
  `GameboardBuilder.addNeutralStructure`, `GameboardBuilder.addProp`,
  `GameboardBuilder.addSettlement`, `GameboardBuilder.addUnit`,
  `GameboardBuilder.addUnitPreset`, `coloredUnitAssetId`,
  `createGameboardLayoutFillRuleFromPiece`, `createGameboardPlanFromRecipe`,
  `factionBuildingAssetId`, `neutralUnitAssetId`,
  `recommendExternalAssetFacing`, `spawnGameboardActor`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-decoration-nature-props.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`,
  `docs/guides/rendering-assets-and-external-packs.md`

### Page 17 - Workshop And Siege Units

- Scenario: `page-17-workshop-and-siege`
- Edition: `extra`
- Source image: `docs/assets/kaykit-guide/pages/page-17.png`
- Roles: `colored-unit-part`, `faction-building`, `neutral-structure`,
  `neutral-unit-part`, `prop`
- Asset coverage: 159 unique, 11 FREE, 148 EXTRA, 159 occurrences
- Public API treatment: `GameboardBuilder.addFactionBuilding`,
  `GameboardBuilder.addNeutralStructure`, `GameboardBuilder.addProp`,
  `GameboardBuilder.addSettlement`, `GameboardBuilder.addUnit`,
  `GameboardBuilder.addUnitPreset`, `coloredUnitAssetId`,
  `createGameboardLayoutFillRuleFromPiece`, `createGameboardPlanFromRecipe`,
  `executeGameboardInteractionCommand`, `factionBuildingAssetId`,
  `neutralUnitAssetId`, `planGameboardInteractionCommand`,
  `spawnGameboardActor`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`,
  `docs/guides/runtime-integration.md`

### Page 18 - Unit Combinations

- Scenario: `page-18-unit-combinations`
- Edition: `extra`
- Source image: `docs/assets/kaykit-guide/pages/page-18.png`
- Roles: `colored-unit-part`, `neutral-unit-part`
- Asset coverage: 137 unique, 0 FREE, 137 EXTRA, 137 occurrences
- Public API treatment: `GameboardBuilder.addUnit`,
  `GameboardBuilder.addUnitPreset`, `coloredUnitAssetId`,
  `createGameboardRuntimeFromScenario`, `neutralUnitAssetId`,
  `spawnGameboardActor`
- Visual artifacts:
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png`,
  `packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-seeded-completed.png`
- Docs: `docs/pillars/02-asset-taxonomy.md`,
  `docs/guides/recipes-scenarios-and-simulation.md`

### Page 19 - Supporters And Attribution

- Scenario: `page-19-supporters-and-attribution`
- Edition: `reference`
- Source image: `docs/assets/kaykit-guide/pages/page-19.png`
- Roles: reference-only
- Asset coverage: 0 unique, 0 FREE, 0 EXTRA, 0 occurrences
- Public API treatment: `NOTICE.md`, `listKayKitGuideScenarios`,
  `package.json files`
- Visual artifacts: `docs/assets/kaykit-guide/pages/page-19.png`,
  `NOTICE.md`
- Docs: `NOTICE.md`, `docs/pillars/00-library-charter.md`, `README.md`

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
material. `GameboardBuilder.addUnitPreset` maps to pages 14 through 18 and is
EXTRA-only because the unit assembly pieces are local-ingest assets.
