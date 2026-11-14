<template>
  <svg
    v-if="hasData"
    class="sparkline"
    :viewBox="`0 0 ${viewWidth} ${viewHeight}`"
    :width="width"
    :height="height"
    :preserveAspectRatio="preserveAspectRatio"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="fill">
      <path :d="areaPath" :fill="fillColor" stroke="none" />
    </template>
    <path
      :d="linePath"
      fill="none"
      :stroke="strokeColor"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
  <div v-else class="sparkline sparkline-empty" :style="{ width: `${width}px`, height: `${height}px` }" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * Sparkline — inline SVG trend chart.
 *
 * Deliberately dependency-free (no Chart.js): the KPI cards and the workbench
 * hero render a dozen of these and instantiating chart instances for each one
 * would cost far more than the 46px strip is worth. Points are normalised into
 * the viewBox so the SVG can stretch with `preserveAspectRatio="none"`.
 */
const props = withDefaults(
  defineProps<{
    data: Array<number | null | undefined>
    width?: number
    height?: number
    strokeColor?: string
    /** Explicit fill for the area under the line; `false` disables the area. */
    fill?: boolean | string
    strokeWidth?: number
    preserveAspectRatio?: string
    /** Pad the value range so the line never touches the top/bottom edge. */
    padding?: number
  }>(),
  {
    width: 108,
    height: 46,
    strokeColor: '#0d9488',
    fill: true,
    strokeWidth: 1.7,
    preserveAspectRatio: 'none',
    padding: 2
  }
)

const viewWidth = 100
const viewHeight = 100

const points = computed(() =>
  props.data.map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0))
)

const hasData = computed(() => points.value.length >= 2 && points.value.some((v) => v !== 0))

const scaled = computed(() => {
  const values = points.value
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const yPad = props.padding
  const usable = viewHeight - yPad * 2
  return values.map((value, index) => {
    const x = values.length === 1 ? viewWidth : (index / (values.length - 1)) * viewWidth
    const y = yPad + (1 - (value - min) / span) * usable
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }
  })
})

const linePath = computed(() => {
  const coords = scaled.value
  if (coords.length === 0) return ''
  return coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
})

const areaPath = computed(() => {
  const coords = scaled.value
  if (coords.length === 0) return ''
  const first = coords[0]
  const last = coords[coords.length - 1]
  return `${linePath.value} L${last.x},${viewHeight} L${first.x},${viewHeight} Z`
})

const fallbackFill = computed(() => {
  // Derive a translucent area fill from the stroke colour when `fill` is true.
  const match = /^#([0-9a-f]{6})$/i.exec(props.strokeColor)
  if (!match) return 'transparent'
  return `#${match[1]}1f`
})

const fillColor = computed(() => (typeof props.fill === 'string' ? props.fill : fallbackFill.value))

</script>

<style scoped>
.sparkline {
  display: block;
  overflow: visible;
}

.sparkline-empty {
  border-radius: 4px;
  background: linear-gradient(90deg, rgb(var(--surface-3)), transparent);
  opacity: 0.6;
}
</style>
