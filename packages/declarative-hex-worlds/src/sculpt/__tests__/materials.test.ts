import { DoubleSide, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FINISHES } from '../build';
import { createSculptMaterials } from '../materials';

describe('createSculptMaterials', () => {
  it('makes one material for each default finish, all reading vertex colours', () => {
    const materials = createSculptMaterials();
    expect(Object.keys(materials).sort()).toEqual(Object.keys(DEFAULT_FINISHES).sort());
    for (const material of Object.values(materials)) {
      expect((material as MeshStandardMaterial).vertexColors).toBe(true);
    }
  });

  it('draws matte rough and non-metallic, and metal glossy and metallic', () => {
    const { matte, metal } = createSculptMaterials();
    expect(matte).toBeInstanceOf(MeshStandardMaterial);
    expect((matte as MeshStandardMaterial).roughness).toBeGreaterThan(0.8);
    expect((matte as MeshStandardMaterial).metalness).toBe(0);
    expect((metal as MeshStandardMaterial).metalness).toBeGreaterThan(0.5);
    expect((metal as MeshStandardMaterial).roughness).toBeLessThan(0.6);
  });

  it('draws glow unlit and outside tone mapping, so its baked gain can bloom', () => {
    const { glow } = createSculptMaterials();
    expect(glow).toBeInstanceOf(MeshBasicMaterial);
    expect(glow.toneMapped).toBe(false);
  });

  it('draws veil as a faint two-sided film that writes no depth, in a single pass', () => {
    const { veil } = createSculptMaterials();
    expect(veil.transparent).toBe(true);
    expect(veil.opacity).toBeLessThan(0.5);
    expect(veil.side).toBe(DoubleSide);
    expect(veil.depthWrite).toBe(false);
    expect(veil.forceSinglePass).toBe(true);
  });

  it('makes fresh materials on every call, so each owner disposes its own', () => {
    const a = createSculptMaterials();
    const b = createSculptMaterials();
    expect(a.matte).not.toBe(b.matte);
  });
});
