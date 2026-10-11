import { describe, expect, it } from 'vitest';
import { createGameboardBuilder, type GameboardPlan } from '../../gameboard/index';
import { createGameboardWorld, readGameboardPlacements } from '../../koota/index';
import {
  createGameboardLayoutArchetypeRegistry,
  inspectGameboardLayoutSites,
  resolveGameboardLayoutCriteria,
  selectGameboardLayoutSites,
  type GameboardLayoutCriteria,
} from '../layout';
import { spawnGameboardLayoutPlacements } from '../layout-runtime';

/**
 * 4x1 strip, left to right:
 *   0,0 wheat  slope .05 wetness .9
 *   1,0 wheat  slope .30 wetness .2
 *   2,0 orchard slope .05 wetness .5
 *   3,0 (no biome, no fields)
 */
function strip(): GameboardPlan {
  return createGameboardBuilder({ seed: 'layout-biome', shape: { kind: 'rectangle', width: 4, height: 1 } })
    .setBiome({ q: 0, r: 0 }, 'wheat')
    .setFields({ q: 0, r: 0 }, { slope: 0.05, wetness: 0.9 })
    .setBiome({ q: 1, r: 0 }, 'wheat')
    .setFields({ q: 1, r: 0 }, { slope: 0.3, wetness: 0.2 })
    .setBiome({ q: 2, r: 0 }, 'orchard')
    .setFields({ q: 2, r: 0 }, { slope: 0.05, wetness: 0.5 })
    .build();
}

function accepted(criteria: GameboardLayoutCriteria): string[] {
  return inspectGameboardLayoutSites(strip(), { criteria: { allowOccupied: true, ...criteria } })
    .candidates.map((candidate) => candidate.tile.key)
    .sort();
}

function rejectionCodes(criteria: GameboardLayoutCriteria): Record<string, string[]> {
  const inspection = inspectGameboardLayoutSites(strip(), { criteria: { allowOccupied: true, ...criteria } });
  const byTile: Record<string, string[]> = {};
  for (const rejected of inspection.rejected) {
    byTile[rejected.key] = rejected.rejections.map((rejection) => rejection.code);
  }
  return byTile;
}

describe('biome criteria', () => {
  it('biome keeps only tiles whose biome is listed; tiles without a biome never match', () => {
    expect(accepted({ biome: 'wheat' })).toEqual(['0,0', '1,0']);
    expect(accepted({ biome: ['wheat', 'orchard'] })).toEqual(['0,0', '1,0', '2,0']);
    expect(rejectionCodes({ biome: 'wheat' })).toEqual({ '2,0': ['biome'], '3,0': ['biome'] });
  });

  it('excludeBiome drops listed biomes but keeps tiles that have none', () => {
    expect(accepted({ excludeBiome: 'wheat' })).toEqual(['2,0', '3,0']);
    expect(accepted({ excludeBiome: ['wheat', 'orchard'] })).toEqual(['3,0']);
    expect(rejectionCodes({ excludeBiome: 'orchard' })).toEqual({ '2,0': ['excluded-biome'] });
  });

  it('requiredAdjacentBiome needs a neighbour in the listed biomes', () => {
    expect(accepted({ requiredAdjacentBiome: 'orchard' })).toEqual(['1,0', '3,0']);
    expect(accepted({ requiredAdjacentBiome: ['orchard', 'wheat'] })).toEqual(['0,0', '1,0', '2,0', '3,0']);
    expect(rejectionCodes({ requiredAdjacentBiome: 'orchard' })).toEqual({
      '0,0': ['missing-adjacent-biome'],
      '2,0': ['missing-adjacent-biome'],
    });
  });

  it('forbiddenAdjacentBiome rejects tiles that touch a listed biome', () => {
    expect(accepted({ forbiddenAdjacentBiome: 'orchard' })).toEqual(['0,0', '2,0']);
    expect(rejectionCodes({ forbiddenAdjacentBiome: 'wheat' })).toEqual({
      '0,0': ['forbidden-adjacent-biome'],
      '1,0': ['forbidden-adjacent-biome'],
      '2,0': ['forbidden-adjacent-biome'],
    });
  });

  it('combines with terrain criteria', () => {
    expect(accepted({ biome: 'wheat', terrain: 'water' })).toEqual([]);
    expect(accepted({ biome: 'wheat', terrain: 'grass', forbiddenAdjacentBiome: 'orchard' })).toEqual(['0,0']);
  });
});

describe('field band criteria', () => {
  it('min and max are inclusive and either may be open', () => {
    expect(accepted({ fields: [{ field: 'slope', max: 0.05 }] })).toEqual(['0,0', '2,0']);
    expect(accepted({ fields: [{ field: 'slope', min: 0.3 }] })).toEqual(['1,0']);
    expect(accepted({ fields: [{ field: 'wetness', min: 0.5, max: 0.9 }] })).toEqual(['0,0', '2,0']);
    expect(accepted({ fields: [{ field: 'wetness', min: 0.51, max: 0.89 }] })).toEqual([]);
  });

  it('every band must hold, and a tile lacking the named field fails the band', () => {
    expect(
      accepted({
        fields: [
          { field: 'slope', max: 0.1 },
          { field: 'wetness', min: 0.6 },
        ],
      })
    ).toEqual(['0,0']);
    expect(accepted({ fields: [{ field: 'soil', min: -100 }] })).toEqual([]);
    expect(rejectionCodes({ fields: [{ field: 'slope', max: 0.1 }] })).toEqual({
      '1,0': ['field-band'],
      '3,0': ['field-band'],
    });
  });

  it('a band with no bounds only requires the field to be present', () => {
    expect(accepted({ fields: [{ field: 'slope' }] })).toEqual(['0,0', '1,0', '2,0']);
  });

  it('works together with biome criteria', () => {
    expect(accepted({ biome: 'wheat', fields: [{ field: 'slope', max: 0.1 }] })).toEqual(['0,0']);
  });
});

describe('criteria flow through the layout APIs', () => {
  it('selectGameboardLayoutSites honours biome and field criteria', () => {
    const sites = selectGameboardLayoutSites(strip(), {
      count: 4,
      seed: 'select',
      criteria: { biome: 'wheat', fields: [{ field: 'wetness', min: 0.8 }], allowOccupied: true },
    });
    expect(sites.map((site) => site.tile.key)).toEqual(['0,0']);
  });

  it('archetype criteria can carry biome and fields and merge with caller overrides', () => {
    const registry = createGameboardLayoutArchetypeRegistry([
      {
        id: 'wet-meadow-marker',
        label: 'Wet meadow marker',
        kind: 'prop',
        layer: 'feature',
        criteria: { biome: 'wheat', fields: [{ field: 'wetness', min: 0.8 }], allowOccupied: true },
      },
    ]);
    const base = resolveGameboardLayoutCriteria('wet-meadow-marker', undefined, registry);
    expect(base).toMatchObject({ biome: 'wheat', fields: [{ field: 'wetness', min: 0.8 }] });
    const sites = selectGameboardLayoutSites(strip(), { count: 4, seed: 'archetype', criteria: base });
    expect(sites.map((site) => site.tile.key)).toEqual(['0,0']);

    const overridden = resolveGameboardLayoutCriteria(
      'wet-meadow-marker',
      { fields: [{ field: 'slope', max: 0.1 }] },
      registry
    );
    expect(overridden).toMatchObject({ biome: 'wheat', fields: [{ field: 'slope', max: 0.1 }] });
    expect(
      selectGameboardLayoutSites(strip(), { count: 4, seed: 'archetype', criteria: overridden }).map(
        (site) => site.tile.key
      )
    ).toEqual(['0,0']);
  });

  it('reads biome and fields from live Koota tiles when spawning placements', () => {
    const world = createGameboardWorld(strip());
    spawnGameboardLayoutPlacements(world, {
      count: 4,
      seed: 'runtime',
      idPrefix: 'marker',
      assetId: 'external:marker',
      kind: 'prop',
      layer: 'feature',
      requiresExtra: true,
      criteria: { biome: 'wheat', fields: [{ field: 'slope', max: 0.1 }], allowOccupied: true },
    });
    const markers = readGameboardPlacements(world).filter((placement) => placement.id.startsWith('marker'));
    expect(markers.map((placement) => placement.tileKey)).toEqual(['0,0']);
    world.destroy();
  });
});
