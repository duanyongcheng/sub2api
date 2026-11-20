<template>
  <section class="w-full space-y-4">
    <div
      v-if="loading && !draft"
      class="flex min-h-[220px] items-center justify-center rounded-card border border-edge bg-surface text-sm text-ink-3 shadow-xs"
    >
      <span class="animate-pulse">{{ t('common.loading') }}</span>
    </div>

    <template v-else-if="draft">
      <!-- Compact Save & Action Strip -->
      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-card border border-edge bg-surface px-4 py-3 shadow-xs sm:px-5"
      >
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-[14px] font-semibold text-ink">
              {{ t('iqDetection.settings.title') }}
            </h2>
            <span
              v-if="dirty"
              class="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/25 dark:bg-amber-500/15 dark:text-amber-300"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {{ t('iqDetection.settings.unsavedBadge') }}
            </span>
          </div>
          <p class="mt-0.5 text-xs text-ink-2">
            {{ t('iqDetection.settings.description') }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-testid="iq-save-and-run-btn"
            :disabled="saving || running || draft.group_ids.length === 0"
            @click="handleSaveAndRun"
          >
            <Icon name="play" size="xs" />
            {{ t('iqDetection.settings.saveAndRun') }}
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            data-testid="iq-save-config-btn"
            :disabled="saving || !dirty"
            @click="handleSave"
          >
            <Icon name="check" size="sm" />
            {{ saving ? t('iqDetection.settings.saving') : t('iqDetection.settings.save') }}
          </button>
        </div>
      </div>

      <!-- Asymmetric 2-Column Workspace: Target Groups (Left) + Probe/Schedule/Methodology (Right) -->
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,1fr)] xl:items-start">
        <!-- Left Column: Target Groups Multi-Select -->
        <div class="overflow-hidden rounded-card border border-edge bg-surface shadow-xs">
          <div class="border-b border-edge bg-surface-2 px-4 py-3 sm:px-5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="text-[13.5px] font-semibold text-ink">
                  {{ t('iqDetection.settings.groupsSectionTitle') }}
                </h3>
                <p class="mt-0.5 text-xs text-ink-2">
                  {{ t('iqDetection.settings.groupsSectionHint') }}
                </p>
              </div>
              <span
                class="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary-700 ring-1 ring-inset ring-primary-500/25"
              >
                {{ t('iqDetection.settings.selectedGroupsCount', { count: draft.group_ids.length }) }}
              </span>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-2">
              <div class="relative min-w-[200px] flex-1">
                <Icon
                  name="search"
                  size="xs"
                  class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
                />
                <input
                  v-model="groupSearch"
                  type="search"
                  class="h-8 w-full rounded-lg border border-edge-strong bg-surface pl-8 pr-3 text-xs text-ink placeholder:text-ink-3 focus:border-primary-500 focus:outline-none focus:ring-[3px] focus:ring-primary-500/15"
                  :placeholder="t('iqDetection.settings.searchGroupsPlaceholder')"
                />
              </div>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                data-testid="iq-select-active-groups-btn"
                :disabled="loadingGroups || openaiGroups.length === 0"
                @click="selectActiveGroups"
              >
                {{ t('iqDetection.settings.selectActiveGroups') }}
              </button>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                data-testid="iq-clear-groups-btn"
                :disabled="draft.group_ids.length === 0"
                @click="clearSelectedGroups"
              >
                {{ t('iqDetection.settings.clearGroups') }}
              </button>
            </div>
          </div>

          <div class="max-h-[560px] overflow-y-auto p-4 sm:p-5">
            <div v-if="loadingGroups" class="py-10 text-center text-xs text-ink-3">
              {{ t('iqDetection.settings.loadingGroups') }}
            </div>
            <div
              v-else-if="filteredGroups.length === 0 && staleSelectedIds.length === 0"
              class="py-10 text-center text-xs text-ink-3"
            >
              {{ t('iqDetection.settings.noMatchingGroups') }}
            </div>
            <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <!-- Stale group IDs that no longer exist in catalog -->
              <label
                v-for="staleId in staleSelectedIds"
                :key="`stale-${staleId}`"
                class="flex cursor-pointer items-start gap-2.5 rounded-field border border-amber-500/35 bg-amber-500/10 p-2.5 text-xs transition-colors hover:border-amber-500/60"
              >
                <input
                  type="checkbox"
                  class="mt-0.5 h-4 w-4 rounded border-edge-strong accent-primary-600"
                  :checked="selectedSet.has(staleId)"
                  @change="toggleGroup(staleId)"
                />
                <span class="font-medium text-amber-800 dark:text-amber-200">
                  {{ t('iqDetection.settings.staleGroupHint', { id: staleId }) }}
                </span>
              </label>

              <!-- Catalog OpenAI groups -->
              <label
                v-for="group in filteredGroups"
                :key="group.id"
                :data-group-id="group.id"
                class="flex cursor-pointer items-start gap-2.5 rounded-field border p-2.5 transition-colors"
                :class="
                  selectedSet.has(group.id)
                    ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-950/30'
                    : 'border-edge bg-surface hover:border-edge-strong hover:bg-surface-2'
                "
              >
                <input
                  type="checkbox"
                  class="mt-0.5 h-4 w-4 shrink-0 rounded border-edge-strong accent-primary-600"
                  :checked="selectedSet.has(group.id)"
                  @change="toggleGroup(group.id)"
                />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <span class="truncate text-[13px] font-semibold text-ink">
                      {{ group.name }}
                    </span>
                    <span class="shrink-0 font-mono text-[11px] text-ink-3">#{{ group.id }}</span>
                  </div>
                  <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span
                      class="inline-flex items-center rounded px-1.5 py-0.5 font-medium"
                      :class="
                        group.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'bg-surface-3 text-ink-3'
                      "
                    >
                      {{
                        group.status === 'active'
                          ? t('iqDetection.groupStatus.active')
                          : t('iqDetection.groupStatus.inactive')
                      }}
                    </span>
                    <span class="font-mono tabular-nums text-ink-2">
                      {{
                        t('iqDetection.settings.accountCountBadge', {
                          active: group.active_account_count ?? group.account_count ?? 0,
                          total: group.account_count ?? 0
                        })
                      }}
                    </span>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <!-- Right Column: Benchmark & Model + Schedule + Methodology -->
        <div class="space-y-4">
          <!-- 2. Probe Model & Reasoning Parameters -->
          <div class="divide-y divide-edge overflow-hidden rounded-card border border-edge bg-surface shadow-xs">
            <div class="bg-surface-2 px-4 py-3 sm:px-5">
              <h3 class="text-[13.5px] font-semibold text-ink">
                {{ t('iqDetection.settings.probeSectionTitle') }}
              </h3>
              <p class="mt-0.5 text-xs text-ink-2">
                {{ t('iqDetection.settings.probeSectionHint') }}
              </p>
            </div>

            <!-- Benchmark Types (Multi-Select) -->
            <div class="space-y-2.5 px-4 py-3.5 sm:px-5">
              <div>
                <div class="text-[13px] font-semibold text-ink">
                  {{ t('iqDetection.settings.benchmarkLabel') }}
                </div>
                <p class="mt-0.5 text-xs text-ink-2">
                  {{ t('iqDetection.settings.benchmarkHint') }}
                </p>
              </div>

              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  v-for="bench in IQ_DETECTION_BENCHMARK_OPTIONS"
                  :key="bench"
                  type="button"
                  role="checkbox"
                  :data-testid="`iq-benchmark-opt-${bench}`"
                  :aria-checked="isBenchmarkEnabled(bench)"
                  class="flex flex-col items-start rounded-field border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                  :class="
                    isBenchmarkEnabled(bench)
                      ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-950/30'
                      : 'border-edge bg-surface hover:border-edge-strong hover:bg-surface-2'
                  "
                  @click="toggleBenchmark(bench)"
                >
                  <span class="flex w-full items-center justify-between gap-2 text-[13px] font-semibold text-ink">
                    <span class="inline-flex items-center gap-1.5">
                      <Icon
                        :name="bench === 'pelican_svg' ? 'sparkles' : 'brain'"
                        size="sm"
                        class="shrink-0 text-primary-600 dark:text-primary-400"
                      />
                      <span>{{ t(`iqDetection.benchmark.${bench}`) }}</span>
                    </span>
                    <Icon
                      v-if="isBenchmarkEnabled(bench)"
                      name="checkCircle"
                      size="sm"
                      class="shrink-0 text-primary-600 dark:text-primary-400"
                    />
                    <span
                      v-else
                      class="h-4 w-4 shrink-0 rounded-full border border-edge-strong bg-surface"
                      aria-hidden="true"
                    />
                  </span>
                  <span
                    v-if="bench === 'pelican_svg'"
                    class="mt-1 inline-flex rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-ink-2"
                  >
                    {{ t('iqDetection.benchmark.pelicanFixedBadge') }}
                  </span>
                  <span class="mt-1 text-[11.5px] leading-relaxed text-ink-2">
                    {{
                      bench === 'pelican_svg'
                        ? t('iqDetection.benchmark.pelicanDesc')
                        : t('iqDetection.benchmark.candyDesc')
                    }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Model -->
            <div class="space-y-2 px-4 py-3.5 sm:px-5">
              <label for="iq-probe-model-input" class="block text-[13px] font-semibold text-ink">
                {{ t('iqDetection.settings.modelLabel') }}
              </label>
              <input
                id="iq-probe-model-input"
                v-model.trim="draft.model"
                type="text"
                maxlength="128"
                class="input !py-1.5 font-mono text-xs"
                :placeholder="t('iqDetection.settings.modelPlaceholder')"
              />
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-[11px] text-ink-3">{{ t('iqDetection.settings.modelPresetsLabel') }}</span>
                <button
                  v-for="preset in MODEL_PRESETS"
                  :key="preset"
                  type="button"
                  class="rounded-md px-2 py-0.5 font-mono text-[11.5px] font-medium transition-colors"
                  :class="
                    draft.model === preset
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-3 text-ink-2 hover:text-ink'
                  "
                  @click="draft.model = preset"
                >
                  {{ preset }}
                </button>
              </div>
            </div>

            <!-- Reasoning Effort & Samples Per Group -->
            <div class="space-y-3 px-4 py-3.5 sm:px-5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div class="text-[13px] font-semibold text-ink">
                    {{ t('iqDetection.settings.effortLabel') }}
                  </div>
                  <p class="mt-0.5 text-xs text-ink-2">
                    {{ t('iqDetection.settings.effortHint') }}
                  </p>
                </div>
                <div class="seg flex-wrap" role="group" :aria-label="t('iqDetection.settings.effortLabel')">
                  <button
                    v-for="eff in EFFORT_OPTIONS"
                    :key="eff"
                    type="button"
                    class="font-mono uppercase"
                    :class="{ on: draft.reasoning_effort === eff }"
                    :aria-pressed="draft.reasoning_effort === eff"
                    @click="draft.reasoning_effort = eff"
                  >
                    {{ eff }}
                  </button>
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-2 border-t border-edge pt-3">
                <div>
                  <div class="text-[13px] font-semibold text-ink">
                    {{ t('iqDetection.settings.testsPerGroupLabel') }}
                  </div>
                  <p class="mt-0.5 text-xs text-ink-2">
                    {{ t('iqDetection.settings.testsPerGroupHint') }}
                  </p>
                </div>
                <div
                  v-if="isCandyEnabled"
                  class="seg flex-wrap"
                  role="group"
                  :aria-label="t('iqDetection.settings.testsPerGroupLabel')"
                >
                  <button
                    v-for="n in TESTS_PER_GROUP_OPTIONS"
                    :key="n"
                    type="button"
                    class="font-mono tabular-nums"
                    :class="{ on: draft.tests_per_group === n }"
                    :aria-pressed="draft.tests_per_group === n"
                    @click="draft.tests_per_group = n"
                  >
                    {{ t('iqDetection.settings.testsPerGroupUnit', { n }) }}
                  </button>
                </div>
                <span v-else class="chip font-mono text-xs">
                  {{ t('iqDetection.settings.testsPerGroupPelicanOnlyNote') }}
                </span>
              </div>
            </div>
          </div>

          <!-- 3. Scheduled Background Patrol -->
          <div class="divide-y divide-edge overflow-hidden rounded-card border border-edge bg-surface shadow-xs">
            <div class="flex items-center justify-between gap-4 bg-surface-2 px-4 py-3 sm:px-5">
              <div class="min-w-0">
                <h3 class="text-[13.5px] font-semibold text-ink">
                  {{ t('iqDetection.settings.scheduleSectionTitle') }}
                </h3>
                <p class="mt-0.5 text-xs text-ink-2">
                  {{ t('iqDetection.settings.scheduleSectionHint') }}
                </p>
              </div>
              <Toggle v-model="draft.enabled" :aria-label="t('iqDetection.settings.scheduleEnableLabel')" />
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
              <div>
                <div class="text-[13px] font-semibold text-ink">
                  {{ t('iqDetection.settings.intervalLabel') }}
                </div>
                <p class="mt-0.5 font-mono text-[11px] tabular-nums text-ink-3">
                  {{
                    draft.last_scheduled_at
                      ? t('iqDetection.settings.lastScheduledAt', {
                          time: formatDateTime(draft.last_scheduled_at)
                        })
                      : t('iqDetection.settings.neverScheduled')
                  }}
                </p>
              </div>
              <div class="seg flex-wrap" role="group" :aria-label="t('iqDetection.settings.intervalLabel')">
                <button
                  v-for="mins in IQ_DETECTION_INTERVAL_OPTIONS"
                  :key="mins"
                  type="button"
                  :data-testid="`iq-interval-opt-${mins}`"
                  class="tabular-nums"
                  :class="{ on: draft.interval_minutes === mins }"
                  :aria-pressed="draft.interval_minutes === mins"
                  @click="draft.interval_minutes = mins"
                >
                  {{ formatIntervalOption(mins) }}
                </button>
              </div>
            </div>
          </div>

          <!-- 4. Built-in Benchmark Methodology & Prompt Preview -->
          <div class="overflow-hidden rounded-card border border-edge bg-surface shadow-xs">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-edge bg-surface-2 px-4 py-3 sm:px-5">
              <h3 class="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                <Icon name="infoCircle" size="sm" class="text-primary-600 dark:text-primary-400" />
                {{
                  methodologyBenchmark === 'pelican_svg'
                    ? t('iqDetection.settings.pelicanPromptPreviewTitle')
                    : t('iqDetection.settings.promptPreviewTitle')
                }}
              </h3>
              <div class="flex flex-wrap items-center gap-2">
                <div v-if="enabledBenchmarks.length > 1" class="seg">
                  <button
                    v-for="bench in enabledBenchmarks"
                    :key="`doc-${bench}`"
                    type="button"
                    :class="{ on: methodologyBenchmark === bench }"
                    @click="previewBenchmark = bench"
                  >
                    {{ t(`iqDetection.benchmark.${bench}`) }}
                  </button>
                </div>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm !h-7 !px-2.5 text-xs"
                  @click="showPromptPreview = !showPromptPreview"
                >
                  {{
                    showPromptPreview
                      ? t('iqDetection.settings.promptPreviewToggleHide')
                      : t('iqDetection.settings.promptPreviewToggleShow')
                  }}
                </button>
              </div>
            </div>

            <div class="px-4 py-3.5 sm:px-5">
              <ul
                v-if="methodologyBenchmark === 'pelican_svg'"
                class="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-ink-2"
              >
                <li>{{ t('iqDetection.settings.pelicanMethodologyBullet1') }}</li>
                <li>{{ t('iqDetection.settings.pelicanMethodologyBullet2') }}</li>
                <li>{{ t('iqDetection.settings.pelicanMethodologyBullet3') }}</li>
              </ul>
              <ul v-else class="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-ink-2">
                <li>{{ t('iqDetection.settings.methodologyBullet1') }}</li>
                <li>{{ t('iqDetection.settings.methodologyBullet2') }}</li>
                <li>{{ t('iqDetection.settings.methodologyBullet3') }}</li>
              </ul>

              <pre
                v-if="showPromptPreview && activePromptPreview"
                class="mt-3 overflow-x-auto whitespace-pre-wrap rounded-field border border-edge bg-surface-3 p-3.5 font-mono text-xs leading-relaxed text-ink"
              >{{ activePromptPreview }}</pre>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import Toggle from '@/components/common/Toggle.vue'
import Icon from '@/components/icons/Icon.vue'
import type { AdminGroup } from '@/types'
import {
  fetchAllOpenAIGroups,
  getIQDetectionConfig,
  updateIQDetectionConfig
} from './api'
import type {
  IQDetectionBenchmarkType,
  IQDetectionConfig,
  IQDetectionEffort,
  IQDetectionIntervalMinutes
} from './types'
import {
  formatDateTime,
  IQ_DETECTION_BENCHMARK_OPTIONS,
  IQ_DETECTION_INTERVAL_OPTIONS,
  resolveConfigBenchmarkTypes,
  resolveConfigIntervalMinutes
} from './verdictMeta'

const MODEL_PRESETS = ['gpt-5.4', 'gpt-5.5', 'gpt-5.6-sol', 'gpt-6', 'gpt-6.1-sol'] as const
const EFFORT_OPTIONS: readonly IQDetectionEffort[] = ['low', 'medium', 'high', 'xhigh', 'max']
const TESTS_PER_GROUP_OPTIONS = [1, 2, 3, 4, 5] as const

const props = withDefaults(
  defineProps<{
    initialConfig?: IQDetectionConfig | null
    running?: boolean
  }>(),
  {
    initialConfig: null,
    running: false
  }
)

const emit = defineEmits<{
  (e: 'saved', cfg: IQDetectionConfig): void
  (e: 'saved-and-run', cfg: IQDetectionConfig): void
}>()

const { t } = useI18n()
const appStore = useAppStore()

const loading = ref(false)
const saving = ref(false)
const loadingGroups = ref(false)
const showPromptPreview = ref(false)
const groupSearch = ref('')

const savedSnapshot = ref<string>('')
const draft = ref<IQDetectionConfig | null>(null)
const openaiGroups = ref<AdminGroup[]>([])
const previewBenchmark = ref<IQDetectionBenchmarkType>('candy_logic')

let groupsAbortController: AbortController | null = null

function formatIntervalOption(mins: IQDetectionIntervalMinutes): string {
  if (mins < 60) {
    return t('iqDetection.settings.intervalMinutesOption', { minutes: mins })
  }
  return t('iqDetection.settings.intervalHoursOption', { hours: mins / 60 })
}

function serializeComparable(cfg: IQDetectionConfig): string {
  return JSON.stringify({
    enabled: cfg.enabled,
    interval_minutes: cfg.interval_minutes,
    benchmark_types: resolveConfigBenchmarkTypes(cfg),
    group_ids: [...cfg.group_ids].sort((a, b) => a - b),
    model: cfg.model.trim(),
    reasoning_effort: cfg.reasoning_effort,
    tests_per_group: cfg.tests_per_group
  })
}

function applyServerConfig(cfg: IQDetectionConfig) {
  const benchTypes = resolveConfigBenchmarkTypes(cfg)
  const cloned: IQDetectionConfig = {
    ...cfg,
    interval_minutes: resolveConfigIntervalMinutes(cfg),
    benchmark_types: benchTypes,
    benchmark_type: benchTypes[0],
    group_ids: Array.isArray(cfg.group_ids) ? [...cfg.group_ids] : []
  }
  draft.value = cloned
  previewBenchmark.value = benchTypes[benchTypes.length - 1] ?? 'candy_logic'
  savedSnapshot.value = serializeComparable(cloned)
}

const enabledBenchmarks = computed<IQDetectionBenchmarkType[]>(() =>
  resolveConfigBenchmarkTypes(draft.value)
)

const isCandyEnabled = computed(() => enabledBenchmarks.value.includes('candy_logic'))

function isBenchmarkEnabled(bench: IQDetectionBenchmarkType): boolean {
  return enabledBenchmarks.value.includes(bench)
}

function toggleBenchmark(bench: IQDetectionBenchmarkType): void {
  if (!draft.value) return
  const current = new Set<IQDetectionBenchmarkType>(enabledBenchmarks.value)
  if (current.has(bench)) {
    if (current.size <= 1) {
      previewBenchmark.value = bench
      return
    }
    current.delete(bench)
  } else {
    current.add(bench)
    previewBenchmark.value = bench
  }
  const ordered = IQ_DETECTION_BENCHMARK_OPTIONS.filter((b) => current.has(b))
  draft.value.benchmark_types = ordered
  draft.value.benchmark_type = ordered[0]
  if (!ordered.includes(previewBenchmark.value)) {
    previewBenchmark.value = ordered[0] ?? 'candy_logic'
  }
}

const methodologyBenchmark = computed<IQDetectionBenchmarkType>(() => {
  if (enabledBenchmarks.value.includes(previewBenchmark.value)) {
    return previewBenchmark.value
  }
  return enabledBenchmarks.value[0] ?? 'candy_logic'
})

const activePromptPreview = computed(() => {
  if (!draft.value) return ''
  const map = draft.value.builtin_prompts
  if (map && map[methodologyBenchmark.value]) {
    return map[methodologyBenchmark.value]
  }
  return draft.value.builtin_prompt
})

const dirty = computed(() => {
  if (!draft.value) return false
  return serializeComparable(draft.value) !== savedSnapshot.value
})

const selectedSet = computed(() => new Set<number>(draft.value?.group_ids ?? []))

const filteredGroups = computed(() => {
  const q = groupSearch.value.trim().toLowerCase()
  if (!q) return openaiGroups.value
  return openaiGroups.value.filter(
    (g) => g.name.toLowerCase().includes(q) || String(g.id).includes(q)
  )
})

const staleSelectedIds = computed(() => {
  if (!draft.value || loadingGroups.value) return []
  const known = new Set(openaiGroups.value.map((g) => g.id))
  return draft.value.group_ids.filter((id) => !known.has(id))
})

function toggleGroup(groupId: number) {
  if (!draft.value) return
  const next = new Set(draft.value.group_ids)
  if (next.has(groupId)) {
    next.delete(groupId)
  } else {
    next.add(groupId)
  }
  draft.value.group_ids = Array.from(next)
}

function selectActiveGroups() {
  if (!draft.value) return
  const next = new Set(draft.value.group_ids)
  for (const g of filteredGroups.value) {
    if (g.status === 'active') {
      next.add(g.id)
    }
  }
  draft.value.group_ids = Array.from(next)
}

function clearSelectedGroups() {
  if (!draft.value) return
  draft.value.group_ids = []
}

async function loadConfig() {
  loading.value = true
  try {
    const cfg = await getIQDetectionConfig()
    applyServerConfig(cfg)
  } catch (err) {
    appStore.showError(extractApiErrorMessage(err))
  } finally {
    loading.value = false
  }
}

async function loadGroups() {
  groupsAbortController?.abort()
  groupsAbortController = new AbortController()
  loadingGroups.value = true
  try {
    openaiGroups.value = await fetchAllOpenAIGroups(groupsAbortController.signal)
  } catch (err) {
    if (!axios.isCancel(err)) {
      appStore.showError(extractApiErrorMessage(err))
    }
  } finally {
    loadingGroups.value = false
  }
}

async function persistDraft(): Promise<IQDetectionConfig | null> {
  if (!draft.value || saving.value) return null
  if (!dirty.value) {
    return draft.value
  }
  saving.value = true
  try {
    const updated = await updateIQDetectionConfig(draft.value)
    applyServerConfig(updated)
    appStore.showSuccess(t('iqDetection.settings.savedSuccess'))
    return updated
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 409) {
      appStore.showError(t('iqDetection.settings.conflictError'))
      await loadConfig()
    } else {
      appStore.showError(extractApiErrorMessage(err))
    }
    return null
  } finally {
    saving.value = false
  }
}

async function handleSave() {
  if (!dirty.value) return
  const updated = await persistDraft()
  if (updated) {
    emit('saved', updated)
  }
}

async function handleSaveAndRun() {
  if (!draft.value || draft.value.group_ids.length === 0) return
  const updated = await persistDraft()
  if (updated) {
    emit('saved-and-run', updated)
  }
}

watch(
  () => props.initialConfig,
  (next) => {
    if (next && !dirty.value) {
      applyServerConfig(next)
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (!draft.value) {
    void loadConfig()
  }
  void loadGroups()
})

onUnmounted(() => {
  groupsAbortController?.abort()
})
</script>
