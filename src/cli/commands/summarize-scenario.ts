import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import {
  type GameboardScenario,
  type GameboardScenarioSummary,
  summarizeGameboardScenario,
} from '../../scenario';
import { GameboardCliError } from '../../errors';
import {
  readJson,
  validationConfigFromArgs,
  summaryOptionsFromFlags,
  printViolations,
  safeResolveOutput,
  formatShape,
  formatCounts,
  type ParsedArgs,
} from '../_shared';

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runSummarizeScenario(parsed, sourceRoot, edition);
}

function runSummarizeScenario(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  if (typeof parsed.flags.scenario !== 'string') {
    throw new GameboardCliError('summarize-scenario requires --scenario <path>');
  }
  const scenarioPath = resolve(parsed.flags.scenario);
  const scenario = readJson(scenarioPath) as GameboardScenario;
  const summary = summarizeGameboardScenario(scenario, {
    plan: validationConfigFromArgs(parsed, sourceRoot, edition),
    topAssetLimit: summaryOptionsFromFlags(parsed.flags).topAssetLimit,
  });

  if (summary.validation.errorCount > 0 && parsed.flags.allowInvalid !== true) {
    printViolations(summary.validation.violations);
    process.exit(1);
  }

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(summary, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote scenario summary to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printGameboardScenarioSummary(summary, scenarioPath);
  }

  if (parsed.flags.failOnWarning === true && summary.validation.warningCount > 0) {
    process.exit(1);
  }
}

function printGameboardScenarioSummary(
  summary: GameboardScenarioSummary,
  sourcePath: string
): void {
  const topActorAssets = summary.topActorAssets.slice(0, 10).map((asset) => {
    const suffix = asset.requiresExtra ? '*' : '';
    return `${asset.assetId}${suffix}=${asset.count}`;
  });
  console.log(`source: scenario ${sourcePath}`);
  console.log(`scenario: ${summary.scenarioId}`);
  if (summary.title) {
    console.log(`title: ${summary.title}`);
  }
  if (summary.board) {
    console.log(`seed: ${summary.board.seed}`);
    console.log(`shape: ${formatShape(summary.board.shape)}`);
    console.log(`tiles: ${summary.board.tileCount}`);
    console.log(`placements: ${summary.board.placementCount}`);
  }
  console.log(
    `validation: ${summary.validation.errorCount} error(s), ${summary.validation.warningCount} warning(s)`
  );
  console.log(`actors: ${summary.actorCount} authored, ${summary.resolvedActorCount} resolved`);
  console.log(
    `actor flags: ${summary.hostileActorCount} hostile, ${summary.interactiveActorCount} interactive, ${summary.blockingActorCount} blocking`
  );
  console.log(
    `actor agents: ${summary.movementAgentCount} movement, ${summary.patrolAgentCount} patrol`
  );
  console.log(`actor kinds: ${formatCounts(summary.actorKindCounts)}`);
  console.log(`actor teams: ${formatCounts(summary.actorTeamCounts)}`);
  console.log(`actor spawn groups: ${formatCounts(summary.actorSpawnGroupCounts)}`);
  console.log(`actor tiles: ${formatCounts(summary.actorTileCounts)}`);
  console.log(`actor tags: ${formatCounts(summary.actorTagCounts)}`);
  console.log(`actor assets: ${formatCounts(summary.actorAssetCounts)}`);
  console.log(
    `actor extra assets: ${
      summary.actorExtraAssetIds.length ? summary.actorExtraAssetIds.join(', ') : 'none'
    }`
  );
  console.log(`top actor assets: ${topActorAssets.length ? topActorAssets.join(', ') : 'none'}`);
  console.log(`quests: ${summary.questCount} quest(s), ${summary.objectiveCount} objective(s)`);
  console.log(`objective kinds: ${formatCounts(summary.objectiveKindCounts)}`);
  console.log(`objective actors: ${formatCounts(summary.objectiveActorCounts)}`);
  console.log(`objective targets: ${formatCounts(summary.objectiveTargetActorCounts)}`);
  console.log(
    `spawn groups: ${summary.spawnGroupCount} group(s), ${summary.spawnLocationCount} location(s), ${summary.spawnRouteFoundCount}/${summary.spawnRouteCheckCount} route check(s) found`
  );
  console.log(`spawn group locations: ${formatCounts(summary.spawnGroupLocationCounts)}`);
  console.log(
    `patrol routes: ${summary.patrolRouteFoundCount}/${summary.patrolRouteCount} found, ${summary.patrolWaypointCount} waypoint(s)`
  );
  console.log(`patrol route waypoints: ${formatCounts(summary.patrolRouteWaypointCounts)}`);
}
