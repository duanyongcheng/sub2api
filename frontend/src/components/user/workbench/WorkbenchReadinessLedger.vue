<template>
  <section
    class="overflow-hidden rounded-card border border-edge bg-surface shadow-xs"
    :aria-label="t('dashboard.workbench.readinessAria')"
  >
    <!-- Continuous hairline-divided readiness cells -->
    <div
      class="grid divide-y divide-edge sm:divide-y-0"
      :class="gridColsClass"
    >
      <!-- Cell 1: Available Balance (omitted in simple mode) -->
      <div
        v-if="!isSimple"
        class="flex flex-col justify-center border-edge px-4 py-3 sm:border-b sm:border-r xl:border-b-0"
      >
        <div class="flex items-center justify-between gap-2 text-[11.5px] font-semibold">
          <span class="text-ink-2">{{ t('dashboard.workbench.availableBalance') }}</span>
          <span
            v-if="frozenBalance > 0"
            class="rounded-full bg-amber-500/15 px-2 py-px text-[10.5px] font-bold tabular-nums text-amber-800 dark:text-amber-300"
          >
            {{ t('dashboard.workbench.frozenTag', { amount: formatMoney(frozenBalance) }) }}
          </span>
        </div>
        <div class="mt-1 text-[21px] font-bold leading-tight tracking-[-0.025em] tabular-nums text-ink">
          {{ formatMoney(balance) }}
        </div>
        <div
          class="mt-1 truncate text-[11px]"
          :class="
            balance <= 0 && !primarySubscription
              ? 'font-medium text-amber-700 dark:text-amber-300'
              : 'text-ink-2'
          "
        >
          {{
            balance <= 0 && !primarySubscription
              ? t('dashboard.workbench.balanceEmptyHint')
              : t('dashboard.workbench.balanceReady')
          }}
        </div>
      </div>

      <!-- Cell 2: Subscription Quota (omitted in simple mode or when feature disabled) -->
      <div
        v-if="!isSimple && subscriptionEnabled"
        class="flex flex-col justify-center border-edge px-4 py-3 sm:border-b lg:border-r xl:border-b-0"
      >
        <div class="flex items-center justify-between gap-2 text-[11.5px] font-semibold">
          <span class="truncate text-ink-2">
            {{
              primarySubscription?.group?.name
                ? `${t('dashboard.workbench.subscriptionTitle')} · ${primarySubscription.group.name}`
                : t('dashboard.workbench.subscriptionTitle')
            }}
          </span>
          <span
            v-if="activeSubscriptions.length > 1"
            class="shrink-0 rounded-full bg-surface-3 px-1.5 py-px text-[10.5px] font-semibold text-ink-2"
          >
            {{ t('dashboard.workbench.subscriptionMoreCount', { count: activeSubscriptions.length - 1 }) }}
          </span>
          <span
            v-else-if="subscriptionRemainingPercent !== null"
            class="shrink-0 text-[11px] font-bold tabular-nums"
            :class="subscriptionToneClass"
          >
            {{ t('dashboard.workbench.subscriptionRemainingPct', { percent: subscriptionRemainingPercent }) }}
          </span>
        </div>

        <template v-if="primarySubscription">
          <div class="mt-1 flex items-baseline gap-1 tabular-nums">
            <span class="text-[21px] font-bold leading-tight tracking-[-0.025em] text-ink">
              {{ subscriptionHeadlineValue }}
            </span>
            <span v-if="subscriptionLimit > 0" class="text-[12px] font-medium text-ink-2">
              / {{ formatMoney(subscriptionLimit) }}
            </span>
          </div>

          <div
            v-if="subscriptionLimit > 0"
            class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            :aria-valuenow="subscriptionRemainingPercent ?? 0"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              class="h-full rounded-full transition-[width] duration-150 motion-reduce:transition-none"
              :class="subscriptionBarClass"
              :style="{ width: `${subscriptionRemainingPercent ?? 0}%` }"
            />
          </div>
          <div v-else class="mt-1 truncate text-[11px] text-ink-2">
            {{ t('dashboard.workbench.subscriptionUnlimitedHint', { group: primarySubscription.group?.name || t('dashboard.noGroup') }) }}
          </div>
          <div v-if="subscriptionLimit > 0 && subscriptionResetText" class="mt-1 truncate text-[11px] text-ink-2">
            {{ subscriptionResetText }}
          </div>
        </template>

        <template v-else>
          <div class="mt-1 text-[17px] font-semibold leading-tight text-ink-2">
            {{ t('dashboard.workbench.subscriptionNone') }}
          </div>
          <div class="mt-1 truncate text-[11px] text-ink-2">
            {{ t('dashboard.workbench.subscriptionNoneHint') }}
          </div>
        </template>
      </div>

      <!-- Cell 3: API Keys -->
      <div
        class="flex flex-col justify-center border-edge px-4 py-3 sm:border-b sm:border-r lg:border-b-0 xl:border-r"
        :class="isSimple ? 'sm:border-b-0' : ''"
      >
        <div class="flex items-center justify-between gap-2 text-[11.5px] font-semibold">
          <span class="text-ink-2">{{ t('dashboard.workbench.keysTitle') }}</span>
          <router-link
            to="/keys"
            class="inline-flex items-center gap-1 text-primary-700 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
          >
            <span>{{ t('dashboard.workbench.keysManage') }}</span>
            <Icon name="arrowRight" size="xs" :stroke-width="2" />
          </router-link>
        </div>
        <div class="mt-1 flex items-baseline gap-1 tabular-nums">
          <span class="text-[21px] font-bold leading-tight tracking-[-0.025em] text-ink">
            {{ stats ? formatNumber(stats.active_api_keys) : '—' }}
          </span>
          <span v-if="stats" class="text-[12px] font-medium text-ink-2">
            {{ t('dashboard.workbench.keysActiveUnit', { total: formatNumber(stats.total_api_keys) }) }}
          </span>
        </div>
        <div
          class="mt-1 truncate text-[11px]"
          :class="stats && stats.active_api_keys === 0 ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-ink-2'"
        >
          {{
            stats && stats.active_api_keys === 0
              ? t('dashboard.workbench.keysEmptyHint')
              : t('dashboard.workbench.keysReadyHint')
          }}
        </div>
      </div>

      <!-- Cell 4: Live Rate & Concurrency -->
      <div
        class="flex flex-col justify-center border-edge px-4 py-3 sm:border-r lg:border-b-0"
        :class="isSimple ? '' : 'sm:border-b xl:border-b-0'"
      >
        <span class="text-[11.5px] font-semibold text-ink-2">
          {{ t('dashboard.workbench.rateAndConcurrency') }}
        </span>
        <div class="mt-1 flex items-baseline gap-1 tabular-nums">
          <span class="text-[21px] font-bold leading-tight tracking-[-0.025em] text-ink">
            {{ stats ? formatNumber(stats.rpm) : '—' }}
          </span>
          <span class="text-[12px] font-medium text-ink-2">
            {{ rpmLimit > 0 ? `/ ${rpmLimit} RPM` : 'RPM' }}
          </span>
        </div>
        <div class="mt-1 truncate text-[11px] tabular-nums text-ink-2">
          {{
            userConcurrency > 0
              ? t('dashboard.workbench.concurrencyCap', { value: userConcurrency })
              : t('dashboard.workbench.concurrencyUnlimited')
          }}
          · TPM {{ stats ? formatCompact(stats.tpm) : '—' }}
        </div>
      </div>

      <!-- Cell 5: Today Spend & Savings (or Today Traffic & Latency in simple mode) -->
      <div class="flex flex-col justify-center px-4 py-3">
        <template v-if="!isSimple">
          <div class="flex items-center justify-between gap-2 text-[11.5px] font-semibold">
            <span class="truncate text-ink-2">{{ t('dashboard.workbench.todaySpendAndSave') }}</span>
            <span
              v-if="savingPercent !== null"
              class="shrink-0 rounded-full bg-primary-50 px-2 py-px text-[10.5px] font-bold tabular-nums text-primary-700"
            >
              {{ t('dashboard.workbench.savedLabel', { percent: savingPercent }) }}
            </span>
          </div>
          <div class="mt-1 flex items-baseline gap-1 tabular-nums">
            <span class="text-[21px] font-bold leading-tight tracking-[-0.025em] text-ink">
              {{ stats ? `$${formatCost(stats.today_actual_cost)}` : '—' }}
            </span>
            <span
              v-if="stats && stats.today_cost > 0 && stats.today_cost !== stats.today_actual_cost"
              class="text-[12px] font-medium text-ink-2"
            >
              / ${{ formatCost(stats.today_cost) }}
            </span>
          </div>
          <div class="mt-1 truncate text-[11px] tabular-nums text-ink-2">
            {{ t('dashboard.todayRequests') }} {{ stats ? formatNumber(stats.today_requests) : '—' }} ·
            {{ t('dashboard.workbench.cacheHit', { tokens: stats ? formatCompact(cacheTokens) : '—' }) }}
          </div>
        </template>

        <template v-else>
          <span class="text-[11.5px] font-semibold text-ink-2">
            {{ t('dashboard.workbench.todayTrafficTitle') }}
          </span>
          <div class="mt-1 flex items-baseline gap-1 tabular-nums">
            <span class="text-[21px] font-bold leading-tight tracking-[-0.025em] text-ink">
              {{ stats ? formatNumber(stats.today_requests) : '—' }}
            </span>
            <span class="text-[12px] font-medium text-ink-2">
              {{ t('dashboard.workbench.requestsUnit') }}
            </span>
          </div>
          <div class="mt-1 truncate text-[11px] tabular-nums text-ink-2">
            {{ stats ? formatCompact(stats.today_tokens) : '—' }} Token · {{ formattedLatency }}
          </div>
        </template>
      </div>
    </div>

    <!-- Attached conditional error strip -->
    <div
      v-if="errorsTotal > 0"
      class="flex flex-wrap items-center justify-between gap-2 border-t border-red-200/90 bg-red-50/80 px-4 py-2 text-[12px] dark:border-red-900/50 dark:bg-red-950/35"
      role="status"
    >
      <div class="flex flex-wrap items-center gap-2 text-red-700 dark:text-red-300">
        <Icon name="exclamationCircle" size="sm" :stroke-width="2" class="shrink-0" />
        <span class="font-semibold">
          {{ t('dashboard.workbench.errorAlertSummary', { count: errorsTotal }) }}
        </span>
        <span
          v-for="cat in errorCategories"
          :key="cat.key"
          class="rounded-full border border-red-200 bg-surface px-2 py-px text-[11px] font-semibold tabular-nums text-red-700 dark:border-red-800/60 dark:bg-surface-2 dark:text-red-300"
        >
          {{ cat.label }} {{ cat.count }}
        </span>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-1 text-[12px] font-semibold text-red-700 underline decoration-red-400 underline-offset-2 transition-colors hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 dark:text-red-300 dark:hover:text-red-200"
        @click="emit('inspectErrors')"
      >
        <span>{{ t('dashboard.workbench.errorAlertAction') }}</span>
        <Icon name="arrowDown" size="xs" :stroke-width="2" />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { UserDashboardStats as UserStatsType } from '@/api/usage'
import type { UserErrorRequest, UserSubscription } from '@/types'

const props = withDefaults(
  defineProps<{
    stats: UserStatsType | null
    balance: number
    frozenBalance?: number
    userConcurrency?: number
    isSimple: boolean
    subscriptionEnabled?: boolean
    activeSubscriptions?: UserSubscription[]
    recentErrors?: UserErrorRequest[]
    errorsTotal?: number
  }>(),
  {
    frozenBalance: 0,
    userConcurrency: 0,
    subscriptionEnabled: true,
    activeSubscriptions: () => [],
    recentErrors: () => [],
    errorsTotal: 0
  }
)

const emit = defineEmits<{
  (e: 'inspectErrors'): void
}>()

const { t, te } = useI18n()

const gridColsClass = computed(() => {
  if (props.isSimple) return 'grid-cols-1 sm:grid-cols-3'
  if (props.subscriptionEnabled) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
  return 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
})

const primarySubscription = computed(() => props.activeSubscriptions[0] ?? null)

const subscriptionLimit = computed(() => Number(primarySubscription.value?.group?.monthly_limit_usd || 0))
const subscriptionUsed = computed(() => Number(primarySubscription.value?.monthly_usage_usd || 0))
const subscriptionUsedPercent = computed(() => {
  if (subscriptionLimit.value <= 0) return 0
  return Math.min(100, Math.round((subscriptionUsed.value / subscriptionLimit.value) * 100))
})
const subscriptionRemainingPercent = computed<number | null>(() => {
  if (!primarySubscription.value || subscriptionLimit.value <= 0) return null
  return Math.max(0, 100 - subscriptionUsedPercent.value)
})
const subscriptionHeadlineValue = computed(() => {
  if (subscriptionLimit.value <= 0) return t('dashboard.platformQuota.noLimit')
  return formatMoney(Math.max(0, subscriptionLimit.value - subscriptionUsed.value))
})
const subscriptionToneClass = computed(() => {
  if (subscriptionUsedPercent.value >= 95) return 'text-red-700 dark:text-red-300'
  if (subscriptionUsedPercent.value >= 80) return 'text-amber-700 dark:text-amber-300'
  return 'text-primary-700'
})
const subscriptionBarClass = computed(() => {
  if (subscriptionUsedPercent.value >= 95) return 'bg-red-500'
  if (subscriptionUsedPercent.value >= 80) return 'bg-amber-500'
  return 'bg-primary-500'
})

const subscriptionResetText = computed(() => {
  const sub = primarySubscription.value
  if (!sub) return ''
  let iso = sub.expires_at || ''
  if (sub.monthly_window_start) {
    const start = new Date(sub.monthly_window_start)
    if (!Number.isNaN(start.getTime())) {
      start.setDate(start.getDate() + 30)
      iso = start.toISOString()
    }
  }
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const formatted = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return t('dashboard.platformQuota.resetsAt', { time: formatted })
})

const rpmLimit = computed(() => Number(primarySubscription.value?.group?.rpm_limit || 0))

const cacheTokens = computed(
  () => (props.stats?.today_cache_creation_tokens ?? 0) + (props.stats?.today_cache_read_tokens ?? 0)
)

const savingPercent = computed<number | null>(() => {
  const standard = Number(props.stats?.today_cost || 0)
  const actual = Number(props.stats?.today_actual_cost || 0)
  if (standard <= 0 || actual >= standard) return null
  return Math.round((1 - actual / standard) * 100)
})

const formattedLatency = computed(() => {
  const ms = Number(props.stats?.average_duration_ms ?? 0)
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
})

const errorCategories = computed(() => {
  const counts = new Map<string, number>()
  for (const err of props.recentErrors) {
    const key = err.category || 'other'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => {
      const i18nKey = `usage.errors.categories.${key}`
      return { key, label: te(i18nKey) ? t(i18nKey) : key, count }
    })
})

function formatMoney(value: number): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '$0.00'
  return `$${n.toFixed(2)}`
}

function formatCost(value: number): string {
  const n = Number(value || 0)
  if (n >= 1) return n.toFixed(2)
  if (n >= 0.01) return n.toFixed(3)
  return n.toFixed(4)
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
</script>
