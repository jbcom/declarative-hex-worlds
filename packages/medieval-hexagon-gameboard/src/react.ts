import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  useQuery,
  useTargets,
  useTrait,
  useWorld,
  WorldProvider as MedievalGameboardProvider,
} from 'koota/react';
import { hexKey } from './coordinates';
import type { GameboardPlan } from './gameboard';
import {
  AdjacentTo,
  GameboardState,
  HexTileState,
  IsGameboardPlacement,
  IsGameboardTile,
  IsHarborPlacement,
  IsRoadPlacement,
  IsRiverPlacement,
  IsStackedTerrain,
  PlacementOnTile,
  PlacementOccupiesTile,
  PlacementState,
  TileConnectivity,
  TileCoordinates,
  TileElevation,
  TileRenderState,
  TileTagList,
  TileTerrain,
  gameboardActions,
  inspectGameboardPlacementOccupancy,
  readGameboardPlacementOccupancy,
  readGameboardPlacements,
  readPlacementOccupancyForTile,
  type GameboardPlacementOccupancyInspection,
  type GameboardStateValue,
  type HexTileStateValue,
  type InspectGameboardPlacementOccupancyOptions,
  type PlacementOccupancySnapshot,
  type PlacementStateValue,
  type SpawnGameboardPlacementOptions,
  type TileConnectivityValue,
  type TileCoordinatesValue,
  type TileElevationValue,
  type TileRenderStateValue,
  type TileTagListValue,
  type TileTerrainValue,
} from './koota';
import { projectWorldToGameboardPlan } from './projection';
import type { GameboardRuleConfig, GameboardRuleViolation } from './rule-types';
import { validateGameboardRules } from './world-rules';
import {
  IsMoving,
  MovementAgent,
  MovementPathState,
  gameboardMovementActions,
  type MovementAgentValue,
  type MovementPathStateValue,
} from './movement';
import {
  GameboardActor,
  IsGameboardActor,
  gameboardActorActions,
  inspectGameboardActorTargets,
  inspectGameboardNeighborhood,
  inspectGameboardTile,
  inspectGameboardInteractionTarget,
  planGameboardInteractionCommand,
  readGameboardActors,
  readGameboardActorsForTile,
  selectGameboardActors,
  type GameboardActorSnapshot,
  type GameboardActorSelection,
  type GameboardActorSelectionOptions,
  type GameboardActorTargetingOptions,
  type GameboardActorTargetingReport,
  type GameboardActorValue,
  type GameboardInteractionCommand,
  type GameboardInteractionCommandOptions,
  type GameboardInteractionTargetInput,
  type GameboardInteractionTargetOptions,
  type GameboardInteractionTargetReport,
  type GameboardNeighborhoodCenter,
  type GameboardNeighborhoodInspection,
  type GameboardNeighborhoodInspectionOptions,
  type GameboardTileInspection,
  type GameboardTileInspectionOptions,
} from './actors';
import {
  gameboardCommandActions,
  planGameboardActorTargetCommand,
  type GameboardActorTargetCommandOptions,
  type GameboardActorTargetCommandPlan,
  previewGameboardInteractionCommand,
  type GameboardInteractionCommandInput,
  type GameboardInteractionCommandPreview,
  type GameboardInteractionCommandPreviewOptions,
} from './commands';
import {
  GameboardQuest,
  IsGameboardQuest,
  gameboardQuestActions,
  readGameboardQuests,
  type GameboardQuestSnapshot,
  type GameboardQuestValue,
} from './quests';
import {
  GameboardPatrolAgent,
  GameboardPatrolState,
  IsGameboardPatrolAgent,
  gameboardPatrolActions,
  type GameboardPatrolAgentValue,
  type GameboardPatrolStateValue,
} from './patrol';
import {
  createGameboardRuntime,
  createGameboardRuntimeFromRecipe,
  createGameboardRuntimeFromScenario,
  type GameboardRecipeGameRuntime,
  type GameboardRuntime,
  type GameboardRuntimeSnapshot,
  type GameboardRuntimeSnapshotOptions,
  type GameboardScenarioGameRuntime,
} from './runtime';
import { gameboardSystemActions } from './systems';
import {
  createGameboardNavigation,
  createGameboardOccupancyIndex,
  planGameboardPatrolRoute,
  planGameboardPatrolRoutes,
  selectGameboardSpawnLocations,
  type GameboardNavigation,
  type GameboardNavigationProfile,
  type GameboardOccupancyIndex,
  type GameboardPatrolRouteOptions,
  type GameboardPatrolRoutePlan,
  type GameboardPatrolRouteSet,
  type GameboardPatrolRouteSetOptions,
  type GameboardSpawnLocationOptions,
} from './navigation';
import {
  analyzeGameboardLayoutFill,
  createGameboardLayoutPlacements,
  inspectGameboardLayoutSites,
  type GameboardLayoutFillAnalysis,
  type GameboardLayoutFillOptions,
  type GameboardLayoutPlacementOptions,
  type GameboardLayoutSiteInspection,
  type InspectGameboardLayoutSitesOptions,
} from './layout';
import {
  analyzeGameboardPieceRegistry,
  createGameboardPieceSourceUrlMap,
  inspectGameboardPiecePlacement,
  selectGameboardPieces,
  type AnalyzeGameboardPieceRegistryOptions,
  type GameboardPieceDeclaration,
  type GameboardPiecePlacementInspection,
  type GameboardPiecePlacementOptions,
  type GameboardPieceRegistry,
  type GameboardPieceRegistryAnalysis,
  type GameboardPieceRegistrySelection,
  type GameboardPieceSourceUrlOptions,
} from './pieces';
import {
  inspectSeededGameboardPieceFills,
  type InspectSeededGameboardPieceFillsOptions,
  type SeededGameboardPieceFillInspection,
  type SeededGameboardPieceFillOptions,
} from './rules';
import type { Entity, World } from 'koota';
import type { SpawnLocation } from './grid';
import type { HexCoordinates } from './types';
import type { GameboardRecipe, GameboardRecipePlanOptionsOverride } from './recipe';
import type { GameboardScenario } from './scenario';

export { MedievalGameboardProvider, useWorld as useGameboardWorld };

const DEFAULT_RULE_CONFIG = {} as const satisfies GameboardRuleConfig;
const DEFAULT_NAVIGATION_PROFILE_OPTIONS = {} as const satisfies GameboardNavigationProfile;
const DEFAULT_LAYOUT_SITE_INSPECTION_OPTIONS = {} as const satisfies InspectGameboardLayoutSitesOptions;
const DEFAULT_PIECE_REGISTRY_ANALYSIS_OPTIONS = {} as const satisfies AnalyzeGameboardPieceRegistryOptions;
const DEFAULT_PIECE_REGISTRY_SELECTION = {} as const satisfies GameboardPieceRegistrySelection;
const DEFAULT_PIECE_PLACEMENT_OPTIONS = {} as const satisfies GameboardPiecePlacementOptions;
const DEFAULT_PIECE_FILL_INSPECTION_OPTIONS = {} as const satisfies InspectSeededGameboardPieceFillsOptions;
const DEFAULT_PIECE_SOURCE_URL_OPTIONS = {} as const satisfies GameboardPieceSourceUrlOptions;
const DEFAULT_RUNTIME_SNAPSHOT_OPTIONS = {} as const satisfies GameboardRuntimeSnapshotOptions;
const EMPTY_PLACEMENT_OPTIONS = [] as const satisfies readonly SpawnGameboardPlacementOptions[];
const EMPTY_PIECE_SELECTION = [] as const satisfies readonly GameboardPieceDeclaration[];
const EMPTY_SOURCE_URL_MAP = {} as const satisfies Readonly<Record<string, string>>;
const GameboardRuntimeContext = createContext<GameboardRuntime | undefined>(undefined);

/**
 * Props for mounting an already-created runtime in React.
 *
 * Use this when the scene, router, save loader, or test harness owns runtime
 * creation and React should consume the same Koota world plus recipe/scenario
 * helpers.
 */
export interface GameboardRuntimeProviderProps<TRuntime extends GameboardRuntime = GameboardRuntime> {
  /** Runtime facade for the board instance mounted below this provider. */
  runtime: TRuntime;
  /** React children that should read the runtime's Koota world. */
  children?: ReactNode;
}

/**
 * Props for mounting a serializable plan directly in React.
 */
export interface MedievalGameboardPlanProviderProps {
  /** Plan to load into a newly created runtime for this provider instance. */
  plan: GameboardPlan;
  /** React children that should read the created runtime and world. */
  children?: ReactNode;
}

/**
 * Props for compiling a recipe and mounting the resulting runtime in React.
 */
export interface MedievalGameboardRecipeProviderProps {
  /** Recipe to compile into a live runtime. */
  recipe: GameboardRecipe;
  /** Optional plan-generation overrides applied while compiling the recipe. */
  overrides?: GameboardRecipePlanOptionsOverride;
  /** React children that should read the created runtime and world. */
  children?: ReactNode;
}

/**
 * Props for compiling a scenario and mounting the resulting runtime in React.
 */
export interface MedievalGameboardScenarioProviderProps {
  /** Scenario containing the board recipe plus actors, patrols, movement, and quests. */
  scenario: GameboardScenario;
  /** Optional recipe overrides applied while compiling the scenario board. */
  overrides?: GameboardRecipePlanOptionsOverride;
  /** React children that should read the created runtime and world. */
  children?: ReactNode;
}

type MedievalGameboardProviderComponent = ComponentType<{
  world: World;
  children?: ReactNode;
}>;

/**
 * Mount a runtime facade and expose its Koota world through `koota/react`.
 *
 * This is the preferred provider when runtime creation happens outside React,
 * because `useGameboardRuntime` returns the same object with scenario/recipe
 * registries, source URL helpers, and live mutation methods intact.
 */
export function GameboardRuntimeProvider<TRuntime extends GameboardRuntime = GameboardRuntime>({
  runtime,
  children,
}: GameboardRuntimeProviderProps<TRuntime>): ReturnType<typeof createElement> {
  const Provider = MedievalGameboardProvider as MedievalGameboardProviderComponent;
  return createElement(
    GameboardRuntimeContext.Provider,
    { value: runtime },
    createElement(Provider, { world: runtime.world }, children)
  );
}

/**
 * Create and mount a runtime from a prebuilt `GameboardPlan`.
 */
export function MedievalGameboardPlanProvider({
  plan,
  children,
}: MedievalGameboardPlanProviderProps): ReturnType<typeof createElement> {
  const runtime = useMemo(() => createGameboardRuntime(plan), [plan]);
  return createElement(GameboardRuntimeProvider, { runtime }, children);
}

/**
 * Compile a recipe, create a runtime, and mount it for React consumers.
 */
export function MedievalGameboardRecipeProvider({
  recipe,
  overrides = {},
  children,
}: MedievalGameboardRecipeProviderProps): ReturnType<typeof createElement> {
  const runtime = useMemo(
    () => createGameboardRuntimeFromRecipe(recipe, overrides),
    [recipe, overrides]
  );
  return createElement(GameboardRuntimeProvider<GameboardRecipeGameRuntime>, { runtime }, children);
}

/**
 * Compile a scenario, create a runtime, and mount it for React consumers.
 *
 * The runtime returned by `useGameboardRuntime` keeps scenario actor/quest
 * indexes, spawn groups, patrol plans, and local source URL helpers available.
 */
export function MedievalGameboardScenarioProvider({
  scenario,
  overrides = {},
  children,
}: MedievalGameboardScenarioProviderProps): ReturnType<typeof createElement> {
  const runtime = useMemo(
    () => createGameboardRuntimeFromScenario(scenario, overrides),
    [scenario, overrides]
  );
  return createElement(GameboardRuntimeProvider<GameboardScenarioGameRuntime>, { runtime }, children);
}

function useGameboardDerivedRevision(): number {
  const world = useWorld();
  const [revision, bumpRevision] = useReducer(
    (value: number) => (value + 1) % Number.MAX_SAFE_INTEGER,
    0
  );

  useEffect(() => {
    const update = () => bumpRevision();
    const unsubscribers = [
      world.onAdd(GameboardState, update),
      world.onRemove(GameboardState, update),
      world.onChange(GameboardState, update),
      world.onAdd(HexTileState, update),
      world.onRemove(HexTileState, update),
      world.onChange(HexTileState, update),
      world.onAdd(TileCoordinates, update),
      world.onRemove(TileCoordinates, update),
      world.onChange(TileCoordinates, update),
      world.onAdd(TileTerrain, update),
      world.onRemove(TileTerrain, update),
      world.onChange(TileTerrain, update),
      world.onAdd(TileElevation, update),
      world.onRemove(TileElevation, update),
      world.onChange(TileElevation, update),
      world.onAdd(TileConnectivity, update),
      world.onRemove(TileConnectivity, update),
      world.onChange(TileConnectivity, update),
      world.onAdd(TileRenderState, update),
      world.onRemove(TileRenderState, update),
      world.onChange(TileRenderState, update),
      world.onAdd(TileTagList, update),
      world.onRemove(TileTagList, update),
      world.onChange(TileTagList, update),
      world.onAdd(PlacementState, update),
      world.onRemove(PlacementState, update),
      world.onChange(PlacementState, update),
      world.onAdd(PlacementOnTile, update),
      world.onRemove(PlacementOnTile, update),
      world.onChange(PlacementOnTile, update),
      world.onAdd(PlacementOccupiesTile, update),
      world.onRemove(PlacementOccupiesTile, update),
      world.onChange(PlacementOccupiesTile, update),
      world.onAdd(GameboardActor, update),
      world.onRemove(GameboardActor, update),
      world.onChange(GameboardActor, update),
      world.onAdd(MovementAgent, update),
      world.onRemove(MovementAgent, update),
      world.onChange(MovementAgent, update),
      world.onAdd(MovementPathState, update),
      world.onRemove(MovementPathState, update),
      world.onChange(MovementPathState, update),
      world.onAdd(GameboardQuest, update),
      world.onRemove(GameboardQuest, update),
      world.onChange(GameboardQuest, update),
      world.onAdd(GameboardPatrolAgent, update),
      world.onRemove(GameboardPatrolAgent, update),
      world.onChange(GameboardPatrolAgent, update),
      world.onAdd(GameboardPatrolState, update),
      world.onRemove(GameboardPatrolState, update),
      world.onChange(GameboardPatrolState, update),
    ];

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [world]);

  return revision;
}

export function useGameboardState(): GameboardStateValue | undefined {
  return useTrait(useWorld(), GameboardState);
}

export function useGameboardActions(): ReturnType<typeof gameboardActions> {
  const world = useWorld();
  return useMemo(() => gameboardActions(world), [world]);
}

export function useGameboardMovementActions(): ReturnType<typeof gameboardMovementActions> {
  const world = useWorld();
  return useMemo(() => gameboardMovementActions(world), [world]);
}

export function useGameboardActorActions(): ReturnType<typeof gameboardActorActions> {
  const world = useWorld();
  return useMemo(() => gameboardActorActions(world), [world]);
}

export function useGameboardQuestActions(): ReturnType<typeof gameboardQuestActions> {
  const world = useWorld();
  return useMemo(() => gameboardQuestActions(world), [world]);
}

export function useGameboardPatrolActions(): ReturnType<typeof gameboardPatrolActions> {
  const world = useWorld();
  return useMemo(() => gameboardPatrolActions(world), [world]);
}

export function useGameboardCommandActions(): ReturnType<typeof gameboardCommandActions> {
  const world = useWorld();
  return useMemo(() => gameboardCommandActions(world), [world]);
}

export function useGameboardSystemActions(): ReturnType<typeof gameboardSystemActions> {
  const world = useWorld();
  return useMemo(() => gameboardSystemActions(world), [world]);
}

/**
 * Return the runtime facade associated with the current React provider.
 *
 * If no runtime provider was mounted, the hook binds a facade to the current
 * Koota world. Use `GameboardRuntimeProvider` or the plan/recipe/scenario
 * providers when components need runtime-specific helpers such as source URL
 * maps, scenario indexes, or saved recipe registries.
 */
export function useGameboardRuntime<TRuntime extends GameboardRuntime = GameboardRuntime>(): TRuntime {
  const world = useWorld();
  const providedRuntime = useContext(GameboardRuntimeContext);
  return useMemo(
    () => (providedRuntime ?? createGameboardRuntime(world)) as TRuntime,
    [providedRuntime, world]
  );
}

/**
 * Read the current runtime snapshot and rerender when gameboard traits,
 * relations, actor state, movement state, patrol state, or quest state changes.
 *
 * This is the React equivalent of `runtime.snapshot()`. Use it for HUDs,
 * inspectors, test probes, and render adapters that want a serializable view of
 * live board state instead of raw Koota trait access.
 */
export function useGameboardRuntimeSnapshot(
  options: GameboardRuntimeSnapshotOptions = DEFAULT_RUNTIME_SNAPSHOT_OPTIONS
): GameboardRuntimeSnapshot {
  const runtime = useGameboardRuntime();
  const revision = useGameboardDerivedRevision();
  return useMemo(() => {
    void revision;
    return runtime.snapshot(options);
  }, [runtime, options, revision]);
}

/**
 * Read serializable placement snapshots for React panels and external stores.
 *
 * The hook subscribes to placement trait and relation changes, including in
 * place movement updates where the set of placement entities does not change.
 */
export function useGameboardPlacementSnapshots(): readonly PlacementStateValue[] {
  const world = useWorld();
  const placements = useGameboardPlacementEntities();
  const revision = useGameboardDerivedRevision();
  return useMemo(() => {
    void revision;
    void placements.length;
    return readGameboardPlacements(world);
  }, [world, placements, revision]);
}

/**
 * Read joined actor and placement snapshots for React panels and UI state.
 *
 * The returned records are the same actor snapshots used by runtime reads and
 * external ECS interop, which keeps HUDs, targeting panels, and tests aligned.
 */
export function useGameboardActorSnapshots(): readonly GameboardActorSnapshot[] {
  const world = useWorld();
  const actors = useGameboardActorEntities();
  const revision = useGameboardDerivedRevision();
  return useMemo(() => {
    void revision;
    void actors.length;
    return readGameboardActors(world);
  }, [world, actors, revision]);
}

/**
 * Read actor snapshots whose placement origin is one tile.
 *
 * Use this when hover panels, tile inspectors, collision probes, or ECS mirrors
 * need actor kind, team, hostility, tags, and interaction flags for a single
 * hex without filtering the whole actor list in component code.
 */
export function useGameboardActorsForTile(
  coordinates: HexCoordinates | string
): readonly GameboardActorSnapshot[] {
  const world = useWorld();
  const actors = useGameboardActorEntities();
  const revision = useGameboardDerivedRevision();
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  return useMemo(() => {
    void revision;
    void actors.length;
    return readGameboardActorsForTile(world, key);
  }, [world, key, actors, revision]);
}

/**
 * Read quest snapshots for React quest logs, HUDs, and integration mirrors.
 *
 * The hook rerenders when quest state changes or when related actor movement
 * changes may complete reach, interaction, collision, or defeat objectives.
 */
export function useGameboardQuestSnapshots(): readonly GameboardQuestSnapshot[] {
  const world = useWorld();
  const quests = useGameboardQuestEntities();
  const revision = useGameboardDerivedRevision();
  return useMemo(() => {
    void revision;
    void quests.length;
    return readGameboardQuests(world);
  }, [world, quests, revision]);
}

export function useGameboardInteractionTarget(
  target: GameboardInteractionTargetInput | undefined,
  options: GameboardInteractionTargetOptions = {}
): GameboardInteractionTargetReport | undefined {
  const world = useWorld();
  const tiles = useGameboardTileEntities();
  const placements = useGameboardPlacementEntities();
  const actors = useGameboardActorEntities();
  return useMemo(() => {
    void tiles.length;
    void placements.length;
    void actors.length;
    return target ? inspectGameboardInteractionTarget(world, target, options) : undefined;
  }, [world, target, options, tiles, placements, actors]);
}

export function useGameboardInteractionCommand(
  target: GameboardInteractionTargetInput | undefined,
  options: GameboardInteractionCommandOptions = {}
): GameboardInteractionCommand | undefined {
  const world = useWorld();
  const tiles = useGameboardTileEntities();
  const placements = useGameboardPlacementEntities();
  const actors = useGameboardActorEntities();
  return useMemo(() => {
    void tiles.length;
    void placements.length;
    void actors.length;
    return target ? planGameboardInteractionCommand(world, target, options) : undefined;
  }, [world, target, options, tiles, placements, actors]);
}

export function useGameboardInteractionCommandPreview(
  commandOrTarget: GameboardInteractionCommandInput | undefined,
  options: GameboardInteractionCommandPreviewOptions = {}
): GameboardInteractionCommandPreview | undefined {
  const world = useWorld();
  const tiles = useGameboardTileEntities();
  const placements = useGameboardPlacementEntities();
  const actors = useGameboardActorEntities();
  return useMemo(() => {
    void tiles.length;
    void placements.length;
    void actors.length;
    return commandOrTarget
      ? previewGameboardInteractionCommand(world, commandOrTarget, options)
      : undefined;
  }, [world, commandOrTarget, options, tiles, placements, actors]);
}

export function useGameboardTileInspection(
  coordinates: HexCoordinates | string,
  options: GameboardTileInspectionOptions = {}
): GameboardTileInspection {
  const world = useWorld();
  const revision = useGameboardDerivedRevision();
  const tileKey = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  return useMemo(() => {
    void revision;
    return inspectGameboardTile(world, tileKey, options);
  }, [world, tileKey, options, revision]);
}

export function useGameboardNeighborhoodInspection(
  center: GameboardNeighborhoodCenter,
  options: GameboardNeighborhoodInspectionOptions = {}
): GameboardNeighborhoodInspection {
  const world = useWorld();
  const revision = useGameboardDerivedRevision();
  return useMemo(() => {
    void revision;
    return inspectGameboardNeighborhood(world, center, options);
  }, [world, center, options, revision]);
}

export function useGameboardActorSelection(
  options: GameboardActorSelectionOptions = {}
): GameboardActorSelection {
  const world = useWorld();
  const revision = useGameboardDerivedRevision();
  return useMemo(() => {
    void revision;
    return selectGameboardActors(world, options);
  }, [world, options, revision]);
}

export function useGameboardActorTargets(
  options: GameboardActorTargetingOptions | undefined
): GameboardActorTargetingReport | undefined {
  const world = useWorld();
  const revision = useGameboardDerivedRevision();
  return useMemo(() => {
    void revision;
    return options ? inspectGameboardActorTargets(world, options) : undefined;
  }, [world, options, revision]);
}

export function useGameboardActorTargetCommand(
  options: GameboardActorTargetCommandOptions | undefined
): GameboardActorTargetCommandPlan | undefined {
  const world = useWorld();
  const revision = useGameboardDerivedRevision();
  return useMemo(() => {
    void revision;
    return options ? planGameboardActorTargetCommand(world, options) : undefined;
  }, [world, options, revision]);
}

export function useGameboardTileEntities(): readonly Entity[] {
  return useQuery(IsGameboardTile, HexTileState);
}

export function useDecomposedTileEntities(): readonly Entity[] {
  return useQuery(
    IsGameboardTile,
    TileCoordinates,
    TileTerrain,
    TileElevation,
    TileConnectivity,
    TileRenderState,
    TileTagList
  );
}

export function useGameboardPlacementEntities(): readonly Entity[] {
  return useQuery(IsGameboardPlacement, PlacementState);
}

export function useRoadPlacementEntities(): readonly Entity[] {
  return useQuery(IsRoadPlacement, PlacementState);
}

export function useRiverPlacementEntities(): readonly Entity[] {
  return useQuery(IsRiverPlacement, PlacementState);
}

export function useHarborPlacementEntities(): readonly Entity[] {
  return useQuery(IsHarborPlacement, PlacementState);
}

export function useStackedTerrainEntities(): readonly Entity[] {
  return useQuery(IsStackedTerrain, PlacementState);
}

export function useMovingPlacementEntities(): readonly Entity[] {
  return useQuery(IsMoving, PlacementState, MovementPathState);
}

export function useGameboardActorEntities(): readonly Entity[] {
  return useQuery(IsGameboardActor, PlacementState, GameboardActor);
}

export function useGameboardQuestEntities(): readonly Entity[] {
  return useQuery(IsGameboardQuest, GameboardQuest);
}

export function useGameboardPatrolAgentEntities(): readonly Entity[] {
  return useQuery(
    IsGameboardPatrolAgent,
    PlacementState,
    GameboardPatrolAgent,
    GameboardPatrolState
  );
}

export function useTileState(entity: Entity | undefined | null): HexTileStateValue | undefined {
  return useTrait(entity, HexTileState);
}

export function useTileCoordinates(
  entity: Entity | undefined | null
): TileCoordinatesValue | undefined {
  return useTrait(entity, TileCoordinates);
}

export function useTileTerrain(entity: Entity | undefined | null): TileTerrainValue | undefined {
  return useTrait(entity, TileTerrain);
}

export function useTileElevation(
  entity: Entity | undefined | null
): TileElevationValue | undefined {
  return useTrait(entity, TileElevation);
}

export function useTileConnectivity(
  entity: Entity | undefined | null
): TileConnectivityValue | undefined {
  return useTrait(entity, TileConnectivity);
}

export function useTileRenderState(
  entity: Entity | undefined | null
): TileRenderStateValue | undefined {
  return useTrait(entity, TileRenderState);
}

export function useTileTagList(entity: Entity | undefined | null): TileTagListValue | undefined {
  return useTrait(entity, TileTagList);
}

export function useAdjacentTileEntities(entity: Entity | undefined | null): readonly Entity[] {
  return useTargets(entity, AdjacentTo);
}

export function usePlacementState(
  entity: Entity | undefined | null
): PlacementStateValue | undefined {
  return useTrait(entity, PlacementState);
}

export function useMovementAgent(
  entity: Entity | undefined | null
): MovementAgentValue | undefined {
  return useTrait(entity, MovementAgent);
}

export function useMovementPathState(
  entity: Entity | undefined | null
): MovementPathStateValue | undefined {
  return useTrait(entity, MovementPathState);
}

export function useGameboardActor(
  entity: Entity | undefined | null
): GameboardActorValue | undefined {
  return useTrait(entity, GameboardActor);
}

export function useGameboardQuest(
  entity: Entity | undefined | null
): GameboardQuestValue | undefined {
  return useTrait(entity, GameboardQuest);
}

export function useGameboardPatrolAgent(
  entity: Entity | undefined | null
): GameboardPatrolAgentValue | undefined {
  return useTrait(entity, GameboardPatrolAgent);
}

export function useGameboardPatrolState(
  entity: Entity | undefined | null
): GameboardPatrolStateValue | undefined {
  return useTrait(entity, GameboardPatrolState);
}

export function useProjectedGameboardPlan(): GameboardPlan | undefined {
  const world = useWorld();
  const state = useGameboardState();
  const tiles = useDecomposedTileEntities();
  const placements = useGameboardPlacementEntities();
  const revision = useGameboardDerivedRevision();
  return useMemo(() => {
    void revision;
    void tiles.length;
    void placements.length;
    return state ? projectWorldToGameboardPlan(world) : undefined;
  }, [world, state, tiles, placements, revision]);
}

export function useGameboardOccupancyIndex(
  profile: GameboardNavigationProfile = DEFAULT_NAVIGATION_PROFILE_OPTIONS
): GameboardOccupancyIndex | undefined {
  const plan = useProjectedGameboardPlan();
  return useMemo(
    () => (plan ? createGameboardOccupancyIndex(plan, profile) : undefined),
    [plan, profile]
  );
}

export function useGameboardNavigation(
  profile: GameboardNavigationProfile = DEFAULT_NAVIGATION_PROFILE_OPTIONS
): GameboardNavigation | undefined {
  const plan = useProjectedGameboardPlan();
  return useMemo(
    () => (plan ? createGameboardNavigation(plan, profile) : undefined),
    [plan, profile]
  );
}

export function useGameboardSpawnLocations(
  options: GameboardSpawnLocationOptions | undefined
): readonly SpawnLocation[] {
  const plan = useProjectedGameboardPlan();
  return useMemo(
    () => (plan && options ? selectGameboardSpawnLocations(plan, options) : []),
    [plan, options]
  );
}

export function useGameboardPatrolRoute(
  options: GameboardPatrolRouteOptions | undefined
): GameboardPatrolRoutePlan | undefined {
  const plan = useProjectedGameboardPlan();
  return useMemo(
    () => (plan && options ? planGameboardPatrolRoute(plan, options) : undefined),
    [plan, options]
  );
}

export function useGameboardPatrolRoutes(
  options: GameboardPatrolRouteSetOptions | undefined
): GameboardPatrolRouteSet | undefined {
  const plan = useProjectedGameboardPlan();
  return useMemo(
    () => (plan && options ? planGameboardPatrolRoutes(plan, options) : undefined),
    [plan, options]
  );
}

/**
 * Inspect layout sites for the current projected board without mutating Koota
 * state.
 */
export function useGameboardLayoutSiteInspection(
  options: InspectGameboardLayoutSitesOptions = DEFAULT_LAYOUT_SITE_INSPECTION_OPTIONS
): GameboardLayoutSiteInspection | undefined {
  const plan = useProjectedGameboardPlan();
  return useMemo(() => (plan ? inspectGameboardLayoutSites(plan, options) : undefined), [plan, options]);
}

/**
 * Analyze seeded layout fill rules against the current projected board.
 */
export function useGameboardLayoutFillAnalysis(
  options: GameboardLayoutFillOptions | undefined
): GameboardLayoutFillAnalysis | undefined {
  const plan = useProjectedGameboardPlan();
  return useMemo(() => (plan && options ? analyzeGameboardLayoutFill(plan, options) : undefined), [plan, options]);
}

/**
 * Preview layout placement options for the current projected board without
 * spawning entities.
 */
export function useGameboardLayoutPlacements(
  options: GameboardLayoutPlacementOptions | undefined
): readonly SpawnGameboardPlacementOptions[] {
  const plan = useProjectedGameboardPlan();
  return useMemo(
    () => (plan && options ? createGameboardLayoutPlacements(plan, options) : EMPTY_PLACEMENT_OPTIONS),
    [plan, options]
  );
}

/**
 * Analyze a piece registry for React editor panels and pack setup screens.
 */
export function useGameboardPieceRegistryAnalysis(
  registry: GameboardPieceRegistry | undefined,
  options: AnalyzeGameboardPieceRegistryOptions = DEFAULT_PIECE_REGISTRY_ANALYSIS_OPTIONS
): GameboardPieceRegistryAnalysis | undefined {
  return useMemo(() => (registry ? analyzeGameboardPieceRegistry(registry, options) : undefined), [registry, options]);
}

/**
 * Select registered pieces by role, source, tag, asset id, or local-only state.
 */
export function useGameboardPieceSelection(
  registry: GameboardPieceRegistry | undefined,
  selection: GameboardPieceRegistrySelection = DEFAULT_PIECE_REGISTRY_SELECTION
): readonly GameboardPieceDeclaration[] {
  return useMemo(
    () => (registry ? selectGameboardPieces(registry, selection) : EMPTY_PIECE_SELECTION),
    [registry, selection]
  );
}

/**
 * Inspect one declared piece against the current projected board.
 */
export function useGameboardPiecePlacementInspection(
  piece: GameboardPieceDeclaration | undefined,
  options: GameboardPiecePlacementOptions = DEFAULT_PIECE_PLACEMENT_OPTIONS
): GameboardPiecePlacementInspection | undefined {
  const plan = useProjectedGameboardPlan();
  return useMemo(
    () => (plan && piece ? inspectGameboardPiecePlacement(plan, piece, options) : undefined),
    [plan, piece, options]
  );
}

/**
 * Dry-run selected registry pieces as seeded layout fills for the current
 * projected board.
 */
export function useGameboardPieceFillInspection(
  registry: GameboardPieceRegistry | undefined,
  fills: readonly SeededGameboardPieceFillOptions[] | undefined,
  options: InspectSeededGameboardPieceFillsOptions = DEFAULT_PIECE_FILL_INSPECTION_OPTIONS
): SeededGameboardPieceFillInspection | undefined {
  const plan = useProjectedGameboardPlan();
  return useMemo(
    () => (plan && registry && fills ? inspectSeededGameboardPieceFills(plan, registry, fills, options) : undefined),
    [plan, registry, fills, options]
  );
}

/**
 * Build renderer URL overrides from registered piece source metadata.
 */
export function useGameboardPieceSourceUrlMap(
  registry: GameboardPieceRegistry | undefined,
  options: GameboardPieceSourceUrlOptions = DEFAULT_PIECE_SOURCE_URL_OPTIONS
): Readonly<Record<string, string>> {
  return useMemo(
    () => (registry ? createGameboardPieceSourceUrlMap(registry, options) : EMPTY_SOURCE_URL_MAP),
    [registry, options]
  );
}

export function useTileEntity(coordinates: HexCoordinates | string): Entity | undefined {
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  const tiles = useGameboardTileEntities();
  return useMemo(() => tiles.find((entity) => entity.get(HexTileState)?.key === key), [key, tiles]);
}

export function usePlacementEntitiesForTile(
  coordinates: HexCoordinates | string
): readonly Entity[] {
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  const tile = useTileEntity(key);
  const placements = useGameboardPlacementEntities();
  return useMemo(
    () => placements.filter((entity) => (tile ? entity.has(PlacementOccupiesTile(tile)) : false)),
    [placements, tile]
  );
}

export function usePlacementOccupancyForTile(
  coordinates: HexCoordinates | string
): readonly PlacementOccupancySnapshot[] {
  const world = useWorld();
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  const tile = useTileEntity(key);
  const placements = useGameboardPlacementEntities();
  const revision = useGameboardDerivedRevision();
  return useMemo(() => {
    void revision;
    void tile;
    void placements.length;
    return readPlacementOccupancyForTile(world, key);
  }, [world, key, tile, placements, revision]);
}

export function useGameboardPlacementOccupancy(): readonly PlacementOccupancySnapshot[] {
  const world = useWorld();
  const tiles = useGameboardTileEntities();
  const placements = useGameboardPlacementEntities();
  const revision = useGameboardDerivedRevision();
  return useMemo(() => {
    void revision;
    void tiles.length;
    void placements.length;
    return readGameboardPlacementOccupancy(world);
  }, [world, tiles, placements, revision]);
}

export function useGameboardPlacementOccupancyInspection(
  options: InspectGameboardPlacementOccupancyOptions | undefined
): GameboardPlacementOccupancyInspection | undefined {
  const world = useWorld();
  const tiles = useGameboardTileEntities();
  const placements = useGameboardPlacementEntities();
  const revision = useGameboardDerivedRevision();
  return useMemo(() => {
    void revision;
    void tiles.length;
    void placements.length;
    return options ? inspectGameboardPlacementOccupancy(world, options) : undefined;
  }, [world, options, tiles, placements, revision]);
}

export function useCanOccupyGameboardPlacement(
  options: InspectGameboardPlacementOccupancyOptions | undefined
): boolean | undefined {
  return useGameboardPlacementOccupancyInspection(options)?.canOccupy;
}

export function useOriginPlacementEntitiesForTile(
  coordinates: HexCoordinates | string
): readonly Entity[] {
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  const tile = useTileEntity(key);
  const placements = useGameboardPlacementEntities();
  return useMemo(
    () => placements.filter((entity) => (tile ? entity.has(PlacementOnTile(tile)) : false)),
    [placements, tile]
  );
}

export function useGameboardRuleViolations(
  config: GameboardRuleConfig = DEFAULT_RULE_CONFIG
): readonly GameboardRuleViolation[] {
  const world = useWorld();
  const tiles = useDecomposedTileEntities();
  const placements = useGameboardPlacementEntities();
  return useMemo(() => {
    void tiles.length;
    void placements.length;
    return validateGameboardRules(world, config);
  }, [world, config, tiles, placements]);
}
