/**
 * `src/traits/` — umbrella over every koota `trait()` declaration the library
 * defines.
 *
 * The koota-idiomatic shape (see `~/src/reference-codebases/koota/examples/
 * cards/src` and `n-body-react/src`) is a single trait surface that consumers
 * import from one place. As Epic R2 progresses, each domain sub-package will
 * physically own the trait files relevant to its concern (board → `koota/`;
 * actors → `actors/`; movement → `movement/`; patrol → `patrol/`; quests →
 * `quests/`); this barrel re-exports from wherever they live so the
 * consumer-facing API stays stable across the migration.
 *
 * Traits ARE the public ECS schema — adding or removing one is a semver
 * surface change. Per PRD §6 invariant 7 (`splitting: true` + trait identity)
 * each trait is exported from exactly one module so reference-equality holds
 * regardless of which subpath a consumer imports from.
 *
 * @module
 */

export {
  GameboardState,
  HexTileState,
  IsCoastPlacement,
  IsDecorationPlacement,
  IsGameboardPlacement,
  IsGameboardTile,
  IsHarborPlacement,
  IsPropPlacement,
  IsRiverPlacement,
  IsRoadPlacement,
  IsStructurePlacement,
  IsTerrainPlacement,
  IsUnitPlacement,
  PlacementState,
  TileConnectivity,
  TileCoordinates,
  TileElevation,
  TileRenderState,
  TileTagList,
  TileTerrain,
} from '../koota';

export {
  GameboardActor,
  IsBlockingActor,
  IsEnemyActor,
  IsGameboardActor,
  IsHostileActor,
  IsInteractiveActor,
  IsNpcActor,
  IsPlayerActor,
  IsPropActor,
} from '../actors';

export { IsMoving, MovementAgent, MovementPathState } from '../movement';

export {
  GameboardPatrolAgent,
  GameboardPatrolState,
  IsGameboardPatrolAgent,
} from '../patrol';

export {
  GameboardQuest,
  IsActiveGameboardQuest,
  IsBlockedGameboardQuest,
  IsCompletedGameboardQuest,
  IsGameboardQuest,
} from '../quests';
