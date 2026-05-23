import {
  createActions,
  createQuery,
  trait,
  type Entity,
  type TraitRecord,
  type World,
} from 'koota';
import { hexKey } from './coordinates';
import type { GameboardPlacementSpec, GameboardPlan } from './gameboard';
import {
  GameboardState,
  IsGameboardPlacement,
  IsUnitPlacement,
  PlacementState,
  findPlacementEntity,
  moveGameboardPlacement,
  readGameboardPlacements,
  readGameboardTiles,
  type PlacementStateValue,
} from './koota';
import {
  createGameboardNavigation,
  type GameboardNavigation,
  type GameboardNavigationPathResult,
  type GameboardNavigationProfile,
  type GameboardReachableTile,
} from './navigation';
import type { HexCoordinates } from './types';

export type BuiltInGameboardMovementProfileId = 'ground' | 'worker' | 'cavalry' | 'ship' | 'flying';
export type GameboardMovementProfileId = BuiltInGameboardMovementProfileId | (string & {});
export type GameboardMovementStatus = 'idle' | 'ready' | 'moving' | 'completed' | 'blocked' | 'out-of-range';

export interface GameboardMovementProfile {
  id: GameboardMovementProfileId;
  label: string;
  movementBudget: number;
  navigation: GameboardNavigationProfile;
}

export type GameboardMovementProfileInput = GameboardMovementProfileId | GameboardMovementProfile;

export interface GameboardMovementProfileRegistry {
  readonly [profileId: string]: GameboardMovementProfile;
}

export interface GameboardMovementOptions {
  profile?: GameboardMovementProfileInput;
  profiles?: GameboardMovementProfileRegistry;
  movementBudget?: number;
  ignorePlacementIds?: readonly string[];
  navigation?: GameboardNavigationProfile;
}

export interface SetGameboardMovementAgentOptions extends GameboardMovementOptions {
  remainingMovement?: number;
}

export interface GameboardMovementPathRequestOptions extends GameboardMovementOptions {
  allowOutOfRangePath?: boolean;
}

export interface AdvanceGameboardMovementOptions extends GameboardMovementOptions {
  steps?: number;
}

export interface GameboardMovementRequestResult {
  entity: Entity;
  placement: PlacementStateValue;
  profile: GameboardMovementProfile;
  path: GameboardNavigationPathResult;
  state: MovementPathStateValue;
}

export interface GameboardMovementAdvanceResult {
  entity: Entity;
  placement: PlacementStateValue;
  profile: GameboardMovementProfile;
  state: MovementPathStateValue;
  moved: boolean;
}

export const GAMEBOARD_MOVEMENT_PROFILES = {
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
} as const satisfies GameboardMovementProfileRegistry;

export const MovementAgent = trait({
  profileId: 'ground' as GameboardMovementProfileId,
  movementBudget: 6,
  remainingMovement: 6,
});

export const MovementPathState = trait({
  status: 'idle' as GameboardMovementStatus,
  destinationKey: '',
  pathKeys: () => [] as string[],
  nextIndex: 0,
  cost: 0,
  spentCost: 0,
  visited: 0,
  reason: undefined as string | undefined,
});

export const IsMoving = trait();

export const MovementAgentQuery = createQuery(IsGameboardPlacement, PlacementState, MovementAgent);
export const ActiveMovementQuery = createQuery(
  IsGameboardPlacement,
  IsMoving,
  PlacementState,
  MovementAgent,
  MovementPathState
);
export const UnitMovementQuery = createQuery(IsUnitPlacement, PlacementState, MovementAgent);

export type MovementAgentValue = TraitRecord<typeof MovementAgent>;
export type MovementPathStateValue = TraitRecord<typeof MovementPathState>;

export const gameboardMovementActions = createActions((world) => ({
  setAgent: (placement: Entity | string, options: SetGameboardMovementAgentOptions = {}) =>
    setGameboardMovementAgent(world, placement, options),
  clear: (placement: Entity | string) => clearGameboardMovement(world, placement),
  resetBudget: (placement?: Entity | string, options: GameboardMovementOptions = {}) =>
    resetGameboardMovementBudget(world, placement, options),
  requestMove: (
    placement: Entity | string,
    destination: HexCoordinates | string,
    options: GameboardMovementPathRequestOptions = {}
  ) => requestGameboardMovement(world, placement, destination, options),
  advance: (placement: Entity | string, options: AdvanceGameboardMovementOptions = {}) =>
    advanceGameboardMovement(world, placement, options),
  runSystem: (options: AdvanceGameboardMovementOptions = {}) => runGameboardMovementSystem(world, options),
  reachable: (placement: Entity | string, options: GameboardMovementOptions = {}) =>
    reachableGameboardMovementTiles(world, placement, options),
}));

export function resolveGameboardMovementProfile(
  profile: GameboardMovementProfileInput | undefined,
  profiles: GameboardMovementProfileRegistry = GAMEBOARD_MOVEMENT_PROFILES
): GameboardMovementProfile {
  if (!profile) {
    return profiles.ground;
  }
  if (typeof profile !== 'string') {
    return profile;
  }
  const resolved = profiles[profile];
  if (!resolved) {
    throw new Error(`Unknown gameboard movement profile: ${profile}`);
  }
  return resolved;
}

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
  if (entity.has(MovementAgent)) {
    entity.set(MovementAgent, nextAgent);
  } else {
    entity.add(MovementAgent(nextAgent));
  }
  if (!entity.has(MovementPathState)) {
    entity.add(MovementPathState);
  }
  return entity;
}

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
    placement: requirePlacementState(entity),
    profile,
    path,
    state: nextState,
  };
}

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

export function runGameboardMovementSystem(
  world: World,
  options: AdvanceGameboardMovementOptions = {}
): GameboardMovementAdvanceResult[] {
  const results: GameboardMovementAdvanceResult[] = [];
  for (const entity of [...world.query(ActiveMovementQuery)]) {
    results.push(advanceGameboardMovement(world, entity, options));
  }
  return results;
}

export function clearGameboardMovement(world: World, placement: Entity | string): Entity {
  const entity = requirePlacementEntity(world, placement);
  entity.remove(IsMoving);
  entity.set(MovementPathState, idleMovementPathState());
  return entity;
}

export function resetGameboardMovementBudget(
  world: World,
  placement?: Entity | string,
  options: GameboardMovementOptions = {}
): Entity[] {
  const entities = placement === undefined ? [...world.query(MovementAgentQuery)] : [requirePlacementEntity(world, placement)];
  for (const entity of entities) {
    const profile = resolveProfileForEntity(entity, options);
    const current = entity.get(MovementAgent);
    const movementBudget = options.movementBudget ?? current?.movementBudget ?? profile.movementBudget;
    entity.set(MovementAgent, {
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
  entity.set(MovementAgent, {
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
    placement: requirePlacementState(entity),
    profile,
    state,
    moved,
  };
}

function requirePlacementEntity(world: World, placement: Entity | string): Entity {
  const entity = findPlacementEntity(world, placement);
  if (!entity) {
    throw new Error(`No placement exists with id ${typeof placement === 'string' ? placement : String(placement.id())}`);
  }
  return entity;
}

function requirePlacementState(entity: Entity): PlacementStateValue {
  const state = entity.get(PlacementState);
  if (!state) {
    throw new Error(`Placement entity ${entity.id()} is missing PlacementState`);
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

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function projectWorldForMovement(world: World): GameboardPlan {
  const board = world.get(GameboardState);
  if (!board) {
    throw new Error('World does not contain GameboardState');
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
