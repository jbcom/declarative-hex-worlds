import { BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { CellRect, HexDims } from '../../asset-source';
import { buildHexGeometry, buildTexturedHexMesh, type SheetTexture } from '../textured-hex';

const cell: CellRect = { x: 96, y: 83, width: 96, height: 83 };
const hex: HexDims = { width: 2, height: 2 };
const sheetWidth = 480;
const sheetHeight = 830;

function sheet(): SheetTexture {
  return { texture: new Texture(), sheetWidth, sheetHeight };
}

describe('buildHexGeometry', () => {
  it('produces a center + 6 corners (7 vertices) and 6 triangles', () => {
    const geometry = buildHexGeometry(cell, hex, sheetWidth, sheetHeight);
    const positions = geometry.getAttribute('position');
    expect(positions.count).toBe(7); // center + 6 corners
    expect(geometry.getIndex()?.count).toBe(18); // 6 triangles * 3
  });

  it('places the center vertex at the origin and lies in the XZ plane (Y=0)', () => {
    const geometry = buildHexGeometry(cell, hex, sheetWidth, sheetHeight);
    const pos = geometry.getAttribute('position');
    expect([pos.getX(0), pos.getY(0), pos.getZ(0)]).toEqual([0, 0, 0]);
    // Every vertex sits on the Y=0 plane.
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getY(i)).toBe(0);
    }
  });

  it('sizes corners to half the hex dims', () => {
    const geometry = buildHexGeometry(cell, { width: 4, height: 6 }, sheetWidth, sheetHeight);
    const pos = geometry.getAttribute('position');
    let maxX = 0;
    let maxZ = 0;
    for (let i = 1; i < pos.count; i++) {
      maxX = Math.max(maxX, Math.abs(pos.getX(i)));
      maxZ = Math.max(maxZ, Math.abs(pos.getZ(i)));
    }
    // Pointy-top corners sit at 30°,90°,150°,… so the X extent peaks at
    // halfW·cos30° and the Z extent reaches the full halfH (a corner at 90°).
    expect(maxX).toBeCloseTo(2 * Math.cos(Math.PI / 6)); // halfW(=2) · √3/2
    expect(maxZ).toBeCloseTo(3); // halfH = 6/2, corner at 90°
  });

  it('maps the center UV to the cell rect center (V flipped for image rows)', () => {
    const geometry = buildHexGeometry(cell, hex, sheetWidth, sheetHeight);
    const uv = geometry.getAttribute('uv');
    // cell x=96..192 of 480 → u 0.2..0.4 → center 0.3
    expect(uv.getX(0)).toBeCloseTo(0.3);
    // cell y=83..166 of 830 → v flipped: (1 - 166/830)..(1 - 83/830) = 0.8..0.9 → 0.85
    expect(uv.getY(0)).toBeCloseTo(0.85);
  });

  it('keeps all corner UVs inside the cell rect bounds', () => {
    const geometry = buildHexGeometry(cell, hex, sheetWidth, sheetHeight);
    const uv = geometry.getAttribute('uv');
    const u0 = 96 / 480;
    const u1 = 192 / 480;
    const v0 = 1 - 166 / 830;
    const v1 = 1 - 83 / 830;
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(u0 - 1e-6);
      expect(uv.getX(i)).toBeLessThanOrEqual(u1 + 1e-6);
      expect(uv.getY(i)).toBeGreaterThanOrEqual(v0 - 1e-6);
      expect(uv.getY(i)).toBeLessThanOrEqual(v1 + 1e-6);
    }
  });

  it('pointy-top has a corner near the +Z axis; flat-top has one on the +X axis', () => {
    const pointy = buildHexGeometry(cell, hex, sheetWidth, sheetHeight, 'pointy');
    const flat = buildHexGeometry(cell, hex, sheetWidth, sheetHeight, 'flat');
    const pointyPos = pointy.getAttribute('position');
    const flatPos = flat.getAttribute('position');
    // pointy: first corner at 30°, so a later corner lands at 90° (pure +Z).
    let hasPurePosZ = false;
    for (let i = 1; i < pointyPos.count; i++) {
      if (Math.abs(pointyPos.getX(i)) < 1e-6 && pointyPos.getZ(i) > 0) hasPurePosZ = true;
    }
    expect(hasPurePosZ).toBe(true);
    // flat: first corner at 0° (pure +X).
    expect(flatPos.getX(1)).toBeCloseTo(hex.width / 2);
    expect(flatPos.getZ(1)).toBeCloseTo(0);
  });

  it('computes vertex normals', () => {
    const geometry = buildHexGeometry(cell, hex, sheetWidth, sheetHeight);
    expect(geometry.getAttribute('normal')).toBeDefined();
  });
});

describe('buildTexturedHexMesh', () => {
  it('builds a Mesh with a MeshBasicMaterial sampling the sheet texture', () => {
    const s = sheet();
    const mesh = buildTexturedHexMesh({ sheet: s, cell, hex });
    expect(mesh).toBeInstanceOf(Mesh);
    expect(mesh.geometry).toBeInstanceOf(BufferGeometry);
    expect(mesh.material).toBeInstanceOf(MeshBasicMaterial);
    const material = mesh.material as MeshBasicMaterial;
    expect(material.map).toBe(s.texture);
    expect(material.transparent).toBe(true);
    expect(material.side).toBe(DoubleSide);
  });

  it('respects doubleSide:false (single-sided material)', () => {
    const mesh = buildTexturedHexMesh({ sheet: sheet(), cell, hex, doubleSide: false });
    const material = mesh.material as MeshBasicMaterial;
    expect(material.side).not.toBe(DoubleSide);
  });

  it('honors an explicit flat orientation', () => {
    const mesh = buildTexturedHexMesh({ sheet: sheet(), cell, hex, orientation: 'flat' });
    const pos = mesh.geometry.getAttribute('position');
    expect(pos.getX(1)).toBeCloseTo(hex.width / 2);
    expect(pos.getZ(1)).toBeCloseTo(0);
  });
});
