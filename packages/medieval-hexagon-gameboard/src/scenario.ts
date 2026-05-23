import type { Entity, World } from 'koota';
import {
  readGameboardActors,
  spawnGameboardActor,
  type GameboardActorSnapshot,
  type SpawnGameboardActorOptions,
} from './actors';
import { hexKey, parseHexKey } from './coordinates';
import type { GameboardPlan } from './gameboard';
import { createGameboardWorld } from './koota';
import { getManifestAsset } from './manifest/schema';
import { setGameboardMovementAgent, type SetGameboardMovementAgentOptions } from './movement';
import {
  setGameboardPatrolAgent,
  type SetGameboardPatrolAgentOptions,
} from './patrol';
import {
  planGameboardPatrolRoutes,
  planGameboardSpawnGroups,
  type GameboardNavigationProfile,
  type GameboardPatrolRouteRule,
  type GameboardPatrolRouteSet,
  type GameboardSpawnGroupOptions,
  type GameboardSpawnGroupPlan,
} from './navigation';
import {
  readGameboardQuests,
  spawnGameboardQuest,
  type GameboardQuestDefinition,
  type GameboardQuestSnapshot,
} from './quests';
import {
  createGameboardPlanFromRecipe,
  type GameboardRecipe,
  type GameboardRecipePlanOptionsOverride,
} from './recipe';
import type { GameboardRuleViolation } from './rule-types';
import { validateGameboardPlan, type GameboardPlanValidationConfig } from './validation';

/** Current schema version for serialized scenario files. */
export const GAMEBOARD_SCENARIO_SCHEMA_VERSION = '1.0.0';

/** Authored actor entry in a scenario, with optional spawn group resolution. */
export interface GameboardScenarioActor extends Omit<SpawnGameboardActorOptions, 'at'> {
  /** Explicit spawn coordinate or tile key; omitted when using a spawn group. */
  at?: SpawnGameboardActorOptions['at'];
  /** Spawn group id to claim a deterministic spawn location from. */
  spawnGroupId?: string;
  /** Explicit spawn location index inside the referenced spawn group. */
  spawnLocationIndex?: number;
  /** Optional movement agent to attach after spawning. */
  movementAgent?: SetGameboardMovementAgentOptions;
  /** Optional patrol agent to attach after spawning. */
  patrolAgent?: GameboardScenarioActorPatrolAgent;
}

/** Scenario actor after spawn group references have been resolved. */
export interface ResolvedGameboardScenarioActor extends SpawnGameboardActorOptions {
  /** Spawn group id used to resolve the actor, when any. */
  spawnGroupId?: string;
  /** Spawn location index claimed inside the group, when any. */
  spawnLocationIndex?: number;
  /** Spawn location id claimed inside the group, when any. */
  spawnLocationId?: string;
  /** Spawn tile key claimed inside the group, when any. */
  spawnTileKey?: string;
  /** Optional movement agent to attach after spawning. */
  movementAgent?: SetGameboardMovementAgentOptions;
  /** Optional patrol agent to attach after spawning. */
  patrolAgent?: GameboardScenarioActorPatrolAgent;
}

/** Patrol route rule embedded in a scenario. */
export interface GameboardScenarioPatrolRoute extends GameboardPatrolRouteRule {}

/** Patrol agent definition that references a named scenario route. */
export interface GameboardScenarioActorPatrolAgent
  extends Omit<SetGameboardPatrolAgentOptions, 'route'> {
  /** Scenario patrol route id to attach to the actor. */
  routeId: string;
}

/** Serializable integration/e2e scenario using recipes, actors, routes, and quests. */
export interface GameboardScenario {
  /** Version tag for migration-safe scenario persistence. */
  schemaVersion: typeof GAMEBOARD_SCENARIO_SCHEMA_VERSION;
  /** Stable scenario id. */
  id: string;
  /** Optional display title. */
  title?: string;
  /** Board recipe used to compile the scenario map. */
  board: GameboardRecipe;
  /** Deterministic spawn group rules for scenario actors. */
  spawnGroups?: GameboardSpawnGroupOptions;
  /** Deterministic patrol route rules for scenario actors. */
  patrolRoutes?: readonly GameboardScenarioPatrolRoute[];
  /** Actors to spawn into the scenario runtime. */
  actors?: readonly GameboardScenarioActor[];
  /** Quests to spawn into the scenario runtime. */
  quests?: readonly GameboardQuestDefinition[];
  /** Additional serializable scenario metadata. */
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

/** Options accepted by the scenario factory. */
export interface CreateGameboardScenarioOptions {
  /** Optional display title. */
  title?: string;
  /** Deterministic spawn group rules for scenario actors. */
  spawnGroups?: GameboardSpawnGroupOptions;
  /** Deterministic patrol route rules for scenario actors. */
  patrolRoutes?: readonly GameboardScenarioPatrolRoute[];
  /** Actors to spawn into the scenario runtime. */
  actors?: readonly GameboardScenarioActor[];
  /** Quests to spawn into the scenario runtime. */
  quests?: readonly GameboardQuestDefinition[];
  /** Additional serializable scenario metadata. */
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

/** Runtime objects produced after compiling and spawning a scenario. */
export interface GameboardScenarioRuntime {
  /** Scenario definition used to create the runtime. */
  scenario: GameboardScenario;
  /** Compiled gameboard plan. */
  plan: GameboardPlan;
  /** Planned spawn groups, when configured. */
  spawnGroups?: GameboardSpawnGroupPlan;
  /** Planned patrol routes, when configured. */
  patrolRoutes?: GameboardPatrolRouteSet;
  /** Koota world containing board, actor, quest, movement, and patrol state. */
  world: World;
  /** Spawned actor entities keyed by actor id. */
  actorEntities: Readonly<Record<string, Entity>>;
  /** Spawned quest entities keyed by quest id. */
  questEntities: Readonly<Record<string, Entity>>;
  /** Actor snapshots after scenario spawn. */
  actors: readonly GameboardActorSnapshot[];
  /** Quest snapshots after scenario spawn. */
  quests: readonly GameboardQuestSnapshot[];
}

/** Validation controls for scenario inspection. */
export interface GameboardScenarioValidationConfig {
  /** Validation config passed to compiled plan validation. */
  plan?: GameboardPlanValidationConfig;
  /** Whether to validate the compiled plan in addition to scenario references. */
  validatePlan?: boolean;
}

/** Result from validating a scenario and its compiled board. */
export interface GameboardScenarioValidationResult {
  /** Scenario that was inspected. */
  scenario: GameboardScenario;
  /** Compiled plan when the board recipe succeeds. */
  plan?: GameboardPlan;
  /** Spawn group plan when scenario spawn groups are configured. */
  spawnGroups?: GameboardSpawnGroupPlan;
  /** Patrol route plan when scenario patrol routes are configured. */
  patrolRoutes?: GameboardPatrolRouteSet;
  /** Scenario, spawn, route, actor, quest, and optional plan violations. */
  violations: readonly GameboardRuleViolation[];
}

/** Creates a cloned, schema-tagged gameboard scenario. */
export function createGameboardScenario(
  id: string,
  board: GameboardRecipe,
  options: CreateGameboardScenarioOptions = {}
): GameboardScenario {
  return {
    schemaVersion: GAMEBOARD_SCENARIO_SCHEMA_VERSION,
    id,
    title: options.title,
    board,
    spawnGroups: options.spawnGroups ? cloneSpawnGroups(options.spawnGroups) : undefined,
    patrolRoutes: options.patrolRoutes?.map(clonePatrolRoute) ?? [],
    actors: options.actors?.map(cloneScenarioActor) ?? [],
    quests: options.quests?.map(cloneQuestDefinition) ?? [],
    metadata: { ...(options.metadata ?? {}) },
  };
}

/** Validates a scenario and returns all scenario/plan rule violations. */
export function validateGameboardScenario(
  scenario: GameboardScenario,
  config: GameboardScenarioValidationConfig = {}
): GameboardRuleViolation[] {
  return [...inspectGameboardScenario(scenario, config).violations];
}

/** Compiles and validates a scenario, returning errors instead of throwing. */
export function inspectGameboardScenario(
  scenario: GameboardScenario,
  config: GameboardScenarioValidationConfig = {}
): GameboardScenarioValidationResult {
  const violations: GameboardRuleViolation[] = [];
  const actorIds = new Set<string>();
  const questIds = new Set<string>();
  const objectiveIdsByQuest = new Map<string, Set<string>>();
  const actorSpawnAllocations: ScenarioSpawnAllocations = new Map();
  const authoredPatrolRouteIds = new Set((scenario.patrolRoutes ?? []).map((route) => route.id));
  let plan: GameboardPlan | undefined;
  let spawnGroups: GameboardSpawnGroupPlan | undefined;
  let patrolRoutes: GameboardPatrolRouteSet | undefined;

  if (scenario.schemaVersion !== GAMEBOARD_SCENARIO_SCHEMA_VERSION) {
    violations.push({
      code: 'scenario.schema_version',
      severity: 'error',
      message: `Scenario ${scenario.id ?? '<unknown>'} uses schema ${String(
        scenario.schemaVersion
      )}; expected ${GAMEBOARD_SCENARIO_SCHEMA_VERSION}`,
    });
  }
  if (!isNonEmptyString(scenario.id)) {
    violations.push({
      code: 'scenario.id',
      severity: 'error',
      message: 'Scenario id must be a non-empty string',
    });
  }

  try {
    plan = createGameboardPlanFromRecipe(scenario.board);
  } catch (error) {
    violations.push({
      code: 'scenario.board_compile_failed',
      severity: 'error',
      message: `Scenario ${scenario.id ?? '<unknown>'} board failed to compile: ${errorMessage(error)}`,
    });
  }

  if (plan && config.validatePlan !== false) {
    violations.push(...validateGameboardPlan(plan, config.plan));
  }

  if (plan && scenario.spawnGroups) {
    spawnGroups = planGameboardSpawnGroups(plan, scenario.spawnGroups);
    violations.push(...spawnGroupViolations(spawnGroups));
  }
  if (plan && scenario.patrolRoutes?.length) {
    patrolRoutes = planGameboardPatrolRoutes(plan, {
      seed: `${scenario.id}:patrol-routes`,
      spawnGroups,
      routes: scenario.patrolRoutes,
    });
    violations.push(...patrolRouteViolations(patrolRoutes));
  }

  const tileKeys = new Set(plan?.tiles.map((tile) => tile.key) ?? []);
  for (const actor of scenario.actors ?? []) {
    validateScenarioActor(
      violations,
      actor,
      actorIds,
      tileKeys,
      plan !== undefined,
      config.plan,
      spawnGroups,
      actorSpawnAllocations,
      authoredPatrolRouteIds
    );
  }
  for (const quest of scenario.quests ?? []) {
    validateScenarioQuest(
      violations,
      quest,
      questIds,
      objectiveIdsByQuest,
      actorIds,
      tileKeys,
      plan !== undefined
    );
  }

  return {
    scenario,
    plan,
    spawnGroups,
    patrolRoutes,
    violations,
  };
}

/** Compiles a scenario and spawns its board, actors, agents, and quests into a Koota world. */
export function createGameboardWorldFromScenario(
  scenario: GameboardScenario,
  overrides: GameboardRecipePlanOptionsOverride = {}
): GameboardScenarioRuntime {
  const plan = createGameboardPlanFromRecipe(scenario.board, overrides);
  const spawnGroups = scenario.spawnGroups
    ? planGameboardSpawnGroups(plan, scenario.spawnGroups)
    : undefined;
  if (spawnGroups?.errors.length) {
    throw new Error(
      `Scenario ${scenario.id} spawn groups failed: ${spawnGroups.errors.join('; ')}`
    );
  }
  const patrolRoutes = scenario.patrolRoutes?.length
    ? planGameboardPatrolRoutes(plan, {
        seed: `${scenario.id}:patrol-routes`,
        spawnGroups,
        routes: scenario.patrolRoutes,
      })
    : undefined;
  if (patrolRoutes?.errors.length) {
    throw new Error(
      `Scenario ${scenario.id} patrol routes failed: ${patrolRoutes.errors.join('; ')}`
    );
  }
  const world = createGameboardWorld(plan);
  const actorEntities: Record<string, Entity> = {};
  const questEntities: Record<string, Entity> = {};
  const actors = resolveGameboardScenarioActors(scenario.actors ?? [], spawnGroups);

  for (const actor of actors) {
    const { movementAgent, patrolAgent, ...spawnOptions } = actor;
    const entity = spawnGameboardActor(world, spawnOptions);
    actorEntities[actor.actorId] = entity;
    if (movementAgent) {
      setGameboardMovementAgent(world, entity, movementAgent);
    }
    if (patrolAgent) {
      const route = patrolRoutes?.routes.find((candidate) => candidate.id === patrolAgent.routeId);
      if (!route) {
        throw new Error(`Scenario actor ${actor.actorId} references unknown patrol route ${patrolAgent.routeId}`);
      }
      setGameboardPatrolAgent(world, entity, { ...patrolOptionsWithoutRouteId(patrolAgent), route });
    }
  }

  for (const quest of scenario.quests ?? []) {
    questEntities[quest.id] = spawnGameboardQuest(world, quest);
  }

  return {
    scenario,
    plan,
    spawnGroups,
    patrolRoutes,
    world,
    actorEntities,
    questEntities,
    actors: readGameboardActors(world),
    quests: readGameboardQuests(world),
  };
}

/** Resolves scenario actors against spawn groups without creating entities. */
export function resolveGameboardScenarioActors(
  actors: readonly GameboardScenarioActor[] = [],
  spawnGroups?: GameboardSpawnGroupPlan
): ResolvedGameboardScenarioActor[] {
  const spawnAllocations: ScenarioSpawnAllocations = new Map();
  return actors.map((actor) => {
    const resolution = resolveScenarioActorSpawn(actor, spawnGroups, spawnAllocations);
    if (resolution.errorCode) {
      throw new Error(resolution.errorMessage);
    }
    if (!resolution.at) {
      throw new Error(`Scenario actor ${actor.actorId} has no resolved spawn tile`);
    }

    return resolvedScenarioActor(actor, resolution);
  });
}

type ScenarioSpawnLocation = GameboardSpawnGroupPlan['groups'][number]['locations'][number];

interface ScenarioSpawnAllocationState {
  nextIndex: number;
  claimedIndexes: Set<number>;
  claimedBy: Map<number, string>;
}

type ScenarioSpawnAllocations = Map<string, ScenarioSpawnAllocationState>;

interface ScenarioActorSpawnResolution {
  at?: SpawnGameboardActorOptions['at'];
  spawnGroupId?: string;
  spawnLocationIndex?: number;
  spawnLocation?: ScenarioSpawnLocation;
  errorCode?: string;
  errorMessage: string;
}

function resolveScenarioActorSpawn(
  actor: GameboardScenarioActor,
  spawnGroups: GameboardSpawnGroupPlan | undefined,
  spawnAllocations: ScenarioSpawnAllocations
): ScenarioActorSpawnResolution {
  if (actor.at !== undefined && actor.spawnGroupId !== undefined) {
    return {
      errorCode: 'scenario.actor_spawn_conflict',
      errorMessage: `Scenario actor ${actor.actorId} cannot define both at and spawnGroupId`,
    };
  }
  if (actor.at !== undefined) {
    return {
      at: cloneActorTarget(actor.at),
      errorMessage: '',
    };
  }
  if (actor.spawnGroupId === undefined) {
    return {
      errorCode: 'scenario.actor_tile_key',
      errorMessage: `Scenario actor ${actor.actorId} has an invalid tile coordinate`,
    };
  }
  if (!isNonEmptyString(actor.spawnGroupId)) {
    return {
      errorCode: 'scenario.actor_spawn_group_id',
      errorMessage: `Scenario actor ${actor.actorId} references an empty spawn group id`,
    };
  }
  if (!spawnGroups) {
    return {
      errorCode: 'scenario.actor_spawn_group_missing',
      errorMessage: `Scenario actor ${actor.actorId} references spawn group ${actor.spawnGroupId}, but the scenario has no usable spawnGroups plan`,
    };
  }

  const group = spawnGroups.groups.find((candidate) => candidate.id === actor.spawnGroupId);
  if (!group) {
    return {
      errorCode: 'scenario.actor_spawn_group_unknown',
      errorMessage: `Scenario actor ${actor.actorId} references unknown spawn group ${actor.spawnGroupId}`,
    };
  }
  if (actor.spawnLocationIndex !== undefined && !isNonNegativeInteger(actor.spawnLocationIndex)) {
    return {
      errorCode: 'scenario.actor_spawn_location_index',
      errorMessage: `Scenario actor ${actor.actorId} uses invalid spawnLocationIndex ${String(actor.spawnLocationIndex)}`,
    };
  }

  const allocation = scenarioSpawnAllocationFor(spawnAllocations, group.id);
  const spawnLocationIndex =
    actor.spawnLocationIndex ?? nextAvailableScenarioSpawnIndex(allocation);
  const location = group.locations[spawnLocationIndex];
  if (!location) {
    return {
      errorCode: 'scenario.actor_spawn_location_missing',
      errorMessage: `Scenario actor ${actor.actorId} could not claim spawn location ${spawnLocationIndex} from group ${group.id}`,
    };
  }
  if (allocation.claimedIndexes.has(spawnLocationIndex)) {
    return {
      errorCode: 'scenario.actor_spawn_location_claimed',
      errorMessage: `Scenario actor ${actor.actorId} could not claim spawn location ${spawnLocationIndex} from group ${group.id}; already claimed by ${allocation.claimedBy.get(spawnLocationIndex) ?? 'another actor'}`,
    };
  }
  allocation.claimedIndexes.add(spawnLocationIndex);
  allocation.claimedBy.set(spawnLocationIndex, actor.actorId);
  advanceScenarioSpawnAllocation(allocation);

  return {
    at: { ...location.coordinates },
    spawnGroupId: group.id,
    spawnLocationIndex,
    spawnLocation: location,
    errorMessage: '',
  };
}

function resolvedScenarioActor(
  actor: GameboardScenarioActor,
  resolution: ScenarioActorSpawnResolution
): ResolvedGameboardScenarioActor {
  if (!resolution.at) {
    throw new Error(`Scenario actor ${actor.actorId} has no resolved spawn tile`);
  }
  const spawnMetadata =
    resolution.spawnGroupId && resolution.spawnLocation
      ? {
          scenarioSpawnGroupId: resolution.spawnGroupId,
          scenarioSpawnLocationIndex: resolution.spawnLocationIndex ?? 0,
          scenarioSpawnLocationId: resolution.spawnLocation.id,
          scenarioSpawnTileKey: resolution.spawnLocation.key,
        }
      : undefined;

  return {
    ...actor,
    at: cloneActorTarget(resolution.at),
    spawnGroupId: resolution.spawnGroupId ?? actor.spawnGroupId,
    spawnLocationIndex: resolution.spawnLocationIndex ?? actor.spawnLocationIndex,
    spawnLocationId: resolution.spawnLocation?.id,
    spawnTileKey: resolution.spawnLocation?.key,
    tags: actor.tags ? [...actor.tags] : undefined,
    metadata: spawnMetadata
      ? { ...(actor.metadata ?? {}), ...spawnMetadata }
      : actor.metadata
        ? { ...actor.metadata }
        : undefined,
    actorMetadata: spawnMetadata
      ? { ...(actor.actorMetadata ?? {}), ...spawnMetadata }
      : actor.actorMetadata
        ? { ...actor.actorMetadata }
        : undefined,
    movementAgent: actor.movementAgent ? cloneMovementAgent(actor.movementAgent) : undefined,
    patrolAgent: actor.patrolAgent ? clonePatrolAgent(actor.patrolAgent) : undefined,
  };
}

function scenarioSpawnAllocationFor(
  allocations: ScenarioSpawnAllocations,
  groupId: string
): ScenarioSpawnAllocationState {
  const existing = allocations.get(groupId);
  if (existing) {
    return existing;
  }
  const allocation: ScenarioSpawnAllocationState = {
    nextIndex: 0,
    claimedIndexes: new Set(),
    claimedBy: new Map(),
  };
  allocations.set(groupId, allocation);
  return allocation;
}

function nextAvailableScenarioSpawnIndex(allocation: ScenarioSpawnAllocationState): number {
  advanceScenarioSpawnAllocation(allocation);
  return allocation.nextIndex;
}

function advanceScenarioSpawnAllocation(allocation: ScenarioSpawnAllocationState): void {
  while (allocation.claimedIndexes.has(allocation.nextIndex)) {
    allocation.nextIndex += 1;
  }
}

function validateScenarioActor(
  violations: GameboardRuleViolation[],
  actor: GameboardScenarioActor,
  actorIds: Set<string>,
  tileKeys: ReadonlySet<string>,
  hasPlan: boolean,
  planConfig: GameboardPlanValidationConfig | undefined,
  spawnGroups: GameboardSpawnGroupPlan | undefined,
  spawnAllocations: ScenarioSpawnAllocations,
  authoredPatrolRouteIds: ReadonlySet<string>
): void {
  if (!isNonEmptyString(actor.actorId)) {
    violations.push({
      code: 'scenario.actor_id',
      severity: 'error',
      message: 'Scenario actor must include a non-empty actorId',
      placementId: actor.id,
    });
    return;
  }
  if (actorIds.has(actor.actorId)) {
    violations.push({
      code: 'scenario.actor_duplicate',
      severity: 'error',
      message: `Scenario actor ${actor.actorId} is declared more than once`,
      placementId: actor.id ?? actor.actorId,
    });
  }
  actorIds.add(actor.actorId);

  if (!isNonEmptyString(actor.assetId)) {
    violations.push({
      code: 'scenario.actor_asset',
      severity: 'error',
      message: `Scenario actor ${actor.actorId} must include a non-empty assetId`,
      placementId: actor.id ?? actor.actorId,
    });
  } else {
    validateScenarioActorAsset(violations, actor, planConfig);
  }
  if (!isNonEmptyString(actor.kind)) {
    violations.push({
      code: 'scenario.actor_kind',
      severity: 'error',
      message: `Scenario actor ${actor.actorId} must include a non-empty placement kind`,
      placementId: actor.id ?? actor.actorId,
    });
  }

  const resolution = resolveScenarioActorSpawn(actor, spawnGroups, spawnAllocations);
  if (resolution.errorCode) {
    violations.push({
      code: resolution.errorCode,
      severity: 'error',
      message: resolution.errorMessage,
      placementId: actor.id ?? actor.actorId,
    });
    return;
  }

  const actorTileKey = tileKeyFromScenarioTarget(resolution.at);
  if (!actorTileKey) {
    violations.push({
      code: 'scenario.actor_tile_key',
      severity: 'error',
      message: `Scenario actor ${actor.actorId} has an invalid tile coordinate`,
      placementId: actor.id ?? actor.actorId,
    });
    return;
  }
  if (hasPlan && !tileKeys.has(actorTileKey)) {
    violations.push({
      code: 'scenario.actor_missing_tile',
      severity: 'error',
      message: `Scenario actor ${actor.actorId} references missing tile ${actorTileKey}`,
      placementId: actor.id ?? actor.actorId,
      tileKey: actorTileKey,
    });
  }
  validateScenarioActorPatrolAgent(violations, actor, authoredPatrolRouteIds);
}

function validateScenarioActorPatrolAgent(
  violations: GameboardRuleViolation[],
  actor: GameboardScenarioActor,
  authoredPatrolRouteIds: ReadonlySet<string>
): void {
  if (!actor.patrolAgent) {
    return;
  }
  if (!isNonEmptyString(actor.patrolAgent.routeId)) {
    violations.push({
      code: 'scenario.actor_patrol_route_id',
      severity: 'error',
      message: `Scenario actor ${actor.actorId} patrolAgent must reference a non-empty routeId`,
      placementId: actor.id ?? actor.actorId,
    });
    return;
  }
  if (!authoredPatrolRouteIds.has(actor.patrolAgent.routeId)) {
    violations.push({
      code: 'scenario.actor_patrol_route_unknown',
      severity: 'error',
      message: `Scenario actor ${actor.actorId} references unknown patrol route ${actor.patrolAgent.routeId}`,
      placementId: actor.id ?? actor.actorId,
    });
  }
}

function validateScenarioActorAsset(
  violations: GameboardRuleViolation[],
  actor: GameboardScenarioActor,
  planConfig: GameboardPlanValidationConfig | undefined
): void {
  const catalog = planConfig?.assetCatalog;
  if (!catalog) {
    return;
  }
  const asset = getManifestAsset(catalog, actor.assetId);
  if (!asset) {
    if (planConfig.allowUnknownAssets || planConfig.allowUnknownAssetIds?.includes(actor.assetId)) {
      return;
    }
    violations.push({
      code: 'scenario.actor_unknown_asset',
      severity: 'error',
      placementId: actor.id ?? actor.actorId,
      message: `Scenario actor ${actor.actorId} asset ${actor.assetId} is not present in the provided asset manifest`,
    });
    return;
  }
  if (
    planConfig.requireExtraAssetFlags !== false &&
    asset.edition === 'extra' &&
    !actor.requiresExtra
  ) {
    violations.push({
      code: 'scenario.actor_extra_flag_missing',
      severity: 'error',
      placementId: actor.id ?? actor.actorId,
      message: `Scenario actor ${actor.actorId} uses EXTRA asset ${actor.assetId} without requiresExtra`,
    });
  }
  if (asset.edition === 'free' && actor.requiresExtra) {
    violations.push({
      code: 'scenario.actor_extra_flag_unnecessary',
      severity: 'warning',
      placementId: actor.id ?? actor.actorId,
      message: `Scenario actor ${actor.actorId} marks FREE asset ${actor.assetId} as requiresExtra`,
    });
  }
}

function validateScenarioQuest(
  violations: GameboardRuleViolation[],
  quest: GameboardQuestDefinition,
  questIds: Set<string>,
  objectiveIdsByQuest: Map<string, Set<string>>,
  actorIds: ReadonlySet<string>,
  tileKeys: ReadonlySet<string>,
  hasPlan: boolean
): void {
  if (!isNonEmptyString(quest.id)) {
    violations.push({
      code: 'scenario.quest_id',
      severity: 'error',
      message: 'Scenario quest must include a non-empty id',
    });
    return;
  }
  if (questIds.has(quest.id)) {
    violations.push({
      code: 'scenario.quest_duplicate',
      severity: 'error',
      message: `Scenario quest ${quest.id} is declared more than once`,
    });
  }
  questIds.add(quest.id);

  const objectiveIds = objectiveIdsByQuest.get(quest.id) ?? new Set<string>();
  objectiveIdsByQuest.set(quest.id, objectiveIds);
  for (const objective of quest.objectives ?? []) {
    validateScenarioObjective(
      violations,
      quest.id,
      objective,
      objectiveIds,
      actorIds,
      tileKeys,
      hasPlan
    );
  }
}

function validateScenarioObjective(
  violations: GameboardRuleViolation[],
  questId: string,
  objective: GameboardQuestDefinition['objectives'][number],
  objectiveIds: Set<string>,
  actorIds: ReadonlySet<string>,
  tileKeys: ReadonlySet<string>,
  hasPlan: boolean
): void {
  if (!isNonEmptyString(objective.id)) {
    violations.push({
      code: 'scenario.objective_id',
      severity: 'error',
      message: `Scenario quest ${questId} has an objective without a non-empty id`,
    });
    return;
  }
  if (objectiveIds.has(objective.id)) {
    violations.push({
      code: 'scenario.objective_duplicate',
      severity: 'error',
      message: `Scenario quest ${questId} objective ${objective.id} is declared more than once`,
    });
  }
  objectiveIds.add(objective.id);

  if ('actor' in objective && objective.actor && !actorIds.has(objective.actor)) {
    violations.push({
      code: 'scenario.objective_missing_actor',
      severity: 'error',
      message: `Scenario quest ${questId} objective ${objective.id} references missing actor ${objective.actor}`,
    });
  }
  if ('targetActor' in objective && objective.targetActor && !actorIds.has(objective.targetActor)) {
    violations.push({
      code: 'scenario.objective_missing_target_actor',
      severity: 'error',
      message: `Scenario quest ${questId} objective ${objective.id} references missing target actor ${objective.targetActor}`,
    });
  }
  if (objective.kind === 'collision' && !objective.targetActor && !objective.targetTile) {
    violations.push({
      code: 'scenario.objective_missing_collision_target',
      severity: 'error',
      message: `Scenario quest ${questId} objective ${objective.id} needs targetActor or targetTile`,
    });
  }

  const tile =
    'tile' in objective
      ? objective.tile
      : 'targetTile' in objective
        ? objective.targetTile
        : undefined;
  if (tile === undefined) {
    return;
  }
  const objectiveTileKey = tileKeyFromScenarioTarget(tile);
  if (!objectiveTileKey) {
    violations.push({
      code: 'scenario.objective_tile_key',
      severity: 'error',
      message: `Scenario quest ${questId} objective ${objective.id} has an invalid tile coordinate`,
    });
    return;
  }
  if (hasPlan && !tileKeys.has(objectiveTileKey)) {
    violations.push({
      code: 'scenario.objective_missing_tile',
      severity: 'error',
      message: `Scenario quest ${questId} objective ${objective.id} references missing tile ${objectiveTileKey}`,
      tileKey: objectiveTileKey,
    });
  }
}

function tileKeyFromScenarioTarget(target: unknown): string | undefined {
  if (typeof target === 'string') {
    try {
      return hexKey(parseHexKey(target));
    } catch {
      return undefined;
    }
  }
  if (
    target &&
    typeof target === 'object' &&
    Number.isFinite((target as { q?: unknown }).q) &&
    Number.isFinite((target as { r?: unknown }).r)
  ) {
    return hexKey({
      q: Number((target as { q: number }).q),
      r: Number((target as { r: number }).r),
    });
  }
  return undefined;
}

function spawnGroupViolations(spawnGroups: GameboardSpawnGroupPlan): GameboardRuleViolation[] {
  return [
    ...spawnGroups.errors.map((message) => ({
      code: 'scenario.spawn_group',
      severity: 'error' as const,
      message,
    })),
    ...spawnGroups.warnings.map((message) => ({
      code: 'scenario.spawn_group',
      severity: 'warning' as const,
      message,
    })),
  ];
}

function patrolRouteViolations(patrolRoutes: GameboardPatrolRouteSet): GameboardRuleViolation[] {
  return [
    ...patrolRoutes.errors.map((message) => ({
      code: 'scenario.patrol_route',
      severity: 'error' as const,
      message,
    })),
    ...patrolRoutes.warnings.map((message) => ({
      code: 'scenario.patrol_route',
      severity: 'warning' as const,
      message,
    })),
  ];
}

function cloneActorTarget(
  target: SpawnGameboardActorOptions['at']
): SpawnGameboardActorOptions['at'] {
  return typeof target === 'string' ? target : { ...target };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function cloneScenarioActor(actor: GameboardScenarioActor): GameboardScenarioActor {
  return {
    ...actor,
    at: actor.at === undefined ? undefined : cloneActorTarget(actor.at),
    tags: actor.tags ? [...actor.tags] : undefined,
    metadata: actor.metadata ? { ...actor.metadata } : undefined,
    actorMetadata: actor.actorMetadata ? { ...actor.actorMetadata } : undefined,
    movementAgent: actor.movementAgent ? cloneMovementAgent(actor.movementAgent) : undefined,
    patrolAgent: actor.patrolAgent ? clonePatrolAgent(actor.patrolAgent) : undefined,
  };
}

function cloneSpawnGroups(options: GameboardSpawnGroupOptions): GameboardSpawnGroupOptions {
  return {
    ...options,
    profile: options.profile ? cloneNavigationProfile(options.profile) : undefined,
    groups: options.groups.map((group) => ({
      ...group,
      profile: group.profile ? cloneNavigationProfile(group.profile) : undefined,
      routeProfile: group.routeProfile ? cloneNavigationProfile(group.routeProfile) : undefined,
      terrain: Array.isArray(group.terrain) ? [...group.terrain] : group.terrain,
      tileTags: group.tileTags ? [...group.tileTags] : undefined,
      excludeTileTags: group.excludeTileTags ? [...group.excludeTileTags] : undefined,
      pathToGroups: group.pathToGroups ? [...group.pathToGroups] : undefined,
    })),
  };
}

function clonePatrolRoute(route: GameboardScenarioPatrolRoute): GameboardScenarioPatrolRoute {
  return {
    ...route,
    start: route.start && typeof route.start === 'object' ? { ...route.start } : route.start,
    profile: route.profile ? cloneNavigationProfile(route.profile) : undefined,
    routeProfile: route.routeProfile ? cloneNavigationProfile(route.routeProfile) : undefined,
    terrain: Array.isArray(route.terrain) ? [...route.terrain] : route.terrain,
    tileTags: route.tileTags ? [...route.tileTags] : undefined,
    excludeTileTags: route.excludeTileTags ? [...route.excludeTileTags] : undefined,
  };
}

function cloneNavigationProfile(profile: GameboardNavigationProfile): GameboardNavigationProfile {
  return {
    ...profile,
    allowedTerrain: profile.allowedTerrain ? [...profile.allowedTerrain] : undefined,
    blockedTerrain: profile.blockedTerrain ? [...profile.blockedTerrain] : undefined,
    blockingPlacementKinds: profile.blockingPlacementKinds
      ? [...profile.blockingPlacementKinds]
      : undefined,
    blockingPlacementLayers: profile.blockingPlacementLayers
      ? [...profile.blockingPlacementLayers]
      : undefined,
    ignorePlacementIds: profile.ignorePlacementIds ? [...profile.ignorePlacementIds] : undefined,
    terrainCosts: profile.terrainCosts ? { ...profile.terrainCosts } : undefined,
  };
}

function cloneMovementAgent(
  options: SetGameboardMovementAgentOptions
): SetGameboardMovementAgentOptions {
  return {
    ...options,
    ignorePlacementIds: options.ignorePlacementIds ? [...options.ignorePlacementIds] : undefined,
    navigation: options.navigation
      ? {
          ...options.navigation,
          allowedTerrain: options.navigation.allowedTerrain
            ? [...options.navigation.allowedTerrain]
            : undefined,
          blockedTerrain: options.navigation.blockedTerrain
            ? [...options.navigation.blockedTerrain]
            : undefined,
          blockingPlacementKinds: options.navigation.blockingPlacementKinds
            ? [...options.navigation.blockingPlacementKinds]
            : undefined,
          blockingPlacementLayers: options.navigation.blockingPlacementLayers
            ? [...options.navigation.blockingPlacementLayers]
            : undefined,
          ignorePlacementIds: options.navigation.ignorePlacementIds
            ? [...options.navigation.ignorePlacementIds]
            : undefined,
        }
      : undefined,
  };
}

function clonePatrolAgent(
  options: GameboardScenarioActorPatrolAgent
): GameboardScenarioActorPatrolAgent {
  return {
    ...options,
    movement: options.movement ? cloneMovementAgent(options.movement) : undefined,
  };
}

function patrolOptionsWithoutRouteId(
  options: GameboardScenarioActorPatrolAgent
): Omit<GameboardScenarioActorPatrolAgent, 'routeId'> {
  return {
    alignToCurrentTile: options.alignToCurrentTile,
    currentWaypointIndex: options.currentWaypointIndex,
    active: options.active,
    pauseTicks: options.pauseTicks,
    movement: options.movement ? cloneMovementAgent(options.movement) : undefined,
  };
}

function cloneQuestDefinition(quest: GameboardQuestDefinition): GameboardQuestDefinition {
  return {
    ...quest,
    objectives: quest.objectives.map((objective) => ({ ...objective })),
    metadata: quest.metadata ? { ...quest.metadata } : undefined,
  };
}
