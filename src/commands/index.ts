/**
 * `src/commands/` — `@internal` action factories consumed by `src/actions.ts`
 * (post-Epic-R2r composition layer) and by `runtime.ts` / `simulation.ts`.
 *
 * Commands describe what mutations the simulation can apply to the world
 * (move actor, attack actor, interact, route patrol). Each command kind has
 * a request/handler signature; the `createGameboardCommandActions` factory
 * binds them to a Koota world and exposes them as hook-friendly handles.
 *
 * Internal because consumers should reach commands through the React /
 * Three bindings or the simulation step DSL — never call the factory
 * directly.
 *
 * @module
 */

export * from './commands';
