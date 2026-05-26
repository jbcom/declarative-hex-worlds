/**
 * Koota ECS traits, relations, actions, occupancy guards, and projections that
 * turn serializable board plans into mutable gameboard runtime state.
 *
 * @module
 */
import {
  createActions,
  createQuery,
  createWorld,
  type Entity,
  type TraitRecord,
  type World,
} from 'koota';
import { isKnownExtraAssetId } from '../scenario';
import {
  hexKey,
  neighbor,
  type GameboardPlan,
  type GameboardPlacementKind,
  type GameboardPlacementLayer,
  type GameboardPlacementSpec,
  type GameboardTileSpec,
} from '../gameboard';
import { axialToWorld } from '../coordinates';
import {
  gameboardPlacementBlocksOccupancy,
  gameboardPlacementFootprintKeys,
  type GameboardPlacementOccupancyLike,
  gameboardPlacementOccupancyGroup,
  gameboardPlacementOccupiesTile,
} from '../gameboard';
import type { HexCoordinates, TextureSet, WorldPosition } from '../types';

// Board / tile / placement traits + relations live in `src/traits/board.ts`
// so they have zero runtime dependency on sibling sub-packages, which is what
// prevents the koota↔gameboard↔scenario top-level evaluation cycle. Re-
// exported here for backward compatibility with internal modules that import
// `IsGameboardPlacement` etc. from `'../koota'`. Cross-domain consumers should
// import from `'../traits'` (the umbrella) instead.
export {
  AdjacentTo,
  GameboardState,
  HexTileState,
  IsCoastPlacement,
  IsDecorationPlacement,
  IsGameboardPlacement,
  IsGameboardTile,
  IsHarborPlacement,
  IsPropPlacement,
  IsRiverPlacement,
  IsRoadPlacement,
  IsStackedTerrain,
  IsStructurePlacement,
  IsTerrainPlacement,
  IsUnitPlacement,
  PlacementOccupiesTile,
  PlacementOnTile,
  PlacementState,
  RequiresExtraAsset,
  TileConnectivity,
  TileCoordinates,
  TileElevation,
  TileRenderState,
  TileTagList,
  TileTerrain,
} from '../traits/board';
import {
  AdjacentTo,
  GameboardState,
  HexTileState,
  IsCoastPlacement,
  IsDecorationPlacement,
  IsGameboardPlacement,
  IsGameboardTile,
  IsHarborPlacement,
  IsPropPlacement,
  IsRiverPlacement,
  IsRoadPlacement,
  IsStackedTerrain,
  IsStructurePlacement,
  IsTerrainPlacement,
  IsUnitPlacement,
  PlacementOccupiesTile,
  PlacementOnTile,
  PlacementState,
  RequiresExtraAsset,
  TileConnectivity,
  TileCoordinates,
  TileElevation,
  TileRenderState,
  TileTagList,
  TileTerrain,
} from '../traits/board';

/** Query for full tile state. */
export const GameboardTileQuery = createQuery(IsGameboardTile, HexTileState);
/** Query for decomposed tile traits used by rule and ECS adapters. */
export const DecomposedGameboardTileQuery = createQuery(
  IsGameboardTile,
  TileCoordinates,
  TileTerrain,
  TileElevation,
  TileConnectivity,
  TileRenderState,
  TileTagList
);
/** Query for all board placements. */
export const GameboardPlacementQuery = createQuery(IsGameboardPlacement, PlacementState);
/** Query for terrain placements. */
export const TerrainPlacementQuery = createQuery(IsTerrainPlacement, PlacementState);
/** Query for road placements. */
export const RoadPlacementQuery = createQuery(IsRoadPlacement, PlacementState);
/** Query for river placements. */
export const RiverPlacementQuery = createQuery(IsRiverPlacement, PlacementState);
/** Query for coast placements. */
export const CoastPlacementQuery = createQuery(IsCoastPlacement, PlacementState);
/** Query for structure placements. */
export const StructurePlacementQuery = createQuery(IsStructurePlacement, PlacementState);
/** Query for harbor-capable placements. */
export const HarborPlacementQuery = createQuery(IsHarborPlacement, PlacementState);
/** Query for stacked or elevated terrain placements. */
export const StackedTerrainQuery = createQuery(IsStackedTerrain, PlacementState);
/** Query for placements backed by local-only EXTRA assets. */
export const ExtraPlacementQuery = createQuery(RequiresExtraAsset, PlacementState);

/** Board trait value returned by `GameboardState`. */
export type GameboardStateValue = TraitRecord<typeof GameboardState>;
/** Full tile trait value returned by `HexTileState`. */
export type HexTileStateValue = TraitRecord<typeof HexTileState>;
/** Decomposed coordinate trait value returned by `TileCoordinates`. */
export type TileCoordinatesValue = TraitRecord<typeof TileCoordinates>;
/** Decomposed terrain trait value returned by `TileTerrain`. */
export type TileTerrainValue = TraitRecord<typeof TileTerrain>;
/** Decomposed elevation trait value returned by `TileElevation`. */
export type TileElevationValue = TraitRecord<typeof TileElevation>;
/** Decomposed connectivity trait value returned by `TileConnectivity`. */
export type TileConnectivityValue = TraitRecord<typeof TileConnectivity>;
/** Decomposed render trait value returned by `TileRenderState`. */
export type TileRenderStateValue = TraitRecord<typeof TileRenderState>;
/** Decomposed tag trait value returned by `TileTagList`. */
export type TileTagListValue = TraitRecord<typeof TileTagList>;
/** Placement trait value returned by `PlacementState`. */
export type PlacementStateValue = TraitRecord<typeof PlacementState>;

/**
 * Stored relation payload for one tile occupied by one placement.
 */
export interface PlacementOccupancyValue {
  /** Origin tile key for the placement that owns this footprint record. */
  originTileKey: string;
  /** Zero-based index within the footprint key list. */
  footprintIndex: number;
  /** Whether this footprint record blocks movement. */
  blocksMovement: boolean;
  /** Occupancy group used to allow compatible colocated placements. */
  occupancyGroup: string;
}

/**
 * Serializable occupancy record joined from a placement and an occupied tile.
 */
export interface PlacementOccupancySnapshot {
  /** Tile key for the occupied tile. */
  tileKey: string;
  /** Axial coordinates for the occupied tile. */
  coordinates: HexCoordinates;
  /** Placement occupying the tile. */
  placement: PlacementStateValue;
  /** Origin tile key for the placement. */
  originTileKey: string;
  /** Zero-based index within the placement footprint. */
  footprintIndex: number;
  /** Whether this occupancy record blocks movement. */
  blocksMovement: boolean;
  /** Occupancy group used to allow compatible colocated placements. */
  occupancyGroup: string;
}

/**
 * Options for simulating whether a placement can occupy a tile footprint.
 */
export interface InspectGameboardPlacementOccupancyOptions {
  /** Origin tile or tile key for the proposed placement. */
  at: HexCoordinates | string;
  /** Placement kind to evaluate. Defaults to `prop`. */
  kind?: GameboardPlacementKind;
  /** Placement layer to evaluate. Defaults from `kind`. */
  layer?: GameboardPlacementLayer;
  /** Placement metadata used for footprint and occupancy rules. */
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
  /** Placement ids ignored when checking blockers, usually the moving entity. */
  ignorePlacementIds?: readonly string[];
  /** Require no blockers even if the proposed placement itself is non-blocking. */
  requireUnblocked?: boolean;
}

/**
 * Detailed result from an occupancy inspection.
 */
export interface GameboardPlacementOccupancyInspection {
  /** Origin tile key that was inspected. */
  tileKey: string;
  /** Axial coordinates for the origin tile. */
  coordinates: HexCoordinates;
  /** Tile keys in the proposed placement footprint. */
  footprintTileKeys: readonly string[];
  /** Footprint tile keys not present in the world. */
  missingTileKeys: readonly string[];
  /** Whether the proposed placement blocks movement. */
  blocksMovement: boolean;
  /** Occupancy group assigned to the proposed placement. */
  occupancyGroup: string;
  /** Blocking occupancy records found in the footprint. */
  blockers: readonly PlacementOccupancySnapshot[];
  /** Whether the placement can occupy the inspected footprint. */
  canOccupy: boolean;
  /** Machine-readable reason when `canOccupy` is false. */
  reason?: string;
}

/**
 * Options used by spawn, update, and move helpers to enforce occupancy.
 */
export interface GameboardPlacementOccupancyGuardOptions {
  /** Placement ids ignored when checking blockers, usually the moving entity. */
  ignorePlacementIds?: readonly string[];
  /** Require no blockers even if the placement itself is non-blocking. */
  requireUnblocked?: boolean;
}

/**
 * Occupancy guard setting used by placement mutation helpers.
 */
export type GameboardPlacementOccupancyGuard = boolean | GameboardPlacementOccupancyGuardOptions;

/**
 * Entity indexes returned after loading a complete board plan.
 */
export interface GameboardEntityIndex {
  /** Tile entities keyed by axial tile key. */
  tiles: Map<string, Entity>;
  /** Placement entities keyed by placement id. */
  placements: Map<string, Entity>;
}

/**
 * Serializable snapshot of board, tile, and placement state.
 */
export interface GameboardSnapshot {
  /** Board metadata, or `undefined` when no plan is loaded. */
  board: GameboardStateValue | undefined;
  /** Tile states sorted by axial tile key. */
  tiles: readonly HexTileStateValue[];
  /** Placement states sorted by order and id. */
  placements: readonly PlacementStateValue[];
}

/**
 * Optional local offset applied to a placement after tile/elevation anchoring.
 */
export interface GameboardPlacementPositionOffset {
  /** X-axis world offset. */
  x?: number;
  /** Y-axis world offset. */
  y?: number;
  /** Z-axis world offset. */
  z?: number;
}

/**
 * Options for spawning a runtime placement into an existing gameboard world.
 */
export interface SpawnGameboardPlacementOptions {
  /** Explicit placement id. Defaults to a deterministic runtime id. */
  id?: string;
  /** Origin tile or tile key where the placement should spawn. */
  at: HexCoordinates | string;
  /** Manifest or external registry asset id to render. */
  assetId: string;
  /** Gameplay category for rules, selectors, and rendering. */
  kind: GameboardPlacementKind;
  /** Render and occupancy layer. Defaults from `kind`. */
  layer?: GameboardPlacementLayer;
  /** Texture set override. Defaults to the origin tile texture set. */
  textureSet?: TextureSet;
  /** Extra vertical offset above the tile elevation. */
  elevationOffset?: number;
  /** Local world-space offset after tile/elevation anchoring. */
  positionOffset?: GameboardPlacementPositionOffset;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps?: number;
  /** Uniform render scale. */
  scale?: number;
  /** Stable sort order used by renderers and snapshots. */
  order?: number;
  /** Optional stack index for layered terrain and vertical props. */
  stackIndex?: number;
  /** Whether the placement depends on local-only EXTRA assets. */
  requiresExtra?: boolean;
  /** Serializable placement metadata for rules, ECS interop, and render hints. */
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
  /** Optional occupancy validation before spawning. */
  occupancyGuard?: GameboardPlacementOccupancyGuard;
}

/**
 * Options for mutating an existing runtime placement.
 */
export interface UpdateGameboardPlacementOptions {
  /** New origin tile or tile key. */
  at?: HexCoordinates | string;
  /** New manifest or external registry asset id. */
  assetId?: string;
  /** New gameplay category. */
  kind?: GameboardPlacementKind;
  /** New render and occupancy layer. */
  layer?: GameboardPlacementLayer;
  /** New texture set. */
  textureSet?: TextureSet;
  /** New vertical offset above the tile elevation. */
  elevationOffset?: number;
  /** New local world-space offset after tile/elevation anchoring. */
  positionOffset?: GameboardPlacementPositionOffset;
  /** New clockwise 60-degree rotation steps. */
  rotationSteps?: number;
  /** New uniform render scale. */
  scale?: number;
  /** New stable sort order. */
  order?: number;
  /** New stack index. */
  stackIndex?: number;
  /** New local-only EXTRA requirement flag. */
  requiresExtra?: boolean;
  /** Replacement serializable placement metadata. */
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
  /** Optional occupancy validation before applying the mutation. */
  occupancyGuard?: GameboardPlacementOccupancyGuard;
}

/**
 * Koota action bundle for loading, clearing, inspecting, and mutating a board
 * through world-bound helpers.
 */
export const gameboardActions = createActions((world) => ({
  /** Replace the current world contents with a complete generated board plan. */
  loadPlan: (plan: GameboardPlan) => spawnGameboardPlan(world, plan),
  /** Remove all board tile, placement, and board-state traits from the world. */
  clear: () => clearGameboardWorld(world),
  /** Inspect whether a proposed placement footprint can occupy its target tiles. */
  inspectPlacementOccupancy: (options: InspectGameboardPlacementOccupancyOptions) =>
    inspectGameboardPlacementOccupancy(world, options),
  /** Return only the boolean occupancy result for a proposed placement. */
  canOccupyPlacement: (options: InspectGameboardPlacementOccupancyOptions) =>
    canOccupyGameboardPlacement(world, options),
  /** Spawn a runtime placement into the board. */
  spawnPlacement: (options: SpawnGameboardPlacementOptions) =>
    spawnGameboardPlacement(world, options),
  /** Update an existing runtime placement by entity or placement id. */
  updatePlacement: (placement: Entity | string, options: UpdateGameboardPlacementOptions) =>
    updateGameboardPlacement(world, placement, options),
  /** Move an existing placement to another tile while preserving unspecified state. */
  movePlacement: (
    placement: Entity | string,
    to: HexCoordinates | string,
    options: UpdateGameboardPlacementOptions = {}
  ) => updateGameboardPlacement(world, placement, { ...options, at: to }),
  /** Remove an existing placement by entity or placement id. */
  removePlacement: (placement: Entity | string) => removeGameboardPlacement(world, placement),
}));

/**
 * Create a Koota world ready for gameboard systems, optionally preloaded with a
 * complete board plan.
 */
export function createGameboardWorld(plan?: GameboardPlan): World {
  const world = createWorld();
  if (plan) {
    spawnGameboardPlan(world, plan);
  }
  return world;
}

/**
 * Clear the world and spawn all tiles, placements, marker traits, adjacency
 * relations, and occupancy relations for a generated board plan.
 */
export function spawnGameboardPlan(world: World, plan: GameboardPlan): GameboardEntityIndex {
  clearGameboardWorld(world);
  world.add(
    GameboardState({
      schemaVersion: plan.schemaVersion,
      seed: plan.seed,
      textureSet: plan.textureSet,
      shape: plan.shape,
      tileCount: plan.tiles.length,
      placementCount: plan.placements.length,
    })
  );

  const tiles = new Map<string, Entity>();
  const placements = new Map<string, Entity>();

  for (const tile of plan.tiles) {
    const entity = world.spawn(
      IsGameboardTile,
      HexTileState(tileStateValue(tile)),
      ...decomposedTileTraits(tile)
    );
    if (tile.elevation > 0) {
      entity.add(IsStackedTerrain);
    }
    tiles.set(tile.key, entity);
  }

  linkAdjacentTiles(tiles);

  for (const placement of plan.placements) {
    const tile = tiles.get(placement.tileKey);
    if (!tile) {
      throw new Error(`Placement ${placement.id} references missing tile ${placement.tileKey}`);
    }
    const entity = world.spawn(
      IsGameboardPlacement,
      PlacementState(placementStateValue(placement)),
      PlacementOnTile(tile),
      ...tagsForPlacement(placement)
    );
    syncPlacementOccupancyRelations(world, entity, placement, tiles);
    placements.set(placement.id, entity);
  }

  return { tiles, placements };
}

/**
 * Spawn one runtime placement on an existing tile, deriving world position,
 * layer defaults, EXTRA detection, and occupancy footprint relations.
 */
export function spawnGameboardPlacement(
  world: World,
  options: SpawnGameboardPlacementOptions
): Entity {
  const tile = requireTileEntity(world, options.at);
  const tileState = tile.get(HexTileState);
  if (!tileState) {
    throw new Error(`Tile ${tileKey(options.at)} is missing HexTileState`);
  }
  const placement = runtimePlacementSpec(world, tileState, options);
  assertPlacementOccupancyGuard(world, placement, options.occupancyGuard);
  const entity = world.spawn(
    IsGameboardPlacement,
    PlacementState(placementStateValue(placement)),
    PlacementOnTile(tile),
    ...tagsForPlacement(placement)
  );
  syncPlacementOccupancyRelations(world, entity, placement);
  syncGameboardPlacementCount(world);
  return entity;
}

/**
 * Mutate an existing placement while keeping unspecified placement state stable.
 * Position, tile relations, marker traits, and occupancy footprint relations
 * are synchronized after the update.
 */
export function updateGameboardPlacement(
  world: World,
  placement: Entity | string,
  options: UpdateGameboardPlacementOptions
): Entity {
  const entity = requirePlacementEntity(world, placement);
  const current = entity.get(PlacementState);
  if (!current) {
    throw new Error(`Placement ${placementId(placement)} is missing PlacementState`);
  }
  const tile = requireTileEntity(world, options.at ?? current.tileKey);
  const tileState = tile.get(HexTileState);
  if (!tileState) {
    throw new Error(`Tile ${tileKey(options.at ?? current.tileKey)} is missing HexTileState`);
  }

  const rotationSteps = normalizeRotationSteps(options.rotationSteps ?? current.rotationSteps);
  const elevationOffset = options.elevationOffset ?? current.elevationOffset;
  const positionOffset =
    options.positionOffset ?? placementPositionOffsetFromPlacementState(current);
  const updated: GameboardPlacementSpec = {
    ...current,
    tileKey: tileState.key,
    coordinates: { ...tileState.coordinates },
    position: placementWorldPosition(
      tileState.coordinates,
      tileState.elevation + elevationOffset,
      positionOffset
    ),
    assetId: options.assetId ?? current.assetId,
    kind: options.kind ?? current.kind,
    layer: options.layer ?? current.layer,
    textureSet: options.textureSet ?? tileState.textureSet,
    elevation: tileState.elevation,
    elevationOffset,
    rotationSteps,
    rotationRadians: rotationSteps * (Math.PI / 3),
    scale: options.scale ?? current.scale,
    order: options.order ?? current.order,
    stackIndex: options.stackIndex ?? current.stackIndex,
    requiresExtra:
      options.requiresExtra ??
      (options.assetId ? isKnownExtraAssetId(options.assetId) : current.requiresExtra),
    metadata: options.metadata ? { ...options.metadata } : { ...current.metadata },
  };

  assertPlacementOccupancyGuard(world, updated, options.occupancyGuard, current.id);
  entity.set(PlacementState, placementStateValue(updated));
  entity.add(PlacementOnTile(tile));
  syncPlacementOccupancyRelations(world, entity, updated);
  retagPlacement(entity, updated);
  return entity;
}

/**
 * Move an existing placement to a new tile while allowing selected placement
 * fields to be updated in the same operation.
 */
export function moveGameboardPlacement(
  world: World,
  placement: Entity | string,
  to: HexCoordinates | string,
  options: Omit<UpdateGameboardPlacementOptions, 'at'> = {}
): Entity {
  return updateGameboardPlacement(world, placement, { ...options, at: to });
}

/**
 * Remove a placement entity by entity reference or placement id.
 */
export function removeGameboardPlacement(world: World, placement: Entity | string): boolean {
  const entity = findPlacementEntity(world, placement);
  if (!entity) {
    return false;
  }
  entity.destroy();
  syncGameboardPlacementCount(world);
  return true;
}

/**
 * Add directional `AdjacentTo` relations for every neighboring tile pair in an
 * already constructed tile index.
 */
export function linkAdjacentTiles(tiles: ReadonlyMap<string, Entity>): void {
  for (const [key, entity] of tiles) {
    const coordinates = parseTileKey(key);
    for (let edge = 0; edge < 6; edge += 1) {
      const adjacent = tiles.get(hexKey(neighbor(coordinates, edge)));
      if (adjacent) {
        entity.add(AdjacentTo(adjacent, { edge }));
      }
    }
  }
}

/**
 * Remove all gameboard tiles, placements, and board metadata from the world.
 */
export function clearGameboardWorld(world: World): void {
  for (const placement of [...world.query(IsGameboardPlacement)]) {
    placement.destroy();
  }
  for (const tile of [...world.query(IsGameboardTile)]) {
    tile.destroy();
  }
  if (world.has(GameboardState)) {
    world.remove(GameboardState);
  }
}

/**
 * Find a tile entity by axial coordinates or tile key.
 */
export function findTileEntity(
  world: World,
  coordinates: HexCoordinates | string
): Entity | undefined {
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  return world.query(GameboardTileQuery).find((entity) => entity.get(HexTileState)?.key === key);
}

/**
 * Find a placement entity by entity reference or placement id.
 */
export function findPlacementEntity(world: World, placement: Entity | string): Entity | undefined {
  if (typeof placement !== 'string') {
    return placement;
  }
  return world
    .query(GameboardPlacementQuery)
    .find((entity) => entity.get(PlacementState)?.id === placement);
}

/**
 * Read tile state snapshots sorted by axial tile key.
 */
export function readGameboardTiles(world: World): HexTileStateValue[] {
  const tiles: HexTileStateValue[] = [];
  world.query(GameboardTileQuery).readEach(([tile]) => {
    tiles.push(copyTileState(tile));
  });
  return tiles.sort(compareByHexKey);
}

/**
 * Read placement state snapshots sorted by render order and placement id.
 */
export function readGameboardPlacements(world: World): PlacementStateValue[] {
  const placements: PlacementStateValue[] = [];
  world.query(GameboardPlacementQuery).readEach(([placement]) => {
    placements.push(copyPlacementState(placement));
  });
  return placements.sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id)
  );
}

/**
 * Read placements that occupy a tile, including multi-tile footprint occupants.
 */
export function readPlacementsForTile(
  world: World,
  coordinates: HexCoordinates | string
): PlacementStateValue[] {
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  const tile = findTileEntity(world, key);
  if (tile) {
    return world
      .query(IsGameboardPlacement, PlacementOccupiesTile(tile), PlacementState)
      .map((entity) => entity.get(PlacementState))
      .filter((placement): placement is PlacementStateValue => placement !== undefined)
      .map(copyPlacementState)
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  }
  return readGameboardPlacements(world).filter((placement) =>
    gameboardPlacementOccupiesTile(placement, key)
  );
}

/**
 * Read every placement-to-tile occupancy relation in the world.
 */
export function readGameboardPlacementOccupancy(world: World): PlacementOccupancySnapshot[] {
  const records: PlacementOccupancySnapshot[] = [];
  for (const entity of world.query(GameboardPlacementQuery)) {
    const placement = entity.get(PlacementState);
    if (!placement) {
      continue;
    }
    for (const tile of entity.targetsFor(PlacementOccupiesTile)) {
      const record = placementOccupancySnapshot(entity, tile, placement);
      if (record) {
        records.push(record);
      }
    }
  }
  return records.sort(comparePlacementOccupancy);
}

/**
 * Read all occupancy records for one tile.
 */
export function readPlacementOccupancyForTile(
  world: World,
  coordinates: HexCoordinates | string
): PlacementOccupancySnapshot[] {
  const tile = findTileEntity(world, coordinates);
  if (!tile) {
    return [];
  }
  return world
    .query(IsGameboardPlacement, PlacementOccupiesTile(tile), PlacementState)
    .map((entity) => {
      const placement = entity.get(PlacementState);
      return placement ? placementOccupancySnapshot(entity, tile, placement) : undefined;
    })
    .filter((record): record is PlacementOccupancySnapshot => record !== undefined)
    .sort(comparePlacementOccupancy);
}

/**
 * Inspect a proposed placement footprint without mutating the world.
 */
export function inspectGameboardPlacementOccupancy(
  world: World,
  options: InspectGameboardPlacementOccupancyOptions
): GameboardPlacementOccupancyInspection {
  const tile = findTileEntity(world, options.at);
  const tileState = tile?.get(HexTileState);
  const key = tileState?.key ?? tileKey(options.at);
  const coordinates = tileState?.coordinates ?? coordinatesFromTileInput(options.at);
  const kind = options.kind ?? 'prop';
  const layer = options.layer ?? defaultLayerForPlacementKind(kind);
  const metadata = { ...(options.metadata ?? {}) };
  const proposed = {
    id: '__placement_occupancy_inspection__',
    tileKey: key,
    kind,
    layer,
    metadata,
  } satisfies GameboardPlacementOccupancyLike;
  const footprintTileKeys = gameboardPlacementFootprintKeys({ tileKey: key, metadata });
  const occupancyGroup = gameboardPlacementOccupancyGroup(proposed);
  const blocksMovement = gameboardPlacementBlocksOccupancy(proposed);
  const ignoredIds = new Set(options.ignorePlacementIds ?? []);
  const missingTileKeys = footprintTileKeys.filter(
    (footprintKey) => !findTileEntity(world, footprintKey)
  );
  const blockers = footprintTileKeys.flatMap((footprintKey) =>
    readPlacementOccupancyForTile(world, footprintKey).filter(
      (record) =>
        record.blocksMovement &&
        !ignoredIds.has(record.placement.id) &&
        record.occupancyGroup !== occupancyGroup
    )
  );
  const requireUnblocked = options.requireUnblocked ?? blocksMovement;
  const canOccupy = missingTileKeys.length === 0 && (!requireUnblocked || blockers.length === 0);

  return {
    tileKey: key,
    coordinates,
    footprintTileKeys,
    missingTileKeys,
    blocksMovement,
    occupancyGroup,
    blockers,
    canOccupy,
    reason: occupancyInspectionReason(missingTileKeys, blockers, requireUnblocked),
  };
}

/**
 * Return whether a proposed placement footprint can occupy its target tiles.
 */
export function canOccupyGameboardPlacement(
  world: World,
  options: InspectGameboardPlacementOccupancyOptions
): boolean {
  return inspectGameboardPlacementOccupancy(world, options).canOccupy;
}

function assertPlacementOccupancyGuard(
  world: World,
  placement: Pick<GameboardPlacementSpec, 'id' | 'tileKey' | 'kind' | 'layer' | 'metadata'>,
  guard: GameboardPlacementOccupancyGuard | undefined,
  selfPlacementId?: string
): void {
  if (guard === undefined || guard === false) {
    return;
  }
  const guardOptions = guard === true ? {} : guard;
  const ignorePlacementIds = uniqueStrings([
    ...(guardOptions.ignorePlacementIds ?? []),
    selfPlacementId,
  ]);
  const inspection = inspectGameboardPlacementOccupancy(world, {
    at: placement.tileKey,
    kind: placement.kind,
    layer: placement.layer,
    metadata: placement.metadata,
    ignorePlacementIds,
    requireUnblocked: guardOptions.requireUnblocked,
  });

  if (!inspection.canOccupy) {
    throw new Error(
      `Placement ${placement.id} cannot occupy ${inspection.tileKey}: ${inspection.reason ?? 'blocked'}`
    );
  }
}

/**
 * Read a serializable snapshot of board metadata, tiles, and placements.
 */
export function readGameboardSnapshot(world: World): GameboardSnapshot {
  const board = world.get(GameboardState);
  return {
    board: board
      ? {
          ...board,
          shape: { ...board.shape },
        }
      : undefined,
    tiles: readGameboardTiles(world),
    placements: readGameboardPlacements(world),
  };
}

function runtimePlacementSpec(
  world: World,
  tile: HexTileStateValue,
  options: SpawnGameboardPlacementOptions
): GameboardPlacementSpec {
  const rotationSteps = normalizeRotationSteps(options.rotationSteps ?? 0);
  const elevationOffset = options.elevationOffset ?? 0;
  return {
    id: options.id ?? nextRuntimePlacementId(world, tile, options),
    tileKey: tile.key,
    coordinates: { ...tile.coordinates },
    position: placementWorldPosition(
      tile.coordinates,
      tile.elevation + elevationOffset,
      options.positionOffset
    ),
    assetId: options.assetId,
    kind: options.kind,
    layer: options.layer ?? defaultLayerForPlacementKind(options.kind),
    textureSet: options.textureSet ?? tile.textureSet,
    elevation: tile.elevation,
    elevationOffset,
    rotationSteps,
    rotationRadians: rotationSteps * (Math.PI / 3),
    scale: options.scale ?? 1,
    order: options.order ?? nextRuntimePlacementOrder(world),
    stackIndex: options.stackIndex,
    requiresExtra: options.requiresExtra ?? isKnownExtraAssetId(options.assetId),
    metadata: { ...(options.metadata ?? {}) },
  };
}

function placementWorldPosition(
  coordinates: HexCoordinates,
  elevation: number,
  offset: GameboardPlacementPositionOffset | undefined
): WorldPosition {
  const position = axialToWorld(coordinates, elevation);
  return {
    x: position.x + (offset?.x ?? 0),
    y: position.y + (offset?.y ?? 0),
    z: position.z + (offset?.z ?? 0),
  };
}

function placementPositionOffsetFromMetadata(
  metadata: Readonly<Record<string, string | number | boolean | null>>
): GameboardPlacementPositionOffset | undefined {
  const x = numericMetadata(metadata.layoutPositionOffsetX);
  const y = numericMetadata(metadata.layoutPositionOffsetY);
  const z = numericMetadata(metadata.layoutPositionOffsetZ);
  return x === undefined && y === undefined && z === undefined ? undefined : { x, y, z };
}

function placementPositionOffsetFromPlacementState(
  placement: Pick<
    PlacementStateValue,
    'coordinates' | 'elevation' | 'elevationOffset' | 'position' | 'metadata'
  >
): GameboardPlacementPositionOffset | undefined {
  const metadataOffset = placementPositionOffsetFromMetadata(placement.metadata);
  if (metadataOffset) {
    return metadataOffset;
  }
  const center = axialToWorld(
    placement.coordinates,
    placement.elevation + placement.elevationOffset
  );
  const offset = {
    x: normalizeOffsetDelta(placement.position.x - center.x),
    y: normalizeOffsetDelta(placement.position.y - center.y),
    z: normalizeOffsetDelta(placement.position.z - center.z),
  };
  return offset.x === undefined && offset.y === undefined && offset.z === undefined
    ? undefined
    : offset;
}

function normalizeOffsetDelta(value: number): number | undefined {
  return Math.abs(value) < 1e-9 ? undefined : value;
}

function numericMetadata(value: string | number | boolean | null | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function nextRuntimePlacementId(
  world: World,
  tile: HexTileStateValue,
  options: SpawnGameboardPlacementOptions
): string {
  const baseId = `runtime:${options.kind}:${tile.key}:${options.assetId}`;
  let index = readGameboardPlacements(world).filter((placement) =>
    placement.id.startsWith(baseId)
  ).length;
  let id = `${baseId}:${index}`;
  while (findPlacementEntity(world, id)) {
    index += 1;
    id = `${baseId}:${index}`;
  }
  return id;
}

function nextRuntimePlacementOrder(world: World): number {
  const placements = readGameboardPlacements(world);
  const maxOrder = placements.reduce((max, placement) => Math.max(max, placement.order), 299_999);
  return maxOrder + 1;
}

function defaultLayerForPlacementKind(kind: GameboardPlacementKind): GameboardPlacementLayer {
  switch (kind) {
    case 'terrain':
      return 'terrain';
    case 'road':
    case 'river':
    case 'coast':
    case 'transition':
      return 'surface';
    case 'structure':
      return 'structure';
    case 'unit':
      return 'unit';
    case 'decoration':
    case 'prop':
      return 'feature';
  }
}

function requireTileEntity(world: World, coordinates: HexCoordinates | string): Entity {
  const entity = findTileEntity(world, coordinates);
  if (!entity) {
    throw new Error(`No tile exists at ${tileKey(coordinates)}`);
  }
  return entity;
}

function requirePlacementEntity(world: World, placement: Entity | string): Entity {
  const entity = findPlacementEntity(world, placement);
  if (!entity) {
    throw new Error(`No placement exists with id ${placementId(placement)}`);
  }
  return entity;
}

function tileKey(coordinates: HexCoordinates | string): string {
  return typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
}

function placementId(placement: Entity | string): string {
  return typeof placement === 'string' ? placement : String(placement.id());
}

function syncGameboardPlacementCount(world: World): void {
  const board = world.get(GameboardState);
  if (!board) {
    return;
  }
  world.set(GameboardState, {
    ...board,
    shape: { ...board.shape },
    placementCount: world.query(GameboardPlacementQuery).length,
  });
}

function syncPlacementOccupancyRelations(
  world: World,
  entity: Entity,
  placement: GameboardPlacementSpec,
  tileIndex?: ReadonlyMap<string, Entity>
): void {
  for (const target of [...entity.targetsFor(PlacementOccupiesTile)]) {
    entity.remove(PlacementOccupiesTile(target));
  }

  const footprintKeys = gameboardPlacementFootprintKeys(placement);
  const blocksMovement = gameboardPlacementBlocksOccupancy(placement);
  const occupancyGroup = gameboardPlacementOccupancyGroup(placement) ?? '';
  footprintKeys.forEach((key, footprintIndex) => {
    const tile = tileIndex?.get(key) ?? findTileEntity(world, key);
    if (!tile) {
      return;
    }
    entity.add(
      PlacementOccupiesTile(tile, {
        originTileKey: placement.tileKey,
        footprintIndex,
        blocksMovement,
        occupancyGroup,
      })
    );
  });
}

function placementOccupancySnapshot(
  entity: Entity,
  tile: Entity,
  placement: PlacementStateValue
): PlacementOccupancySnapshot | undefined {
  const occupancy = entity.get(PlacementOccupiesTile(tile));
  const tileState = tile.get(HexTileState);
  if (!occupancy || !tileState) {
    return undefined;
  }
  return {
    tileKey: tileState.key,
    coordinates: { ...tileState.coordinates },
    placement: copyPlacementState(placement),
    originTileKey: occupancy.originTileKey,
    footprintIndex: occupancy.footprintIndex,
    blocksMovement: occupancy.blocksMovement,
    occupancyGroup: occupancy.occupancyGroup,
  };
}

function comparePlacementOccupancy(
  left: PlacementOccupancySnapshot,
  right: PlacementOccupancySnapshot
): number {
  return (
    left.coordinates.r - right.coordinates.r ||
    left.coordinates.q - right.coordinates.q ||
    left.placement.order - right.placement.order ||
    left.footprintIndex - right.footprintIndex ||
    left.placement.id.localeCompare(right.placement.id)
  );
}

function retagPlacement(entity: Entity, placement: GameboardPlacementSpec): void {
  entity.remove(
    IsTerrainPlacement,
    IsRoadPlacement,
    IsRiverPlacement,
    IsCoastPlacement,
    IsDecorationPlacement,
    IsStructurePlacement,
    IsUnitPlacement,
    IsPropPlacement,
    IsHarborPlacement,
    IsStackedTerrain,
    RequiresExtraAsset
  );
  entity.add(...tagsForPlacement(placement));
}

function tagsForPlacement(placement: GameboardPlacementSpec): EntityTag[] {
  const tags: EntityTag[] = [];
  switch (placement.kind) {
    case 'terrain':
      tags.push(IsTerrainPlacement);
      break;
    case 'road':
      tags.push(IsRoadPlacement);
      break;
    case 'river':
      tags.push(IsRiverPlacement);
      break;
    case 'coast':
      tags.push(IsCoastPlacement);
      break;
    case 'decoration':
      tags.push(IsDecorationPlacement);
      break;
    case 'structure':
      tags.push(IsStructurePlacement);
      break;
    case 'unit':
      tags.push(IsUnitPlacement);
      break;
    case 'prop':
      tags.push(IsPropPlacement);
      break;
    case 'transition':
      tags.push(IsTerrainPlacement);
      break;
  }
  if (placement.requiresExtra) {
    tags.push(RequiresExtraAsset);
  }
  if (placement.stackIndex !== undefined || placement.elevation > 0) {
    tags.push(IsStackedTerrain);
  }
  if (placement.metadata.feature === 'harbor') {
    tags.push(IsHarborPlacement);
  }
  return tags;
}

type EntityTag = typeof IsGameboardTile;

function tileStateValue(tile: GameboardTileSpec): HexTileStateValue {
  return {
    ...tile,
    coordinates: { ...tile.coordinates },
    roadSlope: tile.roadSlope,
    riverCrossing: tile.riverCrossing,
    tags: [...tile.tags],
  };
}

function decomposedTileTraits(tile: GameboardTileSpec) {
  return [
    TileCoordinates({ key: tile.key, q: tile.coordinates.q, r: tile.coordinates.r }),
    TileTerrain({ terrain: tile.terrain }),
    TileElevation({
      elevation: tile.elevation,
      baseAssetId: tile.baseAssetId,
      supportAssetId: tile.supportAssetId,
    }),
    TileConnectivity({
      roadEdges: tile.roadEdges,
      riverEdges: tile.riverEdges,
      coastEdges: tile.coastEdges,
      roadSlope: tile.roadSlope,
      riverWaterless: tile.riverWaterless,
      riverCurvy: tile.riverCurvy,
      riverCrossing: tile.riverCrossing,
      coastWaterless: tile.coastWaterless,
    }),
    TileRenderState({ textureSet: tile.textureSet }),
    TileTagList([...tile.tags]),
  ] as const;
}

function placementStateValue(placement: GameboardPlacementSpec): PlacementStateValue {
  return {
    ...placement,
    coordinates: { ...placement.coordinates },
    position: { ...placement.position },
    stackIndex: placement.stackIndex,
    metadata: { ...placement.metadata },
  };
}

function copyTileState(tile: HexTileStateValue): HexTileStateValue {
  return {
    ...tile,
    coordinates: { ...tile.coordinates },
    tags: [...tile.tags],
  };
}

function copyPlacementState(placement: PlacementStateValue): PlacementStateValue {
  return {
    ...placement,
    coordinates: { ...placement.coordinates },
    position: { ...placement.position },
    metadata: { ...placement.metadata },
  };
}

function compareByHexKey(left: HexTileStateValue, right: HexTileStateValue): number {
  return left.coordinates.r - right.coordinates.r || left.coordinates.q - right.coordinates.q;
}

function coordinatesFromTileInput(coordinates: HexCoordinates | string): HexCoordinates {
  return typeof coordinates === 'string' ? parseTileKey(coordinates) : { ...coordinates };
}

function uniqueStrings(values: readonly (string | undefined)[]): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => typeof value === 'string' && value.length > 0)
    ),
  ];
}

function parseTileKey(key: string): HexCoordinates {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

function occupancyInspectionReason(
  missingTileKeys: readonly string[],
  blockers: readonly PlacementOccupancySnapshot[],
  requireUnblocked: boolean
): string | undefined {
  if (missingTileKeys.length > 0) {
    return `Missing footprint tile(s): ${missingTileKeys.join(', ')}`;
  }
  if (requireUnblocked && blockers.length > 0) {
    return `Blocked by placement(s): ${blockers.map((blocker) => blocker.placement.id).join(', ')}`;
  }
  return undefined;
}

function normalizeRotationSteps(steps: number): number {
  return ((Math.floor(steps) % 6) + 6) % 6;
}
