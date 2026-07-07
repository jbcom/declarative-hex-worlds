import { Group, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { AccessoryAttachment } from '../../accessories';
import { attachAccessoryToModel, detachAccessory } from '../accessories';

/** A character root with a named `Head` bone nested under a rig. */
function character(): { root: Object3D; head: Object3D } {
  const root = new Group();
  const rig = new Group();
  rig.name = 'Rig';
  const head = new Object3D();
  head.name = 'Head';
  rig.add(head);
  root.add(rig);
  return { root, head };
}

const helmet: AccessoryAttachment = {
  id: 'helm',
  assetId: 'helmet_A',
  node: 'Head',
  transform: { position: { y: 0.3 }, scale: 1.2 },
};

describe('three accessory attachment (RFC0-ACC binding)', () => {
  it('parents the accessory to the named bone + applies the local transform', () => {
    const { root, head } = character();
    const accessory = new Object3D();
    const result = attachAccessoryToModel(root, helmet, accessory);
    expect(result.attached).toBe(true);
    expect(result.node).toBe(head);
    expect(accessory.parent).toBe(head);
    expect(accessory.position.y).toBeCloseTo(0.3);
    expect(accessory.scale.x).toBeCloseTo(1.2);
  });

  it('reports a miss (no parenting) when the target node is absent', () => {
    const { root } = character();
    const accessory = new Object3D();
    const result = attachAccessoryToModel(root, { ...helmet, node: 'Tail' }, accessory);
    expect(result.attached).toBe(false);
    expect(result.node).toBeUndefined();
    expect(accessory.parent).toBeNull();
  });

  it('detaches a previously-attached accessory', () => {
    const { root, head } = character();
    const accessory = new Object3D();
    attachAccessoryToModel(root, helmet, accessory);
    expect(accessory.parent).toBe(head);
    detachAccessory(accessory);
    expect(accessory.parent).toBeNull();
  });
});
