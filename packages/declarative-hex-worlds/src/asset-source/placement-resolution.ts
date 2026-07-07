/**
 * `src/asset-source/placement-resolution.ts` — neutral placement → URL + transform
 * resolution (RFC 0001 signals+bindings core-purity).
 *
 * These helpers turn a `GameboardPlacementSpec` into an asset URL (from explicit
 * maps, placement metadata, a manifest catalog, or a fallback) and into an
 * `AssetTransform` (pure position/rotation/scale math). They are RENDERER-FREE —
 * zero `three` import — so they live in the neutral asset-source layer, not the
 * three binding. This is what lets the core stay renderer-free: `gltf-pack` (an
 * `AssetSource`) resolves URLs + transforms here instead of reaching into
 * `../three`. The three binding re-exports these for its own consumers.
 *
 * @module
 */
import { axialToWorld } from '../coordinates';
import type { GameboardPlacementSpec } from '../gameboard';
import type { GameboardPlacementPositionOffset } from '../koota';
import {
  type ManifestAssetCatalog,
  type ManifestAssetUrlOptions,
  getManifestAsset,
  resolveManifestAssetUrl,
} from '../manifest';
import type { HexCoordinates, MedievalHexagonAsset, VariantSelection } from '../types';
import type { AssetTransform } from './source';

/** URL resolution inputs for gameboard placement models. */
export interface GameboardPlacementAssetUrlOptions extends ManifestAssetUrlOptions {
  /** Manifest or manifest bundle used for packaged FREE/EXTRA asset ids. */
  catalog?: ManifestAssetCatalog;
  /** Explicit asset-id-to-URL overrides, useful for local-only Vite `@fs` assets. */
  assetUrls?: Readonly<Record<string, string>>;
  /** Last-chance resolver for app-specific asset stores. */
  fallback?: (placement: GameboardPlacementSpec) => string | undefined;
}

/** Function that maps a placement to a model URL. */
export type GameboardPlacementAssetUrlResolver = (
  placement: GameboardPlacementSpec
) => string | undefined;

/** URL resolution inputs for external animation clips. */
export interface GameboardPlacementAnimationUrlOptions {
  /** Explicit asset-id-to-animation-URL map. */
  animationUrls?: Readonly<Record<string, string>>;
  /** App-specific animation URL resolver. */
  animationUrlResolver?: (placement: GameboardPlacementSpec) => string | undefined;
}

/** Resolves a manifest asset's model path with an optional base URL. */
export function resolveAssetUrl(asset: MedievalHexagonAsset, baseUrl?: string | URL): string {
  if (!baseUrl) {
    return asset.modelPath;
  }
  return new URL(asset.modelPath, baseUrl).toString();
}

/**
 * Resolves the model URL for a placement from explicit maps, placement metadata,
 * a manifest catalog, or a fallback resolver.
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

/** Creates a reusable placement-to-model URL resolver. */
export function createGameboardPlacementAssetUrlResolver(
  options: GameboardPlacementAssetUrlOptions = {}
): GameboardPlacementAssetUrlResolver {
  return (placement) => resolveGameboardPlacementAssetUrl(placement, options);
}

/**
 * Resolves a separate animation URL for a placement when the model does not carry
 * the desired clips.
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
 * Creates a transform from axial coordinates, optional elevation, and optional
 * placement offset.
 */
export function transformForHex(
  coordinates: HexCoordinates,
  options: {
    elevation?: number;
    positionOffset?: GameboardPlacementPositionOffset;
    rotationY?: number;
    scale?: number;
  } = {}
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
  options: {
    elevation?: number;
    positionOffset?: GameboardPlacementPositionOffset;
    scale?: number;
  } = {}
): AssetTransform {
  return transformForHex(coordinates, {
    elevation: options.elevation,
    positionOffset: options.positionOffset,
    rotationY: variant.rotationRadians,
    scale: options.scale,
  });
}

/** Converts a serialized placement into a gameboard transform. */
export function transformForPlacement(placement: GameboardPlacementSpec): AssetTransform {
  return {
    position: { ...placement.position },
    rotationY: placement.rotationRadians,
    scale: placement.scale,
  };
}
