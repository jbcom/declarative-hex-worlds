/**
 * External asset compatibility analysis for KayKit hex fit, facing correction,
 * placement recommendations, and spawn-option defaults.
 *
 * @module
 */
import { KAYKIT_HEX_DEPTH, KAYKIT_HEX_GEOMETRY, KAYKIT_HEX_WIDTH } from './coordinates';
import type { SpawnGameboardPlacementOptions } from './koota';
import type { AssetBounds, HexCoordinates, HexEdgeIndex } from './types';

/**
 * Intended use for an external GLB/GLTF before the compatibility pass evaluates
 * whether it actually fits KayKit hex geometry.
 */
export type ExternalAssetIntendedRole = 'tile' | 'prop' | 'structure' | 'unit';

/**
 * Role suggested by the compatibility pass after bounds, rig, and requested
 * role are considered.
 */
export type ExternalAssetSuggestedRole = 'tile' | 'prop' | 'unit';

/**
 * Coarse footprint shape inferred for an external asset.
 */
export type ExternalAssetFootprintKind = 'hex' | 'circle' | 'square' | 'rectangle' | 'point';

/**
 * Model-local forward axis used to align rigged units or directional props to
 * a board edge.
 */
export type ExternalAssetForwardAxis = '+x' | '-x' | '+z' | '-z';

/**
 * Placement anchor recommendation for external models.
 */
export type ExternalAssetAnchor = 'center' | 'bottom-center';

/**
 * Metadata extracted from, or supplied alongside, one external GLB/GLTF.
 */
export interface ExternalAssetCompatibilityInput {
  /** Stable external asset id. */
  id: string;
  /** Human-readable source pack name, such as `Kenney Castle Kit`. */
  sourcePack: string;
  /** Optional creator attribution. */
  creator?: string;
  /** Optional license label for docs or local reports. */
  license?: string;
  /** Bounds extracted from model geometry. */
  bounds: AssetBounds;
  /** How the caller hoped to use the asset before fit analysis. */
  intendedRole?: ExternalAssetIntendedRole;
  /** Whether the model has a skin/armature. */
  hasRig?: boolean;
  /** Animation clip names discovered in the model. */
  animationNames?: readonly string[];
  /** Material slot names discovered in the model. */
  materialSlots?: readonly string[];
  /** Model-local forward axis for facing correction. */
  modelForward?: ExternalAssetForwardAxis;
  /** Desired board edge the model should face after placement. */
  boardForwardEdge?: HexEdgeIndex;
}

/**
 * KayKit tile-footprint fit measurements for an external model.
 */
export interface ExternalAssetTileCompatibility {
  /** True when width/depth ratio and scale are close enough for a KayKit tile. */
  compatible: boolean;
  /** Uniform board width divided by model width. */
  widthScale: number;
  /** Uniform board depth divided by model depth. */
  depthScale: number;
  /** Smaller of width/depth scale, useful for safe prop scaling. */
  uniformScale: number;
  /** Model width/depth ratio. */
  aspectRatio: number;
  /** KayKit tile width/depth ratio. */
  expectedAspectRatio: number;
  /** Absolute ratio difference. */
  aspectRatioDelta: number;
  /** Relative difference between width and depth scale. */
  scaleMismatch: number;
}

/**
 * Placement metadata a game can apply when registering the external asset as a
 * custom gameboard piece or runtime placement.
 */
export interface ExternalAssetPlacementRecommendation {
  /** Suggested high-level role. */
  role: ExternalAssetSuggestedRole;
  /** Gameboard placement kind to use. */
  kind: 'prop' | 'structure' | 'unit' | 'terrain';
  /** Gameboard render/collision layer to use. */
  layer: 'feature' | 'structure' | 'unit' | 'terrain';
  /** Inferred footprint family. */
  footprint: ExternalAssetFootprintKind;
  /** Recommended uniform scale. */
  scale: number;
  /** Vertical offset to place the model on top of the hex surface. */
  elevationOffset: number;
  /** 60-degree rotation steps needed for best facing alignment. */
  rotationSteps: number;
  /** Rotation in radians equivalent to `rotationSteps`. */
  rotationRadians: number;
  /** Remaining angle error after hex-step rotation. */
  facingErrorRadians: number;
  /** Whether the placement should block actor movement by default. */
  blocksMovement: boolean;
  /** Anchor point the recommendation assumes. */
  anchor: ExternalAssetAnchor;
  /** Model-local forward axis used for this recommendation. */
  modelForward: ExternalAssetForwardAxis;
  /** Board edge the model is intended to face. */
  boardForwardEdge: HexEdgeIndex;
  /** Animation recommendation when embedded clips are present. */
  animation?: {
    /** Where clips were discovered. */
    source: 'embedded' | 'external';
    /** Available clip names. */
    clips: readonly string[];
    /** Preferred default clip for idle/walk presentation. */
    defaultClip?: string;
    /** Whether the clip should loop by default. */
    loop: boolean;
  };
}

/**
 * Input for hex-edge facing correction.
 */
export interface ExternalAssetFacingOptions {
  /** Model-local forward axis. Defaults to `+z`. */
  modelForward?: ExternalAssetForwardAxis;
  /** Board edge the model should face. Defaults to edge `1`. */
  boardForwardEdge?: HexEdgeIndex;
}

/**
 * Facing correction expressed in both hex rotation steps and radians.
 */
export interface ExternalAssetFacingRecommendation {
  /** Model-local forward axis used for the calculation. */
  modelForward: ExternalAssetForwardAxis;
  /** Target board edge after placement. */
  boardForwardEdge: HexEdgeIndex;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps: number;
  /** Rotation in radians. */
  rotationRadians: number;
  /** Remaining angle error after quantizing to hex steps. */
  facingErrorRadians: number;
}

/**
 * Complete compatibility report for one external asset.
 */
export interface ExternalAssetCompatibilityReport {
  /** Stable external asset id. */
  id: string;
  /** Source pack label. */
  sourcePack: string;
  /** Whether the model can act as a KayKit-shaped tile without overrides. */
  compatibleAsTile: boolean;
  /** Tile-fit measurements. */
  tile: ExternalAssetTileCompatibility;
  /** Suggested role after analysis. */
  suggestedRole: ExternalAssetSuggestedRole;
  /** Placement metadata suitable for custom piece registration. */
  placement: ExternalAssetPlacementRecommendation;
  /** Non-fatal issues a build tool or editor should show. */
  warnings: readonly string[];
  /** Fatal issues that make placement unsafe. */
  errors: readonly string[];
}

/**
 * Input for converting a compatibility report into runtime spawn options.
 */
export interface ExternalAssetSpawnOptionsInput {
  /** Optional placement id. */
  id?: string;
  /** Target tile for the placement. */
  at: HexCoordinates | string;
  /** Asset id used by the host app or local source URL map. */
  assetId: string;
  /** Compatibility report produced for the asset. */
  report: ExternalAssetCompatibilityReport;
  /** Optional model URL, often a Vite `@fs` URL in local tests. */
  sourceUrl?: string;
  /** Optional source pack override for metadata. */
  sourcePack?: string;
  /** Optional rotation override. */
  rotationSteps?: number;
  /** Optional scale override. */
  scale?: number;
  /** Extra metadata merged after compatibility metadata. */
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

const TILE_RATIO_TOLERANCE = 0.08;
const TILE_SCALE_TOLERANCE = 0.08;
const PROP_FIT_RATIO = 0.72;
const UNIT_FIT_WIDTH = 0.72;

/**
 * Evaluates an external GLB/GLTF against KayKit hex dimensions and returns the
 * placement role, scale, facing, animation, warning, and error data needed for
 * local piece registration.
 */
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

/**
 * Converts an external compatibility report into `spawnGameboardPlacement`
 * options, preserving local-only metadata and marking the placement as EXTRA.
 */
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

/**
 * Computes the nearest hex-step yaw correction for a model-local forward axis.
 */
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
