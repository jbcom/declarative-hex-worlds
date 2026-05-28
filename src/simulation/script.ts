/**
 * Simulation script types, schema constants, and authored-script validators.
 *
 * Split out of the original monolithic `./simulation` during PRD D3 (H-3).
 * Behavior is byte-identical with the pre-split implementation; only the
 * physical home of the symbols moved.
 *
 * @module
 */

import type {
  GameboardActorKind,
  GameboardActorMetadataValue,
  GameboardActorTargetingOptions,
  UpdateGameboardActorOptions,
} from '../actors';
import {
  type CreateGameboardInteractionHandlerPresetOptions,
  type GameboardActorTargetCommandOptions,
  type GameboardInteractionCommandInput,
  type GameboardInteractionHandlerEffect,
  type GameboardInteractionHandlerPreset,
  isGameboardInteractionHandlerPreset,
} from '../commands';
import { hexKey } from '../coordinates';
import {
  errorMessage,
  includesString,
  isHexCoordinatesInput,
  isNonEmptyString,
  isRecord,
} from '../internal';
import {
  SIMULATION_ACTOR_TARGET_APPROACH_VALUES,
  SIMULATION_ACTOR_TARGET_SORT_VALUES,
  SIMULATION_COMMAND_KIND_VALUES,
  SIMULATION_EVENT_TYPES,
  SIMULATION_MOVEMENT_EVENT_TYPES,
  SIMULATION_MUTATION_TYPES,
  SIMULATION_PATROL_EVENT_TYPES,
  SIMULATION_STEP_ACTIONS,
  isSimulationStepAction,
  tileKeyFromTargetInput,
} from './internal';
import type {
  GameboardPatrolRoutePlan,
  GameboardPatrolRouteSet,
  GameboardPlacementKind,
  GameboardPlacementLayer,
  GameboardPlan,
} from '../gameboard';
import type { SpawnGameboardPlacementOptions, UpdateGameboardPlacementOptions } from '../koota';
import type { GameboardMovementPathRequestOptions } from '../movement';
import type { GameboardQuestStatus } from '../quests';
import type { GameboardRuleViolation } from '../rules';
import type { GameboardScenario, GameboardScenarioActor } from '../scenario';
import { createGameboardPlanFromRecipe } from '../scenario';
import type {
  GameboardInteractionCommandRecord,
  GameboardMovementEventRecord,
  GameboardPatrolEventRecord,
  GameboardSystemEventRecord,
  RunGameboardInteractionOptions,
  RunGameboardSystemsOptions,
} from '../systems';

/**
 * Current JSON schema version for scenario simulation scripts and reports.
 */
export const GAMEBOARD_SCENARIO_SIMULATION_SCHEMA_VERSION = '1.0.0';

/**
 * Supported simulation step action discriminators. Canonical table lives in
 * `./internal` (as `SIMULATION_STEP_ACTIONS`); re-exported here under the public
 * name so the cycle-prone guards can stay in `./internal`.
 */
export const GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS = SIMULATION_STEP_ACTIONS;
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
  recipeOverrides?: import('../scenario').GameboardRecipePlanOptionsOverride;
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
 *
 * The full shape is defined here (alongside the step types) so authored
 * scripts and runtime results share a single source of truth.
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
  dispatch?: import('../systems').DispatchGameboardInteractionCommandResult;
  /** Actor-target report for target-inspection steps. */
  actorTargets?: GameboardScenarioSimulationActorTargetsRecord;
  /** System tick result for run-systems or post-command systems. */
  systems?: import('../systems').RunGameboardSystemsResult;
  /** In-memory events emitted by the step. */
  events: readonly import('../systems').GameboardSystemEvent[];
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
 * Serializable actor-targeting report with step provenance.
 *
 * Declared in `script.ts` (not `report.ts`) because it appears in
 * `GameboardScenarioSimulationStepResult`, which the engine produces and the
 * report module consumes.
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
  approach: import('../actors').GameboardActorTarget['approach'];
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

// ---------------------------------------------------------------------------
// Authored-script validators
// ---------------------------------------------------------------------------

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
 * @internal
 */
export interface SimulationScenarioIndex {
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

  validateActorLikeReferenceList(violations, scenarioIndex, `${path}.actorIds`, targeting.actorIds);
  validatePlacementReferenceList(
    violations,
    scenarioIndex,
    `${path}.placementIds`,
    targeting.placementIds
  );
  validateTileReferenceSelection(violations, scenarioIndex, `${path}.tileKeys`, targeting.tileKeys);
  validateActorTargetCenterReference(violations, scenarioIndex, `${path}.center`, targeting.center);
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
