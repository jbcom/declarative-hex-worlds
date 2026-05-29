import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import { inspectGameboardScenario, type GameboardScenario } from '../../scenario';
import {
  createGameboardScenarioSimulationReport,
  inspectGameboardScenarioSimulationScript,
  runGameboardScenarioSimulationScript,
} from '../../simulation';
import { createGameboardSimulationInteropSnapshot } from '../../interop';
import { GameboardCliError } from '../../errors';
import {
  readJson,
  readSimulationScript,
  relativizePath,
  validationConfigFromArgs,
  printViolations,
  safeResolveOutput,
  type ParsedArgs,
} from '../_shared';

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runSimulateScenario(parsed, sourceRoot, edition);
}

function runSimulateScenario(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  if (typeof parsed.flags.scenario !== 'string') {
    throw new GameboardCliError('simulate-scenario requires --scenario <path>');
  }
  if (typeof parsed.flags.script !== 'string') {
    throw new GameboardCliError('simulate-scenario requires --script <path>');
  }

  const scenarioRaw = readJson(resolve(parsed.flags.scenario));
  if (typeof scenarioRaw !== 'object' || scenarioRaw === null || Array.isArray(scenarioRaw)) {
    throw new GameboardCliError(
      `Scenario file ${relativizePath(String(parsed.flags.scenario))} must be a JSON object`
    );
  }
  const scenario = scenarioRaw as GameboardScenario;
  const inspection = inspectGameboardScenario(scenario, {
    plan: validationConfigFromArgs(parsed, sourceRoot, edition),
  });
  const script = readSimulationScript(resolve(parsed.flags.script));
  const scriptInspection = inspectGameboardScenarioSimulationScript(script, {
    scenario,
    plan: inspection.plan,
  });
  const violations = [...inspection.violations, ...scriptInspection.violations];
  if (
    violations.some((violation) => violation.severity === 'error') &&
    parsed.flags.allowInvalid !== true
  ) {
    printViolations(violations);
    process.exit(1);
  }

  const result = runGameboardScenarioSimulationScript(scenario, script);
  const report = createGameboardScenarioSimulationReport(result, script.expectations);

  if (typeof parsed.flags.outPlan === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(report.finalPlan, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote final simulated GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`
    );
  }
  if (typeof parsed.flags.outInterop === 'string') {
    const interop = createGameboardSimulationInteropSnapshot(report, {
      includePlacements: parsed.flags.excludePlacements !== true,
      includeActors: parsed.flags.excludeActors !== true,
      includeQuests: parsed.flags.excludeQuests !== true,
      includeTimeline: parsed.flags.excludeTimeline !== true,
    });
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outInterop)),
      `${JSON.stringify(interop, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote simulation interop snapshot to ${safeResolveOutput(String(parsed.flags.outInterop))}`
    );
  }
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote scenario simulation report to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  }
  if (parsed.flags.json === true) {
    if (typeof parsed.flags.out !== 'string') {
      console.log(JSON.stringify(report, null, 2));
    }
  } else {
    printSimulationReport(report);
  }

  if (!report.success && parsed.flags.allowExpectationFailures !== true) {
    if (typeof parsed.flags.out === 'string' || parsed.flags.json === true) {
      printSimulationExpectationFailures(report);
    }
    process.exit(1);
  }
  if (
    parsed.flags.failOnBlockedQuest === true &&
    report.quests.some((quest) => quest.status === 'blocked')
  ) {
    process.exit(1);
  }
}

function printSimulationReport(
  report: ReturnType<typeof createGameboardScenarioSimulationReport>
): void {
  const completed = report.quests.filter((quest) => quest.status === 'completed').length;
  const blocked = report.quests.filter((quest) => quest.status === 'blocked').length;
  console.log(`scenario: ${report.scenarioId}`);
  console.log(`success: ${report.success ? 'yes' : 'no'}`);
  console.log(`steps: ${report.steps.length}`);
  console.log(`events: ${report.eventRecords.length}`);
  console.log(`commands: ${report.commands.length}`);
  console.log(`actor target records: ${report.actorTargets.length}`);
  console.log(`patrols: ${report.patrols.length}`);
  console.log(`movements: ${report.movements.length}`);
  console.log(`mutations: ${report.mutations.length}`);
  console.log(`actors: ${report.actors.length}`);
  console.log(`quests: ${report.quests.length} (${completed} completed, ${blocked} blocked)`);
  if (report.actorTargets.length > 0) {
    console.log('actor target records:');
    for (const actorTargets of report.actorTargets) {
      console.log(`  - ${actorTargetRecordSummary(actorTargets)}`);
    }
  }
  if (report.mutations.length > 0) {
    console.log('mutation records:');
    for (const mutation of report.mutations) {
      console.log(
        `  - ${mutation.type}: ${mutation.actorId ?? mutation.placementId ?? 'unknown'} ${mutationStatus(mutation)}`
      );
    }
  }
  printSimulationExpectationFailures(report);
}

function actorTargetRecordSummary(
  actorTargets: ReturnType<typeof createGameboardScenarioSimulationReport>['actorTargets'][number]
): string {
  const step = actorTargets.stepId ?? `step ${actorTargets.stepIndex}`;
  const source = actorTargets.sourceActorId ?? 'unknown source';
  const targetCount = actorTargets.targets.length;
  const reachableCount = actorTargets.reachableActorIds.length;
  const nearest = actorTargets.nearestTarget
    ? `${actorTargets.nearestTarget.actorId} via ${actorTargets.nearestTarget.approach}${
        actorTargets.nearestTarget.approachTileKey
          ? ` ${actorTargets.nearestTarget.approachTileKey}`
          : ''
      }`
    : 'none';
  const command = actorTargets.nearestTarget
    ? `${actorTargets.nearestTarget.commandKind}${actorTargets.nearestTarget.commandCanExecute ? '' : ' blocked'}`
    : 'no command';
  return `${step}: ${source} found ${reachableCount}/${targetCount} reachable; nearest ${nearest}; ${command}`;
}

function mutationStatus(
  mutation: ReturnType<typeof createGameboardScenarioSimulationReport>['mutations'][number]
): string {
  if (mutation.removed === true) {
    return 'removed';
  }
  if (mutation.spawned === true) {
    return 'spawned';
  }
  if (mutation.updated === true) {
    return 'updated';
  }
  return `not applied (${mutation.reason ?? 'unknown reason'})`;
}

function printSimulationExpectationFailures(
  report: ReturnType<typeof createGameboardScenarioSimulationReport>
): void {
  if (report.expectationFailures.length === 0) {
    return;
  }
  console.log('expectation failures:');
  for (const failure of report.expectationFailures) {
    console.log(`  - ${failure.path}: ${failure.message}`);
  }
}
