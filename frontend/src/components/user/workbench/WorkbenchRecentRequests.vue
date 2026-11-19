<template>
  <section class="overflow-hidden rounded-card border border-edge bg-surface shadow-xs">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-4 py-2.5">
      <div class="seg" role="tablist" :aria-label="t('dashboard.workbench.recentRequests')">
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'recent'"
          :class="{ on: activeTab === 'recent' }"
          @click="emit('update:activeTab', 'recent')"
        >
          {{ t('dashboard.workbench.recentTabRequests') }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'errors'"
          :class="{ on: activeTab === 'errors' }"
          @click="emit('update:activeTab', 'errors')"
        >
          <span>{{ t('dashboard.workbench.recentTabErrors') }}</span>
          <span
            v-if="errorsTotal > 0"
            class="ml-1 inline-flex items-center rounded-full bg-red-500/15 px-1.5 py-px text-[10.5px] font-bold tabular-nums text-red-700 dark:text-red-300"
          >
            {{ errorsTotal }}
          </span>
        </button>
      </div>

      <router-link
        :to="activeTab === 'errors' ? { path: '/usage', query: { tab: 'errors' } } : '/usage'"
        class="inline-flex items-center gap-1 text-[12px] font-semibold text-primary-700 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
      >
        <span>
          {{
            activeTab === 'errors'
              ? t('dashboard.workbench.viewAllErrors')
              : t('dashboard.workbench.viewAllRequests')
          }}
        </span>
        <Icon name="arrowRight" size="xs" :stroke-width="2" />
      </router-link>
    </div>

    <!-- Tab 1: Recent completed requests -->
    <template v-if="activeTab === 'recent'">
      <div v-if="loading" class="flex items-center justify-center py-10">
        <LoadingSpinner size="md" />
      </div>

      <EmptyState
        v-else-if="logs.length === 0"
        :title="t('dashboard.noUsageRecords')"
        :description="t('dashboard.startUsingApi')"
      />

      <template v-else>
        <!-- Mobile stacked rows (keeps status, cost, duration, timestamp visible at 390px) -->
        <div class="divide-y divide-edge/70 md:hidden">
          <div v-for="log in logs" :key="log.id" class="px-3.5 py-2.5">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="truncate text-[12.5px] font-semibold text-ink">{{ keyName(log) }}</span>
                  <span class="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-2">
                    {{ log.model }}
                  </span>
                </div>
                <div v-if="maskedKey(log)" class="mt-0.5 font-mono text-[10.5px] text-ink-2">
                  {{ maskedKey(log) }}
                </div>
              </div>
              <span
                class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {{ t('dashboard.workbench.statusSuccess') }}
              </span>
            </div>
            <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] tabular-nums text-ink-2">
              <div class="flex flex-wrap items-center gap-1.5">
                <span
                  class="inline-flex items-center rounded-full px-1.5 py-px text-[10.5px] font-semibold"
                  :class="
                    log.stream
                      ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                      : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                  "
                >
                  {{ log.stream ? t('dashboard.workbench.stream') : t('dashboard.workbench.sync') }}
                </span>
                <span>{{ formatTokens(log) }}</span>
                <span aria-hidden="true" class="text-edge-strong">·</span>
                <span>{{ formatDuration(log) }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span v-if="!isSimple" class="font-semibold text-ink">{{ formatCost(log) }}</span>
                <span>{{ formatTime(log.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Desktop / tablet full table -->
        <div class="hidden overflow-x-auto md:block">
          <table class="w-full min-w-[640px] text-data">
            <thead>
              <tr class="border-b border-edge bg-surface-2 text-[11px] font-semibold text-ink-2">
                <th class="px-4 py-2 text-left font-semibold">{{ t('dashboard.workbench.keyModel') }}</th>
                <th class="px-3 py-2 text-left font-semibold">{{ t('dashboard.workbench.type') }}</th>
                <th class="px-3 py-2 text-right font-semibold">{{ t('dashboard.tokens') }}</th>
                <th v-if="!isSimple" class="px-3 py-2 text-right font-semibold">{{ t('dashboard.actual') }}</th>
                <th class="px-3 py-2 text-right font-semibold">{{ t('dashboard.duration') }}</th>
                <th class="px-3 py-2 text-right font-semibold">{{ t('dashboard.workbench.time') }}</th>
                <th class="px-4 py-2 text-right font-semibold">{{ t('dashboard.workbench.statusCol') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="log in logs"
                :key="log.id"
                class="border-b border-edge/70 transition-colors last:border-b-0 hover:bg-surface-2"
              >
                <td class="px-4 py-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="max-w-[180px] truncate font-semibold text-ink">{{ keyName(log) }}</span>
                    <span class="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
                      {{ log.model }}
                    </span>
                  </div>
                  <div v-if="maskedKey(log)" class="mt-0.5 font-mono text-[11px] text-ink-2">
                    {{ maskedKey(log) }}
                  </div>
                </td>
                <td class="px-3 py-2">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    :class="
                      log.stream
                        ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                        : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                    "
                  >
                    {{ log.stream ? t('dashboard.workbench.stream') : t('dashboard.workbench.sync') }}
                  </span>
                </td>
                <td class="px-3 py-2 text-right tabular-nums text-ink-2">{{ formatTokens(log) }}</td>
                <td v-if="!isSimple" class="px-3 py-2 text-right font-semibold tabular-nums text-ink">
                  {{ formatCost(log) }}
                </td>
                <td class="px-3 py-2 text-right tabular-nums text-ink-2">{{ formatDuration(log) }}</td>
                <td class="px-3 py-2 text-right tabular-nums text-ink-2">{{ formatTime(log.created_at) }}</td>
                <td class="px-4 py-2 text-right">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
                  >
                    <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                    {{ t('dashboard.workbench.statusSuccess') }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>

    <!-- Tab 2: Recent error requests -->
    <template v-else>
      <div v-if="loadingErrors" class="flex items-center justify-center py-10">
        <LoadingSpinner size="md" />
      </div>

      <EmptyState
        v-else-if="errorLogs.length === 0"
        :title="t('dashboard.workbench.recentErrorsEmptyTitle')"
        :description="t('dashboard.workbench.recentErrorsEmptyDesc')"
      />

      <template v-else>
        <!-- Mobile stacked error rows -->
        <div class="divide-y divide-edge/70 md:hidden">
          <div v-for="err in errorLogs" :key="err.id" class="px-3.5 py-2.5">
            <div class="flex items-start justify-between gap-2">
              <div class="flex min-w-0 flex-wrap items-center gap-1.5">
                <span class="truncate text-[12.5px] font-semibold text-ink">
                  {{ err.key_name || t('usage.errors.keyDeleted') }}
                </span>
                <span v-if="err.model" class="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-2">
                  {{ err.model }}
                </span>
              </div>
              <div class="flex shrink-0 items-center gap-1.5">
                <span class="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 dark:text-amber-300">
                  {{ categoryLabel(err.category) }}
                </span>
                <span class="inline-flex items-center rounded-full bg-red-500/15 px-2 py-0.5 font-mono text-[10.5px] font-bold tabular-nums text-red-700 dark:text-red-300">
                  {{ err.status_code }}
                </span>
              </div>
            </div>
            <p class="mt-1.5 line-clamp-2 text-[11.5px] text-ink-2">
              {{ err.message || '—' }}
            </p>
            <div class="mt-1 text-right text-[11px] tabular-nums text-ink-2">
              {{ formatTime(err.created_at) }}
            </div>
          </div>
        </div>

        <!-- Desktop / tablet full table -->
        <div class="hidden overflow-x-auto md:block">
          <table class="w-full min-w-[640px] text-data">
            <thead>
              <tr class="border-b border-edge bg-surface-2 text-[11px] font-semibold text-ink-2">
                <th class="px-4 py-2 text-left font-semibold">{{ t('dashboard.workbench.keyModel') }}</th>
                <th class="px-3 py-2 text-left font-semibold">{{ t('dashboard.workbench.errorCategoryCol') }}</th>
                <th class="px-3 py-2 text-right font-semibold">{{ t('dashboard.workbench.errorStatusCol') }}</th>
                <th class="px-3 py-2 text-left font-semibold">{{ t('dashboard.workbench.errorMessageCol') }}</th>
                <th class="px-4 py-2 text-right font-semibold">{{ t('dashboard.workbench.time') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="err in errorLogs"
                :key="err.id"
                class="border-b border-edge/70 transition-colors last:border-b-0 hover:bg-surface-2"
              >
                <td class="px-4 py-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="max-w-[160px] truncate font-semibold text-ink">
                      {{ err.key_name || t('usage.errors.keyDeleted') }}
                    </span>
                    <span v-if="err.model" class="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
                      {{ err.model }}
                    </span>
                  </div>
                </td>
                <td class="px-3 py-2">
                  <span class="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                    {{ categoryLabel(err.category) }}
                  </span>
                </td>
                <td class="px-3 py-2 text-right">
                  <span class="inline-flex items-center rounded-full bg-red-500/15 px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-red-700 dark:text-red-300">
                    {{ err.status_code }}
                  </span>
                </td>
                <td class="max-w-[280px] px-3 py-2">
                  <span class="block truncate text-[12px] text-ink-2" :title="err.message">
                    {{ err.message || '—' }}
                  </span>
                </td>
                <td class="px-4 py-2 text-right tabular-nums text-ink-2">
                  {{ formatTime(err.created_at) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Icon from '@/components/icons/Icon.vue'
import type { UsageLog, UserErrorRequest } from '@/types'

withDefaults(
  defineProps<{
    logs: UsageLog[]
    loading: boolean
    errorLogs?: UserErrorRequest[]
    errorsTotal?: number
    loadingErrors?: boolean
    activeTab?: 'recent' | 'errors'
    isSimple?: boolean
  }>(),
  {
    errorLogs: () => [],
    errorsTotal: 0,
    loadingErrors: false,
    activeTab: 'recent',
    isSimple: false
  }
)

const emit = defineEmits<{
  (e: 'update:activeTab', tab: 'recent' | 'errors'): void
}>()

const { t, te } = useI18n()

function keyName(log: UsageLog): string {
  return log.api_key?.name || `#${log.api_key_id}`
}

function maskedKey(log: UsageLog): string {
  const raw = log.api_key?.key || ''
  if (!raw) return ''
  if (raw.length <= 12) return `${raw.slice(0, 4)}…`
  return `${raw.slice(0, 8)}…${raw.slice(-4)}`
}

function totalTokens(log: UsageLog): number {
  return (
    (log.input_tokens || 0) +
    (log.output_tokens || 0) +
    (log.cache_creation_tokens || 0) +
    (log.cache_read_tokens || 0)
  )
}

function formatTokens(log: UsageLog): string {
  const n = totalTokens(log)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatCost(log: UsageLog): string {
  const n = Number(log.actual_cost || 0)
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(3)}`
  return `$${n.toFixed(4)}`
}

function formatDuration(log: UsageLog): string {
  const ms = log.duration_ms
  if (!ms || !Number.isFinite(ms)) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function categoryLabel(category: string): string {
  const key = `usage.errors.categories.${category}`
  return te(key) ? t(key) : category || '—'
}
</script>
