<template>
  <section class="card">
    <div class="card-hd">
      <h3 class="text-sm font-semibold text-ink">{{ t('dashboard.platformBreakdown') }}</h3>
      <span class="pill pill-neutral">{{ t('dashboard.workbench.platformToday') }}</span>
    </div>

    <div class="card-bd flex flex-col gap-2.5">
      <p v-if="platforms.length === 0" class="py-6 text-center text-body text-ink-3">
        {{ t('dashboard.workbench.platformEmpty') }}
      </p>

      <div
        v-for="item in platforms"
        :key="item.platform"
        class="plat-tile"
      >
        <div class="flex items-center gap-2">
          <span class="plat-mark" :style="{ background: platformColor(item.platform) }">{{ platformInitial(item.platform) }}</span>
          <span class="text-[12.5px] font-semibold text-ink">{{ platformName(item.platform) }}</span>
          <span class="pill" :class="item.share >= 60 ? 'pill-ok' : 'pill-neutral'">{{ shareLabel(item.share) }}</span>
          <span class="ml-auto text-[12.5px] font-bold tabular-nums text-ink">{{ formatMoney(item.actualCost) }}</span>
        </div>
        <div class="mt-1.5 flex items-center justify-between text-[11px] text-ink-3">
          <span class="truncate">{{ t('dashboard.workbench.platformRequests', { count: formatNumber(item.requests) }) }}</span>
          <span class="shrink-0 pl-2">{{ item.share.toFixed(0) }}%</span>
        </div>
        <div class="progress mt-1.5 h-1.5">
          <div class="progress-bar" :style="{ width: `${Math.max(2, item.share)}%` }" />
        </div>

        <!-- Per-window quota, when the platform has one configured -->
        <div v-if="item.quotaRows.length" class="mt-2.5 flex flex-col gap-1.5 border-t border-edge pt-2">
          <div v-for="row in item.quotaRows" :key="row.label" class="flex items-center gap-2">
            <span class="w-12 shrink-0 text-[10.5px] font-semibold text-ink-3">{{ row.label }}</span>
            <div class="progress h-1 flex-1">
              <div class="progress-bar" :class="row.percent >= 90 ? 'progress-bar-bad' : row.percent >= 75 ? 'progress-bar-warn' : ''" :style="{ width: `${row.percent}%` }" />
            </div>
            <span class="shrink-0 text-[10.5px] tabular-nums text-ink-3">{{ row.percent }}%</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PlatformDashboardStats } from '@/api/usage'
import type { PlatformQuotaItem } from '@/types'

/**
 * WorkbenchPlatforms — the "which provider is this coming from" rail.
 *
 * Mirrors the old `by_platform` breakdown, but sorted by today's spend and
 * annotated with the share bar, so the dominant provider is obvious at a
 * glance. Configured per-window quotas are folded in underneath so the user
 * does not have to open a second screen to see "how close am I to the cap".
 */
const props = defineProps<{
  byPlatform: PlatformDashboardStats[]
  quotas?: PlatformQuotaItem[] | null
  platformLabel?: (platform: string) => string
}>()

const { t } = useI18n()

const PLATFORM_COLORS: Record<string, string> = {
  anthropic: '#d97757',
  claude: '#d97757',
  openai: '#10a37f',
  gemini: '#4285f4',
  google: '#4285f4',
  grok: '#8b5cf6',
  xai: '#8b5cf6',
  antigravity: '#0ea5e9',
  kimi: '#6366f1',
  zhipu: '#f97316',
  deepseek: '#2563eb',
  minimax: '#f43f5e'
}

type QuotaRow = { label: string; percent: number }

const quotaMap = computed(() => {
  const map = new Map<string, PlatformQuotaItem>()
  for (const quota of props.quotas ?? []) map.set(quota.platform, quota)
  return map
})

const platforms = computed(() => {
  const rows = (props.byPlatform ?? [])
    .filter((item) => item.today_requests > 0 || item.today_actual_cost > 0)
    .map((item) => ({
      platform: item.platform,
      requests: item.today_requests,
      actualCost: item.today_actual_cost
    }))

  const total = rows.reduce((sum, row) => sum + row.requests, 0) || 1

  return rows
    .sort((a, b) => b.actualCost - a.actualCost || b.requests - a.requests)
    .slice(0, 5)
    .map((row) => ({
      ...row,
      share: (row.requests / total) * 100,
      quotaRows: buildQuotaRows(quotaMap.value.get(row.platform))
    }))
})

function buildQuotaRows(quota: PlatformQuotaItem | undefined): QuotaRow[] {
  if (!quota) return []
  const windows = [
    { key: 'daily', label: t('dashboard.workbench.quotaDaily') },
    { key: 'weekly', label: t('dashboard.workbench.quotaWeekly') },
    { key: 'monthly', label: t('dashboard.workbench.quotaMonthly') }
  ] as const
  return windows
    .map(({ key, label }) => {
      const limit = Number(quota[`${key}_limit_usd`] ?? 0)
      if (!(limit > 0)) return null
      const used = Number(quota[`${key}_usage_usd`] ?? 0)
      return { label, percent: Math.min(100, Math.round((used / limit) * 100)) }
    })
    .filter((row): row is QuotaRow => row !== null)
}

function platformColor(platform: string): string {
  return PLATFORM_COLORS[platform?.toLowerCase()] ?? '#64748b'
}

function platformInitial(platform: string): string {
  const label = platformName(platform)
  return (label[0] || '?').toUpperCase()
}

function platformName(platform: string): string {
  if (platform === '__other__') return t('dashboard.workbench.otherPlatform')
  return props.platformLabel ? props.platformLabel(platform) : platform
}

function shareLabel(share: number): string {
  if (share >= 60) return t('dashboard.workbench.platformToday')
  return `${share.toFixed(0)}%`
}

function formatMoney(value: number): string {
  const n = Number(value || 0)
  return `$${n >= 100 ? n.toFixed(0) : n.toFixed(2)}`
}

function formatNumber(value: number): string {
  const n = Number(value || 0)
  return n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString()
}
</script>

<style scoped>
.plat-tile {
  padding: 11px 13px;
  border-radius: 10px;
  border: 1px solid rgb(var(--edge));
  background: rgb(var(--surface-2));
}

.plat-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
}
</style>
