<template>
  <!--
    单一根节点：调用方写在 <UsageProgressBar data-testid=...> 上的透传属性
    （如监控页的 monitor-quota-tier）必须落在根节点上，改成多根节点会静默丢弃它们。
  -->
  <div class="min-w-0">
    <!-- Window stats row (above progress bar) -->
    <div
      v-if="!isCompact && windowStats && (windowStats.requests > 0 || windowStats.tokens > 0)"
      class="mb-0.5 flex items-center"
    >
      <div class="flex items-center gap-1.5 text-[9px] text-gray-500 dark:text-gray-400">
        <span class="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">
          {{ formatRequests }} req
        </span>
        <span class="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">
          {{ formatTokens }}
        </span>
        <span class="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800" :title="t('usage.accountBilled')">
          A ${{ formatAccountCost }}
        </span>
        <span
          v-if="windowStats?.user_cost != null"
          class="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800"
          :title="t('usage.userBilled')"
        >
          U ${{ formatUserCost }}
        </span>
        <span
          v-if="estimatedTotalCost != null"
          data-test="estimated-total-cost"
          class="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800"
          :title="t('admin.accounts.usageWindow.estimatedTotalCostTooltip')"
        >
          {{ t('admin.accounts.usageWindow.estimatedTotalCost', { cost: estimatedTotalCost.toFixed(2) }) }}
        </span>
      </div>
    </div>

    <!-- Compact block: the account table's usage column. One aligned row per
         window: label · track · percent · reset countdown. Fixed trailing widths
         keep the percentages and countdowns in a clean vertical rail across rows. -->
    <div v-if="isCompact" class="account-usage-block flex min-w-0 flex-col gap-0.5">
      <div class="flex min-w-0 items-center gap-2">
        <span :class="compactLabelClass">
          {{ label }}
        </span>

        <div class="h-[6px] min-w-[40px] flex-1 overflow-hidden rounded-full bg-gray-200/90 dark:bg-dark-700">
          <div
            :class="['h-full rounded-full transition-all duration-300', barClass]"
            :style="{ width: barWidth }"
          ></div>
        </div>

        <span :class="['w-[36px] shrink-0 text-right text-[11px] font-semibold leading-4 tabular-nums', textClass]">
          {{ displayPercent }}
        </span>

        <span
          class="w-[54px] shrink-0 truncate text-right text-[10px] leading-4 tabular-nums text-gray-400 dark:text-gray-500"
          :title="resetTimeTitle"
        >
          {{ formatResetTime }}
        </span>
      </div>
    </div>

    <!-- 窗口用量：独立成块并紧跟在本条进度条之后，渲染顺序即视觉顺序；
         多个窗口之间不会被大量灰色小字隔开（父容器的 order 规则只作用于窗口条）。 -->
    <div
      v-if="isCompact && denseStatsItems.length"
      class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 pl-0.5 text-[10px] leading-4 tabular-nums text-gray-500 sm:gap-x-1 dark:text-gray-400"
    >
      <template v-for="(item, index) in denseStatsItems" :key="item.key">
        <span class="inline-flex items-center gap-1">
          <span v-if="index > 0" class="hidden text-gray-300 sm:inline dark:text-dark-600" aria-hidden="true">·</span>
          <span :class="item.class" :title="item.title">{{ item.text }}</span>
        </span>
      </template>
    </div>

    <!-- Progress bar row -->
    <div v-if="!isCompact" class="flex items-center gap-1">
      <!-- Label badge (label-width: fixed = 定宽居中, auto = 限宽截断左对齐) -->
      <span :class="[labelSizeClass, labelClass]">
        {{ label }}
      </span>

      <!-- Progress bar container -->
      <div class="h-1.5 w-8 shrink-0 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          :class="['h-full transition-all duration-300', barClass]"
          :style="{ width: barWidth }"
        ></div>
      </div>

      <!-- Percentage -->
      <span :class="['w-[32px] shrink-0 text-right text-[10px] font-medium', textClass]">
        {{ displayPercent }}
      </span>

      <!-- Reset time -->
      <span v-if="shouldShowResetTime" class="shrink-0 text-[10px] text-gray-400">
        {{ formatResetTime }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import type { WindowStats } from '@/types'
import { formatCompactNumber } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    label: string
    utilization: number // Percentage (0-100+)
    resetsAt?: string | null
    color: 'indigo' | 'emerald' | 'purple' | 'amber'
    windowStats?: WindowStats | null
    estimatedTotalCost?: number | null
    showNowWhenIdle?: boolean
    remainingCapacity?: boolean
    /** fixed: 定宽居中徽章（账号页纵向对齐）；auto: 限宽截断左对齐（监控页组合标签） */
    labelWidth?: 'fixed' | 'auto'
    /**
     * compact: 账号表用量列的紧凑块——进度条吃满列宽，窗口用量折成一行小字。
     * 视觉顺序由父容器（AccountUsageCell 的 .account-usage-stack）用 CSS 决定，
     * 组件自身不写 order，避免与后台页面的样式覆盖冲突。
     */
    compact?: boolean
  }>(),
  { labelWidth: 'fixed', compact: false }
)

const isCompact = computed(() => props.compact)

// 紧凑模式的标签列定宽左对齐：多窗口/多账号之间进度条起点一致。
const compactLabelClass = 'w-[32px] shrink-0 text-left text-[10px] font-medium leading-4 text-gray-500 dark:text-gray-400'

const { t } = useI18n()

// Reactive clock for countdown — only runs when a reset time is shown,
// to avoid creating many idle timers across large account lists.
const now = ref(new Date())
const { pause: pauseClock, resume: resumeClock } = useIntervalFn(
  () => {
    now.value = new Date()
  },
  60_000,
  { immediate: false },
)
if (props.resetsAt) resumeClock()
const refreshClockWhenVisible = () => {
  if (!document.hidden && props.resetsAt) now.value = new Date()
}
onMounted(() => document.addEventListener('visibilitychange', refreshClockWhenVisible))
onUnmounted(() => document.removeEventListener('visibilitychange', refreshClockWhenVisible))
watch(
  () => props.resetsAt,
  (val) => {
    if (val) {
      now.value = new Date()
      resumeClock()
    } else {
      pauseClock()
    }
  },
)

// Label background colors
const labelClass = computed(() => {
  const colors = {
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  }
  return colors[props.color]
})

// Label badge width mode: fixed 定宽保证账号页纵向对齐；auto 限宽截断适配
// 监控页「Pro/7 天」类组合标签。百分比列在两种模式下保持不变。
const labelSizeClass = computed(() =>
  props.labelWidth === 'auto'
    ? 'max-w-[72px] shrink-0 truncate rounded px-1 text-left text-[10px] font-medium'
    : 'w-[32px] shrink-0 rounded px-1 text-center text-[10px] font-medium'
)

// Progress bar color based on utilization
const barClass = computed(() => {
  if (props.remainingCapacity) {
    if (props.utilization <= 20) {
      return 'bg-red-500'
    } else if (props.utilization <= 50) {
      return 'bg-amber-500'
    }
    return 'bg-green-500'
  }
  if (props.utilization >= 90) {
    return 'bg-red-500'
  } else if (props.utilization >= 75) {
    return 'bg-amber-500'
  } else {
    return 'bg-green-500'
  }
})

// Text color based on utilization
const textClass = computed(() => {
  if (props.remainingCapacity) {
    if (props.utilization <= 20) {
      return 'text-red-600 dark:text-red-400'
    } else if (props.utilization <= 50) {
      return 'text-amber-600 dark:text-amber-400'
    }
    return 'text-gray-600 dark:text-gray-400'
  }
  if (props.utilization >= 90) {
    return 'text-red-600 dark:text-red-400'
  } else if (props.utilization >= 75) {
    return 'text-amber-600 dark:text-amber-400'
  } else {
    return 'text-gray-600 dark:text-gray-400'
  }
})

// Bar width (capped at 100%)
const barWidth = computed(() => {
  return `${Math.min(Math.max(props.utilization, 0), 100)}%`
})

// Display percentage (cap at 999% for readability)
const displayPercent = computed(() => {
  const percent = Math.round(
    props.remainingCapacity
      ? Math.min(Math.max(props.utilization, 0), 100)
      : props.utilization
  )
  return percent > 999 ? '>999%' : `${percent}%`
})

const shouldShowResetTime = computed(() => {
  if (props.resetsAt) return true
  return Boolean(props.showNowWhenIdle && props.utilization <= 0)
})

// Format reset time
const formatResetTime = computed(() => {
  if (!props.resetsAt) {
    // Idle rolling window without a known reset time: treat as immediately available.
    return props.showNowWhenIdle && props.utilization <= 0 ? t('usage.resetNow') : '-'
  }

  const date = new Date(props.resetsAt)
  const diffMs = date.getTime() - now.value.getTime()

  // resetsAt 已过期：utilization>0 说明后端窗口数据还没刷新（active poll 没回写），
  // 显示「待刷新」以区别于真正可用的「现在」。
  if (diffMs <= 0) {
    return props.utilization > 0 ? t('usage.resetPending') : t('usage.resetNow')
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (diffHours >= 24) {
    const days = Math.floor(diffHours / 24)
    return `${days}d ${diffHours % 24}h`
  } else if (diffHours > 0) {
    return `${diffHours}h ${diffMins}m`
  } else {
    return `${diffMins}m`
  }
})

// 悬停显示重置的绝对时间；倒计时本身保持紧凑。
const resetTimeTitle = computed(() => {
  if (!props.resetsAt) return ''
  const date = new Date(props.resetsAt)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
})

// 紧凑模式的窗口用量：拆成可单独着色的片段，金额与预计总额比请求/Token 更醒目。
interface DenseStatsItem {
  key: string
  text: string
  title: string
  class?: string
}

const denseStatsItems = computed<DenseStatsItem[]>(() => {
  const stats = props.windowStats
  const items: DenseStatsItem[] = []
  // 与旧版徽章行一致：没有请求/Token 的窗口不单独占一行；
  // 只有 7d 的「预计总费用」可以在无统计时单独出现。
  if (stats && stats.requests <= 0 && stats.tokens <= 0 && props.estimatedTotalCost == null) {
    return items
  }
  if (stats && (stats.requests > 0 || stats.tokens > 0)) {
    items.push({
      key: 'requests',
      text: `${formatCompactNumber(stats.requests, { allowBillions: false })} req`,
      title: `${stats.requests} requests`
    })
    items.push({
      key: 'tokens',
      text: formatCompactNumber(stats.tokens),
      title: `${stats.tokens} ${t('usage.tokens')}`
    })
  }
  if (stats && stats.cost != null) {
    items.push({
      key: 'cost',
      text: `A $${stats.cost.toFixed(2)}`,
      title: t('usage.accountBilled'),
      class: 'font-medium text-gray-600 dark:text-gray-300'
    })
  }
  if (stats && stats.user_cost != null) {
    items.push({
      key: 'userCost',
      text: `U $${stats.user_cost.toFixed(2)}`,
      title: t('usage.userBilled'),
      class: 'font-medium text-gray-600 dark:text-gray-300'
    })
  }
  if (props.estimatedTotalCost != null) {
    items.push({
      key: 'estimate',
      text: t('admin.accounts.usageWindow.estimatedTotalCost', { cost: props.estimatedTotalCost.toFixed(2) }),
      title: t('admin.accounts.usageWindow.estimatedTotalCostTooltip'),
      class: 'font-medium text-gray-700 dark:text-gray-200'
    })
  }
  return items
})

// Window stats formatters
const formatRequests = computed(() => {
  if (!props.windowStats) return ''
  return formatCompactNumber(props.windowStats.requests, { allowBillions: false })
})

const formatTokens = computed(() => {
  if (!props.windowStats) return ''
  return formatCompactNumber(props.windowStats.tokens)
})

const formatAccountCost = computed(() => {
  if (!props.windowStats) return '0.00'
  return props.windowStats.cost.toFixed(2)
})

const formatUserCost = computed(() => {
  if (!props.windowStats || props.windowStats.user_cost == null) return '0.00'
  return props.windowStats.user_cost.toFixed(2)
})

</script>
