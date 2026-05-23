import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { World } from 'koota';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createGameboardBuilder,
  createGameboardPieceRegistry,
  createGameboardRecipe,
  createGameboardScenario,
  createGameboardWorld,
  PlacementState,
  type GameboardActorSelection,
  type GameboardActorTargetCommandPlan,
  type GameboardActorTargetingReport,
  type GameboardActorValue,
  type GameboardInteractionCommand,
  type GameboardInteractionTargetReport,
  type GameboardLayoutFillAnalysis,
  type GameboardLayoutSiteInspection,
  type GameboardNeighborhoodInspection,
  type GameboardPatrolAgentValue,
  type GameboardPatrolStateValue,
  type GameboardPlacementOccupancyInspection,
  type GameboardPiecePlacementInspection,
  type GameboardPieceRegistryAnalysis,
  type GameboardQuestValue,
  type GameboardRecipeGameRuntime,
  type GameboardScenarioGameRuntime,
  type GameboardStateValue,
  type GameboardTileInspection,
  type MovementAgentValue,
  type PlacementOccupancySnapshot,
  type SeededGameboardPieceFillInspection,
  type TileCoordinatesValue,
} from '../../src';
import {
  MedievalGameboardProvider,
  MedievalGameboardRecipeProvider,
  MedievalGameboardScenarioProvider,
  useCanOccupyGameboardPlacement,
  useGameboardActions,
  useGameboardActor,
  useGameboardActorActions,
  useGameboardActorEntities,
  useGameboardActorSelection,
  useGameboardActorTargetCommand,
  useGameboardActorTargets,
  useGameboardCommandActions,
  useGameboardInteractionCommand,
  useGameboardInteractionCommandPreview,
  useGameboardInteractionTarget,
  useGameboardLayoutFillAnalysis,
  useGameboardLayoutPlacements,
  useGameboardLayoutSiteInspection,
  useGameboardNavigation,
  useGameboardOccupancyIndex,
  useGameboardPatrolRoute,
  useGameboardPatrolRoutes,
  useGameboardPatrolActions,
  useGameboardPatrolAgent,
  useGameboardPatrolAgentEntities,
  useGameboardPatrolState,
  useGameboardPlacementOccupancy,
  useGameboardPlacementOccupancyInspection,
  useGameboardPlacementEntities,
  useGameboardPieceFillInspection,
  useGameboardPiecePlacementInspection,
  useGameboardPieceRegistryAnalysis,
  useGameboardPieceSelection,
  useGameboardPieceSourceUrlMap,
  useGameboardMovementActions,
  useGameboardNeighborhoodInspection,
  useGameboardQuest,
  useGameboardQuestActions,
  useGameboardQuestEntities,
  useGameboardRuleViolations,
  useGameboardRuntime,
  useGameboardSpawnLocations,
  useGameboardState,
  useGameboardSystemActions,
  useGameboardTileInspection,
  useGameboardTileEntities,
  useMovementAgent,
  usePlacementEntitiesForTile,
  usePlacementOccupancyForTile,
  useProjectedGameboardPlan,
  useTileCoordinates,
  useTileEntity,
} from '../../src/react';

interface ReactBindingReport {
  actor?: GameboardActorValue;
  actorCount: number;
  placementCount: number;
  quest?: GameboardQuestValue;
  questCount: number;
  moveCommand?: GameboardInteractionCommand;
  movePreview?: ReturnType<typeof useGameboardInteractionCommandPreview>;
  moveTarget?: GameboardInteractionTargetReport;
  navigationPathFound: boolean;
  layoutFillAnalysis?: GameboardLayoutFillAnalysis;
  layoutPlacementCount: number;
  layoutSiteInspection?: GameboardLayoutSiteInspection;
  placementOccupancyInspection?: GameboardPlacementOccupancyInspection;
  canOccupyActorTile?: boolean;
  occupancyBlockingTileCount: number;
  occupancySnapshotCount: number;
  pieceFillInspection?: SeededGameboardPieceFillInspection;
  piecePlacementInspection?: GameboardPiecePlacementInspection;
  pieceRegistryAnalysis?: GameboardPieceRegistryAnalysis;
  pieceSelectionIds: readonly string[];
  pieceSourceUrl?: string;
  originNeighborhood: GameboardNeighborhoodInspection;
  playerSelection: GameboardActorSelection;
  playerTargetCommand?: GameboardActorTargetCommandPlan;
  playerTargets?: GameboardActorTargetingReport;
  patrolRouteFound: boolean;
  patrolRouteSetCount: number;
  patrolWaypointCount: number;
  patrolAgent?: GameboardPatrolAgentValue;
  patrolAgentCount: number;
  patrolState?: GameboardPatrolStateValue;
  projectedPlacementIds: readonly string[];
  ruleErrorCount: number;
  spawnKeys: readonly string[];
  state?: GameboardStateValue;
  tileCount: number;
  tileOneOneInspection: GameboardTileInspection;
  tileZeroCoordinates?: TileCoordinatesValue;
  tileZeroOccupancyIds: readonly string[];
  tileZeroOccupancySnapshots: readonly PlacementOccupancySnapshot[];
  tileZeroPlacementCount: number;
  tileZeroPlacementIds: readonly string[];
  movementAgent?: MovementAgentValue;
  actions: ReturnType<typeof useGameboardActions>;
  actorActions: ReturnType<typeof useGameboardActorActions>;
  commandActions: ReturnType<typeof useGameboardCommandActions>;
  movementActions: ReturnType<typeof useGameboardMovementActions>;
  patrolActions: ReturnType<typeof useGameboardPatrolActions>;
  questActions: ReturnType<typeof useGameboardQuestActions>;
  runtime: ReturnType<typeof useGameboardRuntime>;
  runtimeProjectedPlacementIds: readonly string[];
  runtimeSnapshotActorCount: number;
  systemActions: ReturnType<typeof useGameboardSystemActions>;
}

let root: Root | undefined;
let host: HTMLDivElement | undefined;

describe('React bindings browser integration', () => {
  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    root = undefined;
    host?.remove();
    host = undefined;
  });

  it('mounts the Koota provider, reads hooks, and mutates through hook actions', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const plan = createGameboardBuilder({
      seed: 'react-bindings',
      shape: { kind: 'rectangle', width: 2, height: 2 },
    })
      .addRoadPath([
        { q: 0, r: 0 },
        { q: 1, r: 0 },
      ])
      .build();
    const world = createGameboardWorld(plan);
    let report: ReactBindingReport | undefined;

    await renderProbe(world, (next) => {
      report = next;
    });

    expect(report).toMatchObject({
      actorCount: 0,
      layoutFillAnalysis: { errorCount: 0, placementCount: 1 },
      layoutPlacementCount: 1,
      layoutSiteInspection: { selectedCount: 2 },
      originNeighborhood: { centerKey: '0,0', radius: 1, actors: [] },
      pieceFillInspection: {
        selectedPieceCount: 1,
        analysis: { errorCount: 0, placementCount: 1 },
      },
      piecePlacementInspection: { pieceId: 'react-piece-tree', siteInspection: { selectedCount: 1 } },
      pieceRegistryAnalysis: { pieceCount: 2, roleCounts: { scatter: 1, tree: 1 } },
      pieceSelectionIds: ['react-piece-tree'],
      pieceSourceUrl: '/react-hook-fixtures/trees/react-piece-tree.gltf',
      playerSelection: { count: 0, actorIds: [] },
      playerTargets: undefined,
      questCount: 0,
      ruleErrorCount: 0,
      tileCount: 4,
      tileOneOneInspection: { exists: true, hasActors: false, canEnter: true },
      tileZeroCoordinates: { q: 0, r: 0 },
    });
    expect(report?.placementCount).toBeGreaterThan(4);
    expect(report?.state?.seed).toBe('react-bindings');

    await act(async () => {
      const actorEntity = report?.runtime.spawnActor({
        id: 'react-player-placement',
        actorId: 'react-player',
        actorKind: 'player',
        at: '1,1',
        assetId: 'flag_blue',
        kind: 'unit',
      });
      if (!actorEntity) {
        throw new Error('React actor action did not return an entity');
      }
      report?.movementActions.setAgent(actorEntity, { profile: 'worker', movementBudget: 3 });
      report?.patrolActions.set(actorEntity, {
        route: { id: 'react-watch', waypointKeys: ['1,1', '0,1'], loop: false },
        movement: { profile: 'worker' },
      });
      report?.actions.spawnPlacement({
        id: 'react-marker',
        at: '0,0',
        assetId: 'flag_green',
        kind: 'prop',
      });
      report?.actions.spawnPlacement({
        id: 'react-footprint-prop',
        at: '1,0',
        assetId: 'external_gatehouse',
        kind: 'prop',
        metadata: {
          layoutFootprintTiles: '1,0|0,0',
          layoutOccupancyGroup: 'react-footprint-prop',
        },
      });
      report?.questActions.spawn({
        id: 'react-quest',
        objectives: [
          { id: 'reach-marker', kind: 'reach-tile', actor: 'react-player', tile: '0,0' },
        ],
      });
    });

    expect(report).toMatchObject({
      actor: { actorId: 'react-player', kind: 'player' },
      actorCount: 1,
      moveCommand: { kind: 'move', intent: 'move', tileKey: '0,0', canExecute: true },
      movePreview: { canExecute: true, movementBudget: 3 },
      moveTarget: { kind: 'tile', intent: 'move', tileKey: '0,0', canEnter: true },
      navigationPathFound: true,
      layoutFillAnalysis: { errorCount: 0, placementCount: 1 },
      layoutPlacementCount: 1,
      layoutSiteInspection: { selectedCount: 1 },
      pieceFillInspection: {
        selectedPieceCount: 1,
        analysis: { errorCount: 0, placementCount: 1 },
      },
      pieceSelectionIds: ['react-piece-tree'],
      placementOccupancyInspection: {
        canOccupy: false,
      },
      canOccupyActorTile: false,
      occupancyBlockingTileCount: 1,
      playerSelection: { count: 1, actorIds: ['react-player'] },
      playerTargetCommand: {
        canExecute: true,
        command: { kind: 'inspect-actor', canExecute: true },
        target: { approach: 'self' },
      },
      playerTargets: { targetActorIds: ['react-player'], nearestTarget: { approach: 'self' } },
      quest: { questId: 'react-quest', status: 'active' },
      patrolRouteFound: true,
      patrolRouteSetCount: 1,
      patrolWaypointCount: 2,
      patrolAgent: { routeId: 'react-watch', currentWaypointIndex: 0 },
      patrolAgentCount: 1,
      patrolState: { status: 'idle' },
      questCount: 1,
      ruleErrorCount: 0,
      runtimeSnapshotActorCount: 1,
      tileOneOneInspection: {
        exists: true,
        canEnter: true,
        hasActors: true,
        actors: [
          expect.objectContaining({
            actor: expect.objectContaining({ actorId: 'react-player', kind: 'player' }),
          }),
        ],
      },
    });
    expect(report?.projectedPlacementIds).toEqual(
      expect.arrayContaining(['react-marker', 'react-footprint-prop', 'react-player-placement'])
    );
    expect(report?.runtimeProjectedPlacementIds).toEqual(
      expect.arrayContaining(['react-marker', 'react-footprint-prop', 'react-player-placement'])
    );
    expect(report?.occupancySnapshotCount).toBeGreaterThan(
      report?.projectedPlacementIds.length ?? 0
    );
    expect(report?.placementOccupancyInspection?.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          placement: expect.objectContaining({ id: 'react-player-placement' }),
        }),
      ])
    );
    expect(report?.tileZeroPlacementIds).toEqual(expect.arrayContaining(['react-footprint-prop']));
    expect(report?.tileZeroOccupancyIds).toEqual(expect.arrayContaining(['react-footprint-prop']));
    expect(report?.tileZeroOccupancySnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tileKey: '0,0',
          originTileKey: '1,0',
          footprintIndex: 1,
          placement: expect.objectContaining({ id: 'react-footprint-prop' }),
        }),
      ])
    );
    expect(report?.movementAgent).toMatchObject({
      profileId: 'worker',
      movementBudget: 3,
      remainingMovement: 3,
    });
    expect(report?.spawnKeys.length).toBeGreaterThan(0);
    expect(report?.commandActions.preview('0,0', { sourceActor: 'react-player' })).toMatchObject({
      canExecute: true,
      command: { kind: 'move', tileKey: '0,0' },
    });
    let dispatchResult:
      | ReturnType<ReactBindingReport['systemActions']['dispatchCommand']>
      | undefined;
    await act(async () => {
      dispatchResult = report?.systemActions.dispatchCommand('0,0', {
        sourceActor: 'react-player',
      });
    });
    expect(dispatchResult).toMatchObject({
      events: [{ type: 'movement-requested' }],
    });
    expect(report?.tileZeroPlacementCount).toBeGreaterThan(1);

    let movedActor: ReturnType<ReactBindingReport['actorActions']['move']> | undefined;
    await act(async () => {
      movedActor = report?.actorActions.move('react-player', '0,1', { occupancyGuard: true });
    });
    expect(movedActor?.get(PlacementState)).toMatchObject({
      id: 'react-player-placement',
      tileKey: '0,1',
    });
    expect(report?.canOccupyActorTile).toBe(true);
    expect(report?.runtime.snapshot({ includeInterop: false }).actors[0]?.placement.tileKey).toBe(
      '0,1'
    );
    expect(report?.tileOneOneInspection).toMatchObject({
      exists: true,
      hasActors: false,
      canEnter: true,
    });
    expect(report?.originNeighborhood.actors).toEqual([
      expect.objectContaining({
        actor: expect.objectContaining({ actorId: 'react-player', kind: 'player' }),
      }),
    ]);
    expect(report?.playerSelection).toMatchObject({
      actorIds: ['react-player'],
      records: [{ actorId: 'react-player', tileKey: '0,1' }],
      tileKeys: ['0,1'],
    });
    expect(report?.playerTargets?.nearestTarget).toMatchObject({
      record: { actorId: 'react-player', tileKey: '0,1' },
      path: { found: true, cost: 0 },
    });
    expect(report?.playerTargetCommand).toMatchObject({
      canExecute: true,
      command: { kind: 'inspect-actor', actorId: 'react-player', canExecute: true },
      target: {
        record: { actorId: 'react-player', tileKey: '0,1' },
        path: { found: true, cost: 0 },
      },
    });
  });

  it('mounts saved recipe and scenario runtime providers with generated piece registries', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const recipe = createGameboardRecipe(
      { seed: 'react-runtime-provider', shape: { kind: 'rectangle', width: 3, height: 2 } },
      [],
      {
        pieceDeclarations: [
          {
            id: 'react-runtime-tree',
            assetId: 'tree_single_A',
            source: 'React Runtime Fixtures',
            role: 'tree',
            metadata: { sourceRelativePath: 'trees/react-runtime-tree.gltf' },
          },
        ],
        pieceFills: [{ selection: { ids: ['react-runtime-tree'] }, count: 1 }],
      }
    );
    const scenario = createGameboardScenario('react-runtime-scenario', recipe);
    let recipeReport:
      | {
          registryCount: number;
          generatedPieceCount: number;
          sourceUrl?: string;
        }
      | undefined;
    let scenarioReport:
      | {
          registryCount: number;
          generatedPieceCount: number;
          sourceUrl?: string;
        }
      | undefined;

    await renderReactElement(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          MedievalGameboardRecipeProvider,
          { recipe },
          React.createElement(RecipeRuntimeProviderProbe, {
            onReport: (report) => {
              recipeReport = report;
            },
          })
        ),
        React.createElement(
          MedievalGameboardScenarioProvider,
          { scenario },
          React.createElement(ScenarioRuntimeProviderProbe, {
            onReport: (report) => {
              scenarioReport = report;
            },
          })
        )
      )
    );

    expect(recipeReport).toEqual({
      registryCount: 1,
      generatedPieceCount: 1,
      sourceUrl: '/react-runtime-fixtures/trees/react-runtime-tree.gltf',
    });
    expect(scenarioReport).toEqual({
      registryCount: 1,
      generatedPieceCount: 1,
      sourceUrl: '/react-runtime-fixtures/trees/react-runtime-tree.gltf',
    });
  });
});

async function renderReactElement(element: React.ReactElement): Promise<void> {
  host = document.createElement('div');
  document.body.replaceChildren(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(element);
  });
}

async function renderProbe(
  world: World,
  onReport: (report: ReactBindingReport) => void
): Promise<void> {
  host = document.createElement('div');
  document.body.replaceChildren(host);
  root = createRoot(host);
  const Provider = MedievalGameboardProvider as React.ComponentType<{
    children?: React.ReactNode;
    world: World;
  }>;
  await act(async () => {
    root?.render(
      React.createElement(Provider, { world }, React.createElement(ReactBindingProbe, { onReport }))
    );
  });
}

function ReactBindingProbe({ onReport }: { onReport: (report: ReactBindingReport) => void }) {
  const state = useGameboardState();
  const tileEntities = useGameboardTileEntities();
  const placementEntities = useGameboardPlacementEntities();
  const actorEntities = useGameboardActorEntities();
  const questEntities = useGameboardQuestEntities();
  const patrolAgentEntities = useGameboardPatrolAgentEntities();
  const tileZero = useTileEntity('0,0');
  const tileZeroCoordinates = useTileCoordinates(tileZero);
  const tileZeroPlacements = usePlacementEntitiesForTile('0,0');
  const tileZeroOccupancy = usePlacementOccupancyForTile('0,0');
  const tileOneOneInspection = useGameboardTileInspection('1,1', {
    sourceActor: 'react-player',
  });
  const actor = useGameboardActor(actorEntities[0]);
  const movementAgent = useMovementAgent(actorEntities[0]);
  const patrolAgent = useGameboardPatrolAgent(patrolAgentEntities[0]);
  const patrolState = useGameboardPatrolState(patrolAgentEntities[0]);
  const quest = useGameboardQuest(questEntities[0]);
  const moveTarget = useGameboardInteractionTarget('0,0', { sourceActor: 'react-player' });
  const moveCommand = useGameboardInteractionCommand('0,0', { sourceActor: 'react-player' });
  const movePreview = useGameboardInteractionCommandPreview('0,0', { sourceActor: 'react-player' });
  const projectedPlan = useProjectedGameboardPlan();
  const occupancy = useGameboardOccupancyIndex();
  const occupancySnapshots = useGameboardPlacementOccupancy();
  const originNeighborhood = useGameboardNeighborhoodInspection('0,0', {
    radius: 1,
    sourceActor: 'react-player',
  });
  const playerSelection = useGameboardActorSelection({ kinds: ['player'] });
  const playerTargets = useGameboardActorTargets(
    actorEntities.length > 0
      ? { sourceActor: 'react-player', kinds: ['player'], includeSource: true }
      : undefined
  );
  const playerTargetCommand = useGameboardActorTargetCommand(
    actorEntities.length > 0
      ? {
          sourceActor: 'react-player',
          kinds: ['player'],
          includeSource: true,
          targetActorId: 'react-player',
          maxPathCost: 1,
        }
      : undefined
  );
  const placementOccupancyInspection = useGameboardPlacementOccupancyInspection({
    at: '1,1',
    kind: 'unit',
  });
  const canOccupyActorTile = useCanOccupyGameboardPlacement({
    at: '1,1',
    kind: 'unit',
  });
  const navigation = useGameboardNavigation();
  const spawns = useGameboardSpawnLocations({
    count: 2,
    seed: 'react-bindings:spawn',
    terrain: 'grass',
    minDistance: 1,
  });
  const patrolRoute = useGameboardPatrolRoute({
    id: 'react-patrol',
    count: 2,
    seed: 'react-bindings:patrol',
    start: '0,0',
    terrain: ['grass', 'road'],
  });
  const patrolRoutes = useGameboardPatrolRoutes({
    seed: 'react-bindings:patrol-set',
    routes: [
      {
        id: 'react-patrol-set',
        count: 2,
        start: '0,0',
        terrain: ['grass', 'road'],
      },
    ],
  });
  const pieceRegistry = React.useMemo(
    () =>
      createGameboardPieceRegistry([
        {
          id: 'react-piece-tree',
          assetId: 'tree_single_A',
          source: 'React Hook Fixtures',
          role: 'tree',
          tags: ['react-piece', 'nature'],
          metadata: { sourceRelativePath: 'trees/react-piece-tree.gltf' },
        },
        {
          id: 'react-piece-crate',
          assetId: 'crate_A_small',
          source: 'React Hook Fixtures',
          role: 'scatter',
          tags: ['react-piece', 'camp'],
        },
      ]),
    []
  );
  const layoutSiteInspection = useGameboardLayoutSiteInspection({
    count: 2,
    seed: 'react-bindings:layout-sites',
    criteria: { terrain: ['grass', 'road'] },
  });
  const layoutFillAnalysis = useGameboardLayoutFillAnalysis({
    seed: 'react-bindings:layout-fill',
    rules: [{ id: 'react-scatter', archetype: 'scatter', assetId: 'crate_A_small', count: 1 }],
  });
  const layoutPlacements = useGameboardLayoutPlacements({
    assetId: 'tree_single_A',
    archetype: 'tree',
    count: 1,
    seed: 'react-bindings:layout-placement',
  });
  const pieceRegistryAnalysis = useGameboardPieceRegistryAnalysis(pieceRegistry, {
    checks: [{ id: 'react-nature', selection: { tags: ['nature'] } }],
  });
  const pieceSelection = useGameboardPieceSelection(pieceRegistry, {
    roles: ['tree'],
    tags: ['react-piece'],
  });
  const piecePlacementInspection = useGameboardPiecePlacementInspection(pieceSelection[0], {
    count: 1,
    seed: 'react-bindings:piece-placement',
  });
  const pieceFillInspection = useGameboardPieceFillInspection(
    pieceRegistry,
    [
      {
        selection: { ids: ['react-piece-tree'] },
        count: 1,
        ruleIdPrefix: 'react-piece',
      },
    ],
    { seed: 'react-bindings:piece-fill' }
  );
  const pieceSourceUrls = useGameboardPieceSourceUrlMap(pieceRegistry, {
    sourceRoots: { 'React Hook Fixtures': '/react-hook-fixtures' },
  });
  const actions = useGameboardActions();
  const actorActions = useGameboardActorActions();
  const commandActions = useGameboardCommandActions();
  const movementActions = useGameboardMovementActions();
  const patrolActions = useGameboardPatrolActions();
  const questActions = useGameboardQuestActions();
  const systemActions = useGameboardSystemActions();
  const runtime = useGameboardRuntime();
  const runtimeSnapshot = runtime.snapshot({ includeInterop: false });
  const ruleErrors = useGameboardRuleViolations().filter(
    (violation) => violation.severity === 'error'
  );

  onReport({
    actor,
    actorCount: actorEntities.length,
    placementCount: placementEntities.length,
    quest,
    questCount: questEntities.length,
    moveCommand,
    movePreview,
    moveTarget,
    navigationPathFound: navigation?.findPath('1,1', '0,0').found ?? false,
    layoutFillAnalysis,
    layoutPlacementCount: layoutPlacements.length,
    layoutSiteInspection,
    placementOccupancyInspection,
    canOccupyActorTile,
    occupancyBlockingTileCount: occupancy?.blockingTileKeys.size ?? 0,
    occupancySnapshotCount: occupancySnapshots.length,
    pieceFillInspection,
    piecePlacementInspection,
    pieceRegistryAnalysis,
    pieceSelectionIds: pieceSelection.map((piece) => piece.id),
    pieceSourceUrl: pieceSourceUrls.tree_single_A,
    originNeighborhood,
    playerSelection,
    playerTargetCommand,
    playerTargets,
    patrolRouteFound: patrolRoute?.found ?? false,
    patrolRouteSetCount: patrolRoutes?.routeCount ?? 0,
    patrolWaypointCount: patrolRoute?.waypoints.length ?? 0,
    patrolAgent,
    patrolAgentCount: patrolAgentEntities.length,
    patrolState,
    projectedPlacementIds: projectedPlan?.placements.map((placement) => placement.id) ?? [],
    ruleErrorCount: ruleErrors.length,
    spawnKeys: spawns.map((spawn) => spawn.key),
    state,
    tileCount: tileEntities.length,
    tileOneOneInspection,
    tileZeroCoordinates,
    tileZeroOccupancyIds: tileZeroOccupancy.map((record) => record.placement.id),
    tileZeroOccupancySnapshots: tileZeroOccupancy,
    tileZeroPlacementCount: tileZeroPlacements.length,
    tileZeroPlacementIds: tileZeroPlacements
      .map((entity) => entity.get(PlacementState)?.id)
      .filter((id): id is string => id !== undefined),
    movementAgent,
    actions,
    actorActions,
    commandActions,
    movementActions,
    patrolActions,
    questActions,
    runtime,
    runtimeProjectedPlacementIds: runtimeSnapshot.plan.placements.map((placement) => placement.id),
    runtimeSnapshotActorCount: runtimeSnapshot.actors.length,
    systemActions,
  });

  return React.createElement(
    'output',
    { 'data-testid': 'react-bindings-probe' },
    `${tileEntities.length}:${placementEntities.length}:${actorEntities.length}:${questEntities.length}`
  );
}

function RecipeRuntimeProviderProbe({
  onReport,
}: {
  onReport: (report: { registryCount: number; generatedPieceCount: number; sourceUrl?: string }) => void;
}) {
  const runtime = useGameboardRuntime<GameboardRecipeGameRuntime>();
  const snapshot = runtime.snapshot({ includeInterop: false });
  onReport({
    registryCount: runtime.recipePieceRegistry?.pieces.length ?? 0,
    generatedPieceCount: snapshot.plan.placements.filter(
      (placement) => placement.metadata.pieceId === 'react-runtime-tree'
    ).length,
    sourceUrl: runtime.createRecipePieceSourceUrlMap({
      sourceRoots: { 'React Runtime Fixtures': '/react-runtime-fixtures' },
    }).tree_single_A,
  });
  return React.createElement('output', { 'data-testid': 'recipe-runtime-provider-probe' });
}

function ScenarioRuntimeProviderProbe({
  onReport,
}: {
  onReport: (report: { registryCount: number; generatedPieceCount: number; sourceUrl?: string }) => void;
}) {
  const runtime = useGameboardRuntime<GameboardScenarioGameRuntime>();
  const snapshot = runtime.snapshot({ includeInterop: false });
  onReport({
    registryCount: runtime.scenarioPieceRegistry?.pieces.length ?? 0,
    generatedPieceCount: snapshot.plan.placements.filter(
      (placement) => placement.metadata.pieceId === 'react-runtime-tree'
    ).length,
    sourceUrl: runtime.createScenarioPieceSourceUrlMap({
      sourceRoots: { 'React Runtime Fixtures': '/react-runtime-fixtures' },
    }).tree_single_A,
  });
  return React.createElement('output', { 'data-testid': 'scenario-runtime-provider-probe' });
}
