/**
 * Headless scenario simulation scripts and deterministic reports for movement,
 * patrols, commands, quest progression, and integration-test evidence.
 *
 * @module
 */
import {
  findGameboardActor,
  inspectGameboardActorTargets,
  readGameboardActors,
  spawnGameboardActor,
  updateGameboardActor,
  type GameboardActorTarget,
  type GameboardActorTargetingOptions,
  type GameboardActorKind,
  type GameboardActorMetadataValue,
  type GameboardActorSnapshot,
  type GameboardInteractionCommandKind,
  type SpawnGameboardActorOptions,
  type UpdateGameboardActorOptions,
} from './actors';
import { hexKey, parseHexKey } from './coordinates';
import type {
  GameboardPlacementLayer,
  GameboardPlacementSpec,
  GameboardPlan,
  GameboardPlacementKind,
} from './gameboard';
import {
  findPlacementEntity,
  PlacementState,
  removeGameboardPlacement,
  spawnGameboardPlacement,
  updateGameboardPlacement,
  type PlacementStateValue,
  type SpawnGameboardPlacementOptions,
  type UpdateGameboardPlacementOptions,
} from './koota';
import { projectWorldToGameboardPlan } from './coordinates';
import {
  readGameboardQuests,
  type GameboardQuestMetadataValue,
  type GameboardQuestObjective,
  type GameboardQuestObjectiveProgress,
  type GameboardQuestSnapshot,
  type GameboardQuestStatus,
} from './quests';
import { createGameboardPlanFromRecipe, type GameboardRecipePlanOptionsOverride } from './recipe';
import type { GameboardRuleViolation } from './rule-types';
import {
  createGameboardWorldFromScenario,
  resolveGameboardScenarioActors,
  type GameboardScenario,
  type GameboardScenarioActor,
  type GameboardScenarioRuntime,
} from './scenario';
import {
  runGameboardActorTargetInteraction,
  runGameboardInteraction,
  runGameboardSystems,
  type DispatchGameboardInteractionCommandResult,
  type GameboardInteractionCommandRecord,
  type GameboardMovementEventRecord,
  type GameboardPatrolEventRecord,
  type GameboardSystemEvent,
  type GameboardSystemEventRecord,
  type RunGameboardInteractionOptions,
  type RunGameboardSystemsOptions,
  type RunGameboardSystemsResult,
} from './systems';
import {
  createGameboardInteractionHandlerPreset,
  isGameboardInteractionHandlerPreset,
  type CreateGameboardInteractionHandlerPresetOptions,
  type GameboardActorTargetCommandOptions,
  type GameboardInteractionCommandInput,
  type GameboardInteractionHandler,
  type GameboardInteractionHandlerEffect,
  type GameboardInteractionHandlerPreset,
} from './commands';
import type { GameboardMovementPathRequestOptions } from './movement';
import type {
  GameboardPatrolRoutePlan,
  GameboardPatrolRouteSegment,
  GameboardPatrolRouteSet,
} from './navigation';

/**
 * Current JSON schema version for scenario simulation scripts and reports.
 */
export const GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION = '1.0.0';

/**
 * Supported simulation step action discriminators.
 */
export const GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS = [
  'actor-target-command',
  'command',
  'inspect-actor-targets',
  'run-systems',
  'remove-actor',
  'remove-placement',
  'spawn-actor',
  'spawn-placement',
  'update-actor',
  'update-placement',
] as const;
const SIMULATION_STEP_ACTIONS = GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS;
const SIMULATION_COMMAND_KIND_VALUES = [
  'move',
  'interact-actor',
  'interact-placement',
  'attack-actor',
  'inspect-actor',
  'inspect-placement',
  'inspect-tile',
  'none',
] as const satisfies readonly GameboardInteractionCommandKind[];
const SIMULATION_MUTATION_TYPES = [
  'actor-removed',
  'placement-removed',
  'actor-spawned',
  'placement-spawned',
  'actor-updated',
  'placement-updated',
] as const;
const SIMULATION_EVENT_TYPES = [
  'command-handled',
  'movement-requested',
  'command-blocked',
  'command-ignored',
  'command-handler-required',
  'patrol-move-requested',
  'patrol-waiting',
  'patrol-completed',
  'patrol-blocked',
  'movement-stepped',
  'movement-completed',
  'movement-blocked',
  'quest-advanced',
  'quest-completed',
  'quest-blocked',
] as const satisfies readonly GameboardSystemEventRecord['type'][];
const SIMULATION_MOVEMENT_EVENT_TYPES = [
  'movement-requested',
  'movement-stepped',
  'movement-completed',
  'movement-blocked',
] as const satisfies readonly GameboardSystemEventRecord['type'][];
const SIMULATION_PATROL_EVENT_TYPES = [
  'patrol-move-requested',
  'patrol-waiting',
  'patrol-completed',
  'patrol-blocked',
] as const satisfies readonly GameboardSystemEventRecord['type'][];
const SIMULATION_ACTOR_TARGET_APPROACH_VALUES = [
  'target-tile',
  'adjacent',
  'nearest',
  'self',
  'none',
] as const;
const SIMULATION_ACTOR_TARGET_SORT_VALUES = ['pathCost', 'distance', 'actorId', 'tileKey'] as const;

/**
 * One executable step in a deterministic scenario simulation script.
 */
export type GameboardScenarioSimulationStep =
  | GameboardScenarioSimulationActorTargetCommandStep
  | GameboardScenarioSimulationCommandStep
  | GameboardScenarioSimulationActorTargetsStep
  | GameboardScenarioSimulationRunSystemsStep
  | GameboardScenarioSimulationRemoveActorStep
  | GameboardScenarioSimulationRemovePlacementStep
  | GameboardScenarioSimulationSpawnActorStep
  | GameboardScenarioSimulationSpawnPlacementStep
  | GameboardScenarioSimulationUpdateActorStep
  | GameboardScenarioSimulationUpdatePlacementStep;

/**
 * Common authored fields shared by all simulation steps.
 */
export interface GameboardScenarioSimulationStepBase {
  /** Optional stable step id used by reports and expectations. */
  id?: string;
  /** Human-readable step label for reports. */
  label?: string;
}

/**
 * Runs an interaction command against a target.
 */
export interface GameboardScenarioSimulationCommandStep
  extends GameboardScenarioSimulationStepBase {
  /** Step discriminator. */
  action: 'command';
  /** Command target or already-planned command. */
  target: GameboardInteractionCommandInput;
  /** Source actor id used when the target must be planned. */
  sourceActor?: string;
  /** Command execution options excluding systems and handlers. */
  command?: Omit<RunGameboardInteractionOptions, 'systems' | 'handlers'>;
  /** Single built-in command handler preset. */
  handler?: GameboardScenarioSimulationCommandHandlerPreset;
  /** Built-in command handler presets. */
  handlers?: readonly GameboardScenarioSimulationCommandHandlerPreset[];
  /** Options for built-in command handler presets. */
  handlerOptions?: CreateGameboardInteractionHandlerPresetOptions;
  /** Systems to run after command dispatch, or false to skip. */
  systems?: RunGameboardSystemsOptions | false;
}

/**
 * Selects an actor target, dispatches its planned command, and optionally runs
 * systems.
 */
export interface GameboardScenarioSimulationActorTargetCommandStep
  extends GameboardScenarioSimulationStepBase {
  /** Step discriminator. */
  action: 'actor-target-command';
  /** Source actor id. */
  sourceActor?: string;
  /** Optional exact target actor id. */
  targetActorId?: string;
  /** Require the selected target to be reachable. */
  requireReachable?: boolean;
  /** Actor-targeting filters and path options. */
  targeting?: Partial<
    Omit<GameboardActorTargetCommandOptions, 'sourceActor' | 'targetActorId' | 'requireReachable'>
  >;
  /** Command execution options excluding systems and handlers. */
  command?: Omit<RunGameboardInteractionOptions, 'systems' | 'handlers'>;
  /** Single built-in command handler preset. */
  handler?: GameboardScenarioSimulationCommandHandlerPreset;
  /** Built-in command handler presets. */
  handlers?: readonly GameboardScenarioSimulationCommandHandlerPreset[];
  /** Options for built-in command handler presets. */
  handlerOptions?: CreateGameboardInteractionHandlerPresetOptions;
  /** Systems to run after command dispatch, or false to skip. */
  systems?: RunGameboardSystemsOptions | false;
}

/**
 * Inspects actor targets without dispatching a command.
 */
export interface GameboardScenarioSimulationActorTargetsStep
  extends GameboardScenarioSimulationStepBase {
  /** Step discriminator. */
  action: 'inspect-actor-targets';
  /** Source actor id. */
  sourceActor?: string;
  /** Actor-targeting filters and path options. */
  targeting?: Partial<Omit<GameboardActorTargetingOptions, 'sourceActor'>>;
}

/**
 * Runs patrol, movement, and quest systems.
 */
export interface GameboardScenarioSimulationRunSystemsStep
  extends GameboardScenarioSimulationStepBase {
  /** Step discriminator. */
  action: 'run-systems';
  /** Systems to run. */
  systems?: RunGameboardSystemsOptions;
}

/**
 * Removes an actor-backed placement.
 */
export interface GameboardScenarioSimulationRemoveActorStep
  extends GameboardScenarioSimulationStepBase {
  /** Step discriminator. */
  action: 'remove-actor';
  /** Actor id to remove. */
  actorId: string;
  /** Systems to run after removal, or false to skip. */
  systems?: RunGameboardSystemsOptions | false;
}

/**
 * Removes a placement by id.
 */
export interface GameboardScenarioSimulationRemovePlacementStep
  extends GameboardScenarioSimulationStepBase {
  /** Step discriminator. */
  action: 'remove-placement';
  /** Placement id to remove. */
  placementId: string;
  /** Systems to run after removal, or false to skip. */
  systems?: RunGameboardSystemsOptions | false;
}

/**
 * Spawns a scenario actor during a simulation.
 */
export interface GameboardScenarioSimulationSpawnActorStep
  extends GameboardScenarioSimulationStepBase {
  /** Step discriminator. */
  action: 'spawn-actor';
  /** Actor declaration to spawn. */
  actor: GameboardScenarioActor;
  /** Systems to run after spawn, or false to skip. */
  systems?: RunGameboardSystemsOptions | false;
}

/**
 * Spawns a raw placement during a simulation.
 */
export interface GameboardScenarioSimulationSpawnPlacementStep
  extends GameboardScenarioSimulationStepBase {
  /** Step discriminator. */
  action: 'spawn-placement';
  /** Placement options to spawn. */
  placement: SpawnGameboardPlacementOptions;
  /** Systems to run after spawn, or false to skip. */
  systems?: RunGameboardSystemsOptions | false;
}

/**
 * Updates an actor and optionally its placement.
 */
export interface GameboardScenarioSimulationUpdateActorStep
  extends GameboardScenarioSimulationStepBase {
  /** Step discriminator. */
  action: 'update-actor';
  /** Actor id to update. */
  actorId: string;
  /** Actor update options. */
  actor: UpdateGameboardActorOptions;
  /** Optional placement update options for the actor placement. */
  placement?: UpdateGameboardPlacementOptions;
  /** Systems to run after update, or false to skip. */
  systems?: RunGameboardSystemsOptions | false;
}

/**
 * Updates a placement by id.
 */
export interface GameboardScenarioSimulationUpdatePlacementStep
  extends GameboardScenarioSimulationStepBase {
  /** Step discriminator. */
  action: 'update-placement';
  /** Placement id to update. */
  placementId: string;
  /** Placement update options. */
  placement: UpdateGameboardPlacementOptions;
  /** Systems to run after update, or false to skip. */
  systems?: RunGameboardSystemsOptions | false;
}

/**
 * Serializable script for deterministic scenario simulation.
 */
export interface GameboardScenarioSimulationScript {
  /** Simulation schema version. */
  schemaVersion: typeof GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION;
  /** Steps to execute in order. */
  steps: readonly GameboardScenarioSimulationStep[];
  /** Default source actor id for command steps. */
  defaultSourceActor?: string;
  /** Default systems after command dispatch, or false to skip. */
  defaultCommandSystems?: RunGameboardSystemsOptions | false;
  /** Default built-in command handler presets. */
  defaultCommandHandlers?: readonly GameboardScenarioSimulationCommandHandlerPreset[];
  /** Default options for built-in command handler presets. */
  defaultCommandHandlerOptions?: CreateGameboardInteractionHandlerPresetOptions;
  /** Default systems for run-systems steps. */
  defaultRunSystems?: RunGameboardSystemsOptions;
  /** Optional expectations evaluated against the report. */
  expectations?: GameboardScenarioSimulationExpectations;
}

/**
 * Built-in command handler preset id accepted by simulation scripts.
 */
export type GameboardScenarioSimulationCommandHandlerPreset = GameboardInteractionHandlerPreset;

/**
 * Expected records in a simulation report.
 */
export interface GameboardScenarioSimulationExpectations {
  /** Exact event type sequence expectation. */
  eventTypes?: readonly GameboardSystemEventRecord['type'][];
  /** Event types that must appear at least once. */
  requiredEventTypes?: readonly GameboardSystemEventRecord['type'][];
  /** Command expectations. */
  commands?: readonly GameboardScenarioSimulationCommandExpectation[];
  /** Actor-target report expectations. */
  actorTargets?: readonly GameboardScenarioSimulationActorTargetsExpectation[];
  /** Patrol event expectations. */
  patrols?: readonly GameboardScenarioSimulationPatrolExpectation[];
  /** Movement event expectations. */
  movements?: readonly GameboardScenarioSimulationMovementExpectation[];
  /** Mutation expectations. */
  mutations?: readonly GameboardScenarioSimulationMutationExpectation[];
  /** Final actor-state expectations. */
  actors?: readonly GameboardScenarioSimulationActorExpectation[];
  /** Final placement-state expectations. */
  placements?: readonly GameboardScenarioSimulationPlacementExpectation[];
  /** Final quest-state expectations. */
  quests?: readonly GameboardScenarioSimulationQuestExpectation[];
}

/**
 * Expected command record in a simulation report.
 */
export interface GameboardScenarioSimulationCommandExpectation {
  /** Step id that should emit the command. */
  stepId?: string;
  /** Step index that should emit the command. */
  stepIndex?: number;
  /** Expected command kind. */
  kind?: GameboardInteractionCommandRecord['kind'];
  /** Expected command intent. */
  intent?: GameboardInteractionCommandRecord['intent'];
  /** Expected command status. */
  status?: GameboardInteractionCommandRecord['status'];
  /** Expected command executability. */
  canExecute?: boolean;
  /** Expected command reason. */
  reason?: string;
  /** Expected command tile key. */
  tileKey?: string;
  /** Expected command placement id. */
  placementId?: string;
  /** Expected command actor id. */
  actorId?: string;
  /** Expected source actor id. */
  sourceActorId?: string;
  /** Expected source placement id. */
  sourcePlacementId?: string;
  /** Expected handler id. */
  handlerId?: string;
  /** Expected handler status. */
  handlerStatus?: GameboardInteractionCommandRecord['handlerStatus'];
  /** Expected command effect types. */
  effectTypes?: readonly GameboardInteractionHandlerEffect['type'][];
  /** Expected target kind. */
  targetKind?: GameboardInteractionCommandRecord['target']['kind'];
  /** Expected target intent. */
  targetIntent?: GameboardInteractionCommandRecord['target']['intent'];
  /** Expected target tile key. */
  targetTileKey?: string;
  /** Expected target placement id. */
  targetPlacementId?: string;
  /** Expected target actor id. */
  targetActorId?: string;
  /** Expected target enterability. */
  targetCanEnter?: boolean;
}

/**
 * Expected actor-targeting record in a simulation report.
 */
export interface GameboardScenarioSimulationActorTargetsExpectation {
  /** Step id that should emit the target report. */
  stepId?: string;
  /** Step index that should emit the target report. */
  stepIndex?: number;
  /** Expected source actor id. */
  sourceActorId?: string;
  /** Exact target actor ids expected in the report. */
  targetActorIds?: readonly string[];
  /** Exact reachable actor ids expected in the report. */
  reachableActorIds?: readonly string[];
  /** Expected nearest target actor id. */
  nearestActorId?: string;
  /** Expected nearest target approach. */
  nearestApproach?: GameboardScenarioSimulationActorTargetRecord['approach'];
  /** Expected nearest target approach tile key. */
  nearestApproachTileKey?: string;
  /** Expected nearest target reachability. */
  nearestReachable?: boolean;
  /** Expected nearest target path-found flag. */
  nearestPathFound?: boolean;
  /** Expected nearest target path cost. */
  nearestPathCost?: number;
  /** Expected nearest target path tile keys. */
  nearestPathKeys?: readonly string[];
  /** Specific target actor id to inspect. */
  targetActorId?: string;
  /** Expected specific target reachability. */
  targetReachable?: boolean;
  /** Expected specific target approach. */
  targetApproach?: GameboardScenarioSimulationActorTargetRecord['approach'];
  /** Expected specific target approach tile key. */
  targetApproachTileKey?: string;
  /** Expected specific target path-found flag. */
  targetPathFound?: boolean;
  /** Expected specific target path cost. */
  targetPathCost?: number;
  /** Expected specific target path tile keys. */
  targetPathKeys?: readonly string[];
  /** Expected specific target command kind. */
  targetCommandKind?: GameboardInteractionCommandRecord['kind'];
  /** Expected specific target command intent. */
  targetCommandIntent?: GameboardInteractionCommandRecord['intent'];
  /** Expected specific target command executability. */
  targetCommandCanExecute?: boolean;
  /** Expected target report reason. */
  reason?: string;
}

/**
 * Expected movement record in a simulation report.
 */
export interface GameboardScenarioSimulationMovementExpectation {
  /** Step id that should emit the movement record. */
  stepId?: string;
  /** Step index that should emit the movement record. */
  stepIndex?: number;
  /** Expected movement event type. */
  eventType?: (typeof SIMULATION_MOVEMENT_EVENT_TYPES)[number];
  /** Expected actor id. */
  actorId?: string;
  /** Expected placement id. */
  placementId?: string;
  /** Expected current tile key. */
  tileKey?: string;
  /** Expected placement asset id. */
  assetId?: string;
  /** Expected movement profile id. */
  profileId?: string;
  /** Expected moved flag. */
  moved?: boolean;
  /** Expected movement status. */
  status?: GameboardMovementEventRecord['state']['status'];
  /** Expected movement destination key. */
  destinationKey?: string;
  /** Expected exact path tile keys. */
  pathKeys?: readonly string[];
  /** Path tile keys that must be included. */
  pathIncludes?: readonly string[];
  /** Expected next path index. */
  nextIndex?: number;
  /** Expected planned path cost. */
  cost?: number;
  /** Expected spent path cost. */
  spentCost?: number;
  /** Expected pathfinder visited count. */
  visited?: number;
  /** Expected movement reason. */
  reason?: string;
}

/**
 * Expected patrol record in a simulation report.
 */
export interface GameboardScenarioSimulationPatrolExpectation {
  /** Step id that should emit the patrol record. */
  stepId?: string;
  /** Step index that should emit the patrol record. */
  stepIndex?: number;
  /** Expected patrol event type. */
  eventType?: (typeof SIMULATION_PATROL_EVENT_TYPES)[number];
  /** Expected actor id. */
  actorId?: string;
  /** Expected placement id. */
  placementId?: string;
  /** Expected patrol route id. */
  routeId?: string;
  /** Expected patrol status. */
  status?: GameboardPatrolEventRecord['status'];
  /** Expected target tile key. */
  targetKey?: string;
  /** Expected current waypoint index. */
  currentWaypointIndex?: number;
  /** Expected target waypoint index. */
  targetWaypointIndex?: number;
  /** Expected completed route rounds. */
  roundsCompleted?: number;
  /** Expected movement-request flag. */
  requested?: boolean;
  /** Expected waypoint-advanced flag. */
  advanced?: boolean;
  /** Expected patrol reason. */
  reason?: string;
}

/**
 * Expected mutation record in a simulation report.
 */
export interface GameboardScenarioSimulationMutationExpectation {
  /** Expected mutation type. */
  type?: GameboardScenarioSimulationMutationRecord['type'];
  /** Expected actor id. */
  actorId?: string;
  /** Expected placement id. */
  placementId?: string;
  /** Expected removed flag. */
  removed?: boolean;
  /** Expected spawned flag. */
  spawned?: boolean;
  /** Expected updated flag. */
  updated?: boolean;
}

/**
 * Expected final actor state in a simulation report.
 */
export interface GameboardScenarioSimulationActorExpectation {
  /** Actor id to inspect. */
  actorId: string;
  /** Whether the actor is expected to exist. */
  exists?: boolean;
  /** Expected actor kind. */
  kind?: GameboardActorKind;
  /** Expected actor faction. */
  faction?: string;
  /** Expected actor team. */
  team?: string;
  /** Expected hostile flag. */
  hostile?: boolean;
  /** Expected movement-blocking flag. */
  blocksMovement?: boolean;
  /** Expected interactive flag. */
  interactive?: boolean;
  /** Actor tags that must be present. */
  tags?: readonly string[];
  /** Actor metadata entries that must match. */
  metadata?: Readonly<Record<string, GameboardActorMetadataValue>>;
  /** Expected actor tile key. */
  tileKey?: string;
  /** Expected actor placement id. */
  placementId?: string;
  /** Expected actor placement asset id. */
  assetId?: string;
}

/**
 * Expected final placement state in a simulation report.
 */
export interface GameboardScenarioSimulationPlacementExpectation {
  /** Placement id to inspect. */
  placementId: string;
  /** Whether the placement is expected to exist. */
  exists?: boolean;
  /** Expected tile key. */
  tileKey?: string;
  /** Expected asset id. */
  assetId?: string;
  /** Expected placement kind. */
  kind?: GameboardPlacementKind;
  /** Expected placement layer. */
  layer?: GameboardPlacementLayer;
  /** Expected local-only asset flag. */
  requiresExtra?: boolean;
  /** Placement metadata entries that must match. */
  metadata?: Readonly<Record<string, GameboardActorMetadataValue>>;
}

/**
 * Expected final quest state in a simulation report.
 */
export interface GameboardScenarioSimulationQuestExpectation {
  /** Quest id to inspect. */
  questId: string;
  /** Expected quest status. */
  status?: GameboardQuestStatus;
  /** Expected active objective id. */
  activeObjectiveId?: string;
  /** Objective ids expected to be completed. */
  completedObjectives?: readonly string[];
  /** Objective ids expected to be blocked. */
  blockedObjectives?: readonly string[];
  /** Objective ids expected to be pending. */
  pendingObjectives?: readonly string[];
}

/**
 * Failed expectation produced while building a simulation report.
 */
export interface GameboardScenarioSimulationExpectationFailure {
  /** JSON-ish expectation path that failed. */
  path: string;
  /** Human-readable failure message. */
  message: string;
  /** Expected value. */
  expected?: unknown;
  /** Actual value. */
  actual?: unknown;
}

/**
 * Options for running a scenario simulation.
 */
export interface RunGameboardScenarioSimulationOptions {
  /** Recipe compile overrides for the scenario board. */
  recipeOverrides?: GameboardRecipePlanOptionsOverride;
  /** Default source actor id for command steps. */
  defaultSourceActor?: string;
  /** Default systems after command dispatch, or false to skip. */
  defaultCommandSystems?: RunGameboardSystemsOptions | false;
  /** Default built-in command handler presets. */
  defaultCommandHandlers?: readonly GameboardScenarioSimulationCommandHandlerPreset[];
  /** Default options for built-in command handler presets. */
  defaultCommandHandlerOptions?: CreateGameboardInteractionHandlerPresetOptions;
  /** Default systems for run-systems steps. */
  defaultRunSystems?: RunGameboardSystemsOptions;
}

/**
 * Assignment for turning one patrol route into simulation command steps.
 */
export interface GameboardPatrolSimulationActorAssignment {
  /** Patrol route id to execute. */
  routeId: string;
  /** Actor id that should follow the route. */
  actorId: string;
  /** Number of route rounds to emit. */
  rounds?: number;
  /** Prefix for generated step ids. */
  stepIdPrefix?: string;
  /** Base label for generated steps. */
  label?: string;
  /** Command options for generated movement commands. */
  command?: Omit<RunGameboardInteractionOptions, 'systems' | 'sourceActor'>;
  /** Movement path options for generated movement commands. */
  movement?: GameboardMovementPathRequestOptions;
  /** Systems to run after generated movement commands, or false to skip. */
  systems?: RunGameboardSystemsOptions | false;
}

/**
 * Options for generating simulation command steps from patrol routes.
 */
export interface CreateGameboardPatrolSimulationStepsOptions {
  /** Patrol route set or route plans. */
  routes: GameboardPatrolRouteSet | readonly GameboardPatrolRoutePlan[];
  /** Actor-to-route assignments. */
  assignments: readonly GameboardPatrolSimulationActorAssignment[];
  /** Whether missing routes should be treated as errors. Defaults to true. */
  requireFoundRoutes?: boolean;
}

/**
 * Report for one patrol simulation assignment.
 */
export interface GameboardPatrolSimulationAssignmentPlan {
  /** Patrol route id. */
  routeId: string;
  /** Actor id. */
  actorId: string;
  /** Number of route rounds emitted. */
  roundCount: number;
  /** Number of command steps emitted. */
  stepCount: number;
  /** Warning count. */
  warningCount: number;
  /** Error count. */
  errorCount: number;
  /** Assignment warnings. */
  warnings: readonly string[];
  /** Assignment errors. */
  errors: readonly string[];
}

/**
 * Generated simulation command steps plus assignment diagnostics.
 */
export interface GameboardPatrolSimulationStepsPlan {
  /** Total generated step count. */
  stepCount: number;
  /** Assignment diagnostics. */
  assignments: readonly GameboardPatrolSimulationAssignmentPlan[];
  /** Generated command steps. */
  steps: readonly GameboardScenarioSimulationCommandStep[];
  /** Plan-level warnings. */
  warnings: readonly string[];
  /** Plan-level errors. */
  errors: readonly string[];
}

/**
 * Options for generating a complete simulation script from patrol routes.
 */
export interface CreateGameboardPatrolSimulationScriptOptions
  extends CreateGameboardPatrolSimulationStepsOptions {
  /** Default source actor id for generated command steps. */
  defaultSourceActor?: string;
  /** Default command systems for generated script. */
  defaultCommandSystems?: RunGameboardSystemsOptions | false;
  /** Default command handler presets for generated script. */
  defaultCommandHandlers?: readonly GameboardScenarioSimulationCommandHandlerPreset[];
  /** Default handler options for generated script. */
  defaultCommandHandlerOptions?: CreateGameboardInteractionHandlerPresetOptions;
  /** Default systems for generated run-systems steps. */
  defaultRunSystems?: RunGameboardSystemsOptions;
  /** Expectations to embed in the generated script. */
  expectations?: GameboardScenarioSimulationExpectations;
}

/**
 * Generated simulation script plus assignment diagnostics.
 */
export interface GameboardPatrolSimulationScriptPlan extends GameboardPatrolSimulationStepsPlan {
  /** Generated simulation script. */
  script: GameboardScenarioSimulationScript;
}

/**
 * Validation context for an authored simulation script.
 */
export interface GameboardScenarioSimulationScriptValidationConfig {
  /** Scenario used to resolve actors, quests, and plan references. */
  scenario?: GameboardScenario;
  /** Precompiled plan used when a scenario is not available. */
  plan?: GameboardPlan;
}

/**
 * Result of validating a simulation script.
 */
export interface GameboardScenarioSimulationScriptValidationResult {
  /** Script that was validated. */
  script: GameboardScenarioSimulationScript;
  /** Plan compiled from validation context, when available. */
  plan?: GameboardPlan;
  /** Validation violations. */
  violations: readonly GameboardRuleViolation[];
}

/**
 * Runtime result for one executed simulation step.
 */
export interface GameboardScenarioSimulationStepResult {
  /** Step index. */
  index: number;
  /** Authored step id. */
  id?: string;
  /** Authored step label. */
  label?: string;
  /** Step action discriminator. */
  action: GameboardScenarioSimulationStep['action'];
  /** Command dispatch result for command steps. */
  dispatch?: DispatchGameboardInteractionCommandResult;
  /** Actor-target report for target-inspection steps. */
  actorTargets?: GameboardScenarioSimulationActorTargetsRecord;
  /** System tick result for run-systems or post-command systems. */
  systems?: RunGameboardSystemsResult;
  /** In-memory events emitted by the step. */
  events: readonly GameboardSystemEvent[];
  /** Serializable event records emitted by the step. */
  eventRecords: readonly GameboardSystemEventRecord[];
  /** Mutations directly performed by this step. */
  mutations: readonly GameboardScenarioSimulationMutationRecord[];
}

/**
 * Serializable mutation record emitted by direct mutation simulation steps.
 */
export interface GameboardScenarioSimulationMutationRecord {
  /** Mutation type. */
  type:
    | 'actor-removed'
    | 'placement-removed'
    | 'actor-spawned'
    | 'placement-spawned'
    | 'actor-updated'
    | 'placement-updated';
  /** Actor id involved in the mutation. */
  actorId?: string;
  /** Placement id involved in the mutation. */
  placementId?: string;
  /** Whether an entity was removed. */
  removed?: boolean;
  /** Whether an entity was spawned. */
  spawned?: boolean;
  /** Whether an entity was updated. */
  updated?: boolean;
  /** Optional failure or diagnostic reason. */
  reason?: string;
}

/**
 * In-memory result of running a scenario simulation.
 */
export interface GameboardScenarioSimulationResult {
  /** Runtime created from the scenario. */
  runtime: GameboardScenarioRuntime;
  /** Per-step execution results. */
  steps: readonly GameboardScenarioSimulationStepResult[];
  /** All in-memory events emitted during the run. */
  events: readonly GameboardSystemEvent[];
  /** All serializable event records emitted during the run. */
  eventRecords: readonly GameboardSystemEventRecord[];
  /** All direct mutation records emitted during the run. */
  mutations: readonly GameboardScenarioSimulationMutationRecord[];
  /** Final projected plan. */
  finalPlan: GameboardPlan;
  /** Final actor snapshots. */
  actors: readonly GameboardActorSnapshot[];
  /** Final quest snapshots. */
  quests: readonly GameboardQuestSnapshot[];
}

/**
 * Serializable report derived from a simulation result.
 */
export interface GameboardScenarioSimulationReport {
  /** Simulation schema version. */
  schemaVersion: typeof GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION;
  /** Scenario id. */
  scenarioId: string;
  /** Scenario title. */
  scenarioTitle?: string;
  /** Whether all expectations passed. */
  success: boolean;
  /** Per-step report records. */
  steps: readonly GameboardScenarioSimulationStepReport[];
  /** Flattened command records. */
  commands: readonly GameboardScenarioSimulationCommandRecord[];
  /** Flattened actor-target records. */
  actorTargets: readonly GameboardScenarioSimulationActorTargetsRecord[];
  /** Flattened patrol records. */
  patrols: readonly GameboardScenarioSimulationPatrolRecord[];
  /** Flattened movement records. */
  movements: readonly GameboardScenarioSimulationMovementRecord[];
  /** Flattened system event records. */
  eventRecords: readonly GameboardSystemEventRecord[];
  /** Direct mutation records. */
  mutations: readonly GameboardScenarioSimulationMutationRecord[];
  /** Final projected plan. */
  finalPlan: GameboardPlan;
  /** Final placement records. */
  placements: readonly GameboardScenarioSimulationPlacementRecord[];
  /** Final actor records. */
  actors: readonly GameboardScenarioSimulationActorRecord[];
  /** Final quest records. */
  quests: readonly GameboardScenarioSimulationQuestRecord[];
  /** Expectations evaluated for the report. */
  expectations?: GameboardScenarioSimulationExpectations;
  /** Expectation failures. */
  expectationFailures: readonly GameboardScenarioSimulationExpectationFailure[];
}

/**
 * Serializable report for one simulation step.
 */
export interface GameboardScenarioSimulationStepReport {
  /** Step index. */
  index: number;
  /** Authored step id. */
  id?: string;
  /** Authored step label. */
  label?: string;
  /** Step action discriminator. */
  action: GameboardScenarioSimulationStep['action'];
  /** Command record emitted by the step. */
  command?: GameboardInteractionCommandRecord;
  /** Actor-target record emitted by the step. */
  actorTargets?: GameboardScenarioSimulationActorTargetsRecord;
  /** System event records emitted by the step. */
  eventRecords: readonly GameboardSystemEventRecord[];
  /** Direct mutation records emitted by the step. */
  mutations: readonly GameboardScenarioSimulationMutationRecord[];
}

/**
 * Flattened command record with step provenance.
 */
export interface GameboardScenarioSimulationCommandRecord {
  /** Step index that emitted the command. */
  stepIndex: number;
  /** Authored step id. */
  stepId?: string;
  /** Authored step label. */
  stepLabel?: string;
  /** Event type that carried the command. */
  eventType: GameboardSystemEventRecord['type'];
  /** Serializable command execution record. */
  command: GameboardInteractionCommandRecord;
}

/**
 * Serializable actor-targeting report with step provenance.
 */
export interface GameboardScenarioSimulationActorTargetsRecord {
  /** Step index that emitted the actor-target report. */
  stepIndex: number;
  /** Authored step id. */
  stepId?: string;
  /** Authored step label. */
  stepLabel?: string;
  /** Source actor id. */
  sourceActorId?: string;
  /** Source placement id. */
  sourcePlacementId?: string;
  /** Source tile key. */
  sourceTileKey?: string;
  /** All target actor ids in sorted order. */
  targetActorIds: readonly string[];
  /** Reachable target actor ids in sorted order. */
  reachableActorIds: readonly string[];
  /** Nearest or chosen target summary. */
  nearestTarget?: GameboardScenarioSimulationActorTargetRecord;
  /** Full target summaries. */
  targets: readonly GameboardScenarioSimulationActorTargetRecord[];
  /** Optional targeting failure reason. */
  reason?: string;
}

/**
 * Serializable actor target summary.
 */
export interface GameboardScenarioSimulationActorTargetRecord {
  /** Actor id. */
  actorId: string;
  /** Placement id for the actor. */
  placementId: string;
  /** Actor tile key. */
  tileKey: string;
  /** Actor kind. */
  kind: GameboardActorKind;
  /** Actor faction. */
  faction?: string;
  /** Actor team. */
  team?: string;
  /** Whether the actor is generally hostile. */
  hostile: boolean;
  /** Whether the actor is hostile to the source actor. */
  hostileToSource?: boolean;
  /** Whether the actor is interactive. */
  interactive: boolean;
  /** Approach policy selected for the target. */
  approach: GameboardActorTarget['approach'];
  /** Approach tile key when one was selected. */
  approachTileKey?: string;
  /** Whether a usable approach path was found. */
  reachable: boolean;
  /** Optional unreachable or command reason. */
  reason?: string;
  /** Whether a path was found. */
  pathFound: boolean;
  /** Path cost. */
  pathCost: number;
  /** Path tile keys. */
  pathKeys: readonly string[];
  /** Planned command kind. */
  commandKind: GameboardInteractionCommandRecord['kind'];
  /** Planned command intent. */
  commandIntent: GameboardInteractionCommandRecord['intent'];
  /** Whether the planned command can execute. */
  commandCanExecute: boolean;
  /** Planned command failure reason. */
  commandReason?: string;
  /** Planned command tile key. */
  commandTileKey?: string;
  /** Planned command placement id. */
  commandPlacementId?: string;
  /** Planned command actor id. */
  commandActorId?: string;
}

/**
 * Flattened patrol event record with step provenance.
 */
export interface GameboardScenarioSimulationPatrolRecord {
  /** Step index that emitted the patrol event. */
  stepIndex: number;
  /** Authored step id. */
  stepId?: string;
  /** Authored step label. */
  stepLabel?: string;
  /** Patrol event type. */
  eventType: (typeof SIMULATION_PATROL_EVENT_TYPES)[number];
  /** Serializable patrol event record. */
  patrol: GameboardPatrolEventRecord;
}

/**
 * Flattened movement event record with step provenance.
 */
export interface GameboardScenarioSimulationMovementRecord {
  /** Step index that emitted the movement event. */
  stepIndex: number;
  /** Authored step id. */
  stepId?: string;
  /** Authored step label. */
  stepLabel?: string;
  /** Movement event type. */
  eventType: (typeof SIMULATION_MOVEMENT_EVENT_TYPES)[number];
  /** Serializable movement event record. */
  movement: GameboardMovementEventRecord;
}

/**
 * Final actor record in a simulation report.
 */
export interface GameboardScenarioSimulationActorRecord {
  /** Actor id. */
  actorId: string;
  /** Actor kind. */
  kind: GameboardActorKind;
  /** Actor faction. */
  faction?: string;
  /** Actor team. */
  team?: string;
  /** Whether the actor is generally hostile. */
  hostile: boolean;
  /** Whether the actor blocks movement. */
  blocksMovement: boolean;
  /** Whether the actor can be interacted with. */
  interactive: boolean;
  /** Actor tags. */
  tags: readonly string[];
  /** Serializable actor metadata. */
  metadata: Readonly<Record<string, GameboardActorMetadataValue>>;
  /** Final placement record for the actor. */
  placement: GameboardScenarioSimulationPlacementRecord;
}

/**
 * Final placement record in a simulation report.
 */
export interface GameboardScenarioSimulationPlacementRecord {
  /** Placement id. */
  placementId: string;
  /** Origin tile key. */
  tileKey: string;
  /** Asset id. */
  assetId: string;
  /** Placement kind. */
  kind: GameboardPlacementKind;
  /** Placement layer. */
  layer: GameboardPlacementLayer;
  /** Whether the placement depends on local EXTRA or external assets. */
  requiresExtra: boolean;
  /** Serializable placement metadata. */
  metadata: Readonly<Record<string, GameboardActorMetadataValue>>;
}

/**
 * Final quest record in a simulation report.
 */
export interface GameboardScenarioSimulationQuestRecord {
  /** Quest id. */
  questId: string;
  /** Quest title. */
  title: string;
  /** Quest status. */
  status: GameboardQuestStatus;
  /** Active objective index. */
  activeObjectiveIndex: number;
  /** Active objective id. */
  activeObjectiveId?: string;
  /** Quest objectives. */
  objectives: readonly GameboardQuestObjective[];
  /** Objective progress snapshots. */
  progress: readonly GameboardQuestObjectiveProgress[];
  /** Serializable quest metadata. */
  metadata: Readonly<Record<string, GameboardQuestMetadataValue>>;
}

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
 * Validates a simulation script against optional scenario or compiled plan
 * context without executing it.
 */
export function inspectGameboardScenarioSimulationScript(
  script: GameboardScenarioSimulationScript,
  config: GameboardScenarioSimulationScriptValidationConfig = {}
): GameboardScenarioSimulationScriptValidationResult {
  const violations: GameboardRuleViolation[] = [];
  const scenarioIndex = createSimulationScenarioIndex(config, violations);
  const rawScript = script as unknown;

  if (!isRecord(rawScript)) {
    violations.push({
      code: 'simulation.script',
      severity: 'error',
      message: 'Simulation script must be an object with schemaVersion and steps',
    });
    return { script, plan: scenarioIndex.plan, violations };
  }

  if (script.schemaVersion !== GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION) {
    violations.push({
      code: 'simulation.schema_version',
      severity: 'error',
      message: `Simulation script uses schema ${String(
        script.schemaVersion
      )}; expected ${GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION}`,
    });
  }

  validateSourceActorReference(
    violations,
    scenarioIndex,
    'simulation.defaultSourceActor',
    script.defaultSourceActor
  );
  validateCommandHandlerPresetList(
    violations,
    'simulation.defaultCommandHandlers',
    script.defaultCommandHandlers
  );
  validateCommandHandlerPresetOptions(
    violations,
    'simulation.defaultCommandHandlerOptions',
    script.defaultCommandHandlerOptions
  );

  if (!Array.isArray(script.steps)) {
    violations.push({
      code: 'simulation.steps',
      severity: 'error',
      message: 'Simulation script steps must be an array',
    });
  } else {
    validateSimulationSteps(violations, scenarioIndex, script.steps);
  }

  validateSimulationExpectations(violations, scenarioIndex, script.expectations);

  return { script, plan: scenarioIndex.plan, violations };
}

/**
 * Returns validation violations for a simulation script.
 */
export function validateGameboardScenarioSimulationScript(
  script: GameboardScenarioSimulationScript,
  config: GameboardScenarioSimulationScriptValidationConfig = {}
): GameboardRuleViolation[] {
  return [...inspectGameboardScenarioSimulationScript(script, config).violations];
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

/**
 * Creates a serializable report from an in-memory simulation result.
 */
export function createGameboardScenarioSimulationReport(
  result: GameboardScenarioSimulationResult,
  expectations?: GameboardScenarioSimulationExpectations
): GameboardScenarioSimulationReport {
  const steps = result.steps.map((step) => ({
    index: step.index,
    id: step.id,
    label: step.label,
    action: step.action,
    command: commandRecordFromStepResult(step),
    actorTargets: step.actorTargets ? copyJson(step.actorTargets) : undefined,
    eventRecords: step.eventRecords.map(copySystemEventRecord),
    mutations: step.mutations.map((mutation) => ({ ...mutation })),
  }));
  const report: GameboardScenarioSimulationReport = {
    schemaVersion: GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION,
    scenarioId: result.runtime.scenario.id,
    scenarioTitle: result.runtime.scenario.title,
    success: true,
    steps,
    commands: commandRecordsFromStepReports(steps),
    actorTargets: actorTargetRecordsFromStepReports(steps),
    patrols: patrolRecordsFromStepReports(steps),
    movements: movementRecordsFromStepReports(steps),
    eventRecords: result.eventRecords.map(copySystemEventRecord),
    mutations: result.mutations.map((mutation) => ({ ...mutation })),
    finalPlan: copyJson(result.finalPlan),
    placements: result.finalPlan.placements.map(placementRecord),
    actors: result.actors.map(actorRecord),
    quests: result.quests.map(questRecord),
    expectations: expectations ? copyJson(expectations) : undefined,
    expectationFailures: [],
  };
  const expectationFailures = evaluateGameboardScenarioSimulationExpectations(report, expectations);
  return {
    ...report,
    success: expectationFailures.length === 0,
    expectationFailures,
  };
}

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
    throw new Error(failures.map((failure) => `${failure.path}: ${failure.message}`).join('\n'));
  }
}

interface SimulationScenarioIndex {
  plan?: GameboardPlan;
  hasScenario: boolean;
  stepIds: Set<string>;
  actorIds: Set<string>;
  actorOrPlacementIds: Set<string>;
  placementIds: Set<string>;
  spawnGroupIds: Set<string>;
  tileKeys: Set<string>;
  questIds: Set<string>;
  objectiveIdsByQuest: ReadonlyMap<string, ReadonlySet<string>>;
}

function createSimulationScenarioIndex(
  config: GameboardScenarioSimulationScriptValidationConfig,
  violations: GameboardRuleViolation[]
): SimulationScenarioIndex {
  let plan = config.plan;
  if (!plan && config.scenario) {
    try {
      plan = createGameboardPlanFromRecipe(config.scenario.board);
    } catch (error) {
      violations.push({
        code: 'simulation.scenario_board_compile_failed',
        severity: 'error',
        message: `Scenario board failed to compile while validating simulation script: ${errorMessage(error)}`,
      });
    }
  }

  const actorIds = new Set<string>();
  const actorOrPlacementIds = new Set<string>();
  const placementIds = new Set<string>(plan?.placements.map((placement) => placement.id) ?? []);
  const spawnGroupIds = new Set<string>(
    config.scenario?.spawnGroups?.groups.map((group) => group.id).filter(isNonEmptyString) ?? []
  );
  const questIds = new Set<string>();
  const objectiveIdsByQuest = new Map<string, Set<string>>();

  for (const actor of config.scenario?.actors ?? []) {
    if (isNonEmptyString(actor.actorId)) {
      actorIds.add(actor.actorId);
      actorOrPlacementIds.add(actor.actorId);
    }
    if (isNonEmptyString(actor.id)) {
      actorOrPlacementIds.add(actor.id);
      placementIds.add(actor.id);
    }
  }

  for (const quest of config.scenario?.quests ?? []) {
    if (!isNonEmptyString(quest.id)) {
      continue;
    }
    questIds.add(quest.id);
    objectiveIdsByQuest.set(
      quest.id,
      new Set((quest.objectives ?? []).map((objective) => objective.id).filter(isNonEmptyString))
    );
  }

  return {
    plan,
    hasScenario: config.scenario !== undefined,
    stepIds: new Set<string>(),
    actorIds,
    actorOrPlacementIds,
    placementIds,
    spawnGroupIds,
    tileKeys: new Set(plan?.tiles.map((tile) => tile.key) ?? []),
    questIds,
    objectiveIdsByQuest,
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

function validateSimulationSteps(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  steps: readonly unknown[]
): void {
  const stepIds = new Set<string>();
  if (steps.length === 0) {
    violations.push({
      code: 'simulation.steps_empty',
      severity: 'warning',
      message: 'Simulation script has no steps',
    });
  }

  steps.forEach((step, index) => {
    const path = `simulation.steps.${index}`;
    if (!isRecord(step)) {
      violations.push({
        code: 'simulation.step',
        severity: 'error',
        message: `Simulation step ${index} must be an object`,
      });
      return;
    }

    if (step.id !== undefined) {
      if (!isNonEmptyString(step.id)) {
        violations.push({
          code: 'simulation.step_id',
          severity: 'error',
          message: `Simulation step ${index} id must be a non-empty string`,
        });
      } else if (stepIds.has(step.id)) {
        violations.push({
          code: 'simulation.step_duplicate',
          severity: 'error',
          message: `Simulation step id ${step.id} is declared more than once`,
        });
      } else {
        stepIds.add(step.id);
        scenarioIndex.stepIds.add(step.id);
      }
    }

    if (!isSimulationStepAction(step.action)) {
      violations.push({
        code: 'simulation.step_action',
        severity: 'error',
        message: `Simulation step ${index} has unsupported action ${String(step.action)}`,
      });
      return;
    }

    switch (step.action) {
      case 'actor-target-command':
        validateSimulationActorTargetCommandStep(violations, scenarioIndex, path, step);
        break;
      case 'command':
        validateSimulationCommandStep(violations, scenarioIndex, path, step);
        break;
      case 'inspect-actor-targets':
        validateSimulationActorTargetsStep(violations, scenarioIndex, path, step);
        break;
      case 'remove-actor':
        validateActorLikeReference(
          violations,
          scenarioIndex,
          `${path}.actorId`,
          step.actorId,
          'simulation.remove_actor_missing'
        );
        break;
      case 'remove-placement':
        validatePlacementReference(
          violations,
          scenarioIndex,
          `${path}.placementId`,
          step.placementId
        );
        break;
      case 'spawn-actor':
        validateSimulationSpawnActorStep(violations, scenarioIndex, path, step);
        break;
      case 'spawn-placement':
        validateSimulationSpawnPlacementStep(violations, scenarioIndex, path, step);
        break;
      case 'update-actor':
        validateSimulationUpdateActorStep(violations, scenarioIndex, path, step);
        break;
      case 'update-placement':
        validateSimulationUpdatePlacementStep(violations, scenarioIndex, path, step);
        break;
      case 'run-systems':
        break;
    }
  });
}

function validateSimulationCommandStep(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  step: Readonly<Record<string, unknown>>
): void {
  validateSourceActorReference(violations, scenarioIndex, `${path}.sourceActor`, step.sourceActor);
  const command = isRecord(step.command) ? step.command : undefined;
  validateSourceActorReference(
    violations,
    scenarioIndex,
    `${path}.command.sourceActor`,
    command?.sourceActor
  );
  validateCommandHandlerPreset(violations, `${path}.handler`, step.handler);
  validateCommandHandlerPresetList(violations, `${path}.handlers`, step.handlers);
  validateCommandHandlerPresetOptions(violations, `${path}.handlerOptions`, step.handlerOptions);

  if (!('target' in step) || step.target === undefined || step.target === null) {
    violations.push({
      code: 'simulation.command_target',
      severity: 'error',
      message: `${path} must include a command target`,
    });
    return;
  }
  validateInteractionTargetReference(violations, scenarioIndex, `${path}.target`, step.target);
}

function validateSimulationActorTargetCommandStep(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  step: Readonly<Record<string, unknown>>
): void {
  validateSourceActorReference(violations, scenarioIndex, `${path}.sourceActor`, step.sourceActor);
  const command = isRecord(step.command) ? step.command : undefined;
  validateSourceActorReference(
    violations,
    scenarioIndex,
    `${path}.command.sourceActor`,
    command?.sourceActor
  );
  validateActorLikeReference(
    violations,
    scenarioIndex,
    `${path}.targetActorId`,
    step.targetActorId,
    'simulation.actor_target_command_target_missing'
  );
  validateBooleanField(
    violations,
    `${path}.requireReachable`,
    step.requireReachable,
    'simulation.actor_target_command_require_reachable'
  );
  validateCommandHandlerPreset(violations, `${path}.handler`, step.handler);
  validateCommandHandlerPresetList(violations, `${path}.handlers`, step.handlers);
  validateCommandHandlerPresetOptions(violations, `${path}.handlerOptions`, step.handlerOptions);
  validateSimulationActorTargetsOptions(
    violations,
    scenarioIndex,
    `${path}.targeting`,
    step.targeting
  );
}

function validateSimulationActorTargetsStep(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  step: Readonly<Record<string, unknown>>
): void {
  validateSourceActorReference(violations, scenarioIndex, `${path}.sourceActor`, step.sourceActor);
  validateSimulationActorTargetsOptions(
    violations,
    scenarioIndex,
    `${path}.targeting`,
    step.targeting
  );
}

function validateSimulationActorTargetsOptions(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  targeting: unknown
): void {
  if (targeting === undefined) {
    return;
  }
  if (!isRecord(targeting)) {
    violations.push({
      code: 'simulation.actor_targets_targeting',
      severity: 'error',
      message: `${path} must be an actor targeting options object`,
    });
    return;
  }

  validateActorLikeReferenceList(
    violations,
    scenarioIndex,
    `${path}.actorIds`,
    targeting.actorIds
  );
  validatePlacementReferenceList(
    violations,
    scenarioIndex,
    `${path}.placementIds`,
    targeting.placementIds
  );
  validateTileReferenceSelection(
    violations,
    scenarioIndex,
    `${path}.tileKeys`,
    targeting.tileKeys
  );
  validateActorTargetCenterReference(
    violations,
    scenarioIndex,
    `${path}.center`,
    targeting.center
  );
  validateStringOrStringArrayField(
    violations,
    `${path}.kinds`,
    targeting.kinds,
    'simulation.actor_targets_kinds'
  );
  validateStringOrStringArrayField(
    violations,
    `${path}.teams`,
    targeting.teams,
    'simulation.actor_targets_teams'
  );
  validateStringOrStringArrayField(
    violations,
    `${path}.factions`,
    targeting.factions,
    'simulation.actor_targets_factions'
  );
  validateStringArrayField(
    violations,
    `${path}.tags`,
    targeting.tags,
    'simulation.actor_targets_tags'
  );
  validateStringArrayField(
    violations,
    `${path}.excludeTags`,
    targeting.excludeTags,
    'simulation.actor_targets_exclude_tags'
  );
  validateNumberField(
    violations,
    `${path}.radius`,
    targeting.radius,
    'simulation.actor_targets_radius'
  );
  validateNumberField(
    violations,
    `${path}.maxPathCost`,
    targeting.maxPathCost,
    'simulation.actor_targets_max_path_cost'
  );
  validateBooleanField(
    violations,
    `${path}.includeSource`,
    targeting.includeSource,
    'simulation.actor_targets_include_source'
  );
  validateBooleanField(
    violations,
    `${path}.hostile`,
    targeting.hostile,
    'simulation.actor_targets_hostile'
  );
  validateBooleanField(
    violations,
    `${path}.interactive`,
    targeting.interactive,
    'simulation.actor_targets_interactive'
  );
  validateBooleanField(
    violations,
    `${path}.blocksMovement`,
    targeting.blocksMovement,
    'simulation.actor_targets_blocks_movement'
  );
  validateBooleanField(
    violations,
    `${path}.hostileToSource`,
    targeting.hostileToSource,
    'simulation.actor_targets_hostile_to_source'
  );
  validateBooleanField(
    violations,
    `${path}.includeUnreachable`,
    targeting.includeUnreachable,
    'simulation.actor_targets_include_unreachable'
  );
  validateEnumField(
    violations,
    `${path}.approach`,
    targeting.approach,
    SIMULATION_ACTOR_TARGET_APPROACH_VALUES.slice(0, 3),
    'simulation.actor_targets_approach'
  );
  validateEnumField(
    violations,
    `${path}.sort`,
    targeting.sort,
    SIMULATION_ACTOR_TARGET_SORT_VALUES,
    'simulation.actor_targets_sort'
  );
}

function validateSimulationExpectations(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  expectations: unknown
): void {
  if (expectations === undefined) {
    return;
  }
  if (!isRecord(expectations)) {
    violations.push({
      code: 'simulation.expectations',
      severity: 'error',
      message: 'Simulation expectations must be an object',
    });
    return;
  }

  validateEventTypeArray(violations, 'simulation.expectations.eventTypes', expectations.eventTypes);
  validateEventTypeArray(
    violations,
    'simulation.expectations.requiredEventTypes',
    expectations.requiredEventTypes
  );
  validateCommandExpectations(violations, scenarioIndex, expectations.commands);
  validateActorTargetExpectations(violations, scenarioIndex, expectations.actorTargets);
  validatePatrolExpectations(violations, scenarioIndex, expectations.patrols);
  validateMovementExpectations(violations, scenarioIndex, expectations.movements);
  validateMutationExpectations(violations, scenarioIndex, expectations.mutations);
  validateActorExpectations(violations, scenarioIndex, expectations.actors);
  validatePlacementExpectations(violations, scenarioIndex, expectations.placements);
  validateQuestExpectations(violations, scenarioIndex, expectations.quests);
}

function validateSimulationSpawnActorStep(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  step: Readonly<Record<string, unknown>>
): void {
  if (!isRecord(step.actor)) {
    violations.push({
      code: 'simulation.spawn_actor',
      severity: 'error',
      message: `${path}.actor must be a spawn actor options object`,
    });
    return;
  }
  validateSpawnActorFields(violations, scenarioIndex, `${path}.actor`, step.actor);
  if (!isNonEmptyString(step.actor.actorId)) {
    violations.push({
      code: 'simulation.spawn_actor_id',
      severity: 'error',
      message: `${path}.actor.actorId must be a non-empty string`,
    });
  } else {
    if (scenarioIndex.actorOrPlacementIds.has(step.actor.actorId)) {
      violations.push({
        code: 'simulation.spawn_actor_duplicate',
        severity: 'error',
        message: `${path}.actor.actorId ${step.actor.actorId} already exists`,
        placementId: step.actor.actorId,
      });
    }
    scenarioIndex.actorIds.add(step.actor.actorId);
    scenarioIndex.actorOrPlacementIds.add(step.actor.actorId);
  }
  registerSpawnedPlacementId(violations, scenarioIndex, `${path}.actor.id`, step.actor.id);
}

function validateSpawnActorFields(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  options: Readonly<Record<string, unknown>>
): void {
  validateSpawnAssetAndKind(violations, path, options);
  const hasAt = 'at' in options && options.at !== undefined;
  const hasSpawnGroup = options.spawnGroupId !== undefined;
  if (hasAt && hasSpawnGroup) {
    violations.push({
      code: 'simulation.spawn_actor_location_conflict',
      severity: 'error',
      message: `${path} cannot define both at and spawnGroupId`,
    });
    return;
  }
  if (hasAt) {
    validateTileReference(violations, scenarioIndex, `${path}.at`, options.at);
    return;
  }
  if (!hasSpawnGroup) {
    violations.push({
      code: 'simulation.spawn_actor_location',
      severity: 'error',
      message: `${path} must target a board tile or scenario spawn group`,
    });
    return;
  }
  if (!isNonEmptyString(options.spawnGroupId)) {
    violations.push({
      code: 'simulation.spawn_actor_spawn_group',
      severity: 'error',
      message: `${path}.spawnGroupId must be a non-empty string`,
    });
  } else if (scenarioIndex.hasScenario && !scenarioIndex.spawnGroupIds.has(options.spawnGroupId)) {
    violations.push({
      code: 'simulation.spawn_actor_spawn_group_missing',
      severity: 'error',
      message: `${path}.spawnGroupId references unknown scenario spawn group ${options.spawnGroupId}`,
    });
  }
  const spawnLocationIndex = options.spawnLocationIndex;
  if (
    spawnLocationIndex !== undefined &&
    (typeof spawnLocationIndex !== 'number' ||
      !Number.isInteger(spawnLocationIndex) ||
      spawnLocationIndex < 0)
  ) {
    violations.push({
      code: 'simulation.spawn_actor_spawn_location_index',
      severity: 'error',
      message: `${path}.spawnLocationIndex must be a non-negative integer`,
    });
  }
}

function validateSimulationSpawnPlacementStep(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  step: Readonly<Record<string, unknown>>
): void {
  if (!isRecord(step.placement)) {
    violations.push({
      code: 'simulation.spawn_placement',
      severity: 'error',
      message: `${path}.placement must be a spawn placement options object`,
    });
    return;
  }
  validateSpawnPlacementFields(violations, scenarioIndex, `${path}.placement`, step.placement);
  registerSpawnedPlacementId(violations, scenarioIndex, `${path}.placement.id`, step.placement.id);
}

function validateSimulationUpdateActorStep(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  step: Readonly<Record<string, unknown>>
): void {
  validateActorLikeReference(
    violations,
    scenarioIndex,
    `${path}.actorId`,
    step.actorId,
    'simulation.update_actor_missing'
  );
  if (!isRecord(step.actor)) {
    violations.push({
      code: 'simulation.update_actor',
      severity: 'error',
      message: `${path}.actor must be an update actor options object`,
    });
    return;
  }
  validateUpdateActorFields(violations, scenarioIndex, path, step.actorId, step.actor);
  if (step.placement !== undefined) {
    if (!isRecord(step.placement)) {
      violations.push({
        code: 'simulation.update_actor_placement',
        severity: 'error',
        message: `${path}.placement must be an update placement options object when provided`,
      });
    } else {
      validateUpdatePlacementFields(violations, scenarioIndex, `${path}.placement`, step.placement);
    }
  }
}

function validateSimulationUpdatePlacementStep(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  step: Readonly<Record<string, unknown>>
): void {
  validatePlacementReference(violations, scenarioIndex, `${path}.placementId`, step.placementId);
  if (!isRecord(step.placement)) {
    violations.push({
      code: 'simulation.update_placement',
      severity: 'error',
      message: `${path}.placement must be an update placement options object`,
    });
    return;
  }
  validateUpdatePlacementFields(violations, scenarioIndex, `${path}.placement`, step.placement);
}

function validateSpawnPlacementFields(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  options: Readonly<Record<string, unknown>>
): void {
  validateSpawnAssetAndKind(violations, path, options);
  if (!('at' in options)) {
    violations.push({
      code: 'simulation.spawn_tile',
      severity: 'error',
      message: `${path}.at must target a board tile`,
    });
    return;
  }
  validateTileReference(violations, scenarioIndex, `${path}.at`, options.at);
}

function validateSpawnAssetAndKind(
  violations: GameboardRuleViolation[],
  path: string,
  options: Readonly<Record<string, unknown>>
): void {
  if (!isNonEmptyString(options.assetId)) {
    violations.push({
      code: 'simulation.spawn_asset_id',
      severity: 'error',
      message: `${path}.assetId must be a non-empty string`,
    });
  }
  if (!isNonEmptyString(options.kind)) {
    violations.push({
      code: 'simulation.spawn_kind',
      severity: 'error',
      message: `${path}.kind must be a non-empty string`,
    });
  }
}

function validateUpdateActorFields(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  currentActorId: unknown,
  options: Readonly<Record<string, unknown>>
): void {
  if (options.actorId !== undefined) {
    if (!isNonEmptyString(options.actorId)) {
      violations.push({
        code: 'simulation.update_actor_id',
        severity: 'error',
        message: `${path}.actor.actorId must be a non-empty string when provided`,
      });
    } else {
      if (
        options.actorId !== currentActorId &&
        scenarioIndex.actorOrPlacementIds.has(options.actorId)
      ) {
        violations.push({
          code: 'simulation.update_actor_duplicate',
          severity: 'error',
          message: `${path}.actor.actorId ${options.actorId} already exists`,
          placementId: options.actorId,
        });
      }
      scenarioIndex.actorIds.add(options.actorId);
      scenarioIndex.actorOrPlacementIds.add(options.actorId);
    }
  }
  validateNonEmptyStringField(
    violations,
    `${path}.actor.actorKind`,
    options.actorKind,
    'simulation.update_actor_kind'
  );
  validateNullableStringField(
    violations,
    `${path}.actor.faction`,
    options.faction,
    'simulation.update_actor_faction'
  );
  validateNullableStringField(
    violations,
    `${path}.actor.team`,
    options.team,
    'simulation.update_actor_team'
  );
  validateStringArrayField(
    violations,
    `${path}.actor.tags`,
    options.tags,
    'simulation.update_actor_tags'
  );
  validateMetadataField(
    violations,
    `${path}.actor.actorMetadata`,
    options.actorMetadata,
    'simulation.update_actor_metadata'
  );
}

function validateUpdatePlacementFields(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  options: Readonly<Record<string, unknown>>
): void {
  validateTileReference(violations, scenarioIndex, `${path}.at`, options.at);
  validateNonEmptyStringField(
    violations,
    `${path}.assetId`,
    options.assetId,
    'simulation.update_asset_id'
  );
  validateNonEmptyStringField(violations, `${path}.kind`, options.kind, 'simulation.update_kind');
  validateNonEmptyStringField(
    violations,
    `${path}.layer`,
    options.layer,
    'simulation.update_layer'
  );
  validateMetadataField(
    violations,
    `${path}.metadata`,
    options.metadata,
    'simulation.update_metadata'
  );
}

function validateNonEmptyStringField(
  violations: GameboardRuleViolation[],
  path: string,
  value: unknown,
  code: string
): void {
  if (value !== undefined && !isNonEmptyString(value)) {
    violations.push({
      code,
      severity: 'error',
      message: `${path} must be a non-empty string when provided`,
    });
  }
}

function validateNullableStringField(
  violations: GameboardRuleViolation[],
  path: string,
  value: unknown,
  code: string
): void {
  if (value !== undefined && value !== null && !isNonEmptyString(value)) {
    violations.push({
      code,
      severity: 'error',
      message: `${path} must be a non-empty string or null when provided`,
    });
  }
}

function validateStringArrayField(
  violations: GameboardRuleViolation[],
  path: string,
  value: unknown,
  code: string
): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value) || value.some((item) => !isNonEmptyString(item))) {
    violations.push({
      code,
      severity: 'error',
      message: `${path} must be an array of non-empty strings when provided`,
    });
  }
}

function validateMetadataField(
  violations: GameboardRuleViolation[],
  path: string,
  value: unknown,
  code: string
): void {
  if (value !== undefined && !isRecord(value)) {
    violations.push({
      code,
      severity: 'error',
      message: `${path} must be an object when provided`,
    });
  }
}

function validateBooleanField(
  violations: GameboardRuleViolation[],
  path: string,
  value: unknown,
  code: string
): void {
  if (value !== undefined && typeof value !== 'boolean') {
    violations.push({
      code,
      severity: 'error',
      message: `${path} must be a boolean when provided`,
    });
  }
}

function validateNumberField(
  violations: GameboardRuleViolation[],
  path: string,
  value: unknown,
  code: string
): void {
  if (value !== undefined && typeof value !== 'number') {
    violations.push({
      code,
      severity: 'error',
      message: `${path} must be a number when provided`,
    });
  }
}

function validateTileReferenceList(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  values: unknown
): void {
  if (values === undefined) {
    return;
  }
  if (!Array.isArray(values)) {
    violations.push({
      code: 'simulation.tile_reference_list',
      severity: 'error',
      message: `${path} must be an array of tile keys`,
    });
    return;
  }
  for (const [index, value] of values.entries()) {
    validateTileReference(violations, scenarioIndex, `${path}.${index}`, value);
  }
}

function validateTileReferenceSelection(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  values: unknown
): void {
  if (values === undefined) {
    return;
  }
  if (Array.isArray(values)) {
    for (const [index, value] of values.entries()) {
      validateTileReference(violations, scenarioIndex, `${path}.${index}`, value);
    }
    return;
  }
  validateTileReference(violations, scenarioIndex, path, values);
}

function validateActorLikeReferenceList(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  values: unknown
): void {
  if (values === undefined) {
    return;
  }
  for (const [index, value] of normalizeUnknownList(values, path, violations, 'actor')) {
    validateActorLikeReference(
      violations,
      scenarioIndex,
      `${path}.${index}`,
      value,
      'simulation.actor_reference_missing'
    );
  }
}

function validatePlacementReferenceList(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  values: unknown
): void {
  if (values === undefined) {
    return;
  }
  for (const [index, value] of normalizeUnknownList(values, path, violations, 'placement')) {
    validatePlacementReference(violations, scenarioIndex, `${path}.${index}`, value);
  }
}

function validateActorTargetCenterReference(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  value: unknown
): void {
  if (value === undefined) {
    return;
  }
  if (isHexCoordinatesInput(value)) {
    validateTileReference(violations, scenarioIndex, path, value);
    return;
  }
  if (!isNonEmptyString(value)) {
    violations.push({
      code: 'simulation.actor_targets_center',
      severity: 'error',
      message: `${path} must be a tile key, actor id, placement id, or { q, r } coordinates`,
    });
    return;
  }
  const tileKey = tileKeyFromTargetInput(value);
  if (tileKey && scenarioIndex.tileKeys.has(tileKey)) {
    validateTileReference(violations, scenarioIndex, path, tileKey);
    return;
  }
  validateStringInteractionTarget(violations, scenarioIndex, path, value);
}

function validateStringOrStringArrayField(
  violations: GameboardRuleViolation[],
  path: string,
  value: unknown,
  code: string
): void {
  if (value === undefined) {
    return;
  }
  const values = Array.isArray(value) ? value : [value];
  if (values.some((item) => !isNonEmptyString(item))) {
    violations.push({
      code,
      severity: 'error',
      message: `${path} must be a non-empty string or array of non-empty strings`,
    });
  }
}

function validateEnumField<T extends string>(
  violations: GameboardRuleViolation[],
  path: string,
  value: unknown,
  values: readonly T[],
  code: string
): void {
  if (value !== undefined && !includesString(values, value)) {
    violations.push({
      code,
      severity: 'error',
      message: `${path} must be one of: ${values.join(', ')}`,
    });
  }
}

function normalizeUnknownList(
  values: unknown,
  path: string,
  violations: GameboardRuleViolation[],
  noun: string
): readonly [number, unknown][] {
  if (Array.isArray(values)) {
    return values.map((value, index) => [index, value] as const);
  }
  if (isNonEmptyString(values)) {
    return [[0, values]];
  }
  violations.push({
    code: `simulation.${noun}_reference_list`,
    severity: 'error',
    message: `${path} must be a non-empty string or array of non-empty strings`,
  });
  return [];
}

function registerSpawnedPlacementId(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  placementId: unknown
): void {
  if (placementId === undefined) {
    return;
  }
  if (!isNonEmptyString(placementId)) {
    violations.push({
      code: 'simulation.spawn_placement_id',
      severity: 'error',
      message: `${path} must be a non-empty string when provided`,
    });
    return;
  }
  if (
    scenarioIndex.placementIds.has(placementId) ||
    scenarioIndex.actorOrPlacementIds.has(placementId)
  ) {
    violations.push({
      code: 'simulation.spawn_placement_duplicate',
      severity: 'error',
      message: `${path} ${placementId} already exists`,
      placementId,
    });
  }
  scenarioIndex.placementIds.add(placementId);
  scenarioIndex.actorOrPlacementIds.add(placementId);
}

function validateCommandExpectations(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  expectations: unknown
): void {
  if (expectations === undefined) {
    return;
  }
  if (!Array.isArray(expectations)) {
    violations.push({
      code: 'simulation.expectation_commands',
      severity: 'error',
      message: 'Simulation command expectations must be an array',
    });
    return;
  }
  expectations.forEach((expectation, index) => {
    const path = `simulation.expectations.commands.${index}`;
    if (!isRecord(expectation)) {
      violations.push({
        code: 'simulation.expectation_command',
        severity: 'error',
        message: `${path} must be an object`,
      });
      return;
    }
    validateStepIdReference(violations, scenarioIndex, `${path}.stepId`, expectation.stepId);
    validateStepIndexField(violations, `${path}.stepIndex`, expectation.stepIndex);
    validateNonEmptyStringField(
      violations,
      `${path}.kind`,
      expectation.kind,
      'simulation.expectation_command_kind'
    );
    validateNonEmptyStringField(
      violations,
      `${path}.intent`,
      expectation.intent,
      'simulation.expectation_command_intent'
    );
    validateNonEmptyStringField(
      violations,
      `${path}.status`,
      expectation.status,
      'simulation.expectation_command_status'
    );
    validateBooleanField(
      violations,
      `${path}.canExecute`,
      expectation.canExecute,
      'simulation.expectation_command_can_execute'
    );
    validateTileReference(violations, scenarioIndex, `${path}.tileKey`, expectation.tileKey);
    validatePlacementReference(
      violations,
      scenarioIndex,
      `${path}.placementId`,
      expectation.placementId
    );
    validateActorLikeReference(
      violations,
      scenarioIndex,
      `${path}.actorId`,
      expectation.actorId,
      'simulation.expectation_actor_missing'
    );
    validateActorLikeReference(
      violations,
      scenarioIndex,
      `${path}.sourceActorId`,
      expectation.sourceActorId,
      'simulation.expectation_source_actor_missing'
    );
    validatePlacementReference(
      violations,
      scenarioIndex,
      `${path}.sourcePlacementId`,
      expectation.sourcePlacementId
    );
    validateNonEmptyStringField(
      violations,
      `${path}.handlerId`,
      expectation.handlerId,
      'simulation.expectation_command_handler_id'
    );
    validateNonEmptyStringField(
      violations,
      `${path}.handlerStatus`,
      expectation.handlerStatus,
      'simulation.expectation_command_handler_status'
    );
    validateStringArrayField(
      violations,
      `${path}.effectTypes`,
      expectation.effectTypes,
      'simulation.expectation_command_effect_types'
    );
    validateNonEmptyStringField(
      violations,
      `${path}.targetKind`,
      expectation.targetKind,
      'simulation.expectation_command_target_kind'
    );
    validateNonEmptyStringField(
      violations,
      `${path}.targetIntent`,
      expectation.targetIntent,
      'simulation.expectation_command_target_intent'
    );
    validateTileReference(
      violations,
      scenarioIndex,
      `${path}.targetTileKey`,
      expectation.targetTileKey
    );
    validatePlacementReference(
      violations,
      scenarioIndex,
      `${path}.targetPlacementId`,
      expectation.targetPlacementId
    );
    validateActorLikeReference(
      violations,
      scenarioIndex,
      `${path}.targetActorId`,
      expectation.targetActorId,
      'simulation.expectation_target_actor_missing'
    );
    validateBooleanField(
      violations,
      `${path}.targetCanEnter`,
      expectation.targetCanEnter,
      'simulation.expectation_command_target_can_enter'
    );
  });
}

function validateActorTargetExpectations(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  expectations: unknown
): void {
  if (expectations === undefined) {
    return;
  }
  if (!Array.isArray(expectations)) {
    violations.push({
      code: 'simulation.expectation_actor_targets',
      severity: 'error',
      message: 'Simulation actor target expectations must be an array',
    });
    return;
  }
  expectations.forEach((expectation, index) => {
    const path = `simulation.expectations.actorTargets.${index}`;
    if (!isRecord(expectation)) {
      violations.push({
        code: 'simulation.expectation_actor_target',
        severity: 'error',
        message: `${path} must be an object`,
      });
      return;
    }
    validateStepIdReference(violations, scenarioIndex, `${path}.stepId`, expectation.stepId);
    validateStepIndexField(violations, `${path}.stepIndex`, expectation.stepIndex);
    validateActorLikeReference(
      violations,
      scenarioIndex,
      `${path}.sourceActorId`,
      expectation.sourceActorId,
      'simulation.expectation_source_actor_missing'
    );
    validateActorLikeReferenceList(
      violations,
      scenarioIndex,
      `${path}.targetActorIds`,
      expectation.targetActorIds
    );
    validateActorLikeReferenceList(
      violations,
      scenarioIndex,
      `${path}.reachableActorIds`,
      expectation.reachableActorIds
    );
    validateActorLikeReference(
      violations,
      scenarioIndex,
      `${path}.nearestActorId`,
      expectation.nearestActorId,
      'simulation.expectation_nearest_actor_missing'
    );
    validateActorLikeReference(
      violations,
      scenarioIndex,
      `${path}.targetActorId`,
      expectation.targetActorId,
      'simulation.expectation_target_actor_missing'
    );
    validateActorTargetExpectationFields(violations, scenarioIndex, path, expectation, 'nearest');
    validateActorTargetExpectationFields(violations, scenarioIndex, path, expectation, 'target');
    validateNonEmptyStringField(
      violations,
      `${path}.targetCommandKind`,
      expectation.targetCommandKind,
      'simulation.expectation_actor_target_command_kind'
    );
    validateNonEmptyStringField(
      violations,
      `${path}.targetCommandIntent`,
      expectation.targetCommandIntent,
      'simulation.expectation_actor_target_command_intent'
    );
    validateBooleanField(
      violations,
      `${path}.targetCommandCanExecute`,
      expectation.targetCommandCanExecute,
      'simulation.expectation_actor_target_command_can_execute'
    );
    validateNonEmptyStringField(
      violations,
      `${path}.reason`,
      expectation.reason,
      'simulation.expectation_actor_target_reason'
    );
  });
}

function validateActorTargetExpectationFields(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  expectation: Readonly<Record<string, unknown>>,
  prefix: 'nearest' | 'target'
): void {
  const field = (name: string) => `${prefix}${name}`;
  validateEnumField(
    violations,
    `${path}.${field('Approach')}`,
    expectation[field('Approach')],
    SIMULATION_ACTOR_TARGET_APPROACH_VALUES,
    `simulation.expectation_actor_target_${prefix}_approach`
  );
  validateTileReference(
    violations,
    scenarioIndex,
    `${path}.${field('ApproachTileKey')}`,
    expectation[field('ApproachTileKey')]
  );
  validateBooleanField(
    violations,
    `${path}.${field('Reachable')}`,
    expectation[field('Reachable')],
    `simulation.expectation_actor_target_${prefix}_reachable`
  );
  validateBooleanField(
    violations,
    `${path}.${field('PathFound')}`,
    expectation[field('PathFound')],
    `simulation.expectation_actor_target_${prefix}_path_found`
  );
  validateNumberField(
    violations,
    `${path}.${field('PathCost')}`,
    expectation[field('PathCost')],
    `simulation.expectation_actor_target_${prefix}_path_cost`
  );
  validateTileReferenceList(
    violations,
    scenarioIndex,
    `${path}.${field('PathKeys')}`,
    expectation[field('PathKeys')]
  );
}

function validateMovementExpectations(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  expectations: unknown
): void {
  if (expectations === undefined) {
    return;
  }
  if (!Array.isArray(expectations)) {
    violations.push({
      code: 'simulation.expectation_movements',
      severity: 'error',
      message: 'Simulation movement expectations must be an array',
    });
    return;
  }
  expectations.forEach((expectation, index) => {
    const path = `simulation.expectations.movements.${index}`;
    if (!isRecord(expectation)) {
      violations.push({
        code: 'simulation.expectation_movement',
        severity: 'error',
        message: `${path} must be an object`,
      });
      return;
    }
    validateStepIdReference(violations, scenarioIndex, `${path}.stepId`, expectation.stepId);
    validateStepIndexField(violations, `${path}.stepIndex`, expectation.stepIndex);
    if (
      expectation.eventType !== undefined &&
      !includesString(SIMULATION_MOVEMENT_EVENT_TYPES, expectation.eventType)
    ) {
      violations.push({
        code: 'simulation.expectation_movement_event_type',
        severity: 'error',
        message: `${path}.eventType must be a movement event type`,
      });
    }
    validateActorLikeReference(
      violations,
      scenarioIndex,
      `${path}.actorId`,
      expectation.actorId,
      'simulation.expectation_actor_missing'
    );
    validateNonEmptyStringField(
      violations,
      `${path}.placementId`,
      expectation.placementId,
      'simulation.expectation_movement_placement'
    );
    validateTileReference(violations, scenarioIndex, `${path}.tileKey`, expectation.tileKey);
    validateNonEmptyStringField(
      violations,
      `${path}.assetId`,
      expectation.assetId,
      'simulation.expectation_movement_asset'
    );
    validateNonEmptyStringField(
      violations,
      `${path}.profileId`,
      expectation.profileId,
      'simulation.expectation_movement_profile'
    );
    validateBooleanField(
      violations,
      `${path}.moved`,
      expectation.moved,
      'simulation.expectation_movement_moved'
    );
    validateNonEmptyStringField(
      violations,
      `${path}.status`,
      expectation.status,
      'simulation.expectation_movement_status'
    );
    validateTileReference(
      violations,
      scenarioIndex,
      `${path}.destinationKey`,
      expectation.destinationKey
    );
    validateTileReferenceList(violations, scenarioIndex, `${path}.pathKeys`, expectation.pathKeys);
    validateTileReferenceList(
      violations,
      scenarioIndex,
      `${path}.pathIncludes`,
      expectation.pathIncludes
    );
    validateNumberField(
      violations,
      `${path}.nextIndex`,
      expectation.nextIndex,
      'simulation.expectation_movement_next_index'
    );
    validateNumberField(
      violations,
      `${path}.cost`,
      expectation.cost,
      'simulation.expectation_movement_cost'
    );
    validateNumberField(
      violations,
      `${path}.spentCost`,
      expectation.spentCost,
      'simulation.expectation_movement_spent_cost'
    );
    validateNumberField(
      violations,
      `${path}.visited`,
      expectation.visited,
      'simulation.expectation_movement_visited'
    );
  });
}

function validatePatrolExpectations(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  expectations: unknown
): void {
  if (expectations === undefined) {
    return;
  }
  if (!Array.isArray(expectations)) {
    violations.push({
      code: 'simulation.expectation_patrols',
      severity: 'error',
      message: 'Simulation patrol expectations must be an array',
    });
    return;
  }
  expectations.forEach((expectation, index) => {
    const path = `simulation.expectations.patrols.${index}`;
    if (!isRecord(expectation)) {
      violations.push({
        code: 'simulation.expectation_patrol',
        severity: 'error',
        message: `${path} must be an object`,
      });
      return;
    }
    validateStepIdReference(violations, scenarioIndex, `${path}.stepId`, expectation.stepId);
    validateStepIndexField(violations, `${path}.stepIndex`, expectation.stepIndex);
    if (
      expectation.eventType !== undefined &&
      !includesString(SIMULATION_PATROL_EVENT_TYPES, expectation.eventType)
    ) {
      violations.push({
        code: 'simulation.expectation_patrol_event_type',
        severity: 'error',
        message: `${path}.eventType must be a patrol event type`,
      });
    }
    validateActorLikeReference(
      violations,
      scenarioIndex,
      `${path}.actorId`,
      expectation.actorId,
      'simulation.expectation_actor_missing'
    );
    validateNonEmptyStringField(
      violations,
      `${path}.placementId`,
      expectation.placementId,
      'simulation.expectation_patrol_placement'
    );
    validateNonEmptyStringField(
      violations,
      `${path}.routeId`,
      expectation.routeId,
      'simulation.expectation_patrol_route'
    );
    validateNonEmptyStringField(
      violations,
      `${path}.status`,
      expectation.status,
      'simulation.expectation_patrol_status'
    );
    validateTileReference(violations, scenarioIndex, `${path}.targetKey`, expectation.targetKey);
    validateNumberField(
      violations,
      `${path}.currentWaypointIndex`,
      expectation.currentWaypointIndex,
      'simulation.expectation_patrol_current_waypoint_index'
    );
    validateNumberField(
      violations,
      `${path}.targetWaypointIndex`,
      expectation.targetWaypointIndex,
      'simulation.expectation_patrol_target_waypoint_index'
    );
    validateNumberField(
      violations,
      `${path}.roundsCompleted`,
      expectation.roundsCompleted,
      'simulation.expectation_patrol_rounds_completed'
    );
    validateBooleanField(
      violations,
      `${path}.requested`,
      expectation.requested,
      'simulation.expectation_patrol_requested'
    );
    validateBooleanField(
      violations,
      `${path}.advanced`,
      expectation.advanced,
      'simulation.expectation_patrol_advanced'
    );
  });
}

function validateMutationExpectations(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  expectations: unknown
): void {
  if (expectations === undefined) {
    return;
  }
  if (!Array.isArray(expectations)) {
    violations.push({
      code: 'simulation.expectation_mutations',
      severity: 'error',
      message: 'Simulation mutation expectations must be an array',
    });
    return;
  }
  expectations.forEach((expectation, index) => {
    const path = `simulation.expectations.mutations.${index}`;
    if (!isRecord(expectation)) {
      violations.push({
        code: 'simulation.expectation_mutation',
        severity: 'error',
        message: `${path} must be an object`,
      });
      return;
    }
    if (
      expectation.type !== undefined &&
      !includesString(SIMULATION_MUTATION_TYPES, expectation.type)
    ) {
      violations.push({
        code: 'simulation.expectation_mutation_type',
        severity: 'error',
        message: `${path}.type must be a supported mutation type`,
      });
    }
    validateActorLikeReference(
      violations,
      scenarioIndex,
      `${path}.actorId`,
      expectation.actorId,
      'simulation.expectation_actor_missing'
    );
    validatePlacementReference(
      violations,
      scenarioIndex,
      `${path}.placementId`,
      expectation.placementId
    );
  });
}

function validateActorExpectations(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  expectations: unknown
): void {
  if (expectations === undefined) {
    return;
  }
  if (!Array.isArray(expectations)) {
    violations.push({
      code: 'simulation.expectation_actors',
      severity: 'error',
      message: 'Simulation actor expectations must be an array',
    });
    return;
  }
  expectations.forEach((expectation, index) => {
    const path = `simulation.expectations.actors.${index}`;
    if (!isRecord(expectation)) {
      violations.push({
        code: 'simulation.expectation_actor',
        severity: 'error',
        message: `${path} must be an object`,
      });
      return;
    }
    validateActorLikeReference(
      violations,
      scenarioIndex,
      `${path}.actorId`,
      expectation.actorId,
      'simulation.expectation_actor_missing'
    );
    validateTileReference(violations, scenarioIndex, `${path}.tileKey`, expectation.tileKey);
    validatePlacementReference(
      violations,
      scenarioIndex,
      `${path}.placementId`,
      expectation.placementId
    );
    validateStringArrayField(
      violations,
      `${path}.tags`,
      expectation.tags,
      'simulation.expectation_actor_tags'
    );
    validateMetadataField(
      violations,
      `${path}.metadata`,
      expectation.metadata,
      'simulation.expectation_actor_metadata'
    );
  });
}

function validatePlacementExpectations(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  expectations: unknown
): void {
  if (expectations === undefined) {
    return;
  }
  if (!Array.isArray(expectations)) {
    violations.push({
      code: 'simulation.expectation_placements',
      severity: 'error',
      message: 'Simulation placement expectations must be an array',
    });
    return;
  }
  expectations.forEach((expectation, index) => {
    const path = `simulation.expectations.placements.${index}`;
    if (!isRecord(expectation)) {
      violations.push({
        code: 'simulation.expectation_placement',
        severity: 'error',
        message: `${path} must be an object`,
      });
      return;
    }
    validatePlacementReference(
      violations,
      scenarioIndex,
      `${path}.placementId`,
      expectation.placementId
    );
    validateTileReference(violations, scenarioIndex, `${path}.tileKey`, expectation.tileKey);
  });
}

function validateQuestExpectations(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  expectations: unknown
): void {
  if (expectations === undefined) {
    return;
  }
  if (!Array.isArray(expectations)) {
    violations.push({
      code: 'simulation.expectation_quests',
      severity: 'error',
      message: 'Simulation quest expectations must be an array',
    });
    return;
  }
  expectations.forEach((expectation, index) => {
    const path = `simulation.expectations.quests.${index}`;
    if (!isRecord(expectation)) {
      violations.push({
        code: 'simulation.expectation_quest',
        severity: 'error',
        message: `${path} must be an object`,
      });
      return;
    }
    if (!isNonEmptyString(expectation.questId)) {
      violations.push({
        code: 'simulation.expectation_quest_id',
        severity: 'error',
        message: `${path}.questId must be a non-empty string`,
      });
      return;
    }
    if (scenarioIndex.questIds.size > 0 && !scenarioIndex.questIds.has(expectation.questId)) {
      violations.push({
        code: 'simulation.expectation_quest_missing',
        severity: 'error',
        message: `${path}.questId references missing quest ${expectation.questId}`,
      });
    }
    validateObjectiveReferences(violations, scenarioIndex, path, expectation.questId, expectation);
  });
}

function validateObjectiveReferences(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  questId: string,
  expectation: Readonly<Record<string, unknown>>
): void {
  const objectiveIds = scenarioIndex.objectiveIdsByQuest.get(questId);
  validateObjectiveReference(
    violations,
    objectiveIds,
    `${path}.activeObjectiveId`,
    expectation.activeObjectiveId
  );
  validateObjectiveReferenceList(
    violations,
    objectiveIds,
    `${path}.completedObjectives`,
    expectation.completedObjectives
  );
  validateObjectiveReferenceList(
    violations,
    objectiveIds,
    `${path}.blockedObjectives`,
    expectation.blockedObjectives
  );
  validateObjectiveReferenceList(
    violations,
    objectiveIds,
    `${path}.pendingObjectives`,
    expectation.pendingObjectives
  );
}

function validateObjectiveReferenceList(
  violations: GameboardRuleViolation[],
  objectiveIds: ReadonlySet<string> | undefined,
  path: string,
  values: unknown
): void {
  if (values === undefined) {
    return;
  }
  if (!Array.isArray(values)) {
    violations.push({
      code: 'simulation.expectation_objective_ids',
      severity: 'error',
      message: `${path} must be an array of objective ids`,
    });
    return;
  }
  for (const objectiveId of values) {
    validateObjectiveReference(violations, objectiveIds, path, objectiveId);
  }
}

function validateObjectiveReference(
  violations: GameboardRuleViolation[],
  objectiveIds: ReadonlySet<string> | undefined,
  path: string,
  objectiveId: unknown
): void {
  if (objectiveId === undefined) {
    return;
  }
  if (!isNonEmptyString(objectiveId)) {
    violations.push({
      code: 'simulation.expectation_objective_id',
      severity: 'error',
      message: `${path} must contain non-empty objective ids`,
    });
    return;
  }
  if (objectiveIds && !objectiveIds.has(objectiveId)) {
    violations.push({
      code: 'simulation.expectation_objective_missing',
      severity: 'error',
      message: `${path} references missing objective ${objectiveId}`,
    });
  }
}

function validateEventTypeArray(
  violations: GameboardRuleViolation[],
  path: string,
  eventTypes: unknown
): void {
  if (eventTypes === undefined) {
    return;
  }
  if (!Array.isArray(eventTypes)) {
    violations.push({
      code: 'simulation.expectation_event_types',
      severity: 'error',
      message: `${path} must be an array`,
    });
    return;
  }
  eventTypes.forEach((eventType) => {
    if (!includesString(SIMULATION_EVENT_TYPES, eventType)) {
      violations.push({
        code: 'simulation.expectation_event_type',
        severity: 'error',
        message: `${path} contains unsupported event type ${String(eventType)}`,
      });
    }
  });
}

function validateCommandHandlerPresetList(
  violations: GameboardRuleViolation[],
  path: string,
  presets: unknown
): void {
  if (presets === undefined) {
    return;
  }
  if (!Array.isArray(presets)) {
    violations.push({
      code: 'simulation.command_handlers',
      severity: 'error',
      message: `${path} must be an array of command handler presets`,
    });
    return;
  }
  presets.forEach((preset, index) => {
    validateCommandHandlerPreset(violations, `${path}.${index}`, preset);
  });
}

function validateCommandHandlerPreset(
  violations: GameboardRuleViolation[],
  path: string,
  preset: unknown
): void {
  if (preset === undefined) {
    return;
  }
  if (!isGameboardInteractionHandlerPreset(preset)) {
    violations.push({
      code: 'simulation.command_handler',
      severity: 'error',
      message: `${path} must be a supported command handler preset`,
    });
  }
}

function validateCommandHandlerPresetOptions(
  violations: GameboardRuleViolation[],
  path: string,
  options: unknown
): void {
  if (options === undefined) {
    return;
  }
  if (!isRecord(options)) {
    violations.push({
      code: 'simulation.command_handler_options',
      severity: 'error',
      message: `${path} must be an object when provided`,
    });
    return;
  }
  validateRemoveTargetActorHandlerOptions(
    violations,
    `${path}.removeTargetActor`,
    options.removeTargetActor
  );
  validateRemoveTargetPlacementHandlerOptions(
    violations,
    `${path}.removeTargetPlacement`,
    options.removeTargetPlacement
  );
  validateMarkTargetActorInteractedHandlerOptions(
    violations,
    `${path}.markTargetActorInteracted`,
    options.markTargetActorInteracted
  );
}

function validateRemoveTargetActorHandlerOptions(
  violations: GameboardRuleViolation[],
  path: string,
  options: unknown
): void {
  if (options === undefined) {
    return;
  }
  if (!isRecord(options)) {
    violations.push({
      code: 'simulation.command_handler_options',
      severity: 'error',
      message: `${path} must be an object when provided`,
    });
    return;
  }
  validateNonEmptyStringField(
    violations,
    `${path}.handlerId`,
    options.handlerId,
    'simulation.command_handler_id'
  );
  validateCommandKindArrayField(violations, `${path}.commandKinds`, options.commandKinds);
  validateBooleanField(
    violations,
    `${path}.requireHostile`,
    options.requireHostile,
    'simulation.command_handler_require_hostile'
  );
}

function validateRemoveTargetPlacementHandlerOptions(
  violations: GameboardRuleViolation[],
  path: string,
  options: unknown
): void {
  if (options === undefined) {
    return;
  }
  if (!isRecord(options)) {
    violations.push({
      code: 'simulation.command_handler_options',
      severity: 'error',
      message: `${path} must be an object when provided`,
    });
    return;
  }
  validateNonEmptyStringField(
    violations,
    `${path}.handlerId`,
    options.handlerId,
    'simulation.command_handler_id'
  );
  validateCommandKindArrayField(violations, `${path}.commandKinds`, options.commandKinds);
  validateBooleanField(
    violations,
    `${path}.includeActorPlacements`,
    options.includeActorPlacements,
    'simulation.command_handler_include_actor_placements'
  );
}

function validateMarkTargetActorInteractedHandlerOptions(
  violations: GameboardRuleViolation[],
  path: string,
  options: unknown
): void {
  if (options === undefined) {
    return;
  }
  if (!isRecord(options)) {
    violations.push({
      code: 'simulation.command_handler_options',
      severity: 'error',
      message: `${path} must be an object when provided`,
    });
    return;
  }
  validateNonEmptyStringField(
    violations,
    `${path}.handlerId`,
    options.handlerId,
    'simulation.command_handler_id'
  );
  validateCommandKindArrayField(violations, `${path}.commandKinds`, options.commandKinds);
  validateNonEmptyStringField(
    violations,
    `${path}.interactedField`,
    options.interactedField,
    'simulation.command_handler_interacted_field'
  );
  validateNonEmptyStringField(
    violations,
    `${path}.sourceActorField`,
    options.sourceActorField,
    'simulation.command_handler_source_actor_field'
  );
  validateMetadataField(
    violations,
    `${path}.metadata`,
    options.metadata,
    'simulation.command_handler_metadata'
  );
}

function validateCommandKindArrayField(
  violations: GameboardRuleViolation[],
  path: string,
  value: unknown
): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    violations.push({
      code: 'simulation.command_handler_command_kinds',
      severity: 'error',
      message: `${path} must be an array of supported command kinds`,
    });
    return;
  }
  value.forEach((kind, index) => {
    if (!includesString(SIMULATION_COMMAND_KIND_VALUES, kind)) {
      violations.push({
        code: 'simulation.command_handler_command_kind',
        severity: 'error',
        message: `${path}.${index} must be a supported command kind`,
      });
    }
  });
}

function validateSourceActorReference(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  actorId: unknown
): void {
  if (actorId === undefined) {
    return;
  }
  validateActorLikeReference(
    violations,
    scenarioIndex,
    path,
    actorId,
    'simulation.source_actor_missing'
  );
}

function validateStepIdReference(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  stepId: unknown
): void {
  if (stepId === undefined) {
    return;
  }
  if (!isNonEmptyString(stepId)) {
    violations.push({
      code: 'simulation.step_reference',
      severity: 'error',
      message: `${path} must be a non-empty string`,
    });
    return;
  }
  if (scenarioIndex.stepIds.size > 0 && !scenarioIndex.stepIds.has(stepId)) {
    violations.push({
      code: 'simulation.expectation_command_step_missing',
      severity: 'error',
      message: `${path} references missing simulation step ${stepId}`,
    });
  }
}

function validateStepIndexField(
  violations: GameboardRuleViolation[],
  path: string,
  stepIndex: unknown
): void {
  if (stepIndex === undefined) {
    return;
  }
  if (typeof stepIndex !== 'number' || !Number.isInteger(stepIndex) || stepIndex < 0) {
    violations.push({
      code: 'simulation.step_index_reference',
      severity: 'error',
      message: `${path} must be a non-negative integer`,
    });
  }
}

function validateActorLikeReference(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  actorId: unknown,
  code: string
): void {
  if (actorId === undefined) {
    return;
  }
  if (!isNonEmptyString(actorId)) {
    violations.push({
      code: 'simulation.actor_reference',
      severity: 'error',
      message: `${path} must be a non-empty string`,
    });
    return;
  }
  if (
    scenarioIndex.actorOrPlacementIds.size > 0 &&
    !scenarioIndex.actorOrPlacementIds.has(actorId)
  ) {
    violations.push({
      code,
      severity: 'error',
      message: `${path} references missing actor or actor placement ${actorId}`,
      placementId: actorId,
    });
  }
}

function validatePlacementReference(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  placementId: unknown
): void {
  if (placementId === undefined) {
    return;
  }
  if (!isNonEmptyString(placementId)) {
    violations.push({
      code: 'simulation.placement_reference',
      severity: 'error',
      message: `${path} must be a non-empty string`,
    });
    return;
  }
  if (scenarioIndex.placementIds.size > 0 && !scenarioIndex.placementIds.has(placementId)) {
    violations.push({
      code: 'simulation.placement_missing',
      severity: 'error',
      message: `${path} references missing placement ${placementId}`,
      placementId,
    });
  }
}

function validateInteractionTargetReference(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  target: unknown
): void {
  if (typeof target === 'string') {
    validateStringInteractionTarget(violations, scenarioIndex, path, target);
    return;
  }
  if (isHexCoordinatesInput(target)) {
    validateTileReference(violations, scenarioIndex, path, hexKey(target));
    return;
  }
  if (!isRecord(target)) {
    violations.push({
      code: 'simulation.command_target',
      severity: 'error',
      message: `${path} must be a tile key, coordinates, actor target, or placement target`,
    });
    return;
  }

  const hasKnownTargetField =
    'actorId' in target ||
    'placementId' in target ||
    'tileKey' in target ||
    'coordinates' in target;
  validateActorLikeReference(
    violations,
    scenarioIndex,
    `${path}.actorId`,
    target.actorId,
    'simulation.command_target_actor_missing'
  );
  validatePlacementReference(violations, scenarioIndex, `${path}.placementId`, target.placementId);
  validateTileReference(violations, scenarioIndex, `${path}.tileKey`, target.tileKey);
  if (target.coordinates !== undefined) {
    const coordinates = tileKeyFromTargetInput(target.coordinates);
    if (coordinates) {
      validateTileReference(violations, scenarioIndex, `${path}.coordinates`, coordinates);
    } else {
      violations.push({
        code: 'simulation.command_target_coordinates',
        severity: 'error',
        message: `${path}.coordinates must be a tile key string or { q, r } coordinates`,
      });
    }
  }
  if (!hasKnownTargetField) {
    violations.push({
      code: 'simulation.command_target',
      severity: 'error',
      message: `${path} must include actorId, placementId, tileKey, or coordinates`,
    });
  }
}

function validateStringInteractionTarget(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  target: string
): void {
  if (!isNonEmptyString(target)) {
    violations.push({
      code: 'simulation.command_target',
      severity: 'error',
      message: `${path} must be a non-empty string`,
    });
    return;
  }

  const tileKey = tileKeyFromTargetInput(target);
  if (tileKey) {
    validateTileReference(violations, scenarioIndex, path, tileKey);
    return;
  }
  if (scenarioIndex.actorOrPlacementIds.has(target) || scenarioIndex.placementIds.has(target)) {
    return;
  }
  if (scenarioIndex.actorOrPlacementIds.size > 0 || scenarioIndex.placementIds.size > 0) {
    violations.push({
      code: 'simulation.command_target_missing',
      severity: 'error',
      message: `${path} references unknown tile, actor, or placement ${target}`,
      placementId: target,
    });
  }
}

function validateTileReference(
  violations: GameboardRuleViolation[],
  scenarioIndex: SimulationScenarioIndex,
  path: string,
  tileKey: unknown
): void {
  if (tileKey === undefined) {
    return;
  }
  const key = tileKeyFromTargetInput(tileKey);
  if (!key) {
    violations.push({
      code: 'simulation.tile_reference',
      severity: 'error',
      message: `${path} must be a tile key string or { q, r } coordinates`,
    });
    return;
  }
  if (scenarioIndex.tileKeys.size > 0 && !scenarioIndex.tileKeys.has(key)) {
    violations.push({
      code: 'simulation.tile_missing',
      severity: 'error',
      message: `${path} references missing tile ${key}`,
      tileKey: key,
    });
  }
}

function tileKeyFromTargetInput(value: unknown): string | undefined {
  if (typeof value === 'string') {
    try {
      return hexKey(parseHexKey(value));
    } catch {
      return undefined;
    }
  }
  return isHexCoordinatesInput(value) ? hexKey(value) : undefined;
}

function isHexCoordinatesInput(value: unknown): value is { q: number; r: number } {
  return isRecord(value) && Number.isFinite(value.q) && Number.isFinite(value.r);
}

function isSimulationStepAction(
  value: unknown
): value is GameboardScenarioSimulationStep['action'] {
  return includesString(SIMULATION_STEP_ACTIONS, value);
}

function isSimulationMovementEventType(
  value: unknown
): value is (typeof SIMULATION_MOVEMENT_EVENT_TYPES)[number] {
  return includesString(SIMULATION_MOVEMENT_EVENT_TYPES, value);
}

function isSimulationPatrolEventType(
  value: unknown
): value is (typeof SIMULATION_PATROL_EVENT_TYPES)[number] {
  return includesString(SIMULATION_PATROL_EVENT_TYPES, value);
}

function includesString<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
): readonly GameboardScenarioSimulationCommandHandlerPreset[] {
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
    return exhaustive;
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
  step: GameboardScenarioSimulationRunSystemsStep,
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
      throw new Error(`Simulation actor ${actor.actorId} has no spawn tile or spawn group`);
    }
    return actor as SpawnGameboardActorOptions;
  }
  const existingClaims = readGameboardActors(runtime.world)
    .map(simulationActorSpawnClaim)
    .filter((claim): claim is GameboardScenarioActor => claim !== undefined);
  return resolveGameboardScenarioActors([...existingClaims, actor], runtime.spawnGroups).at(
    -1
  ) as SpawnGameboardActorOptions;
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
  const placement = entity.get(PlacementState);
  const mutation: GameboardScenarioSimulationMutationRecord = {
    type: 'placement-spawned',
    placementId: placement?.id ?? step.placement.id,
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
  const updated = entity.get(PlacementState);
  return {
    type: 'placement-updated',
    placementId: updated?.id ?? placementId,
    updated: true,
  };
}

function simulationResult(
  runtime: GameboardScenarioRuntime,
  steps: readonly GameboardScenarioSimulationStepResult[]
): GameboardScenarioSimulationResult {
  return {
    runtime,
    steps,
    events: steps.flatMap((step) => step.events),
    eventRecords: steps.flatMap((step) => step.eventRecords),
    mutations: steps.flatMap((step) => step.mutations),
    finalPlan: projectWorldToGameboardPlan(runtime.world),
    actors: readGameboardActors(runtime.world),
    quests: readGameboardQuests(runtime.world),
  };
}

function actorRecord(snapshot: GameboardActorSnapshot): GameboardScenarioSimulationActorRecord {
  return {
    actorId: snapshot.actor.actorId,
    kind: snapshot.actor.kind,
    faction: snapshot.actor.faction,
    team: snapshot.actor.team,
    hostile: snapshot.actor.hostile,
    blocksMovement: snapshot.actor.blocksMovement,
    interactive: snapshot.actor.interactive,
    tags: [...snapshot.actor.tags],
    metadata: { ...snapshot.actor.metadata },
    placement: placementRecord(snapshot.placement),
  };
}

function placementRecord(
  placement: PlacementStateValue | GameboardPlacementSpec
): GameboardScenarioSimulationPlacementRecord {
  return {
    placementId: placement.id,
    tileKey: placement.tileKey,
    assetId: placement.assetId,
    kind: placement.kind,
    layer: placement.layer,
    requiresExtra: placement.requiresExtra,
    metadata: { ...placement.metadata },
  };
}

function actorTargetsRecordFromReport(
  report: ReturnType<typeof inspectGameboardActorTargets>,
  stepIndex: number,
  step: GameboardScenarioSimulationStepBase
): GameboardScenarioSimulationActorTargetsRecord {
  return {
    stepIndex,
    stepId: step.id,
    stepLabel: step.label,
    sourceActorId: report.source?.actor.actorId,
    sourcePlacementId: report.source?.placement.id,
    sourceTileKey: report.source?.placement.tileKey,
    targetActorIds: [...report.targetActorIds],
    reachableActorIds: [...report.reachableActorIds],
    nearestTarget: report.nearestTarget ? actorTargetRecord(report.nearestTarget) : undefined,
    targets: report.targets.map(actorTargetRecord),
    reason: report.reason,
  };
}

function emptyActorTargetsRecord(
  stepIndex: number,
  step: GameboardScenarioSimulationStepBase,
  reason: string
): GameboardScenarioSimulationActorTargetsRecord {
  return {
    stepIndex,
    stepId: step.id,
    stepLabel: step.label,
    targetActorIds: [],
    reachableActorIds: [],
    targets: [],
    reason,
  };
}

function actorTargetRecord(
  target: GameboardActorTarget
): GameboardScenarioSimulationActorTargetRecord {
  return {
    actorId: target.record.actorId,
    placementId: target.record.placementId,
    tileKey: target.record.tileKey,
    kind: target.record.kind,
    faction: target.record.faction,
    team: target.record.team,
    hostile: target.record.hostile,
    hostileToSource: target.record.hostileToSource,
    interactive: target.record.interactive,
    approach: target.approach,
    approachTileKey: target.approachTileKey,
    reachable: target.reachable,
    reason: target.reason,
    pathFound: target.path.found,
    pathCost: target.path.cost,
    pathKeys: target.path.path.map((tile) => tile.key),
    commandKind: target.command.kind,
    commandIntent: target.command.intent,
    commandCanExecute: target.command.canExecute,
    commandReason: target.command.reason,
    commandTileKey: target.command.tileKey,
    commandPlacementId: target.command.placementId,
    commandActorId: target.command.actorId,
  };
}

function questRecord(snapshot: GameboardQuestSnapshot): GameboardScenarioSimulationQuestRecord {
  return {
    questId: snapshot.quest.questId,
    title: snapshot.quest.title,
    status: snapshot.quest.status,
    activeObjectiveIndex: snapshot.quest.activeObjectiveIndex,
    activeObjectiveId: snapshot.quest.objectives[snapshot.quest.activeObjectiveIndex]?.id,
    objectives: snapshot.quest.objectives.map(copyQuestObjective),
    progress: snapshot.quest.progress.map((progress) => ({ ...progress })),
    metadata: { ...snapshot.quest.metadata },
  };
}

function commandRecordFromStepResult(
  step: GameboardScenarioSimulationStepResult
): GameboardInteractionCommandRecord | undefined {
  const command = step.dispatch?.eventRecords.find((event) => event.command)?.command;
  return command ? copyJson(command) : undefined;
}

function commandRecordsFromStepReports(
  steps: readonly GameboardScenarioSimulationStepReport[]
): GameboardScenarioSimulationCommandRecord[] {
  return steps.flatMap((step) =>
    step.eventRecords.flatMap((eventRecord) =>
      eventRecord.command
        ? [
            {
              stepIndex: step.index,
              stepId: step.id,
              stepLabel: step.label,
              eventType: eventRecord.type,
              command: copyJson(eventRecord.command),
            },
          ]
        : []
    )
  );
}

function actorTargetRecordsFromStepReports(
  steps: readonly GameboardScenarioSimulationStepReport[]
): GameboardScenarioSimulationActorTargetsRecord[] {
  return steps.flatMap((step) => (step.actorTargets ? [copyJson(step.actorTargets)] : []));
}

function movementRecordsFromStepReports(
  steps: readonly GameboardScenarioSimulationStepReport[]
): GameboardScenarioSimulationMovementRecord[] {
  return steps.flatMap((step) =>
    step.eventRecords.flatMap((eventRecord) =>
      eventRecord.movement && isSimulationMovementEventType(eventRecord.type)
        ? [
            {
              stepIndex: step.index,
              stepId: step.id,
              stepLabel: step.label,
              eventType: eventRecord.type,
              movement: copyJson(eventRecord.movement),
            },
          ]
        : []
    )
  );
}

function patrolRecordsFromStepReports(
  steps: readonly GameboardScenarioSimulationStepReport[]
): GameboardScenarioSimulationPatrolRecord[] {
  return steps.flatMap((step) =>
    step.eventRecords.flatMap((eventRecord) =>
      eventRecord.patrol && isSimulationPatrolEventType(eventRecord.type)
        ? [
            {
              stepIndex: step.index,
              stepId: step.id,
              stepLabel: step.label,
              eventType: eventRecord.type,
              patrol: copyJson(eventRecord.patrol),
            },
          ]
        : []
    )
  );
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

function copyQuestObjective(objective: GameboardQuestObjective): GameboardQuestObjective {
  if ('tile' in objective && typeof objective.tile === 'object') {
    return { ...objective, tile: { ...objective.tile } };
  }
  if ('targetTile' in objective && typeof objective.targetTile === 'object') {
    return { ...objective, targetTile: { ...objective.targetTile } };
  }
  return { ...objective };
}

function copySystemEventRecord(record: GameboardSystemEventRecord): GameboardSystemEventRecord {
  return copyJson(record);
}

function copyJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
