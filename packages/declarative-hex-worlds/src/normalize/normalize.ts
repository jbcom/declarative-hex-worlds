/**
 * `src/normalize/normalize.ts` — cross-pack size normalization (RFC 0001 RFC0-NORM).
 *
 * Assets from different makers ship at different native scales — a KayKit hex tile, a
 * Kenney building, a Quaternius prop all have their own model-local units. To place them
 * on ONE board, each must be normalized to the board's cell size. This module is the
 * pure math: given an asset's `AssetBounds` + a fit mode, compute a uniform scale + a
 * recenter offset so the asset sits correctly on a hex cell. Renderer-free — a binding
 * multiplies its node's transform by the result.
 *
 * @module
 */
import { KAYKIT_HEX_DEPTH, KAYKIT_HEX_WIDTH } from '../coordinates';
import type { AssetBounds, WorldPosition } from '../types';

/** How an asset's footprint is fit to the target cell. */
export type NormalizeFit =
  /** Uniformly scale so the footprint's LARGER plane axis matches the cell — the
   *  asset fully covers the cell (may overhang on the smaller axis). */
  | 'cover'
  /** Uniformly scale so the footprint's SMALLER plane axis matches the cell — the
   *  asset fits inside the cell (may leave margin on the larger axis). */
  | 'contain'
  /** Scale so the footprint WIDTH (x) matches the cell width — the natural default for
   *  props/buildings authored to sit on a tile. */
  | 'width';

/** The board cell an asset is normalized to (defaults to the KayKit hex cell). */
export interface NormalizeTarget {
  /** Target cell width in world units (x). */
  readonly width?: number;
  /** Target cell depth in world units (z). */
  readonly depth?: number;
}

/** Options for normalizing an asset to a cell. */
export interface NormalizeOptions {
  readonly fit?: NormalizeFit;
  readonly target?: NormalizeTarget;
  /**
   * Rest the asset ON the cell surface (its min-Y sits at y=0) after scaling, rather
   * than centering it vertically. Default true — props/buildings stand on the tile.
   */
  readonly rest?: boolean;
}

/** A computed normalization — a uniform scale + a recenter offset. */
export interface Normalization {
  /** Uniform scale factor to apply to the asset. */
  readonly scale: number;
  /**
   * World-space offset to apply AFTER scaling so the (scaled) asset is centered on the
   * cell in x/z, and rested on / centered in y per `rest`.
   */
  readonly offset: WorldPosition;
}

const EPSILON = 1e-6;

/**
 * Compute the uniform scale + recenter offset that normalizes an asset's native bounds
 * onto a board cell. The scale fits the footprint per `fit`; the offset re-centers the
 * scaled asset on the cell (x/z) and rests it on the surface (or centers it in y).
 */
export function normalizeAssetToCell(
  bounds: AssetBounds,
  options: NormalizeOptions = {}
): Normalization {
  const fit = options.fit ?? 'width';
  const targetWidth = options.target?.width ?? KAYKIT_HEX_WIDTH;
  const targetDepth = options.target?.depth ?? KAYKIT_HEX_DEPTH;
  const [sizeX, , sizeZ] = bounds.size;

  const safeX = Math.max(Math.abs(sizeX), EPSILON);
  const safeZ = Math.max(Math.abs(sizeZ), EPSILON);
  const scaleForWidth = targetWidth / safeX;
  const scaleForDepth = targetDepth / safeZ;

  let scale: number;
  switch (fit) {
    case 'cover':
      // Larger footprint axis touches the cell → take the LARGER required scale.
      scale = Math.max(scaleForWidth, scaleForDepth);
      break;
    case 'contain':
      // Smaller footprint axis touches → take the SMALLER required scale.
      scale = Math.min(scaleForWidth, scaleForDepth);
      break;
    default:
      scale = scaleForWidth;
      break;
  }

  // Center of the native footprint, scaled.
  const centerX = ((bounds.min[0] + bounds.max[0]) / 2) * scale;
  const centerZ = ((bounds.min[2] + bounds.max[2]) / 2) * scale;
  const rest = options.rest ?? true;
  // y offset: rest the min-Y on 0, or center the y extent on 0.
  const offsetY = rest
    ? -bounds.min[1] * scale
    : -((bounds.min[1] + bounds.max[1]) / 2) * scale;

  return {
    scale,
    offset: { x: -centerX, y: offsetY, z: -centerZ },
  };
}

/** The world footprint (width × depth) an asset occupies after a normalization. */
export function normalizedFootprint(
  bounds: AssetBounds,
  normalization: Normalization
): { width: number; depth: number; height: number } {
  return {
    width: Math.abs(bounds.size[0]) * normalization.scale,
    depth: Math.abs(bounds.size[2]) * normalization.scale,
    height: Math.abs(bounds.size[1]) * normalization.scale,
  };
}
