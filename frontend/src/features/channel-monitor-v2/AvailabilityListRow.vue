<template>
  <article class="group/row" :data-platform="entry.row.platform" :data-state="state">
    <div :class="[AVAILABILITY_LIST_GRID, 'items-center gap-x-4 gap-y-2 px-4 py-3 md:px-5']">
      <div class="flex min-w-0 items-center gap-2">
        <i class="h-2 w-2 shrink-0 rounded-full md:hidden" :class="availabilityTone[state].dot" />
        <span
          v-if="title !== provider"
          class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
          :class="platformBadgeLightClass(entry.row.platform)"
        >{{ provider }}</span>
        <i v-else class="hidden h-2 w-2 shrink-0 rounded-full md:block" :style="{ backgroundColor: platformAccentColor(entry.row.platform) }" />
        <span class="truncate text-sm font-semibold text-gray-900 dark:text-white" :title="title">{{ title }}</span>
      </div>
      <div class="hidden items-center md:flex"><AvailabilityStatus :state="state" /></div>
      <div class="text-right md:text-left">
        <strong class="availability-value text-lg font-semibold tabular-nums" :class="availabilityTone[state].value">
          {{ formatAvailability(entry.row.metrics, entry.row.health) }}
        </strong>
      </div>
      <div
        class="hidden text-sm font-medium tabular-nums md:block"
        :class="latencyTone[averageLatencyState(entry.row)]"
        :title="t('channelMonitorV2.availability.avgTtft')"
      >{{ formatMonitorMs(entry.row.metrics.ttft.avg_ms) }}</div>
      <AvailabilityTimeline dense class="col-span-2 md:col-span-1" :buckets="entry.row.buckets" :coverage="coverage" />
      <button
        v-if="entry.children.length"
        type="button"
        class="col-span-2 inline-flex items-center gap-1.5 justify-self-start rounded-lg px-1.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-dark-700 dark:hover:text-white md:col-span-1 md:justify-self-end"
        :aria-expanded="expanded"
        :aria-label="childCount"
        @click="emit('toggle')"
      >
        <span class="md:hidden">{{ childCount }}</span>
        <Icon name="chevronDown" size="sm" class="transition-transform" :class="expanded ? 'rotate-180' : ''" />
      </button>
      <span v-else class="hidden md:block" />
    </div>

    <div
      v-if="expanded"
      class="divide-y divide-gray-100 border-t border-gray-100 bg-gray-50/70 group-last/row:rounded-b-2xl dark:divide-dark-700/60 dark:border-dark-700/70 dark:bg-dark-900/40"
    >
      <div
        v-for="child in entry.children"
        :key="monitorRowKey(child)"
        :class="[AVAILABILITY_LIST_GRID, 'items-center gap-x-4 gap-y-1.5 px-4 py-2 md:px-5']"
      >
        <div class="flex min-w-0 items-center gap-2 pl-3 md:pl-5">
          <i class="h-1.5 w-1.5 shrink-0 rounded-full" :class="availabilityTone[availabilityState(child.health)].dot" />
          <span class="truncate text-[13px] text-gray-700 dark:text-gray-200" :title="childLabel(child)">{{ childLabel(child) }}</span>
        </div>
        <span class="hidden text-xs md:block" :class="childStateTone(child)">
          {{ t(`channelMonitorV2.availability.states.${availabilityState(child.health)}`) }}
        </span>
        <strong class="text-right text-[13px] font-semibold tabular-nums md:text-left" :class="childValueTone(availabilityState(child.health))">
          {{ formatAvailability(child.metrics, child.health) }}
        </strong>
        <span class="hidden text-xs tabular-nums md:block" :class="latencyTone[averageLatencyState(child)]">
          {{ formatMonitorMs(child.metrics.ttft.avg_ms) }}
        </span>
        <AvailabilityTimeline compact class="col-span-2 md:col-span-1" :buckets="child.buckets" :coverage="coverage" />
        <span class="hidden md:block" />
      </div>
    </div>
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
  AVAILABILITY_LIST_GRID, type AvailabilityEntry, availabilityState, availabilityTone, averageLatencyState,
  childValueTone, formatAvailability, latencyTone, monitorChildKind, monitorChildLabel, monitorRowKey, monitorRowLabel,
} from './monitorAvailability'

const props = defineProps<{ entry: AvailabilityEntry; coverage: MonitorCoverage; expanded: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
const { t } = useI18n()
const state = computed(() => availabilityState(props.entry.row.health))
const provider = computed(() => platformLabel(props.entry.row.platform))
const title = computed(() => monitorRowLabel(props.entry.row, t('channelMonitorV2.otherModels')))
const childCount = computed(() => t(`channelMonitorV2.availability.children.${monitorChildKind(props.entry.row)}`, props.entry.children.length))
function childLabel(child: MonitorMatrixRow) {
  return monitorChildLabel(child, props.entry.row, t('channelMonitorV2.otherModels'))
}
function childStateTone(child: MonitorMatrixRow) {
  const childState = availabilityState(child.health)
  return childState === 'healthy' || childState === 'unknown' ? 'text-gray-400 dark:text-dark-400' : availabilityTone[childState].value
}
</script>
