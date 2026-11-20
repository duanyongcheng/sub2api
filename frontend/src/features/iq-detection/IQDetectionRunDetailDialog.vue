<template>
  <BaseDialog
    :show="show && Boolean(run)"
    :title="dialogTitle"
    width="extra-wide"
    @close="emit('close')"
  >
    <div v-if="run" class="space-y-4">
      <!-- Hairline summary strip -->
      <div
        class="grid grid-cols-2 divide-y divide-edge overflow-hidden rounded-card border border-edge bg-surface-2 sm:grid-cols-4 lg:grid-cols-7 lg:divide-x lg:divide-y-0"
      >
        <div class="px-3.5 py-2.5">
          <div class="text-[11px] font-semibold text-ink-3">
            {{ t('iqDetection.detail.metaBenchmark') }}
          </div>
          <div class="mt-1">
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
              :class="benchmarkBadgeClasses(benchmarkType)"
            >
              {{ t(`iqDetection.benchmark.${benchmarkType}`) }}
            </span>
          </div>
        </div>

        <div class="px-3.5 py-2.5">
          <div class="text-[11px] font-semibold text-ink-3">
            {{ t('iqDetection.overview.colVerdict') }}
          </div>
          <div class="mt-1">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
              :class="verdictBadgeClasses(run.verdict)"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="verdictDotClasses(run.verdict)" />
              {{ t(`iqDetection.verdict.${run.verdict}`) }}
            </span>
          </div>
        </div>

        <div class="px-3.5 py-2.5">
          <div class="text-[11px] font-semibold text-ink-3">
            {{
              isPelican
                ? t('iqDetection.detail.metaScore')
                : t('iqDetection.detail.metaAccuracy')
            }}
          </div>
          <div class="mt-1 font-mono text-sm font-bold tabular-nums text-ink">
            <template v-if="isPelican">
              <span :class="scoreTextClasses(run.avg_score ?? 0)">
                {{ t('iqDetection.pelican.scoreUnit', { score: Math.round(run.avg_score ?? 0) }) }}
              </span>
              <span class="ml-1 text-xs font-normal text-ink-3">
                ({{ run.correct_count }}/{{ run.graded_count || run.tests_count }})
              </span>
            </template>
            <template v-else>
              {{ run.correct_count }}/{{ run.graded_count || run.tests_count }}
            </template>
          </div>
        </div>

        <div class="px-3.5 py-2.5">
          <div class="text-[11px] font-semibold text-ink-3">
            {{ t('iqDetection.detail.metaRequestedModel') }}
          </div>
          <div class="mt-1 truncate font-mono text-xs font-medium text-ink">
            {{ run.requested_model || '—' }}
          </div>
        </div>

        <div class="px-3.5 py-2.5">
          <div class="text-[11px] font-semibold text-ink-3">
            {{ t('iqDetection.detail.metaResponseModel') }}
          </div>
          <div class="mt-1 truncate font-mono text-xs font-medium text-ink">
            {{ run.response_model || '—' }}
          </div>
        </div>

        <div class="px-3.5 py-2.5">
          <div class="text-[11px] font-semibold text-ink-3">
            {{ t('iqDetection.detail.metaEffort') }}
          </div>
          <div class="mt-1 font-mono text-xs font-semibold uppercase text-ink">
            {{ run.reasoning_effort }}
          </div>
        </div>

        <div class="col-span-2 px-3.5 py-2.5 sm:col-span-2 lg:col-span-1">
          <div class="text-[11px] font-semibold text-ink-3">
            {{ t('iqDetection.detail.metaCompletedAt') }}
          </div>
          <div class="mt-1 font-mono text-xs tabular-nums text-ink-2">
            {{ formatDateTime(run.completed_at) }}
          </div>
        </div>
      </div>

      <!-- Run-level error banner -->
      <div
        v-if="run.error_message"
        class="rounded-field border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-700 dark:text-red-300"
      >
        {{ run.error_message }}
      </div>

      <!-- Pelican SVG Interactive Stage & Diagnostic Breakdown -->
      <section
        v-if="isPelican && activePelicanSample"
        class="overflow-hidden rounded-card border border-edge bg-surface"
        data-testid="iq-pelican-detail-stage"
      >
        <!-- Stage toolbar -->
        <div
          class="flex flex-wrap items-center justify-between gap-2 border-b border-edge bg-surface-2 px-4 py-2.5"
        >
          <div class="flex flex-wrap items-center gap-2">
            <!-- Sample selector when tests_per_group > 1 -->
            <div v-if="run.samples.length > 1" class="seg" role="tablist">
              <button
                v-for="s in run.samples"
                :key="s.run_index"
                type="button"
                class="font-mono text-xs"
                :class="{ on: selectedSampleIndex === s.run_index }"
                :aria-pressed="selectedSampleIndex === s.run_index"
                @click="selectedSampleIndex = s.run_index"
              >
                #{{ s.run_index }}
                <span v-if="s.graded" class="ml-1 opacity-75">({{ s.score ?? s.pelican_eval?.score ?? 0 }})</span>
              </button>
            </div>

            <!-- Live Preview vs Source Code mode switch -->
            <div class="seg" role="tablist">
              <button
                type="button"
                data-testid="iq-pelican-mode-preview"
                :class="{ on: stageMode === 'preview' }"
                :aria-pressed="stageMode === 'preview'"
                @click="stageMode = 'preview'"
              >
                {{ t('iqDetection.pelican.previewTab') }}
              </button>
              <button
                type="button"
                data-testid="iq-pelican-mode-source"
                :class="{ on: stageMode === 'source' }"
                :aria-pressed="stageMode === 'source'"
                @click="stageMode = 'source'"
              >
                {{ t('iqDetection.pelican.sourceTab') }}
              </button>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="hidden items-center gap-1 text-[11px] text-ink-2 sm:inline-flex">
              <Icon name="shield" size="xs" class="text-primary-600 dark:text-primary-400" />
              {{ t('iqDetection.pelican.sandboxNotice') }}
            </span>
            <button
              v-if="activePelicanSrcdoc && stageMode === 'preview'"
              type="button"
              class="btn btn-secondary btn-sm !h-7 !px-2.5 text-xs"
              @click="replayTick += 1"
            >
              <Icon name="refresh" size="xs" />
              {{ t('iqDetection.pelican.replay') }}
            </button>
            <button
              v-if="activePelicanSample.artifact_html"
              type="button"
              class="btn btn-secondary btn-sm !h-7 !px-2.5 text-xs"
              @click="copyPelicanHTML"
            >
              <Icon name="copy" size="xs" />
              {{ t('iqDetection.pelican.copyHtml') }}
            </button>
          </div>
        </div>

        <!-- Stage Canvas or Source Code -->
        <div v-if="stageMode === 'preview'" class="relative h-[360px] w-full bg-surface-3 sm:h-[420px]">
          <iframe
            v-if="activePelicanSrcdoc"
            :key="`${run.id}-${activePelicanSample.run_index}-${replayTick}`"
            :srcdoc="activePelicanSrcdoc"
            :title="`${run.group_name} #${activePelicanSample.run_index} Pelican SVG`"
            sandbox="allow-scripts"
            referrerpolicy="no-referrer"
            class="h-full w-full border-0"
          />
          <div
            v-else
            class="flex h-full w-full items-center justify-center px-6 text-center text-xs text-ink-3"
          >
            {{ activePelicanSample.error_message || t('iqDetection.pelican.noArtifact') }}
          </div>
        </div>

        <pre
          v-else
          class="max-h-[420px] overflow-auto bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100"
          data-testid="iq-pelican-source-code"
        >{{ activePelicanSample.artifact_html || activePelicanSample.answer_text || t('iqDetection.detail.emptyAnswer') }}</pre>

        <!-- Structural Eval Breakdown -->
        <div
          v-if="activePelicanSample.pelican_eval"
          class="space-y-2 border-t border-edge px-4 py-3 text-xs"
        >
          <div class="flex flex-wrap items-center gap-1.5">
            <span
              class="rounded-md bg-surface-3 px-2.5 py-0.5 font-mono font-bold tabular-nums"
              :class="scoreTextClasses(activePelicanSample.pelican_eval.score)"
            >
              {{ t('iqDetection.pelican.scoreUnit', { score: activePelicanSample.pelican_eval.score }) }}
            </span>

            <span
              class="rounded-md px-2 py-0.5 font-medium"
              :class="
                activePelicanSample.pelican_eval.has_complete_html
                  ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
              "
            >
              {{
                activePelicanSample.pelican_eval.has_complete_html
                  ? t('iqDetection.pelican.htmlCompleteChip')
                  : t('iqDetection.pelican.htmlIncompleteChip')
              }}
            </span>

            <span
              class="rounded-md px-2 py-0.5 font-medium"
              :class="
                activePelicanSample.pelican_eval.offline_compliant
                  ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-300'
              "
            >
              {{
                activePelicanSample.pelican_eval.offline_compliant
                  ? t('iqDetection.pelican.offlinePassChip')
                  : t('iqDetection.pelican.offlineFailChip')
              }}
            </span>

            <span class="rounded-md bg-surface-3 px-2 py-0.5 font-mono tabular-nums text-ink-2">
              {{ t('iqDetection.pelican.primitivesChip', { count: activePelicanSample.pelican_eval.primitive_count }) }}
            </span>
            <span class="rounded-md bg-surface-3 px-2 py-0.5 font-mono tabular-nums text-ink-2">
              {{ t('iqDetection.pelican.curvesChip', { count: activePelicanSample.pelican_eval.curve_command_count }) }}
            </span>
            <span class="rounded-md bg-surface-3 px-2 py-0.5 font-mono tabular-nums text-ink-2">
              {{ t('iqDetection.pelican.groupsChip', { count: activePelicanSample.pelican_eval.group_count }) }}
            </span>
            <span class="rounded-md bg-surface-3 px-2 py-0.5 font-mono tabular-nums text-ink-2">
              {{ t('iqDetection.pelican.colorsChip', { count: activePelicanSample.pelican_eval.unique_color_count }) }}
            </span>

            <span
              class="rounded-md px-2 py-0.5 font-medium"
              :class="
                activePelicanSample.pelican_eval.has_animation
                  ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
              "
            >
              {{
                activePelicanSample.pelican_eval.has_animation
                  ? t('iqDetection.pelican.animationsChip', {
                      count: activePelicanSample.pelican_eval.animation_driver_count
                    })
                  : t('iqDetection.pelican.noAnimationChip')
              }}
            </span>

            <span
              class="rounded-md px-2 py-0.5 font-medium"
              :class="
                activePelicanSample.pelican_eval.wheel_pair_detected
                  ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
              "
            >
              {{
                activePelicanSample.pelican_eval.wheel_pair_detected
                  ? t('iqDetection.pelican.wheelsPassChip')
                  : t('iqDetection.pelican.wheelsMissChip')
              }}
            </span>
          </div>

          <div
            v-if="activePelicanSample.pelican_eval.semantic_parts_detected?.length"
            class="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-2"
          >
            <span class="font-medium text-ink-3">
              {{ t('iqDetection.pelican.semanticPartsLabel') }}
            </span>
            <span
              v-for="part in activePelicanSample.pelican_eval.semantic_parts_detected"
              :key="part"
              class="rounded bg-primary-50 px-2 py-0.5 font-medium text-primary-700"
            >
              {{ formatPelicanPart(part) }}
            </span>
          </div>

          <div
            v-if="activePelicanSample.pelican_eval.issues?.length"
            class="flex flex-wrap items-center gap-1.5 text-[11px]"
          >
            <span class="font-medium text-amber-700 dark:text-amber-300">
              {{ t('iqDetection.pelican.issuesLabel') }}
            </span>
            <span
              v-for="issue in activePelicanSample.pelican_eval.issues"
              :key="issue"
              class="rounded bg-amber-500/10 px-2 py-0.5 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
            >
              {{ formatPelicanIssue(issue) }}
            </span>
          </div>
        </div>
      </section>

      <!-- Samples table -->
      <div
        v-if="run.samples && run.samples.length > 0"
        class="overflow-x-auto rounded-card border border-edge bg-surface"
      >
        <table class="min-w-full divide-y divide-edge text-left text-xs">
          <thead class="bg-surface-2 text-[11.5px] font-semibold text-ink-3">
            <tr>
              <th class="whitespace-nowrap px-3.5 py-2.5">{{ t('iqDetection.detail.colRun') }}</th>
              <th class="whitespace-nowrap px-3.5 py-2.5">{{ t('iqDetection.detail.colAccount') }}</th>
              <th class="whitespace-nowrap px-3.5 py-2.5">{{ t('iqDetection.detail.colProtocol') }}</th>
              <th class="whitespace-nowrap px-3.5 py-2.5">{{ t('iqDetection.detail.colOk') }}</th>
              <th class="whitespace-nowrap px-3.5 py-2.5">{{ t('iqDetection.detail.colTokens') }}</th>
              <th class="whitespace-nowrap px-3.5 py-2.5">{{ t('iqDetection.detail.colPerf') }}</th>
              <th class="whitespace-nowrap px-3.5 py-2.5">{{ t('iqDetection.detail.colModel') }}</th>
              <th class="whitespace-nowrap px-3.5 py-2.5">{{ t('iqDetection.detail.colOutput') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-edge bg-surface">
            <tr
              v-for="sample in run.samples"
              :key="sample.run_index"
              class="align-top transition-colors hover:bg-surface-2"
            >
              <td class="whitespace-nowrap px-3.5 py-3 font-mono font-semibold tabular-nums text-ink">
                #{{ sample.run_index }}
              </td>

              <td class="whitespace-nowrap px-3.5 py-3">
                <div class="font-medium text-ink">
                  {{ sample.account_name || `#${sample.account_id || '—'}` }}
                </div>
                <div v-if="sample.account_id" class="font-mono text-[11px] text-ink-3">
                  ID {{ sample.account_id }} · {{ sample.account_type || 'oauth' }}
                </div>
              </td>

              <td class="whitespace-nowrap px-3.5 py-3 font-mono text-[11px] text-ink-2">
                {{ sample.protocol || '—' }}
              </td>

              <td class="whitespace-nowrap px-3.5 py-3">
                <span
                  v-if="!sample.graded"
                  class="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300"
                >
                  <Icon name="xCircle" size="xs" />
                  {{ t('iqDetection.detail.errorBadge') }}
                </span>
                <template v-else-if="isPelican">
                  <span
                    class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                    :class="pelicanSampleBadgeClasses(sample.score ?? sample.pelican_eval?.score ?? 0, sample.ok)"
                  >
                    <Icon :name="sample.ok ? 'checkCircle' : 'exclamationTriangle'" size="xs" />
                    {{ formatPelicanSampleBadge(sample.score ?? sample.pelican_eval?.score ?? 0, sample.ok) }}
                  </span>
                </template>
                <span
                  v-else-if="sample.ok"
                  class="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                >
                  <Icon name="checkCircle" size="xs" />
                  {{ t('iqDetection.detail.passBadge') }}
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                >
                  <Icon name="xCircle" size="xs" />
                  {{ t('iqDetection.detail.failBadge') }}
                </span>
              </td>

              <td class="whitespace-nowrap px-3.5 py-3 font-mono tabular-nums text-ink-2">
                {{ sample.input_tokens }} / {{ sample.output_tokens }} /
                <span class="font-bold text-primary-700">
                  {{ sample.reasoning_tokens }}
                </span>
              </td>

              <td class="whitespace-nowrap px-3.5 py-3 font-mono tabular-nums text-ink-2">
                <div>{{ formatLatencyMs(sample.latency_ms) }}</div>
                <div class="text-[11px] text-ink-3">{{ formatTps(sample.tps) }}</div>
              </td>

              <td class="whitespace-nowrap px-3.5 py-3 font-mono text-[11px] text-ink-2">
                {{ sample.response_model || '—' }}
              </td>

              <td class="min-w-[260px] max-w-md px-3.5 py-3">
                <div
                  v-if="sample.error_message"
                  class="whitespace-pre-wrap break-words font-mono text-[11px] text-red-700 dark:text-red-300"
                >
                  {{ sample.error_message }}
                </div>
                <div
                  v-else
                  class="max-h-36 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-[11px] leading-relaxed text-ink"
                >
                  {{ sample.answer_text || t('iqDetection.detail.emptyAnswer') }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end">
        <button type="button" class="btn btn-secondary btn-sm" @click="emit('close')">
          {{ t('common.close') }}
        </button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'
import { useAppStore } from '@/stores/app'
import type { IQDetectionRun, IQDetectionSample } from './types'
import { buildSandboxedPelicanSrcdoc } from './sandboxHtml'
import {
  benchmarkBadgeClasses,
  formatDateTime,
  formatLatencyMs,
  formatTps,
  normalizeBenchmarkType,
  scoreTextClasses,
  verdictBadgeClasses,
  verdictDotClasses
} from './verdictMeta'

const props = defineProps<{
  show: boolean
  run: IQDetectionRun | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()
const appStore = useAppStore()

const stageMode = ref<'preview' | 'source'>('preview')
const selectedSampleIndex = ref<number>(1)
const replayTick = ref<number>(0)

watch(
  () => props.run?.id,
  () => {
    stageMode.value = 'preview'
    replayTick.value = 0
    const firstWithArtifact = props.run?.samples?.find((s) => Boolean(s.artifact_html))
    selectedSampleIndex.value = firstWithArtifact?.run_index ?? props.run?.samples?.[0]?.run_index ?? 1
  },
  { immediate: true }
)

const benchmarkType = computed(() => normalizeBenchmarkType(props.run?.benchmark_type))
const isPelican = computed(() => benchmarkType.value === 'pelican_svg')

const dialogTitle = computed(() =>
  t('iqDetection.detail.title', {
    group: props.run?.group_name || `#${props.run?.group_id ?? ''}`
  })
)

const activePelicanSample = computed<IQDetectionSample | null>(() => {
  if (!isPelican.value || !props.run?.samples?.length) {
    return null
  }
  return (
    props.run.samples.find((s) => s.run_index === selectedSampleIndex.value) ??
    props.run.samples[0] ??
    null
  )
})

const activePelicanSrcdoc = computed(() =>
  activePelicanSample.value?.artifact_html
    ? buildSandboxedPelicanSrcdoc(activePelicanSample.value.artifact_html)
    : ''
)

function pelicanSampleBadgeClasses(score: number, ok: boolean): string {
  if (ok) {
    return 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
  }
  if (score >= 45) {
    return 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
  }
  return 'bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
}

function formatPelicanSampleBadge(score: number, ok: boolean): string {
  if (ok) return t('iqDetection.detail.pelicanPassBadge', { score })
  if (score >= 45) return t('iqDetection.detail.pelicanWarnBadge', { score })
  return t('iqDetection.detail.pelicanFailBadge', { score })
}

function formatPelicanPart(part: string): string {
  const known = ['pelican', 'beak_pouch', 'wing_body', 'bike_frame', 'pedal_crank']
  return known.includes(part) ? t(`iqDetection.pelican.parts.${part}`) : part
}

function formatPelicanIssue(issue: string): string {
  const known = [
    'missing_html_svg',
    'external_network_resource',
    'missing_svg_element',
    'missing_viewbox',
    'missing_animation',
    'wheel_pair_not_detected',
    'incomplete_html_wrapper',
    'low_svg_complexity',
    'lacks_bezier_curves'
  ]
  return known.includes(issue) ? t(`iqDetection.pelican.issues.${issue}`) : issue
}

async function copyPelicanHTML() {
  const html = activePelicanSample.value?.artifact_html
  if (!html) return
  try {
    await navigator.clipboard.writeText(html)
    appStore.showSuccess(t('iqDetection.pelican.copiedHtml'))
  } catch {
    // 忽略无剪贴板权限环境
  }
}
</script>
