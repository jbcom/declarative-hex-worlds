import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface BiomeRestrictedImportsConfig {
  readonly linter?: {
    readonly rules?: {
      readonly style?: {
        readonly noRestrictedImports?: {
          readonly options?: {
            readonly paths?: Record<string, string>;
          };
        };
      };
    };
  };
}

const REQUIRED_DEEP_IMPORT_RESTRICTIONS = [
  '../interop/internal',
  '../internal/predicates',
  '../traits/actors',
  '../traits/board',
  '../traits/movement',
  '../traits/patrol',
  '../traits/quests',
  '../config/bootstrap-paths.json',
  '../config/kaykit-source.json',
  '../config/upstream-layouts.json',
] as const;

function readRestrictedImportPaths(): Record<string, string> {
  const config = JSON.parse(
    readFileSync(resolve(process.cwd(), 'biome.json'), 'utf8')
  ) as BiomeRestrictedImportsConfig;
  const paths = config.linter?.rules?.style?.noRestrictedImports?.options?.paths;
  if (!paths) {
    throw new Error('biome.json is missing linter.rules.style.noRestrictedImports.options.paths');
  }
  return paths;
}

function hasFileExtension(importPath: string): boolean {
  return /\.[a-z0-9]+$/i.test(importPath);
}

describe('Biome restricted import contract', () => {
  it('covers known deep internal import gaps', () => {
    const paths = readRestrictedImportPaths();

    for (const importPath of REQUIRED_DEEP_IMPORT_RESTRICTIONS) {
      expect(paths[importPath], `${importPath} must be restricted`).toEqual(expect.any(String));
    }
  });

  it('mirrors extensionless restrictions with .js import specifiers', () => {
    const paths = readRestrictedImportPaths();
    const extensionlessPaths = Object.keys(paths).filter((importPath) => !hasFileExtension(importPath));
    const missingJsVariants = extensionlessPaths.filter(
      (importPath) => paths[`${importPath}.js`] === undefined
    );

    expect(missingJsVariants).toEqual([]);
  });
});
