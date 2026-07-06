/**
 * Board / tile / placement koota traits + relations.
 *
 * Lives in `src/traits/` (not `src/koota/`) so it has zero runtime
 * dependencies on sibling sub-packages — only the npm `koota` package
 * and pure-type imports from `../types` and `../gameboard`. That
 * removes the koota↔gameboard↔scenario↔koota top-level evaluation
 * cycle that the original `src/koota.ts` layout dodged accidentally.
 *
 * Re-exported through `src/koota/index.ts` for backward compatibility
 * with the (now-corrected) source modules that still expect to import
 * `IsGameboardPlacement` etc. from `'../koota'`.
 *
 * @module
 */

import { relation, trait } from 'koota';
import { GAMEBOARD_SCHEMA_VERSION } from '../types';
import type {
  GameboardPlacementKind,
  GameboardPlacementLayer,
  GameboardShape,
  GameboardTerrain,
} from '../gameboard';
import type { HexCoordinates, TextureSet, WorldPosition } from '../types';

/**
 * Board-level Koota trait with the deterministic plan metadata currently
 * loaded into a world.
 */
export const GameboardState = trait({
  /** Manifest/schema version used to generate the loaded board. */
  schemaVersion: GAMEBOARD_SCHEMA_VERSION,
  /** Seed used by deterministic layout or simulation helpers. */
  seed: '',
  /** Active KayKit texture set for generated terrain and placements. */
  textureSet: 'default' as TextureSet,
  /** Board shape descriptor, such as rectangle or hexagon. */
  shape: () => ({ kind: 'rectangle', width: 0, height: 0 }) as GameboardShape,
  /** Number of tile entities loaded into the world. */
  tileCount: 0,
  /** Number of placement entities loaded into the world. */
  placementCount: 0,
});

/**
 * Full tile trait used for serialization, rendering, and coarse tile queries.
 */
export const HexTileState = trait({
  /** Stable axial key in `q,r` form. */
  key: '',
  /** Axial tile coordinates. */
  coordinates: () => ({ q: 0, r: 0 }) as HexCoordinates,
  /** Primary terrain biome represented by this tile. */
  terrain: 'grass' as GameboardTerrain,
  /** KayKit texture set applied to this tile. */
  textureSet: 'default' as TextureSet,
  /** Stacked elevation level for the tile top. */
  elevation: 0,
  /** Asset id for the visible tile top. */
  baseAssetId: '',
  /** Optional asset id for the vertical support below elevated tiles. */
  supportAssetId: '',
  /** Six-edge bitmask for road connectivity. */
  roadEdges: 0,
  /** Six-edge bitmask for river connectivity. */
  riverEdges: 0,
  /** Six-edge bitmask for coast connectivity. */
  coastEdges: 0,
  /** Road slope variant when a road changes elevation. */
  roadSlope: undefined as 'high' | 'low' | undefined,
  /** Whether this river tile uses the waterless guide variant. */
  riverWaterless: false,
  /** Whether this river tile uses the curvy guide variant. */
  riverCurvy: false,
  /** River crossing variant, when present. */
  riverCrossing: undefined as 'A' | 'B' | undefined,
  /** Whether this coast tile uses the waterless guide variant. */
  coastWaterless: false,
  /** Free-form taxonomy and generation tags. */
  tags: () => [] as string[],
});

/** Decomposed coordinate trait for systems that only need tile lookup data. */
export const TileCoordinates = trait({
  /** Stable axial key in `q,r` form. */
  key: '',
  /** Axial q coordinate. */
  q: 0,
  /** Axial r coordinate. */
  r: 0,
});

/** Decomposed terrain trait for biome and placement-rule systems. */
export const TileTerrain = trait({
  /** Primary terrain biome represented by this tile. */
  terrain: 'grass' as GameboardTerrain,
});

/** Decomposed elevation trait for stacking, movement, and rendering systems. */
export const TileElevation = trait({
  /** Stacked elevation level for the tile top. */
  elevation: 0,
  /** Asset id for the visible tile top. */
  baseAssetId: '',
  /** Optional asset id for the vertical support below elevated tiles. */
  supportAssetId: '',
});

/** Decomposed edge connectivity trait used by roads, rivers, coasts, and pathing. */
export const TileConnectivity = trait({
  /** Six-edge bitmask for road connectivity. */
  roadEdges: 0,
  /** Six-edge bitmask for river connectivity. */
  riverEdges: 0,
  /** Six-edge bitmask for coast connectivity. */
  coastEdges: 0,
  /** Road slope variant when a road changes elevation. */
  roadSlope: undefined as 'high' | 'low' | undefined,
  /** Whether this river tile uses the waterless guide variant. */
  riverWaterless: false,
  /** Whether this river tile uses the curvy guide variant. */
  riverCurvy: false,
  /** River crossing variant, when present. */
  riverCrossing: undefined as 'A' | 'B' | undefined,
  /** Whether this coast tile uses the waterless guide variant. */
  coastWaterless: false,
});

/** Decomposed render trait for systems that switch seasonal texture sets. */
export const TileRenderState = trait({
  /** KayKit texture set applied to this tile. */
  textureSet: 'default' as TextureSet,
});

/** Decomposed tag list trait used by selectors, recipes, and seeded generation. */
export const TileTagList = trait(() => [] as string[]);

/**
 * Runtime placement trait for terrain overlays, structures, units, props, and
 * externally registered pieces.
 */
export const PlacementState = trait({
  /** Stable placement id. */
  id: '',
  /** Origin tile key in `q,r` form. */
  tileKey: '',
  /** Axial coordinates of the origin tile. */
  coordinates: () => ({ q: 0, r: 0 }) as HexCoordinates,
  /** World-space placement anchor after elevation and local offsets. */
  position: () => ({ x: 0, y: 0, z: 0 }) as WorldPosition,
  /** Manifest or external registry asset id. */
  assetId: '',
  /** Gameplay category for rules, selectors, and rendering. */
  kind: 'terrain' as GameboardPlacementKind,
  /** Render and occupancy layer. */
  layer: 'terrain' as GameboardPlacementLayer,
  /** KayKit texture set applied to this placement. */
  textureSet: 'default' as TextureSet,
  /** Base tile elevation where the placement was spawned. */
  elevation: 0,
  /** Extra vertical offset above the tile elevation. */
  elevationOffset: 0,
  /** Clockwise 60-degree rotation steps. */
  rotationSteps: 0,
  /** Rotation in radians derived from `rotationSteps`. */
  rotationRadians: 0,
  /** Uniform render scale. */
  scale: 1,
  /** Stable sort order used by renderers and snapshots. */
  order: 0,
  /** Optional stack index for layered terrain and vertical props. */
  stackIndex: undefined as number | undefined,
  /** Whether the placement depends on local-only EXTRA assets. */
  requiresExtra: false,
  /** Serializable placement metadata for rules, ECS interop, and render hints. */
  metadata: () => ({}) as Record<string, string | number | boolean | null>,
});

/** Marker trait for board tile entities. */
export const IsGameboardTile = trait();
/** Marker trait for all board placement entities. */
export const IsGameboardPlacement = trait();
/** Marker trait for terrain and transition placements. */
export const IsTerrainPlacement = trait();
/** Marker trait for road placements. */
export const IsRoadPlacement = trait();
/** Marker trait for river placements. */
export const IsRiverPlacement = trait();
/** Marker trait for coast placements. */
export const IsCoastPlacement = trait();
/** Marker trait for decorative placements. */
export const IsDecorationPlacement = trait();
/** Marker trait for structure placements. */
export const IsStructurePlacement = trait();
/** Marker trait for unit placements. */
export const IsUnitPlacement = trait();
/** Marker trait for prop placements. */
export const IsPropPlacement = trait();
/** Marker trait for harbor-capable structure or prop placements. */
export const IsHarborPlacement = trait();
/** Marker trait for elevated or explicitly stacked terrain placements. */
export const IsStackedTerrain = trait();
/** Marker trait for placements whose assets are supplied by local EXTRA ingest. */
export const RequiresExtraAsset = trait();

/** Exclusive relation from a placement to its origin tile. */
export const PlacementOnTile = relation({ exclusive: true, autoDestroy: 'orphan' });
/** Non-exclusive relation from a placement to every tile in its footprint. */
export const PlacementOccupiesTile = relation({
  store: {
    /** Origin tile key used to distinguish center and footprint tiles. */
    originTileKey: '',
    /** Zero-based index within the placement footprint. */
    footprintIndex: 0,
    /** Whether this footprint record blocks movement. */
    blocksMovement: false as boolean,
    /** Occupancy group used to allow compatible colocated placements. */
    occupancyGroup: '',
  },
});
/** Directional neighbor relation between adjacent axial hex tiles. */
export const AdjacentTo = relation({
  store: {
    /** Clockwise flat-top edge index from the source tile to the target tile. */
    edge: 0,
  },
});
