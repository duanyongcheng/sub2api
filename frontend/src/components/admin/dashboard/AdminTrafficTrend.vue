<template>
  <section class="flex min-w-0 flex-col overflow-hidden rounded-card border border-edge bg-surface shadow-xs">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-4 py-2.5">
      <div class="min-w-0">
        <h3 class="text-[13.5px] font-semibold text-ink">{{ headerTitle }}</h3>
        <p class="mt-0.5 text-[11.5px] text-ink-2">{{ headerHint }}</p>
      </div>

      <div v-if="summary" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] tabular-nums text-ink-2">
        <span>{{ t('admin.dashboard.overview.trendPeak', { label: summary.peakLabel, value: summary.peakValue }) }}</span>
        <span aria-hidden="true" class="text-edge-strong">·</span>
        <span>{{ t('admin.dashboard.overview.trendAverage', { value: summary.avgValue }) }}</span>
        <span aria-hidden="true" class="text-edge-strong">·</span>
        <span class="font-semibold text-ink">{{ t('admin.dashboard.overview.trendTotal', { value: summary.totalValue }) }}</span>
      </div>
    </div>

    <div class="relative flex-1 px-4 pb-3 pt-3">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-ink-2">
        <div class="flex flex-wrap items-center gap-3.5">
          <span class="inline-flex items-center gap-1.5">
            <i class="h-2 w-2 rounded-sm bg-primary-500" aria-hidden="true" />
            {{ primarySeriesLabel }}
          </span>
          <span v-if="mode === 'revenue'" class="inline-flex items-center gap-1.5">
            <i class="h-2 w-2 rounded-sm bg-teal-300 dark:bg-teal-400/50" aria-hidden="true" />
            {{ t('admin.dashboard.overview.standardPrice') }}
          </span>
          <span v-else class="inline-flex items-center gap-1.5">
            <i class="h-[2px] w-3.5 rounded-sm bg-ink-3" aria-hidden="true" />
            {{ t('admin.dashboard.overview.trendAverage', { value: '' }).trim() }}
          </span>
        </div>
        <span class="text-[11px] text-ink-2">
          {{ granularity === 'hour' ? t('admin.dashboard.hour') : t('admin.dashboard.day') }}
        </span>
      </div>

      <div class="relative h-[228px]">
        <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-surface/60">
          <LoadingSpinner size="md" />
        </div>
        <Chart v-if="chartData" type="bar" :data="chartData" :options="chartOptions" />
        <div v-else class="flex h-full items-center justify-center text-body text-ink-2">
          {{ t('admin.dashboard.noDataAvailable') }}
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Tooltip
} from 'chart.js'
import { Chart } from 'vue-chartjs'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { useDarkMode } from '@/composables/useDarkMode'
import type { ChartData, ChartDataset } from 'chart.js'
import type { TrendDataPoint } from '@/types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Tooltip
)

export type AdminTrendMode = 'requests' | 'tokens' | 'revenue'

const props = withDefaults(
  defineProps<{
    trend: TrendDataPoint[]
    mode: AdminTrendMode
    granularity: 'day' | 'hour'
    loading?: boolean
  }>(),
  { loading: false }
)

const { t } = useI18n()
const isDark = useDarkMode()

const axisColor = computed(() => (isDark.value ? '#94a3b8' : '#64748b'))
const gridColor = computed(() => (isDark.value ? 'rgba(42,55,74,0.75)' : '#edf1f5'))

const headerTitle = computed(() => {
  if (props.mode === 'tokens') return t('admin.dashboard.tokenUsageTrend')
  if (props.mode === 'revenue') return t('admin.dashboard.overview.trendModeRevenue')
  return t('admin.dashboard.overview.trendTitleRequests')
})

const headerHint = computed(() => {
  if (props.mode === 'tokens') return t('admin.dashboard.overview.trendTokensHint')
  if (props.mode === 'revenue') return t('admin.dashboard.overview.trendRevenueHint')
  return t('admin.dashboard.overview.trendRequestsHint')
})

const primarySeriesLabel = computed(() => {
  if (props.mode === 'tokens') return t('admin.dashboard.tokens')
  if (props.mode === 'revenue') return t('admin.dashboard.overview.revenue')
  return t('admin.dashboard.requests')
})

const labels = computed(() =>
  props.trend.map((point) => {
    if (props.granularity === 'hour') {
      const match = /T(\d{2})/.exec(point.date)
      return match ? `${match[1]}:00` : point.date.slice(5, 13).replace('T', ' ')
    }
    return point.date.length > 10 ? point.date.slice(5, 10) : point.date.slice(5)
  })
)

function metricValue(point: TrendDataPoint): number {
  if (props.mode === 'tokens') return Number(point.total_tokens || 0)
  if (props.mode === 'revenue') return Number(point.actual_cost || 0)
  return Number(point.requests || 0)
}

function formatMetric(value: number): string {
  const n = Number(value || 0)
  if (props.mode === 'revenue') {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
    if (n >= 10_000) return `$${(n / 1000).toFixed(1)}k`
    if (n >= 1) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    return `$${n.toFixed(3)}`
  }
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return Math.round(n).toLocaleString()
}

const summary = computed(() => {
  if (!props.trend.length) return null
  let total = 0
  let peakIndex = 0
  let peakVal = -1
  props.trend.forEach((pt, idx) => {
    const val = metricValue(pt)
    total += val
    if (val > peakVal) {
      peakVal = val
      peakIndex = idx
    }
  })
  return {
    peakLabel: labels.value[peakIndex] || '',
    peakValue: formatMetric(peakVal),
    avgValue: formatMetric(total / props.trend.length),
    totalValue: formatMetric(total)
  }
})

const chartData = computed<ChartData | null>(() => {
  if (!props.trend.length) return null
  const primaryValues = props.trend.map(metricValue)

  if (props.mode === 'revenue') {
    const datasets: ChartDataset[] = [
      {
        type: 'bar',
        label: t('admin.dashboard.overview.revenue'),
        data: primaryValues,
        backgroundColor: '#14b8a6',
        hoverBackgroundColor: '#0d9488',
        borderRadius: 3,
        maxBarThickness: 22,
        order: 2
      },
      {
        type: 'bar',
        label: t('admin.dashboard.overview.standardPrice'),
        data: props.trend.map((p) => Number(p.cost || 0)),
        backgroundColor: isDark.value ? 'rgba(94,234,212,0.42)' : '#99f6e4',
        hoverBackgroundColor: '#5eead4',
        borderRadius: 3,
        maxBarThickness: 14,
        order: 1
      }
    ]
    return { labels: labels.value, datasets }
  }

  const avg = primaryValues.reduce((s, v) => s + v, 0) / (primaryValues.length || 1)
  const datasets: ChartDataset[] = [
    {
      type: 'bar',
      label: primarySeriesLabel.value,
      data: primaryValues,
      backgroundColor: isDark.value ? 'rgba(20,184,166,0.72)' : '#14b8a6',
      hoverBackgroundColor: '#0d9488',
      borderRadius: 3,
      maxBarThickness: 26,
      order: 2
    },
    {
      type: 'line',
      label: t('admin.dashboard.overview.trendAverage', { value: '' }).trim(),
      data: primaryValues.map(() => avg),
      borderColor: isDark.value ? '#94a3b8' : '#64748b',
      borderWidth: 1.5,
      borderDash: [5, 4],
      pointRadius: 0,
      fill: false,
      order: 1
    }
  ]

  return { labels: labels.value, datasets }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false as const,
  interaction: { intersect: false, mode: 'index' as const },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: isDark.value ? '#111a28' : '#0f172a',
      titleColor: '#e8eef6',
      bodyColor: '#cbd5e1',
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
          `${ctx.dataset.label ?? ''}: ${formatMetric(Number(ctx.raw || 0))}`
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      border: { color: gridColor.value },
      ticks: { color: axisColor.value, font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
    },
    y: {
      beginAtZero: true,
      grid: { color: gridColor.value, drawTicks: false },
      border: { display: false },
      ticks: {
        color: axisColor.value,
        font: { size: 11 },
        maxTicksLimit: 5,
        callback: (value: string | number) => formatMetric(Number(value))
      }
    }
  }
}))
</script>
