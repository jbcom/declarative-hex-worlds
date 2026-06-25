import { describe, expect, it } from 'vitest';

import {
  createPackedConsumerSmokeContext,
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
