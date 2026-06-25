/**
 * System tick orchestration for patrol, movement, and quest advancement.
 *
 * @module
 */
import type { World } from 'koota';
import {
  runGameboardMovementSystem,
  type AdvanceGameboardMovementOptions,
  type GameboardMovementAdvanceResult,
} from '../movement';
import {
  runGameboardPatrolSystem,
  type AdvanceGameboardPatrolOptions,
  type GameboardPatrolAdvanceResult,
} from '../patrol';
import {
  advanceAllGameboardQuests,
  readGameboardQuests,
  type AdvanceGameboardQuestOptions,
  type GameboardQuestSnapshot,
} from '../quests';
import {
  snapshotGameboardSystemEvents,
  type GameboardSystemEvent,
  type GameboardSystemEventRecord,
} from './events';

/**
 * System tick options. Set a subsystem to false to skip it for this tick.
 */
export interface RunGameboardSystemsOptions {
  /** Patrol advancement options or false to skip patrols. */
  patrols?: AdvanceGameboardPatrolOptions | false;
  /** Movement advancement options or false to skip movement. */
  movement?: AdvanceGameboardMovementOptions | false;
  /** Quest advancement options or false to skip quests. */
  quests?: AdvanceGameboardQuestOptions | false;
}

/**
 * Result of running patrol, movement, and quest systems.
 */
export interface RunGameboardSystemsResult {
  /** Patrol results produced by this tick. */
  patrols: readonly GameboardPatrolAdvanceResult[];
  /** Movement results produced by this tick. */
  movement: readonly GameboardMovementAdvanceResult[];
  /** Quest snapshots after advancement. */
  quests: readonly GameboardQuestSnapshot[];
  /** In-memory events emitted by all enabled systems. */
  events: readonly GameboardSystemEvent[];
  /** Serializable event records derived from `events`. */
  eventRecords: readonly GameboardSystemEventRecord[];
}

/**
 * Runs the enabled patrol, movement, and quest systems for one game-loop tick.
 */
export function runGameboardSystems(
  world: World,
  options: RunGameboardSystemsOptions = {}
): RunGameboardSystemsResult {
  const patrols = options.patrols === false ? [] : runGameboardPatrolSystem(world, options.patrols ?? {});
  const movement = options.movement === false ? [] : runGameboardMovementSystem(world, options.movement ?? {});
  const beforeQuests = options.quests === false ? [] : readGameboardQuests(world);
  const quests = options.quests === false ? [] : advanceAllGameboardQuests(world, options.quests ?? {});
  const events: GameboardSystemEvent[] = [];
  for (const patrol of patrols) {
    for (const event of patrolEvents(patrol)) {
      events.push(event);
    }
  }
  for (const move of movement) {
    for (const event of movementEvents(move)) {
      events.push(event);
    }
  }
  for (const event of questEvents(beforeQuests, quests)) {
    events.push(event);
  }
  return {
    patrols,
    movement,
    quests,
    events,
    eventRecords: snapshotGameboardSystemEvents(events),
  };
}

function patrolEvents(patrol: GameboardPatrolAdvanceResult): GameboardSystemEvent[] {
  const events: GameboardSystemEvent[] = [];
  if (patrol.requested) {
    if (patrol.state.status === 'blocked') {
      events.push({ type: 'patrol-blocked', patrol, reason: patrol.state.reason });
    } else {
      events.push({ type: 'patrol-move-requested', patrol });
    }
  }
  if (patrol.state.status === 'waiting' && patrol.previousState.status !== 'waiting') {
    events.push({ type: 'patrol-waiting', patrol });
  }
  if (patrol.state.status === 'completed' && patrol.previousState.status !== 'completed') {
    events.push({ type: 'patrol-completed', patrol });
  }
  if (patrol.state.status === 'blocked' && !patrol.requested && patrol.previousState.status !== 'blocked') {
    events.push({ type: 'patrol-blocked', patrol, reason: patrol.state.reason });
  }
  return events;
}

function movementEvents(movement: GameboardMovementAdvanceResult): GameboardSystemEvent[] {
  const events: GameboardSystemEvent[] = [];
  if (movement.moved) {
    events.push({ type: 'movement-stepped', movement });
  }
  if (movement.state.status === 'completed') {
    events.push({ type: 'movement-completed', movement });
  }
  if (movement.state.status === 'blocked' || movement.state.status === 'out-of-range') {
    events.push({ type: 'movement-blocked', movement, reason: movement.state.reason });
  }
  return events;
}

function questEvents(
  beforeQuests: readonly GameboardQuestSnapshot[],
  afterQuests: readonly GameboardQuestSnapshot[]
): GameboardSystemEvent[] {
  const beforeById = new Map(beforeQuests.map((quest) => [quest.quest.questId, quest]));
  const events: GameboardSystemEvent[] = [];
  for (const quest of afterQuests) {
    const before = beforeById.get(quest.quest.questId);
    if (!questChanged(before, quest)) {
      continue;
    }
    events.push({ type: 'quest-advanced', before, quest });
    if (quest.quest.status === 'completed' && before?.quest.status !== 'completed') {
      events.push({ type: 'quest-completed', before, quest });
    }
    if (quest.quest.status === 'blocked' && before?.quest.status !== 'blocked') {
      events.push({
        type: 'quest-blocked',
        before,
        quest,
        reason: quest.quest.progress.find((progress) => progress.status === 'blocked')?.detail,
      });
    }
  }
  return events;
}

function questChanged(
  before: GameboardQuestSnapshot | undefined,
  after: GameboardQuestSnapshot
): boolean {
  if (!before) {
    return true;
  }
  return (
    before.quest.status !== after.quest.status ||
    before.quest.activeObjectiveIndex !== after.quest.activeObjectiveIndex ||
    progressSignature(before) !== progressSignature(after)
  );
}

function progressSignature(snapshot: GameboardQuestSnapshot): string {
  return snapshot.quest.progress
    .map((progress) => `${progress.objectiveId}:${progress.status}:${progress.detail}:${progress.completedAtStep ?? ''}`)
    .join('|');
}
