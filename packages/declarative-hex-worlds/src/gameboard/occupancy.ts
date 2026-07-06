/**
 * Placement footprint and occupancy utilities for inspecting blocked tiles,
 * multi-hex footprints, and movement blockers without requiring Koota.
 *
 * @module
 */
import type {
  GameboardPlacementKind,
  GameboardPlacementLayer,
  GameboardPlacementSpec,
} from './plan';

/** Minimal placement shape required by occupancy helpers. */
export interface GameboardPlacementOccupancyLike {
  /** Placement id. */
  id: string;
  /** Primary tile occupied by the placement. */
  tileKey: string;
  /** Placement kind used by blocking rules. */
  kind: GameboardPlacementKind;
  /** Placement layer used by blocking rules. */
  layer: GameboardPlacementLayer;
  /** Placement metadata, including layout footprint and blocking hints. */
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}

/** Options controlling occupancy and blocking checks. */
export interface GameboardPlacementOccupancyOptions {
  /** Whether to include `layoutFootprintTiles` metadata in occupied tile checks. */
  includeLayoutFootprint?: boolean;
  /** Placement kinds that should block occupancy by default. */
  blockingPlacementKinds?: readonly GameboardPlacementKind[];
  /** Placement layers that should block occupancy by default. */
  blockingPlacementLayers?: readonly GameboardPlacementLayer[];
  /** Placement ids ignored by blocking checks. */
  ignorePlacementIds?: readonly string[];
}

const DEFAULT_BLOCKING_KINDS = ['structure', 'unit'] as const satisfies readonly GameboardPlacementKind[];
const DEFAULT_BLOCKING_LAYERS = [] as const satisfies readonly GameboardPlacementLayer[];

/** Returns every tile key occupied by a placement footprint. */
export function gameboardPlacementFootprintKeys(
  placement: Pick<GameboardPlacementSpec, 'tileKey' | 'metadata'>,
  options: Pick<GameboardPlacementOccupancyOptions, 'includeLayoutFootprint'> = {}
): string[] {
  const keys = [placement.tileKey];
  if (options.includeLayoutFootprint ?? true) {
    const encoded = placement.metadata.layoutFootprintTiles;
    if (typeof encoded === 'string' && encoded.length > 0) {
      keys.push(...encoded.split('|').filter(Boolean));
    }
  }
  return [...new Set(keys)];
}

/** Checks whether a placement footprint includes a tile key. */
export function gameboardPlacementOccupiesTile(
  placement: Pick<GameboardPlacementSpec, 'tileKey' | 'metadata'>,
  tileKey: string,
  options: Pick<GameboardPlacementOccupancyOptions, 'includeLayoutFootprint'> = {}
): boolean {
  return gameboardPlacementFootprintKeys(placement, options).includes(tileKey);
}

/** Checks whether a placement should block another placement from occupying the same tile. */
export function gameboardPlacementBlocksOccupancy(
  placement: GameboardPlacementOccupancyLike,
  options: GameboardPlacementOccupancyOptions = {}
): boolean {
  if (options.ignorePlacementIds?.includes(placement.id)) {
    return false;
  }
  if (hasBlockingMetadata(placement.metadata)) {
    return true;
  }
  const blockingKinds = options.blockingPlacementKinds ?? DEFAULT_BLOCKING_KINDS;
  const blockingLayers = options.blockingPlacementLayers ?? DEFAULT_BLOCKING_LAYERS;
  return blockingKinds.includes(placement.kind) || blockingLayers.includes(placement.layer);
}

/** Returns the occupancy group id used to collapse multi-placement composites. */
export function gameboardPlacementOccupancyGroup(
  placement: Pick<GameboardPlacementOccupancyLike, 'id' | 'metadata'>
): string {
  const metadata = placement.metadata;
  const group = metadata.layoutOccupancyGroup ?? metadata.occupancyGroup ?? metadata.unitCompositeId;
  return typeof group === 'string' && group.length > 0 ? group : placement.id;
}

function hasBlockingMetadata(metadata: Readonly<Record<string, string | number | boolean | null>>): boolean {
  return metadata.layoutBlocksMovement === true || metadata.blocksMovement === true;
}
