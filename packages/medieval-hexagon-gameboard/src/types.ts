export const MEDIEVAL_HEXAGON_SCHEMA_VERSION = '1.0.0';
export const KAYKIT_PACK_VERSION = '1.0';

export const PACK_EDITIONS = ['free', 'extra'] as const;
export type PackEdition = (typeof PACK_EDITIONS)[number];

export const ASSET_CATEGORIES = ['tiles', 'buildings', 'decoration', 'units'] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const FACTIONS = ['blue', 'green', 'red', 'yellow'] as const;
export type Faction = (typeof FACTIONS)[number];

export const UNIT_STYLES = ['neutral', 'accent', 'full'] as const;
export type UnitStyle = (typeof UNIT_STYLES)[number];

export const TEXTURE_SETS = ['default', 'fall', 'summer', 'winter'] as const;
export type TextureSet = (typeof TEXTURE_SETS)[number];

export interface AssetBounds {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  size: readonly [number, number, number];
}

export interface SourcePackInfo {
  name: string;
  version: string;
  edition: PackEdition;
  creator: string;
  license: 'CC0-1.0';
  licenseUrl: string;
  sourceRootName: string;
}

export interface MedievalHexagonAsset {
  id: string;
  edition: PackEdition;
  category: AssetCategory;
  subcategory: string;
  family: string;
  faction?: Faction;
  unitStyle?: UnitStyle;
  textureSet: TextureSet;
  modelPath: string;
  sourcePath: string;
  bufferPaths: readonly string[];
  texturePaths: readonly string[];
  materialSlots: readonly string[];
  bounds: AssetBounds;
  fileSizeBytes: number;
}

export interface MedievalHexagonManifestCounts {
  total: number;
  byCategory: Record<string, number>;
  bySubcategory: Record<string, number>;
}

export interface MedievalHexagonManifest {
  schemaVersion: typeof MEDIEVAL_HEXAGON_SCHEMA_VERSION;
  generatedAt: string;
  edition: PackEdition;
  sourcePack: SourcePackInfo;
  textureSets: readonly TextureSet[];
  assets: readonly MedievalHexagonAsset[];
  assetsById: Readonly<Record<string, MedievalHexagonAsset>>;
  counts: MedievalHexagonManifestCounts;
}

export type HexEdgeIndex = 0 | 1 | 2 | 3 | 4 | 5;
export type HexEdgeInput = HexEdgeIndex | readonly HexEdgeIndex[] | number;

export interface VariantSelection {
  family: 'road' | 'river' | 'coast';
  label: string;
  assetId: string;
  inputMask: number;
  canonicalMask: number;
  rotationSteps: number;
  rotationRadians: number;
}

export interface HexCoordinates {
  q: number;
  r: number;
}

export interface WorldPosition {
  x: number;
  y: number;
  z: number;
}

export type GameboardShape =
  | { kind: 'rectangle'; width: number; height: number }
  | { kind: 'hexagon'; radius: number };
