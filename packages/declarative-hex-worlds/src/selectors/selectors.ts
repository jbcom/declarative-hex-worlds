/**
 * Guide-derived road, river, coast, edge-mask, rotation, and permutation
 * selectors for matching KayKit tile variants to board connectivity.
 *
 * @module
 */
import { GameboardRuntimeError } from '../errors';
import type { HexEdgeIndex, HexEdgeInput, VariantSelection } from '../types';

/** Canonical guide asset variant before rotation and waterless/curvy modifiers. */
export interface CanonicalVariant {
  /** KayKit guide label, such as `A` or `crossing_A`. */
  label: string;
  /** Manifest asset id for the unrotated canonical variant. */
  assetId: string;
  /** Six-bit edge mask represented by the canonical orientation. */
  canonicalMask: number;
}

/** Guide permutation families that must be covered by visual tests. */
export type GuideTilePermutationKind =
  | 'road'
  | 'river'
  | 'river-curvy'
  | 'river-crossing'
  | 'coast';

/** One concrete guide-described tile variant, modifier, and rotation. */
export interface GuideTilePermutation {
  /** Stable id for screenshots and test parametrization. */
  id: string;
  /** Permutation family. */
  kind: GuideTilePermutationKind;
  /** Manifest variant family used by selectors. */
  family: VariantSelection['family'];
  /** KayKit guide label. */
  label: string;
  /** Concrete asset id to render for this permutation. */
  assetId: string;
  /** Edge mask after applying the permutation rotation. */
  inputMask: number;
  /** Edge mask in the canonical unrotated asset orientation. */
  canonicalMask: number;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps: number;
  /** Clockwise rotation in radians. */
  rotationRadians: number;
  /** Whether this permutation uses a waterless asset variant. */
  waterless: boolean;
  /** Whether this permutation uses the curvy river asset variant. */
  curvy: boolean;
}

/** Options for expanding guide tile permutation lists. */
export interface GuidePermutationOptions {
  /** Rotation steps to include; defaults to all six. */
  rotationSteps?: readonly number[];
  /** Whether to include waterless variants, water variants, or both. */
  waterless?: boolean | 'both';
}

/** Number of edges on every hex tile. */
export const HEX_EDGE_COUNT = 6;
/** Rotation in radians for one clockwise hex edge step. */
export const HEX_ROTATION_RADIANS = Math.PI / 3;
/** All valid clockwise 60-degree rotation steps. */
export const HEX_ROTATION_STEPS = [0, 1, 2, 3, 4, 5] as const;

/** Road variants from the KayKit guide with canonical edge masks. */
export const ROAD_VARIANTS = [
  variant('A', 'hex_road_A', [0, 3]),
  variant('B', 'hex_road_B', [0, 1]),
  variant('C', 'hex_road_C', [0, 2]),
  variant('D', 'hex_road_D', [0, 1, 2]),
  variant('E', 'hex_road_E', [0, 1, 3]),
  variant('F', 'hex_road_F', [0, 1, 4]),
  variant('G', 'hex_road_G', [0, 2, 3]),
  variant('H', 'hex_road_H', [0, 2, 4]),
  variant('I', 'hex_road_I', [0, 1, 2, 3]),
  variant('J', 'hex_road_J', [0, 1, 2, 4]),
  variant('K', 'hex_road_K', [0, 1, 3, 4]),
  variant('L', 'hex_road_L', [0, 1, 2, 3, 4]),
  variant('M', 'hex_road_M', [0]),
] as const satisfies readonly CanonicalVariant[];

/** River variants from the KayKit guide with canonical edge masks. */
export const RIVER_VARIANTS = [
  variant('A', 'hex_river_A', [0, 3]),
  variant('B', 'hex_river_B', [0, 1]),
  variant('C', 'hex_river_C', [0, 2]),
  variant('D', 'hex_river_D', [0, 1, 2]),
  variant('E', 'hex_river_E', [0, 1, 3]),
  variant('F', 'hex_river_F', [0, 1, 4]),
  variant('G', 'hex_river_G', [0, 2, 3]),
  variant('H', 'hex_river_H', [0, 2, 4]),
  variant('I', 'hex_river_I', [0, 1, 2, 3]),
  variant('J', 'hex_river_J', [0, 1, 2, 4]),
  variant('K', 'hex_river_K', [0, 1, 3, 4]),
  variant('L', 'hex_river_L', [0, 1, 2, 3, 4]),
] as const satisfies readonly CanonicalVariant[];

/** Coast variants from the KayKit guide with canonical water-edge masks. */
export const COAST_VARIANTS = [
  variant('A', 'hex_coast_A', [0]),
  variant('B', 'hex_coast_B', [0, 1]),
  variant('C', 'hex_coast_C', [0, 1, 2]),
  variant('D', 'hex_coast_D', [0, 1, 2, 3]),
  variant('E', 'hex_coast_E', [0, 1, 2, 3, 4]),
] as const satisfies readonly CanonicalVariant[];

/**
 * The transition families that resolve an edge mask to a rotated variant (RFC0-9b).
 * Any AssetSource can drive its `resolveEdge` off this table: it is the
 * renderer-neutral edge → variant seam. A tileset maps the chosen variant's
 * canonical mask to a sheet cell; a gltf-pack maps the variant's assetId to a
 * model URL and bakes the rotation into the transform.
 */
export const TRANSITION_VARIANTS = {
  road: ROAD_VARIANTS,
  river: RIVER_VARIANTS,
  coast: COAST_VARIANTS,
} as const satisfies Record<VariantSelection['family'], readonly CanonicalVariant[]>;

/** A transition family key (`'road' | 'river' | 'coast'`). */
export type TransitionFamily = keyof typeof TRANSITION_VARIANTS;

/**
 * True if `value` names a known transition family. Uses `Object.hasOwn` (not
 * `in`) so inherited `Object.prototype` keys (`constructor`, `toString`, …) don't
 * spuriously match — a `selectTransitionVariant`/`resolveEdge` miss must fall
 * through, and matching an inherited key would index the table with a non-array.
 */
export function isTransitionFamily(value: string): value is TransitionFamily {
  return Object.hasOwn(TRANSITION_VARIANTS, value);
}

/**
 * Select the variant covering `edges` for a transition `family`, or `undefined`
 * when the family is unknown or no variant covers the mask (a NON-throwing
 * counterpart to `selectVariant`, for the `AssetSource.resolveEdge` seam where a
 * miss must fall through rather than error). RFC0-9b.
 */
export function selectTransitionVariant(
  family: string,
  edges: HexEdgeInput
): VariantSelection | undefined {
  if (!isTransitionFamily(family)) {
    return undefined;
  }
  const mask = edgeMask(edges);
  const variants = TRANSITION_VARIANTS[family];
  for (const candidate of variants) {
    for (let rotationSteps = 0; rotationSteps < HEX_EDGE_COUNT; rotationSteps += 1) {
      if (rotateMask(candidate.canonicalMask, rotationSteps) === mask) {
        return {
          family,
          label: candidate.label,
          assetId: candidate.assetId,
          inputMask: mask,
          canonicalMask: candidate.canonicalMask,
          rotationSteps,
          rotationRadians: rotationSteps * HEX_ROTATION_RADIANS,
        };
      }
    }
  }
  return undefined;
}

/** Converts an edge, edge list, or bit mask into a normalized six-bit edge mask. */
export function edgeMask(edges: HexEdgeInput): number {
  if (typeof edges === 'number') {
    return edges & 0b111111;
  }
  let mask = 0;
  for (const edge of edges) {
    mask |= 1 << edge;
  }
  return mask & 0b111111;
}

/** Rotates a six-bit hex edge mask clockwise by the requested number of steps. */
export function rotateMask(mask: number, steps: number): number {
  const normalizedSteps = ((steps % HEX_EDGE_COUNT) + HEX_EDGE_COUNT) % HEX_EDGE_COUNT;
  let rotated = 0;
  for (let edge = 0; edge < HEX_EDGE_COUNT; edge += 1) {
    if ((mask & (1 << edge)) !== 0) {
      rotated |= 1 << ((edge + normalizedSteps) % HEX_EDGE_COUNT);
    }
  }
  return rotated;
}

/** Selects the road guide asset and rotation for an edge mask. */
export function selectRoadVariant(edges: HexEdgeInput): VariantSelection {
  return selectVariant('road', edgeMask(edges), ROAD_VARIANTS);
}

/** Selects an unrotated road guide asset by KayKit label. */
export function selectRoadVariantByLabel(label: string): VariantSelection {
  return selectVariantByLabel('road', label, ROAD_VARIANTS);
}

/** Selects the river guide asset and rotation for an edge mask. */
export function selectRiverVariant(
  edges: HexEdgeInput,
  options: { waterless?: boolean; curvy?: boolean } = {}
): VariantSelection {
  const selection = selectVariant('river', edgeMask(edges), RIVER_VARIANTS);
  if (options.curvy && selection.label === 'A') {
    return { ...selection, assetId: withWaterless('hex_river_A_curvy', options.waterless) };
  }
  return { ...selection, assetId: withWaterless(selection.assetId, options.waterless) };
}

/** Selects an unrotated river guide asset by KayKit label. */
export function selectRiverVariantByLabel(
  label: string,
  options: { waterless?: boolean; curvy?: boolean } = {}
): VariantSelection {
  const selection = selectVariantByLabel('river', label, RIVER_VARIANTS);
  if (options.curvy && selection.label === 'A') {
    return { ...selection, assetId: withWaterless('hex_river_A_curvy', options.waterless) };
  }
  return { ...selection, assetId: withWaterless(selection.assetId, options.waterless) };
}

/** Selects one of the river crossing guide variants. */
export function selectRiverCrossingVariant(
  label: 'A' | 'B',
  options: { waterless?: boolean } = {}
): VariantSelection {
  const assetId = withWaterless(`hex_river_crossing_${label}`, options.waterless);
  return {
    family: 'river',
    label: `crossing_${label}`,
    assetId,
    inputMask: 0b111111,
    canonicalMask: 0b111111,
    rotationSteps: 0,
    rotationRadians: 0,
  };
}

/** Selects the coast guide asset and rotation for water-facing edges. */
export function selectCoastVariant(
  waterEdges: HexEdgeInput,
  options: { waterless?: boolean } = {}
): VariantSelection {
  const selection = selectVariant('coast', edgeMask(waterEdges), COAST_VARIANTS);
  return { ...selection, assetId: withWaterless(selection.assetId, options.waterless) };
}

/**
 * True if `mask` is coverable by a coast tile — i.e. it is 0 (no coast) or a
 * rotation of some COAST_VARIANT canonical mask (a CONTIGUOUS run of 1-5 water
 * edges). Non-contiguous masks (e.g. `0b010101` from edges [0,2,4]) have no coast
 * tile: a single hex tile can only depict one unbroken coastline arc.
 */
export function isCoverableCoastMask(edges: HexEdgeInput): boolean {
  const mask = edgeMask(edges);
  if (mask === 0) {
    return true;
  }
  for (const candidate of COAST_VARIANTS) {
    for (let rotationSteps = 0; rotationSteps < HEX_EDGE_COUNT; rotationSteps += 1) {
      if (rotateMask(candidate.canonicalMask, rotationSteps) === mask) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Assert that `edges` form a coverable coast mask, throwing a clear author-time
 * error otherwise. Called by `GameboardBuilder.setCoastEdges` so a bad mask fails
 * at the authoring call — naming the tile + the offending mask — rather than deep
 * in projection with an opaque "no coast variant covers …" runtime error.
 */
export function assertCoverableCoastMask(
  edges: HexEdgeInput,
  context?: { tileKey?: string }
): void {
  if (isCoverableCoastMask(edges)) {
    return;
  }
  const mask = edgeMask(edges);
  const where = context?.tileKey ? ` on tile ${context.tileKey}` : '';
  throw new GameboardRuntimeError(
    `Coast edges${where} form a non-contiguous mask ${mask
      .toString(2)
      .padStart(HEX_EDGE_COUNT, '0')} — a hex coast tile can only depict ONE unbroken ` +
      'coastline arc (a contiguous run of 1-5 water edges). Split the water into separate ' +
      'tiles, or pass contiguous edges.'
  );
}

/** Selects an unrotated coast guide asset by KayKit label. */
export function selectCoastVariantByLabel(
  label: string,
  options: { waterless?: boolean } = {}
): VariantSelection {
  const selection = selectVariantByLabel('coast', label, COAST_VARIANTS);
  return { ...selection, assetId: withWaterless(selection.assetId, options.waterless) };
}

/** Lists every requested road guide variant/rotation permutation. */
export function listRoadGuidePermutations(
  options: Pick<GuidePermutationOptions, 'rotationSteps'> = {}
): GuideTilePermutation[] {
  return ROAD_VARIANTS.flatMap((variant) =>
    normalizedRotationSteps(options.rotationSteps).map((rotationSteps) =>
      guidePermutation({
        kind: 'road',
        family: 'road',
        variant,
        rotationSteps,
      })
    )
  );
}

/** Lists every requested river guide variant/rotation/waterless permutation. */
export function listRiverGuidePermutations(
  options: GuidePermutationOptions = {}
): GuideTilePermutation[] {
  return RIVER_VARIANTS.flatMap((variant) =>
    normalizedRotationSteps(options.rotationSteps).flatMap((rotationSteps) =>
      waterlessOptions(options.waterless).map((waterless) =>
        guidePermutation({
          kind: 'river',
          family: 'river',
          variant,
          rotationSteps,
          waterless,
        })
      )
    )
  );
}

/** Lists every requested curvy river guide rotation/waterless permutation. */
export function listRiverCurvyGuidePermutations(
  options: GuidePermutationOptions = {}
): GuideTilePermutation[] {
  const [variant] = RIVER_VARIANTS;
  return normalizedRotationSteps(options.rotationSteps).flatMap((rotationSteps) =>
    waterlessOptions(options.waterless).map((waterless) =>
      guidePermutation({
        kind: 'river-curvy',
        family: 'river',
        variant,
        rotationSteps,
        assetId: 'hex_river_A_curvy',
        waterless,
        curvy: true,
      })
    )
  );
}

/** Lists every requested river crossing guide waterless permutation. */
export function listRiverCrossingGuidePermutations(
  options: Pick<GuidePermutationOptions, 'waterless'> = {}
): GuideTilePermutation[] {
  return (['A', 'B'] as const).flatMap((label) =>
    waterlessOptions(options.waterless).map((waterless) => {
      const assetId = withWaterless(`hex_river_crossing_${label}`, waterless);
      return {
        id: ['river-crossing', label, waterless ? 'waterless' : 'water', 'r0'].join(':'),
        kind: 'river-crossing',
        family: 'river',
        label: `crossing_${label}`,
        assetId,
        inputMask: 0b111111,
        canonicalMask: 0b111111,
        rotationSteps: 0,
        rotationRadians: 0,
        waterless,
        curvy: false,
      };
    })
  );
}

/** Lists every requested coast guide variant/rotation/waterless permutation. */
export function listCoastGuidePermutations(
  options: GuidePermutationOptions = {}
): GuideTilePermutation[] {
  return COAST_VARIANTS.flatMap((variant) =>
    normalizedRotationSteps(options.rotationSteps).flatMap((rotationSteps) =>
      waterlessOptions(options.waterless).map((waterless) =>
        guidePermutation({
          kind: 'coast',
          family: 'coast',
          variant,
          rotationSteps,
          waterless,
        })
      )
    )
  );
}

/** Lists the full guide permutation matrix used by visual coverage tests. */
export function listGuideTilePermutations(): GuideTilePermutation[] {
  return [
    ...listRoadGuidePermutations(),
    ...listRiverGuidePermutations(),
    ...listRiverCurvyGuidePermutations(),
    ...listRiverCrossingGuidePermutations(),
    ...listCoastGuidePermutations(),
  ];
}

function selectVariant(
  family: VariantSelection['family'],
  mask: number,
  variants: readonly CanonicalVariant[]
): VariantSelection {
  for (const candidate of variants) {
    for (let rotationSteps = 0; rotationSteps < HEX_EDGE_COUNT; rotationSteps += 1) {
      if (rotateMask(candidate.canonicalMask, rotationSteps) === mask) {
        return {
          family,
          label: candidate.label,
          assetId: candidate.assetId,
          inputMask: mask,
          canonicalMask: candidate.canonicalMask,
          rotationSteps,
          rotationRadians: rotationSteps * HEX_ROTATION_RADIANS,
        };
      }
    }
  }

  throw new GameboardRuntimeError(
    `No ${family} variant covers edge mask ${mask.toString(2).padStart(6, '0')}`
  );
}

function selectVariantByLabel(
  family: VariantSelection['family'],
  label: string,
  variants: readonly CanonicalVariant[]
): VariantSelection {
  const normalized = label.toUpperCase();
  const candidate = variants.find((item) => item.label === normalized);
  if (!candidate) {
    throw new GameboardRuntimeError(`Unknown ${family} guide label: ${label}`);
  }
  return {
    family,
    label: candidate.label,
    assetId: candidate.assetId,
    inputMask: candidate.canonicalMask,
    canonicalMask: candidate.canonicalMask,
    rotationSteps: 0,
    rotationRadians: 0,
  };
}

function variant(label: string, assetId: string, edges: readonly HexEdgeIndex[]): CanonicalVariant {
  return {
    label,
    assetId,
    canonicalMask: edgeMask(edges),
  };
}

function withWaterless(assetId: string, waterless?: boolean): string {
  return waterless ? `${assetId}_waterless` : assetId;
}

function guidePermutation(input: {
  kind: GuideTilePermutationKind;
  family: VariantSelection['family'];
  variant: CanonicalVariant;
  rotationSteps: number;
  assetId?: string;
  waterless?: boolean;
  curvy?: boolean;
}): GuideTilePermutation {
  const rotationSteps = normalizeRotationSteps(input.rotationSteps);
  const waterless = input.waterless ?? false;
  const assetId = withWaterless(input.assetId ?? input.variant.assetId, waterless);
  return {
    id: [
      input.kind,
      input.variant.label,
      waterless ? 'waterless' : 'water',
      `r${rotationSteps}`,
    ].join(':'),
    kind: input.kind,
    family: input.family,
    label: input.variant.label,
    assetId,
    inputMask: rotateMask(input.variant.canonicalMask, rotationSteps),
    canonicalMask: input.variant.canonicalMask,
    rotationSteps,
    rotationRadians: rotationSteps * HEX_ROTATION_RADIANS,
    waterless,
    curvy: input.curvy ?? false,
  };
}

function normalizedRotationSteps(steps: readonly number[] = HEX_ROTATION_STEPS): number[] {
  return steps.map(normalizeRotationSteps);
}

function normalizeRotationSteps(steps: number): number {
  return ((Math.floor(steps) % HEX_EDGE_COUNT) + HEX_EDGE_COUNT) % HEX_EDGE_COUNT;
}

function waterlessOptions(value: boolean | 'both' = 'both'): boolean[] {
  if (value === 'both') {
    return [false, true];
  }
  return [value];
}
