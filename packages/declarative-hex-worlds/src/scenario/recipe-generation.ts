/**
 * `src/scenario/recipe-generation.ts` — the koota-backed half of recipe
 * generation (RFC 0001 RFC0-CORE).
 *
 * Seeded recipe generation runs layout-fill by spawning into a koota world and
 * projecting the result back to a plan, so it belongs in the runtime tier — NOT
 * in `./core`. The pure recipe-step compilation (`applyGameboardRecipe`,
 * `createGameboardPlanFromRecipe` without generation) stays koota-free in
 * `./recipe`; this module holds only the World-touching generation applier,
 * which the main/runtime tier injects into the compiler.
 *
 * @module
 */
import { projectWorldToGameboardPlan, spawnGameboardLayoutFill } from '../coordinates';
import { createGameboardWorld } from '../koota';
import type { GameboardPlan } from '../gameboard';
import {
  type GameboardRecipeGeneration,
  createGameboardRecipeGenerationFillRules,
  setDefaultRecipeGenerationApplier,
} from './recipe';

/**
 * Run seeded recipe generation over a built plan and return the projected result.
 * Builds a koota world, spawns the generation's layout-fill, projects back. When
 * the generation declares no fill rules, returns the plan unchanged (no world).
 */
export function applyGameboardRecipeGeneration(
  plan: GameboardPlan,
  generation: GameboardRecipeGeneration | undefined
): GameboardPlan {
  const rules = createGameboardRecipeGenerationFillRules(generation);
  if (rules.length === 0) {
    return plan;
  }
  const world = createGameboardWorld(plan);
  try {
    spawnGameboardLayoutFill(world, {
      seed: generation?.layoutFillSeed ?? `${plan.seed}:recipe-layout-fill`,
      rules,
    });
    return projectWorldToGameboardPlan(world);
  } finally {
    world.destroy();
  }
}

// Wire the koota applier as the process-wide default when the runtime tier is
// loaded, so `createGameboardPlanFromRecipe(recipe)` compiles generation for
// runtime consumers. `./core` never imports this module, so it keeps the pure
// default (which errors clearly if a recipe declares generation fill rules).
setDefaultRecipeGenerationApplier(applyGameboardRecipeGeneration);
