/**
 * Shared types for the SimpleRPG guide public API exercise and smoke modules.
 *
 * @module
 */

/** How the SimpleRPG fixture proves a guide-facing public API. */
export type SimpleRpgGuidePublicApiExerciseMode =
  | 'fixed-gameplay'
  | 'seeded-generation'
  | 'packaged-scenario'
  | 'executable-smoke'
  | 'blueprint-recipe'
  | 'manifest-package'
  | 'compatibility-adapter'
  | 'package-boundary'
  | 'visual-coverage';

/** One guide-facing API surface and the SimpleRPG evidence that exercises it. */
export interface SimpleRpgGuidePublicApiExercise {
  /** Public API surface from `listKayKitGuidePublicApiCoverages()`. */
  readonly publicApi: string;
  /** Primary integration mode that covers the API. */
  readonly mode: SimpleRpgGuidePublicApiExerciseMode;
  /** All integration modes that cover the API, including the primary mode. */
  readonly modes: readonly SimpleRpgGuidePublicApiExerciseMode[];
  /** Human-readable fixture, docs, or package evidence. */
  readonly evidence: string;
  /** One-based guide pages represented by the API coverage row. */
  readonly pages: readonly number[];
  /** Guide scenario ids represented by the API coverage row. */
  readonly scenarioIds: readonly string[];
  /** Unique asset count covered by the API row. */
  readonly assetCount: number;
  /** Visual artifacts linked by the guide scenarios that use the API. */
  readonly visualArtifacts: readonly string[];
}

/** Summary that fails closed when SimpleRPG stops accounting for guide APIs. */
export interface SimpleRpgGuidePublicApiExerciseCoverage {
  /** Number of guide-facing public APIs currently reported by the catalog. */
  readonly guidePublicApiCount: number;
  /** Number of current guide-facing APIs represented by SimpleRPG evidence. */
  readonly exercisedPublicApiCount: number;
  /** Current guide APIs that are not represented in SimpleRPG evidence. */
  readonly missingPublicApis: readonly string[];
  /** Evidence rows that no longer correspond to a current guide API. */
  readonly staleExercisePublicApis: readonly string[];
  /** Exercise counts by evidence mode; one API may contribute to multiple modes. */
  readonly exerciseModeCounts: Readonly<Record<SimpleRpgGuidePublicApiExerciseMode, number>>;
  /** Joined exercise rows with guide page and artifact metadata. */
  readonly exercises: readonly SimpleRpgGuidePublicApiExercise[];
}

/** Executable public helper smoke returned by the packaged SimpleRPG example. */
export interface SimpleRpgExecutableGuideApiSmokeSummary {
  /** Guide-facing public APIs directly invoked by this smoke helper. */
  readonly directPublicApis: readonly string[];
  /** Number of guide-facing public APIs directly invoked by this smoke helper. */
  readonly directPublicApiCount: number;
  /** Number of KayKit asset public treatment records listed from the catalog. */
  readonly publicTreatmentCount: number;
  /** Number of decomposed KayKit guide scenarios listed from the catalog. */
  readonly guideScenarioCount: number;
  /** One-based guide pages represented by the decomposed guide scenario catalog. */
  readonly guideScenarioPages: readonly number[];
  /** Number of assets in the FREE manifest bundle. */
  readonly manifestBundleAssetCount: number;
  /** Manifest asset ids selected by taxonomy/faction filters. */
  readonly selectedManifestAssetIds: readonly string[];
  /** Asset helper outputs used by SimpleRPG and downstream games. */
  readonly assetHelperIds: Readonly<{
    /** Faction-colored unit part id resolved from a unit part/faction/style tuple. */
    coloredUnit: string;
    /** Neutral unit or equipment asset id resolved from a neutral part. */
    neutralUnit: string;
    /** Faction-colored building id resolved from a building/faction tuple. */
    factionBuilding: string;
    /** Faction flag prop id resolved from a faction. */
    flag: string;
    /** Texture atlas filename resolved from a texture-set id. */
    textureFile: string;
  }>;
  /** Counts for guide permutation families exercised through selector helpers. */
  readonly guidePermutationCounts: Readonly<{
    /** Full road selector permutation count, including rotated masks. */
    roads: number;
    /** Full straight river selector permutation count, including waterless variants. */
    rivers: number;
    /** Full curvy river selector permutation count, including waterless variants. */
    curvyRivers: number;
    /** River crossing permutation count. */
    riverCrossings: number;
    /** Full coast selector permutation count, including waterless variants. */
    coasts: number;
  }>;
  /** Concrete selector asset ids returned by direct and label-based selectors. */
  readonly selectorAssetIds: readonly string[];
  /** Prop-cluster assets returned for a semantic resource cache. */
  readonly propClusterAssetIds: readonly string[];
  /** Number of raw deterministic spawn coordinates selected. */
  readonly rawSpawnCoordinateCount: number;
  /** Honeycomb hexagon-grid cell count. */
  readonly hexagonGridCellCount: number;
  /** Placement count for a plan rebuilt from explicit tiles. */
  readonly planFromTilesPlacementCount: number;
  /** Placement count for a plan compiled from a recipe. */
  readonly recipePlanPlacementCount: number;
  /** Recipe validation error count. */
  readonly recipeValidationErrorCount: number;
  /** Recipe generation validation error count. */
  readonly recipeGenerationErrorCount: number;
  /** Tile declaration count in the smoke registry. */
  readonly registryTileCount: number;
  /** Asset id normalized by the explicit tile declaration helper. */
  readonly declaredTileAssetId: string;
  /** Registry analysis warning count. */
  readonly registryWarningCount: number;
  /** Layout archetype ids created for custom placement recipes. */
  readonly layoutArchetypeIds: readonly string[];
  /** Fill rule id derived from a declared custom piece. */
  readonly layoutFillRuleId: string;
  /** Tile count in a generated seeded board. */
  readonly seededPlanTileCount: number;
  /** Tile count in a generated blueprint plan. */
  readonly blueprintPlanTileCount: number;
  /** Step count in a generated blueprint recipe. */
  readonly blueprintRecipeStepCount: number;
  /** Step count in the curated showcase blueprint recipe. */
  readonly showcaseRecipeStepCount: number;
  /** Feature count keys from blueprint inspection. */
  readonly blueprintInspectionFeatures: readonly string[];
  /** Suggested role for a non-hex external asset. */
  readonly externalSuggestedRole: string;
  /** Spawn kind for the external compatibility placement. */
  readonly externalSpawnKind: string;
  /** Rotation steps recommended for external actor facing. */
  readonly externalFacingRotationSteps: number;
}
