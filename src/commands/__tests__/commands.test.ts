import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../gameboard/index';
import { PlacementState, createGameboardWorld, findPlacementEntity } from '../../koota/index';
import { setGameboardMovementAgent } from '../../movement/index';
import { findGameboardActor, spawnGameboardActor } from '../../actors/index';
import type { World } from 'koota';
import type { GameboardInteractionCommand } from '../../actors/index';
import {
  GAMEBOARD_INTERACTION_HANDLER_PRESETS,
  type GameboardInteractionCommandPreview,
  type GameboardInteractionHandlerContext,
  createGameboardInteractionHandlerPreset,
  createMarkTargetActorInteractedHandler,
  createRemoveTargetActorHandler,
  createRemoveTargetPlacementHandler,
  executeGameboardInteractionCommand,
  gameboardCommandActions,
  isGameboardInteractionHandlerPreset,
  planGameboardActorTargetCommand,
  previewGameboardInteractionCommand,
} from '../../commands/index';

/**
 * Build a typed minimal handler context — exercises the createRemove*Handler
 * factories' decision logic without standing up a full Koota world. The
 * handler bodies only read `command` (kind + target) and write through `world`
 * via removeGameboardPlacement; for the not-handled and blocked branches
 * targeted by these E0b tests, `world` is never touched. We type-cast the
 * minimal record at function boundaries with empty-object `as` instead of
 * `any`, so each call site stays type-checked.
 */
function stubHandlerContext(
  command: Pick<GameboardInteractionCommand, 'kind' | 'target'>
): GameboardInteractionHandlerContext {
  return {
    world: {} as unknown as World,
    preview: {} as unknown as GameboardInteractionCommandPreview,
    command: command as GameboardInteractionCommand,
  };
}

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

  it('blocks preplanned move commands without a target tile (E0a)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'commands-missing-tile-key',
        shape: { kind: 'rectangle', width: 2, height: 1 },
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
    const source = findGameboardActor(world, 'hero');
    if (!source) {
      throw new Error('expected hero actor fixture');
    }

    expect(
      previewGameboardInteractionCommand(world, {
        kind: 'move',
        intent: 'move',
        target: { kind: 'tile' } as never,
        source,
        canExecute: true,
      })
    ).toMatchObject({
      canExecute: false,
      reason: 'No target tile',
    });
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
      interactive: true,
      approach: 'nearest',
    });
    expect(targetPlan).toBeDefined();
  });
});

describe('createRemoveTargetPlacementHandler factory (PRD E0a)', () => {
  it('returns a callable handler with the configured handlerId', () => {
    // The factory branch (commands.ts ~526) is uncovered. Direct
    // construction + identity-of-shape assertion is enough to exercise it
    // without wiring a full command pipeline.
    const handler = createRemoveTargetPlacementHandler({ handlerId: 'custom-id' });
    expect(typeof handler).toBe('function');
  });

  it('returns blocked when no target placement is resolved (E0b)', () => {
    const handler = createRemoveTargetPlacementHandler();
    const result = handler(
      stubHandlerContext({ kind: 'interact-placement', target: { kind: 'tile' } as never })
    );
    expect(result).toMatchObject({ status: 'blocked', reason: 'No target placement for command' });
  });

  it('returns undefined for unaccepted command kinds (E0b)', () => {
    const handler = createRemoveTargetPlacementHandler();
    const result = handler(
      stubHandlerContext({ kind: 'attack-actor', target: { kind: 'placement' } as never })
    );
    expect(result).toBeUndefined();
  });

  it('returns undefined for actor-target placements without includeActorPlacements (E0b)', () => {
    const handler = createRemoveTargetPlacementHandler();
    const result = handler(
      stubHandlerContext({
        kind: 'interact-placement',
        target: { kind: 'actor', actor: { entity: 'e1' }, placement: { id: 'p1' } } as never,
      })
    );
    expect(result).toBeUndefined();
  });
});

describe('createRemoveTargetActorHandler factory (PRD E0a)', () => {
  it('blocks accepted commands without an actor target', () => {
    const handler = createRemoveTargetActorHandler();
    const result = handler(
      stubHandlerContext({ kind: 'attack-actor', target: { kind: 'tile' } as never })
    );
    expect(result).toMatchObject({ status: 'blocked', reason: 'No target actor for command' });
  });

  it('blocks non-hostile targets when hostile removal is required', () => {
    const handler = createRemoveTargetActorHandler({ requireHostile: true });
    const result = handler(
      stubHandlerContext({
        kind: 'attack-actor',
        target: {
          kind: 'actor',
          actor: {
            actor: { actorId: 'elder', hostile: false },
            placement: { id: 'elder-placement' },
            entity: 'elder-placement',
          },
        } as never,
      })
    );
    expect(result).toMatchObject({
      status: 'blocked',
      reason: 'Target actor elder is not hostile',
    });
  });

  it('blocks source-aware non-hostile targets when hostile removal is required', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'commands-source-aware-hostility',
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
      id: 'elder-placement',
      actorId: 'elder',
      actorKind: 'npc',
      team: 'blue',
      at: '1,0',
      assetId: 'flag_green',
      kind: 'unit',
    });
    const source = findGameboardActor(world, 'hero');
    const target = findGameboardActor(world, 'elder');
    if (!source || !target) {
      throw new Error('expected source and target actor fixtures');
    }

    const handler = createRemoveTargetActorHandler({ requireHostile: true });
    const result = handler(
      stubHandlerContext({
        kind: 'attack-actor',
        source,
        target: {
          kind: 'actor',
          actor: target,
        } as never,
      } as never)
    );
    expect(result).toMatchObject({
      status: 'blocked',
      reason: 'Target actor elder is not hostile',
    });
  });
});

describe('createMarkTargetActorInteractedHandler factory (PRD E0a)', () => {
  it('returns undefined for unaccepted command kinds', () => {
    const handler = createMarkTargetActorInteractedHandler();
    const result = handler(
      stubHandlerContext({
        kind: 'attack-actor',
        target: { kind: 'actor', actor: { actorId: 'elder' } } as never,
      })
    );
    expect(result).toBeUndefined();
  });

  it('blocks accepted commands without an actor target', () => {
    const handler = createMarkTargetActorInteractedHandler();
    const result = handler(
      stubHandlerContext({ kind: 'interact-actor', target: { kind: 'tile' } as never })
    );
    expect(result).toMatchObject({ status: 'blocked', reason: 'No target actor for command' });
  });
});

describe('commandHandlerMutations placement-updated mapping (PRD E0a)', () => {
  it('maps placement-updated effects from a host-supplied handler', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'cmd-placement-updated',
        shape: { kind: 'rectangle', width: 2, height: 1 },
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
      id: 'merchant-placement',
      actorId: 'merchant',
      actorKind: 'npc',
      interactive: true,
      at: '1,0',
      assetId: 'flag_yellow',
      kind: 'unit',
    });

    // Custom handler that emits a `placement-updated` effect — exercises
    // engine.ts commandHandlerMutations switch-arm 'placement-updated'
    // (lines 491-496).
    // biome-ignore lint/suspicious/noExplicitAny: minimal handler shape
    const handler: any = () => ({
      handlerId: 'manual-placement-mutator',
      status: 'handled' as const,
      effects: [
        {
          type: 'placement-updated' as const,
          placementId: 'merchant-placement',
          updated: true,
          reason: 'test',
        },
      ],
    });
    const result = executeGameboardInteractionCommand(
      world,
      { actorId: 'merchant' },
      { sourceActor: 'hero', handlers: handler }
    );
    expect(result.effects?.some((effect) => effect.type === 'placement-updated')).toBe(true);
  });
});
