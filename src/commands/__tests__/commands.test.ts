import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../gameboard/index';
import { PlacementState, createGameboardWorld, findPlacementEntity } from '../../koota/index';
import { setGameboardMovementAgent } from '../../movement/index';
import { findGameboardActor, spawnGameboardActor } from '../../actors/index';
import {
  GAMEBOARD_INTERACTION_HANDLER_PRESETS,
  createGameboardInteractionHandlerPreset,
  createMarkTargetActorInteractedHandler,
  createRemoveTargetActorHandler,
  executeGameboardInteractionCommand,
  gameboardCommandActions,
  isGameboardInteractionHandlerPreset,
  planGameboardActorTargetCommand,
  previewGameboardInteractionCommand,
} from '../../commands/index';

describe('gameboard interaction commands', () => {
  it('previews and requests actor-aware movement commands', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'commands-move',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    const player = spawnGameboardActor(world, {
      id: 'hero-placement',
      actorId: 'hero',
      actorKind: 'player',
      team: 'blue',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    setGameboardMovementAgent(world, player, { profile: 'ground', movementBudget: 4 });

    const preview = previewGameboardInteractionCommand(world, '1,0', { sourceActor: 'hero' });
    expect(preview).toMatchObject({
      command: { kind: 'move', tileKey: '1,0', canExecute: true },
      movementBudget: 4,
      canExecute: true,
    });
    expect(
      preview.movementPath?.coordinates.map((coordinates) => `${coordinates.q},${coordinates.r}`)
    ).toEqual(['0,0', '1,0']);

    const execution = executeGameboardInteractionCommand(world, '1,0', { sourceActor: 'hero' });
    expect(execution).toMatchObject({
      status: 'requested-move',
      movement: { state: { status: 'ready', destinationKey: '1,0' } },
    });
    expect(findPlacementEntity(world, 'hero-placement')?.get(PlacementState)?.tileKey).toBe('0,0');
  });

  it('blocks move commands that exceed movement budget', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'commands-range',
        shape: { kind: 'rectangle', width: 4, height: 1 },
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
    setGameboardMovementAgent(world, player, { profile: 'worker', movementBudget: 1 });

    expect(previewGameboardInteractionCommand(world, '3,0', { sourceActor: 'hero' })).toMatchObject(
      {
        canExecute: false,
        reason: 'Path costs 3; movement budget is 1',
      }
    );
    expect(executeGameboardInteractionCommand(world, '3,0', { sourceActor: 'hero' })).toMatchObject(
      {
        status: 'blocked',
        reason: 'Path costs 3; movement budget is 1',
      }
    );
  });

  it('returns handler-required commands for attacks and interactions', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'commands-handlers',
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
      id: 'elder-placement',
      actorId: 'elder',
      actorKind: 'npc',
      team: 'blue',
      at: '1,0',
      assetId: 'flag_green',
      kind: 'prop',
    });
    spawnGameboardActor(world, {
      id: 'raider-placement',
      actorId: 'raider',
      actorKind: 'enemy',
      team: 'red',
      at: '2,0',
      assetId: 'flag_red',
      kind: 'unit',
    });
    const actions = gameboardCommandActions(world);

    expect(actions.execute({ actorId: 'elder' }, { sourceActor: 'hero' })).toMatchObject({
      status: 'requires-game-handler',
      command: { kind: 'interact-actor', actorId: 'elder' },
    });
    expect(
      actions.execute({ placementId: 'raider-placement' }, { sourceActor: 'hero' })
    ).toMatchObject({
      status: 'requires-game-handler',
      command: { kind: 'attack-actor', actorId: 'raider' },
    });
    expect(actions.execute('missing-target', { sourceActor: 'hero' })).toMatchObject({
      status: 'ignored',
      reason: 'No target resolved',
    });
  });

  it('plans actor-target commands without executing host game policy', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'commands-actor-target-command',
        shape: { kind: 'rectangle', width: 4, height: 1 },
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
      at: '2,0',
      assetId: 'flag_red',
      kind: 'unit',
    });

    const plan = planGameboardActorTargetCommand(world, {
      sourceActor: 'hero',
      hostileToSource: true,
      maxPathCost: 2,
    });
    expect(plan).toMatchObject({
      canExecute: true,
      target: {
        actor: { actor: { actorId: 'raider' } },
        reachable: true,
        approach: 'adjacent',
        approachTileKey: '1,0',
      },
      command: {
        kind: 'attack-actor',
        actorId: 'raider',
        canExecute: true,
      },
    });

    const outOfRange = gameboardCommandActions(world).targetCommand({
      sourceActor: 'hero',
      hostileToSource: true,
      targetActorId: 'raider',
      maxPathCost: 0,
    });
    expect(outOfRange).toMatchObject({
      canExecute: false,
      target: { actor: { actor: { actorId: 'raider' } }, reachable: false },
      command: { kind: 'attack-actor', actorId: 'raider', canExecute: true },
      reason: 'Path costs 1; maximum path cost is 0',
    });

    expect(
      planGameboardActorTargetCommand(world, {
        sourceActor: 'hero',
        hostileToSource: true,
        targetActorId: 'raider',
        maxPathCost: 0,
        requireReachable: false,
      })
    ).toMatchObject({
      canExecute: true,
      command: { kind: 'attack-actor', actorId: 'raider' },
    });
    expect(
      planGameboardActorTargetCommand(world, {
        sourceActor: 'hero',
        hostileToSource: true,
        targetActorId: 'missing-raider',
      })
    ).toMatchObject({
      canExecute: false,
      reason: 'No actor target found for missing-raider',
    });
  });

  it('executes opt-in handlers for host-owned attack and interaction effects', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'commands-opt-in-handlers',
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
      id: 'elder-placement',
      actorId: 'elder',
      actorKind: 'npc',
      team: 'blue',
      interactive: true,
      at: '1,0',
      assetId: 'flag_green',
      kind: 'prop',
    });
    spawnGameboardActor(world, {
      id: 'raider-placement',
      actorId: 'raider',
      actorKind: 'enemy',
      team: 'red',
      hostile: true,
      at: '2,0',
      assetId: 'flag_red',
      kind: 'unit',
    });

    expect(
      executeGameboardInteractionCommand(
        world,
        { actorId: 'elder' },
        {
          sourceActor: 'hero',
          handlers: createMarkTargetActorInteractedHandler(),
        }
      )
    ).toMatchObject({
      status: 'handled',
      handler: { handlerId: 'mark-target-interacted', status: 'handled' },
      effects: [
        { type: 'actor-updated', actorId: 'elder', placementId: 'elder-placement', updated: true },
      ],
    });
    expect(findGameboardActor(world, 'elder')?.actor.metadata).toMatchObject({
      interacted: true,
      lastInteractedBy: 'hero',
    });

    expect(
      executeGameboardInteractionCommand(
        world,
        { actorId: 'raider' },
        {
          sourceActor: 'hero',
          handlers: createRemoveTargetActorHandler({ requireHostile: true }),
        }
      )
    ).toMatchObject({
      status: 'handled',
      handler: { handlerId: 'remove-target-actor', status: 'handled' },
      effects: [
        {
          type: 'actor-removed',
          actorId: 'raider',
          placementId: 'raider-placement',
          removed: true,
        },
      ],
    });
    expect(findGameboardActor(world, 'raider')).toBeUndefined();
  });

  it('exposes reusable handler presets for direct game and ECS integrations', () => {
    expect(GAMEBOARD_INTERACTION_HANDLER_PRESETS).toEqual([
      'remove-target-actor',
      'remove-target-placement',
      'mark-target-interacted',
      'default-rpg',
    ]);
    expect(isGameboardInteractionHandlerPreset('default-rpg')).toBe(true);
    expect(isGameboardInteractionHandlerPreset('custom-handler')).toBe(false);

    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'commands-preset-registry',
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
      id: 'elder-placement',
      actorId: 'elder',
      actorKind: 'npc',
      team: 'blue',
      interactive: true,
      at: '1,0',
      assetId: 'flag_green',
      kind: 'prop',
    });
    spawnGameboardActor(world, {
      id: 'raider-placement',
      actorId: 'raider',
      actorKind: 'enemy',
      team: 'red',
      hostile: true,
      at: '2,0',
      assetId: 'flag_red',
      kind: 'unit',
    });

    const handlers = createGameboardInteractionHandlerPreset('default-rpg');
    expect(
      executeGameboardInteractionCommand(
        world,
        { actorId: 'elder' },
        { sourceActor: 'hero', handlers }
      )
    ).toMatchObject({
      status: 'handled',
      handler: { handlerId: 'mark-target-interacted', status: 'handled' },
      effects: [
        { type: 'actor-updated', actorId: 'elder', placementId: 'elder-placement', updated: true },
      ],
    });
    expect(
      executeGameboardInteractionCommand(
        world,
        { actorId: 'raider' },
        { sourceActor: 'hero', handlers }
      )
    ).toMatchObject({
      status: 'handled',
      handler: { handlerId: 'remove-target-actor', status: 'handled' },
      effects: [
        {
          type: 'actor-removed',
          actorId: 'raider',
          placementId: 'raider-placement',
          removed: true,
        },
      ],
    });
    expect(findGameboardActor(world, 'elder')?.actor.metadata).toMatchObject({
      interacted: true,
      lastInteractedBy: 'hero',
    });
    expect(findGameboardActor(world, 'raider')).toBeUndefined();
  });

  it('exposes plan + preview + targetCommand on the gameboardCommandActions bundle (PRD E0d)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'commands-actions-coverage',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    spawnGameboardActor(world, {
      id: 'hero-placement',
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      id: 'elder-placement',
      actorId: 'elder',
      actorKind: 'npc',
      at: '1,0',
      assetId: 'flag_yellow',
      kind: 'unit',
      interactive: true,
    });

    const actions = gameboardCommandActions(world);

    // plan: tile target.
    const planned = actions.plan('1,0', { sourceActor: 'hero' });
    expect(planned).toBeDefined();
    expect(planned?.kind).toBeDefined();

    // preview: same target, no mutation.
    const previewed = actions.preview('1,0', { sourceActor: 'hero' });
    expect(previewed).toBeDefined();

    // targetCommand: actor-aware targeting.
    const targetPlan = actions.targetCommand({
      sourceActor: 'hero',
      targeting: { interactiveOnly: true, approach: 'nearest' },
    });
    expect(targetPlan).toBeDefined();
  });
});
