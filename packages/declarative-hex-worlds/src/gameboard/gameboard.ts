/**
 * Serializable board-plan primitives for tiles, terrain stacks, roads, rivers,
 * coasts, placements, deterministic builders, and validation-ready snapshots.
 *
 * @module
 */
import seedrandom from 'seedrandom';
import { GameboardRuntimeError } from '../errors';
import {
  coloredUnitAssetId,
  factionBuildingAssetId,
  flagAssetId,
  neutralUnitAssetId,
  type ColoredUnitPart,
  type NeutralStructureKind,
  type NeutralUnitPart,
} from '../scenario';
import {
  HEX_DIRECTIONS,
  coordinatesForShape,
  edgeBetween,
  hexLine,
  hexKey,
  neighbor,
  oppositeEdge,
  parseHexKey,
} from '../coordinates';
import { axialToWorld } from '../coordinates';
import { assertCoverableCoastMask, edgeMask } from '../selectors';
import type {
  Faction,
  GameboardShape,
  HexCoordinates,
  HexEdgeIndex,
  TextureSet,
} from '../types';
import type {
  BridgeOptions,
  ConstructionSiteKind,
  ConstructionSiteOptions,
  ElevationRampOptions,
  FactionBuildingOptions,
  FortificationMaterial,
  FortificationOptions,
  FortificationSegment,
  GameboardPlacementKind,
  GameboardPlacementLayer,
  GameboardPlacementSpec,
  GameboardPlan,
  GameboardPlanOptions,
  GameboardTerrain,
  HarborBoardOptions,
  HarborKind,
  HarborOptions,
  HillVariant,
  MountainStackOptions,
  MountainVariant,
  NaturePlacementOptions,
  NeutralStructureOptions,
  PropClusterPlacement,
  PropClusterOptions,
  PropPlacementOptions,
  ScatterDecorationOptions,
  SettlementOptions,
  SiegeProjectileKind,
  SiegeProjectileOptions,
  TileAssetOptions,
  TransitionPlacementOptions,
  UnitPlacementOptions,
  UnitPresetOptions,
} from './plan';
import { listPropClusterAssets, requiresExtraAsset } from './assets';
import {
  createGameboardPlanFromTiles,
  createGameboardTile,
  freezeGameboardTile,
  GAMEBOARD_TERRAIN_ASSETS,
  updateGameboardTileTags,
  type MutableGameboardTileSpec,
} from './terrain';

export {
  getPlacementAsset,
  listPropClusterAssets,
  loadPlacementAsset,
  requiresExtraAsset,
} from './assets';
export { createGameboardPlanFromTiles } from './terrain';

const DEFAULT_SEED = 'declarative-hex-worlds';
const EDGE_INDEXES = [0, 1, 2, 3, 4, 5] as const satisfies readonly HexEdgeIndex[];
const EXTRA_HARBOR_ASSETS: Record<Exclude<HarborKind, 'watermill'>, string> = {
  docks: 'building_docks',
  shipyard: 'building_shipyard',
};

/**
 * Fluent builder for deterministic gameboard plans using KayKit guide variants,
 * stacked terrain, roads, rivers, harbors, settlements, props, and EXTRA units.
 */
export class GameboardBuilder {
  /** Seed used by deterministic builder helpers. */
  readonly seed: string;
  /** Shape populated by this builder. */
  readonly shape: GameboardShape;
  /** Texture set applied to generated terrain. */
  readonly textureSet: TextureSet;
  private readonly rng: seedrandom.PRNG;
  private readonly tiles = new Map<string, MutableGameboardTileSpec>();
  private readonly customPlacements: GameboardPlacementSpec[] = [];
  private readonly warnings: string[] = [];
  private placementCursor = 0;

  /**
   * Create a builder and initialize all tiles in the requested shape.
   */
  constructor(options: GameboardPlanOptions) {
    this.seed = String(options.seed ?? DEFAULT_SEED);
    this.shape = options.shape;
    this.textureSet = options.textureSet ?? 'default';
    this.rng = seedrandom(this.seed);

    const defaultTerrain = options.defaultTerrain ?? 'grass';
    for (const coordinates of coordinatesForShape(options.shape)) {
      this.tiles.set(hexKey(coordinates), createGameboardTile(coordinates, defaultTerrain, this.textureSet));
    }
  }

  /**
   * Set a base grass or water terrain tile.
   */
  setTerrain(
    coordinates: HexCoordinates,
    terrain: Extract<GameboardTerrain, 'grass' | 'water'>,
    options: { elevation?: number; baseAssetId?: string; textureSet?: TextureSet } = {}
  ): this {
    const tile = this.requireTile(coordinates);
    tile.terrain = terrain;
    tile.baseAssetId = options.baseAssetId ?? GAMEBOARD_TERRAIN_ASSETS[terrain];
    tile.elevation = normalizeElevation(options.elevation ?? tile.elevation);
    tile.textureSet = options.textureSet ?? tile.textureSet;
    updateGameboardTileTags(tile);
    return this;
  }

  /**
   * Override a tile's base asset, terrain, elevation, connectivity, and tags.
   */
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
    tile.textureSet = options.textureSet ?? tile.textureSet;
    updateGameboardTileTags(tile, options.tags);
    return this;
  }

  /**
   * Set the texture set for an existing tile without changing its terrain.
   */
  setTextureSet(coordinates: HexCoordinates, textureSet: TextureSet): this {
    const tile = this.requireTile(coordinates);
    tile.textureSet = textureSet;
    return this;
  }

  /**
   * Set the elevation for an existing tile.
   */
  setElevation(coordinates: HexCoordinates, elevation: number): this {
    const tile = this.requireTile(coordinates);
    tile.elevation = normalizeElevation(elevation);
    updateGameboardTileTags(tile);
    return this;
  }

  /**
   * Mark a tile as coast and set the edges that face water.
   */
  setCoastEdges(
    coordinates: HexCoordinates,
    waterEdges: readonly HexEdgeIndex[] | number,
    options: { waterless?: boolean } = {}
  ): this {
    const tile = this.requireTile(coordinates);
    // Validate at author time: a non-contiguous mask has no coast tile and would
    // otherwise throw far away in projection. Fail here, naming the tile.
    assertCoverableCoastMask(waterEdges, { tileKey: tile.key });
    tile.terrain = 'coast';
    tile.coastEdges = edgeMask(waterEdges);
    tile.coastWaterless = options.waterless ?? false;
    updateGameboardTileTags(tile);
    return this;
  }

  /**
   * Add road connectivity along a coordinate path.
   */
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
      updateGameboardTileTags(tile);
    }
    return this;
  }

  /**
   * Add river connectivity along a coordinate path.
   */
  addRiverPath(
    path: readonly HexCoordinates[],
    options: { waterless?: boolean; curvy?: boolean; crossing?: 'A' | 'B' } = {}
  ): this {
    const masks = pathMasks(path);
    for (const [key, mask] of masks) {
      const tile = this.requireTile(parseHexKey(key));
      tile.terrain = tile.terrain === 'water' ? 'water' : 'river';
      tile.riverEdges = mergeMask(tile.riverEdges, mask);
      tile.riverWaterless = options.waterless ?? tile.riverWaterless;
      tile.riverCurvy = options.curvy ?? tile.riverCurvy;
      tile.riverCrossing = options.crossing ?? tile.riverCrossing;
      updateGameboardTileTags(tile);
    }
    return this;
  }

  /**
   * Add an elevated mountain tile plus a visible mountain-stack placement.
   */
  addMountainStack(options: MountainStackOptions): this {
    const tile = this.requireTile(options.at);
    const height = normalizeElevation(options.height);
    const variant = options.variant ?? 'A';
    tile.terrain = 'mountain';
    tile.elevation = height;
    tile.baseAssetId = 'hex_grass';
    updateGameboardTileTags(tile);

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

  /**
   * Add a hill decoration and mark the tile as hill terrain.
   */
  addHill(
    coordinates: HexCoordinates,
    options: { variant?: HillVariant; withTrees?: boolean; single?: boolean; rotationSteps?: number } = {}
  ): this {
    const tile = this.requireTile(coordinates);
    tile.terrain = 'hill';
    updateGameboardTileTags(tile);
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

  /**
   * Add a forest decoration and mark the tile as forest terrain.
   */
  addForest(
    coordinates: HexCoordinates,
    options: { species?: 'A' | 'B'; size?: 'small' | 'medium' | 'large'; cut?: boolean } = {}
  ): this {
    const tile = this.requireTile(coordinates);
    tile.terrain = 'forest';
    updateGameboardTileTags(tile);
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

  /**
   * Add a settlement building. Alias for `addFactionBuilding`.
   */
  addSettlement(options: SettlementOptions): this {
    return this.addFactionBuilding(options);
  }

  /**
   * Add a faction building structure placement.
   */
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

  /**
   * Add a neutral structure placement.
   */
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

  /**
   * Add a bridge structure with bridge-specific metadata instead of requiring
   * callers to know the raw neutral-structure asset ids.
   */
  addBridge(options: BridgeOptions): this {
    const variant = options.variant ?? 'A';
    this.addPlacement({
      at: options.at,
      assetId: `building_bridge_${variant}`,
      kind: 'structure',
      layer: 'structure',
      rotationSteps: options.rotationSteps ?? options.facing,
      scale: options.scale,
      metadata: {
        feature: 'bridge',
        bridgeVariant: variant,
        facing: options.facing ?? null,
      },
    });
    return this;
  }

  /**
   * Add a wall or fence segment with fortification metadata.
   */
  addFortification(options: FortificationOptions): this {
    const material = options.material ?? 'wall';
    const segment = options.segment ?? 'straight';
    const assetId = fortificationAssetId(material, segment);
    this.addPlacement({
      at: options.at,
      assetId,
      kind: 'structure',
      layer: 'structure',
      rotationSteps: options.rotationSteps ?? options.facing,
      scale: options.scale,
      metadata: {
        feature: 'fortification',
        material,
        segment,
        facing: options.facing ?? null,
        enclosureId: options.enclosureId ?? null,
      },
    });
    return this;
  }

  /**
   * Add a construction, ruin, or worksite structure with construction metadata.
   */
  addConstructionSite(options: ConstructionSiteOptions): this {
    const kind = options.kind ?? 'stage-A';
    this.addPlacement({
      at: options.at,
      assetId: constructionSiteAssetId(kind),
      kind: 'structure',
      layer: 'structure',
      rotationSteps: options.rotationSteps,
      scale: options.scale,
      metadata: {
        feature: 'construction-site',
        constructionKind: kind,
        constructionId: options.constructionId ?? null,
      },
    });
    return this;
  }

  /**
   * Add a neutral siege projectile with projectile-specific metadata.
   */
  addSiegeProjectile(options: SiegeProjectileOptions): this {
    const kind = options.kind ?? 'catapult';
    this.addPlacement({
      at: options.at,
      assetId: siegeProjectileAssetId(kind),
      kind: 'structure',
      layer: 'structure',
      rotationSteps: options.rotationSteps ?? options.facing,
      scale: options.scale,
      metadata: {
        feature: 'siege-projectile',
        projectileKind: kind,
        facing: options.facing ?? null,
        sourceId: options.sourceId ?? null,
      },
    });
    return this;
  }

  /**
   * Add a sloped grass ramp with ramp-specific metadata instead of requiring
   * callers to place `hex_grass_sloped_high` or `hex_grass_sloped_low` directly.
   */
  addElevationRamp(options: ElevationRampOptions): this {
    const tile = this.requireTile(options.at);
    if (options.textureSet) {
      tile.textureSet = options.textureSet;
    }
    const direction = options.direction ?? 'up';
    const fromElevation = options.fromElevation ?? tile.elevation;
    const toElevation = options.toElevation ?? (direction === 'up' ? fromElevation + 1 : Math.max(0, fromElevation - 1));
    this.addPlacement({
      at: options.at,
      assetId: direction === 'up' ? 'hex_grass_sloped_high' : 'hex_grass_sloped_low',
      kind: 'transition',
      layer: 'surface',
      rotationSteps: options.rotationSteps ?? options.facing,
      elevationOffset: options.elevationOffset ?? 0.035,
      scale: options.scale,
      metadata: {
        feature: 'elevation-ramp',
        direction,
        facing: options.facing ?? null,
        fromElevation,
        toElevation,
        textureSet: tile.textureSet,
      },
    });
    return this;
  }

  /**
   * Add a nature decoration placement.
   */
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

  /**
   * Add a prop placement.
   */
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

  /**
   * Add a faction flag prop placement.
   */
  addFlag(at: HexCoordinates, faction: Faction, options: { rotationSteps?: number; scale?: number } = {}): this {
    return this.addProp({
      at,
      assetId: flagAssetId(faction),
      rotationSteps: options.rotationSteps,
      scale: options.scale,
    });
  }

  /**
   * Add a semantic prop cluster such as a camp, worksite, stable yard, or cache.
   */
  addPropCluster(options: PropClusterOptions): this {
    const density = clampPercentage(options.density ?? 1);
    if (density <= 0) {
      return this;
    }
    const assets = listPropClusterAssets(options.kind, { includeExtra: options.includeExtra });
    const count = Math.max(1, Math.ceil(assets.length * density));
    const sites = propClusterSites(options.at, options.facing ?? 0, options.placement ?? 'adjacent');
    const baseRotation = options.rotationSteps ?? options.facing ?? 0;
    const clusterId = options.clusterId ?? `prop-cluster:${options.kind}:${hexKey(options.at)}:${this.customPlacements.length}`;

    for (let index = 0; index < count; index += 1) {
      const assetId = assets[index];
      const site = sites[index % sites.length];
      /* v8 ignore next 3 -- declared prop clusters have dense asset arrays and propClusterSites always returns at least one site. */
      if (!assetId || !site) {
        continue;
      }
      if (!this.tiles.has(hexKey(site))) {
        this.warnings.push(`Skipped ${assetId}; prop cluster tile ${hexKey(site)} is outside the board`);
        continue;
      }
      this.addPlacement({
        at: site,
        assetId,
        kind: 'prop',
        layer: 'feature',
        rotationSteps: baseRotation + index,
        scale: options.scale,
        metadata: {
          feature: 'prop-cluster',
          propClusterKind: options.kind,
          clusterId,
          anchor: hexKey(options.at),
          placement: options.placement ?? 'adjacent',
          includeExtra: options.includeExtra ?? false,
          density,
          propIndex: index,
        },
      });
    }
    return this;
  }

  /**
   * Add an EXTRA texture transition placement.
   */
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

  /**
   * Add one unit part placement from the EXTRA unit library.
   */
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

  /**
   * Add a predefined multi-part unit composition.
   */
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

  /**
   * Add a harbor structure, mark the coast/water relationship, and optionally
   * place adjacent water props.
   */
  addHarbor(options: HarborOptions): this {
    const tile = this.requireTile(options.at);
    const water = neighbor(options.at, options.facing);
    tile.terrain = 'coast';
    tile.coastEdges = mergeMask(tile.coastEdges, 1 << options.facing);
    updateGameboardTileTags(tile);

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

  /**
   * Scatter random decoration placements across matching terrain.
   */
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

  /**
   * Add a custom placement to the plan.
   */
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

  /**
   * Build an immutable gameboard plan from current builder state.
   */
  build(): GameboardPlan {
    const tiles = [...this.tiles.values()].map(freezeGameboardTile);
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
      throw new GameboardRuntimeError(`No tile exists at ${key} for ${this.shape.kind} gameboard`);
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

/**
 * Create a fluent gameboard builder.
 */
export function createGameboardBuilder(options: GameboardPlanOptions): GameboardBuilder {
  return new GameboardBuilder(options);
}

/**
 * Create a complete gameboard plan, optionally configuring it through a builder
 * callback before build.
 */
export function createGameboardPlan(
  options: GameboardPlanOptions,
  configure?: (builder: GameboardBuilder) => void
): GameboardPlan {
  const builder = createGameboardBuilder(options);
  configure?.(builder);
  return builder.build();
}

/**
 * Create the built-in medieval harbor sample board used by examples and tests.
 */
export function createHarborBoard(options: HarborBoardOptions = {}): GameboardPlan {
  const shape = options.shape ?? { kind: 'rectangle', width: 8, height: 6 };
  const faction = options.faction ?? 'blue';
  const builder = createGameboardBuilder({
    seed: options.seed ?? 'medieval-harbor-board',
    shape,
    textureSet: options.textureSet,
    defaultTerrain: options.defaultTerrain,
  });

  if (shape.kind === 'hexagon') {
    return buildHexagonHarborBoard(builder, shape, faction);
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
    .addPropCluster({
      at: { q: Math.max(0, town.q - 2), r: Math.min(shape.height - 2, town.r + 1) },
      kind: 'resource-cache',
      density: 0.6,
      facing: 1,
    })
    .scatterDecorations({
      count: 8,
      terrain: ['grass', 'forest', 'hill'],
      assets: ['tree_single_A', 'tree_single_B', 'rock_single_A', 'rock_single_C', 'crate_A_small'],
    });

  return builder.build();
}

function buildHexagonHarborBoard(
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
  /* v8 ignore next 3 -- after a hex harbor town site resolves, the non-water candidate set is non-empty. */
  const top = [...coordinates]
    .filter((coordinate) => !waterKeys.has(hexKey(coordinate)))
    .sort((left, right) => left.r - right.r || left.q - right.q)[0] ?? { q: 0, r: -shape.radius };
  /* v8 ignore next 3 -- covered by the same non-empty candidate invariant as top. */
  const topRight = [...coordinates]
    .filter((coordinate) => !waterKeys.has(hexKey(coordinate)))
    .sort((left, right) => right.q - left.q || left.r - right.r)[0] ?? top;
  /* v8 ignore next 3 -- covered by the same non-empty candidate invariant as top. */
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
    .addPropCluster({
      at: firstExistingCoordinate(keys, [neighbor(town, 2), neighbor(town, 3), market], waterKeys),
      kind: 'resource-cache',
      density: 0.5,
      facing: 2,
    })
    .scatterDecorations({
      count: Math.max(6, Math.floor(coordinates.length / 6)),
      terrain: ['grass', 'forest', 'hill'],
      assets: ['tree_single_A', 'tree_single_B', 'rock_single_A', 'rock_single_C', 'crate_A_small'],
    });

  return builder.build();
}

/**
 * Re-export frequently used coordinate helpers from the gameboard module.
 */
export { HEX_DIRECTIONS, coordinatesForShape, edgeBetween, hexKey, neighbor, oppositeEdge, parseHexKey };
/**
 * Board shape descriptor accepted by generated gameboard plans.
 */
export type { GameboardShape, HexagonGameboardShape, RectangleGameboardShape } from '../types';

function pathMasks(path: readonly HexCoordinates[]): Map<string, number> {
  const masks = new Map<string, number>();
  for (let index = 0; index < path.length - 1; index += 1) {
    const current = path[index];
    const next = path[index + 1];
    if (current === undefined || next === undefined) {
      throw new GameboardRuntimeError(`pathMasks index ${index} out of range`);
    }
    const edge = edgeBetween(current, next);
    if (edge === undefined) {
      throw new GameboardRuntimeError(`Path step ${hexKey(current)} -> ${hexKey(next)} is not adjacent`);
    }
    masks.set(hexKey(current), mergeMask(masks.get(hexKey(current)) ?? 0, 1 << edge));
    masks.set(hexKey(next), mergeMask(masks.get(hexKey(next)) ?? 0, 1 << oppositeEdge(edge)));
  }
  return masks;
}

function mergeMask(current: number, next: number): number {
  return (current | next) & 0b111111;
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
    throw new GameboardRuntimeError('No available coordinate exists for the requested board feature');
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

function fortificationAssetId(material: FortificationMaterial, segment: FortificationSegment): NeutralStructureKind {
  if (material === 'wall') {
    switch (segment) {
      case 'straight':
        return 'wall_straight';
      case 'straight-gate':
        return 'wall_straight_gate';
      case 'corner-A-gate':
        return 'wall_corner_A_gate';
      case 'corner-A-inside':
        return 'wall_corner_A_inside';
      case 'corner-A-outside':
        return 'wall_corner_A_outside';
      case 'corner-B-inside':
        return 'wall_corner_B_inside';
      case 'corner-B-outside':
        return 'wall_corner_B_outside';
      case 'gate':
        return 'wall_straight_gate';
    }
  }
  if (segment !== 'straight' && segment !== 'gate' && segment !== 'straight-gate') {
    throw new GameboardRuntimeError(`Fortification material ${material} does not support segment ${segment}`);
  }
  const fenceSegment = segment === 'straight' ? 'straight' : 'straight_gate';
  return `fence_${material === 'wood-fence' ? 'wood' : 'stone'}_${fenceSegment}` as NeutralStructureKind;
}

function constructionSiteAssetId(kind: ConstructionSiteKind): NeutralStructureKind {
  switch (kind) {
    case 'destroyed':
      return 'building_destroyed';
    case 'dirt':
      return 'building_dirt';
    case 'grain':
      return 'building_grain';
    case 'scaffolding':
      return 'building_scaffolding';
    case 'stage-A':
      return 'building_stage_A';
    case 'stage-B':
      return 'building_stage_B';
    case 'stage-C':
      return 'building_stage_C';
  }
}

function siegeProjectileAssetId(kind: SiegeProjectileKind): NeutralStructureKind {
  switch (kind) {
    case 'catapult':
      return 'projectile_catapult';
  }
}

function propClusterSites(
  at: HexCoordinates,
  facing: HexEdgeIndex,
  placement: PropClusterPlacement
): readonly HexCoordinates[] {
  if (placement === 'single') {
    return [at];
  }
  const edgeOrder = [0, 1, 5, 2, 4, 3] as const;
  return [
    at,
    ...edgeOrder.map((offset) => neighbor(at, normalizeRotationSteps(facing + offset) as HexEdgeIndex)),
  ];
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeElevation(elevation: number): number {
  return Math.max(0, Math.floor(elevation));
}

function normalizeRotationSteps(steps: number): number {
  return ((Math.floor(steps) % 6) + 6) % 6;
}
