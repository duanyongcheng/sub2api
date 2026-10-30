<template>
  <div>
    <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">{{ t('channelMonitorV2.availability.errorsDescription') }}</p>
    <div class="grid gap-5 md:grid-cols-2">
      <section v-for="ignored in [false, true]" :key="String(ignored)" class="min-w-0 space-y-3">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ t(ignored ? 'channelMonitorV2.availability.ignoredErrors' : 'channelMonitorV2.availability.countedErrors') }}</h3>
        <div v-for="row in rows.filter(item => Boolean(item.ignored) === ignored)" :key="row.category" class="rounded-xl bg-gray-50 p-3 dark:bg-dark-900/40">
          <button type="button" class="w-full text-left" :aria-expanded="expanded.has(row.category)" @click="toggle(row.category)">
            <span class="flex items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-300">
              <span class="font-medium" :class="ignored ? 'text-gray-500 dark:text-gray-400' : ''">{{ categoryLabel(row.category) }}</span>
              <span class="inline-flex items-center gap-1 tabular-nums">{{ formatMonitorPercent(row.rate) }}<Icon name="chevronDown" size="sm" class="text-gray-400 transition-transform" :class="expanded.has(row.category) ? 'rotate-180' : ''" /></span>
            </span>
            <span class="mt-2 block h-1.5 overflow-hidden rounded-full bg-gray-200/70 dark:bg-dark-700">
              <span class="block h-full rounded-full" :class="ignored ? 'ignored-bar bg-gray-400 dark:bg-dark-400' : 'bg-rose-400'" :style="{ width: barWidth(row.rate) }" />
            </span>
          </button>
          <div v-if="expanded.has(row.category)" class="mt-3 space-y-2 text-xs text-gray-500 dark:text-gray-400">
            <template v-if="admin && row.details?.length">
              <div v-for="(detail, index) in row.details" :key="index" class="rounded-lg border border-gray-200 p-2 dark:border-dark-700">
                <p class="mb-1 flex flex-wrap gap-2">
                  <span>{{ detail.platform ? platformLabel(detail.platform) : '-' }}</span><span>{{ detail.model || '-' }}</span>
                  <span v-if="detail.status_code">{{ t('channelMonitorV2.errorDetail.http', { code: detail.status_code }) }}</span>
                  <span v-if="detail.upstream_status_code">{{ t('channelMonitorV2.errorDetail.upstream', { code: detail.upstream_status_code }) }}</span>
                  <span class="ml-auto">×{{ detail.count }}</span>
                </p>
                <p class="break-words">{{ detail.message || detail.error_type || t('channelMonitorV2.errorDetail.noMessage') }}</p>
              </div>
            </template>
            <p v-else>{{ t('channelMonitorV2.errorDetail.empty') }}</p>
          </div>
        </div>
        <p v-if="!rows.some(row => Boolean(row.ignored) === ignored)" class="text-xs text-gray-400">{{ t('channelMonitorV2.empty.title') }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MonitorErrorRow } from '@/api/channelMonitorV2'
import Icon from '@/components/icons/Icon.vue'
import { platformLabel } from '@/utils/platformColors'
import { formatMonitorPercent } from './monitorFormat'

const props = defineProps<{ rows: MonitorErrorRow[]; admin: boolean }>()
const { t, te } = useI18n()
/** Bars compare categories with each other; the label keeps the absolute share. */
const maxRate = computed(() => Math.max(0, ...props.rows.map(row => row.rate)))
function barWidth(rate: number) {
  return maxRate.value > 0 ? `${Math.max(2, Math.min(100, (rate / maxRate.value) * 100))}%` : '0%'
}
function categoryLabel(category: string) {
  const key = `channelMonitorV2.errorCategories.${category}`
  return te(key) ? t(key) : category
}
const expanded = ref(new Set<string>())
function toggle(category: string) {
  const next = new Set(expanded.value)
  if (next.has(category)) next.delete(category)
  else next.add(category)
  expanded.value = next
}
</script>

<style scoped>
.ignored-bar {
  background-image: repeating-linear-gradient(135deg, transparent 0 3px, rgb(255 255 255 / 35%) 3px 6px);
}
</style>
