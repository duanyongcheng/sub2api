<template>
  <div v-if="visible" class="strip" :class="toneClass" role="status">
    <span class="strip-item cursor-default">
      <Icon :name="leadIcon" size="sm" :stroke-width="1.8" />
      <span>{{ title }}</span>
      <span v-if="count !== undefined" class="rounded-full bg-black/5 px-1.5 py-px text-[11px] font-bold tabular-nums dark:bg-white/10">
        {{ count }}
      </span>
    </span>

    <template v-for="(item, index) in displayItems" :key="`${item.label}-${index}`">
      <span class="strip-sep" aria-hidden="true" />
      <component
        :is="item.to ? RouterLink : item.onClick ? 'button' : 'span'"
        :to="item.to"
        type="button"
        class="strip-item"
        :class="{ 'cursor-default': !item.to && !item.onClick }"
        :title="item.hint"
        @click="item.onClick?.()"
      >
        <span>{{ item.label }}</span>
        <Icon v-if="item.to" name="arrowRight" size="xs" :stroke-width="2.2" />
      </component>
    </template>

    <span v-if="$slots.extra || meta" class="ml-auto flex items-center gap-2 text-meta opacity-75">
      <slot name="extra">{{ meta }}</slot>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import Icon from '@/components/icons/Icon.vue'

export interface ActionStripItem {
  label: string
  /** Route to jump to. Items with a route render as a link with an arrow. */
  to?: string
  /** Click handler for in-page actions (filters, dialogs). */
  onClick?: () => void
  /** Tooltip / detail, e.g. "Claude 6 个 · OpenAI 6 个". */
  hint?: string
}

/**
 * ActionStrip — the "what needs a decision today" band.
 *
 * Sits above the KPI band on operational pages. It carries 1–3 clickable items
 * plus an optional right-aligned timestamp. It renders nothing when there is
 * nothing to report, so a healthy system shows no strip at all.
 */
const props = withDefaults(
  defineProps<{
    title: string
    items?: ActionStripItem[]
    count?: number
    tone?: 'warn' | 'bad' | 'info'
    /** Timestamp or any trailing meta shown on the right. */
    meta?: string
    icon?: InstanceType<typeof Icon>['$props']['name']
    /** Hard limit on visible items; the rest are summarised as "+N". */
    maxItems?: number
  }>(),
  {
    items: () => [],
    tone: 'warn',
    maxItems: 4
  }
)

const toneClass = computed(() => `strip-${props.tone}`)

const leadIcon = computed<InstanceType<typeof Icon>['$props']['name']>(() => {
  if (props.icon) return props.icon
  if (props.tone === 'bad') return 'exclamationCircle'
  if (props.tone === 'info') return 'infoCircle'
  return 'exclamationTriangle'
})

const visible = computed(() => props.count !== 0 && (props.items.length > 0 || Boolean(props.title)))

const displayItems = computed<ActionStripItem[]>(() => {
  if (props.items.length <= props.maxItems) return props.items
  const shown = props.items.slice(0, props.maxItems)
  const hidden = props.items.length - props.maxItems
  return [...shown, { label: `+${hidden}` }]
})
</script>
