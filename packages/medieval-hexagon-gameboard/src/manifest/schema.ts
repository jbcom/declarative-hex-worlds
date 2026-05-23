/**
 * Manifest schema, normalization, lookup, validation, URL resolution, and bundle
 * helpers for packaged FREE assets plus app-local EXTRA manifests.
 *
 * @module
 */
import {
  ASSET_CATEGORIES,
  FACTIONS,
  MEDIEVAL_HEXAGON_SCHEMA_VERSION,
  PACK_EDITIONS,
  TEXTURE_SETS,
  UNIT_STYLES,
  type AssetCategory,
  type Faction,
  type MedievalHexagonAsset,
  type MedievalHexagonManifest,
  type MedievalHexagonManifestCounts,
  type PackEdition,
  type SourcePackInfo,
  type TextureSet,
  type UnitStyle,
} from '../types';

export {
  ASSET_CATEGORIES,
  FACTIONS,
  KAYKIT_PACK_VERSION,
  MEDIEVAL_HEXAGON_SCHEMA_VERSION,
  PACK_EDITIONS,
  TEXTURE_SETS,
  UNIT_STYLES,
} from '../types';

export type {
  AssetBounds,
  AssetCategory,
  Faction,
  HexCoordinates,
  HexEdgeIndex,
  HexEdgeInput,
  MedievalHexagonAsset,
  MedievalHexagonManifest,
  MedievalHexagonManifestCounts,
  PackEdition,
  SourcePackInfo,
  TextureSet,
  UnitStyle,
  VariantSelection,
  WorldPosition,
} from '../types';

/**
 * Attribution metadata applied to generated manifests and NOTICE guidance.
 */
export interface KayKitAttribution {
  /** Creator credited by generated manifests and package NOTICE text. */
  creator: string;
  /** Public creator or KayKit website URL. */
  website: string;
  /** SPDX-style asset license label. */
  license: 'CC0-1.0';
  /** Canonical URL for the asset license terms. */
  licenseUrl: string;
}

/**
 * Canonical attribution metadata for KayKit Medieval Hexagon assets.
 */
export const KAYKIT_ATTRIBUTION: Readonly<KayKitAttribution> = {
  creator: 'Kay Lousberg',
  website: 'https://www.kaylousberg.com',
  license: 'CC0-1.0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
};

/**
 * Combined view over one or more edition manifests.
 */
export interface MedievalHexagonManifestBundle {
  /** Bundle schema version. */
  schemaVersion: typeof MEDIEVAL_HEXAGON_SCHEMA_VERSION;
  /** Normalized source manifests included in the bundle. */
  manifests: readonly MedievalHexagonManifest[];
  /** Editions present in the bundle. */
  editions: readonly PackEdition[];
  /** Texture sets present across all manifests. */
  textureSets: readonly TextureSet[];
  /** Source-pack attribution records. */
  sourcePacks: readonly SourcePackInfo[];
  /** De-duplicated assets selected according to duplicate preference. */
  assets: readonly MedievalHexagonAsset[];
  /** De-duplicated asset lookup by id. */
  assetsById: Readonly<Record<string, MedievalHexagonAsset>>;
  /** Counts derived from de-duplicated assets. */
  counts: MedievalHexagonManifestCounts;
  /** Asset ids that appeared in more than one manifest. */
  duplicateAssetIds: readonly string[];
}

/**
 * Catalog accepted by lookup helpers: either one edition manifest or a combined
 * FREE/EXTRA bundle.
 */
export type ManifestAssetCatalog = MedievalHexagonManifest | MedievalHexagonManifestBundle;

/**
 * Strategy for resolving duplicate asset ids when combining manifests.
 */
export type ManifestDuplicatePreference = 'first' | 'last' | 'free' | 'extra';

/**
 * Options for `createManifestBundle`.
 */
export interface CreateManifestBundleOptions {
  /** Duplicate resolution strategy. Defaults to `last`. */
  duplicatePreference?: ManifestDuplicatePreference;
}

/**
 * Field filters for manifest asset queries.
 */
export interface ManifestAssetSelection {
  /** Match exact asset ids. */
  ids?: readonly string[];
  /** Match source editions. */
  editions?: readonly PackEdition[];
  /** Match top-level categories. */
  categories?: readonly AssetCategory[];
  /** Match category-specific subcategories. */
  subcategories?: readonly string[];
  /** Match normalized asset families. */
  families?: readonly string[];
  /** Match faction-colored assets. */
  factions?: readonly Faction[];
  /** Match unit styles. */
  unitStyles?: readonly UnitStyle[];
  /** Match texture palettes. */
  textureSets?: readonly TextureSet[];
}

/**
 * URL resolution options for manifest assets.
 */
export interface ManifestAssetUrlOptions {
  /** Base URL applied to every model path when no edition-specific base exists. */
  baseUrl?: string | URL;
  /** Per-edition base URLs, useful when FREE is packaged and EXTRA is local. */
  editionBaseUrls?: Partial<Record<PackEdition, string | URL>>;
}

/**
 * Severity emitted by manifest inspection.
 */
export type MedievalHexagonManifestIssueSeverity = 'error' | 'warning';

/**
 * One manifest validation issue.
 */
export interface MedievalHexagonManifestIssue {
  /** Stable issue code for tests and CLI output. */
  code: string;
  /** Whether the issue blocks a normalized manifest. */
  severity: MedievalHexagonManifestIssueSeverity;
  /** Human-readable explanation. */
  message: string;
  /** Optional JSON path. */
  path?: string;
  /** Optional asset id associated with the issue. */
  assetId?: string;
}

/**
 * Result of validating and normalizing a manifest-like object.
 */
export interface MedievalHexagonManifestInspection {
  /** Normalized manifest when no errors were found. */
  manifest?: MedievalHexagonManifest;
  /** All validation issues. */
  issues: readonly MedievalHexagonManifestIssue[];
  /** Number of error-severity issues. */
  errorCount: number;
  /** Number of warning-severity issues. */
  warningCount: number;
}

/**
 * Validates an unknown value and returns a normalized manifest when possible.
 */
export function inspectMedievalHexagonManifest(input: unknown): MedievalHexagonManifestInspection {
  const issues: MedievalHexagonManifestIssue[] = [];
  if (!isRecord(input)) {
    issues.push({
      code: 'manifest.object',
      severity: 'error',
      path: '$',
      message: 'Manifest must be a JSON object',
    });
    return inspectionResult(undefined, issues);
  }

  validateManifestHeader(input, issues);
  const assets = Array.isArray(input.assets) ? input.assets : undefined;
  if (!assets) {
    issues.push({
      code: 'manifest.assets',
      severity: 'error',
      path: '$.assets',
      message: 'Manifest assets must be an array',
    });
  } else {
    validateManifestAssets(assets, input.edition, issues);
  }

  const hasErrors = issues.some((issue) => issue.severity === 'error');
  if (hasErrors) {
    return inspectionResult(undefined, issues);
  }

  const manifest = normalizeMedievalHexagonManifest(input as unknown as MedievalHexagonManifest);
  validateManifestIndexes(input, manifest, issues);
  return inspectionResult(manifest, issues);
}

/**
 * Returns only the validation issues for an unknown manifest-like value.
 */
export function validateMedievalHexagonManifest(input: unknown): MedievalHexagonManifestIssue[] {
  return [...inspectMedievalHexagonManifest(input).issues];
}

/**
 * Rebuilds manifest indexes, counts, and texture-set ordering from the manifest
 * asset list.
 */
export function normalizeMedievalHexagonManifest(manifest: MedievalHexagonManifest): MedievalHexagonManifest {
  const assets = [...manifest.assets];
  return {
    ...manifest,
    textureSets: TEXTURE_SETS.filter((textureSet) => manifest.textureSets.includes(textureSet)),
    assets,
    assetsById: Object.fromEntries(assets.map((asset) => [asset.id, asset])),
    counts: countManifestAssets(assets),
  };
}

/**
 * Combines multiple edition manifests into one lookup catalog.
 */
export function createManifestBundle(
  manifests: readonly MedievalHexagonManifest[],
  options: CreateManifestBundleOptions = {}
): MedievalHexagonManifestBundle {
  const normalized = manifests.map(normalizeMedievalHexagonManifest);
  const duplicatePreference = options.duplicatePreference ?? 'last';
  const assetsById = new Map<string, MedievalHexagonAsset>();
  const duplicateAssetIds = new Set<string>();

  for (const manifest of normalized) {
    for (const asset of manifest.assets) {
      const existing = assetsById.get(asset.id);
      if (existing) {
        duplicateAssetIds.add(asset.id);
      }
      if (!existing || shouldReplaceDuplicate(existing, asset, duplicatePreference)) {
        assetsById.set(asset.id, asset);
      }
    }
  }

  const assets = [...assetsById.values()].sort((left, right) => left.id.localeCompare(right.id));
  const editionSet = new Set(normalized.map((manifest) => manifest.edition));
  const textureSet = new Set(normalized.flatMap((manifest) => manifest.textureSets));

  return {
    schemaVersion: MEDIEVAL_HEXAGON_SCHEMA_VERSION,
    manifests: normalized,
    editions: PACK_EDITIONS.filter((edition) => editionSet.has(edition)),
    textureSets: TEXTURE_SETS.filter((texture) => textureSet.has(texture)),
    sourcePacks: normalized.map((manifest) => manifest.sourcePack),
    assets,
    assetsById: Object.fromEntries(assets.map((asset) => [asset.id, asset])),
    counts: countManifestAssets(assets),
    duplicateAssetIds: [...duplicateAssetIds].sort(),
  };
}

/**
 * Selects manifest assets by id, edition, taxonomy, faction, unit style, or
 * texture set.
 */
export function selectManifestAssets(
  catalog: ManifestAssetCatalog,
  selection: ManifestAssetSelection = {}
): MedievalHexagonAsset[] {
  return catalog.assets.filter((asset) => {
    if (selection.ids && !selection.ids.includes(asset.id)) {
      return false;
    }
    if (selection.editions && !selection.editions.includes(asset.edition)) {
      return false;
    }
    if (selection.categories && !selection.categories.includes(asset.category)) {
      return false;
    }
    if (selection.subcategories && !selection.subcategories.includes(asset.subcategory)) {
      return false;
    }
    if (selection.families && !selection.families.includes(asset.family)) {
      return false;
    }
    if (selection.factions && (!asset.faction || !selection.factions.includes(asset.faction))) {
      return false;
    }
    if (selection.unitStyles && (!asset.unitStyle || !selection.unitStyles.includes(asset.unitStyle))) {
      return false;
    }
    if (selection.textureSets && !selection.textureSets.includes(asset.textureSet)) {
      return false;
    }
    return true;
  });
}

/**
 * Looks up an asset in a manifest or bundle by stable asset id.
 */
export function getManifestAsset(
  catalog: ManifestAssetCatalog,
  assetId: string
): MedievalHexagonAsset | undefined {
  return catalog.assetsById[assetId];
}

/**
 * Returns true when a manifest or bundle contains the requested asset id.
 */
export function hasManifestAsset(catalog: ManifestAssetCatalog, assetId: string): boolean {
  return getManifestAsset(catalog, assetId) !== undefined;
}

/**
 * Returns true for any asset that is not supplied by the published FREE edition.
 */
export function manifestAssetRequiresExtra(catalog: ManifestAssetCatalog, assetId: string): boolean {
  return getManifestAsset(catalog, assetId)?.edition !== 'free';
}

/**
 * Resolves a manifest model path against a base URL.
 */
export function resolveManifestAssetUrl(
  asset: MedievalHexagonAsset,
  options: ManifestAssetUrlOptions = {}
): string {
  const baseUrl = options.editionBaseUrls?.[asset.edition] ?? options.baseUrl;
  if (!baseUrl) {
    return asset.modelPath;
  }
  return joinUrl(baseUrl, asset.modelPath);
}

function shouldReplaceDuplicate(
  existing: MedievalHexagonAsset,
  next: MedievalHexagonAsset,
  preference: ManifestDuplicatePreference
): boolean {
  switch (preference) {
    case 'first':
      return false;
    case 'last':
      return true;
    case 'free':
      return existing.edition !== 'free' && next.edition === 'free';
    case 'extra':
      return existing.edition !== 'extra' && next.edition === 'extra';
  }
}

function countManifestAssets(assets: readonly MedievalHexagonAsset[]): MedievalHexagonManifestCounts {
  const byCategory: Record<string, number> = {};
  const bySubcategory: Record<string, number> = {};
  for (const asset of assets) {
    byCategory[asset.category] = (byCategory[asset.category] ?? 0) + 1;
    const subcategoryKey = `${asset.category}/${asset.subcategory}`;
    bySubcategory[subcategoryKey] = (bySubcategory[subcategoryKey] ?? 0) + 1;
  }
  return {
    total: assets.length,
    byCategory,
    bySubcategory,
  };
}

function validateManifestHeader(manifest: Record<string, unknown>, issues: MedievalHexagonManifestIssue[]): void {
  if (manifest.schemaVersion !== MEDIEVAL_HEXAGON_SCHEMA_VERSION) {
    issues.push({
      code: 'manifest.schema_version',
      severity: 'error',
      path: '$.schemaVersion',
      message: `Manifest schemaVersion must be ${MEDIEVAL_HEXAGON_SCHEMA_VERSION}`,
    });
  }
  if (!isPackEdition(manifest.edition)) {
    issues.push({
      code: 'manifest.edition',
      severity: 'error',
      path: '$.edition',
      message: `Manifest edition must be one of ${PACK_EDITIONS.join(', ')}`,
    });
  }
  if (!isRecord(manifest.sourcePack)) {
    issues.push({
      code: 'manifest.source_pack',
      severity: 'error',
      path: '$.sourcePack',
      message: 'Manifest sourcePack must be an object',
    });
  } else {
    for (const key of ['name', 'version', 'creator', 'license', 'licenseUrl', 'sourceRootName']) {
      if (!isNonEmptyString(manifest.sourcePack[key])) {
        issues.push({
          code: 'manifest.source_pack_field',
          severity: 'error',
          path: `$.sourcePack.${key}`,
          message: `Manifest sourcePack.${key} must be a non-empty string`,
        });
      }
    }
    if (!isPackEdition(manifest.sourcePack.edition)) {
      issues.push({
        code: 'manifest.source_pack_edition',
        severity: 'error',
        path: '$.sourcePack.edition',
        message: `Manifest sourcePack.edition must be one of ${PACK_EDITIONS.join(', ')}`,
      });
    } else if (isPackEdition(manifest.edition) && manifest.sourcePack.edition !== manifest.edition) {
      issues.push({
        code: 'manifest.source_pack_edition_mismatch',
        severity: 'error',
        path: '$.sourcePack.edition',
        message: `Manifest sourcePack.edition ${manifest.sourcePack.edition} does not match manifest edition ${manifest.edition}`,
      });
    }
  }
  if (!Array.isArray(manifest.textureSets)) {
    issues.push({
      code: 'manifest.texture_sets',
      severity: 'error',
      path: '$.textureSets',
      message: 'Manifest textureSets must be an array',
    });
    return;
  }
  for (const [index, textureSet] of manifest.textureSets.entries()) {
    if (!isTextureSet(textureSet)) {
      issues.push({
        code: 'manifest.texture_set',
        severity: 'error',
        path: `$.textureSets[${index}]`,
        message: `Manifest texture set ${String(textureSet)} is not supported`,
      });
    }
  }
}

function validateManifestAssets(
  assets: readonly unknown[],
  manifestEdition: unknown,
  issues: MedievalHexagonManifestIssue[]
): void {
  const assetIds = new Set<string>();
  for (const [index, asset] of assets.entries()) {
    const path = `$.assets[${index}]`;
    if (!isRecord(asset)) {
      issues.push({
        code: 'manifest.asset_object',
        severity: 'error',
        path,
        message: 'Manifest asset must be an object',
      });
      continue;
    }

    const assetId = isNonEmptyString(asset.id) ? asset.id : undefined;
    if (!assetId) {
      issues.push({
        code: 'manifest.asset_id',
        severity: 'error',
        path: `${path}.id`,
        message: 'Manifest asset id must be a non-empty string',
      });
    } else if (assetIds.has(assetId)) {
      issues.push({
        code: 'manifest.asset_duplicate',
        severity: 'error',
        path: `${path}.id`,
        assetId,
        message: `Manifest asset id ${assetId} is declared more than once`,
      });
    } else {
      assetIds.add(assetId);
    }

    validateAssetEnum(asset.edition, isPackEdition, 'edition', `${path}.edition`, issues, assetId);
    if (isPackEdition(manifestEdition) && isPackEdition(asset.edition) && asset.edition !== manifestEdition) {
      issues.push({
        code: 'manifest.asset_edition_mismatch',
        severity: 'error',
        path: `${path}.edition`,
        assetId,
        message: `Manifest asset ${assetId ?? '<unknown>'} uses edition ${asset.edition}; expected ${manifestEdition}`,
      });
    }
    validateAssetEnum(asset.category, isAssetCategory, 'category', `${path}.category`, issues, assetId);
    validateAssetEnum(asset.textureSet, isTextureSet, 'textureSet', `${path}.textureSet`, issues, assetId);
    if (asset.faction !== undefined) {
      validateAssetEnum(asset.faction, isFaction, 'faction', `${path}.faction`, issues, assetId);
    }
    if (asset.unitStyle !== undefined) {
      validateAssetEnum(asset.unitStyle, isUnitStyle, 'unitStyle', `${path}.unitStyle`, issues, assetId);
    }
    for (const key of ['subcategory', 'family', 'modelPath', 'sourcePath']) {
      if (!isNonEmptyString(asset[key])) {
        issues.push({
          code: 'manifest.asset_field',
          severity: 'error',
          path: `${path}.${key}`,
          assetId,
          message: `Manifest asset ${assetId ?? '<unknown>'} ${key} must be a non-empty string`,
        });
      }
    }
    for (const key of ['bufferPaths', 'texturePaths', 'materialSlots']) {
      if (!Array.isArray(asset[key])) {
        issues.push({
          code: 'manifest.asset_array_field',
          severity: 'error',
          path: `${path}.${key}`,
          assetId,
          message: `Manifest asset ${assetId ?? '<unknown>'} ${key} must be an array`,
        });
      }
    }
    validateAssetBounds(asset.bounds, path, issues, assetId);
    if (typeof asset.fileSizeBytes !== 'number' || !Number.isFinite(asset.fileSizeBytes) || asset.fileSizeBytes < 0) {
      issues.push({
        code: 'manifest.asset_file_size',
        severity: 'error',
        path: `${path}.fileSizeBytes`,
        assetId,
        message: `Manifest asset ${assetId ?? '<unknown>'} fileSizeBytes must be a non-negative number`,
      });
    }
  }
}

function validateManifestIndexes(
  rawManifest: Record<string, unknown>,
  normalized: MedievalHexagonManifest,
  issues: MedievalHexagonManifestIssue[]
): void {
  const rawCounts = rawManifest.counts;
  if (!isRecord(rawCounts)) {
    issues.push({
      code: 'manifest.counts',
      severity: 'warning',
      path: '$.counts',
      message: 'Manifest counts are missing or malformed; normalize before publishing',
    });
  } else if (!sameManifestCounts(rawCounts, normalized.counts)) {
    issues.push({
      code: 'manifest.counts_stale',
      severity: 'warning',
      path: '$.counts',
      message: 'Manifest counts do not match assets; normalize before publishing',
    });
  }

  const rawAssetsById = rawManifest.assetsById;
  if (!isRecord(rawAssetsById)) {
    issues.push({
      code: 'manifest.assets_by_id',
      severity: 'warning',
      path: '$.assetsById',
      message: 'Manifest assetsById is missing or malformed; normalize before publishing',
    });
    return;
  }
  const rawIds = Object.keys(rawAssetsById).sort();
  const normalizedIds = Object.keys(normalized.assetsById).sort();
  if (rawIds.join('\0') !== normalizedIds.join('\0')) {
    issues.push({
      code: 'manifest.assets_by_id_stale',
      severity: 'warning',
      path: '$.assetsById',
      message: 'Manifest assetsById keys do not match assets; normalize before publishing',
    });
  }
}

function sameManifestCounts(rawCounts: Record<string, unknown>, expected: MedievalHexagonManifestCounts): boolean {
  return (
    rawCounts.total === expected.total &&
    sameNumberRecord(rawCounts.byCategory, expected.byCategory) &&
    sameNumberRecord(rawCounts.bySubcategory, expected.bySubcategory)
  );
}

function sameNumberRecord(input: unknown, expected: Readonly<Record<string, number>>): boolean {
  if (!isRecord(input)) {
    return false;
  }
  const inputEntries = Object.entries(input).sort(([left], [right]) => left.localeCompare(right));
  const expectedEntries = Object.entries(expected).sort(([left], [right]) => left.localeCompare(right));
  return (
    inputEntries.length === expectedEntries.length &&
    inputEntries.every(([key, value], index) => key === expectedEntries[index]?.[0] && value === expectedEntries[index]?.[1])
  );
}

function validateAssetBounds(
  bounds: unknown,
  assetPath: string,
  issues: MedievalHexagonManifestIssue[],
  assetId: string | undefined
): void {
  if (!isRecord(bounds)) {
    issues.push({
      code: 'manifest.asset_bounds',
      severity: 'error',
      path: `${assetPath}.bounds`,
      assetId,
      message: `Manifest asset ${assetId ?? '<unknown>'} bounds must be an object`,
    });
    return;
  }
  for (const key of ['min', 'max', 'size']) {
    const value = bounds[key];
    if (!isNumberTriple(value)) {
      issues.push({
        code: 'manifest.asset_bounds_vector',
        severity: 'error',
        path: `${assetPath}.bounds.${key}`,
        assetId,
        message: `Manifest asset ${assetId ?? '<unknown>'} bounds.${key} must be three finite numbers`,
      });
    }
  }
  if (isNumberTriple(bounds.size) && Math.max(...bounds.size) <= 0) {
    issues.push({
      code: 'manifest.asset_empty_bounds',
      severity: 'warning',
      path: `${assetPath}.bounds.size`,
      assetId,
      message: `Manifest asset ${assetId ?? '<unknown>'} has empty bounds`,
    });
  }
}

function validateAssetEnum<T extends string>(
  value: unknown,
  guard: (input: unknown) => input is T,
  label: string,
  path: string,
  issues: MedievalHexagonManifestIssue[],
  assetId: string | undefined
): void {
  if (!guard(value)) {
    issues.push({
      code: `manifest.asset_${label}`,
      severity: 'error',
      path,
      assetId,
      message: `Manifest asset ${assetId ?? '<unknown>'} ${label} is invalid: ${String(value)}`,
    });
  }
}

function inspectionResult(
  manifest: MedievalHexagonManifest | undefined,
  issues: readonly MedievalHexagonManifestIssue[]
): MedievalHexagonManifestInspection {
  return {
    manifest,
    issues,
    errorCount: issues.filter((issue) => issue.severity === 'error').length,
    warningCount: issues.filter((issue) => issue.severity === 'warning').length,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNumberTriple(value: unknown): value is readonly [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));
}

function isPackEdition(value: unknown): value is PackEdition {
  return typeof value === 'string' && (PACK_EDITIONS as readonly string[]).includes(value);
}

function isAssetCategory(value: unknown): value is AssetCategory {
  return typeof value === 'string' && (ASSET_CATEGORIES as readonly string[]).includes(value);
}

function isTextureSet(value: unknown): value is TextureSet {
  return typeof value === 'string' && (TEXTURE_SETS as readonly string[]).includes(value);
}

function isFaction(value: unknown): value is Faction {
  return typeof value === 'string' && (FACTIONS as readonly string[]).includes(value);
}

function isUnitStyle(value: unknown): value is UnitStyle {
  return typeof value === 'string' && (UNIT_STYLES as readonly string[]).includes(value);
}

function joinUrl(baseUrl: string | URL, path: string): string {
  const cleanPath = path.replace(/^\/+/, '');
  if (baseUrl instanceof URL) {
    return new URL(cleanPath, baseUrl).toString();
  }
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(baseUrl)) {
    return new URL(cleanPath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
  }
  return `${baseUrl.replace(/\/+$/, '')}/${cleanPath}`;
}
