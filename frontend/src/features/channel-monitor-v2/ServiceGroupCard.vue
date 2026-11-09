<template>
  <article
    class="card flex min-w-0 flex-col gap-4 !rounded-xl px-4 py-4 transition-shadow hover:shadow-md sm:px-5"
    :class="availabilityTone[state].ring"
    :data-platform="entry.row.platform"
    :data-state="state"
    :data-group-id="entry.row.group_id ?? undefined"
  >
    <div class="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-3">
      <!-- 身份：平台色块 + 名称 + 证据来源 + 结论 -->
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-2.5">
          <span
            class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
            :style="{ backgroundColor: platformAccentColor(entry.row.platform) }"
            aria-hidden="true"
          >{{ platformInitial }}</span>
          <h3 class="truncate text-sm font-semibold text-ink" :title="title">{{ title }}</h3>
        </div>
        <p class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-3">
          <!-- 设计主线 §2.1：真实流量＝主色，是每一张卡首要的识别锚点 -->
          <span class="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 font-semibold text-primary-700" data-evidence="traffic">
            <Icon name="chart" size="xs" />{{ t('channelMonitorV2.service.evidenceTraffic') }}
          </span>
          <span v-if="updatedAgo">{{ updatedAgo }}</span>
          <span class="text-ink-3/70" aria-hidden="true">·</span>
          <span>{{ platformLabel(entry.row.platform) }}</span>
        </p>
        <div class="mt-2.5 flex flex-wrap items-center gap-2">
          <AvailabilityStatus :state="state" />
          <span v-if="state === 'unknown'" class="text-[11px] text-ink-3">{{ unknownReason }}</span>
        </div>
      </div>

      <!-- 指标：可用率 + 平均首字延迟，口径写在标签里 -->
      <!-- 窄屏：两个指标并排占满整行，不跟分组名抢宽度 -->
      <dl class="grid w-full grid-cols-2 gap-4 text-right sm:flex sm:w-auto sm:shrink-0 sm:gap-8">
        <div>
          <dt class="text-[10px] text-ink-3">{{ t('channelMonitorV2.service.windowAvailability', { range: rangeLabel }) }}</dt>
          <dd class="mt-0.5 text-lg font-semibold tabular-nums" :class="availabilityTone[state].value">
            {{ availabilityText }}
          </dd>
        </div>
        <div>
          <dt class="text-[10px] text-ink-3">{{ t('channelMonitorV2.availability.avgTtft') }}</dt>
          <dd class="mt-0.5 text-lg font-semibold tabular-nums text-ink">
            {{ formatMonitorMs(entry.row.metrics.ttft.avg_ms) }}
          </dd>
        </div>
      </dl>
    </div>

    <!-- 时间轴：连续色条本身就是「真实流量」的第二种提示 -->
    <div class="min-w-0">
      <AvailabilityTimeline v-if="coverage" :buckets="entry.row.buckets" :coverage="coverage" dense />
      <div v-else class="h-6 rounded-md bg-surface-3" aria-hidden="true" />
      <div class="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-ink-3">
        <span>{{ rangeLabel }} · {{ t('channelMonitorV2.availability.coverage', { count: entry.dataBuckets, total: totalBuckets }) }}</span>
        <span>{{ t('channelMonitorV2.service.timelineLegend') }}</span>
      </div>
    </div>

    <!-- 展开的模型明细 -->
    <div v-if="entry.children.length" class="min-w-0 border-t border-edge pt-2.5">
      <p class="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">
        {{ t('channelMonitorV2.availability.children.models', { count: entry.children.length }) }}
      </p>
      <ul class="mt-1.5 space-y-1">
        <li
          v-for="child in sortedChildren"
          :key="monitorRowKey(child)"
          class="flex items-center gap-2 text-xs"
        >
          <i class="h-1.5 w-1.5 shrink-0 rounded-full" :class="availabilityTone[availabilityState(child.health)].dot" />
          <span class="min-w-0 flex-1 truncate text-ink-2" :title="childLabel(child)">{{ childLabel(child) }}</span>
          <span class="shrink-0 tabular-nums" :class="availabilityTone[availabilityState(child.health)].value">
            {{ formatAvailability(child.metrics, child.health) }}
          </span>
          <span class="w-14 shrink-0 text-right tabular-nums text-ink-3">{{ formatMonitorMs(child.metrics.ttft.avg_ms) }}</span>
        </li>
      </ul>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MonitorCoverage, MonitorMatrixRow } from '@/api/channelMonitorV2'
import Icon from '@/components/icons/Icon.vue'
import AvailabilityStatus from './AvailabilityStatus.vue'
import AvailabilityTimeline from './AvailabilityTimeline.vue'
import { formatMonitorMs } from './monitorFormat'
import {
  type AvailabilityEntry,
  availabilitySeverity,
  availabilityState,
  availabilityTone,
  availabilityValue,
  formatAvailability,
  monitorChildLabel,
  monitorRowKey,
  monitorRowLabel,
} from './monitorAvailability'
import { platformAccentColor, platformLabel } from '@/utils/platformColors'

const props = defineProps<{
  entry: AvailabilityEntry
  coverage: MonitorCoverage | null
  rangeLabel: string
}>()
const { t } = useI18n()

const state = computed(() => availabilityState(props.entry.row.health))
const title = computed(() => monitorRowLabel(props.entry.row, t('channelMonitorV2.otherModels')))
const availabilityText = computed(() => formatAvailability(props.entry.row.metrics, props.entry.row.health))
const platformInitial = computed(() => platformLabel(props.entry.row.platform).slice(0, 1).toUpperCase())
const totalBuckets = computed(() => props.entry.row.buckets.length)
const updatedAgo = computed(() => {
  const through = props.coverage?.data_through
  if (!through) return ''
  const minutes = Math.round((Date.now() - Date.parse(through)) / 60000)
  if (!Number.isFinite(minutes) || minutes < 0) return ''
  return minutes < 1
    ? t('channelMonitorV2.service.justNow')
    : t('channelMonitorV2.service.minutesAgo', { count: minutes })
})
/** Sample-shortfall must say why; never render a placeholder number as if it were 100%. */
const unknownReason = computed(() =>
  props.entry.row.metrics.request_count <= 0
    ? t('channelMonitorV2.service.noTraffic')
    : t('channelMonitorV2.service.belowSample', { minimum: props.entry.row.health.minimum_sample })
)
const sortedChildren = computed(() =>
  [...props.entry.children].sort((a, b) => {
    const severity = availabilitySeverity[availabilityState(a.health)] - availabilitySeverity[availabilityState(b.health)]
    if (severity !== 0) return severity
    return (availabilityValue(b.metrics, b.health) ?? -1) - (availabilityValue(a.metrics, a.health) ?? -1)
  })
)
function childLabel(child: MonitorMatrixRow) {
  return monitorChildLabel(child, props.entry.row, t('channelMonitorV2.otherModels'))
}
</script>
