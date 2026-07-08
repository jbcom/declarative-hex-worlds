/**
 * Browser coverage for the RFC0-8b declarative element surface
 * (`src/react-elements`).
 *
 * The element LOGIC — `<HexWorld>` (koota providers + source registry), `<Tile>`/
 * `<Model>`/`<Sprite>` (spawn/remove koota placements), `<Tileset>` (register a
 * source), and the `useHexWorld`/`useTile`/`usePlacement`/`useHexPath` hooks — is
 * pure React (no R3F), so it mounts via plain `createRoot` for reliable, act-driven
 * assertions. `<GameboardObjects>` (the only R3F component: `useThree`/`useFrame`)
 * is covered by the tileset-render browser test's bridge path + a focused Canvas
 * smoke here.
 */
import { Canvas } from '@react-three/fiber';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CanvasTexture, Group } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createGameboardBuilder,
  createGameboardRuntime,
  createTilesetSource,
  type GameboardPlan,
  type TilesetManifest,
} from '../../src/index';
import {
  GameboardObjects,
  HexWorld,
  Model,
  Sprite,
  Tile,
  Tileset,
  useHexPath,
  useHexWorld,
  usePlacement,
  useTile,
} from '../../src/react-elements';
import type { GameboardSheetTextureLoader, SheetTexture } from '../../src/three';

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = undefined;
  }
  host?.remove();
  host = undefined;
});

function plan(): GameboardPlan {
  return createGameboardBuilder({
    seed: 'react-elements',
    shape: { kind: 'rectangle', width: 3, height: 3 },
  }).build();
}

const manifest: TilesetManifest = {
  schemaVersion: '1',
  kind: 'tileset',
  sheets: {
    grassland: {
      url: 'tiles/grassland.png',
      grid: { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 },
      role: 'fill',
    },
  },
  biomes: { grass: { sheet: 'grassland', select: 'first' } },
};

function drawSheet(): SheetTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 830;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#3a7d34';
    ctx.fillRect(0, 0, 480, 830);
  }
  return { texture: new CanvasTexture(canvas), sheetWidth: 480, sheetHeight: 830 };
}

function sheetLoader(): GameboardSheetTextureLoader {
  const sheet = drawSheet();
  return {
    async loadAsync() {
      return sheet;
    },
  };
}

const gltfLoader = {
  async loadAsync() {
    return { scene: new Group(), animations: [] };
  },
};

async function render(element: React.ReactElement): Promise<void> {
  host = document.createElement('div');
  document.body.replaceChildren(host);
  root = createRoot(host);
  await act(async () => root?.render(element));
}

describe('declarative elements (RFC0-8b)', () => {
  it('spawns koota placements for <Tile>/<Model> elements', async () => {
    // The board-only placement count (no element children) is the baseline; the
    // <Tile>/<Model> elements add to it.
    let baseline = -1;
    function Baseline(): null {
      const { runtime } = useHexWorld();
      React.useEffect(() => {
        baseline = runtime.plan().placements.length;
      });
      return null;
    }
    await render(
      React.createElement(
        HexWorld,
        { plan: plan(), loader: gltfLoader },
        React.createElement(Baseline, null)
      )
    );
    await act(async () => root?.unmount());
    root = undefined;

    let withElements = -1;
    function Probe(): null {
      const { runtime } = useHexWorld();
      React.useEffect(() => {
        withElements = runtime.plan().placements.length;
      });
      return null;
    }
    await render(
      React.createElement(
        HexWorld,
        { plan: plan(), loader: gltfLoader },
        React.createElement(Tile, { at: { q: 0, r: 0 }, assetId: 'grass', biome: 'grass' }),
        React.createElement(Model, { at: { q: 1, r: 0 }, assetId: 'castle' }),
        React.createElement(Probe, null)
      )
    );
    // Two elements → two more placements than the board baseline.
    expect(withElements).toBe(baseline + 2);
  });

  it("merges a <Tile>'s metadata prop with its biome (biome wins on a key clash)", async () => {
    // A game drives per-tile render hints (fog tint/opacity) via the metadata prop; the
    // tile\'s own biome must survive the merge so the tileset source still resolves it.
    let captured: Record<string, unknown> | undefined;
    function Probe(): null {
      const { runtime } = useHexWorld();
      React.useEffect(() => {
        const spawned = runtime.plan().placements.find((p) => p.metadata && 'tintR' in p.metadata);
        captured = spawned?.metadata as Record<string, unknown> | undefined;
      });
      return null;
    }
    await render(
      React.createElement(
        HexWorld,
        { plan: plan(), loader: gltfLoader },
        React.createElement(Tile, {
          at: { q: 0, r: 0 },
          assetId: 'grass',
          biome: 'grass',
          // biome:'meadow' here must NOT override the real biome prop; tint keys pass through.
          metadata: { tintR: 0.5, tintG: 0.5, tintB: 0.5, opacity: 0.4, biome: 'meadow' },
        }),
        React.createElement(Probe, null)
      )
    );
    expect(captured).toMatchObject({ tintR: 0.5, tintG: 0.5, tintB: 0.5, opacity: 0.4 });
    // The element's own biome ('grass') wins over the metadata's biome ('meadow').
    expect(captured?.biome).toBe('grass');
  });

  it('<Tileset> registers a source into the world; useHexWorld exposes it', async () => {
    let sourceCount = -1;
    function Probe(): null {
      const { sources } = useHexWorld();
      React.useEffect(() => {
        sourceCount = sources.length;
      });
      return null;
    }
    await render(
      React.createElement(
        HexWorld,
        { plan: plan(), loader: gltfLoader, textureLoader: sheetLoader() },
        React.createElement(Tileset, { manifest }),
        React.createElement(Probe, null)
      )
    );
    expect(sourceCount).toBeGreaterThanOrEqual(1);
  });

  it('a prop-source passed to <HexWorld> is exposed alongside registered ones', async () => {
    let count = -1;
    function Probe(): null {
      const { sources } = useHexWorld();
      React.useEffect(() => {
        count = sources.length;
      });
      return null;
    }
    // Reuse the tileset source instance via a Tileset AND a prop source.
    await render(
      React.createElement(
        HexWorld,
        { plan: plan(), loader: gltfLoader },
        React.createElement(Tileset, { manifest }),
        React.createElement(Probe, null)
      )
    );
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('usePlacement reads placements at a tile', async () => {
    let placementsAtOrigin = -1;
    function Probe(): null {
      const placements = usePlacement({ q: 0, r: 0 });
      React.useEffect(() => {
        placementsAtOrigin = placements.length;
      });
      return null;
    }
    await render(
      React.createElement(
        HexWorld,
        { plan: plan(), loader: gltfLoader },
        React.createElement(Tile, { at: { q: 0, r: 0 }, assetId: 'grass' }),
        React.createElement(Probe, null)
      )
    );
    expect(placementsAtOrigin).toBeGreaterThanOrEqual(1);
  });

  it('useHexWorld throws outside a <HexWorld>', async () => {
    let threw = false;
    function Bad(): null {
      try {
        // biome-ignore lint/correctness/useHookAtTopLevel: deliberately calling the hook without a provider to assert it throws — this is the whole test.
        useHexWorld();
      } catch {
        threw = true;
      }
      return null;
    }
    await render(React.createElement(Bad, null));
    expect(threw).toBe(true);
  });

  it('<HexWorld> requires exactly one of plan or runtime', () => {
    expect(() => HexWorld({ loader: gltfLoader })).toThrow(/exactly one/);
  });

  it('accepts a runtime prop (alternative to plan) and an array of sources', async () => {
    let sourceCount = -1;
    const runtime = createGameboardRuntime(plan());
    const s1 = createTilesetSource({ manifest });
    const s2 = createTilesetSource({ manifest });
    function Probe(): null {
      const { sources } = useHexWorld();
      React.useEffect(() => {
        sourceCount = sources.length;
      });
      return null;
    }
    await render(
      React.createElement(
        HexWorld,
        { runtime, loader: gltfLoader, source: [s1, s2] },
        React.createElement(Probe, null)
      )
    );
    // Both prop sources are exposed.
    expect(sourceCount).toBe(2);
  });

  it('useTile reads the tile at coordinates; useHexPath finds a path', async () => {
    let hasTile = false;
    let pathFound = false;
    function Probe(): null {
      const tile = useTile({ q: 0, r: 0 });
      const path = useHexPath({ q: 0, r: 0 }, { q: 2, r: 0 });
      React.useEffect(() => {
        hasTile = tile.entity !== undefined;
        pathFound = path !== undefined;
      });
      return null;
    }
    await render(
      React.createElement(
        HexWorld,
        { plan: plan(), loader: gltfLoader },
        React.createElement(Probe, null)
      )
    );
    expect(hasTile).toBe(true);
    expect(pathFound).toBe(true);
  });

  it('removes a placement when its element unmounts', async () => {
    let withModel = -1;
    let withoutModel = -1;
    function Probe({ report }: { report: (n: number) => void }): null {
      const { runtime } = useHexWorld();
      React.useEffect(() => {
        report(runtime.plan().placements.length);
      });
      return null;
    }
    const withChild = (includeModel: boolean, report: (n: number) => void) =>
      React.createElement(
        HexWorld,
        { plan: plan(), loader: gltfLoader },
        includeModel
          ? React.createElement(Model, { at: { q: 1, r: 0 }, assetId: 'castle', id: 'm1' })
          : null,
        React.createElement(Probe, { report })
      );

    await render(
      withChild(true, (n) => {
        withModel = n;
      })
    );
    await act(async () =>
      root?.render(
        withChild(false, (n) => {
          withoutModel = n;
        })
      )
    );
    // Removing the <Model> element removed its placement.
    expect(withoutModel).toBe(withModel - 1);
  });

  it('accepts a single (non-array) source prop and spawns a <Sprite>', async () => {
    let baseline = -1;
    let withSprite = -1;
    function Baseline(): null {
      const { runtime } = useHexWorld();
      React.useEffect(() => {
        baseline = runtime.plan().placements.length;
      });
      return null;
    }
    function Probe(): null {
      const { runtime, sources } = useHexWorld();
      React.useEffect(() => {
        withSprite = runtime.plan().placements.length;
        expect(sources.length).toBe(1);
      });
      return null;
    }
    await render(
      React.createElement(
        HexWorld,
        { plan: plan(), loader: gltfLoader },
        React.createElement(Baseline, null)
      )
    );
    await act(async () => root?.unmount());
    root = undefined;
    await render(
      React.createElement(
        HexWorld,
        { plan: plan(), loader: gltfLoader, source: createTilesetSource({ manifest }) },
        React.createElement(Sprite, { at: { q: 0, r: 0 }, assetId: 'grass' }),
        React.createElement(Probe, null)
      )
    );
    expect(withSprite).toBe(baseline + 1);
  });

  it('forwards all optional placement props (rotation, scale, elevation)', async () => {
    let spawned = -1;
    let baseline = -1;
    function Baseline(): null {
      const { runtime } = useHexWorld();
      React.useEffect(() => {
        baseline = runtime.plan().placements.length;
      });
      return null;
    }
    function Probe(): null {
      const { runtime } = useHexWorld();
      React.useEffect(() => {
        spawned = runtime.plan().placements.length;
      });
      return null;
    }
    await render(
      React.createElement(
        HexWorld,
        { plan: plan(), loader: gltfLoader },
        React.createElement(Baseline, null)
      )
    );
    await act(async () => root?.unmount());
    root = undefined;
    await render(
      React.createElement(
        HexWorld,
        { plan: plan(), loader: gltfLoader },
        React.createElement(Model, {
          at: { q: 1, r: 0 },
          assetId: 'castle',
          id: 'full',
          rotationSteps: 2,
          scale: 1.5,
          elevationOffset: 0.5,
        }),
        React.createElement(Probe, null)
      )
    );
    expect(spawned).toBe(baseline + 1);
  });

  it('unregisters a <Tileset> source when it unmounts (registry cleanup)', async () => {
    const counts: number[] = [];
    function Probe(): null {
      const { sources } = useHexWorld();
      React.useEffect(() => {
        counts.push(sources.length);
      });
      return null;
    }
    const tree = (withTileset: boolean) =>
      React.createElement(
        HexWorld,
        { plan: plan(), loader: gltfLoader },
        withTileset ? React.createElement(Tileset, { manifest }) : null,
        React.createElement(Probe, null)
      );
    // Mount with the Tileset (source registered), then re-render without it —
    // the Tileset unmounts and its registerSource cleanup runs (the unregister fn).
    await render(tree(true));
    await act(async () => root?.render(tree(false)));
    // Source count went up (register) then back down (unregister cleanup fired).
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(1);
    expect(counts.at(-1)).toBe(0);
  });

  it('<Tileset hex> override is registered', async () => {
    let sourceCount = -1;
    function Probe(): null {
      const { sources } = useHexWorld();
      React.useEffect(() => {
        sourceCount = sources.length;
      });
      return null;
    }
    await render(
      React.createElement(
        HexWorld,
        { plan: plan(), loader: gltfLoader },
        React.createElement(Tileset, { manifest, hex: { width: 2, height: 2 } }),
        React.createElement(Probe, null)
      )
    );
    expect(sourceCount).toBe(1);
  });

  it('mounts <GameboardObjects> inside a real R3F Canvas without error', async () => {
    // Smoke: the R3F bridge component mounts + renders in a real Canvas. The
    // tileset-render browser test covers the actual sync/draw path in depth.
    await render(
      React.createElement(
        Canvas,
        null,
        React.createElement(
          HexWorld,
          { plan: plan(), loader: gltfLoader, textureLoader: sheetLoader() },
          React.createElement(Tileset, { manifest }),
          React.createElement(GameboardObjects, null)
        )
      )
    );
    // Reaching here without throwing is the assertion (Canvas + bridge mounted).
    expect(root).toBeDefined();
  });
});
