/**
 * Actor helpers for player, NPC, enemy, prop, collision, interaction target,
 * and actor-aware pathing workflows on a live gameboard runtime.
 *
 * @module
 */
import { createActions, createQuery, type Entity, type TraitRecord, type World } from 'koota';
import { hexDistance, hexKey, hexRange, neighbors, parseHexKey } from '../coordinates';
import { GameboardRuntimeError } from '../errors';
import type {
  GameboardPlacementKind,
  GameboardPlacementLayer,
  GameboardPlacementSpec,
  GameboardPlan,
  GameboardTileSpec,
} from '../gameboard';
import { HexTileState, IsGameboardPlacement, PlacementState } from '../traits';
import {
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
} from '../koota';
import {
  createGameboardNavigation,
  type GameboardNavigationContext,
  type GameboardNavigationPathResult,
  type GameboardNavigationProfile,
} from '../gameboard';
import { gameboardPlacementBlocksOccupancy } from '../gameboard';
import { projectWorldToGameboardPlan } from '../coordinates';
import type { HexCoordinates } from '../types';

// `GameboardActorKind`, `GameboardActorMetadataValue`, the `GameboardActor`
// trait, and the IsX actor markers all live in `src/traits` so trait
// declarations stay free of sibling-sub-package runtime dependencies. The
// re-exports below preserve the historical public surface.
export type { GameboardActorKind, GameboardActorMetadataValue } from '../traits';
import type { GameboardActorKind, GameboardActorMetadataValue } from '../traits';

/**
 * Options for attaching gameplay actor state to an existing placement.
 */
export interface GameboardActorRegistrationOptions {
  /** Stable gameplay actor id. */
  actorId: string;
  /** Gameplay actor kind. Defaults from placement kind. */
  actorKind?: GameboardActorKind;
  /** Optional faction identifier. */
  faction?: string | null;
  /** Optional team identifier. Defaults to faction when omitted. */
  team?: string | null;
  /** Whether this actor is generally hostile. */
  hostile?: boolean;
  /** Whether this actor blocks actor movement. */
  blocksMovement?: boolean;
  /** Whether this actor should be considered an interaction target. */
  interactive?: boolean;
  /** Free-form actor tags used by selectors and quests. */
  tags?: readonly string[];
  /** Serializable actor metadata independent from placement metadata. */
  actorMetadata?: Readonly<Record<string, GameboardActorMetadataValue>>;
}

/**
 * Options for updating gameplay actor state while preserving omitted fields.
 */
export interface UpdateGameboardActorOptions {
  /** Replacement gameplay actor id. */
  actorId?: string;
  /** Replacement gameplay actor kind. */
  actorKind?: GameboardActorKind;
  /** Replacement faction identifier. */
  faction?: string | null;
  /** Replacement team identifier. */
  team?: string | null;
  /** Replacement hostility flag. */
  hostile?: boolean;
  /** Replacement movement-blocking flag. */
  blocksMovement?: boolean;
  /** Replacement interaction-target flag. */
  interactive?: boolean;
  /** Replacement actor tags. */
  tags?: readonly string[];
  /** Replacement serializable actor metadata. */
  actorMetadata?: Readonly<Record<string, GameboardActorMetadataValue>>;
}

/**
 * Options for spawning a placement and registering it as an actor in one call.
 */
export interface SpawnGameboardActorOptions
  extends SpawnGameboardPlacementOptions,
    GameboardActorRegistrationOptions {}

/**
 * Placement update options accepted while moving an actor.
 */
export type MoveGameboardActorOptions = Omit<UpdateGameboardPlacementOptions, 'at'>;

/**
 * Joined runtime snapshot for an actor entity and its placement.
 */
export interface GameboardActorSnapshot {
  /** Live Koota entity. */
  entity: Entity;
  /** Actor trait value. */
  actor: GameboardActorValue;
  /** Placement trait value associated with the actor. */
  placement: PlacementStateValue;
}

/**
 * Collision policy used by actor movement, navigation, and targeting helpers.
 */
export interface GameboardActorCollisionProfile {
  /** Placement kinds that should block actor movement. */
  blockingPlacementKinds?: readonly GameboardPlacementKind[];
  /** Placement layers that should block actor movement. */
  blockingPlacementLayers?: readonly GameboardPlacementLayer[];
  /** Placement ids ignored during collision checks. */
  ignorePlacementIds?: readonly string[];
  /** Treat hostile actors as movement blockers. */
  treatHostileAsBlocking?: boolean;
  /** Treat interactive actors as movement blockers. */
  treatInteractiveAsBlocking?: boolean;
  /** Treat prop actors as movement blockers. */
  treatPropsAsBlocking?: boolean;
}

/**
 * Collision inspection result for one actor attempting to enter one tile.
 */
export interface GameboardActorCollisionReport {
  /** Source actor being tested, when provided. */
  source?: GameboardActorSnapshot;
  /** Target tile key that was inspected. */
  targetTileKey: string;
  /** Placements found on the target tile after ignored ids are removed. */
  placements: readonly PlacementStateValue[];
  /** Actor placements found on the target tile. */
  actorPlacements: readonly GameboardActorSnapshot[];
  /** Placements that block movement under the active collision profile. */
  blockingPlacements: readonly PlacementStateValue[];
  /** Hostile actors on the target tile. */
  hostileActors: readonly GameboardActorSnapshot[];
  /** Interactive actors on the target tile. */
  interactiveActors: readonly GameboardActorSnapshot[];
  /** Prop actors on the target tile. */
  propActors: readonly GameboardActorSnapshot[];
  /** Whether the source actor can enter the target tile. */
  canEnter: boolean;
  /** Blocked reason when `canEnter` is false. */
  reason?: string;
}

/**
 * Actor-aware navigation options layered on top of a navigation profile.
 */
export interface GameboardActorNavigationOptions extends GameboardActorCollisionProfile {
  /** Base navigation profile to extend with actor collision behavior. */
  baseProfile?: GameboardNavigationProfile;
}

/**
 * Kind of target resolved from a click, tile coordinate, actor id, or placement id.
 */
export type GameboardInteractionTargetKind = 'actor' | 'placement' | 'tile' | 'empty';
/**
 * High-level intent inferred from an interaction target.
 */
export type GameboardInteractionIntent = 'move' | 'interact' | 'attack' | 'inspect';
/**
 * Concrete command kind produced from an interaction target.
 */
export type GameboardInteractionCommandKind =
  | 'move'
  | 'interact-actor'
  | 'interact-placement'
  | 'attack-actor'
  | 'inspect-actor'
  | 'inspect-placement'
  | 'inspect-tile'
  | 'none';

/**
 * Input accepted by interaction helpers when resolving a target.
 */
export type GameboardInteractionTargetInput =
  | string
  | HexCoordinates
  | {
      /** Placement id to resolve directly. */
      placementId?: string;
      /** Actor id to resolve directly. */
      actorId?: string;
      /** Tile key to resolve directly. */
      tileKey?: string;
      /** Axial coordinates or tile key to resolve as a tile. */
      coordinates?: HexCoordinates | string;
    };

/**
 * Options for inspecting an interaction target.
 */
export interface GameboardInteractionTargetOptions extends GameboardActorCollisionProfile {
  /** Source actor used for hostility and collision interpretation. */
  sourceActor?: Entity | string;
}

/**
 * Resolved interaction target plus nearby placement, actor, and collision data.
 */
export interface GameboardInteractionTargetReport {
  /** Resolved target kind. */
  kind: GameboardInteractionTargetKind;
  /** Inferred interaction intent. */
  intent: GameboardInteractionIntent;
  /** Resolved tile key, when any target is on a tile. */
  tileKey?: string;
  /** Resolved placement target. */
  placement?: PlacementStateValue;
  /** Resolved actor target. */
  actor?: GameboardActorSnapshot;
  /** Placements on the resolved tile. */
  placements: readonly PlacementStateValue[];
  /** Actors on the resolved tile. */
  actors: readonly GameboardActorSnapshot[];
  /** Actor collision report for the resolved tile. */
  collision?: GameboardActorCollisionReport;
  /** Whether the source actor can enter the resolved tile. */
  canEnter: boolean;
}

/**
 * Options for inspecting one board tile from an actor/gameplay perspective.
 */
export interface GameboardTileInspectionOptions extends GameboardActorCollisionProfile {
  /** Source actor used for collision interpretation. */
  sourceActor?: Entity | string;
}

/**
 * Actor-aware tile inspection result for UI, AI, quests, and tests.
 */
export interface GameboardTileInspection {
  /** Whether the tile exists in the board. */
  exists: boolean;
  /** Inspected tile key. */
  tileKey: string;
  /** Tile trait value, when the tile exists. */
  tile?: HexTileStateValue;
  /** Axial coordinates, when the tile exists. */
  coordinates?: HexCoordinates;
  /** Tile terrain, when the tile exists. */
  terrain?: GameboardTileSpec['terrain'];
  /** Tile elevation, when the tile exists. */
  elevation?: number;
  /** Tile tags, or an empty list for missing tiles. */
  tags: readonly string[];
  /** Placements occupying the tile. */
  placements: readonly PlacementStateValue[];
  /** Occupancy relation records for the tile. */
  occupancy: readonly PlacementOccupancySnapshot[];
  /** Actor placements on the tile. */
  actors: readonly GameboardActorSnapshot[];
  /** Hostile actors on the tile. */
  hostileActors: readonly GameboardActorSnapshot[];
  /** Interactive actors on the tile. */
  interactiveActors: readonly GameboardActorSnapshot[];
  /** Prop actors on the tile. */
  propActors: readonly GameboardActorSnapshot[];
  /** Placements that block movement onto the tile. */
  blockingPlacements: readonly PlacementStateValue[];
  /** Full collision report for the tile. */
  collision: GameboardActorCollisionReport;
  /** Whether the tile exists and can be entered. */
  canEnter: boolean;
  /** Whether no placements occupy the tile. */
  isEmpty: boolean;
  /** Whether any actors occupy the tile. */
  hasActors: boolean;
  /** Whether any hostile actors occupy the tile. */
  hasHostiles: boolean;
  /** Whether any interactive actors occupy the tile. */
  hasInteractive: boolean;
  /** Whether any prop actors occupy the tile. */
  hasProps: boolean;
  /** Missing or blocked reason. */
  reason?: string;
}

/**
 * Input accepted when resolving the center of a neighborhood inspection.
 */
export type GameboardNeighborhoodCenter = HexCoordinates | string | Entity;

/**
 * Filters and options for actor-aware neighborhood inspection.
 */
export interface GameboardNeighborhoodInspectionOptions extends GameboardTileInspectionOptions {
  /** Hex radius around the center. Defaults to `1`. */
  radius?: number;
  /** Include the center tile in results. Defaults to true. */
  includeCenter?: boolean;
  /** Include missing tiles in results. Defaults to false. */
  includeMissing?: boolean;
  /** Required terrain or accepted terrains. */
  terrain?: GameboardTileSpec['terrain'] | readonly GameboardTileSpec['terrain'][];
  /** Required tile tags. */
  tileTags?: readonly string[];
  /** Tile tags that must be absent. */
  excludeTileTags?: readonly string[];
  /** Filter by enterable state. */
  canEnter?: boolean;
  /** Filter by actor presence. */
  hasActors?: boolean;
  /** Filter by hostile actor presence. */
  hasHostiles?: boolean;
  /** Filter by interactive actor presence. */
  hasInteractive?: boolean;
  /** Filter by prop actor presence. */
  hasProps?: boolean;
}

/**
 * Tile inspection with distance from the inspected neighborhood center.
 */
export interface GameboardNeighborhoodTileInspection extends GameboardTileInspection {
  /** Hex distance from the neighborhood center. */
  distance: number;
}

/**
 * Actor-aware inspection for a ring or radius around a center tile.
 */
export interface GameboardNeighborhoodInspection {
  /** Resolved center coordinates. */
  center: HexCoordinates;
  /** Resolved center tile key. */
  centerKey: string;
  /** Normalized inspection radius. */
  radius: number;
  /** Matching tile inspections sorted by distance and tile key. */
  tiles: readonly GameboardNeighborhoodTileInspection[];
  /** Unique actors found in matching tiles. */
  actors: readonly GameboardActorSnapshot[];
  /** Unique hostile actors found in matching tiles. */
  hostileActors: readonly GameboardActorSnapshot[];
  /** Unique interactive actors found in matching tiles. */
  interactiveActors: readonly GameboardActorSnapshot[];
  /** Unique prop actors found in matching tiles. */
  propActors: readonly GameboardActorSnapshot[];
  /** Tile keys that can be entered. */
  enterableTileKeys: readonly string[];
  /** Tile keys with gameplay occupancy. */
  occupiedTileKeys: readonly string[];
  /** Tile keys with blocking placements. */
  blockingTileKeys: readonly string[];
}

/**
 * Sort modes for actor selection results.
 */
export type GameboardActorSelectionSort = 'actorId' | 'distance' | 'tileKey';

/**
 * Filter options for selecting actors from the world.
 */
export interface GameboardActorSelectionOptions {
  /** Actor id or ids to include. */
  actorIds?: string | readonly string[];
  /** Placement id or ids to include. */
  placementIds?: string | readonly string[];
  /** Actor kind or kinds to include. */
  kinds?: GameboardActorKind | readonly GameboardActorKind[];
  /** Team id or ids to include. */
  teams?: string | readonly string[];
  /** Faction id or ids to include. */
  factions?: string | readonly string[];
  /** Actor tags that must all be present. */
  tags?: readonly string[];
  /** Actor tags that must all be absent. */
  excludeTags?: readonly string[];
  /** Tile key or keys to include. */
  tileKeys?: string | readonly string[];
  /** Optional center used by radius filtering and distance sorting. */
  center?: GameboardNeighborhoodCenter;
  /** Maximum hex distance from `center` or `sourceActor`. */
  radius?: number;
  /** Source actor used for hostility and default center resolution. */
  sourceActor?: Entity | string;
  /** Include the source actor in results. Defaults to true. */
  includeSource?: boolean;
  /** Filter by actor hostile flag. */
  hostile?: boolean;
  /** Filter by actor interactive flag. */
  interactive?: boolean;
  /** Filter by actor movement-blocking flag. */
  blocksMovement?: boolean;
  /** Filter by hostility relative to `sourceActor`. */
  hostileToSource?: boolean;
  /** Sort mode for selected actors. */
  sort?: GameboardActorSelectionSort;
}

/**
 * Aggregated actor selection result for gameplay systems and UIs.
 */
export interface GameboardActorSelection {
  /** Matching actor snapshots. */
  actors: readonly GameboardActorSnapshot[];
  /** Serializable records for matching actors. */
  records: readonly GameboardActorSelectionRecord[];
  /** Number of matching actors. */
  count: number;
  /** Matching actor ids. */
  actorIds: readonly string[];
  /** Matching placement ids. */
  placementIds: readonly string[];
  /** Unique tile keys occupied by matching actors. */
  tileKeys: readonly string[];
  /** Matching actors grouped by tile key. */
  byTileKey: Readonly<Record<string, readonly GameboardActorSnapshot[]>>;
  /** Matching records grouped by tile key. */
  recordsByTileKey: Readonly<Record<string, readonly GameboardActorSelectionRecord[]>>;
  /** Matching actors hostile to the source or generally hostile. */
  hostileActors: readonly GameboardActorSnapshot[];
  /** Matching interactive actors. */
  interactiveActors: readonly GameboardActorSnapshot[];
  /** Matching prop actors. */
  propActors: readonly GameboardActorSnapshot[];
  /** Source actor used for the selection. */
  source?: GameboardActorSnapshot;
  /** Resolved center coordinates used for radius and distance. */
  center?: HexCoordinates;
  /** Resolved center tile key. */
  centerKey?: string;
  /** Normalized radius used for filtering. */
  radius?: number;
}

/**
 * Serializable actor selection row for logs, tests, UIs, and quests.
 */
export interface GameboardActorSelectionRecord {
  /** Actor id. */
  actorId: string;
  /** Placement id associated with the actor. */
  placementId: string;
  /** Actor kind. */
  kind: GameboardActorKind;
  /** Actor faction id. */
  faction?: string;
  /** Actor team id. */
  team?: string;
  /** Whether the actor is generally hostile. */
  hostile: boolean;
  /** Whether this actor is hostile to the selection source. */
  hostileToSource?: boolean;
  /** Whether the actor blocks movement. */
  blocksMovement: boolean;
  /** Whether the actor is an interaction target. */
  interactive: boolean;
  /** Actor tags. */
  tags: readonly string[];
  /** Actor metadata. */
  metadata: Readonly<Record<string, GameboardActorMetadataValue>>;
  /** Occupied tile key. */
  tileKey: string;
  /** Occupied tile coordinates. */
  coordinates: HexCoordinates;
  /** Distance from the selection center, when available. */
  distance?: number;
  /** Placement asset id. */
  assetId: string;
  /** Underlying placement kind. */
  placementKind: GameboardPlacementKind;
  /** Underlying placement layer. */
  layer: GameboardPlacementLayer;
  /** Whether the placement requires local-only EXTRA assets. */
  requiresExtra: boolean;
}

/**
 * Strategy used when pathing to a target actor.
 */
export type GameboardActorTargetApproach = 'target-tile' | 'adjacent' | 'nearest';
/**
 * Sort modes for target reports.
 */
export type GameboardActorTargetSort = 'pathCost' | 'distance' | 'actorId' | 'tileKey';

/**
 * Options for selecting and pathing to potential actor targets.
 */
export interface GameboardActorTargetingOptions
  extends Omit<GameboardActorSelectionOptions, 'sourceActor' | 'sort'> {
  /** Source actor that will path toward selected targets. */
  sourceActor: Entity | string;
  /** Actor-aware navigation options. */
  navigation?: GameboardActorNavigationOptions;
  /** Target approach strategy. Defaults to `nearest`. */
  approach?: GameboardActorTargetApproach;
  /** Maximum accepted path cost. */
  maxPathCost?: number;
  /** Include unreachable targets in results. Defaults to true. */
  includeUnreachable?: boolean;
  /** Target result sort mode. */
  sort?: GameboardActorTargetSort;
}

/**
 * One selected target plus its planned command and path result.
 */
export interface GameboardActorTarget {
  /** Target actor snapshot. */
  actor: GameboardActorSnapshot;
  /** Serializable target actor record. */
  record: GameboardActorSelectionRecord;
  /** Planned interaction command for the target. */
  command: GameboardInteractionCommand;
  /** Path to the selected approach tile. */
  path: GameboardNavigationPathResult;
  /** Approach mode actually used for this target. */
  approach: GameboardActorTargetApproach | 'self' | 'none';
  /** Tile key approached by the path. */
  approachTileKey?: string;
  /** Whether the target is reachable under the active profile. */
  reachable: boolean;
  /** Unreachable reason. */
  reason?: string;
}

/**
 * Targeting report for one source actor.
 */
export interface GameboardActorTargetingReport {
  /** Source actor, when it exists. */
  source?: GameboardActorSnapshot;
  /** Actor selection used as the target candidate set. */
  selection: GameboardActorSelection;
  /** All targets after reachability filtering. */
  targets: readonly GameboardActorTarget[];
  /** Reachable targets only. */
  reachableTargets: readonly GameboardActorTarget[];
  /** Actor ids represented by `targets`. */
  targetActorIds: readonly string[];
  /** Actor ids represented by `reachableTargets`. */
  reachableActorIds: readonly string[];
  /** First reachable target, or first target when none are reachable. */
  nearestTarget?: GameboardActorTarget;
  /** Failure reason when targeting could not be evaluated. */
  reason?: string;
}

/**
 * Options for planning an interaction command from a resolved target.
 */
export interface GameboardInteractionCommandOptions extends GameboardInteractionTargetOptions {
  /** Require a source actor before move commands can execute. */
  requireSourceActorForMove?: boolean;
  /** Require a source actor before attack commands can execute. */
  requireSourceActorForAttack?: boolean;
  /** Require a source actor before interaction commands can execute. */
  requireSourceActorForInteraction?: boolean;
}

/**
 * Planned high-level interaction command.
 */
export interface GameboardInteractionCommand {
  /** Concrete command kind. */
  kind: GameboardInteractionCommandKind;
  /** High-level intent that produced the command. */
  intent: GameboardInteractionIntent;
  /** Target report used to plan the command. */
  target: GameboardInteractionTargetReport;
  /** Optional source actor. */
  source?: GameboardActorSnapshot;
  /** Target tile key, when available. */
  tileKey?: string;
  /** Target placement id, when available. */
  placementId?: string;
  /** Target actor id, when available. */
  actorId?: string;
  /** Whether this command can execute without additional target resolution. */
  canExecute: boolean;
  /** Failure reason when `canExecute` is false. */
  reason?: string;
}

// Trait declarations live in `src/traits`; re-export verbatim.
export {
  GameboardActor,
  IsBlockingActor,
  IsEnemyActor,
  IsGameboardActor,
  IsHostileActor,
  IsInteractiveActor,
  IsNpcActor,
  IsPlayerActor,
  IsPropActor,
} from '../traits';
import {
  GameboardActor,
  IsBlockingActor,
  IsEnemyActor,
  IsGameboardActor,
  IsHostileActor,
  IsInteractiveActor,
  IsNpcActor,
  IsPlayerActor,
  IsPropActor,
} from '../traits';

/** Query for every gameplay actor placement. */
export const GameboardActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsGameboardActor,
  GameboardActor
);
/** Query for player actor placements. */
export const PlayerActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsPlayerActor,
  GameboardActor
);
/** Query for NPC actor placements. */
export const NpcActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsNpcActor,
  GameboardActor
);
/** Query for enemy actor placements. */
export const EnemyActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsEnemyActor,
  GameboardActor
);
/** Query for prop actor placements. */
export const PropActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsPropActor,
  GameboardActor
);
/** Query for hostile actor placements. */
export const HostileActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsHostileActor,
  GameboardActor
);
/** Query for interactive actor placements. */
export const InteractiveActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsInteractiveActor,
  GameboardActor
);
/** Query for movement-blocking actor placements. */
export const BlockingActorQuery = createQuery(
  IsGameboardPlacement,
  PlacementState,
  IsBlockingActor,
  GameboardActor
);

/** Actor trait value returned by `GameboardActor`. */
export type GameboardActorValue = TraitRecord<typeof GameboardActor>;

const DEFAULT_COLLISION_PROFILE = {
  blockingPlacementKinds: ['structure', 'unit'] as readonly GameboardPlacementKind[],
  blockingPlacementLayers: [] as readonly GameboardPlacementLayer[],
  ignorePlacementIds: [] as readonly string[],
  treatHostileAsBlocking: true,
  treatInteractiveAsBlocking: false,
  treatPropsAsBlocking: false,
} satisfies Required<GameboardActorCollisionProfile>;

/**
 * Koota action bundle for actor spawning, registration, selection, inspection,
 * targeting, and command planning.
 */
export const gameboardActorActions = createActions((world) => ({
  /** Spawn a placement and register it as an actor. */
  spawn: (options: SpawnGameboardActorOptions) => spawnGameboardActor(world, options),
  /** Register an existing placement as an actor. */
  register: (placement: Entity | string, options: GameboardActorRegistrationOptions) =>
    registerGameboardActor(world, placement, options),
  /** Update actor trait state while preserving omitted fields. */
  update: (actor: Entity | string, options: UpdateGameboardActorOptions) =>
    updateGameboardActor(world, actor, options),
  /** Move an actor to another tile. */
  move: (
    actor: Entity | string,
    to: HexCoordinates | string,
    options: MoveGameboardActorOptions = {}
  ) => moveGameboardActor(world, actor, to, options),
  /** Read all registered actors. */
  read: () => readGameboardActors(world),
  /** Inspect whether an actor can enter a target tile. */
  collision: (
    actor: Entity | string | undefined,
    target: HexCoordinates | string,
    profile: GameboardActorCollisionProfile = {}
  ) => inspectGameboardActorCollision(world, actor, target, profile),
  /** Create an actor-aware navigation profile. */
  navigationProfile: (actor: Entity | string, options: GameboardActorNavigationOptions = {}) =>
    createGameboardActorNavigationProfile(world, actor, options),
  /** Resolve and inspect an interaction target. */
  interaction: (
    target: GameboardInteractionTargetInput,
    options: GameboardInteractionTargetOptions = {}
  ) => inspectGameboardInteractionTarget(world, target, options),
  /** Inspect one tile from an actor/gameplay perspective. */
  tile: (coordinates: HexCoordinates | string, options: GameboardTileInspectionOptions = {}) =>
    inspectGameboardTile(world, coordinates, options),
  /** Inspect a radius of tiles around a center. */
  neighborhood: (
    center: GameboardNeighborhoodCenter,
    options: GameboardNeighborhoodInspectionOptions = {}
  ) => inspectGameboardNeighborhood(world, center, options),
  /** Select actors with optional faction, team, tag, radius, and hostility filters. */
  select: (options: GameboardActorSelectionOptions = {}) => selectGameboardActors(world, options),
  /** Select and path to candidate actor targets. */
  targets: (options: GameboardActorTargetingOptions) =>
    inspectGameboardActorTargets(world, options),
  /** Plan a high-level interaction command from a target input. */
  command: (
    target: GameboardInteractionTargetInput,
    options: GameboardInteractionCommandOptions = {}
  ) => planGameboardInteractionCommand(world, target, options),
}));

/**
 * Spawn a placement and immediately register it as a gameplay actor.
 */
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

/**
 * Attach actor state to an existing placement entity or placement id.
 */
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

/**
 * Update actor state while keeping omitted fields stable and mirroring actor
 * metadata back onto the placement metadata.
 */
export function updateGameboardActor(
  world: World,
  actor: Entity | string,
  options: UpdateGameboardActorOptions
): Entity {
  const entity = requireActorEntity(world, actor);
  const placementState = requirePlacementState(entity);
  const current = requireActorState(entity);
  const next = actorValueFromOptions(
    {
      actorId: options.actorId ?? current.actorId,
      actorKind: options.actorKind ?? current.kind,
      faction: options.faction ?? current.faction,
      team: options.team ?? current.team,
      hostile: options.hostile ?? current.hostile,
      blocksMovement: options.blocksMovement ?? current.blocksMovement,
      interactive: options.interactive ?? current.interactive,
      tags: options.tags ?? current.tags,
      actorMetadata: options.actorMetadata ?? current.metadata,
    },
    placementState
  );
  updatePlacementActorMetadata(world, entity, next);
  setActorTraits(entity, next);
  return entity;
}

/**
 * Move an actor to a new tile by delegating to placement movement.
 */
export function moveGameboardActor(
  world: World,
  actor: Entity | string,
  to: HexCoordinates | string,
  options: MoveGameboardActorOptions = {}
): Entity {
  return moveGameboardPlacement(world, requireActorEntity(world, actor), to, options);
}

/**
 * Find an actor entity by entity reference, placement id, or actor id.
 */
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

/**
 * Read one actor snapshot by entity reference, placement id, or actor id.
 */
export function findGameboardActor(
  world: World,
  actorOrPlacement: Entity | string
): GameboardActorSnapshot | undefined {
  const entity = findGameboardActorEntity(world, actorOrPlacement);
  return entity ? snapshotForActorEntity(entity) : undefined;
}

/**
 * Read all registered actor snapshots sorted by actor id.
 */
export function readGameboardActors(world: World): GameboardActorSnapshot[] {
  return world
    .query(GameboardActorQuery)
    .map(snapshotForActorEntity)
    .sort((left, right) => left.actor.actorId.localeCompare(right.actor.actorId));
}

/**
 * Select actors by id, kind, faction, team, tags, tile, radius, hostility, and
 * interaction flags.
 */
export function selectGameboardActors(
  world: World,
  options: GameboardActorSelectionOptions = {}
): GameboardActorSelection {
  const source = options.sourceActor ? findGameboardActor(world, options.sourceActor) : undefined;
  const centerInput = options.center ?? (options.radius !== undefined ? source?.entity : undefined);
  const center = centerInput ? resolveNeighborhoodCenter(world, centerInput) : undefined;
  const radius = options.radius === undefined ? undefined : Math.max(0, Math.floor(options.radius));
  const actors = readGameboardActors(world)
    .filter((snapshot) => matchesActorSelection(snapshot, options, source, center, radius))
    .sort((left, right) => compareActorSelection(left, right, options.sort ?? 'actorId', center));

  // Single-pass derive-everything (PRD B5 / Phase 2 P-H1). Six separate
  // filter+map passes over `actors` were measurable on react-driven target-
  // picker hooks; one pass writes every derived collection while preserving
  // the same sorted order.
  const records: ReturnType<typeof actorSelectionRecord>[] = [];
  const hostileActors: typeof actors = [];
  const interactiveActors: typeof actors = [];
  const propActors: typeof actors = [];
  const actorIds: string[] = [];
  const placementIds: string[] = [];
  const seenTileKeys = new Set<string>();
  const tileKeys: string[] = [];
  for (const snapshot of actors) {
    records.push(actorSelectionRecord(snapshot, source, center));
    if (actorHostileForSelection(snapshot, source)) {
      hostileActors.push(snapshot);
    }
    if (snapshot.actor.interactive) {
      interactiveActors.push(snapshot);
    }
    if (snapshot.actor.kind === 'prop') {
      propActors.push(snapshot);
    }
    actorIds.push(snapshot.actor.actorId);
    placementIds.push(snapshot.placement.id);
    const tileKey = snapshot.placement.tileKey;
    if (!seenTileKeys.has(tileKey)) {
      seenTileKeys.add(tileKey);
      tileKeys.push(tileKey);
    }
  }

  return {
    actors,
    records,
    count: actors.length,
    actorIds,
    placementIds,
    tileKeys,
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

/**
 * Select candidate target actors for a source actor and evaluate reachability
 * using actor-aware navigation.
 */
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

/**
 * Read actor snapshots whose origin tile matches the provided coordinates or key.
 */
export function readGameboardActorsForTile(
  world: World,
  coordinates: HexCoordinates | string
): GameboardActorSnapshot[] {
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  return readGameboardActors(world).filter((snapshot) => snapshot.placement.tileKey === key);
}

/**
 * Return the gameplay actor kind for an actor or placement, when registered.
 */
export function classifyGameboardPlacement(
  world: World,
  actorOrPlacement: Entity | string
): GameboardActorKind | undefined {
  return findGameboardActor(world, actorOrPlacement)?.actor.kind;
}

/**
 * Return whether two actors should be considered hostile to each other.
 */
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

/**
 * Inspect whether an actor can enter a target tile under a collision profile.
 */
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

/**
 * Create a navigation profile that rejects tiles blocked for a specific actor.
 */
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

/**
 * Resolve a target input into an interaction target report.
 */
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

/**
 * Inspect one tile from an actor/gameplay perspective.
 */
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

/**
 * Inspect a radius of tiles around a center and aggregate actor/tile summaries.
 */
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

/**
 * Plan a high-level interaction command from a click/target input.
 */
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
      /* v8 ignore next 7 -- move intent is assigned only to resolved, enterable tile/surface targets. */
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
      /* v8 ignore next -- attack intent is produced only for actor targets. */
      kind: targetReport.actor ? 'attack-actor' : 'inspect-placement',
      target: targetReport,
      source,
      canExecute: Boolean(targetReport.actor && (!requireSourceActorForAttack || source)),
      /* v8 ignore next 5 -- attack intent requires the same resolved source actor used by command planning. */
      reason: targetReport.actor
        ? requireSourceActorForAttack && !source
          ? 'Attack commands require a source actor'
          : undefined
        : 'No attackable actor target',
    });
  }

  if (targetReport.intent === 'interact') {
    return interactionCommand({
      /* v8 ignore next -- current interact intent is produced only for actor targets. */
      kind: targetReport.actor ? 'interact-actor' : 'interact-placement',
      target: targetReport,
      source,
      /* v8 ignore next 4 -- interact intent always carries an actor/placement target. */
      canExecute: Boolean(
        (targetReport.actor || targetReport.placement) &&
          (!requireSourceActorForInteraction || source)
      ),
      /* v8 ignore next 6 -- interact intent always carries an actor/placement target. */
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

/**
 * Evaluate whether an actor/placement combination blocks movement under a
 * collision profile.
 */
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

  /* v8 ignore next 11 -- valid non-string centers are HexCoordinates or placement-backed entities. */
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

  /* v8 ignore next 14 -- valid non-string center inputs return before this string-only resolver. */
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
      throw new GameboardRuntimeError(
        `No tile, placement, actor, or hex key found for neighborhood center: ${center}`
      );
    }
  }

  /* v8 ignore next -- typed center inputs are handled above; invalid non-Entity objects fail before this guard. */
  throw new GameboardRuntimeError(
    'No tile, placement, actor, or hex key found for neighborhood center'
  );
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
  return (
    tile.actors.length > 0 || tile.placements.some((placement) => !isSurfacePlacement(placement))
  );
}

function uniqueActorSnapshots(
  snapshots: readonly GameboardActorSnapshot[]
): GameboardActorSnapshot[] {
  const seen = new Set<string>();
  const unique: GameboardActorSnapshot[] = [];
  for (const snapshot of snapshots) {
    /* v8 ignore next -- actor ids are required registration input; placement fallback guards corrupted actor state. */
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
    (snapshot.actor.actorId !== source.actor.actorId &&
      snapshot.placement.id !== source.placement.id)
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
  return (
    radius === undefined || !center || hexDistance(center, snapshot.placement.coordinates) <= radius
  );
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
    /* v8 ignore next 4 -- candidate construction does not emit duplicate approach/tile pairs. */
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
  /* v8 ignore next 3 -- self routes have no competing candidate, so they never reach route comparison. */
  if (approach === 'self') {
    return 0;
  }
  if (approach === 'target-tile') {
    return 1;
  }
  /* v8 ignore next 4 -- route candidates cover adjacent behavior; the fallthrough only guards the "none" report sentinel. */
  if (approach === 'adjacent') {
    return 2;
  }
  /* v8 ignore next -- "none" is only a target-report sentinel, not a route candidate. */
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
    throw new GameboardRuntimeError(
      `No gameboard actor exists with id ${typeof actor === 'string' ? actor : String(actor.id())}`
    );
  }
  return entity;
}

function requirePlacementEntity(world: World, placement: Entity | string): Entity {
  const entity = findPlacementEntity(world, placement);
  if (!entity) {
    throw new GameboardRuntimeError(`No placement exists with id ${placement}`);
  }
  return entity;
}

function requirePlacementState(entity: Entity): PlacementStateValue {
  const placement = entity.get(PlacementState);
  if (!placement) {
    throw new GameboardRuntimeError(`Placement entity ${entity.id()} is missing PlacementState`);
  }
  return copyPlacementState(placement);
}

function requireActorState(entity: Entity): GameboardActorValue {
  const actor = entity.get(GameboardActor);
  /* v8 ignore next 3 -- actor snapshots are created only after GameboardActor query/entity checks. */
  if (!actor) {
    throw new GameboardRuntimeError(`Placement entity ${entity.id()} is missing GameboardActor`);
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
