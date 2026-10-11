/**
 * `src/sculpt/build.ts` — merging a piece's parts into one vertex-coloured geometry per finish.
 *
 * A piece is then one draw call per finish however many parts it has, and an instanced mesh can
 * draw every copy of it. Colours are baked per vertex from the consumer's palette, so one
 * material per finish paints every kind of piece.
 *
 * @module
 */
import { BufferGeometry, Color, type ColorRepresentation, Float32BufferAttribute } from 'three';
import { GameboardValidationError } from '../errors';
import type { Part } from './parts';
import { requireNonNegative, requirePositive, requireUnit } from './validate';

/**
 * A palette: the colour of each tone key a piece's parts use. Supplied by the consumer — the kit
 * has no colours of its own. Any value three.js's `Color` accepts: a CSS string, a hex number, or
 * a `Color`.
 */
export type SculptPalette<Tone extends string = string> = Readonly<
  Record<Tone, ColorRepresentation>
>;

/** How a finish bakes into vertex colours. */
export interface FinishSpec {
  /**
   * Multiplies the baked colour. Above 1 over-drives it past display white, so an unlit,
   * un-tone-mapped material blooms (lamp glass, embers). Finite, at least 0.
   */
  readonly gain: number;
  /** Whether a grounded piece's contact shadow darkens this finish. */
  readonly shadowed: boolean;
}

/**
 * The finishes the kit knows: `matte` stone, wood, clay and cloth; `metal` gold and bronze;
 * `glow` lamp glass and embers (gain 3.2, never shadowed); `veil` cobweb and dust. Pass
 * `BuildPieceOptions.finishes` to retune these or add your own.
 */
export const DEFAULT_FINISHES = Object.freeze({
  matte: Object.freeze({ gain: 1, shadowed: true }),
  metal: Object.freeze({ gain: 1, shadowed: true }),
  glow: Object.freeze({ gain: 3.2, shadowed: false }),
  veil: Object.freeze({ gain: 1, shadowed: true }),
} satisfies Record<string, FinishSpec>);

/** The names of the built-in finishes. */
export type DefaultFinish = keyof typeof DEFAULT_FINISHES;

/** Options for {@link buildPiece}. */
export interface BuildPieceOptions {
  /**
   * Bake a contact shadow: shade each vertex from `contactFloor` at the ground (`y = 0`) up to
   * full colour at `contactHeight`, so a crate or a jar sits on the floor rather than floating
   * over it. Pieces that do not stand on the ground (a hanging lamp) leave it off. Default
   * `false`.
   */
  readonly grounded?: boolean;
  /** Height in metres at which the contact shadow ends. Above 0. Default `0.5`. */
  readonly contactHeight?: number;
  /** The colour factor at `y = 0`, from 0 to 1. Default `0.62`. */
  readonly contactFloor?: number;
  /** Finishes to add, or built-in finishes to retune, keyed by finish name. */
  readonly finishes?: Readonly<Record<string, FinishSpec>>;
}

const DEFAULT_CONTACT_HEIGHT = 0.5;
const DEFAULT_CONTACT_FLOOR = 0.62;

function assertPartGeometry(p: Part): void {
  const g = p.geometry;
  if (!g.getAttribute('position') || !g.getAttribute('normal') || g.index) {
    throw new GameboardValidationError(
      'sculpt: a part geometry must be non-indexed with position and normal; build parts with part() or a primitive'
    );
  }
}

/** The parts of one finish, gathered for the merge. */
interface Pending {
  readonly spec: FinishSpec;
  readonly parts: Array<{ readonly part: Part; readonly color: Color }>;
  vertices: number;
}

/**
 * Merges a piece's parts into one geometry per finish, vertex-coloured: each vertex is
 * `palette[tone] * shade * finish.gain`, and, when `grounded`, times the contact factor for its
 * height. The result maps each finish name that has parts to its merged geometry (insertion order
 * follows the first part of each finish); load each into one mesh with that finish's material.
 *
 * The parts are **consumed**: their geometries are disposed after the merge, so build a piece
 * from fresh parts each time.
 *
 * Deterministic and allocation-light: no randomness, no scratch state shared between calls.
 *
 * Throws {@link GameboardValidationError} for a tone missing from `palette`, a finish missing
 * from the finish table, a part geometry that is not non-indexed with position and normal, or an
 * out-of-range option. Everything is validated before any part is consumed.
 */
export function buildPiece<P extends SculptPalette>(
  parts: readonly Part<Extract<keyof P, string>>[],
  palette: P,
  options: BuildPieceOptions = {}
): Map<string, BufferGeometry> {
  const grounded = options.grounded ?? false;
  const contactHeight = requirePositive(
    'contactHeight',
    options.contactHeight ?? DEFAULT_CONTACT_HEIGHT
  );
  const contactFloor = requireUnit('contactFloor', options.contactFloor ?? DEFAULT_CONTACT_FLOOR);
  const finishes: Record<string, FinishSpec> = { ...DEFAULT_FINISHES, ...options.finishes };
  for (const [name, spec] of Object.entries(finishes)) {
    if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) {
      throw new GameboardValidationError(`sculpt: finish "${name}" must define gain and shadowed`);
    }
    requireNonNegative(`finish "${name}" gain`, spec.gain);
    if (typeof spec.shadowed !== 'boolean') {
      throw new GameboardValidationError(`sculpt: finish "${name}" shadowed must be a boolean`);
    }
  }

  const tones = new Map<string, Color>();
  const byFinish = new Map<string, Pending>();
  for (const p of parts) {
    const value = Object.hasOwn(palette, p.tone) ? palette[p.tone] : undefined;
    if (value === undefined) {
      throw new GameboardValidationError(`sculpt: tone "${p.tone}" is not in the palette`);
    }
    const spec = Object.hasOwn(finishes, p.finish) ? finishes[p.finish] : undefined;
    if (!spec) {
      throw new GameboardValidationError(`sculpt: finish "${p.finish}" is not defined`);
    }
    assertPartGeometry(p);
    const color = tones.get(p.tone) ?? new Color(value);
    tones.set(p.tone, color);
    const pending = byFinish.get(p.finish) ?? { spec, parts: [], vertices: 0 };
    pending.parts.push({ part: p, color });
    pending.vertices += p.geometry.getAttribute('position').count;
    byFinish.set(p.finish, pending);
  }

  const out = new Map<string, BufferGeometry>();
  for (const [finish, pending] of byFinish) {
    const { spec } = pending;
    const positions = new Float32Array(pending.vertices * 3);
    const normals = new Float32Array(pending.vertices * 3);
    const colors = new Float32Array(pending.vertices * 3);
    let offset = 0;
    for (const { part: p, color } of pending.parts) {
      const position = p.geometry.getAttribute('position');
      const normal = p.geometry.getAttribute('normal');
      const k = p.shade * spec.gain;
      for (let i = 0; i < position.count; i++, offset += 3) {
        const y = position.getY(i);
        const contact =
          grounded && spec.shadowed
            ? contactFloor + (1 - contactFloor) * Math.min(1, Math.max(0, y / contactHeight))
            : 1;
        positions[offset] = position.getX(i);
        positions[offset + 1] = y;
        positions[offset + 2] = position.getZ(i);
        normals[offset] = normal.getX(i);
        normals[offset + 1] = normal.getY(i);
        normals[offset + 2] = normal.getZ(i);
        colors[offset] = color.r * k * contact;
        colors[offset + 1] = color.g * k * contact;
        colors[offset + 2] = color.b * k * contact;
      }
      p.geometry.dispose();
    }
    const merged = new BufferGeometry();
    merged.setAttribute('position', new Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    merged.setAttribute('color', new Float32BufferAttribute(colors, 3));
    merged.computeBoundingSphere();
    out.set(finish, merged);
  }
  return out;
}
