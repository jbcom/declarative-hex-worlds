/**
 * Three.js helpers for resolving asset URLs, loading GLTF scenes, syncing
 * transforms, raycast lookup, and animation clip metadata.
 *
 * @module
 */
import {
  AnimationMixer,
  MathUtils,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
  Vector3,
} from 'three';
import { clone as cloneWithSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GameboardInteractionTargetInput } from '../actors';
import { GameboardRuntimeError } from '../errors';
import type { GameboardPlacementSpec } from '../gameboard';
import { axialToWorld } from '../coordinates';
import type { GameboardPlacementPositionOffset } from '../koota';
import {
  getManifestAsset,
  resolveManifestAssetUrl,
  type ManifestAssetCatalog,
  type ManifestAssetUrlOptions,
} from '../manifest';
import type { HexCoordinates, MedievalHexagonAsset, VariantSelection, WorldPosition } from '../types';

/**
 * Render transform for a placement or tile in Three.js coordinates.
 */
export interface AssetTransform {
  /** World-space position for the object origin. */
  position: WorldPosition;
  /** Y-axis rotation in radians. */
  rotationY: number;
  /** Uniform object scale. */
  scale: number;
}

/**
 * URL resolution inputs for gameboard placement models.
 */
export interface GameboardPlacementAssetUrlOptions extends ManifestAssetUrlOptions {
  /** Manifest or manifest bundle used for packaged FREE/EXTRA asset ids. */
  catalog?: ManifestAssetCatalog;
  /** Explicit asset-id-to-URL overrides, useful for local-only Vite `@fs` assets. */
  assetUrls?: Readonly<Record<string, string>>;
  /** Last-chance resolver for app-specific asset stores. */
  fallback?: (placement: GameboardPlacementSpec) => string | undefined;
}

/**
 * Function that maps a placement to a model URL.
 */
export type GameboardPlacementAssetUrlResolver = (placement: GameboardPlacementSpec) => string | undefined;

/**
 * URL resolution inputs for external animation clips.
 */
export interface GameboardPlacementAnimationUrlOptions {
  /** Explicit asset-id-to-animation-URL map. */
  animationUrls?: Readonly<Record<string, string>>;
  /** App-specific animation URL resolver. */
  animationUrlResolver?: (placement: GameboardPlacementSpec) => string | undefined;
}

/**
 * Minimal GLTF loader result shape used by the renderer helpers.
 */
export interface GameboardGltfLike {
  /** Root Three.js scene/object loaded from GLTF. */
  scene: Object3D;
  /** Animation clips embedded in the GLTF. */
  animations?: readonly AnimationClip[];
}

/**
 * Minimal async loader contract compatible with `GLTFLoader`.
 */
export interface GameboardGltfLoader {
  /** Loads a GLTF/GLB URL and returns the scene plus optional clips. */
  loadAsync(url: string): Promise<GameboardGltfLike>;
}

/**
 * Per-URL memoization cache for a given loader instance. Holds in-flight and
 * resolved loads so N placements sharing a URL trigger exactly one
 * `loadAsync` call. Keyed per loader (via a module-level `WeakMap`) so
 * distinct loader instances never share results.
 */
type GameboardGltfLoadCache = Map<string, Promise<GameboardGltfLike>>;

/**
 * Module-level cache of per-loader URL memoization maps. Scoped by loader
 * identity so callers using distinct loader instances (e.g. per test, per
 * app instance) never see cross-contamination, and unreferenced loaders are
 * eligible for garbage collection.
 */
const gltfLoadCachesByLoader = new WeakMap<GameboardGltfLoader, GameboardGltfLoadCache>();

/**
 * Maximum number of resolved-or-pending URLs retained per loader's cache.
 * Long-lived apps that swap boards repeatedly (each with its own asset URLs)
 * would otherwise grow this cache without bound. 128 comfortably covers a
 * full KayKit FREE + EXTRA manifest's worth of distinct model/animation URLs
 * in view at once while still bounding memory for apps that churn through
 * many more boards over a session.
 */
const GLTF_LOAD_CACHE_MAX_ENTRIES = 128;

/**
 * Loads a GLTF URL through the per-loader memoization cache, deduplicating
 * concurrent and repeated loads of the same URL. Rejected loads are evicted
 * from the cache so the next call retries instead of permanently caching a
 * failure. Resolved entries are retained as a bounded LRU (capped at
 * `GLTF_LOAD_CACHE_MAX_ENTRIES`): a cache hit refreshes the URL's recency, and
 * inserting beyond the cap evicts the least-recently-used URL.
 */
function loadGltfCached(loader: GameboardGltfLoader, url: string, cacheLoads: boolean): Promise<GameboardGltfLike> {
  if (!cacheLoads) {
    return loader.loadAsync(url);
  }

  let cache = gltfLoadCachesByLoader.get(loader);
  if (!cache) {
    cache = new Map();
    gltfLoadCachesByLoader.set(loader, cache);
  }

  const cached = cache.get(url);
  if (cached) {
    // Refresh recency: Map iteration order follows insertion order, so a
    // delete+set re-insert moves this URL to the most-recently-used end.
    cache.delete(url);
    cache.set(url, cached);
    return cached;
  }

  const pending = loader.loadAsync(url);
  cache.set(url, pending);
  evictLeastRecentlyUsed(cache);
  pending.catch(() => {
    // Evict by identity: after LRU eviction plus a fresh request for the same
    // URL, this stale rejection must not delete the newer in-flight entry.
    if (cache?.get(url) === pending) {
      cache.delete(url);
    }
  });
  return pending;
}

/**
 * Evicts the oldest (least-recently-used) entry once the cache exceeds its
 * capacity. Map keys iterate in insertion order, and reads/inserts in
 * `loadGltfCached` always re-insert on access, so the first key is always the
 * least-recently-used one.
 */
function evictLeastRecentlyUsed(cache: GameboardGltfLoadCache): void {
  if (cache.size <= GLTF_LOAD_CACHE_MAX_ENTRIES) {
    return;
  }
  // Guaranteed defined: cache.size > GLTF_LOAD_CACHE_MAX_ENTRIES (>= 1) means
  // at least one key exists to iterate.
  const oldestKey = cache.keys().next().value as string;
  cache.delete(oldestKey);
}

/**
 * Options for loading one placement object.
 */
export interface LoadGameboardPlacementObjectOptions
  extends GameboardPlacementAssetUrlOptions,
    GameboardPlacementAnimationUrlOptions {
  /** GLTF-compatible async loader. */
  loader: GameboardGltfLoader;
  /** Optional clip name override. Defaults to placement metadata when present. */
  clipName?: string;
  /** Whether to start the selected animation immediately. Defaults to true. */
  playAnimation?: boolean;
  /**
   * Deduplicates loader calls by URL so multiple placements sharing an asset
   * trigger exactly one `loadAsync` invocation. The cached GLTF source is
   * never mutated directly — each placement still receives its own cloned
   * `Object3D` scene instance. Defaults to `true`.
   */
  cacheLoads?: boolean;
}

/**
 * Loaded Three.js object plus gameboard metadata and animation state.
 */
export interface LoadedGameboardPlacementObject {
  /** Placement id this object represents. */
  placementId: string;
  /** Asset id this object was loaded from. */
  assetId: string;
  /** Three.js object added to the scene. */
  object: Object3D;
  /** Resolved model URL. */
  modelUrl: string;
  /** Resolved animation URL, when separate from the model. */
  animationUrl?: string;
  /** Last transform applied to the object. */
  transform: AssetTransform;
  /** Available animation clips from model and optional animation source. */
  clips: readonly AnimationClip[];
  /** Selected active clip. */
  activeClip?: AnimationClip;
  /** Animation mixer bound to the loaded object. */
  mixer?: AnimationMixer;
  /** Action created for the active clip. */
  animationAction?: AnimationAction;
}

/**
 * User-data payload attached to rendered objects for picking and interaction.
 */
export interface GameboardObjectUserData {
  /** Placement id represented by this object. */
  placementId: string;
  /** Origin tile key. */
  tileKey: string;
  /** Source asset id. */
  assetId: string;
  /** Placement kind from the gameboard plan. */
  kind: GameboardPlacementSpec['kind'];
  /** Placement layer from the gameboard plan. */
  layer: GameboardPlacementSpec['layer'];
  /** Whether this object depends on local EXTRA or external assets. */
  requiresExtra: boolean;
  /** Actor id when the placement represents a runtime actor. */
  actorId?: string;
  /** Actor kind when supplied by placement metadata. */
  actorKind?: string;
  /** Source pack label for external pieces. */
  sourcePack?: string;
}

/**
 * Options for reconciling a Three.js scene with a placement list.
 */
export interface GameboardPlacementObjectSyncOptions
  extends LoadGameboardPlacementObjectOptions {
  /** Parent object to receive loaded placement objects. */
  parent?: Object3D;
  /** Mutable cache keyed by placement id. */
  records?: Map<string, LoadedGameboardPlacementObject>;
  /** Remove cached objects that no longer appear in the placement list. */
  removeStale?: boolean;
  /** Optional animation delta to advance during this sync pass. */
  deltaSeconds?: number;
  /** Per-placement clip-name resolver. */
  clipNameResolver?: (placement: GameboardPlacementSpec) => string | undefined;
  /** Rethrow load errors instead of collecting them in the result. */
  throwOnError?: boolean;
}

/**
 * Load/sync error for a specific placement.
 */
export interface GameboardPlacementObjectSyncError {
  /** Placement that failed to load or sync. */
  placement: GameboardPlacementSpec;
  /** Original error value. */
  error: unknown;
}

/**
 * Result of a placement-object sync pass.
 */
export interface GameboardPlacementObjectSyncResult {
  /** Final mutable cache keyed by placement id. */
  records: Map<string, LoadedGameboardPlacementObject>;
  /** Objects loaded during this pass. */
  loaded: readonly LoadedGameboardPlacementObject[];
  /** Existing objects updated in place during this pass. */
  updated: readonly LoadedGameboardPlacementObject[];
  /** Objects removed during this pass. */
  removed: readonly LoadedGameboardPlacementObject[];
  /** Non-fatal load errors collected during this pass. */
  errors: readonly GameboardPlacementObjectSyncError[];
}

/**
 * Resolves a manifest asset's model path with an optional base URL.
 */
export function resolveAssetUrl(asset: MedievalHexagonAsset, baseUrl?: string | URL): string {
  if (!baseUrl) {
    return asset.modelPath;
  }
  return new URL(asset.modelPath, baseUrl).toString();
}

/**
 * Resolves the model URL for a placement from explicit maps, placement
 * metadata, a manifest catalog, or a fallback resolver.
 */
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

/**
 * Creates a reusable placement-to-model URL resolver.
 */
export function createGameboardPlacementAssetUrlResolver(
  options: GameboardPlacementAssetUrlOptions = {}
): GameboardPlacementAssetUrlResolver {
  return (placement) => resolveGameboardPlacementAssetUrl(placement, options);
}

/**
 * Resolves a separate animation URL for a placement when the model does not
 * carry the desired clips.
 */
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

/**
 * Loads one placement model, applies the placement transform, tags user data,
 * and prepares optional animation playback.
 */
export async function loadGameboardPlacementObject(
  placement: GameboardPlacementSpec,
  options: LoadGameboardPlacementObjectOptions
): Promise<LoadedGameboardPlacementObject> {
  const modelUrl = resolveGameboardPlacementAssetUrl(placement, options);
  if (!modelUrl) {
    throw new GameboardRuntimeError(`No model URL resolved for placement ${placement.id} (${placement.assetId})`);
  }

  const cacheLoads = options.cacheLoads ?? true;
  const model = await loadGltfCached(options.loader, modelUrl, cacheLoads);
  const transform = transformForPlacement(placement);
  // SkeletonUtils.clone (not Object3D.clone) rebinds SkinnedMesh skeletons to
  // the cloned bone hierarchy. Plain `.clone(true)` deep-clones bones but
  // leaves each SkinnedMesh's skeleton pointing at the ORIGINAL cached scene's
  // bones, so rigged GLTFs (e.g. KayKit Adventurers units) would animate/deform
  // against the wrong (shared) skeleton once more than one placement loads the
  // same cached model.
  const object = applyTransform(cloneWithSkeleton(model.scene), transform);
  tagGameboardPlacementObject(object, placement);
  const animationUrl = resolveGameboardPlacementAnimationUrl(placement, options);
  const animation = animationUrl ? await loadGltfCached(options.loader, animationUrl, cacheLoads) : undefined;
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

/**
 * Reconciles a Three.js object cache with the current placement list.
 *
 * Existing records are updated in place, changed asset URLs are reloaded, stale
 * records are removed by default, and load failures are returned unless
 * `throwOnError` is set.
 */
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

/**
 * Updates one loaded object to match the current placement transform and user
 * data.
 */
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

/**
 * Attaches gameboard picking metadata to a Three.js object.
 */
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

/**
 * Reads gameboard user data directly attached to an object.
 */
export function readGameboardPlacementObjectUserData(object: Object3D): GameboardObjectUserData | undefined {
  return isGameboardObjectUserData(object.userData.gameboardPlacement) ? object.userData.gameboardPlacement : undefined;
}

/**
 * Walks up the parent chain to find gameboard user data for a picked object.
 */
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

/**
 * Resolves a picked object back to the loaded placement record cache.
 */
export function findLoadedGameboardPlacementObjectForObject(
  object: Object3D,
  records: ReadonlyMap<string, LoadedGameboardPlacementObject>
): LoadedGameboardPlacementObject | undefined {
  const data = findGameboardPlacementObjectUserData(object);
  return data ? records.get(data.placementId) : undefined;
}

/**
 * Converts picked Three.js object metadata into an actor/placement/tile target
 * for command and interaction helpers.
 */
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

/**
 * Advances the animation mixer for one loaded placement object.
 */
export function updateGameboardPlacementAnimation(
  loaded: Pick<LoadedGameboardPlacementObject, 'mixer'>,
  deltaSeconds: number
): void {
  loaded.mixer?.update(deltaSeconds);
}

/**
 * Creates a transform from axial coordinates, optional elevation, and optional
 * placement offset.
 */
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

/**
 * Creates a transform from axial coordinates and a selected road/river/coast
 * variant rotation.
 */
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

/**
 * Converts a serialized placement into a Three.js transform.
 */
export function transformForPlacement(placement: GameboardPlacementSpec): AssetTransform {
  return {
    position: { ...placement.position },
    rotationY: placement.rotationRadians,
    scale: placement.scale,
  };
}

/**
 * Applies a gameboard transform to a Three.js object.
 */
export function applyTransform(object: Object3D, transform: AssetTransform): Object3D {
  object.position.set(transform.position.x, transform.position.y, transform.position.z);
  object.rotation.set(0, transform.rotationY, 0);
  object.scale.setScalar(transform.scale);
  return object;
}

/**
 * Places an object directly on a board hex without creating a placement record.
 */
export function placeObjectOnHex(
  object: Object3D,
  coordinates: HexCoordinates,
  options: { elevation?: number; positionOffset?: GameboardPlacementPositionOffset; rotationY?: number; scale?: number } = {}
): Object3D {
  return applyTransform(object, transformForHex(coordinates, options));
}

/**
 * Returns a camera-friendly offset for framing one manifest asset preview.
 */
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
