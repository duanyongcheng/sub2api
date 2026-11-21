<template>
  <AppLayout>
    <div class="flex w-full min-w-0 flex-col gap-4 pb-8" data-testid="iq-public-view">
      <!-- AppHeader renders the route title from lg upward. -->
      <div class="lg:hidden">
        <h1 class="text-[19px] font-bold leading-[26px] tracking-[-0.025em] text-ink">
          {{ t('iqDetection.public.title') }}
        </h1>
        <p class="mt-0.5 text-xs text-ink-2">
          {{ t('iqDetection.public.description') }}
        </p>
      </div>

      <!-- Loading (first load only) -->
      <div
        v-if="status === 'loading' && !overview"
        class="flex flex-col gap-4"
        role="status"
        :aria-label="t('iqDetection.public.states.loading')"
        data-testid="iq-public-loading"
      >
        <div class="rounded-card border border-edge bg-surface p-4 shadow-xs sm:p-5">
          <div class="skeleton h-4 w-40" />
          <div class="skeleton mt-3 h-3 w-full max-w-[560px]" />
          <div class="skeleton mt-2 h-3 w-2/3 max-w-[420px]" />
          <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div v-for="n in 4" :key="n" class="skeleton h-9" />
          </div>
        </div>
        <div
          v-for="n in 2"
          :key="`g-${n}`"
          class="rounded-card border border-edge bg-surface p-4 shadow-xs sm:p-5"
        >
          <div class="flex items-center justify-between">
            <div class="skeleton h-4 w-32" />
            <div class="skeleton h-5 w-20 !rounded-full" />
          </div>
          <div class="skeleton mt-4 h-7 w-full" />
        </div>
        <span class="sr-only">{{ t('iqDetection.public.states.loading') }}</span>
      </div>

      <!-- Not public -->
      <section
        v-else-if="status === 'disabled'"
        class="flex flex-col items-center rounded-card border border-edge bg-surface px-6 py-14 text-center shadow-xs"
        data-testid="iq-public-disabled"
      >
        <span
          class="inline-flex h-11 w-11 items-center justify-center rounded-field bg-surface-3 text-ink-3"
          aria-hidden="true"
        >
          <Icon name="eyeOff" size="lg" />
        </span>
        <h2 class="mt-3 text-[15px] font-semibold text-ink">
          {{ t('iqDetection.public.states.disabledTitle') }}
        </h2>
        <p class="mt-1 max-w-md text-[13px] leading-relaxed text-ink-2">
          {{ t('iqDetection.public.states.disabledBody') }}
        </p>
        <router-link to="/dashboard" class="btn btn-secondary btn-sm mt-5">
          {{ t('iqDetection.public.states.backToDashboard') }}
        </router-link>
      </section>

      <!-- Failed first load -->
      <div
        v-else-if="status === 'error' && !overview"
        class="strip strip-bad dark:text-red-300"
        role="alert"
        data-testid="iq-public-error"
      >
        <Icon name="exclamationCircle" size="sm" class="shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-semibold">{{ t('iqDetection.public.states.errorTitle') }}</p>
          <p class="mt-0.5 text-xs opacity-90">{{ errorMessage || t('iqDetection.public.states.errorBody') }}</p>
        </div>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          data-testid="iq-public-retry"
          @click="load()"
        >
          {{ t('iqDetection.public.states.retry') }}
        </button>
      </div>

      <template v-else-if="overview">
        <div
          v-if="status === 'error'"
          class="strip strip-warn dark:text-amber-300"
          role="status"
          data-testid="iq-public-stale"
        >
          <Icon name="exclamationTriangle" size="sm" class="shrink-0" />
          <span class="min-w-0 flex-1 text-[12.5px]">{{ t('iqDetection.public.states.staleNotice') }}</span>
          <button type="button" class="btn btn-secondary btn-sm" @click="load()">
            {{ t('iqDetection.public.states.retry') }}
          </button>
        </div>

        <!-- About these checks -->
        <section
          class="overflow-hidden rounded-card border border-edge bg-surface shadow-xs"
          aria-labelledby="iq-public-about-title"
          data-testid="iq-public-about"
        >
          <div class="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
            <div class="min-w-0">
              <h2 id="iq-public-about-title" class="text-[14px] font-semibold text-ink">
                {{ t('iqDetection.public.about.title') }}
              </h2>
              <p class="mt-1 max-w-[72ch] text-[13px] leading-relaxed text-ink-2">
                {{ t('iqDetection.public.about.intro') }}
              </p>
            </div>
            <button
              type="button"
              class="btn btn-secondary btn-sm h-8 w-8 shrink-0 !px-0 sm:w-auto sm:!px-3"
              :title="t('iqDetection.public.states.refresh')"
              :aria-label="t('iqDetection.public.states.refresh')"
              :disabled="status === 'loading'"
              data-testid="iq-public-refresh"
              @click="load()"
            >
              <Icon name="refresh" size="sm" :class="status === 'loading' ? 'animate-spin motion-reduce:animate-none' : ''" />
              <span class="hidden sm:inline">{{ t('iqDetection.public.states.refresh') }}</span>
            </button>
          </div>

          <dl
            class="grid grid-cols-2 border-t border-edge md:grid-cols-4 [&>div]:border-edge [&>div:nth-child(odd)]:border-r md:[&>div]:border-r md:[&>div:last-child]:border-r-0 [&>div:nth-child(-n+2)]:border-b md:[&>div:nth-child(-n+2)]:border-b-0"
            data-testid="iq-public-meta"
          >
            <div class="min-w-0 px-4 py-2.5 sm:px-5">
              <dt class="text-[11.5px] font-semibold text-ink-3">{{ t('iqDetection.public.about.model') }}</dt>
              <dd class="mt-0.5 truncate text-[13px] font-semibold text-ink" :title="overview.model">
                {{ overview.model || '—' }}
              </dd>
            </div>
            <div class="min-w-0 px-4 py-2.5 sm:px-5">
              <dt class="text-[11.5px] font-semibold text-ink-3">{{ t('iqDetection.public.about.effort') }}</dt>
              <dd class="mt-0.5 truncate text-[13px] font-semibold text-ink">
                {{ overview.reasoning_effort || '—' }}
              </dd>
            </div>
            <div class="min-w-0 px-4 py-2.5 sm:px-5">
              <dt class="text-[11.5px] font-semibold text-ink-3">{{ t('iqDetection.public.about.cadence') }}</dt>
              <dd class="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-ink">
                {{ cadenceLabel }}
              </dd>
            </div>
            <div class="min-w-0 px-4 py-2.5 sm:px-5">
              <dt class="text-[11.5px] font-semibold text-ink-3">{{ t('iqDetection.public.about.lastScheduled') }}</dt>
              <dd
                class="mt-0.5 truncate text-[13px] font-semibold tabular-nums text-ink"
                :title="overview.last_scheduled_at ? formatDateTime(overview.last_scheduled_at) : ''"
              >
                {{
                  overview.last_scheduled_at
                    ? formatRelativeTime(overview.last_scheduled_at)
                    : t('iqDetection.public.about.never')
                }}
              </dd>
            </div>
          </dl>

          <div
            v-if="benchmarks.length > 0"
            class="grid grid-cols-1 gap-px border-t border-edge bg-edge"
            :class="benchmarks.length > 1 ? 'md:grid-cols-2' : ''"
          >
            <div v-for="bench in benchmarks" :key="bench" class="bg-surface px-4 py-3 sm:px-5">
              <h3 class="text-[13px] font-semibold text-ink">
                {{ t(`iqDetection.public.benchmarks.${bench}.name`) }}
              </h3>
              <p class="mt-1 max-w-[72ch] text-xs leading-relaxed text-ink-2">
                {{ t(`iqDetection.public.benchmarks.${bench}.body`) }}
              </p>
            </div>
          </div>

          <ul
            class="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-edge bg-surface-2 px-4 py-2.5 text-[11.5px] text-ink-2 sm:px-5"
            :aria-label="t('iqDetection.public.about.legendLabel')"
          >
            <li v-for="v in legendVerdicts" :key="v" class="inline-flex items-center gap-1.5">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="verdictDotClasses(v)" aria-hidden="true" />
              <span class="font-semibold text-ink">{{ t(`iqDetection.verdict.${v}`) }}</span>
              <span>{{ t(`iqDetection.public.legend.${v}`) }}</span>
            </li>
          </ul>
        </section>

        <!-- Groups -->
        <section class="flex flex-col gap-3" aria-labelledby="iq-public-groups-title">
          <div class="px-0.5">
            <h2 id="iq-public-groups-title" class="text-[14px] font-semibold text-ink">
              {{ t('iqDetection.public.groups.title') }}
            </h2>
            <p class="mt-0.5 text-xs text-ink-2">{{ t('iqDetection.public.groups.subtitle') }}</p>
          </div>

          <div
            v-if="overview.groups.length === 0"
            class="flex flex-col items-center rounded-card border border-edge bg-surface px-6 py-12 text-center shadow-xs"
            data-testid="iq-public-empty"
          >
            <span
              class="inline-flex h-10 w-10 items-center justify-center rounded-field bg-surface-3 text-ink-3"
              aria-hidden="true"
            >
              <Icon name="inbox" size="md" />
            </span>
            <h3 class="mt-3 text-[13.5px] font-semibold text-ink">
              {{ t('iqDetection.public.states.emptyTitle') }}
            </h3>
            <p class="mt-1 max-w-md text-xs leading-relaxed text-ink-2">
              {{ t('iqDetection.public.states.emptyBody') }}
            </p>
          </div>

          <IQDetectionPublicGroupSheet
            v-for="group in overview.groups"
            v-else
            :key="group.group_id"
            :group="group"
            :benchmarks="benchmarks"
            :trends="trends[group.group_id] ?? {}"
          />
        </section>

        <IQDetectionPublicGallery v-if="showGallery" :runs="galleryRuns" />
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import { formatRelativeTime } from '@/utils/format'
import { extractApiErrorMessage } from '@/utils/apiError'
import type { IQDetectionBenchmarkType } from '../types'
import { formatDateTime, verdictDotClasses } from '../verdictMeta'
import {
  getIQDetectionPublicOverview,
  isIQDetectionNotPublicError,
  isRequestCancelled,
  listIQDetectionPublicRuns
} from './publicApi'
import type { IQDetectionPublicOverview, IQDetectionPublicRun } from './publicTypes'
import { resolvePublicBenchmarks } from './publicMeta'
import { useIQDetectionVisibility } from './useIQDetectionVisibility'
import IQDetectionPublicGroupSheet, { type PublicTrendSlice } from './IQDetectionPublicGroupSheet.vue'
import IQDetectionPublicGallery from './IQDetectionPublicGallery.vue'

type Status = 'loading' | 'ready' | 'error' | 'disabled'

const TREND_SLOTS = 24
const TREND_CONCURRENCY = 4

const { t } = useI18n()
const { setIQDetectionVisibility } = useIQDetectionVisibility()

const status = ref<Status>('loading')
const overview = ref<IQDetectionPublicOverview | null>(null)
const errorMessage = ref('')
const trends = reactive<Record<number, Partial<Record<IQDetectionBenchmarkType, PublicTrendSlice>>>>({})
const legendVerdicts = ['normal', 'warning', 'degraded', 'error'] as const

let controller: AbortController | null = null
let disposed = false

const benchmarks = computed(() => resolvePublicBenchmarks(overview.value))

const cadenceLabel = computed(() => {
  const mins = overview.value?.interval_minutes ?? 0
  if (!mins || mins <= 0) return '—'
  if (mins < 60 || mins % 60 !== 0) return t('iqDetection.public.about.everyMinutes', { n: mins })
  return t('iqDetection.public.about.everyHours', { n: mins / 60 })
})

const galleryRuns = computed<IQDetectionPublicRun[]>(() =>
  (overview.value?.groups ?? [])
    .map((g) => g.latest_runs_by_benchmark?.pelican_svg)
    .filter((run): run is IQDetectionPublicRun => !!run)
)

const showGallery = computed(
  () =>
    (overview.value?.groups.length ?? 0) > 0 &&
    (benchmarks.value.includes('pelican_svg') || galleryRuns.value.length > 0)
)

async function load(): Promise<void> {
  controller?.abort()
  const current = new AbortController()
  controller = current
  status.value = 'loading'
  errorMessage.value = ''
  try {
    const data = await getIQDetectionPublicOverview(current.signal)
    if (disposed || controller !== current) return
    overview.value = {
      ...data,
      benchmark_types: Array.isArray(data?.benchmark_types) ? data.benchmark_types : [],
      groups: Array.isArray(data?.groups) ? data.groups : []
    }
    status.value = 'ready'
    setIQDetectionVisibility(true)
    void loadTrends(current)
  } catch (err) {
    if (disposed || controller !== current || isRequestCancelled(err)) return
    if (isIQDetectionNotPublicError(err)) {
      markNotPublic()
      return
    }
    errorMessage.value = extractApiErrorMessage(err, '')
    status.value = 'error'
  }
}

function markNotPublic(): void {
  overview.value = null
  for (const key of Object.keys(trends)) delete trends[Number(key)]
  status.value = 'disabled'
  setIQDetectionVisibility(false)
}

async function loadTrends(owner: AbortController): Promise<void> {
  const data = overview.value
  if (!data) return
  const jobs: Array<{ groupId: number; bench: IQDetectionBenchmarkType }> = []
  for (const group of data.groups) {
    const slices: Partial<Record<IQDetectionBenchmarkType, PublicTrendSlice>> = {}
    for (const bench of benchmarks.value) {
      const hasRun = !!group.latest_runs_by_benchmark?.[bench]
      // A benchmark that never ran for this group has no history to fetch.
      slices[bench] = { runs: [], state: hasRun ? 'loading' : 'ready' }
      if (hasRun) jobs.push({ groupId: group.group_id, bench })
    }
    trends[group.group_id] = slices
  }

  let cursor = 0
  const worker = async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++]
      if (disposed || controller !== owner) return
      try {
        const page = await listIQDetectionPublicRuns(
          { group_id: job.groupId, benchmark_type: job.bench, page: 1, page_size: TREND_SLOTS },
          owner.signal
        )
        if (disposed || controller !== owner) return
        setSlice(job.groupId, job.bench, { runs: Array.isArray(page?.items) ? page.items : [], state: 'ready' })
      } catch (err) {
        if (disposed || controller !== owner || isRequestCancelled(err)) return
        if (isIQDetectionNotPublicError(err)) {
          owner.abort()
          markNotPublic()
          return
        }
        setSlice(job.groupId, job.bench, { runs: [], state: 'error' })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(TREND_CONCURRENCY, jobs.length) }, worker))
}

function setSlice(groupId: number, bench: IQDetectionBenchmarkType, slice: PublicTrendSlice): void {
  trends[groupId] = { ...(trends[groupId] ?? {}), [bench]: slice }
}

onMounted(() => {
  void load()
})

onBeforeUnmount(() => {
  disposed = true
  controller?.abort()
})
</script>
