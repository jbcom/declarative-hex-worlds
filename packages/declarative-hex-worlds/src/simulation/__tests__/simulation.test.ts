import { describe, expect, it } from 'vitest';
import { createGameboardRecipe } from '../../scenario/recipe';
import { createGameboardScenario, inspectGameboardScenario } from '../../scenario/index';
import {
  GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS,
  assertGameboardScenarioSimulationExpectations,
  createGameboardPatrolSimulationScript,
  createGameboardScenarioSimulationReport,
  evaluateGameboardScenarioSimulationExpectations,
  inspectGameboardScenarioSimulationScript,
  runGameboardScenarioSimulationScript,
  validateGameboardScenarioSimulationScript,
  type GameboardScenarioSimulationScript,
} from '../../simulation/index';

describe('gameboard scenario simulation', () => {
  it('runs scripted command, handler, mutation, movement, and quest steps as serializable records', () => {
    expect(GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS).toContain('actor-target-command');
    const scenario = createGameboardScenario(
      'scripted-quest',
      createGameboardRecipe(
        {
          seed: 'scripted-quest',
          shape: { kind: 'rectangle', width: 3, height: 1 },
        },
        [
          {
            action: 'addRoadPath',
            path: [
              { q: 0, r: 0 },
              { q: 1, r: 0 },
              { q: 2, r: 0 },
            ],
          },
        ]
      ),
      {
        actors: [
          {
            id: 'hero-placement',
            actorId: 'hero',
            actorKind: 'player',
            team: 'blue',
            at: '0,0',
            assetId: 'flag_blue',
            kind: 'unit',
            movementAgent: { profile: 'worker', movementBudget: 5 },
          },
          {
            id: 'raider-placement',
            actorId: 'raider',
            actorKind: 'enemy',
            team: 'red',
            hostile: true,
            at: '1,0',
            assetId: 'flag_red',
            kind: 'unit',
          },
          {
            id: 'elder-placement',
            actorId: 'elder',
            actorKind: 'npc',
            team: 'blue',
            at: '2,0',
            assetId: 'flag_green',
            kind: 'prop',
          },
        ],
        quests: [
          {
            id: 'scripted-quest:intro',
            objectives: [
              {
                id: 'enemy-blocks',
                kind: 'collision',
                actor: 'hero',
                targetActor: 'raider',
                expect: 'blocked',
              },
              { id: 'defeat-raider', kind: 'defeat-actor', targetActor: 'raider' },
              { id: 'reach-elder', kind: 'reach-actor', actor: 'hero', targetActor: 'elder' },
            ],
          },
        ],
      }
    );
    const script = {
      schemaVersion: '1.0.0',
      defaultSourceActor: 'hero',
      defaultCommandHandlerOptions: {
        removeTargetActor: {
          handlerId: 'quest-defeat-handler',
          requireHostile: true,
        },
        markTargetActorInteracted: {
          handlerId: 'quest-dialog-handler',
          interactedField: 'spoken',
          sourceActorField: 'speakerActor',
          metadata: { questStage: 'intro-complete' },
        },
      },
      steps: [
        {
          action: 'spawn-placement',
          id: 'drop-quest-marker',
          placement: {
            id: 'quest-marker',
            at: '2,0',
            assetId: 'flag_yellow',
            kind: 'prop',
            metadata: { role: 'quest-marker', state: 'pending' },
          },
          systems: false,
        },
        {
          action: 'update-placement',
          id: 'arm-quest-marker',
          placementId: 'quest-marker',
          placement: {
            assetId: 'flag_green',
            metadata: { role: 'quest-marker', state: 'armed' },
          },
          systems: false,
        },
        {
          action: 'spawn-actor',
          id: 'spawn-merchant',
          actor: {
            id: 'merchant-placement',
            actorId: 'merchant',
            actorKind: 'npc',
            interactive: true,
            at: '2,0',
            assetId: 'flag_yellow',
            kind: 'prop',
            actorMetadata: { role: 'merchant', dialog: 'pending' },
          },
          systems: false,
        },
        {
          action: 'update-actor',
          id: 'prepare-merchant',
          actorId: 'merchant',
          actor: {
            actorMetadata: { role: 'merchant', dialog: 'ready' },
            tags: ['quest-giver'],
          },
          placement: {
            assetId: 'flag_green',
            metadata: { role: 'merchant-marker', state: 'ready' },
          },
          systems: false,
        },
        {
          action: 'inspect-actor-targets',
          id: 'scan-hostiles',
          sourceActor: 'hero',
          targeting: {
            hostileToSource: true,
            approach: 'nearest',
            maxPathCost: 1,
          },
        },
        {
          action: 'actor-target-command',
          id: 'attack-raider',
          targetActorId: 'raider',
          requireReachable: true,
          targeting: {
            hostileToSource: true,
            approach: 'nearest',
            maxPathCost: 1,
          },
          systems: { movement: false, quests: { step: 1 } },
        },
        {
          action: 'remove-actor',
          id: 'resolve-combat',
          actorId: 'raider',
          systems: { movement: false, quests: { step: 2 } },
        },
        {
          action: 'command',
          id: 'walk-to-elder',
          target: '2,0',
          systems: { movement: { steps: 10 }, quests: { step: 3 } },
        },
      ],
      expectations: {
        eventTypes: [
          'command-handler-required',
          'quest-advanced',
          'quest-advanced',
          'movement-requested',
          'movement-stepped',
          'movement-completed',
          'quest-advanced',
          'quest-completed',
        ],
        commands: [
          {
            stepId: 'attack-raider',
            kind: 'attack-actor',
            intent: 'attack',
            status: 'requires-game-handler',
            canExecute: true,
            actorId: 'raider',
            sourceActorId: 'hero',
            targetKind: 'actor',
            targetActorId: 'raider',
          },
          {
            stepId: 'walk-to-elder',
            kind: 'move',
            intent: 'move',
            status: 'requested-move',
            canExecute: true,
            tileKey: '2,0',
            sourceActorId: 'hero',
            targetKind: 'tile',
            targetTileKey: '2,0',
          },
        ],
        actorTargets: [
          {
            stepId: 'scan-hostiles',
            sourceActorId: 'hero',
            targetActorIds: ['raider'],
            reachableActorIds: ['raider'],
            nearestActorId: 'raider',
            nearestApproach: 'adjacent',
            nearestApproachTileKey: '0,0',
            nearestReachable: true,
            nearestPathFound: true,
            nearestPathCost: 0,
            nearestPathKeys: ['0,0'],
            targetActorId: 'raider',
            targetReachable: true,
            targetApproach: 'adjacent',
            targetApproachTileKey: '0,0',
            targetPathKeys: ['0,0'],
            targetCommandKind: 'attack-actor',
            targetCommandIntent: 'attack',
            targetCommandCanExecute: true,
          },
        ],
        movements: [
          {
            stepId: 'walk-to-elder',
            eventType: 'movement-completed',
            actorId: 'hero',
            tileKey: '2,0',
            profileId: 'worker',
            moved: true,
            status: 'completed',
            destinationKey: '2,0',
            pathIncludes: ['1,0', '2,0'],
          },
        ],
        mutations: [
          { type: 'placement-spawned', placementId: 'quest-marker', spawned: true },
          { type: 'placement-updated', placementId: 'quest-marker', updated: true },
          { type: 'actor-spawned', actorId: 'merchant', spawned: true },
          { type: 'actor-updated', actorId: 'merchant', updated: true },
          { type: 'actor-removed', actorId: 'raider', removed: true },
        ],
        actors: [
          { actorId: 'hero', tileKey: '2,0' },
          {
            actorId: 'merchant',
            kind: 'npc',
            interactive: true,
            tags: ['quest-giver'],
            metadata: { role: 'merchant', dialog: 'ready' },
            tileKey: '2,0',
            placementId: 'merchant-placement',
            assetId: 'flag_green',
          },
          { actorId: 'raider', exists: false },
        ],
        placements: [
          {
            placementId: 'quest-marker',
            tileKey: '2,0',
            assetId: 'flag_green',
            kind: 'prop',
            metadata: { role: 'quest-marker', state: 'armed' },
          },
        ],
        quests: [
          {
            questId: 'scripted-quest:intro',
            status: 'completed',
            completedObjectives: ['enemy-blocks', 'defeat-raider', 'reach-elder'],
          },
        ],
      },
    } satisfies GameboardScenarioSimulationScript;

    const result = runGameboardScenarioSimulationScript(scenario, script);
    const report = createGameboardScenarioSimulationReport(result, script.expectations);

    expect(report.success).toBe(true);
    expect(report.expectationFailures).toEqual([]);
    expect(report.steps.map((step) => step.id)).toEqual([
      'drop-quest-marker',
      'arm-quest-marker',
      'spawn-merchant',
      'prepare-merchant',
      'scan-hostiles',
      'attack-raider',
      'resolve-combat',
      'walk-to-elder',
    ]);
    expect(report.steps[5]?.command).toMatchObject({
      kind: 'attack-actor',
      status: 'requires-game-handler',
      actorId: 'raider',
      sourceActorId: 'hero',
    });
    expect(report.steps[5]?.actorTargets).toMatchObject({
      sourceActorId: 'hero',
      targetActorIds: ['raider'],
      reachableActorIds: ['raider'],
      nearestTarget: {
        actorId: 'raider',
        commandKind: 'attack-actor',
        commandCanExecute: true,
      },
    });
    expect(report.steps[4]?.actorTargets).toMatchObject({
      sourceActorId: 'hero',
      targetActorIds: ['raider'],
      reachableActorIds: ['raider'],
      nearestTarget: {
        actorId: 'raider',
        approach: 'adjacent',
        approachTileKey: '0,0',
        pathCost: 0,
        commandKind: 'attack-actor',
      },
    });
    expect(report.actorTargets).toHaveLength(2);
    expect(
      report.commands.map((command) => ({
        stepId: command.stepId,
        eventType: command.eventType,
        kind: command.command.kind,
      }))
    ).toEqual([
      { stepId: 'attack-raider', eventType: 'command-handler-required', kind: 'attack-actor' },
      { stepId: 'walk-to-elder', eventType: 'movement-requested', kind: 'move' },
    ]);
    expect(
      report.movements.map((movement) => ({
        stepId: movement.stepId,
        eventType: movement.eventType,
        actorId: movement.movement.actorId,
        moved: movement.movement.moved,
      }))
    ).toEqual([
      { stepId: 'walk-to-elder', eventType: 'movement-requested', actorId: 'hero', moved: false },
      { stepId: 'walk-to-elder', eventType: 'movement-stepped', actorId: 'hero', moved: true },
      { stepId: 'walk-to-elder', eventType: 'movement-completed', actorId: 'hero', moved: true },
    ]);
    expect(report.mutations).toEqual([
      { type: 'placement-spawned', placementId: 'quest-marker', spawned: true },
      { type: 'placement-updated', placementId: 'quest-marker', updated: true },
      {
        type: 'actor-spawned',
        actorId: 'merchant',
        placementId: 'merchant-placement',
        spawned: true,
      },
      {
        type: 'actor-updated',
        actorId: 'merchant',
        placementId: 'merchant-placement',
        updated: true,
      },
      { type: 'actor-removed', actorId: 'raider', placementId: 'raider-placement', removed: true },
    ]);
    expect(report.eventRecords.map((event) => event.type)).toEqual([
      'command-handler-required',
      'quest-advanced',
      'quest-advanced',
      'movement-requested',
      'movement-stepped',
      'movement-completed',
      'quest-advanced',
      'quest-completed',
    ]);
    expect(report.actors.map((actor) => actor.actorId)).toEqual(['elder', 'hero', 'merchant']);
    expect(report.actors.find((actor) => actor.actorId === 'hero')?.placement.tileKey).toBe('2,0');
    expect(report.placements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          placementId: 'quest-marker',
          assetId: 'flag_green',
          metadata: expect.objectContaining({ role: 'quest-marker', state: 'armed' }),
        }),
      ])
    );
    expect(report.quests[0]).toMatchObject({
      questId: 'scripted-quest:intro',
      status: 'completed',
      progress: [
        { objectiveId: 'enemy-blocks', status: 'completed' },
        { objectiveId: 'defeat-raider', status: 'completed' },
        { objectiveId: 'reach-elder', status: 'completed' },
      ],
    });
    expect(JSON.parse(JSON.stringify(report))).toMatchObject({
      scenarioId: 'scripted-quest',
      success: true,
      quests: [{ status: 'completed' }],
    });

    const failures = evaluateGameboardScenarioSimulationExpectations(report, {
      commands: [{ stepId: 'attack-raider', status: 'requested-move' }],
      actorTargets: [{ stepId: 'scan-hostiles', reachableActorIds: ['elder'] }],
      movements: [{ stepId: 'walk-to-elder', status: 'blocked' }],
      actors: [
        { actorId: 'hero', tileKey: '0,0' },
        { actorId: 'merchant', tags: ['missing-tag'] },
      ],
      quests: [{ questId: 'scripted-quest:intro', status: 'blocked' }],
      requiredEventTypes: ['command-blocked'],
    });
    expect(failures.map((failure) => failure.path)).toEqual([
      'expectations.requiredEventTypes.command-blocked',
      'expectations.commands.0',
      'expectations.actorTargets.0',
      'expectations.movements.0',
      'expectations.actors.hero.tileKey',
      'expectations.actors.merchant.tags',
      'expectations.quests.scripted-quest:intro.status',
    ]);
    expect(() =>
      assertGameboardScenarioSimulationExpectations(report, { actors: [{ actorId: 'raider' }] })
    ).toThrow(/expectations\.actors\.raider/);
  });

  it('runs opt-in command handler presets as serializable RPG effects', () => {
    const scenario = createGameboardScenario(
      'handler-preset-quest',
      createGameboardRecipe(
        {
          seed: 'handler-preset-quest',
          shape: { kind: 'rectangle', width: 3, height: 1 },
        },
        []
      ),
      {
        actors: [
          {
            id: 'hero-placement',
            actorId: 'hero',
            actorKind: 'player',
            team: 'blue',
            at: '0,0',
            assetId: 'flag_blue',
            kind: 'unit',
            movementAgent: { profile: 'worker', movementBudget: 5 },
          },
          {
            id: 'raider-placement',
            actorId: 'raider',
            actorKind: 'enemy',
            team: 'red',
            hostile: true,
            at: '1,0',
            assetId: 'flag_red',
            kind: 'unit',
          },
          {
            id: 'elder-placement',
            actorId: 'elder',
            actorKind: 'npc',
            team: 'blue',
            interactive: true,
            at: '2,0',
            assetId: 'flag_green',
            kind: 'prop',
          },
        ],
        quests: [
          {
            id: 'handler-preset-quest:intro',
            objectives: [
              { id: 'defeat-raider', kind: 'defeat-actor', targetActor: 'raider' },
              { id: 'reach-elder', kind: 'reach-actor', actor: 'hero', targetActor: 'elder' },
              { id: 'speak-elder', kind: 'interact-actor', actor: 'hero', targetActor: 'elder' },
            ],
          },
        ],
      }
    );
    const script = {
      schemaVersion: '1.0.0',
      defaultSourceActor: 'hero',
      defaultCommandHandlerOptions: {
        removeTargetActor: {
          handlerId: 'quest-defeat-handler',
          requireHostile: true,
        },
        markTargetActorInteracted: {
          handlerId: 'quest-dialog-handler',
          interactedField: 'spoken',
          sourceActorField: 'speakerActor',
          metadata: { questStage: 'intro-complete' },
        },
      },
      steps: [
        {
          action: 'command',
          id: 'attack-raider',
          target: { actorId: 'raider' },
          handler: 'remove-target-actor',
          systems: { movement: false, quests: { step: 1 } },
        },
        {
          action: 'command',
          id: 'walk-to-elder',
          target: '2,0',
          systems: { movement: { steps: 10 }, quests: { step: 2, advanceThroughCompleted: false } },
        },
        {
          action: 'command',
          id: 'speak-elder',
          target: { actorId: 'elder' },
          handler: 'mark-target-interacted',
          systems: { movement: false, quests: { step: 3 } },
        },
      ],
      expectations: {
        eventTypes: [
          'command-handled',
          'quest-advanced',
          'movement-requested',
          'movement-stepped',
          'movement-completed',
          'quest-advanced',
          'command-handled',
          'quest-advanced',
          'quest-completed',
        ],
        commands: [
          {
            stepId: 'attack-raider',
            kind: 'attack-actor',
            status: 'handled',
            handlerId: 'quest-defeat-handler',
            handlerStatus: 'handled',
            effectTypes: ['actor-removed'],
          },
          {
            stepId: 'speak-elder',
            kind: 'interact-actor',
            status: 'handled',
            handlerId: 'quest-dialog-handler',
            handlerStatus: 'handled',
            effectTypes: ['actor-updated'],
          },
        ],
        mutations: [
          {
            type: 'actor-removed',
            actorId: 'raider',
            placementId: 'raider-placement',
            removed: true,
          },
          {
            type: 'actor-updated',
            actorId: 'elder',
            placementId: 'elder-placement',
            updated: true,
          },
        ],
        actors: [
          { actorId: 'hero', tileKey: '2,0' },
          { actorId: 'raider', exists: false },
          {
            actorId: 'elder',
            metadata: {
              spoken: true,
              speakerActor: 'hero',
              questStage: 'intro-complete',
            },
          },
        ],
        quests: [
          {
            questId: 'handler-preset-quest:intro',
            status: 'completed',
            completedObjectives: ['defeat-raider', 'reach-elder', 'speak-elder'],
          },
        ],
      },
    } satisfies GameboardScenarioSimulationScript;

    expect(validateGameboardScenarioSimulationScript(script, { scenario })).toEqual([]);
    const result = runGameboardScenarioSimulationScript(scenario, script);
    const report = createGameboardScenarioSimulationReport(result, script.expectations);

    expect(report.success).toBe(true);
    expect(report.expectationFailures).toEqual([]);
    expect(
      report.commands.map((command) => ({
        stepId: command.stepId,
        eventType: command.eventType,
        status: command.command.status,
        handlerId: command.command.handlerId,
        effectTypes: command.command.effectTypes,
      }))
    ).toEqual([
      {
        stepId: 'attack-raider',
        eventType: 'command-handled',
        status: 'handled',
        handlerId: 'quest-defeat-handler',
        effectTypes: ['actor-removed'],
      },
      {
        stepId: 'walk-to-elder',
        eventType: 'movement-requested',
        status: 'requested-move',
        handlerId: undefined,
        effectTypes: undefined,
      },
      {
        stepId: 'speak-elder',
        eventType: 'command-handled',
        status: 'handled',
        handlerId: 'quest-dialog-handler',
        effectTypes: ['actor-updated'],
      },
    ]);
    expect(report.mutations).toEqual([
      { type: 'actor-removed', actorId: 'raider', placementId: 'raider-placement', removed: true },
      { type: 'actor-updated', actorId: 'elder', placementId: 'elder-placement', updated: true },
    ]);
  });

  it('preflights authored scripts against scenario actors, placements, quests, and tiles', () => {
    const scenario = createGameboardScenario(
      'validated-script',
      createGameboardRecipe(
        {
          seed: 'validated-script',
          shape: { kind: 'rectangle', width: 2, height: 1 },
        },
        []
      ),
      {
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
        quests: [
          {
            id: 'validated-script:intro',
            objectives: [{ id: 'reach-exit', kind: 'reach-tile', actor: 'hero', tile: '1,0' }],
          },
        ],
      }
    );
    const validScript = {
      schemaVersion: '1.0.0',
      defaultSourceActor: 'hero',
      steps: [
        {
          action: 'command',
          id: 'walk',
          target: '1,0',
          systems: { movement: { steps: 2 }, quests: { step: 1 } },
        },
      ],
      expectations: {
        requiredEventTypes: ['movement-requested'],
        actors: [{ actorId: 'hero', tileKey: '1,0', placementId: 'hero-placement' }],
        quests: [{ questId: 'validated-script:intro', activeObjectiveId: 'reach-exit' }],
      },
    } satisfies GameboardScenarioSimulationScript;

    expect(validateGameboardScenarioSimulationScript(validScript, { scenario })).toEqual([]);

    const invalidScript = {
      schemaVersion: '0.0.0',
      defaultSourceActor: 'ghost',
      defaultCommandHandlers: ['missing-handler'],
      defaultCommandHandlerOptions: {
        removeTargetActor: {
          commandKinds: ['not-a-command'],
          requireHostile: 'yes',
        },
        markTargetActorInteracted: {
          metadata: 'not-metadata',
        },
      },
      steps: [
        {
          action: 'command',
          id: 'duplicate',
          target: { actorId: 'missing-raider' },
          handlerOptions: {
            removeTargetPlacement: {
              includeActorPlacements: 'yes',
            },
          },
        },
        {
          action: 'actor-target-command',
          targetActorId: 'missing-raider',
          requireReachable: 'yes',
        },
        { action: 'remove-actor', id: 'duplicate', actorId: 'ghost' },
        { action: 'remove-placement', placementId: 'missing-placement' },
        { action: 'update-actor', actorId: 'ghost', actor: null },
        { action: 'update-placement', placementId: 'missing-placement', placement: null },
      ],
      expectations: {
        requiredEventTypes: ['not-a-system-event'],
        commands: [{ stepId: 'missing-step', stepIndex: -1, actorId: 'ghost' }],
        patrols: [{ stepId: 'missing-step', eventType: 'not-patrol', actorId: 'ghost' }],
        movements: [
          {
            stepId: 'missing-step',
            eventType: 'not-movement',
            actorId: 'ghost',
            pathIncludes: ['9,9'],
          },
        ],
        mutations: [{ type: 'missing-mutation', actorId: 'ghost' }],
        actors: [{ actorId: 'ghost', tileKey: '9,9' }],
        quests: [
          {
            questId: 'validated-script:intro',
            completedObjectives: ['missing-objective'],
          },
          { questId: 'missing-quest' },
        ],
      },
    } as unknown as GameboardScenarioSimulationScript;

    const inspection = inspectGameboardScenarioSimulationScript(invalidScript, { scenario });
    expect(inspection.violations.map((violation) => violation.code)).toEqual(
      expect.arrayContaining([
        'simulation.schema_version',
        'simulation.source_actor_missing',
        'simulation.command_handler',
        'simulation.command_handler_command_kind',
        'simulation.command_handler_require_hostile',
        'simulation.command_handler_metadata',
        'simulation.command_handler_include_actor_placements',
        'simulation.step_duplicate',
        'simulation.command_target_actor_missing',
        'simulation.actor_target_command_target_missing',
        'simulation.actor_target_command_require_reachable',
        'simulation.remove_actor_missing',
        'simulation.placement_missing',
        'simulation.update_actor_missing',
        'simulation.update_actor',
        'simulation.update_placement',
        'simulation.expectation_command_step_missing',
        'simulation.step_index_reference',
        'simulation.expectation_patrol_event_type',
        'simulation.expectation_movement_event_type',
        'simulation.expectation_event_type',
        'simulation.expectation_mutation_type',
        'simulation.expectation_actor_missing',
        'simulation.tile_missing',
        'simulation.expectation_objective_missing',
        'simulation.expectation_quest_missing',
      ])
    );
  });

  it('reports scenario patrol system events as first-class simulation records', () => {
    const scenario = createGameboardScenario(
      'scripted-patrol',
      createGameboardRecipe(
        {
          seed: 'scripted-patrol',
          shape: { kind: 'rectangle', width: 3, height: 1 },
        },
        [
          {
            action: 'setTileAsset',
            at: { q: 0, r: 0 },
            assetId: 'hex_grass',
            terrain: 'grass',
            tags: ['guard-spawn'],
          },
          {
            action: 'setTileAsset',
            at: { q: 1, r: 0 },
            assetId: 'hex_grass',
            terrain: 'grass',
            tags: ['watch-point'],
          },
        ]
      ),
      {
        spawnGroups: {
          groups: [{ id: 'guard', count: 1, tileTags: ['guard-spawn'] }],
        },
        patrolRoutes: [
          {
            id: 'guard-watch',
            count: 2,
            startGroupId: 'guard',
            tileTags: ['watch-point'],
            loop: false,
          },
        ],
        actors: [
          {
            id: 'guard-placement',
            actorId: 'guard',
            actorKind: 'npc',
            spawnGroupId: 'guard',
            assetId: 'flag_green',
            kind: 'unit',
            patrolAgent: { routeId: 'guard-watch', movement: { profile: 'ground' } },
          },
        ],
      }
    );
    const script = {
      schemaVersion: '1.0.0',
      steps: [
        {
          action: 'run-systems',
          id: 'patrol-step',
          systems: { movement: { steps: 10 }, quests: false },
        },
        {
          action: 'run-systems',
          id: 'patrol-complete',
          systems: { movement: { steps: 10 }, quests: false },
        },
      ],
      expectations: {
        requiredEventTypes: ['patrol-move-requested', 'patrol-completed'],
        patrols: [
          {
            stepId: 'patrol-step',
            eventType: 'patrol-move-requested',
            actorId: 'guard',
            routeId: 'guard-watch',
            status: 'requested',
            targetKey: '1,0',
            requested: true,
          },
          {
            stepId: 'patrol-complete',
            eventType: 'patrol-completed',
            actorId: 'guard',
            routeId: 'guard-watch',
            status: 'completed',
            currentWaypointIndex: 1,
          },
        ],
        actors: [{ actorId: 'guard', tileKey: '1,0' }],
      },
    } satisfies GameboardScenarioSimulationScript;

    const report = createGameboardScenarioSimulationReport(
      runGameboardScenarioSimulationScript(scenario, script),
      script.expectations
    );

    expect(report.expectationFailures).toEqual([]);
    expect(
      report.patrols.map((patrol) => ({
        stepId: patrol.stepId,
        eventType: patrol.eventType,
        actorId: patrol.patrol.actorId,
        routeId: patrol.patrol.routeId,
        status: patrol.patrol.status,
      }))
    ).toEqual([
      {
        stepId: 'patrol-step',
        eventType: 'patrol-move-requested',
        actorId: 'guard',
        routeId: 'guard-watch',
        status: 'requested',
      },
      {
        stepId: 'patrol-complete',
        eventType: 'patrol-completed',
        actorId: 'guard',
        routeId: 'guard-watch',
        status: 'completed',
      },
    ]);
  });

  it('spawns scripted actors from scenario spawn groups without reusing claimed locations', () => {
    const scenario = createGameboardScenario(
      'scripted-spawn-groups',
      createGameboardRecipe({
        seed: 'scripted-spawn-groups',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }),
      {
        spawnGroups: {
          seed: 'scripted-spawn-groups',
          groups: [{ id: 'party', count: 2 }],
        },
        actors: [
          {
            actorId: 'hero',
            actorKind: 'player',
            spawnGroupId: 'party',
            spawnLocationIndex: 0,
            assetId: 'flag_blue',
            kind: 'unit',
          },
        ],
      }
    );
    const script = {
      schemaVersion: '1.0.0',
      steps: [
        {
          action: 'spawn-actor',
          id: 'spawn-companion',
          actor: {
            actorId: 'companion',
            actorKind: 'npc',
            spawnGroupId: 'party',
            assetId: 'flag_green',
            kind: 'prop',
          },
          systems: false,
        },
      ],
      expectations: {
        mutations: [{ type: 'actor-spawned', actorId: 'companion', spawned: true }],
        actors: [
          {
            actorId: 'hero',
            metadata: { scenarioSpawnGroupId: 'party', scenarioSpawnLocationIndex: 0 },
          },
          {
            actorId: 'companion',
            metadata: { scenarioSpawnGroupId: 'party', scenarioSpawnLocationIndex: 1 },
          },
        ],
      },
    } satisfies GameboardScenarioSimulationScript;

    const report = createGameboardScenarioSimulationReport(
      runGameboardScenarioSimulationScript(scenario, script),
      script.expectations
    );
    const hero = report.actors.find((actor) => actor.actorId === 'hero');
    const companion = report.actors.find((actor) => actor.actorId === 'companion');

    expect(validateGameboardScenarioSimulationScript(script, { scenario })).toEqual([]);
    expect(report.success).toBe(true);
    expect(report.expectationFailures).toEqual([]);
    expect(companion?.metadata).toMatchObject({
      scenarioSpawnGroupId: 'party',
      scenarioSpawnLocationIndex: 1,
    });
    expect(companion?.placement.tileKey).not.toBe(hero?.placement.tileKey);

    const invalidScript = {
      schemaVersion: '1.0.0',
      steps: [
        {
          action: 'spawn-actor',
          actor: {
            actorId: 'lost-companion',
            actorKind: 'npc',
            spawnGroupId: 'missing-party',
            assetId: 'flag_green',
            kind: 'prop',
          },
        },
      ],
    } satisfies GameboardScenarioSimulationScript;

    expect(
      validateGameboardScenarioSimulationScript(invalidScript, { scenario }).map(
        (violation) => violation.code
      )
    ).toContain('simulation.spawn_actor_spawn_group_missing');
  });

  it('turns planned patrol routes into executable movement scripts', () => {
    const scenario = createGameboardScenario(
      'patrol-script',
      createGameboardRecipe(
        {
          seed: 'patrol-script',
          shape: { kind: 'rectangle', width: 3, height: 1 },
        },
        [
          {
            action: 'setTileAsset',
            at: { q: 1, r: 0 },
            assetId: 'hex_grass',
            terrain: 'grass',
            tags: ['watch-point'],
          },
          {
            action: 'setTileAsset',
            at: { q: 2, r: 0 },
            assetId: 'hex_grass',
            terrain: 'grass',
            tags: ['watch-point'],
          },
        ]
      ),
      {
        patrolRoutes: [
          {
            id: 'bandit-watch',
            start: '0,0',
            count: 3,
            tileTags: ['watch-point'],
            loop: true,
          },
        ],
        actors: [
          {
            actorId: 'bandit',
            actorKind: 'enemy',
            team: 'red',
            hostile: true,
            at: '0,0',
            assetId: 'flag_red',
            kind: 'unit',
            movementAgent: { profile: 'ground', movementBudget: 3 },
          },
        ],
      }
    );
    const inspection = inspectGameboardScenario(scenario);
    const routeSet = inspection.patrolRoutes;
    const scriptPlan = createGameboardPatrolSimulationScript({
      routes: routeSet?.routes ?? [],
      assignments: [{ routeId: 'bandit-watch', actorId: 'bandit', stepIdPrefix: 'watch' }],
      expectations: {
        actors: [{ actorId: 'bandit', tileKey: '0,0' }],
        requiredEventTypes: ['movement-requested', 'movement-completed'],
      },
    });
    const report = createGameboardScenarioSimulationReport(
      runGameboardScenarioSimulationScript(scenario, scriptPlan.script),
      scriptPlan.script.expectations
    );

    expect(routeSet?.routes[0]).toMatchObject({ found: true, selectedWaypointCount: 3 });
    expect(scriptPlan.errors).toEqual([]);
    expect(scriptPlan.steps).toHaveLength(routeSet?.routes[0]?.segments.length ?? 0);
    expect(scriptPlan.steps[0]).toMatchObject({
      action: 'command',
      id: 'watch:bandit:bandit-watch:r0:0-1',
      sourceActor: 'bandit',
    });
    expect(report.success).toBe(true);
    expect(report.expectationFailures).toEqual([]);
    expect(report.commands.every((command) => command.command.status === 'requested-move')).toBe(
      true
    );
    expect(report.actors.find((actor) => actor.actorId === 'bandit')?.placement.tileKey).toBe(
      '0,0'
    );

    const invalid = createGameboardPatrolSimulationScript({
      routes: routeSet?.routes ?? [],
      assignments: [{ routeId: 'missing-route', actorId: 'bandit' }],
    });
    expect(invalid.errors).toEqual([
      'bandit:missing-route: Patrol assignment references unknown route missing-route',
    ]);
    expect(invalid.script.steps).toEqual([]);
  });
});
