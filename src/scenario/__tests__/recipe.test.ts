import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../gameboard/index';
import {
  appendGameboardRecipeSteps,
  applyGameboardRecipe,
  applyGameboardRecipeGeneration,
  createGameboardLayoutArchetypeRegistryFromRecipe,
  createGameboardLayoutArchetypeRegistryFromRecipeGeneration,
  createGameboardPieceRegistryFromRecipe,
  createGameboardPieceRegistryFromRecipeGeneration,
  createGameboardPlanFromRecipe,
  createGameboardRecipe,
  createGameboardRecipeGenerationFillRules,
  inspectGameboardRecipe,
  mergeGameboardRecipes,
  type GameboardRecipeStep,
  validateGameboardRecipe,
  validateGameboardRecipeGeneration,
} from '../../scenario/recipe';
import { freeManifest } from '../../manifest/free';
import { validateGameboardPlan } from '../../rules/validation';

describe('serializable gameboard recipes', () => {
  it('rebuilds board intent without requiring Koota or imperative caller code', () => {
    const steps: GameboardRecipeStep[] = [
      { action: 'setTerrain', at: { q: 2, r: 3 }, terrain: 'water' },
      { action: 'setCoastEdges', at: { q: 2, r: 2 }, waterEdges: [1] },
      { action: 'addHarbor', at: { q: 2, r: 2 }, facing: 1, faction: 'blue', kind: 'shipyard' },
      { action: 'addFactionBuilding', at: { q: 2, r: 0 }, faction: 'blue', building: 'townhall' },
      {
        action: 'addRoadPath',
        path: [
          { q: 2, r: 0 },
          { q: 2, r: 1 },
          { q: 2, r: 2 },
        ],
      },
      { action: 'addMountainStack', at: { q: 0, r: 0 }, height: 2, variant: 'C', withTrees: true },
      { action: 'addBridge', at: { q: 0, r: 2 }, variant: 'B', facing: 2 },
      { action: 'addElevationRamp', at: { q: 0, r: 1 }, direction: 'up', facing: 1, fromElevation: 0, toElevation: 1 },
      { action: 'addFortification', at: { q: 4, r: 0 }, material: 'wood-fence', segment: 'gate', facing: 3 },
      { action: 'addConstructionSite', at: { q: 4, r: 1 }, kind: 'scaffolding', constructionId: 'dock-repair' },
      { action: 'addSiegeProjectile', at: { q: 4, r: 2 }, facing: 4, sourceId: 'tower-cannon' },
      { action: 'addPropCluster', at: { q: 3, r: 2 }, kind: 'worksite', density: 0.4, clusterId: 'dock-worksite' },
      { action: 'addUnitPreset', at: { q: 1, r: 1 }, faction: 'blue', role: 'soldier', style: 'accent' },
    ];
    const recipe = createGameboardRecipe(
      { seed: 'recipe-port', shape: { kind: 'rectangle', width: 5, height: 4 } },
      steps
    );
    const plan = createGameboardPlanFromRecipe(recipe);

    expect(validateGameboardPlan(plan).filter((violation) => violation.severity === 'error')).toEqual([]);
    expect(plan.placements.map((placement) => placement.assetId)).toContain('building_shipyard_blue');
    expect(plan.placements.map((placement) => placement.assetId)).toContain('building_townhall_blue');
    expect(plan.placements.find((placement) => placement.assetId === 'building_bridge_B')).toMatchObject({
      metadata: { feature: 'bridge', bridgeVariant: 'B', facing: 2 },
    });
    expect(plan.placements.find((placement) => placement.assetId === 'hex_grass_sloped_high')).toMatchObject({
      metadata: { feature: 'elevation-ramp', direction: 'up', facing: 1 },
    });
    expect(plan.placements.find((placement) => placement.assetId === 'fence_wood_straight_gate')).toMatchObject({
      metadata: { feature: 'fortification', material: 'wood-fence', segment: 'gate', facing: 3 },
    });
    expect(plan.placements.find((placement) => placement.assetId === 'building_scaffolding')).toMatchObject({
      metadata: { feature: 'construction-site', constructionKind: 'scaffolding', constructionId: 'dock-repair' },
    });
    expect(plan.placements.find((placement) => placement.assetId === 'projectile_catapult')).toMatchObject({
      metadata: { feature: 'siege-projectile', projectileKind: 'catapult', facing: 4, sourceId: 'tower-cannon' },
    });
    expect(plan.placements.find((placement) => placement.metadata.clusterId === 'dock-worksite')).toMatchObject({
      assetId: 'ladder',
      metadata: { feature: 'prop-cluster', propClusterKind: 'worksite', clusterId: 'dock-worksite' },
    });
    expect(plan.placements.map((placement) => placement.assetId)).toContain('mountain_C_grass_trees');
    expect(plan.placements.filter((placement) => placement.kind === 'unit')).toHaveLength(4);
  });

  it('can be appended, merged, and applied to an existing builder', () => {
    const base = createGameboardRecipe(
      { seed: 'recipe-merge', shape: { kind: 'rectangle', width: 3, height: 3 } },
      [{ action: 'addHill', at: { q: 0, r: 0 }, variant: 'A', withTrees: true }]
    );
    const roads = createGameboardRecipe(base.options, [
      {
        action: 'addRoadPath',
        path: [
          { q: 0, r: 0 },
          { q: 1, r: 0 },
        ],
      },
    ]);
    const merged = mergeGameboardRecipes(appendGameboardRecipeSteps(base, [{ action: 'addFlag', at: { q: 2, r: 2 }, faction: 'red' }]), [
      roads,
    ]);
    const builder = createGameboardBuilder(merged.options);
    const plan = applyGameboardRecipe(builder, merged).build();

    expect(plan.placements.some((placement) => placement.assetId === 'hills_A_trees')).toBe(true);
    expect(plan.placements.some((placement) => placement.assetId === 'flag_red')).toBe(true);
    expect(plan.placements.some((placement) => placement.kind === 'road')).toBe(true);
  });

  it('compiles serializable generated layout and piece fills after authored steps', () => {
    const recipe = createGameboardRecipe(
      { seed: 'recipe-generated-pieces', shape: { kind: 'rectangle', width: 5, height: 4 } },
      [{ action: 'addFactionBuilding', at: { q: 2, r: 1 }, faction: 'green', building: 'market' }],
      {
        layoutFillSeed: 'recipe-generated-pieces:fill',
        pieceDeclarations: [
          {
            id: 'recipe-tree',
            assetId: 'tree_single_A',
            source: 'KayKit Medieval Hexagon FREE',
            role: 'tree',
            requiresExtra: false,
            tags: ['recipe-piece', 'scenery'],
            criteria: {
              terrain: ['grass', 'hill', 'forest'],
              allowOccupied: true,
              maxPerTile: 3,
              prefer: [{ kind: 'near-placement-kind', placementKind: 'structure', radius: 4, weight: 1 }],
            },
            metadata: { scenario: 'recipe-generated-pieces' },
          },
          {
            id: 'recipe-supply',
            assetId: 'crate_A_small',
            source: 'KayKit Medieval Hexagon FREE',
            role: 'scatter',
            requiresExtra: false,
            tags: ['recipe-piece', 'loot'],
            criteria: {
              terrain: ['grass', 'road', 'coast'],
              allowOccupied: true,
              maxPerTile: 2,
            },
            metadata: { scenario: 'recipe-generated-pieces' },
          },
        ],
        pieceFills: [
          {
            selection: { tags: ['recipe-piece'] },
            count: 2,
            ruleIdPrefix: 'recipe',
            idPrefix: 'recipe:piece',
          },
        ],
        layoutFills: [
          {
            id: 'recipe-banner',
            assetId: 'flag_green',
            archetype: 'prop',
            count: 1,
            idPrefix: 'recipe:banner',
            metadata: { scenario: 'recipe-generated-pieces', generatedBy: 'layoutFill' },
          },
        ],
      }
    );
    const plan = createGameboardPlanFromRecipe(recipe);
    const piecePlacements = plan.placements.filter(
      (placement) => placement.metadata.scenario === 'recipe-generated-pieces' && typeof placement.metadata.pieceId === 'string'
    );
    const layoutPlacements = plan.placements.filter(
      (placement) => placement.metadata.scenario === 'recipe-generated-pieces' && placement.metadata.generatedBy === 'layoutFill'
    );
    const authoredOnlyPlan = applyGameboardRecipe(createGameboardBuilder(recipe.options), recipe).build();
    const generatedFromAuthoredPlan = applyGameboardRecipeGeneration(authoredOnlyPlan, recipe.generation);

    expect(validateGameboardPlan(plan).filter((violation) => violation.severity === 'error')).toEqual([]);
    expect(plan.placements.some((placement) => placement.assetId === 'building_market_green')).toBe(true);
    expect(piecePlacements).toHaveLength(4);
    expect(piecePlacements.map((placement) => placement.metadata.pieceId)).toEqual(
      expect.arrayContaining(['recipe-tree', 'recipe-supply'])
    );
    expect(layoutPlacements).toHaveLength(1);
    expect(layoutPlacements[0]).toMatchObject({ assetId: 'flag_green', kind: 'prop' });
    expect(authoredOnlyPlan.placements.filter((placement) => placement.metadata.scenario === 'recipe-generated-pieces')).toHaveLength(0);
    expect(generatedFromAuthoredPlan.placements.filter((placement) => placement.metadata.scenario === 'recipe-generated-pieces')).toHaveLength(5);
  });

  it('releases temporary Koota worlds used by generated recipe fills', () => {
    const recipe = createGameboardRecipe(
      { seed: 'recipe-generation-world-lifecycle', shape: { kind: 'rectangle', width: 3, height: 2 } },
      [],
      {
        layoutFillSeed: 'recipe-generation-world-lifecycle:fill',
        layoutFills: [
          {
            id: 'recipe-generation-lifecycle-banner',
            archetype: 'prop',
            assetId: 'flag_blue',
            count: 1,
          },
        ],
      }
    );

    for (let index = 0; index < 20; index += 1) {
      const plan = createGameboardPlanFromRecipe(recipe);

      expect(plan.placements.some((placement) => placement.id === 'layout:recipe-generation-lifecycle-banner:0')).toBe(true);
    }
  });

  it('exposes recipe generation registries and fill rules for saved-content runtimes', () => {
    const recipe = createGameboardRecipe(
      { seed: 'recipe-generation-api', shape: { kind: 'rectangle', width: 3, height: 2 } },
      [],
      {
        pieceDeclarations: [
          {
            id: 'recipe-generation-tree',
            assetId: 'tree_single_A',
            source: 'Recipe fixtures',
            role: 'tree',
            tags: ['nature'],
          },
          {
            id: 'recipe-generation-crate',
            assetId: 'crate_A_small',
            source: 'Recipe fixtures',
            role: 'scatter',
            tags: ['camp'],
          },
        ],
        pieceFills: [
          { selection: { tags: ['nature'] }, count: 1, ruleIdPrefix: 'recipe-generation' },
        ],
        layoutFills: [
          { id: 'recipe-generation-banner', archetype: 'prop', assetId: 'flag_blue', count: 1 },
        ],
      }
    );

    const registry = createGameboardPieceRegistryFromRecipe(recipe);
    const generationRegistry = createGameboardPieceRegistryFromRecipeGeneration(recipe.generation);
    const rules = createGameboardRecipeGenerationFillRules(recipe.generation);

    expect(registry?.pieces.map((piece) => piece.id)).toEqual([
      'recipe-generation-tree',
      'recipe-generation-crate',
    ]);
    expect(generationRegistry?.pieces).toHaveLength(2);
    expect(rules).toHaveLength(2);
    expect(rules.map((rule) => rule.id)).toEqual([
      'recipe-generation:recipe-generation-tree',
      'recipe-generation-banner',
    ]);
  });

  it('declares recipe-level custom layout archetypes for reusable external pack behavior', () => {
    const recipe = createGameboardRecipe(
      { seed: 'recipe-custom-archetypes', shape: { kind: 'rectangle', width: 3, height: 2 } },
      [{ action: 'addFactionBuilding', at: { q: 1, r: 0 }, faction: 'blue', building: 'market' }],
      {
        layoutFillSeed: 'recipe-custom-archetypes:fill',
        layoutArchetypes: {
          'camp-supply': {
            id: 'camp-supply',
            label: 'Camp Supply',
            kind: 'prop',
            layer: 'feature',
            criteria: {
              terrain: ['grass', 'road'],
              allowOccupied: true,
              maxPerTile: 2,
              slotGroup: 'camp-supply',
              prefer: [{ kind: 'near-placement-kind', placementKind: 'structure', radius: 3, weight: 1 }],
            },
            metadata: { registeredArchetype: 'camp-supply' },
          },
        },
        pieceDeclarations: [
          {
            id: 'recipe-camp-crate',
            assetId: 'kenney:camp-crate',
            source: 'Kenney Castle Kit',
            role: 'custom',
            archetype: 'camp-supply',
          },
        ],
        pieceFills: [
          {
            selection: { ids: ['recipe-camp-crate'] },
            count: 1,
            idPrefix: 'recipe:camp-crate',
          },
        ],
        layoutFills: [
          {
            id: 'recipe-camp-banner',
            archetype: 'camp-supply',
            assetId: 'flag_blue',
            count: 1,
            idPrefix: 'recipe:camp-banner',
          },
        ],
      }
    );
    const plan = createGameboardPlanFromRecipe(recipe);
    const rules = createGameboardRecipeGenerationFillRules(recipe.generation);
    const archetypes = createGameboardLayoutArchetypeRegistryFromRecipe(recipe);
    const generationArchetypes = createGameboardLayoutArchetypeRegistryFromRecipeGeneration(recipe.generation);
    const campPlacements = plan.placements.filter((placement) => placement.metadata.layoutArchetype === 'camp-supply');

    expect(archetypes?.tree?.id).toBe('tree');
    expect(generationArchetypes?.['camp-supply']?.criteria.slotGroup).toBe('camp-supply');
    expect(rules).toHaveLength(2);
    expect(rules.every((rule) => rule.archetypes?.['camp-supply']?.id === 'camp-supply')).toBe(true);
    expect(campPlacements).toHaveLength(2);
    expect(campPlacements.every((placement) => placement.kind === 'prop')).toBe(true);
    expect(campPlacements.map((placement) => placement.assetId)).toEqual(
      expect.arrayContaining(['kenney:camp-crate', 'flag_blue'])
    );
    expect(campPlacements.every((placement) => placement.metadata.registeredArchetype === 'camp-supply')).toBe(true);
  });

  it('deep clones generated layout criteria arrays for reusable recipe JSON', () => {
    const terrain: Array<'grass' | 'road' | 'water'> = ['grass', 'road'];
    const elevation = [1, 2];
    const adjacentKinds: Array<'road' | 'structure' | 'prop'> = ['road', 'structure'];
    const adjacentLayers: Array<'surface' | 'structure' | 'feature'> = ['surface', 'structure'];
    const preferenceKinds: Array<'structure' | 'prop' | 'road'> = ['structure', 'prop'];
    const preferenceTerrain: Array<'forest' | 'hill' | 'water'> = ['forest', 'hill'];
    const recipe = createGameboardRecipe(
      { seed: 'recipe-clone-criteria', shape: { kind: 'rectangle', width: 3, height: 3 } },
      [],
      {
        layoutFills: [
          {
            id: 'clone-check',
            archetype: 'prop',
            assetId: 'crate_A_small',
            count: 1,
            criteria: {
              terrain,
              elevation,
              requiredAdjacentPlacementKind: adjacentKinds,
              forbiddenAdjacentPlacementLayer: adjacentLayers,
              prefer: [
                { kind: 'near-placement-kind', placementKind: preferenceKinds, radius: 3, weight: 1 },
                { kind: 'near-terrain', terrain: preferenceTerrain, radius: 2, weight: 0.5 },
              ],
            },
          },
        ],
      }
    );

    terrain.push('water');
    elevation.push(3);
    adjacentKinds.push('prop');
    adjacentLayers.push('feature');
    preferenceKinds.push('road');
    preferenceTerrain.push('water');

    const criteria = recipe.generation?.layoutFills?.[0]?.criteria;
    const nearPlacement = criteria?.prefer?.[0];
    const nearTerrain = criteria?.prefer?.[1];

    expect(criteria?.terrain).toEqual(['grass', 'road']);
    expect(criteria?.elevation).toEqual([1, 2]);
    expect(criteria?.requiredAdjacentPlacementKind).toEqual(['road', 'structure']);
    expect(criteria?.forbiddenAdjacentPlacementLayer).toEqual(['surface', 'structure']);
    expect(nearPlacement?.kind).toBe('near-placement-kind');
    if (nearPlacement?.kind === 'near-placement-kind') {
      expect(nearPlacement.placementKind).toEqual(['structure', 'prop']);
    }
    expect(nearTerrain?.kind).toBe('near-terrain');
    if (nearTerrain?.kind === 'near-terrain') {
      expect(nearTerrain.terrain).toEqual(['forest', 'hill']);
    }
  });

  it('validates recipe compile errors and manifest-backed asset references', () => {
    const offBoardRecipe = createGameboardRecipe(
      { seed: 'bad-recipe', shape: { kind: 'rectangle', width: 1, height: 1 } },
      [{ action: 'setTerrain', at: { q: 3, r: 0 }, terrain: 'water' }]
    );
    const missingAssetRecipe = createGameboardRecipe(
      { seed: 'missing-asset-recipe', shape: { kind: 'rectangle', width: 1, height: 1 } },
      [{ action: 'addProp', at: { q: 0, r: 0 }, assetId: 'missing_prop' } as unknown as GameboardRecipeStep]
    );

    expect(validateGameboardRecipe(offBoardRecipe).map((violation) => violation.code)).toEqual([
      'recipe.compile_failed',
    ]);
    expect(
      inspectGameboardRecipe(missingAssetRecipe, { plan: { assetCatalog: freeManifest } }).violations.map(
        (violation) => violation.code
      )
    ).toContain('asset.unknown');
  });

  it('preflights custom layout archetype references before generation runs', () => {
    const missingArchetypeRecipe = createGameboardRecipe(
      { seed: 'missing-layout-archetype', shape: { kind: 'rectangle', width: 2, height: 2 } },
      [],
      {
        pieceDeclarations: [
          {
            id: 'missing-camp-crate',
            assetId: 'crate_A_small',
            source: 'Recipe fixtures',
            role: 'custom',
            archetype: 'missing-camp',
          },
        ],
        pieceFills: [{ selection: { ids: ['missing-camp-crate'] }, count: 1 }],
        layoutFills: [{ id: 'missing-banner', archetype: 'missing-camp', assetId: 'flag_blue', count: 1 }],
      }
    );
    const kindlessArchetypeRecipe = createGameboardRecipe(
      { seed: 'kindless-layout-archetype', shape: { kind: 'rectangle', width: 2, height: 2 } },
      [],
      {
        layoutArchetypes: {
          kindless: {
            id: 'kindless',
            label: 'Kindless',
            criteria: { terrain: 'grass' },
          },
          mismatch: {
            id: 'other-id',
            label: 'Mismatch',
            kind: 'prop',
            layer: 'feature',
            criteria: { terrain: 'grass' },
          },
        },
        layoutFills: [{ id: 'kindless-fill', archetype: 'kindless', assetId: 'crate_A_small', count: 1 }],
      }
    );

    expect(validateGameboardRecipeGeneration(missingArchetypeRecipe).map((violation) => violation.code)).toEqual([
      'recipe.layout_archetype_missing',
      'recipe.layout_archetype_missing',
    ]);
    expect(inspectGameboardRecipe(missingArchetypeRecipe).plan).toBeUndefined();
    expect(validateGameboardRecipe(kindlessArchetypeRecipe).map((violation) => violation.code)).toEqual([
      'recipe.layout_archetype_id_mismatch',
      'recipe.layout_archetype_kind_missing',
    ]);
  });

  it('compiles a recipe that exercises many additive step kinds in one pass (PRD E0c)', () => {
    const recipe = createGameboardRecipe(
      {
        seed: 'recipe-many-step-kinds',
        shape: { kind: 'rectangle', width: 6, height: 6 },
      },
      [
        { action: 'setElevation', at: { q: 0, r: 0 }, elevation: 1 },
        { action: 'setTextureSet', at: { q: 0, r: 0 }, textureSet: 'default' },
        { action: 'addRoadPath', path: [{ q: 0, r: 1 }, { q: 1, r: 1 }] },
        { action: 'addFactionBuilding', at: { q: 3, r: 2 }, kind: 'home_A', faction: 'blue' },
        { action: 'addFlag', at: { q: 0, r: 3 }, faction: 'blue' },
        { action: 'addHill', at: { q: 2, r: 3 } },
        { action: 'addForest', at: { q: 3, r: 3 } },
      ] as readonly GameboardRecipeStep[]
    );
    const plan = createGameboardPlanFromRecipe(recipe);
    expect(plan).toBeDefined();
    expect(plan.tiles.length).toBeGreaterThan(0);
    expect(plan.placements.length).toBeGreaterThan(3);
  });

  it('compiles addBridge / addFortification / addConstructionSite / addSiegeProjectile / addElevationRamp / addProp steps (E0h)', () => {
    const recipe = createGameboardRecipe(
      {
        seed: 'composite-recipe',
        shape: { kind: 'rectangle', width: 6, height: 6 },
      },
      [
        { action: 'addBridge', at: { q: 1, r: 0 }, facing: 1 },
        { action: 'addFortification', at: { q: 2, r: 0 }, faction: 'blue', kind: 'wall' },
        { action: 'addConstructionSite', at: { q: 3, r: 0 }, faction: 'blue' },
        { action: 'addSiegeProjectile', at: { q: 4, r: 0 }, faction: 'blue', kind: 'catapult' },
        { action: 'addElevationRamp', at: { q: 5, r: 0 }, facing: 1 },
        {
          action: 'addProp',
          at: { q: 0, r: 1 },
          assetId: 'flag_blue',
          kind: 'prop',
        },
      ]
    );
    const plan = createGameboardPlanFromRecipe(recipe);
    expect(plan.placements.length).toBeGreaterThan(5);
  });
});
