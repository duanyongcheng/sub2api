<template>
  <div class="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-field border border-edge bg-primary-50 px-3 py-2 dark:bg-primary-950/30">
    <div class="flex flex-wrap items-center gap-2">
      <span v-if="allResultsSelected" class="text-sm font-medium tabular-nums text-primary-700 dark:text-primary-300">
        {{ t('admin.accounts.bulkActions.selectedAll', { count: selectedIds.length }) }}
      </span>
      <span v-else-if="selectedIds.length > 0" class="text-sm font-medium tabular-nums text-primary-700 dark:text-primary-300">
        {{ t('admin.accounts.bulkActions.selected', { count: selectedIds.length }) }}
      </span>
      <span v-else class="text-sm font-medium text-primary-700 dark:text-primary-300">
        {{ t('admin.accounts.bulkEdit.title') }}
      </span>
      <template v-if="selectedIds.length > 0">
        <button
          type="button"
          @click="$emit('select-page')"
          class="text-xs font-medium text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
        >
          {{ t('admin.accounts.bulkActions.selectCurrentPage') }}
        </button>
      </template>
      <template v-if="!allResultsSelected && totalResults > selectedIds.length">
        <span v-if="selectedIds.length > 0" class="text-gray-300 dark:text-primary-800">•</span>
        <button
          type="button"
          :disabled="selectingAll"
          @click="$emit('select-all-results')"
          class="text-xs font-medium text-primary-700 hover:text-primary-800 disabled:cursor-not-allowed disabled:opacity-60 dark:text-primary-300 dark:hover:text-primary-200"
        >
          {{
            selectingAll
              ? t('admin.accounts.bulkActions.selectingAll')
              : t('admin.accounts.bulkActions.selectAllResults', { count: totalResults })
          }}
        </button>
      </template>
      <template v-if="selectedIds.length > 0">
        <span class="text-gray-300 dark:text-primary-800">•</span>
        <button
          type="button"
          @click="$emit('clear')"
          class="text-xs font-medium text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
        >
          {{ t('admin.accounts.bulkActions.clear') }}
        </button>
      </template>
    </div>
    <div class="flex flex-wrap items-center gap-1.5">
      <template v-if="selectedIds.length > 0">
        <button type="button" @click="$emit('edit-selected')" class="btn btn-secondary btn-sm">{{ t('admin.accounts.bulkActions.edit') }}</button>
        <button type="button" @click="$emit('toggle-schedulable', true)" class="btn btn-ghost btn-sm">{{ t('admin.accounts.bulkActions.enableScheduling') }}</button>
        <button type="button" @click="$emit('toggle-schedulable', false)" class="btn btn-ghost btn-sm">{{ t('admin.accounts.bulkActions.disableScheduling') }}</button>
        <button type="button" @click="$emit('refresh-token')" class="btn btn-ghost btn-sm">{{ t('admin.accounts.bulkActions.refreshToken') }}</button>
      </template>
      <details ref="moreActions" class="relative" @keydown.esc.prevent="closeMoreActions">
        <summary class="btn btn-ghost btn-sm list-none">
          {{ t('admin.accounts.moreActions') }}
          <Icon name="chevronDown" size="sm" />
        </summary>
        <div class="absolute right-0 z-40 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-field border border-edge bg-surface p-1 text-ink-2 shadow-lg" @click="closeMoreActions">
          <template v-if="selectedIds.length > 0">
            <button type="button" @click="$emit('reset-status')" class="bulk-menu-action">{{ t('admin.accounts.bulkActions.resetStatus') }}</button>
            <button type="button" @click="$emit('probe-upstream-billing')" class="bulk-menu-action">{{ t('admin.accounts.bulkActions.probeUpstreamBilling') }}</button>
          </template>
          <button type="button" @click="$emit('edit-filtered')" class="bulk-menu-action">{{ t('admin.accounts.bulkEdit.submit') }}</button>
          <div v-if="selectedIds.length > 0" class="mt-1 border-t border-edge pt-1">
            <button type="button" @click="$emit('delete')" class="bulk-menu-action text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40">{{ t('admin.accounts.bulkActions.delete') }}</button>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'

defineProps<{
  selectedIds: number[]
  totalResults: number
  selectingAll: boolean
  allResultsSelected: boolean
}>()

defineEmits([
  'delete',
  'edit-selected',
  'edit-filtered',
  'clear',
  'select-page',
  'select-all-results',
  'toggle-schedulable',
  'reset-status',
  'refresh-token',
  'probe-upstream-billing'
])

const { t } = useI18n()
const moreActions = ref<HTMLDetailsElement | null>(null)
const closeMoreActions = () => {
  if (!moreActions.value) return
  moreActions.value.open = false
  moreActions.value.querySelector('summary')?.focus()
}
onClickOutside(moreActions, () => {
  if (moreActions.value) moreActions.value.open = false
})
</script>

<style scoped>
summary::-webkit-details-marker {
  display: none;
}

.bulk-menu-action {
  @apply flex min-h-9 w-full items-center rounded-field px-3 py-2 text-left text-xs font-medium hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500;
}
</style>
