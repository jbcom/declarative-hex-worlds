import { describe, expect, it } from 'vitest';
import {
  GAMEBOARD_SCENARIO_SCHEMA_VERSION,
  advanceGameboardQuest,
  createGameboardRecipe,
  createGameboardScenario,
  createGameboardWorldFromScenario,
  inspectGameboardScenario,
  readGameboardActors,
  runGameboardSystems,
  validateGameboardScenario,
} from '../../src';
import { freeManifest } from '../../src/manifest/free';
import { MovementAgent } from '../../src/movement';
import { GameboardPatrolAgent } from '../../src/patrol';
import { validateGameboardRules } from '../../src/rules';

describe('gameboard scenarios', () => {
  it('instantiates a recipe, actors, movement agents, and quests into a playable Koota world', () => {
    const board = createGameboardRecipe(
      { seed: 'scenario-test', shape: { kind: 'rectangle', width: 4, height: 3 } },
      [
        {
          action: 'addRoadPath',
          path: [
            { q: 0, r: 1 },
            { q: 1, r: 1 },
            { q: 2, r: 1 },
          ],
        },
        { action: 'addFactionBuilding', at: { q: 2, r: 1 }, faction: 'blue', building: 'market' },
      ]
    );
    const scenario = createGameboardScenario('scenario:test', board, {
      title: 'Scenario Test',
      actors: [
        {
          actorId: 'player',
          actorKind: 'player',
          team: 'blue',
          at: { q: 0, r: 1 },
          assetId: 'flag_blue',
          kind: 'unit',
          movementAgent: { profile: 'worker', movementBudget: 5 },
        },
        {
          actorId: 'elder',
          actorKind: 'npc',
          team: 'blue',
          interactive: true,
          at: { q: 1, r: 1 },
          assetId: 'flag_green',
          kind: 'prop',
        },
      ],
      quests: [
        {
          id: 'scenario:test:quest',
          title: 'Reach The Elder',
          objectives: [
            {
              id: 'reach-elder',
              kind: 'reach-actor',
              actor: 'player',
              targetActor: 'elder',
            },
          ],
        },
      ],
    });

    const runtime = createGameboardWorldFromScenario(scenario);
    const player = runtime.actorEntities.player;
    const quest = runtime.questEntities['scenario:test:quest'];

    expect(scenario.schemaVersion).toBe(GAMEBOARD_SCENARIO_SCHEMA_VERSION);
    expect(runtime.plan.placements.some((placement) => placement.kind === 'road')).toBe(true);
    expect(
      validateGameboardRules(runtime.world).filter((violation) => violation.severity === 'error')
    ).toEqual([]);
    expect(readGameboardActors(runtime.world).map((actor) => actor.actor.actorId)).toEqual([
      'elder',
      'player',
    ]);
    expect(player.get(MovementAgent)).toMatchObject({
      profileId: 'worker',
      movementBudget: 5,
      remainingMovement: 5,
    });

    const snapshot = advanceGameboardQuest(runtime.world, quest);
    expect(snapshot.quest.progress[0]).toMatchObject({
      objectiveId: 'reach-elder',
      status: 'pending',
    });
  });

  it('validates duplicate actor ids and broken quest references before runtime instantiation', () => {
    const board = createGameboardRecipe({
      seed: 'bad-scenario',
      shape: { kind: 'rectangle', width: 2, height: 2 },
    });
    const scenario = createGameboardScenario('scenario:invalid', board, {
      actors: [
        {
          actorId: 'player',
          actorKind: 'player',
          at: '0,0',
          assetId: 'flag_blue',
          kind: 'unit',
        },
        {
          actorId: 'player',
          actorKind: 'npc',
          at: '9,9',
          assetId: 'flag_green',
          kind: 'prop',
        },
      ],
      quests: [
        {
          id: 'scenario:invalid:quest',
          objectives: [
            {
              id: 'find-missing',
              kind: 'reach-actor',
              actor: 'player',
              targetActor: 'missing-elder',
            },
            {
              id: 'bad-tile',
              kind: 'reach-tile',
              actor: 'player',
              tile: 'nope',
            },
          ],
        },
      ],
    });

    const inspection = inspectGameboardScenario(scenario, { validatePlan: false });
    const codes = validateGameboardScenario(scenario, { validatePlan: false }).map(
      (violation) => violation.code
    );

    expect(inspection.plan?.tiles).toHaveLength(4);
    expect(codes).toEqual(
      expect.arrayContaining([
        'scenario.actor_duplicate',
        'scenario.actor_missing_tile',
        'scenario.objective_missing_target_actor',
        'scenario.objective_tile_key',
      ])
    );
  });

  it('validates scenario actor assets against a provided manifest catalog', () => {
    const board = createGameboardRecipe({
      seed: 'scenario-assets',
      shape: { kind: 'rectangle', width: 2, height: 2 },
    });
    const scenario = createGameboardScenario('scenario:assets', board, {
      actors: [
        {
          actorId: 'player',
          actorKind: 'player',
          at: '0,0',
          assetId: 'missing_actor_asset',
          kind: 'unit',
        },
        {
          actorId: 'marker',
          actorKind: 'prop',
          at: '1,1',
          assetId: 'flag_blue',
          kind: 'prop',
          requiresExtra: true,
        },
      ],
    });

    const codes = validateGameboardScenario(scenario, { plan: { assetCatalog: freeManifest } }).map(
      (violation) => violation.code
    );

    expect(codes).toEqual(
      expect.arrayContaining([
        'scenario.actor_unknown_asset',
        'scenario.actor_extra_flag_unnecessary',
      ])
    );
  });

  it('resolves authored actors from named spawn groups with route diagnostics', () => {
    const board = createGameboardRecipe(
      { seed: 'scenario-spawn-groups', shape: { kind: 'rectangle', width: 4, height: 1 } },
      [
        {
          action: 'setTileAsset',
          at: { q: 0, r: 0 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['player-spawn'],
        },
        {
          action: 'setTileAsset',
          at: { q: 3, r: 0 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['enemy-spawn'],
        },
      ]
    );
    const scenario = createGameboardScenario('scenario:spawn-groups', board, {
      spawnGroups: {
        seed: 'scenario-spawn-groups',
        groups: [
          { id: 'player', count: 1, tileTags: ['player-spawn'] },
          {
            id: 'enemy',
            count: 1,
            tileTags: ['enemy-spawn'],
            minDistanceFromGroups: 2,
            pathToGroups: ['player'],
          },
        ],
      },
      actors: [
        {
          actorId: 'player',
          actorKind: 'player',
          spawnGroupId: 'player',
          assetId: 'flag_blue',
          kind: 'unit',
          movementAgent: { profile: 'worker', movementBudget: 3 },
        },
        {
          actorId: 'raider',
          actorKind: 'enemy',
          hostile: true,
          spawnGroupId: 'enemy',
          assetId: 'flag_red',
          kind: 'unit',
        },
      ],
    });

    const inspection = inspectGameboardScenario(scenario);
    const runtime = createGameboardWorldFromScenario(scenario);
    const actors = readGameboardActors(runtime.world);
    const player = actors.find((actor) => actor.actor.actorId === 'player');
    const raider = actors.find((actor) => actor.actor.actorId === 'raider');

    expect(inspection.violations).toEqual([]);
    expect(inspection.spawnGroups?.routeChecks[0]).toMatchObject({
      fromGroupId: 'enemy',
      toGroupId: 'player',
      found: true,
    });
    expect(player?.placement.tileKey).toBe('0,0');
    expect(raider?.placement.tileKey).toBe('3,0');
    expect(player?.actor.metadata).toMatchObject({
      scenarioSpawnGroupId: 'player',
      scenarioSpawnTileKey: '0,0',
    });
    expect(raider?.placement.metadata).toMatchObject({
      scenarioSpawnGroupId: 'enemy',
      scenarioSpawnTileKey: '3,0',
    });
  });

  it('plans authored patrol routes from scenario spawn groups', () => {
    const board = createGameboardRecipe(
      { seed: 'scenario-patrol-routes', shape: { kind: 'rectangle', width: 5, height: 2 } },
      [
        {
          action: 'setTileAsset',
          at: { q: 0, r: 0 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['enemy-spawn'],
        },
        {
          action: 'setTileAsset',
          at: { q: 2, r: 0 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['watch-point'],
        },
        {
          action: 'setTileAsset',
          at: { q: 4, r: 1 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['watch-point'],
        },
      ]
    );
    const scenario = createGameboardScenario('scenario:patrol-routes', board, {
      spawnGroups: {
        groups: [{ id: 'enemy', count: 1, tileTags: ['enemy-spawn'] }],
      },
      patrolRoutes: [
        {
          id: 'enemy-watch',
          count: 3,
          startGroupId: 'enemy',
          tileTags: ['watch-point'],
          loop: true,
        },
      ],
    });

    const inspection = inspectGameboardScenario(scenario);
    const runtime = createGameboardWorldFromScenario(scenario);

    expect(inspection.violations).toEqual([]);
    expect(inspection.patrolRoutes?.routes[0]).toMatchObject({
      id: 'enemy-watch',
      found: true,
      selectedWaypointCount: 3,
    });
    expect(runtime.patrolRoutes?.routes[0]?.waypoints[0]).toMatchObject({
      key: '0,0',
      source: 'spawn-group',
      spawnGroupId: 'enemy',
    });
  });

  it('mounts scenario patrol agents onto actors and runs them through the public systems tick', () => {
    const board = createGameboardRecipe(
      { seed: 'scenario-patrol-agent', shape: { kind: 'rectangle', width: 3, height: 1 } },
      [
        {
          action: 'setTileAsset',
          at: { q: 0, r: 0 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['guard-spawn'],
        },
        {
          action: 'setTileAsset',
          at: { q: 1, r: 0 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['watch-point'],
        },
      ]
    );
    const scenario = createGameboardScenario('scenario:patrol-agent', board, {
      spawnGroups: {
        groups: [{ id: 'guard', count: 1, tileTags: ['guard-spawn'] }],
      },
      patrolRoutes: [
        {
          id: 'guard-watch',
          count: 2,
          startGroupId: 'guard',
          tileTags: ['watch-point'],
          loop: false,
        },
      ],
      actors: [
        {
          id: 'guard-placement',
          actorId: 'guard',
          actorKind: 'npc',
          spawnGroupId: 'guard',
          assetId: 'flag_green',
          kind: 'unit',
          movementAgent: { profile: 'ground' },
          patrolAgent: { routeId: 'guard-watch', movement: { profile: 'ground' } },
        },
      ],
    });

    const runtime = createGameboardWorldFromScenario(scenario);
    const guard = runtime.actorEntities.guard;

    expect(validateGameboardScenario(scenario)).toEqual([]);
    expect(guard.get(GameboardPatrolAgent)).toMatchObject({
      routeId: 'guard-watch',
      currentWaypointIndex: 0,
      targetWaypointIndex: -1,
    });

    const firstTick = runGameboardSystems(runtime.world, { movement: { steps: 10 }, quests: false });
    expect(firstTick.eventRecords).toMatchObject([
      { type: 'patrol-move-requested', patrol: { actorId: 'guard', targetKey: '1,0' } },
      { type: 'movement-stepped', movement: { actorId: 'guard', tileKey: '1,0' } },
      { type: 'movement-completed', movement: { actorId: 'guard', state: { destinationKey: '1,0' } } },
    ]);

    const secondTick = runGameboardSystems(runtime.world, { movement: { steps: 10 }, quests: false });
    expect(secondTick.eventRecords).toMatchObject([
      {
        type: 'patrol-completed',
        patrol: {
          actorId: 'guard',
          routeId: 'guard-watch',
          status: 'completed',
          currentWaypointIndex: 1,
        },
      },
    ]);
  });

  it('reports authored patrol routes that cannot be completed', () => {
    const board = createGameboardRecipe(
      { seed: 'scenario-bad-patrol-route', shape: { kind: 'rectangle', width: 3, height: 1 } },
      [
        {
          action: 'setTileAsset',
          at: { q: 0, r: 0 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['enemy-spawn'],
        },
        { action: 'setTerrain', at: { q: 1, r: 0 }, terrain: 'water' },
        {
          action: 'setTileAsset',
          at: { q: 2, r: 0 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['watch-point'],
        },
      ]
    );
    const scenario = createGameboardScenario('scenario:bad-patrol-route', board, {
      spawnGroups: {
        groups: [{ id: 'enemy', count: 1, tileTags: ['enemy-spawn'] }],
      },
      patrolRoutes: [
        {
          id: 'blocked-watch',
          count: 2,
          startGroupId: 'enemy',
          tileTags: ['watch-point'],
        },
      ],
    });

    const violations = validateGameboardScenario(scenario);

    expect(violations.map((violation) => violation.code)).toContain('scenario.patrol_route');
    expect(() => createGameboardWorldFromScenario(scenario)).toThrow(/patrol routes failed/);
  });

  it('reports actors that reference missing scenario spawn groups', () => {
    const board = createGameboardRecipe({
      seed: 'bad-spawn-group',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    const scenario = createGameboardScenario('scenario:bad-spawn-group', board, {
      spawnGroups: {
        groups: [{ id: 'player', count: 1 }],
      },
      actors: [
        {
          actorId: 'raider',
          actorKind: 'enemy',
          spawnGroupId: 'enemy',
          assetId: 'flag_red',
          kind: 'unit',
        },
      ],
    });

    const codes = validateGameboardScenario(scenario).map((violation) => violation.code);

    expect(codes).toContain('scenario.actor_spawn_group_unknown');
  });

  it('reports actors that reference missing scenario patrol routes', () => {
    const board = createGameboardRecipe({
      seed: 'bad-patrol-agent-route',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    const scenario = createGameboardScenario('scenario:bad-patrol-agent-route', board, {
      actors: [
        {
          actorId: 'guard',
          actorKind: 'npc',
          at: '0,0',
          assetId: 'flag_green',
          kind: 'unit',
          patrolAgent: { routeId: 'missing-route' },
        },
      ],
    });

    const codes = validateGameboardScenario(scenario).map((violation) => violation.code);

    expect(codes).toContain('scenario.actor_patrol_route_unknown');
    expect(() => createGameboardWorldFromScenario(scenario)).toThrow(/unknown patrol route missing-route/);
  });

  it('prevents two scenario actors from claiming the same spawn group location', () => {
    const board = createGameboardRecipe({
      seed: 'duplicate-spawn-claim',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    const scenario = createGameboardScenario('scenario:duplicate-spawn-claim', board, {
      spawnGroups: {
        groups: [{ id: 'party', count: 2 }],
      },
      actors: [
        {
          actorId: 'hero',
          actorKind: 'player',
          spawnGroupId: 'party',
          spawnLocationIndex: 0,
          assetId: 'flag_blue',
          kind: 'unit',
        },
        {
          actorId: 'companion',
          actorKind: 'npc',
          spawnGroupId: 'party',
          spawnLocationIndex: 0,
          assetId: 'flag_green',
          kind: 'prop',
        },
      ],
    });

    const violations = validateGameboardScenario(scenario);

    expect(violations.map((violation) => violation.code)).toContain(
      'scenario.actor_spawn_location_claimed'
    );
    expect(() => createGameboardWorldFromScenario(scenario)).toThrow(/already claimed by hero/);
  });

  it('allocates the first unclaimed spawn location after explicit spawn indexes', () => {
    const board = createGameboardRecipe({
      seed: 'explicit-spawn-index',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    });
    const scenario = createGameboardScenario('scenario:explicit-spawn-index', board, {
      spawnGroups: {
        seed: 'explicit-spawn-index',
        groups: [{ id: 'party', count: 2 }],
      },
      actors: [
        {
          actorId: 'scout',
          actorKind: 'npc',
          spawnGroupId: 'party',
          spawnLocationIndex: 1,
          assetId: 'flag_green',
          kind: 'prop',
        },
        {
          actorId: 'hero',
          actorKind: 'player',
          spawnGroupId: 'party',
          assetId: 'flag_blue',
          kind: 'unit',
        },
      ],
    });

    const runtime = createGameboardWorldFromScenario(scenario);
    const actors = readGameboardActors(runtime.world);
    const scout = actors.find((actor) => actor.actor.actorId === 'scout');
    const hero = actors.find((actor) => actor.actor.actorId === 'hero');

    expect(validateGameboardScenario(scenario)).toEqual([]);
    expect(scout?.actor.metadata.scenarioSpawnLocationIndex).toBe(1);
    expect(hero?.actor.metadata.scenarioSpawnLocationIndex).toBe(0);
    expect(scout?.placement.tileKey).not.toBe(hero?.placement.tileKey);
  });
});
