/**
 * `src/accessories/accessories.ts` — accessory attachment specs (RFC 0001 RFC0-ACC).
 *
 * The neutral data model for attaching an accessory (helmet, weapon, shield) to a named
 * node/bone of a character model — the composition primitive for the Adventures pack. A
 * spec says WHICH accessory attaches to WHICH bone with what local transform; the three
 * binding (`../three`) does the actual skeleton bone lookup + parenting. This module is
 * renderer-free.
 *
 * @module
 */
import type { WorldPosition } from '../types';

/** A local transform applied to an accessory relative to its attachment node. */
export interface AccessoryLocalTransform {
  /** Local position offset from the node origin (default 0,0,0). */
  readonly position?: Partial<WorldPosition>;
  /** Local Euler rotation in radians (default 0,0,0). */
  readonly rotation?: Partial<WorldPosition>;
  /** Local uniform scale (default 1). */
  readonly scale?: number;
}

/** An accessory attached to a character model at a named node/bone. */
export interface AccessoryAttachment {
  /** Stable id for this attachment (for diffing/removal). */
  readonly id: string;
  /** Asset id of the accessory model (resolved through the normal asset source). */
  readonly assetId: string;
  /**
   * Name of the target node/bone in the character's skeleton (e.g. `Head`,
   * `HandR`). The three binding looks this up via `getObjectByName`.
   */
  readonly node: string;
  /** Local transform relative to the attachment node. */
  readonly transform?: AccessoryLocalTransform;
}

/** A resolved accessory local transform with every field defaulted. */
export interface ResolvedAccessoryTransform {
  readonly position: WorldPosition;
  readonly rotation: WorldPosition;
  readonly scale: number;
}

/** Fill in the defaults of an accessory local transform. */
export function resolveAccessoryTransform(
  transform: AccessoryLocalTransform = {}
): ResolvedAccessoryTransform {
  return {
    position: {
      x: transform.position?.x ?? 0,
      y: transform.position?.y ?? 0,
      z: transform.position?.z ?? 0,
    },
    rotation: {
      x: transform.rotation?.x ?? 0,
      y: transform.rotation?.y ?? 0,
      z: transform.rotation?.z ?? 0,
    },
    scale: transform.scale ?? 1,
  };
}

/**
 * Validate a set of accessory attachments: ids unique, node + assetId non-empty. Returns
 * the list of problems (empty = valid) so callers can fail at author time rather than
 * silently drop a mis-specified accessory during rendering.
 */
export function validateAccessoryAttachments(
  attachments: readonly AccessoryAttachment[]
): readonly string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const attachment of attachments) {
    if (!attachment.id) {
      problems.push('accessory attachment is missing an id');
    } else if (seen.has(attachment.id)) {
      problems.push(`duplicate accessory attachment id: ${attachment.id}`);
    } else {
      seen.add(attachment.id);
    }
    if (!attachment.assetId) {
      problems.push(`accessory ${attachment.id || '<no-id>'} is missing an assetId`);
    }
    if (!attachment.node) {
      problems.push(`accessory ${attachment.id || '<no-id>'} is missing a target node`);
    }
  }
  return problems;
}
