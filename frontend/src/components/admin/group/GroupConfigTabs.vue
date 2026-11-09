<template>
  <nav class="flex flex-wrap gap-1 rounded-field bg-surface-3 p-1" :aria-label="t('admin.groups.workspace.configuration')">
    <button
      v-for="tab in visibleTabs"
      :key="tab"
      type="button"
      class="rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary-500"
      :class="modelValue === tab ? 'bg-surface text-ink shadow-xs' : 'text-ink-2 hover:bg-surface/60'"
      :aria-pressed="modelValue === tab"
      :data-group-tab="tab"
      @click="$emit('update:modelValue', tab)"
    >{{ t(`admin.groups.workspace.tabs.${tab}`) }}</button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
export type GroupConfigTab = 'basic' | 'pricing' | 'models' | 'rates' | 'routes' | 'media' | 'subscription' | 'reasoning' | 'scheduling' | 'profit'
const props = defineProps<{ modelValue: GroupConfigTab; simple?: boolean; availableTabs?: GroupConfigTab[] }>()
defineEmits<{ 'update:modelValue': [value: GroupConfigTab] }>()
const { t } = useI18n()
const visibleTabs = computed<GroupConfigTab[]>(() => props.simple ? ['basic'] : props.availableTabs ?? [
  'basic', 'pricing', 'models', 'rates', 'routes', 'media', 'subscription', 'reasoning', 'scheduling', 'profit'
])
</script>
