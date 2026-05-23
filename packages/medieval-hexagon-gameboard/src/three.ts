import {
  AnimationMixer,
  MathUtils,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
  Vector3,
} from 'three';
import type { GameboardInteractionTargetInput } from './actors';
import type { GameboardPlacementSpec } from './gameboard';
import { axialToWorld } from './grid';
import type { GameboardPlacementPositionOffset } from './koota';
import {
  getManifestAsset,
  resolveManifestAssetUrl,
  type ManifestAssetCatalog,
  type ManifestAssetUrlOptions,
} from './manifest/schema';
import type { HexCoordinates, MedievalHexagonAsset, VariantSelection, WorldPosition } from './types';

export interface AssetTransform {
  position: WorldPosition;
  rotationY: number;
  scale: number;
}

export interface GameboardPlacementAssetUrlOptions extends ManifestAssetUrlOptions {
  catalog?: ManifestAssetCatalog;
  assetUrls?: Readonly<Record<string, string>>;
  fallback?: (placement: GameboardPlacementSpec) => string | undefined;
}

export type GameboardPlacementAssetUrlResolver = (placement: GameboardPlacementSpec) => string | undefined;

export interface GameboardPlacementAnimationUrlOptions {
  animationUrls?: Readonly<Record<string, string>>;
  animationUrlResolver?: (placement: GameboardPlacementSpec) => string | undefined;
}

export interface GameboardGltfLike {
  scene: Object3D;
  animations?: readonly AnimationClip[];
}

export interface GameboardGltfLoader {
  loadAsync(url: string): Promise<GameboardGltfLike>;
}

export interface LoadGameboardPlacementObjectOptions
  extends GameboardPlacementAssetUrlOptions,
    GameboardPlacementAnimationUrlOptions {
  loader: GameboardGltfLoader;
  clipName?: string;
  playAnimation?: boolean;
}

export interface LoadedGameboardPlacementObject {
  placementId: string;
  assetId: string;
  object: Object3D;
  modelUrl: string;
  animationUrl?: string;
  transform: AssetTransform;
  clips: readonly AnimationClip[];
  activeClip?: AnimationClip;
  mixer?: AnimationMixer;
  animationAction?: AnimationAction;
}

export interface GameboardObjectUserData {
  placementId: string;
  tileKey: string;
  assetId: string;
  kind: GameboardPlacementSpec['kind'];
  layer: GameboardPlacementSpec['layer'];
  requiresExtra: boolean;
  actorId?: string;
  actorKind?: string;
  sourcePack?: string;
}

export interface GameboardPlacementObjectSyncOptions
  extends LoadGameboardPlacementObjectOptions {
  parent?: Object3D;
  records?: Map<string, LoadedGameboardPlacementObject>;
  removeStale?: boolean;
  deltaSeconds?: number;
  clipNameResolver?: (placement: GameboardPlacementSpec) => string | undefined;
  throwOnError?: boolean;
}

export interface GameboardPlacementObjectSyncError {
  placement: GameboardPlacementSpec;
  error: unknown;
}

export interface GameboardPlacementObjectSyncResult {
  records: Map<string, LoadedGameboardPlacementObject>;
  loaded: readonly LoadedGameboardPlacementObject[];
  updated: readonly LoadedGameboardPlacementObject[];
  removed: readonly LoadedGameboardPlacementObject[];
  errors: readonly GameboardPlacementObjectSyncError[];
}

export function resolveAssetUrl(asset: MedievalHexagonAsset, baseUrl?: string | URL): string {
  if (!baseUrl) {
    return asset.modelPath;
  }
  return new URL(asset.modelPath, baseUrl).toString();
}

export function resolveGameboardPlacementAssetUrl(
  placement: GameboardPlacementSpec,
  options: GameboardPlacementAssetUrlOptions = {}
): string | undefined {
  const mappedUrl = options.assetUrls?.[placement.assetId];
  if (mappedUrl) {
    return mappedUrl;
  }
  const metadataUrl = placement.metadata.sourceUrl;
  if (typeof metadataUrl === 'string' && metadataUrl.length > 0) {
    return metadataUrl;
  }
  const asset = options.catalog ? getManifestAsset(options.catalog, placement.assetId) : undefined;
  if (asset) {
    return resolveManifestAssetUrl(asset, options);
  }
  return options.fallback?.(placement);
}

export function createGameboardPlacementAssetUrlResolver(
  options: GameboardPlacementAssetUrlOptions = {}
): GameboardPlacementAssetUrlResolver {
  return (placement) => resolveGameboardPlacementAssetUrl(placement, options);
}

export function resolveGameboardPlacementAnimationUrl(
  placement: GameboardPlacementSpec,
  options: GameboardPlacementAnimationUrlOptions = {}
): string | undefined {
  const mappedUrl = options.animationUrls?.[placement.assetId];
  if (mappedUrl) {
    return mappedUrl;
  }
  const metadataUrl = placement.metadata.animationSourceUrl ?? placement.metadata.animationUrl;
  if (typeof metadataUrl === 'string' && metadataUrl.length > 0) {
    return metadataUrl;
  }
  return options.animationUrlResolver?.(placement);
}

export async function loadGameboardPlacementObject(
  placement: GameboardPlacementSpec,
  options: LoadGameboardPlacementObjectOptions
): Promise<LoadedGameboardPlacementObject> {
  const modelUrl = resolveGameboardPlacementAssetUrl(placement, options);
  if (!modelUrl) {
    throw new Error(`No model URL resolved for placement ${placement.id} (${placement.assetId})`);
  }

  const model = await options.loader.loadAsync(modelUrl);
  const transform = transformForPlacement(placement);
  const object = applyTransform(model.scene, transform);
  tagGameboardPlacementObject(object, placement);
  const animationUrl = resolveGameboardPlacementAnimationUrl(placement, options);
  const animation = animationUrl ? await options.loader.loadAsync(animationUrl) : undefined;
  const clips = [...(animation?.animations ?? []), ...(model.animations ?? [])];
  const clip = selectAnimationClip(clips, options.clipName ?? placementAnimationClipName(placement));
  const mixer = clip ? new AnimationMixer(object) : undefined;
  const animationAction = clip && mixer ? mixer.clipAction(clip) : undefined;
  if (animationAction && options.playAnimation !== false) {
    animationAction.play();
  }

  return {
    placementId: placement.id,
    assetId: placement.assetId,
    object,
    modelUrl,
    animationUrl,
    transform,
    clips,
    activeClip: clip,
    mixer,
    animationAction,
  };
}

export async function syncGameboardPlacementObjects(
  placements: readonly GameboardPlacementSpec[],
  options: GameboardPlacementObjectSyncOptions
): Promise<GameboardPlacementObjectSyncResult> {
  const {
    records = new Map<string, LoadedGameboardPlacementObject>(),
    parent,
    removeStale = true,
    deltaSeconds,
    clipNameResolver,
    throwOnError,
    ...loadOptions
  } = options;
  const activePlacementIds = new Set(placements.map((placement) => placement.id));
  const loaded: LoadedGameboardPlacementObject[] = [];
  const updated: LoadedGameboardPlacementObject[] = [];
  const removed: LoadedGameboardPlacementObject[] = [];
  const errors: GameboardPlacementObjectSyncError[] = [];

  for (const placement of placements) {
    const existing = records.get(placement.id);
    const nextModelUrl = resolveGameboardPlacementAssetUrl(placement, loadOptions);
    const nextAnimationUrl = resolveGameboardPlacementAnimationUrl(placement, loadOptions);
    const shouldReload =
      !existing ||
      existing.assetId !== placement.assetId ||
      (nextModelUrl !== undefined && existing.modelUrl !== nextModelUrl) ||
      existing.animationUrl !== nextAnimationUrl;

    if (!shouldReload) {
      syncGameboardPlacementObject(existing, placement, { deltaSeconds });
      updated.push(existing);
      continue;
    }

    if (existing) {
      removeLoadedPlacementObject(existing, parent);
      records.delete(existing.placementId);
      removed.push(existing);
    }

    try {
      const loadedPlacement = await loadGameboardPlacementObject(placement, {
        ...loadOptions,
        clipName: clipNameResolver?.(placement) ?? loadOptions.clipName,
      });
      records.set(placement.id, loadedPlacement);
      if (parent) {
        parent.add(loadedPlacement.object);
      }
      if (deltaSeconds !== undefined) {
        updateGameboardPlacementAnimation(loadedPlacement, deltaSeconds);
      }
      loaded.push(loadedPlacement);
    } catch (error) {
      errors.push({ placement, error });
      if (throwOnError) {
        throw error;
      }
    }
  }

  if (removeStale) {
    for (const [placementId, record] of [...records]) {
      if (activePlacementIds.has(placementId)) {
        continue;
      }
      removeLoadedPlacementObject(record, parent);
      records.delete(placementId);
      removed.push(record);
    }
  }

  return {
    records,
    loaded,
    updated,
    removed,
    errors,
  };
}

export function syncGameboardPlacementObject(
  loaded: LoadedGameboardPlacementObject,
  placement: GameboardPlacementSpec,
  options: { deltaSeconds?: number } = {}
): LoadedGameboardPlacementObject {
  loaded.placementId = placement.id;
  loaded.assetId = placement.assetId;
  loaded.transform = transformForPlacement(placement);
  applyTransform(loaded.object, loaded.transform);
  tagGameboardPlacementObject(loaded.object, placement);
  if (options.deltaSeconds !== undefined) {
    updateGameboardPlacementAnimation(loaded, options.deltaSeconds);
  }
  return loaded;
}

export function tagGameboardPlacementObject(
  object: Object3D,
  placement: GameboardPlacementSpec,
  options: { recursive?: boolean } = {}
): Object3D {
  const data = gameboardUserDataForPlacement(placement);
  applyGameboardUserData(object, data);
  if (options.recursive) {
    object.traverse((child) => {
      applyGameboardUserData(child, data);
    });
  }
  return object;
}

export function readGameboardPlacementObjectUserData(object: Object3D): GameboardObjectUserData | undefined {
  return isGameboardObjectUserData(object.userData.gameboardPlacement) ? object.userData.gameboardPlacement : undefined;
}

export function findGameboardPlacementObjectUserData(object: Object3D): GameboardObjectUserData | undefined {
  let current: Object3D | null = object;
  while (current) {
    const data = readGameboardPlacementObjectUserData(current);
    if (data) {
      return data;
    }
    current = current.parent;
  }
  return undefined;
}

export function findLoadedGameboardPlacementObjectForObject(
  object: Object3D,
  records: ReadonlyMap<string, LoadedGameboardPlacementObject>
): LoadedGameboardPlacementObject | undefined {
  const data = findGameboardPlacementObjectUserData(object);
  return data ? records.get(data.placementId) : undefined;
}

export function gameboardInteractionTargetForObject(object: Object3D): GameboardInteractionTargetInput | undefined {
  const data = findGameboardPlacementObjectUserData(object);
  if (!data) {
    return undefined;
  }
  return {
    placementId: data.placementId,
    actorId: data.actorId,
    tileKey: data.tileKey,
  };
}

export function updateGameboardPlacementAnimation(
  loaded: Pick<LoadedGameboardPlacementObject, 'mixer'>,
  deltaSeconds: number
): void {
  loaded.mixer?.update(deltaSeconds);
}

export function transformForHex(
  coordinates: HexCoordinates,
  options: { elevation?: number; positionOffset?: GameboardPlacementPositionOffset; rotationY?: number; scale?: number } = {}
): AssetTransform {
  const position = axialToWorld(coordinates, options.elevation ?? 0);
  return {
    position: {
      x: position.x + (options.positionOffset?.x ?? 0),
      y: position.y + (options.positionOffset?.y ?? 0),
      z: position.z + (options.positionOffset?.z ?? 0),
    },
    rotationY: options.rotationY ?? 0,
    scale: options.scale ?? 1,
  };
}

export function transformForVariant(
  coordinates: HexCoordinates,
  variant: VariantSelection,
  options: { elevation?: number; positionOffset?: GameboardPlacementPositionOffset; scale?: number } = {}
): AssetTransform {
  return transformForHex(coordinates, {
    elevation: options.elevation,
    positionOffset: options.positionOffset,
    rotationY: variant.rotationRadians,
    scale: options.scale,
  });
}

export function transformForPlacement(placement: GameboardPlacementSpec): AssetTransform {
  return {
    position: { ...placement.position },
    rotationY: placement.rotationRadians,
    scale: placement.scale,
  };
}

export function applyTransform(object: Object3D, transform: AssetTransform): Object3D {
  object.position.set(transform.position.x, transform.position.y, transform.position.z);
  object.rotation.set(0, transform.rotationY, 0);
  object.scale.setScalar(transform.scale);
  return object;
}

export function placeObjectOnHex(
  object: Object3D,
  coordinates: HexCoordinates,
  options: { elevation?: number; positionOffset?: GameboardPlacementPositionOffset; rotationY?: number; scale?: number } = {}
): Object3D {
  return applyTransform(object, transformForHex(coordinates, options));
}

export function frameObjectPosition(asset: MedievalHexagonAsset, margin = 1.7): Vector3 {
  const maxDimension = Math.max(asset.bounds.size[0], asset.bounds.size[1], asset.bounds.size[2], 1);
  const distance = MathUtils.clamp(maxDimension * margin, 2.5, 8);
  return new Vector3(distance, distance * 0.75, distance);
}

function placementAnimationClipName(placement: GameboardPlacementSpec): string | undefined {
  const value = placement.metadata.animationDefaultClip;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function selectAnimationClip(
  clips: readonly AnimationClip[],
  clipName: string | undefined
): AnimationClip | undefined {
  if (clipName) {
    return clips.find((clip) => clip.name === clipName) ?? clips[0];
  }
  return clips[0];
}

function removeLoadedPlacementObject(
  loaded: LoadedGameboardPlacementObject,
  parent: Object3D | undefined
): void {
  if (parent) {
    parent.remove(loaded.object);
    return;
  }
  loaded.object.removeFromParent();
}

function gameboardUserDataForPlacement(placement: GameboardPlacementSpec): GameboardObjectUserData {
  const actorId = stringMetadata(placement.metadata.actorId);
  const actorKind = stringMetadata(placement.metadata.actorKind);
  const sourcePack = stringMetadata(placement.metadata.sourcePack);
  return {
    placementId: placement.id,
    tileKey: placement.tileKey,
    assetId: placement.assetId,
    kind: placement.kind,
    layer: placement.layer,
    requiresExtra: placement.requiresExtra,
    ...(actorId ? { actorId } : {}),
    ...(actorKind ? { actorKind } : {}),
    ...(sourcePack ? { sourcePack } : {}),
  };
}

function applyGameboardUserData(object: Object3D, data: GameboardObjectUserData): void {
  object.userData.gameboardPlacement = { ...data };
  object.userData.gameboardPlacementId = data.placementId;
  object.userData.gameboardTileKey = data.tileKey;
  object.userData.gameboardAssetId = data.assetId;
}

function isGameboardObjectUserData(value: unknown): value is GameboardObjectUserData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as GameboardObjectUserData;
  return (
    typeof candidate.placementId === 'string' &&
    typeof candidate.tileKey === 'string' &&
    typeof candidate.assetId === 'string' &&
    typeof candidate.kind === 'string' &&
    typeof candidate.layer === 'string' &&
    typeof candidate.requiresExtra === 'boolean'
  );
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
