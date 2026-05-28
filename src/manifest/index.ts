/**
 * `src/manifest/` — asset manifest schema, bundled FREE manifest metadata,
 * and (post-PRD-RB) the lazy loader for bootstrap-target assets.
 *
 * Public surface re-exported from the umbrella `medieval-hexagon-gameboard`.
 * The published `package.json#exports` map retains `./manifest/schema` and
 * `./manifest/free` as distinct subpaths for consumers that want to depth-pin
 * (e.g. validators that only need the schema), but **internal** sibling
 * modules MUST import from this barrel (`'../manifest'`) per the
 * barrel-only cross-domain import rule.
 *
 * Sub-modules:
 * - `./schema` — `MedievalHexagonManifest` shape, normalization helpers, validators
 * - `./free` — pre-baked FREE-edition manifest (JSON metadata describing what
 *   `bootstrap` populates under `<consumer-out>/addons/kaykit_medieval_hexagon_pack/`)
 *
 * @module
 */

export * from './free';
export * from './schema';
// NOTE: `upstream-layout` moved to the bootstrap (CLI) domain in LF3 — it is
// consumed only by bootstrap, touches node:fs/node:path, and is server-only.
// Reachable via `./bootstrap` (umbrella does not re-export it).
