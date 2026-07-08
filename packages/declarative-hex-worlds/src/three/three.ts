/**
 * Three.js helpers for resolving asset URLs, loading GLTF scenes, syncing
 * transforms, raycast lookup, and animation clip metadata.
 *
 * @module
 */
import {
  type AnimationAction,
  type AnimationClip,
  AnimationMixer,
  type Material,
  MathUtils,
  Mesh,
  type Object3D,
  Vector3,
} from 'three';
import { clone as cloneWithSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GameboardInteractionTargetInput } from '../actors';
import type { AssetRenderRequest, AssetSource, AssetTransform } from '../asset-source';
import {
  type GameboardPlacementAnimationUrlOptions,
  type GameboardPlacementAssetUrlOptions,
  resolveGameboardPlacementAnimationUrl,
  resolveGameboardPlacementAssetUrl,
  transformForHex,
  transformForPlacement,
} from '../asset-source/placement-resolution';
import { GameboardRuntimeError } from '../errors';
import type { GameboardPlacementSpec } from '../gameboard';
import type { GameboardPlacementPositionOffset } from '../koota';
import type { HexCoordinates, MedievalHexagonAsset } from '../types';
import { buildTexturedHexMesh, type SheetTexture } from './textured-hex';

// AssetTransform moved to `src/asset-source` (RFC0-RENDER) so the render-request
// contract is backend-agnostic; re-exported here so `./three` keeps exporting it.
export type { AssetTransform } from '../asset-source';

// Placement→URL/transform resolution moved to the NEUTRAL asset-source layer
// (renderer-free) so the core never imports three. Re-exported here so the
// `declarative-hex-worlds/three` binding subpath keeps surfacing them for consumers.
export {
  createGameboardPlacementAssetUrlResolver,
  type GameboardPlacementAnimationUrlOptions,
  type GameboardPlacementAssetUrlOptions,
  type GameboardPlacementAssetUrlResolver,
  resolveAssetUrl,
  resolveGameboardPlacementAnimationUrl,
  resolveGameboardPlacementAssetUrl,
  transformForHex,
  transformForPlacement,
  transformForVariant,
} from '../asset-source/placement-resolution';

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
/**
 * Generic per-loader URL memoization: dedupes concurrent/repeated loads of the
 * same URL for a given loader identity, refreshes recency on hit, evicts the
 * least-recently-used entry past the cap, and evicts rejects by identity so the
 * next call retries. Shared by the GLTF loader and the sheet-texture loader — one
 * cache implementation, two asset kinds.
 */
function loadUrlCached<T>(
  cachesByLoader: WeakMap<object, Map<string, Promise<T>>>,
  loader: object,
  url: string,
  cacheLoads: boolean,
  load: (url: string) => Promise<T>
): Promise<T> {
  if (!cacheLoads) {
    return load(url);
  }

  let cache = cachesByLoader.get(loader);
  if (!cache) {
    cache = new Map();
    cachesByLoader.set(loader, cache);
  }

  const cached = cache.get(url);
  if (cached) {
    // Refresh recency: Map iteration order follows insertion order, so a
    // delete+set re-insert moves this URL to the most-recently-used end.
    cache.delete(url);
    cache.set(url, cached);
    return cached;
  }

  const pending = load(url);
  cache.set(url, pending);
  if (cache.size > GLTF_LOAD_CACHE_MAX_ENTRIES) {
    // Guaranteed defined: size > cap (>= 1) means at least one key to iterate.
    const oldestKey = cache.keys().next().value as string;
    cache.delete(oldestKey);
  }
  pending.catch(() => {
    // Evict by identity: after LRU eviction plus a fresh request for the same
    // URL, this stale rejection must not delete the newer in-flight entry.
    if (cache?.get(url) === pending) {
      cache.delete(url);
    }
  });
  return pending;
}

function loadGltfCached(
  loader: GameboardGltfLoader,
  url: string,
  cacheLoads: boolean
): Promise<GameboardGltfLike> {
  return loadUrlCached(gltfLoadCachesByLoader, loader, url, cacheLoads, (u) => loader.loadAsync(u));
}

/**
 * Minimal async loader contract for tileset sheet textures. Compatible with a
 * three `TextureLoader` wrapped to also report the sheet's pixel dimensions
 * (needed for per-cell UV normalization in `buildTexturedHexMesh`).
 */
export interface GameboardSheetTextureLoader {
  /** Load a sheet image URL and return the texture plus its pixel dimensions. */
  loadAsync(url: string): Promise<SheetTexture>;
}

/** Per-loader URL memoization cache for sheet textures (mirrors the GLTF cache). */
type GameboardSheetLoadCache = Map<string, Promise<SheetTexture>>;
const sheetLoadCachesByLoader = new WeakMap<GameboardSheetTextureLoader, GameboardSheetLoadCache>();

/**
 * Load a sheet texture through a per-loader memoization cache, deduplicating
 * concurrent and repeated loads of the same sheet URL. Rejected loads are
 * evicted so the next call retries; resolved entries are bounded by the same LRU
 * cap as the GLTF cache.
 */
function loadSheetTextureCached(
  loader: GameboardSheetTextureLoader,
  url: string,
  cacheLoads: boolean
): Promise<SheetTexture> {
  return loadUrlCached(sheetLoadCachesByLoader, loader, url, cacheLoads, (u) =>
    loader.loadAsync(u)
  );
}

/**
 * Options for loading one placement object.
 */
export interface LoadGameboardPlacementObjectOptions
  extends GameboardPlacementAssetUrlOptions,
    GameboardPlacementAnimationUrlOptions {
  /**
   * GLTF-compatible async loader. OPTIONAL: only required when a placement
   * actually resolves to a `gltf` request. A tileset-ONLY board (every placement
   * resolves to a `tileset-cell`) needs no GLTF loader — supply only `textureLoader`.
   * A `gltf` request with no `loader` throws a clear error at load time.
   */
  loader?: GameboardGltfLoader;
  /**
   * Optional asset source (RFC0-7). When provided, a placement resolving to a
   * `tileset-cell` request is rendered as a textured-hex mesh instead of a GLTF;
   * a `gltf` request (or no resolution) falls through to the GLTF loader path.
   */
  source?: AssetSource;
  /** Sheet-texture loader, required when `source` can emit tileset-cell requests. */
  textureLoader?: GameboardSheetTextureLoader;
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
export interface GameboardPlacementObjectSyncOptions extends LoadGameboardPlacementObjectOptions {
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
 * Load a tileset-cell request as a textured-hex mesh placement object. Loads the
 * sheet texture (cached), builds the mesh, positions it at the placement's world
 * position, tags it for picking, and returns a LoadedGameboardPlacementObject
 * with no animation state (tiles are static).
 */
async function loadTilesetCellObject(
  placement: GameboardPlacementSpec,
  request: Extract<AssetRenderRequest, { type: 'tileset-cell' }>,
  options: LoadGameboardPlacementObjectOptions
): Promise<LoadedGameboardPlacementObject> {
  if (!options.textureLoader) {
    throw new GameboardRuntimeError(
      `Placement ${placement.id} (${placement.assetId}) resolved to a tileset-cell but no textureLoader was provided`
    );
  }
  const cacheLoads = options.cacheLoads ?? true;
  const sheet = await loadSheetTextureCached(options.textureLoader, request.sheetUrl, cacheLoads);
  const transform = transformForPlacement(placement);
  const mesh = buildTexturedHexMesh({
    sheet,
    cell: request.cell,
    hex: request.hex,
    ...(request.shape === undefined ? {} : { shape: request.shape }),
    // Per-placement fog/season/team shading carried on the request (RFC tint/opacity).
    ...(request.tint === undefined ? {} : { tint: request.tint }),
    ...(request.opacity === undefined ? {} : { opacity: request.opacity }),
  });
  applyTransform(mesh, transform);
  tagGameboardPlacementObject(mesh, placement);
  return {
    placementId: placement.id,
    assetId: placement.assetId,
    object: mesh,
    modelUrl: request.sheetUrl,
    transform,
    clips: [],
  };
}

export async function loadGameboardPlacementObject(
  placement: GameboardPlacementSpec,
  options: LoadGameboardPlacementObjectOptions
): Promise<LoadedGameboardPlacementObject> {
  // RFC0-8 dispatch: an AssetSource may resolve this placement to a tileset-cell
  // render request (a textured-hex mesh) or a gltf request (a model URL).
  let requestModelUrl: string | undefined;
  // A gltf request can also carry per-placement shading (fog/season/team) — applied to
  // the cloned model's materials below so 3D units/props shade like 2D tiles do.
  let requestShadingTint: { r: number; g: number; b: number } | undefined;
  let requestShadingOpacity: number | undefined;
  if (options.source) {
    // A transition tile (coast/river/road) carries a non-zero edgeMask in its
    // metadata; resolveEdge selects the POSITIONAL transition cell/model for that
    // mask. Try it first — without this, every transition renders as a plain fill
    // tile and the whole edge-mask machinery is dead (RFC0-8 edge path).
    const edgeMask = placement.metadata.edgeMask;
    const request =
      typeof edgeMask === 'number' && edgeMask !== 0
        ? (options.source.resolveEdge?.(placement.assetId, edgeMask, {
            baseUrl: options.baseUrl,
          }) ?? options.source.resolve(placement, { baseUrl: options.baseUrl }))
        : options.source.resolve(placement, { baseUrl: options.baseUrl });
    if (request?.type === 'tileset-cell') {
      return loadTilesetCellObject(placement, request, options);
    }
    // A 'gltf' request carries the resolved model URL (e.g. a rotated coast model
    // from resolveEdge); honour it instead of re-deriving from the placement below.
    if (request?.type === 'gltf') {
      requestModelUrl = request.url;
      requestShadingTint = request.tint;
      requestShadingOpacity = request.opacity;
    }
    // No resolution → fall through to the placement's own asset URL.
  }

  const modelUrl = requestModelUrl ?? resolveGameboardPlacementAssetUrl(placement, options);
  if (!modelUrl) {
    throw new GameboardRuntimeError(
      `No model URL resolved for placement ${placement.id} (${placement.assetId})`
    );
  }
  // `loader` is optional (a tileset-only board supplies only a textureLoader); a
  // placement that reaches the GLTF path without one is a real misconfiguration.
  if (!options.loader) {
    throw new GameboardRuntimeError(
      `Placement ${placement.id} (${placement.assetId}) needs a GLTF model but no loader was provided`
    );
  }
  const loader = options.loader;

  const cacheLoads = options.cacheLoads ?? true;
  const model = await loadGltfCached(loader, modelUrl, cacheLoads);
  const transform = transformForPlacement(placement);
  // SkeletonUtils.clone (not Object3D.clone) rebinds SkinnedMesh skeletons to
  // the cloned bone hierarchy. Plain `.clone(true)` deep-clones bones but
  // leaves each SkinnedMesh's skeleton pointing at the ORIGINAL cached scene's
  // bones, so rigged GLTFs (e.g. KayKit Adventurers units) would animate/deform
  // against the wrong (shared) skeleton once more than one placement loads the
  // same cached model.
  const object = applyTransform(cloneWithSkeleton(model.scene), transform);
  // Per-placement shading on the 3D model, mirroring the tileset-cell path: tint
  // multiplies each material's colour, opacity < 1 makes it translucent. Opt-in — an
  // unshaded placement leaves the cloned materials untouched.
  applyPlacementShading(object, requestShadingTint, requestShadingOpacity);
  tagGameboardPlacementObject(object, placement);
  const animationUrl = resolveGameboardPlacementAnimationUrl(placement, options);
  const animation = animationUrl
    ? await loadGltfCached(loader, animationUrl, cacheLoads)
    : undefined;
  const clips = [...(animation?.animations ?? []), ...(model.animations ?? [])];
  const clip = selectAnimationClip(
    clips,
    options.clipName ?? placementAnimationClipName(placement)
  );
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
export function readGameboardPlacementObjectUserData(
  object: Object3D
): GameboardObjectUserData | undefined {
  return isGameboardObjectUserData(object.userData.gameboardPlacement)
    ? object.userData.gameboardPlacement
    : undefined;
}

/**
 * Walks up the parent chain to find gameboard user data for a picked object.
 */
export function findGameboardPlacementObjectUserData(
  object: Object3D
): GameboardObjectUserData | undefined {
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
export function gameboardInteractionTargetForObject(
  object: Object3D
): GameboardInteractionTargetInput | undefined {
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
 * Applies a gameboard transform to a Three.js object.
 */
export function applyTransform(object: Object3D, transform: AssetTransform): Object3D {
  object.position.set(transform.position.x, transform.position.y, transform.position.z);
  object.rotation.set(0, transform.rotationY, 0);
  object.scale.setScalar(transform.scale);
  return object;
}

/**
 * Apply optional per-placement shading (tint / opacity) to every material in a loaded GLTF
 * model, mirroring the tileset-cell path so 3D units/props can be fog-shrouded / team-tinted
 * the same way tiles are. Both are opt-in: when neither is set the materials are untouched
 * (the model renders byte-identically). A tint multiplies each material's `color`; an
 * `opacity < 1` makes it translucent. The cloned model owns its materials (SkeletonUtils
 * clone), so mutating them here does not leak into the shared cached scene's materials —
 * except that three's GLTF loader may SHARE a material instance across meshes/clones, so we
 * clone each material before mutating to keep the shading strictly per-placement.
 */
export function applyPlacementShading(
  object: Object3D,
  tint: { r: number; g: number; b: number } | undefined,
  opacity: number | undefined
): void {
  if (!tint && (opacity === undefined || opacity >= 1)) {
    return;
  }
  object.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }
    const materials: Material[] = Array.isArray(child.material) ? child.material : [child.material];
    child.material = materials.map((material) => {
      const cloned = material.clone();
      const colored = cloned as Material & {
        color?: { setRGB(r: number, g: number, b: number): void };
      };
      if (tint && colored.color) {
        colored.color.setRGB(tint.r, tint.g, tint.b);
      }
      if (opacity !== undefined && opacity < 1) {
        cloned.transparent = true;
        cloned.opacity = opacity;
      }
      return cloned;
    });
    // `.map` above always produced an array; collapse it back to a single material when the
    // mesh started with one, so the single-vs-array shape the renderer expects is preserved.
    if (child.material.length === 1) {
      child.material = child.material[0] as Material;
    }
  });
}

/**
 * Places an object directly on a board hex without creating a placement record.
 */
export function placeObjectOnHex(
  object: Object3D,
  coordinates: HexCoordinates,
  options: {
    elevation?: number;
    positionOffset?: GameboardPlacementPositionOffset;
    rotationY?: number;
    scale?: number;
  } = {}
): Object3D {
  return applyTransform(object, transformForHex(coordinates, options));
}

/**
 * Returns a camera-friendly offset for framing one manifest asset preview.
 */
export function frameObjectPosition(asset: MedievalHexagonAsset, margin = 1.7): Vector3 {
  const maxDimension = Math.max(
    asset.bounds.size[0],
    asset.bounds.size[1],
    asset.bounds.size[2],
    1
  );
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
