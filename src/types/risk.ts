export type RiskLevel = "ok" | "warning" | "critical";

export type RiskReasonType =
  | "speedExtreme"
  | "speedHigh"
  | "speedAboveLimit"
  | "speedSlightlyElevated"
  | "noUpdate"
  | "noUpdateCritical"
  | "ecoEvent";

export interface RiskReason {
  type: RiskReasonType;
  value: number;
  /**
   * Optional count (used for aggregated eco events)
   * Example: 3 eco events in last 24h
   */
  count?: number;
}

export interface RiskAssessment {
  vehicleId: string;
  vehicleName: string;
  spz: string;
  speed: number;
  riskScore: number;
  riskLevel: RiskLevel;
  reasons: RiskReason[];
  calculatedAt: string;
  position: {
    latitude: string;
    longitude: string;
  };
}
