/**
 * `src/react-elements/hooks.ts` — ergonomic top-level hooks for the declarative
 * element surface (RFC 0001 RFC0-8b).
 *
 * Thin facades over the documented lower-level `useGameboard*` hooks, giving the
 * elements the concise drive/query surface an R3F/Pixi developer expects. They
 * add no new state authority — they read the same koota world.
 *
 * `useCamera` (RFC0-CAM) now ships in `./camera` — it drives the R3F camera to frame
 * the live board via the renderer-neutral `camera` framing signal. `useSelection` from
 * the design surface still lands with its backing selection-state model; the hooks below
 * wrap capabilities that already exist.
 *
 * @module
 */
import { useMemo } from 'react';
import type { Entity } from 'koota';
import type { GameboardNavigationPathResult } from '../gameboard';
import type { HexTileStateValue } from '../koota';
import {
  useGameboardNavigation,
  usePlacementEntitiesForTile,
  useTileEntity,
  useTileState,
} from '../react';
import type { HexCoordinates } from '../types';

/** The tile at `at`: its entity and decomposed state (undefined if no such tile). */
export interface TileQuery {
  entity: Entity | undefined;
  state: HexTileStateValue | undefined;
}

/** Read the tile at axial coordinates or a tile key. Wraps useTileEntity + useTileState. */
export function useTile(at: HexCoordinates | string): TileQuery {
  const entity = useTileEntity(at);
  const state = useTileState(entity);
  return useMemo(() => ({ entity, state }), [entity, state]);
}

/** Placement entities on the tile at `at`. Wraps usePlacementEntitiesForTile. */
export function usePlacement(at: HexCoordinates | string): readonly Entity[] {
  return usePlacementEntitiesForTile(at);
}

/**
 * A\* path between two hexes over the current projected board. Wraps
 * useGameboardNavigation; returns undefined until a board is projected.
 */
export function useHexPath(
  from: HexCoordinates | string,
  to: HexCoordinates | string
): GameboardNavigationPathResult | undefined {
  const navigation = useGameboardNavigation();
  return useMemo(() => navigation?.findPath(from, to), [navigation, from, to]);
}
