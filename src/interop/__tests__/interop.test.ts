import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../gameboard/index';
import {
  createGameboardInteropSnapshotIndex,
  createGameboardInteropSnapshot,
  createGameboardScenarioInteropSnapshot,
  createGameboardSimulationInteropSnapshot,
  createInMemoryGameboardEcs,
  indexGameboardInteropSnapshot,
  mountGameboardInteropSnapshot,
  selectGameboardInteropRelations,
} from '../../interop/index';
import { createGameboardRecipe } from '../../scenario/recipe';
import { createGameboardScenario } from '../../scenario/index';
import {
  createGameboardScenarioSimulationReport,
  runGameboardScenarioSimulationScript,
  type GameboardScenarioSimulationScript,
} from '../../simulation/index';

describe('generic ECS interop adapter', () => {
  it('indexes neutral entities and mounts them into an in-memory ECS', () => {
    const plan = createGameboardBuilder({
      seed: 'interop-adapter',
      shape: { kind: 'rectangle', width: 2, height: 2 },
    })
      .addRoadPath([
        { q: 0, r: 0 },
        { q: 1, r: 0 },
      ])
      .addFlag({ q: 0, r: 1 }, 'blue')
      .build();
    const snapshot = createGameboardInteropSnapshot(plan, {
      spawnLocations: { count: 1, seed: 'interop-adapter' },
    });
    const ecs = createInMemoryGameboardEcs();
    const mounted = mountGameboardInteropSnapshot(snapshot, ecs.adapter);
    const index = indexGameboardInteropSnapshot(snapshot);
    const snapshotIndex = createGameboardInteropSnapshotIndex(snapshot);
    const placementRelations = selectGameboardInteropRelations(snapshotIndex, {
      name: 'PlacementOnTile',
    });
    const originAdjacency = selectGameboardInteropRelations(snapshot, {
      name: 'AdjacentTo',
      fromId: 'tile:0,0',
    });

    expect(index.get('tile:0,0')?.components.TileCoordinates).toEqual({ q: 0, r: 0 });
    expect(snapshotIndex.entitiesById.get('tile:0,0')?.components.TileCoordinates).toEqual({
      q: 0,
      r: 0,
    });
    expect(snapshotIndex.relationsByName.get('AdjacentTo')?.length).toBeGreaterThan(0);
    expect(snapshotIndex.relationsFromId.get('tile:0,0')).toEqual(originAdjacency);
    expect(placementRelations.every((relation) => relation.name === 'PlacementOnTile')).toBe(true);
    expect(snapshot.relations.some((relation) => relation.name === 'PlacementOnTile')).toBe(true);
    expect(snapshot.relations.some((relation) => relation.name === 'SpawnOnTile')).toBe(true);
    expect(mounted.missingRelations).toEqual([]);
    expect(ecs.entities.get('tile:0,0')?.components.get('TileTerrain')).toEqual({
      terrain: 'road',
    });
    expect(
      ecs.entities.get('tile:0,0')?.relations.some((relation) => relation.toId === 'tile:1,0')
    ).toBe(true);
    expect(
      [...ecs.entities.values()]
        .filter((entity) => entity.kind === 'placement')
        .some((entity) => entity.relations.some((relation) => relation.name === 'PlacementOnTile'))
    ).toBe(true);
    expect([...ecs.entities.values()].some((entity) => entity.kind === 'spawn')).toBe(true);
  });

  it('supports callback-only adapters for external ECS stores', () => {
    const plan = createGameboardBuilder({
      seed: 'callback-adapter',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    }).build();
    const snapshot = createGameboardInteropSnapshot(plan);
    const events: string[] = [];
    const mounted = mountGameboardInteropSnapshot(snapshot, {
      createEntity: (entity) => {
        events.push(`entity:${entity.id}`);
        return entity.id;
      },
      addComponent: (entity, componentName) => {
        events.push(`component:${entity}:${componentName}`);
      },
      addRelation: (from, to, relation) => {
        events.push(`relation:${from}:${relation.name}:${to}`);
      },
    });

    expect(mounted.entitiesById.get('tile:0,0')).toBe('tile:0,0');
    expect(events).toContain('component:tile:0,0:TileCoordinates');
    expect(events).toContain('relation:tile:0,0:AdjacentTo:tile:1,0');
    expect(events.some((event) => event.includes(':PlacementOnTile:'))).toBe(true);
  });

  it('exports placement footprint occupancy relations for external ECS stores', () => {
    const plan = createGameboardBuilder({
      seed: 'interop-footprint',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    })
      .addPlacement({
        at: { q: 0, r: 0 },
        assetId: 'external:gatehouse',
        kind: 'prop',
        layer: 'feature',
        requiresExtra: true,
        metadata: {
          layoutBlocksMovement: true,
          layoutFootprintTiles: '0,0|1,0',
          layoutOccupancyGroup: 'gatehouse:0',
        },
      })
      .build();
    const snapshot = createGameboardInteropSnapshot(plan);
    const ecs = createInMemoryGameboardEcs();
    const mounted = mountGameboardInteropSnapshot(snapshot, ecs.adapter);
    const footprintPlacement = plan.placements.find(
      (placement) => placement.assetId === 'external:gatehouse'
    );
    const placementEntity = snapshot.entities.find(
      (entity) => entity.id === `placement:${footprintPlacement?.id}`
    );
    const occupancyRelations = snapshot.relations.filter(
      (relation) =>
        relation.name === 'PlacementOccupiesTile' &&
        relation.fromId === `placement:${footprintPlacement?.id}`
    );
    const snapshotIndex = createGameboardInteropSnapshotIndex(snapshot);
    const indexedOccupancyRelations = selectGameboardInteropRelations(snapshotIndex, {
      name: 'PlacementOccupiesTile',
      fromId: `placement:${footprintPlacement?.id}`,
    });
    const coveredTileRelations = selectGameboardInteropRelations(snapshotIndex, {
      name: 'PlacementOccupiesTile',
      toId: 'tile:1,0',
    });

    expect(mounted.missingRelations).toEqual([]);
    expect(placementEntity?.components.PlacementOccupancy).toEqual({
      originTileKey: '0,0',
      footprintTileKeys: ['0,0', '1,0'],
      blocksMovement: true,
      occupancyGroup: 'gatehouse:0',
    });
    expect(occupancyRelations.map((relation) => relation.toId).sort()).toEqual([
      'tile:0,0',
      'tile:1,0',
    ]);
    expect(indexedOccupancyRelations).toEqual(occupancyRelations);
    expect(coveredTileRelations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromId: `placement:${footprintPlacement?.id}`,
          toId: 'tile:1,0',
        }),
      ])
    );
    expect(occupancyRelations.map((relation) => relation.data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tileKey: '0,0',
          originTileKey: '0,0',
          footprintIndex: 0,
          blocksMovement: true,
          occupancyGroup: 'gatehouse:0',
        }),
        expect.objectContaining({
          tileKey: '1,0',
          originTileKey: '0,0',
          footprintIndex: 1,
          blocksMovement: true,
          occupancyGroup: 'gatehouse:0',
        }),
      ])
    );
    expect(
      ecs.entities
        .get(`placement:${footprintPlacement?.id}`)
        ?.relations.filter((relation) => relation.name === 'PlacementOccupiesTile')
    ).toHaveLength(2);
  });

  it('projects scenario actors and quests for non-Koota ECS consumers', () => {
    const board = createGameboardRecipe(
      { seed: 'scenario-interop', shape: { kind: 'rectangle', width: 3, height: 2 } },
      [
        {
          action: 'addRoadPath',
          path: [
            { q: 0, r: 0 },
            { q: 1, r: 0 },
            { q: 2, r: 0 },
          ],
        },
      ]
    );
    const scenario = createGameboardScenario('scenario:interop', board, {
      title: 'Interop Scenario',
      metadata: { fixture: true },
      actors: [
        {
          actorId: 'player',
          actorKind: 'player',
          at: '0,0',
          assetId: 'flag_blue',
          kind: 'unit',
          movementAgent: { profile: 'worker', movementBudget: 4 },
        },
        {
          actorId: 'elder',
          actorKind: 'npc',
          at: { q: 2, r: 0 },
          assetId: 'flag_green',
          kind: 'prop',
          interactive: true,
        },
      ],
      quests: [
        {
          id: 'quest:talk-to-elder',
          objectives: [
            { id: 'walk-road', kind: 'reach-tile', actor: 'player', tile: '1,0' },
            { id: 'talk', kind: 'interact-actor', actor: 'player', targetActor: 'elder' },
          ],
        },
      ],
    });
    const snapshot = createGameboardScenarioInteropSnapshot(scenario);
    const ecs = createInMemoryGameboardEcs();
    const mounted = mountGameboardInteropSnapshot(snapshot, ecs.adapter);
    const index = indexGameboardInteropSnapshot(snapshot);

    expect(snapshot.scenario).toEqual({
      id: 'scenario:interop',
      title: 'Interop Scenario',
      metadata: { fixture: true },
    });
    expect(index.get('actor:player')?.components.TileCoordinates).toEqual({ q: 0, r: 0 });
    expect(index.get('actor:player')?.components.WorldPosition).toEqual({ x: 0, y: 0, z: 0 });
    expect(index.get('actor:player')?.components.MovementAgentDefinition).toMatchObject({
      movementBudget: 4,
    });
    expect(index.get('quest:quest:talk-to-elder')?.components.QuestObjectiveList).toHaveLength(2);
    expect(snapshot.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'ActorOnTile', fromId: 'actor:player', toId: 'tile:0,0' }),
        expect.objectContaining({
          name: 'QuestReferencesActor',
          fromId: 'quest:quest:talk-to-elder',
          toId: 'actor:elder',
        }),
        expect.objectContaining({
          name: 'QuestTargetsTile',
          fromId: 'quest:quest:talk-to-elder',
          toId: 'tile:1,0',
        }),
      ])
    );
    expect(mounted.missingRelations).toEqual([]);
    expect(
      ecs.entities.get('actor:elder')?.relations.some((relation) => relation.name === 'ActorOnTile')
    ).toBe(true);
    expect(
      ecs.entities
        .get('quest:quest:talk-to-elder')
        ?.relations.some((relation) => relation.name === 'QuestTargetsTile')
    ).toBe(true);
  });

  it('projects spawn-group scenario actors at resolved coordinates', () => {
    const board = createGameboardRecipe(
      { seed: 'scenario-spawn-interop', shape: { kind: 'rectangle', width: 3, height: 1 } },
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
          tags: ['enemy-spawn'],
        },
      ]
    );
    const scenario = createGameboardScenario('scenario:spawn-interop', board, {
      spawnGroups: {
        groups: [
          { id: 'player', count: 1, tileTags: ['player-spawn'] },
          { id: 'enemy', count: 1, tileTags: ['enemy-spawn'], pathToGroups: ['player'] },
        ],
      },
      actors: [
        {
          actorId: 'player',
          actorKind: 'player',
          spawnGroupId: 'player',
          assetId: 'flag_blue',
          kind: 'unit',
        },
        {
          actorId: 'raider',
          actorKind: 'enemy',
          spawnGroupId: 'enemy',
          assetId: 'flag_red',
          kind: 'unit',
        },
      ],
    });

    const snapshot = createGameboardScenarioInteropSnapshot(scenario);
    const ecs = createInMemoryGameboardEcs();
    const mounted = mountGameboardInteropSnapshot(snapshot, ecs.adapter);
    const group = indexGameboardInteropSnapshot(snapshot).get('spawn-group:enemy');
    const spawn = indexGameboardInteropSnapshot(snapshot).get('spawn:enemy:0');
    const actor = indexGameboardInteropSnapshot(snapshot).get('actor:raider');

    expect(group?.components.SpawnGroup).toMatchObject({
      groupId: 'enemy',
      selectedCount: 1,
    });
    expect(group?.components.SpawnRouteCheckList).toEqual([
      expect.objectContaining({ fromGroupId: 'enemy', toGroupId: 'player', found: true }),
    ]);
    expect(spawn?.components.ScenarioSpawnGroupLocation).toMatchObject({
      groupId: 'enemy',
      spawnId: 'spawn:enemy:0',
      tileKey: '2,0',
    });
    expect(actor?.components.TileCoordinates).toEqual({ q: 2, r: 0 });
    expect(actor?.components.ScenarioActor).toMatchObject({
      spawnGroupId: 'enemy',
      spawnTileKey: '2,0',
      actorMetadata: {
        scenarioSpawnGroupId: 'enemy',
        scenarioSpawnTileKey: '2,0',
      },
    });
    expect(snapshot.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'SpawnGroupHasLocation',
          fromId: 'spawn-group:enemy',
          toId: 'spawn:enemy:0',
        }),
        expect.objectContaining({
          name: 'SpawnGroupRouteCheck',
          fromId: 'spawn-group:enemy',
          toId: 'spawn-group:player',
        }),
        expect.objectContaining({ name: 'SpawnOnTile', fromId: 'spawn:enemy:0', toId: 'tile:2,0' }),
        expect.objectContaining({ name: 'ActorOnTile', fromId: 'actor:raider', toId: 'tile:2,0' }),
      ])
    );
    expect(snapshot.spawnLocations.map((spawnLocation) => spawnLocation.id)).toEqual([
      'spawn:player:0',
      'spawn:enemy:0',
    ]);
    expect(mounted.missingRelations).toEqual([]);
    expect(
      ecs.entities
        .get('spawn-group:enemy')
        ?.relations.some((relation) => relation.name === 'SpawnGroupRouteCheck')
    ).toBe(true);
  });

  it('projects scenario patrol routes for non-Koota ECS consumers', () => {
    const board = createGameboardRecipe(
      { seed: 'scenario-patrol-interop', shape: { kind: 'rectangle', width: 5, height: 2 } },
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
    const scenario = createGameboardScenario('scenario:patrol-interop', board, {
      spawnGroups: {
        groups: [{ id: 'enemy', count: 1, tileTags: ['enemy-spawn'] }],
      },
      patrolRoutes: [
        {
          id: 'enemy-watch',
          count: 3,
          startGroupId: 'enemy',
          tileTags: ['watch-point'],
        },
      ],
      actors: [
        {
          actorId: 'raider',
          actorKind: 'enemy',
          spawnGroupId: 'enemy',
          assetId: 'flag_red',
          kind: 'unit',
          patrolAgent: { routeId: 'enemy-watch', movement: { profile: 'ground' } },
        },
      ],
    });

    const snapshot = createGameboardScenarioInteropSnapshot(scenario);
    const ecs = createInMemoryGameboardEcs();
    const mounted = mountGameboardInteropSnapshot(snapshot, ecs.adapter);
    const index = indexGameboardInteropSnapshot(snapshot);
    const route = index.get('patrol-route:enemy-watch');
    const start = index.get('patrol-route:enemy-watch:waypoint:0');

    expect(route?.components.PatrolRoute).toMatchObject({
      routeId: 'enemy-watch',
      found: true,
      selectedWaypointCount: 3,
    });
    expect(route?.components.PatrolWaypointList).toHaveLength(3);
    expect(route?.components.PatrolSegmentList).toHaveLength(3);
    expect(start?.components.PatrolWaypoint).toMatchObject({
      routeId: 'enemy-watch',
      tileKey: '0,0',
      source: 'spawn-group',
      spawnGroupId: 'enemy',
    });
    expect(index.get('actor:raider')?.components.PatrolAgentDefinition).toMatchObject({
      routeId: 'enemy-watch',
      movement: { profile: 'ground' },
    });
    expect(snapshot.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'PatrolRouteHasWaypoint',
          fromId: 'patrol-route:enemy-watch',
          toId: 'patrol-route:enemy-watch:waypoint:0',
        }),
        expect.objectContaining({
          name: 'PatrolWaypointOnTile',
          fromId: 'patrol-route:enemy-watch:waypoint:0',
          toId: 'tile:0,0',
        }),
        expect.objectContaining({
          name: 'PatrolRouteSegment',
          fromId: 'patrol-route:enemy-watch:waypoint:0',
        }),
        expect.objectContaining({
          name: 'ActorPatrolRoute',
          fromId: 'actor:raider',
          toId: 'patrol-route:enemy-watch',
        }),
      ])
    );
    expect(mounted.missingRelations).toEqual([]);
    expect(
      ecs.entities
        .get('patrol-route:enemy-watch')
        ?.relations.some((relation) => relation.name === 'PatrolRouteHasWaypoint')
    ).toBe(true);
  });

  it('projects simulation reports into neutral ECS state and timeline entities', () => {
    const scenario = createGameboardScenario(
      'simulation-interop',
      createGameboardRecipe(
        { seed: 'simulation-interop', shape: { kind: 'rectangle', width: 4, height: 1 } },
        [
          {
            action: 'addRoadPath',
            path: [
              { q: 0, r: 0 },
              { q: 1, r: 0 },
              { q: 2, r: 0 },
              { q: 3, r: 0 },
            ],
          },
          {
            action: 'setTileAsset',
            at: { q: 3, r: 0 },
            assetId: 'hex_grass',
            terrain: 'road',
            tags: ['watch-point'],
          },
        ]
      ),
      {
        patrolRoutes: [
          {
            id: 'raider-watch',
            count: 2,
            start: '1,0',
            tileTags: ['watch-point'],
            loop: false,
          },
        ],
        actors: [
          {
            id: 'hero-placement',
            actorId: 'hero',
            actorKind: 'player',
            at: '0,0',
            assetId: 'flag_blue',
            kind: 'unit',
            movementAgent: { profile: 'worker', movementBudget: 5 },
          },
          {
            id: 'raider-placement',
            actorId: 'raider',
            actorKind: 'enemy',
            hostile: true,
            at: '1,0',
            assetId: 'flag_red',
            kind: 'unit',
            patrolAgent: { routeId: 'raider-watch', movement: { profile: 'ground' } },
          },
          {
            id: 'elder-placement',
            actorId: 'elder',
            actorKind: 'npc',
            interactive: true,
            at: '2,0',
            assetId: 'flag_green',
            kind: 'prop',
          },
        ],
        quests: [
          {
            id: 'simulation-interop:intro',
            objectives: [
              { id: 'defeat-raider', kind: 'defeat-actor', targetActor: 'raider' },
              {
                id: 'reach-elder',
                kind: 'reach-actor',
                actor: 'hero',
                targetActor: 'elder',
                maxDistance: 0,
              },
            ],
          },
        ],
      }
    );
    const script = {
      schemaVersion: '1.0.0',
      defaultSourceActor: 'hero',
      defaultCommandHandlerOptions: {
        removeTargetActor: {
          handlerId: 'interop:defeat-target',
          requireHostile: true,
        },
      },
      steps: [
        {
          action: 'run-systems',
          id: 'raider-patrol',
          systems: {
            patrols: { movement: { profile: 'ground' } },
            movement: { steps: 10 },
            quests: false,
          },
        },
        {
          action: 'inspect-actor-targets',
          id: 'scan-raider',
          sourceActor: 'hero',
          targeting: { hostileToSource: true, approach: 'nearest', includeUnreachable: true },
        },
        {
          action: 'command',
          id: 'target-raider',
          target: { actorId: 'raider' },
          handler: 'remove-target-actor',
          systems: { patrols: false, movement: false, quests: { step: 1 } },
        },
        {
          action: 'command',
          id: 'walk-to-elder',
          target: '2,0',
          systems: { patrols: false, movement: { steps: 10 }, quests: { step: 2 } },
        },
      ],
      expectations: {
        commands: [
          {
            stepId: 'target-raider',
            kind: 'attack-actor',
            actorId: 'raider',
            status: 'handled',
            handlerId: 'interop:defeat-target',
            effectTypes: ['actor-removed'],
          },
          {
            stepId: 'walk-to-elder',
            kind: 'move',
            status: 'requested-move',
            sourceActorId: 'hero',
          },
        ],
        actorTargets: [
          {
            stepId: 'scan-raider',
            sourceActorId: 'hero',
            targetActorIds: ['raider'],
            nearestActorId: 'raider',
            targetActorId: 'raider',
            targetCommandKind: 'attack-actor',
            targetCommandCanExecute: true,
          },
        ],
        patrols: [
          {
            stepId: 'raider-patrol',
            actorId: 'raider',
            routeId: 'raider-watch',
            eventType: 'patrol-move-requested',
            targetKey: '3,0',
          },
        ],
        movements: [
          {
            stepId: 'walk-to-elder',
            actorId: 'hero',
            eventType: 'movement-completed',
            status: 'completed',
          },
        ],
        mutations: [{ type: 'actor-removed', actorId: 'raider', removed: true }],
        actors: [
          { actorId: 'hero', tileKey: '2,0' },
          { actorId: 'raider', exists: false },
        ],
        quests: [{ questId: 'simulation-interop:intro', status: 'completed' }],
      },
    } satisfies GameboardScenarioSimulationScript;
    const report = createGameboardScenarioSimulationReport(
      runGameboardScenarioSimulationScript(scenario, script),
      script.expectations
    );
    const snapshot = createGameboardSimulationInteropSnapshot(report);
    const ecs = createInMemoryGameboardEcs();
    const mounted = mountGameboardInteropSnapshot(snapshot, ecs.adapter);
    const index = indexGameboardInteropSnapshot(snapshot);

    expect(report.success).toBe(true);
    expect(mounted.missingRelations).toEqual([]);
    expect(
      index.get('simulation:simulation-interop')?.components.GameboardSimulationReport
    ).toMatchObject({
      success: true,
      actorTargetCount: 1,
      commandCount: 2,
      patrolCount: 1,
      movementCount: 5,
    });
    expect(
      index.get('simulation:simulation-interop:actor-targets:0')?.components
        .GameboardSimulationActorTargets
    ).toMatchObject({
      stepId: 'scan-raider',
      sourceActorId: 'hero',
      targetActorIds: ['raider'],
      targets: [
        expect.objectContaining({
          actorId: 'raider',
          commandKind: 'attack-actor',
          commandCanExecute: true,
        }),
      ],
    });
    expect(
      index.get('simulation:simulation-interop:patrol:0')?.components.GameboardSimulationPatrol
    ).toMatchObject({
      eventType: 'patrol-move-requested',
      patrol: { actorId: 'raider', routeId: 'raider-watch', targetKey: '3,0' },
    });
    expect(
      index.get('simulation:simulation-interop:command:0')?.components.GameboardSimulationCommand
    ).toMatchObject({
      eventType: 'command-handled',
      command: {
        kind: 'attack-actor',
        status: 'handled',
        handlerId: 'interop:defeat-target',
        effectTypes: ['actor-removed'],
        effects: [
          {
            type: 'actor-removed',
            actorId: 'raider',
            placementId: 'raider-placement',
            removed: true,
          },
        ],
      },
    });
    expect(
      snapshot.relations.find((relation) => relation.name === 'SimulationStepCommand')?.data
    ).toMatchObject({
      role: 'command',
      commandKind: 'attack-actor',
      commandStatus: 'handled',
      handlerId: 'interop:defeat-target',
      handlerStatus: 'handled',
      effectTypes: ['actor-removed'],
    });
    expect(
      snapshot.relations.find((relation) => relation.name === 'SimulationStepActorTargets')?.data
    ).toMatchObject({
      role: 'actorTargets',
      stepId: 'scan-raider',
    });
    expect(
      snapshot.relations.find((relation) => relation.name === 'ActorTargetsTargetActor')?.data
    ).toMatchObject({
      role: 'targetActor',
      actorId: 'raider',
      placementId: 'raider-placement',
      targetCommandKind: 'attack-actor',
      targetCommandCanExecute: true,
    });
    expect(index.get('actor:hero')?.components.TileCoordinates).toEqual({ q: 2, r: 0 });
    expect(index.get('actor:raider')?.components.GameboardActorReference).toEqual({
      actorId: 'raider',
      exists: false,
      source: 'simulation-timeline',
    });
    expect(
      index.get('quest:simulation-interop:intro')?.components.GameboardQuestState
    ).toMatchObject({ status: 'completed' });
    expect(
      [...ecs.entities.values()].some((entity) =>
        entity.relations.some(
          (relation) => relation.name === 'MovementActor' && relation.toId === 'actor:hero'
        )
      )
    ).toBe(true);
    expect(
      [...ecs.entities.values()].some((entity) =>
        entity.relations.some(
          (relation) => relation.name === 'MutationActor' && relation.toId === 'actor:raider'
        )
      )
    ).toBe(true);
    expect(
      [...ecs.entities.values()].some((entity) =>
        entity.relations.some(
          (relation) =>
            relation.name === 'CommandEffectActor' &&
            relation.toId === 'actor:raider' &&
            'effectType' in relation.data &&
            relation.data.effectType === 'actor-removed' &&
            'handlerId' in relation.data &&
            relation.data.handlerId === 'interop:defeat-target'
        )
      )
    ).toBe(true);
    expect(
      [...ecs.entities.values()].some((entity) =>
        entity.relations.some(
          (relation) =>
            relation.name === 'CommandEffectPlacement' &&
            relation.toId === 'placement:raider-placement' &&
            'effectType' in relation.data &&
            relation.data.effectType === 'actor-removed'
        )
      )
    ).toBe(true);
    expect(
      [...ecs.entities.values()].some((entity) =>
        entity.relations.some(
          (relation) => relation.name === 'PatrolActor' && relation.toId === 'actor:raider'
        )
      )
    ).toBe(true);
    expect(
      [...ecs.entities.values()].some((entity) =>
        entity.relations.some(
          (relation) =>
            relation.name === 'ActorTargetsTargetActor' && relation.toId === 'actor:raider'
        )
      )
    ).toBe(true);
  });
});
