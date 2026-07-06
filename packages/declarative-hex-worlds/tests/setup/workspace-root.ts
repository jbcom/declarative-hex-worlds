/**
 * Resolve the workspace root (the directory containing `pnpm-workspace.yaml`)
 * by walking up from a starting directory. Contract tests that assert
 * repo-level artifacts (`.github/`, release-please config/manifest, the
 * `packages/docs-site` app) live INSIDE the published package
 * (`packages/declarative-hex-worlds/`), so a fixed number of `..` hops is
 * brittle — this walks up until it finds the workspace marker instead.
 *
 * Package-level artifacts (README/NOTICE/LICENSE, `src/`, `assets/`,
 * `package.json`) stay resolved relative to the package root and must NOT use
 * this helper.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function findWorkspaceRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 12; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate pnpm-workspace.yaml walking up from ${startDir} — is the workspace intact?`,
  );
}
