import { describe, expect, it } from 'vitest';
import {
  inspectGameboardInteractionTarget,
  planGameboardInteractionCommand,
  readGameboardPlacements,
  summarizeGameboardPlan,
} from '@jbcom/medieval-hexagon-gameboard';
import {
  SIMPLE_RPG_RANDOM_SEED,
  assertSimpleRpgGameValid,
  classifySimpleRpgPlacement,
  createFixedSimpleRpgGame,
  createSeededSimpleRpgGame,
  runSimpleRpgQuestLine,
} from '../simple-rpg/simple-rpg';

describe('SimpleRPG public API integration fixture', () => {
  it('completes a fixed golden quest map while differentiating props and enemies', () => {
    const game = createFixedSimpleRpgGame();
    assertSimpleRpgGameValid(game);
    const player = game.actors.get(game.quest.playerId);
    const prop = game.actors.get(game.quest.propId);
    const enemy = game.actors.get(game.quest.enemyId);
    const planSummary = summarizeGameboardPlan(game.initialPlan, { topAssetLimit: 100 });

    expect(planSummary.warningCount).toBe(0);
    expect(planSummary.tileTextureSetCounts.fall).toBe(1);
    expect(planSummary.tileElevationCounts['1']).toBeGreaterThan(0);
    expect(planSummary.requiresExtraPlacementCount).toBeGreaterThanOrEqual(7);
    expect(planSummary.extraAssetIds).toEqual(expect.arrayContaining(['hex_transition']));
    expect(planSummary.placementFeatureCounts).toMatchObject({
      bridge: 1,
      'construction-site': 1,
      'elevation-ramp': 1,
      forest: 1,
      fortification: 1,
      harbor: 1,
      hill: 1,
      'mountain-stack': 1,
      nature: 1,
      'neutral-structure': 1,
      prop: 2,
      'prop-cluster': 5,
      scatter: 2,
      settlement: 2,
      'siege-projectile': 1,
      transition: 1,
      unit: 6,
    });

    expect(
      inspectGameboardInteractionTarget(
        game.world,
        { placementId: prop?.placementId },
        { sourceActor: player?.placementId }
      )
    ).toMatchObject({ kind: 'actor', intent: 'interact', canEnter: true });
    expect(
      inspectGameboardInteractionTarget(
        game.world,
        { placementId: enemy?.placementId },
        { sourceActor: player?.placementId }
      )
    ).toMatchObject({ kind: 'actor', intent: 'attack', canEnter: false });
    expect(
      planGameboardInteractionCommand(
        game.world,
        { placementId: prop?.placementId },
        { sourceActor: player?.placementId }
      )
    ).toMatchObject({ kind: 'interact-actor', actorId: game.quest.propId, canExecute: true });
    expect(
      planGameboardInteractionCommand(
        game.world,
        { placementId: enemy?.placementId },
        { sourceActor: player?.placementId }
      )
    ).toMatchObject({ kind: 'attack-actor', actorId: game.quest.enemyId, canExecute: true });

    const result = runSimpleRpgQuestLine(game);
    const playerPlacement = readGameboardPlacements(game.world).find(
      (placement) => placement.id === game.actors.get(game.quest.playerId)?.placementId
    );

    expect(result.completed).toBe(true);
    expect(result.finalTileKey).toBe(game.quest.finalTileKey);
    expect(result.actorTargetCommand).toMatchObject({
      actorId: game.quest.enemyId,
      commandKind: 'attack-actor',
      status: 'requires-game-handler',
      reachable: true,
    });
    expect(result.traversedKeys).toContain('3,2');
    expect(result.traversedKeys).toContain('5,3');
    expect(result.collisionChecks).toEqual([
      expect.objectContaining({ id: 'registered-prop-passable', status: 'completed' }),
      expect.objectContaining({ id: 'registered-enemy-blocks', status: 'completed' }),
    ]);
    expect(
      classifySimpleRpgPlacement(game, game.actors.get(game.quest.propId)?.placementId ?? '')
    ).toBe('prop');
    expect(
      classifySimpleRpgPlacement(game, game.actors.get(game.quest.enemyId)?.placementId ?? '')
    ).toBeUndefined();
    expect(playerPlacement?.tileKey).toBe('5,3');
  });

  it('completes a deterministic seeded quest map for a locked seed', () => {
    const game = createSeededSimpleRpgGame(SIMPLE_RPG_RANDOM_SEED);
    assertSimpleRpgGameValid(game);

    const before = {
      player: game.actors.get(game.quest.playerId)?.tileKey,
      final: game.quest.finalTileKey,
      enemy: game.actors.get(game.quest.enemyId)?.tileKey,
    };
    const result = runSimpleRpgQuestLine(game);

    expect(before).toEqual({
      player: '2,2',
      final: '8,3',
      enemy: '5,5',
    });
    expect(result.completed).toBe(true);
    expect(result.finalTileKey).toBe(before.final);
    expect(result.actorTargetCommand).toMatchObject({
      actorId: game.quest.enemyId,
      commandKind: 'attack-actor',
      status: 'requires-game-handler',
      reachable: true,
    });
    expect(new Set(result.traversedKeys).size).toBeGreaterThan(4);
    expect(
      result.projectedPlan.placements.some((placement) => placement.metadata.game === 'SimpleRPG')
    ).toBe(true);
    const seededPiecePlacements = result.projectedPlan.placements.filter(
      (placement) =>
        placement.metadata.game === 'SimpleRPG' && typeof placement.metadata.pieceId === 'string'
    );
    expect(seededPiecePlacements).toHaveLength(8);
    expect(seededPiecePlacements.map((placement) => placement.metadata.pieceId)).toEqual(
      expect.arrayContaining([
        'simple_rpg_pine_cluster',
        'simple_rpg_supply_scatter',
        'simple_rpg_waystone',
      ])
    );
    expect(seededPiecePlacements.every((placement) => placement.requiresExtra === false)).toBe(
      true
    );
  });
});
