import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GameboardInteractionHandlerEffect } from '../../commands';
import type { GameboardScenario } from '../../scenario';
import { runGameboardScenarioSimulation } from '../engine';

const mocks = vi.hoisted(() => ({
  effects: vi.fn<() => readonly GameboardInteractionHandlerEffect[] | undefined>(),
  resolveActors: vi.fn<() => unknown[] | undefined>(),
}));

vi.mock('../../commands', async () => {
  const actual = await vi.importActual<typeof import('../../commands')>('../../commands');
  return {
    ...actual,
    createGameboardInteractionHandlerPreset: () => [
      () => ({
        handlerId: 'test-handler',
        status: 'handled' as const,
        effects: mocks.effects(),
      }),
    ],
  };
});

vi.mock('../../scenario', async () => {
  const actual = await vi.importActual<typeof import('../../scenario')>('../../scenario');
  return {
    ...actual,
    resolveGameboardScenarioActors: (
      ...args: Parameters<typeof actual.resolveGameboardScenarioActors>
    ) => {
      const custom = mocks.resolveActors();
      return custom !== undefined
        ? (custom as ReturnType<typeof actual.resolveGameboardScenarioActors>)
        : actual.resolveGameboardScenarioActors(...args);
    },
  };
});

const minimalScenario: GameboardScenario = {
  schemaVersion: '1.0.0',
  id: 'engine-defensive-branches',
  board: {
    schemaVersion: '1.0.0',
    options: {
      seed: 'engine-defensive-branches',
      shape: { kind: 'rectangle', width: 3, height: 3 },
    },
    steps: [],
  },
};

beforeEach(() => {
  mocks.effects.mockReset();
  mocks.resolveActors.mockReset();
});

describe('commandHandlerMutations defensive mapping (PRD E0a)', () => {
  it('maps placement-updated effects emitted by command handlers', () => {
    mocks.effects.mockReturnValue([
      { type: 'placement-updated', placementId: 'marker-1', updated: true },
    ]);

    const result = runGameboardScenarioSimulation(minimalScenario, [
      {
        action: 'spawn-placement',
        id: 'spawn-marker',
        placement: { id: 'marker-1', at: '1,0', assetId: 'flag_yellow', kind: 'prop' },
        systems: false,
      },
      {
        action: 'command',
        id: 'handler-placement-update',
        target: { placementId: 'marker-1' },
        handler: 'default-rpg',
        systems: false,
      },
    ]);

    expect(result.steps[1]?.mutations).toEqual([
      { type: 'placement-updated', placementId: 'marker-1', updated: true },
    ]);
  });

  it('throws a diagnostic error for unknown command handler effect types', () => {
    mocks.effects.mockReturnValue([
      { type: 'not-a-real-effect', placementId: 'marker-1', updated: true } as never,
    ]);

    expect(() =>
      runGameboardScenarioSimulation(minimalScenario, [
        {
          action: 'spawn-placement',
          id: 'spawn-marker',
          placement: { id: 'marker-1', at: '1,0', assetId: 'flag_yellow', kind: 'prop' },
          systems: false,
        },
        {
          action: 'command',
          id: 'handler-unknown-effect',
          target: { placementId: 'marker-1' },
          handler: 'default-rpg',
          systems: false,
        },
      ])
    ).toThrow(/commandHandlerMutations: unhandled effect type/);
  });
});

describe('resolveSimulationSpawnActor defensive branch (PRD E0a)', () => {
  it('throws when scenario actor resolution unexpectedly returns no actor', () => {
    mocks.resolveActors.mockReturnValue([]);

    expect(() =>
      runGameboardScenarioSimulation(
        {
          ...minimalScenario,
          spawnGroups: {
            seed: 'empty-resolve',
            groups: [{ id: 'party', count: 1 }],
          },
        },
        [
          {
            action: 'spawn-actor',
            id: 'spawn-sidekick',
            actor: {
              actorId: 'sidekick',
              assetId: 'flag_green',
              kind: 'unit',
              spawnGroupId: 'party',
            },
            systems: false,
          },
        ]
      )
    ).toThrow(/returned empty array for actor sidekick in group party/);
  });
});
