<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import type { AssessmentWithService, RiskLevel, RiskReason } from "../types/risk";
import { formatKm, serviceStatusLabel } from "../services/maintenanceService";
import { fetchFuelSnapshots } from "../services/fuelService";
import { evaluateFuelRisk } from "../services/fuelIntelligence";
import type { FuelRiskResult } from "../services/fuelIntelligence";

/* -------------------------
   PROPS & EMITS
-------------------------- */

interface Props {
  assessment: AssessmentWithService | null;
  open: boolean;
  weatherRiskEnabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), { weatherRiskEnabled: false });

const emit = defineEmits<{
  close: [];
  "focus-map": [coords: { latitude: number; longitude: number }];
}>();

/* -------------------------
   ESC KEY
-------------------------- */

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.open) emit("close");
}

onMounted(() => window.addEventListener("keydown", handleKeydown));
onUnmounted(() => window.removeEventListener("keydown", handleKeydown));

/* -------------------------
   COMPUTED
-------------------------- */

const svc = computed(() => props.assessment?.serviceInfo ?? null);

const progressPercent = computed(() => svc.value?.progressPercent ?? null);

const progressBarClass = computed(() => {
  if (!svc.value) return "bg-slate-600";
  switch (svc.value.serviceStatus) {
    case "critical": return "bg-red-500";
    case "warning":  return "bg-yellow-400";
    case "ok":       return "bg-green-500";
  }
});

/* -------------------------
   WEATHER UX
-------------------------- */

const weatherReasons = computed(() =>
  (props.assessment?.reasons ?? []).filter((r) => r.type === "weather"),
);

const weatherImpact = computed(() => {
  const w = weatherReasons.value[0];
  if (!w || typeof w.value !== "number") return 0;
  return w.value;
});

const visibleReasons = computed(() => {
  const reasons = props.assessment?.reasons ?? [];
  return reasons.filter((r) => {
    const text = reasonText(r);
    return typeof text === "string" && text.trim().length > 0;
  });
});

const showWeatherSection = computed(
  () =>
    props.weatherRiskEnabled === true &&
    weatherReasons.value.length > 0 &&
    props.assessment?.weatherData != null,
);

function weatherTypeLabel(w: { weatherId: number; weatherMain?: string }): string {
  const id = w.weatherId;
  if (id >= 200 && id <= 299) return "Bouřka";
  if (id >= 300 && id <= 599) return "Déšť";
  if (id >= 600 && id <= 699) return "Sníh";
  if (id >= 700 && id <= 799) return "Mlha";
  const main = String(w.weatherMain ?? "").toLowerCase();
  if (main === "clear") return "Jasno";
  if (main === "clouds") return "Oblačno";
  return "Neznámé podmínky";
}

function weatherEmoji(weatherId?: number): string {
  if (weatherId == null || typeof weatherId !== "number") return "☁️";
  if (weatherId >= 200 && weatherId <= 299) return "⛈️";
  if (weatherId >= 600 && weatherId <= 699) return "❄️";
  if (weatherId >= 300 && weatherId <= 599) return "🌧️";
  if (weatherId >= 700 && weatherId <= 799) return "🌫️";
  return "☁️";
}

/* -------------------------
   ANIMATED RISK SCORE
-------------------------- */

const animatedScore = ref(props.assessment?.riskScore ?? 0);
const scorePulse = ref(false);

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function animateScore(start: number, end: number) {
  const duration = 400;
  const startTime = performance.now();

  function tick(now: number) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const eased = easeOut(t);
    const current = start + (end - start) * eased;
    animatedScore.value = Math.round(current);
    if (t < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

watch(
  () => props.assessment?.riskScore,
  (newVal) => {
    if (newVal == null) return;
    const prev = animatedScore.value;
    scorePulse.value = true;
    animateScore(prev, newVal);
    setTimeout(() => {
      scorePulse.value = false;
    }, 400);
  },
  { immediate: true }
);

/* -------------------------
   RISK HELPERS
-------------------------- */

function riskBadgeClass(level: RiskLevel): string {
  switch (level) {
    case "ok":       return "bg-green-700/40 text-green-400 border border-green-700";
    case "warning":  return "bg-yellow-700/40 text-yellow-400 border border-yellow-700";
    case "critical": return "bg-red-700/40 text-red-400 border border-red-600";
  }
}

function riskBorderColor(level: RiskLevel): string {
  switch (level) {
    case "ok":       return "#22c55e";
    case "warning":  return "#eab308";
    case "critical": return "#ef4444";
    default:         return "#64748b";
  }
}

function formatRiskLevel(level: RiskLevel): string {
  switch (level) {
    case "ok":       return "V pořádku";
    case "warning":  return "Varování";
    case "critical": return "Kritické";
  }
}

function formatOperationalReason(r: RiskReason): string | null {
  switch (r.type) {
    case "noUpdate":
      return `Bez aktualizace ${r.value} minut`;

    case "noUpdateCritical":
      return `DLOUHÁ neaktivita – ${r.value} minut`;

    case "speedAboveLimit":
      return `Rychlost nad limitem (${r.value} km/h)`;

    case "speedHigh":
      return `Vysoká rychlost (${r.value} km/h)`;

    case "speedExtreme":
      return `Extrémní rychlost (${r.value} km/h)`;

    case "speedSlightlyElevated":
      return `Mírně zvýšená rychlost (${r.value} km/h)`;

    case "ecoEvent":
      return `Eco událost (závažnost ${r.value})`;

    default:
      return null;
  }
}

function formatWeatherReasonDisplay(r: RiskReason): string | null {
  if (r.value == null || r.value === "") return null;
  const num = Number(r.value);
  if (isNaN(num) || num <= 0) return null;
  return `+${r.value} počasí`;
}

function reasonText(r: RiskReason | null | undefined): string | null {
  if (!r) return null;
  const text =
    r.type === "weather"
      ? formatWeatherReasonDisplay(r)
      : formatOperationalReason(r);
  if (text == null || typeof text !== "string") return null;
  if (text.trim().length === 0) return null;
  return text;
}

/* -------------------------
   FUEL MONITORING
   Fetched lazily when the drawer opens.
   Cached per vehicleId to avoid re-fetching while same vehicle is shown.
-------------------------- */

// Module-level caches — survive reactive re-renders, cleared on page reload
const fuelCache          = new Map<string, FuelRiskResult>();
const fuelTimestampCache = new Map<string, string | null>();

const fuelResult        = ref<FuelRiskResult | null>(null);
const fuelLastTimestamp = ref<string | null>(null);
const fuelLoading       = ref(false);
const fuelError         = ref(false);

/**
 * Returns the ISO timestamp of the most recent snapshot that carries
 * a fuel reading, or null when no usable snapshot exists.
 */
function extractLastTimestamp(snapshots: ReturnType<typeof Array.prototype.slice>): string | null {
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const s = snapshots[i];
    if (s.fuelVolume !== undefined || s.fuelConsumedTotal !== undefined) {
      return s.timestamp ?? null;
    }
  }
  return snapshots[snapshots.length - 1]?.timestamp ?? null;
}

/**
 * Returns a Czech relative-time string for the "Poslední kontrola" line.
 * Returns null when the timestamp is absent or unparseable.
 */
function formatRelativeTime(isoTime: string | null): string | null {
  if (!isoTime) return null;
  const diffMs  = Date.now() - new Date(isoTime).getTime();
  if (isNaN(diffMs)) return null;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1)  return "právě teď";
  if (minutes < 60) return `před ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `před ${hours} h`;
}

async function loadFuelData(vehicleId: string): Promise<void> {
  if (fuelCache.has(vehicleId)) {
    fuelResult.value        = fuelCache.get(vehicleId)!;
    fuelLastTimestamp.value = fuelTimestampCache.get(vehicleId) ?? null;
    return;
  }

  fuelLoading.value = true;
  fuelError.value   = false;

  try {
    const snapshots         = await fetchFuelSnapshots(vehicleId);
    const result            = evaluateFuelRisk(snapshots);
    const timestamp         = extractLastTimestamp(snapshots);

    fuelCache.set(vehicleId, result);
    fuelTimestampCache.set(vehicleId, timestamp);

    fuelResult.value        = result;
    fuelLastTimestamp.value = timestamp;
  } catch {
    fuelError.value         = true;
    fuelResult.value        = null;
    fuelLastTimestamp.value = null;
  } finally {
    fuelLoading.value = false;
  }
}

// Fetch when the drawer opens or switches to a different vehicle
watch(
  () => [props.open, props.assessment?.vehicleId] as const,
  ([open, vehicleId]) => {
    if (open && vehicleId) {
      loadFuelData(vehicleId);
    } else if (!open) {
      // Reset visible state; caches are kept for quick re-open
      fuelResult.value        = null;
      fuelLastTimestamp.value = null;
      fuelError.value         = false;
      fuelLoading.value       = false;
    }
  }
);

/* -------------------------
   ACTIONS
-------------------------- */

function handleFocusMap() {
  if (!props.assessment) return;
  const lat = parseFloat(props.assessment.position.latitude);
  const lng = parseFloat(props.assessment.position.longitude);
  if (!isNaN(lat) && !isNaN(lng)) {
    emit("focus-map", { latitude: lat, longitude: lng });
    emit("close");
  }
}
</script>

<template>
  <Teleport to="body">

    <!-- Overlay -->
    <Transition name="fade">
      <div
        v-if="open"
        class="drawer-overlay"
        @click="emit('close')"
      />
    </Transition>

    <!-- Drawer panel -->
    <Transition name="drawer">
      <div
        v-if="open && assessment"
        class="drawer-panel"
      >

        <!-- HEADER -->
        <div class="flex items-start justify-between p-4 border-b border-slate-800">
          <div class="flex-1 min-w-0 pr-4">
            <h2 class="text-base font-semibold text-slate-100 truncate">
              {{ assessment.vehicleName }}
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">
              {{ assessment.spz || "Bez SPZ" }}
            </p>
          </div>

          <button
            class="text-slate-400 hover:text-slate-200 transition flex-shrink-0"
            @click="emit('close')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- SCROLLABLE BODY -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">

          <!-- ---------------------------------------
               RISK SECTION
          --------------------------------------- -->
          <div
            class="rounded-lg bg-slate-800/60 pl-3 pr-3 py-3 border-l-4"
            :style="{ borderLeftColor: riskBorderColor(assessment.riskLevel) }"
          >
            <div class="flex items-start justify-between gap-3 mb-2">
              <span
                class="px-3 py-1 rounded-full text-xs font-semibold shrink-0"
                :class="riskBadgeClass(assessment.riskLevel)"
              >
                {{ formatRiskLevel(assessment.riskLevel) }}
              </span>
              <div class="text-right shrink-0" :class="{ 'score-pulse': scorePulse }">
                <span class="text-3xl font-bold text-slate-100 tabular-nums">
                  {{ animatedScore }}
                </span>
                <div class="text-[10px] text-slate-500 uppercase mt-0.5">Risk Score</div>
              </div>
            </div>
            <ul
              v-if="visibleReasons.length > 0"
              class="reasons-list space-y-1 text-xs text-slate-300 mt-2 pt-2 border-t border-slate-700"
            >
              <li
                v-for="reason in visibleReasons"
                :key="reason.type + String(reason.value)"
                class="py-0.5"
              >
                {{ reasonText(reason) }}
                <span
                  v-if="reason.type === 'weather' && !props.weatherRiskEnabled"
                  class="text-slate-500 ml-2"
                >
                  (nezohledněno)
                </span>
              </li>
            </ul>
          </div>

          <!-- ---------------------------------------
               ŽIVÁ DATA SECTION
          --------------------------------------- -->
          <div>
            <h3 class="text-xs font-semibold text-slate-400 uppercase mb-2">
              Živá data
            </h3>
            <div class="space-y-0">
              <div class="flex justify-between items-center py-1.5 border-b border-slate-800">
                <span class="text-xs text-slate-400">Rychlost</span>
                <span class="text-sm font-medium text-slate-200">{{ assessment.speed }} km/h</span>
              </div>
              <div class="flex justify-between items-center py-1.5 border-b border-slate-800">
                <span class="text-xs text-slate-400">Souřadnice</span>
                <span class="text-xs font-mono text-slate-400">
                  {{ assessment.position.latitude }}, {{ assessment.position.longitude }}
                </span>
              </div>
            </div>
          </div>

          <!-- ---------------------------------------
               SERVIS & ÚDRŽBA SECTION
          --------------------------------------- -->
          <div
            v-if="svc"
            class="rounded-lg pl-3 pr-3 py-3 border border-slate-700/60"
            :class="{ 'bg-red-900/15': svc.serviceStatus === 'critical' }"
          >
            <h3 class="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-2">
              <span>🛠</span>
              <span>Servis &amp; údržba</span>
            </h3>

            <div class="space-y-0">
              <div class="flex justify-between items-center py-1.5 border-b border-slate-800">
                <span class="text-xs text-slate-400">Aktuální nájezd</span>
                <span class="text-sm font-medium text-slate-200">{{ formatKm(svc.odometer) }}</span>
              </div>
              <div class="flex justify-between items-center py-1.5 border-b border-slate-800">
                <span class="text-xs text-slate-400">Další servis při</span>
                <span class="text-sm font-medium text-slate-200">{{ formatKm(svc.nextServiceAt) }}</span>
              </div>
              <div class="flex justify-between items-center py-1.5 border-b border-slate-800">
                <span class="text-xs text-slate-400">Zbývá</span>
                <span
                  class="text-sm font-semibold"
                  :class="{
                    'text-red-400':    svc.serviceStatus === 'critical',
                    'text-yellow-400': svc.serviceStatus === 'warning',
                    'text-green-400':  svc.serviceStatus === 'ok',
                  }"
                >
                  {{ formatKm(svc.remainingKm) }}
                </span>
              </div>
            </div>

            <div class="mt-2">
              <div class="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>Interval servisu</span>
                <span>{{ serviceStatusLabel(svc.serviceStatus) }}</span>
              </div>

              <template v-if="progressPercent !== null">
                <div class="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    :class="progressBarClass"
                    :style="{ width: progressPercent + '%' }"
                  />
                </div>
                <div class="text-[10px] text-slate-600 mt-0.5 text-right">
                  Využito {{ progressPercent }} % servisního intervalu
                </div>
              </template>

              <p v-else class="text-[11px] text-slate-500 italic mt-0.5">
                Interval nelze určit – chybí údaj o posledním servisu
              </p>
            </div>

            <div
              v-if="svc.serviceStatus === 'critical'"
              class="mt-2 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-medium border border-red-500/30"
            >
              🔴 Servis vyžaduje zásah
            </div>
          </div>

          <!-- ---------------------------------------
               PALIVO SECTION
          --------------------------------------- -->
          <div>
            <h3 class="text-xs font-semibold text-slate-400 uppercase mb-2">
              ⛽ Palivo
            </h3>

            <!-- Loading -->
            <div
              v-if="fuelLoading"
              class="text-xs text-slate-500 animate-pulse"
            >
              Načítám data paliva…
            </div>

            <!-- Error -->
            <div
              v-else-if="fuelError"
              class="text-xs text-slate-500 italic"
            >
              Data paliva nejsou dostupná
            </div>

            <!-- No anomaly -->
            <div
              v-else-if="fuelResult && fuelResult.severity === 'none'"
            >
              <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-green-900/30 border border-green-700 text-green-400 text-xs font-semibold">
                <span class="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"></span>
                Palivo v normě
              </div>
              <p class="mt-1 text-[11px] text-slate-500">
                Poslední kontrola: {{ formatRelativeTime(fuelLastTimestamp) ?? "Čas kontroly není k dispozici" }}
              </p>
            </div>

            <!-- Medium severity -->
            <div
              v-else-if="fuelResult && fuelResult.severity === 'medium'"
              class="flex items-start gap-2 px-3 py-2 rounded-lg bg-yellow-900/30 border border-yellow-700"
            >
              <span class="text-yellow-400 text-sm flex-shrink-0">⚠️</span>
              <div>
                <p class="text-xs font-semibold text-yellow-400 mb-0.5">
                  Zvýšená spotřeba paliva
                </p>
                <p class="text-xs text-yellow-300/80">
                  {{ fuelResult.description ?? "Spotřeba paliva neodpovídá aktuální rychlosti vozidla" }}
                </p>
                <p class="mt-1 text-[11px] text-yellow-500/60">
                  Poslední kontrola: {{ formatRelativeTime(fuelLastTimestamp) ?? "Čas kontroly není k dispozici" }}
                </p>
              </div>
            </div>

            <!-- High severity -->
            <div
              v-else-if="fuelResult && fuelResult.severity === 'high'"
              class="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-900/30 border border-red-700"
            >
              <span class="text-red-400 text-sm flex-shrink-0">🚨</span>
              <div>
                <p class="text-xs font-semibold text-red-400 mb-0.5">
                  Podezřelý úbytek paliva
                </p>
                <p class="text-xs text-red-300/80">
                  {{ fuelResult.description ?? "Náhlý pokles objemu paliva bez odpovídající jízdy" }}
                </p>
                <p class="mt-1 text-[11px] text-red-500/60">
                  Poslední kontrola: {{ formatRelativeTime(fuelLastTimestamp) ?? "Čas kontroly není k dispozici" }}
                </p>
              </div>
            </div>

          </div>

          <!-- ---------------------------------------
               WEATHER SECTION
          --------------------------------------- -->
          <div
            v-if="showWeatherSection && assessment?.weatherData"
            class="rounded-lg pl-3 pr-3 py-3 border border-slate-700/60 bg-slate-800/30"
            style="border-left: 3px solid rgba(56, 189, 248, 0.5);"
          >
            <h3 class="text-xs font-semibold text-slate-400 uppercase mb-2">
              Počasí
            </h3>
            <div class="flex items-start gap-2">
              <span class="text-lg shrink-0" aria-hidden="true">{{ weatherEmoji(assessment.weatherData.weatherId) }}</span>
              <div class="min-w-0 flex-1 space-y-0">
                <div class="text-xs font-medium text-slate-200 mb-0.5">
                  {{ weatherTypeLabel(assessment.weatherData) }}
                </div>
                <div
                  v-if="weatherImpact > 0"
                  class="text-xs text-sky-400/90 mb-1"
                >
                  +{{ weatherImpact }} bodů do risk skóre
                </div>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>Teplota</span>
                  <span class="text-slate-200">{{ Math.round(assessment.weatherData.temperature) }} °C</span>
                  <span>Vítr</span>
                  <span class="text-slate-200">{{ assessment.weatherData.windSpeed }} m/s</span>
                  <span>Srážky</span>
                  <span class="text-slate-200">{{ assessment.weatherData.precipitation }} mm</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- ACTIONS FOOTER -->
        <div class="p-4 border-t border-slate-800 flex gap-3">
          <button
            class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition"
            @click="handleFocusMap"
          >
            <span>📍</span>
            <span>Zobrazit na mapě</span>
          </button>
          <button
            class="px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 text-sm transition"
            @click="emit('close')"
          >
            Zavřít
          </button>
        </div>

      </div>
    </Transition>

  </Teleport>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 900;
}
.drawer-panel {
  position: fixed;
  top: 0;
  right: 0;
  height: 100%;
  width: 400px;
  z-index: 1000;
  background: rgb(15 23 42);
  border-left: 1px solid rgb(51 65 85);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.3s ease-out;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s ease-out;
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(100%);
}

.risk-fade-enter-active,
.risk-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.risk-fade-enter-from,
.risk-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.score-pulse {
  animation: pulseScore 400ms ease;
}
@keyframes pulseScore {
  0% { transform: scale(1); }
  40% { transform: scale(1.08); }
  100% { transform: scale(1); }
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 250ms ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.fade-slide-enter-to,
.fade-slide-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.reasons-list {
  list-style: none;
  padding-left: 0;
}
.reasons-list li::before {
  content: "•";
  margin-right: 8px;
  color: #94a3b8;
}
</style>
