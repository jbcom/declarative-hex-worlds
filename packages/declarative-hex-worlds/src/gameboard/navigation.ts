/**
 * Terrain-aware navigation for pathfinding and movement ranges against board
 * plans or runtime-derived state.
 *
 * @module
 */
import {
  containsHex,
  findHexPath,
  hexKey,
  minHeapCreate,
  minHeapPop,
  minHeapPush,
  neighbors,
  type SpawnLocation,
} from '../coordinates';
import { GameboardRuntimeError } from '../errors';
import type { HexCoordinates } from '../types';
import type {
  GameboardPlacementKind,
  GameboardPlacementLayer,
  GameboardPlacementSpec,
  GameboardPlan,
  GameboardTerrain,
  GameboardTileSpec,
} from './plan';
import { gameboardPlanIndex } from './plan';
import { gameboardPlacementBlocksOccupancy, gameboardPlacementFootprintKeys } from './occupancy';
import {
  planGameboardSpawnGroups as planGameboardSpawnGroupsCore,
  selectGameboardSpawnLocations as selectGameboardSpawnLocationsCore,
  type GameboardSpawnGroup as GameboardSpawnGroupCore,
  type GameboardSpawnGroupOptions as GameboardSpawnGroupOptionsCore,
  type GameboardSpawnGroupPlan as GameboardSpawnGroupPlanCore,
  type GameboardSpawnGroupRoute as GameboardSpawnGroupRouteCore,
  type GameboardSpawnGroupRule as GameboardSpawnGroupRuleCore,
  type GameboardSpawnLocationOptions as GameboardSpawnLocationOptionsCore,
} from './spawn-groups';
import {
  planGameboardPatrolRoute as planGameboardPatrolRouteCore,
  planGameboardPatrolRoutes as planGameboardPatrolRoutesCore,
  type GameboardPatrolRouteOptions as GameboardPatrolRouteOptionsCore,
  type GameboardPatrolRoutePlan as GameboardPatrolRoutePlanCore,
  type GameboardPatrolRouteRule as GameboardPatrolRouteRuleCore,
  type GameboardPatrolRouteSegment as GameboardPatrolRouteSegmentCore,
  type GameboardPatrolRouteSet as GameboardPatrolRouteSetCore,
  type GameboardPatrolRouteSetOptions as GameboardPatrolRouteSetOptionsCore,
  type GameboardPatrolWaypoint as GameboardPatrolWaypointCore,
  type GameboardPatrolWaypointSource as GameboardPatrolWaypointSourceCore,
} from './patrol-routes';

/**
 * Pathfinding profile for terrain, elevation, occupancy, and custom movement rules.
 */
export interface GameboardNavigationProfile {
  /** Terrain values the profile may enter. Undefined means all except blocked terrain. */
  allowedTerrain?: readonly GameboardTerrain[];
  /** Terrain values the profile may not enter. */
  blockedTerrain?: readonly GameboardTerrain[];
  /** Additional movement costs by terrain value. */
  terrainCosts?: Readonly<Record<string, number>>;
  /** Placement kinds that block movement. */
  blockingPlacementKinds?: readonly GameboardPlacementKind[];
  /** Placement layers that block movement. */
  blockingPlacementLayers?: readonly GameboardPlacementLayer[];
  /** Placement ids ignored by occupancy checks. */
  ignorePlacementIds?: readonly string[];
  /** Maximum allowed elevation change between adjacent tiles. */
  maxElevationStep?: number;
  /** Whether the start tile may be blocked. */
  allowStartBlocked?: boolean;
  /** Whether the goal tile may be blocked. */
  allowGoalBlocked?: boolean;
  /** Optional custom tile-entry predicate. */
  canEnter?: (tile: GameboardTileSpec, context: GameboardNavigationContext) => boolean;
  /** Optional custom movement-cost function. */
  cost?: (from: GameboardTileSpec, to: GameboardTileSpec, baseCost: number) => number;
}

/**
 * Context passed to custom navigation profile hooks.
 */
export interface GameboardNavigationContext {
  /** Board plan being navigated. */
  plan: GameboardPlan;
  /** Source tile for this movement step, when known. */
  from?: GameboardTileSpec;
  /** Destination tile being evaluated. */
  to: GameboardTileSpec;
  /** Placements occupying the destination tile. */
  placements: readonly GameboardPlacementSpec[];
}

/**
 * Occupancy index used by navigation and spawn planning.
 */
export interface GameboardOccupancyIndex {
  /** Placements grouped by occupied tile key. */
  byTileKey: ReadonlyMap<string, readonly GameboardPlacementSpec[]>;
  /** Tile keys occupied by any placement footprint. */
  occupiedTileKeys: ReadonlySet<string>;
  /** Tile keys occupied by blocking placement footprints. */
  blockingTileKeys: ReadonlySet<string>;
}

/**
 * Reusable navigation facade for one plan/profile pair.
 */
export interface GameboardNavigation {
  /** Board plan being navigated. */
  plan: GameboardPlan;
  /** Normalized required navigation profile. */
  profile: RequiredGameboardNavigationProfile;
  /** Tile lookup by tile key. */
  tilesByKey: ReadonlyMap<string, GameboardTileSpec>;
  /** Occupancy lookup for the plan/profile pair. */
  occupancy: GameboardOccupancyIndex;
  /** Resolve a tile from coordinates or tile key. */
  tileAt: (coordinates: HexCoordinates | string) => GameboardTileSpec | undefined;
  /** Read placements occupying a tile. */
  placementsAt: (coordinates: HexCoordinates | string) => readonly GameboardPlacementSpec[];
  /** Return whether a tile key or coordinates are blocked. */
  isBlocked: (coordinates: HexCoordinates | string) => boolean;
  /** Return whether a tile can be entered from an optional source tile. */
  canEnter: (coordinates: HexCoordinates | string, from?: HexCoordinates | string) => boolean;
  /** Calculate movement cost between adjacent tiles. */
  movementCost: (from: HexCoordinates | string, to: HexCoordinates | string) => number;
  /** Return neighboring tiles inside the board. */
  neighbors: (coordinates: HexCoordinates | string) => GameboardTileSpec[];
  /** Find a path between two tiles. */
  findPath: (
    start: HexCoordinates | string,
    goal: HexCoordinates | string
  ) => GameboardNavigationPathResult;
  /** Return tiles reachable from a start tile within a movement budget. */
  reachable: (start: HexCoordinates | string, movementBudget: number) => GameboardReachableTile[];
}

/**
 * Fully normalized navigation profile used internally and exposed for debugging.
 */
export interface RequiredGameboardNavigationProfile {
  /** Terrain values the profile may enter. Undefined means all except blocked terrain. */
  allowedTerrain?: readonly GameboardTerrain[];
  /** Terrain values the profile may not enter. */
  blockedTerrain: readonly GameboardTerrain[];
  /** Additional movement costs by terrain value. */
  terrainCosts: Readonly<Record<string, number>>;
  /** Placement kinds that block movement. */
  blockingPlacementKinds: readonly GameboardPlacementKind[];
  /** Placement layers that block movement. */
  blockingPlacementLayers: readonly GameboardPlacementLayer[];
  /** Placement ids ignored by occupancy checks. */
  ignorePlacementIds: readonly string[];
  /** Maximum allowed elevation change between adjacent tiles. */
  maxElevationStep: number;
  /** Whether the start tile may be blocked. */
  allowStartBlocked: boolean;
  /** Whether the goal tile may be blocked. */
  allowGoalBlocked: boolean;
  /** Optional custom tile-entry predicate. */
  canEnter?: (tile: GameboardTileSpec, context: GameboardNavigationContext) => boolean;
  /** Optional custom movement-cost function. */
  cost?: (from: GameboardTileSpec, to: GameboardTileSpec, baseCost: number) => number;
}

/**
 * Pathfinding result between two tiles.
 */
export interface GameboardNavigationPathResult {
  /** Whether a route was found. */
  found: boolean;
  /** Tile specs along the route. */
  path: readonly GameboardTileSpec[];
  /** Coordinates along the route. */
  coordinates: readonly HexCoordinates[];
  /** Total route cost. */
  cost: number;
  /** Number of nodes visited by the pathfinder. */
  visited: number;
}

/**
 * Reachable tile and accumulated movement cost.
 */
export interface GameboardReachableTile {
  /** Reachable tile. */
  tile: GameboardTileSpec;
  /** Reachable tile coordinates. */
  coordinates: HexCoordinates;
  /** Movement cost from the start tile. */
  cost: number;
}

/**
 * Options for selecting spawn locations from a gameboard plan.
 */
export type GameboardSpawnLocationOptions = GameboardSpawnLocationOptionsCore;

/**
 * Rule for selecting one spawn group and checking routes to earlier groups.
 */
export type GameboardSpawnGroupRule = GameboardSpawnGroupRuleCore;

/**
 * Options for selecting several spawn groups in sequence.
 */
export type GameboardSpawnGroupOptions = GameboardSpawnGroupOptionsCore;

/**
 * Route check between two spawn groups.
 */
export type GameboardSpawnGroupRoute = GameboardSpawnGroupRouteCore;

/**
 * Selected spawn group with diagnostics.
 */
export type GameboardSpawnGroup = GameboardSpawnGroupCore;

/**
 * Complete spawn group planning result.
 */
export type GameboardSpawnGroupPlan = GameboardSpawnGroupPlanCore;

/**
 * Source used to create a patrol waypoint.
 */
export type GameboardPatrolWaypointSource = GameboardPatrolWaypointSourceCore;

/**
 * Spawn location promoted to a patrol waypoint.
 */
export type GameboardPatrolWaypoint = GameboardPatrolWaypointCore;

/**
 * One path segment between patrol waypoints.
 */
export type GameboardPatrolRouteSegment = GameboardPatrolRouteSegmentCore;

/**
 * Options for planning one patrol route.
 */
export type GameboardPatrolRouteOptions = GameboardPatrolRouteOptionsCore;

/**
 * Named patrol route rule for route-set planning.
 */
export type GameboardPatrolRouteRule = GameboardPatrolRouteRuleCore;

/**
 * Options for planning several patrol routes.
 */
export type GameboardPatrolRouteSetOptions = GameboardPatrolRouteSetOptionsCore;

/**
 * Planned patrol route with waypoints, segments, and diagnostics.
 */
export type GameboardPatrolRoutePlan = GameboardPatrolRoutePlanCore;

/**
 * Result for planning a set of patrol routes.
 */
export type GameboardPatrolRouteSet = GameboardPatrolRouteSetCore;

const DEFAULT_NAVIGATION_PROFILE = {
  blockedTerrain: ['water'] as readonly GameboardTerrain[],
  terrainCosts: {},
  blockingPlacementKinds: ['structure', 'unit'] as readonly GameboardPlacementKind[],
  blockingPlacementLayers: [] as readonly GameboardPlacementLayer[],
  ignorePlacementIds: [] as readonly string[],
  maxElevationStep: 1,
  allowStartBlocked: true,
  allowGoalBlocked: false,
} satisfies RequiredGameboardNavigationProfile;

/**
 * Build an occupancy index for a plan under a navigation profile.
 */
export function createGameboardOccupancyIndex(
  plan: GameboardPlan,
  profile: GameboardNavigationProfile = {}
): GameboardOccupancyIndex {
  const normalized = normalizeNavigationProfile(profile);
  const ignored = new Set(normalized.ignorePlacementIds);
  const byTileKey = new Map<string, GameboardPlacementSpec[]>();
  const blockingTileKeys = new Set<string>();

  for (const placement of plan.placements) {
    const footprintKeys = gameboardPlacementFootprintKeys(placement);
    for (const tileKey of footprintKeys) {
      const placements = byTileKey.get(tileKey) ?? [];
      placements.push(placement);
      byTileKey.set(tileKey, placements);
    }
    if (!ignored.has(placement.id) && placementBlocksMovement(placement, normalized)) {
      for (const tileKey of footprintKeys) {
        blockingTileKeys.add(tileKey);
      }
    }
  }

  return {
    byTileKey,
    occupiedTileKeys: new Set(byTileKey.keys()),
    blockingTileKeys,
  };
}

/**
 * Create a reusable navigation facade for pathfinding, reachability, and tile
 * occupancy queries.
 */
export function createGameboardNavigation(
  plan: GameboardPlan,
  profile: GameboardNavigationProfile = {}
): GameboardNavigation {
  const normalized = normalizeNavigationProfile(profile);
  const tilesByKey = new Map(plan.tiles.map((tile) => [tile.key, tile]));
  const occupancy = createGameboardOccupancyIndex(plan, normalized);

  const tileAt = (coordinates: HexCoordinates | string) => tilesByKey.get(keyFor(coordinates));
  const placementsAt = (coordinates: HexCoordinates | string) =>
    occupancy.byTileKey.get(keyFor(coordinates)) ?? [];
  const isBlocked = (coordinates: HexCoordinates | string) =>
    occupancy.blockingTileKeys.has(keyFor(coordinates));
  const canEnter = (coordinates: HexCoordinates | string, from?: HexCoordinates | string) =>
    canEnterTile(plan, normalized, tilesByKey, occupancy, coordinates, from);
  const movementCost = (from: HexCoordinates | string, to: HexCoordinates | string) =>
    movementCostBetween(normalized, tilesByKey, occupancy, from, to);

  return {
    plan,
    profile: normalized,
    tilesByKey,
    occupancy,
    tileAt,
    placementsAt,
    isBlocked,
    canEnter,
    movementCost,
    neighbors: (coordinates) =>
      neighbors(coordinatesFor(coordinates))
        .map((candidate) => tileAt(candidate))
        .filter((tile): tile is GameboardTileSpec => tile !== undefined),
    findPath: (start, goal) =>
      findGameboardPath(plan, start, goal, normalized, tilesByKey, occupancy),
    reachable: (start, movementBudget) =>
      reachableGameboardTiles(plan, start, movementBudget, normalized, tilesByKey, occupancy),
  };
}

/**
 * Find the lowest-cost path between two tiles under a navigation profile.
 */
export function findGameboardPath(
  plan: GameboardPlan,
  start: HexCoordinates | string,
  goal: HexCoordinates | string,
  profile: GameboardNavigationProfile = {},
  tilesByKey: ReadonlyMap<string, GameboardTileSpec> = gameboardPlanIndex(plan).tilesByKey,
  occupancy: GameboardOccupancyIndex = createGameboardOccupancyIndex(plan, profile)
): GameboardNavigationPathResult {
  const normalized = normalizeNavigationProfile(profile);
  const startCoordinates = coordinatesFor(start);
  const goalCoordinates = coordinatesFor(goal);
  const startTile = tilesByKey.get(hexKey(startCoordinates));
  const goalTile = tilesByKey.get(hexKey(goalCoordinates));
  if (!startTile || !goalTile) {
    return { found: false, path: [], coordinates: [], cost: Number.POSITIVE_INFINITY, visited: 0 };
  }
  if (
    !normalized.allowStartBlocked &&
    !canEnterTile(plan, normalized, tilesByKey, occupancy, startCoordinates)
  ) {
    return { found: false, path: [], coordinates: [], cost: Number.POSITIVE_INFINITY, visited: 0 };
  }
  if (
    !normalized.allowGoalBlocked &&
    !canEnterTile(plan, normalized, tilesByKey, occupancy, goalCoordinates, startCoordinates)
  ) {
    return { found: false, path: [], coordinates: [], cost: Number.POSITIVE_INFINITY, visited: 0 };
  }

  const path = findHexPath(startCoordinates, goalCoordinates, {
    shape: plan.shape,
    passable: (coordinates, from) => {
      if (hexKey(coordinates) === hexKey(goalCoordinates) && normalized.allowGoalBlocked) {
        return true;
      }
      return canEnterTile(plan, normalized, tilesByKey, occupancy, coordinates, from);
    },
    cost: (from, to) => movementCostBetween(normalized, tilesByKey, occupancy, from, to),
    maxVisited: plan.tiles.length * 4,
  });

  return {
    found: path.found,
    coordinates: path.path,
    path: path.path
      .map((coordinates) => tilesByKey.get(hexKey(coordinates)))
      .filter((tile): tile is GameboardTileSpec => tile !== undefined),
    cost: path.cost,
    visited: path.visited,
  };
}

/**
 * Return all tiles reachable from a start tile within a movement budget.
 */
export function reachableGameboardTiles(
  plan: GameboardPlan,
  start: HexCoordinates | string,
  movementBudget: number,
  profile: GameboardNavigationProfile = {},
  tilesByKey: ReadonlyMap<string, GameboardTileSpec> = gameboardPlanIndex(plan).tilesByKey,
  occupancy: GameboardOccupancyIndex = createGameboardOccupancyIndex(plan, profile)
): GameboardReachableTile[] {
  const normalized = normalizeNavigationProfile(profile);
  const startCoordinates = coordinatesFor(start);
  const startTile = tilesByKey.get(hexKey(startCoordinates));
  if (!startTile || movementBudget < 0) {
    return [];
  }

  const costByKey = new Map<string, number>([[startTile.key, 0]]);
  const heap = minHeapCreate<[number, string]>((a, b) => a[0] - b[0]);
  minHeapPush(heap, [0, startTile.key]);

  while (heap.length > 0) {
    const popped = minHeapPop(heap);
    /* v8 ignore next 3 -- heap.length guard prevents empty pops. */
    if (popped === undefined) {
      continue;
    }
    const [heapCost, currentKey] = popped;
    const recordedCost = costByKey.get(currentKey);
    /* v8 ignore next 3 -- heap keys are pushed only after recording their cost. */
    if (recordedCost === undefined || heapCost > recordedCost) {
      continue;
    }
    const current = tilesByKey.get(currentKey);
    /* v8 ignore next 3 -- reachable heap keys are always known plan tiles. */
    if (!current) {
      continue;
    }

    for (const adjacentCoordinates of neighbors(current.coordinates)) {
      if (!containsHex(plan.shape, adjacentCoordinates)) {
        continue;
      }
      if (
        !canEnterTile(
          plan,
          normalized,
          tilesByKey,
          occupancy,
          adjacentCoordinates,
          current.coordinates
        )
      ) {
        continue;
      }
      const adjacent = tilesByKey.get(hexKey(adjacentCoordinates));
      /* v8 ignore next 3 -- canEnterTile already rejects missing adjacent tiles. */
      if (!adjacent) {
        continue;
      }
      const nextCost =
        recordedCost +
        movementCostBetween(
          normalized,
          tilesByKey,
          occupancy,
          current.coordinates,
          adjacent.coordinates
        );
      if (
        nextCost > movementBudget ||
        nextCost >= (costByKey.get(adjacent.key) ?? Number.POSITIVE_INFINITY)
      ) {
        continue;
      }
      costByKey.set(adjacent.key, nextCost);
      minHeapPush(heap, [nextCost, adjacent.key]);
    }
  }

  return [...costByKey.entries()]
    .map(([key, cost]) => {
      const tile = tilesByKey.get(key);
      /* v8 ignore next -- costByKey is populated only from indexed tiles. */
      return tile ? { tile, coordinates: tile.coordinates, cost } : undefined;
    })
    .filter((tile): tile is GameboardReachableTile => tile !== undefined)
    .sort(
      (left, right) =>
        left.cost - right.cost ||
        left.tile.coordinates.r - right.tile.coordinates.r ||
        left.tile.coordinates.q - right.tile.coordinates.q
    );
}

/**
 * Select deterministic spawn locations from passable plan tiles.
 */
export function selectGameboardSpawnLocations(
  plan: GameboardPlan,
  options: GameboardSpawnLocationOptions
): SpawnLocation[] {
  return selectGameboardSpawnLocationsCore(plan, options);
}

/**
 * Plan multiple spawn groups in order, with optional inter-group distance and
 * route checks.
 */
export function planGameboardSpawnGroups(
  plan: GameboardPlan,
  options: GameboardSpawnGroupOptions
): GameboardSpawnGroupPlan {
  return planGameboardSpawnGroupsCore(plan, options);
}

/**
 * Plan one patrol route from an explicit start, a spawn-group start, or generated
 * waypoints.
 */
export function planGameboardPatrolRoute(
  plan: GameboardPlan,
  options: GameboardPatrolRouteOptions
): GameboardPatrolRoutePlan {
  return planGameboardPatrolRouteCore(plan, options);
}

/**
 * Plan a set of named patrol routes with shared spawn group and navigation
 * defaults.
 */
export function planGameboardPatrolRoutes(
  plan: GameboardPlan,
  options: GameboardPatrolRouteSetOptions
): GameboardPatrolRouteSet {
  return planGameboardPatrolRoutesCore(plan, options);
}

function normalizeNavigationProfile(
  profile: GameboardNavigationProfile
): RequiredGameboardNavigationProfile {
  return {
    ...DEFAULT_NAVIGATION_PROFILE,
    ...profile,
    terrainCosts: { ...DEFAULT_NAVIGATION_PROFILE.terrainCosts, ...(profile.terrainCosts ?? {}) },
    blockedTerrain: [...(profile.blockedTerrain ?? DEFAULT_NAVIGATION_PROFILE.blockedTerrain)],
    blockingPlacementKinds: [
      ...(profile.blockingPlacementKinds ?? DEFAULT_NAVIGATION_PROFILE.blockingPlacementKinds),
    ],
    blockingPlacementLayers: [
      ...(profile.blockingPlacementLayers ?? DEFAULT_NAVIGATION_PROFILE.blockingPlacementLayers),
    ],
    ignorePlacementIds: [
      ...(profile.ignorePlacementIds ?? DEFAULT_NAVIGATION_PROFILE.ignorePlacementIds),
    ],
  };
}

function canEnterTile(
  plan: GameboardPlan,
  profile: RequiredGameboardNavigationProfile,
  tilesByKey: ReadonlyMap<string, GameboardTileSpec>,
  occupancy: GameboardOccupancyIndex,
  coordinates: HexCoordinates | string,
  from?: HexCoordinates | string
): boolean {
  const tile = tilesByKey.get(keyFor(coordinates));
  if (!tile) {
    return false;
  }
  const fromTile = from ? tilesByKey.get(keyFor(from)) : undefined;
  if (fromTile && Math.abs(tile.elevation - fromTile.elevation) > profile.maxElevationStep) {
    return false;
  }
  if (profile.allowedTerrain && !profile.allowedTerrain.includes(tile.terrain)) {
    return false;
  }
  if (profile.blockedTerrain.includes(tile.terrain)) {
    return false;
  }
  if (occupancy.blockingTileKeys.has(tile.key)) {
    return false;
  }
  return (
    profile.canEnter?.(tile, {
      plan,
      from: fromTile,
      to: tile,
      /* v8 ignore next -- indexed plan tiles always carry generated terrain placement entries. */
      placements: occupancy.byTileKey.get(tile.key) ?? [],
    }) ?? true
  );
}

function movementCostBetween(
  profile: RequiredGameboardNavigationProfile,
  tilesByKey: ReadonlyMap<string, GameboardTileSpec>,
  occupancy: GameboardOccupancyIndex,
  from: HexCoordinates | string,
  to: HexCoordinates | string
): number {
  const fromTile = tilesByKey.get(keyFor(from));
  const toTile = tilesByKey.get(keyFor(to));
  if (!fromTile || !toTile) {
    return Number.POSITIVE_INFINITY;
  }
  if (Math.abs(toTile.elevation - fromTile.elevation) > profile.maxElevationStep) {
    return Number.POSITIVE_INFINITY;
  }
  const terrainCost = profile.terrainCosts[toTile.terrain] ?? 1;
  const elevationCost = Math.max(0, toTile.elevation - fromTile.elevation);
  const baseCost = terrainCost + elevationCost;
  void occupancy;
  return profile.cost?.(fromTile, toTile, baseCost) ?? baseCost;
}

function placementBlocksMovement(
  placement: GameboardPlacementSpec,
  profile: RequiredGameboardNavigationProfile
): boolean {
  return gameboardPlacementBlocksOccupancy(placement, profile);
}

function coordinatesFor(coordinates: HexCoordinates | string): HexCoordinates {
  if (typeof coordinates !== 'string') {
    return coordinates;
  }
  const [q, r] = coordinates.split(',').map(Number);
  if (q === undefined || r === undefined) {
    throw new GameboardRuntimeError(`Invalid hex key string: ${coordinates}`);
  }
  return { q, r };
}

function keyFor(coordinates: HexCoordinates | string): string {
  return typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
}
