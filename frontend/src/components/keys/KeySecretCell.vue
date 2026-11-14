<template>
  <div class="mt-1 flex min-w-0 items-center gap-1 text-ink-3">
    <code class="truncate text-[10.5px]">{{ revealed ? value : maskApiKey(value) }}</code>
    <button type="button" class="shrink-0 rounded p-0.5 hover:bg-surface-3 hover:text-ink" :aria-label="t(revealed ? 'keys.hideKey' : 'keys.showKey')" @click="toggleReveal"><Icon :name="revealed ? 'eyeOff' : 'eye'" size="xs" /></button>
    <button type="button" class="shrink-0 rounded p-0.5 hover:bg-surface-3 hover:text-primary-700" :aria-label="t('keys.copyToClipboard')" @click="$emit('copy')"><Icon :name="copied ? 'check' : 'copy'" size="xs" /></button>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { maskApiKey } from '@/utils/maskApiKey'
const props = defineProps<{ value: string; copied: boolean }>()
defineEmits<{ copy: [] }>()
const { t } = useI18n()
const revealed = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
function hide() {
  clearTimeout(timer)
  revealed.value = false
}
function toggleReveal() {
  if (revealed.value) return hide()
  revealed.value = true
  timer = setTimeout(hide, 10_000)
}
watch(() => props.value, hide)
onUnmounted(hide)
</script>
