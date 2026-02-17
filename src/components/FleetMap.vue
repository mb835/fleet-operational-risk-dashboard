<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RiskAssessment, RiskLevel } from "../types/risk";
import { getVehicleType, getVehicleTypeCzech } from "../utils/vehicleType";
import { getVehicleIcon } from "../utils/mapIcons";

/* -------------------------
   PROPS
-------------------------- */

interface Props {
  assessments: RiskAssessment[];
}

const props = defineProps<Props>();

/* -------------------------
   STATE
-------------------------- */

const mapContainer = ref<HTMLElement | null>(null);
let mapInstance: L.Map | null = null;
const markers: L.Marker[] = [];

/* -------------------------
   RISK LABEL MAPPING
-------------------------- */

function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case "ok":
      return "V pořádku";
    case "warning":
      return "Varování";
    case "critical":
      return "Kritické";
  }
}

/* -------------------------
   MAP INITIALIZATION
-------------------------- */

function initMap() {
  if (!mapContainer.value) return;

  // Create map instance
  mapInstance = L.map(mapContainer.value, {
    center: [50.0755, 14.4378], // Prague default
    zoom: 7,
  });

  // Add OpenStreetMap tiles
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(mapInstance);

  // Render markers
  renderMarkers();
}

/* -------------------------
   MARKER RENDERING
-------------------------- */

function renderMarkers() {
  if (!mapInstance) return;

  // Clear existing markers
  markers.forEach((marker) => marker.remove());
  markers.length = 0;

  // Filter valid coordinates
  const validAssessments = props.assessments.filter((assessment) => {
    const lat = parseFloat(assessment.position.latitude);
    const lng = parseFloat(assessment.position.longitude);
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  });

  // If no valid vehicles, show Europe fallback
  if (validAssessments.length === 0) {
    mapInstance.setView([50.0, 14.0], 5);
    return;
  }

  // Create markers
  const bounds: L.LatLngExpression[] = [];

  validAssessments.forEach((assessment) => {
    const lat = parseFloat(assessment.position.latitude);
    const lng = parseFloat(assessment.position.longitude);

    bounds.push([lat, lng]);

    // Determine vehicle type and get custom icon
    const vehicleType = getVehicleType(assessment.vehicleName);
    const vehicleTypeCzech = getVehicleTypeCzech(assessment.vehicleName);
    const icon = getVehicleIcon(vehicleType, assessment.riskLevel);

    // Create marker with custom icon
    const marker = L.marker([lat, lng], {
      icon: icon,
    });

    // Check if vehicle is offline > 360 minutes
    const hasNoUpdateCritical = assessment.reasons.some(
      (r) => r.type === "noUpdateCritical"
    );
    const offlineMinutes = hasNoUpdateCritical
      ? assessment.reasons.find((r) => r.type === "noUpdateCritical")?.value || 0
      : 0;

    // Create popup content
    const popupContent = `
      <div style="font-family: system-ui; min-width: 220px;">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">
          ${assessment.vehicleName}
        </div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
          ${assessment.spz || "Bez SPZ"}
        </div>
        <div style="font-size: 12px; margin-bottom: 4px;">
          <strong>Typ vozidla:</strong> ${vehicleTypeCzech.charAt(0).toUpperCase() + vehicleTypeCzech.slice(1)}
        </div>
        <div style="font-size: 12px; margin-bottom: 4px;">
          <strong>Rychlost:</strong> ${assessment.speed} km/h
        </div>
        <div style="font-size: 12px; margin-bottom: 4px;">
          <strong>Úroveň rizika:</strong> ${getRiskLabel(assessment.riskLevel)}
        </div>
        <div style="font-size: 12px; margin-bottom: 8px;">
          <strong>Skóre:</strong> ${assessment.riskScore}
        </div>
        ${
          assessment.riskLevel === "critical"
            ? `<div style="background-color: #dc2626; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-bottom: 4px; text-align: center;">KRITICKÉ RIZIKO</div>`
            : ""
        }
        ${
          offlineMinutes > 360
            ? `<div style="background-color: #dc2626; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-align: center;">OFFLINE 6h+</div>`
            : ""
        }
      </div>
    `;

    marker.bindPopup(popupContent);
    marker.addTo(mapInstance!);
    markers.push(marker);
  });

  // Fit bounds to show all markers
  if (bounds.length === 1) {
    // Single vehicle: use setView with zoom 8
    mapInstance.setView(bounds[0] as L.LatLngExpression, 8);
  } else if (bounds.length > 1) {
    // Multiple vehicles: fit bounds with padding
    mapInstance.fitBounds(bounds, {
      padding: [50, 50],
    });
  }
}

/* -------------------------
   LIFECYCLE
-------------------------- */

onMounted(() => {
  initMap();
});

onUnmounted(() => {
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
});

// Watch for assessment changes
watch(
  () => props.assessments,
  () => {
    renderMarkers();
  },
  { deep: true }
);
</script>

<template>
  <div
    ref="mapContainer"
    class="w-full rounded-xl overflow-hidden"
    style="height: 600px; background-color: #1e293b;"
  ></div>
</template>
