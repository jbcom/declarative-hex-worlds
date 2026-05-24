import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  describeKayKitGuideAssetCoverage as describeKayKitGuideAssetCoverageFromRoot,
  describeKayKitGuidePublicApiCoverage as describeKayKitGuidePublicApiCoverageFromRoot,
  describeKayKitGuideRoleCoverage as describeKayKitGuideRoleCoverageFromRoot,
  describeKayKitGuideScenarioCoverage as describeKayKitGuideScenarioCoverageFromRoot,
  listKayKitGuideAssetCoverages as listKayKitGuideAssetCoveragesFromRoot,
  listKayKitGuidePublicApiCoverages as listKayKitGuidePublicApiCoveragesFromRoot,
  listKayKitGuideRoleCoverages as listKayKitGuideRoleCoveragesFromRoot,
  listKayKitGuideScenarioAssetUsages as listKayKitGuideScenarioAssetUsagesFromRoot,
  listKayKitGuideScenarioAssetUsagesForScenario as listKayKitGuideScenarioAssetUsagesForScenarioFromRoot,
  listKayKitGuideScenarioTreatments as listKayKitGuideScenarioTreatmentsFromRoot,
  listKayKitGuideScenarios as listKayKitGuideScenariosFromRoot,
  renderKayKitGuideScenarioCoverageMarkdown as renderKayKitGuideScenarioCoverageMarkdownFromRoot,
  summarizeKayKitGuideCoverage as summarizeKayKitGuideCoverageFromRoot,
} from '../../src';
import {
  BASE_TILE_ASSET_IDS,
  COAST_TILE_ASSET_IDS,
  EXTRA_TRANSITION_TILE_ASSET_IDS,
  RIVER_TILE_ASSET_IDS,
  ROAD_TILE_ASSET_IDS,
  describeKayKitAssetTreatment,
  describeKayKitGuideAssetCoverage,
  describeKayKitGuidePublicApiCoverage,
  describeKayKitGuideRoleCoverage,
  describeKayKitGuideScenario,
  describeKayKitGuideScenarioCoverage,
  hasKayKitAssetTreatment,
  isKnownExtraAssetId,
  listKayKitAssetPublicTreatments,
  listKayKitGuideAssetCoverages,
  listKayKitGuidePublicApiCoverages,
  listKayKitGuideRoleCoverages,
  listKayKitGuideScenarioAssetUsages,
  listKayKitGuideScenarioAssetUsagesForScenario,
  listKayKitGuideScenarioTreatments,
  listKayKitGuideScenarios,
  neutralUnitAssetId,
  renderKayKitGuideScenarioCoverageMarkdown,
  summarizeKayKitGuideCoverage,
} from '../../src/catalog';
import { generateManifestFromSource } from '../../src/ingest';
import { freeManifest } from '../../src/manifest/free';

const extraSourceRoot = resolve('../../references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA');

describe('asset catalog public treatments', () => {
  it('exposes explicit public treatment for every packaged FREE asset', () => {
    const treatments = listKayKitAssetPublicTreatments();
    const ids = new Set(treatments.map((treatment) => treatment.assetId));

    expect(treatments).toHaveLength(404);
    expect(ids.size).toBe(treatments.length);
    expect(BASE_TILE_ASSET_IDS).toHaveLength(5);
    expect(EXTRA_TRANSITION_TILE_ASSET_IDS).toEqual(['hex_transition']);
    expect(ROAD_TILE_ASSET_IDS).toHaveLength(15);
    expect(RIVER_TILE_ASSET_IDS).toHaveLength(30);
    expect(COAST_TILE_ASSET_IDS).toHaveLength(10);

    for (const asset of freeManifest.assets) {
      expect(ids.has(asset.id), asset.id).toBe(true);
      expect(describeKayKitAssetTreatment(asset.id)?.minimumEdition).toBe('free');
      expect(describeKayKitAssetTreatment(asset.id)?.publicApi.length).toBeGreaterThan(0);
    }
  });

  it('exposes explicit public treatment for every local EXTRA asset when references are present', () => {
    if (!existsSync(resolve(extraSourceRoot, 'Assets/gltf'))) {
      return;
    }

    const manifest = generateManifestFromSource({
      sourceRoot: extraSourceRoot,
      edition: 'extra',
      assetBasePath: 'assets/extra',
    });

    for (const asset of manifest.assets) {
      const treatment = describeKayKitAssetTreatment(asset.id);
      expect(treatment, asset.id).toBeTruthy();
      expect(treatment?.sourcePath).toBe(asset.sourcePath);
      expect(treatment?.publicApi.length).toBeGreaterThan(0);
      expect(treatment?.sourceImages.length).toBeGreaterThan(0);
    }
  });

  it('disambiguates neutral unit catapult from the FREE-compatible neutral building projectile', () => {
    expect(neutralUnitAssetId('projectile_catapult')).toBe('units_neutral_projectile_catapult');
    expect(describeKayKitAssetTreatment('projectile_catapult')).toMatchObject({
      category: 'buildings',
      role: 'neutral-structure',
      sourcePath: 'buildings/neutral/projectile_catapult.gltf',
      requiresExtra: false,
    });
    expect(describeKayKitAssetTreatment('units_neutral_projectile_catapult')).toMatchObject({
      category: 'units',
      role: 'neutral-unit-part',
      sourcePath: 'units/neutral/projectile_catapult.gltf',
      requiresExtra: true,
    });
    expect(isKnownExtraAssetId('projectile_catapult')).toBe(false);
    expect(isKnownExtraAssetId('units_neutral_projectile_catapult')).toBe(true);
  });

  it('classifies guide-derived tile roles by public selector or builder path', () => {
    expect(describeKayKitAssetTreatment('hex_road_M')).toMatchObject({
      role: 'road-tile',
      publicApi: expect.arrayContaining(['selectRoadVariant', 'GameboardBuilder.addRoadPath']),
    });
    expect(describeKayKitAssetTreatment('hex_river_crossing_B_waterless')).toMatchObject({
      role: 'river-tile',
      publicApi: expect.arrayContaining(['selectRiverCrossingVariant']),
    });
    expect(describeKayKitAssetTreatment('hex_coast_E_waterless')).toMatchObject({
      role: 'coast-tile',
      publicApi: expect.arrayContaining(['selectCoastVariant', 'GameboardBuilder.setCoastEdges']),
    });
    expect(hasKayKitAssetTreatment('hex_transition')).toBe(true);
  });

  it('exposes a decomposed guide scenario for every extracted README page', () => {
    const scenarios = listKayKitGuideScenarios();
    const pages = scenarios.map((scenario) => scenario.page);
    const sourceImages = scenarios.map((scenario) => scenario.sourceImage);
    const scenarioAssetIds = new Set(scenarios.flatMap((scenario) => scenario.assetIds));
    const treatmentIds = listKayKitAssetPublicTreatments().map((treatment) => treatment.assetId);

    expect(scenarios).toHaveLength(19);
    expect(listKayKitGuideScenariosFromRoot()).toHaveLength(19);
    expect(pages).toEqual(Array.from({ length: 19 }, (_, index) => index + 1));
    expect(sourceImages).toEqual(
      Array.from(
        { length: 19 },
        (_, index) => `docs/assets/kaykit-guide/pages/page-${String(index + 1).padStart(2, '0')}.png`
      )
    );

    for (const scenario of scenarios) {
      expect(scenario.id).toMatch(/^page-\d{2}-/);
      expect(scenario.summary.length).toBeGreaterThan(20);
      expect(scenario.publicApi.length, scenario.id).toBeGreaterThan(0);
      expect(scenario.visualArtifacts.length, scenario.id).toBeGreaterThan(0);
      expect(scenario.docs.length, scenario.id).toBeGreaterThan(0);
      for (const assetId of scenario.assetIds) {
        expect(describeKayKitAssetTreatment(assetId), `${scenario.id} references ${assetId}`).toBeTruthy();
      }
    }

    for (const assetId of treatmentIds) {
      expect(scenarioAssetIds.has(assetId), assetId).toBe(true);
    }

    expect(describeKayKitGuideScenario('page-03-road-variations')).toMatchObject({
      page: 3,
      sourceImage: 'docs/assets/kaykit-guide/pages/page-03.png',
      assetIds: expect.arrayContaining(['hex_road_A', 'hex_road_M']),
      publicApi: expect.arrayContaining(['selectRoadVariant', 'GameboardBuilder.addRoadPath']),
      treatmentRoles: ['road-tile'],
    });
  });

  it('exposes guide scenario treatment joins and coverage summaries for tools', () => {
    const roadTreatments = listKayKitGuideScenarioTreatments('page-03-road-variations');
    expect(roadTreatments).toHaveLength(15);
    expect(listKayKitGuideScenarioTreatmentsFromRoot('page-03-road-variations')).toHaveLength(15);
    expect(roadTreatments.map((treatment) => treatment.assetId)).toContain('hex_road_M');
    expect(listKayKitGuideScenarioTreatments('missing-scenario')).toEqual([]);

    const coverage = summarizeKayKitGuideCoverage();
    expect(summarizeKayKitGuideCoverageFromRoot().assetCounts).toEqual(coverage.assetCounts);
    expect(coverage).toMatchObject({
      scenarioCount: 19,
      pageCount: 19,
      sourceImageCount: 19,
      assetCounts: {
        unique: 404,
        free: 221,
        extra: 183,
        occurrences: 1108,
        freeOccurrences: 474,
        extraOccurrences: 634,
      },
      scenariosByEdition: {
        free: 8,
        extra: 7,
        mixed: 2,
        reference: 2,
      },
    });
    expect(coverage.uniqueAssetsByRole['road-tile']).toBe(15);
    expect(coverage.uniqueAssetsByRole['colored-unit-part']).toBe(112);
    expect(coverage.pages).toHaveLength(19);
    expect(coverage.pages.find((page) => page.page === 14)).toMatchObject({
      scenarioId: 'page-14-units',
      assetOccurrences: 137,
      uniqueAssets: 137,
      freeAssets: 0,
      extraAssets: 137,
    });

    const unitScenario = describeKayKitGuideScenarioCoverage('page-14-units');
    expect(describeKayKitGuideScenarioCoverageFromRoot('page-14-units')?.assetCounts).toEqual(
      unitScenario?.assetCounts
    );
    expect(unitScenario).toMatchObject({
      scenario: { page: 14, title: 'Units' },
      page: { scenarioId: 'page-14-units', extraAssets: 137 },
      assetCounts: { unique: 137, free: 0, extra: 137, occurrences: 137 },
      missingTreatmentAssetIds: [],
    });
    expect(unitScenario?.treatments.map((treatment) => treatment.assetId)).toContain('unit_blue_full');
    expect(describeKayKitGuideScenarioCoverage('missing-scenario')).toBeUndefined();
  });

  it('exposes renderer-ready page-level guide asset usages', () => {
    const usages = listKayKitGuideScenarioAssetUsages();

    expect(usages).toHaveLength(1108);
    expect(listKayKitGuideScenarioAssetUsagesFromRoot()).toHaveLength(usages.length);
    expect(listKayKitGuideScenarioAssetUsages({ minimumEdition: 'free' })).toHaveLength(474);
    expect(listKayKitGuideScenarioAssetUsages({ minimumEdition: 'extra' })).toHaveLength(634);
    expect(listKayKitGuideScenarioAssetUsages({ pages: [16, 17, 18] })).toHaveLength(462);
    expect(listKayKitGuideScenarioAssetUsages({ pages: [2, 11, 12, 13, 14, 15] })).toHaveLength(329);
    expect(listKayKitGuideScenarioAssetUsages({ editionScope: 'reference' })).toEqual([]);
    expect(listKayKitGuideScenarioAssetUsages({ editionScope: ['mixed', 'extra'] })).toHaveLength(791);
    expect(listKayKitGuideScenarioAssetUsages({ categories: ['units'] })).toHaveLength(548);
    expect(listKayKitGuideScenarioAssetUsages({ roles: ['prop'] })).toHaveLength(82);

    const pageThree = listKayKitGuideScenarioAssetUsages({ pages: [3] });
    expect(pageThree).toHaveLength(15);
    expect(pageThree.every((usage) => usage.role === 'road-tile')).toBe(true);
    expect(pageThree[0]).toMatchObject({
      scenarioId: 'page-03-road-variations',
      page: 3,
      title: 'Road variations',
      sourceImage: 'docs/assets/kaykit-guide/pages/page-03.png',
      scenarioEdition: 'free',
      minimumEdition: 'free',
      category: 'tiles',
      subcategory: 'roads',
      placementKind: 'road',
      placementLayer: 'surface',
      requiresExtra: false,
      label: expect.stringMatching(/^p03:hex_road_/),
      caption: 'page-03-road-variations free',
    });

    const roadM = listKayKitGuideScenarioAssetUsages({ assetIds: ['hex_road_M'] });
    expect(roadM.map((usage) => usage.scenarioId)).toEqual([
      'page-03-road-variations',
      'page-09-world-design-example',
    ]);

    const page14Units = listKayKitGuideScenarioAssetUsagesForScenario('page-14-units');
    expect(listKayKitGuideScenarioAssetUsagesForScenarioFromRoot('page-14-units')).toHaveLength(
      page14Units.length
    );
    expect(page14Units).toHaveLength(137);
    expect(page14Units.every((usage) => usage.minimumEdition === 'extra')).toBe(true);
    expect(page14Units.find((usage) => usage.assetId === 'unit_blue_full')).toMatchObject({
      role: 'colored-unit-part',
      sourcePath: 'units/blue/unit_blue_full.gltf',
      label: 'p14:unit_blue_full',
      caption: 'page-14-units extra',
    });

    expect(listKayKitGuideScenarioAssetUsagesForScenario('missing-scenario')).toEqual([]);
  });

  it('exposes public API coverage back to guide pages and treated assets', () => {
    const apiCoverages = listKayKitGuidePublicApiCoverages();
    const apiNames = apiCoverages.map((coverage) => coverage.publicApi);

    expect(apiCoverages.length).toBeGreaterThan(40);
    expect(listKayKitGuidePublicApiCoveragesFromRoot().map((coverage) => coverage.publicApi)).toEqual(apiNames);
    expect(apiNames).toEqual([...apiNames].sort());

    const roadApi = describeKayKitGuidePublicApiCoverage('selectRoadVariant');
    expect(describeKayKitGuidePublicApiCoverageFromRoot('selectRoadVariant')?.assetCounts).toEqual(
      roadApi?.assetCounts
    );
    expect(roadApi).toMatchObject({
      pages: [3, 9],
      scenarioIds: ['page-03-road-variations', 'page-09-world-design-example'],
      treatmentRoles: ['road-tile'],
      assetCounts: { unique: 15, free: 15, extra: 0, occurrences: 30 },
    });
    expect(roadApi?.assetIds).toEqual(expect.arrayContaining(['hex_road_A', 'hex_road_M']));

    const harborApi = describeKayKitGuidePublicApiCoverage('GameboardBuilder.addHarbor');
    expect(harborApi).toMatchObject({
      pages: [2, 5, 7, 15],
      scenarioIds: [
        'page-02-buildings-props-and-factions',
        'page-05-nature-contents',
        'page-07-water-usage',
        'page-15-shipyard-harbors',
      ],
      treatmentRoles: expect.arrayContaining(['coast-tile', 'faction-building', 'prop']),
    });
    expect(harborApi?.assetCounts.unique).toBeGreaterThan(20);
    expect(harborApi?.assetCounts.free).toBeGreaterThan(0);
    expect(harborApi?.assetCounts.extra).toBeGreaterThan(0);

    const bridgeApi = describeKayKitGuidePublicApiCoverage('GameboardBuilder.addBridge');
    expect(bridgeApi).toMatchObject({
      pages: [2, 7, 9],
      scenarioIds: [
        'page-02-buildings-props-and-factions',
        'page-07-water-usage',
        'page-09-world-design-example',
      ],
      treatmentRoles: ['neutral-structure'],
      assetIds: ['building_bridge_A', 'building_bridge_B'],
      assetCounts: { unique: 2, free: 2, extra: 0, occurrences: 6 },
    });

    const rampApi = describeKayKitGuidePublicApiCoverage('GameboardBuilder.addElevationRamp');
    expect(rampApi).toMatchObject({
      pages: [8, 10],
      scenarioIds: ['page-08-taller-hex-tiles', 'page-10-floating-islands'],
      treatmentRoles: ['base-tile'],
      assetIds: ['hex_grass_sloped_high', 'hex_grass_sloped_low'],
      assetCounts: { unique: 2, free: 2, extra: 0, occurrences: 4 },
    });

    const fortificationApi = describeKayKitGuidePublicApiCoverage('GameboardBuilder.addFortification');
    expect(fortificationApi).toMatchObject({
      pages: [2, 16, 17],
      scenarioIds: [
        'page-02-buildings-props-and-factions',
        'page-16-stables-and-horses',
        'page-17-workshop-and-siege',
      ],
      treatmentRoles: ['neutral-structure'],
      assetCounts: { unique: 11, free: 11, extra: 0, occurrences: 33 },
    });
    expect(fortificationApi?.assetIds).toEqual(
      expect.arrayContaining(['fence_wood_straight_gate', 'wall_corner_A_gate', 'wall_straight'])
    );

    const constructionApi = describeKayKitGuidePublicApiCoverage('GameboardBuilder.addConstructionSite');
    expect(constructionApi).toMatchObject({
      pages: [2, 17],
      scenarioIds: ['page-02-buildings-props-and-factions', 'page-17-workshop-and-siege'],
      treatmentRoles: ['neutral-structure'],
      assetCounts: { unique: 7, free: 7, extra: 0, occurrences: 14 },
    });

    const siegeProjectileApi = describeKayKitGuidePublicApiCoverage('GameboardBuilder.addSiegeProjectile');
    expect(siegeProjectileApi).toMatchObject({
      pages: [2, 17],
      scenarioIds: ['page-02-buildings-props-and-factions', 'page-17-workshop-and-siege'],
      treatmentRoles: ['neutral-structure'],
      assetIds: ['projectile_catapult'],
      assetCounts: { unique: 1, free: 1, extra: 0, occurrences: 2 },
    });

    const propClusterApi = describeKayKitGuidePublicApiCoverage('GameboardBuilder.addPropCluster');
    expect(propClusterApi).toMatchObject({
      pages: [2, 5, 15, 16, 17],
      scenarioIds: [
        'page-02-buildings-props-and-factions',
        'page-05-nature-contents',
        'page-15-shipyard-harbors',
        'page-16-stables-and-horses',
        'page-17-workshop-and-siege',
      ],
      treatmentRoles: ['prop'],
      assetCounts: { unique: 31, free: 22, extra: 9, occurrences: 74 },
    });
    expect(propClusterApi?.assetIds).toEqual(expect.arrayContaining(['target', 'haybale', 'anchor']));

    const unitPresetApi = describeKayKitGuidePublicApiCoverage('GameboardBuilder.addUnitPreset');
    expect(unitPresetApi).toMatchObject({
      pages: [14, 15, 16, 17, 18],
      treatmentRoles: expect.arrayContaining(['colored-unit-part', 'neutral-unit-part']),
      assetCounts: { unique: 137, free: 0, extra: 137, occurrences: 548 },
    });
    expect(describeKayKitGuidePublicApiCoverage('missing-api')).toBeUndefined();
  });

  it('exposes asset-level guide coverage for every treated FREE and EXTRA asset id', () => {
    const assetCoverages = listKayKitGuideAssetCoverages();
    const assetIds = assetCoverages.map((coverage) => coverage.assetId);

    expect(assetCoverages).toHaveLength(404);
    expect(listKayKitGuideAssetCoveragesFromRoot().map((coverage) => coverage.assetId)).toEqual(assetIds);
    expect(assetIds).toEqual([...assetIds].sort());

    for (const coverage of assetCoverages) {
      expect(coverage.scenarioIds.length, coverage.assetId).toBeGreaterThan(0);
      expect(coverage.pages.length, coverage.assetId).toBeGreaterThan(0);
      expect(coverage.publicApi.length, coverage.assetId).toBeGreaterThan(0);
      expect(coverage.docs.length, coverage.assetId).toBeGreaterThan(0);
      expect(coverage.visualArtifacts.length, coverage.assetId).toBeGreaterThan(0);
      expect(coverage.occurrences, coverage.assetId).toBeGreaterThan(0);
      expect(coverage.treatment.assetId).toBe(coverage.assetId);
    }

    const roadM = describeKayKitGuideAssetCoverage('hex_road_M');
    expect(describeKayKitGuideAssetCoverageFromRoot('hex_road_M')?.pages).toEqual(roadM?.pages);
    expect(roadM).toMatchObject({
      assetId: 'hex_road_M',
      minimumEdition: 'free',
      role: 'road-tile',
      placementKind: 'road',
      pages: [3, 9],
      scenarioIds: ['page-03-road-variations', 'page-09-world-design-example'],
      publicApi: expect.arrayContaining(['selectRoadVariant', 'GameboardBuilder.addRoadPath']),
      occurrences: 2,
    });
    expect(roadM?.publicApi).not.toContain('GameboardBuilder.addForest');

    const unitFull = describeKayKitGuideAssetCoverage('unit_blue_full');
    expect(unitFull).toMatchObject({
      assetId: 'unit_blue_full',
      minimumEdition: 'extra',
      role: 'colored-unit-part',
      placementKind: 'unit',
      pages: [14, 16, 17, 18],
      publicApi: expect.arrayContaining(['GameboardBuilder.addUnitPreset']),
      occurrences: 4,
    });
    expect(describeKayKitGuideAssetCoverage('missing-asset')).toBeUndefined();

    const bridgeA = describeKayKitGuideAssetCoverage('building_bridge_A');
    expect(bridgeA).toMatchObject({
      assetId: 'building_bridge_A',
      minimumEdition: 'free',
      role: 'neutral-structure',
      placementKind: 'structure',
      pages: [2, 7, 9],
      publicApi: expect.arrayContaining(['GameboardBuilder.addBridge', 'GameboardBuilder.addNeutralStructure']),
      occurrences: 3,
    });

    const wallGate = describeKayKitGuideAssetCoverage('wall_straight_gate');
    expect(wallGate).toMatchObject({
      assetId: 'wall_straight_gate',
      minimumEdition: 'free',
      role: 'neutral-structure',
      placementKind: 'structure',
      pages: [2, 16, 17],
      publicApi: expect.arrayContaining(['GameboardBuilder.addFortification', 'GameboardBuilder.addNeutralStructure']),
      occurrences: 3,
    });

    const constructionStage = describeKayKitGuideAssetCoverage('building_stage_B');
    expect(constructionStage).toMatchObject({
      assetId: 'building_stage_B',
      minimumEdition: 'free',
      role: 'neutral-structure',
      placementKind: 'structure',
      pages: [2, 17],
      publicApi: expect.arrayContaining(['GameboardBuilder.addConstructionSite', 'GameboardBuilder.addNeutralStructure']),
      occurrences: 2,
    });

    const projectile = describeKayKitGuideAssetCoverage('projectile_catapult');
    expect(projectile).toMatchObject({
      assetId: 'projectile_catapult',
      minimumEdition: 'free',
      role: 'neutral-structure',
      placementKind: 'structure',
      pages: [2, 17],
      publicApi: expect.arrayContaining(['GameboardBuilder.addSiegeProjectile', 'GameboardBuilder.addNeutralStructure']),
      occurrences: 2,
    });

    const trainingTarget = describeKayKitGuideAssetCoverage('target');
    expect(trainingTarget).toMatchObject({
      assetId: 'target',
      minimumEdition: 'free',
      role: 'prop',
      placementKind: 'prop',
      pages: [2, 5, 17],
      publicApi: expect.arrayContaining(['GameboardBuilder.addPropCluster', 'listPropClusterAssets']),
      occurrences: 3,
    });

    const slopeHigh = describeKayKitGuideAssetCoverage('hex_grass_sloped_high');
    expect(slopeHigh).toMatchObject({
      assetId: 'hex_grass_sloped_high',
      minimumEdition: 'free',
      role: 'base-tile',
      placementKind: 'terrain',
      pages: [8, 10],
      publicApi: expect.arrayContaining(['GameboardBuilder.addElevationRamp', 'GameboardBuilder.setTileAsset']),
      occurrences: 2,
    });
  });

  it('exposes public role coverage back to guide pages, APIs, and treated assets', () => {
    const roleCoverages = listKayKitGuideRoleCoverages();
    const roleNames = roleCoverages.map((coverage) => coverage.role);

    expect(roleCoverages).toHaveLength(12);
    expect(listKayKitGuideRoleCoveragesFromRoot().map((coverage) => coverage.role)).toEqual(roleNames);
    expect(roleNames).toEqual([...roleNames].sort());

    const roadRole = describeKayKitGuideRoleCoverage('road-tile');
    expect(describeKayKitGuideRoleCoverageFromRoot('road-tile')?.assetCounts).toEqual(
      roadRole?.assetCounts
    );
    expect(roadRole).toMatchObject({
      pages: [3, 9],
      scenarioIds: ['page-03-road-variations', 'page-09-world-design-example'],
      publicApi: expect.arrayContaining(['selectRoadVariant', 'GameboardBuilder.addRoadPath']),
      assetCounts: { unique: 15, free: 15, extra: 0, occurrences: 30 },
    });

    const propRole = describeKayKitGuideRoleCoverage('prop');
    expect(propRole).toMatchObject({
      pages: [2, 5, 15, 16, 17],
      publicApi: expect.arrayContaining([
        'GameboardBuilder.addHarbor',
        'GameboardBuilder.addProp',
        'GameboardBuilder.addPropCluster',
      ]),
    });
    expect(propRole?.assetCounts.free).toBeGreaterThan(0);
    expect(propRole?.assetCounts.extra).toBeGreaterThan(0);

    const natureRole = describeKayKitGuideRoleCoverage('nature-decoration');
    expect(natureRole).toMatchObject({
      pages: [5, 6, 9, 10],
      publicApi: expect.arrayContaining(['GameboardBuilder.scatterDecorations']),
    });

    const unitRole = describeKayKitGuideRoleCoverage('colored-unit-part');
    expect(unitRole).toMatchObject({
      pages: [14, 16, 17, 18],
      assetCounts: { unique: 112, free: 0, extra: 112 },
      publicApi: expect.arrayContaining(['GameboardBuilder.addUnitPreset']),
    });
    const neutralRole = describeKayKitGuideRoleCoverage('neutral-structure');
    expect(neutralRole).toMatchObject({
      publicApi: expect.arrayContaining([
        'GameboardBuilder.addBridge',
        'GameboardBuilder.addConstructionSite',
        'GameboardBuilder.addFortification',
        'GameboardBuilder.addSiegeProjectile',
      ]),
    });
    expect(describeKayKitGuideRoleCoverage('missing-role')).toBeUndefined();
  });

  it('renders the guide scenario coverage matrix as reproducible Markdown', () => {
    const markdown = renderKayKitGuideScenarioCoverageMarkdown();

    expect(renderKayKitGuideScenarioCoverageMarkdownFromRoot()).toBe(markdown);
    expect(markdown).toContain('# Guide Scenario Coverage');
    expect(markdown).toContain(
      'pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-scenarios --markdown > docs/guides/guide-scenario-coverage.md'
    );
    expect(markdown).toContain('Scenario: `page-03-road-variations`');
    expect(markdown).toContain('Scenario: `page-19-supporters-and-attribution`');
    expect(markdown).toContain('GameboardBuilder.addHarbor');
    expect(markdown).toContain('## Role Coverage Index');
    expect(markdown).toContain('describeKayKitGuideRoleCoverage');
    expect(markdown).toContain('listKayKitGuideScenarioAssetUsages()');
    expect(markdown).toContain('## Page-Level Usage Query');
    expect(markdown).toContain('Role - `prop`');
    expect(markdown).toContain('listKayKitGuidePublicApiCoverages()');
    expect(markdown.endsWith('\n')).toBe(true);
  });
});
