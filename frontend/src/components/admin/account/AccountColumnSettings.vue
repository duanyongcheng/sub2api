<template>
  <details ref="details" class="account-columns relative shrink-0" @keydown.esc.prevent="close">
    <summary class="btn btn-secondary list-none" :title="t('admin.accounts.viewColumns')">
      <Icon name="grid" size="sm" />
      <span class="hidden xl:inline">{{ t('admin.accounts.workspace.columns') }}</span>
    </summary>
    <div class="absolute right-0 z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-field border border-edge bg-surface shadow-lg">
      <div class="flex items-center justify-between gap-3 border-b border-edge px-3 py-3">
        <span class="text-sm font-semibold text-ink">{{ t('admin.accounts.viewColumns') }}</span>
        <button type="button" class="text-xs text-primary-700 hover:underline dark:text-primary-300" @click="$emit('reset')">{{ t('common.reset') }}</button>
      </div>
      <div class="max-h-80 overflow-y-auto overscroll-contain p-2">
        <label v-for="column in columns" :key="column.key" class="flex min-h-9 cursor-pointer items-center gap-3 rounded-field px-2 py-2 text-sm text-ink-2 hover:bg-surface-2">
          <input type="checkbox" class="rounded border-edge text-primary-600 focus:ring-primary-500" :checked="!hiddenColumns.has(column.key)" @change="$emit('toggle', column.key)" />
          <span>{{ column.label }}</span>
        </label>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'

defineProps<{ columns: { key: string; label: string }[]; hiddenColumns: Set<string> }>()
defineEmits<{ toggle: [key: string]; reset: [] }>()
const { t } = useI18n()
const details = ref<HTMLDetailsElement | null>(null)
const close = () => {
  if (!details.value) return
  details.value.open = false
  details.value.querySelector('summary')?.focus()
}
onClickOutside(details, () => {
  if (details.value) details.value.open = false
})
</script>

<style scoped>
summary::-webkit-details-marker { display: none; }
</style>
