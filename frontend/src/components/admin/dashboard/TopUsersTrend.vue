<template>
  <section class="card">
    <div class="card-hd">
      <h3 class="text-sm font-semibold text-ink">{{ title }} · Top {{ limit }}</h3>
      <div class="seg" role="group">
        <button type="button" :class="{ on: metric === 'actual_cost' }" :aria-pressed="metric === 'actual_cost'" @click="emit('update:metric', 'actual_cost')">
          {{ labels.spending }}
        </button>
        <button type="button" :class="{ on: metric === 'tokens' }" :aria-pressed="metric === 'tokens'" @click="emit('update:metric', 'tokens')">
          {{ labels.tokens }}
        </button>
      </div>
    </div>

    <div class="card-bd">
      <div class="relative h-[240px]">
        <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-surface/60">
          <LoadingSpinner size="md" />
        </div>
        <Line v-if="chartData" :data="chartData" :options="chartOptions" />
        <div v-else class="flex h-full items-center justify-center text-body text-ink-3">
          {{ emptyText }}
        </div>
      </div>

      <!-- Ranking list doubles as the chart legend and the drill-down -->
      <div v-if="ranking.length > 0" class="mt-3 grid grid-cols-1 gap-1.5 border-t border-edge pt-3 sm:grid-cols-2">
        <button
          v-for="(item, index) in ranking.slice(0, 6)"
          :key="item.user_id"
          type="button"
          class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-3"
          @click="emit('rankingClick', item)"
        >
          <span class="h-2 w-2 shrink-0 rounded-full" :style="{ background: colorAt(index) }" />
          <span class="min-w-0 flex-1 truncate text-meta text-ink-2">{{ displayName(item) }}</span>
          <span class="shrink-0 text-meta font-semibold tabular-nums text-ink">{{ formatValue(item) }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js'
import { Line } from 'vue-chartjs'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { UserUsageTrendPoint, UserSpendingRankingItem } from '@/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

/**
 * TopUsersTrend — multi-line usage trend for the heaviest users.
 *
 * The ranking list under the chart shares the same colour palette, so a line is
 * identifiable without a 12-item legend. Clicking a name drills into the usage
 * page filtered by that user.
 */
const props = withDefaults(
  defineProps<{
    title: string
    emptyText: string
    labels: { spending: string; tokens: string }
    /**
     * `null` means "not loaded yet" (renders the empty state). An empty array
     * means "loaded, no rows" and still draws the axes.
     */
    trend: UserUsageTrendPoint[] | null
    ranking: UserSpendingRankingItem[]
    metric: 'tokens' | 'actual_cost'
    loading?: boolean
    limit?: number
  }>(),
  { loading: false, limit: 12 }
)

const emit = defineEmits<{
  (e: 'update:metric', value: 'tokens' | 'actual_cost'): void
  (e: 'rankingClick', item: UserSpendingRankingItem): void
}>()

const PALETTE = [
  '#0d9488', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#a855f7'
]

const isDark = computed(() => document.documentElement.classList.contains('dark'))
const axisColor = computed(() => (isDark.value ? '#6b7b90' : '#8a97a8'))
const gridColor = computed(() => (isDark.value ? 'rgba(29,40,56,0.9)' : '#edf1f5'))

function colorAt(index: number): string {
  return PALETTE[index % PALETTE.length]
}

function displayName(item: UserSpendingRankingItem): string {
  return item.username?.trim() || item.email?.trim() || `#${item.user_id}`
}

function formatValue(item: UserSpendingRankingItem): string {
  if (props.metric === 'actual_cost') return `$${Number(item.actual_cost || 0).toFixed(2)}`
  return formatTokens(item.tokens)
}

function formatTokens(value: number): string {
  const n = Number(value || 0)
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(Math.round(n))
}

const chartData = computed(() => {
  // `null` = still loading: render the empty state instead of an axis-only
  // chart. An empty array means "loaded, nothing to show" and still draws.
  if (!props.trend) return null
  const points = props.trend

  const dates = [...new Set(points.map((point) => point.date))].sort()
  const groups = new Map<number, { name: string; values: Map<string, number> }>()

  for (const point of points) {
    if (!groups.has(point.user_id)) {
      groups.set(point.user_id, {
        name: point.username?.trim() || point.email?.trim() || `#${point.user_id}`,
        values: new Map()
      })
    }
    const value = props.metric === 'tokens' ? Number(point.tokens || 0) : Number(point.actual_cost || 0)
    groups.get(point.user_id)!.values.set(point.date, value)
  }

  // Keep the series stable so a colour always maps to the same user.
  const order = new Map(props.ranking.map((item, index) => [item.user_id, index]))
  const entries = [...groups.entries()].sort(
    (a, b) => (order.get(a[0]) ?? Number.MAX_SAFE_INTEGER) - (order.get(b[0]) ?? Number.MAX_SAFE_INTEGER)
  )

  return {
    labels: dates,
    datasets: entries.map(([userId, group], index) => ({
      label: group.name,
      data: dates.map((date) => group.values.get(date) ?? 0),
      borderColor: colorAt(order.get(userId) ?? index),
      backgroundColor: `${colorAt(order.get(userId) ?? index)}18`,
      borderWidth: 1.8,
      pointRadius: 0,
      tension: 0.3,
      fill: false
    }))
  }
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
      itemSort: (a: { raw?: unknown }, b: { raw?: unknown }) =>
        Number(b.raw ?? 0) - Number(a.raw ?? 0),
      callbacks: {
        label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
          `${ctx.dataset.label ?? ''}: ${
            props.metric === 'tokens'
              ? formatTokens(Number(ctx.raw || 0))
              : `$${Number(ctx.raw || 0).toFixed(2)}`
          }`
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      border: { color: gridColor.value },
      ticks: { color: axisColor.value, font: { size: 10.5 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
    },
    y: {
      beginAtZero: true,
      grid: { color: gridColor.value, drawTicks: false, borderDash: [3, 4] },
      border: { display: false },
      ticks: {
        color: axisColor.value,
        font: { size: 10.5 },
        maxTicksLimit: 5,
        callback: (value: string | number) =>
          props.metric === 'tokens' ? formatTokens(Number(value)) : `$${Number(value).toFixed(0)}`
      }
    }
  }
}))

</script>
