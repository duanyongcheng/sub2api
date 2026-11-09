<template>
  <section class="card overflow-hidden" :aria-label="t('channelMonitorV2.operations.probeTitle')">
    <header class="flex flex-wrap items-center gap-3 border-b border-edge px-4 py-3">
      <h3 class="text-sm font-semibold text-ink">{{ t('channelMonitorV2.operations.probeTitle') }}</h3>
      <StatusPill tone="info" :dot="false" :label="t('channelMonitorV2.operations.latestProbe')" />
      <span class="ml-auto text-xs tabular-nums text-ink-3">{{ t('channelMonitorV2.operations.probeCount', { count: total }) }}</span>
    </header>
    <p class="px-4 pt-3 text-xs leading-relaxed text-ink-3">{{ t('channelMonitorV2.operations.probeHint') }} {{ t('channelMonitorV2.operations.probeGroupLimit') }}</p>
    <div v-if="error" class="strip strip-bad m-3" role="alert">{{ error }}</div>
    <div v-else-if="loading" class="p-8 text-center text-xs text-ink-3" role="status">{{ t('common.loading') }}</div>
    <div v-else-if="!items.length" class="p-8 text-center text-xs text-ink-3">{{ t('channelMonitorV2.operations.noProbes') }}</div>
    <div v-else class="max-h-[min(50vh,440px)] overflow-auto">
      <table class="table min-w-[660px]">
        <thead><tr><th>{{ t('channelMonitorV2.operations.probeName') }}</th><th>{{ t('channelMonitorV2.operations.probeModel') }}</th><th>{{ t('channelMonitorV2.operations.probeMode') }}</th><th>{{ t('channelMonitorV2.operations.probeStatus') }}</th><th>{{ t('channelMonitorV2.operations.probeCheckedAt') }}</th></tr></thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td><div class="flex items-center gap-2"><span class="h-2 w-2 shrink-0 rounded-sm" :style="{ backgroundColor: platformAccentColor(item.provider) }" /><div class="min-w-0"><strong class="block max-w-44 truncate text-xs text-ink" :title="item.name">{{ item.name }}</strong><span class="text-[11px] text-ink-3">{{ platformLabel(item.provider) }}</span></div></div></td>
            <td class="max-w-40 truncate text-xs" :title="item.primary_model">{{ item.primary_model }}</td>
            <td class="text-xs">{{ t(`channelMonitorV2.operations.probeModes.${item.check_mode}`) }}</td>
            <td><StatusPill :tone="statusTone(item)" :label="statusLabel(item)" /></td>
            <td class="whitespace-nowrap text-xs text-ink-2" :title="item.last_checked_at || ''">{{ item.last_checked_at ? formatTime(item.last_checked_at) : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!loading && total > items.length" class="px-4 pt-2 text-xs text-ink-3">{{ t('channelMonitorV2.operations.probeLimit', { shown: items.length, total }) }}</p>
    <footer class="border-t border-edge px-4 py-3"><button type="button" class="text-xs font-semibold text-primary-700 hover:underline" @click="emit('manage')">{{ t('channelMonitorV2.operations.manageProbes') }} →</button></footer>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ChannelMonitor } from '@/api/admin/channelMonitor'
import StatusPill, { type StatusTone } from '@/components/common/StatusPill.vue'
import { platformAccentColor, platformLabel } from '@/utils/platformColors'

defineProps<{ items: ChannelMonitor[]; total: number; loading?: boolean; error?: string }>()
const emit = defineEmits<{ manage: [] }>()
const { t, locale } = useI18n()
function statusTone(item: ChannelMonitor): StatusTone {
  if (!item.last_checked_at || !item.primary_status) return 'neutral'
  if (item.primary_status === 'operational') return 'ok'
  return item.primary_status === 'degraded' ? 'warn' : 'bad'
}
function statusLabel(item: ChannelMonitor) {
  if (!item.last_checked_at || !item.primary_status) return t('channelMonitorV2.operations.probeNoResult')
  return t(`channelMonitorV2.operations.probeStates.${item.primary_status}`)
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat(locale.value || undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
</script>
