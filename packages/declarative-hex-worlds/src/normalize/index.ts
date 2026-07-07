/**
 * `src/normalize/` — cross-pack size normalization (RFC 0001 RFC0-NORM).
 *
 * Pure, renderer-free math that fits an asset's native bounds onto a board cell, so
 * assets from different makers share one board. Surfaced on the umbrella +
 * `declarative-hex-worlds/normalize`.
 *
 * @module
 */
export {
  type NormalizeFit,
  type NormalizeOptions,
  type NormalizeTarget,
  type Normalization,
  normalizeAssetToCell,
  normalizedFootprint,
} from './normalize';
