/**
 * `src/three/accessories.ts` — the three binding for accessory attachment (RFC0-ACC).
 *
 * Attaches an accessory Object3D to a named node/bone of a character model, applying the
 * accessory's local transform. The spec + validation are neutral (`../accessories`); this
 * is the three-side skeleton lookup + parenting.
 *
 * @module
 */
import type { Object3D } from 'three';
import {
  type AccessoryAttachment,
  resolveAccessoryTransform,
} from '../accessories';

/** Result of attaching an accessory — the node it parented to, or a miss. */
export interface AccessoryAttachmentResult {
  readonly id: string;
  /** True if the target node was found and the accessory parented to it. */
  readonly attached: boolean;
  /** The node the accessory attached to (undefined on a miss). */
  readonly node?: Object3D;
}

/**
 * Attach `accessoryObject` to the `attachment.node` bone/node of `characterRoot`, applying
 * the accessory's local transform. Returns whether the node was found. On a miss the
 * accessory is left un-parented and `attached` is false — the caller decides whether a
 * missing node is fatal (validate at author time via `validateAccessoryAttachments`).
 */
export function attachAccessoryToModel(
  characterRoot: Object3D,
  attachment: AccessoryAttachment,
  accessoryObject: Object3D
): AccessoryAttachmentResult {
  const node = characterRoot.getObjectByName(attachment.node);
  if (!node) {
    return { id: attachment.id, attached: false };
  }
  const transform = resolveAccessoryTransform(attachment.transform);
  accessoryObject.position.set(transform.position.x, transform.position.y, transform.position.z);
  accessoryObject.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
  accessoryObject.scale.setScalar(transform.scale);
  node.add(accessoryObject);
  return { id: attachment.id, attached: true, node };
}

/** Detach a previously-attached accessory from its parent node. */
export function detachAccessory(accessoryObject: Object3D): void {
  accessoryObject.parent?.remove(accessoryObject);
}
