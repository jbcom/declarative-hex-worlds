/**
 * `src/react-elements/` — the declarative element surface (RFC 0001 RFC0-8b).
 *
 * First-class JSX elements + ergonomic hooks that proxy the koota world + the
 * source-aware render bridge, so consumers compose a hex world the way they'd
 * compose an R3F scene:
 *
 * ```tsx
 * <Canvas>
 *   <HexWorld plan={plan} source={grasslandTileset} loader={gltf} textureLoader={sheets}>
 *     <Tileset manifest={tilesetManifest} />
 *     <Tile at={{ q, r }} biome="forest" />
 *     <Model at={{ q, r }} assetId="castle" />
 *     <GameboardObjects />
 *   </HexWorld>
 * </Canvas>
 * ```
 *
 * `<HexWorld>` is Canvas-free by design (the consumer owns the R3F `<Canvas>`,
 * camera, and renderer). See `docs/plans/declarative-render-surface.design.md`.
 *
 * Exposed via the `declarative-hex-worlds/react-elements` subpath (and the
 * umbrella). Requires `@react-three/fiber` (an optional peer) — the
 * `<GameboardObjects>` bridge runs inside an R3F frame loop.
 *
 * @module
 */
export {
  type HexWorldContextValue,
  HexWorldContext,
  useHexWorldContext,
} from './context';
export {
  type HexWorldHandle,
  type HexWorldProps,
  HexWorld,
  useHexWorld,
} from './hex-world';
export {
  type GameboardObjectsProps,
  GameboardObjects,
  combineSources,
  syncHexWorldPlacements,
} from './objects';
export {
  type HexAt,
  type PlacementElementProps,
  Model,
  Sprite,
  Tile,
} from './placements';
export { type TilesetProps, Tileset } from './tileset';
export { type TileQuery, useHexPath, usePlacement, useTile } from './hooks';
