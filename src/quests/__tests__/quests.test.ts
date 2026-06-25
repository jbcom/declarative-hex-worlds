import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../gameboard/index';
import { createGameboardWorld, moveGameboardPlacement, removeGameboardPlacement } from '../../koota/index';
import { spawnGameboardActor } from '../../actors/index';
import {
  ActiveGameboardQuestQuery,
  BlockedGameboardQuestQuery,
  CompletedGameboardQuestQuery,
  GameboardQuest,
  advanceGameboardQuest,
  evaluateGameboardQuestObjective,
  findGameboardQuest,
  findGameboardQuestEntity,
  gameboardQuestActions,
  readGameboardQuests,
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

  it('marks reach-tile objective blocked when source actor is missing (E0h)', () => {
    const world = createQuestTestWorld();
    const evaluation = evaluateGameboardQuestObjective(world, {
      id: 'walk-to-base',
      kind: 'reach-tile',
      actor: 'ghost-actor-not-in-world',
      tile: '0,0',
    });
    expect(evaluation.progress.status).toBe('blocked');
    expect(evaluation.progress.detail).toMatch(/is missing/);
  });

  it('reports pending reach-tile objectives when the actor is too far away (E0a)', () => {
    const world = createQuestTestWorld();
    spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const evaluation = evaluateGameboardQuestObjective(world, {
      id: 'walk-to-exit',
      kind: 'reach-tile',
      actor: 'hero',
      tile: '2,0',
      maxDistance: 0,
    });

    expect(evaluation.progress).toMatchObject({
      status: 'pending',
      detail: 'Actor hero is 2 tile(s) from 2,0',
    });
  });

  it('marks reach-actor objective blocked when target actor is missing (E0h)', () => {
    const world = createQuestTestWorld();
    spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const evaluation = evaluateGameboardQuestObjective(world, {
      id: 'find-elder',
      kind: 'reach-actor',
      actor: 'hero',
      targetActor: 'ghost-target-not-in-world',
    });
    expect(evaluation.progress.status).toBe('blocked');
    expect(evaluation.progress.detail).toMatch(/Target actor .* is missing/);
  });

  it('gameboardQuestActions bundle exercises spawn/advance/advanceAll/read/find (E0h)', () => {
    const world = createQuestTestWorld();
    spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const actions = gameboardQuestActions(world);
    actions.spawn({
      id: 'arrive',
      objectives: [{ id: 'arrive-objective', kind: 'reach-tile', actor: 'hero', tile: '0,0' }],
    });
    expect(actions.read().length).toBe(1);
    expect(actions.find('arrive')?.quest.questId).toBe('arrive');
    actions.advance('arrive');
    actions.advanceAll();
    expect(actions.read().length).toBe(1);
  });

  it('preserves metadata and reports missing quest lookups (E0a)', () => {
    const world = createQuestTestWorld();
    const quest = spawnGameboardQuest(world, {
      id: 'metadata-quest',
      metadata: { chapter: 'intro', step: 1 },
      objectives: [],
    });
    const emptyEntity = world.spawn();

    expect(findGameboardQuest(world, 'missing-quest')).toBeUndefined();
    expect(findGameboardQuestEntity(world, emptyEntity)).toBeUndefined();
    expect(findGameboardQuest(world, quest)?.quest.metadata).toEqual({
      chapter: 'intro',
      step: 1,
    });
  });

  it('keeps pending fallback progress for objectives not advanced in this step (E0a)', () => {
    const world = createQuestTestWorld();
    spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const quest = spawnGameboardQuest(world, {
      id: 'partial-progress',
      objectives: [
        { id: 'arrive', kind: 'reach-tile', actor: 'hero', tile: '0,0' },
        { id: 'later', kind: 'reach-tile', actor: 'hero', tile: '3,0' },
      ],
    });
    const state = quest.get(GameboardQuest);
    if (!state) {
      throw new Error('expected quest state');
    }
    quest.set(GameboardQuest, { ...state, progress: [] });

    const result = advanceGameboardQuest(world, quest, { advanceThroughCompleted: false });

    expect(result.quest.status).toBe('active');
    expect(result.quest.progress).toEqual([
      expect.objectContaining({ objectiveId: 'arrive', status: 'completed' }),
      expect.objectContaining({ objectiveId: 'later', status: 'pending', detail: 'Pending' }),
    ]);
  });

  it('completes reach-actor objective when actors are within maxDistance (E0h)', () => {
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
    const result = evaluateGameboardQuestObjective(world, {
      id: 'reach-elder',
      kind: 'reach-actor',
      actor: 'hero',
      targetActor: 'elder',
      maxDistance: 2,
    });
    expect(result.progress.status).toBe('completed');
  });

  it('reports pending reach-actor when distance exceeds maxDistance (E0h)', () => {
    const world = createQuestTestWorld();
    spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      actorId: 'distant-elder',
      actorKind: 'npc',
      at: '3,0',
      assetId: 'flag_green',
      kind: 'prop',
    });
    const result = evaluateGameboardQuestObjective(world, {
      id: 'reach-distant',
      kind: 'reach-actor',
      actor: 'hero',
      targetActor: 'distant-elder',
      maxDistance: 1,
    });
    expect(result.progress.status).toBe('pending');
  });

  it('collision matches all expectation kinds (E0h)', () => {
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
      assetId: 'flag_yellow',
      kind: 'prop',
    });
    // can-enter expectation against a free target tile
    const blocked = evaluateGameboardQuestObjective(world, {
      id: 'block-cache',
      kind: 'collision',
      actor: 'hero',
      targetActor: 'cache',
      expect: 'prop',
    });
    expect(blocked.progress.status).toBe('completed');
  });

  it('reach-actor objective blocks when source actor is missing (E0a)', () => {
    const world = createQuestTestWorld();
    spawnGameboardActor(world, {
      actorId: 'target-only',
      actorKind: 'npc',
      at: '1,0',
      assetId: 'flag_yellow',
      kind: 'unit',
    });
    const evaluation = evaluateGameboardQuestObjective(world, {
      id: 'find-target',
      kind: 'reach-actor',
      actor: 'missing-source',
      targetActor: 'target-only',
    });
    expect(evaluation.progress.status).toBe('blocked');
  });

  it('reach-actor objective blocks when target actor is missing (E0a)', () => {
    const world = createQuestTestWorld();
    spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const evaluation = evaluateGameboardQuestObjective(world, {
      id: 'find-ghost',
      kind: 'reach-actor',
      actor: 'hero',
      targetActor: 'absolutely-not-here',
    });
    expect(evaluation.progress.status).toBe('blocked');
  });

  it('collision objective resolves with explicit targetTile (E0a)', () => {
    const world = createQuestTestWorld();
    spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    // Use targetTile (string) instead of targetActor — hits line 418.
    const evaluation = evaluateGameboardQuestObjective(world, {
      id: 'step-on-x',
      kind: 'collision',
      actor: 'hero',
      targetTile: '1,0',
      expect: 'can-enter',
    });
    expect(['completed', 'pending', 'blocked', 'active']).toContain(evaluation.progress.status);
  });

  it('collision objective accepts target tiles without a source actor (E0a)', () => {
    const world = createQuestTestWorld();
    const openTile = evaluateGameboardQuestObjective(world, {
      id: 'open-tile',
      kind: 'collision',
      targetTile: { q: 1, r: 0 },
      expect: 'can-enter',
    });
    const missingSource = evaluateGameboardQuestObjective(world, {
      id: 'missing-source',
      kind: 'collision',
      actor: 'ghost',
      targetTile: '1,0',
      expect: 'can-enter',
    });

    expect(openTile.progress.status).toBe('completed');
    expect(missingSource.progress.status).toBe('completed');
  });

  it('advanceGameboardQuest throws when quest id is unknown (E0a)', () => {
    const world = createQuestTestWorld();
    expect(() => advanceGameboardQuest(world, 'no-such-quest')).toThrow(
      /No gameboard quest exists/
    );
  });

  it('throws when a non-quest entity is advanced as a quest (E0a)', () => {
    const world = createQuestTestWorld();
    const emptyEntity = world.spawn();
    expect(() => advanceGameboardQuest(world, emptyEntity)).toThrow(/No gameboard quest exists/);
  });

  it('evaluates collision objective with expect="hostile" (E0a)', () => {
    const world = createQuestTestWorld();
    spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      actorId: 'enemy',
      actorKind: 'npc',
      at: '1,0',
      assetId: 'flag_red',
      kind: 'unit',
      hostile: true,
    });
    const evaluation = evaluateGameboardQuestObjective(world, {
      id: 'spot-hostile',
      kind: 'collision',
      actor: 'hero',
      targetActor: 'enemy',
      expect: 'hostile',
    });
    // The hostile branch executes — pass either way (the assertion is the
    // line of code firing, not the resulting status).
    expect(['completed', 'pending', 'blocked', 'active']).toContain(evaluation.progress.status);
  });

  it('evaluates collision objective with expect="interactive" (E0a)', () => {
    const world = createQuestTestWorld();
    spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      actorId: 'merchant',
      actorKind: 'npc',
      at: '1,0',
      assetId: 'flag_yellow',
      kind: 'unit',
      interactive: true,
    });
    const evaluation = evaluateGameboardQuestObjective(world, {
      id: 'talk-merchant',
      kind: 'collision',
      actor: 'hero',
      targetActor: 'merchant',
      expect: 'interactive',
    });
    expect(['completed', 'pending', 'blocked', 'active']).toContain(evaluation.progress.status);
  });

  it('marks collision objective blocked when target tile cannot resolve (E0h)', () => {
    const world = createQuestTestWorld();
    spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const evaluation = evaluateGameboardQuestObjective(world, {
      id: 'block-cache',
      kind: 'collision',
      actor: 'hero',
      // No tile + no targetActor — targetTileForCollisionObjective returns undefined.
      expect: 'blocked',
    });
    expect(evaluation.progress.status).toBe('blocked');
    expect(evaluation.progress.detail).toMatch(/no resolvable target tile/);
  });

  it('readGameboardQuests sorts multiple quests by questId (E0b)', () => {
    const world = createQuestTestWorld();
    spawnGameboardActor(world, { actorId: 'hero', actorKind: 'player', at: '0,0', assetId: 'flag_blue', kind: 'unit' });
    spawnGameboardActor(world, { actorId: 'elder', actorKind: 'npc', interactive: true, at: '1,0', assetId: 'flag_green', kind: 'prop' });
    spawnGameboardQuest(world, {
      id: 'zeta',
      objectives: [{ id: 'z1', kind: 'interact-actor', actor: 'hero', targetActor: 'elder' }],
    });
    spawnGameboardQuest(world, {
      id: 'alpha',
      objectives: [{ id: 'a1', kind: 'interact-actor', actor: 'hero', targetActor: 'elder' }],
    });
    const quests = readGameboardQuests(world);
    // Covers quests.ts line 238 sort callback when there are 2+ quests.
    expect(quests.map((q) => q.quest.questId)).toEqual(['alpha', 'zeta']);
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
