<template>
  <section class="overflow-hidden rounded-card border border-edge bg-surface shadow-xs">
    <!-- Trend header with metric/granularity switchers and accurate inline summary -->
    <div class="flex flex-wrap items-center justify-between gap-2.5 border-b border-edge px-4 py-2.5">
      <div class="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <h3 class="text-[13.5px] font-semibold text-ink">{{ t('dashboard.workbench.trendTitle') }}</h3>
        <span v-if="windowLabel" class="rounded-md bg-surface-3 px-2 py-0.5 text-[11.5px] font-medium text-ink-2">
          {{ windowLabel }}
        </span>
        <div
          v-if="summary"
          class="hidden flex-wrap items-center gap-x-2.5 text-[11.5px] tabular-nums text-ink-2 md:flex"
        >
          <span>{{ t('dashboard.workbench.summaryPeak', { value: summary.peak }) }}</span>
          <span aria-hidden="true" class="text-edge-strong">·</span>
          <span>{{ t('dashboard.workbench.summaryAvg', { value: summary.average }) }}</span>
          <span aria-hidden="true" class="text-edge-strong">·</span>
          <span class="font-semibold text-ink">{{ t('dashboard.workbench.summaryTotal', { value: summary.total }) }}</span>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
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
      </div>
    </div>

    <!-- Chart canvas -->
    <div class="px-4 pb-3 pt-3">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-ink-2">
        <div class="flex flex-wrap items-center gap-3.5">
          <span class="inline-flex items-center gap-1.5">
            <i class="h-2 w-2 rounded-sm bg-primary-500" aria-hidden="true" />{{ metricLabel }}
          </span>
          <span v-if="metric === 'cost'" class="inline-flex items-center gap-1.5">
            <i class="h-2 w-2 rounded-sm bg-teal-300 dark:bg-teal-400/50" aria-hidden="true" />{{ t('dashboard.standard') }}
          </span>
          <span class="inline-flex items-center gap-1.5">
            <i class="h-[2px] w-3.5 rounded-sm bg-ink-3" aria-hidden="true" />{{ t('dashboard.workbench.dailyAverage') }}
          </span>
        </div>
        <span class="text-[11px] text-ink-2">{{ unitLabel }}</span>
      </div>

      <div class="relative h-[212px]">
        <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-surface/60">
          <LoadingSpinner size="md" />
        </div>
        <Bar v-if="chartData" :data="chartData" :options="chartOptions" />
        <div v-else class="flex h-full items-center justify-center text-body text-ink-2">
          {{ t('dashboard.workbench.trendEmpty') }}
        </div>
      </div>

      <!-- Mobile summary fallback -->
      <div
        v-if="summary"
        class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-edge pt-2 text-[11.5px] tabular-nums text-ink-2 md:hidden"
      >
        <span>{{ t('dashboard.workbench.summaryPeak', { value: summary.peak }) }}</span>
        <span>{{ t('dashboard.workbench.summaryAvg', { value: summary.average }) }}</span>
        <span class="font-semibold text-ink">{{ t('dashboard.workbench.summaryTotal', { value: summary.total }) }}</span>
      </div>
    </div>

    <!-- Integrated 2-column Platform Quotas & Top Models shelf -->
    <div
      class="grid grid-cols-1 divide-y divide-edge border-t border-edge bg-surface-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:divide-x lg:divide-y-0"
    >
      <!-- Left shelf: Platform Usage & Configured Quotas -->
      <div class="px-4 py-3">
        <div class="mb-2 flex items-center justify-between gap-2 text-[11.5px] font-semibold text-ink-2">
          <span>
            {{
              isSimple
                ? t('dashboard.workbench.platformShareSectionSimple')
                : t('dashboard.workbench.platformQuotaSection')
            }}
          </span>
          <span>
            {{
              isSimple
                ? t('dashboard.workbench.platformShareHintSimple')
                : t('dashboard.workbench.platformQuotaHint')
            }}
          </span>
        </div>

        <p v-if="platformRows.length === 0" class="py-4 text-center text-body text-ink-2">
          {{ t('dashboard.workbench.platformEmpty') }}
        </p>

        <div v-else class="flex flex-col divide-y divide-edge/70">
          <div v-for="item in platformRows" :key="item.platform" class="py-2 first:pt-0.5 last:pb-0.5">
            <div class="flex items-center gap-2.5 text-[12px] tabular-nums">
              <span
                class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-edge bg-surface"
                :style="{ color: item.color }"
              >
                <PlatformIcon :platform="item.iconPlatform" size="xs" />
              </span>
              <span class="w-24 shrink-0 truncate font-semibold text-ink" :title="item.name">
                {{ item.name }}
              </span>
              <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  class="h-full rounded-full transition-[width] duration-150 motion-reduce:transition-none"
                  :style="{ width: `${item.share > 0 ? Math.max(2, item.share) : 0}%`, backgroundColor: item.color }"
                />
              </div>
              <span class="shrink-0 text-right text-ink-2">
                <template v-if="item.requests > 0">
                  <strong v-if="!isSimple" class="font-semibold text-ink">{{ formatMoney(item.actualCost) }}</strong>
                  <strong v-else class="font-semibold text-ink">{{ formatCompact(item.requests) }}</strong>
                  <span class="mx-1 text-edge-strong">·</span>
                  <span>{{ item.share.toFixed(0) }}%</span>
                </template>
                <span v-else>{{ t('dashboard.workbench.platformZeroToday') }}</span>
              </span>
            </div>

            <!-- Per-window configured platform quotas -->
            <div v-if="!isSimple && item.quotaRows.length > 0" class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 pl-7">
              <div
                v-for="q in item.quotaRows"
                :key="q.label"
                class="flex min-w-[130px] max-w-[210px] flex-1 items-center gap-1.5 text-[11px] tabular-nums"
                :title="q.resetTooltip"
              >
                <span class="shrink-0 font-medium text-ink-2">{{ q.label }}</span>
                <div class="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    class="h-full rounded-full"
                    :class="q.percent >= 90 ? 'bg-red-500' : q.percent >= 75 ? 'bg-amber-500' : 'bg-primary-500'"
                    :style="{ width: `${q.percent}%` }"
                  />
                </div>
                <span
                  class="shrink-0 font-semibold"
                  :class="
                    q.percent >= 90
                      ? 'text-red-700 dark:text-red-300'
                      : q.percent >= 75
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-ink-2'
                  "
                >
                  {{ q.percent }}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right shelf: Top 5 Models -->
      <div class="px-4 py-3">
        <div class="mb-2 flex items-center justify-between gap-2 text-[11.5px] font-semibold text-ink-2">
          <span>{{ t('dashboard.workbench.topModelsSection') }}</span>
          <span>{{ t('dashboard.workbench.topModelsHint') }}</span>
        </div>

        <p v-if="topModels.length === 0" class="py-4 text-center text-body text-ink-2">
          {{ t('dashboard.workbench.topModelsEmpty') }}
        </p>

        <div v-else class="flex flex-col divide-y divide-edge/70">
          <div
            v-for="model in topModels"
            :key="model.model"
            class="flex items-center gap-2.5 py-2 text-[12px] tabular-nums first:pt-0.5 last:pb-0.5"
          >
            <span
              class="w-36 shrink-0 truncate font-mono text-[11.5px] font-semibold text-ink sm:w-44"
              :title="model.model"
            >
              {{ model.model }}
            </span>
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div
                class="h-full rounded-full bg-primary-500 transition-[width] duration-150 motion-reduce:transition-none"
                :style="{ width: `${Math.max(2, model.share)}%` }"
              />
            </div>
            <span v-if="!isSimple" class="w-14 shrink-0 text-right text-ink-2">
              {{ formatMoney(model.actualCost) }}
            </span>
            <span class="w-11 shrink-0 text-right font-semibold text-ink">
              {{ model.share.toFixed(1) }}%
            </span>
          </div>
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
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Tooltip,
  Filler
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import { useDarkMode } from '@/composables/useDarkMode'
import type { ChartDataset } from 'chart.js'
import type { PlatformDashboardStats } from '@/api/usage'
import type { GroupPlatform, ModelStat, PlatformQuotaItem, TrendDataPoint } from '@/types'

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

const props = withDefaults(
  defineProps<{
    trend: TrendDataPoint[]
    loading?: boolean
    metric: WorkbenchMetric
    granularity: WorkbenchGranularity
    windowLabel?: string
    byPlatform?: PlatformDashboardStats[]
    quotas?: PlatformQuotaItem[] | null
    modelStats?: ModelStat[]
    isSimple?: boolean
  }>(),
  {
    loading: false,
    windowLabel: '',
    byPlatform: () => [],
    quotas: null,
    modelStats: () => [],
    isSimple: false
  }
)

const emit = defineEmits<{
  (e: 'update:metric', value: WorkbenchMetric): void
  (e: 'update:granularity', value: WorkbenchGranularity): void
}>()

const { t } = useI18n()
const isDark = useDarkMode()

const metricOptions = computed(() => {
  const options: Array<{ value: WorkbenchMetric; label: string }> = [
    { value: 'requests', label: t('dashboard.workbench.trendRequests') },
    { value: 'tokens', label: t('dashboard.workbench.trendTokens') }
  ]
  if (!props.isSimple) {
    options.push({ value: 'cost', label: t('dashboard.workbench.trendCost') })
  }
  return options
})

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

const axisColor = computed(() => (isDark.value ? '#94a3b8' : '#64748b'))
const gridColor = computed(() => (isDark.value ? 'rgba(42,55,74,0.75)' : '#edf1f5'))

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
      const match = /T(\d{2})/.exec(point.date)
      return match ? `${match[1]}:00` : point.date
    }
    return point.date.length > 10 ? point.date.slice(5, 10) : point.date.slice(5)
  })
)

const chartData = computed(() => {
  if (!props.trend.length) return null
  const values = props.trend.map(valueOf)
  const average = values.reduce((sum, v) => sum + v, 0) / (values.length || 1)

  const datasets: ChartDataset<'bar'>[] = [
    {
      type: 'bar',
      label: metricLabel.value,
      data: values,
      backgroundColor: isDark.value ? 'rgba(20,184,166,0.72)' : '#14b8a6',
      hoverBackgroundColor: '#0d9488',
      borderRadius: 3,
      maxBarThickness: 28,
      order: 2
    } as ChartDataset<'bar'>,
    {
      type: 'line',
      label: t('dashboard.workbench.dailyAverage'),
      data: values.map(() => average),
      borderColor: isDark.value ? '#94a3b8' : '#64748b',
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
      borderColor: isDark.value ? '#5eead4' : '#0f766e',
      backgroundColor: isDark.value ? 'rgba(94,234,212,0.08)' : 'rgba(20,184,166,0.1)',
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
        font: { size: 11 },
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 12
      }
    },
    y: {
      beginAtZero: true,
      grid: { color: gridColor.value, drawTicks: false },
      border: { display: false },
      ticks: {
        color: axisColor.value,
        font: { size: 11 },
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
  if (points.length === 0) return null
  let peakIndex = 0
  let total = 0
  points.forEach((point, idx) => {
    const val = valueOf(point)
    total += val
    if (val > valueOf(points[peakIndex])) peakIndex = idx
  })
  const average = total / points.length
  const peakLabel = labels.value[peakIndex] || ''
  return {
    peak: `${peakLabel} (${formatValue(valueOf(points[peakIndex]))})`,
    average: formatValue(average),
    total: props.metric === 'requests' ? Math.round(total).toLocaleString() : formatValue(total)
  }
})

// ---- Platform breakdown + quotas (merged so 0-request quota platforms stay visible) ----
const PLATFORM_META: Record<string, { label: string; color: string; icon?: GroupPlatform }> = {
  anthropic: { label: 'Anthropic', color: '#d97757', icon: 'anthropic' },
  claude: { label: 'Anthropic', color: '#d97757', icon: 'anthropic' },
  openai: { label: 'OpenAI', color: '#10a37f', icon: 'openai' },
  gemini: { label: 'Google', color: '#4285f4', icon: 'gemini' },
  google: { label: 'Google', color: '#4285f4', icon: 'gemini' },
  grok: { label: 'Grok', color: '#8b5cf6', icon: 'grok' },
  xai: { label: 'Grok', color: '#8b5cf6', icon: 'grok' },
  antigravity: { label: 'Antigravity', color: '#0ea5e9', icon: 'antigravity' },
  kimi: { label: 'Kimi', color: '#6366f1', icon: 'kimi' },
  zhipu: { label: 'GLM', color: '#f97316', icon: 'zhipu' },
  deepseek: { label: 'DeepSeek', color: '#2563eb', icon: 'deepseek' },
  minimax: { label: 'MiniMax', color: '#e11d48', icon: 'minimax' },
  opencode_go: { label: 'OpenCode', color: '#0d9488', icon: 'opencode_go' }
}

type QuotaBar = { label: string; percent: number; resetTooltip: string }

function buildQuotaRows(quota: PlatformQuotaItem | undefined): QuotaBar[] {
  if (!quota) return []
  const windows = [
    { key: 'daily', label: t('dashboard.platformQuota.daily') },
    { key: 'weekly', label: t('dashboard.platformQuota.weekly') },
    { key: 'monthly', label: t('dashboard.platformQuota.monthly') }
  ] as const
  return windows
    .map(({ key, label }) => {
      const limit = Number(quota[`${key}_limit_usd`] ?? 0)
      if (!(limit > 0)) return null
      const used = Number(quota[`${key}_usage_usd`] ?? 0)
      const pct = Math.min(100, Math.round((used / limit) * 100))
      const resetAt = quota[`${key}_window_resets_at`]
      const resetTooltip = resetAt
        ? `${label}: $${used.toFixed(2)} / $${limit.toFixed(2)} · ${t('dashboard.platformQuota.resetsAt', { time: formatResetDate(resetAt) })}`
        : `${label}: $${used.toFixed(2)} / $${limit.toFixed(2)}`
      return { label, percent: pct, resetTooltip }
    })
    .filter((row): row is QuotaBar => row !== null)
}

function formatResetDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const platformRows = computed(() => {
  const map = new Map<string, { requests: number; actualCost: number; quota?: PlatformQuotaItem }>()

  for (const item of props.byPlatform ?? []) {
    if (item.today_requests > 0 || item.today_actual_cost > 0) {
      map.set(item.platform, {
        requests: item.today_requests,
        actualCost: item.today_actual_cost
      })
    }
  }

  for (const quota of props.quotas ?? []) {
    const existing = map.get(quota.platform)
    const rows = buildQuotaRows(quota)
    if (existing) {
      existing.quota = quota
    } else if (rows.length > 0) {
      map.set(quota.platform, { requests: 0, actualCost: 0, quota })
    }
  }

  const entries = [...map.entries()]
  const totalRequests = entries.reduce((sum, [, val]) => sum + val.requests, 0)
  const totalActualCost = entries.reduce((sum, [, val]) => sum + val.actualCost, 0)
  const useSpendBasis = !props.isSimple && totalActualCost > 0

  return entries
    .map(([platform, val]) => {
      const meta = PLATFORM_META[platform.toLowerCase()]
      const name = platform === '__other__' ? t('dashboard.workbench.otherPlatform') : meta?.label || platform
      const share = useSpendBasis
        ? (val.actualCost / totalActualCost) * 100
        : totalRequests > 0
          ? (val.requests / totalRequests) * 100
          : 0
      return {
        platform,
        name,
        color: meta?.color || '#64748b',
        iconPlatform: meta?.icon,
        requests: val.requests,
        actualCost: val.actualCost,
        share,
        quotaRows: buildQuotaRows(val.quota)
      }
    })
    .sort((a, b) => b.actualCost - a.actualCost || b.requests - a.requests || b.quotaRows.length - a.quotaRows.length)
    .slice(0, 5)
})

// ---- Top 5 Models ----
const topModels = computed(() => {
  const rows = [...(props.modelStats ?? [])]
    .filter((row) => Number(row.total_tokens || 0) > 0)
    .sort((a, b) => Number(b.total_tokens || 0) - Number(a.total_tokens || 0))
    .slice(0, 5)
  const total = rows.reduce((sum, row) => sum + Number(row.total_tokens || 0), 0) || 1
  return rows.map((row) => ({
    model: row.model,
    actualCost: Number(row.actual_cost || 0),
    share: (Number(row.total_tokens || 0) / total) * 100
  }))
})

function formatMoney(value: number): string {
  const n = Number(value || 0)
  if (n >= 100) return `$${n.toFixed(0)}`
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(3)}`
}

function formatCompact(value: number): string {
  const n = Number(value || 0)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}
</script>
