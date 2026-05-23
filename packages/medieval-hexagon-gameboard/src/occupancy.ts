import type {
  GameboardPlacementKind,
  GameboardPlacementLayer,
  GameboardPlacementSpec,
} from './gameboard';

export interface GameboardPlacementOccupancyLike {
  id: string;
  tileKey: string;
  kind: GameboardPlacementKind;
  layer: GameboardPlacementLayer;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface GameboardPlacementOccupancyOptions {
  includeLayoutFootprint?: boolean;
  blockingPlacementKinds?: readonly GameboardPlacementKind[];
  blockingPlacementLayers?: readonly GameboardPlacementLayer[];
  ignorePlacementIds?: readonly string[];
}

const DEFAULT_BLOCKING_KINDS = ['structure', 'unit'] as const satisfies readonly GameboardPlacementKind[];
const DEFAULT_BLOCKING_LAYERS = [] as const satisfies readonly GameboardPlacementLayer[];

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

export function gameboardPlacementOccupiesTile(
  placement: Pick<GameboardPlacementSpec, 'tileKey' | 'metadata'>,
  tileKey: string,
  options: Pick<GameboardPlacementOccupancyOptions, 'includeLayoutFootprint'> = {}
): boolean {
  return gameboardPlacementFootprintKeys(placement, options).includes(tileKey);
}

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
