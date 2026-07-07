/**
 * `src/accessories/` — accessory attachment specs (RFC 0001 RFC0-ACC).
 *
 * Neutral data model for attaching accessories (helmet/weapon/shield) to a character
 * model's named nodes/bones. The three-side skeleton parenting lives in
 * `declarative-hex-worlds/three` (attachAccessoryToModel). Surfaced on the umbrella +
 * `declarative-hex-worlds/accessories`.
 *
 * @module
 */
export {
  type AccessoryAttachment,
  type AccessoryLocalTransform,
  type ResolvedAccessoryTransform,
  resolveAccessoryTransform,
  validateAccessoryAttachments,
} from './accessories';
