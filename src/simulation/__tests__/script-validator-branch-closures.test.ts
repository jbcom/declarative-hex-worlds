/**
 * Branch-only closure for authored simulation-script validators.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';
import {
  GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
  inspectGameboardScenarioSimulationScript,
} from '../script';

const inspectUnchecked = (script: unknown, config?: unknown) =>
  inspectGameboardScenarioSimulationScript(
    // biome-ignore lint/suspicious/noExplicitAny: deliberate hostile validator fixtures
    script as any,
    // biome-ignore lint/suspicious/noExplicitAny: deliberate partial validation context
    config as any
  );

const baseScript = (steps: unknown[], expectations?: unknown) => ({
  schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
  steps,
  ...(expectations === undefined ? {} : { expectations }),
});

const indexedScenario = {
  schemaVersion: '1.0.0',
  id: 'validator-indexed-scenario',
  board: {
    schemaVersion: '1.0.0',
    options: { seed: 'validator-indexed', shape: { kind: 'rectangle', width: 2, height: 2 } },
    steps: [],
  },
  spawnGroups: { groups: [{ id: 'home', count: 3 }] },
  actors: [
    { id: 'hero-placement', actorId: 'hero', assetId: 'flag_blue', kind: 'unit', at: '0,0' },
    { id: 'prop-only-placement', assetId: 'crate', kind: 'prop', at: '1,0' },
  ],
  quests: [{ id: 'quest-without-objectives' }],
};

describe('simulation script validator branch closures', () => {
  it('indexes optional scenario actor ids and quest objective fallbacks', () => {
    const script = baseScript([
      {
        id: 'same-actor-id',
        action: 'update-actor',
        actorId: 'hero',
        actor: { actorId: 'hero' },
      },
      { id: 'command-object', action: 'command', command: 'bad-command', target: '0,0' },
      {
        id: 'target-command-object',
        action: 'actor-target-command',
        command: 'bad-command',
        targetActorId: 'hero',
      },
    ]);

    const result = inspectUnchecked(script, { scenario: indexedScenario });

    expect(result.violations.some((v) => v.code === 'simulation.update_actor_duplicate')).toBe(
      false
    );
    expect(result.violations.some((v) => v.code === 'simulation.schema_version')).toBe(false);
  });

  it('validates spawn actor location-index variants', () => {
    const actor = { assetId: 'flag_blue', kind: 'unit', spawnGroupId: 'home' };
    const script = baseScript([
      { id: 'default-index', action: 'spawn-actor', actor: { ...actor, actorId: 'default' } },
      {
        id: 'fractional-index',
        action: 'spawn-actor',
        actor: { ...actor, actorId: 'fractional', spawnLocationIndex: 1.5 },
      },
      {
        id: 'negative-index',
        action: 'spawn-actor',
        actor: { ...actor, actorId: 'negative', spawnLocationIndex: -1 },
      },
    ]);

    const result = inspectUnchecked(script, { scenario: indexedScenario });

    expect(
      result.violations.filter((v) => v.code === 'simulation.spawn_actor_spawn_location_index')
    ).toHaveLength(2);
  });

  it('validates command handler kind arrays and command expectation indexes', () => {
    const script = baseScript(
      [
        {
          id: 'bad-handler-kind',
          action: 'command',
          target: '0,0',
          handlerOptions: {
            markTargetActorInteracted: { commandKinds: ['move', 'not-a-command-kind'] },
          },
        },
        {
          id: 'bad-targeting-kinds',
          action: 'inspect-actor-targets',
          targeting: { kinds: [''] },
        },
      ],
      { commands: [{ stepIndex: -1 }] }
    );

    const codes = inspectUnchecked(script).violations.map((v) => v.code);

    expect(codes).toContain('simulation.command_handler_command_kind');
    expect(codes).toContain('simulation.actor_targets_kinds');
    expect(codes).toContain('simulation.step_index_reference');
  });

  it('accepts record command payloads, valid step indexes, and unindexed string targets', () => {
    const script = baseScript(
      [
        {
          id: 'record-command',
          action: 'command',
          command: { sourceActor: 'hero' },
          target: '0,0',
        },
        {
          id: 'record-target-command',
          action: 'actor-target-command',
          command: { sourceActor: 'hero' },
          targetActorId: 'hero',
        },
      ],
      { commands: [{ stepIndex: 0 }] }
    );

    const codes = inspectUnchecked(script, { scenario: indexedScenario }).violations.map(
      (v) => v.code
    );

    expect(codes).not.toContain('simulation.step_index_reference');

    const noIndexCodes = inspectUnchecked(
      baseScript([{ id: 'unindexed-target', action: 'command', target: 'ghost' }])
    ).violations.map((v) => v.code);
    expect(noIndexCodes).not.toContain('simulation.command_target_missing');
  });

  it('reports missing string command targets when only placements are indexed', () => {
    const script = baseScript([{ id: 'missing-target', action: 'command', target: 'ghost' }]);
    const result = inspectUnchecked(script, {
      plan: { tiles: [], placements: [{ id: 'existing-placement' }] },
    });

    expect(result.violations.some((v) => v.code === 'simulation.command_target_missing')).toBe(
      true
    );
  });
});
