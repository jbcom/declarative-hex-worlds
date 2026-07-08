/**
 * `src/classifiers/classifiers.ts` — first-class gameplay CLASSIFIER tags for
 * placements (RFC 0001 RFC0-TAG).
 *
 * Distinct from `GameboardPlacementKind` (a RENDER/structural kind — terrain, road,
 * unit, prop). A classifier is a GAMEPLAY semantic — is this piece playable, an enemy, a
 * building, a random encounter? A placement can carry several. Classifiers are assigned
 * by pure `PlacementClassifier`s (from a placement's kind / assetId / metadata), stored
 * as tags on the placement, and queried via koota (`selectPlacementsByClassifier`) or the
 * `usePlacementsByClassifier` react hook. This module is renderer-free.
 *
 * @module
 */
import type { GameboardPlacementSpec } from '../gameboard';

/** The first-class classifier vocabulary. Consumers may also use custom string tags. */
export const CLASSIFIER_TAGS = [
  'playable',
  'non-playable',
  'enemy',
  'random-encounter',
  'unit',
  'building',
  'prop',
] as const;

/** A known gameplay classifier. Custom classifiers are plain strings (see ClassifierTag). */
export type KnownClassifierTag = (typeof CLASSIFIER_TAGS)[number];

/** A classifier tag — a known one or an app-specific custom string. */
export type ClassifierTag = KnownClassifierTag | (string & {});

/** The `<classifier>:` prefix under which classifier tags live in a placement's tag list. */
export const CLASSIFIER_TAG_PREFIX = 'classifier:';

/**
 * A pure function that assigns zero or more classifier tags to a placement. Classifiers
 * compose: every registered classifier runs, and their tags are unioned. A classifier
 * inspects the placement's kind / assetId / metadata and returns the classifiers it
 * recognizes (or none).
 */
export type PlacementClassifier = (placement: GameboardPlacementSpec) => readonly ClassifierTag[];

/**
 * The default classifiers — a renderer/pack-agnostic baseline derived from the
 * placement's structural KIND. Recognized-pack classifiers (Adventurers → playable,
 * Skeletons → enemy/random-encounter) layer ON TOP of these via {@link packClassifier}
 * (RFC0-TAGb); a consumer composes `[...DEFAULT_PLACEMENT_CLASSIFIERS, ...packClassifiers()]`.
 */
export const DEFAULT_PLACEMENT_CLASSIFIERS: readonly PlacementClassifier[] = [
  (placement) => {
    switch (placement.kind) {
      case 'unit':
        return ['unit'];
      case 'structure':
        return ['building'];
      case 'prop':
      case 'decoration':
        return ['prop'];
      default:
        return [];
    }
  },
];

/**
 * A recognized pack's GAMEPLAY category, as published by the pack registry
 * (`terrain` | `playable` | `enemy`). Passed in as a plain value so this core
 * module never imports the CLI-domain registry — a consumer threads
 * `packDescriptor(id).category` through {@link packClassifier}.
 */
export type PackClassifierCategory = 'terrain' | 'playable' | 'enemy';

/**
 * The default classifier tags a recognized pack's CATEGORY contributes (RFC0-TAGb).
 * `playable` characters are playable units; `enemy` characters are both enemies and
 * eligible random encounters; `terrain` packs contribute no gameplay classifier
 * (their pieces are classified by structural kind alone). This is the pack→classifier
 * mapping the RFC0-TAG doc reserved ("Adventures → playable, Skeletons → enemy").
 */
export function packDefaultClassifiers(
  category: PackClassifierCategory
): readonly KnownClassifierTag[] {
  switch (category) {
    case 'playable':
      return ['playable'];
    case 'enemy':
      return ['enemy', 'random-encounter'];
    default:
      return [];
  }
}

/**
 * The metadata key under which a placement records the id of the pack it was
 * sourced from. {@link packClassifier} reads this (or an `assetId` prefix) to
 * decide whether a placement belongs to a recognized pack.
 */
export const SOURCE_PACK_METADATA_KEY = 'sourcePack';

/**
 * Build a {@link PlacementClassifier} for a recognized pack (RFC0-TAGb). A placement
 * belongs to the pack when EITHER its `sourcePack` metadata equals `packId` OR its
 * `assetId` is namespaced under `<packId>:` (the `adventurer:knight` convention).
 * Matching placements receive the pack category's default classifiers
 * ({@link packDefaultClassifiers}); everything else gets none, so pack classifiers
 * compose cleanly on top of the kind-based {@link DEFAULT_PLACEMENT_CLASSIFIERS}.
 *
 * @param packId - The registered pack id (e.g. `adventurers`, `skeletons`).
 * @param category - The pack's registry category (thread `packDescriptor(id).category`).
 * @param assetIdPrefix - Optional `assetId` namespace to also match (defaults to `packId`).
 */
export function packClassifier(
  packId: string,
  category: PackClassifierCategory,
  assetIdPrefix: string = packId
): PlacementClassifier {
  const tags = packDefaultClassifiers(category);
  const prefix = `${assetIdPrefix}:`;
  return (placement) => {
    if (tags.length === 0) {
      return [];
    }
    const sourcePack = placement.metadata?.[SOURCE_PACK_METADATA_KEY];
    if (sourcePack === packId) {
      return tags;
    }
    const assetId = (placement as { assetId?: unknown }).assetId;
    if (typeof assetId === 'string' && assetId.startsWith(prefix)) {
      return tags;
    }
    return [];
  };
}

/** Union of the classifier tags every classifier assigns to a placement (order-stable, deduped). */
export function classifyPlacement(
  placement: GameboardPlacementSpec,
  classifiers: readonly PlacementClassifier[] = DEFAULT_PLACEMENT_CLASSIFIERS
): readonly ClassifierTag[] {
  const seen = new Set<ClassifierTag>();
  const result: ClassifierTag[] = [];
  for (const classifier of classifiers) {
    for (const tag of classifier(placement)) {
      if (!seen.has(tag)) {
        seen.add(tag);
        result.push(tag);
      }
    }
  }
  return result;
}

/**
 * The metadata KEY a classifier is stored under on a placement. Placement metadata
 * values are `string | number | boolean | null`, so each classifier is a boolean flag
 * (`classifier:enemy` → true) rather than an array — this keeps classifiers queryable
 * through the placement metadata that survives projection into the koota world.
 */
export function classifierMetadataKey(tag: ClassifierTag): string {
  return `${CLASSIFIER_TAG_PREFIX}${tag}`;
}

/** A metadata patch that flags the given classifiers on a placement (all `true`). */
export function classifierMetadata(
  tags: readonly ClassifierTag[]
): Record<string, boolean> {
  const patch: Record<string, boolean> = {};
  for (const tag of tags) {
    patch[classifierMetadataKey(tag)] = true;
  }
  return patch;
}

/** The classifier tags flagged in a placement's metadata (keys prefixed + truthy). */
export function classifierTagsOf(
  metadata: Readonly<Record<string, string | number | boolean | null>>
): readonly ClassifierTag[] {
  const result: ClassifierTag[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (value && key.startsWith(CLASSIFIER_TAG_PREFIX)) {
      result.push(key.slice(CLASSIFIER_TAG_PREFIX.length));
    }
  }
  return result;
}

/** True if a placement's metadata flags the given classifier. */
export function placementHasClassifier(
  metadata: Readonly<Record<string, string | number | boolean | null>>,
  tag: ClassifierTag
): boolean {
  return Boolean(metadata[classifierMetadataKey(tag)]);
}
