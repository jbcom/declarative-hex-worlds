import {
  createActions,
  createQuery,
  createWorld,
  relation,
  trait,
  type Entity,
  type TraitRecord,
  type World,
} from 'koota';
import { isKnownExtraAssetId } from './catalog';
import {
  GAMEBOARD_SCHEMA_VERSION,
  hexKey,
  neighbor,
  type GameboardPlan,
  type GameboardPlacementKind,
  type GameboardPlacementLayer,
  type GameboardPlacementSpec,
  type GameboardShape,
  type GameboardTerrain,
  type GameboardTileSpec,
} from './gameboard';
import { axialToWorld } from './grid';
import {
  gameboardPlacementBlocksOccupancy,
  gameboardPlacementFootprintKeys,
  type GameboardPlacementOccupancyLike,
  gameboardPlacementOccupancyGroup,
  gameboardPlacementOccupiesTile,
} from './occupancy';
import type { HexCoordinates, TextureSet, WorldPosition } from './types';

export const GameboardState = trait({
  schemaVersion: GAMEBOARD_SCHEMA_VERSION,
  seed: '',
  textureSet: 'default' as TextureSet,
  shape: () => ({ kind: 'rectangle', width: 0, height: 0 }) as GameboardShape,
  tileCount: 0,
  placementCount: 0,
});

export const HexTileState = trait({
  key: '',
  coordinates: () => ({ q: 0, r: 0 }) as HexCoordinates,
  terrain: 'grass' as GameboardTerrain,
  textureSet: 'default' as TextureSet,
  elevation: 0,
  baseAssetId: '',
  supportAssetId: '',
  roadEdges: 0,
  riverEdges: 0,
  coastEdges: 0,
  roadSlope: undefined as 'high' | 'low' | undefined,
  riverWaterless: false,
  riverCurvy: false,
  riverCrossing: undefined as 'A' | 'B' | undefined,
  coastWaterless: false,
  tags: () => [] as string[],
});

export const TileCoordinates = trait({
  key: '',
  q: 0,
  r: 0,
});

export const TileTerrain = trait({
  terrain: 'grass' as GameboardTerrain,
});

export const TileElevation = trait({
  elevation: 0,
  baseAssetId: '',
  supportAssetId: '',
});

export const TileConnectivity = trait({
  roadEdges: 0,
  riverEdges: 0,
  coastEdges: 0,
  roadSlope: undefined as 'high' | 'low' | undefined,
  riverWaterless: false,
  riverCurvy: false,
  riverCrossing: undefined as 'A' | 'B' | undefined,
  coastWaterless: false,
});

export const TileRenderState = trait({
  textureSet: 'default' as TextureSet,
});

export const TileTagList = trait(() => [] as string[]);

export const PlacementState = trait({
  id: '',
  tileKey: '',
  coordinates: () => ({ q: 0, r: 0 }) as HexCoordinates,
  position: () => ({ x: 0, y: 0, z: 0 }) as WorldPosition,
  assetId: '',
  kind: 'terrain' as GameboardPlacementKind,
  layer: 'terrain' as GameboardPlacementLayer,
  textureSet: 'default' as TextureSet,
  elevation: 0,
  elevationOffset: 0,
  rotationSteps: 0,
  rotationRadians: 0,
  scale: 1,
  order: 0,
  stackIndex: undefined as number | undefined,
  requiresExtra: false,
  metadata: () => ({}) as Record<string, string | number | boolean | null>,
});

export const IsGameboardTile = trait();
export const IsGameboardPlacement = trait();
export const IsTerrainPlacement = trait();
export const IsRoadPlacement = trait();
export const IsRiverPlacement = trait();
export const IsCoastPlacement = trait();
export const IsDecorationPlacement = trait();
export const IsStructurePlacement = trait();
export const IsUnitPlacement = trait();
export const IsPropPlacement = trait();
export const IsHarborPlacement = trait();
export const IsStackedTerrain = trait();
export const RequiresExtraAsset = trait();

export const PlacementOnTile = relation({ exclusive: true, autoDestroy: 'orphan' });
export const PlacementOccupiesTile = relation({
  store: {
    originTileKey: '',
    footprintIndex: 0,
    blocksMovement: false as boolean,
    occupancyGroup: '',
  },
});
export const AdjacentTo = relation({ store: { edge: 0 } });

export const GameboardTileQuery = createQuery(IsGameboardTile, HexTileState);
export const DecomposedGameboardTileQuery = createQuery(
  IsGameboardTile,
  TileCoordinates,
  TileTerrain,
  TileElevation,
  TileConnectivity,
  TileRenderState,
  TileTagList
);
export const GameboardPlacementQuery = createQuery(IsGameboardPlacement, PlacementState);
export const TerrainPlacementQuery = createQuery(IsTerrainPlacement, PlacementState);
export const RoadPlacementQuery = createQuery(IsRoadPlacement, PlacementState);
export const RiverPlacementQuery = createQuery(IsRiverPlacement, PlacementState);
export const CoastPlacementQuery = createQuery(IsCoastPlacement, PlacementState);
export const StructurePlacementQuery = createQuery(IsStructurePlacement, PlacementState);
export const HarborPlacementQuery = createQuery(IsHarborPlacement, PlacementState);
export const StackedTerrainQuery = createQuery(IsStackedTerrain, PlacementState);
export const ExtraPlacementQuery = createQuery(RequiresExtraAsset, PlacementState);

export type GameboardStateValue = TraitRecord<typeof GameboardState>;
export type HexTileStateValue = TraitRecord<typeof HexTileState>;
export type TileCoordinatesValue = TraitRecord<typeof TileCoordinates>;
export type TileTerrainValue = TraitRecord<typeof TileTerrain>;
export type TileElevationValue = TraitRecord<typeof TileElevation>;
export type TileConnectivityValue = TraitRecord<typeof TileConnectivity>;
export type TileRenderStateValue = TraitRecord<typeof TileRenderState>;
export type TileTagListValue = TraitRecord<typeof TileTagList>;
export type PlacementStateValue = TraitRecord<typeof PlacementState>;
export interface PlacementOccupancyValue {
  originTileKey: string;
  footprintIndex: number;
  blocksMovement: boolean;
  occupancyGroup: string;
}

export interface PlacementOccupancySnapshot {
  tileKey: string;
  coordinates: HexCoordinates;
  placement: PlacementStateValue;
  originTileKey: string;
  footprintIndex: number;
  blocksMovement: boolean;
  occupancyGroup: string;
}

export interface InspectGameboardPlacementOccupancyOptions {
  at: HexCoordinates | string;
  kind?: GameboardPlacementKind;
  layer?: GameboardPlacementLayer;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
  ignorePlacementIds?: readonly string[];
  requireUnblocked?: boolean;
}

export interface GameboardPlacementOccupancyInspection {
  tileKey: string;
  coordinates: HexCoordinates;
  footprintTileKeys: readonly string[];
  missingTileKeys: readonly string[];
  blocksMovement: boolean;
  occupancyGroup: string;
  blockers: readonly PlacementOccupancySnapshot[];
  canOccupy: boolean;
  reason?: string;
}

export interface GameboardPlacementOccupancyGuardOptions {
  ignorePlacementIds?: readonly string[];
  requireUnblocked?: boolean;
}

export type GameboardPlacementOccupancyGuard = boolean | GameboardPlacementOccupancyGuardOptions;

export interface GameboardEntityIndex {
  tiles: Map<string, Entity>;
  placements: Map<string, Entity>;
}

export interface GameboardSnapshot {
  board: GameboardStateValue | undefined;
  tiles: readonly HexTileStateValue[];
  placements: readonly PlacementStateValue[];
}

export interface GameboardPlacementPositionOffset {
  x?: number;
  y?: number;
  z?: number;
}

export interface SpawnGameboardPlacementOptions {
  id?: string;
  at: HexCoordinates | string;
  assetId: string;
  kind: GameboardPlacementKind;
  layer?: GameboardPlacementLayer;
  textureSet?: TextureSet;
  elevationOffset?: number;
  positionOffset?: GameboardPlacementPositionOffset;
  rotationSteps?: number;
  scale?: number;
  order?: number;
  stackIndex?: number;
  requiresExtra?: boolean;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
  occupancyGuard?: GameboardPlacementOccupancyGuard;
}

export interface UpdateGameboardPlacementOptions {
  at?: HexCoordinates | string;
  assetId?: string;
  kind?: GameboardPlacementKind;
  layer?: GameboardPlacementLayer;
  textureSet?: TextureSet;
  elevationOffset?: number;
  positionOffset?: GameboardPlacementPositionOffset;
  rotationSteps?: number;
  scale?: number;
  order?: number;
  stackIndex?: number;
  requiresExtra?: boolean;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
  occupancyGuard?: GameboardPlacementOccupancyGuard;
}

export const gameboardActions = createActions((world) => ({
  loadPlan: (plan: GameboardPlan) => spawnGameboardPlan(world, plan),
  clear: () => clearGameboardWorld(world),
  inspectPlacementOccupancy: (options: InspectGameboardPlacementOccupancyOptions) =>
    inspectGameboardPlacementOccupancy(world, options),
  canOccupyPlacement: (options: InspectGameboardPlacementOccupancyOptions) =>
    canOccupyGameboardPlacement(world, options),
  spawnPlacement: (options: SpawnGameboardPlacementOptions) =>
    spawnGameboardPlacement(world, options),
  updatePlacement: (placement: Entity | string, options: UpdateGameboardPlacementOptions) =>
    updateGameboardPlacement(world, placement, options),
  movePlacement: (
    placement: Entity | string,
    to: HexCoordinates | string,
    options: UpdateGameboardPlacementOptions = {}
  ) => updateGameboardPlacement(world, placement, { ...options, at: to }),
  removePlacement: (placement: Entity | string) => removeGameboardPlacement(world, placement),
}));

export function createGameboardWorld(plan?: GameboardPlan): World {
  const world = createWorld();
  if (plan) {
    spawnGameboardPlan(world, plan);
  }
  return world;
}

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

export function moveGameboardPlacement(
  world: World,
  placement: Entity | string,
  to: HexCoordinates | string,
  options: Omit<UpdateGameboardPlacementOptions, 'at'> = {}
): Entity {
  return updateGameboardPlacement(world, placement, { ...options, at: to });
}

export function removeGameboardPlacement(world: World, placement: Entity | string): boolean {
  const entity = findPlacementEntity(world, placement);
  if (!entity) {
    return false;
  }
  entity.destroy();
  syncGameboardPlacementCount(world);
  return true;
}

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

export function findTileEntity(
  world: World,
  coordinates: HexCoordinates | string
): Entity | undefined {
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  return world.query(GameboardTileQuery).find((entity) => entity.get(HexTileState)?.key === key);
}

export function findPlacementEntity(world: World, placement: Entity | string): Entity | undefined {
  if (typeof placement !== 'string') {
    return placement;
  }
  return world
    .query(GameboardPlacementQuery)
    .find((entity) => entity.get(PlacementState)?.id === placement);
}

export function readGameboardTiles(world: World): HexTileStateValue[] {
  const tiles: HexTileStateValue[] = [];
  world.query(GameboardTileQuery).readEach(([tile]) => {
    tiles.push(copyTileState(tile));
  });
  return tiles.sort(compareByHexKey);
}

export function readGameboardPlacements(world: World): PlacementStateValue[] {
  const placements: PlacementStateValue[] = [];
  world.query(GameboardPlacementQuery).readEach(([placement]) => {
    placements.push(copyPlacementState(placement));
  });
  return placements.sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id)
  );
}

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
