console.log("MAP ICONS VERSION 2 LOADED");

import L from "leaflet";
import type { RiskLevel } from "../types/risk";
import type { VehicleType } from "./vehicleType";

/* -------------------------
   RISK COLOR
-------------------------- */

function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "ok":
      return "#22c55e";      // green
    case "warning":
      return "#eab308";      // yellow
    case "critical":
      return "#ef4444";      // red
    default:
      return "#22c55e";
  }
}

/* -------------------------
   PULSE STYLE (CRITICAL ONLY)
-------------------------- */

const pulseStyle = `
@keyframes pulse {
  0% { filter: drop-shadow(0 0 4px currentColor); }
  50% { filter: drop-shadow(0 0 14px currentColor); }
  100% { filter: drop-shadow(0 0 4px currentColor); }
}
`;

/* -------------------------
   SVG VEHICLE ICONS
   Clean • Side view • No background
-------------------------- */

function createCarSvg(color: string, pulse: boolean): string {
  return `
  <svg xmlns="http://www.w3.org/2000/svg"
       width="42"
       height="42"
       viewBox="0 0 48 48"
       style="color:${color}; ${pulse ? "animation:pulse 1.2s infinite;" : ""}">
       
    <style>${pulse ? pulseStyle : ""}</style>

    <!-- Car body -->
    <path d="M10 26 L16 20 L32 20 L38 26 L38 30 L10 30 Z"
          fill="${color}" />

    <!-- Wheels -->
    <circle cx="18" cy="32" r="4" fill="#1f2937"/>
    <circle cx="30" cy="32" r="4" fill="#1f2937"/>
  </svg>
  `;
}

function createVanSvg(color: string, pulse: boolean): string {
  return `
  <svg xmlns="http://www.w3.org/2000/svg"
       width="42"
       height="42"
       viewBox="0 0 48 48"
       style="color:${color}; ${pulse ? "animation:pulse 1.2s infinite;" : ""}">
       
    <style>${pulse ? pulseStyle : ""}</style>

    <!-- Van body -->
    <rect x="10" y="22"
          width="28"
          height="12"
          rx="2"
          fill="${color}" />

    <!-- Wheels -->
    <circle cx="18" cy="36" r="4" fill="#1f2937"/>
    <circle cx="32" cy="36" r="4" fill="#1f2937"/>
  </svg>
  `;
}

function createTruckSvg(color: string, pulse: boolean): string {
  return `
  <svg xmlns="http://www.w3.org/2000/svg"
       width="46"
       height="46"
       viewBox="0 0 52 52"
       style="color:${color}; ${pulse ? "animation:pulse 1.2s infinite;" : ""}">
       
    <style>${pulse ? pulseStyle : ""}</style>

    <!-- Trailer -->
    <rect x="10"
          y="22"
          width="22"
          height="12"
          fill="${color}" />

    <!-- Cabin -->
    <rect x="32"
          y="24"
          width="10"
          height="10"
          fill="${color}" />

    <!-- Wheels -->
    <circle cx="18" cy="38" r="4" fill="#1f2937"/>
    <circle cx="36" cy="38" r="4" fill="#1f2937"/>
  </svg>
  `;
}

/* -------------------------
   ICON CREATION
-------------------------- */

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createIcon(
  vehicleType: VehicleType,
  riskLevel: RiskLevel
): L.Icon {
  const color = getRiskColor(riskLevel);
  const pulse = riskLevel === "critical";

  let svg: string;
  let size: number;

  switch (vehicleType) {
    case "car":
      svg = createCarSvg(color, pulse);
      size = 42;
      break;

    case "van":
      svg = createVanSvg(color, pulse);
      size = 42;
      break;

    case "truck":
      svg = createTruckSvg(color, pulse);
      size = 46;
      break;

    default:
      svg = createCarSvg(color, pulse);
      size = 42;
  }

  return L.icon({
    iconUrl: svgToDataUri(svg),
    iconSize: [size, size],

    // Proper ground alignment
    iconAnchor: [size / 2, size - 6],

    // Popup appears above vehicle
    popupAnchor: [0, -size + 8],
  });
}

/* -------------------------
   ICON CACHE
-------------------------- */

const iconCache = new Map<string, L.Icon>();

export function getVehicleIcon(
  vehicleType: VehicleType,
  riskLevel: RiskLevel
): L.Icon {
  const key = `${vehicleType}-${riskLevel}`;

  if (!iconCache.has(key)) {
    iconCache.set(key, createIcon(vehicleType, riskLevel));
  }

  return iconCache.get(key)!;
}
