/**
 * Scenario catalog contract — the references-independent half of the old
 * `scripts/audit-reference-assets.ts` (deleted). Asserts the public-API
 * treatment table, the guide-scenario coverage, and the packaged FREE
 * manifest all agree on the canonical KayKit asset-id universe, and that
 * the guide-scenario coverage doc matches the rendered output + documents
 * the inversion-query CLI usage.
 *
 * The local-references-tree half (validating `references/**` and the
 * third-party Kenney / Adventurers fixtures) lives in
 * `reference-tree-contract.test.ts`, which skips when those gitignored
 * trees are absent (i.e. in CI).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  describeKayKitAssetTreatment,
  listKayKitAssetPublicTreatments,
  listKayKitGuideScenarios,
  renderKayKitGuideScenarioCoverageMarkdown,
} from '../../src/scenario';
import { freeManifest, validateMedievalHexagonManifest } from '../../src/manifest';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const guideScenarioCoverageDoc = readFileSync(
  resolve(repoRoot, 'docs/guides/guide-scenario-coverage.md'),
  'utf8'
);

const FACTIONS = ['blue', 'green', 'red', 'yellow'] as const;

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}
function factionAssetIds(kinds: readonly string[], prefix: 'building'): string[] {
  return FACTIONS.flatMap((faction) => kinds.map((kind) => `${prefix}_${kind}_${faction}`));
}

const baseTileIds = [
  'hex_grass_bottom',
  'hex_grass_sloped_high',
  'hex_grass_sloped_low',
  'hex_grass',
  'hex_water',
];
const roadTileIds = [
  'hex_road_A_sloped_high',
  'hex_road_A_sloped_low',
  ...['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].map((l) => `hex_road_${l}`),
];
const coastTileIds = ['A', 'B', 'C', 'D', 'E'].flatMap((l) => [
  `hex_coast_${l}`,
  `hex_coast_${l}_waterless`,
]);
const riverBaseLabels = [
  'A_curvy',
  'A',
  'B',
  'C',
  'crossing_A',
  'crossing_B',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
];
const riverTileIds = [
  ...riverBaseLabels.map((l) => `hex_river_${l}`),
  ...riverBaseLabels.map((l) => `hex_river_${l}_waterless`),
];
const freeFactionBuildingKinds = [
  'archeryrange',
  'barracks',
  'blacksmith',
  'castle',
  'church',
  'home_A',
  'home_B',
  'lumbermill',
  'market',
  'mine',
  'tavern',
  'tower_A',
  'tower_B',
  'tower_base',
  'tower_catapult',
  'watermill',
  'well',
  'windmill',
];
const neutralBuildingIds = [
  'building_bridge_A',
  'building_bridge_B',
  'building_destroyed',
  'building_dirt',
  'building_grain',
  'building_scaffolding',
  'building_stage_A',
  'building_stage_B',
  'building_stage_C',
  'fence_stone_straight_gate',
  'fence_stone_straight',
  'fence_wood_straight_gate',
  'fence_wood_straight',
  'projectile_catapult',
  'wall_corner_A_gate',
  'wall_corner_A_inside',
  'wall_corner_A_outside',
  'wall_corner_B_inside',
  'wall_corner_B_outside',
  'wall_straight_gate',
  'wall_straight',
];
const natureIds = [
  'cloud_big',
  'cloud_small',
  'hill_single_A',
  'hill_single_B',
  'hill_single_C',
  'hills_A_trees',
  'hills_A',
  'hills_B_trees',
  'hills_B',
  'hills_C_trees',
  'hills_C',
  'mountain_A_grass_trees',
  'mountain_A_grass',
  'mountain_A',
  'mountain_B_grass_trees',
  'mountain_B_grass',
  'mountain_B',
  'mountain_C_grass_trees',
  'mountain_C_grass',
  'mountain_C',
  'rock_single_A',
  'rock_single_B',
  'rock_single_C',
  'rock_single_D',
  'rock_single_E',
  'tree_single_A_cut',
  'tree_single_A',
  'tree_single_B_cut',
  'tree_single_B',
  'trees_A_cut',
  'trees_A_large',
  'trees_A_medium',
  'trees_A_small',
  'trees_B_cut',
  'trees_B_large',
  'trees_B_medium',
  'trees_B_small',
  'waterlily_A',
  'waterlily_B',
  'waterplant_A',
  'waterplant_B',
  'waterplant_C',
];
const freePropIds = [
  'barrel',
  'bucket_arrows',
  'bucket_empty',
  'bucket_water',
  'crate_A_big',
  'crate_A_small',
  'crate_B_big',
  'crate_B_small',
  'crate_long_A',
  'crate_long_B',
  'crate_long_C',
  'crate_long_empty',
  'crate_open',
  'flag_blue',
  'flag_green',
  'flag_red',
  'flag_yellow',
  'ladder',
  'pallet',
  'resource_lumber',
  'resource_stone',
  'sack',
  'target',
  'tent',
  'weaponrack',
  'wheelbarrow',
];
const extraFactionBuildingKinds = [
  'docks',
  'shipyard',
  'shrine',
  'stables',
  'tent',
  'tower_cannon',
  'townhall',
  'watchtower',
  'workshop',
];
const extraPropIds = [
  'anchor',
  'boat',
  'boatrack',
  'cannonball_pallet',
  'haybale',
  'icon_combat',
  'icon_range',
  'trough_long',
  'trough',
];
const neutralUnitIds = [
  'banner',
  'bow',
  'cannon',
  'cart_merchant',
  'cart',
  'catapult',
  'hammer',
  'helmet',
  'horse_A',
  'horse_B',
  'horse_C',
  'horse_D',
  'horse_E',
  'horse_F',
  'horse_G',
  'horse_saddle',
  'projectile_arrow',
  'projectile_cannonball',
  'units_neutral_projectile_catapult',
  'shield',
  'ship',
  'shovel',
  'spear',
  'sword',
  'unit',
];
const factionUnitParts = [
  'banner',
  'bow',
  'cannon',
  'cart',
  'cart_merchant',
  'catapult',
  'helmet',
  'horse',
  'projectile_arrow',
  'shield',
  'ship',
  'spear',
  'sword',
  'unit',
];
const unitStyles = ['accent', 'full'] as const;
function factionUnitIds(parts: readonly string[]): string[] {
  return FACTIONS.flatMap((faction) =>
    parts.flatMap((part) => unitStyles.map((style) => `${part}_${faction}_${style}`))
  );
}

const expectedFreeIds = uniqueSorted([
  ...baseTileIds,
  ...roadTileIds,
  ...coastTileIds,
  ...riverTileIds,
  ...factionAssetIds(freeFactionBuildingKinds, 'building'),
  ...neutralBuildingIds,
  ...natureIds,
  ...freePropIds,
]);
const expectedExtraIds = uniqueSorted([
  ...expectedFreeIds,
  'hex_transition',
  ...factionAssetIds(extraFactionBuildingKinds, 'building'),
  ...extraPropIds,
  ...neutralUnitIds,
  ...factionUnitIds(factionUnitParts),
]);

describe('public API treatments', () => {
  const treatments = listKayKitAssetPublicTreatments();

  it('treatment asset ids exactly match the EXTRA id universe', () => {
    expect(treatments.map((t) => t.assetId).sort()).toEqual([...expectedExtraIds].sort());
  });

  it.each(treatments.map((t) => [t.assetId, t] as const))('%s treatment shape', (id, treatment) => {
    expect(treatment.publicApi.length, `${id} must list public APIs`).toBeGreaterThan(0);
    expect(treatment.sourceImages.length, `${id} must link guide images`).toBeGreaterThan(0);
    expect(treatment.sourcePath.endsWith('.gltf'), `${id} sourcePath must be a GLTF`).toBe(true);
  });
});

describe('guide scenarios', () => {
  const scenarios = listKayKitGuideScenarios();
  const expectedSourceImages = Array.from(
    { length: 19 },
    (_, i) => `docs/assets/kaykit-guide/pages/page-${String(i + 1).padStart(2, '0')}.png`
  );

  it('has exactly 19 scenarios', () => expect(scenarios.length).toBe(19));
  it('scenario ids are unique', () =>
    expect(new Set(scenarios.map((s) => s.id)).size).toBe(scenarios.length));
  it('scenario pages are 1..19 in order', () =>
    expect(scenarios.map((s) => s.page)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1)));
  it('scenario source images are the 19 guide PNGs', () =>
    expect(scenarios.map((s) => s.sourceImage)).toEqual(expectedSourceImages));
  it('scenario asset coverage equals the EXTRA id universe', () =>
    expect(uniqueSorted(scenarios.flatMap((s) => s.assetIds))).toEqual([...expectedExtraIds].sort()));

  it.each(scenarios.map((s) => [s.id, s] as const))('%s scenario shape', (id, scenario) => {
    expect(
      guideScenarioCoverageDoc.includes(`Scenario: \`${id}\``),
      `coverage doc must list ${id}`
    ).toBe(true);
    expect(scenario.publicApi.length, `${id} must list public APIs`).toBeGreaterThan(0);
    expect(scenario.visualArtifacts.length, `${id} must list visual artifacts`).toBeGreaterThan(0);
    expect(scenario.docs.length, `${id} must list docs`).toBeGreaterThan(0);
    for (const assetId of scenario.assetIds) {
      expect(describeKayKitAssetTreatment(assetId), `${id} references unknown ${assetId}`).toBeDefined();
      expect(expectedExtraIds.includes(assetId), `${id} references unexpected ${assetId}`).toBe(
        true
      );
    }
  });

  it('every treatment source image has a guide scenario', () => {
    const scenarioSourceImages = new Set(scenarios.map((s) => s.sourceImage));
    const orphans: string[] = [];
    for (const treatment of listKayKitAssetPublicTreatments()) {
      for (const image of treatment.sourceImages) {
        if (!scenarioSourceImages.has(image)) orphans.push(`${treatment.assetId}: ${image}`);
      }
    }
    expect(orphans, orphans.join('\n')).toEqual([]);
  });
});

describe('guide scenario coverage doc cross-references', () => {
  it.each([
    ['listKayKitGuidePublicApiCoverages()'],
    ['listKayKitGuideAssetCoverages()'],
    ['guide-assets --assetId hex_road_M --json'],
    ['guide-usages --page 16,17,18 --json'],
    ['listKayKitGuideRoleCoverages()'],
    ['guide-roles --role prop --json'],
    ['guide-apis --publicApi GameboardBuilder.addHarbor --json'],
  ])('documents %s', (snippet) => {
    expect(guideScenarioCoverageDoc).toContain(snippet);
  });

  it('matches renderKayKitGuideScenarioCoverageMarkdown() output exactly', () => {
    expect(guideScenarioCoverageDoc).toBe(renderKayKitGuideScenarioCoverageMarkdown());
  });
});

describe('packaged FREE manifest agrees with the catalog id universe', () => {
  it('has no manifest validation errors', () => {
    const errors = validateMedievalHexagonManifest(freeManifest).filter(
      (issue) => issue.severity === 'error'
    );
    expect(errors.map((e) => e.code)).toEqual([]);
  });

  it('asset ids exactly match expectedFreeIds', () => {
    expect(freeManifest.assets.map((a) => a.id).sort()).toEqual([...expectedFreeIds].sort());
  });

  it('assetsById keys exactly match expectedFreeIds', () => {
    expect(Object.keys(freeManifest.assetsById).sort()).toEqual([...expectedFreeIds].sort());
  });

  it.each(freeManifest.assets.map((a) => [a.id, a] as const))(
    '%s has an explicit public treatment matching its sourcePath',
    (id, asset) => {
      const treatment = describeKayKitAssetTreatment(id);
      expect(treatment, `${id} must have a public treatment`).toBeDefined();
      expect(treatment?.sourcePath, `${id} treatment sourcePath mismatch`).toBe(asset.sourcePath);
      expect((treatment?.publicApi.length ?? 0) > 0, `${id} treatment needs public APIs`).toBe(true);
      expect((treatment?.sourceImages.length ?? 0) > 0, `${id} treatment needs guide images`).toBe(
        true
      );
      expect(asset.sourcePath.endsWith('.gltf'), `${id} sourcePath must be GLTF`).toBe(true);
      expect(asset.modelPath.endsWith(asset.sourcePath), `${id} modelPath must end with sourcePath`).toBe(
        true
      );
    }
  );
});
