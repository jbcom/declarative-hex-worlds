import { describe, expect, it } from 'vitest';
import {
  type TextureBinding,
  bindingTargetsMesh,
  indexTextureBindings,
  validateTextureBindings,
} from '../texture-binding';

const knight: TextureBinding = { assetId: 'Knight', textureUrl: '/tex/knight.png' };
const scoped: TextureBinding = {
  assetId: 'Rogue',
  textureUrl: '/tex/rogue.png',
  targets: ['Body', 'Head'],
};

describe('texture→model bindings (RFC0-TEX)', () => {
  it('indexes bindings by assetId (grouping multiples)', () => {
    const index = indexTextureBindings([knight, scoped, { ...knight, textureUrl: '/tex/alt.png' }]);
    expect(index.get('Knight')?.length).toBe(2);
    expect(index.get('Rogue')?.length).toBe(1);
    expect(index.get('Missing')).toBeUndefined();
  });

  it('a binding with no targets matches every mesh; a scoped one matches only its targets', () => {
    expect(bindingTargetsMesh(knight, 'AnyMesh')).toBe(true);
    expect(bindingTargetsMesh(scoped, 'Body')).toBe(true);
    expect(bindingTargetsMesh(scoped, 'Cape')).toBe(false);
  });

  it('validates assetId + textureUrl at author time', () => {
    expect(validateTextureBindings([knight, scoped])).toEqual([]);
    const problems = validateTextureBindings([{ assetId: '', textureUrl: '' } as TextureBinding]);
    expect(problems.some((p) => /missing an assetId/.test(p))).toBe(true);
    expect(problems.some((p) => /missing a textureUrl/.test(p))).toBe(true);
  });

  it('names the assetId in a missing-textureUrl problem when it is present', () => {
    const problems = validateTextureBindings([
      { assetId: 'Knight', textureUrl: '' } as TextureBinding,
    ]);
    expect(problems.some((p) => /\(Knight\) is missing a textureUrl/.test(p))).toBe(true);
  });
});
