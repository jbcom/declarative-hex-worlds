/**
 * High-level 2.5D board blueprints that compile campaign-map intent into
 * serializable gameboard recipes and validated plans.
 *
 * @module
 */
import seedrandom from 'seedrandom';
import {
  containsHex,
  coordinatesForShape,
  hexDistance,
  hexKey,
  hexLine,
  hexRange,
  neighbor,
} from './coordinates';
import type {
  GameboardPlan,
  GameboardPlanOptions,
  GameboardTerrain,
  HarborKind,
  HillVariant,
  MountainVariant,
  RoadSlope,
  SettlementBuilding,
} from './gameboard';
import {
  createGameboardPlanFromRecipe,
  createGameboardRecipe,
  type GameboardRecipe,
  type GameboardRecipeStep,
} from './recipe';
import {
  createSeededGameboardDensityFillRules,
  type SeededGameboardLayoutDensityOptions,
} from './rules';
import type { Faction, GameboardShape, HexCoordinates, HexEdgeIndex, TextureSet } from './types';

/** Texture-set fill target for authored or generated biome regions. */
export interface MedievalBiomeFillSpec {
  /** Optional id used in diagnostics and future editor UIs. */
  id?: string;
  /** Texture set applied to the selected tiles. */
  textureSet: TextureSet;
  /** Fraction of eligible land tiles to paint with this texture set. */
  fill: number;
  /** Optional center used to bias the selected biome tiles. */
  center?: HexCoordinates;
  /** Optional radius around `center` that bounds the biome. */
  radius?: number;
  /** Optional terrain filter for biome assignment. */
  terrain?: GameboardTerrain | readonly GameboardTerrain[];
}

/** Multi-tile elevated mountain range intent. */
export interface MedievalMountainRangeSpec {
  /** Optional range id used in diagnostics and generated metadata. */
  id?: string;
  /** Ridge path. Width expands around these coordinates. */
  path: readonly HexCoordinates[];
  /** Radius around the ridge path to include. Defaults to `1`. */
  width?: number;
  /** Highest stack height in the range. Defaults to blueprint `maxElevation`. */
  height?: number;
  /** Mountain visual variant or deterministic cycling. Defaults to `cycle`. */
  variant?: MountainVariant | 'cycle';
  /** Include tree-covered mountain assets above this normalized height. */
  treeLine?: number;
}

/** Authored town or settlement cluster. */
export interface MedievalTownSpec {
  /** Optional town id used in diagnostics and generated docs. */
  id?: string;
  /** Center tile, normally the town hall or market. */
  center: HexCoordinates;
  /** Faction used for faction-colored buildings. */
  faction?: Faction;
  /** Building sequence to place around the town center. */
  buildings?: readonly SettlementBuilding[];
  /** Whether to add a small defensive wall/fence ring. */
  includeWalls?: boolean;
  /** Optional road targets that should connect to this town center. */
  connectTo?: readonly HexCoordinates[];
}

/** Authored multi-segment road network. */
export interface MedievalRoadNetworkSpec {
  /** Optional road id used in diagnostics. */
  id?: string;
  /** Ordered coordinates for the road path. */
  path: readonly HexCoordinates[];
  /** Optional road slope variant for this path. */
  slope?: RoadSlope;
  /** Add bridge structures where the road crosses water. */
  addBridges?: boolean;
}

/** Authored river network. */
export interface MedievalRiverNetworkSpec {
  /** Optional river id used in diagnostics. */
  id?: string;
  /** Ordered coordinates for the river path. */
  path: readonly HexCoordinates[];
  /** Whether to use waterless river overlays. */
  waterless?: boolean;
  /** Whether to prefer curvy river overlays. */
  curvy?: boolean;
}

/** Authored harbor or port cluster. */
export interface MedievalHarborSpec {
  /** Optional harbor id used in diagnostics. */
  id?: string;
  /** Coast tile where the harbor is anchored. */
  at: HexCoordinates;
  /** Edge facing adjacent water. */
  facing: HexEdgeIndex;
  /** Faction used for faction-colored harbor assets. */
  faction?: Faction;
  /** Harbor asset variant. */
  kind?: HarborKind;
  /** Optional inland road target. */
  roadTo?: HexCoordinates;
}

/** Policy for generated visual/access transitions between board regions. */
export interface MedievalTransitionPolicy {
  /** Add EXTRA transition tiles where neighboring texture sets differ. */
  biomeTransitions?: boolean;
  /** Add sloped grass tiles where elevation changes by one level. */
  elevationRamps?: boolean;
  /** Add sloped road variants where a road crosses one elevation level. */
  roadSlopes?: boolean;
  /** Add bridge structures where authored roads cross water tiles. */
  bridges?: boolean;
}

/** High-level options for compiling a full 2.5D medieval board. */
export interface MedievalGameboardBlueprintOptions extends Partial<GameboardPlanOptions> {
  /** Board shape to compile. */
  shape?: GameboardShape;
  /** Primary faction used by generated towns, harbors, and units. */
  faction?: Faction;
  /** Fraction of the board reserved for water. Defaults to a southern coast. */
  waterFill?: number;
  /** Highest generated elevation used by default mountain ranges. */
  maxElevation?: number;
  /** Texture-set fill targets for biome regions. */
  biomeFills?: readonly MedievalBiomeFillSpec[];
  /** Authored mountain ranges. Omit to create one default ridge. */
  mountainRanges?: readonly MedievalMountainRangeSpec[];
  /** Authored towns, or a count for deterministic town placement. */
  towns?: readonly MedievalTownSpec[] | number;
  /** Authored road networks. Auto roads connect towns and harbors. */
  roads?: readonly MedievalRoadNetworkSpec[];
  /** Authored river networks. Omit to create one mountain-to-coast river. */
  rivers?: readonly MedievalRiverNetworkSpec[];
  /** Authored harbors, or a count for deterministic coast placement. */
  harbors?: readonly MedievalHarborSpec[] | number;
  /** Visual and access transition policy. */
  transitionPolicy?: MedievalTransitionPolicy;
  /** Optional generated density fills attached to the resulting recipe. */
  layoutDensity?: SeededGameboardLayoutDensityOptions;
  /** Seed used for generated density fills. */
  layoutFillSeed?: string | number;
}

/** Diagnostic summary for one compiled blueprint. */
export interface MedievalGameboardBlueprintInspection {
  /** Generated recipe. */
  recipe: GameboardRecipe;
  /** Compiled concrete plan. */
  plan: GameboardPlan;
  /** Non-fatal blueprint diagnostics. */
  warnings: readonly string[];
  /** Feature counts emitted by the compiler. */
  counts: Readonly<Record<string, number>>;
}

interface MutableBlueprintTile {
  coordinates: HexCoordinates;
  terrain: GameboardTerrain;
  textureSet: TextureSet;
  elevation: number;
}

interface BlueprintBuildResult {
  recipe: GameboardRecipe;
  warnings: string[];
  counts: Record<string, number>;
}

const DEFAULT_SHAPE = { kind: 'rectangle', width: 12, height: 9 } as const satisfies GameboardShape;
const DEFAULT_TOWN_BUILDINGS = [
  'townhall',
  'market',
  'home_A',
  'home_B',
  'blacksmith',
  'barracks',
] as const satisfies readonly SettlementBuilding[];
const DEFAULT_TRANSITION_POLICY = {
  biomeTransitions: true,
  elevationRamps: true,
  roadSlopes: true,
  bridges: true,
} as const satisfies MedievalTransitionPolicy;
const EDGE_INDEXES = [0, 1, 2, 3, 4, 5] as const satisfies readonly HexEdgeIndex[];

/** Compile a high-level 2.5D board blueprint into a serializable recipe. */
export function createMedievalGameboardBlueprintRecipe(
  options: MedievalGameboardBlueprintOptions = {}
): GameboardRecipe {
  return buildMedievalGameboardBlueprint(options).recipe;
}

/** Compile a high-level 2.5D board blueprint directly into a gameboard plan. */
export function createMedievalGameboardBlueprintPlan(
  options: MedievalGameboardBlueprintOptions = {}
): GameboardPlan {
  return createGameboardPlanFromRecipe(createMedievalGameboardBlueprintRecipe(options));
}

/** Compile, build, and summarize a high-level 2.5D board blueprint. */
export function inspectMedievalGameboardBlueprint(
  options: MedievalGameboardBlueprintOptions = {}
): MedievalGameboardBlueprintInspection {
  const result = buildMedievalGameboardBlueprint(options);
  return {
    ...result,
    plan: createGameboardPlanFromRecipe(result.recipe),
  };
}

/** Create a comprehensive showcase recipe with mountains, towns, roads, harbors, biomes, and transitions. */
export function createMedievalShowcaseBlueprintRecipe(
  options: MedievalGameboardBlueprintOptions = {}
): GameboardRecipe {
  return createMedievalGameboardBlueprintRecipe({
    seed: 'medieval-showcase-blueprint',
    shape: DEFAULT_SHAPE,
    faction: 'blue',
    maxElevation: 4,
    waterFill: 0.18,
    biomeFills: [
      { id: 'fall-woods', textureSet: 'fall', fill: 0.16, center: { q: 2, r: 4 }, radius: 3 },
      { id: 'winter-peaks', textureSet: 'winter', fill: 0.12, center: { q: 8, r: 2 }, radius: 3 },
      { id: 'summer-coast', textureSet: 'summer', fill: 0.1, center: { q: 7, r: 6 }, radius: 3 },
    ],
    towns: [
      { id: 'citadel', center: { q: 4, r: 4 }, includeWalls: true },
      { id: 'frontier-village', center: { q: 8, r: 5 }, buildings: ['market', 'home_A', 'home_B', 'well'] },
    ],
    harbors: [{ id: 'south-port', at: { q: 6, r: 7 }, facing: 1, kind: 'shipyard', roadTo: { q: 4, r: 4 } }],
    roads: [
      {
        id: 'market-road',
        path: [
          { q: 4, r: 4 },
          { q: 5, r: 4 },
          { q: 6, r: 5 },
          { q: 7, r: 5 },
          { q: 8, r: 5 },
        ],
      },
      {
        id: 'ridge-road',
        path: [
          { q: 2, r: 2 },
          { q: 3, r: 2 },
          { q: 4, r: 3 },
          { q: 4, r: 4 },
        ],
      },
    ],
    layoutDensity: {
      trees: { fill: 0.08, maxCount: 12 },
      rocks: { fill: 0.04, maxCount: 8 },
      props: { fill: 0.04, maxCount: 8 },
      landmarks: { count: 2 },
      units: { count: 3 },
    },
    ...options,
  });
}

function buildMedievalGameboardBlueprint(options: MedievalGameboardBlueprintOptions): BlueprintBuildResult {
  const shape = options.shape ?? DEFAULT_SHAPE;
  const seed = String(options.seed ?? 'medieval-gameboard-blueprint');
  const rng = seedrandom(seed);
  const faction = options.faction ?? 'blue';
  const textureSet = options.textureSet ?? 'default';
  const maxElevation = Math.max(1, Math.floor(options.maxElevation ?? 3));
  const transitionPolicy = { ...DEFAULT_TRANSITION_POLICY, ...(options.transitionPolicy ?? {}) };
  const coordinates = coordinatesForShape(shape);
  const tiles = new Map<string, MutableBlueprintTile>(
    coordinates.map((coordinates) => [
      hexKey(coordinates),
      { coordinates, terrain: options.defaultTerrain ?? 'grass', textureSet, elevation: 0 },
    ])
  );
  const steps: GameboardRecipeStep[] = [];
  const warnings: string[] = [];
  const counts: Record<string, number> = {};

  applyWaterBand(steps, tiles, shape, options.waterFill ?? 0.16, counts);
  applyCoasts(steps, tiles, counts);
  applyMountainRanges(
    steps,
    tiles,
    normalizeMountainRanges(options.mountainRanges, shape, maxElevation),
    maxElevation,
    counts,
    warnings
  );
  applyDefaultHillsAndForests(steps, tiles, rng, counts);

  const towns = normalizeTowns(options.towns, tiles, faction, rng);
  applyTowns(steps, tiles, towns, counts, warnings);

  const harbors = normalizeHarbors(options.harbors, tiles, faction, towns, rng);
  applyHarbors(steps, tiles, harbors, counts, warnings);

  const rivers = options.rivers ?? createDefaultRivers(tiles, shape);
  applyRivers(steps, tiles, rivers, shape, counts, warnings);

  const roads = [
    ...createAutoRoads(towns, harbors, shape),
    ...(options.roads ?? []),
  ];
  applyRoads(steps, tiles, roads, shape, transitionPolicy, counts, warnings);

  applyBiomeFills(steps, tiles, options.biomeFills ?? [], rng, counts);
  if (transitionPolicy.biomeTransitions) {
    applyBiomeTransitions(steps, tiles, counts);
  }
  if (transitionPolicy.elevationRamps) {
    applyElevationRamps(steps, tiles, counts, warnings);
  }

  return {
    recipe: createGameboardRecipe(
      {
        seed,
        shape,
        textureSet,
        defaultTerrain: options.defaultTerrain ?? 'grass',
      },
      steps,
      options.layoutDensity
        ? {
            layoutFillSeed: options.layoutFillSeed ?? `${seed}:blueprint-density`,
            layoutFills: createSeededGameboardDensityFillRules(options.layoutDensity, { faction }),
          }
        : {}
    ),
    warnings,
    counts,
  };
}

function applyWaterBand(
  steps: GameboardRecipeStep[],
  tiles: Map<string, MutableBlueprintTile>,
  shape: GameboardShape,
  fill: number,
  counts: Record<string, number>
): void {
  const coordinates = [...tiles.values()].map((tile) => tile.coordinates);
  const target = Math.max(0, Math.min(coordinates.length, Math.round(coordinates.length * clamp(fill, 0, 0.6))));
  const sorted = coordinates.sort((left, right) => right.r - left.r || centerDistance(shape, left) - centerDistance(shape, right));
  for (const coordinates of sorted.slice(0, target)) {
    const tile = tiles.get(hexKey(coordinates));
    if (!tile) {
      continue;
    }
    tile.terrain = 'water';
    tile.elevation = 0;
    steps.push({ action: 'setTerrain', at: coordinates, terrain: 'water', textureSet: tile.textureSet });
  }
  counts.waterTiles = target;
}

function applyCoasts(
  steps: GameboardRecipeStep[],
  tiles: Map<string, MutableBlueprintTile>,
  counts: Record<string, number>
): void {
  let coastCount = 0;
  const waterKeys = new Set([...tiles.values()].filter((tile) => tile.terrain === 'water').map((tile) => hexKey(tile.coordinates)));
  for (const tile of tiles.values()) {
    if (tile.terrain === 'water') {
      continue;
    }
    const waterEdges = EDGE_INDEXES.filter((edge) => waterKeys.has(hexKey(neighbor(tile.coordinates, edge))));
    if (waterEdges.length === 0) {
      continue;
    }
    tile.terrain = 'coast';
    steps.push({ action: 'setCoastEdges', at: tile.coordinates, waterEdges });
    coastCount += 1;
  }
  counts.coastTiles = coastCount;
}

function applyMountainRanges(
  steps: GameboardRecipeStep[],
  tiles: Map<string, MutableBlueprintTile>,
  ranges: readonly MedievalMountainRangeSpec[],
  maxElevation: number,
  counts: Record<string, number>,
  warnings: string[]
): void {
  let mountainCount = 0;
  const variants = ['A', 'B', 'C'] as const;
  for (const range of ranges) {
    const ridge = range.path.filter((coordinates) => tiles.has(hexKey(coordinates)));
    if (ridge.length === 0) {
      warnings.push(`Mountain range ${range.id ?? '<unnamed>'} has no in-bounds ridge coordinates`);
      continue;
    }
    const width = Math.max(0, Math.floor(range.width ?? 1));
    const height = Math.max(1, Math.min(maxElevation, Math.floor(range.height ?? maxElevation)));
    const candidates = new Map<string, HexCoordinates>();
    for (const coordinate of ridge) {
      for (const expanded of hexRange(coordinate, width)) {
        if (tiles.has(hexKey(expanded))) {
          candidates.set(hexKey(expanded), expanded);
        }
      }
    }
    for (const coordinate of candidates.values()) {
      const tile = tiles.get(hexKey(coordinate));
      if (!tile || tile.terrain === 'water' || tile.terrain === 'coast') {
        continue;
      }
      const distance = Math.min(...ridge.map((ridgeCoordinate) => hexDistance(coordinate, ridgeCoordinate)));
      const stackHeight = Math.max(1, height - distance);
      const variant = range.variant && range.variant !== 'cycle'
        ? range.variant
        : variants[Math.abs(coordinate.q + coordinate.r) % variants.length];
      tile.terrain = 'mountain';
      tile.elevation = stackHeight;
      steps.push({
        action: 'addMountainStack',
        at: coordinate,
        height: stackHeight,
        variant,
        withGrass: true,
        withTrees: stackHeight / height >= (range.treeLine ?? 0.65),
        rotationSteps: Math.abs(coordinate.q - coordinate.r) % 6,
      });
      mountainCount += 1;
    }
  }
  counts.mountainStacks = mountainCount;
}

function applyDefaultHillsAndForests(
  steps: GameboardRecipeStep[],
  tiles: Map<string, MutableBlueprintTile>,
  rng: seedrandom.PRNG,
  counts: Record<string, number>
): void {
  const available = [...tiles.values()].filter((tile) => tile.terrain === 'grass');
  const hills = takeRandom(available, Math.max(2, Math.floor(available.length * 0.05)), rng);
  const hillVariants = ['A', 'B', 'C'] as const satisfies readonly HillVariant[];
  for (const [index, tile] of hills.entries()) {
    tile.terrain = 'hill';
    steps.push({
      action: 'addHill',
      at: tile.coordinates,
      variant: hillVariants[index % hillVariants.length],
      withTrees: index % 2 === 0,
      rotationSteps: index % 6,
    });
  }

  const forests = takeRandom(
    available.filter((tile) => tile.terrain === 'grass'),
    Math.max(4, Math.floor(available.length * 0.08)),
    rng
  );
  for (const [index, tile] of forests.entries()) {
    tile.terrain = 'forest';
    steps.push({
      action: 'addForest',
      at: tile.coordinates,
      species: index % 2 === 0 ? 'A' : 'B',
      size: index % 3 === 0 ? 'large' : index % 3 === 1 ? 'medium' : 'small',
    });
  }
  counts.hillTiles = hills.length;
  counts.forestTiles = forests.length;
}

function applyTowns(
  steps: GameboardRecipeStep[],
  tiles: Map<string, MutableBlueprintTile>,
  towns: readonly MedievalTownSpec[],
  counts: Record<string, number>,
  warnings: string[]
): void {
  let buildingCount = 0;
  for (const town of towns) {
    if (!tiles.has(hexKey(town.center))) {
      warnings.push(`Town ${town.id ?? '<unnamed>'} center ${hexKey(town.center)} is outside the board`);
      continue;
    }
    const faction = town.faction ?? 'blue';
    const buildings = town.buildings ?? DEFAULT_TOWN_BUILDINGS;
    const sites = [town.center, ...EDGE_INDEXES.map((edge) => neighbor(town.center, edge))].filter((site) =>
      canHostStructure(tiles.get(hexKey(site)))
    );
    for (const [index, building] of buildings.entries()) {
      const site = sites[index];
      if (!site) {
        break;
      }
      steps.push({
        action: 'addFactionBuilding',
        at: site,
        faction,
        building,
        rotationSteps: index % 6,
      });
      buildingCount += 1;
    }
    if (town.includeWalls) {
      const wallSites = hexRange(town.center, 2).filter((site) => hexDistance(site, town.center) === 2);
      for (const [index, site] of wallSites.entries()) {
        if (!canHostStructure(tiles.get(hexKey(site)))) {
          continue;
        }
        steps.push({
          action: 'addFortification',
          at: site,
          material: 'wall',
          segment: index % 3 === 0 ? 'straight-gate' : 'straight',
          rotationSteps: index,
          enclosureId: town.id ?? `town:${hexKey(town.center)}`,
          scale: 0.92,
        });
        buildingCount += 1;
      }
    }
    for (const target of town.connectTo ?? []) {
      steps.push({ action: 'addRoadPath', path: hexLine(town.center, target) });
    }
  }
  counts.townBuildings = buildingCount;
  counts.towns = towns.length;
}

function applyHarbors(
  steps: GameboardRecipeStep[],
  tiles: Map<string, MutableBlueprintTile>,
  harbors: readonly MedievalHarborSpec[],
  counts: Record<string, number>,
  warnings: string[]
): void {
  for (const harbor of harbors) {
    const harborTile = tiles.get(hexKey(harbor.at));
    if (harborTile) {
      harborTile.terrain = 'coast';
    }
    const waterTile = tiles.get(hexKey(neighbor(harbor.at, harbor.facing)));
    if (waterTile) {
      waterTile.terrain = 'water';
      waterTile.elevation = 0;
    }
    if (harbor.roadTo) {
      steps.push({ action: 'addRoadPath', path: hexLine(harbor.roadTo, harbor.at) });
    }
    steps.push({
      action: 'addHarbor',
      at: harbor.at,
      facing: harbor.facing,
      faction: harbor.faction ?? 'blue',
      kind: harbor.kind ?? 'docks',
      includeProps: true,
    });
  }
  if (harbors.length === 0) {
    warnings.push('No harbor could be placed because the blueprint has no coast tiles');
  }
  counts.harbors = harbors.length;
}

function applyRoads(
  steps: GameboardRecipeStep[],
  tiles: Map<string, MutableBlueprintTile>,
  roads: readonly MedievalRoadNetworkSpec[],
  shape: GameboardShape,
  transitionPolicy: MedievalTransitionPolicy,
  counts: Record<string, number>,
  warnings: string[]
): void {
  let bridgeCount = 0;
  const occupiedStructureKeys = collectStructurePlacementKeys(steps);
  const bridgedKeys = new Set<string>();
  for (const road of roads) {
    const path = expandWaypointPath(road.path, shape).filter((coordinate) => tiles.has(hexKey(coordinate)));
    if (path.length < 2) {
      warnings.push(`Road ${road.id ?? '<unnamed>'} has fewer than two in-bounds coordinates`);
      continue;
    }
    if (transitionPolicy.roadSlopes) {
      for (let index = 0; index < path.length - 1; index += 1) {
        const current = tiles.get(hexKey(path[index]));
        const next = tiles.get(hexKey(path[index + 1]));
        const slope = current && next && current.elevation !== next.elevation ? (current.elevation < next.elevation ? 'high' : 'low') : road.slope;
        steps.push({ action: 'addRoadPath', path: [path[index], path[index + 1]], slope });
      }
    } else {
      steps.push({ action: 'addRoadPath', path, slope: road.slope });
    }
    if (road.addBridges ?? transitionPolicy.bridges) {
      for (const coordinate of path) {
        const tile = tiles.get(hexKey(coordinate));
        if (tile?.terrain !== 'water' && tile?.terrain !== 'river') {
          continue;
        }
        const key = hexKey(coordinate);
        if (occupiedStructureKeys.has(key) || bridgedKeys.has(key)) {
          continue;
        }
        steps.push({
          action: 'addBridge',
          at: coordinate,
          variant: bridgeCount % 2 === 0 ? 'A' : 'B',
          rotationSteps: bridgeCount % 6,
        });
        occupiedStructureKeys.add(key);
        bridgedKeys.add(key);
        bridgeCount += 1;
      }
    }
  }
  counts.roads = roads.length;
  counts.bridges = bridgeCount;
}

function collectStructurePlacementKeys(steps: readonly GameboardRecipeStep[]): Set<string> {
  const keys = new Set<string>();
  for (const step of steps) {
    switch (step.action) {
      case 'addFactionBuilding':
      case 'addNeutralStructure':
      case 'addBridge':
      case 'addFortification':
      case 'addConstructionSite':
      case 'addSiegeProjectile':
      case 'addHarbor':
        keys.add(hexKey(step.at));
        break;
      case 'addPlacement':
        if (step.kind === 'structure') {
          keys.add(hexKey(step.at));
        }
        break;
      default:
        break;
    }
  }
  return keys;
}

function applyRivers(
  steps: GameboardRecipeStep[],
  tiles: Map<string, MutableBlueprintTile>,
  rivers: readonly MedievalRiverNetworkSpec[],
  shape: GameboardShape,
  counts: Record<string, number>,
  warnings: string[]
): void {
  for (const river of rivers) {
    const path = expandWaypointPath(river.path, shape);
    if (path.length < 2) {
      warnings.push(`River ${river.id ?? '<unnamed>'} has fewer than two coordinates`);
      continue;
    }
    for (const coordinates of path) {
      const tile = tiles.get(hexKey(coordinates));
      if (tile && tile.terrain !== 'water') {
        tile.terrain = 'river';
      }
    }
    steps.push({
      action: 'addRiverPath',
      path,
      waterless: river.waterless,
      curvy: river.curvy ?? true,
    });
  }
  counts.rivers = rivers.length;
}

function applyBiomeFills(
  steps: GameboardRecipeStep[],
  tiles: Map<string, MutableBlueprintTile>,
  biomeFills: readonly MedievalBiomeFillSpec[],
  rng: seedrandom.PRNG,
  counts: Record<string, number>
): void {
  let textureAssignments = 0;
  for (const biome of biomeFills) {
    const terrains = biome.terrain ? new Set(Array.isArray(biome.terrain) ? biome.terrain : [biome.terrain]) : undefined;
    const candidates = [...tiles.values()]
      .filter((tile) => tile.terrain !== 'water')
      .filter((tile) => !terrains || terrains.has(tile.terrain))
      .filter((tile) => !biome.center || biome.radius === undefined || hexDistance(tile.coordinates, biome.center) <= biome.radius);
    const ordered = biome.center
      ? candidates.sort(
          (left, right) =>
            hexDistance(left.coordinates, biome.center as HexCoordinates) -
              hexDistance(right.coordinates, biome.center as HexCoordinates) ||
            hexKey(left.coordinates).localeCompare(hexKey(right.coordinates))
        )
      : takeRandom(candidates, candidates.length, rng);
    const target = Math.max(0, Math.min(candidates.length, Math.round(candidates.length * clamp(biome.fill, 0, 1))));
    for (const tile of ordered.slice(0, target)) {
      tile.textureSet = biome.textureSet;
      steps.push({ action: 'setTextureSet', at: tile.coordinates, textureSet: biome.textureSet });
      textureAssignments += 1;
    }
  }
  counts.biomeTiles = textureAssignments;
}

function applyBiomeTransitions(
  steps: GameboardRecipeStep[],
  tiles: Map<string, MutableBlueprintTile>,
  counts: Record<string, number>
): void {
  const seen = new Set<string>();
  let transitionCount = 0;
  for (const tile of tiles.values()) {
    if (tile.terrain === 'water') {
      continue;
    }
    for (const edge of EDGE_INDEXES) {
      const adjacent = tiles.get(hexKey(neighbor(tile.coordinates, edge)));
      if (!adjacent || adjacent.terrain === 'water' || adjacent.textureSet === tile.textureSet) {
        continue;
      }
      const pairKey = [hexKey(tile.coordinates), hexKey(adjacent.coordinates)].sort().join('|');
      if (seen.has(pairKey)) {
        continue;
      }
      seen.add(pairKey);
      steps.push({
        action: 'addTransition',
        at: tile.coordinates,
        from: tile.textureSet,
        to: adjacent.textureSet,
        rotationSteps: edge,
      });
      transitionCount += 1;
    }
  }
  counts.biomeTransitions = transitionCount;
}

function applyElevationRamps(
  steps: GameboardRecipeStep[],
  tiles: Map<string, MutableBlueprintTile>,
  counts: Record<string, number>,
  warnings: string[]
): void {
  const seen = new Set<string>();
  let rampCount = 0;
  for (const tile of tiles.values()) {
    if (tile.terrain === 'water') {
      continue;
    }
    for (const edge of EDGE_INDEXES) {
      const adjacent = tiles.get(hexKey(neighbor(tile.coordinates, edge)));
      if (!adjacent || adjacent.terrain === 'water') {
        continue;
      }
      const pairKey = [hexKey(tile.coordinates), hexKey(adjacent.coordinates)].sort().join('|');
      if (seen.has(pairKey)) {
        continue;
      }
      seen.add(pairKey);
      const delta = adjacent.elevation - tile.elevation;
      if (Math.abs(delta) === 1) {
        const lower = delta > 0 ? tile : adjacent;
        steps.push({
          action: 'addElevationRamp',
          at: lower.coordinates,
          direction: delta > 0 ? 'up' : 'down',
          rotationSteps: edge,
          fromElevation: lower.elevation,
          toElevation: lower.elevation + 1,
          textureSet: lower.textureSet,
        });
        rampCount += 1;
      } else if (Math.abs(delta) > 1) {
        warnings.push(
          `Elevation change ${hexKey(tile.coordinates)} -> ${hexKey(adjacent.coordinates)} is ${Math.abs(delta)} levels; add intermediate ramp tiles for pathable movement`
        );
      }
    }
  }
  counts.elevationRamps = rampCount;
}

function normalizeMountainRanges(
  ranges: readonly MedievalMountainRangeSpec[] | undefined,
  shape: GameboardShape,
  maxElevation: number
): readonly MedievalMountainRangeSpec[] {
  if (ranges?.length) {
    return ranges;
  }
  const coordinates = coordinatesForShape(shape);
  const minR = Math.min(...coordinates.map((coordinate) => coordinate.r));
  const top = coordinates.filter((coordinate) => coordinate.r === minR).sort((left, right) => left.q - right.q);
  const start = top[Math.floor(top.length * 0.2)] ?? coordinates[0];
  const end = top[Math.floor(top.length * 0.8)] ?? coordinates[coordinates.length - 1];
  return [{ id: 'default-ridge', path: hexLine(start, end), width: 1, height: maxElevation, variant: 'cycle' }];
}

function normalizeTowns(
  towns: readonly MedievalTownSpec[] | number | undefined,
  tiles: ReadonlyMap<string, MutableBlueprintTile>,
  faction: Faction,
  rng: seedrandom.PRNG
): readonly MedievalTownSpec[] {
  if (typeof towns !== 'number' && towns) {
    return towns.map((town) => ({ ...town, faction: town.faction ?? faction }));
  }
  const count = Math.max(1, Math.floor(towns ?? 1));
  return takeRandom([...tiles.values()].filter(canHostTown).sort((left, right) => left.elevation - right.elevation), count, rng)
    .map((tile, index) => ({
      id: `town-${index + 1}`,
      center: tile.coordinates,
      faction,
      includeWalls: index === 0,
    }));
}

function normalizeHarbors(
  harbors: readonly MedievalHarborSpec[] | number | undefined,
  tiles: ReadonlyMap<string, MutableBlueprintTile>,
  faction: Faction,
  towns: readonly MedievalTownSpec[],
  rng: seedrandom.PRNG
): readonly MedievalHarborSpec[] {
  if (typeof harbors !== 'number' && harbors) {
    return harbors.map((harbor) => ({ ...harbor, faction: harbor.faction ?? faction }));
  }
  const count = Math.max(0, Math.floor(harbors ?? 1));
  const candidates = [...tiles.values()]
    .map((tile) => ({
      tile,
      waterEdges: EDGE_INDEXES.filter((edge) => tiles.get(hexKey(neighbor(tile.coordinates, edge)))?.terrain === 'water'),
    }))
    .filter((candidate) => candidate.tile.terrain === 'coast' && candidate.waterEdges.length > 0);
  return takeRandom(candidates, count, rng).map((candidate, index) => ({
    id: `harbor-${index + 1}`,
    at: candidate.tile.coordinates,
    facing: candidate.waterEdges[0] ?? 1,
    faction,
    kind: index % 2 === 0 ? 'docks' : 'shipyard',
    roadTo: towns[index % Math.max(1, towns.length)]?.center,
  }));
}

function createAutoRoads(
  towns: readonly MedievalTownSpec[],
  harbors: readonly MedievalHarborSpec[],
  shape: GameboardShape
): MedievalRoadNetworkSpec[] {
  const roads: MedievalRoadNetworkSpec[] = [];
  for (let index = 0; index < towns.length - 1; index += 1) {
    roads.push({
      id: `town-link-${index + 1}`,
      path: hexLine(towns[index].center, towns[index + 1].center).filter((coordinate) => containsHex(shape, coordinate)),
    });
  }
  for (const harbor of harbors) {
    if (harbor.roadTo) {
      roads.push({
        id: `harbor-link-${harbor.id ?? hexKey(harbor.at)}`,
        path: hexLine(harbor.roadTo, harbor.at).filter((coordinate) => containsHex(shape, coordinate)),
      });
    }
  }
  return roads;
}

function createDefaultRivers(
  tiles: ReadonlyMap<string, MutableBlueprintTile>,
  shape: GameboardShape
): MedievalRiverNetworkSpec[] {
  const mountains = [...tiles.values()].filter((tile) => tile.terrain === 'mountain').sort((left, right) => right.elevation - left.elevation);
  const water = [...tiles.values()].filter((tile) => tile.terrain === 'water').sort((left, right) => left.coordinates.q - right.coordinates.q);
  const start = mountains[0]?.coordinates;
  const end = water[Math.floor(water.length / 2)]?.coordinates;
  if (!start || !end) {
    return [];
  }
  return [{ id: 'default-river', path: hexLine(start, end).filter((coordinate) => containsHex(shape, coordinate)), curvy: true }];
}

function expandWaypointPath(path: readonly HexCoordinates[], shape: GameboardShape): HexCoordinates[] {
  const expanded: HexCoordinates[] = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = hexLine(path[index], path[index + 1]).filter((coordinate) => containsHex(shape, coordinate));
    if (index > 0) {
      segment.shift();
    }
    expanded.push(...segment);
  }
  if (expanded.length === 0 && path[0] && containsHex(shape, path[0])) {
    expanded.push(path[0]);
  }
  return expanded;
}

function canHostStructure(tile: MutableBlueprintTile | undefined): tile is MutableBlueprintTile {
  return Boolean(tile && tile.terrain !== 'water' && tile.terrain !== 'mountain');
}

function canHostTown(tile: MutableBlueprintTile): boolean {
  return tile.terrain !== 'water' && tile.terrain !== 'coast' && tile.terrain !== 'mountain';
}

function takeRandom<T>(items: readonly T[], count: number, rng: seedrandom.PRNG): T[] {
  const pool = [...items];
  const selected: T[] = [];
  while (selected.length < count && pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    const [item] = pool.splice(index, 1);
    selected.push(item);
  }
  return selected;
}

function centerDistance(shape: GameboardShape, coordinates: HexCoordinates): number {
  if (shape.kind === 'rectangle') {
    return Math.abs(coordinates.q - (shape.width - 1) / 2) + Math.abs(coordinates.r - (shape.height - 1) / 2);
  }
  return hexDistance(coordinates, { q: 0, r: 0 });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
