import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BASE_TILE_ASSET_IDS,
  COAST_TILE_ASSET_IDS,
  EXTRA_TRANSITION_TILE_ASSET_IDS,
  RIVER_TILE_ASSET_IDS,
  ROAD_TILE_ASSET_IDS,
  describeKayKitAssetTreatment,
  hasKayKitAssetTreatment,
  isKnownExtraAssetId,
  listKayKitAssetPublicTreatments,
  neutralUnitAssetId,
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
});
