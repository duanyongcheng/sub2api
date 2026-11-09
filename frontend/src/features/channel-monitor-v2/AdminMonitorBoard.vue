<template>
  <div class="space-y-4" data-testid="admin-monitor-board">
    <section v-if="data" class="card flex flex-wrap items-center gap-3 px-4 py-3" aria-live="polite">
      <StatusPill :tone="degradedModels.length ? 'warn' : insufficient ? 'neutral' : 'ok'" :label="t(insufficient ? 'channelMonitorV2.operations.unknownVerdict' : degradedModels.length ? 'channelMonitorV2.operations.degradedVerdict' : 'channelMonitorV2.operations.healthyVerdict', { count: degradedModels.length })" />
      <span v-if="!insufficient" class="text-xs text-ink-2">{{ t('channelMonitorV2.operations.errorShare', { value: formatMonitorPercent(data.snapshot.metrics.error_rate) }) }}</span>
      <span v-if="dominant" class="text-xs text-ink-2">{{ t('channelMonitorV2.operations.dominantCause', { category: categoryLabel(dominant.category), value: formatMonitorPercent(dominant.rate) }) }}</span>
      <div class="flex flex-wrap items-center gap-2 lg:ml-auto">
        <button v-for="model in degradedModels.slice(0, 2)" :key="`${model.platform}:${model.model}`" type="button" class="btn btn-secondary btn-sm !py-1 text-xs" :disabled="busy" @click="openModel(model)">{{ model.model === '__other__' ? t('channelMonitorV2.otherModels') : model.model }}</button>
        <button type="button" class="btn btn-sm" :class="issuesOnly ? 'btn-primary' : 'btn-secondary'" :aria-pressed="issuesOnly" @click="issuesOnly = !issuesOnly">{{ t('channelMonitorV2.availability.issuesOnly') }}</button>
        <button type="button" class="btn btn-primary btn-sm" :disabled="busy" @click="openScope()">{{ t('channelMonitorV2.operations.viewAttribution') }}</button>
      </div>
    </section>

    <section class="card space-y-3 p-4" :aria-label="t('channelMonitorV2.timeRange')">
      <div class="flex flex-wrap items-center gap-2">
        <div class="tabs inline-flex" role="group" :aria-label="t('channelMonitorV2.timeRange')">
          <button v-for="range in ranges" :key="range" type="button" class="tab !px-3 !py-1.5 text-xs" :class="filter.range === range ? 'tab-active' : ''" :aria-pressed="filter.range === range" @click="filter.range = range">{{ t(`channelMonitorV2.ranges.${range}`) }}</button>
        </div>
        <div class="tabs inline-flex" role="tablist" :aria-label="t('channelMonitorV2.operations.evidence')">
          <button v-for="option in evidenceOptions" :key="option.value" type="button" role="tab" class="tab !px-3 !py-1.5 text-xs" :class="evidence === option.value ? 'tab-active' : ''" :aria-selected="evidence === option.value" @click="evidence = option.value">{{ t(`channelMonitorV2.operations.evidenceModes.${option.value}`, { count: option.count }) }}</button>
        </div>
        <Select v-model="groupBy" class="operations-select w-44" :options="groupByOptions" :aria-label="t('channelMonitorV2.groupBy.label')" />
        <FilterMultiSelect v-model="groupIds" compact :label="t('channelMonitorV2.filters.group')" :all-label="t('channelMonitorV2.filters.allGroups')" :options="groupOptions" />
        <FilterMultiSelect v-model="filter.models" compact :label="t('channelMonitorV2.filters.model')" :all-label="t('channelMonitorV2.filters.allModels')" :options="modelOptions" />
        <button type="button" class="btn btn-ghost btn-sm" @click="resetFilters">{{ t('channelMonitorV2.clearFilters') }}</button>
      <div v-if="evidence !== 'probes'" class="flex items-center gap-2 lg:ml-auto">
          <span v-if="busy && data" class="inline-flex items-center gap-1.5 text-[11px] text-ink-3" data-testid="monitor-refreshing">
            <LoadingSpinner size="sm" />{{ lastSuccessAt ? t('channelMonitorV2.operations.refreshing', { time: lastSuccessAt }) : t('channelMonitorV2.operations.updatingBadge') }}
          </span>
          <button type="button" class="btn btn-secondary btn-sm" :disabled="busy" @click="manualRefresh"><Icon name="refresh" size="sm" :class="busy ? 'animate-spin' : ''" />{{ t('common.refresh') }}</button>
          <button type="button" class="btn btn-secondary btn-sm" @click="emit('settings')"><Icon name="cog" size="sm" />{{ t('channelMonitorV2.operations.settings') }}</button>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 border-t border-edge pt-3" role="group" :aria-label="t('channelMonitorV2.filters.platform')">
        <button type="button" class="btn btn-sm" :class="!filter.platforms.length ? 'btn-primary' : 'btn-ghost'" :aria-pressed="!filter.platforms.length" @click="filter.platforms = []">{{ t('channelMonitorV2.filters.allPlatforms') }}</button>
        <button v-for="platform in dimensions.platforms" :key="platform.value" type="button" class="btn btn-sm" :class="filter.platforms.includes(platform.value) ? 'btn-primary' : 'btn-ghost'" :aria-pressed="filter.platforms.includes(platform.value)" @click="togglePlatform(platform.value)">{{ platformLabel(platform.value) }}</button>
        <span v-if="data" class="text-[11px] text-ink-3 lg:ml-auto">{{ t('channelMonitorV2.updatedTo', { time: formatTime(data.snapshot.coverage.data_through) }) }}</span>
      </div>
    </section>

    <div v-if="data?.snapshot.coverage.bootstrap?.active" class="strip strip-info flex-wrap" role="status">
      <span class="font-semibold">{{ t('channelMonitorV2.bootstrap.title') }}</span><span>{{ t('channelMonitorV2.bootstrap.progress', { percent: bootstrapPercent }) }}</span>
      <p class="w-full text-xs">{{ t('channelMonitorV2.operations.backfillHint') }}</p>
      <progress class="h-1.5 w-full accent-primary-500" :value="bootstrapPercent" max="100" :aria-label="t('channelMonitorV2.bootstrap.working')" />
    </div>
    <div v-else-if="data && !data.snapshot.coverage.coverage_complete" class="strip strip-info" role="status">{{ t('channelMonitorV2.operations.partialHint') }}</div>
    <div v-if="error" class="strip strip-bad" role="alert">{{ error }}<button type="button" class="btn btn-secondary btn-sm ml-auto" :disabled="busy" @click="reload">{{ t('common.tryAgain') }}</button></div>
    <div v-if="busy" class="flex items-center gap-2 text-xs text-ink-3" role="status"><LoadingSpinner size="sm" />{{ t(data ? 'channelMonitorV2.operations.refreshRetained' : 'common.loading') }}</div>
    <div v-if="insufficient" class="strip strip-info" role="status">{{ t('channelMonitorV2.operations.insufficient', { minimum: data?.snapshot.health.minimum_sample }) }}</div>

    <div v-if="data" class="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]" :class="busy ? 'pointer-events-none opacity-60' : ''" :aria-busy="busy">
      <div v-if="evidence !== 'probes'" class="min-w-0 space-y-4" :class="evidence === 'traffic' ? '2xl:col-span-2' : ''">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs text-ink-3">{{ t('channelMonitorV2.operations.scopeLabel', { range: data.filter.range, count: data.matrix.items.length }) }}</p>
          <label class="w-full sm:w-60"><input v-model="search" type="search" class="input !py-1.5 !text-xs" :aria-label="t('channelMonitorV2.availability.search')" :placeholder="t('channelMonitorV2.availability.search')" /></label>
        </div>
        <div v-if="!visibleRows.length" class="card p-10 text-center">
          <Icon :name="hasFilters ? 'filter' : 'search'" size="lg" class="mx-auto text-ink-3" />
          <h3 class="mt-3 text-sm font-semibold text-ink">{{ t(hasFilters ? 'channelMonitorV2.operations.emptyFilteredTitle' : 'channelMonitorV2.operations.emptyScopeTitle') }}</h3>
          <p class="mt-2 text-xs text-ink-3">{{ t(hasFilters ? 'channelMonitorV2.operations.emptyFilteredHint' : 'channelMonitorV2.operations.emptyScopeHint') }}</p>
          <div v-if="hasFilters" class="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button v-for="hint in relaxHints" :key="hint.key" type="button" class="btn btn-secondary btn-sm" :data-relax="hint.key" @click="relax(hint.key)">{{ t(hint.label) }}</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="resetFilters">{{ t('channelMonitorV2.clearFilters') }}</button>
          </div>
        </div>
        <RelayPulseMatrix v-else :rows="visibleRows" :coverage="data.matrix.coverage" health-mode="overall" operations :load-cause="loadCause" @select="openRow" />
        <MonitorTrendChart :trend="data.snapshot.trend" :coverage="data.snapshot.coverage" operations />
      </div>
      <aside v-if="evidence !== 'probes' && evidence !== 'traffic'" class="min-w-0 space-y-4">
        <MonitorAttributionPanel :rows="data.errors" :metrics="data.snapshot.metrics" :health="data.snapshot.health" @inspect="openScope" />
        <MonitorProbePanel :items="probeItems" :total="probeTotal" :loading="probeLoading" :error="probeError" @manage="emit('probes')" />
      </aside>
      <aside v-if="evidence === 'traffic'" class="min-w-0"><MonitorAttributionPanel :rows="data.errors" :metrics="data.snapshot.metrics" :health="data.snapshot.health" @inspect="openScope" /></aside>
      <div v-if="evidence === 'probes'" class="min-w-0 2xl:col-span-2"><MonitorProbePanel :items="probeItems" :total="probeTotal" :loading="probeLoading" :error="probeError" @manage="emit('probes')" /></div>
    </div>
    <div v-else-if="busy && manual" class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" aria-hidden="true" data-testid="monitor-skeleton"><div class="h-80 animate-pulse rounded-2xl bg-surface-3" /><div class="h-80 animate-pulse rounded-2xl bg-surface-3" /></div>
    <MonitorDrilldownDrawer :context="drilldown" @close="drilldown = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import * as api from '@/api/channelMonitorV2'
import type { MonitorDimensions, MonitorErrorRow, MonitorFilter, MonitorMatrixGroupBy, MonitorMatrixResponse, MonitorMatrixRow, MonitorModelRow, MonitorRange, MonitorSnapshot } from '@/api/channelMonitorV2'
import { adminAPI } from '@/api/admin'
import type { ChannelMonitor } from '@/api/admin/channelMonitor'
import Select from '@/components/common/Select.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Icon from '@/components/icons/Icon.vue'
import FilterMultiSelect from './FilterMultiSelect.vue'
import RelayPulseMatrix from './RelayPulseMatrix.vue'
import MonitorTrendChart from './MonitorTrendChart.vue'
import MonitorAttributionPanel from './MonitorAttributionPanel.vue'
import MonitorDrilldownDrawer, { type MonitorDrilldownContext } from './MonitorDrilldownDrawer.vue'
import MonitorProbePanel from './MonitorProbePanel.vue'
import { fixedMonitorFilter, isOperationsIssue, operationsRows, operationsState } from './monitorOperations'
import { relaxSuggestions } from './monitorBoundaries'
import { monitorRowKey, monitorRowLabel } from './monitorAvailability'
import { formatMonitorPercent } from './monitorFormat'
import type { AttributionOwner } from './ownership'
import { extractApiErrorMessage } from '@/utils/apiError'
import { platformLabel } from '@/utils/platformColors'

interface BoardData { filter: MonitorFilter; snapshot: MonitorSnapshot; matrix: MonitorMatrixResponse; models: MonitorModelRow[]; errors: MonitorErrorRow[] }
const emit = defineEmits<{ settings: []; probes: [] }>()
const { t, te, locale } = useI18n()
const ranges: MonitorRange[] = ['90m', '24h', '7d', '30d']
const filter = ref<MonitorFilter>({ range: '24h', platforms: [], groupIds: [], models: [] })
const groupBy = ref<MonitorMatrixGroupBy>('platform_model')
const search = ref('')
const issuesOnly = ref(false)
const evidence = ref<'traffic' | 'probes' | 'all'>('all')
const busy = ref(false)
const error = ref('')
const dimensions = ref<MonitorDimensions>({ platforms: [], groups: [], models: [] })
const data = ref<BoardData | null>(null)
const probeItems = ref<ChannelMonitor[]>([])
const probeTotal = ref(0)
const probeLoading = ref(false)
const probeError = ref('')
const drilldown = ref<MonitorDrilldownContext | null>(null)
/** Last successful load time, shown while a refresh keeps old data (原型 13 状态 ③). */
const lastSuccessAt = ref('')
/** Only an explicit click may replace the old data with a skeleton. */
const manual = ref(false)
const groupIds = computed({ get: () => filter.value.groupIds.map(String), set: (ids: string[]) => { filter.value.groupIds = ids.map(Number).filter(id => Number.isInteger(id) && id > 0) } })
const groupByOptions = computed(() => (['platform', 'platform_group', 'platform_model', 'platform_group_model'] as const).map((value, index) => ({ value, label: t(`channelMonitorV2.groupBy.${['platform', 'platformGroup', 'platformModel', 'platformGroupModel'][index]}`) })))
const inPlatform = (item: { platform?: string }) => !filter.value.platforms.length || !item.platform || filter.value.platforms.includes(item.platform)
const groupOptions = computed(() => dimensions.value.groups.filter(inPlatform).map(item => ({ value: String(item.id), label: `${item.platform ? `${platformLabel(item.platform)} / ` : ''}${item.name}` })))
const modelOptions = computed(() => [...new Map(dimensions.value.models.filter(inPlatform).map(item => [item.value, { value: item.value, label: item.label || item.value }])).values()])
const hasFilters = computed(() => filter.value.platforms.length + filter.value.groupIds.length + filter.value.models.length > 0 || Boolean(search.value) || issuesOnly.value)
const visibleRows = computed(() => operationsRows(data.value?.matrix.items || [], search.value, issuesOnly.value))
const degradedModels = computed(() => (data.value?.models || []).filter(isOperationsIssue).sort((a, b) => b.metrics.error_rate - a.metrics.error_rate))
const dominant = computed(() => data.value?.errors.filter(row => !row.ignored).sort((a, b) => b.count - a.count)[0])
const insufficient = computed(() => Boolean(data.value && (operationsState(data.value.snapshot.metrics, data.value.snapshot.health) === 'unknown' ||
  data.value.matrix.items.length > 0 && data.value.matrix.items.every(row => operationsState(row.metrics, row.health) === 'unknown'))))
const bootstrapPercent = computed(() => Math.max(0, Math.min(100, data.value?.snapshot.coverage.bootstrap?.progress_percent || 0)))
const evidenceOptions = computed(() => [
  { value: 'traffic' as const, count: data.value?.matrix.items.length || 0 },
  { value: 'probes' as const, count: probeTotal.value },
  { value: 'all' as const, count: (data.value?.matrix.items.length || 0) + probeTotal.value },
])
const causeCache = new Map<string, string>()
let controller: AbortController | undefined
let sequence = 0
let timer: ReturnType<typeof setTimeout> | undefined

function categoryLabel(category: string) { const key = `channelMonitorV2.errorCategories.${category}`; return te(key) ? t(key) : category }
function formatTime(value: string) { return new Intl.DateTimeFormat(locale.value || undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function togglePlatform(platform: string) {
  filter.value = { ...filter.value, platforms: filter.value.platforms.includes(platform) ? filter.value.platforms.filter(item => item !== platform) : [...filter.value.platforms, platform], groupIds: [], models: [] }
}
function resetFilters() { search.value = ''; issuesOnly.value = false; filter.value = { ...filter.value, platforms: [], groupIds: [], models: [] } }
/** Relax one condition instead of wiping all of them (原型 13 状态 ④). */
const relaxHints = computed(() => relaxSuggestions({ ...filter.value, search: search.value, issuesOnly: issuesOnly.value })
  .map(key => ({ key, label: `channelMonitorV2.operations.relax.${key}` })))
function relax(key: 'platform' | 'group' | 'model' | 'search' | 'issues') {
  if (key === 'platform') filter.value = { ...filter.value, platforms: [], groupIds: [], models: [] }
  else if (key === 'group') filter.value = { ...filter.value, groupIds: [] }
  else if (key === 'model') filter.value = { ...filter.value, models: [] }
  else if (key === 'search') search.value = ''
  else issuesOnly.value = false
}
function openScope(owner?: AttributionOwner) {
  if (!data.value || busy.value) return
  drilldown.value = { label: t('channelMonitorV2.summaryAria'), filter: fixedMonitorFilter(data.value.filter, data.value.snapshot.coverage), owner }
}
function openRow(row: MonitorMatrixRow, start?: string) {
  if (!data.value || busy.value) return
  drilldown.value = { label: `${platformLabel(row.platform)} / ${monitorRowLabel(row, t('channelMonitorV2.otherModels'))}`, filter: fixedMonitorFilter(data.value.filter, data.value.matrix.coverage, row, start) }
}
function openModel(model: MonitorModelRow) { openRow({ ...model, buckets: [] }) }
async function loadCause(row: MonitorMatrixRow, start: string, signal: AbortSignal) {
  const current = data.value
  if (!current) return ''
  const key = `${monitorRowKey(row)}:${start}:${locale.value}`
  if (causeCache.has(key)) return causeCache.get(key)!
  const result = await api.getErrors(fixedMonitorFilter(current.filter, current.matrix.coverage, row, start), true, signal)
  const top = result.items.filter(item => !item.ignored).sort((a, b) => b.count - a.count)[0]
  const label = top ? t('channelMonitorV2.operations.dominantCause', { category: categoryLabel(top.category), value: formatMonitorPercent(top.rate) }) : t('channelMonitorV2.operations.noCountedErrors')
  if (!signal.aborted && current === data.value) causeCache.set(key, label)
  return label
}
function scheduleRefresh() {
  clearTimeout(timer)
  const seconds = data.value?.snapshot.coverage.bootstrap?.active ? 10 : data.value?.snapshot.config.refresh_interval_seconds || 300
  timer = setTimeout(() => {
    if (!document.hidden && !busy.value) void reload()
    else scheduleRefresh()
  }, seconds * 1000)
}
async function reload() {
  controller?.abort()
  clearTimeout(timer)
  const request = new AbortController()
  controller = request
  const id = ++sequence
  const selected: MonitorFilter = { ...filter.value, platforms: [...filter.value.platforms], groupIds: [...filter.value.groupIds], models: [...filter.value.models] }
  const grouping = groupBy.value
  busy.value = true
  error.value = ''
  try {
    const snapshot = await api.getSnapshot(selected, true, request.signal)
    if (id !== sequence || request.signal.aborted) return
    const fixed = fixedMonitorFilter(selected, snapshot.coverage)
    probeLoading.value = true
    probeError.value = ''
    const probePromise = adminAPI.channelMonitor.list({ page: 1, page_size: 200 }, { signal: request.signal })
      .then(result => ({ result, error: '' }))
      .catch(cause => ({ result: null, error: request.signal.aborted ? '' : extractApiErrorMessage(cause, t('channelMonitorV2.operations.probeLoadFailed')) }))
      .finally(() => { if (id === sequence) probeLoading.value = false })
    const [matrix, models, errors, catalog, probes] = await Promise.all([
      api.getMatrix(fixed, grouping, true, request.signal),
      api.getModels(fixed, true, request.signal), api.getErrors(fixed, true, request.signal),
      api.getDimensions({ range: selected.range, platforms: [], groupIds: [], models: [] }, true, request.signal),
      probePromise,
    ])
    if (id !== sequence || request.signal.aborted) return
    data.value = { filter: selected, snapshot, matrix, models: models.items, errors: errors.items }
    lastSuccessAt.value = formatTime(snapshot.coverage.data_through)
    dimensions.value = catalog
    probeItems.value = probes.result?.items || []
    probeTotal.value = probes.result?.total || 0
    probeError.value = probes.error
    causeCache.clear()
  } catch (cause) {
    if (id === sequence && !request.signal.aborted) error.value = extractApiErrorMessage(cause, t('channelMonitorV2.loadFailed'))
  } finally {
    if (id === sequence) { busy.value = false; manual.value = false; scheduleRefresh() }
  }
}
function manualRefresh() { manual.value = true; drilldown.value = null; void reload() }
watch([filter, groupBy], () => { drilldown.value = null; void reload() }, { deep: true, immediate: true })
onBeforeUnmount(() => { ++sequence; clearTimeout(timer); controller?.abort() })
</script>

<style scoped>
.operations-select :deep(.select-trigger) { @apply h-8 rounded-lg px-2.5 py-1 text-xs; }
</style>
