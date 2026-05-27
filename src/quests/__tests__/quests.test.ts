import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../gameboard/index';
import { createGameboardWorld, moveGameboardPlacement, removeGameboardPlacement } from '../../koota/index';
import { spawnGameboardActor } from '../../actors/index';
import {
  ActiveGameboardQuestQuery,
  BlockedGameboardQuestQuery,
  CompletedGameboardQuestQuery,
  advanceGameboardQuest,
  evaluateGameboardQuestObjective,
  gameboardQuestActions,
  spawnGameboardQuest,
  type GameboardQuestDefinition,
} from '../../quests/index';

describe('gameboard quests', () => {
  it('advances collision, defeat, and reach objectives against public actor state', () => {
    const world = createQuestTestWorld();
    const player = spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      team: 'blue',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      actorId: 'cache',
      actorKind: 'prop',
      at: '1,0',
      assetId: 'crate_A_small',
      kind: 'prop',
    });
    const enemy = spawnGameboardActor(world, {
      actorId: 'raider',
      actorKind: 'enemy',
      team: 'red',
      at: '2,0',
      assetId: 'flag_red',
      kind: 'prop',
    });
    spawnGameboardActor(world, {
      actorId: 'elder',
      actorKind: 'npc',
      team: 'blue',
      at: '3,0',
      assetId: 'flag_green',
      kind: 'prop',
    });

    const quest = spawnGameboardQuest(world, {
      id: 'intro',
      title: 'Intro',
      objectives: [
        { id: 'prop-passable', kind: 'collision', actor: 'hero', targetActor: 'cache', expect: 'can-enter' },
        { id: 'enemy-blocks', kind: 'collision', actor: 'hero', targetActor: 'raider', expect: 'blocked' },
        { id: 'defeat-raider', kind: 'defeat-actor', targetActor: 'raider' },
        { id: 'speak-elder', kind: 'reach-actor', actor: 'hero', targetActor: 'elder' },
      ],
    });

    const blockedAtDefeat = advanceGameboardQuest(world, quest);

    expect(blockedAtDefeat.quest.status).toBe('active');
    expect(blockedAtDefeat.quest.activeObjectiveIndex).toBe(2);
    expect(blockedAtDefeat.quest.progress.map((progress) => progress.status)).toEqual([
      'completed',
      'completed',
      'pending',
      'pending',
    ]);
    expect(world.query(ActiveGameboardQuestQuery)).toHaveLength(1);

    removeGameboardPlacement(world, enemy);
    const waitingAtNpc = advanceGameboardQuest(world, 'intro');
    expect(waitingAtNpc.quest.activeObjectiveIndex).toBe(3);
    expect(waitingAtNpc.quest.status).toBe('active');

    moveGameboardPlacement(world, player, '3,0');
    const completed = advanceGameboardQuest(world, 'intro');

    expect(completed.quest.status).toBe('completed');
    expect(completed.quest.progress.every((progress) => progress.status === 'completed')).toBe(true);
    expect(world.query(CompletedGameboardQuestQuery)).toHaveLength(1);
    expect(world.query(ActiveGameboardQuestQuery)).toHaveLength(0);
  });

  it('can surface blocked objective expectations for game UI', () => {
    const world = createQuestTestWorld();
    spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      actorId: 'cache',
      actorKind: 'prop',
      at: '1,0',
      assetId: 'crate_A_small',
      kind: 'prop',
    });
    const quest = spawnGameboardQuest(world, {
      id: 'blocked-expectation',
      objectives: [{ id: 'cache-should-block', kind: 'collision', actor: 'hero', targetActor: 'cache', expect: 'blocked' }],
    });
    const result = advanceGameboardQuest(world, quest);

    expect(result.quest.status).toBe('blocked');
    expect(result.quest.progress[0]).toMatchObject({
      objectiveId: 'cache-should-block',
      status: 'blocked',
    });
    expect(world.query(BlockedGameboardQuestQuery)).toHaveLength(1);
  });

  it('evaluates interaction objectives and exposes an action bundle', () => {
    const world = createQuestTestWorld();
    spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      actorId: 'elder',
      actorKind: 'npc',
      at: '1,0',
      assetId: 'flag_green',
      kind: 'prop',
    });

    expect(
      evaluateGameboardQuestObjective(world, {
        id: 'talk',
        kind: 'interact-actor',
        actor: 'hero',
        targetActor: 'elder',
      }).progress.status
    ).toBe('completed');

    const actions = gameboardQuestActions(world);
    const quest = actions.spawn(interactionQuest());
    expect(actions.read()).toHaveLength(1);
    expect(actions.advance(quest).quest.status).toBe('completed');
    expect(actions.find('interaction')?.quest.questId).toBe('interaction');
  });
});

function createQuestTestWorld() {
  return createGameboardWorld(
    createGameboardBuilder({
      seed: 'quest-test',
      shape: { kind: 'rectangle', width: 4, height: 1 },
    }).build()
  );
}

function interactionQuest(): GameboardQuestDefinition {
  return {
    id: 'interaction',
    objectives: [
      {
        id: 'talk',
        kind: 'interact-actor',
        actor: 'hero',
        targetActor: 'elder',
      },
    ],
  };
}
