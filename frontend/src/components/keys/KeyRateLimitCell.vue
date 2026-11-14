<template>
  <div v-if="windows.length" class="min-w-[168px]">
    <div class="flex gap-3">
      <div
        v-for="window in windows"
        :key="window.label"
        class="min-w-0 flex-1"
        :title="`${window.label}: $${window.used.toFixed(2)} / $${window.limit.toFixed(2)}${window.reset ? ` · ${formatReset(window.reset)}` : ''}`"
      >
        <div class="mb-1 flex items-center justify-between gap-1 text-[10px] font-semibold tabular-nums text-ink-3">
          <span>{{ window.label }}</span>
          <span :class="window.ratio >= 1 ? 'text-red-600' : window.ratio >= 0.8 ? 'text-amber-600' : 'text-ink-2'">
            {{ Math.round(window.ratio * 100) }}%
          </span>
        </div>
        <div class="h-1 overflow-hidden rounded-full bg-surface-3">
          <div
            class="h-full rounded-full"
            :class="window.ratio >= 1 ? 'bg-red-500' : window.ratio >= 0.8 ? 'bg-amber-500' : 'bg-primary-500'"
            :style="{ width: `${Math.min(window.ratio * 100, 100)}%` }"
          />
        </div>
      </div>
    </div>
    <button
      v-if="windows.some(window => window.used > 0)"
      type="button"
      class="mt-1.5 inline-flex items-center gap-1 text-[11px] text-ink-3 hover:text-primary-700"
      :title="t('keys.resetRateLimitUsage')"
      @click.stop="$emit('reset')"
    >
      <Icon name="refresh" size="xs" />
      {{ t('keys.resetUsage') }}
    </button>
  </div>
  <span v-else class="text-xs text-ink-3">—</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { ApiKey } from '@/types'

const props = defineProps<{ apiKey: ApiKey; formatReset: (value: string | null) => string }>()
defineEmits<{ reset: [] }>()
const { t } = useI18n()
const windows = computed(() => [
  { label: '5H', used: props.apiKey.usage_5h ?? 0, limit: props.apiKey.rate_limit_5h, reset: props.apiKey.reset_5h_at },
  { label: '1D', used: props.apiKey.usage_1d ?? 0, limit: props.apiKey.rate_limit_1d, reset: props.apiKey.reset_1d_at },
  { label: '7D', used: props.apiKey.usage_7d ?? 0, limit: props.apiKey.rate_limit_7d, reset: props.apiKey.reset_7d_at }
].filter(window => window.limit > 0).map(window => ({ ...window, ratio: Math.max(0, window.used / window.limit) })))
</script>
