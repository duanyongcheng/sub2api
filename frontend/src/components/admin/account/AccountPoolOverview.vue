<template>
  <section class="pool-overview border-b border-edge bg-surface px-4 py-3" :aria-busy="loading || summariesLoading">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div class="flex min-w-0 flex-1 basis-full items-center justify-between gap-3 sm:basis-0">
        <div class="flex min-w-0 items-center gap-1.5">
          <h2 class="truncate text-base font-semibold leading-6 text-ink" :title="scopeName">{{ scopeName }}</h2>
          <details class="relative shrink-0">
            <summary class="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded text-ink-2 hover:text-ink" :aria-label="t('common.details')">
              <Icon name="infoCircle" size="sm" aria-hidden="true" />
            </summary>
            <p class="absolute left-0 top-full z-30 mt-1 w-64 max-w-[75vw] rounded-field border border-edge bg-surface p-3 text-xs leading-5 text-ink shadow-lg">{{ scopeDescription }}</p>
          </details>
        </div>
        <dl class="flex shrink-0 items-center gap-2 text-right">
          <dt class="max-w-28 text-xs leading-4 text-ink-2">{{ t('admin.accounts.workspace.matchingAccounts') }}</dt>
          <dd class="text-base font-semibold leading-6 tabular-nums text-ink">{{ loading && accounts.length === 0 ? '—' : total }}</dd>
        </dl>
      </div>
      <div v-if="$slots.actions" class="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
        <slot name="actions" />
      </div>
    </div>

    <dl v-if="isGroupScope" class="pool-metrics mt-3 grid" :class="simple ? 'grid-cols-1' : 'grid-cols-3'">
      <div class="pool-metric">
        <dt class="text-xs text-ink-2">{{ t('admin.accounts.workspace.available') }}</dt>
        <dd class="mt-1 flex items-baseline gap-1.5 tabular-nums">
          <span class="text-xl font-semibold leading-7 text-ink">{{ count(selectedGroup?.active_account_count) }}</span>
          <span class="text-sm text-ink-2">/ {{ count(selectedGroup?.account_count) }}</span>
        </dd>
        <dd class="mt-1 text-xs leading-5 text-ink-2">
          <template v-if="known(selectedGroup?.rate_limited_account_count)">
            {{ t('admin.accounts.workspace.limited') }} <span class="font-medium tabular-nums">{{ selectedGroup?.rate_limited_account_count }}</span>
          </template>
          <template v-else>{{ t('admin.accounts.workspace.groupMembers') }}</template>
        </dd>
      </div>

      <div v-if="!simple" class="pool-metric">
        <dt class="text-xs text-ink-2" :title="supportingCapacity.map(item => `${item.label}: ${item.used} / ${item.max}`).join(' · ')">{{ t('admin.accounts.workspace.concurrency') }}</dt>
        <dd class="mt-1 flex items-baseline gap-1.5 tabular-nums" :title="capacityError && capacity ? t('admin.accounts.workspace.lastSuccessful') : undefined">
          <span class="text-xl font-semibold leading-7 text-ink">{{ capacity ? capacity.concurrency_used : '—' }}</span>
          <span v-if="capacity" class="text-sm text-ink-2">/ {{ capacity.concurrency_max }}</span>
        </dd>
        <dd v-if="capacity && capacity.concurrency_max > 0" class="mt-1.5 h-1 max-w-48 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
          <div class="h-full rounded-full bg-primary-500" :style="{ width: `${capacityPercent}%` }" />
        </dd>
        <dd class="mt-1 text-xs leading-5 text-ink-2">
          <template v-if="capacity">{{ t('admin.accounts.workspace.remainingCapacity', { count: Math.max(0, capacity.concurrency_max - capacity.concurrency_used) }) }}</template>
          <template v-else>{{ t(summariesLoading ? 'common.loading' : 'admin.accounts.workspace.summaryUnavailable') }}</template>
        </dd>
      </div>

      <div v-if="!simple" class="pool-metric">
        <dt class="text-xs text-ink-2" :title="t('admin.accounts.workspace.userBilledHint')">{{ t('admin.accounts.workspace.userBilledToday') }}</dt>
        <dd class="mt-1 text-xl font-semibold leading-7 tabular-nums text-ink" :title="usageError && groupUsage ? t('admin.accounts.workspace.lastSuccessful') : undefined">
          {{ groupUsage ? formatCurrency(groupUsage.today_cost) : '—' }}
        </dd>
        <dd class="mt-1 text-xs leading-5 text-ink-2">
          {{ t(summariesLoading && !groupUsage ? 'common.loading' : 'admin.accounts.workspace.serverDay') }}
        </dd>
      </div>
    </dl>

    <div v-else class="mt-2">
      <p class="text-xs font-medium leading-5 text-ink-2">{{ t('admin.accounts.workspace.currentPage', { count: accounts.length }) }}</p>
      <dl class="pool-page-metrics mt-1 grid" :class="simple ? 'grid-cols-4' : 'grid-cols-5'">
        <div v-for="metric in pageMetrics" :key="metric.key" class="min-w-0">
          <dt class="text-xs leading-4 text-ink-2">{{ t(`admin.accounts.workspace.${metric.key}`) }}</dt>
          <dd class="flex items-center gap-1.5 text-lg font-semibold leading-7 tabular-nums text-ink">
            <span class="h-1.5 w-1.5 rounded-full" :class="metric.tone" aria-hidden="true" />{{ loading && accounts.length === 0 ? '—' : metric.value }}
          </dd>
        </div>
        <div v-if="!simple" class="min-w-0">
          <dt class="text-xs leading-4 text-ink-2">{{ t('admin.accounts.workspace.concurrency') }}</dt>
          <dd class="text-lg font-semibold leading-7 tabular-nums text-ink">{{ pageConcurrency }}</dd>
        </div>
      </dl>
    </div>

    <div v-if="isGroupScope && !simple && (capacityError || usageError)" class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-ink-2" role="status">
      <span class="inline-flex items-start gap-1.5">
        <Icon name="exclamationCircle" size="sm" class="mt-0.5 shrink-0 text-warn-600" aria-hidden="true" />
        <span>{{ summaryError }}<template v-if="hasStaleData"> {{ t('admin.accounts.workspace.lastSuccessful') }}</template></span>
      </span>
      <button type="button" class="inline-flex min-h-8 items-center gap-1 rounded-field px-1 font-semibold text-primary-700 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 disabled:cursor-wait disabled:opacity-60" :disabled="summariesLoading" @click="$emit('retry')">
        <Icon name="refresh" size="xs" aria-hidden="true" />{{ t('admin.accounts.workspace.retry') }}
      </button>
    </div>
    <p v-else-if="isGroupScope && !simple && !summariesLoading && (!capacity || !groupUsage)" class="mt-3 text-xs leading-5 text-ink-2">
      {{ t('admin.accounts.workspace.missingSummary') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { GROUP_PLATFORM_OPTIONS } from '@/constants/platforms'
import { formatCurrency } from '@/utils/format'
import type { AccountListItem, AdminGroup } from '@/types'
import type { AccountWorkspaceCapacity, AccountWorkspaceUsage } from '@/composables/useAccountWorkspace'
import { accountPoolState } from './accountPoolState'

const props = withDefaults(defineProps<{
  now?: number
  groups: AdminGroup[]
  group: string
  platform: string
  accounts: AccountListItem[]
  total: number
  capacities: Record<number, AccountWorkspaceCapacity>
  usage: Record<number, AccountWorkspaceUsage>
  loading: boolean
  summariesLoading: boolean
  capacityError: boolean
  usageError: boolean
  simple: boolean
}>(), { now: () => Date.now() })
defineEmits<{ retry: [] }>()
const { t } = useI18n()
const isGroupScope = computed(() => props.group !== '' && props.group !== 'ungrouped')
const selectedGroup = computed(() => props.groups.find((pool) => String(pool.id) === props.group))
const scopeName = computed(() => {
  if (props.group === 'ungrouped') return t('admin.accounts.workspace.ungrouped')
  if (isGroupScope.value) return selectedGroup.value?.name ?? t('admin.accounts.workspace.selectedGroup', { id: props.group })
  return GROUP_PLATFORM_OPTIONS.find((option) => option.value === props.platform)?.label ?? (props.platform || t('admin.accounts.workspace.allAccounts'))
})
const scopeDescription = computed(() => {
  if (isGroupScope.value) return t(props.simple ? 'admin.accounts.workspace.simpleGroupScope' : 'admin.accounts.workspace.groupScope')
  return t(props.group === 'ungrouped' ? 'admin.accounts.workspace.ungroupedScope' : 'admin.accounts.workspace.pageScope')
})
const known = (value: number | undefined): value is number => typeof value === 'number' && Number.isFinite(value)
const count = (value: number | undefined) => known(value) ? value : '—'
const capacity = computed(() => {
  if (!isGroupScope.value || props.simple) return undefined
  const value = props.capacities[Number(props.group)]
  return value && known(value.concurrency_used) && known(value.concurrency_max) ? value : undefined
})
const groupUsage = computed(() => {
  if (!isGroupScope.value || props.simple) return undefined
  const value = props.usage[Number(props.group)]
  return value && known(value.today_cost) ? value : undefined
})
const capacityPercent = computed(() => capacity.value && capacity.value.concurrency_max > 0
  ? Math.min(100, Math.max(0, capacity.value.concurrency_used / capacity.value.concurrency_max * 100)) : 0)
const supportingCapacity = computed(() => {
  if (!capacity.value) return []
  return [
    { label: t('admin.accounts.workspace.sessions'), used: capacity.value.sessions_used, max: capacity.value.sessions_max },
    { label: 'RPM', used: capacity.value.rpm_used, max: capacity.value.rpm_max }
  ].filter((item) => known(item.max) && item.max > 0 && known(item.used))
})
const summaryError = computed(() => t(props.capacityError && props.usageError
  ? 'admin.accounts.workspace.summariesFailed'
  : props.capacityError ? 'admin.accounts.workspace.capacityFailed' : 'admin.accounts.workspace.usageFailed'))
const hasStaleData = computed(() => (props.capacityError && capacity.value) || (props.usageError && groupUsage.value))
const pageMetrics = computed(() => {
  const counts = { available: 0, degraded: 0, error: 0, paused: 0 }
  for (const account of props.accounts) counts[accountPoolState(account, props.now)]++
  return [
    { key: 'pageAvailable', value: counts.available, tone: 'bg-ok-500' },
    { key: 'pageLimited', value: counts.degraded, tone: 'bg-warn-500' },
    { key: 'pageError', value: counts.error, tone: 'bg-bad-500' },
    { key: 'pagePaused', value: counts.paused, tone: 'bg-ink-3' }
  ]
})
const pageConcurrency = computed(() => {
  if ((props.loading && props.accounts.length === 0) || !props.accounts.every((account) => known(account.current_concurrency) && known(account.concurrency))) return '—'
  const used = props.accounts.reduce((sum, account) => sum + (account.current_concurrency ?? 0), 0)
  const max = props.accounts.reduce((sum, account) => sum + account.concurrency, 0)
  return `${used} / ${max}`
})
</script>

<style scoped>
.pool-metric { min-width: 0; }
.pool-metric + .pool-metric { @apply border-l border-edge pl-3 sm:pl-5; }
.pool-page-metrics > div + div { @apply border-l border-edge pl-2 sm:pl-4; }
.pool-page-metrics dt { overflow-wrap: anywhere; }
@media (max-width: 639px) {
  .pool-overview { padding-left: 12px; padding-right: 12px; }
  .pool-metric dd { font-size: 12px; line-height: 16px; }
  .pool-metric dd > .text-xl { font-size: 18px; line-height: 24px; }
  .pool-page-metrics dd { font-size: 16px; line-height: 24px; }
}
</style>
