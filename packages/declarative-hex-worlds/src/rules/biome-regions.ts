/**
 * Seeded, contiguous tile-biome growth driven by consumer-owned numeric
 * fields. Pure plan computation; recipe generation mounts its result in Koota.
 * @module
 */
import seedrandom from 'seedrandom';
// biome-ignore lint/style/noRestrictedImports: pure generation must not import the runtime coordinates barrel.
import { hexKey, neighbors } from '../coordinates/coordinates';
import type { GameboardPlan, GameboardTileSpec } from '../gameboard/plan';
import type { HexCoordinates } from '../types';
import { type BiomeCandidate, BiomeFrontier } from './biome-regions-frontier';
import { regionIdOffset, withRegionId } from './biome-regions-ids';
import { rankSeedCandidates, sourcesFor } from './biome-regions-seeds';
import { eligible, suitability } from './biome-regions-tiles';
import type {
  GameboardBiomeRegionReport,
  GameboardBiomeRegionRule,
  GameboardBiomeRegionsSpec,
} from './biome-regions-types';
import { validateBiomeRegionsSpec } from './biome-regions-validation';

export type {
  GameboardBiomeFieldBand,
  GameboardBiomeRegionReport,
  GameboardBiomeRegionRule,
  GameboardBiomeRegionsSpec,
  GameboardBiomeSuitability,
} from './biome-regions-types';

/**
 * One contiguous claim of a biome. A biome without `maxRegion` has a single
 * unbounded region fed by every source; with `maxRegion` each source, and each
 * region planted later, has its own.
 */
interface Region {
  sources: GameboardTileSpec[];
  frontier: BiomeFrontier;
  tiles: string[];
  cap: number;
}

interface Growth {
  rule: GameboardBiomeRegionRule;
  target: number;
  claimed: number;
  sources: GameboardTileSpec[];
  regions: Region[];
  /** Whether the biome grows capped regions (`maxRegion`) rather than one combined frontier. */
  capped: boolean;
  /** Index of the region that takes the biome's next turn. */
  turn: number;
  /** No free eligible tile is left to plant a region on, and no frontier has revived. */
  dry: boolean;
  scores: Map<string, number>;
  eligible: Set<string>;
}

function pinAssignments(tiles: Map<string, GameboardTileSpec>): Map<string, string | undefined> {
  const pins = new Map<string, string | undefined>();
  for (const tile of tiles.values()) {
    if (tile.pinned === true) pins.set(tile.key, tile.biome);
  }
  return pins;
}

function components(
  assignments: Map<string, string | undefined>,
  adjacency: Map<string, string[]>,
  biome: string,
  excluded: ReadonlyMap<string, unknown> = new Map()
): string[][] {
  const remaining = new Set(
    [...assignments]
      .filter(([key, value]) => value === biome && !excluded.has(key))
      .map(([key]) => key)
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
 *
 * A rule with `maxRegion` grows a patchwork instead of blobs: every source gets
 * its own region, regions of one biome take turns, none passes `maxRegion`
 * tiles, and when they are all capped or boxed in a new region is planted on
 * the best free eligible tile beside land this stage already claimed (any
 * biome), or anywhere eligible when none touches. Set the stage's
 * `regionField` to record each tile's region id in its numeric fields.
 */
export function generateGameboardBiomeRegions(
  plan: GameboardPlan,
  spec: GameboardBiomeRegionsSpec
): { plan: GameboardPlan; report: GameboardBiomeRegionReport } {
  return generateBiomeStage(plan, spec, new Map());
}

function generateBiomeStage(
  plan: GameboardPlan,
  spec: GameboardBiomeRegionsSpec,
  inherited: ReadonlyMap<string, string>
): { plan: GameboardPlan; report: GameboardBiomeRegionReport } {
  validateBiomeRegionsSpec(spec);
  const engine = new RegionGrowth(plan, spec, inherited);
  engine.initialize();
  engine.run();
  engine.cleanup();
  return engine.result(plan);
}

class RegionGrowth {
  readonly tiles: Map<string, GameboardTileSpec>;
  readonly pins: Map<string, string | undefined>;
  readonly reserved: Map<string, string | undefined>;
  readonly assignments: Map<string, string | undefined>;
  readonly adjacency: Map<string, string[]>;
  readonly growths: Growth[];
  /** Regions to re-offer to when a tile is claimed, by the source tile they list. */
  private readonly sourceRegions = new Map<string, Region[]>();
  /** Every tile that touches a tile this stage claimed, whether or not still free. */
  private readonly contact = new Set<string>();
  /** Ids of this stage's regions start after this value (see `regionIdOffset`). */
  private readonly idOffset: number;

  constructor(
    plan: GameboardPlan,
    readonly spec: GameboardBiomeRegionsSpec,
    inherited: ReadonlyMap<string, string>
  ) {
    this.tiles = new Map(
      [...plan.tiles]
        .sort((a, b) => a.key.localeCompare(b.key, 'en'))
        .map((tile) => [tile.key, tile])
    );
    this.pins = pinAssignments(this.tiles);
    this.reserved = new Map([...inherited, ...this.pins]);
    this.assignments = new Map(this.reserved);
    this.adjacency = new Map(
      [...this.tiles.values()].map((tile) => [
        tile.key,
        neighbors(tile.coordinates)
          .map(hexKey)
          .filter((key) => this.tiles.has(key)),
      ])
    );
    this.growths = spec.biomes.map((rule) => this.createGrowth(rule));
    this.idOffset =
      spec.regionField === undefined ? 0 : regionIdOffset(plan.tiles, spec.regionField);
  }

  private createGrowth(rule: GameboardBiomeRegionRule): Growth {
    const values = [...this.tiles.values()];
    const capped = rule.maxRegion !== undefined;
    const growth: Growth = {
      rule,
      target: Math.floor((this.tiles.size - this.reserved.size) * rule.target),
      claimed: 0,
      sources: [],
      regions: [],
      capped,
      turn: 0,
      dry: false,
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
    // An uncapped biome is one region from the start; its sources arrive in initialize().
    if (!capped) this.addRegion(growth, [], Number.POSITIVE_INFINITY);
    return growth;
  }

  private addRegion(growth: Growth, sources: GameboardTileSpec[], cap: number): Region {
    const region: Region = { sources, frontier: new BiomeFrontier(), tiles: [], cap };
    growth.regions.push(region);
    this.indexSources(region);
    return region;
  }

  private indexSources(region: Region): void {
    for (const source of region.sources) {
      this.sourceRegions.set(source.key, [...(this.sourceRegions.get(source.key) ?? []), region]);
    }
  }

  private affinity(biome: string, adjacent: string | undefined): number {
    return (this.spec.affinity ?? []).reduce((score, pair) => {
      const matches =
        (pair.a === biome && pair.b === adjacent) || (pair.b === biome && pair.a === adjacent);
      return score + (matches ? pair.weight : 0);
    }, 0);
  }

  private offer(growth: Growth, region: Region, key: string): void {
    if (this.assignments.has(key) || !growth.eligible.has(key)) return;
    const score = (this.adjacency.get(key) as string[]).reduce(
      (sum, next) => sum + this.affinity(growth.rule.biome, this.assignments.get(next)),
      growth.scores.get(key) as number
    );
    region.frontier.offer({ key, score });
    growth.dry = false;
  }

  private full(region: Region): boolean {
    return region.tiles.length >= region.cap;
  }

  private claim(growth: Growth, region: Region, candidate: BiomeCandidate): void {
    this.assignments.set(candidate.key, growth.rule.biome);
    growth.claimed += 1;
    region.tiles.push(candidate.key);
    const shared = this.sourceRegions.get(candidate.key) ?? [];
    for (const next of this.adjacency.get(candidate.key) as string[]) {
      this.contact.add(next);
      if (!this.full(region)) this.offer(growth, region, next);
      for (const other of this.growths) {
        for (const otherRegion of other.regions) {
          if (this.full(otherRegion)) continue;
          if (otherRegion.frontier.has(next) || shared.includes(otherRegion)) {
            this.offer(other, otherRegion, next);
          }
        }
      }
    }
  }

  initialize(): void {
    for (const growth of this.growths) {
      growth.sources = sourcesFor(
        growth.rule,
        growth.target,
        growth.eligible,
        this.tiles,
        this.reserved,
        this.spec.seed
      );
      if (!growth.capped) {
        const [combined] = growth.regions as [Region];
        combined.sources = growth.sources;
        this.indexSources(combined);
      }
    }
    for (const growth of this.growths) {
      for (const tile of growth.sources) {
        if (growth.claimed >= growth.target) break;
        const region = growth.capped
          ? this.addRegion(growth, [tile], growth.rule.maxRegion as number)
          : (growth.regions[0] as Region);
        this.seedSource(growth, region, tile);
      }
    }
  }

  private seedSource(growth: Growth, region: Region, tile: GameboardTileSpec): void {
    if (!this.assignments.has(tile.key) && growth.eligible.has(tile.key)) {
      this.claim(growth, region, { key: tile.key, score: 0 });
      return;
    }
    if (!this.assignments.has(tile.key)) return;
    for (const next of this.adjacency.get(tile.key) as string[]) this.offer(growth, region, next);
  }

  private next(region: Region): BiomeCandidate | undefined {
    let candidate = region.frontier.take();
    while (candidate && this.assignments.has(candidate.key)) candidate = region.frontier.take();
    return candidate;
  }

  /** One claim for a biome's turn: from the next region able to grow, else on a new region. */
  private advance(growth: Growth): boolean {
    if (growth.dry) return false;
    const count = growth.regions.length;
    for (let step = 0; step < count; step += 1) {
      const index = (growth.turn + step) % count;
      const region = growth.regions[index] as Region;
      if (this.full(region)) continue;
      const candidate = this.next(region);
      if (!candidate) continue;
      growth.turn = (index + 1) % count;
      this.claim(growth, region, candidate);
      return true;
    }
    return growth.capped && this.plant(growth);
  }

  /**
   * Starts a region on the best free eligible tile that touches land this stage
   * claimed, so the patchwork stays contiguous, or anywhere eligible when none
   * touches. Free eligible tiles only ever shrink, so finding none ends the biome.
   */
  private plant(growth: Growth): boolean {
    const free = [...this.tiles.values()].filter(
      (tile) => !this.assignments.has(tile.key) && growth.eligible.has(tile.key)
    );
    const beside = free.filter((tile) => this.contact.has(tile.key));
    const [seed] = rankSeedCandidates(
      beside.length > 0 ? beside : free,
      growth.rule,
      this.spec.seed,
      'field'
    );
    if (!seed) {
      growth.dry = true;
      return false;
    }
    const region = this.addRegion(growth, [seed], growth.rule.maxRegion as number);
    this.claim(growth, region, { key: seed.key, score: 0 });
    return true;
  }

  run(): void {
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const growth of this.growths) {
        if (growth.claimed >= growth.target) continue;
        if (this.advance(growth)) progressed = true;
      }
    }
  }

  cleanup(): void {
    for (const key of this.tiles.keys()) {
      if (!this.assignments.has(key)) this.assignments.set(key, this.spec.fill);
    }
    for (const growth of this.growths) {
      if (growth.capped) this.dissolveRegions(growth);
      else this.dissolveComponents(growth);
    }
  }

  private dissolveComponents(growth: Growth): void {
    for (const group of components(this.assignments, this.adjacency, growth.rule.biome)) {
      if (
        group.length >= (growth.rule.minRegion ?? 1) ||
        group.some((key) => this.reserved.has(key))
      )
        continue;
      for (const key of group) this.assignments.set(key, this.spec.fill);
    }
  }

  /** Each region stands or falls on its own size; touching a same-biome pin keeps it. */
  private dissolveRegions(growth: Growth): void {
    for (const region of growth.regions) {
      if (
        region.tiles.length >= (growth.rule.minRegion ?? 1) ||
        region.tiles.some((key) =>
          (this.adjacency.get(key) as string[]).some(
            (next) => this.reserved.get(next) === growth.rule.biome
          )
        )
      )
        continue;
      for (const key of region.tiles) this.assignments.set(key, this.spec.fill);
      region.tiles = [];
    }
  }

  /** The tile groups that count as fields: capped regions, or free components when uncapped. */
  private fieldGroups(growth: Growth): string[][] {
    return growth.capped
      ? growth.regions.map((region) => region.tiles).filter((group) => group.length > 0)
      : components(this.assignments, this.adjacency, growth.rule.biome, this.reserved);
  }

  result(plan: GameboardPlan): { plan: GameboardPlan; report: GameboardBiomeRegionReport } {
    const biomes = Object.create(null) as Record<
      string,
      {
        target: number;
        actual: number;
        sources: HexCoordinates[];
        regions: number[];
        fields?: number;
      }
    >;
    const ids = new Map<string, number>();
    let lastId = this.idOffset;
    for (const growth of this.growths) {
      const groups =
        growth.capped || this.spec.regionField !== undefined ? this.fieldGroups(growth) : undefined;
      for (const group of groups ?? []) {
        lastId += 1;
        for (const key of group) ids.set(key, lastId);
      }
      biomes[growth.rule.biome] = {
        target: growth.target,
        actual: [...this.assignments].filter(
          ([key, biome]) => biome === growth.rule.biome && !this.reserved.has(key)
        ).length,
        sources: growth.sources.map((tile) => ({ ...tile.coordinates })),
        regions: components(this.assignments, this.adjacency, growth.rule.biome)
          .map((group) => group.length)
          .sort((a, b) => b - a),
        ...(groups ? { fields: groups.length } : {}),
      };
    }
    const name = this.spec.regionField;
    return {
      plan: {
        ...plan,
        tiles: plan.tiles.map((tile) => {
          if (this.reserved.has(tile.key)) return tile;
          const next = { ...tile, biome: this.assignments.get(tile.key) };
          const id = ids.get(tile.key);
          return name !== undefined && id !== undefined ? withRegionId(next, name, id) : next;
        }),
      },
      report: { pinned: this.pins.size, biomes },
    };
  }
}

/**
 * Apply ordered stages while preserving the plan's authored tile pins throughout.
 * Stages that write the same `regionField` number their regions past the ids
 * already on the plan, so one field name stays unambiguous across stages.
 */
export function applyGameboardBiomeRegionStages(
  plan: GameboardPlan,
  stages: readonly GameboardBiomeRegionsSpec[]
): GameboardPlan {
  const inherited = new Map<string, string>();
  let current = plan;
  for (const stage of stages) {
    current = generateBiomeStage(current, stage, inherited).plan;
    for (const tile of current.tiles) {
      if (tile.pinned !== true && tile.biome !== undefined && tile.biome !== stage.fill) {
        inherited.set(tile.key, tile.biome);
      }
    }
  }
  return current;
}
