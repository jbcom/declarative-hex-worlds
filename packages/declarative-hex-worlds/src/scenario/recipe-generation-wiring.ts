/**
 * `src/scenario/recipe-generation-wiring.ts` — wires the koota generation
 * applier as the process-wide default (RFC 0001 RFC0-CORE).
 *
 * This is a side-effect-only module, imported LAST by the scenario barrel (after
 * both `./recipe` and `./recipe-generation` are fully initialized). It must be
 * separate: doing the wiring inside `./recipe-generation` runs the call while
 * `./recipe` is still mid-initialization (they form an import cycle), tripping a
 * temporal-dead-zone `ReferenceError`. By the time this module's body runs, both
 * are initialized, so `setDefaultRecipeGenerationApplier` is safe.
 *
 * `./core` never imports this module (nor `./recipe-generation`), so the `./core`
 * recipe compiler keeps its pure default — which throws a clear "requires the
 * runtime tier" error if a recipe declares generation fill rules.
 * The package sideEffects list preserves this module during the library build
 * and its isolated emitted entry during consumer tree shaking. The build keeps
 * imports of that entry external so its effect cannot enter core's shared chunks.
 *
 * @module
 */
import { applyGameboardRecipeGeneration } from './recipe-generation';
import { setDefaultRecipeGenerationApplier } from './recipe';

setDefaultRecipeGenerationApplier(applyGameboardRecipeGeneration);
