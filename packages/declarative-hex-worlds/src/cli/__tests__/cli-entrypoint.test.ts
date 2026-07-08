import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMMANDS } from '../usage';

type RawArgsContext = {
  rawArgs?: string[];
};

type EntrypointCommand = {
  subCommands?: Record<
    string,
    () => Promise<{ run: (ctx: RawArgsContext) => Promise<void> | void }>
  >;
};

const commandModuleIds = [
  'doctor',
  'validate',
  'manifest',
  'validate-manifest',
  'analyze',
  'declarations',
  'guide-permutations',
  'guide-scenarios',
  'guide-usages',
  'guide-render-requests',
  'guide-apis',
  'guide-assets',
  'guide-roles',
  'coverage',
  'blueprint',
  'summarize-plan',
  'summarize-scenario',
  'validate-plan',
  'analyze-layout',
  'spawn-groups',
  'patrol-routes',
  'patrol-script',
  'validate-recipe',
  'validate-scenario',
  'validate-simulation',
  'snapshot',
  'simulate-scenario',
  'compatibility',
  'piece',
  'pieces-from-assets',
  'bind',
  'init',
  'pieces',
  'place-piece',
  'extract',
  'bootstrap',
] as const;

// Subcommand names that route to a module already listed above. Driving the
// full citty map therefore invokes `commandModuleIds.length + aliasCount`
// run() calls even though only `commandModuleIds.length` modules exist.
//
// Derived from `usage.ts`'s `COMMANDS` metadata (the same source of truth
// `cli.ts`'s `SUBCOMMAND_LOADERS` is checked against in `usage.test.ts`)
// rather than hardcoded here, so a future alias can't silently desync this
// call-count assertion from the real alias set.
const commandAliases = COMMANDS.flatMap((command) =>
  (command.aliases ?? []).map((alias) => ({ alias, target: command.name }))
);

const originalArgv = process.argv;
const originalDebug = process.env.HEX_WORLDS_DEBUG;

afterEach(() => {
  process.argv = originalArgv;
  if (originalDebug === undefined) {
    delete process.env.HEX_WORLDS_DEBUG;
  } else {
    process.env.HEX_WORLDS_DEBUG = originalDebug;
  }
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('CLI entrypoint dispatcher', () => {
  it.each([
    { label: 'no args', argv: [] },
    { label: '--help', argv: ['--help'] },
    { label: '-h', argv: ['-h'] },
    { label: 'help', argv: ['help'] },
  ])('preserves curated usage for $label', async ({ argv }) => {
    const mocks = await importEntrypoint(argv);

    expect(mocks.usageMock).toHaveBeenCalledWith(0);
    expect(mocks.runMainMock).not.toHaveBeenCalled();
    expect(mocks.exitSpy).not.toHaveBeenCalled();
  });

  it.each([
    { label: '--help', flag: '--help' },
    { label: '-h', flag: '-h' },
  ])('intercepts `<command> $label` with per-command usage instead of dispatching', async ({
    flag,
  }) => {
    const mocks = await importEntrypoint(['bootstrap', flag]);

    expect(mocks.commandUsageMock).toHaveBeenCalledWith('bootstrap', 0);
    expect(mocks.usageMock).not.toHaveBeenCalled();
    expect(mocks.runMainMock).not.toHaveBeenCalled();
    expect(mocks.exitSpy).not.toHaveBeenCalled();
  });

  it('intercepts `--help` anywhere after the command name, not just immediately after it', async () => {
    const mocks = await importEntrypoint(['bootstrap', '--force', '--help']);

    expect(mocks.commandUsageMock).toHaveBeenCalledWith('bootstrap', 0);
    expect(mocks.runMainMock).not.toHaveBeenCalled();
  });

  it('intercepts `bootstrap -h` as a standalone help flag', async () => {
    const mocks = await importEntrypoint(['bootstrap', '-h']);

    expect(mocks.commandUsageMock).toHaveBeenCalledWith('bootstrap', 0);
    expect(mocks.runMainMock).not.toHaveBeenCalled();
  });

  it('does not intercept `-h` when it is the VALUE of a preceding flag, and dispatches normally', async () => {
    const mocks = await importEntrypoint(['guide-assets', '--assetId', '-h'], {
      runMainImpl: async () => {},
    });

    expect(mocks.commandUsageMock).not.toHaveBeenCalled();
    expect(mocks.usageMock).not.toHaveBeenCalled();
    expect(mocks.runMainMock).toHaveBeenCalledWith(
      expect.objectContaining({ subCommands: expect.any(Object) }),
      { rawArgs: ['guide-assets', '--assetId', '-h'] }
    );
  });

  it('does not intercept `-h` when it follows any --flag token (matches parseFlags value semantics)', async () => {
    const mocks = await importEntrypoint(['bootstrap', '--force', '-h'], {
      runMainImpl: async () => {},
    });

    expect(mocks.commandUsageMock).not.toHaveBeenCalled();
    expect(mocks.runMainMock).toHaveBeenCalledWith(
      expect.objectContaining({ subCommands: expect.any(Object) }),
      { rawArgs: ['bootstrap', '--force', '-h'] }
    );
  });

  it('intercepts a standalone `-h` following a non-flag positional token', async () => {
    const mocks = await importEntrypoint(['bootstrap', 'positional', '-h']);

    expect(mocks.commandUsageMock).toHaveBeenCalledWith('bootstrap', 0);
    expect(mocks.runMainMock).not.toHaveBeenCalled();
  });

  it('falls through to normal dispatch for an unknown command name even with --help present', async () => {
    const mocks = await importEntrypoint(['not-a-real-command', '--help'], {
      runMainImpl: async () => {},
    });

    expect(mocks.commandUsageMock).not.toHaveBeenCalled();
    expect(mocks.usageMock).not.toHaveBeenCalled();
    expect(mocks.runMainMock).toHaveBeenCalledWith(
      expect.objectContaining({ subCommands: expect.any(Object) }),
      { rawArgs: ['not-a-real-command', '--help'] }
    );
  });

  it('lazy-loads every subcommand and forwards parsed flags, source root, and edition', async () => {
    const mocks = await importEntrypoint(['doctor', '--json'], {
      runMainImpl: async (main) => {
        for (const loadSubCommand of Object.values(main.subCommands ?? {})) {
          const command = await loadSubCommand();
          await command.run({
            rawArgs: [
              'ignored-positional',
              '--source',
              'relative-source',
              '--edition',
              'extra',
              '--json',
              '--force',
            ],
          });
        }
      },
    });

    expect(mocks.runMainMock).toHaveBeenCalledWith(
      expect.objectContaining({ subCommands: expect.any(Object) }),
      { rawArgs: ['doctor', '--json'] }
    );
    expect(mocks.commandRunMock).toHaveBeenCalledTimes(
      commandModuleIds.length + commandAliases.length
    );
    expect(mocks.commandRunMock).toHaveBeenCalledWith(
      {
        command: 'doctor',
        flags: {
          source: 'relative-source',
          edition: 'extra',
          json: true,
          force: true,
        },
      },
      resolve('relative-source'),
      'extra'
    );
    expect(mocks.commandRunMock).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'bootstrap' }),
      resolve('relative-source'),
      'extra'
    );
  });

  it('falls back to the edition default source when --source has no value', async () => {
    const mocks = await importEntrypoint(['doctor'], {
      runMainImpl: async (main) => {
        const command = await main.subCommands?.doctor?.();
        await command?.run({ rawArgs: ['--source'] });
      },
    });

    expect(mocks.commandRunMock).toHaveBeenCalledWith(
      {
        command: 'doctor',
        flags: { source: true },
      },
      resolve('references/KayKit_Medieval_Hexagon_Pack_1.0_FREE'),
      'free'
    );
  });

  it('defaults missing raw subcommand args to an empty flag set', async () => {
    const mocks = await importEntrypoint(['doctor'], {
      runMainImpl: async (main) => {
        const command = await main.subCommands?.doctor?.();
        await command?.run({});
      },
    });

    expect(mocks.commandRunMock).toHaveBeenCalledWith(
      {
        command: 'doctor',
        flags: {},
      },
      resolve('references/KayKit_Medieval_Hexagon_Pack_1.0_FREE'),
      'free'
    );
  });

  it('prints terse errors and exits nonzero when command dispatch rejects', async () => {
    delete process.env.HEX_WORLDS_DEBUG;
    const mocks = await importEntrypoint(['doctor'], {
      runMainImpl: async (main) => {
        const command = await main.subCommands?.doctor?.();
        await command?.run({ rawArgs: ['--edition', 'legendary'] });
      },
    });

    expect(mocks.commandRunMock).not.toHaveBeenCalled();
    expect(mocks.errorSpy).toHaveBeenCalledWith('Unsupported edition: legendary');
    expect(mocks.exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints stack traces for Error failures when debug output is enabled', async () => {
    process.env.HEX_WORLDS_DEBUG = '1';
    const mocks = await importEntrypoint(['doctor'], {
      runMainImpl: async () => {
        throw new Error('debug dispatch failure');
      },
    });

    expect(String(mocks.errorSpy.mock.calls[0]?.[0])).toContain('debug dispatch failure');
    expect(String(mocks.errorSpy.mock.calls[0]?.[0])).toContain('Error:');
    expect(mocks.exitSpy).toHaveBeenCalledWith(1);
  });

  it('falls back to the message for stackless debug Error failures', async () => {
    process.env.HEX_WORLDS_DEBUG = '1';
    const mocks = await importEntrypoint(['doctor'], {
      runMainImpl: async () => {
        const error = new Error('stackless debug failure');
        error.stack = undefined;
        throw error;
      },
    });

    expect(mocks.errorSpy).toHaveBeenCalledWith('stackless debug failure');
    expect(mocks.exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints non-Error rejections as strings', async () => {
    delete process.env.HEX_WORLDS_DEBUG;
    const mocks = await importEntrypoint(['doctor'], {
      runMainImpl: async () => {
        throw 'string dispatch failure';
      },
    });

    expect(mocks.errorSpy).toHaveBeenCalledWith('string dispatch failure');
    expect(mocks.exitSpy).toHaveBeenCalledWith(1);
  });
});

async function importEntrypoint(
  argv: readonly string[],
  options: {
    runMainImpl?: (main: EntrypointCommand, options: { rawArgs?: string[] }) => Promise<void>;
  } = {}
): Promise<{
  commandRunMock: ReturnType<typeof vi.fn>;
  commandUsageMock: ReturnType<typeof vi.fn>;
  errorSpy: ReturnType<typeof vi.spyOn>;
  exitSpy: ReturnType<typeof vi.spyOn>;
  runMainMock: ReturnType<typeof vi.fn>;
  usageMock: ReturnType<typeof vi.fn>;
}> {
  vi.resetModules();
  process.argv = ['node', 'src/cli/cli.ts', ...argv];

  const commandRunMock = vi.fn();
  const defineCommandMock = vi.fn((command: unknown) => command);
  const runMainMock = vi.fn(
    async (main: EntrypointCommand, runMainOptions: { rawArgs?: string[] }) => {
      await options.runMainImpl?.(main, runMainOptions);
    }
  );
  const usageMock = vi.fn();
  const commandUsageMock = vi.fn();
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

  vi.doMock('citty', () => ({
    defineCommand: defineCommandMock,
    runMain: runMainMock,
  }));
  vi.doMock('../usage', () => ({
    usage: usageMock,
    commandUsage: commandUsageMock,
  }));
  for (const moduleId of commandModuleIds) {
    vi.doMock(`../commands/${moduleId}`, () => ({
      run: commandRunMock,
    }));
  }

  await import('../cli');
  await flushEntrypoint();

  return { commandRunMock, commandUsageMock, errorSpy, exitSpy, runMainMock, usageMock };
}

async function flushEntrypoint(): Promise<void> {
  await Promise.resolve();
  await vi.dynamicImportSettled();
  await new Promise((resolveFlush) => setImmediate(resolveFlush));
  await vi.dynamicImportSettled();
  await Promise.resolve();
}
