/**
 * Coverage gap closure for src/simulation/script.ts validation helpers (PRD E0a).
 *
 * The existing simulation tests focus on engine execution + recorded reports.
 * The script-side validators (`validateSpawnPlacementStep`,
 * `validateUpdateActorStep`, `validateUpdatePlacementStep`, the helper
 * predicates around them) are pure-functional input checkers; this file
 * drives the obvious error branches for each.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';
import {
  GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
  errorMessage,
  includesString,
  inspectGameboardScenarioSimulationScript,
  isHexCoordinatesInput,
  isNonEmptyString,
  isRecord,
  isSimulationMovementEventType,
  isSimulationPatrolEventType,
  isSimulationStepAction,
  tileKeyFromTargetInput,
} from '../script';

describe('script predicate helpers (PRD E0a)', () => {
  it('includesString narrows correctly', () => {
    const set = ['alpha', 'beta', 'gamma'] as const;
    expect(includesString(set, 'beta')).toBe(true);
    expect(includesString(set, 'delta')).toBe(false);
    expect(includesString(set, 17)).toBe(false);
  });

  it('isNonEmptyString rejects empty/whitespace/non-string inputs', () => {
    expect(isNonEmptyString('hi')).toBe(true);
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(42)).toBe(false);
  });

  it('isRecord rejects arrays and primitives', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('x')).toBe(false);
  });

  it('errorMessage extracts string from Error and falls back for non-Errors', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('plain')).toBe('plain');
    expect(errorMessage(123)).toBe('123');
    expect(errorMessage({ foo: 'bar' })).toContain('[object');
  });

  it('tileKeyFromTargetInput handles axial-string + {q,r} object inputs', () => {
    // Strings go through parseHexKey/hexKey, so the canonical axial format
    // round-trips. Invalid strings return undefined (caught from parse).
    expect(tileKeyFromTargetInput('0,0')).toBe('0,0');
    expect(tileKeyFromTargetInput({ q: 1, r: 2 })).toBe('1,2');
    expect(tileKeyFromTargetInput('not-a-hex-coord')).toBeUndefined();
    expect(tileKeyFromTargetInput(42)).toBeUndefined();
  });

  it('isHexCoordinatesInput accepts {q, r} numbers and rejects partial inputs', () => {
    expect(isHexCoordinatesInput({ q: 0, r: 0 })).toBe(true);
    expect(isHexCoordinatesInput({ q: 1, r: 2 })).toBe(true);
    expect(isHexCoordinatesInput({ q: 1 })).toBe(false);
    expect(isHexCoordinatesInput({ q: '1', r: '2' })).toBe(false);
    expect(isHexCoordinatesInput(null)).toBe(false);
  });

  it('isSimulationStepAction recognises known action names', () => {
    expect(isSimulationStepAction('command')).toBe(true);
    expect(isSimulationStepAction('spawn-actor')).toBe(true);
    expect(isSimulationStepAction('unknown-action')).toBe(false);
    expect(isSimulationStepAction(0)).toBe(false);
  });

  it('isSimulationMovementEventType recognises known movement events', () => {
    expect(isSimulationMovementEventType('movement-completed')).toBe(true);
    expect(isSimulationMovementEventType('movement-blocked')).toBe(true);
    expect(isSimulationMovementEventType('not-a-movement')).toBe(false);
  });

  it('isSimulationPatrolEventType recognises known patrol events', () => {
    expect(isSimulationPatrolEventType('patrol-completed')).toBe(true);
    expect(isSimulationPatrolEventType('patrol-blocked')).toBe(true);
    expect(isSimulationPatrolEventType('not-a-patrol')).toBe(false);
  });
});

describe('inspectGameboardScenarioSimulationScript top-level structure errors', () => {
  it('rejects non-object script', () => {
    // biome-ignore lint/suspicious/noExplicitAny: deliberate hostile input
    const result = inspectGameboardScenarioSimulationScript('totally not a script' as any);
    expect(result.violations.some((v) => v.code === 'simulation.script')).toBe(true);
  });

  it('flags wrong schemaVersion', () => {
    const script = {
      schemaVersion: '0.0.1-not-current',
      steps: [],
    };
    // biome-ignore lint/suspicious/noExplicitAny: deliberate hostile input
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.schema_version')).toBe(true);
  });

  it('rejects non-array steps', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: 'not-an-array',
    };
    // biome-ignore lint/suspicious/noExplicitAny: deliberate hostile input
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.steps')).toBe(true);
  });

  it('warns on empty steps array', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.steps_empty')).toBe(true);
  });

  it('flags spawn-placement step with non-object placement', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [{ id: 's1', action: 'spawn-placement', placement: 'bad' }],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.spawn_placement')).toBe(true);
  });

  it('flags spawn-placement missing assetId, kind, and at', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [{ id: 's1', action: 'spawn-placement', placement: { id: 'p1' } }],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('simulation.spawn_asset_id');
    expect(codes).toContain('simulation.spawn_kind');
    expect(codes).toContain('simulation.spawn_tile');
  });

  it('flags update-actor step with non-object actor field', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        { id: 's1', action: 'update-actor', actorId: 'ghost', actor: 'not-an-object' },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.update_actor')).toBe(true);
  });

  it('flags update-actor step with non-object placement override when provided', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'update-actor',
          actorId: 'ghost',
          actor: {},
          placement: 'bad-placement',
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.update_actor_placement')).toBe(
      true
    );
  });

  it('flags set-actor-targets step with non-object targeting field', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [{ id: 's1', action: 'inspect-actor-targets', sourceActor: 'a', targeting: 99 }],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.actor_targets_targeting')).toBe(
      true
    );
  });

  it('flags set-actor-targets with wrong-shape kinds/teams/factions/tags fields', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'inspect-actor-targets',
          sourceActor: 'a',
          targeting: {
            kinds: 17,
            teams: { not: 'array' },
            factions: false,
            tags: [42], // array elements must be strings
            excludeTags: 'not-array',
            radius: 'not-a-number',
          },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('simulation.actor_targets_kinds');
    expect(codes).toContain('simulation.actor_targets_teams');
    expect(codes).toContain('simulation.actor_targets_factions');
  });

  it('flags update-placement field shape errors (assetId/kind/layer/metadata)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'update-placement',
          placementId: 'p1',
          placement: {
            assetId: 17, // non-string
            kind: '', // empty string is invalid
            layer: 42, // non-string
            metadata: 'not-an-object', // metadata must be record-like
          },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('simulation.update_asset_id');
    expect(codes).toContain('simulation.update_kind');
    expect(codes).toContain('simulation.update_layer');
    expect(codes).toContain('simulation.update_metadata');
  });

  it('flags update-actor with non-object placement override and chains to validateUpdatePlacementFields', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'update-actor',
          actorId: 'a1',
          actor: {},
          placement: {
            assetId: 99, // non-string
          },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.update_asset_id')).toBe(true);
  });

  it('flags update-placement step with non-object placement field', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        { id: 's1', action: 'update-placement', placementId: 'p1', placement: 17 },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.update_placement')).toBe(true);
  });
});
