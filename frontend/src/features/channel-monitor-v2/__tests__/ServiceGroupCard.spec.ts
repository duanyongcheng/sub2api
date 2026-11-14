import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ServiceGroupCard from '../ServiceGroupCard.vue'
import { monitorRowKey, type AvailabilityEntry } from '../monitorAvailability'
import { coverage, health, metrics, row } from './availabilityFixtures'

vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key, locale: { value: 'en' } }),
}))

function entry(overrides: Partial<AvailabilityEntry> = {}): AvailabilityEntry {
  const parent = row({ health: { ...health(), score: 76.3 } })
  return { row: parent, key: monitorRowKey(parent), children: [], dataBuckets: 1, ...overrides }
}
function view(value: AvailabilityEntry) {
  return mount(ServiceGroupCard, { props: { entry: value, coverage, rangeLabel: '24h' } })
}

describe('Service status matrix row', () => {
  it('shows real aggregates despite redacted counts and keeps availability state independent of the score', () => {
    const wrapper = view(entry())
    expect(wrapper.attributes('data-state')).toBe('healthy')
    expect(wrapper.text()).toContain('99.00%')
    expect(wrapper.text()).toContain('76.3')
    expect(wrapper.findAll('.availability-strip button')).toHaveLength(3)
    wrapper.unmount()
  })

  it('uses a neutral insufficient-data explanation without inferring no traffic from zero redacted counts', () => {
    const wrapper = view(entry({ row: row({ metrics: metrics(0), health: { ...health('unknown'), score: 99 } }) }))
    expect(wrapper.attributes('data-state')).toBe('unknown')
    expect(wrapper.text()).toContain('channelMonitorV2.service.unknownReason')
    expect(wrapper.text()).not.toContain('channelMonitorV2.service.noTraffic')
    expect(wrapper.text()).not.toContain('100.00%')
    expect(wrapper.text()).not.toContain('99.0')
    wrapper.unmount()
  })

  it('does not invent a missing or non-finite health score', () => {
    const wrapper = view(entry({ row: row({ health: { ...health(), score: Number.NaN } }) }))
    expect(wrapper.text()).not.toContain('NaN')
    expect(wrapper.text()).toContain('—')
    wrapper.unmount()
  })

  it('expands model subrows with their own availability and timeline, ordering errors first', async () => {
    const wrapper = view(entry({ children: [
      row({ model: 'healthy-model', health: health('healthy') }),
      row({ model: 'failed-model', metrics: metrics(0.8), health: health('critical') }),
    ] }))
    expect(wrapper.find('[data-testid="service-model-details"]').exists()).toBe(false)
    await wrapper.find('button[aria-expanded]').trigger('click')
    const details = wrapper.find('[data-testid="service-model-details"]')
    expect(details.text().indexOf('failed-model')).toBeLessThan(details.text().indexOf('healthy-model'))
    expect(details.text()).toContain('20.00%')
    expect(details.findAll('.availability-strip')).toHaveLength(2)
    expect(wrapper.find('button[aria-expanded]').attributes('aria-expanded')).toBe('true')
    wrapper.unmount()
  })

  it('labels a model parent expansion as groups and renders the actual group identity', async () => {
    const wrapper = view(entry({ row: row({ group_id: undefined, group_name: undefined, model: 'deepseek-chat' }), children: [
      row({ group_name: 'Production group', model: 'deepseek-chat' }),
    ] }))
    const toggle = wrapper.find('button[aria-expanded]')
    expect(toggle.attributes('aria-label')).toBe('channelMonitorV2.service.expandGroups')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-label')).toBe('channelMonitorV2.service.collapseGroups')
    expect(wrapper.find('[data-testid="service-model-details"]').text()).toContain('Production group')
    wrapper.unmount()
  })
})
