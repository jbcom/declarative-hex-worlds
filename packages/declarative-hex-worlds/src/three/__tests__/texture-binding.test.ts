import { Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { TextureBinding } from '../../texture-binding';
import { applyTextureBinding } from '../texture-binding';

/** A model with two named meshes, each a MeshStandardMaterial. */
function model(): Group {
  const root = new Group();
  const body = new Mesh(undefined, new MeshStandardMaterial());
  body.name = 'Body';
  const cape = new Mesh(undefined, new MeshStandardMaterial());
  cape.name = 'Cape';
  root.add(body, cape);
  return root;
}

const texture = new Texture();
const normal = new Texture();

describe('three texture binding (RFC0-TEX binding)', () => {
  it('applies the base-color map to every material when the binding has no targets', () => {
    const root = model();
    const binding: TextureBinding = { assetId: 'Knight', textureUrl: '/k.png' };
    const result = applyTextureBinding(root, binding, texture);
    expect(result.materialsUpdated).toBe(2);
    root.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.material) {
        expect((mesh.material as MeshStandardMaterial).map).toBe(texture);
      }
    });
  });

  it('scopes the texture to the targeted meshes only', () => {
    const root = model();
    const binding: TextureBinding = { assetId: 'Knight', textureUrl: '/k.png', targets: ['Body'] };
    const result = applyTextureBinding(root, binding, texture);
    expect(result.materialsUpdated).toBe(1);
    const body = root.getObjectByName('Body') as Mesh;
    const cape = root.getObjectByName('Cape') as Mesh;
    expect((body.material as MeshStandardMaterial).map).toBe(texture);
    expect((cape.material as MeshStandardMaterial).map).toBeNull();
  });

  it('assigns the normal map alongside the base color when given', () => {
    const root = model();
    const binding: TextureBinding = { assetId: 'Knight', textureUrl: '/k.png', normalUrl: '/n.png' };
    applyTextureBinding(root, binding, texture, normal);
    const body = root.getObjectByName('Body') as Mesh;
    expect((body.material as MeshStandardMaterial).normalMap).toBe(normal);
  });

  it('handles an array-material mesh (multi-material)', () => {
    const root = new Group();
    const multi = new Mesh(undefined, [new MeshStandardMaterial(), new MeshStandardMaterial()]);
    multi.name = 'Multi';
    root.add(multi);
    const result = applyTextureBinding(root, { assetId: 'X', textureUrl: '/x.png' }, texture);
    expect(result.materialsUpdated).toBe(2);
  });
});
