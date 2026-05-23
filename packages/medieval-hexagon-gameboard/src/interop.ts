import { edgeBetween, hexKey, neighbor, parseHexKey } from './coordinates';
import type { GameboardActorSnapshot } from './actors';
import {
  axialToWorld,
  createSpawnLocations,
  type SpawnLocation,
  type SpawnLocationOptions,
} from './grid';
import type { GameboardPlan, GameboardPlacementSpec, GameboardTileSpec } from './gameboard';
import {
  gameboardPlacementBlocksOccupancy,
  gameboardPlacementFootprintKeys,
  gameboardPlacementOccupancyGroup,
} from './occupancy';
import type { GameboardQuestObjective, GameboardQuestSnapshot } from './quests';
import { createGameboardPlanFromRecipe } from './recipe';
import {
  resolveGameboardScenarioActors,
  type GameboardScenario,
  type GameboardScenarioActor,
  type ResolvedGameboardScenarioActor,
} from './scenario';
import {
  planGameboardPatrolRoutes,
  planGameboardSpawnGroups,
  type GameboardPatrolRoutePlan,
  type GameboardPatrolRouteSegment,
  type GameboardPatrolWaypoint,
  type GameboardPatrolWaypointSource,
  type GameboardPatrolRouteSet,
  type GameboardSpawnGroupPlan,
  type GameboardSpawnGroupRoute,
} from './navigation';
import type {
  GameboardScenarioSimulationActorTargetsRecord,
  GameboardScenarioSimulationCommandRecord,
  GameboardScenarioSimulationMovementRecord,
  GameboardScenarioSimulationMutationRecord,
  GameboardScenarioSimulationPatrolRecord,
  GameboardScenarioSimulationReport,
  GameboardScenarioSimulationStepReport,
} from './simulation';
import type { HexCoordinates, HexEdgeIndex, WorldPosition } from './types';

export type GameboardInteropEntityKind =
  | 'tile'
  | 'placement'
  | 'spawn'
  | 'spawn-group'
  | 'patrol-route'
  | 'patrol-waypoint'
  | 'actor'
  | 'quest'
  | 'simulation'
  | 'simulation-step'
  | 'simulation-actor-targets'
  | 'simulation-command'
  | 'simulation-patrol'
  | 'simulation-movement'
  | 'simulation-mutation';

export interface GameboardInteropEntity {
  id: string;
  kind: GameboardInteropEntityKind;
  components: Readonly<Record<string, unknown>>;
}

export interface GameboardAdjacencyRecord {
  from: string;
  to: string;
  edge: HexEdgeIndex;
  reciprocalEdge: HexEdgeIndex;
}

export interface GameboardPlacementTileRecord {
  placementId: string;
  tileKey: string;
  coordinates: HexCoordinates;
}

export interface GameboardPlacementOccupancyRecord {
  placementId: string;
  tileKey: string;
  coordinates: HexCoordinates;
  originTileKey: string;
  footprintIndex: number;
  blocksMovement: boolean;
  occupancyGroup: string;
}

export interface GameboardSpawnTileRecord {
  spawnId: string;
  tileKey: string;
  coordinates: HexCoordinates;
}

export interface GameboardSpawnGroupRecord {
  groupId: string;
  requestedCount: number;
  selectedCount: number;
  candidateCount: number;
  rejectedByGroupDistanceCount: number;
  warnings: readonly string[];
  errors: readonly string[];
}

export interface GameboardSpawnGroupLocationRecord {
  groupId: string;
  spawnId: string;
  tileKey: string;
  coordinates: HexCoordinates;
  index: number;
}

export interface GameboardSpawnGroupRouteRecord extends GameboardSpawnGroupRoute {}

export interface GameboardPatrolRouteRecord {
  routeId: string;
  requestedWaypointCount: number;
  selectedWaypointCount: number;
  loop: boolean;
  found: boolean;
  cost: number;
  visited: number;
  pathKeys: readonly string[];
  warnings: readonly string[];
  errors: readonly string[];
}

export interface GameboardPatrolWaypointRecord {
  routeId: string;
  waypointId: string;
  tileKey: string;
  coordinates: HexCoordinates;
  index: number;
  source: GameboardPatrolWaypointSource;
  spawnGroupId?: string;
  spawnLocationIndex?: number;
}

export interface GameboardPatrolRouteSegmentRecord extends GameboardPatrolRouteSegment {
  routeId: string;
  segmentId: string;
}

export interface GameboardActorTileRecord {
  actorId: string;
  tileKey: string;
  coordinates: HexCoordinates;
}

export interface GameboardActorPlacementRecord {
  actorId: string;
  placementId: string;
}

export interface GameboardActorPatrolRouteRecord {
  actorId: string;
  routeId: string;
}

export type GameboardQuestActorReferenceRole = 'actor' | 'targetActor';

export interface GameboardQuestActorReferenceRecord {
  questId: string;
  objectiveId: string;
  actorId: string;
  role: GameboardQuestActorReferenceRole;
}

export type GameboardQuestTileReferenceRole = 'tile' | 'targetTile';

export interface GameboardQuestTileReferenceRecord {
  questId: string;
  objectiveId: string;
  tileKey: string;
  coordinates: HexCoordinates;
  role: GameboardQuestTileReferenceRole;
}

export interface GameboardInteropScenarioRecord {
  id: string;
  title?: string;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export type GameboardSimulationRelationRole =
  | 'step'
  | 'command'
  | 'patrol'
  | 'movement'
  | 'mutation'
  | 'actorTargets'
  | 'sourceActor'
  | 'targetActor'
  | 'effectActor'
  | 'effectPlacement'
  | 'actor'
  | 'placement';

export interface GameboardSimulationRelationRecord {
  scenarioId: string;
  role: GameboardSimulationRelationRole;
  stepIndex?: number;
  stepId?: string;
  recordId?: string;
  actorId?: string;
  placementId?: string;
  commandKind?: GameboardScenarioSimulationCommandRecord['command']['kind'];
  commandStatus?: GameboardScenarioSimulationCommandRecord['command']['status'];
  handlerId?: string;
  handlerStatus?: GameboardScenarioSimulationCommandRecord['command']['handlerStatus'];
  effectTypes?: NonNullable<GameboardScenarioSimulationCommandRecord['command']['effectTypes']>;
  mutationType?: GameboardScenarioSimulationMutationRecord['type'];
  targetReachable?: boolean;
  targetApproach?: GameboardScenarioSimulationActorTargetsRecord['targets'][number]['approach'];
  targetApproachTileKey?: string;
  targetPathCost?: number;
  targetCommandKind?: GameboardScenarioSimulationActorTargetsRecord['targets'][number]['commandKind'];
  targetCommandCanExecute?: boolean;
  effectType?: NonNullable<
    GameboardScenarioSimulationCommandRecord['command']['effectTypes']
  >[number];
}

export interface GameboardInteropSnapshot {
  schemaVersion: string;
  seed: string;
  scenario?: GameboardInteropScenarioRecord;
  entities: readonly GameboardInteropEntity[];
  adjacency: readonly GameboardAdjacencyRecord[];
  relations: readonly GameboardEcsRelation[];
  spawnLocations: readonly SpawnLocation[];
}

export interface GameboardInteropSnapshotIndex {
  entitiesById: ReadonlyMap<string, GameboardInteropEntity>;
  relations: readonly GameboardEcsRelation[];
  relationsByName: ReadonlyMap<GameboardEcsRelationName, readonly GameboardEcsRelation[]>;
  relationsFromId: ReadonlyMap<string, readonly GameboardEcsRelation[]>;
  relationsToId: ReadonlyMap<string, readonly GameboardEcsRelation[]>;
}

export interface GameboardInteropRelationFilter {
  name?: GameboardEcsRelationName;
  fromId?: string;
  toId?: string;
}

export interface GameboardInteropOptions {
  includePlacements?: boolean;
  spawnLocations?: Omit<SpawnLocationOptions, 'shape'>;
}

export interface GameboardScenarioInteropOptions extends GameboardInteropOptions {
  includeActors?: boolean;
  includeQuests?: boolean;
  includeSpawnGroups?: boolean;
  includePatrolRoutes?: boolean;
}

export interface GameboardSimulationInteropOptions extends GameboardInteropOptions {
  includeActors?: boolean;
  includeQuests?: boolean;
  includeTimeline?: boolean;
}

export interface GameboardRuntimeInteropState {
  plan: GameboardPlan;
  actors?: readonly GameboardActorSnapshot[];
  quests?: readonly GameboardQuestSnapshot[];
  scenario?: GameboardInteropScenarioRecord;
}

export interface GameboardRuntimeInteropOptions extends GameboardInteropOptions {
  includeActors?: boolean;
  includeQuests?: boolean;
}

export type GameboardEcsRelationName =
  | 'AdjacentTo'
  | 'PlacementOnTile'
  | 'PlacementOccupiesTile'
  | 'SpawnOnTile'
  | 'SpawnGroupHasLocation'
  | 'SpawnGroupRouteCheck'
  | 'PatrolRouteHasWaypoint'
  | 'PatrolWaypointOnTile'
  | 'PatrolRouteSegment'
  | 'ActorOnTile'
  | 'ActorPlacement'
  | 'ActorPatrolRoute'
  | 'QuestReferencesActor'
  | 'QuestTargetsTile'
  | 'SimulationHasStep'
  | 'SimulationStepActorTargets'
  | 'SimulationStepCommand'
  | 'SimulationStepPatrol'
  | 'SimulationStepMovement'
  | 'SimulationStepMutation'
  | 'CommandSourceActor'
  | 'CommandTargetActor'
  | 'ActorTargetsSourceActor'
  | 'ActorTargetsTargetActor'
  | 'CommandEffectActor'
  | 'CommandEffectPlacement'
  | 'PatrolActor'
  | 'PatrolPlacement'
  | 'MovementActor'
  | 'MovementPlacement'
  | 'MutationActor'
  | 'MutationPlacement';

export interface GameboardEcsRelation {
  name: GameboardEcsRelationName;
  fromId: string;
  toId: string;
  data:
    | GameboardAdjacencyRecord
    | GameboardPlacementTileRecord
    | GameboardPlacementOccupancyRecord
    | GameboardSpawnTileRecord
    | GameboardSpawnGroupLocationRecord
    | GameboardSpawnGroupRouteRecord
    | GameboardPatrolWaypointRecord
    | GameboardPatrolRouteSegmentRecord
    | GameboardActorTileRecord
    | GameboardActorPlacementRecord
    | GameboardActorPatrolRouteRecord
    | GameboardQuestActorReferenceRecord
    | GameboardQuestTileReferenceRecord
    | GameboardSimulationRelationRecord;
}

export interface GameboardEcsAdapter<TEntity> {
  createEntity: (entity: GameboardInteropEntity) => TEntity;
  addComponent?: (
    entity: TEntity,
    componentName: string,
    componentValue: unknown,
    source: GameboardInteropEntity
  ) => void;
  addRelation?: (from: TEntity, to: TEntity, relation: GameboardEcsRelation) => void;
}

export interface GameboardEcsMountResult<TEntity> {
  entitiesById: ReadonlyMap<string, TEntity>;
  missingRelations: readonly GameboardEcsRelation[];
}

export interface InMemoryGameboardEcsEntity {
  id: string;
  kind: GameboardInteropEntityKind;
  components: Map<string, unknown>;
  relations: GameboardEcsRelation[];
}

export interface InMemoryGameboardEcs {
  entities: Map<string, InMemoryGameboardEcsEntity>;
  adapter: GameboardEcsAdapter<InMemoryGameboardEcsEntity>;
}

export function createGameboardInteropSnapshot(
  plan: GameboardPlan,
  options: GameboardInteropOptions = {}
): GameboardInteropSnapshot {
  const tilesByKey = new Map(plan.tiles.map((tile) => [tile.key, tile]));
  const placements = (options.includePlacements ?? true) ? plan.placements : [];
  const spawnLocations = options.spawnLocations
    ? createSpawnLocations({
        ...options.spawnLocations,
        shape: plan.shape,
        candidates: spawnCandidates(plan, options.spawnLocations.candidates),
      })
    : [];
  const entities: GameboardInteropEntity[] = [
    ...plan.tiles.map(tileToInteropEntity),
    ...placements.map(placementToInteropEntity),
    ...spawnLocations.map((spawn) => spawnToInteropEntity(spawn)),
  ];
  const adjacency = plan.tiles.flatMap((tile) => adjacencyForTile(tile, tilesByKey));

  return {
    schemaVersion: plan.schemaVersion,
    seed: plan.seed,
    entities,
    adjacency,
    relations: [
      ...adjacency.map(adjacencyRelation),
      ...placements.map(placementTileRelation),
      ...placements.flatMap((placement) => placementOccupancyRelations(placement, tilesByKey)),
      ...spawnLocations.map(spawnTileRelation),
    ],
    spawnLocations,
  };
}

export function createGameboardScenarioInteropSnapshot(
  scenario: GameboardScenario,
  options: GameboardScenarioInteropOptions = {}
): GameboardInteropSnapshot {
  const plan = createGameboardPlanFromRecipe(scenario.board);
  const snapshot = createGameboardInteropSnapshot(plan, options);
  const spawnGroups = scenario.spawnGroups
    ? planGameboardSpawnGroups(plan, scenario.spawnGroups)
    : undefined;
  if (spawnGroups?.errors.length) {
    throw new Error(
      `Scenario ${scenario.id} spawn groups failed: ${spawnGroups.errors.join('; ')}`
    );
  }
  const includePatrolRoutes = options.includePatrolRoutes ?? true;
  const patrolRoutes =
    includePatrolRoutes && scenario.patrolRoutes?.length
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
  const actors =
    options.includeActors === false
      ? []
      : resolveGameboardScenarioActors(scenario.actors ?? [], spawnGroups);
  const quests = options.includeQuests === false ? [] : (scenario.quests ?? []);
  const includeSpawnGroups = options.includeSpawnGroups ?? true;
  const scenarioSpawnLocations = includeSpawnGroups
    ? (spawnGroups?.groups.flatMap((group) => [...group.locations]) ?? [])
    : [];
  const tilesByKey = new Map(plan.tiles.map((tile) => [tile.key, tile]));

  return {
    ...snapshot,
    scenario: {
      id: scenario.id,
      title: scenario.title,
      metadata: { ...(scenario.metadata ?? {}) },
    },
    spawnLocations: [...snapshot.spawnLocations, ...scenarioSpawnLocations],
    entities: [
      ...snapshot.entities,
      ...(includeSpawnGroups && spawnGroups
        ? [
            ...spawnGroupEntities(spawnGroups),
            ...scenarioSpawnLocations.map((spawn) =>
              spawnToInteropEntity(spawn, {
                source: 'scenario-spawn-group',
                groupId: spawnGroupIdForLocation(spawnGroups, spawn.id),
              })
            ),
          ]
        : []),
      ...(patrolRoutes ? patrolRouteEntities(patrolRoutes, tilesByKey) : []),
      ...actors.map((actor) => actorToInteropEntity(actor, tilesByKey)),
      ...quests.map((quest) => ({
        id: `quest:${quest.id}`,
        kind: 'quest' as const,
        components: {
          GameboardQuestDefinition: {
            ...quest,
            objectives: quest.objectives.map((objective) => ({ ...objective })),
            metadata: { ...(quest.metadata ?? {}) },
          },
          QuestObjectiveList: quest.objectives.map((objective) => ({ ...objective })),
        },
      })),
    ],
    relations: [
      ...snapshot.relations,
      ...scenarioSpawnLocations.map(spawnTileRelation),
      ...(includeSpawnGroups && spawnGroups ? spawnGroupRelations(spawnGroups) : []),
      ...(patrolRoutes ? patrolRouteRelations(patrolRoutes) : []),
      ...actors.flatMap(actorTileRelation),
      ...(patrolRoutes
        ? actors.flatMap((actor) => actorPatrolRouteRelations(actor, patrolRoutes))
        : []),
      ...quests.flatMap(questReferences),
    ],
  };
}

export function createGameboardSimulationInteropSnapshot(
  report: GameboardScenarioSimulationReport,
  options: GameboardSimulationInteropOptions = {}
): GameboardInteropSnapshot {
  const base = createGameboardInteropSnapshot(report.finalPlan, options);
  const includeActors = options.includeActors ?? true;
  const includeQuests = options.includeQuests ?? true;
  const includeTimeline = options.includeTimeline ?? true;
  const tileByKey = new Map(report.finalPlan.tiles.map((tile) => [tile.key, tile]));
  const placementById = new Map(
    report.finalPlan.placements.map((placement) => [placement.id, placement])
  );
  const baseEntityIds = new Set(base.entities.map((entity) => entity.id));
  const entities = [
    ...base.entities,
    simulationReportEntity(report),
    ...(includeActors ? simulationActorEntities(report, placementById, baseEntityIds) : []),
    ...(includeQuests ? report.quests.map(simulationQuestEntity) : []),
    ...(includeTimeline ? simulationTimelineEntities(report) : []),
  ];

  return {
    ...base,
    scenario: {
      id: report.scenarioId,
      title: report.scenarioTitle,
      metadata: {
        success: report.success,
        source: 'simulation-report',
      },
    },
    entities,
    relations: [
      ...base.relations,
      ...(includeActors ? simulationActorRelations(report, tileByKey) : []),
      ...(includeQuests
        ? report.quests.flatMap((quest) =>
            questReferences({ id: quest.questId, objectives: quest.objectives })
          )
        : []),
      ...(includeTimeline ? simulationTimelineRelations(report, entities) : []),
    ],
  };
}

export function createGameboardRuntimeInteropSnapshot(
  state: GameboardRuntimeInteropState,
  options: GameboardRuntimeInteropOptions = {}
): GameboardInteropSnapshot {
  const base = createGameboardInteropSnapshot(state.plan, options);
  const actors = options.includeActors === false ? [] : (state.actors ?? []);
  const quests = options.includeQuests === false ? [] : (state.quests ?? []);
  const actorEntities = actors.map(actorSnapshotToInteropEntity);
  const questEntities = quests.map(questSnapshotToInteropEntity);
  const entities = [...base.entities, ...actorEntities, ...questEntities];
  const entityIds = new Set(entities.map((entity) => entity.id));
  const relations = [
    ...base.relations,
    ...runtimeActorRelations(actors, entityIds),
    ...runtimeQuestRelations(quests, entityIds),
  ];

  return {
    ...base,
    scenario: state.scenario ?? base.scenario,
    entities,
    relations,
  };
}

export function indexGameboardInteropSnapshot(
  snapshot: GameboardInteropSnapshot
): ReadonlyMap<string, GameboardInteropEntity> {
  return createGameboardInteropSnapshotIndex(snapshot).entitiesById;
}

export function createGameboardInteropSnapshotIndex(
  snapshot: GameboardInteropSnapshot
): GameboardInteropSnapshotIndex {
  const entitiesById = new Map(snapshot.entities.map((entity) => [entity.id, entity]));
  const relationsByName = new Map<GameboardEcsRelationName, GameboardEcsRelation[]>();
  const relationsFromId = new Map<string, GameboardEcsRelation[]>();
  const relationsToId = new Map<string, GameboardEcsRelation[]>();

  for (const relation of snapshot.relations) {
    pushIndexedRelation(relationsByName, relation.name, relation);
    pushIndexedRelation(relationsFromId, relation.fromId, relation);
    pushIndexedRelation(relationsToId, relation.toId, relation);
  }

  return {
    entitiesById,
    relations: snapshot.relations,
    relationsByName,
    relationsFromId,
    relationsToId,
  };
}

export function selectGameboardInteropRelations(
  source: GameboardInteropSnapshot | GameboardInteropSnapshotIndex,
  filter: GameboardInteropRelationFilter = {}
): GameboardEcsRelation[] {
  const index = isGameboardInteropSnapshotIndex(source)
    ? source
    : createGameboardInteropSnapshotIndex(source);
  const candidates =
    (filter.fromId ? index.relationsFromId.get(filter.fromId) : undefined) ??
    (filter.toId ? index.relationsToId.get(filter.toId) : undefined) ??
    (filter.name ? index.relationsByName.get(filter.name) : undefined) ??
    index.relations;

  return candidates.filter(
    (relation) =>
      (!filter.name || relation.name === filter.name) &&
      (!filter.fromId || relation.fromId === filter.fromId) &&
      (!filter.toId || relation.toId === filter.toId)
  );
}

export function mountGameboardInteropSnapshot<TEntity>(
  snapshot: GameboardInteropSnapshot,
  adapter: GameboardEcsAdapter<TEntity>
): GameboardEcsMountResult<TEntity> {
  const entitiesById = new Map<string, TEntity>();

  for (const entity of snapshot.entities) {
    const mounted = adapter.createEntity(entity);
    entitiesById.set(entity.id, mounted);
    for (const [componentName, componentValue] of Object.entries(entity.components)) {
      adapter.addComponent?.(mounted, componentName, componentValue, entity);
    }
  }

  const missingRelations: GameboardEcsRelation[] = [];
  const relations = snapshot.relations ?? snapshot.adjacency.map(adjacencyRelation);
  for (const relation of relations) {
    const from = entitiesById.get(relation.fromId);
    const to = entitiesById.get(relation.toId);
    if (!from || !to) {
      missingRelations.push(relation);
      continue;
    }
    adapter.addRelation?.(from, to, relation);
  }

  return {
    entitiesById,
    missingRelations,
  };
}

export function createInMemoryGameboardEcs(): InMemoryGameboardEcs {
  const entities = new Map<string, InMemoryGameboardEcsEntity>();
  return {
    entities,
    adapter: {
      createEntity: (entity) => {
        const mounted: InMemoryGameboardEcsEntity = {
          id: entity.id,
          kind: entity.kind,
          components: new Map(),
          relations: [],
        };
        entities.set(entity.id, mounted);
        return mounted;
      },
      addComponent: (entity, componentName, componentValue) => {
        entity.components.set(componentName, componentValue);
      },
      addRelation: (from, _to, relation) => {
        from.relations.push(relation);
      },
    },
  };
}

function pushIndexedRelation<TKey>(
  index: Map<TKey, GameboardEcsRelation[]>,
  key: TKey,
  relation: GameboardEcsRelation
): void {
  const existing = index.get(key);
  if (existing) {
    existing.push(relation);
    return;
  }
  index.set(key, [relation]);
}

function isGameboardInteropSnapshotIndex(
  source: GameboardInteropSnapshot | GameboardInteropSnapshotIndex
): source is GameboardInteropSnapshotIndex {
  return 'entitiesById' in source && 'relationsByName' in source;
}

function spawnToInteropEntity(
  spawn: SpawnLocation,
  metadata: { source?: string; groupId?: string } = {}
): GameboardInteropEntity {
  return {
    id: spawn.id,
    kind: 'spawn',
    components: {
      SpawnLocation: {
        ...spawn,
        coordinates: { ...spawn.coordinates },
        position: { ...spawn.position },
      },
      TileCoordinates: { ...spawn.coordinates },
      ...(metadata.source || metadata.groupId
        ? {
            ScenarioSpawnGroupLocation: {
              source: metadata.source,
              groupId: metadata.groupId,
              spawnId: spawn.id,
              tileKey: spawn.key,
              coordinates: { ...spawn.coordinates },
            },
          }
        : {}),
    },
  };
}

function spawnGroupEntities(spawnGroups: GameboardSpawnGroupPlan): GameboardInteropEntity[] {
  return spawnGroups.groups.map((group) => ({
    id: spawnGroupEntityId(group.id),
    kind: 'spawn-group' as const,
    components: {
      SpawnGroup: {
        groupId: group.id,
        requestedCount: group.requestedCount,
        selectedCount: group.selectedCount,
        candidateCount: group.candidateCount,
        rejectedByGroupDistanceCount: group.rejectedByGroupDistanceCount,
        warnings: [...group.warnings],
        errors: [...group.errors],
      } satisfies GameboardSpawnGroupRecord,
      SpawnLocationList: group.locations.map((location, index) =>
        spawnGroupLocationRecord(group.id, location, index)
      ),
      SpawnRouteCheckList: group.routeChecks.map(spawnGroupRouteRecord),
    },
  }));
}

function spawnGroupRelations(spawnGroups: GameboardSpawnGroupPlan): GameboardEcsRelation[] {
  return spawnGroups.groups.flatMap((group) => [
    ...group.locations.map((location, index) =>
      spawnGroupLocationRelation(group.id, location, index)
    ),
    ...group.routeChecks.map(spawnGroupRouteRelation),
  ]);
}

function patrolRouteEntities(
  patrolRoutes: GameboardPatrolRouteSet,
  tilesByKey: ReadonlyMap<string, GameboardTileSpec>
): GameboardInteropEntity[] {
  return patrolRoutes.routes.flatMap((route) => [
    {
      id: patrolRouteEntityId(route.id),
      kind: 'patrol-route' as const,
      components: {
        PatrolRoute: patrolRouteRecord(route),
        PatrolWaypointList: route.waypoints.map((waypoint) =>
          patrolWaypointRecord(route.id, waypoint)
        ),
        PatrolSegmentList: route.segments.map((segment) => patrolSegmentRecord(route.id, segment)),
      },
    },
    ...route.waypoints.map((waypoint) =>
      patrolWaypointToInteropEntity(route.id, waypoint, tilesByKey)
    ),
  ]);
}

function patrolRouteRelations(patrolRoutes: GameboardPatrolRouteSet): GameboardEcsRelation[] {
  return patrolRoutes.routes.flatMap((route) => [
    ...route.waypoints.map((waypoint) => patrolWaypointRelation(route.id, waypoint)),
    ...route.waypoints.map((waypoint) => patrolWaypointTileRelation(route.id, waypoint)),
    ...route.segments.map((segment) => patrolSegmentRelation(route.id, segment)),
  ]);
}

function tileToInteropEntity(tile: GameboardTileSpec): GameboardInteropEntity {
  return {
    id: `tile:${tile.key}`,
    kind: 'tile',
    components: {
      TileCoordinates: tile.coordinates,
      TileTerrain: { terrain: tile.terrain },
      TileElevation: {
        elevation: tile.elevation,
        baseAssetId: tile.baseAssetId,
        supportAssetId: tile.supportAssetId,
      },
      TileConnectivity: {
        roadEdges: tile.roadEdges,
        riverEdges: tile.riverEdges,
        coastEdges: tile.coastEdges,
        roadSlope: tile.roadSlope,
        riverWaterless: tile.riverWaterless,
        riverCurvy: tile.riverCurvy,
        riverCrossing: tile.riverCrossing,
        coastWaterless: tile.coastWaterless,
      },
      TileRenderState: { textureSet: tile.textureSet },
      TileTagList: [...tile.tags],
    },
  };
}

function placementToInteropEntity(placement: GameboardPlacementSpec): GameboardInteropEntity {
  const footprintTileKeys = gameboardPlacementFootprintKeys(placement);
  return {
    id: `placement:${placement.id}`,
    kind: 'placement',
    components: {
      PlacementState: placement,
      TileCoordinates: placement.coordinates,
      WorldPosition: placement.position,
      PlacementOccupancy: {
        originTileKey: placement.tileKey,
        footprintTileKeys,
        blocksMovement: gameboardPlacementBlocksOccupancy(placement),
        occupancyGroup: gameboardPlacementOccupancyGroup(placement),
      },
    },
  };
}

function actorToInteropEntity(
  actor: ResolvedGameboardScenarioActor,
  tilesByKey: ReadonlyMap<string, GameboardTileSpec>
): GameboardInteropEntity {
  return {
    id: `actor:${actor.actorId}`,
    kind: 'actor',
    components: {
      ScenarioActor: cloneScenarioActor(actor),
      TileCoordinates: normalizeCoordinates(actor.at),
      WorldPosition: actorWorldPosition(actor, tilesByKey),
      ActorPlacementSeed: {
        id: actor.id ?? actor.actorId,
        actorId: actor.actorId,
        actorKind: actor.actorKind,
        assetId: actor.assetId,
        kind: actor.kind,
        layer: actor.layer,
        rotationSteps: actor.rotationSteps,
        scale: actor.scale,
        order: actor.order,
        stackIndex: actor.stackIndex,
        elevationOffset: actor.elevationOffset,
        positionOffset: actor.positionOffset ? { ...actor.positionOffset } : undefined,
        tags: actor.tags ? [...actor.tags] : undefined,
        requiresExtra: actor.requiresExtra,
      },
      MovementAgentDefinition: actor.movementAgent
        ? cloneMovementAgent(actor.movementAgent)
        : undefined,
      PatrolAgentDefinition: actor.patrolAgent ? clonePatrolAgent(actor.patrolAgent) : undefined,
    },
  };
}

function simulationReportEntity(report: GameboardScenarioSimulationReport): GameboardInteropEntity {
  return {
    id: simulationEntityId(report.scenarioId),
    kind: 'simulation',
    components: {
      GameboardSimulationReport: {
        schemaVersion: report.schemaVersion,
        scenarioId: report.scenarioId,
        scenarioTitle: report.scenarioTitle,
        success: report.success,
        stepCount: report.steps.length,
        eventCount: report.eventRecords.length,
        actorTargetCount: report.actorTargets.length,
        commandCount: report.commands.length,
        patrolCount: report.patrols.length,
        movementCount: report.movements.length,
        mutationCount: report.mutations.length,
        expectationFailures: report.expectationFailures.map((failure) => ({ ...failure })),
      },
    },
  };
}

function simulationActorEntities(
  report: GameboardScenarioSimulationReport,
  placementById: ReadonlyMap<string, GameboardPlacementSpec>,
  existingEntityIds: ReadonlySet<string>
): GameboardInteropEntity[] {
  const actors = report.actors.map((actor) => {
    const placement = placementById.get(actor.placement.placementId);
    return {
      id: `actor:${actor.actorId}`,
      kind: 'actor' as const,
      components: {
        GameboardActorState: {
          actorId: actor.actorId,
          kind: actor.kind,
          faction: actor.faction,
          team: actor.team,
          hostile: actor.hostile,
          blocksMovement: actor.blocksMovement,
          interactive: actor.interactive,
          tags: [...actor.tags],
          metadata: { ...actor.metadata },
          placement: actor.placement,
          exists: true,
        },
        TileCoordinates: placement?.coordinates ?? normalizeCoordinates(actor.placement.tileKey),
        WorldPosition: placement?.position,
        ActorPlacementState: actor.placement,
      },
    };
  });
  return addTimelineReferenceEntities(actors, report, existingEntityIds);
}

function actorSnapshotToInteropEntity(actor: GameboardActorSnapshot): GameboardInteropEntity {
  return {
    id: actorEntityId(actor.actor.actorId) ?? `actor:${actor.actor.actorId}`,
    kind: 'actor',
    components: {
      GameboardActorState: {
        actorId: actor.actor.actorId,
        kind: actor.actor.kind,
        faction: actor.actor.faction,
        team: actor.actor.team,
        hostile: actor.actor.hostile,
        blocksMovement: actor.actor.blocksMovement,
        interactive: actor.actor.interactive,
        tags: [...actor.actor.tags],
        metadata: { ...actor.actor.metadata },
        placement: actor.placement,
        exists: true,
      },
      TileCoordinates: { ...actor.placement.coordinates },
      WorldPosition: { ...actor.placement.position },
      ActorPlacementState: actor.placement,
    },
  };
}

function simulationQuestEntity(
  quest: GameboardScenarioSimulationReport['quests'][number]
): GameboardInteropEntity {
  return {
    id: `quest:${quest.questId}`,
    kind: 'quest',
    components: {
      GameboardQuestState: {
        questId: quest.questId,
        title: quest.title,
        status: quest.status,
        activeObjectiveIndex: quest.activeObjectiveIndex,
        activeObjectiveId: quest.activeObjectiveId,
        metadata: { ...quest.metadata },
      },
      QuestObjectiveList: quest.objectives.map((objective) => ({ ...objective })),
      QuestProgressList: quest.progress.map((progress) => ({ ...progress })),
    },
  };
}

function questSnapshotToInteropEntity(quest: GameboardQuestSnapshot): GameboardInteropEntity {
  return {
    id: `quest:${quest.quest.questId}`,
    kind: 'quest',
    components: {
      GameboardQuestState: {
        questId: quest.quest.questId,
        title: quest.quest.title,
        status: quest.quest.status,
        activeObjectiveIndex: quest.quest.activeObjectiveIndex,
        activeObjectiveId: quest.quest.objectives[quest.quest.activeObjectiveIndex]?.id,
        metadata: { ...quest.quest.metadata },
      },
      QuestObjectiveList: quest.quest.objectives.map((objective) => ({ ...objective })),
      QuestProgressList: quest.quest.progress.map((progress) => ({ ...progress })),
    },
  };
}

function simulationTimelineEntities(
  report: GameboardScenarioSimulationReport
): GameboardInteropEntity[] {
  return [
    ...report.steps.map((step) => simulationStepEntity(report, step)),
    ...report.actorTargets.map((actorTargets, index) =>
      simulationActorTargetsEntity(report, actorTargets, index)
    ),
    ...report.commands.map((command, index) => simulationCommandEntity(report, command, index)),
    ...report.patrols.map((patrol, index) => simulationPatrolEntity(report, patrol, index)),
    ...report.movements.map((movement, index) => simulationMovementEntity(report, movement, index)),
    ...report.mutations.map((mutation, index) => simulationMutationEntity(report, mutation, index)),
  ];
}

function simulationStepEntity(
  report: GameboardScenarioSimulationReport,
  step: GameboardScenarioSimulationStepReport
): GameboardInteropEntity {
  return {
    id: simulationStepEntityId(report.scenarioId, step.index),
    kind: 'simulation-step',
    components: {
      GameboardSimulationStep: {
        index: step.index,
        id: step.id,
        label: step.label,
        action: step.action,
        eventTypes: step.eventRecords.map((eventRecord) => eventRecord.type),
        mutationCount: step.mutations.length,
      },
    },
  };
}

function simulationActorTargetsEntity(
  report: GameboardScenarioSimulationReport,
  actorTargets: GameboardScenarioSimulationActorTargetsRecord,
  index: number
): GameboardInteropEntity {
  return {
    id: simulationActorTargetsEntityId(report.scenarioId, index),
    kind: 'simulation-actor-targets',
    components: {
      GameboardSimulationActorTargets: {
        ...actorTargets,
        targetActorIds: [...actorTargets.targetActorIds],
        reachableActorIds: [...actorTargets.reachableActorIds],
        nearestTarget: actorTargets.nearestTarget ? { ...actorTargets.nearestTarget } : undefined,
        targets: actorTargets.targets.map((target) => ({ ...target, pathKeys: [...target.pathKeys] })),
      },
    },
  };
}

function simulationCommandEntity(
  report: GameboardScenarioSimulationReport,
  command: GameboardScenarioSimulationCommandRecord,
  index: number
): GameboardInteropEntity {
  return {
    id: simulationCommandEntityId(report.scenarioId, index),
    kind: 'simulation-command',
    components: {
      GameboardSimulationCommand: {
        ...command,
        command: { ...command.command, target: { ...command.command.target } },
      },
    },
  };
}

function simulationPatrolEntity(
  report: GameboardScenarioSimulationReport,
  patrol: GameboardScenarioSimulationPatrolRecord,
  index: number
): GameboardInteropEntity {
  return {
    id: simulationPatrolEntityId(report.scenarioId, index),
    kind: 'simulation-patrol',
    components: {
      GameboardSimulationPatrol: {
        ...patrol,
        patrol: { ...patrol.patrol },
      },
    },
  };
}

function simulationMovementEntity(
  report: GameboardScenarioSimulationReport,
  movement: GameboardScenarioSimulationMovementRecord,
  index: number
): GameboardInteropEntity {
  return {
    id: simulationMovementEntityId(report.scenarioId, index),
    kind: 'simulation-movement',
    components: {
      GameboardSimulationMovement: {
        ...movement,
        movement: {
          ...movement.movement,
          state: {
            ...movement.movement.state,
            pathKeys: [...movement.movement.state.pathKeys],
          },
        },
      },
    },
  };
}

function simulationMutationEntity(
  report: GameboardScenarioSimulationReport,
  mutation: GameboardScenarioSimulationMutationRecord,
  index: number
): GameboardInteropEntity {
  return {
    id: simulationMutationEntityId(report.scenarioId, index),
    kind: 'simulation-mutation',
    components: {
      GameboardSimulationMutation: { ...mutation },
    },
  };
}

function actorWorldPosition(
  actor: ResolvedGameboardScenarioActor,
  tilesByKey: ReadonlyMap<string, GameboardTileSpec>
): WorldPosition | undefined {
  const coordinates = normalizeCoordinates(actor.at);
  if (!coordinates) {
    return undefined;
  }
  const tile = tilesByKey.get(hexKey(coordinates));
  const position = axialToWorld(coordinates, (tile?.elevation ?? 0) + (actor.elevationOffset ?? 0));
  return {
    x: position.x + (actor.positionOffset?.x ?? 0),
    y: position.y + (actor.positionOffset?.y ?? 0),
    z: position.z + (actor.positionOffset?.z ?? 0),
  };
}

function adjacencyForTile(
  tile: GameboardTileSpec,
  tilesByKey: ReadonlyMap<string, GameboardTileSpec>
): GameboardAdjacencyRecord[] {
  const records: GameboardAdjacencyRecord[] = [];
  for (let edge = 0; edge < 6; edge += 1) {
    const adjacent = tilesByKey.get(hexKey(neighbor(tile.coordinates, edge)));
    if (!adjacent) {
      continue;
    }
    const reciprocalEdge = edgeBetween(adjacent.coordinates, tile.coordinates);
    if (reciprocalEdge === undefined) {
      continue;
    }
    records.push({
      from: tile.key,
      to: adjacent.key,
      edge: edge as HexEdgeIndex,
      reciprocalEdge,
    });
  }
  return records;
}

function adjacencyRelation(adjacency: GameboardAdjacencyRecord): GameboardEcsRelation {
  return {
    name: 'AdjacentTo',
    fromId: `tile:${adjacency.from}`,
    toId: `tile:${adjacency.to}`,
    data: adjacency,
  };
}

function placementTileRelation(placement: GameboardPlacementSpec): GameboardEcsRelation {
  return {
    name: 'PlacementOnTile',
    fromId: `placement:${placement.id}`,
    toId: `tile:${placement.tileKey}`,
    data: {
      placementId: placement.id,
      tileKey: placement.tileKey,
      coordinates: { ...placement.coordinates },
    },
  };
}

function placementOccupancyRelations(
  placement: GameboardPlacementSpec,
  tilesByKey: ReadonlyMap<string, GameboardTileSpec>
): readonly GameboardEcsRelation[] {
  return gameboardPlacementFootprintKeys(placement).flatMap((tileKey, footprintIndex) => {
    const tile = tilesByKey.get(tileKey);
    if (!tile) {
      return [];
    }
    return [
      {
        name: 'PlacementOccupiesTile',
        fromId: `placement:${placement.id}`,
        toId: `tile:${tileKey}`,
        data: {
          placementId: placement.id,
          tileKey,
          coordinates: { ...tile.coordinates },
          originTileKey: placement.tileKey,
          footprintIndex,
          blocksMovement: gameboardPlacementBlocksOccupancy(placement),
          occupancyGroup: gameboardPlacementOccupancyGroup(placement),
        },
      } satisfies GameboardEcsRelation,
    ];
  });
}

function spawnTileRelation(spawn: SpawnLocation): GameboardEcsRelation {
  const tileKey = hexKey(spawn.coordinates);
  return {
    name: 'SpawnOnTile',
    fromId: spawn.id,
    toId: `tile:${tileKey}`,
    data: {
      spawnId: spawn.id,
      tileKey,
      coordinates: { ...spawn.coordinates },
    },
  };
}

function spawnGroupLocationRelation(
  groupId: string,
  spawn: SpawnLocation,
  index: number
): GameboardEcsRelation {
  return {
    name: 'SpawnGroupHasLocation',
    fromId: spawnGroupEntityId(groupId),
    toId: spawn.id,
    data: spawnGroupLocationRecord(groupId, spawn, index),
  };
}

function spawnGroupRouteRelation(route: GameboardSpawnGroupRoute): GameboardEcsRelation {
  return {
    name: 'SpawnGroupRouteCheck',
    fromId: spawnGroupEntityId(route.fromGroupId),
    toId: spawnGroupEntityId(route.toGroupId),
    data: spawnGroupRouteRecord(route),
  };
}

function spawnGroupLocationRecord(
  groupId: string,
  spawn: SpawnLocation,
  index: number
): GameboardSpawnGroupLocationRecord {
  return {
    groupId,
    spawnId: spawn.id,
    tileKey: spawn.key,
    coordinates: { ...spawn.coordinates },
    index,
  };
}

function spawnGroupRouteRecord(route: GameboardSpawnGroupRoute): GameboardSpawnGroupRouteRecord {
  return {
    fromGroupId: route.fromGroupId,
    toGroupId: route.toGroupId,
    found: route.found,
    fromKey: route.fromKey,
    toKey: route.toKey,
    pathKeys: [...route.pathKeys],
    cost: route.cost,
    visited: route.visited,
  };
}

function patrolRouteRecord(route: GameboardPatrolRoutePlan): GameboardPatrolRouteRecord {
  return {
    routeId: route.id,
    requestedWaypointCount: route.requestedWaypointCount,
    selectedWaypointCount: route.selectedWaypointCount,
    loop: route.loop,
    found: route.found,
    cost: route.cost,
    visited: route.visited,
    pathKeys: [...route.pathKeys],
    warnings: [...route.warnings],
    errors: [...route.errors],
  };
}

function patrolWaypointToInteropEntity(
  routeId: string,
  waypoint: GameboardPatrolWaypoint,
  tilesByKey: ReadonlyMap<string, GameboardTileSpec>
): GameboardInteropEntity {
  const tile = tilesByKey.get(waypoint.key);
  return {
    id: patrolWaypointEntityId(routeId, waypoint.index),
    kind: 'patrol-waypoint' as const,
    components: {
      PatrolWaypoint: patrolWaypointRecord(routeId, waypoint),
      TileCoordinates: { ...waypoint.coordinates },
      WorldPosition: tile
        ? axialToWorld(tile.coordinates, tile.elevation)
        : { ...waypoint.position },
    },
  };
}

function patrolWaypointRelation(
  routeId: string,
  waypoint: GameboardPatrolWaypoint
): GameboardEcsRelation {
  return {
    name: 'PatrolRouteHasWaypoint',
    fromId: patrolRouteEntityId(routeId),
    toId: patrolWaypointEntityId(routeId, waypoint.index),
    data: patrolWaypointRecord(routeId, waypoint),
  };
}

function patrolWaypointTileRelation(
  routeId: string,
  waypoint: GameboardPatrolWaypoint
): GameboardEcsRelation {
  return {
    name: 'PatrolWaypointOnTile',
    fromId: patrolWaypointEntityId(routeId, waypoint.index),
    toId: `tile:${waypoint.key}`,
    data: patrolWaypointRecord(routeId, waypoint),
  };
}

function patrolSegmentRelation(
  routeId: string,
  segment: GameboardPatrolRouteSegment
): GameboardEcsRelation {
  return {
    name: 'PatrolRouteSegment',
    fromId: patrolWaypointEntityId(routeId, segment.fromIndex),
    toId: patrolWaypointEntityId(routeId, segment.toIndex),
    data: patrolSegmentRecord(routeId, segment),
  };
}

function patrolWaypointRecord(
  routeId: string,
  waypoint: GameboardPatrolWaypoint
): GameboardPatrolWaypointRecord {
  return {
    routeId,
    waypointId: patrolWaypointEntityId(routeId, waypoint.index),
    tileKey: waypoint.key,
    coordinates: { ...waypoint.coordinates },
    index: waypoint.index,
    source: waypoint.source,
    spawnGroupId: waypoint.spawnGroupId,
    spawnLocationIndex: waypoint.spawnLocationIndex,
  };
}

function patrolSegmentRecord(
  routeId: string,
  segment: GameboardPatrolRouteSegment
): GameboardPatrolRouteSegmentRecord {
  return {
    routeId,
    segmentId: `${patrolRouteEntityId(routeId)}:segment:${segment.fromIndex}-${segment.toIndex}`,
    fromIndex: segment.fromIndex,
    toIndex: segment.toIndex,
    fromKey: segment.fromKey,
    toKey: segment.toKey,
    found: segment.found,
    pathKeys: [...segment.pathKeys],
    cost: segment.cost,
    visited: segment.visited,
  };
}

function actorTileRelation(actor: ResolvedGameboardScenarioActor): readonly GameboardEcsRelation[] {
  const coordinates = normalizeCoordinates(actor.at);
  if (!coordinates) {
    return [];
  }
  const tileKey = hexKey(coordinates);
  return [
    {
      name: 'ActorOnTile',
      fromId: `actor:${actor.actorId}`,
      toId: `tile:${tileKey}`,
      data: {
        actorId: actor.actorId,
        tileKey,
        coordinates,
      },
    },
  ];
}

function actorPatrolRouteRelations(
  actor: ResolvedGameboardScenarioActor,
  patrolRoutes: GameboardPatrolRouteSet
): readonly GameboardEcsRelation[] {
  const routeId = actor.patrolAgent?.routeId;
  if (!routeId || !patrolRoutes.routes.some((route) => route.id === routeId)) {
    return [];
  }
  return [
    {
      name: 'ActorPatrolRoute',
      fromId: actorEntityId(actor.actorId) ?? `actor:${actor.actorId}`,
      toId: patrolRouteEntityId(routeId),
      data: {
        actorId: actor.actorId,
        routeId,
      },
    },
  ];
}

function simulationActorRelations(
  report: GameboardScenarioSimulationReport,
  tileByKey: ReadonlyMap<string, GameboardTileSpec>
): readonly GameboardEcsRelation[] {
  return report.actors.flatMap((actor) => {
    const tile = tileByKey.get(actor.placement.tileKey);
    const coordinates = tile?.coordinates ?? normalizeCoordinates(actor.placement.tileKey);
    const relations: GameboardEcsRelation[] = [];
    if (coordinates) {
      relations.push({
        name: 'ActorOnTile',
        fromId: `actor:${actor.actorId}`,
        toId: `tile:${actor.placement.tileKey}`,
        data: {
          actorId: actor.actorId,
          tileKey: actor.placement.tileKey,
          coordinates,
        },
      });
    }
    relations.push({
      name: 'ActorPlacement',
      fromId: `actor:${actor.actorId}`,
      toId: `placement:${actor.placement.placementId}`,
      data: {
        actorId: actor.actorId,
        placementId: actor.placement.placementId,
      },
    });
    return relations;
  });
}

function runtimeActorRelations(
  actors: readonly GameboardActorSnapshot[],
  entityIds: ReadonlySet<string>
): readonly GameboardEcsRelation[] {
  const relations: GameboardEcsRelation[] = [];
  for (const actor of actors) {
    const actorId = actorEntityId(actor.actor.actorId);
    if (!actorId || !entityIds.has(actorId)) {
      continue;
    }
    pushRelationIfPresent(relations, entityIds, {
      name: 'ActorOnTile',
      fromId: actorId,
      toId: `tile:${actor.placement.tileKey}`,
      data: {
        actorId: actor.actor.actorId,
        tileKey: actor.placement.tileKey,
        coordinates: { ...actor.placement.coordinates },
      },
    });
    pushRelationIfPresent(relations, entityIds, {
      name: 'ActorPlacement',
      fromId: actorId,
      toId: placementEntityId(actor.placement.id),
      data: {
        actorId: actor.actor.actorId,
        placementId: actor.placement.id,
      },
    });
  }
  return relations;
}

function runtimeQuestRelations(
  quests: readonly GameboardQuestSnapshot[],
  entityIds: ReadonlySet<string>
): readonly GameboardEcsRelation[] {
  return quests
    .flatMap((snapshot) =>
      questReferences({
        id: snapshot.quest.questId,
        objectives: snapshot.quest.objectives,
      })
    )
    .filter((relation) => entityIds.has(relation.fromId) && entityIds.has(relation.toId));
}

function questReferences(quest: {
  id: string;
  objectives: readonly GameboardQuestObjective[];
}): readonly GameboardEcsRelation[] {
  return quest.objectives.flatMap((objective) => [
    ...questActorReferences(quest.id, objective),
    ...questTileReferences(quest.id, objective),
  ]);
}

function simulationTimelineRelations(
  report: GameboardScenarioSimulationReport,
  entities: readonly GameboardInteropEntity[]
): readonly GameboardEcsRelation[] {
  const entityIds = new Set(entities.map((entity) => entity.id));
  const relations: GameboardEcsRelation[] = [];
  const simulationId = simulationEntityId(report.scenarioId);
  for (const step of report.steps) {
    relations.push({
      name: 'SimulationHasStep',
      fromId: simulationId,
      toId: simulationStepEntityId(report.scenarioId, step.index),
      data: simulationRelation(report, 'step', step),
    });
  }
  report.actorTargets.forEach((actorTargets, index) => {
    const actorTargetsId = simulationActorTargetsEntityId(report.scenarioId, index);
    const stepId = simulationStepEntityId(report.scenarioId, actorTargets.stepIndex);
    relations.push({
      name: 'SimulationStepActorTargets',
      fromId: stepId,
      toId: actorTargetsId,
      data: simulationRelation(report, 'actorTargets', actorTargets, actorTargetsId),
    });
    pushRelationIfPresent(relations, entityIds, {
      name: 'ActorTargetsSourceActor',
      fromId: actorTargetsId,
      toId: actorEntityId(actorTargets.sourceActorId),
      data: simulationRelation(report, 'sourceActor', actorTargets, actorTargetsId, {
        actorId: actorTargets.sourceActorId,
      }),
    });
    for (const target of actorTargets.targets) {
      pushRelationIfPresent(relations, entityIds, {
        name: 'ActorTargetsTargetActor',
        fromId: actorTargetsId,
        toId: actorEntityId(target.actorId),
        data: simulationRelation(report, 'targetActor', actorTargets, actorTargetsId, {
          actorId: target.actorId,
          placementId: target.placementId,
          targetReachable: target.reachable,
          targetApproach: target.approach,
          targetApproachTileKey: target.approachTileKey,
          targetPathCost: target.pathCost,
          targetCommandKind: target.commandKind,
          targetCommandCanExecute: target.commandCanExecute,
        }),
      });
    }
  });
  report.commands.forEach((command, index) => {
    const commandId = simulationCommandEntityId(report.scenarioId, index);
    const stepId = simulationStepEntityId(report.scenarioId, command.stepIndex);
    relations.push({
      name: 'SimulationStepCommand',
      fromId: stepId,
      toId: commandId,
      data: simulationRelation(
        report,
        'command',
        command,
        commandId,
        simulationCommandRelationFields(command)
      ),
    });
    pushRelationIfPresent(relations, entityIds, {
      name: 'CommandSourceActor',
      fromId: commandId,
      toId: actorEntityId(command.command.sourceActorId),
      data: simulationRelation(report, 'sourceActor', command, commandId, {
        ...simulationCommandRelationFields(command),
        actorId: command.command.sourceActorId,
      }),
    });
    const targetActorId = command.command.target.actorId ?? command.command.actorId;
    pushRelationIfPresent(relations, entityIds, {
      name: 'CommandTargetActor',
      fromId: commandId,
      toId: actorEntityId(targetActorId),
      data: simulationRelation(report, 'targetActor', command, commandId, {
        ...simulationCommandRelationFields(command),
        actorId: targetActorId,
      }),
    });
    for (const effect of command.command.effects ?? []) {
      if ('actorId' in effect) {
        pushRelationIfPresent(relations, entityIds, {
          name: 'CommandEffectActor',
          fromId: commandId,
          toId: actorEntityId(effect.actorId),
          data: simulationRelation(report, 'effectActor', command, commandId, {
            ...simulationCommandRelationFields(command),
            actorId: effect.actorId,
            effectType: effect.type,
          }),
        });
      }
      if ('placementId' in effect) {
        pushRelationIfPresent(relations, entityIds, {
          name: 'CommandEffectPlacement',
          fromId: commandId,
          toId: placementEntityId(effect.placementId),
          data: simulationRelation(report, 'effectPlacement', command, commandId, {
            ...simulationCommandRelationFields(command),
            placementId: effect.placementId,
            effectType: effect.type,
          }),
        });
      }
    }
  });
  report.patrols.forEach((patrol, index) => {
    const patrolId = simulationPatrolEntityId(report.scenarioId, index);
    const stepId = simulationStepEntityId(report.scenarioId, patrol.stepIndex);
    relations.push({
      name: 'SimulationStepPatrol',
      fromId: stepId,
      toId: patrolId,
      data: simulationRelation(report, 'patrol', patrol, patrolId),
    });
    pushRelationIfPresent(relations, entityIds, {
      name: 'PatrolActor',
      fromId: patrolId,
      toId: actorEntityId(patrol.patrol.actorId),
      data: simulationRelation(report, 'actor', patrol, patrolId, {
        actorId: patrol.patrol.actorId,
      }),
    });
    pushRelationIfPresent(relations, entityIds, {
      name: 'PatrolPlacement',
      fromId: patrolId,
      toId: placementEntityId(patrol.patrol.placementId),
      data: simulationRelation(report, 'placement', patrol, patrolId, {
        placementId: patrol.patrol.placementId,
      }),
    });
  });
  report.movements.forEach((movement, index) => {
    const movementId = simulationMovementEntityId(report.scenarioId, index);
    const stepId = simulationStepEntityId(report.scenarioId, movement.stepIndex);
    relations.push({
      name: 'SimulationStepMovement',
      fromId: stepId,
      toId: movementId,
      data: simulationRelation(report, 'movement', movement, movementId),
    });
    pushRelationIfPresent(relations, entityIds, {
      name: 'MovementActor',
      fromId: movementId,
      toId: actorEntityId(movement.movement.actorId),
      data: simulationRelation(report, 'actor', movement, movementId, {
        actorId: movement.movement.actorId,
      }),
    });
    pushRelationIfPresent(relations, entityIds, {
      name: 'MovementPlacement',
      fromId: movementId,
      toId: placementEntityId(movement.movement.placementId),
      data: simulationRelation(report, 'placement', movement, movementId, {
        placementId: movement.movement.placementId,
      }),
    });
  });
  report.mutations.forEach((mutation, index) => {
    const mutationId = simulationMutationEntityId(report.scenarioId, index);
    const step = stepForMutation(report, mutation);
    const stepIndex = step?.index ?? index;
    relations.push({
      name: 'SimulationStepMutation',
      fromId: simulationStepEntityId(report.scenarioId, stepIndex),
      toId: mutationId,
      data: simulationRelation(report, 'mutation', { stepIndex, stepId: step?.id }, mutationId, {
        mutationType: mutation.type,
      }),
    });
    pushRelationIfPresent(relations, entityIds, {
      name: 'MutationActor',
      fromId: mutationId,
      toId: actorEntityId(mutation.actorId),
      data: simulationRelation(report, 'actor', { stepIndex, stepId: step?.id }, mutationId, {
        actorId: mutation.actorId,
        mutationType: mutation.type,
      }),
    });
    pushRelationIfPresent(relations, entityIds, {
      name: 'MutationPlacement',
      fromId: mutationId,
      toId: placementEntityId(mutation.placementId),
      data: simulationRelation(report, 'placement', { stepIndex, stepId: step?.id }, mutationId, {
        placementId: mutation.placementId,
        mutationType: mutation.type,
      }),
    });
  });
  return relations;
}

function questActorReferences(
  questId: string,
  objective: GameboardQuestObjective
): readonly GameboardEcsRelation[] {
  const relations: GameboardEcsRelation[] = [];
  if ('actor' in objective && objective.actor) {
    relations.push({
      name: 'QuestReferencesActor',
      fromId: `quest:${questId}`,
      toId: `actor:${objective.actor}`,
      data: {
        questId,
        objectiveId: objective.id,
        actorId: objective.actor,
        role: 'actor',
      },
    });
  }
  if ('targetActor' in objective && objective.targetActor) {
    relations.push({
      name: 'QuestReferencesActor',
      fromId: `quest:${questId}`,
      toId: `actor:${objective.targetActor}`,
      data: {
        questId,
        objectiveId: objective.id,
        actorId: objective.targetActor,
        role: 'targetActor',
      },
    });
  }
  return relations;
}

function questTileReferences(
  questId: string,
  objective: GameboardQuestObjective
): readonly GameboardEcsRelation[] {
  const tileTargets: Array<{
    role: GameboardQuestTileReferenceRole;
    target: HexCoordinates | string | undefined;
  }> = [];
  if ('tile' in objective) {
    tileTargets.push({ role: 'tile', target: objective.tile });
  }
  if ('targetTile' in objective) {
    tileTargets.push({ role: 'targetTile', target: objective.targetTile });
  }

  return tileTargets.flatMap(({ role, target }) => {
    const coordinates = normalizeCoordinates(target);
    if (!coordinates) {
      return [];
    }
    const tileKey = hexKey(coordinates);
    return [
      {
        name: 'QuestTargetsTile',
        fromId: `quest:${questId}`,
        toId: `tile:${tileKey}`,
        data: {
          questId,
          objectiveId: objective.id,
          tileKey,
          coordinates,
          role,
        },
      } satisfies GameboardEcsRelation,
    ];
  });
}

function spawnCandidates(
  plan: GameboardPlan,
  explicitCandidates: readonly HexCoordinates[] | undefined
): readonly HexCoordinates[] {
  if (explicitCandidates) {
    return explicitCandidates;
  }
  return plan.tiles
    .filter((tile) => tile.terrain !== 'water' && !tile.tags.includes('coast'))
    .map((tile) => tile.coordinates);
}

function addTimelineReferenceEntities(
  entities: readonly GameboardInteropEntity[],
  report: GameboardScenarioSimulationReport,
  existingEntityIds: ReadonlySet<string>
): GameboardInteropEntity[] {
  const next = [...entities];
  const entityIds = new Set([...existingEntityIds, ...next.map((entity) => entity.id)]);
  for (const actorId of timelineActorIds(report)) {
    const id = actorEntityId(actorId);
    if (!id || entityIds.has(id)) {
      continue;
    }
    entityIds.add(id);
    next.push({
      id,
      kind: 'actor',
      components: {
        GameboardActorReference: {
          actorId,
          exists: false,
          source: 'simulation-timeline',
        },
      },
    });
  }
  for (const placementId of timelinePlacementIds(report)) {
    const id = placementEntityId(placementId);
    if (!id || entityIds.has(id)) {
      continue;
    }
    entityIds.add(id);
    next.push({
      id,
      kind: 'placement',
      components: {
        GameboardPlacementReference: {
          placementId,
          exists: false,
          source: 'simulation-timeline',
        },
      },
    });
  }
  return next;
}

function timelineActorIds(report: GameboardScenarioSimulationReport): string[] {
  return uniqueStrings([
    ...report.actors.map((actor) => actor.actorId),
    ...report.commands.flatMap((command) => [
      command.command.actorId,
      command.command.sourceActorId,
      command.command.target.actorId,
      ...commandEffectActorIds(command),
    ]),
    ...report.actorTargets.flatMap((actorTargets) => [
      actorTargets.sourceActorId,
      ...actorTargets.targets.map((target) => target.actorId),
    ]),
    ...report.patrols.map((patrol) => patrol.patrol.actorId),
    ...report.movements.map((movement) => movement.movement.actorId),
    ...report.mutations.map((mutation) => mutation.actorId),
  ]);
}

function timelinePlacementIds(report: GameboardScenarioSimulationReport): string[] {
  return uniqueStrings([
    ...report.finalPlan.placements.map((placement) => placement.id),
    ...report.actors.map((actor) => actor.placement.placementId),
    ...report.commands.flatMap((command) => [
      command.command.placementId,
      command.command.sourcePlacementId,
      command.command.target.placementId,
      ...commandEffectPlacementIds(command),
    ]),
    ...report.actorTargets.flatMap((actorTargets) => [
      actorTargets.sourcePlacementId,
      ...actorTargets.targets.map((target) => target.placementId),
    ]),
    ...report.patrols.map((patrol) => patrol.patrol.placementId),
    ...report.movements.map((movement) => movement.movement.placementId),
    ...report.mutations.map((mutation) => mutation.placementId),
  ]);
}

function commandEffectActorIds(command: GameboardScenarioSimulationCommandRecord): string[] {
  return (command.command.effects ?? []).flatMap((effect) =>
    'actorId' in effect && effect.actorId ? [effect.actorId] : []
  );
}

function commandEffectPlacementIds(command: GameboardScenarioSimulationCommandRecord): string[] {
  return (command.command.effects ?? []).flatMap((effect) =>
    'placementId' in effect && effect.placementId ? [effect.placementId] : []
  );
}

function simulationCommandRelationFields(
  command: GameboardScenarioSimulationCommandRecord
): Partial<GameboardSimulationRelationRecord> {
  return {
    commandKind: command.command.kind,
    commandStatus: command.command.status,
    handlerId: command.command.handlerId,
    handlerStatus: command.command.handlerStatus,
    effectTypes: command.command.effectTypes ? [...command.command.effectTypes] : undefined,
  };
}

function simulationRelation(
  report: GameboardScenarioSimulationReport,
  role: GameboardSimulationRelationRole,
  step:
    | Pick<GameboardScenarioSimulationStepReport, 'index' | 'id'>
    | Pick<
        | GameboardScenarioSimulationActorTargetsRecord
        | GameboardScenarioSimulationCommandRecord
        | GameboardScenarioSimulationPatrolRecord
        | GameboardScenarioSimulationMovementRecord,
        'stepIndex' | 'stepId'
      >,
  recordId?: string,
  extra: Partial<GameboardSimulationRelationRecord> = {}
): GameboardSimulationRelationRecord {
  return {
    scenarioId: report.scenarioId,
    role,
    stepIndex: 'stepIndex' in step ? step.stepIndex : step.index,
    stepId: 'stepIndex' in step ? step.stepId : step.id,
    recordId,
    ...extra,
  };
}

function pushRelationIfPresent(
  relations: GameboardEcsRelation[],
  entityIds: ReadonlySet<string>,
  relation: Omit<GameboardEcsRelation, 'toId'> & { toId?: string }
): void {
  if (relation.toId && entityIds.has(relation.fromId) && entityIds.has(relation.toId)) {
    relations.push({ ...relation, toId: relation.toId });
  }
}

function stepForMutation(
  report: GameboardScenarioSimulationReport,
  mutation: GameboardScenarioSimulationMutationRecord
): GameboardScenarioSimulationStepReport | undefined {
  return report.steps.find((step) =>
    step.mutations.some((candidate) => mutationRecordsEqual(candidate, mutation))
  );
}

function mutationRecordsEqual(
  left: GameboardScenarioSimulationMutationRecord,
  right: GameboardScenarioSimulationMutationRecord
): boolean {
  return (
    left.type === right.type &&
    left.actorId === right.actorId &&
    left.placementId === right.placementId &&
    left.removed === right.removed &&
    left.spawned === right.spawned &&
    left.updated === right.updated &&
    left.reason === right.reason
  );
}

function actorEntityId(actorId: string | undefined): string | undefined {
  return actorId ? `actor:${actorId}` : undefined;
}

function spawnGroupEntityId(groupId: string): string {
  return `spawn-group:${groupId}`;
}

function patrolRouteEntityId(routeId: string): string {
  return `patrol-route:${routeId}`;
}

function patrolWaypointEntityId(routeId: string, waypointIndex: number): string {
  return `${patrolRouteEntityId(routeId)}:waypoint:${waypointIndex}`;
}

function spawnGroupIdForLocation(
  spawnGroups: GameboardSpawnGroupPlan,
  spawnId: string
): string | undefined {
  return spawnGroups.groups.find((group) =>
    group.locations.some((location) => location.id === spawnId)
  )?.id;
}

function placementEntityId(placementId: string | undefined): string | undefined {
  return placementId ? `placement:${placementId}` : undefined;
}

function simulationEntityId(scenarioId: string): string {
  return `simulation:${scenarioId}`;
}

function simulationStepEntityId(scenarioId: string, stepIndex: number): string {
  return `${simulationEntityId(scenarioId)}:step:${stepIndex}`;
}

function simulationCommandEntityId(scenarioId: string, index: number): string {
  return `${simulationEntityId(scenarioId)}:command:${index}`;
}

function simulationActorTargetsEntityId(scenarioId: string, index: number): string {
  return `${simulationEntityId(scenarioId)}:actor-targets:${index}`;
}

function simulationPatrolEntityId(scenarioId: string, index: number): string {
  return `${simulationEntityId(scenarioId)}:patrol:${index}`;
}

function simulationMovementEntityId(scenarioId: string, index: number): string {
  return `${simulationEntityId(scenarioId)}:movement:${index}`;
}

function simulationMutationEntityId(scenarioId: string, index: number): string {
  return `${simulationEntityId(scenarioId)}:mutation:${index}`;
}

function uniqueStrings(values: readonly (string | undefined)[]): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => typeof value === 'string' && value.length > 0)
    ),
  ];
}

function normalizeCoordinates(
  target: HexCoordinates | string | undefined
): HexCoordinates | undefined {
  if (target === undefined) {
    return undefined;
  }
  if (typeof target === 'string') {
    try {
      return parseHexKey(target);
    } catch {
      return undefined;
    }
  }
  return { ...target };
}

function cloneScenarioActor(actor: GameboardScenarioActor): GameboardScenarioActor {
  return {
    ...actor,
    at:
      actor.at === undefined
        ? undefined
        : typeof actor.at === 'string'
          ? actor.at
          : { ...actor.at },
    tags: actor.tags ? [...actor.tags] : undefined,
    metadata: actor.metadata ? { ...actor.metadata } : undefined,
    actorMetadata: actor.actorMetadata ? { ...actor.actorMetadata } : undefined,
    movementAgent: actor.movementAgent ? cloneMovementAgent(actor.movementAgent) : undefined,
    patrolAgent: actor.patrolAgent ? clonePatrolAgent(actor.patrolAgent) : undefined,
  };
}

function cloneMovementAgent(
  movementAgent: NonNullable<GameboardScenarioActor['movementAgent']>
): NonNullable<GameboardScenarioActor['movementAgent']> {
  return {
    ...movementAgent,
    ignorePlacementIds: movementAgent.ignorePlacementIds
      ? [...movementAgent.ignorePlacementIds]
      : undefined,
    navigation: movementAgent.navigation
      ? {
          ...movementAgent.navigation,
          allowedTerrain: movementAgent.navigation.allowedTerrain
            ? [...movementAgent.navigation.allowedTerrain]
            : undefined,
          blockedTerrain: movementAgent.navigation.blockedTerrain
            ? [...movementAgent.navigation.blockedTerrain]
            : undefined,
          blockingPlacementKinds: movementAgent.navigation.blockingPlacementKinds
            ? [...movementAgent.navigation.blockingPlacementKinds]
            : undefined,
          blockingPlacementLayers: movementAgent.navigation.blockingPlacementLayers
            ? [...movementAgent.navigation.blockingPlacementLayers]
            : undefined,
          ignorePlacementIds: movementAgent.navigation.ignorePlacementIds
            ? [...movementAgent.navigation.ignorePlacementIds]
            : undefined,
        }
      : undefined,
  };
}

function clonePatrolAgent(
  patrolAgent: NonNullable<GameboardScenarioActor['patrolAgent']>
): NonNullable<GameboardScenarioActor['patrolAgent']> {
  return {
    ...patrolAgent,
    movement: patrolAgent.movement ? clonePatrolMovementOptions(patrolAgent.movement) : undefined,
  };
}

function clonePatrolMovementOptions(
  movement: NonNullable<NonNullable<GameboardScenarioActor['patrolAgent']>['movement']>
): NonNullable<NonNullable<GameboardScenarioActor['patrolAgent']>['movement']> {
  return {
    ...movement,
    ignorePlacementIds: movement.ignorePlacementIds ? [...movement.ignorePlacementIds] : undefined,
    navigation: movement.navigation
      ? {
          ...movement.navigation,
          allowedTerrain: movement.navigation.allowedTerrain
            ? [...movement.navigation.allowedTerrain]
            : undefined,
          blockedTerrain: movement.navigation.blockedTerrain
            ? [...movement.navigation.blockedTerrain]
            : undefined,
          blockingPlacementKinds: movement.navigation.blockingPlacementKinds
            ? [...movement.navigation.blockingPlacementKinds]
            : undefined,
          blockingPlacementLayers: movement.navigation.blockingPlacementLayers
            ? [...movement.navigation.blockingPlacementLayers]
            : undefined,
          ignorePlacementIds: movement.navigation.ignorePlacementIds
            ? [...movement.navigation.ignorePlacementIds]
            : undefined,
        }
      : undefined,
  };
}
