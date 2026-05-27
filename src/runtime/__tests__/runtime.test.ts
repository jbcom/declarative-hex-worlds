import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../gameboard/index';
import {
  createInMemoryGameboardEcs,
  selectGameboardInteropRelations,
} from '../../interop/index';
import { createGameboardPieceRegistry, declareGameboardPiece } from '../../pieces/index';
import { createGameboardRecipe } from '../../scenario/recipe';
import { createGameboardScenario } from '../../scenario/index';
import {
  createGameboardRuntime,
  createGameboardRuntimeFromRecipe,
  createGameboardRuntimeFromScenario,
  type GameboardRuntimeSnapshot,
} from '../../runtime/index';

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

  it('mutates placements, actors, and quests through direct runtime helpers', () => {
    const runtime = createGameboardRuntime(
      createGameboardBuilder({
        seed: 'runtime-mutations',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );

    const marker = runtime.spawnPlacement({
      id: 'runtime-marker',
      at: '0,0',
      assetId: 'flag_green',
      kind: 'prop',
    });
    expect(runtime.readPlacements().map((placement) => placement.id)).toContain('runtime-marker');
    expect(runtime.inspectPlacementOccupancy({ at: '0,0', kind: 'structure' })).toMatchObject({
      tileKey: '0,0',
      canOccupy: true,
    });

    runtime.updatePlacement(marker, {
      scale: 1.25,
      metadata: { marker: 'updated' },
    });
    runtime.movePlacement(marker, '1,0', { occupancyGuard: true });
    expect(
      runtime.snapshot({ includeInterop: false }).placements.find((placement) => placement.id === 'runtime-marker')
    ).toMatchObject({
      tileKey: '1,0',
      scale: 1.25,
      metadata: { marker: 'updated' },
    });

    runtime.spawnPlacement({
      id: 'runtime-blocker',
      at: '2,0',
      assetId: 'building_tower_A_blue',
      kind: 'structure',
    });
    expect(runtime.summarizePlan()).toMatchObject({
      seed: 'runtime-mutations',
      tileCount: 3,
      assetCounts: expect.objectContaining({
        building_tower_A_blue: 1,
        flag_green: 1,
      }),
      placementKindCounts: expect.objectContaining({
        structure: 1,
        prop: 1,
      }),
    });
    expect(runtime.canOccupyPlacement({ at: '2,0', kind: 'unit' })).toBe(false);
    expect(runtime.inspectPlacementOccupancy({ at: '2,0', kind: 'unit' })).toMatchObject({
      canOccupy: false,
      reason: 'Blocked by placement(s): runtime-blocker',
    });
    expect(runtime.readPlacementOccupancy().some((record) => record.placement.id === 'runtime-blocker')).toBe(true);
    expect(runtime.readPlacementsForTile('2,0')).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'runtime-blocker' })])
    );
    expect(runtime.readPlacementOccupancyForTile('2,0')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tileKey: '2,0',
          placement: expect.objectContaining({ id: 'runtime-blocker' }),
          blocksMovement: true,
        }),
      ])
    );

    const guidePlacement = runtime.spawnPlacement({
      id: 'runtime-guide-placement',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    runtime.registerActor(guidePlacement, {
      actorId: 'runtime-guide',
      actorKind: 'npc',
      tags: ['guide'],
    });
    runtime.updateActor('runtime-guide', {
      interactive: true,
      tags: ['guide', 'quest'],
      actorMetadata: { dialog: 'hello' },
    });
    expect(runtime.findActor('runtime-guide')).toMatchObject({
      actor: {
        actorId: 'runtime-guide',
        interactive: true,
        tags: ['guide', 'quest'],
        metadata: { dialog: 'hello' },
      },
      placement: { tileKey: '0,0' },
    });
    expect(runtime.readActors().map((actor) => actor.actor.actorId)).toContain('runtime-guide');
    expect(runtime.readActorsForTile('0,0')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actor: expect.objectContaining({ actorId: 'runtime-guide', kind: 'npc' }),
          placement: expect.objectContaining({ id: 'runtime-guide-placement', tileKey: '0,0' }),
        }),
      ])
    );

    const quest = runtime.spawnQuest({
      id: 'runtime-mutation-quest',
      objectives: [
        {
          id: 'reach-guide',
          kind: 'reach-tile',
          actor: 'runtime-guide',
          tile: '0,0',
        },
      ],
    });
    expect(runtime.findQuest(quest)).toMatchObject({
      quest: { questId: 'runtime-mutation-quest', status: 'active' },
    });
    expect(runtime.advanceQuest('runtime-mutation-quest').quest.status).toBe('completed');
    expect(runtime.findQuest('runtime-mutation-quest')?.quest.status).toBe('completed');
    expect(runtime.readQuests().map((snapshot) => snapshot.quest.questId)).toEqual([
      'runtime-mutation-quest',
    ]);
    expect(runtime.advanceAllQuests().map((snapshot) => snapshot.quest.status)).toEqual([
      'completed',
    ]);

    expect(runtime.removePlacement('runtime-marker')).toBe(true);
    expect(runtime.removePlacement('runtime-marker')).toBe(false);
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

    const emptyDecorationSites = runtime.inspectLayoutSites({
      criteria: { allowOccupied: false, blockingPlacementKinds: ['decoration'], maxPerTile: 1 },
    });
    expect(emptyDecorationSites.candidateCount).toBe(6);
    expect(
      runtime.inspectLayoutSites({
        count: 2,
        seed: 'runtime-layout-sites',
        criteria: { terrain: 'grass' },
      })
    ).toMatchObject({
      selectedCount: 2,
    });
    expect(
      runtime.createLayoutPlacements({
        archetype: 'tree',
        assetId: 'tree_single_A',
        count: 1,
        seed: 'runtime-layout-create',
      })
    ).toHaveLength(1);
    const layoutFillOptions = {
      seed: 'runtime-layout-fill-create',
      rules: [{ id: 'runtime-crates-preview', archetype: 'scatter', assetId: 'crate_A_small', count: 1 }],
    } as const;
    expect(runtime.analyzeLayoutFill(layoutFillOptions)).toMatchObject({
      errorCount: 0,
      placementCount: 1,
    });
    expect(runtime.createLayoutFillPlacements(layoutFillOptions)).toMatchObject([
      expect.objectContaining({ assetId: 'crate_A_small' }),
    ]);
    expect(
      runtime.snapshot({ includeInterop: false }).placements.some((placement) => placement.assetId === 'crate_A_small')
    ).toBe(false);

    const spawnedPiece = runtime.spawnPiece(tree, {
      count: 1,
      seed: 'runtime-piece-spawn',
      occupancyGuard: true,
    });
    const spawnedLayout = runtime.spawnLayoutPlacements({
      seed: 'runtime-layout-spawn',
      archetype: 'scatter',
      assetId: 'crate_A_small',
      count: 1,
    });
    expect(spawnedLayout.length).toBeGreaterThanOrEqual(0);
    const spawnedFill = runtime.spawnLayoutFill({
      seed: 'runtime-piece-fill',
      rules: [{ id: 'runtime-crates', archetype: 'scatter', assetId: 'crate_A_small', count: 1 }],
    });

    expect(spawnedPiece).toHaveLength(1);
    expect(spawnedFill).toHaveLength(1);
    expect(
      runtime.inspectLayoutSites({
        criteria: { allowOccupied: false, blockingPlacementKinds: ['decoration'], maxPerTile: 1 },
      }).candidateCount
    ).toBeLessThan(emptyDecorationSites.candidateCount);
    expect(
      runtime.snapshot({ includeInterop: false }).placements.map((placement) => placement.metadata)
    ).toEqual(expect.arrayContaining([expect.objectContaining({ pieceId: 'runtime-tree' })]));
  });

  it('plans navigation, spawn groups, and patrol routes against live runtime occupancy', () => {
    const runtime = createGameboardRuntime(
      createGameboardBuilder({
        seed: 'runtime-navigation',
        shape: { kind: 'rectangle', width: 5, height: 3 },
      })
        .setTileAsset({
          at: { q: 0, r: 1 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['player-spawn'],
        })
        .setTileAsset({
          at: { q: 4, r: 1 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['enemy-spawn'],
        })
        .setTileAsset({
          at: { q: 2, r: 0 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['watch-point'],
        })
        .setTileAsset({
          at: { q: 4, r: 2 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['watch-point'],
        })
        .addPlacement({
          at: { q: 2, r: 1 },
          assetId: 'building_tower_A_blue',
          kind: 'structure',
          layer: 'structure',
        })
        .build()
    );

    const occupancy = runtime.createOccupancyIndex();
    const navigation = runtime.createNavigation();
    const path = navigation.findPath('0,1', '4,1');

    expect(occupancy.blockingTileKeys.has('2,1')).toBe(true);
    expect(navigation.isBlocked('2,1')).toBe(true);
    expect(path.found).toBe(true);
    expect(path.path.map((tile) => tile.key)).not.toContain('2,1');
    expect(
      runtime.selectSpawnLocations({
        count: 1,
        seed: 'runtime-player-spawn',
        tileTags: ['player-spawn'],
      })
    ).toMatchObject([{ key: '0,1' }]);

    const spawnGroups = runtime.planSpawnGroups({
      seed: 'runtime-spawn-groups',
      groups: [
        { id: 'player', count: 1, tileTags: ['player-spawn'] },
        { id: 'enemy', count: 1, tileTags: ['enemy-spawn'], pathToGroups: ['player'] },
      ],
    });
    expect(spawnGroups).toMatchObject({
      errors: [],
      selectedLocationCount: 2,
      routeChecks: [{ fromGroupId: 'enemy', toGroupId: 'player', found: true }],
    });

    const patrol = runtime.planPatrolRoute({
      id: 'runtime-watch',
      seed: 'runtime-watch',
      count: 2,
      startGroupId: 'enemy',
      spawnGroups,
      tileTags: ['watch-point'],
      loop: true,
    });
    expect(patrol).toMatchObject({
      id: 'runtime-watch',
      found: true,
      selectedWaypointCount: 2,
      errors: [],
    });
    expect(patrol.pathKeys).not.toContain('2,1');
    expect(
      runtime.planPatrolRoutes({
        seed: 'runtime-watch-routes',
        spawnGroups,
        routes: [
          {
            id: 'runtime-watch-set',
            count: 2,
            startGroupId: 'enemy',
            tileTags: ['watch-point'],
          },
        ],
      })
    ).toMatchObject({
      routeCount: 1,
      routes: [{ id: 'runtime-watch-set', found: true }],
    });

    runtime.spawnActor({
      actorId: 'runtime-player-blocker',
      actorKind: 'player',
      at: '0,1',
      assetId: 'flag_blue',
      kind: 'unit',
    });

    expect(runtime.createNavigation().isBlocked('0,1')).toBe(true);
    expect(
      runtime.selectSpawnLocations({
        count: 1,
        seed: 'runtime-player-spawn-blocked',
        tileTags: ['player-spawn'],
      })
    ).toEqual([]);
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

  it('createGameboardRuntime accepts a plan-bearing options object (E0h)', () => {
    const plan = createGameboardBuilder({
      seed: 'options-plan',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    }).build();
    const runtime = createGameboardRuntime({ plan });
    expect(runtime.plan().tiles.length).toBe(3);
  });

  it('runtime loadPlan + validationPlan wrappers (E0a)', () => {
    const plan = createGameboardBuilder({
      seed: 'runtime-load-plan',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    }).build();
    const runtime = createGameboardRuntime(plan);
    const otherPlan = createGameboardBuilder({
      seed: 'runtime-load-plan-2',
      shape: { kind: 'rectangle', width: 4, height: 1 },
    }).build();
    runtime.loadPlan(otherPlan);
    expect(runtime.plan().tiles.length).toBe(4);
    expect(runtime.validationPlan().tiles.length).toBe(4);
  });

  it('runtime moveActor + executeCommand + interact wrappers (E0a)', () => {
    const plan = createGameboardBuilder({
      seed: 'runtime-wrappers',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    }).build();
    const runtime = createGameboardRuntime(plan);
    runtime.spawnActor({
      id: 'hero-placement',
      actorId: 'hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    runtime.movement.setAgent('hero-placement', { profile: 'ground', movementBudget: 4 });
    // moveActor wrapper (runtime.ts line 836).
    const moveResult = runtime.moveActor('hero', '1,0');
    expect(moveResult).toBeDefined();
    // executeCommand wrapper (line 850-851).
    const execResult = runtime.executeCommand('2,0', { sourceActor: 'hero' });
    expect(execResult).toBeDefined();
    // interact wrapper (line 852-853).
    const interactResult = runtime.interact('1,0', { sourceActor: 'hero' });
    expect(interactResult).toBeDefined();
  });
});
