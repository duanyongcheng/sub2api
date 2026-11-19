import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import DashboardView from '../DashboardView.vue'

const {
  getDashboardStats,
  getDashboardTrend,
  getDashboardModels,
  queryUsage,
  listMyErrorRequests,
  getMyPlatformQuotas,
  refreshUser,
  fetchActiveSubscriptions,
  refreshBatchImageAccess
} = vi.hoisted(() => ({
  getDashboardStats: vi.fn(),
  getDashboardTrend: vi.fn(),
  getDashboardModels: vi.fn(),
  queryUsage: vi.fn(),
  listMyErrorRequests: vi.fn(),
  getMyPlatformQuotas: vi.fn(),
  refreshUser: vi.fn(),
  fetchActiveSubscriptions: vi.fn(),
  refreshBatchImageAccess: vi.fn()
}))

const mockAuthState = reactive({
  user: {
    id: 7,
    username: 'linyan',
    email: 'linyan@example.com',
    role: 'user' as const,
    balance: 94.46,
    frozen_balance: 4.2,
    concurrency: 12,
    status: 'active' as const,
    allowed_groups: null,
    created_at: '',
    updated_at: ''
  },
  isSimpleMode: false,
  refreshUser
})

const mockSubscriptionState = reactive({
  activeSubscriptions: [
    {
      id: 1,
      user_id: 7,
      group_id: 10,
      status: 'active' as const,
      starts_at: '2026-11-01T00:00:00Z',
      daily_usage_usd: 4.5,
      weekly_usage_usd: 24.1,
      monthly_usage_usd: 81.6,
      daily_window_start: null,
      weekly_window_start: null,
      monthly_window_start: '2026-11-01T00:00:00Z',
      created_at: '',
      updated_at: '',
      expires_at: '2026-12-01T00:00:00Z',
      group: {
        id: 10,
        name: 'Claude Pro',
        monthly_limit_usd: 300,
        rpm_limit: 60
      }
    }
  ],
  fetchActiveSubscriptions
})

vi.mock('vue-chartjs', () => ({
  Bar: { name: 'Bar', props: ['data', 'options'], template: '<div class="bar-chart" />' }
}))

vi.mock('@/api/usage', () => ({
  usageAPI: {
    getDashboardStats,
    getDashboardTrend,
    getDashboardModels,
    query: queryUsage,
    listMyErrorRequests
  }
}))

vi.mock('@/api/user', () => ({
  getMyPlatformQuotas
}))

vi.mock('@/stores', () => ({
  useAuthStore: () => mockAuthState,
  useSubscriptionStore: () => mockSubscriptionState
}))

vi.mock('@/composables/useBatchImageAccess', () => ({
  useBatchImageAccess: () => ({
    canUseBatchImage: { value: false },
    refreshBatchImageAccess
  })
}))

vi.mock('@/utils/featureFlags', () => ({
  FeatureFlags: {
    subscription: { key: 'subscription_enabled', mode: 'opt-out', label: 'Subscription' },
    channelMonitor: { key: 'channel_monitor_enabled', mode: 'opt-out', label: 'Channel Monitor' }
  },
  isFeatureFlagEnabled: () => true,
  isChannelMonitorRouteEnabled: () => true
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
      te: () => true
    })
  }
})

const mountUserDashboard = () =>
  mount(DashboardView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        LoadingSpinner: true,
        Icon: true,
        DateRangePicker: true,
        PlatformIcon: true,
        RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' }
      }
    }
  })

describe('user DashboardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAuthState.isSimpleMode = false
    refreshUser.mockReset().mockResolvedValue(undefined)
    fetchActiveSubscriptions.mockReset().mockResolvedValue(undefined)
    refreshBatchImageAccess.mockReset().mockResolvedValue(undefined)

    getDashboardStats.mockReset().mockResolvedValue({
      total_api_keys: 6,
      active_api_keys: 5,
      total_requests: 120000,
      total_input_tokens: 1000000,
      total_output_tokens: 500000,
      total_cache_creation_tokens: 0,
      total_cache_read_tokens: 200000,
      total_tokens: 1700000,
      total_cost: 200,
      total_actual_cost: 140,
      today_requests: 1248,
      today_input_tokens: 500000,
      today_output_tokens: 120000,
      today_cache_creation_tokens: 10000,
      today_cache_read_tokens: 90000,
      today_tokens: 720000,
      today_cost: 18.2,
      today_actual_cost: 12.74,
      average_duration_ms: 1420,
      rpm: 38,
      tpm: 1240000,
      by_platform: [
        {
          platform: 'anthropic',
          total_requests: 9000,
          total_tokens: 1000000,
          total_actual_cost: 100,
          today_requests: 900,
          today_tokens: 500000,
          today_actual_cost: 8.12
        }
      ]
    })

    getDashboardTrend.mockReset().mockResolvedValue({
      trend: [
        {
          date: '2026-11-18',
          requests: 600,
          input_tokens: 200000,
          output_tokens: 80000,
          cache_creation_tokens: 0,
          cache_read_tokens: 20000,
          total_tokens: 300000,
          cost: 9,
          actual_cost: 6.3
        },
        {
          date: '2026-11-19',
          requests: 1248,
          input_tokens: 500000,
          output_tokens: 120000,
          cache_creation_tokens: 10000,
          cache_read_tokens: 90000,
          total_tokens: 720000,
          cost: 18.2,
          actual_cost: 12.74
        }
      ],
      start_date: '2026-11-13',
      end_date: '2026-11-19',
      granularity: 'day'
    })

    getDashboardModels.mockReset().mockResolvedValue({
      models: [
        {
          model: 'claude-opus-4-6',
          requests: 900,
          input_tokens: 500000,
          output_tokens: 120000,
          cache_creation_tokens: 10000,
          cache_read_tokens: 90000,
          total_tokens: 720000,
          cost: 15,
          actual_cost: 10.5
        }
      ]
    })

    queryUsage.mockReset().mockResolvedValue({
      items: [
        {
          id: 101,
          api_key_id: 2,
          api_key: { id: 2, name: 'Prod Key', key: 'sk-1234567890abcdef' },
          model: 'claude-opus-4-6',
          stream: true,
          input_tokens: 1200,
          output_tokens: 400,
          cache_creation_tokens: 0,
          cache_read_tokens: 200,
          actual_cost: 0.142,
          duration_ms: 1800,
          created_at: '2026-11-19T10:30:00Z'
        }
      ],
      total: 1,
      page: 1,
      page_size: 8
    })

    listMyErrorRequests.mockReset().mockResolvedValue({
      items: [
        {
          id: 501,
          created_at: '2026-11-19T10:15:00Z',
          model: 'gpt-5.4',
          inbound_endpoint: '/v1/responses',
          status_code: 429,
          category: 'rate_limit',
          platform: 'openai',
          message: 'Upstream rate limit exceeded',
          key_name: 'Codex CLI',
          key_deleted: false
        }
      ],
      total: 3,
      page: 1,
      page_size: 8
    })

    getMyPlatformQuotas.mockReset().mockResolvedValue({
      platform_quotas: [
        {
          platform: 'openai',
          daily_limit_usd: 50,
          daily_usage_usd: 21,
          weekly_limit_usd: 0,
          weekly_usage_usd: 0,
          monthly_limit_usd: 0,
          monthly_usage_usd: 0
        }
      ]
    })
  })

  it('loads readiness, trend, compact recent page_size=8, errors, and zero-today quota platforms', async () => {
    const wrapper = mountUserDashboard()
    await flushPromises()

    expect(queryUsage).toHaveBeenCalledWith(expect.objectContaining({ page: 1, page_size: 8 }))
    expect(listMyErrorRequests).toHaveBeenCalledWith(expect.objectContaining({ page: 1, page_size: 8 }))

    const text = wrapper.text()
    expect(text).toContain('$94.46')
    expect(text).toContain('Claude Pro')
    expect(text).toContain('5')
    // OpenAI has 0 requests today but configured daily quota -> must still appear
    expect(text).toContain('OpenAI')
    expect(text).toContain('Anthropic')
    // Error strip renders with count 3 and switches bottom table to errors tab on click
    expect(text).toContain('dashboard.workbench.errorAlertSummary:{"count":3}')

    const jumpBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('dashboard.workbench.errorAlertAction'))!
    await jumpBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Upstream rate limit exceeded')
    expect(wrapper.text()).toContain('429')
  })

  it('synchronizes trend, recent requests, and error requests when switching time presets', async () => {
    const wrapper = mountUserDashboard()
    await flushPromises()

    const todayBtn = wrapper
      .findAll('button')
      .find((b) => b.text() === 'dashboard.workbench.presetToday')!
    await todayBtn.trigger('click')
    await flushPromises()

    expect(getDashboardTrend).toHaveBeenCalledTimes(2)
    expect(getDashboardTrend).toHaveBeenLastCalledWith(expect.objectContaining({ granularity: 'hour' }))
    expect(queryUsage).toHaveBeenCalledTimes(2)
    expect(listMyErrorRequests).toHaveBeenCalledTimes(2)
  })

  it('omits billing readiness cells and quota fetch in simple mode', async () => {
    mockAuthState.isSimpleMode = true
    const wrapper = mountUserDashboard()
    await flushPromises()

    expect(getMyPlatformQuotas).not.toHaveBeenCalled()
    expect(fetchActiveSubscriptions).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('dashboard.workbench.availableBalance')
    expect(wrapper.text()).not.toContain('dashboard.workbench.subscriptionTitle')
    expect(wrapper.text()).toContain('dashboard.workbench.todayTrafficTitle')
  })
})
