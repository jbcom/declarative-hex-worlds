import seedrandom from 'seedrandom';
import { containsHex, hexDistance, hexKey, hexRange, neighbor, parseHexKey } from './coordinates';
import { KAYKIT_HEX_DEPTH, KAYKIT_HEX_WIDTH, axialToWorld } from './grid';
import type {
  GameboardPlacementKind,
  GameboardPlacementLayer,
  GameboardPlacementSpec,
  GameboardPlan,
  GameboardTerrain,
  GameboardTileSpec,
} from './gameboard';
import {
  GameboardState,
  readGameboardPlacements,
  readGameboardTiles,
  spawnGameboardPlacement,
  type GameboardPlacementPositionOffset,
  type PlacementStateValue,
  type SpawnGameboardPlacementOptions,
} from './koota';
import type { HexCoordinates, HexEdgeIndex } from './types';
import type { Entity, World } from 'koota';

export type GameboardLayoutPreference =
  | { kind: 'center'; weight?: number }
  | { kind: 'edge'; weight?: number }
  | { kind: 'near-terrain'; terrain: GameboardTerrain | readonly GameboardTerrain[]; radius?: number; weight?: number }
  | { kind: 'far-from-terrain'; terrain: GameboardTerrain | readonly GameboardTerrain[]; radius?: number; weight?: number }
  | {
      kind: 'near-placement-kind';
      placementKind: GameboardPlacementKind | readonly GameboardPlacementKind[];
      radius?: number;
      weight?: number;
    }
  | {
      kind: 'far-from-placement-kind';
      placementKind: GameboardPlacementKind | readonly GameboardPlacementKind[];
      radius?: number;
      weight?: number;
    }
  | { kind: 'high-elevation'; weight?: number }
  | { kind: 'low-elevation'; weight?: number };

export type BuiltInGameboardLayoutArchetypeId =
  | 'surface'
  | 'building'
  | 'harbor'
  | 'unit'
  | 'prop'
  | 'tree'
  | 'scatter'
  | 'landmark';
export type GameboardLayoutArchetypeId = BuiltInGameboardLayoutArchetypeId | (string & {});
export type GameboardLayoutArchetypeInput = GameboardLayoutArchetypeId | GameboardLayoutArchetype;
export type GameboardLayoutArchetypeRegistryInput =
  | GameboardLayoutArchetypeRegistry
  | readonly GameboardLayoutArchetype[];
export type GameboardLayoutFootprintInput =
  | 'single'
  | 'adjacent'
  | number
  | {
      kind: 'single' | 'adjacent' | 'radius' | 'custom';
      radius?: number;
      edges?: readonly HexEdgeIndex[];
      offsets?: readonly HexCoordinates[];
      includeCenter?: boolean;
    };

export interface ResolvedGameboardLayoutFootprint {
  kind: 'single' | 'adjacent' | 'radius' | 'custom';
  radius: number;
  edges?: readonly HexEdgeIndex[];
  offsets?: readonly HexCoordinates[];
  includeCenter: boolean;
}

export interface GameboardLayoutArchetype {
  id: GameboardLayoutArchetypeId;
  label: string;
  kind?: GameboardPlacementKind;
  layer?: GameboardPlacementLayer;
  criteria: GameboardLayoutCriteria;
  rotationSteps?: number | 'random';
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export type GameboardLayoutArchetypeRegistry = Readonly<Record<string, GameboardLayoutArchetype>>;

export interface CreateGameboardLayoutArchetypeRegistryOptions {
  includeBuiltIns?: boolean;
}

export interface GameboardLayoutCriteria {
  terrain?: GameboardTerrain | readonly GameboardTerrain[];
  excludeTerrain?: GameboardTerrain | readonly GameboardTerrain[];
  elevation?: number | readonly number[];
  minElevation?: number;
  maxElevation?: number;
  tileTags?: readonly string[];
  excludeTileTags?: readonly string[];
  requiredAdjacentTerrain?: GameboardTerrain | readonly GameboardTerrain[];
  forbiddenAdjacentTerrain?: GameboardTerrain | readonly GameboardTerrain[];
  requiredAdjacentPlacementKind?: GameboardPlacementKind | readonly GameboardPlacementKind[];
  forbiddenAdjacentPlacementKind?: GameboardPlacementKind | readonly GameboardPlacementKind[];
  requiredAdjacentPlacementLayer?: GameboardPlacementLayer | readonly GameboardPlacementLayer[];
  forbiddenAdjacentPlacementLayer?: GameboardPlacementLayer | readonly GameboardPlacementLayer[];
  footprint?: GameboardLayoutFootprintInput;
  requireFootprintInBounds?: boolean;
  requireFootprintUnoccupied?: boolean;
  footprintTerrain?: GameboardTerrain | readonly GameboardTerrain[];
  excludeFootprintTerrain?: GameboardTerrain | readonly GameboardTerrain[];
  allowOccupied?: boolean;
  blockingPlacementKinds?: readonly GameboardPlacementKind[];
  blockingPlacementLayers?: readonly GameboardPlacementLayer[];
  ignorePlacementIds?: readonly string[];
  minDistanceFrom?: readonly (HexCoordinates | string)[];
  minDistance?: number;
  maxDistanceFrom?: readonly (HexCoordinates | string)[];
  maxDistance?: number;
  edgePadding?: number;
  minDistanceBetween?: number;
  maxPerTile?: number;
  slotGroup?: string;
  prefer?: readonly GameboardLayoutPreference[];
}

export interface SelectGameboardLayoutSitesOptions {
  count: number;
  seed?: string | number;
  criteria?: GameboardLayoutCriteria;
}

export interface GameboardLayoutSite {
  tile: GameboardTileSpec;
  key: string;
  coordinates: HexCoordinates;
  position: ReturnType<typeof axialToWorld>;
  score: number;
  slotIndex: number;
  usedSlotIndexes: readonly number[];
  occupied: boolean;
  placements: readonly GameboardPlacementSpec[];
  footprintTiles: readonly GameboardTileSpec[];
  footprintKeys: readonly string[];
  footprintPlacements: readonly GameboardPlacementSpec[];
  reasons: readonly string[];
}

export type GameboardLayoutSiteRejectionCode =
  | 'footprint-out-of-bounds'
  | 'footprint-terrain'
  | 'terrain'
  | 'excluded-terrain'
  | 'elevation'
  | 'missing-required-tags'
  | 'excluded-tags'
  | 'occupied'
  | 'edge-padding'
  | 'missing-adjacent-terrain'
  | 'forbidden-adjacent-terrain'
  | 'missing-adjacent-placement-kind'
  | 'forbidden-adjacent-placement-kind'
  | 'missing-adjacent-placement-layer'
  | 'forbidden-adjacent-placement-layer'
  | 'min-distance'
  | 'max-distance'
  | 'slots-full';

export interface GameboardLayoutSiteRejection {
  code: GameboardLayoutSiteRejectionCode;
  message: string;
}

export interface GameboardLayoutRejectedSite {
  tile: GameboardTileSpec;
  key: string;
  coordinates: HexCoordinates;
  occupied: boolean;
  placements: readonly GameboardPlacementSpec[];
  footprintKeys: readonly string[];
  footprintPlacements: readonly GameboardPlacementSpec[];
  rejections: readonly GameboardLayoutSiteRejection[];
}

export interface InspectGameboardLayoutSitesOptions {
  count?: number;
  seed?: string | number;
  criteria?: GameboardLayoutCriteria;
}

export interface GameboardLayoutSiteInspection {
  seed: string;
  selectedCount: number;
  candidateCount: number;
  rejectedCount: number;
  rejectionCounts: Readonly<Partial<Record<GameboardLayoutSiteRejectionCode, number>>>;
  selected: readonly GameboardLayoutSite[];
  candidates: readonly GameboardLayoutSite[];
  rejected: readonly GameboardLayoutRejectedSite[];
}

export interface GameboardLayoutPlacementOptions
  extends Omit<SpawnGameboardPlacementOptions, 'at' | 'id' | 'kind' | 'layer' | 'rotationSteps'> {
  archetype?: GameboardLayoutArchetypeInput;
  archetypes?: GameboardLayoutArchetypeRegistry;
  kind?: GameboardPlacementKind;
  layer?: GameboardPlacementLayer;
  count?: number;
  seed?: string | number;
  idPrefix?: string;
  rotationSteps?: number | 'random';
  criteria?: GameboardLayoutCriteria;
}

export interface GameboardLayoutFillRule
  extends Omit<GameboardLayoutPlacementOptions, 'assetId' | 'count' | 'seed' | 'idPrefix'> {
  id?: string;
  assetId?: string;
  assets?: readonly string[];
  count?: number;
  fill?: number;
  minCount?: number;
  maxCount?: number;
  idPrefix?: string;
}

export interface GameboardLayoutFillOptions {
  seed?: string | number;
  rules: readonly GameboardLayoutFillRule[];
}

export interface GameboardLayoutFillRuleAnalysis {
  id: string;
  ruleIndex: number;
  archetypeId?: GameboardLayoutArchetypeId;
  kind?: GameboardPlacementKind;
  layer?: GameboardPlacementLayer;
  assetIds: readonly string[];
  selectedAssetIds: readonly string[];
  candidateCount: number;
  rejectedSiteCount: number;
  rejectionCounts: Readonly<Partial<Record<GameboardLayoutSiteRejectionCode, number>>>;
  requestedCount: number;
  targetCount: number;
  selectedCount: number;
  selectedTileKeys: readonly string[];
  warnings: readonly string[];
  errors: readonly string[];
}

export interface GameboardLayoutFillAnalysis {
  seed: string;
  ruleCount: number;
  placementCount: number;
  candidateCount: number;
  warningCount: number;
  errorCount: number;
  warnings: readonly string[];
  errors: readonly string[];
  rules: readonly GameboardLayoutFillRuleAnalysis[];
}

const DEFAULT_BLOCKING_KINDS = ['structure', 'unit', 'prop'] as const satisfies readonly GameboardPlacementKind[];
const DEFAULT_LAYOUT_PREFERENCES = [
  { kind: 'center', weight: 1 },
  { kind: 'low-elevation', weight: 0.2 },
] as const satisfies readonly GameboardLayoutPreference[];

export const GAMEBOARD_LAYOUT_ARCHETYPES = {
  surface: {
    id: 'surface',
    label: 'Surface',
    layer: 'surface',
    criteria: {
      allowOccupied: true,
      blockingPlacementKinds: [],
      maxPerTile: 1,
      prefer: [{ kind: 'center', weight: 0.2 }],
    },
  },
  building: {
    id: 'building',
    label: 'Building',
    kind: 'structure',
    layer: 'structure',
    criteria: {
      terrain: ['grass', 'road', 'coast'],
      allowOccupied: false,
      blockingPlacementKinds: ['decoration', 'structure', 'unit', 'prop'],
      maxPerTile: 1,
      prefer: [{ kind: 'center', weight: 1 }],
    },
    metadata: { layoutBlocksMovement: true },
  },
  harbor: {
    id: 'harbor',
    label: 'Harbor',
    kind: 'structure',
    layer: 'structure',
    criteria: {
      terrain: 'coast',
      requiredAdjacentTerrain: 'water',
      allowOccupied: false,
      blockingPlacementKinds: ['decoration', 'structure', 'unit', 'prop'],
      maxPerTile: 1,
      prefer: [
        { kind: 'near-terrain', terrain: 'water', radius: 1, weight: 1 },
        { kind: 'edge', weight: 0.2 },
      ],
    },
    metadata: { feature: 'harbor', layoutBlocksMovement: true },
  },
  unit: {
    id: 'unit',
    label: 'Unit',
    kind: 'unit',
    layer: 'unit',
    criteria: {
      terrain: ['grass', 'road', 'coast', 'hill', 'forest'],
      allowOccupied: false,
      blockingPlacementKinds: ['structure', 'unit'],
      maxPerTile: 1,
      prefer: [{ kind: 'near-placement-kind', placementKind: 'structure', radius: 4, weight: 0.5 }],
    },
    metadata: { layoutBlocksMovement: true },
  },
  prop: {
    id: 'prop',
    label: 'Prop',
    kind: 'prop',
    layer: 'feature',
    criteria: {
      terrain: ['grass', 'road', 'coast', 'hill', 'forest'],
      allowOccupied: true,
      blockingPlacementKinds: ['structure', 'unit'],
      maxPerTile: 2,
      prefer: [{ kind: 'center', weight: 0.5 }],
    },
  },
  tree: {
    id: 'tree',
    label: 'Tree',
    kind: 'decoration',
    layer: 'feature',
    criteria: {
      terrain: ['grass', 'forest', 'hill'],
      allowOccupied: true,
      blockingPlacementKinds: ['structure', 'unit'],
      maxPerTile: 3,
      slotGroup: 'soft-feature',
      prefer: [
        { kind: 'near-terrain', terrain: 'forest', radius: 3, weight: 1 },
        { kind: 'far-from-placement-kind', placementKind: 'structure', radius: 3, weight: 0.35 },
      ],
    },
    rotationSteps: 'random',
  },
  scatter: {
    id: 'scatter',
    label: 'Scatter',
    kind: 'decoration',
    layer: 'feature',
    criteria: {
      terrain: ['grass', 'road', 'coast', 'hill', 'forest'],
      allowOccupied: true,
      blockingPlacementKinds: ['structure', 'unit'],
      maxPerTile: 3,
      slotGroup: 'soft-feature',
      prefer: [{ kind: 'center', weight: 0.2 }],
    },
    rotationSteps: 'random',
  },
  landmark: {
    id: 'landmark',
    label: 'Landmark',
    kind: 'prop',
    layer: 'feature',
    criteria: {
      terrain: ['grass', 'road', 'coast', 'hill'],
      allowOccupied: false,
      blockingPlacementKinds: ['decoration', 'structure', 'unit', 'prop'],
      edgePadding: 1,
      maxPerTile: 1,
      prefer: [
        { kind: 'center', weight: 0.75 },
        { kind: 'high-elevation', weight: 0.25 },
      ],
    },
    metadata: { layoutBlocksMovement: true },
  },
} as const satisfies GameboardLayoutArchetypeRegistry;

export function createGameboardLayoutArchetypeRegistry(
  archetypes: GameboardLayoutArchetypeRegistryInput | undefined = undefined,
  options: CreateGameboardLayoutArchetypeRegistryOptions = {}
): GameboardLayoutArchetypeRegistry {
  const includeBuiltIns = options.includeBuiltIns ?? true;
  return {
    ...(includeBuiltIns ? GAMEBOARD_LAYOUT_ARCHETYPES : {}),
    ...normalizeGameboardLayoutArchetypeRegistry(archetypes),
  };
}

export function normalizeGameboardLayoutArchetypeRegistry(
  archetypes: GameboardLayoutArchetypeRegistryInput | undefined
): GameboardLayoutArchetypeRegistry {
  if (!archetypes) {
    return {};
  }
  if (Array.isArray(archetypes)) {
    return Object.fromEntries(archetypes.map((archetype) => [archetype.id, archetype]));
  }
  return { ...archetypes } as GameboardLayoutArchetypeRegistry;
}

export function resolveGameboardLayoutArchetype(
  archetype: GameboardLayoutArchetypeInput | undefined,
  registry: GameboardLayoutArchetypeRegistry = GAMEBOARD_LAYOUT_ARCHETYPES
): GameboardLayoutArchetype | undefined {
  if (!archetype) {
    return undefined;
  }
  if (typeof archetype !== 'string') {
    return archetype;
  }
  const resolved = registry[archetype];
  if (!resolved) {
    throw new Error(`Unknown gameboard layout archetype: ${archetype}`);
  }
  return resolved;
}

export function resolveGameboardLayoutCriteria(
  archetype: GameboardLayoutArchetypeInput | undefined,
  criteria: GameboardLayoutCriteria | undefined,
  registry: GameboardLayoutArchetypeRegistry = GAMEBOARD_LAYOUT_ARCHETYPES
): GameboardLayoutCriteria {
  return mergeLayoutCriteria(resolveGameboardLayoutArchetype(archetype, registry)?.criteria, criteria) ?? {};
}

export function selectGameboardLayoutSites(
  plan: GameboardPlan,
  options: SelectGameboardLayoutSitesOptions
): GameboardLayoutSite[] {
  const count = Math.max(0, Math.floor(options.count));
  if (count === 0) {
    return [];
  }
  const criteria = options.criteria ?? {};
  const inspected = inspectLayoutSites(plan, criteria, String(options.seed ?? `${plan.seed}:layout`));
  return selectLayoutCandidates(inspected.candidates, count, criteria);
}

export function inspectGameboardLayoutSites(
  plan: GameboardPlan,
  options: InspectGameboardLayoutSitesOptions = {}
): GameboardLayoutSiteInspection {
  const criteria = options.criteria ?? {};
  const seed = String(options.seed ?? `${plan.seed}:layout`);
  const inspected = inspectLayoutSites(plan, criteria, seed);
  const maxPerTile = Math.max(1, Math.floor(criteria.maxPerTile ?? 1));
  const candidates = selectLayoutCandidates(inspected.candidates, plan.tiles.length * maxPerTile, criteria);
  const selected = selectLayoutCandidates(inspected.candidates, options.count ?? candidates.length, criteria);

  return {
    seed,
    selectedCount: selected.length,
    candidateCount: candidates.length,
    rejectedCount: inspected.rejected.length,
    rejectionCounts: countLayoutRejections(inspected.rejected),
    selected,
    candidates,
    rejected: inspected.rejected,
  };
}

function selectLayoutCandidates(
  candidates: readonly GameboardLayoutSite[],
  count: number,
  criteria: GameboardLayoutCriteria
): GameboardLayoutSite[] {
  const limit = Math.max(0, Math.floor(count));
  if (limit === 0) {
    return [];
  }
  const selected: GameboardLayoutSite[] = [];
  const selectedSlots = new Map<string, Set<number>>();
  const minDistanceBetween = Math.max(0, Math.floor(criteria.minDistanceBetween ?? 0));
  const maxPerTile = Math.max(1, Math.floor(criteria.maxPerTile ?? 1));

  for (const candidate of candidates) {
    if (selected.length >= limit) {
      break;
    }
    const usedSlots = selectedSlots.get(candidate.key) ?? new Set(candidate.usedSlotIndexes);
    const farEnough = selected.every(
      (site) => site.key === candidate.key || hexDistance(site.coordinates, candidate.coordinates) >= minDistanceBetween
    );
    if (!farEnough) {
      continue;
    }
    for (let slotIndex = 0; slotIndex < maxPerTile && selected.length < limit; slotIndex += 1) {
      if (usedSlots.has(slotIndex)) {
        continue;
      }
      selected.push({ ...candidate, slotIndex });
      usedSlots.add(slotIndex);
      selectedSlots.set(candidate.key, usedSlots);
    }
  }

  return selected;
}

export function createGameboardLayoutPlacements(
  plan: GameboardPlan,
  options: GameboardLayoutPlacementOptions
): SpawnGameboardPlacementOptions[] {
  const archetype = resolveGameboardLayoutArchetype(options.archetype, options.archetypes);
  const criteria = resolveGameboardLayoutCriteria(options.archetype, options.criteria, options.archetypes);
  const kind = options.kind ?? archetype?.kind;
  if (!kind) {
    throw new Error('createGameboardLayoutPlacements requires kind or an archetype with a kind');
  }
  const layer = options.layer ?? archetype?.layer;
  const rotation = options.rotationSteps ?? archetype?.rotationSteps;
  const sites = selectGameboardLayoutSites(plan, {
    count: options.count ?? 1,
    seed: options.seed,
    criteria,
  });
  const rng = seedrandom(String(options.seed ?? `${plan.seed}:${options.assetId}:layout`));
  return sites.map((site, index) => {
    const baseMetadata = {
      ...(archetype?.metadata ?? {}),
      ...(options.metadata ?? {}),
    };
    const harborFacing = inferredHarborFacing(plan, site.coordinates, baseMetadata, rotation);
    const rotationSteps = rotation === 'random' ? Math.floor(rng() * 6) : (rotation ?? harborFacing);
    const positionOffset = options.positionOffset ?? layoutSlotPositionOffset(site.slotIndex, criteria?.maxPerTile ?? 1);
    return {
      id: options.idPrefix ? `${options.idPrefix}:${index}` : undefined,
      at: site.coordinates,
      assetId: options.assetId,
      kind,
      layer,
      textureSet: options.textureSet,
      elevationOffset: options.elevationOffset,
      positionOffset,
      rotationSteps,
      scale: options.scale,
      order: options.order,
      stackIndex: options.stackIndex,
      requiresExtra: options.requiresExtra,
      occupancyGuard: options.occupancyGuard,
      metadata: {
        ...baseMetadata,
        ...(harborFacing === undefined ? {} : { facing: harborFacing }),
        layoutArchetype: archetype?.id ?? null,
        layoutSeed: String(options.seed ?? `${plan.seed}:layout`),
        layoutScore: round(site.score),
        layoutTile: site.key,
        layoutSlot: site.slotIndex,
        layoutSlotGroup: criteria?.slotGroup ?? null,
        layoutOccupied: site.occupied,
        layoutFootprintSize: site.footprintKeys.length,
        layoutFootprintTiles: site.footprintKeys.join('|'),
        layoutPositionOffsetX: positionOffset?.x ?? 0,
        layoutPositionOffsetY: positionOffset?.y ?? 0,
        layoutPositionOffsetZ: positionOffset?.z ?? 0,
      },
    };
  });
}

export function createGameboardLayoutFillPlacements(
  plan: GameboardPlan,
  options: GameboardLayoutFillOptions
): SpawnGameboardPlacementOptions[] {
  let workingPlan = copyPlan(plan);
  const seed = String(options.seed ?? `${plan.seed}:layout-fill`);
  const placements: SpawnGameboardPlacementOptions[] = [];

  options.rules.forEach((rule, ruleIndex) => {
    const archetype = resolveGameboardLayoutArchetype(rule.archetype, rule.archetypes);
    const criteria = mergeLayoutCriteria(archetype?.criteria, rule.criteria);
    const maxPerTile = Math.max(1, Math.floor(criteria?.maxPerTile ?? 1));
    const candidateCount = selectGameboardLayoutSites(workingPlan, {
      count: workingPlan.tiles.length * maxPerTile,
      seed: `${seed}:${rule.id ?? ruleIndex}:candidates`,
      criteria,
    }).length;
    const targetCount = layoutFillCount(rule, candidateCount);
    if (targetCount === 0) {
      return;
    }
    const selected = createGameboardLayoutPlacements(workingPlan, {
      ...rule,
      assetId: firstAssetForRule(rule, `${seed}:${rule.id ?? ruleIndex}:asset`),
      count: targetCount,
      seed: `${seed}:${rule.id ?? ruleIndex}`,
      idPrefix: rule.idPrefix ?? `layout:${rule.id ?? ruleIndex}`,
      criteria,
    });
    const withAssets = selected.map((placement, placementIndex) => ({
      ...placement,
      assetId: assetForRule(rule, placementIndex, `${seed}:${rule.id ?? ruleIndex}:asset`),
    }));
    placements.push(...withAssets);
    workingPlan = appendGameboardLayoutPlacementsToPlan(workingPlan, withAssets);
  });

  return placements;
}

export function analyzeGameboardLayoutFill(
  plan: GameboardPlan,
  options: GameboardLayoutFillOptions
): GameboardLayoutFillAnalysis {
  let workingPlan = copyPlan(plan);
  const seed = String(options.seed ?? `${plan.seed}:layout-fill`);
  const ruleAnalyses: GameboardLayoutFillRuleAnalysis[] = [];

  options.rules.forEach((rule, ruleIndex) => {
    const archetype = resolveGameboardLayoutArchetype(rule.archetype, rule.archetypes);
    const criteria = mergeLayoutCriteria(archetype?.criteria, rule.criteria);
    const maxPerTile = Math.max(1, Math.floor(criteria?.maxPerTile ?? 1));
    const siteInspection = inspectGameboardLayoutSites(workingPlan, {
      count: workingPlan.tiles.length * maxPerTile,
      seed: `${seed}:${rule.id ?? ruleIndex}:candidates`,
      criteria,
    });
    const candidateCount = siteInspection.candidateCount;
    const requestedCount = layoutFillRequestedCount(rule, candidateCount);
    const targetCount = layoutFillCount(rule, candidateCount);
    const diagnostics = layoutFillDiagnostics(rule, ruleIndex, candidateCount, requestedCount, targetCount);
    let selected: SpawnGameboardPlacementOptions[] = [];

    if (targetCount > 0 && diagnostics.errors.length === 0) {
      selected = createGameboardLayoutPlacements(workingPlan, {
        ...rule,
        assetId: firstAssetForRule(rule, `${seed}:${rule.id ?? ruleIndex}:asset`),
        count: targetCount,
        seed: `${seed}:${rule.id ?? ruleIndex}`,
        idPrefix: rule.idPrefix ?? `layout:${rule.id ?? ruleIndex}`,
        criteria,
      }).map((placement, placementIndex) => ({
        ...placement,
        assetId: assetForRule(rule, placementIndex, `${seed}:${rule.id ?? ruleIndex}:asset`),
      }));
      if (selected.length < targetCount) {
        diagnostics.warnings.push(
          `Layout fill rule ${rule.id ?? ruleIndex} selected ${selected.length} placement(s) after requesting ${targetCount}`
        );
      }
      workingPlan = appendGameboardLayoutPlacementsToPlan(workingPlan, selected);
    }

    ruleAnalyses.push({
      id: String(rule.id ?? ruleIndex),
      ruleIndex,
      archetypeId: archetype?.id,
      kind: rule.kind ?? archetype?.kind,
      layer: rule.layer ?? archetype?.layer,
      assetIds: configuredAssetIds(rule),
      selectedAssetIds: selected.map((placement) => placement.assetId),
      candidateCount,
      rejectedSiteCount: siteInspection.rejectedCount,
      rejectionCounts: siteInspection.rejectionCounts,
      requestedCount,
      targetCount,
      selectedCount: selected.length,
      selectedTileKeys: selected.map((placement) => hexKey(typeof placement.at === 'string' ? parseHexKey(placement.at) : placement.at)),
      warnings: diagnostics.warnings,
      errors: diagnostics.errors,
    });
  });

  const warnings = ruleAnalyses.flatMap((rule) => rule.warnings.map((warning) => `${rule.id}: ${warning}`));
  const errors = ruleAnalyses.flatMap((rule) => rule.errors.map((error) => `${rule.id}: ${error}`));

  return {
    seed,
    ruleCount: options.rules.length,
    placementCount: ruleAnalyses.reduce((count, rule) => count + rule.selectedCount, 0),
    candidateCount: ruleAnalyses.reduce((count, rule) => count + rule.candidateCount, 0),
    warningCount: warnings.length,
    errorCount: errors.length,
    warnings,
    errors,
    rules: ruleAnalyses,
  };
}

export function spawnGameboardLayoutPlacements(
  world: World,
  options: GameboardLayoutPlacementOptions
): Entity[] {
  return createGameboardLayoutPlacements(projectWorldForLayout(world), options).map((placement) =>
    spawnGameboardPlacement(world, placement)
  );
}

export function spawnGameboardLayoutFill(world: World, options: GameboardLayoutFillOptions): Entity[] {
  return createGameboardLayoutFillPlacements(projectWorldForLayout(world), options).map((placement) =>
    spawnGameboardPlacement(world, placement)
  );
}

function inspectLayoutSites(
  plan: GameboardPlan,
  criteria: GameboardLayoutCriteria,
  seed: string
): { candidates: GameboardLayoutSite[]; rejected: GameboardLayoutRejectedSite[] } {
  const rng = seedrandom(seed);
  const placementsByTile = groupPlacementsByTile(plan.placements);
  const candidates: GameboardLayoutSite[] = [];
  const rejected: GameboardLayoutRejectedSite[] = [];

  for (const tile of plan.tiles) {
    const inspection = inspectSiteForTile(plan, tile, placementsByTile, criteria, rng);
    if (inspection.site) {
      candidates.push(inspection.site);
    } else if (inspection.rejected) {
      rejected.push(inspection.rejected);
    }
  }

  candidates.sort(
    (left, right) =>
      right.score - left.score ||
      left.tile.coordinates.r - right.tile.coordinates.r ||
      left.tile.coordinates.q - right.tile.coordinates.q
  );

  return { candidates, rejected };
}

function inspectSiteForTile(
  plan: GameboardPlan,
  tile: GameboardTileSpec,
  placementsByTile: ReadonlyMap<string, readonly GameboardPlacementSpec[]>,
  criteria: GameboardLayoutCriteria,
  rng: seedrandom.PRNG
): { site?: GameboardLayoutSite; rejected?: GameboardLayoutRejectedSite } {
  const reasons: string[] = [];
  const rejections: GameboardLayoutSiteRejection[] = [];
  const ignored = new Set(criteria.ignorePlacementIds ?? []);
  const centerPlacements = placementsByTile.get(tile.key) ?? [];
  const footprintTiles = resolveFootprintTiles(plan, tile.coordinates, criteria);
  if (!footprintTiles) {
    rejections.push({
      code: 'footprint-out-of-bounds',
      message: `${tile.key} cannot satisfy the requested footprint inside the board bounds`,
    });
    return {
      rejected: rejectedLayoutSite(tile, false, centerPlacements, [], [], rejections),
    };
  }
  if (!matchesFootprintTerrain(footprintTiles, criteria.footprintTerrain, criteria.excludeFootprintTerrain)) {
    rejections.push({
      code: 'footprint-terrain',
      message: `${tile.key} footprint terrain does not match the requested footprint terrain criteria`,
    });
  }
  const footprintPlacements = uniquePlacements(
    footprintTiles.flatMap((footprintTile) => [...(placementsByTile.get(footprintTile.key) ?? [])])
  );
  const shouldCheckFootprint =
    criteria.requireFootprintUnoccupied ?? (criteria.footprint !== undefined || criteria.allowOccupied === false);
  const occupancyPlacements = shouldCheckFootprint ? footprintPlacements : centerPlacements;
  const blockingPlacements = occupancyPlacements.filter(
    (placement) => !ignored.has(placement.id) && placementBlocksLayout(placement, criteria)
  );
  const occupied = blockingPlacements.length > 0;

  if (!matchesTerrain(tile.terrain, criteria.terrain)) {
    rejections.push({ code: 'terrain', message: `${tile.key} terrain ${tile.terrain} is not allowed` });
  }
  if (criteria.excludeTerrain && matchesTerrain(tile.terrain, criteria.excludeTerrain)) {
    rejections.push({ code: 'excluded-terrain', message: `${tile.key} terrain ${tile.terrain} is excluded` });
  }
  if (!matchesElevation(tile.elevation, criteria)) {
    rejections.push({ code: 'elevation', message: `${tile.key} elevation ${tile.elevation} is outside the requested range` });
  }
  if (!containsRequiredTags(tile.tags, criteria.tileTags)) {
    rejections.push({ code: 'missing-required-tags', message: `${tile.key} is missing one or more required tile tags` });
  }
  if (containsExcludedTags(tile.tags, criteria.excludeTileTags)) {
    rejections.push({ code: 'excluded-tags', message: `${tile.key} contains an excluded tile tag` });
  }
  if (!criteria.allowOccupied && occupied) {
    rejections.push({ code: 'occupied', message: `${tile.key} is occupied by a blocking placement` });
  }
  if (!outsideEdgePadding(plan.shape, tile.coordinates, criteria.edgePadding ?? 0)) {
    rejections.push({ code: 'edge-padding', message: `${tile.key} is inside the requested edge padding` });
  }
  if (criteria.requiredAdjacentTerrain && !hasAdjacentTerrain(plan, tile.coordinates, criteria.requiredAdjacentTerrain)) {
    rejections.push({ code: 'missing-adjacent-terrain', message: `${tile.key} has no required adjacent terrain` });
  }
  if (hasAdjacentTerrain(plan, tile.coordinates, criteria.forbiddenAdjacentTerrain)) {
    rejections.push({ code: 'forbidden-adjacent-terrain', message: `${tile.key} has forbidden adjacent terrain` });
  }
  if (
    criteria.requiredAdjacentPlacementKind &&
    !hasAdjacentPlacementKind(placementsByTile, tile.coordinates, criteria.requiredAdjacentPlacementKind, ignored)
  ) {
    rejections.push({
      code: 'missing-adjacent-placement-kind',
      message: `${tile.key} has no required adjacent placement kind`,
    });
  }
  if (hasAdjacentPlacementKind(placementsByTile, tile.coordinates, criteria.forbiddenAdjacentPlacementKind, ignored)) {
    rejections.push({
      code: 'forbidden-adjacent-placement-kind',
      message: `${tile.key} has a forbidden adjacent placement kind`,
    });
  }
  if (
    criteria.requiredAdjacentPlacementLayer &&
    !hasAdjacentPlacementLayer(placementsByTile, tile.coordinates, criteria.requiredAdjacentPlacementLayer, ignored)
  ) {
    rejections.push({
      code: 'missing-adjacent-placement-layer',
      message: `${tile.key} has no required adjacent placement layer`,
    });
  }
  if (hasAdjacentPlacementLayer(placementsByTile, tile.coordinates, criteria.forbiddenAdjacentPlacementLayer, ignored)) {
    rejections.push({
      code: 'forbidden-adjacent-placement-layer',
      message: `${tile.key} has a forbidden adjacent placement layer`,
    });
  }
  if (!matchesDistanceRule(tile.coordinates, criteria.minDistanceFrom, criteria.minDistance, 'min')) {
    rejections.push({ code: 'min-distance', message: `${tile.key} is too close to a minimum-distance reference` });
  }
  if (!matchesDistanceRule(tile.coordinates, criteria.maxDistanceFrom, criteria.maxDistance, 'max')) {
    rejections.push({ code: 'max-distance', message: `${tile.key} is too far from every maximum-distance reference` });
  }

  const usedSlotIndexes = usedLayoutSlotIndexes(centerPlacements, criteria);
  const maxPerTile = Math.max(1, Math.floor(criteria.maxPerTile ?? 1));
  if (usedSlotIndexes.length >= maxPerTile) {
    rejections.push({ code: 'slots-full', message: `${tile.key} has no remaining layout slots` });
  }

  if (rejections.length > 0) {
    return {
      rejected: rejectedLayoutSite(tile, occupied, centerPlacements, footprintTiles, footprintPlacements, rejections),
    };
  }

  const score = scoreTile(plan, tile, centerPlacements, criteria, reasons) + rng() * 0.001;
  return {
    site: {
      tile,
      key: tile.key,
      coordinates: { ...tile.coordinates },
      position: axialToWorld(tile.coordinates, tile.elevation),
      score,
      slotIndex: 0,
      usedSlotIndexes,
      occupied,
      placements: centerPlacements.map(copyPlacement),
      footprintTiles: footprintTiles.map(copyTile),
      footprintKeys: footprintTiles.map((footprintTile) => footprintTile.key),
      footprintPlacements: footprintPlacements.map(copyPlacement),
      reasons,
    },
  };
}

function rejectedLayoutSite(
  tile: GameboardTileSpec,
  occupied: boolean,
  placements: readonly GameboardPlacementSpec[],
  footprintTiles: readonly GameboardTileSpec[],
  footprintPlacements: readonly GameboardPlacementSpec[],
  rejections: readonly GameboardLayoutSiteRejection[]
): GameboardLayoutRejectedSite {
  return {
    tile: copyTile(tile),
    key: tile.key,
    coordinates: { ...tile.coordinates },
    occupied,
    placements: placements.map(copyPlacement),
    footprintKeys: footprintTiles.map((footprintTile) => footprintTile.key),
    footprintPlacements: footprintPlacements.map(copyPlacement),
    rejections: [...rejections],
  };
}

function countLayoutRejections(
  rejected: readonly GameboardLayoutRejectedSite[]
): Partial<Record<GameboardLayoutSiteRejectionCode, number>> {
  const counts: Partial<Record<GameboardLayoutSiteRejectionCode, number>> = {};
  for (const site of rejected) {
    for (const rejection of site.rejections) {
      counts[rejection.code] = (counts[rejection.code] ?? 0) + 1;
    }
  }
  return counts;
}

function scoreTile(
  plan: GameboardPlan,
  tile: GameboardTileSpec,
  placements: readonly GameboardPlacementSpec[],
  criteria: GameboardLayoutCriteria,
  reasons: string[]
): number {
  const preferences = criteria.prefer?.length ? criteria.prefer : DEFAULT_LAYOUT_PREFERENCES;
  let score = 0;
  for (const preference of preferences) {
    const weight = preference.weight ?? 1;
    switch (preference.kind) {
      case 'center':
        score += centerScore(plan, tile.coordinates) * weight;
        reasons.push('center');
        break;
      case 'edge':
        score += (1 - centerScore(plan, tile.coordinates)) * weight;
        reasons.push('edge');
        break;
      case 'near-terrain':
        score += nearestTerrainScore(plan, tile.coordinates, preference.terrain, preference.radius ?? 2) * weight;
        reasons.push(`near-terrain:${terrainList(preference.terrain).join('|')}`);
        break;
      case 'far-from-terrain':
        score += (1 - nearestTerrainScore(plan, tile.coordinates, preference.terrain, preference.radius ?? 2)) * weight;
        reasons.push(`far-from-terrain:${terrainList(preference.terrain).join('|')}`);
        break;
      case 'near-placement-kind':
        score += nearestPlacementKindScore(plan, tile.coordinates, preference.placementKind, preference.radius ?? 3) * weight;
        reasons.push(`near-placement-kind:${placementKindList(preference.placementKind).join('|')}`);
        break;
      case 'far-from-placement-kind':
        score += (1 - nearestPlacementKindScore(plan, tile.coordinates, preference.placementKind, preference.radius ?? 3)) * weight;
        reasons.push(`far-from-placement-kind:${placementKindList(preference.placementKind).join('|')}`);
        break;
      case 'high-elevation':
        score += elevationScore(plan, tile, 'high') * weight;
        reasons.push('high-elevation');
        break;
      case 'low-elevation':
        score += elevationScore(plan, tile, 'low') * weight;
        reasons.push('low-elevation');
        break;
    }
  }
  if (placements.some((placement) => placement.kind === 'terrain' || placement.layer === 'terrain')) {
    score += 0.01;
  }
  return score;
}

function groupPlacementsByTile(placements: readonly GameboardPlacementSpec[]): Map<string, GameboardPlacementSpec[]> {
  const grouped = new Map<string, GameboardPlacementSpec[]>();
  for (const placement of placements) {
    for (const key of placementFootprintKeys(placement)) {
      const list = grouped.get(key) ?? [];
      list.push(placement);
      grouped.set(key, list);
    }
  }
  return grouped;
}

function placementBlocksLayout(
  placement: GameboardPlacementSpec,
  criteria: GameboardLayoutCriteria
): boolean {
  const blockingKinds = criteria.blockingPlacementKinds ?? DEFAULT_BLOCKING_KINDS;
  const blockingLayers = criteria.blockingPlacementLayers ?? [];
  return blockingKinds.includes(placement.kind) || blockingLayers.includes(placement.layer);
}

function resolveFootprintTiles(
  plan: GameboardPlan,
  center: HexCoordinates,
  criteria: GameboardLayoutCriteria
): GameboardTileSpec[] | undefined {
  const footprint = resolveLayoutFootprint(criteria.footprint);
  const requireInBounds = criteria.requireFootprintInBounds ?? criteria.footprint !== undefined;
  const tilesByKey = new Map(plan.tiles.map((tile) => [tile.key, tile]));
  const keys = new Set(footprintCoordinates(center, footprint).map(hexKey));
  const tiles: GameboardTileSpec[] = [];
  for (const key of keys) {
    const tile = tilesByKey.get(key);
    if (!tile) {
      if (requireInBounds) {
        return undefined;
      }
      continue;
    }
    tiles.push(tile);
  }
  return tiles.length > 0 ? tiles : undefined;
}

function resolveLayoutFootprint(input: GameboardLayoutFootprintInput | undefined): ResolvedGameboardLayoutFootprint {
  if (input === undefined || input === 'single') {
    return { kind: 'single', radius: 0, includeCenter: true };
  }
  if (input === 'adjacent') {
    return { kind: 'adjacent', radius: 1, edges: [0, 1, 2, 3, 4, 5], includeCenter: true };
  }
  if (typeof input === 'number') {
    return { kind: 'radius', radius: Math.max(0, Math.floor(input)), includeCenter: true };
  }
  return {
    kind: input.kind,
    radius: Math.max(0, Math.floor(input.radius ?? (input.kind === 'radius' ? 1 : 0))),
    edges: input.edges,
    offsets: input.offsets,
    includeCenter: input.includeCenter ?? true,
  };
}

function footprintCoordinates(center: HexCoordinates, footprint: ResolvedGameboardLayoutFootprint): HexCoordinates[] {
  const coordinates: HexCoordinates[] = [];
  if (footprint.includeCenter) {
    coordinates.push({ ...center });
  }
  switch (footprint.kind) {
    case 'single':
      break;
    case 'adjacent':
      for (const edge of footprint.edges ?? ([0, 1, 2, 3, 4, 5] as const)) {
        coordinates.push(neighbor(center, edge));
      }
      break;
    case 'radius':
      coordinates.push(...hexRange(center, footprint.radius).filter((candidate) => footprint.includeCenter || hexKey(candidate) !== hexKey(center)));
      break;
    case 'custom':
      for (const offset of footprint.offsets ?? []) {
        coordinates.push({ q: center.q + offset.q, r: center.r + offset.r });
      }
      break;
  }
  return coordinates;
}

function matchesFootprintTerrain(
  tiles: readonly GameboardTileSpec[],
  allowed: GameboardTerrain | readonly GameboardTerrain[] | undefined,
  excluded: GameboardTerrain | readonly GameboardTerrain[] | undefined
): boolean {
  return tiles.every((tile) => matchesTerrain(tile.terrain, allowed) && !(excluded && matchesTerrain(tile.terrain, excluded)));
}

function uniquePlacements(placements: readonly GameboardPlacementSpec[]): GameboardPlacementSpec[] {
  const unique = new Map<string, GameboardPlacementSpec>();
  for (const placement of placements) {
    unique.set(placement.id, placement);
  }
  return [...unique.values()];
}

function placementFootprintKeys(placement: GameboardPlacementSpec): string[] {
  const metadataValue = placement.metadata.layoutFootprintTiles;
  if (typeof metadataValue !== 'string' || metadataValue.length === 0) {
    return [placement.tileKey];
  }
  return [...new Set([placement.tileKey, ...metadataValue.split('|').filter(Boolean)])];
}

function usedLayoutSlotIndexes(
  placements: readonly GameboardPlacementSpec[],
  criteria: GameboardLayoutCriteria
): number[] {
  if (!criteria.slotGroup) {
    return [];
  }
  const used = new Set<number>();
  for (const placement of placements) {
    if (!placementMatchesSlotGroup(placement, criteria.slotGroup)) {
      continue;
    }
    const slot = placement.metadata.layoutSlot;
    if (typeof slot === 'number' && Number.isFinite(slot) && slot >= 0) {
      used.add(Math.floor(slot));
    }
  }
  return [...used].sort((left, right) => left - right);
}

function placementMatchesSlotGroup(placement: GameboardPlacementSpec, slotGroup: string): boolean {
  if (placement.metadata.layoutSlotGroup === slotGroup) {
    return true;
  }
  if (placement.metadata.layoutSlotGroup !== undefined && placement.metadata.layoutSlotGroup !== null) {
    return false;
  }
  const archetype = placement.metadata.layoutArchetype;
  if (typeof archetype !== 'string') {
    return false;
  }
  return archetype === slotGroup || (slotGroup === 'soft-feature' && (archetype === 'tree' || archetype === 'scatter'));
}

function matchesTerrain(
  terrain: GameboardTerrain,
  allowed: GameboardTerrain | readonly GameboardTerrain[] | undefined
): boolean {
  return !allowed || terrainList(allowed).includes(terrain);
}

function matchesElevation(elevation: number, criteria: GameboardLayoutCriteria): boolean {
  if (criteria.elevation !== undefined) {
    const allowed = typeof criteria.elevation === 'number' ? [criteria.elevation] : [...criteria.elevation];
    if (!allowed.includes(elevation)) {
      return false;
    }
  }
  if (criteria.minElevation !== undefined && elevation < criteria.minElevation) {
    return false;
  }
  if (criteria.maxElevation !== undefined && elevation > criteria.maxElevation) {
    return false;
  }
  return true;
}

function containsRequiredTags(tags: readonly string[], required: readonly string[] | undefined): boolean {
  return !required || required.every((tag) => tags.includes(tag));
}

function containsExcludedTags(tags: readonly string[], excluded: readonly string[] | undefined): boolean {
  return Boolean(excluded?.some((tag) => tags.includes(tag)));
}

function hasAdjacentTerrain(
  plan: GameboardPlan,
  coordinates: HexCoordinates,
  terrain: GameboardTerrain | readonly GameboardTerrain[] | undefined
): boolean {
  if (!terrain) {
    return false;
  }
  const allowed = terrainList(terrain);
  const tilesByKey = new Map(plan.tiles.map((tile) => [tile.key, tile]));
  for (let edge = 0; edge < 6; edge += 1) {
    const adjacent = tilesByKey.get(hexKey(neighbor(coordinates, edge)));
    if (adjacent && allowed.includes(adjacent.terrain)) {
      return true;
    }
  }
  return false;
}

function hasAdjacentPlacementKind(
  placementsByTile: ReadonlyMap<string, readonly GameboardPlacementSpec[]>,
  coordinates: HexCoordinates,
  placementKind: GameboardPlacementKind | readonly GameboardPlacementKind[] | undefined,
  ignored: ReadonlySet<string>
): boolean {
  if (!placementKind) {
    return false;
  }
  const allowed = placementKindList(placementKind);
  return hasAdjacentPlacement(placementsByTile, coordinates, ignored, (placement) => allowed.includes(placement.kind));
}

function hasAdjacentPlacementLayer(
  placementsByTile: ReadonlyMap<string, readonly GameboardPlacementSpec[]>,
  coordinates: HexCoordinates,
  placementLayer: GameboardPlacementLayer | readonly GameboardPlacementLayer[] | undefined,
  ignored: ReadonlySet<string>
): boolean {
  if (!placementLayer) {
    return false;
  }
  const allowed = placementLayerList(placementLayer);
  return hasAdjacentPlacement(placementsByTile, coordinates, ignored, (placement) => allowed.includes(placement.layer));
}

function hasAdjacentPlacement(
  placementsByTile: ReadonlyMap<string, readonly GameboardPlacementSpec[]>,
  coordinates: HexCoordinates,
  ignored: ReadonlySet<string>,
  predicate: (placement: GameboardPlacementSpec) => boolean
): boolean {
  for (let edge = 0; edge < 6; edge += 1) {
    const adjacentPlacements = placementsByTile.get(hexKey(neighbor(coordinates, edge))) ?? [];
    if (adjacentPlacements.some((placement) => !ignored.has(placement.id) && predicate(placement))) {
      return true;
    }
  }
  return false;
}

function matchesDistanceRule(
  coordinates: HexCoordinates,
  references: readonly (HexCoordinates | string)[] | undefined,
  distance: number | undefined,
  mode: 'min' | 'max'
): boolean {
  if (!references || distance === undefined) {
    return true;
  }
  const normalized = references.map(coordinatesFor);
  if (mode === 'min') {
    return normalized.every((reference) => hexDistance(coordinates, reference) >= distance);
  }
  return normalized.some((reference) => hexDistance(coordinates, reference) <= distance);
}

function outsideEdgePadding(shape: GameboardPlan['shape'], coordinates: HexCoordinates, padding: number): boolean {
  if (padding <= 0) {
    return true;
  }
  if (shape.kind === 'rectangle') {
    return (
      coordinates.q >= padding &&
      coordinates.r >= padding &&
      coordinates.q < shape.width - padding &&
      coordinates.r < shape.height - padding
    );
  }
  return containsHex({ kind: 'hexagon', radius: Math.max(0, shape.radius - padding) }, coordinates);
}

function centerScore(plan: GameboardPlan, coordinates: HexCoordinates): number {
  const center =
    plan.shape.kind === 'rectangle'
      ? { q: (plan.shape.width - 1) / 2, r: (plan.shape.height - 1) / 2 }
      : { q: 0, r: 0 };
  const maxDistance = Math.max(1, Math.max(...plan.tiles.map((tile) => hexDistance(tile.coordinates, center))));
  return 1 - Math.min(1, hexDistance(coordinates, center) / maxDistance);
}

function nearestTerrainScore(
  plan: GameboardPlan,
  coordinates: HexCoordinates,
  terrain: GameboardTerrain | readonly GameboardTerrain[],
  radius: number
): number {
  const allowed = terrainList(terrain);
  const distances = plan.tiles
    .filter((tile) => allowed.includes(tile.terrain))
    .map((tile) => hexDistance(tile.coordinates, coordinates));
  return proximityScore(distances, radius);
}

function nearestPlacementKindScore(
  plan: GameboardPlan,
  coordinates: HexCoordinates,
  placementKind: GameboardPlacementKind | readonly GameboardPlacementKind[],
  radius: number
): number {
  const allowed = placementKindList(placementKind);
  const distances = plan.placements
    .filter((placement) => allowed.includes(placement.kind))
    .map((placement) => hexDistance(placement.coordinates, coordinates));
  return proximityScore(distances, radius);
}

function proximityScore(distances: readonly number[], radius: number): number {
  if (distances.length === 0) {
    return 0;
  }
  const nearest = Math.min(...distances);
  return 1 - Math.min(1, nearest / Math.max(1, radius));
}

function elevationScore(plan: GameboardPlan, tile: GameboardTileSpec, mode: 'high' | 'low'): number {
  const elevations = plan.tiles.map((candidate) => candidate.elevation);
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  if (max === min) {
    return 1;
  }
  const normalized = (tile.elevation - min) / (max - min);
  return mode === 'high' ? normalized : 1 - normalized;
}

function terrainList(value: GameboardTerrain | readonly GameboardTerrain[]): GameboardTerrain[] {
  return typeof value === 'string' ? [value] : [...value];
}

function placementKindList(
  value: GameboardPlacementKind | readonly GameboardPlacementKind[]
): GameboardPlacementKind[] {
  return typeof value === 'string' ? [value] : [...value];
}

function placementLayerList(
  value: GameboardPlacementLayer | readonly GameboardPlacementLayer[]
): GameboardPlacementLayer[] {
  return typeof value === 'string' ? [value] : [...value];
}

function inferredHarborFacing(
  plan: GameboardPlan,
  coordinates: HexCoordinates,
  metadata: Readonly<Record<string, string | number | boolean | null>>,
  rotation: number | 'random' | undefined
): HexEdgeIndex | undefined {
  if (metadata.feature !== 'harbor') {
    return undefined;
  }
  if (typeof metadata.facing === 'number' && Number.isFinite(metadata.facing)) {
    return normalizeLayoutEdge(metadata.facing);
  }
  if (typeof rotation === 'number' && Number.isFinite(rotation)) {
    return normalizeLayoutEdge(rotation);
  }
  return firstAdjacentTerrainEdge(plan, coordinates, 'water');
}

function firstAdjacentTerrainEdge(
  plan: GameboardPlan,
  coordinates: HexCoordinates,
  terrain: GameboardTerrain
): HexEdgeIndex | undefined {
  const tilesByKey = new Map(plan.tiles.map((tile) => [tile.key, tile]));
  for (let edge = 0; edge < 6; edge += 1) {
    const adjacent = tilesByKey.get(hexKey(neighbor(coordinates, edge)));
    if (adjacent?.terrain === terrain) {
      return edge as HexEdgeIndex;
    }
  }
  return undefined;
}

function normalizeLayoutEdge(edge: number): HexEdgeIndex {
  return (((Math.floor(edge) % 6) + 6) % 6) as HexEdgeIndex;
}

function mergeLayoutCriteria(
  base: GameboardLayoutCriteria | undefined,
  override: GameboardLayoutCriteria | undefined
): GameboardLayoutCriteria | undefined {
  if (!base) {
    return override;
  }
  if (!override) {
    return base;
  }
  return {
    ...base,
    ...override,
    prefer: override.prefer ?? base.prefer,
    tileTags: override.tileTags ?? base.tileTags,
    excludeTileTags: override.excludeTileTags ?? base.excludeTileTags,
    ignorePlacementIds: override.ignorePlacementIds ?? base.ignorePlacementIds,
    minDistanceFrom: override.minDistanceFrom ?? base.minDistanceFrom,
    maxDistanceFrom: override.maxDistanceFrom ?? base.maxDistanceFrom,
    blockingPlacementKinds: override.blockingPlacementKinds ?? base.blockingPlacementKinds,
    blockingPlacementLayers: override.blockingPlacementLayers ?? base.blockingPlacementLayers,
    requiredAdjacentPlacementKind: override.requiredAdjacentPlacementKind ?? base.requiredAdjacentPlacementKind,
    forbiddenAdjacentPlacementKind: override.forbiddenAdjacentPlacementKind ?? base.forbiddenAdjacentPlacementKind,
    requiredAdjacentPlacementLayer: override.requiredAdjacentPlacementLayer ?? base.requiredAdjacentPlacementLayer,
    forbiddenAdjacentPlacementLayer: override.forbiddenAdjacentPlacementLayer ?? base.forbiddenAdjacentPlacementLayer,
    slotGroup: override.slotGroup ?? base.slotGroup,
  };
}

function layoutFillCount(rule: GameboardLayoutFillRule, candidateCount: number): number {
  const requested = layoutFillRequestedCount(rule, candidateCount);
  const minCount = rule.minCount ?? 0;
  const maxCount = rule.maxCount ?? Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(candidateCount, Math.max(minCount, Math.min(maxCount, requested))));
}

function layoutFillRequestedCount(rule: GameboardLayoutFillRule, candidateCount: number): number {
  return rule.count ?? Math.round(candidateCount * Math.max(0, Math.min(1, rule.fill ?? 0)));
}

function layoutFillDiagnostics(
  rule: GameboardLayoutFillRule,
  ruleIndex: number,
  candidateCount: number,
  requestedCount: number,
  targetCount: number
): { warnings: string[]; errors: string[] } {
  const label = rule.id ?? ruleIndex;
  const warnings: string[] = [];
  const errors: string[] = [];
  if (!rule.assetId && !rule.assets?.length) {
    errors.push(`Layout fill rule ${label} requires assetId or assets`);
  }
  if (candidateCount === 0 && requestedCount > 0) {
    warnings.push(`Layout fill rule ${label} matched no candidate sites`);
  }
  if (requestedCount > candidateCount) {
    warnings.push(
      `Layout fill rule ${label} requested ${requestedCount} placement(s), but only ${candidateCount} candidate site(s) are available`
    );
  }
  if ((rule.minCount ?? 0) > candidateCount) {
    warnings.push(
      `Layout fill rule ${label} minCount ${rule.minCount} cannot be satisfied by ${candidateCount} candidate site(s)`
    );
  }
  if (rule.maxCount !== undefined && requestedCount > rule.maxCount) {
    warnings.push(`Layout fill rule ${label} requested ${requestedCount} placement(s) and was capped by maxCount ${rule.maxCount}`);
  }
  if (targetCount === 0 && requestedCount > 0 && candidateCount > 0) {
    warnings.push(`Layout fill rule ${label} resolved to zero placements after count constraints`);
  }
  return { warnings, errors };
}

function firstAssetForRule(rule: GameboardLayoutFillRule, seed: string): string {
  return assetForRule(rule, 0, seed);
}

function assetForRule(rule: GameboardLayoutFillRule, index: number, seed: string): string {
  if (rule.assets?.length) {
    const rng = seedrandom(`${seed}:${index}`);
    return rule.assets[Math.floor(rng() * rule.assets.length)];
  }
  if (!rule.assetId) {
    throw new Error(`Layout fill rule ${rule.id ?? '<unnamed>'} requires assetId or assets`);
  }
  return rule.assetId;
}

function configuredAssetIds(rule: GameboardLayoutFillRule): string[] {
  if (rule.assets?.length) {
    return [...rule.assets];
  }
  return rule.assetId ? [rule.assetId] : [];
}

export function appendGameboardLayoutPlacementsToPlan(
  plan: GameboardPlan,
  placements: readonly SpawnGameboardPlacementOptions[]
): GameboardPlan {
  const tilesByKey = new Map(plan.tiles.map((tile) => [tile.key, tile]));
  const startOrder = plan.placements.reduce((max, placement) => Math.max(max, placement.order), 299_999);
  const nextPlacements = placements.map((placement, index) => placementOptionToSpec(tilesByKey, placement, startOrder + index + 1));
  return {
    ...plan,
    tiles: plan.tiles.map(copyTile),
    placements: [...plan.placements.map(copyPlacement), ...nextPlacements],
    warnings: [...plan.warnings],
  };
}

function placementOptionToSpec(
  tilesByKey: ReadonlyMap<string, GameboardTileSpec>,
  placement: SpawnGameboardPlacementOptions,
  order: number
): GameboardPlacementSpec {
  const key = typeof placement.at === 'string' ? placement.at : hexKey(placement.at);
  const tile = tilesByKey.get(key);
  if (!tile) {
    throw new Error(`Layout placement references missing tile ${key}`);
  }
  const rotationSteps = ((Math.floor(placement.rotationSteps ?? 0) % 6) + 6) % 6;
  const elevationOffset = placement.elevationOffset ?? 0;
  return {
    id: placement.id ?? `layout:${placement.kind}:${key}:${placement.assetId}:${order}`,
    tileKey: tile.key,
    coordinates: { ...tile.coordinates },
    position: offsetWorldPosition(axialToWorld(tile.coordinates, tile.elevation + elevationOffset), placement.positionOffset),
    assetId: placement.assetId,
    kind: placement.kind,
    layer: placement.layer ?? defaultLayerForPlacementKind(placement.kind),
    textureSet: placement.textureSet ?? tile.textureSet,
    elevation: tile.elevation,
    elevationOffset,
    rotationSteps,
    rotationRadians: rotationSteps * (Math.PI / 3),
    scale: placement.scale ?? 1,
    order: placement.order ?? order,
    stackIndex: placement.stackIndex,
    requiresExtra: placement.requiresExtra ?? false,
    metadata: { ...(placement.metadata ?? {}) },
  };
}

function layoutSlotPositionOffset(
  slotIndex: number,
  maxPerTile: number
): GameboardPlacementPositionOffset | undefined {
  if (maxPerTile <= 1) {
    return undefined;
  }
  const radius = Math.min(KAYKIT_HEX_WIDTH, KAYKIT_HEX_DEPTH) * 0.16;
  const angles = maxPerTile === 2
    ? [Math.PI * 1.15, Math.PI * 0.15]
    : [Math.PI * 1.5, Math.PI / 6, Math.PI * 5 / 6, Math.PI * 0.5, Math.PI * 7 / 6, Math.PI * 11 / 6];
  const angle = angles[slotIndex % angles.length];
  const ring = Math.floor(slotIndex / angles.length);
  const distance = radius + ring * radius * 0.45;
  return {
    x: round(Math.cos(angle) * distance),
    y: 0,
    z: round(Math.sin(angle) * distance),
  };
}

function offsetWorldPosition(
  position: ReturnType<typeof axialToWorld>,
  offset: GameboardPlacementPositionOffset | undefined
): ReturnType<typeof axialToWorld> {
  return {
    x: position.x + (offset?.x ?? 0),
    y: position.y + (offset?.y ?? 0),
    z: position.z + (offset?.z ?? 0),
  };
}

function defaultLayerForPlacementKind(kind: GameboardPlacementKind): GameboardPlacementLayer {
  switch (kind) {
    case 'terrain':
      return 'terrain';
    case 'road':
    case 'river':
    case 'coast':
    case 'transition':
      return 'surface';
    case 'structure':
      return 'structure';
    case 'unit':
      return 'unit';
    case 'decoration':
    case 'prop':
      return 'feature';
  }
}

function copyPlan(plan: GameboardPlan): GameboardPlan {
  return {
    ...plan,
    shape: { ...plan.shape },
    tiles: plan.tiles.map(copyTile),
    placements: plan.placements.map(copyPlacement),
    warnings: [...plan.warnings],
  };
}

function copyTile(tile: GameboardTileSpec): GameboardTileSpec {
  return {
    ...tile,
    coordinates: { ...tile.coordinates },
    tags: [...tile.tags],
  };
}

function coordinatesFor(value: HexCoordinates | string): HexCoordinates {
  return typeof value === 'string' ? parseHexKey(value) : value;
}

function projectWorldForLayout(world: World): GameboardPlan {
  const board = world.get(GameboardState);
  if (!board) {
    throw new Error('World does not contain GameboardState');
  }
  return {
    schemaVersion: board.schemaVersion as GameboardPlan['schemaVersion'],
    seed: board.seed,
    shape: { ...board.shape },
    textureSet: board.textureSet,
    tiles: readGameboardTiles(world),
    placements: readGameboardPlacements(world),
    warnings: [],
  };
}

function copyPlacement(placement: PlacementStateValue | GameboardPlacementSpec): GameboardPlacementSpec {
  return {
    ...placement,
    coordinates: { ...placement.coordinates },
    position: { ...placement.position },
    metadata: { ...placement.metadata },
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
