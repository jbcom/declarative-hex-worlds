/**
 * High-level runtime facade that coordinates Koota state, actors, movement,
 * commands, quests, layout fills, pieces, scenarios, simulation, and interop.
 *
 * @module
 */
import type { Entity, World } from 'koota';
import {
  findGameboardActor,
  moveGameboardActor,
  planGameboardInteractionCommand,
  gameboardActorActions,
  inspectGameboardActorTargets,
  inspectGameboardNeighborhood,
  inspectGameboardTile,
  readGameboardActors,
  readGameboardActorsForTile,
  registerGameboardActor,
  selectGameboardActors,
  spawnGameboardActor,
  updateGameboardActor,
  type GameboardActorRegistrationOptions,
  type GameboardActorSelection,
  type GameboardActorSelectionOptions,
  type GameboardActorSnapshot,
  type GameboardActorTargetingOptions,
  type GameboardActorTargetingReport,
  type GameboardInteractionCommand,
  type GameboardInteractionCommandOptions,
  type GameboardInteractionTargetInput,
  type GameboardNeighborhoodCenter,
  type GameboardNeighborhoodInspection,
  type GameboardNeighborhoodInspectionOptions,
  type GameboardTileInspection,
  type GameboardTileInspectionOptions,
  type MoveGameboardActorOptions,
  type SpawnGameboardActorOptions,
  type UpdateGameboardActorOptions,
} from './actors';
import {
  executeGameboardInteractionCommand,
  gameboardCommandActions,
  planGameboardActorTargetCommand,
  previewGameboardInteractionCommand,
  type GameboardActorTargetCommandOptions,
  type GameboardActorTargetCommandPlan,
  type GameboardInteractionCommandExecution,
  type GameboardInteractionCommandExecutionOptions,
  type GameboardInteractionCommandInput,
  type GameboardInteractionCommandPreview,
  type GameboardInteractionCommandPreviewOptions,
} from './commands';
import {
  summarizeGameboardPlan,
  type GameboardPlan,
  type GameboardPlanSummary,
  type SummarizeGameboardPlanOptions,
} from './gameboard';
import {
  createGameboardRuntimeInteropSnapshot,
  createGameboardScenarioInteropSnapshot,
  type GameboardInteropOptions,
  type GameboardInteropScenarioRecord,
  type GameboardInteropSnapshot,
  mountGameboardInteropSnapshot,
  type GameboardEcsAdapter,
  type GameboardEcsMountResult,
  type GameboardRuntimeInteropOptions,
  type GameboardScenarioInteropOptions,
} from './interop';
import {
  canOccupyGameboardPlacement,
  createGameboardWorld,
  gameboardActions,
  inspectGameboardPlacementOccupancy,
  moveGameboardPlacement,
  readGameboardPlacementOccupancy,
  readGameboardPlacements,
  readGameboardSnapshot,
  readPlacementOccupancyForTile,
  readPlacementsForTile,
  removeGameboardPlacement,
  spawnGameboardPlacement,
  updateGameboardPlacement,
  type GameboardEntityIndex,
  type GameboardPlacementOccupancyInspection,
  type GameboardSnapshot,
  type InspectGameboardPlacementOccupancyOptions,
  type PlacementOccupancySnapshot,
  type PlacementStateValue,
  type SpawnGameboardPlacementOptions,
  type UpdateGameboardPlacementOptions,
} from './koota';
import type { SpawnLocation } from './coordinates';
import {
  type GameboardLayoutArchetypeRegistry,
  analyzeGameboardLayoutFill,
  createGameboardLayoutFillPlacements,
  createGameboardLayoutPlacements,
  inspectGameboardLayoutSites,
  spawnGameboardLayoutFill,
  spawnGameboardLayoutPlacements,
  type GameboardLayoutFillAnalysis,
  type GameboardLayoutFillOptions,
  type GameboardLayoutFillRule,
  type GameboardLayoutPlacementOptions,
  type GameboardLayoutSiteInspection,
  type InspectGameboardLayoutSitesOptions,
} from './coordinates';
import { gameboardMovementActions } from './movement';
import {
  createGameboardNavigation,
  createGameboardOccupancyIndex,
  planGameboardPatrolRoute,
  planGameboardPatrolRoutes,
  planGameboardSpawnGroups,
  selectGameboardSpawnLocations,
  type GameboardNavigation,
  type GameboardNavigationProfile,
  type GameboardOccupancyIndex,
  type GameboardPatrolRouteOptions,
  type GameboardPatrolRoutePlan,
  type GameboardPatrolRouteSet,
  type GameboardPatrolRouteSetOptions,
  type GameboardSpawnGroupOptions,
  type GameboardSpawnGroupPlan,
  type GameboardSpawnLocationOptions,
} from './gameboard';
import { gameboardPatrolActions } from './patrol';
import {
  analyzeGameboardPieceRegistry,
  createGameboardLayoutFillRuleFromPieces,
  createGameboardLayoutFillRulesFromRegistry,
  createGameboardLayoutPlacementOptionsFromPiece,
  createGameboardLayoutPlacementsFromPiece,
  createGameboardPieceSourceUrlMap,
  inspectGameboardPiecePlacement,
  selectGameboardPieces,
  type AnalyzeGameboardPieceRegistryOptions,
  type GameboardPieceCollectionLayoutRuleOptions,
  type GameboardPieceDeclaration,
  type GameboardPiecePlacementInspection,
  type GameboardPiecePlacementOptions,
  type GameboardPieceRegistry,
  type GameboardPieceRegistryAnalysis,
  type GameboardPieceRegistryFillRulesOptions,
  type GameboardPieceRegistrySelection,
  type GameboardPieceSourceUrlOptions,
} from './pieces';
import {
  projectWorldToGameboardPlan,
  readValidationGameboardPlanFromWorld,
} from './coordinates';
import {
  advanceAllGameboardQuests,
  advanceGameboardQuest,
  findGameboardQuest,
  gameboardQuestActions,
  readGameboardQuests,
  spawnGameboardQuest,
  type AdvanceGameboardQuestOptions,
  type GameboardQuestDefinition,
  type GameboardQuestSnapshot,
  type SpawnGameboardQuestOptions,
} from './quests';
import {
  createGameboardLayoutArchetypeRegistryFromRecipe,
  createGameboardPieceRegistryFromRecipe,
  createGameboardPlanFromRecipe,
  type GameboardRecipe,
  type GameboardRecipePlanOptionsOverride,
} from './recipe';
import {
  createSeededGameboardPieceFillRules,
  inspectSeededGameboardPieceFills,
  type InspectSeededGameboardPieceFillsOptions,
  type SeededGameboardPieceFillInspection,
  type SeededGameboardPieceFillOptions,
} from './rules';
import {
  createGameboardWorldFromScenario,
  summarizeGameboardScenario,
  type GameboardScenario,
  type GameboardScenarioRuntime,
  type GameboardScenarioSummary,
  type SummarizeGameboardScenarioOptions,
} from './scenario';
import {
  dispatchGameboardActorTargetCommand,
  dispatchGameboardInteractionCommand,
  gameboardSystemActions,
  runGameboardActorTargetInteraction,
  runGameboardInteraction,
  runGameboardSystems,
  type DispatchGameboardActorTargetCommandResult,
  type DispatchGameboardInteractionCommandOptions,
  type DispatchGameboardInteractionCommandResult,
  type RunGameboardActorTargetInteractionResult,
  type RunGameboardInteractionOptions,
  type RunGameboardInteractionResult,
  type RunGameboardSystemsOptions,
  type RunGameboardSystemsResult,
} from './systems';
import type { HexCoordinates } from './types';

/**
 * Koota action bundle for raw board placement operations.
 */
export type GameboardActionBundle = ReturnType<typeof gameboardActions>;

/**
 * Koota action bundle for actor spawning, movement, and selection.
 */
export type GameboardActorActionBundle = ReturnType<typeof gameboardActorActions>;

/**
 * Koota action bundle for movement-agent requests and ticks.
 */
export type GameboardMovementActionBundle = ReturnType<typeof gameboardMovementActions>;

/**
 * Koota action bundle for patrol-agent setup and ticks.
 */
export type GameboardPatrolActionBundle = ReturnType<typeof gameboardPatrolActions>;

/**
 * Koota action bundle for quest spawning and progression.
 */
export type GameboardQuestActionBundle = ReturnType<typeof gameboardQuestActions>;

/**
 * Koota action bundle for command planning, preview, execution, and targeting.
 */
export type GameboardCommandActionBundle = ReturnType<typeof gameboardCommandActions>;

/**
 * Koota action bundle for command dispatch and game-loop system ticks.
 */
export type GameboardSystemActionBundle = ReturnType<typeof gameboardSystemActions>;

/**
 * Accepted input for creating a runtime facade.
 */
export type CreateGameboardRuntimeInput =
  | GameboardPlan
  | World
  | CreateGameboardRuntimeOptions;

/**
 * Explicit runtime creation options.
 */
export interface CreateGameboardRuntimeOptions {
  /** Existing Koota world to bind. */
  world?: World;
  /** Serializable plan to load into a new Koota world. */
  plan?: GameboardPlan;
}

interface GameboardRuntimeBindingContext {
  interopScenario?: GameboardInteropScenarioRecord;
}

/**
 * Snapshot options for the runtime facade.
 */
export interface GameboardRuntimeSnapshotOptions extends GameboardInteropOptions {
  /** Include a runtime interop snapshot. Defaults to true. */
  includeInterop?: boolean;
  /** Include the validation-oriented plan projection. */
  includeValidationPlan?: boolean;
}

/**
 * Full serializable snapshot of a live runtime facade.
 */
export interface GameboardRuntimeSnapshot {
  /** Low-level board snapshot from Koota traits and relations. */
  state: GameboardSnapshot;
  /** Renderable/current projected gameboard plan. */
  plan: GameboardPlan;
  /** Validation-oriented plan when requested. */
  validationPlan?: GameboardPlan;
  /** Current placement records. */
  placements: readonly PlacementStateValue[];
  /** Current placement footprint occupancy records. */
  placementOccupancy: readonly PlacementOccupancySnapshot[];
  /** Current actor snapshots. */
  actors: readonly GameboardActorSnapshot[];
  /** Current quest snapshots. */
  quests: readonly GameboardQuestSnapshot[];
  /** Optional ECS interop snapshot. */
  interop?: GameboardInteropSnapshot;
}

/**
 * Bound gameboard facade for one live board instance.
 *
 * The facade keeps the raw Koota world and action bundles available, but adds
 * game-oriented reads and mutations that project the live board before
 * navigation, layout, piece-fill, scenario, and interop operations. Prefer this
 * object at scene boundaries, React providers, integration tests, and external
 * ECS bridges when the board is actively changing during play.
 */
export interface GameboardRuntime {
  /** Bound Koota world. */
  readonly world: World;
  /** Raw board placement actions. */
  readonly actions: GameboardActionBundle;
  /** Actor actions. */
  readonly actors: GameboardActorActionBundle;
  /** Movement actions. */
  readonly movement: GameboardMovementActionBundle;
  /** Patrol actions. */
  readonly patrol: GameboardPatrolActionBundle;
  /** Quest actions. */
  readonly quests: GameboardQuestActionBundle;
  /** Command planning/execution actions. */
  readonly commands: GameboardCommandActionBundle;
  /** System dispatch/tick actions. */
  readonly systems: GameboardSystemActionBundle;
  /** Load a plan into the bound world. */
  loadPlan: (plan: GameboardPlan) => GameboardEntityIndex;
  /** Project the live world to a renderable plan. */
  plan: () => GameboardPlan;
  /** Summarize the live projected plan for editor, diagnostics, and bridge code. */
  summarizePlan: (options?: SummarizeGameboardPlanOptions) => GameboardPlanSummary;
  /** Project the live world to a plan shape suitable for validation. */
  validationPlan: () => GameboardPlan;
  /** Read a serializable runtime snapshot. */
  snapshot: (options?: GameboardRuntimeSnapshotOptions) => GameboardRuntimeSnapshot;
  /**
   * Read serializable placement records from live state.
   *
   * Use this for save data, editor panels, renderer diffing, and external ECS
   * mirrors that do not need raw Koota relation stores.
   */
  readPlacements: () => PlacementStateValue[];
  /**
   * Read serializable placement records that occupy one tile.
   *
   * This includes placements whose multi-tile footprint covers the tile, not
   * only placements whose canonical origin is the tile.
   */
  readPlacementsForTile: (coordinates: HexCoordinates | string) => PlacementStateValue[];
  /**
   * Read every placement footprint currently reserving or blocking tiles.
   *
   * The returned records include origin and occupied tile metadata, so UI and
   * pathfinding bridges can reason about multi-hex structures and blockers.
   */
  readPlacementOccupancy: () => PlacementOccupancySnapshot[];
  /**
   * Read occupancy records for one tile.
   *
   * Prefer this over filtering `readPlacementOccupancy()` in UI panels,
   * collision probes, and external ECS bridges that only need one hex.
   */
  readPlacementOccupancyForTile: (coordinates: HexCoordinates | string) => PlacementOccupancySnapshot[];
  /**
   * Inspect whether a placement footprint can occupy the current live board.
   *
   * This is the preflight path for construction cursors, drag previews, unit
   * moves, and generated fills before mutating the world.
   */
  inspectPlacementOccupancy: (
    options: InspectGameboardPlacementOccupancyOptions
  ) => GameboardPlacementOccupancyInspection;
  /** Return the boolean result from `inspectPlacementOccupancy`. */
  canOccupyPlacement: (options: InspectGameboardPlacementOccupancyOptions) => boolean;
  /**
   * Spawn one renderable placement into the live world.
   *
   * Pass `occupancyGuard: true` when the spawn should fail instead of
   * overlapping an existing blocker or missing footprint tile.
   */
  spawnPlacement: (options: SpawnGameboardPlacementOptions) => Entity;
  /**
   * Update one placement in the live world while preserving omitted fields.
   *
   * The helper refreshes placement classification and footprint relations when
   * fields such as coordinates, kind, layer, footprint, tags, or blocking
   * behavior change.
   */
  updatePlacement: (
    placement: Entity | string,
    options: UpdateGameboardPlacementOptions
  ) => Entity;
  /**
   * Move one placement to a new tile or coordinate-like target.
   *
   * Use this for actor movement, build previews, temporary markers, and
   * gameplay props that should remain in the same Koota entity.
   */
  movePlacement: (
    placement: Entity | string,
    to: SpawnGameboardPlacementOptions['at'],
    options?: Omit<UpdateGameboardPlacementOptions, 'at'>
  ) => Entity;
  /**
   * Remove one placement entity and its placement relations from the live world.
   *
   * Returns `false` when the entity or placement id cannot be found.
   */
  removePlacement: (placement: Entity | string) => boolean;
  /** Inspect one tile, placement, actor, or coordinate in live state. */
  inspectTile: (
    coordinates: SpawnGameboardActorOptions['at'],
    options?: GameboardTileInspectionOptions
  ) => GameboardTileInspection;
  /** Inspect a radius around a tile, placement, actor, or coordinate. */
  inspectNeighborhood: (
    center: GameboardNeighborhoodCenter,
    options?: GameboardNeighborhoodInspectionOptions
  ) => GameboardNeighborhoodInspection;
  /** Select actors from live state using actor-aware filters. */
  selectActors: (options?: GameboardActorSelectionOptions) => GameboardActorSelection;
  /** Select and rank actor targets with path and command planning. */
  inspectActorTargets: (options: GameboardActorTargetingOptions) => GameboardActorTargetingReport;
  /** Create an ECS interop snapshot from the live runtime. */
  createInteropSnapshot: (options?: GameboardRuntimeInteropOptions) => GameboardInteropSnapshot;
  /** Mount the live runtime snapshot into another ECS/store adapter. */
  mountInterop: <TEntity>(
    adapter: GameboardEcsAdapter<TEntity>,
    options?: GameboardRuntimeInteropOptions
  ) => GameboardEcsMountResult<TEntity>;
  /** Create a navigation occupancy index from the live projected world. */
  createOccupancyIndex: (profile?: GameboardNavigationProfile) => GameboardOccupancyIndex;
  /** Create a pathfinding/navigation facade from the live projected world. */
  createNavigation: (profile?: GameboardNavigationProfile) => GameboardNavigation;
  /** Select deterministic spawn locations from the live projected world. */
  selectSpawnLocations: (options: GameboardSpawnLocationOptions) => SpawnLocation[];
  /** Plan spawn groups from the live projected world. */
  planSpawnGroups: (options: GameboardSpawnGroupOptions) => GameboardSpawnGroupPlan;
  /** Plan one patrol route from the live projected world. */
  planPatrolRoute: (options: GameboardPatrolRouteOptions) => GameboardPatrolRoutePlan;
  /** Plan a patrol route set from the live projected world. */
  planPatrolRoutes: (options: GameboardPatrolRouteSetOptions) => GameboardPatrolRouteSet;
  /** Inspect layout candidates and rejections against the live projected world. */
  inspectLayoutSites: (
    options?: InspectGameboardLayoutSitesOptions
  ) => GameboardLayoutSiteInspection;
  /** Create layout placement spawn options without mutating the live world. */
  createLayoutPlacements: (
    options: GameboardLayoutPlacementOptions
  ) => SpawnGameboardPlacementOptions[];
  /** Analyze seeded layout fill rules against the live projected world. */
  analyzeLayoutFill: (options: GameboardLayoutFillOptions) => GameboardLayoutFillAnalysis;
  /** Create seeded layout fill placement options without mutating the live world. */
  createLayoutFillPlacements: (
    options: GameboardLayoutFillOptions
  ) => SpawnGameboardPlacementOptions[];
  /** Spawn explicit layout placements into the live world. */
  spawnLayoutPlacements: (options: GameboardLayoutPlacementOptions) => Entity[];
  /** Spawn a generated layout fill into the live world. */
  spawnLayoutFill: (options: GameboardLayoutFillOptions) => Entity[];
  /** Convert a piece declaration to layout placement options. */
  createPiecePlacementOptions: (
    piece: GameboardPieceDeclaration,
    options?: GameboardPiecePlacementOptions
  ) => GameboardLayoutPlacementOptions;
  /** Create placement options for a piece against the current projected plan. */
  createPiecePlacements: (
    piece: GameboardPieceDeclaration,
    options?: GameboardPiecePlacementOptions
  ) => SpawnGameboardPlacementOptions[];
  /** Inspect where a piece can be placed against the current projected plan. */
  inspectPiecePlacement: (
    piece: GameboardPieceDeclaration,
    options?: GameboardPiecePlacementOptions
  ) => GameboardPiecePlacementInspection;
  /** Spawn one declared piece into the live world. */
  spawnPiece: (
    piece: GameboardPieceDeclaration,
    options?: GameboardPiecePlacementOptions
  ) => Entity[];
  /** Analyze a custom piece registry. */
  analyzePieceRegistry: (
    registry: GameboardPieceRegistry,
    options?: AnalyzeGameboardPieceRegistryOptions
  ) => GameboardPieceRegistryAnalysis;
  /** Select declarations from a custom piece registry. */
  selectPieces: (
    registry: GameboardPieceRegistry,
    selection?: GameboardPieceRegistrySelection
  ) => GameboardPieceDeclaration[];
  /** Create layout fill rules from selected registry pieces. */
  createPieceFillRules: (
    registry: GameboardPieceRegistry,
    options?: GameboardPieceRegistryFillRulesOptions
  ) => GameboardLayoutFillRule[];
  /** Create one pooled fill rule from a piece collection. */
  createPiecePoolFillRule: (
    pieces: readonly GameboardPieceDeclaration[],
    options?: GameboardPieceCollectionLayoutRuleOptions
  ) => GameboardLayoutFillRule;
  /** Analyze generated piece fills against the current projected plan. */
  analyzePieceFills: (
    registry: GameboardPieceRegistry,
    fills: readonly SeededGameboardPieceFillOptions[],
    options?: InspectSeededGameboardPieceFillsOptions
  ) => GameboardLayoutFillAnalysis;
  /** Inspect generated piece fills with candidate and rejection details. */
  inspectPieceFills: (
    registry: GameboardPieceRegistry,
    fills: readonly SeededGameboardPieceFillOptions[],
    options?: InspectSeededGameboardPieceFillsOptions
  ) => SeededGameboardPieceFillInspection;
  /** Spawn generated piece fills into the live world. */
  spawnPieceFills: (
    registry: GameboardPieceRegistry,
    fills: readonly SeededGameboardPieceFillOptions[],
    options?: InspectSeededGameboardPieceFillsOptions
  ) => Entity[];
  /** Create an asset-id-to-URL map for local custom pieces. */
  createPieceSourceUrlMap: (
    registry: GameboardPieceRegistry,
    options?: GameboardPieceSourceUrlOptions
  ) => Readonly<Record<string, string>>;
  /** Spawn an actor-backed placement. */
  spawnActor: (options: SpawnGameboardActorOptions) => Entity;
  /**
   * Attach actor state to an existing placement.
   *
   * Register existing placements when a neutral prop, marker, structure, or
   * externally declared piece becomes selectable, interactive, hostile, or
   * quest-addressable after startup.
   */
  registerActor: (
    placement: Entity | string,
    options: GameboardActorRegistrationOptions
  ) => Entity;
  /** Update actor state while preserving omitted fields and placement binding. */
  updateActor: (actor: Entity | string, options: UpdateGameboardActorOptions) => Entity;
  /** Find one actor by entity, placement id, or stable actor id. */
  findActor: (actor: Entity | string) => GameboardActorSnapshot | undefined;
  /** Read all registered actors joined with their placement and tile records. */
  readActors: () => GameboardActorSnapshot[];
  /**
   * Read registered actors whose placement origin is one tile.
   *
   * Use this for hover cards, collision probes, encounter checks, and external
   * ECS sync when a game needs actor semantics instead of raw placements.
   */
  readActorsForTile: (coordinates: HexCoordinates | string) => GameboardActorSnapshot[];
  /** Move an actor-backed placement by actor id or entity. */
  moveActor: (
    actor: Entity | string,
    to: SpawnGameboardActorOptions['at'],
    options?: MoveGameboardActorOptions
  ) => Entity;
  /**
   * Spawn a quest definition into the live world.
   *
   * Quest objectives can reference actor ids, placement ids, and tile keys, so
   * scenario and runtime-created quests use the same progression surface.
   */
  spawnQuest: (
    definition: GameboardQuestDefinition,
    options?: SpawnGameboardQuestOptions
  ) => Entity;
  /** Find one quest by entity or stable quest id. */
  findQuest: (quest: Entity | string) => GameboardQuestSnapshot | undefined;
  /** Read all quest snapshots from live state for HUDs, saves, and tests. */
  readQuests: () => GameboardQuestSnapshot[];
  /** Advance one quest against the current live actor, placement, and tile state. */
  advanceQuest: (
    quest: Entity | string,
    options?: AdvanceGameboardQuestOptions
  ) => GameboardQuestSnapshot;
  /** Advance every quest against the current live actor, placement, and tile state. */
  advanceAllQuests: (options?: AdvanceGameboardQuestOptions) => GameboardQuestSnapshot[];
  /** Plan a command from a renderer or gameplay target. */
  planCommand: (
    target: GameboardInteractionTargetInput,
    options?: GameboardInteractionCommandOptions
  ) => GameboardInteractionCommand;
  /** Plan a command against the selected actor target. */
  planActorTargetCommand: (
    options: GameboardActorTargetCommandOptions
  ) => GameboardActorTargetCommandPlan;
  /** Preview command execution without mutating state. */
  previewCommand: (
    commandOrTarget: GameboardInteractionCommandInput,
    options?: GameboardInteractionCommandPreviewOptions
  ) => GameboardInteractionCommandPreview;
  /** Execute a command and return dispatch events. */
  dispatchCommand: (
    commandOrTarget: GameboardInteractionCommandInput,
    options?: DispatchGameboardInteractionCommandOptions
  ) => DispatchGameboardInteractionCommandResult;
  /** Select an actor target and dispatch the planned command. */
  dispatchActorTargetCommand: (
    options: GameboardActorTargetCommandOptions,
    commandOptions?: DispatchGameboardInteractionCommandOptions
  ) => DispatchGameboardActorTargetCommandResult;
  /** Execute a command without wrapping it in system events. */
  executeCommand: (
    commandOrTarget: GameboardInteractionCommandInput,
    options?: GameboardInteractionCommandExecutionOptions
  ) => GameboardInteractionCommandExecution;
  /** Dispatch a command and optionally run systems. */
  interact: (
    commandOrTarget: GameboardInteractionCommandInput,
    options?: RunGameboardInteractionOptions
  ) => RunGameboardInteractionResult;
  /** Target an actor, dispatch the command, and optionally run systems. */
  interactActorTarget: (
    options: GameboardActorTargetCommandOptions,
    interactionOptions?: RunGameboardInteractionOptions
  ) => RunGameboardActorTargetInteractionResult;
  /** Run enabled systems for one game-loop tick. */
  tick: (options?: RunGameboardSystemsOptions) => RunGameboardSystemsResult;
}

/**
 * Runtime facade created from a scenario, preserving scenario-specific indexes
 * and source URL helpers.
 */
export interface GameboardScenarioGameRuntime extends GameboardRuntime {
  /** Scenario runtime produced by `createGameboardWorldFromScenario`. */
  readonly scenarioRuntime: GameboardScenarioRuntime;
  /** Scenario actor entity index by actor id. */
  readonly actorEntities: GameboardScenarioRuntime['actorEntities'];
  /** Scenario quest entity index by quest id. */
  readonly questEntities: GameboardScenarioRuntime['questEntities'];
  /** Scenario spawn groups planned during startup. */
  readonly spawnGroups?: GameboardScenarioRuntime['spawnGroups'];
  /** Scenario patrol routes planned during startup. */
  readonly patrolRoutes?: GameboardScenarioRuntime['patrolRoutes'];
  /** Layout archetypes declared by the scenario recipe. */
  readonly scenarioLayoutArchetypes?: GameboardLayoutArchetypeRegistry;
  /** Piece registry declared by the scenario recipe. */
  readonly scenarioPieceRegistry?: GameboardPieceRegistry;
  /** Create an interop snapshot from the original scenario definition. */
  createScenarioInteropSnapshot: (
    options?: GameboardScenarioInteropOptions
  ) => GameboardInteropSnapshot;
  /** Summarize the original scenario definition, actors, quests, spawns, and routes. */
  summarizeScenario: (options?: SummarizeGameboardScenarioOptions) => GameboardScenarioSummary;
  /** Mount the original scenario definition into another ECS/store adapter. */
  mountScenarioInterop: <TEntity>(
    adapter: GameboardEcsAdapter<TEntity>,
    options?: GameboardScenarioInteropOptions
  ) => GameboardEcsMountResult<TEntity>;
  /** Create an asset-id-to-URL map for scenario-local custom pieces. */
  createScenarioPieceSourceUrlMap: (
    options?: GameboardPieceSourceUrlOptions
  ) => Readonly<Record<string, string>>;
}

/**
 * Runtime facade created from a recipe, preserving recipe-specific registries.
 */
export interface GameboardRecipeGameRuntime extends GameboardRuntime {
  /** Source recipe used to create the runtime. */
  readonly recipe: GameboardRecipe;
  /** Layout archetypes declared by the recipe. */
  readonly recipeLayoutArchetypes?: GameboardLayoutArchetypeRegistry;
  /** Piece registry declared by the recipe. */
  readonly recipePieceRegistry?: GameboardPieceRegistry;
  /** Create an asset-id-to-URL map for recipe-local custom pieces. */
  createRecipePieceSourceUrlMap: (
    options?: GameboardPieceSourceUrlOptions
  ) => Readonly<Record<string, string>>;
}

/**
 * Creates a runtime facade from an existing world, a serializable plan, or
 * explicit runtime options.
 */
export function createGameboardRuntime(input: CreateGameboardRuntimeInput): GameboardRuntime {
  const world = resolveRuntimeWorld(input);
  return bindGameboardRuntime(world);
}

/**
 * Compiles a recipe into a live runtime while preserving recipe-local layout
 * archetypes and piece registry helpers.
 */
export function createGameboardRuntimeFromRecipe(
  recipe: GameboardRecipe,
  overrides: GameboardRecipePlanOptionsOverride = {}
): GameboardRecipeGameRuntime {
  const runtime = bindGameboardRuntime(createGameboardWorld(createGameboardPlanFromRecipe(recipe, overrides)));
  const recipeLayoutArchetypes = createGameboardLayoutArchetypeRegistryFromRecipe(recipe);
  const recipePieceRegistry = createGameboardPieceRegistryFromRecipe(recipe);
  return {
    ...runtime,
    recipe,
    recipeLayoutArchetypes,
    recipePieceRegistry,
    createRecipePieceSourceUrlMap: (options = {}) =>
      recipePieceRegistry ? createGameboardPieceSourceUrlMap(recipePieceRegistry, options) : {},
  };
}

/**
 * Compiles a scenario into a live runtime while preserving actor/quest indexes,
 * scenario interop helpers, and scenario-local piece source URL helpers.
 */
export function createGameboardRuntimeFromScenario(
  scenario: GameboardScenario,
  overrides: GameboardRecipePlanOptionsOverride = {}
): GameboardScenarioGameRuntime {
  const scenarioRuntime = createGameboardWorldFromScenario(scenario, overrides);
  const runtime = bindGameboardRuntime(scenarioRuntime.world, {
    interopScenario: scenarioInteropRecord(scenario),
  });
  const scenarioLayoutArchetypes = createGameboardLayoutArchetypeRegistryFromRecipe(scenario.board);
  const scenarioPieceRegistry = createGameboardPieceRegistryFromRecipe(scenario.board);
  return {
    ...runtime,
    scenarioRuntime,
    actorEntities: scenarioRuntime.actorEntities,
    questEntities: scenarioRuntime.questEntities,
    spawnGroups: scenarioRuntime.spawnGroups,
    patrolRoutes: scenarioRuntime.patrolRoutes,
    scenarioLayoutArchetypes,
    scenarioPieceRegistry,
    createScenarioInteropSnapshot: (options = {}) =>
      createGameboardScenarioInteropSnapshot(scenario, options),
    summarizeScenario: (options = {}) => summarizeGameboardScenario(scenario, options),
    mountScenarioInterop: (adapter, options = {}) =>
      mountGameboardInteropSnapshot(
        createGameboardScenarioInteropSnapshot(scenario, options),
        adapter
      ),
    createScenarioPieceSourceUrlMap: (options = {}) =>
      scenarioPieceRegistry ? createGameboardPieceSourceUrlMap(scenarioPieceRegistry, options) : {},
  };
}

function bindGameboardRuntime(
  world: World,
  context: GameboardRuntimeBindingContext = {}
): GameboardRuntime {
  const actions = gameboardActions(world);
  return {
    world,
    actions,
    actors: gameboardActorActions(world),
    movement: gameboardMovementActions(world),
    patrol: gameboardPatrolActions(world),
    quests: gameboardQuestActions(world),
    commands: gameboardCommandActions(world),
    systems: gameboardSystemActions(world),
    loadPlan: (plan) => actions.loadPlan(plan),
    plan: () => projectWorldToGameboardPlan(world),
    summarizePlan: (options = {}) => summarizeGameboardPlan(projectWorldToGameboardPlan(world), options),
    validationPlan: () => readValidationGameboardPlanFromWorld(world),
    snapshot: (options = {}) => runtimeSnapshot(world, options, context),
    readPlacements: () => readGameboardPlacements(world),
    readPlacementsForTile: (coordinates) => readPlacementsForTile(world, coordinates),
    readPlacementOccupancy: () => readGameboardPlacementOccupancy(world),
    readPlacementOccupancyForTile: (coordinates) =>
      readPlacementOccupancyForTile(world, coordinates),
    inspectPlacementOccupancy: (options) => inspectGameboardPlacementOccupancy(world, options),
    canOccupyPlacement: (options) => canOccupyGameboardPlacement(world, options),
    spawnPlacement: (options) => spawnGameboardPlacement(world, options),
    updatePlacement: (placement, options) => updateGameboardPlacement(world, placement, options),
    movePlacement: (placement, to, options = {}) =>
      moveGameboardPlacement(world, placement, to, options),
    removePlacement: (placement) => removeGameboardPlacement(world, placement),
    inspectTile: (coordinates, options = {}) => inspectGameboardTile(world, coordinates, options),
    inspectNeighborhood: (center, options = {}) =>
      inspectGameboardNeighborhood(world, center, options),
    selectActors: (options = {}) => selectGameboardActors(world, options),
    inspectActorTargets: (options) => inspectGameboardActorTargets(world, options),
    createInteropSnapshot: (options = {}) =>
      runtimeInteropSnapshot(world, { ...options, scenario: context.interopScenario }),
    mountInterop: (adapter, options = {}) =>
      mountGameboardInteropSnapshot(
        runtimeInteropSnapshot(world, { ...options, scenario: context.interopScenario }),
        adapter
      ),
    createOccupancyIndex: (profile = {}) =>
      createGameboardOccupancyIndex(projectWorldToGameboardPlan(world), profile),
    createNavigation: (profile = {}) =>
      createGameboardNavigation(projectWorldToGameboardPlan(world), profile),
    selectSpawnLocations: (options) =>
      selectGameboardSpawnLocations(projectWorldToGameboardPlan(world), options),
    planSpawnGroups: (options) =>
      planGameboardSpawnGroups(projectWorldToGameboardPlan(world), options),
    planPatrolRoute: (options) =>
      planGameboardPatrolRoute(projectWorldToGameboardPlan(world), options),
    planPatrolRoutes: (options) =>
      planGameboardPatrolRoutes(projectWorldToGameboardPlan(world), options),
    inspectLayoutSites: (options = {}) =>
      inspectGameboardLayoutSites(projectWorldToGameboardPlan(world), options),
    createLayoutPlacements: (options) =>
      createGameboardLayoutPlacements(projectWorldToGameboardPlan(world), options),
    analyzeLayoutFill: (options) =>
      analyzeGameboardLayoutFill(projectWorldToGameboardPlan(world), options),
    createLayoutFillPlacements: (options) =>
      createGameboardLayoutFillPlacements(projectWorldToGameboardPlan(world), options),
    spawnLayoutPlacements: (options) => spawnGameboardLayoutPlacements(world, options),
    spawnLayoutFill: (options) => spawnGameboardLayoutFill(world, options),
    createPiecePlacementOptions: (piece, options = {}) =>
      createGameboardLayoutPlacementOptionsFromPiece(piece, options),
    createPiecePlacements: (piece, options = {}) =>
      createGameboardLayoutPlacementsFromPiece(projectWorldToGameboardPlan(world), piece, options),
    inspectPiecePlacement: (piece, options = {}) =>
      inspectGameboardPiecePlacement(projectWorldToGameboardPlan(world), piece, options),
    spawnPiece: (piece, options = {}) =>
      spawnGameboardLayoutPlacements(
        world,
        createGameboardLayoutPlacementOptionsFromPiece(piece, options)
      ),
    analyzePieceRegistry: (registry, options = {}) =>
      analyzeGameboardPieceRegistry(registry, options),
    selectPieces: (registry, selection = {}) => selectGameboardPieces(registry, selection),
    createPieceFillRules: (registry, options = {}) =>
      createGameboardLayoutFillRulesFromRegistry(registry, options),
    createPiecePoolFillRule: (pieces, options = {}) =>
      createGameboardLayoutFillRuleFromPieces(pieces, options),
    analyzePieceFills: (registry, fills, options = {}) =>
      analyzeGameboardLayoutFill(projectWorldToGameboardPlan(world), {
        seed: options.seed,
        rules: createSeededGameboardPieceFillRules(registry, fills),
      }),
    inspectPieceFills: (registry, fills, options = {}) =>
      inspectSeededGameboardPieceFills(projectWorldToGameboardPlan(world), registry, fills, options),
    spawnPieceFills: (registry, fills, options = {}) =>
      spawnGameboardLayoutFill(world, {
        seed: options.seed,
        rules: createSeededGameboardPieceFillRules(registry, fills),
      }),
    createPieceSourceUrlMap: (registry, options = {}) =>
      createGameboardPieceSourceUrlMap(registry, options),
    spawnActor: (options) => spawnGameboardActor(world, options),
    registerActor: (placement, options) => registerGameboardActor(world, placement, options),
    updateActor: (actor, options) => updateGameboardActor(world, actor, options),
    findActor: (actor) => findGameboardActor(world, actor),
    readActors: () => readGameboardActors(world),
    readActorsForTile: (coordinates) => readGameboardActorsForTile(world, coordinates),
    moveActor: (actor, to, options = {}) => moveGameboardActor(world, actor, to, options),
    spawnQuest: (definition, options = {}) => spawnGameboardQuest(world, definition, options),
    findQuest: (quest) => findGameboardQuest(world, quest),
    readQuests: () => readGameboardQuests(world),
    advanceQuest: (quest, options = {}) => advanceGameboardQuest(world, quest, options),
    advanceAllQuests: (options = {}) => advanceAllGameboardQuests(world, options),
    planCommand: (target, options = {}) => planGameboardInteractionCommand(world, target, options),
    planActorTargetCommand: (options) => planGameboardActorTargetCommand(world, options),
    previewCommand: (commandOrTarget, options = {}) =>
      previewGameboardInteractionCommand(world, commandOrTarget, options),
    dispatchCommand: (commandOrTarget, options = {}) =>
      dispatchGameboardInteractionCommand(world, commandOrTarget, options),
    dispatchActorTargetCommand: (options, commandOptions = {}) =>
      dispatchGameboardActorTargetCommand(world, options, commandOptions),
    executeCommand: (commandOrTarget, options = {}) =>
      executeGameboardInteractionCommand(world, commandOrTarget, options),
    interact: (commandOrTarget, options = {}) =>
      runGameboardInteraction(world, commandOrTarget, options),
    interactActorTarget: (options, interactionOptions = {}) =>
      runGameboardActorTargetInteraction(world, options, interactionOptions),
    tick: (options = {}) => runGameboardSystems(world, options),
  };
}

function runtimeSnapshot(
  world: World,
  options: GameboardRuntimeSnapshotOptions,
  context: GameboardRuntimeBindingContext = {}
): GameboardRuntimeSnapshot {
  const { includeInterop = true, includeValidationPlan = false, ...interopOptions } = options;
  const plan = projectWorldToGameboardPlan(world);
  return {
    state: readGameboardSnapshot(world),
    plan,
    validationPlan: includeValidationPlan ? readValidationGameboardPlanFromWorld(world) : undefined,
    placements: readGameboardPlacements(world),
    placementOccupancy: readGameboardPlacementOccupancy(world),
    actors: readGameboardActors(world),
    quests: readGameboardQuests(world),
    interop: includeInterop
      ? runtimeInteropSnapshot(world, {
          ...interopOptions,
          plan,
          scenario: context.interopScenario,
        })
      : undefined,
  };
}

function runtimeInteropSnapshot(
  world: World,
  options: GameboardRuntimeInteropOptions & {
    plan?: GameboardPlan;
    scenario?: GameboardInteropScenarioRecord;
  } = {}
): GameboardInteropSnapshot {
  const { plan, scenario, ...interopOptions } = options;
  return createGameboardRuntimeInteropSnapshot(
    {
      plan: plan ?? projectWorldToGameboardPlan(world),
      actors: readGameboardActors(world),
      quests: readGameboardQuests(world),
      scenario,
    },
    interopOptions
  );
}

function scenarioInteropRecord(scenario: GameboardScenario): GameboardInteropScenarioRecord {
  return {
    id: scenario.id,
    title: scenario.title,
    metadata: { ...(scenario.metadata ?? {}) },
  };
}

function resolveRuntimeWorld(input: CreateGameboardRuntimeInput): World {
  if (isGameboardPlan(input)) {
    return createGameboardWorld(input);
  }
  if (isRuntimeOptions(input)) {
    const world = input.world ?? createGameboardWorld();
    if (input.plan) {
      gameboardActions(world).loadPlan(input.plan);
    }
    return world;
  }
  return input;
}

function isGameboardPlan(input: CreateGameboardRuntimeInput): input is GameboardPlan {
  return (
    typeof input === 'object' &&
    input !== null &&
    Array.isArray((input as Partial<GameboardPlan>).tiles) &&
    Array.isArray((input as Partial<GameboardPlan>).placements)
  );
}

function isRuntimeOptions(
  input: CreateGameboardRuntimeInput
): input is CreateGameboardRuntimeOptions {
  return (
    typeof input === 'object' &&
    input !== null &&
    ('world' in input || 'plan' in input) &&
    !isGameboardPlan(input)
  );
}
