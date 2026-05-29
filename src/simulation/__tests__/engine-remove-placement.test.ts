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

describe('update-actor + update-placement mutation records (PRD E0a)', () => {
  it('records actor-updated mutation after update-actor step', () => {
    const result = runGameboardScenarioSimulation(minimalScenario, [
      {
        action: 'spawn-actor',
        id: 'spawn-hero',
        actor: {
          actorId: 'hero',
          assetId: 'flag_blue',
          kind: 'unit',
          at: '0,0',
        },
        systems: false,
      },
      {
        action: 'update-actor',
        id: 'rename-hero',
        actorId: 'hero',
        actor: { actorMetadata: { mood: 'happy' } },
        systems: false,
      },
    ]);
    const mutation = result.steps[1]?.mutations?.[0];
    expect(mutation?.type).toBe('actor-updated');
  });

  it('records placement-updated mutation after update-placement step', () => {
    const result = runGameboardScenarioSimulation(minimalScenario, [
      {
        action: 'spawn-placement',
        id: 'spawn-flag',
        placement: {
          id: 'flag-1',
          at: '0,0',
          assetId: 'flag_yellow',
          kind: 'prop',
        },
        systems: false,
      },
      {
        action: 'update-placement',
        id: 'paint-flag',
        placementId: 'flag-1',
        placement: { metadata: { color: 'red' } },
        systems: false,
      },
    ]);
    const mutation = result.steps[1]?.mutations?.[0];
    expect(mutation?.type).toBe('placement-updated');
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

describe('runSimulationStep + assertNever default (PRD E0a)', () => {
  it('throws GameboardRuntimeError for unknown step action', () => {
    expect(() =>
      runGameboardScenarioSimulation(minimalScenario, [
        // biome-ignore lint/suspicious/noExplicitAny: deliberately-invalid action
        { action: 'definitely-not-a-real-action' } as any,
      ])
    ).toThrow(/unreachable simulation step action/);
  });
});

describe('resolveSimulationSpawnActor missing spawn target (PRD E0a)', () => {
  it('throws GameboardRuntimeError when spawn-actor has neither at nor spawnGroupId', () => {
    expect(() =>
      runGameboardScenarioSimulation(minimalScenario, [
        {
          action: 'spawn-actor',
          id: 'spawn-orphan',
          actor: {
            actorId: 'orphan',
            assetId: 'flag_blue',
            kind: 'unit',
            // No `at`, no `spawnGroupId` — triggers resolveSimulationSpawnActor throw branch
            // biome-ignore lint/suspicious/noExplicitAny: deliberately-incomplete scenario actor
          } as any,
          systems: false,
        },
      ])
    ).toThrow(/has no spawn tile or spawn group/);
  });
});

describe('commandHandlerMutations mutation records (PRD E0a)', () => {
  it('commandHandlerMutations records actor-removed from remove-target-actor handler on hostile actor', () => {
    // Exercises commandHandlerMutations (engine.ts) with an actor-removed effect.
    // The `remove-target-actor` handler fires for attack-actor commands (hostile target).
    // Spawns hero (player/blue) + enemy (hostile/red), hero attacks enemy.
    const result = runGameboardScenarioSimulation(minimalScenario, [
      {
        action: 'spawn-actor',
        id: 'spawn-hero',
        actor: {
          actorId: 'hero',
          assetId: 'flag_blue',
          kind: 'unit',
          at: '0,0',
          faction: 'blue',
        },
        systems: false,
      },
      {
        action: 'spawn-actor',
        id: 'spawn-enemy',
        actor: {
          actorId: 'enemy',
          assetId: 'flag_red',
          kind: 'unit',
          at: '1,0',
          faction: 'red',
          hostile: true,
        },
        systems: false,
      },
      {
        action: 'command',
        id: 'cmd-attack',
        sourceActor: 'hero',
        target: { actorId: 'enemy' },
        handler: 'remove-target-actor',
        systems: false,
      },
    ]);
    const mutation = result.steps[2]?.mutations?.[0];
    expect(mutation?.type).toBe('actor-removed');
  });

  it('commandHandlerMutations records placement-removed with removed=true from remove-target-placement handler', () => {
    // Exercises commandHandlerMutations (engine.ts) with a placement-removed effect.
    // Target by placementId → intent=inspect → kind=inspect-placement. Override
    // commandKinds via handlerOptions to accept inspect-placement so the handler fires.
    const result = runGameboardScenarioSimulation(minimalScenario, [
      {
        action: 'spawn-placement',
        id: 'spawn-marker',
        placement: { id: 'marker-1', at: '1,0', assetId: 'flag_yellow', kind: 'prop' },
        systems: false,
      },
      {
        action: 'command',
        id: 'cmd-remove-real',
        target: { placementId: 'marker-1' },
        handler: 'remove-target-placement',
        handlerOptions: { removeTargetPlacement: { commandKinds: ['inspect-placement', 'interact-placement'] } },
        systems: false,
      },
    ]);
    const mutation = result.steps[1]?.mutations?.[0];
    expect(mutation?.type).toBe('placement-removed');
    // biome-ignore lint/suspicious/noExplicitAny: discriminated union
    expect((mutation as any)?.removed).toBe(true);
    // biome-ignore lint/suspicious/noExplicitAny: discriminated union — no reason when removed=true
    expect((mutation as any)?.reason).toBeUndefined();
  });
});

describe('simulationActorSpawnClaim returns undefined for actors without group metadata (PRD E0a)', () => {
  it('spawn-actor with spawnGroupId when existing actors have no scenario metadata returns undefined from simulationActorSpawnClaim', () => {
    // simulationActorSpawnClaim (engine.ts line 673-674) returns undefined when
    // the existing actor's metadata lacks scenarioSpawnGroupId / scenarioSpawnLocationIndex.
    // Spawn a plain actor first (no group metadata), then spawn a second actor
    // with a spawnGroupId — the first actor's claim is undefined, which is filtered
    // out by the `.filter(claim => claim !== undefined)` guard.
    const scenario = {
      ...minimalScenario,
      spawnGroups: {
        seed: 'sg-test',
        groups: [
          {
            id: 'sg-1',
          },
        ],
      },
    };
    const result = runGameboardScenarioSimulation(
      // biome-ignore lint/suspicious/noExplicitAny: extended scenario fixture for spawnGroups
      scenario as any,
      [
        {
          action: 'spawn-actor',
          id: 'spawn-base-actor',
          // Regular actor without group metadata
          actor: { actorId: 'hero', assetId: 'flag_blue', kind: 'unit', at: '2,0' },
          systems: false,
        },
        {
          action: 'spawn-actor',
          id: 'spawn-group-actor',
          // This actor uses a spawnGroupId, so simulationActorSpawnClaim runs
          // on the existing 'hero' actor and returns undefined (no group metadata).
          actor: { actorId: 'sidekick', assetId: 'flag_green', kind: 'unit', spawnGroupId: 'sg-1' },
          systems: false,
        },
      ]
    );
    // Both spawns succeed; the second actor gets assigned to sg-1 location 0.
    expect(result.steps[1]?.action).toBe('spawn-actor');
    // biome-ignore lint/suspicious/noExplicitAny: step mutation record
    expect((result.steps[1]?.mutations?.[0] as any)?.spawned).toBe(true);
  });
});
