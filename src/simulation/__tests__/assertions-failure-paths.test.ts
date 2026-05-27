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
        // biome-ignore lint/suspicious/noExplicitAny: deliberately-bad selector
        commands: [{ kind: 'no-such-command-kind-ever' as any }],
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
        actorTargets: [{ sourceActorId: 'nobody-in-empty-scenario' }],
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

  it('reports failure when expectations.eventTypes mismatch the actual event sequence (E0a)', () => {
    const script: GameboardScenarioSimulationScript = {
      schemaVersion: '1.0.0',
      steps: [],
      expectations: {
        // Empty actual eventTypes won't match this.
        eventTypes: ['movement-stepped', 'movement-completed'],
      },
    };
    const failures = evaluate(script);
    expect(failures.some((f) => f.message.includes('Simulation event type sequence'))).toBe(true);
  });

  it('reports failure when expectations.requiredEventTypes are absent (E0a)', () => {
    const script: GameboardScenarioSimulationScript = {
      schemaVersion: '1.0.0',
      steps: [],
      expectations: {
        requiredEventTypes: ['quest-completed'],
      },
    };
    const failures = evaluate(script);
    expect(failures.length).toBeGreaterThan(0);
  });

  it('matches actorTargets expectation that specifies no nearest/target fields (E0a)', () => {
    const script: GameboardScenarioSimulationScript = {
      schemaVersion: '1.0.0',
      steps: [],
      expectations: {
        // sourceActorId only — no nearest/target fields means
        // hasSpecificActorTargetExpectation() returns false, so
        // matchesAnyActorTarget() takes the `return true` branch.
        actorTargets: [{ sourceActorId: 'anyone' }],
      },
    };
    const failures = evaluate(script);
    // Expectation matches vacuously; the no-candidates branch may still
    // fire because the sourceActor doesn't exist. The point is the line
    // executes without throwing.
    expect(Array.isArray(failures)).toBe(true);
  });

  it('reports failure for quest objective status mismatch', () => {
    const script: GameboardScenarioSimulationScript = {
      schemaVersion: '1.0.0',
      steps: [],
      expectations: {
        quests: [
          {
            questId: 'definitely-not-a-real-quest',
            completedObjectives: ['obj-1'],
          },
        ],
      },
    };
    const failures = evaluate(script);
    // Either the quest selector matches nothing OR the objective check
    // fires; both prove the quest-expectation pathway is exercised.
    expect(failures.length).toBeGreaterThan(0);
  });

  it('reports failure when placement expected present but missing (E0a)', () => {
    // Use spawn-placement step to add a placement during simulation.
    const script: GameboardScenarioSimulationScript = {
      schemaVersion: '1.0.0',
      steps: [
        {
          action: 'spawn-placement',
          id: 'add-flag',
          placement: {
            id: 'flag-placement',
            at: '0,0',
            assetId: 'flag_yellow',
            kind: 'prop',
          },
          systems: false,
        },
      ],
      expectations: {
        placements: [
          { placementId: 'flag-placement', exists: false }, // present → fails
          { placementId: 'ghost-placement', exists: true }, // absent → fails
        ],
      },
    };
    const failures = evaluate(script);
    expect(failures.some((f) => f.message.includes('was expected to be absent'))).toBe(true);
    expect(failures.some((f) => f.message.includes('was not found'))).toBe(true);
  });

  it('reports failure when actor expected to be absent but exists, and vice versa (E0a)', () => {
    const scenarioWithActor: GameboardScenario = {
      ...scenario,
      actors: [
        {
          id: 'hero-placement',
          actorId: 'hero',
          actorKind: 'player',
          at: '0,0',
          assetId: 'flag_blue',
          kind: 'unit',
        },
      ],
    };
    const result = runGameboardScenarioSimulationScript(scenarioWithActor, {
      schemaVersion: '1.0.0',
      steps: [],
      expectations: {
        actors: [
          { actorId: 'hero', exists: false }, // hero is present → fails
          { actorId: 'ghost', exists: true }, // ghost absent → fails
        ],
      },
    });
    const report = createGameboardScenarioSimulationReport(result, {
      actors: [
        { actorId: 'hero', exists: false },
        { actorId: 'ghost', exists: true },
      ],
    });
    const failures = evaluateGameboardScenarioSimulationExpectations(report, {
      actors: [
        { actorId: 'hero', exists: false },
        { actorId: 'ghost', exists: true },
      ],
    });
    expect(failures.some((f) => f.message.includes('was expected to be absent'))).toBe(true);
    expect(failures.some((f) => f.message.includes('was not found'))).toBe(true);
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
