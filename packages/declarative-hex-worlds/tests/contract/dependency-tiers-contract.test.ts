/**
 * Dependency-tier contract (RFC 0001 RFC0-DEP).
 *
 * The package's dependency shape encodes its tiered model: a `./core` consumer
 * needs only the hard deps; the runtime/render tiers add optional peers. Each
 * engine (koota, react, three, R3F) is an OPTIONAL peer — required is WRONG,
 * because a `./core`-only consumer legitimately skips them and a required peer
 * would wrongly warn. This spec pins that shape so it can't silently drift back
 * to "everything required" (or to a hard koota dep that would defeat `./core`).
 *
 * The honest per-tier requirements (asserted structurally + documented in the
 * README):
 *   - `./core`                     → honeycomb-grid + zod  (NO koota/three/react)
 *   - main / runtime subpaths      → + koota (+ react for the bindings)
 *   - `./three`                    → + three
 *   - `./react` / `./react-elements` → + react (+ @react-three/fiber for elements)
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(import.meta.dirname, '..', '..');
const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

/** The hard deps the `./core` tier relies on (must always be plain dependencies). */
const REQUIRED_CORE_DEPS = ['honeycomb-grid', 'zod'];

/** The engine peers — each MUST be present and OPTIONAL (never a hard dep, never required). */
const OPTIONAL_ENGINE_PEERS = ['koota', 'react', 'react-dom', 'three', '@react-three/fiber'];

describe('dependency-tier contract', () => {
  it('the ./core hard deps (honeycomb-grid, zod) are plain dependencies', () => {
    for (const dep of REQUIRED_CORE_DEPS) {
      expect(pkg.dependencies[dep], `${dep} must be a hard dependency for the ./core tier`).toBeDefined();
    }
  });

  it('every engine (koota/react/three/R3F) is an OPTIONAL peer — not a hard dep, not required', () => {
    for (const engine of OPTIONAL_ENGINE_PEERS) {
      // Not a hard dependency (that would force it on ./core consumers).
      expect(pkg.dependencies[engine], `${engine} must NOT be a hard dependency`).toBeUndefined();
      // Listed as a peer.
      expect(pkg.peerDependencies[engine], `${engine} must be a peerDependency`).toBeDefined();
      // Marked optional (a required peer would wrongly warn ./core consumers).
      expect(
        pkg.peerDependenciesMeta?.[engine]?.optional,
        `${engine} peer must be optional:true — a ./core consumer legitimately skips it`
      ).toBe(true);
    }
  });

  it('koota is specifically an OPTIONAL peer, guaranteeing the ./core tier stays installable without it', () => {
    // The load-bearing assertion for RFC0-CORE: koota must never become a hard
    // dep or a required peer, or `declarative-hex-worlds/core` would drag it in.
    expect(pkg.dependencies.koota).toBeUndefined();
    expect(pkg.peerDependencies.koota).toBeDefined();
    expect(pkg.peerDependenciesMeta?.koota?.optional).toBe(true);
  });

  it('the README documents the per-tier dependency requirements', () => {
    const readme = readFileSync(join(packageRoot, 'README.md'), 'utf8');
    // The ./core tier + its minimal deps must be documented so consumers know
    // which engines each entrypoint needs.
    expect(readme).toMatch(/declarative-hex-worlds\/core/);
    expect(readme.toLowerCase()).toMatch(/honeycomb-grid/);
  });
});
