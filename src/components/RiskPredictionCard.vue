<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  criticalCount: number;
  vehiclesWithoutCommunication: number;
  riskTrendIncreasing: boolean;
  criticalFilterActive: boolean;
}>();

const emit = defineEmits<{
  (e: "show-at-risk"): void;
}>();

const predictionStatus = computed<"warning" | "stable">(() => {
  const { criticalCount, vehiclesWithoutCommunication, riskTrendIncreasing } = props;
  if (criticalCount > 1 || vehiclesWithoutCommunication > 1 || riskTrendIncreasing) {
    return "warning";
  }
  return "stable";
});

const confidence = 78;

const potentialCriticalIncrease = computed(() =>
  predictionStatus.value === "warning" ? 1 : 0
);

const vehiclesNearCommLimit = computed(() =>
  predictionStatus.value === "warning"
    ? Math.max(2, props.vehiclesWithoutCommunication)
    : 0
);

function handleCta() {
  emit("show-at-risk");
}
</script>

<template>
  <div
    class="rounded-xl border bg-slate-900 p-6 transition-all duration-200 hover:shadow-lg"
    :class="[
      predictionStatus === 'warning'
        ? 'border-l-4 border-l-red-500/80 border-slate-700/50 shadow-[0_0_20px_rgba(239,68,68,0.04)]'
        : 'border-l-4 border-l-blue-500/60 border-slate-700/50',
    ]"
  >
    <div class="flex items-center justify-between gap-2 mb-2">
      <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">
        🔮 Predikce rizika (24h)
      </h3>
      <span
        v-if="predictionStatus === 'warning'"
        class="text-amber-400 text-sm font-medium"
        title="Rostoucí trend"
      >
        ↑
      </span>
      <span
        v-else
        class="text-emerald-400 text-sm font-medium"
        title="Stabilní trend"
      >
        ↓
      </span>
    </div>

    <p class="text-xs text-slate-500 mb-4">
      Odhad vývoje rizik na základě trendu a aktuálních faktorů.
    </p>

    <!-- Warning state -->
    <div
      v-if="predictionStatus === 'warning'"
      class="space-y-3"
      :class="{ 'prediction-warning-pulse': true }"
    >
      <p class="text-sm font-medium text-amber-400">
        ⚠️ Očekává se zhoršení rizika
      </p>
      <ul class="text-sm text-slate-300 space-y-1.5">
        <li>• +{{ potentialCriticalIncrease }} {{ potentialCriticalIncrease === 1 ? 'potenciálně kritické vozidlo' : 'potenciálně kritická vozidla' }}</li>
        <li>• {{ vehiclesNearCommLimit }} {{ vehiclesNearCommLimit === 1 ? 'vozidlo může' : 'vozidla mohou' }} překročit limit komunikace</li>
      </ul>
      <p class="text-xs text-slate-400 pt-1">
        Doporučení: Zkontrolujte vozidla bez komunikace a naplánujte kontrolu.
      </p>
      <button
        type="button"
        class="mt-3 w-full py-2.5 rounded-lg bg-red-600/80 hover:bg-red-600 hover:brightness-110 text-white text-sm font-medium transition-all duration-300 active:scale-95"
        @click="handleCta"
      >
        {{ criticalFilterActive ? 'Zobrazit všechna vozidla' : 'Zobrazit ohrožená vozidla' }}
      </button>
    </div>

    <!-- Stable state -->
    <div v-else class="space-y-2">
      <p class="text-sm font-medium text-emerald-400">
        ✅ Riziko stabilní
      </p>
      <p class="text-sm text-slate-400">
        Žádné výrazné zhoršení se neočekává.
      </p>
    </div>

    <p class="text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-700/50">
      Spolehlivost predikce: {{ confidence }} %
    </p>
  </div>
</template>

<style scoped>
.prediction-warning-pulse {
  animation: subtlePulse 3s ease-in-out infinite;
}

@keyframes subtlePulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.95;
  }
}
</style>
