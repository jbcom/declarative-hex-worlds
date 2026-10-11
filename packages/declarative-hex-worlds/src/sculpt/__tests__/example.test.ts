/**
 * The worked example from the "Procedural props" feature page, run as written, so the docs cannot
 * drift from the API.
 */
import { Group, InstancedMesh, Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import {
  box,
  buildPiece,
  createSculptMaterials,
  cyl,
  lathe,
  part,
  rock,
  rope,
  sheet,
} from '../index';

const palette = {
  oak: '#7a5230',
  iron: '#3a3a40',
  brass: '#c9a24b',
  lamp: '#ffd28a',
  clay: '#b8693d',
  stone: '#8d8678',
  canvas: '#d8cfb4',
  rope: '#a08a60',
} as const;

function campPieces() {
  const lantern = [
    cyl(0.05, 0.06, 0.03, { at: [0, 0.015, 0], tone: 'iron' }),
    cyl(0.04, 0.045, 0.16, { at: [0, 0.11, 0], tone: 'lamp', finish: 'glow' }),
    cyl(0.02, 0.055, 0.04, { at: [0, 0.21, 0], tone: 'iron' }),
    box(0.01, 0.01, 0.1, { at: [0, 0.25, 0], tone: 'brass', finish: 'metal' }),
  ];
  const jar = lathe(
    [
      [0, 0],
      [0.09, 0.01],
      [0.14, 0.08],
      [0.16, 0.2],
      [0.08, 0.38],
      [0.09, 0.42],
      [0, 0.42],
    ],
    { tone: 'clay' }
  );
  const stone = rock(0.18, 7, { at: [0.5, 0.1, 0], tone: 'stone' });
  const flap = part(
    sheet([
      [
        [0, 0.6, 0],
        [0.5, 0.6, 0],
      ],
      [
        [0, 0, 0.4],
        [0.5, 0, 0.4],
      ],
    ]),
    { tone: 'canvas' }
  );
  const guy = rope([0, 2, 0], [1.5, 0, 1], { tone: 'rope' });
  return [...lantern, jar, stone, flap, guy];
}

describe('the documented camp piece', () => {
  it('builds one geometry per finish it uses', () => {
    const pieces = buildPiece(campPieces(), palette, { grounded: true });
    expect([...pieces.keys()].sort()).toEqual(['glow', 'matte', 'metal']);
  });

  it('draws every finish with the matching material, as one mesh each, and instances', () => {
    const pieces = buildPiece(campPieces(), palette, { grounded: true });
    const materials = createSculptMaterials();
    const group = new Group();
    for (const [finish, geometry] of pieces) {
      group.add(new Mesh(geometry, materials[finish as keyof typeof materials]));
    }
    expect(group.children).toHaveLength(3);
    const matte = pieces.get('matte');
    expect(matte).toBeDefined();
    if (matte) {
      expect(new InstancedMesh(matte, materials.matte, 5).count).toBe(5);
    }
  });

  it('builds identically on a second run', () => {
    const a = buildPiece(campPieces(), palette, { grounded: true }).get('matte');
    const b = buildPiece(campPieces(), palette, { grounded: true }).get('matte');
    expect(Array.from(a?.getAttribute('position').array ?? [])).toEqual(
      Array.from(b?.getAttribute('position').array ?? [])
    );
    expect(Array.from(a?.getAttribute('color').array ?? [])).toEqual(
      Array.from(b?.getAttribute('color').array ?? [])
    );
  });
});
