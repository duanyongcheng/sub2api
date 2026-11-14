<template>
  <div class="border-t border-edge bg-surface-2/50 px-5 py-4" :aria-busy="loading">
    <div class="grid grid-cols-2 gap-px overflow-hidden rounded-field border border-edge bg-edge sm:grid-cols-4">
      <div v-for="metric in metrics" :key="metric.key" class="bg-surface px-4 py-3">
        <div class="text-[11px] font-medium leading-4 text-ink-2">{{ metric.label }}</div>
        <div v-if="loading" class="mt-1.5 h-6 w-20 animate-pulse rounded bg-surface-3" aria-hidden="true" />
        <div v-else class="mt-1 text-[20px] font-semibold leading-7 tracking-[-0.02em] tabular-nums" :class="metric.tone">{{ metric.value }}</div>
      </div>
    </div>
    <div v-if="margin !== null && margin < 0" class="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-4 text-red-600 dark:text-red-400" role="status">
      <Icon name="exclamationTriangle" size="xs" class="mt-0.5 shrink-0" />
      <span>{{ t('admin.groups.workspace.lossWarning') }}</span>
    </div>
    <p class="mt-2 text-[11px] leading-4 text-ink-2">
      {{ error ? t('admin.groups.workspace.economicsUnavailable') : t('admin.groups.workspace.marginBasis') }}
      <template v-if="projectedMargin !== null"> · {{ t('admin.groups.workspace.projectedMargin', { margin: projectedMargin.toFixed(1) }) }}</template>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { getGroupStats } from '@/api/admin/dashboard'
import { formatDateLocalInput } from '@/utils/format'
import type { AdminGroup, GroupStat } from '@/types'

const props = defineProps<{ group: AdminGroup; draftRate: number }>()
const { t } = useI18n()
const stats = ref<GroupStat | null>(null)
const loading = ref(false)
const error = ref(false)
let requestId = 0
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const margin = computed(() => {
  if (!stats.value || stats.value.actual_cost <= 0 || typeof stats.value.account_cost !== 'number') return null
  return (1 - stats.value.account_cost / stats.value.actual_cost) * 100
})
const projectedMargin = computed(() => {
  if (margin.value === null || !stats.value || props.group.rate_multiplier <= 0 || props.draftRate <= 0 || props.draftRate === props.group.rate_multiplier) return null
  const revenue = stats.value.actual_cost * props.draftRate / props.group.rate_multiplier
  return (1 - stats.value.account_cost! / revenue) * 100
})
const metrics = computed(() => [
  { key: 'revenue', label: t('admin.groups.workspace.todayRevenue'), value: stats.value ? usd.format(stats.value.actual_cost) : '—', tone: 'text-ink' },
  { key: 'cost', label: t('admin.groups.workspace.todayCost'), value: typeof stats.value?.account_cost === 'number' ? usd.format(stats.value.account_cost) : '—', tone: 'text-ink' },
  { key: 'margin', label: t('admin.groups.workspace.margin'), value: margin.value === null ? '—' : `${margin.value.toFixed(1)}%`, tone: margin.value !== null && margin.value < 0 ? 'text-red-600 dark:text-red-400' : 'text-ink' },
  { key: 'accounts', label: t('admin.groups.workspace.availableAccounts'), value: `${props.group.active_account_count ?? 0} / ${props.group.account_count ?? 0}`, tone: 'text-ink' }
])
watch(() => [props.group.id, props.group.updated_at], async () => {
  const currentRequest = ++requestId
  loading.value = true
  stats.value = null
  error.value = false
  const today = formatDateLocalInput(new Date())
  try {
    const response = await getGroupStats({ group_id: props.group.id, start_date: today, end_date: today })
    if (currentRequest !== requestId) return
    stats.value = response.groups.find(group => group.group_id === props.group.id) ?? null
  } catch {
    if (currentRequest === requestId) error.value = true
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}, { immediate: true })
</script>
