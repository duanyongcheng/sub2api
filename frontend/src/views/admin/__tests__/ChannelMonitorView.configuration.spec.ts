import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import ChannelMonitorView from '../ChannelMonitorView.vue'

const mocks = vi.hoisted(() => ({ v1: false, probes: false, list: vi.fn() }))
vi.mock('@/utils/featureFlags', () => ({
  isChannelMonitorV1Mode: () => mocks.v1,
  isChannelMonitorProbesEnabled: () => mocks.probes,
}))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError: vi.fn(), showSuccess: vi.fn() }) }))
vi.mock('@/api/admin', () => ({ adminAPI: { channelMonitor: { list: mocks.list } } }))
vi.mock('@/features/channel-monitor-v2/MonitorSettingsPanel.vue', () => ({
  default: { name: 'MonitorSettingsPanel', template: '<div data-testid="v2-settings" />' },
}))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key }),
}))

let wrapper: VueWrapper
let router: Router
async function view(url = '/admin/channels/monitor') {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/channels/monitor', component: ChannelMonitorView },
      { path: '/monitor', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  wrapper = mount(ChannelMonitorView, { global: {
    plugins: [router],
    stubs: {
      AppLayout: { template: '<main><slot /></main>' },
      TablePageLayout: { template: '<section data-testid="probe-management"><slot name="filters" /><slot name="table" /><slot name="pagination" /></section>' },
      DataTable: true, MonitorFiltersBar: true, Pagination: true, ConfirmDialog: true,
      MonitorFormDialog: true, MonitorTemplateManagerDialog: true, MonitorRunResultDialog: true,
    },
  } })
  await flushPromises()
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.v1 = false
  mocks.probes = false
  mocks.list.mockResolvedValue({ items: [], total: 0 })
})
afterEach(() => wrapper?.unmount())

describe('ChannelMonitorView configuration only', () => {
  it.each([false, true])('describes probe activity independently in V2 (probes: %s)', async (probes) => {
    mocks.probes = probes
    await view()
    expect(wrapper.findAll('[role="tab"]')[1].text()).toBe(
      probes ? 'channelMonitorV2.admin.tabV1Active' : 'channelMonitorV2.admin.tabV1History',
    )
    expect(wrapper.text()).toContain(
      probes ? 'channelMonitorV2.admin.probesActive' : 'channelMonitorV2.admin.probesInactive',
    )
  })

  it('does not describe disabled probes as active in V1', async () => {
    mocks.v1 = true
    await view()
    expect(wrapper.findAll('[role="tab"]')[1].text()).toBe('channelMonitorV2.admin.tabV1History')
    expect(wrapper.text()).toContain('channelMonitorV2.admin.probesInactive')
  })
  it('defaults V2 to configuration with no availability board or probe request', async () => {
    await view()
    expect(wrapper.find('[data-testid="v2-settings"]').exists()).toBe(true)
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="admin-monitor-board"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('channelMonitorV2.availability.title')
    expect(mocks.list).not.toHaveBeenCalled()
    expect(wrapper.find('a').attributes('href')).toBe('/monitor')
  })

  it('opens probe management from a deep link and follows same-route config links', async () => {
    await view('/admin/channels/monitor?tab=legacy')
    expect(wrapper.find('[data-testid="probe-management"]').exists()).toBe(true)
    expect(mocks.list).toHaveBeenCalledOnce()
    await router.push('/admin/channels/monitor?tab=v2')
    expect(wrapper.find('[data-testid="v2-settings"]').exists()).toBe(true)
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.tab).toBe('legacy')
  })

  it('preserves V1 probe management as the default and links to V1 status', async () => {
    mocks.v1 = true
    await view()
    expect(wrapper.find('[data-testid="probe-management"]').exists()).toBe(true)
    expect(mocks.list).toHaveBeenCalledOnce()
    expect(wrapper.find('a').attributes('href')).toBe('/monitor')
  })

  it('uses the mode default for an invalid tab', async () => {
    await view('/admin/channels/monitor?tab=availability')
    expect(wrapper.find('[data-testid="v2-settings"]').exists()).toBe(true)
  })
})
