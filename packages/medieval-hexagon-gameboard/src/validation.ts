import { hexKey, neighbor, oppositeEdge } from './coordinates';
import type { GameboardPlan, GameboardPlacementSpec, GameboardTileSpec } from './gameboard';
import { getManifestAsset, type ManifestAssetCatalog } from './manifest/schema';
import {
  gameboardPlacementBlocksOccupancy,
  gameboardPlacementFootprintKeys,
  gameboardPlacementOccupancyGroup,
} from './occupancy';
import type { HexTileDeclaration, HexTileRegistry } from './registry';
import { rotateMask } from './selectors';
import type { HexCoordinates } from './types';
import type { GameboardRuleConfig, GameboardRuleViolation } from './rule-types';

export interface GameboardPlanValidationConfig extends GameboardRuleConfig {
  registry?: HexTileRegistry;
  validateRegisteredDeclarations?: boolean;
  assetCatalog?: ManifestAssetCatalog;
  allowUnknownAssets?: boolean;
  allowUnknownAssetIds?: readonly string[];
  requireExtraAssetFlags?: boolean;
  validatePlacementFootprints?: boolean;
  validatePlacementBlockingOverlap?: boolean;
}

interface ChannelMaskSource {
  mask: number;
  sourceId: string;
  placementId?: string;
  declaration?: HexTileDeclaration;
  rotationSteps?: number;
}

const DEFAULT_PLAN_RULES = {
  maxElevation: 4,
  requireReciprocalRoads: true,
  requireReciprocalRivers: true,
  requireCoastsTouchWater: true,
  forbidStructuresOnWater: true,
  requireHarborsTouchWater: true,
  validateRegisteredDeclarations: true,
  allowUnknownAssets: false,
  requireExtraAssetFlags: true,
  validatePlacementFootprints: true,
  validatePlacementBlockingOverlap: true,
} satisfies Required<
  Omit<GameboardPlanValidationConfig, 'registry' | 'assetCatalog' | 'allowUnknownAssetIds'>
>;

interface NormalizedPlanRules
  extends Required<
      Omit<GameboardPlanValidationConfig, 'registry' | 'assetCatalog' | 'allowUnknownAssetIds'>
    >,
    Pick<GameboardPlanValidationConfig, 'assetCatalog' | 'allowUnknownAssetIds'> {}

export function validateGameboardPlan(
  plan: GameboardPlan,
  config: GameboardPlanValidationConfig = {}
): GameboardRuleViolation[] {
  const rules = { ...DEFAULT_PLAN_RULES, ...config };
  const violations: GameboardRuleViolation[] = [];
  const tiles = new Map(plan.tiles.map((tile) => [tile.key, tile]));
  const channelMasks = buildChannelMasks(plan, config.registry);

  for (const tile of tiles.values()) {
    validateStack(violations, tile, config.registry, rules.maxElevation);
    validateTileAssetReferences(violations, tile, rules);
    validateBuiltInConnectivity(violations, tiles, tile, rules);
    if (rules.validateRegisteredDeclarations && config.registry) {
      validateRegisteredTileDeclaration(violations, tile, config.registry);
    }
  }

  for (const placement of plan.placements) {
    validatePlacement(violations, tiles, placement, rules);
    validatePlacementAssetReference(violations, placement, rules);
  }

  if (rules.validatePlacementFootprints) {
    validatePlacementFootprints(violations, tiles, plan.placements);
  }
  if (rules.validatePlacementBlockingOverlap) {
    validatePlacementBlockingOverlap(violations, tiles, plan.placements);
  }

  if (rules.validateRegisteredDeclarations && config.registry) {
    validateRegisteredAdjacency(violations, tiles, channelMasks);
  }

  return violations;
}

export function canStackInPlan(
  plan: GameboardPlan,
  coordinates: HexCoordinates | string,
  height: number,
  config: GameboardPlanValidationConfig = {}
): boolean {
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  const tile = plan.tiles.find((candidate) => candidate.key === key);
  if (!tile || tile.terrain === 'water' || height < 0) {
    return false;
  }
  const registryRule = config.registry?.byAssetId[tile.baseAssetId]?.stack;
  const maxElevation = registryRule?.maxElevation ?? config.maxElevation ?? DEFAULT_PLAN_RULES.maxElevation;
  return Boolean((registryRule?.canStack ?? true) && height <= maxElevation);
}

function validateStack(
  violations: GameboardRuleViolation[],
  tile: GameboardTileSpec,
  registry: HexTileRegistry | undefined,
  maxElevation: number
): void {
  if (tile.elevation > maxElevation) {
    violations.push({
      code: 'stack.max_elevation',
      severity: 'error',
      tileKey: tile.key,
      message: `Tile ${tile.key} has elevation ${tile.elevation}; max is ${maxElevation}`,
    });
  }
  if (tile.terrain === 'water' && tile.elevation > 0) {
    violations.push({
      code: 'stack.water_elevation',
      severity: 'error',
      tileKey: tile.key,
      message: `Water tile ${tile.key} cannot be stacked above elevation 0`,
    });
  }

  const declaration = registry?.byAssetId[tile.baseAssetId];
  if (!declaration) {
    return;
  }
  if (tile.elevation > 0 && !declaration.stack.canStack) {
    violations.push({
      code: 'declaration.stack_forbidden',
      severity: 'error',
      tileKey: tile.key,
      message: `Tile ${tile.key} uses ${declaration.id}, which is not stackable`,
    });
  }
  if (declaration.stack.maxElevation !== undefined && tile.elevation > declaration.stack.maxElevation) {
    violations.push({
      code: 'declaration.stack_max_elevation',
      severity: 'error',
      tileKey: tile.key,
      message: `Tile ${tile.key} exceeds ${declaration.id} max elevation ${declaration.stack.maxElevation}`,
    });
  }
  if (
    tile.elevation > 0 &&
    declaration.stack.supportAssetId !== undefined &&
    tile.supportAssetId !== declaration.stack.supportAssetId
  ) {
    violations.push({
      code: 'declaration.stack_support_mismatch',
      severity: 'warning',
      tileKey: tile.key,
      message: `Tile ${tile.key} uses support ${tile.supportAssetId}; ${declaration.id} expects ${declaration.stack.supportAssetId}`,
    });
  }
}

function validateBuiltInConnectivity(
  violations: GameboardRuleViolation[],
  tiles: ReadonlyMap<string, GameboardTileSpec>,
  tile: GameboardTileSpec,
  rules: NormalizedPlanRules
): void {
  validateBuiltInEdgeMask(violations, tiles, tile, 'road', tile.roadEdges, rules.requireReciprocalRoads);
  validateBuiltInEdgeMask(violations, tiles, tile, 'river', tile.riverEdges, rules.requireReciprocalRivers);

  if (!rules.requireCoastsTouchWater) {
    return;
  }
  forEachEdge(tile.coastEdges, (edge) => {
    const adjacent = tiles.get(hexKey(neighbor(tile.coordinates, edge)));
    if (adjacent && adjacent.terrain !== 'water') {
      violations.push({
        code: 'coast.adjacent_land',
        severity: 'warning',
        tileKey: tile.key,
        message: `Coast edge ${edge} on ${tile.key} touches ${adjacent.terrain} instead of water`,
      });
    }
  });
}

function validateBuiltInEdgeMask(
  violations: GameboardRuleViolation[],
  tiles: ReadonlyMap<string, GameboardTileSpec>,
  tile: GameboardTileSpec,
  family: 'road' | 'river',
  mask: number,
  requireReciprocal: boolean
): void {
  if (!requireReciprocal) {
    return;
  }
  forEachEdge(mask, (edge) => {
    const adjacent = tiles.get(hexKey(neighbor(tile.coordinates, edge)));
    if (!adjacent) {
      violations.push({
        code: `${family}.edge_off_board`,
        severity: 'warning',
        tileKey: tile.key,
        message: `${family} edge ${edge} on ${tile.key} points off the board`,
      });
      return;
    }
    const adjacentMask = family === 'road' ? adjacent.roadEdges : adjacent.riverEdges;
    if (family === 'river' && adjacentMask === 0) {
      violations.push({
        code: 'river.terminates_into_tile',
        severity: 'warning',
        tileKey: tile.key,
        message: `river edge ${edge} on ${tile.key} terminates into ${adjacent.key}`,
      });
      return;
    }
    if ((adjacentMask & (1 << oppositeEdge(edge))) === 0) {
      violations.push({
        code: `${family}.missing_reciprocal_edge`,
        severity: 'error',
        tileKey: tile.key,
        message: `${family} edge ${edge} on ${tile.key} is not connected back from ${adjacent.key}`,
      });
    }
  });
}

function validateRegisteredTileDeclaration(
  violations: GameboardRuleViolation[],
  tile: GameboardTileSpec,
  registry: HexTileRegistry
): void {
  if (!registry.byAssetId[tile.baseAssetId]) {
    violations.push({
      code: 'declaration.missing_base_asset',
      severity: 'warning',
      tileKey: tile.key,
      message: `Tile ${tile.key} base asset ${tile.baseAssetId} has no tile declaration`,
    });
  }
  if (tile.elevation > 0 && !registry.byAssetId[tile.supportAssetId]) {
    violations.push({
      code: 'declaration.missing_support_asset',
      severity: 'warning',
      tileKey: tile.key,
      message: `Tile ${tile.key} support asset ${tile.supportAssetId} has no tile declaration`,
    });
  }
}

function validatePlacement(
  violations: GameboardRuleViolation[],
  tiles: ReadonlyMap<string, GameboardTileSpec>,
  placement: GameboardPlacementSpec,
  rules: NormalizedPlanRules
): void {
  const tile = tiles.get(placement.tileKey);
  if (!tile) {
    violations.push({
      code: 'placement.missing_tile',
      severity: 'error',
      placementId: placement.id,
      message: `Placement ${placement.id} references missing tile ${placement.tileKey}`,
    });
    return;
  }

  if (rules.forbidStructuresOnWater && placement.kind === 'structure' && tile.terrain === 'water') {
    violations.push({
      code: 'placement.structure_on_water',
      severity: 'error',
      tileKey: tile.key,
      placementId: placement.id,
      message: `Structure ${placement.assetId} is on water tile ${tile.key}`,
    });
  }

  if (!rules.requireHarborsTouchWater || placement.metadata.feature !== 'harbor') {
    return;
  }
  const facing = Number(placement.metadata.facing);
  const adjacent = Number.isFinite(facing) ? tiles.get(hexKey(neighbor(tile.coordinates, facing))) : undefined;
  if (!adjacent || adjacent.terrain !== 'water') {
    violations.push({
      code: 'harbor.missing_water',
      severity: 'error',
      tileKey: tile.key,
      placementId: placement.id,
      message: `Harbor ${placement.id} must face an adjacent water tile`,
    });
  }
}

function validateTileAssetReferences(
  violations: GameboardRuleViolation[],
  tile: GameboardTileSpec,
  rules: NormalizedPlanRules
): void {
  validateAssetReference(violations, {
    assetId: tile.baseAssetId,
    source: 'tile.baseAssetId',
    tileKey: tile.key,
    rules,
  });
  if (tile.elevation > 0 || tile.supportAssetId !== tile.baseAssetId) {
    validateAssetReference(violations, {
      assetId: tile.supportAssetId,
      source: 'tile.supportAssetId',
      tileKey: tile.key,
      rules,
    });
  }
}

function validatePlacementAssetReference(
  violations: GameboardRuleViolation[],
  placement: GameboardPlacementSpec,
  rules: NormalizedPlanRules
): void {
  validateAssetReference(violations, {
    assetId: placement.assetId,
    source: 'placement.assetId',
    tileKey: placement.tileKey,
    placementId: placement.id,
    requiresExtra: placement.requiresExtra,
    rules,
  });
}

function validatePlacementFootprints(
  violations: GameboardRuleViolation[],
  tiles: ReadonlyMap<string, GameboardTileSpec>,
  placements: readonly GameboardPlacementSpec[]
): void {
  for (const placement of placements) {
    for (const tileKey of gameboardPlacementFootprintKeys(placement)) {
      if (tiles.has(tileKey)) {
        continue;
      }
      violations.push({
        code: 'placement.footprint_missing_tile',
        severity: 'error',
        tileKey,
        placementId: placement.id,
        message: `Placement ${placement.id} footprint references missing tile ${tileKey}`,
      });
    }
  }
}

function validatePlacementBlockingOverlap(
  violations: GameboardRuleViolation[],
  tiles: ReadonlyMap<string, GameboardTileSpec>,
  placements: readonly GameboardPlacementSpec[]
): void {
  const blockersByTile = new Map<string, GameboardPlacementSpec[]>();
  for (const placement of placements) {
    if (!gameboardPlacementBlocksOccupancy(placement)) {
      continue;
    }
    for (const tileKey of gameboardPlacementFootprintKeys(placement)) {
      if (!tiles.has(tileKey)) {
        continue;
      }
      const blockers = blockersByTile.get(tileKey) ?? [];
      blockers.push(placement);
      blockersByTile.set(tileKey, blockers);
    }
  }

  for (const [tileKey, blockers] of blockersByTile) {
    const uniqueBlockers = uniquePlacements(blockers);
    if (uniqueBlockers.length < 2) {
      continue;
    }
    violations.push({
      code: 'placement.blocking_footprint_overlap',
      severity: 'error',
      tileKey,
      placementId: uniqueBlockers[0]?.id,
      message: `Tile ${tileKey} is blocked by overlapping placement footprints: ${uniqueBlockers.map((placement) => placement.id).join(', ')}`,
    });
  }
}

function uniquePlacements(placements: readonly GameboardPlacementSpec[]): GameboardPlacementSpec[] {
  const unique = new Map<string, GameboardPlacementSpec>();
  for (const placement of placements) {
    unique.set(gameboardPlacementOccupancyGroup(placement), placement);
  }
  return [...unique.values()];
}

function validateAssetReference(
  violations: GameboardRuleViolation[],
  options: {
    assetId: string;
    source: string;
    tileKey?: string;
    placementId?: string;
    requiresExtra?: boolean;
    rules: NormalizedPlanRules;
  }
): void {
  const catalog = options.rules.assetCatalog;
  if (!catalog) {
    return;
  }
  const asset = getManifestAsset(catalog, options.assetId);
  if (!asset) {
    if (options.rules.allowUnknownAssets || options.rules.allowUnknownAssetIds?.includes(options.assetId)) {
      return;
    }
    violations.push({
      code: 'asset.unknown',
      severity: 'error',
      tileKey: options.tileKey,
      placementId: options.placementId,
      message: `${options.source} ${options.assetId} is not present in the provided asset manifest`,
    });
    return;
  }

  if (asset.edition === 'extra' && options.requiresExtra === undefined) {
    violations.push({
      code: 'asset.tile_requires_extra',
      severity: 'warning',
      tileKey: options.tileKey,
      placementId: options.placementId,
      message: `${options.source} ${options.assetId} is an EXTRA asset; consumers must provide a local EXTRA bundle`,
    });
    return;
  }
  if (!options.rules.requireExtraAssetFlags || options.requiresExtra === undefined) {
    return;
  }
  if (asset.edition === 'extra' && !options.requiresExtra) {
    violations.push({
      code: 'asset.extra_flag_missing',
      severity: 'error',
      tileKey: options.tileKey,
      placementId: options.placementId,
      message: `Placement ${options.placementId ?? '<unknown>'} uses EXTRA asset ${options.assetId} without requiresExtra`,
    });
  }
  if (asset.edition === 'free' && options.requiresExtra) {
    violations.push({
      code: 'asset.extra_flag_unnecessary',
      severity: 'warning',
      tileKey: options.tileKey,
      placementId: options.placementId,
      message: `Placement ${options.placementId ?? '<unknown>'} marks FREE asset ${options.assetId} as requiresExtra`,
    });
  }
}

function buildChannelMasks(
  plan: GameboardPlan,
  registry: HexTileRegistry | undefined
): Map<string, Map<string, ChannelMaskSource[]>> {
  const masks = new Map<string, Map<string, ChannelMaskSource[]>>();
  for (const tile of plan.tiles) {
    addChannelMask(masks, tile.key, 'road', {
      mask: tile.roadEdges,
      sourceId: 'tile.roadEdges',
    });
    addChannelMask(masks, tile.key, 'river', {
      mask: tile.riverEdges,
      sourceId: 'tile.riverEdges',
    });
    addChannelMask(masks, tile.key, 'coast', {
      mask: tile.coastEdges,
      sourceId: 'tile.coastEdges',
    });
    const declaration = registry?.byAssetId[tile.baseAssetId];
    if (declaration) {
      for (const edge of declaration.edges) {
        addChannelMask(masks, tile.key, edge.channel, {
          mask: edge.mask,
          sourceId: declaration.id,
          declaration,
        });
      }
    }
  }

  if (!registry) {
    return masks;
  }
  for (const placement of plan.placements) {
    const declaration = declarationForPlacement(placement, registry);
    if (!declaration) {
      continue;
    }
    for (const edge of declaration.edges) {
      addChannelMask(masks, placement.tileKey, edge.channel, {
        mask: rotateMask(edge.mask, placement.rotationSteps),
        sourceId: declaration.id,
        placementId: placement.id,
        declaration,
        rotationSteps: placement.rotationSteps,
      });
    }
  }
  return masks;
}

function addChannelMask(
  masks: Map<string, Map<string, ChannelMaskSource[]>>,
  tileKey: string,
  channel: string,
  source: ChannelMaskSource
): void {
  if (source.mask === 0) {
    return;
  }
  const tileMasks = masks.get(tileKey) ?? new Map<string, ChannelMaskSource[]>();
  const sources = tileMasks.get(channel) ?? [];
  sources.push(source);
  tileMasks.set(channel, sources);
  masks.set(tileKey, tileMasks);
}

function validateRegisteredAdjacency(
  violations: GameboardRuleViolation[],
  tiles: ReadonlyMap<string, GameboardTileSpec>,
  channelMasks: ReadonlyMap<string, ReadonlyMap<string, readonly ChannelMaskSource[]>>
): void {
  for (const [tileKey, channelSources] of channelMasks) {
    const tile = tiles.get(tileKey);
    if (!tile) {
      continue;
    }
    for (const [channel, sources] of channelSources) {
      for (const source of sources) {
        validateChannelSource(violations, tiles, channelMasks, tile, channel, source);
      }
    }
  }
}

function validateChannelSource(
  violations: GameboardRuleViolation[],
  tiles: ReadonlyMap<string, GameboardTileSpec>,
  channelMasks: ReadonlyMap<string, ReadonlyMap<string, readonly ChannelMaskSource[]>>,
  tile: GameboardTileSpec,
  channel: string,
  source: ChannelMaskSource
): void {
  if (!source.declaration) {
    return;
  }
  const rules = source.declaration?.adjacency.filter((rule) => rule.channel === channel) ?? [];
  forEachEdge(source.mask, (edge) => {
    const adjacent = tiles.get(hexKey(neighbor(tile.coordinates, edge)));
    const matchingRules = rules.filter((rule) => (rotatedRuleMask(rule, source) & (1 << edge)) !== 0);
    const allowOffBoard = matchingRules.some((rule) => rule.allowOffBoard);
    if (!adjacent) {
      if (!allowOffBoard) {
        violations.push({
          code: 'declaration.edge_off_board',
          severity: 'warning',
          tileKey: tile.key,
          placementId: source.placementId,
          message: `${source.sourceId} ${channel} edge ${edge} on ${tile.key} points off the board`,
        });
      }
      return;
    }

    for (const rule of matchingRules) {
      if (rule.requiresNeighborTerrain && !rule.requiresNeighborTerrain.includes(adjacent.terrain)) {
        violations.push({
          code: 'declaration.adjacency_required_terrain',
          severity: 'error',
          tileKey: tile.key,
          placementId: source.placementId,
          message: `${source.sourceId} ${channel} edge ${edge} on ${tile.key} requires neighbor terrain ${rule.requiresNeighborTerrain.join(', ')}`,
        });
      }
      if (rule.forbidsNeighborTerrain?.includes(adjacent.terrain)) {
        violations.push({
          code: 'declaration.adjacency_forbidden_terrain',
          severity: 'error',
          tileKey: tile.key,
          placementId: source.placementId,
          message: `${source.sourceId} ${channel} edge ${edge} on ${tile.key} forbids neighbor terrain ${adjacent.terrain}`,
        });
      }
    }

    const reciprocal = source.declaration?.edges.find((item) => item.channel === channel)?.reciprocal ?? true;
    const explicitReciprocal = matchingRules.some((rule) => rule.reciprocal === true);
    const skipsReciprocal = matchingRules.some((rule) => rule.reciprocal === false);
    if (skipsReciprocal || (!reciprocal && !explicitReciprocal)) {
      return;
    }

    const adjacentMask = mergeMasks(channelMasks.get(adjacent.key)?.get(channel) ?? []);
    if ((adjacentMask & (1 << oppositeEdge(edge))) === 0) {
      violations.push({
        code: 'declaration.missing_reciprocal_edge',
        severity: 'error',
        tileKey: tile.key,
        placementId: source.placementId,
        message: `${source.sourceId} ${channel} edge ${edge} on ${tile.key} is not connected back from ${adjacent.key}`,
      });
    }
  });
}

function rotatedRuleMask(rule: { mask: number }, source: ChannelMaskSource): number {
  return source.rotationSteps === undefined ? rule.mask : rotateMask(rule.mask, source.rotationSteps);
}

function declarationForPlacement(
  placement: GameboardPlacementSpec,
  registry: HexTileRegistry
): HexTileDeclaration | undefined {
  const declarationId = placement.metadata.declarationId;
  return typeof declarationId === 'string'
    ? registry.byId[declarationId] ?? registry.byAssetId[placement.assetId]
    : registry.byAssetId[placement.assetId];
}

function mergeMasks(sources: readonly ChannelMaskSource[]): number {
  return sources.reduce((mask, source) => mask | source.mask, 0) & 0b111111;
}

function forEachEdge(mask: number, callback: (edge: number) => void): void {
  for (let edge = 0; edge < 6; edge += 1) {
    if ((mask & (1 << edge)) !== 0) {
      callback(edge);
    }
  }
}
