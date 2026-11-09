<template>
  <div class="flex items-center justify-end gap-0.5">
    <button type="button" class="key-action" :title="t('keys.useKey')" @click="$emit('use')"><Icon name="terminal" size="sm" /><span class="sr-only">{{ t('keys.useKey') }}</span></button>
    <button v-if="!hideImport" type="button" class="key-action" :title="t('keys.importToCcSwitch')" @click="$emit('import')"><Icon name="upload" size="sm" /><span class="sr-only">{{ t('keys.importToCcSwitch') }}</span></button>
    <button type="button" class="key-action" :title="t(active ? 'keys.disable' : 'keys.enable')" @click="$emit('toggle')"><Icon :name="active ? 'ban' : 'checkCircle'" size="sm" /><span class="sr-only">{{ t(active ? 'keys.disable' : 'keys.enable') }}</span></button>
    <button type="button" class="key-action" :title="t('common.edit')" @click="$emit('edit')"><Icon name="edit" size="sm" /><span class="sr-only">{{ t('common.edit') }}</span></button>
    <button ref="trigger" type="button" class="key-action" :title="t('common.more')" :aria-expanded="open" @click="toggleMenu"><Icon name="more" size="sm" /><span class="sr-only">{{ t('common.more') }}</span></button>
    <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-[9998]" @click="closeMenu" />
      <div v-if="open" class="fixed z-[9999] w-40 rounded-field border border-edge bg-surface p-1 shadow-lg" :style="position">
        <button ref="deleteButton" type="button" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-600 hover:bg-red-500/10" @click="closeMenu(); $emit('delete')"><Icon name="trash" size="sm" />{{ t('common.delete') }}</button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
defineProps<{ active: boolean; hideImport?: boolean }>()
defineEmits<{ use: []; import: []; toggle: []; edit: []; delete: [] }>()
const { t } = useI18n()
const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const deleteButton = ref<HTMLButtonElement | null>(null)
const position = ref({ top: '0px', left: '0px' })
function closeMenu() { open.value = false }
async function toggleMenu() {
  if (open.value) return closeMenu()
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  position.value = { top: `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 56))}px`, left: `${Math.max(8, Math.min(rect.right - 160, window.innerWidth - 168))}px` }
  open.value = true
  await nextTick()
  deleteButton.value?.focus()
}
useEventListener(window, 'scroll', closeMenu, true)
useEventListener(window, 'resize', closeMenu)
useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && open.value) { closeMenu(); trigger.value?.focus() }
})
</script>

<style scoped>
.key-action { @apply flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500; }
</style>
