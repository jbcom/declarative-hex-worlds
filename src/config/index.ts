/**
 * `src/config/` — logically-decomposed JSON configuration + a typed loader.
 *
 * Hardcoded tunables (KayKit GitHub source coordinates, bootstrap target paths,
 * the FREE/EXTRA upstream layout descriptors) live as JSON data here, with this
 * module providing typed, frozen access. Keeping them as data (not scattered
 * `const`s across the CLI/bootstrap code) makes the knobs discoverable and
 * editable in one place.
 *
 * Browser-safe: pure JSON imports, no node builtins. Not published as a public
 * subpath — consumed internally by the bootstrap command + upstream-layout.
 *
 * @module
 * @internal
 */
import type { PackEdition } from '../types';
import bootstrapPathsJson from './bootstrap-paths.json' with { type: 'json' };
import kaykitSourceJson from './kaykit-source.json' with { type: 'json' };
import upstreamLayoutsJson from './upstream-layouts.json' with { type: 'json' };

interface UpstreamLayoutConfig {
  readonly editionName: PackEdition;
  readonly displayName: string;
  readonly packFolderName: string;
  readonly relativeGltfRoot: string;
  readonly relativeTextureRoot: string;
  readonly assetCategories: readonly string[];
  readonly markerFiles: readonly string[];
  readonly expectedGltfCount: number;
  readonly expectedBinCount: number;
  readonly textureFiles: readonly string[];
}

interface BootstrapPathsConfig {
  readonly gltfRelative: string;
  readonly textureRelative: string;
  readonly sidecarFileName: string;
  readonly sidecarSchemaVersion: '1.0.0';
  readonly includedExtensions: readonly string[];
  readonly sourceFormatExtensions: readonly string[];
}

interface KaykitSourceConfig {
  readonly github: {
    readonly owner: string;
    readonly repo: string;
    readonly defaultRef: string;
    readonly archiveUrlTemplate: string;
  };
  readonly userAgent: string;
}

/** KayKit GitHub source coordinates + the stable archive-zip URL template. */
export const KAYKIT_SOURCE: KaykitSourceConfig = kaykitSourceJson;

/** Bootstrap target path segments + integrity-sidecar metadata. */
export const BOOTSTRAP_PATHS: BootstrapPathsConfig = bootstrapPathsJson as BootstrapPathsConfig;

/** Raw FREE/EXTRA upstream layout descriptors keyed by edition. */
export const UPSTREAM_LAYOUTS: Readonly<Record<PackEdition, UpstreamLayoutConfig>> =
  upstreamLayoutsJson as Readonly<Record<PackEdition, UpstreamLayoutConfig>>;

/**
 * Allowed characters for a git ref passed via `--commit`. Keeps the set tight
 * (alphanumeric + `.` `_` `-` `/`) to prevent URL injection (CWE-74/CWE-918).
 */
const SAFE_REF = /^(?!.*\.\.)(?!\.)(?!.*\/$)[a-zA-Z0-9._\-/]{1,200}$/;

/** Resolve the stable GitHub archive-zip URL for a ref (defaults to `main`). */
export function kaykitGithubArchiveUrl(ref?: string): string {
  const { owner, repo, defaultRef, archiveUrlTemplate } = KAYKIT_SOURCE.github;
  const resolvedRef = ref ?? defaultRef;
  if (!SAFE_REF.test(resolvedRef)) {
    throw new Error(`unsafe git ref rejected: "${resolvedRef}"`);
  }
  return archiveUrlTemplate
    .replace('{owner}', encodeURIComponent(owner))
    .replace('{repo}', encodeURIComponent(repo))
    .replace('{ref}', resolvedRef.split('/').map(encodeURIComponent).join('/'));
}
