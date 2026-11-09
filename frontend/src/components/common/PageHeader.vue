<template>
  <header class="page-hd">
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="page-title">{{ title }}</h2>
        <slot name="badge" />
      </div>
      <p v-if="description || $slots.description" class="page-description">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>

    <div v-if="$slots.actions" class="page-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
/**
 * PageHeader — "one screen, one decision".
 *
 * Every page opens with exactly three things: the title, a one-sentence goal
 * and one primary action. Everything else belongs in a secondary button or a
 * `⋯` menu supplied through the `actions` slot.
 */
defineProps<{
  title: string
  description?: string
}>()
</script>
