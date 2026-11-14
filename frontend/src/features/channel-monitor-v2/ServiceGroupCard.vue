<template>
  <article class="group/service-row min-w-0" :data-platform="entry.row.platform" :data-state="state" :data-group-id="entry.row.group_id ?? undefined">
    <div class="service-matrix-grid transition-colors hover:bg-surface-2">
      <div class="col-span-3 flex min-w-0 items-center gap-2 lg:col-span-1">
        <i class="h-2 w-2 shrink-0 rounded-full" :class="availabilityTone[state].dot" :title="stateLabel" aria-hidden="true" />
        <div class="flex min-w-0 flex-1 items-baseline gap-1.5">
          <h3 class="truncate text-xs font-semibold text-gray-900 dark:text-white" :title="title">{{ title }}</h3>
          <span v-if="title !== provider" class="max-w-20 shrink-0 truncate text-[10px] text-gray-400 dark:text-dark-400" :title="provider">{{ provider }}</span>
          <span class="sr-only">{{ stateLabel }}</span>
        </div>
        <button
          v-if="entry.children.length"
          type="button"
          class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 dark:hover:bg-dark-700 dark:hover:text-gray-200"
          :aria-expanded="expanded"
          :aria-label="expandLabel"
          @click="expanded = !expanded"
        ><Icon name="chevronDown" size="sm" class="transition-transform" :class="expanded ? 'rotate-180' : ''" /></button>
      </div>
      <div>
        <span class="mb-1 block text-[10px] text-gray-400 dark:text-dark-400 lg:sr-only">{{ t('channelMonitorV2.availability.columns.availability') }}</span>
        <strong class="text-xs font-semibold tabular-nums" :class="availabilityTone[state].value">{{ formatAvailability(entry.row.metrics, entry.row.health) }}</strong>
      </div>
      <div :title="t('channelMonitorV2.availability.avgTtft')">
        <span class="mb-1 block text-[10px] text-gray-400 dark:text-dark-400 lg:sr-only">{{ t('channelMonitorV2.availability.avgTtft') }}</span>
        <span class="text-xs font-medium tabular-nums text-gray-600 dark:text-gray-300">{{ formatMonitorMs(entry.row.metrics.ttft.avg_ms) }}</span>
      </div>
      <div class="col-span-3 min-w-0 lg:col-span-1">
        <AvailabilityTimeline v-if="coverage" :buckets="entry.row.buckets" :coverage="coverage" dense />
        <div v-else class="h-5 rounded bg-gray-100 dark:bg-dark-700" aria-hidden="true" />
        <p class="mt-1.5 flex justify-between text-[10px] tabular-nums text-gray-400 dark:text-dark-400 lg:hidden"><span>{{ rangeLabel }}</span><span>{{ t('channelMonitorV2.service.timelineLegend') }}</span></p>
      </div>
      <div class="col-start-3 row-start-2 text-right lg:col-auto lg:row-auto" :title="t('channelMonitorV2.service.healthScoreHint')">
        <span class="mb-1 block text-[10px] text-gray-400 dark:text-dark-400 lg:sr-only">{{ t('channelMonitorV2.operations.healthScore') }}</span>
        <StatusPill :tone="state === 'unknown' ? 'neutral' : scoreTone(entry.row.health)" :dot="false" :label="score(entry.row)" />
      </div>
    </div>

    <div v-if="expanded && entry.children.length" class="border-t border-gray-100 bg-surface-2 dark:border-dark-700/70" data-testid="service-model-details">
      <div v-for="child in sortedChildren" :key="monitorRowKey(child)" class="service-matrix-grid service-matrix-model border-b border-gray-100/80 last:border-0 dark:border-dark-700/50" :data-state="availabilityState(child.health)">
        <div class="col-span-3 flex min-w-0 items-center gap-1.5 pl-2 lg:col-span-1 lg:pl-3">
          <span class="text-gray-300 dark:text-dark-600" aria-hidden="true">↳</span>
          <i class="h-1.5 w-1.5 shrink-0 rounded-full" :class="availabilityTone[availabilityState(child.health)].dot" :title="t(`channelMonitorV2.availability.states.${availabilityState(child.health)}`)" aria-hidden="true" />
          <span class="truncate text-xs text-gray-700 dark:text-gray-300" :title="childLabel(child)">{{ childLabel(child) }}</span>
          <span class="sr-only">{{ t(`channelMonitorV2.availability.states.${availabilityState(child.health)}`) }}</span>
        </div>
        <div><span class="mb-1 block text-[10px] text-gray-400 lg:sr-only">{{ t('channelMonitorV2.availability.columns.availability') }}</span><span class="text-xs font-medium tabular-nums" :class="childValueTone(availabilityState(child.health))">{{ formatAvailability(child.metrics, child.health) }}</span></div>
        <div><span class="mb-1 block text-[10px] text-gray-400 lg:sr-only">{{ t('channelMonitorV2.availability.avgTtft') }}</span><span class="text-xs tabular-nums text-gray-500 dark:text-dark-400">{{ formatMonitorMs(child.metrics.ttft.avg_ms) }}</span></div>
        <div class="col-span-3 min-w-0 lg:col-span-1"><AvailabilityTimeline v-if="coverage" :buckets="child.buckets" :coverage="coverage" dense /></div>
        <div class="col-start-3 row-start-2 text-right lg:col-auto lg:row-auto"><span class="mb-1 block text-[10px] text-gray-400 lg:sr-only">{{ t('channelMonitorV2.operations.healthScore') }}</span><span class="text-xs font-medium tabular-nums text-gray-500 dark:text-dark-400">{{ score(child) }}</span></div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MonitorCoverage, MonitorMatrixRow } from '@/api/channelMonitorV2'
import Icon from '@/components/icons/Icon.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import AvailabilityTimeline from './AvailabilityTimeline.vue'
import { formatMonitorMs } from './monitorFormat'
import { scoreTone } from './monitorOperations'
import {
  type AvailabilityEntry, availabilitySeverity, availabilityState, availabilityTone, childValueTone,
  formatAvailability, monitorChildKind, monitorChildLabel, monitorRowKey, monitorRowLabel,
} from './monitorAvailability'
import { platformLabel } from '@/utils/platformColors'

const props = defineProps<{ entry: AvailabilityEntry; coverage: MonitorCoverage | null; rangeLabel: string }>()
const { t, locale } = useI18n()
const expanded = ref(false)
const state = computed(() => availabilityState(props.entry.row.health))
const provider = computed(() => platformLabel(props.entry.row.platform))
const title = computed(() => monitorRowLabel(props.entry.row, t('channelMonitorV2.otherModels')))
const expandLabel = computed(() => t(`channelMonitorV2.service.${expanded.value ? 'collapse' : 'expand'}${monitorChildKind(props.entry.row) === 'groups' ? 'Groups' : 'Models'}`, { name: title.value, count: props.entry.children.length }))
const stateLabel = computed(() => state.value === 'unknown'
  ? t('channelMonitorV2.service.unknownReason')
  : t(`channelMonitorV2.availability.states.${state.value}`))
const sortedChildren = computed(() => [...props.entry.children].sort((a, b) =>
  availabilitySeverity[availabilityState(a.health)] - availabilitySeverity[availabilityState(b.health)] ||
  Number(a.model === '__other__') - Number(b.model === '__other__') ||
  childLabel(a).localeCompare(childLabel(b), locale.value)))
function childLabel(child: MonitorMatrixRow) {
  return monitorChildLabel(child, props.entry.row, t('channelMonitorV2.otherModels'))
}
function score(row: MonitorMatrixRow) {
  const value = row.health.score
  return availabilityState(row.health) === 'unknown' || value == null || !Number.isFinite(value) ? '—' : value.toFixed(1)
}
</script>
