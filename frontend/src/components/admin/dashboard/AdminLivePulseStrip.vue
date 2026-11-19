<template>
  <section
    class="overflow-hidden rounded-card border border-edge bg-surface shadow-xs"
    :aria-label="t('admin.dashboard.overview.liveBandAria')"
  >
    <!-- 6-cell hairline live telemetry strip -->
    <div
      class="grid grid-cols-2 divide-y divide-edge sm:grid-cols-3 xl:grid-cols-[minmax(0,2.2fr)_repeat(5,minmax(0,1fr))] xl:divide-y-0 xl:divide-x"
    >
      <!-- Cell 1: Account Pool Availability -->
      <div class="col-span-2 flex flex-col justify-center px-4 py-3 sm:col-span-3 xl:col-span-1">
        <div class="flex items-center justify-between gap-2 text-[11.5px] font-semibold">
          <span class="text-ink-2">{{ t('admin.dashboard.overview.poolAvailable') }}</span>
          <router-link
            to="/admin/accounts"
            class="inline-flex items-center gap-1 text-primary-700 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
          >
            <span>{{ t('admin.dashboard.overview.manage') }}</span>
            <Icon name="arrowRight" size="xs" :stroke-width="2" />
          </router-link>
        </div>

        <div class="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <div class="flex items-baseline gap-1.5 tabular-nums">
            <span class="text-[20px] font-bold leading-tight tracking-[-0.025em] text-ink">
              {{ stats ? `${formatNumber(normalAccounts)} / ${formatNumber(totalAccounts)}` : '—' }}
            </span>
            <span
              v-if="availabilityPercent !== null"
              class="text-[12px] font-bold"
              :class="availabilityToneClass"
            >
              {{ availabilityPercent.toFixed(1) }}%
            </span>
          </div>

          <div
            v-if="stats && totalAccounts > 0"
            class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold tabular-nums"
          >
            <span v-if="errorAccounts > 0" class="text-red-700 dark:text-red-300">
              {{ t('admin.dashboard.overview.poolErrorShort', { count: errorAccounts }) }}
            </span>
            <span v-if="ratelimitAccounts > 0" class="text-amber-700 dark:text-amber-300">
              {{ t('admin.dashboard.overview.poolRatelimitShort', { count: ratelimitAccounts }) }}
            </span>
            <span v-if="overloadAccounts > 0" class="text-orange-700 dark:text-orange-300">
              {{ t('admin.dashboard.overview.poolOverloadShort', { count: overloadAccounts }) }}
            </span>
            <span
              v-if="unhealthyAccounts === 0"
              class="text-emerald-700 dark:text-emerald-300"
            >
              {{ t('admin.dashboard.overview.poolNormalShort', { count: normalAccounts }) }}
            </span>
          </div>
        </div>

        <!-- 4-state proportional availability bar -->
        <div
          class="mt-2 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface-3"
          role="img"
          :aria-label="poolAriaSummary"
        >
          <span
            v-if="poolSegments.normal > 0"
            class="h-full bg-primary-500 transition-[width] duration-150 motion-reduce:transition-none"
            :style="{ width: `${poolSegments.normal}%` }"
          />
          <span
            v-if="poolSegments.ratelimit > 0"
            class="h-full bg-amber-500 transition-[width] duration-150 motion-reduce:transition-none"
            :style="{ width: `${poolSegments.ratelimit}%` }"
          />
          <span
            v-if="poolSegments.overload > 0"
            class="h-full bg-orange-500 transition-[width] duration-150 motion-reduce:transition-none"
            :style="{ width: `${poolSegments.overload}%` }"
          />
          <span
            v-if="poolSegments.error > 0"
            class="h-full bg-red-500 transition-[width] duration-150 motion-reduce:transition-none"
            :style="{ width: `${poolSegments.error}%` }"
          />
        </div>
      </div>

      <!-- Cell 2: Live RPM -->
      <div class="flex flex-col justify-center border-r border-edge px-3.5 py-3 sm:border-r xl:border-r-0">
        <span class="text-[11.5px] font-semibold text-ink-2">
          {{ t('admin.dashboard.overview.liveRpm') }}
        </span>
        <div class="mt-1 flex items-baseline gap-1 tabular-nums">
          <span class="text-[20px] font-bold leading-tight tracking-[-0.025em] text-ink">
            {{ stats ? formatNumber(stats.rpm ?? 0) : '—' }}
          </span>
          <span class="text-[11.5px] font-medium text-ink-2">
            {{ t('admin.dashboard.overview.rpmUnit') }}
          </span>
        </div>
        <span class="mt-0.5 truncate text-[11px] tabular-nums text-ink-2">
          {{ t('admin.dashboard.todayRequests') }} {{ stats ? formatCompact(stats.today_requests ?? 0) : '—' }}
        </span>
      </div>

      <!-- Cell 3: Live TPM -->
      <div class="flex flex-col justify-center px-3.5 py-3 sm:border-r sm:border-edge xl:border-r-0">
        <span class="text-[11.5px] font-semibold text-ink-2">
          {{ t('admin.dashboard.overview.liveTpm') }}
        </span>
        <div class="mt-1 flex items-baseline gap-1 tabular-nums">
          <span class="text-[20px] font-bold leading-tight tracking-[-0.025em] text-ink">
            {{ stats ? formatCompact(stats.tpm ?? 0) : '—' }}
          </span>
          <span class="text-[11.5px] font-medium text-ink-2">
            {{ t('admin.dashboard.overview.tpmUnit') }}
          </span>
        </div>
        <span class="mt-0.5 truncate text-[11px] tabular-nums text-ink-2">
          {{ t('admin.dashboard.todayTokens') }} {{ stats ? formatCompact(stats.today_tokens ?? 0) : '—' }}
        </span>
      </div>

      <!-- Cell 4: Avg Latency + Cache Share -->
      <div class="flex flex-col justify-center border-r border-edge px-3.5 py-3 sm:border-r-0 xl:border-r-0">
        <span class="text-[11.5px] font-semibold text-ink-2">
          {{ t('admin.dashboard.overview.avgLatency') }}
        </span>
        <div class="mt-1 flex items-baseline gap-1 tabular-nums">
          <span class="text-[20px] font-bold leading-tight tracking-[-0.025em] text-ink">
            {{ formattedLatency }}
          </span>
        </div>
        <span class="mt-0.5 truncate text-[11px] tabular-nums text-ink-2">
          {{
            cacheRatio !== null
              ? t('admin.dashboard.overview.cacheRatio', { percent: cacheRatio.toFixed(1) })
              : t('admin.dashboard.overview.cacheRatioUnavailable')
          }}
        </span>
      </div>

      <!-- Cell 5: Active Users (1h / Today / +New) -->
      <div class="flex flex-col justify-center px-3.5 py-3 sm:border-r sm:border-edge xl:border-r-0">
        <span class="text-[11.5px] font-semibold text-ink-2">
          {{ t('admin.dashboard.overview.activeUsersShort') }}
        </span>
        <div class="mt-1 flex items-baseline gap-1 tabular-nums">
          <span class="text-[20px] font-bold leading-tight tracking-[-0.025em] text-ink">
            {{ stats ? formatNumber(stats.hourly_active_users ?? 0) : '—' }}
          </span>
          <span class="text-[11.5px] font-medium text-ink-2">
            {{ t('admin.dashboard.overview.hourlyUsersUnit') }}
          </span>
        </div>
        <span
          class="mt-0.5 truncate text-[11px] tabular-nums text-ink-2"
          :title="stats ? t('admin.dashboard.overview.totalLines', { value: formatNumber(stats.total_users ?? 0) }) : ''"
        >
          {{
            stats
              ? t('admin.dashboard.overview.todayUsersMeta', {
                  today: formatNumber(stats.active_users ?? 0),
                  newUsers: formatNumber(stats.today_new_users ?? 0)
                })
              : '—'
          }}
        </span>
      </div>

      <!-- Cell 6: Active API Keys -->
      <div class="col-span-2 flex flex-col justify-center px-3.5 py-3 sm:col-span-2 xl:col-span-1">
        <span class="text-[11.5px] font-semibold text-ink-2">
          {{ t('admin.dashboard.overview.activeKeysShort') }}
        </span>
        <div class="mt-1 flex items-baseline gap-1 tabular-nums">
          <span class="text-[20px] font-bold leading-tight tracking-[-0.025em] text-ink">
            {{ stats ? formatNumber(stats.active_api_keys ?? 0) : '—' }}
          </span>
          <span v-if="stats" class="text-[12px] font-medium text-ink-2">
            / {{ formatNumber(stats.total_api_keys ?? 0) }}
          </span>
        </div>
        <span class="mt-0.5 truncate text-[11px] tabular-nums text-ink-2">
          {{
            activeKeysRatio !== null
              ? t('admin.dashboard.overview.keysEnabledRate', { percent: activeKeysRatio.toFixed(0) })
              : '—'
          }}
        </span>
      </div>
    </div>

    <!-- Attached single-line operational triage bar -->
    <div
      v-if="hasAnomalies"
      class="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-amber-200/90 bg-amber-50/75 px-4 py-2 text-[12px] dark:border-amber-800/50 dark:bg-amber-950/30"
      role="status"
    >
      <span class="inline-flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
        <Icon name="exclamationTriangle" size="xs" :stroke-width="2" />
        {{ t('admin.dashboard.overview.triagePending') }}
      </span>

      <router-link
        v-if="unhealthyAccounts > 0"
        to="/admin/accounts"
        class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
        :class="
          errorAccounts > 0
            ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100/80 dark:border-red-800/60 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-900/60'
            : 'border-amber-300 bg-surface text-amber-800 hover:bg-amber-100/60 dark:border-amber-700/60 dark:bg-surface-2 dark:text-amber-300 dark:hover:bg-amber-900/40'
        "
        :title="t('admin.dashboard.overview.accountHint', { error: errorAccounts, limit: ratelimitAccounts, overload: overloadAccounts })"
      >
        <span>{{ t('admin.dashboard.overview.triageAccountsLink', { count: unhealthyAccounts }) }}</span>
        <Icon name="arrowRight" size="xs" :stroke-width="2.2" />
      </router-link>

      <router-link
        v-if="!isSimple && negativeMarginGroups.length > 0"
        to="/admin/groups"
        class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-red-700 transition-colors hover:bg-red-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 dark:border-red-800/60 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-900/60"
      >
        <span>
          {{
            t('admin.dashboard.overview.triageNegativeMarginLink', {
              count: negativeMarginGroups.length,
              names: negativeMarginGroups.slice(0, 2).map((g) => g.group_name).join(' · ')
            })
          }}
        </span>
        <Icon name="arrowRight" size="xs" :stroke-width="2.2" />
      </router-link>

      <router-link
        v-else-if="!isSimple && lowMarginGroups.length > 0"
        to="/admin/groups"
        class="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-surface px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-800 transition-colors hover:bg-amber-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 dark:border-amber-700/60 dark:bg-surface-2 dark:text-amber-300 dark:hover:bg-amber-900/40"
      >
        <span>
          {{
            t('admin.dashboard.overview.triageLowMarginLink', {
              count: lowMarginGroups.length,
              names: lowMarginGroups.slice(0, 2).map((g) => g.group_name).join(' · ')
            })
          }}
        </span>
        <Icon name="arrowRight" size="xs" :stroke-width="2.2" />
      </router-link>

      <button
        v-if="stats?.stats_stale"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-surface px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-800 transition-colors hover:bg-amber-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 dark:border-amber-700/60 dark:bg-surface-2 dark:text-amber-300"
        @click="emit('refresh')"
      >
        <Icon name="refresh" size="xs" />
        <span>{{ t('admin.dashboard.overview.statsStale') }}</span>
      </button>

      <span v-if="stats" class="ml-auto hidden text-[11.5px] tabular-nums text-amber-900/80 dark:text-amber-200/80 lg:inline">
        {{
          t('admin.dashboard.overview.todayActivitySummary', {
            newUsers: formatNumber(stats.today_new_users ?? 0),
            requests: formatCompact(stats.today_requests ?? 0)
          })
        }}
      </span>
    </div>

    <!-- Calm confirmation bar when healthy -->
    <div
      v-else-if="stats"
      class="flex flex-wrap items-center justify-between gap-2 border-t border-edge bg-surface-2 px-4 py-1.5 text-[11.5px] text-ink-2"
      role="status"
    >
      <span class="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        {{ t('admin.dashboard.overview.triageHealthy') }}
      </span>
      <span class="tabular-nums text-ink-2">
        {{
          t('admin.dashboard.overview.todayActivitySummary', {
            newUsers: formatNumber(stats.today_new_users ?? 0),
            requests: formatCompact(stats.today_requests ?? 0)
          })
        }}
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { DashboardStats, GroupStat } from '@/types'

const props = withDefaults(
  defineProps<{
    stats: DashboardStats | null
    groups: GroupStat[]
    isSimple?: boolean
  }>(),
  { isSimple: false }
)

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const { t } = useI18n()

const totalAccounts = computed(() => Number(props.stats?.total_accounts ?? 0))
const normalAccounts = computed(() => Number(props.stats?.normal_accounts ?? 0))
const ratelimitAccounts = computed(() => Number(props.stats?.ratelimit_accounts ?? 0))
const overloadAccounts = computed(() => Number(props.stats?.overload_accounts ?? 0))
const errorAccounts = computed(() => Number(props.stats?.error_accounts ?? 0))
const unhealthyAccounts = computed(() => errorAccounts.value + ratelimitAccounts.value + overloadAccounts.value)

const availabilityPercent = computed<number | null>(() => {
  if (!props.stats || totalAccounts.value <= 0) return null
  return (normalAccounts.value / totalAccounts.value) * 100
})

const availabilityToneClass = computed(() => {
  const pct = availabilityPercent.value
  if (pct === null) return 'text-ink-2'
  if (pct >= 95) return 'text-emerald-700 dark:text-emerald-300'
  if (pct >= 80) return 'text-amber-700 dark:text-amber-300'
  return 'text-red-700 dark:text-red-300'
})

const poolSegments = computed(() => {
  const total = totalAccounts.value
  if (total <= 0) return { normal: 0, ratelimit: 0, overload: 0, error: 0 }
  return {
    normal: (normalAccounts.value / total) * 100,
    ratelimit: (ratelimitAccounts.value / total) * 100,
    overload: (overloadAccounts.value / total) * 100,
    error: (errorAccounts.value / total) * 100
  }
})

const poolAriaSummary = computed(() => {
  if (!props.stats) return t('admin.dashboard.overview.poolAvailable')
  return `${t('admin.dashboard.overview.poolNormalShort', { count: normalAccounts.value })}, ${t('admin.dashboard.overview.poolRatelimitShort', { count: ratelimitAccounts.value })}, ${t('admin.dashboard.overview.poolOverloadShort', { count: overloadAccounts.value })}, ${t('admin.dashboard.overview.poolErrorShort', { count: errorAccounts.value })}`
})

const formattedLatency = computed(() => {
  const ms = Number(props.stats?.average_duration_ms ?? 0)
  if (!props.stats || !Number.isFinite(ms) || ms <= 0) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
})

const cacheRatio = computed<number | null>(() => {
  if (!props.stats) return null
  const total = Number(props.stats.today_tokens ?? 0)
  if (total <= 0) return null
  const cache = Number(props.stats.today_cache_read_tokens ?? 0) + Number(props.stats.today_cache_creation_tokens ?? 0)
  return Math.min(100, (cache / total) * 100)
})

const activeKeysRatio = computed<number | null>(() => {
  if (!props.stats) return null
  const total = Number(props.stats.total_api_keys ?? 0)
  if (total <= 0) return null
  return Math.min(100, (Number(props.stats.active_api_keys ?? 0) / total) * 100)
})

const negativeMarginGroups = computed(() =>
  props.groups.filter((g) => {
    const rev = Number(g.actual_cost || 0)
    const cost = g.account_cost !== undefined && g.account_cost !== null ? Number(g.account_cost) : null
    return rev > 0 && cost !== null && rev - cost < 0
  })
)

const lowMarginGroups = computed(() =>
  props.groups.filter((g) => {
    const rev = Number(g.actual_cost || 0)
    const cost = g.account_cost !== undefined && g.account_cost !== null ? Number(g.account_cost) : null
    if (rev <= 0 || cost === null) return false
    const margin = ((rev - cost) / rev) * 100
    return margin >= 0 && margin < 10
  })
)

const hasAnomalies = computed(
  () =>
    unhealthyAccounts.value > 0 ||
    (!props.isSimple && (negativeMarginGroups.value.length > 0 || lowMarginGroups.value.length > 0)) ||
    Boolean(props.stats?.stats_stale)
)

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
</script>
