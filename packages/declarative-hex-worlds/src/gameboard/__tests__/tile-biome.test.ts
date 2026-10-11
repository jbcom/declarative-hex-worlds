import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import { validateGameboardPlan } from '../../rules/validation';
import {
  assertGameboardTileBiome,
  createGameboardBuilder,
  type GameboardPlan,
  type GameboardTileSpec,
} from '../index';

const SHAPE = { kind: 'rectangle', width: 5, height: 5 } as const;

function builder() {
  return createGameboardBuilder({ seed: 'tile-biome', shape: SHAPE });
}

function tileAt(plan: GameboardPlan, key: string): GameboardTileSpec {
  const tile = plan.tiles.find((candidate) => candidate.key === key);
  if (!tile) {
    throw new Error(`missing tile ${key}`);
  }
  return tile;
}

describe('open tile biome on the builder', () => {
  it('leaves biome absent on tiles that were never assigned one', () => {
    const plan = builder().build();
    expect(plan.tiles.every((tile) => !('biome' in tile))).toBe(true);
  });

  it('stores any non-empty string, unmodified, without enumerating a vocabulary', () => {
    const plan = builder()
      .setBiome({ q: 1, r: 1 }, 'wheat')
      .setBiome({ q: 2, r: 1 }, 'Corn Field / late')
      .setBiome({ q: 3, r: 1 }, 'x')
      .build();
    expect(tileAt(plan, '1,1').biome).toBe('wheat');
    expect(tileAt(plan, '2,1').biome).toBe('Corn Field / late');
    expect(tileAt(plan, '3,1').biome).toBe('x');
    expect(tileAt(plan, '0,0').biome).toBeUndefined();
  });

  it('replaces an earlier biome on the same tile', () => {
    const plan = builder()
      .setBiome({ q: 1, r: 1 }, 'wheat')
      .setBiome({ q: 1, r: 1 }, 'fallow')
      .build();
    expect(tileAt(plan, '1,1').biome).toBe('fallow');
  });

  it('rejects an empty or blank biome with the library validation error', () => {
    expect(() => builder().setBiome({ q: 1, r: 1 }, '')).toThrow(GameboardValidationError);
    expect(() => builder().setBiome({ q: 1, r: 1 }, '   ')).toThrow(GameboardValidationError);
    expect(() => builder().setBiome({ q: 1, r: 1 }, 7 as unknown as string)).toThrow(
      GameboardValidationError
    );
    expect(() => builder().setBiome({ q: 1, r: 1 }, '')).toThrow(/biome/);
  });

  it('still reports a missing tile before accepting a biome', () => {
    expect(() => builder().setBiome({ q: 40, r: 40 }, 'wheat')).toThrow(/No tile exists/);
  });

  it('is not overwritten when features change terrain, tags, elevation or connectivity', () => {
    const plan = builder()
      .setBiome({ q: 1, r: 1 }, 'wheat')
      .setBiome({ q: 2, r: 1 }, 'wheat')
      .setBiome({ q: 3, r: 1 }, 'wheat')
      .setBiome({ q: 1, r: 2 }, 'wheat')
      .setBiome({ q: 2, r: 2 }, 'wheat')
      .setBiome({ q: 3, r: 2 }, 'wheat')
      .setBiome({ q: 1, r: 3 }, 'wheat')
      .setBiome({ q: 2, r: 3 }, 'wheat')
      .addRoadPath([
        { q: 1, r: 1 },
        { q: 2, r: 1 },
      ])
      .addRiverPath([
        { q: 2, r: 1 },
        { q: 3, r: 1 },
      ])
      .addHill({ q: 1, r: 2 })
      .addForest({ q: 2, r: 2 })
      .addMountainStack({ at: { q: 3, r: 2 }, height: 2 })
      .setElevation({ q: 1, r: 3 }, 2)
      .setCoastEdges({ q: 2, r: 3 }, [1])
      .setTerrain({ q: 1, r: 1 }, 'water')
      .build();

    expect(tileAt(plan, '1,1')).toMatchObject({ terrain: 'water', biome: 'wheat' });
    expect(tileAt(plan, '2,1')).toMatchObject({ biome: 'wheat' });
    expect(tileAt(plan, '2,1').roadEdges).not.toBe(0);
    expect(tileAt(plan, '2,1').riverEdges).not.toBe(0);
    expect(tileAt(plan, '3,1')).toMatchObject({ terrain: 'river', biome: 'wheat' });
    expect(tileAt(plan, '1,2')).toMatchObject({ terrain: 'hill', biome: 'wheat' });
    expect(tileAt(plan, '2,2')).toMatchObject({ terrain: 'forest', biome: 'wheat' });
    expect(tileAt(plan, '3,2')).toMatchObject({ terrain: 'mountain', biome: 'wheat' });
    expect(tileAt(plan, '1,3')).toMatchObject({ elevation: 2, biome: 'wheat' });
    expect(tileAt(plan, '2,3')).toMatchObject({ terrain: 'coast', biome: 'wheat' });
  });

  it('is not part of the tag set, so tag rebuilds cannot drop it', () => {
    const plan = builder().setBiome({ q: 1, r: 1 }, 'wheat').addHill({ q: 1, r: 1 }).build();
    expect(tileAt(plan, '1,1').tags).not.toContain('wheat');
    expect(tileAt(plan, '1,1').biome).toBe('wheat');
  });

  it('is set by setTileAsset when given, and kept when omitted', () => {
    const plan = builder()
      .setTileAsset({ at: { q: 1, r: 1 }, assetId: 'hex_grass', biome: 'orchard' })
      .setTileAsset({ at: { q: 2, r: 1 }, assetId: 'hex_grass', biome: 'orchard' })
      .setTileAsset({ at: { q: 2, r: 1 }, assetId: 'hex_grass', terrain: 'road', tags: ['lane'] })
      .build();
    expect(tileAt(plan, '1,1').biome).toBe('orchard');
    expect(tileAt(plan, '2,1')).toMatchObject({ terrain: 'road', biome: 'orchard' });
  });

  it('rejects an invalid biome through setTileAsset', () => {
    expect(() =>
      builder().setTileAsset({ at: { q: 1, r: 1 }, assetId: 'hex_grass', biome: '' })
    ).toThrow(GameboardValidationError);
  });

  it('does not share mutable state between the builder and the built plan', () => {
    const b = builder().setBiome({ q: 1, r: 1 }, 'wheat');
    const first = b.build();
    b.setBiome({ q: 1, r: 1 }, 'fallow');
    expect(tileAt(first, '1,1').biome).toBe('wheat');
  });
});

describe('assertGameboardTileBiome', () => {
  it('accepts non-empty strings and names the offending tile in the message', () => {
    expect(() => assertGameboardTileBiome('wheat')).not.toThrow();
    expect(() => assertGameboardTileBiome('', '3,4')).toThrow(/3,4/);
    expect(() => assertGameboardTileBiome(undefined)).toThrow(GameboardValidationError);
  });
});

describe('plan validation of tile biomes', () => {
  it('reports a tile.invalid_biome error for blank biomes loaded from untrusted JSON', () => {
    const plan = builder().build();
    const first = plan.tiles[0] as GameboardTileSpec;
    const tampered: GameboardPlan = {
      ...plan,
      tiles: [{ ...first, biome: ' ' }, ...plan.tiles.slice(1)],
    };
    const violations = validateGameboardPlan(tampered).filter(
      (v) => v.code === 'tile.invalid_biome'
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe('error');
  });

  it('does not report valid or absent biomes', () => {
    const plan = builder().setBiome({ q: 1, r: 1 }, 'wheat').build();
    expect(validateGameboardPlan(plan).filter((v) => v.code === 'tile.invalid_biome')).toEqual([]);
  });
});
