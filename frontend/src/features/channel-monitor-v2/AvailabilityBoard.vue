<template>
  <section class="space-y-3" :aria-label="t('channelMonitorV2.availability.title')">
    <div class="card flex flex-wrap items-center gap-x-4 gap-y-3 !rounded-2xl px-4 py-3">
      <div class="flex flex-wrap items-center gap-1.5" data-testid="availability-overview">
        <span class="mr-1 text-sm font-semibold text-gray-900 dark:text-white">{{ t('channelMonitorV2.availability.overview') }}</span>
        <span
          v-for="state in states"
          :key="state"
          class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
          :class="availabilityTone[state].pill"
        >
          <i class="h-1.5 w-1.5 rounded-full" :class="availabilityTone[state].dot" />
          {{ t(`channelMonitorV2.availability.states.${state}`) }}
          <b class="font-semibold tabular-nums">{{ counts[state] }}</b>
        </span>
      </div>
      <div class="flex w-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto">
        <label class="relative min-w-[10rem] flex-1 lg:w-56 lg:flex-none">
          <Icon name="search" size="sm" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            v-model="search"
            type="search"
            class="input h-8 !rounded-lg !py-1 !pl-8 !pr-2.5 !text-xs"
            :placeholder="t('channelMonitorV2.availability.search')"
            :aria-label="t('channelMonitorV2.availability.search')"
          />
        </label>
        <Select v-model="sort" class="availability-compact-select w-[9rem] shrink-0" :options="sortOptions" :aria-label="t('channelMonitorV2.availability.sort')" />
        <button
          type="button"
          class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors"
          :class="issuesOnly
            ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:border-dark-600 dark:bg-dark-800 dark:text-gray-300 dark:hover:text-white'"
          :aria-pressed="issuesOnly"
          @click="issuesOnly = !issuesOnly"
        >
          <Icon name="exclamationTriangle" size="xs" />
          {{ t('channelMonitorV2.availability.issuesOnly') }}
        </button>
        <button
          v-if="entries.some(entry => entry.children.length)"
          type="button"
          class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-dark-700 dark:hover:text-white"
          @click="toggleAll"
        >
          <Icon :name="allExpanded ? 'chevronUp' : 'chevronDown'" size="xs" />
          {{ t(allExpanded ? 'channelMonitorV2.availability.collapseAll' : 'channelMonitorV2.availability.expandAll') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="grid gap-4" :class="layout === 'cards' ? 'sm:grid-cols-2 xl:grid-cols-3' : ''" aria-busy="true">
      <div v-for="n in (layout === 'cards' ? 6 : 4)" :key="n" class="animate-pulse rounded-2xl bg-gray-100 dark:bg-dark-800" :class="layout === 'cards' ? 'h-60' : 'h-16'" />
    </div>
    <div v-else-if="!entries.length" class="card !rounded-2xl px-6 py-12 text-center">
      <Icon :name="allEntries.length ? 'search' : 'inbox'" size="lg" class="mx-auto text-gray-300 dark:text-dark-500" />
      <p v-if="allEntries.length" class="mt-3 font-semibold text-gray-800 dark:text-gray-200">{{ t('channelMonitorV2.availability.noMatch') }}</p>
      <template v-else>
        <p class="mt-3 font-semibold text-gray-800 dark:text-gray-200">{{ t('channelMonitorV2.empty.title') }}</p>
        <p class="mt-1 text-sm text-gray-500">{{ t('channelMonitorV2.empty.description') }}</p>
      </template>
    </div>
    <div v-else-if="layout === 'cards'" class="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <AvailabilityCard
        v-for="entry in entries"
        :key="entry.key"
        :entry="entry"
        :coverage="coverage"
        :total-buckets="bucketStarts.length"
        :range-label="rangeLabel"
        :expanded="expanded.has(entry.key)"
        @toggle="toggle(entry.key)"
      />
    </div>
    <div v-else class="card !rounded-2xl">
      <div
        :class="[AVAILABILITY_LIST_GRID, 'hidden gap-x-4 border-b border-gray-100 px-5 py-2.5 text-[11px] font-medium text-gray-400 dark:border-dark-700/70 dark:text-dark-400 md:grid']"
        aria-hidden="true"
      >
        <span>{{ t('channelMonitorV2.availability.columns.name') }}</span>
        <span>{{ t('channelMonitorV2.availability.columns.status') }}</span>
        <span>{{ t('channelMonitorV2.availability.columns.availability') }}</span>
        <span>{{ t('channelMonitorV2.availability.avgTtft') }}</span>
        <span>{{ t('channelMonitorV2.availability.columns.timeline', { range: rangeLabel }) }}</span>
        <span />
      </div>
      <div class="divide-y divide-gray-100 dark:divide-dark-700/70">
        <AvailabilityListRow
          v-for="entry in entries"
          :key="entry.key"
          :entry="entry"
          :coverage="coverage"
          :expanded="expanded.has(entry.key)"
          @toggle="toggle(entry.key)"
        />
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-gray-500 dark:text-dark-400">
      <span v-for="state in states" :key="state" class="inline-flex items-center gap-1.5">
        <i class="h-2.5 w-2.5 rounded-[3px]" :class="availabilityTone[state].bar" />
        {{ t(`channelMonitorV2.availability.states.${state}`) }}
      </span>
      <span class="basis-full text-gray-400 dark:text-dark-500 sm:basis-auto">{{ t('channelMonitorV2.availability.legend') }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HealthState, MonitorCoverage, MonitorMatrixRow } from '@/api/channelMonitorV2'
import Select from '@/components/common/Select.vue'
import Icon from '@/components/icons/Icon.vue'
import { platformLabel } from '@/utils/platformColors'
import AvailabilityCard from './AvailabilityCard.vue'
import AvailabilityListRow from './AvailabilityListRow.vue'
import {
  AVAILABILITY_LIST_GRID, type AvailabilityEntry, availabilityState, availabilitySeverity, availabilityTone,
  availabilityValue, isAvailabilityIssue, monitorBucketStarts, monitorChildLabel, monitorChildren, monitorRowKey, monitorRowLabel,
} from './monitorAvailability'

const props = defineProps<{
  rows: MonitorMatrixRow[]
  children: MonitorMatrixRow[]
  coverage: MonitorCoverage
  layout: 'cards' | 'list'
  rangeLabel: string
  loading: boolean
}>()
const search = defineModel<string>('search', { default: '' })
const sort = defineModel<string>('sort', { default: 'severity' })
const issuesOnly = defineModel<boolean>('issuesOnly', { default: false })
const { t, locale } = useI18n()
const expanded = ref(new Set<string>())
const states: HealthState[] = ['healthy', 'warning', 'critical', 'unknown']
const sortOptions = computed(() => ['severity', 'name', 'avail-asc', 'avail-desc'].map(value => ({
  value, label: t(`channelMonitorV2.availability.sorts.${value}`),
})))
const bucketStarts = computed(() => monitorBucketStarts(props.coverage))
const bucketTimes = computed(() => new Set(bucketStarts.value.map(Date.parse)))
const otherLabel = computed(() => t('channelMonitorV2.otherModels'))
function label(row: MonitorMatrixRow) {
  return monitorRowLabel(row, otherLabel.value)
}
/** Children: issues first, the folded "other models" bucket last, then by name. */
function childOrder(a: MonitorMatrixRow, b: MonitorMatrixRow) {
  return availabilitySeverity[availabilityState(a.health)] - availabilitySeverity[availabilityState(b.health)] ||
    Number(a.model === '__other__') - Number(b.model === '__other__') ||
    label(a).localeCompare(label(b), locale.value)
}
const allEntries = computed<AvailabilityEntry[]>(() => props.rows.map(row => ({
  row, key: monitorRowKey(row), children: monitorChildren(row, props.children).sort(childOrder),
  dataBuckets: new Set(row.buckets.filter(b => availabilityState(b.health) !== 'unknown' && bucketTimes.value.has(Date.parse(b.bucket_start))).map(b => Date.parse(b.bucket_start))).size,
})))
const entries = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return allEntries.value.filter(entry => {
    const text = [platformLabel(entry.row.platform), label(entry.row), ...entry.children.map(child => monitorChildLabel(child, entry.row, otherLabel.value))]
      .join(' ').toLocaleLowerCase()
    return (!query || text.includes(query)) && (!issuesOnly.value || isAvailabilityIssue(entry.row.health))
  }).sort((a, b) => {
    const nameOrder = () => label(a.row).localeCompare(label(b.row), locale.value) || a.key.localeCompare(b.key)
    if (sort.value === 'name') return nameOrder()
    if (sort.value === 'avail-asc' || sort.value === 'avail-desc') {
      const av = availabilityValue(a.row.metrics, a.row.health)
      const bv = availabilityValue(b.row.metrics, b.row.health)
      if (av == null || bv == null) return av == null && bv == null ? nameOrder() : av == null ? 1 : -1
      return (sort.value === 'avail-asc' ? av - bv : bv - av) || nameOrder()
    }
    return availabilitySeverity[availabilityState(a.row.health)] - availabilitySeverity[availabilityState(b.row.health)] || nameOrder()
  })
})
// Overview reflects the API scope; search/issues-only only filter the visible cards.
const counts = computed(() => Object.fromEntries(states.map(state => [state, allEntries.value.filter(entry => availabilityState(entry.row.health) === state).length])) as Record<HealthState, number>)
const expandable = computed(() => entries.value.filter(entry => entry.children.length))
const allExpanded = computed(() => expandable.value.length > 0 && expandable.value.every(entry => expanded.value.has(entry.key)))
function toggle(key: string) {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}
function toggleAll() {
  expanded.value = allExpanded.value ? new Set() : new Set(expandable.value.map(entry => entry.key))
}
</script>

<style scoped>
.availability-compact-select :deep(.select-trigger) {
  @apply h-8 rounded-lg px-2.5 py-1 text-xs;
}
</style>
