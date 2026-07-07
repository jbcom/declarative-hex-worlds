/**
 * `src/react/` — React bindings (first-class, NOT peer-dep gated).
 *
 * Per the PRD bundled-bindings correction (2026-05-26): react/react-dom
 * are hard `dependencies`, not optional peers. The library is unusable
 * without its bindings — same shape as koota itself. No runtime guard,
 * no peer-missing branch.
 *
 * @module
 */

export * from './react';
