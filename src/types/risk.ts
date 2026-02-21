export type RiskLevel = "ok" | "warning" | "critical";

/* -------------------------
   SERVICE / MAINTENANCE
-------------------------- */

export type ServiceStatus = "ok" | "warning" | "critical";

export interface ServiceInfo {
  /** Current odometer reading in km (from GPS Dozor API field Odometer) */
  odometer: number;
  /** Km reading at which next service is due */
  nextServiceAt: number;
  /** Km reading at which the previous service occurred */
  lastServiceAt?: number;
  /** Remaining km until service (nextServiceAt - odometer) */
  remainingKm: number;
  serviceStatus: ServiceStatus;
}

/** Optional weather data attached to assessment when available (for drawer display). */
export interface AssessmentWeatherData {
  temperature: number;
  windSpeed: number;
  precipitation: number;
  weatherId: number;
  weatherMain?: string;
}

/**
 * Local extension of RiskAssessment with maintenance data.
 * Computed client-side — do NOT persist or send to backend.
 */
export type AssessmentWithService = RiskAssessment & {
  serviceInfo: ServiceInfo;
  weatherData?: AssessmentWeatherData;
};

export type RiskReasonType =
  | "speedExtreme"
  | "speedHigh"
  | "speedAboveLimit"
  | "speedSlightlyElevated"
  | "noUpdate"
  | "noUpdateCritical"
  | "ecoEvent"
  | "weather";

export interface RiskReason {
  type: RiskReasonType;
  /** Numeric for operational reasons; descriptive string for weather reasons. */
  value: number | string;
  /**
   * Optional count (used for aggregated eco events)
   * Example: 3 eco events in last 24h
   */
  count?: number;
  /** Optional weatherId (OpenWeatherMap) for weather reasons; used for icon mapping. */
  weatherId?: number;
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
