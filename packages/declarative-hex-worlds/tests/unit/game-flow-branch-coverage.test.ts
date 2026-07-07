/**
 * Node-side coverage for game-flow branches that the SimpleRPG game exercised
 * broadly in the browser. The game moved to packages/examples (a separate package
 * with separate coverage), so the LIBRARY covers these public-API branches itself,
 * directly — it must not depend on an external consumer for its own coverage.
 *
 * Each test targets a specific ternary branch flagged by the merged-coverage gate:
 * unit faction-vs-neutral (gameboard.ts), scenario with/without spawnGroups+patrol
 * (scenario.ts), simulation steps that DO run systems (engine.ts), interaction
 * command-vs-target dispatch (commands.ts), and recipe piece-declarations present
 * (recipe.ts).
 */
import { describe, expect, it } from 'vitest';
import {
  createGameboardBuilder,
  createGameboardWorld,
  createGameboardWorldFromScenario,
  executeGameboardInteractionCommand,
  planGameboardInteractionCommand,
  runGameboardScenarioSimulationScript,
  type GameboardScenario,
  type GameboardScenarioSimulationScript,
} from '../../src';

describe('game-flow branch coverage (library-owned, post examples split)', () => {
  it('builds both neutral and factioned units (gameboard.ts unit-asset branches)', () => {
    const builder = createGameboardBuilder({
      seed: 'branch-cov-units',
      shape: { kind: 'rectangle', width: 4, height: 4 },
    });
    // factioned unit → coloredUnitAssetId + faction/style branch
    builder.addUnit({ at: { q: 0, r: 0 }, faction: 'blue', part: 'sword', style: 'full' });
    // neutral unit → neutralUnitAssetId + style:'neutral' branch
    builder.addUnit({ at: { q: 1, r: 0 }, part: 'hammer', neutral: true });
    const plan = builder.build();
    const units = plan.placements.filter((p) => p.kind === 'unit');
    expect(units.length).toBeGreaterThanOrEqual(2);
  });

  it('compiles a scenario WITHOUT spawnGroups or patrolRoutes (scenario.ts else branches)', () => {
    // Minimal scenario: a board recipe only, no spawnGroups/patrolRoutes — hits the
    // `: undefined` arms of both ternaries at scenario.ts:647 and :655.
    const scenario: GameboardScenario = {
      schemaVersion: 1,
      id: 'branch-cov-bare',
      title: 'Bare scenario',
      board: {
        schemaVersion: '1.0.0',
        options: { seed: 'branch-cov-bare-board', shape: { kind: 'rectangle', width: 3, height: 3 } },
        steps: [],
      },
    } as unknown as GameboardScenario;
    const runtime = createGameboardWorldFromScenario(scenario);
    expect(runtime.spawnGroups).toBeUndefined();
    expect(runtime.patrolRoutes).toBeUndefined();
  });

  it('runs a simulation step that DOES execute systems (engine.ts systems branches)', () => {
    const scenario: GameboardScenario = {
      schemaVersion: 1,
      id: 'branch-cov-systems',
      title: 'Systems scenario',
      board: {
        schemaVersion: '1.0.0',
        options: { seed: 'branch-cov-systems-board', shape: { kind: 'rectangle', width: 4, height: 4 } },
        steps: [],
      },
    } as unknown as GameboardScenario;
    // A script whose steps request systems:true → the non-undefined arm of the
    // `step.systems ? runGameboardSystems(...) : undefined` ternary (3 sites).
    const script: GameboardScenarioSimulationScript = {
      steps: [
        {
          action: 'run-systems',
          id: 'tick-systems',
          systems: { movement: { steps: 1 }, quests: false },
        },
      ],
      expectations: {},
    } as unknown as GameboardScenarioSimulationScript;
    const report = runGameboardScenarioSimulationScript(scenario, script);
    expect(report).toBeDefined();
  });

  it('dispatches an interaction via an explicit target (commands.ts command-vs-target)', () => {
    const builder = createGameboardBuilder({
      seed: 'branch-cov-cmd',
      shape: { kind: 'rectangle', width: 4, height: 4 },
    });
    const plan = builder.build();
    const world = createGameboardWorld(plan);
    // Passing a TARGET (not a prebuilt command) hits the planGameboardInteractionCommand
    // arm of the command-vs-target ternary.
    const command = planGameboardInteractionCommand(world, { tileKey: '1,1' }, {});
    const execution = executeGameboardInteractionCommand(world, command, {});
    expect(execution).toBeDefined();
  });

  it('compiles a recipe with piece declarations present (recipe.ts piece-registry branch)', () => {
    const scenario: GameboardScenario = {
      schemaVersion: 1,
      id: 'branch-cov-pieces',
      title: 'Pieces scenario',
      board: {
        schemaVersion: '1.0.0',
        options: { seed: 'branch-cov-pieces-board', shape: { kind: 'rectangle', width: 5, height: 5 } },
        steps: [],
        generation: {
          pieceDeclarations: [
            {
              id: 'branch_cov_tree',
              assetId: 'tree_single_A',
              source: 'test',
              role: 'tree',
              requiresExtra: false,
            },
          ],
          pieceFills: [
            {
              selection: { ids: ['branch_cov_tree'] },
              count: 1,
              ruleIdPrefix: 'branch-cov',
              idPrefix: 'branch-cov:tree',
            },
          ],
        },
      },
    } as unknown as GameboardScenario;
    const runtime = createGameboardWorldFromScenario(scenario);
    expect(runtime.plan.placements.length).toBeGreaterThan(0);
  });
});
