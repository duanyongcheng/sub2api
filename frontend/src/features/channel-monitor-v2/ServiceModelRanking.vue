<template>
  <section class="card min-w-0 overflow-hidden !rounded-2xl !border-0 ring-1 ring-gray-900/5 dark:ring-dark-700" :aria-label="t('channelMonitorV2.dashboard.ranking.title')" :aria-busy="loading" data-testid="service-model-ranking">
    <header class="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-4 py-3">
      <h2 class="text-sm font-semibold text-ink">{{ t('channelMonitorV2.dashboard.ranking.title') }}</h2>
      <span class="text-[11px] text-ink-3">{{ t(admin ? 'channelMonitorV2.dashboard.ranking.byErrors' : 'channelMonitorV2.dashboard.ranking.byRate') }}</span>
    </header>
    <div v-if="error" class="space-y-2 p-4 text-xs text-ink-2" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="btn btn-secondary btn-sm" :disabled="loading" @click="emit('retry')">{{ t('common.tryAgain') }}</button>
    </div>
    <div v-else-if="loading && !rows.length" class="space-y-3 p-4" aria-hidden="true"><div v-for="index in 4" :key="index" class="h-10 animate-pulse rounded-lg bg-surface-3" /></div>
    <ol v-else-if="ranked.length" class="divide-y divide-edge px-3 py-1">
      <li v-for="(row, index) in ranked" :key="`${row.platform}:${row.model}`">
        <button type="button" class="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-1 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 disabled:cursor-wait" :disabled="loading" :aria-label="t('channelMonitorV2.dashboard.ranking.filterModel', { model: row.model })" :data-model="row.model" @click="emit('select', row)">
          <span class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-3" :style="{ color: platformAccentColor(row.platform) }" :title="platformLabel(row.platform)"><ProviderIcon :provider="row.platform" :size="16" /></span>
          <span class="min-w-0 flex-1">
            <span class="flex min-w-0 items-center gap-1.5"><span class="text-[10px] tabular-nums text-ink-3">{{ index + 1 }}</span><strong class="truncate text-xs font-semibold text-ink" :title="modelLabel(row.model)">{{ modelLabel(row.model) }}</strong></span>
            <span class="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] tabular-nums text-ink-3"><span class="whitespace-nowrap">{{ t('channelMonitorV2.dashboard.ranking.availability', { value: formatAvailability(row.metrics, row.health) }) }}</span><span class="whitespace-nowrap">{{ formatMonitorMs(row.metrics.ttft.avg_ms) }}</span></span>
            <span v-if="admin" class="mt-0.5 block text-[10px] tabular-nums text-ink-2">{{ t('channelMonitorV2.dashboard.ranking.errors', { count: row.metrics.error_requests }) }}</span>
          </span>
          <AvailabilityStatus :state="availabilityState(row.health)" />
        </button>
      </li>
    </ol>
    <p v-else class="px-4 py-10 text-center text-xs leading-relaxed text-ink-3">{{ t('channelMonitorV2.dashboard.ranking.empty') }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MonitorModelRow } from '@/api/channelMonitorV2'
import ProviderIcon from '@/components/user/monitor/ProviderIcon.vue'
import { platformAccentColor, platformLabel } from '@/utils/platformColors'
import AvailabilityStatus from './AvailabilityStatus.vue'
import { availabilityState, formatAvailability } from './monitorAvailability'
import { formatMonitorMs } from './monitorFormat'
import { serviceRankedModels } from './serviceDashboard'

const props = defineProps<{ rows: MonitorModelRow[]; admin?: boolean; loading?: boolean; error?: string }>()
const emit = defineEmits<{ select: [row: MonitorModelRow]; retry: [] }>()
const { t } = useI18n()
const ranked = computed(() => serviceRankedModels(props.rows, Boolean(props.admin)))
const modelLabel = (value: string) => value === '__other__' ? t('channelMonitorV2.otherModels') : value
</script>
