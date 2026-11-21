<template>
  <article
    class="overflow-hidden rounded-card border border-edge bg-surface shadow-xs"
    :data-testid="`iq-public-group-${group.group_id}`"
  >
    <header
      class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-edge bg-surface-2 px-4 py-2.5 sm:px-5"
    >
      <div class="flex min-w-0 items-center gap-2">
        <h3 class="truncate text-[14px] font-semibold text-ink" :title="group.group_name">
          {{ group.group_name }}
        </h3>
        <span v-if="group.platform" class="chip shrink-0 !text-[11px] !font-medium">
          {{ platformLabel(group.platform) }}
        </span>
      </div>
      <span
        class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        :class="verdictBadgeClasses(health)"
        :data-testid="`iq-public-health-${group.group_id}`"
      >
        <span class="h-1.5 w-1.5 rounded-full" :class="verdictDotClasses(health)" aria-hidden="true" />
        <span class="sr-only">{{ t('iqDetection.public.groups.health') }}:</span>
        {{ t(`iqDetection.verdict.${health}`) }}
      </span>
    </header>

    <p
      v-if="!hasAnyRun"
      class="px-4 py-3.5 text-[12.5px] text-ink-3 sm:px-5"
      :data-testid="`iq-public-unchecked-${group.group_id}`"
    >
      {{ t('iqDetection.public.groups.awaitingFirst') }}
    </p>

    <ul v-else class="divide-y divide-edge">
      <li
        v-for="row in rows"
        :key="row.benchmark"
        class="grid grid-cols-1 gap-x-5 gap-y-2.5 px-4 py-3 sm:px-5 md:grid-cols-[minmax(132px,176px)_minmax(150px,220px)_minmax(0,1fr)] md:items-center"
        :data-testid="`iq-public-row-${group.group_id}-${row.benchmark}`"
      >
        <div class="flex min-w-0 items-baseline justify-between gap-3 md:block">
          <div class="text-[13px] font-semibold text-ink">
            {{ t(`iqDetection.public.benchmarks.${row.benchmark}.name`) }}
          </div>
          <div
            v-if="row.checkedAgo"
            class="mt-0.5 shrink-0 text-[11.5px] tabular-nums text-ink-3"
            :title="row.checkedAtFull"
          >
            {{ row.checkedAgo }}
          </div>
        </div>

        <div class="flex min-w-0 items-center gap-2.5">
          <span
            class="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold"
            :class="verdictTextClass(row.verdict)"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="verdictDotClasses(row.verdict)" aria-hidden="true" />
            {{ t(`iqDetection.verdict.${row.verdict}`) }}
          </span>
          <span
            v-if="row.resultText"
            class="truncate text-[12.5px] tabular-nums text-ink-2"
            :data-testid="`iq-public-result-${group.group_id}-${row.benchmark}`"
          >
            {{ row.resultText }}
          </span>
        </div>

        <IQDetectionPublicTrend
          v-if="row.hasRun"
          :runs="trends[row.benchmark]?.runs ?? []"
          :state="trends[row.benchmark]?.state ?? 'idle'"
          :benchmark-label="t(`iqDetection.public.benchmarks.${row.benchmark}.name`)"
          :test-key="`${group.group_id}-${row.benchmark}`"
        />
      </li>
    </ul>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatRelativeTime } from '@/utils/format'
import { platformLabel } from '@/utils/platformColors'
import type { IQDetectionBenchmarkType } from '../types'
import type { DisplayVerdict } from '../verdictMeta'
import { formatDateTime, verdictBadgeClasses, verdictDotClasses } from '../verdictMeta'
import type { IQDetectionPublicGroup, IQDetectionPublicRun } from './publicTypes'
import { describePublicRunResult, runTimestamp, toDisplayVerdict } from './publicMeta'
import IQDetectionPublicTrend from './IQDetectionPublicTrend.vue'

export interface PublicTrendSlice {
  runs: IQDetectionPublicRun[]
  state: 'idle' | 'loading' | 'ready' | 'error'
}

const props = defineProps<{
  group: IQDetectionPublicGroup
  benchmarks: IQDetectionBenchmarkType[]
  trends: Partial<Record<IQDetectionBenchmarkType, PublicTrendSlice>>
}>()

const { t } = useI18n()

const health = computed<DisplayVerdict>(() => toDisplayVerdict(props.group.health))

const hasAnyRun = computed(() =>
  props.benchmarks.some((b) => !!props.group.latest_runs_by_benchmark?.[b])
)

const rows = computed(() =>
  props.benchmarks.map((benchmark) => {
    const run = props.group.latest_runs_by_benchmark?.[benchmark] ?? null
    if (!run) {
      return {
        benchmark,
        hasRun: false,
        verdict: 'untested' as DisplayVerdict,
        resultText: '',
        checkedAgo: '',
        checkedAtFull: ''
      }
    }
    const result = describePublicRunResult(run)
    const ts = runTimestamp(run)
    return {
      benchmark,
      hasRun: true,
      verdict: toDisplayVerdict(run.verdict),
      resultText: result.key === 'none' ? '' : t(`iqDetection.public.result.${result.key}`, result.params),
      checkedAgo: formatRelativeTime(ts),
      checkedAtFull: formatDateTime(ts)
    }
  })
)

function verdictTextClass(verdict: DisplayVerdict): string {
  switch (verdict) {
    case 'normal':
      return 'text-emerald-700 dark:text-emerald-300'
    case 'warning':
      return 'text-amber-700 dark:text-amber-300'
    case 'degraded':
      return 'text-rose-700 dark:text-rose-300'
    case 'error':
      return 'text-red-700 dark:text-red-300'
    default:
      return 'text-ink-3'
  }
}
</script>
