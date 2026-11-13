import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, onUnmounted } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

const mocks = vi.hoisted(() => ({
  v2Mode: true,
  probesEnabled: false,
  probeItems: [] as unknown[],
  probeListFails: false,
  serviceUnmounted: vi.fn(),
  v1Unmounted: vi.fn(),
}))

vi.mock('@/utils/featureFlags', () => ({
  isChannelMonitorV2Mode: () => mocks.v2Mode,
  isChannelMonitorProbesEnabled: () => mocks.probesEnabled,
}))
vi.mock('@/api/channelMonitor', () => ({
  list: () => {
    if (mocks.probeListFails) return Promise.reject(new Error('probe list failed'))
    return Promise.resolve({ items: mocks.probeItems })
  },
}))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('../ChannelStatusV1View.vue', () => ({
  default: defineComponent({
    name: 'ChannelStatusV1View',
    props: { embedded: Boolean },
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
  mocks.v2Mode = true
  mocks.probesEnabled = false
  mocks.probeItems = []
  mocks.probeListFails = false
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
    mocks.v2Mode = false
    mocks.probesEnabled = true
    mocks.probeItems = [{ id: 1 }]
    await view()
    expect(wrapper.find('[data-testid="probes"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="traffic"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="status-tabs"]').exists()).toBe(false)
  })

  it('offers both tabs when aggregation and probes both run, defaulting to traffic', async () => {
    mocks.probesEnabled = true
    mocks.probeItems = [{ id: 1 }]
    await view()
    expect(tabValues()).toEqual(['traffic', 'probes'])
    expect(wrapper.find('[data-testid="traffic"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="probes"]').exists()).toBe(false)
  })

  it('switches to the probe tab on click without remounting the layout', async () => {
    mocks.probesEnabled = true
    mocks.probeItems = [{ id: 1 }]
    await view()
    await wrapper.get('[data-status-tab="probes"]').trigger('click')
    expect(wrapper.find('[data-testid="probes"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="traffic"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="layout"]')).toHaveLength(1)
  })

  it('hides the probe tab when the site has no probes', async () => {
    mocks.probesEnabled = true
    mocks.probeItems = []
    await view()
    expect(wrapper.find('[data-testid="status-tabs"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="traffic"]').exists()).toBe(true)
  })

  it('keeps the passive view working when the probe count request fails', async () => {
    mocks.probesEnabled = true
    mocks.probeListFails = true
    await view()
    expect(wrapper.find('[data-testid="traffic"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="status-tabs"]').exists()).toBe(false)
  })

  it('does not fetch probes at all when the switch is off', async () => {
    await view()
    expect(wrapper.find('[data-testid="status-tabs"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="traffic"]').exists()).toBe(true)
  })
})
