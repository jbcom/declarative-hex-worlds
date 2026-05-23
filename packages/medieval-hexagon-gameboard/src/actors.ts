import {
  createActions,
  createQuery,
  trait,
  type Entity,
  type TraitRecord,
  type World,
} from 'koota';
import { hexDistance, hexKey, hexRange, neighbors, parseHexKey } from './coordinates';
import type {
  GameboardPlacementKind,
  GameboardPlacementLayer,
  GameboardPlacementSpec,
  GameboardPlan,
  GameboardTileSpec,
} from './gameboard';
import {
  HexTileState,
  IsGameboardPlacement,
  PlacementState,
  findPlacementEntity,
  findTileEntity,
  moveGameboardPlacement,
  readPlacementOccupancyForTile,
  readPlacementsForTile,
  spawnGameboardPlacement,
  updateGameboardPlacement,
  type HexTileStateValue,
  type PlacementOccupancySnapshot,
  type PlacementStateValue,
  type SpawnGameboardPlacementOptions,
  type UpdateGameboardPlacementOptions,
} from './koota';
import {
  createGameboardNavigation,
  type GameboardNavigationContext,
  type GameboardNavigationPathResult,
  type GameboardNavigationProfile,
} from './navigation';
import { gameboardPlacementBlocksOccupancy } from './occupancy';
import { projectWorldToGameboardPlan } from './projection';
import type { HexCoordinates } from './types';

export type GameboardActorKind =
  | 'player'
  | 'npc'
  | 'enemy'
  | 'prop'
  | 'unit'
  | 'neutral'
  | (string & {});
export type GameboardActorMetadataValue = string | number | boolean | null;

export interface GameboardActorRegistrationOptions {
  actorId: string;
  actorKind?: GameboardActorKind;
  faction?: string | null;
  team?: string | null;
  hostile?: boolean;
  blocksMovement?: boolean;
  interactive?: boolean;
  tags?: readonly string[];
  actorMetadata?: Readonly<Record<string, GameboardActorMetadataValue>>;
}

export interface UpdateGameboardActorOptions {
  actorId?: string;
  actorKind?: GameboardActorKind;
  faction?: string | null;
  team?: string | null;
  hostile?: boolean;
  blocksMovement?: boolean;
  interactive?: boolean;
  tags?: readonly string[];
  actorMetadata?: Readonly<Record<string, GameboardActorMetadataValue>>;
}

export interface SpawnGameboardActorOptions
  extends SpawnGameboardPlacementOptions,
    GameboardActorRegistrationOptions {}

export type MoveGameboardActorOptions = Omit<UpdateGameboardPlacementOptions, 'at'>;

export interface GameboardActorSnapshot {
  entity: Entity;
  actor: GameboardActorValue;
  placement: PlacementStateValue;
}

export interface GameboardActorCollisionProfile {
  blockingPlacementKinds?: readonly GameboardPlacementKind[];
  blockingPlacementLayers?: readonly GameboardPlacementLayer[];
  ignorePlacementIds?: readonly string[];
  treatHostileAsBlocking?: boolean;
  treatInteractiveAsBlocking?: boolean;
  treatPropsAsBlocking?: boolean;
}

export interface GameboardActorCollisionReport {
  source?: GameboardActorSnapshot;
  targetTileKey: string;
  placements: readonly PlacementStateValue[];
  actorPlacements: readonly GameboardActorSnapshot[];
  blockingPlacements: readonly PlacementStateValue[];
  hostileActors: readonly GameboardActorSnapshot[];
  interactiveActors: readonly GameboardActorSnapshot[];
  propActors: readonly GameboardActorSnapshot[];
  canEnter: boolean;
  reason?: string;
}

export interface GameboardActorNavigationOptions extends GameboardActorCollisionProfile {
  baseProfile?: GameboardNavigationProfile;
}

export type GameboardInteractionTargetKind = 'actor' | 'placement' | 'tile' | 'empty';
export type GameboardInteractionIntent = 'move' | 'interact' | 'attack' | 'inspect';
export type GameboardInteractionCommandKind =
  | 'move'
  | 'interact-actor'
  | 'interact-placement'
  | 'attack-actor'
  | 'inspect-actor'
  | 'inspect-placement'
  | 'inspect-tile'
  | 'none';

export type GameboardInteractionTargetInput =
  | string
  | HexCoordinates
  | {
      placementId?: string;
      actorId?: string;
      tileKey?: string;
      coordinates?: HexCoordinates | string;
    };

export interface GameboardInteractionTargetOptions extends GameboardActorCollisionProfile {
  sourceActor?: Entity | string;
}

export interface GameboardInteractionTargetReport {
  kind: GameboardInteractionTargetKind;
  intent: GameboardInteractionIntent;
  tileKey?: string;
  placement?: PlacementStateValue;
  actor?: GameboardActorSnapshot;
  placements: readonly PlacementStateValue[];
  actors: readonly GameboardActorSnapshot[];
  collision?: GameboardActorCollisionReport;
  canEnter: boolean;
}

export interface GameboardTileInspectionOptions extends GameboardActorCollisionProfile {
  sourceActor?: Entity | string;
}

export interface GameboardTileInspection {
  exists: boolean;
  tileKey: string;
  tile?: HexTileStateValue;
  coordinates?: HexCoordinates;
  terrain?: GameboardTileSpec['terrain'];
  elevation?: number;
  tags: readonly string[];
  placements: readonly PlacementStateValue[];
  occupancy: readonly PlacementOccupancySnapshot[];
  actors: readonly GameboardActorSnapshot[];
  hostileActors: readonly GameboardActorSnapshot[];
  interactiveActors: readonly GameboardActorSnapshot[];
  propActors: readonly GameboardActorSnapshot[];
  blockingPlacements: readonly PlacementStateValue[];
  collision: GameboardActorCollisionReport;
  canEnter: boolean;
  isEmpty: boolean;
  hasActors: boolean;
  hasHostiles: boolean;
  hasInteractive: boolean;
  hasProps: boolean;
  reason?: string;
}

export type GameboardNeighborhoodCenter = HexCoordinates | string | Entity;

export interface GameboardNeighborhoodInspectionOptions
  extends GameboardTileInspectionOptions {
  radius?: number;
  includeCenter?: boolean;
  includeMissing?: boolean;
  terrain?: GameboardTileSpec['terrain'] | readonly GameboardTileSpec['terrain'][];
  tileTags?: readonly string[];
  excludeTileTags?: readonly string[];
  canEnter?: boolean;
  hasActors?: boolean;
  hasHostiles?: boolean;
  hasInteractive?: boolean;
  hasProps?: boolean;
}

export interface GameboardNeighborhoodTileInspection extends GameboardTileInspection {
  distance: number;
}

export interface GameboardNeighborhoodInspection {
  center: HexCoordinates;
  centerKey: string;
  radius: number;
  tiles: readonly GameboardNeighborhoodTileInspection[];
  actors: readonly GameboardActorSnapshot[];
  hostileActors: readonly GameboardActorSnapshot[];
  interactiveActors: readonly GameboardActorSnapshot[];
  propActors: readonly GameboardActorSnapshot[];
  enterableTileKeys: readonly string[];
  occupiedTileKeys: readonly string[];
  blockingTileKeys: readonly string[];
}

export type GameboardActorSelectionSort = 'actorId' | 'distance' | 'tileKey';

export interface GameboardActorSelectionOptions {
  actorIds?: string | readonly string[];
  placementIds?: string | readonly string[];
  kinds?: GameboardActorKind | readonly GameboardActorKind[];
  teams?: string | readonly string[];
  factions?: string | readonly string[];
  tags?: readonly string[];
  excludeTags?: readonly string[];
  tileKeys?: string | readonly string[];
  center?: GameboardNeighborhoodCenter;
  radius?: number;
  sourceActor?: Entity | string;
  includeSource?: boolean;
  hostile?: boolean;
  interactive?: boolean;
  blocksMovement?: boolean;
  hostileToSource?: boolean;
  sort?: GameboardActorSelectionSort;
}

export interface GameboardActorSelection {
  actors: readonly GameboardActorSnapshot[];
  records: readonly GameboardActorSelectionRecord[];
  count: number;
  actorIds: readonly string[];
  placementIds: readonly string[];
  tileKeys: readonly string[];
  byTileKey: Readonly<Record<string, readonly GameboardActorSnapshot[]>>;
  recordsByTileKey: Readonly<Record<string, readonly GameboardActorSelectionRecord[]>>;
  hostileActors: readonly GameboardActorSnapshot[];
  interactiveActors: readonly GameboardActorSnapshot[];
  propActors: readonly GameboardActorSnapshot[];
  source?: GameboardActorSnapshot;
  center?: HexCoordinates;
  centerKey?: string;
  radius?: number;
}

export interface GameboardActorSelectionRecord {
  actorId: string;
  placementId: string;
  kind: GameboardActorKind;
  faction?: string;
  team?: string;
  hostile: boolean;
  hostileToSource?: boolean;
  blocksMovement: boolean;
  interactive: boolean;
  tags: readonly string[];
  metadata: Readonly<Record<string, GameboardActorMetadataValue>>;
  tileKey: string;
  coordinates: HexCoordinates;
  distance?: number;
  assetId: string;
  placementKind: GameboardPlacementKind;
  layer: GameboardPlacementLayer;
  requiresExtra: boolean;
}

export type GameboardActorTargetApproach = 'target-tile' | 'adjacent' | 'nearest';
export type GameboardActorTargetSort = 'pathCost' | 'distance' | 'actorId' | 'tileKey';

export interface GameboardActorTargetingOptions
  extends Omit<GameboardActorSelectionOptions, 'sourceActor' | 'sort'> {
  sourceActor: Entity | string;
  navigation?: GameboardActorNavigationOptions;
  approach?: GameboardActorTargetApproach;
  maxPathCost?: number;
  includeUnreachable?: boolean;
  sort?: GameboardActorTargetSort;
}

export interface GameboardActorTarget {
  actor: GameboardActorSnapshot;
  record: GameboardActorSelectionRecord;
  command: GameboardInteractionCommand;
  path: GameboardNavigationPathResult;
  approach: GameboardActorTargetApproach | 'self' | 'none';
  approachTileKey?: string;
  reachable: boolean;
  reason?: string;
}

export interface GameboardActorTargetingReport {
  source?: GameboardActorSnapshot;
  selection: GameboardActorSelection;
  targets: readonly GameboardActorTarget[];
  reachableTargets: readonly GameboardActorTarget[];
  targetActorIds: readonly string[];
  reachableActorIds: readonly string[];
  nearestTarget?: GameboardActorTarget;
  reason?: string;
}

export interface GameboardInteractionCommandOptions extends GameboardInteractionTargetOptions {
  requireSourceActorForMove?: boolean;
  requireSourceActorForAttack?: boolean;
  requireSourceActorForInteraction?: boolean;
}

export interface GameboardInteractionCommand {
  kind: GameboardInteractionCommandKind;
  intent: GameboardInteractionIntent;
  target: GameboardInteractionTargetReport;
  source?: GameboardActorSnapshot;
  tileKey?: string;
  placementId?: string;
  actorId?: string;
  canExecute: boolean;
  reason?: string;
}

export const GameboardActor = trait({
  actorId: '',
  kind: 'neutral' as GameboardActorKind,
  faction: undefined as string | undefined,
  team: undefined as string | undefined,
  hostile: false,
  blocksMovement: false,
  interactive: false,
  tags: () => [] as string[],
  metadata: () => ({}) as Record<string, GameboardActorMetadataValue>,
});

export const IsGameboardActor = trait();
export const IsPlayerActor = trait();
export const IsNpcActor = trait();
export const IsEnemyActor = trait();
export const IsPropActor = trait();
export const IsHostileActor = trait();
export const IsInteractiveActor = trait();
export const IsBlockingActor = trait();

export const GameboardActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsGameboardActor,
  GameboardActor
);
export const PlayerActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsPlayerActor,
  GameboardActor
);
export const NpcActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsNpcActor,
  GameboardActor
);
export const EnemyActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsEnemyActor,
  GameboardActor
);
export const PropActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsPropActor,
  GameboardActor
);
export const HostileActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsHostileActor,
  GameboardActor
);
export const InteractiveActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsInteractiveActor,
  GameboardActor
);
export const BlockingActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsBlockingActor,
  GameboardActor
);

export type GameboardActorValue = TraitRecord<typeof GameboardActor>;

const DEFAULT_COLLISION_PROFILE = {
  blockingPlacementKinds: ['structure', 'unit'] as readonly GameboardPlacementKind[],
  blockingPlacementLayers: [] as readonly GameboardPlacementLayer[],
  ignorePlacementIds: [] as readonly string[],
  treatHostileAsBlocking: true,
  treatInteractiveAsBlocking: false,
  treatPropsAsBlocking: false,
} satisfies Required<GameboardActorCollisionProfile>;

export const gameboardActorActions = createActions((world) => ({
  spawn: (options: SpawnGameboardActorOptions) => spawnGameboardActor(world, options),
  register: (placement: Entity | string, options: GameboardActorRegistrationOptions) =>
    registerGameboardActor(world, placement, options),
  update: (actor: Entity | string, options: UpdateGameboardActorOptions) =>
    updateGameboardActor(world, actor, options),
  move: (
    actor: Entity | string,
    to: HexCoordinates | string,
    options: MoveGameboardActorOptions = {}
  ) => moveGameboardActor(world, actor, to, options),
  read: () => readGameboardActors(world),
  collision: (
    actor: Entity | string | undefined,
    target: HexCoordinates | string,
    profile: GameboardActorCollisionProfile = {}
  ) => inspectGameboardActorCollision(world, actor, target, profile),
  navigationProfile: (actor: Entity | string, options: GameboardActorNavigationOptions = {}) =>
    createGameboardActorNavigationProfile(world, actor, options),
  interaction: (
    target: GameboardInteractionTargetInput,
    options: GameboardInteractionTargetOptions = {}
  ) => inspectGameboardInteractionTarget(world, target, options),
  tile: (coordinates: HexCoordinates | string, options: GameboardTileInspectionOptions = {}) =>
    inspectGameboardTile(world, coordinates, options),
  neighborhood: (
    center: GameboardNeighborhoodCenter,
    options: GameboardNeighborhoodInspectionOptions = {}
  ) => inspectGameboardNeighborhood(world, center, options),
  select: (options: GameboardActorSelectionOptions = {}) => selectGameboardActors(world, options),
  targets: (options: GameboardActorTargetingOptions) => inspectGameboardActorTargets(world, options),
  command: (
    target: GameboardInteractionTargetInput,
    options: GameboardInteractionCommandOptions = {}
  ) => planGameboardInteractionCommand(world, target, options),
}));

export function spawnGameboardActor(world: World, options: SpawnGameboardActorOptions): Entity {
  const actorKind = options.actorKind ?? inferActorKindFromPlacementKind(options.kind);
  const placementMetadata = {
    ...(options.metadata ?? {}),
    actorId: options.actorId,
    actorKind,
    actorFaction: options.faction ?? null,
    actorTeam: options.team ?? null,
  };
  const entity = spawnGameboardPlacement(world, {
    id: options.id,
    at: options.at,
    assetId: options.assetId,
    kind: options.kind,
    layer: options.layer,
    textureSet: options.textureSet,
    elevationOffset: options.elevationOffset,
    positionOffset: options.positionOffset,
    rotationSteps: options.rotationSteps,
    scale: options.scale,
    order: options.order,
    stackIndex: options.stackIndex,
    requiresExtra: options.requiresExtra,
    metadata: placementMetadata,
    occupancyGuard: options.occupancyGuard,
  });
  return registerGameboardActor(world, entity, {
    actorId: options.actorId,
    actorKind,
    faction: options.faction,
    team: options.team,
    hostile: options.hostile,
    blocksMovement: options.blocksMovement,
    interactive: options.interactive,
    tags: options.tags,
    actorMetadata: options.actorMetadata,
  });
}

export function registerGameboardActor(
  world: World,
  placement: Entity | string,
  options: GameboardActorRegistrationOptions
): Entity {
  const entity = requirePlacementEntity(world, placement);
  const placementState = requirePlacementState(entity);
  const actor = actorValueFromOptions(options, placementState);
  updatePlacementActorMetadata(world, entity, actor);
  setActorTraits(entity, actor);
  return entity;
}

export function updateGameboardActor(
  world: World,
  actor: Entity | string,
  options: UpdateGameboardActorOptions
): Entity {
  const entity = requireActorEntity(world, actor);
  const placementState = requirePlacementState(entity);
  const current = entity.get(GameboardActor);
  const next = actorValueFromOptions(
    {
      actorId: options.actorId ?? current?.actorId ?? placementState.id,
      actorKind: options.actorKind ?? current?.kind,
      faction: options.faction ?? current?.faction,
      team: options.team ?? current?.team,
      hostile: options.hostile ?? current?.hostile,
      blocksMovement: options.blocksMovement ?? current?.blocksMovement,
      interactive: options.interactive ?? current?.interactive,
      tags: options.tags ?? current?.tags,
      actorMetadata: options.actorMetadata ?? current?.metadata,
    },
    placementState
  );
  updatePlacementActorMetadata(world, entity, next);
  setActorTraits(entity, next);
  return entity;
}

export function moveGameboardActor(
  world: World,
  actor: Entity | string,
  to: HexCoordinates | string,
  options: MoveGameboardActorOptions = {}
): Entity {
  return moveGameboardPlacement(world, requireActorEntity(world, actor), to, options);
}

export function findGameboardActorEntity(
  world: World,
  actorOrPlacement: Entity | string
): Entity | undefined {
  if (typeof actorOrPlacement !== 'string') {
    return actorOrPlacement.has(GameboardActor) ? actorOrPlacement : undefined;
  }
  const placement = findPlacementEntity(world, actorOrPlacement);
  if (placement?.has(GameboardActor)) {
    return placement;
  }
  return world
    .query(GameboardActorQuery)
    .find((entity) => entity.get(GameboardActor)?.actorId === actorOrPlacement);
}

export function findGameboardActor(
  world: World,
  actorOrPlacement: Entity | string
): GameboardActorSnapshot | undefined {
  const entity = findGameboardActorEntity(world, actorOrPlacement);
  return entity ? snapshotForActorEntity(entity) : undefined;
}

export function readGameboardActors(world: World): GameboardActorSnapshot[] {
  return world
    .query(GameboardActorQuery)
    .map(snapshotForActorEntity)
    .sort((left, right) => left.actor.actorId.localeCompare(right.actor.actorId));
}

export function selectGameboardActors(
  world: World,
  options: GameboardActorSelectionOptions = {}
): GameboardActorSelection {
  const source = options.sourceActor ? findGameboardActor(world, options.sourceActor) : undefined;
  const centerInput =
    options.center ??
    (options.radius !== undefined ? (source?.entity ?? source?.actor.actorId) : undefined);
  const center = centerInput ? resolveNeighborhoodCenter(world, centerInput) : undefined;
  const radius = options.radius === undefined ? undefined : Math.max(0, Math.floor(options.radius));
  const actors = readGameboardActors(world)
    .filter((snapshot) => matchesActorSelection(snapshot, options, source, center, radius))
    .sort((left, right) => compareActorSelection(left, right, options.sort ?? 'actorId', center));
  const records = actors.map((snapshot) => actorSelectionRecord(snapshot, source, center));
  const hostileActors = actors.filter((snapshot) => actorHostileForSelection(snapshot, source));
  const interactiveActors = actors.filter((snapshot) => snapshot.actor.interactive);
  const propActors = actors.filter((snapshot) => snapshot.actor.kind === 'prop');

  return {
    actors,
    records,
    count: actors.length,
    actorIds: actors.map((snapshot) => snapshot.actor.actorId),
    placementIds: actors.map((snapshot) => snapshot.placement.id),
    tileKeys: uniqueStrings(actors.map((snapshot) => snapshot.placement.tileKey)),
    byTileKey: groupActorsByTileKey(actors),
    recordsByTileKey: groupActorRecordsByTileKey(records),
    hostileActors,
    interactiveActors,
    propActors,
    source,
    center: center ? { ...center } : undefined,
    centerKey: center ? hexKey(center) : undefined,
    radius,
  };
}

export function inspectGameboardActorTargets(
  world: World,
  options: GameboardActorTargetingOptions
): GameboardActorTargetingReport {
  const {
    sourceActor,
    navigation,
    approach = 'nearest',
    maxPathCost,
    includeUnreachable = true,
    sort = 'pathCost',
    ...selectionOptions
  } = options;
  const source = findGameboardActor(world, sourceActor);
  if (!source) {
    return {
      selection: emptyGameboardActorSelection(),
      targets: [],
      reachableTargets: [],
      targetActorIds: [],
      reachableActorIds: [],
      reason: `No source actor exists for ${String(sourceActor)}`,
    };
  }

  const selection = selectGameboardActors(world, {
    ...selectionOptions,
    sourceActor: source.entity,
    includeSource: selectionOptions.includeSource ?? false,
    sort: actorTargetSelectionSort(sort),
  });
  const plan = projectWorldToGameboardPlan(world);
  const profile = createGameboardActorNavigationProfile(world, source.entity, navigation);
  const normalizedMaxPathCost =
    maxPathCost === undefined ? undefined : Math.max(0, Math.floor(maxPathCost));
  const targets = selection.actors
    .map((actor) =>
      inspectActorTarget(world, plan, profile, source, actor, approach, normalizedMaxPathCost)
    )
    .filter((target) => includeUnreachable || target.reachable)
    .sort((left, right) => compareActorTargets(left, right, sort));
  const reachableTargets = targets.filter((target) => target.reachable);

  return {
    source,
    selection,
    targets,
    reachableTargets,
    targetActorIds: targets.map((target) => target.actor.actor.actorId),
    reachableActorIds: reachableTargets.map((target) => target.actor.actor.actorId),
    nearestTarget: reachableTargets[0] ?? targets[0],
  };
}

export function readGameboardActorsForTile(
  world: World,
  coordinates: HexCoordinates | string
): GameboardActorSnapshot[] {
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  return readGameboardActors(world).filter((snapshot) => snapshot.placement.tileKey === key);
}

export function classifyGameboardPlacement(
  world: World,
  actorOrPlacement: Entity | string
): GameboardActorKind | undefined {
  return findGameboardActor(world, actorOrPlacement)?.actor.kind;
}

export function areGameboardActorsHostile(
  left: GameboardActorValue | GameboardActorSnapshot | undefined,
  right: GameboardActorValue | GameboardActorSnapshot | undefined
): boolean {
  const leftActor = unwrapActor(left);
  const rightActor = unwrapActor(right);
  if (!leftActor || !rightActor) {
    return false;
  }
  if (sameActorTeam(leftActor, rightActor)) {
    return false;
  }
  return leftActor.hostile || rightActor.hostile;
}

export function inspectGameboardActorCollision(
  world: World,
  actor: Entity | string | undefined,
  target: HexCoordinates | string,
  profile: GameboardActorCollisionProfile = {}
): GameboardActorCollisionReport {
  const normalized = normalizeCollisionProfile(profile);
  const source = actor ? findGameboardActor(world, actor) : undefined;
  const targetTileKey = typeof target === 'string' ? target : hexKey(target);
  const ignored = new Set([
    ...(source ? [source.placement.id] : []),
    ...normalized.ignorePlacementIds,
  ]);
  const placements = readPlacementsForTile(world, targetTileKey).filter(
    (placement) => !ignored.has(placement.id)
  );
  const actorPlacements = placements
    .map((placement) => findGameboardActor(world, placement.id))
    .filter((snapshot): snapshot is GameboardActorSnapshot => snapshot !== undefined);
  const hostileActors = actorPlacements.filter((snapshot) =>
    source ? areGameboardActorsHostile(source.actor, snapshot.actor) : snapshot.actor.hostile
  );
  const interactiveActors = actorPlacements.filter((snapshot) => snapshot.actor.interactive);
  const propActors = actorPlacements.filter((snapshot) => snapshot.actor.kind === 'prop');
  const blockingPlacements = placements.filter((placement) =>
    placementBlocksActorMovement(
      placement,
      actorPlacements.find((snapshot) => snapshot.placement.id === placement.id),
      normalized
    )
  );

  return {
    source,
    targetTileKey,
    placements,
    actorPlacements,
    blockingPlacements,
    hostileActors,
    interactiveActors,
    propActors,
    canEnter: blockingPlacements.length === 0,
    reason:
      blockingPlacements.length > 0
        ? `Tile ${targetTileKey} has ${blockingPlacements.length} blocking placement(s)`
        : undefined,
  };
}

export function createGameboardActorNavigationProfile(
  world: World,
  actor: Entity | string,
  options: GameboardActorNavigationOptions = {}
): GameboardNavigationProfile {
  const source = findGameboardActor(world, actor);
  const base = options.baseProfile ?? {};
  const ignored = [
    ...(base.ignorePlacementIds ?? []),
    ...(source ? [source.placement.id] : []),
    ...(options.ignorePlacementIds ?? []),
  ];
  const collisionProfile: GameboardActorCollisionProfile = {
    blockingPlacementKinds: options.blockingPlacementKinds ?? base.blockingPlacementKinds,
    blockingPlacementLayers: options.blockingPlacementLayers ?? base.blockingPlacementLayers,
    ignorePlacementIds: ignored,
    treatHostileAsBlocking: options.treatHostileAsBlocking,
    treatInteractiveAsBlocking: options.treatInteractiveAsBlocking,
    treatPropsAsBlocking: options.treatPropsAsBlocking,
  };

  return {
    ...base,
    ignorePlacementIds: uniqueStrings(ignored),
    canEnter: (tile: GameboardTileSpec, context: GameboardNavigationContext) => {
      if (base.canEnter && !base.canEnter(tile, context)) {
        return false;
      }
      return inspectGameboardActorCollision(
        world,
        source?.entity ?? actor,
        tile.key,
        collisionProfile
      ).canEnter;
    },
  };
}

export function inspectGameboardInteractionTarget(
  world: World,
  target: GameboardInteractionTargetInput,
  options: GameboardInteractionTargetOptions = {}
): GameboardInteractionTargetReport {
  const resolved = resolveGameboardInteractionTarget(world, target);
  const tileKey = resolved.tileKey;
  const placements = tileKey ? readPlacementsForTile(world, tileKey) : [];
  const actors = tileKey ? readGameboardActorsForTile(world, tileKey) : [];
  const actor =
    resolved.actor ??
    (resolved.placement
      ? actors.find((snapshot) => snapshot.placement.id === resolved.placement?.id)
      : undefined);
  const { sourceActor, ...collisionOptions } = options;
  const collision = tileKey
    ? inspectGameboardActorCollision(world, sourceActor, tileKey, collisionOptions)
    : undefined;
  const kind = interactionTargetKind(resolved.placement, actor, tileKey);

  return {
    kind,
    intent: interactionIntent(kind, actor, resolved.placement, collision),
    tileKey,
    placement: resolved.placement,
    actor,
    placements,
    actors,
    collision,
    canEnter: collision?.canEnter ?? kind !== 'empty',
  };
}

export function inspectGameboardTile(
  world: World,
  coordinates: HexCoordinates | string,
  options: GameboardTileInspectionOptions = {}
): GameboardTileInspection {
  const tileKey = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  const tileState = findTileEntity(world, tileKey)?.get(HexTileState);
  const tile = tileState ? copyActorTileState(tileState) : undefined;
  const placements = readPlacementsForTile(world, tileKey);
  const occupancy = readPlacementOccupancyForTile(world, tileKey);
  const actors = readGameboardActorsForTile(world, tileKey);
  const { sourceActor, ...collisionOptions } = options;
  const collision = inspectGameboardActorCollision(world, sourceActor, tileKey, collisionOptions);
  const exists = tile !== undefined;

  return {
    exists,
    tileKey,
    tile,
    coordinates: tile?.coordinates,
    terrain: tile?.terrain,
    elevation: tile?.elevation,
    tags: tile?.tags ?? [],
    placements,
    occupancy,
    actors,
    hostileActors: collision.hostileActors,
    interactiveActors: collision.interactiveActors,
    propActors: collision.propActors,
    blockingPlacements: collision.blockingPlacements,
    collision,
    canEnter: exists && collision.canEnter,
    isEmpty: placements.length === 0,
    hasActors: actors.length > 0,
    hasHostiles: collision.hostileActors.length > 0,
    hasInteractive: collision.interactiveActors.length > 0,
    hasProps: collision.propActors.length > 0,
    reason: exists ? collision.reason : `No tile exists at ${tileKey}`,
  };
}

export function inspectGameboardNeighborhood(
  world: World,
  center: GameboardNeighborhoodCenter,
  options: GameboardNeighborhoodInspectionOptions = {}
): GameboardNeighborhoodInspection {
  const {
    radius: requestedRadius = 1,
    includeCenter = true,
    includeMissing = false,
    terrain,
    tileTags = [],
    excludeTileTags = [],
    canEnter,
    hasActors,
    hasHostiles,
    hasInteractive,
    hasProps,
    ...tileOptions
  } = options;
  const centerCoordinates = resolveNeighborhoodCenter(world, center);
  const centerKey = hexKey(centerCoordinates);
  const radius = Math.max(0, Math.floor(requestedRadius));
  const tiles = hexRange(centerCoordinates, radius)
    .map((coordinates) => {
      const inspection = inspectGameboardTile(world, coordinates, tileOptions);
      return {
        ...inspection,
        distance: hexDistance(centerCoordinates, coordinates),
      };
    })
    .filter((inspection) => includeCenter || inspection.tileKey !== centerKey)
    .filter((inspection) => includeMissing || inspection.exists)
    .filter((inspection) =>
      matchesNeighborhoodFilters(inspection, {
        terrain,
        tileTags,
        excludeTileTags,
        canEnter,
        hasActors,
        hasHostiles,
        hasInteractive,
        hasProps,
      })
    )
    .sort(compareNeighborhoodTiles);
  const actors = uniqueActorSnapshots(tiles.flatMap((tile) => tile.actors));
  const hostileActors = uniqueActorSnapshots(tiles.flatMap((tile) => tile.hostileActors));
  const interactiveActors = uniqueActorSnapshots(tiles.flatMap((tile) => tile.interactiveActors));
  const propActors = uniqueActorSnapshots(tiles.flatMap((tile) => tile.propActors));

  return {
    center: { ...centerCoordinates },
    centerKey,
    radius,
    tiles,
    actors,
    hostileActors,
    interactiveActors,
    propActors,
    enterableTileKeys: tiles.filter((tile) => tile.canEnter).map((tile) => tile.tileKey),
    occupiedTileKeys: tiles.filter(tileHasGameplayOccupancy).map((tile) => tile.tileKey),
    blockingTileKeys: tiles
      .filter((tile) => tile.blockingPlacements.length > 0)
      .map((tile) => tile.tileKey),
  };
}

export function planGameboardInteractionCommand(
  world: World,
  target: GameboardInteractionTargetInput,
  options: GameboardInteractionCommandOptions = {}
): GameboardInteractionCommand {
  const targetReport = inspectGameboardInteractionTarget(world, target, options);
  const source = options.sourceActor ? findGameboardActor(world, options.sourceActor) : undefined;
  const requireSourceActorForMove = options.requireSourceActorForMove ?? true;
  const requireSourceActorForAttack = options.requireSourceActorForAttack ?? true;
  const requireSourceActorForInteraction = options.requireSourceActorForInteraction ?? false;

  if (targetReport.intent === 'move') {
    return interactionCommand({
      kind: 'move',
      target: targetReport,
      source,
      canExecute: Boolean(
        targetReport.tileKey && targetReport.canEnter && (!requireSourceActorForMove || source)
      ),
      reason: !targetReport.tileKey
        ? 'No target tile'
        : !targetReport.canEnter
          ? (targetReport.collision?.reason ?? 'Target tile is blocked')
          : requireSourceActorForMove && !source
            ? 'Move commands require a source actor'
            : undefined,
    });
  }

  if (targetReport.intent === 'attack') {
    return interactionCommand({
      kind: targetReport.actor ? 'attack-actor' : 'inspect-placement',
      target: targetReport,
      source,
      canExecute: Boolean(targetReport.actor && (!requireSourceActorForAttack || source)),
      reason: targetReport.actor
        ? requireSourceActorForAttack && !source
          ? 'Attack commands require a source actor'
          : undefined
        : 'No attackable actor target',
    });
  }

  if (targetReport.intent === 'interact') {
    return interactionCommand({
      kind: targetReport.actor ? 'interact-actor' : 'interact-placement',
      target: targetReport,
      source,
      canExecute: Boolean(
        (targetReport.actor || targetReport.placement) &&
          (!requireSourceActorForInteraction || source)
      ),
      reason:
        requireSourceActorForInteraction && !source
          ? 'Interaction commands require a source actor'
          : targetReport.actor || targetReport.placement
            ? undefined
            : 'No interactable target',
    });
  }

  return interactionCommand({
    kind: inspectCommandKind(targetReport),
    target: targetReport,
    source,
    canExecute: targetReport.kind !== 'empty',
    reason: targetReport.kind === 'empty' ? 'No target resolved' : undefined,
  });
}

export function gameboardActorBlocksMovement(
  actor: GameboardActorValue | undefined,
  placement?: Pick<GameboardPlacementSpec, 'kind' | 'layer'>,
  profile: GameboardActorCollisionProfile = {}
): boolean {
  return placementBlocksActorMovement(
    placementStateFromKindLayer(placement),
    actor ? ({ actor } as GameboardActorSnapshot) : undefined,
    normalizeCollisionProfile(profile)
  );
}

function resolveGameboardInteractionTarget(
  world: World,
  target: GameboardInteractionTargetInput
): {
  tileKey?: string;
  placement?: PlacementStateValue;
  actor?: GameboardActorSnapshot;
} {
  if (typeof target === 'string') {
    return resolveGameboardInteractionTargetFromString(world, target);
  }
  if (isHexCoordinates(target)) {
    return { tileKey: hexKey(target) };
  }

  const placement = target.placementId ? findPlacementState(world, target.placementId) : undefined;
  const actor = placement
    ? findGameboardActor(world, placement.id)
    : target.actorId
      ? findGameboardActor(world, target.actorId)
      : undefined;
  const tileKey =
    placement?.tileKey ??
    actor?.placement.tileKey ??
    target.tileKey ??
    coordinatesInputKey(target.coordinates);
  return {
    tileKey,
    placement: placement ?? actor?.placement,
    actor,
  };
}

function resolveGameboardInteractionTargetFromString(
  world: World,
  value: string
): {
  tileKey?: string;
  placement?: PlacementStateValue;
  actor?: GameboardActorSnapshot;
} {
  const placement = findPlacementState(world, value);
  if (placement) {
    return {
      tileKey: placement.tileKey,
      placement,
      actor: findGameboardActor(world, placement.id),
    };
  }
  const actor = findGameboardActor(world, value);
  if (actor) {
    return {
      tileKey: actor.placement.tileKey,
      placement: actor.placement,
      actor,
    };
  }
  return findTileEntity(world, value) ? { tileKey: value } : {};
}

function findPlacementState(world: World, placementId: string): PlacementStateValue | undefined {
  const entity = findPlacementEntity(world, placementId);
  const state = entity?.get(PlacementState);
  return state ? copyPlacementState(state) : undefined;
}

function resolveNeighborhoodCenter(
  world: World,
  center: GameboardNeighborhoodCenter
): HexCoordinates {
  if (isHexCoordinates(center)) {
    return { ...center };
  }

  if (typeof center !== 'string') {
    const placement = center.get(PlacementState);
    if (placement) {
      return { ...placement.coordinates };
    }
    const actor = findGameboardActor(world, center);
    if (actor) {
      return { ...actor.placement.coordinates };
    }
  }

  if (typeof center === 'string') {
    const actor = findGameboardActor(world, center);
    if (actor) {
      return { ...actor.placement.coordinates };
    }
    const placement = findPlacementState(world, center);
    if (placement) {
      return { ...placement.coordinates };
    }
    const tile = findTileEntity(world, center)?.get(HexTileState);
    if (tile) {
      return { ...tile.coordinates };
    }
    try {
      return parseHexKey(center);
    } catch {
      throw new Error(`No tile, placement, actor, or hex key found for neighborhood center: ${center}`);
    }
  }

  throw new Error('No tile, placement, actor, or hex key found for neighborhood center');
}

function matchesNeighborhoodFilters(
  inspection: GameboardNeighborhoodTileInspection,
  filters: Pick<
    GameboardNeighborhoodInspectionOptions,
    | 'terrain'
    | 'tileTags'
    | 'excludeTileTags'
    | 'canEnter'
    | 'hasActors'
    | 'hasHostiles'
    | 'hasInteractive'
    | 'hasProps'
  >
): boolean {
  return (
    matchesTerrainFilter(inspection.terrain, filters.terrain) &&
    includesAllTags(inspection.tags, filters.tileTags ?? []) &&
    excludesAllTags(inspection.tags, filters.excludeTileTags ?? []) &&
    matchesOptionalBoolean(inspection.canEnter, filters.canEnter) &&
    matchesOptionalBoolean(inspection.hasActors, filters.hasActors) &&
    matchesOptionalBoolean(inspection.hasHostiles, filters.hasHostiles) &&
    matchesOptionalBoolean(inspection.hasInteractive, filters.hasInteractive) &&
    matchesOptionalBoolean(inspection.hasProps, filters.hasProps)
  );
}

function matchesTerrainFilter(
  actual: GameboardTileSpec['terrain'] | undefined,
  expected: GameboardNeighborhoodInspectionOptions['terrain']
): boolean {
  if (expected === undefined) {
    return true;
  }
  if (actual === undefined) {
    return false;
  }
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

function includesAllTags(actual: readonly string[], expected: readonly string[]): boolean {
  return expected.every((tag) => actual.includes(tag));
}

function excludesAllTags(actual: readonly string[], excluded: readonly string[]): boolean {
  return excluded.every((tag) => !actual.includes(tag));
}

function matchesOptionalBoolean(actual: boolean, expected: boolean | undefined): boolean {
  return expected === undefined || actual === expected;
}

function compareNeighborhoodTiles(
  left: GameboardNeighborhoodTileInspection,
  right: GameboardNeighborhoodTileInspection
): number {
  return left.distance - right.distance || left.tileKey.localeCompare(right.tileKey);
}

function tileHasGameplayOccupancy(tile: GameboardNeighborhoodTileInspection): boolean {
  return tile.actors.length > 0 || tile.placements.some((placement) => !isSurfacePlacement(placement));
}

function uniqueActorSnapshots(
  snapshots: readonly GameboardActorSnapshot[]
): GameboardActorSnapshot[] {
  const seen = new Set<string>();
  const unique: GameboardActorSnapshot[] = [];
  for (const snapshot of snapshots) {
    const key = snapshot.actor.actorId || snapshot.placement.id;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(snapshot);
  }
  return unique.sort((left, right) => left.actor.actorId.localeCompare(right.actor.actorId));
}

function matchesActorSelection(
  snapshot: GameboardActorSnapshot,
  options: GameboardActorSelectionOptions,
  source: GameboardActorSnapshot | undefined,
  center: HexCoordinates | undefined,
  radius: number | undefined
): boolean {
  return (
    matchesStringSelection(snapshot.actor.actorId, options.actorIds) &&
    matchesStringSelection(snapshot.placement.id, options.placementIds) &&
    matchesStringSelection(snapshot.actor.kind, options.kinds) &&
    matchesStringSelection(snapshot.actor.team, options.teams) &&
    matchesStringSelection(snapshot.actor.faction, options.factions) &&
    matchesStringSelection(snapshot.placement.tileKey, options.tileKeys) &&
    includesAllTags(snapshot.actor.tags, options.tags ?? []) &&
    excludesAllTags(snapshot.actor.tags, options.excludeTags ?? []) &&
    matchesOptionalBoolean(snapshot.actor.hostile, options.hostile) &&
    matchesOptionalBoolean(snapshot.actor.interactive, options.interactive) &&
    matchesOptionalBoolean(snapshot.actor.blocksMovement, options.blocksMovement) &&
    matchesSourceInclusion(snapshot, source, options.includeSource ?? true) &&
    matchesHostilitySelection(snapshot, source, options.hostileToSource) &&
    matchesActorRadius(snapshot, center, radius)
  );
}

function matchesStringSelection(
  actual: string | undefined,
  expected: string | readonly string[] | undefined
): boolean {
  if (expected === undefined) {
    return true;
  }
  if (actual === undefined) {
    return false;
  }
  return toReadonlyArray(expected).includes(actual);
}

function matchesSourceInclusion(
  snapshot: GameboardActorSnapshot,
  source: GameboardActorSnapshot | undefined,
  includeSource: boolean
): boolean {
  return (
    includeSource ||
    !source ||
    (snapshot.actor.actorId !== source.actor.actorId && snapshot.placement.id !== source.placement.id)
  );
}

function matchesHostilitySelection(
  snapshot: GameboardActorSnapshot,
  source: GameboardActorSnapshot | undefined,
  hostileToSource: boolean | undefined
): boolean {
  if (hostileToSource === undefined) {
    return true;
  }
  if (!source) {
    return hostileToSource === false;
  }
  return areGameboardActorsHostile(source, snapshot) === hostileToSource;
}

function matchesActorRadius(
  snapshot: GameboardActorSnapshot,
  center: HexCoordinates | undefined,
  radius: number | undefined
): boolean {
  return radius === undefined || !center || hexDistance(center, snapshot.placement.coordinates) <= radius;
}

function compareActorSelection(
  left: GameboardActorSnapshot,
  right: GameboardActorSnapshot,
  sort: GameboardActorSelectionSort,
  center: HexCoordinates | undefined
): number {
  if (sort === 'distance' && center) {
    return (
      hexDistance(center, left.placement.coordinates) -
        hexDistance(center, right.placement.coordinates) ||
      left.actor.actorId.localeCompare(right.actor.actorId)
    );
  }
  if (sort === 'tileKey') {
    return (
      left.placement.tileKey.localeCompare(right.placement.tileKey) ||
      left.actor.actorId.localeCompare(right.actor.actorId)
    );
  }
  return left.actor.actorId.localeCompare(right.actor.actorId);
}

function actorHostileForSelection(
  snapshot: GameboardActorSnapshot,
  source: GameboardActorSnapshot | undefined
): boolean {
  return source ? areGameboardActorsHostile(source, snapshot) : snapshot.actor.hostile;
}

function actorSelectionRecord(
  snapshot: GameboardActorSnapshot,
  source: GameboardActorSnapshot | undefined,
  center: HexCoordinates | undefined
): GameboardActorSelectionRecord {
  return {
    actorId: snapshot.actor.actorId,
    placementId: snapshot.placement.id,
    kind: snapshot.actor.kind,
    faction: snapshot.actor.faction,
    team: snapshot.actor.team,
    hostile: snapshot.actor.hostile,
    hostileToSource: source ? areGameboardActorsHostile(source, snapshot) : undefined,
    blocksMovement: snapshot.actor.blocksMovement,
    interactive: snapshot.actor.interactive,
    tags: [...snapshot.actor.tags],
    metadata: { ...snapshot.actor.metadata },
    tileKey: snapshot.placement.tileKey,
    coordinates: { ...snapshot.placement.coordinates },
    distance: center ? hexDistance(center, snapshot.placement.coordinates) : undefined,
    assetId: snapshot.placement.assetId,
    placementKind: snapshot.placement.kind,
    layer: snapshot.placement.layer,
    requiresExtra: snapshot.placement.requiresExtra,
  };
}

function groupActorsByTileKey(
  actors: readonly GameboardActorSnapshot[]
): Readonly<Record<string, readonly GameboardActorSnapshot[]>> {
  const grouped: Record<string, GameboardActorSnapshot[]> = {};
  for (const actor of actors) {
    grouped[actor.placement.tileKey] = [...(grouped[actor.placement.tileKey] ?? []), actor];
  }
  return grouped;
}

function groupActorRecordsByTileKey(
  records: readonly GameboardActorSelectionRecord[]
): Readonly<Record<string, readonly GameboardActorSelectionRecord[]>> {
  const grouped: Record<string, GameboardActorSelectionRecord[]> = {};
  for (const record of records) {
    grouped[record.tileKey] = [...(grouped[record.tileKey] ?? []), record];
  }
  return grouped;
}

function emptyGameboardActorSelection(): GameboardActorSelection {
  return {
    actors: [],
    records: [],
    count: 0,
    actorIds: [],
    placementIds: [],
    tileKeys: [],
    byTileKey: {},
    recordsByTileKey: {},
    hostileActors: [],
    interactiveActors: [],
    propActors: [],
  };
}

function actorTargetSelectionSort(sort: GameboardActorTargetSort): GameboardActorSelectionSort {
  if (sort === 'distance') {
    return 'distance';
  }
  if (sort === 'tileKey') {
    return 'tileKey';
  }
  return 'actorId';
}

function inspectActorTarget(
  world: World,
  plan: GameboardPlan,
  profile: GameboardNavigationProfile,
  source: GameboardActorSnapshot,
  actor: GameboardActorSnapshot,
  approach: GameboardActorTargetApproach,
  maxPathCost: number | undefined
): GameboardActorTarget {
  const command = planGameboardInteractionCommand(
    world,
    { actorId: actor.actor.actorId },
    { sourceActor: source.entity }
  );
  const route = bestActorTargetRoute(plan, profile, source, actor, approach);
  const path = route?.path ?? emptyActorTargetPath();
  const exceedsMaxPathCost = maxPathCost !== undefined && path.cost > maxPathCost;
  const reachable = path.found && !exceedsMaxPathCost;

  return {
    actor,
    record: actorSelectionRecord(actor, source, source.placement.coordinates),
    command,
    path,
    approach: route?.approach ?? 'none',
    approachTileKey: route?.tileKey,
    reachable,
    reason: reachable
      ? undefined
      : !path.found
        ? `No ${approach} path to actor ${actor.actor.actorId}`
        : `Path costs ${path.cost}; maximum path cost is ${maxPathCost}`,
  };
}

function bestActorTargetRoute(
  plan: GameboardPlan,
  profile: GameboardNavigationProfile,
  source: GameboardActorSnapshot,
  actor: GameboardActorSnapshot,
  approach: GameboardActorTargetApproach
): ActorTargetRoute | undefined {
  const candidates = actorTargetRouteCandidates(plan, source, actor, approach);
  return candidates
    .map((candidate) => {
      const navigation = createGameboardNavigation(plan, {
        ...profile,
        allowGoalBlocked: candidate.approach === 'target-tile',
      });
      return {
        ...candidate,
        path: navigation.findPath(source.placement.tileKey, candidate.tileKey),
      };
    })
    .sort(compareActorTargetRoutes)[0];
}

interface ActorTargetRouteCandidate {
  approach: GameboardActorTarget['approach'];
  tileKey: string;
}

interface ActorTargetRoute extends ActorTargetRouteCandidate {
  path: GameboardNavigationPathResult;
}

function actorTargetRouteCandidates(
  plan: GameboardPlan,
  source: GameboardActorSnapshot,
  actor: GameboardActorSnapshot,
  approach: GameboardActorTargetApproach
): ActorTargetRouteCandidate[] {
  if (source.placement.tileKey === actor.placement.tileKey) {
    return [{ approach: 'self', tileKey: source.placement.tileKey }];
  }

  const tiles = new Set(plan.tiles.map((tile) => tile.key));
  const candidates: ActorTargetRouteCandidate[] = [];
  if (approach === 'target-tile' || approach === 'nearest') {
    candidates.push({ approach: 'target-tile', tileKey: actor.placement.tileKey });
  }
  if (approach === 'adjacent' || approach === 'nearest') {
    for (const adjacent of neighbors(actor.placement.coordinates)) {
      const tileKey = hexKey(adjacent);
      if (tiles.has(tileKey)) {
        candidates.push({ approach: 'adjacent', tileKey });
      }
    }
  }
  return uniqueActorTargetRouteCandidates(candidates);
}

function uniqueActorTargetRouteCandidates(
  candidates: readonly ActorTargetRouteCandidate[]
): ActorTargetRouteCandidate[] {
  const seen = new Set<string>();
  const unique: ActorTargetRouteCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.approach}:${candidate.tileKey}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(candidate);
    }
  }
  return unique;
}

function compareActorTargetRoutes(left: ActorTargetRoute, right: ActorTargetRoute): number {
  return (
    Number(right.path.found) - Number(left.path.found) ||
    left.path.cost - right.path.cost ||
    actorTargetApproachWeight(left.approach) - actorTargetApproachWeight(right.approach) ||
    left.tileKey.localeCompare(right.tileKey)
  );
}

function compareActorTargets(
  left: GameboardActorTarget,
  right: GameboardActorTarget,
  sort: GameboardActorTargetSort
): number {
  if (sort === 'pathCost') {
    return (
      Number(right.reachable) - Number(left.reachable) ||
      left.path.cost - right.path.cost ||
      (left.record.distance ?? Number.POSITIVE_INFINITY) -
        (right.record.distance ?? Number.POSITIVE_INFINITY) ||
      left.actor.actor.actorId.localeCompare(right.actor.actor.actorId)
    );
  }
  if (sort === 'distance') {
    return (
      (left.record.distance ?? Number.POSITIVE_INFINITY) -
        (right.record.distance ?? Number.POSITIVE_INFINITY) ||
      left.path.cost - right.path.cost ||
      left.actor.actor.actorId.localeCompare(right.actor.actor.actorId)
    );
  }
  if (sort === 'tileKey') {
    return (
      left.record.tileKey.localeCompare(right.record.tileKey) ||
      left.actor.actor.actorId.localeCompare(right.actor.actor.actorId)
    );
  }
  return left.actor.actor.actorId.localeCompare(right.actor.actor.actorId);
}

function actorTargetApproachWeight(approach: GameboardActorTarget['approach']): number {
  if (approach === 'self') {
    return 0;
  }
  if (approach === 'target-tile') {
    return 1;
  }
  if (approach === 'adjacent') {
    return 2;
  }
  return 3;
}

function emptyActorTargetPath(): GameboardNavigationPathResult {
  return {
    found: false,
    path: [],
    coordinates: [],
    cost: Number.POSITIVE_INFINITY,
    visited: 0,
  };
}

function toReadonlyArray<T>(value: T | readonly T[]): readonly T[] {
  return Array.isArray(value) ? (value as readonly T[]) : [value as T];
}

function interactionTargetKind(
  placement: PlacementStateValue | undefined,
  actor: GameboardActorSnapshot | undefined,
  tileKey: string | undefined
): GameboardInteractionTargetKind {
  if (actor) {
    return 'actor';
  }
  if (placement) {
    return 'placement';
  }
  return tileKey ? 'tile' : 'empty';
}

function interactionIntent(
  kind: GameboardInteractionTargetKind,
  actor: GameboardActorSnapshot | undefined,
  placement: PlacementStateValue | undefined,
  collision: GameboardActorCollisionReport | undefined
): GameboardInteractionIntent {
  if (actor) {
    if (collision?.source && areGameboardActorsHostile(collision.source, actor)) {
      return 'attack';
    }
    return actor.actor.interactive ? 'interact' : 'inspect';
  }
  if (kind === 'tile') {
    return collision?.canEnter === false ? 'inspect' : 'move';
  }
  if (placement && isSurfacePlacement(placement)) {
    return collision?.canEnter === false ? 'inspect' : 'move';
  }
  return 'inspect';
}

function interactionCommand(input: {
  kind: GameboardInteractionCommandKind;
  target: GameboardInteractionTargetReport;
  source?: GameboardActorSnapshot;
  canExecute: boolean;
  reason?: string;
}): GameboardInteractionCommand {
  return {
    kind: input.kind,
    intent: input.target.intent,
    target: input.target,
    source: input.source,
    tileKey: input.target.tileKey,
    placementId: input.target.placement?.id,
    actorId: input.target.actor?.actor.actorId,
    canExecute: input.canExecute,
    reason: input.reason,
  };
}

function inspectCommandKind(
  target: GameboardInteractionTargetReport
): GameboardInteractionCommandKind {
  if (target.actor) {
    return 'inspect-actor';
  }
  if (target.placement) {
    return 'inspect-placement';
  }
  if (target.kind === 'tile') {
    return 'inspect-tile';
  }
  return 'none';
}

function isSurfacePlacement(placement: Pick<PlacementStateValue, 'kind' | 'layer'>): boolean {
  return (
    placement.layer === 'terrain' || placement.layer === 'surface' || placement.kind === 'terrain'
  );
}

function actorValueFromOptions(
  options: GameboardActorRegistrationOptions,
  placement: Pick<PlacementStateValue, 'id' | 'kind'>
): GameboardActorValue {
  const kind = options.actorKind ?? inferActorKindFromPlacementKind(placement.kind);
  return {
    actorId: options.actorId,
    kind,
    faction: options.faction ?? undefined,
    team: options.team ?? options.faction ?? undefined,
    hostile: options.hostile ?? kind === 'enemy',
    blocksMovement: options.blocksMovement ?? defaultActorBlocksMovement(kind, placement.kind),
    interactive: options.interactive ?? (kind === 'npc' || kind === 'prop'),
    tags: [...(options.tags ?? [])],
    metadata: { ...(options.actorMetadata ?? {}) },
  };
}

function setActorTraits(entity: Entity, actor: GameboardActorValue): void {
  entity.remove(
    IsGameboardActor,
    IsPlayerActor,
    IsNpcActor,
    IsEnemyActor,
    IsPropActor,
    IsHostileActor,
    IsInteractiveActor,
    IsBlockingActor
  );
  entity.add(IsGameboardActor);
  if (entity.has(GameboardActor)) {
    entity.set(GameboardActor, copyActorValue(actor));
  } else {
    entity.add(GameboardActor(copyActorValue(actor)));
  }
  switch (actor.kind) {
    case 'player':
      entity.add(IsPlayerActor);
      break;
    case 'npc':
      entity.add(IsNpcActor);
      break;
    case 'enemy':
      entity.add(IsEnemyActor);
      break;
    case 'prop':
      entity.add(IsPropActor);
      break;
  }
  if (actor.hostile) {
    entity.add(IsHostileActor);
  }
  if (actor.interactive) {
    entity.add(IsInteractiveActor);
  }
  if (actor.blocksMovement) {
    entity.add(IsBlockingActor);
  }
}

function updatePlacementActorMetadata(
  world: World,
  entity: Entity,
  actor: GameboardActorValue
): void {
  const current = requirePlacementState(entity);
  updateGameboardPlacement(world, entity, {
    metadata: {
      ...current.metadata,
      actorId: actor.actorId,
      actorKind: actor.kind,
      actorFaction: actor.faction ?? null,
      actorTeam: actor.team ?? null,
      actorHostile: actor.hostile,
      actorBlocksMovement: actor.blocksMovement,
      actorInteractive: actor.interactive,
    },
  });
}

function placementBlocksActorMovement(
  placement: Pick<PlacementStateValue, 'id' | 'tileKey' | 'kind' | 'layer' | 'metadata'>,
  snapshot: GameboardActorSnapshot | undefined,
  profile: Required<GameboardActorCollisionProfile>
): boolean {
  if (snapshot?.actor.blocksMovement) {
    return true;
  }
  if (snapshot?.actor.hostile && profile.treatHostileAsBlocking) {
    return true;
  }
  if (snapshot?.actor.interactive && profile.treatInteractiveAsBlocking) {
    return true;
  }
  if (snapshot?.actor.kind === 'prop' && profile.treatPropsAsBlocking) {
    return true;
  }
  return gameboardPlacementBlocksOccupancy(placement, profile);
}

function normalizeCollisionProfile(
  profile: GameboardActorCollisionProfile
): Required<GameboardActorCollisionProfile> {
  return {
    blockingPlacementKinds:
      profile.blockingPlacementKinds ?? DEFAULT_COLLISION_PROFILE.blockingPlacementKinds,
    blockingPlacementLayers:
      profile.blockingPlacementLayers ?? DEFAULT_COLLISION_PROFILE.blockingPlacementLayers,
    ignorePlacementIds: profile.ignorePlacementIds ?? DEFAULT_COLLISION_PROFILE.ignorePlacementIds,
    treatHostileAsBlocking:
      profile.treatHostileAsBlocking ?? DEFAULT_COLLISION_PROFILE.treatHostileAsBlocking,
    treatInteractiveAsBlocking:
      profile.treatInteractiveAsBlocking ?? DEFAULT_COLLISION_PROFILE.treatInteractiveAsBlocking,
    treatPropsAsBlocking:
      profile.treatPropsAsBlocking ?? DEFAULT_COLLISION_PROFILE.treatPropsAsBlocking,
  };
}

function inferActorKindFromPlacementKind(kind: GameboardPlacementKind): GameboardActorKind {
  switch (kind) {
    case 'unit':
      return 'unit';
    case 'prop':
    case 'decoration':
      return 'prop';
    case 'structure':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function defaultActorBlocksMovement(
  kind: GameboardActorKind,
  placementKind: GameboardPlacementKind
): boolean {
  if (placementKind === 'structure') {
    return true;
  }
  return kind === 'player' || kind === 'enemy' || kind === 'unit';
}

function snapshotForActorEntity(entity: Entity): GameboardActorSnapshot {
  return {
    entity,
    actor: copyActorValue(requireActorState(entity)),
    placement: copyPlacementState(requirePlacementState(entity)),
  };
}

function unwrapActor(
  value: GameboardActorValue | GameboardActorSnapshot | undefined
): GameboardActorValue | undefined {
  if (!value) {
    return undefined;
  }
  return 'actor' in value ? value.actor : value;
}

function sameActorTeam(left: GameboardActorValue, right: GameboardActorValue): boolean {
  const leftTeam = left.team ?? left.faction;
  const rightTeam = right.team ?? right.faction;
  return Boolean(leftTeam && rightTeam && leftTeam === rightTeam);
}

function requireActorEntity(world: World, actor: Entity | string): Entity {
  const entity = findGameboardActorEntity(world, actor);
  if (!entity) {
    throw new Error(
      `No gameboard actor exists with id ${typeof actor === 'string' ? actor : String(actor.id())}`
    );
  }
  return entity;
}

function requirePlacementEntity(world: World, placement: Entity | string): Entity {
  const entity = findPlacementEntity(world, placement);
  if (!entity) {
    throw new Error(
      `No placement exists with id ${typeof placement === 'string' ? placement : String(placement.id())}`
    );
  }
  return entity;
}

function requirePlacementState(entity: Entity): PlacementStateValue {
  const placement = entity.get(PlacementState);
  if (!placement) {
    throw new Error(`Placement entity ${entity.id()} is missing PlacementState`);
  }
  return copyPlacementState(placement);
}

function requireActorState(entity: Entity): GameboardActorValue {
  const actor = entity.get(GameboardActor);
  if (!actor) {
    throw new Error(`Placement entity ${entity.id()} is missing GameboardActor`);
  }
  return copyActorValue(actor);
}

function copyActorValue(actor: GameboardActorValue): GameboardActorValue {
  return {
    ...actor,
    tags: [...actor.tags],
    metadata: { ...actor.metadata },
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

function copyActorTileState(tile: HexTileStateValue): HexTileStateValue {
  return {
    ...tile,
    coordinates: { ...tile.coordinates },
    tags: [...tile.tags],
  };
}

function placementStateFromKindLayer(
  placement: Pick<GameboardPlacementSpec, 'kind' | 'layer'> | undefined
): Pick<PlacementStateValue, 'id' | 'tileKey' | 'kind' | 'layer' | 'metadata'> {
  return {
    id: '',
    tileKey: '',
    kind: placement?.kind ?? 'prop',
    layer: placement?.layer ?? 'feature',
    metadata: {},
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function coordinatesInputKey(input: HexCoordinates | string | undefined): string | undefined {
  if (!input) {
    return undefined;
  }
  return typeof input === 'string' ? input : hexKey(input);
}

function isHexCoordinates(value: unknown): value is HexCoordinates {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const coordinates = value as HexCoordinates;
  return typeof coordinates.q === 'number' && typeof coordinates.r === 'number';
}
