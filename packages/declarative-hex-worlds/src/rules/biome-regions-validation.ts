/**
 * Authoring validation for seeded biome region stages. Throws
 * `GameboardValidationError` before any growth runs.
 * @module
 */
import { GameboardValidationError } from '../errors';
import {
  assertGameboardTileBiome,
  describeGameboardTileFieldsProblem,
} from '../gameboard/tile-values';
import type {
  GameboardBiomeFieldBand,
  GameboardBiomeRegionRule,
  GameboardBiomeRegionsSpec,
  GameboardBiomeSuitability,
} from './biome-regions-types';

function finite(value: number, label: string, minimum = Number.NEGATIVE_INFINITY): void {
  if (!Number.isFinite(value) || value < minimum)
    throw new GameboardValidationError(`Invalid ${label}`);
}

function positiveInteger(value: number | undefined, message: string): void {
  if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
    throw new GameboardValidationError(message);
  }
}

function validateRule(rule: GameboardBiomeRegionRule): void {
  assertGameboardTileBiome(rule.biome);
  finite(rule.target, 'biome target', 0);
  if (rule.target > 1) throw new GameboardValidationError('Biome target must be at most one');
  validateHardBands(rule.requires ?? []);
  validateSuitability(rule.suits ?? []);
  validateSources(rule.sources);
  positiveInteger(rule.minRegion, 'Minimum region must be a positive integer');
  positiveInteger(rule.maxRegion, 'Maximum region must be a positive integer');
  if (
    rule.minRegion !== undefined &&
    rule.maxRegion !== undefined &&
    rule.minRegion > rule.maxRegion
  ) {
    throw new GameboardValidationError('Minimum region must not exceed maximum region');
  }
}

function validateHardBands(bands: readonly GameboardBiomeFieldBand[]): void {
  for (const band of bands) {
    if (!band.field) throw new GameboardValidationError('Field band needs a name');
    if (band.min !== undefined) finite(band.min, 'field minimum');
    if (band.max !== undefined) finite(band.max, 'field maximum');
    if ((band.min ?? -Infinity) > (band.max ?? Infinity))
      throw new GameboardValidationError('Reversed field band');
  }
}

function validateSuitability(bands: readonly GameboardBiomeSuitability[]): void {
  for (const band of bands) {
    if (!band.field) throw new GameboardValidationError('Suitability needs a field name');
    finite(band.from, 'suitability start');
    finite(band.to, 'suitability end');
    finite(band.weight, 'suitability weight');
    if (band.from === band.to)
      throw new GameboardValidationError('Suitability endpoints must differ');
  }
}

function validateSources(sources: GameboardBiomeRegionRule['sources']): void {
  if ('tiles' in sources) return;
  finite(sources.count, 'source count', 0);
  finite(sources.spacing ?? 0, 'source spacing', 0);
  if (!Number.isInteger(sources.count))
    throw new GameboardValidationError('Source count must be an integer');
}

function validateRegionField(name: unknown): void {
  if (name === undefined) return;
  // One definition of a legal field name: the tile field store's own check.
  const problem =
    typeof name === 'string'
      ? describeGameboardTileFieldsProblem(Object.fromEntries([[name, 1]]))
      : 'field name must be a string';
  if (problem !== undefined) {
    throw new GameboardValidationError(`Invalid region field: ${problem}`);
  }
}

/** Throws unless the stage, every rule and every affinity pair are well formed. */
export function validateBiomeRegionsSpec(spec: GameboardBiomeRegionsSpec): void {
  if (typeof spec.seed !== 'string' || !spec.seed)
    throw new GameboardValidationError('Biome stage needs a seed');
  assertGameboardTileBiome(spec.fill);
  finite(spec.edgeNoise ?? 0, 'edge noise', 0);
  validateRegionField(spec.regionField);
  const names = new Set<string>();
  let total = 0;
  for (const rule of spec.biomes) {
    validateRule(rule);
    if (names.has(rule.biome) || rule.biome === spec.fill)
      throw new GameboardValidationError('Biome names must be unique and distinct from fill');
    names.add(rule.biome);
    total += rule.target;
  }
  if (total > 1 + Number.EPSILON)
    throw new GameboardValidationError('Biome targets exceed the free tile count');
  for (const pair of spec.affinity ?? []) {
    assertGameboardTileBiome(pair.a);
    assertGameboardTileBiome(pair.b);
    finite(pair.weight, 'biome affinity');
  }
}
