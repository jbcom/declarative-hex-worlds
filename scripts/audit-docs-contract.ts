import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import {
  listKayKitAssetPublicTreatments,
  listKayKitGuideScenarios,
} from '../src/scenario';

type PillarStatus = 'draft' | 'implemented' | 'verified';

interface PillarFrontmatter {
  status?: string;
  last_verified?: string;
  source_images?: string[];
  source_pack?: string;
  implementation_links?: string[];
  test_links?: string[];
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const pillarsDir = resolve(workspaceRoot, 'docs/pillars');
const simpleRpgExamplePath = resolve(
  workspaceRoot,
  'tests/integration/simple-rpg/simple-rpg.ts'
);
const simpleRpgExecutableApiCount = extractStringArrayConst(
  readFileSync(simpleRpgExamplePath, 'utf8'),
  'SIMPLE_RPG_EXECUTABLE_GUIDE_PUBLIC_APIS',
  simpleRpgExamplePath
).length;
const kayKitPublicTreatmentCount = listKayKitAssetPublicTreatments().length;
const kayKitGuideScenarioCount = listKayKitGuideScenarios().length;
// Post-F-README-1: the marketing README drops metric-heavy SimpleRPG
// enumeration in favor of a 30-line quickstart + module-map + docs grid.
// The same metrics still live in the pillar doc + the SimpleRPG guide
// content under docs/guides/. README.md is no longer audited here.
const simpleRpgCoverageDocPaths = [
  'docs/pillars/05-koota-runtime-rules.md',
  'docs/guides/recipes-scenarios-and-simulation.md',
] as const;
const allowedStatuses = new Set<PillarStatus>(['draft', 'implemented', 'verified']);
const allowedSourcePacks = new Set([
  'references/KayKit_Medieval_Hexagon_Pack_1.0_FREE',
  'references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA',
]);
const requiredKeys = [
  'status',
  'last_verified',
  'source_images',
  'source_pack',
  'implementation_links',
  'test_links',
] as const;

const failures: string[] = [];
const pillarPaths = readdirSync(pillarsDir)
  .filter((entry) => entry.endsWith('.md'))
  .map((entry) => resolve(pillarsDir, entry))
  .sort();

if (pillarPaths.length === 0) {
  failures.push('docs/pillars contains no markdown pillar files');
}

for (const pillarPath of pillarPaths) {
  auditPillar(pillarPath);
}
auditSimpleRpgCoverageDocs();

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`docs contract: ${failure}`);
  }
  process.exit(1);
}

console.log(
  `docs contract passed for ${pillarPaths.length} pillar docs and SimpleRPG executable coverage docs`
);

function auditPillar(pillarPath: string): void {
  const label = basename(pillarPath);
  const source = readFileSync(pillarPath, 'utf8');
  const frontmatter = parseFrontmatter(source, label);
  if (!frontmatter) {
    return;
  }

  for (const key of requiredKeys) {
    if (frontmatter[key] === undefined) {
      failures.push(`${label} is missing frontmatter key ${key}`);
    }
  }

  if (frontmatter.status && !allowedStatuses.has(frontmatter.status as PillarStatus)) {
    failures.push(`${label} has unsupported status ${frontmatter.status}`);
  }

  if (frontmatter.last_verified && !/^\d{4}-\d{2}-\d{2}$/.test(frontmatter.last_verified)) {
    failures.push(`${label} last_verified must be YYYY-MM-DD`);
  }

  auditPathList(label, 'source_images', frontmatter.source_images, {
    allowIgnoredReferencePath: false,
  });
  auditPathList(label, 'implementation_links', frontmatter.implementation_links, {
    allowIgnoredReferencePath: false,
  });
  auditPathList(label, 'test_links', frontmatter.test_links, { allowIgnoredReferencePath: false });
  auditSourceImages(label, frontmatter.source_images);
  auditImplementedPillarLinks(label, frontmatter);

  if (!frontmatter.source_pack || !allowedSourcePacks.has(frontmatter.source_pack)) {
    failures.push(`${label} source_pack must point at a known local KayKit references/ input pack`);
  }
}

function auditSourceImages(label: string, paths: string[] | undefined): void {
  for (const path of paths ?? []) {
    if (
      !/^docs\/assets\/kaykit-guide\/(?:montage|pages\/page-(?:0[1-9]|1[0-9]))\.png$/.test(path)
    ) {
      failures.push(
        `${label} source_images must point at extracted KayKit guide PNGs, got ${path}`
      );
    }
  }
}

function auditImplementedPillarLinks(label: string, frontmatter: PillarFrontmatter): void {
  if (frontmatter.status !== 'implemented' && frontmatter.status !== 'verified') {
    return;
  }

  assertPathListIncludes(
    label,
    'implementation_links',
    frontmatter.implementation_links,
    (path) =>
      path.startsWith('src/') ||
      path.startsWith('docs/') ||
      path.startsWith('scripts/'),
    'a package source, docs, or script implementation path'
  );
  assertPathListIncludes(
    label,
    'test_links',
    frontmatter.test_links,
    (path) =>
      path.startsWith('tests/') || path.startsWith('scripts/'),
    'a package test or script audit path'
  );
}

function assertPathListIncludes(
  label: string,
  key: keyof Pick<PillarFrontmatter, 'implementation_links' | 'test_links'>,
  paths: string[] | undefined,
  predicate: (path: string) => boolean,
  expectation: string
): void {
  if (!(paths ?? []).some(predicate)) {
    failures.push(`${label} ${key} must include ${expectation}`);
  }
}

function auditPathList(
  label: string,
  key: keyof Pick<PillarFrontmatter, 'source_images' | 'implementation_links' | 'test_links'>,
  paths: string[] | undefined,
  options: { allowIgnoredReferencePath: boolean }
): void {
  if (!paths || paths.length === 0) {
    failures.push(`${label} ${key} must list at least one path`);
    return;
  }

  const seen = new Set<string>();
  for (const path of paths) {
    if (seen.has(path)) {
      failures.push(`${label} ${key} repeats ${path}`);
    }
    seen.add(path);

    if (path.startsWith('/') || path.includes('..')) {
      failures.push(`${label} ${key} contains non-repo-relative path ${path}`);
      continue;
    }
    if (!options.allowIgnoredReferencePath && path.startsWith('references/')) {
      failures.push(`${label} ${key} must not point at ignored references path ${path}`);
      continue;
    }

    const resolvedPath = resolve(workspaceRoot, path);
    if (!existsSync(resolvedPath)) {
      failures.push(`${label} ${key} points at missing path ${path}`);
      continue;
    }
    if (!statSync(resolvedPath).isFile()) {
      failures.push(`${label} ${key} must point at a file, got ${path}`);
    }
  }
}

function parseFrontmatter(source: string, label: string): PillarFrontmatter | undefined {
  if (!source.startsWith('---\n')) {
    failures.push(`${label} is missing YAML frontmatter`);
    return undefined;
  }

  const end = source.indexOf('\n---', 4);
  if (end === -1) {
    failures.push(`${label} frontmatter is not closed`);
    return undefined;
  }

  const data: PillarFrontmatter = {};
  let currentListKey: keyof PillarFrontmatter | undefined;
  const lines = source.slice(4, end).split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.length === 0) {
      continue;
    }

    const listItem = /^ {2}- (.+)$/.exec(line);
    if (listItem) {
      if (!currentListKey) {
        failures.push(`${label} has a list item without a preceding key: ${line}`);
        continue;
      }
      const value = listItem[1] ?? '';
      const list = data[currentListKey];
      if (Array.isArray(list)) {
        list.push(value);
      } else {
        failures.push(`${label} frontmatter key ${currentListKey} is not a list`);
      }
      continue;
    }

    const scalar = /^([a-z_]+):(.*)$/.exec(line);
    if (!scalar) {
      failures.push(`${label} has unsupported frontmatter line: ${line}`);
      currentListKey = undefined;
      continue;
    }

    const key = scalar[1] as keyof PillarFrontmatter;
    const value = (scalar[2] ?? '').trim();
    if (!requiredKeys.includes(key as (typeof requiredKeys)[number])) {
      failures.push(`${label} has unknown frontmatter key ${key}`);
      currentListKey = undefined;
      continue;
    }

    if (value.length === 0) {
      data[key] = [] as never;
      currentListKey = key;
      continue;
    }

    data[key] = value as never;
    currentListKey = undefined;
  }

  return data;
}

function auditSimpleRpgCoverageDocs(): void {
  const expectedSnippets = [
    `${simpleRpgExecutableApiCount} guide-facing helper APIs`,
    `${kayKitPublicTreatmentCount} KayKit public treatment`,
    `${kayKitGuideScenarioCount} decomposed guide pages`,
  ];

  for (const docPath of simpleRpgCoverageDocPaths) {
    const source = normalizeDocText(readFileSync(resolve(workspaceRoot, docPath), 'utf8'));
    for (const expectedSnippet of expectedSnippets) {
      if (!source.includes(expectedSnippet)) {
        failures.push(`${docPath} must mention "${expectedSnippet}"`);
      }
    }
  }
}

function extractStringArrayConst(source: string, constName: string, label: string): string[] {
  const escapedConstName = constName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`const ${escapedConstName} = \\[([\\s\\S]*?)\\] as const;`).exec(source);
  if (!match) {
    failures.push(`${label} is missing ${constName}`);
    return [];
  }

  return [...(match[1] ?? '').matchAll(/'([^']+)'/g)].map((entry) => entry[1] ?? '');
}

function normalizeDocText(source: string): string {
  return source.replace(/\s+/g, ' ');
}
