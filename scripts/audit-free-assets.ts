// FREE manifest audit (post PRD-RB: assets are bootstrapped, not bundled).
//
// Before Epic RB the on-disk GLTF tree under `assets/free/` was the source of
// truth and this script walked it to validate bidirectional coverage between
// manifest entries and shipped files. After Epic RB the only file shipped
// under `assets/free/` is `manifest.json` itself — the GLTF/BIN/PNG tree is
// fetched at install time by the CLI `bootstrap` subcommand (Epic RB1/RB2).
//
// What this audit now asserts:
//   - Manifest shape: schemaVersion / edition / sourcePack metadata
//   - Category and subcategory counts match the canonical KayKit FREE pack
//   - Internal manifest consistency: no duplicate ids, assetsById in sync
//   - Per-asset shape: relative paths, expected suffixes, bounds, faction
//   - Notices credit KayKit + CC0-1.0
//
// What this audit no longer does (because the files no longer ship):
//   - Walk the filesystem under `assets/free/buildings|decoration|tiles`
//   - Verify `fileSizeBytes` against on-disk size (the bootstrap step
//     verifies that against fetched bytes via the integrity sidecar)
//   - Cross-check a per-asset LICENSE copy (LICENSE-dedup gone post-R1)

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface AssetBounds {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
}

interface ManifestAsset {
  id: string;
  edition: string;
  category: string;
  subcategory: string;
  family: string;
  faction?: string;
  unitStyle?: string;
  textureSet: string;
  modelPath: string;
  sourcePath: string;
  bufferPaths: string[];
  texturePaths: string[];
  materialSlots: string[];
  bounds: AssetBounds;
  fileSizeBytes: number;
}

interface FreeManifest {
  schemaVersion: string;
  generatedAt: string;
  edition: string;
  sourcePack: {
    name: string;
    version: string;
    edition: string;
    creator: string;
    license: string;
    licenseUrl: string;
    sourceRootName: string;
  };
  textureSets: string[];
  assets: ManifestAsset[];
  assetsById: Record<string, ManifestAsset>;
  counts: {
    total: number;
    byCategory: Record<string, number>;
    bySubcategory: Record<string, number>;
  };
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const packageRoot = workspaceRoot;
const manifestPath = join(packageRoot, 'assets/free/manifest.json');
const failures: string[] = [];
const expectedCategoryCounts = { buildings: 93, decoration: 68, tiles: 60 };
const expectedSubcategoryCounts = {
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
};

const manifest = readJson<FreeManifest>(manifestPath);
const boundsTolerance = 0.0001;

auditManifestMetadata();
auditManifestAssets();
auditNotices();

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`free asset audit: ${failure}`);
  }
  process.exit(1);
}

console.log('free asset audit passed (manifest-only, post-RB)');

function auditManifestMetadata(): void {
  assert(manifest.schemaVersion === '1.0.0', 'manifest schemaVersion must be 1.0.0');
  assert(manifest.edition === 'free', 'manifest edition must be free');
  assert(manifest.sourcePack.name === 'KayKit: Medieval Hexagon Pack', 'manifest source pack name changed');
  assert(manifest.sourcePack.version === '1.0', 'manifest source pack version changed');
  assert(manifest.sourcePack.edition === 'free', 'manifest source pack edition changed');
  assert(manifest.sourcePack.creator === 'Kay Lousberg', 'manifest creator must credit Kay Lousberg');
  assert(manifest.sourcePack.license === 'CC0-1.0', 'manifest asset license must be CC0-1.0');
  assert(
    manifest.sourcePack.licenseUrl === 'https://creativecommons.org/publicdomain/zero/1.0/',
    'manifest licenseUrl must point at CC0-1.0',
  );
  assertEqualRecord(manifest.counts.byCategory, expectedCategoryCounts, 'category counts changed');
  assertEqualRecord(manifest.counts.bySubcategory, expectedSubcategoryCounts, 'subcategory counts changed');
  assert(
    manifest.textureSets.length === 1 && manifest.textureSets[0] === 'default',
    'FREE manifest must only expose default textures',
  );
  assert(manifest.counts.total === 221, `manifest total changed to ${manifest.counts.total}`);
  assert(manifest.assets.length === manifest.counts.total, 'manifest assets length does not match counts.total');
  assert(
    !/references|\/Volumes\/home|KayKit_Medieval_Hexagon_Pack_1\.0_EXTRA/.test(JSON.stringify(manifest)),
    'manifest must not contain local references, network storage paths, or EXTRA source names',
  );
}

function auditManifestAssets(): void {
  const ids = new Set<string>();

  for (const asset of manifest.assets) {
    assert(!ids.has(asset.id), `duplicate asset id ${asset.id}`);
    ids.add(asset.id);

    assert(manifest.assetsById[asset.id]?.modelPath === asset.modelPath, `assetsById is out of sync for ${asset.id}`);
    assert(asset.edition === 'free', `${asset.id} edition must be free`);
    assert(asset.textureSet === 'default', `${asset.id} textureSet must be default`);
    assert(asset.modelPath.startsWith('assets/free/'), `${asset.id} modelPath must stay under assets/free`);
    assert(asset.modelPath.endsWith('.gltf'), `${asset.id} modelPath must be .gltf`);
    assert(!asset.modelPath.includes('..'), `${asset.id} modelPath must not traverse`);
    assert(!asset.sourcePath.includes('..') && !asset.sourcePath.startsWith('/'), `${asset.id} sourcePath must be relative`);
    assert(asset.bufferPaths.length > 0, `${asset.id} must reference at least one buffer`);
    assert(asset.texturePaths.length > 0, `${asset.id} must reference at least one texture`);
    assert(asset.materialSlots.length > 0, `${asset.id} must have material slots`);

    for (const path of [asset.modelPath, ...asset.bufferPaths, ...asset.texturePaths]) {
      assert(path.startsWith('assets/free/'), `${asset.id} referenced path must stay under assets/free: ${path}`);
      assert(!path.includes('..'), `${asset.id} referenced path must not traverse: ${path}`);
    }

    assert(asset.fileSizeBytes > 0, `${asset.id} fileSizeBytes must be positive (bootstrap verifies the actual bytes)`);
    assertBounds(asset);
    assertFaction(asset);
  }

  assert(ids.size === manifest.counts.total, `manifest has ${ids.size} unique ids but counts.total is ${manifest.counts.total}`);
  assertEqualList(Object.keys(manifest.assetsById).sort(), [...ids].sort(), 'assetsById keys');
}

function auditNotices(): void {
  const notice = readFileSync(join(workspaceRoot, 'NOTICE.md'), 'utf8');
  assert(notice.includes('MIT'), 'NOTICE.md must mention MIT code licensing');
  assert(notice.includes('Kay Lousberg'), 'NOTICE.md must credit Kay Lousberg');
  assert(notice.includes('KayKit'), 'NOTICE.md must credit KayKit');
  assert(notice.includes('CC0-1.0'), 'NOTICE.md must mention CC0-1.0');
  assert(
    notice.includes('https://creativecommons.org/publicdomain/zero/1.0/'),
    'NOTICE.md must link CC0-1.0',
  );
}

function assertBounds(asset: ManifestAsset): void {
  for (const key of ['min', 'max', 'size'] as const) {
    assert(asset.bounds[key].length === 3, `${asset.id} bounds.${key} must have three numbers`);
    assert(asset.bounds[key].every((value) => Number.isFinite(value)), `${asset.id} bounds.${key} must be finite`);
  }
  for (const index of [0, 1, 2] as const) {
    const expectedSize = asset.bounds.max[index] - asset.bounds.min[index];
    assert(
      Math.abs(asset.bounds.size[index] - expectedSize) <= boundsTolerance,
      `${asset.id} bounds.size[${index}] does not match min/max`,
    );
    assert(asset.bounds.size[index] >= 0, `${asset.id} bounds.size[${index}] must be non-negative`);
  }
  assert(Math.max(...asset.bounds.size) > 0, `${asset.id} bounds must be non-empty`);
}

function assertFaction(asset: ManifestAsset): void {
  if (asset.category !== 'buildings') {
    if (asset.category === 'decoration' && asset.subcategory === 'props' && /^flag_(blue|green|red|yellow)$/.test(asset.id)) {
      assert(asset.faction === asset.id.slice('flag_'.length), `${asset.id} flag faction must match id suffix`);
    } else {
      assert(asset.faction === undefined, `${asset.id} non-building asset must not have faction metadata`);
    }
    return;
  }
  if (['blue', 'green', 'red', 'yellow'].includes(asset.subcategory)) {
    assert(asset.faction === asset.subcategory, `${asset.id} faction must match building subcategory`);
  } else {
    assert(asset.faction === undefined, `${asset.id} neutral building must not have faction metadata`);
  }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
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
    `${label} expected ${expected.join(', ')}, got ${actual.join(', ')}`,
  );
}
