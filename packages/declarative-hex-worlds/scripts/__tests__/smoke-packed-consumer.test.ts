import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  createPackedConsumerSmokeContext,
  isDirectRun,
  phase,
  runPackedConsumerSmoke,
  type PackedConsumerSmokeDependencies,
} from '../smoke-packed-consumer';
import { assert, COVERAGE_CLI_MAX_BUFFER_BYTES } from '../smoke/_shared';

describe('scripts/smoke-packed-consumer', () => {
  it('wraps successful phases with labelled logs', () => {
    const logs: string[] = [];

    phase(
      'setup',
      () => logs.push('inside'),
      (message) => logs.push(message)
    );

    expect(logs).toEqual(['========== phase: setup ==========', 'inside', 'phase setup PASSED']);
  });

  it('logs phase failures before rethrowing', () => {
    const logs: string[] = [];
    const errors: string[] = [];

    expect(() =>
      phase(
        'pack-install',
        () => {
          throw new Error('pack failed');
        },
        (message) => logs.push(message),
        (message) => errors.push(message)
      )
    ).toThrow('pack failed');

    expect(logs).toEqual(['========== phase: pack-install ==========']);
    expect(errors).toEqual(['phase pack-install FAILED: pack failed']);
  });

  it('logs non-Error phase failures by stringifying the thrown value', () => {
    const logs: string[] = [];
    const errors: string[] = [];
    let thrown: unknown;

    try {
      phase(
        'types-attestation',
        () => {
          throw 'types failed';
        },
        (message) => logs.push(message),
        (message) => errors.push(message)
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBe('types failed');
    expect(logs).toEqual(['========== phase: types-attestation ==========']);
    expect(errors).toEqual(['phase types-attestation FAILED: types failed']);
  });

  it('creates the shared temp-tree context from injected filesystem helpers', () => {
    const ctx = createPackedConsumerSmokeContext({
      workspaceRoot: '/repo',
      env: {},
      tmpdirImpl: () => '/tmp',
      mkdtempSyncImpl: (prefix) => `${prefix}abc123`,
    });

    expect(ctx).toEqual({
      workspaceRoot: '/repo',
      packageRoot: '/repo',
      tempRoot: '/tmp/medieval-hexagon-consumer-abc123',
      packRoot: '/tmp/medieval-hexagon-consumer-abc123/pack',
      appRoot: '/tmp/medieval-hexagon-consumer-abc123/app',
      keepTemp: false,
    });
  });

  it('creates the shared temp-tree context from default process and filesystem helpers', () => {
    const ctx = createPackedConsumerSmokeContext();

    try {
      expect(ctx.workspaceRoot).toBe(resolve(import.meta.dirname, '../..'));
      expect(ctx.packageRoot).toBe(ctx.workspaceRoot);
      expect(ctx.packRoot).toBe(`${ctx.tempRoot}/pack`);
      expect(ctx.appRoot).toBe(`${ctx.tempRoot}/app`);
      expect(ctx.keepTemp).toBe(process.env.HEX_WORLDS_KEEP_CONSUMER_SMOKE === '1');
    } finally {
      rmSync(ctx.tempRoot, { recursive: true, force: true });
    }
  });

  it('runs setup, both smoke phases, and cleanup in order', () => {
    const calls: string[] = [];
    const dependencies = smokeDependencies(calls);

    expect(runPackedConsumerSmoke(dependencies)).toBe(0);

    expect(calls).toEqual([
      'mkdir:/tmp/consumer-1/pack',
      'mkdir:/tmp/consumer-1/app',
      'pack:/tmp/consumer-1',
      'types:/tmp/consumer-1',
      'log:ALL PHASES PASSED',
      'rm:/tmp/consumer-1',
    ]);
  });

  it('returns a failing exit code while still cleaning up after a smoke failure', () => {
    const calls: string[] = [];
    const errors: string[] = [];
    const dependencies = smokeDependencies(calls, {
      error: (message) => errors.push(message),
      runPackInstallSmokeImpl: () => {
        throw new Error('install failed');
      },
    });

    expect(runPackedConsumerSmoke(dependencies)).toBe(1);

    expect(calls).toEqual([
      'mkdir:/tmp/consumer-1/pack',
      'mkdir:/tmp/consumer-1/app',
      'rm:/tmp/consumer-1',
    ]);
    expect(errors).toEqual(['phase pack-install FAILED: install failed']);
  });

  it('preserves the temp tree when the keep-temp env flag is set', () => {
    const calls: string[] = [];
    const dependencies = smokeDependencies(calls, {
      env: { HEX_WORLDS_KEEP_CONSUMER_SMOKE: '1' },
    });

    expect(runPackedConsumerSmoke(dependencies)).toBe(0);

    expect(calls).toContain('log:tempdir preserved at /tmp/consumer-1');
    expect(calls).not.toContain('rm:/tmp/consumer-1');
  });

  it('uses default runner dependencies while cleaning up setup failures', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      expect(
        runPackedConsumerSmoke({
          mkdirSyncImpl: () => {
            throw new Error('setup failed');
          },
        })
      ).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith('phase setup FAILED: setup failed');
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('uses default mkdir and cleanup helpers around an injected smoke failure', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      expect(
        runPackedConsumerSmoke({
          runPackInstallSmokeImpl: () => {
            throw new Error('pack failed');
          },
        })
      ).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith('phase pack-install FAILED: pack failed');
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('detects direct execution through injectable realpath inputs', () => {
    const scriptPath = '/repo/scripts/smoke-packed-consumer.ts';
    const moduleUrl = pathToFileURL(scriptPath).href;

    expect(isDirectRun(scriptPath, moduleUrl, (path) => path)).toBe(true);
    expect(isDirectRun('/repo/scripts/other.ts', moduleUrl, (path) => path)).toBe(false);
    expect(isDirectRun('', moduleUrl, (path) => path)).toBe(false);
    expect(isDirectRun('/missing.ts', moduleUrl, () => { throw new Error('missing'); })).toBe(
      false
    );
  });
});

describe('scripts/smoke/_shared', () => {
  it('exports the shared coverage buffer limit and assertion helper', () => {
    expect(COVERAGE_CLI_MAX_BUFFER_BYTES).toBe(64 * 1024 * 1024);
    expect(() => assert(true, 'ok')).not.toThrow();
    expect(() => assert(false, 'missing')).toThrow('missing');
  });
});

function smokeDependencies(
  calls: string[],
  overrides: Partial<PackedConsumerSmokeDependencies> = {}
): PackedConsumerSmokeDependencies {
  return {
    workspaceRoot: '/repo',
    env: {},
    tmpdirImpl: () => '/tmp',
    mkdtempSyncImpl: () => '/tmp/consumer-1',
    mkdirSyncImpl: (path) => calls.push(`mkdir:${path}`),
    rmSyncImpl: (path) => calls.push(`rm:${path}`),
    runPackInstallSmokeImpl: (ctx) => calls.push(`pack:${ctx.tempRoot}`),
    runTypesAttestationImpl: (ctx) => calls.push(`types:${ctx.tempRoot}`),
    log: (message) => {
      if (message === 'ALL PHASES PASSED' || message.startsWith('tempdir preserved')) {
        calls.push(`log:${message}`);
      }
    },
    error: () => undefined,
    ...overrides,
  };
}
