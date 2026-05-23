import type { Entity, World } from 'koota';
import {
  moveGameboardActor,
  planGameboardInteractionCommand,
  readGameboardActors,
  gameboardActorActions,
  inspectGameboardActorTargets,
  inspectGameboardNeighborhood,
  inspectGameboardTile,
  selectGameboardActors,
  spawnGameboardActor,
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
import type { GameboardPlan } from './gameboard';
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
  createGameboardWorld,
  gameboardActions,
  readGameboardPlacementOccupancy,
  readGameboardPlacements,
  readGameboardSnapshot,
  type GameboardEntityIndex,
  type GameboardSnapshot,
  type PlacementOccupancySnapshot,
  type PlacementStateValue,
  type SpawnGameboardPlacementOptions,
} from './koota';
import {
  type GameboardLayoutArchetypeRegistry,
  analyzeGameboardLayoutFill,
  spawnGameboardLayoutFill,
  spawnGameboardLayoutPlacements,
  type GameboardLayoutFillAnalysis,
  type GameboardLayoutFillOptions,
  type GameboardLayoutFillRule,
  type GameboardLayoutPlacementOptions,
} from './layout';
import { gameboardMovementActions } from './movement';
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
} from './projection';
import {
  gameboardQuestActions,
  readGameboardQuests,
  spawnGameboardQuest,
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
  type GameboardScenario,
  type GameboardScenarioRuntime,
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

export type GameboardActionBundle = ReturnType<typeof gameboardActions>;
export type GameboardActorActionBundle = ReturnType<typeof gameboardActorActions>;
export type GameboardMovementActionBundle = ReturnType<typeof gameboardMovementActions>;
export type GameboardPatrolActionBundle = ReturnType<typeof gameboardPatrolActions>;
export type GameboardQuestActionBundle = ReturnType<typeof gameboardQuestActions>;
export type GameboardCommandActionBundle = ReturnType<typeof gameboardCommandActions>;
export type GameboardSystemActionBundle = ReturnType<typeof gameboardSystemActions>;

export type CreateGameboardRuntimeInput =
  | GameboardPlan
  | World
  | CreateGameboardRuntimeOptions;

export interface CreateGameboardRuntimeOptions {
  world?: World;
  plan?: GameboardPlan;
}

interface GameboardRuntimeBindingContext {
  interopScenario?: GameboardInteropScenarioRecord;
}

export interface GameboardRuntimeSnapshotOptions extends GameboardInteropOptions {
  includeInterop?: boolean;
  includeValidationPlan?: boolean;
}

export interface GameboardRuntimeSnapshot {
  state: GameboardSnapshot;
  plan: GameboardPlan;
  validationPlan?: GameboardPlan;
  placements: readonly PlacementStateValue[];
  placementOccupancy: readonly PlacementOccupancySnapshot[];
  actors: readonly GameboardActorSnapshot[];
  quests: readonly GameboardQuestSnapshot[];
  interop?: GameboardInteropSnapshot;
}

export interface GameboardRuntime {
  readonly world: World;
  readonly actions: GameboardActionBundle;
  readonly actors: GameboardActorActionBundle;
  readonly movement: GameboardMovementActionBundle;
  readonly patrol: GameboardPatrolActionBundle;
  readonly quests: GameboardQuestActionBundle;
  readonly commands: GameboardCommandActionBundle;
  readonly systems: GameboardSystemActionBundle;
  loadPlan: (plan: GameboardPlan) => GameboardEntityIndex;
  plan: () => GameboardPlan;
  validationPlan: () => GameboardPlan;
  snapshot: (options?: GameboardRuntimeSnapshotOptions) => GameboardRuntimeSnapshot;
  inspectTile: (
    coordinates: SpawnGameboardActorOptions['at'],
    options?: GameboardTileInspectionOptions
  ) => GameboardTileInspection;
  inspectNeighborhood: (
    center: GameboardNeighborhoodCenter,
    options?: GameboardNeighborhoodInspectionOptions
  ) => GameboardNeighborhoodInspection;
  selectActors: (options?: GameboardActorSelectionOptions) => GameboardActorSelection;
  inspectActorTargets: (options: GameboardActorTargetingOptions) => GameboardActorTargetingReport;
  createInteropSnapshot: (options?: GameboardRuntimeInteropOptions) => GameboardInteropSnapshot;
  mountInterop: <TEntity>(
    adapter: GameboardEcsAdapter<TEntity>,
    options?: GameboardRuntimeInteropOptions
  ) => GameboardEcsMountResult<TEntity>;
  spawnLayoutPlacements: (options: GameboardLayoutPlacementOptions) => Entity[];
  spawnLayoutFill: (options: GameboardLayoutFillOptions) => Entity[];
  createPiecePlacementOptions: (
    piece: GameboardPieceDeclaration,
    options?: GameboardPiecePlacementOptions
  ) => GameboardLayoutPlacementOptions;
  createPiecePlacements: (
    piece: GameboardPieceDeclaration,
    options?: GameboardPiecePlacementOptions
  ) => SpawnGameboardPlacementOptions[];
  inspectPiecePlacement: (
    piece: GameboardPieceDeclaration,
    options?: GameboardPiecePlacementOptions
  ) => GameboardPiecePlacementInspection;
  spawnPiece: (
    piece: GameboardPieceDeclaration,
    options?: GameboardPiecePlacementOptions
  ) => Entity[];
  analyzePieceRegistry: (
    registry: GameboardPieceRegistry,
    options?: AnalyzeGameboardPieceRegistryOptions
  ) => GameboardPieceRegistryAnalysis;
  selectPieces: (
    registry: GameboardPieceRegistry,
    selection?: GameboardPieceRegistrySelection
  ) => GameboardPieceDeclaration[];
  createPieceFillRules: (
    registry: GameboardPieceRegistry,
    options?: GameboardPieceRegistryFillRulesOptions
  ) => GameboardLayoutFillRule[];
  createPiecePoolFillRule: (
    pieces: readonly GameboardPieceDeclaration[],
    options?: GameboardPieceCollectionLayoutRuleOptions
  ) => GameboardLayoutFillRule;
  analyzePieceFills: (
    registry: GameboardPieceRegistry,
    fills: readonly SeededGameboardPieceFillOptions[],
    options?: InspectSeededGameboardPieceFillsOptions
  ) => GameboardLayoutFillAnalysis;
  inspectPieceFills: (
    registry: GameboardPieceRegistry,
    fills: readonly SeededGameboardPieceFillOptions[],
    options?: InspectSeededGameboardPieceFillsOptions
  ) => SeededGameboardPieceFillInspection;
  spawnPieceFills: (
    registry: GameboardPieceRegistry,
    fills: readonly SeededGameboardPieceFillOptions[],
    options?: InspectSeededGameboardPieceFillsOptions
  ) => Entity[];
  createPieceSourceUrlMap: (
    registry: GameboardPieceRegistry,
    options?: GameboardPieceSourceUrlOptions
  ) => Readonly<Record<string, string>>;
  spawnActor: (options: SpawnGameboardActorOptions) => Entity;
  moveActor: (
    actor: Entity | string,
    to: SpawnGameboardActorOptions['at'],
    options?: MoveGameboardActorOptions
  ) => Entity;
  spawnQuest: (
    definition: GameboardQuestDefinition,
    options?: SpawnGameboardQuestOptions
  ) => Entity;
  planCommand: (
    target: GameboardInteractionTargetInput,
    options?: GameboardInteractionCommandOptions
  ) => GameboardInteractionCommand;
  planActorTargetCommand: (
    options: GameboardActorTargetCommandOptions
  ) => GameboardActorTargetCommandPlan;
  previewCommand: (
    commandOrTarget: GameboardInteractionCommandInput,
    options?: GameboardInteractionCommandPreviewOptions
  ) => GameboardInteractionCommandPreview;
  dispatchCommand: (
    commandOrTarget: GameboardInteractionCommandInput,
    options?: DispatchGameboardInteractionCommandOptions
  ) => DispatchGameboardInteractionCommandResult;
  dispatchActorTargetCommand: (
    options: GameboardActorTargetCommandOptions,
    commandOptions?: DispatchGameboardInteractionCommandOptions
  ) => DispatchGameboardActorTargetCommandResult;
  executeCommand: (
    commandOrTarget: GameboardInteractionCommandInput,
    options?: GameboardInteractionCommandExecutionOptions
  ) => GameboardInteractionCommandExecution;
  interact: (
    commandOrTarget: GameboardInteractionCommandInput,
    options?: RunGameboardInteractionOptions
  ) => RunGameboardInteractionResult;
  interactActorTarget: (
    options: GameboardActorTargetCommandOptions,
    interactionOptions?: RunGameboardInteractionOptions
  ) => RunGameboardActorTargetInteractionResult;
  tick: (options?: RunGameboardSystemsOptions) => RunGameboardSystemsResult;
}

export interface GameboardScenarioGameRuntime extends GameboardRuntime {
  readonly scenarioRuntime: GameboardScenarioRuntime;
  readonly actorEntities: GameboardScenarioRuntime['actorEntities'];
  readonly questEntities: GameboardScenarioRuntime['questEntities'];
  readonly scenarioLayoutArchetypes?: GameboardLayoutArchetypeRegistry;
  readonly scenarioPieceRegistry?: GameboardPieceRegistry;
  createScenarioInteropSnapshot: (
    options?: GameboardScenarioInteropOptions
  ) => GameboardInteropSnapshot;
  mountScenarioInterop: <TEntity>(
    adapter: GameboardEcsAdapter<TEntity>,
    options?: GameboardScenarioInteropOptions
  ) => GameboardEcsMountResult<TEntity>;
  createScenarioPieceSourceUrlMap: (
    options?: GameboardPieceSourceUrlOptions
  ) => Readonly<Record<string, string>>;
}

export interface GameboardRecipeGameRuntime extends GameboardRuntime {
  readonly recipe: GameboardRecipe;
  readonly recipeLayoutArchetypes?: GameboardLayoutArchetypeRegistry;
  readonly recipePieceRegistry?: GameboardPieceRegistry;
  createRecipePieceSourceUrlMap: (
    options?: GameboardPieceSourceUrlOptions
  ) => Readonly<Record<string, string>>;
}

export function createGameboardRuntime(input: CreateGameboardRuntimeInput): GameboardRuntime {
  const world = resolveRuntimeWorld(input);
  return bindGameboardRuntime(world);
}

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
    scenarioLayoutArchetypes,
    scenarioPieceRegistry,
    createScenarioInteropSnapshot: (options = {}) =>
      createGameboardScenarioInteropSnapshot(scenario, options),
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
    validationPlan: () => readValidationGameboardPlanFromWorld(world),
    snapshot: (options = {}) => runtimeSnapshot(world, options, context),
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
    moveActor: (actor, to, options = {}) => moveGameboardActor(world, actor, to, options),
    spawnQuest: (definition, options = {}) => spawnGameboardQuest(world, definition, options),
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
