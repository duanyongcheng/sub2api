<template>
  <div class="space-y-3">
    <div class="card flex flex-wrap items-start gap-x-8 gap-y-3 px-4 py-3" :aria-busy="loading">
      <div><div class="text-[11px] text-ink-3">{{ t('admin.accounts.pool.matchingAccounts') }}</div><div class="mt-1 text-xl font-semibold tabular-nums text-ink">{{ total }}</div></div>
      <div v-for="metric in metrics" :key="metric.key"><div class="text-[11px] text-ink-3">{{ t(`admin.accounts.pool.${metric.key}`) }}</div><div class="mt-1 text-xl font-semibold tabular-nums" :class="metric.tone">{{ metric.value }}</div></div>
      <div class="ml-auto max-w-[240px] text-[11px] leading-5 text-ink-3">{{ t('admin.accounts.pool.pageBasis', { count: accounts.length }) }}</div>
    </div>
    <nav class="flex flex-wrap gap-1.5" :aria-label="t('admin.accounts.allPlatforms')">
      <button v-for="option in platformOptions" :key="option.value" type="button" class="flex items-center gap-2 rounded-field border px-3 py-2 text-xs font-semibold transition-colors" :class="platform === option.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-edge bg-surface text-ink-2 hover:bg-surface-2'" :aria-pressed="platform === option.value" :data-account-platform="option.value || 'all'" @click="$emit('platformChange', option.value)">
        <PlatformIcon v-if="option.value" :platform="option.value" size="sm" />{{ option.label }}
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CONCRETE_PLATFORM_OPTIONS } from '@/constants/platforms'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import type { AccountListItem } from '@/types'
import { accountPoolState } from './accountPoolState'

const props = defineProps<{ accounts: AccountListItem[]; total: number; platform: string; now: number; loading: boolean }>()
defineEmits<{ platformChange: [value: string] }>()
const { t } = useI18n()
const platformOptions = computed(() => [{ value: '', label: t('admin.accounts.allPlatforms') }, ...CONCRETE_PLATFORM_OPTIONS])
const metrics = computed(() => {
  const counts = { available: 0, degraded: 0, error: 0, paused: 0 }
  for (const account of props.accounts) counts[accountPoolState(account, props.now)]++
  const knownConcurrency = props.accounts.every(account => typeof account.current_concurrency === 'number')
  return [
    { key: 'available', value: counts.available, tone: 'text-emerald-600' },
    { key: 'degraded', value: counts.degraded, tone: 'text-amber-600' },
    { key: 'error', value: counts.error, tone: 'text-red-600' },
    { key: 'paused', value: counts.paused, tone: 'text-ink-2' },
    { key: 'concurrency', value: knownConcurrency ? `${props.accounts.reduce((sum, account) => sum + (account.current_concurrency ?? 0), 0)} / ${props.accounts.reduce((sum, account) => sum + account.concurrency, 0)}` : '—', tone: 'text-ink' }
  ]
})
</script>
