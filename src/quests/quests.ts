/**
 * Quest definitions and evaluators for reach, interaction, collision, and
 * defeat objectives against live actor and placement state.
 *
 * @module
 */
import {
  createActions,
  createQuery,
  type Entity,
  type TraitRecord,
  type World,
} from 'koota';
import {
  findGameboardActor,
  inspectGameboardActorCollision,
  type GameboardActorCollisionReport,
  type GameboardActorSnapshot,
} from '../actors';
import { hexDistance, hexKey, parseHexKey } from '../coordinates';
import { GameboardRuntimeError } from '../errors';
import type { HexCoordinates } from '../types';

/**
 * Schema version written to quest trait state.
 *
 * Lives in `src/traits`; re-exported here for backward compatibility.
 */
export {
  GAMEBOARD_QUEST_SCHEMA_VERSION,
} from '../traits';
export type {
  GameboardQuestCollisionExpectation,
  GameboardQuestMetadataValue,
  GameboardQuestObjectiveStatus,
  GameboardQuestStatus,
} from '../traits';
import { GAMEBOARD_QUEST_SCHEMA_VERSION } from '../traits';
import type {
  GameboardQuestMetadataValue,
  GameboardQuestStatus,
} from '../traits';

/**
 * Serializable quest definition.
 */
export interface GameboardQuestDefinition {
  /** Stable quest id. */
  id: string;
  /** Optional display title. */
  title?: string;
  /** Ordered quest objectives. */
  objectives: readonly GameboardQuestObjective[];
  /** Serializable quest metadata. */
  metadata?: Readonly<Record<string, GameboardQuestMetadataValue>>;
}

// Objective + progress shapes live in `src/traits`; re-export so the
// historical surface still works.
export type {
  CollisionQuestObjective,
  DefeatActorQuestObjective,
  GameboardQuestObjective,
  GameboardQuestObjectiveBase,
  GameboardQuestObjectiveProgress,
  InteractActorQuestObjective,
  ReachActorQuestObjective,
  ReachTileQuestObjective,
} from '../traits';
import type {
  CollisionQuestObjective,
  DefeatActorQuestObjective,
  GameboardQuestCollisionExpectation,
  GameboardQuestObjective,
  GameboardQuestObjectiveProgress,
  InteractActorQuestObjective,
  ReachActorQuestObjective,
  ReachTileQuestObjective,
} from '../traits';

/**
 * Joined quest entity and quest trait state.
 */
export interface GameboardQuestSnapshot {
  /** Live Koota quest entity. */
  entity: Entity;
  /** Quest trait value. */
  quest: GameboardQuestValue;
}

/**
 * Options for spawning a quest.
 */
export interface SpawnGameboardQuestOptions {
  /** Initial quest status. Defaults to `active`. */
  status?: GameboardQuestStatus;
}

/**
 * Options for advancing quest state.
 */
export interface AdvanceGameboardQuestOptions {
  /** Continue through completed objectives in one advance call. */
  advanceThroughCompleted?: boolean;
  /** Current simulation/system step. */
  step?: number;
}

/**
 * Result of evaluating one objective.
 */
export interface GameboardQuestObjectiveEvaluation {
  /** Objective that was evaluated. */
  objective: GameboardQuestObjective;
  /** Progress produced by evaluation. */
  progress: GameboardQuestObjectiveProgress;
  /** Source actor, when resolved. */
  source?: GameboardActorSnapshot;
  /** Target actor, when resolved. */
  target?: GameboardActorSnapshot;
  /** Collision report, for collision objectives. */
  collision?: GameboardActorCollisionReport;
}

// Trait declarations live in `src/traits`; re-export here.
export {
  GameboardQuest,
  IsActiveGameboardQuest,
  IsBlockedGameboardQuest,
  IsCompletedGameboardQuest,
  IsGameboardQuest,
} from '../traits';
import {
  GameboardQuest,
  IsActiveGameboardQuest,
  IsBlockedGameboardQuest,
  IsCompletedGameboardQuest,
  IsGameboardQuest,
} from '../traits';

/** Query for all quest entities. */
export const GameboardQuestQuery = createQuery(IsGameboardQuest, GameboardQuest);
/** Query for active quest entities. */
export const ActiveGameboardQuestQuery = createQuery(IsGameboardQuest, IsActiveGameboardQuest, GameboardQuest);
/** Query for completed quest entities. */
export const CompletedGameboardQuestQuery = createQuery(IsGameboardQuest, IsCompletedGameboardQuest, GameboardQuest);
/** Query for blocked quest entities. */
export const BlockedGameboardQuestQuery = createQuery(IsGameboardQuest, IsBlockedGameboardQuest, GameboardQuest);

/** Quest trait value. */
export type GameboardQuestValue = TraitRecord<typeof GameboardQuest>;

/**
 * Koota action bundle for spawning, advancing, reading, and finding quests.
 */
export const gameboardQuestActions = createActions((world) => ({
  /** Spawn a quest entity. */
  spawn: (definition: GameboardQuestDefinition, options: SpawnGameboardQuestOptions = {}) =>
    spawnGameboardQuest(world, definition, options),
  /** Advance one quest entity. */
  advance: (quest: Entity | string, options: AdvanceGameboardQuestOptions = {}) =>
    advanceGameboardQuest(world, quest, options),
  /** Advance every quest entity. */
  advanceAll: (options: AdvanceGameboardQuestOptions = {}) => advanceAllGameboardQuests(world, options),
  /** Read all quest snapshots. */
  read: () => readGameboardQuests(world),
  /** Find one quest snapshot. */
  find: (quest: Entity | string) => findGameboardQuest(world, quest),
}));

/**
 * Normalize a quest definition into a serializable copy.
 */
export function createGameboardQuest(definition: GameboardQuestDefinition): GameboardQuestDefinition {
  return {
    id: definition.id,
    title: definition.title,
    objectives: definition.objectives.map(copyObjective),
    metadata: { ...(definition.metadata ?? {}) },
  };
}

/**
 * Spawn a quest entity into a Koota world.
 */
export function spawnGameboardQuest(
  world: World,
  definition: GameboardQuestDefinition,
  options: SpawnGameboardQuestOptions = {}
): Entity {
  const quest = createGameboardQuest(definition);
  const entity = world.spawn(
    IsGameboardQuest,
    GameboardQuest({
      schemaVersion: GAMEBOARD_QUEST_SCHEMA_VERSION,
      questId: quest.id,
      title: quest.title ?? quest.id,
      status: options.status ?? 'active',
      activeObjectiveIndex: 0,
      objectives: quest.objectives.map(copyObjective),
      progress: quest.objectives.map((objective) => ({
        objectiveId: objective.id,
        status: 'pending',
        detail: 'Pending',
      })),
      metadata: { ...(quest.metadata ?? {}) },
    })
  );
  retagQuest(entity);
  return entity;
}

/**
 * Find a quest entity by entity reference or quest id.
 */
export function findGameboardQuestEntity(world: World, quest: Entity | string): Entity | undefined {
  if (typeof quest !== 'string') {
    return quest.has(GameboardQuest) ? quest : undefined;
  }
  return world.query(GameboardQuestQuery).find((entity) => entity.get(GameboardQuest)?.questId === quest);
}

/**
 * Find a quest snapshot by entity reference or quest id.
 */
export function findGameboardQuest(world: World, quest: Entity | string): GameboardQuestSnapshot | undefined {
  const entity = findGameboardQuestEntity(world, quest);
  return entity ? snapshotForQuestEntity(entity) : undefined;
}

/**
 * Read all quest snapshots sorted by quest id.
 */
export function readGameboardQuests(world: World): GameboardQuestSnapshot[] {
  return world
    .query(GameboardQuestQuery)
    .map(snapshotForQuestEntity)
    .sort((left, right) => left.quest.questId.localeCompare(right.quest.questId));
}

/**
 * Evaluate one quest objective without mutating quest state.
 */
export function evaluateGameboardQuestObjective(
  world: World,
  objective: GameboardQuestObjective,
  step = 0
): GameboardQuestObjectiveEvaluation {
  switch (objective.kind) {
    case 'reach-tile':
      return evaluateReachTileObjective(world, objective, step);
    case 'reach-actor':
      return evaluateReachActorObjective(world, objective, step, objective.maxDistance ?? 0);
    case 'interact-actor':
      return evaluateReachActorObjective(world, objective, step, objective.maxDistance ?? 1);
    case 'defeat-actor':
      return evaluateDefeatActorObjective(world, objective, step);
    case 'collision':
      return evaluateCollisionObjective(world, objective, step);
  }
}

/**
 * Advance one quest and update objective progress.
 */
export function advanceGameboardQuest(
  world: World,
  quest: Entity | string,
  options: AdvanceGameboardQuestOptions = {}
): GameboardQuestSnapshot {
  const entity = requireQuestEntity(world, quest);
  const current = requireQuestState(entity);
  const progressById = new Map(current.progress.map((item) => [item.objectiveId, item]));
  const advanceThroughCompleted = options.advanceThroughCompleted ?? true;
  let activeObjectiveIndex = current.activeObjectiveIndex;
  let status: GameboardQuestStatus = current.status === 'completed' ? 'completed' : 'active';

  while (activeObjectiveIndex < current.objectives.length) {
    const objective = current.objectives[activeObjectiveIndex];
    if (objective === undefined) {
      throw new GameboardRuntimeError(`Quest objective index ${activeObjectiveIndex} out of range`);
    }
    const evaluation = evaluateGameboardQuestObjective(world, objective, options.step ?? 0);
    progressById.set(objective.id, evaluation.progress);

    if (evaluation.progress.status === 'completed') {
      activeObjectiveIndex += 1;
      if (!advanceThroughCompleted) {
        break;
      }
      continue;
    }

    if (evaluation.progress.status === 'blocked') {
      status = 'blocked';
      break;
    }

    status = 'active';
    break;
  }

  if (activeObjectiveIndex >= current.objectives.length) {
    status = 'completed';
  }

  entity.set(GameboardQuest, {
    ...current,
    status,
    activeObjectiveIndex,
    objectives: current.objectives.map(copyObjective),
    progress: current.objectives.map((objective) => copyProgress(progressById.get(objective.id) ?? pendingProgress(objective))),
    metadata: { ...current.metadata },
  });
  retagQuest(entity);
  return snapshotForQuestEntity(entity);
}

/**
 * Advance every quest in the world.
 */
export function advanceAllGameboardQuests(
  world: World,
  options: AdvanceGameboardQuestOptions = {}
): GameboardQuestSnapshot[] {
  return world.query(GameboardQuestQuery).map((entity) => advanceGameboardQuest(world, entity, options));
}

function evaluateReachTileObjective(
  world: World,
  objective: ReachTileQuestObjective,
  step: number
): GameboardQuestObjectiveEvaluation {
  const source = findGameboardActor(world, objective.actor);
  if (!source) {
    return blockedEvaluation(objective, `Actor ${objective.actor} is missing`, step);
  }
  const targetTileKey = keyForTile(objective.tile);
  const distance = hexDistance(parseHexKey(source.placement.tileKey), parseHexKey(targetTileKey));
  const maxDistance = objective.maxDistance ?? 0;
  return {
    objective,
    source,
    progress:
      distance <= maxDistance
        ? completedProgress(objective, `Actor ${source.actor.actorId} reached ${targetTileKey}`, step)
        : pendingProgress(objective, `Actor ${source.actor.actorId} is ${distance} tile(s) from ${targetTileKey}`),
  };
}

function evaluateReachActorObjective(
  world: World,
  objective: ReachActorQuestObjective | InteractActorQuestObjective,
  step: number,
  maxDistance: number
): GameboardQuestObjectiveEvaluation {
  const source = findGameboardActor(world, objective.actor);
  const target = findGameboardActor(world, objective.targetActor);
  if (!source) {
    return blockedEvaluation(objective, `Actor ${objective.actor} is missing`, step);
  }
  if (!target) {
    return blockedEvaluation(objective, `Target actor ${objective.targetActor} is missing`, step);
  }
  const distance = hexDistance(parseHexKey(source.placement.tileKey), parseHexKey(target.placement.tileKey));
  return {
    objective,
    source,
    target,
    progress:
      distance <= maxDistance
        ? completedProgress(objective, `Actor ${source.actor.actorId} reached ${target.actor.actorId}`, step)
        : pendingProgress(objective, `Actor ${source.actor.actorId} is ${distance} tile(s) from ${target.actor.actorId}`),
  };
}

function evaluateDefeatActorObjective(
  world: World,
  objective: DefeatActorQuestObjective,
  step: number
): GameboardQuestObjectiveEvaluation {
  const target = findGameboardActor(world, objective.targetActor);
  return {
    objective,
    target,
    progress: target
      ? pendingProgress(objective, `Actor ${objective.targetActor} is still present`)
      : completedProgress(objective, `Actor ${objective.targetActor} is no longer present`, step),
  };
}

function evaluateCollisionObjective(
  world: World,
  objective: CollisionQuestObjective,
  step: number
): GameboardQuestObjectiveEvaluation {
  const targetTile = targetTileForCollisionObjective(world, objective);
  if (!targetTile) {
    return blockedEvaluation(objective, 'Collision objective has no resolvable target tile', step);
  }
  const source = objective.actor ? findGameboardActor(world, objective.actor) : undefined;
  const target = objective.targetActor ? findGameboardActor(world, objective.targetActor) : undefined;
  const collision = inspectGameboardActorCollision(world, source?.entity ?? objective.actor, targetTile);
  const matched = collisionMatchesExpectation(collision, objective.expect);
  return {
    objective,
    source,
    target,
    collision,
    progress: matched
      ? completedProgress(objective, `Collision expectation ${objective.expect} matched at ${targetTile}`, step)
      : blockedProgress(objective, `Collision expectation ${objective.expect} did not match at ${targetTile}`, step),
  };
}

function targetTileForCollisionObjective(world: World, objective: CollisionQuestObjective): string | undefined {
  if (objective.targetTile) {
    return keyForTile(objective.targetTile);
  }
  if (!objective.targetActor) {
    return undefined;
  }
  return findGameboardActor(world, objective.targetActor)?.placement.tileKey;
}

function collisionMatchesExpectation(
  collision: GameboardActorCollisionReport,
  expectation: GameboardQuestCollisionExpectation
): boolean {
  switch (expectation) {
    case 'can-enter':
      return collision.canEnter;
    case 'blocked':
      return !collision.canEnter;
    case 'hostile':
      return collision.hostileActors.length > 0;
    case 'interactive':
      return collision.interactiveActors.length > 0;
    case 'prop':
      return collision.propActors.length > 0;
  }
}

function keyForTile(tile: HexCoordinates | string): string {
  return typeof tile === 'string' ? tile : hexKey(tile);
}

function requireQuestEntity(world: World, quest: Entity | string): Entity {
  const entity = findGameboardQuestEntity(world, quest);
  if (!entity) {
    throw new GameboardRuntimeError(`No gameboard quest exists with id ${typeof quest === 'string' ? quest : String(quest.id())}`);
  }
  return entity;
}

function requireQuestState(entity: Entity): GameboardQuestValue {
  const quest = entity.get(GameboardQuest);
  if (!quest) {
    throw new GameboardRuntimeError(`Quest entity ${entity.id()} is missing GameboardQuest`);
  }
  return copyQuestValue(quest);
}

function snapshotForQuestEntity(entity: Entity): GameboardQuestSnapshot {
  return {
    entity,
    quest: requireQuestState(entity),
  };
}

function retagQuest(entity: Entity): void {
  const quest = entity.get(GameboardQuest);
  entity.remove(IsActiveGameboardQuest, IsCompletedGameboardQuest, IsBlockedGameboardQuest);
  if (!quest) {
    return;
  }
  if (quest.status === 'active') {
    entity.add(IsActiveGameboardQuest);
  }
  if (quest.status === 'completed') {
    entity.add(IsCompletedGameboardQuest);
  }
  if (quest.status === 'blocked') {
    entity.add(IsBlockedGameboardQuest);
  }
}

function completedProgress(
  objective: GameboardQuestObjective,
  detail: string,
  step: number
): GameboardQuestObjectiveProgress {
  return {
    objectiveId: objective.id,
    status: 'completed',
    detail,
    completedAtStep: step,
  };
}

function pendingProgress(objective: GameboardQuestObjective, detail = 'Pending'): GameboardQuestObjectiveProgress {
  return {
    objectiveId: objective.id,
    status: 'pending',
    detail,
  };
}

function blockedProgress(
  objective: GameboardQuestObjective,
  detail: string,
  step: number
): GameboardQuestObjectiveProgress {
  return {
    objectiveId: objective.id,
    status: 'blocked',
    detail,
    completedAtStep: step,
  };
}

function blockedEvaluation(
  objective: GameboardQuestObjective,
  detail: string,
  step: number
): GameboardQuestObjectiveEvaluation {
  return {
    objective,
    progress: blockedProgress(objective, detail, step),
  };
}

function copyQuestValue(quest: GameboardQuestValue): GameboardQuestValue {
  return {
    ...quest,
    objectives: quest.objectives.map(copyObjective),
    progress: quest.progress.map(copyProgress),
    metadata: { ...quest.metadata },
  };
}

function copyObjective(objective: GameboardQuestObjective): GameboardQuestObjective {
  return { ...objective };
}

function copyProgress(progress: GameboardQuestObjectiveProgress): GameboardQuestObjectiveProgress {
  return { ...progress };
}
