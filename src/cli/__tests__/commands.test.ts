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

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParsedArgs } from '../_shared';
import { run as runAnalyze } from '../commands/analyze';
import { run as runCoverageCmd } from '../commands/coverage';
import { run as runDoctor } from '../commands/doctor';
import { run as runGuideApis } from '../commands/guide-apis';
import { run as runGuideAssets } from '../commands/guide-assets';
import { run as runGuidePermutations } from '../commands/guide-permutations';
import { run as runGuideRenderRequests } from '../commands/guide-render-requests';
import { run as runGuideRoles } from '../commands/guide-roles';
import { run as runGuideScenarios } from '../commands/guide-scenarios';
import { run as runGuideUsages } from '../commands/guide-usages';
import { run as runManifest } from '../commands/manifest';
import { run as runPlacePiece } from '../commands/place-piece';
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
const HAS_FREE_REFERENCES = existsSync(referenceFreeRoot);

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

  beforeEach(() => {
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
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
});
