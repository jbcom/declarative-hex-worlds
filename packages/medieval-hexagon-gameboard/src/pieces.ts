import type {
  ExternalAssetCompatibilityReport,
} from './compatibility';
import type {
  GameboardPlan,
  GameboardPlacementKind,
  GameboardPlacementLayer,
} from './gameboard';
import {
  type BuiltInGameboardLayoutArchetypeId,
  createGameboardLayoutPlacements,
  type GameboardLayoutArchetypeInput,
  type GameboardLayoutArchetypeRegistry,
  type GameboardLayoutCriteria,
  type GameboardLayoutFillRule,
  type GameboardLayoutFootprintInput,
  type GameboardLayoutPlacementOptions,
  type GameboardLayoutSiteInspection,
  inspectGameboardLayoutSites,
  resolveGameboardLayoutCriteria,
} from './layout';
import type { GameboardPlacementOccupancyGuard, SpawnGameboardPlacementOptions } from './koota';

export type GameboardPieceRole = BuiltInGameboardLayoutArchetypeId | 'custom';

export interface GameboardPieceDeclarationInput {
  id: string;
  assetId?: string;
  label?: string;
  source?: string;
  role?: GameboardPieceRole;
  archetype?: GameboardLayoutArchetypeInput;
  kind?: GameboardPlacementKind;
  layer?: GameboardPlacementLayer;
  footprint?: GameboardLayoutFootprintInput;
  criteria?: GameboardLayoutCriteria;
  scale?: number;
  rotationSteps?: number | 'random';
  elevationOffset?: number;
  requiresExtra?: boolean;
  tags?: readonly string[];
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface GameboardPieceCompatibilityDeclarationOptions extends Omit<GameboardPieceDeclarationInput, 'id'> {
  id?: string;
}

export interface GameboardPieceCompatibilityBatchOptions
  extends Omit<GameboardPieceCompatibilityDeclarationOptions, 'id' | 'assetId'> {
  pieceIdPrefix?: string;
  assetIdPrefix?: string;
  overrides?: Readonly<Record<string, GameboardPieceCompatibilityDeclarationOptions>>;
}

export interface GameboardPieceDeclaration {
  id: string;
  assetId: string;
  label: string;
  source: string;
  role: GameboardPieceRole;
  archetype: GameboardLayoutArchetypeInput;
  kind?: GameboardPlacementKind;
  layer?: GameboardPlacementLayer;
  footprint?: GameboardLayoutFootprintInput;
  criteria: GameboardLayoutCriteria;
  scale?: number;
  rotationSteps?: number | 'random';
  elevationOffset?: number;
  requiresExtra: boolean;
  tags: readonly string[];
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface GameboardPieceRegistry {
  pieces: readonly GameboardPieceDeclaration[];
  byId: Readonly<Record<string, GameboardPieceDeclaration>>;
  byAssetId: Readonly<Record<string, GameboardPieceDeclaration>>;
  warnings: readonly string[];
}

export type GameboardPieceRegistryAnalysisCheckMode = 'per-piece' | 'pool';

export interface GameboardPieceRegistrySelection {
  ids?: readonly string[];
  assetIds?: readonly string[];
  roles?: readonly GameboardPieceRole[];
  sources?: readonly string[];
  tags?: readonly string[];
  excludeTags?: readonly string[];
  requiresExtra?: boolean;
}

export interface GameboardPieceRegistryAnalysisCheckInput {
  id?: string;
  mode?: GameboardPieceRegistryAnalysisCheckMode;
  selection?: GameboardPieceRegistrySelection;
}

export interface GameboardPieceRegistryAnalysisCheck {
  id: string;
  mode: GameboardPieceRegistryAnalysisCheckMode;
  selection: GameboardPieceRegistrySelection;
  selectedCount: number;
  selectedIds: readonly string[];
  warnings: readonly string[];
  errors: readonly string[];
}

export interface AnalyzeGameboardPieceRegistryOptions {
  checks?: readonly GameboardPieceRegistryAnalysisCheckInput[];
}

export interface GameboardPieceRegistryAnalysis {
  pieceCount: number;
  localOnlyCount: number;
  roleCounts: Readonly<Record<string, number>>;
  sourceCounts: Readonly<Record<string, number>>;
  tagCounts: Readonly<Record<string, number>>;
  warnings: readonly string[];
  errors: readonly string[];
  checks: readonly GameboardPieceRegistryAnalysisCheck[];
}

export interface GameboardPieceLayoutRuleOptions {
  id?: string;
  assetId?: string;
  count?: number;
  fill?: number;
  minCount?: number;
  maxCount?: number;
  idPrefix?: string;
  criteria?: GameboardLayoutCriteria;
  scale?: number;
  rotationSteps?: number | 'random';
  elevationOffset?: number;
  archetypes?: GameboardLayoutArchetypeRegistry;
  requiresExtra?: boolean;
  occupancyGuard?: GameboardPlacementOccupancyGuard;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface GameboardPieceCollectionLayoutRuleOptions
  extends Omit<GameboardPieceLayoutRuleOptions, 'assetId'> {}

export interface GameboardPieceRegistryFillRulesOptions
  extends Omit<GameboardPieceLayoutRuleOptions, 'id' | 'assetId'> {
  selection?: GameboardPieceRegistrySelection;
  ruleIdPrefix?: string;
}

export interface GameboardPiecePlacementOptions
  extends Omit<GameboardPieceLayoutRuleOptions, 'fill' | 'minCount' | 'maxCount'> {
  seed?: string | number;
  archetypes?: GameboardLayoutArchetypeRegistry;
}

export interface GameboardPieceSourceUrlOptions {
  sourceRoot?: string;
  sourceRoots?: Readonly<Record<string, string>>;
  encode?: boolean;
}

export interface GameboardPiecePlacementInspection {
  pieceId: string;
  assetId: string;
  role: GameboardPieceRole;
  source: string;
  layoutOptions: GameboardLayoutPlacementOptions;
  siteInspection: GameboardLayoutSiteInspection;
  placements: readonly SpawnGameboardPlacementOptions[];
}

const ROLE_ARCHETYPES: Record<GameboardPieceRole, BuiltInGameboardLayoutArchetypeId> = {
  surface: 'surface',
  building: 'building',
  harbor: 'harbor',
  unit: 'unit',
  prop: 'prop',
  tree: 'tree',
  scatter: 'scatter',
  landmark: 'landmark',
  custom: 'prop',
};

export function declareGameboardPiece(input: GameboardPieceDeclarationInput): GameboardPieceDeclaration {
  const role = input.role ?? inferPieceRole(input.id);
  const criteria = pieceCriteria(input.criteria, input.footprint);
  return {
    id: input.id,
    assetId: input.assetId ?? input.id,
    label: input.label ?? titleFromId(input.id),
    source: input.source ?? 'custom',
    role,
    archetype: input.archetype ?? ROLE_ARCHETYPES[role],
    kind: input.kind,
    layer: input.layer,
    footprint: input.footprint,
    criteria,
    scale: input.scale,
    rotationSteps: input.rotationSteps,
    elevationOffset: input.elevationOffset,
    requiresExtra: input.requiresExtra ?? input.source !== undefined,
    tags: [...(input.tags ?? [])],
    metadata: { ...(input.metadata ?? {}) },
  };
}

export function declareGameboardPieceFromCompatibility(
  report: ExternalAssetCompatibilityReport,
  options: GameboardPieceCompatibilityDeclarationOptions = {}
): GameboardPieceDeclaration {
  return declareGameboardPiece({
    ...options,
    id: options.id ?? report.id,
    assetId: options.assetId ?? report.id,
    source: options.source ?? report.sourcePack,
    role: options.role ?? inferPieceRoleFromCompatibility(report),
    kind: options.kind ?? report.placement.kind,
    layer: options.layer ?? report.placement.layer,
    scale: options.scale ?? report.placement.scale,
    rotationSteps: options.rotationSteps ?? report.placement.rotationSteps,
    elevationOffset: options.elevationOffset ?? report.placement.elevationOffset,
    requiresExtra: options.requiresExtra ?? true,
    metadata: {
      externalAsset: true,
      suggestedRole: report.suggestedRole,
      footprint: report.placement.footprint,
      modelForward: report.placement.modelForward,
      boardForwardEdge: report.placement.boardForwardEdge,
      blocksMovement: report.placement.blocksMovement,
      animationDefaultClip: report.placement.animation?.defaultClip ?? null,
      ...(options.metadata ?? {}),
    },
  });
}

export function declareGameboardPiecesFromCompatibilityReports(
  reports: readonly ExternalAssetCompatibilityReport[],
  options: GameboardPieceCompatibilityBatchOptions = {}
): GameboardPieceDeclaration[] {
  const { pieceIdPrefix, assetIdPrefix, overrides: _overrides, ...declarationOptions } = options;
  return reports.map((report) =>
    declareGameboardPieceFromCompatibility(report, {
      ...mergeBatchDeclarationOptions(declarationOptions, batchOverrideForReport(report, options.overrides)),
      id: batchOverrideForReport(report, options.overrides)?.id ?? joinPieceId(pieceIdPrefix, report.id),
      assetId: batchOverrideForReport(report, options.overrides)?.assetId ?? joinPieceId(assetIdPrefix, report.id),
    })
  );
}

export function createGameboardPieceRegistryFromCompatibilityReports(
  reports: readonly ExternalAssetCompatibilityReport[],
  options: GameboardPieceCompatibilityBatchOptions = {}
): GameboardPieceRegistry {
  return createGameboardPieceRegistry(declareGameboardPiecesFromCompatibilityReports(reports, options));
}

export function createGameboardPieceRegistry(
  declarations: readonly GameboardPieceDeclarationInput[]
): GameboardPieceRegistry {
  const pieces = declarations.map(declareGameboardPiece);
  const byId: Record<string, GameboardPieceDeclaration> = {};
  const byAssetId: Record<string, GameboardPieceDeclaration> = {};
  const warnings: string[] = [];

  for (const piece of pieces) {
    if (byId[piece.id]) {
      warnings.push(`Duplicate gameboard piece id: ${piece.id}`);
    }
    if (byAssetId[piece.assetId]) {
      warnings.push(`Duplicate gameboard piece assetId: ${piece.assetId}`);
    }
    byId[piece.id] = piece;
    byAssetId[piece.assetId] = piece;
  }

  return {
    pieces,
    byId,
    byAssetId,
    warnings,
  };
}

export function analyzeGameboardPieceRegistry(
  registry: GameboardPieceRegistry,
  options: AnalyzeGameboardPieceRegistryOptions = {}
): GameboardPieceRegistryAnalysis {
  const warnings = [...registry.warnings];
  const errors: string[] = [];
  const roleCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};

  if (registry.pieces.length === 0) {
    warnings.push('Piece registry is empty');
  }

  for (const piece of registry.pieces) {
    increment(roleCounts, piece.role);
    increment(sourceCounts, piece.source);
    for (const tag of piece.tags) {
      increment(tagCounts, tag);
    }
    if (piece.role === 'custom') {
      warnings.push(`Piece ${piece.id} uses custom role; provide an explicit archetype for predictable layout behavior`);
    }
    if (!piece.assetId) {
      errors.push(`Piece ${piece.id} is missing assetId`);
    }
  }

  const checks = (options.checks ?? []).map((check, index): GameboardPieceRegistryAnalysisCheck => {
    const selection = check.selection ?? {};
    const mode = check.mode ?? 'per-piece';
    const selected = selectGameboardPieces(registry, selection);
    const checkWarnings: string[] = [];
    const checkErrors: string[] = [];
    const id = check.id ?? `check:${index}`;
    if (selected.length === 0) {
      checkWarnings.push(`Piece registry check ${id} matched no pieces`);
    }
    if (mode === 'pool' && !piecePoolCompatible(selected)) {
      checkErrors.push(`Piece registry check ${id} cannot pool pieces with different archetype, kind, or layer`);
    }
    warnings.push(...checkWarnings);
    errors.push(...checkErrors);
    return {
      id,
      mode,
      selection,
      selectedCount: selected.length,
      selectedIds: selected.map((piece) => piece.id),
      warnings: checkWarnings,
      errors: checkErrors,
    };
  });

  return {
    pieceCount: registry.pieces.length,
    localOnlyCount: registry.pieces.filter((piece) => piece.requiresExtra).length,
    roleCounts,
    sourceCounts,
    tagCounts,
    warnings,
    errors,
    checks,
  };
}

export function selectGameboardPieces(
  registry: GameboardPieceRegistry,
  selection: GameboardPieceRegistrySelection = {}
): GameboardPieceDeclaration[] {
  const ids = optionalSet(selection.ids);
  const assetIds = optionalSet(selection.assetIds);
  const roles = optionalSet(selection.roles);
  const sources = optionalSet(selection.sources);
  return registry.pieces.filter(
    (piece) =>
      matchesOptionalSet(piece.id, ids) &&
      matchesOptionalSet(piece.assetId, assetIds) &&
      matchesOptionalSet(piece.role, roles) &&
      matchesOptionalSet(piece.source, sources) &&
      matchesTags(piece.tags, selection.tags) &&
      !matchesAnyTag(piece.tags, selection.excludeTags) &&
      (selection.requiresExtra === undefined || piece.requiresExtra === selection.requiresExtra)
  );
}

export function createGameboardLayoutFillRuleFromPiece(
  piece: GameboardPieceDeclaration,
  options: GameboardPieceLayoutRuleOptions = {}
): GameboardLayoutFillRule {
  return {
    id: options.id ?? piece.id,
    assetId: options.assetId ?? piece.assetId,
    archetype: piece.archetype,
    kind: piece.kind,
    layer: piece.layer,
    count: options.count,
    fill: options.fill,
    minCount: options.minCount,
    maxCount: options.maxCount,
    idPrefix: options.idPrefix,
    scale: options.scale ?? piece.scale,
    rotationSteps: options.rotationSteps ?? piece.rotationSteps,
    elevationOffset: options.elevationOffset ?? piece.elevationOffset,
    archetypes: options.archetypes,
    requiresExtra: options.requiresExtra ?? piece.requiresExtra,
    occupancyGuard: options.occupancyGuard,
    criteria: mergeCriteria(piece.criteria, options.criteria),
    metadata: pieceMetadata(piece, options.metadata),
  };
}

export function createGameboardLayoutFillRuleFromPieces(
  pieces: readonly GameboardPieceDeclaration[],
  options: GameboardPieceCollectionLayoutRuleOptions = {}
): GameboardLayoutFillRule {
  const first = pieces[0];
  if (!first) {
    throw new Error('createGameboardLayoutFillRuleFromPieces requires at least one piece');
  }
  const ids = pieces.map((piece) => piece.id);
  const roles = uniqueValues(pieces.map((piece) => piece.role));
  const sources = uniqueValues(pieces.map((piece) => piece.source));
  return {
    id: options.id ?? first.id,
    assets: pieces.map((piece) => piece.assetId),
    archetype: first.archetype,
    kind: first.kind,
    layer: first.layer,
    count: options.count,
    fill: options.fill,
    minCount: options.minCount,
    maxCount: options.maxCount,
    idPrefix: options.idPrefix,
    scale: options.scale ?? commonValue(pieces.map((piece) => piece.scale)),
    rotationSteps: options.rotationSteps ?? commonValue(pieces.map((piece) => piece.rotationSteps)),
    elevationOffset: options.elevationOffset ?? commonValue(pieces.map((piece) => piece.elevationOffset)),
    archetypes: options.archetypes,
    requiresExtra: options.requiresExtra ?? pieces.some((piece) => piece.requiresExtra),
    occupancyGuard: options.occupancyGuard,
    criteria: mergeCriteria(first.criteria, options.criteria),
    metadata: {
      ...first.metadata,
      ...(options.metadata ?? {}),
      pieceIds: ids.join('|'),
      pieceRoles: roles.join('|'),
      pieceSources: sources.join('|'),
      pieceCollectionSize: pieces.length,
    },
  };
}

export function createGameboardLayoutFillRulesFromRegistry(
  registry: GameboardPieceRegistry,
  options: GameboardPieceRegistryFillRulesOptions = {}
): GameboardLayoutFillRule[] {
  const { selection, ruleIdPrefix = 'piece', ...ruleOptions } = options;
  return selectGameboardPieces(registry, selection).map((piece) =>
    createGameboardLayoutFillRuleFromPiece(piece, {
      ...ruleOptions,
      id: `${ruleIdPrefix}:${piece.id}`,
      idPrefix: ruleOptions.idPrefix ?? `layout:${piece.id}`,
    })
  );
}

export function createGameboardLayoutPlacementOptionsFromPiece(
  piece: GameboardPieceDeclaration,
  options: GameboardPiecePlacementOptions = {}
): GameboardLayoutPlacementOptions {
  return {
    assetId: options.assetId ?? piece.assetId,
    archetype: piece.archetype,
    kind: piece.kind,
    layer: piece.layer,
    count: options.count,
    seed: options.seed,
    idPrefix: options.idPrefix,
    archetypes: options.archetypes,
    scale: options.scale ?? piece.scale,
    rotationSteps: options.rotationSteps ?? piece.rotationSteps,
    elevationOffset: options.elevationOffset ?? piece.elevationOffset,
    requiresExtra: options.requiresExtra ?? piece.requiresExtra,
    occupancyGuard: options.occupancyGuard,
    criteria: mergeCriteria(piece.criteria, options.criteria),
    metadata: pieceMetadata(piece, options.metadata),
  };
}

export function createGameboardLayoutPlacementsFromPiece(
  plan: GameboardPlan,
  piece: GameboardPieceDeclaration,
  options: GameboardPiecePlacementOptions = {}
): SpawnGameboardPlacementOptions[] {
  return createGameboardLayoutPlacements(plan, createGameboardLayoutPlacementOptionsFromPiece(piece, options));
}

export function inspectGameboardPiecePlacement(
  plan: GameboardPlan,
  piece: GameboardPieceDeclaration,
  options: GameboardPiecePlacementOptions = {}
): GameboardPiecePlacementInspection {
  const layoutOptions = createGameboardLayoutPlacementOptionsFromPiece(piece, options);
  const criteria = resolveGameboardLayoutCriteria(layoutOptions.archetype, layoutOptions.criteria, layoutOptions.archetypes);
  return {
    pieceId: piece.id,
    assetId: layoutOptions.assetId,
    role: piece.role,
    source: piece.source,
    layoutOptions,
    siteInspection: inspectGameboardLayoutSites(plan, {
      count: layoutOptions.count ?? 1,
      seed: layoutOptions.seed,
      criteria,
    }),
    placements: createGameboardLayoutPlacements(plan, layoutOptions),
  };
}

export function resolveGameboardPieceSourceUrl(
  piece: GameboardPieceDeclaration,
  options: GameboardPieceSourceUrlOptions = {}
): string | undefined {
  const explicitUrl = piece.metadata.sourceUrl;
  if (typeof explicitUrl === 'string' && explicitUrl.length > 0) {
    return explicitUrl;
  }
  const relativePath = piece.metadata.sourceRelativePath;
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    return undefined;
  }
  const root = options.sourceRoots?.[piece.source] ?? options.sourceRoot;
  const normalizedRelativePath = normalizeUrlPath(relativePath, options.encode ?? true);
  return root ? joinUrl(root, normalizedRelativePath) : normalizedRelativePath;
}

export function createGameboardPieceSourceUrlMap(
  registry: GameboardPieceRegistry,
  options: GameboardPieceSourceUrlOptions = {}
): Readonly<Record<string, string>> {
  const urls: Record<string, string> = {};
  for (const piece of registry.pieces) {
    const url = resolveGameboardPieceSourceUrl(piece, options);
    if (url) {
      urls[piece.assetId] = url;
    }
  }
  return urls;
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function piecePoolCompatible(pieces: readonly GameboardPieceDeclaration[]): boolean {
  const [first] = pieces;
  if (!first) {
    return true;
  }
  const signature = piecePoolSignature(first);
  return pieces.every((piece) => piecePoolSignature(piece) === signature);
}

function piecePoolSignature(piece: GameboardPieceDeclaration): string {
  const archetype = typeof piece.archetype === 'string' ? piece.archetype : piece.archetype.id;
  return `${archetype}:${piece.kind ?? ''}:${piece.layer ?? ''}`;
}

function optionalSet<T extends string>(values: readonly T[] | undefined): ReadonlySet<T> | undefined {
  return values ? new Set(values) : undefined;
}

function matchesOptionalSet<T extends string>(value: T, values: ReadonlySet<T> | undefined): boolean {
  return !values || values.has(value);
}

function matchesTags(pieceTags: readonly string[], requiredTags: readonly string[] | undefined): boolean {
  return !requiredTags || requiredTags.every((tag) => pieceTags.includes(tag));
}

function matchesAnyTag(pieceTags: readonly string[], excludedTags: readonly string[] | undefined): boolean {
  return Boolean(excludedTags?.some((tag) => pieceTags.includes(tag)));
}

function uniqueValues<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function commonValue<T>(values: readonly (T | undefined)[]): T | undefined {
  const [first] = values;
  if (first === undefined) {
    return undefined;
  }
  return values.every((value) => value === first) ? first : undefined;
}

function pieceCriteria(
  criteria: GameboardLayoutCriteria | undefined,
  footprint: GameboardLayoutFootprintInput | undefined
): GameboardLayoutCriteria {
  return {
    ...(criteria ?? {}),
    footprint: criteria?.footprint ?? footprint,
  };
}

function mergeCriteria(
  base: GameboardLayoutCriteria,
  override: GameboardLayoutCriteria | undefined
): GameboardLayoutCriteria {
  return {
    ...base,
    ...(override ?? {}),
    prefer: override?.prefer ?? base.prefer,
    tileTags: override?.tileTags ?? base.tileTags,
    excludeTileTags: override?.excludeTileTags ?? base.excludeTileTags,
    ignorePlacementIds: override?.ignorePlacementIds ?? base.ignorePlacementIds,
    minDistanceFrom: override?.minDistanceFrom ?? base.minDistanceFrom,
    maxDistanceFrom: override?.maxDistanceFrom ?? base.maxDistanceFrom,
    blockingPlacementKinds: override?.blockingPlacementKinds ?? base.blockingPlacementKinds,
    blockingPlacementLayers: override?.blockingPlacementLayers ?? base.blockingPlacementLayers,
  };
}

function pieceMetadata(
  piece: GameboardPieceDeclaration,
  metadata: Readonly<Record<string, string | number | boolean | null>> | undefined
): Readonly<Record<string, string | number | boolean | null>> {
  return {
    ...piece.metadata,
    ...(metadata ?? {}),
    pieceId: piece.id,
    pieceRole: piece.role,
    pieceSource: piece.source,
  };
}

function inferPieceRole(id: string): GameboardPieceRole {
  if (/dock|harbor|shipyard|port/i.test(id)) {
    return 'harbor';
  }
  if (/tree|forest/i.test(id)) {
    return 'tree';
  }
  if (/rock|crate|barrel|sack|pallet|prop/i.test(id)) {
    return 'scatter';
  }
  if (/unit|knight|soldier|archer|enemy|npc/i.test(id)) {
    return 'unit';
  }
  if (/tower|castle|landmark|gatehouse/i.test(id)) {
    return 'landmark';
  }
  if (/building|house|market|barracks|blacksmith/i.test(id)) {
    return 'building';
  }
  return 'prop';
}

function inferPieceRoleFromCompatibility(report: ExternalAssetCompatibilityReport): GameboardPieceRole {
  if (/dock|harbor|shipyard|port/i.test(report.id)) {
    return 'harbor';
  }
  if (report.placement.kind === 'unit') {
    return 'unit';
  }
  if (report.placement.kind === 'structure') {
    return 'building';
  }
  if (report.placement.kind === 'terrain') {
    return 'surface';
  }
  if (/tree|forest/i.test(report.id)) {
    return 'tree';
  }
  if (/rock|crate|barrel|sack|pallet|resource/i.test(report.id)) {
    return 'scatter';
  }
  if (/tower|castle|gatehouse|stable|workshop/i.test(report.id)) {
    return 'landmark';
  }
  return 'prop';
}

function titleFromId(id: string): string {
  return id
    .split(/[-_:]/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function joinPieceId(prefix: string | undefined, id: string): string {
  return prefix ? `${prefix}:${id}` : id;
}

function joinUrl(root: string, relativePath: string): string {
  return `${root.replace(/\/+$/, '')}/${relativePath.replace(/^\/+/, '')}`;
}

function normalizeUrlPath(path: string, encode: boolean): string {
  const normalized = path.replaceAll('\\', '/');
  if (!encode) {
    return normalized;
  }
  return normalized
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function batchOverrideForReport(
  report: ExternalAssetCompatibilityReport,
  overrides: Readonly<Record<string, GameboardPieceCompatibilityDeclarationOptions>> | undefined
): GameboardPieceCompatibilityDeclarationOptions | undefined {
  return overrides?.[report.id];
}

function mergeBatchDeclarationOptions(
  base: Omit<GameboardPieceCompatibilityDeclarationOptions, 'id' | 'assetId'>,
  override: GameboardPieceCompatibilityDeclarationOptions | undefined
): Omit<GameboardPieceCompatibilityDeclarationOptions, 'id' | 'assetId'> {
  if (!override) {
    return base;
  }
  const { id: _id, assetId: _assetId, ...overrideWithoutIdentity } = override;
  return {
    ...base,
    ...overrideWithoutIdentity,
    criteria: mergeCriteria(base.criteria ?? {}, override.criteria),
    tags: uniqueValues([...(base.tags ?? []), ...(override.tags ?? [])]),
    metadata: {
      ...(base.metadata ?? {}),
      ...(override.metadata ?? {}),
    },
  };
}
