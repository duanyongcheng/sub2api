import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'

import DateRangePicker from '../DateRangePicker.vue'

const messages: Record<string, string> = {
  'dates.today': 'Today',
  'dates.yesterday': 'Yesterday',
  'dates.last24Hours': 'Last 24 Hours',
  'dates.last7Days': 'Last 7 Days',
  'dates.last14Days': 'Last 14 Days',
  'dates.last30Days': 'Last 30 Days',
  'dates.thisMonth': 'This Month',
  'dates.lastMonth': 'Last Month',
  'dates.startDate': 'Start Date',
  'dates.endDate': 'End Date',
  'dates.apply': 'Apply',
  'dates.selectDateRange': 'Select date range'
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => messages[key] ?? key,
    locale: ref('en')
  })
}))

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-09T00:15:30.456+08:00'))
})
afterEach(() => vi.useRealTimers())

describe('DateRangePicker', () => {
  it('uses last 24 hours as the default recognized preset', () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const wrapper = mount(DateRangePicker, {
      props: {
        startDate: yesterday.toISOString(),
        endDate: now.toISOString()
      },
      global: {
        stubs: {
          Icon: true
        }
      }
    })

    expect(wrapper.text()).toContain('Last 24 Hours')
  })

  it('emits range updates with last24Hours preset when applied', async () => {
    const now = new Date()
    const today = formatLocalDate(now)

    const wrapper = mount(DateRangePicker, {
      props: {
        startDate: today,
        endDate: today
      },
      global: {
        stubs: {
          Icon: true
        }
      }
    })

    await wrapper.find('.date-picker-trigger').trigger('click')
    const presetButton = wrapper.findAll('.date-picker-preset').find((node) =>
      node.text().includes('Last 24 Hours')
    )
    expect(presetButton).toBeDefined()

    await presetButton!.trigger('click')
    await wrapper.find('.date-picker-apply').trigger('click')

    const nowAfterClick = new Date()
    const yesterdayAfterClick = new Date(nowAfterClick.getTime() - 24 * 60 * 60 * 1000)
    const expectedStart = yesterdayAfterClick.toISOString()
    const expectedEnd = nowAfterClick.toISOString()

    expect(wrapper.emitted('update:startDate')?.[0]).toEqual([expectedStart])
    expect(wrapper.emitted('update:endDate')?.[0]).toEqual([expectedEnd])
    expect(wrapper.emitted('change')?.[0]).toEqual([
      {
        startDate: expectedStart,
        endDate: expectedEnd,
        preset: 'last24Hours'
      }
    ])
  })

  it('does not label two custom calendar dates as the last 24 hours', () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86_400_000)
    const wrapper = mount(DateRangePicker, {
      props: { startDate: formatLocalDate(yesterday), endDate: formatLocalDate(now) },
      global: { stubs: { Icon: true } },
    })

    expect(wrapper.get('.date-picker-trigger').text()).not.toContain('Last 24 Hours')
  })

  it('shows timestamp props as local calendar dates without losing the selected preset', async () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86_400_000)
    const wrapper = mount(DateRangePicker, {
      props: { startDate: yesterday.toISOString(), endDate: now.toISOString() },
      global: { stubs: { Icon: true } },
    })

    await wrapper.get('.date-picker-trigger').trigger('click')
    expect(wrapper.findAll<HTMLInputElement>('input[type="date"]').map(input => input.element.value))
      .toEqual([formatLocalDate(yesterday), formatLocalDate(now)])
    expect(wrapper.findAll('input[type="date"]')[0].attributes('max')).toBe(formatLocalDate(now))
    expect(wrapper.findAll('input[type="date"]')[1].attributes('min')).toBe(formatLocalDate(yesterday))

    await wrapper.get('.date-picker-trigger').trigger('click')
    vi.setSystemTime(new Date(now.getTime() + 10 * 60_000))
    await wrapper.get('.date-picker-trigger').trigger('click')
    expect(wrapper.get('.date-picker-preset-active').text()).toBe('Last 24 Hours')
  })

  it('anchors last 24 hours at Apply even when a draft was selected earlier', async () => {
    const wrapper = mount(DateRangePicker, {
      props: { startDate: '2026-11-01', endDate: '2026-11-01' },
      global: { stubs: { Icon: true } },
    })
    await wrapper.get('.date-picker-trigger').trigger('click')
    await wrapper.findAll('.date-picker-preset').find(node => node.text() === 'Last 24 Hours')!.trigger('click')
    const appliedAt = new Date(new Date().getTime() + 10 * 60_000)
    vi.setSystemTime(appliedAt)
    await wrapper.get('.date-picker-apply').trigger('click')

    expect(wrapper.emitted('change')?.[0]).toEqual([{
      startDate: new Date(appliedAt.getTime() - 86_400_000).toISOString(),
      endDate: appliedAt.toISOString(),
      preset: 'last24Hours',
    }])
  })

  it('keeps last 24 hours after parent synchronization and discarding a different draft', async () => {
    const now = new Date()
    const wrapper = mount(DateRangePicker, {
      props: {
        startDate: new Date(now.getTime() - 86_400_000).toISOString(),
        endDate: now.toISOString(),
        'onUpdate:startDate': (startDate: string) => { void wrapper.setProps({ startDate }) },
        'onUpdate:endDate': (endDate: string) => { void wrapper.setProps({ endDate }) },
      },
      global: { stubs: { Icon: true } },
    })
    await wrapper.get('.date-picker-trigger').trigger('click')
    await wrapper.get('.date-picker-apply').trigger('click')
    await nextTick()
    expect(wrapper.get('.date-picker-trigger').text()).toContain('Last 24 Hours')
    await wrapper.get('.date-picker-trigger').trigger('click')
    await wrapper.findAll('.date-picker-preset').find(node => node.text() === 'Today')!.trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.get('.date-picker-trigger').text()).toContain('Last 24 Hours')
    await wrapper.get('.date-picker-trigger').trigger('click')
    expect(wrapper.get('.date-picker-preset-active').text()).toBe('Last 24 Hours')
  })

  it('switches both timestamp boundaries to calendar dates when editing a date input', async () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86_400_000)
    const wrapper = mount(DateRangePicker, {
      props: { startDate: yesterday.toISOString(), endDate: now.toISOString() },
      global: { stubs: { Icon: true } },
    })
    await wrapper.get('.date-picker-trigger').trigger('click')
    await wrapper.findAll('input[type="date"]')[0].setValue('2026-10-20')
    await wrapper.get('.date-picker-apply').trigger('click')

    expect(wrapper.emitted('change')?.[0]).toEqual([{
      startDate: '2026-10-20', endDate: formatLocalDate(now), preset: null,
    }])
  })
})
