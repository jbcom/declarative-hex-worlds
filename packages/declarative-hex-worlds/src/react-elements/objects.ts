/**
 * `src/react-elements/objects.ts` — the `<GameboardObjects>` R3F bridge
 * component (RFC 0001 RFC0-8b).
 *
 * Rendered inside `<HexWorld>` (which is itself inside a consumer's `<Canvas>`),
 * this component reconciles the R3F scene with the live koota placements each
 * frame via `syncHexWorldPlacements`, resolving each placement through the
 * world's registered asset source(s). It is where the imperative render bridge
 * becomes a declarative R3F element — no consumer wiring of the sync loop.
 *
 * The per-frame WORK lives in `./objects-sync` (no R3F dependency, unit-tested);
 * this file is the thin `useFrame(() => syncHexWorldPlacements(...))` wrapper and
 * is the ONLY react-elements module that imports `@react-three/fiber`.
 *
 * @module
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import type { LoadedGameboardPlacementObject } from '../three';
import { useProjectedGameboardPlan } from '../react';
import { useHexWorldContext } from './context';
import { syncHexWorldPlacements } from './objects-sync';

/** Props for `<GameboardObjects>`. */
export interface GameboardObjectsProps {
  /** Advance loaded animation mixers each frame (default: true). */
  animate?: boolean;
}

/**
 * The R3F render bridge: syncs the scene with the projected koota placements each
 * frame through the world's asset source(s) + loaders. Renders nothing itself.
 *
 * The per-frame work is the pure `syncHexWorldPlacements` (unit-covered); this is
 * only the R3F hook wiring that feeds it. R3F renders it through its own
 * reconciler inside `<Canvas>`, which v8 coverage cannot instrument (it is
 * covered behaviorally by tests/browser/react-elements.test.ts mounting it in a
 * real Canvas, but not line-instrumented) — so the thin wrapper is ignored.
 */
/* v8 ignore start -- R3F reconciler component body; the frame work (syncHexWorldPlacements) is unit-covered, this is untraceable hook wiring. */
export function GameboardObjects({ animate = true }: GameboardObjectsProps = {}): null {
  const context = useHexWorldContext();
  const scene = useThree((state) => state.scene);
  const plan = useProjectedGameboardPlan();
  const records = useRef<Map<string, LoadedGameboardPlacementObject>>(new Map());

  useFrame((_, delta) => {
    void syncHexWorldPlacements(plan, context, scene, records.current, animate ? delta : undefined);
  });

  return null;
}
/* v8 ignore stop */
