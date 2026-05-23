import {
  createActions,
  createQuery,
  trait,
  type Entity,
  type TraitRecord,
  type World,
} from 'koota';
import {
  findGameboardActor,
  inspectGameboardActorCollision,
  type GameboardActorCollisionReport,
  type GameboardActorSnapshot,
} from './actors';
import { hexDistance, hexKey, parseHexKey } from './coordinates';
import type { HexCoordinates } from './types';

export const GAMEBOARD_QUEST_SCHEMA_VERSION = '1.0.0';

export type GameboardQuestStatus = 'pending' | 'active' | 'completed' | 'blocked';
export type GameboardQuestObjectiveStatus = 'pending' | 'completed' | 'blocked';
export type GameboardQuestCollisionExpectation = 'can-enter' | 'blocked' | 'hostile' | 'interactive' | 'prop';
export type GameboardQuestMetadataValue = string | number | boolean | null;

export interface GameboardQuestDefinition {
  id: string;
  title?: string;
  objectives: readonly GameboardQuestObjective[];
  metadata?: Readonly<Record<string, GameboardQuestMetadataValue>>;
}

export interface GameboardQuestObjectiveBase {
  id: string;
  label?: string;
}

export interface ReachTileQuestObjective extends GameboardQuestObjectiveBase {
  kind: 'reach-tile';
  actor: string;
  tile: HexCoordinates | string;
  maxDistance?: number;
}

export interface ReachActorQuestObjective extends GameboardQuestObjectiveBase {
  kind: 'reach-actor';
  actor: string;
  targetActor: string;
  maxDistance?: number;
}

export interface InteractActorQuestObjective extends GameboardQuestObjectiveBase {
  kind: 'interact-actor';
  actor: string;
  targetActor: string;
  maxDistance?: number;
}

export interface DefeatActorQuestObjective extends GameboardQuestObjectiveBase {
  kind: 'defeat-actor';
  targetActor: string;
}

export interface CollisionQuestObjective extends GameboardQuestObjectiveBase {
  kind: 'collision';
  actor?: string;
  targetActor?: string;
  targetTile?: HexCoordinates | string;
  expect: GameboardQuestCollisionExpectation;
}

export type GameboardQuestObjective =
  | ReachTileQuestObjective
  | ReachActorQuestObjective
  | InteractActorQuestObjective
  | DefeatActorQuestObjective
  | CollisionQuestObjective;

export interface GameboardQuestObjectiveProgress {
  objectiveId: string;
  status: GameboardQuestObjectiveStatus;
  detail: string;
  completedAtStep?: number;
}

export interface GameboardQuestSnapshot {
  entity: Entity;
  quest: GameboardQuestValue;
}

export interface SpawnGameboardQuestOptions {
  status?: GameboardQuestStatus;
}

export interface AdvanceGameboardQuestOptions {
  advanceThroughCompleted?: boolean;
  step?: number;
}

export interface GameboardQuestObjectiveEvaluation {
  objective: GameboardQuestObjective;
  progress: GameboardQuestObjectiveProgress;
  source?: GameboardActorSnapshot;
  target?: GameboardActorSnapshot;
  collision?: GameboardActorCollisionReport;
}

export const GameboardQuest = trait({
  schemaVersion: GAMEBOARD_QUEST_SCHEMA_VERSION,
  questId: '',
  title: '',
  status: 'pending' as GameboardQuestStatus,
  activeObjectiveIndex: 0,
  objectives: () => [] as GameboardQuestObjective[],
  progress: () => [] as GameboardQuestObjectiveProgress[],
  metadata: () => ({}) as Record<string, GameboardQuestMetadataValue>,
});

export const IsGameboardQuest = trait();
export const IsActiveGameboardQuest = trait();
export const IsCompletedGameboardQuest = trait();
export const IsBlockedGameboardQuest = trait();

export const GameboardQuestQuery = createQuery(IsGameboardQuest, GameboardQuest);
export const ActiveGameboardQuestQuery = createQuery(IsGameboardQuest, IsActiveGameboardQuest, GameboardQuest);
export const CompletedGameboardQuestQuery = createQuery(IsGameboardQuest, IsCompletedGameboardQuest, GameboardQuest);
export const BlockedGameboardQuestQuery = createQuery(IsGameboardQuest, IsBlockedGameboardQuest, GameboardQuest);

export type GameboardQuestValue = TraitRecord<typeof GameboardQuest>;

export const gameboardQuestActions = createActions((world) => ({
  spawn: (definition: GameboardQuestDefinition, options: SpawnGameboardQuestOptions = {}) =>
    spawnGameboardQuest(world, definition, options),
  advance: (quest: Entity | string, options: AdvanceGameboardQuestOptions = {}) =>
    advanceGameboardQuest(world, quest, options),
  advanceAll: (options: AdvanceGameboardQuestOptions = {}) => advanceAllGameboardQuests(world, options),
  read: () => readGameboardQuests(world),
  find: (quest: Entity | string) => findGameboardQuest(world, quest),
}));

export function createGameboardQuest(definition: GameboardQuestDefinition): GameboardQuestDefinition {
  return {
    id: definition.id,
    title: definition.title,
    objectives: definition.objectives.map(copyObjective),
    metadata: { ...(definition.metadata ?? {}) },
  };
}

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

export function findGameboardQuestEntity(world: World, quest: Entity | string): Entity | undefined {
  if (typeof quest !== 'string') {
    return quest.has(GameboardQuest) ? quest : undefined;
  }
  return world.query(GameboardQuestQuery).find((entity) => entity.get(GameboardQuest)?.questId === quest);
}

export function findGameboardQuest(world: World, quest: Entity | string): GameboardQuestSnapshot | undefined {
  const entity = findGameboardQuestEntity(world, quest);
  return entity ? snapshotForQuestEntity(entity) : undefined;
}

export function readGameboardQuests(world: World): GameboardQuestSnapshot[] {
  return world
    .query(GameboardQuestQuery)
    .map(snapshotForQuestEntity)
    .sort((left, right) => left.quest.questId.localeCompare(right.quest.questId));
}

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
    throw new Error(`No gameboard quest exists with id ${typeof quest === 'string' ? quest : String(quest.id())}`);
  }
  return entity;
}

function requireQuestState(entity: Entity): GameboardQuestValue {
  const quest = entity.get(GameboardQuest);
  if (!quest) {
    throw new Error(`Quest entity ${entity.id()} is missing GameboardQuest`);
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
