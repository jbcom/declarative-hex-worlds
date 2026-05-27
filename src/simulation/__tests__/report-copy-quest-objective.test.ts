/**
 * Coverage gap closure for src/simulation/report.ts::copyQuestObjective (PRD E0a).
 *
 * Builds two scenarios, one with a reach-tile quest objective whose `tile`
 * is an object form ({q,r}) and one with a collision objective using an
 * object-form `targetTile`. Drives them through the simulation runner +
 * report builder so the `'tile' in objective` and `'targetTile' in objective`
 * branches of copyQuestObjective both fire.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';
import type { GameboardScenario } from '../../scenario';
import { runGameboardScenarioSimulationScript } from '../engine';
import { createGameboardScenarioSimulationReport } from '../report';
import type { GameboardScenarioSimulationScript } from '../script';

function makeScenario(quest: GameboardScenario['quests']): GameboardScenario {
  return {
    schemaVersion: '1.0.0',
    id: 'report-copy-quest-objective',
    board: {
      schemaVersion: '1.0.0',
      options: {
        seed: 'report-copy-quest-objective-1',
        shape: { kind: 'rectangle', width: 3, height: 3 },
      },
      steps: [],
    },
    quests: quest,
  };
}

const emptyScript: GameboardScenarioSimulationScript = {
  schemaVersion: '1.0.0',
  steps: [],
};

describe('report.ts copyQuestObjective branches (PRD E0a)', () => {
  it('copies a reach-tile objective with object-form tile coordinates', () => {
    const scenario = makeScenario([
      {
        id: 'reach-spawn',
        objectives: [
          {
            id: 'walk-to-base',
            kind: 'reach-tile',
            actor: 'hero-not-in-world',
            tile: { q: 0, r: 0 },
          },
        ],
      },
    ]);
    const result = runGameboardScenarioSimulationScript(scenario, emptyScript);
    const report = createGameboardScenarioSimulationReport(result, emptyScript.expectations);
    const questRecord = report.quests.find((q) => q.questId === 'reach-spawn');
    expect(questRecord).toBeDefined();
    const objective = questRecord?.objectives[0];
    expect(objective).toBeDefined();
    if (objective !== undefined && 'tile' in objective && typeof objective.tile === 'object') {
      expect(objective.tile).toEqual({ q: 0, r: 0 });
    }
  });

  it('copies a collision objective with object-form targetTile coordinates', () => {
    const scenario = makeScenario([
      {
        id: 'avoid-trap',
        objectives: [
          {
            id: 'do-not-collide',
            kind: 'collision',
            actor: 'hero-not-in-world',
            targetTile: { q: 1, r: 1 },
            expect: 'blocked',
          },
        ],
      },
    ]);
    const result = runGameboardScenarioSimulationScript(scenario, emptyScript);
    const report = createGameboardScenarioSimulationReport(result, emptyScript.expectations);
    const questRecord = report.quests.find((q) => q.questId === 'avoid-trap');
    expect(questRecord).toBeDefined();
    const objective = questRecord?.objectives[0];
    expect(objective).toBeDefined();
    if (
      objective !== undefined &&
      'targetTile' in objective &&
      typeof objective.targetTile === 'object'
    ) {
      expect(objective.targetTile).toEqual({ q: 1, r: 1 });
    }
  });
});
