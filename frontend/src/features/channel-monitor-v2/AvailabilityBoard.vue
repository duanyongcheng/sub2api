<template>
  <section class="space-y-4" :aria-label="t('channelMonitorV2.availability.title')">
    <div v-if="!loading" class="card flex flex-wrap items-center justify-between gap-3 !rounded-2xl p-4">
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <strong class="text-gray-900 dark:text-white">{{ t('channelMonitorV2.availability.overview') }}</strong>
        <span v-for="state in states" :key="state" class="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <i class="h-2 w-2 rounded-full" :class="dots[state]" />
          {{ t(`channelMonitorV2.availability.states.${state}`) }}
          <b class="tabular-nums text-gray-700 dark:text-gray-200">{{ counts[state] }}</b>
        </span>
      </div>
      <button v-if="entries.length" type="button" class="btn btn-ghost btn-sm" @click="toggleAll">
        {{ t(allExpanded ? 'channelMonitorV2.availability.collapseAll' : 'channelMonitorV2.availability.expandAll') }}
      </button>
    </div>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      <div v-for="n in 6" :key="n" class="h-56 animate-pulse rounded-2xl bg-gray-100 dark:bg-dark-800" />
    </div>
    <div v-else-if="!entries.length" class="card !rounded-2xl p-10 text-center">
      <p class="font-semibold text-gray-800 dark:text-gray-200">{{ t('channelMonitorV2.empty.title') }}</p>
      <p class="mt-2 text-sm text-gray-500">{{ t('channelMonitorV2.empty.description') }}</p>
    </div>
    <div v-else class="grid items-start gap-4" :class="layout === 'cards' ? 'sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'">
      <article
        v-for="entry in entries"
        :key="entry.key"
        class="card min-w-0 overflow-hidden !rounded-2xl border-t-[3px] shadow-sm"
        :class="borders[availabilityState(entry.row.health)]"
        :data-platform="entry.row.platform"
      >
        <div class="p-5" :class="layout === 'list' ? 'md:grid md:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1.5fr)] md:items-center md:gap-6' : ''">
          <div class="min-w-0">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span class="inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold" :class="platformBadgeLightClass(entry.row.platform)">{{ platformLabel(entry.row.platform) }}</span>
              <span class="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                <i class="h-1.5 w-1.5 rounded-full" :class="dots[availabilityState(entry.row.health)]" />
                {{ t(`channelMonitorV2.availability.states.${availabilityState(entry.row.health)}`) }}
              </span>
            </div>
            <h3 class="truncate text-base font-semibold text-gray-900 dark:text-white" :title="label(entry.row)">{{ label(entry.row) }}</h3>
          </div>
          <div class="my-4" :class="layout === 'list' ? 'md:my-0' : ''">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <strong class="availability-value text-3xl font-semibold tracking-tight tabular-nums text-gray-900 dark:text-white">{{ formatAvailability(entry.row.metrics, entry.row.health) }}</strong>
              <span class="inline-flex items-center gap-1 text-xs tabular-nums" :class="latencyColor(entry.row)" :title="t('channelMonitorV2.availability.avgTtft')">
                <Icon name="clock" size="sm" />{{ formatMonitorMs(entry.row.metrics.ttft.avg_ms) }}
              </span>
            </div>
            <p class="mt-1 text-[11px] text-gray-400">{{ t('channelMonitorV2.availability.windowRate', { range: rangeLabel }) }}</p>
          </div>
          <AvailabilityTimeline :buckets="entry.row.buckets" :coverage="coverage" />
        </div>
        <div class="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 text-xs text-gray-400 dark:border-dark-700">
          <span>{{ t('channelMonitorV2.availability.coverage', { count: entry.dataBuckets, total: bucketStarts.length }) }}</span>
          <button v-if="entry.children.length" type="button" class="inline-flex items-center gap-1 font-medium text-gray-600 hover:text-primary-600 dark:text-gray-300" :aria-expanded="expanded.has(entry.key)" @click="toggle(entry.key)">
            {{ t(expanded.has(entry.key) ? 'channelMonitorV2.availability.collapse' : 'channelMonitorV2.availability.expand', { count: entry.children.length }) }}
            <Icon name="chevronDown" size="sm" :class="expanded.has(entry.key) ? 'rotate-180' : ''" />
          </button>
        </div>
        <div v-if="expanded.has(entry.key)" class="divide-y divide-gray-100 border-t border-gray-100 bg-gray-50/60 dark:divide-dark-700 dark:border-dark-700 dark:bg-dark-900/30">
          <div v-for="child in entry.children" :key="monitorRowKey(child)" class="flex items-center gap-2 px-5 py-3 text-xs">
            <i class="h-1.5 w-1.5 shrink-0 rounded-full" :class="dots[availabilityState(child.health)]" />
            <span class="min-w-0 flex-1 truncate text-gray-600 dark:text-gray-300" :title="label(child)">{{ label(child) }}</span>
            <strong class="shrink-0 tabular-nums text-gray-700 dark:text-gray-200">{{ formatAvailability(child.metrics, child.health) }}</strong>
          </div>
        </div>
      </article>
    </div>
    <p class="text-xs leading-relaxed text-gray-400">{{ t('channelMonitorV2.availability.legend') }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HealthState, MonitorCoverage, MonitorMatrixRow } from '@/api/channelMonitorV2'
import Icon from '@/components/icons/Icon.vue'
import { platformLabel, platformBadgeLightClass } from '@/utils/platformColors'
import AvailabilityTimeline from './AvailabilityTimeline.vue'
import { formatMonitorMs } from './monitorFormat'
import { availabilityState, availabilityValue, availabilitySeverity, formatAvailability, isAvailabilityIssue, monitorBucketStarts, monitorChildren, monitorRowKey } from './monitorAvailability'

const props = defineProps<{
  rows: MonitorMatrixRow[]
  children: MonitorMatrixRow[]
  coverage: MonitorCoverage
  layout: 'cards' | 'list'
  rangeLabel: string
  search: string
  sort: string
  issuesOnly: boolean
  loading: boolean
}>()
const { t, locale } = useI18n()
const expanded = ref(new Set<string>())
const states: HealthState[] = ['healthy', 'warning', 'critical', 'unknown']
const dots: Record<HealthState, string> = {
  healthy: 'bg-emerald-500', warning: 'bg-amber-400', critical: 'bg-rose-500', unknown: 'bg-gray-300 dark:bg-dark-500',
}
const borders: Record<HealthState, string> = {
  healthy: '!border-t-emerald-500', warning: '!border-t-amber-400', critical: '!border-t-rose-500', unknown: '!border-t-gray-300 dark:!border-t-dark-500',
}
const bucketStarts = computed(() => monitorBucketStarts(props.coverage))
const bucketTimes = computed(() => new Set(bucketStarts.value.map(Date.parse)))
function label(row: MonitorMatrixRow) {
  const parts = [row.group_name || (row.group_id ? `#${row.group_id}` : ''), row.model === '__other__' ? t('channelMonitorV2.otherModels') : row.model].filter(Boolean)
  return parts.join(' / ') || platformLabel(row.platform)
}
const entries = computed(() => {
  const query = props.search.trim().toLocaleLowerCase()
  return props.rows.map(row => ({
    row, key: monitorRowKey(row), children: monitorChildren(row, props.children),
    dataBuckets: new Set(row.buckets.filter(b => availabilityState(b.health) !== 'unknown' && bucketTimes.value.has(Date.parse(b.bucket_start))).map(b => Date.parse(b.bucket_start))).size,
  })).filter(entry => {
    const text = [platformLabel(entry.row.platform), label(entry.row), ...entry.children.map(label)].join(' ').toLocaleLowerCase()
    return (!query || text.includes(query)) && (!props.issuesOnly || isAvailabilityIssue(entry.row.health))
  }).sort((a, b) => {
    const nameOrder = () => label(a.row).localeCompare(label(b.row), locale.value) || a.key.localeCompare(b.key)
    if (props.sort === 'name') return nameOrder()
    if (props.sort === 'avail-asc' || props.sort === 'avail-desc') {
      const av = availabilityValue(a.row.metrics, a.row.health)
      const bv = availabilityValue(b.row.metrics, b.row.health)
      if (av == null || bv == null) return av == null && bv == null ? nameOrder() : av == null ? 1 : -1
      return (props.sort === 'avail-asc' ? av - bv : bv - av) || nameOrder()
    }
    return availabilitySeverity[availabilityState(a.row.health)] - availabilitySeverity[availabilityState(b.row.health)] || nameOrder()
  })
})
const counts = computed(() => Object.fromEntries(states.map(state => [state, entries.value.filter(entry => availabilityState(entry.row.health) === state).length])) as Record<HealthState, number>)
const allExpanded = computed(() => entries.value.length > 0 && entries.value.every(entry => expanded.value.has(entry.key)))
function toggle(key: string) {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}
function toggleAll() {
  expanded.value = allExpanded.value ? new Set() : new Set(entries.value.map(entry => entry.key))
}
function latencyColor(row: MonitorMatrixRow) {
  const average = row.metrics.ttft.avg_ms
  const thresholds = row.health.thresholds
  // The displayed metric is AVG, whereas backend health.ttft scores P50.
  const state = average == null || !thresholds ? 'unknown'
    : average >= thresholds.critical_ttft_ms ? 'critical'
      : average >= thresholds.warning_ttft_ms ? 'warning' : 'healthy'
  return state === 'critical' ? 'text-rose-600 dark:text-rose-400' : state === 'warning' ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400'
}
</script>
