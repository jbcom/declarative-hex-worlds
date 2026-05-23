import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import {
  FACTIONS,
  KAYKIT_PACK_VERSION,
  MEDIEVAL_HEXAGON_SCHEMA_VERSION,
  TEXTURE_SETS,
  type AssetBounds,
  type AssetCategory,
  type Faction,
  type MedievalHexagonAsset,
  type MedievalHexagonManifest,
  type PackEdition,
  type TextureSet,
  type UnitStyle,
} from './types';

interface GltfAccessor {
  min?: number[];
  max?: number[];
}

interface GltfMeshPrimitive {
  attributes?: {
    POSITION?: number;
  };
  material?: number;
}

interface GltfDocument {
  accessors?: GltfAccessor[];
  buffers?: Array<{ uri?: string }>;
  images?: Array<{ uri?: string }>;
  materials?: Array<{ name?: string }>;
  meshes?: Array<{ primitives?: GltfMeshPrimitive[] }>;
}

export interface GenerateManifestOptions {
  sourceRoot: string;
  edition: PackEdition;
  assetBasePath?: string;
  generatedAt?: string;
}

export interface ValidateSourceResult {
  sourceRoot: string;
  edition: PackEdition;
  gltfCount: number;
  expectedCount: number;
  ok: boolean;
}

export interface WriteManifestModuleOptions {
  exportName?: string;
  typeImportPath?: string;
}

const EXPECTED_COUNTS: Record<PackEdition, number> = {
  free: 221,
  extra: 404,
};

export function expectedModelCount(edition: PackEdition): number {
  return EXPECTED_COUNTS[edition];
}

export function defaultSourceRoot(edition: PackEdition, cwd = process.cwd()): string {
  const suffix =
    edition === 'free'
      ? 'KayKit_Medieval_Hexagon_Pack_1.0_FREE'
      : 'KayKit_Medieval_Hexagon_Pack_1.0_EXTRA';
  return resolve(cwd, 'references', suffix);
}

export function validateSourceRoot(sourceRoot: string, edition: PackEdition): ValidateSourceResult {
  const gltfRoot = join(sourceRoot, 'Assets', 'gltf');
  const gltfCount = existsSync(gltfRoot) ? listFiles(gltfRoot, '.gltf').length : 0;
  const expectedCount = expectedModelCount(edition);
  return {
    sourceRoot,
    edition,
    gltfCount,
    expectedCount,
    ok: gltfCount === expectedCount,
  };
}

export function copyGltfTree(sourceRoot: string, destinationRoot: string): void {
  const gltfRoot = join(sourceRoot, 'Assets', 'gltf');
  if (!existsSync(gltfRoot)) {
    throw new Error(`Missing GLTF source directory: ${gltfRoot}`);
  }

  rmSync(destinationRoot, { recursive: true, force: true });
  mkdirSync(destinationRoot, { recursive: true });

  for (const filePath of listFiles(gltfRoot)) {
    const outputPath = join(destinationRoot, toPosixPath(relative(gltfRoot, filePath)));
    mkdirSync(dirname(outputPath), { recursive: true });
    copyFileSync(filePath, outputPath);
  }
}

export function generateManifestFromSource(options: GenerateManifestOptions): MedievalHexagonManifest {
  const assetBasePath = trimSlashes(options.assetBasePath ?? `assets/${options.edition}`);
  const gltfRoot = join(options.sourceRoot, 'Assets', 'gltf');
  if (!existsSync(gltfRoot)) {
    throw new Error(`Missing GLTF source directory: ${gltfRoot}`);
  }

  const assets = listFiles(gltfRoot, '.gltf')
    .sort((a, b) => a.localeCompare(b))
    .map((filePath) => assetFromGltf(filePath, gltfRoot, options.edition, assetBasePath));
  const assetsById = Object.fromEntries(assets.map((asset) => [asset.id, asset]));

  return {
    schemaVersion: MEDIEVAL_HEXAGON_SCHEMA_VERSION,
    generatedAt: options.generatedAt ?? '2026-05-22T00:00:00.000Z',
    edition: options.edition,
    sourcePack: {
      name: 'KayKit: Medieval Hexagon Pack',
      version: KAYKIT_PACK_VERSION,
      edition: options.edition,
      creator: 'Kay Lousberg',
      license: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceRootName: basename(options.sourceRoot),
    },
    textureSets: readTextureSets(options.sourceRoot),
    assets,
    assetsById,
    counts: countAssets(assets),
  };
}

export function writeManifestModule(
  manifest: MedievalHexagonManifest,
  outputPath: string,
  options: WriteManifestModuleOptions = {}
): void {
  mkdirSync(dirname(outputPath), { recursive: true });
  const body = JSON.stringify(manifest, null, 2);
  const exportName = options.exportName ?? defaultManifestExportName(manifest.edition);
  if (!isValidIdentifier(exportName)) {
    throw new Error(`Invalid manifest module export name: ${exportName}`);
  }
  writeFileSync(
    outputPath,
    `import type { MedievalHexagonManifest } from ${JSON.stringify(options.typeImportPath ?? '../types')};\n\n` +
      `export const ${exportName}: MedievalHexagonManifest = ${body};\n\n` +
      `export default ${exportName};\n`,
    'utf8'
  );
}

export function writeManifestJson(manifest: MedievalHexagonManifest, outputPath: string): void {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function assetFromGltf(
  filePath: string,
  gltfRoot: string,
  edition: PackEdition,
  assetBasePath: string
): MedievalHexagonAsset {
  const sourcePath = toPosixPath(relative(gltfRoot, filePath));
  const segments = sourcePath.split('/');
  const category = parseCategory(segments[0]);
  const subcategory = segments[1] ?? 'root';
  const id = basename(filePath, extname(filePath));
  const document = JSON.parse(readFileSync(filePath, 'utf8')) as GltfDocument;
  const modelPath = `${assetBasePath}/${sourcePath}`;
  const directoryPath = dirname(modelPath);
  const bufferPaths = (document.buffers ?? [])
    .map((buffer) => buffer.uri)
    .filter(isDefined)
    .map((uri) => `${directoryPath}/${uri}`);
  const texturePaths = (document.images ?? [])
    .map((image) => image.uri)
    .filter(isDefined)
    .map((uri) => `${directoryPath}/${uri}`);

  return {
    id,
    edition,
    category,
    subcategory,
    family: parseFamily(id, category),
    faction: parseFaction(id, subcategory),
    unitStyle: parseUnitStyle(id, category),
    textureSet: 'default',
    modelPath,
    sourcePath,
    bufferPaths,
    texturePaths,
    materialSlots: (document.materials ?? []).map((material, index) => material.name ?? `material_${index}`),
    bounds: extractBounds(document),
    fileSizeBytes: statSync(filePath).size,
  };
}

function listFiles(root: string, extension?: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const childPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(childPath, extension));
      continue;
    }
    if (!extension || childPath.endsWith(extension)) {
      files.push(childPath);
    }
  }
  return files;
}

function extractBounds(document: GltfDocument): AssetBounds {
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

  for (const mesh of document.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const accessorIndex = primitive.attributes?.POSITION;
      if (accessorIndex === undefined) {
        continue;
      }
      const accessor = document.accessors?.[accessorIndex];
      if (!accessor?.min || !accessor.max) {
        continue;
      }
      for (let index = 0; index < 3; index += 1) {
        min[index] = Math.min(min[index], accessor.min[index] ?? min[index]);
        max[index] = Math.max(max[index], accessor.max[index] ?? max[index]);
      }
    }
  }

  if (!Number.isFinite(min[0]) || !Number.isFinite(max[0])) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0],
      size: [0, 0, 0],
    };
  }

  return {
    min: roundTuple(min),
    max: roundTuple(max),
    size: roundTuple([max[0] - min[0], max[1] - min[1], max[2] - min[2]]),
  };
}

function countAssets(assets: readonly MedievalHexagonAsset[]) {
  const byCategory: Record<string, number> = {};
  const bySubcategory: Record<string, number> = {};
  for (const asset of assets) {
    byCategory[asset.category] = (byCategory[asset.category] ?? 0) + 1;
    const key = `${asset.category}/${asset.subcategory}`;
    bySubcategory[key] = (bySubcategory[key] ?? 0) + 1;
  }
  return {
    total: assets.length,
    byCategory,
    bySubcategory,
  };
}

function readTextureSets(sourceRoot: string): TextureSet[] {
  const textureRoot = join(sourceRoot, 'Textures');
  if (!existsSync(textureRoot)) {
    return ['default'];
  }

  const textureSets = new Set<TextureSet>(['default']);
  for (const fileName of readdirSync(textureRoot)) {
    if (fileName === 'hexagons_medieval_Fall.png') {
      textureSets.add('fall');
    }
    if (fileName === 'hexagons_medieval_Summer.png') {
      textureSets.add('summer');
    }
    if (fileName === 'hexagons_medieval_Winter.png') {
      textureSets.add('winter');
    }
  }
  return TEXTURE_SETS.filter((textureSet) => textureSets.has(textureSet));
}

function parseCategory(segment: string | undefined): AssetCategory {
  if (segment === 'tiles' || segment === 'buildings' || segment === 'decoration' || segment === 'units') {
    return segment;
  }
  throw new Error(`Unsupported asset category: ${segment ?? '<missing>'}`);
}

function parseFaction(id: string, subcategory: string): Faction | undefined {
  for (const faction of FACTIONS) {
    if (subcategory === faction || id.endsWith(`_${faction}`) || id.includes(`_${faction}_`)) {
      return faction;
    }
  }
  return undefined;
}

function parseUnitStyle(id: string, category: AssetCategory): UnitStyle | undefined {
  if (category !== 'units') {
    return undefined;
  }
  if (id.endsWith('_accent')) {
    return 'accent';
  }
  if (id.endsWith('_full')) {
    return 'full';
  }
  return 'neutral';
}

function parseFamily(id: string, category: AssetCategory): string {
  if (category === 'tiles') {
    return id.replace(/_waterless$/, '').replace(/_sloped_(high|low)$/, '');
  }
  let family = id;
  for (const faction of FACTIONS) {
    family = family.replace(new RegExp(`_${faction}_(accent|full)$`), '');
    family = family.replace(new RegExp(`_${faction}$`), '');
  }
  return family.replace(/_(accent|full)$/, '');
}

function roundTuple(values: readonly number[]): [number, number, number] {
  return [round(values[0] ?? 0), round(values[1] ?? 0), round(values[2] ?? 0)];
}

function round(value: number): number {
  return Math.round(value * 100_000) / 100_000;
}

function defaultManifestExportName(edition: PackEdition): string {
  return `${edition}Manifest`;
}

function isValidIdentifier(value: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(value);
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function toPosixPath(value: string): string {
  return value.split(sep).join('/');
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
