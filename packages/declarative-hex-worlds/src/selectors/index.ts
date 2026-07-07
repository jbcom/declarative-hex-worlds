/**
 * `src/selectors/` — `@internal` per-render shape pickers used by React hooks
 * and Three.js bindings.
 *
 * Selectors transform Koota world state into the read-only shapes a UI layer
 * cares about (coast variant, river crossing, road decoration). They are
 * intentionally **internal**: consumers should reach them via the React or
 * Three bindings rather than calling them directly, since their contract
 * changes whenever a render concern shifts.
 *
 * @module
 */

export * from './selectors';
