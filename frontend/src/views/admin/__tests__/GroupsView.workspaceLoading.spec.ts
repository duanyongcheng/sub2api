import { defineComponent } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AdminGroup, PaginatedResponse } from '@/types'
import GroupDirectory from '@/components/admin/group/GroupDirectory.vue'
import GroupsView from '../GroupsView.vue'

const {
  listGroups,
  getAllGroups,
  updateGroup,
  getModelAllowlistCandidates,
  getUsageSummary,
  getCapacitySummary,
  getLiveCapability,
  getAccount,
  showSuccess,
  showError,
  authState,
} = vi.hoisted(() => ({
  listGroups: vi.fn(),
  getAllGroups: vi.fn(),
  updateGroup: vi.fn(),
  getModelAllowlistCandidates: vi.fn(),
  getUsageSummary: vi.fn(),
  getCapacitySummary: vi.fn(),
  getLiveCapability: vi.fn(),
  getAccount: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  authState: { isSimpleMode: false },
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    groups: {
      list: listGroups,
      getAll: getAllGroups,
      update: updateGroup,
      getModelAllowlistCandidates,
      getUsageSummary,
      getCapacitySummary,
      getLiveCapability,
      create: vi.fn(),
      delete: vi.fn(),
      duplicate: vi.fn(),
      updateSortOrder: vi.fn(),
    },
    accounts: { list: vi.fn(), getById: getAccount },
  },
}))
vi.mock('@/api/admin/dashboard', () => ({ getModelStats: vi.fn().mockResolvedValue({ models: [] }) }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showSuccess, showError }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => authState }))
vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => ({ isCurrentStep: () => false, nextStep: vi.fn() }),
}))
vi.mock('vue-i18n', async () => ({
  ...await vi.importActual<typeof import('vue-i18n')>('vue-i18n'),
  useI18n: () => ({ t: (key: string) => key }),
}))

function createGroup(id: number, overrides: Partial<AdminGroup> = {}): AdminGroup {
  return {
    id,
    name: `Group ${id}`,
    description: null,
    platform: 'openai',
    status: 'active',
    subscription_type: 'standard',
    is_exclusive: false,
    rate_multiplier: 1,
    rpm_limit: 0,
    daily_limit_usd: null,
    weekly_limit_usd: null,
    monthly_limit_usd: null,
    long_context_pricing_enabled: true,
    allow_image_generation: false,
    allow_batch_image_generation: false,
    image_count_billing: false,
    image_rate_independent: false,
    image_rate_multiplier: 1,
    batch_image_discount_multiplier: 0.5,
    batch_image_hold_multiplier: 0.6,
    image_price_1k: null,
    image_price_2k: null,
    image_price_4k: null,
    video_rate_independent: false,
    video_rate_multiplier: 1,
    video_price_480p: null,
    video_price_720p: null,
    video_price_1080p: null,
    web_search_price_per_call: null,
    search_price_per_1k: null,
    audio_realtime_price_per_min: null,
    audio_tts_price_per_million_chars: null,
    audio_stt_price_per_hour: null,
    peak_rate_enabled: false,
    peak_start: '',
    peak_end: '',
    peak_rate_multiplier: 1,
    claude_code_only: false,
    fallback_group_id: null,
    fallback_group_id_on_invalid_request: null,
    allow_messages_dispatch: false,
    allow_live: false,
    require_oauth_only: false,
    require_privacy_set: false,
    force_openai_fast: false,
    free_openai_fast: false,
    model_pricing: [],
    profit_control_enabled: false,
    profit_min_margin: 0,
    profit_safety_buffer: 0,
    model_routing: null,
    model_routing_enabled: false,
    mcp_xml_inject: true,
    account_count: 0,
    active_account_count: 0,
    rate_limited_account_count: 0,
    sort_order: id,
    created_at: '2026-11-12T00:00:00Z',
    updated_at: '2026-11-12T00:00:00Z',
    ...overrides,
  }
}

function pageResponse(
  items: AdminGroup[],
  total = items.length,
  page = 1,
  pageSize = 1000,
): PaginatedResponse<AdminGroup> {
  return { items, total, page, page_size: pageSize, pages: Math.ceil(total / pageSize) }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

// The parent owns collection and selection. Avoid rendering 1,000 directory rows
// in loader tests; exercise the real directory separately for its pager contract.
const DirectoryStub = defineComponent({
  name: 'GroupDirectory',
  props: ['groups', 'selectedId', 'loading', 'search', 'platform', 'status', 'total'],
  emits: ['select', 'search', 'platform', 'status', 'clear', 'refresh', 'view', 'create'],
  template: '<aside data-test="directory" />',
})
const DataTableStub = defineComponent({
  name: 'DataTable',
  props: ['data', 'columns', 'loading'],
  emits: ['sort'],
  template: '<div data-test="table">{{ data.map(row => row.id).join(",") }}</div>',
})
const PaginationStub = defineComponent({
  name: 'Pagination',
  props: ['page', 'total', 'pageSize'],
  emits: ['update:page', 'update:pageSize'],
  template: '<nav data-test="table-pagination" />',
})

const wrappers: VueWrapper[] = []
function mountView(realDirectory = false) {
  const wrapper = mount(GroupsView, {
    global: {
      stubs: {
        AppLayout: { template: '<main><slot /></main>' },
        TablePageLayout: { template: '<section><slot name="filters" /><slot name="table" /><slot name="pagination" /></section>' },
        DataTable: DataTableStub,
        Pagination: PaginationStub,
        GroupDirectory: realDirectory ? false : DirectoryStub,
        GroupEconomicsSummary: true,
        BaseDialog: { props: ['show'], template: '<div v-if="show"><slot /><slot name="footer" /></div>' },
        ConfirmDialog: true,
        EmptyState: true,
        Select: true,
        PlatformIcon: true,
        Icon: true,
        GroupCapacityBadge: true,
        GroupRateMultipliersModal: true,
        GroupRPMOverridesModal: true,
        VueDraggable: true,
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
function directory(wrapper: VueWrapper) {
  return wrapper.getComponent({ name: 'GroupDirectory' })
}
function directoryGroups(wrapper: VueWrapper): AdminGroup[] {
  return directory(wrapper).props('groups')
}
async function switchToTable(wrapper: VueWrapper) {
  directory(wrapper).vm.$emit('view')
  await flushPromises()
}
async function switchToWorkspace(wrapper: VueWrapper) {
  await wrapper.get('button[aria-label="admin.groups.workspace.configuration"]').trigger('click')
  await flushPromises()
}
function nameInput(wrapper: VueWrapper) {
  return wrapper.get<HTMLInputElement>('[data-tour="edit-group-form-name"]')
}

// Public requests and component events keep these regressions independent of
// the loader's private state and its internal helper structure.
describe('GroupsView complete workspace catalogue', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    authState.isSimpleMode = false
    listGroups.mockResolvedValue(pageResponse([createGroup(1)]))
    getAllGroups.mockResolvedValue([])
    getModelAllowlistCandidates.mockResolvedValue(['gpt-workspace'])
    getUsageSummary.mockResolvedValue([])
    getCapacitySummary.mockResolvedValue([])
    getLiveCapability.mockResolvedValue({ supported: false })
    getAccount.mockResolvedValue({ id: 9, name: 'Manifest source' })
  })

  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount()
    vi.useRealTimers()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('publishes every page atomically and edits a rich inactive group beyond the first 1,000 rows', async () => {
    localStorage.setItem('table-page-size', '10')
    const firstPage = Array.from({ length: 1000 }, (_, index) => createGroup(index + 1))
    const lastGroup = createGroup(1001, {
      name: 'Inactive configured group',
      description: 'Configuration from the second API page',
      i18n: { zh: { name: '完整配置', description: '第二页' } },
      status: 'inactive',
      subscription_type: 'subscription',
      is_exclusive: true,
      rate_multiplier: 1.75,
      rpm_limit: 73,
      daily_limit_usd: 12,
      weekly_limit_usd: 65,
      monthly_limit_usd: 200,
      force_openai_fast: true,
      model_pricing: [{
        platform: 'openai', models: ['gpt-workspace'], billing_mode: 'token',
        input_price: 2e-6, output_price: 8e-6, cache_write_price: null, cache_read_price: null,
        image_input_price: null, image_output_price: null, per_request_price: null,
        intervals: [], time_pricing: null, reasoning_effort_multipliers: { high: 1.5 },
      }],
      profit_control_enabled: true,
      profit_min_margin: 0.2,
      profit_safety_buffer: 0.05,
      peak_rate_enabled: true,
      peak_start: '18:00',
      peak_end: '23:00',
      peak_rate_multiplier: 1.2,
      model_allowlist: { enabled: true, models: ['gpt-workspace'] },
      codex_models_manifest_config: { enabled: true, account_ids: [9], fallback_to_scheduler: true },
      account_count: 17,
      active_account_count: 11,
      rate_limited_account_count: 4,
    })
    const lastPage = deferred<PaginatedResponse<AdminGroup>>()
    listGroups
      .mockResolvedValueOnce(pageResponse(firstPage, 1001))
      .mockReturnValueOnce(lastPage.promise)
    updateGroup.mockResolvedValue(lastGroup)

    const wrapper = mountView()
    await flushPromises()

    expect(listGroups).toHaveBeenCalledTimes(2)
    const firstRequest = listGroups.mock.calls[0]!
    expect(firstRequest).toEqual([
      1, 1000,
      expect.objectContaining({ sort_by: 'sort_order', sort_order: 'asc' }),
      { signal: expect.any(AbortSignal) },
    ])
    expect(firstRequest[2].status).toBeFalsy()
    expect(listGroups.mock.calls[1]).toEqual([2, 1000, firstRequest[2], firstRequest[3]])
    expect(listGroups.mock.calls[1]![3].signal).toBe(firstRequest[3].signal)
    expect(directoryGroups(wrapper)).toEqual([])
    expect(directory(wrapper).props('loading')).toBe(true)
    expect(wrapper.find('#edit-group-form').exists()).toBe(false)

    lastPage.resolve(pageResponse([lastGroup], 1001, 2))
    await flushPromises()

    expect(directoryGroups(wrapper)).toHaveLength(1001)
    expect(directoryGroups(wrapper)[1000]).toEqual(lastGroup)
    expect(directory(wrapper).props('loading')).toBe(false)
    expect(getAllGroups).not.toHaveBeenCalled()
    directory(wrapper).vm.$emit('select', directoryGroups(wrapper)[1000])
    await flushPromises()

    expect(nameInput(wrapper).element.value).toBe(lastGroup.name)
    expect(wrapper.get<HTMLTextAreaElement>('#edit-group-form textarea').element.value).toBe(lastGroup.description)
    expect(wrapper.get<HTMLInputElement>('[data-tour="group-form-multiplier"]').element.value).toBe('1.75')
    expect(wrapper.get<HTMLInputElement>('input[placeholder="admin.groups.form.rpmLimitPlaceholder"]').element.value).toBe('73')
    expect(wrapper.getComponent({ name: 'GroupOverview' }).props('group')).toEqual(lastGroup)
    expect(getModelAllowlistCandidates).toHaveBeenCalledWith(1001, 'openai')
    await wrapper.get('#edit-group-form').trigger('submit')
    await flushPromises()

    expect(updateGroup).toHaveBeenCalledWith(1001, expect.objectContaining({
      name: lastGroup.name,
      description: lastGroup.description,
      i18n: lastGroup.i18n,
      status: 'inactive',
      rate_multiplier: 1.75,
      rpm_limit: 73,
      daily_limit_usd: 12,
      weekly_limit_usd: 65,
      monthly_limit_usd: 200,
      force_openai_fast: true,
      model_pricing: [expect.objectContaining({ models: ['gpt-workspace'], input_price: 2e-6, output_price: 8e-6 })],
      profit_control_enabled: true,
      profit_min_margin: 0.2,
      profit_safety_buffer: 0.05,
      peak_rate_enabled: true,
      peak_start: '18:00',
      peak_end: '23:00',
      model_allowlist: lastGroup.model_allowlist,
      codex_models_manifest_config: lastGroup.codex_models_manifest_config,
    }))
  })

  it('uses returned page size and keeps platform, status, search, ordering and signal unchanged across pages', async () => {
    vi.useFakeTimers()
    const wrapper = mountView()
    await flushPromises()
    directory(wrapper).vm.$emit('platform', 'openai')
    await flushPromises()
    directory(wrapper).vm.$emit('status', 'inactive')
    await flushPromises()
    wrapper.getComponent(DataTableStub).vm.$emit('sort', 'name', 'desc')
    await flushPromises()
    listGroups.mockClear()
    listGroups
      .mockResolvedValueOnce(pageResponse([createGroup(2), createGroup(3)], 3, 1, 2))
      .mockResolvedValueOnce(pageResponse([createGroup(4)], 3, 2, 2))

    directory(wrapper).vm.$emit('search', '  configured  ')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(listGroups).toHaveBeenCalledTimes(2)
    const query = {
      platform: 'openai', status: 'inactive', is_exclusive: undefined,
      search: 'configured', sort_by: 'name', sort_order: 'desc',
    }
    const options = listGroups.mock.calls[0]![3]
    expect(listGroups).toHaveBeenNthCalledWith(1, 1, 1000, query, options)
    expect(listGroups).toHaveBeenNthCalledWith(2, 2, 2, query, options)
    expect(listGroups.mock.calls[1]![3].signal).toBe(options.signal)
    expect(options.signal.aborted).toBe(false)
    expect(directoryGroups(wrapper).map(group => group.id)).toEqual([2, 3, 4])
  })

  it('renders all collected rows in the real directory without previous or next page controls', async () => {
    listGroups
      .mockResolvedValueOnce(pageResponse([createGroup(1), createGroup(2)], 3, 1, 2))
      .mockResolvedValueOnce(pageResponse([createGroup(3)], 3, 2, 2))
    const wrapper = mountView(true)
    await flushPromises()

    expect(wrapper.getComponent(GroupDirectory).findAll('[data-group-id]')).toHaveLength(3)
    expect(wrapper.find('button[aria-label="pagination.previous"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="pagination.next"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="table-pagination"]').isVisible()).toBe(false)
  })

  it('keeps the last complete catalogue and editor when a later page fails', async () => {
    const savedGroup = createGroup(7)
    listGroups.mockResolvedValueOnce(pageResponse([savedGroup]))
    const wrapper = mountView()
    await flushPromises()
    await nameInput(wrapper).setValue('Unsaved draft')
    const laterPage = deferred<PaginatedResponse<AdminGroup>>()
    listGroups
      .mockResolvedValueOnce(pageResponse([createGroup(8), createGroup(9)], 3, 1, 2))
      .mockReturnValueOnce(laterPage.promise)

    directory(wrapper).vm.$emit('refresh')
    await flushPromises()
    expect(directoryGroups(wrapper)).toEqual([savedGroup])
    expect(directory(wrapper).props('loading')).toBe(true)
    laterPage.reject(new Error('Page two failed'))
    await flushPromises()

    expect(directoryGroups(wrapper)).toEqual([savedGroup])
    expect(nameInput(wrapper).element.value).toBe('Unsaved draft')
    expect(directory(wrapper).props('loading')).toBe(false)
    expect(showError).toHaveBeenCalledWith('admin.groups.failedToLoad')
    expect(updateGroup).not.toHaveBeenCalled()
  })

  it('aborts an unfinished later page on mode switch and ignores its late success', async () => {
    localStorage.setItem('table-page-size', '50')
    const stalePage = deferred<PaginatedResponse<AdminGroup>>()
    const tableGroup = createGroup(90, { name: 'Current table result' })
    listGroups
      .mockResolvedValueOnce(pageResponse([createGroup(1), createGroup(2)], 3, 1, 2))
      .mockReturnValueOnce(stalePage.promise)
      .mockResolvedValueOnce(pageResponse([tableGroup], 1, 1, 50))
    const wrapper = mountView()
    await flushPromises()
    expect(listGroups).toHaveBeenCalledTimes(2)
    const staleSignal = listGroups.mock.calls[1]![3].signal as AbortSignal

    await switchToTable(wrapper)
    expect(staleSignal.aborted).toBe(true)
    expect(listGroups).toHaveBeenLastCalledWith(1, 50, expect.anything(), { signal: expect.any(AbortSignal) })
    expect(wrapper.getComponent(DataTableStub).props('data')).toEqual([tableGroup])
    stalePage.resolve(pageResponse([createGroup(3)], 3, 2, 2))
    await flushPromises()

    expect(wrapper.getComponent(DataTableStub).props('data')).toEqual([tableGroup])
    expect(wrapper.getComponent(DataTableStub).props('loading')).toBe(false)
    expect(showError).not.toHaveBeenCalled()
  })

  it('aborts the previous filter collection and ignores a stale later page without clearing current loading', async () => {
    const stalePage = deferred<PaginatedResponse<AdminGroup>>()
    const currentResponse = deferred<PaginatedResponse<AdminGroup>>()
    listGroups
      .mockResolvedValueOnce(pageResponse([createGroup(1), createGroup(2)], 3, 1, 2))
      .mockReturnValueOnce(stalePage.promise)
      .mockReturnValueOnce(currentResponse.promise)
    const wrapper = mountView()
    await flushPromises()
    expect(listGroups).toHaveBeenCalledTimes(2)
    const staleSignal = listGroups.mock.calls[1]![3].signal as AbortSignal

    directory(wrapper).vm.$emit('status', 'inactive')
    await flushPromises()
    expect(staleSignal.aborted).toBe(true)
    expect(listGroups).toHaveBeenLastCalledWith(
      1, 1000, expect.objectContaining({ status: 'inactive' }), { signal: expect.any(AbortSignal) },
    )
    stalePage.resolve(pageResponse([createGroup(3)], 3, 2, 2))
    await flushPromises()
    expect(directoryGroups(wrapper)).toEqual([])
    expect(directory(wrapper).props('loading')).toBe(true)

    const currentGroup = createGroup(50, { status: 'inactive' })
    currentResponse.resolve(pageResponse([currentGroup]))
    await flushPromises()
    expect(directoryGroups(wrapper)).toEqual([currentGroup])
    expect(directory(wrapper).props('loading')).toBe(false)
    expect(nameInput(wrapper).element.value).toBe(currentGroup.name)
    expect(showError).not.toHaveBeenCalled()
  })

  it('silences cancellation errors from a later page superseded by a filter request', async () => {
    const canceledPage = deferred<PaginatedResponse<AdminGroup>>()
    const currentGroup = createGroup(12, { platform: 'anthropic' })
    listGroups
      .mockResolvedValueOnce(pageResponse([createGroup(1), createGroup(2)], 3, 1, 2))
      .mockReturnValueOnce(canceledPage.promise)
      .mockResolvedValueOnce(pageResponse([currentGroup]))
    const wrapper = mountView()
    await flushPromises()
    directory(wrapper).vm.$emit('platform', 'anthropic')
    await flushPromises()
    canceledPage.reject({ code: 'ERR_CANCELED' })
    await flushPromises()

    expect(directoryGroups(wrapper)).toEqual([currentGroup])
    expect(directory(wrapper).props('loading')).toBe(false)
    expect(showError).not.toHaveBeenCalled()
  })

  it('retains the saved table page size and current page through workspace transitions', async () => {
    localStorage.setItem('table-page-size', '50')
    listGroups.mockImplementation((page: number, pageSize: number) => Promise.resolve(
      pageSize === 1000
        ? pageResponse([createGroup(1), createGroup(2)])
        : pageResponse([createGroup(100 + page)], 150, page, pageSize),
    ))
    const wrapper = mountView()
    await flushPromises()
    expect(listGroups.mock.calls[0]![1]).toBe(1000)
    await switchToTable(wrapper)
    expect(listGroups.mock.lastCall?.slice(0, 2)).toEqual([1, 50])

    wrapper.getComponent(PaginationStub).vm.$emit('update:page', 3)
    await flushPromises()
    expect(listGroups.mock.lastCall?.slice(0, 2)).toEqual([3, 50])
    await switchToWorkspace(wrapper)
    expect(listGroups.mock.lastCall?.slice(0, 2)).toEqual([1, 1000])
    expect(directoryGroups(wrapper).map(group => group.id)).toEqual([1, 2])
    expect(localStorage.getItem('table-page-size')).toBe('50')
    await switchToTable(wrapper)

    expect(listGroups.mock.lastCall?.slice(0, 2)).toEqual([3, 50])
    expect(wrapper.getComponent(PaginationStub).props()).toEqual({ page: 3, total: 150, pageSize: 50 })
    expect(wrapper.getComponent(DataTableStub).props('data')).toEqual([createGroup(103)])
  })

  it('preserves a dirty selected editor across table loads and workspace refreshes', async () => {
    const firstGroup = createGroup(1)
    const secondGroup = createGroup(2)
    listGroups
      .mockResolvedValueOnce(pageResponse([firstGroup, secondGroup]))
      .mockResolvedValueOnce(pageResponse([secondGroup], 1, 1, 20))
      .mockResolvedValueOnce(pageResponse([{ ...firstGroup, name: 'Changed on server' }, secondGroup]))
    const wrapper = mountView()
    await flushPromises()
    await nameInput(wrapper).setValue('Keep this draft')
    await wrapper.get('[data-group-tab="rates"]').trigger('click')
    await wrapper.get('[data-tour="group-form-multiplier"]').setValue('2.25')
    await switchToTable(wrapper)
    await switchToWorkspace(wrapper)

    expect(listGroups).toHaveBeenCalledTimes(3)
    expect(nameInput(wrapper).element.value).toBe('Keep this draft')
    expect(wrapper.get<HTMLInputElement>('[data-tour="group-form-multiplier"]').element.value).toBe('2.25')
    expect(directory(wrapper).props('selectedId')).toBe(1)
    expect(wrapper.get('[data-group-tab="rates"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.text()).toContain('admin.groups.workspace.unsaved')
    directory(wrapper).vm.$emit('select', secondGroup)
    await flushPromises()

    const confirmation = wrapper.findAllComponents({ name: 'ConfirmDialog' })
      .find(dialog => dialog.props('title') === 'admin.groups.workspace.unsavedTitle')!
    expect(confirmation.props('show')).toBe(true)
    expect(nameInput(wrapper).element.value).toBe('Keep this draft')
    confirmation.vm.$emit('cancel')
    await flushPromises()
    expect(directory(wrapper).props('selectedId')).toBe(1)
    expect(updateGroup).not.toHaveBeenCalled()
  })

  it('retries a changing collection before exposing deduplicated complete results', async () => {
    const retryPage = deferred<PaginatedResponse<AdminGroup>>()
    listGroups
      .mockResolvedValueOnce(pageResponse([createGroup(1), createGroup(2)], 3, 1, 2))
      // Offset movement repeated ID 2 and omitted ID 3, so this is incomplete.
      .mockResolvedValueOnce(pageResponse([createGroup(2)], 3, 2, 2))
      .mockReturnValueOnce(retryPage.promise)
      .mockResolvedValueOnce(pageResponse([createGroup(3)], 3, 2, 2))
    const wrapper = mountView()
    await flushPromises()

    expect(listGroups).toHaveBeenCalledTimes(3)
    expect(listGroups.mock.calls[2]!.slice(0, 2)).toEqual([1, 1000])
    expect(directoryGroups(wrapper)).toEqual([])
    expect(directory(wrapper).props('loading')).toBe(true)
    retryPage.resolve(pageResponse([createGroup(1), createGroup(2)], 3, 1, 2))
    await flushPromises()

    expect(listGroups).toHaveBeenCalledTimes(4)
    expect(directoryGroups(wrapper).map(group => group.id)).toEqual([1, 2, 3])
    expect(new Set(directoryGroups(wrapper).map(group => group.id)).size).toBe(3)
    expect(showError).not.toHaveBeenCalled()
  })

  it('does not publish or retry forever when every collection is incomplete', async () => {
    listGroups.mockImplementation((page: number) => Promise.resolve(page === 1
      ? pageResponse([createGroup(1), createGroup(2)], 3, 1, 2)
      : pageResponse([createGroup(2)], 3, 2, 2),
    ))
    const wrapper = mountView()
    await flushPromises()

    expect(listGroups.mock.calls.length).toBeGreaterThan(2)
    expect(listGroups.mock.calls.length).toBeLessThanOrEqual(6)
    expect(directoryGroups(wrapper)).toEqual([])
    expect(directory(wrapper).props('loading')).toBe(false)
    expect(showError).toHaveBeenCalledWith('admin.groups.failedToLoad')
  })

  it('loads every simple-mode page without requesting advanced group configuration', async () => {
    authState.isSimpleMode = true
    listGroups
      .mockResolvedValueOnce(pageResponse([createGroup(1), createGroup(2)], 3, 1, 2))
      .mockResolvedValueOnce(pageResponse([createGroup(3, { status: 'inactive' })], 3, 2, 2))
    const wrapper = mountView()
    await flushPromises()

    expect(directoryGroups(wrapper).map(group => group.id)).toEqual([1, 2, 3])
    expect(listGroups.mock.calls.every(call => call[2].is_exclusive === undefined)).toBe(true)
    expect(getModelAllowlistCandidates).not.toHaveBeenCalled()
    expect(getUsageSummary).not.toHaveBeenCalled()
    expect(getCapacitySummary).not.toHaveBeenCalled()
    expect(getLiveCapability).not.toHaveBeenCalled()
  })
})
