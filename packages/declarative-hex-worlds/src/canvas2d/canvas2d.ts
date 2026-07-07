/**
 * `src/canvas2d/canvas2d.ts` — the canvas-2D renderer binding (RFC 0001
 * signals+bindings, the 2D substrate proof).
 *
 * A SECOND renderer binding alongside `src/three`, with ZERO new dependencies: it
 * subscribes to the SAME koota placement signals and reconciles a 2D drawing
 * surface. Where the three binding turns a `{ type:'gltf', dimension:'3d' }`
 * request into an `Object3D`, this binding turns a `{ type:'tileset-cell',
 * dimension:'2d' }` request into a sprite blit on a `CanvasRenderingContext2D`.
 *
 * Its existence is the PROOF that the render seam is genuinely substrate-agnostic:
 * the same world drives both, and this module imports NO renderer library (no
 * three, no pixi) — only the neutral asset-source resolution + a standard 2D
 * canvas context. A pixi binding is the same shape with `PIXI.Sprite` in place of
 * `drawImage`.
 *
 * @module
 */
import type { AssetSource, ResolveContext } from '../asset-source';
import type { GameboardPlacementSpec } from '../gameboard';

/**
 * A drawable 2D image source keyed by URL. The binding is decoupled from HOW
 * sheets load — the host supplies loaded images (an `HTMLImageElement`,
 * `ImageBitmap`, `OffscreenCanvas`, or any `CanvasImageSource`). This keeps the
 * module free of DOM-loading assumptions and testable with a stub.
 */
export type Canvas2dSheetImages = ReadonlyMap<string, CanvasImageSource>;

/** Options controlling how world coordinates map to canvas pixels. */
export interface Canvas2dViewport {
  /** Pixels per world unit along the board plane (default 32). */
  readonly pixelsPerUnit?: number;
  /** Canvas-pixel origin the world origin maps to (default: canvas center). */
  readonly originX?: number;
  readonly originY?: number;
}

/** Options for a canvas-2D reconciliation pass. */
export interface Canvas2dSyncOptions {
  /** The tileset (or composite) source resolving placements to `tileset-cell` requests. */
  readonly source: AssetSource;
  /** Loaded sheet images keyed by the `sheetUrl` a request carries. */
  readonly sheets: Canvas2dSheetImages;
  /** Coordinate mapping. */
  readonly viewport?: Canvas2dViewport;
  /** Optional resolve context threaded to the source. */
  readonly context?: ResolveContext;
}

/** One placement drawn during a pass (returned for assertion/inspection). */
export interface Canvas2dDrawnPlacement {
  readonly placementId: string;
  readonly assetId: string;
  readonly sheetUrl: string;
  /** Destination rect on the canvas, in pixels. */
  readonly dest: { x: number; y: number; width: number; height: number };
}

/** Result of a canvas-2D reconciliation pass. */
export interface Canvas2dSyncResult {
  /** Placements drawn this pass, in draw order (back-to-front by board depth). */
  readonly drawn: readonly Canvas2dDrawnPlacement[];
  /** Placements skipped because they were not 2D (`tileset-cell`) or had no sheet. */
  readonly skipped: readonly string[];
}

const DEFAULT_PIXELS_PER_UNIT = 32;

/**
 * Reconcile a 2D canvas context with a board's placements through a tileset source.
 * Resolves each placement to a `tileset-cell` request, maps its world position to
 * canvas pixels, and blits the sheet cell. Placements are drawn back-to-front by
 * board depth (world z then y) so overlap sorts correctly — the 2D analogue of the
 * three binding's depth handling. Non-2D placements (no `tileset-cell` request) are
 * skipped: a canvas-2D surface renders the 2D slice of a world, exactly as a 3D
 * binding renders the 3D slice.
 */
export function syncCanvas2dPlacements(
  ctx: CanvasRenderingContext2D,
  placements: readonly GameboardPlacementSpec[],
  options: Canvas2dSyncOptions
): Canvas2dSyncResult {
  const pixelsPerUnit = options.viewport?.pixelsPerUnit ?? DEFAULT_PIXELS_PER_UNIT;
  const originX = options.viewport?.originX ?? ctx.canvas.width / 2;
  const originY = options.viewport?.originY ?? ctx.canvas.height / 2;

  const drawn: Canvas2dDrawnPlacement[] = [];
  const skipped: string[] = [];

  // Draw back-to-front: farther board depth first. Board plane is world x/z; y is
  // elevation. Sort by (z, y) ascending so nearer/higher placements draw on top.
  const ordered = [...placements].sort((a, b) => {
    const az = a.position.z;
    const bz = b.position.z;
    if (az !== bz) {
      return az - bz;
    }
    return a.position.y - b.position.y;
  });

  for (const placement of ordered) {
    const request = options.source.resolve(placement, options.context);
    if (!request || request.type !== 'tileset-cell') {
      skipped.push(placement.id);
      continue;
    }
    const sheet = options.sheets.get(request.sheetUrl);
    if (!sheet) {
      skipped.push(placement.id);
      continue;
    }
    const scale = request.transform?.scale ?? placement.scale;
    const destWidth = request.hex.width * pixelsPerUnit * scale;
    const destHeight = request.hex.height * pixelsPerUnit * scale;
    // World x/z → screen. y is negated so +z is "down" the screen (top-down board).
    const worldX = request.transform?.position.x ?? placement.position.x;
    const worldZ = request.transform?.position.z ?? placement.position.z;
    const destX = originX + worldX * pixelsPerUnit - destWidth / 2;
    const destY = originY + worldZ * pixelsPerUnit - destHeight / 2;

    ctx.drawImage(
      sheet,
      request.cell.x,
      request.cell.y,
      request.cell.width,
      request.cell.height,
      destX,
      destY,
      destWidth,
      destHeight
    );
    drawn.push({
      placementId: placement.id,
      assetId: placement.assetId,
      sheetUrl: request.sheetUrl,
      dest: { x: destX, y: destY, width: destWidth, height: destHeight },
    });
  }

  return { drawn, skipped };
}
