/**
 * Patrol-route waypoint and segment planning for gameboard plans.
 */
import {
  axialToWorld,
  createSpawnLocations,
  hexDistance,
  hexKey,
  type SpawnLocation,
} from '../coordinates';
import { GameboardRuntimeError } from '../errors';
import type { HexCoordinates } from '../types';
import type { GameboardPlan } from './plan';
import {
  createGameboardNavigation,
  type GameboardNavigation,
  type GameboardNavigationProfile,
} from './navigation';
import {
  spawnCandidateCoordinates,
  type GameboardSpawnGroupPlan,
  type GameboardSpawnLocationOptions,
} from './spawn-groups';

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
export interface GameboardPatrolRouteOptions extends Omit<GameboardSpawnLocationOptions, 'count'> {
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
export interface GameboardPatrolRouteRule extends Omit<GameboardPatrolRouteOptions, 'spawnGroups'> {
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
  const generatedCandidates = patrolWaypointCandidates(
    candidateNavigation,
    options,
    existingWaypoints
  );
  const generatedWaypoints = createSpawnLocations({
    ...options,
    count: generatedCount,
    seed,
    idPrefix: options.idPrefix ?? `patrol:${id}`,
    shape: plan.shape,
    candidates: generatedCandidates,
  }).map(
    (waypoint): GameboardPatrolWaypoint => ({
      ...waypoint,
      index: 0,
      source: 'generated',
    })
  );

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
    warnings.push(
      `Patrol route ${id} has no segments because loop is disabled and fewer than 2 waypoints were selected`
    );
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
  const group = options.spawnGroups.groups.find(
    (candidate) => candidate.id === options.startGroupId
  );
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
  const pairs: Array<readonly [GameboardPatrolWaypoint, GameboardPatrolWaypoint]> = [];
  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const current = waypoints[index];
    const next = waypoints[index + 1];
    if (current === undefined || next === undefined) {
      throw new GameboardRuntimeError(`patrol waypoint pair index ${index} out of range`);
    }
    pairs.push([current, next]);
  }
  if (loop) {
    const last = waypoints[waypoints.length - 1];
    const first = waypoints[0];
    if (last === undefined || first === undefined) {
      throw new GameboardRuntimeError('patrol loop requires at least two waypoints');
    }
    pairs.push([last, first]);
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

function combinePatrolSegmentPathKeys(segments: readonly GameboardPatrolRouteSegment[]): string[] {
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

function keyFor(coordinates: HexCoordinates | string): string {
  return typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
