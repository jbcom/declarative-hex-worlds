/**
 * README Quickstart compile contract.
 *
 * The first real consumer (little-legends, 2026-07-06) copy-pasted the README
 * Quickstart and it did not compile: the example called
 * `createGameboardRuntimeFromScenario` with a made-up options shape and passed
 * `runtime=` to a provider whose only prop is `world`. This contract
 * type-checks every ```tsx block in README.md against the real library types
 * (via the repo tsconfig's `declarative-hex-worlds` path mapping) so the
 * Quickstart can never drift from the API again.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const readme = readFileSync(resolve(repoRoot, 'README.md'), 'utf8');

function extractFencedBlocks(markdown: string, language: string): string[] {
  const blocks: string[] = [];
  const fence = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\`\`\``, 'g');
  for (const match of markdown.matchAll(fence)) {
    const body = match[1];
    if (body !== undefined) {
      blocks.push(body);
    }
  }
  return blocks;
}

/**
 * Type-check every block in ONE program: lib.d.ts parsing and the
 * path-mapped module graph are block-independent, so per-block programs
 * would just repeat that bootstrap for every snippet the README gains.
 */
function typecheckVirtualTsxBlocks(sources: readonly string[]): readonly string[] {
  const configPath = resolve(repoRoot, 'tsconfig.json');
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, repoRoot);
  const options: ts.CompilerOptions = {
    ...parsed.options,
    jsx: ts.JsxEmit.ReactJSX,
    noEmit: true,
    // Each snippet is a standalone example, not part of the project graph.
    composite: false,
    incremental: false,
  };
  const virtualSources = new Map<string, string>(
    sources.map((source, index) => [
      resolve(repoRoot, `__readme-quickstart-block-${index}.tsx`),
      source,
    ])
  );
  const host = ts.createCompilerHost(options);
  const defaultGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, ...rest) => {
    const virtualSource = virtualSources.get(resolve(fileName));
    if (virtualSource !== undefined) {
      return ts.createSourceFile(fileName, virtualSource, languageVersion, true, ts.ScriptKind.TSX);
    }
    return defaultGetSourceFile(fileName, languageVersion, ...rest);
  };
  const defaultFileExists = host.fileExists.bind(host);
  host.fileExists = (fileName) => virtualSources.has(resolve(fileName)) || defaultFileExists(fileName);

  const program = ts.createProgram([...virtualSources.keys()], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .map((diagnostic) =>
      ts.formatDiagnostic(diagnostic, {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: () => repoRoot,
        getNewLine: () => '\n',
      })
    );
}

describe('README Quickstart contract', () => {
  const tsxBlocks = extractFencedBlocks(readme, 'tsx');

  it('has at least one tsx Quickstart block', () => {
    expect(tsxBlocks.length).toBeGreaterThanOrEqual(1);
  });

  it('every tsx block in README.md type-checks against the real library API', () => {
    expect(typecheckVirtualTsxBlocks(tsxBlocks)).toEqual([]);
  });
});
