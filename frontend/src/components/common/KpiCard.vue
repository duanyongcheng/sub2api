<template>
  <component
    :is="tag"
    :to="to"
    :href="href"
    class="kpi"
    :class="{ 'kpi-link': Boolean(to || href) }"
  >
    <div class="kpi-label">
      <Icon v-if="icon" :name="icon" size="sm" :stroke-width="1.8" class="shrink-0" />
      <span class="truncate">{{ label }}</span>
      <slot name="label-extra" />
    </div>

    <div class="kpi-value" :class="valueClass">
      <span class="truncate">{{ value }}</span>
      <span v-if="unit" class="kpi-unit">{{ unit }}</span>
      <slot name="value" />
    </div>

    <div v-if="$slots.default || hint" class="kpi-sub">
      <slot>
        <span class="truncate">{{ hint }}</span>
      </slot>
    </div>

    <div v-if="sparkline && sparkline.length > 1" class="kpi-spark">
      <Sparkline
        :data="sparkline"
        :width="108"
        :height="46"
        :stroke-color="sparkColor"
        :stroke-width="1.6"
      />
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import Icon from '@/components/icons/Icon.vue'
import Sparkline from './Sparkline.vue'

/**
 * KpiCard — the metric tile used by every dashboard band.
 *
 * Layout follows the spec: label row (12.2px, icon + text), value row (25px,
 * tabular numerals), optional change/description line and an optional 108×46
 * sparkline anchored to the bottom-right corner.
 */
const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    unit?: string
    hint?: string
    icon?: InstanceType<typeof Icon>['$props']['name']
    /** `default` | `ok` | `warn` | `bad` | `brand` — tints the value. */
    tone?: 'default' | 'ok' | 'warn' | 'bad' | 'brand'
    sparkline?: number[]
    sparkColor?: string
    to?: string
    href?: string
  }>(),
  {
    tone: 'default',
    sparkColor: '#94a3b8'
  }
)

const tag = computed(() => {
  if (props.to) return RouterLink
  if (props.href) return 'a'
  return 'div'
})

const valueClass = computed(() => {
  switch (props.tone) {
    case 'ok':
      return 'text-emerald-600'
    case 'warn':
      return 'text-amber-600'
    case 'bad':
      return 'text-red-600'
    case 'brand':
      return 'text-primary-700'
    default:
      return ''
  }
})
</script>

<style scoped>
.kpi-link {
  display: block;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.kpi-link:hover {
  border-color: rgb(var(--edge-strong));
  box-shadow: var(--elevation-xs);
  transform: translateY(-1px);
}

.kpi-spark {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 108px;
  height: 46px;
  opacity: 0.9;
  pointer-events: none;
}
</style>
