import { describe, expect, it } from 'vitest';
import {
  createMedievalGameboardBlueprintPlan,
  createMedievalGameboardBlueprintRecipe,
  createMedievalShowcaseBlueprintRecipe,
  inspectMedievalGameboardBlueprint,
} from '../../src/blueprint';
import { freeManifest } from '../../src/manifest/free';
import { createGameboardPlanFromRecipe } from '../../src/recipe';
import { createHexTileRegistryFromManifest } from '../../src/registry';
import { validateGameboardPlan } from '../../src/validation';

describe('medieval gameboard blueprints', () => {
  it('compiles board intent into mountains, towns, roads, harbors, biomes, and transitions', () => {
    const inspection = inspectMedievalGameboardBlueprint({
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

  it('keeps recipe texture-set steps serializable', () => {
    const recipe = createMedievalGameboardBlueprintRecipe({
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
    expect(first.placements.filter((placement) => placement.metadata.densityPreset === 'units')).toHaveLength(3);
  });

  it('builds a plan directly when games do not need intermediate recipe JSON', () => {
    const plan = createMedievalGameboardBlueprintPlan({
      seed: 'direct-blueprint-plan',
      shape: { kind: 'hexagon', radius: 3 },
      waterFill: 0.12,
      towns: 1,
      harbors: 1,
    });

    expect(plan.tiles.length).toBeGreaterThan(0);
    expect(plan.placements.some((placement) => placement.metadata.feature === 'harbor')).toBe(true);
  });
});
