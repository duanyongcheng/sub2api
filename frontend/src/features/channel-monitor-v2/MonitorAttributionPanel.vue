<template>
  <section class="card overflow-hidden" :aria-label="t('channelMonitorV2.operations.attribution')">
    <header class="flex items-center justify-between gap-3 border-b border-edge px-4 py-3">
      <h3 class="text-sm font-semibold text-ink">{{ t('channelMonitorV2.operations.attribution') }}</h3>
      <span class="text-xs tabular-nums text-ink-3">{{ t('channelMonitorV2.operations.errorsTotal', { count: total }) }}</span>
    </header>
    <p class="px-4 pt-3 text-xs leading-relaxed text-ink-3">{{ t('channelMonitorV2.operations.attributionBasis') }}</p>
    <div v-for="group in groups" :key="group.owner" class="border-b border-edge px-4 py-3 last:border-b-0" :data-owner="group.owner">
      <div class="flex items-center gap-2 text-xs">
        <StatusPill :tone="ownerTone(group.owner)" :dot="false" :label="t(`channelMonitorV2.operations.owners.${group.owner}`)" />
        <span class="ml-auto tabular-nums text-ink-2">{{ group.count }}</span>
        <strong class="w-12 text-right tabular-nums text-ink">{{ formatMonitorPercent(group.share) }}</strong>
      </div>
      <div class="my-2 h-1.5 overflow-hidden rounded-full bg-surface-3"><span class="block h-full rounded-full" :class="ownerBar(group.owner)" :style="{ width: `${group.share * 100}%` }" /></div>
      <p class="text-xs leading-relaxed text-ink-2">
        <template v-if="group.categories.length">{{ t('channelMonitorV2.operations.topCause', { category: categoryLabel(group.categories[0].category), count: group.categories[0].count }) }}</template>
        <template v-else>{{ t('channelMonitorV2.operations.noOwnerErrors') }}</template>
      </p>
      <!-- 设计主线 §3.4：占比 → 一句话结论 → 可执行动作，管理员不必从百分比里自己推理 -->
      <p v-if="group.count" class="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-ink-2" :data-action="group.owner">
        <Icon name="arrowRight" size="xs" class="mt-0.5 shrink-0 text-ink-3" />
        <span>{{ t(`channelMonitorV2.operations.verdictAction.${group.owner}`) }}</span>
      </p>
      <p v-if="group.ignoredCount" class="mt-1 text-[11px] text-ink-3">{{ t('channelMonitorV2.operations.ignoredCount', { count: group.ignoredCount }) }}</p>
      <button v-if="group.count" type="button" class="mt-2 text-xs font-semibold text-primary-700 hover:underline" @click="emit('inspect', group.owner)">{{ t('channelMonitorV2.operations.inspectOwner') }} →</button>
    </div>
    <div v-if="previewCategories.length" class="m-3 rounded-xl border border-edge bg-surface-2 p-3">
      <label class="block text-xs font-semibold text-ink">{{ t('channelMonitorV2.operations.ignorePreview') }}
      <select v-model="previewCategory" class="input mt-2 !py-1.5 !text-xs">
        <option v-for="row in previewCategories" :key="row.category" :value="row.category">{{ categoryLabel(row.category) }}</option>
      </select>
      </label>
      <p v-if="preview" class="mt-2 text-sm font-semibold tabular-nums text-ink" data-testid="ignore-impact">{{ formatRate(preview.current) }} <span class="px-1 text-ink-3">→</span> {{ formatRate(preview.projected) }}</p>
      <p v-else class="mt-2 text-xs text-ink-3">{{ t('channelMonitorV2.operations.previewUnavailable') }}</p>
      <p class="mt-1.5 text-[11px] leading-relaxed text-ink-3">{{ t('channelMonitorV2.operations.previewHint') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MonitorErrorRow, MonitorHealth, MonitorMetric } from '@/api/channelMonitorV2'
import StatusPill, { type StatusTone } from '@/components/common/StatusPill.vue'
import Icon from '@/components/icons/Icon.vue'
import { attributionGroups, ignoreImpact, type AttributionOwner } from './ownership'
import { formatMonitorPercent } from './monitorFormat'

const props = defineProps<{ rows: MonitorErrorRow[]; metrics: MonitorMetric; health: MonitorHealth }>()
const emit = defineEmits<{ inspect: [owner: AttributionOwner] }>()
const { t, te } = useI18n()
const groups = computed(() => attributionGroups(props.rows).filter(group => group.owner !== 'unclassified' || group.count > 0))
const total = computed(() => props.rows.reduce((sum, row) => sum + row.count, 0))
const previewCategories = computed(() => props.rows.filter(row => !row.ignored && row.count > 0))
const previewCategory = ref('client_cancelled')
watch(previewCategories, rows => {
  if (!rows.some(row => row.category === previewCategory.value)) previewCategory.value = rows[0]?.category || ''
}, { immediate: true })
const preview = computed(() => ignoreImpact(props.metrics, props.health, props.rows, previewCategory.value))
const formatRate = (value: number) => `${(value * 100).toFixed(2)}%`
function categoryLabel(category: string) {
  const key = `channelMonitorV2.errorCategories.${category}`
  return te(key) ? t(key) : category
}
function ownerTone(owner: AttributionOwner): StatusTone {
  return ({ upstream: 'warn', account: 'bad', client: 'neutral', internal: 'info', unclassified: 'neutral' } as const)[owner]
}
function ownerBar(owner: AttributionOwner) {
  return { upstream: 'bg-[rgb(var(--warn-500))]', account: 'bg-[rgb(var(--bad-500))]', client: 'bg-ink-3', internal: 'bg-[rgb(var(--info-500))]', unclassified: 'bg-ink-3' }[owner]
}
</script>
