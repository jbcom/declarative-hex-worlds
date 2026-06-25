import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run as runSummarizeScenario } from '../commands/summarize-scenario';

const repoRoot = resolve(import.meta.dirname, '../../..');
const freeManifestPath = resolve(repoRoot, 'assets/free/manifest.json');

describe('summarize-scenario command branch gaps (PRD E0a/E0h)', () => {
  let root: string;
  let previousOutRoot: string | undefined;
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hex-worlds-summary-gaps-'));
    previousOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = root;
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    if (previousOutRoot === undefined) {
      delete process.env.HEX_WORLDS_OUT_ROOT;
    } else {
      process.env.HEX_WORLDS_OUT_ROOT = previousOutRoot;
    }
    rmSync(root, { recursive: true, force: true });
  });

  it('prints valid and allow-invalid readable summaries', async () => {
    await runSummarizeScenario(
      { command: 'summarize-scenario', flags: { scenario: writeScenario('valid.json', validScenario()) } },
      '/missing-source',
      'free'
    );
    await runSummarizeScenario(
      {
        command: 'summarize-scenario',
        flags: { scenario: writeScenario('invalid-readable.json', invalidScenario()), allowInvalid: true },
      },
      '/missing-source',
      'free'
    );

    const joined = logs.join('\n');
    expect(joined).toContain('title: Branch Gap Scenario');
    expect(joined).toContain('top actor assets: none');
    expect(joined).toContain('patrol routes: 0/0 found, 0 waypoint(s)');
    expect(joined).toContain('scenario: ');
    expect(joined).toContain('validation: 2 error(s), 0 warning(s)');
  });

  it('exits on validation errors and failOnWarning summaries', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });
    try {
      await expect(
        runSummarizeScenario(
          { command: 'summarize-scenario', flags: { scenario: writeScenario('invalid-exit.json', invalidScenario()) } },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
      await expect(
        runSummarizeScenario(
          {
            command: 'summarize-scenario',
            flags: {
              scenario: writeScenario('warning.json', warningScenario()),
              manifest: freeManifestPath,
              failOnWarning: true,
              json: true,
            },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }

    const joined = logs.join('\n');
    expect(joined).toContain('error: scenario.id');
    expect(joined).toContain('scenario.actor_extra_flag_unnecessary');
  });

  function writeScenario(name: string, scenario: unknown): string {
    const path = resolve(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(scenario, null, 2)}\n`, 'utf8');
    return path;
  }

  function validScenario(): unknown {
    return {
      schemaVersion: '1.0.0',
      id: 'branch-gap',
      title: 'Branch Gap Scenario',
      board: boardRecipe('branch-gap'),
    };
  }

  function invalidScenario(): unknown {
    return {
      schemaVersion: '1.0.0',
      id: '',
      board: {
        schemaVersion: '1.0.0',
        options: { seed: 'bad', shape: { kind: 'rectangle', width: 1, height: 1 } },
        steps: [{ action: 'setTerrain', at: { q: 3, r: 0 }, terrain: 'water' }],
      },
    };
  }

  function warningScenario(): unknown {
    return {
      schemaVersion: '1.0.0',
      id: 'warning-scenario',
      board: boardRecipe('warning-scenario'),
      actors: [
        {
          actorId: 'flag',
          actorKind: 'fixture',
          at: '0,0',
          assetId: 'flag_blue',
          kind: 'unit',
          requiresExtra: true,
        },
      ],
    };
  }

  function boardRecipe(seed: string): unknown {
    return {
      schemaVersion: '1.0.0',
      options: { seed, shape: { kind: 'rectangle', width: 1, height: 1 } },
      steps: [],
    };
  }
});
