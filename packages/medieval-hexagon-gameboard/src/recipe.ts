import { createGameboardBuilder, type GameboardBuilder } from './gameboard';
import type {
  FactionBuildingOptions,
  GameboardPlan,
  GameboardPlanOptions,
  GameboardTerrain,
  HarborOptions,
  HexRotationSteps,
  HillVariant,
  MountainStackOptions,
  NaturePlacementOptions,
  NeutralStructureOptions,
  PropPlacementOptions,
  RiverCrossing,
  RoadSlope,
  ScatterDecorationOptions,
  TileAssetOptions,
  TransitionPlacementOptions,
  UnitPlacementOptions,
  UnitPresetOptions,
} from './gameboard';
import { createGameboardWorld } from './koota';
import {
  createGameboardLayoutArchetypeRegistry,
  spawnGameboardLayoutFill,
  type GameboardLayoutArchetype,
  type GameboardLayoutArchetypeInput,
  type GameboardLayoutArchetypeRegistry,
  type GameboardLayoutFillRule,
  type GameboardLayoutPreference,
} from './layout';
import {
  createGameboardPieceRegistry,
  type GameboardPieceDeclarationInput,
  type GameboardPieceRegistry,
} from './pieces';
import {
  createSeededGameboardPieceFillRules,
  type SeededGameboardPieceFillOptions,
} from './rules';
import { projectWorldToGameboardPlan } from './projection';
import type { GameboardRuleViolation } from './rule-types';
import type { Faction, HexCoordinates, HexEdgeIndex } from './types';
import { validateGameboardPlan, type GameboardPlanValidationConfig } from './validation';

export const GAMEBOARD_RECIPE_SCHEMA_VERSION = '1.0.0';

export interface GameboardRecipe {
  schemaVersion: typeof GAMEBOARD_RECIPE_SCHEMA_VERSION;
  options: GameboardPlanOptions;
  steps: readonly GameboardRecipeStep[];
  generation?: GameboardRecipeGeneration;
}

export interface GameboardRecipeGeneration {
  layoutArchetypes?: GameboardLayoutArchetypeRegistry;
  layoutFillSeed?: string | number;
  layoutFills?: readonly GameboardLayoutFillRule[];
  pieceDeclarations?: readonly GameboardPieceDeclarationInput[];
  pieceFills?: readonly SeededGameboardPieceFillOptions[];
}

export type GameboardRecipeStep =
  | SetTerrainRecipeStep
  | SetTileAssetRecipeStep
  | SetElevationRecipeStep
  | SetCoastEdgesRecipeStep
  | AddRoadPathRecipeStep
  | AddRiverPathRecipeStep
  | AddMountainStackRecipeStep
  | AddHillRecipeStep
  | AddForestRecipeStep
  | AddFactionBuildingRecipeStep
  | AddNeutralStructureRecipeStep
  | AddNatureRecipeStep
  | AddPropRecipeStep
  | AddFlagRecipeStep
  | AddTransitionRecipeStep
  | AddUnitRecipeStep
  | AddUnitPresetRecipeStep
  | AddHarborRecipeStep
  | ScatterDecorationsRecipeStep;

export interface SetTerrainRecipeStep {
  action: 'setTerrain';
  at: HexCoordinates;
  terrain: Extract<GameboardTerrain, 'grass' | 'water'>;
  elevation?: number;
  baseAssetId?: string;
}

export interface SetTileAssetRecipeStep extends TileAssetOptions {
  action: 'setTileAsset';
}

export interface SetElevationRecipeStep {
  action: 'setElevation';
  at: HexCoordinates;
  elevation: number;
}

export interface SetCoastEdgesRecipeStep {
  action: 'setCoastEdges';
  at: HexCoordinates;
  waterEdges: readonly HexEdgeIndex[] | number;
  waterless?: boolean;
}

export interface AddRoadPathRecipeStep {
  action: 'addRoadPath';
  path: readonly HexCoordinates[];
  slope?: RoadSlope;
}

export interface AddRiverPathRecipeStep {
  action: 'addRiverPath';
  path: readonly HexCoordinates[];
  waterless?: boolean;
  curvy?: boolean;
  crossing?: RiverCrossing;
}

export interface AddMountainStackRecipeStep extends MountainStackOptions {
  action: 'addMountainStack';
}

export interface AddHillRecipeStep {
  action: 'addHill';
  at: HexCoordinates;
  variant?: HillVariant;
  withTrees?: boolean;
  single?: boolean;
  rotationSteps?: number;
}

export interface AddForestRecipeStep {
  action: 'addForest';
  at: HexCoordinates;
  species?: 'A' | 'B';
  size?: 'small' | 'medium' | 'large';
  cut?: boolean;
}

export interface AddFactionBuildingRecipeStep extends FactionBuildingOptions {
  action: 'addFactionBuilding';
}

export interface AddNeutralStructureRecipeStep extends NeutralStructureOptions {
  action: 'addNeutralStructure';
}

export interface AddNatureRecipeStep extends NaturePlacementOptions {
  action: 'addNature';
}

export interface AddPropRecipeStep extends PropPlacementOptions {
  action: 'addProp';
}

export interface AddFlagRecipeStep {
  action: 'addFlag';
  at: HexCoordinates;
  faction: Faction;
  rotationSteps?: HexRotationSteps | number;
  scale?: number;
}

export interface AddTransitionRecipeStep extends TransitionPlacementOptions {
  action: 'addTransition';
}

export interface AddUnitRecipeStep extends UnitPlacementOptions {
  action: 'addUnit';
}

export interface AddUnitPresetRecipeStep extends UnitPresetOptions {
  action: 'addUnitPreset';
}

export interface AddHarborRecipeStep extends HarborOptions {
  action: 'addHarbor';
}

export interface ScatterDecorationsRecipeStep extends ScatterDecorationOptions {
  action: 'scatterDecorations';
}

export type GameboardRecipePlanOptionsOverride = Partial<GameboardPlanOptions>;

export interface GameboardRecipeValidationConfig {
  overrides?: GameboardRecipePlanOptionsOverride;
  plan?: GameboardPlanValidationConfig;
}

export interface GameboardRecipeValidationResult {
  recipe: GameboardRecipe;
  plan?: GameboardPlan;
  violations: readonly GameboardRuleViolation[];
}

interface RecipeArchetypeReference {
  path: string;
  archetype: GameboardLayoutArchetypeInput | undefined;
  explicitKind?: string;
}

export function createGameboardRecipe(
  options: GameboardPlanOptions,
  steps: readonly GameboardRecipeStep[] = [],
  generation: GameboardRecipeGeneration = {}
): GameboardRecipe {
  return {
    schemaVersion: GAMEBOARD_RECIPE_SCHEMA_VERSION,
    options: cloneRecipeOptions(options),
    steps: steps.map(cloneRecipeStep),
    generation: cloneRecipeGeneration(generation),
  };
}

export function appendGameboardRecipeSteps(
  recipe: GameboardRecipe,
  steps: readonly GameboardRecipeStep[]
): GameboardRecipe {
  return {
    schemaVersion: recipe.schemaVersion,
    options: cloneRecipeOptions(recipe.options),
    steps: [...recipe.steps.map(cloneRecipeStep), ...steps.map(cloneRecipeStep)],
    generation: cloneRecipeGeneration(recipe.generation),
  };
}

export function mergeGameboardRecipes(base: GameboardRecipe, recipes: readonly GameboardRecipe[]): GameboardRecipe {
  return {
    schemaVersion: base.schemaVersion,
    options: cloneRecipeOptions(base.options),
    steps: [
      ...base.steps.map(cloneRecipeStep),
      ...recipes.flatMap((recipe) => recipe.steps.map(cloneRecipeStep)),
    ],
    generation: mergeRecipeGenerations([base, ...recipes].map((recipe) => recipe.generation)),
  };
}

export function createGameboardPlanFromRecipe(
  recipe: GameboardRecipe,
  overrides: GameboardRecipePlanOptionsOverride = {}
): GameboardPlan {
  const builder = createGameboardBuilder({ ...recipe.options, ...overrides });
  applyGameboardRecipe(builder, recipe);
  return applyGameboardRecipeGeneration(builder.build(), recipe.generation);
}

export function inspectGameboardRecipe(
  recipe: GameboardRecipe,
  config: GameboardRecipeValidationConfig = {}
): GameboardRecipeValidationResult {
  const preflightViolations = validateGameboardRecipeGeneration(recipe);
  if (preflightViolations.some((violation) => violation.severity === 'error')) {
    return {
      recipe,
      violations: preflightViolations,
    };
  }
  try {
    const plan = createGameboardPlanFromRecipe(recipe, config.overrides);
    return {
      recipe,
      plan,
      violations: [...preflightViolations, ...validateGameboardPlan(plan, config.plan)],
    };
  } catch (error) {
    return {
      recipe,
      violations: [
        ...preflightViolations,
        {
          code: 'recipe.compile_failed',
          severity: 'error',
          message: `Recipe failed to compile: ${errorMessage(error)}`,
        },
      ],
    };
  }
}

export function validateGameboardRecipe(
  recipe: GameboardRecipe,
  config: GameboardRecipeValidationConfig = {}
): GameboardRuleViolation[] {
  return [...inspectGameboardRecipe(recipe, config).violations];
}

export function validateGameboardRecipeGeneration(recipe: GameboardRecipe): GameboardRuleViolation[] {
  const generation = recipe.generation;
  if (!generation) {
    return [];
  }
  const violations: GameboardRuleViolation[] = [];
  const generationArchetypes = createGameboardLayoutArchetypeRegistryFromRecipeGeneration(generation);

  for (const [key, archetype] of Object.entries(generation.layoutArchetypes ?? {})) {
    if (archetype.id !== key) {
      violations.push({
        code: 'recipe.layout_archetype_id_mismatch',
        severity: 'error',
        message: `Recipe generation layoutArchetypes.${key} has id ${archetype.id}; ids must match their registry key`,
      });
    }
  }

  generation.layoutFills?.forEach((rule, index) => {
    validateRecipeArchetypeReference(
      violations,
      {
        path: `generation.layoutFills.${index}.archetype`,
        archetype: rule.archetype,
        explicitKind: rule.kind,
      },
      mergeGenerationArchetypes(generationArchetypes, rule.archetypes)
    );
  });

  generation.pieceDeclarations?.forEach((declaration, index) => {
    validateRecipeArchetypeReference(violations, {
      path: `generation.pieceDeclarations.${index}.archetype`,
      archetype: declaration.archetype,
      explicitKind: declaration.kind,
    }, generationArchetypes);
  });

  return violations;
}

export function applyGameboardRecipe(
  builder: GameboardBuilder,
  recipeOrSteps: GameboardRecipe | readonly GameboardRecipeStep[]
): GameboardBuilder {
  const steps = 'steps' in recipeOrSteps ? recipeOrSteps.steps : recipeOrSteps;
  for (const step of steps) {
    applyRecipeStep(builder, step);
  }
  return builder;
}

export function applyRecipeStep(builder: GameboardBuilder, step: GameboardRecipeStep): GameboardBuilder {
  switch (step.action) {
    case 'setTerrain':
      return builder.setTerrain(step.at, step.terrain, {
        elevation: step.elevation,
        baseAssetId: step.baseAssetId,
      });
    case 'setTileAsset': {
      const { action: _action, ...options } = step;
      return builder.setTileAsset(options);
    }
    case 'setElevation':
      return builder.setElevation(step.at, step.elevation);
    case 'setCoastEdges':
      return builder.setCoastEdges(step.at, step.waterEdges, { waterless: step.waterless });
    case 'addRoadPath':
      return builder.addRoadPath(step.path, { slope: step.slope });
    case 'addRiverPath':
      return builder.addRiverPath(step.path, {
        waterless: step.waterless,
        curvy: step.curvy,
        crossing: step.crossing,
      });
    case 'addMountainStack': {
      const { action: _action, ...options } = step;
      return builder.addMountainStack(options);
    }
    case 'addHill':
      return builder.addHill(step.at, {
        variant: step.variant,
        withTrees: step.withTrees,
        single: step.single,
        rotationSteps: step.rotationSteps,
      });
    case 'addForest':
      return builder.addForest(step.at, {
        species: step.species,
        size: step.size,
        cut: step.cut,
      });
    case 'addFactionBuilding': {
      const { action: _action, ...options } = step;
      return builder.addFactionBuilding(options);
    }
    case 'addNeutralStructure': {
      const { action: _action, ...options } = step;
      return builder.addNeutralStructure(options);
    }
    case 'addNature': {
      const { action: _action, ...options } = step;
      return builder.addNature(options);
    }
    case 'addProp': {
      const { action: _action, ...options } = step;
      return builder.addProp(options);
    }
    case 'addFlag':
      return builder.addFlag(step.at, step.faction, {
        rotationSteps: step.rotationSteps,
        scale: step.scale,
      });
    case 'addTransition': {
      const { action: _action, ...options } = step;
      return builder.addTransition(options);
    }
    case 'addUnit': {
      const { action: _action, ...options } = step;
      return builder.addUnit(options);
    }
    case 'addUnitPreset': {
      const { action: _action, ...options } = step;
      return builder.addUnitPreset(options);
    }
    case 'addHarbor': {
      const { action: _action, ...options } = step;
      return builder.addHarbor(options);
    }
    case 'scatterDecorations': {
      const { action: _action, ...options } = step;
      return builder.scatterDecorations(options);
    }
    default:
      return assertNever(step);
  }
}

function cloneRecipeOptions(options: GameboardPlanOptions): GameboardPlanOptions {
  return { ...options, shape: { ...options.shape } };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function applyGameboardRecipeGeneration(
  plan: GameboardPlan,
  generation: GameboardRecipeGeneration | undefined
): GameboardPlan {
  const rules = createGameboardRecipeGenerationFillRules(generation);
  if (rules.length === 0) {
    return plan;
  }
  const world = createGameboardWorld(plan);
  spawnGameboardLayoutFill(world, {
    seed: generation?.layoutFillSeed ?? `${plan.seed}:recipe-layout-fill`,
    rules,
  });
  return projectWorldToGameboardPlan(world);
}

export function createGameboardPieceRegistryFromRecipe(
  recipe: GameboardRecipe
): GameboardPieceRegistry | undefined {
  return createGameboardPieceRegistryFromRecipeGeneration(recipe.generation);
}

export function createGameboardLayoutArchetypeRegistryFromRecipe(
  recipe: GameboardRecipe
): GameboardLayoutArchetypeRegistry | undefined {
  return createGameboardLayoutArchetypeRegistryFromRecipeGeneration(recipe.generation);
}

export function createGameboardLayoutArchetypeRegistryFromRecipeGeneration(
  generation: GameboardRecipeGeneration | undefined
): GameboardLayoutArchetypeRegistry | undefined {
  return generation?.layoutArchetypes
    ? createGameboardLayoutArchetypeRegistry(generation.layoutArchetypes)
    : undefined;
}

export function createGameboardPieceRegistryFromRecipeGeneration(
  generation: GameboardRecipeGeneration | undefined
): GameboardPieceRegistry | undefined {
  return generation?.pieceDeclarations?.length
    ? createGameboardPieceRegistry(generation.pieceDeclarations)
    : undefined;
}

export function createGameboardRecipeGenerationFillRules(
  generation: GameboardRecipeGeneration | undefined
): GameboardLayoutFillRule[] {
  if (!generation) {
    return [];
  }
  const registry = createGameboardPieceRegistryFromRecipeGeneration(generation);
  const archetypes = createGameboardLayoutArchetypeRegistryFromRecipeGeneration(generation);
  return [
    ...createSeededGameboardPieceFillRules(
      registry,
      generation.pieceFills?.map((fill) => withGenerationArchetypes(fill, archetypes))
    ),
    ...(generation.layoutFills?.map((rule) => withGenerationArchetypes(rule, archetypes)) ?? []),
  ];
}

function validateRecipeArchetypeReference(
  violations: GameboardRuleViolation[],
  reference: RecipeArchetypeReference,
  registry: GameboardLayoutArchetypeRegistry | undefined
): void {
  if (!reference.archetype || typeof reference.archetype !== 'string') {
    return;
  }
  const archetype = registry?.[reference.archetype];
  if (!archetype) {
    violations.push({
      code: 'recipe.layout_archetype_missing',
      severity: 'error',
      message: `${reference.path} references unknown layout archetype ${reference.archetype}`,
    });
    return;
  }
  if (!reference.explicitKind && !archetype.kind) {
    violations.push({
      code: 'recipe.layout_archetype_kind_missing',
      severity: 'error',
      message: `${reference.path} references ${reference.archetype}, but that archetype does not declare a placement kind`,
    });
  }
}

function mergeGenerationArchetypes(
  generationArchetypes: GameboardLayoutArchetypeRegistry | undefined,
  localArchetypes: GameboardLayoutArchetypeRegistry | undefined
): GameboardLayoutArchetypeRegistry | undefined {
  if (!generationArchetypes) {
    return localArchetypes;
  }
  if (!localArchetypes) {
    return generationArchetypes;
  }
  return { ...generationArchetypes, ...localArchetypes };
}

function cloneRecipeGeneration(
  generation: GameboardRecipeGeneration | undefined
): GameboardRecipeGeneration | undefined {
  if (!generation) {
    return undefined;
  }
  const cloned = {
    layoutArchetypes: cloneLayoutArchetypeRegistry(generation.layoutArchetypes),
    layoutFillSeed: generation.layoutFillSeed,
    layoutFills: generation.layoutFills?.map(cloneLayoutFillRule),
    pieceDeclarations: generation.pieceDeclarations?.map(clonePieceDeclaration),
    pieceFills: generation.pieceFills?.map(clonePieceFill),
  };
  return recipeGenerationIsEmpty(cloned) ? undefined : cloned;
}

function mergeRecipeGenerations(
  generations: readonly (GameboardRecipeGeneration | undefined)[]
): GameboardRecipeGeneration | undefined {
  const compact = generations.filter((generation): generation is GameboardRecipeGeneration => generation !== undefined);
  if (compact.length === 0) {
    return undefined;
  }
  const merged = {
    layoutArchetypes: mergeRecipeLayoutArchetypes(compact),
    layoutFillSeed: lastLayoutFillSeed(compact),
    layoutFills: compact.flatMap((generation) => generation.layoutFills?.map(cloneLayoutFillRule) ?? []),
    pieceDeclarations: compact.flatMap((generation) => generation.pieceDeclarations?.map(clonePieceDeclaration) ?? []),
    pieceFills: compact.flatMap((generation) => generation.pieceFills?.map(clonePieceFill) ?? []),
  };
  return recipeGenerationIsEmpty(merged) ? undefined : merged;
}

function lastLayoutFillSeed(generations: readonly GameboardRecipeGeneration[]): string | number | undefined {
  for (let index = generations.length - 1; index >= 0; index -= 1) {
    const seed = generations[index]?.layoutFillSeed;
    if (seed !== undefined) {
      return seed;
    }
  }
  return undefined;
}

function recipeGenerationIsEmpty(generation: GameboardRecipeGeneration): boolean {
  return (
    Object.keys(generation.layoutArchetypes ?? {}).length === 0 &&
    generation.layoutFillSeed === undefined &&
    (generation.layoutFills?.length ?? 0) === 0 &&
    (generation.pieceDeclarations?.length ?? 0) === 0 &&
    (generation.pieceFills?.length ?? 0) === 0
  );
}

function cloneRecipeStep<T extends GameboardRecipeStep>(step: T): T {
  if ('path' in step) {
    return { ...step, path: step.path.map((coordinates) => ({ ...coordinates })) } as T;
  }
  if (step.action === 'setCoastEdges') {
    return {
      ...step,
      at: { ...step.at },
      waterEdges: Array.isArray(step.waterEdges) ? [...step.waterEdges] : step.waterEdges,
    } as T;
  }
  if ('at' in step) {
    return { ...step, at: { ...step.at } } as T;
  }
  if (step.action === 'scatterDecorations') {
    return {
      ...step,
      assets: [...step.assets],
      terrain: Array.isArray(step.terrain) ? [...step.terrain] : step.terrain,
    } as T;
  }
  return { ...step };
}

function cloneLayoutFillRule(rule: GameboardLayoutFillRule): GameboardLayoutFillRule {
  return {
    ...rule,
    archetypes: cloneLayoutArchetypeRegistry(rule.archetypes),
    assets: rule.assets ? [...rule.assets] : undefined,
    criteria: rule.criteria ? cloneLayoutCriteria(rule.criteria) : undefined,
    metadata: rule.metadata ? { ...rule.metadata } : undefined,
  };
}

function clonePieceDeclaration(declaration: GameboardPieceDeclarationInput): GameboardPieceDeclarationInput {
  return {
    ...declaration,
    archetype: cloneArchetypeInput(declaration.archetype),
    tags: declaration.tags ? [...declaration.tags] : undefined,
    footprint:
      typeof declaration.footprint === 'object' && declaration.footprint !== null
        ? {
            ...declaration.footprint,
            edges: declaration.footprint.edges ? [...declaration.footprint.edges] : undefined,
            offsets: declaration.footprint.offsets?.map((coordinates) => ({ ...coordinates })),
          }
        : declaration.footprint,
    criteria: declaration.criteria ? cloneLayoutCriteria(declaration.criteria) : undefined,
    metadata: declaration.metadata ? { ...declaration.metadata } : undefined,
  };
}

function clonePieceFill(fill: SeededGameboardPieceFillOptions): SeededGameboardPieceFillOptions {
  return {
    ...fill,
    archetypes: cloneLayoutArchetypeRegistry(fill.archetypes),
    selection: fill.selection
      ? {
          ids: fill.selection.ids ? [...fill.selection.ids] : undefined,
          assetIds: fill.selection.assetIds ? [...fill.selection.assetIds] : undefined,
          roles: fill.selection.roles ? [...fill.selection.roles] : undefined,
          sources: fill.selection.sources ? [...fill.selection.sources] : undefined,
          tags: fill.selection.tags ? [...fill.selection.tags] : undefined,
          excludeTags: fill.selection.excludeTags ? [...fill.selection.excludeTags] : undefined,
          requiresExtra: fill.selection.requiresExtra,
        }
      : undefined,
    criteria: fill.criteria ? cloneLayoutCriteria(fill.criteria) : undefined,
    metadata: fill.metadata ? { ...fill.metadata } : undefined,
  };
}

function withGenerationArchetypes<T extends { archetypes?: GameboardLayoutArchetypeRegistry }>(
  value: T,
  archetypes: GameboardLayoutArchetypeRegistry | undefined
): T {
  if (!archetypes) {
    return value;
  }
  return {
    ...value,
    archetypes: value.archetypes ? { ...archetypes, ...value.archetypes } : archetypes,
  };
}

function mergeRecipeLayoutArchetypes(
  generations: readonly GameboardRecipeGeneration[]
): GameboardLayoutArchetypeRegistry | undefined {
  const merged: Record<string, GameboardLayoutArchetype> = {};
  for (const generation of generations) {
    Object.assign(merged, generation.layoutArchetypes ?? {});
  }
  return Object.keys(merged).length > 0 ? cloneLayoutArchetypeRegistry(merged) : undefined;
}

function cloneArchetypeInput(
  archetype: GameboardPieceDeclarationInput['archetype']
): GameboardPieceDeclarationInput['archetype'] {
  return typeof archetype === 'object' && archetype !== null
    ? cloneLayoutArchetype(archetype)
    : archetype;
}

function cloneLayoutArchetypeRegistry(
  registry: GameboardLayoutArchetypeRegistry | undefined
): GameboardLayoutArchetypeRegistry | undefined {
  if (!registry || Object.keys(registry).length === 0) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(registry).map(([id, archetype]) => [id, cloneLayoutArchetype(archetype)])
  );
}

function cloneLayoutArchetype(archetype: GameboardLayoutArchetype): GameboardLayoutArchetype {
  return {
    ...archetype,
    criteria: cloneLayoutCriteria(archetype.criteria),
    metadata: archetype.metadata ? { ...archetype.metadata } : undefined,
  };
}

function cloneLayoutCriteria<T extends NonNullable<GameboardLayoutFillRule['criteria']>>(criteria: T): T {
  return {
    ...criteria,
    terrain: Array.isArray(criteria.terrain) ? [...criteria.terrain] : criteria.terrain,
    excludeTerrain: Array.isArray(criteria.excludeTerrain) ? [...criteria.excludeTerrain] : criteria.excludeTerrain,
    elevation: Array.isArray(criteria.elevation) ? [...criteria.elevation] : criteria.elevation,
    tileTags: criteria.tileTags ? [...criteria.tileTags] : undefined,
    excludeTileTags: criteria.excludeTileTags ? [...criteria.excludeTileTags] : undefined,
    requiredAdjacentTerrain: Array.isArray(criteria.requiredAdjacentTerrain)
      ? [...criteria.requiredAdjacentTerrain]
      : criteria.requiredAdjacentTerrain,
    forbiddenAdjacentTerrain: Array.isArray(criteria.forbiddenAdjacentTerrain)
      ? [...criteria.forbiddenAdjacentTerrain]
      : criteria.forbiddenAdjacentTerrain,
    requiredAdjacentPlacementKind: Array.isArray(criteria.requiredAdjacentPlacementKind)
      ? [...criteria.requiredAdjacentPlacementKind]
      : criteria.requiredAdjacentPlacementKind,
    forbiddenAdjacentPlacementKind: Array.isArray(criteria.forbiddenAdjacentPlacementKind)
      ? [...criteria.forbiddenAdjacentPlacementKind]
      : criteria.forbiddenAdjacentPlacementKind,
    requiredAdjacentPlacementLayer: Array.isArray(criteria.requiredAdjacentPlacementLayer)
      ? [...criteria.requiredAdjacentPlacementLayer]
      : criteria.requiredAdjacentPlacementLayer,
    forbiddenAdjacentPlacementLayer: Array.isArray(criteria.forbiddenAdjacentPlacementLayer)
      ? [...criteria.forbiddenAdjacentPlacementLayer]
      : criteria.forbiddenAdjacentPlacementLayer,
    footprint:
      typeof criteria.footprint === 'object' && criteria.footprint !== null
        ? {
            ...criteria.footprint,
            edges: criteria.footprint.edges ? [...criteria.footprint.edges] : undefined,
            offsets: criteria.footprint.offsets?.map((coordinates) => ({ ...coordinates })),
          }
        : criteria.footprint,
    footprintTerrain: Array.isArray(criteria.footprintTerrain)
      ? [...criteria.footprintTerrain]
      : criteria.footprintTerrain,
    excludeFootprintTerrain: Array.isArray(criteria.excludeFootprintTerrain)
      ? [...criteria.excludeFootprintTerrain]
      : criteria.excludeFootprintTerrain,
    blockingPlacementKinds: criteria.blockingPlacementKinds ? [...criteria.blockingPlacementKinds] : undefined,
    blockingPlacementLayers: criteria.blockingPlacementLayers ? [...criteria.blockingPlacementLayers] : undefined,
    ignorePlacementIds: criteria.ignorePlacementIds ? [...criteria.ignorePlacementIds] : undefined,
    minDistanceFrom: criteria.minDistanceFrom?.map(cloneCoordinatesOrKey),
    maxDistanceFrom: criteria.maxDistanceFrom?.map(cloneCoordinatesOrKey),
    prefer: criteria.prefer?.map(cloneLayoutPreference),
  };
}

function cloneCoordinatesOrKey(value: HexCoordinates | string): HexCoordinates | string {
  return typeof value === 'string' ? value : { ...value };
}

function cloneLayoutPreference(preference: GameboardLayoutPreference): GameboardLayoutPreference {
  switch (preference.kind) {
    case 'near-terrain':
    case 'far-from-terrain':
      return {
        ...preference,
        terrain: Array.isArray(preference.terrain) ? [...preference.terrain] : preference.terrain,
      };
    case 'near-placement-kind':
    case 'far-from-placement-kind':
      return {
        ...preference,
        placementKind: Array.isArray(preference.placementKind) ? [...preference.placementKind] : preference.placementKind,
      };
    case 'center':
    case 'edge':
    case 'high-elevation':
    case 'low-elevation':
      return { ...preference };
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled gameboard recipe step: ${JSON.stringify(value)}`);
}
