import seedrandom from 'seedrandom';
import {
  coloredUnitAssetId,
  factionBuildingAssetId,
  flagAssetId,
  neutralUnitAssetId,
  type ColoredUnitPart,
  type ColoredUnitStyle,
  type FactionBuildingKind,
  type NatureAssetId,
  type NeutralStructureKind,
  type NeutralUnitPart,
  type PropAssetId,
} from './catalog';
import {
  HEX_DIRECTIONS,
  coordinatesForShape,
  edgeBetween,
  hexLine,
  hexKey,
  neighbor,
  oppositeEdge,
  parseHexKey,
} from './coordinates';
import { axialToWorld } from './grid';
import { freeManifest } from './manifest/free';
import {
  edgeMask,
  selectCoastVariant,
  selectRiverCrossingVariant,
  selectRiverVariant,
  selectRoadVariant,
} from './selectors';
import type {
  Faction,
  GameboardShape,
  HexCoordinates,
  HexEdgeInput,
  HexEdgeIndex,
  MedievalHexagonAsset,
  TextureSet,
  WorldPosition,
} from './types';

export const GAMEBOARD_SCHEMA_VERSION = '1.0.0';

export type BuiltInGameboardTerrain = 'grass' | 'water' | 'coast' | 'road' | 'river' | 'mountain' | 'hill' | 'forest';
export type GameboardTerrain = BuiltInGameboardTerrain | (string & {});

export type RoadSlope = 'high' | 'low';
export type RiverCrossing = 'A' | 'B';
export type HexRotationSteps = 0 | 1 | 2 | 3 | 4 | 5;

export type GameboardPlacementKind =
  | 'terrain'
  | 'road'
  | 'river'
  | 'coast'
  | 'transition'
  | 'decoration'
  | 'structure'
  | 'unit'
  | 'prop';

export type GameboardPlacementLayer = 'terrain' | 'surface' | 'feature' | 'structure' | 'unit';

export type MountainVariant = 'A' | 'B' | 'C';
export type HillVariant = 'A' | 'B' | 'C';
export type HarborKind = 'docks' | 'shipyard' | 'watermill';
export type SettlementBuilding = FactionBuildingKind;

export interface GameboardPlanOptions {
  seed?: string | number;
  shape: GameboardShape;
  textureSet?: TextureSet;
  defaultTerrain?: Extract<GameboardTerrain, 'grass' | 'water'>;
}

export interface GameboardTileSpec {
  key: string;
  coordinates: HexCoordinates;
  terrain: GameboardTerrain;
  textureSet: TextureSet;
  elevation: number;
  baseAssetId: string;
  supportAssetId: string;
  roadEdges: number;
  riverEdges: number;
  coastEdges: number;
  roadSlope?: 'high' | 'low';
  riverWaterless: boolean;
  riverCurvy: boolean;
  riverCrossing?: 'A' | 'B';
  coastWaterless: boolean;
  tags: readonly string[];
}

export interface GameboardPlacementSpec {
  id: string;
  tileKey: string;
  coordinates: HexCoordinates;
  position: WorldPosition;
  assetId: string;
  kind: GameboardPlacementKind;
  layer: GameboardPlacementLayer;
  textureSet: TextureSet;
  elevation: number;
  elevationOffset: number;
  rotationSteps: number;
  rotationRadians: number;
  scale: number;
  order: number;
  stackIndex?: number;
  requiresExtra: boolean;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface GameboardPlan {
  schemaVersion: typeof GAMEBOARD_SCHEMA_VERSION;
  seed: string;
  shape: GameboardShape;
  textureSet: TextureSet;
  tiles: readonly GameboardTileSpec[];
  placements: readonly GameboardPlacementSpec[];
  warnings: readonly string[];
}

export interface GameboardPlanFromTilesOptions {
  seed: string;
  shape: GameboardShape;
  textureSet?: TextureSet;
  tiles: readonly GameboardTileSpec[];
  placements?: readonly GameboardPlacementSpec[];
  warnings?: readonly string[];
}

export interface MountainStackOptions {
  at: HexCoordinates;
  height: number;
  variant?: MountainVariant;
  withGrass?: boolean;
  withTrees?: boolean;
  rotationSteps?: number;
  scale?: number;
}

export interface HarborOptions {
  at: HexCoordinates;
  facing: HexEdgeIndex;
  faction: Faction;
  kind?: HarborKind;
  includeProps?: boolean;
  rotationSteps?: number;
}

export interface SettlementOptions {
  at: HexCoordinates;
  faction: Faction;
  building: SettlementBuilding;
  rotationSteps?: number;
  scale?: number;
}

export interface FactionBuildingOptions {
  at: HexCoordinates;
  faction: Faction;
  building: FactionBuildingKind;
  rotationSteps?: number;
  scale?: number;
}

export interface NeutralStructureOptions {
  at: HexCoordinates;
  structure: NeutralStructureKind;
  rotationSteps?: number;
  scale?: number;
}

export interface NaturePlacementOptions {
  at: HexCoordinates;
  assetId: NatureAssetId;
  rotationSteps?: number;
  scale?: number;
}

export interface PropPlacementOptions {
  at: HexCoordinates;
  assetId: PropAssetId;
  rotationSteps?: number;
  scale?: number;
}

export interface TransitionPlacementOptions {
  at: HexCoordinates;
  from: TextureSet;
  to: TextureSet;
  rotationSteps?: number;
}

export interface UnitPlacementOptions {
  at: HexCoordinates;
  part: ColoredUnitPart | NeutralUnitPart;
  faction?: Faction;
  style?: ColoredUnitStyle;
  neutral?: boolean;
  compositeId?: string;
  rotationSteps?: number;
  scale?: number;
}

export interface UnitPresetOptions {
  at: HexCoordinates;
  faction: Faction;
  style?: ColoredUnitStyle;
  role: 'worker' | 'soldier' | 'archer' | 'cavalry' | 'merchant' | 'siege' | 'ship';
  rotationSteps?: number;
}

export interface TileAssetOptions {
  at: HexCoordinates;
  assetId: string;
  terrain?: GameboardTerrain;
  supportAssetId?: string;
  elevation?: number;
  roadEdges?: HexEdgeInput;
  riverEdges?: HexEdgeInput;
  coastEdges?: HexEdgeInput;
  roadSlope?: RoadSlope;
  riverWaterless?: boolean;
  riverCurvy?: boolean;
  riverCrossing?: RiverCrossing;
  coastWaterless?: boolean;
  tags?: readonly string[];
}

export interface ScatterDecorationOptions {
  count: number;
  assets: readonly string[];
  terrain?: GameboardTerrain | readonly GameboardTerrain[];
  avoidOccupied?: boolean;
  scale?: number;
}

export interface MedievalHarborBoardOptions extends Partial<GameboardPlanOptions> {
  faction?: Faction;
}

const DEFAULT_SEED = 'medieval-hexagon-gameboard';
const EDGE_INDEXES = [0, 1, 2, 3, 4, 5] as const satisfies readonly HexEdgeIndex[];
const TERRAIN_ASSETS: Record<Extract<GameboardTerrain, 'grass' | 'water'>, string> = {
  grass: 'hex_grass',
  water: 'hex_water',
};
const EXTRA_HARBOR_ASSETS: Record<Exclude<HarborKind, 'watermill'>, string> = {
  docks: 'building_docks',
  shipyard: 'building_shipyard',
};

export class GameboardBuilder {
  readonly seed: string;
  readonly shape: GameboardShape;
  readonly textureSet: TextureSet;
  private readonly rng: seedrandom.PRNG;
  private readonly tiles = new Map<string, MutableGameboardTileSpec>();
  private readonly customPlacements: GameboardPlacementSpec[] = [];
  private readonly warnings: string[] = [];
  private placementCursor = 0;

  constructor(options: GameboardPlanOptions) {
    this.seed = String(options.seed ?? DEFAULT_SEED);
    this.shape = options.shape;
    this.textureSet = options.textureSet ?? 'default';
    this.rng = seedrandom(this.seed);

    const defaultTerrain = options.defaultTerrain ?? 'grass';
    for (const coordinates of coordinatesForShape(options.shape)) {
      this.tiles.set(hexKey(coordinates), createTile(coordinates, defaultTerrain, this.textureSet));
    }
  }

  setTerrain(
    coordinates: HexCoordinates,
    terrain: Extract<GameboardTerrain, 'grass' | 'water'>,
    options: { elevation?: number; baseAssetId?: string } = {}
  ): this {
    const tile = this.requireTile(coordinates);
    tile.terrain = terrain;
    tile.baseAssetId = options.baseAssetId ?? TERRAIN_ASSETS[terrain];
    tile.elevation = normalizeElevation(options.elevation ?? tile.elevation);
    updateTags(tile);
    return this;
  }

  setTileAsset(options: TileAssetOptions): this {
    const tile = this.requireTile(options.at);
    tile.baseAssetId = options.assetId;
    tile.terrain = options.terrain ?? tile.terrain;
    tile.supportAssetId = options.supportAssetId ?? tile.supportAssetId;
    tile.elevation = normalizeElevation(options.elevation ?? tile.elevation);
    tile.roadEdges = options.roadEdges === undefined ? tile.roadEdges : edgeMask(options.roadEdges);
    tile.riverEdges = options.riverEdges === undefined ? tile.riverEdges : edgeMask(options.riverEdges);
    tile.coastEdges = options.coastEdges === undefined ? tile.coastEdges : edgeMask(options.coastEdges);
    tile.roadSlope = options.roadSlope ?? tile.roadSlope;
    tile.riverWaterless = options.riverWaterless ?? tile.riverWaterless;
    tile.riverCurvy = options.riverCurvy ?? tile.riverCurvy;
    tile.riverCrossing = options.riverCrossing ?? tile.riverCrossing;
    tile.coastWaterless = options.coastWaterless ?? tile.coastWaterless;
    updateTags(tile, options.tags);
    return this;
  }

  setElevation(coordinates: HexCoordinates, elevation: number): this {
    const tile = this.requireTile(coordinates);
    tile.elevation = normalizeElevation(elevation);
    updateTags(tile);
    return this;
  }

  setCoastEdges(
    coordinates: HexCoordinates,
    waterEdges: readonly HexEdgeIndex[] | number,
    options: { waterless?: boolean } = {}
  ): this {
    const tile = this.requireTile(coordinates);
    tile.terrain = 'coast';
    tile.coastEdges = edgeMask(waterEdges);
    tile.coastWaterless = options.waterless ?? false;
    updateTags(tile);
    return this;
  }

  addRoadPath(
    path: readonly HexCoordinates[],
    options: { slope?: 'high' | 'low' } = {}
  ): this {
    const masks = pathMasks(path);
    for (const [key, mask] of masks) {
      const tile = this.requireTile(parseHexKey(key));
      tile.terrain = tile.terrain === 'water' || tile.terrain === 'coast' ? 'coast' : 'road';
      tile.roadEdges = mergeMask(tile.roadEdges, mask);
      tile.roadSlope = options.slope ?? tile.roadSlope;
      updateTags(tile);
    }
    return this;
  }

  addRiverPath(
    path: readonly HexCoordinates[],
    options: { waterless?: boolean; curvy?: boolean; crossing?: 'A' | 'B' } = {}
  ): this {
    const masks = pathMasks(path);
    for (const [key, mask] of masks) {
      const tile = this.requireTile(parseHexKey(key));
      tile.terrain = tile.terrain === 'water' ? 'water' : 'river';
      tile.riverEdges = mergeMask(tile.riverEdges, normalizeRiverPathMask(mask));
      tile.riverWaterless = options.waterless ?? tile.riverWaterless;
      tile.riverCurvy = options.curvy ?? tile.riverCurvy;
      tile.riverCrossing = options.crossing ?? tile.riverCrossing;
      updateTags(tile);
    }
    return this;
  }

  addMountainStack(options: MountainStackOptions): this {
    const tile = this.requireTile(options.at);
    const height = normalizeElevation(options.height);
    const variant = options.variant ?? 'A';
    tile.terrain = 'mountain';
    tile.elevation = height;
    tile.baseAssetId = 'hex_grass';
    updateTags(tile);

    this.addPlacement({
      at: options.at,
      assetId: mountainAssetId(variant, {
        withGrass: options.withGrass ?? true,
        withTrees: options.withTrees ?? false,
      }),
      kind: 'decoration',
      layer: 'feature',
      rotationSteps: options.rotationSteps,
      scale: options.scale,
      stackIndex: height,
      metadata: { feature: 'mountain-stack', height, variant },
    });
    return this;
  }

  addHill(
    coordinates: HexCoordinates,
    options: { variant?: HillVariant; withTrees?: boolean; single?: boolean; rotationSteps?: number } = {}
  ): this {
    const tile = this.requireTile(coordinates);
    tile.terrain = 'hill';
    updateTags(tile);
    const variant = options.variant ?? 'A';
    const assetId = options.single
      ? `hill_single_${variant}`
      : `hills_${variant}${options.withTrees ? '_trees' : ''}`;
    this.addPlacement({
      at: coordinates,
      assetId,
      kind: 'decoration',
      layer: 'feature',
      rotationSteps: options.rotationSteps,
      metadata: { feature: 'hill', variant, single: options.single ?? false },
    });
    return this;
  }

  addForest(
    coordinates: HexCoordinates,
    options: { species?: 'A' | 'B'; size?: 'small' | 'medium' | 'large'; cut?: boolean } = {}
  ): this {
    const tile = this.requireTile(coordinates);
    tile.terrain = 'forest';
    updateTags(tile);
    const species = options.species ?? 'A';
    const size = options.size ?? 'medium';
    const assetId = options.cut ? `trees_${species}_cut` : `trees_${species}_${size}`;
    this.addPlacement({
      at: coordinates,
      assetId,
      kind: 'decoration',
      layer: 'feature',
      rotationSteps: this.randomRotationSteps(),
      metadata: { feature: 'forest', species, size, cut: options.cut ?? false },
    });
    return this;
  }

  addSettlement(options: SettlementOptions): this {
    return this.addFactionBuilding(options);
  }

  addFactionBuilding(options: FactionBuildingOptions): this {
    const assetId = factionBuildingAssetId(options.building, options.faction);
    this.addPlacement({
      at: options.at,
      assetId,
      kind: 'structure',
      layer: 'structure',
      rotationSteps: options.rotationSteps,
      scale: options.scale,
      metadata: { feature: 'settlement', faction: options.faction, building: options.building },
    });
    return this;
  }

  addNeutralStructure(options: NeutralStructureOptions): this {
    this.addPlacement({
      at: options.at,
      assetId: options.structure,
      kind: 'structure',
      layer: 'structure',
      rotationSteps: options.rotationSteps,
      scale: options.scale,
      metadata: { feature: 'neutral-structure', structure: options.structure },
    });
    return this;
  }

  addNature(options: NaturePlacementOptions): this {
    this.addPlacement({
      at: options.at,
      assetId: options.assetId,
      kind: 'decoration',
      layer: 'feature',
      rotationSteps: options.rotationSteps,
      scale: options.scale,
      metadata: { feature: 'nature', assetId: options.assetId },
    });
    return this;
  }

  addProp(options: PropPlacementOptions): this {
    this.addPlacement({
      at: options.at,
      assetId: options.assetId,
      kind: 'prop',
      layer: 'feature',
      rotationSteps: options.rotationSteps,
      scale: options.scale,
      metadata: { feature: 'prop', assetId: options.assetId },
    });
    return this;
  }

  addFlag(at: HexCoordinates, faction: Faction, options: { rotationSteps?: number; scale?: number } = {}): this {
    return this.addProp({
      at,
      assetId: flagAssetId(faction),
      rotationSteps: options.rotationSteps,
      scale: options.scale,
    });
  }

  addTransition(options: TransitionPlacementOptions): this {
    this.addPlacement({
      at: options.at,
      assetId: 'hex_transition',
      kind: 'transition',
      layer: 'surface',
      rotationSteps: options.rotationSteps,
      elevationOffset: 0.04,
      requiresExtra: true,
      metadata: { feature: 'transition', from: options.from, to: options.to },
    });
    return this;
  }

  addUnit(options: UnitPlacementOptions): this {
    const assetId =
      options.neutral || !options.faction
        ? neutralUnitAssetId(options.part as NeutralUnitPart)
        : coloredUnitAssetId(options.part as ColoredUnitPart, options.faction, options.style ?? 'full');
    this.addPlacement({
      at: options.at,
      assetId,
      kind: 'unit',
      layer: 'unit',
      rotationSteps: options.rotationSteps,
      elevationOffset: 0.08,
      scale: options.scale,
      requiresExtra: true,
      metadata: {
        feature: 'unit',
        part: options.part,
        faction: options.faction ?? null,
        style: options.neutral ? 'neutral' : (options.style ?? 'full'),
        unitCompositeId: options.compositeId ?? null,
      },
    });
    return this;
  }

  addUnitPreset(options: UnitPresetOptions): this {
    const style = options.style ?? 'full';
    const compositeId = `unit:${hexKey(options.at)}:${options.faction}:${options.role}:${style}:${this.customPlacements.length}`;
    const add = (part: ColoredUnitPart | NeutralUnitPart, offset: number, neutral = false) => {
      this.addUnit({
        at: options.at,
        part,
        faction: options.faction,
        style,
        neutral,
        compositeId,
        rotationSteps: (options.rotationSteps ?? 0) + offset,
        scale: 1,
      });
    };

    add('unit', 0);
    switch (options.role) {
      case 'worker':
        add('shovel', 0, true);
        break;
      case 'soldier':
        add('sword', 0);
        add('shield', 0);
        add('helmet', 0);
        break;
      case 'archer':
        add('bow', 0);
        add('projectile_arrow', 0);
        break;
      case 'cavalry':
        add('horse', 0);
        add('spear', 0);
        break;
      case 'merchant':
        add('cart_merchant', 0);
        break;
      case 'siege':
        add('catapult', 0);
        break;
      case 'ship':
        add('ship', 0);
        break;
    }
    return this;
  }

  addHarbor(options: HarborOptions): this {
    const tile = this.requireTile(options.at);
    const water = neighbor(options.at, options.facing);
    tile.terrain = 'coast';
    tile.coastEdges = mergeMask(tile.coastEdges, 1 << options.facing);
    updateTags(tile);

    if (this.tiles.has(hexKey(water))) {
      this.setTerrain(water, 'water');
    }

    const kind = options.kind ?? 'docks';
    const assetId =
      kind === 'watermill'
        ? `building_watermill_${options.faction}`
        : `${EXTRA_HARBOR_ASSETS[kind]}_${options.faction}`;
    this.addPlacement({
      at: options.at,
      assetId,
      kind: 'structure',
      layer: 'structure',
      rotationSteps: options.rotationSteps ?? options.facing,
      metadata: { feature: 'harbor', harborKind: kind, faction: options.faction, facing: options.facing },
    });

    if (options.includeProps ?? true) {
      this.addWaterProp(water, 'boat', options.facing);
      this.addWaterProp(water, 'anchor', options.facing + 1);
    }
    return this;
  }

  scatterDecorations(options: ScatterDecorationOptions): this {
    const terrains = new Set(
      Array.isArray(options.terrain)
        ? options.terrain
        : [options.terrain ?? ('grass' satisfies GameboardTerrain)]
    );
    const occupied = new Set(this.customPlacements.map((placement) => placement.tileKey));
    const candidates = [...this.tiles.values()].filter((tile) => {
      if (!terrains.has(tile.terrain)) {
        return false;
      }
      return !(options.avoidOccupied ?? true) || !occupied.has(tile.key);
    });

    const count = Math.min(options.count, candidates.length);
    for (let index = 0; index < count; index += 1) {
      const candidateIndex = Math.floor(this.rng() * candidates.length);
      const [tile] = candidates.splice(candidateIndex, 1);
      const assetId = options.assets[Math.floor(this.rng() * options.assets.length)];
      if (!tile || !assetId) {
        break;
      }
      this.addPlacement({
        at: tile.coordinates,
        assetId,
        kind: 'decoration',
        layer: 'feature',
        rotationSteps: this.randomRotationSteps(),
        scale: options.scale,
        metadata: { feature: 'scatter' },
      });
    }
    return this;
  }

  addPlacement(options: {
    at: HexCoordinates;
    assetId: string;
    kind: GameboardPlacementKind;
    layer: GameboardPlacementLayer;
    rotationSteps?: number;
    elevationOffset?: number;
    scale?: number;
    stackIndex?: number;
    requiresExtra?: boolean;
    metadata?: Readonly<Record<string, string | number | boolean | null>>;
  }): this {
    const tile = this.requireTile(options.at);
    const rotationSteps = normalizeRotationSteps(options.rotationSteps ?? 0);
    const elevationOffset = options.elevationOffset ?? 0;
    this.customPlacements.push({
      id: `${options.kind}:${tile.key}:${options.assetId}:${this.placementCursor}`,
      tileKey: tile.key,
      coordinates: tile.coordinates,
      position: axialToWorld(tile.coordinates, tile.elevation + elevationOffset),
      assetId: options.assetId,
      kind: options.kind,
      layer: options.layer,
      textureSet: tile.textureSet,
      elevation: tile.elevation,
      elevationOffset,
      rotationSteps,
      rotationRadians: rotationSteps * (Math.PI / 3),
      scale: options.scale ?? 1,
      order: 200_000 + this.placementCursor,
      stackIndex: options.stackIndex,
      requiresExtra: options.requiresExtra ?? requiresExtraAsset(options.assetId),
      metadata: options.metadata ?? {},
    });
    this.placementCursor += 1;
    return this;
  }

  build(): GameboardPlan {
    const tiles = [...this.tiles.values()].map(freezeTile);
    return createGameboardPlanFromTiles({
      seed: this.seed,
      shape: this.shape,
      textureSet: this.textureSet,
      tiles,
      warnings: [...this.warnings],
      placements: this.customPlacements,
    });
  }

  private requireTile(coordinates: HexCoordinates): MutableGameboardTileSpec {
    const key = hexKey(coordinates);
    const tile = this.tiles.get(key);
    if (!tile) {
      throw new Error(`No tile exists at ${key} for ${this.shape.kind} gameboard`);
    }
    return tile;
  }

  private addWaterProp(coordinates: HexCoordinates, assetId: string, rotationSteps: number): void {
    if (!this.tiles.has(hexKey(coordinates))) {
      this.warnings.push(`Skipped ${assetId}; adjacent water tile ${hexKey(coordinates)} is outside the board`);
      return;
    }
    this.addPlacement({
      at: coordinates,
      assetId,
      kind: 'prop',
      layer: 'feature',
      rotationSteps,
      metadata: { feature: 'harbor-prop' },
    });
  }

  private randomRotationSteps(): number {
    return Math.floor(this.rng() * 6);
  }
}

type MutableGameboardTileSpec = {
  -readonly [K in keyof GameboardTileSpec]: GameboardTileSpec[K] extends readonly string[]
    ? string[]
    : GameboardTileSpec[K];
};

export function createGameboardBuilder(options: GameboardPlanOptions): GameboardBuilder {
  return new GameboardBuilder(options);
}

export function createGameboardPlan(
  options: GameboardPlanOptions,
  configure?: (builder: GameboardBuilder) => void
): GameboardPlan {
  const builder = createGameboardBuilder(options);
  configure?.(builder);
  return builder.build();
}

export function createGameboardPlanFromTiles(options: GameboardPlanFromTilesOptions): GameboardPlan {
  const terrainPlacements = options.tiles.flatMap((tile, index) => terrainPlacementsForTile(tile, index));
  const connectivityPlacements = options.tiles.flatMap((tile, index) => connectivityPlacementsForTile(tile, index));
  const placements = [...terrainPlacements, ...connectivityPlacements, ...(options.placements ?? [])].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id)
  );

  return {
    schemaVersion: GAMEBOARD_SCHEMA_VERSION,
    seed: options.seed,
    shape: options.shape,
    textureSet: options.textureSet ?? 'default',
    tiles: [...options.tiles],
    placements,
    warnings: [...(options.warnings ?? [])],
  };
}

export function createMedievalHarborBoard(options: MedievalHarborBoardOptions = {}): GameboardPlan {
  const shape = options.shape ?? { kind: 'rectangle', width: 8, height: 6 };
  const faction = options.faction ?? 'blue';
  const builder = createGameboardBuilder({
    seed: options.seed ?? 'medieval-harbor-board',
    shape,
    textureSet: options.textureSet,
    defaultTerrain: options.defaultTerrain,
  });

  if (shape.kind === 'hexagon') {
    return buildHexagonMedievalHarborBoard(builder, shape, faction);
  }

  const harbor = { q: Math.floor(shape.width / 2), r: shape.height - 2 };
  const town = { q: harbor.q, r: Math.max(1, harbor.r - 2) };

  for (let q = 0; q < shape.width; q += 1) {
    builder.setTerrain({ q, r: shape.height - 1 }, 'water');
    builder.setCoastEdges({ q, r: shape.height - 2 }, [1]);
  }

  builder
    .addHarbor({ at: harbor, facing: 1, faction, kind: 'shipyard', includeProps: true })
    .addSettlement({ at: town, faction, building: 'townhall' })
    .addSettlement({ at: { q: town.q - 1, r: town.r }, faction, building: 'market', rotationSteps: 5 })
    .addSettlement({ at: { q: town.q + 1, r: town.r }, faction, building: 'home_A', rotationSteps: 1 })
    .addRoadPath([town, { q: town.q, r: town.r + 1 }, harbor])
    .addRiverPath(
      [
        { q: 1, r: 0 },
        { q: 1, r: 1 },
        { q: 2, r: 1 },
        { q: 2, r: 2 },
        { q: 2, r: 3 },
        { q: 3, r: 3 },
        { q: 3, r: 4 },
      ],
      { curvy: true }
    )
    .addMountainStack({ at: { q: 0, r: 0 }, height: 2, variant: 'A', withTrees: true })
    .addMountainStack({ at: { q: 1, r: 0 }, height: 1, variant: 'B', withGrass: true })
    .addHill({ q: shape.width - 2, r: 1 }, { variant: 'C', withTrees: true })
    .addForest({ q: shape.width - 1, r: 0 }, { species: 'B', size: 'large' })
    .scatterDecorations({
      count: 8,
      terrain: ['grass', 'forest', 'hill'],
      assets: ['tree_single_A', 'tree_single_B', 'rock_single_A', 'rock_single_C', 'crate_A_small'],
    });

  return builder.build();
}

function buildHexagonMedievalHarborBoard(
  builder: GameboardBuilder,
  shape: Extract<GameboardShape, { kind: 'hexagon' }>,
  faction: Faction
): GameboardPlan {
  const coordinates = coordinatesForShape(shape);
  const keys = new Set(coordinates.map(hexKey));
  const maxR = Math.max(...coordinates.map((coordinate) => coordinate.r));
  const waterTiles = coordinates.filter((coordinate) => coordinate.r === maxR);
  const waterKeys = new Set(waterTiles.map(hexKey));

  for (const water of waterTiles) {
    builder.setTerrain(water, 'water');
  }

  const coastTiles = coordinates
    .filter((coordinate) => !waterKeys.has(hexKey(coordinate)))
    .map((coordinate) => ({ coordinate, waterEdges: waterEdgesFor(coordinate, waterKeys) }))
    .filter((coast) => coast.waterEdges.length > 0)
    .sort((left, right) => Math.abs(left.coordinate.q) - Math.abs(right.coordinate.q) || left.coordinate.q - right.coordinate.q);

  for (const coast of coastTiles) {
    builder.setCoastEdges(coast.coordinate, coast.waterEdges);
  }

  const harborSite = coastTiles[0];
  const harbor = harborSite?.coordinate ?? { q: 0, r: Math.max(0, shape.radius - 1) };
  const harborFacing = harborSite?.waterEdges[0] ?? 1;
  const inlandEdge = oppositeEdge(harborFacing);
  const town = firstExistingCoordinate(
    keys,
    [neighbor(neighbor(harbor, inlandEdge), inlandEdge), neighbor(harbor, inlandEdge), { q: 0, r: 0 }],
    waterKeys
  );
  const market = firstExistingCoordinate(keys, [neighbor(town, 3), neighbor(town, 4), neighbor(town, 2)], waterKeys);
  const home = firstExistingCoordinate(keys, [neighbor(town, 0), neighbor(town, 5), neighbor(town, 1)], waterKeys);
  const top = [...coordinates]
    .filter((coordinate) => !waterKeys.has(hexKey(coordinate)))
    .sort((left, right) => left.r - right.r || left.q - right.q)[0] ?? { q: 0, r: -shape.radius };
  const topRight = [...coordinates]
    .filter((coordinate) => !waterKeys.has(hexKey(coordinate)))
    .sort((left, right) => right.q - left.q || left.r - right.r)[0] ?? top;
  const topLeft = [...coordinates]
    .filter((coordinate) => !waterKeys.has(hexKey(coordinate)))
    .sort((left, right) => left.q - right.q || left.r - right.r)[0] ?? top;

  builder
    .addHarbor({ at: harbor, facing: harborFacing, faction, kind: 'shipyard', includeProps: true })
    .addSettlement({ at: town, faction, building: 'townhall' })
    .addSettlement({ at: market, faction, building: 'market', rotationSteps: 5 })
    .addSettlement({ at: home, faction, building: 'home_A', rotationSteps: 1 })
    .addRoadPath(hexLine(town, harbor))
    .addRiverPath(hexLine(top, neighbor(town, 3)).filter((coordinate) => keys.has(hexKey(coordinate))), { curvy: true })
    .addMountainStack({ at: topLeft, height: 2, variant: 'A', withTrees: true })
    .addMountainStack({ at: top, height: 1, variant: 'B', withGrass: true })
    .addHill(topRight, { variant: 'C', withTrees: true })
    .addForest(firstExistingCoordinate(keys, [neighbor(topLeft, 1), neighbor(topLeft, 0), neighbor(town, 4)], waterKeys), {
      species: 'B',
      size: 'large',
    })
    .scatterDecorations({
      count: Math.max(6, Math.floor(coordinates.length / 6)),
      terrain: ['grass', 'forest', 'hill'],
      assets: ['tree_single_A', 'tree_single_B', 'rock_single_A', 'rock_single_C', 'crate_A_small'],
    });

  return builder.build();
}

export { HEX_DIRECTIONS, coordinatesForShape, edgeBetween, hexKey, neighbor, oppositeEdge, parseHexKey };
export type { GameboardShape };

export function getPlacementAsset(
  placement: Pick<GameboardPlacementSpec, 'assetId'>,
  manifest = freeManifest
): MedievalHexagonAsset | undefined {
  return manifest.assetsById[placement.assetId];
}

export function requiresExtraAsset(assetId: string): boolean {
  return !freeManifest.assetsById[assetId];
}

function createTile(
  coordinates: HexCoordinates,
  terrain: Extract<GameboardTerrain, 'grass' | 'water'>,
  textureSet: TextureSet
): MutableGameboardTileSpec {
  const tile: MutableGameboardTileSpec = {
    key: hexKey(coordinates),
    coordinates,
    terrain,
    textureSet,
    elevation: 0,
    baseAssetId: TERRAIN_ASSETS[terrain],
    supportAssetId: 'hex_grass_bottom',
    roadEdges: 0,
    riverEdges: 0,
    coastEdges: 0,
    riverWaterless: false,
    riverCurvy: false,
    coastWaterless: false,
    tags: [],
  };
  updateTags(tile);
  return tile;
}

function updateTags(tile: MutableGameboardTileSpec, extraTags: readonly string[] = []): void {
  const tags = new Set<string>([tile.terrain]);
  for (const tag of extraTags) {
    tags.add(tag);
  }
  if (tile.elevation > 0) {
    tags.add('elevated');
  }
  if (tile.roadEdges !== 0) {
    tags.add('road');
  }
  if (tile.riverEdges !== 0 || tile.riverCrossing) {
    tags.add('river');
  }
  if (tile.coastEdges !== 0) {
    tags.add('coast');
  }
  tile.tags = [...tags].sort();
}

function freezeTile(tile: MutableGameboardTileSpec): GameboardTileSpec {
  return {
    ...tile,
    coordinates: { ...tile.coordinates },
    tags: [...tile.tags],
  };
}

function terrainPlacementsForTile(tile: GameboardTileSpec, tileIndex: number): GameboardPlacementSpec[] {
  const placements: GameboardPlacementSpec[] = [];
  for (let level = 0; level < tile.elevation; level += 1) {
    placements.push(
      basePlacement(tile, {
        id: `terrain:${tile.key}:support:${level}`,
        assetId: tile.supportAssetId,
        order: tileIndex * 10 + level,
        elevation: level,
        stackIndex: level,
      })
    );
  }
  placements.push(
    basePlacement(tile, {
      id: `terrain:${tile.key}:top`,
      assetId: tile.baseAssetId,
      order: tileIndex * 10 + tile.elevation,
      elevation: tile.elevation,
      stackIndex: tile.elevation,
    })
  );
  return placements;
}

function connectivityPlacementsForTile(
  tile: GameboardTileSpec,
  tileIndex: number
): GameboardPlacementSpec[] {
  const placements: GameboardPlacementSpec[] = [];
  const baseOrder = 100_000 + tileIndex * 10;

  if (tile.coastEdges !== 0) {
    const selection = selectCoastVariant(tile.coastEdges, { waterless: tile.coastWaterless });
    placements.push(
      overlayPlacement(tile, {
        id: `coast:${tile.key}`,
        assetId: selection.assetId,
        kind: 'coast',
        layer: 'surface',
        order: baseOrder,
        rotationSteps: selection.rotationSteps,
        metadata: { edgeMask: tile.coastEdges },
      })
    );
  }

  if (tile.riverEdges !== 0 || tile.riverCrossing) {
    const selection = tile.riverCrossing
      ? selectRiverCrossingVariant(tile.riverCrossing, { waterless: tile.riverWaterless })
      : selectRiverVariant(tile.riverEdges, {
          waterless: tile.riverWaterless,
          curvy: tile.riverCurvy,
        });
    placements.push(
      overlayPlacement(tile, {
        id: `river:${tile.key}`,
        assetId: selection.assetId,
        kind: 'river',
        layer: 'surface',
        order: baseOrder + 1,
        rotationSteps: selection.rotationSteps,
        metadata: { edgeMask: tile.riverEdges },
      })
    );
  }

  if (tile.roadEdges !== 0) {
    const selection = selectRoadVariant(tile.roadEdges);
    const assetId =
      selection.label === 'A' && tile.roadSlope
        ? `hex_road_A_sloped_${tile.roadSlope}`
        : selection.assetId;
    placements.push(
      overlayPlacement(tile, {
        id: `road:${tile.key}`,
        assetId,
        kind: 'road',
        layer: 'surface',
        order: baseOrder + 2,
        rotationSteps: selection.rotationSteps,
        metadata: { edgeMask: tile.roadEdges, slope: tile.roadSlope ?? null },
      })
    );
  }

  return placements;
}

function basePlacement(
  tile: GameboardTileSpec,
  options: {
    id: string;
    assetId: string;
    order: number;
    elevation: number;
    stackIndex?: number;
  }
): GameboardPlacementSpec {
  return {
    id: options.id,
    tileKey: tile.key,
    coordinates: tile.coordinates,
    position: axialToWorld(tile.coordinates, options.elevation),
    assetId: options.assetId,
    kind: 'terrain',
    layer: 'terrain',
    textureSet: tile.textureSet,
    elevation: options.elevation,
    elevationOffset: 0,
    rotationSteps: 0,
    rotationRadians: 0,
    scale: 1,
    order: options.order,
    stackIndex: options.stackIndex,
    requiresExtra: requiresExtraAsset(options.assetId),
    metadata: {},
  };
}

function overlayPlacement(
  tile: GameboardTileSpec,
  options: {
    id: string;
    assetId: string;
    kind: GameboardPlacementKind;
    layer: GameboardPlacementLayer;
    order: number;
    rotationSteps: number;
    metadata: Readonly<Record<string, string | number | boolean | null>>;
  }
): GameboardPlacementSpec {
  const rotationSteps = normalizeRotationSteps(options.rotationSteps);
  const elevationOffset = surfaceElevationOffset(options.kind);
  return {
    id: options.id,
    tileKey: tile.key,
    coordinates: tile.coordinates,
    position: axialToWorld(tile.coordinates, tile.elevation + elevationOffset),
    assetId: options.assetId,
    kind: options.kind,
    layer: options.layer,
    textureSet: tile.textureSet,
    elevation: tile.elevation,
    elevationOffset,
    rotationSteps,
    rotationRadians: rotationSteps * (Math.PI / 3),
    scale: 1,
    order: options.order,
    requiresExtra: requiresExtraAsset(options.assetId),
    metadata: options.metadata,
  };
}

function surfaceElevationOffset(kind: GameboardPlacementKind): number {
  switch (kind) {
    case 'coast':
      return 0.01;
    case 'river':
      return 0.02;
    case 'road':
      return 0.03;
    default:
      return 0;
  }
}

function pathMasks(path: readonly HexCoordinates[]): Map<string, number> {
  const masks = new Map<string, number>();
  for (let index = 0; index < path.length - 1; index += 1) {
    const current = path[index];
    const next = path[index + 1];
    const edge = edgeBetween(current, next);
    if (edge === undefined) {
      throw new Error(`Path step ${hexKey(current)} -> ${hexKey(next)} is not adjacent`);
    }
    masks.set(hexKey(current), mergeMask(masks.get(hexKey(current)) ?? 0, 1 << edge));
    masks.set(hexKey(next), mergeMask(masks.get(hexKey(next)) ?? 0, 1 << oppositeEdge(edge)));
  }
  return masks;
}

function mergeMask(current: number, next: number): number {
  return (current | next) & 0b111111;
}

function normalizeRiverPathMask(mask: number): number {
  if (bitCount(mask) !== 1) {
    return mask;
  }
  const edge = edgeFromSingleBit(mask);
  return mergeMask(mask, 1 << oppositeEdge(edge));
}

function bitCount(mask: number): number {
  let count = 0;
  for (let edge = 0; edge < 6; edge += 1) {
    if ((mask & (1 << edge)) !== 0) {
      count += 1;
    }
  }
  return count;
}

function edgeFromSingleBit(mask: number): HexEdgeIndex {
  for (let edge = 0; edge < 6; edge += 1) {
    if ((mask & (1 << edge)) !== 0) {
      return edge as HexEdgeIndex;
    }
  }
  throw new Error('Expected a single-edge mask');
}

function waterEdgesFor(coordinates: HexCoordinates, waterKeys: ReadonlySet<string>): HexEdgeIndex[] {
  return EDGE_INDEXES.filter((edge) => waterKeys.has(hexKey(neighbor(coordinates, edge))));
}

function firstExistingCoordinate(
  keys: ReadonlySet<string>,
  candidates: readonly HexCoordinates[],
  excludedKeys: ReadonlySet<string> = new Set()
): HexCoordinates {
  const coordinate = candidates.find((candidate) => keys.has(hexKey(candidate)) && !excludedKeys.has(hexKey(candidate)));
  if (!coordinate) {
    throw new Error('No available coordinate exists for the requested board feature');
  }
  return coordinate;
}

function mountainAssetId(
  variant: MountainVariant,
  options: { withGrass: boolean; withTrees: boolean }
): string {
  if (options.withTrees) {
    return `mountain_${variant}_grass_trees`;
  }
  if (options.withGrass) {
    return `mountain_${variant}_grass`;
  }
  return `mountain_${variant}`;
}

function normalizeElevation(elevation: number): number {
  return Math.max(0, Math.floor(elevation));
}

function normalizeRotationSteps(steps: number): number {
  return ((Math.floor(steps) % 6) + 6) % 6;
}
