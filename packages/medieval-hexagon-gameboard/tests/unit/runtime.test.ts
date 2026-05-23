import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../src/gameboard';
import {
  createInMemoryGameboardEcs,
  selectGameboardInteropRelations,
} from '../../src/interop';
import { createGameboardPieceRegistry, declareGameboardPiece } from '../../src/pieces';
import { createGameboardRecipe } from '../../src/recipe';
import { createGameboardScenario } from '../../src/scenario';
import {
  createGameboardRuntime,
  createGameboardRuntimeFromRecipe,
  createGameboardRuntimeFromScenario,
  type GameboardRuntimeSnapshot,
} from '../../src/runtime';

describe('gameboard runtime facade', () => {
  it('wraps actors, commands, systems, projection, and interop snapshots', () => {
    const plan = createGameboardBuilder({
      seed: 'runtime-facade',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    }).build();
    const runtime = createGameboardRuntime(plan);
    const player = runtime.spawnActor({
      id: 'hero-placement',
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
      team: 'blue',
      occupancyGuard: true,
    });

    runtime.movement.setAgent(player, { profile: 'ground', movementBudget: 4 });

    expect(runtime.planCommand('2,0', { sourceActor: 'hero' })).toMatchObject({
      kind: 'move',
      canExecute: true,
    });
    expect(runtime.previewCommand('2,0', { sourceActor: 'hero' })).toMatchObject({
      canExecute: true,
      movementPath: { found: true, cost: 2 },
    });

    const dispatch = runtime.dispatchCommand('2,0', { sourceActor: 'hero' });
    expect(dispatch.eventRecords).toEqual([
      expect.objectContaining({ type: 'movement-requested' }),
    ]);

    const tick = runtime.tick({
      patrols: false,
      movement: { steps: 10 },
      quests: false,
    });
    expect(tick.eventRecords.map((event) => event.type)).toContain('movement-completed');
    expect(runtime.inspectTile('2,0', { sourceActor: 'hero' })).toMatchObject({
      exists: true,
      tileKey: '2,0',
      hasActors: true,
      actors: [{ actor: { actorId: 'hero' } }],
      canEnter: true,
    });
    expect(
      runtime.inspectNeighborhood('hero', {
        radius: 1,
        sourceActor: 'hero',
        canEnter: true,
      })
    ).toMatchObject({
      centerKey: '2,0',
      radius: 1,
      enterableTileKeys: ['2,0', '1,0'],
      actors: [expect.objectContaining({ actor: expect.objectContaining({ actorId: 'hero' }) })],
    });
    expect(runtime.selectActors({ sourceActor: 'hero', radius: 1 })).toMatchObject({
      count: 1,
      actorIds: ['hero'],
      records: [{ actorId: 'hero', tileKey: '2,0', distance: 0 }],
      centerKey: '2,0',
      radius: 1,
    });
    runtime.spawnActor({
      id: 'runtime-raider-placement',
      actorId: 'runtime-raider',
      actorKind: 'enemy',
      team: 'red',
      at: '1,0',
      assetId: 'flag_red',
      kind: 'unit',
    });
    expect(
      runtime.inspectActorTargets({
        sourceActor: 'hero',
        hostileToSource: true,
        maxPathCost: 1,
      })
    ).toMatchObject({
      targetActorIds: ['runtime-raider'],
      reachableActorIds: ['runtime-raider'],
      nearestTarget: {
        actor: { actor: { actorId: 'runtime-raider' } },
        approach: 'adjacent',
        approachTileKey: '2,0',
        path: { found: true, cost: 0 },
      },
    });
    expect(
      runtime.planActorTargetCommand({
        sourceActor: 'hero',
        hostileToSource: true,
        targetActorId: 'runtime-raider',
        maxPathCost: 1,
      })
    ).toMatchObject({
      canExecute: true,
      target: { actor: { actor: { actorId: 'runtime-raider' } } },
      command: { kind: 'attack-actor', actorId: 'runtime-raider' },
    });
    expect(
      runtime.dispatchActorTargetCommand({
        sourceActor: 'hero',
        hostileToSource: true,
        targetActorId: 'runtime-raider',
        maxPathCost: 1,
      })
    ).toMatchObject({
      targetCommand: {
        canExecute: true,
        target: { actor: { actor: { actorId: 'runtime-raider' } } },
      },
      dispatch: {
        events: [{ type: 'command-handler-required' }],
        eventRecords: [{ type: 'command-handler-required' }],
      },
    });
    expect(
      runtime.interactActorTarget(
        {
          sourceActor: 'hero',
          hostileToSource: true,
          targetActorId: 'runtime-raider',
          maxPathCost: 0,
        },
        { systems: false }
      )
    ).toMatchObject({
      targetCommand: {
        canExecute: true,
        command: { kind: 'attack-actor', actorId: 'runtime-raider' },
      },
      interaction: {
        events: [{ type: 'command-handler-required' }],
      },
    });

    const snapshot: GameboardRuntimeSnapshot = runtime.snapshot({
      includeValidationPlan: true,
      spawnLocations: { count: 1, candidates: [{ q: 2, r: 0 }] },
    });
    expect(snapshot.actors.map((actor) => [actor.actor.actorId, actor.placement.tileKey])).toEqual([
      ['hero', '2,0'],
      ['runtime-raider', '1,0'],
    ]);
    expect(snapshot.plan.placements.find((placement) => placement.id === 'hero-placement')).toMatchObject({
      tileKey: '2,0',
      kind: 'unit',
    });
    expect(snapshot.validationPlan?.placements.find((placement) => placement.id === 'hero-placement')).toMatchObject({
      tileKey: '2,0',
    });
    expect(snapshot.interop?.spawnLocations).toHaveLength(1);
    const snapshotInterop = snapshot.interop;
    expect(snapshotInterop).toBeDefined();
    expect(snapshotInterop?.entities.map((entity) => entity.id)).toContain('actor:hero');
    expect(
      snapshotInterop
        ? selectGameboardInteropRelations(snapshotInterop, {
            name: 'ActorPlacement',
            fromId: 'actor:hero',
          })
        : []
    ).toEqual([
      expect.objectContaining({
        toId: 'placement:hero-placement',
      }),
    ]);
    expect(snapshot.placementOccupancy.some((record) => record.placement.id === 'hero-placement')).toBe(true);

    const liveInterop = runtime.createInteropSnapshot();
    const ecs = createInMemoryGameboardEcs();
    const mounted = runtime.mountInterop(ecs.adapter);
    expect(liveInterop.entities.map((entity) => entity.id)).toContain('actor:hero');
    expect(mounted.missingRelations).toEqual([]);
    expect(ecs.entities.get('actor:hero')?.components.get('GameboardActorState')).toMatchObject({
      actorId: 'hero',
      placement: expect.objectContaining({ tileKey: '2,0' }),
    });
  });

  it('spawns declared pieces and layout fills against live runtime occupancy', () => {
    const runtime = createGameboardRuntime(
      createGameboardBuilder({
        seed: 'runtime-pieces',
        shape: { kind: 'rectangle', width: 3, height: 2 },
      }).build()
    );
    const tree = declareGameboardPiece({
      id: 'runtime-tree',
      assetId: 'tree_single_A',
      source: 'Runtime fixtures',
      role: 'tree',
    });

    const inspection = runtime.inspectPiecePlacement(tree, {
      count: 1,
      seed: 'runtime-piece-inspection',
    });
    expect(inspection).toMatchObject({
      pieceId: 'runtime-tree',
      siteInspection: { selectedCount: 1 },
    });
    expect(runtime.createPiecePlacementOptions(tree, { count: 1 })).toMatchObject({
      assetId: 'tree_single_A',
      archetype: 'tree',
    });
    expect(runtime.createPiecePlacements(tree, { count: 1, seed: 'runtime-piece-create' })).toHaveLength(1);

    const spawnedPiece = runtime.spawnPiece(tree, {
      count: 1,
      seed: 'runtime-piece-spawn',
      occupancyGuard: true,
    });
    const spawnedFill = runtime.spawnLayoutFill({
      seed: 'runtime-piece-fill',
      rules: [{ id: 'runtime-crates', archetype: 'scatter', assetId: 'crate_A_small', count: 1 }],
    });

    expect(spawnedPiece).toHaveLength(1);
    expect(spawnedFill).toHaveLength(1);
    expect(
      runtime.snapshot({ includeInterop: false }).placements.map((placement) => placement.metadata)
    ).toEqual(expect.arrayContaining([expect.objectContaining({ pieceId: 'runtime-tree' })]));
  });

  it('lets piece spawn guards fail fast when live occupancy changed', () => {
    const runtime = createGameboardRuntime(
      createGameboardBuilder({
        seed: 'runtime-piece-guards',
        shape: { kind: 'rectangle', width: 1, height: 1 },
      }).build()
    );
    runtime.spawnActor({
      actorId: 'blocker',
      actorKind: 'enemy',
      at: '0,0',
      assetId: 'flag_red',
      kind: 'unit',
    });
    const blockingProp = declareGameboardPiece({
      id: 'runtime-blocking-prop',
      assetId: 'crate_A_small',
      source: 'Runtime fixtures',
      role: 'prop',
      metadata: { layoutBlocksMovement: true },
    });

    expect(() => runtime.spawnPiece(blockingProp, { occupancyGuard: true })).toThrow(
      /cannot occupy/
    );
  });

  it('selects, inspects, analyzes, and spawns registry-driven piece fills', () => {
    const runtime = createGameboardRuntime(
      createGameboardBuilder({
        seed: 'runtime-piece-registry',
        shape: { kind: 'rectangle', width: 4, height: 2 },
      }).build()
    );
    const registry = createGameboardPieceRegistry([
      {
        id: 'runtime-registry-tree-a',
        assetId: 'tree_single_A',
        source: 'Runtime fixtures',
        role: 'tree',
        tags: ['nature', 'foliage'],
      },
      {
        id: 'runtime-registry-tree-b',
        assetId: 'tree_single_B',
        source: 'Runtime fixtures',
        role: 'tree',
        tags: ['nature', 'foliage'],
      },
      {
        id: 'runtime-registry-crate',
        assetId: 'crate_A_small',
        source: 'Runtime fixtures',
        role: 'scatter',
        tags: ['camp'],
        metadata: { sourceRelativePath: 'props/crate A small.gltf' },
      },
    ]);

    const analysis = runtime.analyzePieceRegistry(registry, {
      checks: [{ id: 'nature-pool', mode: 'pool', selection: { tags: ['nature'] } }],
    });
    expect(analysis).toMatchObject({
      pieceCount: 3,
      roleCounts: { tree: 2, scatter: 1 },
      checks: [{ id: 'nature-pool', selectedCount: 2, errors: [] }],
    });
    expect(runtime.selectPieces(registry, { roles: ['tree'] }).map((piece) => piece.id)).toEqual([
      'runtime-registry-tree-a',
      'runtime-registry-tree-b',
    ]);

    const campRules = runtime.createPieceFillRules(registry, {
      selection: { tags: ['camp'] },
      count: 1,
      occupancyGuard: true,
    });
    expect(campRules).toHaveLength(1);
    expect(campRules[0]).toMatchObject({
      id: 'piece:runtime-registry-crate',
      assetId: 'crate_A_small',
      occupancyGuard: true,
    });

    const naturePoolRule = runtime.createPiecePoolFillRule(
      runtime.selectPieces(registry, { tags: ['nature'] }),
      { id: 'nature-pool', count: 2 }
    );
    expect(naturePoolRule).toMatchObject({
      id: 'nature-pool',
      assets: ['tree_single_A', 'tree_single_B'],
      metadata: { pieceCollectionSize: 2 },
    });
    expect(
      runtime.createPieceSourceUrlMap(registry, {
        sourceRoots: { 'Runtime fixtures': '/assets/runtime-fixtures' },
      })
    ).toMatchObject({
      crate_A_small: '/assets/runtime-fixtures/props/crate%20A%20small.gltf',
    });

    const fills = [
      {
        id: 'runtime-registry-nature',
        mode: 'pool' as const,
        selection: { tags: ['nature'] },
        count: 2,
        occupancyGuard: true,
      },
      {
        ruleIdPrefix: 'runtime-registry-camp',
        selection: { tags: ['camp'] },
        count: 1,
        occupancyGuard: true,
      },
    ];
    const fillAnalysis = runtime.analyzePieceFills(registry, fills, {
      seed: 'runtime-registry-fills',
    });
    const inspection = runtime.inspectPieceFills(registry, fills, {
      seed: 'runtime-registry-fills',
    });
    expect(fillAnalysis).toMatchObject({
      errorCount: 0,
      placementCount: 3,
    });
    expect(inspection).toMatchObject({
      selectedPieceCount: 3,
      analysis: { errorCount: 0, placementCount: 3 },
      selections: [
        { id: 'runtime-registry-nature', mode: 'pool', selectedCount: 2 },
        { id: 'runtime-registry-camp', mode: 'per-piece', selectedCount: 1 },
      ],
    });

    const spawned = runtime.spawnPieceFills(registry, fills, {
      seed: 'runtime-registry-fills',
    });
    expect(spawned).toHaveLength(3);
    expect(runtime.snapshot({ includeInterop: false }).placements.map((placement) => placement.metadata)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pieceCollectionSize: 2, pieceRoles: 'tree' }),
        expect.objectContaining({ pieceId: 'runtime-registry-crate', pieceRole: 'scatter' }),
      ])
    );
  });

  it('instantiates recipe runtimes with generated pieces and renderer source URLs', () => {
    const recipe = createGameboardRecipe(
      { seed: 'runtime-recipe', shape: { kind: 'rectangle', width: 4, height: 2 } },
      [],
      {
        layoutFillSeed: 'runtime-recipe:fill',
        layoutArchetypes: {
          'runtime-grove': {
            id: 'runtime-grove',
            label: 'Runtime Grove',
            kind: 'decoration',
            layer: 'feature',
            criteria: { terrain: ['grass', 'forest'], allowOccupied: true, maxPerTile: 2 },
          },
        },
        pieceDeclarations: [
          {
            id: 'runtime-recipe-tree',
            assetId: 'tree_single_A',
            source: 'Runtime recipe fixtures',
            role: 'tree',
            archetype: 'runtime-grove',
            tags: ['nature'],
            metadata: { sourceRelativePath: 'nature/tree.gltf' },
          },
        ],
        pieceFills: [
          {
            selection: { ids: ['runtime-recipe-tree'] },
            count: 1,
            ruleIdPrefix: 'runtime-recipe',
          },
        ],
      }
    );

    const runtime = createGameboardRuntimeFromRecipe(recipe);

    expect(runtime.recipe.options.seed).toBe('runtime-recipe');
    expect(runtime.recipeLayoutArchetypes?.['runtime-grove']?.id).toBe('runtime-grove');
    expect(runtime.recipeLayoutArchetypes?.tree?.id).toBe('tree');
    expect(runtime.recipePieceRegistry?.pieces.map((piece) => piece.id)).toEqual([
      'runtime-recipe-tree',
    ]);
    expect(runtime.plan().placements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: 'tree_single_A',
          metadata: expect.objectContaining({ pieceId: 'runtime-recipe-tree' }),
        }),
      ])
    );
    expect(
      runtime.createRecipePieceSourceUrlMap({
        sourceRoots: { 'Runtime recipe fixtures': '/runtime-recipe-fixtures' },
      })
    ).toEqual({
      tree_single_A: '/runtime-recipe-fixtures/nature/tree.gltf',
    });
  });

  it('instantiates scenario runtimes with live actor and quest indexes', () => {
    const scenario = createGameboardScenario(
      'runtime-scenario',
      createGameboardRecipe(
        {
          seed: 'runtime-scenario',
          shape: { kind: 'rectangle', width: 2, height: 1 },
        },
        [],
        {
          layoutArchetypes: {
            'scenario-grove': {
              id: 'scenario-grove',
              label: 'Scenario Grove',
              kind: 'decoration',
              layer: 'feature',
              criteria: { terrain: ['grass', 'forest'], allowOccupied: true, maxPerTile: 2 },
            },
          },
          pieceDeclarations: [
            {
              id: 'runtime-scenario-tree',
              assetId: 'tree_single_A',
              source: 'Runtime scenario fixtures',
              role: 'tree',
              archetype: 'scenario-grove',
              tags: ['scenario'],
              metadata: { sourceRelativePath: 'trees/scenario-tree.gltf' },
            },
          ],
        }
      ),
      {
        title: 'Runtime Scenario',
        metadata: { fixture: true },
        actors: [
          {
            actorId: 'player',
            actorKind: 'player',
            at: '0,0',
            assetId: 'flag_blue',
            kind: 'unit',
            movementAgent: { profile: 'worker', movementBudget: 2 },
          },
        ],
        quests: [
          {
            id: 'runtime-scenario:intro',
            objectives: [
              {
                id: 'stand-on-start',
                kind: 'reach-tile',
                actor: 'player',
                tile: '0,0',
              },
            ],
          },
        ],
      }
    );

    const runtime = createGameboardRuntimeFromScenario(scenario);
    expect(runtime.scenarioRuntime.scenario.id).toBe('runtime-scenario');
    expect(runtime.actorEntities.player).toBeDefined();
    expect(runtime.questEntities['runtime-scenario:intro']).toBeDefined();
    expect(runtime.scenarioLayoutArchetypes?.['scenario-grove']?.id).toBe('scenario-grove');
    expect(runtime.scenarioLayoutArchetypes?.tree?.id).toBe('tree');
    expect(runtime.scenarioPieceRegistry?.pieces.map((piece) => piece.id)).toEqual([
      'runtime-scenario-tree',
    ]);
    expect(
      runtime.createScenarioPieceSourceUrlMap({
        sourceRoots: { 'Runtime scenario fixtures': '/runtime-scenario-fixtures' },
      })
    ).toEqual({
      tree_single_A: '/runtime-scenario-fixtures/trees/scenario-tree.gltf',
    });

    const liveInterop = runtime.createInteropSnapshot();
    const scenarioInterop = runtime.createScenarioInteropSnapshot();
    const ecs = createInMemoryGameboardEcs();
    const mounted = runtime.mountScenarioInterop(ecs.adapter);
    expect(liveInterop.entities.map((entity) => entity.id)).toEqual(
      expect.arrayContaining(['actor:player', 'quest:runtime-scenario:intro'])
    );
    expect(liveInterop.scenario).toEqual({
      id: 'runtime-scenario',
      title: 'Runtime Scenario',
      metadata: { fixture: true },
    });
    expect(scenarioInterop.entities.map((entity) => entity.id)).toEqual(
      expect.arrayContaining(['actor:player', 'quest:runtime-scenario:intro'])
    );
    expect(mounted.missingRelations).toEqual([]);
    expect(ecs.entities.get('actor:player')?.components.get('ScenarioActor')).toMatchObject({
      actorId: 'player',
    });

    const tick = runtime.tick({
      patrols: false,
      movement: false,
      quests: { step: 1 },
    });
    expect(tick.quests[0]?.quest.status).toBe('completed');
    expect(runtime.snapshot({ includeInterop: false }).interop).toBeUndefined();
  });
});
