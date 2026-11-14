<template>
  <div ref="rootRef" class="relative inline-flex" @keydown.esc="open = false">
    <button
      type="button"
      class="btn btn-secondary btn-sm"
      :disabled="busy"
      aria-haspopup="menu"
      :aria-expanded="open"
      :title="resolvedTitle"
      data-testid="report-export-trigger"
      @click="open = !open"
    >
      <LoadingSpinner v-if="busy" size="sm" />
      <Icon v-else name="download" size="sm" />
      {{ busy ? t('reportExport.exporting') : label }}
    </button>
    <div
      v-if="open"
      class="absolute right-0 top-full z-40 mt-1 min-w-[10.5rem] overflow-hidden rounded-xl border border-edge bg-surface shadow-lg"
      role="menu"
      :aria-label="resolvedLabel"
    >
      <button
        v-for="option in formats"
        :key="option.value"
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink hover:bg-surface-2"
        :data-export-format="option.value"
        @click="pick(option.value)"
      >
        <Icon name="download" size="xs" class="text-ink-3" />{{ option.label }}
        <span class="ml-auto text-[10px] text-ink-3">{{ option.hint }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 报表导出入口（原型 03「导出报表」/ 13「把这段窗口带走」）。
 *
 * Format choice is explicit rather than inferred: xlsx keeps the multi-sheet
 * structure, csv keeps a single table that any script can diff. The component
 * only owns the menu and busy state — the caller builds the sheets.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { ExportFormat } from '@/utils/reportExport'

const props = withDefaults(defineProps<{
  label?: string
  title?: string
  busy?: boolean
  /** CSV only makes sense when the report is a single table. */
  formats?: ExportFormat[]
}>(), { busy: false, formats: () => ['xlsx', 'csv'] })

const emit = defineEmits<{ export: [format: ExportFormat] }>()
const { t } = useI18n()
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const resolvedLabel = computed(() => props.label ?? t('reportExport.export'))
const resolvedTitle = computed(() => props.title ?? t('reportExport.exportHint'))
const formats = computed(() => props.formats.map(value => ({
  value,
  label: t(`reportExport.format.${value}`),
  hint: t(`reportExport.formatHint.${value}`),
})))

function pick(format: ExportFormat) {
  open.value = false
  emit('export', format)
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!open.value) return
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown))

defineExpose({ close: () => { open.value = false } })
</script>
