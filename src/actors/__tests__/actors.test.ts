import { describe, expect, it } from 'vitest';
import {
  BlockingActorQuery,
  EnemyActorQuery,
  GameboardActor,
  HostileActorQuery,
  areGameboardActorsHostile,
  InteractiveActorQuery,
  PlayerActorQuery,
  classifyGameboardPlacement,
  createGameboardActorNavigationProfile,
  gameboardActorActions,
  gameboardActorBlocksMovement,
  inspectGameboardActorCollision,
  inspectGameboardActorTargets,
  inspectGameboardInteractionTarget,
  inspectGameboardNeighborhood,
  inspectGameboardTile,
  moveGameboardActor,
  planGameboardInteractionCommand,
  readGameboardActors,
  selectGameboardActors,
  spawnGameboardActor,
  updateGameboardActor,
} from '../../actors/index';
import { createGameboardBuilder } from '../../gameboard/index';
import { axialToWorld } from '../../coordinates/grid';
import { PlacementState, createGameboardWorld, findPlacementEntity } from '../../koota/index';
import { requestGameboardMovement } from '../../movement/index';

describe('gameboard actor semantics', () => {
  it('registers actors on placements and classifies players, props, NPCs, and enemies', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'actors-classify',
        shape: { kind: 'rectangle', width: 2, height: 2 },
      }).build()
    );

    const player = spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      team: 'blue',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const npc = spawnGameboardActor(world, {
      actorId: 'elder',
      actorKind: 'npc',
      team: 'blue',
      at: '1,0',
      assetId: 'flag_green',
      kind: 'prop',
    });
    const prop = spawnGameboardActor(world, {
      actorId: 'cache',
      actorKind: 'prop',
      at: '0,1',
      assetId: 'crate_A_small',
      kind: 'prop',
    });
    const enemy = spawnGameboardActor(world, {
      actorId: 'raider',
      actorKind: 'enemy',
      team: 'red',
      at: '1,1',
      assetId: 'flag_red',
      kind: 'prop',
    });

    expect(world.query(PlayerActorQuery)).toHaveLength(1);
    expect(world.query(InteractiveActorQuery)).toHaveLength(2);
    expect(world.query(EnemyActorQuery)).toHaveLength(1);
    expect(world.query(HostileActorQuery)).toHaveLength(1);
    expect(world.query(BlockingActorQuery)).toHaveLength(2);
    expect(classifyGameboardPlacement(world, prop)).toBe('prop');
    expect(classifyGameboardPlacement(world, enemy)).toBe('enemy');
    expect(readGameboardActors(world).map((actor) => actor.actor.actorId)).toEqual([
      'cache',
      'elder',
      'hero',
      'raider',
    ]);

    const propCollision = inspectGameboardActorCollision(world, player, '0,1');
    const npcCollision = inspectGameboardActorCollision(world, player, '1,0');
    const enemyCollision = inspectGameboardActorCollision(world, player, '1,1');

    expect(npc.get(GameboardActor)).toMatchObject({ interactive: true, blocksMovement: false });
    expect(propCollision).toMatchObject({ canEnter: true });
    expect(npcCollision.interactiveActors.map((actor) => actor.actor.actorId)).toEqual(['elder']);
    expect(enemyCollision).toMatchObject({ canEnter: false });
    expect(enemyCollision.hostileActors.map((actor) => actor.actor.actorId)).toEqual(['raider']);
  });

  it('adds actor-aware collision rules to movement without changing placement kind', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'actors-movement',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    const player = spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      team: 'blue',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const blocker = spawnGameboardActor(world, {
      actorId: 'illusion',
      actorKind: 'enemy',
      team: 'red',
      at: '1,0',
      assetId: 'flag_red',
      kind: 'prop',
    });
    const playerId = player.get(GameboardActor)?.actorId ?? '';
    const placementId = findPlacementEntity(world, player)?.get(GameboardActor)?.actorId ?? '';

    expect(playerId).toBe('hero');
    expect(placementId).toBe('hero');
    expect(requestGameboardMovement(world, player, '2,0').state.status).toBe('ready');
    expect(
      requestGameboardMovement(world, player, '2,0', {
        navigation: createGameboardActorNavigationProfile(world, 'hero'),
      }).state.status
    ).toBe('blocked');

    updateGameboardActor(world, blocker, { blocksMovement: false, hostile: false });
    expect(
      requestGameboardMovement(world, player, '2,0', {
        navigation: createGameboardActorNavigationProfile(world, 'hero'),
      }).state.status
    ).toBe('ready');
  });

  it('treats blocking layout footprints as occupied during actor collision inspection', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'actors-footprint-collision',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      })
        .addPlacement({
          at: { q: 1, r: 0 },
          assetId: 'external:gatehouse',
          kind: 'prop',
          layer: 'feature',
          requiresExtra: true,
          metadata: {
            layoutBlocksMovement: true,
            layoutFootprintTiles: '1,0|2,0',
          },
        })
        .build()
    );
    const player = spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      team: 'blue',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const collision = inspectGameboardActorCollision(world, player, '2,0');

    expect(collision.canEnter).toBe(false);
    expect(collision.blockingPlacements.map((placement) => placement.assetId)).toEqual([
      'external:gatehouse',
    ]);
  });

  it('summarizes tile contents for UI, AI, and external ECS bridges', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'actors-tile-inspection',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      })
        .addPlacement({
          at: { q: 1, r: 0 },
          assetId: 'external:gatehouse',
          kind: 'prop',
          layer: 'feature',
          requiresExtra: true,
          metadata: {
            layoutBlocksMovement: true,
            layoutFootprintTiles: '1,0|2,0',
          },
        })
        .build()
    );
    spawnGameboardActor(world, {
      id: 'hero',
      actorId: 'hero',
      actorKind: 'player',
      team: 'blue',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      actorId: 'raider',
      actorKind: 'enemy',
      team: 'red',
      at: '2,0',
      assetId: 'flag_red',
      kind: 'unit',
    });

    const inspection = inspectGameboardTile(world, '2,0', { sourceActor: 'hero' });

    expect(inspection).toMatchObject({
      exists: true,
      tileKey: '2,0',
      terrain: 'grass',
      elevation: 0,
      hasActors: true,
      hasHostiles: true,
      canEnter: false,
    });
    expect(inspection.actors.map((actor) => actor.actor.actorId)).toEqual(['raider']);
    expect(inspection.hostileActors.map((actor) => actor.actor.actorId)).toEqual(['raider']);
    expect(inspection.placements.map((placement) => placement.assetId)).toEqual([
      'hex_grass',
      'external:gatehouse',
      'flag_red',
    ]);
    expect(inspection.occupancy.map((record) => record.placement.assetId)).toEqual([
      'hex_grass',
      'external:gatehouse',
      'flag_red',
    ]);
    expect(inspection.blockingPlacements.map((placement) => placement.assetId)).toEqual([
      'external:gatehouse',
      'flag_red',
    ]);

    expect(gameboardActorActions(world).tile('missing')).toMatchObject({
      exists: false,
      canEnter: false,
      reason: 'No tile exists at missing',
    });
  });

  it('summarizes nearby tiles and actor buckets for AI and hover previews', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'actors-neighborhood-inspection',
        shape: { kind: 'rectangle', width: 3, height: 2 },
      })
        .setTerrain({ q: 2, r: 0 }, 'water')
        .build()
    );
    const player = spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      team: 'blue',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      id: 'elder',
      actorId: 'elder',
      actorKind: 'npc',
      team: 'blue',
      at: '1,0',
      assetId: 'flag_green',
      kind: 'prop',
    });
    spawnGameboardActor(world, {
      actorId: 'raider',
      actorKind: 'enemy',
      team: 'red',
      at: '1,1',
      assetId: 'flag_red',
      kind: 'unit',
    });

    const neighborhood = inspectGameboardNeighborhood(world, player, {
      radius: 2,
      sourceActor: 'hero',
    });

    expect(neighborhood).toMatchObject({
      center: { q: 0, r: 0 },
      centerKey: '0,0',
      radius: 2,
    });
    expect(neighborhood.tiles.map((tile) => tile.tileKey)).toEqual([
      '0,0',
      '0,1',
      '1,0',
      '1,1',
      '2,0',
    ]);
    expect(neighborhood.actors.map((actor) => actor.actor.actorId)).toEqual([
      'elder',
      'hero',
      'raider',
    ]);
    expect(neighborhood.hostileActors.map((actor) => actor.actor.actorId)).toEqual(['raider']);
    expect(neighborhood.interactiveActors.map((actor) => actor.actor.actorId)).toEqual(['elder']);
    expect(neighborhood.occupiedTileKeys).toEqual(['0,0', '1,0', '1,1']);
    expect(neighborhood.blockingTileKeys).toEqual(['1,1']);
    expect(neighborhood.enterableTileKeys).toEqual(['0,0', '0,1', '1,0', '2,0']);

    expect(
      gameboardActorActions(world)
        .neighborhood('hero', { radius: 2, sourceActor: 'hero', hasHostiles: true })
        .tiles.map((tile) => tile.tileKey)
    ).toEqual(['1,1']);
    expect(
      inspectGameboardNeighborhood(world, '0,0', {
        radius: 2,
        sourceActor: 'hero',
        terrain: 'water',
      }).tiles.map((tile) => tile.tileKey)
    ).toEqual(['2,0']);
  });

  it('throws when neighborhood center string resolves to nothing (E0b)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'neighborhood-unknown-center',
        shape: { kind: 'rectangle', width: 2, height: 2 },
      }).build()
    );
    expect(() =>
      inspectGameboardNeighborhood(world, 'no-such-thing-anywhere', { radius: 1 })
    ).toThrow(/neighborhood center/);
  });

  it('selects actors by source, hostility, tags, tile range, and stable buckets', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'actors-selection',
        shape: { kind: 'rectangle', width: 3, height: 2 },
      }).build()
    );
    spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      team: 'blue',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
      tags: ['party'],
    });
    spawnGameboardActor(world, {
      actorId: 'elder',
      actorKind: 'npc',
      team: 'blue',
      at: '1,0',
      assetId: 'flag_green',
      kind: 'prop',
      tags: ['quest'],
    });
    spawnGameboardActor(world, {
      id: 'cache',
      actorId: 'cache',
      actorKind: 'prop',
      at: '0,1',
      assetId: 'crate_A_small',
      kind: 'prop',
      tags: ['loot'],
    });
    spawnGameboardActor(world, {
      id: 'raider',
      actorId: 'raider',
      actorKind: 'enemy',
      team: 'red',
      at: '1,1',
      assetId: 'flag_red',
      kind: 'unit',
      tags: ['quest'],
    });

    const threats = selectGameboardActors(world, {
      sourceActor: 'hero',
      radius: 2,
      hostileToSource: true,
      includeSource: false,
      sort: 'distance',
    });

    expect(threats).toMatchObject({
      count: 1,
      actorIds: ['raider'],
      placementIds: ['raider'],
      tileKeys: ['1,1'],
      centerKey: '0,0',
      radius: 2,
      source: { actor: { actorId: 'hero' } },
    });
    expect(threats.byTileKey['1,1']?.map((actor) => actor.actor.actorId)).toEqual([
      'raider',
    ]);
    expect(threats.records).toEqual([
      expect.objectContaining({
        actorId: 'raider',
        placementId: 'raider',
        kind: 'enemy',
        tileKey: '1,1',
        distance: 2,
        hostileToSource: true,
        tags: ['quest'],
      }),
    ]);
    expect(threats.recordsByTileKey['1,1']).toEqual(threats.records);
    expect(threats.hostileActors.map((actor) => actor.actor.actorId)).toEqual(['raider']);

    expect(
      selectGameboardActors(world, {
        kinds: ['npc', 'prop'],
        interactive: true,
        sort: 'tileKey',
      }).actorIds
    ).toEqual(['cache', 'elder']);
    expect(selectGameboardActors(world, { tags: ['quest'] }).actorIds).toEqual([
      'elder',
      'raider',
    ]);
    expect(selectGameboardActors(world, { excludeTags: ['quest'] }).actorIds).toEqual([
      'cache',
      'hero',
    ]);
    expect(gameboardActorActions(world).select({ tileKeys: ['0,1'] }).actorIds).toEqual([
      'cache',
    ]);
  });

  it('plans path-aware actor targets without taking over combat or interaction policy', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'actors-targeting',
        shape: { kind: 'rectangle', width: 4, height: 2 },
      })
        .setTerrain({ q: 1, r: 1 }, 'water')
        .build()
    );
    spawnGameboardActor(world, {
      id: 'hero',
      actorId: 'hero',
      actorKind: 'player',
      team: 'blue',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    spawnGameboardActor(world, {
      id: 'near-raider',
      actorId: 'near-raider',
      actorKind: 'enemy',
      team: 'red',
      at: '2,0',
      assetId: 'flag_red',
      kind: 'unit',
      tags: ['encounter'],
    });
    spawnGameboardActor(world, {
      id: 'far-raider',
      actorId: 'far-raider',
      actorKind: 'enemy',
      team: 'red',
      at: '3,1',
      assetId: 'flag_red',
      kind: 'unit',
      tags: ['encounter'],
    });

    const targeting = inspectGameboardActorTargets(world, {
      sourceActor: 'hero',
      hostileToSource: true,
      radius: 4,
      maxPathCost: 2,
      includeUnreachable: true,
    });

    expect(targeting).toMatchObject({
      source: { actor: { actorId: 'hero' } },
      targetActorIds: ['near-raider', 'far-raider'],
      reachableActorIds: ['near-raider'],
      nearestTarget: {
        actor: { actor: { actorId: 'near-raider' } },
        command: { kind: 'attack-actor', actorId: 'near-raider', canExecute: true },
        approach: 'adjacent',
        approachTileKey: '1,0',
        reachable: true,
        record: { actorId: 'near-raider', distance: 2, hostileToSource: true },
      },
    });
    expect(targeting.targets[0]?.path.coordinates.map((coordinates) => `${coordinates.q},${coordinates.r}`)).toEqual([
      '0,0',
      '1,0',
    ]);
    expect(targeting.targets[1]).toMatchObject({
      actor: { actor: { actorId: 'far-raider' } },
      reachable: false,
      reason: expect.stringContaining('far-raider'),
    });
    expect(
      gameboardActorActions(world).targets({
        sourceActor: 'hero',
        hostileToSource: true,
        maxPathCost: 2,
        includeUnreachable: false,
      }).targetActorIds
    ).toEqual(['near-raider']);
  });

  it('forwards runtime placement offsets and occupancy guards when spawning actors', () => {
    const plan = createGameboardBuilder({
      seed: 'actors-runtime-placement-options',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    })
      .addPlacement({
        at: { q: 0, r: 0 },
        assetId: 'external:gatehouse',
        kind: 'prop',
        layer: 'feature',
        requiresExtra: true,
        metadata: {
          layoutBlocksMovement: true,
          layoutFootprintTiles: '0,0|1,0',
        },
      })
      .build();
    const world = createGameboardWorld(plan);
    const gatehouse = plan.placements.find(
      (placement) => placement.assetId === 'external:gatehouse'
    );
    if (!gatehouse) {
      throw new Error('Expected blocking footprint fixture');
    }

    expect(() =>
      spawnGameboardActor(world, {
        id: 'blocked-actor',
        actorId: 'blocked',
        actorKind: 'enemy',
        at: '1,0',
        assetId: 'flag_red',
        kind: 'unit',
        occupancyGuard: true,
      })
    ).toThrow(/cannot occupy 1,0/);
    expect(findPlacementEntity(world, 'blocked-actor')).toBeUndefined();

    const center = axialToWorld({ q: 2, r: 0 }, 0);
    const actor = spawnGameboardActor(world, {
      id: 'offset-actor',
      actorId: 'offset',
      actorKind: 'npc',
      at: '2,0',
      assetId: 'flag_green',
      kind: 'prop',
      positionOffset: { x: 0.25, z: -0.15 },
      occupancyGuard: { ignorePlacementIds: [gatehouse.id] },
    });

    expect(actor.get(PlacementState)).toMatchObject({
      id: 'offset-actor',
      tileKey: '2,0',
      position: { x: center.x + 0.25, y: center.y, z: center.z - 0.15 },
    });
    const movedCenter = axialToWorld({ q: 1, r: 0 }, 0);
    expect(
      moveGameboardActor(world, 'offset', '1,0', {
        occupancyGuard: { ignorePlacementIds: [gatehouse.id] },
      }).get(PlacementState)
    ).toMatchObject({
      id: 'offset-actor',
      tileKey: '1,0',
      position: { x: movedCenter.x + 0.25, y: movedCenter.y, z: movedCenter.z - 0.15 },
    });
  });

  it('exposes actor operations through a Koota action bundle', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'actors-actions',
        shape: { kind: 'rectangle', width: 2, height: 1 },
      }).build()
    );
    const actions = gameboardActorActions(world);
    const marker = actions.spawn({
      actorId: 'marker',
      actorKind: 'prop',
      at: '0,0',
      assetId: 'crate_B_small',
      kind: 'prop',
    });

    expect(actions.read()).toHaveLength(1);
    expect(actions.collision(undefined, '0,0')).toMatchObject({ canEnter: true });

    actions.move('marker', '1,0', { occupancyGuard: true });
    expect(marker.get(PlacementState)?.tileKey).toBe('1,0');

    actions.update(marker, { blocksMovement: true });
    expect(actions.collision(undefined, '1,0')).toMatchObject({ canEnter: false });
  });

  it('resolves interaction targets from renderer hit metadata and actor ids', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'actors-interaction',
        shape: { kind: 'rectangle', width: 3, height: 2 },
      }).build()
    );
    const player = spawnGameboardActor(world, {
      actorId: 'hero',
      actorKind: 'player',
      team: 'blue',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    const elder = spawnGameboardActor(world, {
      actorId: 'elder',
      actorKind: 'npc',
      team: 'blue',
      at: '1,0',
      assetId: 'flag_green',
      kind: 'prop',
    });
    const enemy = spawnGameboardActor(world, {
      actorId: 'raider',
      actorKind: 'enemy',
      team: 'red',
      at: '2,0',
      assetId: 'flag_red',
      kind: 'unit',
    });

    const elderPlacementId = elder.get(PlacementState)?.id ?? '';
    const enemyPlacementId = enemy.get(PlacementState)?.id ?? '';

    expect(
      inspectGameboardInteractionTarget(
        world,
        { placementId: elderPlacementId },
        { sourceActor: player }
      )
    ).toMatchObject({
      kind: 'actor',
      intent: 'interact',
      tileKey: '1,0',
      actor: { actor: { actorId: 'elder' } },
      canEnter: true,
    });
    expect(
      inspectGameboardInteractionTarget(world, 'raider', { sourceActor: 'hero' })
    ).toMatchObject({
      kind: 'actor',
      intent: 'attack',
      tileKey: '2,0',
      actor: { actor: { actorId: 'raider' } },
      canEnter: false,
    });
    expect(
      inspectGameboardInteractionTarget(
        world,
        {
          placementId: enemyPlacementId,
          tileKey: '2,0',
        },
        { sourceActor: 'hero' }
      ).collision?.hostileActors.map((actor) => actor.actor.actorId)
    ).toEqual(['raider']);
    expect(
      inspectGameboardInteractionTarget(world, { q: 1, r: 1 }, { sourceActor: 'hero' })
    ).toMatchObject({
      kind: 'tile',
      intent: 'move',
      tileKey: '1,1',
      canEnter: true,
    });
    expect(inspectGameboardInteractionTarget(world, 'missing-target')).toMatchObject({
      kind: 'empty',
      intent: 'inspect',
      canEnter: false,
    });

    const actions = gameboardActorActions(world);
    expect(actions.interaction({ actorId: 'elder' }, { sourceActor: 'hero' })).toMatchObject({
      kind: 'actor',
      intent: 'interact',
    });
    expect(
      planGameboardInteractionCommand(world, { actorId: 'elder' }, { sourceActor: 'hero' })
    ).toMatchObject({
      kind: 'interact-actor',
      intent: 'interact',
      actorId: 'elder',
      placementId: elderPlacementId,
      tileKey: '1,0',
      canExecute: true,
    });
    expect(planGameboardInteractionCommand(world, 'raider', { sourceActor: 'hero' })).toMatchObject(
      {
        kind: 'attack-actor',
        intent: 'attack',
        actorId: 'raider',
        placementId: enemyPlacementId,
        tileKey: '2,0',
        canExecute: true,
      }
    );
    expect(
      planGameboardInteractionCommand(world, { q: 1, r: 1 }, { sourceActor: 'hero' })
    ).toMatchObject({
      kind: 'move',
      intent: 'move',
      tileKey: '1,1',
      canExecute: true,
    });
    expect(planGameboardInteractionCommand(world, { q: 1, r: 1 })).toMatchObject({
      kind: 'move',
      canExecute: false,
      reason: 'Move commands require a source actor',
    });
    expect(actions.command('missing-target', { sourceActor: 'hero' })).toMatchObject({
      kind: 'none',
      intent: 'inspect',
      canExecute: false,
      reason: 'No target resolved',
    });
  });

  it('inspectGameboardActorTargets reports missing source actor (E0h)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'no-source-actor',
        shape: { kind: 'rectangle', width: 3, height: 3 },
      }).build()
    );
    const result = inspectGameboardActorTargets(world, {
      sourceActor: 'ghost-actor-not-in-world',
    });
    expect(result.targets).toEqual([]);
    expect(result.reachableTargets).toEqual([]);
    expect(result.reason).toMatch(/No source actor exists/);
  });

  it('gameboardActorBlocksMovement reports false for undefined actor (E0h)', () => {
    expect(gameboardActorBlocksMovement(undefined)).toBe(false);
  });

  it('gameboardActorBlocksMovement reports true for blocking actor + structure layer (E0h)', () => {
    // biome-ignore lint/suspicious/noExplicitAny: minimal fixture for the helper
    const blockingActor: any = {
      actorId: 'wall',
      kind: 'prop',
      blocksMovement: true,
      team: 'neutral',
      tags: [],
      metadata: {},
      interactive: false,
      hostile: false,
      faction: undefined,
    };
    expect(
      gameboardActorBlocksMovement(blockingActor, { kind: 'wall', layer: 'structure' } as unknown as Parameters<typeof gameboardActorBlocksMovement>[1])
    ).toBe(true);
  });
});

describe('gameboardActorActions register + navigationProfile (PRD E0a)', () => {
  it('neighborhood accepts a hex-key string center (E0a)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'neighborhood-hexkey',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    const actions = gameboardActorActions(world);
    // No actor/placement at '1,0' — falls through to parseHexKey on the string.
    const inspection = actions.neighborhood('1,0', { radius: 1 });
    expect(inspection.tiles.length).toBeGreaterThan(0);
  });

  it('areGameboardActorsHostile returns false for undefined inputs (E0a)', () => {
    expect(areGameboardActorsHostile(undefined, undefined)).toBe(false);
  });

  it('neighborhood accepts HexCoordinates center input (E0a)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'neighborhood-hex',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    const actions = gameboardActorActions(world);
    actions.spawn({
      actorId: 'pivot',
      actorKind: 'npc',
      at: '1,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    // Pass HexCoordinates object directly — resolveNeighborhoodCenter line 1464-1465.
    const inspection = actions.neighborhood({ q: 1, r: 0 }, { radius: 1 });
    expect(inspection.tiles.length).toBeGreaterThan(0);
  });

  it('register attaches actor traits to an existing placement', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'actor-register',
        shape: { kind: 'rectangle', width: 2, height: 1 },
      }).build()
    );
    const actions = gameboardActorActions(world);
    // Spawn a placement directly (no actor), then register it.
    const spawned = actions.spawn({
      actorId: 'temp-hero',
      actorKind: 'player',
      at: '0,0',
      assetId: 'flag_blue',
      kind: 'unit',
    });
    // Re-register the same placement entity with updated metadata to
    // exercise the action wrapper around registerGameboardActor (line 710).
    const registered = actions.register(spawned, {
      actorId: 'temp-hero',
      actorKind: 'player',
      tags: ['re-registered'],
    });
    expect(registered).toBeDefined();
  });

  it('navigationProfile returns a profile keyed to the actor (E0a)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'actor-nav-profile',
        shape: { kind: 'rectangle', width: 3, height: 1 },
      }).build()
    );
    const actions = gameboardActorActions(world);
    actions.spawn({
      actorId: 'scout',
      actorKind: 'npc',
      at: '0,0',
      assetId: 'flag_yellow',
      kind: 'unit',
    });
    const profile = actions.navigationProfile('scout', {});
    expect(profile).toBeDefined();
  });
});
