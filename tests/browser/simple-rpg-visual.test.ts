import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import simpleRpgScenario from '../../examples/simple-rpg-scenario.json';
import simpleRpgSimulationScript from '../../examples/simple-rpg-simulation.script.json';
import {
  advanceGameboardQuest,
  createGameboardWorldFromScenario,
  createGameboardScenarioSimulationReport,
  projectWorldToGameboardPlan,
  runGameboardScenarioSimulationScript,
  type GameboardScenario,
  type GameboardScenarioSimulationScript,
} from '../../src';
import {
  SIMPLE_RPG_RANDOM_SEED,
  assertSimpleRpgGameValid,
  createFixedSimpleRpgGame,
  createSeededSimpleRpgGame,
  runSimpleRpgQuestLine,
} from '../simple-rpg/simple-rpg';
import { assertCanvasHasRenderableContent, renderGameboardPlan } from './rendering';

describe('SimpleRPG browser integration', () => {
  it('captures the fixed golden quest map after public API gameplay completion', async () => {
    await page.viewport(1500, 950);
    const game = createFixedSimpleRpgGame();
    assertSimpleRpgGameValid(game);
    const result = runSimpleRpgQuestLine(game);

    expect(result.completed).toBe(true);
    expect(result.collisionChecks.map((check) => check.status)).toEqual(['completed', 'completed']);

    const canvas = await renderGameboardPlan(result.projectedPlan, {
      title: 'simple-rpg-fixed-completed',
      width: 1450,
      height: 900,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/simple-rpg-fixed-completed.png',
    });
    expect(screenshot).toContain('simple-rpg-fixed-completed.png');
  });

  it('captures the locked seeded quest map after public API gameplay completion', async () => {
    await page.viewport(1500, 950);
    const game = createSeededSimpleRpgGame(SIMPLE_RPG_RANDOM_SEED);
    assertSimpleRpgGameValid(game);
    const result = runSimpleRpgQuestLine(game);

    expect(result.completed).toBe(true);
    expect(result.finalTileKey).toBe('8,3');
    expect(result.traversedKeys.length).toBeGreaterThan(4);
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

    const canvas = await renderGameboardPlan(result.projectedPlan, {
      title: 'simple-rpg-seeded-completed',
      width: 1450,
      height: 900,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/simple-rpg-seeded-completed.png',
    });
    expect(screenshot).toContain('simple-rpg-seeded-completed.png');
  });

  it('captures the packaged JSON scenario after public API instantiation', async () => {
    await page.viewport(1400, 900);
    const runtime = createGameboardWorldFromScenario(simpleRpgScenario as GameboardScenario);
    const quest = advanceGameboardQuest(
      runtime.world,
      runtime.questEntities['docs-simple-rpg-scenario:intro']
    );

    expect(quest.quest.status).toBe('active');
    expect(quest.quest.objectives[quest.quest.activeObjectiveIndex]?.id).toBe('defeat-bandit');
    expect(quest.quest.progress.slice(0, 2).map((progress) => progress.status)).toEqual([
      'completed',
      'completed',
    ]);
    expect(runtime.actors.map((actor) => actor.actor.actorId)).toEqual([
      'bandit',
      'elder',
      'player',
    ]);

    const canvas = await renderGameboardPlan(projectWorldToGameboardPlan(runtime.world), {
      title: 'simple-rpg-packaged-scenario',
      width: 1350,
      height: 850,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/simple-rpg-packaged-scenario.png',
    });
    expect(screenshot).toContain('simple-rpg-packaged-scenario.png');
  });

  it('captures the packaged simulation report final plan after expectation-checked playback', async () => {
    await page.viewport(1400, 900);
    const report = createGameboardScenarioSimulationReport(
      runGameboardScenarioSimulationScript(
        simpleRpgScenario as GameboardScenario,
        simpleRpgSimulationScript as GameboardScenarioSimulationScript
      ),
      (simpleRpgSimulationScript as GameboardScenarioSimulationScript).expectations
    );

    expect(report.success).toBe(true);
    expect(report.expectationFailures).toEqual([]);
    expect(report.eventRecords.map((event) => event.type)).toEqual([
      'patrol-move-requested',
      'movement-stepped',
      'movement-completed',
      'quest-advanced',
      'command-handled',
      'quest-advanced',
      'movement-requested',
      'movement-stepped',
      'movement-completed',
      'quest-advanced',
      'command-handled',
      'quest-advanced',
      'quest-completed',
    ]);
    expect(report.patrols).toEqual([
      expect.objectContaining({
        stepId: 'run-bandit-patrol',
        eventType: 'patrol-move-requested',
        patrol: expect.objectContaining({
          actorId: 'bandit',
          routeId: 'bandit-watch',
          targetKey: '4,1',
        }),
      }),
    ]);
    expect(report.commands).toEqual([
      expect.objectContaining({
        stepId: 'target-bandit',
        eventType: 'command-handled',
        command: expect.objectContaining({
          kind: 'attack-actor',
          status: 'handled',
          handlerId: 'simple-rpg:defeat-target',
          effectTypes: ['actor-removed'],
        }),
      }),
      expect.objectContaining({
        stepId: 'walk-to-elder',
        eventType: 'movement-requested',
        command: expect.objectContaining({ kind: 'move', status: 'requested-move' }),
      }),
      expect.objectContaining({
        stepId: 'greet-elder',
        eventType: 'command-handled',
        command: expect.objectContaining({
          kind: 'interact-actor',
          status: 'handled',
          handlerId: 'simple-rpg:greet-actor',
          effectTypes: ['actor-updated'],
        }),
      }),
    ]);
    expect(report.movements).toEqual([
      expect.objectContaining({
        stepId: 'run-bandit-patrol',
        eventType: 'movement-stepped',
        movement: expect.objectContaining({ actorId: 'bandit', tileKey: '4,1' }),
      }),
      expect.objectContaining({
        stepId: 'run-bandit-patrol',
        eventType: 'movement-completed',
        movement: expect.objectContaining({ actorId: 'bandit', tileKey: '4,1' }),
      }),
      expect.objectContaining({
        stepId: 'walk-to-elder',
        eventType: 'movement-requested',
        movement: expect.objectContaining({ actorId: 'player' }),
      }),
      expect.objectContaining({
        stepId: 'walk-to-elder',
        eventType: 'movement-stepped',
        movement: expect.objectContaining({ actorId: 'player' }),
      }),
      expect.objectContaining({
        stepId: 'walk-to-elder',
        eventType: 'movement-completed',
        movement: expect.objectContaining({ actorId: 'player' }),
      }),
    ]);

    const canvas = await renderGameboardPlan(report.finalPlan, {
      title: 'simple-rpg-simulation-report',
      width: 1350,
      height: 850,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/simple-rpg-simulation-report.png',
    });
    expect(screenshot).toContain('simple-rpg-simulation-report.png');
  });
});
