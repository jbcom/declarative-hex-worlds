/**
 * Per-tile reads shared by biome region seeding and growth: numeric field
 * lookup, hard eligibility bands and suitability scoring.
 * @module
 */
import type { GameboardTileSpec } from '../gameboard/plan';
import type { GameboardBiomeRegionRule } from './biome-regions-types';

/** A finite numeric tile field, or `undefined` when absent or inherited. */
export function field(tile: GameboardTileSpec, name: string): number | undefined {
  if (!tile.fields || !Object.hasOwn(tile.fields, name)) return undefined;
  const value = tile.fields[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Whether every hard `requires` band admits the tile. */
export function eligible(tile: GameboardTileSpec, rule: GameboardBiomeRegionRule): boolean {
  return (rule.requires ?? []).every((band) => {
    const value = field(tile, band.field);
    return (
      value !== undefined &&
      (band.min === undefined || value >= band.min) &&
      (band.max === undefined || value <= band.max)
    );
  });
}

/** Summed, clamped suitability of the tile for the rule's `suits` bands. */
export function suitability(tile: GameboardTileSpec, rule: GameboardBiomeRegionRule): number {
  return (rule.suits ?? []).reduce((sum, band) => {
    const value = field(tile, band.field);
    if (value === undefined) return sum;
    const amount = Math.max(0, Math.min(1, (value - band.from) / (band.to - band.from)));
    return sum + amount * band.weight;
  }, 0);
}
