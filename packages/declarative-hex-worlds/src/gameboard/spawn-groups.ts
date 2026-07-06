/**
 * Deterministic spawn-location and spawn-group planning for gameboard plans.
 */
import {
  createSpawnLocations,
  hexDistance,
  type SpawnLocation,
  type SpawnLocationOptions,
} from '../coordinates';
import type { HexCoordinates } from '../types';
import type { GameboardPlan, GameboardTerrain } from './plan';
import {
  createGameboardNavigation,
  type GameboardNavigation,
  type GameboardNavigationProfile,
} from './navigation';

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
    const filteredCandidates =
      minDistanceFromGroups > 0
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
      errors.push(
        `Spawn group ${rule.id} selected ${locations.length}/${rule.count} requested location(s)`
      );
    }

    const routeChecks = (rule.pathToGroups ?? []).map((targetGroupId) => {
      const targetGroup = groupsById.get(targetGroupId);
      if (!targetGroup) {
        errors.push(
          `Spawn group ${rule.id} references unknown route target group ${targetGroupId}`
        );
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
  const warnings: string[] = [];
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

export function spawnCandidateCoordinates(
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
  return `${candidate.fromKey}:${candidate.toKey}` < `${current.fromKey}:${current.toKey}`;
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

function matchesTerrain(
  terrain: GameboardTerrain,
  allowed: GameboardTerrain | readonly GameboardTerrain[] | undefined
): boolean {
  return !allowed || (typeof allowed === 'string' ? [allowed] : [...allowed]).includes(terrain);
}

function containsRequiredTags(
  tags: readonly string[],
  required: readonly string[] | undefined
): boolean {
  return !required || required.every((tag) => tags.includes(tag));
}

function containsExcludedTags(
  tags: readonly string[],
  excluded: readonly string[] | undefined
): boolean {
  return Boolean(excluded?.some((tag) => tags.includes(tag)));
}
