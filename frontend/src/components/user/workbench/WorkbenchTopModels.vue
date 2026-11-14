<template>
  <section class="card">
    <div class="card-hd">
      <h3 class="text-sm font-semibold text-ink">{{ t('dashboard.workbench.topModels') }}</h3>
      <span class="text-meta text-ink-3">{{ t('dashboard.workbench.topModelsHint') }}</span>
    </div>
    <div class="card-bd flex flex-col gap-3">
      <p v-if="models.length === 0" class="py-4 text-center text-body text-ink-3">
        {{ t('dashboard.workbench.topModelsEmpty') }}
      </p>
      <div v-for="model in models" :key="model.model" class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-3 text-[12.5px]">
          <span class="min-w-0 truncate font-semibold text-ink" :title="model.model">{{ model.model }}</span>
          <span class="shrink-0 tabular-nums text-ink-3">{{ model.share.toFixed(1) }}%</span>
        </div>
        <div class="progress h-1.5">
          <div class="progress-bar" :style="{ width: `${Math.max(2, model.share)}%` }" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModelStat } from '@/types'

/**
 * WorkbenchTopModels — token share by model.
 *
 * Sorted by token volume and capped at five rows: this rail answers "what am I
 * spending tokens on", not "list every model".
 */
const props = withDefaults(defineProps<{ stats: ModelStat[]; limit?: number }>(), { limit: 5 })

const { t } = useI18n()

const models = computed(() => {
  const rows = [...(props.stats ?? [])].sort((a, b) => b.total_tokens - a.total_tokens).slice(0, props.limit)
  const total = rows.reduce((sum, row) => sum + row.total_tokens, 0) || 1
  return rows.map((row) => ({
    model: row.model,
    share: (row.total_tokens / total) * 100
  }))
})
</script>
