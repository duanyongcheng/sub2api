<template>
  <article
    class="card group flex min-w-0 cursor-pointer flex-col !rounded-xl transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-primary-500/40"
    :class="availabilityTone[state].ring"
    :data-platform="entry.row.platform"
    :data-state="state"
    tabindex="0"
    role="button"
    :aria-label="t('channelMonitorV2.availability.openGroup', { name: title })"
    @click="emit('details')"
    @keydown.enter="emit('details')"
    @keydown.space.prevent="emit('details')"
  >
    <header class="flex min-w-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-dark-700/70">
      <div class="flex min-w-0 items-center gap-2.5">
        <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" :class="platformBadgeLightClass(entry.row.platform)">
          <i class="h-2 w-2 rounded-full" :style="{ backgroundColor: platformAccentColor(entry.row.platform) }" />
        </span>
        <div class="min-w-0">
          <h3 class="truncate text-sm font-semibold text-gray-900 dark:text-white" :title="title">{{ title }}</h3>
          <p class="truncate text-[11px] text-gray-400 dark:text-dark-400">{{ provider }}</p>
        </div>
      </div>
      <AvailabilityStatus :state="state" />
    </header>

    <div class="grid grid-cols-3 divide-x divide-gray-100 px-3 py-3 dark:divide-dark-700/70 sm:px-4">
      <div class="min-w-0 px-2 first:pl-0">
        <span class="block truncate text-[10px] text-gray-400 dark:text-dark-400">{{ t('channelMonitorV2.availability.columns.availability') }}</span>
        <strong class="availability-value mt-1 block truncate text-base font-semibold tabular-nums" :class="availabilityTone[state].value">
          {{ formatAvailability(entry.row.metrics, entry.row.health) }}
        </strong>
      </div>
      <div class="min-w-0 px-2">
        <span class="block truncate text-[10px] text-gray-400 dark:text-dark-400">{{ t('channelMonitorV2.metrics.cacheRate') }}</span>
        <strong class="mt-1 block truncate text-base font-semibold tabular-nums text-gray-800 dark:text-gray-100">
          {{ formatMonitorPercent(entry.row.metrics.cache_rate) }}
        </strong>
      </div>
      <div class="min-w-0 px-2 last:pr-0">
        <span class="block truncate text-[10px] text-gray-400 dark:text-dark-400">{{ t('channelMonitorV2.availability.avgTtft') }}</span>
        <strong class="mt-1 block truncate text-base font-semibold tabular-nums" :class="latencyTone[averageLatencyState(entry.row)]" :title="t('channelMonitorV2.availability.avgTtft')">
          {{ formatMonitorMs(entry.row.metrics.ttft.avg_ms) }}
        </strong>
      </div>
    </div>

    <div class="px-4 pb-3">
      <div class="mb-2 flex items-center justify-between gap-2 text-[10px] text-gray-400 dark:text-dark-400">
        <span>{{ t('channelMonitorV2.availability.history', { range: rangeLabel }) }}</span>
        <span class="tabular-nums">{{ t('channelMonitorV2.availability.coverage', { count: entry.dataBuckets, total: totalBuckets }) }}</span>
      </div>
      <AvailabilityTimeline compact :buckets="entry.row.buckets" :coverage="coverage" />
    </div>

    <footer class="mt-auto flex min-h-9 items-center justify-between gap-2 border-t border-gray-100 px-4 py-2 text-xs dark:border-dark-700/70">
      <span class="truncate text-gray-500 dark:text-dark-400">
        {{ t(`channelMonitorV2.availability.children.${monitorChildKind(entry.row)}`, entry.children.length) }}
      </span>
      <span class="inline-flex shrink-0 items-center gap-1 font-medium text-primary-600 group-hover:text-primary-700 dark:text-primary-300">
        {{ t('channelMonitorV2.availability.viewDetails') }}
        <Icon name="chevronRight" size="xs" />
      </span>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MonitorCoverage } from '@/api/channelMonitorV2'
import Icon from '@/components/icons/Icon.vue'
import AvailabilityStatus from './AvailabilityStatus.vue'
import AvailabilityTimeline from './AvailabilityTimeline.vue'
import { formatMonitorMs, formatMonitorPercent } from './monitorFormat'
import {
  type AvailabilityEntry, availabilityState, availabilityTone, averageLatencyState,
  latencyTone, monitorChildKind, monitorRowLabel, formatAvailability,
} from './monitorAvailability'
import { platformAccentColor, platformBadgeLightClass, platformLabel } from '@/utils/platformColors'

const props = defineProps<{
  entry: AvailabilityEntry
  coverage: MonitorCoverage
  totalBuckets: number
  rangeLabel: string
}>()
const emit = defineEmits<{ details: [] }>()
const { t } = useI18n()
const state = computed(() => availabilityState(props.entry.row.health))
const provider = computed(() => platformLabel(props.entry.row.platform))
const title = computed(() => monitorRowLabel(props.entry.row, t('channelMonitorV2.otherModels')))
</script>
