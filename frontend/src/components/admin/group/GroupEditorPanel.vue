<template>
  <section v-if="show" class="card flex min-h-0 min-w-0 flex-col overflow-visible" :aria-label="title">
    <header v-if="!hideTitle" class="flex items-center justify-between gap-3 border-b border-edge px-5 py-3.5">
      <h3 class="text-base font-semibold text-ink">{{ title }}</h3>
      <button type="button" class="btn btn-ghost btn-icon btn-sm" :aria-label="t('common.close')" @click="$emit('close')">
        <Icon name="x" size="sm" />
      </button>
    </header>
    <div
      v-if="$slots.toolbar"
      class="group-editor-toolbar relative z-10 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-t-card border-b border-edge bg-surface px-4"
    >
      <slot name="toolbar" />
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5"><slot /></div>
    <footer v-if="$slots.footer" class="shrink-0 rounded-b-card border-t border-edge bg-surface-2 px-5 py-3">
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
withDefaults(defineProps<{ show: boolean; title: string; hideTitle?: boolean }>(), { hideTitle: false })
defineEmits<{ close: [] }>()
const { t } = useI18n()
</script>
