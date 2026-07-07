import { describe, expect, it } from 'vitest';
import {
  isPackId,
  listPackDescriptors,
  PACK_IDS,
  PACK_REGISTRY,
  packArchiveUrl,
  packDescriptor,
  packDescriptorSchema,
} from '../registry';

describe('downloadable-pack registry (RFC0-10)', () => {
  it('registers the three first-class CC0 packs with valid descriptors', () => {
    expect(PACK_IDS).toEqual(['medieval-hexagon', 'adventurers', 'skeletons']);
    for (const id of PACK_IDS) {
      const descriptor = PACK_REGISTRY[id];
      expect(descriptor.id).toBe(id);
      // Every descriptor passes its own schema.
      expect(packDescriptorSchema.safeParse(descriptor).success).toBe(true);
    }
  });

  it('maps each pack to the right role + gameplay category (a full game from defaults)', () => {
    expect(PACK_REGISTRY['medieval-hexagon']).toMatchObject({ role: 'tile', category: 'terrain' });
    expect(PACK_REGISTRY.adventurers).toMatchObject({ role: 'model', category: 'playable' });
    expect(PACK_REGISTRY.skeletons).toMatchObject({ role: 'model', category: 'enemy' });
  });

  it('points every pack at a KayKit-Game-Assets GitHub repo on main', () => {
    for (const descriptor of listPackDescriptors()) {
      expect(descriptor.github.owner).toBe('KayKit-Game-Assets');
      expect(descriptor.github.defaultRef).toBe('main');
      expect(descriptor.github.repo).toMatch(/^KayKit-/);
      expect(descriptor.attribution).toContain('CC0');
    }
  });

  describe('isPackId', () => {
    it('recognizes registered ids and rejects others', () => {
      expect(isPackId('adventurers')).toBe(true);
      expect(isPackId('nope')).toBe(false);
      expect(isPackId('')).toBe(false);
    });

    it('rejects Object.prototype member names (proto-safe lookup)', () => {
      expect(isPackId('constructor')).toBe(false);
      expect(isPackId('toString')).toBe(false);
    });
  });

  describe('packDescriptor', () => {
    it('returns the descriptor for a valid id', () => {
      expect(packDescriptor('skeletons').displayName).toContain('Skeletons');
    });

    it('throws a clear error listing valid ids for an unknown pack', () => {
      expect(() => packDescriptor('unknown')).toThrow(/Unknown pack "unknown"/);
      expect(() => packDescriptor('constructor')).toThrow(/Valid packs:/);
    });
  });

  describe('packArchiveUrl', () => {
    it('fills the template with owner/repo and the default ref', () => {
      expect(packArchiveUrl(PACK_REGISTRY['medieval-hexagon'])).toBe(
        'https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0/archive/refs/heads/main.zip'
      );
    });

    it('honors an explicit ref override', () => {
      expect(packArchiveUrl(PACK_REGISTRY.adventurers, 'v1.0')).toBe(
        'https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/archive/refs/heads/v1.0.zip'
      );
    });
  });
});
