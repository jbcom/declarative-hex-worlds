/**
 * `src/react-elements/hex-world.ts` — the `<HexWorld>` root element + the
 * `useHexWorld` hook (RFC 0001 RFC0-8b).
 *
 * `<HexWorld>` mounts the koota world (wrapping `GameboardPlanProvider` /
 * `GameboardRuntimeProvider`) and provides the `AssetSource` registry + loaders
 * through `HexWorldContext`. It does NOT create an R3F `<Canvas>` — the consumer
 * owns the Canvas, camera, renderer, and lights (see the design doc's Canvas-
 * ownership decision). `<HexWorld>` is used inside a consumer's `<Canvas>`;
 * `<GameboardObjects>` (its child) drives the render-sync bridge.
 *
 * @module
 */
import { createElement, type ReactNode, useCallback, useMemo, useState } from 'react';
import type { AssetSource } from '../asset-source';
import type { HexGeometry } from '../coordinates';
import type { GameboardPlan } from '../gameboard';
import { GameboardPlanProvider, GameboardRuntimeProvider, useGameboardRuntime } from '../react';
import type { GameboardRuntime } from '../runtime';
import type { GameboardGltfLoader, GameboardSheetTextureLoader } from '../three';
import { HexWorldContext, type HexWorldContextValue, useHexWorldContext } from './context';

/** Props for `<HexWorld>`. Provide exactly one of `plan` or `runtime`. */
export interface HexWorldProps {
  /** Board plan to create + mount a runtime from. */
  plan?: GameboardPlan;
  /** An existing runtime to mount (alternative to `plan`). */
  runtime?: GameboardRuntime;
  /** Asset source(s) placements resolve against, in order (first match wins). */
  source?: AssetSource | readonly AssetSource[];
  /** GLTF loader for model/tile GLTF placements. */
  loader?: GameboardGltfLoader;
  /** Sheet-texture loader for tileset-cell placements. */
  textureLoader?: GameboardSheetTextureLoader;
  /** Base URL for resolving relative asset paths. */
  baseUrl?: string | URL;
  /**
   * Hex world geometry override for tile PLACEMENT (row spacing). Set for a
   * tileset board whose cells bake a vertically-foreshortened hex so its rows pack
   * tightly enough for full-cell quads to interlock seamlessly. Use
   * `tilesetHexGeometry(manifest)` to derive it from a tileset manifest.
   */
  geometry?: HexGeometry;
  /** Board content + bridge (`<Tile>`, `<Model>`, `<GameboardObjects>`, …). */
  children?: ReactNode;
}

function HexWorldProvider({
  source,
  loader,
  textureLoader,
  baseUrl,
  geometry,
  children,
}: Omit<HexWorldProps, 'plan' | 'runtime'>): ReturnType<typeof createElement> {
  // Sources declared via the `source` prop plus any registered at runtime by
  // `<Tileset>`/`<Spriteset>` children.
  const propSources = useMemo<readonly AssetSource[]>(
    () => (source === undefined ? [] : Array.isArray(source) ? source : [source as AssetSource]),
    [source]
  );
  const [registered, setRegistered] = useState<readonly AssetSource[]>([]);

  const registerSource = useCallback((next: AssetSource): (() => void) => {
    setRegistered((current) => [...current, next]);
    return () => setRegistered((current) => current.filter((entry) => entry !== next));
  }, []);

  const value = useMemo<HexWorldContextValue>(
    () => ({
      sources: [...propSources, ...registered],
      registerSource,
      loader,
      textureLoader,
      baseUrl,
      geometry,
    }),
    [propSources, registered, registerSource, loader, textureLoader, baseUrl, geometry]
  );

  return createElement(HexWorldContext.Provider, { value }, children);
}

/**
 * The declarative hex-world root. Mounts the koota world and provides the asset
 * source registry + loaders. Use inside an R3F `<Canvas>`.
 */
export function HexWorld({
  plan,
  runtime,
  source,
  loader,
  textureLoader,
  baseUrl,
  geometry,
  children,
}: HexWorldProps): ReturnType<typeof createElement> {
  if ((plan === undefined) === (runtime === undefined)) {
    throw new Error('<HexWorld> requires exactly one of `plan` or `runtime`');
  }
  const inner = createElement(
    HexWorldProvider,
    { source, loader, textureLoader, baseUrl, geometry },
    children
  );
  return runtime !== undefined
    ? createElement(GameboardRuntimeProvider, { runtime }, inner)
    : createElement(GameboardPlanProvider, { plan: plan as GameboardPlan }, inner);
}

/** The handle returned by `useHexWorld`: the runtime facade + the source registry. */
export interface HexWorldHandle {
  /** The bound runtime facade (spawn, dispatch, tick, project, snapshot, …). */
  runtime: GameboardRuntime;
  /** The registered asset sources, in resolution order. */
  sources: readonly AssetSource[];
  /** Register an asset source. Returns an unregister fn. */
  registerSource(source: AssetSource): () => void;
}

/**
 * The world handle from the nearest `<HexWorld>`: the runtime facade plus the
 * asset-source registry. Throws outside a `<HexWorld>`.
 */
export function useHexWorld(): HexWorldHandle {
  const context = useHexWorldContext();
  const runtime = useGameboardRuntime();
  return { runtime, sources: context.sources, registerSource: context.registerSource };
}
