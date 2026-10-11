/**
 * Public authoring and report types for seeded biome regions. They live apart
 * from the growth engine so the validation, seeding and numbering helpers can
 * share them without importing the engine back.
 * @module
 */
import type { HexCoordinates } from '../types';

/** Hard inclusive limits over a named finite tile field; absent fields fail. */
export interface GameboardBiomeFieldBand {
  field: string;
  min?: number;
  max?: number;
}

/** Suitability rises linearly from zero at `from` to `weight` at `to`, then saturates. */
export interface GameboardBiomeSuitability {
  field: string;
  from: number;
  to: number;
  weight: number;
}

/**
 * One biome's target share, starting sites and environmental conditions.
 *
 * Without `maxRegion` the biome grows as one combined frontier from all its
 * sources, so a large target becomes a few large blobs. With `maxRegion` every
 * source grows its own region and stops claiming at that many tiles; when all
 * of the biome's regions are capped or boxed in and the target is still unmet,
 * the biome plants a new region beside land the stage already claimed (see
 * {@link GameboardBiomeRegionsSpec.regionField} to record which tile belongs to
 * which region). That is how farm country becomes a patchwork of small fields.
 */
export interface GameboardBiomeRegionRule {
  biome: string;
  target: number;
  sources: { count: number; spacing?: number } | { tiles: readonly HexCoordinates[] };
  requires?: readonly GameboardBiomeFieldBand[];
  suits?: readonly GameboardBiomeSuitability[];
  /**
   * Smallest surviving region, in unpinned tiles. Undersized regions dissolve
   * into fill. Without `maxRegion` this applies to each connected component of
   * the biome; with `maxRegion` it applies to each region on its own, so a
   * two-tile field does not survive just because it touches a larger one.
   * Anything continuing a same-biome pinned or earlier-stage tile is kept.
   */
  minRegion?: number;
  /**
   * Largest region, in tiles. A positive integer, and at least `minRegion`.
   * Switches the biome from one combined frontier to one region per source,
   * with new regions planted beside claimed land once those are capped.
   */
  maxRegion?: number;
}

/**
 * One ordered generation stage. Give each stage a namespaced buried seed.
 * Authored `GameboardTileSpec.pinned` values survive growth and cleanup,
 * including pinned tiles that have no biome assigned.
 * Targets are shares of unpinned tiles, with a combined maximum of one.
 */
export interface GameboardBiomeRegionsSpec {
  seed: string;
  fill: string;
  biomes: readonly GameboardBiomeRegionRule[];
  affinity?: readonly { a: string; b: string; weight: number }[];
  edgeNoise?: number;
  /**
   * Name of a tile field that receives the id of the region that claimed the
   * tile: a positive integer, unique per region within the stage and numbered
   * from one in order of region creation (biomes in rule order). Biomes
   * without `maxRegion` number their connected components. Fill, pinned and
   * earlier-stage tiles keep their fields untouched, and ids start past the
   * highest value already on the plan's tiles in that field, so stages that
   * share a field never collide. Lets a renderer fence fields apart even when
   * two neighbouring fields grow the same crop.
   */
  regionField?: string;
}

/** Requested and reached free-tile counts, source sites and final component sizes. */
export interface GameboardBiomeRegionReport {
  pinned: number;
  biomes: Readonly<
    Record<
      string,
      {
        target: number;
        actual: number;
        sources: readonly HexCoordinates[];
        regions: readonly number[];
        /**
         * Surviving regions of this biome. Present when the rule sets
         * `maxRegion` or the stage sets `regionField`; matches the ids written.
         */
        fields?: number;
      }
    >
  >;
}
