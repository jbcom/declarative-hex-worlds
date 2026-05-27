/**
 * Coverage gap closure for src/simulation/assertions.ts no-match failure
 * paths (PRD E0a).
 *
 * The big simulation.test.ts exercises the happy expectation paths
 * (commands/movements/actorTargets/mutations all match). This file
 * exercises the "no candidates" + "no record matched" branches for each
 * expectation kind by running a minimal scenario whose expectations
 * deliberately don't match.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';
import type { GameboardScenario } from '../../scenario';
import { runGameboardScenarioSimulationScript } from '../engine';
import { evaluateGameboardScenarioSimulationExpectations } from '../assertions';
import { createGameboardScenarioSimulationReport } from '../report';
import type { GameboardScenarioSimulationScript } from '../script';

const scenario: GameboardScenario = {
  schemaVersion: '1.0.0',
  id: 'assertions-failure-paths',
  board: {
    schemaVersion: '1.0.0',
    options: {
      seed: 'assertions-failure-paths-1',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    },
    steps: [],
  },
};

function evaluate(script: GameboardScenarioSimulationScript) {
  const result = runGameboardScenarioSimulationScript(scenario, script);
  const report = createGameboardScenarioSimulationReport(result, script.expectations);
  return evaluateGameboardScenarioSimulationExpectations(report, script.expectations ?? {});
}

describe('assertions.ts no-candidates failure paths (PRD E0a)', () => {
  it('reports failure when expectations.commands selector has zero candidates', () => {
    const script: GameboardScenarioSimulationScript = {
      schemaVersion: '1.0.0',
      steps: [],
      expectations: {
        commands: [{ kind: 'no-such-command-kind-ever' }],
      },
    };
    const failures = evaluate(script);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.some((f) => f.message.includes('No command step matched'))).toBe(true);
  });

  it('reports failure when expectations.actorTargets selector has zero candidates', () => {
    const script: GameboardScenarioSimulationScript = {
      schemaVersion: '1.0.0',
      steps: [],
      expectations: {
        actorTargets: [{ sourceActor: 'nobody-in-empty-scenario' }],
      },
    };
    const failures = evaluate(script);
    expect(failures.some((f) => f.message.includes('No actor target inspection matched'))).toBe(true);
  });

  it('reports failure when expectations.movements selector has zero candidates', () => {
    const script: GameboardScenarioSimulationScript = {
      schemaVersion: '1.0.0',
      steps: [],
      expectations: {
        movements: [{ actorId: 'nobody-in-empty-scenario' }],
      },
    };
    const failures = evaluate(script);
    expect(failures.some((f) => f.message.includes('No movement event matched'))).toBe(true);
  });

  it('reports failure when expectations.patrols selector has zero candidates', () => {
    const script: GameboardScenarioSimulationScript = {
      schemaVersion: '1.0.0',
      steps: [],
      expectations: {
        patrols: [{ actorId: 'nobody-in-empty-scenario' }],
      },
    };
    const failures = evaluate(script);
    expect(failures.some((f) => f.message.includes('No patrol event matched'))).toBe(true);
  });
});
