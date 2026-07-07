/**
 * `src/react-elements/objects.ts` — the `<GameboardObjects>` R3F bridge
 * component (RFC 0001 RFC0-8b).
 *
 * Rendered inside `<HexWorld>` (which is itself inside a consumer's `<Canvas>`),
 * this component reconciles the R3F scene with the live koota placements each
 * frame via `syncGameboardPlacementObjects`, resolving each placement through the
 * world's registered asset source(s). It is where the imperative render bridge
 * becomes a declarative R3F element — no consumer wiring of the sync loop.
 *
 * The per-frame sync logic is extracted as the pure `syncHexWorldPlacements` so it
 * is unit-testable without an R3F frame loop; the component is a thin
 * `useFrame(() => syncHexWorldPlacements(...))` wrapper.
 *
 * @module
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import type { Object3D } from 'three';
import type { AssetRenderRequest, AssetSource, ResolveContext } from '../asset-source';
import type { GameboardPlan, GameboardPlacementSpec } from '../gameboard';
import { useProjectedGameboardPlan } from '../react';
import {
  type LoadedGameboardPlacementObject,
  syncGameboardPlacementObjects,
} from '../three';
import { type HexWorldContextValue, useHexWorldContext } from './context';

/**
 * Compose registered sources into one first-match `AssetSource`: the first source
 * to resolve a placement wins. Returns the single source directly, or `undefined`
 * for an empty registry (the bridge then falls back to the plain GLTF URL path).
 */
export function combineSources(sources: readonly AssetSource[]): AssetSource | undefined {
  if (sources.length === 0) {
    return undefined;
  }
  if (sources.length === 1) {
    return sources[0];
  }
  return {
    kind: 'composite',
    resolve(placement: GameboardPlacementSpec, ctx?: ResolveContext): AssetRenderRequest | undefined {
      for (const source of sources) {
        const request = source.resolve(placement, ctx);
        if (request) {
          return request;
        }
      }
      return undefined;
    },
    resolveEdge(assetId: string, edgeMask: number, ctx?: ResolveContext): AssetRenderRequest | undefined {
      for (const source of sources) {
        const request = source.resolveEdge?.(assetId, edgeMask, ctx);
        if (request) {
          return request;
        }
      }
      return undefined;
    },
  };
}

/**
 * Reconcile a scene parent with a projected board's placements through the world
 * context's source(s) + loaders. Returns the sync promise (or undefined when the
 * plan/loader isn't ready yet). Pure of R3F — unit-testable.
 */
export function syncHexWorldPlacements(
  plan: GameboardPlan | undefined,
  context: HexWorldContextValue,
  scene: Object3D,
  records: Map<string, LoadedGameboardPlacementObject>,
  deltaSeconds: number | undefined
): Promise<unknown> | undefined {
  if (!plan || !context.loader) {
    return undefined;
  }
  const source = combineSources(context.sources);
  return syncGameboardPlacementObjects(plan.placements, {
    loader: context.loader,
    ...(source === undefined ? {} : { source }),
    ...(context.textureLoader === undefined ? {} : { textureLoader: context.textureLoader }),
    ...(context.baseUrl === undefined ? {} : { baseUrl: context.baseUrl }),
    parent: scene,
    records,
    deltaSeconds,
  });
}

/** Props for `<GameboardObjects>`. */
export interface GameboardObjectsProps {
  /** Advance loaded animation mixers each frame (default: true). */
  animate?: boolean;
}

/**
 * The R3F render bridge: syncs the scene with the projected koota placements each
 * frame through the world's asset source(s) + loaders. Renders nothing itself.
 *
 * The per-frame WORK is the pure `syncHexWorldPlacements` (unit-covered above);
 * this component is only the R3F hook wiring that feeds it. R3F renders it through
 * its own reconciler inside `<Canvas>`, which v8 coverage cannot instrument
 * (it's covered behaviorally by tests/browser/react-elements.test.ts mounting it
 * in a real Canvas, but not line-instrumented) — so the thin wrapper is ignored.
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
