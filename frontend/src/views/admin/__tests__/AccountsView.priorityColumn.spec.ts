import { beforeEach, describe, expect, it, vi } from 'vitest'
import { config, flushPromises, mount } from '@vue/test-utils'

import AccountsView from '../AccountsView.vue'
import DataTable from '@/components/common/DataTable.vue'

config.global.stubs.RouterLink = { template: '<a><slot /></a>' }

const { listAccounts } = vi.hoisted(() => ({
  listAccounts: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    accounts: {
      list: listAccounts,
      listWithEtag: vi.fn(),
      getBatchTodayStats: vi.fn().mockResolvedValue({ stats: {} }),
      getUpstreamBillingProbeSettings: vi.fn().mockResolvedValue({ enabled: true, interval_minutes: 30 }),
      delete: vi.fn(),
      batchClearError: vi.fn(),
      batchRefresh: vi.fn(),
      toggleSchedulable: vi.fn()
    },
    proxies: { getAll: vi.fn().mockResolvedValue([]) },
    groups: { getAll: vi.fn().mockResolvedValue([]) }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn() })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ token: 'test-token', isSimpleMode: false })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

const DataTableStub = {
  props: ['columns'],
  emits: ['sort'],
  template: `
    <div data-test="data-table">
      <span v-for="column in columns" :key="column.key" :data-column="column.key">
        {{ column.sortable ? 'sortable' : 'fixed' }}
      </span>
      <button data-test="sort-priority" @click="$emit('sort', 'priority', 'desc')" />
    </div>
  `
}

function mountView(realTable = false) {
  return mount(AccountsView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        TablePageLayout: {
          template: '<div><slot name="filters" /><slot name="table" /><slot name="pagination" /></div>'
        },
        DataTable: realTable ? false : DataTableStub,
        AccountTableActions: { template: '<div><slot name="after" /></div>' },
        AccountTableFilters: true,
        AccountBulkActionsBar: true,
        Pagination: true,
        ConfirmDialog: true,
        AccountActionMenu: true,
        ImportDataModal: true,
        ReAuthAccountModal: true,
        AccountTestModal: true,
        AccountStatsModal: true,
        ScheduledTestsPanel: true,
        SyncFromCrsModal: true,
        TempUnschedStatusModal: true,
        ErrorPassthroughRulesModal: true,
        TLSFingerprintProfilesModal: true,
        CreateAccountModal: true,
        EditAccountModal: true,
        BulkEditAccountModal: true,
        PlatformTypeBadge: true,
        AccountCapacityCell: true,
        AccountStatusIndicator: true,
        AccountTodayStatsCell: true,
        AccountGroupsCell: true,
        AccountUsageCell: true,
        HelpTooltip: true,
        Icon: true,
        Teleport: true
      }
    }
  })
}

describe('admin AccountsView priority column preferences', () => {
  beforeEach(() => {
    localStorage.clear()
    listAccounts.mockReset().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      pages: 0
    })
  })

  it('shows priority as a sortable column for fresh preferences', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-column="priority"]').text()).toBe('sortable')

    await wrapper.get('[data-test="sort-priority"]').trigger('click')
    await flushPromises()

    expect(listAccounts).toHaveBeenLastCalledWith(
      1,
      20,
      expect.objectContaining({ sort_by: 'priority', sort_order: 'desc' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('preserves an existing preference that explicitly hides priority', async () => {
    localStorage.setItem('account-hidden-columns', JSON.stringify(['priority', 'today_stats']))
    localStorage.setItem('account-hidden-columns-version', 'scheduler-score-hidden-by-default')

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-column="priority"]').exists()).toBe(false)
    expect(JSON.parse(localStorage.getItem('account-hidden-columns') || '[]')).toEqual([
      'priority',
      'today_stats'
    ])
  })

  it('keeps saved columns until an explicit reset and preserves the selected server sort', async () => {
    localStorage.setItem('account-hidden-columns', JSON.stringify(['priority', 'today_stats']))
    localStorage.setItem('account-hidden-columns-version', 'scheduler-score-hidden-by-default')
    localStorage.setItem('account-table-sort', JSON.stringify({ key: 'upstream_billing_rate', order: 'desc' }))
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-column="scheduler_score"]').exists()).toBe(true)
    expect(wrapper.find('[data-column="priority"]').exists()).toBe(false)
    expect(listAccounts.mock.lastCall?.[2].include_scheduler_score).toBe('1')

    await wrapper.get('.account-columns button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-column="scheduler_score"]').exists()).toBe(false)
    expect(wrapper.find('[data-column="platform"]').exists()).toBe(false)
    expect(wrapper.find('[data-column="today_stats"]').exists()).toBe(true)
    expect(wrapper.find('[data-column="priority"]').exists()).toBe(true)
    expect(listAccounts.mock.lastCall?.[2]).toMatchObject({
      include_scheduler_score: '0', sort_by: 'upstream_billing_rate', sort_order: 'desc'
    })
    expect(JSON.parse(localStorage.getItem('account-hidden-columns')!)).toContain('platform')
    wrapper.unmount()
  })

  it.each(['priority', 'upstream_billing_rate'])(
    'retains the persisted %s server sort with real DataTable after hide, reset, and remount',
    async (key) => {
      const expectedSort = { key, order: 'desc' }
      // Start with a saved layout in which the server-sorted column is visible.
      localStorage.setItem('account-hidden-columns', JSON.stringify(['scheduler_score']))
      localStorage.setItem('account-hidden-columns-version', 'scheduler-score-hidden-by-default')
      localStorage.setItem('account-table-sort', JSON.stringify(expectedSort))
      const wrapper = mountView(true)
      await flushPromises()
      const table = wrapper.getComponent(DataTable)
      const columnVisible = () => table.props('columns').some(column => column.key === key)
      const storedSort = () => JSON.parse(localStorage.getItem('account-table-sort')!)
      expect(columnVisible()).toBe(true)
      expect(storedSort()).toEqual(expectedSort)

      const checkbox = wrapper.get('.account-columns').findAll('label')
        .find(label => label.text() === `admin.accounts.columns.${key === 'upstream_billing_rate' ? 'upstreamBillingRate' : key}`)!
        .get('input')
      await checkbox.setValue(false)
      await flushPromises()
      expect(columnVisible()).toBe(false)
      expect(storedSort()).toEqual(expectedSort)

      await wrapper.get('.account-columns button').trigger('click')
      await flushPromises()
      expect(storedSort()).toEqual(expectedSort)
      expect(table.emitted('sort')).toBeUndefined()
      wrapper.unmount()

      const remounted = mountView(true)
      await flushPromises()
      expect(storedSort()).toEqual(expectedSort)
      expect(listAccounts).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({
        sort_by: key, sort_order: 'desc'
      }), expect.objectContaining({ signal: expect.any(AbortSignal) }))
      remounted.unmount()
    }
  )

  it('keeps priority visible while migrating older saved preferences', async () => {
    localStorage.setItem('account-hidden-columns', JSON.stringify(['today_stats']))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-column="priority"]').text()).toBe('sortable')
    expect(JSON.parse(localStorage.getItem('account-hidden-columns') || '[]')).toEqual(
      expect.arrayContaining(['today_stats', 'scheduler_score'])
    )
    expect(JSON.parse(localStorage.getItem('account-hidden-columns') || '[]')).not.toContain('priority')
  })
})
