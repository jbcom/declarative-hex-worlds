import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createGameboardScenarioInteropSnapshot,
  type GameboardInteropSnapshot,
} from '../../interop';
import {
  inspectGameboardBlueprint,
  inspectGameboardBlueprintScenario,
  type GameboardBlueprintInspection,
  type GameboardBlueprintOptions,
  type GameboardBlueprintScenarioInspection,
  type GameboardBlueprintScenarioOptions,
} from '../../scenario';
import type { PackEdition } from '../../types';
import { GameboardCliError } from '../../errors';
import { validateGameboardPlan } from '../../rules';
import {
  type ParsedArgs,
  relativizePath,
  safeResolveOutput,
  validationConfigFromArgs,
  readJson,
  readNumberFlag,
  isRecord,
  printViolations,
  formatCounts,
} from '../_shared';
import { snapshotOptionsFromFlags } from './snapshot';

export function readBlueprintOptionsFile(path: string): GameboardBlueprintScenarioOptions {
  const payload = readJson(path);
  const options =
    isRecord(payload) && isRecord(payload.blueprint)
      ? payload.blueprint
      : isRecord(payload) && isRecord(payload.options)
        ? payload.options
        : payload;
  if (!isRecord(options)) {
    throw new GameboardCliError(
      `Blueprint file ${relativizePath(path)} must be an options object, { "blueprint": ... }, or { "options": ... }`
    );
  }
  return options as unknown as GameboardBlueprintScenarioOptions;
}

export function readBlueprintOptions(
  flags: Record<string, string | boolean>
): GameboardBlueprintScenarioOptions {
  const configPath =
    typeof flags.blueprint === 'string'
      ? flags.blueprint
      : typeof flags.config === 'string'
        ? flags.config
        : undefined;
  const fileOptions = configPath ? readBlueprintOptionsFile(resolve(configPath)) : {};
  const cliOptions: GameboardBlueprintScenarioOptions = {};
  const width = readNumberFlag(flags.width);
  const height = readNumberFlag(flags.height);
  const radius = readNumberFlag(flags.radius);

  if (typeof flags.seed === 'string') {
    cliOptions.seed = flags.seed;
  }
  if (typeof flags.faction === 'string') {
    cliOptions.faction = flags.faction as GameboardBlueprintOptions['faction'];
  }
  if (typeof flags.textureSet === 'string') {
    cliOptions.textureSet = flags.textureSet as GameboardBlueprintOptions['textureSet'];
  }
  if (typeof flags.defaultTerrain === 'string') {
    cliOptions.defaultTerrain =
      flags.defaultTerrain as GameboardBlueprintOptions['defaultTerrain'];
  }
  if (typeof flags.waterFill === 'string') {
    const waterFill = readNumberFlag(flags.waterFill);
    if (waterFill !== undefined) {
      cliOptions.waterFill = waterFill;
    }
  }
  if (typeof flags.maxElevation === 'string') {
    const maxElevation = readNumberFlag(flags.maxElevation);
    if (maxElevation !== undefined) {
      cliOptions.maxElevation = maxElevation;
    }
  }
  if (typeof flags.towns === 'string') {
    const towns = readNumberFlag(flags.towns);
    if (towns !== undefined) {
      cliOptions.towns = towns;
    }
  }
  if (typeof flags.harbors === 'string') {
    const harbors = readNumberFlag(flags.harbors);
    if (harbors !== undefined) {
      cliOptions.harbors = harbors;
    }
  }
  if (radius !== undefined || flags.shape === 'hexagon') {
    cliOptions.shape = { kind: 'hexagon', radius: Math.max(1, Math.floor(radius ?? 4)) };
  } else if (width !== undefined || height !== undefined || flags.shape === 'rectangle') {
    cliOptions.shape = {
      kind: 'rectangle',
      width: Math.max(1, Math.floor(width ?? 12)),
      height: Math.max(1, Math.floor(height ?? 9)),
    };
  }

  return {
    ...fileOptions,
    ...cliOptions,
  };
}

export function blueprintPayloadFromInspection(
  inspection: GameboardBlueprintInspection,
  violations: ReadonlyArray<ReturnType<typeof validateGameboardPlan>[number]>,
  flags: Record<string, string | boolean>,
  scenarioInspection?: GameboardBlueprintScenarioInspection,
  interop?: GameboardInteropSnapshot
): Record<string, unknown> {
  const errorCount = violations.filter((violation) => violation.severity === 'error').length;
  const warningCount = violations.filter((violation) => violation.severity === 'warning').length;
  const scenarioViolations = scenarioInspection?.scenarioInspection.violations ?? [];
  const scenarioErrorCount = scenarioViolations.filter(
    (violation) => violation.severity === 'error'
  ).length;
  const scenarioWarningCount = scenarioViolations.filter(
    (violation) => violation.severity === 'warning'
  ).length;
  return {
    seed: inspection.plan.seed,
    shape: inspection.plan.shape,
    recipeStepCount: inspection.recipe.steps.length,
    tileCount: inspection.plan.tiles.length,
    placementCount: inspection.plan.placements.length,
    counts: inspection.counts,
    warnings: inspection.warnings,
    validation: {
      errorCount,
      warningCount,
      violations,
    },
    ...(flags.includeRecipe === true ? { recipe: inspection.recipe } : {}),
    ...(flags.includePlan === true ? { plan: inspection.plan } : {}),
    ...(scenarioInspection
      ? {
          scenarioValidation: {
            errorCount: scenarioErrorCount,
            warningCount: scenarioWarningCount,
            violations: scenarioViolations,
          },
        }
      : {}),
    ...(flags.includeScenario === true && scenarioInspection
      ? { scenario: scenarioInspection.scenario }
      : {}),
    ...(flags.includeScenarioInspection === true && scenarioInspection
      ? { scenarioInspection: scenarioInspection.scenarioInspection }
      : {}),
    ...(interop
      ? {
          interopSummary: {
            entityCount: interop.entities.length,
            relationCount: interop.relations.length,
            spawnLocationCount: interop.spawnLocations.length,
            actorCount: interop.entities.filter((entity) => entity.kind === 'actor').length,
            questCount: interop.entities.filter((entity) => entity.kind === 'quest').length,
            spawnGroupCount: interop.entities.filter((entity) => entity.kind === 'spawn-group')
              .length,
            patrolRouteCount: interop.entities.filter((entity) => entity.kind === 'patrol-route')
              .length,
          },
        }
      : {}),
    ...(flags.includeInterop === true && interop ? { interop } : {}),
  };
}

export function hasBlueprintScenarioContent(
  options: GameboardBlueprintScenarioOptions
): boolean {
  return Boolean(
    options.scenarioId ||
      options.title ||
      options.spawnGroups ||
      options.patrolRoutes?.length ||
      options.actors?.length ||
      options.quests?.length ||
      options.scenarioMetadata
  );
}

export function shouldInspectBlueprintScenario(
  options: GameboardBlueprintScenarioOptions,
  flags: Record<string, string | boolean>
): boolean {
  return (
    hasBlueprintScenarioContent(options) ||
    typeof flags.outScenario === 'string' ||
    typeof flags.outScenarioInspection === 'string' ||
    typeof flags.outInterop === 'string' ||
    flags.includeScenario === true ||
    flags.includeScenarioInspection === true ||
    flags.includeInterop === true
  );
}

export function shouldEmitBlueprintInterop(flags: Record<string, string | boolean>): boolean {
  return typeof flags.outInterop === 'string' || flags.includeInterop === true;
}

export function createBlueprintScenarioInteropSnapshot(
  parsed: ParsedArgs,
  scenarioInspection: GameboardBlueprintScenarioInspection | undefined
): GameboardInteropSnapshot {
  if (!scenarioInspection) {
    throw new GameboardCliError('blueprint interop output requires a generated blueprint scenario');
  }
  return createGameboardScenarioInteropSnapshot(
    scenarioInspection.scenario,
    snapshotOptionsFromFlags(parsed.flags)
  );
}

export function printBlueprintInspection(
  inspection: GameboardBlueprintInspection,
  violations: ReadonlyArray<ReturnType<typeof validateGameboardPlan>[number]>
): void {
  console.log(`blueprint seed: ${inspection.plan.seed}`);
  console.log(`shape: ${JSON.stringify(inspection.plan.shape)}`);
  console.log(`recipe steps: ${inspection.recipe.steps.length}`);
  console.log(`tiles: ${inspection.plan.tiles.length}`);
  console.log(`placements: ${inspection.plan.placements.length}`);
  console.log(`counts: ${formatCounts(inspection.counts)}`);
  if (inspection.warnings.length > 0) {
    console.log('blueprint warnings:');
    for (const warning of inspection.warnings) {
      console.log(`  - ${warning}`);
    }
  } else {
    console.log('blueprint warnings: none');
  }
  printViolations(violations);
}

export function printBlueprintScenarioInspection(
  inspection: GameboardBlueprintScenarioInspection
): void {
  const scenarioInspection = inspection.scenarioInspection;
  console.log(`scenario: ${inspection.scenario.id}`);
  console.log(`scenario actors: ${inspection.scenario.actors?.length ?? 0}`);
  console.log(`scenario quests: ${inspection.scenario.quests?.length ?? 0}`);
  console.log(`scenario spawn groups: ${scenarioInspection.spawnGroups?.groupCount ?? 0}`);
  console.log(`scenario patrol routes: ${scenarioInspection.patrolRoutes?.routeCount ?? 0}`);
  printViolations(scenarioInspection.violations);
}

export function runBlueprint(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  const options = readBlueprintOptions(parsed.flags);
  const validationConfig = validationConfigFromArgs(parsed, sourceRoot, edition);
  const inspection = inspectGameboardBlueprint(options);
  const violations = validateGameboardPlan(inspection.plan, validationConfig);
  const scenarioInspection = shouldInspectBlueprintScenario(options, parsed.flags)
    ? inspectGameboardBlueprintScenario(options, { plan: validationConfig })
    : undefined;
  const interop = shouldEmitBlueprintInterop(parsed.flags)
    ? createBlueprintScenarioInteropSnapshot(parsed, scenarioInspection)
    : undefined;

  if (typeof parsed.flags.outRecipe === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outRecipe)),
      `${JSON.stringify(inspection.recipe, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote blueprint GameboardRecipe to ${safeResolveOutput(String(parsed.flags.outRecipe))}`
    );
  }
  if (typeof parsed.flags.outPlan === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(inspection.plan, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote blueprint GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`
    );
  }
  if (typeof parsed.flags.outScenario === 'string') {
    /* v8 ignore next 4 -- shouldInspectBlueprintScenario is true whenever --outScenario is present; this is defensive. */
    if (!scenarioInspection) {
      throw new GameboardCliError(
        'blueprint --outScenario requires scenario options or --includeScenario'
      );
    }
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outScenario)),
      `${JSON.stringify(scenarioInspection.scenario, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote blueprint GameboardScenario to ${safeResolveOutput(String(parsed.flags.outScenario))}`
    );
  }
  if (typeof parsed.flags.outScenarioInspection === 'string') {
    /* v8 ignore next 4 -- shouldInspectBlueprintScenario is true whenever --outScenarioInspection is present; this is defensive. */
    if (!scenarioInspection) {
      throw new GameboardCliError(
        'blueprint --outScenarioInspection requires scenario options or --includeScenarioInspection'
      );
    }
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outScenarioInspection)),
      `${JSON.stringify(scenarioInspection.scenarioInspection, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote blueprint scenario inspection to ${safeResolveOutput(String(parsed.flags.outScenarioInspection))}`
    );
  }
  if (typeof parsed.flags.outInterop === 'string') {
    /* v8 ignore next 3 -- shouldEmitBlueprintInterop creates interop whenever --outInterop is present; this is defensive. */
    if (!interop) {
      throw new GameboardCliError('blueprint --outInterop requires a generated blueprint scenario');
    }
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outInterop)),
      `${JSON.stringify(interop, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote blueprint interop snapshot with ${interop.entities.length} entities and ${interop.relations.length} relations to ${safeResolveOutput(String(parsed.flags.outInterop))}`
    );
  }

  const payload = blueprintPayloadFromInspection(
    inspection,
    violations,
    parsed.flags,
    scenarioInspection,
    interop
  );
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote blueprint inspection to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printBlueprintInspection(inspection, violations);
    if (scenarioInspection) {
      printBlueprintScenarioInspection(scenarioInspection);
    }
  }

  const scenarioViolations = scenarioInspection?.scenarioInspection.violations ?? [];
  const hasValidationErrors = violations.some((violation) => violation.severity === 'error');
  const hasScenarioErrors = scenarioViolations.some((violation) => violation.severity === 'error');
  const hasInspectionWarnings = inspection.warnings.length > 0;
  const hasValidationWarnings = violations.some((violation) => violation.severity === 'warning');
  const hasScenarioWarnings = scenarioViolations.some((violation) => violation.severity === 'warning');
  const hasErrors = hasValidationErrors || hasScenarioErrors;
  const hasWarnings = hasInspectionWarnings || hasValidationWarnings || hasScenarioWarnings;
  if (hasErrors) {
    process.exit(1);
  }
  if (parsed.flags.failOnWarning === true && hasWarnings) {
    process.exit(1);
  }
}

export async function run(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): Promise<void> {
  runBlueprint(parsed, sourceRoot, edition);
}
