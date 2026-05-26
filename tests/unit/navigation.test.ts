import { describe, expect, it } from 'vitest';
import { hexDistance } from '../../src/coordinates';
import { createGameboardBuilder } from '../../src/gameboard';
import {
  createGameboardNavigation,
  createGameboardOccupancyIndex,
  findGameboardPath,
  planGameboardPatrolRoute,
  planGameboardPatrolRoutes,
  planGameboardSpawnGroups,
  reachableGameboardTiles,
  selectGameboardSpawnLocations,
} from '../../src/navigation';

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
});
