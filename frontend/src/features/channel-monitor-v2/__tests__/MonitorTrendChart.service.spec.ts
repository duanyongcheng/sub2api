import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MonitorTrendChart from '../MonitorTrendChart.vue'
import { coverage, health, metrics } from './availabilityFixtures'

vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key, locale: { value: 'en' } }),
}))
vi.mock('vue-chartjs', () => ({ Line: { name: 'Line', props: ['data', 'options'], template: '<div data-testid="line" />' } }))

let wrapper: VueWrapper
afterEach(() => { wrapper?.unmount(); document.documentElement.classList.remove('dark') })

describe('service operation trend', () => {
  it('keeps raw metric values and visible gaps for absent and insufficient buckets', () => {
    wrapper = mount(MonitorTrendChart, { props: { operations: true, compact: true, coverage, trend: [
      { bucket_start: coverage.requested_start, metrics: { ...metrics(.023), ttft: { ...metrics().ttft, p50_ms: 510 } }, health: health() },
      { bucket_start: '2026-10-01T00:10:00Z', metrics: metrics(.2), health: { ...health('unknown'), ttft: 'unknown' } },
    ] } })
    const data = wrapper.findComponent({ name: 'Line' }).props('data')
    expect(data.datasets).toHaveLength(2)
    expect(data.datasets[0].data).toEqual([2.3, null, null])
    expect(data.datasets[1].data).toEqual([510, null, null])
    expect(data.datasets.every((dataset: { tension: number; spanGaps: boolean; cubicInterpolationMode: string }) =>
      dataset.tension === 0 && !dataset.spanGaps && dataset.cubicInterpolationMode === 'default')).toBe(true)
  })

  it('updates chart colors when the live document theme changes', async () => {
    wrapper = mount(MonitorTrendChart, { props: { operations: true, coverage, trend: [
      { bucket_start: coverage.requested_start, metrics: metrics(), health: health() },
    ] } })
    const chart = wrapper.findComponent({ name: 'Line' })
    const light = chart.props('options').scales.x.ticks.color
    document.documentElement.classList.add('dark')
    await flushPromises()
    expect(chart.props('options').scales.x.ticks.color).not.toBe(light)
  })
})
