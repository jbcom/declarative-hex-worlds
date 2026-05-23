import seedrandom from 'seedrandom';
import { coloredUnitAssetId, factionBuildingAssetId } from './catalog';
import {
  containsHex,
  coordinatesForShape,
  edgeBetween,
  hexDistance,
  hexKey,
  neighbor,
} from './coordinates';
import {
  createGameboardBuilder,
  type GameboardPlan,
  type GameboardPlanOptions,
  type GameboardShape,
  type HarborKind,
  type SettlementBuilding,
} from './gameboard';
import { createGameboardWorld } from './koota';
import {
  analyzeGameboardLayoutFill,
  createGameboardLayoutArchetypeRegistry,
  createGameboardLayoutFillPlacements,
  spawnGameboardLayoutFill,
  type GameboardLayoutArchetypeRegistry,
  type GameboardLayoutFillAnalysis,
  type GameboardLayoutFillRule,
} from './layout';
import {
  createGameboardLayoutFillRuleFromPieces,
  createGameboardLayoutFillRulesFromRegistry,
  selectGameboardPieces,
  type GameboardPieceLayoutRuleOptions,
  type GameboardPieceDeclaration,
  type GameboardPieceRegistry,
  type GameboardPieceRegistrySelection,
} from './pieces';
import type { SpawnGameboardPlacementOptions } from './koota';
import { projectWorldToGameboardPlan } from './projection';
import type { Faction, HexCoordinates, HexEdgeIndex } from './types';
import type { World } from 'koota';

export { projectWorldToGameboardPlan, readDecomposedTileSpecs } from './projection';
export type { GameboardRuleConfig, GameboardRuleViolation, RuleSeverity } from './rule-types';
export {
  canPlaceHarborAt,
  canStackAt,
  setTileElevation,
  setTileTerrain,
  validateGameboardRules,
} from './world-rules';

export type SeededGameboardDensityPresetId = 'trees' | 'rocks' | 'props' | 'harbors' | 'landmarks' | 'units';

export type SeededGameboardDensityValue = number | SeededGameboardDensityRuleOptions | false | null | undefined;

export interface SeededGameboardDensityRuleOptions
  extends Omit<GameboardLayoutFillRule, 'archetype' | 'assetId' | 'assets' | 'count' | 'fill' | 'id'> {
  id?: string;
  assetId?: string;
  assets?: readonly string[];
  count?: number;
  fill?: number;
  archetype?: GameboardLayoutFillRule['archetype'];
}

export interface SeededGameboardLayoutDensityOptions {
  trees?: SeededGameboardDensityValue;
  rocks?: SeededGameboardDensityValue;
  props?: SeededGameboardDensityValue;
  harbors?: SeededGameboardDensityValue;
  landmarks?: SeededGameboardDensityValue;
  units?: SeededGameboardDensityValue;
}

export interface SeededGameboardDensityContext {
  faction?: Faction;
}

export type SeededGameboardPieceFillMode = 'per-piece' | 'pool';

export interface SeededGameboardPieceFillOptions extends Omit<GameboardPieceLayoutRuleOptions, 'assetId'> {
  selection?: GameboardPieceRegistrySelection;
  mode?: SeededGameboardPieceFillMode;
  ruleIdPrefix?: string;
}

export interface SeededGameboardPieceFillSelectionInspection {
  id: string;
  mode: SeededGameboardPieceFillMode;
  selection: GameboardPieceRegistrySelection;
  selectedCount: number;
  selectedPieceIds: readonly string[];
  selectedAssetIds: readonly string[];
  warnings: readonly string[];
  errors: readonly string[];
}

export interface InspectSeededGameboardPieceFillsOptions {
  seed?: string | number;
}

export interface SeededGameboardPieceFillInspection {
  seed: string;
  selectionCount: number;
  selectedPieceCount: number;
  rules: readonly GameboardLayoutFillRule[];
  analysis: GameboardLayoutFillAnalysis;
  placements: readonly SpawnGameboardPlacementOptions[];
  selections: readonly SeededGameboardPieceFillSelectionInspection[];
  warnings: readonly string[];
  errors: readonly string[];
}

export interface SeededGameboardOptions extends Partial<GameboardPlanOptions> {
  shape?: GameboardShape;
  faction?: Faction;
  harborKind?: HarborKind;
  mountainStacks?: number;
  forestTiles?: number;
  hillTiles?: number;
  settlements?: number;
  scatterProps?: number;
  layoutDensity?: SeededGameboardLayoutDensityOptions;
  layoutArchetypes?: GameboardLayoutArchetypeRegistry;
  layoutFillSeed?: string | number;
  layoutFills?: readonly GameboardLayoutFillRule[];
  pieceRegistry?: GameboardPieceRegistry;
  pieceFills?: readonly SeededGameboardPieceFillOptions[];
}

const SETTLEMENT_SEQUENCE = [
  'townhall',
  'market',
  'home_A',
  'home_B',
  'blacksmith',
  'barracks',
] as const satisfies readonly SettlementBuilding[];

const DEFAULT_DENSITY_FACTION = 'blue' as const satisfies Faction;
const EDGE_INDEXES = [0, 1, 2, 3, 4, 5] as const satisfies readonly HexEdgeIndex[];

export function createSeededGameboardPlan(options: SeededGameboardOptions = {}): GameboardPlan {
  const shape = options.shape ?? { kind: 'rectangle', width: 10, height: 8 };
  const shapeCoordinates = coordinatesForShape(shape);
  const minR = Math.min(...shapeCoordinates.map((coordinates) => coordinates.r));
  const maxR = Math.max(...shapeCoordinates.map((coordinates) => coordinates.r));
  const seed = String(options.seed ?? 'seeded-medieval-gameboard');
  const rng = seedrandom(seed);
  const faction = options.faction ?? pick(['blue', 'green', 'red', 'yellow'] as const, rng);
  const builder = createGameboardBuilder({
    seed,
    shape,
    textureSet: options.textureSet ?? 'default',
    defaultTerrain: options.defaultTerrain ?? 'grass',
  });

  const waterTiles = shapeCoordinates.filter((coordinates) => coordinates.r === maxR);
  const waterKeys = new Set(waterTiles.map(hexKey));
  for (const coordinates of waterTiles) {
    builder.setTerrain(coordinates, 'water');
  }

  const coastTiles = shapeCoordinates
    .filter((coordinates) => !waterKeys.has(hexKey(coordinates)))
    .map((coordinates) => ({
      coordinates,
      waterEdges: waterEdgesFor(coordinates, waterKeys),
    }))
    .filter((candidate) => candidate.waterEdges.length > 0)
    .sort((left, right) => left.coordinates.q - right.coordinates.q || left.coordinates.r - right.coordinates.r);
  for (const coast of coastTiles) {
    builder.setCoastEdges(coast.coordinates, coast.waterEdges);
  }
  const coastKeys = new Set(coastTiles.map((coast) => hexKey(coast.coordinates)));

  const harborCandidates = coastTiles.length
    ? coastTiles
    : shapeCoordinates
        .filter((coordinates) => !waterKeys.has(hexKey(coordinates)))
        .map((coordinates) => ({ coordinates, waterEdges: [1 as const] }));
  const harborCandidate = harborCandidates[Math.floor(harborCandidates.length * between(0.35, 0.7, rng))] ?? harborCandidates[0];
  const harbor = harborCandidate?.coordinates ?? shapeCoordinates[0];
  const harborFacing = harborCandidate?.waterEdges[0] ?? 1;
  builder.addHarbor({
    at: harbor,
    facing: harborFacing,
    faction,
    kind: options.harborKind ?? 'docks',
    includeProps: true,
  });

  const reserved = new Set<string>([
    hexKey(harbor),
    ...EDGE_INDEXES.map((edge) => neighbor(harbor, edge))
      .filter((coordinates) => waterKeys.has(hexKey(coordinates)))
      .map(hexKey),
  ]);
  const landCandidates = () =>
    shapeCoordinates.filter(
      (coordinates) =>
        !waterKeys.has(hexKey(coordinates)) &&
        !coastKeys.has(hexKey(coordinates)) &&
        !reserved.has(hexKey(coordinates))
    );

  const widthHint = shape.kind === 'rectangle' ? shape.width : shape.radius * 2 + 1;
  const topBand = minR + Math.max(1, Math.floor((maxR - minR) * 0.45));
  const mountainCount = options.mountainStacks ?? Math.max(2, Math.floor(widthHint / 4));
  for (const coordinates of takeRandom(landCandidates().filter((item) => item.r <= topBand), mountainCount, rng)) {
    reserved.add(hexKey(coordinates));
    builder.addMountainStack({
      at: coordinates,
      height: 1 + Math.floor(rng() * 3),
      variant: pick(['A', 'B', 'C'] as const, rng),
      withGrass: true,
      withTrees: rng() > 0.45,
      rotationSteps: Math.floor(rng() * 6),
    });
  }

  for (const coordinates of takeRandom(landCandidates(), options.hillTiles ?? 3, rng)) {
    reserved.add(hexKey(coordinates));
    builder.addHill(coordinates, {
      variant: pick(['A', 'B', 'C'] as const, rng),
      withTrees: rng() > 0.4,
      rotationSteps: Math.floor(rng() * 6),
    });
  }

  for (const coordinates of takeRandom(landCandidates(), options.forestTiles ?? 6, rng)) {
    reserved.add(hexKey(coordinates));
    builder.addForest(coordinates, {
      species: pick(['A', 'B'] as const, rng),
      size: pick(['small', 'medium', 'large'] as const, rng),
    });
  }

  const settlementCount = options.settlements ?? 4;
  const settlementTiles = takeRandom(
    landCandidates().filter((coordinates) => coordinates.r > minR),
    settlementCount,
    rng
  );
  settlementTiles.forEach((coordinates, index) => {
    reserved.add(hexKey(coordinates));
    builder.addSettlement({
      at: coordinates,
      faction,
      building: SETTLEMENT_SEQUENCE[index % SETTLEMENT_SEQUENCE.length],
      rotationSteps: Math.floor(rng() * 6),
    });
  });

  for (const settlement of settlementTiles) {
    const path = axialLine(settlement, harbor).filter((coordinates) => containsHex(shape, coordinates));
    if (path.length > 1) {
      builder.addRoadPath(path);
    }
  }

  const riverStart = takeRandom(landCandidates().filter((coordinates) => coordinates.r <= topBand), 1, rng)[0];
  const riverEnd = [...landCandidates()].sort((left, right) => hexDistance(left, harbor) - hexDistance(right, harbor))[0];
  if (riverStart && riverEnd) {
    const riverPath = meanderPath(riverStart, riverEnd, shape, rng);
    if (riverPath.length > 1) {
      builder.addRiverPath(riverPath, { curvy: true });
    }
  }

  builder.scatterDecorations({
    count: options.scatterProps ?? Math.max(6, Math.floor(shapeCoordinates.length / 10)),
    terrain: ['grass', 'hill', 'forest'],
    assets: ['rock_single_A', 'rock_single_B', 'crate_A_small', 'crate_B_small', 'tree_single_A', 'tree_single_B'],
  });

  const layoutArchetypes = options.layoutArchetypes
    ? createGameboardLayoutArchetypeRegistry(options.layoutArchetypes)
    : undefined;
  const densityRules = createSeededGameboardDensityFillRules(options.layoutDensity, { faction });
  const pieceRules = createSeededGameboardPieceFillRules(options.pieceRegistry, options.pieceFills);
  const layoutRules = [...densityRules, ...pieceRules, ...(options.layoutFills ?? [])].map((rule) =>
    withLayoutArchetypes(rule, layoutArchetypes)
  );
  let plan = builder.build();
  if (layoutRules.length) {
    const world = createGameboardWorld(plan);
    spawnGameboardLayoutFill(world, {
      seed: options.layoutFillSeed ?? `${seed}:layout-fill`,
      rules: layoutRules,
    });
    plan = projectWorldToGameboardPlan(world);
  }

  return plan;
}

export function createSeededGameboardWorld(options: SeededGameboardOptions = {}): World {
  return createGameboardWorld(createSeededGameboardPlan(options));
}

export function createSeededGameboardDensityFillRules(
  density: SeededGameboardLayoutDensityOptions | undefined,
  context: SeededGameboardDensityContext = {}
): GameboardLayoutFillRule[] {
  if (!density) {
    return [];
  }
  const faction = context.faction ?? DEFAULT_DENSITY_FACTION;
  return [
    densityRule('harbors', density.harbors, {
      id: 'density:harbors',
      archetype: 'harbor',
      assets: [factionBuildingAssetId('docks', faction), factionBuildingAssetId('shipyard', faction)],
      requiresExtra: true,
      criteria: {
        terrain: 'coast',
        requiredAdjacentTerrain: 'water',
        forbiddenAdjacentPlacementKind: 'structure',
        prefer: [
          { kind: 'near-terrain', terrain: 'water', radius: 1, weight: 1 },
          { kind: 'far-from-placement-kind', placementKind: 'structure', radius: 3, weight: 0.35 },
        ],
      },
    }),
    densityRule('landmarks', density.landmarks, {
      id: 'density:landmarks',
      archetype: 'landmark',
      assets: [factionBuildingAssetId('tower_A', faction), factionBuildingAssetId('tower_B', faction)],
      criteria: {
        terrain: ['grass', 'road', 'coast', 'hill'],
        edgePadding: 1,
        prefer: [
          { kind: 'center', weight: 0.5 },
          { kind: 'high-elevation', weight: 0.5 },
        ],
      },
    }),
    densityRule('units', density.units, {
      id: 'density:units',
      archetype: 'unit',
      assetId: coloredUnitAssetId('unit', faction, 'full'),
      requiresExtra: true,
      metadata: { densityPreset: 'units' },
    }),
    densityRule('trees', density.trees, {
      id: 'density:trees',
      archetype: 'tree',
      assets: ['tree_single_A', 'tree_single_B'],
    }),
    densityRule('rocks', density.rocks, {
      id: 'density:rocks',
      archetype: 'scatter',
      assets: ['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E'],
      criteria: {
        terrain: ['grass', 'hill', 'forest'],
        prefer: [
          { kind: 'far-from-placement-kind', placementKind: 'structure', radius: 3, weight: 0.5 },
          { kind: 'center', weight: 0.2 },
        ],
      },
    }),
    densityRule('props', density.props, {
      id: 'density:props',
      archetype: 'scatter',
      assets: ['barrel', 'crate_A_small', 'crate_B_small', 'pallet', 'resource_lumber', 'resource_stone', 'sack'],
      criteria: {
        terrain: ['grass', 'road', 'coast'],
        prefer: [{ kind: 'near-placement-kind', placementKind: 'structure', radius: 4, weight: 1 }],
      },
    }),
  ].filter((rule): rule is GameboardLayoutFillRule => rule !== undefined);
}

export function createSeededGameboardPieceFillRules(
  registry: GameboardPieceRegistry | undefined,
  fills: readonly SeededGameboardPieceFillOptions[] | undefined
): GameboardLayoutFillRule[] {
  if (!fills?.length) {
    return [];
  }
  if (!registry) {
    throw new Error('createSeededGameboardPieceFillRules requires a piece registry when piece fills are provided');
  }
  return fills.flatMap((fill, index) => {
    const {
      mode = 'per-piece',
      selection,
      ruleIdPrefix = 'piece',
      id,
      ...ruleOptions
    } = fill;
    if (mode === 'pool') {
      const pieces = selectGameboardPieces(registry, selection);
      if (pieces.length === 0) {
        return [];
      }
      assertPiecePoolCompatible(pieces, id ?? `${ruleIdPrefix}:pool:${index}`);
      return [
        createGameboardLayoutFillRuleFromPieces(pieces, {
          ...ruleOptions,
          id: id ?? `${ruleIdPrefix}:pool:${index}`,
          idPrefix: ruleOptions.idPrefix ?? `layout:${id ?? `${ruleIdPrefix}:pool:${index}`}`,
        }),
      ];
    }
    return createGameboardLayoutFillRulesFromRegistry(registry, {
      ...ruleOptions,
      selection,
      ruleIdPrefix,
    });
  });
}

export function inspectSeededGameboardPieceFills(
  plan: GameboardPlan,
  registry: GameboardPieceRegistry,
  fills: readonly SeededGameboardPieceFillOptions[],
  options: InspectSeededGameboardPieceFillsOptions = {}
): SeededGameboardPieceFillInspection {
  const seed = String(options.seed ?? `${plan.seed}:piece-fill-inspection`);
  const selections = inspectSeededGameboardPieceFillSelections(registry, fills);
  const rules = createInspectableSeededGameboardPieceFillRules(registry, fills, selections);
  const analysis = analyzeGameboardLayoutFill(plan, { seed, rules });
  const placements = createGameboardLayoutFillPlacements(plan, { seed, rules });
  return {
    seed,
    selectionCount: selections.length,
    selectedPieceCount: new Set(selections.flatMap((selection) => selection.selectedPieceIds)).size,
    rules,
    analysis,
    placements,
    selections,
    warnings: selections.flatMap((selection) => selection.warnings),
    errors: selections.flatMap((selection) => selection.errors),
  };
}

export function inspectSeededGameboardPieceFillSelections(
  registry: GameboardPieceRegistry,
  fills: readonly SeededGameboardPieceFillOptions[]
): SeededGameboardPieceFillSelectionInspection[] {
  return fills.map((fill, index) => {
    const mode = fill.mode ?? 'per-piece';
    const id = fill.id ?? fill.ruleIdPrefix ?? `piece-fill:${index}`;
    const selection = fill.selection ?? {};
    const pieces = selectGameboardPieces(registry, selection);
    const warnings: string[] = [];
    const errors: string[] = [];
    if (pieces.length === 0) {
      warnings.push(`Piece fill ${id} matched no pieces`);
    }
    if (mode === 'pool' && !isPiecePoolCompatible(pieces)) {
      errors.push(`Piece fill ${id} cannot pool pieces with different archetype, kind, or layer`);
    }
    return {
      id,
      mode,
      selection,
      selectedCount: pieces.length,
      selectedPieceIds: pieces.map((piece) => piece.id),
      selectedAssetIds: pieces.map((piece) => piece.assetId),
      warnings,
      errors,
    };
  });
}

function densityRule(
  preset: SeededGameboardDensityPresetId,
  value: SeededGameboardDensityValue,
  base: GameboardLayoutFillRule
): GameboardLayoutFillRule | undefined {
  if (value === undefined || value === null || value === false) {
    return undefined;
  }
  const override: SeededGameboardDensityRuleOptions = typeof value === 'number' ? { fill: value } : value;
  const rule: GameboardLayoutFillRule = {
    ...base,
    ...override,
    id: override.id ?? base.id,
    archetype: override.archetype ?? base.archetype,
    metadata: {
      densityPreset: preset,
      ...(base.metadata ?? {}),
      ...(override.metadata ?? {}),
    },
  };
  if (override.assetId && !override.assets) {
    delete rule.assets;
  }
  if (override.assets && !override.assetId) {
    delete rule.assetId;
  }
  return rule;
}

function withLayoutArchetypes(
  rule: GameboardLayoutFillRule,
  archetypes: GameboardLayoutArchetypeRegistry | undefined
): GameboardLayoutFillRule {
  if (!archetypes) {
    return rule;
  }
  return {
    ...rule,
    archetypes: rule.archetypes ? { ...archetypes, ...rule.archetypes } : archetypes,
  };
}

function assertPiecePoolCompatible(
  pieces: readonly GameboardPieceDeclaration[],
  id: string
): void {
  if (!isPiecePoolCompatible(pieces)) {
    throw new Error(`Piece fill pool ${id} can only pool pieces with the same archetype, kind, and layer`);
  }
}

function isPiecePoolCompatible(pieces: readonly GameboardPieceDeclaration[]): boolean {
  const [first] = pieces;
  if (!first) {
    return true;
  }
  const signature = piecePoolSignature(first);
  return pieces.every((piece) => piecePoolSignature(piece) === signature);
}

function createInspectableSeededGameboardPieceFillRules(
  registry: GameboardPieceRegistry,
  fills: readonly SeededGameboardPieceFillOptions[],
  inspections: readonly SeededGameboardPieceFillSelectionInspection[]
): GameboardLayoutFillRule[] {
  return fills.flatMap((fill, index) => {
    const inspection = inspections[index];
    if (!inspection || inspection.errors.length > 0) {
      return [];
    }
    const {
      mode = 'per-piece',
      selection,
      ruleIdPrefix = 'piece',
      id,
      ...ruleOptions
    } = fill;
    if (mode === 'pool') {
      const pieces = selectGameboardPieces(registry, selection);
      if (pieces.length === 0) {
        return [];
      }
      return [
        createGameboardLayoutFillRuleFromPieces(pieces, {
          ...ruleOptions,
          id: id ?? `${ruleIdPrefix}:pool:${index}`,
          idPrefix: ruleOptions.idPrefix ?? `layout:${id ?? `${ruleIdPrefix}:pool:${index}`}`,
        }),
      ];
    }
    return createGameboardLayoutFillRulesFromRegistry(registry, {
      ...ruleOptions,
      selection,
      ruleIdPrefix,
    });
  });
}

function piecePoolSignature(piece: GameboardPieceDeclaration): string {
  const archetype = typeof piece.archetype === 'string' ? piece.archetype : piece.archetype.id;
  return `${archetype}:${piece.kind ?? ''}:${piece.layer ?? ''}`;
}

function waterEdgesFor(coordinates: HexCoordinates, waterKeys: ReadonlySet<string>): HexEdgeIndex[] {
  return EDGE_INDEXES.filter((edge) => waterKeys.has(hexKey(neighbor(coordinates, edge))));
}

function takeRandom<T>(items: readonly T[], count: number, rng: seedrandom.PRNG): T[] {
  const pool = [...items];
  const selected: T[] = [];
  for (let index = 0; index < count && pool.length > 0; index += 1) {
    const itemIndex = Math.floor(rng() * pool.length);
    const [item] = pool.splice(itemIndex, 1);
    selected.push(item);
  }
  return selected;
}

function pick<T>(items: readonly T[], rng: seedrandom.PRNG): T {
  return items[Math.floor(rng() * items.length)];
}

function between(min: number, max: number, rng: seedrandom.PRNG): number {
  return min + (max - min) * rng();
}

function axialLine(start: HexCoordinates, end: HexCoordinates): HexCoordinates[] {
  const path: HexCoordinates[] = [{ ...start }];
  let current = { ...start };
  let guard = 0;
  while ((current.q !== end.q || current.r !== end.r) && guard < 100) {
    const candidates = [0, 1, 2, 3, 4, 5]
      .map((edge) => neighbor(current, edge))
      .sort((left, right) => hexDistance(left, end) - hexDistance(right, end));
    current = candidates[0];
    path.push(current);
    guard += 1;
  }
  return path;
}

function meanderPath(
  start: HexCoordinates,
  end: HexCoordinates,
  shape: GameboardShape,
  rng: seedrandom.PRNG
): HexCoordinates[] {
  const path = [start];
  let current = start;
  const seen = new Set([hexKey(start)]);
  let guard = 0;
  while ((current.q !== end.q || current.r !== end.r) && guard < coordinatesForShape(shape).length) {
    const candidates = [0, 1, 2, 3, 4, 5]
      .map((edge) => neighbor(current, edge))
      .filter((candidate) => containsHex(shape, candidate) && !seen.has(hexKey(candidate)))
      .sort((left, right) => hexDistance(left, end) - hexDistance(right, end));
    if (candidates.length === 0) {
      break;
    }
    const choice = candidates[Math.min(candidates.length - 1, Math.floor(rng() * Math.min(2, candidates.length)))];
    const step = edgeBetween(current, choice);
    if (step === undefined) {
      break;
    }
    current = choice;
    seen.add(hexKey(current));
    path.push(current);
    guard += 1;
  }
  return path;
}
