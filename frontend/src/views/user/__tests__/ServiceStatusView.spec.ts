import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { coverage, health, metrics, row } from '@/features/channel-monitor-v2/__tests__/availabilityFixtures'
import ServiceStatusView from '../ServiceStatusView.vue'

const mocks = vi.hoisted(() => ({
  getSnapshot: vi.fn(), getMatrix: vi.fn(), getModels: vi.fn(),
  replace: vi.fn(), showError: vi.fn(), query: {} as Record<string, string>,
}))
vi.mock('@/api/channelMonitorV2', () => mocks)
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError: mocks.showError }) }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: mocks.query }), useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key, locale: { value: 'en' } }),
}))

let wrapper: VueWrapper
async function view() {
  wrapper = mount(ServiceStatusView, { global: { stubs: { AppLayout: { template: '<div><slot /></div>' } } } })
  await flushPromises()
  return wrapper
}
function card(platform: string) {
  return wrapper.findAll(`article[data-platform="${platform}"]`)
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.query = {}
  mocks.getSnapshot.mockResolvedValue({
    config: { refresh_interval_seconds: 300 }, coverage,
    metrics: metrics(0.01), health: health(), trend: [],
  })
  mocks.getMatrix.mockImplementation(async (_filter, groupBy) => ({
    coverage, group_by: groupBy,
    items: groupBy === 'platform_group_model'
      ? [row({ model: 'deepseek-chat', metrics: metrics(0), health: health('healthy') })]
      : [row({ platform: 'deepseek', group_id: 7, group_name: 'DS 池' })],
  }))
  mocks.getModels.mockResolvedValue({ items: [] })
})
afterEach(() => wrapper?.unmount())

describe('Service status page (real traffic only)', () => {
  it('answers per group by default, because a request is routed to a group', async () => {
    await view()
    expect(mocks.getMatrix).toHaveBeenCalledWith(expect.objectContaining({ range: '24h' }), 'platform_group', false, expect.any(AbortSignal))
    expect(card('deepseek')).toHaveLength(1)
    expect(wrapper.text()).toContain('DS 池')
    // Only one evidence source is claimed: real traffic.
    expect(wrapper.find('[data-evidence="traffic"]').exists()).toBe(true)
  })

  it('never presents a sample-shortfall row as available', async () => {
    mocks.getMatrix.mockResolvedValue({
      coverage, group_by: 'platform_group',
      items: [row({ group_name: 'No traffic', metrics: metrics(0), health: health('unknown') })],
    })
    await view()
    expect(wrapper.find('[data-state="unknown"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('channelMonitorV2.service.noTraffic')
    expect(wrapper.find('[data-testid="service-availability"]').text()).toBe('—')
  })

  it('keeps an unjudged scope out of the overall verdict', async () => {
    mocks.getMatrix.mockResolvedValue({
      coverage, group_by: 'platform_group',
      items: [
        row({ platform: 'deepseek', group_id: 7, group_name: 'Healthy' }),
        row({ platform: 'kimi', group_id: 8, group_name: 'No traffic', metrics: metrics(0), health: health('unknown') }),
      ],
    })
    await view()
    // Two groups on screen, but the verdict describes only the one with evidence.
    expect(wrapper.findAll('article')).toHaveLength(2)
    expect(wrapper.find('[data-testid="service-verdict"]').text()).toBe('channelMonitorV2.service.bannerOk')
  })

  it('downgrades the verdict when a judged group is fluctuating', async () => {
    mocks.getMatrix.mockResolvedValue({
      coverage, group_by: 'platform_group',
      items: [
        row({ platform: 'deepseek', group_id: 7, group_name: 'Healthy' }),
        row({ platform: 'openai', group_id: 9, group_name: 'Wobbly', metrics: metrics(0.05), health: health('warning') }),
      ],
    })
    await view()
    expect(wrapper.find('[data-testid="service-verdict"]').text()).toBe('channelMonitorV2.service.bannerWarn')
  })

  it('switches to the platform roll-up without inventing group rows', async () => {
    await view()
    await wrapper.findAll('[data-service-dimension]').find(item => item.attributes('data-service-dimension') === 'platform')!.trigger('click')
    await flushPromises()
    // Both the rows call and the children call switch axis together.
    expect(mocks.getMatrix).toHaveBeenCalledWith(expect.anything(), 'platform', false, expect.any(AbortSignal))
    expect(mocks.getMatrix).toHaveBeenCalledWith(expect.anything(), 'platform_model', false, expect.any(AbortSignal))
    expect(mocks.replace).toHaveBeenLastCalledWith({ query: expect.objectContaining({ dimension: 'platform' }) })
  })

  it('keeps group rows out of the platform view when the API mixes them in', async () => {
    mocks.getMatrix.mockImplementation(async (_filter, groupBy) => ({
      coverage, group_by: groupBy,
      items: groupBy === 'platform'
        ? [row({ platform: 'deepseek', group_id: undefined, group_name: 'DeepSeek' })]
        : [row({ platform: 'deepseek', group_id: 7, group_name: 'DS 池' })],
    }))
    await view()
    expect(wrapper.findAll('article')).toHaveLength(1)
    expect(wrapper.text()).toContain('DeepSeek')
  })

  it('restores the range from the URL for the standalone page', async () => {
    mocks.query = { range: '7d' }
    await view()
    expect(mocks.getMatrix).toHaveBeenCalledWith(expect.objectContaining({ range: '7d' }), expect.anything(), false, expect.any(AbortSignal))
    // A dimension-less URL stays clean: group is the default, not a query parameter.
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
