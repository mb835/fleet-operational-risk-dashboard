<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
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
let markerClusterGroup: L.MarkerClusterGroup | null = null;

// Map focus toggle: "europe" or "czech"
const mapFocus = ref<"europe" | "czech">("europe");

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

  // Initialize marker cluster group with custom styling
  markerClusterGroup = L.markerClusterGroup({
    maxClusterRadius: 80,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    iconCreateFunction: (cluster: L.MarkerCluster) => {
      const count = cluster.getChildCount();
      let size = 40;

      // Scale cluster size based on count
      if (count >= 10) {
        size = 50;
      } else if (count >= 5) {
        size = 45;
      }

      return L.divIcon({
        html: `<div style="
          width: ${size}px;
          height: ${size}px;
          background-color: #3b82f6;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: ${count >= 100 ? '12px' : '14px'};
          border: 3px solid white;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        ">${count}</div>`,
        className: "custom-cluster-icon",
        iconSize: L.point(size, size),
      });
    },
  });

  mapInstance.addLayer(markerClusterGroup);

  // Render markers
  renderMarkers();
}

/* -------------------------
   MARKER RENDERING
-------------------------- */

function renderMarkers() {
  if (!mapInstance || !markerClusterGroup) return;

  // Clear existing markers from cluster group
  markerClusterGroup.clearLayers();

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
  const bounds: L.LatLngBounds = L.latLngBounds([]);

  validAssessments.forEach((assessment) => {
    const lat = parseFloat(assessment.position.latitude);
    const lng = parseFloat(assessment.position.longitude);
    const latLng: L.LatLng = L.latLng(lat, lng);

    bounds.extend(latLng);

    // Determine vehicle type and get custom icon
    const vehicleType = getVehicleType(assessment.vehicleName);
    const vehicleTypeCzech = getVehicleTypeCzech(assessment.vehicleName);
    const icon = getVehicleIcon(vehicleType, assessment.riskLevel);

    // Create marker with custom icon and add critical class if needed
    const marker = L.marker(latLng, {
      icon: icon,
    });

    // Add pulse effect for critical risk markers
    if (assessment.riskLevel === "critical") {
      marker.on("add", () => {
        const element = marker.getElement();
        if (element) {
          element.classList.add("critical-marker-pulse");
        }
      });
    }

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
    
    // Add marker to cluster group
    markerClusterGroup!.addLayer(marker);
  });

  // Apply viewport based on focus mode
  applyMapViewport(bounds, validAssessments.length);
}

/* -------------------------
   MAP VIEWPORT HANDLING
-------------------------- */

function applyMapViewport(bounds: L.LatLngBounds, vehicleCount: number) {
  if (!mapInstance) return;

  // Czech Republic focus: override auto-fit
  if (mapFocus.value === "czech") {
    mapInstance.setView([49.8, 15.5], 7); // Center of Czech Republic
    return;
  }

  // Europe focus: auto-fit behavior
  if (vehicleCount === 1) {
    // Single vehicle: center map with zoom level 8
    const singlePos = bounds.getCenter();
    mapInstance.setView(singlePos, 8);
  } else if (vehicleCount > 1) {
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
  // Cleanup marker cluster group
  if (markerClusterGroup) {
    markerClusterGroup.clearLayers();
    markerClusterGroup = null;
  }

  // Cleanup map instance
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
});

// Watch for assessment changes - reactive updates
watch(
  () => props.assessments,
  () => {
    renderMarkers();
  },
  { deep: true }
);

// Watch for map focus changes - reactive viewport updates
watch(mapFocus, () => {
  if (!mapInstance || !markerClusterGroup) return;

  const validAssessments = props.assessments.filter((assessment) => {
    const lat = parseFloat(assessment.position.latitude);
    const lng = parseFloat(assessment.position.longitude);
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  });

  if (validAssessments.length === 0) return;

  // Recalculate bounds for Europe mode
  const bounds: L.LatLngBounds = L.latLngBounds([]);
  validAssessments.forEach((assessment) => {
    const lat = parseFloat(assessment.position.latitude);
    const lng = parseFloat(assessment.position.longitude);
    bounds.extend(L.latLng(lat, lng));
  });

  applyMapViewport(bounds, validAssessments.length);
});
</script>

<template>
  <!-- Empty State -->
  <div
    v-if="props.assessments.length === 0"
    class="w-full rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center"
    style="height: 600px;"
  >
    <div class="text-center">
      <p class="text-slate-400 text-lg">Žádná aktivní vozidla k zobrazení</p>
    </div>
  </div>

  <!-- Map Focus Toggle + Map Container -->
  <div v-else class="space-y-4">
    <!-- Focus Toggle -->
    <div class="flex justify-end">
      <div class="flex bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
        <button
          class="px-4 py-2 text-sm transition flex items-center gap-2"
          :class="mapFocus === 'europe' ? 'bg-slate-700 text-slate-200' : 'text-slate-400'"
          @click="mapFocus = 'europe'"
        >
          <span>🌍</span>
          <span>Celá Evropa</span>
        </button>
        <button
          class="px-4 py-2 text-sm transition flex items-center gap-2"
          :class="mapFocus === 'czech' ? 'bg-slate-700 text-slate-200' : 'text-slate-400'"
          @click="mapFocus = 'czech'"
        >
          <span>🇨🇿</span>
          <span>Fokus ČR</span>
        </button>
      </div>
    </div>

    <!-- Map Container with Legend -->
    <div class="relative w-full rounded-xl overflow-hidden" style="height: 600px;">
      <div
        ref="mapContainer"
        class="w-full h-full"
        style="background-color: #1e293b;"
      ></div>

    <!-- Map Legend -->
    <div
      class="absolute bottom-6 right-6 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg p-4 shadow-xl"
      style="z-index: 1000; min-width: 180px;"
    >
      <h3 class="text-sm font-semibold text-slate-200 mb-3 border-b border-slate-700 pb-2">
        Legenda
      </h3>

      <!-- Vehicle Types -->
      <div class="mb-3">
        <p class="text-xs text-slate-400 uppercase font-medium mb-2">
          Typy vozidel
        </p>
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-base">🚗</span>
            <span class="text-xs text-slate-300">Osobní</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-base">🚐</span>
            <span class="text-xs text-slate-300">Dodávka</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-base">🚛</span>
            <span class="text-xs text-slate-300">Kamion</span>
          </div>
        </div>
      </div>

      <!-- Risk Levels -->
      <div class="mb-3">
        <p class="text-xs text-slate-400 uppercase font-medium mb-2">
          Úrovně rizika
        </p>
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-green-500"></div>
            <span class="text-xs text-slate-300">V pořádku</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span class="text-xs text-slate-300">Varování</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-red-500"></div>
            <span class="text-xs text-slate-300">Kritické</span>
          </div>
        </div>
      </div>

      <!-- Auto-zoom badge -->
      <div class="pt-2 border-t border-slate-700">
        <p class="text-[10px] text-slate-500 italic">
          Automatický zoom podle aktivních vozidel
        </p>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure legend doesn't overlap zoom controls */
:deep(.leaflet-control-zoom) {
  margin-bottom: 180px !important;
}

/* Custom cluster styling tweaks */
:deep(.custom-cluster-icon) {
  background: transparent !important;
  border: none !important;
}

/* Critical marker pulse effect */
:deep(.critical-marker-pulse) {
  animation: critical-pulse 2s ease-in-out infinite;
}

@keyframes critical-pulse {
  0%, 100% {
    filter: drop-shadow(0 0 0 rgba(239, 68, 68, 0));
  }
  50% {
    filter: drop-shadow(0 0 12px rgba(239, 68, 68, 0.8));
  }
}
</style>
