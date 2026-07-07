/**
 * `src/core/` — the `declarative-hex-worlds/core` tier (RFC 0001 RFC0-CORE).
 *
 * The koota-free AND three-free surface: everything a consumer needs to author,
 * validate, and compute hex-world state WITHOUT a live ECS runtime or a renderer.
 * A `./core`-only consumer installs just `honeycomb-grid` + `zod` — no koota, no
 * three, no react. They bring their own runtime (mount via interop) and/or their
 * own renderer.
 *
 * What's here:
 *   - AssetSourceSpec + TilesetManifest (Zod-validated asset contracts)
 *   - GameboardPlan + the Recipe/Scenario/Blueprint → plan compilers (pure)
 *   - coordinates + grid (hex math, axial/world conversion) + A* pathfinding
 *   - board-aware navigation + occupancy (plan-based, no ECS)
 *   - the pure layout surface (site inspection, fill analysis, placement generation)
 *   - validateGameboardPlan + the rule-type contracts
 *   - the tileset/asset manifest schemas
 *
 * What's NOT here (needs the runtime/render tiers — import from the main package):
 *   - the koota world, actors/movement/patrol/quests/commands/systems/runtime
 *   - the koota-spawning helpers (createWorldFrom*, spawnGameboardLayout*)
 *   - recipe GENERATION fill rules (they run seeded layout-fill in a koota world)
 *   - anything under `./three` / `./react` / `./react-elements`
 *
 * This barrel re-exports the PURE modules directly (not the runtime-mixed barrels
 * like `./coordinates`, which also carry `layout-runtime`), so importing `./core`
 * pulls ZERO koota/three — asserted by the core-purity contract test.
 *
 * @module
 */

// Asset contracts (Zod)
// NOTE: this barrel deliberately imports specific PURE sub-modules, NOT the
// runtime-mixed domain barrels (`../coordinates`, `../gameboard`, `../rules`,
// `../scenario`). Those barrels re-export koota-touching modules
// (layout-runtime, projection, recipe-generation, the ECS helpers), which would
// poison `./core`'s koota-free promise. The core-purity contract test asserts
// this import graph pulls zero koota/three, so the usual "use the barrel" lint
// rule is intentionally bypassed here.
export * from '../asset-source';

// Hex math + coordinates + A* + the pure layout surface
// biome-ignore lint/style/noRestrictedImports: ./core must bypass the ../coordinates barrel (it re-exports koota layout-runtime/projection) — see the note above.
export * from '../coordinates/coordinates';
// biome-ignore lint/style/noRestrictedImports: ./core must bypass the ../coordinates barrel — koota-free tier.
export * from '../coordinates/grid';
// biome-ignore lint/style/noRestrictedImports: ./core must bypass the ../coordinates barrel — koota-free tier.
export * from '../coordinates/layout';

// Plan + board-aware planning (plan-based, no ECS)
export * from '../gameboard/plan';
// biome-ignore lint/style/noRestrictedImports: ./core must bypass the ../gameboard barrel — koota-free tier.
export * from '../gameboard/navigation';
// biome-ignore lint/style/noRestrictedImports: ./core must bypass the ../gameboard barrel — koota-free tier.
export * from '../gameboard/occupancy';

// Authoring compilers (pure) — recipe steps → plan
// biome-ignore lint/style/noRestrictedImports: ./core must bypass the ../scenario barrel (re-exports recipe-generation koota) — koota-free tier.
export * from '../scenario/recipe';

// Validation + rule contracts
// biome-ignore lint/style/noRestrictedImports: ./core must bypass the ../rules barrel — koota-free tier.
export * from '../rules/validation';
// biome-ignore lint/style/noRestrictedImports: ./core must bypass the ../rules barrel — koota-free tier.
export * from '../rules/rule-types';

// Asset/tileset manifest schemas
// biome-ignore lint/style/noRestrictedImports: ./core must bypass the ../manifest barrel (re-exports the generated free manifest) — koota-free tier.
export * from '../manifest/schema';
