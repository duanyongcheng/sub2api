<template>
  <nav ref="navRef" class="group-tabs" role="tablist" :aria-label="t('admin.groups.workspace.configuration')">
    <button
      v-for="(tab, index) in visibleTabs"
      :key="tab"
      type="button"
      role="tab"
      class="group-tab"
      :class="modelValue === tab ? 'group-tab-active' : ''"
      :aria-selected="modelValue === tab"
      :tabindex="modelValue === tab ? 0 : -1"
      :data-group-tab="tab"
      @click="$emit('update:modelValue', tab)"
      @keydown="moveFocus($event, index)"
    >{{ t(`admin.groups.workspace.tabs.${tab}`) }}</button>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
export type GroupConfigTab = 'basic' | 'pricing' | 'models' | 'rates' | 'routes' | 'media' | 'subscription' | 'reasoning' | 'scheduling' | 'profit'
const props = defineProps<{ modelValue: GroupConfigTab; simple?: boolean; availableTabs?: GroupConfigTab[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: GroupConfigTab] }>()
const { t } = useI18n()
const navRef = ref<HTMLElement | null>(null)
const visibleTabs = computed<GroupConfigTab[]>(() => props.simple ? ['basic'] : props.availableTabs ?? [
  'basic', 'pricing', 'models', 'rates', 'routes', 'media', 'subscription', 'reasoning', 'scheduling', 'profit'
])
const moveFocus = (event: KeyboardEvent, index: number) => {
  const last = visibleTabs.value.length - 1
  let nextIndex: number | null = null
  if (event.key === 'ArrowRight') nextIndex = index >= last ? 0 : index + 1
  if (event.key === 'ArrowLeft') nextIndex = index <= 0 ? last : index - 1
  if (event.key === 'Home') nextIndex = 0
  if (event.key === 'End') nextIndex = last
  if (nextIndex === null) return
  event.preventDefault()
  emit('update:modelValue', visibleTabs.value[nextIndex])
  void nextTick(() => navRef.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex!]?.focus())
}
</script>

<style scoped>
.group-tabs {
  @apply -mb-px flex min-w-0 items-stretch gap-0.5 overflow-x-auto pr-6;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
  mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
}
.group-tabs::-webkit-scrollbar { display: none; }
.group-tab {
  @apply shrink-0 border-b-2 border-transparent px-2.5 py-3 text-[12.5px] font-medium leading-5 text-ink-2 transition-colors duration-150 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 motion-reduce:transition-none;
}
.group-tab-active {
  @apply border-primary-500 text-primary-700;
}
</style>
