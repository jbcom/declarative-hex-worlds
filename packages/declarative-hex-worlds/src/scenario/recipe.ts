/**
 * Serializable recipe operations for authored maps, generated boards, editors,
 * and saved board intent that can be built into validated gameboard plans.
 *
 * @module
 */
import { GameboardScenarioError } from '../errors';
import { createGameboardBuilder, type GameboardBuilder } from '../gameboard';
import type {
  BridgeOptions,
  ConstructionSiteOptions,
  ElevationRampOptions,
  FactionBuildingOptions,
  FortificationOptions,
  GameboardPlan,
  GameboardPlanOptions,
  GameboardPlacementKind,
  GameboardPlacementLayer,
  GameboardTerrain,
  HarborOptions,
  HexRotationSteps,
  HillVariant,
  MountainStackOptions,
  NaturePlacementOptions,
  NeutralStructureOptions,
  PropClusterOptions,
  PropPlacementOptions,
  RiverCrossing,
  RoadSlope,
  ScatterDecorationOptions,
  SiegeProjectileOptions,
  TileAssetOptions,
  TransitionPlacementOptions,
  UnitPlacementOptions,
  UnitPresetOptions,
} from '../gameboard';
import {
  createGameboardLayoutArchetypeRegistry,
  type GameboardLayoutArchetype,
  type GameboardLayoutArchetypeInput,
  type GameboardLayoutArchetypeRegistry,
  type GameboardLayoutFillRule,
  type GameboardLayoutPreference,
} from '../coordinates';
import {
  createGameboardPieceRegistry,
  type GameboardPieceDeclarationInput,
  type GameboardPieceRegistry,
} from '../pieces';
import {
  createSeededGameboardPieceFillRules,
  type SeededGameboardPieceFillOptions,
} from '../rules';
import type { GameboardRuleViolation } from '../rules';
import type { Faction, HexCoordinates, HexEdgeIndex, TextureSet } from '../types';
import { validateGameboardPlan, type GameboardPlanValidationConfig } from '../rules';

/** Current schema version for serialized gameboard recipes. */
export const GAMEBOARD_RECIPE_SCHEMA_VERSION = '1.0.0';

/** Serializable recipe for constructing and optionally generating a gameboard plan. */
export interface GameboardRecipe {
  /** Version tag for migration-safe recipe persistence. */
  schemaVersion: typeof GAMEBOARD_RECIPE_SCHEMA_VERSION;
  /** Base plan options used before step and generation application. */
  options: GameboardPlanOptions;
  /** Ordered imperative builder steps. */
  steps: readonly GameboardRecipeStep[];
  /** Optional seeded generation configuration applied after explicit steps. */
  generation?: GameboardRecipeGeneration;
}

/** Seeded generation configuration embedded in a recipe. */
export interface GameboardRecipeGeneration {
  /** Layout archetypes available to layout and piece fill rules. */
  layoutArchetypes?: GameboardLayoutArchetypeRegistry;
  /** Seed used by layout fill spawning. */
  layoutFillSeed?: string | number;
  /** Rules that spawn placements directly from layout archetypes. */
  layoutFills?: readonly GameboardLayoutFillRule[];
  /** Piece declarations used by seeded piece fill rules. */
  pieceDeclarations?: readonly GameboardPieceDeclarationInput[];
  /** Rules that spawn registered pieces from seeded percentage fills. */
  pieceFills?: readonly SeededGameboardPieceFillOptions[];
}

/** Discriminated union of all recipe actions supported by the builder adapter. */
export type GameboardRecipeStep =
  | SetTerrainRecipeStep
  | SetTileAssetRecipeStep
  | SetElevationRecipeStep
  | SetTextureSetRecipeStep
  | SetCoastEdgesRecipeStep
  | AddRoadPathRecipeStep
  | AddRiverPathRecipeStep
  | AddMountainStackRecipeStep
  | AddHillRecipeStep
  | AddForestRecipeStep
  | AddFactionBuildingRecipeStep
  | AddNeutralStructureRecipeStep
  | AddBridgeRecipeStep
  | AddFortificationRecipeStep
  | AddConstructionSiteRecipeStep
  | AddSiegeProjectileRecipeStep
  | AddElevationRampRecipeStep
  | AddNatureRecipeStep
  | AddPropRecipeStep
  | AddPropClusterRecipeStep
  | AddFlagRecipeStep
  | AddPlacementRecipeStep
  | AddTransitionRecipeStep
  | AddUnitRecipeStep
  | AddUnitPresetRecipeStep
  | AddHarborRecipeStep
  | ScatterDecorationsRecipeStep;

/** Recipe step that assigns grass or water terrain to one hex. */
export interface SetTerrainRecipeStep {
  /** Discriminator for terrain assignment. */
  action: 'setTerrain';
  /** Target hex coordinate. */
  at: HexCoordinates;
  /** Terrain value to assign. */
  terrain: Extract<GameboardTerrain, 'grass' | 'water'>;
  /** Optional elevation to assign with the terrain. */
  elevation?: number;
  /** Optional base tile asset override for the terrain. */
  baseAssetId?: string;
  /** Optional texture set override for this tile. */
  textureSet?: TextureSet;
}

/** Recipe step that applies a fully specified tile asset option object. */
export interface SetTileAssetRecipeStep extends TileAssetOptions {
  /** Discriminator for direct tile asset assignment. */
  action: 'setTileAsset';
}

/** Recipe step that changes one hex elevation. */
export interface SetElevationRecipeStep {
  /** Discriminator for elevation assignment. */
  action: 'setElevation';
  /** Target hex coordinate. */
  at: HexCoordinates;
  /** Elevation level to assign. */
  elevation: number;
}

/** Recipe step that changes one hex texture set without changing terrain. */
export interface SetTextureSetRecipeStep {
  /** Discriminator for texture-set assignment. */
  action: 'setTextureSet';
  /** Target hex coordinate. */
  at: HexCoordinates;
  /** KayKit texture set to apply to the tile. */
  textureSet: TextureSet;
}

/** Recipe step that records coastal water edge connectivity for one hex. */
export interface SetCoastEdgesRecipeStep {
  /** Discriminator for coastal edge assignment. */
  action: 'setCoastEdges';
  /** Target hex coordinate. */
  at: HexCoordinates;
  /** Water-facing edges as indexes or a canonical bit mask. */
  waterEdges: readonly HexEdgeIndex[] | number;
  /** Whether to choose the waterless coast variant. */
  waterless?: boolean;
}

/** Recipe step that lays road surfaces along a coordinate path. */
export interface AddRoadPathRecipeStep {
  /** Discriminator for road path creation. */
  action: 'addRoadPath';
  /** Ordered coordinates along the road. */
  path: readonly HexCoordinates[];
  /** Optional road slope variant for the path. */
  slope?: RoadSlope;
}

/** Recipe step that lays river surfaces along a coordinate path. */
export interface AddRiverPathRecipeStep {
  /** Discriminator for river path creation. */
  action: 'addRiverPath';
  /** Ordered coordinates along the river. */
  path: readonly HexCoordinates[];
  /** Whether to use waterless river banks. */
  waterless?: boolean;
  /** Whether to prefer curvy river variants. */
  curvy?: boolean;
  /** Crossing variant to place where road/river crossings are desired. */
  crossing?: RiverCrossing;
}

/** Recipe step that places a composed mountain stack. */
export interface AddMountainStackRecipeStep extends MountainStackOptions {
  /** Discriminator for mountain stack placement. */
  action: 'addMountainStack';
}

/** Recipe step that places a hill tile. */
export interface AddHillRecipeStep {
  /** Discriminator for hill placement. */
  action: 'addHill';
  /** Target hex coordinate. */
  at: HexCoordinates;
  /** KayKit hill variant to place. */
  variant?: HillVariant;
  /** Whether to use a hill asset with trees. */
  withTrees?: boolean;
  /** Whether to use the single-hex hill style. */
  single?: boolean;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps?: number;
}

/** Recipe step that places a KayKit forest feature. */
export interface AddForestRecipeStep {
  /** Discriminator for forest placement. */
  action: 'addForest';
  /** Target hex coordinate. */
  at: HexCoordinates;
  /** Tree species variant. */
  species?: 'A' | 'B';
  /** Forest size variant. */
  size?: 'small' | 'medium' | 'large';
  /** Whether to use a cut/logged forest variant. */
  cut?: boolean;
}

/** Recipe step that places a faction building. */
export interface AddFactionBuildingRecipeStep extends FactionBuildingOptions {
  /** Discriminator for faction building placement. */
  action: 'addFactionBuilding';
}

/** Recipe step that places a neutral structure. */
export interface AddNeutralStructureRecipeStep extends NeutralStructureOptions {
  /** Discriminator for neutral structure placement. */
  action: 'addNeutralStructure';
}

/** Recipe step that places a bridge structure with bridge-specific metadata. */
export interface AddBridgeRecipeStep extends BridgeOptions {
  /** Discriminator for bridge placement. */
  action: 'addBridge';
}

/** Recipe step that places a wall or fence with fortification metadata. */
export interface AddFortificationRecipeStep extends FortificationOptions {
  /** Discriminator for fortification placement. */
  action: 'addFortification';
}

/** Recipe step that places a construction, ruin, or worksite structure. */
export interface AddConstructionSiteRecipeStep extends ConstructionSiteOptions {
  /** Discriminator for construction site placement. */
  action: 'addConstructionSite';
}

/** Recipe step that places a neutral siege projectile. */
export interface AddSiegeProjectileRecipeStep extends SiegeProjectileOptions {
  /** Discriminator for siege projectile placement. */
  action: 'addSiegeProjectile';
}

/** Recipe step that places a sloped elevation ramp with ramp-specific metadata. */
export interface AddElevationRampRecipeStep extends ElevationRampOptions {
  /** Discriminator for elevation ramp placement. */
  action: 'addElevationRamp';
}

/** Recipe step that places a nature asset. */
export interface AddNatureRecipeStep extends NaturePlacementOptions {
  /** Discriminator for nature placement. */
  action: 'addNature';
}

/** Recipe step that places a prop asset. */
export interface AddPropRecipeStep extends PropPlacementOptions {
  /** Discriminator for prop placement. */
  action: 'addProp';
}

/** Recipe step that places a semantic prop cluster. */
export interface AddPropClusterRecipeStep extends PropClusterOptions {
  /** Discriminator for prop-cluster placement. */
  action: 'addPropCluster';
}

/** Recipe step that places a faction flag. */
export interface AddFlagRecipeStep {
  /** Discriminator for flag placement. */
  action: 'addFlag';
  /** Target hex coordinate. */
  at: HexCoordinates;
  /** Faction color/style to use for the flag. */
  faction: Faction;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps?: HexRotationSteps | number;
  /** Optional placement scale override. */
  scale?: number;
}

/** Recipe step that places an arbitrary asset with explicit placement semantics. */
export interface AddPlacementRecipeStep {
  /** Discriminator for custom placement creation. */
  action: 'addPlacement';
  /** Target hex coordinate. */
  at: HexCoordinates;
  /** Asset id to place. */
  assetId: string;
  /** Gameplay/render category for the placement. */
  kind: GameboardPlacementKind;
  /** Render and gameplay layer for the placement. */
  layer: GameboardPlacementLayer;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps?: HexRotationSteps | number;
  /** Fractional elevation offset above the tile surface. */
  elevationOffset?: number;
  /** Uniform render scale. */
  scale?: number;
  /** Optional stack order metadata. */
  stackIndex?: number;
  /** Whether the placement requires local EXTRA assets. */
  requiresExtra?: boolean;
  /** Serializable placement metadata. */
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

/** Recipe step that places an EXTRA transition asset. */
export interface AddTransitionRecipeStep extends TransitionPlacementOptions {
  /** Discriminator for transition placement. */
  action: 'addTransition';
}

/** Recipe step that places a single unit asset. */
export interface AddUnitRecipeStep extends UnitPlacementOptions {
  /** Discriminator for unit placement. */
  action: 'addUnit';
}

/** Recipe step that places a unit preset composition. */
export interface AddUnitPresetRecipeStep extends UnitPresetOptions {
  /** Discriminator for unit preset placement. */
  action: 'addUnitPreset';
}

/** Recipe step that places a harbor composition. */
export interface AddHarborRecipeStep extends HarborOptions {
  /** Discriminator for harbor placement. */
  action: 'addHarbor';
}

/** Recipe step that scatters decoration assets across matching tiles. */
export interface ScatterDecorationsRecipeStep extends ScatterDecorationOptions {
  /** Discriminator for decoration scatter placement. */
  action: 'scatterDecorations';
}

/** Partial plan-option override accepted when compiling a recipe. */
export type GameboardRecipePlanOptionsOverride = Partial<GameboardPlanOptions>;

/** Validation options for recipe preflight and compiled plan checks. */
export interface GameboardRecipeValidationConfig {
  /** Plan option overrides applied before validating the compiled plan. */
  overrides?: GameboardRecipePlanOptionsOverride;
  /** Validation config passed through to plan validation. */
  plan?: GameboardPlanValidationConfig;
}

/** Result from compiling and validating a recipe. */
export interface GameboardRecipeValidationResult {
  /** Recipe that was inspected. */
  recipe: GameboardRecipe;
  /** Compiled plan when compilation succeeds. */
  plan?: GameboardPlan;
  /** Preflight and compiled-plan validation violations. */
  violations: readonly GameboardRuleViolation[];
}

interface RecipeArchetypeReference {
  path: string;
  archetype: GameboardLayoutArchetypeInput | undefined;
  explicitKind?: string;
}

/** Creates a cloned, schema-tagged gameboard recipe. */
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

/** Returns a new recipe with additional steps appended. */
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

/** Merges explicit steps and generation config into one recipe. */
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

/**
 * Applies a recipe's seeded generation block to a built plan. The runtime tier
 * injects a koota-backed applier (`applyGameboardRecipeGeneration` from
 * `./recipe-generation`); `./core` uses the pure default below.
 */
export type RecipeGenerationApplier = (
  plan: GameboardPlan,
  generation: GameboardRecipeGeneration | undefined
) => GameboardPlan;

/**
 * The pure (koota-free) generation applier used by the `./core` tier. Seeded
 * recipe generation requires a koota world to run layout-fill, which core does
 * not depend on — so if a recipe declares generation fill rules, this throws a
 * clear "use the runtime tier" error rather than silently dropping them. A
 * generation block with no fill rules (or none at all) passes through unchanged.
 */
export function pureRecipeGenerationApplier(
  plan: GameboardPlan,
  generation: GameboardRecipeGeneration | undefined
): GameboardPlan {
  if (createGameboardRecipeGenerationFillRules(generation).length > 0) {
    throw new GameboardScenarioError(
      'Recipe generation fill rules require the runtime tier — import createGameboardPlanFromRecipe from "declarative-hex-worlds" (not "declarative-hex-worlds/core"), or pass an applyGeneration function.'
    );
  }
  return plan;
}

/**
 * The registered runtime generation applier, or undefined until the runtime tier
 * wires one. Stored via hoisted `function` accessors (NOT a `let`/`const`) so the
 * runtime tier's `setDefaultRecipeGenerationApplier` side-effect is safe even
 * when it runs mid-cycle during module initialization — a `let`/`const` binding
 * would be in its temporal dead zone at that point and throw. The default stays
 * the pure (koota-free) applier so `./core` is runtime-free; the runtime tier
 * registers the koota applier so the ~10 existing `createGameboardPlanFromRecipe`
 * callers compile generation without threading an argument through each.
 */
// `var` (not `let`/`const`): hoisted and initialized to `undefined` with NO
// temporal dead zone, so the runtime tier's registration side-effect is safe even
// if it runs before this line during the module-init import cycle.
var registeredGenerationApplier: RecipeGenerationApplier | undefined;

/**
 * Set the process-wide default generation applier (the runtime tier wires koota).
 * Pass `undefined` to clear it back to the pure default — mainly for tests that
 * exercise the `./core`-tier (unregistered) code path.
 */
export function setDefaultRecipeGenerationApplier(
  applier: RecipeGenerationApplier | undefined
): void {
  registeredGenerationApplier = applier;
}

function resolveGenerationApplier(): RecipeGenerationApplier {
  return registeredGenerationApplier ?? pureRecipeGenerationApplier;
}

/** Compiles a recipe into a concrete gameboard plan. */
export function createGameboardPlanFromRecipe(
  recipe: GameboardRecipe,
  overrides: GameboardRecipePlanOptionsOverride = {},
  applyGeneration: RecipeGenerationApplier = resolveGenerationApplier()
): GameboardPlan {
  const builder = createGameboardBuilder({ ...recipe.options, ...overrides });
  applyGameboardRecipe(builder, recipe);
  return applyGeneration(builder.build(), recipe.generation);
}

/** Compiles and validates a recipe, returning errors instead of throwing. */
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

/** Validates a recipe and returns all recipe/plan rule violations. */
export function validateGameboardRecipe(
  recipe: GameboardRecipe,
  config: GameboardRecipeValidationConfig = {}
): GameboardRuleViolation[] {
  return [...inspectGameboardRecipe(recipe, config).violations];
}

/** Validates generation-specific references before a recipe is compiled. */
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

/** Applies all recipe steps to an existing builder. */
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

/** Applies one recipe step to an existing builder. */
export function applyRecipeStep(builder: GameboardBuilder, step: GameboardRecipeStep): GameboardBuilder {
  switch (step.action) {
    case 'setTerrain':
      return builder.setTerrain(step.at, step.terrain, {
        elevation: step.elevation,
        baseAssetId: step.baseAssetId,
        textureSet: step.textureSet,
      });
    case 'setTileAsset': {
      const { action: _action, ...options } = step;
      return builder.setTileAsset(options);
    }
    case 'setElevation':
      return builder.setElevation(step.at, step.elevation);
    case 'setTextureSet':
      return builder.setTextureSet(step.at, step.textureSet);
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
    case 'addBridge': {
      const { action: _action, ...options } = step;
      return builder.addBridge(options);
    }
    case 'addFortification': {
      const { action: _action, ...options } = step;
      return builder.addFortification(options);
    }
    case 'addConstructionSite': {
      const { action: _action, ...options } = step;
      return builder.addConstructionSite(options);
    }
    case 'addSiegeProjectile': {
      const { action: _action, ...options } = step;
      return builder.addSiegeProjectile(options);
    }
    case 'addElevationRamp': {
      const { action: _action, ...options } = step;
      return builder.addElevationRamp(options);
    }
    case 'addNature': {
      const { action: _action, ...options } = step;
      return builder.addNature(options);
    }
    case 'addProp': {
      const { action: _action, ...options } = step;
      return builder.addProp(options);
    }
    case 'addPropCluster': {
      const { action: _action, ...options } = step;
      return builder.addPropCluster(options);
    }
    case 'addFlag':
      return builder.addFlag(step.at, step.faction, {
        rotationSteps: step.rotationSteps,
        scale: step.scale,
      });
    case 'addPlacement': {
      const { action: _action, ...options } = step;
      return builder.addPlacement(options);
    }
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

/** Creates the piece registry declared by a recipe, when any pieces are present. */
export function createGameboardPieceRegistryFromRecipe(
  recipe: GameboardRecipe
): GameboardPieceRegistry | undefined {
  return createGameboardPieceRegistryFromRecipeGeneration(recipe.generation);
}

/** Creates the layout archetype registry declared by a recipe, when present. */
export function createGameboardLayoutArchetypeRegistryFromRecipe(
  recipe: GameboardRecipe
): GameboardLayoutArchetypeRegistry | undefined {
  return createGameboardLayoutArchetypeRegistryFromRecipeGeneration(recipe.generation);
}

/** Creates a layout archetype registry from recipe generation config. */
export function createGameboardLayoutArchetypeRegistryFromRecipeGeneration(
  generation: GameboardRecipeGeneration | undefined
): GameboardLayoutArchetypeRegistry | undefined {
  return generation?.layoutArchetypes
    ? createGameboardLayoutArchetypeRegistry(generation.layoutArchetypes)
    : undefined;
}

/** Creates a piece registry from recipe generation config. */
export function createGameboardPieceRegistryFromRecipeGeneration(
  generation: GameboardRecipeGeneration | undefined
): GameboardPieceRegistry | undefined {
  return generation?.pieceDeclarations?.length
    ? createGameboardPieceRegistry(generation.pieceDeclarations)
    : undefined;
}

/** Creates all layout fill rules implied by recipe generation config. */
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
  if (step.action === 'setTileAsset') {
    const cloned = { ...step, at: { ...step.at } } as T & { tags?: string[] };
    if (step.tags) {
      cloned.tags = [...step.tags];
    }
    return cloned as T;
  }
  if ('at' in step) {
    const cloned = { ...step, at: { ...step.at } } as T & {
      metadata?: Readonly<Record<string, string | number | boolean | null>>;
    };
    return (cloned.metadata ? { ...cloned, metadata: { ...cloned.metadata } } : cloned) as T;
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
  throw new GameboardScenarioError(`Unhandled gameboard recipe step: ${JSON.stringify(value)}`);
}
