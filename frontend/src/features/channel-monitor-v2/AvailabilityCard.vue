<template>
  <article
    class="card flex min-w-0 flex-col !rounded-2xl"
    :class="availabilityTone[state].ring"
    :data-platform="entry.row.platform"
    :data-state="state"
  >
    <div class="flex flex-col gap-4 p-5">
      <header class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <span
            v-if="title !== provider"
            class="mb-1.5 inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
            :class="platformBadgeLightClass(entry.row.platform)"
          >{{ provider }}</span>
          <h3 class="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-gray-900 dark:text-white">
            <i v-if="title === provider" class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: platformAccentColor(entry.row.platform) }" />
            <span class="truncate" :title="title">{{ title }}</span>
          </h3>
        </div>
        <AvailabilityStatus :state="state" />
      </header>

      <div class="flex items-end justify-between gap-3">
        <div class="min-w-0">
          <strong class="availability-value block text-[32px] font-semibold leading-none tracking-tight tabular-nums" :class="availabilityTone[state].value">
            {{ formatAvailability(entry.row.metrics, entry.row.health) }}
          </strong>
          <span class="mt-1.5 block text-xs text-gray-400 dark:text-dark-400">{{ t('channelMonitorV2.availability.windowRate', { range: rangeLabel }) }}</span>
        </div>
        <div class="shrink-0 text-right">
          <span
            class="block text-sm font-semibold tabular-nums"
            :class="latencyTone[averageLatencyState(entry.row)]"
            :title="t('channelMonitorV2.availability.avgTtft')"
          >{{ formatMonitorMs(entry.row.metrics.ttft.avg_ms) }}</span>
          <span class="mt-1 block text-xs text-gray-400 dark:text-dark-400">{{ t('channelMonitorV2.availability.avgTtft') }}</span>
        </div>
      </div>

      <AvailabilityTimeline :buckets="entry.row.buckets" :coverage="coverage" />
    </div>

    <footer class="mt-auto flex min-h-[2.75rem] items-center justify-between gap-3 border-t border-gray-100 px-5 py-2 text-xs dark:border-dark-700/70">
      <span class="truncate text-gray-400 dark:text-dark-400">{{ t('channelMonitorV2.availability.coverage', { count: entry.dataBuckets, total: totalBuckets }) }}</span>
      <button
        v-if="entry.children.length"
        type="button"
        class="-mr-2 inline-flex shrink-0 items-center gap-2 rounded-lg px-2 py-1 font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-dark-700 dark:hover:text-white"
        :aria-expanded="expanded"
        @click="emit('toggle')"
      >
        <span class="flex items-center gap-[3px]" aria-hidden="true">
          <i v-for="(child, index) in entry.children.slice(0, 8)" :key="index" class="h-1.5 w-1.5 rounded-full" :class="availabilityTone[availabilityState(child.health)].dot" />
        </span>
        {{ t(`channelMonitorV2.availability.children.${monitorChildKind(entry.row)}`, entry.children.length) }}
        <Icon name="chevronDown" size="sm" class="transition-transform" :class="expanded ? 'rotate-180' : ''" />
      </button>
    </footer>

    <ul
      v-if="expanded"
      class="divide-y divide-gray-100 rounded-b-2xl border-t border-gray-100 bg-gray-50/70 dark:divide-dark-700/60 dark:border-dark-700/70 dark:bg-dark-900/40"
    >
      <li
        v-for="child in entry.children"
        :key="monitorRowKey(child)"
        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-5 py-2.5"
      >
        <span class="flex min-w-0 items-center gap-2">
          <i class="h-1.5 w-1.5 shrink-0 rounded-full" :class="availabilityTone[availabilityState(child.health)].dot" />
          <span class="truncate text-[13px] text-gray-700 dark:text-gray-200" :title="childLabel(child)">{{ childLabel(child) }}</span>
        </span>
        <span class="flex items-baseline gap-3 tabular-nums">
          <span class="text-[11px]" :class="latencyTone[averageLatencyState(child)]" :title="t('channelMonitorV2.availability.avgTtft')">{{ formatMonitorMs(child.metrics.ttft.avg_ms) }}</span>
          <strong class="w-[3.75rem] text-right text-[13px] font-semibold" :class="childValueTone(availabilityState(child.health))">{{ formatAvailability(child.metrics, child.health) }}</strong>
        </span>
        <AvailabilityTimeline compact class="col-span-2" :buckets="child.buckets" :coverage="coverage" />
      </li>
    </ul>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MonitorCoverage, MonitorMatrixRow } from '@/api/channelMonitorV2'
import Icon from '@/components/icons/Icon.vue'
import { platformAccentColor, platformBadgeLightClass, platformLabel } from '@/utils/platformColors'
import AvailabilityStatus from './AvailabilityStatus.vue'
import AvailabilityTimeline from './AvailabilityTimeline.vue'
import { formatMonitorMs } from './monitorFormat'
import {
  type AvailabilityEntry, availabilityState, availabilityTone, averageLatencyState, childValueTone, formatAvailability,
  latencyTone, monitorChildKind, monitorChildLabel, monitorRowKey, monitorRowLabel,
} from './monitorAvailability'

const props = defineProps<{
  entry: AvailabilityEntry
  coverage: MonitorCoverage
  totalBuckets: number
  rangeLabel: string
  expanded: boolean
}>()
const emit = defineEmits<{ toggle: [] }>()
const { t } = useI18n()
const state = computed(() => availabilityState(props.entry.row.health))
const provider = computed(() => platformLabel(props.entry.row.platform))
const title = computed(() => monitorRowLabel(props.entry.row, t('channelMonitorV2.otherModels')))
function childLabel(child: MonitorMatrixRow) {
  return monitorChildLabel(child, props.entry.row, t('channelMonitorV2.otherModels'))
}
</script>
