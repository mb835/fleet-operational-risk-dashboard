import L from "leaflet";
import type { RiskLevel, ServiceStatus } from "../types/risk";
import type { VehicleType } from "./vehicleType";

/* -------------------------
   RISK COLOR
-------------------------- */

function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "ok":
      return "#22c55e"; // green
    case "warning":
      return "#eab308"; // yellow
    case "critical":
      return "#ef4444"; // red
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
   WEATHER SVG ICONS (16x16, stroke #38bdf8, stroke-width 1.5)
-------------------------- */

const strokeStyle = 'stroke="#38bdf8" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"';

const weatherSvgs = {
  thunderstorm: `<svg width="16" height="16" viewBox="0 0 24 24" ${strokeStyle}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  snowflake: `<svg width="16" height="16" viewBox="0 0 24 24" ${strokeStyle}><path d="M12 2v20M2 12h20M5.64 5.64l12.72 12.72M18.36 5.64L5.64 18.36"/></svg>`,
  rain: `<svg width="16" height="16" viewBox="0 0 24 24" ${strokeStyle}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><path d="M8 14v4M12 14v4M16 14v4"/></svg>`,
  fog: `<svg width="16" height="16" viewBox="0 0 24 24" ${strokeStyle}><path d="M4 8h16M4 12h14M4 16h16"/></svg>`,
  cloud: `<svg width="16" height="16" viewBox="0 0 24 24" ${strokeStyle}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`,
};

function getWeatherSvg(weatherId?: number): string {
  if (weatherId == null || typeof weatherId !== "number") return weatherSvgs.cloud;
  if (weatherId >= 200 && weatherId <= 299) return weatherSvgs.thunderstorm;
  if (weatherId >= 600 && weatherId <= 699) return weatherSvgs.snowflake;
  if (weatherId >= 300 && weatherId <= 599) return weatherSvgs.rain;
  if (weatherId >= 700 && weatherId <= 799) return weatherSvgs.fog;
  return weatherSvgs.cloud;
}

/* -------------------------
   ICON CREATION
-------------------------- */

function createIcon(
  vehicleType: VehicleType,
  riskLevel: RiskLevel,
  serviceStatus?: ServiceStatus,
  hasWeatherBadge?: boolean,
  weatherId?: number
): L.DivIcon {

  const color = getRiskColor(riskLevel);
  const pulse = riskLevel === "critical";

  let emoji: string;
  let size: number;

  switch (vehicleType) {
    case "car":
      emoji = "🚗";
      size = 40;
      break;

    case "van":
      emoji = "🚐";
      size = 40;
      break;

    case "truck":
      emoji = "🚛";
      size = 44;
      break;

    default:
      emoji = "🚗";
      size = 40;
  }

  // Critical markers are rendered larger so they stand out at a glance
  if (riskLevel === "critical") size += 10;

  const vehicleIconHtml = `
    <style>${pulse ? pulseStyle : ""}</style>
    <div style="
      font-size: 32px;
      line-height: 32px;
      text-align: center;
      color: ${color};
      ${pulse ? "animation:pulse 1.2s infinite;" : ""}
      font-family: 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;
    ">
      ${emoji}
    </div>
  `;

  const showServiceBadge = serviceStatus === "warning" || serviceStatus === "critical";
  const serviceBadgeBg =
    serviceStatus === "critical"
      ? "background:#ef4444;"
      : serviceStatus === "warning"
        ? "background:#eab308;"
        : "";

  const showWeatherBadge = hasWeatherBadge === true;
  const weatherSvg = getWeatherSvg(weatherId);
  const weatherRight = showServiceBadge ? "12px" : "-4px";

  // Service badge: top-right when present
  const serviceBadgeHtml = showServiceBadge
    ? `<div style="position:absolute;top:-2px;right:-2px;width:16px;height:16px;border-radius:50%;${serviceBadgeBg}display:flex;align-items:center;justify-content:center;font-size:10px;">🛠</div>`
    : "";

  // Weather overlay: inline SVG by weatherId, only when hasWeatherBadge
  const weatherBadgeHtml = showWeatherBadge
    ? `<div style="position:absolute;top:-4px;right:${weatherRight};width:16px;height:16px;display:flex;align-items:center;justify-content:center;">${weatherSvg}</div>`
    : "";

  const needsWrapper = showServiceBadge || showWeatherBadge;
  const html = needsWrapper
    ? `<div class="vehicle-marker" style="position:relative;display:inline-block;width:${size}px;height:${size}px;">
         ${vehicleIconHtml}
         ${serviceBadgeHtml}
         ${weatherBadgeHtml}
       </div>`
    : vehicleIconHtml;

  return L.divIcon({
    className: "vehicle-emoji-icon",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size - 6],
    popupAnchor: [0, -size + 8],
  });
}

/* -------------------------
   ICON CACHE
-------------------------- */

const iconCache = new Map<string, L.DivIcon>();

export function getVehicleIcon(
  vehicleType: VehicleType,
  riskLevel: RiskLevel,
  serviceStatus?: ServiceStatus,
  hasWeatherBadge?: boolean,
  weatherId?: number
): L.DivIcon {

  const statusKey = serviceStatus ?? "ok";
  const weatherKey = hasWeatherBadge === true ? `w-${weatherId ?? "default"}` : "";
  const key = `${vehicleType}-${riskLevel}-${statusKey}${weatherKey}`;

  if (!iconCache.has(key)) {
    iconCache.set(key, createIcon(vehicleType, riskLevel, serviceStatus, hasWeatherBadge, weatherId));
  }

  return iconCache.get(key)!;
}
