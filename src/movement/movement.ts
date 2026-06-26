/**
 * Actor movement profiles, movement budgets, path requests, reachable ranges,
 * queued movement state, and frame-loop movement stepping.
 *
 * @module
 */
import {
  createActions,
  createQuery,
  type Entity,
  type TraitRecord,
  type World,
} from 'koota';
import { hexKey } from '../coordinates';
import { GameboardRuntimeError } from '../errors';
import type { GameboardPlacementSpec, GameboardPlan } from '../gameboard';
import { GameboardState, IsGameboardPlacement, IsUnitPlacement, PlacementState } from '../traits';
import {
  findPlacementEntity,
  moveGameboardPlacement,
  readGameboardPlacements,
  readGameboardTiles,
  type PlacementStateValue,
} from '../koota';
import {
  createGameboardNavigation,
  type GameboardNavigation,
  type GameboardNavigationPathResult,
  type GameboardNavigationProfile,
  type GameboardReachableTile,
} from '../gameboard';
import type { HexCoordinates } from '../types';

// Movement profile types live in `src/traits` so the trait
// declarations they support evaluate without sibling-package runtime
// dependencies. Re-exported here for backward compatibility.
export type {
  BuiltInGameboardMovementProfileId,
  GameboardMovementProfileId,
  GameboardMovementStatus,
} from '../traits';
import type {
  GameboardMovementProfileId,
  GameboardMovementStatus,
} from '../traits';

/**
 * Movement profile combining a movement budget with a navigation profile.
 */
export interface GameboardMovementProfile {
  /** Stable profile id. */
  id: GameboardMovementProfileId;
  /** Human-readable label. */
  label: string;
  /** Default movement budget for one movement cycle. */
  movementBudget: number;
  /** Navigation profile used by this movement profile. */
  navigation: GameboardNavigationProfile;
}

/**
 * Profile id or inline profile accepted by movement APIs.
 */
export type GameboardMovementProfileInput = GameboardMovementProfileId | GameboardMovementProfile;

/**
 * Movement profiles keyed by id.
 */
export interface GameboardMovementProfileRegistry {
  /** Movement profile for the profile id key. */
  readonly [profileId: string]: GameboardMovementProfile;
}

/**
 * Shared options for actor/placement movement helpers.
 */
export interface GameboardMovementOptions {
  /** Movement profile id or inline profile. */
  profile?: GameboardMovementProfileInput;
  /** Registry used to resolve profile ids. */
  profiles?: GameboardMovementProfileRegistry;
  /** Movement budget override. */
  movementBudget?: number;
  /** Placement ids ignored during pathing. */
  ignorePlacementIds?: readonly string[];
  /** Navigation profile overrides merged over the movement profile. */
  navigation?: GameboardNavigationProfile;
}

/**
 * Options for registering or updating a movement agent.
 */
export interface SetGameboardMovementAgentOptions extends GameboardMovementOptions {
  /** Remaining movement override. Defaults to full budget. */
  remainingMovement?: number;
}

/**
 * Options for requesting a path for a movement agent.
 */
export interface GameboardMovementPathRequestOptions extends GameboardMovementOptions {
  /** Keep a found path even when it exceeds the current budget. */
  allowOutOfRangePath?: boolean;
}

/**
 * Options for advancing movement.
 */
export interface AdvanceGameboardMovementOptions extends GameboardMovementOptions {
  /** Number of path steps to advance. Defaults to `1`. */
  steps?: number;
}

/**
 * Result returned after requesting movement.
 */
export interface GameboardMovementRequestResult {
  /** Movement agent entity. */
  entity: Entity;
  /** Placement state after the request. */
  placement: PlacementStateValue;
  /** Resolved movement profile. */
  profile: GameboardMovementProfile;
  /** Planned path. */
  path: GameboardNavigationPathResult;
  /** Movement path state written to the entity. */
  state: MovementPathStateValue;
}

/**
 * Result returned after advancing movement.
 */
export interface GameboardMovementAdvanceResult {
  /** Movement agent entity. */
  entity: Entity;
  /** Placement state after advancement. */
  placement: PlacementStateValue;
  /** Resolved movement profile. */
  profile: GameboardMovementProfile;
  /** Movement path state after advancement. */
  state: MovementPathStateValue;
  /** Whether the placement moved during this advance call. */
  moved: boolean;
}

/**
 * Built-in movement profiles for ground units, workers, cavalry, ships, and
 * flying units.
 */
export const GAMEBOARD_MOVEMENT_PROFILES: GameboardMovementProfileRegistry = {
  ground: {
    id: 'ground',
    label: 'Ground',
    movementBudget: 6,
    navigation: {
      blockedTerrain: ['water'],
      blockingPlacementKinds: ['structure', 'unit'],
      maxElevationStep: 1,
    },
  },
  worker: {
    id: 'worker',
    label: 'Worker',
    movementBudget: 4,
    navigation: {
      blockedTerrain: ['water'],
      blockingPlacementKinds: ['structure', 'unit'],
      terrainCosts: { forest: 2, hill: 2, mountain: 3 },
      maxElevationStep: 1,
    },
  },
  cavalry: {
    id: 'cavalry',
    label: 'Cavalry',
    movementBudget: 8,
    navigation: {
      blockedTerrain: ['water'],
      blockingPlacementKinds: ['structure', 'unit'],
      terrainCosts: { forest: 2, hill: 2, mountain: 4 },
      maxElevationStep: 1,
    },
  },
  ship: {
    id: 'ship',
    label: 'Ship',
    movementBudget: 8,
    navigation: {
      allowedTerrain: ['water'],
      blockedTerrain: [],
      blockingPlacementKinds: ['structure', 'unit'],
      maxElevationStep: 0,
    },
  },
  flying: {
    id: 'flying',
    label: 'Flying',
    movementBudget: 10,
    navigation: {
      blockedTerrain: [],
      blockingPlacementKinds: [],
      maxElevationStep: 999,
    },
  },
} as const;

// Trait declarations + supporting types live in `src/traits` for
// runtime-cycle safety. Re-export here so callers that historically reached
// for `MovementAgent` etc. via `'../movement'` keep working.
export { IsMoving, MovementAgent, MovementPathState } from '../traits';
import { IsMoving, MovementAgent, MovementPathState } from '../traits';

/** Query for placements with movement agents. */
export const MovementAgentQuery = createQuery(IsGameboardPlacement, PlacementState, MovementAgent);
/** Query for placements currently advancing along a path. */
export const ActiveMovementQuery = createQuery(
  IsGameboardPlacement,
  IsMoving,
  PlacementState,
  MovementAgent,
  MovementPathState
);
/** Query for unit placements that have movement agents. */
export const UnitMovementQuery = createQuery(IsUnitPlacement, PlacementState, MovementAgent);

/** Movement agent trait value. */
export type MovementAgentValue = TraitRecord<typeof MovementAgent>;
/** Movement path state trait value. */
export type MovementPathStateValue = TraitRecord<typeof MovementPathState>;

/**
 * Koota action bundle for movement agents, path requests, reachability, and
 * advancement.
 */
export const gameboardMovementActions = createActions((world) => ({
  /** Add or update a movement agent on a placement. */
  setAgent: (placement: Entity | string, options: SetGameboardMovementAgentOptions = {}) =>
    setGameboardMovementAgent(world, placement, options),
  /** Clear active movement path state for a placement. */
  clear: (placement: Entity | string) => clearGameboardMovement(world, placement),
  /** Reset movement budget for one or all movement agents. */
  resetBudget: (placement?: Entity | string, options: GameboardMovementOptions = {}) =>
    resetGameboardMovementBudget(world, placement, options),
  /** Request movement to a destination. */
  requestMove: (
    placement: Entity | string,
    destination: HexCoordinates | string,
    options: GameboardMovementPathRequestOptions = {}
  ) => requestGameboardMovement(world, placement, destination, options),
  /** Advance one placement along its requested path. */
  advance: (placement: Entity | string, options: AdvanceGameboardMovementOptions = {}) =>
    advanceGameboardMovement(world, placement, options),
  /** Advance all active movement agents. */
  runSystem: (options: AdvanceGameboardMovementOptions = {}) => runGameboardMovementSystem(world, options),
  /** Return tiles reachable by one movement agent. */
  reachable: (placement: Entity | string, options: GameboardMovementOptions = {}) =>
    reachableGameboardMovementTiles(world, placement, options),
}));

/**
 * Resolve a movement profile id or inline profile.
 */
export function resolveGameboardMovementProfile(
  profile: GameboardMovementProfileInput | undefined,
  profiles: GameboardMovementProfileRegistry = GAMEBOARD_MOVEMENT_PROFILES
): GameboardMovementProfile {
  if (!profile) {
    const ground = profiles.ground;
    if (!ground) {
      throw new GameboardRuntimeError('Movement profile registry missing required default "ground"');
    }
    return ground;
  }
  if (typeof profile !== 'string') {
    return profile;
  }
  const resolved = profiles[profile];
  if (!resolved) {
    throw new GameboardRuntimeError(`Unknown gameboard movement profile: ${profile}`);
  }
  return resolved;
}

/**
 * Add or update movement-agent state for a placement.
 */
export function setGameboardMovementAgent(
  world: World,
  placement: Entity | string,
  options: SetGameboardMovementAgentOptions = {}
): Entity {
  const entity = requirePlacementEntity(world, placement);
  const profile = resolveProfileForEntity(entity, options);
  const movementBudget = options.movementBudget ?? entity.get(MovementAgent)?.movementBudget ?? profile.movementBudget;
  const nextAgent: MovementAgentValue = {
    profileId: profile.id,
    movementBudget,
    remainingMovement: options.remainingMovement ?? movementBudget,
  };
  writeMovementAgent(entity, nextAgent);
  if (!entity.has(MovementPathState)) {
    entity.add(MovementPathState);
  }
  return entity;
}

/**
 * Create navigation for one movement agent, ignoring the agent's own placement.
 */
export function createGameboardMovementNavigation(
  world: World,
  placement: Entity | string,
  options: GameboardMovementOptions = {}
): GameboardNavigation {
  const entity = requirePlacementEntity(world, placement);
  const state = requirePlacementState(entity);
  const profile = resolveProfileForEntity(entity, options);
  return createGameboardNavigation(projectWorldForMovement(world), navigationProfileForMovement(profile, state, options));
}

/**
 * Find a movement path from a placement to a destination.
 */
export function findGameboardMovementPath(
  world: World,
  placement: Entity | string,
  destination: HexCoordinates | string,
  options: GameboardMovementOptions = {}
): GameboardNavigationPathResult {
  const entity = requirePlacementEntity(world, placement);
  const state = requirePlacementState(entity);
  return createGameboardMovementNavigation(world, entity, options).findPath(state.tileKey, destination);
}

/**
 * Return tiles reachable by a placement under its movement profile and budget.
 */
export function reachableGameboardMovementTiles(
  world: World,
  placement: Entity | string,
  options: GameboardMovementOptions = {}
): GameboardReachableTile[] {
  const entity = requirePlacementEntity(world, placement);
  const state = requirePlacementState(entity);
  const profile = resolveProfileForEntity(entity, options);
  const budget = movementBudgetFor(entity, profile, options);
  return createGameboardMovementNavigation(world, entity, options).reachable(state.tileKey, budget);
}

/**
 * Request movement for a placement and write path state back to its entity.
 */
export function requestGameboardMovement(
  world: World,
  placement: Entity | string,
  destination: HexCoordinates | string,
  options: GameboardMovementPathRequestOptions = {}
): GameboardMovementRequestResult {
  const entity = setGameboardMovementAgent(world, placement, options);
  const state = requirePlacementState(entity);
  const profile = resolveProfileForEntity(entity, options);
  const path = createGameboardMovementNavigation(world, entity, options).findPath(state.tileKey, destination);
  const budget = movementBudgetFor(entity, profile, options);
  const destinationKey = typeof destination === 'string' ? destination : hexKey(destination);
  const status = movementRequestStatus(path, budget, options);
  const nextState = movementPathState({
    status,
    destinationKey,
    pathKeys: path.coordinates.map(hexKey),
    nextIndex: path.path.length <= 1 ? path.path.length : 1,
    cost: path.cost,
    spentCost: 0,
    visited: path.visited,
    reason: movementRequestReason(status, path, budget),
  });

  entity.set(MovementPathState, nextState);
  if (status === 'ready') {
    entity.add(IsMoving);
  } else {
    entity.remove(IsMoving);
  }

  return {
    entity,
    placement: snapshotPlacementState(entity),
    profile,
    path,
    state: nextState,
  };
}

/**
 * Advance one movement agent by one or more path steps.
 */
export function advanceGameboardMovement(
  world: World,
  placement: Entity | string,
  options: AdvanceGameboardMovementOptions = {}
): GameboardMovementAdvanceResult {
  const entity = requirePlacementEntity(world, placement);
  const steps = Math.max(1, Math.floor(options.steps ?? 1));
  let result = advanceOneGameboardMovement(world, entity, options);
  for (let index = 1; index < steps && result.state.status === 'moving'; index += 1) {
    result = advanceOneGameboardMovement(world, entity, options);
  }
  return result;
}

/**
 * Advance every active movement agent in the world.
 */
export function runGameboardMovementSystem(
  world: World,
  options: AdvanceGameboardMovementOptions = {}
): GameboardMovementAdvanceResult[] {
  const results: GameboardMovementAdvanceResult[] = [];
  for (const entity of world.query(ActiveMovementQuery)) {
    results.push(advanceGameboardMovement(world, entity, options));
  }
  return results;
}

/**
 * Clear active path state for one movement agent.
 */
export function clearGameboardMovement(world: World, placement: Entity | string): Entity {
  const entity = requirePlacementEntity(world, placement);
  entity.remove(IsMoving);
  entity.set(MovementPathState, idleMovementPathState());
  return entity;
}

/**
 * Reset the movement budget for one placement or all movement agents.
 */
export function resetGameboardMovementBudget(
  world: World,
  placement?: Entity | string,
  options: GameboardMovementOptions = {}
): readonly Entity[] {
  const entities = placement === undefined ? world.query(MovementAgentQuery) : [requirePlacementEntity(world, placement)];
  for (const entity of entities) {
    const profile = resolveProfileForEntity(entity, options);
    const current = entity.get(MovementAgent);
    const movementBudget = options.movementBudget ?? current?.movementBudget ?? profile.movementBudget;
    writeMovementAgent(entity, {
      profileId: profile.id,
      movementBudget,
      remainingMovement: movementBudget,
    });
  }
  return entities;
}

function advanceOneGameboardMovement(
  world: World,
  entity: Entity,
  options: GameboardMovementOptions
): GameboardMovementAdvanceResult {
  const profile = resolveProfileForEntity(entity, options);
  const currentPath = entity.get(MovementPathState) ?? idleMovementPathState();
  if (currentPath.status !== 'ready' && currentPath.status !== 'moving') {
    return movementAdvanceResult(entity, profile, currentPath, false);
  }
  if (currentPath.nextIndex >= currentPath.pathKeys.length) {
    const completed = movementPathState({ ...currentPath, status: 'completed', reason: undefined });
    entity.set(MovementPathState, completed);
    entity.remove(IsMoving);
    return movementAdvanceResult(entity, profile, completed, false);
  }

  const placement = requirePlacementState(entity);
  const nextKey = currentPath.pathKeys[currentPath.nextIndex];
  if (nextKey === undefined) {
    throw new GameboardRuntimeError(
      `Movement path index ${currentPath.nextIndex} out of range (length ${currentPath.pathKeys.length})`
    );
  }
  const navigation = createGameboardMovementNavigation(world, entity, options);
  if (!navigation.canEnter(nextKey, placement.tileKey)) {
    const blocked = movementPathState({
      ...currentPath,
      status: 'blocked',
      reason: `Movement path is blocked at ${nextKey}`,
    });
    entity.set(MovementPathState, blocked);
    entity.remove(IsMoving);
    return movementAdvanceResult(entity, profile, blocked, false);
  }

  const stepCost = navigation.movementCost(placement.tileKey, nextKey);
  const agent = requireMovementAgent(entity, profile);
  if (!Number.isFinite(stepCost) || stepCost > agent.remainingMovement) {
    const outOfRange = movementPathState({
      ...currentPath,
      status: 'out-of-range',
      reason: `Movement needs ${stepCost} remaining movement; agent has ${agent.remainingMovement}`,
    });
    entity.set(MovementPathState, outOfRange);
    entity.remove(IsMoving);
    return movementAdvanceResult(entity, profile, outOfRange, false);
  }

  moveGameboardPlacement(world, entity, nextKey);
  writeMovementAgent(entity, {
    ...agent,
    remainingMovement: agent.remainingMovement - stepCost,
  });

  const nextIndex = currentPath.nextIndex + 1;
  const completed = nextIndex >= currentPath.pathKeys.length;
  const nextState = movementPathState({
    ...currentPath,
    status: completed ? 'completed' : 'moving',
    nextIndex,
    spentCost: currentPath.spentCost + stepCost,
    reason: undefined,
  });
  entity.set(MovementPathState, nextState);
  if (completed) {
    entity.remove(IsMoving);
  } else {
    entity.add(IsMoving);
  }
  return movementAdvanceResult(entity, profile, nextState, true);
}

function resolveProfileForEntity(
  entity: Entity,
  options: GameboardMovementOptions
): GameboardMovementProfile {
  const agent = entity.get(MovementAgent);
  return resolveGameboardMovementProfile(options.profile ?? agent?.profileId ?? 'ground', options.profiles);
}

function navigationProfileForMovement(
  profile: GameboardMovementProfile,
  placement: Pick<GameboardPlacementSpec, 'id'>,
  options: GameboardMovementOptions
): GameboardNavigationProfile {
  const profileNavigation = profile.navigation;
  const optionNavigation = options.navigation ?? {};
  return {
    ...profileNavigation,
    ...optionNavigation,
    terrainCosts: {
      ...(profileNavigation.terrainCosts ?? {}),
      ...(optionNavigation.terrainCosts ?? {}),
    },
    ignorePlacementIds: uniqueStrings([
      placement.id,
      ...(profileNavigation.ignorePlacementIds ?? []),
      ...(optionNavigation.ignorePlacementIds ?? []),
      ...(options.ignorePlacementIds ?? []),
    ]),
  };
}

function movementBudgetFor(
  entity: Entity,
  profile: GameboardMovementProfile,
  options: GameboardMovementOptions
): number {
  const agent = entity.get(MovementAgent);
  return options.movementBudget ?? agent?.remainingMovement ?? agent?.movementBudget ?? profile.movementBudget;
}

function movementRequestStatus(
  path: GameboardNavigationPathResult,
  budget: number,
  options: GameboardMovementPathRequestOptions
): GameboardMovementStatus {
  if (!path.found) {
    return 'blocked';
  }
  if (path.path.length <= 1) {
    return 'completed';
  }
  if (!options.allowOutOfRangePath && path.cost > budget) {
    return 'out-of-range';
  }
  return 'ready';
}

function movementRequestReason(
  status: GameboardMovementStatus,
  path: GameboardNavigationPathResult,
  budget: number
): string | undefined {
  if (status === 'blocked') {
    return 'No passable path to destination';
  }
  if (status === 'out-of-range') {
    return `Path costs ${path.cost}; movement budget is ${budget}`;
  }
  return undefined;
}

function movementPathState(value: MovementPathStateValue): MovementPathStateValue {
  return {
    ...value,
    pathKeys: [...value.pathKeys],
  };
}

function idleMovementPathState(): MovementPathStateValue {
  return {
    status: 'idle',
    destinationKey: '',
    pathKeys: [],
    nextIndex: 0,
    cost: 0,
    spentCost: 0,
    visited: 0,
    reason: undefined,
  };
}

function movementAdvanceResult(
  entity: Entity,
  profile: GameboardMovementProfile,
  state: MovementPathStateValue,
  moved: boolean
): GameboardMovementAdvanceResult {
  return {
    entity,
    placement: snapshotPlacementState(entity),
    profile,
    state,
    moved,
  };
}

function requirePlacementEntity(world: World, placement: Entity | string): Entity {
  const entity = findPlacementEntity(world, placement);
  if (!entity) {
    throw new GameboardRuntimeError(`No placement exists with id ${typeof placement === 'string' ? placement : String(placement.id())}`);
  }
  return entity;
}

function requirePlacementState(entity: Entity): Readonly<PlacementStateValue> {
  const state = entity.get(PlacementState);
  if (!state) {
    throw new GameboardRuntimeError(`Placement entity ${entity.id()} is missing PlacementState`);
  }
  return state;
}

function snapshotPlacementState(entity: Entity): PlacementStateValue {
  const state = entity.get(PlacementState);
  if (!state) {
    throw new GameboardRuntimeError(`Placement entity ${entity.id()} is missing PlacementState`);
  }
  return {
    ...state,
    coordinates: { ...state.coordinates },
    position: { ...state.position },
    metadata: { ...state.metadata },
  };
}

function requireMovementAgent(entity: Entity, profile: GameboardMovementProfile): MovementAgentValue {
  const agent = entity.get(MovementAgent);
  if (agent) {
    return agent;
  }
  return {
    profileId: profile.id,
    movementBudget: profile.movementBudget,
    remainingMovement: profile.movementBudget,
  };
}

function writeMovementAgent(entity: Entity, agent: MovementAgentValue): void {
  if (entity.has(MovementAgent)) {
    entity.set(MovementAgent, agent);
  } else {
    entity.add(MovementAgent(agent));
  }
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function projectWorldForMovement(world: World): GameboardPlan {
  const board = world.get(GameboardState);
  if (!board) {
    throw new GameboardRuntimeError('World does not contain GameboardState');
  }
  return {
    schemaVersion: board.schemaVersion as GameboardPlan['schemaVersion'],
    seed: board.seed,
    shape: { ...board.shape },
    textureSet: board.textureSet,
    tiles: readGameboardTiles(world),
    placements: readGameboardPlacements(world),
    warnings: [],
  };
}
