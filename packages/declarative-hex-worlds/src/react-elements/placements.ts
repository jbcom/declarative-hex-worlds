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
  const { at, assetId, id, kind, layer, rotationSteps, scale, elevationOffset, biome } = input;
  useEffect(() => {
    const entity = runtime.spawnPlacement({
      at,
      assetId,
      kind,
      ...(id === undefined ? {} : { id }),
      ...(layer === undefined ? {} : { layer }),
      ...(rotationSteps === undefined ? {} : { rotationSteps }),
      ...(scale === undefined ? {} : { scale }),
      ...(elevationOffset === undefined ? {} : { elevationOffset }),
      ...(biome === undefined ? {} : { metadata: { biome } }),
    });
    return () => {
      runtime.removePlacement(entity);
    };
    // Re-spawn only when the identity of the placement changes.
  }, [runtime, at, assetId, id, kind, layer, rotationSteps, scale, elevationOffset, biome]);
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
