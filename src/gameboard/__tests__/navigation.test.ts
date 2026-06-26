import { describe, expect, it } from 'vitest';
import { hexDistance } from '../../coordinates/index';
import { createGameboardBuilder } from '../../gameboard/index';
import {
  createGameboardNavigation,
  createGameboardOccupancyIndex,
  findGameboardPath,
  planGameboardPatrolRoute,
  planGameboardPatrolRoutes,
  planGameboardSpawnGroups,
  reachableGameboardTiles,
  selectGameboardSpawnLocations,
} from '../../gameboard/navigation';
import { spawnCandidateCoordinates } from '../spawn-groups';

describe('board-aware navigation and occupancy', () => {
  it('indexes blockers and finds paths around terrain and runtime placement obstacles', () => {
    const plan = createGameboardBuilder({
      seed: 'navigation',
      shape: { kind: 'rectangle', width: 5, height: 3 },
    })
      .setTerrain({ q: 1, r: 1 }, 'water')
      .setElevation({ q: 3, r: 1 }, 3)
      .addPlacement({
        at: { q: 2, r: 1 },
        assetId: 'unit_blue_full',
        kind: 'unit',
        layer: 'unit',
      })
      .build();
    const navigation = createGameboardNavigation(plan);
    const result = navigation.findPath({ q: 0, r: 1 }, { q: 4, r: 1 });
    const keys = result.path.map((tile) => tile.key);

    expect(navigation.isBlocked('2,1')).toBe(true);
    expect(navigation.canEnter('1,1')).toBe(false);
    expect(navigation.canEnter('3,1', '2,1')).toBe(false);
    expect(result.found).toBe(true);
    expect(keys).not.toContain('1,1');
    expect(keys).not.toContain('2,1');
    expect(keys).not.toContain('3,1');
    expect(keys.at(0)).toBe('0,1');
    expect(keys.at(-1)).toBe('4,1');
  });

  it('supports alternate movement profiles for ships and custom blockers', () => {
    const plan = createGameboardBuilder({
      seed: 'boat-profile',
      shape: { kind: 'rectangle', width: 4, height: 1 },
      defaultTerrain: 'water',
    })
      .addPlacement({
        at: { q: 1, r: 0 },
        assetId: 'boat',
        kind: 'prop',
        layer: 'feature',
      })
      .build();

    expect(findGameboardPath(plan, '0,0', '3,0').found).toBe(false);

    const boatNavigation = createGameboardNavigation(plan, {
      allowedTerrain: ['water'],
      blockedTerrain: [],
      blockingPlacementKinds: ['prop'],
      ignorePlacementIds: [plan.placements.find((placement) => placement.assetId === 'boat')?.id ?? ''],
    });

    expect(boatNavigation.isBlocked('1,0')).toBe(false);
    expect(boatNavigation.findPath('0,0', '3,0').path.map((tile) => tile.key)).toEqual([
      '0,0',
      '1,0',
      '2,0',
      '3,0',
    ]);
  });

  it('indexes blocking placement footprints beyond the center tile', () => {
    const plan = createGameboardBuilder({
      seed: 'footprint-navigation',
      shape: { kind: 'rectangle', width: 4, height: 2 },
    })
      .addPlacement({
        at: { q: 1, r: 0 },
        assetId: 'external:gatehouse',
        kind: 'prop',
        layer: 'feature',
        requiresExtra: true,
        metadata: {
          layoutBlocksMovement: true,
          layoutFootprintTiles: '1,0|2,0',
        },
      })
      .build();
    const navigation = createGameboardNavigation(plan);

    expect(navigation.placementsAt('2,0').map((placement) => placement.assetId)).toContain('external:gatehouse');
    expect(navigation.isBlocked('1,0')).toBe(true);
    expect(navigation.isBlocked('2,0')).toBe(true);
    expect(navigation.canEnter('2,0')).toBe(false);
  });

  it('navigation.neighbors returns in-bounds adjacent tiles (E0b)', () => {
    // Covers navigation.ts line 495-498 (neighbors action wrapper).
    const plan = createGameboardBuilder({
      seed: 'neighbors-wrapper',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    }).build();
    const navigation = createGameboardNavigation(plan);
    const adjacent = navigation.neighbors({ q: 1, r: 1 });
    expect(adjacent.length).toBeGreaterThanOrEqual(3);
    // Corner has fewer in-bounds neighbors than centre.
    const corner = navigation.neighbors({ q: 0, r: 0 });
    expect(corner.length).toBeLessThan(adjacent.length);
  });

  it('computes reachable ranges with terrain costs', () => {
    const plan = createGameboardBuilder({
      seed: 'range',
      shape: { kind: 'rectangle', width: 3, height: 2 },
    })
      .addForest({ q: 1, r: 0 })
      .setTerrain({ q: 0, r: 1 }, 'water')
      .build();
    const occupancy = createGameboardOccupancyIndex(plan);
    const reachable = reachableGameboardTiles(plan, '0,0', 1, { terrainCosts: { forest: 2 } }, undefined, occupancy);

    expect(reachable.map((entry) => entry.tile.key)).toEqual(['0,0']);
    expect(
      reachableGameboardTiles(plan, '0,0', 2, { terrainCosts: { forest: 2 } }).map((entry) => entry.tile.key)
    ).toContain('1,0');
  });

  it('selects deterministic board-aware spawn locations', () => {
    const plan = createGameboardBuilder({
      seed: 'board-spawns',
      shape: { kind: 'hexagon', radius: 2 },
    })
      .setTerrain({ q: 0, r: 1 }, 'water')
      .setTileAsset({
        at: { q: -1, r: 0 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['spawn-zone'],
      })
      .setTileAsset({
        at: { q: 0, r: 0 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['spawn-zone'],
      })
      .addPlacement({
        at: { q: 0, r: 0 },
        assetId: 'building_tower_A_blue',
        kind: 'structure',
        layer: 'structure',
      })
      .build();
    const first = selectGameboardSpawnLocations(plan, {
      count: 2,
      seed: 'board-spawns',
      tileTags: ['spawn-zone'],
      maxElevation: 0,
      minDistance: 1,
    });
    const second = selectGameboardSpawnLocations(plan, {
      count: 2,
      seed: 'board-spawns',
      tileTags: ['spawn-zone'],
      maxElevation: 0,
      minDistance: 1,
    });

    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      key: '-1,0',
      coordinates: { q: -1, r: 0 },
    });
  });

  it('plans seeded spawn groups with separation and route diagnostics', () => {
    const plan = createGameboardBuilder({
      seed: 'spawn-groups',
      shape: { kind: 'rectangle', width: 6, height: 3 },
    })
      .setTileAsset({
        at: { q: 0, r: 1 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['player-spawn'],
      })
      .setTileAsset({
        at: { q: 3, r: 0 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['npc-spawn'],
      })
      .setTileAsset({
        at: { q: 5, r: 1 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['enemy-spawn'],
      })
      .addPlacement({
        at: { q: 2, r: 1 },
        assetId: 'building_tower_A_blue',
        kind: 'structure',
        layer: 'structure',
      })
      .build();

    const spawns = planGameboardSpawnGroups(plan, {
      seed: 'quest-spawn-plan',
      groups: [
        { id: 'player', count: 1, tileTags: ['player-spawn'] },
        { id: 'npc', count: 1, tileTags: ['npc-spawn'], minDistanceFromGroups: 2, pathToGroups: ['player'] },
        { id: 'enemy', count: 1, tileTags: ['enemy-spawn'], minDistanceFromGroups: 3, pathToGroups: ['player', 'npc'] },
      ],
    });
    const [player, npc, enemy] = spawns.groups;

    expect(spawns).toMatchObject({
      seed: 'quest-spawn-plan',
      groupCount: 3,
      selectedLocationCount: 3,
      errors: [],
    });
    expect(player?.locations[0]?.key).toBe('0,1');
    expect(npc?.locations[0]?.key).toBe('3,0');
    expect(enemy?.locations[0]?.key).toBe('5,1');
    expect(spawns.routeChecks).toHaveLength(3);
    expect(spawns.routeChecks.every((route) => route.found)).toBe(true);
    expect(spawns.routeChecks.find((route) => route.fromGroupId === 'enemy' && route.toGroupId === 'player')?.pathKeys).not.toContain(
      '2,1'
    );
    expect(
      hexDistance(player?.locations[0]?.coordinates ?? { q: 0, r: 0 }, enemy?.locations[0]?.coordinates ?? { q: 0, r: 0 })
    ).toBeGreaterThanOrEqual(3);
  });

  it('reports spawn group route failures before gameplay starts', () => {
    const plan = createGameboardBuilder({
      seed: 'spawn-group-route-failure',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    })
      .setTileAsset({
        at: { q: 0, r: 0 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['player-spawn'],
      })
      .setTerrain({ q: 1, r: 0 }, 'water')
      .setTileAsset({
        at: { q: 2, r: 0 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['enemy-spawn'],
      })
      .build();

    const spawns = planGameboardSpawnGroups(plan, {
      seed: 'blocked-spawns',
      groups: [
        { id: 'player', count: 1, tileTags: ['player-spawn'] },
        { id: 'enemy', count: 1, tileTags: ['enemy-spawn'], pathToGroups: ['player'] },
      ],
    });

    expect(spawns.routeChecks).toEqual([
      expect.objectContaining({
        fromGroupId: 'enemy',
        toGroupId: 'player',
        found: false,
      }),
    ]);
    expect(spawns.errors).toEqual(['enemy: Spawn group enemy has no passable route to group player']);
  });

  it('reports duplicate spawn group ids before route planning depends on them', () => {
    const plan = createGameboardBuilder({
      seed: 'duplicate-spawn-groups',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    }).build();

    const spawns = planGameboardSpawnGroups(plan, {
      groups: [
        { id: 'player', count: 1 },
        { id: 'player', count: 1, pathToGroups: ['player'] },
      ],
    });

    expect(spawns.groups.map((group) => group.id)).toEqual(['player', 'player']);
    expect(spawns.errors).toContain('player: Spawn group player is declared more than once');
  });

  it('reports unknown spawn-group route target via pathToGroups (E0b)', () => {
    // Covers navigation.ts line 681-682: pathToGroups entry doesn't match a real group.
    const plan = createGameboardBuilder({
      seed: 'unknown-pathto-target',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    }).build();
    const spawns = planGameboardSpawnGroups(plan, {
      groups: [
        { id: 'player', count: 1, pathToGroups: ['ghost-group-never-declared'] },
      ],
    });
    expect(spawns.errors.some((e) => e.includes('unknown route target group'))).toBe(true);
  });

  it('plans deterministic patrol routes from spawn groups with loop diagnostics', () => {
    const plan = createGameboardBuilder({
      seed: 'patrol-route',
      shape: { kind: 'rectangle', width: 5, height: 3 },
    })
      .setTileAsset({
        at: { q: 0, r: 1 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['guard-start'],
      })
      .setTileAsset({
        at: { q: 2, r: 0 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['watch-point'],
      })
      .setTileAsset({
        at: { q: 4, r: 1 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['watch-point'],
      })
      .setTileAsset({
        at: { q: 2, r: 2 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['watch-point'],
      })
      .addPlacement({
        at: { q: 2, r: 1 },
        assetId: 'building_tower_A_blue',
        kind: 'structure',
        layer: 'structure',
      })
      .build();
    const spawnGroups = planGameboardSpawnGroups(plan, {
      seed: 'patrol-spawns',
      groups: [{ id: 'guard', count: 1, tileTags: ['guard-start'] }],
    });

    const patrol = planGameboardPatrolRoute(plan, {
      id: 'western-watch',
      seed: 'watch-seed',
      count: 3,
      startGroupId: 'guard',
      spawnGroups,
      tileTags: ['watch-point'],
      minDistance: 2,
      loop: true,
    });
    const repeated = planGameboardPatrolRoute(plan, {
      id: 'western-watch',
      seed: 'watch-seed',
      count: 3,
      startGroupId: 'guard',
      spawnGroups,
      tileTags: ['watch-point'],
      minDistance: 2,
      loop: true,
    });

    expect(patrol).toEqual(repeated);
    expect(patrol.errors).toEqual([]);
    expect(patrol.found).toBe(true);
    expect(patrol.waypoints).toHaveLength(3);
    expect(patrol.waypoints[0]).toMatchObject({
      key: '0,1',
      source: 'spawn-group',
      spawnGroupId: 'guard',
    });
    expect(patrol.segments).toHaveLength(3);
    expect(patrol.segments.every((segment) => segment.found)).toBe(true);
    expect(patrol.pathKeys).toContain('0,1');
    expect(patrol.pathKeys).not.toContain('2,1');
  });

  it('reports patrol route failures before NPC schedules are mounted', () => {
    const plan = createGameboardBuilder({
      seed: 'patrol-route-failure',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    })
      .setTileAsset({
        at: { q: 0, r: 0 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['guard-start'],
      })
      .setTerrain({ q: 1, r: 0 }, 'water')
      .setTileAsset({
        at: { q: 2, r: 0 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['watch-point'],
      })
      .build();

    const patrol = planGameboardPatrolRoute(plan, {
      id: 'blocked-watch',
      count: 2,
      start: '0,0',
      tileTags: ['watch-point'],
    });

    expect(patrol.found).toBe(false);
    expect(patrol.segments).toEqual([
      expect.objectContaining({
        fromKey: '0,0',
        toKey: '2,0',
        found: false,
      }),
      expect.objectContaining({
        fromKey: '2,0',
        toKey: '0,0',
        found: false,
      }),
    ]);
    expect(patrol.errors).toEqual([
      'Patrol route blocked-watch has no passable route from waypoint 0 to 1',
      'Patrol route blocked-watch has no passable route from waypoint 1 to 0',
    ]);
  });

  it('errors when patrol route references spawn group without a spawn-group plan (E0h)', () => {
    const plan = createGameboardBuilder({
      seed: 'patrol-spawn-1',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    }).build();
    const result = planGameboardPatrolRoute(plan, {
      id: 'guard-from-group',
      count: 2,
      startGroupId: 'home-base',
      seed: 'patrol-spawn-noplan',
    });
    expect(result.found).toBe(false);
    expect(
      result.errors.some((e) => /no spawn group plan was provided/.test(e))
    ).toBe(true);
  });

  it('errors when patrol route uses non-integer startLocationIndex (E0h)', () => {
    const plan = createGameboardBuilder({
      seed: 'patrol-spawn-2',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    }).build();
    const spawnGroups = planGameboardSpawnGroups(plan, {
      seed: 'spawn-base',
      groups: [{ id: 'base', count: 2 }],
    });
    const result = planGameboardPatrolRoute(plan, {
      id: 'fractional-index',
      count: 2,
      startGroupId: 'base',
      // biome-ignore lint/suspicious/noExplicitAny: deliberate non-integer
      startLocationIndex: 1.5 as any,
      spawnGroups,
      seed: 'patrol-fractional',
    });
    expect(result.found).toBe(false);
    expect(
      result.errors.some((e) => /invalid startLocationIndex/.test(e))
    ).toBe(true);
  });

  it('errors when patrol route references unknown spawn group (E0h)', () => {
    const plan = createGameboardBuilder({
      seed: 'patrol-spawn-3',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    }).build();
    const spawnGroups = planGameboardSpawnGroups(plan, {
      seed: 'spawn-base-3',
      groups: [{ id: 'base', count: 2 }],
    });
    const result = planGameboardPatrolRoute(plan, {
      id: 'unknown-group',
      count: 2,
      startGroupId: 'definitely-not-base',
      spawnGroups,
      seed: 'patrol-unknown',
    });
    expect(result.found).toBe(false);
    expect(
      result.errors.some((e) => /references unknown spawn group/.test(e))
    ).toBe(true);
  });

  it('reports patrol route start validation branches and open-route warnings', () => {
    const plan = createGameboardBuilder({
      seed: 'patrol-start-validation',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    }).build();
    const blockedStartPlan = createGameboardBuilder({
      seed: 'patrol-blocked-start',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    })
      .setTerrain({ q: 0, r: 0 }, 'water')
      .build();
    const spawnGroups = planGameboardSpawnGroups(plan, {
      seed: 'patrol-start-validation-groups',
      groups: [{ id: 'base', count: 1 }],
    });
    const defaulted = planGameboardPatrolRoute(plan, {});
    const objectStart = planGameboardPatrolRoute(plan, {
      id: 'object-start',
      count: 2,
      start: { q: 0, r: 0 },
      loop: false,
    });
    const blockedStart = planGameboardPatrolRoute(blockedStartPlan, {
      id: 'blocked-start',
      count: 2,
      start: '0,0',
    });
    const defaultSeedRoutes = planGameboardPatrolRoutes(plan, { routes: [] });
    const routes = planGameboardPatrolRoutes(plan, {
      seed: 'patrol-start-validation-routes',
      spawnGroups,
      routes: [
        { id: 'short-open', count: 1, loop: false },
        { id: 'dual-start', count: 2, start: '0,0', startGroupId: 'base' },
        { id: 'missing-start', count: 2, start: '99,99' },
        { id: 'empty-group', count: 2, startGroupId: '' },
        { id: 'missing-location', count: 2, startGroupId: 'base', startLocationIndex: 5 },
      ],
    });

    expect(defaulted).toMatchObject({
      id: 'patrol',
      requestedWaypointCount: 4,
    });
    expect(objectStart.waypoints[0]).toMatchObject({
      key: '0,0',
      source: 'explicit-start',
    });
    expect(blockedStart.errors).toContain('Patrol route blocked-start start tile 0,0 is not passable');
    expect(defaultSeedRoutes.seed).toBe('patrol-start-validation:patrol-routes');
    expect(routes.warnings).toContain(
      'short-open: Patrol route short-open has no segments because loop is disabled and fewer than 2 waypoints were selected'
    );
    expect(routes.errors).toEqual(
      expect.arrayContaining([
        'short-open: Patrol route short-open requires at least 2 waypoints',
        'dual-start: Patrol route dual-start cannot define both start and startGroupId',
        'missing-start: Patrol route missing-start references missing start tile 99,99',
        'empty-group: Patrol route empty-group references an empty startGroupId',
        'missing-location: Patrol route missing-location could not claim spawn location 5 from group base',
      ])
    );
  });

  it('plans patrol route sets and reports duplicate route ids', () => {
    const plan = createGameboardBuilder({
      seed: 'patrol-route-set',
      shape: { kind: 'rectangle', width: 4, height: 1 },
    }).build();

    const routes = planGameboardPatrolRoutes(plan, {
      seed: 'route-set',
      routes: [
        { id: 'guard-loop', count: 2, start: '0,0' },
        { id: 'guard-loop', count: 2, start: '3,0' },
      ],
    });

    expect(routes.routeCount).toBe(2);
    expect(routes.routes[1]?.found).toBe(false);
    expect(routes.errors).toContain('guard-loop: Patrol route guard-loop is declared more than once');
  });

  it('reports patrol-route under-selected waypoints when board is too small (E0b)', () => {
    // Covers navigation.ts line 772 — selected count < requested.
    const plan = createGameboardBuilder({
      seed: 'patrol-undersel',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    }).build();
    const routes = planGameboardPatrolRoutes(plan, {
      seed: 'route-undersel',
      routes: [{ id: 'long-walk', count: 5, start: '0,0' }],
    });
    expect(routes.errors.some((e) => e.includes('selected') && e.includes('requested waypoint'))).toBe(true);
  });

  it('reports patrol-route empty id + single-waypoint count error (E0b)', () => {
    // Covers navigation.ts lines 744-748: empty id + count < 2.
    const plan = createGameboardBuilder({
      seed: 'patrol-bad-config',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    }).build();
    const routes = planGameboardPatrolRoutes(plan, {
      seed: 'route-bad',
      routes: [
        // Empty id
        // biome-ignore lint/suspicious/noExplicitAny: deliberately-invalid route id
        { id: '', count: 2, start: '0,0' } as any,
        // count < 2 (only one waypoint via count=1)
        { id: 'short', count: 1, start: '0,0' },
      ],
    });
    expect(routes.errors.some((e) => e.includes('non-empty string'))).toBe(true);
    expect(routes.errors.some((e) => e.includes('at least 2 waypoints'))).toBe(true);
  });
});

describe('findGameboardPath defensive returns (PRD E0a)', () => {
  it('returns not-found when start or goal is off the plan', () => {
    const plan = createGameboardBuilder({
      seed: 'path-oob',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    }).build();
    expect(findGameboardPath(plan, '99,99', '0,0').found).toBe(false);
    expect(findGameboardPath(plan, '0,0', '99,99').found).toBe(false);
  });

});

describe('planGameboardSpawnGroups validation branches (PRD E0a)', () => {
  it('filters spawn candidates by terrain, elevation, and tile tags', () => {
    const plan = createGameboardBuilder({
      seed: 'spawn-filter-branches',
      shape: { kind: 'rectangle', width: 3, height: 2 },
    })
      .setTileAsset({
        at: { q: 0, r: 0 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['spawn'],
      })
      .setElevation({ q: 0, r: 0 }, 1)
      .setTileAsset({
        at: { q: 1, r: 0 },
        assetId: 'hex_hill',
        terrain: 'hill',
        tags: ['spawn', 'blocked'],
      })
      .setElevation({ q: 1, r: 0 }, 2)
      .setTileAsset({
        at: { q: 2, r: 0 },
        assetId: 'hex_water',
        terrain: 'water',
        tags: ['spawn'],
      })
      .setTileAsset({
        at: { q: 0, r: 1 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['camp'],
      })
      .build();

    const candidates = spawnCandidateCoordinates(plan, createGameboardNavigation(plan), {
      terrain: ['grass', 'hill'],
      minElevation: 1,
      maxElevation: 2,
      tileTags: ['elevated'],
      excludeTileTags: ['hill'],
    });
    const grassCandidates = spawnCandidateCoordinates(plan, createGameboardNavigation(plan), {
      terrain: 'grass',
    });

    expect(candidates).toEqual([{ q: 0, r: 0 }]);
    expect(grassCandidates).toEqual(
      expect.arrayContaining([
        { q: 0, r: 0 },
        { q: 0, r: 1 },
      ])
    );
  });

  it('prefers found, lower-cost, and shorter spawn group routes', () => {
    const costPlan = createGameboardBuilder({
      seed: 'spawn-route-cost',
      shape: { kind: 'rectangle', width: 5, height: 3 },
    })
      .setTileAsset({ at: { q: 0, r: 2 }, assetId: 'hex_grass', terrain: 'grass', tags: ['target'] })
      .setTileAsset({ at: { q: 1, r: 2 }, assetId: 'hex_grass', terrain: 'grass', tags: ['source'] })
      .setTileAsset({ at: { q: 4, r: 0 }, assetId: 'hex_grass', terrain: 'grass', tags: ['source'] })
      .build();

    const lowerCostRoute = planGameboardSpawnGroups(costPlan, {
      seed: 'spawn-route-cost',
      groups: [
        { id: 'target', count: 1, tileTags: ['target'] },
        { id: 'source', count: 2, tileTags: ['source'], pathToGroups: ['target'] },
      ],
    }).routeChecks[0];

    const shorterRoute = planGameboardSpawnGroups(costPlan, {
      seed: 'spawn-route-cost',
      groups: [
        { id: 'target', count: 1, tileTags: ['target'] },
        {
          id: 'source',
          count: 2,
          tileTags: ['source'],
          pathToGroups: ['target'],
          routeProfile: { cost: () => 0 },
        },
      ],
    }).routeChecks[0];

    const foundPlan = createGameboardBuilder({
      seed: 'spawn-route-found',
      shape: { kind: 'rectangle', width: 5, height: 3 },
    })
      .setTileAsset({ at: { q: 0, r: 0 }, assetId: 'hex_grass', terrain: 'grass', tags: ['target'] })
      .setTileAsset({ at: { q: 0, r: 2 }, assetId: 'hex_grass', terrain: 'grass', tags: ['target'] })
      .setTileAsset({ at: { q: 4, r: 0 }, assetId: 'hex_grass', terrain: 'grass', tags: ['source'] })
      .setTileAsset({ at: { q: 4, r: 2 }, assetId: 'hex_grass', terrain: 'grass', tags: ['source'] })
      .setTerrain({ q: 1, r: 0 }, 'water')
      .setTerrain({ q: 0, r: 1 }, 'water')
      .setTerrain({ q: 1, r: 1 }, 'water')
      .build();
    const foundRoute = planGameboardSpawnGroups(foundPlan, {
      seed: 'spawn-route-found',
      groups: [
        { id: 'target', count: 2, tileTags: ['target'] },
        { id: 'source', count: 2, tileTags: ['source'], pathToGroups: ['target'] },
      ],
    }).routeChecks[0];
    const emptyRoute = planGameboardSpawnGroups(costPlan, {
      seed: 'spawn-route-empty',
      groups: [
        { id: 'target', count: 0, tileTags: ['target'] },
        { id: 'source', count: 1, tileTags: ['source'], pathToGroups: ['target'] },
      ],
    }).routeChecks[0];

    expect(lowerCostRoute).toMatchObject({ fromKey: '1,2', toKey: '0,2', cost: 1 });
    expect(shorterRoute).toMatchObject({ fromKey: '1,2', toKey: '0,2', cost: 0 });
    expect(shorterRoute?.pathKeys).toEqual(['1,2', '0,2']);
    expect(foundRoute).toMatchObject({ found: true, toKey: '0,2' });
    expect(emptyRoute).toMatchObject({
      found: false,
      pathKeys: [],
      cost: Number.POSITIVE_INFINITY,
    });
  });

  it('errors when a spawn group has an empty id', () => {
    const plan = createGameboardBuilder({
      seed: 'spawn-no-id',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    }).build();
    const spawns = planGameboardSpawnGroups(plan, {
      seed: 'spawn-no-id-seed',
      // biome-ignore lint/suspicious/noExplicitAny: deliberately-missing id
      groups: [{ id: '' as any, count: 1 }],
    });
    expect(spawns.errors.some((e) => e.includes('Spawn group id must be a non-empty string'))).toBe(true);
  });

  it('errors when a spawn group cannot fulfill its requested count', () => {
    const plan = createGameboardBuilder({
      seed: 'spawn-undersupply',
      shape: { kind: 'rectangle', width: 1, height: 1 },
    }).build();
    const spawns = planGameboardSpawnGroups(plan, {
      seed: 'spawn-undersupply-seed',
      groups: [{ id: 'all', count: 5 }],
    });
    expect(spawns.errors.some((e) => e.includes('selected'))).toBe(true);
  });
});

describe('reachableGameboardTiles defensive branches (PRD E0a)', () => {
  it('returns [] when movementBudget is negative', () => {
    const plan = createGameboardBuilder({
      seed: 'reach-neg',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    }).build();
    expect(reachableGameboardTiles(plan, '0,0', -1)).toEqual([]);
  });

  it('returns [] when start tile is not in the plan', () => {
    const plan = createGameboardBuilder({
      seed: 'reach-missing-start',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    }).build();
    expect(reachableGameboardTiles(plan, '99,99', 5)).toEqual([]);
  });
});
