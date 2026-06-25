import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameboardInteractionHandlerEffect } from '../../commands';
import type { GameboardScenario } from '../../scenario';
import { createGameboardPatrolSimulationSteps, runGameboardScenarioSimulation } from '../engine';
const mocks = vi.hoisted(() => {
  const noActorOverride = Symbol('no-actor-override');
  return {
    effects: vi.fn<() => readonly GameboardInteractionHandlerEffect[] | undefined>(),
    resolveActors: vi.fn<() => unknown[] | undefined>(),
    findActorOverride: vi.fn<() => unknown>(),
    omitSpawnActorPlacement: vi.fn<() => boolean>(),
    noActorOverride,
  };
});
vi.mock('../../commands', async () => {
  const actual = await vi.importActual<typeof import('../../commands')>('../../commands');
  return {
    ...actual,
    createGameboardInteractionHandlerPreset: () => [
      () => ({ handlerId: 'branch-closure-handler', status: 'handled' as const, effects: mocks.effects() }),
    ],
  };
});
vi.mock('../../scenario', async () => {
  const actual = await vi.importActual<typeof import('../../scenario')>('../../scenario');
  return {
    ...actual,
    resolveGameboardScenarioActors: (...args: Parameters<typeof actual.resolveGameboardScenarioActors>) => {
      const custom = mocks.resolveActors();
      return custom === undefined
        ? actual.resolveGameboardScenarioActors(...args)
        : (custom as ReturnType<typeof actual.resolveGameboardScenarioActors>);
    },
  };
});

vi.mock('../../actors', async () => {
  const actual = await vi.importActual<typeof import('../../actors')>('../../actors');
  return {
    ...actual,
    findGameboardActor: (...args: Parameters<typeof actual.findGameboardActor>) => {
      const custom = mocks.findActorOverride();
      return custom === mocks.noActorOverride
        ? actual.findGameboardActor(...args)
        : (custom as ReturnType<typeof actual.findGameboardActor>);
    },
    spawnGameboardActor: (...args: Parameters<typeof actual.spawnGameboardActor>) => {
      const entity = actual.spawnGameboardActor(...args);
      return mocks.omitSpawnActorPlacement()
        ? ({ get: () => undefined } as unknown as ReturnType<typeof actual.spawnGameboardActor>)
        : entity;
    },
  };
});

const minimalScenario: GameboardScenario = {
  schemaVersion: '1.0.0',
  id: 'engine-branch-closures',
  board: { schemaVersion: '1.0.0', options: { seed: 'engine-branch-closures', shape: { kind: 'rectangle', width: 3, height: 3 } }, steps: [] },
};
const actor = (actorId = 'hero') => ({ actorId, assetId: 'flag_blue', kind: 'unit' as const, at: '0,0' });
const marker = { id: 'marker', at: '1,0', assetId: 'flag_yellow', kind: 'prop' as const };
const run = (
  steps: Parameters<typeof runGameboardScenarioSimulation>[1],
  options?: Parameters<typeof runGameboardScenarioSimulation>[2]
) => runGameboardScenarioSimulation(minimalScenario, steps, options);

beforeEach(() => {
  mocks.effects.mockReset();
  mocks.resolveActors.mockReset();
  mocks.findActorOverride.mockReset();
  mocks.findActorOverride.mockReturnValue(mocks.noActorOverride);
  mocks.omitSpawnActorPlacement.mockReset();
});

describe('patrol simulation branch defaults (PRD E0a)', () => {
  it('uses missing-field labels and authored assignment labels', () => {
    const route = {
      id: 'watch-route',
      waypointKeys: ['0,0', '1,0'],
      loop: false,
      found: true,
      segments: [{ fromIndex: 0, toIndex: 1, fromKey: '0,0', toKey: '1,0', found: true, cost: 2, pathKeys: ['0,0', '1,0'] }],
      segmentCosts: [2],
    };
    const plan = createGameboardPatrolSimulationSteps({
      routes: { routes: [route as never] } as never,
      assignments: [{} as never, { routeId: 'watch-route', actorId: 'guard', label: 'Guard route', rounds: 1 }],
    });

    expect(plan.errors).toContain('undefined:undefined: Patrol assignment for actor <missing> requires routeId');
    expect(plan.errors).toContain('undefined:undefined: Patrol assignment for route <missing> requires actorId');
    expect(plan.steps[0]?.label).toBe('Guard route 1.1');
  });
});

describe('actor target and command handler branch defaults (PRD E0a)', () => {
  it('uses default targeting spreads for actor-target command and inspection steps', () => {
    const result = run([
      { action: 'spawn-actor', id: 'spawn-hero', actor: actor(), systems: false },
      { action: 'actor-target-command', id: 'target-defaults', sourceActor: 'hero', systems: false },
      { action: 'inspect-actor-targets', id: 'inspect-defaults', sourceActor: 'hero' },
    ]);

    expect(result.steps[1]?.action).toBe('actor-target-command');
    expect(result.steps[2]?.actorTargets?.sourceActorId).toBe('hero');
  });

  it('uses option-level and empty defaults for command and run-systems steps', () => {
    const defaulted = run(
      [
        { action: 'command', id: 'command-option-systems', target: '0,0' },
        { action: 'run-systems', id: 'run-option-systems' },
      ],
      { defaultCommandSystems: { quests: false }, defaultRunSystems: { quests: false } }
    );
    const empty = run([
      { action: 'command', id: 'command-empty-systems', target: '0,0' },
      { action: 'run-systems', id: 'run-empty-systems' },
    ]);

    expect(defaulted.steps.every((step) => step.systems !== undefined)).toBe(true);
    expect(empty.steps[0]?.systems).toBeUndefined();
    expect(empty.steps[1]?.systems).toBeDefined();
  });

  it('copies handler effect reasons for every mutation effect type', () => {
    mocks.effects.mockReturnValue([
      { type: 'actor-removed', actorId: 'enemy', placementId: 'enemy-placement', removed: false, reason: 'blocked' },
      { type: 'placement-removed', placementId: 'marker', removed: false, reason: 'locked' },
      { type: 'actor-updated', actorId: 'npc', placementId: 'npc-placement', updated: false, reason: 'stale' },
      { type: 'placement-updated', placementId: 'marker', updated: false, reason: 'missing' },
    ]);
    const result = run([
      { action: 'spawn-placement', id: 'spawn-marker', placement: marker, systems: false },
      { action: 'command', id: 'handler-reasons', target: { placementId: 'marker' }, handler: 'default-rpg', systems: false },
    ]);

    expect(result.steps[1]?.mutations.map((mutation) => mutation.reason)).toEqual(['blocked', 'locked', 'stale', 'missing']);
  });
});

describe('direct mutation branch records (PRD E0a)', () => {
  it('records missing targets and runs requested systems for direct mutation steps', () => {
    const result = run([
      { action: 'remove-actor', id: 'remove-missing-actor', actorId: 'ghost', systems: false },
      { action: 'spawn-actor', id: 'spawn-with-systems', actor: actor(), systems: { quests: false } },
      { action: 'spawn-placement', id: 'spawn-placement-with-systems', placement: marker, systems: { quests: false } },
      { action: 'update-actor', id: 'update-missing-actor', actorId: 'ghost', actor: {}, systems: { quests: false } },
      { action: 'update-placement', id: 'update-missing-placement', placementId: 'ghost-placement', placement: { metadata: { seen: true } }, systems: { quests: false } },
    ]);

    expect(result.steps[0]?.mutations[0]).toMatchObject({ type: 'actor-removed', actorId: 'ghost', removed: false });
    expect(result.steps[0]?.events).toEqual([]);
    expect(result.steps.slice(1).every((step) => step.systems !== undefined)).toBe(true);
    expect(result.steps[3]?.mutations[0]).toMatchObject({ type: 'actor-updated', actorId: 'ghost', updated: false });
    expect(result.steps[4]?.mutations[0]).toMatchObject({ type: 'placement-updated', placementId: 'ghost-placement', updated: false });
  });

  it('falls back to the authored placement id when actor spawn returns no placement state', () => {
    mocks.omitSpawnActorPlacement.mockReturnValueOnce(true);

    const result = run([
      { action: 'spawn-actor', id: 'spawn-actor-fallback', actor: { id: 'hero-placement', ...actor() } as never, systems: false },
    ]);

    expect(result.steps[0]?.mutations[0]).toMatchObject({ type: 'actor-spawned', placementId: 'hero-placement' });
  });

  it('falls back to authored actor ids when updated actor lookup misses', () => {
    for (const [update, actorId] of [
      [{ actorId: 'renamed-hero' }, 'renamed-hero'],
      [{ actorMetadata: { mood: 'ready' } }, 'hero'],
    ] as const) {
      let calls = 0;
      mocks.findActorOverride.mockImplementation(() => (++calls === 1 ? mocks.noActorOverride : undefined));
      const result = run([
        { action: 'spawn-actor', id: 'spawn-hero', actor: actor(), systems: false },
        { action: 'update-actor', id: `update-${actorId}`, actorId: 'hero', actor: update, systems: false },
      ]);
      expect(result.steps[1]?.mutations[0]).toMatchObject({
        type: 'actor-updated',
        actorId,
        placementId: 'runtime:unit:0,0:flag_blue:0',
      });
    }
  });

  it('reports the fallback group label for impossible spawn resolution misses', () => {
    mocks.resolveActors.mockReturnValue([]);

    expect(() =>
      runGameboardScenarioSimulation(
        { ...minimalScenario, spawnGroups: { seed: 'fallback-group', groups: [{ id: 'party', count: 1 }] } },
        [{ action: 'spawn-actor', id: 'spawn-null-group', actor: { ...actor('sidekick'), spawnGroupId: null as never }, systems: false }]
      )
    ).toThrow(/actor sidekick in group \(none\)/);
  });
});
