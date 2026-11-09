<template>
  <section v-if="show" class="card min-w-0" :aria-label="title">
    <header class="flex items-center justify-between gap-3 border-b border-edge px-5 py-4">
      <h3 class="text-base font-semibold text-ink">{{ title }}</h3>
      <button type="button" class="btn btn-ghost btn-icon btn-sm" :aria-label="t('common.close')" @click="$emit('close')">
        <Icon name="x" size="sm" />
      </button>
    </header>
    <div class="px-4 py-4 sm:px-5"><slot /></div>
    <footer v-if="$slots.footer" class="sticky bottom-0 z-10 rounded-b-card border-t border-edge bg-surface-2 px-5 py-3">
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
defineProps<{ show: boolean; title: string }>()
defineEmits<{ close: [] }>()
const { t } = useI18n()
</script>
