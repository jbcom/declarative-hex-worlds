/**
 * Runtime asset bootstrap for KayKit Medieval Hexagon Pack consumers.
 *
 * @remarks
 * The published library tarball ships only the JSON manifest metadata; the
 * KayKit GLTF asset tree is not bundled. Consumers run this bootstrap step
 * after install to materialize the asset tree into their app's asset root.
 *
 * The end-user workflow + on-disk layout reference live in the docs-site
 * guides directory under the consumer-facing documentation site.
 *
 * @module
 */
import { createHash } from 'node:crypto';
import {
  closeSync,
  createReadStream,
  createWriteStream,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  realpathSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';
import { BOOTSTRAP_PATHS, KAYKIT_SOURCE, kaykitGithubArchiveUrl } from '../../../config';
import { GameboardIoError, GameboardManifestError } from '../../../errors';
import {
  detectKayKitLayout,
  kayKitLayoutForEdition,
  type KayKitUpstreamLayout,
} from './upstream-layout';
import type { PackEdition } from '../../../types';
import {
  KAYKIT_BOOTSTRAP_GLTF_RELATIVE,
  KAYKIT_BOOTSTRAP_SIDECAR,
  KAYKIT_BOOTSTRAP_TEXTURE_RELATIVE,
  resolveBootstrapSidecarPath,
} from './target';

/**
 * Canonical GitHub organization holding the FREE edition source tree.
 */
export const KAYKIT_FREE_GITHUB_OWNER = KAYKIT_SOURCE.github.owner;

/**
 * Canonical GitHub repository name for the FREE edition (the repo at
 * `KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0`).
 */
export const KAYKIT_FREE_GITHUB_REPO = KAYKIT_SOURCE.github.repo;

/**
 * Default git ref the bootstrap CLI fetches when no `--commit` is supplied.
 */
export const KAYKIT_FREE_GITHUB_DEFAULT_REF = KAYKIT_SOURCE.github.defaultRef;

/**
 * Source descriptor for {@link BootstrapKayKitAssetsOptions}. Discriminates
 * between fetching from the upstream GitHub repo and extracting a locally
 * cached zip archive.
 */
export type BootstrapKayKitAssetsSource =
  | {
      /** Source kind discriminator selecting the upstream-GitHub tarball path. */
      readonly kind: 'github';
      /** Optional git ref (commit / tag / branch). Defaults to {@link KAYKIT_FREE_GITHUB_DEFAULT_REF}. */
      readonly commit?: string;
    }
  | {
      /** Source kind discriminator selecting the local-zip extraction path. */
      readonly kind: 'zip';
      /** Filesystem path of the locally cached pack zip. */
      readonly path: string;
    };

/**
 * Inputs to {@link bootstrapKayKitAssets}.
 */
export interface BootstrapKayKitAssetsOptions {
  /** Where to fetch the upstream source tree from. */
  readonly source: BootstrapKayKitAssetsSource;
  /**
   * Consumer's asset root. The bootstrap step writes
   * `<out>/addons/kaykit_medieval_hexagon_pack/...` under this folder.
   */
  readonly out: string;
  /** Pack edition (default `free`). `extra` requires `source.kind === 'zip'`. */
  readonly edition?: PackEdition;
  /**
   * When true, the destination is wiped before mirroring. When false
   * (default), an existing non-empty target throws unless its sidecar matches
   * the requested edition.
   */
  readonly force?: boolean;
  /**
   * Include `.fbx`, `.fbx(unity)`, `.obj`, `.mtl` files. Default false —
   * only `.gltf`, `.bin`, and PNG textures are mirrored.
   */
  readonly includeSourceFormats?: boolean;
  /**
   * Optional jail root for `out` resolution. Defaults to `process.cwd()`.
   * The bootstrap function refuses to write outside this root.
   */
  readonly outRoot?: string;
  /**
   * Reproducible timestamp written into the integrity sidecar. Default
   * `new Date().toISOString()`.
   */
  readonly fetchedAt?: string;
  /**
   * Override for the integrity sidecar's `libraryVersion` field. Defaults to
   * the value resolved from the closest `package.json`.
   */
  readonly libraryVersion?: string;
}

/**
 * Per-file entry in the integrity sidecar.
 */
export interface BootstrapFileEntry {
  /** POSIX path relative to `<out>/addons/kaykit_medieval_hexagon_pack/`. */
  readonly path: string;
  /** SHA-256 hash of the file's contents, lowercase hex. */
  readonly sha256: string;
  /** Byte length of the file at fetch time. */
  readonly bytes: number;
}

/**
 * Integrity sidecar serialized as `.bootstrap.json` inside each bootstrap
 * target.
 */
export interface BootstrapSidecar {
  /** Sidecar schema version. */
  readonly schemaVersion: '1.0.0';
  /** Pack edition this target was bootstrapped for. */
  readonly edition: PackEdition;
  /** Library version that produced this bootstrap. */
  readonly libraryVersion: string;
  /** Provenance URL (https://...) or `file://` URL for zip-sourced bootstraps. */
  readonly sourceUrl: string;
  /** ISO-8601 timestamp at which the bootstrap was performed. */
  readonly fetchedAt: string;
  /** Sorted list of every mirrored file plus its SHA-256. */
  readonly files: readonly BootstrapFileEntry[];
}

/**
 * Return value of {@link bootstrapKayKitAssets}.
 */
export interface BootstrapResult {
  /** Pack edition that was bootstrapped. */
  readonly edition: PackEdition;
  /** Absolute path of the bootstrap target root. */
  readonly outRoot: string;
  /** Total number of files written (gltf + bin + textures + any extras). */
  readonly fileCount: number;
  /** Sum of {@link BootstrapFileEntry.bytes}. */
  readonly totalBytes: number;
  /** Absolute path of the integrity sidecar. */
  readonly integritySidecar: string;
}

/**
 * Verification report returned by {@link verifyBootstrap}.
 */
export interface BootstrapVerificationReport {
  /** True when every recorded file matches its expected hash and length. */
  readonly ok: boolean;
  /** Human-readable descriptions of any drift discovered. */
  readonly drift: readonly string[];
  /** Sidecar that was checked. */
  readonly sidecarPath: string;
}

const KAYKIT_FREE_USER_AGENT = KAYKIT_SOURCE.userAgent;
const KAYKIT_INCLUDED_EXTENSIONS = new Set(BOOTSTRAP_PATHS.includedExtensions);
const KAYKIT_SOURCE_FORMAT_EXTENSIONS = new Set(BOOTSTRAP_PATHS.sourceFormatExtensions);
const KAYKIT_SIDECAR_SCHEMA_VERSION = BOOTSTRAP_PATHS.sidecarSchemaVersion;

/**
 * Materialize the KayKit asset tree under the consumer's asset root.
 */
export async function bootstrapKayKitAssets(
  options: BootstrapKayKitAssetsOptions
): Promise<BootstrapResult> {
  const edition = options.edition ?? 'free';
  if (edition === 'extra' && options.source.kind === 'github') {
    throw new GameboardIoError(
      'EXTRA edition cannot be bootstrapped from GitHub (CC0 license covers FREE only). Pass --source zip with a purchased archive.'
    );
  }
  const layout = kayKitLayoutForEdition(edition);
  const outAbsolute = resolveOutAbsolute(options.out, options.outRoot);
  const targetRoot = outAbsolute;
  const sidecarPath = resolveBootstrapSidecarPath(outAbsolute);
  const fetchedAt = options.fetchedAt ?? new Date().toISOString();
  const libraryVersion = options.libraryVersion ?? resolveLibraryVersion();

  if (options.force === true) {
    rmSync(targetRoot, { recursive: true, force: true });
  } else if (existsSync(targetRoot) && readdirSync(targetRoot).length > 0) {
    // Idempotency: if the existing sidecar matches the requested edition,
    // treat as a no-op return rather than throwing. This makes repeated
    // `pnpm bootstrap` invocations cheap + the failure mode is reserved
    // for genuine destination conflicts.
    if (existsSync(sidecarPath)) {
      try {
        const existing = readSidecar(sidecarPath, targetRoot);
        if (existing.edition === edition) {
          const totalBytes = existing.files.reduce((sum, file) => sum + file.bytes, 0);
          return {
            edition,
            outRoot: targetRoot,
            fileCount: existing.files.length,
            totalBytes,
            integritySidecar: sidecarPath,
          };
        }
      } catch {
        // Corrupt sidecar — fall through to the non-empty error.
      }
    }
    throw new GameboardIoError(
      `Bootstrap destination ${targetRoot} is not empty; pass force: true to overwrite.`
    );
  }
  mkdirSync(targetRoot, { recursive: true });

  const stagingRoot = await stageUpstreamSource(options.source, layout, edition);
  try {
    const packRoot = await resolvePackRoot(stagingRoot, edition);
    const includeSourceFormats = options.includeSourceFormats === true;
    const files = mirrorPackTree(packRoot, layout, targetRoot, includeSourceFormats);
    const sidecar: BootstrapSidecar = {
      schemaVersion: KAYKIT_SIDECAR_SCHEMA_VERSION,
      edition,
      libraryVersion,
      sourceUrl: describeSourceUrl(options.source, edition),
      fetchedAt,
      files,
    };
    writeFileSync(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`, 'utf8');
    const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
    return {
      edition,
      outRoot: targetRoot,
      fileCount: files.length,
      totalBytes,
      integritySidecar: sidecarPath,
    };
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

/**
 * Re-hash every file recorded in an integrity sidecar and report drift.
 */
export async function verifyBootstrap(outRoot: string): Promise<BootstrapVerificationReport> {
  const targetRoot = resolve(outRoot);
  const sidecarPath = join(targetRoot, KAYKIT_BOOTSTRAP_SIDECAR);
  if (!existsSync(sidecarPath)) {
    return {
      ok: false,
      drift: [`integrity sidecar missing: ${sidecarPath}`],
      sidecarPath,
    };
  }
  const sidecar = readSidecar(sidecarPath, targetRoot);
  const drift: string[] = [];
  for (const entry of sidecar.files) {
    const absolute = join(targetRoot, entry.path);
    // Reject sidecar entries that escape targetRoot via `..` segments or
    // absolute paths — a tampered sidecar could otherwise point hashFile
    // at arbitrary host files (CodeQL / CodeRabbit hardening).
    const rel = relative(targetRoot, absolute);
    if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      drift.push(`unsafe sidecar entry path: ${entry.path}`);
      continue;
    }
    if (!existsSync(absolute)) {
      drift.push(`missing file: ${entry.path}`);
      continue;
    }
    const actualBytes = statSync(absolute).size;
    if (actualBytes !== entry.bytes) {
      drift.push(`size mismatch for ${entry.path}: expected ${entry.bytes}, got ${actualBytes}`);
      continue;
    }
    const actualHash = await hashFile(absolute);
    if (actualHash !== entry.sha256) {
      drift.push(`hash mismatch for ${entry.path}`);
    }
  }
  return {
    ok: drift.length === 0,
    drift,
    sidecarPath,
  };
}

/**
 * Format the canonical GitHub source-archive **zip** URL for a given ref (or
 * `main` when unset). GitHub serves a stable, never-changing archive at
 * `/archive/refs/heads/<ref>.zip`, so bootstrap downloads it and feeds the
 * exact same local-zip extraction flow as a user-supplied archive — no tarball
 * decompression and no git dependency.
 */
export function kayKitFreeGithubTarballUrl(commit?: string): string {
  return kaykitGithubArchiveUrl(commit);
}

function resolveOutAbsolute(value: string, outRoot: string | undefined): string {
  const root = resolve(outRoot ?? process.cwd());
  const resolved = resolve(root, value);
  const rel = relative(root, resolved);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
    return resolved;
  }
  throw new GameboardIoError(
    `bootstrap out path escapes the output root: ${value} (root: ${root})`
  );
}

async function stageUpstreamSource(
  source: BootstrapKayKitAssetsSource,
  layout: KayKitUpstreamLayout,
  edition: PackEdition
): Promise<string> {
  if (source.kind !== 'github') {
    return stageFromZip(source.path, layout, edition);
  }
  // GitHub source: download the stable archive zip into a temp dir, extract
  // via the shared stageFromZip path, then unconditionally clean up the temp
  // download dir (the staging root from stageFromZip is cleaned by the caller).
  const url = kayKitFreeGithubTarballUrl(source.commit);
  const downloadRoot = mkStagingRoot('github-zip');
  const zipPath = join(downloadRoot, 'kaykit-medieval-hexagon-free.zip');
  try {
    const incoming = await openHttpsStream(url);
    try {
      await pipeline(incoming, createWriteStream(zipPath));
    } catch (pipelineError) {
      // If `pipeline` setup fails (e.g. createWriteStream EACCES), the
      // upstream https stream is left dangling and would leak the socket
      // until the connection times out. Force-destroy it here so the network
      // connection is reclaimed immediately. The runtime object is a
      // `Readable` (has `.destroy()`); the structural type-only
      // `NodeJS.ReadableStream` doesn't expose it, hence the cast.
      (incoming as { destroy?: () => void }).destroy?.();
      throw pipelineError;
    }
    return await stageFromZip(zipPath, layout, edition);
  } catch (error) {
    /* v8 ignore next -- filesystem/yauzl/bootstrap failures are Error instances; String fallback is for JS interop. */
    const message = error instanceof Error ? error.message : String(error);
    throw new GameboardIoError(`failed to download KayKit FREE archive ${url}: ${message}`);
  } finally {
    rmSync(downloadRoot, { recursive: true, force: true });
  }
}

async function stageFromZip(
  zipPath: string,
  layout: KayKitUpstreamLayout,
  edition: PackEdition
): Promise<string> {
  const absoluteZip = resolve(zipPath);
  if (!existsSync(absoluteZip)) {
    throw new GameboardIoError(`zip source does not exist: ${absoluteZip}`);
  }
  const stagingRoot = mkStagingRoot('zip');
  let succeeded = false;
  try {
    await extractZipTo(absoluteZip, stagingRoot);
    // Reject obvious edition mismatches early.
    const detectedRoot = findPackRoot(stagingRoot);
    if (detectedRoot) {
      const detectedLayout = detectKayKitLayout(detectedRoot);
      if (detectedLayout && detectedLayout.editionName !== edition) {
        throw new GameboardIoError(
          `zip contains the ${detectedLayout.editionName.toUpperCase()} edition but bootstrap was asked for ${edition.toUpperCase()}.`
        );
      }
      /* v8 ignore next 5 -- findPackRoot only returns directories after detectKayKitLayout succeeds; this protects filesystem races. */
      if (!detectedLayout) {
        throw new GameboardIoError(
          `zip ${absoluteZip} does not look like a KayKit Medieval Hexagon Pack root (expected ${layout.packFolderName}/).`
        );
      }
    }
    succeeded = true;
    return stagingRoot;
  } catch (error) {
    /* v8 ignore next -- filesystem/yauzl/bootstrap failures are Error instances; String fallback is for JS interop. */
    const message = error instanceof Error ? error.message : String(error);
    throw error instanceof GameboardIoError
      ? error
      : new GameboardIoError(`failed to extract zip ${absoluteZip}: ${message}`);
  } finally {
    if (!succeeded) {
      rmSync(stagingRoot, { recursive: true, force: true });
    }
  }
}

async function resolvePackRoot(
  stagingRoot: string,
  edition: PackEdition
): Promise<string> {
  const detected = findPackRoot(stagingRoot);
  if (!detected) {
    throw new GameboardIoError(
      `staged source under ${stagingRoot} does not contain a recognizable KayKit pack root.`
    );
  }
  const layout = detectKayKitLayout(detected);
  /* v8 ignore next 10 -- stageFromZip prevalidates layout/edition and findPackRoot guarantees a detected layout; these protect filesystem races/future callers. */
  if (!layout) {
    throw new GameboardIoError(
      `staged source under ${detected} does not match a known KayKit layout (missing markers).`
    );
  }
  /* v8 ignore next 5 -- stageFromZip rejects edition mismatches before resolvePackRoot returns; this protects future callers. */
  if (layout.editionName !== edition) {
    throw new GameboardIoError(
      `staged source is ${layout.editionName.toUpperCase()} edition; bootstrap was asked for ${edition.toUpperCase()}.`
    );
  }
  return detected;
}

function findPackRoot(stagingRoot: string, maxDepth = 4): string | undefined {
  if (detectKayKitLayout(stagingRoot)) {
    return stagingRoot;
  }
  if (maxDepth <= 0) {
    return undefined;
  }
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(stagingRoot, { withFileTypes: true });
  } catch {
    /* v8 ignore next -- extraction-created directories are readable; this protects filesystem races. */
    return undefined;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    // GitHub archives nest the pack under `<repo>-<ref>/addons/<pack>/`;
    // recurse up to maxDepth levels to handle varying nesting depths.
    const found = findPackRoot(join(stagingRoot, entry.name), maxDepth - 1);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function mirrorPackTree(
  packRoot: string,
  layout: KayKitUpstreamLayout,
  targetRoot: string,
  includeSourceFormats: boolean
): BootstrapFileEntry[] {
  const gltfSource = join(packRoot, layout.relativeGltfRoot);
  const gltfTarget = join(targetRoot, KAYKIT_BOOTSTRAP_GLTF_RELATIVE);
  mkdirSync(gltfTarget, { recursive: true });
  const entries: BootstrapFileEntry[] = [];
  for (const filePath of walkFiles(gltfSource)) {
    if (!shouldInclude(filePath, includeSourceFormats)) {
      continue;
    }
    const relPath = toPosix(relative(gltfSource, filePath));
    const targetPath = join(gltfTarget, relPath);
    mkdirSync(dirname(targetPath), { recursive: true });
    const bytes = copyAndHash(filePath, targetPath);
    entries.push({
      path: toPosix(join(KAYKIT_BOOTSTRAP_GLTF_RELATIVE, relPath)),
      sha256: bytes.sha256,
      bytes: bytes.size,
    });
  }
  const textureSource = join(packRoot, layout.relativeTextureRoot);
  if (existsSync(textureSource)) {
    const textureTarget = join(targetRoot, KAYKIT_BOOTSTRAP_TEXTURE_RELATIVE);
    mkdirSync(textureTarget, { recursive: true });
    for (const fileName of layout.textureFiles) {
      const source = join(textureSource, fileName);
      if (!existsSync(source)) {
        continue;
      }
      const target = join(textureTarget, fileName);
      const bytes = copyAndHash(source, target);
      entries.push({
        path: toPosix(join(KAYKIT_BOOTSTRAP_TEXTURE_RELATIVE, fileName)),
        sha256: bytes.sha256,
        bytes: bytes.size,
      });
    }
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

function shouldInclude(filePath: string, includeSourceFormats: boolean): boolean {
  const extension = lowercaseExtension(filePath);
  if (KAYKIT_INCLUDED_EXTENSIONS.has(extension)) {
    return true;
  }
  if (includeSourceFormats && KAYKIT_SOURCE_FORMAT_EXTENSIONS.has(extension)) {
    return true;
  }
  return false;
}

function walkFiles(root: string): string[] {
  const real = realpathSync(root);
  return walkFilesInternal(root, real);
}

function walkFilesInternal(
  dir: string,
  rootReal: string,
  symlinkCount = { n: 0 }
): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    /* v8 ignore next 10 -- yauzl extraction materializes regular files/directories; this guard protects future directory sources and malformed filesystems. */
    if (entry.isSymbolicLink()) {
      symlinkCount.n += 1;
      if (symlinkCount.n === 1) {
        // Warn once — symlinks in an upstream asset pack are unexpected and
        // can indicate a malformed zip or a zip-slip that bypassed extraction guards.
        process.stderr.write(
          `[declarative-hex-worlds] warning: symlink skipped during asset walk: ${join(dir, entry.name)}\n`
        );
      }
      continue;
    }
    const childPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const childReal = realpathSync(childPath);
      /* v8 ignore next 3 -- a real directory beneath root cannot escape without concurrent filesystem mutation. */
      if (childReal !== rootReal && !childReal.startsWith(`${rootReal}${sep}`)) {
        continue;
      }
      out.push(...walkFilesInternal(childPath, rootReal, symlinkCount));
      continue;
    }
    /* v8 ignore next 3 -- extracted entries are handled as directories or regular files by this point. */
    if (entry.isFile()) {
      out.push(childPath);
    }
  }
  return out;
}

function copyAndHash(source: string, target: string): { sha256: string; size: number } {
  const buffer = readFileSync(source);
  writeFileSync(target, buffer);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  return { sha256, size: buffer.byteLength };
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

const SIDECAR_MAX_BYTES = 4 * 1024 * 1024; // 4 MB ceiling — a legitimate sidecar is <100 KB
const SIDECAR_MAX_FILES = 100_000; // sanity bound: free pack has ~700 assets

function readSidecar(path: string, expectedDir: string): BootstrapSidecar {
  // Resolve symlinks before the confinement check so a symlink attack cannot
  // redirect the read outside the expected bootstrap output directory.
  const realPath = realpathSync(path);
  const realDir = realpathSync(expectedDir);
  if (!realPath.startsWith(realDir + sep) && realPath !== realDir) {
    throw new GameboardManifestError(
      `bootstrap sidecar path escapes expected directory: ${path}`
    );
  }
  // Open once and keep the fd for both size check and read — eliminates the
  // TOCTOU window between a statSync confinement check and a separate readFileSync.
  const fd = openSync(realPath, 'r');
  let raw: string;
  try {
    const { size } = fstatSync(fd);
    if (size > SIDECAR_MAX_BYTES) {
      throw new GameboardManifestError(
        `bootstrap sidecar at ${path} is suspiciously large (${size} bytes); refusing to parse`
      );
    }
    raw = readFileSync(fd, 'utf8');
  } finally {
    closeSync(fd);
  }
  const parsed = JSON.parse(raw) as BootstrapSidecar;
  if (parsed.schemaVersion !== KAYKIT_SIDECAR_SCHEMA_VERSION) {
    throw new GameboardManifestError(
      `unsupported bootstrap sidecar schema ${parsed.schemaVersion} at ${path}`
    );
  }
  if (!Array.isArray(parsed.files)) {
    throw new GameboardManifestError(`malformed bootstrap sidecar at ${path}`);
  }
  if (parsed.files.length > SIDECAR_MAX_FILES) {
    throw new GameboardManifestError(
      `bootstrap sidecar at ${path} lists ${parsed.files.length} files (max ${SIDECAR_MAX_FILES}); refusing to load`
    );
  }
  return parsed;
}


function describeSourceUrl(
  source: BootstrapKayKitAssetsSource,
  edition: PackEdition
): string {
  if (source.kind === 'github') {
    return kayKitFreeGithubTarballUrl(source.commit);
  }
  return `file://${resolve(source.path)}#${edition}`;
}

function resolveLibraryVersion(): string {
  // Walk up from this module's URL until we find a package.json that names
  // this library. Falls back to '0.0.0' so tests can override.
  let dir = import.meta.dirname;
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as { version?: string; name?: string };
      /* v8 ignore next 3 -- the package-local package.json is the supported install shape. */
      if (parsed.name === 'declarative-hex-worlds' && typeof parsed.version === 'string') {
        return parsed.version;
      }
    }
    const parent = dirname(dir);
    /* v8 ignore next 3 -- supported installs always find the package before filesystem root. */
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  /* v8 ignore next -- last-resort fallback for unusual embedded package layouts without package.json. */
  return '0.0.0';
}

function mkStagingRoot(prefix: string): string {
  const root = join(tmpdir(), `kaykit-bootstrap-${prefix}-${Date.now()}-${process.pid}`);
  mkdirSync(root, { recursive: true });
  return root;
}

/**
 * Hosts the bootstrap is willing to follow redirects to. The initial URL is a
 * pinned github.com archive; GitHub's archive endpoint 302s to `codeload` and
 * then to a signed S3-backed `objects.githubusercontent.com` URL. Anything
 * outside this allowlist gets rejected so a hostile redirect chain cannot
 * exfiltrate the User-Agent or trick bootstrap into fetching arbitrary URLs
 * (CWE-601 / CWE-918).
 */
const KAYKIT_FETCH_REDIRECT_ALLOWLIST = new Set([
  'github.com',
  'codeload.github.com',
  'objects.githubusercontent.com',
]);

async function openHttpsStream(url: string, redirects = 0): Promise<NodeJS.ReadableStream> {
  if (redirects > 5) {
    throw new GameboardIoError(`too many redirects fetching ${url}`);
  }
  return new Promise<NodeJS.ReadableStream>((resolveStream, reject) => {
    const requestObject = httpsRequest(
      url,
      {
        method: 'GET',
        headers: {
          'User-Agent': KAYKIT_FREE_USER_AGENT,
          Accept: 'application/zip',
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location) {
          response.resume();
          const nextUrl = new URL(location, url);
          if (!KAYKIT_FETCH_REDIRECT_ALLOWLIST.has(nextUrl.hostname)) {
            reject(
              new GameboardIoError(
                `bootstrap refuses redirect to disallowed host ${nextUrl.hostname} (from ${url})`
              )
            );
            return;
          }
          openHttpsStream(nextUrl.toString(), redirects + 1).then(resolveStream, reject);
          return;
        }
        if (status !== 200) {
          response.resume();
          reject(new GameboardIoError(`unexpected status ${status} fetching ${url}`));
          return;
        }
        resolveStream(response);
      }
    );
    requestObject.on('error', reject);
    requestObject.end();
  });
}

/**
 * Per-entry decompressed byte ceiling. KayKit's largest GLTF is well under
 * 1 MB; the upstream pack's total uncompressed size is ~12 MB. 64 MB per entry
 * is a generous cushion that still defends against zip-bomb decompression
 * blow-ups (CWE-409): a single malicious entry can no longer fill the disk
 * via a high compression ratio.
 */
const KAYKIT_MAX_ZIP_ENTRY_BYTES = 64 * 1024 * 1024;

async function extractZipTo(zipPath: string, targetRoot: string): Promise<void> {
  await new Promise<void>((resolveExtract, rejectExtract) => {
    yauzl.open(zipPath, { lazyEntries: true }, (openErr, zipFile) => {
      /* v8 ignore next 4 -- yauzl supplies a zipFile whenever openErr is absent; the fallback is for callback contract drift. */
      if (openErr || !zipFile) {
        rejectExtract(openErr ?? new Error('failed to open zip'));
        return;
      }
      zipFile.on('error', rejectExtract);
      zipFile.on('end', resolveExtract);
      zipFile.on('entry', (entry) => {
        const entryPath = entry.fileName;
        // Reject zip-slip attempts.
        const targetPath = join(targetRoot, entryPath);
        const relativeTarget = relative(targetRoot, targetPath);
        /* v8 ignore next 4 -- yauzl rejects traversal names before entry callbacks; retained as defense in depth. */
        if (relativeTarget.startsWith('..') || isAbsolute(relativeTarget)) {
          rejectExtract(new GameboardIoError(`zip entry escapes target root: ${entryPath}`));
          return;
        }
        if (/\/$/.test(entryPath)) {
          mkdirSync(targetPath, { recursive: true });
          zipFile.readEntry();
          return;
        }
        // Reject obviously oversized entries before opening the read stream
        // (the central-directory size is advisory but a clear up-front reject
        // is friendlier than aborting mid-stream).
        if (entry.uncompressedSize > KAYKIT_MAX_ZIP_ENTRY_BYTES) {
          rejectExtract(
            new GameboardIoError(
              `zip entry ${entryPath} declares ${entry.uncompressedSize} bytes uncompressed; max ${KAYKIT_MAX_ZIP_ENTRY_BYTES}`
            )
          );
          return;
        }
        mkdirSync(dirname(targetPath), { recursive: true });
        zipFile.openReadStream(entry, (entryErr, readStream) => {
          /* v8 ignore next 4 -- yauzl returns a stream for valid entries; retained for callback/library failures. */
          if (entryErr || !readStream) {
            rejectExtract(entryErr ?? new Error(`failed to read zip entry ${entryPath}`));
            return;
          }
          // Defense in depth: the central-directory `uncompressedSize` can lie;
          // count actual decompressed bytes and abort if the cap is breached.
          let written = 0;
          const writeStream = createWriteStream(targetPath);
          writeStream.on('error', rejectExtract);
          writeStream.on('close', () => zipFile.readEntry());
          readStream.on('error', rejectExtract);
          readStream.on('data', (chunk: Buffer) => {
            written += chunk.length;
            /* v8 ignore next 9 -- declared-size precheck covers normal bombs; this protects deceptive streams larger than yauzl's validated size. */
            if (written > KAYKIT_MAX_ZIP_ENTRY_BYTES) {
              readStream.destroy();
              writeStream.destroy();
              rejectExtract(
                new GameboardIoError(
                  `zip entry ${entryPath} exceeded ${KAYKIT_MAX_ZIP_ENTRY_BYTES} bytes during extraction`
                )
              );
            }
          });
          readStream.pipe(writeStream);
        });
      });
      zipFile.readEntry();
    });
  });
}

function toPosix(value: string): string {
  return value.split(sep).join('/');
}

function lowercaseExtension(filePath: string): string {
  const fileName = basename(filePath);
  const idx = fileName.lastIndexOf('.');
  if (idx < 0) {
    return '';
  }
  return fileName.slice(idx).toLowerCase();
}
