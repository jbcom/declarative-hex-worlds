/**
 * Actor koota traits + supporting types.
 *
 * Lives in `src/traits/` (not `src/actors/`) for the same reason as
 * `./board`: zero runtime dependency on sibling sub-packages so trait
 * declarations evaluate cleanly regardless of chunk-merging order.
 *
 * Re-exported from `src/actors/index.ts` for backward compatibility.
 *
 * @module
 */

import { trait } from 'koota';

/** Actor role used by collision, targeting, commands, and SimpleRPG fixtures. */
export type GameboardActorKind =
  | 'player'
  | 'npc'
  | 'enemy'
  | 'prop'
  | 'unit'
  | 'neutral'
  | (string & {});

/** Serializable actor metadata value mirrored into Koota state. */
export type GameboardActorMetadataValue = string | number | boolean | null;

/** Actor trait attached to placement entities that participate in gameplay. */
export const GameboardActor = trait({
  /** Stable gameplay actor id. */
  actorId: '',
  /** Actor role used by collision, targeting, commands, and fixtures. */
  kind: 'neutral' as GameboardActorKind,
  /** Optional faction identifier. */
  faction: undefined as string | undefined,
  /** Optional team identifier. */
  team: undefined as string | undefined,
  /** Whether this actor is generally hostile. */
  hostile: false,
  /** Whether this actor blocks movement. */
  blocksMovement: false,
  /** Whether this actor should be treated as an interaction target. */
  interactive: false,
  /** Free-form actor tags. */
  tags: () => [] as string[],
  /** Serializable actor metadata. */
  metadata: () => ({}) as Record<string, GameboardActorMetadataValue>,
});

/** Marker trait for all gameplay actors. */
export const IsGameboardActor = trait();
/** Marker trait for player actors. */
export const IsPlayerActor = trait();
/** Marker trait for NPC actors. */
export const IsNpcActor = trait();
/** Marker trait for enemy actors. */
export const IsEnemyActor = trait();
/** Marker trait for prop actors. */
export const IsPropActor = trait();
/** Marker trait for hostile actors. */
export const IsHostileActor = trait();
/** Marker trait for interactive actors. */
export const IsInteractiveActor = trait();
/** Marker trait for movement-blocking actors. */
export const IsBlockingActor = trait();
