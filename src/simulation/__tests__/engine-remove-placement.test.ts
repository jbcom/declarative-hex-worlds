/**
 * Targeted coverage for runRemovePlacementStep + assertNever (PRD E0a).
 *
 * The big simulation harness in `simulation.test.ts` exercises every step
 * action except `remove-placement` (which lives between spawn-placement and
 * update-placement in the dispatcher's switch). This file fills that gap
 * with a small dedicated scenario.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';
import type { GameboardScenario } from '../../scenario';
import { runGameboardScenarioSimulation } from '../engine';

const minimalScenario: GameboardScenario = {
  schemaVersion: '1.0.0',
  id: 'engine-remove-placement',
  board: {
    schemaVersion: '1.0.0',
    options: {
      seed: 'engine-remove-placement-1',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    },
    steps: [],
  },
};

describe('engine sourceActor-required short-circuits (PRD E0a)', () => {
  it('actor-target-command without sourceActor returns empty actorTargets record', () => {
    const result = runGameboardScenarioSimulation(minimalScenario, [
      {
        action: 'actor-target-command',
        id: 'targetless-cmd',
        // No sourceActor — empty record path
        targeting: { approach: 'nearest' },
      },
    ]);
    const step = result.steps[0];
    expect(step?.actorTargets?.targets).toEqual([]);
    expect(step?.actorTargets?.reason).toMatch(/Actor target command requires sourceActor/);
  });

  it('inspect-actor-targets without sourceActor returns empty actorTargets record', () => {
    const result = runGameboardScenarioSimulation(minimalScenario, [
      {
        action: 'inspect-actor-targets',
        id: 'targetless-inspect',
        // No sourceActor — empty record path
      },
    ]);
    const step = result.steps[0];
    expect(step?.actorTargets?.targets).toEqual([]);
    expect(step?.actorTargets?.reason).toMatch(/sourceActor/);
  });
});

describe('runRemovePlacementStep (PRD E0a)', () => {
  it('removes a placement that was spawned earlier in the script', () => {
    const result = runGameboardScenarioSimulation(minimalScenario, [
      {
        action: 'spawn-placement',
        id: 'spawn-quest-marker',
        placement: {
          id: 'quest-marker',
          at: '0,0',
          assetId: 'flag_yellow',
          kind: 'prop',
        },
        systems: false,
      },
      {
        action: 'remove-placement',
        id: 'collect-quest-marker',
        placementId: 'quest-marker',
        systems: false,
      },
    ]);

    expect(result.steps).toHaveLength(2);
    const removeStep = result.steps[1];
    expect(removeStep?.action).toBe('remove-placement');
    expect(removeStep?.mutations?.[0]).toMatchObject({
      type: 'placement-removed',
      placementId: 'quest-marker',
      removed: true,
    });
  });

  it('reports removed=false when the target placement does not exist', () => {
    const result = runGameboardScenarioSimulation(minimalScenario, [
      {
        action: 'remove-placement',
        id: 'collect-missing',
        placementId: 'nonexistent-placement',
        systems: false,
      },
    ]);

    const mutation = result.steps[0]?.mutations?.[0];
    expect(mutation).toMatchObject({
      type: 'placement-removed',
      placementId: 'nonexistent-placement',
      removed: false,
    });
    // biome-ignore lint/suspicious/noExplicitAny: mutation discriminated union access
    expect((mutation as any)?.reason).toMatch(/No placement exists/);
  });

  it('runs requested systems after removal when step.systems is truthy', () => {
    const result = runGameboardScenarioSimulation(minimalScenario, [
      {
        action: 'spawn-placement',
        id: 'spawn-flag',
        placement: {
          id: 'flag',
          at: '0,0',
          assetId: 'flag_yellow',
          kind: 'prop',
        },
        systems: false,
      },
      {
        action: 'remove-placement',
        id: 'remove-with-systems',
        placementId: 'flag',
        systems: { quests: { step: 1 } },
      },
    ]);

    expect(result.steps[1]?.systems).toBeDefined();
  });
});
