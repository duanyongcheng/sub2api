<template>
  <AppLayout>
    <div class="space-y-5 pb-12">
      <!-- ① 整体状态横幅：只统计有真实流量的分组（设计主线 §2.3 第 3 条） -->
      <section
        class="card !rounded-3xl !border-0 shadow-sm ring-1 ring-gray-900/5 dark:!bg-dark-800 dark:ring-dark-700"
        :aria-label="t('channelMonitorV2.service.bannerOverview')"
        data-testid="service-banner"
      >
        <div class="page-header mb-0 flex flex-wrap items-start justify-between gap-4 px-5 py-4 sm:px-6">
          <div class="min-w-0">
            <h1 class="page-title flex items-center gap-2">
              <span
                class="inline-flex h-8 w-8 items-center justify-center rounded-xl"
                :class="bannerTone.box"
              >
                <Icon name="chart" size="sm" />
              </span>
              {{ t('channelMonitorV2.service.title') }}
            </h1>
            <div class="page-description mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span class="relative flex h-2 w-2 shrink-0">
                <span class="relative inline-flex h-2 w-2 rounded-full" :class="loading || refreshing ? 'bg-gray-400' : bannerTone.dot" />
              </span>
              <span v-if="refreshing" class="inline-flex items-center gap-1 text-primary-600 dark:text-primary-300" data-testid="service-refreshing">
                <LoadingSpinner size="sm" />{{ lastSuccessAt ? t('channelMonitorV2.refreshingSince', { time: lastSuccessAt }) : t('channelMonitorV2.updating') }}
              </span>
              <span v-else>{{ subtitle }}</span>
            </div>
          </div>
          <button
            class="btn btn-secondary btn-icon h-8 w-8"
            type="button"
            :title="t('common.refresh')"
            :disabled="loading"
            @click="manualRefresh"
          >
            <Icon name="refresh" size="sm" :class="loading || refreshing ? 'animate-spin' : ''" />
          </button>
        </div>

        <!-- 结论 + 三项指标：窄屏纵向堆叠，指标用等分三列，不靠横向挤压 -->
        <div class="flex flex-col gap-4 border-t border-gray-100 px-5 py-4 dark:border-dark-700 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
          <div class="min-w-0">
            <p class="text-sm font-semibold" :class="bannerTone.text" data-testid="service-verdict">{{ verdictTitle }}</p>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-dark-400">{{ verdictDescription }}</p>
          </div>
          <dl class="grid w-full grid-cols-3 gap-4 text-right sm:flex sm:w-auto sm:shrink-0 sm:gap-6 md:gap-8">
            <div>
              <dt class="text-[10px] text-gray-400 dark:text-dark-400">{{ t('channelMonitorV2.service.bannerOverview') }}</dt>
              <dd class="mt-0.5 text-lg font-semibold tabular-nums" :class="bannerTone.text" data-testid="service-availability">
                {{ overallAvailability }}
              </dd>
            </div>
            <div>
              <dt class="text-[10px] text-gray-400 dark:text-dark-400">{{ t('channelMonitorV2.availability.avgTtft') }}</dt>
              <dd class="mt-0.5 text-lg font-semibold tabular-nums text-gray-900 dark:text-white">{{ overallTtft }}</dd>
            </div>
            <div>
              <dt class="text-[10px] text-gray-400 dark:text-dark-400">{{ t('channelMonitorV2.service.activeIncidents') }}</dt>
              <dd class="mt-0.5 text-lg font-semibold tabular-nums" :class="issueCount ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'">
                {{ issueCount }}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <!-- 首次启用时的历史回填，沿用现有行为 -->
      <div
        v-if="bootstrapActive"
        class="strip strip-info flex-wrap"
        role="status"
        aria-live="polite"
      >
        <span class="font-semibold">{{ t('channelMonitorV2.bootstrap.title') }}</span>
        <span>{{ t('channelMonitorV2.bootstrap.progress', { percent: bootstrapPercent }) }}</span>
        <p class="w-full text-xs">{{ t('channelMonitorV2.bootstrap.description') }}</p>
        <progress class="h-1.5 w-full accent-primary-500" :value="bootstrapPercent" max="100" />
      </div>

      <!-- ② 阅读说明：讲清口径，避免用户误读 -->
      <section class="card flex gap-2.5 !rounded-xl px-4 py-3 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
        <Icon name="infoCircle" size="sm" class="mt-0.5 shrink-0 text-primary-600" />
        <p><b class="text-gray-900 dark:text-white">{{ t('channelMonitorV2.service.howToReadTitle') }}</b>：{{ t('channelMonitorV2.service.howToRead') }}</p>
      </section>

      <!-- ③ 工具栏：范围 · 按分组/按平台 · 刷新 -->
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('channelMonitorV2.service.myGroups') }}</h2>
        <span class="pill pill-neutral">{{ groupEntries.length }}</span>
        <div class="tabs inline-flex" role="group" :aria-label="t('channelMonitorV2.timeRange')">
          <button
            v-for="option in ranges"
            :key="option.value"
            type="button"
            class="tab !px-2.5 !py-1 text-xs"
            :class="range === option.value ? 'tab-active' : ''"
            :aria-pressed="range === option.value"
            @click="setRange(option.value)"
          >{{ option.label }}</button>
        </div>
        <div class="tabs inline-flex" role="group" :aria-label="t('channelMonitorV2.service.myGroups')">
          <button
            v-for="option in dimensionOptions"
            :key="option.value"
            type="button"
            class="tab !px-2.5 !py-1 text-xs"
            :class="dimension === option.value ? 'tab-active' : ''"
            :aria-pressed="dimension === option.value"
            :data-service-dimension="option.value"
            @click="dimension = option.value"
          >{{ option.label }}</button>
        </div>
        <button type="button" class="btn btn-secondary btn-sm ml-auto" :disabled="loading" @click="manualRefresh">
          <Icon name="refresh" size="sm" :class="loading ? 'animate-spin' : ''" />{{ t('common.refresh') }}
        </button>
      </div>

      <!-- ④ 分组卡片 -->
      <div v-if="error" class="strip strip-bad" role="alert">
        {{ error }}
        <button type="button" class="btn btn-secondary btn-sm ml-auto" @click="reload()">{{ t('common.tryAgain') }}</button>
      </div>
      <div v-if="(loading || manual) && !snapshot" class="grid gap-3" aria-hidden="true" data-testid="service-skeleton">
        <div v-for="i in 3" :key="i" class="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-dark-800" />
      </div>
      <div
        v-else-if="!entries.length"
        class="card flex flex-col items-center gap-2 !rounded-xl px-4 py-12 text-center"
      >
        <Icon name="chart" size="lg" class="text-gray-300 dark:text-dark-500" />
        <p class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ hasFilters ? t('channelMonitorV2.service.filteredEmpty') : t('channelMonitorV2.service.noGroups') }}
        </p>
        <p class="text-xs text-gray-500 dark:text-dark-400">
          {{ hasFilters ? t('channelMonitorV2.clearFilters') : t('channelMonitorV2.service.noGroupsDesc') }}
        </p>
        <button v-if="hasFilters" type="button" class="btn btn-secondary btn-sm mt-2" @click="clearFilters">
          {{ t('channelMonitorV2.clearFilters') }}
        </button>
      </div>
      <div v-else class="grid gap-3" :class="refreshing ? 'opacity-70 transition-opacity' : ''">
        <ServiceGroupCard
          v-for="entry in entries"
          :key="entry.key"
          :entry="entry"
          :coverage="matrix?.coverage || null"
          :range-label="rangeLabel"
        />
      </div>

      <!-- ⑤ 模型明细：保留清单视图，但默认折叠，避免抢走分组结论的注意力 -->
      <section v-if="modelRows.length" class="card !rounded-xl">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          :aria-expanded="modelsOpen"
          @click="modelsOpen = !modelsOpen"
        >
          <span>
            <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('channelMonitorV2.service.modelsTable') }}</span>
            <span class="ml-2 text-xs text-gray-400 dark:text-dark-400">{{ t('channelMonitorV2.service.modelsTableHint') }}</span>
          </span>
          <Icon name="chevronDown" size="sm" class="text-gray-400 transition-transform" :class="modelsOpen ? 'rotate-180' : ''" />
        </button>
        <div v-if="modelsOpen" class="table-container border-0 border-t border-gray-100 dark:border-dark-700">
          <table class="table monitor-table min-w-[560px]">
            <thead>
              <tr>
                <th>{{ t('channelMonitorV2.table.platformModel') }}</th>
                <th>{{ t('channelMonitorV2.metrics.successRate') }}</th>
                <th>{{ t('channelMonitorV2.metrics.ttftP50') }}</th>
                <th>{{ t('channelMonitorV2.metrics.cacheRate') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in modelRows" :key="`${row.platform}:${row.model}`">
                <td>
                  <div class="flex items-center gap-2">
                    <i class="h-1.5 w-1.5 rounded-full" :class="toneFor(row.health).dot" />
                    <span class="block text-xs text-gray-500 dark:text-dark-400">{{ platformLabel(row.platform) }}</span>
                    <strong class="font-semibold text-gray-900 dark:text-white">{{ row.model === '__other__' ? t('channelMonitorV2.otherModels') : row.model }}</strong>
                  </div>
                </td>
                <td class="tabular-nums" :class="toneFor(row.health).value">{{ formatAvailability(row.metrics, row.health) }}</td>
                <td class="tabular-nums">{{ formatMonitorMs(row.metrics.ttft.avg_ms) }}</td>
                <td class="tabular-nums">{{ formatMonitorPercent(row.metrics.cache_rate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type {
  HealthState,
  MonitorFilter,
  MonitorMatrixResponse,
  MonitorMatrixRow,
  MonitorModelRow,
  MonitorRange,
  MonitorSnapshot,
} from '@/api/channelMonitorV2'
import * as api from '@/api/channelMonitorV2'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ServiceGroupCard from '@/features/channel-monitor-v2/ServiceGroupCard.vue'
import {
  type AvailabilityEntry,
  availabilitySeverity,
  availabilityState,
  availabilityTone,
  formatAvailability,
  monitorBucketStarts,
  monitorChildren,
  monitorRowKey,
} from '@/features/channel-monitor-v2/monitorAvailability'
import { formatMonitorMs, formatMonitorPercent } from '@/features/channel-monitor-v2/monitorFormat'
import { platformLabel } from '@/utils/platformColors'
import { extractApiErrorMessage } from '@/utils/apiError'

type Dimension = 'group' | 'platform'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()

const ranges = computed<Array<{ value: MonitorRange; label: string }>>(() => [
  { value: '90m', label: t('channelMonitorV2.ranges.90m') },
  { value: '24h', label: t('channelMonitorV2.ranges.24h') },
  { value: '7d', label: t('channelMonitorV2.ranges.7d') },
  { value: '30d', label: t('channelMonitorV2.ranges.30d') },
])
const dimensionOptions = computed(() => [
  { value: 'group' as Dimension, label: t('channelMonitorV2.service.byGroup') },
  { value: 'platform' as Dimension, label: t('channelMonitorV2.service.byPlatform') },
])

const range = ref<MonitorRange>(parseRange(route.query.range))
const dimension = ref<Dimension>(route.query.dimension === 'platform' ? 'platform' : 'group')
const snapshot = ref<MonitorSnapshot | null>(null)
const matrix = ref<MonitorMatrixResponse | null>(null)
const children = ref<MonitorMatrixResponse | null>(null)
const modelRows = ref<MonitorModelRow[]>([])
const loading = ref(false)
const refreshing = ref(false)
const modelsOpen = ref(false)
const error = ref('')
/** Timestamp of the last successful payload, shown while a refresh keeps old data. */
const lastSuccessAt = ref('')
/** Only an explicit refresh may blank the page into a skeleton. */
const manual = ref(false)
let controller: AbortController | null = null
let sequence = 0
let timer: number | null = null

const filter = computed<MonitorFilter>(() => ({
  range: range.value,
  platforms: [],
  groupIds: [],
  models: [],
}))
const rangeLabel = computed(() => ranges.value.find(option => option.value === range.value)?.label || range.value)
const hasFilters = computed(() => false)

function parseRange(value: unknown): MonitorRange {
  return ['90m', '24h', '7d', '30d'].includes(String(value)) ? (value as MonitorRange) : '24h'
}

const bucketStarts = computed(() => (matrix.value ? monitorBucketStarts(matrix.value.coverage) : []))
const bucketTimes = computed(() => new Set(bucketStarts.value.map(Date.parse)))

/**
 * Group rows are the product's unit of truth: a request is routed to a group, so
 * "can I use it" is answered per group. Platform rows are only a roll-up view.
 */
const entries = computed<AvailabilityEntry[]>(() => {
  const rows = matrix.value?.items || []
  const scoped = dimension.value === 'group'
    ? rows.filter(row => row.group_id != null && Number(row.group_id) > 0)
    : rows
  return scoped.map(row => ({
    row,
    key: monitorRowKey(row),
    children: monitorChildren(row, children.value?.items || []),
    dataBuckets: new Set(
      row.buckets
        .filter(bucket => availabilityState(bucket.health) !== 'unknown' && bucketTimes.value.has(Date.parse(bucket.bucket_start)))
        .map(bucket => Date.parse(bucket.bucket_start)),
    ).size,
  })).sort((a, b) =>
    availabilitySeverity[availabilityState(a.row.health)] - availabilitySeverity[availabilityState(b.row.health)] ||
    label(a.row).localeCompare(label(b.row), locale.value),
  )
})

function label(row: MonitorMatrixRow) {
  if (dimension.value === 'platform') return platformLabel(row.platform)
  return row.group_name || (row.group_id ? `#${row.group_id}` : platformLabel(row.platform))
}

const groupEntries = computed(() => entries.value)

/** Overall verdict counts only scopes that have traffic; sample-shortfall never turns the site red. */
const judged = computed(() => entries.value.filter(entry => availabilityState(entry.row.health) !== 'unknown'))
const issueCount = computed(() => judged.value.filter(entry => ['warning', 'critical'].includes(availabilityState(entry.row.health))).length)
const allDown = computed(() => judged.value.length > 0 && judged.value.every(entry => availabilityState(entry.row.health) === 'critical'))
const verdictLevel = computed<HealthState>(() => {
  if (!judged.value.length) return 'unknown'
  if (allDown.value) return 'critical'
  return issueCount.value > 0 ? 'warning' : 'healthy'
})
const bannerTone = computed(() => {
  const state = verdictLevel.value
  return {
    healthy: { box: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
    warning: { box: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
    critical: { box: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400', text: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
    unknown: { box: 'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-dark-400', text: 'text-gray-500 dark:text-dark-400', dot: 'bg-gray-400' },
  }[state]
})
const verdictTitle = computed(() => t(`channelMonitorV2.service.${({ healthy: 'bannerOk', warning: 'bannerWarn', critical: 'bannerBad', unknown: 'bannerUnknown' } as const)[verdictLevel.value]}`))
const verdictDescription = computed(() => verdictLevel.value === 'healthy'
  ? t('channelMonitorV2.service.bannerOkDesc', { count: judged.value.length })
  : t('channelMonitorV2.service.bannerWarnDesc', { count: issueCount.value, total: judged.value.length }))

/** Weighted by counted requests, never an average of per-model percentages. */
const overallAvailability = computed(() => {
  if (!judged.value.length) return '—'
  const total = judged.value.reduce((sum, entry) => sum + entry.row.metrics.request_count, 0)
  if (total > 0) {
    const errors = judged.value.reduce((sum, entry) => sum + entry.row.metrics.error_rate * entry.row.metrics.request_count, 0)
    return `${((1 - errors / total) * 100).toFixed(2)}%`
  }
  // Request counts can be redacted for users; fall back to the server aggregate.
  return snapshot.value ? formatAvailability(snapshot.value.metrics, snapshot.value.health) : '—'
})
const overallTtft = computed(() => formatMonitorMs(snapshot.value?.metrics.ttft.avg_ms ?? null))
const subtitle = computed(() => {
  const minutes = Math.max(1, Math.round((snapshot.value?.config?.refresh_interval_seconds || 300) / 60))
  const through = snapshot.value?.coverage?.data_through
  const time = through
    ? new Intl.DateTimeFormat(locale.value || undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(through))
    : '—'
  return t('channelMonitorV2.service.subtitle', { minutes, time })
})
const bootstrapActive = computed(() => Boolean(snapshot.value?.coverage?.bootstrap?.active))
const bootstrapPercent = computed(() => {
  const raw = snapshot.value?.coverage?.bootstrap?.progress_percent
  if (typeof raw !== 'number' || Number.isNaN(raw)) return 0
  return Math.min(100, Math.max(0, Math.round(raw)))
})

function toneFor(health: MonitorSnapshot['health']) {
  return availabilityTone[availabilityState(health)]
}
function setRange(value: MonitorRange) {
  range.value = value
}
function manualRefresh() {
  manual.value = true
  void reload()
}
function clearFilters() {
  // Today the service page has no dimension filters; kept for the empty state contract.
  void reload()
}
function syncQuery() {
  void router.replace({
    query: {
      ...route.query,
      range: range.value,
      dimension: dimension.value === 'group' ? undefined : dimension.value,
    },
  })
}

async function reload(silent = false) {
  controller?.abort()
  const request = new AbortController()
  controller = request
  const id = ++sequence
  if (!silent) loading.value = true
  refreshing.value = true
  error.value = ''
  try {
    const groupBy = dimension.value === 'group' ? 'platform_group' : 'platform'
    const childBy = dimension.value === 'group' ? 'platform_group_model' : 'platform_model'
    const [nextSnapshot, nextMatrix, nextChildren, nextModels] = await Promise.all([
      api.getSnapshot(filter.value, false, request.signal),
      api.getMatrix(filter.value, groupBy, false, request.signal),
      api.getMatrix(filter.value, childBy, false, request.signal),
      api.getModels(filter.value, false, request.signal).catch(() => null),
    ])
    if (id !== sequence || request.signal.aborted) return
    snapshot.value = nextSnapshot
    matrix.value = nextMatrix
    lastSuccessAt.value = nextSnapshot.coverage?.data_through
      ? new Intl.DateTimeFormat(locale.value || undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(nextSnapshot.coverage.data_through))
      : ''
    children.value = nextChildren
    modelRows.value = nextModels?.items || []
    schedule()
  } catch (caught) {
    const e = caught as { name?: string; code?: string }
    if (id === sequence && !request.signal.aborted && e.name !== 'CanceledError' && e.code !== 'ERR_CANCELED') {
      error.value = extractApiErrorMessage(caught, t('channelMonitorV2.loadFailed'))
    }
  } finally {
    if (id === sequence) {
      loading.value = false
      refreshing.value = false
      manual.value = false
    }
  }
}

function schedule() {
  if (timer) window.clearInterval(timer)
  const seconds = bootstrapActive.value ? 10 : snapshot.value?.config?.refresh_interval_seconds || 300
  timer = window.setInterval(() => {
    if (!document.hidden && !loading.value && !refreshing.value) void reload(true)
  }, Math.max(bootstrapActive.value ? 10 : 60, seconds) * 1000)
}

watch(range, () => {
  syncQuery()
  void reload()
})
watch(dimension, () => {
  syncQuery()
  void reload()
})
onMounted(() => void reload())
onBeforeUnmount(() => {
  sequence++
  controller?.abort()
  if (timer) window.clearInterval(timer)
})
</script>
