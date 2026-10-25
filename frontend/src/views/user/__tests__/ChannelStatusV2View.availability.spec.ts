import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { coverage, health, metrics, row } from '@/features/channel-monitor-v2/__tests__/availabilityFixtures'
import ChannelStatusV2View from '../ChannelStatusV2View.vue'

const mocks = vi.hoisted(() => ({
  getDimensions: vi.fn(), getSnapshot: vi.fn(), getMatrix: vi.fn(), getModels: vi.fn(), getErrors: vi.fn(), getUsers: vi.fn(),
  replace: vi.fn(), showError: vi.fn(), admin: false,
}))
vi.mock('@/api/channelMonitorV2', () => mocks)
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ isAdmin: mocks.admin }) }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError: mocks.showError }) }))
vi.mock('@/utils/featureFlags', () => ({ isChannelMonitorThroughputHidden: () => true, isChannelMonitorUserRankingHidden: () => true }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }), useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key, locale: { value: 'en' } }),
}))
let wrapper: VueWrapper
async function view() {
  wrapper = mount(ChannelStatusV2View, { props: { embedded: true }, global: { stubs: {
    AvailabilityBoard: { name: 'AvailabilityBoard', props: ['rows', 'children', 'layout', 'loading'], template: '<div data-testid="board" />' },
    AvailabilityErrors: { name: 'AvailabilityErrors', props: ['rows'], template: '<div data-testid="errors" />' },
    AppLayout: { template: '<div><slot /></div>' },
    MonitorTrendChart: true, RelayPulseMatrix: true, FilterMultiSelect: true, MetricCell: true, Select: true,
  } } })
  await flushPromises()
  return wrapper
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.admin = false
  mocks.getDimensions.mockResolvedValue({ platforms: [{ value: 'deepseek', label: 'deepseek' }, { value: 'kimi', label: 'kimi' }], groups: [], models: [] })
  mocks.getSnapshot.mockResolvedValue({ coverage, metrics: metrics(), health: health(), config: { refresh_interval_seconds: 300 }, trend: [] })
  mocks.getMatrix.mockImplementation(async (_filter, groupBy) => ({ coverage, group_by: groupBy, items: [row(groupBy === 'platform_group_model' ? { model: 'deepseek-chat' } : {})] }))
  mocks.getErrors.mockResolvedValue({ items: [] })
  mocks.getModels.mockResolvedValue({ items: [] })
})
afterEach(() => wrapper?.unmount())
function button(text: string) { return wrapper.findAll('button').find(item => item.text() === text)! }

describe('V2 availability page', () => {
  it('defaults to 24h cards with separate server aggregates and children, preserving user privacy', async () => {
    await view()
    expect(mocks.getMatrix).toHaveBeenCalledWith(expect.objectContaining({ range: '24h' }), 'platform_group', false, expect.any(AbortSignal))
    expect(mocks.getMatrix).toHaveBeenCalledWith(expect.anything(), 'platform_group_model', false, expect.any(AbortSignal))
    expect(wrapper.findComponent({ name: 'AvailabilityBoard' }).props('children')[0].model).toBe('deepseek-chat')
    expect(wrapper.text()).toContain('DeepSeek')
    expect(mocks.getUsers).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('channelMonitorV2.tabs.users')
    expect(mocks.getErrors).toHaveBeenCalledOnce()
    await button('channelMonitorV2.availability.list').trigger('click')
    expect(wrapper.findComponent({ name: 'AvailabilityBoard' }).props('layout')).toBe('list')
  })
  it('keeps provider choices visible after selecting DeepSeek and uses admin APIs for embedded admins', async () => {
    mocks.admin = true
    await view()
    expect(mocks.getSnapshot).toHaveBeenCalledWith(expect.anything(), true, expect.any(AbortSignal))
    await button('DeepSeek').trigger('click')
    await flushPromises()
    expect(mocks.getSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ platforms: ['deepseek'] }), true, expect.any(AbortSignal))
    expect(button('Kimi').exists()).toBe(true)
    await button('channelMonitorV2.availability.manageProviders').trigger('click')
    expect(wrapper.emitted('settings')).toHaveLength(1)
  })
  it('does not let a slow old filter response replace the latest cards', async () => {
    await view()
    let finishOld!: (value: unknown) => void
    mocks.getMatrix.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    await button('DeepSeek').trigger('click')
    await flushPromises()
    await button('Kimi').trigger('click')
    await flushPromises()
    finishOld({ coverage, items: [row({ group_name: 'stale result' })] })
    await flushPromises()
    const rows = wrapper.findComponent({ name: 'AvailabilityBoard' }).props('rows')
    expect(rows[0].group_name).not.toBe('stale result')
    expect(mocks.showError).not.toHaveBeenCalled()
  })
})
