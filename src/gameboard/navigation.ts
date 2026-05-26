/**
 * Terrain-aware navigation for pathfinding, movement ranges, spawn groups, and
 * patrol-route planning against board plans or runtime-derived state.
 *
 * @module
 */
import { containsHex, findHexPath, hexDistance, hexKey, neighbors } from '../coordinates';
import type {
  GameboardPlacementKind,
  GameboardPlacementLayer,
  GameboardPlacementSpec,
  GameboardPlan,
  GameboardTerrain,
  GameboardTileSpec,
} from './gameboard';
import {
  axialToWorld,
  createSpawnLocations,
  type SpawnLocation,
  type SpawnLocationOptions,
} from '../coordinates';
import {
  gameboardPlacementBlocksOccupancy,
  gameboardPlacementFootprintKeys,
} from './occupancy';
import type { HexCoordinates } from '../types';

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
  findPath: (start: HexCoordinates | string, goal: HexCoordinates | string) => GameboardNavigationPathResult;
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
export interface GameboardSpawnLocationOptions
  extends Omit<SpawnLocationOptions, 'shape' | 'candidates' | 'passable'> {
  /** Navigation profile used to reject blocked candidates. */
  profile?: GameboardNavigationProfile;
  /** Allowed terrain for spawn candidates. */
  terrain?: GameboardTerrain | readonly GameboardTerrain[];
  /** Minimum candidate elevation. */
  minElevation?: number;
  /** Maximum candidate elevation. */
  maxElevation?: number;
  /** Tile tags that must all be present. */
  tileTags?: readonly string[];
  /** Tile tags that must all be absent. */
  excludeTileTags?: readonly string[];
}

/**
 * Rule for selecting one spawn group and checking routes to earlier groups.
 */
export interface GameboardSpawnGroupRule extends GameboardSpawnLocationOptions {
  /** Stable spawn group id. */
  id: string;
  /** Minimum distance from locations selected by previous groups. */
  minDistanceFromGroups?: number;
  /** Previous group ids that must be path-checked from this group. */
  pathToGroups?: readonly string[];
  /** Treat missing routes to `pathToGroups` as errors. */
  requirePathToGroups?: boolean;
  /** Navigation profile used only for route checks. */
  routeProfile?: GameboardNavigationProfile;
}

/**
 * Options for selecting several spawn groups in sequence.
 */
export interface GameboardSpawnGroupOptions {
  /** Shared seed for deterministic group selection. */
  seed?: string | number;
  /** Default navigation profile for group candidates and route checks. */
  profile?: GameboardNavigationProfile;
  /** Ordered spawn group rules. */
  groups: readonly GameboardSpawnGroupRule[];
}

/**
 * Route check between two spawn groups.
 */
export interface GameboardSpawnGroupRoute {
  /** Source group id. */
  fromGroupId: string;
  /** Target group id. */
  toGroupId: string;
  /** Whether a route was found. */
  found: boolean;
  /** Source location tile key. */
  fromKey?: string;
  /** Target location tile key. */
  toKey?: string;
  /** Path tile keys for the best route. */
  pathKeys: readonly string[];
  /** Route cost. */
  cost: number;
  /** Number of nodes visited by the pathfinder. */
  visited: number;
}

/**
 * Selected spawn group with diagnostics.
 */
export interface GameboardSpawnGroup {
  /** Spawn group id. */
  id: string;
  /** Number of requested locations. */
  requestedCount: number;
  /** Number of selected locations. */
  selectedCount: number;
  /** Candidate location count after filtering. */
  candidateCount: number;
  /** Number of candidates removed by distance-from-group filtering. */
  rejectedByGroupDistanceCount: number;
  /** Selected spawn locations. */
  locations: readonly SpawnLocation[];
  /** Route checks requested by this group. */
  routeChecks: readonly GameboardSpawnGroupRoute[];
  /** Non-fatal group diagnostics. */
  warnings: readonly string[];
  /** Fatal group diagnostics. */
  errors: readonly string[];
}

/**
 * Complete spawn group planning result.
 */
export interface GameboardSpawnGroupPlan {
  /** Seed used by the group planner. */
  seed: string;
  /** Number of groups planned. */
  groupCount: number;
  /** Total number of selected locations. */
  selectedLocationCount: number;
  /** Per-group results. */
  groups: readonly GameboardSpawnGroup[];
  /** All route checks across groups. */
  routeChecks: readonly GameboardSpawnGroupRoute[];
  /** All warnings prefixed by group id. */
  warnings: readonly string[];
  /** All errors prefixed by group id. */
  errors: readonly string[];
}

/**
 * Source used to create a patrol waypoint.
 */
export type GameboardPatrolWaypointSource = 'explicit-start' | 'spawn-group' | 'generated';

/**
 * Spawn location promoted to a patrol waypoint.
 */
export interface GameboardPatrolWaypoint extends SpawnLocation {
  /** Waypoint index in route order. */
  index: number;
  /** Source used to create this waypoint. */
  source: GameboardPatrolWaypointSource;
  /** Spawn group id when sourced from a group. */
  spawnGroupId?: string;
  /** Spawn location index when sourced from a group. */
  spawnLocationIndex?: number;
}

/**
 * One path segment between patrol waypoints.
 */
export interface GameboardPatrolRouteSegment {
  /** Source waypoint index. */
  fromIndex: number;
  /** Target waypoint index. */
  toIndex: number;
  /** Source tile key. */
  fromKey?: string;
  /** Target tile key. */
  toKey?: string;
  /** Whether this segment was found. */
  found: boolean;
  /** Path tile keys for this segment. */
  pathKeys: readonly string[];
  /** Segment path cost. */
  cost: number;
  /** Number of nodes visited by the pathfinder. */
  visited: number;
}

/**
 * Options for planning one patrol route.
 */
export interface GameboardPatrolRouteOptions
  extends Omit<GameboardSpawnLocationOptions, 'count'> {
  /** Route id. */
  id?: string;
  /** Requested waypoint count. */
  count?: number;
  /** Explicit start tile, actor, or key. */
  start?: HexCoordinates | string;
  /** Spawn group id used for the start waypoint. */
  startGroupId?: string;
  /** Location index within the start spawn group. */
  startLocationIndex?: number;
  /** Existing spawn group plan used for start resolution. */
  spawnGroups?: GameboardSpawnGroupPlan;
  /** Navigation profile used for route segments. */
  routeProfile?: GameboardNavigationProfile;
  /** Whether the patrol returns to its first waypoint. */
  loop?: boolean;
  /** Treat missing route segments as errors. */
  requireCompleteRoute?: boolean;
}

/**
 * Named patrol route rule for route-set planning.
 */
export interface GameboardPatrolRouteRule
  extends Omit<GameboardPatrolRouteOptions, 'spawnGroups'> {
  /** Stable route id. */
  id: string;
}

/**
 * Options for planning several patrol routes.
 */
export interface GameboardPatrolRouteSetOptions {
  /** Shared route-set seed. */
  seed?: string | number;
  /** Default candidate navigation profile. */
  profile?: GameboardNavigationProfile;
  /** Default route-segment navigation profile. */
  routeProfile?: GameboardNavigationProfile;
  /** Spawn group plan used by routes that start from groups. */
  spawnGroups?: GameboardSpawnGroupPlan;
  /** Route rules to plan. */
  routes: readonly GameboardPatrolRouteRule[];
}

/**
 * Planned patrol route with waypoints, segments, and diagnostics.
 */
export interface GameboardPatrolRoutePlan {
  /** Route id. */
  id: string;
  /** Seed used by this route. */
  seed: string;
  /** Requested waypoint count. */
  requestedWaypointCount: number;
  /** Selected waypoint count. */
  selectedWaypointCount: number;
  /** Whether this route loops to the start. */
  loop: boolean;
  /** Whether the route satisfies all required segments. */
  found: boolean;
  /** Total route cost. */
  cost: number;
  /** Total pathfinder visits across segments. */
  visited: number;
  /** Waypoints in route order. */
  waypoints: readonly GameboardPatrolWaypoint[];
  /** Route segments between waypoints. */
  segments: readonly GameboardPatrolRouteSegment[];
  /** Combined path tile keys. */
  pathKeys: readonly string[];
  /** Non-fatal route diagnostics. */
  warnings: readonly string[];
  /** Fatal route diagnostics. */
  errors: readonly string[];
}

/**
 * Result for planning a set of patrol routes.
 */
export interface GameboardPatrolRouteSet {
  /** Seed used by the route set. */
  seed: string;
  /** Number of routes planned. */
  routeCount: number;
  /** Planned routes. */
  routes: readonly GameboardPatrolRoutePlan[];
  /** All warnings prefixed by route id. */
  warnings: readonly string[];
  /** All errors prefixed by route id. */
  errors: readonly string[];
}

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
  const placementsAt = (coordinates: HexCoordinates | string) => occupancy.byTileKey.get(keyFor(coordinates)) ?? [];
  const isBlocked = (coordinates: HexCoordinates | string) => occupancy.blockingTileKeys.has(keyFor(coordinates));
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
    findPath: (start, goal) => findGameboardPath(plan, start, goal, normalized, tilesByKey, occupancy),
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
  tilesByKey: ReadonlyMap<string, GameboardTileSpec> = new Map(plan.tiles.map((tile) => [tile.key, tile])),
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
  if (!normalized.allowStartBlocked && !canEnterTile(plan, normalized, tilesByKey, occupancy, startCoordinates)) {
    return { found: false, path: [], coordinates: [], cost: Number.POSITIVE_INFINITY, visited: 0 };
  }
  if (!normalized.allowGoalBlocked && !canEnterTile(plan, normalized, tilesByKey, occupancy, goalCoordinates, startCoordinates)) {
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
  tilesByKey: ReadonlyMap<string, GameboardTileSpec> = new Map(plan.tiles.map((tile) => [tile.key, tile])),
  occupancy: GameboardOccupancyIndex = createGameboardOccupancyIndex(plan, profile)
): GameboardReachableTile[] {
  const normalized = normalizeNavigationProfile(profile);
  const startCoordinates = coordinatesFor(start);
  const startTile = tilesByKey.get(hexKey(startCoordinates));
  if (!startTile || movementBudget < 0) {
    return [];
  }

  const costByKey = new Map<string, number>([[startTile.key, 0]]);
  const open = new Set<string>([startTile.key]);

  while (open.size > 0) {
    const currentKey = lowestCostKey(open, costByKey);
    open.delete(currentKey);
    const current = tilesByKey.get(currentKey);
    if (!current) {
      continue;
    }

    for (const adjacentCoordinates of neighbors(current.coordinates)) {
      if (!containsHex(plan.shape, adjacentCoordinates)) {
        continue;
      }
      if (!canEnterTile(plan, normalized, tilesByKey, occupancy, adjacentCoordinates, current.coordinates)) {
        continue;
      }
      const adjacent = tilesByKey.get(hexKey(adjacentCoordinates));
      if (!adjacent) {
        continue;
      }
      const nextCost =
        (costByKey.get(currentKey) ?? Number.POSITIVE_INFINITY) +
        movementCostBetween(normalized, tilesByKey, occupancy, current.coordinates, adjacent.coordinates);
      if (nextCost > movementBudget || nextCost >= (costByKey.get(adjacent.key) ?? Number.POSITIVE_INFINITY)) {
        continue;
      }
      costByKey.set(adjacent.key, nextCost);
      open.add(adjacent.key);
    }
  }

  return [...costByKey.entries()]
    .map(([key, cost]) => {
      const tile = tilesByKey.get(key);
      return tile ? { tile, coordinates: tile.coordinates, cost } : undefined;
    })
    .filter((tile): tile is GameboardReachableTile => tile !== undefined)
    .sort((left, right) => left.cost - right.cost || left.tile.coordinates.r - right.tile.coordinates.r || left.tile.coordinates.q - right.tile.coordinates.q);
}

/**
 * Select deterministic spawn locations from passable plan tiles.
 */
export function selectGameboardSpawnLocations(
  plan: GameboardPlan,
  options: GameboardSpawnLocationOptions
): SpawnLocation[] {
  const navigation = createGameboardNavigation(plan, options.profile);
  const candidates = spawnCandidateCoordinates(plan, navigation, options);
  return createSpawnLocations({
    ...options,
    shape: plan.shape,
    candidates,
  });
}

/**
 * Plan multiple spawn groups in order, with optional inter-group distance and
 * route checks.
 */
export function planGameboardSpawnGroups(
  plan: GameboardPlan,
  options: GameboardSpawnGroupOptions
): GameboardSpawnGroupPlan {
  const seed = String(options.seed ?? `${plan.seed}:spawn-groups`);
  const groups: GameboardSpawnGroup[] = [];
  const groupsById = new Map<string, GameboardSpawnGroup>();
  const selectedLocations: SpawnLocation[] = [];
  const seenGroupIds = new Set<string>();

  for (const rule of options.groups) {
    const warnings: string[] = [];
    const errors: string[] = [];
    if (!rule.id) {
      errors.push('Spawn group id must be a non-empty string');
    }
    if (seenGroupIds.has(rule.id)) {
      errors.push(`Spawn group ${rule.id} is declared more than once`);
    }
    seenGroupIds.add(rule.id);

    const profile = rule.profile ?? options.profile;
    const navigation = createGameboardNavigation(plan, profile);
    const candidates = spawnCandidateCoordinates(plan, navigation, rule);
    const minDistanceFromGroups = Math.max(0, Math.floor(rule.minDistanceFromGroups ?? 0));
    const filteredCandidates = minDistanceFromGroups > 0
      ? candidates.filter((candidate) =>
          selectedLocations.every(
            (location) => hexDistance(location.coordinates, candidate) >= minDistanceFromGroups
          )
        )
      : candidates;
    const locations = createSpawnLocations({
      ...rule,
      seed: rule.seed ?? `${seed}:${rule.id}`,
      idPrefix: rule.idPrefix ?? `spawn:${rule.id}`,
      shape: plan.shape,
      candidates: filteredCandidates,
    });

    if (locations.length < rule.count) {
      errors.push(`Spawn group ${rule.id} selected ${locations.length}/${rule.count} requested location(s)`);
    }

    const routeChecks = (rule.pathToGroups ?? []).map((targetGroupId) => {
      const targetGroup = groupsById.get(targetGroupId);
      if (!targetGroup) {
        errors.push(`Spawn group ${rule.id} references unknown route target group ${targetGroupId}`);
        return emptySpawnGroupRoute(rule.id, targetGroupId);
      }
      const route = bestSpawnGroupRoute(
        createGameboardNavigation(plan, rule.routeProfile ?? profile),
        rule.id,
        locations,
        targetGroup.id,
        targetGroup.locations
      );
      if ((rule.requirePathToGroups ?? true) && !route.found) {
        errors.push(`Spawn group ${rule.id} has no passable route to group ${targetGroupId}`);
      }
      return route;
    });

    const group: GameboardSpawnGroup = {
      id: rule.id,
      requestedCount: rule.count,
      selectedCount: locations.length,
      candidateCount: filteredCandidates.length,
      rejectedByGroupDistanceCount: candidates.length - filteredCandidates.length,
      locations,
      routeChecks,
      warnings,
      errors,
    };
    groups.push(group);
    groupsById.set(group.id, group);
    selectedLocations.push(...locations);
  }

  const routeChecks = groups.flatMap((group) => [...group.routeChecks]);
  const warnings = groups.flatMap((group) => group.warnings.map((warning) => `${group.id}: ${warning}`));
  const errors = groups.flatMap((group) => group.errors.map((error) => `${group.id}: ${error}`));

  return {
    seed,
    groupCount: groups.length,
    selectedLocationCount: groups.reduce((count, group) => count + group.selectedCount, 0),
    groups,
    routeChecks,
    warnings,
    errors,
  };
}

/**
 * Plan one patrol route from an explicit start, a spawn-group start, or generated
 * waypoints.
 */
export function planGameboardPatrolRoute(
  plan: GameboardPlan,
  options: GameboardPatrolRouteOptions
): GameboardPatrolRoutePlan {
  const id = options.id ?? 'patrol';
  const seed = String(options.seed ?? `${plan.seed}:${id}:patrol-route`);
  const requestedWaypointCount = Math.max(0, Math.floor(options.count ?? 4));
  const loop = options.loop ?? true;
  const requireCompleteRoute = options.requireCompleteRoute ?? true;
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!id) {
    errors.push('Patrol route id must be a non-empty string');
  }
  if (requestedWaypointCount < 2) {
    errors.push(`Patrol route ${id} requires at least 2 waypoints`);
  }

  const candidateNavigation = createGameboardNavigation(plan, options.profile);
  const routeNavigation = createGameboardNavigation(plan, options.routeProfile ?? options.profile);
  const startWaypoint = resolvePatrolStartWaypoint(candidateNavigation, id, options, errors);
  const existingWaypoints = startWaypoint ? [startWaypoint] : [];
  const generatedCount = Math.max(0, requestedWaypointCount - existingWaypoints.length);
  const generatedCandidates = patrolWaypointCandidates(candidateNavigation, options, existingWaypoints);
  const generatedWaypoints = createSpawnLocations({
    ...options,
    count: generatedCount,
    seed,
    idPrefix: options.idPrefix ?? `patrol:${id}`,
    shape: plan.shape,
    candidates: generatedCandidates,
  }).map((waypoint): GameboardPatrolWaypoint => ({
    ...waypoint,
    index: 0,
    source: 'generated',
  }));

  const waypoints = normalizePatrolWaypointIndexes([...existingWaypoints, ...generatedWaypoints]);
  if (waypoints.length < requestedWaypointCount) {
    errors.push(
      `Patrol route ${id} selected ${waypoints.length}/${requestedWaypointCount} requested waypoint(s)`
    );
  }

  const segments = routePatrolWaypoints(routeNavigation, waypoints, loop);
  for (const segment of segments) {
    if (requireCompleteRoute && !segment.found) {
      errors.push(
        `Patrol route ${id} has no passable route from waypoint ${segment.fromIndex} to ${segment.toIndex}`
      );
    }
  }

  const pathKeys = combinePatrolSegmentPathKeys(segments);
  const found =
    errors.length === 0 &&
    waypoints.length >= Math.max(2, requestedWaypointCount) &&
    segments.every((segment) => segment.found);

  if (!loop && waypoints.length > 1 && segments.length === 0) {
    warnings.push(`Patrol route ${id} has no segments because loop is disabled and fewer than 2 waypoints were selected`);
  }

  return {
    id,
    seed,
    requestedWaypointCount,
    selectedWaypointCount: waypoints.length,
    loop,
    found,
    cost: segments.reduce((total, segment) => total + segment.cost, 0),
    visited: segments.reduce((total, segment) => total + segment.visited, 0),
    waypoints,
    segments,
    pathKeys,
    warnings,
    errors,
  };
}

/**
 * Plan a set of named patrol routes with shared spawn group and navigation
 * defaults.
 */
export function planGameboardPatrolRoutes(
  plan: GameboardPlan,
  options: GameboardPatrolRouteSetOptions
): GameboardPatrolRouteSet {
  const seed = String(options.seed ?? `${plan.seed}:patrol-routes`);
  const seenRouteIds = new Set<string>();
  const routes = options.routes.map((route, index) => {
    const routePlan = planGameboardPatrolRoute(plan, {
      ...route,
      seed: route.seed ?? `${seed}:${route.id || index}`,
      profile: route.profile ?? options.profile,
      routeProfile: route.routeProfile ?? options.routeProfile ?? route.profile ?? options.profile,
      spawnGroups: options.spawnGroups,
    });
    if (seenRouteIds.has(route.id)) {
      return {
        ...routePlan,
        found: false,
        errors: [...routePlan.errors, `Patrol route ${route.id} is declared more than once`],
      };
    }
    seenRouteIds.add(route.id);
    return routePlan;
  });

  return {
    seed,
    routeCount: routes.length,
    routes,
    warnings: routes.flatMap((route) => route.warnings.map((warning) => `${route.id}: ${warning}`)),
    errors: routes.flatMap((route) => route.errors.map((error) => `${route.id}: ${error}`)),
  };
}

function normalizeNavigationProfile(profile: GameboardNavigationProfile): RequiredGameboardNavigationProfile {
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
    ignorePlacementIds: [...(profile.ignorePlacementIds ?? DEFAULT_NAVIGATION_PROFILE.ignorePlacementIds)],
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
  return profile.canEnter?.(tile, { plan, from: fromTile, to: tile, placements: occupancy.byTileKey.get(tile.key) ?? [] }) ?? true;
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

function spawnCandidateCoordinates(
  plan: GameboardPlan,
  navigation: GameboardNavigation,
  options: Pick<
    GameboardSpawnLocationOptions,
    'terrain' | 'minElevation' | 'maxElevation' | 'tileTags' | 'excludeTileTags'
  >
): HexCoordinates[] {
  return plan.tiles
    .filter((tile) => matchesTerrain(tile.terrain, options.terrain))
    .filter((tile) => options.minElevation === undefined || tile.elevation >= options.minElevation)
    .filter((tile) => options.maxElevation === undefined || tile.elevation <= options.maxElevation)
    .filter((tile) => containsRequiredTags(tile.tags, options.tileTags))
    .filter((tile) => !containsExcludedTags(tile.tags, options.excludeTileTags))
    .filter((tile) => navigation.canEnter(tile.key))
    .map((tile) => tile.coordinates);
}

function bestSpawnGroupRoute(
  navigation: GameboardNavigation,
  fromGroupId: string,
  fromLocations: readonly SpawnLocation[],
  toGroupId: string,
  toLocations: readonly SpawnLocation[]
): GameboardSpawnGroupRoute {
  let best: GameboardSpawnGroupRoute | undefined;
  for (const from of fromLocations) {
    for (const to of toLocations) {
      const path = navigation.findPath(from.key, to.key);
      const route: GameboardSpawnGroupRoute = {
        fromGroupId,
        toGroupId,
        found: path.found,
        fromKey: from.key,
        toKey: to.key,
        pathKeys: path.path.map((tile) => tile.key),
        cost: path.cost,
        visited: path.visited,
      };
      if (!best || betterSpawnGroupRoute(route, best)) {
        best = route;
      }
    }
  }
  return best ?? emptySpawnGroupRoute(fromGroupId, toGroupId);
}

function betterSpawnGroupRoute(
  candidate: GameboardSpawnGroupRoute,
  current: GameboardSpawnGroupRoute
): boolean {
  if (candidate.found !== current.found) {
    return candidate.found;
  }
  if (candidate.cost !== current.cost) {
    return candidate.cost < current.cost;
  }
  if (candidate.pathKeys.length !== current.pathKeys.length) {
    return candidate.pathKeys.length < current.pathKeys.length;
  }
  return `${candidate.fromKey ?? ''}:${candidate.toKey ?? ''}` < `${current.fromKey ?? ''}:${current.toKey ?? ''}`;
}

function emptySpawnGroupRoute(fromGroupId: string, toGroupId: string): GameboardSpawnGroupRoute {
  return {
    fromGroupId,
    toGroupId,
    found: false,
    pathKeys: [],
    cost: Number.POSITIVE_INFINITY,
    visited: 0,
  };
}

function resolvePatrolStartWaypoint(
  navigation: GameboardNavigation,
  routeId: string,
  options: Pick<
    GameboardPatrolRouteOptions,
    'start' | 'startGroupId' | 'startLocationIndex' | 'spawnGroups'
  >,
  errors: string[]
): GameboardPatrolWaypoint | undefined {
  if (options.start !== undefined && options.startGroupId !== undefined) {
    errors.push(`Patrol route ${routeId} cannot define both start and startGroupId`);
    return undefined;
  }
  if (options.start !== undefined) {
    const startKey = keyFor(options.start);
    const tile = navigation.tileAt(startKey);
    if (!tile) {
      errors.push(`Patrol route ${routeId} references missing start tile ${startKey}`);
      return undefined;
    }
    if (!navigation.canEnter(startKey)) {
      errors.push(`Patrol route ${routeId} start tile ${startKey} is not passable`);
    }
    return {
      id: `patrol:${routeId}:start`,
      key: tile.key,
      coordinates: { ...tile.coordinates },
      position: axialToWorld(tile.coordinates, tile.elevation),
      index: 0,
      source: 'explicit-start',
    };
  }
  if (options.startGroupId === undefined) {
    return undefined;
  }
  if (!options.startGroupId) {
    errors.push(`Patrol route ${routeId} references an empty startGroupId`);
    return undefined;
  }
  if (!options.spawnGroups) {
    errors.push(
      `Patrol route ${routeId} references spawn group ${options.startGroupId}, but no spawn group plan was provided`
    );
    return undefined;
  }
  if (
    options.startLocationIndex !== undefined &&
    !isNonNegativeInteger(options.startLocationIndex)
  ) {
    errors.push(
      `Patrol route ${routeId} uses invalid startLocationIndex ${String(options.startLocationIndex)}`
    );
    return undefined;
  }
  const group = options.spawnGroups.groups.find((candidate) => candidate.id === options.startGroupId);
  if (!group) {
    errors.push(`Patrol route ${routeId} references unknown spawn group ${options.startGroupId}`);
    return undefined;
  }
  const startLocationIndex = options.startLocationIndex ?? 0;
  const location = group.locations[startLocationIndex];
  if (!location) {
    errors.push(
      `Patrol route ${routeId} could not claim spawn location ${startLocationIndex} from group ${group.id}`
    );
    return undefined;
  }
  return {
    ...location,
    id: `patrol:${routeId}:start`,
    index: 0,
    source: 'spawn-group',
    spawnGroupId: group.id,
    spawnLocationIndex: startLocationIndex,
  };
}

function patrolWaypointCandidates(
  navigation: GameboardNavigation,
  options: Pick<
    GameboardPatrolRouteOptions,
    'terrain' | 'minElevation' | 'maxElevation' | 'tileTags' | 'excludeTileTags' | 'minDistance'
  >,
  existingWaypoints: readonly GameboardPatrolWaypoint[]
): HexCoordinates[] {
  const minDistance = Math.max(0, Math.floor(options.minDistance ?? 0));
  const existingKeys = new Set(existingWaypoints.map((waypoint) => waypoint.key));
  return spawnCandidateCoordinates(navigation.plan, navigation, options)
    .filter((candidate) => !existingKeys.has(hexKey(candidate)))
    .filter((candidate) =>
      existingWaypoints.every(
        (waypoint) => hexDistance(waypoint.coordinates, candidate) >= minDistance
      )
    );
}

function normalizePatrolWaypointIndexes(
  waypoints: readonly GameboardPatrolWaypoint[]
): GameboardPatrolWaypoint[] {
  return waypoints.map((waypoint, index) => ({
    ...waypoint,
    index,
  }));
}

function routePatrolWaypoints(
  navigation: GameboardNavigation,
  waypoints: readonly GameboardPatrolWaypoint[],
  loop: boolean
): GameboardPatrolRouteSegment[] {
  if (waypoints.length < 2) {
    return [];
  }
  const pairs = waypoints.slice(0, -1).map((waypoint, index) => [waypoint, waypoints[index + 1]] as const);
  if (loop) {
    pairs.push([waypoints[waypoints.length - 1], waypoints[0]]);
  }
  return pairs.map(([from, to]) => {
    const path = navigation.findPath(from.key, to.key);
    return {
      fromIndex: from.index,
      toIndex: to.index,
      fromKey: from.key,
      toKey: to.key,
      found: path.found,
      pathKeys: path.path.map((tile) => tile.key),
      cost: path.cost,
      visited: path.visited,
    };
  });
}

function combinePatrolSegmentPathKeys(
  segments: readonly GameboardPatrolRouteSegment[]
): string[] {
  const pathKeys: string[] = [];
  for (const segment of segments) {
    for (const key of segment.pathKeys) {
      if (pathKeys.at(-1) !== key) {
        pathKeys.push(key);
      }
    }
  }
  return pathKeys;
}

function lowestCostKey(open: ReadonlySet<string>, costByKey: ReadonlyMap<string, number>): string {
  let bestKey = '';
  let bestCost = Number.POSITIVE_INFINITY;
  for (const key of open) {
    const cost = costByKey.get(key) ?? Number.POSITIVE_INFINITY;
    if (cost < bestCost) {
      bestCost = cost;
      bestKey = key;
    }
  }
  return bestKey;
}

function coordinatesFor(coordinates: HexCoordinates | string): HexCoordinates {
  if (typeof coordinates !== 'string') {
    return coordinates;
  }
  const [q, r] = coordinates.split(',').map(Number);
  return { q, r };
}

function keyFor(coordinates: HexCoordinates | string): string {
  return typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
}

function matchesTerrain(
  terrain: GameboardTerrain,
  allowed: GameboardTerrain | readonly GameboardTerrain[] | undefined
): boolean {
  return !allowed || (typeof allowed === 'string' ? [allowed] : [...allowed]).includes(terrain);
}

function containsRequiredTags(tags: readonly string[], required: readonly string[] | undefined): boolean {
  return !required || required.every((tag) => tags.includes(tag));
}

function containsExcludedTags(tags: readonly string[], excluded: readonly string[] | undefined): boolean {
  return Boolean(excluded?.some((tag) => tags.includes(tag)));
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
