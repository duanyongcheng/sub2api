import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, config, flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

import AccountsView from '../AccountsView.vue'
import AccountActionMenu from '@/components/admin/account/AccountActionMenu.vue'
import AccountPoolNavigator from '@/components/admin/account/AccountPoolNavigator.vue'
import AccountPoolOverview from '@/components/admin/account/AccountPoolOverview.vue'
import AccountTableFilters from '@/components/admin/account/AccountTableFilters.vue'

config.global.stubs.RouterLink = { template: '<a><slot /></a>' }

const {
  listAccounts,
  listWithEtag,
  getById,
  getBatchTodayStats,
  getUpstreamBillingProbeSettings,
  getAllProxies,
  getAllGroups,
  getCapacitySummary,
  getUsageSummary,
  setSchedulable,
  refreshCredentials,
  showError,
  showWarning
} = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  listWithEtag: vi.fn(),
  getById: vi.fn(),
  getBatchTodayStats: vi.fn(),
  getUpstreamBillingProbeSettings: vi.fn(),
  getAllProxies: vi.fn(),
  getAllGroups: vi.fn(),
  getCapacitySummary: vi.fn(),
  getUsageSummary: vi.fn(),
  setSchedulable: vi.fn(),
  refreshCredentials: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    accounts: {
      list: listAccounts,
      getById,
      listWithEtag,
      getBatchTodayStats,
      getUpstreamBillingProbeSettings,
      delete: vi.fn(),
      batchClearError: vi.fn(),
      batchRefresh: vi.fn(),
      toggleSchedulable: vi.fn(),
      setSchedulable,
      refreshCredentials
    },
    proxies: { getAll: getAllProxies },
    groups: { getAll: getAllGroups, getCapacitySummary, getUsageSummary }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showWarning, showSuccess: vi.fn(), showInfo: vi.fn() })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ token: 'test-token', isSimpleMode: false })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const DataTableStub = defineComponent({
  props: { data: { type: Array, default: () => [] } },
  template: `
    <div>
      <div v-for="row in data" :key="row.id" :data-account-name="row.name">
        <slot name="cell-select" :row="row" />
        <slot name="cell-groups" :row="row" />
        <slot name="cell-schedulable" :row="row" />
        <slot name="cell-actions" :row="row" />
      </div>
    </div>
  `
})

const AccountGroupsCellStub = defineComponent({
  props: { groups: { type: Array, default: () => [] } },
  template: '<span data-test="account-groups">{{ groups.map(group => group.name).join(",") }}</span>'
})

const EditAccountModalStub = defineComponent({
  props: { show: Boolean, account: { type: Object, default: null } },
  template: '<div data-test="edit-account">{{ show ? account?.name : "" }}</div>'
})

const AccountTestModalStub = defineComponent({
  props: { show: Boolean, account: { type: Object, default: null } },
  template: '<div data-test="test-account">{{ show ? account?.name : "" }}</div>'
})

const AccountStatsModalStub = defineComponent({
  props: { show: Boolean, account: { type: Object, default: null } },
  template: '<div data-test="stats-account">{{ show ? account?.name : "" }}</div>'
})

function mountView(stubActionMenu = true) {
  return mount(AccountsView, {
    attachTo: document.body,
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        TablePageLayout: { template: '<div><slot name="filters" /><slot name="table" /><slot name="pagination" /></div>' },
        DataTable: DataTableStub,
        AccountTableActions: { template: '<div><slot name="after" /></div>' },
        AccountTableFilters: true,
        AccountBulkActionsBar: true,
        Pagination: true,
        ConfirmDialog: true,
        AccountActionMenu: stubActionMenu,
        ImportDataModal: true,
        ReAuthAccountModal: true,
        AccountTestModal: AccountTestModalStub,
        AccountStatsModal: AccountStatsModalStub,
        ScheduledTestsPanel: true,
        SyncFromCrsModal: true,
        TempUnschedStatusModal: true,
        ErrorPassthroughRulesModal: true,
        TLSFingerprintProfilesModal: true,
        CreateAccountModal: true,
        EditAccountModal: EditAccountModalStub,
        BulkEditAccountModal: true,
        PlatformTypeBadge: true,
        AccountCapacityCell: true,
        AccountStatusIndicator: true,
        AccountTodayStatsCell: true,
        AccountGroupsCell: AccountGroupsCellStub,
        AccountUsageCell: true,
        UpstreamBillingRateCell: true,
        HelpTooltip: true,
        Icon: true,
        Teleport: stubActionMenu
      }
    }
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

const listRow = {
  id: 42,
  name: 'compact row',
  platform: 'openai',
  type: 'oauth',
  status: 'active',
  schedulable: true,
  concurrency: 2,
  priority: 1,
  group_ids: [7],
  extra: {},
  credentials: {}
}

const fullAccount = {
  ...listRow,
  groups: [{ id: 7, name: 'codex', platform: 'openai' }],
  account_groups: [{ account_id: 42, group_id: 7 }],
  credentials: { api_key: 'redacted' },
  extra: { detail_only: true }
}

describe('admin AccountsView lite account list', () => {
  beforeEach(() => {
    localStorage.clear()
    listAccounts.mockReset().mockResolvedValue({ items: [listRow], total: 1, page: 1, page_size: 20, pages: 1 })
    listWithEtag.mockReset().mockResolvedValue({ notModified: true, etag: 'compact-etag', data: null })
    getById.mockReset().mockResolvedValue(fullAccount)
    getBatchTodayStats.mockReset().mockResolvedValue({ stats: {} })
    getUpstreamBillingProbeSettings.mockReset().mockResolvedValue({ enabled: true })
    getAllProxies.mockReset().mockResolvedValue([])
    getAllGroups.mockReset().mockResolvedValue([{ id: 7, name: 'codex', platform: 'openai' }])
    getCapacitySummary.mockReset().mockResolvedValue([])
    getUsageSummary.mockReset().mockResolvedValue([])
    setSchedulable.mockReset().mockImplementation(async (id, schedulable) => ({ id, schedulable }))
    refreshCredentials.mockReset()
    showError.mockReset()
    showWarning.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('uses pool navigation for the server query, clears selection, and preserves query/sort state', async () => {
    vi.useFakeTimers()
    localStorage.setItem('account-table-sort', JSON.stringify({ key: 'priority', order: 'desc' }))
    localStorage.setItem('account-filter-values', JSON.stringify({ platform: 'openai', status: 'active' }))
    listAccounts.mockResolvedValue({ items: [listRow], total: 60, page: 1, page_size: 20, pages: 3 })
    const wrapper = mountView()
    await flushPromises()
    const filters = wrapper.findComponent(AccountTableFilters)
    filters.vm.$emit('update:filters', { type: 'oauth', privacy_mode: 'training_off' })
    filters.vm.$emit('update:searchQuery', 'compact')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    wrapper.findComponent({ name: 'Pagination' }).vm.$emit('update:page', 2)
    await flushPromises()
    await wrapper.get('[data-account-name] input[type="checkbox"]').setValue(true)
    expect(wrapper.findComponent({ name: 'AccountBulkActionsBar' }).props('selectedIds')).toEqual([42])

    await wrapper.get('[data-pool="7"]').trigger('click')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    expect(listAccounts).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({
      group: '7', type: 'oauth', status: 'active', privacy_mode: 'training_off', search: 'compact',
      sort_by: 'priority', sort_order: 'desc', lite: '1'
    }), expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(wrapper.findComponent({ name: 'AccountBulkActionsBar' }).props('selectedIds')).toEqual([])
    expect(wrapper.findComponent(AccountPoolNavigator).props('group')).toBe('7')

    wrapper.findComponent(AccountPoolNavigator).vm.$emit('navigate', { group: 'ungrouped', platform: '' })
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    expect(listAccounts.mock.lastCall?.[2].group).toBe('ungrouped')
    await wrapper.get('[data-pool="all"]').trigger('click')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    expect(listAccounts.mock.lastCall?.[2].group).toBe('')
    wrapper.unmount()
  })

  it.each(['mount', 'manual'])(
    'refreshes catalog and summaries after mutations during a pending %s refresh',
    async (trigger) => {
      const oldGroups = [{ id: 7, name: 'codex', platform: 'openai', account_count: 3, active_account_count: 3 }]
      const oldCapacity = [{ group_id: 7, concurrency_used: 2, concurrency_max: 6, sessions_used: 0, sessions_max: 0, rpm_used: 0, rpm_max: 0 }]
      const oldUsage = [{ group_id: 7, today_cost: 10, yesterday_cost: 5, total_cost: 20 }]
      const freshGroups = [{ ...oldGroups[0], active_account_count: 2 }]
      const freshCapacity = [{ ...oldCapacity[0], concurrency_max: 4 }]
      const freshUsage = [{ ...oldUsage[0], today_cost: 12 }]
      const pendingGroups = deferred<typeof oldGroups>()
      const pendingCapacity = deferred<typeof oldCapacity>()
      const pendingUsage = deferred<typeof oldUsage>()
      const trailingGroups = deferred<typeof freshGroups>()
      const trailingCapacity = deferred<typeof freshCapacity>()
      const trailingUsage = deferred<typeof freshUsage>()
      const wrapper = trigger === 'manual' ? mountView() : undefined
      if (wrapper) await flushPromises()
      const initialCalls = getAllGroups.mock.calls.length
      getAllGroups.mockReturnValueOnce(pendingGroups.promise).mockReturnValueOnce(trailingGroups.promise)
      getCapacitySummary.mockReturnValueOnce(pendingCapacity.promise).mockReturnValueOnce(trailingCapacity.promise)
      getUsageSummary.mockReturnValueOnce(pendingUsage.promise).mockReturnValueOnce(trailingUsage.promise)
      const view = wrapper ?? mountView()
      const state = view.vm as unknown as { handleManualRefresh: () => Promise<void> }
      let completed = false
      const completion = wrapper ? state.handleManualRefresh().then(() => { completed = true }) : undefined
      await flushPromises()
      expect(getAllGroups).toHaveBeenCalledTimes(initialCalls + 1)
      expect(view.getComponent(AccountPoolNavigator).props('loading')).toBe(true)

      // Multiple successful mutations share one trailing batch after the old snapshot.
      const switchButton = view.get('[role="switch"]')
      await switchButton.trigger('click')
      await flushPromises()
      expect(setSchedulable).toHaveBeenLastCalledWith(42, false)
      expect(switchButton.attributes('aria-checked')).toBe('false')
      await switchButton.trigger('click')
      await flushPromises()
      expect(setSchedulable).toHaveBeenLastCalledWith(42, true)
      expect(getAllGroups).toHaveBeenCalledTimes(initialCalls + 1)

      // Mutations alone must schedule the trailing batch. The original manual
      // refresh promise stays pending, and loading spans both batches.
      pendingGroups.resolve(oldGroups)
      await flushPromises()
      expect(view.getComponent(AccountPoolNavigator).props('loading')).toBe(true)
      pendingCapacity.resolve(oldCapacity)
      pendingUsage.resolve(oldUsage)
      await flushPromises()
      expect(getAllGroups).toHaveBeenCalledTimes(initialCalls + 2)
      expect(getCapacitySummary).toHaveBeenCalledTimes(initialCalls + 2)
      expect(getUsageSummary).toHaveBeenCalledTimes(initialCalls + 2)
      expect(completed).toBe(false)
      expect(view.getComponent(AccountPoolNavigator).props('loading')).toBe(true)

      trailingGroups.resolve(freshGroups)
      trailingCapacity.resolve(freshCapacity)
      trailingUsage.resolve(freshUsage)
      await completion
      await flushPromises()
      if (completion) expect(completed).toBe(true)
      const overview = view.getComponent(AccountPoolOverview)
      expect(overview.props('groups')).toEqual(freshGroups)
      expect(overview.props('capacities')).toEqual({ 7: freshCapacity[0] })
      expect(overview.props('usage')).toEqual({ 7: freshUsage[0] })
      expect(view.getComponent(AccountPoolNavigator).props('loading')).toBe(false)
      expect(getAllGroups).toHaveBeenCalledTimes(initialCalls + 2)
      expect(getAllProxies).toHaveBeenCalledTimes(1)
      view.unmount()
    }
  )

  it('ignores late workspace and proxy results and does not register listeners after unmount', async () => {
    const pendingGroups = deferred<unknown[]>()
    const pendingProxies = deferred<unknown[]>()
    const pendingCapacity = deferred<unknown[]>()
    const pendingUsage = deferred<unknown[]>()
    getAllGroups.mockReturnValueOnce(pendingGroups.promise)
    getAllProxies.mockReturnValueOnce(pendingProxies.promise)
    getCapacitySummary.mockReturnValueOnce(pendingCapacity.promise)
    getUsageSummary.mockReturnValueOnce(pendingUsage.promise)
    const view = mountView()
    await flushPromises()
    const state = view.vm as unknown as { groups: unknown[]; proxies: unknown[]; refreshWorkspace: () => Promise<void> }
    const initialGroups = state.groups
    const initialProxies = state.proxies
    const completion = state.refreshWorkspace()
    view.unmount()
    const windowAdd = vi.spyOn(window, 'addEventListener')
    const documentAdd = vi.spyOn(document, 'addEventListener')
    pendingGroups.resolve([{ id: 7, name: 'late catalog', platform: 'openai' }])
    pendingProxies.resolve([{ id: 1, name: 'late proxy' }])
    pendingCapacity.resolve([{ group_id: 7, concurrency_used: 1, concurrency_max: 2 }])
    pendingUsage.resolve([{ group_id: 7, today_cost: 50 }])
    await completion
    await flushPromises()
    expect(state.groups).toBe(initialGroups)
    expect(state.proxies).toBe(initialProxies)
    expect(windowAdd.mock.calls.filter(([event]) => event === 'scroll' || event === 'resize')).toEqual([])
    expect(documentAdd.mock.calls.filter(([event]) => event === 'click')).toEqual([])
    await state.refreshWorkspace()
    expect(getAllGroups).toHaveBeenCalledTimes(1)
    expect(getCapacitySummary).toHaveBeenCalledTimes(1)
    expect(getUsageSummary).toHaveBeenCalledTimes(1)
  })

  it('updates page health from the existing clock without replacing the account array', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-11-11T12:00:00Z')
    vi.setSystemTime(now)
    listAccounts.mockResolvedValue({ items: [
      { ...listRow, id: 1, rate_limit_reset_at: new Date(now.getTime() + 30_000).toISOString() },
      { ...listRow, id: 2, auto_pause_on_expired: true, expires_at: now.getTime() / 1000 + 30 }
    ], total: 2, page: 1, page_size: 20, pages: 1 })
    const view = mountView()
    await flushPromises()
    const overview = view.getComponent(AccountPoolOverview)
    const accounts = overview.props('accounts')
    const metrics = () => overview.findAll('.pool-page-metrics dd').slice(0, 4).map(metric => metric.text())
    expect(metrics()).toEqual(['1', '1', '0', '0'])
    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()
    expect(overview.props('accounts')).toBe(accounts)
    expect(overview.props('now')).toBe(now.getTime() + 60_000)
    expect(metrics()).toEqual(['1', '0', '0', '1'])
    expect(listAccounts).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('keeps lite=1 on the initial list request', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(listAccounts).toHaveBeenCalledWith(
      1,
      20,
      expect.objectContaining({ lite: '1' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    wrapper.unmount()
  })

  it('maps group_ids through the group catalog for the table cell', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-test="account-groups"]').text()).toBe('codex')
    wrapper.unmount()
  })

  it('keeps the action menu open during internal scrolling but closes it on table scrolling', async () => {
    const wrapper = mountView(false)
    await flushPromises()

    const trigger = wrapper.get('button[aria-label="common.more"]')
    await trigger.trigger('click')
    const menu = new DOMWrapper(document.body.querySelector('.action-menu-content')!)
    menu.element.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(wrapper.findComponent(AccountActionMenu).props('show')).toBe(true)

    menu.get('button').element.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(wrapper.findComponent(AccountActionMenu).props('show')).toBe(true)

    wrapper.getComponent(DataTableStub).element.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(wrapper.findComponent(AccountActionMenu).props('show')).toBe(false)
    wrapper.unmount()
  })

  it('moves deletion into the more menu and opens the existing confirmation', async () => {
    const wrapper = mountView(false)
    await flushPromises()
    expect(wrapper.find('button[aria-label="common.delete"]').exists()).toBe(false)
    await wrapper.get('button[aria-label="common.more"]').trigger('click')
    await flushPromises()
    const menu = new DOMWrapper(document.body.querySelector('.action-menu-content')!)
    const deleteButton = menu.findAll('button').find(button => button.text() === 'common.delete')!
    await deleteButton.trigger('click')
    await flushPromises()
    const dialog = wrapper.findAllComponents({ name: 'ConfirmDialog' }).find(component => component.props('danger') === true)!
    expect(dialog.props('show')).toBe(true)
    expect(dialog.props('message')).toContain('admin.accounts.deleteConfirm')
    expect(wrapper.findComponent(AccountActionMenu).props('show')).toBe(false)
    wrapper.unmount()
  })

  it('keeps lite=1 on automatic ETag refreshes', async () => {
    vi.useFakeTimers()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    localStorage.setItem('account-auto-refresh', JSON.stringify({ enabled: true, interval_seconds: 5 }))
    const wrapper = mountView()
    await flushPromises()

    await vi.advanceTimersByTimeAsync(6000)
    await flushPromises()

    expect(listWithEtag).toHaveBeenCalledWith(
      1,
      20,
      expect.objectContaining({ lite: '1' }),
      expect.objectContaining({ etag: null })
    )
    wrapper.unmount()
  })

  it('loads the full account by id before opening edit, test, and stats actions', async () => {
    const wrapper = mountView()
    await flushPromises()

    const editButton = wrapper.get('button[aria-label="common.edit"]')
    await editButton.trigger('click')
    await flushPromises()
    expect(getById).toHaveBeenCalledWith(42)
    expect(wrapper.get('[data-test="edit-account"]').text()).toBe('compact row')

    const menu = wrapper.findComponent(AccountActionMenu)
    menu.vm.$emit('test', listRow)
    await flushPromises()
    expect(getById).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-test="test-account"]').text()).toBe('compact row')

    menu.vm.$emit('stats', listRow)
    await flushPromises()
    expect(getById).toHaveBeenCalledTimes(3)
    expect(wrapper.get('[data-test="stats-account"]').text()).toBe('compact row')
    wrapper.unmount()
  })

  it('shows the warning and patches the account after a partial Antigravity refresh', async () => {
    refreshCredentials.mockResolvedValue({
      account: { ...fullAccount, name: 'refreshed account' },
      message: 'Token refreshed, but project_id is temporarily unavailable',
      warning: 'missing_project_id_temporary'
    })
    const wrapper = mountView(false)
    await flushPromises()

    wrapper.findComponent(AccountActionMenu).vm.$emit('refresh-token', listRow)
    await flushPromises()

    expect(refreshCredentials).toHaveBeenCalledWith(42)
    expect(wrapper.get('[data-account-name]').attributes('data-account-name')).toBe('refreshed account')
    expect(showWarning).toHaveBeenCalledWith('Token refreshed, but project_id is temporarily unavailable')
    wrapper.unmount()
  })

  it('shows an error and keeps the modal closed when detail loading fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    getById.mockRejectedValueOnce(new Error('detail failed'))
    const wrapper = mountView()
    await flushPromises()

    const editButton = wrapper.get('button[aria-label="common.edit"]')
    await editButton.trigger('click')
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('detail failed')
    expect(wrapper.get('[data-test="edit-account"]').text()).toBe('')
    consoleError.mockRestore()
    wrapper.unmount()
  })
})
