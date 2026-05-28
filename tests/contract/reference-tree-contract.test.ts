/**
 * Reference-tree contract — the local-references half of the old
 * `scripts/audit-reference-assets.ts` (deleted). Validates:
 *   - KayKit FREE + EXTRA source trees (via generateManifestFromSource)
 *   - Kenney Castle Kit GLB fixture
 *   - KayKit Adventurers 2.0 FREE GLB/GLTF fixture
 *
 * All substantive assertions skip via `it.skipIf(!<treePresent>)` when
 * the relevant `references/` subdirectory is absent (i.e. in CI, where
 * those gitignored trees are not checked out). The sentinel tests that
 * are always-passing expose in the report which trees were present during
 * the run so a missing tree in a local dev session doesn't silently skip
 * coverage without notice.
 *
 * The catalog-independent half (public treatments, guide scenarios, FREE
 * manifest) lives in `scenario-catalog-contract.test.ts`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateManifestFromSource, validateSourceRoot } from '../../src/ingest';
import { freeManifest } from '../../src/manifest/free';
import { validateMedievalHexagonManifest } from '../../src/manifest/schema';
import { describeKayKitAssetTreatment } from '../../src/scenario';
import type { PackEdition } from '../../src/types';

const repoRoot = resolve(import.meta.dirname, '..', '..');

const referenceFreeRoot = join(repoRoot, 'references', 'KayKit_Medieval_Hexagon_Pack_1.0_FREE');
const referenceExtraRoot = join(repoRoot, 'references', 'KayKit_Medieval_Hexagon_Pack_1.0_EXTRA');
const kenneyRoot = join(repoRoot, 'references', 'kenney_castle-kit');
const adventurersRoot = join(repoRoot, 'references', 'KayKit_Adventurers_2.0_FREE');

const freePresent = existsSync(join(referenceFreeRoot, 'Assets', 'gltf'));
const extraPresent = existsSync(join(referenceExtraRoot, 'Assets', 'gltf'));
const kenneyPresent = existsSync(kenneyRoot);
const adventurersPresent = existsSync(adventurersRoot);

const FACTIONS: string[] = ['blue', 'green', 'red', 'yellow'];

function factionAssetIds(kinds: readonly string[], prefix: 'building'): string[] {
  return FACTIONS.flatMap((faction) => kinds.map((kind) => `${prefix}_${kind}_${faction}`));
}

function factionUnitIds(parts: readonly string[]): string[] {
  const unitStyles: string[] = ['accent', 'full'];
  return FACTIONS.flatMap((faction) =>
    parts.flatMap((part) => unitStyles.map((style) => `${part}_${faction}_${style}`))
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function listDirectFiles(root: string, extension: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(extension))
    .map((e) => e.name)
    .sort();
}

// ── expected id universes (shared with scenario-catalog-contract) ──────────

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

// ── helpers ────────────────────────────────────────────────────────────────

function assertManifestShape(
  label: string,
  edition: PackEdition,
  expectedIds: readonly string[],
  expectedTextureSets: readonly string[],
  expectedCategoryCounts: Record<string, number>,
  expectedSubcategoryCounts: Record<string, number>
) {
  const sourceRoot = edition === 'free' ? referenceFreeRoot : referenceExtraRoot;
  const manifest = generateManifestFromSource({
    sourceRoot,
    edition,
    assetBasePath: `assets/${edition}`,
  });

  const errors = validateMedievalHexagonManifest(manifest).filter((i) => i.severity === 'error');
  expect(errors.map((e) => e.code), `${label} validation errors`).toEqual([]);
  expect([...manifest.textureSets].sort(), `${label} textureSets`).toEqual([...expectedTextureSets].sort());
  expect(manifest.assets.map((a) => a.id).sort(), `${label} asset ids`).toEqual([...expectedIds].sort());
  expect(Object.keys(manifest.assetsById).sort(), `${label} assetsById keys`).toEqual(
    [...expectedIds].sort()
  );

  for (const [cat, count] of Object.entries(expectedCategoryCounts)) {
    expect(manifest.counts.byCategory[cat], `${label} byCategory.${cat}`).toBe(count);
  }
  for (const [sub, count] of Object.entries(expectedSubcategoryCounts)) {
    expect(manifest.counts.bySubcategory[sub], `${label} bySubcategory.${sub}`).toBe(count);
  }

  for (const asset of manifest.assets) {
    const treatment = describeKayKitAssetTreatment(asset.id);
    expect(treatment, `${label} ${asset.id} must have a public treatment`).toBeDefined();
    expect(treatment?.sourcePath, `${label} ${asset.id} treatment sourcePath mismatch`).toBe(
      asset.sourcePath
    );
    expect(
      (treatment?.publicApi.length ?? 0) > 0,
      `${label} ${asset.id} treatment must list public APIs`
    ).toBe(true);
    expect(
      (treatment?.sourceImages.length ?? 0) > 0,
      `${label} ${asset.id} treatment must link guide images`
    ).toBe(true);
    expect(asset.sourcePath.endsWith('.gltf'), `${label} ${asset.id} sourcePath must be GLTF`).toBe(true);
    expect(
      asset.modelPath.endsWith(asset.sourcePath),
      `${label} ${asset.id} modelPath must end with sourcePath`
    ).toBe(true);
    expect(asset.materialSlots.length, `${label} ${asset.id} must expose material slots`).toBeGreaterThan(0);
    expect(asset.bufferPaths.length, `${label} ${asset.id} must expose buffers`).toBeGreaterThan(0);
    expect(asset.texturePaths.length, `${label} ${asset.id} must expose textures`).toBeGreaterThan(0);
    expect(Math.max(...asset.bounds.size), `${label} ${asset.id} bounds must be non-empty`).toBeGreaterThan(
      0
    );
  }
  return manifest;
}

// ── KayKit FREE source tree ────────────────────────────────────────────────

describe('KayKit FREE source tree', () => {
  it('sentinel — FREE references tree present locally? (skip on CI is expected)', () => {
    expect([true, false]).toContain(freePresent);
  });

  it.skipIf(!freePresent)('validateSourceRoot passes for FREE edition', () => {
    const status = validateSourceRoot(referenceFreeRoot, 'free');
    expect(status.ok, `FREE source gltf count: ${status.gltfCount} vs expected ${status.expectedCount}`).toBe(
      true
    );
  });

  it.skipIf(!freePresent)('generated FREE manifest asset ids match expectedFreeIds', () => {
    assertManifestShape(
      'local FREE source manifest',
      'free',
      expectedFreeIds,
      ['default'],
      { buildings: 93, decoration: 68, tiles: 60 },
      {
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
    );
  });
});

// ── KayKit EXTRA source tree ───────────────────────────────────────────────

describe('KayKit EXTRA source tree', () => {
  it('sentinel — EXTRA references tree present locally? (skip on CI is expected)', () => {
    expect([true, false]).toContain(extraPresent);
  });

  it.skipIf(!extraPresent)('validateSourceRoot passes for EXTRA edition', () => {
    const status = validateSourceRoot(referenceExtraRoot, 'extra');
    expect(status.ok, `EXTRA source gltf count: ${status.gltfCount} vs expected ${status.expectedCount}`).toBe(
      true
    );
  });

  it.skipIf(!extraPresent)('generated EXTRA manifest asset ids match expectedExtraIds', () => {
    const manifest = assertManifestShape(
      'local EXTRA source manifest',
      'extra',
      expectedExtraIds,
      ['default', 'fall', 'summer', 'winter'],
      { buildings: 129, decoration: 77, tiles: 61, units: 137 },
      {
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
      }
    );

    expect(
      manifest.assetsById['projectile_catapult']?.sourcePath,
      'EXTRA must preserve FREE-compatible building projectile_catapult id'
    ).toBe('buildings/neutral/projectile_catapult.gltf');
    expect(
      manifest.assetsById['units_neutral_projectile_catapult']?.sourcePath,
      'EXTRA units/neutral/projectile_catapult.gltf must get units_neutral_projectile_catapult id'
    ).toBe('units/neutral/projectile_catapult.gltf');

    const extraOnlyIds = manifest.assets
      .filter((a) => !freeManifest.assetsById[a.id])
      .map((a) => a.id);
    expect(extraOnlyIds.length, 'EXTRA-only asset count').toBe(183);
  });
});

// ── Kenney Castle Kit fixture ──────────────────────────────────────────────

describe('Kenney Castle Kit fixture', () => {
  it('sentinel — kenney_castle-kit present locally? (skip on CI is expected)', () => {
    expect([true, false]).toContain(kenneyPresent);
  });

  it.skipIf(!kenneyPresent)('GLB count is 76', () => {
    const glbFiles = listDirectFiles(join(kenneyRoot, 'Models', 'GLB format'), '.glb');
    expect(glbFiles.length).toBe(76);
  });

  it.skipIf(!kenneyPresent)('required E2E GLBs present', () => {
    const glbFiles = new Set(listDirectFiles(join(kenneyRoot, 'Models', 'GLB format'), '.glb'));
    for (const fixture of ['tower-hexagon-base.glb', 'tower-square-base.glb', 'tree-large.glb']) {
      expect(glbFiles.has(fixture), `missing Kenney Castle Kit GLB: ${fixture}`).toBe(true);
    }
  });

  it.skipIf(!kenneyPresent)('piece override example keys match GLB files', () => {
    const glbFiles = new Set(listDirectFiles(join(kenneyRoot, 'Models', 'GLB format'), '.glb'));
    const examplePath = join(repoRoot, 'docs/examples/local-piece-overrides.kenney-castle.json');
    expect(existsSync(examplePath), 'kenney-castle override example missing').toBe(true);
    const { overrides } = JSON.parse(readFileSync(examplePath, 'utf8')) as {
      overrides: Record<string, unknown>;
    };
    for (const key of Object.keys(overrides)) {
      expect(glbFiles.has(`${key}.glb`), `override key ${key} has no matching GLB`).toBe(true);
    }
  });
});

// ── KayKit Adventurers 2.0 FREE fixture ───────────────────────────────────

describe('KayKit Adventurers 2.0 FREE fixture', () => {
  it('sentinel — KayKit_Adventurers_2.0_FREE present locally? (skip on CI is expected)', () => {
    expect([true, false]).toContain(adventurersPresent);
  });

  it.skipIf(!adventurersPresent)('character GLBs are exactly the expected 6', () => {
    expect(listDirectFiles(join(adventurersRoot, 'Characters', 'gltf'), '.glb')).toEqual([
      'Barbarian.glb',
      'Knight.glb',
      'Mage.glb',
      'Ranger.glb',
      'Rogue.glb',
      'Rogue_Hooded.glb',
    ]);
  });

  it.skipIf(!adventurersPresent)('Rig_Medium animation GLBs are exactly the expected 2', () => {
    expect(
      listDirectFiles(join(adventurersRoot, 'Animations', 'gltf', 'Rig_Medium'), '.glb')
    ).toEqual(['Rig_Medium_General.glb', 'Rig_Medium_MovementBasic.glb']);
  });

  it.skipIf(!adventurersPresent)('prop GLTF count is 31', () => {
    expect(listDirectFiles(join(adventurersRoot, 'Assets', 'gltf'), '.gltf').length).toBe(31);
  });

  it.skipIf(!adventurersPresent)('required E2E assets present', () => {
    expect(existsSync(join(adventurersRoot, 'Characters', 'gltf', 'Knight.glb'))).toBe(true);
    expect(
      existsSync(
        join(adventurersRoot, 'Animations', 'gltf', 'Rig_Medium', 'Rig_Medium_MovementBasic.glb')
      )
    ).toBe(true);
  });
});
