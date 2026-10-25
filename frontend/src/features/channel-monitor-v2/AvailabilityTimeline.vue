<template>
  <div>
    <div class="availability-strip grid gap-0.5" :style="{ gridTemplateColumns: `repeat(${Math.max(1, slots.length)}, minmax(0, 1fr))` }">
      <button
        v-for="slot in slots"
        :key="slot.start"
        type="button"
        class="h-8 min-w-0 rounded-sm transition hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        :class="colors[slot.state]"
        :aria-label="tooltip(slot)"
        :title="tooltip(slot)"
        @mouseenter="active = slot.start"
        @mouseleave="active = null"
        @focus="active = slot.start"
        @blur="active = null"
        @keydown.esc="active = null"
        @click="active = active === slot.start ? null : slot.start"
      />
    </div>
    <div class="mt-2 flex justify-between text-[10px] tabular-nums text-gray-400 dark:text-dark-400">
      <span>{{ formatTime(coverage.requested_start) }}</span>
      <span>{{ formatTime(coverage.requested_end || coverage.data_through) }}</span>
    </div>
    <p v-if="activeSlot" role="tooltip" class="mt-2 rounded-lg bg-gray-50 p-2 text-xs leading-relaxed text-gray-600 dark:bg-dark-900 dark:text-gray-300">{{ tooltip(activeSlot) }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HealthState, MonitorCoverage, MonitorMatrixBucket } from '@/api/channelMonitorV2'
import { availabilityState, formatAvailability, monitorBucketStarts } from './monitorAvailability'
import { formatMonitorMs } from './monitorFormat'

const props = defineProps<{ buckets: MonitorMatrixBucket[]; coverage: MonitorCoverage }>()
const { t, locale } = useI18n()
const active = ref<string | null>(null)
const colors: Record<HealthState, string> = {
  healthy: 'bg-emerald-500 dark:bg-emerald-400',
  warning: 'bg-amber-400 dark:bg-amber-500',
  critical: 'bg-rose-500 dark:bg-rose-400',
  unknown: 'bg-gray-200 dark:bg-dark-600',
}
const slots = computed(() => {
  const byTime = new Map(props.buckets.map(bucket => [Date.parse(bucket.bucket_start), bucket]))
  return monitorBucketStarts(props.coverage).map(start => {
    const bucket = byTime.get(Date.parse(start))
    return { start, bucket, state: availabilityState(bucket?.health) }
  })
})
const activeSlot = computed(() => slots.value.find(slot => slot.start === active.value))
function formatTime(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return date.toLocaleString(locale.value, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function tooltip(slot: (typeof slots.value)[number]) {
  const end = new Date(Date.parse(slot.start) + props.coverage.bucket_seconds * 1000).toISOString()
  const parts = [`${formatTime(slot.start)} – ${formatTime(end)}`, t(`channelMonitorV2.availability.states.${slot.state}`)]
  if (slot.bucket && slot.state !== 'unknown') {
    parts.push(formatAvailability(slot.bucket.metrics, slot.bucket.health))
    parts.push(`${t('channelMonitorV2.availability.avgTtft')} ${formatMonitorMs(slot.bucket.metrics.ttft.avg_ms)}`)
  }
  return parts.join(' · ')
}
</script>
