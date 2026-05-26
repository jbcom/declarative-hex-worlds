/**
 * Branded primitive types — opaque string IDs the library uses internally.
 *
 * Branding turns `string` into a compile-time-distinct nominal type so passing
 * an `ActorId` where a `TileId` is expected fails to type-check. Construction
 * goes through the `brand*` helpers; runtime values remain plain strings, so
 * there is no allocation or boxing cost.
 *
 * Branded types are NOT yet enforced across the codebase — Epic R2 introduces
 * them progressively as each sub-package lands. This module is the central
 * registry so the migration touches one file per brand.
 *
 * @module
 */

declare const __brand: unique symbol;

/**
 * Internal helper: a phantom-typed string distinguishable by its brand tag.
 *
 * Consumers should reference the exported branded types directly
 * (`HexKey`, `ActorId`, …), not this generic.
 */
export type Branded<TBrand extends string> = string & {
  /** Phantom marker that gives this string nominal identity at the type level. */
  readonly [__brand]: TBrand;
};

/** Stringified hex coordinate of the form `"q,r"` — e.g. `"3,-2"`. */
export type HexKey = Branded<'HexKey'>;

/** Stable identifier for an authored actor (NPC, player, prop, projectile). */
export type ActorId = Branded<'ActorId'>;

/** Stable identifier for a tile placement on the board grid. */
export type TileId = Branded<'TileId'>;

/** Stable identifier for a piece declaration in the registry. */
export type PieceId = Branded<'PieceId'>;

/** Stable identifier for a placement instance (a piece dropped onto a tile). */
export type PlacementId = Branded<'PlacementId'>;

/** Stable identifier for a scenario document. */
export type ScenarioId = Branded<'ScenarioId'>;

/** Stable identifier for a quest (with objectives) attached to a scenario. */
export type QuestId = Branded<'QuestId'>;

/** Stable identifier for a quest objective inside a quest. */
export type ObjectiveId = Branded<'ObjectiveId'>;

/** Stable identifier for a patrol route attached to one or more actors. */
export type PatrolRouteId = Branded<'PatrolRouteId'>;

/** Stable identifier for an asset entry in a manifest. */
export type AssetId = Branded<'AssetId'>;

/** Brand a string as a {@link HexKey}. Caller must validate. */
export function brandHexKey(value: string): HexKey {
  return value as HexKey;
}
/** Brand a string as an {@link ActorId}. Caller must validate. */
export function brandActorId(value: string): ActorId {
  return value as ActorId;
}
/** Brand a string as a {@link TileId}. Caller must validate. */
export function brandTileId(value: string): TileId {
  return value as TileId;
}
/** Brand a string as a {@link PieceId}. Caller must validate. */
export function brandPieceId(value: string): PieceId {
  return value as PieceId;
}
/** Brand a string as a {@link PlacementId}. Caller must validate. */
export function brandPlacementId(value: string): PlacementId {
  return value as PlacementId;
}
/** Brand a string as a {@link ScenarioId}. Caller must validate. */
export function brandScenarioId(value: string): ScenarioId {
  return value as ScenarioId;
}
/** Brand a string as a {@link QuestId}. Caller must validate. */
export function brandQuestId(value: string): QuestId {
  return value as QuestId;
}
/** Brand a string as an {@link ObjectiveId}. Caller must validate. */
export function brandObjectiveId(value: string): ObjectiveId {
  return value as ObjectiveId;
}
/** Brand a string as a {@link PatrolRouteId}. Caller must validate. */
export function brandPatrolRouteId(value: string): PatrolRouteId {
  return value as PatrolRouteId;
}
/** Brand a string as an {@link AssetId}. Caller must validate. */
export function brandAssetId(value: string): AssetId {
  return value as AssetId;
}
