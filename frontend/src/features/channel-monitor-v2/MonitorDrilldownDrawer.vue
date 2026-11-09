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
        <section v-if="tab === 'overview'" class="space-y-3">
          <!-- 归因结论：占比 → 一句话结论 → 可执行动作（原型 13 号稿） -->
          <div class="rounded-xl border border-edge bg-surface-2 p-3">
            <p v-if="conclusionOwner" class="text-xs leading-relaxed text-ink" data-testid="drilldown-conclusion">
              <StatusPill :tone="ownerTone(conclusionOwner)" :dot="false" :label="t(`channelMonitorV2.operations.owners.${conclusionOwner}`)" class="mr-1.5 align-middle" />{{ t(`channelMonitorV2.operations.conclusion.${conclusionOwner}`, { rate: formatMonitorPercent(conclusion.share), category: conclusionLabel }) }}
            </p>
            <p v-else-if="sampleShort" class="text-xs leading-relaxed text-ink-2" data-testid="drilldown-conclusion">{{ t('channelMonitorV2.operations.conclusionSample', { count: snapshot.metrics.request_count, minimum: snapshot.health.minimum_sample }) }}</p>
            <p v-else class="text-xs leading-relaxed text-ink-2" data-testid="drilldown-conclusion">{{ t('channelMonitorV2.operations.conclusionClean') }}</p>
            <p v-if="conclusion.ignoredCount" class="mt-1 text-[11px] text-ink-3">{{ t('channelMonitorV2.operations.ignoredCount', { count: conclusion.ignoredCount }) }}</p>
            <div v-if="conclusion.actions.length" class="mt-2 flex flex-wrap gap-2">
              <RouterLink v-if="actions.includes('accounts') && accountLocation" :to="accountLocation" class="btn btn-secondary btn-sm" data-drill-action="accounts">{{ t('channelMonitorV2.operations.openAccounts') }}</RouterLink>
              <RouterLink v-if="actions.includes('ops')" :to="opsLocation" class="btn btn-secondary btn-sm" data-drill-action="ops">{{ t('channelMonitorV2.operations.actionOps') }}</RouterLink>
              <button v-if="actions.includes('ignore')" type="button" class="btn btn-secondary btn-sm" data-drill-action="ignore" @click="selectedOwner = 'client'; tab = 'errors'">{{ t('channelMonitorV2.operations.actionIgnore') }}</button>
              <button type="button" class="btn btn-ghost btn-sm" data-drill-action="copy" @click="copySamples">{{ copied ? t('channelMonitorV2.operations.copied') : t('channelMonitorV2.operations.actionCopy') }}</button>
              <ReportExportMenu
                :formats="['xlsx']"
                :label="t('channelMonitorV2.operations.reportExport.action')"
                :title="t('channelMonitorV2.operations.reportExport.hint')"
                :busy="exporting"
                data-drill-action="export"
                @export="exportRecap"
              />
            </div>
          </div>
          <MonitorAttributionPanel :rows="errors" :metrics="snapshot.metrics" :health="snapshot.health" @inspect="inspectOwner" />
        </section>
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
import { formatMonitorMs, formatMonitorPercent } from './monitorFormat'
import { extractApiErrorMessage } from '@/utils/apiError'
import { drilldownConclusion, type DrilldownConclusion } from './monitorDrilldown'
import { buildDrilldownWorkbook, type DrilldownReportLabels } from './monitorReport'
import ReportExportMenu from '@/components/common/ReportExportMenu.vue'
import { downloadReport, reportFileStem, type ExportFormat } from '@/utils/reportExport'

export interface MonitorDrilldownContext { filter: MonitorFilter; label: string; owner?: AttributionOwner }
const props = defineProps<{ context: MonitorDrilldownContext | null }>()
const emit = defineEmits<{ close: [] }>()
const { t, te, locale } = useI18n()
const snapshot = ref<MonitorSnapshot | null>(null)
const errors = ref<MonitorErrorRow[]>([])
const loading = ref(false)
const error = ref('')
const tab = ref<'overview' | 'errors' | 'history'>('overview')
const copied = ref(false)
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
const EMPTY_CONCLUSION: DrilldownConclusion = { owner: null, share: 0, category: null, categoryCount: 0, ignoredCount: 0, actions: [] }
const conclusion = computed<DrilldownConclusion>(() => snapshot.value
  ? drilldownConclusion(errors.value, snapshot.value.metrics, snapshot.value.health)
  : EMPTY_CONCLUSION)
const actions = computed(() => conclusion.value.actions)
const conclusionOwner = computed(() => conclusion.value.owner)
const sampleShort = computed(() => Boolean(snapshot.value && snapshot.value.health.error_rate === 'unknown'))
const conclusionLabel = computed(() => {
  const category = conclusion.value.category
  if (!category) return ''
  const key = `channelMonitorV2.errorCategories.${category}`
  return te(key) ? t(key) : category
})
/** Internal-owner failures land in the ops error list; deep link carries the platform/group scope. */
const opsLocation = computed(() => {
  const filter = props.context?.filter
  const query: Record<string, string> = { open_error_details: '1', error_type: 'request' }
  if (filter?.platforms.length === 1) query.platform = filter.platforms[0]
  if (filter?.groupIds.length === 1) query.group_id = String(filter.groupIds[0])
  return { path: '/admin/ops', query }
})
const accountLocation = computed(() => {
  const filter = props.context?.filter
  if (!filter || filter.platforms.length > 1 || filter.groupIds.length > 1) return null
  return { path: '/admin/accounts', query: { source: 'channel-monitor', platform: filter.platforms[0], group: filter.groupIds[0]?.toString() } }
})
function ownerTone(owner: AttributionOwner): 'ok' | 'warn' | 'bad' | 'neutral' | 'info' {
  return ({ upstream: 'warn', account: 'bad', client: 'neutral', internal: 'info', unclassified: 'neutral' } as const)[owner]
}
/** Copy the visible samples only — the prototype's 「复制请求示例」 counterpart. */
async function copySamples() {
  const rows = visibleErrors.value.slice(0, 10)
  const text = rows.map(row => `${row.category}\t${row.count}`).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    window.setTimeout(() => { copied.value = false }, 1500)
  } catch {
    copied.value = false
  }
}
/**
 * 导出复盘（原型 13）：把抽屉里看到的结论原样带走，覆盖范围与样本不足的
 * 说明一并写入，避免离线看表时把「尚未覆盖」当成 0%。
 */
const exporting = ref(false)
async function exportRecap(format: ExportFormat) {
  const context = props.context
  if (!context || !snapshot.value || exporting.value) return
  exporting.value = true
  try {
    const p = (key: string) => t(`channelMonitorV2.operations.reportExport.${key}`)
    const labels: DrilldownReportLabels = {
      sheet: p('sheet'), section: p('section'), item: p('item'), value: p('value'),
      category: p('category'), count: p('count'), share: p('share'), shareOfOwner: p('shareOfOwner'),
      owner: p('owner'), ignored: p('ignored'), yes: p('yes'), no: p('no'),
      scope: p('scope'), window: p('window'), coverage: p('coverage'),
      coverageComplete: p('coverageComplete'), coveragePartial: p('coveragePartial'),
      dataThrough: p('dataThrough'), bucket: p('bucket'),
      availability: p('availability'), requests: p('requests'), errors: p('errors'),
      ttftP50: p('ttftP50'), ttftP95: p('ttftP95'), healthScore: p('healthScore'),
      insufficient: p('insufficient'), conclusion: p('conclusion'), ignoredTotal: p('ignoredTotal'),
      owners: {
        upstream: t('channelMonitorV2.operations.owners.upstream'),
        account: t('channelMonitorV2.operations.owners.account'),
        client: t('channelMonitorV2.operations.owners.client'),
        internal: t('channelMonitorV2.operations.owners.internal'),
        unclassified: t('channelMonitorV2.operations.owners.unclassified'),
      },
    }
    // Name the file after the window that was actually exported, not today.
    const start = context.filter.start || snapshot.value.coverage.requested_start || ''
    const end = context.filter.end || snapshot.value.coverage.data_through || ''
    await downloadReport({
      sheets: buildDrilldownWorkbook({
        label: context.label,
        start: context.filter.start || '',
        end: context.filter.end || '',
        snapshot: snapshot.value,
        errors: errors.value,
        conclusion: conclusion.value,
        labels,
      }),
      format,
      fileName: reportFileStem('channel-monitor', filePart(start), filePart(end)),
    })
  } catch (cause) {
    console.error('Failed to export channel recap:', cause)
  } finally {
    exporting.value = false
  }
}

/** `2026-11-08T14:00:00Z` → `2026-11-08_1400` so the window is readable in the file name. */
function filePart(iso: string): string {
  if (!iso) return 'unknown'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'unknown'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`
}
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
