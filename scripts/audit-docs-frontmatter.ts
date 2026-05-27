/**
 * Docs-site frontmatter audit (PRD F-Audit-14).
 *
 * Every Markdown file under `docs-site/src/content/docs/` (the hand-written
 * pages, NOT the typedoc-generated `reference/` tree) must have:
 *
 *   - title: string
 *   - description: string
 *
 * Starlight requires `title`; `description` powers the page meta tag + the
 * sidebar autoindex tooltip. Missing frontmatter is a publish-blocking
 * docs bug.
 *
 * Wires into `pnpm test:docs-contract` (the broader docs gate) — runs in
 * the default verify chain.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const docsRoot = join(repoRoot, 'docs-site/src/content/docs');

if (!existsSync(docsRoot)) {
  // docs-site not present (shouldn't happen post-F-Site-1, but be defensive)
  console.log('docs-site frontmatter audit: skipped — docs-site/src/content/docs not found');
  process.exit(0);
}

const REFERENCE_PREFIX = `${docsRoot}/reference`;
const failures: string[] = [];

function walkMarkdown(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const child = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkMarkdown(child));
    } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
      out.push(child);
    }
  }
  return out;
}

const files = walkMarkdown(docsRoot);
let checked = 0;
let skipped = 0;

for (const file of files) {
  // Skip typedoc-generated reference pages — typedoc owns those.
  if (file.startsWith(REFERENCE_PREFIX)) {
    skipped += 1;
    continue;
  }

  checked += 1;
  const rel = relative(repoRoot, file);
  const source = readFileSync(file, 'utf8');
  const frontmatterMatch = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/.exec(source);
  if (frontmatterMatch === null) {
    failures.push(`${rel}: missing YAML frontmatter block`);
    continue;
  }
  const frontmatter = frontmatterMatch[1] ?? '';

  if (!/^title\s*:\s*\S/m.test(frontmatter)) {
    failures.push(`${rel}: frontmatter missing required \`title:\``);
  }
  if (!/^description\s*:\s*\S/m.test(frontmatter)) {
    failures.push(`${rel}: frontmatter missing required \`description:\``);
  }
}

if (failures.length > 0) {
  console.error(`docs-site frontmatter audit: ${failures.length} failure(s):`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(
  `docs-site frontmatter audit passed (${checked} hand-written page(s) checked, ${skipped} typedoc-generated page(s) skipped)`
);
