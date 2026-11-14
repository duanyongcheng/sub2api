<template>
  <AppLayout>
    <div v-if="loading && !stats" class="flex items-center justify-center py-16">
      <LoadingSpinner size="lg" />
    </div>

    <template v-else>
      <PageHeader
        :title="t('dashboard.title')"
        :description="t('dashboard.welcomeMessage')"
      >
        <template #actions>
          <div class="seg" role="group" :aria-label="t('dashboard.timeRange')">
            <button
              v-for="preset in presets"
              :key="preset.days"
              type="button"
              :class="{ on: selectedPreset === preset.days }"
              :aria-pressed="selectedPreset === preset.days"
              @click="applyPreset(preset.days)"
            >
              {{ preset.label }}
            </button>
          </div>
          <button type="button" class="btn btn-secondary" :disabled="loading" @click="refreshAll">
            <Icon name="refresh" size="sm" :class="loading ? 'animate-spin' : ''" />
            {{ t('common.refresh') }}
          </button>
        </template>
      </PageHeader>

      <div class="mt-4 flex flex-col gap-4">
        <WorkbenchHero
          :stats="stats"
          :balance="balance"
          :is-simple="authStore.isSimpleMode"
          :subscription="primarySubscription"
          :hourly-trend="hourlyTrend"
          :window-days="statsWindowDays"
          :yesterday-requests="yesterdayRequests"
        />

        <!-- KPI band -->
        <section class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            :label="t('dashboard.todayRequests')"
            :value="formatNumber(stats?.today_requests ?? 0)"
            :unit="t('dashboard.workbench.requestsUnit')"
            icon="chart"
            :sparkline="dailySpark.requests"
            spark-color="#94a3b8"
          >
            <span
              v-if="requestDelta !== null"
              class="trend"
              :class="requestDelta >= 0 ? 'trend-up' : 'trend-down'"
            >
              <Icon :name="requestDelta >= 0 ? 'arrowUp' : 'arrowDown'" size="xs" :stroke-width="2.4" />
              {{ Math.abs(requestDelta).toFixed(1) }}%
            </span>
            <span class="truncate">
              {{ t('dashboard.workbench.vsYesterday') }} ·
              {{ t('dashboard.workbench.cumulative') }} {{ formatCompact(stats?.total_requests ?? 0) }}
            </span>
          </KpiCard>

          <KpiCard
            :label="t('dashboard.workbench.costLabel')"
            :value="`$${formatCost(stats?.today_actual_cost ?? 0)}`"
            :unit="`/ $${formatCost(stats?.today_cost ?? 0)}`"
            icon="dollar"
            :sparkline="dailySpark.cost"
            spark-color="#94a3b8"
          >
            <span v-if="savingPercent !== null" class="pill pill-brand">
              {{ t('dashboard.workbench.savedLabel', { percent: savingPercent }) }}
            </span>
            <span v-else class="truncate">{{ t('dashboard.workbench.noSaving') }}</span>
          </KpiCard>

          <KpiCard
            :label="t('dashboard.todayTokens')"
            :value="formatCompact(stats?.today_tokens ?? 0)"
            icon="cube"
            :sparkline="dailySpark.tokens"
            spark-color="#94a3b8"
          >
            <span class="truncate">
              {{ t('dashboard.input') }} {{ formatCompact(stats?.today_input_tokens ?? 0) }} ·
              {{ t('dashboard.output') }} {{ formatCompact(stats?.today_output_tokens ?? 0) }} ·
              {{ t('dashboard.workbench.cacheHit', { tokens: formatCompact(cacheTokens) }) }}
            </span>
          </KpiCard>

          <KpiCard
            :label="t('dashboard.avgResponse')"
            :value="formatSeconds(stats?.average_duration_ms ?? 0)"
            icon="clock"
            :sparkline="dailySpark.duration"
            spark-color="#94a3b8"
          >
            <span class="truncate">
              {{ t('dashboard.workbench.cacheHit', { tokens: formatCompact(cacheTokens) }) }} ·
              {{ stats?.rpm ?? 0 }} RPM
            </span>
          </KpiCard>
        </section>

        <!-- Main grid -->
        <section class="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
          <div class="flex min-w-0 flex-col gap-4">
            <WorkbenchTrend
              :metric="metric"
              :granularity="granularity"
              :trend="trendData"
              :loading="loadingCharts"
              :start-date="startDate"
              :end-date="endDate"
              :window-label="windowLabel"
              @update:metric="onMetricChange"
              @update:granularity="onGranularityChange"
              @range-change="onRangeChange"
              @refresh="loadCharts"
            />
            <WorkbenchRecentRequests :logs="recentLogs" :loading="loadingRecent" />
          </div>

          <div class="flex min-w-0 flex-col gap-4">
            <WorkbenchPlatforms
              :by-platform="stats?.by_platform ?? []"
              :quotas="platformQuotas"
            />
            <WorkbenchTopModels :stats="modelStats" />
            <WorkbenchQuickActions />
          </div>
        </section>
      </div>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import KpiCard from '@/components/common/KpiCard.vue'
import Icon from '@/components/icons/Icon.vue'
import WorkbenchHero from '@/components/user/workbench/WorkbenchHero.vue'
import WorkbenchTrend from '@/components/user/workbench/WorkbenchTrend.vue'
import WorkbenchPlatforms from '@/components/user/workbench/WorkbenchPlatforms.vue'
import WorkbenchTopModels from '@/components/user/workbench/WorkbenchTopModels.vue'
import WorkbenchRecentRequests from '@/components/user/workbench/WorkbenchRecentRequests.vue'
import WorkbenchQuickActions from '@/components/user/workbench/WorkbenchQuickActions.vue'
import { useAuthStore, useSubscriptionStore } from '@/stores'
import { usageAPI, type UserDashboardStats as UserStatsType } from '@/api/usage'
import { getMyPlatformQuotas } from '@/api/user'
import type { UsageLog, TrendDataPoint, ModelStat, PlatformQuotaItem } from '@/types'
import { formatDateLocalInput } from '@/utils/format'
import { isLast24HoursRange } from '@/utils/dateRange'
import type { WorkbenchMetric, WorkbenchGranularity } from '@/components/user/workbench/WorkbenchTrend.vue'

/**
 * DashboardView — the workbench (`/dashboard`).
 *
 * Data flow is unchanged (four parallel APIs + platform quotas). What changed
 * is the order in which the answers are presented:
 *   1. Hero: am I within quota, do I have balance, am I throttled?
 *   2. KPI band: today's volume / cost / tokens / latency with sparklines.
 *   3. Trend + recent requests (left), platform / model / actions (right).
 */
const { t } = useI18n()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()
const user = computed(() => authStore.user)

const stats = ref<UserStatsType | null>(null)
const loading = ref(false)
const loadingCharts = ref(false)
const loadingRecent = ref(false)

const trendData = ref<TrendDataPoint[]>([])
const hourlyTrend = ref<TrendDataPoint[]>([])
const modelStats = ref<ModelStat[]>([])
const recentLogs = ref<UsageLog[]>([])
const platformQuotas = ref<PlatformQuotaItem[] | null>(null)

const metric = ref<WorkbenchMetric>('requests')
const granularity = ref<WorkbenchGranularity>('day')

const today = new Date()
const startDate = ref(formatDateLocalInput(new Date(today.getTime() - 6 * 86_400_000)))
const endDate = ref(formatDateLocalInput(today))
const selectedPreset = ref<number | null>(7)

const presets = computed(() => [
  { days: 1, label: t('dashboard.workbench.presetToday') },
  { days: 7, label: t('dashboard.workbench.presetLast7') },
  { days: 30, label: t('dashboard.workbench.presetLast30') }
])

const statsWindowDays = computed(() => selectedPreset.value ?? 7)

const windowLabel = computed(() => {
  if (isLast24HoursRange(startDate.value, endDate.value)) return t('dates.last24Hours')
  const preset = presets.value.find((p) => p.days === selectedPreset.value)
  return preset ? preset.label : `${startDate.value} ~ ${endDate.value}`
})

const balance = computed(() => Number(user.value?.balance || 0))

const primarySubscription = computed(() => subscriptionStore.activeSubscriptions[0] ?? null)

// Yesterday's request count drives the day-over-day delta in the hero and KPI.
const yesterdayRequests = computed<number | null>(() => {
  const points = trendData.value
  if (points.length < 2) return null
  const previous = points[points.length - 2]
  return Number(previous.requests || 0)
})

const requestDelta = computed<number | null>(() => {
  const todayRequests = stats.value?.today_requests ?? 0
  const yesterday = yesterdayRequests.value
  if (yesterday === null || yesterday <= 0) return null
  return ((todayRequests - yesterday) / yesterday) * 100
})

const savingPercent = computed<number | null>(() => {
  const standard = Number(stats.value?.today_cost || 0)
  const actual = Number(stats.value?.today_actual_cost || 0)
  if (standard <= 0 || actual >= standard) return null
  return Math.round((1 - actual / standard) * 100)
})

const cacheTokens = computed(
  () => (stats.value?.today_cache_creation_tokens ?? 0) + (stats.value?.today_cache_read_tokens ?? 0)
)

// Sparklines are derived from the already-loaded daily trend, so the KPI band
// costs no extra request.
const dailySpark = computed(() => {
  const points = trendData.value
  return {
    requests: points.map((p) => Number(p.requests || 0)),
    tokens: points.map((p) => Number(p.total_tokens || 0)),
    cost: points.map((p) => Number(p.actual_cost || 0)),
    duration: points.map((p) => (p.requests > 0 ? p.total_tokens / p.requests : 0))
  }
})

function applyPreset(days: number) {
  selectedPreset.value = days
  const now = new Date()
  startDate.value = formatDateLocalInput(new Date(now.getTime() - (days - 1) * 86_400_000))
  endDate.value = formatDateLocalInput(now)
  granularity.value = days === 1 ? 'hour' : 'day'
  void loadCharts()
}

function onMetricChange(next: WorkbenchMetric) {
  if (metric.value === next) return
  metric.value = next
  // Requests / tokens / cost all come from the same trend payload, so switching
  // the metric is a pure re-render with no extra request.
}

function onGranularityChange(next: WorkbenchGranularity) {
  if (granularity.value === next) return
  granularity.value = next
  void loadCharts()
}

function onRangeChange(payload: { startDate: string; endDate: string; preset: string | null }) {
  selectedPreset.value = null
  startDate.value = payload.startDate
  endDate.value = payload.endDate
  const span = (new Date(payload.endDate).getTime() - new Date(payload.startDate).getTime()) / 86_400_000
  granularity.value = span <= 1 ? 'hour' : 'day'
  void loadCharts()
}

async function loadStats() {
  loading.value = true
  try {
    await authStore.refreshUser()
    stats.value = await usageAPI.getDashboardStats()
  } catch (error) {
    console.error('Failed to load dashboard stats:', error)
  } finally {
    loading.value = false
  }
}

async function loadCharts() {
  loadingCharts.value = true
  try {
    const [trendResponse, modelResponse] = await Promise.all([
      usageAPI.getDashboardTrend({
        start_date: startDate.value,
        end_date: endDate.value,
        granularity: granularity.value
      }),
      usageAPI.getDashboardModels({ start_date: startDate.value, end_date: endDate.value })
    ])
    trendData.value = trendResponse.trend || []
    modelStats.value = modelResponse.models || []
  } catch (error) {
    console.error('Failed to load dashboard charts:', error)
  } finally {
    loadingCharts.value = false
  }

  // The hero throughput strip always looks at the last 60 minutes regardless
  // of the selected range; failure here must not blank the whole page.
  try {
    const now = new Date()
    const hourResponse = await usageAPI.getDashboardTrend({
      start_date: formatDateLocalInput(new Date(now.getTime() - 86_400_000)),
      end_date: formatDateLocalInput(now),
      granularity: 'hour'
    })
    hourlyTrend.value = hourResponse.trend || []
  } catch (error) {
    console.warn('Failed to load hourly throughput:', error)
    hourlyTrend.value = []
  }
}

async function loadRecent() {
  loadingRecent.value = true
  try {
    const response = await usageAPI.getByDateRange(startDate.value, endDate.value)
    recentLogs.value = response.items.slice(0, 6)
  } catch (error) {
    console.error('Failed to load recent usage:', error)
    recentLogs.value = []
  } finally {
    loadingRecent.value = false
  }
}

async function loadPlatformQuotas() {
  try {
    const data = await getMyPlatformQuotas()
    platformQuotas.value = data.platform_quotas ?? []
  } catch (error) {
    console.warn('Failed to load platform quotas:', error)
    platformQuotas.value = []
  }
}

function refreshAll() {
  void loadStats()
  void loadCharts()
  void loadRecent()
  void loadPlatformQuotas()
  void subscriptionStore.fetchActiveSubscriptions(true).catch(() => undefined)
}

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString()
}

function formatCompact(value: number): string {
  const n = Number(value || 0)
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

function formatCost(value: number): string {
  const n = Number(value || 0)
  if (n >= 1) return n.toFixed(2)
  if (n >= 0.01) return n.toFixed(3)
  return n.toFixed(4)
}

function formatSeconds(ms: number): string {
  const n = Number(ms || 0)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `${(n / 1000).toFixed(2)}s`
}

onMounted(() => {
  refreshAll()
})
</script>
