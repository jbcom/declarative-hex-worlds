import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCliReference,
  cliReferenceOutputPath,
  defaultRepoRoot,
  generateCliReference,
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

  it('resolves the default repo root and CLI reference docs path', () => {
    expect(defaultRepoRoot()).toBe(resolve(import.meta.dirname, '../..'));
    expect(cliReferenceOutputPath('/repo')).toBe(
      '/repo/docs-site/src/content/docs/guides/cli-reference.md'
    );
  });

  it('runs the CLI help command and writes the generated page through injected IO', () => {
    const execCalls: unknown[] = [];
    const writes: unknown[] = [];
    const logs: string[] = [];

    const result = generateCliReference({
      repoRoot: '/repo',
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
        options: { cwd: '/repo', encoding: 'utf8' },
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
});
