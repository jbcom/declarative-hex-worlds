/**
 * The bridge from continuous terrain to hex tiles: writes the per-hex facts
 * `projectTerrainToHexes` measures (height, slope, biome shares, dominant
 * biome) onto a plan's tiles as numeric `fields` and, when asked, the tile
 * `biome`, so layout criteria and runtime systems can read them.
 *
 * @module
 */
import { hexKey } from '../coordinates';
import type { TerrainHex } from '../terrain';
import type { GameboardPlan, GameboardTileSpec } from './plan';
import {
  assertGameboardTileBiome,
  describeGameboardTileFieldsProblem,
  normalizeGameboardTileFields,
} from './tile-values';
import { GameboardValidationError } from '../errors';

/** The numeric summaries of a {@link TerrainHex} that can be copied straight into a field. */
export type TerrainHexScalar = 'meanHeight' | 'minHeight' | 'maxHeight' | 'meanSlope';

/**
 * Where one tile field comes from: a scalar of the hex, the share of one biome
 * under it (`0` when the hex has a biome field but none of that biome, absent
 * when it has no biome field at all), or a function of the hex (return
 * `undefined` to leave the field alone).
 */
export type TerrainHexFieldSource =
  | TerrainHexScalar
  | { readonly biomeShare: string }
  | ((hex: TerrainHex) => number | undefined);

/** Where the tile biome comes from: the hex's dominant biome, or a function of the hex. */
export type TerrainHexBiomeSource = 'dominant' | ((hex: TerrainHex) => string | undefined);

/** Which terrain facts {@link applyTerrainHexesToPlan} writes, and under which names. */
export interface TerrainHexTileMapping {
  /** Tile field name to the source of its value. Field names are the game's own vocabulary. */
  readonly fields?: Readonly<Record<string, TerrainHexFieldSource>>;
  /**
   * Also set the tile `biome`. Left out, tile biomes are never touched. A
   * source that yields `undefined` leaves that tile's existing biome alone.
   */
  readonly biome?: TerrainHexBiomeSource;
}

/**
 * Returns a copy of `plan` with terrain facts written onto its tiles by axial
 * coordinate. Hexes with no tile on the board are ignored (a terrain grid is
 * often larger than the board), tiles with no hex are left alone, and the
 * mapped values merge over each tile's existing `fields`. The input plan is not
 * modified and untouched tiles keep their identity.
 *
 * @throws GameboardValidationError when a field name is not allowed, a derived
 * value is not a finite number, or a derived biome is blank.
 */
export function applyTerrainHexesToPlan(
  plan: GameboardPlan,
  terrainHexes: readonly TerrainHex[],
  mapping: TerrainHexTileMapping
): GameboardPlan {
  const sources = Object.entries(mapping.fields ?? {});
  const namesProblem = describeGameboardTileFieldsProblem(
    Object.fromEntries(sources.map(([name]) => [name, 0]))
  );
  if (namesProblem !== undefined) {
    throw new GameboardValidationError(`Terrain hex mapping ${namesProblem}`);
  }

  const hexesByKey = new Map<string, TerrainHex>();
  for (const hex of terrainHexes) {
    hexesByKey.set(hexKey(hex.coordinates), hex);
  }

  const tiles = plan.tiles.map((tile) => {
    const hex = hexesByKey.get(tile.key);
    return hex === undefined ? tile : withTerrainHexFacts(tile, hex, sources, mapping.biome);
  });
  return { ...plan, tiles };
}

function withTerrainHexFacts(
  tile: GameboardTileSpec,
  hex: TerrainHex,
  sources: readonly (readonly [string, TerrainHexFieldSource])[],
  biomeSource: TerrainHexBiomeSource | undefined
): GameboardTileSpec {
  const derived: Record<string, number> = {};
  for (const [name, source] of sources) {
    const value = resolveFieldSource(hex, source);
    if (value !== undefined) {
      derived[name] = value;
    }
  }
  const hasFields = Object.keys(derived).length > 0;
  const biome = biomeSource === undefined ? undefined : resolveBiomeSource(hex, biomeSource);
  if (biome !== undefined) {
    assertGameboardTileBiome(biome, tile.key);
  }
  if (!hasFields && biome === undefined) {
    return tile;
  }
  return {
    ...tile,
    ...(biome === undefined ? {} : { biome }),
    ...(hasFields
      ? { fields: normalizeGameboardTileFields({ ...tile.fields, ...derived }, tile.key) }
      : {}),
  };
}

function resolveFieldSource(hex: TerrainHex, source: TerrainHexFieldSource): number | undefined {
  if (typeof source === 'string') {
    return hex[source];
  }
  if (typeof source === 'function') {
    return source(hex);
  }
  if (hex.biomeShares === undefined) return undefined;
  return Object.hasOwn(hex.biomeShares, source.biomeShare)
    ? hex.biomeShares[source.biomeShare]
    : 0;
}

function resolveBiomeSource(hex: TerrainHex, source: TerrainHexBiomeSource): string | undefined {
  return source === 'dominant' ? hex.dominantBiome : source(hex);
}
