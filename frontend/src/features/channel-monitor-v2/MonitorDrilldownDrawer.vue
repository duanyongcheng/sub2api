<template>
  <BaseDialog :show="context != null" variant="drawer" drawer-width="640px" :title="t('channelMonitorV2.operations.drilldown')" @close="emit('close')">
    <div v-if="context" class="space-y-4">
      <div>
        <h3 class="text-base font-semibold text-ink">{{ context.label }}</h3>
        <p class="mt-1 text-xs leading-relaxed text-ink-3">{{ formatTime(context.filter.start) }} – {{ formatTime(context.filter.end) }}</p>
      </div>
      <div v-if="loading" class="rounded-xl bg-surface-2 p-8 text-center text-sm text-ink-3" role="status">{{ t('common.loading') }}</div>
      <div v-else-if="error" class="strip strip-bad flex-wrap" role="alert">
        {{ error }}<button type="button" class="btn btn-secondary btn-sm mt-3 block" @click="load">{{ t('common.tryAgain') }}</button>
      </div>
      <template v-else-if="snapshot">
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div v-for="metric in summary" :key="metric.label" class="rounded-xl border border-edge bg-surface-2 p-3">
            <p class="text-[11px] text-ink-3">{{ metric.label }}</p><strong class="mt-1 block text-lg tabular-nums text-ink">{{ metric.value }}</strong>
          </div>
        </div>
        <p v-if="snapshot.health.error_rate === 'unknown'" class="rounded-xl bg-surface-2 p-3 text-xs text-ink-2">{{ t('channelMonitorV2.operations.insufficient', { minimum: snapshot.health.minimum_sample }) }}</p>
        <div class="tabs flex flex-wrap" role="tablist" :aria-label="t('channelMonitorV2.operations.drillTabs')">
          <button v-for="item in (['overview', 'errors', 'history'] as const)" :key="item" type="button" role="tab" class="tab" :class="tab === item ? 'tab-active' : ''" :aria-selected="tab === item" @click="tab = item">{{ t(`channelMonitorV2.operations.drillViews.${item}`) }}</button>
        </div>
        <MonitorAttributionPanel v-if="tab === 'overview'" :rows="errors" :metrics="snapshot.metrics" :health="snapshot.health" @inspect="inspectOwner" />
        <section v-else-if="tab === 'errors'" class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <button v-for="owner in (['all', ...ERROR_OWNERS, 'unclassified'] as const)" :key="owner" type="button" class="btn btn-sm" :class="selectedOwner === owner ? 'btn-primary' : 'btn-secondary'" :aria-pressed="selectedOwner === owner" @click="selectedOwner = owner">{{ t(owner === 'all' ? 'channelMonitorV2.filters.allPlatforms' : `channelMonitorV2.operations.owners.${owner}`) }}</button>
          </div>
          <AvailabilityErrors v-if="visibleErrors.length" :rows="visibleErrors" admin />
          <p v-else class="py-6 text-center text-sm text-ink-3">{{ t('channelMonitorV2.operations.noOwnerErrors') }}</p>
        </section>
        <section v-else class="space-y-3">
          <h4 class="text-sm font-semibold text-ink">{{ t('channelMonitorV2.operations.timeline') }}</h4>
          <p class="text-xs text-ink-3">{{ t('channelMonitorV2.operations.timelineHint') }}</p>
          <div class="overflow-x-auto">
            <table class="table min-w-[450px]">
              <thead><tr><th>{{ t('channelMonitorV2.timeRange') }}</th><th>{{ t('channelMonitorV2.operations.availability') }}</th><th>{{ t('channelMonitorV2.operations.requests') }}</th><th>{{ t('channelMonitorV2.metrics.ttftP50') }}</th></tr></thead>
              <tbody><tr v-for="point in snapshot.trend" :key="point.bucket_start"><td class="text-xs">{{ formatTime(point.bucket_start) }}</td><td><StatusPill :tone="stateTone(operationsState(point.metrics, point.health))" :dot="false" :label="formatAvailability(point.metrics, point.health)" /></td><td>{{ point.metrics.request_count }}</td><td>{{ formatMonitorMs(point.metrics.ttft.p50_ms) }}</td></tr></tbody>
            </table>
          </div>
        </section>
      </template>
    </div>
    <template #footer>
      <RouterLink v-if="accountLocation && snapshot" :to="accountLocation" class="btn btn-secondary btn-sm">{{ t('channelMonitorV2.operations.openAccounts') }}</RouterLink>
      <button type="button" class="btn btn-primary btn-sm" @click="emit('close')">{{ t('common.close') }}</button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import * as api from '@/api/channelMonitorV2'
import type { HealthState, MonitorErrorRow, MonitorFilter, MonitorSnapshot } from '@/api/channelMonitorV2'
import BaseDialog from '@/components/common/BaseDialog.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import AvailabilityErrors from './AvailabilityErrors.vue'
import MonitorAttributionPanel from './MonitorAttributionPanel.vue'
import { ERROR_OWNERS, errorOwner, type AttributionOwner } from './ownership'
import { operationsState } from './monitorOperations'
import { formatAvailability } from './monitorAvailability'
import { formatMonitorMs } from './monitorFormat'
import { extractApiErrorMessage } from '@/utils/apiError'

export interface MonitorDrilldownContext { filter: MonitorFilter; label: string; owner?: AttributionOwner }
const props = defineProps<{ context: MonitorDrilldownContext | null }>()
const emit = defineEmits<{ close: [] }>()
const { t, locale } = useI18n()
const snapshot = ref<MonitorSnapshot | null>(null)
const errors = ref<MonitorErrorRow[]>([])
const loading = ref(false)
const error = ref('')
const tab = ref<'overview' | 'errors' | 'history'>('overview')
const selectedOwner = ref<AttributionOwner | 'all'>('all')
let controller: AbortController | undefined
let sequence = 0
const visibleErrors = computed(() => errors.value.filter(row => selectedOwner.value === 'all' || errorOwner(row.category) === selectedOwner.value))
const summary = computed(() => snapshot.value ? [
  { label: t('channelMonitorV2.operations.availability'), value: formatAvailability(snapshot.value.metrics, snapshot.value.health) },
  { label: t('channelMonitorV2.operations.requests'), value: snapshot.value.metrics.request_count },
  { label: t('channelMonitorV2.metrics.ttftP50'), value: formatMonitorMs(snapshot.value.metrics.ttft.p50_ms) },
  { label: t('channelMonitorV2.operations.healthScore'), value: snapshot.value.health.score == null ? '—' : snapshot.value.health.score.toFixed(1) },
] : [])
const accountLocation = computed(() => {
  const filter = props.context?.filter
  if (!filter || filter.platforms.length > 1 || filter.groupIds.length > 1) return null
  return { path: '/admin/accounts', query: { source: 'channel-monitor', platform: filter.platforms[0], group: filter.groupIds[0]?.toString() } }
})
function inspectOwner(owner: AttributionOwner) { selectedOwner.value = owner; tab.value = 'errors' }
function stateTone(state: HealthState) { return ({ healthy: 'ok', warning: 'warn', critical: 'bad', unknown: 'neutral' } as const)[state] }
function formatTime(value?: string) {
  return value ? new Intl.DateTimeFormat(locale.value || undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—'
}
async function load() {
  controller?.abort()
  const id = ++sequence
  snapshot.value = null
  errors.value = []
  error.value = ''
  if (!props.context) { loading.value = false; return }
  const request = new AbortController()
  controller = request
  loading.value = true
  const filter = props.context.filter
  try {
    const [nextSnapshot, nextErrors] = await Promise.all([api.getSnapshot(filter, true, request.signal), api.getErrors(filter, true, request.signal)])
    if (id !== sequence || request.signal.aborted) return
    snapshot.value = nextSnapshot
    errors.value = nextErrors.items
  } catch (cause) {
    if (id === sequence && !request.signal.aborted) error.value = extractApiErrorMessage(cause, t('channelMonitorV2.detailLoadFailed'))
  } finally { if (id === sequence) loading.value = false }
}
watch(() => props.context, context => {
  tab.value = context?.owner ? 'errors' : 'overview'
  selectedOwner.value = context?.owner || 'all'
  void load()
}, { immediate: true })
onBeforeUnmount(() => { ++sequence; controller?.abort() })
</script>
