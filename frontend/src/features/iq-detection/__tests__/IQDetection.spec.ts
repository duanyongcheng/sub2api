import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import en from '@/i18n/locales/en'
import zh from '@/i18n/locales/zh'
import { routes } from '@/router'
import type {
  IQDetectionConfig,
  IQDetectionOverview,
  IQDetectionRun
} from '../types'
import IQDetectionView from '../IQDetectionView.vue'
import IQDetectionSettingsPanel from '../IQDetectionSettingsPanel.vue'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path: string) => readFileSync(resolve(here, path), 'utf8')

const apiMocks = vi.hoisted(() => ({
  getIQDetectionConfig: vi.fn(),
  updateIQDetectionConfig: vi.fn(),
  getIQDetectionOverview: vi.fn(),
  listIQDetectionRuns: vi.fn(),
  runIQDetectionNow: vi.fn(),
  fetchAllOpenAIGroups: vi.fn()
}))

const storeMocks = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
  showInfo: vi.fn()
}))

const routerMocks = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  replace: vi.fn(() => Promise.resolve())
}))

vi.mock('../api', () => apiMocks)

vi.mock('@/stores/app', () => ({
  useAppStore: () => storeMocks
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => ({ query: routerMocks.query }),
    useRouter: () => ({ replace: routerMocks.replace })
  }
})

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  const lookup = (obj: Record<string, unknown>, path: string): string => {
    const val = path.split('.').reduce<unknown>((acc, seg) => {
      if (acc && typeof acc === 'object' && seg in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[seg]
      }
      return undefined
    }, obj)
    return typeof val === 'string' ? val : path
  }
  return {
    ...actual,
    useI18n: () => ({
      locale: { value: 'zh' },
      t: (key: string, params?: Record<string, unknown>) => {
        const tpl = lookup(zh as unknown as Record<string, unknown>, key)
        return tpl.replace(/\{(\w+)\}/g, (_, token) => String(params?.[token] ?? `{${token}}`))
      }
    })
  }
})

const sampleConfig = (): IQDetectionConfig => ({
  version: 2,
  enabled: false,
  interval_minutes: 720,
  group_ids: [10],
  model: 'gpt-5.4',
  reasoning_effort: 'medium',
  tests_per_group: 1,
  last_scheduled_at: null,
  updated_at: '2026-11-15T08:00:00Z',
  updated_by: 1,
  builtin_prompt: '黑袋摸糖题原文'
})

const sampleRun = (): IQDetectionRun => ({
  id: 901,
  group_id: 10,
  group_name: 'Codex Pro Pool',
  platform: 'openai',
  trigger_type: 'manual',
  requested_model: 'gpt-5.4',
  reasoning_effort: 'medium',
  tests_count: 1,
  graded_count: 1,
  correct_count: 1,
  truncated_count: 1,
  verdict: 'warning',
  avg_input_tokens: 185,
  avg_output_tokens: 550,
  avg_reasoning_tokens: 516,
  avg_latency_ms: 4200,
  avg_tps: 131.0,
  response_model: 'gpt-5.4-2026',
  answer_preview: '最少需要取出 21 个糖果。',
  error_message: '',
  samples: [
    {
      run_index: 1,
      account_id: 77,
      account_name: 'codex-team-01',
      account_type: 'oauth',
      protocol: 'codex_oauth_responses',
      ok: true,
      graded: true,
      truncated: true,
      truncation_signature: '518n-2 (516)',
      input_tokens: 185,
      output_tokens: 550,
      reasoning_tokens: 516,
      latency_ms: 4200,
      tps: 131.0,
      response_model: 'gpt-5.4-2026',
      answer_text: '最少需要取出 21 个糖果。'
    }
  ],
  started_at: '2026-11-15T08:10:00Z',
  completed_at: '2026-11-15T08:10:04Z',
  created_at: '2026-11-15T08:10:04Z'
})

const sampleOverview = (): IQDetectionOverview => ({
  config: sampleConfig(),
  summary: {
    configured_count: 1,
    tested_count: 1,
    normal_count: 0,
    warning_count: 1,
    degraded_count: 0,
    error_count: 0,
    untested_count: 0
  },
  groups: [
    {
      group_id: 10,
      group_name: 'Codex Pro Pool',
      platform: 'openai',
      group_status: 'active',
      schedulable_account_count: 4,
      in_flight: false,
      latest_run: sampleRun()
    }
  ]
})

const AppLayoutStub = { template: '<div data-testid="app-layout"><slot /></div>' }
const BaseDialogStub = {
  props: ['show', 'title', 'width'],
  emits: ['close'],
  template: '<div v-if="show" data-testid="detail-dialog"><h3>{{ title }}</h3><slot /><slot name="footer" /></div>'
}

describe('IQ Detection admin-only integration surface', () => {
  it('registers /admin/iq-detection with requiresAuth and requiresAdmin', () => {
    const matched = routes.find((r) => r.path === '/admin/iq-detection')
    expect(matched).toBeDefined()
    expect(matched?.meta).toMatchObject({
      requiresAuth: true,
      requiresAdmin: true
    })
  })

  it('mounts /admin/iq-detection only in adminNavGroups and never in userNavGroups', () => {
    const sidebar = read('../../../components/layout/AppSidebar.vue')
    const userStart = sidebar.indexOf('const userNavGroups = computed')
    const adminStart = sidebar.indexOf('const adminNavGroups = computed')
    expect(userStart).toBeGreaterThan(-1)
    expect(adminStart).toBeGreaterThan(userStart)

    const userSection = sidebar.slice(userStart, adminStart)
    const adminSection = sidebar.slice(adminStart)

    expect(userSection).not.toContain('/admin/iq-detection')
    expect(userSection).not.toContain('nav.iqDetection')
    expect(adminSection).toContain("path: '/admin/iq-detection'")
    expect(adminSection).toContain("t('nav.iqDetection')")
  })

  it('maintains symmetric zh/en i18n keys for iqDetection and nav.iqDetection', () => {
    expect(zh.nav.iqDetection).toBe('智商检测')
    expect(en.nav.iqDetection).toBe('IQ Detection')
    expect(Object.keys(zh.iqDetection)).toEqual(Object.keys(en.iqDetection))
  })
})

describe('IQDetectionView', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((fn) => fn.mockReset())
    Object.values(storeMocks).forEach((fn) => fn.mockReset())
    routerMocks.query = {}
    routerMocks.replace.mockClear()

    apiMocks.getIQDetectionOverview.mockResolvedValue(sampleOverview())
    apiMocks.listIQDetectionRuns.mockResolvedValue({
      items: [sampleRun()],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1
    })
    apiMocks.runIQDetectionNow.mockResolvedValue({
      requested_groups: 1,
      executed_groups: 1,
      skipped_in_flight_groups: [],
      runs: [sampleRun()]
    })
  })

  function mountView() {
    return mount(IQDetectionView, {
      global: {
        stubs: {
          AppLayout: AppLayoutStub,
          BaseDialog: BaseDialogStub
        }
      }
    })
  }

  it('loads overview and runs, displays truncation diagnostics, and triggers single/all group probes', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(apiMocks.getIQDetectionOverview).toHaveBeenCalledTimes(1)
    expect(apiMocks.listIQDetectionRuns).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Codex Pro Pool')
    expect(wrapper.text()).toContain('516')

    // Trigger single group probe
    await wrapper.get('[data-testid="iq-run-group-10"]').trigger('click')
    await flushPromises()
    expect(apiMocks.runIQDetectionNow).toHaveBeenCalledWith({ group_ids: [10] })
    expect(storeMocks.showSuccess).toHaveBeenCalled()

    // Open detail modal and verify 518n-2 truncation signature is shown
    await wrapper.get('[data-testid="iq-group-detail-10"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="detail-dialog"]').text()).toContain('518n-2 (516)')

    // Trigger run-all
    await wrapper.get('[data-testid="iq-run-all-btn"]').trigger('click')
    await flushPromises()
    expect(apiMocks.runIQDetectionNow).toHaveBeenLastCalledWith({})
  })

  it('shows empty state CTA and switches to settings when no groups are configured', async () => {
    apiMocks.getIQDetectionOverview.mockResolvedValue({
      config: { ...sampleConfig(), group_ids: [] },
      summary: {
        configured_count: 0,
        tested_count: 0,
        normal_count: 0,
        warning_count: 0,
        degraded_count: 0,
        error_count: 0,
        untested_count: 0
      },
      groups: []
    })
    apiMocks.listIQDetectionRuns.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      pages: 0
    })
    apiMocks.fetchAllOpenAIGroups.mockResolvedValue([])
    apiMocks.getIQDetectionConfig.mockResolvedValue({ ...sampleConfig(), group_ids: [] })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="iq-empty-groups"]').exists()).toBe(true)
    await wrapper.get('[data-testid="iq-goto-settings-btn"]').trigger('click')
    await flushPromises()

    expect(routerMocks.replace).toHaveBeenCalledWith({ query: { tab: 'settings' } })
  })

  it('displays scheduled patrol badge for 30-minute and 1-hour intervals', async () => {
    apiMocks.getIQDetectionOverview.mockResolvedValue({
      ...sampleOverview(),
      config: { ...sampleConfig(), enabled: true, interval_minutes: 30 }
    })

    const wrapper30 = mountView()
    await flushPromises()
    expect(wrapper30.text()).toContain('定时巡检已开启（每 30 分钟）')

    apiMocks.getIQDetectionOverview.mockResolvedValue({
      ...sampleOverview(),
      config: { ...sampleConfig(), enabled: true, interval_minutes: 60 }
    })

    const wrapper60 = mountView()
    await flushPromises()
    expect(wrapper60.text()).toContain('定时巡检已开启（每 1 小时）')
  })
})

describe('IQDetectionSettingsPanel', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((fn) => fn.mockReset())
    Object.values(storeMocks).forEach((fn) => fn.mockReset())

    apiMocks.fetchAllOpenAIGroups.mockResolvedValue([
      {
        id: 10,
        name: 'Codex Pro Pool',
        platform: 'openai',
        status: 'active',
        account_count: 5,
        active_account_count: 4
      },
      {
        id: 15,
        name: 'Codex Team Pool',
        platform: 'openai',
        status: 'active',
        account_count: 3,
        active_account_count: 3
      }
    ])
    apiMocks.updateIQDetectionConfig.mockImplementation(async (cfg: IQDetectionConfig) => ({
      ...cfg,
      version: cfg.version + 1
    }))
  })

  it('loads OpenAI group catalog, selects active groups, and saves updated config', async () => {
    const wrapper = mount(IQDetectionSettingsPanel, {
      props: {
        initialConfig: { ...sampleConfig(), group_ids: [10] }
      }
    })
    await flushPromises()

    expect(apiMocks.fetchAllOpenAIGroups).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Codex Pro Pool')
    expect(wrapper.text()).toContain('Codex Team Pool')

    await wrapper.get('[data-testid="iq-select-active-groups-btn"]').trigger('click')
    await wrapper.get('[data-testid="iq-save-config-btn"]').trigger('click')
    await flushPromises()

    expect(apiMocks.updateIQDetectionConfig).toHaveBeenCalledTimes(1)
    const submitted = apiMocks.updateIQDetectionConfig.mock.calls[0][0] as IQDetectionConfig
    expect(submitted.group_ids).toEqual([10, 15])
    expect(storeMocks.showSuccess).toHaveBeenCalled()
  })

  it('renders 30m and 1h patrol interval options and persists selected frequencies', async () => {
    const wrapper = mount(IQDetectionSettingsPanel, {
      props: {
        initialConfig: { ...sampleConfig(), group_ids: [10], interval_minutes: 720 }
      }
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="iq-interval-opt-30"]').text()).toBe('每 30 分钟')
    expect(wrapper.get('[data-testid="iq-interval-opt-60"]').text()).toBe('每 1 小时')
    expect(wrapper.get('[data-testid="iq-interval-opt-360"]').text()).toBe('每 6 小时')
    expect(wrapper.get('[data-testid="iq-interval-opt-720"]').text()).toBe('每 12 小时')
    expect(wrapper.get('[data-testid="iq-interval-opt-1440"]').text()).toBe('每 24 小时')

    // Select 30 minutes and save
    await wrapper.get('[data-testid="iq-interval-opt-30"]').trigger('click')
    await wrapper.get('[data-testid="iq-save-config-btn"]').trigger('click')
    await flushPromises()

    expect(apiMocks.updateIQDetectionConfig).toHaveBeenCalledTimes(1)
    expect((apiMocks.updateIQDetectionConfig.mock.calls[0][0] as IQDetectionConfig).interval_minutes).toBe(30)

    // Select 1 hour (60 minutes) and save
    await wrapper.get('[data-testid="iq-interval-opt-60"]').trigger('click')
    await wrapper.get('[data-testid="iq-save-config-btn"]').trigger('click')
    await flushPromises()

    expect(apiMocks.updateIQDetectionConfig).toHaveBeenCalledTimes(2)
    expect((apiMocks.updateIQDetectionConfig.mock.calls[1][0] as IQDetectionConfig).interval_minutes).toBe(60)
  })
})
