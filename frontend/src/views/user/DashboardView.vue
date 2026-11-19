<template>
  <AppLayout>
    <div v-if="loading && !stats" class="flex items-center justify-center py-16">
      <LoadingSpinner size="lg" />
    </div>

    <div v-else class="flex flex-col gap-3.5">
      <!-- Slim top control & quick-action bar (AppHeader carries page title) -->
      <div class="flex flex-wrap items-center justify-between gap-2.5">
        <div class="flex flex-wrap items-center gap-2">
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

          <DateRangePicker
            v-model:start-date="startDate"
            v-model:end-date="endDate"
            compact
            display-mode="range"
            @change="onRangeChange"
          />

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="loading || loadingCharts"
            @click="refreshAll"
          >
            <Icon name="refresh" size="sm" :class="loading || loadingCharts ? 'animate-spin' : ''" />
            {{ t('common.refresh') }}
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span
            v-if="stats"
            class="hidden text-[12px] tabular-nums text-ink-2 2xl:inline"
          >
            {{
              t('dashboard.workbench.todayPulseInline', {
                requests: formatNumber(stats.today_requests),
                tokens: formatCompact(stats.today_tokens),
                latency: formatSeconds(stats.average_duration_ms)
              })
            }}
          </span>

          <router-link
            v-if="channelMonitorEnabled"
            to="/monitor"
            class="btn btn-secondary btn-sm"
          >
            {{ t('dashboard.workbench.quickActionChannels') }}
          </router-link>

          <router-link
            v-if="!authStore.isSimpleMode"
            to="/redeem"
            class="btn btn-secondary btn-sm"
          >
            {{ t('dashboard.redeemCode') }}
          </router-link>

          <router-link
            v-if="canUseBatchImage"
            to="/batch-image"
            class="btn btn-secondary btn-sm"
          >
            {{ t('dashboard.batchImageAgent') }}
          </router-link>

          <router-link to="/keys" class="btn btn-primary btn-sm">
            <Icon name="plus" size="sm" />
            {{ t('dashboard.createApiKey') }}
          </router-link>
        </div>
      </div>

      <!-- Block 1: Readiness & headroom ledger + conditional error alert strip -->
      <WorkbenchReadinessLedger
        :stats="stats"
        :balance="balance"
        :frozen-balance="frozenBalance"
        :user-concurrency="userConcurrency"
        :is-simple="authStore.isSimpleMode"
        :subscription-enabled="subscriptionFeatureEnabled"
        :active-subscriptions="subscriptionStore.activeSubscriptions"
        :recent-errors="recentErrors"
        :errors-total="recentErrorsTotal"
        @inspect-errors="jumpToErrors"
      />

      <!-- Block 2: Full-width usage trend + integrated 2-column platform quotas & top models shelf -->
      <WorkbenchTrend
        :metric="metric"
        :granularity="granularity"
        :trend="trendData"
        :loading="loadingCharts"
        :window-label="windowLabel"
        :by-platform="stats?.by_platform ?? []"
        :quotas="platformQuotas"
        :model-stats="modelStats"
        :is-simple="authStore.isSimpleMode"
        @update:metric="onMetricChange"
        @update:granularity="onGranularityChange"
      />

      <!-- Block 3: Full-width recent requests & error requests inspector -->
      <div ref="recentSectionRef" class="scroll-mt-20">
        <WorkbenchRecentRequests
          v-model:active-tab="recentTab"
          :logs="recentLogs"
          :loading="loadingRecent"
          :error-logs="recentErrors"
          :errors-total="recentErrorsTotal"
          :loading-errors="loadingErrors"
          :is-simple="authStore.isSimpleMode"
        />
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import Icon from '@/components/icons/Icon.vue'
import WorkbenchReadinessLedger from '@/components/user/workbench/WorkbenchReadinessLedger.vue'
import WorkbenchTrend, {
  type WorkbenchMetric,
  type WorkbenchGranularity
} from '@/components/user/workbench/WorkbenchTrend.vue'
import WorkbenchRecentRequests from '@/components/user/workbench/WorkbenchRecentRequests.vue'
import { useAuthStore, useSubscriptionStore } from '@/stores'
import { usageAPI, type UserDashboardStats as UserStatsType } from '@/api/usage'
import { getMyPlatformQuotas } from '@/api/user'
import { useBatchImageAccess } from '@/composables/useBatchImageAccess'
import { FeatureFlags, isChannelMonitorRouteEnabled, isFeatureFlagEnabled } from '@/utils/featureFlags'
import { formatDateLocalInput } from '@/utils/format'
import { isLast24HoursRange } from '@/utils/dateRange'
import type { ModelStat, PlatformQuotaItem, TrendDataPoint, UsageLog, UserErrorRequest } from '@/types'

const { t } = useI18n()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()
const { canUseBatchImage, refreshBatchImageAccess } = useBatchImageAccess()

const user = computed(() => authStore.user)
const balance = computed(() => Number(user.value?.balance || 0))
const frozenBalance = computed(() => Number(user.value?.frozen_balance || 0))
const userConcurrency = computed(() => Number(user.value?.concurrency || 0))
const subscriptionFeatureEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.subscription))
const channelMonitorEnabled = computed(() => isChannelMonitorRouteEnabled())

const stats = ref<UserStatsType | null>(null)
const loading = ref(false)
const loadingCharts = ref(false)
const loadingRecent = ref(false)
const loadingErrors = ref(false)

const trendData = ref<TrendDataPoint[]>([])
const modelStats = ref<ModelStat[]>([])
const recentLogs = ref<UsageLog[]>([])
const recentErrors = ref<UserErrorRequest[]>([])
const recentErrorsTotal = ref(0)
const platformQuotas = ref<PlatformQuotaItem[] | null>(null)

const metric = ref<WorkbenchMetric>('requests')
const granularity = ref<WorkbenchGranularity>('day')
const recentTab = ref<'recent' | 'errors'>('recent')
const recentSectionRef = ref<HTMLElement | null>(null)

let chartsSeq = 0
let recentSeq = 0
let errorsSeq = 0

const today = new Date()
const startDate = ref(formatDateLocalInput(new Date(today.getTime() - 6 * 86_400_000)))
const endDate = ref(formatDateLocalInput(today))
const selectedPreset = ref<number | null>(7)

const presets = computed(() => [
  { days: 1, label: t('dashboard.workbench.presetToday') },
  { days: 7, label: t('dashboard.workbench.presetLast7') },
  { days: 30, label: t('dashboard.workbench.presetLast30') }
])

const windowLabel = computed(() => {
  if (isLast24HoursRange(startDate.value, endDate.value)) return t('dates.last24Hours')
  const preset = presets.value.find((p) => p.days === selectedPreset.value)
  return preset ? preset.label : `${startDate.value} ~ ${endDate.value}`
})

function applyPreset(days: number) {
  selectedPreset.value = days
  const now = new Date()
  startDate.value = formatDateLocalInput(new Date(now.getTime() - (days - 1) * 86_400_000))
  endDate.value = formatDateLocalInput(now)
  granularity.value = days === 1 ? 'hour' : 'day'
  void loadCharts()
  void loadRecent()
  void loadRecentErrors()
}

function onMetricChange(next: WorkbenchMetric) {
  if (metric.value === next) return
  metric.value = next
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
  void loadRecent()
  void loadRecentErrors()
}

function jumpToErrors() {
  recentTab.value = 'errors'
  void nextTick(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    recentSectionRef.value?.scrollIntoView?.({
      behavior: prefersReduced ? 'auto' : 'smooth',
      block: 'nearest'
    })
  })
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
  const seq = ++chartsSeq
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
    if (seq !== chartsSeq) return
    trendData.value = trendResponse.trend || []
    modelStats.value = modelResponse.models || []
  } catch (error) {
    if (seq !== chartsSeq) return
    console.error('Failed to load dashboard charts:', error)
  } finally {
    if (seq === chartsSeq) loadingCharts.value = false
  }
}

async function loadRecent() {
  const seq = ++recentSeq
  loadingRecent.value = true
  try {
    const response = await usageAPI.query({
      start_date: startDate.value,
      end_date: endDate.value,
      page: 1,
      page_size: 8
    })
    if (seq !== recentSeq) return
    recentLogs.value = response.items || []
  } catch (error) {
    if (seq !== recentSeq) return
    console.error('Failed to load recent usage:', error)
    recentLogs.value = []
  } finally {
    if (seq === recentSeq) loadingRecent.value = false
  }
}

async function loadRecentErrors() {
  const seq = ++errorsSeq
  loadingErrors.value = true
  try {
    const response = await usageAPI.listMyErrorRequests({
      start_date: startDate.value,
      end_date: endDate.value,
      page: 1,
      page_size: 8
    })
    if (seq !== errorsSeq) return
    recentErrors.value = response.items || []
    recentErrorsTotal.value = Number(response.total ?? recentErrors.value.length)
  } catch (error) {
    if (seq !== errorsSeq) return
    console.warn('Failed to load recent error requests:', error)
    recentErrors.value = []
    recentErrorsTotal.value = 0
  } finally {
    if (seq === errorsSeq) loadingErrors.value = false
  }
}

async function loadPlatformQuotas() {
  if (authStore.isSimpleMode) {
    platformQuotas.value = []
    return
  }
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
  void loadRecentErrors()
  void loadPlatformQuotas()
  if (subscriptionFeatureEnabled.value && !authStore.isSimpleMode) {
    void subscriptionStore.fetchActiveSubscriptions(true).catch(() => undefined)
  }
}

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString()
}

function formatCompact(value: number): string {
  const n = Number(value || 0)
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

function formatSeconds(ms: number): string {
  const n = Number(ms || 0)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${Math.round(n)}ms`
}

onMounted(() => {
  void refreshBatchImageAccess()
  refreshAll()
})
</script>
