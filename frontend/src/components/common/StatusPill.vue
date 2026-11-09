<template>
  <span class="pill" :class="[pillClass, { 'pill-dot': dot }]" :title="title">
    <slot>
      <span>{{ label }}</span>
    </slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type StatusTone = 'ok' | 'warn' | 'bad' | 'info' | 'violet' | 'neutral' | 'brand'

/**
 * StatusPill — one status vocabulary for the whole product.
 *
 * Five semantic levels: normal / warning / danger / in-progress / disabled,
 * plus `violet` for stream-ish types and `brand` for "highlighted, not a
 * status". The dot is rendered via CSS (`currentColor`) so callers never have
 * to inline a colour.
 */
const props = withDefaults(
  defineProps<{
    tone?: StatusTone
    label?: string
    title?: string
    /** Show the leading 6px status dot (default on). */
    dot?: boolean
    /**
     * Dashed, low-weight rendering for internal conditions that must never
     * change a user-facing verdict (probe failures, unbound monitors).
     */
    muted?: boolean
  }>(),
  {
    tone: 'neutral',
    dot: true,
    muted: false
  }
)

const pillClass = computed(() => (props.muted ? 'pill-muted' : `pill-${props.tone}`))
</script>
