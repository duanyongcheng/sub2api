<template>
  <section class="flex min-w-0 flex-col overflow-hidden rounded-card border border-edge bg-surface shadow-xs">
    <div class="flex items-center justify-between gap-2 border-b border-edge px-4 py-2.5">
      <h3 class="text-[13.5px] font-semibold text-ink">
        {{ t('admin.dashboard.overview.platformAndQuickTitle') }}
      </h3>
      <span class="text-[11.5px] text-ink-2">{{ t('admin.dashboard.overview.byRequests') }}</span>
    </div>

    <div class="flex flex-1 flex-col divide-y divide-edge/70 px-4 py-1">
      <p v-if="rows.length === 0" class="py-8 text-center text-body text-ink-2">
        {{ t('admin.dashboard.noDataAvailable') }}
      </p>

      <div
        v-for="row in rows"
        :key="row.platform"
        class="flex items-center gap-2.5 py-2.5"
      >
        <span
          class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-edge bg-surface-2"
          :style="{ color: row.color }"
        >
          <PlatformIcon :platform="row.iconPlatform" size="sm" />
        </span>
        <span class="w-20 shrink-0 truncate text-[12.5px] font-medium text-ink">{{ row.name }}</span>
        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
          <div
            class="h-full rounded-full transition-[width] duration-150 motion-reduce:transition-none"
            :style="{ width: `${Math.max(2, row.share)}%`, backgroundColor: row.color }"
          />
        </div>
        <span class="w-12 shrink-0 text-right text-[11.5px] tabular-nums text-ink-2">
          {{ formatCompact(row.requests) }}
        </span>
        <span class="w-9 shrink-0 text-right text-[12px] font-bold tabular-nums text-ink">
          {{ row.share.toFixed(0) }}%
        </span>
      </div>
    </div>

    <!-- Compact hairline-separated quick operations links -->
    <div class="mt-auto border-t border-edge bg-surface-2 px-4 py-2.5">
      <div class="flex flex-wrap gap-1.5">
        <router-link
          v-for="link in quickLinks"
          :key="link.to"
          :to="link.to"
          class="inline-flex items-center gap-1 rounded-lg border border-edge bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-ink-2 transition-colors hover:border-edge-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
        >
          {{ link.label }}
        </router-link>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import type { GroupPlatform, ModelStat } from '@/types'

const props = withDefaults(
  defineProps<{
    models: ModelStat[]
    isSimple?: boolean
  }>(),
  { isSimple: false }
)

const { t } = useI18n()

interface PlatformRule {
  key: string
  iconPlatform?: GroupPlatform
  name: string
  color: string
  match: RegExp
}

const PLATFORMS: PlatformRule[] = [
  { key: 'anthropic', iconPlatform: 'anthropic', name: 'Anthropic', color: '#d97757', match: /^(claude|anthropic)/i },
  { key: 'openai', iconPlatform: 'openai', name: 'OpenAI', color: '#10a37f', match: /^(gpt|o1|o3|o4|codex|dall-e|whisper|tts|chatgpt)/i },
  { key: 'gemini', iconPlatform: 'gemini', name: 'Google', color: '#4285f4', match: /^(gemini|gemma|palm)/i },
  { key: 'grok', iconPlatform: 'grok', name: 'Grok', color: '#8b5cf6', match: /^(grok|xai)/i },
  { key: 'deepseek', iconPlatform: 'deepseek', name: 'DeepSeek', color: '#2563eb', match: /^deepseek/i },
  { key: 'kimi', iconPlatform: 'kimi', name: 'Kimi', color: '#6366f1', match: /^(kimi|moonshot)/i },
  { key: 'zhipu', iconPlatform: 'zhipu', name: 'GLM', color: '#f97316', match: /^(glm|zhipu|chatglm)/i },
  { key: 'minimax', iconPlatform: 'minimax', name: 'MiniMax', color: '#e11d48', match: /^(minimax|abab)/i },
  { key: 'other', iconPlatform: undefined, name: 'Other', color: '#64748b', match: /.*/i }
]

const rows = computed(() => {
  const totals = new Map<string, number>()
  let sum = 0
  for (const model of props.models ?? []) {
    const requests = Number(model.requests || 0)
    if (requests <= 0) continue
    sum += requests
    const platform = PLATFORMS.find((p) => p.match.test(model.model || '')) ?? PLATFORMS[PLATFORMS.length - 1]
    totals.set(platform.key, (totals.get(platform.key) ?? 0) + requests)
  }
  if (sum === 0) return []
  return PLATFORMS.filter((p) => (totals.get(p.key) ?? 0) > 0)
    .map((p) => {
      const requests = totals.get(p.key) ?? 0
      return {
        platform: p.key,
        iconPlatform: p.iconPlatform,
        name: p.key === 'other' ? t('dashboard.workbench.otherPlatform') : p.name,
        color: p.color,
        requests,
        share: (requests / sum) * 100
      }
    })
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 6)
})

const quickLinks = computed(() => {
  const items = [
    { to: '/admin/accounts', label: t('admin.dashboard.overview.quickAccounts') },
    { to: '/admin/groups', label: t('admin.dashboard.overview.quickGroups') },
    { to: '/admin/ops', label: t('admin.dashboard.overview.quickOpsMonitor') },
    { to: '/admin/usage', label: t('admin.dashboard.overview.quickUsage') }
  ]
  if (!props.isSimple) {
    items.push({ to: '/admin/redeem', label: t('admin.dashboard.overview.quickRedeemShort') })
  }
  items.push({ to: '/admin/announcements', label: t('admin.dashboard.overview.quickAnnouncementShort') })
  return items
})

function formatCompact(value: number): string {
  const n = Number(value || 0)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}
</script>
