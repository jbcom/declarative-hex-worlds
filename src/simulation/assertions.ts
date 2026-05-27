/**
 * Expectation primitives evaluated against a {@link GameboardScenarioSimulationReport}.
 *
 * Split out of the original monolithic `./simulation` during PRD D3 (H-3).
 *
 * @module
 */
import { GameboardRuntimeError } from '../errors';
import type {
  GameboardInteractionCommandRecord,
  GameboardMovementEventRecord,
  GameboardPatrolEventRecord,
  GameboardSystemEventRecord,
} from '../systems';
import type { GameboardQuestObjectiveProgress } from '../quests';
import type {
  GameboardScenarioSimulationActorTargetRecord,
  GameboardScenarioSimulationActorTargetsExpectation,
  GameboardScenarioSimulationActorTargetsRecord,
  GameboardScenarioSimulationActorExpectation,
  GameboardScenarioSimulationCommandExpectation,
  GameboardScenarioSimulationExpectationFailure,
  GameboardScenarioSimulationExpectations,
  GameboardScenarioSimulationMovementExpectation,
  GameboardScenarioSimulationMutationExpectation,
  GameboardScenarioSimulationMutationRecord,
  GameboardScenarioSimulationPatrolExpectation,
  GameboardScenarioSimulationPlacementExpectation,
  GameboardScenarioSimulationQuestExpectation,
} from './script';
import type {
  GameboardScenarioSimulationCommandRecord,
  GameboardScenarioSimulationMovementRecord,
  GameboardScenarioSimulationPatrolRecord,
  GameboardScenarioSimulationQuestRecord,
  GameboardScenarioSimulationReport,
} from './report';

/**
 * Evaluates report expectations and returns all failures without throwing.
 */
export function evaluateGameboardScenarioSimulationExpectations(
  report: GameboardScenarioSimulationReport,
  expectations: GameboardScenarioSimulationExpectations | undefined = report.expectations
): GameboardScenarioSimulationExpectationFailure[] {
  if (!expectations) {
    return [];
  }
  return [
    ...eventExpectationFailures(report, expectations),
    ...commandExpectationFailures(report, expectations.commands ?? []),
    ...actorTargetExpectationFailures(report, expectations.actorTargets ?? []),
    ...patrolExpectationFailures(report, expectations.patrols ?? []),
    ...movementExpectationFailures(report, expectations.movements ?? []),
    ...mutationExpectationFailures(report, expectations.mutations ?? []),
    ...actorExpectationFailures(report, expectations.actors ?? []),
    ...placementExpectationFailures(report, expectations.placements ?? []),
    ...questExpectationFailures(report, expectations.quests ?? []),
  ];
}

/**
 * Throws when a simulation report does not satisfy its expectations.
 */
export function assertGameboardScenarioSimulationExpectations(
  report: GameboardScenarioSimulationReport,
  expectations: GameboardScenarioSimulationExpectations | undefined = report.expectations
): void {
  const failures = evaluateGameboardScenarioSimulationExpectations(report, expectations);
  if (failures.length > 0) {
    throw new GameboardRuntimeError(
      failures.map((failure) => `${failure.path}: ${failure.message}`).join('\n')
    );
  }
}

function eventExpectationFailures(
  report: GameboardScenarioSimulationReport,
  expectations: GameboardScenarioSimulationExpectations
): GameboardScenarioSimulationExpectationFailure[] {
  const failures: GameboardScenarioSimulationExpectationFailure[] = [];
  const actualEventTypes = report.eventRecords.map((event) => event.type);
  if (expectations.eventTypes && !arrayEquals(actualEventTypes, expectations.eventTypes)) {
    failures.push({
      path: 'expectations.eventTypes',
      message: 'Simulation event type sequence did not match',
      expected: [...expectations.eventTypes],
      actual: actualEventTypes,
    });
  }
  for (const eventType of expectations.requiredEventTypes ?? []) {
    if (!actualEventTypes.includes(eventType)) {
      failures.push({
        path: `expectations.requiredEventTypes.${eventType}`,
        message: `Required event type ${eventType} was not emitted`,
        expected: eventType,
        actual: actualEventTypes,
      });
    }
  }
  return failures;
}

function commandExpectationFailures(
  report: GameboardScenarioSimulationReport,
  expectations: readonly GameboardScenarioSimulationCommandExpectation[]
): GameboardScenarioSimulationExpectationFailure[] {
  const failures: GameboardScenarioSimulationExpectationFailure[] = [];
  expectations.forEach((expectation, index) => {
    const candidates = report.commands.filter((command) =>
      commandExpectationTargetsRecord(command, expectation)
    );
    if (candidates.length === 0) {
      failures.push({
        path: `expectations.commands.${index}`,
        message: 'No command step matched expectation selector',
        expected: expectation,
        actual: report.steps.map((step) => ({
          index: step.index,
          id: step.id,
          action: step.action,
        })),
      });
      return;
    }
    if (candidates.some((record) => commandMatches(record.command, expectation))) {
      return;
    }
    failures.push({
      path: `expectations.commands.${index}`,
      message: 'No command record matched expectation',
      expected: expectation,
      actual: candidates,
    });
  });
  return failures;
}

function actorTargetExpectationFailures(
  report: GameboardScenarioSimulationReport,
  expectations: readonly GameboardScenarioSimulationActorTargetsExpectation[]
): GameboardScenarioSimulationExpectationFailure[] {
  const failures: GameboardScenarioSimulationExpectationFailure[] = [];
  expectations.forEach((expectation, index) => {
    const candidates = report.actorTargets.filter((record) =>
      actorTargetExpectationTargetsRecord(record, expectation)
    );
    if (candidates.length === 0) {
      failures.push({
        path: `expectations.actorTargets.${index}`,
        message: 'No actor target inspection matched expectation selector',
        expected: expectation,
        actual: report.steps.map((step) => ({
          index: step.index,
          id: step.id,
          action: step.action,
        })),
      });
      return;
    }
    if (candidates.some((record) => actorTargetsMatch(record, expectation))) {
      return;
    }
    failures.push({
      path: `expectations.actorTargets.${index}`,
      message: 'No actor target inspection matched expectation',
      expected: expectation,
      actual: candidates,
    });
  });
  return failures;
}

function movementExpectationFailures(
  report: GameboardScenarioSimulationReport,
  expectations: readonly GameboardScenarioSimulationMovementExpectation[]
): GameboardScenarioSimulationExpectationFailure[] {
  const failures: GameboardScenarioSimulationExpectationFailure[] = [];
  expectations.forEach((expectation, index) => {
    const candidates = report.movements.filter((movement) =>
      movementExpectationTargetsRecord(movement, expectation)
    );
    if (candidates.length === 0) {
      failures.push({
        path: `expectations.movements.${index}`,
        message: 'No movement event matched expectation selector',
        expected: expectation,
        actual: report.steps.map((step) => ({
          index: step.index,
          id: step.id,
          events: step.eventRecords.map((eventRecord) => eventRecord.type),
        })),
      });
      return;
    }
    if (
      candidates.some((record) => movementMatches(record.eventType, record.movement, expectation))
    ) {
      return;
    }
    failures.push({
      path: `expectations.movements.${index}`,
      message: 'No movement record matched expectation',
      expected: expectation,
      actual: candidates,
    });
  });
  return failures;
}

function patrolExpectationFailures(
  report: GameboardScenarioSimulationReport,
  expectations: readonly GameboardScenarioSimulationPatrolExpectation[]
): GameboardScenarioSimulationExpectationFailure[] {
  const failures: GameboardScenarioSimulationExpectationFailure[] = [];
  expectations.forEach((expectation, index) => {
    const candidates = report.patrols.filter((patrol) =>
      patrolExpectationTargetsRecord(patrol, expectation)
    );
    if (candidates.length === 0) {
      failures.push({
        path: `expectations.patrols.${index}`,
        message: 'No patrol event matched expectation selector',
        expected: expectation,
        actual: report.steps.map((step) => ({
          index: step.index,
          id: step.id,
          events: step.eventRecords.map((eventRecord) => eventRecord.type),
        })),
      });
      return;
    }
    if (candidates.some((record) => patrolMatches(record.eventType, record.patrol, expectation))) {
      return;
    }
    failures.push({
      path: `expectations.patrols.${index}`,
      message: 'No patrol record matched expectation',
      expected: expectation,
      actual: candidates,
    });
  });
  return failures;
}

function mutationExpectationFailures(
  report: GameboardScenarioSimulationReport,
  expectations: readonly GameboardScenarioSimulationMutationExpectation[]
): GameboardScenarioSimulationExpectationFailure[] {
  return expectations.flatMap((expectation, index) =>
    report.mutations.some((mutation) => mutationMatches(mutation, expectation))
      ? []
      : [
          {
            path: `expectations.mutations.${index}`,
            message: 'No mutation matched expectation',
            expected: expectation,
            actual: report.mutations,
          },
        ]
  );
}

function actorExpectationFailures(
  report: GameboardScenarioSimulationReport,
  expectations: readonly GameboardScenarioSimulationActorExpectation[]
): GameboardScenarioSimulationExpectationFailure[] {
  const failures: GameboardScenarioSimulationExpectationFailure[] = [];
  for (const expectation of expectations) {
    const actor = report.actors.find((candidate) => candidate.actorId === expectation.actorId);
    const exists = expectation.exists ?? true;
    if (!exists) {
      if (actor) {
        failures.push({
          path: `expectations.actors.${expectation.actorId}.exists`,
          message: `Actor ${expectation.actorId} was expected to be absent`,
          expected: false,
          actual: true,
        });
      }
      continue;
    }
    if (!actor) {
      failures.push({
        path: `expectations.actors.${expectation.actorId}`,
        message: `Actor ${expectation.actorId} was not found`,
        expected: expectation,
        actual: report.actors.map((candidate) => candidate.actorId),
      });
      continue;
    }
    pushFieldFailure(
      failures,
      `expectations.actors.${expectation.actorId}.kind`,
      expectation.kind,
      actor.kind
    );
    pushFieldFailure(
      failures,
      `expectations.actors.${expectation.actorId}.faction`,
      expectation.faction,
      actor.faction
    );
    pushFieldFailure(
      failures,
      `expectations.actors.${expectation.actorId}.team`,
      expectation.team,
      actor.team
    );
    pushFieldFailure(
      failures,
      `expectations.actors.${expectation.actorId}.hostile`,
      expectation.hostile,
      actor.hostile
    );
    pushFieldFailure(
      failures,
      `expectations.actors.${expectation.actorId}.blocksMovement`,
      expectation.blocksMovement,
      actor.blocksMovement
    );
    pushFieldFailure(
      failures,
      `expectations.actors.${expectation.actorId}.interactive`,
      expectation.interactive,
      actor.interactive
    );
    pushArrayFieldFailure(
      failures,
      `expectations.actors.${expectation.actorId}.tags`,
      expectation.tags,
      actor.tags
    );
    for (const [key, expected] of Object.entries(expectation.metadata ?? {})) {
      pushFieldFailure(
        failures,
        `expectations.actors.${expectation.actorId}.metadata.${key}`,
        expected,
        actor.metadata[key]
      );
    }
    pushFieldFailure(
      failures,
      `expectations.actors.${expectation.actorId}.tileKey`,
      expectation.tileKey,
      actor.placement.tileKey
    );
    pushFieldFailure(
      failures,
      `expectations.actors.${expectation.actorId}.placementId`,
      expectation.placementId,
      actor.placement.placementId
    );
    pushFieldFailure(
      failures,
      `expectations.actors.${expectation.actorId}.assetId`,
      expectation.assetId,
      actor.placement.assetId
    );
  }
  return failures;
}

function placementExpectationFailures(
  report: GameboardScenarioSimulationReport,
  expectations: readonly GameboardScenarioSimulationPlacementExpectation[]
): GameboardScenarioSimulationExpectationFailure[] {
  const failures: GameboardScenarioSimulationExpectationFailure[] = [];
  for (const expectation of expectations) {
    const placement = report.placements.find(
      (candidate) => candidate.placementId === expectation.placementId
    );
    const exists = expectation.exists ?? true;
    if (!exists) {
      if (placement) {
        failures.push({
          path: `expectations.placements.${expectation.placementId}.exists`,
          message: `Placement ${expectation.placementId} was expected to be absent`,
          expected: false,
          actual: true,
        });
      }
      continue;
    }
    if (!placement) {
      failures.push({
        path: `expectations.placements.${expectation.placementId}`,
        message: `Placement ${expectation.placementId} was not found`,
        expected: expectation,
        actual: report.placements.map((candidate) => candidate.placementId),
      });
      continue;
    }
    pushFieldFailure(
      failures,
      `expectations.placements.${expectation.placementId}.tileKey`,
      expectation.tileKey,
      placement.tileKey
    );
    pushFieldFailure(
      failures,
      `expectations.placements.${expectation.placementId}.assetId`,
      expectation.assetId,
      placement.assetId
    );
    pushFieldFailure(
      failures,
      `expectations.placements.${expectation.placementId}.kind`,
      expectation.kind,
      placement.kind
    );
    pushFieldFailure(
      failures,
      `expectations.placements.${expectation.placementId}.layer`,
      expectation.layer,
      placement.layer
    );
    pushFieldFailure(
      failures,
      `expectations.placements.${expectation.placementId}.requiresExtra`,
      expectation.requiresExtra,
      placement.requiresExtra
    );
    for (const [key, expected] of Object.entries(expectation.metadata ?? {})) {
      pushFieldFailure(
        failures,
        `expectations.placements.${expectation.placementId}.metadata.${key}`,
        expected,
        placement.metadata[key]
      );
    }
  }
  return failures;
}

function questExpectationFailures(
  report: GameboardScenarioSimulationReport,
  expectations: readonly GameboardScenarioSimulationQuestExpectation[]
): GameboardScenarioSimulationExpectationFailure[] {
  const failures: GameboardScenarioSimulationExpectationFailure[] = [];
  for (const expectation of expectations) {
    const quest = report.quests.find((candidate) => candidate.questId === expectation.questId);
    if (!quest) {
      failures.push({
        path: `expectations.quests.${expectation.questId}`,
        message: `Quest ${expectation.questId} was not found`,
        expected: expectation,
        actual: report.quests.map((candidate) => candidate.questId),
      });
      continue;
    }
    pushFieldFailure(
      failures,
      `expectations.quests.${expectation.questId}.status`,
      expectation.status,
      quest.status
    );
    pushFieldFailure(
      failures,
      `expectations.quests.${expectation.questId}.activeObjectiveId`,
      expectation.activeObjectiveId,
      quest.activeObjectiveId
    );
    pushObjectiveFailures(failures, quest, expectation.completedObjectives ?? [], 'completed');
    pushObjectiveFailures(failures, quest, expectation.blockedObjectives ?? [], 'blocked');
    pushObjectiveFailures(failures, quest, expectation.pendingObjectives ?? [], 'pending');
  }
  return failures;
}

function mutationMatches(
  actual: GameboardScenarioSimulationMutationRecord,
  expected: GameboardScenarioSimulationMutationExpectation
): boolean {
  return (
    matchesOptional(expected.type, actual.type) &&
    matchesOptional(expected.actorId, actual.actorId) &&
    matchesOptional(expected.placementId, actual.placementId) &&
    matchesOptional(expected.removed, actual.removed) &&
    matchesOptional(expected.spawned, actual.spawned) &&
    matchesOptional(expected.updated, actual.updated)
  );
}

function commandExpectationTargetsRecord(
  record: GameboardScenarioSimulationCommandRecord,
  expectation: GameboardScenarioSimulationCommandExpectation
): boolean {
  return (
    matchesOptional(expectation.stepId, record.stepId) &&
    matchesOptional(expectation.stepIndex, record.stepIndex)
  );
}

function actorTargetExpectationTargetsRecord(
  record: GameboardScenarioSimulationActorTargetsRecord,
  expectation: GameboardScenarioSimulationActorTargetsExpectation
): boolean {
  return (
    matchesOptional(expectation.stepId, record.stepId) &&
    matchesOptional(expectation.stepIndex, record.stepIndex)
  );
}

function commandMatches(
  actual: GameboardInteractionCommandRecord,
  expected: GameboardScenarioSimulationCommandExpectation
): boolean {
  return (
    matchesOptional(expected.kind, actual.kind) &&
    matchesOptional(expected.intent, actual.intent) &&
    matchesOptional(expected.status, actual.status) &&
    matchesOptional(expected.canExecute, actual.canExecute) &&
    matchesOptional(expected.reason, actual.reason) &&
    matchesOptional(expected.tileKey, actual.tileKey) &&
    matchesOptional(expected.placementId, actual.placementId) &&
    matchesOptional(expected.actorId, actual.actorId) &&
    matchesOptional(expected.sourceActorId, actual.sourceActorId) &&
    matchesOptional(expected.sourcePlacementId, actual.sourcePlacementId) &&
    matchesOptional(expected.handlerId, actual.handlerId) &&
    matchesOptional(expected.handlerStatus, actual.handlerStatus) &&
    matchesOptionalArray(expected.effectTypes, actual.effectTypes ?? []) &&
    matchesOptional(expected.targetKind, actual.target.kind) &&
    matchesOptional(expected.targetIntent, actual.target.intent) &&
    matchesOptional(expected.targetTileKey, actual.target.tileKey) &&
    matchesOptional(expected.targetPlacementId, actual.target.placementId) &&
    matchesOptional(expected.targetActorId, actual.target.actorId) &&
    matchesOptional(expected.targetCanEnter, actual.target.canEnter)
  );
}

function actorTargetsMatch(
  actual: GameboardScenarioSimulationActorTargetsRecord,
  expected: GameboardScenarioSimulationActorTargetsExpectation
): boolean {
  return (
    matchesOptional(expected.sourceActorId, actual.sourceActorId) &&
    matchesOptionalArray(expected.targetActorIds, actual.targetActorIds) &&
    matchesOptionalArray(expected.reachableActorIds, actual.reachableActorIds) &&
    matchesOptional(expected.reason, actual.reason) &&
    actorTargetRecordMatches(
      actual.nearestTarget,
      {
        actorId: expected.nearestActorId,
        approach: expected.nearestApproach,
        approachTileKey: expected.nearestApproachTileKey,
        reachable: expected.nearestReachable,
        pathFound: expected.nearestPathFound,
        pathCost: expected.nearestPathCost,
        pathKeys: expected.nearestPathKeys,
      },
      false
    ) &&
    matchesAnyActorTarget(actual.targets, expected)
  );
}

function matchesAnyActorTarget(
  targets: readonly GameboardScenarioSimulationActorTargetRecord[],
  expected: GameboardScenarioSimulationActorTargetsExpectation
): boolean {
  if (!hasSpecificActorTargetExpectation(expected)) {
    return true;
  }
  return targets.some((target) =>
    actorTargetRecordMatches(
      target,
      {
        actorId: expected.targetActorId,
        approach: expected.targetApproach,
        approachTileKey: expected.targetApproachTileKey,
        reachable: expected.targetReachable,
        pathFound: expected.targetPathFound,
        pathCost: expected.targetPathCost,
        pathKeys: expected.targetPathKeys,
        commandKind: expected.targetCommandKind,
        commandIntent: expected.targetCommandIntent,
        commandCanExecute: expected.targetCommandCanExecute,
      },
      true
    )
  );
}

interface ActorTargetRecordExpectation {
  actorId?: string;
  approach?: GameboardScenarioSimulationActorTargetRecord['approach'];
  approachTileKey?: string;
  reachable?: boolean;
  pathFound?: boolean;
  pathCost?: number;
  pathKeys?: readonly string[];
  commandKind?: GameboardInteractionCommandRecord['kind'];
  commandIntent?: GameboardInteractionCommandRecord['intent'];
  commandCanExecute?: boolean;
}

function actorTargetRecordMatches(
  actual: GameboardScenarioSimulationActorTargetRecord | undefined,
  expected: ActorTargetRecordExpectation,
  includeCommandFields: boolean
): boolean {
  if (!hasActorTargetRecordExpectation(expected)) {
    return true;
  }
  if (!actual) {
    return false;
  }
  return (
    matchesOptional(expected.actorId, actual.actorId) &&
    matchesOptional(expected.approach, actual.approach) &&
    matchesOptional(expected.approachTileKey, actual.approachTileKey) &&
    matchesOptional(expected.reachable, actual.reachable) &&
    matchesOptional(expected.pathFound, actual.pathFound) &&
    matchesOptional(expected.pathCost, actual.pathCost) &&
    matchesOptionalArray(expected.pathKeys, actual.pathKeys) &&
    (!includeCommandFields ||
      (matchesOptional(expected.commandKind, actual.commandKind) &&
        matchesOptional(expected.commandIntent, actual.commandIntent) &&
        matchesOptional(expected.commandCanExecute, actual.commandCanExecute)))
  );
}

function hasSpecificActorTargetExpectation(
  expected: GameboardScenarioSimulationActorTargetsExpectation
): boolean {
  return hasActorTargetRecordExpectation({
    actorId: expected.targetActorId,
    approach: expected.targetApproach,
    approachTileKey: expected.targetApproachTileKey,
    reachable: expected.targetReachable,
    pathFound: expected.targetPathFound,
    pathCost: expected.targetPathCost,
    pathKeys: expected.targetPathKeys,
    commandKind: expected.targetCommandKind,
    commandIntent: expected.targetCommandIntent,
    commandCanExecute: expected.targetCommandCanExecute,
  });
}

function hasActorTargetRecordExpectation(expected: ActorTargetRecordExpectation): boolean {
  return Object.values(expected).some((value) => value !== undefined);
}

function movementExpectationTargetsRecord(
  record: GameboardScenarioSimulationMovementRecord,
  expectation: GameboardScenarioSimulationMovementExpectation
): boolean {
  return (
    matchesOptional(expectation.stepId, record.stepId) &&
    matchesOptional(expectation.stepIndex, record.stepIndex)
  );
}

function patrolExpectationTargetsRecord(
  record: GameboardScenarioSimulationPatrolRecord,
  expectation: GameboardScenarioSimulationPatrolExpectation
): boolean {
  return (
    matchesOptional(expectation.stepId, record.stepId) &&
    matchesOptional(expectation.stepIndex, record.stepIndex)
  );
}

function movementMatches(
  eventType: GameboardSystemEventRecord['type'],
  actual: GameboardMovementEventRecord,
  expected: GameboardScenarioSimulationMovementExpectation
): boolean {
  return (
    matchesOptional(expected.eventType, eventType) &&
    matchesOptional(expected.actorId, actual.actorId) &&
    matchesOptional(expected.placementId, actual.placementId) &&
    matchesOptional(expected.tileKey, actual.tileKey) &&
    matchesOptional(expected.assetId, actual.assetId) &&
    matchesOptional(expected.profileId, actual.profileId) &&
    matchesOptional(expected.moved, actual.moved) &&
    matchesOptional(expected.status, actual.state.status) &&
    matchesOptional(expected.destinationKey, actual.state.destinationKey) &&
    matchesOptional(expected.nextIndex, actual.state.nextIndex) &&
    matchesOptional(expected.cost, actual.state.cost) &&
    matchesOptional(expected.spentCost, actual.state.spentCost) &&
    matchesOptional(expected.visited, actual.state.visited) &&
    matchesOptional(expected.reason, actual.state.reason) &&
    matchesOptionalArray(expected.pathKeys, actual.state.pathKeys) &&
    includesAll(actual.state.pathKeys, expected.pathIncludes)
  );
}

function patrolMatches(
  eventType: GameboardSystemEventRecord['type'],
  actual: GameboardPatrolEventRecord,
  expected: GameboardScenarioSimulationPatrolExpectation
): boolean {
  return (
    matchesOptional(expected.eventType, eventType) &&
    matchesOptional(expected.actorId, actual.actorId) &&
    matchesOptional(expected.placementId, actual.placementId) &&
    matchesOptional(expected.routeId, actual.routeId) &&
    matchesOptional(expected.status, actual.status) &&
    matchesOptional(expected.targetKey, actual.targetKey) &&
    matchesOptional(expected.currentWaypointIndex, actual.currentWaypointIndex) &&
    matchesOptional(expected.targetWaypointIndex, actual.targetWaypointIndex) &&
    matchesOptional(expected.roundsCompleted, actual.roundsCompleted) &&
    matchesOptional(expected.requested, actual.requested) &&
    matchesOptional(expected.advanced, actual.advanced) &&
    matchesOptional(expected.reason, actual.reason)
  );
}

function pushObjectiveFailures(
  failures: GameboardScenarioSimulationExpectationFailure[],
  quest: GameboardScenarioSimulationQuestRecord,
  objectiveIds: readonly string[],
  status: GameboardQuestObjectiveProgress['status']
): void {
  const progressById = new Map(quest.progress.map((progress) => [progress.objectiveId, progress]));
  for (const objectiveId of objectiveIds) {
    const actual = progressById.get(objectiveId)?.status;
    if (actual !== status) {
      failures.push({
        path: `expectations.quests.${quest.questId}.objectives.${objectiveId}`,
        message: `Quest objective ${objectiveId} did not have status ${status}`,
        expected: status,
        actual,
      });
    }
  }
}

function pushFieldFailure(
  failures: GameboardScenarioSimulationExpectationFailure[],
  path: string,
  expected: unknown,
  actual: unknown
): void {
  if (expected !== undefined && expected !== actual) {
    failures.push({
      path,
      message: 'Field did not match expectation',
      expected,
      actual,
    });
  }
}

function pushArrayFieldFailure(
  failures: GameboardScenarioSimulationExpectationFailure[],
  path: string,
  expected: readonly unknown[] | undefined,
  actual: readonly unknown[]
): void {
  if (expected !== undefined && !arrayEquals(actual, expected)) {
    failures.push({
      path,
      message: `${path} did not match`,
      expected: [...expected],
      actual: [...actual],
    });
  }
}

function matchesOptional<T>(expected: T | undefined, actual: T | undefined): boolean {
  return expected === undefined || expected === actual;
}

function matchesOptionalArray<T>(
  expected: readonly T[] | undefined,
  actual: readonly T[]
): boolean {
  return expected === undefined || arrayEquals(actual, expected);
}

function includesAll<T>(actual: readonly T[], expected: readonly T[] | undefined): boolean {
  return expected === undefined || expected.every((value) => actual.includes(value));
}

function arrayEquals<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
