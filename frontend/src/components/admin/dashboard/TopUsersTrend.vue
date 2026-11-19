<template>
  <section :class="embedded ? 'flex min-w-0 flex-col' : 'card'">
    <div
      class="flex flex-wrap items-center justify-between gap-2 border-b border-edge"
      :class="embedded ? 'px-4 py-2.5' : 'card-hd'"
    >
      <div class="min-w-0">
        <h3 class="text-[13px] font-semibold text-ink">{{ title }}</h3>
        <p v-if="hint" class="text-[11px] text-ink-2">{{ hint }}</p>
      </div>
      <div class="seg" role="group">
        <button
          type="button"
          :class="{ on: metric === 'actual_cost' }"
          :aria-pressed="metric === 'actual_cost'"
          @click="emit('update:metric', 'actual_cost')"
        >
          {{ labels.spending }}
        </button>
        <button
          type="button"
          :class="{ on: metric === 'tokens' }"
          :aria-pressed="metric === 'tokens'"
          @click="emit('update:metric', 'tokens')"
        >
          {{ labels.tokens }}
        </button>
      </div>
    </div>

    <div :class="embedded ? 'flex flex-1 flex-col' : 'card-bd'">
      <div class="relative h-[184px] px-4 pb-2 pt-3">
        <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-surface/60">
          <LoadingSpinner size="md" />
        </div>
        <Line v-if="chartData" :data="chartData" :options="chartOptions" />
        <div v-else class="flex h-full items-center justify-center text-body text-ink-2">
          {{ emptyText }}
        </div>
      </div>

      <!-- Dense clickable ranking table doubles as series legend and drill-down -->
      <div v-if="ranking.length > 0" class="overflow-x-auto border-t border-edge">
        <table class="w-full text-data">
          <thead>
            <tr class="border-b border-edge bg-surface-2 text-[11px] font-semibold text-ink-2">
              <th class="px-4 py-2 text-left font-semibold">{{ t('admin.dashboard.spendingRankingUser') }}</th>
              <th class="px-3 py-2 text-right font-semibold">{{ t('admin.dashboard.spendingRankingRequests') }}</th>
              <th class="px-4 py-2 text-right font-semibold">
                {{ metric === 'actual_cost' ? labels.spending : labels.tokens }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in visibleRanking"
              :key="item.user_id"
              class="cursor-pointer border-b border-edge/70 transition-colors last:border-b-0 hover:bg-surface-2"
              @click="emit('rankingClick', item)"
            >
              <td class="px-4 py-2">
                <button
                  type="button"
                  class="flex w-full min-w-0 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                  @click.stop="emit('rankingClick', item)"
                >
                  <span
                    class="h-2 w-2 shrink-0 rounded-full"
                    :style="{ backgroundColor: colorAt(index) }"
                    aria-hidden="true"
                  />
                  <span class="min-w-0 flex-1 truncate font-medium text-ink" :title="item.email || displayName(item)">
                    {{ displayName(item) }}
                  </span>
                </button>
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-ink-2">
                {{ formatCompact(item.requests) }}
              </td>
              <td class="px-4 py-2 text-right font-semibold tabular-nums text-ink">
                {{ formatValue(item) }}
              </td>
            </tr>
          </tbody>
        </table>

        <div
          v-if="ranking.length > 6"
          class="flex justify-center border-t border-edge bg-surface-2 py-1.5"
        >
          <button
            type="button"
            class="text-[11.5px] font-semibold text-primary-700 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
            @click="expanded = !expanded"
          >
            {{
              expanded
                ? t('admin.dashboard.overview.showLessRanking')
                : t('admin.dashboard.overview.showAllRanking', { count: ranking.length })
            }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js'
import { Line } from 'vue-chartjs'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { useDarkMode } from '@/composables/useDarkMode'
import type { UserUsageTrendPoint, UserSpendingRankingItem } from '@/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const props = withDefaults(
  defineProps<{
    title: string
    hint?: string
    emptyText: string
    labels: { spending: string; tokens: string }
    /** `null` means not loaded yet; `[]` means loaded with no rows. */
    trend: UserUsageTrendPoint[] | null
    ranking: UserSpendingRankingItem[]
    metric: 'tokens' | 'actual_cost'
    loading?: boolean
    limit?: number
    embedded?: boolean
  }>(),
  { hint: '', loading: false, limit: 12, embedded: false }
)

const emit = defineEmits<{
  (e: 'update:metric', value: 'tokens' | 'actual_cost'): void
  (e: 'rankingClick', item: UserSpendingRankingItem): void
}>()

const { t } = useI18n()
const isDark = useDarkMode()
const expanded = ref(false)

const PALETTE = [
  '#0d9488', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#a855f7'
]

const axisColor = computed(() => (isDark.value ? '#94a3b8' : '#64748b'))
const gridColor = computed(() => (isDark.value ? 'rgba(42,55,74,0.75)' : '#edf1f5'))

const visibleRanking = computed(() =>
  expanded.value ? props.ranking.slice(0, props.limit) : props.ranking.slice(0, 6)
)

function colorAt(index: number): string {
  return PALETTE[index % PALETTE.length]
}

function displayName(item: UserSpendingRankingItem): string {
  return item.username?.trim() || item.email?.trim() || `#${item.user_id}`
}

function formatValue(item: UserSpendingRankingItem): string {
  if (props.metric === 'actual_cost') {
    return `$${Number(item.actual_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return formatTokens(item.tokens)
}

function formatTokens(value: number): string {
  const n = Number(value || 0)
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(Math.round(n))
}

function formatCompact(value: number): string {
  const n = Number(value || 0)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

const chartData = computed(() => {
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

  const order = new Map(props.ranking.map((item, index) => [item.user_id, index]))
  const entries = [...groups.entries()].sort(
    (a, b) => (order.get(a[0]) ?? Number.MAX_SAFE_INTEGER) - (order.get(b[0]) ?? Number.MAX_SAFE_INTEGER)
  )

  return {
    labels: dates.map((d) => (d.length > 10 ? d.slice(5, 13).replace('T', ' ') : d.slice(5))),
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
      itemSort: (a: { raw?: unknown }, b: { raw?: unknown }) => Number(b.raw ?? 0) - Number(a.raw ?? 0),
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
      ticks: { color: axisColor.value, font: { size: 10.5 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
    },
    y: {
      beginAtZero: true,
      grid: { color: gridColor.value, drawTicks: false },
      border: { display: false },
      ticks: {
        color: axisColor.value,
        font: { size: 10.5 },
        maxTicksLimit: 4,
        callback: (value: string | number) =>
          props.metric === 'tokens' ? formatTokens(Number(value)) : `$${Number(value).toFixed(0)}`
      }
    }
  }
}))
</script>
