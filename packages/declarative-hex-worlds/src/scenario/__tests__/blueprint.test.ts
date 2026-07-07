import { describe, expect, it } from 'vitest';
import {
  createGameboardBlueprintPlan,
  createGameboardBlueprintRecipe,
  createGameboardBlueprintScenario,
  createGameboardWorldFromBlueprint,
  createMedievalShowcaseBlueprintRecipe,
  inspectGameboardBlueprint,
  inspectGameboardBlueprintScenario,
} from '../../scenario/blueprint';
import { freeManifest } from '../../manifest/free';
import { createGameboardPlanFromRecipe } from '../../scenario/recipe';
import { createHexTileRegistryFromManifest } from '../../scenario/registry';
import { validateGameboardPlan } from '../../rules/validation';

describe('medieval gameboard blueprints', () => {
  it('compiles board intent into mountains, towns, roads, harbors, biomes, and transitions', () => {
    const inspection = inspectGameboardBlueprint({
      seed: 'blueprint-contract',
      shape: { kind: 'rectangle', width: 8, height: 6 },
      faction: 'green',
      waterFill: 0.18,
      maxElevation: 3,
      biomeFills: [
        { id: 'fall-woods', textureSet: 'fall', fill: 0.3, center: { q: 2, r: 3 }, radius: 3 },
        { id: 'winter-ridge', textureSet: 'winter', fill: 0.2, center: { q: 5, r: 1 }, radius: 2 },
      ],
      mountainRanges: [
        {
          id: 'north-ridge',
          path: [
            { q: 1, r: 0 },
            { q: 2, r: 0 },
            { q: 3, r: 1 },
          ],
          width: 1,
          height: 3,
          variant: 'cycle',
        },
      ],
      towns: [
        {
          id: 'green-town',
          center: { q: 3, r: 3 },
          includeWalls: true,
          buildings: ['market', 'home_A', 'home_B', 'well'],
        },
      ],
      harbors: [{ id: 'green-port', at: { q: 3, r: 4 }, facing: 1, kind: 'watermill', roadTo: { q: 3, r: 3 } }],
      roads: [
        {
          id: 'ridge-road',
          path: [
            { q: 1, r: 1 },
            { q: 2, r: 2 },
            { q: 3, r: 3 },
            { q: 3, r: 4 },
          ],
        },
      ],
      rivers: [
        {
          id: 'ridge-river',
          path: [
            { q: 0, r: 0 },
            { q: 1, r: 1 },
            { q: 2, r: 2 },
            { q: 2, r: 3 },
            { q: 3, r: 4 },
          ],
          curvy: true,
        },
      ],
      transitionPolicy: {
        biomeTransitions: true,
        elevationRamps: true,
        roadSlopes: true,
        bridges: true,
      },
    });

    expect(inspection.counts.mountainStacks).toBeGreaterThan(0);
    expect(inspection.counts.townBuildings).toBeGreaterThanOrEqual(4);
    expect(inspection.counts.harbors).toBe(1);
    expect(inspection.counts.bridges).toBeGreaterThan(0);
    expect(inspection.counts.biomeTiles).toBeGreaterThan(0);
    expect(inspection.counts.biomeTransitions).toBeGreaterThan(0);
    expect(inspection.counts.elevationRamps).toBeGreaterThan(0);
    expect(inspection.plan.tiles.some((tile) => tile.textureSet === 'fall')).toBe(true);
    expect(inspection.plan.tiles.some((tile) => tile.textureSet === 'winter')).toBe(true);
    expect(inspection.plan.placements.some((placement) => placement.assetId === 'hex_transition')).toBe(true);
    expect(inspection.plan.placements.some((placement) => placement.assetId === 'building_watermill_green')).toBe(true);
    expect(inspection.plan.placements.some((placement) => placement.kind === 'road')).toBe(true);
    expect(inspection.plan.placements.some((placement) => placement.kind === 'river')).toBe(true);
    expect(inspection.plan.placements.some((placement) => placement.metadata.feature === 'bridge')).toBe(true);
    expect(inspection.plan.placements.some((placement) => placement.metadata.feature === 'elevation-ramp')).toBe(true);
    expect(inspection.plan.placements.some((placement) => placement.metadata.feature === 'fortification')).toBe(true);
    expect(inspection.plan.placements.some((placement) => placement.metadata.feature === 'mountain-stack')).toBe(true);
    expect(validateGameboardPlan(inspection.plan).filter((violation) => violation.severity === 'error')).toEqual([]);
    const manifestViolations = validateGameboardPlan(inspection.plan, {
      registry: createHexTileRegistryFromManifest(freeManifest),
      assetCatalog: freeManifest,
      allowUnknownAssets: true,
    });
    expect(manifestViolations.filter((violation) => violation.severity === 'error')).toEqual([]);
    expect(manifestViolations.filter((violation) => violation.code === 'coast.adjacent_land')).toEqual([]);
  });

  it('compiles semantic prop-cluster dressing around towns, harbors, and authored anchors', () => {
    const inspection = inspectGameboardBlueprint({
      seed: 'blueprint-prop-cluster-dressing',
      shape: { kind: 'rectangle', width: 18, height: 12 },
      faction: 'red',
      waterFill: 0.12,
      maxElevation: 3,
      towns: [
        {
          id: 'stable-fort',
          center: { q: 8, r: 5 },
          buildings: ['townhall', 'market', 'tent', 'stables', 'barracks', 'workshop', 'blacksmith'],
        },
      ],
      harbors: [{ id: 'red-port', at: { q: 8, r: 10 }, facing: 1, kind: 'watermill', roadTo: { q: 8, r: 5 } }],
      propClusterDressing: {
        density: 1,
        includeExtra: true,
        clusters: [{ id: 'manual-cache', at: { q: 13, r: 5 }, kind: 'resource-cache', placement: 'single', density: 0.25 }],
      },
      transitionPolicy: { biomeTransitions: false, elevationRamps: false, roadSlopes: true, bridges: true },
    });

    const clusterSteps = inspection.recipe.steps.filter((step) => step.action === 'addPropCluster');
    const clusterKinds = new Set(clusterSteps.map((step) => step.kind));
    expect(inspection.counts.propClusters).toBe(clusterSteps.length);
    expect(clusterKinds).toEqual(
      new Set(['resource-cache', 'camp', 'training-yard', 'stable-yard', 'worksite', 'harbor-support'])
    );
    expect(clusterSteps.find((step) => step.clusterId === 'manual-cache')).toMatchObject({
      kind: 'resource-cache',
      placement: 'single',
      includeExtra: true,
    });
    expect(inspection.plan.placements.some((placement) => placement.assetId === 'cannonball_pallet')).toBe(true);
    expect(inspection.plan.placements.some((placement) => placement.assetId === 'haybale')).toBe(true);
    expect(inspection.plan.placements.some((placement) => placement.assetId === 'anchor')).toBe(true);
    expect(inspection.plan.placements.some((placement) => placement.metadata.clusterId === 'manual-cache')).toBe(true);
    expect(validateGameboardPlan(inspection.plan).filter((violation) => violation.severity === 'error')).toEqual([]);
  });

  it('keeps recipe texture-set steps serializable', () => {
    const recipe = createGameboardBlueprintRecipe({
      seed: 'blueprint-texture-steps',
      shape: { kind: 'rectangle', width: 4, height: 3 },
      waterFill: 0,
      biomeFills: [{ textureSet: 'summer', fill: 0.5 }],
      transitionPolicy: { biomeTransitions: false, elevationRamps: false },
    });
    const textureSteps = recipe.steps.filter((step) => step.action === 'setTextureSet');
    const plan = createGameboardPlanFromRecipe(recipe);

    expect(textureSteps.length).toBeGreaterThan(0);
    expect(plan.tiles.filter((tile) => tile.textureSet === 'summer')).toHaveLength(textureSteps.length);
  });

  it('ships a deterministic full showcase recipe for docs and browser screenshots', () => {
    const first = createGameboardPlanFromRecipe(createMedievalShowcaseBlueprintRecipe());
    const second = createGameboardPlanFromRecipe(createMedievalShowcaseBlueprintRecipe());

    expect(first.tiles).toEqual(second.tiles);
    expect(first.placements.map((placement) => [placement.assetId, placement.tileKey, placement.rotationSteps])).toEqual(
      second.placements.map((placement) => [placement.assetId, placement.tileKey, placement.rotationSteps])
    );
    expect(first.placements.some((placement) => placement.assetId === 'building_shipyard_blue')).toBe(true);
    expect(first.placements.some((placement) => placement.assetId === 'hex_transition')).toBe(true);
    expect(first.placements.some((placement) => placement.metadata.feature === 'prop-cluster')).toBe(true);
    expect(first.placements.filter((placement) => placement.metadata.densityPreset === 'units')).toHaveLength(3);
  });

  it('builds a plan directly when games do not need intermediate recipe JSON', () => {
    const plan = createGameboardBlueprintPlan({
      seed: 'direct-blueprint-plan',
      shape: { kind: 'hexagon', radius: 3 },
      waterFill: 0.12,
      towns: 1,
      harbors: 1,
    });

    expect(plan.tiles.length).toBeGreaterThan(0);
    expect(plan.placements.some((placement) => placement.metadata.feature === 'harbor')).toBe(true);
  });

  it('compiles board intent into a playable scenario with spawn groups, patrols, actors, and quests', () => {
    const options = {
      scenarioId: 'blueprint:playable-scene',
      title: 'Playable Blueprint Scene',
      seed: 'blueprint-playable-scene',
      shape: { kind: 'rectangle', width: 10, height: 8 },
      faction: 'blue',
      waterFill: 0.1,
      maxElevation: 1,
      mountainRanges: [{ id: 'north-hill', path: [{ q: 0, r: 0 }, { q: 1, r: 0 }], width: 0, height: 1 }],
      towns: [
        {
          id: 'blue-hold',
          center: { q: 4, r: 3 },
          buildings: ['market', 'home_A', 'barracks'],
        },
      ],
      harbors: [{ id: 'blue-dock', at: { q: 5, r: 6 }, facing: 1, kind: 'docks', roadTo: { q: 4, r: 3 } }],
      rivers: [],
      propClusterDressing: { density: 0.4 },
      transitionPolicy: { biomeTransitions: false, elevationRamps: false, roadSlopes: true, bridges: true },
      spawnGroups: {
        seed: 'blueprint-playable-scene:spawns',
        profile: {
          blockedTerrain: ['water'],
          maxElevationStep: 3,
        },
        groups: [
          { id: 'party', count: 1, terrain: ['grass', 'road', 'coast'], edgePadding: 1 },
          {
            id: 'villagers',
            count: 1,
            terrain: ['grass', 'road', 'coast'],
            edgePadding: 1,
            minDistanceFromGroups: 2,
            pathToGroups: ['party'],
            routeProfile: { blockedTerrain: ['water'], maxElevationStep: 3, blockingPlacementKinds: ['unit'] },
          },
          {
            id: 'raiders',
            count: 1,
            terrain: ['forest', 'hill', 'grass'],
            edgePadding: 1,
            minDistanceFromGroups: 3,
            pathToGroups: ['party'],
            routeProfile: { blockedTerrain: ['water'], maxElevationStep: 3, blockingPlacementKinds: ['unit'] },
          },
        ],
      },
      patrolRoutes: [
        {
          id: 'raider-watch',
          count: 2,
          startGroupId: 'raiders',
          terrain: ['grass', 'forest', 'hill'],
          loop: false,
          routeProfile: { blockedTerrain: ['water'], maxElevationStep: 3, blockingPlacementKinds: ['unit'] },
        },
      ],
      actors: [
        {
          actorId: 'player',
          actorKind: 'player',
          team: 'blue',
          spawnGroupId: 'party',
          assetId: 'flag_blue',
          kind: 'unit',
          movementAgent: { profile: 'worker', movementBudget: 5 },
        },
        {
          actorId: 'elder',
          actorKind: 'npc',
          team: 'blue',
          interactive: true,
          spawnGroupId: 'villagers',
          assetId: 'flag_green',
          kind: 'prop',
        },
        {
          actorId: 'raider',
          actorKind: 'enemy',
          hostile: true,
          spawnGroupId: 'raiders',
          assetId: 'flag_red',
          kind: 'unit',
          patrolAgent: { routeId: 'raider-watch', movement: { profile: 'ground' } },
        },
      ],
      quests: [
        {
          id: 'blueprint:playable-scene:quest',
          title: 'Reach The Elder',
          objectives: [
            {
              id: 'reach-elder',
              kind: 'reach-actor',
              actor: 'player',
              targetActor: 'elder',
            },
          ],
        },
      ],
      scenarioMetadata: { fixture: true },
    } as const;

    const scenario = createGameboardBlueprintScenario(options);
    const inspection = inspectGameboardBlueprintScenario(options);
    const runtime = createGameboardWorldFromBlueprint(options);

    expect(scenario).toMatchObject({
      id: 'blueprint:playable-scene',
      title: 'Playable Blueprint Scene',
      metadata: {
        source: 'medieval-gameboard-blueprint',
        blueprintSeed: 'blueprint-playable-scene',
        blueprintShape: 'rectangle:10x8',
        fixture: true,
      },
    });
    expect(inspection.blueprint.counts.towns).toBe(1);
    expect(inspection.blueprint.counts.harbors).toBe(1);
    expect(inspection.scenarioInspection.violations.filter((violation) => violation.severity === 'error')).toEqual([]);
    expect(inspection.scenarioInspection.spawnGroups?.groups.map((group) => group.id)).toEqual([
      'party',
      'villagers',
      'raiders',
    ]);
    expect(inspection.scenarioInspection.patrolRoutes?.routes[0]).toMatchObject({
      id: 'raider-watch',
      found: true,
    });
    expect(runtime.actorEntities.player).toBeDefined();
    expect(runtime.questEntities['blueprint:playable-scene:quest']).toBeDefined();
    expect(runtime.actors.map((actor) => actor.actor.actorId).sort()).toEqual([
      'elder',
      'player',
      'raider',
    ]);
    expect(runtime.actors.find((actor) => actor.actor.actorId === 'player')?.actor.metadata).toMatchObject({
      scenarioSpawnGroupId: 'party',
    });
    expect(runtime.patrolRoutes?.routes[0]?.pathKeys.length).toBeGreaterThan(0);
  });

  it('warns when a prop cluster anchor is outside the board (E0a)', () => {
    const inspection = inspectGameboardBlueprint({
      seed: 'blueprint-bad-cluster',
      shape: { kind: 'rectangle', width: 3, height: 3 },
      propClusterDressing: {
        clusters: [{ at: { q: 99, r: 99 }, kind: 'camp' }],
      },
    });
    expect(
      inspection.warnings.some((warning) =>
        warning.includes('Prop cluster') && warning.includes('outside the board')
      )
    ).toBe(true);
  });

  it('warns when a mountain range has all out-of-bounds ridge coordinates (E0a)', () => {
    const inspection = inspectGameboardBlueprint({
      seed: 'blueprint-bad-mountain',
      shape: { kind: 'rectangle', width: 3, height: 3 },
      mountainRanges: [
        // Path entirely outside the 3x3 board.
        { path: [{ q: 99, r: 99 }, { q: 100, r: 99 }], width: 0, height: 1 },
      ],
    });
    expect(
      inspection.warnings.some((warning) => warning.includes('has no in-bounds ridge'))
    ).toBe(true);
  });

  it('reports tiny-board blueprint diagnostics for towns, harbors, roads, rivers, and prop clusters', () => {
    const inspection = inspectGameboardBlueprint({
      seed: 'blueprint-tiny-diagnostics',
      shape: { kind: 'rectangle', width: 1, height: 1 },
      waterFill: 0,
      maxElevation: 1,
      mountainRanges: [],
      towns: [
        {
          center: { q: 0, r: 0 },
          buildings: ['tent', 'stables', 'blacksmith'],
        },
        { center: { q: 5, r: 5 } },
      ],
      harbors: [{ at: { q: 0, r: 0 }, facing: 1 }],
      roads: [
        { path: [{ q: 0, r: 0 }] },
        { id: 'oob-road', path: [{ q: 5, r: 5 }, { q: 6, r: 5 }] },
      ],
      rivers: [
        { path: [{ q: 0, r: 0 }], waterless: true, curvy: false },
        { id: 'oob-river', path: [{ q: 5, r: 5 }, { q: 6, r: 5 }] },
      ],
      propClusterDressing: { density: 0.2 },
      transitionPolicy: { biomeTransitions: false, elevationRamps: false, roadSlopes: true, bridges: true },
    });

    expect(inspection.counts.towns).toBe(2);
    expect(inspection.counts.harbors).toBe(1);
    expect(inspection.counts.propClusters).toBe(0);
    expect(inspection.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Town 0,0 could not fit resource-cache prop-cluster dressing'),
        expect.stringContaining('Town <unnamed> center 5,5 is outside the board'),
        expect.stringContaining('Harbor 0,0 could not fit harbor-support prop-cluster dressing'),
        expect.stringContaining('Road <unnamed> has fewer than two in-bounds coordinates'),
        expect.stringContaining('Road oob-road has fewer than two in-bounds coordinates'),
        expect.stringContaining('River <unnamed> has fewer than two coordinates'),
        expect.stringContaining('River oob-river has fewer than two coordinates'),
      ])
    );
  });

  it('preserves authored town connection paths and unnamed wall enclosure ids at recipe-build time', () => {
    const inspection = inspectGameboardBlueprint({
      seed: 'blueprint-town-connect-to',
      shape: { kind: 'rectangle', width: 5, height: 5 },
      waterFill: 0,
      mountainRanges: [],
      towns: [{ center: { q: 2, r: 2 }, includeWalls: true, connectTo: [{ q: 3, r: 2 }] }],
      harbors: [{ at: { q: 9, r: 9 }, facing: 1 }],
      rivers: [],
      propClusterDressing: false,
      transitionPolicy: { biomeTransitions: false, elevationRamps: false, roadSlopes: false, bridges: false },
    });
    const recipe = inspection.recipe;

    expect(recipe.steps).toContainEqual({
      action: 'addRoadPath',
      path: [
        { q: 2, r: 2 },
        { q: 3, r: 2 },
      ],
    });
    expect(recipe.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'addFortification', enclosureId: 'town:2,2' }),
      ])
    );
    expect(recipe.steps).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ action: 'addHarbor', at: { q: 9, r: 9 } })])
    );
    expect(inspection.warnings).toContain('Harbor <unnamed> anchor 9,9 is outside the board');
  });

  it('covers generated defaults, manual prop-cluster fallbacks, bridge de-duplication, and hex scenario metadata', () => {
    const inspection = inspectGameboardBlueprint({
      seed: 'blueprint-branch-defaults',
      shape: { kind: 'hexagon', radius: 2 },
      waterFill: 0.1,
      maxElevation: 2,
      mountainRanges: [{ path: [{ q: 0, r: 0 }], variant: 'B', treeLine: 1 }],
      towns: 2,
      harbors: 1,
      roads: [
        {
          id: 'flat-road',
          path: [
            { q: -1, r: 1 },
            { q: 0, r: 0 },
          ],
          slope: 'high',
          addBridges: false,
        },
      ],
      biomeFills: [
        { textureSet: 'summer', fill: 0.4, terrain: 'grass' },
        { textureSet: 'winter', fill: 0.4, terrain: ['hill', 'forest'] },
      ],
      propClusterDressing: {
        auto: false,
        clusters: [{ at: { q: 0, r: 0 }, kind: 'camp' }],
      },
      transitionPolicy: { biomeTransitions: true, elevationRamps: true, roadSlopes: true, bridges: true },
    });
    const scenario = createGameboardBlueprintScenario({
      seed: 'blueprint-branch-defaults',
      shape: { kind: 'hexagon', radius: 2 },
      mountainRanges: [],
      towns: [],
      harbors: [],
      rivers: [],
      propClusterDressing: false,
      transitionPolicy: { biomeTransitions: false, elevationRamps: false, roadSlopes: false, bridges: false },
    });
    const explicitHarborOptOut = inspectGameboardBlueprint({
      seed: 'blueprint-harbor-opt-out',
      shape: { kind: 'hexagon', radius: 2 },
      waterFill: 0,
      mountainRanges: [],
      towns: [],
      harbors: 0,
      rivers: [],
      propClusterDressing: false,
      transitionPolicy: { biomeTransitions: false, elevationRamps: false, roadSlopes: false, bridges: false },
    });
    const noCoastHarborRequest = inspectGameboardBlueprint({
      seed: 'blueprint-no-coast-harbor',
      shape: { kind: 'hexagon', radius: 2 },
      waterFill: 0,
      mountainRanges: [],
      towns: [],
      harbors: 1,
      rivers: [],
      propClusterDressing: false,
      transitionPolicy: { biomeTransitions: false, elevationRamps: false, roadSlopes: false, bridges: false },
    });

    expect(noCoastHarborRequest.warnings).toContain(
      'No harbor could be placed because the blueprint has no coast tiles'
    );
    expect(explicitHarborOptOut.warnings).not.toContain(
      'No harbor could be placed because the blueprint has no coast tiles'
    );
    expect(inspection.recipe.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'addMountainStack', variant: 'B' }),
        expect.objectContaining({ action: 'addRoadPath', slope: 'high' }),
        expect.objectContaining({ action: 'addPropCluster', placement: 'adjacent', clusterId: 'blueprint:prop-cluster:camp:0,0' }),
      ])
    );
    expect(inspection.counts.biomeTiles).toBeGreaterThan(0);
    expect(inspection.counts.towns).toBe(2);
    expect(scenario.metadata).toMatchObject({ blueprintShape: 'hexagon:2' });
  });

  it('uses generated defaults for omitted blueprint options and alternate harbor kinds', () => {
    const defaults = createGameboardBlueprintRecipe({
      waterFill: 0,
      mountainRanges: [],
      towns: [],
      harbors: [],
      rivers: [],
      propClusterDressing: false,
      transitionPolicy: { biomeTransitions: false, elevationRamps: false, roadSlopes: false, bridges: false },
    });
    const twoHarbors = createGameboardBlueprintRecipe({
      seed: 'blueprint-two-harbors',
      shape: { kind: 'rectangle', width: 8, height: 6 },
      waterFill: 0.25,
      mountainRanges: [],
      towns: 1,
      harbors: 2,
      rivers: [],
      propClusterDressing: false,
      transitionPolicy: { biomeTransitions: false, elevationRamps: false, roadSlopes: false, bridges: false },
    });
    const autoDressing = createGameboardBlueprintRecipe({
      seed: 'blueprint-auto-dressing-fallbacks',
      shape: { kind: 'rectangle', width: 10, height: 8 },
      waterFill: 0.1,
      maxElevation: 1,
      mountainRanges: [],
      towns: [{ center: { q: 4, r: 3 }, buildings: ['barracks'] }],
      harbors: [{ at: { q: 5, r: 6 }, facing: 1, roadTo: { q: 4, r: 3 } }],
      rivers: [],
      propClusterDressing: {},
      transitionPolicy: { biomeTransitions: false, elevationRamps: false, roadSlopes: false, bridges: false },
    });

    expect(defaults.options).toMatchObject({ seed: 'medieval-gameboard-blueprint', shape: { kind: 'rectangle', width: 12, height: 9 } });
    expect(twoHarbors.steps.filter((step) => step.action === 'addHarbor').map((step) => step.kind)).toContain('shipyard');
    expect(autoDressing.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'addPropCluster', clusterId: 'blueprint:town:4,3:training-yard', density: 0.55 }),
        expect.objectContaining({ action: 'addPropCluster', clusterId: 'blueprint:harbor:5,6:harbor-support', density: 0.55 }),
        expect.objectContaining({ action: 'addRoadPath' }),
      ])
    );
  });

  it('deduplicates repeated bridges across authored road crossings', () => {
    const inspection = inspectGameboardBlueprint({
      seed: 'blueprint-bridge-dedup',
      shape: { kind: 'rectangle', width: 4, height: 3 },
      waterFill: 0,
      mountainRanges: [],
      towns: [],
      harbors: [],
      rivers: [{ id: 'crossing-river', path: [{ q: 1, r: 0 }, { q: 1, r: 2 }] }],
      roads: [
        { id: 'first-crossing', path: [{ q: 0, r: 1 }, { q: 2, r: 1 }] },
        { id: 'second-crossing', path: [{ q: 0, r: 1 }, { q: 2, r: 1 }] },
      ],
      propClusterDressing: false,
      transitionPolicy: { biomeTransitions: false, elevationRamps: false, roadSlopes: true, bridges: true },
    });

    expect(inspection.counts.bridges).toBe(1);
    expect(inspection.recipe.steps.filter((step) => step.action === 'addBridge')).toHaveLength(1);
  });

  it('throws when the default ridge cannot be derived from an empty shape', () => {
    expect(() =>
      createGameboardBlueprintRecipe({
        seed: 'blueprint-empty-shape',
        shape: { kind: 'rectangle', width: 0, height: 0 },
      })
    ).toThrow(/default ridge requires at least one tile/);
  });
});
