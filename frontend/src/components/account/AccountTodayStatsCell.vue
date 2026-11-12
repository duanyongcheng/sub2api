<template>
  <div>
    <!-- Loading state -->
    <div v-if="props.loading && !props.stats" class="space-y-1">
      <div class="h-3 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
      <div class="h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="props.error && !props.stats" class="text-xs" :class="props.accessibleContrast ? 'text-red-700 dark:text-red-300' : 'text-red-500'">
      {{ props.error }}
    </div>

    <!--
      紧凑两行（方案 A）：金额一行、请求/Token 一行。原来每种指标各占一行
      （请求、Token、账号计费、用户扣费 = 4 行），把账号行整体撑到 80px+。
      用户扣费从第四行折进金额行前缀 U$ / 请求行的悬停提示。
    -->
    <div v-else-if="props.stats" class="flex flex-col gap-0.5 text-left">
      <div class="flex items-baseline gap-1 whitespace-nowrap">
        <span class="text-[12.5px] font-semibold tabular-nums" :class="props.accessibleContrast ? 'text-emerald-700 dark:text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'">{{ formatCurrency(props.stats.cost) }}</span>
        <span
          v-if="props.stats.user_cost != null"
          class="text-[10.5px] tabular-nums"
          :class="props.accessibleContrast ? 'text-ink-2' : 'text-gray-400 dark:text-gray-500'"
          :title="t('usage.userBilled')"
        >U {{ formatCurrency(props.stats.user_cost) }}</span>
      </div>
      <div
        class="whitespace-nowrap text-[10.5px] tabular-nums"
        :class="props.accessibleContrast ? 'text-ink-2' : 'text-gray-500 dark:text-gray-400'"
        :title="statsTitle"
      >
        {{ formatNumber(props.stats.requests) }} req · {{ formatTokens(props.stats.tokens) }}
      </div>
    </div>

    <!-- No data -->
    <div v-else class="text-xs" :class="props.accessibleContrast ? 'text-ink-2' : 'text-gray-400'">-</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WindowStats } from '@/types'
import { formatNumber, formatCurrency } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    stats?: WindowStats | null
    loading?: boolean
    error?: string | null
    accessibleContrast?: boolean
  }>(),
  {
    stats: null,
    loading: false,
    error: null,
    accessibleContrast: false
  }
)

const { t } = useI18n()

// 悬停给出完整口径与用户扣费，弥补紧凑行里省略的标签。
const statsTitle = computed(() => {
  if (!props.stats) return ''
  const parts = [
    `${t('admin.accounts.stats.requests')}: ${formatNumber(props.stats.requests)}`,
    `${t('admin.accounts.stats.tokens')}: ${props.stats.tokens.toLocaleString()}`
  ]
  if (props.stats.cost != null) parts.push(`${t('usage.accountBilled')}: ${formatCurrency(props.stats.cost)}`)
  if (props.stats.user_cost != null) parts.push(`${t('usage.userBilled')}: ${formatCurrency(props.stats.user_cost)}`)
  return parts.join(' · ')
})

// Format large token numbers (e.g., 1234567 -> 1.23M)
const formatTokens = (tokens: number): string => {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }
  return tokens.toString()
}
</script>
