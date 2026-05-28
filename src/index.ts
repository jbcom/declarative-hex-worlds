/**
 * Root export surface for `medieval-hexagon-gameboard`.
 *
 * Forwards every library domain barrel verbatim. Each `src/<domain>/index.ts`
 * barrel is the curated public surface of its domain, so the root re-exports
 * them rather than hand-relisting every symbol — adding a public export to a
 * domain needs no edit here. Public-API tiering is enforced at
 * `package.json#exports` (which subpaths ship) + `@internal` JSDoc, not by a
 * hand-maintained root allow-list.
 *
 * The CLI-only `bootstrap` capability (and the upstream-layout fs-probers it
 * uses) are intentionally NOT re-exported here — they touch node builtins and
 * are reachable from `src/cli/` only. Consumers that bootstrap programmatically
 * import the dedicated `./bootstrap` subpath.
 *
 * @module
 */

export * from './actors';
export * from './commands';
export * from './coordinates';
export * from './errors';
export * from './gameboard';
export * from './interop';
export * from './koota';
export * from './manifest';
export * from './movement';
export * from './patrol';
export * from './pieces';
export * from './quests';
export * from './react';
export * from './rules';
export * from './runtime';
export * from './scenario';
export * from './selectors';
export * from './simulation';
export * from './systems';
export * from './three';
