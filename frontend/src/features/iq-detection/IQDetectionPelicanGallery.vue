<template>
  <section
    class="overflow-hidden rounded-card border border-edge bg-surface shadow-xs"
    data-testid="iq-pelican-gallery"
  >
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-edge bg-surface-2 px-4 py-3 sm:px-5"
    >
      <div class="min-w-0">
        <h2 class="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <Icon name="sparkles" size="sm" class="shrink-0 text-primary-600 dark:text-primary-400" />
          <span class="truncate">{{ t('iqDetection.pelican.galleryTitle') }}</span>
        </h2>
        <p class="mt-0.5 text-xs text-ink-2">
          {{ t('iqDetection.pelican.gallerySubtitle') }}
        </p>
      </div>

      <span class="chip shrink-0">
        <Icon name="shield" size="xs" class="text-primary-600 dark:text-primary-400" />
        {{ t('iqDetection.pelican.sandboxNotice') }}
      </span>
    </div>

    <!-- Empty state when Pelican SVG is selected/configured but no Pelican runs exist yet -->
    <div
      v-if="galleryCards.length === 0"
      class="flex flex-col items-center justify-center px-6 py-10 text-center"
      data-testid="iq-pelican-empty"
    >
      <span
        class="inline-flex h-10 w-10 items-center justify-center rounded-field bg-primary-50 text-primary-700"
      >
        <Icon name="sparkles" size="md" />
      </span>
      <h3 class="mt-3 text-[13.5px] font-semibold text-ink">
        {{ t('iqDetection.pelican.emptyTitle') }}
      </h3>
      <p class="mt-1 max-w-lg text-xs leading-relaxed text-ink-2">
        {{ t('iqDetection.pelican.emptyDescription') }}
      </p>
      <button
        type="button"
        class="btn btn-primary btn-sm mt-4"
        data-testid="iq-pelican-empty-run-btn"
        :disabled="running"
        @click="emit('run-pelican')"
      >
        <Icon name="play" size="xs" />
        {{ running ? t('iqDetection.actions.runningAll') : t('iqDetection.pelican.runPelicanNow') }}
      </button>
    </div>

    <!-- Hairline-divided gallery grid adapting cleanly to 1, 2, or 3+ items -->
    <div
      v-else
      class="grid grid-cols-1 bg-surface"
      :class="galleryGridClass"
    >
      <article
        v-for="item in galleryCards"
        :key="item.run.id"
        :data-testid="`iq-pelican-card-${item.run.group_id}`"
        class="flex flex-col border-b border-edge bg-surface md:border-r"
      >
        <!-- Cell header -->
        <div class="flex items-start justify-between gap-2 border-b border-edge px-4 py-2.5">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <h3 class="truncate text-[13px] font-semibold text-ink">
                {{ item.run.group_name }}
              </h3>
              <span class="shrink-0 font-mono text-[11px] text-ink-3">#{{ item.run.group_id }}</span>
            </div>
            <div class="mt-0.5 truncate font-mono text-[11px] tabular-nums text-ink-2">
              {{ item.run.response_model || item.run.requested_model }} · {{ formatDateTime(item.run.completed_at) }}
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <span
              class="font-mono text-xs font-bold tabular-nums"
              :class="scoreTextClasses(item.score)"
            >
              {{ t('iqDetection.pelican.scoreUnit', { score: Math.round(item.score) }) }}
            </span>
            <span
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="verdictBadgeClasses(item.run.verdict)"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="verdictDotClasses(item.run.verdict)" />
              {{ t(`iqDetection.verdict.${item.run.verdict}`) }}
            </span>
          </div>
        </div>

        <!-- Live sandboxed SVG stage -->
        <div class="relative h-52 w-full overflow-hidden bg-surface-3">
          <iframe
            v-if="item.srcdoc"
            :key="`${item.run.id}-${replayCounter[item.run.id] ?? 0}`"
            :srcdoc="item.srcdoc"
            :title="`${item.run.group_name} Pelican SVG`"
            sandbox="allow-scripts"
            referrerpolicy="no-referrer"
            class="h-full w-full border-0"
          />
          <div
            v-else
            class="flex h-full w-full items-center justify-center px-4 text-center text-xs text-ink-3"
          >
            {{ item.run.error_message || t('iqDetection.pelican.noArtifact') }}
          </div>
        </div>

        <!-- Structural diagnostic chips & actions -->
        <div class="flex flex-1 flex-col justify-between gap-2.5 border-t border-edge px-4 py-2.5">
          <div v-if="item.eval" class="flex flex-wrap gap-1.5 text-[11px]">
            <span class="rounded-md bg-surface-3 px-2 py-0.5 font-mono tabular-nums text-ink-2">
              {{ t('iqDetection.pelican.primitivesChip', { count: item.eval.primitive_count }) }}
            </span>
            <span class="rounded-md bg-surface-3 px-2 py-0.5 font-mono tabular-nums text-ink-2">
              {{ t('iqDetection.pelican.curvesChip', { count: item.eval.curve_command_count }) }}
            </span>
            <span
              class="rounded-md px-2 py-0.5 font-medium"
              :class="
                item.eval.has_animation
                  ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
              "
            >
              {{
                item.eval.has_animation
                  ? t('iqDetection.pelican.animationsChip', { count: item.eval.animation_driver_count })
                  : t('iqDetection.pelican.noAnimationChip')
              }}
            </span>
            <span
              class="rounded-md px-2 py-0.5 font-medium"
              :class="
                item.eval.wheel_pair_detected
                  ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
              "
            >
              {{
                item.eval.wheel_pair_detected
                  ? t('iqDetection.pelican.wheelsPassChip')
                  : t('iqDetection.pelican.wheelsMissChip')
              }}
            </span>
            <span
              v-if="!item.eval.offline_compliant"
              class="rounded-md bg-red-500/10 px-2 py-0.5 font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300"
            >
              {{ t('iqDetection.pelican.offlineFailChip') }}
            </span>
          </div>

          <div class="flex items-center justify-between gap-2 pt-0.5">
            <span class="font-mono text-[11px] tabular-nums text-ink-3">
              {{ Math.round(item.run.avg_reasoning_tokens) }} / {{ Math.round(item.run.avg_output_tokens) }} tok · {{ formatLatencyMs(item.run.avg_latency_ms) }}
            </span>

            <div class="inline-flex items-center gap-1.5">
              <button
                v-if="item.srcdoc"
                type="button"
                class="btn btn-secondary btn-sm !h-7 !px-2 text-[11px]"
                @click="replayAnimation(item.run.id)"
              >
                <Icon name="refresh" size="xs" />
                {{ t('iqDetection.pelican.replay') }}
              </button>
              <button
                type="button"
                class="btn btn-secondary btn-sm !h-7 !px-2 text-[11px]"
                :data-testid="`iq-pelican-inspect-${item.run.group_id}`"
                @click="emit('inspect', item.run)"
              >
                <Icon name="eye" size="xs" />
                {{ t('iqDetection.actions.viewDetails') }}
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { IQDetectionPelicanEval, IQDetectionRun } from './types'
import { buildSandboxedPelicanSrcdoc, pickPrimaryPelicanSample } from './sandboxHtml'
import {
  formatDateTime,
  formatLatencyMs,
  scoreTextClasses,
  verdictBadgeClasses,
  verdictDotClasses
} from './verdictMeta'

const props = withDefaults(
  defineProps<{
    runs: IQDetectionRun[]
    running?: boolean
  }>(),
  {
    running: false
  }
)

const emit = defineEmits<{
  (e: 'inspect', run: IQDetectionRun): void
  (e: 'run-pelican'): void
}>()

const { t } = useI18n()
const replayCounter = reactive<Record<number, number>>({})

interface GalleryCard {
  run: IQDetectionRun
  srcdoc: string
  score: number
  eval: IQDetectionPelicanEval | null
}

const galleryCards = computed<GalleryCard[]>(() =>
  props.runs.map((run) => {
    const sample = pickPrimaryPelicanSample(run)
    const html = sample?.artifact_html ?? ''
    const evalData = sample?.pelican_eval ?? null
    const score = evalData?.score ?? run.avg_score ?? sample?.score ?? 0
    return {
      run,
      srcdoc: html ? buildSandboxedPelicanSrcdoc(html) : '',
      score,
      eval: evalData
    }
  })
)

const galleryGridClass = computed(() => {
  const n = galleryCards.value.length
  if (n <= 1) return 'md:grid-cols-1 [&>article]:md:border-r-0 [&>article:last-child]:border-b-0'
  if (n === 2) {
    return 'md:grid-cols-2 [&>article:nth-child(2n)]:md:border-r-0 [&>article:nth-last-child(-n+2)]:md:border-b-0 [&>article:last-child]:border-b-0'
  }
  return 'md:grid-cols-2 xl:grid-cols-3 [&>article:nth-child(2n)]:md:border-r-0 [&>article:nth-child(2n)]:xl:border-r [&>article:nth-child(3n)]:xl:border-r-0 [&>article:last-child]:border-b-0'
})

function replayAnimation(runId: number) {
  replayCounter[runId] = (replayCounter[runId] ?? 0) + 1
}
</script>
