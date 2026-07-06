import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COMMANDS,
  commandUsage,
  findCommandHelp,
  HELP_TEXT,
  renderCommandHelp,
  usage,
} from '../usage';

// `../cli` is a script module: importing it for real runs the live dispatcher
// against the test runner's own `process.argv`. Load it the same isolated way
// `cli-entrypoint.test.ts` does (mocked `citty`, scoped `process.argv`,
// `vi.resetModules()`) purely to read the `SUBCOMMAND_LOADERS` key set for the
// completeness check below - no dispatch behavior is exercised here.
async function dispatchableCommandNames(): Promise<string[]> {
  vi.resetModules();
  const originalArgv = process.argv;
  // `--help` argv drives the entrypoint's early-return branch, which calls
  // the real `./usage` module's `usage(0)` -> `process.exit(0)`. Stub both so
  // loading the module for its `SUBCOMMAND_LOADERS` export doesn't actually
  // exit the test worker or print the banner.
  process.argv = ['node', 'src/cli/cli.ts', '--help'];
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.doMock('citty', () => ({
    defineCommand: (command: unknown) => command,
    runMain: async () => {},
  }));
  try {
    const cli = await import('../cli');
    await Promise.resolve();
    await vi.dynamicImportSettled();
    return Object.keys(cli.SUBCOMMAND_LOADERS);
  } finally {
    process.argv = originalArgv;
    exitSpy.mockRestore();
    logSpy.mockRestore();
    vi.doUnmock('citty');
    vi.resetModules();
  }
}

describe('CLI usage help text (E0h)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the hand-curated command and option reference import-covered', () => {
    expect(HELP_TEXT).toContain('declarative-hex-worlds <command> [options]');
    expect(HELP_TEXT).toContain('guide-render-requests');
    expect(HELP_TEXT).toContain('--include-source-formats');
  });

  it('prints help text and exits with the requested code', () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });

    expect(() => usage(2)).toThrow('process.exit 2');
    expect(logs).toEqual([HELP_TEXT]);
  });

  it('documents every dispatchable command from cli.ts (PRD RB2 per-command --help)', async () => {
    const dispatchableNames = await dispatchableCommandNames();
    for (const name of dispatchableNames) {
      expect(
        findCommandHelp(name),
        `missing per-command help metadata for "${name}"`
      ).toBeDefined();
    }
    // Reverse direction: every documented command/alias also resolves to a
    // real, currently-dispatchable command, so the two never drift apart.
    for (const command of COMMANDS) {
      expect(dispatchableNames).toContain(command.name);
      for (const alias of command.aliases ?? []) {
        expect(dispatchableNames).toContain(alias);
      }
    }
  });

  it('renders bootstrap --help with its full flag reference', () => {
    const text = renderCommandHelp('bootstrap');
    expect(text).toContain('declarative-hex-worlds bootstrap [options]');
    expect(text).toContain('Materialize KayKit GLTF assets under a consumer asset root');
    expect(text).toContain('--source github|zip');
    expect(text).toContain('--zip <path>');
    expect(text).toContain('--commit <sha>');
    expect(text).toContain('--out <path>');
    expect(text).toContain('--edition free|extra');
    expect(text).toContain('--force');
    expect(text).toContain('--verify');
    expect(text).toContain('--include-source-formats');
    expect(text).toContain('--json');
  });

  it('renders extract --help with its flags and notes the ingest alias', () => {
    const text = renderCommandHelp('extract');
    expect(text).toContain('declarative-hex-worlds extract [options] (alias: ingest)');
    expect(text).toContain('--out <path>');
    expect(text).toContain('--force');

    // The ingest alias renders identical, command-specific help - not a
    // generic "unknown command" fallback and not extract's raw name.
    const aliasText = renderCommandHelp('ingest');
    expect(aliasText).toEqual(text);
  });

  it('renders --help for a no-flags command with an explicit "takes no flags" note', () => {
    const text = renderCommandHelp('validate');
    expect(text).toContain('declarative-hex-worlds validate [options]');
    expect(text).toContain('This command takes no flags.');
  });

  it('returns undefined for an unknown command name', () => {
    expect(renderCommandHelp('not-a-real-command')).toBeUndefined();
    expect(findCommandHelp('not-a-real-command')).toBeUndefined();
  });

  it('commandUsage prints the rendered help and exits with the requested code', () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });

    expect(() => commandUsage('bootstrap', 0)).toThrow('process.exit 0');
    expect(logs).toEqual([renderCommandHelp('bootstrap')]);
  });

  it('commandUsage exits without printing anything for an unknown command', () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });

    expect(() => commandUsage('not-a-real-command', 1)).toThrow('process.exit 1');
    expect(logs).toEqual([]);
  });
});
