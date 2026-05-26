import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  describeKayKitAssetTreatment,
  listKayKitAssetPublicTreatments,
  listKayKitGuideScenarios,
  renderKayKitGuideScenarioCoverageMarkdown,
} from '../src/scenario';
import { generateManifestFromSource, validateSourceRoot } from '../src/ingest';
import { freeManifest } from '../src/manifest/free';
import { validateMedievalHexagonManifest } from '../src/manifest/schema';
import type { MedievalHexagonManifest, PackEdition } from '../src/types';

const workspaceRoot = resolve(import.meta.dirname, '..');
const failures: string[] = [];
const guideScenarioCoverageDoc = readRequired('docs/guides/guide-scenario-coverage.md');
const factions = ['blue', 'green', 'red', 'yellow'] as const;
const unitStyles = ['accent', 'full'] as const;

const baseTileIds = ['hex_grass_bottom', 'hex_grass_sloped_high', 'hex_grass_sloped_low', 'hex_grass', 'hex_water'];
const roadTileIds = [
  'hex_road_A_sloped_high',
  'hex_road_A_sloped_low',
  'hex_road_A',
  'hex_road_B',
  'hex_road_C',
  'hex_road_D',
  'hex_road_E',
  'hex_road_F',
  'hex_road_G',
  'hex_road_H',
  'hex_road_I',
  'hex_road_J',
  'hex_road_K',
  'hex_road_L',
  'hex_road_M',
];
const coastTileIds = ['A', 'B', 'C', 'D', 'E'].flatMap((label) => [
  `hex_coast_${label}`,
  `hex_coast_${label}_waterless`,
]);
const riverTileIds = [
  'hex_river_A_curvy',
  'hex_river_A',
  'hex_river_B',
  'hex_river_C',
  'hex_river_crossing_A',
  'hex_river_crossing_B',
  'hex_river_D',
  'hex_river_E',
  'hex_river_F',
  'hex_river_G',
  'hex_river_H',
  'hex_river_I',
  'hex_river_J',
  'hex_river_K',
  'hex_river_L',
  'hex_river_A_curvy_waterless',
  'hex_river_A_waterless',
  'hex_river_B_waterless',
  'hex_river_C_waterless',
  'hex_river_crossing_A_waterless',
  'hex_river_crossing_B_waterless',
  'hex_river_D_waterless',
  'hex_river_E_waterless',
  'hex_river_F_waterless',
  'hex_river_G_waterless',
  'hex_river_H_waterless',
  'hex_river_I_waterless',
  'hex_river_J_waterless',
  'hex_river_K_waterless',
  'hex_river_L_waterless',
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

auditPublicTreatments(expectedExtraIds);
auditGuideScenarios(expectedExtraIds);
auditManifest('packaged FREE manifest', freeManifest, {
  expectedIds: expectedFreeIds,
  expectedTextureSets: ['default'],
  expectedCategoryCounts: { buildings: 93, decoration: 68, tiles: 60 },
  expectedSubcategoryCounts: {
    'buildings/blue': 18,
    'buildings/green': 18,
    'buildings/neutral': 21,
    'buildings/red': 18,
    'buildings/yellow': 18,
    'decoration/nature': 42,
    'decoration/props': 26,
    'tiles/base': 5,
    'tiles/coast': 10,
    'tiles/rivers': 30,
    'tiles/roads': 15,
  },
});

let localAuditCount = 0;
let localFixtureAuditCount = 0;
auditLocalSource('free', 'KayKit_Medieval_Hexagon_Pack_1.0_FREE', expectedFreeIds);
auditLocalSource('extra', 'KayKit_Medieval_Hexagon_Pack_1.0_EXTRA', expectedExtraIds);
auditKenneyCastleKitFixture();
auditKayKitAdventurersFixture();

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`reference asset audit: ${failure}`);
  }
  process.exit(1);
}

const localAudits = [
  localAuditCount > 0 ? `${localAuditCount} KayKit source(s)` : undefined,
  localFixtureAuditCount > 0 ? `${localFixtureAuditCount} third-party fixture(s)` : undefined,
].filter((value): value is string => typeof value === 'string');
const localSummary =
  localAudits.length > 0 ? ` and ${localAudits.join(', ')}` : '; local references not present, source audit skipped';
console.log(`reference asset audit passed for packaged FREE manifest${localSummary}`);

function auditLocalSource(edition: PackEdition, rootName: string, expectedIds: readonly string[]): void {
  const sourceRoot = join(workspaceRoot, 'references', rootName);
  if (!existsSync(join(sourceRoot, 'Assets', 'gltf'))) {
    return;
  }
  localAuditCount += 1;

  const sourceStatus = validateSourceRoot(sourceRoot, edition);
  assert(sourceStatus.ok, `${edition} source count expected ${sourceStatus.expectedCount}, got ${sourceStatus.gltfCount}`);
  const manifest = generateManifestFromSource({
    sourceRoot,
    edition,
    assetBasePath: `assets/${edition}`,
  });

  auditManifest(`local ${edition.toUpperCase()} source manifest`, manifest, {
    expectedIds,
    expectedTextureSets: edition === 'free' ? ['default'] : ['default', 'fall', 'summer', 'winter'],
    expectedCategoryCounts:
      edition === 'free'
        ? { buildings: 93, decoration: 68, tiles: 60 }
        : { buildings: 129, decoration: 77, tiles: 61, units: 137 },
    expectedSubcategoryCounts:
      edition === 'free'
        ? {
            'buildings/blue': 18,
            'buildings/green': 18,
            'buildings/neutral': 21,
            'buildings/red': 18,
            'buildings/yellow': 18,
            'decoration/nature': 42,
            'decoration/props': 26,
            'tiles/base': 5,
            'tiles/coast': 10,
            'tiles/rivers': 30,
            'tiles/roads': 15,
          }
        : {
            'buildings/blue': 27,
            'buildings/green': 27,
            'buildings/neutral': 21,
            'buildings/red': 27,
            'buildings/yellow': 27,
            'decoration/nature': 42,
            'decoration/props': 35,
            'tiles/base': 6,
            'tiles/coast': 10,
            'tiles/rivers': 30,
            'tiles/roads': 15,
            'units/blue': 28,
            'units/green': 28,
            'units/neutral': 25,
            'units/red': 28,
            'units/yellow': 28,
          },
  });

  if (edition === 'extra') {
    assert(
      manifest.assetsById.projectile_catapult?.sourcePath === 'buildings/neutral/projectile_catapult.gltf',
      'EXTRA duplicate basename must preserve FREE-compatible building projectile_catapult id'
    );
    assert(
      manifest.assetsById.units_neutral_projectile_catapult?.sourcePath === 'units/neutral/projectile_catapult.gltf',
      'EXTRA units/neutral/projectile_catapult.gltf must be available as units_neutral_projectile_catapult'
    );
    const extraOnlyIds = manifest.assets.filter((asset) => !freeManifest.assetsById[asset.id]).map((asset) => asset.id);
    assert(extraOnlyIds.length === 183, `EXTRA-only asset id count expected 183, got ${extraOnlyIds.length}`);
  }
}

function auditKenneyCastleKitFixture(): void {
  const root = join(workspaceRoot, 'references', 'kenney_castle-kit');
  if (!existsSync(root)) {
    return;
  }
  localFixtureAuditCount += 1;

  const glbRoot = join(root, 'Models', 'GLB format');
  const glbFiles = listDirectFiles(glbRoot, '.glb', 'Kenney Castle Kit GLB fixture');
  assert(glbFiles.length === 76, `Kenney Castle Kit GLB count expected 76, got ${glbFiles.length}`);

  for (const fixture of ['tower-hexagon-base.glb', 'tower-square-base.glb', 'tree-large.glb']) {
    assert(glbFiles.includes(fixture), `Kenney Castle Kit local E2E fixture is missing ${fixture}`);
  }

  const overrides = readJsonObject('docs/examples/local-piece-overrides.kenney-castle.json').overrides;
  assert(isRecord(overrides), 'Kenney Castle Kit piece override example must expose an overrides object');
  if (isRecord(overrides)) {
    for (const key of Object.keys(overrides)) {
      assert(glbFiles.includes(`${key}.glb`), `Kenney Castle Kit override ${key} does not match a local GLB file`);
    }
  }
}

function auditKayKitAdventurersFixture(): void {
  const root = join(workspaceRoot, 'references', 'KayKit_Adventurers_2.0_FREE');
  if (!existsSync(root)) {
    return;
  }
  localFixtureAuditCount += 1;

  assertEqualList(
    listDirectFiles(join(root, 'Characters', 'gltf'), '.glb', 'KayKit Adventurers character fixture'),
    ['Barbarian.glb', 'Knight.glb', 'Mage.glb', 'Ranger.glb', 'Rogue.glb', 'Rogue_Hooded.glb'],
    'KayKit Adventurers character GLBs'
  );
  assertEqualList(
    listDirectFiles(join(root, 'Animations', 'gltf', 'Rig_Medium'), '.glb', 'KayKit Adventurers animation fixture'),
    ['Rig_Medium_General.glb', 'Rig_Medium_MovementBasic.glb'],
    'KayKit Adventurers Rig_Medium animation GLBs'
  );
  assert(
    listDirectFiles(join(root, 'Assets', 'gltf'), '.gltf', 'KayKit Adventurers prop fixture').length === 31,
    'KayKit Adventurers prop GLTF count expected 31'
  );
  assert(existsSync(join(root, 'Characters', 'gltf', 'Knight.glb')), 'KayKit Adventurers local E2E fixture is missing Knight.glb');
  assert(
    existsSync(join(root, 'Animations', 'gltf', 'Rig_Medium', 'Rig_Medium_MovementBasic.glb')),
    'KayKit Adventurers local E2E fixture is missing Rig_Medium_MovementBasic.glb'
  );
}

function auditManifest(
  label: string,
  manifest: MedievalHexagonManifest,
  options: {
    expectedIds: readonly string[];
    expectedTextureSets: readonly string[];
    expectedCategoryCounts: Record<string, number>;
    expectedSubcategoryCounts: Record<string, number>;
  }
): void {
  const validationIssues = validateMedievalHexagonManifest(manifest).filter((issue) => issue.severity === 'error');
  assert(validationIssues.length === 0, `${label} has manifest validation errors: ${validationIssues.map((issue) => issue.code).join(', ')}`);
  assertEqualList(manifest.textureSets, options.expectedTextureSets, `${label} textureSets`);
  assertEqualRecord(manifest.counts.byCategory, options.expectedCategoryCounts, `${label} category counts`);
  assertEqualRecord(manifest.counts.bySubcategory, options.expectedSubcategoryCounts, `${label} subcategory counts`);
  assertEqualList(
    manifest.assets.map((asset) => asset.id).sort(),
    [...options.expectedIds].sort(),
    `${label} asset ids`
  );
  assertEqualList(
    Object.keys(manifest.assetsById).sort(),
    [...options.expectedIds].sort(),
    `${label} assetsById keys`
  );

  for (const asset of manifest.assets) {
    const treatment = describeKayKitAssetTreatment(asset.id);
    assert(treatment !== undefined, `${label} ${asset.id} must have an explicit public API treatment`);
    assert(
      treatment?.sourcePath === asset.sourcePath,
      `${label} ${asset.id} treatment sourcePath expected ${asset.sourcePath}, got ${treatment?.sourcePath}`
    );
    assert((treatment?.publicApi.length ?? 0) > 0, `${label} ${asset.id} treatment must list public APIs`);
    assert((treatment?.sourceImages.length ?? 0) > 0, `${label} ${asset.id} treatment must link guide images`);
    assert(asset.sourcePath.endsWith('.gltf'), `${label} ${asset.id} sourcePath must point at a GLTF`);
    assert(asset.modelPath.endsWith(asset.sourcePath), `${label} ${asset.id} modelPath must end with sourcePath`);
    assert(asset.materialSlots.length > 0, `${label} ${asset.id} must expose material slots`);
    assert(asset.bufferPaths.length > 0, `${label} ${asset.id} must expose buffers`);
    assert(asset.texturePaths.length > 0, `${label} ${asset.id} must expose textures`);
    assert(Math.max(...asset.bounds.size) > 0, `${label} ${asset.id} must expose non-empty bounds`);
  }
}

function auditPublicTreatments(expectedIds: readonly string[]): void {
  const treatments = listKayKitAssetPublicTreatments();
  assertEqualList(
    treatments.map((treatment) => treatment.assetId).sort(),
    [...expectedIds].sort(),
    'public API treatment asset ids'
  );
  for (const treatment of treatments) {
    assert(treatment.publicApi.length > 0, `${treatment.assetId} treatment must list public APIs`);
    assert(treatment.sourceImages.length > 0, `${treatment.assetId} treatment must link guide images`);
    assert(treatment.sourcePath.endsWith('.gltf'), `${treatment.assetId} treatment sourcePath must point at GLTF`);
  }
}

function auditGuideScenarios(expectedIds: readonly string[]): void {
  const scenarios = listKayKitGuideScenarios();
  const scenarioIds = scenarios.map((scenario) => scenario.id);
  const scenarioPages = scenarios.map((scenario) => scenario.page);
  const scenarioSourceImages = scenarios.map((scenario) => scenario.sourceImage);
  const scenarioAssetIds = uniqueSorted(scenarios.flatMap((scenario) => scenario.assetIds));
  const scenarioSourceImageSet = new Set(scenarioSourceImages);
  const expectedSourceImages = Array.from(
    { length: 19 },
    (_, index) => `docs/assets/kaykit-guide/pages/page-${String(index + 1).padStart(2, '0')}.png`
  );

  assert(scenarios.length === 19, `guide scenario count expected 19, got ${scenarios.length}`);
  assert(new Set(scenarioIds).size === scenarios.length, 'guide scenario ids must be unique');
  assertEqualList(
    scenarioPages.map((page) => String(page)),
    Array.from({ length: 19 }, (_, index) => String(index + 1)),
    'guide scenario pages'
  );
  assertEqualList(scenarioSourceImages, expectedSourceImages, 'guide scenario source images');
  assertEqualList(scenarioAssetIds, [...expectedIds].sort(), 'guide scenario asset coverage');

  for (const scenario of scenarios) {
    assert(
      guideScenarioCoverageDoc.includes(`Scenario: \`${scenario.id}\``),
      `guide scenario coverage docs must list ${scenario.id}`
    );
    assert(scenario.publicApi.length > 0, `${scenario.id} must list public APIs`);
    assert(scenario.visualArtifacts.length > 0, `${scenario.id} must list visual artifacts`);
    assert(scenario.docs.length > 0, `${scenario.id} must list docs`);
    for (const assetId of scenario.assetIds) {
      const treatment = describeKayKitAssetTreatment(assetId);
      assert(treatment !== undefined, `${scenario.id} references unknown asset id ${assetId}`);
      assert(expectedIds.includes(assetId), `${scenario.id} references unexpected asset id ${assetId}`);
    }
  }

  for (const treatment of listKayKitAssetPublicTreatments()) {
    for (const sourceImage of treatment.sourceImages) {
      assert(
        scenarioSourceImageSet.has(sourceImage),
        `${treatment.assetId} treatment source image ${sourceImage} must have a guide scenario`
      );
    }
  }

  assert(
    guideScenarioCoverageDoc.includes('listKayKitGuidePublicApiCoverages()'),
    'guide scenario coverage docs must explain public API inversion'
  );
  assert(
    guideScenarioCoverageDoc.includes('listKayKitGuideAssetCoverages()'),
    'guide scenario coverage docs must explain public asset inversion'
  );
  assert(
    guideScenarioCoverageDoc.includes('guide-assets --assetId hex_road_M --json'),
    'guide scenario coverage docs must show guide-assets usage'
  );
  assert(
    guideScenarioCoverageDoc.includes('guide-usages --page 16,17,18 --json'),
    'guide scenario coverage docs must show guide-usages usage'
  );
  assert(
    guideScenarioCoverageDoc.includes('listKayKitGuideRoleCoverages()'),
    'guide scenario coverage docs must explain public role inversion'
  );
  assert(
    guideScenarioCoverageDoc.includes('guide-roles --role prop --json'),
    'guide scenario coverage docs must show guide-roles usage'
  );
  assert(
    guideScenarioCoverageDoc.includes('guide-apis --publicApi GameboardBuilder.addHarbor --json'),
    'guide scenario coverage docs must show guide-apis usage'
  );
  assert(
    guideScenarioCoverageDoc === renderKayKitGuideScenarioCoverageMarkdown(),
    'guide scenario coverage docs must match renderKayKitGuideScenarioCoverageMarkdown() output'
  );
}

function factionAssetIds(kinds: readonly string[], prefix: 'building'): string[] {
  return factions.flatMap((faction) => kinds.map((kind) => `${prefix}_${kind}_${faction}`));
}

function factionUnitIds(parts: readonly string[]): string[] {
  return factions.flatMap((faction) =>
    parts.flatMap((part) => unitStyles.map((style) => `${part}_${faction}_${style}`))
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function readRequired(path: string): string {
  const resolved = join(workspaceRoot, path);
  assert(existsSync(resolved), `missing ${path}`);
  return existsSync(resolved) ? readFileSync(resolved, 'utf8') : '';
}

function readJsonObject(path: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readRequired(path));
  assert(isRecord(parsed), `${path} must contain a JSON object`);
  return isRecord(parsed) ? parsed : {};
}

function listDirectFiles(root: string, extension: string, label: string): string[] {
  assert(existsSync(root), `${label} root is missing: ${root}`);
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => entry.name)
    .sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    failures.push(message);
  }
}

function assertEqualRecord(actual: Record<string, number>, expected: Record<string, number>, label: string): void {
  assertEqualList(Object.keys(actual).sort(), Object.keys(expected).sort(), `${label} keys`);
  for (const [key, value] of Object.entries(expected)) {
    assert(actual[key] === value, `${label}.${key} expected ${value}, got ${actual[key]}`);
  }
}

function assertEqualList(actual: readonly string[], expected: readonly string[], label: string): void {
  assert(
    actual.length === expected.length && actual.every((value, index) => value === expected[index]),
    `${label} expected ${expected.join(', ')}, got ${actual.join(', ')}`
  );
}
