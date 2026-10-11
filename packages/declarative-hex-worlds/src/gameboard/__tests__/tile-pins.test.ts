import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../index';
import { GameboardValidationError } from '../../errors';
import { validateGameboardPlan } from '../../rules/validation';
import { createGameboardInteropSnapshot } from '../../interop/interop';
import { applyTerrainHexesToPlan } from '../terrain-hexes';
import { createGameboardWorld } from '../../koota/index';
import { projectWorldToGameboardPlan } from '../../coordinates/projection';
import { inspectGameboardLayoutSites } from '../../coordinates/layout';
import { createGameboardPlanFromRecipe, createGameboardRecipe } from '../../scenario/recipe';
import { applyGameboardRecipeGeneration } from '../../scenario/recipe-generation';

const at = { q: 1, r: 1 };
const options = { seed: 'pins', shape: { kind: 'rectangle', width: 3, height: 3 } } as const;

function pinnedPlan() {
  return createGameboardBuilder(options)
    .setBiome(at, 'authored-woodlot')
    .setFields(at, { slope: 0.3 })
    .pinTile(at)
    .build();
}

describe('authored tile pins', () => {
  it('keeps seeded recipe layout fills off a pin through their Koota generation round trip', () => {
    const recipe = createGameboardRecipe(options, [{ action: 'pinTile', at }], {
      layoutFills: [
        {
          assetId: 'flag_green',
          archetype: 'prop',
          count: 9,
          criteria: { allowOccupied: true, maxPerTile: 1 },
        },
      ],
    });
    const plan = createGameboardPlanFromRecipe(recipe, {}, applyGameboardRecipeGeneration);
    expect(plan.tiles.find((tile) => tile.key === '1,1')?.pinned).toBe(true);
    const generated = plan.placements.filter((placement) => placement.kind === 'prop');
    expect(generated).toHaveLength(8);
    expect(generated.some((placement) => placement.tileKey === '1,1')).toBe(false);
  });

  it('rejects invalid pin values instead of treating them as truthy', () => {
    expect(() => createGameboardBuilder(options).pinTile(at, 'yes' as unknown as boolean)).toThrow(
      GameboardValidationError
    );
    const source = pinnedPlan();
    const tampered = {
      ...source,
      tiles: source.tiles.map((tile) =>
        tile.key === '1,1' ? { ...tile, pinned: 'yes' as unknown as boolean } : tile
      ),
    };
    expect(
      validateGameboardPlan(tampered).some((violation) => violation.code === 'tile.invalid_pin')
    ).toBe(true);
  });

  it('carries the pin into an engine-neutral interop snapshot', () => {
    const snapshot = createGameboardInteropSnapshot(pinnedPlan());
    expect(snapshot.entities.find((entity) => entity.id === 'tile:1,1')?.components).toHaveProperty(
      'TilePinned'
    );
    expect(
      snapshot.entities.find((entity) => entity.id === 'tile:0,0')?.components
    ).not.toHaveProperty('TilePinned');
  });

  it('keeps seeded decoration scatter off pinned tiles', () => {
    const plan = createGameboardBuilder(options)
      .pinTile(at)
      .scatterDecorations({
        count: 9,
        assets: ['tree_A'],
        avoidOccupied: false,
      })
      .build();
    const scattered = plan.placements.filter((placement) => placement.kind === 'decoration');
    expect(scattered).toHaveLength(8);
    expect(scattered.some((placement) => placement.tileKey === '1,1')).toBe(false);
  });

  it('rejects unpinned anchors whose footprint overlaps a pin', () => {
    const inspection = inspectGameboardLayoutSites(pinnedPlan(), {
      criteria: { allowOccupied: true, footprint: 1, requireFootprintInBounds: false },
    });
    expect(
      inspection.candidates.every((site) => site.footprintTiles.every((tile) => !tile.pinned))
    ).toBe(true);
    expect(
      inspection.rejected.some(
        (site) =>
          site.key !== '1,1' && site.rejections.some((rejection) => rejection.code === 'pinned')
      )
    ).toBe(true);
  });

  it('persists a pin through plan -> Koota -> projection and can explicitly unpin', () => {
    const source = pinnedPlan();
    expect(source.tiles.find((tile) => tile.key === '1,1')?.pinned).toBe(true);
    const world = createGameboardWorld(source);
    try {
      expect(
        projectWorldToGameboardPlan(world).tiles.find((tile) => tile.key === '1,1')?.pinned
      ).toBe(true);
    } finally {
      world.destroy();
    }
    const unpinned = createGameboardBuilder(options).pinTile(at).pinTile(at, false).build();
    expect(unpinned.tiles.find((tile) => tile.key === '1,1')?.pinned).toBeUndefined();
  });

  it('does not change the shape of tiles with no pin and leaves explicit authoring available', () => {
    expect(
      createGameboardBuilder(options)
        .build()
        .tiles.every((tile) => !('pinned' in tile))
    ).toBe(true);
    const edited = createGameboardBuilder(options)
      .pinTile(at)
      .setBiome(at, 'authored-orchard')
      .build();
    expect(edited.tiles.find((tile) => tile.key === '1,1')).toMatchObject({
      pinned: true,
      biome: 'authored-orchard',
    });
  });

  it('compiles serializable pin and unpin recipe steps', () => {
    const recipe = createGameboardRecipe(options, [
      { action: 'setBiome', at, biome: 'farmstead' },
      { action: 'pinTile', at },
    ]);
    const plan = createGameboardPlanFromRecipe(JSON.parse(JSON.stringify(recipe)));
    expect(plan.tiles.find((tile) => tile.key === '1,1')).toMatchObject({
      pinned: true,
      biome: 'farmstead',
    });
  });

  it('does not overwrite a pinned tile with projected terrain facts', () => {
    const source = pinnedPlan();
    const next = applyTerrainHexesToPlan(
      source,
      [
        {
          key: '1,1',
          coordinates: at,
          center: { x: 0, z: 0 },
          meanHeight: 10,
          minHeight: 8,
          maxHeight: 12,
          meanSlope: 0.9,
          dominantBiome: 'generated-field',
        },
      ],
      { fields: { slope: 'meanSlope' }, biome: 'dominant' }
    );
    expect(next.tiles.find((tile) => tile.key === '1,1')).toBe(
      source.tiles.find((tile) => tile.key === '1,1')
    );
  });

  it('excludes pinned layout sites unless the caller explicitly opts in', () => {
    const source = pinnedPlan();
    const defaultSites = inspectGameboardLayoutSites(source, { criteria: { allowOccupied: true } });
    expect(defaultSites.candidates.some((site) => site.key === '1,1')).toBe(false);
    expect(
      defaultSites.rejected
        .find((site) => site.key === '1,1')
        ?.rejections.map((rejection) => rejection.code)
    ).toContain('pinned');
    const optedIn = inspectGameboardLayoutSites(source, {
      criteria: { allowOccupied: true, allowPinned: true },
    });
    expect(optedIn.candidates.some((site) => site.key === '1,1')).toBe(true);
  });
});
