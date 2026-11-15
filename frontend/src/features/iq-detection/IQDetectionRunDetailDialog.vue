<template>
  <BaseDialog
    :show="show && Boolean(run)"
    :title="dialogTitle"
    width="extra-wide"
    @close="emit('close')"
  >
    <div v-if="run" class="space-y-5">
      <!-- Summary strip -->
      <div
        class="grid grid-cols-2 gap-3 rounded-2xl bg-gray-50/80 p-4 ring-1 ring-gray-900/5 dark:bg-dark-900/60 dark:ring-dark-700 sm:grid-cols-4 lg:grid-cols-7"
      >
        <div>
          <div class="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {{ t('iqDetection.overview.colVerdict') }}
          </div>
          <div class="mt-1">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              :class="verdictBadgeClasses(run.verdict)"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="verdictDotClasses(run.verdict)" />
              {{ t(`iqDetection.verdict.${run.verdict}`) }}
            </span>
          </div>
        </div>

        <div>
          <div class="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {{ t('iqDetection.detail.metaAccuracy') }}
          </div>
          <div class="mt-1 font-mono text-sm font-bold tabular-nums text-gray-900 dark:text-white">
            {{ run.correct_count }}/{{ run.graded_count || run.tests_count }}
          </div>
        </div>

        <div>
          <div class="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {{ t('iqDetection.detail.metaTruncated') }}
          </div>
          <div
            class="mt-1 font-mono text-sm font-bold tabular-nums"
            :class="
              run.truncated_count > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            "
          >
            {{ run.truncated_count }}/{{ run.graded_count || run.tests_count }}
          </div>
        </div>

        <div>
          <div class="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {{ t('iqDetection.detail.metaRequestedModel') }}
          </div>
          <div class="mt-1 truncate font-mono text-xs font-medium text-gray-900 dark:text-gray-100">
            {{ run.requested_model || '—' }}
          </div>
        </div>

        <div>
          <div class="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {{ t('iqDetection.detail.metaResponseModel') }}
          </div>
          <div class="mt-1 truncate font-mono text-xs font-medium text-gray-900 dark:text-gray-100">
            {{ run.response_model || '—' }}
          </div>
        </div>

        <div>
          <div class="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {{ t('iqDetection.detail.metaEffort') }}
          </div>
          <div class="mt-1 font-mono text-xs font-semibold uppercase text-gray-900 dark:text-gray-100">
            {{ run.reasoning_effort }}
          </div>
        </div>

        <div>
          <div class="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {{ t('iqDetection.detail.metaCompletedAt') }}
          </div>
          <div class="mt-1 font-mono text-xs tabular-nums text-gray-700 dark:text-gray-300">
            {{ formatDateTime(run.completed_at) }}
          </div>
        </div>
      </div>

      <!-- Run-level error banner -->
      <div
        v-if="run.error_message"
        class="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
      >
        {{ run.error_message }}
      </div>

      <!-- Samples table -->
      <div
        v-if="run.samples && run.samples.length > 0"
        class="overflow-x-auto rounded-2xl ring-1 ring-gray-200/80 dark:ring-dark-700"
      >
        <table class="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-dark-700">
          <thead class="bg-gray-50/90 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-dark-900/70 dark:text-gray-400">
            <tr>
              <th class="px-3 py-2.5">{{ t('iqDetection.detail.colRun') }}</th>
              <th class="px-3 py-2.5">{{ t('iqDetection.detail.colAccount') }}</th>
              <th class="px-3 py-2.5">{{ t('iqDetection.detail.colProtocol') }}</th>
              <th class="px-3 py-2.5">{{ t('iqDetection.detail.colOk') }}</th>
              <th class="px-3 py-2.5">{{ t('iqDetection.detail.colTokens') }}</th>
              <th class="px-3 py-2.5">{{ t('iqDetection.detail.colPerf') }}</th>
              <th class="px-3 py-2.5">{{ t('iqDetection.detail.colModel') }}</th>
              <th class="px-3 py-2.5">{{ t('iqDetection.detail.colOutput') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white dark:divide-dark-700/70 dark:bg-dark-800">
            <tr
              v-for="sample in run.samples"
              :key="sample.run_index"
              class="align-top transition-colors hover:bg-gray-50/60 dark:hover:bg-dark-700/40"
            >
              <td class="whitespace-nowrap px-3 py-3 font-mono font-semibold tabular-nums text-gray-700 dark:text-gray-200">
                #{{ sample.run_index }}
              </td>

              <td class="whitespace-nowrap px-3 py-3">
                <div class="font-medium text-gray-900 dark:text-white">
                  {{ sample.account_name || `#${sample.account_id || '—'}` }}
                </div>
                <div v-if="sample.account_id" class="font-mono text-[11px] text-gray-400">
                  ID {{ sample.account_id }} · {{ sample.account_type || 'oauth' }}
                </div>
              </td>

              <td class="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-gray-500 dark:text-gray-400">
                {{ sample.protocol || '—' }}
              </td>

              <td class="whitespace-nowrap px-3 py-3">
                <span
                  v-if="!sample.graded"
                  class="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300"
                >
                  <Icon name="xCircle" size="xs" />
                  {{ t('iqDetection.detail.errorBadge') }}
                </span>
                <span
                  v-else-if="sample.ok"
                  class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                >
                  <Icon name="checkCircle" size="xs" />
                  {{ t('iqDetection.detail.passBadge') }}
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                >
                  <Icon name="xCircle" size="xs" />
                  {{ t('iqDetection.detail.failBadge') }}
                </span>
              </td>

              <td class="whitespace-nowrap px-3 py-3 font-mono tabular-nums">
                <div class="text-gray-700 dark:text-gray-200">
                  {{ sample.input_tokens }} / {{ sample.output_tokens }} /
                  <span
                    class="font-bold"
                    :class="
                      sample.truncated
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    "
                  >
                    {{ sample.reasoning_tokens }}
                  </span>
                </div>
                <div v-if="sample.graded && sample.truncated" class="mt-1">
                  <span
                    class="inline-flex items-center gap-1 rounded bg-amber-100/90 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  >
                    <Icon name="exclamationTriangle" size="xs" />
                    {{
                      sample.truncation_signature === 'zero_reasoning'
                        ? t('iqDetection.detail.truncatedZero')
                        : t('iqDetection.detail.truncatedStep', {
                            sig: sample.truncation_signature || sample.reasoning_tokens
                          })
                    }}
                  </span>
                </div>
              </td>

              <td class="whitespace-nowrap px-3 py-3 font-mono tabular-nums text-gray-700 dark:text-gray-300">
                <div>{{ formatLatencyMs(sample.latency_ms) }}</div>
                <div class="text-[11px] text-gray-400">{{ formatTps(sample.tps) }}</div>
              </td>

              <td class="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-gray-700 dark:text-gray-300">
                {{ sample.response_model || '—' }}
              </td>

              <td class="min-w-[260px] max-w-md px-3 py-3">
                <div
                  v-if="sample.error_message"
                  class="whitespace-pre-wrap break-words font-mono text-[11px] text-red-600 dark:text-red-400"
                >
                  {{ sample.error_message }}
                </div>
                <div
                  v-else
                  class="max-h-36 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-gray-700 dark:bg-dark-900/60 dark:text-gray-200"
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'
import type { IQDetectionRun } from './types'
import {
  formatDateTime,
  formatLatencyMs,
  formatTps,
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

const dialogTitle = computed(() =>
  t('iqDetection.detail.title', {
    group: props.run?.group_name || `#${props.run?.group_id ?? ''}`
  })
)
</script>
