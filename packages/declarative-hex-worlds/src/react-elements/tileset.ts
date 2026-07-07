/**
 * `src/react-elements/tileset.ts` — the `<Tileset>` element (RFC 0001 RFC0-8b).
 *
 * Registers a `tileset` AssetSource (built from a validated TilesetManifest) into
 * the nearest `<HexWorld>`'s source registry for the lifetime of the element.
 * Declaration-only: it renders nothing; `<Tile>`/`<Sprite>` placements whose
 * biome the manifest knows resolve through it.
 *
 * @module
 */
import { useEffect, useMemo } from 'react';
import { type TilesetManifest, createTilesetSource } from '../asset-source';
import type { HexDims } from '../asset-source';
import { useHexWorldContext } from './context';

/** Props for `<Tileset>`. */
export interface TilesetProps {
  /** A validated tileset manifest describing the sheets + biome map. */
  manifest: TilesetManifest;
  /** Optional world-space hex footprint override for this tileset's cells. */
  hex?: HexDims;
}

/**
 * Register a tileset source for the lifetime of this element. Renders null.
 */
export function Tileset({ manifest, hex }: TilesetProps): null {
  const { registerSource } = useHexWorldContext();
  const source = useMemo(
    () => createTilesetSource(hex === undefined ? { manifest } : { manifest, hex }),
    [manifest, hex]
  );
  useEffect(() => registerSource(source), [registerSource, source]);
  return null;
}
