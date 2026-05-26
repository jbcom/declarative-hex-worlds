/**
 * Quest koota traits + supporting types.
 *
 * Imports only from `koota` (npm) and `'../types'` (pure-type) so trait
 * evaluation has no sibling-sub-package runtime edges.
 *
 * @module
 */

import { trait } from 'koota';
import type { HexCoordinates } from '../types';

/** Schema version written to quest trait state. */
export const GAMEBOARD_QUEST_SCHEMA_VERSION = '1.0.0';

/** Runtime quest lifecycle status. */
export type GameboardQuestStatus = 'pending' | 'active' | 'completed' | 'blocked';
/** Runtime quest objective status. */
export type GameboardQuestObjectiveStatus = 'pending' | 'completed' | 'blocked';
/** Collision expectation supported by collision quest objectives. */
export type GameboardQuestCollisionExpectation =
  | 'can-enter'
  | 'blocked'
  | 'hostile'
  | 'interactive'
  | 'prop';
/** Serializable quest metadata value. */
export type GameboardQuestMetadataValue = string | number | boolean | null;

/** Shared fields for every quest objective. */
export interface GameboardQuestObjectiveBase {
  /** Stable objective id within the quest. */
  id: string;
  /** Optional display label. */
  label?: string;
}

/** Objective completed when an actor reaches a tile. */
export interface ReachTileQuestObjective extends GameboardQuestObjectiveBase {
  /** Objective discriminator. */
  kind: 'reach-tile';
  /** Source actor id. */
  actor: string;
  /** Target tile coordinates or tile key. */
  tile: HexCoordinates | string;
  /** Maximum accepted distance from the target tile. */
  maxDistance?: number;
}

/** Objective completed when an actor reaches another actor. */
export interface ReachActorQuestObjective extends GameboardQuestObjectiveBase {
  /** Objective discriminator. */
  kind: 'reach-actor';
  /** Source actor id. */
  actor: string;
  /** Target actor id. */
  targetActor: string;
  /** Maximum accepted distance from the target actor. */
  maxDistance?: number;
}

/** Objective completed when an actor interacts with another actor. */
export interface InteractActorQuestObjective extends GameboardQuestObjectiveBase {
  /** Objective discriminator. */
  kind: 'interact-actor';
  /** Source actor id. */
  actor: string;
  /** Target actor id. */
  targetActor: string;
  /** Maximum accepted interaction distance. */
  maxDistance?: number;
}

/** Objective completed when a target actor no longer exists. */
export interface DefeatActorQuestObjective extends GameboardQuestObjectiveBase {
  /** Objective discriminator. */
  kind: 'defeat-actor';
  /** Target actor id. */
  targetActor: string;
}

/** Objective completed when a collision report matches an expected state. */
export interface CollisionQuestObjective extends GameboardQuestObjectiveBase {
  /** Objective discriminator. */
  kind: 'collision';
  /** Optional source actor id. */
  actor?: string;
  /** Optional target actor id. */
  targetActor?: string;
  /** Optional target tile coordinates or tile key. */
  targetTile?: HexCoordinates | string;
  /** Expected collision state. */
  expect: GameboardQuestCollisionExpectation;
}

/** Quest objective union. */
export type GameboardQuestObjective =
  | ReachTileQuestObjective
  | ReachActorQuestObjective
  | InteractActorQuestObjective
  | DefeatActorQuestObjective
  | CollisionQuestObjective;

/** Runtime progress for one quest objective. */
export interface GameboardQuestObjectiveProgress {
  /** Objective id. */
  objectiveId: string;
  /** Objective status. */
  status: GameboardQuestObjectiveStatus;
  /** Human-readable progress detail. */
  detail: string;
  /** Simulation/system step when completion or blocking occurred. */
  completedAtStep?: number;
}

/** Quest trait storing definition, progress, active objective, and metadata. */
export const GameboardQuest = trait({
  /** Quest schema version. */
  schemaVersion: GAMEBOARD_QUEST_SCHEMA_VERSION,
  /** Stable quest id. */
  questId: '',
  /** Quest display title. */
  title: '',
  /** Runtime quest lifecycle status. */
  status: 'pending' as GameboardQuestStatus,
  /** Index of the active objective in `objectives`. */
  activeObjectiveIndex: 0,
  /** Ordered objective definitions. */
  objectives: () => [] as GameboardQuestObjective[],
  /** Objective progress records. */
  progress: () => [] as GameboardQuestObjectiveProgress[],
  /** Serializable quest metadata. */
  metadata: () => ({}) as Record<string, GameboardQuestMetadataValue>,
});

/** Marker trait for quest entities. */
export const IsGameboardQuest = trait();
/** Marker trait for active quest entities. */
export const IsActiveGameboardQuest = trait();
/** Marker trait for completed quest entities. */
export const IsCompletedGameboardQuest = trait();
/** Marker trait for blocked quest entities. */
export const IsBlockedGameboardQuest = trait();
