<template>
  <BaseDialog
    :show="show && entry != null"
    :title="entry ? t('channelMonitorV2.availability.detailsTitle', { name: monitorRowLabel(entry.row, t('channelMonitorV2.otherModels')) }) : ''"
    width="extra-wide"
    :close-on-click-outside="true"
    @close="emit('close')"
  >
    <template v-if="entry">
      <section class="mb-5 space-y-3" data-testid="group-summary" :aria-label="t('channelMonitorV2.availability.overallMetrics')">
        <div class="flex items-center justify-between gap-3">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('channelMonitorV2.availability.overallMetrics') }}</h4>
          <AvailabilityStatus :state="availabilityState(entry.row.health)" />
        </div>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div class="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-dark-800">
            <span class="block text-[11px] text-gray-400">{{ t('channelMonitorV2.availability.columns.availability') }}</span>
            <strong class="mt-1 block text-base tabular-nums" :class="availabilityTone[availabilityState(entry.row.health)].value">{{ formatAvailability(entry.row.metrics, entry.row.health) }}</strong>
          </div>
          <div class="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-dark-800">
            <span class="block text-[11px] text-gray-400">{{ t('channelMonitorV2.metrics.cacheRate') }}</span>
            <strong class="mt-1 block text-base tabular-nums text-gray-900 dark:text-white">{{ formatMonitorPercent(entry.row.metrics.cache_rate) }}</strong>
          </div>
          <div class="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-dark-800">
            <span class="block text-[11px] text-gray-400">{{ t('channelMonitorV2.availability.avgTtft') }}</span>
            <strong class="mt-1 block text-base tabular-nums text-gray-900 dark:text-white">{{ formatMonitorMs(entry.row.metrics.ttft.avg_ms) }}</strong>
          </div>
          <div class="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-dark-800">
            <span class="block text-[11px] text-gray-400">{{ t('channelMonitorV2.availability.itemCount') }}</span>
            <strong class="mt-1 block text-base tabular-nums text-gray-900 dark:text-white">{{ entry.children.length }}</strong>
          </div>
        </div>

        <div class="rounded-lg border border-gray-200 px-3 py-3 dark:border-dark-700">
          <div class="mb-2 flex items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-dark-400">
            <span>{{ t('channelMonitorV2.availability.history', { range: rangeLabel }) }}</span>
            <span class="tabular-nums">{{ t('channelMonitorV2.availability.coverage', { count: entry.dataBuckets, total: totalBuckets }) }}</span>
          </div>
          <AvailabilityTimeline compact :buckets="entry.row.buckets" :coverage="coverage" />
        </div>
      </section>

      <div v-if="entry.children.length" class="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-dark-700 dark:border-dark-700">
        <div class="hidden grid-cols-[minmax(10rem,1.4fr)_5.5rem_5.5rem_5.5rem_minmax(8rem,1fr)] items-center gap-3 bg-gray-50 px-4 py-2 text-[11px] font-medium text-gray-500 dark:bg-dark-800 dark:text-dark-300 md:grid">
          <span>{{ t('channelMonitorV2.availability.breakdown') }}</span>
          <span>{{ t('channelMonitorV2.availability.columns.availability') }}</span>
          <span>{{ t('channelMonitorV2.metrics.cacheRate') }}</span>
          <span>{{ t('channelMonitorV2.availability.avgTtft') }}</span>
          <span>{{ t('channelMonitorV2.availability.history', { range: rangeLabel }) }}</span>
        </div>
        <div
          v-for="child in entry.children"
          :key="monitorRowKey(child)"
          class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[minmax(10rem,1.4fr)_5.5rem_5.5rem_5.5rem_minmax(8rem,1fr)]"
        >
          <div class="flex min-w-0 items-center gap-2">
            <i class="h-2 w-2 shrink-0 rounded-full" :class="availabilityTone[availabilityState(child.health)].dot" />
            <span class="truncate text-sm font-medium text-gray-800 dark:text-gray-100" :title="monitorChildLabel(child, entry.row, t('channelMonitorV2.otherModels'))">
              {{ monitorChildLabel(child, entry.row, t('channelMonitorV2.otherModels')) }}
            </span>
          </div>
          <span class="text-right text-sm font-semibold tabular-nums" :class="availabilityTone[availabilityState(child.health)].value">{{ formatAvailability(child.metrics, child.health) }}</span>
          <span class="hidden text-sm tabular-nums text-gray-700 dark:text-gray-200 md:block">{{ formatMonitorPercent(child.metrics.cache_rate) }}</span>
          <span class="hidden text-sm tabular-nums text-gray-700 dark:text-gray-200 md:block">{{ formatMonitorMs(child.metrics.ttft.avg_ms) }}</span>
          <AvailabilityTimeline compact class="col-span-2 md:col-span-1" :buckets="child.buckets" :coverage="coverage" />
          <span class="col-span-2 text-[11px] text-gray-400 md:hidden">
            {{ t('channelMonitorV2.metrics.cacheRate') }} {{ formatMonitorPercent(child.metrics.cache_rate) }}
            <span class="mx-1">·</span>
            {{ t('channelMonitorV2.availability.avgTtft') }} {{ formatMonitorMs(child.metrics.ttft.avg_ms) }}
          </span>
        </div>
      </div>
      <div v-else class="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400 dark:border-dark-700">
        {{ t('channelMonitorV2.availability.detailsEmpty') }}
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MonitorCoverage } from '@/api/channelMonitorV2'
import BaseDialog from '@/components/common/BaseDialog.vue'
import AvailabilityStatus from './AvailabilityStatus.vue'
import AvailabilityTimeline from './AvailabilityTimeline.vue'
import { formatMonitorMs, formatMonitorPercent } from './monitorFormat'
import {
  type AvailabilityEntry, availabilityState, availabilityTone, formatAvailability,
  monitorChildLabel, monitorRowKey, monitorRowLabel,
} from './monitorAvailability'

withDefaults(defineProps<{
  show: boolean
  entry: AvailabilityEntry | null
  coverage: MonitorCoverage
  rangeLabel: string
  totalBuckets: number
}>(), { entry: null })
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
</script>
