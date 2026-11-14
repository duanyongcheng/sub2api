<template>
  <section class="card">
    <div class="card-hd">
      <h3 class="text-sm font-semibold text-ink">{{ t('admin.dashboard.platformBreakdown') }}</h3>
      <span class="text-meta text-ink-3">{{ t('admin.dashboard.overview.byRequests') }}</span>
    </div>
    <div class="card-bd flex flex-col">
      <p v-if="rows.length === 0" class="py-4 text-center text-body text-ink-3">
        {{ t('admin.dashboard.noDataAvailable') }}
      </p>
      <div v-for="row in rows" :key="row.platform" class="flex items-center gap-2.5 border-b border-dashed border-edge py-2 last:border-b-0">
        <span class="plat-mark" :style="{ background: row.color }">{{ row.initial }}</span>
        <span class="w-16 shrink-0 truncate text-[12.4px] text-ink">{{ row.name }}</span>
        <div class="progress h-1.5 flex-1">
          <div class="progress-bar" :style="{ width: `${Math.max(2, row.share)}%`, background: row.color }" />
        </div>
        <span class="w-10 shrink-0 text-right text-[12px] font-bold tabular-nums text-ink">{{ row.share.toFixed(0) }}%</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModelStat } from '@/types'

/**
 * PlatformShare — admin-side traffic split by provider.
 *
 * Derived from the model breakdown because the dashboard snapshot does not
 * return a platform dimension for admins. Model names are matched by prefix,
 * which is stable across `claude-*` / `gpt-*` / `gemini-*` / `grok-*` families.
 */
const props = defineProps<{ models: ModelStat[] }>()

const { t } = useI18n()

const PLATFORMS = [
  { key: 'anthropic', name: 'Anthropic', color: '#d97757', match: /^(claude|anthropic)/i, initial: 'C' },
  { key: 'openai', name: 'OpenAI', color: '#10a37f', match: /^(gpt|o1|o3|o4|codex|dall-e|whisper|tts)/i, initial: 'O' },
  { key: 'google', name: 'Google', color: '#4285f4', match: /^(gemini|gemma|palm)/i, initial: 'G' },
  { key: 'grok', name: 'Grok', color: '#8b5cf6', match: /^(grok|xai)/i, initial: 'X' },
  { key: 'other', name: 'Other', color: '#64748b', match: /.*/i, initial: '·' }
]

const rows = computed(() => {
  const totals = new Map<string, number>()
  let sum = 0
  for (const model of props.models ?? []) {
    const requests = Number(model.requests || 0)
    sum += requests
    const platform = PLATFORMS.find((p) => p.match.test(model.model || '')) ?? PLATFORMS[PLATFORMS.length - 1]
    totals.set(platform.key, (totals.get(platform.key) ?? 0) + requests)
  }
  if (sum === 0) return []
  return PLATFORMS.filter((p) => (totals.get(p.key) ?? 0) > 0)
    .map((p) => ({
      platform: p.key,
      name: p.key === 'other' ? t('dashboard.workbench.otherPlatform') : p.name,
      color: p.color,
      initial: p.initial,
      share: ((totals.get(p.key) ?? 0) / sum) * 100
    }))
    .sort((a, b) => b.share - a.share)
})
</script>

<style scoped>
.plat-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
}
</style>
