<template>
  <section class="card min-w-0 overflow-hidden !rounded-2xl !border-0 ring-1 ring-gray-900/5 dark:ring-dark-700" :aria-label="t('channelMonitorV2.dashboard.errors.title')" :aria-busy="loading" data-testid="service-error-distribution">
    <header class="flex items-center justify-between gap-3 border-b border-edge px-4 py-3">
      <h2 class="text-sm font-semibold text-ink">{{ t('channelMonitorV2.dashboard.errors.title') }}</h2>
      <span v-if="rangeLabel" class="rounded-full bg-surface-3 px-2 py-1 text-[10px] font-semibold text-ink-2">{{ rangeLabel }}</span>
    </header>
    <div v-if="error" class="space-y-2 p-4 text-xs text-ink-2" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="btn btn-secondary btn-sm" :disabled="loading" @click="emit('retry')">{{ t('common.tryAgain') }}</button>
    </div>
    <div v-else-if="loading && !rows.length" class="space-y-4 p-4" aria-hidden="true"><div v-for="index in 4" :key="index" class="h-8 animate-pulse rounded-lg bg-surface-3" /></div>
    <div v-else-if="rows.length" class="max-h-[360px] overflow-auto p-4"><AvailabilityErrors :rows="rows" :admin="Boolean(admin)" compact /></div>
    <p v-else class="px-4 py-12 text-center text-xs text-ink-3">{{ t('channelMonitorV2.dashboard.errors.empty') }}</p>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MonitorErrorRow } from '@/api/channelMonitorV2'
import AvailabilityErrors from './AvailabilityErrors.vue'

defineProps<{ rows: MonitorErrorRow[]; admin?: boolean; loading?: boolean; error?: string; rangeLabel?: string }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
</script>
