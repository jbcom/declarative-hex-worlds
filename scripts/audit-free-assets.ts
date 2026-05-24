import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

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
const packageRoot = join(workspaceRoot, 'packages/medieval-hexagon-gameboard');
const assetRoot = join(packageRoot, 'assets/free');
const manifestPath = join(assetRoot, 'manifest.json');
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
const filesystemPaths = collectFiles(assetRoot)
  .map((path) => `assets/free/${relative(assetRoot, path).replaceAll('\\', '/')}`)
  .sort();
const filesystemPathSet = new Set(filesystemPaths);
const referencedPaths = new Set<string>(['assets/free/manifest.json']);
const modelPaths = new Set<string>();
const boundsTolerance = 0.0001;

auditManifestMetadata();
auditManifestAssets();
auditFilesystemCoverage();
auditNotices();

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`free asset audit: ${failure}`);
  }
  process.exit(1);
}

console.log('free asset audit passed');

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
    'manifest licenseUrl must point at CC0-1.0'
  );
  assertEqualRecord(manifest.counts.byCategory, expectedCategoryCounts, 'category counts changed');
  assertEqualRecord(manifest.counts.bySubcategory, expectedSubcategoryCounts, 'subcategory counts changed');
  assert(manifest.textureSets.length === 1 && manifest.textureSets[0] === 'default', 'FREE manifest must only expose default textures');
  assert(manifest.counts.total === 221, `manifest total changed to ${manifest.counts.total}`);
  assert(manifest.assets.length === manifest.counts.total, 'manifest assets length does not match counts.total');
  assert(
    !/references|\/Volumes\/home|KayKit_Medieval_Hexagon_Pack_1\.0_EXTRA/.test(JSON.stringify(manifest)),
    'manifest must not contain local references, network storage paths, or EXTRA source names'
  );
}

function auditManifestAssets(): void {
  const ids = new Set<string>();

  for (const asset of manifest.assets) {
    assert(!ids.has(asset.id), `duplicate asset id ${asset.id}`);
    ids.add(asset.id);
    modelPaths.add(asset.modelPath);
    referencedPaths.add(asset.modelPath);
    for (const bufferPath of asset.bufferPaths) {
      referencedPaths.add(bufferPath);
    }
    for (const texturePath of asset.texturePaths) {
      referencedPaths.add(texturePath);
    }

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
      assert(filesystemPathSet.has(path), `${asset.id} references missing file ${path}`);
    }

    const modelAbsolutePath = join(packageRoot, asset.modelPath);
    assert(statSync(modelAbsolutePath).size === asset.fileSizeBytes, `${asset.id} fileSizeBytes does not match model file size`);
    assertBounds(asset);
    assertFaction(asset);
  }

  assert(ids.size === manifest.counts.total, `manifest has ${ids.size} unique ids but counts.total is ${manifest.counts.total}`);
  assertEqualList(Object.keys(manifest.assetsById).sort(), [...ids].sort(), 'assetsById keys');
}

function auditFilesystemCoverage(): void {
  for (const path of filesystemPaths) {
    const extension = extname(path);
    assert(['.bin', '.gltf', '.json', '.png'].includes(extension), `unexpected packaged asset extension: ${path}`);
    if (extension === '.gltf') {
      assert(modelPaths.has(path), `orphan GLTF not listed in manifest: ${path}`);
    } else if (extension !== '.json') {
      assert(referencedPaths.has(path), `orphan asset sidecar not referenced in manifest: ${path}`);
    }
  }
}

function auditNotices(): void {
  const rootNotice = readFileSync(join(workspaceRoot, 'NOTICE.md'), 'utf8');
  const packageNotice = readFileSync(join(packageRoot, 'NOTICE.md'), 'utf8');
  const rootLicense = readFileSync(join(workspaceRoot, 'LICENSE'), 'utf8');
  const packageLicense = readFileSync(join(packageRoot, 'LICENSE'), 'utf8');
  assert(packageLicense === rootLicense, 'package LICENSE must match root LICENSE');
  for (const [label, source] of [
    ['root NOTICE.md', rootNotice],
    ['package NOTICE.md', packageNotice],
  ] as const) {
    assert(source.includes('MIT'), `${label} must mention MIT code licensing`);
    assert(source.includes('Kay Lousberg'), `${label} must credit Kay Lousberg`);
    assert(source.includes('KayKit'), `${label} must credit KayKit`);
    assert(source.includes('CC0-1.0'), `${label} must mention CC0-1.0`);
    assert(source.includes('https://creativecommons.org/publicdomain/zero/1.0/'), `${label} must link CC0-1.0`);
  }
}

function assertBounds(asset: ManifestAsset): void {
  for (const key of ['min', 'max', 'size'] as const) {
    assert(asset.bounds[key].length === 3, `${asset.id} bounds.${key} must have three numbers`);
    assert(asset.bounds[key].every((value) => Number.isFinite(value)), `${asset.id} bounds.${key} must be finite`);
  }
  for (let index = 0; index < 3; index += 1) {
    const expectedSize = asset.bounds.max[index] - asset.bounds.min[index];
    assert(
      Math.abs(asset.bounds.size[index] - expectedSize) <= boundsTolerance,
      `${asset.id} bounds.size[${index}] does not match min/max`
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

function collectFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
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
    `${label} expected ${expected.join(', ')}, got ${actual.join(', ')}`
  );
}
