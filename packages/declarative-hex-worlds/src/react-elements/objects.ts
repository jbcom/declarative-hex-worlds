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
 * @module
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { AssetSource, AssetRenderRequest, ResolveContext } from '../asset-source';
import type { GameboardPlacementSpec } from '../gameboard';
import { useProjectedGameboardPlan } from '../react';
import {
  type LoadedGameboardPlacementObject,
  syncGameboardPlacementObjects,
} from '../three';
import { useHexWorldContext } from './context';

/**
 * Compose registered sources into one first-match `AssetSource`: the first source
 * to resolve a placement wins. Returns `undefined` if the registry is empty (the
 * bridge then falls back to the plain GLTF URL path).
 */
function combineSources(sources: readonly AssetSource[]): AssetSource | undefined {
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

/** Props for `<GameboardObjects>`. */
export interface GameboardObjectsProps {
  /** Advance loaded animation mixers each frame (default: true). */
  animate?: boolean;
}

/**
 * The R3F render bridge: syncs the scene with the projected koota placements each
 * frame through the world's asset source(s) + loaders. Renders nothing itself.
 */
export function GameboardObjects({ animate = true }: GameboardObjectsProps = {}): null {
  const context = useHexWorldContext();
  const scene = useThree((state) => state.scene);
  const plan = useProjectedGameboardPlan();
  const records = useRef<Map<string, LoadedGameboardPlacementObject>>(new Map());
  const source = useMemo(() => combineSources(context.sources), [context.sources]);

  useFrame((_, delta) => {
    if (!plan || !context.loader) {
      return;
    }
    void syncGameboardPlacementObjects(plan.placements, {
      loader: context.loader,
      ...(source === undefined ? {} : { source }),
      ...(context.textureLoader === undefined ? {} : { textureLoader: context.textureLoader }),
      ...(context.baseUrl === undefined ? {} : { baseUrl: context.baseUrl }),
      parent: scene,
      records: records.current,
      deltaSeconds: animate ? delta : undefined,
    });
  });

  return null;
}
