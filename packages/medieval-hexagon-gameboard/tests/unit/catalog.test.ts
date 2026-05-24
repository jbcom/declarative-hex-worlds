import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  listKayKitGuideScenarioTreatments as listKayKitGuideScenarioTreatmentsFromRoot,
  listKayKitGuideScenarios as listKayKitGuideScenariosFromRoot,
  summarizeKayKitGuideCoverage as summarizeKayKitGuideCoverageFromRoot,
} from '../../src';
import {
  BASE_TILE_ASSET_IDS,
  COAST_TILE_ASSET_IDS,
  EXTRA_TRANSITION_TILE_ASSET_IDS,
  RIVER_TILE_ASSET_IDS,
  ROAD_TILE_ASSET_IDS,
  describeKayKitAssetTreatment,
  describeKayKitGuideScenario,
  hasKayKitAssetTreatment,
  isKnownExtraAssetId,
  listKayKitAssetPublicTreatments,
  listKayKitGuideScenarioTreatments,
  listKayKitGuideScenarios,
  neutralUnitAssetId,
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
        occurrences: 1093,
        freeOccurrences: 459,
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
  });
});
