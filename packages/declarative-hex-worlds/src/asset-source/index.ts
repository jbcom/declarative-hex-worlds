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
