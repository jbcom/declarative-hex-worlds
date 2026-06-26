import { describe, expect, it } from 'vitest';
import {
  createGameboardBuilder,
  createGameboardWorld,
  projectWorldToGameboardPlan,
  runGameboardScenarioSimulation,
  type GameboardScenario,
} from '../../src';

const minimalScenario: GameboardScenario = {
  schemaVersion: '1.0.0',
  id: 'browser-branch-coverage',
  board: {
    schemaVersion: '1.0.0',
    options: {
      seed: 'browser-branch-coverage',
      shape: { kind: 'rectangle', width: 3, height: 2 },
    },
    steps: [],
  },
};

describe('browser-free branch coverage', () => {
  it('builds and projects river crossing overlays in the browser harness', () => {
    const plan = createGameboardBuilder({
      seed: 'browser-river-crossing',
      shape: { kind: 'rectangle', width: 3, height: 2 },
    })
      .addRiverPath(
        [
          { q: 0, r: 1 },
          { q: 1, r: 1 },
        ],
        { crossing: 'A', waterless: true }
      )
      .build();

    expect(plan.placements.find((placement) => placement.id === 'river:0,1')).toMatchObject({
      assetId: 'hex_river_crossing_A_waterless',
      kind: 'river',
    });

    const projected = projectWorldToGameboardPlan(createGameboardWorld(plan));
    expect(projected.placements.find((placement) => placement.id === 'river:0,1')).toMatchObject({
      assetId: 'hex_river_crossing_A_waterless',
      kind: 'river',
    });
  });

  it('runs direct simulation mutation branches with systems in the browser harness', () => {
    const result = runGameboardScenarioSimulation(minimalScenario, [
      { action: 'inspect-actor-targets', id: 'inspect-without-source' },
      {
        action: 'spawn-placement',
        id: 'spawn-marker',
        placement: { id: 'marker', at: '0,0', assetId: 'flag_yellow', kind: 'prop' },
        systems: { quests: false },
      },
      {
        action: 'spawn-actor',
        id: 'spawn-sidekick',
        actor: {
          id: 'sidekick-placement',
          actorId: 'sidekick',
          actorKind: 'npc',
          at: '2,0',
          assetId: 'flag_green',
          kind: 'prop',
        },
        systems: false,
      },
      {
        action: 'spawn-actor',
        id: 'spawn-hero',
        actor: {
          id: 'hero-placement',
          actorId: 'hero',
          actorKind: 'player',
          at: '1,0',
          assetId: 'flag_blue',
          kind: 'unit',
        },
        systems: { quests: false },
      },
      {
        action: 'update-actor',
        id: 'update-hero',
        actorId: 'hero',
        actor: { actorMetadata: { mood: 'ready' } },
        systems: { quests: false },
      },
      {
        action: 'update-placement',
        id: 'update-marker',
        placementId: 'marker',
        placement: { metadata: { state: 'armed' } },
        systems: { quests: false },
      },
    ]);

    expect(result.steps[0]?.actorTargets).toMatchObject({
      targets: [],
      reason: 'Actor target inspection requires sourceActor',
    });
    expect(result.steps[1]?.systems).toBeDefined();
    expect(result.steps[2]?.systems).toBeUndefined();
    expect(result.steps[4]?.systems).toBeDefined();
    expect(result.steps[5]?.systems).toBeDefined();
    expect(result.steps[4]?.mutations[0]).toMatchObject({
      type: 'actor-updated',
      actorId: 'hero',
      placementId: 'hero-placement',
      updated: true,
    });
    expect(result.steps[5]?.mutations[0]).toMatchObject({
      type: 'placement-updated',
      placementId: 'marker',
      updated: true,
    });
  });
});
