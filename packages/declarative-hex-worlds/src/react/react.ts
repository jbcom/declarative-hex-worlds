/**
 * React bindings for Koota-backed gameboard runtimes: provider, query hooks,
 * actions, selectors, runtime snapshots, and tile-scoped UI helpers.
 *
 * @module
 */

import type { Entity, World } from 'koota';
import {
  WorldProvider as GameboardProvider,
  useQuery,
  useTargets,
  useTrait,
  useWorld,
} from 'koota/react';
import {
  type ComponentType,
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import {
  GameboardActor,
  type GameboardActorSelection,
  type GameboardActorSelectionOptions,
  type GameboardActorSnapshot,
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
  gameboardActorActions,
  IsGameboardActor,
  inspectGameboardActorTargets,
  inspectGameboardInteractionTarget,
  inspectGameboardNeighborhood,
  inspectGameboardTile,
  planGameboardInteractionCommand,
  readGameboardActors,
  readGameboardActorsForTile,
  selectGameboardActors,
} from '../actors';
import { type ClassifierTag, placementHasClassifier } from '../classifiers';
import {
  type GameboardActorTargetCommandOptions,
  type GameboardActorTargetCommandPlan,
  type GameboardInteractionCommandInput,
  type GameboardInteractionCommandPreview,
  type GameboardInteractionCommandPreviewOptions,
  gameboardCommandActions,
  planGameboardActorTargetCommand,
  previewGameboardInteractionCommand,
} from '../commands';
import type { SpawnLocation } from '../coordinates';
import {
  analyzeGameboardLayoutFill,
  createGameboardLayoutPlacements,
  type GameboardLayoutFillAnalysis,
  type GameboardLayoutFillOptions,
  type GameboardLayoutPlacementOptions,
  type GameboardLayoutSiteInspection,
  hexKey,
  type InspectGameboardLayoutSitesOptions,
  inspectGameboardLayoutSites,
  projectWorldToGameboardPlan,
} from '../coordinates';
import type { GameboardPlacementSpec, GameboardPlan } from '../gameboard';
import {
  createGameboardNavigation,
  createGameboardOccupancyIndex,
  type GameboardNavigation,
  type GameboardNavigationProfile,
  type GameboardOccupancyIndex,
  type GameboardPatrolRouteOptions,
  type GameboardPatrolRoutePlan,
  type GameboardPatrolRouteSet,
  type GameboardPatrolRouteSetOptions,
  type GameboardSpawnLocationOptions,
  planGameboardPatrolRoute,
  planGameboardPatrolRoutes,
  selectGameboardSpawnLocations,
} from '../gameboard';
import {
  AdjacentTo,
  type GameboardPlacementOccupancyInspection,
  GameboardState,
  type GameboardStateValue,
  gameboardActions,
  HexTileState,
  type HexTileStateValue,
  type InspectGameboardPlacementOccupancyOptions,
  IsGameboardPlacement,
  IsGameboardTile,
  IsHarborPlacement,
  IsRiverPlacement,
  IsRoadPlacement,
  IsStackedTerrain,
  inspectGameboardPlacementOccupancy,
  type PlacementOccupancySnapshot,
  PlacementOccupiesTile,
  PlacementOnTile,
  PlacementState,
  type PlacementStateValue,
  readGameboardPlacementOccupancy,
  readGameboardPlacements,
  readPlacementOccupancyForTile,
  type SpawnGameboardPlacementOptions,
  TileConnectivity,
  type TileConnectivityValue,
  TileCoordinates,
  type TileCoordinatesValue,
  TileElevation,
  type TileElevationValue,
  TileRenderState,
  type TileRenderStateValue,
  TileTagList,
  type TileTagListValue,
  TileTerrain,
  type TileTerrainValue,
} from '../koota';
import {
  gameboardMovementActions,
  IsMoving,
  MovementAgent,
  type MovementAgentValue,
  MovementPathState,
  type MovementPathStateValue,
} from '../movement';
import {
  GameboardPatrolAgent,
  type GameboardPatrolAgentValue,
  GameboardPatrolState,
  type GameboardPatrolStateValue,
  gameboardPatrolActions,
  IsGameboardPatrolAgent,
} from '../patrol';
import {
  type AnalyzeGameboardPieceRegistryOptions,
  analyzeGameboardPieceRegistry,
  createGameboardPieceSourceUrlMap,
  type GameboardPieceDeclaration,
  type GameboardPiecePlacementInspection,
  type GameboardPiecePlacementOptions,
  type GameboardPieceRegistry,
  type GameboardPieceRegistryAnalysis,
  type GameboardPieceRegistrySelection,
  type GameboardPieceSourceUrlOptions,
  inspectGameboardPiecePlacement,
  selectGameboardPieces,
} from '../pieces';
import {
  GameboardQuest,
  type GameboardQuestSnapshot,
  type GameboardQuestValue,
  gameboardQuestActions,
  IsGameboardQuest,
  readGameboardQuests,
} from '../quests';
import type { GameboardRuleConfig, GameboardRuleViolation } from '../rules';
import {
  type InspectSeededGameboardPieceFillsOptions,
  inspectSeededGameboardPieceFills,
  type SeededGameboardPieceFillInspection,
  type SeededGameboardPieceFillOptions,
} from '../rules';
import {
  createGameboardRuntime,
  createGameboardRuntimeFromRecipe,
  createGameboardRuntimeFromScenario,
  type GameboardRecipeGameRuntime,
  type GameboardRuntime,
  type GameboardRuntimeSnapshot,
  type GameboardRuntimeSnapshotOptions,
  type GameboardScenarioGameRuntime,
} from '../runtime';
import type {
  GameboardRecipe,
  GameboardRecipePlanOptionsOverride,
  GameboardScenario,
} from '../scenario';
import { gameboardSystemActions, validateGameboardRules } from '../systems';
import type { HexCoordinates } from '../types';

export { GameboardProvider, useWorld as useGameboardWorld };

const DEFAULT_RULE_CONFIG = {} as const satisfies GameboardRuleConfig;
const DEFAULT_NAVIGATION_PROFILE_OPTIONS = {} as const satisfies GameboardNavigationProfile;
const DEFAULT_LAYOUT_SITE_INSPECTION_OPTIONS =
  {} as const satisfies InspectGameboardLayoutSitesOptions;
const DEFAULT_PIECE_REGISTRY_ANALYSIS_OPTIONS =
  {} as const satisfies AnalyzeGameboardPieceRegistryOptions;
const DEFAULT_PIECE_REGISTRY_SELECTION = {} as const satisfies GameboardPieceRegistrySelection;
const DEFAULT_PIECE_PLACEMENT_OPTIONS = {} as const satisfies GameboardPiecePlacementOptions;
const DEFAULT_PIECE_FILL_INSPECTION_OPTIONS =
  {} as const satisfies InspectSeededGameboardPieceFillsOptions;
const DEFAULT_PIECE_SOURCE_URL_OPTIONS = {} as const satisfies GameboardPieceSourceUrlOptions;
const DEFAULT_RUNTIME_SNAPSHOT_OPTIONS = {} as const satisfies GameboardRuntimeSnapshotOptions;
const EMPTY_PLACEMENT_OPTIONS = [] as const satisfies readonly SpawnGameboardPlacementOptions[];
const EMPTY_PIECE_SELECTION = [] as const satisfies readonly GameboardPieceDeclaration[];
const EMPTY_SOURCE_URL_MAP = {} as const satisfies Readonly<Record<string, string>>;
const GameboardRuntimeContext = createContext<GameboardRuntime | undefined>(undefined);
type GameboardDerivedRevisionDomain =
  | 'state'
  | 'tiles'
  | 'placements'
  | 'actors'
  | 'movement'
  | 'quests'
  | 'patrols';
type GameboardDerivedRevisionDomains = readonly GameboardDerivedRevisionDomain[];
type GameboardRevisionInput = Parameters<World['onAdd']>[0];

const RUNTIME_REVISION_DOMAINS = [
  'state',
  'tiles',
  'placements',
  'actors',
  'movement',
  'quests',
  'patrols',
] as const satisfies GameboardDerivedRevisionDomains;
const PROJECTED_PLAN_REVISION_DOMAINS = [
  'state',
  'tiles',
  'placements',
] as const satisfies GameboardDerivedRevisionDomains;
const PLACEMENT_REVISION_DOMAINS = [
  'placements',
] as const satisfies GameboardDerivedRevisionDomains;
const ACTOR_REVISION_DOMAINS = [
  'placements',
  'actors',
] as const satisfies GameboardDerivedRevisionDomains;
const QUEST_REVISION_DOMAINS = [
  'placements',
  'actors',
  'movement',
  'quests',
] as const satisfies GameboardDerivedRevisionDomains;
const TILE_INSPECTION_REVISION_DOMAINS = [
  'tiles',
  'placements',
  'actors',
] as const satisfies GameboardDerivedRevisionDomains;
const ACTOR_TARGET_REVISION_DOMAINS = [
  'tiles',
  'placements',
  'actors',
] as const satisfies GameboardDerivedRevisionDomains;
const OCCUPANCY_REVISION_DOMAINS = [
  'tiles',
  'placements',
] as const satisfies GameboardDerivedRevisionDomains;

/**
 * Props for mounting an already-created runtime in React.
 *
 * Use this when the scene, router, save loader, or test harness owns runtime
 * creation and React should consume the same Koota world plus recipe/scenario
 * helpers.
 */
export interface GameboardRuntimeProviderProps<
  TRuntime extends GameboardRuntime = GameboardRuntime,
> {
  /** Runtime facade for the board instance mounted below this provider. */
  runtime: TRuntime;
  /** React children that should read the runtime's Koota world. */
  children?: ReactNode;
}

/**
 * Props for mounting a serializable plan directly in React.
 */
export interface GameboardPlanProviderProps {
  /** Plan to load into a newly created runtime for this provider instance. */
  plan: GameboardPlan;
  /** React children that should read the created runtime and world. */
  children?: ReactNode;
}

/**
 * Props for compiling a recipe and mounting the resulting runtime in React.
 */
export interface GameboardRecipeProviderProps {
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
export interface GameboardScenarioProviderProps {
  /** Scenario containing the board recipe plus actors, patrols, movement, and quests. */
  scenario: GameboardScenario;
  /** Optional recipe overrides applied while compiling the scenario board. */
  overrides?: GameboardRecipePlanOptionsOverride;
  /** React children that should read the created runtime and world. */
  children?: ReactNode;
}

type GameboardProviderComponent = ComponentType<{
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
  const Provider = GameboardProvider as GameboardProviderComponent;
  return createElement(
    GameboardRuntimeContext.Provider,
    { value: runtime },
    createElement(Provider, { world: runtime.world }, children)
  );
}

/**
 * Create and mount a runtime from a prebuilt `GameboardPlan`.
 */
export function GameboardPlanProvider({
  plan,
  children,
}: GameboardPlanProviderProps): ReturnType<typeof createElement> {
  const runtime = useMemo(() => createGameboardRuntime(plan), [plan]);
  return createElement(GameboardRuntimeProvider, { runtime }, children);
}

/**
 * Compile a recipe, create a runtime, and mount it for React consumers.
 */
export function GameboardRecipeProvider({
  recipe,
  overrides = {},
  children,
}: GameboardRecipeProviderProps): ReturnType<typeof createElement> {
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
export function GameboardScenarioProvider({
  scenario,
  overrides = {},
  children,
}: GameboardScenarioProviderProps): ReturnType<typeof createElement> {
  const runtime = useMemo(
    () => createGameboardRuntimeFromScenario(scenario, overrides),
    [scenario, overrides]
  );
  return createElement(
    GameboardRuntimeProvider<GameboardScenarioGameRuntime>,
    { runtime },
    children
  );
}

function subscribeGameboardRevisionInput(
  world: World,
  input: GameboardRevisionInput,
  update: () => void
): (() => void)[] {
  return [world.onAdd(input, update), world.onRemove(input, update), world.onChange(input, update)];
}

function subscribeGameboardRevisionDomain(
  world: World,
  domain: GameboardDerivedRevisionDomain,
  update: () => void
): (() => void)[] {
  switch (domain) {
    case 'state':
      return subscribeGameboardRevisionInput(world, GameboardState, update);
    case 'tiles':
      return [
        ...subscribeGameboardRevisionInput(world, HexTileState, update),
        ...subscribeGameboardRevisionInput(world, TileCoordinates, update),
        ...subscribeGameboardRevisionInput(world, TileTerrain, update),
        ...subscribeGameboardRevisionInput(world, TileElevation, update),
        ...subscribeGameboardRevisionInput(world, TileConnectivity, update),
        ...subscribeGameboardRevisionInput(world, TileRenderState, update),
        ...subscribeGameboardRevisionInput(world, TileTagList, update),
      ];
    case 'placements':
      return [
        ...subscribeGameboardRevisionInput(world, PlacementState, update),
        ...subscribeGameboardRevisionInput(world, PlacementOnTile, update),
        ...subscribeGameboardRevisionInput(world, PlacementOccupiesTile, update),
      ];
    case 'actors':
      return subscribeGameboardRevisionInput(world, GameboardActor, update);
    case 'movement':
      return [
        ...subscribeGameboardRevisionInput(world, MovementAgent, update),
        ...subscribeGameboardRevisionInput(world, MovementPathState, update),
      ];
    case 'quests':
      return subscribeGameboardRevisionInput(world, GameboardQuest, update);
    case 'patrols':
      return [
        ...subscribeGameboardRevisionInput(world, GameboardPatrolAgent, update),
        ...subscribeGameboardRevisionInput(world, GameboardPatrolState, update),
      ];
  }
}

function useGameboardDerivedRevision(domains: GameboardDerivedRevisionDomains): number {
  const world = useWorld();
  const domainsKey = domains.join('|');
  const stableDomainsRef = useRef<
    { key: string; value: GameboardDerivedRevisionDomains } | undefined
  >(undefined);
  if (stableDomainsRef.current?.key !== domainsKey) {
    stableDomainsRef.current = { key: domainsKey, value: [...domains] };
  }
  const stableDomains = stableDomainsRef.current.value;
  const [revision, bumpRevision] = useReducer(
    (value: number) => (value + 1) % Number.MAX_SAFE_INTEGER,
    0
  );

  useEffect(() => {
    let disposed = false;
    let pending = false;
    const update = () => {
      if (disposed || pending) {
        return;
      }
      pending = true;
      queueMicrotask(() => {
        pending = false;
        if (!disposed) {
          bumpRevision();
        }
      });
    };
    const unsubscribers = stableDomains.flatMap((domain) =>
      subscribeGameboardRevisionDomain(world, domain, update)
    );

    return () => {
      disposed = true;
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [world, stableDomains]);

  return revision;
}

/**
 * Read the root board state trait from the current Koota world.
 */
export function useGameboardState(): GameboardStateValue | undefined {
  return useTrait(useWorld(), GameboardState);
}

/**
 * Bind low-level board actions for loading, clearing, and spawning tile plans.
 */
export function useGameboardActions(): ReturnType<typeof gameboardActions> {
  const world = useWorld();
  return useMemo(() => gameboardActions(world), [world]);
}

/**
 * Bind movement actions for starting, advancing, and completing placement paths.
 */
export function useGameboardMovementActions(): ReturnType<typeof gameboardMovementActions> {
  const world = useWorld();
  return useMemo(() => gameboardMovementActions(world), [world]);
}

/**
 * Bind actor actions for registering, spawning, moving, and updating actors.
 */
export function useGameboardActorActions(): ReturnType<typeof gameboardActorActions> {
  const world = useWorld();
  return useMemo(() => gameboardActorActions(world), [world]);
}

/**
 * Bind quest actions for spawning objectives and updating quest progress.
 */
export function useGameboardQuestActions(): ReturnType<typeof gameboardQuestActions> {
  const world = useWorld();
  return useMemo(() => gameboardQuestActions(world), [world]);
}

/**
 * Bind patrol actions for attaching patrol agents and route state.
 */
export function useGameboardPatrolActions(): ReturnType<typeof gameboardPatrolActions> {
  const world = useWorld();
  return useMemo(() => gameboardPatrolActions(world), [world]);
}

/**
 * Bind higher-level command actions shared by UI, AI, and test flows.
 */
export function useGameboardCommandActions(): ReturnType<typeof gameboardCommandActions> {
  const world = useWorld();
  return useMemo(() => gameboardCommandActions(world), [world]);
}

/**
 * Bind system tick actions for running movement, patrol, and quest systems.
 */
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
export function useGameboardRuntime<
  TRuntime extends GameboardRuntime = GameboardRuntime,
>(): TRuntime {
  const world = useWorld();
  const providedRuntime = useContext(GameboardRuntimeContext);
  return useMemo(
    () => (providedRuntime ?? createGameboardRuntime(world)) as TRuntime,
    [providedRuntime, world]
  );
}

/**
 * Hash-stabilize a hook options object so reference-equality survives
 * re-renders where the caller passes a fresh literal (PRD B7).
 *
 * Without this, every selector hook re-runs on every parent render because
 * the caller's `{}` literal gets a new identity each render. This compares
 * structural equality via JSON.stringify (which is fine because option
 * objects are plain data — no functions, no refs). The returned reference
 * stays stable as long as the JSON serialization matches.
 */
function isPlainEmptyOptions(options: unknown): options is Record<string, never> {
  if (options === null || typeof options !== 'object') {
    return false;
  }
  if (Object.getPrototypeOf(options) !== Object.prototype) {
    return false;
  }
  for (const _ in options) {
    return false;
  }
  return !('toJSON' in options);
}

function useStableOptions<T>(options: T): T {
  const ref = useRef<{ key: string; value: T; tick: number } | undefined>(undefined);
  // JSON.stringify returns undefined for `T = undefined` and for values
  // whose only enumerable members are functions/symbols. Use the option
  // value itself as the cache discriminator when the serialization fails
  // — Object.is identity is the correct semantic for non-serializable T.
  const serialized = isPlainEmptyOptions(options) ? '{}' : JSON.stringify(options);
  const nextKey = serialized ?? '__unserializable__';
  const useIdentity = serialized === undefined;
  const tick = (ref.current?.tick ?? 0) + 1;
  if (
    ref.current === undefined ||
    ref.current.key !== nextKey ||
    (useIdentity && !Object.is(ref.current.value, options))
  ) {
    ref.current = { key: nextKey, value: options, tick };
  }
  return ref.current.value;
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
  const revision = useGameboardDerivedRevision(RUNTIME_REVISION_DOMAINS);
  const stableOptions = useStableOptions(options);
  return useMemo(() => {
    void revision;
    return runtime.snapshot(stableOptions);
  }, [runtime, stableOptions, revision]);
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
  const revision = useGameboardDerivedRevision(PLACEMENT_REVISION_DOMAINS);
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
  const revision = useGameboardDerivedRevision(ACTOR_REVISION_DOMAINS);
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
  const revision = useGameboardDerivedRevision(ACTOR_REVISION_DOMAINS);
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
  const revision = useGameboardDerivedRevision(QUEST_REVISION_DOMAINS);
  return useMemo(() => {
    void revision;
    void quests.length;
    return readGameboardQuests(world);
  }, [world, quests, revision]);
}

/**
 * Inspect one interaction target from React without dispatching a command.
 */
export function useGameboardInteractionTarget(
  target: GameboardInteractionTargetInput | undefined,
  options: GameboardInteractionTargetOptions = {}
): GameboardInteractionTargetReport | undefined {
  const world = useWorld();
  const tiles = useGameboardTileEntities();
  const placements = useGameboardPlacementEntities();
  const actors = useGameboardActorEntities();
  const stableOptions = useStableOptions(options);
  return useMemo(() => {
    void tiles.length;
    void placements.length;
    void actors.length;
    return target ? inspectGameboardInteractionTarget(world, target, stableOptions) : undefined;
  }, [world, target, stableOptions, tiles, placements, actors]);
}

/**
 * Plan the command that would be executed for a selected interaction target.
 */
export function useGameboardInteractionCommand(
  target: GameboardInteractionTargetInput | undefined,
  options: GameboardInteractionCommandOptions = {}
): GameboardInteractionCommand | undefined {
  const world = useWorld();
  const tiles = useGameboardTileEntities();
  const placements = useGameboardPlacementEntities();
  const actors = useGameboardActorEntities();
  const stableOptions = useStableOptions(options);
  return useMemo(() => {
    void tiles.length;
    void placements.length;
    void actors.length;
    return target ? planGameboardInteractionCommand(world, target, stableOptions) : undefined;
  }, [world, target, stableOptions, tiles, placements, actors]);
}

/**
 * Preview an interaction command or target for HUD affordances and tests.
 */
export function useGameboardInteractionCommandPreview(
  commandOrTarget: GameboardInteractionCommandInput | undefined,
  options: GameboardInteractionCommandPreviewOptions = {}
): GameboardInteractionCommandPreview | undefined {
  const world = useWorld();
  const tiles = useGameboardTileEntities();
  const placements = useGameboardPlacementEntities();
  const actors = useGameboardActorEntities();
  const stableOptions = useStableOptions(options);
  return useMemo(() => {
    void tiles.length;
    void placements.length;
    void actors.length;
    return commandOrTarget
      ? previewGameboardInteractionCommand(world, commandOrTarget, stableOptions)
      : undefined;
  }, [world, commandOrTarget, stableOptions, tiles, placements, actors]);
}

/**
 * Inspect terrain, connectivity, occupancy, and actor state for one tile.
 */
export function useGameboardTileInspection(
  coordinates: HexCoordinates | string,
  options: GameboardTileInspectionOptions = {}
): GameboardTileInspection {
  const world = useWorld();
  const revision = useGameboardDerivedRevision(TILE_INSPECTION_REVISION_DOMAINS);
  const tileKey = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  const stableOptions = useStableOptions(options);
  return useMemo(() => {
    void revision;
    return inspectGameboardTile(world, tileKey, stableOptions);
  }, [world, tileKey, stableOptions, revision]);
}

/**
 * Inspect a tile neighborhood for overlays, local AI decisions, and debug UI.
 */
export function useGameboardNeighborhoodInspection(
  center: GameboardNeighborhoodCenter,
  options: GameboardNeighborhoodInspectionOptions = {}
): GameboardNeighborhoodInspection {
  const world = useWorld();
  const revision = useGameboardDerivedRevision(TILE_INSPECTION_REVISION_DOMAINS);
  const stableOptions = useStableOptions(options);
  return useMemo(() => {
    void revision;
    return inspectGameboardNeighborhood(world, center, stableOptions);
  }, [world, center, stableOptions, revision]);
}

/**
 * Select actors by team, hostility, tags, kind, tile, or interaction state.
 */
export function useGameboardActorSelection(
  options: GameboardActorSelectionOptions = {}
): GameboardActorSelection {
  const world = useWorld();
  const revision = useGameboardDerivedRevision(ACTOR_REVISION_DOMAINS);
  const stableOptions = useStableOptions(options);
  return useMemo(() => {
    void revision;
    return selectGameboardActors(world, stableOptions);
  }, [world, stableOptions, revision]);
}

/**
 * Compute legal interaction targets for one actor from React.
 */
export function useGameboardActorTargets(
  options: GameboardActorTargetingOptions | undefined
): GameboardActorTargetingReport | undefined {
  const world = useWorld();
  const revision = useGameboardDerivedRevision(ACTOR_TARGET_REVISION_DOMAINS);
  const stableOptions = useStableOptions(options);
  return useMemo(() => {
    void revision;
    return stableOptions ? inspectGameboardActorTargets(world, stableOptions) : undefined;
  }, [world, stableOptions, revision]);
}

/**
 * Plan the concrete command for one actor-target interaction.
 */
export function useGameboardActorTargetCommand(
  options: GameboardActorTargetCommandOptions | undefined
): GameboardActorTargetCommandPlan | undefined {
  const world = useWorld();
  const revision = useGameboardDerivedRevision(ACTOR_TARGET_REVISION_DOMAINS);
  const stableOptions = useStableOptions(options);
  return useMemo(() => {
    void revision;
    return stableOptions ? planGameboardActorTargetCommand(world, stableOptions) : undefined;
  }, [world, stableOptions, revision]);
}

/**
 * Query all entities that represent canonical gameboard tiles.
 */
export function useGameboardTileEntities(): readonly Entity[] {
  return useQuery(IsGameboardTile, HexTileState);
}

/**
 * Query tile entities with their decomposed coordinate, terrain, and render traits.
 */
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

/**
 * Query all entities that represent board placements on top of tiles.
 */
export function useGameboardPlacementEntities(): readonly Entity[] {
  return useQuery(IsGameboardPlacement, PlacementState);
}

/**
 * Query placement entities tagged as roads.
 */
export function useRoadPlacementEntities(): readonly Entity[] {
  return useQuery(IsRoadPlacement, PlacementState);
}

/**
 * Query placement entities tagged as rivers.
 */
export function useRiverPlacementEntities(): readonly Entity[] {
  return useQuery(IsRiverPlacement, PlacementState);
}

/**
 * Query placement entities tagged as harbors or ports.
 */
export function useHarborPlacementEntities(): readonly Entity[] {
  return useQuery(IsHarborPlacement, PlacementState);
}

/**
 * Query terrain placements that participate in vertical stacking.
 */
export function useStackedTerrainEntities(): readonly Entity[] {
  return useQuery(IsStackedTerrain, PlacementState);
}

/**
 * Query placements currently controlled by movement state.
 */
export function useMovingPlacementEntities(): readonly Entity[] {
  return useQuery(IsMoving, PlacementState, MovementPathState);
}

/**
 * Query actor entities together with their origin placement state.
 */
export function useGameboardActorEntities(): readonly Entity[] {
  return useQuery(IsGameboardActor, PlacementState, GameboardActor);
}

/**
 * Query all quest entities in the current board world.
 */
export function useGameboardQuestEntities(): readonly Entity[] {
  return useQuery(IsGameboardQuest, GameboardQuest);
}

/**
 * Query actors that have patrol agent state attached.
 */
export function useGameboardPatrolAgentEntities(): readonly Entity[] {
  return useQuery(
    IsGameboardPatrolAgent,
    PlacementState,
    GameboardPatrolAgent,
    GameboardPatrolState
  );
}

/**
 * Read the canonical tile trait for one tile entity.
 */
export function useTileState(entity: Entity | undefined | null): HexTileStateValue | undefined {
  return useTrait(entity, HexTileState);
}

/**
 * Read axial coordinates for one tile entity.
 */
export function useTileCoordinates(
  entity: Entity | undefined | null
): TileCoordinatesValue | undefined {
  return useTrait(entity, TileCoordinates);
}

/**
 * Read terrain classification for one tile entity.
 */
export function useTileTerrain(entity: Entity | undefined | null): TileTerrainValue | undefined {
  return useTrait(entity, TileTerrain);
}

/**
 * Read base elevation data for one tile entity.
 */
export function useTileElevation(
  entity: Entity | undefined | null
): TileElevationValue | undefined {
  return useTrait(entity, TileElevation);
}

/**
 * Read six-edge connectivity data for one tile entity.
 */
export function useTileConnectivity(
  entity: Entity | undefined | null
): TileConnectivityValue | undefined {
  return useTrait(entity, TileConnectivity);
}

/**
 * Read render placement data for one tile entity.
 */
export function useTileRenderState(
  entity: Entity | undefined | null
): TileRenderStateValue | undefined {
  return useTrait(entity, TileRenderState);
}

/**
 * Read normalized tags attached to one tile entity.
 */
export function useTileTagList(entity: Entity | undefined | null): TileTagListValue | undefined {
  return useTrait(entity, TileTagList);
}

/**
 * Read adjacent tile relation targets for one tile entity.
 */
export function useAdjacentTileEntities(entity: Entity | undefined | null): readonly Entity[] {
  return useTargets(entity, AdjacentTo);
}

/**
 * Read placement state for one placement or actor entity.
 */
export function usePlacementState(
  entity: Entity | undefined | null
): PlacementStateValue | undefined {
  return useTrait(entity, PlacementState);
}

/**
 * Read movement agent metadata for one moving placement.
 */
export function useMovementAgent(
  entity: Entity | undefined | null
): MovementAgentValue | undefined {
  return useTrait(entity, MovementAgent);
}

/**
 * Read current path-following state for one moving placement.
 */
export function useMovementPathState(
  entity: Entity | undefined | null
): MovementPathStateValue | undefined {
  return useTrait(entity, MovementPathState);
}

/**
 * Read actor metadata for one actor entity.
 */
export function useGameboardActor(
  entity: Entity | undefined | null
): GameboardActorValue | undefined {
  return useTrait(entity, GameboardActor);
}

/**
 * Read quest metadata and progress for one quest entity.
 */
export function useGameboardQuest(
  entity: Entity | undefined | null
): GameboardQuestValue | undefined {
  return useTrait(entity, GameboardQuest);
}

/**
 * Read patrol agent configuration for one actor entity.
 */
export function useGameboardPatrolAgent(
  entity: Entity | undefined | null
): GameboardPatrolAgentValue | undefined {
  return useTrait(entity, GameboardPatrolAgent);
}

/**
 * Read live patrol route progress for one actor entity.
 */
export function useGameboardPatrolState(
  entity: Entity | undefined | null
): GameboardPatrolStateValue | undefined {
  return useTrait(entity, GameboardPatrolState);
}

/**
 * Project the live Koota world back into a serializable `GameboardPlan`.
 */
export function useProjectedGameboardPlan(): GameboardPlan | undefined {
  const world = useWorld();
  const state = useGameboardState();
  const tiles = useDecomposedTileEntities();
  const placements = useGameboardPlacementEntities();
  const revision = useGameboardDerivedRevision(PROJECTED_PLAN_REVISION_DOMAINS);
  return useMemo(() => {
    void revision;
    void tiles.length;
    void placements.length;
    return state ? projectWorldToGameboardPlan(world) : undefined;
  }, [world, state, tiles, placements, revision]);
}

/**
 * Live placements carrying a gameplay classifier tag (RFC0-TAG). Reactively filters the
 * projected plan's placements by classifier metadata — re-runs when the board changes.
 * e.g. `usePlacementsByClassifier('enemy')` drives an enemy overlay.
 */
export function usePlacementsByClassifier(tag: ClassifierTag): readonly GameboardPlacementSpec[] {
  const plan = useProjectedGameboardPlan();
  return useMemo(() => {
    // Hoist the `?? []` coalesce onto its OWN line. react.ts is measured by both
    // the unit and browser harnesses; when the coalesce shared a line with the
    // `.filter` predicate, two istanbul statements collided on one lineLocationKey
    // and the by-url coverage merge's line-span fallback (which requires a UNIQUE
    // line key) couldn't reconcile the browser-covered statement with the unit
    // harness's column-drifted phantom — stranding a false 0-hit in the merged
    // tree. On its own line the coalesce keeps a unique line key. (RFC0-TAG; see
    // the merge notes in vitest.coverage.shared.ts.)
    const placements = plan?.placements ?? [];
    return placements.filter((placement) => placementHasClassifier(placement.metadata, tag));
  }, [plan, tag]);
}

/**
 * Build a navigation occupancy index from the current projected board.
 */
export function useGameboardOccupancyIndex(
  profile: GameboardNavigationProfile = DEFAULT_NAVIGATION_PROFILE_OPTIONS
): GameboardOccupancyIndex | undefined {
  const plan = useProjectedGameboardPlan();
  return useMemo(
    () => (plan ? createGameboardOccupancyIndex(plan, profile) : undefined),
    [plan, profile]
  );
}

/**
 * Build pathfinding helpers from the current projected board.
 */
export function useGameboardNavigation(
  profile: GameboardNavigationProfile = DEFAULT_NAVIGATION_PROFILE_OPTIONS
): GameboardNavigation | undefined {
  const plan = useProjectedGameboardPlan();
  return useMemo(
    () => (plan ? createGameboardNavigation(plan, profile) : undefined),
    [plan, profile]
  );
}

/**
 * Select legal spawn locations from the current projected board.
 */
export function useGameboardSpawnLocations(
  options: GameboardSpawnLocationOptions | undefined
): readonly SpawnLocation[] {
  const plan = useProjectedGameboardPlan();
  return useMemo(
    () => (plan && options ? selectGameboardSpawnLocations(plan, options) : []),
    [plan, options]
  );
}

/**
 * Plan one patrol route from the current projected board.
 */
export function useGameboardPatrolRoute(
  options: GameboardPatrolRouteOptions | undefined
): GameboardPatrolRoutePlan | undefined {
  const plan = useProjectedGameboardPlan();
  return useMemo(
    () => (plan && options ? planGameboardPatrolRoute(plan, options) : undefined),
    [plan, options]
  );
}

/**
 * Plan multiple patrol routes from the current projected board.
 */
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
  return useMemo(
    () => (plan ? inspectGameboardLayoutSites(plan, options) : undefined),
    [plan, options]
  );
}

/**
 * Analyze seeded layout fill rules against the current projected board.
 */
export function useGameboardLayoutFillAnalysis(
  options: GameboardLayoutFillOptions | undefined
): GameboardLayoutFillAnalysis | undefined {
  const plan = useProjectedGameboardPlan();
  return useMemo(
    () => (plan && options ? analyzeGameboardLayoutFill(plan, options) : undefined),
    [plan, options]
  );
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
    () =>
      plan && options ? createGameboardLayoutPlacements(plan, options) : EMPTY_PLACEMENT_OPTIONS,
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
  return useMemo(
    () => (registry ? analyzeGameboardPieceRegistry(registry, options) : undefined),
    [registry, options]
  );
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
    () =>
      plan && registry && fills
        ? inspectSeededGameboardPieceFills(plan, registry, fills, options)
        : undefined,
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

/**
 * Find the tile entity for one axial coordinate or tile key.
 */
export function useTileEntity(coordinates: HexCoordinates | string): Entity | undefined {
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  const tiles = useGameboardTileEntities();
  return useMemo(() => tiles.find((entity) => entity.get(HexTileState)?.key === key), [key, tiles]);
}

/**
 * Read every placement that occupies one tile, including multi-tile footprints.
 */
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

/**
 * Read placement occupancy snapshots for one tile key or coordinate.
 */
export function usePlacementOccupancyForTile(
  coordinates: HexCoordinates | string
): readonly PlacementOccupancySnapshot[] {
  const world = useWorld();
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  const tile = useTileEntity(key);
  const placements = useGameboardPlacementEntities();
  const revision = useGameboardDerivedRevision(OCCUPANCY_REVISION_DOMAINS);
  return useMemo(() => {
    void revision;
    void tile;
    void placements.length;
    return readPlacementOccupancyForTile(world, key);
  }, [world, key, tile, placements, revision]);
}

/**
 * Read placement occupancy snapshots for every occupied tile.
 */
export function useGameboardPlacementOccupancy(): readonly PlacementOccupancySnapshot[] {
  const world = useWorld();
  const tiles = useGameboardTileEntities();
  const placements = useGameboardPlacementEntities();
  const revision = useGameboardDerivedRevision(OCCUPANCY_REVISION_DOMAINS);
  return useMemo(() => {
    void revision;
    void tiles.length;
    void placements.length;
    return readGameboardPlacementOccupancy(world);
  }, [world, tiles, placements, revision]);
}

/**
 * Inspect whether a proposed placement can occupy the current board.
 */
export function useGameboardPlacementOccupancyInspection(
  options: InspectGameboardPlacementOccupancyOptions | undefined
): GameboardPlacementOccupancyInspection | undefined {
  const world = useWorld();
  const tiles = useGameboardTileEntities();
  const placements = useGameboardPlacementEntities();
  const revision = useGameboardDerivedRevision(OCCUPANCY_REVISION_DOMAINS);
  return useMemo(() => {
    void revision;
    void tiles.length;
    void placements.length;
    return options ? inspectGameboardPlacementOccupancy(world, options) : undefined;
  }, [world, options, tiles, placements, revision]);
}

/**
 * Return only the boolean placement-occupancy decision for form controls.
 */
export function useCanOccupyGameboardPlacement(
  options: InspectGameboardPlacementOccupancyOptions | undefined
): boolean | undefined {
  return useGameboardPlacementOccupancyInspection(options)?.canOccupy;
}

/**
 * Read placements whose origin tile is exactly the requested tile.
 */
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

/**
 * Validate the live Koota world against gameboard rule configuration.
 */
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
