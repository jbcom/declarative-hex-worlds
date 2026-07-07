/**
 * Root export surface for `declarative-hex-worlds`.
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

export * from './accessories';
export * from './actors';
export * from './classifiers';
export * from './commands';
export * from './asset-source';
export * from './camera';
export * from './coordinates';
export * from './errors';
export * from './gameboard';
export * from './interop';
export * from './koota';
export * from './manifest';
export * from './movement';
export * from './normalize';
export * from './overlay';
export * from './patrol';
export * from './pieces';
export * from './quests';
export * from './rules';
export * from './runtime';
export * from './scenario';
export * from './selectors';
export * from './simulation';
export * from './systems';
// NOTE: renderer bindings (./three) and React bindings (./react, ./react-elements)
// are intentionally NOT re-exported here. The main entrypoint is renderer-free so
// three / @react-three/fiber / react stay OPTIONAL peers — import them via the
// dedicated subpaths (`declarative-hex-worlds/three`, `/react`, `/react-elements`).
// The signals the bindings subscribe to ARE the koota traits exported above.
// Enforced by tests/contract/renderer-optionality-contract.test.ts.
