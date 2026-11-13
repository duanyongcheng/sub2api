import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, onUnmounted, reactive } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

const mocks = vi.hoisted(() => ({
  flags: { v2Mode: true, probesEnabled: false },
  probeItems: [] as unknown[],
  probeListFails: false,
  list: vi.fn(),
  serviceUnmounted: vi.fn(),
  v1Unmounted: vi.fn(),
}))

vi.mock('@/utils/featureFlags', () => ({
  isChannelMonitorV2Mode: () => mocks.flags.v2Mode,
  isChannelMonitorProbesEnabled: () => mocks.flags.probesEnabled,
}))
vi.mock('@/api/channelMonitor', () => ({
  list: mocks.list,
}))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('../ChannelStatusV1View.vue', () => ({
  default: defineComponent({
    name: 'ChannelStatusV1View',
    props: { embedded: Boolean },
    emits: ['loaded'],
    setup() {
      onUnmounted(mocks.v1Unmounted)
      return () => h('div', { 'data-testid': 'probes' })
    },
  }),
}))
vi.mock('../ServiceStatusView.vue', () => ({
  default: defineComponent({
    name: 'ServiceStatusView',
    props: { embedded: Boolean },
    emits: ['refresh'],
    setup() {
      onUnmounted(mocks.serviceUnmounted)
      return () => h('div', { 'data-testid': 'traffic' })
    },
  }),
}))

import ChannelStatusView from '../ChannelStatusView.vue'

let wrapper: VueWrapper
let router: Router

async function view() {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/monitor', component: ChannelStatusView }],
  })
  await router.push('/monitor')
  wrapper = mount(ChannelStatusView, {
    global: {
      plugins: [router],
      stubs: { AppLayout: { name: 'AppLayout', template: '<main data-testid="layout"><slot /></main>' } },
    },
  })
  await flushPromises()
}

const tabValues = () =>
  wrapper.findAll('[data-status-tab]').map((node) => node.attributes('data-status-tab'))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.flags = reactive({ v2Mode: true, probesEnabled: false })
  mocks.probeItems = []
  mocks.probeListFails = false
  mocks.list.mockReset().mockImplementation(() => {
    if (mocks.probeListFails) return Promise.reject(new Error('probe list failed'))
    return Promise.resolve({ items: mocks.probeItems })
  })
})
afterEach(() => wrapper?.unmount())

describe('ChannelStatusView status tabs', () => {
  it('shows only real traffic when probes are off, with no tab bar', async () => {
    await view()
    expect(wrapper.find('[data-testid="traffic"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="probes"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="status-tabs"]').exists()).toBe(false)
  })

  it('shows only probes in v1 mode, with no tab bar', async () => {
    mocks.flags.v2Mode = false
    mocks.flags.probesEnabled = true
    mocks.probeItems = [{ id: 1 }]
    await view()
    expect(wrapper.find('[data-testid="probes"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="traffic"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="status-tabs"]').exists()).toBe(false)
  })

  it('offers both tabs when aggregation and probes both run, defaulting to traffic', async () => {
    mocks.flags.probesEnabled = true
    mocks.probeItems = [{ id: 1 }]
    await view()
    expect(tabValues()).toEqual(['traffic', 'probes'])
    expect(wrapper.find('[data-testid="traffic"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="probes"]').exists()).toBe(false)
  })

  it('switches to the probe tab on click without remounting the layout', async () => {
    mocks.flags.probesEnabled = true
    mocks.probeItems = [{ id: 1 }]
    await view()
    await wrapper.get('[data-status-tab="probes"]').trigger('click')
    expect(wrapper.find('[data-testid="probes"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="traffic"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="layout"]')).toHaveLength(1)
  })

  it('hides the probe tab when the site has no probes', async () => {
    mocks.flags.probesEnabled = true
    mocks.probeItems = []
    await view()
    expect(wrapper.find('[data-testid="status-tabs"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="traffic"]').exists()).toBe(true)
  })

  it('keeps the passive view working when the probe count request fails', async () => {
    mocks.flags.probesEnabled = true
    mocks.probeListFails = true
    await view()
    expect(wrapper.find('[data-testid="traffic"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="status-tabs"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="probe-list-error"]').attributes('role')).toBe('alert')
    mocks.probeListFails = false
    mocks.probeItems = [{ id: 1 }]
    await wrapper.get('[data-testid="probe-list-retry"]').trigger('click')
    await flushPromises()
    expect(tabValues()).toEqual(['traffic', 'probes'])
    expect(wrapper.find('[data-testid="probe-list-error"]').exists()).toBe(false)
  })

  it('does not fetch probes at all when the switch is off', async () => {
    await view()
    expect(wrapper.find('[data-testid="status-tabs"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="traffic"]').exists()).toBe(true)
    expect(mocks.list).not.toHaveBeenCalled()
  })

  it('refreshes probe availability through the traffic page refresh without remounting', async () => {
    mocks.flags.probesEnabled = true
    await view()
    expect(tabValues()).toEqual([])
    mocks.probeItems = [{ id: 1 }]
    wrapper.findComponent({ name: 'ServiceStatusView' }).vm.$emit('refresh')
    await flushPromises()
    expect(tabValues()).toEqual(['traffic', 'probes'])
    expect(mocks.list).toHaveBeenCalledTimes(2)
    expect(mocks.serviceUnmounted).not.toHaveBeenCalled()
  })

  it('loads probes when settings arrive and discards a request after probes are disabled', async () => {
    await view()
    let finish!: (value: { items: unknown[] }) => void
    mocks.list.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    mocks.flags.probesEnabled = true
    await flushPromises()
    expect(mocks.list).toHaveBeenCalledOnce()
    const signal = mocks.list.mock.calls[0][0].signal as AbortSignal
    mocks.flags.probesEnabled = false
    await flushPromises()
    expect(signal.aborted).toBe(true)
    finish({ items: [{ id: 1 }] })
    await flushPromises()
    expect(tabValues()).toEqual([])
    expect(wrapper.find('[data-testid="probe-list-error"]').exists()).toBe(false)
  })

  it('deduplicates an in-flight probe count and aborts it when the page is left', async () => {
    mocks.flags.probesEnabled = true
    let finish!: (value: { items: unknown[] }) => void
    mocks.list.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await view()
    expect(wrapper.get('[data-testid="probe-list-loading"]').attributes('role')).toBe('status')
    wrapper.findComponent({ name: 'ServiceStatusView' }).vm.$emit('refresh')
    wrapper.findComponent({ name: 'ServiceStatusView' }).vm.$emit('refresh')
    await flushPromises()
    expect(mocks.list).toHaveBeenCalledOnce()
    const signal = mocks.list.mock.calls[0][0].signal as AbortSignal
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
    finish({ items: [{ id: 1 }] })
    await flushPromises()
  })

  it('keeps known probes reachable if a later list refresh fails', async () => {
    mocks.flags.probesEnabled = true
    mocks.probeItems = [{ id: 1 }]
    await view()
    mocks.probeListFails = true
    wrapper.findComponent({ name: 'ServiceStatusView' }).vm.$emit('refresh')
    await flushPromises()
    expect(tabValues()).toEqual(['traffic', 'probes'])
    expect(wrapper.find('[data-testid="probe-list-error"]').exists()).toBe(true)
  })

  it('falls back to real traffic when the active probe view reports an empty refreshed list', async () => {
    mocks.flags.probesEnabled = true
    mocks.probeItems = [{ id: 1 }]
    await view()
    await wrapper.get('[data-status-tab="probes"]').trigger('click')
    wrapper.findComponent({ name: 'ChannelStatusV1View' }).vm.$emit('loaded', 0)
    await flushPromises()
    expect(wrapper.find('[data-testid="probes"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="traffic"]').exists()).toBe(true)
    expect(tabValues()).toEqual([])
  })

  it('does not mount a disabled evidence source when neither source is available', async () => {
    mocks.flags.v2Mode = false
    await view()
    expect(wrapper.find('[data-testid="traffic"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="probes"]').exists()).toBe(false)
    expect(mocks.list).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('channelMonitorV2.statusTabs.noSources')
  })
})
