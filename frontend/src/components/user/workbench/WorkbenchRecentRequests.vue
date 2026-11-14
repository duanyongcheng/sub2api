<template>
  <section class="card">
    <div class="card-hd">
      <h3 class="text-sm font-semibold text-ink">{{ t('dashboard.workbench.recentRequests') }}</h3>
      <router-link to="/usage" class="text-meta font-semibold text-primary-600 hover:text-primary-700">
        {{ t('dashboard.workbench.viewAllRequests') }}
      </router-link>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <LoadingSpinner size="md" />
    </div>

    <EmptyState
      v-else-if="logs.length === 0"
      :title="t('dashboard.noUsageRecords')"
      :description="t('dashboard.startUsingApi')"
    />

    <div v-else class="overflow-x-auto">
      <table class="w-full text-data">
        <thead>
          <tr class="border-b border-edge text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3">
            <th class="px-[18px] py-2.5 text-left font-semibold">{{ t('dashboard.workbench.keyModel') }}</th>
            <th class="px-3 py-2.5 text-left font-semibold">{{ t('dashboard.workbench.type') }}</th>
            <th class="px-3 py-2.5 text-right font-semibold">{{ t('dashboard.tokens') }}</th>
            <th class="px-3 py-2.5 text-right font-semibold">{{ t('dashboard.actual') }}</th>
            <th class="px-3 py-2.5 text-right font-semibold">{{ t('dashboard.averageTime') }}</th>
            <th class="px-3 py-2.5 text-right font-semibold">{{ t('dashboard.workbench.time') }}</th>
            <th class="px-[18px] py-2.5 text-right font-semibold">{{ t('dashboard.workbench.statusCol') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id" class="border-b border-edge last:border-b-0 hover:bg-surface-2">
            <td class="px-[18px] py-2.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="max-w-[180px] truncate font-semibold text-ink">{{ keyName(log) }}</span>
                <span class="mono-tag">{{ log.model }}</span>
              </div>
              <div class="mt-0.5 font-mono text-[11px] text-ink-3">{{ maskedKey(log) }}</div>
            </td>
            <td class="px-3 py-2.5">
              <StatusPill :tone="log.stream ? 'violet' : 'info'" :dot="false">
                {{ log.stream ? t('dashboard.workbench.stream') : t('dashboard.workbench.sync') }}
              </StatusPill>
            </td>
            <td class="px-3 py-2.5 text-right tabular-nums text-ink-2">{{ formatTokens(log) }}</td>
            <td class="px-3 py-2.5 text-right font-semibold tabular-nums text-ink">{{ formatCost(log) }}</td>
            <td class="px-3 py-2.5 text-right tabular-nums text-ink-2">{{ formatDuration(log) }}</td>
            <td class="px-3 py-2.5 text-right tabular-nums text-meta text-ink-3">{{ formatTime(log.created_at) }}</td>
            <td class="px-[18px] py-2.5 text-right">
              <StatusPill :tone="statusTone">{{ statusLabel }}</StatusPill>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import type { UsageLog } from '@/types'

/**
 * WorkbenchRecentRequests — the last few rows of the usage log, restyled as a
 * dense table so token / cost / latency / status line up in columns.
 */
defineProps<{
  logs: UsageLog[]
  loading: boolean
}>()

const { t } = useI18n()

function keyName(log: UsageLog): string {
  return log.api_key?.name || `#${log.api_key_id}`
}

function maskedKey(log: UsageLog): string {
  const raw = log.api_key?.key || ''
  if (raw.length <= 12) return raw ? `${raw.slice(0, 4)}…` : ''
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

// Usage rows are only written for completed requests, so every rendered row is
// a success. Failed attempts surface in the usage page's error tab instead.
const statusTone = 'ok' as const

const statusLabel = computed(() => t('dashboard.workbench.statusSuccess'))
</script>
