/**
 * Shared rule configuration and violation types used by plan, world, recipe,
 * scenario, and runtime validation without importing heavier runtime modules.
 *
 * @module
 */
/** Severity level for validation and rule diagnostics. */
export type RuleSeverity = 'error' | 'warning';

/** One validation or rule violation emitted by plan, world, recipe, or scenario checks. */
export interface GameboardRuleViolation {
  /** Stable machine-readable violation code. */
  code: string;
  /** Diagnostic severity. */
  severity: RuleSeverity;
  /** Human-readable diagnostic message. */
  message: string;
  /** Related tile key when the violation is tile-specific. */
  tileKey?: string;
  /** Related placement id when the violation is placement-specific. */
  placementId?: string;
}

/** Shared validation rule toggles for plans and worlds. */
export interface GameboardRuleConfig {
  /** Maximum allowed tile elevation. */
  maxElevation?: number;
  /** Whether road edges must connect back from neighboring tiles. */
  requireReciprocalRoads?: boolean;
  /** Whether river edges must connect back from neighboring tiles. */
  requireReciprocalRivers?: boolean;
  /** Whether coast edges should face adjacent water tiles. */
  requireCoastsTouchWater?: boolean;
  /** Whether structure placements are forbidden on water tiles. */
  forbidStructuresOnWater?: boolean;
  /** Whether harbor placements must face adjacent water tiles. */
  requireHarborsTouchWater?: boolean;
}
