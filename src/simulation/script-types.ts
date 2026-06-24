/**
 * Simulation script DTOs, schema constants, runtime result records, and patrol
 * simulation planning types.
 *
 * @module
 */

import type {
  GameboardActorKind,
  GameboardActorMetadataValue,
  GameboardActorTargetingOptions,
  UpdateGameboardActorOptions,
} from '../actors';
import type {
  CreateGameboardInteractionHandlerPresetOptions,
  GameboardActorTargetCommandOptions,
  GameboardInteractionCommandInput,
  GameboardInteractionHandlerEffect,
  GameboardInteractionHandlerPreset,
} from '../commands';
import {
  type SIMULATION_MOVEMENT_EVENT_TYPES,
  type SIMULATION_PATROL_EVENT_TYPES,
  SIMULATION_STEP_ACTIONS,
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
