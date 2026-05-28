/**
 * Node-side asset ingest utilities for validating FREE/EXTRA source roots,
 * copying GLTF trees, extracting bounds, and writing generated manifests.
 *
 * @module
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { GameboardIoError, GameboardManifestError } from '../errors';
import {
  FACTIONS,
  KAYKIT_PACK_VERSION,
  HEX_WORLDS_SCHEMA_VERSION,
  TEXTURE_SETS,
  type AssetBounds,
  type AssetCategory,
  type Faction,
  type MedievalHexagonAsset,
  type MedievalHexagonManifest,
  type PackEdition,
  type TextureSet,
  type UnitStyle,
} from '../types';

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

/**
 * Options for scanning a local KayKit source folder into a package manifest.
 *
 * This is a Node/build-time API for app-local FREE or EXTRA ingest pipelines;
 * it is not intended for browser runtime imports.
 */
export interface GenerateManifestOptions {
  /** Root folder of a KayKit Medieval Hexagon pack containing `Assets/gltf`. */
  sourceRoot: string;
  /** Pack edition being scanned. */
  edition: PackEdition;
  /** Published or app-local asset URL prefix written into manifest paths. */
  assetBasePath?: string;
  /** Stable timestamp override for reproducible generated manifests. */
  generatedAt?: string;
}

/**
 * Source validation summary for a local KayKit pack folder.
 */
export interface ValidateSourceResult {
  /** Source root that was checked. */
  sourceRoot: string;
  /** Pack edition expected at the source root. */
  edition: PackEdition;
  /** Number of `.gltf` files found under `Assets/gltf`. */
  gltfCount: number;
  /** Expected model count for the requested edition. */
  expectedCount: number;
  /** Whether the discovered count exactly matches the edition expectation. */
  ok: boolean;
}

/**
 * Options for emitting a TypeScript manifest module.
 */
export interface WriteManifestModuleOptions {
  /** Export identifier to use instead of the edition default. */
  exportName?: string;
  /** Type import specifier written into the generated module. */
  typeImportPath?: string;
}

const EXPECTED_COUNTS: Record<PackEdition, number> = {
  free: 221,
  extra: 404,
};

/**
 * Return the expected GLTF model count for a KayKit pack edition.
 */
export function expectedModelCount(edition: PackEdition): number {
  return EXPECTED_COUNTS[edition];
}

/**
 * Resolve the conventional gitignored source folder for a pack edition.
 */
export function defaultSourceRoot(edition: PackEdition, cwd = process.cwd()): string {
  const suffix =
    edition === 'free'
      ? 'KayKit_Medieval_Hexagon_Pack_1.0_FREE'
      : 'KayKit_Medieval_Hexagon_Pack_1.0_EXTRA';
  return resolve(cwd, 'references', suffix);
}

/**
 * Count local GLTF files and compare them against the known edition count.
 *
 * The helper does not throw when the source is absent, which lets CLI `doctor`
 * and build scripts report a clear local setup status.
 */
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

/**
 * Copy the complete `Assets/gltf` tree into an output folder.
 *
 * Existing output is replaced so generated package assets stay reproducible.
 */
export function copyGltfTree(sourceRoot: string, destinationRoot: string): void {
  const gltfRoot = join(sourceRoot, 'Assets', 'gltf');
  if (!existsSync(gltfRoot)) {
    throw new GameboardIoError(`Missing GLTF source directory: ${gltfRoot}`);
  }

  rmSync(destinationRoot, { recursive: true, force: true });
  mkdirSync(destinationRoot, { recursive: true });

  for (const filePath of listFiles(gltfRoot)) {
    const outputPath = join(destinationRoot, toPosixPath(relative(gltfRoot, filePath)));
    mkdirSync(dirname(outputPath), { recursive: true });
    copyFileSync(filePath, outputPath);
  }
}

/**
 * Generate a normalized manifest by inspecting every GLTF in a local pack.
 *
 * Bounds, buffers, textures, material slots, taxonomy fields, and license
 * metadata are derived from source files and the known KayKit edition.
 */
export function generateManifestFromSource(options: GenerateManifestOptions): MedievalHexagonManifest {
  const assetBasePath = trimSlashes(options.assetBasePath ?? `assets/${options.edition}`);
  const gltfRoot = join(options.sourceRoot, 'Assets', 'gltf');
  if (!existsSync(gltfRoot)) {
    throw new GameboardIoError(`Missing GLTF source directory: ${gltfRoot}`);
  }

  const filePaths = listFiles(gltfRoot, '.gltf').sort((a, b) => a.localeCompare(b));
  const duplicateBaseIds = findDuplicateBaseIds(filePaths);
  const usedIds = new Set<string>();
  const assets = filePaths.map((filePath) => {
    const baseId = basename(filePath, extname(filePath));
    const assetId = allocateAssetId(filePath, gltfRoot, baseId, duplicateBaseIds, usedIds);
    usedIds.add(assetId);
    return assetFromGltf(filePath, gltfRoot, options.edition, assetBasePath, assetId, baseId);
  });
  const assetsById = Object.fromEntries(assets.map((asset) => [asset.id, asset]));

  return {
    schemaVersion: HEX_WORLDS_SCHEMA_VERSION,
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

/**
 * Write a TypeScript module that exports a generated manifest.
 */
export function writeManifestModule(
  manifest: MedievalHexagonManifest,
  outputPath: string,
  options: WriteManifestModuleOptions = {}
): void {
  mkdirSync(dirname(outputPath), { recursive: true });
  const body = JSON.stringify(manifest, null, 2);
  const exportName = options.exportName ?? defaultManifestExportName(manifest.edition);
  if (!isValidIdentifier(exportName)) {
    throw new GameboardManifestError(`Invalid manifest module export name: ${exportName}`);
  }
  const editionLabel = manifest.edition.toUpperCase();
  const typeImport = options.typeImportPath ?? '../types';
  const banner =
    `/**\n` +
    ` * Packaged ${editionLabel} KayKit Medieval Hexagon manifest exported as typed runtime data.\n` +
    ` *\n` +
    ` * @remarks\n` +
    ` * Autogenerated by \`pnpm assets:${manifest.edition}\` — do NOT hand-edit.\n` +
    ` * Drift is caught by \`pnpm test:manifest-drift\` (PRD A3b).\n` +
    ` *\n` +
    ` * @module\n` +
    ` */\n`;
  const loaderName = `load${exportName.charAt(0).toUpperCase()}${exportName.slice(1)}`;
  writeFileSync(
    outputPath,
    `${banner}` +
      `import type { MedievalHexagonManifest } from '${typeImport}';\n\n` +
      `/**\n` +
      ` * Normalized manifest for the ${editionLabel} KayKit Medieval Hexagon assets bundled in the npm package.\n` +
      ` *\n` +
      ` * @remarks\n` +
      ` * Eager export. Consumers that want lazy / async loading should prefer\n` +
      ` * {@link ${loaderName}} instead — same data, Promise-wrapped, identity-stable.\n` +
      ` */\n` +
      `export const ${exportName}: MedievalHexagonManifest = ${body};\n\n` +
      `/**\n` +
      ` * Promise-wrapped accessor for the ${editionLabel} manifest (PRD B2b).\n` +
      ` *\n` +
      ` * The manifest is already in-memory (it's a static literal); this loader exists\n` +
      ` * to give async-first consumers a contract that doesn't change shape once we\n` +
      ` * eventually move the manifest to a JSON-on-disk loader. Identity-stable: every\n` +
      ` * call resolves to the same object reference as the eager {@link ${exportName}}.\n` +
      ` */\n` +
      `export async function ${loaderName}(): Promise<MedievalHexagonManifest> {\n` +
      `  return ${exportName};\n` +
      `}\n\n` +
      `export default ${exportName};\n`,
    'utf8'
  );
}

/**
 * Write a generated manifest as formatted JSON.
 */
export function writeManifestJson(manifest: MedievalHexagonManifest, outputPath: string): void {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function assetFromGltf(
  filePath: string,
  gltfRoot: string,
  edition: PackEdition,
  assetBasePath: string,
  assetId?: string,
  familyId?: string
): MedievalHexagonAsset {
  const sourcePath = toPosixPath(relative(gltfRoot, filePath));
  const segments = sourcePath.split('/');
  const category = parseCategory(segments[0]);
  const subcategory = segments[1] ?? 'root';
  const id = assetId ?? basename(filePath, extname(filePath));
  const sourceId = familyId ?? id;
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
    family: parseFamily(sourceId, category),
    faction: parseFaction(sourceId, subcategory),
    unitStyle: parseUnitStyle(sourceId, category),
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

function findDuplicateBaseIds(filePaths: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const filePath of filePaths) {
    const id = basename(filePath, extname(filePath));
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }
  return duplicates;
}

function allocateAssetId(
  filePath: string,
  gltfRoot: string,
  baseId: string,
  duplicateBaseIds: ReadonlySet<string>,
  usedIds: ReadonlySet<string>
): string {
  if (!duplicateBaseIds.has(baseId) || !usedIds.has(baseId)) {
    return baseId;
  }

  const sourcePath = toPosixPath(relative(gltfRoot, filePath));
  const segments = sourcePath.split('/');
  const category = segments[0] ?? 'asset';
  const subcategory = segments[1] ?? 'root';
  const candidate = `${category}_${subcategory}_${baseId}`;
  if (!usedIds.has(candidate)) {
    return candidate;
  }

  let suffix = 2;
  while (usedIds.has(`${candidate}_${suffix}`)) {
    suffix += 1;
  }
  return `${candidate}_${suffix}`;
}

/**
 * Walks `root` recursively, returning every file (optionally filtered by
 * extension) reachable without crossing a symlink.
 *
 * Phase 2 security review S-H2: `readdirSync(...).isDirectory()` follows
 * directory symlinks, so a hostile source tree with a symlink pointing at
 * `/etc` or back at its own ancestor would either exfiltrate files into
 * the manifest or DoS the walker via a cycle. Defense:
 *
 * - Skip any entry whose `dirent.isSymbolicLink()` returns true. Files
 *   reachable only through a symlink are not part of the asset pack by
 *   construction.
 * - Verify each descended directory's real path stays under the original
 *   root's real path (defends against `name` that bypasses the symlink
 *   check via path normalization).
 */
function listFiles(root: string, extension?: string): string[] {
  return listFilesInternal(root, realpathSync(root), extension);
}

function listFilesInternal(
  dir: string,
  rootRealPath: string,
  extension: string | undefined,
): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }
    const childPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const childReal = realpathSync(childPath);
      if (childReal !== rootRealPath && !childReal.startsWith(`${rootRealPath}${sep}`)) {
        // A non-symlink that still resolves outside the root (e.g. via a
        // bind mount). Skip it rather than crossing the boundary.
        continue;
      }
      files.push(...listFilesInternal(childPath, rootRealPath, extension));
      continue;
    }
    if (!extension || childPath.endsWith(extension)) {
      files.push(childPath);
    }
  }
  return files;
}

function extractBounds(document: GltfDocument): AssetBounds {
  const min: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const max: [number, number, number] = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];

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
      for (const index of [0, 1, 2] as const) {
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
  throw new GameboardManifestError(`Unsupported asset category: ${segment ?? '<missing>'}`);
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
