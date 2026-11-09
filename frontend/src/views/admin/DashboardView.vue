<template>
  <AppLayout>
    <div v-if="loading && !stats" class="flex items-center justify-center py-16">
      <LoadingSpinner size="lg" />
    </div>

    <template v-else>
      <PageHeader
        :title="t('admin.dashboard.overview.title')"
        :description="t('admin.dashboard.overview.subtitle')"
      >
        <template #actions>
          <div class="seg" role="group" :aria-label="t('admin.dashboard.timeRange')">
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
          <ReportExportMenu
            :label="t('admin.dashboard.overview.export.action')"
            :title="t('admin.dashboard.overview.export.hint')"
            :busy="exporting"
            data-testid="dashboard-export"
            @export="exportReport"
          />
          <button type="button" class="btn btn-secondary" :disabled="loading" @click="refresh">
            <Icon name="refresh" size="sm" :class="loading ? 'animate-spin' : ''" />
            {{ t('common.refresh') }}
          </button>
        </template>
      </PageHeader>

      <div class="mt-4 flex flex-col gap-4">
        <!-- What needs a decision today goes above the numbers -->
        <ActionStrip
          v-if="stripItems.length > 0"
          :title="t('admin.dashboard.overview.actionTitle')"
          :count="stripItems.length"
          :items="stripItems"
          :meta="lastUpdatedLabel"
          :max-items="3"
        />

        <!-- KPI band -->
        <section class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            :label="t('admin.dashboard.overview.netRevenue')"
            :value="`$${formatMoney(actualRevenue)}`"
            icon="dollar"
            :sparkline="spark.actual"
            spark-color="#0d9488"
          >
            <span class="trend" :class="revenueChange >= 0 ? 'trend-up' : 'trend-down'">
              <Icon :name="revenueChange >= 0 ? 'arrowUp' : 'arrowDown'" size="xs" :stroke-width="2.4" />
              {{ Math.abs(revenueChange).toFixed(1) }}%
            </span>
            <span class="truncate">{{ t('admin.dashboard.overview.vsPrev') }}</span>
          </KpiCard>

          <KpiCard
            :label="t('admin.dashboard.overview.upstreamCost')"
            :value="`$${formatMoney(accountCost)}`"
            :tone="costChange > revenueChange ? 'warn' : 'default'"
            icon="server"
            :sparkline="spark.cost"
            spark-color="#d97706"
          >
            <span class="trend" :class="costChange >= 0 ? 'trend-up' : 'trend-down'">
              <Icon :name="costChange >= 0 ? 'arrowUp' : 'arrowDown'" size="xs" :stroke-width="2.4" />
              {{ Math.abs(costChange).toFixed(1) }}%
            </span>
            <span class="truncate">{{ t('admin.dashboard.overview.vsPrev') }}</span>
          </KpiCard>

          <KpiCard
            :label="t('admin.dashboard.overview.grossMargin')"
            :value="marginPercent === null ? '—' : marginPercent.toFixed(1)"
            unit="%"
            :tone="marginPercent !== null && marginPercent < 0 ? 'bad' : marginPercent !== null && marginPercent < 20 ? 'warn' : 'default'"
            icon="trendingUp"
            :sparkline="spark.margin"
            spark-color="#94a3b8"
          >
            <span class="truncate">
              {{ t('admin.dashboard.overview.revenue') }} ${{ formatMoney(actualRevenue) }} −
              {{ t('admin.dashboard.overview.cost') }} ${{ formatMoney(accountCost) }}
            </span>
          </KpiCard>

          <KpiCard
            :label="t('admin.dashboard.overview.requestsAndSuccess')"
            :value="formatCompact(rangeRequests)"
            :unit="`/ ${formatCompact(stats?.total_requests ?? 0)}`"
            icon="chart"
            :sparkline="spark.requests"
            spark-color="#94a3b8"
          >
            <span class="truncate">{{ t('admin.dashboard.overview.activeUsers', { value: formatNumber(stats?.active_users ?? 0) }) }}</span>
          </KpiCard>
        </section>

        <!-- Main two-column layout -->
        <section class="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.72fr)_minmax(0,1fr)]">
          <div class="flex min-w-0 flex-col gap-4">
            <RevenueVsCost :trend="trendData" :groups="groupStats" :loading="chartsLoading" />
          </div>

          <div class="flex min-w-0 flex-col gap-4">
            <TodoList :tasks="todoTasks" />
            <PlatformShare :models="modelStats" />
            <section class="card">
              <div class="card-hd">
                <h3 class="text-sm font-semibold text-ink">{{ t('admin.dashboard.overview.newUsers') }}</h3>
                <span class="pill" :class="newUserDelta >= 0 ? 'pill-ok' : 'pill-neutral'">
                  {{ newUserDelta >= 0 ? '+' : '' }}{{ newUserDelta.toFixed(1) }}%
                </span>
              </div>
              <div class="card-bd">
                <div class="flex items-baseline gap-2">
                  <span class="text-[26px] font-bold tabular-nums tracking-[-0.03em] text-ink">{{ stats?.today_new_users ?? 0 }}</span>
                  <span class="text-meta text-ink-3">{{ t('admin.dashboard.overview.newUsersHint', { value: stats?.total_users ?? 0 }) }}</span>
                </div>
                <div class="mt-2.5 grid grid-cols-2 gap-2 text-meta text-ink-3">
                  <span>{{ t('admin.dashboard.overview.totalLines', { value: formatNumber(stats?.total_users ?? 0) }) }}</span>
                  <span class="text-right">{{ t('admin.dashboard.overview.requests', { value: formatCompact(stats?.total_requests ?? 0) }) }}</span>
                </div>
              </div>
            </section>

            <section class="card bg-surface-2">
              <div class="p-4">
                <div class="flex items-center gap-2 text-[12.6px] font-semibold text-ink">
                  <Icon name="bolt" size="sm" class="text-primary-600" />
                  {{ t('admin.dashboard.overview.quickEntry') }}
                </div>
                <div class="mt-2.5 flex flex-wrap gap-2">
                  <router-link to="/admin/accounts" class="btn btn-secondary btn-sm">{{ t('admin.dashboard.overview.quickNewAccount') }}</router-link>
                  <router-link to="/admin/groups" class="btn btn-secondary btn-sm">{{ t('admin.dashboard.overview.quickNewGroup') }}</router-link>
                  <router-link to="/admin/redeem" class="btn btn-secondary btn-sm">{{ t('admin.dashboard.overview.quickRedeem') }}</router-link>
                  <router-link to="/admin/announcements" class="btn btn-secondary btn-sm">{{ t('admin.dashboard.overview.quickAnnouncement') }}</router-link>
                  <router-link to="/admin/usage" class="btn btn-secondary btn-sm">{{ t('admin.dashboard.overview.quickUsage') }}</router-link>
                </div>
              </div>
            </section>
          </div>
        </section>

        <!-- Heaviest users -->
        <TopUsersTrend
          :title="t('admin.dashboard.recentUsage')"
          :trend="userTrend"
          :ranking="rankingItems"
          :metric="userTrendMetric"
          :loading="userTrendLoading"
          :labels="{ spending: t('admin.dashboard.actualSpending'), tokens: t('admin.dashboard.tokens') }"
          :empty-text="t('admin.dashboard.noDataAvailable')"
          @update:metric="setUserTrendMetric"
          @ranking-click="goToUserUsage"
        />
      </div>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type {
  DashboardStats,
  TrendDataPoint,
  ModelStat,
  GroupStat,
  UserUsageTrendPoint,
  UserSpendingRankingItem
} from '@/types'
import AppLayout from '@/components/layout/AppLayout.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import KpiCard from '@/components/common/KpiCard.vue'
import ActionStrip from '@/components/common/ActionStrip.vue'
import Icon from '@/components/icons/Icon.vue'
import RevenueVsCost from '@/components/admin/dashboard/RevenueVsCost.vue'
import TodoList from '@/components/admin/dashboard/TodoList.vue'
import PlatformShare from '@/components/admin/dashboard/PlatformShare.vue'
import TopUsersTrend from '@/components/admin/dashboard/TopUsersTrend.vue'
import ReportExportMenu from '@/components/common/ReportExportMenu.vue'
import { reportFileStem, downloadReport, type ExportFormat } from '@/utils/reportExport'
import { buildDashboardWorkbook, type DashboardReportLabels } from '@/features/admin-dashboard/dashboardReport'
import type { TodoTask } from '@/components/admin/dashboard/TodoList.types'
import type { ActionStripItem } from '@/components/common/ActionStrip.vue'

/**
 * Admin DashboardView — the operations overview.
 *
 * Reorganised around "abnormal first": the action strip and to-do rail sit
 * above / beside the numbers, because an admin opens this page to answer
 * "what needs a decision" rather than "what happened". The revenue-vs-cost
 * chart carries the margin table underneath it so pricing problems are visible
 * in the same glance as the revenue.
 */
const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()

const stats = ref<DashboardStats | null>(null)
const loading = ref(false)
const chartsLoading = ref(false)
const userTrendLoading = ref(false)

const trendData = ref<TrendDataPoint[]>([])
const modelStats = ref<ModelStat[]>([])
const groupStats = ref<GroupStat[]>([])
// `null` = not loaded yet; `[]` = loaded with no rows.
const userTrend = ref<UserUsageTrendPoint[] | null>(null)
const rankingItems = ref<UserSpendingRankingItem[]>([])
const userTrendMetric = ref<'tokens' | 'actual_cost'>('actual_cost')

let chartLoadSeq = 0
let usersTrendLoadSeq = 0
let rankingLoadSeq = 0

const today = new Date()
const startDate = ref(formatLocalDate(new Date(today.getTime() - 6 * 86_400_000)))
const endDate = ref(formatLocalDate(today))
const granularity = ref<'day' | 'hour'>('day')
const selectedPreset = ref<number | null>(7)

const presets = computed(() => [
  { days: 1, label: t('admin.dashboard.overview.presetToday') },
  { days: 7, label: t('admin.dashboard.overview.presetLast7') },
  { days: 30, label: t('admin.dashboard.overview.presetLast30') }
])

const lastUpdatedLabel = computed(() =>
  t('admin.dashboard.overview.gmt', { time: new Date().toLocaleTimeString(undefined, { hour12: false }) })
)

// ---- Totals for the selected range ----
const rangeTotals = computed(() => {
  let actual = 0
  let standard = 0
  let requests = 0
  for (const point of trendData.value) {
    actual += Number(point.actual_cost || 0)
    standard += Number(point.cost || 0)
    requests += Number(point.requests || 0)
  }
  return { actual, standard, requests }
})

const actualRevenue = computed(() => rangeTotals.value.actual)
const rangeRequests = computed(() => rangeTotals.value.requests)

// Account cost is only available per group (or on the stats payload for today).
const accountCost = computed(() => {
  const fromGroups = groupStats.value.reduce((sum, group) => sum + Number(group.account_cost || 0), 0)
  if (fromGroups > 0) return fromGroups
  return Number(stats.value?.today_account_cost || 0)
})

const marginPercent = computed<number | null>(() => {
  const revenue = actualRevenue.value
  if (revenue <= 0) return null
  return ((revenue - accountCost.value) / revenue) * 100
})

// ---- Sparklines (second half of the range vs first half) ----
const spark = computed(() => {
  const points = trendData.value
  return {
    actual: points.map((p) => Number(p.actual_cost || 0)),
    cost: groupStats.value.length ? points.map((p) => Number(p.actual_cost || 0) * (accountCost.value / Math.max(1, actualRevenue.value))) : [],
    margin: points.map((p) => Number(p.actual_cost || 0) - Number(p.cost || 0)),
    requests: points.map((p) => Number(p.requests || 0))
  }
})

const halfChange = (values: number[]): number => {
  if (values.length < 2) return 0
  const mid = Math.floor(values.length / 2)
  const first = values.slice(0, mid).reduce((a, b) => a + b, 0)
  const second = values.slice(mid).reduce((a, b) => a + b, 0)
  if (first <= 0) return second > 0 ? 100 : 0
  return ((second - first) / first) * 100
}

const revenueChange = computed(() => halfChange(spark.value.actual))
const costChange = computed(() => halfChange(spark.value.cost))
const newUserDelta = computed(() => {
  const today = Number(stats.value?.today_new_users || 0)
  const total = Number(stats.value?.total_users || 0)
  if (total <= 0) return 0
  return (today / total) * 100
})

// ---- To-do rail ----
const todoTasks = computed<TodoTask[]>(() => {
  const tasks: TodoTask[] = []
  const errorAccounts = Number(stats.value?.error_accounts || 0)
  const rateLimited = Number(stats.value?.ratelimit_accounts || 0)
  const overloaded = Number(stats.value?.overload_accounts || 0)
  const unhealthyAccounts = errorAccounts + rateLimited + overloaded

  if (unhealthyAccounts > 0) {
    tasks.push({
      key: 'accounts',
      title: t('admin.dashboard.overview.accountsRunningLow'),
      hint: t('admin.dashboard.overview.accountHint', { error: errorAccounts, limit: rateLimited, overload: overloaded }),
      count: unhealthyAccounts,
      to: '/admin/accounts',
      icon: 'server',
      tone: errorAccounts > 0 ? 'bad' : 'warn'
    })
  }

  const negativeMarginGroups = groupStats.value.filter((g) => {
    const revenue = Number(g.actual_cost || 0)
    const cost = Number(g.account_cost || 0)
    return revenue > 0 && revenue - cost < 0
  })
  if (negativeMarginGroups.length > 0) {
    tasks.push({
      key: 'margin',
      title: t('admin.dashboard.overview.riskNegativeMargin'),
      hint: negativeMarginGroups.map((g) => g.group_name).slice(0, 2).join(' · '),
      count: negativeMarginGroups.length,
      to: '/admin/groups',
      icon: 'trendingUp',
      tone: 'bad'
    })
  }

  return tasks
})

// ---- Action strip ----
const stripItems = computed<ActionStripItem[]>(() =>
  todoTasks.value.map((task) => ({ label: `${task.title} · ${task.count}`, to: task.to, hint: task.hint }))
)

// ---- Data loading ----
function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function applyPreset(days: number) {
  selectedPreset.value = days
  const now = new Date()
  startDate.value = formatLocalDate(new Date(now.getTime() - (days - 1) * 86_400_000))
  endDate.value = formatLocalDate(now)
  granularity.value = days === 1 ? 'hour' : 'day'
  void loadSnapshot(false)
  void loadUsersTrend()
  void loadRanking()
}

async function loadSnapshot(includeStats: boolean) {
  const seq = ++chartLoadSeq
  if (includeStats && !stats.value) loading.value = true
  chartsLoading.value = true
  try {
    const response = await adminAPI.dashboard.getSnapshotV2({
      start_date: startDate.value,
      end_date: endDate.value,
      granularity: granularity.value,
      include_stats: includeStats,
      include_trend: true,
      include_model_stats: true,
      include_group_stats: true,
      include_users_trend: false
    })
    if (seq !== chartLoadSeq) return
    if (includeStats && response.stats) stats.value = response.stats
    trendData.value = response.trend || []
    modelStats.value = response.models || []
    groupStats.value = response.groups || []
  } catch (error) {
    if (seq !== chartLoadSeq) return
    appStore.showError(t('admin.dashboard.failedToLoad'))
    console.error('Error loading dashboard snapshot:', error)
  } finally {
    if (seq === chartLoadSeq) {
      loading.value = false
      chartsLoading.value = false
    }
  }
}

async function loadUsersTrend(metric: 'tokens' | 'actual_cost' = userTrendMetric.value) {
  // Bump the sequence *before* awaiting: this counter alone decides whether a
  // late response is still wanted.
  const seq = ++usersTrendLoadSeq
  userTrendLoading.value = true
  try {
    const response = await adminAPI.dashboard.getUserUsageTrend({
      start_date: startDate.value,
      end_date: endDate.value,
      granularity: granularity.value,
      limit: 12,
      metric
    })
    // The metric may have changed while this request was in flight; dropping
    // stale responses keeps the chart in sync with the selected tab.
    if (seq !== usersTrendLoadSeq) return
    userTrendLoading.value = false
    userTrend.value = response.trend || []
  } catch (error) {
    if (seq !== usersTrendLoadSeq) return
    console.error('Error loading users trend:', error)
    userTrend.value = []
  } finally {
    if (seq === usersTrendLoadSeq) userTrendLoading.value = false
  }
}

async function loadRanking() {
  const seq = ++rankingLoadSeq
  try {
    const response = await adminAPI.dashboard.getUserSpendingRanking({
      start_date: startDate.value,
      end_date: endDate.value,
      limit: 12
    })
    if (seq !== rankingLoadSeq) return
    rankingItems.value = response.ranking || []
  } catch (error) {
    if (seq !== rankingLoadSeq) return
    console.error('Error loading user spending ranking:', error)
    rankingItems.value = []
  }
}

function setUserTrendMetric(metric: 'tokens' | 'actual_cost') {
  if (userTrendMetric.value === metric) return
  // Commit the metric only once the new request has been issued: the loader
  // bumps the sequence counter synchronously, so the older response is already
  // stale by the time this function returns.
  // Clear the previous series *after* the new request has been issued, so the
  // metric and the sequence counter move in the same tick and the in-flight
  // response for the old metric is discarded on arrival.
  void loadUsersTrend(metric)
}

function goToUserUsage(item: UserSpendingRankingItem) {
  void router.push({
    path: '/admin/usage',
    query: {
      user_id: String(item.user_id),
      start_date: startDate.value,
      end_date: endDate.value
    }
  })
}

/**
 * 导出报表（原型 03）：导出当前时间范围的四种视图，口径写进表头。
 * 未知值写「数据不足」而不是 0，避免离线看表时把缺失当成真实数字。
 */
const exporting = ref(false)
async function exportReport(format: ExportFormat) {
  if (exporting.value) return
  if (!trendData.value.length && !groupStats.value.length && !modelStats.value.length) {
    appStore.showWarning(t('reportExport.empty'))
    return
  }
  exporting.value = true
  try {
    const p = (key: string) => t(`admin.dashboard.overview.export.${key}`)
    const labels: DashboardReportLabels = {
      summarySheet: p('summarySheet'), trendSheet: p('trendSheet'),
      groupsSheet: p('groupsSheet'), modelsSheet: p('modelsSheet'),
      header: {
        item: p('header.item'), value: p('header.value'), basis: p('header.basis'),
        period: p('header.period'), requests: p('header.requests'),
        inputTokens: p('header.inputTokens'), outputTokens: p('header.outputTokens'),
        cacheRead: p('header.cacheRead'), cacheCreation: p('header.cacheCreation'), totalTokens: p('header.totalTokens'),
        standardCost: p('header.standardCost'), actualCost: p('header.actualCost'),
        group: p('header.group'), groupId: p('header.groupId'), model: p('header.model'),
        accountCost: p('header.accountCost'), margin: p('header.margin'), marginRate: p('row.marginRate'),
      },
      row: {
        period: p('row.period'), requests: p('row.requests'),
        standardRevenue: p('row.standardRevenue'), actualRevenue: p('row.actualRevenue'),
        upstreamCost: p('row.upstreamCost'), grossMargin: p('row.grossMargin'), marginRate: p('row.marginRate'),
      },
      basis: {
        actualRevenue: p('basis.actualRevenue'), standardRevenue: p('basis.standardRevenue'),
        upstreamCost: p('basis.upstreamCost'), grossMargin: p('basis.grossMargin'), marginRate: p('basis.marginRate'),
      },
    }
    const sheets = buildDashboardWorkbook({
      startDate: startDate.value,
      endDate: endDate.value,
      unavailable: t('channelMonitorV2.operations.insufficientShort'),
      totals: {
        requests: rangeRequests.value,
        standard: rangeTotals.value.standard,
        actual: actualRevenue.value,
        accountCost: accountCost.value,
        margin: marginPercent.value,
      },
      trend: trendData.value,
      groups: groupStats.value,
      models: modelStats.value,
      labels,
    })
    await downloadReport({ sheets, format, fileName: reportFileStem('dashboard', startDate.value, endDate.value) })
    appStore.showSuccess(t('reportExport.success'))
  } catch (error) {
    console.error('Failed to export dashboard report:', error)
    appStore.showError(t('reportExport.failed'))
  } finally {
    exporting.value = false
  }
}

function refresh() {
  void loadSnapshot(true)
  void loadUsersTrend()
  void loadRanking()
}

function formatMoney(value: number): string {
  const n = Number(value || 0)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`
  return n.toFixed(2)
}

function formatCompact(value: number): string {
  const n = Number(value || 0)
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString()
}

onMounted(() => {
  void loadSnapshot(true)
  void loadUsersTrend()
  void loadRanking()
})
</script>
