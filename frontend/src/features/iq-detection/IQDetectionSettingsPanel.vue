<template>
  <section class="w-full space-y-5">
    <div
      v-if="loading && !draft"
      class="card flex min-h-[220px] items-center justify-center !rounded-3xl !border-0 text-sm text-gray-400 shadow-sm ring-1 ring-gray-900/5 dark:bg-dark-800 dark:ring-dark-700"
    >
      <span class="animate-pulse">{{ t('common.loading') }}</span>
    </div>

    <template v-else-if="draft">
      <!-- Save Action Bar -->
      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-dark-800 dark:ring-dark-700"
      >
        <div class="min-w-0">
          <h2 class="text-base font-bold text-gray-900 dark:text-white">
            {{ t('iqDetection.settings.title') }}
          </h2>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {{ t('iqDetection.settings.description') }}
          </p>
        </div>
        <button
          type="button"
          class="btn btn-primary"
          data-testid="iq-save-config-btn"
          :disabled="saving || !dirty"
          @click="handleSave"
        >
          <Icon name="check" size="sm" />
          {{ saving ? t('iqDetection.settings.saving') : t('iqDetection.settings.save') }}
        </button>
      </div>

      <!-- 1. Target Groups Multi-Select -->
      <div
        class="card divide-y divide-gray-100 !rounded-3xl !border-0 shadow-sm ring-1 ring-gray-900/5 dark:divide-dark-700 dark:!bg-dark-800 dark:ring-dark-700"
      >
        <div class="px-5 py-4 sm:px-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ t('iqDetection.settings.groupsSectionTitle') }}
              </h3>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {{ t('iqDetection.settings.groupsSectionHint') }}
              </p>
            </div>
            <span
              class="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold tabular-nums text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            >
              {{ t('iqDetection.settings.selectedGroupsCount', { count: draft.group_ids.length }) }}
            </span>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-2.5">
            <div class="relative min-w-[220px] flex-1">
              <input
                v-model="groupSearch"
                type="search"
                class="input w-full text-sm"
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

        <div class="px-5 py-4 sm:px-6">
          <div v-if="loadingGroups" class="py-8 text-center text-xs text-gray-400">
            {{ t('iqDetection.settings.loadingGroups') }}
          </div>
          <div
            v-else-if="filteredGroups.length === 0 && staleSelectedIds.length === 0"
            class="py-8 text-center text-xs text-gray-400"
          >
            {{ t('iqDetection.settings.noMatchingGroups') }}
          </div>
          <div v-else class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <!-- Stale group IDs that no longer exist in catalog -->
            <label
              v-for="staleId in staleSelectedIds"
              :key="`stale-${staleId}`"
              class="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs transition hover:border-amber-300 dark:border-amber-800/50 dark:bg-amber-950/20"
            >
              <input
                type="checkbox"
                class="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
              class="flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition"
              :class="
                selectedSet.has(group.id)
                  ? 'border-blue-500/60 bg-blue-50/40 ring-1 ring-blue-500/20 dark:border-blue-500/50 dark:bg-blue-950/25'
                  : 'border-gray-200/80 bg-white hover:border-gray-300 dark:border-dark-700 dark:bg-dark-800/60 dark:hover:border-dark-600'
              "
            >
              <input
                type="checkbox"
                class="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                :checked="selectedSet.has(group.id)"
                @change="toggleGroup(group.id)"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {{ group.name }}
                  </span>
                  <span class="shrink-0 font-mono text-[11px] text-gray-400">#{{ group.id }}</span>
                </div>
                <div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span
                    class="inline-flex items-center rounded px-1.5 py-0.5 font-medium"
                    :class="
                      group.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400'
                    "
                  >
                    {{
                      group.status === 'active'
                        ? t('iqDetection.groupStatus.active')
                        : t('iqDetection.groupStatus.inactive')
                    }}
                  </span>
                  <span class="font-mono tabular-nums text-gray-500 dark:text-gray-400">
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

      <!-- 2. Probe Model & Reasoning Parameters -->
      <div
        class="card divide-y divide-gray-100 !rounded-3xl !border-0 shadow-sm ring-1 ring-gray-900/5 dark:divide-dark-700 dark:!bg-dark-800 dark:ring-dark-700"
      >
        <div class="px-5 py-4 sm:px-6">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ t('iqDetection.settings.probeSectionTitle') }}
          </h3>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {{ t('iqDetection.settings.probeSectionHint') }}
          </p>
        </div>

        <!-- Model -->
        <div class="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-12 sm:items-start sm:px-6">
          <div class="sm:col-span-5">
            <label for="iq-probe-model-input" class="block text-sm font-medium text-gray-900 dark:text-white">
              {{ t('iqDetection.settings.modelLabel') }}
            </label>
          </div>
          <div class="space-y-2 sm:col-span-7">
            <input
              id="iq-probe-model-input"
              v-model.trim="draft.model"
              type="text"
              maxlength="128"
              class="input w-full font-mono text-sm"
              :placeholder="t('iqDetection.settings.modelPlaceholder')"
            />
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[11px] text-gray-400">{{ t('iqDetection.settings.modelPresetsLabel') }}</span>
              <button
                v-for="preset in MODEL_PRESETS"
                :key="preset"
                type="button"
                class="rounded-lg px-2 py-0.5 font-mono text-xs transition"
                :class="
                  draft.model === preset
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-700 dark:text-gray-300 dark:hover:bg-dark-600'
                "
                @click="draft.model = preset"
              >
                {{ preset }}
              </button>
            </div>
          </div>
        </div>

        <!-- Reasoning Effort -->
        <div class="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-12 sm:items-center sm:px-6">
          <div class="sm:col-span-5">
            <div class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('iqDetection.settings.effortLabel') }}
            </div>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {{ t('iqDetection.settings.effortHint') }}
            </p>
          </div>
          <div class="sm:col-span-7">
            <div class="tabs inline-flex flex-wrap" role="group" :aria-label="t('iqDetection.settings.effortLabel')">
              <button
                v-for="eff in EFFORT_OPTIONS"
                :key="eff"
                type="button"
                class="tab font-mono uppercase"
                :class="draft.reasoning_effort === eff ? 'tab-active' : ''"
                @click="draft.reasoning_effort = eff"
              >
                {{ eff }}
              </button>
            </div>
          </div>
        </div>

        <!-- Tests Per Group -->
        <div class="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-12 sm:items-center sm:px-6">
          <div class="sm:col-span-5">
            <div class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('iqDetection.settings.testsPerGroupLabel') }}
            </div>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {{ t('iqDetection.settings.testsPerGroupHint') }}
            </p>
          </div>
          <div class="sm:col-span-7">
            <div class="tabs inline-flex flex-wrap" role="group" :aria-label="t('iqDetection.settings.testsPerGroupLabel')">
              <button
                v-for="n in TESTS_PER_GROUP_OPTIONS"
                :key="n"
                type="button"
                class="tab font-mono tabular-nums"
                :class="draft.tests_per_group === n ? 'tab-active' : ''"
                @click="draft.tests_per_group = n"
              >
                {{ t('iqDetection.settings.testsPerGroupUnit', { n }) }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Scheduled Background Patrol -->
      <div
        class="card divide-y divide-gray-100 !rounded-3xl !border-0 shadow-sm ring-1 ring-gray-900/5 dark:divide-dark-700 dark:!bg-dark-800 dark:ring-dark-700"
      >
        <div class="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('iqDetection.settings.scheduleSectionTitle') }}
            </h3>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {{ t('iqDetection.settings.scheduleSectionHint') }}
            </p>
          </div>
          <Toggle v-model="draft.enabled" :aria-label="t('iqDetection.settings.scheduleEnableLabel')" />
        </div>

        <div class="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <div class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('iqDetection.settings.intervalLabel') }}
            </div>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {{
                draft.last_scheduled_at
                  ? t('iqDetection.settings.lastScheduledAt', {
                      time: formatDateTime(draft.last_scheduled_at)
                    })
                  : t('iqDetection.settings.neverScheduled')
              }}
            </p>
          </div>
          <div class="tabs inline-flex flex-wrap" role="group" :aria-label="t('iqDetection.settings.intervalLabel')">
            <button
              v-for="mins in IQ_DETECTION_INTERVAL_OPTIONS"
              :key="mins"
              type="button"
              :data-testid="`iq-interval-opt-${mins}`"
              class="tab tabular-nums"
              :class="draft.interval_minutes === mins ? 'tab-active' : ''"
              @click="draft.interval_minutes = mins"
            >
              {{ formatIntervalOption(mins) }}
            </button>
          </div>
        </div>
      </div>

      <!-- 4. Built-in Candy Benchmark Methodology & Prompt Preview -->
      <div
        class="card !rounded-3xl !border-0 px-5 py-4 shadow-sm ring-1 ring-gray-900/5 dark:!bg-dark-800 dark:ring-dark-700 sm:px-6"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <Icon name="infoCircle" size="sm" class="text-blue-500" />
            {{ t('iqDetection.settings.promptPreviewTitle') }}
          </h3>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            @click="showPromptPreview = !showPromptPreview"
          >
            {{
              showPromptPreview
                ? t('iqDetection.settings.promptPreviewToggleHide')
                : t('iqDetection.settings.promptPreviewToggleShow')
            }}
          </button>
        </div>

        <ul class="mt-3 list-disc space-y-1.5 pl-5 text-xs text-gray-600 dark:text-gray-300">
          <li>{{ t('iqDetection.settings.methodologyBullet1') }}</li>
          <li>{{ t('iqDetection.settings.methodologyBullet2') }}</li>
          <li>{{ t('iqDetection.settings.methodologyBullet3') }}</li>
        </ul>

        <pre
          v-if="showPromptPreview && draft.builtin_prompt"
          class="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-800 ring-1 ring-gray-200/80 dark:bg-dark-900/70 dark:text-gray-200 dark:ring-dark-700"
        >{{ draft.builtin_prompt }}</pre>
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
  IQDetectionConfig,
  IQDetectionEffort,
  IQDetectionIntervalMinutes
} from './types'
import {
  formatDateTime,
  IQ_DETECTION_INTERVAL_OPTIONS,
  resolveConfigIntervalMinutes
} from './verdictMeta'

const MODEL_PRESETS = ['gpt-5.4', 'gpt-5.5', 'gpt-5.6-sol', 'gpt-6', 'gpt-6.1-sol'] as const
const EFFORT_OPTIONS: readonly IQDetectionEffort[] = ['low', 'medium', 'high', 'xhigh', 'max']
const TESTS_PER_GROUP_OPTIONS = [1, 2, 3, 4, 5] as const

const props = defineProps<{
  initialConfig?: IQDetectionConfig | null
}>()

const emit = defineEmits<{
  (e: 'saved', cfg: IQDetectionConfig): void
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
    group_ids: [...cfg.group_ids].sort((a, b) => a - b),
    model: cfg.model.trim(),
    reasoning_effort: cfg.reasoning_effort,
    tests_per_group: cfg.tests_per_group
  })
}

function applyServerConfig(cfg: IQDetectionConfig) {
  const cloned: IQDetectionConfig = {
    ...cfg,
    interval_minutes: resolveConfigIntervalMinutes(cfg),
    group_ids: Array.isArray(cfg.group_ids) ? [...cfg.group_ids] : []
  }
  draft.value = cloned
  savedSnapshot.value = serializeComparable(cloned)
}

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

async function handleSave() {
  if (!draft.value || saving.value) return
  saving.value = true
  try {
    const updated = await updateIQDetectionConfig(draft.value)
    applyServerConfig(updated)
    appStore.showSuccess(t('iqDetection.settings.savedSuccess'))
    emit('saved', updated)
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 409) {
      appStore.showError(t('iqDetection.settings.conflictError'))
      await loadConfig()
    } else {
      appStore.showError(extractApiErrorMessage(err))
    }
  } finally {
    saving.value = false
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
