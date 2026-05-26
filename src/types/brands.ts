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
 * Consumers should reference the exported branded types directly
 * (`HexKey`, `ActorId`, …), not this generic.
 */
export type Branded<TBrand extends string> = string & { readonly [__brand]: TBrand };

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

/**
 * Brand a runtime string as the given typed ID. Performs no validation —
 * callers MUST ensure the value originates from a trusted source (scenario
 * JSON, registry lookup, parser output). Use sibling `parse*Id` helpers in
 * the relevant sub-package when the input is untrusted.
 */
export function brandHexKey(value: string): HexKey {
  return value as HexKey;
}
export function brandActorId(value: string): ActorId {
  return value as ActorId;
}
export function brandTileId(value: string): TileId {
  return value as TileId;
}
export function brandPieceId(value: string): PieceId {
  return value as PieceId;
}
export function brandPlacementId(value: string): PlacementId {
  return value as PlacementId;
}
export function brandScenarioId(value: string): ScenarioId {
  return value as ScenarioId;
}
export function brandQuestId(value: string): QuestId {
  return value as QuestId;
}
export function brandObjectiveId(value: string): ObjectiveId {
  return value as ObjectiveId;
}
export function brandPatrolRouteId(value: string): PatrolRouteId {
  return value as PatrolRouteId;
}
export function brandAssetId(value: string): AssetId {
  return value as AssetId;
}
