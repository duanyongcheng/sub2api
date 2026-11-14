<template>
  <section class="card">
    <div class="card-hd flex-wrap">
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-ink">{{ t('admin.dashboard.overview.revenueVsCost') }}</h3>
        <p class="mt-0.5 text-meta text-ink-3">{{ t('admin.dashboard.overview.revenueVsCostHint') }}</p>
      </div>
      <div class="flex items-center gap-3.5 text-meta text-ink-2">
        <span class="inline-flex items-center gap-1.5"><i class="h-2 w-2 rounded-sm bg-primary-500" />{{ t('admin.dashboard.overview.revenue') }}</span>
        <span class="inline-flex items-center gap-1.5"><i class="h-2 w-2 rounded-sm bg-teal-200" />{{ t('admin.dashboard.overview.standardPrice') }}</span>
        <span class="inline-flex items-center gap-1.5"><i class="h-2 w-2 rounded-sm bg-amber-500" />{{ t('admin.dashboard.overview.cost') }}</span>
      </div>
    </div>

    <div class="relative px-[18px] pt-4 pb-1">
      <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-surface/60">
        <LoadingSpinner size="md" />
      </div>
      <div class="h-[250px]">
        <Chart v-if="chartData" type="bar" :data="chartData" :options="chartOptions" />
        <div v-else class="flex h-full items-center justify-center text-body text-ink-3">
          {{ t('admin.dashboard.noDataAvailable') }}
        </div>
      </div>
    </div>

    <!-- Margin table under the chart: pricing decisions are made here -->
    <div class="mx-[18px] mb-[18px] overflow-x-auto rounded-xl border border-edge bg-surface-2">
      <table class="w-full text-data">
        <thead>
          <tr class="border-b border-edge text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3">
            <th class="px-3.5 py-2.5 text-left font-semibold">{{ t('admin.dashboard.overview.group') }}</th>
            <th class="px-3.5 py-2.5 text-right font-semibold">{{ t('admin.dashboard.overview.revenue') }}</th>
            <th class="px-3.5 py-2.5 text-right font-semibold">{{ t('admin.dashboard.overview.upstreamCost') }}</th>
            <th class="px-3.5 py-2.5 text-right font-semibold">{{ t('admin.dashboard.overview.grossMargin') }}</th>
            <th class="px-3.5 py-2.5 text-right font-semibold">{{ t('admin.dashboard.requests') }}</th>
            <th class="px-3.5 py-2.5 text-right font-semibold">{{ t('admin.dashboard.overview.marginRisk') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="groupRows.length === 0">
            <td colspan="6" class="px-3.5 py-6 text-center text-body text-ink-3">
              {{ t('admin.dashboard.noDataAvailable') }}
            </td>
          </tr>
          <tr v-for="row in groupRows" :key="row.id" class="border-b border-edge last:border-b-0 hover:bg-surface">
            <td class="px-3.5 py-2.5">
              <div class="flex items-center gap-2">
                <span class="h-4 w-1 rounded-full" :style="{ background: row.color }" />
                <span class="max-w-[200px] truncate font-semibold text-ink">{{ row.name }}</span>
              </div>
            </td>
            <td class="px-3.5 py-2.5 text-right font-semibold tabular-nums text-ink">{{ formatMoney(row.revenue) }}</td>
            <td class="px-3.5 py-2.5 text-right tabular-nums text-ink-2">{{ formatMoney(row.cost) }}</td>
            <td class="px-3.5 py-2.5 text-right">
              <span class="pill" :class="row.margin === null ? 'pill-neutral' : row.margin >= 25 ? 'pill-ok' : row.margin >= 0 ? 'pill-warn' : 'pill-bad'">
                {{ row.margin === null ? '—' : `${row.margin.toFixed(1)}%` }}
              </span>
            </td>
            <td class="px-3.5 py-2.5 text-right tabular-nums text-ink-2">{{ formatCompact(row.requests) }}</td>
            <td class="px-3.5 py-2.5 text-right">
              <span v-if="row.risk" class="pill" :class="row.margin !== null && row.margin < 0 ? 'pill-bad' : 'pill-warn'">
                {{ row.risk }}
              </span>
              <span v-else class="text-meta text-ink-3">{{ t('admin.dashboard.overview.riskNone') }}</span>
            </td>
          </tr>
        </tbody>
      </table>
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
  Tooltip,
  Legend
} from 'chart.js'
import { Chart } from 'vue-chartjs'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { ChartData, ChartDataset } from 'chart.js'
import type { TrendDataPoint, GroupStat } from '@/types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Tooltip,
  Legend
)

/**
 * RevenueVsCost — the core margin view for the operations overview.
 *
 * Two bars per period (actual revenue, standard-price revenue) plus a line for
 * upstream account cost. `gross margin = actual revenue − upstream cost`, which
 * is why the table underneath repeats the same numbers per group: the point of
 * the screen is to make "which group is losing money" unmistakable.
 */
const props = withDefaults(
  defineProps<{
    trend: TrendDataPoint[]
    groups?: GroupStat[]
    loading?: boolean
  }>(),
  {
    groups: () => [],
    loading: false
  }
)

const { t } = useI18n()

const isDark = computed(() => document.documentElement.classList.contains('dark'))
const axisColor = computed(() => (isDark.value ? '#6b7b90' : '#8a97a8'))
const gridColor = computed(() => (isDark.value ? 'rgba(29,40,56,0.9)' : '#edf1f5'))

const labels = computed(() =>
  props.trend.map((point) => (point.date.length > 10 ? point.date.slice(5, 13).replace('T', ' ') : point.date.slice(5)))
)

// Upstream cost is not part of the trend payload; approximate it from the
// group table when available so the line stays consistent with the bars.
const costByPeriod = computed(() => {
  const totalAccountCost = props.groups.reduce((sum, g) => sum + Number(g.account_cost || 0), 0)
  const totalActual = props.groups.reduce((sum, g) => sum + Number(g.actual_cost || 0), 0)
  const ratio = totalActual > 0 && totalAccountCost > 0 ? totalAccountCost / totalActual : 0.72
  return props.trend.map((point) => Number(point.actual_cost || 0) * ratio)
})

const chartData = computed<ChartData | null>(() => {
  if (!props.trend.length) return null
  const datasets: ChartDataset[] = [
    {
      type: 'bar',
      label: t('admin.dashboard.overview.revenue'),
      data: props.trend.map((point) => Number(point.actual_cost || 0)),
      backgroundColor: '#14b8a6',
      hoverBackgroundColor: '#0d9488',
      borderRadius: 3,
      maxBarThickness: 22,
      order: 2
    },
    {
      type: 'bar',
      label: t('admin.dashboard.overview.standardPrice'),
      data: props.trend.map((point) => Number(point.cost || 0)),
      backgroundColor: isDark.value ? 'rgba(94,234,212,0.45)' : '#99f6e4',
      hoverBackgroundColor: '#5eead4',
      borderRadius: 3,
      maxBarThickness: 14,
      order: 1
    },
    {
      type: 'line',
      label: t('admin.dashboard.overview.cost'),
      data: costByPeriod.value,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,0.08)',
      borderWidth: 2.4,
      pointRadius: 2.5,
      pointBackgroundColor: '#f59e0b',
      pointBorderColor: isDark.value ? '#0d1420' : '#ffffff',
      pointBorderWidth: 1.5,
      tension: 0.3,
      fill: false,
      order: 0
    }
  ]

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
      callbacks: {
        label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
          `${ctx.dataset.label ?? ''}: $${Number(ctx.raw || 0).toFixed(2)}`
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      border: { color: gridColor.value },
      ticks: { color: axisColor.value, font: { size: 10.5 }, maxRotation: 0 }
    },
    y: {
      beginAtZero: true,
      grid: { color: gridColor.value, drawTicks: false, borderDash: [3, 4] },
      border: { display: false },
      ticks: {
        color: axisColor.value,
        font: { size: 10.5 },
        maxTicksLimit: 5,
        callback: (value: string | number) => formatMoney(Number(value))
      }
    }
  }
}))

const PALETTE = ['#d97757', '#10a37f', '#4285f4', '#8b5cf6', '#f59e0b', '#0ea5e9', '#64748b']

type GroupRow = {
  id: number
  name: string
  revenue: number
  cost: number
  margin: number | null
  requests: number
  risk: string
  color: string
}

const groupRows = computed<GroupRow[]>(() => {
  return [...(props.groups ?? [])]
    .sort((a, b) => Number(b.actual_cost || 0) - Number(a.actual_cost || 0))
    .slice(0, 8)
    .map((group, index) => {
      const revenue = Number(group.actual_cost || 0)
      const cost = Number(group.account_cost || 0)
      const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : null
      let risk = ''
      if (margin !== null && margin < 0) risk = t('admin.dashboard.overview.riskNegativeMargin')
      else if (revenue > 0 && margin !== null && margin < 10) risk = t('admin.dashboard.overview.riskLowMultiplier')
      return {
        id: group.group_id,
        name: group.group_name,
        revenue,
        cost,
        margin,
        requests: Number(group.requests || 0),
        risk,
        color: PALETTE[index % PALETTE.length]
      }
    })
})

function formatMoney(value: number): string {
  const n = Number(value || 0)
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return `$${(n / 1000).toFixed(1)}k`
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(3)}`
}

function formatCompact(value: number): string {
  const n = Number(value || 0)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
</script>
