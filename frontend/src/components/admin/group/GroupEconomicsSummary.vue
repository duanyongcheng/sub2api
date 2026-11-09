<template>
  <div class="space-y-3">
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" :aria-busy="loading">
      <div v-for="metric in metrics" :key="metric.label" class="rounded-field border border-edge bg-surface-2 px-3 py-3">
        <div class="text-[11px] font-medium text-ink-3">{{ metric.label }}</div>
        <div class="mt-1 text-lg font-semibold tabular-nums" :class="metric.tone || 'text-ink'">{{ loading ? '—' : metric.value }}</div>
      </div>
    </div>
    <div v-if="margin !== null && margin < 0" class="rounded-field bg-red-500/10 px-3 py-2 text-xs text-red-600" role="status">{{ t('admin.groups.workspace.lossWarning') }}</div>
    <p class="text-xs text-ink-3">
      {{ error ? t('admin.groups.workspace.economicsUnavailable') : t('admin.groups.workspace.marginBasis') }}
      <template v-if="projectedMargin !== null"> · {{ t('admin.groups.workspace.projectedMargin', { margin: projectedMargin.toFixed(1) }) }}</template>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getGroupStats } from '@/api/admin/dashboard'
import { formatDateLocalInput } from '@/utils/format'
import type { AdminGroup, GroupStat } from '@/types'

const props = defineProps<{ group: AdminGroup; draftRate: number }>()
const { t } = useI18n()
const stats = ref<GroupStat | null>(null)
const loading = ref(false)
const error = ref(false)
let requestId = 0
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
  { label: t('admin.groups.workspace.todayRevenue'), value: stats.value ? `$${stats.value.actual_cost.toFixed(2)}` : '—' },
  { label: t('admin.groups.workspace.todayCost'), value: typeof stats.value?.account_cost === 'number' ? `$${stats.value.account_cost.toFixed(2)}` : '—' },
  { label: t('admin.groups.workspace.margin'), value: margin.value === null ? '—' : `${margin.value.toFixed(1)}%`, tone: margin.value !== null && margin.value < 0 ? 'text-red-600' : 'text-ink' },
  { label: t('admin.groups.workspace.availableAccounts'), value: `${props.group.active_account_count ?? 0} / ${props.group.account_count ?? 0}` }
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
