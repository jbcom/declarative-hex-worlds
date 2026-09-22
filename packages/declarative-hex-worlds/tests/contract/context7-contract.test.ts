import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot } from '../setup/workspace-root';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Context7Config {
  $schema?: string;
  projectTitle?: string;
  branch?: string;
  folders?: string[];
  excludeFolders?: string[];
  rules?: string[];
}

const workspaceRoot = findWorkspaceRoot(import.meta.dirname);
const config = JSON.parse(
  readFileSync(resolve(workspaceRoot, 'context7.json'), 'utf8')
) as Context7Config;

describe('Context7 owner configuration', () => {
  it('pins the official schema and the canonical branch', () => {
    expect(config.$schema).toBe('https://context7.com/schema/context7.json');
    expect(config.branch).toBe('main');
    expect(config.projectTitle).toBe('Declarative Hex Worlds');
  });

  it('indexes canonical documentation and public API source without local assets', () => {
    expect(config.folders).toEqual(
      expect.arrayContaining(['docs', 'packages/declarative-hex-worlds/docs', 'packages/declarative-hex-worlds/src'])
    );
    expect(config.excludeFolders).toEqual(
      expect.arrayContaining(['node_modules', 'references', 'models', 'tests', 'docs/dist'])
    );
    expect(config.rules?.length).toBeGreaterThan(0);
  });
});
