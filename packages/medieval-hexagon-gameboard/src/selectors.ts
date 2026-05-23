import type { HexEdgeIndex, HexEdgeInput, VariantSelection } from './types';

export interface CanonicalVariant {
  label: string;
  assetId: string;
  canonicalMask: number;
}

export type GuideTilePermutationKind = 'road' | 'river' | 'river-curvy' | 'river-crossing' | 'coast';

export interface GuideTilePermutation {
  id: string;
  kind: GuideTilePermutationKind;
  family: VariantSelection['family'];
  label: string;
  assetId: string;
  inputMask: number;
  canonicalMask: number;
  rotationSteps: number;
  rotationRadians: number;
  waterless: boolean;
  curvy: boolean;
}

export interface GuidePermutationOptions {
  rotationSteps?: readonly number[];
  waterless?: boolean | 'both';
}

export const HEX_EDGE_COUNT = 6;
export const HEX_ROTATION_RADIANS = Math.PI / 3;
export const HEX_ROTATION_STEPS = [0, 1, 2, 3, 4, 5] as const;

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

export const COAST_VARIANTS = [
  variant('A', 'hex_coast_A', [0]),
  variant('B', 'hex_coast_B', [0, 1]),
  variant('C', 'hex_coast_C', [0, 1, 2]),
  variant('D', 'hex_coast_D', [0, 1, 2, 3]),
  variant('E', 'hex_coast_E', [0, 1, 2, 3, 4]),
] as const satisfies readonly CanonicalVariant[];

export function edgeMask(edges: HexEdgeInput): number {
  if (typeof edges === 'number') {
    return edges & 0b111111;
  }
  let mask = 0;
  for (const edge of Array.isArray(edges) ? edges : [edges]) {
    mask |= 1 << edge;
  }
  return mask & 0b111111;
}

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

export function selectRoadVariant(edges: HexEdgeInput): VariantSelection {
  return selectVariant('road', edgeMask(edges), ROAD_VARIANTS);
}

export function selectRoadVariantByLabel(label: string): VariantSelection {
  return selectVariantByLabel('road', label, ROAD_VARIANTS);
}

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

export function selectCoastVariant(
  waterEdges: HexEdgeInput,
  options: { waterless?: boolean } = {}
): VariantSelection {
  const selection = selectVariant('coast', edgeMask(waterEdges), COAST_VARIANTS);
  return { ...selection, assetId: withWaterless(selection.assetId, options.waterless) };
}

export function selectCoastVariantByLabel(
  label: string,
  options: { waterless?: boolean } = {}
): VariantSelection {
  const selection = selectVariantByLabel('coast', label, COAST_VARIANTS);
  return { ...selection, assetId: withWaterless(selection.assetId, options.waterless) };
}

export function listRoadGuidePermutations(options: Pick<GuidePermutationOptions, 'rotationSteps'> = {}): GuideTilePermutation[] {
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

export function listRiverGuidePermutations(options: GuidePermutationOptions = {}): GuideTilePermutation[] {
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

export function listRiverCurvyGuidePermutations(options: GuidePermutationOptions = {}): GuideTilePermutation[] {
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

export function listCoastGuidePermutations(options: GuidePermutationOptions = {}): GuideTilePermutation[] {
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

  throw new Error(`No ${family} variant covers edge mask ${mask.toString(2).padStart(6, '0')}`);
}

function selectVariantByLabel(
  family: VariantSelection['family'],
  label: string,
  variants: readonly CanonicalVariant[]
): VariantSelection {
  const normalized = label.toUpperCase();
  const candidate = variants.find((item) => item.label === normalized);
  if (!candidate) {
    throw new Error(`Unknown ${family} guide label: ${label}`);
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
    id: [input.kind, input.variant.label, waterless ? 'waterless' : 'water', `r${rotationSteps}`].join(':'),
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
