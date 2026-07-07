/**
 * `src/overlay/` — overlay placement transforms (RFC 0001 RFC0-OVERLAY).
 *
 * Pure, renderer-free composition of a size-normalization + tile position + dev controls
 * (anchor / offset / rotation / scale) into a final AssetTransform. Surfaced on the
 * umbrella + `declarative-hex-worlds/overlay`.
 *
 * @module
 */
export {
  type OverlayAnchor,
  type OverlayControls,
  overlayTransform,
} from './overlay';
