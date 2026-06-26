/**
 * Direct-import coverage for the smaller CLI command modules (PRD E0h).
 *
 * The CLI dispatcher (cli.ts) lazy-imports per-subcommand modules; subprocess
 * CLI tests do not reliably register lazy module coverage. Direct
 * `import { run } from ...` calls do.
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
import { dirname, join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameboardCliError } from '../../errors';
import type { GameboardPlan } from '../../gameboard';
import { listKayKitGuideScenarios } from '../../scenario';
import type { ParsedArgs } from '../_shared';
import { run as runAnalyze } from '../commands/analyze';
import {
  blueprintPayloadFromInspection,
  createBlueprintScenarioInteropSnapshot,
  hasBlueprintScenarioContent,
  printBlueprintInspection,
  printBlueprintScenarioInspection,
  readBlueprintOptions,
  readBlueprintOptionsFile,
  run as runBlueprint,
  shouldEmitBlueprintInterop,
  shouldInspectBlueprintScenario,
} from '../commands/blueprint';
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

  it('reports existing sources and missing docs montage from a non-repo cwd', async () => {
    const previousCwd = process.cwd();
    const isolatedRoot = mkdtempSync(join(tmpdir(), 'hex-worlds-doctor-cwd-'));
    const sourceRoot = join(isolatedRoot, 'source');
    mkdirSync(sourceRoot);

    try {
      process.chdir(isolatedRoot);
      await runDoctor({ command: 'doctor', flags: {} }, sourceRoot, 'free');
    } finally {
      process.chdir(previousCwd);
      rmSync(isolatedRoot, { recursive: true, force: true });
    }

    const joined = logs.join('\n');
    expect(joined).toContain('source exists: yes');
    expect(joined).toContain('docs montage: missing');
  });

  it('delegates to the coverage command when --coverage is supplied', async () => {
    await runDoctor(
      {
        command: 'doctor',
        flags: {
          coverage: true,
          json: true,
          generatedAt: '2026-06-25T00:00:00.000Z',
          checksPassed: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );

    const report = JSON.parse(logs.join('\n')) as { schemaVersion: string; status: string };
    expect(report.schemaVersion).toBe('1.0.0');
    expect(report.status).toBeDefined();
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

function writeCommandGltfBounds(
  relativePath: string,
  min: [number, number, number],
  max: [number, number, number]
): string {
  const path = resolve(commandOutputRoot, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        asset: { version: '2.0' },
        accessors: [{ min, max }],
        buffers: [{ uri: 'fixture.bin', byteLength: 0 }],
        materials: [{ name: 'fixture_material' }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
      },
      null,
      2
    )}\n`
  );
  return path;
}

function writeSyntheticSourceRoot(name: string): string {
  writeCommandGltfBounds(`${name}/Assets/gltf/tiles/hex_fixture.gltf`, [-0.5, 0, -0.5], [0.5, 0.25, 0.5]);
  return resolve(commandOutputRoot, name);
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

function writeEmptyManifest(name: string): string {
  return writeCommandOutput(name, {
    schemaVersion: '1.0.0',
    edition: 'free',
    sourcePack: {
      name: 'Fixture',
      version: '1.0.0',
      creator: 'Fixture',
      license: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceRootName: 'fixture',
      edition: 'free',
    },
    textureSets: [],
    assets: [],
    assetsById: {},
    counts: { total: 0, byCategory: {}, bySubcategory: {} },
  });
}

function spawnGroupsCommandPlan(overrides: Partial<GameboardPlan> = {}): GameboardPlan {
  const tiles: GameboardPlan['tiles'] = [
    {
      key: '0,0',
      coordinates: { q: 0, r: 0 },
      terrain: 'grass',
      textureSet: 'default',
      elevation: 0,
      baseAssetId: 'fixture_grass',
      supportAssetId: 'fixture_grass',
      roadEdges: 0,
      riverEdges: 0,
      coastEdges: 0,
      riverWaterless: false,
      riverCurvy: false,
      coastWaterless: false,
      tags: [],
    },
    {
      key: '1,0',
      coordinates: { q: 1, r: 0 },
      terrain: 'grass',
      textureSet: 'default',
      elevation: 0,
      baseAssetId: 'fixture_grass',
      supportAssetId: 'fixture_grass',
      roadEdges: 0,
      riverEdges: 0,
      coastEdges: 0,
      riverWaterless: false,
      riverCurvy: false,
      coastWaterless: false,
      tags: [],
    },
  ];
  return {
    schemaVersion: '1.0.0',
    seed: 'spawn-groups-command',
    shape: { kind: 'rectangle', width: 2, height: 1 },
    textureSet: 'default',
    tiles,
    placements: [],
    warnings: [],
    ...overrides,
  };
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

describe('CLI source-root command branch coverage (PRD E0h)', () => {
  let logs: string[];
  let errors: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    errors = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation((message: unknown) => {
      errors.push(typeof message === 'string' ? message : String(message));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('prints a synthetic manifest to stdout when --out is omitted', async () => {
    const sourceRoot = writeSyntheticSourceRoot('manifest-stdout-source');

    await runManifest({ command: 'manifest', flags: {} }, sourceRoot, 'free');

    const manifest = JSON.parse(logs.join('\n')) as { edition: string; counts: { total: number } };
    expect(manifest.edition).toBe('free');
    expect(manifest.counts.total).toBe(1);
  });

  it('writes a synthetic manifest when --out is supplied', async () => {
    const sourceRoot = writeSyntheticSourceRoot('manifest-out-source');
    const previousOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    const out = 'manifest-out.json';
    process.env.HEX_WORLDS_OUT_ROOT = commandOutputRoot;

    try {
      await runManifest({ command: 'manifest', flags: { out } }, sourceRoot, 'free');
    } finally {
      if (previousOutRoot === undefined) {
        delete process.env.HEX_WORLDS_OUT_ROOT;
      } else {
        process.env.HEX_WORLDS_OUT_ROOT = previousOutRoot;
      }
    }

    expect(readCommandOutput<{ counts: { total: number } }>(out).counts.total).toBe(1);
    expect(logs).toEqual([`Wrote manifest to ${resolve(commandOutputRoot, out)}`]);
  });

  it('prints synthetic analysis JSON without reference assets', async () => {
    const sourceRoot = writeSyntheticSourceRoot('analyze-json-source');

    await runAnalyze({ command: 'analyze', flags: { json: true } }, sourceRoot, 'free');

    const analysis = JSON.parse(logs.join('\n')) as { tileCount: number; analyzedCount: number };
    expect(analysis.tileCount).toBe(1);
    expect(analysis.analyzedCount).toBe(1);
  });

  it('reports validate success for a complete synthetic source', async () => {
    const sourceRoot = resolve(commandOutputRoot, 'validate-success-source');
    for (let index = 0; index < 221; index += 1) {
      writeCommandGltfBounds(
        `validate-success-source/Assets/gltf/generated/fixture_${index}.gltf`,
        [-0.5, 0, -0.5],
        [0.5, 0.25, 0.5]
      );
    }

    await runValidate({ command: 'validate', flags: {} }, sourceRoot, 'free');

    expect(logs).toEqual(['Validated 221 free GLTF files.']);
  });

  it('reports validate count failures before exiting', async () => {
    const sourceRoot = writeSyntheticSourceRoot('validate-failure-source');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });

    try {
      await expect(runValidate({ command: 'validate', flags: {} }, sourceRoot, 'free')).rejects.toThrow(
        'process.exit 1'
      );
    } finally {
      exitSpy.mockRestore();
    }

    expect(errors).toEqual(['Expected 221 free GLTF files, found 1.']);
  });

  it('extracts a synthetic source using the default output folder when --out is omitted', async () => {
    const sourceRoot = writeSyntheticSourceRoot('extract-default-source');
    const previousOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = commandOutputRoot;
    const outputRoot = resolve(commandOutputRoot, 'kaykit-medieval-hexagon-free');
    rmSync(outputRoot, { recursive: true, force: true });

    try {
      await runExtract({ command: 'extract', flags: { force: true } }, sourceRoot, 'free');
      expect(existsSync(resolve(outputRoot, 'assets/tiles/hex_fixture.gltf'))).toBe(true);
      expect(readCommandOutput<{ counts: { total: number } }>('kaykit-medieval-hexagon-free/manifest.json').counts.total).toBe(1);
      expect(logs).toEqual([`Extracted 1 free assets to ${outputRoot}`]);
    } finally {
      rmSync(outputRoot, { recursive: true, force: true });
      if (previousOutRoot === undefined) {
        delete process.env.HEX_WORLDS_OUT_ROOT;
      } else {
        process.env.HEX_WORLDS_OUT_ROOT = previousOutRoot;
      }
    }
  });
});

describe('CLI validate-manifest command branch coverage (PRD E0h)', () => {
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

  it('prints readable empty-manifest summaries with the texture-set none fallback', async () => {
    const manifestPath = resolve(commandOutputRoot, writeEmptyManifest('empty-manifest.json'));

    await runValidateManifest(
      { command: 'validate-manifest', flags: { manifest: manifestPath } },
      '/nonexistent-source-root',
      'free'
    );

    const joined = logs.join('\n');
    expect(joined).toContain(`manifest: ${manifestPath}`);
    expect(joined).toContain('edition: free');
    expect(joined).toContain('assets: 0');
    expect(joined).toContain('texture sets: none');
    expect(joined).toContain('validation: 0 error(s), 0 warning(s)');
  });

  it('prints JSON manifest inspection output', async () => {
    const manifestPath = resolve(commandOutputRoot, writeEmptyManifest('empty-manifest-json.json'));

    await runValidateManifest(
      { command: 'validate-manifest', flags: { manifest: manifestPath, json: true } },
      '/nonexistent-source-root',
      'free'
    );

    const payload = JSON.parse(logs.join('\n')) as {
      manifest: string;
      errorCount: number;
      edition?: string;
      textureSets?: string[];
    };
    expect(payload).toMatchObject({
      manifest: manifestPath,
      errorCount: 0,
      edition: 'free',
      textureSets: [],
    });
  });

  it('prints readable manifest validation issues before exiting 1', async () => {
    const manifestPath = resolve(commandOutputRoot, writeCommandOutput('invalid-manifest-object.json', []));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });

    try {
      await expect(
        runValidateManifest(
          { command: 'validate-manifest', flags: { manifest: manifestPath } },
          '/nonexistent-source-root',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }

    const joined = logs.join('\n');
    expect(joined).toContain(`manifest: ${manifestPath}`);
    expect(joined).toContain('validation: 1 error(s), 0 warning(s)');
    expect(joined).toContain('error: manifest.object $ - Manifest must be a JSON object');
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

  it('guide API and role filters reject empty selections', async () => {
    await expect(
      runGuideApis(
        { command: 'guide-apis', flags: { publicApi: 'GameboardBuilder.missingApi' } },
        '/nonexistent',
        'free'
      )
    ).rejects.toThrow(/guide-apis selection did not match/);
    await expect(
      runGuideRoles(
        { command: 'guide-roles', flags: { role: 'missing-role' } },
        '/nonexistent',
        'free'
      )
    ).rejects.toThrow(/guide-roles selection did not match/);
  });

  it('guide-scenarios run() delegates to runGuideScenarios', async () => {
    const parsed: ParsedArgs = { command: 'guide-scenarios', flags: { json: true } };
    await runGuideScenarios(parsed, '/nonexistent', 'free');
    expect(logs.length).toBeGreaterThan(0);
  });

  it('covers guide scenario filters, missing assets, markdown stdout, and error exits', async () => {
    const previousOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    const stdoutChunks: string[] = [];
    let stdoutSpy: ReturnType<typeof vi.spyOn> | undefined;
    let exitSpy: ReturnType<typeof vi.spyOn> | undefined;
    let mutableAssetIds: string[] | undefined;
    let originalAssetIds: string[] | undefined;

    try {
      process.env.HEX_WORLDS_OUT_ROOT = commandOutputRoot;
      stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
        stdoutChunks.push(String(chunk));
        return true;
      });
      exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit ${code}`);
      });
      const roadScenario = listKayKitGuideScenarios().find(
        (scenario) => scenario.id === 'page-03-road-variations'
      );
      expect(roadScenario).toBeDefined();
      mutableAssetIds = roadScenario?.assetIds as unknown as string[];
      originalAssetIds = [...mutableAssetIds];
      mutableAssetIds.push('fixture_missing_treatment');

      logs = [];
      await runGuideScenarios(
        {
          command: 'guide-scenarios',
          flags: {
            scenarioId: 'page-03-road-variations',
            includeTreatments: true,
            json: true,
          },
        },
        '/nonexistent',
        'free'
      );
      const scenarioPayload = JSON.parse(logs.at(-1) ?? '{}') as {
        count: number;
        assetCounts: { checked: number };
        scenarioCoverage: unknown[];
      };
      expect(scenarioPayload).toMatchObject({ count: 1 });
      expect(scenarioPayload.assetCounts.checked).toBeGreaterThan(0);
      expect(scenarioPayload.scenarioCoverage).toHaveLength(1);

      const filterFlagSets: Array<Record<string, string | boolean>> = [
        { page: '3', json: true },
        { editionScope: 'free', json: true },
        { publicApi: 'GameboardBuilder.addRoadPath', json: true },
        { role: 'road-tile', json: true },
        { assetId: 'hex_road_A', json: true },
      ];
      for (const flags of filterFlagSets) {
        await runGuideScenarios({ command: 'guide-scenarios', flags }, '/nonexistent', 'free');
      }

      await runGuideScenarios(
        { command: 'guide-scenarios', flags: { page: '3', markdown: true } },
        '/nonexistent',
        'free'
      );
      expect(stdoutChunks.join('')).toContain('# Guide Scenario Coverage');

      await runGuideScenarios(
        {
          command: 'guide-scenarios',
          flags: { page: '3', out: commandOutputPath('guide-scenarios.page3.json') },
        },
        '/nonexistent',
        'free'
      );
      expect(readCommandOutput<{ count: number }>('guide-scenarios.page3.json')).toMatchObject({
        count: 1,
      });

      const manifestPath = resolve(
        commandOutputRoot,
        writeEmptyManifest('guide-scenarios-empty-manifest.json')
      );
      logs = [];
      await expect(
        runGuideScenarios(
          { command: 'guide-scenarios', flags: { page: '3', manifest: manifestPath } },
          '/nonexistent',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
      expect(logs.join('\n')).toContain('asset scope: free');
      expect(logs.join('\n')).toContain('missing assets:');
      expect(logs.join('\n')).toContain('  - hex_road_A');

      await expect(
        runGuideScenarios(
          {
            command: 'guide-scenarios',
            flags: { page: '3', manifest: manifestPath, markdown: true },
          },
          '/nonexistent',
          'free'
        )
      ).rejects.toThrow('process.exit 1');

      await expect(
        runGuideScenarios(
          { command: 'guide-scenarios', flags: { scenarioId: 'missing-scenario' } },
          '/nonexistent',
          'free'
        )
      ).rejects.toThrow(/guide-scenarios selection did not match/);
      await expect(
        runGuideScenarios(
          { command: 'guide-scenarios', flags: { assetScope: 'invalid' } },
          '/nonexistent',
          'free'
        )
      ).rejects.toThrow(/Unsupported guide scenario asset scope/);
    } finally {
      if (mutableAssetIds && originalAssetIds) {
        mutableAssetIds.splice(0, mutableAssetIds.length, ...originalAssetIds);
      }
      stdoutSpy?.mockRestore();
      exitSpy?.mockRestore();
      if (previousOutRoot === undefined) {
        delete process.env.HEX_WORLDS_OUT_ROOT;
      } else {
        process.env.HEX_WORLDS_OUT_ROOT = previousOutRoot;
      }
    }
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

  it('covers filtered guide output files and readable summaries', async () => {
    const previousOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = commandOutputRoot;
    try {
      await runGuideAssets(
        { command: 'guide-assets', flags: { role: 'prop', out: commandOutputPath('guide-assets.prop.json') } },
        '/nonexistent',
        'free'
      );
      await runGuideRoles(
        { command: 'guide-roles', flags: { role: 'prop', out: commandOutputPath('guide-roles.prop.json') } },
        '/nonexistent',
        'free'
      );
      await runGuideScenarios(
        {
          command: 'guide-scenarios',
          flags: { markdown: true, out: commandOutputPath('guide-scenarios.md') },
        },
        '/nonexistent',
        'free'
      );
      await runGuideUsages(
        {
          command: 'guide-usages',
          flags: {
            minimumEdition: 'free',
            role: 'prop',
            out: commandOutputPath('guide-usages.free-prop.json'),
          },
        },
        '/nonexistent',
        'free'
      );

      logs = [];
      await runGuideAssets({ command: 'guide-assets', flags: { role: 'prop' } }, '/nonexistent', 'free');
      await runGuideRoles({ command: 'guide-roles', flags: { role: 'prop' } }, '/nonexistent', 'free');
      await runGuideScenarios(
        { command: 'guide-scenarios', flags: { assetScope: 'all' } },
        '/nonexistent',
        'free'
      );
      await runGuideUsages(
        { command: 'guide-usages', flags: { minimumEdition: 'free', role: 'prop' } },
        '/nonexistent',
        'free'
      );
    } finally {
      if (previousOutRoot === undefined) {
        delete process.env.HEX_WORLDS_OUT_ROOT;
      } else {
        process.env.HEX_WORLDS_OUT_ROOT = previousOutRoot;
      }
    }

    const assets = readCommandOutput<{ count: number; selection: { roles: string[] }; assetIds: string[] }>(
      'guide-assets.prop.json'
    );
    const roles = readCommandOutput<{ count: number; selection: { roles: string[] }; selected: unknown }>(
      'guide-roles.prop.json'
    );
    const usages = readCommandOutput<{
      count: number;
      selection: { roles: string[]; minimumEdition?: string };
      assetIds: string[];
    }>('guide-usages.free-prop.json');
    const markdown = readFileSync(resolve(commandOutputRoot, 'guide-scenarios.md'), 'utf8');
    const joined = logs.join('\n');

    expect(assets.count).toBeGreaterThan(0);
    expect(assets.selection.roles).toEqual(['prop']);
    expect(roles).toMatchObject({ count: 1, selection: { roles: ['prop'] } });
    expect(roles.selected).toBeDefined();
    expect(usages.count).toBeGreaterThan(0);
    expect(usages.selection).toMatchObject({ roles: ['prop'], minimumEdition: 'free' });
    expect(usages.assetIds).toContain('barrel');
    expect(markdown).toContain('# Guide Scenario Coverage');
    expect(joined).toContain('guide assets:');
    expect(joined).toContain('guide public roles:');
    expect(joined).toContain('guide scenarios:');
    expect(joined).toContain('guide usage rows:');
  });

  it('covers guide API, permutation, and render request output paths', async () => {
    const previousOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = commandOutputRoot;
    try {
      await runGuideApis(
        {
          command: 'guide-apis',
          flags: {
            publicApi: 'GameboardBuilder.addHarbor',
            out: commandOutputPath('guide-apis.harbor.json'),
          },
        },
        '/nonexistent',
        'free'
      );
      await runGuidePermutations(
        {
          command: 'guide-permutations',
          flags: { out: commandOutputPath('guide-permutations.json') },
        },
        '/nonexistent',
        'free'
      );
      await runGuideRenderRequests(
        {
          command: 'guide-render-requests',
          flags: {
            minimumEdition: 'free',
            role: 'prop',
            includeGroups: true,
            assetBaseUrl: '/assets/free',
            out: commandOutputPath('guide-render-requests.free-prop.json'),
          },
        },
        '/nonexistent',
        'free'
      );

      logs = [];
      await runGuideApis(
        { command: 'guide-apis', flags: { publicApi: 'GameboardBuilder.addHarbor' } },
        '/nonexistent',
        'free'
      );
      await runGuideApis({ command: 'guide-apis', flags: {} }, '/nonexistent', 'free');
      await runGuidePermutations({ command: 'guide-permutations', flags: {} }, '/nonexistent', 'free');
      await runGuideRenderRequests(
        {
          command: 'guide-render-requests',
          flags: { minimumEdition: 'free', role: 'prop', assetBaseUrl: '/assets/free' },
        },
        '/nonexistent',
        'free'
      );
    } finally {
      if (previousOutRoot === undefined) {
        delete process.env.HEX_WORLDS_OUT_ROOT;
      } else {
        process.env.HEX_WORLDS_OUT_ROOT = previousOutRoot;
      }
    }

    const apis = readCommandOutput<{
      count: number;
      selection: { publicApis: string[] };
      selected: unknown;
    }>('guide-apis.harbor.json');
    const permutations = readCommandOutput<{ count: number; counts: Record<string, number> }>(
      'guide-permutations.json'
    );
    const renderRequests = readCommandOutput<{
      count: number;
      groupCount: number;
      render: { assetBaseUrl: string; urlResolvedCount: number };
      selection: { roles: string[]; minimumEdition?: string };
      assetIds: string[];
      groups: unknown[];
    }>('guide-render-requests.free-prop.json');
    const joined = logs.join('\n');

    expect(apis).toMatchObject({
      count: 1,
      selection: { publicApis: ['GameboardBuilder.addHarbor'] },
    });
    expect(apis.selected).toBeDefined();
    expect(permutations.count).toBeGreaterThan(0);
    expect(permutations.counts).toMatchObject({ road: expect.any(Number), coast: expect.any(Number) });
    expect(renderRequests.count).toBeGreaterThan(0);
    expect(renderRequests.groupCount).toBeGreaterThan(0);
    expect(renderRequests.groups.length).toBe(renderRequests.groupCount);
    expect(renderRequests.render).toMatchObject({
      assetBaseUrl: '/assets/free',
      urlResolvedCount: renderRequests.count,
    });
    expect(renderRequests.selection).toMatchObject({ roles: ['prop'], minimumEdition: 'free' });
    expect(renderRequests.assetIds).toContain('barrel');
    expect(joined).toContain('guide public APIs:');
    expect(joined).toMatch(/\.\.\.[0-9]+ more/);
    expect(joined).toContain('guide permutations:');
    expect(joined).toContain('guide render requests:');
  });

  it('reports missing guide permutation assets from a manifest before exiting', async () => {
    const manifestPath = resolve(commandOutputRoot, writeEmptyManifest('guide-permutations-empty-manifest.json'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });

    try {
      await expect(
        runGuidePermutations(
          {
            command: 'guide-permutations',
            flags: { manifest: manifestPath },
          },
          '/nonexistent',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }

    const joined = logs.join('\n');
    expect(joined).toContain('guide permutations: 298');
    expect(joined).toContain('missing assets:');
    expect(joined).toContain('  - hex_road_A');
  });
});

describe('CLI blueprint command branch coverage (PRD E0h)', () => {
  type BlueprintInspectionArg = Parameters<typeof blueprintPayloadFromInspection>[0];
  type ScenarioInspectionArg = NonNullable<Parameters<typeof blueprintPayloadFromInspection>[3]>;
  const asBlueprintOptions = (value: unknown): Parameters<typeof hasBlueprintScenarioContent>[0] =>
    value as Parameters<typeof hasBlueprintScenarioContent>[0];
  const blueprintInspectionFixture = (warnings = ['Fixture warning']): BlueprintInspectionArg =>
    ({
      plan: spawnGroupsCommandPlan({ seed: 'blueprint-fixture' }),
      recipe: { schemaVersion: '1.0.0', options: {}, steps: [{}] },
      counts: { towns: 1, harbors: 0 },
      warnings,
    }) as unknown as BlueprintInspectionArg;
  const scenarioInspectionFixture = (): ScenarioInspectionArg =>
    ({
      scenario: { id: 'fixture-scenario' },
      scenarioInspection: {
        violations: [
          { severity: 'error', code: 'scenario.error', message: 'error' },
          { severity: 'warning', code: 'scenario.warning', message: 'warning' },
        ],
      },
    }) as unknown as ScenarioInspectionArg;

  function captureConsoleLog(): { logs: string[]; restore: () => void } {
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    return { logs, restore: () => spy.mockRestore() };
  }

  it('reads blueprint config variants and CLI overrides', () => {
    const wrapped = resolve(commandOutputRoot, writeCommandOutput('bp-options.json', { options: { seed: 'wrapped' } }));
    const nested = resolve(commandOutputRoot, writeCommandOutput('bp-blueprint.json', { blueprint: { seed: 'nested' } }));
    const invalid = resolve(commandOutputRoot, writeCommandOutput('bp-invalid.json', ['bad']));
    expect(readBlueprintOptionsFile(wrapped)).toMatchObject({ seed: 'wrapped' });
    expect(() => readBlueprintOptionsFile(invalid)).toThrow(/must be an options object/);
    expect(
      readBlueprintOptions({
        config: nested,
        seed: 'cli',
        faction: 'red',
        textureSet: 'winter',
        defaultTerrain: 'water',
        waterFill: '0.25',
        maxElevation: '3',
        towns: '2',
        harbors: '1',
        shape: 'hexagon',
        radius: '0',
      })
    ).toMatchObject({
      seed: 'cli',
      faction: 'red',
      textureSet: 'winter',
      defaultTerrain: 'water',
      waterFill: 0.25,
      maxElevation: 3,
      towns: 2,
      harbors: 1,
      shape: { kind: 'hexagon', radius: 1 },
    });
    expect(readBlueprintOptions({ shape: 'rectangle', width: '0', height: '2.9' })).toMatchObject({
      shape: { kind: 'rectangle', width: 1, height: 2 },
    });
  });

  it('detects scenario and interop emission triggers', () => {
    expect(hasBlueprintScenarioContent(asBlueprintOptions({}))).toBe(false);
    for (const options of [
      { scenarioId: 'scenario' },
      { title: 'Title' },
      { spawnGroups: { groups: [] } },
      { patrolRoutes: [{}] },
      { actors: [{}] },
      { quests: [{}] },
      { scenarioMetadata: { source: 'fixture' } },
    ]) {
      expect(hasBlueprintScenarioContent(asBlueprintOptions(options))).toBe(true);
    }
    expect(shouldInspectBlueprintScenario(asBlueprintOptions({}), {})).toBe(false);
    for (const flags of [
      { outScenario: 'scenario.json' },
      { outScenarioInspection: 'scenario-inspection.json' },
      { outInterop: 'interop.json' },
      { includeScenario: true },
      { includeScenarioInspection: true },
      { includeInterop: true },
    ] satisfies Array<Record<string, string | boolean>>) {
      expect(shouldInspectBlueprintScenario(asBlueprintOptions({}), flags as unknown as Record<string, string | boolean>)).toBe(true);
    }
    expect(shouldEmitBlueprintInterop({})).toBe(false);
    expect(shouldEmitBlueprintInterop({ outInterop: 'interop.json' })).toBe(true);
    expect(shouldEmitBlueprintInterop({ includeInterop: true })).toBe(true);
  });

  it('summarizes payload, readable output, and missing interop guards', () => {
    const payload = blueprintPayloadFromInspection(
      blueprintInspectionFixture(),
      [
        { severity: 'error', code: 'plan.error', message: 'error' },
        { severity: 'warning', code: 'plan.warning', message: 'warning' },
      ] as unknown as Parameters<typeof blueprintPayloadFromInspection>[1],
      { includeRecipe: true, includePlan: true, includeScenario: true, includeScenarioInspection: true, includeInterop: true },
      scenarioInspectionFixture(),
      {
        entities: [{ kind: 'actor' }, { kind: 'quest' }, { kind: 'spawn-group' }, { kind: 'patrol-route' }],
        relations: [{ kind: 'rel' }],
        spawnLocations: [{ id: 'spawn:0' }],
      } as unknown as NonNullable<Parameters<typeof blueprintPayloadFromInspection>[4]>
    );
    expect(payload).toMatchObject({
      validation: { errorCount: 1, warningCount: 1 },
      scenarioValidation: { errorCount: 1, warningCount: 1 },
      interopSummary: { actorCount: 1, questCount: 1, spawnGroupCount: 1, patrolRouteCount: 1 },
    });
    const { logs, restore } = captureConsoleLog();
    try {
      printBlueprintInspection(blueprintInspectionFixture(), []);
      printBlueprintInspection(blueprintInspectionFixture([]), []);
      printBlueprintScenarioInspection(scenarioInspectionFixture());
    } finally {
      restore();
    }
    expect(logs.join('\n')).toContain('blueprint warnings: none');
    expect(() =>
      createBlueprintScenarioInteropSnapshot({ command: 'blueprint', flags: {} }, undefined)
    ).toThrow(/requires a generated blueprint scenario/);
  });

  it('prints JSON and exits for warning/error command outcomes', async () => {
    let capture = captureConsoleLog();
    try {
      await runBlueprint(
        { command: 'blueprint', flags: { seed: 'blueprint-json', shape: 'rectangle', width: '1', height: '1', json: true } },
        '/nonexistent-source-root',
        'free'
      );
      expect(JSON.parse(capture.logs.join('\n'))).toMatchObject({ seed: 'blueprint-json' });
    } finally {
      capture.restore();
    }

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });
    capture = captureConsoleLog();
    try {
      await expect(
        runBlueprint(
          { command: 'blueprint', flags: { shape: 'rectangle', width: '1', height: '1', harbors: '1', failOnWarning: true } },
          '/nonexistent-source-root',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
      expect(capture.logs.join('\n')).toContain('No harbor could be placed');
    } finally {
      capture.restore();
      exitSpy.mockRestore();
    }

    const configPath = resolve(
      commandOutputRoot,
      writeCommandOutput('blueprint-scenario-error.json', {
        blueprint: {
          seed: 'blueprint-scenario-error',
          shape: { kind: 'rectangle', width: 1, height: 1 },
          spawnGroups: { groups: [{ id: 'party', count: 999 }] },
        },
      })
    );
    const secondExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });
    capture = captureConsoleLog();
    try {
      await expect(
        runBlueprint({ command: 'blueprint', flags: { blueprint: configPath } }, '/nonexistent-source-root', 'free')
      ).rejects.toThrow('process.exit 1');
      expect(capture.logs.join('\n')).toContain('scenario.spawn_group');
    } finally {
      capture.restore();
      secondExitSpy.mockRestore();
    }
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

  it('covers summary and scenario command input variants', async () => {
    await runSummarizePlan(
      {
        command: 'summarize-plan',
        flags: {
          recipe: docsRecipePath,
          outPlan: commandOutputPath('summary-variants.recipe-plan.json'),
          out: commandOutputPath('summary-variants.recipe-summary.json'),
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runSummarizePlan(
      {
        command: 'summarize-plan',
        flags: {
          scenario: docsScenarioPath,
          json: true,
          topAssets: '1',
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runSummarizePlan(
      {
        command: 'summarize-plan',
        flags: {
          blueprint: blueprintPath,
          outPlan: commandOutputPath('summary-variants.blueprint-plan.json'),
          out: commandOutputPath('summary-variants.blueprint-summary.json'),
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
          json: true,
          outPlan: commandOutputPath('summary-variants.validate-scenario-plan.json'),
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
          json: true,
          outPlan: commandOutputPath('summary-variants.validate-simulation-plan.json'),
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
          json: true,
          topAssets: '1',
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runPatrolRoutes(
      {
        command: 'patrol-routes',
        flags: {
          scenario: docsScenarioPath,
          out: commandOutputPath('summary-variants.patrol-routes.json'),
        },
      },
      '/nonexistent-source-root',
      'free'
    );

    const recipeSummary = readCommandOutput<{ source: { kind: string }; validation: { errorCount: number } }>(
      'summary-variants.recipe-summary.json'
    );
    const blueprintSummary = readCommandOutput<{ source: { kind: string }; validation: { errorCount: number } }>(
      'summary-variants.blueprint-summary.json'
    );
    const patrolRoutes = readCommandOutput<{ routeCount: number; errors: unknown[] }>(
      'summary-variants.patrol-routes.json'
    );

    expect(recipeSummary).toMatchObject({ source: { kind: 'recipe' }, validation: { errorCount: 0 } });
    expect(blueprintSummary).toMatchObject({ source: { kind: 'blueprint' }, validation: { errorCount: 0 } });
    expect(existsSync(resolve(commandOutputRoot, 'summary-variants.recipe-plan.json'))).toBe(true);
    expect(existsSync(resolve(commandOutputRoot, 'summary-variants.blueprint-plan.json'))).toBe(true);
    expect(existsSync(resolve(commandOutputRoot, 'summary-variants.validate-scenario-plan.json'))).toBe(true);
    expect(existsSync(resolve(commandOutputRoot, 'summary-variants.validate-simulation-plan.json'))).toBe(true);
    expect(patrolRoutes.routeCount).toBeGreaterThan(0);
    expect(patrolRoutes.errors).toEqual([]);
  });

  it('prints readable scenario summaries and patrol route summaries', async () => {
    const logs: string[] = [];
    logSpy.mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });

    await runSummarizeScenario(
      {
        command: 'summarize-scenario',
        flags: {
          scenario: docsScenarioPath,
          topAssets: '2',
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runPatrolRoutes(
      {
        command: 'patrol-routes',
        flags: {
          scenario: docsScenarioPath,
        },
      },
      '/nonexistent-source-root',
      'free'
    );

    const joined = logs.join('\n');
    expect(joined).toContain(`source: scenario ${resolve(docsScenarioPath)}`);
    expect(joined).toContain('scenario: docs-simple-rpg-scenario');
    expect(joined).toContain('actor flags:');
    expect(joined).toContain('patrol routes:');
    expect(joined).toContain('patrol seed: docs-simple-rpg-scenario:patrol-routes');
    expect(joined).toContain('routes: 1');
    expect(joined).toContain('  - bandit-watch:');
    expect(joined).toContain('tiles:');
    expect(joined).toContain('path:');
  });

  it('covers patrol script assignment files, JSON output, and readable summaries', async () => {
    const routeSetPath = commandOutputPath('scenario-patrol-script.routes.json');
    await runPatrolRoutes(
      {
        command: 'patrol-routes',
        flags: {
          scenario: docsScenarioPath,
          out: routeSetPath,
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    const assignmentsPath = writeCommandOutput('scenario-patrol-script.assignments.json', {
      assignments: [{ routeId: 'bandit-watch', actorId: 'bandit' }],
    });
    const assignmentsArrayPath = writeCommandOutput('scenario-patrol-script.assignments-array.json', [
      { routeId: 'bandit-watch', actorId: 'bandit', rounds: 3 },
    ]);
    const logs: string[] = [];
    logSpy.mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });

    await runPatrolScript(
      {
        command: 'patrol-script',
        flags: {
          routes: resolve(commandOutputRoot, routeSetPath),
          assignments: resolve(commandOutputRoot, assignmentsPath),
          rounds: '2',
          includeReport: true,
          json: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runPatrolScript(
      {
        command: 'patrol-script',
        flags: {
          routes: resolve(commandOutputRoot, routeSetPath),
          assignments: resolve(commandOutputRoot, assignmentsArrayPath),
          includeReport: true,
          json: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runPatrolScript(
      {
        command: 'patrol-script',
        flags: {
          routes: resolve(commandOutputRoot, routeSetPath),
          routeId: 'bandit-watch',
          actorId: 'bandit',
          idPrefix: 'watch',
          rounds: '1',
        },
      },
      '/nonexistent-source-root',
      'free'
    );

    const joined = logs.join('\n');
    expect(joined).toContain('"stepCount"');
    expect(joined).toContain('"roundCount": 2');
    expect(joined).toContain('"roundCount": 3');
    expect(joined).toContain('patrol simulation steps:');
    expect(joined).toContain('assignments: 1');
    expect(joined).toContain('bandit -> bandit-watch:');
    expect(joined).toContain('warnings: 0');
    expect(joined).toContain('errors: 0');
  });

  it('reports patrol script warnings and errors before configured exits', async () => {
    const warningRouteSetPath = writeCommandOutput('scenario-patrol-script-warning-route-set.json', {
      routes: [{ id: 'empty-route', found: true, waypoints: [], segments: [] }],
    });
    const errorRouteSetPath = writeCommandOutput('scenario-patrol-script-error-route-set.json', {
      routes: [{ id: 'incomplete-route', found: false, waypoints: [], segments: [] }],
    });
    const exitLogs: string[] = [];
    logSpy.mockImplementation((message: unknown) => {
      exitLogs.push(typeof message === 'string' ? message : String(message));
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });

    try {
      await expect(
        runPatrolScript(
          {
            command: 'patrol-script',
            flags: {
              routes: resolve(commandOutputRoot, errorRouteSetPath),
              routeId: 'incomplete-route',
              actorId: 'bandit',
            },
          },
          '/nonexistent-source-root',
          'free'
        )
      ).rejects.toThrow('process.exit 1');

      exitLogs.length = 0;
      await expect(
        runPatrolScript(
          {
            command: 'patrol-script',
            flags: {
              routes: resolve(commandOutputRoot, warningRouteSetPath),
              routeId: 'empty-route',
              actorId: 'bandit',
              failOnWarning: true,
            },
          },
          '/nonexistent-source-root',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }

    const joined = exitLogs.join('\n');
    expect(joined).toContain('warning: Patrol route empty-route has no movement segments');
    expect(joined).toContain('warnings: 1');
    expect(joined).toContain('errors: 0');
  });

  it('rejects malformed scenario, patrol route, and assignment payloads', async () => {
    const badScenarioPath = writeCommandOutput('scenario-patrol-bad-scenario.json', []);
    const badAssignmentsPath = writeCommandOutput('scenario-patrol-bad-assignments.json', {
      assignments: 'not-array',
    });
    const routeSetPath = writeCommandOutput('scenario-patrol-empty-route-set.json', {
      routes: [{ id: 'empty-route', waypoints: [], segments: [] }],
    });

    await expect(
      runSummarizeScenario(
        { command: 'summarize-scenario', flags: { scenario: resolve(commandOutputRoot, badScenarioPath) } },
        '/x',
        'free'
      )
    ).rejects.toThrow(/must be a JSON object/);
    await expect(
      runPatrolRoutes(
        { command: 'patrol-routes', flags: { scenario: resolve(commandOutputRoot, badScenarioPath) } },
        '/x',
        'free'
      )
    ).rejects.toThrow(/must be a JSON object/);
    await expect(
      runPatrolScript(
        {
          command: 'patrol-script',
          flags: {
            scenario: resolve(commandOutputRoot, badScenarioPath),
            routeId: 'empty-route',
            actorId: 'actor',
          },
        },
        '/x',
        'free'
      )
    ).rejects.toThrow(/must be a JSON object/);
    await expect(
      runPatrolScript(
        {
          command: 'patrol-script',
          flags: {
            routes: resolve(commandOutputRoot, routeSetPath),
            assignments: resolve(commandOutputRoot, badAssignmentsPath),
          },
        },
        '/x',
        'free'
      )
    ).rejects.toThrow(/must be an array or/);
    await expect(
      runPatrolScript(
        { command: 'patrol-script', flags: { routes: resolve(commandOutputRoot, routeSetPath) } },
        '/x',
        'free'
      )
    ).rejects.toThrow(/patrol-script requires --assignments/);
  });

  it('scans local GLTF assets into piece registry rule output', async () => {
    const assetRoot = resolve(commandOutputRoot, 'piece-registry-assets');
    writeCommandGltfBounds(
      'piece-registry-assets/tower-hexagon-base.gltf',
      [-0.45, 0, -0.39],
      [0.45, 1.25, 0.39]
    );
    writeCommandGltfBounds(
      'piece-registry-assets/tree-large.gltf',
      [-0.22, 0, -0.18],
      [0.22, 1.6, 0.18]
    );
    const overridesPath = writeCommandOutput('piece-registry-overrides.json', {
      overrides: {
        'tower-hexagon-base': {
          footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
          criteria: { terrain: ['grass', 'road'], edgePadding: 1 },
          metadata: { placementPreset: 'tower-footprint' },
        },
        'tree-large': {
          criteria: { maxPerTile: 3, slotGroup: 'soft-feature' },
          tags: ['forest'],
        },
        missing: { tags: ['unused'] },
      },
    });
    const registryPath = commandOutputPath('piece-registry-output.json');
    await runPiecesFromAssets(
      {
        command: 'pieces-from-assets',
        flags: {
          assets: assetRoot,
          sourcePack: 'fixture-castle-kit',
          intendedRole: 'tile',
          assetIdPrefix: 'fixture',
          pieceIdPrefix: 'fixture-piece',
          tags: 'castle,test',
          pieceOverrides: resolve(commandOutputRoot, overridesPath),
          includeReports: true,
          out: registryPath,
        },
      },
      '/nonexistent-source-root',
      'free'
    );

    const sourceRootsPath = writeCommandOutput('piece-registry-source-roots.json', {
      sourceRoots: { 'fixture-castle-kit': '/fixture-assets' },
    });
    await runPieces(
      {
        command: 'pieces',
        flags: {
          pieces: resolve(commandOutputRoot, registryPath),
          role: 'landmark',
          emitRules: true,
          emitSourceUrls: true,
          pieceSourceRoots: resolve(commandOutputRoot, sourceRootsPath),
          count: '1',
          out: commandOutputPath('piece-registry-rules.json'),
        },
      },
      '/nonexistent-source-root',
      'free'
    );

    const registry = readCommandOutput<{
      assets: string[];
      sourceAssets: Array<{ id: string; relativePath: string; fileName: string }>;
      pieces: Array<{
        id: string;
        assetId: string;
        role: string;
        tags: string[];
        metadata: Record<string, unknown>;
      }>;
      summary: { assetCount: number; pieceRoles: Record<string, number>; overrideWarnings: string[] };
      reports: Array<{ suggestedRole: string; compatibleAsTile: boolean }>;
    }>('piece-registry-output.json');
    const rulesPayload = readCommandOutput<{
      rules: Array<{ assetId: string; count: number }>;
      sourceUrls: Record<string, string>;
    }>('piece-registry-rules.json');

    expect(registry.assets).toEqual(['tower-hexagon-base.gltf', 'tree-large.gltf']);
    expect(registry.sourceAssets.map((asset) => asset.id)).toEqual([
      'tower-hexagon-base',
      'tree-large',
    ]);
    expect(registry.summary).toMatchObject({
      assetCount: 2,
      pieceRoles: { tree: 1, landmark: 1 },
      overrideWarnings: ['Piece override missing did not match any scanned asset id'],
    });
    expect(registry.reports.every((report) => report.compatibleAsTile === false)).toBe(true);
    expect(
      registry.pieces.find((piece) => piece.id === 'fixture-piece:tower-hexagon-base')
    ).toMatchObject({
      assetId: 'fixture:tower-hexagon-base',
      role: 'landmark',
      tags: ['castle', 'test'],
      metadata: {
        placementPreset: 'tower-footprint',
        sourceRelativePath: 'tower-hexagon-base.gltf',
        sourceFileName: 'tower-hexagon-base.gltf',
        localAsset: true,
      },
    });
    expect(rulesPayload.rules).toHaveLength(1);
    expect(rulesPayload.rules[0]).toMatchObject({
      assetId: 'fixture:tower-hexagon-base',
      count: 1,
    });
    expect(rulesPayload.sourceUrls).toMatchObject({
      'fixture:tower-hexagon-base': '/fixture-assets/tower-hexagon-base.gltf',
      'fixture:tree-large': '/fixture-assets/tree-large.gltf',
    });
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

describe('CLI declaration and piece output paths (PRD E0h)', () => {
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

  it('emits declarations files and readable registry analysis from the packaged manifest', async () => {
    const previousOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = commandOutputRoot;
    try {
      await runDeclarations(
        {
          command: 'declarations',
          flags: {
            manifest: freeManifestPath,
            out: commandOutputPath('declarations.free.json'),
          },
        },
        '/nonexistent-source-root',
        'free'
      );
      await runDeclarations(
        { command: 'declarations', flags: { manifest: freeManifestPath } },
        '/nonexistent-source-root',
        'free'
      );
      await runAnalyze(
        { command: 'analyze', flags: { manifest: freeManifestPath } },
        '/nonexistent-source-root',
        'free'
      );
    } finally {
      if (previousOutRoot === undefined) {
        delete process.env.HEX_WORLDS_OUT_ROOT;
      } else {
        process.env.HEX_WORLDS_OUT_ROOT = previousOutRoot;
      }
    }

    const declarations = readCommandOutput<unknown[]>('declarations.free.json');
    const joined = logs.join('\n');
    expect(declarations.length).toBeGreaterThan(0);
    expect(joined).toContain('Wrote');
    expect(joined).toContain('tile declarations to');
    expect(joined).toContain('"assetId": "hex_grass"');
    expect(joined).toContain('tile declarations:');
    expect(joined).toContain('analyzed tile bounds:');
    expect(joined).toContain('warnings:');
  });

  it('prints compatibility reports and writes piece declarations for synthetic GLTF assets', async () => {
    const previousOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = commandOutputRoot;
    const asset = writeCommandGltfBounds(
      'declaration-piece-assets/camp-prop.gltf',
      [-0.2, 0, -0.2],
      [0.2, 0.65, 0.2]
    );
    try {
      await runCompatibilityCmd(
        {
          command: 'compatibility',
          flags: {
            asset,
            id: 'fixture:camp-prop',
            sourcePack: 'fixture-pack',
            creator: 'Fixture Creator',
            license: 'CC0-1.0',
            intendedRole: 'prop',
            modelForward: '-x',
            boardForwardEdge: '3',
          },
        },
        '/nonexistent-source-root',
        'free'
      );
      await runPiece(
        {
          command: 'piece',
          flags: {
            asset,
            id: 'fixture:camp-prop',
            pieceId: 'fixture-piece:camp-prop',
            sourcePack: 'fixture-pack',
            intendedRole: 'prop',
            modelForward: '-x',
            boardForwardEdge: '3',
            role: 'prop',
            tags: 'camp,fixture',
            includeReport: true,
            out: commandOutputPath('camp-prop.piece.json'),
          },
        },
        '/nonexistent-source-root',
        'free'
      );
    } finally {
      if (previousOutRoot === undefined) {
        delete process.env.HEX_WORLDS_OUT_ROOT;
      } else {
        process.env.HEX_WORLDS_OUT_ROOT = previousOutRoot;
      }
    }

    const payload = readCommandOutput<{
      declaration: { id: string; assetId: string; role: string; tags: string[] };
      report: { id: string; suggestedRole: string; placement: { modelForward: string } };
    }>('camp-prop.piece.json');
    const joined = logs.join('\n');
    expect(joined).toContain('asset: fixture:camp-prop');
    expect(joined).toContain('source pack: fixture-pack');
    expect(joined).toContain('suggested role: prop');
    expect(joined).toContain('model forward: -x');
    expect(joined).toContain('warnings:');
    expect(joined).toContain('needs non-uniform tile scaling');
    expect(joined).toContain('Wrote piece declaration to');
    expect(payload.declaration).toMatchObject({
      id: 'fixture-piece:camp-prop',
      assetId: 'fixture:camp-prop',
      role: 'prop',
      tags: ['camp', 'fixture'],
    });
    expect(payload.report).toMatchObject({
      id: 'fixture:camp-prop',
      suggestedRole: 'prop',
      placement: { modelForward: '-x' },
    });
  });

  it('prints synthetic compatibility JSON without reference assets', async () => {
    const asset = writeCommandGltfBounds(
      'compatibility-json-assets/camp-prop.gltf',
      [-0.2, 0, -0.2],
      [0.2, 0.65, 0.2]
    );

    await runCompatibilityCmd(
      {
        command: 'compatibility',
        flags: { asset, json: true },
      },
      '/nonexistent-source-root',
      'free'
    );

    const report = JSON.parse(logs.join('\n')) as { id: string; errors: unknown[] };
    expect(report.id).toBe('camp-prop');
    expect(report.errors).toEqual([]);
  });

  it('compatibility exits on warning when requested', async () => {
    const asset = writeCommandGltfBounds(
      'compatibility-warning-assets/wide-prop.gltf',
      [-0.25, 0, -0.1],
      [0.25, 0.5, 0.1]
    );
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });

    try {
      await expect(
        runCompatibilityCmd(
          {
            command: 'compatibility',
            flags: { asset, id: 'fixture:wide-prop', failOnWarning: true },
          },
          '/nonexistent-source-root',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }

    expect(logs.join('\n')).toContain('warnings:');
  });

  it('compatibility exits on invalid horizontal bounds', async () => {
    const asset = writeCommandGltfBounds(
      'compatibility-error-assets/flat-prop.gltf',
      [0, 0, 0],
      [0, 0.5, 0]
    );
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });

    try {
      await expect(
        runCompatibilityCmd(
          {
            command: 'compatibility',
            flags: { asset, id: 'fixture:flat-prop' },
          },
          '/nonexistent-source-root',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }

    expect(logs.join('\n')).toContain('errors:');
  });
});

describe('CLI readable command output variants (PRD E0h)', () => {
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;
  let previousReadableOutRoot: string | undefined;

  beforeEach(() => {
    previousReadableOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = commandOutputRoot;
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    if (previousReadableOutRoot === undefined) {
      delete process.env.HEX_WORLDS_OUT_ROOT;
    } else {
      process.env.HEX_WORLDS_OUT_ROOT = previousReadableOutRoot;
    }
  });

  it('prints readable validation, summary, spawn, layout, and piece reports', async () => {
    const prefix = 'readable-command-variants';
    const readableBlueprintPath = resolve(repoRoot, 'examples/blueprint-board.json');
    const planPath = commandOutputPath(`${prefix}.plan.json`);
    const scenarioPath = commandOutputPath(`${prefix}.scenario.json`);
    await runBlueprint(
      {
        command: 'blueprint',
        flags: {
          blueprint: readableBlueprintPath,
          outPlan: planPath,
          outScenario: scenarioPath,
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    const blueprint = JSON.parse(readFileSync(readableBlueprintPath, 'utf8')) as {
      spawnGroups: unknown;
    };
    const groupsPath = writeCommandOutput(`${prefix}.groups.json`, blueprint.spawnGroups);
    const layoutRulesPath = writeCommandOutput(`${prefix}.layout-rules.json`, {
      seed: `${prefix}-layout`,
      rules: [{ id: 'camp-fill', archetype: 'tree', assetId: 'tree_single_A', count: 1 }],
    });
    const piecesPath = writeCommandOutput(`${prefix}.pieces.json`, {
      pieces: [
        {
          id: 'camp-tree',
          assetId: 'tree_single_A',
          source: 'fixture pieces',
          role: 'tree',
          criteria: { terrain: ['grass', 'forest', 'hill'], allowOccupied: true },
        },
      ],
    });

    logs = [];
    await runSummarizePlan(
      {
        command: 'summarize-plan',
        flags: { plan: resolve(commandOutputRoot, planPath), topAssets: '2' },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runValidatePlan(
      {
        command: 'validate-plan',
        flags: {
          plan: resolve(commandOutputRoot, planPath),
          manifest: freeManifestPath,
          allowUnknownAssets: true,
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
          manifest: freeManifestPath,
          allowUnknownAssets: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runValidateScenario(
      {
        command: 'validate-scenario',
        flags: {
          scenario: resolve(commandOutputRoot, scenarioPath),
          manifest: freeManifestPath,
          allowUnknownAssets: true,
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
          manifest: freeManifestPath,
          allowUnknownAssets: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runSpawnGroups(
      {
        command: 'spawn-groups',
        flags: {
          plan: resolve(commandOutputRoot, planPath),
          groups: resolve(commandOutputRoot, groupsPath),
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runAnalyzeLayout(
      {
        command: 'analyze-layout',
        flags: {
          scenario: resolve(commandOutputRoot, scenarioPath),
          rules: resolve(commandOutputRoot, layoutRulesPath),
          allowUnknownAssets: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runPlacePiece(
      {
        command: 'place-piece',
        flags: {
          recipe: docsRecipePath,
          pieces: resolve(commandOutputRoot, piecesPath),
          pieceId: 'camp-tree',
          allowUnknownAssets: true,
          count: '1',
        },
      },
      '/nonexistent-source-root',
      'free'
    );

    const joined = logs.join('\n');
    expect(joined).toContain('source: plan');
    expect(joined).toContain('validation: 0 error(s)');
    expect(joined).toContain('scenario: docs-blueprint-board:intro');
    expect(joined).toContain('steps:');
    expect(joined).toContain('spawn seed:');
    expect(joined).toContain('groups:');
    expect(joined).toContain('layout seed: readable-command-variants-layout');
    expect(joined).toContain('candidate sites:');
    expect(joined).toContain('piece: camp-tree');
    expect(joined).toContain('placements: 1');
  });
});

describe('CLI snapshot and piece selection variants (PRD E0h)', () => {
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;
  let previousSnapshotOutRoot: string | undefined;

  beforeEach(() => {
    previousSnapshotOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = commandOutputRoot;
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    if (previousSnapshotOutRoot === undefined) {
      delete process.env.HEX_WORLDS_OUT_ROOT;
    } else {
      process.env.HEX_WORLDS_OUT_ROOT = previousSnapshotOutRoot;
    }
  });

  it('prints blueprint, snapshot, asset scan, and piece registry variants', async () => {
    const prefix = 'snapshot-piece-variants';
    const blueprintPath = resolve(repoRoot, 'examples/blueprint-board.json');
    const planPath = commandOutputPath(`${prefix}.plan.json`);
    const recipePath = commandOutputPath(`${prefix}.recipe.json`);
    await runBlueprint(
      {
        command: 'blueprint',
        flags: {
          blueprint: blueprintPath,
          outPlan: planPath,
          outRecipe: recipePath,
          includeScenario: true,
          includeScenarioInspection: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runSnapshot(
      {
        command: 'snapshot',
        flags: {
          plan: resolve(commandOutputRoot, planPath),
          excludePlacements: true,
          spawnCount: '2',
          spawnSeed: 'snapshot-spawns',
          spawnMinDistance: '1',
          spawnEdgePadding: '0',
          manifest: freeManifestPath,
          allowUnknownAssets: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runSnapshot(
      {
        command: 'snapshot',
        flags: {
          recipe: docsRecipePath,
          excludeActors: true,
          excludeQuests: true,
          excludeSpawnGroups: true,
          manifest: freeManifestPath,
          allowUnknownAssets: true,
          allowInvalid: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );

    const assetRoot = resolve(commandOutputRoot, 'snapshot-piece-assets');
    writeCommandGltfBounds(
      'snapshot-piece-assets/decor/standing-stone.gltf',
      [-0.35, 0, -0.35],
      [0.35, 1.1, 0.35]
    );
    writeCommandGltfBounds(
      'snapshot-piece-assets/trees/pine.gltf',
      [-0.25, 0, -0.2],
      [0.25, 1.5, 0.2]
    );
    const overridesPath = writeCommandOutput(`${prefix}.overrides.json`, {
      'decor/standing-stone': {
        role: 'landmark',
        tags: ['stone'],
        criteria: { terrain: ['grass'], allowOccupied: true },
      },
      missing: { tags: ['unused'] },
    });
    await runPiecesFromAssets(
      {
        command: 'pieces-from-assets',
        flags: {
          assets: assetRoot,
          sourcePack: 'fixture-pieces',
          overrides: resolve(commandOutputRoot, overridesPath),
          includeAbsolutePaths: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );

    const registryPath = writeCommandOutput(`${prefix}.registry.json`, {
      pieces: [
        {
          id: 'piece-tree',
          assetId: 'tree_single_A',
          source: 'fixture-pieces',
          role: 'tree',
          tags: ['forest'],
          criteria: { terrain: ['grass', 'forest', 'hill'], allowOccupied: true },
        },
        {
          id: 'piece-stone',
          assetId: 'stone_small_A',
          source: 'fixture-pieces',
          role: 'landmark',
          requiresExtra: true,
          tags: ['stone'],
          criteria: { terrain: ['grass'], allowOccupied: true },
        },
      ],
    });
    await runPieces(
      {
        command: 'pieces',
        flags: { pieces: resolve(commandOutputRoot, registryPath) },
      },
      '/nonexistent-source-root',
      'free'
    );
    await runPieces(
      {
        command: 'pieces',
        flags: {
          pieces: resolve(commandOutputRoot, registryPath),
          recipe: docsRecipePath,
          role: 'tree',
          tags: 'forest',
          mode: 'pool',
          count: '1',
          emitRules: true,
          emitSourceUrls: true,
          pieceSourceRoot: '/assets/pieces',
          outPlan: commandOutputPath(`${prefix}.piece-filled-plan.json`),
          manifest: freeManifestPath,
          allowUnknownAssets: true,
        },
      },
      '/nonexistent-source-root',
      'free'
    );

    const joined = logs.join('\n');
    expect(joined).toContain('blueprint seed: docs-blueprint-board');
    expect(joined).toContain('scenario: docs-blueprint-board:intro');
    expect(joined).toContain('"entities"');
    expect(joined).toContain('assets scanned: 2');
    expect(joined).toContain('override warnings:');
    expect(joined).toContain('pieces: 2');
    expect(joined).toContain('"checks"');
    expect(joined).toContain('"rules"');
    expect(joined).toContain('"sourceUrls"');
    expect(joined).toContain('Wrote piece-filled GameboardPlan to');
    expect(existsSync(resolve(commandOutputRoot, `${prefix}.piece-filled-plan.json`))).toBe(true);
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

  it('validate-plan prints validation errors before exiting 1', async () => {
    const planPath = writeCommandOutput('invalid-validate-plan.json', {
      schemaVersion: '1.0.0',
      seed: 'invalid-validate-plan',
      shape: { kind: 'rectangle', width: 1, height: 1 },
      textureSet: 'default',
      tiles: [
        {
          key: '0,0',
          coordinates: { q: 0, r: 0 },
          terrain: 'grass',
          textureSet: 'default',
          elevation: 5,
          baseAssetId: 'hex_grass',
          supportAssetId: 'hex_grass',
          roadEdges: 0,
          riverEdges: 0,
          coastEdges: 0,
          riverWaterless: false,
          riverCurvy: false,
          coastWaterless: false,
          tags: [],
        },
      ],
      placements: [],
      warnings: [],
    });
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });

    try {
      await expect(
        runValidatePlan(
          {
            command: 'validate-plan',
            flags: { plan: resolve(commandOutputRoot, planPath), allowUnknownAssets: true },
          },
          '/nonexistent-source-root',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      logSpy.mockRestore();
      exitSpy.mockRestore();
    }

    expect(logs[0]).toBe('validation: 1 error(s), 0 warning(s)');
    expect(logs.join('\n')).toContain('error: stack.max_elevation 0,0');
  });

  it('validate-recipe throws GameboardCliError without --recipe', async () => {
    await expect(runValidateRecipe({ command: 'validate-recipe', flags: {} }, '/x', 'free')).rejects.toThrow(
      /validate-recipe requires --recipe/
    );
  });

  it('validate-recipe reports recipe errors before exiting', async () => {
    const recipePath = writeCommandOutput('validate-recipe-invalid.recipe.json', {
      schemaVersion: '1.0.0',
      options: { seed: 'bad-recipe', shape: { kind: 'rectangle', width: 1, height: 1 } },
      steps: [{ action: 'setTerrain', at: { q: 3, r: 0 }, terrain: 'water' }],
    });
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });

    try {
      await expect(
        runValidateRecipe(
          {
            command: 'validate-recipe',
            flags: { recipe: resolve(commandOutputRoot, recipePath) },
          },
          '/nonexistent-source-root',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      logSpy.mockRestore();
      exitSpy.mockRestore();
    }

    expect(logs[0]).toBe('validation: 1 error(s), 0 warning(s)');
    expect(logs.join('\n')).toContain('error: recipe.compile_failed board');
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

  it('snapshot prints validation errors before exiting 1', async () => {
    const planPath = writeCommandOutput('invalid-snapshot-plan.json', {
      schemaVersion: '1.0.0',
      seed: 'invalid-snapshot-plan',
      shape: { kind: 'rectangle', width: 1, height: 1 },
      textureSet: 'default',
      tiles: [
        {
          key: '0,0',
          coordinates: { q: 0, r: 0 },
          terrain: 'grass',
          textureSet: 'default',
          elevation: 5,
          baseAssetId: 'hex_grass',
          supportAssetId: 'hex_grass',
          roadEdges: 0,
          riverEdges: 0,
          coastEdges: 0,
          riverWaterless: false,
          riverCurvy: false,
          coastWaterless: false,
          tags: [],
        },
      ],
      placements: [],
      warnings: [],
    });
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });

    try {
      await expect(
        runSnapshot(
          {
            command: 'snapshot',
            flags: { plan: resolve(commandOutputRoot, planPath), allowUnknownAssets: true },
          },
          '/nonexistent-source-root',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      logSpy.mockRestore();
      exitSpy.mockRestore();
    }

    expect(logs[0]).toBe('validation: 1 error(s), 0 warning(s)');
    expect(logs.join('\n')).toContain('error: stack.max_elevation 0,0');
  });

  it('snapshot rejects recipes that do not compile even when invalid plans are allowed', async () => {
    const recipePath = writeCommandOutput('snapshot-invalid.recipe.json', {
      schemaVersion: '1.0.0',
      options: { seed: 'snapshot-bad-recipe', shape: { kind: 'rectangle', width: 1, height: 1 } },
      steps: [{ action: 'setTerrain', at: { q: 3, r: 0 }, terrain: 'water' }],
    });

    await expect(
      runSnapshot(
        {
          command: 'snapshot',
          flags: { recipe: resolve(commandOutputRoot, recipePath), allowInvalid: true },
        },
        '/nonexistent-source-root',
        'free'
      )
    ).rejects.toThrow(/did not compile to a GameboardPlan/);
  });

  it('spawn-groups throws when neither --plan/--recipe/--scenario supplied', async () => {
    await expect(runSpawnGroups({ command: 'spawn-groups', flags: {} }, '/x', 'free')).rejects.toThrow(
      /spawn-groups requires exactly one of/
    );
  });

  it('spawn-groups throws when --groups is missing', async () => {
    await expect(
      runSpawnGroups({ command: 'spawn-groups', flags: { plan: 'fixture.plan.json' } }, '/x', 'free')
    ).rejects.toThrow(/spawn-groups requires --groups/);
  });

  it('spawn-groups prints JSON plans with seed overrides', async () => {
    const planPath = writeCommandOutput('spawn-groups-json.plan.json', spawnGroupsCommandPlan());
    const groupsPath = writeCommandOutput('spawn-groups-json.groups.json', [
      { id: 'party', count: 1 },
    ]);
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });

    try {
      await runSpawnGroups(
        {
          command: 'spawn-groups',
          flags: {
            plan: resolve(commandOutputRoot, planPath),
            groups: resolve(commandOutputRoot, groupsPath),
            seed: 'spawn-groups-json-seed',
            json: true,
          },
        },
        '/nonexistent-source-root',
        'free'
      );
    } finally {
      logSpy.mockRestore();
    }

    const plan = JSON.parse(logs.join('\n')) as { seed: string; selectedLocationCount: number };
    expect(plan).toMatchObject({ seed: 'spawn-groups-json-seed', selectedLocationCount: 1 });
  });

  it('spawn-groups prints validation errors before exiting', async () => {
    const basePlan = spawnGroupsCommandPlan();
    const invalidPlan = spawnGroupsCommandPlan({
      tiles: basePlan.tiles.map((tile, index) =>
        index === 0 ? { ...tile, terrain: 'water', elevation: 1 } : tile
      ),
    });
    const planPath = writeCommandOutput('spawn-groups-invalid.plan.json', invalidPlan);
    const groupsPath = writeCommandOutput('spawn-groups-invalid.groups.json', [
      { id: 'party', count: 1 },
    ]);
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });

    try {
      await expect(
        runSpawnGroups(
          {
            command: 'spawn-groups',
            flags: {
              plan: resolve(commandOutputRoot, planPath),
              groups: resolve(commandOutputRoot, groupsPath),
            },
          },
          '/nonexistent-source-root',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      logSpy.mockRestore();
      exitSpy.mockRestore();
    }

    expect(logs[0]).toBe('validation: 1 error(s), 0 warning(s)');
    expect(logs.join('\n')).toContain('error: stack.water_elevation 0,0');
  });

  it('spawn-groups exits when planning errors remain after printing', async () => {
    const planPath = writeCommandOutput('spawn-groups-errors.plan.json', spawnGroupsCommandPlan());
    const groupsPath = writeCommandOutput('spawn-groups-errors.groups.json', [
      { id: 'party', count: 3 },
    ]);
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });

    try {
      await expect(
        runSpawnGroups(
          {
            command: 'spawn-groups',
            flags: {
              plan: resolve(commandOutputRoot, planPath),
              groups: resolve(commandOutputRoot, groupsPath),
            },
          },
          '/nonexistent-source-root',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      logSpy.mockRestore();
      exitSpy.mockRestore();
    }

    expect(logs.join('\n')).toContain('error: Spawn group party selected 2/3 requested location(s)');
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
