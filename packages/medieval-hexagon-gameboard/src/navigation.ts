import { containsHex, findHexPath, hexDistance, hexKey, neighbors } from './coordinates';
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
} from './grid';
import {
  gameboardPlacementBlocksOccupancy,
  gameboardPlacementFootprintKeys,
} from './occupancy';
import type { HexCoordinates } from './types';

export interface GameboardNavigationProfile {
  allowedTerrain?: readonly GameboardTerrain[];
  blockedTerrain?: readonly GameboardTerrain[];
  terrainCosts?: Readonly<Record<string, number>>;
  blockingPlacementKinds?: readonly GameboardPlacementKind[];
  blockingPlacementLayers?: readonly GameboardPlacementLayer[];
  ignorePlacementIds?: readonly string[];
  maxElevationStep?: number;
  allowStartBlocked?: boolean;
  allowGoalBlocked?: boolean;
  canEnter?: (tile: GameboardTileSpec, context: GameboardNavigationContext) => boolean;
  cost?: (from: GameboardTileSpec, to: GameboardTileSpec, baseCost: number) => number;
}

export interface GameboardNavigationContext {
  plan: GameboardPlan;
  from?: GameboardTileSpec;
  to: GameboardTileSpec;
  placements: readonly GameboardPlacementSpec[];
}

export interface GameboardOccupancyIndex {
  byTileKey: ReadonlyMap<string, readonly GameboardPlacementSpec[]>;
  occupiedTileKeys: ReadonlySet<string>;
  blockingTileKeys: ReadonlySet<string>;
}

export interface GameboardNavigation {
  plan: GameboardPlan;
  profile: RequiredGameboardNavigationProfile;
  tilesByKey: ReadonlyMap<string, GameboardTileSpec>;
  occupancy: GameboardOccupancyIndex;
  tileAt: (coordinates: HexCoordinates | string) => GameboardTileSpec | undefined;
  placementsAt: (coordinates: HexCoordinates | string) => readonly GameboardPlacementSpec[];
  isBlocked: (coordinates: HexCoordinates | string) => boolean;
  canEnter: (coordinates: HexCoordinates | string, from?: HexCoordinates | string) => boolean;
  movementCost: (from: HexCoordinates | string, to: HexCoordinates | string) => number;
  neighbors: (coordinates: HexCoordinates | string) => GameboardTileSpec[];
  findPath: (start: HexCoordinates | string, goal: HexCoordinates | string) => GameboardNavigationPathResult;
  reachable: (start: HexCoordinates | string, movementBudget: number) => GameboardReachableTile[];
}

export interface RequiredGameboardNavigationProfile {
  allowedTerrain?: readonly GameboardTerrain[];
  blockedTerrain: readonly GameboardTerrain[];
  terrainCosts: Readonly<Record<string, number>>;
  blockingPlacementKinds: readonly GameboardPlacementKind[];
  blockingPlacementLayers: readonly GameboardPlacementLayer[];
  ignorePlacementIds: readonly string[];
  maxElevationStep: number;
  allowStartBlocked: boolean;
  allowGoalBlocked: boolean;
  canEnter?: (tile: GameboardTileSpec, context: GameboardNavigationContext) => boolean;
  cost?: (from: GameboardTileSpec, to: GameboardTileSpec, baseCost: number) => number;
}

export interface GameboardNavigationPathResult {
  found: boolean;
  path: readonly GameboardTileSpec[];
  coordinates: readonly HexCoordinates[];
  cost: number;
  visited: number;
}

export interface GameboardReachableTile {
  tile: GameboardTileSpec;
  coordinates: HexCoordinates;
  cost: number;
}

export interface GameboardSpawnLocationOptions
  extends Omit<SpawnLocationOptions, 'shape' | 'candidates' | 'passable'> {
  profile?: GameboardNavigationProfile;
  terrain?: GameboardTerrain | readonly GameboardTerrain[];
  minElevation?: number;
  maxElevation?: number;
  tileTags?: readonly string[];
  excludeTileTags?: readonly string[];
}

export interface GameboardSpawnGroupRule extends GameboardSpawnLocationOptions {
  id: string;
  minDistanceFromGroups?: number;
  pathToGroups?: readonly string[];
  requirePathToGroups?: boolean;
  routeProfile?: GameboardNavigationProfile;
}

export interface GameboardSpawnGroupOptions {
  seed?: string | number;
  profile?: GameboardNavigationProfile;
  groups: readonly GameboardSpawnGroupRule[];
}

export interface GameboardSpawnGroupRoute {
  fromGroupId: string;
  toGroupId: string;
  found: boolean;
  fromKey?: string;
  toKey?: string;
  pathKeys: readonly string[];
  cost: number;
  visited: number;
}

export interface GameboardSpawnGroup {
  id: string;
  requestedCount: number;
  selectedCount: number;
  candidateCount: number;
  rejectedByGroupDistanceCount: number;
  locations: readonly SpawnLocation[];
  routeChecks: readonly GameboardSpawnGroupRoute[];
  warnings: readonly string[];
  errors: readonly string[];
}

export interface GameboardSpawnGroupPlan {
  seed: string;
  groupCount: number;
  selectedLocationCount: number;
  groups: readonly GameboardSpawnGroup[];
  routeChecks: readonly GameboardSpawnGroupRoute[];
  warnings: readonly string[];
  errors: readonly string[];
}

export type GameboardPatrolWaypointSource = 'explicit-start' | 'spawn-group' | 'generated';

export interface GameboardPatrolWaypoint extends SpawnLocation {
  index: number;
  source: GameboardPatrolWaypointSource;
  spawnGroupId?: string;
  spawnLocationIndex?: number;
}

export interface GameboardPatrolRouteSegment {
  fromIndex: number;
  toIndex: number;
  fromKey?: string;
  toKey?: string;
  found: boolean;
  pathKeys: readonly string[];
  cost: number;
  visited: number;
}

export interface GameboardPatrolRouteOptions
  extends Omit<GameboardSpawnLocationOptions, 'count'> {
  id?: string;
  count?: number;
  start?: HexCoordinates | string;
  startGroupId?: string;
  startLocationIndex?: number;
  spawnGroups?: GameboardSpawnGroupPlan;
  routeProfile?: GameboardNavigationProfile;
  loop?: boolean;
  requireCompleteRoute?: boolean;
}

export interface GameboardPatrolRouteRule
  extends Omit<GameboardPatrolRouteOptions, 'spawnGroups'> {
  id: string;
}

export interface GameboardPatrolRouteSetOptions {
  seed?: string | number;
  profile?: GameboardNavigationProfile;
  routeProfile?: GameboardNavigationProfile;
  spawnGroups?: GameboardSpawnGroupPlan;
  routes: readonly GameboardPatrolRouteRule[];
}

export interface GameboardPatrolRoutePlan {
  id: string;
  seed: string;
  requestedWaypointCount: number;
  selectedWaypointCount: number;
  loop: boolean;
  found: boolean;
  cost: number;
  visited: number;
  waypoints: readonly GameboardPatrolWaypoint[];
  segments: readonly GameboardPatrolRouteSegment[];
  pathKeys: readonly string[];
  warnings: readonly string[];
  errors: readonly string[];
}

export interface GameboardPatrolRouteSet {
  seed: string;
  routeCount: number;
  routes: readonly GameboardPatrolRoutePlan[];
  warnings: readonly string[];
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
