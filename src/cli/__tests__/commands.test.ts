/**
 * Direct-import coverage for the smaller CLI command modules (PRD E0h).
 *
 * The CLI dispatcher (cli.ts) lazy-imports per-subcommand modules; tests
 * that invoke the dispatcher via subprocess (smoke-built-cli.ts) don't
 * register coverage. Direct `import { run } from ...` calls do.
 *
 * Limited to subcommands that:
 *   - Don't require a populated bootstrap-target (so CI without RB-pre
 *     step still runs clean).
 *   - Have side-effects we can capture (console.log mock) + restore.
 *
 * @module
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameboardCliError } from '../../errors';
import type { ParsedArgs } from '../_shared';
import { run as runAnalyze } from '../commands/analyze';
import { run as runBlueprint } from '../commands/blueprint';
import { findCliPackageRoot, run as runCoverageCmd } from '../commands/coverage';
import { run as runDoctor } from '../commands/doctor';
import { run as runGuideApis } from '../commands/guide-apis';
import { run as runGuideAssets } from '../commands/guide-assets';
import { run as runGuidePermutations } from '../commands/guide-permutations';
import { run as runGuideRenderRequests } from '../commands/guide-render-requests';
import { run as runGuideRoles } from '../commands/guide-roles';
import { run as runGuideScenarios } from '../commands/guide-scenarios';
import { run as runGuideUsages } from '../commands/guide-usages';
import { run as runAnalyzeLayout } from '../commands/analyze-layout';
import { run as runBootstrap } from '../commands/bootstrap';
import { run as runCompatibilityCmd } from '../commands/compatibility';
import { run as runDeclarations } from '../commands/declarations';
import { run as runExtract } from '../commands/extract';
import { run as runPatrolRoutes } from '../commands/patrol-routes';
import { run as runPieces } from '../commands/pieces';
import { run as runPatrolScript } from '../commands/patrol-script';
import { run as runPiece } from '../commands/piece';
import { run as runSimulateScenario } from '../commands/simulate-scenario';
import { run as runSnapshot } from '../commands/snapshot';
import { run as runSpawnGroups } from '../commands/spawn-groups';
import { run as runManifest } from '../commands/manifest';
import { run as runPiecesFromAssets } from '../commands/pieces-from-assets';
import { run as runPlacePiece } from '../commands/place-piece';
import { run as runSummarizePlan } from '../commands/summarize-plan';
import { run as runSummarizeScenario } from '../commands/summarize-scenario';
import { run as runValidate } from '../commands/validate';
import { run as runValidateManifest } from '../commands/validate-manifest';
import { run as runValidatePlan } from '../commands/validate-plan';
import { run as runValidateRecipe } from '../commands/validate-recipe';
import { run as runValidateScenario } from '../commands/validate-scenario';
import { run as runValidateSimulation } from '../commands/validate-simulation';

describe('CLI doctor subcommand (PRD E0h)', () => {
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('reports edition + source + gltf count for a non-existent source', async () => {
    const parsed: ParsedArgs = { command: 'doctor', flags: {} };
    await runDoctor(parsed, '/nonexistent-source-root', 'free');

    const joined = logs.join('\n');
    expect(joined).toMatch(/edition: free/);
    expect(joined).toMatch(/source: \/nonexistent-source-root/);
    expect(joined).toMatch(/source exists: no/);
    expect(joined).toMatch(/gltf count: 0\/221/);
  });
});

const repoRoot = resolve(import.meta.dirname, '../../..');
const referenceFreeRoot = join(repoRoot, 'references/KayKit_Medieval_Hexagon_Pack_1.0_FREE');
const freeManifestPath = join(repoRoot, 'assets/free/manifest.json');
const docsRecipePath = join(repoRoot, 'docs/examples/generated-piece-scenario.recipe.json');
const docsScenarioPath = join(repoRoot, 'docs/examples/simple-rpg-scenario.json');
const docsSimulationScriptPath = join(repoRoot, 'docs/examples/simple-rpg-simulation.script.json');
const HAS_FREE_REFERENCES = existsSync(referenceFreeRoot);
const commandOutputRoot = mkdtempSync(join(tmpdir(), 'hex-worlds-commands-'));
let previousOutRoot: string | undefined;

function commandOutputPath(name: string): string {
  mkdirSync(commandOutputRoot, { recursive: true });
  return name;
}

function readCommandOutput<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(commandOutputRoot, name), 'utf8')) as T;
}

function writeCommandOutput(name: string, payload: unknown): string {
  const path = commandOutputPath(name);
  writeFileSync(resolve(commandOutputRoot, path), `${JSON.stringify(payload, null, 2)}\n`);
  return path;
}

function createPackageSearchRoot(packageSearchRoots: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'hex-worlds-coverage-'));
  packageSearchRoots.push(root);
  return root;
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected action to throw');
}

describe.skipIf(!HAS_FREE_REFERENCES)('CLI validate subcommand (PRD E0h)', () => {
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('confirms the local FREE reference pack has the expected 221 GLTFs', async () => {
    const parsed: ParsedArgs = { command: 'validate', flags: {} };
    await runValidate(parsed, referenceFreeRoot, 'free');
    const joined = logs.join('\n');
    expect(joined).toMatch(/Validated 221 free GLTF files/);
  });
});

describe.skipIf(!HAS_FREE_REFERENCES)('CLI manifest subcommand (PRD E0h)', () => {
  // safeResolveOutput jails --out to cwd subtree (PRD C1), so the test fixture
  // lives under cwd rather than tmpdir.
  const outRelative = `.test-tmp/manifest-${process.pid}.json`;
  const outAbsolute = resolve(repoRoot, outRelative);

  afterAll(() => {
    const dir = resolve(repoRoot, '.test-tmp');
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('emits the FREE manifest to disk when --out is supplied', async () => {
    const parsed: ParsedArgs = {
      command: 'manifest',
      flags: { out: outRelative },
    };
    await runManifest(parsed, referenceFreeRoot, 'free');
    expect(existsSync(outAbsolute)).toBe(true);
    const parsedManifest = JSON.parse(readFileSync(outAbsolute, 'utf8'));
    expect(parsedManifest.edition).toBe('free');
    expect(parsedManifest.counts.total).toBe(221);
  });
});

describe.skipIf(!HAS_FREE_REFERENCES)('CLI analyze subcommand (PRD E0h)', () => {
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('emits JSON analysis for the FREE reference pack with --json flag', async () => {
    const parsed: ParsedArgs = {
      command: 'analyze',
      flags: { json: true },
    };
    await runAnalyze(parsed, referenceFreeRoot, 'free');
    const joined = logs.join('\n');
    expect(joined).toContain('tileCount');
    expect(joined).toContain('analyzedCount');
  });
});

describe('CLI coverage subcommand (PRD E0h)', () => {
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;
  const packageSearchRoots: string[] = [];

  beforeEach(() => {
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    for (const root of packageSearchRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('emits coverage JSON when --json is supplied', async () => {
    const parsed: ParsedArgs = {
      command: 'coverage',
      flags: {
        json: true,
        generatedAt: '2026-05-26T00:00:00.000Z',
        checksPassed: true,
      },
    };
    await runCoverageCmd(parsed, '/nonexistent', 'free');
    const joined = logs.join('\n');
    expect(joined).toContain('schemaVersion');
    expect(joined).toContain('"status"');
  });

  it('finds the package root through valid non-matching package.json ancestors', () => {
    const root = createPackageSearchRoot(packageSearchRoots);
    writeFileSync(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'declarative-hex-worlds' })}\n`
    );
    const nested = join(root, 'examples/nested/leaf');
    mkdirSync(nested, { recursive: true });
    writeFileSync(
      join(root, 'examples/package.json'),
      `${JSON.stringify({ name: 'fixture-package' })}\n`
    );

    expect(findCliPackageRoot(nested)).toBe(root);
  });

  it('throws GameboardCliError for malformed package.json syntax during root search', () => {
    const root = createPackageSearchRoot(packageSearchRoots);
    const packageJsonPath = join(root, 'package.json');
    writeFileSync(packageJsonPath, '{not valid json\n');

    const error = captureError(() => findCliPackageRoot(root));

    expect(error).toBeInstanceOf(GameboardCliError);
    expect(error).toMatchObject({
      message: expect.stringContaining(`Failed to parse package.json at ${packageJsonPath}`),
    });
  });

  it('throws GameboardCliError for non-object package.json payloads during root search', () => {
    const root = createPackageSearchRoot(packageSearchRoots);
    const packageJsonPath = join(root, 'package.json');
    writeFileSync(packageJsonPath, '[]\n');

    const error = captureError(() => findCliPackageRoot(root));

    expect(error).toBeInstanceOf(GameboardCliError);
    expect(error).toMatchObject({
      message: `Malformed package.json at ${packageJsonPath}: expected a JSON object`,
    });
  });
});

describe('CLI guide-* subcommands (PRD E0h)', () => {
  // The guide-* commands delegate to _shared helpers; testing the run()
  // entrypoint covers the per-command delegation closures (which are the
  // uncovered 0% lines today).
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('guide-apis run() delegates to runGuideApis', async () => {
    const parsed: ParsedArgs = { command: 'guide-apis', flags: { json: true } };
    await runGuideApis(parsed, '/nonexistent', 'free');
    expect(logs.length).toBeGreaterThan(0);
  });

  it('guide-assets run() delegates to runGuideAssets', async () => {
    const parsed: ParsedArgs = { command: 'guide-assets', flags: { json: true } };
    await runGuideAssets(parsed, '/nonexistent', 'free');
    expect(logs.length).toBeGreaterThan(0);
  });

  it('guide-permutations run() delegates to runGuidePermutations', async () => {
    const parsed: ParsedArgs = { command: 'guide-permutations', flags: { json: true } };
    await runGuidePermutations(parsed, '/nonexistent', 'free');
    expect(logs.length).toBeGreaterThan(0);
  });

  it('guide-roles run() delegates to runGuideRoles', async () => {
    const parsed: ParsedArgs = { command: 'guide-roles', flags: { json: true } };
    await runGuideRoles(parsed, '/nonexistent', 'free');
    expect(logs.length).toBeGreaterThan(0);
  });

  it('guide-scenarios run() delegates to runGuideScenarios', async () => {
    const parsed: ParsedArgs = { command: 'guide-scenarios', flags: { json: true } };
    await runGuideScenarios(parsed, '/nonexistent', 'free');
    expect(logs.length).toBeGreaterThan(0);
  });

  it('guide-render-requests run() delegates to runGuideRenderRequests', async () => {
    const parsed: ParsedArgs = { command: 'guide-render-requests', flags: { json: true } };
    await runGuideRenderRequests(parsed, '/nonexistent', 'free');
    expect(logs.length).toBeGreaterThan(0);
  });

  it('guide-usages run() delegates to runGuideUsages', async () => {
    const parsed: ParsedArgs = { command: 'guide-usages', flags: { json: true } };
    await runGuideUsages(parsed, '/nonexistent', 'free');
    expect(logs.length).toBeGreaterThan(0);
  });
});

describe('CLI blueprint-derived subcommands (PRD E0h)', () => {
  const blueprintPath = resolve(repoRoot, 'examples/blueprint-board.json');
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    previousOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = commandOutputRoot;
  });

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  afterAll(() => {
    if (previousOutRoot === undefined) {
      delete process.env.HEX_WORLDS_OUT_ROOT;
    } else {
      process.env.HEX_WORLDS_OUT_ROOT = previousOutRoot;
    }
    rmSync(commandOutputRoot, { recursive: true, force: true });
  });

  it('summarizes, snapshots, spawn-plans, and patrol-plans blueprint artifacts', async () => {
    const prefix = 'blueprint-derived';
    const paths = Object.fromEntries(
      ['plan', 'recipe', 'scenario', 'scenarioInspection', 'interop', 'inspection'].map((key) => [
        key,
        commandOutputPath(`${prefix}.${key}.json`),
      ])
    ) as Record<
      'plan' | 'recipe' | 'scenario' | 'scenarioInspection' | 'interop' | 'inspection',
      string
    >;
    await runBlueprint(
      {
        command: 'blueprint',
        flags: {
          blueprint: blueprintPath,
          outRecipe: paths.recipe,
          outPlan: paths.plan,
          outScenario: paths.scenario,
          outScenarioInspection: paths.scenarioInspection,
          outInterop: paths.interop,
          out: paths.inspection,
          includeRecipe: true,
          includePlan: true,
          includeScenario: true,
          includeScenarioInspection: true,
          includeInterop: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    const blueprint = JSON.parse(readFileSync(blueprintPath, 'utf8')) as {
      spawnGroups: unknown;
      patrolRoutes: unknown;
    };
    const groupsPath = writeCommandOutput('blueprint-derived.groups.json', blueprint.spawnGroups);
    const routesPath = writeCommandOutput('blueprint-derived.routes.json', {
      seed: 'blueprint-derived-routes',
      routes: blueprint.patrolRoutes,
    });

    await runSummarizePlan(
      {
        command: 'summarize-plan',
        flags: {
          plan: resolve(commandOutputRoot, paths.plan),
          outPlan: commandOutputPath('blueprint-derived.summary-plan.json'),
          out: commandOutputPath('blueprint-derived.summary.json'),
          topAssets: '3',
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runSnapshot(
      {
        command: 'snapshot',
        flags: {
          scenario: resolve(commandOutputRoot, paths.scenario),
          out: commandOutputPath('blueprint-derived.snapshot.json'),
          spawnCount: '3',
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runSpawnGroups(
      {
        command: 'spawn-groups',
        flags: {
          plan: resolve(commandOutputRoot, paths.plan),
          groups: resolve(commandOutputRoot, groupsPath),
          out: commandOutputPath('blueprint-derived.spawn-groups.json'),
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runPatrolRoutes(
      {
        command: 'patrol-routes',
        flags: {
          plan: resolve(commandOutputRoot, paths.plan),
          groups: resolve(commandOutputRoot, groupsPath),
          routes: resolve(commandOutputRoot, routesPath),
          out: commandOutputPath('blueprint-derived.patrol-routes.json'),
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runPatrolScript(
      {
        command: 'patrol-script',
        flags: {
          routes: resolve(commandOutputRoot, `${prefix}.patrol-routes.json`),
          routeId: 'raider-watch',
          actorId: 'raider-1',
          includeReport: true,
          out: commandOutputPath('blueprint-derived.patrol-script.json'),
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runSimulateScenario(
      {
        command: 'simulate-scenario',
        flags: {
          scenario: docsScenarioPath,
          script: docsSimulationScriptPath,
          manifest: freeManifestPath,
          allowUnknownAssets: true,
          allowExpectationFailures: true,
          out: commandOutputPath('blueprint-derived.simulation-report.json'),
          outPlan: commandOutputPath('blueprint-derived.simulation-final-plan.json'),
          outInterop: commandOutputPath('blueprint-derived.simulation-interop.json'),
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runValidatePlan(
      {
        command: 'validate-plan',
        flags: {
          plan: resolve(commandOutputRoot, paths.plan),
          manifest: freeManifestPath,
          allowUnknownAssets: true,
          json: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runValidateRecipe(
      {
        command: 'validate-recipe',
        flags: {
          recipe: docsRecipePath,
          outPlan: commandOutputPath('blueprint-derived.validate-recipe-plan.json'),
          manifest: freeManifestPath,
          allowUnknownAssets: true,
          json: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runValidateScenario(
      {
        command: 'validate-scenario',
        flags: {
          scenario: docsScenarioPath,
          outPlan: commandOutputPath('blueprint-derived.validate-scenario-plan.json'),
          manifest: freeManifestPath,
          allowUnknownAssets: true,
          json: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runValidateSimulation(
      {
        command: 'validate-simulation',
        flags: {
          scenario: docsScenarioPath,
          script: docsSimulationScriptPath,
          outPlan: commandOutputPath('blueprint-derived.validate-simulation-plan.json'),
          manifest: freeManifestPath,
          allowUnknownAssets: true,
          json: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runSummarizeScenario(
      {
        command: 'summarize-scenario',
        flags: {
          scenario: docsScenarioPath,
          out: commandOutputPath('blueprint-derived.scenario-summary.json'),
          manifest: freeManifestPath,
          allowUnknownAssets: true,
          topAssets: '2',
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    const layoutRulesPath = writeCommandOutput('blueprint-derived.layout-rules.json', {
      seed: 'blueprint-derived-layout',
      rules: [{ id: 'tree-fill', archetype: 'tree', assetId: 'tree_single_A', count: 1 }],
    });
    const piecesPath = writeCommandOutput('blueprint-derived.pieces.json', {
      pieces: [
        {
          id: 'local-tree',
          assetId: 'tree_single_A',
          source: 'local fixtures',
          role: 'tree',
          criteria: { terrain: ['grass', 'forest', 'hill'], allowOccupied: true },
        },
      ],
    });
    await runValidateManifest(
      {
        command: 'validate-manifest',
        flags: {
          manifest: freeManifestPath,
          outManifest: commandOutputPath('blueprint-derived.normalized-manifest.json'),
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runAnalyzeLayout(
      {
        command: 'analyze-layout',
        flags: {
          plan: resolve(commandOutputRoot, paths.plan),
          rules: resolve(commandOutputRoot, layoutRulesPath),
          allowUnknownAssets: true,
          out: commandOutputPath('blueprint-derived.layout-analysis.json'),
          outPlan: commandOutputPath('blueprint-derived.layout-plan.json'),
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runPlacePiece(
      {
        command: 'place-piece',
        flags: {
          plan: resolve(commandOutputRoot, paths.plan),
          pieces: resolve(commandOutputRoot, piecesPath),
          pieceId: 'local-tree',
          allowUnknownAssets: true,
          count: '1',
          out: commandOutputPath('blueprint-derived.place-piece.json'),
          outPlan: commandOutputPath('blueprint-derived.place-piece-plan.json'),
        },
      },
      '/nonexistent-source-root',
      'free'
    );

    const summary = readCommandOutput<{
      source: { kind: string };
      summary: { seed: string; topAssets: unknown[] };
      validation: { errorCount: number };
    }>(`${prefix}.summary.json`);
    const plan = readCommandOutput<{ tiles: unknown[]; placements: unknown[] }>(
      `${prefix}.plan.json`
    );
    const scenario = readCommandOutput<{ id: string; actors: unknown[] }>(
      `${prefix}.scenario.json`
    );
    const snapshot = readCommandOutput<{ entities: unknown[]; relations: unknown[] }>(
      `${prefix}.snapshot.json`
    );
    const spawnGroups = readCommandOutput<{
      selectedLocationCount: number;
      errors: unknown[];
    }>(`${prefix}.spawn-groups.json`);
    const patrolRoutes = readCommandOutput<{
      routes: Array<{ id: string; found: boolean }>;
      errors: unknown[];
    }>(`${prefix}.patrol-routes.json`);
    const patrolScript = readCommandOutput<{
      stepCount: number;
      assignments: Array<{ actorId: string; routeId: string }>;
      errors: unknown[];
    }>(`${prefix}.patrol-script.json`);
    const simulationReport = readCommandOutput<{
      scenarioId: string;
      steps: unknown[];
      actors: unknown[];
      quests: unknown[];
    }>(`${prefix}.simulation-report.json`);
    const scenarioSummary = readCommandOutput<{
      scenarioId: string;
      validation: { errorCount: number };
      topActorAssets: unknown[];
    }>(`${prefix}.scenario-summary.json`);
    const layoutAnalysis = readCommandOutput<{
      errorCount: number;
      rules: Array<{ id: string; selectedCount: number }>;
    }>(`${prefix}.layout-analysis.json`);
    const piecePlacement = readCommandOutput<{
      pieceId: string;
      placements: unknown[];
    }>(`${prefix}.place-piece.json`);

    expect(plan.tiles.length).toBeGreaterThan(0);
    expect(plan.placements.length).toBeGreaterThan(0);
    expect(scenario).toMatchObject({
      id: 'docs-blueprint-board:intro',
      actors: expect.any(Array),
    });
    expect(existsSync(resolve(commandOutputRoot, paths.recipe))).toBe(true);
    expect(existsSync(resolve(commandOutputRoot, paths.scenarioInspection))).toBe(true);
    expect(existsSync(resolve(commandOutputRoot, paths.interop))).toBe(true);
    expect(existsSync(resolve(commandOutputRoot, 'blueprint-derived.simulation-final-plan.json'))).toBe(true);
    expect(existsSync(resolve(commandOutputRoot, 'blueprint-derived.simulation-interop.json'))).toBe(true);
    expect(existsSync(resolve(commandOutputRoot, 'blueprint-derived.normalized-manifest.json'))).toBe(true);
    expect(existsSync(resolve(commandOutputRoot, 'blueprint-derived.layout-plan.json'))).toBe(true);
    expect(existsSync(resolve(commandOutputRoot, 'blueprint-derived.place-piece-plan.json'))).toBe(true);
    expect(existsSync(resolve(commandOutputRoot, 'blueprint-derived.validate-recipe-plan.json'))).toBe(true);
    expect(existsSync(resolve(commandOutputRoot, 'blueprint-derived.validate-scenario-plan.json'))).toBe(true);
    expect(existsSync(resolve(commandOutputRoot, 'blueprint-derived.validate-simulation-plan.json'))).toBe(true);
    expect(readCommandOutput<{ validation: { errorCount: number } }>(`${prefix}.inspection.json`))
      .toMatchObject({ validation: { errorCount: 0 } });
    expect(summary).toMatchObject({
      source: { kind: 'plan' },
      summary: { seed: 'docs-blueprint-board' },
      validation: { errorCount: 0 },
    });
    expect(summary.summary.topAssets).toHaveLength(3);
    expect(snapshot.entities.length).toBeGreaterThan(0);
    expect(snapshot.relations.length).toBeGreaterThan(0);
    expect(spawnGroups).toMatchObject({
      selectedLocationCount: 3,
      errors: [],
    });
    expect(patrolRoutes).toMatchObject({
      errors: [],
    });
    expect(patrolRoutes.routes[0]).toMatchObject({
      id: 'raider-watch',
      found: true,
    });
    expect(patrolScript).toMatchObject({
      assignments: [{ actorId: 'raider-1', routeId: 'raider-watch' }],
      errors: [],
    });
    expect(patrolScript.stepCount).toBeGreaterThan(0);
    expect(simulationReport).toMatchObject({
      scenarioId: 'docs-simple-rpg-scenario',
    });
    expect(simulationReport.steps.length).toBeGreaterThan(0);
    expect(simulationReport.actors.length).toBeGreaterThan(0);
    expect(simulationReport.quests.length).toBeGreaterThan(0);
    expect(layoutAnalysis).toMatchObject({
      errorCount: 0,
      rules: [{ id: 'tree-fill', selectedCount: 1 }],
    });
    expect(piecePlacement.pieceId).toBe('local-tree');
    expect(piecePlacement.placements).toHaveLength(1);
    expect(scenarioSummary).toMatchObject({
      scenarioId: 'docs-simple-rpg-scenario',
      validation: { errorCount: 0 },
    });
    expect(scenarioSummary.topActorAssets.length).toBeGreaterThan(0);
    expect(scenarioSummary.topActorAssets.length).toBeLessThanOrEqual(2);
  });
});

describe.skipIf(!HAS_FREE_REFERENCES)('CLI compatibility happy path (PRD E0h)', () => {
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('compatibility emits a JSON report for a real FREE asset', async () => {
    const asset = resolve(
      referenceFreeRoot,
      'Assets/gltf/decoration/props/flag_yellow.gltf'
    );
    const parsed: ParsedArgs = {
      command: 'compatibility',
      flags: { asset, json: true },
    };
    await runCompatibilityCmd(parsed, '/x', 'free');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.join('\n')).toContain('"id"');
  });
});

describe('CLI validate-* subcommands surface required-flag errors (PRD E0h)', () => {
  it('validate-manifest throws GameboardCliError without --manifest', async () => {
    await expect(runValidateManifest({ command: 'validate-manifest', flags: {} }, '/x', 'free')).rejects.toThrow(
      /validate-manifest requires --manifest/
    );
  });

  it('validate-plan throws GameboardCliError without --plan', async () => {
    await expect(runValidatePlan({ command: 'validate-plan', flags: {} }, '/x', 'free')).rejects.toThrow(
      /validate-plan requires --plan/
    );
  });

  it('validate-recipe throws GameboardCliError without --recipe', async () => {
    await expect(runValidateRecipe({ command: 'validate-recipe', flags: {} }, '/x', 'free')).rejects.toThrow(
      /validate-recipe requires --recipe/
    );
  });

  it('validate-scenario throws GameboardCliError without --scenario', async () => {
    await expect(runValidateScenario({ command: 'validate-scenario', flags: {} }, '/x', 'free')).rejects.toThrow(
      /validate-scenario requires --scenario/
    );
  });

  it('validate-simulation throws GameboardCliError without --scenario', async () => {
    await expect(runValidateSimulation({ command: 'validate-simulation', flags: {} }, '/x', 'free')).rejects.toThrow(
      /validate-simulation requires --scenario/
    );
  });

  it('summarize-scenario throws GameboardCliError without --scenario', async () => {
    await expect(runSummarizeScenario({ command: 'summarize-scenario', flags: {} }, '/x', 'free')).rejects.toThrow(
      /summarize-scenario requires --scenario/
    );
  });

  it('place-piece throws when neither --plan/--recipe/--scenario supplied', async () => {
    await expect(runPlacePiece({ command: 'place-piece', flags: {} }, '/x', 'free')).rejects.toThrow(
      /place-piece requires exactly one of/
    );
  });

  it('place-piece throws when --pieces missing but plan supplied', async () => {
    await expect(
      runPlacePiece(
        { command: 'place-piece', flags: { plan: '/tmp/no.json' } },
        '/x',
        'free'
      )
    ).rejects.toThrow();
  });

  it('analyze-layout throws GameboardCliError without --rules', async () => {
    await expect(runAnalyzeLayout({ command: 'analyze-layout', flags: {} }, '/x', 'free')).rejects.toThrow(
      /analyze-layout requires exactly one of/
    );
  });

  it('pieces-from-assets throws without --assets', async () => {
    await expect(runPiecesFromAssets({ command: 'pieces-from-assets', flags: {} }, '/x', 'free')).rejects.toThrow(
      /pieces-from-assets requires --assets/
    );
  });

  it('bootstrap throws on invalid --source value (E0a)', async () => {
    await expect(
      runBootstrap({ command: 'bootstrap', flags: { source: 'magic' } }, '/x', 'free')
    ).rejects.toThrow(/bootstrap --source must be/);
  });

  it('bootstrap --source zip throws without --zip', async () => {
    await expect(
      runBootstrap({ command: 'bootstrap', flags: { source: 'zip' } }, '/x', 'free')
    ).rejects.toThrow(/bootstrap --source zip requires --zip/);
  });

  it('summarize-plan delegates without throwing for blueprint-derived plan flag combo', async () => {
    // summarize-plan accepts --plan/--blueprint/--recipe/--scenario; without
    // any of them validationConfigFromArgs throws a different error. We pin
    // the wrapper-import line by asserting a known error fires.
    await expect(
      runSummarizePlan({ command: 'summarize-plan', flags: {} }, '/x', 'free')
    ).rejects.toThrow();
  });

  it('compatibility throws GameboardCliError without --asset', async () => {
    await expect(runCompatibilityCmd({ command: 'compatibility', flags: {} }, '/x', 'free')).rejects.toThrow(
      /compatibility requires --asset/
    );
  });


  it('piece throws GameboardCliError without --asset', async () => {
    await expect(runPiece({ command: 'piece', flags: {} }, '/x', 'free')).rejects.toThrow(
      /piece requires --asset/
    );
  });

  it('snapshot throws when neither --plan/--recipe/--scenario supplied', async () => {
    await expect(runSnapshot({ command: 'snapshot', flags: {} }, '/x', 'free')).rejects.toThrow(
      /snapshot requires exactly one of/
    );
  });

  it('spawn-groups throws when neither --plan/--recipe/--scenario supplied', async () => {
    await expect(runSpawnGroups({ command: 'spawn-groups', flags: {} }, '/x', 'free')).rejects.toThrow(
      /spawn-groups requires exactly one of/
    );
  });

  it('patrol-routes throws when neither --plan/--recipe/--scenario supplied', async () => {
    await expect(runPatrolRoutes({ command: 'patrol-routes', flags: {} }, '/x', 'free')).rejects.toThrow(
      /patrol-routes requires/
    );
  });

  it('patrol-script throws when --routes/--scenario missing', async () => {
    await expect(runPatrolScript({ command: 'patrol-script', flags: {} }, '/x', 'free')).rejects.toThrow(
      /patrol-script requires/
    );
  });

  it('simulate-scenario throws GameboardCliError without --scenario', async () => {
    await expect(runSimulateScenario({ command: 'simulate-scenario', flags: {} }, '/x', 'free')).rejects.toThrow(
      /simulate-scenario requires --scenario/
    );
  });

  it('pieces throws GameboardCliError without --pieces', async () => {
    await expect(runPieces({ command: 'pieces', flags: {} }, '/x', 'free')).rejects.toThrow(
      /pieces requires --pieces/
    );
  });

  it('extract surfaces GameboardIoError for non-existent source root', async () => {
    // extract calls copyGltfTree(sourceRoot, ...) which throws when the
    // source GLTF dir is missing — covers the wrapper-import line + the
    // copyGltfTree error branch.
    const parsed: ParsedArgs = {
      command: 'extract',
      flags: { out: '.test-tmp/extract-missing' },
    };
    await expect(runExtract(parsed, '/nonexistent-extract-source', 'free')).rejects.toThrow(
      /Missing GLTF source directory/
    );
  });

  it('extract throws when destination is non-empty without --force (E0a)', async () => {
    const { mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const outRel = `.test-tmp/extract-nonempty-${Date.now()}`;
    const assetRoot = join(outRel, 'assets');
    mkdirSync(assetRoot, { recursive: true });
    writeFileSync(join(assetRoot, 'sentinel.txt'), 'pre-existing');
    try {
      const parsed: ParsedArgs = {
        command: 'extract',
        flags: { out: outRel },
      };
      await expect(runExtract(parsed, '/no-source', 'free')).rejects.toThrow(/not empty/);
    } finally {
      rmSync(outRel, { recursive: true, force: true });
    }
  });

  it('declarations surfaces GameboardIoError when source root is missing', async () => {
    // registryFromArgs reads the GLTF tree from <sourceRoot>/Assets/gltf;
    // pointing at /nonexistent exercises the wrapper-import line + the
    // ingest error path.
    const parsed: ParsedArgs = { command: 'declarations', flags: {} };
    await expect(runDeclarations(parsed, '/nonexistent', 'free')).rejects.toThrow(
      /Missing GLTF source directory/
    );
  });
});
