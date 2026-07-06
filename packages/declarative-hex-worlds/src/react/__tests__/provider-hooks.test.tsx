/**
 * React provider and hook factory coverage.
 *
 * @vitest-environment jsdom
 * @module
 */

import { createElement, Fragment, type ComponentType, type ReactNode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { World } from 'koota';
import {
  createGameboardBuilder,
  createGameboardRecipe,
  createGameboardScenario,
  createGameboardWorld,
} from '../../../src';
import {
  GameboardPlanProvider,
  GameboardProvider,
  GameboardRecipeProvider,
  GameboardScenarioProvider,
  useGameboardActions,
  useGameboardActorActions,
  useGameboardCommandActions,
  useGameboardInteractionCommandPreview,
  useGameboardMovementActions,
  useGameboardPatrolActions,
  useGameboardQuestActions,
  useGameboardRuntime,
  useGameboardRuntimeSnapshot,
  useGameboardSystemActions,
} from '../react';

interface RuntimeProbeReport {
  seed: string;
  tileCount: number;
}

interface ActionProbeReport {
  boardActions: boolean;
  movementActions: boolean;
  actorActions: boolean;
  questActions: boolean;
  patrolActions: boolean;
  commandActions: boolean;
  systemActions: boolean;
  emptyPreview: undefined;
  tilePreviewExists: boolean;
}

const TestGameboardProvider = GameboardProvider as ComponentType<{
  readonly world: World;
  readonly children?: ReactNode;
}>;

describe('React provider and hook factories', () => {
  afterEach(() => {
    cleanup();
  });

  it('mounts provider variants and creates action helpers in jsdom', () => {
    const plan = createGameboardBuilder({
      seed: 'react-provider-hooks',
      shape: { kind: 'rectangle', width: 1, height: 1 },
    }).build();
    const recipe = createGameboardRecipe({
      seed: 'react-provider-recipe',
      shape: { kind: 'rectangle', width: 1, height: 1 },
    });
    const scenario = createGameboardScenario('react-provider-scenario', recipe);
    const world = createGameboardWorld(plan);
    const runtimeReports: RuntimeProbeReport[] = [];
    let actionReport: ActionProbeReport | undefined;

    render(
      createElement(
        Fragment,
        null,
        createElement(
          TestGameboardProvider,
          { world },
          createElement(ActionFactoryProbe, {
            onReport: (report) => {
              actionReport = report;
            },
          })
        ),
        createElement(
          GameboardPlanProvider,
          { plan },
          createElement(RuntimeProbe, {
            onReport: (report) => {
              runtimeReports.push(report);
            },
          })
        ),
        createElement(
          GameboardRecipeProvider,
          { recipe },
          createElement(RuntimeProbe, {
            onReport: (report) => {
              runtimeReports.push(report);
            },
          })
        ),
        createElement(
          GameboardScenarioProvider,
          { scenario },
          createElement(RuntimeProbe, {
            onReport: (report) => {
              runtimeReports.push(report);
            },
          })
        )
      )
    );

    expect(actionReport).toEqual({
      boardActions: true,
      movementActions: true,
      actorActions: true,
      questActions: true,
      patrolActions: true,
      commandActions: true,
      systemActions: true,
      emptyPreview: undefined,
      tilePreviewExists: true,
    });
    expect(runtimeReports).toEqual([
      { seed: 'react-provider-hooks', tileCount: 1 },
      { seed: 'react-provider-recipe', tileCount: 1 },
      { seed: 'react-provider-recipe', tileCount: 1 },
    ]);
  });
});

function RuntimeProbe({ onReport }: { onReport: (report: RuntimeProbeReport) => void }): null {
  const runtime = useGameboardRuntime();
  const snapshot = useGameboardRuntimeSnapshot();
  onReport({ seed: runtime.snapshot().plan.seed, tileCount: snapshot.plan.tiles.length });
  return null;
}

function ActionFactoryProbe({
  onReport,
}: {
  onReport: (report: ActionProbeReport) => void;
}): null {
  const boardActions = useGameboardActions();
  const movementActions = useGameboardMovementActions();
  const actorActions = useGameboardActorActions();
  const questActions = useGameboardQuestActions();
  const patrolActions = useGameboardPatrolActions();
  const commandActions = useGameboardCommandActions();
  const systemActions = useGameboardSystemActions();
  const emptyPreview = useGameboardInteractionCommandPreview(undefined);
  const tilePreview = useGameboardInteractionCommandPreview('0,0');

  onReport({
    boardActions: typeof boardActions.spawnPlacement === 'function',
    movementActions: typeof movementActions.setAgent === 'function',
    actorActions: typeof actorActions.spawn === 'function',
    questActions: typeof questActions.spawn === 'function',
    patrolActions: typeof patrolActions.set === 'function',
    commandActions: typeof commandActions.preview === 'function',
    systemActions: typeof systemActions.dispatchCommand === 'function',
    emptyPreview,
    tilePreviewExists: tilePreview !== undefined,
  });
  return null;
}
