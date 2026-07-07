/**
 * `src/react-elements/context.ts` — the source-registry context for the
 * declarative element surface (RFC 0001 RFC0-8b).
 *
 * `<HexWorld>` provides an `AssetSource` registry (plus the injected loaders the
 * render bridge needs) through this context; `<Tileset>`/`<Spriteset>` register
 * sources into it, and `<GameboardObjects>` reads it to drive
 * `syncGameboardPlacementObjects`. This is a thin coordination context — the koota
 * world itself stays owned by the wrapped `GameboardRuntimeProvider`, not here.
 *
 * @module
 */
import { createContext, useContext } from 'react';
import type { AssetSource } from '../asset-source';
import type { GameboardGltfLoader, GameboardSheetTextureLoader } from '../three';

/**
 * The value provided by `<HexWorld>`: the ordered asset sources a placement is
 * resolved against (first match wins), plus the loaders the render bridge uses.
 */
export interface HexWorldContextValue {
  /** Registered asset sources, in resolution order (first to resolve wins). */
  sources: readonly AssetSource[];
  /** Register an asset source (used by `<Tileset>`/`<Spriteset>`). Returns an unregister fn. */
  registerSource(source: AssetSource): () => void;
  /** GLTF loader for model/tile GLTF placements. */
  loader?: GameboardGltfLoader;
  /** Sheet-texture loader for tileset-cell placements. */
  textureLoader?: GameboardSheetTextureLoader;
  /** Base URL for resolving a source's relative asset paths. */
  baseUrl?: string | URL;
}

export const HexWorldContext = createContext<HexWorldContextValue | undefined>(undefined);

/**
 * Read the nearest `<HexWorld>` context. Throws if used outside a `<HexWorld>`,
 * so element misuse fails loudly instead of silently no-op rendering.
 */
export function useHexWorldContext(): HexWorldContextValue {
  const value = useContext(HexWorldContext);
  if (!value) {
    throw new Error('useHexWorld must be used within a <HexWorld>');
  }
  return value;
}
