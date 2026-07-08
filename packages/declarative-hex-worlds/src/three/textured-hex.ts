/**
 * `src/three/textured-hex.ts` — the textured-hex-mesh render path (RFC 0001 G2 /
 * RFC0-8).
 *
 * Builds a flat hexagon mesh whose face samples one cell of a sprite sheet, for
 * the `{ type: 'tileset-cell' }` AssetRenderRequest. This is the tileset analogue
 * of `loadGameboardPlacementObject` (the GLTF path): the three bridge dispatches
 * a tileset-cell request here.
 *
 * The hexagon lies in the XZ plane (Y up), pointy-top by default to match the
 * pointy-top tileset sheets, sized to the request's `HexDims`. UVs map each hex
 * corner + center to the cell's sub-rect of the sheet, so the sheet is sampled
 * per-cell without slicing the image.
 *
 * See `docs/plans/declarative-render-surface.design.md` §"Tileset manifest".
 *
 * @module
 */
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  type Texture,
} from 'three';
import type { CellRect, HexDims } from '../asset-source';

/** A texture whose full pixel dimensions are known (for UV normalization). */
export interface SheetTexture {
  texture: Texture;
  /** Full sheet width in pixels. */
  sheetWidth: number;
  /** Full sheet height in pixels. */
  sheetHeight: number;
}

/** Options for building a textured hex mesh. */
export interface TexturedHexMeshOptions {
  sheet: SheetTexture;
  cell: CellRect;
  hex: HexDims;
  /**
   * Draw shape (see `AssetRenderRequest['shape']`):
   *   - `'quad'` (default): the full cell rect is a rectangle spanning
   *     `hex.width × hex.height`. Painterly hex atlases paint each cell as a
   *     flattened hex with TRANSPARENT corners; a full quad lets neighbours' opaque
   *     bodies fill each other's transparent corners, tessellating SEAMLESSLY. This
   *     matches the canvas-2D binding, which always blits the whole cell.
   *   - `'hex'`: clip to a hexagon silhouette. Only for opaque edge-to-edge cells.
   */
  shape?: 'quad' | 'hex';
  /**
   * Hex orientation (only meaningful for `shape: 'hex'`). `'pointy'` (default) has
   * a vertex at the top; `'flat'` has a flat edge at the top.
   */
  orientation?: 'pointy' | 'flat';
  /** Whether the mesh is double-sided (default: true, so top-down cameras see it). */
  doubleSide?: boolean;
  /**
   * Optional multiplicative RGB tint (channels `[0, 1]`, white ⇒ identity), applied
   * to the material `color` so a game can shade a shared atlas per placement
   * (fog-of-war / season / team). Omitted ⇒ the material keeps its default white
   * colour (no tint).
   */
  tint?: { r: number; g: number; b: number };
  /**
   * Optional opacity in `[0, 1]`. `< 1` switches the material to the TRANSPARENT
   * queue (a translucent shroud) while KEEPING `alphaTest` so the hex corners still
   * cut out. Omitted or `>= 1` leaves the default OPAQUE-queue cutout path
   * (`transparent: false`) byte-for-byte unchanged, preserving seamless tessellation.
   */
  opacity?: number;
}

/**
 * The six corner angles (radians) for a hex, measured in the XZ plane. Pointy-top
 * starts at 30°, flat-top at 0°.
 */
function cornerAngles(orientation: 'pointy' | 'flat'): number[] {
  const offset = orientation === 'pointy' ? Math.PI / 6 : 0;
  return Array.from({ length: 6 }, (_, i) => offset + (i * Math.PI) / 3);
}

/**
 * Build a hexagon `BufferGeometry` in the XZ plane (Y=0), with UVs mapping each
 * corner + center to the given cell rect of a sheet. The hex spans `hex.width` on
 * X and `hex.height` on Z.
 */
export function buildHexGeometry(
  cell: CellRect,
  hex: HexDims,
  sheetWidth: number,
  sheetHeight: number,
  orientation: 'pointy' | 'flat' = 'pointy'
): BufferGeometry {
  const halfW = hex.width / 2;
  const halfH = hex.height / 2;
  const angles = cornerAngles(orientation);

  // Cell UV bounds (three UV origin is bottom-left; image rows go top-down, so
  // flip V).
  const u0 = cell.x / sheetWidth;
  const u1 = (cell.x + cell.width) / sheetWidth;
  const v0 = 1 - (cell.y + cell.height) / sheetHeight;
  const v1 = 1 - cell.y / sheetHeight;
  const uMid = (u0 + u1) / 2;
  const vMid = (v0 + v1) / 2;

  const positions: number[] = [0, 0, 0]; // center
  const uvs: number[] = [uMid, vMid];
  for (const angle of angles) {
    const x = Math.cos(angle) * halfW;
    const z = Math.sin(angle) * halfH;
    positions.push(x, 0, z);
    // Map the corner's local [-half, +half] extent to the cell UV rect.
    uvs.push(uMid + (x / halfW) * ((u1 - u0) / 2), vMid - (z / halfH) * ((v1 - v0) / 2));
  }

  // Triangle fan: center (0) → corner i → corner i+1.
  const indices: number[] = [];
  for (let i = 1; i <= 6; i++) {
    const next = i === 6 ? 1 : i + 1;
    indices.push(0, i, next);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Build a QUAD `BufferGeometry` in the XZ plane (Y=0): a flat rectangle spanning
 * `hex.width` on X and `hex.height` on Z, UV-mapped to the cell's sub-rect. This is
 * the seamless-tessellation path — the full cell (including its transparent hex
 * corners) is drawn, so neighbouring cells' opaque bodies fill each other's corners
 * into continuous terrain. The 3D analogue of the canvas-2D binding's `drawImage`.
 */
export function buildQuadGeometry(
  cell: CellRect,
  hex: HexDims,
  sheetWidth: number,
  sheetHeight: number
): BufferGeometry {
  const halfW = hex.width / 2;
  const halfH = hex.height / 2;

  // Cell UV bounds (three UV origin is bottom-left; image rows go top-down, so
  // flip V).
  const u0 = cell.x / sheetWidth;
  const u1 = (cell.x + cell.width) / sheetWidth;
  const v0 = 1 - (cell.y + cell.height) / sheetHeight;
  const v1 = 1 - cell.y / sheetHeight;

  // Four corners in the XZ plane: (-x,-z)…(+x,+z). The -Z corners map to the cell's
  // TOP row (v1) and the +Z corners to the BOTTOM (v0), so the sprite is upright
  // when viewed from a top-down / iso camera (consistent with buildHexGeometry).
  const positions = [-halfW, 0, -halfH, halfW, 0, -halfH, halfW, 0, halfH, -halfW, 0, halfH];
  const uvs = [u0, v1, u1, v1, u1, v0, u0, v0];
  // CCW winding (viewed from +Y) so the FRONT face points up — tiles stay visible to
  // a top-down / iso camera even when a consumer sets `doubleSide: false`.
  const indices = [0, 1, 2, 0, 2, 3];

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Build a textured `Mesh` for a tileset-cell render request. Defaults to a full
 * quad (`shape: 'quad'`) — the seamless path for transparent-corner painterly hex
 * atlases; `shape: 'hex'` clips to a hexagon for opaque edge-to-edge cells. Sampled
 * with a `MeshBasicMaterial` over the cell. The caller owns the returned mesh's
 * lifecycle (position it on the board, add to the scene, dispose on removal).
 */
export function buildTexturedHexMesh(options: TexturedHexMeshOptions): Mesh {
  const {
    sheet,
    cell,
    hex,
    shape = 'quad',
    orientation = 'pointy',
    doubleSide = true,
    tint,
    opacity,
  } = options;
  const geometry =
    shape === 'hex'
      ? buildHexGeometry(cell, hex, sheet.sheetWidth, sheet.sheetHeight, orientation)
      : buildQuadGeometry(cell, hex, sheet.sheetWidth, sheet.sheetHeight);
  // A full-cell quad's TRANSPARENT hex corners must not show the clear colour
  // (ocean blue) as diamond gaps between tiles. Use ALPHA-CUTOUT, not alpha
  // BLENDING: `transparent: false` + `alphaTest` renders in the OPAQUE queue and the
  // GPU hard-`discard`s corner fragments below the threshold — they never write
  // colour OR depth, so the neighbour's opaque body shows through and tiles still
  // z-sort by elevation. (Alpha blending — `transparent: true` — sorts back-to-front
  // and, combined with alphaTest, gave inconsistent corner discard for the painterly
  // atlas; the cutout path is the reliable one for its hard-edged alpha.)
  const material = new MeshBasicMaterial({
    map: sheet.texture,
    transparent: false,
    alphaTest: 0.5,
    side: doubleSide ? DoubleSide : undefined,
  });
  // Per-placement shading (fog/season/team). Both are OPT-IN: the default (no tint,
  // no opacity < 1) leaves the opaque-queue cutout material above untouched, so
  // untinted/opaque tiles keep their byte-identical seamless-tessellation path.
  if (tint) {
    // Multiplicative tint = the material's base colour (MeshBasicMaterial multiplies
    // `color` by the sampled texel), so white is identity and a dimmed/warmed colour
    // shades the shared atlas without re-authoring art.
    material.color.setRGB(tint.r, tint.g, tint.b);
  }
  if (opacity !== undefined && opacity < 1) {
    // A translucent shroud: move to the transparent queue (accepting its back-to-front
    // sort) but KEEP alphaTest so the hex corners still hard-discard and don't show
    // the clear colour as diamonds.
    material.transparent = true;
    material.opacity = opacity;
  }
  return new Mesh(geometry, material);
}
