/**
 * `src/classifiers/` — first-class gameplay classifier tags for placements
 * (RFC 0001 RFC0-TAG).
 *
 * The pure vocabulary + assignment (`./classifiers`) is koota-free; the world queries
 * (`./classifiers-runtime`) are koota-backed. Surfaced on the umbrella +
 * `declarative-hex-worlds/classifiers`.
 *
 * @module
 */
export {
  CLASSIFIER_TAGS,
  CLASSIFIER_TAG_PREFIX,
  type ClassifierTag,
  type KnownClassifierTag,
  type PackClassifierCategory,
  type PlacementClassifier,
  DEFAULT_PLACEMENT_CLASSIFIERS,
  SOURCE_PACK_METADATA_KEY,
  classifierMetadata,
  classifierMetadataKey,
  classifierTagsOf,
  classifyPlacement,
  packClassifier,
  packDefaultClassifiers,
  placementHasClassifier,
} from './classifiers';
export {
  listClassifiersInWorld,
  selectPlacementsByClassifier,
} from './classifiers-runtime';
