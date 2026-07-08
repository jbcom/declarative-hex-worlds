/**
 * `src/react-elements/placements.ts` — the declarative placement elements
 * `<Model>`, `<Sprite>`, `<Tile>` (RFC 0001 RFC0-8b).
 *
 * Each element spawns a koota placement on mount (via the runtime facade's
 * `spawnPlacement`) and removes it on unmount, so a placement's lifecycle follows
 * its element's presence in the tree. They render no scene object themselves —
 * `<GameboardObjects>` draws every placement through the source-aware bridge.
 * This keeps the elements a thin declarative wrapper over the existing imperative
 * spawn/remove API, driving the same koota world the hooks read.
 *
 * @module
 */
import { useEffect } from 'react';
import type { GameboardPlacementKind, GameboardPlacementLayer } from '../gameboard';
import type { HexCoordinates } from '../types';
import { useHexWorld } from './hex-world';

/** Axial coordinates or a tile key. */
export type HexAt = HexCoordinates | string;

/** Shared props for a placement element. */
export interface PlacementElementProps {
  /** Origin tile (axial coords or tile key). */
  at: HexAt;
  /** Asset id resolved through the world's asset source(s). */
  assetId: string;
  /** Explicit placement id (defaults to a deterministic runtime id). */
  id?: string;
  /** Clockwise 60° rotation steps. */
  rotationSteps?: number;
  /** Uniform scale. */
  scale?: number;
  /** Extra vertical offset above tile elevation. */
  elevationOffset?: number;
  /**
   * Extra serializable placement metadata merged into the spawned placement's `metadata`.
   * This is how a game drives per-placement render hints the renderer reads — e.g. the
   * tileset binding's `tintR`/`tintG`/`tintB` + `opacity` for fog-of-war / season / team
   * shading — or carries its own gameplay tags. Merges with (and is overridden by) the
   * element's own derived keys (a `Tile`'s `biome`).
   */
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

interface SpawnPlacementInput extends PlacementElementProps {
  kind: GameboardPlacementKind;
  layer?: GameboardPlacementLayer;
  biome?: string;
}

/**
 * Spawn a placement for the lifetime of the calling element. Re-spawns when the
 * identifying inputs change; removes on unmount. The returned nothing — the
 * element is render-null; the bridge renders the placement.
 */
function usePlacementElement(input: SpawnPlacementInput): void {
  const { runtime } = useHexWorld();
  const { at, assetId, id, kind, layer, rotationSteps, scale, elevationOffset, biome, metadata } =
    input;
  // A stable JSON key so the effect re-spawns when the metadata VALUE (not just its object
  // identity) changes — a caller passing a fresh `{tintR:…}` object each render would
  // otherwise thrash or, with a raw-object dep, never update.
  const metadataKey = metadata === undefined ? undefined : JSON.stringify(metadata);
  useEffect(() => {
    // The element's own derived keys (a Tile's biome) win over caller metadata of the same
    // name, so a game can't accidentally clobber the biome the tile needs to resolve.
    const merged = {
      ...(metadata ?? {}),
      ...(biome === undefined ? {} : { biome }),
    };
    const entity = runtime.spawnPlacement({
      at,
      assetId,
      kind,
      ...(id === undefined ? {} : { id }),
      ...(layer === undefined ? {} : { layer }),
      ...(rotationSteps === undefined ? {} : { rotationSteps }),
      ...(scale === undefined ? {} : { scale }),
      ...(elevationOffset === undefined ? {} : { elevationOffset }),
      ...(Object.keys(merged).length === 0 ? {} : { metadata: merged }),
    });
    return () => {
      runtime.removePlacement(entity);
    };
    // Re-spawn only when the identity of the placement changes.
  }, [
    runtime,
    at,
    assetId,
    id,
    kind,
    layer,
    rotationSteps,
    scale,
    elevationOffset,
    biome,
    metadata,
    metadataKey,
  ]);
}

/** Place a 3D GLTF model at a hex. */
export function Model(props: PlacementElementProps & { kind?: GameboardPlacementKind }): null {
  usePlacementElement({ ...props, kind: props.kind ?? 'prop' });
  return null;
}

/** Place a 2D sprite/tileset cell at a hex (rendered as a textured-hex mesh). */
export function Sprite(props: PlacementElementProps & { kind?: GameboardPlacementKind }): null {
  usePlacementElement({ ...props, kind: props.kind ?? 'prop' });
  return null;
}

/** Declare/override a hex tile's surface — a `terrain`-kind, `surface`-layer placement. */
export function Tile(props: PlacementElementProps & { biome?: string }): null {
  usePlacementElement({ ...props, kind: 'terrain', layer: 'surface', biome: props.biome });
  return null;
}
