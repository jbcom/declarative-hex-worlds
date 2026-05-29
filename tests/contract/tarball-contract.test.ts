/**
 * Tarball contract — static assertions about package.json shape, exports
 * wiring, source-module → export coverage, and attribution files.
 *
 * Replaces the static half of the deleted `scripts/audit-package.ts`.
 * The dynamic half (npm pack --dry-run tarball content + PNG quality +
 * packed consumer smoke) is a release-time check invoked from release.yml
 * and does NOT run in the standard `pnpm test` loop.
 *
 * Most assertions require only a `pnpm install` + the committed files; no
 * `pnpm build` is required. The "exports map wiring" section checks dist/
 * paths and is guarded by `distBuilt` — those tests are skipped when dist/
 * does not exist (i.e. in a fresh checkout before build).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS } from '../../src/interop';
import { KAYKIT_ATTRIBUTION } from '../../src/manifest/schema';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const distBuilt = existsSync(join(repoRoot, 'dist'));

interface ExportTarget {
  import?: string;
  types?: string;
  require?: string;
}
interface PackageJson {
  bin?: Record<string, string>;
  dependencies?: Record<string, string>;
  engines?: Record<string, string>;
  exports?: Record<string, string | ExportTarget>;
  files?: string[];
  license?: string;
  main?: string;
  module?: string;
  name?: string;
  packageManager?: string;
  peerDependencies?: Record<string, unknown>;
  peerDependenciesMeta?: Record<string, unknown>;
  publishConfig?: { access?: string };
  sideEffects?: boolean;
  type?: string;
  types?: string;
}

const packageJson = JSON.parse(
  readFileSync(join(repoRoot, 'package.json'), 'utf8')
) as PackageJson;

/**
 * Package.json export subpaths that are NOT expected to have a corresponding
 * src/ source file (private-by-convention, non-source passthroughs).
 */
const PRIVATE_SUBPATHS = new Set(['.', 'cli', 'config', 'internal', 'manifest']);

/**
 * Parses the tsup.config.ts entry object (plain text extraction) and returns
 * a map from subpath key (e.g. "manifest/schema") to repo-relative source
 * path (e.g. "src/manifest/schema.ts"). This is the authoritative mapping
 * between package.json subpath exports and their source files.
 */
function parseTsupEntries(): Map<string, string> {
  const tsupConfig = readFileSync(join(repoRoot, 'tsup.config.ts'), 'utf8');
  const entryBlock = tsupConfig.match(/entry:\s*\{([^}]+)\}/s)?.[1] ?? '';
  const map = new Map<string, string>();
  for (const line of entryBlock.split('\n')) {
    const m = line.match(/['"]?([\w/.-]+)['"]?\s*:\s*['"]([^'"]+)['"]/);
    if (m?.[1] && m?.[2]) map.set(m[1], m[2]);
  }
  return map;
}

// ── package.json metadata ──────────────────────────────────────────────────

describe('package.json metadata', () => {
  it('name is declarative-hex-worlds', () =>
    expect(packageJson.name).toBe('declarative-hex-worlds'));
  it('type is module (ESM-only)', () => expect(packageJson.type).toBe('module'));
  it('sideEffects is false', () => expect(packageJson.sideEffects).toBe(false));
  it('license is MIT', () => expect(packageJson.license).toBe('MIT'));
  it('publishConfig.access is public', () =>
    expect(packageJson.publishConfig?.access).toBe('public'));
  it('packageManager pins pnpm@9.15.9', () =>
    expect(packageJson.packageManager).toBe('pnpm@9.15.9'));
  it('engines.node is >=22', () => expect(packageJson.engines?.node).toBe('>=22'));
  it('engines.pnpm is >=9', () => expect(packageJson.engines?.pnpm).toBe('>=9'));

  it('files whitelist matches expected set', () => {
    const expected = [
      'assets/free/manifest.json',
      'docs/showcases',
      'dist',
      '!dist/**/*.map',
      '!dist/**/*.d.ts.map',
      'examples/*.json',
      'LICENSE',
      'README.md',
      'NOTICE.md',
    ];
    expect((packageJson.files ?? []).sort()).toEqual([...expected].sort());
  });
});

// ── runtime dependencies ───────────────────────────────────────────────────

describe('runtime dependencies', () => {
  for (const dep of ['react', 'react-dom', 'three', '@types/react', 'honeycomb-grid', 'koota', 'seedrandom']) {
    it(`${dep} is a runtime dependency (not a peer)`, () => {
      expect(
        typeof packageJson.dependencies?.[dep],
        `${dep} must be in dependencies`
      ).toBe('string');
    });
  }

  it('peerDependencies block is absent (react/three are runtime deps post-R1)', () => {
    expect(Object.hasOwn(packageJson, 'peerDependencies')).toBe(false);
  });
  it('peerDependenciesMeta block is absent', () => {
    expect(Object.hasOwn(packageJson, 'peerDependenciesMeta')).toBe(false);
  });
});

// ── root export entrypoint ─────────────────────────────────────────────────

describe('root export entrypoint', () => {
  const rootExport = packageJson.exports?.['.'];

  it('root export is an object (not a string)', () => {
    expect(typeof rootExport).toBe('object');
    expect(rootExport).not.toBeNull();
  });

  it('root export .import points at ./dist/index.js', () => {
    expect((rootExport as ExportTarget | undefined)?.import).toBe('./dist/index.js');
  });

  it('root export .types points at ./dist/index.d.ts', () => {
    expect((rootExport as ExportTarget | undefined)?.types).toBe('./dist/index.d.ts');
  });

  it('package.main mirrors root export.import', () => {
    expect(packageJson.main).toBe((rootExport as ExportTarget | undefined)?.import);
  });

  it('package.module mirrors root export.import', () => {
    expect(packageJson.module).toBe((rootExport as ExportTarget | undefined)?.import);
  });

  it('package.types mirrors root export.types', () => {
    expect(packageJson.types).toBe((rootExport as ExportTarget | undefined)?.types);
  });
});

// ── CLI bin ────────────────────────────────────────────────────────────────

describe('CLI bin', () => {
  it('bin.declarative-hex-worlds points at ./dist/cli.js', () => {
    expect(packageJson.bin?.['declarative-hex-worlds']).toBe('./dist/cli.js');
  });
});

// ── exports map ───────────────────────────────────────────────────────────

describe('exports map wiring', () => {
  const exports = packageJson.exports ?? {};

  it('examples/*.json is a string passthrough export', () => {
    expect(exports['./examples/*.json']).toBe('./examples/*.json');
  });

  it('./examples/* wildcard is NOT exported (would expose source)', () => {
    expect(Object.hasOwn(exports, './examples/*')).toBe(false);
  });

  it.each(
    Object.entries(exports).flatMap(([subpath, target]) => {
      if (typeof target === 'string') return [];
      return Object.entries(target as ExportTarget).map(
        ([kind, path]) => [subpath, kind, path] as [string, string, string]
      );
    })
  )('%s[%s] = %s resolves to an existing file', (_subpath, _kind, path) => {
    if (!distBuilt) return; // dist/ not present in a fresh checkout before pnpm build
    const resolved = join(repoRoot, path.replace(/^\.\//, ''));
    expect(existsSync(resolved), `${path} does not exist`).toBe(true);
  });
});

// ── every exported subpath has a corresponding source file ────────────────

describe('source module export coverage', () => {
  // Cross-check: every package.json object-valued export (not the root `.`,
  // not string passthroughs, not private-by-convention subpaths) must have a
  // tsup entry pointing at an existing source file. Using tsup.config.ts as
  // the authoritative subpath→source mapping avoids the filesystem-traversal
  // fragility of the old collectSourceModules() which silently skipped
  // manifest/schema and manifest/free (siblings of manifest/index.ts).
  const tsupEntries = parseTsupEntries();

  const exportedSubpaths = Object.entries(packageJson.exports ?? {})
    .filter(([subpath, target]) => {
      if (typeof target === 'string') return false; // passthrough
      const rel = subpath.replace(/^\.\//, '');
      if (subpath === '.') return false;
      if (PRIVATE_SUBPATHS.has(rel)) return false;
      return true;
    })
    .map(([subpath]) => subpath.replace(/^\.\//, ''));

  it.each(exportedSubpaths.map((s) => [s] as const))(
    './%s export has a tsup entry + existing source file',
    (subpathKey) => {
      const sourcePath = tsupEntries.get(subpathKey);
      expect(sourcePath, `tsup entry missing for ${subpathKey}`).toBeDefined();
      if (sourcePath) {
        const absolute = join(repoRoot, sourcePath);
        expect(existsSync(absolute), `source file missing: ${sourcePath}`).toBe(true);
      }
    }
  );
});

// ── attribution ───────────────────────────────────────────────────────────

describe('attribution files', () => {
  const license = readFileSync(join(repoRoot, 'LICENSE'), 'utf8');
  const notice = readFileSync(join(repoRoot, 'NOTICE.md'), 'utf8');
  const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');

  const freeManifest = JSON.parse(
    readFileSync(join(repoRoot, 'assets/free/manifest.json'), 'utf8')
  ) as { sourcePack?: Record<string, string> };

  it('LICENSE mentions MIT', () => expect(license).toContain('MIT License'));

  for (const snippet of [
    'KayKit: Medieval Hexagon Pack',
    KAYKIT_ATTRIBUTION.creator,
    KAYKIT_ATTRIBUTION.website,
    'KayKit',
    'https://kaylousberg.itch.io',
    KAYKIT_ATTRIBUTION.license,
    KAYKIT_ATTRIBUTION.licenseUrl,
  ]) {
    it(`NOTICE.md mentions "${snippet}"`, () => expect(notice).toContain(snippet));
  }

  for (const snippet of ['## License', 'MIT', 'KayKit Medieval Hexagon Pack', 'CC0-1.0', 'NOTICE.md']) {
    it(`README.md mentions "${snippet}"`, () => expect(readme).toContain(snippet));
  }

  it('FREE manifest creator attribution matches KAYKIT_ATTRIBUTION', () => {
    expect(freeManifest.sourcePack?.['creator']).toBe(KAYKIT_ATTRIBUTION.creator);
  });
  it('FREE manifest license matches KAYKIT_ATTRIBUTION', () => {
    expect(freeManifest.sourcePack?.['license']).toBe(KAYKIT_ATTRIBUTION.license);
  });
  it('FREE manifest licenseUrl matches KAYKIT_ATTRIBUTION', () => {
    expect(freeManifest.sourcePack?.['licenseUrl']).toBe(KAYKIT_ATTRIBUTION.licenseUrl);
  });
  it('FREE manifest sourcePack name is correct', () => {
    expect(freeManifest.sourcePack?.['name']).toBe('KayKit: Medieval Hexagon Pack');
  });
  it('FREE manifest sourcePack version is 1.0', () => {
    expect(freeManifest.sourcePack?.['version']).toBe('1.0');
  });
});

// ── curated showcase artifacts ────────────────────────────────────────────

describe('curated showcase artifacts', () => {
  const expectedShowcases = GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS.filter((p) =>
    p.startsWith('docs/showcases/')
  ).sort();

  it('all curated showcases live under docs/showcases/', () => {
    expect(expectedShowcases.length).toBeGreaterThan(0);
    for (const path of GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS) {
      expect(path.startsWith('docs/showcases/'), `${path} outside docs/showcases/`).toBe(true);
    }
  });

  it.each(expectedShowcases.map((p) => [p] as const))(
    '%s exists on disk',
    (path) => {
      expect(existsSync(join(repoRoot, path)), `${path} missing from disk`).toBe(true);
    }
  );
});

// ── README local link hygiene ─────────────────────────────────────────────

describe('README local link hygiene', () => {
  const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
  const localLinkPattern = /(!?)\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

  const localLinks: Array<{ isImage: boolean; href: string; pathOnly: string }> = [];
  for (const match of readme.matchAll(localLinkPattern)) {
    const isImage = match[1] === '!';
    const href = match[2] ?? '';
    if (!href || /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(href)) continue;
    const [pathOnly = ''] = href.split('#');
    if (pathOnly) localLinks.push({ isImage, href, pathOnly });
  }

  it.each(localLinks.map((l) => [l.href, l] as const))(
    'link %s resolves to an existing file',
    (_href, { pathOnly }) => {
      const resolved = resolve(repoRoot, pathOnly);
      expect(resolved.startsWith(`${repoRoot}/`), `${pathOnly} escapes repo root`).toBe(true);
      expect(existsSync(resolved), `${pathOnly} is missing`).toBe(true);
    }
  );
});
