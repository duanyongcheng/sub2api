import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import type { ChannelMonitor, RunNowResponse } from '@/api/admin/channelMonitor'
import MonitorActionsCell from '@/components/admin/monitor/MonitorActionsCell.vue'
import MonitorRunResultDialog from '@/components/admin/monitor/MonitorRunResultDialog.vue'
import ChannelMonitorView from '../ChannelMonitorView.vue'

const mocks = vi.hoisted(() => ({
  v1: false,
  probes: false,
  list: vi.fn(),
  runNow: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))
vi.mock('@/utils/featureFlags', () => ({
  isChannelMonitorV1Mode: () => mocks.v1,
  isChannelMonitorProbesEnabled: () => mocks.probes,
}))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError: mocks.showError, showSuccess: mocks.showSuccess }) }))
vi.mock('@/api/admin', () => ({ adminAPI: { channelMonitor: { list: mocks.list, runNow: mocks.runNow } } }))
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
      DataTable: {
        props: ['data'],
        template: '<div><div v-for="row in data" :key="row.id"><slot name="cell-actions" :row="row" /></div></div>',
      },
      MonitorFiltersBar: true, Pagination: true, ConfirmDialog: true,
      MonitorFormDialog: true, MonitorTemplateManagerDialog: true, MonitorRunResultDialog: true,
    },
  } })
  await flushPromises()
}
beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
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

const monitor: ChannelMonitor = {
  id: 42,
  name: 'primary',
  provider: 'openai',
  api_mode: 'chat_completions',
  endpoint: 'https://api.example.com',
  api_key_masked: 'sk-t***',
  primary_model: 'gpt-4o-mini',
  extra_models: ['extra-model'],
  group_name: '',
  enabled: true,
  interval_seconds: 60,
  jitter_seconds: 0,
  last_checked_at: null,
  created_by: 1,
  created_at: '2026-07-16T00:00:00Z',
  updated_at: '2026-07-16T00:00:00Z',
  primary_status: '',
  primary_latency_ms: null,
  availability_7d: 0,
  extra_models_status: [],
  template_id: null,
  extra_headers: {},
  body_override_mode: 'off',
  body_override: null,
  check_mode: 'quota_probe',
  account_id: 7,
}
const runResponse: RunNowResponse = {
  results: [
    {
      model: 'gpt-4o-mini',
      status: 'operational',
      latency_ms: 120,
      ping_latency_ms: 20,
      message: '',
      checked_at: '2026-07-16T01:00:00Z',
      quota: { source: 'usage', success: true, fetched_at: '2026-07-16T01:00:00Z' },
    },
    {
      model: 'extra-model',
      status: 'failed',
      latency_ms: null,
      ping_latency_ms: 20,
      message: 'mock upstream rejection',
      checked_at: '2026-07-16T01:00:00Z',
    },
  ],
}

function runButton(index = 0) {
  return wrapper.findAllComponents(MonitorActionsCell)[index].findAll('button').find(
    button => button.text() === 'admin.channelMonitor.runNow',
  )!
}

// Exercise the real actions cell through the table slot, with only HTTP and
// surrounding layout/dialog components stubbed.
describe('ChannelMonitorView immediate checks', () => {
  beforeEach(() => {
    mocks.probes = true
    mocks.list.mockResolvedValue({ items: [monitor], total: 1 })
    mocks.runNow.mockResolvedValue(runResponse)
  })

  it.each([false, true])('runs when probes are enabled (V1: %s) and preserves every result', async (v1) => {
    mocks.v1 = v1
    await view('/admin/channels/monitor?tab=legacy')
    await runButton().trigger('click')
    await flushPromises()

    expect(mocks.runNow).toHaveBeenCalledOnce()
    expect(mocks.runNow).toHaveBeenCalledWith(42)
    const dialog = wrapper.findComponent(MonitorRunResultDialog)
    expect(dialog.props('show')).toBe(true)
    expect(dialog.props('results')).toEqual(runResponse.results)
    expect(mocks.showSuccess).toHaveBeenCalledWith('admin.channelMonitor.runSuccess')
    expect(mocks.showError).not.toHaveBeenCalled()
    expect(mocks.list).toHaveBeenCalledTimes(2)
    expect(wrapper.findComponent(MonitorActionsCell).props('running')).toBe(false)
  })

  it.each([false, true])('rejects a run when effective probes are disabled (V1: %s)', async (v1) => {
    mocks.v1 = v1
    mocks.probes = false
    await view('/admin/channels/monitor?tab=legacy')
    await runButton().trigger('click')
    await flushPromises()

    expect(mocks.runNow).not.toHaveBeenCalled()
    expect(mocks.showError).toHaveBeenCalledOnce()
    expect(mocks.showError).toHaveBeenCalledWith('admin.channelMonitor.runFailed')
    expect(mocks.showSuccess).not.toHaveBeenCalled()
    expect(wrapper.findComponent(MonitorRunResultDialog).props('show')).toBe(false)
    expect(mocks.list).toHaveBeenCalledOnce()
  })

  it.each([
    [{ status: 502, message: 'mock upstream unavailable' }, 'mock upstream unavailable'],
    [{ status: 500 }, 'admin.channelMonitor.runFailed'],
  ])('reports a rejected run (%j), keeps results closed, and permits retry', async (error, message) => {
    mocks.runNow.mockRejectedValueOnce(error)
    await view('/admin/channels/monitor?tab=legacy')
    await runButton().trigger('click')
    await flushPromises()

    expect(mocks.runNow).toHaveBeenCalledOnce()
    expect(mocks.runNow).toHaveBeenCalledWith(42)
    expect(mocks.showError).toHaveBeenCalledOnce()
    expect(mocks.showError).toHaveBeenCalledWith(message)
    expect(mocks.showSuccess).not.toHaveBeenCalled()
    expect(wrapper.findComponent(MonitorRunResultDialog).props('show')).toBe(false)
    expect(wrapper.findComponent(MonitorActionsCell).props('running')).toBe(false)
    expect(mocks.list).toHaveBeenCalledOnce()

    await runButton().trigger('click')
    await flushPromises()
    expect(mocks.runNow).toHaveBeenCalledTimes(2)
    expect(wrapper.findComponent(MonitorRunResultDialog).props('results')).toEqual(runResponse.results)
    expect(wrapper.findComponent(MonitorRunResultDialog).props('show')).toBe(true)
  })

  it('prevents same-row and cross-row duplicate requests while a check is pending', async () => {
    let resolveRun!: (response: RunNowResponse) => void
    mocks.runNow.mockImplementationOnce(() => new Promise<RunNowResponse>(resolve => { resolveRun = resolve }))
    mocks.list.mockResolvedValue({ items: [monitor, { ...monitor, id: 43 }], total: 2 })
    await view('/admin/channels/monitor?tab=legacy')

    // Same-tick events also exercise the handler guard before disabled props update.
    const actions = wrapper.findAllComponents(MonitorActionsCell)
    actions[0].vm.$emit('run', monitor)
    actions[0].vm.$emit('run', monitor)
    await wrapper.vm.$nextTick()
    await runButton(1).trigger('click')

    expect(mocks.runNow).toHaveBeenCalledOnce()
    expect(mocks.runNow).toHaveBeenCalledWith(42)
    expect(actions[0].props('running')).toBe(true)
    expect(runButton().attributes('disabled')).toBeDefined()
    expect(wrapper.findComponent(MonitorRunResultDialog).props('show')).toBe(false)

    resolveRun(runResponse)
    await flushPromises()
    expect(wrapper.findComponent(MonitorActionsCell).props('running')).toBe(false)
    expect(runButton().attributes('disabled')).toBeUndefined()
    expect(wrapper.findComponent(MonitorRunResultDialog).props('results')).toEqual(runResponse.results)

    await runButton(1).trigger('click')
    await flushPromises()
    expect(mocks.runNow).toHaveBeenCalledTimes(2)
    expect(mocks.runNow).toHaveBeenLastCalledWith(43)
  })
})
