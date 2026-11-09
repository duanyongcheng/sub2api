<template>
  <div class="space-y-3">
    <div class="overflow-x-auto rounded-field border border-edge">
      <table class="w-full min-w-[780px] table-fixed text-left text-xs">
        <colgroup><col style="width: 220px" /><col v-for="field in fields" :key="field.key" style="width: 110px" /><col v-if="groupId" style="width: 144px" /><col style="width: 72px" /></colgroup>
        <thead class="bg-surface-2 text-[11px] text-ink-3">
          <tr><th class="px-3 py-3">{{ t('admin.groups.workspace.models') }}</th><th v-for="field in fields" :key="field.key" class="px-3 py-3">{{ t(`admin.channels.form.${field.label}`) }}<div class="mt-0.5 font-normal">$/1M</div></th><th v-if="groupId" class="px-3 py-3">{{ t('admin.groups.workspace.modelMargin') }}</th><th class="px-3 py-3">{{ t('common.actions') }}</th></tr>
        </thead>
        <tbody class="divide-y divide-edge">
          <tr v-for="(entry, index) in modelValue" :key="index" class="align-top">
            <td class="px-3 py-3">
              <span class="block whitespace-normal break-words font-mono font-semibold text-ink">{{ entry.models.join(', ') || t('admin.groups.workspace.unnamedPricing') }}</span>
              <button type="button" class="mt-1 text-[11px] text-primary-700" :data-pricing-details="index" @click="expandedIndex = expandedIndex === index ? null : index">{{ t('admin.groups.workspace.advancedPricing') }}</button>
            </td>
            <td v-for="field in fields" :key="field.key" class="px-3 py-3">
              <InlineNumberField v-if="entry.billing_mode === 'token'" :model-value="entry[field.key]" :label="`${entry.models.join(', ')} ${t(`admin.channels.form.${field.label}`)}`" placeholder="—" @update:model-value="updateField(index, field.key, $event)" />
              <span v-else class="text-ink-3">—</span>
            </td>
            <td v-if="groupId" class="px-3 py-3">
              <StatusPill v-if="entryMargin(entry) !== null" :tone="entryMargin(entry)! < 0 ? 'bad' : 'neutral'" :dot="false">{{ entryMargin(entry)!.toFixed(1) }}%</StatusPill>
              <span v-else class="text-ink-3">—</span>
            </td>
            <td class="px-3 py-3"><button type="button" class="btn btn-ghost btn-icon btn-sm text-red-600" :aria-label="t('common.delete')" @click="removeEntry(index)"><Icon name="trash" size="sm" /></button></td>
          </tr>
          <tr v-if="!modelValue.length"><td :colspan="fields.length + (groupId ? 3 : 2)" class="px-4 py-8 text-center text-ink-3">{{ t('admin.groups.workspace.noPricing') }}</td></tr>
        </tbody>
      </table>
    </div>
    <p v-if="groupId" class="text-[11px] text-ink-3">{{ t('admin.groups.workspace.modelMarginBasis') }}</p>
    <PricingEntryCard
      v-if="expandedIndex !== null && modelValue[expandedIndex]"
      :entry="modelValue[expandedIndex]"
      :platform="platform"
      hide-token-intervals
      @update="replaceEntry(expandedIndex!, $event)"
      @remove="removeEntry(expandedIndex!)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import InlineNumberField from '@/components/common/InlineNumberField.vue'
import Icon from '@/components/icons/Icon.vue'
import PricingEntryCard from '@/components/admin/channel/PricingEntryCard.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import { getModelStats } from '@/api/admin/dashboard'
import { formatDateLocalInput } from '@/utils/format'
import type { ModelStat } from '@/types'
import type { PricingFormEntry } from '@/components/admin/channel/types'

const props = defineProps<{ modelValue: PricingFormEntry[]; platform: string; groupId?: number; active?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: PricingFormEntry[]] }>()
const { t } = useI18n()
const expandedIndex = ref<number | null>(null)
const modelStats = ref<ModelStat[]>([])
let modelStatsRequest = 0
watch(() => [props.groupId, props.active], async () => {
  const request = ++modelStatsRequest
  modelStats.value = []
  if (!props.groupId || !props.active) return
  const today = formatDateLocalInput(new Date())
  try {
    const response = await getModelStats({ group_id: props.groupId, start_date: today, end_date: today })
    if (request === modelStatsRequest) modelStats.value = response.models
  } catch {
    // Historical margin stays unknown when statistics cannot be read.
  }
}, { immediate: true })
function entryMargin(entry: PricingFormEntry): number | null {
  const samples = modelStats.value.filter(stat => entry.models.includes(stat.model))
  if (!samples.length || samples.some(stat => typeof stat.account_cost !== 'number')) return null
  const revenue = samples.reduce((sum, stat) => sum + stat.actual_cost, 0)
  const cost = samples.reduce((sum, stat) => sum + stat.account_cost!, 0)
  return revenue > 0 ? (1 - cost / revenue) * 100 : null
}
watch(() => props.modelValue.length, (length, previous) => {
  if (length > previous && props.modelValue[length - 1].models.length === 0) expandedIndex.value = length - 1
})
const fields = [
  { key: 'input_price', label: 'inputPrice' },
  { key: 'output_price', label: 'outputPrice' },
  { key: 'cache_write_price', label: 'cacheWrite5mPrice' },
  { key: 'cache_write_1h_price', label: 'cacheWrite1hPrice' },
  { key: 'cache_read_price', label: 'cacheReadPrice' }
] as const
function updateField(index: number, key: typeof fields[number]['key'], value: string) {
  replaceEntry(index, { ...props.modelValue[index], [key]: value })
}
function replaceEntry(index: number, entry: PricingFormEntry) {
  emit('update:modelValue', props.modelValue.map((value, i) => i === index ? entry : value))
}
function removeEntry(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
  expandedIndex.value = null
}
</script>
