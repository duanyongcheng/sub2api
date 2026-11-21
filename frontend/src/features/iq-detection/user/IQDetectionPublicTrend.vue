<template>
  <div class="w-full min-w-0 max-w-[400px] md:justify-self-end" :data-testid="`iq-public-trend-${testKey}`">
    <div
      v-if="state === 'loading' && runs.length === 0"
      class="flex h-7 items-end justify-end gap-[3px]"
      role="status"
      :aria-label="t('iqDetection.public.trend.loading')"
    >
      <span
        v-for="n in slots"
        :key="n"
        class="skeleton h-2 min-w-[3px] max-w-[14px] flex-1 !rounded-[2px] motion-reduce:animate-none"
      />
    </div>

    <p
      v-else-if="state === 'error' && runs.length === 0"
      class="flex h-7 items-center text-[11.5px] text-ink-3"
      :data-testid="`iq-public-trend-error-${testKey}`"
    >
      {{ t('iqDetection.public.trend.error') }}
    </p>

    <template v-else>
      <div
        class="flex h-7 items-end justify-end gap-[3px]"
        role="img"
        :aria-label="ariaLabel"
      >
        <span
          v-for="n in padCount"
          :key="`pad-${n}`"
          class="h-1 min-w-[3px] max-w-[14px] flex-1 rounded-[2px] bg-surface-3"
          aria-hidden="true"
        />
        <span
          v-for="bar in bars"
          :key="bar.id"
          class="min-w-[3px] max-w-[14px] flex-1 rounded-[2px]"
          :class="bar.colorClass"
          :style="{ height: `${bar.height}%` }"
          :title="bar.title"
          aria-hidden="true"
          data-testid="iq-public-trend-bar"
        />
      </div>
      <div class="mt-1 flex items-center justify-between text-[10.5px] leading-[14px] text-ink-3">
        <span>{{ t('iqDetection.public.trend.older') }}</span>
        <span class="tabular-nums">{{ t('iqDetection.public.trend.count', { n: bars.length }) }}</span>
        <span>{{ t('iqDetection.public.trend.latest') }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IQDetectionPublicRun } from './publicTypes'
import { formatDateTime, verdictDotClasses } from '../verdictMeta'
import type { DisplayVerdict } from '../verdictMeta'
import {
  describePublicRunResult,
  resolvePublicRunScore,
  runTimestamp,
  toDisplayVerdict
} from './publicMeta'

const props = withDefaults(
  defineProps<{
    /** Runs newest first, as returned by the API. */
    runs: IQDetectionPublicRun[]
    state?: 'idle' | 'loading' | 'ready' | 'error'
    slots?: number
    benchmarkLabel: string
    testKey: string
  }>(),
  {
    state: 'idle',
    slots: 24
  }
)

const { t } = useI18n()

const MIN_BAR_PCT = 14

const bars = computed(() => {
  const ordered = props.runs.slice(0, props.slots).reverse()
  return ordered.map((run) => {
    const verdict = toDisplayVerdict(run.verdict)
    const score = resolvePublicRunScore(run)
    // Failed checks have no score: draw a full-height hollow column so an
    // outage reads as "no measurement" rather than as a high or tiny score.
    const height = verdict === 'error' ? 100 : Math.max(MIN_BAR_PCT, score ?? MIN_BAR_PCT)
    const result = describePublicRunResult(run)
    const resultText =
      result.key === 'none' ? '—' : t(`iqDetection.public.result.${result.key}`, result.params)
    return {
      id: run.id,
      height,
      colorClass:
        verdict === 'error'
          ? 'border border-dashed border-red-500 bg-red-500/10 dark:border-red-400'
          : verdictDotClasses(verdict),
      title: `${formatDateTime(runTimestamp(run))} · ${t(`iqDetection.verdict.${verdict}`)} · ${resultText}`,
      verdict
    }
  })
})

const padCount = computed(() => Math.max(0, props.slots - bars.value.length))

const ariaLabel = computed(() => {
  const counts = new Map<DisplayVerdict, number>()
  for (const bar of bars.value) {
    counts.set(bar.verdict, (counts.get(bar.verdict) ?? 0) + 1)
  }
  const parts = (['normal', 'warning', 'degraded', 'error'] as const)
    .filter((v) => (counts.get(v) ?? 0) > 0)
    .map((v) => `${t(`iqDetection.verdict.${v}`)} ${counts.get(v)}`)
  return t('iqDetection.public.trend.aria', {
    benchmark: props.benchmarkLabel,
    n: bars.value.length,
    summary: parts.join(', ') || t('iqDetection.public.trend.empty')
  })
})
</script>
