import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AvailabilityBoard from '../AvailabilityBoard.vue'
import AvailabilityTimeline from '../AvailabilityTimeline.vue'
import AvailabilityErrors from '../AvailabilityErrors.vue'
import { availabilityState, formatAvailability, monitorBucketStarts, monitorChildren } from '../monitorAvailability'
import { coverage, health, metrics, row } from './availabilityFixtures'

vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key, te: () => true, locale: { value: 'en' } }),
}))

function board() {
  return mount(AvailabilityBoard, { props: {
    rows: [row(), row({ platform: 'kimi', group_id: 8, group_name: 'Kimi', health: health('critical'), metrics: metrics(0.5) }), row({ platform: 'future-provider', group_id: 9, group_name: 'Future', health: health('unknown') })],
    children: [row({ model: 'deepseek-reasoner', metrics: metrics(0.5) }), row({ model: 'deepseek-chat' })],
    coverage, layout: 'cards', rangeLabel: '24h', search: '', sort: 'severity', issuesOnly: false, loading: false,
  } })
}

describe('availability data contracts', () => {
  it('uses backend availability with redacted counts, independently of cache and latency', () => {
    expect(formatAvailability(metrics(), health())).toBe('99.00%')
    expect(availabilityState(health())).toBe('healthy')
    expect(formatAvailability(metrics(0), health('unknown'))).toBe('—')
    expect(formatAvailability(metrics(NaN), health())).toBe('—')
  })
  it('fills the full requested timeline and matches platform/group/model children', () => {
    expect(monitorBucketStarts(coverage)).toHaveLength(3)
    expect(monitorChildren(row(), [row({ model: 'deepseek-chat' }), row({ platform: 'openai', model: 'deepseek-chat' }), row({ group_id: 8, model: 'deepseek-chat' })])).toHaveLength(1)
    expect(monitorBucketStarts({ ...coverage, requested_start: 'invalid' })).toEqual([])
  })
})

describe('AvailabilityBoard', () => {
  it('shows providers, keeps weighted server aggregate headlines, and expands children', async () => {
    const wrapper = board()
    const card = wrapper.find('[data-platform="deepseek"]')
    expect(card.text()).toContain('DeepSeek')
    expect(card.find('.availability-value').text()).toBe('99.00%') // not the mean of child rates
    await card.find('button[aria-expanded]').trigger('click')
    expect(card.text()).toContain('deepseek-reasoner')
    expect(card.text()).toContain('50.00%')
    expect(wrapper.find('[data-platform="future-provider"]').text()).toContain('future-provider')
    expect(wrapper.find('[data-platform="future-provider"] .availability-value').text()).toBe('—')
    expect(wrapper.text()).not.toContain('RPM')
    wrapper.unmount()
  })
  it('sorts issues first, searches children, toggles layouts and excludes no-data from issues', async () => {
    const wrapper = board()
    expect(wrapper.findAll('article')[0].attributes('data-platform')).toBe('kimi')
    await wrapper.setProps({ search: 'reasoner' })
    expect(wrapper.findAll('article')).toHaveLength(1)
    expect(wrapper.find('article').attributes('data-platform')).toBe('deepseek')
    await wrapper.setProps({ search: '', issuesOnly: true, layout: 'list' })
    expect(wrapper.findAll('article')).toHaveLength(1)
    expect(wrapper.find('article').attributes('data-platform')).toBe('kimi')
    await wrapper.setProps({ issuesOnly: false, sort: 'avail-desc' })
    expect(wrapper.findAll('article').map(card => card.attributes('data-platform'))).toEqual(['deepseek', 'kimi', 'future-provider'])
    wrapper.unmount()
  })
  it('colors average latency against its budget instead of reusing the P50 health state', async () => {
    const wrapper = board()
    const slowAverage = row()
    slowAverage.metrics.ttft.avg_ms = 12000
    slowAverage.health.ttft = 'healthy'
    slowAverage.health.thresholds = {
      warning_error_rate: 0.05, critical_error_rate: 0.2, target_ttft_ms: 3000,
      warning_ttft_ms: 3000, critical_ttft_ms: 10000, error_weight: 1, ttft_weight: 0,
    }
    await wrapper.setProps({ rows: [slowAverage] })
    expect(wrapper.find('[title="channelMonitorV2.availability.avgTtft"]').classes()).toContain('text-rose-600')
    expect(wrapper.find('article').classes()).toContain('!border-t-emerald-500')
    wrapper.unmount()
  })
  it('fills missing buckets with no-data and exposes keyboard-accessible private tooltips', async () => {
    const wrapper = mount(AvailabilityTimeline, { props: { buckets: row().buckets, coverage } })
    const buckets = wrapper.findAll('button')
    expect(buckets).toHaveLength(3)
    expect(buckets[0].attributes('aria-label')).toContain('states.unknown')
    expect(buckets[1].attributes('aria-label')).toContain('99.00%')
    expect(buckets[1].classes()).toContain('bg-emerald-500')
    expect(buckets[2].attributes('aria-label')).not.toContain('100.00%')
    await buckets[1].trigger('focus')
    expect(wrapper.find('[role="tooltip"]').text()).toContain('99.00%')
    await buckets[1].trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('splits ignored errors and only exposes sample messages to admins', async () => {
    const wrapper = mount(AvailabilityErrors, { props: { admin: false, rows: [
      { category: 'timeout', count: 12, rate: 0.2, details: [{ message: 'admin-only', count: 12 }] },
      { category: 'authentication', count: 3, rate: 0.05, ignored: true },
    ] } })
    expect(wrapper.findAll('section')).toHaveLength(2)
    expect(wrapper.findAll('section')[1].text()).toContain('authentication')
    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).not.toContain('admin-only')
    await wrapper.setProps({ admin: true })
    expect(wrapper.text()).toContain('admin-only')
    wrapper.unmount()
  })
})
