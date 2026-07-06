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
   * Hex orientation. `'pointy'` (default) has a vertex at the top (matches the
   * pointy-top tileset sheets); `'flat'` has a flat edge at the top.
   */
  orientation?: 'pointy' | 'flat';
  /** Whether the mesh is double-sided (default: true, so top-down cameras see it). */
  doubleSide?: boolean;
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
 * Build a textured hex `Mesh` for a tileset-cell render request: a hexagon
 * geometry (UV-mapped to the cell) with a `MeshBasicMaterial` sampling the sheet.
 * The caller owns the returned mesh's lifecycle (position it on the board, add to
 * the scene, dispose on removal).
 */
export function buildTexturedHexMesh(options: TexturedHexMeshOptions): Mesh {
  const { sheet, cell, hex, orientation = 'pointy', doubleSide = true } = options;
  const geometry = buildHexGeometry(
    cell,
    hex,
    sheet.sheetWidth,
    sheet.sheetHeight,
    orientation
  );
  const material = new MeshBasicMaterial({
    map: sheet.texture,
    transparent: true,
    side: doubleSide ? DoubleSide : undefined,
  });
  return new Mesh(geometry, material);
}
