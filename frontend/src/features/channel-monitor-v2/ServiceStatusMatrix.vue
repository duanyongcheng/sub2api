<template>
  <section class="card service-status-matrix !rounded-2xl !border-0 ring-1 ring-gray-900/5 dark:ring-dark-700" :aria-label="t('channelMonitorV2.service.matrixTitle')">
    <div class="service-matrix-grid service-matrix-header rounded-t-2xl border-b border-gray-100 bg-surface-2 text-[11px] font-semibold text-gray-500 dark:border-dark-700/70 dark:text-dark-400" aria-hidden="true">
      <span>{{ t('channelMonitorV2.matrix.dimension') }}</span>
      <span>{{ t('channelMonitorV2.availability.columns.availability') }}</span>
      <span class="truncate" :title="t('channelMonitorV2.availability.avgTtft')">{{ t('channelMonitorV2.availability.avgTtft') }}</span>
      <span class="flex min-w-0 justify-between gap-3 tabular-nums"><span>{{ axisStart }}</span><span>{{ axisEnd }}</span></span>
      <span class="text-right">{{ t('channelMonitorV2.operations.healthScore') }}</span>
    </div>
    <div class="divide-y divide-gray-100 dark:divide-dark-700/70">
      <ServiceGroupCard v-for="entry in entries" :key="entry.key" :entry="entry" :coverage="coverage" :range-label="rangeLabel" />
    </div>
    <footer class="flex min-h-[30px] flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-100 px-3 py-1.5 text-[10px] text-gray-500 dark:border-dark-700/70 dark:text-dark-400">
      <span v-for="state in states" :key="state" class="inline-flex items-center gap-1.5">
        <i class="h-2 w-2 rounded-full" :class="availabilityTone[state].dot" />{{ t(`channelMonitorV2.availability.states.${state}`) }}
      </span>
      <span class="sm:ml-auto">{{ t('channelMonitorV2.service.timelineLegend') }}</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HealthState, MonitorCoverage } from '@/api/channelMonitorV2'
import ServiceGroupCard from './ServiceGroupCard.vue'
import { type AvailabilityEntry, availabilityTone } from './monitorAvailability'

const props = defineProps<{ entries: AvailabilityEntry[]; coverage: MonitorCoverage | null; rangeLabel: string }>()
const { t, locale } = useI18n()
const states: HealthState[] = ['healthy', 'warning', 'critical', 'unknown']
function formatTime(value?: string) {
  const date = new Date(value || '')
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(locale.value, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—'
}
const axisStart = computed(() => formatTime(props.coverage?.requested_start))
const axisEnd = computed(() => formatTime(props.coverage?.requested_end || props.coverage?.data_through))
</script>

<style scoped>
.service-status-matrix :deep(.service-matrix-grid) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: center;
  line-height: 1rem;
  gap: 0.5rem 0.75rem;
  padding: 0.75rem;
}
.service-matrix-header { display: none !important; }
.service-status-matrix :deep(.availability-strip) {
  height: 1.25rem;
  gap: 2px;
}
.service-status-matrix :deep(.availability-strip > .bg-gray-200) {
  background-color: rgb(var(--edge-strong));
}
.service-status-matrix :deep(.pill-ok) { color: rgb(var(--ok-600)); }
.service-status-matrix :deep(.pill-warn) { color: rgb(var(--warn-600)); }
.service-status-matrix :deep(.pill-bad) { color: rgb(var(--bad-600)); }
@media (min-width: 1024px) {
  .service-status-matrix :deep(.service-matrix-grid) {
    grid-template-columns: minmax(9rem, 12rem) 4.25rem 5.75rem minmax(0, 1fr) 3rem;
    min-height: 2.375rem;
    column-gap: 0.75rem;
    padding: 0.375rem 0.75rem;
  }
  .service-status-matrix :deep(.service-matrix-model) {
    min-height: 2rem;
    padding-top: 0.3125rem;
    padding-bottom: 0.3125rem;
  }
  .service-matrix-header {
    display: grid !important;
    min-height: 1.875rem !important;
    padding-top: 0.3125rem !important;
    padding-bottom: 0.3125rem !important;
  }
}
</style>
