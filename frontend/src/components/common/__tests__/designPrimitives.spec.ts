import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import KpiCard from '@/components/common/KpiCard.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ActionStrip from '@/components/common/ActionStrip.vue'
import Sparkline from '@/components/common/Sparkline.vue'

const stubs = {
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  'router-link': { props: ['to'], template: '<a><slot /></a>' },
  Icon: { props: ['name', 'size'], template: '<svg data-icon />' }
}

describe('KpiCard', () => {
  it('renders label, value and unit', () => {
    const wrapper = mount(KpiCard, {
      props: { label: '今日请求', value: '12,480', unit: '次' },
      global: { stubs }
    })
    expect(wrapper.text()).toContain('今日请求')
    expect(wrapper.text()).toContain('12,480')
    expect(wrapper.text()).toContain('次')
  })

  it('renders a sparkline only when at least two points are provided', async () => {
    const wrapper = mount(KpiCard, {
      props: { label: 'Requests', value: 10, sparkline: [1] },
      global: { stubs }
    })
    expect(wrapper.findComponent(Sparkline).exists()).toBe(false)

    await wrapper.setProps({ sparkline: [1, 3, 2] })
    expect(wrapper.findComponent(Sparkline).exists()).toBe(true)
  })

  it('applies the tone to the value row', () => {
    const wrapper = mount(KpiCard, {
      props: { label: 'Margin', value: '-2.4', tone: 'bad' },
      global: { stubs }
    })
    expect(wrapper.find('.kpi-value').classes()).toContain('text-red-600')
  })
})

describe('StatusPill', () => {
  it.each([
    ['ok', 'pill-ok'],
    ['warn', 'pill-warn'],
    ['bad', 'pill-bad'],
    ['info', 'pill-info'],
    ['violet', 'pill-violet'],
    ['neutral', 'pill-neutral'],
    ['brand', 'pill-brand']
  ] as const)('maps tone %s to %s', (tone, expected) => {
    const wrapper = mount(StatusPill, { props: { tone, label: 'x' } })
    expect(wrapper.classes()).toContain(expected)
    expect(wrapper.classes()).toContain('pill')
  })

  it('draws the status dot by default and can hide it', () => {
    const withDot = mount(StatusPill, { props: { label: 'x' } })
    expect(withDot.classes()).toContain('pill-dot')

    const withoutDot = mount(StatusPill, { props: { label: 'x', dot: false } })
    expect(withoutDot.classes()).not.toContain('pill-dot')
  })
})

describe('PageHeader', () => {
  it('renders the title, description and the actions slot', () => {
    const wrapper = mount(PageHeader, {
      props: { title: '运营概览', description: '需要你今天做决定的事' },
      slots: { actions: '<button class="probe">导出</button>' }
    })
    expect(wrapper.find('h2').text()).toBe('运营概览')
    expect(wrapper.text()).toContain('需要你今天做决定的事')
    expect(wrapper.find('.probe').exists()).toBe(true)
  })
})

describe('ActionStrip', () => {
  it('renders each actionable item as a link when a route is given', () => {
    const wrapper = mount(ActionStrip, {
      props: {
        title: '需要处理',
        count: 2,
        items: [
          { label: '12 个账号额度即将耗尽', to: '/admin/accounts' },
          { label: '待发货订单 12', to: '/admin/orders' }
        ]
      },
      global: { stubs }
    })
    expect(wrapper.text()).toContain('需要处理')
    expect(wrapper.text()).toContain('12 个账号额度即将耗尽')
    expect(wrapper.findAll('a')).toHaveLength(2)
  })

  it('renders nothing when there is nothing to report', () => {
    const wrapper = mount(ActionStrip, {
      props: { title: '需要处理', count: 0, items: [] }
    })
    expect(wrapper.find('.strip').exists()).toBe(false)
  })

  it('collapses items past maxItems into a +N counter', () => {
    const wrapper = mount(ActionStrip, {
      props: {
        title: '需要处理',
        maxItems: 2,
        items: [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }]
      },
      global: { stubs }
    })
    expect(wrapper.text()).toContain('+2')
  })
})

describe('Sparkline', () => {
  it('builds a path with one point per non-empty value', () => {
    const wrapper = mount(Sparkline, { props: { data: [1, 4, 2, 8], width: 80, height: 40 } })
    // The first <path> is the filled area, the second one is the line itself.
    const line = wrapper.findAll('path')[1]
    expect(line.exists()).toBe(true)
    const d = line.attributes('d') ?? ''
    expect(d.startsWith('M')).toBe(true)
    expect(d.match(/L/g)).toHaveLength(3)
  })

  it('falls back to an empty placeholder when there is nothing to draw', () => {
    const wrapper = mount(Sparkline, { props: { data: [0, 0] } })
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.find('.sparkline-empty').exists()).toBe(true)
  })
})
