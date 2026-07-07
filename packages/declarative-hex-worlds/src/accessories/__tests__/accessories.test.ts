import { describe, expect, it } from 'vitest';
import {
  type AccessoryAttachment,
  resolveAccessoryTransform,
  validateAccessoryAttachments,
} from '../accessories';

describe('accessory attachment specs (RFC0-ACC)', () => {
  describe('resolveAccessoryTransform', () => {
    it('defaults every field', () => {
      expect(resolveAccessoryTransform()).toEqual({
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
      });
    });

    it('fills partial fields, keeping supplied ones', () => {
      const resolved = resolveAccessoryTransform({ position: { y: 0.5 }, scale: 2 });
      expect(resolved.position).toEqual({ x: 0, y: 0.5, z: 0 });
      expect(resolved.scale).toBe(2);
    });
  });

  describe('validateAccessoryAttachments', () => {
    const ok: AccessoryAttachment = { id: 'helm', assetId: 'helmet_A', node: 'Head' };

    it('accepts well-formed attachments', () => {
      expect(validateAccessoryAttachments([ok])).toEqual([]);
    });

    it('flags a missing id, assetId, and node', () => {
      const problems = validateAccessoryAttachments([
        { id: '', assetId: '', node: '' } as AccessoryAttachment,
      ]);
      expect(problems.some((p) => /missing an id/.test(p))).toBe(true);
      expect(problems.some((p) => /missing an assetId/.test(p))).toBe(true);
      expect(problems.some((p) => /missing a target node/.test(p))).toBe(true);
    });

    it('flags duplicate ids', () => {
      const problems = validateAccessoryAttachments([
        ok,
        { id: 'helm', assetId: 'shield_A', node: 'HandL' },
      ]);
      expect(problems.some((p) => /duplicate accessory attachment id: helm/.test(p))).toBe(true);
    });
  });
});
