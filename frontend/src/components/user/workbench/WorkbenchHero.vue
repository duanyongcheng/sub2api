<template>
  <section class="hero">
    <!-- Left: greeting + three linked allowances -->
    <div class="flex min-w-0 flex-col gap-3.5">
      <div>
        <div class="hero-greet">{{ greeting }}</div>
        <div class="hero-sub">
          <template v-if="stats">
            {{ t('dashboard.workbench.summaryProcessed') }}
            <b class="text-ink">{{ formatNumber(stats.today_requests) }}</b>
            {{ t('dashboard.workbench.summaryRequests') }} ·
            {{ t('dashboard.workbench.summaryRecent') }} {{ windowDays }} {{ t('dashboard.workbench.summaryDays') }}
            <span
              v-if="requestDelta !== null"
              class="trend ml-1"
              :class="requestDelta >= 0 ? 'trend-up' : 'trend-down'"
            >
              <Icon :name="requestDelta >= 0 ? 'arrowUp' : 'arrowDown'" size="xs" :stroke-width="2.4" />
              {{ Math.abs(requestDelta).toFixed(1) }}%
            </span>
          </template>
          <template v-else>{{ t('dashboard.welcomeMessage') }}</template>
        </div>
      </div>

      <div class="quota-row">
        <!-- Subscription quota -->
        <div v-if="!isSimple" class="quota">
          <div class="quota-k">
            <Icon name="creditCard" size="xs" />
            <span class="truncate">{{ t('dashboard.workbench.subscriptionQuota') }}</span>
          </div>
          <div class="quota-v">{{ subscriptionValue }}</div>
          <div class="progress mt-2 h-1.5">
            <div
              class="progress-bar"
              :class="subscriptionTone === 'bad' ? 'progress-bar-bad' : subscriptionTone === 'warn' ? 'progress-bar-warn' : ''"
              :style="{ width: `${subscriptionPercent}%` }"
            />
          </div>
          <div class="quota-h">{{ subscriptionHint }}</div>
        </div>

        <!-- Wallet balance -->
        <div v-if="!isSimple" class="quota">
          <div class="quota-k">
            <Icon name="dollar" size="xs" />
            <span class="truncate">{{ t('dashboard.workbench.walletBalance') }}</span>
          </div>
          <div class="quota-v">{{ formatMoney(balance) }}</div>
          <div class="progress mt-2 h-1.5">
            <div
              class="progress-bar"
              :class="walletPercent < 15 ? 'progress-bar-bad' : walletPercent < 30 ? 'progress-bar-warn' : ''"
              :style="{ width: `${walletPercent}%` }"
            />
          </div>
          <div class="quota-h">{{ t('dashboard.workbench.walletBalanceHint') }}</div>
        </div>

        <!-- Concurrency / RPM -->
        <div class="quota">
          <div class="quota-k">
            <Icon name="bolt" size="xs" />
            <span class="truncate">{{ t('dashboard.workbench.concurrency') }}</span>
          </div>
          <div class="quota-v">
            {{ stats?.rpm ?? 0 }}
            <span v-if="rpmLimit > 0" class="text-meta font-semibold text-ink-3">/ {{ rpmLimit }} RPM</span>
            <span v-else class="text-meta font-semibold text-ink-3">RPM</span>
          </div>
          <div class="progress mt-2 h-1.5">
            <div class="progress-bar" :style="{ width: `${rpmPercent}%` }" />
          </div>
          <div class="quota-h">{{ groupHint }}</div>
        </div>
      </div>
    </div>

    <!-- Right: live throughput strip -->
    <div class="throughput">
      <div class="flex items-center justify-between">
        <span class="text-[12px] font-semibold text-ink-2">{{ t('dashboard.workbench.throughput') }}</span>
        <span class="live-flag"><i class="live-dot" />{{ t('dashboard.workbench.live') }}</span>
      </div>

      <div class="relative min-h-[64px] flex-1">
        <Sparkline
          v-if="hourlyRequests.length > 1"
          :data="hourlyRequests"
          :width="320"
          :height="72"
          stroke-color="#0d9488"
          :stroke-width="2"
          preserve-aspect-ratio="none"
          class="h-[72px] w-full"
        />
        <div v-else class="flex h-[72px] items-center justify-center text-meta text-ink-3">
          {{ t('dashboard.workbench.throughputEmpty') }}
        </div>
      </div>

      <div class="flex items-center justify-between text-meta text-ink-3">
        <span>{{ t('dashboard.workbench.rpm') }} <b class="text-ink">{{ stats?.rpm ?? 0 }}</b></span>
        <span>{{ t('dashboard.workbench.tpm') }} <b class="text-ink">{{ formatTokens(stats?.tpm ?? 0) }}</b></span>
        <span>{{ t('dashboard.workbench.p95') }} <b class="text-ink">{{ formatSeconds(p95DurationMs) }}</b></span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import Sparkline from '@/components/common/Sparkline.vue'
import type { UserDashboardStats as UserStatsType } from '@/api/usage'
import type { TrendDataPoint, UserSubscription } from '@/types'

/**
 * DashboardHero — first screen of the workbench.
 *
 * The redesign replaces the generic "4 icon cards" opener with the three
 * numbers a user actually checks before writing code — subscription quota,
 * wallet balance, concurrency/RPM — shown side by side because they are
 * consumed in that order. The right half is a live 60-minute throughput strip.
 */
const props = withDefaults(
  defineProps<{
    stats: UserStatsType | null
    balance: number
    isSimple: boolean
    subscription?: UserSubscription | null
    hourlyTrend?: TrendDataPoint[]
    windowDays?: number
    /** Yesterday's request count, used for the day-over-day delta. */
    yesterdayRequests?: number | null
    /** Approximate P95 from recent logs (ms). */
    p95DurationMs?: number | null
  }>(),
  {
    subscription: null,
    hourlyTrend: () => [],
    windowDays: 7,
    yesterdayRequests: null,
    p95DurationMs: null
  }
)

const { t } = useI18n()

const greeting = computed(() => {
  const hour = new Date().getHours()
  let key = 'greetingNight'
  if (hour >= 5 && hour < 11) key = 'greetingMorning'
  else if (hour >= 11 && hour < 13) key = 'greetingNoon'
  else if (hour >= 13 && hour < 18) key = 'greetingAfternoon'
  else if (hour >= 18 && hour < 23) key = 'greetingEvening'
  return t(`dashboard.workbench.${key}`)
})

const requestDelta = computed<number | null>(() => {
  const today = props.stats?.today_requests ?? 0
  const yesterday = props.yesterdayRequests
  if (yesterday === null || yesterday === undefined || yesterday <= 0) return null
  return ((today - yesterday) / yesterday) * 100
})

// ---- Subscription quota ----
const subscriptionLimit = computed(() => Number(props.subscription?.group?.monthly_limit_usd || 0))
const subscriptionUsed = computed(() => Number(props.subscription?.monthly_usage_usd || 0))
const subscriptionPercent = computed(() => {
  if (subscriptionLimit.value <= 0) return 0
  return Math.min(100, Math.round((subscriptionUsed.value / subscriptionLimit.value) * 100))
})
const subscriptionTone = computed(() =>
  subscriptionPercent.value >= 95 ? 'bad' : subscriptionPercent.value >= 80 ? 'warn' : 'ok'
)
const subscriptionValue = computed(() => {
  if (subscriptionLimit.value <= 0) return t('dashboard.platformQuota.noLimit')
  return formatMoney(Math.max(0, subscriptionLimit.value - subscriptionUsed.value))
})
const subscriptionHint = computed(() => {
  const sub = props.subscription
  if (!sub) return t('dashboard.workbench.concurrencyHintEmpty')
  const groupName = sub.group?.name || t('dashboard.noGroup')
  const reset = sub.expires_at ? formatDate(resetDateOf(sub)) : ''
  return reset
    ? t('dashboard.workbench.subscriptionResetAt', { group: groupName, date: reset })
    : groupName
})

function resetDateOf(sub: UserSubscription): string {
  // The monthly window resets 30 days after its start; fall back to expiry.
  if (sub.monthly_window_start) {
    const start = new Date(sub.monthly_window_start)
    if (!Number.isNaN(start.getTime())) {
      start.setDate(start.getDate() + 30)
      return start.toISOString()
    }
  }
  return sub.expires_at || ''
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ---- Wallet ----
const walletPercent = computed(() => {
  // Without a configured top-up ceiling the bar simply represents "has balance".
  return props.balance > 0 ? 100 : 0
})

// ---- Concurrency ----
const rpmLimit = computed(() => Number(props.subscription?.group?.rpm_limit || 0))
const rpmPercent = computed(() => {
  if (rpmLimit.value <= 0) return 0
  return Math.min(100, Math.round(((props.stats?.rpm ?? 0) / rpmLimit.value) * 100))
})
const groupHint = computed(() => {
  const groupName = props.subscription?.group?.name
  return groupName
    ? t('dashboard.workbench.concurrencyHint', { group: groupName })
    : t('dashboard.workbench.concurrencyHintEmpty')
})

// ---- Throughput ----
const hourlyRequests = computed(() =>
  [...(props.hourlyTrend ?? [])]
    .slice(-60)
    .map((point) => Number(point.requests || 0))
)

// ---- Formatters ----
function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '$0.00'
  return `$${value.toFixed(2)}`
}

function formatNumber(value: number | undefined): string {
  return Number(value || 0).toLocaleString()
}

function formatTokens(value: number | undefined): string {
  const n = Number(value || 0)
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatSeconds(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms <= 0) return '—'
  return `${(ms / 1000).toFixed(2)}s`
}
</script>

<style scoped>
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 22px;
  padding: 20px 22px;
  border-radius: 18px;
  border: 1px solid rgb(var(--edge));
  background:
    radial-gradient(900px 240px at 8% -30%, rgba(20, 184, 166, 0.16), transparent 62%),
    radial-gradient(700px 220px at 92% 130%, rgba(59, 130, 246, 0.1), transparent 60%),
    rgb(var(--surface));
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
}

@media (max-width: 1024px) {
  .hero {
    grid-template-columns: minmax(0, 1fr);
  }
}

.hero-greet {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: rgb(var(--ink));
}

.hero-sub {
  margin-top: 4px;
  font-size: 12.8px;
  color: rgb(var(--ink-3));
}

.quota-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 640px) {
  .quota-row {
    grid-template-columns: minmax(0, 1fr);
  }
}

.quota {
  padding: 12px 13px;
  border-radius: 10px;
  background: rgb(var(--surface-2));
  border: 1px solid rgb(var(--edge));
}

.quota-k {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 600;
  color: rgb(var(--ink-3));
}

.quota-v {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
  color: rgb(var(--ink));
}

.quota-h {
  margin-top: 6px;
  font-size: 11px;
  color: rgb(var(--ink-3));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.throughput {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 15px 16px;
  border-radius: 10px;
  background: rgb(var(--surface-2));
  border: 1px solid rgb(var(--edge));
}

.live-flag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: rgb(5 150 105);
}
</style>
