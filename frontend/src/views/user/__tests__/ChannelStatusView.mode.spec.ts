import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, onUnmounted } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

const mocks = vi.hoisted(() => ({ v1: false, admin: false, serviceUnmounted: vi.fn() }))

vi.mock('@/utils/featureFlags', () => ({ isChannelMonitorV1Mode: () => mocks.v1 }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ isAdmin: mocks.admin }) }))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('../ChannelStatusV1View.vue', () => ({
  default: defineComponent({ name: 'ChannelStatusV1View', setup: () => () => h('div', { 'data-testid': 'v1' }) }),
}))
vi.mock('../ServiceStatusView.vue', () => ({
  default: defineComponent({
    name: 'ServiceStatusView', props: { embedded: Boolean },
    setup() {
      onUnmounted(mocks.serviceUnmounted)
      return () => h('div', { 'data-testid': 'service' })
    },
  }),
}))
vi.mock('../ChannelStatusV2View.vue', () => ({
  default: defineComponent({ name: 'ChannelStatusV2View', props: { embedded: Boolean, syncRoute: Boolean }, setup: () => () => h('div', { 'data-testid': 'user-availability' }) }),
}))
vi.mock('@/features/channel-monitor-v2/AdminMonitorBoard.vue', () => ({
  default: defineComponent({
    name: 'AdminMonitorBoard', setup: () => () => h('div', { 'data-testid': 'admin-availability' }),
  }),
}))

import ChannelStatusView from '../ChannelStatusView.vue'

let wrapper: VueWrapper
let router: Router
async function view(url = '/monitor') {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/monitor', component: ChannelStatusView },
      { path: '/admin/channels/monitor', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  wrapper = mount(ChannelStatusView, {
    global: { plugins: [router], stubs: { AppLayout: { name: 'AppLayout', template: '<main data-testid="layout"><slot /></main>' } } },
  })
  await flushPromises()
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.v1 = false
  mocks.admin = false
})
afterEach(() => wrapper?.unmount())

describe('ChannelStatusView service status', () => {
  it('shows embedded service status inside one layout without display tabs', async () => {
    await view()
    expect(wrapper.find('[data-testid="service"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ServiceStatusView' }).props('embedded')).toBe(true)
    expect(wrapper.findAll('[data-testid="layout"]')).toHaveLength(1)
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(wrapper.find('[role="tab"]').exists()).toBe(false)
    expect(wrapper.find('[role="tabpanel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="admin-availability"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="user-availability"]').exists()).toBe(false)
    expect(wrapper.find('a[href^="/admin/"]').exists()).toBe(false)
  })

  it.each([false, true])('shows service status for old availability links (admin: %s)', async (admin) => {
    mocks.admin = admin
    await view('/monitor?view=availability&range=7d')
    expect(wrapper.find('[data-testid="service"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="layout"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="user-availability"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="admin-availability"]').exists()).toBe(false)
    expect(wrapper.find('[role="tab"]').exists()).toBe(false)
    expect(wrapper.find('a[href^="/admin/"]').exists()).toBe(false)
    expect(router.currentRoute.value.query).toEqual({ view: 'availability', range: '7d' })
  })

  it('keeps service status mounted across old view queries and browser history', async () => {
    await view('/monitor?range=7d&dimension=platform')
    await router.push('/monitor?view=availability&range=30d&dimension=group')
    expect(wrapper.find('[data-testid="service"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="user-availability"]').exists()).toBe(false)
    await new Promise<void>(resolve => {
      const remove = router.afterEach(() => { remove(); resolve() })
      router.back()
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="service"]').exists()).toBe(true)
    expect(router.currentRoute.value.query).toEqual({ range: '7d', dimension: 'platform' })
    expect(mocks.serviceUnmounted).not.toHaveBeenCalled()
  })

  it.each(['unknown', 'availability&view=service'])('ignores unsupported display queries: %s', async (query) => {
    await view(`/monitor?view=${query}`)
    expect(wrapper.find('[data-testid="service"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="admin-availability"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="user-availability"]').exists()).toBe(false)
  })

  it.each([false, true])('keeps the display free of configuration actions (admin: %s)', async (admin) => {
    mocks.admin = admin
    await view()
    expect(wrapper.find('a[href^="/admin/"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('channelMonitorV2.operations.settings')
    expect(wrapper.find('[data-testid="layout"]').element.children).toHaveLength(1)
    expect(wrapper.find('[data-testid="layout"]').element.firstElementChild?.getAttribute('data-testid')).toBe('service')
  })

  it('preserves the V1 page without mounting V2 views', async () => {
    mocks.v1 = true
    await view('/monitor?view=availability')
    expect(wrapper.find('[data-testid="v1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="service"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="admin-availability"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="user-availability"]').exists()).toBe(false)
  })
})
