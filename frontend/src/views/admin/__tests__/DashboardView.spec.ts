import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import type { DashboardStats } from '@/types'
import DashboardView from '../DashboardView.vue'

const { getSnapshotV2, getUserUsageTrend, getUserSpendingRanking, downloadReport, showSuccess, showWarning } = vi.hoisted(() => ({
  getSnapshotV2: vi.fn(),
  getUserUsageTrend: vi.fn(),
  getUserSpendingRanking: vi.fn(),
  downloadReport: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn()
}))

vi.mock('@/utils/reportExport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/reportExport')>()
  return { ...actual, downloadReport }
})

vi.mock('vue-chartjs', () => ({
  Line: { name: 'Line', props: ['data', 'options'], template: '<div class="line-chart" />' },
  Chart: { name: 'Chart', props: ['data', 'options'], template: '<div class="chart" />' },
  Bar: { name: 'Bar', props: ['data', 'options'], template: '<div class="bar-chart" />' }
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    dashboard: {
      getSnapshotV2,
      getUserUsageTrend,
      getUserSpendingRanking
    }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError: vi.fn(),
    showSuccess,
    showWarning
  })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const createDashboardStats = (): DashboardStats => ({
  total_users: 0,
  today_new_users: 0,
  active_users: 0,
  hourly_active_users: 0,
  stats_updated_at: '',
  stats_stale: false,
  total_api_keys: 0,
  active_api_keys: 0,
  total_accounts: 0,
  normal_accounts: 0,
  error_accounts: 0,
  ratelimit_accounts: 0,
  overload_accounts: 0,
  total_requests: 0,
  total_input_tokens: 0,
  total_output_tokens: 0,
  total_cache_creation_tokens: 0,
  total_cache_read_tokens: 0,
  total_tokens: 0,
  total_cost: 0,
  total_actual_cost: 0,
  today_requests: 0,
  today_input_tokens: 0,
  today_output_tokens: 0,
  today_cache_creation_tokens: 0,
  today_cache_read_tokens: 0,
  today_tokens: 0,
  today_cost: 0,
  today_actual_cost: 0,
  average_duration_ms: 0,
  uptime: 0,
  rpm: 0,
  tpm: 0
})

describe('admin DashboardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())

    getSnapshotV2.mockReset()
    getUserUsageTrend.mockReset()
    getUserSpendingRanking.mockReset()

    getSnapshotV2.mockResolvedValue({
      stats: createDashboardStats(),
      trend: [],
      models: []
    })
    getUserUsageTrend.mockResolvedValue({
      trend: [],
      start_date: '',
      end_date: '',
      granularity: 'hour'
    })
    getUserSpendingRanking.mockResolvedValue({
      ranking: [],
      total_actual_cost: 0,
      total_requests: 0,
      total_tokens: 0,
      start_date: '',
      end_date: ''
    })
  })

  it('keeps the spending metric by default and re-fetches on metric switch', async () => {
    const wrapper = mount(DashboardView, {
      global: {
        stubs: {
          AppLayout: { template: '<div><slot /></div>' },
          LoadingSpinner: true,
          Icon: true,
          DateRangePicker: true,
          Select: true,
          ModelDistributionChart: true,
          TokenUsageTrend: true,
          PlatformIcon: true,
          RouterLink: { props: ['to'], template: '<a><slot /></a>' }
        }
      }
    })
    await flushPromises()

    // The overview opens on spend (the decision-relevant number) rather than
    // raw tokens.
    expect(getUserUsageTrend).toHaveBeenCalledTimes(1)
    expect(getUserUsageTrend).toHaveBeenCalledWith(expect.objectContaining({ metric: 'actual_cost', limit: 12 }))
    expect(wrapper.findComponent({ name: 'Line' }).exists()).toBe(true)

    const tokensButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'admin.dashboard.tokens')!
    getUserUsageTrend.mockResolvedValue({
      trend: [{ date: '2026-01-01', user_id: 1, username: 'tokens', email: '', requests: 1, tokens: 100, cost: 1, actual_cost: 1 }]
    })
    await tokensButton.trigger('click')
    await flushPromises()

    expect(getUserUsageTrend).toHaveBeenCalledTimes(2)
    expect(getUserUsageTrend).toHaveBeenLastCalledWith(expect.objectContaining({ metric: 'tokens', limit: 12 }))
    expect(tokensButton.attributes('aria-pressed')).toBe('true')
  })

  it('surfaces live account pool availability and operational anomalies in the top band', async () => {
    getSnapshotV2.mockResolvedValue({
      stats: {
        ...createDashboardStats(),
        total_accounts: 100,
        normal_accounts: 84,
        error_accounts: 6,
        ratelimit_accounts: 7,
        overload_accounts: 3,
        rpm: 418,
        tpm: 2_840_000,
        average_duration_ms: 1480,
        hourly_active_users: 184,
        active_users: 1284,
        today_new_users: 38,
        active_api_keys: 912,
        total_api_keys: 1460
      },
      trend: [],
      models: [],
      groups: [
        {
          group_id: 9,
          group_name: 'Grok Trial',
          requests: 1400,
          total_tokens: 90000,
          cost: 350,
          actual_cost: 312.4,
          account_cost: 320
        }
      ]
    })

    const wrapper = mount(DashboardView, {
      global: {
        stubs: {
          AppLayout: { template: '<div><slot /></div>' },
          LoadingSpinner: true,
          Icon: true,
          DateRangePicker: true,
          PlatformIcon: true,
          RouterLink: { props: ['to'], template: '<a><slot /></a>' },
          Line: true,
          Chart: true
        }
      }
    })
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('84 / 100')
    expect(text).toContain('84.0%')
    expect(text).toContain('418')
    expect(text).toContain('admin.dashboard.overview.triagePending')
    expect(text).toContain('Grok Trial')
  })

  it('uses the last 7 days at day granularity as the default range', async () => {
    mount(DashboardView, {
      global: {
        stubs: {
          AppLayout: { template: '<div><slot /></div>' },
          LoadingSpinner: true,
          Icon: true,
          DateRangePicker: true,
          Select: true,
          ModelDistributionChart: true,
          TokenUsageTrend: true,
          PlatformIcon: true,
          RouterLink: { props: ['to'], template: '<a><slot /></a>' },
          Line: true
        }
      }
    })

    await flushPromises()

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)

    expect(getSnapshotV2).toHaveBeenCalledTimes(1)
    expect(getSnapshotV2).toHaveBeenCalledWith(expect.objectContaining({
      start_date: formatLocalDate(weekAgo),
      end_date: formatLocalDate(now),
      granularity: 'day',
      // Group stats drive the margin table under the revenue chart.
      include_group_stats: true
    }))
  })

  it('does not fall back to 1-day today_account_cost when multi-day group account_cost is absent', async () => {
    getSnapshotV2.mockResolvedValue({
      stats: {
        ...createDashboardStats(),
        today_account_cost: 842.1
      },
      trend: [
        {
          date: '2026-11-13',
          requests: 100,
          input_tokens: 10,
          output_tokens: 20,
          cache_creation_tokens: 0,
          cache_read_tokens: 0,
          total_tokens: 30,
          cost: 1200,
          actual_cost: 1000
        }
      ],
      models: [],
      groups: [
        {
          group_id: 1,
          group_name: 'No Cost Pool',
          requests: 100,
          total_tokens: 30,
          cost: 1200,
          actual_cost: 1000
        }
      ]
    })

    const wrapper = mount(DashboardView, {
      global: {
        stubs: {
          AppLayout: { template: '<div><slot /></div>' },
          LoadingSpinner: true,
          Icon: true,
          DateRangePicker: true,
          PlatformIcon: true,
          RouterLink: { props: ['to'], template: '<a><slot /></a>' },
          Line: true,
          Chart: true
        }
      }
    })
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('$1,000.00')
    expect(text).not.toContain('$842.10')
  })
})

describe('admin DashboardView report export', () => {
  const mountView = () => mount(DashboardView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        LoadingSpinner: true,
        Icon: true,
        DateRangePicker: true,
        PlatformIcon: true,
        RouterLink: { props: ['to'], template: '<a><slot /></a>' },
        Line: true
      }
    }
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    downloadReport.mockReset()
    downloadReport.mockResolvedValue(undefined)
    showSuccess.mockReset()
    showWarning.mockReset()
    getSnapshotV2.mockReset()
    getUserUsageTrend.mockReset()
    getUserSpendingRanking.mockReset()
    getSnapshotV2.mockResolvedValue({
      stats: createDashboardStats(),
      trend: [{ date: '2026-01-01', requests: 10, input_tokens: 1, output_tokens: 2, cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: 3, cost: 1, actual_cost: 0.8 }],
      models: [],
      groups: [{ group_id: 7, group_name: 'Claude Pro', requests: 10, total_tokens: 3, cost: 1, actual_cost: 0.8, account_cost: 0.5 }]
    })
    getUserUsageTrend.mockResolvedValue({ trend: [], start_date: '', end_date: '', granularity: 'day' })
    getUserSpendingRanking.mockResolvedValue({ ranking: [], total_actual_cost: 0, total_requests: 0, total_tokens: 0, start_date: '', end_date: '' })
  })

  it('exports the current range with the four expected sheets', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[data-testid="report-export-trigger"]').trigger('click')
    await wrapper.get('[data-export-format="xlsx"]').trigger('click')
    await flushPromises()

    expect(downloadReport).toHaveBeenCalledTimes(1)
    const call = downloadReport.mock.calls[0][0]
    expect(call.format).toBe('xlsx')
    expect(call.fileName).toMatch(/^dashboard_\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}$/)
    expect(call.sheets.map((sheet: { name: string }) => sheet.name)).toEqual([
      'admin.dashboard.overview.export.summarySheet',
      'admin.dashboard.overview.export.trendSheet',
      'admin.dashboard.overview.export.groupsSheet',
      'admin.dashboard.overview.export.modelsSheet',
    ])
    // The range on screen is the range exported.
    const summary = call.sheets[0].rows
    expect(summary[1][1]).toBe(`${call.fileName.split('_')[1]} ~ ${call.fileName.split('_')[3]}`)
    expect(showSuccess).toHaveBeenCalledWith('reportExport.success')
  })

  it('refuses to export an empty range instead of writing a blank file', async () => {
    getSnapshotV2.mockResolvedValue({ stats: createDashboardStats(), trend: [], models: [], groups: [] })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[data-testid="report-export-trigger"]').trigger('click')
    await wrapper.get('[data-export-format="csv"]').trigger('click')
    await flushPromises()

    expect(downloadReport).not.toHaveBeenCalled()
    expect(showWarning).toHaveBeenCalledWith('reportExport.empty')
  })
})
