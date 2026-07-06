import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '../../tests/setup/workspace-root';
import {
  buildCliReference,
  cliReferenceOutputPath,
  defaultRepoRoot,
  generateCliReference,
  isDirectRun,
  resolveGenerateCliReferenceOptions,
} from '../generate-cli-reference';

describe('scripts/generate-cli-reference', () => {
  it('builds the docs page from trimmed live help output', () => {
    const page = buildCliReference('\nUsage: declarative-hex-worlds <command>\n\n');

    expect(page).toContain('title: CLI Reference');
    expect(page).toContain('scripts/generate-cli-reference.ts');
    expect(page).toContain('## Full usage');
    expect(page).toContain('```');
    expect(page).toContain('Usage: declarative-hex-worlds <command>\n```');
    expect(page).toContain('HEX_WORLDS_OUT_ROOT');
  });

  it('resolves the default repo root (workspace root) and CLI reference docs path', () => {
    // docs-site/ lives at the workspace root, so defaultRepoRoot walks up to
    // pnpm-workspace.yaml — not the package root.
    expect(defaultRepoRoot()).toBe(findWorkspaceRoot(import.meta.dirname));
    expect(cliReferenceOutputPath('/repo')).toBe(
      '/repo/docs-site/src/content/docs/guides/cli-reference.md'
    );
  });

  it('resolves default generator options without executing IO', () => {
    const defaults = resolveGenerateCliReferenceOptions();

    expect(defaults.repoRoot).toBe(defaultRepoRoot());
    expect(defaults.outputPath).toBe(cliReferenceOutputPath(defaultRepoRoot()));
    expect(defaults.execHelp).toEqual(expect.any(Function));
    expect(defaults.writeTextFile).toEqual(expect.any(Function));
    expect(defaults.log).toBe(console.log);
  });

  it('runs the CLI help command and writes the generated page through injected IO', () => {
    const execCalls: unknown[] = [];
    const writes: unknown[] = [];
    const logs: string[] = [];

    const result = generateCliReference({
      // repoRoot = workspace root (output base); packageRoot = library package
      // (the CLI-help exec cwd, where src/cli/cli.ts + tsx resolve).
      repoRoot: '/repo',
      packageRoot: '/repo/packages/declarative-hex-worlds',
      outputPath: '/repo/docs-site/src/content/docs/guides/cli-reference.md',
      execFileSyncImpl: (file, args, options) => {
        execCalls.push({ file, args, options });
        return 'Usage: generated help\n';
      },
      writeFileSyncImpl: (path, contents, encoding) => {
        writes.push({ path, contents, encoding });
      },
      log: (message) => logs.push(message),
    });

    expect(execCalls).toEqual([
      {
        file: 'pnpm',
        args: ['exec', 'tsx', 'src/cli/cli.ts', '--help'],
        options: { cwd: '/repo/packages/declarative-hex-worlds', encoding: 'utf8' },
      },
    ]);
    expect(writes).toEqual([
      {
        path: '/repo/docs-site/src/content/docs/guides/cli-reference.md',
        contents: result.contents,
        encoding: 'utf8',
      },
    ]);
    expect(result.outputPath).toBe('/repo/docs-site/src/content/docs/guides/cli-reference.md');
    expect(result.contents).toContain('Usage: generated help');
    expect(logs).toEqual(['Wrote /repo/docs-site/src/content/docs/guides/cli-reference.md']);
  });

  it('detects direct script execution from argv and module URL', () => {
    const scriptPath = '/repo/scripts/generate-cli-reference.ts';
    const moduleUrl = pathToFileURL(scriptPath).href;

    expect(isDirectRun(scriptPath, moduleUrl)).toBe(true);
    expect(isDirectRun('/repo/scripts/other.ts', moduleUrl)).toBe(false);
    expect(isDirectRun('', moduleUrl)).toBe(false);
    expect(isDirectRun(undefined, moduleUrl)).toBe(false);
  });
});
