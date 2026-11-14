import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import type { MonitorFilter, MonitorMatrixGroupBy, MonitorModelRow, MonitorSnapshot } from '@/api/channelMonitorV2'
import { coverage, health, metrics, row } from '@/features/channel-monitor-v2/__tests__/availabilityFixtures'
import ServiceModelRanking from '@/features/channel-monitor-v2/ServiceModelRanking.vue'
import ServiceErrorDistribution from '@/features/channel-monitor-v2/ServiceErrorDistribution.vue'
import Select from '@/components/common/Select.vue'
import ServiceStatusView from '../ServiceStatusView.vue'

const mocks = vi.hoisted(() => ({
  getSnapshot: vi.fn(), getMatrix: vi.fn(), getModels: vi.fn(), getErrors: vi.fn(), getDimensions: vi.fn(), getUsers: vi.fn(),
  replace: vi.fn(), auth: { isAdmin: false }, hideThroughput: true, hidden: false,
  query: {} as Record<string, string | string[] | undefined>,
}))
vi.mock('@/api/channelMonitorV2', () => mocks)
vi.mock('@/stores/auth', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/utils/featureFlags', () => ({ isChannelMonitorThroughputHidden: () => mocks.hideThroughput }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: mocks.query }), useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string, params?: Record<string, unknown>) => key.endsWith('Desc') || key.endsWith('selectedModel') ? `${key} ${JSON.stringify(params)}` : key, te: () => true, locale: { value: 'en' } }),
}))

let wrapper: VueWrapper
function payload(overrides: Partial<MonitorSnapshot> = {}): MonitorSnapshot {
  return { config: { refresh_interval_seconds: 300 } as MonitorSnapshot['config'], coverage, metrics: metrics(), health: health(), trend: [], ...overrides }
}
function model(platform = 'deepseek', name = 'deepseek-chat', errorRate = 0.05, errors = 10): MonitorModelRow {
  return { platform, model: name, metrics: { ...metrics(errorRate), error_requests: errors }, health: health(errorRate >= 0.1 ? 'critical' : 'warning') }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(finish => { resolve = finish })
  return { promise, resolve }
}
async function view(embedded = false) {
  wrapper = mount(ServiceStatusView, { props: { embedded }, global: { stubs: {
    AppLayout: { template: '<div data-testid="service-layout"><slot /></div>' },
    MonitorTrendChart: { name: 'MonitorTrendChart', props: { trend: Array, coverage: Object, loading: Boolean, operations: Boolean, compact: Boolean }, template: '<section data-testid="chart" />' },
    AvailabilityBoard: { name: 'AvailabilityBoard', props: ['rows', 'children', 'coverage', 'layout', 'loading'], template: '<section data-testid="availability-board" />' },
  } } })
  await flushPromises()
  return wrapper
}
async function platforms(values: string[]) {
  const changes = wrapper.findAll('[data-service-platform]').filter(button => button.attributes('data-service-platform') !== 'all' && (button.attributes('aria-pressed') === 'true') !== values.includes(button.attributes('data-service-platform')))
  await Promise.all(changes.map(button => button.trigger('click')))
  await flushPromises()
}
async function grouping(value: MonitorMatrixGroupBy) {
  wrapper.findComponent(Select).vm.$emit('update:modelValue', value)
  await flushPromises()
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth = reactive({ isAdmin: false })
  mocks.hideThroughput = true
  mocks.hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => mocks.hidden })
  mocks.query = reactive({})
  mocks.replace.mockImplementation(async ({ query }) => {
    for (const key of Object.keys(mocks.query)) delete mocks.query[key]
    Object.assign(mocks.query, query)
  })
  mocks.getSnapshot.mockResolvedValue(payload())
  mocks.getMatrix.mockImplementation(async (_filter: MonitorFilter, groupBy: MonitorMatrixGroupBy) => ({
    coverage, group_by: groupBy,
    items: [row({
      group_id: groupBy.includes('group') ? 7 : undefined,
      group_name: groupBy.includes('group') ? 'DS 池' : undefined,
      model: groupBy.includes('model') ? 'deepseek-chat' : undefined,
    })],
  }))
  mocks.getModels.mockResolvedValue({ items: [] })
  mocks.getErrors.mockResolvedValue({ items: [] })
  mocks.getDimensions.mockResolvedValue({ platforms: [{ value: 'deepseek' }, { value: 'kimi' }], groups: [], models: [] })
})
afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
})

describe('Service status dashboard', () => {
  it('notifies the shell on initial, manual and automatic refresh without adding another timer', async () => {
    vi.useFakeTimers()
    await view()
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    await wrapper.get('[data-testid="service-refresh"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('refresh')).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(300_000)
    await flushPromises()
    expect(wrapper.emitted('refresh')).toHaveLength(3)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('defaults to compact group status with one scoped API role and no users requests', async () => {
    await view()
    expect(mocks.getMatrix).toHaveBeenCalledWith(expect.objectContaining({ range: '24h' }), 'platform_group', false, expect.any(AbortSignal))
    expect(wrapper.findAll('article[data-platform="deepseek"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('DS 池')
    expect(wrapper.find('[data-evidence="traffic"]').exists()).toBe(true)
    expect(wrapper.find('[data-service-layout="matrix"]').attributes('aria-pressed')).toBe('true')
    for (const method of [mocks.getSnapshot, mocks.getModels, mocks.getErrors, mocks.getDimensions]) {
      expect(method).toHaveBeenCalledWith(expect.anything(), false, expect.any(AbortSignal))
    }
    expect(mocks.getUsers).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-metric]')).toHaveLength(5)
    expect(wrapper.find('[data-testid="service-model-ranking"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="service-error-distribution"]').exists()).toBe(true)
  })

  it('uses admin APIs consistently and exposes throughput to administrators', async () => {
    mocks.auth.isAdmin = true
    await view(true)
    for (const method of [mocks.getSnapshot, mocks.getModels, mocks.getErrors, mocks.getDimensions]) {
      expect(method).toHaveBeenCalledWith(expect.anything(), true, expect.any(AbortSignal))
    }
    expect(mocks.getMatrix.mock.calls.every(call => call[2] === true)).toBe(true)
    expect(wrapper.findAll('[data-metric]')).toHaveLength(6)
    expect(wrapper.find('[data-testid="service-scope"]').text()).toBe('channelMonitorV2.dashboard.scopeAdmin')
    expect(wrapper.find('[data-testid="service-layout"]').exists()).toBe(false)
  })

  it('honors the user throughput privacy switch', async () => {
    mocks.hideThroughput = false
    await view()
    expect(wrapper.find('[data-metric="throughput"]').exists()).toBe(true)
    expect(mocks.getSnapshot).toHaveBeenCalledWith(expect.anything(), false, expect.any(AbortSignal))
  })

  it('never presents an unknown aggregate or scope as available', async () => {
    mocks.getSnapshot.mockResolvedValue(payload({ health: health('unknown') }))
    mocks.getMatrix.mockResolvedValue({ coverage, group_by: 'platform_group', items: [row({ metrics: metrics(0), health: health('unknown') })] })
    await view()
    expect(wrapper.find('[data-state="unknown"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('channelMonitorV2.service.unknownReason')
    expect(wrapper.find('[data-testid="service-availability"] .stat-value').text()).toBe('—')
  })

  it('keeps unjudged scopes out of the overall verdict and reports judged failures', async () => {
    mocks.getMatrix.mockResolvedValue({ coverage, group_by: 'platform_group', items: [
      row({ group_name: 'Healthy' }),
      row({ platform: 'kimi', group_id: 8, group_name: 'Unknown', metrics: metrics(0), health: health('unknown') }),
    ] })
    await view()
    expect(wrapper.findAll('article')).toHaveLength(2)
    expect(wrapper.find('[data-testid="service-verdict"]').text()).toBe('channelMonitorV2.service.bannerOk')
    mocks.getMatrix.mockResolvedValue({ coverage, group_by: 'platform_group', items: [row({ health: health('warning') })] })
    await wrapper.find('[data-testid="service-refresh"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="service-verdict"]').text()).toBe('channelMonitorV2.service.bannerWarn')
  })

  it.each(['platform', 'platform_group', 'platform_model', 'platform_group_model'] as const)('supports %s grouping with the appropriate expansion data', async (value) => {
    await view()
    mocks.getMatrix.mockClear()
    if (value === 'platform_group') await wrapper.find('[data-testid="service-refresh"]').trigger('click')
    else await grouping(value)
    await flushPromises()
    expect(mocks.getMatrix).toHaveBeenCalledWith(expect.anything(), value, false, expect.any(AbortSignal))
    expect(mocks.getMatrix).toHaveBeenCalledTimes(value === 'platform_group_model' ? 1 : 2)
    if (value !== 'platform_group_model') expect(mocks.getMatrix).toHaveBeenLastCalledWith(expect.anything(), value === 'platform' ? 'platform_model' : 'platform_group_model', false, expect.any(AbortSignal))
  })

  it('keeps the range-only platform catalog intact after platform filters change', async () => {
    await view()
    await platforms(['deepseek'])
    expect(mocks.getSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ platforms: ['deepseek'] }), false, expect.any(AbortSignal))
    expect(wrapper.find('[data-service-platform="deepseek"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-service-platform="kimi"]').exists()).toBe(true)
    expect(mocks.getDimensions).toHaveBeenCalledOnce()
    await wrapper.find('[data-service-range="7d"]').trigger('click')
    await flushPromises()
    for (const method of [mocks.getSnapshot, mocks.getModels, mocks.getErrors]) expect(method).toHaveBeenLastCalledWith(expect.objectContaining({ range: '7d', platforms: ['deepseek'] }), false, expect.any(AbortSignal))
    expect(mocks.getDimensions).toHaveBeenLastCalledWith({ range: '7d', platforms: [], groupIds: [], models: [] }, false, expect.any(AbortSignal))
  })

  it('switches all four layouts without refetching and mounts just one raw chart', async () => {
    await view()
    const requests = mocks.getSnapshot.mock.calls.length
    for (const layout of ['cards', 'list', 'trend', 'matrix']) {
      await wrapper.find(`[data-service-layout="${layout}"]`).trigger('click')
      await flushPromises()
      if (layout === 'cards' || layout === 'list') expect(wrapper.findComponent({ name: 'AvailabilityBoard' }).props('layout')).toBe(layout)
      expect(wrapper.findAllComponents({ name: 'MonitorTrendChart' })).toHaveLength(1)
      expect(wrapper.findComponent({ name: 'MonitorTrendChart' }).props('operations')).toBe(true)
      expect(mocks.getSnapshot).toHaveBeenCalledTimes(requests)
    }
    expect(mocks.query.layout).toBeUndefined()
    expect(mocks.query.group_by).toBeUndefined()
  })

  it('reads legacy dimensions and restores modern repeated filters while ignoring obsolete view', async () => {
    Object.assign(mocks.query, { range: '7d', dimension: 'platform', platform: ['deepseek,kimi', 'deepseek'], model: 'deepseek-chat', view: 'availability', layout: 'cards', keep: 'yes' })
    await view(true)
    expect(mocks.getMatrix).toHaveBeenCalledWith({ range: '7d', platforms: ['deepseek', 'kimi'], groupIds: [], models: ['deepseek-chat'] }, 'platform', false, expect.any(AbortSignal))
    expect(wrapper.findComponent({ name: 'AvailabilityBoard' }).props('layout')).toBe('cards')
    expect(mocks.replace).not.toHaveBeenCalled()
    await grouping('platform_model')
    expect(mocks.query).toMatchObject({ view: 'availability', keep: 'yes', group_by: 'platform_model' })
    expect(mocks.query.dimension).toBeUndefined()
  })

  it('follows URL back/forward-style filter and layout changes without writing over them', async () => {
    Object.assign(mocks.query, { range: '24h', dimension: 'group', view: 'availability', keep: 'yes' })
    await view(true)
    Object.assign(mocks.query, { range: '7d', platform: 'kimi', group_by: 'platform_model', layout: 'trend' })
    await flushPromises()
    expect(mocks.getSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ range: '7d', platforms: ['kimi'] }), false, expect.any(AbortSignal))
    expect(wrapper.find('[data-service-layout="trend"]').attributes('aria-pressed')).toBe('true')
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.query.keep).toBe('yes')
  })

  it('makes ranking selections visible and removable, and reset clears dimension filters', async () => {
    mocks.getModels.mockResolvedValue({ items: [model('kimi', 'Kimi-K2')] })
    await view()
    await wrapper.find('[data-model="Kimi-K2"]').trigger('click')
    await flushPromises()
    expect(mocks.getSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ platforms: ['kimi'], models: ['Kimi-K2'] }), false, expect.any(AbortSignal))
    expect(wrapper.find('[data-testid="service-selected-model"]').text()).toContain('Kimi-K2')
    expect(mocks.query.model).toBe('Kimi-K2')
    await wrapper.find('[data-testid="service-remove-model"]').trigger('click')
    await flushPromises()
    expect(mocks.getSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ platforms: ['kimi'], models: [] }), false, expect.any(AbortSignal))
    expect(wrapper.find('[data-testid="service-selected-model"]').exists()).toBe(false)
    await wrapper.find('[data-testid="service-reset"]').trigger('click')
    await flushPromises()
    expect(mocks.getSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ platforms: [], models: [] }), false, expect.any(AbortSignal))
  })

  it('embeds without adding a layout and keeps compact row expansion working', async () => {
    await view(true)
    expect(wrapper.find('[data-testid="service-layout"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="service-model-details"]').exists()).toBe(false)
    await wrapper.find('article button[aria-expanded]').trigger('click')
    expect(wrapper.find('[data-testid="service-model-details"]').text()).toContain('deepseek-chat')
  })

  it('keeps successful primary data when models, errors and the catalog fail, with independent retries', async () => {
    mocks.getModels.mockRejectedValueOnce(new Error('models unavailable'))
    mocks.getErrors.mockRejectedValueOnce(new Error('errors unavailable'))
    mocks.getDimensions.mockRejectedValueOnce(new Error('catalog unavailable'))
    await view()
    expect(wrapper.find('article').exists()).toBe(true)
    expect(wrapper.find('[data-testid="service-primary-error"]').exists()).toBe(false)
    expect(wrapper.findComponent(ServiceModelRanking).props('error')).toContain('models unavailable')
    expect(wrapper.findComponent(ServiceErrorDistribution).props('error')).toContain('errors unavailable')
    expect(wrapper.find('[data-testid="service-catalog-error"]').text()).toContain('catalog unavailable')
    const primaryCalls = mocks.getSnapshot.mock.calls.length
    wrapper.findComponent(ServiceModelRanking).vm.$emit('retry')
    wrapper.findComponent(ServiceErrorDistribution).vm.$emit('retry')
    await wrapper.find('[data-testid="service-catalog-error"] button').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(ServiceModelRanking).props('error')).toBe('')
    expect(wrapper.findComponent(ServiceErrorDistribution).props('error')).toBe('')
    expect(wrapper.find('[data-testid="service-catalog-error"]').exists()).toBe(false)
    expect(mocks.getSnapshot).toHaveBeenCalledTimes(primaryCalls)
  })

  it('does not wait for slow optional models before displaying the primary matrix', async () => {
    mocks.getModels.mockReturnValueOnce(new Promise(() => {}))
    await view()
    expect(wrapper.find('article').exists()).toBe(true)
    expect(wrapper.findComponent(ServiceModelRanking).props('loading')).toBe(true)
    expect(wrapper.find('[data-testid="service-dashboard-data"]').attributes('aria-busy')).toBe('true')
  })

  it('labels retained auxiliary rows while they refresh and hides them behind failures', async () => {
    mocks.getModels.mockResolvedValueOnce({ items: [model()] })
    mocks.getErrors.mockResolvedValueOnce({ items: [{ category: 'timeout', count: 0, rate: 1 }] })
    await view()
    const oldModels = deferred<{ items: MonitorModelRow[] }>()
    mocks.getModels.mockReturnValueOnce(oldModels.promise)
    mocks.getErrors.mockReturnValueOnce(new Promise(() => {}))
    await platforms(['kimi'])
    expect(wrapper.find('[data-testid="service-models-updating"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="service-errors-updating"]').exists()).toBe(true)
    expect(wrapper.findComponent(ServiceModelRanking).props('loading')).toBe(true)
    expect(wrapper.findComponent(ServiceErrorDistribution).props('loading')).toBe(true)
    oldModels.resolve({ items: [model('kimi', 'new-model')] })
    await flushPromises()
    expect(wrapper.find('[data-testid="service-models-updating"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="service-errors-updating"]').exists()).toBe(true)
  })

  it('preserves rows during filter refresh and marks retained data as updating', async () => {
    await view()
    mocks.getSnapshot.mockReturnValueOnce(new Promise(() => {}))
    await platforms(['kimi'])
    expect(wrapper.find('article').exists()).toBe(true)
    expect(wrapper.find('[data-testid="service-skeleton"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="service-refreshing"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="service-stale-scope"]').exists()).toBe(true)
  })

  it('rejects stale primary and optional responses after a faster filter request', async () => {
    await view()
    const oldSnapshot = deferred<MonitorSnapshot>()
    const oldModels = deferred<{ items: MonitorModelRow[] }>()
    mocks.getSnapshot.mockReturnValueOnce(oldSnapshot.promise)
    mocks.getModels.mockReturnValueOnce(oldModels.promise)
    await platforms(['deepseek'])
    const oldSignal = mocks.getSnapshot.mock.calls.at(-1)![2] as AbortSignal
    mocks.getModels.mockResolvedValueOnce({ items: [model('kimi', 'latest-model')] })
    await platforms(['kimi'])
    expect(oldSignal.aborted).toBe(true)
    oldSnapshot.resolve(payload({ metrics: metrics(0.9) }))
    oldModels.resolve({ items: [model('deepseek', 'stale-model')] })
    await flushPromises()
    expect(wrapper.find('[data-testid="service-availability"] .stat-value').text()).toBe('99.00%')
    expect(wrapper.findComponent(ServiceModelRanking).props('rows')[0].model).toBe('latest-model')
  })

  it('reports primary failure without pretending retained data is the new scope, and can retry', async () => {
    await view()
    mocks.getSnapshot.mockRejectedValueOnce(new Error('snapshot unavailable'))
    await platforms(['kimi'])
    expect(wrapper.find('[data-testid="service-primary-error"]').text()).toContain('snapshot unavailable')
    expect(wrapper.find('[data-testid="service-empty"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="service-stale-scope"]').exists()).toBe(true)
    await wrapper.find('[data-testid="service-primary-error"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="service-primary-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="service-stale-scope"]').exists()).toBe(false)
  })

  it('keeps the parent matrix if optional expansion data fails', async () => {
    mocks.getMatrix.mockImplementation(async (_filter, groupBy) => {
      if (groupBy === 'platform_group_model') throw new Error('children unavailable')
      return { coverage, group_by: groupBy, items: [row()] }
    })
    await view()
    expect(wrapper.find('article').exists()).toBe(true)
    expect(wrapper.find('[data-testid="service-children-error"]').text()).toContain('children unavailable')
    expect(wrapper.find('[data-testid="service-primary-error"]').exists()).toBe(false)
  })

  it('uses one visible-page polling timer and aborts every active request on unmount', async () => {
    vi.useFakeTimers()
    await view()
    expect(vi.getTimerCount()).toBe(1)
    const beforeHidden = mocks.getSnapshot.mock.calls.length
    mocks.hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(300_000)
    expect(mocks.getSnapshot).toHaveBeenCalledTimes(beforeHidden)
    mocks.hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(vi.getTimerCount()).toBe(1)
    expect(mocks.getSnapshot).toHaveBeenCalledTimes(beforeHidden + 1)
    const signals = [
      mocks.getSnapshot.mock.calls.at(-1)![2], mocks.getMatrix.mock.calls.at(-1)![3],
      mocks.getModels.mock.calls.at(-1)![2], mocks.getErrors.mock.calls.at(-1)![2], mocks.getDimensions.mock.calls.at(-1)![2],
    ] as AbortSignal[]
    wrapper.unmount()
    expect(signals.every(signal => signal.aborted)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains one polling timer after the initial primary request fails', async () => {
    vi.useFakeTimers()
    mocks.getSnapshot.mockRejectedValueOnce(new Error('first request failed'))
    await view()
    expect(wrapper.find('[data-testid="service-primary-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="service-empty"]').exists()).toBe(false)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(300_000)
    await flushPromises()
    expect(mocks.getSnapshot).toHaveBeenCalledTimes(2)
    expect(wrapper.find('article').exists()).toBe(true)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('clears administrator data immediately when the role changes to user scope', async () => {
    mocks.auth.isAdmin = true
    await view()
    mocks.getSnapshot.mockReturnValueOnce(new Promise(() => {}))
    mocks.auth.isAdmin = false
    await flushPromises()
    expect(wrapper.find('article').exists()).toBe(false)
    expect(wrapper.findComponent(ServiceModelRanking).props('rows')).toEqual([])
    expect(mocks.getSnapshot).toHaveBeenLastCalledWith(expect.anything(), false, expect.any(AbortSignal))
  })
})
