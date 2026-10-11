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
import type { GameboardPlan } from '../gameboard';
import { createGameboardWorld } from '../koota';
import { applyGameboardBiomeRegionStages } from '../rules/biome-regions';
import { setTileBiome } from '../systems';
import { createGameboardRecipeGenerationFillRules, type GameboardRecipeGeneration } from './recipe';

/**
 * Run seeded recipe generation over a built plan and return the projected result.
 * Applies ordered biome regions, builds a Koota world, spawns layout fills and
 * projects back. With neither region stages nor fill rules, returns the plan
 * unchanged without creating a world.
 */
export function applyGameboardRecipeGeneration(
  plan: GameboardPlan,
  generation: GameboardRecipeGeneration | undefined
): GameboardPlan {
  const rules = createGameboardRecipeGenerationFillRules(generation);
  const regions = generation?.biomeRegions ?? [];
  if (rules.length === 0 && regions.length === 0) {
    return plan;
  }
  const world = createGameboardWorld(plan);
  try {
    if (regions.length > 0) {
      const generated = applyGameboardBiomeRegionStages(projectWorldToGameboardPlan(world), regions);
      for (const tile of generated.tiles) {
        if (tile.pinned !== true) setTileBiome(world, tile.key, tile.biome);
      }
    }
    spawnGameboardLayoutFill(world, {
      seed: generation?.layoutFillSeed ?? `${plan.seed}:recipe-layout-fill`,
      rules,
    });
    const projected = projectWorldToGameboardPlan(world);
    return { ...projected, warnings: [...plan.warnings, ...projected.warnings] };
  } finally {
    world.destroy();
  }
}
