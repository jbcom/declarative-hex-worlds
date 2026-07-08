import type { World } from 'koota';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createGameboardBuilder, createGameboardWorld } from '../../src';
import {
  GameboardPlanProvider,
  GameboardProvider,
  useCanOccupyGameboardPlacement,
  useGameboardActions,
  useGameboardActorTargetCommand,
  useGameboardActorTargets,
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
  useGameboardPieceFillInspection,
  useGameboardPiecePlacementInspection,
  useGameboardPieceRegistryAnalysis,
  useGameboardPieceSelection,
  useGameboardPieceSourceUrlMap,
  useGameboardPlacementOccupancyInspection,
  useGameboardRuntimeSnapshot,
  useGameboardSpawnLocations,
  useGameboardState,
  usePlacementsByClassifier,
  useProjectedGameboardPlan,
} from '../../src/react/index';

let root: Root | undefined;
let host: HTMLDivElement | undefined;
let previousActEnvironment: boolean | undefined;

describe('React hook fallback browser coverage', () => {
  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    root = undefined;
    host?.remove();
    host = undefined;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      previousActEnvironment;
    previousActEnvironment = undefined;
  });

  it('covers plan provider and empty-world hook fallbacks', async () => {
    setReactActEnvironment();
    const plan = createGameboardBuilder({
      seed: 'react-plan-provider',
      shape: { kind: 'rectangle', width: 1, height: 1 },
    }).build();
    let planReport: { seed?: string; tileCount: number } | undefined;
    let fallbackReport: { allEmpty: boolean; counts: readonly number[] } | undefined;
    let unserializableRenderCount = 0;

    await renderReactElement(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          GameboardPlanProvider,
          { plan },
          React.createElement(PlanProviderProbe, {
            onReport: (report) => {
              planReport = report;
            },
          })
        ),
        React.createElement(
          WorldProviderElement,
          { world: createGameboardWorld() },
          React.createElement(EmptyWorldFallbackProbe, {
            onReport: (report) => {
              fallbackReport = report;
            },
          })
        )
      )
    );

    expect(planReport).toEqual({ seed: 'react-plan-provider', tileCount: 1 });
    expect(fallbackReport).toEqual({ allEmpty: true, counts: [0, 0, 0, 0, 0] });

    await act(async () => root?.unmount());
    root = undefined;
    const emptyWorld = createGameboardWorld();
    await renderReactElement(
      React.createElement(
        WorldProviderElement,
        { world: emptyWorld },
        React.createElement(UnserializableOptionsProbe, {
          token: 1,
          onReport: () => {
            unserializableRenderCount += 1;
          },
        })
      )
    );
    await act(async () => {
      root?.render(
        React.createElement(
          WorldProviderElement,
          { world: emptyWorld },
          React.createElement(UnserializableOptionsProbe, {
            token: 2,
            onReport: () => {
              unserializableRenderCount += 1;
            },
          })
        )
      );
    });
    expect(unserializableRenderCount).toBeGreaterThanOrEqual(2);
  });

  it('projects the live plan with a geometry override (custom row spacing)', async () => {
    setReactActEnvironment();
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'react-projected-geometry',
        shape: { kind: 'rectangle', width: 1, height: 2 },
      }).build()
    );
    let report: { overrideRowZ?: number; defaultRowZ?: number } | undefined;

    await renderReactElement(
      React.createElement(
        WorldProviderElement,
        { world },
        React.createElement(ProjectedGeometryProbe, {
          onReport: (value) => {
            report = value;
          },
        })
      )
    );

    expect(report).toBeDefined();
    // rowSpacing = 1.5·(depth/2); override depth 20 → 15, distinct from the default.
    expect(report?.overrideRowZ).toBeCloseTo(1.5 * (20 / 2));
    expect(report?.overrideRowZ).not.toBeCloseTo(report?.defaultRowZ ?? 0);
  });

  it('drops queued revision updates after unmount', async () => {
    setReactActEnvironment();
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'react-unmount-revision',
        shape: { kind: 'rectangle', width: 1, height: 1 },
      }).build()
    );
    let actions: ReturnType<typeof useGameboardActions> | undefined;

    await renderReactElement(
      React.createElement(
        WorldProviderElement,
        { world },
        React.createElement(QueuedRevisionProbe, {
          onReport: (report) => {
            actions = report.actions;
          },
        })
      )
    );
    const mountedRoot = root;
    const gameboardActions = actions;
    expect(gameboardActions).toBeDefined();
    expect(mountedRoot).toBeDefined();
    if (!gameboardActions || !mountedRoot) {
      throw new Error('QueuedRevisionProbe did not mount');
    }

    await act(async () => {
      gameboardActions.spawnPlacement({
        id: 'react-unmount-marker',
        at: '0,0',
        assetId: 'flag_green',
        kind: 'prop',
      });
      mountedRoot.unmount();
    });
    root = undefined;
  });
});

function setReactActEnvironment(): void {
  previousActEnvironment = (
    globalThis as {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

async function renderReactElement(element: React.ReactElement): Promise<void> {
  host = document.createElement('div');
  document.body.replaceChildren(host);
  root = createRoot(host);
  await act(async () => root?.render(element));
}

function WorldProviderElement({ world, children }: { children?: React.ReactNode; world: World }) {
  const Provider = GameboardProvider as React.ComponentType<{
    children?: React.ReactNode;
    world: World;
  }>;
  return React.createElement(Provider, { world }, children);
}

function PlanProviderProbe({
  onReport,
}: {
  onReport: (report: { seed?: string; tileCount: number }) => void;
}) {
  const state = useGameboardState();
  const snapshot = useGameboardRuntimeSnapshot();
  onReport({ seed: state?.seed, tileCount: snapshot.plan.tiles.length });
  return null;
}

function EmptyWorldFallbackProbe({
  onReport,
}: {
  onReport: (report: { allEmpty: boolean; counts: readonly number[] }) => void;
}) {
  const dateOptions = React.useMemo(() => new Date(0), []);
  const emptyToJsonOptions = React.useMemo(
    () =>
      Object.create(Object.prototype, {
        toJSON: { value: () => ({}) },
      }),
    []
  );
  const optionResults = [
    useProjectedGameboardPlan(),
    useGameboardOccupancyIndex(),
    useGameboardNavigation(),
    useGameboardPatrolRoute({ id: 'empty-route', count: 1 }),
    useGameboardPatrolRoute(undefined),
    useGameboardPatrolRoutes({ routes: [{ id: 'empty-route-set', count: 1 }] }),
    useGameboardPatrolRoutes(undefined),
    useGameboardLayoutSiteInspection(),
    useGameboardLayoutFillAnalysis({ rules: [] }),
    useGameboardPieceRegistryAnalysis(undefined),
    useGameboardPiecePlacementInspection(undefined),
    useGameboardPieceFillInspection(undefined, undefined),
    useGameboardPlacementOccupancyInspection(undefined),
    useCanOccupyGameboardPlacement(undefined),
    useGameboardInteractionTarget(undefined, dateOptions as never),
    useGameboardInteractionCommand(undefined, emptyToJsonOptions as never),
    useGameboardInteractionCommandPreview(undefined),
    useGameboardActorTargets(undefined),
    useGameboardActorTargetCommand(undefined),
  ];
  const pieceSourceUrls = useGameboardPieceSourceUrlMap(undefined);
  // usePlacementsByClassifier on an empty world exercises the no-plan `?? []` fallback.
  const enemyPlacements = usePlacementsByClassifier('enemy');
  onReport({
    allEmpty: optionResults.every((result) => result === undefined),
    counts: [
      useGameboardSpawnLocations({ count: 1 }).length +
        useGameboardSpawnLocations(undefined).length,
      useGameboardLayoutPlacements({ assetId: 'tree_single_A', count: 1 }).length,
      useGameboardPieceSelection(undefined).length,
      Object.keys(pieceSourceUrls).length,
      enemyPlacements.length,
    ],
  });
  return null;
}

function UnserializableOptionsProbe({ token, onReport }: { token: number; onReport: () => void }) {
  useGameboardInteractionTarget(undefined, (() => token) as never);
  onReport();
  return null;
}

function QueuedRevisionProbe({
  onReport,
}: {
  onReport: (report: { actions: ReturnType<typeof useGameboardActions> }) => void;
}) {
  const actions = useGameboardActions();
  useProjectedGameboardPlan();
  onReport({ actions });
  return null;
}

function ProjectedGeometryProbe({
  onReport,
}: {
  onReport: (report: { overrideRowZ?: number; defaultRowZ?: number }) => void;
}) {
  // Passing a geometry override exercises the `geometry === undefined ? … : { geometry }`
  // truthy arm of useProjectedGameboardPlan — the tileset-render row-spacing path.
  const override = useProjectedGameboardPlan({
    geometry: { width: 2, depth: 20, elevationStep: 1 },
  });
  const fallback = useProjectedGameboardPlan();
  const rowZ = (plan: typeof override) =>
    plan?.placements.find(
      (placement) => placement.layer === 'terrain' && placement.coordinates.r === 1
    )?.position.z;
  onReport({ overrideRowZ: rowZ(override), defaultRowZ: rowZ(fallback) });
  return null;
}
