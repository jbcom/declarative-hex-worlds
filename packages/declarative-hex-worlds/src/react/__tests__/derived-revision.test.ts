/**
 * React derived selector revision gates.
 *
 * @vitest-environment jsdom
 * @module
 */

import { createElement, type ComponentType, type ReactNode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { World } from 'koota';
import { createGameboardBuilder } from '../../gameboard';
import {
  TileTerrain,
  createGameboardWorld,
  findTileEntity,
  spawnGameboardPlacement,
  updateGameboardPlacement,
  type PlacementStateValue,
} from '../../koota';
import { GameboardProvider, useGameboardPlacementSnapshots } from '../react';

const TestGameboardProvider = GameboardProvider as ComponentType<{
  readonly world: World;
  readonly children?: ReactNode;
}>;

interface PlacementProbeState {
  renders: number;
  snapshots: readonly PlacementStateValue[];
}

function PlacementProbe({ state }: { readonly state: PlacementProbeState }): null {
  state.renders += 1;
  state.snapshots = useGameboardPlacementSnapshots();
  return null;
}

function createPlacementWorld() {
  const plan = createGameboardBuilder({
    seed: 'react-derived-revision',
    shape: { kind: 'rectangle', width: 2, height: 1 },
  }).build();
  const world = createGameboardWorld(plan);
  spawnGameboardPlacement(world, {
    id: 'probe-banner',
    at: '0,0',
    assetId: 'flag_blue',
    kind: 'prop',
  });
  return world;
}

async function flushRevisionQueue(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('React derived selector revisions', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    cleanup();
  });

  it('does not rerender placement snapshots for tile-only trait changes', async () => {
    const world = createPlacementWorld();
    const state: PlacementProbeState = { renders: 0, snapshots: [] };
    render(
      createElement(TestGameboardProvider, { world }, createElement(PlacementProbe, { state }))
    );
    const initialRenders = state.renders;
    const tile = findTileEntity(world, '0,0');
    if (!tile) {
      throw new Error('expected fixture tile 0,0');
    }

    await act(async () => {
      tile.set(TileTerrain, { terrain: 'water' });
      await flushRevisionQueue();
    });

    expect(state.renders).toBe(initialRenders);
    expect(state.snapshots.map((placement) => placement.id)).toContain('probe-banner');
  });

  it('coalesces multiple placement changes into one selector rerender', async () => {
    const world = createPlacementWorld();
    const state: PlacementProbeState = { renders: 0, snapshots: [] };
    render(
      createElement(TestGameboardProvider, { world }, createElement(PlacementProbe, { state }))
    );
    const initialRenders = state.renders;

    await act(async () => {
      updateGameboardPlacement(world, 'probe-banner', { scale: 1.25 });
      updateGameboardPlacement(world, 'probe-banner', { scale: 1.5 });
      await flushRevisionQueue();
    });

    expect(state.renders).toBe(initialRenders + 1);
    expect(state.snapshots.find((placement) => placement.id === 'probe-banner')?.scale).toBe(1.5);
  });
});
