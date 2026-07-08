/**
 * `src/asset-source/` — the source-agnostic, Zod-validated AssetSourceSpec
 * (RFC 0001 G0) and (later) the AssetSource interface + tileset/gltf-pack
 * implementations that resolve placements against a spec.
 *
 * Public surface re-exported from the umbrella `declarative-hex-worlds` and the
 * `declarative-hex-worlds/asset-source` subpath. Cross-domain consumers MUST
 * import from this barrel — never reach into a sibling file.
 *
 * @module
 */

export { createGltfPackSource, type GltfPackSourceOptions } from './gltf-pack';
// NOTE: the imperative RenderBackend seam (render-backend.ts) was superseded by the
// signals+bindings architecture (koota traits ARE the signals; bindings subscribe).
export {
  createGameboardPlacementAssetUrlResolver,
  type GameboardPlacementAnimationUrlOptions,
  type GameboardPlacementAssetUrlOptions,
  type GameboardPlacementAssetUrlResolver,
  resolveAssetUrl,
  resolveAssetUrlById,
  resolveGameboardPlacementAnimationUrl,
  resolveGameboardPlacementAssetUrl,
  transformForHex,
  transformForPlacement,
  transformForVariant,
} from './placement-resolution';
export {
  inferTilesetGrid,
  type PngDimensions,
  readPngDimensions,
} from './png-dimensions';
export {
  assetIdFromPath,
  BIOME_KEYWORDS,
  buildAssetSourceSpec,
  guessGameplayCategory,
  guessTileBiome,
  type ScannedAsset,
  type ScannedFile,
  type ScanResult,
  scanAssetFiles,
  stripAssetCategory,
} from './scan';
export type {
  AssetDimension,
  AssetRenderRequest,
  AssetSource,
  AssetTint,
  AssetTransform,
  CellRect,
  HexDims,
  ResolveContext,
} from './source';
export { combineSources } from './source';
export {
  ASSET_FORMATS,
  ASSET_ROLES,
  type AssetFormat,
  type AssetGrid,
  type AssetRole,
  type AssetSourceSpec,
  type AssetSpec,
  assetSchema,
  assetSourceSpecSchema,
  GAMEPLAY_CATEGORIES,
  type GameplayCategory,
  parseAssetSourceSpec,
  safeParseAssetSourceSpec,
} from './spec';
export { type CreateSourceFromSpecOptions, createSourceFromSpec } from './spec-source';
export {
  cellRect,
  createTilesetSource,
  readTintOpacity,
  type TilesetSourceOptions,
  tilesetHexGeometry,
} from './tileset';
export {
  parseTilesetManifest,
  safeParseTilesetManifest,
  TILESET_BIOME_SELECTORS,
  TILESET_SHEET_ROLES,
  type TilesetBiome,
  type TilesetBiomeSelector,
  type TilesetGrid,
  type TilesetManifest,
  type TilesetSheet,
  type TilesetSheetRole,
  tilesetManifestSchema,
} from './tileset-manifest';
