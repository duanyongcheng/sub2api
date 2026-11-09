<template>
  <input
    :value="modelValue ?? ''"
    type="number"
    min="0"
    step="any"
    class="h-7 w-[86px] rounded-md border border-edge-strong bg-surface px-2 text-xs tabular-nums text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
    :aria-label="label"
    :placeholder="placeholder"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<script setup lang="ts">
defineProps<{ modelValue: number | string | null | undefined; label: string; placeholder?: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
