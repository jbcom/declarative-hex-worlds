/**
 * `src/react-elements/objects.ts` — the `<GameboardObjects>` R3F bridge
 * component (RFC 0001 RFC0-8b).
 *
 * Rendered inside `<HexWorld>` (which is itself inside a consumer's `<Canvas>`),
 * this component is the three.js RENDERER BINDING in the signals+bindings model
 * (koota traits ARE the signals): it reactively subscribes to the koota placement
 * signals through `useProjectedGameboardPlan` (which re-projects when
 * `PlacementState`/tiles/world change) and reconciles the R3F scene, resolving each
 * placement through the world's registered asset source(s). The per-frame `useFrame`
 * only advances animation mixers — the DATA is signal-driven, not frame-polled. This
 * is the 3D binding; `src/canvas2d` is the 2D binding subscribing to the same signals.
 *
 * The per-frame WORK lives in `./objects-sync` (no R3F dependency, unit-tested);
 * this file is the thin `useFrame(() => syncHexWorldPlacements(...))` wrapper and
 * is the ONLY react-elements module that imports `@react-three/fiber`.
 *
 * @module
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { useProjectedGameboardPlan } from '../react';
import type { LoadedGameboardPlacementObject } from '../three';
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
  // Project with the world's geometry override (a foreshortened tileset board packs
  // its rows tighter so full-cell quads interlock — see HexWorldProps.geometry).
  const plan = useProjectedGameboardPlan(
    context.geometry === undefined ? undefined : { geometry: context.geometry }
  );
  const records = useRef<Map<string, LoadedGameboardPlacementObject>>(new Map());
  const inFlight = useRef(false);

  useFrame((_, delta) => {
    // syncHexWorldPlacements is ASYNC: a placement's record is only stored in
    // `records` AFTER its awaited texture/GLTF load resolves. Without an in-flight
    // guard, every frame between a pass kicking off and its loads resolving sees an
    // empty `records`, treats every placement as new, and re-adds a FULL board of
    // meshes — leaking ~one board per frame (e.g. 21k+ meshes for a 2.3k-tile board)
    // until the promises settle, exhausting draw calls and losing the GL context.
    // Serialize passes: never start a new reconcile while one is still pending, so a
    // pass completes and populates `records` before the next begins and dedupes.
    if (inFlight.current) {
      return;
    }
    const pass = syncHexWorldPlacements(
      plan,
      context,
      scene,
      records.current,
      animate ? delta : undefined
    );
    if (pass === undefined) {
      return;
    }
    inFlight.current = true;
    void pass.finally(() => {
      inFlight.current = false;
    });
  });

  return null;
}
/* v8 ignore stop */
