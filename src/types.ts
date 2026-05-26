/**
 * Shared manifest, edition, category, faction, texture, coordinate, edge, and
 * world-position types used across every public package surface.
 *
 * @module
 */
/**
 * Current manifest schema emitted by the ingest CLI and bundled FREE manifest.
 */
export const MEDIEVAL_HEXAGON_SCHEMA_VERSION = '1.0.0';

/**
 * KayKit Medieval Hexagon pack version represented by this package.
 */
export const KAYKIT_PACK_VERSION = '1.0';

/**
 * Asset editions understood by manifests and package helpers.
 */
export const PACK_EDITIONS = ['free', 'extra'] as const;

/**
 * Manifest edition. `free` assets are published with the package; `extra`
 * assets are local-only and come from the ignored ingest source.
 */
export type PackEdition = (typeof PACK_EDITIONS)[number];

/**
 * Top-level source-pack category used by KayKit's GLTF folder structure.
 */
export const ASSET_CATEGORIES = ['tiles', 'buildings', 'decoration', 'units'] as const;

/**
 * Top-level source-pack category for a manifest asset.
 */
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/**
 * Faction color variants used by KayKit buildings, flags, and units.
 */
export const FACTIONS = ['blue', 'green', 'red', 'yellow'] as const;

/**
 * KayKit faction color identifier.
 */
export type Faction = (typeof FACTIONS)[number];

/**
 * KayKit EXTRA unit style variants.
 */
export const UNIT_STYLES = ['neutral', 'accent', 'full'] as const;

/**
 * Unit style taxonomy for neutral units and EXTRA faction recolors.
 */
export type UnitStyle = (typeof UNIT_STYLES)[number];

/**
 * Texture palettes exposed by the FREE and EXTRA source packs.
 */
export const TEXTURE_SETS = ['default', 'fall', 'summer', 'winter'] as const;

/**
 * Texture palette identifier. The FREE pack only ships `default`; EXTRA ingest
 * can add fall, summer, and winter variants.
 */
export type TextureSet = (typeof TEXTURE_SETS)[number];

/**
 * Axis-aligned model bounds extracted from GLTF accessor min/max values.
 */
export interface AssetBounds {
  /** Minimum x/y/z coordinate in model-local units. */
  min: readonly [number, number, number];
  /** Maximum x/y/z coordinate in model-local units. */
  max: readonly [number, number, number];
  /** Width, height, and depth derived from `max - min`. */
  size: readonly [number, number, number];
}

/**
 * Attribution and provenance for one KayKit source pack edition.
 */
export interface SourcePackInfo {
  /** Human-readable pack name. */
  name: string;
  /** Source pack version. */
  version: string;
  /** Edition represented by the manifest. */
  edition: PackEdition;
  /** Asset creator credited by NOTICE.md and generated manifests. */
  creator: string;
  /** SPDX-style license identifier for KayKit assets. */
  license: 'CC0-1.0';
  /** Canonical license URL. */
  licenseUrl: string;
  /** Local source directory name used during ingest. */
  sourceRootName: string;
}

/**
 * One renderable GLTF asset with normalized taxonomy, paths, bounds, and
 * material metadata.
 */
export interface MedievalHexagonAsset {
  /** Stable asset id, normally the GLTF file name without extension. */
  id: string;
  /** Source edition that owns this asset. */
  edition: PackEdition;
  /** Top-level KayKit category. */
  category: AssetCategory;
  /** Category-specific folder segment, such as `roads`, `blue`, or `nature`. */
  subcategory: string;
  /** Variant family with faction/style suffixes removed where applicable. */
  family: string;
  /** Faction color when the asset is faction-specific. */
  faction?: Faction;
  /** Unit recolor style when the asset belongs to `units`. */
  unitStyle?: UnitStyle;
  /** Texture palette expected by the asset. */
  textureSet: TextureSet;
  /** Package-relative or consumer-resolved model path. */
  modelPath: string;
  /** Source-relative path inside the ingested GLTF tree. */
  sourcePath: string;
  /** Package-relative buffer paths referenced by the GLTF. */
  bufferPaths: readonly string[];
  /** Package-relative texture paths referenced by the GLTF. */
  texturePaths: readonly string[];
  /** Material names discovered from the GLTF. */
  materialSlots: readonly string[];
  /** Extracted model bounds used by fit checks and camera framing. */
  bounds: AssetBounds;
  /** Size of the source GLTF JSON file in bytes. */
  fileSizeBytes: number;
}

/**
 * Manifest asset counts grouped for audit, package validation, and docs.
 */
export interface MedievalHexagonManifestCounts {
  /** Total number of GLTF model records. */
  total: number;
  /** Counts keyed by top-level category. */
  byCategory: Record<string, number>;
  /** Counts keyed as `category/subcategory`. */
  bySubcategory: Record<string, number>;
}

/**
 * Complete normalized asset manifest for one source edition.
 */
export interface MedievalHexagonManifest {
  /** Manifest schema version. */
  schemaVersion: typeof MEDIEVAL_HEXAGON_SCHEMA_VERSION;
  /** Stable generation timestamp used by reproducible package assets. */
  generatedAt: string;
  /** Source edition represented by this manifest. */
  edition: PackEdition;
  /** Attribution and source-pack provenance. */
  sourcePack: SourcePackInfo;
  /** Texture palettes present in this edition. */
  textureSets: readonly TextureSet[];
  /** Ordered asset records. */
  assets: readonly MedievalHexagonAsset[];
  /** Asset lookup by stable id. */
  assetsById: Readonly<Record<string, MedievalHexagonAsset>>;
  /** Derived counts for audit and UI summaries. */
  counts: MedievalHexagonManifestCounts;
}

/**
 * Clockwise flat-top hex edge index, starting from the library's canonical edge
 * zero.
 */
export type HexEdgeIndex = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Edge input accepted by selector and rule helpers.
 */
export type HexEdgeInput = HexEdgeIndex | readonly HexEdgeIndex[] | number;

/**
 * Result of mapping an arbitrary guide edge mask to a canonical asset and
 * rotation.
 */
export interface VariantSelection {
  /** Variant family being selected. */
  family: 'road' | 'river' | 'coast';
  /** Guide label such as `A`, `B`, or `crossing_A`. */
  label: string;
  /** Asset id that should be rendered. */
  assetId: string;
  /** User-requested edge bitmask before canonicalization. */
  inputMask: number;
  /** Canonical edge bitmask represented by the selected asset. */
  canonicalMask: number;
  /** Clockwise 60-degree rotation steps to apply. */
  rotationSteps: number;
  /** Rotation in radians for renderers. */
  rotationRadians: number;
}

/**
 * Axial flat-top hex coordinate.
 */
export interface HexCoordinates {
  /** Axial q column. */
  q: number;
  /** Axial r row. */
  r: number;
}

/**
 * Three-dimensional world-space position used by gameboard plans and renderers.
 */
export interface WorldPosition {
  /** Horizontal x coordinate. */
  x: number;
  /** Vertical y coordinate. */
  y: number;
  /** Horizontal z coordinate. */
  z: number;
}

/**
 * Rectangular board shape supported by grid, recipe, and seeded generation.
 */
export interface RectangleGameboardShape {
  /** Shape discriminator. */
  kind: 'rectangle';
  /** Number of columns. */
  width: number;
  /** Number of rows. */
  height: number;
}

/**
 * Hexagonal board shape supported by grid, recipe, and seeded generation.
 */
export interface HexagonGameboardShape {
  /** Shape discriminator. */
  kind: 'hexagon';
  /** Radius in rings around the origin. */
  radius: number;
}

/**
 * Serializable board shape supported by grid, recipe, and seeded generation.
 */
export type GameboardShape = RectangleGameboardShape | HexagonGameboardShape;
