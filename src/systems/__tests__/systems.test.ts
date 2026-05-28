import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../gameboard/index';
import { createGameboardWorld, findPlacementEntity, removeGameboardPlacement } from '../../koota/index';
import { MovementPathState, setGameboardMovementAgent } from '../../movement/index';
import { spawnGameboardActor } from '../../actors/index';
import { createRemoveTargetActorHandler } from '../../commands/index';
import { spawnGameboardQuest } from '../../quests/index';
import { GameboardPatrolState, readGameboardPatrolAgents, setGameboardPatrolAgent } from '../../patrol/index';
import {
  dispatchGameboardActorTargetCommand,
  dispatchGameboardInteractionCommand,
  gameboardSystemActions,
  runGameboardActorTargetInteraction,
  runGameboardInteraction,
  runGameboardSystems,
  snapshotGameboardSystemEvents,
} from '../../systems/index';

describe('gameboard systems', () => {
  it('dispatches movement commands, runs movement, and advances quests as neutral events', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'systems-move-quest',
        shape: { kind: 'rectangle', width: 2, height: 1 },
      }).build()
    );
    const player = spawnGameboardActor(world, {
      id: 'hero-placement',
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    setGameboardMovementAgent(world, player, { profile: 'worker', movementBudget: 4 });
    spawnGameboardQuest(world, {
      id: 'reach-exit',
      objectives: [{ id: 'reach-exit-tile', kind: 'reach-tile', actor: 'hero', tile: '1,0' }],
    });

    const dispatch = dispatchGameboardInteractionCommand(world, '1,0', { sourceActor: 'hero' });
    expect(dispatch.events.map((event) => event.type)).toEqual(['movement-requested']);
    expect(dispatch.eventRecords).toMatchObject([
      { type: 'movement-requested', command: { status: 'requested-move' } },
    ]);

    const systems = runGameboardSystems(world, { movement: { steps: 10 }, quests: { step: 1 } });
    expect(systems.movement).toHaveLength(1);
    expect(findPlacementEntity(world, 'hero-placement')?.get(MovementPathState)?.status).toBe('completed');
    expect(systems.quests[0]?.quest.status).toBe('completed');
    expect(systems.events.map((event) => event.type)).toEqual([
      'movement-stepped',
      'movement-completed',
      'quest-advanced',
      'quest-completed',
    ]);
    expect(systems.eventRecords.map((event) => event.type)).toEqual([
      'movement-stepped',
      'movement-completed',
      'quest-advanced',
      'quest-completed',
    ]);

    const records = snapshotGameboardSystemEvents([...dispatch.events, ...systems.events]);
    expect(JSON.parse(JSON.stringify(records))).toMatchObject([
      {
        type: 'movement-requested',
        command: {
          kind: 'move',
          status: 'requested-move',
          sourceActorId: 'hero',
          sourcePlacementId: 'hero-placement',
          tileKey: '1,0',
        },
        movement: {
          placementId: 'hero-placement',
          tileKey: '0,0',
          profileId: 'worker',
          moved: false,
          state: { status: 'ready', destinationKey: '1,0' },
        },
      },
      {
        type: 'movement-stepped',
        movement: {
          placementId: 'hero-placement',
          tileKey: '1,0',
          profileId: 'worker',
          moved: true,
          state: { status: 'completed', destinationKey: '1,0' },
        },
      },
      {
        type: 'movement-completed',
        movement: { placementId: 'hero-placement', state: { status: 'completed' } },
      },
      {
        type: 'quest-advanced',
        quest: {
          questId: 'reach-exit',
          status: 'completed',
          progress: [{ objectiveId: 'reach-exit-tile', status: 'completed' }],
        },
      },
      {
        type: 'quest-completed',
        quest: { questId: 'reach-exit', status: 'completed' },
      },
    ]);
  });

  it('surfaces handler-required, blocked, and ignored command events', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'systems-command-events',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      team: 'blue',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      actorId: 'elder',
      actorKind: 'npc',
      team: 'blue',
      at: '1,0',
      assetId: 'flag_green',
      kind: 'prop',
    });
    spawnGameboardActor(world, {
      actorId: 'raider',
      actorKind: 'enemy',
      team: 'red',
      at: '2,0',
      assetId: 'flag_red',
      kind: 'unit',
    });

    expect(dispatchGameboardInteractionCommand(world, { actorId: 'elder' }, { sourceActor: 'hero' })).toMatchObject({
      events: [{ type: 'command-handler-required', execution: { command: { kind: 'interact-actor' } } }],
    });
    expect(dispatchGameboardInteractionCommand(world, '1,0')).toMatchObject({
      events: [{ type: 'command-blocked', reason: 'Move commands require a source actor' }],
    });
    expect(dispatchGameboardInteractionCommand(world, 'missing', { sourceActor: 'hero' })).toMatchObject({
      events: [{ type: 'command-ignored', reason: 'No target resolved' }],
    });
  });

  it('surfaces handled command events with handler effect records', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'systems-command-handled',
        shape: { kind: 'rectangle', width: 2, height: 1 },
      }).build()
    );
    spawnGameboardActor(world, {
      id: 'hero-placement',
      actorId: 'hero',
      actorKind: 'player',
      team: 'blue',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      id: 'raider-placement',
      actorId: 'raider',
      actorKind: 'enemy',
      team: 'red',
      hostile: true,
      at: '1,0',
      assetId: 'flag_red',
      kind: 'unit',
    });

    expect(
      dispatchGameboardInteractionCommand(world, { actorId: 'raider' }, {
        sourceActor: 'hero',
        handlers: createRemoveTargetActorHandler(),
      })
    ).toMatchObject({
      events: [{ type: 'command-handled', execution: { command: { kind: 'attack-actor' } } }],
      eventRecords: [
        {
          type: 'command-handled',
          command: {
            kind: 'attack-actor',
            status: 'handled',
            handlerId: 'remove-target-actor',
            handlerStatus: 'handled',
            effectTypes: ['actor-removed'],
            effects: [{ type: 'actor-removed', actorId: 'raider', placementId: 'raider-placement', removed: true }],
          },
        },
      ],
    });
    expect(findPlacementEntity(world, 'raider-placement')).toBeUndefined();
  });

  it('dispatches actor-target command plans without losing targeting context', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'systems-actor-target-command',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    spawnGameboardActor(world, {
      id: 'hero-placement',
      actorId: 'hero',
      actorKind: 'player',
      team: 'blue',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      id: 'raider-placement',
      actorId: 'raider',
      actorKind: 'enemy',
      team: 'red',
      hostile: true,
      at: '1,0',
      assetId: 'flag_red',
      kind: 'unit',
    });

    const dispatch = dispatchGameboardActorTargetCommand(
      world,
      {
        sourceActor: 'hero',
        hostileToSource: true,
        targetActorId: 'raider',
        maxPathCost: 1,
      },
      { handlers: createRemoveTargetActorHandler() }
    );

    expect(dispatch).toMatchObject({
      targetCommand: {
        canExecute: true,
        target: {
          actor: { actor: { actorId: 'raider' } },
          path: { found: true, cost: 0 },
        },
        command: { kind: 'attack-actor', actorId: 'raider' },
      },
      dispatch: {
        events: [{ type: 'command-handled' }],
        eventRecords: [
          {
            type: 'command-handled',
            command: {
              kind: 'attack-actor',
              status: 'handled',
              actorId: 'raider',
              handlerId: 'remove-target-actor',
            },
          },
        ],
      },
    });
    expect(dispatch.events.map((event) => event.type)).toEqual(['command-handled']);
    expect(findPlacementEntity(world, 'raider-placement')).toBeUndefined();

    spawnGameboardActor(world, {
      id: 'distant-raider-placement',
      actorId: 'distant-raider',
      actorKind: 'enemy',
      team: 'red',
      hostile: true,
      at: '2,0',
      assetId: 'flag_red',
      kind: 'unit',
    });
    const unreachable = dispatchGameboardActorTargetCommand(world, {
      sourceActor: 'hero',
      hostileToSource: true,
      targetActorId: 'distant-raider',
      maxPathCost: 0,
    });
    expect(unreachable.dispatch).toBeUndefined();
    expect(unreachable).toMatchObject({
      targetCommand: {
        canExecute: false,
        target: { actor: { actor: { actorId: 'distant-raider' } } },
      },
      events: [],
      eventRecords: [],
    });
    expect(unreachable.reason).toContain('Path costs');
  });

  it('can run an interaction and one systems tick through an action bundle', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'systems-actions',
        shape: { kind: 'rectangle', width: 2, height: 1 },
      }).build()
    );
    const player = spawnGameboardActor(world, {
      id: 'hero-placement',
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    setGameboardMovementAgent(world, player, { profile: 'ground' });
    const actions = gameboardSystemActions(world);
    const result = actions.interact('1,0', { sourceActor: 'hero', systems: { movement: { steps: 10 }, quests: false } });

    expect(result.events.map((event) => event.type)).toEqual([
      'movement-requested',
      'movement-stepped',
      'movement-completed',
    ]);
    expect(result.eventRecords.map((event) => event.type)).toEqual([
      'movement-requested',
      'movement-stepped',
      'movement-completed',
    ]);

    removeGameboardPlacement(world, 'hero-placement');
    expect(runGameboardInteraction(world, 'missing', { sourceActor: 'hero', systems: false }).events).toMatchObject([
      { type: 'command-ignored' },
    ]);
  });

  it('runs actor-target interactions through action bundles and system ticks', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'systems-actor-target-interaction',
        shape: { kind: 'rectangle', width: 2, height: 1 },
      }).build()
    );
    spawnGameboardActor(world, {
      id: 'hero-placement',
      actorId: 'hero',
      actorKind: 'player',
      team: 'blue',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      id: 'raider-placement',
      actorId: 'raider',
      actorKind: 'enemy',
      team: 'red',
      hostile: true,
      at: '1,0',
      assetId: 'flag_red',
      kind: 'unit',
    });

    const actions = gameboardSystemActions(world);
    const result = actions.interactActorTarget(
      {
        sourceActor: 'hero',
        hostileToSource: true,
        targetActorId: 'raider',
        maxPathCost: 1,
      },
      { handlers: createRemoveTargetActorHandler(), systems: { movement: false, quests: false } }
    );
    expect(result.events.map((event) => event.type)).toEqual(['command-handled']);
    expect(result.targetCommand.command).toMatchObject({
      kind: 'attack-actor',
      actorId: 'raider',
    });
    expect(findPlacementEntity(world, 'raider-placement')).toBeUndefined();

    const missing = runGameboardActorTargetInteraction(
      world,
      { sourceActor: 'hero', targetActorId: 'missing-raider' },
      { systems: false }
    );
    expect(missing.interaction).toBeUndefined();
    expect(missing).toMatchObject({ events: [], eventRecords: [] });
    expect(missing.reason).toBe('No actor target found for missing-raider');
  });

  it('runs Koota patrol agents before movement so NPC schedules progress through game ticks', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'systems-patrol-route',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    const guard = spawnGameboardActor(world, {
      id: 'guard-placement',
      actorId: 'guard',
      actorKind: 'npc',
      at: '0,0',
      assetId: 'flag_green',
      kind: 'unit',
    });

    setGameboardPatrolAgent(world, guard, {
      route: {
        id: 'wall-watch',
        waypointKeys: ['0,0', '1,0', '2,0'],
        loop: false,
        segmentCosts: [1, 1],
      },
      movement: { profile: 'ground' },
    });

    const firstTick = runGameboardSystems(world, { movement: { steps: 10 }, quests: false });
    expect(firstTick.events.map((event) => event.type)).toEqual([
      'patrol-move-requested',
      'movement-stepped',
      'movement-completed',
    ]);
    expect(firstTick.eventRecords).toMatchObject([
      {
        type: 'patrol-move-requested',
        patrol: {
          actorId: 'guard',
          placementId: 'guard-placement',
          routeId: 'wall-watch',
          status: 'requested',
          targetKey: '1,0',
          requested: true,
        },
      },
      { type: 'movement-stepped', movement: { actorId: 'guard', tileKey: '1,0' } },
      { type: 'movement-completed', movement: { actorId: 'guard', state: { destinationKey: '1,0' } } },
    ]);

    const secondTick = runGameboardSystems(world, { movement: { steps: 10 }, quests: false });
    expect(secondTick.events.map((event) => event.type)).toEqual([
      'patrol-move-requested',
      'movement-stepped',
      'movement-completed',
    ]);
    expect(findPlacementEntity(world, 'guard-placement')?.get(MovementPathState)?.destinationKey).toBe('2,0');

    const thirdTick = runGameboardSystems(world, { movement: { steps: 10 }, quests: false });
    expect(thirdTick.events.map((event) => event.type)).toEqual(['patrol-completed']);
    expect(thirdTick.eventRecords).toMatchObject([
      {
        type: 'patrol-completed',
        patrol: {
          actorId: 'guard',
          routeId: 'wall-watch',
          status: 'completed',
          currentWaypointIndex: 2,
          roundsCompleted: 1,
        },
      },
    ]);
    expect(findPlacementEntity(world, 'guard-placement')?.get(GameboardPatrolState)?.status).toBe('completed');
    expect(readGameboardPatrolAgents(world)[0]?.placement.tileKey).toBe('2,0');
  });

  it('reports patrol blockers as system events and deactivates the route by default', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'systems-patrol-blocked',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      })
        .setTerrain({ q: 1, r: 0 }, 'water')
        .build()
    );
    spawnGameboardActor(world, {
      id: 'guard-placement',
      actorId: 'guard',
      actorKind: 'npc',
      at: '0,0',
      assetId: 'flag_green',
      kind: 'unit',
    });

    setGameboardPatrolAgent(world, 'guard', {
      route: {
        id: 'blocked-watch',
        waypointKeys: ['0,0', '2,0'],
        loop: false,
      },
      movement: { profile: 'ground' },
    });

    const result = runGameboardSystems(world, { movement: { steps: 10 }, quests: false });
    expect(result.events.map((event) => event.type)).toEqual(['patrol-blocked']);
    expect(result.eventRecords).toMatchObject([
      {
        type: 'patrol-blocked',
        reason: 'No passable path to destination',
        patrol: {
          actorId: 'guard',
          routeId: 'blocked-watch',
          status: 'blocked',
          targetKey: '2,0',
          requested: true,
          reason: 'No passable path to destination',
        },
      },
    ]);
    expect(readGameboardPatrolAgents(world)[0]?.agent.active).toBe(false);
  });

  it('exercises gameboardSystemActions.dispatchCommand + .dispatchActorTargetCommand + .run (PRD E0e)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'systems-actions-coverage',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    const hero = spawnGameboardActor(world, {
      id: 'hero-placement',
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    setGameboardMovementAgent(world, hero, { profile: 'ground' });
    spawnGameboardActor(world, {
      id: 'goblin-placement',
      actorId: 'goblin',
      actorKind: 'npc',
      at: '2,0',
      assetId: 'flag_red',
      kind: 'unit',
      hostile: true,
      team: 'enemies',
    });

    const actions = gameboardSystemActions(world);

    // dispatchCommand: plan a move-to command on the goblin's tile. With no
    // handler registered for the command kind the execution stays in
    // 'handler-required' state, which is still a valid (testable) outcome
    // of the action-bundle wiring.
    const dispatched = actions.dispatchCommand('2,0', { sourceActor: 'hero' });
    expect(dispatched.execution).toBeDefined();
    expect(dispatched.events.length).toBeGreaterThan(0);

    // dispatchActorTargetCommand: pick the nearest hostile target + plan.
    const actorTarget = actions.dispatchActorTargetCommand({
      sourceActor: 'hero',
      approach: 'nearest',
      hostileToSource: true,
    });
    expect(actorTarget.targetCommand).toBeDefined();
    expect(actorTarget.events).toBeDefined();

    // run: tick systems with no inputs; should not throw.
    const tickResult = actions.run({ movement: { steps: 1 } });
    expect(tickResult).toBeDefined();
  });

  it('copyQuestObjective covers targetTile-as-object and plain-fallback branches (E0a)', () => {
    // Use a collision quest with targetTile as a HexCoordinates object so
    // snapshotGameboardSystemEvents exercises the targetTile copy branch in
    // copyQuestObjective (line 892-894 of systems.ts).
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'systems-copy-quest-objective',
        shape: { kind: 'rectangle', width: 2, height: 1 },
      }).build()
    );
    const hero = spawnGameboardActor(world, {
      id: 'copy-hero-placement',
      actorId: 'copy-hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      id: 'copy-npc-placement',
      actorId: 'copy-npc',
      actorKind: 'npc',
      at: '1,0',
      assetId: 'flag_green',
      kind: 'prop',
    });
    spawnGameboardQuest(world, {
      id: 'collision-targetTile-quest',
      objectives: [
        {
          id: 'collision-obj',
          kind: 'collision',
          actor: 'copy-hero',
          targetTile: { q: 1, r: 0 },
          expect: 'can-enter',
        },
      ],
    });
    setGameboardMovementAgent(world, hero, { profile: 'ground', movementBudget: 2 });
    const dispatch = dispatchGameboardInteractionCommand(world, '1,0', { sourceActor: 'copy-hero' });
    const systems = runGameboardSystems(world, { movement: { steps: 5 }, quests: { step: 1 } });
    // The snapshot path calls copyQuestObjective which must copy the targetTile object.
    const snapshot = snapshotGameboardSystemEvents([...dispatch.events, ...systems.events]);
    const questEvent = snapshot.find((e) => e.type === 'quest-advanced' || e.type === 'quest-blocked');
    expect(questEvent).toBeDefined();
  });

  it('snapshotGameboardSystemEvents with no movement covers questRecord undefined + movementRequestRecord undefined branches (E0a)', () => {
    // A command that doesn't involve movement produces events without
    // movement records, exercising the movementRequestRecord(undefined)
    // and questRecord(undefined) guard branches (lines 851-852, 869-870).
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'systems-no-movement',
        shape: { kind: 'rectangle', width: 2, height: 1 },
      }).build()
    );
    spawnGameboardActor(world, {
      id: 'stationary-hero',
      actorId: 'stationary',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      id: 'stationary-target',
      actorId: 'npc-target',
      actorKind: 'npc',
      at: '1,0',
      assetId: 'flag_green',
      kind: 'prop',
      hostile: false,
    });
    // Dispatch a handler-required interaction (no movement involved).
    const dispatch = dispatchGameboardInteractionCommand(world, { actorId: 'npc-target' }, { sourceActor: 'stationary' });
    expect(dispatch.events.some((e) => e.type === 'command-handler-required')).toBe(true);
    // snapshotGameboardSystemEvents must not throw when movement/quest are absent.
    const snapshot = snapshotGameboardSystemEvents(dispatch.events);
    const handlerRequiredRecord = snapshot.find((e) => e.type === 'command-handler-required');
    expect(handlerRequiredRecord).toBeDefined();
    // The record has no movement or quest fields (those helpers return undefined).
    // biome-ignore lint/suspicious/noExplicitAny: snapshot discriminated union
    expect((handlerRequiredRecord as any)?.movement).toBeUndefined();
    // biome-ignore lint/suspicious/noExplicitAny: snapshot discriminated union
    expect((handlerRequiredRecord as any)?.quest).toBeUndefined();
  });
});
