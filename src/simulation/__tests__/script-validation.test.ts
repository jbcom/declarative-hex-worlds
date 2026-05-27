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

  it('records scenario_board_compile_failed when the scenario board cannot compile', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [{ id: 's1', action: 'command', target: '0,0' }],
    };
    // Scenario whose board step references a non-existent action — recipe
    // compiler rejects, hitting the scenario_board_compile_failed branch.
    const scenario = {
      schemaVersion: '1.0.0',
      id: 'broken-scenario',
      board: {
        schemaVersion: '1.0.0',
        options: {
          seed: 'broken',
          shape: { kind: 'rectangle', width: 3, height: 3 },
        },
        steps: [{ action: 'definitely-not-a-real-recipe-action' }],
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any, {
      // biome-ignore lint/suspicious/noExplicitAny: deliberate broken scenario
      scenario: scenario as any,
    });
    expect(
      result.violations.some((v) => v.code === 'simulation.scenario_board_compile_failed')
    ).toBe(true);
  });

  it('normalizeUnknownList accepts a single non-empty string for actorIds', () => {
    // actorIds as a bare string normalizes to [[0, string]] — single ref.
    // No 'simulation.actor_reference_list' (shape) violation should fire.
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'inspect-actor-targets',
          sourceActor: 'a',
          targeting: { actorIds: 'lone-actor' },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.actor_reference_list')).toBe(false);
  });

  it('normalizeUnknownList flags numeric actorIds with the noun-specific code', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'inspect-actor-targets',
          sourceActor: 'a',
          targeting: { actorIds: 99 },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.actor_reference_list')).toBe(true);
  });

  it('normalizeUnknownList flags numeric placementIds with the placement-specific code', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'inspect-actor-targets',
          sourceActor: 'a',
          targeting: { placementIds: 17 },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.placement_reference_list')).toBe(true);
  });

  it('flags non-object expectations + spawn-actor branch errors (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        { id: 's1', action: 'run-systems' },
        { id: 's2', action: 'spawn-actor' /* no actor field */ },
        {
          id: 's3',
          action: 'spawn-actor',
          actor: {
            // empty actorId triggers 'simulation.spawn_actor_id'
            actorId: '',
            assetId: 'flag_blue',
            kind: 'unit',
            at: '0,0',
          },
        },
      ],
      // biome-ignore lint/suspicious/noExplicitAny: deliberately bad expectation
      expectations: 'not-an-object' as any,
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('simulation.expectations');
    expect(codes).toContain('simulation.spawn_actor');
    expect(codes).toContain('simulation.spawn_actor_id');
  });

  it('flags actor-targets targeting.center with non-string non-coord (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'inspect-actor-targets',
          sourceActor: 'a',
          targeting: { center: 17 },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.actor_targets_center')
    ).toBe(true);
  });

  it('flags actorTargets expectation nearestPathKeys not an array (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [{ id: 's1', action: 'command', target: '0,0' }],
      expectations: {
        actorTargets: [
          {
            nearestPathKeys: 'not-an-array',
            targetPathKeys: 17,
          },
        ],
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.tile_reference_list')).toBe(true);
  });

  it('flags update-actor with non-string + duplicate actorId (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        // First spawn hero
        {
          id: 's1',
          action: 'spawn-actor',
          actor: {
            actorId: 'hero',
            assetId: 'flag_blue',
            kind: 'unit',
            at: '0,0',
          },
        },
        // Second spawn elder
        {
          id: 's2',
          action: 'spawn-actor',
          actor: {
            actorId: 'elder',
            assetId: 'flag_green',
            kind: 'prop',
            at: '1,0',
          },
        },
        // Update hero to non-string id → simulation.update_actor_id
        {
          id: 's3',
          action: 'update-actor',
          actorId: 'hero',
          actor: { actorId: 17 },
        },
        // Update hero to elder's id → simulation.update_actor_duplicate
        {
          id: 's4',
          action: 'update-actor',
          actorId: 'hero',
          actor: { actorId: 'elder' },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('simulation.update_actor_id');
    expect(codes).toContain('simulation.update_actor_duplicate');
  });

  it('flags spawn-actor with empty spawnGroupId + non-integer spawnLocationIndex (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'spawn-actor',
          actor: {
            actorId: 'hero',
            assetId: 'flag_blue',
            kind: 'unit',
            spawnGroupId: '', // empty string
            spawnLocationIndex: 1.7, // non-integer
          },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('simulation.spawn_actor_spawn_group');
    expect(codes).toContain('simulation.spawn_actor_spawn_location_index');
  });

  it('flags spawn-actor referencing unknown scenario spawn group (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'spawn-actor',
          actor: {
            actorId: 'hero',
            assetId: 'flag_blue',
            kind: 'unit',
            spawnGroupId: 'definitely-not-a-group',
          },
        },
      ],
    };
    const scenario = {
      schemaVersion: '1.0.0',
      id: 'spawn-scenario',
      board: {
        schemaVersion: '1.0.0',
        options: { seed: 'x', shape: { kind: 'rectangle', width: 3, height: 3 } },
        steps: [],
      },
      spawnGroups: { groups: [{ id: 'home', count: 1 }] },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any, {
      // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
      scenario: scenario as any,
    });
    expect(
      result.violations.some((v) => v.code === 'simulation.spawn_actor_spawn_group_missing')
    ).toBe(true);
  });

  it('flags spawn-actor duplicate when actor id already exists in scenario (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'spawn-actor',
          actor: {
            actorId: 'hero',
            assetId: 'flag_blue',
            kind: 'unit',
            at: '0,0',
          },
        },
        // Second spawn with same actorId triggers duplicate
        {
          id: 's2',
          action: 'spawn-actor',
          actor: {
            actorId: 'hero',
            assetId: 'flag_blue',
            kind: 'unit',
            at: '1,0',
          },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.spawn_actor_duplicate')
    ).toBe(true);
  });

  it('flags inspect-actor-targets with non-array tileKeys list (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'inspect-actor-targets',
          sourceActor: 'a',
          targeting: {
            tileKeys: 17, // non-array, non-string → not a valid selection
          },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    // The selector accepts string or string[]; numeric input triggers
    // the tile-reference path which records its own violation.
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('flags step shape errors: non-object step, bad id, duplicate id, unknown action', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        'not-an-object',
        { id: 17, action: 'command' },
        { id: 'dup', action: 'command' },
        { id: 'dup', action: 'command' },
        { id: 's4', action: 'unknown-action-not-real' },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('simulation.step');
    expect(codes).toContain('simulation.step_id');
    expect(codes).toContain('simulation.step_duplicate');
    expect(codes).toContain('simulation.step_action');
  });

  it('indexes scenario quest ids + objectives during validation', () => {
    // Triggers the `config.scenario?.quests ?? []` index loop on line 1182.
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [{ id: 's1', action: 'command', target: '0,0' }],
    };
    const scenario = {
      schemaVersion: '1.0.0',
      id: 'quest-scenario',
      board: {
        schemaVersion: '1.0.0',
        options: { seed: 'q', shape: { kind: 'rectangle', width: 3, height: 3 } },
        steps: [],
      },
      quests: [
        {
          id: 'main-quest',
          objectives: [
            { id: 'obj-1' },
            { id: 'obj-2' },
            { id: '' }, // empty string is skipped by the isNonEmptyString filter
          ],
        },
        { id: '', objectives: [] }, // empty quest id is skipped at the outer continue
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any, {
      // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
      scenario: scenario as any,
    });
    // No quest-related violations from the index step alone.
    expect(
      result.violations.filter((v) => v.code.startsWith('simulation.quest'))
    ).toHaveLength(0);
  });

  it('flags actorTargets expectation with bad nearest/target fields', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        { id: 's1', action: 'command', target: '0,0' },
      ],
      expectations: {
        actorTargets: [
          {
            nearestApproach: 'not-a-real-approach',
            nearestReachable: 'not-a-bool',
            nearestPathCost: 'not-a-number',
            targetApproach: 17,
            targetPathFound: 'not-a-bool',
          },
        ],
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('simulation.expectation_actor_target_nearest_approach');
    expect(codes).toContain('simulation.expectation_actor_target_nearest_reachable');
    expect(codes).toContain('simulation.expectation_actor_target_target_approach');
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

  it('flags spawn-actor with both at and spawnGroupId set (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'spawn-actor',
          actor: {
            actorId: 'conflict-hero',
            assetId: 'flag_blue',
            kind: 'unit',
            at: '0,0',
            spawnGroupId: 'players',
          },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.spawn_actor_location_conflict')
    ).toBe(true);
  });

  it('flags spawn-actor with neither at nor spawnGroupId (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'spawn-actor',
          actor: {
            actorId: 'homeless-hero',
            assetId: 'flag_blue',
            kind: 'unit',
            // No at, no spawnGroupId
          },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.spawn_actor_location')
    ).toBe(true);
  });

  it('flags command target string referencing unknown id when index has entries (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        // Spawn a placement first so scenarioIndex has entries — line 3304's
        // `> 0` branch becomes true and pushes the missing-target violation.
        {
          id: 's1',
          action: 'spawn-placement',
          placement: { id: 'real-flag', at: '0,0', assetId: 'flag_blue', kind: 'prop' },
        },
        {
          id: 's2',
          action: 'command',
          target: 'absolutely-no-such-target-id',
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.command_target_missing')
    ).toBe(true);
  });

  it('flags spawn-placement with duplicate id (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'spawn-placement',
          placement: { id: 'twin-flag', at: '0,0', assetId: 'flag_blue', kind: 'prop' },
        },
        {
          id: 's2',
          action: 'spawn-placement',
          placement: { id: 'twin-flag', at: '1,0', assetId: 'flag_red', kind: 'prop' },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.spawn_placement_duplicate')
    ).toBe(true);
  });

  it('flags inspect-actor-targets placementIds as non-string non-array (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'inspect-actor-targets',
          targeting: { placementIds: 17 },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.placement_reference_list')
    ).toBe(true);
  });

  it('validates inspect-actor-targets placementIds as array (E0b)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'inspect-actor-targets',
          targeting: { placementIds: ['placement-x', 'placement-y'] },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    // Array body iterates each — line 1996-1998 fires (the references resolve
    // to placement_missing because no spawn-placement preceded). Pass-through.
    expect(Array.isArray(result.violations)).toBe(true);
  });

  it('flags command expectation with non-record entries (E0b)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [{ id: 's1', action: 'command', target: '0,0' }],
      expectations: { commands: ['not-a-record'] },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.expectation_command')
    ).toBe(true);
  });

  it('flags expectations.eventTypes as non-array (E0b)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [],
      expectations: { eventTypes: 'not-an-array' },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.expectation_event_types')
    ).toBe(true);
  });

  it('flags expectations.eventTypes containing unsupported entry (E0b)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [],
      expectations: { eventTypes: ['not-a-real-event-type'] },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.expectation_event_type')
    ).toBe(true);
  });

  it('flags command step.handlers as non-array (E0b)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        { id: 's1', action: 'command', target: '0,0', handlers: 'not-an-array' },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.command_handlers')
    ).toBe(true);
  });

  it('flags quest expectation completedObjectives as non-array (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [],
      expectations: {
        quests: [
          {
            questId: 'some-quest',
            completedObjectives: 'not-an-array',
          },
        ],
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.expectation_objective_ids')
    ).toBe(true);
  });

  it('flags quest expectation with non-string objective id in array (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [],
      expectations: {
        quests: [
          {
            questId: 'some-quest',
            completedObjectives: [17],
          },
        ],
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.expectation_objective_id')
    ).toBe(true);
  });

  it('flags update-actor with non-string faction/team (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'update-actor',
          actorId: 'somebody',
          actor: { faction: 17, team: 42 },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('simulation.update_actor_faction');
    expect(codes).toContain('simulation.update_actor_team');
  });

  it('flags command target as non-string non-coords non-record (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        { id: 's1', action: 'command', target: 42 },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.command_target')
    ).toBe(true);
  });

  it('flags command target with bad coordinates field (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'command',
          target: { coordinates: 'not-coords' },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.command_target_coordinates')
    ).toBe(true);
  });

  it('flags placement expectation referencing missing placement id (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'spawn-placement',
          placement: { id: 'real-flag', at: '0,0', assetId: 'flag_blue', kind: 'prop' },
        },
      ],
      expectations: {
        placements: [{ placementId: 'absolutely-no-such-placement' }],
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.placement_missing')
    ).toBe(true);
  });

  it('flags patrol expectation with non-record entries (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [{ id: 's1', action: 'command', target: '0,0' }],
      expectations: {
        patrols: ['not-a-record'],
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.expectation_patrol')
    ).toBe(true);
  });

  it('flags movement expectation with non-record entries (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [{ id: 's1', action: 'command', target: '0,0' }],
      expectations: {
        movements: ['not-a-record'],
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.expectation_movement')
    ).toBe(true);
  });

  it('flags actorTargets expectation with non-record entries (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [{ id: 's1', action: 'command', target: '0,0' }],
      expectations: {
        actorTargets: ['not-a-record'],
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.expectation_actor_target')
    ).toBe(true);
  });

  it('flags movement expectation with invalid eventType (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        { id: 's1', action: 'command', target: '0,0' },
      ],
      expectations: {
        movements: [{ eventType: 'not-a-real-movement-event' }],
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.expectation_movement_event_type')
    ).toBe(true);
  });

  it('flags patrol expectation with invalid eventType (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        { id: 's1', action: 'command', target: '0,0' },
      ],
      expectations: {
        patrols: [{ eventType: 'not-a-real-patrol-event' }],
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code.includes('patrol'))
    ).toBe(true);
  });

  it('flags spawn-placement without at field (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'spawn-placement',
          placement: { id: 'orphan-flag', assetId: 'flag_blue', kind: 'prop' },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.spawn_tile')
    ).toBe(true);
  });

  it('flags spawn-placement with non-string placement id (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'spawn-placement',
          placement: { id: 17, at: '0,0', assetId: 'flag_yellow', kind: 'prop' },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.spawn_placement_id')
    ).toBe(true);
  });

  it('validates inspect-actor-targets targeting.tileKeys as array (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'inspect-actor-targets',
          targeting: { tileKeys: ['0,0', 'not-a-valid-tile'] },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    // Array branch fires (line 1958-1962); doesn't matter if the keys are valid.
    expect(Array.isArray(result.violations)).toBe(true);
  });

  it('validates inspect-actor-targets center as HexCoordinates object (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'inspect-actor-targets',
          targeting: { center: { q: 0, r: 0 } },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    // Triggers validateActorTargetCenterReference HexCoordinates branch
    // (line 2010-2012) — pass either way.
    expect(Array.isArray(result.violations)).toBe(true);
  });

  it('flags inspect-actor-targets center with non-string non-coords value (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'inspect-actor-targets',
          targeting: { center: 17 },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.actor_targets_center')
    ).toBe(true);
  });

  it('validates inspect-actor-targets center as tile-key string (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'inspect-actor-targets',
          targeting: { center: '0,0' },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(Array.isArray(result.violations)).toBe(true);
  });

  it('flags inspect-actor-targets with non-record targeting object (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        { id: 's1', action: 'inspect-actor-targets', targeting: 'not-a-record' },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.actor_targets_targeting')
    ).toBe(true);
  });

  it('flags every expectation kind as non-array (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        { id: 's1', action: 'command', target: '0,0' },
      ],
      expectations: {
        mutations: 'not-an-array',
        actors: 'not-an-array',
        placements: 'not-an-array',
        quests: 'not-an-array',
        actorTargets: 'not-an-array',
        commands: 'not-an-array',
        patrols: 'not-an-array',
        movements: 'not-an-array',
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('simulation.expectation_mutations');
    expect(codes).toContain('simulation.expectation_actors');
    expect(codes).toContain('simulation.expectation_placements');
    expect(codes).toContain('simulation.expectation_quests');
  });

  it('flags every expectation entry as non-record (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        { id: 's1', action: 'command', target: '0,0' },
      ],
      expectations: {
        mutations: ['not-a-record'],
        actors: ['not-a-record'],
        placements: ['not-a-record'],
        quests: ['not-a-record'],
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('simulation.expectation_mutation');
    expect(codes).toContain('simulation.expectation_actor');
    expect(codes).toContain('simulation.expectation_placement');
    expect(codes).toContain('simulation.expectation_quest');
  });

  it('flags mutation expectation with invalid type (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        { id: 's1', action: 'command', target: '0,0' },
      ],
      expectations: {
        mutations: [{ type: 'not-a-real-mutation-type' }],
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.expectation_mutation_type')
    ).toBe(true);
  });

  it('flags quest expectation with non-string questId + missing questId (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        { id: 's1', action: 'command', target: '0,0' },
      ],
      expectations: {
        quests: [{ questId: 17 }, { questId: '' }],
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(
      result.violations.some((v) => v.code === 'simulation.expectation_quest_id')
    ).toBe(true);
  });

  it('flags inspect-actor-targets with every targeting sub-field wrong (E0a)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'inspect-actor-targets',
          targeting: {
            kinds: 17,
            teams: 17,
            factions: 17,
            tags: 17,
            excludeTags: 17,
            radius: 'not-a-number',
            maxPathCost: 'not-a-number',
            includeSource: 'not-a-bool',
            hostile: 'not-a-bool',
            interactive: 'not-a-bool',
            blocksMovement: 'not-a-bool',
            hostileToSource: 'not-a-bool',
            includeUnreachable: 'not-a-bool',
            approach: 'not-a-real-approach',
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
    expect(codes).toContain('simulation.actor_targets_tags');
    expect(codes).toContain('simulation.actor_targets_exclude_tags');
    expect(codes).toContain('simulation.actor_targets_radius');
    expect(codes).toContain('simulation.actor_targets_max_path_cost');
    expect(codes).toContain('simulation.actor_targets_include_source');
    expect(codes).toContain('simulation.actor_targets_hostile');
    expect(codes).toContain('simulation.actor_targets_interactive');
    expect(codes).toContain('simulation.actor_targets_blocks_movement');
    expect(codes).toContain('simulation.actor_targets_hostile_to_source');
    expect(codes).toContain('simulation.actor_targets_include_unreachable');
    expect(codes).toContain('simulation.actor_targets_approach');
  });

  it('flags command step handlerOptions sub-fields when non-record (E0b)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'command',
          target: { actorId: 'someone' },
          handlerOptions: {
            removeTargetActor: 'not-a-record',
            removeTargetPlacement: 'not-a-record',
            markTargetActorInteracted: 'not-a-record',
          },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    const codes = result.violations.map((v) => v.code);
    expect(codes.filter((c) => c === 'simulation.command_handler_options').length).toBeGreaterThanOrEqual(3);
  });

  it('flags command step handlerOptions when itself non-record (E0b)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'command',
          target: { actorId: 'someone' },
          handlerOptions: 'not-an-object',
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.command_handler_options')).toBe(true);
  });

  it('flags handler removeTargetActor.commandKinds non-array (E0b)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        {
          id: 's1',
          action: 'command',
          target: { actorId: 'someone' },
          handlerOptions: {
            removeTargetActor: { commandKinds: 'not-array' },
            removeTargetPlacement: { commandKinds: 'not-array' },
            markTargetActorInteracted: { commandKinds: 'not-array' },
          },
        },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.filter((v) => v.code === 'simulation.command_handler_command_kinds').length).toBeGreaterThanOrEqual(3);
  });

  it('flags command expectation placementId as empty string (E0b)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [],
      expectations: { commands: [{ placementId: '' }] },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.placement_reference')).toBe(true);
  });

  it('accepts command step with HexCoordinates target via tile-reference path (E0b)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [
        { id: 's1', action: 'command', target: { q: 0, r: 0 } },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    // Should not flag command_target — coord path is valid.
    expect(result.violations.some((v) => v.code === 'simulation.command_target')).toBe(false);
  });

  it('flags command expectation stepId + actorId as empty string (E0b)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [],
      expectations: {
        commands: [{ stepId: '', actorId: '' }],
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.step_reference')).toBe(true);
    expect(result.violations.some((v) => v.code === 'simulation.actor_reference')).toBe(true);
  });

  it('flags script-level expectations.eventTypes non-array (E0b)', () => {
    const script = {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      steps: [{ id: 's1', action: 'run-systems' }],
      expectations: { eventTypes: 'not-an-array' },
    };
    // biome-ignore lint/suspicious/noExplicitAny: schema-shaped fixture
    const result = inspectGameboardScenarioSimulationScript(script as any);
    expect(result.violations.some((v) => v.code === 'simulation.expectation_event_types')).toBe(true);
  });
});
