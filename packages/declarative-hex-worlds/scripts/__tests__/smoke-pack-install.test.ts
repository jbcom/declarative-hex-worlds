import { describe, expect, it } from 'vitest';

import {
  createPackedConsumerPackageJson,
  PACKED_CONSUMER_TEMP_WRITE_OPTIONS,
  runPackInstallSmoke,
  type PackInstallSmokeDependencies,
} from '../smoke/pack-install';

describe('scripts/smoke/pack-install', () => {
  it('builds the packed consumer package manifest', () => {
    const manifest = JSON.parse(createPackedConsumerPackageJson('/tmp/pkg.tgz')) as {
      private: boolean;
      type: string;
      dependencies: Record<string, string>;
    };

    expect(manifest).toEqual({
      private: true,
      type: 'module',
      dependencies: {
        'declarative-hex-worlds': 'file:/tmp/pkg.tgz',
        '@types/react': '^19.0.0',
        koota: '^0.6.6',
        react: '^19.0.0',
        three: '^0.184.0',
      },
    });
    expect(createPackedConsumerPackageJson('/tmp/pkg.tgz')).toMatch(/\n$/);
    expect(PACKED_CONSUMER_TEMP_WRITE_OPTIONS).toEqual({
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
  });

  it('runs the packed install smoke flow through injected helpers', () => {
    const ctx = fakeContext();
    const installedRoot = `${ctx.appRoot}/node_modules/declarative-hex-worlds`;
    const existing = fakeExistingPaths(installedRoot);
    const copied: string[] = [];
    const logs: string[] = [];
    const writes: Array<{ path: string; data: string }> = [];

    const dependencies: PackInstallSmokeDependencies = {
      existsSyncImpl: (path) => existing.has(path),
      copyFileSyncImpl: (src, dest) => copied.push(`${src}->${dest}`),
      writeFileSyncImpl: (path, data, options) => {
        expect(options).toEqual(PACKED_CONSUMER_TEMP_WRITE_OPTIONS);
        writes.push({ path, data });
      },
      execFileSyncImpl: (file, args) => fakeExec(file, args, installedRoot),
      log: (message) => logs.push(message),
    };

    runPackInstallSmoke(ctx, dependencies);

    expect(copied).toEqual([
      '/repo/tests/integration/simple-rpg/fixtures/simple-rpg-scenario.json->/tmp/consumer/app/simple-rpg-scenario.json',
      '/repo/tests/integration/simple-rpg/fixtures/simple-rpg-simulation.script.json->/tmp/consumer/app/simple-rpg-simulation.script.json',
    ]);
    expect(writes.map((write) => write.path)).toEqual([
      '/tmp/consumer/app/package.json',
      '/tmp/consumer/app/smoke.mjs',
    ]);
    expect(JSON.parse(writes[0]?.data ?? '{}')).toMatchObject({
      dependencies: { 'declarative-hex-worlds': 'file:/tmp/consumer/pack/pkg.tgz' },
    });
    expect(writes[1]?.data).toContain('packed public subpath imports failed');
    expect(writes[1]?.data).toContain("from 'declarative-hex-worlds/runtime'");
    expect(writes[1]?.data).not.toContain("from 'declarative-hex-worlds/examples/simple-rpg-usage'");
    expect(logs).toEqual(['packed consumer runtime smoke passed']);
  });

  it('rejects malformed JSON command payloads before property access', () => {
    const ctx = fakeContext();
    const installedRoot = `${ctx.appRoot}/node_modules/declarative-hex-worlds`;
    const cases: Array<[Partial<FakePayloads>, string]> = [
      [{ pack: '{}' }, 'npm pack did not return an array of tarball metadata'],
      [{ pack: '[]' }, 'npm pack did not return any tarball metadata'],
      [{ guideUsage: '[]' }, 'packed CLI guide-usages command did not return a valid JSON object'],
      [{ planSummary: '[]' }, 'packed CLI summarize-plan command did not return a valid JSON object'],
      [
        {
          planSummary: JSON.stringify({
            source: { kind: 'scenario' },
            validation: { errorCount: 0 },
            summary: { tileCount: 1, placementCount: 1, placementKindCounts: {} },
          }),
        },
        'packed CLI summarize-plan command did not emit scenario board counts',
      ],
      [{ scenarioSummary: '[]' }, 'packed CLI summarize-scenario command did not return a valid JSON object'],
      [
        {
          scenarioSummary: JSON.stringify({
            scenarioId: 'docs-simple-rpg-scenario',
            validation: { errorCount: 0 },
            actorCount: 1,
            questCount: 1,
            objectiveCount: 1,
            actorKindCounts: {},
          }),
        },
        'packed CLI summarize-scenario command did not emit playable scenario counts',
      ],
      [{ coverage: '[]' }, 'packed CLI coverage command did not return a valid JSON object'],
      [
        { coverage: JSON.stringify({ simpleRpgEvidence: { publicApiExercises: null } }) },
        'packed CLI coverage command did not emit the SimpleRPG public API exercise matrix',
      ],
    ];

    for (const [payloads, message] of cases) {
      expect(() =>
        runPackInstallSmoke(ctx, {
          existsSyncImpl: (path) => fakeExistingPaths(installedRoot).has(path),
          copyFileSyncImpl: () => undefined,
          writeFileSyncImpl: () => undefined,
          execFileSyncImpl: (file, args) => fakeExec(file, args, installedRoot, payloads),
        })
      ).toThrow(message);
    }
  });

  it('logs the retained temporary app root when requested', () => {
    const ctx = { ...fakeContext(), keepTemp: true };
    const installedRoot = `${ctx.appRoot}/node_modules/declarative-hex-worlds`;
    const logs: string[] = [];

    runPackInstallSmoke(ctx, {
      existsSyncImpl: (path) => fakeExistingPaths(installedRoot).has(path),
      copyFileSyncImpl: () => undefined,
      writeFileSyncImpl: () => undefined,
      execFileSyncImpl: (file, args) => fakeExec(file, args, installedRoot),
      log: (message) => logs.push(message),
    });

    expect(logs).toEqual(['packed consumer runtime smoke passed in /tmp/consumer/app']);
  });
});

interface FakePayloads { pack: string; guideUsage: string; planSummary: string; scenarioSummary: string; coverage: string; }

function fakeContext() {
  return { workspaceRoot: '/repo', packageRoot: '/repo', tempRoot: '/tmp/consumer', packRoot: '/tmp/consumer/pack', appRoot: '/tmp/consumer/app', keepTemp: false };
}

function fakeExistingPaths(installedRoot: string): Set<string> {
  return new Set(['/repo/dist/index.js', '/repo/dist/examples/blueprint-board-usage.js', '/repo/dist/cli.js', '/tmp/consumer/pack/pkg.tgz', `${installedRoot}/dist/examples/blueprint-board-usage.js`, `${installedRoot}/examples/blueprint-board.json`]);
}

function fakeExec(
  file: string,
  args: string[],
  installedRoot: string,
  payloads: Partial<FakePayloads> = {}
): string {
  if (file === 'npm' && args[0] === 'pack') {
    return payloads.pack ?? JSON.stringify([{ filename: 'pkg.tgz' }]);
  }
  if (file === 'npm' && args[0] === 'install') {
    return '';
  }
  if (file === process.execPath && args[1] === 'guide-usages') {
    return payloads.guideUsage ?? JSON.stringify({
      count: 137,
      occurrenceCounts: { extra: 137, scenarios: 1, pages: 1 },
      assetIds: ['unit_blue_full'],
    });
  }
  if (file === process.execPath && args[1] === 'summarize-plan') {
    return payloads.planSummary ?? JSON.stringify({
      source: { kind: 'scenario' },
      validation: { errorCount: 0 },
      summary: { tileCount: 1, placementCount: 1, placementKindCounts: { terrain: 1 } },
    });
  }
  if (file === process.execPath && args[1] === 'summarize-scenario') {
    return payloads.scenarioSummary ?? JSON.stringify({
      scenarioId: 'docs-simple-rpg-scenario',
      validation: { errorCount: 0 },
      actorCount: 1,
      questCount: 1,
      objectiveCount: 1,
      actorKindCounts: { player: 1 },
    });
  }
  if (file === process.execPath && args[1] === 'coverage' && args.includes('--json')) {
    return payloads.coverage ?? JSON.stringify({
      simpleRpgEvidence: {
        publicApiExercises: [
          {
            publicApi: 'GameboardBuilder.addBridge',
            assetCount: 2,
            modes: ['visual-coverage'],
            pages: [2, 7, 9],
          },
          ...Array.from({ length: 73 }, (_value, index) => ({
            publicApi: `packed-api-${index}`,
            assetCount: 0,
            modes: [],
            pages: [],
          })),
        ],
      },
    });
  }
  if (file === process.execPath && args[1] === 'coverage' && args.includes('--markdown')) {
    return [
      '### SimpleRPG Exercise Matrix',
      '| `GameboardBuilder.addBridge` | fixed-gameplay, visual-coverage | 2, 7, 9 | 2 |',
    ].join('\n');
  }
  if (file === process.execPath && args[0] === 'smoke.mjs') {
    return [
      '"blueprintUsageScenarioId": "docs-blueprint-board:intro"',
      '"defaultRpgHandlers": 3',
    ].join('\n');
  }
  if (file === '/tmp/consumer/app/node_modules/.bin/declarative-hex-worlds') {
    return fakeDoctor(args);
  }
  throw new Error(`unexpected exec: ${file} ${args.join(' ')} from ${installedRoot}`);
}

function fakeDoctor(args: string[]): string {
  if (args.includes('--coverage')) {
    return [
      'coverage status: passed',
      'guide pages: 19/19',
      'public APIs: 74',
      'manifest: 221 asset(s), 221/221 FREE guide asset(s)',
      'visual artifacts: 10 available, 0 missing,',
      'local references: 0 available, 0 missing,',
      'SimpleRPG API evidence: 74/74 represented, 40 directly executed, 9 active mode(s)',
      'gaps: 0',
    ].join('\n');
  }
  return 'source exists: no';
}
