/**
 * Scenario simulation engine: step dispatch, system tick orchestration, and
 * the headless `runGameboardScenarioSimulation*` entry points plus patrol
 * route-to-step helpers.
 *
 * Split out of the original monolithic `./simulation` during PRD D3 (H-3).
 *
 * @module
 */
import {
  findGameboardActor,
  inspectGameboardActorTargets,
  readGameboardActors,
  spawnGameboardActor,
  updateGameboardActor,
  type GameboardActorSnapshot,
  type SpawnGameboardActorOptions,
} from '../actors';
import { GameboardRuntimeError } from '../errors';
import {
  findPlacementEntity,
  PlacementState,
  removeGameboardPlacement,
  spawnGameboardPlacement,
  updateGameboardPlacement,
  type PlacementStateValue,
  type UpdateGameboardPlacementOptions,
} from '../koota';
import {
  createGameboardWorldFromScenario,
  resolveGameboardScenarioActors,
  type GameboardScenario,
  type GameboardScenarioActor,
  type GameboardScenarioRuntime,
} from '../scenario';
import {
  runGameboardActorTargetInteraction,
  runGameboardInteraction,
  runGameboardSystems,
} from '../systems';
import {
  createGameboardInteractionHandlerPreset,
  type CreateGameboardInteractionHandlerPresetOptions,
  type GameboardInteractionHandler,
  type GameboardInteractionHandlerEffect,
} from '../commands';
import type { GameboardMovementPathRequestOptions } from '../movement';
import type {
  GameboardPatrolRoutePlan,
  GameboardPatrolRouteSegment,
  GameboardPatrolRouteSet,
} from '../gameboard';
import {
  actorTargetsRecordFromReport,
  emptyActorTargetsRecord,
  simulationResult,
} from './report';
import type { GameboardScenarioSimulationResult } from './report';
import {
  GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
  type CreateGameboardPatrolSimulationScriptOptions,
  type CreateGameboardPatrolSimulationStepsOptions,
  type GameboardPatrolSimulationActorAssignment,
  type GameboardPatrolSimulationAssignmentPlan,
  type GameboardPatrolSimulationScriptPlan,
  type GameboardPatrolSimulationStepsPlan,
  type GameboardScenarioSimulationActorTargetCommandStep,
  type GameboardScenarioSimulationCommandStep,
  type GameboardScenarioSimulationActorTargetsStep,
  type GameboardScenarioSimulationMutationRecord,
  type GameboardScenarioSimulationRemoveActorStep,
  type GameboardScenarioSimulationRemovePlacementStep,
  type GameboardScenarioSimulationScript,
  type GameboardScenarioSimulationSpawnActorStep,
  type GameboardScenarioSimulationSpawnPlacementStep,
  type GameboardScenarioSimulationStep,
  type GameboardScenarioSimulationStepResult,
  type GameboardScenarioSimulationUpdateActorStep,
  type GameboardScenarioSimulationUpdatePlacementStep,
  type RunGameboardScenarioSimulationOptions,
} from './script';

/**
 * Runs simulation steps against a fresh runtime created from a scenario.
 */
export function runGameboardScenarioSimulation(
  scenario: GameboardScenario,
  steps: readonly GameboardScenarioSimulationStep[],
  options: RunGameboardScenarioSimulationOptions = {}
): GameboardScenarioSimulationResult {
  const runtime = createGameboardWorldFromScenario(scenario, options.recipeOverrides);
  const stepResults = steps.map((step, index) => runSimulationStep(runtime, step, index, options));
  return simulationResult(runtime, stepResults);
}

/**
 * Runs an authored simulation script against a fresh runtime created from a
 * scenario, applying script defaults to individual steps.
 */
export function runGameboardScenarioSimulationScript(
  scenario: GameboardScenario,
  script: GameboardScenarioSimulationScript,
  options: RunGameboardScenarioSimulationOptions = {}
): GameboardScenarioSimulationResult {
  return runGameboardScenarioSimulation(scenario, script.steps, {
    ...options,
    defaultSourceActor: options.defaultSourceActor ?? script.defaultSourceActor,
    defaultCommandSystems: options.defaultCommandSystems ?? script.defaultCommandSystems,
    defaultCommandHandlers: options.defaultCommandHandlers ?? script.defaultCommandHandlers,
    defaultCommandHandlerOptions:
      options.defaultCommandHandlerOptions ?? script.defaultCommandHandlerOptions,
    defaultRunSystems: options.defaultRunSystems ?? script.defaultRunSystems,
  });
}

/**
 * Converts planned patrol routes into executable command steps.
 */
export function createGameboardPatrolSimulationSteps(
  options: CreateGameboardPatrolSimulationStepsOptions
): GameboardPatrolSimulationStepsPlan {
  const requireFoundRoutes = options.requireFoundRoutes ?? true;
  const routesById = indexPatrolRoutes(options.routes);
  const assignments: GameboardPatrolSimulationAssignmentPlan[] = [];
  const steps: GameboardScenarioSimulationCommandStep[] = [];

  for (const assignment of options.assignments) {
    const route = routesById.get(assignment.routeId);
    const assignmentWarnings: string[] = [];
    const assignmentErrors: string[] = [];
    const firstStepIndex = steps.length;
    const roundCount = Math.max(1, Math.floor(assignment.rounds ?? 1));

    if (!assignment.routeId) {
      assignmentErrors.push(
        `Patrol assignment for actor ${assignment.actorId || '<missing>'} requires routeId`
      );
    }
    if (!assignment.actorId) {
      assignmentErrors.push(
        `Patrol assignment for route ${assignment.routeId || '<missing>'} requires actorId`
      );
    }
    if (!route) {
      assignmentErrors.push(
        `Patrol assignment references unknown route ${assignment.routeId || '<missing>'}`
      );
    } else {
      if (requireFoundRoutes && !route.found) {
        assignmentErrors.push(`Patrol route ${route.id} is not complete`);
      }
      if (route.segments.length === 0) {
        assignmentWarnings.push(`Patrol route ${route.id} has no movement segments`);
      }
      for (let round = 0; round < roundCount; round += 1) {
        for (const segment of route.segments) {
          const step = patrolSegmentSimulationStep(
            route,
            assignment,
            segment,
            round,
            requireFoundRoutes,
            assignmentWarnings,
            assignmentErrors
          );
          if (step) {
            steps.push(step);
          }
        }
      }
    }

    assignments.push({
      routeId: assignment.routeId,
      actorId: assignment.actorId,
      roundCount,
      stepCount: steps.length - firstStepIndex,
      warningCount: assignmentWarnings.length,
      errorCount: assignmentErrors.length,
      warnings: assignmentWarnings,
      errors: assignmentErrors,
    });
  }

  return {
    stepCount: steps.length,
    assignments,
    steps,
    warnings: assignments.flatMap((assignment) =>
      assignment.warnings.map(
        (warning) => `${assignment.actorId}:${assignment.routeId}: ${warning}`
      )
    ),
    errors: assignments.flatMap((assignment) =>
      assignment.errors.map((error) => `${assignment.actorId}:${assignment.routeId}: ${error}`)
    ),
  };
}

/**
 * Converts patrol routes into a complete simulation script.
 */
export function createGameboardPatrolSimulationScript(
  options: CreateGameboardPatrolSimulationScriptOptions
): GameboardPatrolSimulationScriptPlan {
  const plan = createGameboardPatrolSimulationSteps(options);
  return {
    ...plan,
    script: {
      schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
      defaultSourceActor: options.defaultSourceActor,
      defaultCommandSystems: options.defaultCommandSystems,
      defaultCommandHandlers: options.defaultCommandHandlers,
      defaultCommandHandlerOptions: options.defaultCommandHandlerOptions,
      defaultRunSystems: options.defaultRunSystems,
      steps: plan.steps,
      expectations: options.expectations,
    },
  };
}

function indexPatrolRoutes(
  routes: GameboardPatrolRouteSet | readonly GameboardPatrolRoutePlan[]
): Map<string, GameboardPatrolRoutePlan> {
  const routeList: readonly GameboardPatrolRoutePlan[] =
    'routes' in routes ? routes.routes : routes;
  return new Map(routeList.map((route) => [route.id, route]));
}

function patrolSegmentSimulationStep(
  route: GameboardPatrolRoutePlan,
  assignment: GameboardPatrolSimulationActorAssignment,
  segment: GameboardPatrolRouteSegment,
  round: number,
  requireFoundRoute: boolean,
  warnings: string[],
  errors: string[]
): GameboardScenarioSimulationCommandStep | undefined {
  const segmentLabel = `${segment.fromIndex}-${segment.toIndex}`;
  if (!segment.toKey) {
    const message = `Patrol route ${route.id} segment ${segmentLabel} has no destination waypoint`;
    if (requireFoundRoute) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
    return undefined;
  }
  if (!segment.found) {
    const message = `Patrol route ${route.id} segment ${segmentLabel} has no passable path`;
    if (requireFoundRoute) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
    return undefined;
  }

  const command = assignment.command ?? {};
  const commandMovement = command.movement ?? {};
  const movement: GameboardMovementPathRequestOptions = {
    ...commandMovement,
    ...(assignment.movement ?? {}),
    movementBudget:
      assignment.movement?.movementBudget ??
      commandMovement.movementBudget ??
      Math.max(1, Math.ceil(segment.cost)),
    allowOutOfRangePath:
      assignment.movement?.allowOutOfRangePath ?? commandMovement.allowOutOfRangePath ?? true,
  };
  return {
    action: 'command',
    id: `${assignment.stepIdPrefix ?? 'patrol'}:${assignment.actorId}:${route.id}:r${round}:${segmentLabel}`,
    label: assignment.label
      ? `${assignment.label} ${round + 1}.${segment.toIndex}`
      : `Patrol ${route.id} ${assignment.actorId} waypoint ${segment.toIndex}`,
    sourceActor: assignment.actorId,
    target: segment.toKey,
    command: {
      ...command,
      movement,
    },
    systems: assignment.systems ?? {
      movement: { steps: Math.max(1, segment.pathKeys.length) },
      quests: false,
    },
  };
}

/**
 * Exhaustiveness guard for the action discriminator switch.
 *
 * @internal
 */
function assertNever(value: never): never {
  throw new GameboardRuntimeError(`unreachable simulation step action: ${JSON.stringify(value)}`);
}

function runSimulationStep(
  runtime: GameboardScenarioRuntime,
  step: GameboardScenarioSimulationStep,
  index: number,
  options: RunGameboardScenarioSimulationOptions
): GameboardScenarioSimulationStepResult {
  switch (step.action) {
    case 'actor-target-command':
      return runActorTargetCommandStep(runtime, step, index, options);
    case 'command':
      return runCommandStep(runtime, step, index, options);
    case 'inspect-actor-targets':
      return runActorTargetsStep(runtime, step, index, options);
    case 'run-systems':
      return runSystemsStep(runtime, step, index, options);
    case 'remove-actor':
      return runRemoveActorStep(runtime, step, index);
    case 'remove-placement':
      return runRemovePlacementStep(runtime, step, index);
    case 'spawn-actor':
      return runSpawnActorStep(runtime, step, index);
    case 'spawn-placement':
      return runSpawnPlacementStep(runtime, step, index);
    case 'update-actor':
      return runUpdateActorStep(runtime, step, index);
    case 'update-placement':
      return runUpdatePlacementStep(runtime, step, index);
    default:
      return assertNever(step);
  }
}

function runActorTargetCommandStep(
  runtime: GameboardScenarioRuntime,
  step: GameboardScenarioSimulationActorTargetCommandStep,
  index: number,
  options: RunGameboardScenarioSimulationOptions
): GameboardScenarioSimulationStepResult {
  const sourceActor = step.sourceActor ?? options.defaultSourceActor ?? step.command?.sourceActor;
  const systems = step.systems ?? options.defaultCommandSystems ?? false;
  const handlers = simulationCommandHandlersForStep(step, options);
  if (!sourceActor) {
    return {
      index,
      id: step.id,
      label: step.label,
      action: step.action,
      actorTargets: emptyActorTargetsRecord(
        index,
        step,
        'Actor target command requires sourceActor'
      ),
      events: [],
      eventRecords: [],
      mutations: [],
    };
  }

  const interaction = runGameboardActorTargetInteraction(
    runtime.world,
    {
      ...(step.targeting ?? {}),
      sourceActor,
      ...(step.targetActorId !== undefined ? { targetActorId: step.targetActorId } : {}),
      ...(step.requireReachable !== undefined
        ? { requireReachable: step.requireReachable }
        : {}),
    },
    {
      ...(step.command ?? {}),
      sourceActor,
      systems,
      handlers,
    }
  );

  return {
    index,
    id: step.id,
    label: step.label,
    action: step.action,
    dispatch: interaction.dispatch,
    systems: interaction.systems,
    actorTargets: actorTargetsRecordFromReport(interaction.targetCommand.targeting, index, step),
    events: interaction.events,
    eventRecords: interaction.eventRecords,
    mutations: commandHandlerMutations(interaction.dispatch?.execution.effects ?? []),
  };
}

function runCommandStep(
  runtime: GameboardScenarioRuntime,
  step: GameboardScenarioSimulationCommandStep,
  index: number,
  options: RunGameboardScenarioSimulationOptions
): GameboardScenarioSimulationStepResult {
  const sourceActor = step.sourceActor ?? options.defaultSourceActor ?? step.command?.sourceActor;
  const systems = step.systems ?? options.defaultCommandSystems ?? false;
  const handlers = simulationCommandHandlersForStep(step, options);
  const interaction = runGameboardInteraction(runtime.world, step.target, {
    ...(step.command ?? {}),
    sourceActor,
    systems,
    handlers,
  });
  return {
    index,
    id: step.id,
    label: step.label,
    action: step.action,
    dispatch: interaction.dispatch,
    systems: interaction.systems,
    events: interaction.events,
    eventRecords: interaction.eventRecords,
    mutations: commandHandlerMutations(interaction.dispatch.execution.effects ?? []),
  };
}

function simulationCommandHandlersForStep(
  step: GameboardScenarioSimulationActorTargetCommandStep | GameboardScenarioSimulationCommandStep,
  options: RunGameboardScenarioSimulationOptions
): readonly GameboardInteractionHandler[] | undefined {
  const presets = [
    ...(options.defaultCommandHandlers ?? []),
    ...commandHandlerPresetsFromStep(step),
  ];
  if (presets.length === 0) {
    return undefined;
  }
  const presetOptions = mergeCommandHandlerPresetOptions(
    options.defaultCommandHandlerOptions,
    step.handlerOptions
  );
  return presets.flatMap((preset) =>
    createGameboardInteractionHandlerPreset(preset, presetOptions)
  );
}

function commandHandlerPresetsFromStep(
  step: GameboardScenarioSimulationActorTargetCommandStep | GameboardScenarioSimulationCommandStep
): readonly import('./script').GameboardScenarioSimulationCommandHandlerPreset[] {
  return [...(step.handler ? [step.handler] : []), ...(step.handlers ?? [])];
}

function mergeCommandHandlerPresetOptions(
  defaults: CreateGameboardInteractionHandlerPresetOptions | undefined,
  overrides: CreateGameboardInteractionHandlerPresetOptions | undefined
): CreateGameboardInteractionHandlerPresetOptions {
  return {
    removeTargetActor: {
      ...(defaults?.removeTargetActor ?? {}),
      ...(overrides?.removeTargetActor ?? {}),
    },
    removeTargetPlacement: {
      ...(defaults?.removeTargetPlacement ?? {}),
      ...(overrides?.removeTargetPlacement ?? {}),
    },
    markTargetActorInteracted: {
      ...(defaults?.markTargetActorInteracted ?? {}),
      ...(overrides?.markTargetActorInteracted ?? {}),
    },
  };
}

function commandHandlerMutations(
  effects: readonly GameboardInteractionHandlerEffect[]
): GameboardScenarioSimulationMutationRecord[] {
  return effects.map((effect) => {
    switch (effect.type) {
      case 'actor-removed':
        return {
          type: effect.type,
          actorId: effect.actorId,
          placementId: effect.placementId,
          removed: effect.removed,
          ...(effect.reason !== undefined ? { reason: effect.reason } : {}),
        };
      case 'placement-removed':
        return {
          type: effect.type,
          placementId: effect.placementId,
          removed: effect.removed,
          ...(effect.reason !== undefined ? { reason: effect.reason } : {}),
        };
      case 'actor-updated':
        return {
          type: effect.type,
          actorId: effect.actorId,
          placementId: effect.placementId,
          updated: effect.updated,
          ...(effect.reason !== undefined ? { reason: effect.reason } : {}),
        };
      case 'placement-updated':
        return {
          type: effect.type,
          placementId: effect.placementId,
          updated: effect.updated,
          ...(effect.reason !== undefined ? { reason: effect.reason } : {}),
        };
    }
    const exhaustive: never = effect;
    throw new GameboardRuntimeError(`commandHandlerMutations: unhandled effect type: ${JSON.stringify(exhaustive)}`);
  });
}

function runActorTargetsStep(
  runtime: GameboardScenarioRuntime,
  step: GameboardScenarioSimulationActorTargetsStep,
  index: number,
  options: RunGameboardScenarioSimulationOptions
): GameboardScenarioSimulationStepResult {
  const sourceActor = step.sourceActor ?? options.defaultSourceActor;
  const actorTargets = sourceActor
    ? actorTargetsRecordFromReport(
        inspectGameboardActorTargets(runtime.world, {
          ...(step.targeting ?? {}),
          sourceActor,
        }),
        index,
        step
      )
    : emptyActorTargetsRecord(index, step, 'Actor target inspection requires sourceActor');
  return {
    index,
    id: step.id,
    label: step.label,
    action: step.action,
    actorTargets,
    events: [],
    eventRecords: [],
    mutations: [],
  };
}

function runSystemsStep(
  runtime: GameboardScenarioRuntime,
  step: import('./script').GameboardScenarioSimulationRunSystemsStep,
  index: number,
  options: RunGameboardScenarioSimulationOptions
): GameboardScenarioSimulationStepResult {
  const systems = runGameboardSystems(
    runtime.world,
    step.systems ?? options.defaultRunSystems ?? {}
  );
  return {
    index,
    id: step.id,
    label: step.label,
    action: step.action,
    systems,
    events: systems.events,
    eventRecords: systems.eventRecords,
    mutations: [],
  };
}

function runRemoveActorStep(
  runtime: GameboardScenarioRuntime,
  step: GameboardScenarioSimulationRemoveActorStep,
  index: number
): GameboardScenarioSimulationStepResult {
  const actor = findGameboardActor(runtime.world, step.actorId);
  const mutation: GameboardScenarioSimulationMutationRecord = actor
    ? {
        type: 'actor-removed',
        actorId: actor.actor.actorId,
        placementId: actor.placement.id,
        removed: removeGameboardPlacement(runtime.world, actor.entity),
      }
    : {
        type: 'actor-removed',
        actorId: step.actorId,
        removed: false,
        reason: `No actor exists with id ${step.actorId}`,
      };
  const systems =
    step.systems === undefined || step.systems === false
      ? undefined
      : runGameboardSystems(runtime.world, step.systems);
  return {
    index,
    id: step.id,
    label: step.label,
    action: step.action,
    systems,
    events: systems?.events ?? [],
    eventRecords: systems?.eventRecords ?? [],
    mutations: [mutation],
  };
}

function runRemovePlacementStep(
  runtime: GameboardScenarioRuntime,
  step: GameboardScenarioSimulationRemovePlacementStep,
  index: number
): GameboardScenarioSimulationStepResult {
  const mutation: GameboardScenarioSimulationMutationRecord = {
    type: 'placement-removed',
    placementId: step.placementId,
    removed: removeGameboardPlacement(runtime.world, step.placementId),
  };
  if (!mutation.removed) {
    mutation.reason = `No placement exists with id ${step.placementId}`;
  }
  const systems =
    step.systems === undefined || step.systems === false
      ? undefined
      : runGameboardSystems(runtime.world, step.systems);
  return {
    index,
    id: step.id,
    label: step.label,
    action: step.action,
    systems,
    events: systems?.events ?? [],
    eventRecords: systems?.eventRecords ?? [],
    mutations: [mutation],
  };
}

function runSpawnActorStep(
  runtime: GameboardScenarioRuntime,
  step: GameboardScenarioSimulationSpawnActorStep,
  index: number
): GameboardScenarioSimulationStepResult {
  const actor = resolveSimulationSpawnActor(runtime, step.actor);
  const entity = spawnGameboardActor(runtime.world, actor);
  const placement = entity.get(PlacementState);
  const mutation: GameboardScenarioSimulationMutationRecord = {
    type: 'actor-spawned',
    actorId: actor.actorId,
    placementId: placement?.id ?? actor.id,
    spawned: true,
  };
  const systems =
    step.systems === undefined || step.systems === false
      ? undefined
      : runGameboardSystems(runtime.world, step.systems);
  return {
    index,
    id: step.id,
    label: step.label,
    action: step.action,
    systems,
    events: systems?.events ?? [],
    eventRecords: systems?.eventRecords ?? [],
    mutations: [mutation],
  };
}

function resolveSimulationSpawnActor(
  runtime: GameboardScenarioRuntime,
  actor: GameboardScenarioActor
): SpawnGameboardActorOptions {
  if (actor.spawnGroupId === undefined) {
    if (actor.at === undefined) {
      throw new GameboardRuntimeError(
        `Simulation actor ${actor.actorId} has no spawn tile or spawn group`
      );
    }
    return actor as SpawnGameboardActorOptions;
  }
  const existingClaims = readGameboardActors(runtime.world)
    .map(simulationActorSpawnClaim)
    .filter((claim): claim is GameboardScenarioActor => claim !== undefined);
  const resolved = resolveGameboardScenarioActors([...existingClaims, actor], runtime.spawnGroups).at(-1);
  if (resolved === undefined) {
    throw new GameboardRuntimeError(`resolveGameboardScenarioActors returned empty array for actor ${actor.actorId} in group ${actor.spawnGroupId ?? '(none)'}`);
  }
  return resolved as SpawnGameboardActorOptions;
}

function simulationActorSpawnClaim(
  actor: GameboardActorSnapshot
): GameboardScenarioActor | undefined {
  const groupId = actor.actor.metadata.scenarioSpawnGroupId;
  const locationIndex = actor.actor.metadata.scenarioSpawnLocationIndex;
  if (typeof groupId !== 'string' || typeof locationIndex !== 'number') {
    return undefined;
  }
  return {
    actorId: actor.actor.actorId,
    actorKind: actor.actor.kind,
    spawnGroupId: groupId,
    spawnLocationIndex: locationIndex,
    assetId: actor.placement.assetId,
    kind: actor.placement.kind,
  };
}

function runSpawnPlacementStep(
  runtime: GameboardScenarioRuntime,
  step: GameboardScenarioSimulationSpawnPlacementStep,
  index: number
): GameboardScenarioSimulationStepResult {
  const entity = spawnGameboardPlacement(runtime.world, step.placement);
  const placement = entity.get(PlacementState) as PlacementStateValue;
  const mutation: GameboardScenarioSimulationMutationRecord = {
    type: 'placement-spawned',
    placementId: placement.id,
    spawned: true,
  };
  const systems =
    step.systems === undefined || step.systems === false
      ? undefined
      : runGameboardSystems(runtime.world, step.systems);
  return {
    index,
    id: step.id,
    label: step.label,
    action: step.action,
    systems,
    events: systems?.events ?? [],
    eventRecords: systems?.eventRecords ?? [],
    mutations: [mutation],
  };
}

function runUpdateActorStep(
  runtime: GameboardScenarioRuntime,
  step: GameboardScenarioSimulationUpdateActorStep,
  index: number
): GameboardScenarioSimulationStepResult {
  const actor = findGameboardActor(runtime.world, step.actorId);
  const mutation: GameboardScenarioSimulationMutationRecord = actor
    ? updateActorMutation(runtime, actor, step)
    : {
        type: 'actor-updated',
        actorId: step.actorId,
        updated: false,
        reason: `No actor exists with id ${step.actorId}`,
      };
  const systems =
    step.systems === undefined || step.systems === false
      ? undefined
      : runGameboardSystems(runtime.world, step.systems);
  return {
    index,
    id: step.id,
    label: step.label,
    action: step.action,
    systems,
    events: systems?.events ?? [],
    eventRecords: systems?.eventRecords ?? [],
    mutations: [mutation],
  };
}

function updateActorMutation(
  runtime: GameboardScenarioRuntime,
  actor: GameboardActorSnapshot,
  step: GameboardScenarioSimulationUpdateActorStep
): GameboardScenarioSimulationMutationRecord {
  if (step.placement) {
    updateGameboardPlacement(runtime.world, actor.entity, step.placement);
  }
  updateGameboardActor(runtime.world, actor.entity, step.actor);
  const updatedActor =
    findGameboardActor(runtime.world, step.actor.actorId ?? step.actorId) ??
    findGameboardActor(runtime.world, actor.placement.id);
  return {
    type: 'actor-updated',
    actorId: updatedActor?.actor.actorId ?? step.actor.actorId ?? actor.actor.actorId,
    placementId: updatedActor?.placement.id ?? actor.placement.id,
    updated: true,
  };
}

function runUpdatePlacementStep(
  runtime: GameboardScenarioRuntime,
  step: GameboardScenarioSimulationUpdatePlacementStep,
  index: number
): GameboardScenarioSimulationStepResult {
  const entity = findPlacementEntity(runtime.world, step.placementId);
  const mutation: GameboardScenarioSimulationMutationRecord = entity
    ? updatePlacementMutation(runtime, step.placementId, step.placement)
    : {
        type: 'placement-updated',
        placementId: step.placementId,
        updated: false,
        reason: `No placement exists with id ${step.placementId}`,
      };
  const systems =
    step.systems === undefined || step.systems === false
      ? undefined
      : runGameboardSystems(runtime.world, step.systems);
  return {
    index,
    id: step.id,
    label: step.label,
    action: step.action,
    systems,
    events: systems?.events ?? [],
    eventRecords: systems?.eventRecords ?? [],
    mutations: [mutation],
  };
}

function updatePlacementMutation(
  runtime: GameboardScenarioRuntime,
  placementId: string,
  placement: UpdateGameboardPlacementOptions
): GameboardScenarioSimulationMutationRecord {
  const entity = updateGameboardPlacement(runtime.world, placementId, placement);
  const updated = entity.get(PlacementState) as PlacementStateValue;
  return {
    type: 'placement-updated',
    placementId: updated.id,
    updated: true,
  };
}
