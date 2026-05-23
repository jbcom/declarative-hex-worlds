export type RuleSeverity = 'error' | 'warning';

export interface GameboardRuleViolation {
  code: string;
  severity: RuleSeverity;
  message: string;
  tileKey?: string;
  placementId?: string;
}

export interface GameboardRuleConfig {
  maxElevation?: number;
  requireReciprocalRoads?: boolean;
  requireReciprocalRivers?: boolean;
  requireCoastsTouchWater?: boolean;
  forbidStructuresOnWater?: boolean;
  requireHarborsTouchWater?: boolean;
}
