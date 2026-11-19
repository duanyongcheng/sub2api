<template>
  <AppLayout>
    <div v-if="loading && !stats" class="flex items-center justify-center py-16">
      <LoadingSpinner size="lg" />
    </div>

    <div v-else class="flex flex-col gap-3.5">
      <!-- Slim runtime status & utility actions row (AppHeader owns page title) -->
      <div class="flex flex-wrap items-center justify-between gap-2.5">
        <div class="flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
          <span
            class="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface px-2.5 py-0.5 font-medium tabular-nums text-ink-2"
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              :class="stats?.stats_stale ? 'bg-amber-500' : 'bg-emerald-500'"
              aria-hidden="true"
            />
            <span v-if="uptimeLabel">{{ t('admin.dashboard.overview.uptimeLabel', { value: uptimeLabel }) }}</span>
            <span v-if="uptimeLabel && lastUpdatedLabel" aria-hidden="true" class="text-edge-strong">·</span>
            <span>{{ lastUpdatedLabel }}</span>
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <ReportExportMenu
            :label="t('admin.dashboard.overview.export.action')"
            :title="t('admin.dashboard.overview.export.hint')"
            :busy="exporting"
            data-testid="dashboard-export"
            @export="exportReport"
          />
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="loading || chartsLoading"
            @click="refresh"
          >
            <Icon name="refresh" size="sm" :class="loading || chartsLoading ? 'animate-spin' : ''" />
            {{ t('common.refresh') }}
          </button>
        </div>
      </div>

      <!-- Band 1: Live operational pulse & account pool availability + attached triage -->
      <AdminLivePulseStrip
        :stats="stats"
        :groups="groupStats"
        :is-simple="isSimpleMode"
        @refresh="refresh"
      />

      <!-- Band 2: Selected-window toolbar + 2:1 traffic trend & provider rail -->
      <div class="flex flex-col gap-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-[13px] font-bold text-ink">
              {{ t('admin.dashboard.overview.periodTrafficTitle') }}
            </h2>
            <span class="rounded-md bg-surface-3 px-2 py-0.5 text-[11.5px] font-medium tabular-nums text-ink-2">
              {{ startDate }} ~ {{ endDate }}
            </span>
            <span class="text-[12px] tabular-nums text-ink-2">
              {{ t('admin.dashboard.overview.periodRequestsTotal', { value: formatCompact(rangeRequests) }) }}
            </span>
          </div>

          <div class="flex flex-wrap items-center gap-2">
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

            <DateRangePicker
              v-model:start-date="startDate"
              v-model:end-date="endDate"
              compact
              display-mode="range"
              @change="onRangeChange"
            />

            <div class="seg" role="group" :aria-label="t('admin.dashboard.overview.periodTrafficTitle')">
              <button
                v-for="option in trendModeOptions"
                :key="option.value"
                type="button"
                :class="{ on: trendMode === option.value }"
                :aria-pressed="trendMode === option.value"
                @click="trendMode = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>

        <section class="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1.95fr)_minmax(0,1fr)]">
          <AdminTrafficTrend
            :trend="trendData"
            :mode="trendMode"
            :granularity="granularity"
            :loading="chartsLoading"
          />
          <PlatformShare :models="modelStats" :is-simple="isSimpleMode" />
        </section>
      </div>

      <!-- Band 3: Subordinated economics summary header + unified group margin & top-12 users ledger -->
      <section class="overflow-hidden rounded-card border border-edge bg-surface shadow-xs">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-edge bg-surface-2 px-4 py-2.5">
          <h2 class="text-[13px] font-bold text-ink">
            {{
              isSimpleMode
                ? t('admin.dashboard.overview.economicsSimpleTitle')
                : t('admin.dashboard.overview.economicsBandTitle')
            }}
          </h2>

          <div
            v-if="!isSimpleMode"
            class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] tabular-nums text-ink-2"
          >
            <span>
              {{ t('admin.dashboard.overview.economicsRevenue') }}
              <strong class="ml-1 font-bold text-ink">${{ formatMoney(actualRevenue) }}</strong>
            </span>
            <span>
              {{ t('admin.dashboard.overview.economicsCost') }}
              <strong class="ml-1 font-bold text-ink">
                {{ hasKnownAccountCost ? `$${formatMoney(accountCost)}` : '—' }}
              </strong>
            </span>
            <span>
              {{ t('admin.dashboard.overview.economicsMargin') }}
              <strong class="ml-1 font-bold" :class="marginToneClass">
                {{ marginPercent === null ? '—' : `${marginPercent.toFixed(1)}%` }}
              </strong>
            </span>
            <span>
              {{ t('admin.dashboard.overview.economicsNegativeCount') }}
              <strong
                class="ml-1 font-bold"
                :class="negativeGroupCount > 0 ? 'text-red-700 dark:text-red-300' : 'text-ink'"
              >
                {{ negativeGroupCount }}
              </strong>
            </span>
          </div>
        </div>

        <div
          class="grid grid-cols-1 divide-y divide-edge"
          :class="!isSimpleMode ? 'xl:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] xl:divide-x xl:divide-y-0' : ''"
        >
          <!-- Left: Group margin & pricing risk ledger -->
          <div v-if="!isSimpleMode" class="flex min-w-0 flex-col">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-4 py-2.5">
              <div class="min-w-0">
                <h3 class="text-[13px] font-semibold text-ink">
                  {{ t('admin.dashboard.overview.groupTable') }}
                </h3>
                <p class="text-[11px] text-ink-2">{{ t('admin.dashboard.overview.groupMarginHint') }}</p>
              </div>
              <div class="seg" role="group">
                <button
                  type="button"
                  :class="{ on: groupSort === 'risk' }"
                  :aria-pressed="groupSort === 'risk'"
                  @click="groupSort = 'risk'"
                >
                  {{ t('admin.dashboard.overview.sortRiskFirst') }}
                </button>
                <button
                  type="button"
                  :class="{ on: groupSort === 'revenue' }"
                  :aria-pressed="groupSort === 'revenue'"
                  @click="groupSort = 'revenue'"
                >
                  {{ t('admin.dashboard.overview.sortRevenueFirst') }}
                </button>
              </div>
            </div>

            <!-- Mobile stacked ledger (keeps risk badges & margin visible at 390px without clipping) -->
            <div class="divide-y divide-edge/70 md:hidden">
              <div v-if="groupRows.length === 0" class="px-4 py-8 text-center text-body text-ink-2">
                {{ t('admin.dashboard.noDataAvailable') }}
              </div>
              <div
                v-for="row in groupRows"
                :key="row.id"
                class="cursor-pointer px-3.5 py-2.5 transition-colors hover:bg-surface-2"
                @click="goToGroups()"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-1.5">
                    <span class="truncate text-[12.5px] font-semibold text-ink" :title="row.name">
                      {{ row.name }}
                    </span>
                    <span
                      v-if="row.risk"
                      class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                      :class="
                        row.margin !== null && row.margin < 0
                          ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                          : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                      "
                    >
                      {{ row.risk }}
                    </span>
                  </div>
                  <span class="shrink-0 text-[12.5px] font-bold tabular-nums" :class="row.marginClass">
                    {{ row.margin === null ? '—' : `${row.margin.toFixed(1)}%` }}
                  </span>
                </div>
                <div class="mt-1.5 grid grid-cols-3 gap-2 text-[11px] tabular-nums text-ink-2">
                  <div>
                    <span>{{ t('admin.dashboard.overview.revenue') }}</span>
                    <span class="ml-1 font-semibold text-ink">{{ formatGroupMoney(row.revenue) }}</span>
                  </div>
                  <div>
                    <span>{{ t('admin.dashboard.overview.upstreamCost') }}</span>
                    <span class="ml-1">{{ row.cost === null ? '—' : formatGroupMoney(row.cost) }}</span>
                  </div>
                  <div class="text-right">
                    <span>{{ t('admin.dashboard.requests') }}</span>
                    <span class="ml-1">{{ formatCompact(row.requests) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Desktop / tablet full table -->
            <div class="hidden overflow-x-auto md:block">
              <table class="w-full text-data">
                <thead>
                  <tr class="border-b border-edge bg-surface-2 text-[11px] font-semibold text-ink-2">
                    <th class="px-4 py-2 text-left font-semibold">{{ t('admin.dashboard.overview.group') }}</th>
                    <th class="px-3 py-2 text-right font-semibold">{{ t('admin.dashboard.overview.revenue') }}</th>
                    <th class="px-3 py-2 text-right font-semibold">{{ t('admin.dashboard.overview.upstreamCost') }}</th>
                    <th class="px-3 py-2 text-right font-semibold">{{ t('admin.dashboard.overview.grossMargin') }}</th>
                    <th class="px-3 py-2 text-right font-semibold">{{ t('admin.dashboard.requests') }}</th>
                    <th class="px-4 py-2 text-right font-semibold">{{ t('admin.dashboard.overview.marginRisk') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="groupRows.length === 0">
                    <td colspan="6" class="px-4 py-8 text-center text-body text-ink-2">
                      {{ t('admin.dashboard.noDataAvailable') }}
                    </td>
                  </tr>
                  <tr
                    v-for="row in groupRows"
                    :key="row.id"
                    class="cursor-pointer border-b border-edge/70 transition-colors last:border-b-0 hover:bg-surface-2"
                    @click="goToGroups()"
                  >
                    <td class="whitespace-nowrap px-4 py-2">
                      <span class="block max-w-[180px] truncate font-semibold text-ink" :title="row.name">
                        {{ row.name }}
                      </span>
                    </td>
                    <td class="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-ink">
                      {{ formatGroupMoney(row.revenue) }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink-2">
                      {{ row.cost === null ? '—' : formatGroupMoney(row.cost) }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums" :class="row.marginClass">
                      {{ row.margin === null ? '—' : `${row.margin.toFixed(1)}%` }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink-2">
                      {{ formatCompact(row.requests) }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-2 text-right">
                      <span
                        v-if="row.risk"
                        class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        :class="
                          row.margin !== null && row.margin < 0
                            ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                            : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                        "
                      >
                        {{ row.risk }}
                      </span>
                      <span v-else class="text-[11.5px] text-ink-2">{{ t('admin.dashboard.overview.riskNone') }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Right: Top-12 users multi-line trend & clickable ranking -->
          <TopUsersTrend
            embedded
            :title="t('admin.dashboard.overview.topUsersHeader', { limit: 12 })"
            :hint="t('admin.dashboard.overview.topUsersClickHint')"
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
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
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
import Icon from '@/components/icons/Icon.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import ReportExportMenu from '@/components/common/ReportExportMenu.vue'
import AdminLivePulseStrip from '@/components/admin/dashboard/AdminLivePulseStrip.vue'
import AdminTrafficTrend, { type AdminTrendMode } from '@/components/admin/dashboard/AdminTrafficTrend.vue'
import PlatformShare from '@/components/admin/dashboard/PlatformShare.vue'
import TopUsersTrend from '@/components/admin/dashboard/TopUsersTrend.vue'
import { reportFileStem, downloadReport, type ExportFormat } from '@/utils/reportExport'
import { buildDashboardWorkbook, type DashboardReportLabels } from '@/features/admin-dashboard/dashboardReport'

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()

const isSimpleMode = computed(() => authStore.isSimpleMode)

const stats = ref<DashboardStats | null>(null)
const loading = ref(false)
const chartsLoading = ref(false)
const userTrendLoading = ref(false)

const trendData = ref<TrendDataPoint[]>([])
const modelStats = ref<ModelStat[]>([])
const groupStats = ref<GroupStat[]>([])
const userTrend = ref<UserUsageTrendPoint[] | null>(null)
const rankingItems = ref<UserSpendingRankingItem[]>([])
const userTrendMetric = ref<'tokens' | 'actual_cost'>('actual_cost')
const trendMode = ref<AdminTrendMode>('requests')
const groupSort = ref<'risk' | 'revenue'>('risk')
const lastLoadedAt = ref<string>('')

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

const trendModeOptions = computed(() => {
  const options: Array<{ value: AdminTrendMode; label: string }> = [
    { value: 'requests', label: t('admin.dashboard.overview.trendModeRequests') },
    { value: 'tokens', label: t('admin.dashboard.overview.trendModeTokens') }
  ]
  if (!isSimpleMode.value) {
    options.push({ value: 'revenue', label: t('admin.dashboard.overview.trendModeRevenue') })
  }
  return options
})

const uptimeLabel = computed(() => {
  const seconds = Number(stats.value?.uptime ?? 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h`
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${Math.max(1, minutes)}m`
})

const lastUpdatedLabel = computed(() => {
  const source = stats.value?.stats_updated_at || lastLoadedAt.value
  if (!source) return t('admin.dashboard.overview.gmt', { time: '—' })
  const d = new Date(source)
  const formatted = Number.isNaN(d.getTime())
    ? source
    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  return t('admin.dashboard.overview.gmt', { time: formatted })
})

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

const isTodayRange = computed(() => {
  const todayStr = formatLocalDate(new Date())
  return startDate.value === todayStr && endDate.value === todayStr
})

const hasGroupAccountCost = computed(() =>
  groupStats.value.some((group) => group.account_cost !== undefined && group.account_cost !== null)
)

const hasKnownAccountCost = computed(
  () =>
    hasGroupAccountCost.value ||
    (isTodayRange.value &&
      stats.value?.today_account_cost !== undefined &&
      stats.value?.today_account_cost !== null)
)

const accountCost = computed(() => {
  if (hasGroupAccountCost.value) {
    return groupStats.value.reduce((sum, group) => sum + Number(group.account_cost || 0), 0)
  }
  if (isTodayRange.value) {
    return Number(stats.value?.today_account_cost || 0)
  }
  return 0
})

const marginPercent = computed<number | null>(() => {
  const revenue = actualRevenue.value
  if (revenue <= 0 || !hasKnownAccountCost.value) return null
  return ((revenue - accountCost.value) / revenue) * 100
})

const marginToneClass = computed(() => {
  if (marginPercent.value === null) return 'text-ink-2'
  if (marginPercent.value < 0) return 'text-red-700 dark:text-red-300'
  if (marginPercent.value < 20) return 'text-amber-700 dark:text-amber-300'
  return 'text-emerald-700 dark:text-emerald-300'
})

const negativeGroupCount = computed(() =>
  groupStats.value.filter((g) => {
    const rev = Number(g.actual_cost || 0)
    const cost = g.account_cost !== undefined && g.account_cost !== null ? Number(g.account_cost) : null
    return rev > 0 && cost !== null && rev - cost < 0
  }).length
)

const groupRows = computed(() => {
  const mapped = [...groupStats.value].map((group) => {
    const revenue = Number(group.actual_cost || 0)
    const hasCost = group.account_cost !== undefined && group.account_cost !== null
    const cost = hasCost ? Number(group.account_cost) : null
    const margin = revenue > 0 && cost !== null ? ((revenue - cost) / revenue) * 100 : null
    let risk = ''
    let riskRank = 2
    if (margin !== null && margin < 0) {
      risk = t('admin.dashboard.overview.riskNegativeMargin')
      riskRank = 0
    } else if (revenue > 0 && margin !== null && margin < 10) {
      risk = t('admin.dashboard.overview.riskLowMultiplier')
      riskRank = 1
    }
    const marginClass =
      margin === null
        ? 'text-ink-2'
        : margin < 0
          ? 'text-red-700 dark:text-red-300'
          : margin < 20
            ? 'text-amber-700 dark:text-amber-300'
            : 'text-emerald-700 dark:text-emerald-300'

    return {
      id: group.group_id,
      name: group.group_name,
      revenue,
      cost,
      margin,
      marginClass,
      requests: Number(group.requests || 0),
      risk,
      riskRank
    }
  })

  if (groupSort.value === 'risk') {
    mapped.sort((a, b) => a.riskRank - b.riskRank || b.revenue - a.revenue)
  } else {
    mapped.sort((a, b) => b.revenue - a.revenue)
  }

  return mapped.slice(0, 8)
})

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

function onRangeChange(payload: { startDate: string; endDate: string; preset: string | null }) {
  selectedPreset.value = null
  startDate.value = payload.startDate
  endDate.value = payload.endDate
  const span = (new Date(payload.endDate).getTime() - new Date(payload.startDate).getTime()) / 86_400_000
  granularity.value = span <= 1 ? 'hour' : 'day'
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
    lastLoadedAt.value = new Date().toISOString()
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
    if (seq !== usersTrendLoadSeq) return
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
  userTrendMetric.value = metric
  void loadUsersTrend(metric)
}

function goToGroups() {
  void router.push('/admin/groups')
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
      summarySheet: p('summarySheet'),
      trendSheet: p('trendSheet'),
      groupsSheet: p('groupsSheet'),
      modelsSheet: p('modelsSheet'),
      header: {
        item: p('header.item'),
        value: p('header.value'),
        basis: p('header.basis'),
        period: p('header.period'),
        requests: p('header.requests'),
        inputTokens: p('header.inputTokens'),
        outputTokens: p('header.outputTokens'),
        cacheRead: p('header.cacheRead'),
        cacheCreation: p('header.cacheCreation'),
        totalTokens: p('header.totalTokens'),
        standardCost: p('header.standardCost'),
        actualCost: p('header.actualCost'),
        group: p('header.group'),
        groupId: p('header.groupId'),
        model: p('header.model'),
        accountCost: p('header.accountCost'),
        margin: p('header.margin'),
        marginRate: p('row.marginRate')
      },
      row: {
        period: p('row.period'),
        requests: p('row.requests'),
        standardRevenue: p('row.standardRevenue'),
        actualRevenue: p('row.actualRevenue'),
        upstreamCost: p('row.upstreamCost'),
        grossMargin: p('row.grossMargin'),
        marginRate: p('row.marginRate')
      },
      basis: {
        actualRevenue: p('basis.actualRevenue'),
        standardRevenue: p('basis.standardRevenue'),
        upstreamCost: p('basis.upstreamCost'),
        grossMargin: p('basis.grossMargin'),
        marginRate: p('basis.marginRate')
      }
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
        margin: marginPercent.value
      },
      trend: trendData.value,
      groups: groupStats.value,
      models: modelStats.value,
      labels
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
  if (n >= 100_000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatGroupMoney(value: number): string {
  const n = Number(value || 0)
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 100_000) return `$${(n / 1000).toFixed(1)}k`
  if (n >= 1) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `$${n.toFixed(3)}`
}

function formatCompact(value: number): string {
  const n = Number(value || 0)
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

onMounted(() => {
  void loadSnapshot(true)
  void loadUsersTrend()
  void loadRanking()
})
</script>
