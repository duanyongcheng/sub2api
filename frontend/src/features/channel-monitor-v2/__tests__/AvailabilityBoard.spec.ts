import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AvailabilityBoard from '../AvailabilityBoard.vue'
import AvailabilityTimeline from '../AvailabilityTimeline.vue'
import AvailabilityErrors from '../AvailabilityErrors.vue'
import AvailabilityGroupDetailsDialog from '../AvailabilityGroupDetailsDialog.vue'
import { availabilityState, formatAvailability, monitorBucketStarts, monitorChildLabel, monitorChildren } from '../monitorAvailability'
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
  it('shows provider aggregates and opens model availability details from its group card', async () => {
    const wrapper = board()
    expect(wrapper.findAll('[data-testid="provider-section"]').map(section => section.attributes('data-provider'))).toEqual(['deepseek', 'kimi', 'future-provider'])
    expect(wrapper.find('[data-provider="deepseek"] h2').text()).toBe('DeepSeek')
    const card = wrapper.find('[data-platform="deepseek"]')
    expect(card.text()).toContain('DeepSeek')
    expect(card.text()).toContain('99.00%')
    expect(card.text()).toContain('metrics.cacheRate')
    expect(card.text()).toContain('250ms')
    expect(card.findAll('button')).toHaveLength(0)
    await card.trigger('click')
    const dialog = wrapper.findComponent({ name: 'AvailabilityGroupDetailsDialog' })
    expect(dialog.props('show')).toBe(true)
    expect(dialog.props('totalBuckets')).toBe(3)
    expect(dialog.props('entry').children.map((child: { model?: string }) => child.model)).toEqual(['deepseek-chat', 'deepseek-reasoner'])
    expect(wrapper.find('[data-platform="kimi"]').attributes('data-state')).toBe('critical')
    expect(wrapper.find('[data-platform="future-provider"] .availability-value').text()).toBe('—')
    expect(wrapper.text()).not.toContain('RPM')
    wrapper.unmount()
  })
  it('renders model-level availability metrics and history inside the group details dialog', () => {
    const entry = {
      row: row(), key: 'deepseek:7', dataBuckets: 1,
      children: [row({ model: 'deepseek-chat' }), row({ model: 'deepseek-reasoner', metrics: metrics(0.5), health: health('critical') })],
    }
    const wrapper = mount(AvailabilityGroupDetailsDialog, { props: { show: true, entry, coverage, rangeLabel: '24h', totalBuckets: 3 }, global: { stubs: {
      BaseDialog: { name: 'BaseDialog', props: ['show', 'title', 'closeOnClickOutside'], template: '<div v-if="show" role="dialog"><h2>{{ title }}</h2><slot /></div>' },
      AvailabilityTimeline: true,
    } } })
    expect(wrapper.find('[role="dialog"]').text()).toContain('deepseek-chat')
    expect(wrapper.find('[role="dialog"]').text()).toContain('deepseek-reasoner')
    expect(wrapper.find('[role="dialog"]').text()).toContain('50.00%')
    expect(wrapper.find('[role="dialog"] [data-testid="group-summary"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'BaseDialog' }).props('closeOnClickOutside')).toBe(true)
    expect(wrapper.find('[role="dialog"]').text()).toContain('metrics.cacheRate')
    wrapper.unmount()
  })
  it('sorts cards within provider sections, searches children, and keeps list sorting and issue filtering', async () => {
    const wrapper = board()
    const cards = wrapper.findAll('article')
    expect(cards[0].attributes('data-platform')).toBe('deepseek')
    expect(cards[1].attributes('data-platform')).toBe('kimi')
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
  it('keeps overview counts on the API scope and tells no-match apart from no-data', async () => {
    const wrapper = board()
    const overview = () => wrapper.find('[data-testid="availability-overview"]').findAll('b').map(item => item.text())
    expect(overview()).toEqual(['1', '0', '1', '1'])
    await wrapper.setProps({ issuesOnly: true, search: 'no-such-provider' })
    expect(overview()).toEqual(['1', '0', '1', '1'])
    expect(wrapper.text()).toContain('channelMonitorV2.availability.noMatch')
    await wrapper.setProps({ rows: [] })
    expect(wrapper.text()).toContain('channelMonitorV2.empty.title')
    expect(wrapper.text()).not.toContain('channelMonitorV2.availability.noMatch')
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
    expect(wrapper.find('article').attributes('data-state')).toBe('healthy')
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
  it('keeps the strip a single tab stop and moves between buckets with arrow keys', async () => {
    const wrapper = mount(AvailabilityTimeline, { props: { buckets: row().buckets, coverage }, attachTo: document.body })
    const tabStops = () => wrapper.findAll('button').map(button => button.attributes('tabindex'))
    expect(tabStops()).toEqual(['0', '-1', '-1'])
    await wrapper.findAll('button')[0].trigger('keydown', { key: 'ArrowRight' })
    expect(tabStops()).toEqual(['-1', '0', '-1'])
    expect(document.activeElement).toBe(wrapper.findAll('button')[1].element)
    await wrapper.findAll('button')[1].trigger('keydown', { key: 'End' })
    expect(tabStops()).toEqual(['-1', '-1', '0'])
    wrapper.unmount()
  })
  it('renders child strips as non-interactive images', () => {
    const wrapper = mount(AvailabilityTimeline, { props: { buckets: row().buckets, coverage, compact: true } })
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.findAll('span')).toHaveLength(3)
    wrapper.unmount()
  })
  it('names children by the dimension the parent does not show and keeps "other" last', async () => {
    const group = row()
    const platformRow = row({ group_id: undefined, group_name: undefined })
    const modelRow = row({ group_id: undefined, group_name: undefined, model: 'deepseek-chat' })
    expect(monitorChildLabel(row({ model: 'deepseek-chat' }), group, 'Other')).toBe('deepseek-chat')
    expect(monitorChildLabel({ ...platformRow, model: '__other__' }, platformRow, 'Other')).toBe('Other')
    expect(monitorChildLabel(row({ model: 'deepseek-chat' }), modelRow, 'Other')).toBe('DeepSeek group')
    const wrapper = mount(AvailabilityBoard, { props: {
      rows: [group], coverage, layout: 'list', rangeLabel: '24h', loading: false,
      children: [row({ model: '__other__' }), row({ model: 'deepseek-reasoner' }), row({ model: 'deepseek-chat' })],
    } })
    await wrapper.find('article button[aria-expanded]').trigger('click')
    const names =wrapper.findAll('article > div:nth-child(2) > div').map(child => child.find('.truncate').text())
    expect(names).toEqual(['deepseek-chat', 'deepseek-reasoner', 'channelMonitorV2.otherModels'])
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
    expect(wrapper.find('.border-gray-200 span').text()).toBe('-') // sample without platform, not "API"
    // Bars compare categories: the largest share fills the track.
    const bars = wrapper.findAll('[style*="width"]').map(bar => bar.attributes('style'))
    expect(bars).toEqual(['width: 100%;', 'width: 25%;'])
    wrapper.unmount()
  })
})
