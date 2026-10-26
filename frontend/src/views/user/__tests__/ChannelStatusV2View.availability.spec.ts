import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { coverage, health, metrics, row } from '@/features/channel-monitor-v2/__tests__/availabilityFixtures'
import FilterMultiSelect from '@/features/channel-monitor-v2/FilterMultiSelect.vue'
import ChannelStatusV2View from '../ChannelStatusV2View.vue'

const mocks = vi.hoisted(() => ({
  getDimensions: vi.fn(), getSnapshot: vi.fn(), getMatrix: vi.fn(), getModels: vi.fn(), getErrors: vi.fn(), getUsers: vi.fn(),
  replace: vi.fn(), showError: vi.fn(), admin: false, query: {} as Record<string, string>,
}))
vi.mock('@/api/channelMonitorV2', () => mocks)
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ isAdmin: mocks.admin }) }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError: mocks.showError }) }))
vi.mock('@/utils/featureFlags', () => ({ isChannelMonitorThroughputHidden: () => true, isChannelMonitorUserRankingHidden: () => true }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: mocks.query }), useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key, locale: { value: 'en' } }),
}))
let wrapper: VueWrapper
async function view(embedded = true) {
  wrapper = mount(ChannelStatusV2View, { props: { embedded }, global: { stubs: {
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
  mocks.query = {}
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
    expect(mocks.getModels).toHaveBeenCalledOnce()
    expect(mocks.getErrors).not.toHaveBeenCalled()
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
  it('keeps cards visible during silent refreshes instead of flashing skeletons', async () => {
    await view()
    mocks.getMatrix.mockImplementationOnce(() => new Promise(() => {}))
    await button('DeepSeek').trigger('click')
    await flushPromises()
    const board = wrapper.findComponent({ name: 'AvailabilityBoard' })
    expect(board.props('loading')).toBe(false)
    expect(board.attributes('aria-busy')).toBe('true')
  })
  it('keeps embedded state off the host URL but syncs the standalone user page', async () => {
    mocks.query = { range: '7d', tab: 'errors' }
    await view()
    expect(mocks.getMatrix).toHaveBeenCalledWith(expect.objectContaining({ range: '24h' }), 'platform_group', false, expect.any(AbortSignal))
    expect(mocks.getErrors).not.toHaveBeenCalled()
    await button('DeepSeek').trigger('click')
    await flushPromises()
    expect(mocks.replace).not.toHaveBeenCalled()
    wrapper.unmount()

    await view(false)
    expect(mocks.getMatrix).toHaveBeenLastCalledWith(expect.objectContaining({ range: '7d' }), expect.anything(), false, expect.any(AbortSignal))
    expect(mocks.getErrors).toHaveBeenCalledOnce()
    await button('DeepSeek').trigger('click')
    await flushPromises()
    expect(mocks.replace).toHaveBeenCalledWith({ query: expect.objectContaining({ platform: 'deepseek', range: '7d' }) })
  })
  it('labels group and model options with provider names', async () => {
    mocks.getDimensions.mockResolvedValue({
      platforms: [{ value: 'deepseek', label: 'deepseek' }, { value: 'kimi', label: 'kimi' }],
      groups: [{ id: 7, name: 'DS', platform: 'deepseek' }],
      models: [{ value: 'moonshot-v1', label: 'moonshot-v1', platform: 'kimi' }, { value: 'Kimi-K2', label: 'Kimi-K2', platform: 'kimi' }],
    })
    await view()
    const [groups, models] = wrapper.findAllComponents(FilterMultiSelect)
    expect(groups.props('options')).toEqual([{ value: '7', label: 'DeepSeek / DS' }])
    expect(models.props('options').map((item: { label: string }) => item.label)).toEqual(['Kimi / moonshot-v1', 'Kimi-K2'])
  })
})
