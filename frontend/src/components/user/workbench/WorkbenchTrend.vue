<template>
  <section class="card">
    <div class="card-hd flex-wrap gap-2">
      <div class="flex min-w-0 items-center gap-2.5">
        <h3 class="text-sm font-semibold text-ink">{{ t('dashboard.workbench.trendTitle') }}</h3>
        <span class="pill pill-neutral">{{ windowLabel }}</span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <!-- metric -->
        <div class="seg" role="group" :aria-label="t('dashboard.workbench.trendTitle')">
          <button
            v-for="option in metricOptions"
            :key="option.value"
            type="button"
            :class="{ on: metric === option.value }"
            :aria-pressed="metric === option.value"
            @click="emit('update:metric', option.value)"
          >
            {{ option.label }}
          </button>
        </div>
        <!-- granularity -->
        <div class="seg" role="group" :aria-label="t('dashboard.granularity')">
          <button
            v-for="option in granularityOptions"
            :key="option.value"
            type="button"
            :class="{ on: granularity === option.value }"
            :aria-pressed="granularity === option.value"
            @click="emit('update:granularity', option.value)"
          >
            {{ option.label }}
          </button>
        </div>
        <div class="flex items-center gap-1.5">
          <DateRangePicker
            v-model:start-date="range.start"
            v-model:end-date="range.end"
            @change="onRangeChange"
          />
          <button
            type="button"
            class="btn btn-secondary btn-icon btn-sm"
            :disabled="loading"
            :title="t('common.refresh')"
            @click="emit('refresh')"
          >
            <Icon name="refresh" size="sm" :class="loading ? 'animate-spin' : ''" />
          </button>
        </div>
      </div>
    </div>

    <div class="card-bd">
      <div class="mb-2 flex items-center justify-between">
        <div class="flex items-center gap-4 text-meta text-ink-2">
          <span class="inline-flex items-center gap-1.5">
            <i class="h-2 w-2 rounded-sm bg-primary-500" />{{ metricLabel }}
          </span>
          <span v-if="metric === 'cost'" class="inline-flex items-center gap-1.5">
            <i class="h-2 w-2 rounded-sm bg-teal-200" />{{ t('dashboard.standard') }}
          </span>
          <span class="inline-flex items-center gap-1.5">
            <i class="h-[2px] w-3.5 rounded-sm bg-ink-3" />{{ t('dashboard.workbench.dailyAverage') }}
          </span>
        </div>
        <span class="hidden text-meta text-ink-3 sm:inline">{{ unitLabel }}</span>
      </div>

      <div class="relative h-[240px]">
        <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-surface/60">
          <LoadingSpinner size="md" />
        </div>
        <Bar v-if="chartData" :data="chartData" :options="chartOptions" />
        <div v-else class="flex h-full items-center justify-center text-body text-ink-3">
          {{ t('dashboard.workbench.trendEmpty') }}
        </div>
      </div>

      <div class="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div class="rounded-lg border border-edge bg-surface-2 px-3 py-2">
          <div class="text-[11px] font-semibold text-ink-3">{{ t('dashboard.workbench.peakDay') }}</div>
          <div class="mt-0.5 text-sm font-bold tabular-nums text-ink">{{ summary.peak }}</div>
        </div>
        <div class="rounded-lg border border-edge bg-surface-2 px-3 py-2">
          <div class="text-[11px] font-semibold text-ink-3">{{ t('dashboard.workbench.dailyAverage') }}</div>
          <div class="mt-0.5 text-sm font-bold tabular-nums text-ink">{{ summary.average }}</div>
        </div>
        <div class="rounded-lg border border-edge bg-surface-2 px-3 py-2">
          <div class="text-[11px] font-semibold text-ink-3">{{ t('dashboard.workbench.totalRequests') }}</div>
          <div class="mt-0.5 text-sm font-bold tabular-nums text-ink">{{ summary.total }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Tooltip,
  Filler
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import Icon from '@/components/icons/Icon.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import type { ChartDataset } from 'chart.js'
import type { TrendDataPoint } from '@/types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Tooltip,
  Filler
)

export type WorkbenchMetric = 'requests' | 'tokens' | 'cost'
export type WorkbenchGranularity = 'day' | 'hour'

/**
 * WorkbenchTrend — usage chart with a metric switch (requests / tokens / cost).
 *
 * Bars carry the metric itself; a dashed line shows the period average so the
 * "am I above or below normal" question is answerable without reading numbers.
 */
const props = withDefaults(
  defineProps<{
    trend: TrendDataPoint[]
    loading?: boolean
    metric: WorkbenchMetric
    granularity: WorkbenchGranularity
    startDate: string
    endDate: string
    windowLabel?: string
  }>(),
  {
    loading: false,
    windowLabel: ''
  }
)

const emit = defineEmits<{
  (e: 'update:metric', value: WorkbenchMetric): void
  (e: 'update:granularity', value: WorkbenchGranularity): void
  (e: 'update:startDate', value: string): void
  (e: 'update:endDate', value: string): void
  (e: 'rangeChange', payload: { startDate: string; endDate: string; preset: string | null }): void
  (e: 'refresh'): void
}>()

const { t } = useI18n()

// DateRangePicker is a controlled component; keep a local mirror so it can
// v-model and report the change upward with the preset that was picked.
const range = reactive({ start: props.startDate, end: props.endDate })

watch(
  () => [props.startDate, props.endDate] as const,
  ([start, end]) => {
    range.start = start
    range.end = end
  }
)

function onRangeChange(payload: { startDate: string; endDate: string; preset: string | null }) {
  emit('update:startDate', payload.startDate)
  emit('update:endDate', payload.endDate)
  emit('rangeChange', payload)
}

const metricOptions = computed(() => [
  { value: 'requests' as const, label: t('dashboard.workbench.trendRequests') },
  { value: 'tokens' as const, label: t('dashboard.workbench.trendTokens') },
  { value: 'cost' as const, label: t('dashboard.workbench.trendCost') }
])

const granularityOptions = computed(() => [
  { value: 'day' as const, label: t('dashboard.day') },
  { value: 'hour' as const, label: t('dashboard.hour') }
])

const metricLabel = computed(() => metricOptions.value.find((o) => o.value === props.metric)?.label ?? '')

const unitLabel = computed(() => {
  if (props.metric === 'cost') return 'USD'
  if (props.metric === 'tokens') return 'tokens'
  return t('dashboard.workbench.requestsUnit')
})

const isDark = computed(() => document.documentElement.classList.contains('dark'))
const axisColor = computed(() => (isDark.value ? '#6b7b90' : '#8a97a8'))
const gridColor = computed(() => (isDark.value ? 'rgba(29,40,56,0.9)' : '#edf1f5'))

function valueOf(point: TrendDataPoint): number {
  if (props.metric === 'requests') return Number(point.requests || 0)
  if (props.metric === 'tokens') return Number(point.total_tokens || 0)
  return Number(point.actual_cost || 0)
}

function standardValueOf(point: TrendDataPoint): number {
  return Number(point.cost || 0)
}

const labels = computed(() =>
  props.trend.map((point) => {
    if (props.granularity === 'hour') {
      // "2026-11-08T14:00:00" -> "14:00"
      const match = /T(\d{2})/.exec(point.date)
      return match ? `${match[1]}:00` : point.date
    }
    return point.date
  })
)

const chartData = computed(() => {
  if (!props.trend.length) return null
  const values = props.trend.map(valueOf)
  const average = values.reduce((sum, v) => sum + v, 0) / (values.length || 1)

  // Mixed cartesian chart: bar for the metric, dashed line for the average and
  // (for cost) a second line for the standard price. `ChartJS` resolves the
  // per-dataset `type` overrides at runtime, which is why the arrays below are
  // typed loosely before the data object is assembled.
  const datasets: ChartDataset<'bar'>[] = [
    {
      type: 'bar',
      label: metricLabel.value,
      data: values,
      backgroundColor: isDark.value ? 'rgba(20,184,166,0.55)' : '#14b8a6',
      hoverBackgroundColor: '#0d9488',
      borderRadius: 3,
      maxBarThickness: 26,
      order: 2
    } as ChartDataset<'bar'>,
    {
      type: 'line',
      label: t('dashboard.workbench.dailyAverage'),
      data: values.map(() => average),
      borderColor: isDark.value ? '#6b7b90' : '#94a3b8',
      borderWidth: 1.5,
      borderDash: [5, 4],
      pointRadius: 0,
      fill: false,
      order: 1
    } as unknown as ChartDataset<'bar'>
  ]

  if (props.metric === 'cost') {
    datasets.push({
      type: 'line',
      label: t('dashboard.standard'),
      data: props.trend.map(standardValueOf),
      borderColor: isDark.value ? '#5eead4' : '#99f6e4',
      backgroundColor: isDark.value ? 'rgba(94,234,212,0.08)' : 'rgba(153,246,228,0.25)',
      borderWidth: 1.6,
      pointRadius: 0,
      fill: true,
      tension: 0.3,
      order: 0
    } as unknown as ChartDataset<'bar'>)
  }

  return { labels: labels.value, datasets }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' as const },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: isDark.value ? '#111a28' : '#0f172a',
      titleColor: '#e8eef6',
      bodyColor: '#cbd5e1',
      padding: 10,
      cornerRadius: 8,
      displayColors: true,
      callbacks: {
        label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
          `${ctx.dataset.label ?? ''}: ${formatValue(Number(ctx.raw || 0))}`
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      border: { color: gridColor.value },
      ticks: {
        color: axisColor.value,
        font: { size: 10.5 },
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 12
      }
    },
    y: {
      beginAtZero: true,
      grid: { color: gridColor.value, drawTicks: false, borderDash: [3, 4] },
      border: { display: false },
      ticks: {
        color: axisColor.value,
        font: { size: 10.5 },
        maxTicksLimit: 5,
        callback: (value: string | number) => formatValue(Number(value))
      }
    }
  }
}))

function formatValue(value: number): string {
  if (props.metric === 'cost') return `$${value.toFixed(2)}`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(Math.round(value))
}

const summary = computed(() => {
  const points = props.trend
  if (points.length === 0) {
    return {
      peak: t('dashboard.workbench.noData'),
      average: t('dashboard.workbench.noData'),
      total: t('dashboard.workbench.noData')
    }
  }
  let peakPoint = points[0]
  let total = 0
  for (const point of points) {
    const value = valueOf(point)
    total += value
    if (value > valueOf(peakPoint)) peakPoint = point
  }
  const average = total / points.length
  return {
    peak: `${peakPoint.date.slice(5).replace('T', ' ')} · ${formatValue(valueOf(peakPoint))}`,
    average: formatValue(average),
    total: props.metric === 'requests' ? Number(total).toLocaleString() : formatValue(total)
  }
})
</script>
