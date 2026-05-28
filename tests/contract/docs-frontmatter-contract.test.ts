/**
 * Docs-site frontmatter contract.
 *
 * Every hand-written Markdown page under `docs-site/src/content/docs/`
 * MUST carry frontmatter with `title:` and `description:`. Starlight
 * requires `title` (it renders the page title from it); `description`
 * powers the page `<meta name="description">` tag and the sidebar
 * autoindex tooltip. Missing frontmatter ships a publish-blocking
 * docs bug.
 *
 * The typedoc-generated `reference/` tree is excluded — typedoc owns
 * those pages and emits its own metadata.
 *
 * Replaces the bespoke `scripts/audit-docs-frontmatter.ts` (deleted).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const docsRoot = join(repoRoot, 'docs-site/src/content/docs');
const REFERENCE_PREFIX = `${docsRoot}/reference`;

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

const handWrittenFiles = existsSync(docsRoot)
  ? walkMarkdown(docsRoot).filter((file) => !file.startsWith(REFERENCE_PREFIX))
  : [];

describe('docs-site frontmatter contract', () => {
  it('docs-site/src/content/docs exists', () => {
    expect(existsSync(docsRoot), `${docsRoot} missing`).toBe(true);
  });

  it('discovers at least one hand-written page', () => {
    // If this ever returns 0 the audit is silently passing while
    // walking nothing — guard explicitly.
    expect(handWrittenFiles.length).toBeGreaterThan(0);
  });

  describe.each(handWrittenFiles.map((file) => [relative(repoRoot, file), file] as const))(
    '%s',
    (rel, file) => {
      let frontmatterMatch: RegExpExecArray | null = null;
      let frontmatter = '';
      beforeAll(() => {
        const source = readFileSync(file, 'utf8');
        frontmatterMatch = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/.exec(source);
        frontmatter = frontmatterMatch?.[1] ?? '';
      });

      it('has a YAML frontmatter block', () => {
        expect(frontmatterMatch, `${rel}: missing YAML frontmatter`).not.toBeNull();
      });

      it('frontmatter declares `title:`', () => {
        expect(/^title\s*:\s*\S/m.test(frontmatter), `${rel}: missing required \`title:\``).toBe(
          true
        );
      });

      it('frontmatter declares `description:`', () => {
        expect(
          /^description\s*:\s*\S/m.test(frontmatter),
          `${rel}: missing required \`description:\``
        ).toBe(true);
      });
    }
  );
});
