/**
 * `src/cli/commands/bootstrap/registry.ts` — the downloadable-pack registry
 * (RFC 0001 RFC0-10 / G4).
 *
 * The single FREE bootstrap (KayKit Medieval Hexagon) generalizes to a REGISTRY
 * of first-class CC0 packs a consumer can fetch on demand: Medieval Hexagon
 * (tiles), Adventurers (playable character models), Skeletons (enemy models) —
 * together a full game from defaults. Each descriptor names its upstream GitHub
 * source + how the pack maps into an asset source (role + gameplay category) +
 * its attribution. Packs are NEVER tracked in git; they materialize into a
 * gitignored `raw-assets/` root via the bootstrap download machinery in
 * `./core`, which this registry parameterizes.
 *
 * The registry is a Zod-validated data table (no runtime side effects); the
 * download/fetch itself lives in `./core` and is invoked per descriptor.
 *
 * @module
 */
import { z } from 'zod';

/** A stable pack identifier used by the CLI (`bootstrap --pack <id>`) and resolution. */
export const PACK_IDS = ['medieval-hexagon', 'adventurers', 'skeletons'] as const;
/** One of the recognized downloadable pack ids. */
export type PackId = (typeof PACK_IDS)[number];

/** How a pack's assets map into an AssetSource role. */
export const PACK_ROLES = ['tile', 'model'] as const;
/** Asset role a pack contributes (tiles vs models). */
export type PackRole = (typeof PACK_ROLES)[number];

/**
 * Gameplay category a pack fills — drives default source composition (terrain
 * board vs playable units vs enemies) so three packs compose into a full game.
 */
export const PACK_CATEGORIES = ['terrain', 'playable', 'enemy'] as const;
/** Gameplay category a pack fills. */
export type PackCategory = (typeof PACK_CATEGORIES)[number];

/** Upstream GitHub source for a pack's CC0 archive. */
export const packGithubSourceSchema = z.object({
  /** GitHub owner/org. */
  owner: z.string().min(1),
  /** Repository name. */
  repo: z.string().min(1),
  /** Default git ref fetched when none is supplied. */
  defaultRef: z.string().min(1),
  /**
   * Archive-URL template with `{owner}`/`{repo}`/`{ref}` placeholders. Kept per
   * descriptor (not global) so a pack hosted differently can override it.
   */
  archiveUrlTemplate: z.string().min(1),
});
/** Upstream GitHub source descriptor. */
export type PackGithubSource = z.infer<typeof packGithubSourceSchema>;

/** A single downloadable-pack descriptor. */
export const packDescriptorSchema = z.object({
  /** Stable pack id. */
  id: z.enum(PACK_IDS),
  /** Human-facing name for CLI listings + docs. */
  displayName: z.string().min(1),
  /** Asset role the pack contributes. */
  role: z.enum(PACK_ROLES),
  /** Gameplay category the pack fills. */
  category: z.enum(PACK_CATEGORIES),
  /** Upstream `addons/<packFolder>/` directory name the pack publishes under. */
  packFolder: z.string().min(1),
  /** Upstream GitHub source. */
  github: packGithubSourceSchema,
  /** Attribution string (CC0 — no attribution required, but credited by courtesy). */
  attribution: z.string().min(1),
});
/** A downloadable-pack descriptor. */
export type PackDescriptor = z.infer<typeof packDescriptorSchema>;

const KAYKIT_ARCHIVE_TEMPLATE = 'https://github.com/{owner}/{repo}/archive/refs/heads/{ref}.zip';
const KAYKIT_ATTRIBUTION = 'KayKit by Kay Lousberg (kaylousberg.com) — CC0 1.0';

/**
 * The three first-class downloadable CC0 packs. Together they are a full game
 * from defaults: a hex tile board, playable characters, and enemies. GitHub
 * reports these repos as NOASSERTION (no machine-readable LICENSE), but KayKit's
 * itch.io pages license the packs CC0; the attribution is a courtesy credit.
 */
export const PACK_REGISTRY: Readonly<Record<PackId, PackDescriptor>> = {
  'medieval-hexagon': {
    id: 'medieval-hexagon',
    displayName: 'KayKit Medieval Hexagon Pack',
    role: 'tile',
    category: 'terrain',
    packFolder: 'kaykit_medieval_hexagon_pack',
    github: {
      owner: 'KayKit-Game-Assets',
      repo: 'KayKit-Medieval-Hexagon-Pack-1.0',
      defaultRef: 'main',
      archiveUrlTemplate: KAYKIT_ARCHIVE_TEMPLATE,
    },
    attribution: KAYKIT_ATTRIBUTION,
  },
  adventurers: {
    id: 'adventurers',
    displayName: 'KayKit Character Pack: Adventurers',
    role: 'model',
    category: 'playable',
    packFolder: 'kaykit_character_pack_adventures',
    github: {
      owner: 'KayKit-Game-Assets',
      repo: 'KayKit-Character-Pack-Adventures-1.0',
      defaultRef: 'main',
      archiveUrlTemplate: KAYKIT_ARCHIVE_TEMPLATE,
    },
    attribution: KAYKIT_ATTRIBUTION,
  },
  skeletons: {
    id: 'skeletons',
    displayName: 'KayKit Character Pack: Skeletons',
    role: 'model',
    category: 'enemy',
    packFolder: 'kaykit_character_pack_skeletons',
    github: {
      owner: 'KayKit-Game-Assets',
      repo: 'KayKit-Character-Pack-Skeletons-1.0',
      defaultRef: 'main',
      archiveUrlTemplate: KAYKIT_ARCHIVE_TEMPLATE,
    },
    attribution: KAYKIT_ATTRIBUTION,
  },
};

/** True if `value` names a registered pack (proto-safe — used on external input). */
export function isPackId(value: string): value is PackId {
  return Object.hasOwn(PACK_REGISTRY, value);
}

/**
 * Look up a pack descriptor by id, or throw a clear error listing the valid ids.
 * Uses `Object.hasOwn` so an id equal to an `Object.prototype` member can't
 * return an inherited value.
 */
export function packDescriptor(id: string): PackDescriptor {
  if (!isPackId(id)) {
    throw new RangeError(`Unknown pack "${id}". Valid packs: ${PACK_IDS.join(', ')}.`);
  }
  return PACK_REGISTRY[id];
}

/** Every pack descriptor, in registry order. */
export function listPackDescriptors(): readonly PackDescriptor[] {
  return PACK_IDS.map((id) => PACK_REGISTRY[id]);
}

/** Format a pack's upstream archive URL for a given ref (or its default ref). */
export function packArchiveUrl(descriptor: PackDescriptor, ref?: string): string {
  return descriptor.github.archiveUrlTemplate
    .replace('{owner}', descriptor.github.owner)
    .replace('{repo}', descriptor.github.repo)
    .replace('{ref}', ref ?? descriptor.github.defaultRef);
}
