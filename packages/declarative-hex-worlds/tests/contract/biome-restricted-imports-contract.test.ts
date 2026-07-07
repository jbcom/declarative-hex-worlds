import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

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

let restrictedImportPaths: Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function loadRestrictedImportPaths(): Record<string, string> {
  const parsed = JSON.parse(
    readFileSync(resolve(process.cwd(), 'biome.json'), 'utf8')
  ) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('Invalid biome.json: expected root JSON object');
  }
  const config = parsed as BiomeRestrictedImportsConfig;
  const paths = config.linter?.rules?.style?.noRestrictedImports?.options?.paths;
  if (!isStringRecord(paths)) {
    throw new Error(
      'Invalid biome.json: expected linter.rules.style.noRestrictedImports.options.paths to be a string map'
    );
  }
  return paths;
}

function hasFileExtension(importPath: string): boolean {
  return /\.[a-z0-9]+$/i.test(importPath);
}

describe('Biome restricted import contract', () => {
  beforeAll(() => {
    restrictedImportPaths = loadRestrictedImportPaths();
  });

  it('covers known deep internal import gaps', () => {
    for (const importPath of REQUIRED_DEEP_IMPORT_RESTRICTIONS) {
      expect(restrictedImportPaths[importPath], `${importPath} must be restricted`).toEqual(
        expect.any(String)
      );
    }
  });

  it('mirrors extensionless restrictions with .js import specifiers', () => {
    const extensionlessPaths = Object.keys(restrictedImportPaths).filter(
      (importPath) => !hasFileExtension(importPath)
    );
    const missingJsVariants = extensionlessPaths.filter(
      (importPath) => restrictedImportPaths[`${importPath}.js`] === undefined
    );

    expect(missingJsVariants).toEqual([]);
  });
});
