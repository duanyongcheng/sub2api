<template>
  <section
    class="service-metric-cards grid grid-cols-2 gap-2.5 md:grid-cols-3"
    :class="showThroughput ? 'xl:grid-cols-6' : 'xl:grid-cols-5'"
    :aria-label="t('channelMonitorV2.summaryAria')"
    :aria-busy="loading"
    data-testid="service-metric-cards"
  >
    <template v-if="loading && !snapshot">
      <div v-for="index in (showThroughput ? 6 : 5)" :key="index" class="h-24 animate-pulse rounded-2xl bg-surface-3" aria-hidden="true" />
    </template>
    <template v-else>
      <MetricCell
        data-metric="availability"
        data-testid="service-availability"
        :label="t('channelMonitorV2.dashboard.metrics.availability')"
        :value="availability"
        :detail="t('channelMonitorV2.dashboard.metricHints.availability')"
        :state="snapshot?.health.error_rate"
      />
      <MetricCell data-metric="error-rate" :label="t('channelMonitorV2.dashboard.metrics.errorRate')" :value="errorRate" :detail="t('channelMonitorV2.dashboard.metricHints.errorRate')" :state="snapshot?.health.error_rate" />
      <MetricCell data-metric="ttft" :label="t('channelMonitorV2.dashboard.metrics.ttftP50')" :value="ttft" :detail="t('channelMonitorV2.dashboard.metricHints.ttftP95', { value: p95 })" :state="snapshot?.health.ttft" />
      <MetricCell v-if="showThroughput" data-metric="throughput" :label="t('channelMonitorV2.dashboard.metrics.throughput')" :value="throughput" :detail="t('channelMonitorV2.dashboard.metricHints.throughput')" />
      <MetricCell data-metric="cache-rate" :label="t('channelMonitorV2.dashboard.metrics.cacheRate')" :value="cacheRate" :detail="t('channelMonitorV2.dashboard.metricHints.cacheRate')" :state="snapshot?.health.cache" />
      <MetricCell data-metric="sample-coverage" :label="t('channelMonitorV2.dashboard.metrics.sampleCoverage')" :value="sampleRate" :detail="t('channelMonitorV2.dashboard.metricHints.sampleCoverage', { count: samples.count, total: samples.total })" :title="t('channelMonitorV2.dashboard.metricHints.sampleCoverageBasis')" />
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MonitorSnapshot } from '@/api/channelMonitorV2'
import MetricCell from './MetricCell.vue'
import { availabilityState, formatAvailability } from './monitorAvailability'
import { formatMonitorMs, formatMonitorPercent, formatMonitorTokensPerSecond } from './monitorFormat'
import { serviceSampleCoverage } from './serviceDashboard'

const props = defineProps<{ snapshot: MonitorSnapshot | null; showThroughput: boolean; loading?: boolean }>()
const { t } = useI18n()
const known = computed(() => Boolean(props.snapshot && availabilityState(props.snapshot.health) !== 'unknown'))
const finite = (value: number | null | undefined): value is number => value != null && Number.isFinite(value) && value >= 0
const availability = computed(() => props.snapshot ? formatAvailability(props.snapshot.metrics, props.snapshot.health) : '—')
const errorRate = computed(() => known.value && finite(props.snapshot?.metrics.error_rate) ? formatMonitorPercent(props.snapshot!.metrics.error_rate) : '—')
const ttftKnown = computed(() => Boolean(props.snapshot && props.snapshot.health.ttft !== 'unknown'))
const ttft = computed(() => ttftKnown.value && finite(props.snapshot?.metrics.ttft.p50_ms) ? formatMonitorMs(props.snapshot!.metrics.ttft.p50_ms) : '—')
const p95 = computed(() => ttftKnown.value && finite(props.snapshot?.metrics.ttft.p95_ms) ? formatMonitorMs(props.snapshot!.metrics.ttft.p95_ms) : '—')
const throughput = computed(() => known.value && finite(props.snapshot?.metrics.tpm) ? `${formatMonitorTokensPerSecond(props.snapshot!.metrics.tpm)} tok/s` : '—')
const cacheRate = computed(() => props.snapshot?.health.cache && props.snapshot.health.cache !== 'unknown' && finite(props.snapshot.metrics.cache_rate) ? formatMonitorPercent(props.snapshot.metrics.cache_rate) : '—')
const samples = computed(() => serviceSampleCoverage(props.snapshot))
const sampleRate = computed(() => samples.value.rate == null ? '—' : formatMonitorPercent(samples.value.rate))

</script>

<style scoped>
.service-metric-cards :deep(.stat-card) {
  background-color: rgb(var(--surface));
  min-width: 0;
  min-height: 5.75rem !important;
  padding: 0.75rem !important;
  border-radius: 0.875rem !important;
}
.service-metric-cards :deep(.stat-value) { font-size: 1.25rem; }
</style>
