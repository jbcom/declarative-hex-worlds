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
export {
  ASSET_FORMATS,
  ASSET_ROLES,
  type AssetFormat,
  type AssetGrid,
  type AssetRole,
  type AssetSpec,
  type AssetSourceSpec,
  assetSchema,
  assetSourceSpecSchema,
  parseAssetSourceSpec,
  safeParseAssetSourceSpec,
} from './spec';
export {
  type AssetDimension,
  type AssetRenderRequest,
  type AssetSource,
  type AssetTransform,
  type CellRect,
  type HexDims,
  type ResolveContext,
} from './source';
// NOTE: the imperative RenderBackend seam (render-backend.ts) was superseded by the
// signals+bindings architecture (koota traits ARE the signals; bindings subscribe).
export {
  type GameboardPlacementAnimationUrlOptions,
  type GameboardPlacementAssetUrlOptions,
  type GameboardPlacementAssetUrlResolver,
  createGameboardPlacementAssetUrlResolver,
  resolveAssetUrl,
  resolveGameboardPlacementAnimationUrl,
  resolveGameboardPlacementAssetUrl,
  transformForHex,
  transformForPlacement,
  transformForVariant,
} from './placement-resolution';
export {
  type ScanResult,
  type ScannedAsset,
  type ScannedFile,
  assetIdFromPath,
  buildAssetSourceSpec,
  guessTileBiome,
  scanAssetFiles,
} from './scan';
export { type GltfPackSourceOptions, createGltfPackSource } from './gltf-pack';
export { type TilesetSourceOptions, cellRect, createTilesetSource } from './tileset';
export {
  TILESET_BIOME_SELECTORS,
  TILESET_SHEET_ROLES,
  type TilesetBiome,
  type TilesetBiomeSelector,
  type TilesetGrid,
  type TilesetManifest,
  type TilesetSheet,
  type TilesetSheetRole,
  parseTilesetManifest,
  safeParseTilesetManifest,
  tilesetManifestSchema,
} from './tileset-manifest';
