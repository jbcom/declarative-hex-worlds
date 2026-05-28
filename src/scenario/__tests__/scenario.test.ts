import { describe, expect, it } from 'vitest';
import {
  GAMEBOARD_SCENARIO_SCHEMA_VERSION,
  advanceGameboardQuest,
  createGameboardRecipe,
  createGameboardRuntimeFromScenario,
  createGameboardScenario,
  createGameboardWorldFromScenario,
  inspectGameboardScenario,
  readGameboardActors,
  runGameboardSystems,
  summarizeGameboardScenario,
  validateGameboardScenario,
} from '../..';
import { freeManifest } from '../../manifest/free';
import { MovementAgent } from '../../movement/index';
import { GameboardPatrolAgent } from '../../patrol/index';
import { validateGameboardRules } from '../../rules/index';

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
    if (player === undefined) {
      throw new Error('scenario test expected player actor entity');
    }
    if (quest === undefined) {
      throw new Error('scenario test expected quest entity');
    }

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
    if (guard === undefined) {
      throw new Error('scenario test expected guard actor entity');
    }

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

  it('summarizes playable scenario actors, spawns, patrols, quests, and local-only actors', () => {
    const board = createGameboardRecipe(
      { seed: 'scenario-summary', shape: { kind: 'rectangle', width: 5, height: 2 } },
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
          at: { q: 2, r: 0 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['elder-spawn'],
        },
        {
          action: 'setTileAsset',
          at: { q: 4, r: 0 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['enemy-spawn'],
        },
        {
          action: 'setTileAsset',
          at: { q: 3, r: 1 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['watch-point'],
        },
      ]
    );
    const scenario = createGameboardScenario('scenario:summary', board, {
      title: 'Summary Scenario',
      spawnGroups: {
        groups: [
          { id: 'player', count: 1, tileTags: ['player-spawn'] },
          { id: 'elder', count: 1, tileTags: ['elder-spawn'] },
          {
            id: 'enemy',
            count: 1,
            tileTags: ['enemy-spawn'],
            minDistanceFromGroups: 2,
            pathToGroups: ['player'],
          },
        ],
      },
      patrolRoutes: [
        {
          id: 'enemy-watch',
          count: 2,
          startGroupId: 'enemy',
          tileTags: ['watch-point'],
        },
      ],
      actors: [
        {
          actorId: 'player',
          actorKind: 'player',
          team: 'blue',
          spawnGroupId: 'player',
          assetId: 'flag_blue',
          kind: 'unit',
          tags: ['party'],
          movementAgent: { profile: 'worker', movementBudget: 3 },
        },
        {
          actorId: 'elder',
          actorKind: 'npc',
          team: 'blue',
          interactive: true,
          spawnGroupId: 'elder',
          assetId: 'flag_green',
          kind: 'prop',
        },
        {
          actorId: 'raider',
          actorKind: 'enemy',
          team: 'red',
          hostile: true,
          blocksMovement: true,
          spawnGroupId: 'enemy',
          assetId: 'unit_red_full',
          kind: 'unit',
          requiresExtra: true,
          movementAgent: { profile: 'ground' },
          patrolAgent: { routeId: 'enemy-watch', movement: { profile: 'ground' } },
        },
      ],
      quests: [
        {
          id: 'scenario:summary:quest',
          objectives: [
            { id: 'reach-elder', kind: 'reach-actor', actor: 'player', targetActor: 'elder' },
            { id: 'talk-elder', kind: 'interact-actor', actor: 'player', targetActor: 'elder' },
            { id: 'spot-raider', kind: 'collision', actor: 'player', targetActor: 'raider', expect: 'hostile' },
            { id: 'defeat-raider', kind: 'defeat-actor', targetActor: 'raider' },
          ],
        },
      ],
    });

    const summary = summarizeGameboardScenario(scenario, {
      plan: { assetCatalog: freeManifest, allowUnknownAssets: true },
      topAssetLimit: 100,
    });
    const runtimeSummary = createGameboardRuntimeFromScenario(scenario).summarizeScenario({
      topAssetLimit: 100,
    });

    expect(summary).toMatchObject({
      schemaVersion: GAMEBOARD_SCENARIO_SCHEMA_VERSION,
      scenarioId: 'scenario:summary',
      title: 'Summary Scenario',
      validation: { errorCount: 0, warningCount: 0 },
      actorCount: 3,
      resolvedActorCount: 3,
      movementAgentCount: 2,
      patrolAgentCount: 1,
      hostileActorCount: 1,
      interactiveActorCount: 1,
      blockingActorCount: 1,
      questCount: 1,
      objectiveCount: 4,
      spawnGroupCount: 3,
      spawnLocationCount: 3,
      spawnRouteCheckCount: 1,
      spawnRouteFoundCount: 1,
      patrolRouteCount: 1,
      patrolRouteFoundCount: 1,
      patrolWaypointCount: 2,
    });
    expect(summary.board?.tileCount).toBe(10);
    expect(summary.actorKindCounts).toMatchObject({ enemy: 1, npc: 1, player: 1 });
    expect(summary.actorTeamCounts).toMatchObject({ blue: 2, red: 1 });
    expect(summary.actorSpawnGroupCounts).toMatchObject({ elder: 1, enemy: 1, player: 1 });
    expect(summary.actorTileCounts).toMatchObject({ '0,0': 1, '2,0': 1, '4,0': 1 });
    expect(summary.actorTagCounts).toMatchObject({ party: 1 });
    expect(summary.actorAssetCounts).toMatchObject({
      flag_blue: 1,
      flag_green: 1,
      unit_red_full: 1,
    });
    expect(summary.actorExtraAssetIds).toEqual(['unit_red_full']);
    expect(summary.topActorAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: 'unit_red_full',
          requiresExtra: true,
          actorKinds: ['enemy'],
          teams: ['red'],
        }),
      ])
    );
    expect(summary.objectiveKindCounts).toMatchObject({
      collision: 1,
      'defeat-actor': 1,
      'interact-actor': 1,
      'reach-actor': 1,
    });
    expect(summary.objectiveActorCounts).toMatchObject({ player: 3 });
    expect(summary.objectiveTargetActorCounts).toMatchObject({ elder: 2, raider: 2 });
    expect(summary.spawnGroupLocationCounts).toMatchObject({ elder: 1, enemy: 1, player: 1 });
    expect(summary.patrolRouteWaypointCounts).toMatchObject({ 'enemy-watch': 2 });
    expect(runtimeSummary.scenarioId).toBe(summary.scenarioId);
    expect(runtimeSummary.actorExtraAssetIds).toEqual(['unit_red_full']);
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

  it('createGameboardWorldFromScenario throws when spawnGroups have errors (E0b)', () => {
    // Covers scenario.ts line 651: spawn groups errors → throw.
    const board = createGameboardRecipe({
      seed: 'bad-spawn-groups',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    const scenario = createGameboardScenario('scenario:bad-spawn-groups-runtime', board, {
      spawnGroups: {
        // Two groups with same id triggers a planning error.
        groups: [
          { id: 'duplicate', count: 1 },
          { id: 'duplicate', count: 1 },
        ],
      },
    });
    expect(() => createGameboardWorldFromScenario(scenario)).toThrow(/spawn groups failed/);
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

  it('reports quest objective with empty id + duplicate + missing actor/target/collision (E0b)', () => {
    const board = createGameboardRecipe({
      seed: 'objective-violations',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    const scenario = createGameboardScenario('scenario:obj-violations', board, {
      actors: [
        { actorId: 'hero', actorKind: 'player', at: '0,0', assetId: 'flag_blue', kind: 'unit' },
      ],
      quests: [
        {
          id: 'quest-1',
          objectives: [
            // biome-ignore lint/suspicious/noExplicitAny: deliberate empty-id
            { id: '', kind: 'interact-actor', actor: 'hero', targetActor: 'hero' } as any,
            { id: 'obj-a', kind: 'interact-actor', actor: 'hero', targetActor: 'hero' },
            { id: 'obj-a', kind: 'interact-actor', actor: 'hero', targetActor: 'hero' },
            { id: 'obj-b', kind: 'interact-actor', actor: 'unknown-actor', targetActor: 'hero' },
            { id: 'obj-c', kind: 'interact-actor', actor: 'hero', targetActor: 'unknown-target' },
            { id: 'obj-d', kind: 'collision', actor: 'hero' },
          ],
        },
      ],
    });
    const codes = validateGameboardScenario(scenario).map((v) => v.code);
    expect(codes).toContain('scenario.objective_id');
    expect(codes).toContain('scenario.objective_duplicate');
    expect(codes).toContain('scenario.objective_missing_actor');
    expect(codes).toContain('scenario.objective_missing_target_actor');
    expect(codes).toContain('scenario.objective_missing_collision_target');
  });

  it('reports quest objective tile coordinate / missing tile errors (E0b)', () => {
    const board = createGameboardRecipe({
      seed: 'objective-tile-violations',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    const scenario = createGameboardScenario('scenario:obj-tiles', board, {
      actors: [
        { actorId: 'hero', actorKind: 'player', at: '0,0', assetId: 'flag_blue', kind: 'unit' },
      ],
      quests: [
        {
          id: 'quest-1',
          objectives: [
            // biome-ignore lint/suspicious/noExplicitAny: deliberately-invalid tile
            { id: 'obj-bad-tile', kind: 'reach-tile', actor: 'hero', tile: 'not,a,key' as any },
            { id: 'obj-off-board', kind: 'reach-tile', actor: 'hero', tile: '99,99' },
          ],
        },
      ],
    });
    const codes = validateGameboardScenario(scenario).map((v) => v.code);
    expect(codes).toContain('scenario.objective_tile_key');
    expect(codes).toContain('scenario.objective_missing_tile');
  });

  it('reports actor patrolAgent with empty routeId (E0b)', () => {
    const board = createGameboardRecipe({
      seed: 'empty-patrol-route-id',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    const scenario = createGameboardScenario('scenario:empty-patrol-route-id', board, {
      actors: [
        {
          actorId: 'guard',
          actorKind: 'npc',
          at: '0,0',
          assetId: 'flag_green',
          kind: 'unit',
          patrolAgent: { routeId: '' },
        },
      ],
    });
    const codes = validateGameboardScenario(scenario).map((v) => v.code);
    expect(codes).toContain('scenario.actor_patrol_route_id');
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

  it('flags scenario actor with both at and spawnGroupId set (E0h)', () => {
    const inspection = inspectGameboardScenario({
      schemaVersion: GAMEBOARD_SCENARIO_SCHEMA_VERSION,
      id: 'actor-conflict',
      board: {
        schemaVersion: '1.0.0',
        options: { seed: 'x', shape: { kind: 'rectangle', width: 3, height: 3 } },
        steps: [],
      },
      actors: [
        {
          id: 'hero',
          actorId: 'hero',
          actorKind: 'player',
          team: 'blue',
          at: '0,0',
          spawnGroupId: 'base',
          assetId: 'flag_blue',
          kind: 'unit',
        },
      ],
    });
    expect(
      inspection.violations.some((v) => v.code === 'scenario.actor_spawn_conflict')
    ).toBe(true);
  });

  it('flags scenario actor referencing missing spawn group plan (E0h)', () => {
    const inspection = inspectGameboardScenario({
      schemaVersion: GAMEBOARD_SCENARIO_SCHEMA_VERSION,
      id: 'no-spawn-plan',
      board: {
        schemaVersion: '1.0.0',
        options: { seed: 'x', shape: { kind: 'rectangle', width: 3, height: 3 } },
        steps: [],
      },
      actors: [
        {
          id: 'hero',
          actorId: 'hero',
          actorKind: 'player',
          team: 'blue',
          spawnGroupId: 'unconfigured-base',
          assetId: 'flag_blue',
          kind: 'unit',
        },
      ],
      // No spawnGroups plan supplied.
    });
    expect(
      inspection.violations.some(
        (v) => v.code === 'scenario.actor_spawn_group_missing'
      )
    ).toBe(true);
  });

  it('inspectGameboardScenario flags wrong schemaVersion (E0h)', () => {
    const inspection = inspectGameboardScenario({
      // biome-ignore lint/suspicious/noExplicitAny: deliberately wrong
      schemaVersion: '0.0.1-not-current' as any,
      id: 'wrong-schema',
      board: {
        schemaVersion: '1.0.0',
        options: { seed: 'x', shape: { kind: 'rectangle', width: 2, height: 2 } },
        steps: [],
      },
    });
    expect(
      inspection.violations.some((v) => v.code === 'scenario.schema_version')
    ).toBe(true);
  });

  it('inspectGameboardScenario flags missing scenario id (E0h)', () => {
    const inspection = inspectGameboardScenario({
      schemaVersion: GAMEBOARD_SCENARIO_SCHEMA_VERSION,
      // biome-ignore lint/suspicious/noExplicitAny: deliberately empty
      id: '' as any,
      board: {
        schemaVersion: '1.0.0',
        options: { seed: 'x', shape: { kind: 'rectangle', width: 2, height: 2 } },
        steps: [],
      },
    });
    expect(inspection.violations.some((v) => v.code === 'scenario.id')).toBe(true);
  });

  it('inspectGameboardScenario flags board recipe that fails to compile (E0h)', () => {
    const inspection = inspectGameboardScenario({
      schemaVersion: GAMEBOARD_SCENARIO_SCHEMA_VERSION,
      id: 'broken-board',
      board: {
        schemaVersion: '1.0.0',
        options: { seed: 'x', shape: { kind: 'rectangle', width: 2, height: 2 } },
        // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid action
        steps: [{ action: 'not-a-real-recipe-action' } as any],
      },
    });
    expect(
      inspection.violations.some((v) => v.code === 'scenario.board_compile_failed')
    ).toBe(true);
  });

  it('reports actor with negative spawnLocationIndex (E0a)', () => {
    const board = createGameboardRecipe({
      seed: 'bad-spawn-index',
      shape: { kind: 'rectangle', width: 3, height: 2 },
    });
    const scenario = createGameboardScenario('scenario:bad-spawn-index', board, {
      spawnGroups: {
        groups: [{ id: 'guards', count: 2 }],
      },
      actors: [
        {
          actorId: 'guard-1',
          actorKind: 'npc',
          spawnGroupId: 'guards',
          // biome-ignore lint/suspicious/noExplicitAny: deliberately-invalid index
          spawnLocationIndex: -1 as any,
          assetId: 'flag_green',
          kind: 'unit',
        },
      ],
    });
    const codes = validateGameboardScenario(scenario).map((v) => v.code);
    expect(codes).toContain('scenario.actor_spawn_location_index');
  });

  it('summarizeGameboardScenario sorts actor tags alphabetically (E0b)', () => {
    const board = createGameboardRecipe({
      seed: 'tagged-actors',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    const scenario = createGameboardScenario('scenario:tagged-actors', board, {
      actors: [
        {
          actorId: 'tagged',
          actorKind: 'npc',
          at: '0,0',
          assetId: 'flag_blue',
          kind: 'unit',
          tags: ['zebra', 'apple', 'mango'],
        },
      ],
    });
    const summary = summarizeGameboardScenario(scenario);
    const actor = summary.actors.find((a) => a.actorId === 'tagged');
    expect(actor?.tags).toEqual(['apple', 'mango', 'zebra']);
  });

  it('reports actor with invalid tile coordinate (E0b)', () => {
    const board = createGameboardRecipe({
      seed: 'bad-actor-tile',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    const scenario = createGameboardScenario('scenario:bad-actor-tile', board, {
      actors: [
        {
          actorId: 'orphan',
          actorKind: 'npc',
          // biome-ignore lint/suspicious/noExplicitAny: deliberately-invalid coord
          at: 17 as any,
          assetId: 'flag_blue',
          kind: 'unit',
        },
      ],
    });
    const codes = validateGameboardScenario(scenario).map((v) => v.code);
    expect(codes).toContain('scenario.actor_tile_key');
  });

  it('reports actor with empty actorId + duplicate actorId (E0b)', () => {
    const board = createGameboardRecipe({
      seed: 'bad-actor-ids',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    const scenario = createGameboardScenario('scenario:bad-actor-ids', board, {
      actors: [
        // biome-ignore lint/suspicious/noExplicitAny: deliberately-empty actorId
        { actorId: '' as any, actorKind: 'npc', at: '0,0', assetId: 'flag_blue', kind: 'unit' },
        { actorId: 'twin', actorKind: 'npc', at: '0,0', assetId: 'flag_red', kind: 'unit' },
        { actorId: 'twin', actorKind: 'npc', at: '1,0', assetId: 'flag_yellow', kind: 'unit' },
      ],
    });
    const codes = validateGameboardScenario(scenario).map((v) => v.code);
    expect(codes).toContain('scenario.actor_id');
    expect(codes).toContain('scenario.actor_duplicate');
  });

  it('reports quest with empty id + duplicate quest id (E0a)', () => {
    const board = createGameboardRecipe({
      seed: 'bad-quest-ids',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    const scenario = createGameboardScenario('scenario:bad-quest-ids', board, {
      quests: [
        // biome-ignore lint/suspicious/noExplicitAny: deliberately-empty id
        { id: '' as any, objectives: [] },
        { id: 'twin', objectives: [] },
        { id: 'twin', objectives: [] },
      ],
    });
    const codes = validateGameboardScenario(scenario).map((v) => v.code);
    expect(codes).toContain('scenario.quest_id');
    expect(codes).toContain('scenario.quest_duplicate');
  });

  it('reports actor missing assetId (E0a)', () => {
    const board = createGameboardRecipe({
      seed: 'no-asset',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    const scenario = createGameboardScenario('scenario:no-asset', board, {
      actors: [
        {
          actorId: 'wraith',
          actorKind: 'npc',
          at: '0,0',
          // biome-ignore lint/suspicious/noExplicitAny: deliberately-empty asset
          assetId: '' as any,
          kind: 'unit',
        },
      ],
    });
    const codes = validateGameboardScenario(scenario).map((v) => v.code);
    expect(codes).toContain('scenario.actor_asset');
  });

  it('reports actor missing kind (E0a)', () => {
    const board = createGameboardRecipe({
      seed: 'no-kind',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    const scenario = createGameboardScenario('scenario:no-kind', board, {
      actors: [
        {
          actorId: 'kindless',
          actorKind: 'npc',
          at: '0,0',
          assetId: 'flag_blue',
          // biome-ignore lint/suspicious/noExplicitAny: deliberately-empty kind
          kind: '' as any,
        },
      ],
    });
    const codes = validateGameboardScenario(scenario).map((v) => v.code);
    expect(codes).toContain('scenario.actor_kind');
  });

  it('reports actor whose assetId is missing from the manifest catalog (E0a)', () => {
    const board = createGameboardRecipe({
      seed: 'bad-actor-asset',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    const scenario = createGameboardScenario('scenario:bad-actor-asset', board, {
      actors: [
        {
          actorId: 'mystery',
          actorKind: 'npc',
          at: '0,0',
          assetId: 'not-a-real-asset',
          kind: 'unit',
        },
      ],
    });
    const codes = validateGameboardScenario(scenario, {
      plan: { assetCatalog: freeManifest, requireExtraAssetFlags: false },
    }).map((v) => v.code);
    expect(codes).toContain('scenario.actor_unknown_asset');
  });

  it('reports actor with out-of-range spawnLocationIndex (E0a)', () => {
    const board = createGameboardRecipe({
      seed: 'oor-spawn-index',
      shape: { kind: 'rectangle', width: 3, height: 2 },
    });
    const scenario = createGameboardScenario('scenario:oor-spawn-index', board, {
      spawnGroups: {
        groups: [{ id: 'guards', count: 2 }],
      },
      actors: [
        {
          actorId: 'guard-1',
          actorKind: 'npc',
          spawnGroupId: 'guards',
          spawnLocationIndex: 99,
          assetId: 'flag_green',
          kind: 'unit',
        },
      ],
    });
    const codes = validateGameboardScenario(scenario).map((v) => v.code);
    expect(codes).toContain('scenario.actor_spawn_location_missing');
  });
});
