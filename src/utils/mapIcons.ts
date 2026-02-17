import L from "leaflet";
import type { RiskLevel } from "../types/risk";
import type { VehicleType } from "./vehicleType";

/* -------------------------
   RISK COLOR MAPPING
-------------------------- */

function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "ok":
      return "#22c55e"; // green
    case "warning":
      return "#eab308"; // yellow
    case "critical":
      return "#ef4444"; // red
  }
}

/* -------------------------
   SVG ICON TEMPLATES
-------------------------- */

function createCarSvg(color: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2"/>
      <path d="M10 16 L16 10 L22 16 L16 22 Z" fill="white"/>
    </svg>
  `;
}

function createVanSvg(color: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect x="4" y="4" width="24" height="24" rx="4" fill="${color}" stroke="white" stroke-width="2"/>
      <rect x="10" y="10" width="12" height="12" fill="white"/>
    </svg>
  `;
}

function createTruckSvg(color: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <rect x="3" y="3" width="30" height="30" rx="4" fill="${color}" stroke="white" stroke-width="2"/>
      <rect x="8" y="8" width="20" height="10" fill="white"/>
      <rect x="8" y="20" width="8" height="6" fill="white"/>
      <rect x="20" y="20" width="8" height="6" fill="white"/>
    </svg>
  `;
}

/* -------------------------
   ICON CREATION
-------------------------- */

function svgToDataUri(svg: string): string {
  const cleaned = svg.replace(/\s+/g, " ").trim();
  return `data:image/svg+xml;base64,${btoa(cleaned)}`;
}

function createIcon(
  vehicleType: VehicleType,
  riskLevel: RiskLevel
): L.Icon {
  const color = getRiskColor(riskLevel);
  let svg: string;
  let iconSize: [number, number];

  switch (vehicleType) {
    case "car":
      svg = createCarSvg(color);
      iconSize = [32, 32];
      break;
    case "van":
      svg = createVanSvg(color);
      iconSize = [32, 32];
      break;
    case "truck":
      svg = createTruckSvg(color);
      iconSize = [36, 36];
      break;
  }

  return L.icon({
    iconUrl: svgToDataUri(svg),
    iconSize: iconSize,
    iconAnchor: [iconSize[0] / 2, iconSize[1]], // bottom center
    popupAnchor: [0, -iconSize[1]], // above icon
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
