/**
 * `src/overlay/overlay.ts` — overlay placement transforms (RFC 0001 RFC0-OVERLAY).
 *
 * Compose a size-normalization (RFC0-NORM) with a tile's world position + dev-controllable
 * controls (anchor within the cell, offset, rotation, scale multiplier) into a final
 * `AssetTransform`. This is how a model/building from pack B lands correctly on a tile
 * from pack A: scale-normalize, recenter, anchor, then nudge. Pure + renderer-free — a
 * binding applies the resulting transform to its node.
 *
 * @module
 */
import { KAYKIT_HEX_DEPTH, KAYKIT_HEX_WIDTH } from '../coordinates';
import type { AssetTransform } from '../asset-source';
import type { Normalization } from '../normalize';
import type { WorldPosition } from '../types';

/**
 * Where on the cell the asset anchors, as a fraction of the cell (0.5,0.5 = center;
 * 0,0 = a corner). Applied on the board plane (x = width, z = depth) before offset.
 */
export interface OverlayAnchor {
  readonly x?: number;
  readonly z?: number;
}

/** Dev-controllable overlay controls layered on top of the normalization. */
export interface OverlayControls {
  /** Anchor within the cell (default center 0.5,0.5). */
  readonly anchor?: OverlayAnchor;
  /** Additional world-space nudge applied after anchoring. */
  readonly offset?: Partial<WorldPosition>;
  /** Additional Y rotation (radians) on top of the placement rotation. */
  readonly rotationY?: number;
  /** Multiplier on the normalized scale (1 = normalized size). */
  readonly scale?: number;
  /** The cell the anchor is measured against (default KayKit hex). */
  readonly cell?: { readonly width?: number; readonly depth?: number };
}

/**
 * Compose a normalized asset onto a tile at `tilePosition` with overlay controls, yielding
 * the final `AssetTransform`. Order: normalized recenter → anchor within the cell → tile
 * position → dev offset; scale = normalized × control multiplier; rotation = base + control.
 */
export function overlayTransform(
  tilePosition: WorldPosition,
  normalization: Normalization,
  controls: OverlayControls = {},
  base: { rotationY?: number } = {}
): AssetTransform {
  const cellWidth = controls.cell?.width ?? KAYKIT_HEX_WIDTH;
  const cellDepth = controls.cell?.depth ?? KAYKIT_HEX_DEPTH;
  const anchorX = controls.anchor?.x ?? 0.5;
  const anchorZ = controls.anchor?.z ?? 0.5;
  // Anchor as a signed offset from the cell center (0.5,0.5 → 0).
  const anchorOffsetX = (anchorX - 0.5) * cellWidth;
  const anchorOffsetZ = (anchorZ - 0.5) * cellDepth;
  const scaleMul = controls.scale ?? 1;

  return {
    position: {
      x:
        tilePosition.x +
        normalization.offset.x +
        anchorOffsetX +
        (controls.offset?.x ?? 0),
      y: tilePosition.y + normalization.offset.y + (controls.offset?.y ?? 0),
      z:
        tilePosition.z +
        normalization.offset.z +
        anchorOffsetZ +
        (controls.offset?.z ?? 0),
    },
    rotationY: (base.rotationY ?? 0) + (controls.rotationY ?? 0),
    scale: normalization.scale * scaleMul,
  };
}
