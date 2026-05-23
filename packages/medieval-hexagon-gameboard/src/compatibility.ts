import { KAYKIT_HEX_DEPTH, KAYKIT_HEX_GEOMETRY, KAYKIT_HEX_WIDTH } from './grid';
import type { SpawnGameboardPlacementOptions } from './koota';
import type { AssetBounds, HexCoordinates, HexEdgeIndex } from './types';

export type ExternalAssetIntendedRole = 'tile' | 'prop' | 'structure' | 'unit';
export type ExternalAssetSuggestedRole = 'tile' | 'prop' | 'unit';
export type ExternalAssetFootprintKind = 'hex' | 'circle' | 'square' | 'rectangle' | 'point';
export type ExternalAssetForwardAxis = '+x' | '-x' | '+z' | '-z';
export type ExternalAssetAnchor = 'center' | 'bottom-center';

export interface ExternalAssetCompatibilityInput {
  id: string;
  sourcePack: string;
  creator?: string;
  license?: string;
  bounds: AssetBounds;
  intendedRole?: ExternalAssetIntendedRole;
  hasRig?: boolean;
  animationNames?: readonly string[];
  materialSlots?: readonly string[];
  modelForward?: ExternalAssetForwardAxis;
  boardForwardEdge?: HexEdgeIndex;
}

export interface ExternalAssetTileCompatibility {
  compatible: boolean;
  widthScale: number;
  depthScale: number;
  uniformScale: number;
  aspectRatio: number;
  expectedAspectRatio: number;
  aspectRatioDelta: number;
  scaleMismatch: number;
}

export interface ExternalAssetPlacementRecommendation {
  role: ExternalAssetSuggestedRole;
  kind: 'prop' | 'structure' | 'unit' | 'terrain';
  layer: 'feature' | 'structure' | 'unit' | 'terrain';
  footprint: ExternalAssetFootprintKind;
  scale: number;
  elevationOffset: number;
  rotationSteps: number;
  rotationRadians: number;
  facingErrorRadians: number;
  blocksMovement: boolean;
  anchor: ExternalAssetAnchor;
  modelForward: ExternalAssetForwardAxis;
  boardForwardEdge: HexEdgeIndex;
  animation?: {
    source: 'embedded' | 'external';
    clips: readonly string[];
    defaultClip?: string;
    loop: boolean;
  };
}

export interface ExternalAssetFacingOptions {
  modelForward?: ExternalAssetForwardAxis;
  boardForwardEdge?: HexEdgeIndex;
}

export interface ExternalAssetFacingRecommendation {
  modelForward: ExternalAssetForwardAxis;
  boardForwardEdge: HexEdgeIndex;
  rotationSteps: number;
  rotationRadians: number;
  facingErrorRadians: number;
}

export interface ExternalAssetCompatibilityReport {
  id: string;
  sourcePack: string;
  compatibleAsTile: boolean;
  tile: ExternalAssetTileCompatibility;
  suggestedRole: ExternalAssetSuggestedRole;
  placement: ExternalAssetPlacementRecommendation;
  warnings: readonly string[];
  errors: readonly string[];
}

export interface ExternalAssetSpawnOptionsInput {
  id?: string;
  at: HexCoordinates | string;
  assetId: string;
  report: ExternalAssetCompatibilityReport;
  sourceUrl?: string;
  sourcePack?: string;
  rotationSteps?: number;
  scale?: number;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

const TILE_RATIO_TOLERANCE = 0.08;
const TILE_SCALE_TOLERANCE = 0.08;
const PROP_FIT_RATIO = 0.72;
const UNIT_FIT_WIDTH = 0.72;

export function analyzeExternalAssetCompatibility(
  input: ExternalAssetCompatibilityInput
): ExternalAssetCompatibilityReport {
  const tile = analyzeTileFit(input.bounds);
  const warnings: string[] = [];
  const errors: string[] = [];
  const intendedRole = input.intendedRole ?? (input.hasRig ? 'unit' : 'prop');
  const suggestedRole = suggestedRoleFor(input, tile);
  const placement = placementFor(input, suggestedRole);

  if (intendedRole === 'tile' && !tile.compatible) {
    warnings.push(
      `${input.id} does not match the KayKit hex footprint; register it as a prop placement unless a custom tile declaration explicitly overrides its geometry`
    );
  }
  if (tile.scaleMismatch > TILE_SCALE_TOLERANCE) {
    warnings.push(
      `${input.id} needs non-uniform tile scaling (${round(tile.widthScale)} width vs ${round(tile.depthScale)} depth)`
    );
  }
  if (tile.aspectRatioDelta > TILE_RATIO_TOLERANCE) {
    warnings.push(
      `${input.id} footprint ratio ${round(tile.aspectRatio)} differs from KayKit hex ratio ${round(tile.expectedAspectRatio)}`
    );
  }
  if (input.hasRig && suggestedRole !== 'unit') {
    warnings.push(`${input.id} is rigged; prefer unit placement metadata over static prop metadata`);
  }
  if (suggestedRole === 'unit' && !input.hasRig) {
    warnings.push(`${input.id} is marked as a unit but no rig was detected`);
  }
  if (input.bounds.size[0] <= 0 || input.bounds.size[2] <= 0) {
    errors.push(`${input.id} has empty horizontal bounds`);
  }

  return {
    id: input.id,
    sourcePack: input.sourcePack,
    compatibleAsTile: tile.compatible,
    tile,
    suggestedRole,
    placement,
    warnings,
    errors,
  };
}

export function externalAssetSpawnOptions(input: ExternalAssetSpawnOptionsInput): SpawnGameboardPlacementOptions {
  const placement = input.report.placement;
  return {
    id: input.id,
    at: input.at,
    assetId: input.assetId,
    kind: placement.kind,
    layer: placement.layer,
    scale: input.scale ?? placement.scale,
    rotationSteps: input.rotationSteps ?? placement.rotationSteps,
    elevationOffset: placement.elevationOffset,
    requiresExtra: true,
    metadata: {
      sourcePack: input.sourcePack ?? input.report.sourcePack,
      sourceUrl: input.sourceUrl ?? null,
      externalAsset: true,
      suggestedRole: input.report.suggestedRole,
      footprint: placement.footprint,
      modelForward: placement.modelForward,
      boardForwardEdge: placement.boardForwardEdge,
      facingErrorRadians: placement.facingErrorRadians,
      blocksMovement: placement.blocksMovement,
      animationDefaultClip: placement.animation?.defaultClip ?? null,
      ...(input.metadata ?? {}),
    },
  };
}

export function recommendExternalAssetFacing(
  options: ExternalAssetFacingOptions = {}
): ExternalAssetFacingRecommendation {
  const modelForward = options.modelForward ?? '+z';
  const boardForwardEdge = normalizeEdge(options.boardForwardEdge ?? 1);
  const targetYaw = boardForwardEdge * (Math.PI / 3);
  const modelYaw = modelForwardYaw(modelForward);
  const delta = shortestAngle(targetYaw - modelYaw);
  const rotationSteps = normalizeRotationSteps(Math.floor(delta / (Math.PI / 3) + 0.5));
  const rotationRadians = rotationSteps * (Math.PI / 3);
  const finalYaw = shortestAngle(modelYaw + rotationRadians);
  return {
    modelForward,
    boardForwardEdge,
    rotationSteps,
    rotationRadians,
    facingErrorRadians: round(Math.abs(shortestAngle(targetYaw - finalYaw))),
  };
}

function analyzeTileFit(bounds: AssetBounds): ExternalAssetTileCompatibility {
  const [width, _height, depth] = bounds.size;
  const widthScale = width > 0 ? KAYKIT_HEX_WIDTH / width : 1;
  const depthScale = depth > 0 ? KAYKIT_HEX_DEPTH / depth : 1;
  const uniformScale = Math.min(widthScale, depthScale);
  const aspectRatio = depth > 0 ? width / depth : 0;
  const expectedAspectRatio = KAYKIT_HEX_WIDTH / KAYKIT_HEX_DEPTH;
  const aspectRatioDelta = Math.abs(aspectRatio - expectedAspectRatio);
  const scaleMismatch = Math.abs(widthScale - depthScale) / Math.max(widthScale, depthScale, 1);

  return {
    compatible:
      width > 0 &&
      depth > 0 &&
      aspectRatioDelta <= TILE_RATIO_TOLERANCE &&
      scaleMismatch <= TILE_SCALE_TOLERANCE,
    widthScale,
    depthScale,
    uniformScale,
    aspectRatio,
    expectedAspectRatio,
    aspectRatioDelta,
    scaleMismatch,
  };
}

function suggestedRoleFor(
  input: ExternalAssetCompatibilityInput,
  tile: ExternalAssetTileCompatibility
): ExternalAssetSuggestedRole {
  if (input.intendedRole === 'unit' || input.hasRig) {
    return 'unit';
  }
  if (input.intendedRole === 'tile' && tile.compatible) {
    return 'tile';
  }
  return 'prop';
}

function placementFor(
  input: ExternalAssetCompatibilityInput,
  role: ExternalAssetSuggestedRole
): ExternalAssetPlacementRecommendation {
  const [width, height, depth] = input.bounds.size;
  const modelForward = input.modelForward ?? '+z';
  const facing = recommendExternalAssetFacing({
    modelForward,
    boardForwardEdge: input.boardForwardEdge,
  });
  if (role === 'unit') {
    const clips = input.animationNames ?? [];
    return {
      role,
      kind: 'unit',
      layer: 'unit',
      footprint: 'circle',
      scale: round(Math.min(1, UNIT_FIT_WIDTH / Math.max(width, depth, 0.01))),
      elevationOffset: 0.08,
      rotationSteps: facing.rotationSteps,
      rotationRadians: facing.rotationRadians,
      facingErrorRadians: facing.facingErrorRadians,
      blocksMovement: true,
      anchor: 'bottom-center',
      modelForward,
      boardForwardEdge: facing.boardForwardEdge,
      animation: clips.length > 0
        ? {
            source: 'embedded',
            clips,
            defaultClip: preferredAnimationClip(clips),
            loop: true,
          }
        : undefined,
    };
  }
  if (role === 'tile') {
    return {
      role,
      kind: 'terrain',
      layer: 'terrain',
      footprint: 'hex',
      scale: round(Math.min(KAYKIT_HEX_WIDTH / Math.max(width, 0.01), KAYKIT_HEX_DEPTH / Math.max(depth, 0.01))),
      elevationOffset: 0,
      rotationSteps: facing.rotationSteps,
      rotationRadians: facing.rotationRadians,
      facingErrorRadians: facing.facingErrorRadians,
      blocksMovement: false,
      anchor: 'bottom-center',
      modelForward,
      boardForwardEdge: facing.boardForwardEdge,
    };
  }

  return {
    role,
    kind: input.intendedRole === 'structure' ? 'structure' : 'prop',
    layer: input.intendedRole === 'structure' ? 'structure' : 'feature',
    footprint: footprintFor(width, depth),
    scale: round(Math.min(1, (Math.min(KAYKIT_HEX_WIDTH, KAYKIT_HEX_DEPTH) * PROP_FIT_RATIO) / Math.max(width, depth, 0.01))),
    elevationOffset: Math.max(0.04, Math.min(0.12, height * 0.02)),
    rotationSteps: facing.rotationSteps,
    rotationRadians: facing.rotationRadians,
    facingErrorRadians: facing.facingErrorRadians,
    blocksMovement: input.intendedRole === 'structure',
    anchor: 'bottom-center',
    modelForward,
    boardForwardEdge: facing.boardForwardEdge,
  };
}

function footprintFor(width: number, depth: number): ExternalAssetFootprintKind {
  if (width <= 0 || depth <= 0) {
    return 'point';
  }
  const ratio = width / depth;
  if (Math.abs(ratio - 1) < 0.12) {
    return 'square';
  }
  if (Math.abs(ratio - KAYKIT_HEX_GEOMETRY.width / KAYKIT_HEX_GEOMETRY.depth) < 0.12) {
    return 'hex';
  }
  return 'rectangle';
}

function preferredAnimationClip(clips: readonly string[]): string | undefined {
  return clips.find((clip) => /walk/i.test(clip)) ?? clips.find((clip) => /idle/i.test(clip)) ?? clips[0];
}

function modelForwardYaw(axis: ExternalAssetForwardAxis): number {
  switch (axis) {
    case '+z':
      return 0;
    case '+x':
      return Math.PI / 2;
    case '-z':
      return Math.PI;
    case '-x':
      return -Math.PI / 2;
  }
}

function shortestAngle(radians: number): number {
  return Math.atan2(Math.sin(radians), Math.cos(radians));
}

function normalizeRotationSteps(steps: number): number {
  return ((steps % 6) + 6) % 6;
}

function normalizeEdge(edge: HexEdgeIndex): HexEdgeIndex {
  return normalizeRotationSteps(Math.floor(edge)) as HexEdgeIndex;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
