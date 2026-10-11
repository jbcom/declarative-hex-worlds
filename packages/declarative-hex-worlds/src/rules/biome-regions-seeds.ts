/**
 * Seed selection for biome regions: the starting sites of each biome and the
 * site of every region planted later. Draws are suitability-weighted and keyed
 * by stage seed, biome, purpose and tile, so tile input order is irrelevant.
 * @module
 */
import seedrandom from 'seedrandom';
// biome-ignore lint/style/noRestrictedImports: pure generation must not import the runtime coordinates barrel.
import { hexDistance, hexKey } from '../coordinates/coordinates';
import { GameboardValidationError } from '../errors';
import type { GameboardTileSpec } from '../gameboard/plan';
import { suitability } from './biome-regions-tiles';
import type { GameboardBiomeRegionRule } from './biome-regions-types';

/**
 * Orders candidates best first. Each tile draws an exponential variate keyed by
 * `purpose` and divides it by its suitability (shifted so the least suitable
 * candidate weighs one); the lowest result wins, which makes suitable tiles
 * likelier without making the choice predictable. Candidates must arrive in a
 * stable key order: the sort is stable, so ties keep it.
 */
export function rankSeedCandidates(
  candidates: readonly GameboardTileSpec[],
  rule: GameboardBiomeRegionRule,
  seed: string,
  purpose: string,
  /** Memo of each tile's keyed draw, for callers that rank the same tiles often. */
  draws?: Map<string, number>
): GameboardTileSpec[] {
  // The minimum is over this subset: suitability weights may be negative.
  const minimum = candidates.reduce((lowest, tile) => Math.min(lowest, suitability(tile, rule)), 0);
  const draw = (key: string) => {
    let value = draws?.get(key);
    if (value === undefined) {
      value = -Math.log(
        Math.max(Number.MIN_VALUE, seedrandom(`${seed}:${rule.biome}:${purpose}:${key}`)())
      );
      draws?.set(key, value);
    }
    return value;
  };
  return candidates
    .map((tile) => ({
      tile,
      score: draw(tile.key) / (1 + suitability(tile, rule) - minimum),
    }))
    .sort((a, b) => a.score - b.score)
    .map(({ tile }) => tile);
}

/** Explicit source tiles, or seeded draws that respect spacing and the target. */
export function sourcesFor(
  rule: GameboardBiomeRegionRule,
  target: number,
  eligibleKeys: ReadonlySet<string>,
  tiles: ReadonlyMap<string, GameboardTileSpec>,
  pins: ReadonlyMap<string, string | undefined>,
  seed: string
): GameboardTileSpec[] {
  const sources = rule.sources;
  if ('tiles' in sources) {
    const unique = new Set(sources.tiles.map(hexKey));
    return [...unique].map((key) => {
      const tile = tiles.get(key);
      if (!tile) throw new GameboardValidationError(`No biome source tile exists at ${key}`);
      return tile;
    });
  }
  // Input is already key-sorted; stable sorting preserves that order on ties.
  const ranked = rankSeedCandidates(
    [...tiles.values()].filter((tile) => eligibleKeys.has(tile.key) && !pins.has(tile.key)),
    rule,
    seed,
    'source'
  );
  const selected: GameboardTileSpec[] = [];
  for (const tile of ranked) {
    if (selected.length >= Math.min(sources.count, target)) break;
    if (
      selected.every(
        (old) => hexDistance(old.coordinates, tile.coordinates) >= (sources.spacing ?? 0)
      )
    )
      selected.push(tile);
  }
  return selected;
}
