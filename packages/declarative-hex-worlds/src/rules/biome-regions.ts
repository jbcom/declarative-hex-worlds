/**
 * Seeded, contiguous tile-biome growth driven by consumer-owned numeric
 * fields. Pure plan computation; recipe generation mounts its result in Koota.
 * @module
 */
import seedrandom from 'seedrandom';
// biome-ignore lint/style/noRestrictedImports: pure generation must not import the runtime coordinates barrel.
import { hexDistance, hexKey, neighbors } from '../coordinates/coordinates';
import { GameboardValidationError } from '../errors';
import type { GameboardPlan, GameboardTileSpec } from '../gameboard/plan';
import { assertGameboardTileBiome } from '../gameboard/tile-values';
import type { HexCoordinates } from '../types';
import { type BiomeCandidate, BiomeFrontier } from './biome-regions-frontier';

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

/** One biome's target share, starting sites and environmental conditions. */
export interface GameboardBiomeRegionRule {
  biome: string;
  target: number;
  sources: { count: number; spacing?: number } | { tiles: readonly HexCoordinates[] };
  requires?: readonly GameboardBiomeFieldBand[];
  suits?: readonly GameboardBiomeSuitability[];
  minRegion?: number;
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
      }
    >
  >;
}

interface Growth {
  rule: GameboardBiomeRegionRule;
  target: number;
  claimed: number;
  sources: GameboardTileSpec[];
  frontier: BiomeFrontier;
  scores: Map<string, number>;
  eligible: Set<string>;
}

function field(tile: GameboardTileSpec, name: string): number | undefined {
  if (!tile.fields || !Object.hasOwn(tile.fields, name)) return undefined;
  const value = tile.fields[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function eligible(tile: GameboardTileSpec, rule: GameboardBiomeRegionRule): boolean {
  return (rule.requires ?? []).every((band) => {
    const value = field(tile, band.field);
    return (
      value !== undefined &&
      (band.min === undefined || value >= band.min) &&
      (band.max === undefined || value <= band.max)
    );
  });
}

function suitability(tile: GameboardTileSpec, rule: GameboardBiomeRegionRule): number {
  return (rule.suits ?? []).reduce((sum, band) => {
    const value = field(tile, band.field);
    if (value === undefined) return sum;
    const amount = Math.max(0, Math.min(1, (value - band.from) / (band.to - band.from)));
    return sum + amount * band.weight;
  }, 0);
}

function finite(value: number, label: string, minimum = Number.NEGATIVE_INFINITY): void {
  if (!Number.isFinite(value) || value < minimum)
    throw new GameboardValidationError(`Invalid ${label}`);
}

function validateRule(rule: GameboardBiomeRegionRule): void {
  assertGameboardTileBiome(rule.biome);
  finite(rule.target, 'biome target', 0);
  if (rule.target > 1) throw new GameboardValidationError('Biome target must be at most one');
  validateHardBands(rule.requires ?? []);
  validateSuitability(rule.suits ?? []);
  validateSources(rule.sources);
  if (rule.minRegion !== undefined && (!Number.isInteger(rule.minRegion) || rule.minRegion < 1)) {
    throw new GameboardValidationError('Minimum region must be a positive integer');
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

function validateSpec(spec: GameboardBiomeRegionsSpec): void {
  if (typeof spec.seed !== 'string' || !spec.seed)
    throw new GameboardValidationError('Biome stage needs a seed');
  assertGameboardTileBiome(spec.fill);
  finite(spec.edgeNoise ?? 0, 'edge noise', 0);
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

function pinAssignments(tiles: Map<string, GameboardTileSpec>): Map<string, string | undefined> {
  const pins = new Map<string, string | undefined>();
  for (const tile of tiles.values()) {
    if (tile.pinned === true) pins.set(tile.key, tile.biome);
  }
  return pins;
}

function sourcesFor(
  growth: Growth,
  tiles: Map<string, GameboardTileSpec>,
  pins: Map<string, string | undefined>,
  seed: string
): GameboardTileSpec[] {
  const sources = growth.rule.sources;
  if ('tiles' in sources) {
    const unique = new Set(sources.tiles.map(hexKey));
    return [...unique].map((key) => {
      const tile = tiles.get(key);
      if (!tile) throw new GameboardValidationError(`No biome source tile exists at ${key}`);
      return tile;
    });
  }
  const candidates = [...tiles.values()].filter(
    (tile) => growth.eligible.has(tile.key) && !pins.has(tile.key)
  );
  const minimum = candidates.reduce(
    (lowest, tile) => Math.min(lowest, suitability(tile, growth.rule)),
    0
  );
  const ranked = candidates
    .map((tile) => ({
      tile,
      score:
        -Math.log(
          Math.max(
            Number.MIN_VALUE,
            seedrandom(`${seed}:${growth.rule.biome}:source:${tile.key}`)()
          )
        ) /
        (1 + suitability(tile, growth.rule) - minimum),
    }))
    // Input is already key-sorted; stable sorting preserves that order on ties.
    .sort((a, b) => a.score - b.score);
  const selected: GameboardTileSpec[] = [];
  for (const { tile } of ranked) {
    if (selected.length >= Math.min(sources.count, growth.target)) break;
    if (
      selected.every(
        (old) => hexDistance(old.coordinates, tile.coordinates) >= (sources.spacing ?? 0)
      )
    )
      selected.push(tile);
  }
  return selected;
}

function components(
  assignments: Map<string, string | undefined>,
  adjacency: Map<string, string[]>,
  biome: string
): string[][] {
  const remaining = new Set(
    [...assignments].filter(([, value]) => value === biome).map(([key]) => key)
  );
  const result: string[][] = [];
  for (const key of remaining) {
    const group = [key];
    remaining.delete(key);
    for (let i = 0; i < group.length; i += 1) {
      for (const next of adjacency.get(group[i] as string) as string[]) {
        if (remaining.delete(next)) group.push(next);
      }
    }
    result.push(group);
  }
  return result;
}

/**
 * Grow each biome from explicit or seeded suitability-weighted sources.
 * Only adjacent eligible tiles enter a region. Biomes take turns until their
 * targets or reachable frontiers are exhausted; unclaimed tiles receive fill.
 * Affinity updates each neighbouring frontier after a claim. Keyed random
 * streams make tile input order irrelevant. Never mutates the source plan.
 * Undersized regions dissolve into fill, excluding any component with a pin.
 */
export function generateGameboardBiomeRegions(
  plan: GameboardPlan,
  spec: GameboardBiomeRegionsSpec
): { plan: GameboardPlan; report: GameboardBiomeRegionReport } {
  validateSpec(spec);
  const engine = new RegionGrowth(plan, spec);
  engine.initialize();
  engine.run();
  engine.cleanup();
  return engine.result(plan);
}

class RegionGrowth {
  readonly tiles: Map<string, GameboardTileSpec>;
  readonly pins: Map<string, string | undefined>;
  readonly assignments: Map<string, string | undefined>;
  readonly adjacency: Map<string, string[]>;
  readonly growths: Growth[];

  constructor(
    plan: GameboardPlan,
    readonly spec: GameboardBiomeRegionsSpec
  ) {
    this.tiles = new Map(
      [...plan.tiles]
        .sort((a, b) => a.key.localeCompare(b.key, 'en'))
        .map((tile) => [tile.key, tile])
    );
    this.pins = pinAssignments(this.tiles);
    this.assignments = new Map(this.pins);
    this.adjacency = new Map(
      [...this.tiles.values()].map((tile) => [
        tile.key,
        neighbors(tile.coordinates)
          .map(hexKey)
          .filter((key) => this.tiles.has(key)),
      ])
    );
    this.growths = spec.biomes.map((rule) => this.createGrowth(rule));
  }

  private createGrowth(rule: GameboardBiomeRegionRule): Growth {
    const values = [...this.tiles.values()];
    return {
      rule,
      target: Math.floor((this.tiles.size - this.pins.size) * rule.target),
      claimed: 0,
      sources: [],
      frontier: new BiomeFrontier(),
      eligible: new Set(values.filter((tile) => eligible(tile, rule)).map((tile) => tile.key)),
      scores: new Map(
        values.map((tile) => [
          tile.key,
          suitability(tile, rule) +
            seedrandom(`${this.spec.seed}:${rule.biome}:edge:${tile.key}`)() *
              (this.spec.edgeNoise ?? 0),
        ])
      ),
    };
  }

  private affinity(biome: string, adjacent: string | undefined): number {
    return (this.spec.affinity ?? []).reduce((score, pair) => {
      const matches =
        (pair.a === biome && pair.b === adjacent) || (pair.b === biome && pair.a === adjacent);
      return score + (matches ? pair.weight : 0);
    }, 0);
  }

  private offer(growth: Growth, key: string): void {
    if (this.assignments.has(key) || !growth.eligible.has(key)) return;
    const score = (this.adjacency.get(key) as string[]).reduce(
      (sum, next) => sum + this.affinity(growth.rule.biome, this.assignments.get(next)),
      growth.scores.get(key) as number
    );
    growth.frontier.offer({ key, score });
  }

  private claim(growth: Growth, candidate: BiomeCandidate): void {
    this.assignments.set(candidate.key, growth.rule.biome);
    growth.claimed += 1;
    const shared = this.growths.filter((other) =>
      other.sources.some((source) => source.key === candidate.key)
    );
    for (const next of this.adjacency.get(candidate.key) as string[]) {
      this.offer(growth, next);
      for (const other of this.growths) {
        if (other.frontier.has(next) || shared.includes(other)) this.offer(other, next);
      }
    }
  }

  initialize(): void {
    for (const growth of this.growths) {
      growth.sources = sourcesFor(growth, this.tiles, this.pins, this.spec.seed);
    }
    for (const growth of this.growths) {
      for (const tile of growth.sources) {
        if (growth.claimed >= growth.target) break;
        this.seedSource(growth, tile);
      }
    }
  }

  private seedSource(growth: Growth, tile: GameboardTileSpec): void {
    if (!this.assignments.has(tile.key) && growth.eligible.has(tile.key)) {
      this.claim(growth, { key: tile.key, score: 0 });
      return;
    }
    if (!this.assignments.has(tile.key)) return;
    for (const next of this.adjacency.get(tile.key) as string[]) this.offer(growth, next);
  }

  private next(growth: Growth): BiomeCandidate | undefined {
    let candidate = growth.frontier.take();
    while (candidate && this.assignments.has(candidate.key)) candidate = growth.frontier.take();
    return candidate;
  }

  run(): void {
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const growth of this.growths) {
        if (growth.claimed >= growth.target) continue;
        const candidate = this.next(growth);
        if (!candidate) continue;
        this.claim(growth, candidate);
        progressed = true;
      }
    }
  }

  cleanup(): void {
    for (const key of this.tiles.keys()) {
      if (!this.assignments.has(key)) this.assignments.set(key, this.spec.fill);
    }
    for (const growth of this.growths) {
      for (const group of components(this.assignments, this.adjacency, growth.rule.biome)) {
        if (group.length >= (growth.rule.minRegion ?? 1) || group.some((key) => this.pins.has(key)))
          continue;
        for (const key of group) this.assignments.set(key, this.spec.fill);
      }
    }
  }

  result(plan: GameboardPlan): { plan: GameboardPlan; report: GameboardBiomeRegionReport } {
    const biomes = Object.create(null) as Record<
      string,
      {
        target: number;
        actual: number;
        sources: HexCoordinates[];
        regions: number[];
      }
    >;
    for (const growth of this.growths) {
      biomes[growth.rule.biome] = {
        target: growth.target,
        actual: [...this.assignments].filter(
          ([key, biome]) => biome === growth.rule.biome && !this.pins.has(key)
        ).length,
        sources: growth.sources.map((tile) => ({ ...tile.coordinates })),
        regions: components(this.assignments, this.adjacency, growth.rule.biome)
          .map((group) => group.length)
          .sort((a, b) => b - a),
      };
    }
    return {
      plan: {
        ...plan,
        tiles: plan.tiles.map((tile) =>
          this.pins.has(tile.key) ? tile : { ...tile, biome: this.assignments.get(tile.key) }
        ),
      },
      report: { pinned: this.pins.size, biomes },
    };
  }
}

/** Apply ordered stages while preserving the plan's authored tile pins throughout. */
export function applyGameboardBiomeRegionStages(
  plan: GameboardPlan,
  stages: readonly GameboardBiomeRegionsSpec[]
): GameboardPlan {
  return stages.reduce(
    (current, stage) => generateGameboardBiomeRegions(current, stage).plan,
    plan
  );
}
