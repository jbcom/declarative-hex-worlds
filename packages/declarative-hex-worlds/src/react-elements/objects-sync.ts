/**
 * `src/react-elements/objects-sync.ts` — the pure sync logic behind
 * `<GameboardObjects>` (RFC 0001 RFC0-8b).
 *
 * Split out of `objects.ts` (which imports `@react-three/fiber`) so these
 * functions carry NO R3F dependency: they unit-test fast in the Node harness
 * without loading R3F's large module tree, and they hold the actual per-frame
 * reconciliation logic. `<GameboardObjects>` is the thin R3F wrapper that calls
 * `syncHexWorldPlacements` each frame.
 *
 * @module
 */
import type { Object3D } from 'three';
// combineSources is renderer-neutral and now lives in the asset-source core;
// re-exported here so `declarative-hex-worlds/react-elements` keeps surfacing it.
import { combineSources } from '../asset-source';
import type { GameboardPlan } from '../gameboard';
import { type LoadedGameboardPlacementObject, syncGameboardPlacementObjects } from '../three';
import type { HexWorldContextValue } from './context';

export { combineSources };

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
  // Nothing to render until the plan is ready AND at least one loader exists. A
  // tileset-only board needs only a `textureLoader` (no GLTF `loader`); a
  // GLTF-only board needs only a `loader`. Bail only when BOTH are absent.
  if (!plan || (!context.loader && !context.textureLoader)) {
    return undefined;
  }
  const source = combineSources(context.sources);
  return syncGameboardPlacementObjects(plan.placements, {
    ...(context.loader === undefined ? {} : { loader: context.loader }),
    ...(source === undefined ? {} : { source }),
    ...(context.textureLoader === undefined ? {} : { textureLoader: context.textureLoader }),
    ...(context.baseUrl === undefined ? {} : { baseUrl: context.baseUrl }),
    parent: scene,
    records,
    deltaSeconds,
  });
}
