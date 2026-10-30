<template>
  <div
    v-if="compact"
    class="flex h-1.5 gap-px"
    role="img"
    :aria-label="t('channelMonitorV2.availability.coverage', { count: dataSlots, total: slots.length })"
  >
    <span
      v-for="slot in slots"
      :key="slot.start"
      class="min-w-0 flex-1 rounded-[1px]"
      :class="availabilityTone[slot.state].bar"
      :title="tooltip(slot)"
    />
  </div>
  <div v-else class="relative">
    <div
      ref="strip"
      class="availability-strip flex gap-[3px]"
      :class="dense ? 'h-6' : 'h-8'"
      role="group"
      :aria-label="t('channelMonitorV2.availability.coverage', { count: dataSlots, total: slots.length })"
      @mouseleave="active = null"
    >
      <button
        v-for="(slot, index) in slots"
        :key="slot.start"
        type="button"
        class="min-w-0 flex-1 rounded-[3px] transition-opacity duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        :class="[availabilityTone[slot.state].bar, active != null && active !== index ? 'opacity-50' : '']"
        :tabindex="index === focusIndex ? 0 : -1"
        :aria-label="tooltip(slot)"
        @mouseenter="active = index"
        @focus="active = index; focusIndex = index"
        @blur="active = null"
        @keydown="onKeydown($event, index)"
        @click="active = active === index ? null : index"
      />
    </div>
    <div
      v-if="activeSlot"
      role="tooltip"
      class="pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-[16rem] rounded-lg bg-gray-900 px-3 py-2 text-xs text-gray-100 shadow-lg ring-1 ring-black/5 dark:bg-dark-700"
      :style="tooltipStyle"
    >
      <p class="font-medium tabular-nums text-white">{{ slotRange(activeSlot) }}</p>
      <p class="mt-1 flex items-center gap-1.5">
        <i class="h-1.5 w-1.5 rounded-full" :class="availabilityTone[activeSlot.state].dot" />
        {{ t(`channelMonitorV2.availability.states.${activeSlot.state}`) }}
        <strong v-if="activeSlot.bucket && activeSlot.state !== 'unknown'" class="ml-3 font-semibold tabular-nums text-white">
          {{ formatAvailability(activeSlot.bucket.metrics, activeSlot.bucket.health) }}
        </strong>
      </p>
      <p v-if="activeSlot.bucket && activeSlot.state !== 'unknown'" class="mt-0.5 text-gray-400 dark:text-dark-300">
        {{ t('channelMonitorV2.availability.avgTtft') }} {{ formatMonitorMs(activeSlot.bucket.metrics.ttft.avg_ms) }}
      </p>
    </div>
    <div v-if="!dense" class="mt-1.5 flex justify-between text-[10px] tabular-nums text-gray-400 dark:text-dark-400">
      <span>{{ formatTime(coverage.requested_start) }}</span>
      <span>{{ formatTime(coverage.requested_end || coverage.data_through) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MonitorCoverage, MonitorMatrixBucket } from '@/api/channelMonitorV2'
import { availabilityState, availabilityTone, formatAvailability, monitorBucketStarts } from './monitorAvailability'
import { formatMonitorMs } from './monitorFormat'

/** compact: thin, non-interactive strip for child rows. dense: list rows, no time axis. */
const props = defineProps<{ buckets: MonitorMatrixBucket[]; coverage: MonitorCoverage; compact?: boolean; dense?: boolean }>()
const { t, locale } = useI18n()
const strip = ref<HTMLElement | null>(null)
const active = ref<number | null>(null)
/** Roving tabindex: the strip is a single tab stop; arrows move between buckets. */
const focusIndex = ref(0)
const slots = computed(() => {
  const byTime = new Map(props.buckets.map(bucket => [Date.parse(bucket.bucket_start), bucket]))
  return monitorBucketStarts(props.coverage).map(start => {
    const bucket = byTime.get(Date.parse(start))
    return { start, bucket, state: availabilityState(bucket?.health) }
  })
})
type Slot = (typeof slots.value)[number]
const dataSlots = computed(() => slots.value.filter(slot => slot.state !== 'unknown').length)
const activeSlot = computed(() => (active.value == null ? undefined : slots.value[active.value]))
const tooltipStyle = computed(() => {
  const total = slots.value.length
  const index = active.value ?? 0
  // Keep edge tooltips inside the strip instead of centering them past the card edge.
  if (index < total * 0.25) return { left: `${(index / total) * 100}%` }
  if (index >= total * 0.75) return { right: `${((total - index - 1) / total) * 100}%` }
  return { left: `${((index + 0.5) / total) * 100}%`, transform: 'translateX(-50%)' }
})

function onKeydown(event: KeyboardEvent, index: number) {
  if (event.key === 'Escape') {
    active.value = null
    return
  }
  const last = slots.value.length - 1
  const moves: Record<string, number> = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: last }
  const next = moves[event.key]
  if (next == null) return
  event.preventDefault()
  focusIndex.value = Math.max(0, Math.min(last, next))
  ;(strip.value?.children[focusIndex.value] as HTMLElement | undefined)?.focus()
}
function formatTime(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return date.toLocaleString(locale.value, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function slotRange(slot: Slot) {
  const start = new Date(slot.start)
  const end = new Date(start.getTime() + props.coverage.bucket_seconds * 1000)
  const sameDay = start.toDateString() === end.toDateString()
  const endText = sameDay
    ? end.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
    : formatTime(end.toISOString())
  return `${formatTime(slot.start)} – ${endText}`
}
function tooltip(slot: Slot) {
  const parts = [slotRange(slot), t(`channelMonitorV2.availability.states.${slot.state}`)]
  if (slot.bucket && slot.state !== 'unknown') {
    parts.push(formatAvailability(slot.bucket.metrics, slot.bucket.health))
    parts.push(`${t('channelMonitorV2.availability.avgTtft')} ${formatMonitorMs(slot.bucket.metrics.ttft.avg_ms)}`)
  }
  return parts.join(' · ')
}
</script>
