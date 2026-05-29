/**
 * Workflow contract — asserts the .github/workflows/*.yml + release-please
 * config + dependabot config maintain their structural invariants.
 *
 * Replaces the bespoke `scripts/audit-workflows.ts` (deleted) — same
 * assertions, expressed as a vitest spec so failures surface in the normal
 * test report, the assertions count toward coverage, and a contributor
 * editing a workflow gets feedback through `pnpm test` instead of having
 * to remember `pnpm test:workflows`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

const files = {
  automerge: '.github/workflows/automerge.yml',
  cd: '.github/workflows/cd.yml',
  ci: '.github/workflows/ci.yml',
  dependabot: '.github/dependabot.yml',
  release: '.github/workflows/release.yml',
  releasePleaseConfig: 'release-please-config.json',
  releasePleaseManifest: '.release-please-manifest.json',
  packageJson: 'package.json',
} as const;

function read(path: string): string {
  const resolved = resolve(workspaceRoot, path);
  if (!existsSync(resolved)) {
    return '';
  }
  return readFileSync(resolved, 'utf8');
}

function readJson<T>(path: string): T {
  const source = read(path);
  if (!source) {
    return {} as T;
  }
  return JSON.parse(source) as T;
}

describe('workflow contract', () => {
  describe('every workflow file exists', () => {
    for (const [name, path] of Object.entries(files)) {
      it(`${name} → ${path}`, () => {
        expect(existsSync(resolve(workspaceRoot, path)), `missing ${path}`).toBe(true);
      });
    }
  });

  describe('CI workflow shape', () => {
    it.each([
      ["NODE_VERSION: '22'"],
      ['pnpm/action-setup'],
      // The matrix-driven check job runs the four per-PR correctness gates.
      // Coverage enforcement runs in its own dedicated CI job (see below).
      ['task: [lint, typecheck, build, test]'],
      // dedicated coverage job runs the ratchet floor check on every PR
      ['pnpm test:coverage:enforce'],
      // browser-free job's vitest invocation
      ['pnpm test:browser:free'],
      // docs-site build (artifact uploaded for cd.yml to deploy)
      ['pnpm docs-site:build'],
      // screenshot diff artifact upload
      ['actions/upload-artifact'],
      // dep-review job
      ['fail-on-severity: high'],
    ])('includes %s', (snippet) => {
      expect(read(files.ci)).toContain(snippet);
    });

    it.each([
      // The lifecycle cleanup removed these — vitest contract specs
      // replaced the bespoke audits (which were jammed into a
      // misleadingly-named "npm Pack" mega-job). Re-introducing any
      // of these in CI would re-introduce the architecture problem
      // — guard against drift.
      ['pnpm test:workflows'],
      ['pnpm test:workspace'],
      ['pnpm test:assets'],
      ['pnpm test:package'],
      ['pnpm test:consumer'],
      ['pnpm test:cli'],
      ['pnpm test:docs-contract'],
      ['pnpm test:api-docs'],
      ['pnpm expectations'],
      ['pnpm pack:dry-run'],
      // The browser-free `if:` opt-in escape hatch was removed —
      // the job runs by default per PR.
      ["if: ${{ vars.RUN_BROWSER_VISUALS"],
      // No silenced failures
      ['continue-on-error: true'],
    ])('excludes %s (post-vitest-migration)', (snippet) => {
      expect(read(files.ci)).not.toContain(snippet);
    });
  });

  describe('release workflow shape', () => {
    it.each([
      ["NODE_VERSION: '22'"],
      ['pnpm/action-setup'],
      // OIDC trusted publishing requires id-token: write at job level
      ['id-token: write'],
      // Release-time security gate (per-PR uses dependency-review-action)
      ['pnpm audit --prod --audit-level=high'],
      // Coverage-enforce re-run at release for drift detection
      ['pnpm test:coverage:enforce'],
      // Publish step explicitly hands the packed tarball to npm publish
      // so the SLSA L3 attestation in the previous step covers the exact
      // bytes that ship.
      ['--access public --provenance'],
      // SLSA L3 build provenance
      ['actions/attest-build-provenance'],
      // CycloneDX SBOM (pinned devDependency, invoked via pnpm exec)
      ['cyclonedx-npm'],
    ])('includes %s', (snippet) => {
      expect(read(files.release)).toContain(snippet);
    });
  });

  describe('CD workflow shape', () => {
    it.each([
      ["NODE_VERSION: '22'"],
      ['pnpm/action-setup'],
      ['googleapis/release-please-action'],
      ['secrets.CI_GITHUB_TOKEN'],
      ['pnpm docs-site:build'],
      ['actions/deploy-pages'],
    ])('includes %s', (snippet) => {
      expect(read(files.cd)).toContain(snippet);
    });
  });

  describe('automerge workflow shape', () => {
    it.each([
      ["github.actor == 'dependabot[bot]'"],
      ["github.event.pull_request.user.login == 'dependabot[bot]'"],
      ["github.event.pull_request.user.type == 'Bot'"],
      ['github.event.pull_request.head.repo.full_name == github.repository'],
      ["startsWith(github.head_ref, 'release-please--')"],
      ['gh pr review "$PR_URL" --approve'],
      ['gh pr merge "$PR_URL" --auto --squash'],
    ])('includes %s', (snippet) => {
      expect(read(files.automerge)).toContain(snippet);
    });
  });

  describe('dependabot config shape', () => {
    it.each([
      ['package-ecosystem: "github-actions"'],
      ['package-ecosystem: "npm"'],
      ['github-actions-non-major'],
      ['github-actions-major'],
      ['npm-non-major'],
      ['npm-major'],
      ['update-types: ["minor", "patch"]'],
      ['update-types: ["major"]'],
    ])('includes %s', (snippet) => {
      expect(read(files.dependabot)).toContain(snippet);
    });
  });

  describe('every `uses:` reference pins a full commit SHA', () => {
    for (const workflow of ['ci', 'cd', 'release', 'automerge'] as const) {
      it(`${workflow} has no unpinned action references`, () => {
        const source = read(files[workflow]);
        const lines = source.split(/\r?\n/);
        const unsafe: string[] = [];

        for (const [index, line] of lines.entries()) {
          const match = /^\s*uses:\s*([^ #]+)/.exec(line);
          if (!match) continue;
          const action = match[1] ?? '';
          // Local actions don't need pinning
          if (action.startsWith('./')) continue;
          const refIndex = action.lastIndexOf('@');
          if (refIndex === -1) {
            unsafe.push(`line ${index + 1}: ${action} has no ref`);
            continue;
          }
          const ref = action.slice(refIndex + 1);
          if (!/^[a-f0-9]{40}$/i.test(ref)) {
            unsafe.push(`line ${index + 1}: ${action} ref ${ref} is not a 40-char SHA`);
          }
        }

        expect(unsafe, unsafe.join('\n')).toEqual([]);
      });
    }
  });

  describe('release-please config', () => {
    interface ReleasePleaseConfig {
      packages?: Record<string, { component?: string }>;
    }
    let config: ReleasePleaseConfig;
    beforeAll(() => {
      config = readJson<ReleasePleaseConfig>(files.releasePleaseConfig);
    });

    it('targets declarative-hex-worlds at the root package', () => {
      expect(config.packages?.['.']?.component).toBe('declarative-hex-worlds');
    });
  });

  describe('release-please manifest + package.json version lockstep', () => {
    interface PackageJson {
      version: string;
      engines?: Record<string, string>;
      packageManager?: string;
    }
    let manifest: Record<string, string>;
    let pkg: PackageJson;
    beforeAll(() => {
      manifest = readJson<Record<string, string>>(files.releasePleaseManifest);
      pkg = readJson<PackageJson>(files.packageJson);
    });

    it('manifest "." matches package.json#version', () => {
      // release-please bumps both in lockstep on each release PR. Drift
      // indicates a hand-edited manifest or a broken bump.
      expect(manifest['.']).toBe(pkg.version);
    });

    it('packageManager pins pnpm@9.15.9', () => {
      expect(pkg.packageManager).toBe('pnpm@9.15.9');
    });

    it('engines.node is >=22', () => {
      expect(pkg.engines?.node).toBe('>=22');
    });

    it('engines.pnpm is >=9', () => {
      expect(pkg.engines?.pnpm).toBe('>=9');
    });
  });
});
