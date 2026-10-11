/**
 * `src/sculpt/` — a procedural prop modelling kit for three.js (`declarative-hex-worlds/sculpt`).
 *
 * Build period props, terrain pieces and clutter from code instead of downloading models: place
 * primitives ({@link box}, {@link cyl}, {@link cone}, {@link ball}, {@link ring}, {@link plane},
 * {@link disc}, {@link lathe}), roughen a {@link rock}, stretch cloth with {@link sheet}, pull a
 * {@link rope}, then {@link buildPiece} merges every part into one vertex-coloured geometry per
 * finish: one draw call per finish however many parts, and an instanced mesh draws every copy.
 *
 * The kit is palette-free. Parts name a tone; the consumer hands {@link buildPiece} the palette
 * that gives each tone its colour, so the same recipes can be repainted for any game. It
 * generalises the "toy chest" of a fleet game that models every prop this way.
 *
 * **Units and frame.** Metres; a piece stands on `y = 0`, its front toward `+z`, its length along
 * `x`. **Determinism.** Nothing here is random: rocks are roughened by a hash of their vertex
 * positions and a seed, so a piece is byte-identical in every process.
 *
 * `three` is an optional peer dependency, needed only by this subpath, like `./three`. The root
 * entrypoint does not re-export it.
 *
 * @module
 */

export {
  DEFAULT_FINISH,
  type Part,
  type PartOptions,
  type SculptVec3,
  ball,
  box,
  cone,
  cyl,
  disc,
  lathe,
  part,
  plane,
  ring,
} from './parts';
export { rock } from './rock';
export { type RopeOptions, type SculptPoint, rope, sheet } from './sheet';
export {
  type BuildPieceOptions,
  DEFAULT_FINISHES,
  type DefaultFinish,
  type FinishSpec,
  type SculptPalette,
  buildPiece,
} from './build';
export { type SculptMaterials, createSculptMaterials } from './materials';
