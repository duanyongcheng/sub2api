import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { MonitorModelRow, MonitorSnapshot } from '@/api/channelMonitorV2'
import ServiceMetricCards from '../ServiceMetricCards.vue'
import ServiceModelRanking from '../ServiceModelRanking.vue'
import ServiceErrorDistribution from '../ServiceErrorDistribution.vue'
import { coverage, health, metrics } from './availabilityFixtures'

vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string, params?: Record<string, unknown>) => params ? `${key} ${JSON.stringify(params)}` : key, te: () => true, locale: { value: 'en' } }),
}))

function snapshot(): MonitorSnapshot {
  return {
    config: { version: 1, enabled: true, refresh_interval_seconds: 300, platforms: [], group_ids: [], health_thresholds: {
      minimum_sample: 50, warning_error_rate: .05, critical_error_rate: .2, target_ttft_ms: 1000, warning_ttft_ms: 3000,
      critical_ttft_ms: 10000, warning_cache_rate: .2, critical_cache_rate: .1, error_weight: .6, ttft_weight: .3, cache_weight: .1,
    } },
    coverage, metrics: { ...metrics(.005), tpm: 120, cache_rate: .416 }, health: { ...health(), cache: 'healthy' },
    trend: [{ bucket_start: coverage.requested_start, metrics: metrics(), health: health() }],
  }
}

describe('ServiceMetricCards', () => {
  it('uses server aggregates and real percentile/TPM values despite redacted counts', () => {
    const wrapper = mount(ServiceMetricCards, { props: { snapshot: snapshot(), showThroughput: true } })
    expect(wrapper.findAll('[data-metric]')).toHaveLength(6)
    expect(wrapper.find('[data-testid="service-availability"] .stat-value').text()).toBe('99.50%')
    expect(wrapper.find('[data-metric="error-rate"] .stat-value').text()).toBe('0.50%')
    expect(wrapper.find('[data-metric="ttft"] .stat-value').text()).toBe('200ms')
    expect(wrapper.find('[data-metric="ttft"]').text()).toContain('400ms')
    expect(wrapper.find('[data-metric="throughput"] .stat-value').text()).toBe('2 tok/s')
    expect(wrapper.find('[data-metric="cache-rate"] .stat-value').text()).toBe('41.6%')
    expect(wrapper.find('[data-metric="sample-coverage"]').text()).toContain('"count":1,"total":3')
    wrapper.unmount()
  })

  it('hides throughput entirely and uses dashes for unknown metrics', () => {
    const value = snapshot()
    value.health = { ...health('unknown'), ttft: 'unknown', cache: 'unknown' }
    const wrapper = mount(ServiceMetricCards, { props: { snapshot: value, showThroughput: false } })
    expect(wrapper.findAll('[data-metric]')).toHaveLength(5)
    expect(wrapper.find('[data-metric="throughput"]').exists()).toBe(false)
    for (const key of ['availability', 'error-rate', 'ttft', 'cache-rate']) expect(wrapper.find(`[data-metric="${key}"] .stat-value`).text()).toBe('—')
    wrapper.unmount()
  })
})

describe('ServiceModelRanking', () => {
  const rows: MonitorModelRow[] = [{ platform: 'openai', model: 'gpt-5.4', metrics: { ...metrics(.05), error_requests: 42 }, health: health('warning') }]
  it('keeps counts private for ordinary users and emits the selected real model', async () => {
    const wrapper = mount(ServiceModelRanking, { props: { rows, admin: false } })
    expect(wrapper.text()).toContain('channelMonitorV2.dashboard.ranking.byRate')
    expect(wrapper.text()).not.toContain('channelMonitorV2.dashboard.ranking.errors')
    await wrapper.find('[data-model="gpt-5.4"]').trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual([rows[0]])
    await wrapper.setProps({ admin: true })
    expect(wrapper.text()).toContain('"count":42')
    wrapper.unmount()
  })

  it('keeps a failed auxiliary request distinct from a successful empty ranking', async () => {
    const wrapper = mount(ServiceModelRanking, { props: { rows: [], error: 'Models failed' } })
    expect(wrapper.find('[role="alert"]').text()).toContain('Models failed')
    expect(wrapper.text()).not.toContain('ranking.empty')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('retry')).toEqual([[]])
    wrapper.unmount()
  })
})

describe('ServiceErrorDistribution', () => {
  const rows = [{ category: 'authentication', count: 42, rate: .7, ignored: false, details: [{ message: 'private upstream message', count: 42 }] }]
  it('reuses category shares while showing messages and counts only to administrators', async () => {
    const wrapper = mount(ServiceErrorDistribution, { props: { rows, admin: false } })
    expect(wrapper.text()).toContain('70.0%')
    expect(wrapper.text()).not.toContain('×42')
    await wrapper.find('button[aria-expanded]').trigger('click')
    expect(wrapper.text()).not.toContain('private upstream message')
    await wrapper.setProps({ admin: true })
    await flushPromises()
    expect(wrapper.text()).toContain('×42')
    expect(wrapper.text()).toContain('private upstream message')
    wrapper.unmount()
  })

  it('offers retry for load failure instead of claiming there were no errors', async () => {
    const wrapper = mount(ServiceErrorDistribution, { props: { rows: [], error: 'Errors failed' } })
    expect(wrapper.find('[role="alert"]').text()).toContain('Errors failed')
    expect(wrapper.text()).not.toContain('dashboard.errors.empty')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('retry')).toEqual([[]])
    wrapper.unmount()
  })
})
