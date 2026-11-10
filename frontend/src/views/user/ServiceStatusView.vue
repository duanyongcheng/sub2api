<template>
  <component :is="embedded ? 'div' : AppLayout">
    <div class="min-w-0 space-y-4 pb-8">
      <section class="card !rounded-2xl !border-0 ring-1 ring-edge" :aria-label="t('channelMonitorV2.service.bannerOverview')" data-testid="service-banner">
        <div class="page-header mb-0 flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
          <div class="min-w-0 flex-1">
            <h1 class="page-title flex flex-wrap items-center gap-2">
              <span class="inline-flex h-8 w-8 items-center justify-center rounded-xl" :class="bannerTone.box"><Icon name="chart" size="sm" /></span>
              {{ t('channelMonitorV2.service.title') }}
              <span class="inline-flex rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" data-evidence="traffic">{{ t('channelMonitorV2.service.evidenceTraffic') }}</span>
              <span class="text-[10px] font-medium text-ink-3" data-testid="service-scope">{{ t(isAdmin ? 'channelMonitorV2.dashboard.scopeAdmin' : 'channelMonitorV2.dashboard.scopeUser') }}</span>
            </h1>
            <div class="page-description mt-1.5 flex items-start gap-2 text-xs">
              <span class="mt-1 h-2 w-2 shrink-0 rounded-full" :class="updating ? 'bg-gray-400' : bannerTone.dot" aria-hidden="true" />
              <span v-if="updating" class="inline-flex min-w-0 items-center gap-1 text-primary-600 dark:text-primary-300" data-testid="service-refreshing"><LoadingSpinner size="sm" />{{ lastSuccessAt ? t('channelMonitorV2.refreshingSince', { time: lastSuccessAt }) : t('channelMonitorV2.updating') }}</span>
              <span v-else class="min-w-0">{{ subtitle }}</span>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <p class="font-semibold" :class="bannerTone.text" data-testid="service-verdict">{{ verdictTitle }}</p>
              <p class="text-ink-3">{{ verdictDescription }}</p>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm h-8 w-8 shrink-0 !px-0 sm:w-auto sm:!px-3" :title="t('common.refresh')" :aria-label="t('common.refresh')" :disabled="updating" data-testid="service-refresh" @click="reload(true, true)">
            <Icon name="refresh" size="sm" :class="updating ? 'animate-spin' : ''" /><span class="hidden sm:inline">{{ t('common.refresh') }}</span>
          </button>
        </div>

        <div class="service-dashboard-toolbar flex flex-wrap items-center gap-2 border-t border-edge px-4 py-3 sm:px-5" data-testid="service-toolbar">
          <div class="tabs inline-flex max-w-full" role="group" :aria-label="t('channelMonitorV2.timeRange')">
            <button v-for="option in ranges" :key="option.value" type="button" class="tab !px-2 !py-1 text-xs sm:!px-2.5" :class="filter.range === option.value ? 'tab-active' : ''" :aria-pressed="filter.range === option.value" :data-service-range="option.value" @click="filter.range = option.value">{{ option.label }}</button>
          </div>
          <Select v-model="groupBy" :options="dimensionOptions" :aria-label="t('channelMonitorV2.groupBy.label')" class="service-dashboard-select w-40 max-w-full" data-testid="service-group-by" />
          <button type="button" class="btn btn-ghost btn-sm !px-2 !py-1 text-xs" :disabled="!hasFilters" data-testid="service-reset" @click="resetFilters">{{ t('channelMonitorV2.clearFilters') }}</button>
          <div class="tabs inline-flex max-w-full xl:ml-auto" role="group" :aria-label="t('channelMonitorV2.dashboard.viewLabel')">
            <button v-for="option in layouts" :key="option" type="button" class="tab !px-2 !py-1 text-xs" :class="layout === option ? 'tab-active' : ''" :aria-pressed="layout === option" :data-service-layout="option" @click="layout = option">{{ t(`channelMonitorV2.dashboard.views.${option}`) }}</button>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-1.5 border-t border-edge px-4 py-2 sm:px-5" role="group" :aria-label="t('channelMonitorV2.filters.platform')" data-testid="service-platform-filter">
          <button type="button" class="btn btn-sm !px-2.5 !py-1 text-xs" :class="filter.platforms.length ? 'btn-ghost' : 'btn-primary'" :aria-pressed="!filter.platforms.length" data-service-platform="all" @click="filter.platforms = []">{{ t('channelMonitorV2.filters.allPlatforms') }}</button>
          <button v-for="option in platformOptions" :key="option.value" type="button" class="btn btn-sm !px-2.5 !py-1 text-xs" :class="filter.platforms.includes(option.value) ? 'btn-secondary ring-1 ring-primary-500/40' : 'btn-ghost'" :aria-pressed="filter.platforms.includes(option.value)" :data-service-platform="option.value" @click="togglePlatform(option.value)"><span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ backgroundColor: platformAccentColor(option.value) }" aria-hidden="true" />{{ option.label }}</button>
        </div>
        <div v-if="filter.models.length || catalogLoading || catalogError" class="flex flex-wrap items-center gap-2 border-t border-edge px-4 py-2 text-xs sm:px-5">
          <span v-for="model in filter.models" :key="model" class="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-50 py-1 pl-2.5 pr-1 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" data-testid="service-selected-model">
            <span class="min-w-0 truncate" :title="model">{{ t('channelMonitorV2.dashboard.selectedModel', { model }) }}</span>
            <button type="button" class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 dark:hover:bg-primary-500/20" :aria-label="`${t('channelMonitorV2.clearFilters')}: ${model}`" data-testid="service-remove-model" @click="removeModel(model)"><Icon name="x" size="xs" /></button>
          </span>
          <span v-if="catalogLoading" class="inline-flex items-center gap-1 text-ink-3" role="status"><LoadingSpinner size="sm" />{{ t('channelMonitorV2.filters.platform') }} · {{ t('common.loading') }}</span>
          <span v-if="catalogError" class="flex flex-wrap items-center gap-2 text-red-600 dark:text-red-400" role="alert" data-testid="service-catalog-error">{{ t('channelMonitorV2.filters.platform') }}: {{ catalogError }}<button type="button" class="btn btn-secondary btn-sm !py-0.5 text-xs" :disabled="catalogLoading" @click="loadCatalog">{{ t('common.tryAgain') }}</button></span>
        </div>
      </section>

      <div v-if="bootstrapActive" class="strip strip-info flex-wrap" role="status" aria-live="polite">
        <span class="font-semibold">{{ t('channelMonitorV2.bootstrap.title') }}</span><span>{{ t('channelMonitorV2.bootstrap.progress', { percent: bootstrapPercent }) }}</span>
        <p class="w-full text-xs">{{ t('channelMonitorV2.bootstrap.description') }}</p>
        <progress class="h-1.5 w-full accent-primary-500" :value="bootstrapPercent" max="100" :aria-label="t('channelMonitorV2.bootstrap.working')" />
      </div>
      <div v-if="error" class="strip strip-bad" role="alert" data-testid="service-primary-error">{{ error }}<button type="button" class="btn btn-secondary btn-sm ml-auto" :disabled="refreshing" @click="reload(false, true)">{{ t('common.tryAgain') }}</button></div>
      <p v-if="snapshot && appliedKey !== dataKey" class="text-xs text-ink-3" role="status" data-testid="service-stale-scope">{{ t(updating ? 'channelMonitorV2.refreshingFilters' : 'channelMonitorV2.dashboard.loadFailed') }}</p>

      <div :class="updating ? 'opacity-70 transition-opacity' : ''" :aria-busy="updating" class="min-w-0 space-y-4" data-testid="service-dashboard-data">
        <ServiceMetricCards :snapshot="snapshot" :show-throughput="showThroughput" :loading="loading && !snapshot" />
        <div class="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
          <div class="min-w-0 space-y-3" data-testid="service-visualization">
            <div v-if="childrenError" class="strip strip-bad text-xs" role="alert" data-testid="service-children-error">{{ childrenError }}<button type="button" class="btn btn-secondary btn-sm ml-auto" :disabled="refreshing" @click="reload(false)">{{ t('common.tryAgain') }}</button></div>
            <MonitorTrendChart v-if="layout === 'trend'" :trend="snapshot?.trend || []" :coverage="snapshot?.coverage || null" :loading="loading && !snapshot" operations data-testid="service-main-trend" />
            <div v-else-if="loading && !matrix" class="grid gap-2" aria-hidden="true" data-testid="service-skeleton"><div v-for="i in 4" :key="i" class="h-10 animate-pulse rounded-lg bg-surface-3" /></div>
            <div v-else-if="!entries.length && !error" class="card flex flex-col items-center gap-2 !rounded-xl px-4 py-12 text-center" data-testid="service-empty">
              <Icon name="chart" size="lg" class="text-ink-3" /><p class="text-sm font-semibold text-ink">{{ t('channelMonitorV2.empty.title') }}</p><p class="text-xs text-ink-3">{{ t('channelMonitorV2.empty.description') }}</p>
            </div>
            <ServiceStatusMatrix v-else-if="layout === 'matrix' && matrix" :entries="entries" :coverage="matrix.coverage" :range-label="displayRangeLabel" />
            <AvailabilityBoard v-else-if="matrix && (layout === 'cards' || layout === 'list')" :key="layout" v-model:search="search" v-model:sort="sort" v-model:issues-only="issuesOnly" :rows="matrixRows" :children="children?.items || []" :coverage="matrix.coverage" :layout="layout" :range-label="displayRangeLabel" :loading="false" />
            <p v-if="matrix" class="px-1 text-[11px] text-ink-3"><span v-if="!modelsLoading && !modelsError">{{ t('channelMonitorV2.dashboard.modelCount', { count: modelRows.length }) }} · </span>{{ t('channelMonitorV2.service.affectedScopes') }} {{ issueCount }}</p>
          </div>
          <div class="min-w-0 space-y-2">
            <p v-if="modelsLoading && modelRows.length" class="inline-flex items-center gap-1 text-xs text-ink-3" role="status" data-testid="service-models-updating"><LoadingSpinner size="sm" />{{ t('channelMonitorV2.switchingData') }}</p>
            <ServiceModelRanking :rows="modelRows" :admin="isAdmin" :loading="modelsLoading" :error="modelsError" data-testid="service-model-ranking" @select="selectModel" @retry="loadModels()" />
          </div>
        </div>
        <div class="grid min-w-0 items-start gap-4" :class="layout === 'trend' ? '' : 'xl:grid-cols-2'">
          <div class="min-w-0 space-y-2">
            <p v-if="errorsLoading && errorRows.length" class="inline-flex items-center gap-1 text-xs text-ink-3" role="status" data-testid="service-errors-updating"><LoadingSpinner size="sm" />{{ t('channelMonitorV2.switchingData') }}</p>
            <ServiceErrorDistribution :rows="errorRows" :admin="isAdmin" :loading="errorsLoading" :error="errorsError" :range-label="errorRangeLabel" data-testid="service-error-distribution" @retry="loadErrors()" />
          </div>
          <MonitorTrendChart v-if="layout !== 'trend'" :trend="snapshot?.trend || []" :coverage="snapshot?.coverage || null" :loading="loading && !snapshot" operations compact data-testid="service-compact-trend" />
        </div>
      </div>

      <details class="px-1 text-[11px] leading-relaxed text-ink-3">
        <summary class="w-fit cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500">{{ t('channelMonitorV2.service.howToReadTitle') }}</summary>
        <p class="mt-2 max-w-4xl">{{ t(isAdmin ? 'channelMonitorV2.availability.legend' : 'channelMonitorV2.service.howToRead') }} {{ t('channelMonitorV2.service.healthScoreHint') }}</p>
      </details>
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { HealthState, MonitorDimensions, MonitorErrorRow, MonitorFilter, MonitorMatrixGroupBy, MonitorMatrixResponse, MonitorModelRow, MonitorRange, MonitorSnapshot } from '@/api/channelMonitorV2'
import * as api from '@/api/channelMonitorV2'
import AppLayout from '@/components/layout/AppLayout.vue'
import Select from '@/components/common/Select.vue'
import Icon from '@/components/icons/Icon.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import AvailabilityBoard from '@/features/channel-monitor-v2/AvailabilityBoard.vue'
import MonitorTrendChart from '@/features/channel-monitor-v2/MonitorTrendChart.vue'
import ServiceStatusMatrix from '@/features/channel-monitor-v2/ServiceStatusMatrix.vue'
import ServiceMetricCards from '@/features/channel-monitor-v2/ServiceMetricCards.vue'
import ServiceModelRanking from '@/features/channel-monitor-v2/ServiceModelRanking.vue'
import ServiceErrorDistribution from '@/features/channel-monitor-v2/ServiceErrorDistribution.vue'
import { type AvailabilityEntry, availabilitySeverity, availabilityState, monitorBucketStarts, monitorChildren, monitorRowKey, monitorRowLabel } from '@/features/channel-monitor-v2/monitorAvailability'
import { useAuthStore } from '@/stores/auth'
import { isChannelMonitorThroughputHidden } from '@/utils/featureFlags'
import { platformAccentColor, platformLabel } from '@/utils/platformColors'
import { extractApiErrorMessage } from '@/utils/apiError'

type Layout = 'cards' | 'matrix' | 'trend' | 'list'
withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false })
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { t, locale } = useI18n()
const isAdmin = computed(() => authStore.isAdmin)
const showThroughput = computed(() => isAdmin.value || !isChannelMonitorThroughputHidden())
const layouts: Layout[] = ['cards', 'matrix', 'trend', 'list']
const groups: MonitorMatrixGroupBy[] = ['platform', 'platform_group', 'platform_model', 'platform_group_model']
const ranges = computed(() => (['90m', '24h', '7d', '30d'] as MonitorRange[]).map(value => ({ value, label: t(`channelMonitorV2.ranges.${value}`) })))
const dimensionOptions = computed(() => groups.map((value, index) => ({ value, label: t(`channelMonitorV2.groupBy.${['platform', 'platformGroup', 'platformModel', 'platformGroupModel'][index]}`) })))
function parseRange(value: unknown): MonitorRange {
  return typeof value === 'string' && ['90m', '24h', '7d', '30d'].includes(value) ? value as MonitorRange : '24h'
}
function csv(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value]
  return [...new Set(values.flatMap(item => typeof item === 'string' ? item.split(',').map(part => part.trim()).filter(Boolean) : []))]
}
function parseGroupBy(value: unknown, legacy: unknown): MonitorMatrixGroupBy {
  return groups.includes(value as MonitorMatrixGroupBy) ? value as MonitorMatrixGroupBy : legacy === 'platform' ? 'platform' : 'platform_group'
}
function parseLayout(value: unknown): Layout {
  return layouts.includes(value as Layout) ? value as Layout : 'matrix'
}
function routeFilter(): MonitorFilter {
  return { range: parseRange(route.query.range), platforms: csv(route.query.platform), groupIds: [], models: csv(route.query.model) }
}
const filter = ref<MonitorFilter>(routeFilter())
const groupBy = ref<MonitorMatrixGroupBy>(parseGroupBy(route.query.group_by, route.query.dimension))
const layout = ref<Layout>(parseLayout(route.query.layout))
const snapshot = ref<MonitorSnapshot | null>(null)
const matrix = ref<MonitorMatrixResponse | null>(null)
const children = ref<MonitorMatrixResponse | null>(null)
const modelRows = ref<MonitorModelRow[]>([])
const errorRows = ref<MonitorErrorRow[]>([])
const dimensions = ref<MonitorDimensions>({ platforms: [], groups: [], models: [] })
const search = ref('')
const sort = ref('severity')
const issuesOnly = ref(false)
const loading = ref(false)
const refreshing = ref(false)
const modelsLoading = ref(false)
const errorsLoading = ref(false)
const catalogLoading = ref(false)
const error = ref('')
const childrenError = ref('')
const modelsError = ref('')
const errorsError = ref('')
const catalogError = ref('')
const appliedKey = ref('')
const appliedRange = ref<MonitorRange>(filter.value.range)
const errorsRange = ref<MonitorRange>(filter.value.range)
const lastSuccessAt = ref('')
const dataKey = computed(() => JSON.stringify([filter.value, groupBy.value, isAdmin.value]))
const catalogKey = computed(() => JSON.stringify([filter.value.range, isAdmin.value]))
const updating = computed(() => refreshing.value || modelsLoading.value || errorsLoading.value || catalogLoading.value)
const displayRangeLabel = computed(() => t(`channelMonitorV2.ranges.${appliedRange.value}`))
const errorRangeLabel = computed(() => t(`channelMonitorV2.ranges.${errorsRange.value}`))
const hasFilters = computed(() => Boolean(filter.value.platforms.length || filter.value.models.length || groupBy.value !== 'platform_group'))
const platformOptions = computed(() => {
  const values = new Set(dimensions.value.platforms.map(item => item.value))
  filter.value.platforms.forEach(value => values.add(value))
  return [...values].map(value => ({ value, label: platformLabel(value) }))
})
const matrixRows = computed(() => {
  const rows = matrix.value?.items || []
  return matrix.value?.group_by.includes('group') ? rows.filter(row => row.group_id != null && Number(row.group_id) > 0) : rows
})
const bucketTimes = computed(() => new Set(matrix.value ? monitorBucketStarts(matrix.value.coverage).map(Date.parse) : []))
const entries = computed<AvailabilityEntry[]>(() => matrixRows.value.map(row => ({
  row, key: monitorRowKey(row), children: monitorChildren(row, children.value?.items || []),
  dataBuckets: new Set(row.buckets.filter(bucket => availabilityState(bucket.health) !== 'unknown' && bucketTimes.value.has(Date.parse(bucket.bucket_start))).map(bucket => Date.parse(bucket.bucket_start))).size,
})).sort((a, b) => availabilitySeverity[availabilityState(a.row.health)] - availabilitySeverity[availabilityState(b.row.health)] || monitorRowLabel(a.row, t('channelMonitorV2.otherModels')).localeCompare(monitorRowLabel(b.row, t('channelMonitorV2.otherModels')), locale.value)))
const judged = computed(() => entries.value.filter(entry => availabilityState(entry.row.health) !== 'unknown'))
const issueCount = computed(() => judged.value.filter(entry => ['warning', 'critical'].includes(availabilityState(entry.row.health))).length)
const verdictLevel = computed<HealthState>(() => !judged.value.length ? 'unknown' : judged.value.every(entry => availabilityState(entry.row.health) === 'critical') ? 'critical' : issueCount.value ? 'warning' : 'healthy')
const bannerTone = computed(() => ({
  healthy: { box: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  warning: { box: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  critical: { box: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400', text: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
  unknown: { box: 'bg-surface-3 text-ink-3', text: 'text-ink-3', dot: 'bg-gray-400' },
}[verdictLevel.value]))
const verdictTitle = computed(() => t(`channelMonitorV2.service.${({ healthy: 'bannerOk', warning: 'bannerWarn', critical: 'bannerBad', unknown: 'bannerUnknown' } as const)[verdictLevel.value]}`))
const verdictDescription = computed(() => t(verdictLevel.value === 'unknown' ? 'channelMonitorV2.service.bannerUnknownDesc' : verdictLevel.value === 'healthy' ? 'channelMonitorV2.service.bannerOkDesc' : 'channelMonitorV2.service.bannerWarnDesc', { range: displayRangeLabel.value, count: verdictLevel.value === 'healthy' ? judged.value.length : issueCount.value, total: judged.value.length }))
function formatTime(value?: string, short = false) {
  const date = new Date(value || '')
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale.value || undefined, short ? { hour: '2-digit', minute: '2-digit' } : { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date) : '—'
}
const subtitle = computed(() => t('channelMonitorV2.service.subtitle', { minutes: Math.max(1, Math.round((snapshot.value?.config?.refresh_interval_seconds || 300) / 60)), time: formatTime(snapshot.value?.coverage.data_through) }))
const bootstrapActive = computed(() => Boolean(snapshot.value?.coverage.bootstrap?.active))
const bootstrapPercent = computed(() => {
  const raw = snapshot.value?.coverage.bootstrap?.progress_percent
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.min(100, Math.max(0, Math.round(raw))) : 0
})

let controller: AbortController | null = null
let modelsController: AbortController | null = null
let errorsController: AbortController | null = null
let catalogController: AbortController | null = null
let sequence = 0
let modelsSequence = 0
let errorsSequence = 0
let catalogSequence = 0
let timer: number | null = null
let disposed = false
function copyFilter(): MonitorFilter {
  return { ...filter.value, platforms: [...filter.value.platforms], groupIds: [...filter.value.groupIds], models: [...filter.value.models] }
}
function canceled(caught: unknown) {
  const value = caught as { name?: string; code?: string }
  return value?.name === 'AbortError' || value?.name === 'CanceledError' || value?.code === 'ERR_CANCELED'
}
function failure(caught: unknown) {
  return extractApiErrorMessage(caught, t('channelMonitorV2.dashboard.loadFailed'))
}
function syncQuery() {
  if (JSON.stringify(routeFilter()) === JSON.stringify(filter.value) && parseGroupBy(route.query.group_by, route.query.dimension) === groupBy.value && parseLayout(route.query.layout) === layout.value) return
  void router.replace({ query: { ...route.query, range: filter.value.range, platform: filter.value.platforms.join(',') || undefined, model: filter.value.models.join(',') || undefined, group_by: groupBy.value === 'platform_group' ? undefined : groupBy.value, dimension: undefined, layout: layout.value === 'matrix' ? undefined : layout.value } })
}
function resetFilters() {
  filter.value = { ...filter.value, platforms: [], models: [] }
  groupBy.value = 'platform_group'
  search.value = ''
  issuesOnly.value = false
}
function togglePlatform(platform: string) {
  filter.value = { ...filter.value, platforms: filter.value.platforms.includes(platform) ? filter.value.platforms.filter(value => value !== platform) : [...filter.value.platforms, platform] }
}
function selectModel(row: MonitorModelRow) {
  filter.value = { ...filter.value, platforms: [row.platform], models: [row.model] }
}
function removeModel(model: string) {
  filter.value = { ...filter.value, models: filter.value.models.filter(value => value !== model) }
}

async function loadCatalog() {
  catalogController?.abort()
  const request = new AbortController()
  catalogController = request
  const id = ++catalogSequence
  const range = filter.value.range
  const admin = isAdmin.value
  catalogLoading.value = true
  catalogError.value = ''
  try {
    const next = await api.getDimensions({ range, platforms: [], groupIds: [], models: [] }, admin, request.signal)
    if (!disposed && id === catalogSequence && !request.signal.aborted) dimensions.value = next
  } catch (caught) {
    if (!disposed && id === catalogSequence && !request.signal.aborted && !canceled(caught)) catalogError.value = failure(caught)
  } finally {
    if (!disposed && id === catalogSequence) catalogLoading.value = false
  }
}
async function loadModels(id = sequence) {
  modelsController?.abort()
  const request = new AbortController()
  modelsController = request
  const part = ++modelsSequence
  const currentFilter = copyFilter()
  const admin = isAdmin.value
  const current = () => !disposed && id === sequence && part === modelsSequence && !request.signal.aborted
  modelsLoading.value = true
  modelsError.value = ''
  try {
    const next = await api.getModels(currentFilter, admin, request.signal)
    if (current()) modelRows.value = next.items || []
  } catch (caught) {
    if (current() && !canceled(caught)) modelsError.value = failure(caught)
  } finally {
    if (!disposed && part === modelsSequence) modelsLoading.value = false
  }
}
async function loadErrors(id = sequence) {
  errorsController?.abort()
  const request = new AbortController()
  errorsController = request
  const part = ++errorsSequence
  const currentFilter = copyFilter()
  const admin = isAdmin.value
  const current = () => !disposed && id === sequence && part === errorsSequence && !request.signal.aborted
  errorsLoading.value = true
  errorsError.value = ''
  try {
    const next = await api.getErrors(currentFilter, admin, request.signal)
    if (current()) {
      errorRows.value = next.items || []
      errorsRange.value = currentFilter.range
    }
  } catch (caught) {
    if (current() && !canceled(caught)) errorsError.value = failure(caught)
  } finally {
    if (!disposed && part === errorsSequence) errorsLoading.value = false
  }
}
async function reload(silent = false, includeCatalog = false) {
  controller?.abort()
  const request = new AbortController()
  controller = request
  const id = ++sequence
  const currentFilter = copyFilter()
  const admin = isAdmin.value
  const selectedGroupBy = groupBy.value
  const key = dataKey.value
  const childBy = selectedGroupBy === 'platform' ? 'platform_model' : 'platform_group_model'
  loading.value = !silent && !snapshot.value
  refreshing.value = true
  error.value = ''
  childrenError.value = ''
  void loadModels(id)
  void loadErrors(id)
  if (includeCatalog) void loadCatalog()
  try {
    const [nextSnapshot, nextMatrix, nextChildren] = await Promise.all([
      api.getSnapshot(currentFilter, admin, request.signal),
      api.getMatrix(currentFilter, selectedGroupBy, admin, request.signal),
      selectedGroupBy === 'platform_group_model' ? Promise.resolve(null) : api.getMatrix(currentFilter, childBy, admin, request.signal).catch(caught => ({ failure: caught })),
    ])
    if (disposed || id !== sequence || request.signal.aborted) return
    snapshot.value = nextSnapshot
    matrix.value = nextMatrix
    appliedKey.value = key
    appliedRange.value = currentFilter.range
    lastSuccessAt.value = formatTime(nextSnapshot.coverage.data_through, true)
    if (nextChildren && 'failure' in nextChildren) {
      children.value = null
      if (!canceled(nextChildren.failure)) childrenError.value = failure(nextChildren.failure)
    } else children.value = nextChildren
    schedule()
  } catch (caught) {
    if (!disposed && id === sequence && !request.signal.aborted && !canceled(caught)) error.value = failure(caught)
  } finally {
    if (!disposed && id === sequence) {
      loading.value = false
      refreshing.value = false
    }
  }
}
function schedule() {
  if (timer !== null) window.clearInterval(timer)
  timer = null
  if (document.hidden || disposed) return
  const minimum = bootstrapActive.value ? 10 : 60
  const seconds = bootstrapActive.value ? 10 : snapshot.value?.config.refresh_interval_seconds || 300
  timer = window.setInterval(() => { if (!document.hidden && !updating.value) void reload(true, true) }, Math.max(minimum, seconds) * 1000)
}
function visibilityChanged() {
  schedule()
  if (!document.hidden && !updating.value) void reload(true, true)
}
watch(dataKey, (_value, previous) => {
  if (JSON.parse(previous)[2] !== isAdmin.value) {
    snapshot.value = null
    matrix.value = null
    children.value = null
    modelRows.value = []
    errorRows.value = []
    dimensions.value = { platforms: [], groups: [], models: [] }
  }
  syncQuery()
  void reload(false)
})
watch(catalogKey, () => void loadCatalog())
watch(layout, syncQuery)
watch(() => JSON.stringify([route.query.range, route.query.platform, route.query.model, route.query.group_by, route.query.dimension, route.query.layout]), () => {
  const next = routeFilter()
  if (JSON.stringify(next) !== JSON.stringify(filter.value)) filter.value = next
  groupBy.value = parseGroupBy(route.query.group_by, route.query.dimension)
  layout.value = parseLayout(route.query.layout)
})
onMounted(() => {
  document.addEventListener('visibilitychange', visibilityChanged)
  schedule()
  void reload(false, true)
})
onBeforeUnmount(() => {
  disposed = true
  sequence++
  controller?.abort()
  modelsController?.abort()
  errorsController?.abort()
  catalogController?.abort()
  if (timer !== null) window.clearInterval(timer)
  document.removeEventListener('visibilitychange', visibilityChanged)
})
</script>

<style scoped>
.service-dashboard-select :deep(.select-trigger) {
  min-height: 2rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
}
</style>
