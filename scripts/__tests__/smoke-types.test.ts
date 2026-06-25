import { describe, expect, it } from 'vitest';

import {
  createTypesAttestationSource,
  runTypesAttestation,
  type TypesAttestationDependencies,
} from '../smoke/types';
import type { SmokeContext } from '../smoke/_shared';

describe('scripts/smoke/types', () => {
  it('builds a type attestation source for the public package surface', () => {
    const source = createTypesAttestationSource();

    expect(source).toContain("from 'declarative-hex-worlds';");
    expect(source).toContain("from 'declarative-hex-worlds/react';");
    expect(source).toContain("from 'declarative-hex-worlds/bootstrap/upstream-layout';");
    expect(source).toContain("from 'declarative-hex-worlds/assets/free/manifest.json'");
    expect(source).toContain('const runtimeActor = runtime.spawnActor({');
    expect(source).toContain('void blueprintUsage;');
    expect(source).not.toContain('declarative-hex-worlds/examples/simple-rpg-usage');
  });

  it('writes smoke-types.ts and invokes the workspace TypeScript compiler', () => {
    const calls: unknown[] = [];

    runTypesAttestation(smokeContext(), dependencies(calls));

    const [writeCall, execCall, logCall] = calls;
    expect(writeCall).toEqual({
      kind: 'write',
      path: '/tmp/app/smoke-types.ts',
      options: { encoding: 'utf8', mode: 0o600, flag: 'wx' },
      hasReactHook: true,
    });
    expect(execCall).toEqual({
      kind: 'exec',
      file: process.execPath,
      args: [
        '/repo/node_modules/typescript/bin/tsc',
        '--noEmit',
        '--strict',
        '--target',
        'ES2022',
        '--module',
        'NodeNext',
        '--moduleResolution',
        'NodeNext',
        '--resolveJsonModule',
        '--skipLibCheck',
        'smoke-types.ts',
      ],
      options: {
        cwd: '/tmp/app',
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    });
    expect(logCall).toEqual({
      kind: 'log',
      message: 'packed consumer types attestation passed',
    });
  });

  it('propagates compiler failures without logging success', () => {
    const calls: unknown[] = [];

    expect(() =>
      runTypesAttestation(
        smokeContext(),
        dependencies(calls, {
          execFileSyncImpl: () => {
            throw new Error('tsc failed');
          },
        })
      )
    ).toThrow('tsc failed');

    expect(calls).toEqual([
      {
        kind: 'write',
        path: '/tmp/app/smoke-types.ts',
        options: { encoding: 'utf8', mode: 0o600, flag: 'wx' },
        hasReactHook: true,
      },
    ]);
  });
});

function smokeContext(): SmokeContext {
  return {
    workspaceRoot: '/repo',
    packageRoot: '/repo',
    tempRoot: '/tmp/smoke',
    packRoot: '/tmp/smoke/pack',
    appRoot: '/tmp/app',
    keepTemp: false,
  };
}

function dependencies(
  calls: unknown[],
  overrides: Partial<TypesAttestationDependencies> = {}
): TypesAttestationDependencies {
  return {
    writeFileSyncImpl: (path, data, options) => {
      calls.push({
        kind: 'write',
        path,
        options,
        hasReactHook: data.includes('useGameboardRuntimeSnapshot'),
      });
    },
    execFileSyncImpl: (file, args, options) => {
      calls.push({ kind: 'exec', file, args, options });
      return '';
    },
    log: (message) => calls.push({ kind: 'log', message }),
    ...overrides,
  };
}
